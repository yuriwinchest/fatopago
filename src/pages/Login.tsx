import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Clock, List, Newspaper, Medal, Trophy } from 'lucide-react';
import { useLoginForm } from '../hooks/useLoginForm';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { AuthLayout } from '../layouts/AuthLayout';

const Login = () => {
    const {
        email,
        setEmail,
        password,
        setPassword,
        loading,
        error,
        handleSubmit
    } = useLoginForm();

    const [searchParams] = useSearchParams();
    const registered = searchParams.get('registered');

    const LeftContent = (
        <div className="flex-1 flex flex-col max-w-md mx-auto w-full px-6 pb-8 pt-4 lg:pt-8">
            <h1 className="text-2xl lg:text-3xl lg:text-4xl font-extrabold mb-6 text-center drop-shadow-md">
                Como funciona?
            </h1>

            <div className="space-y-4">
                {[
                    { step: "1", title: "Crie sua conta", desc: "Rápido e fácil.", icon: <Clock className="w-5 h-5 text-white" /> },
                    { step: "2", title: "Escolha seu plano", desc: "Selecione o ideal para você.", icon: <List className="w-5 h-5 text-white" /> },
                    { step: "3", title: "Valide notícias", desc: "Analise a veracidade diariamente.", icon: <Newspaper className="w-5 h-5 text-white" /> },
                    { step: "4", title: "Ranking diário", desc: "Destaque-se em sua cidade.", icon: <Medal className="w-5 h-5 text-white" /> },
                    { step: "5", title: "Premiação", desc: "Até R$ 200,00 por dia para o 1º lugar!", icon: <Trophy className="w-5 h-5 text-white" /> }
                ].map((item, idx) => (
                    <div key={idx} className="relative group">
                        <div className="absolute inset-0 bg-white/10 rounded-2xl blur-[1px] border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]"></div>
                        <div className="relative flex items-center p-3 lg:p-4 rounded-2xl bg-gradient-to-r from-white/10 to-transparent border border-white/20 shadow-lg backdrop-blur-sm">
                            <div className="flex-shrink-0 w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-gradient-to-br from-[#d946ef] to-[#8b5cf6] border-2 border-white/30 flex items-center justify-center shadow-inner">
                                <span className="text-lg lg:text-xl font-bold text-white drop-shadow-md">{item.step}</span>
                            </div>
                            <div className="flex-1 ml-4 mr-2">
                                <h3 className="font-bold text-sm lg:text-base leading-tight mb-0.5 text-white drop-shadow-sm">{item.title}</h3>
                                <p className="text-purple-100 text-[10px] lg:text-xs leading-snug font-medium opacity-90">{item.desc}</p>
                            </div>
                            <div className="flex-shrink-0 w-8 h-8 lg:w-10 lg:h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner backdrop-blur-md hidden sm:flex">
                                {item.icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <AuthLayout leftPanelContent={LeftContent}>
            {registered && (
                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-400 animate-in fade-in slide-in-from-top-2">
                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">✓</div>
                    <p className="text-sm font-medium">Conta criada com sucesso! Faça login abaixo.</p>
                </div>
            )}

            <h2 className="text-3xl font-bold text-white mb-2">Acesse sua conta</h2>
            <p className="text-slate-400 mb-8">Insira suas credenciais para continuar.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                    label="E-mail"
                    type="email"
                    placeholder="nome@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />

                <Input
                    label="Senha"
                    type="password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    rightElement={
                        <Link to="/forgot-password" className="text-xs text-[#B084FF] hover:underline font-bold pointer-events-auto">
                            Esqueceu?
                        </Link>
                    }
                />

                {error && (
                    <div className="p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                        {error}
                    </div>
                )}

                <Button
                    type="submit"
                    fullWidth
                    isLoading={loading}
                    rightIcon={!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                >
                    {loading ? "Entrando..." : "Entrar na Plataforma"}
                </Button>
            </form>

            <div className="mt-8 text-center">
                <p className="text-sm text-slate-400">
                    Ainda não tem conta? <Link to="/register" className="text-[#B084FF] font-bold hover:underline">Cadastre-se</Link>
                </p>
            </div>
        </AuthLayout>
    );
};

export default Login;
