import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, AlertCircle, Loader2, Clock, List, Newspaper, Trophy, Medal } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

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
                navigate('/home');
            }
        } catch (err: any) {
            const msg = err.message || "Erro ao entrar. Tente novamente.";

            // Suppress console error for expected auth failures
            if (msg !== "Email ou senha incorretos." && msg !== "Invalid login credentials") {
                console.error(err);
            }

            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#9D5CFF] focus:border-transparent outline-none transition-all placeholder:text-gray-400 text-gray-900 font-medium";

    return (
        <div className="min-h-screen flex flex-col lg:flex-row font-sans bg-[#0F0529]">
            {/* Left Panel - Vibrant Gradient */}
            <div className="lg:w-[45%] flex flex-col bg-gradient-to-b from-[#9b3bea] to-[#6a11cb] relative overflow-hidden text-white shadow-2xl z-10">
                {/* Header with Logo - Matches Reference */}
                <div className="relative z-20 bg-[#2e0259] pt-12 pb-8 rounded-b-[40px] shadow-2xl flex justify-center items-center">
                    <img src="/logo.png" alt="Fatopago Logo" className="h-auto w-72 sm:w-96 md:w-[32rem] drop-shadow-2xl hover:scale-105 transition-transform duration-300" />
                </div>

                {/* Background Glow */}
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-purple-400/20 via-transparent to-transparent pointer-events-none" />

                <div className="relative z-10 flex-1 flex flex-col max-w-md mx-auto w-full px-6 pb-8 pt-8">
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-6 text-center drop-shadow-md">
                        Como funciona?
                    </h1>

                    <div className="space-y-4">
                        {[
                            {
                                step: "1",
                                title: "Crie sua conta em poucos minutos.",
                                desc: "Rapidamente e fácil.",
                                icon: <Clock className="w-6 h-6 text-white" />
                            },
                            {
                                step: "2",
                                title: "Escolha seu plano",
                                desc: "Selecione o plano que melhor se encaixa no seu perfil e objetivos.",
                                icon: <List className="w-6 h-6 text-white" />
                            },
                            {
                                step: "3",
                                title: "Valide notícias.",
                                desc: "Analise e valide notícias diariamente dentro da plataforma.",
                                icon: <Newspaper className="w-6 h-6 text-white" />
                            },
                            {
                                step: "4",
                                title: "Ranking diário por cidade",
                                desc: "Os participantes são ranqueados diariamente por desempenho em cada cidade.",
                                icon: <Medal className="w-6 h-6 text-white" />
                            },
                            {
                                step: "5",
                                title: "Premiação diária",
                                desc: "Após o ciclo de 24h, quem ficar em 1º lugar leva até R$ 200,00 de prêmio!",
                                icon: <Trophy className="w-6 h-6 text-white" />
                            }
                        ].map((item, idx) => (
                            <div key={idx} className="relative group">
                                {/* Glass Card */}
                                <div className="absolute inset-0 bg-white/10 rounded-2xl blur-[1px] border border-white/20 shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]"></div>
                                <div className="relative flex items-center p-4 rounded-2xl bg-gradient-to-r from-white/10 to-transparent border border-white/20 shadow-lg backdrop-blur-sm">

                                    {/* Number Badge */}
                                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-[#d946ef] to-[#8b5cf6] border-2 border-white/30 flex items-center justify-center shadow-inner">
                                        <span className="text-xl font-bold text-white drop-shadow-md">{item.step}</span>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 ml-4 mr-2">
                                        <h3 className="font-bold text-base leading-tight mb-1 text-white drop-shadow-sm">{item.title}</h3>
                                        <p className="text-purple-100 text-xs leading-snug font-medium opacity-90">{item.desc}</p>
                                    </div>

                                    {/* Right Icon Container */}
                                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner backdrop-blur-md">
                                        {item.icon}
                                    </div>
                                </div>
                            </div>
                        ))}
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
