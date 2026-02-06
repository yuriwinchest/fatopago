import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { NewsCarousel } from '../components/NewsCarousel';
import { MOCK_NEWS } from '../data/mockNews';

const Login = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const registered = searchParams.get('registered');

    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                navigate('/plans');
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erro ao entrar. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#9D5CFF] focus:border-transparent outline-none transition-all placeholder:text-gray-400 text-gray-900 font-medium";

    return (
        <div className="min-h-screen flex flex-col lg:flex-row font-sans">
            {/* Left Panel - Vibrant Gradient */}
            <div className="lg:w-[45%] flex flex-col justify-between bg-gradient-to-br from-[#8a2ce2] to-[#6922D9] relative overflow-hidden text-white">

                {/* Header with Logo - Matches Reference */}
                <div className="relative z-20 bg-[#2e0259] pt-12 pb-8 rounded-b-[40px] shadow-2xl flex justify-center items-center">
                    <div className="flex items-center gap-3 transform scale-110">
                        <div className="relative w-12 h-10 bg-gradient-to-br from-[#a855f7] to-[#7e22ce] rounded-lg flex items-center justify-center shadow-lg border border-white/20 transform -skew-x-12">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white transform skew-x-12">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-black tracking-wide text-white drop-shadow-lg italic">FATOPAGO</h1>
                    </div>
                    {/* Decorative star from reference */}
                    <div className="absolute bottom-4 right-8 w-4 h-4 text-purple-300 opacity-80">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" /></svg>
                    </div>
                </div>

                {/* Background Watermark */}
                <img
                    src="/watermark.png?v=4"
                    alt=""
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] opacity-[0.05] pointer-events-none select-none mix-blend-screen blur-[1px]"
                />

                <div className="relative z-10 px-8 lg:px-16 pt-8">
                    <h1 className="text-4xl lg:text-5xl font-extrabold mb-4 leading-tight">
                        Bem-vindo de volta
                    </h1>
                    <p className="text-purple-100 text-lg mb-8 leading-relaxed max-w-md">
                        Acesse seu painel para validar novas notícias e acompanhar seus rendimentos.
                    </p>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-900/20 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

                <div className="relative z-10 w-full max-w-sm mx-auto lg:mx-0 px-8 lg:px-16 pb-8">
                    <div className="mb-6">
                        <NewsCarousel
                            tasks={MOCK_NEWS}
                            onValidate={() => {
                                // Focus email input on validating
                                const emailInput = document.querySelector('input[type="email"]') as HTMLInputElement;
                                if (emailInput) emailInput.focus();
                            }}
                            isReadOnly={true}
                            autoPlay={true}
                            interval={2000}
                        />
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex -space-x-3">
                            <img src="https://i.pravatar.cc/100?img=1" alt="User" className="w-10 h-10 rounded-full border-2 border-[#8a2ce2]" />
                            <img src="https://i.pravatar.cc/100?img=5" alt="User" className="w-10 h-10 rounded-full border-2 border-[#8a2ce2]" />
                            <img src="https://i.pravatar.cc/100?img=8" alt="User" className="w-10 h-10 rounded-full border-2 border-[#8a2ce2]" />
                        </div>
                        <div>
                            <span className="block text-sm font-bold text-white">+12k usuários</span>
                            <span className="text-xs text-purple-200">validando agora</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="lg:w-[55%] bg-[#0F0529] p-8 lg:p-16 flex flex-col justify-center relative">
                <div className="max-w-md w-full mx-auto">
                    {/* Logo removed from here as it's now in the header */}

                    {registered && (
                        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-3 text-green-400">
                            <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">✓</div>
                            <p className="text-sm font-medium">Conta criada com sucesso! Faça login abaixo.</p>
                        </div>
                    )}

                    <h2 className="text-3xl font-bold text-white mb-2">Acesse sua conta</h2>
                    <p className="text-slate-400 mb-8">Insira suas credenciais para continuar.</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-300 ml-1">E-mail</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="nome@exemplo.com"
                                className={inputClasses}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-sm font-semibold text-slate-300">Senha</label>
                                <Link to="/forgot-password" className="text-xs text-[#B084FF] hover:underline">Esqueceu a senha?</Link>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Sua senha"
                                    className={`${inputClasses} pr-10`}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3.5 text-gray-500 hover:text-purple-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#B084FF] hover:bg-[#9D5CFF] disabled:bg-[#B084FF]/50 disabled:cursor-not-allowed text-[#2c1a59] hover:text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 group shadow-lg shadow-[#9D5CFF]/20 mt-4"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Entrando...
                                </>
                            ) : (
                                <>
                                    Entrar na Plataforma
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-slate-400">
                            Ainda não tem conta? <Link to="/register" className="text-[#B084FF] font-bold hover:underline">Cadastre-se</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
