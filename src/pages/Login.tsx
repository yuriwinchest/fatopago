import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
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
                navigate('/dashboard');
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
            <div className="lg:w-[45%] p-8 lg:p-16 flex flex-col justify-between bg-gradient-to-br from-[#9D5CFF] to-[#6922D9] relative overflow-hidden text-white">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-12">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <span className="font-bold text-white">✓</span>
                        </div>
                        <span className="font-bold text-xl tracking-tight">FatoPago</span>
                    </div>

                    <h1 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">
                        Bem-vindo de volta
                    </h1>
                    <p className="text-purple-100 text-lg mb-8 leading-relaxed max-w-md">
                        Acesse seu painel para validar novas notícias e acompanhar seus rendimentos.
                    </p>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-900/20 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
            </div>

            {/* Right Panel - Login Form */}
            <div className="lg:w-[55%] bg-[#0F0529] p-8 lg:p-16 flex flex-col justify-center">
                <div className="max-w-md w-full mx-auto">

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
                                <a href="#" className="text-xs text-[#B084FF] hover:underline">Esqueceu a senha?</a>
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
                            Ainda não tem conta? <Link to="/" className="text-[#B084FF] font-bold hover:underline">Cadastre-se</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
