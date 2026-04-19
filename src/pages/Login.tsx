import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, AlertCircle } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { AuthLayout } from '../layouts/AuthLayout';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { AuthSocialProof } from '../components/auth/AuthSocialProof';
import { getRoleFromContext, getRoleRedirect, resolveIsAdminUser } from '../lib/authRouting';
import { parsePlanId } from '../lib/planRules';
import PromoMediaAsset from '../components/PromoMediaAsset';
import { usePromoMedia } from '../hooks/usePromoMedia';
import {
    buildPlansAutoPlanQueryString,
    clearStoredAutoPlanContext,
    persistAutoPlanContext,
    readStoredAutoPlanContext,
    resolveAutoPlanContext
} from '../lib/sellerMonthlyLinks';

const LoginShowcasePanel = () => {
    const { mediaKind, mediaUrl } = usePromoMedia();

    return (
        <>
            <div className="mx-auto mb-6 w-full max-w-sm lg:mx-0">
                <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#1A1040] shadow-xl">
                    <div className="pointer-events-none absolute inset-x-10 -top-5 h-10 rounded-full bg-white/20 blur-2xl" />
                    <PromoMediaAsset
                        mediaKind={mediaKind}
                        src={mediaUrl}
                        alt="Mídia principal da plataforma FatoPago"
                        className="block aspect-[9/16] w-full object-cover"
                    />
                </div>
            </div>

            <AuthSocialProof className="mx-auto w-full max-w-none lg:mx-0 lg:max-w-md" />
        </>
    );
};

const Login = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const searchKey = searchParams.toString();
    const registered = searchParams.get('registered');
    const reset = searchParams.get('reset');
    const urlAutoPlanResolution = useMemo(() => resolveAutoPlanContext(
        parsePlanId(searchParams.get('plan')),
        {
            windowStartAt: searchParams.get('windowStartAt'),
            windowEndAt: searchParams.get('windowEndAt')
        }
    ), [searchKey, searchParams]);
    const storedAutoPlanResolution = useMemo(() => readStoredAutoPlanContext(), [searchKey]);
    const autoPlanResolution = urlAutoPlanResolution.status !== 'none'
        ? urlAutoPlanResolution
        : storedAutoPlanResolution;
    const autoPlanContext = autoPlanResolution.status === 'valid' ? autoPlanResolution.context : null;
    const autoPlan = autoPlanContext?.planId || null;
    const autoPlanMessage = autoPlanResolution.status === 'expired' || autoPlanResolution.status === 'invalid'
        ? autoPlanResolution.message || null
        : null;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (urlAutoPlanResolution.status === 'valid' && urlAutoPlanResolution.context) {
            persistAutoPlanContext(urlAutoPlanResolution.context);
            return;
        }

        if (urlAutoPlanResolution.status === 'expired' || urlAutoPlanResolution.status === 'invalid') {
            clearStoredAutoPlanContext();
        }
    }, [urlAutoPlanResolution]);

    // Form data
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!email || !password) {
            setError("Por favor, preencha todos os campos.");
            return;
        }

        setLoading(true);

        try {
            const { data, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (authError) {
                if (authError.message === "Invalid login credentials") {
                    throw new Error("Email ou senha incorretos.");
                }
                throw authError;
            }

            if (data.user) {
                let isSeller = false;
                const isAdmin = await resolveIsAdminUser(data.user.id);
                const userEmail = data.user.email || '';

                if (!isAdmin) {
                    const { data: sellerData, error: sellerError } = await supabase.rpc('get_my_seller_profile');
                    if (!sellerError) {
                        if (Array.isArray(sellerData)) {
                            isSeller = sellerData.length > 0;
                        } else if (sellerData && typeof sellerData === 'object') {
                            isSeller = Boolean((sellerData as any).id);
                        }
                    } else {
                        console.warn('Não foi possível verificar vendedor:', sellerError);
                    }
                }

                const role = getRoleFromContext({ email: userEmail, isAdmin, isSeller });
                if (role === 'user' && autoPlan) {
                    clearStoredAutoPlanContext();
                    if (autoPlanContext) {
                        navigate(`/plans?${buildPlansAutoPlanQueryString(autoPlanContext)}`, { replace: true });
                        return;
                    }
                    navigate(`/plans?autoPlan=${encodeURIComponent(autoPlan)}&returnTo=/validation`, { replace: true });
                    return;
                }
                clearStoredAutoPlanContext();
                navigate(getRoleRedirect(role), { replace: true });
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erro ao entrar. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    const LeftContent = (
        <>
            <div className="relative z-10 px-8 lg:px-16 pt-8">
                <h1 className="text-4xl lg:text-5xl font-extrabold mb-4 leading-tight">
                    Bem-vindo de volta
                </h1>
                <p className="text-purple-100 text-lg mb-8 leading-relaxed max-w-md">
                    Acesse seu painel para validar novas notícias e acompanhar seus rendimentos.
                </p>
            </div>

            <div className="relative z-10 w-full px-4 pb-8 sm:px-6 lg:px-16">
                <LoginShowcasePanel />
            </div>
        </>
    );

    return (
        <AuthLayout leftPanelContent={LeftContent}>
            {registered && (
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-green-400">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20">✓</div>
                    <p className="text-sm font-medium">Conta criada com sucesso! Faça login abaixo.</p>
                </div>
            )}

            {reset === 'success' && (
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/10 p-4 text-green-400">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20">✓</div>
                    <p className="text-sm font-medium">Senha redefinida com sucesso. Faça login com sua nova senha.</p>
                </div>
            )}

            {autoPlanMessage && (
                <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-200">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">{autoPlanMessage}</p>
                </div>
            )}

            <h2 className="mb-2 text-3xl font-bold text-white">Acesse sua conta</h2>
            <p className="mb-8 text-slate-400">Insira suas credenciais para continuar.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                    label="E-mail"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@exemplo.com"
                />

                <Input
                    label="Senha"
                    labelRight={<Link to="/forgot-password" className="text-[hsl(var(--primary))] hover:underline">Esqueceu a senha?</Link>}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                />

                {error && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-400">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p>{error}</p>
                    </div>
                )}

                <Button
                    type="submit"
                    fullWidth
                    isLoading={loading}
                    rightIcon={!loading && <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />}
                    className="mt-4"
                >
                    {loading ? "Entrando..." : "Entrar na Plataforma"}
                </Button>
            </form>

            <div className="mt-8 text-center">
                <p className="text-sm text-slate-400">
                    Ainda não tem conta? <Link to="/register" className="font-bold text-[hsl(var(--primary))] hover:underline">Cadastre-se</Link>
                </p>
            </div>
        </AuthLayout>
    );
};

export default Login;
