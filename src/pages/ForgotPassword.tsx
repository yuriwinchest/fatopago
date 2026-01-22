import { useState } from 'react';
import { ArrowRight, AlertCircle, Loader2, ArrowLeft, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { NewsCarousel } from '../components/NewsCarousel';
import { MOCK_NEWS } from '../data/mockNews';

const ForgotPassword = () => {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (!email) {
            setError("Por favor, informe seu e-mail.");
            return;
        }

        setLoading(true);

        try {
            // Get the current URL origin to construct the redirect URL
            const redirectUrl = `${window.location.origin}/reset-password`;
            
            const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl,
            });

            if (authError) {
                throw authError;
            }

            setSuccess(true);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erro ao enviar email de recuperação. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#9D5CFF] focus:border-transparent outline-none transition-all placeholder:text-gray-400 text-gray-900 font-medium pl-10";

    return (
        <div className="min-h-screen flex flex-col lg:flex-row font-sans">
            {/* Left Panel - Vibrant Gradient (Same as Login) */}
            <div className="lg:w-[45%] flex flex-col justify-between bg-gradient-to-br from-[#8a2ce2] to-[#6922D9] relative overflow-hidden text-white">

                {/* Header with Logo */}
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
                    {/* Decorative star */}
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
                        Recupere seu acesso
                    </h1>
                    <p className="text-purple-100 text-lg mb-8 leading-relaxed max-w-md">
                        Não se preocupe, vamos ajudar você a voltar a validar notícias e lucrar.
                    </p>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-900/20 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

                <div className="relative z-10 w-full max-w-sm mx-auto lg:mx-0 px-8 lg:px-16 pb-8">
                    <div className="mb-6">
                        <NewsCarousel
                            tasks={MOCK_NEWS}
                            onValidate={() => {}}
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

            {/* Right Panel - Forgot Password Form */}
            <div className="lg:w-[55%] bg-[#0F0529] p-8 lg:p-16 flex flex-col justify-center relative">
                <Link to="/" className="absolute top-8 left-8 text-slate-400 hover:text-white flex items-center gap-2 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Voltar para login
                </Link>

                <div className="max-w-md w-full mx-auto">
                    <h2 className="text-3xl font-bold text-white mb-2">Esqueceu a senha?</h2>
                    <p className="text-slate-400 mb-8">Digite seu e-mail e enviaremos um link para redefinir sua senha.</p>

                    {success ? (
                        <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-xl text-center">
                            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Mail className="w-6 h-6 text-green-400" />
                            </div>
                            <h3 className="text-lg font-bold text-green-400 mb-2">E-mail enviado!</h3>
                            <p className="text-slate-300 mb-6">Verifique sua caixa de entrada (e spam) para encontrar o link de redefinição.</p>
                            <Link to="/" className="text-white bg-green-600 hover:bg-green-700 font-medium py-2 px-4 rounded-lg transition-colors inline-block">
                                Voltar para Login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300 ml-1">E-mail cadastrado</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="nome@exemplo.com"
                                        className={inputClasses}
                                    />
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
                                        Enviando...
                                    </>
                                ) : (
                                    <>
                                        Enviar Link
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
