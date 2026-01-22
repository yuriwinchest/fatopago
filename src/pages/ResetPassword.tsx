import { useState, useEffect } from 'react';
import { ArrowRight, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { NewsCarousel } from '../components/NewsCarousel';
import { MOCK_NEWS } from '../data/mockNews';

const ResetPassword = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        // Check if we have a session (user clicked the recovery link)
        supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
            if (!session) {
                // If no session, maybe the link is invalid or expired
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, _session: any) => {
            if (event === "PASSWORD_RECOVERY") {
                // User is in recovery mode
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!password || !confirmPassword) {
            setError("Preencha todos os campos.");
            return;
        }

        if (password !== confirmPassword) {
            setError("As senhas não coincidem.");
            return;
        }

        if (password.length < 6) {
            setError("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        setLoading(true);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) {
                throw updateError;
            }

            // Password updated successfully
            // Redirect to login or dashboard
            // Usually, after update, we might want to sign them out or just go to dashboard
            // Let's go to dashboard or login with a success message
            navigate('/?registered=true&message=Senha atualizada com sucesso'); // Reusing the 'registered' param for success message style or similar
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erro ao atualizar a senha. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    const inputClasses = "w-full bg-white border border-gray-300 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#9D5CFF] focus:border-transparent outline-none transition-all placeholder:text-gray-400 text-gray-900 font-medium";

    return (
        <div className="min-h-screen flex flex-col lg:flex-row font-sans">
            {/* Left Panel - Vibrant Gradient */}
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
                        Redefinir Senha
                    </h1>
                    <p className="text-purple-100 text-lg mb-8 leading-relaxed max-w-md">
                        Crie uma nova senha segura para proteger sua conta e seus ganhos.
                    </p>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-900/20 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

                <div className="relative z-10 w-full max-w-sm mx-auto lg:mx-0 px-8 lg:px-16 pb-8">
                    <div className="mb-6">
                        <NewsCarousel
                            tasks={MOCK_NEWS}
                            onValidate={() => { }}
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

            {/* Right Panel - Reset Password Form */}
            <div className="lg:w-[55%] bg-[#0F0529] p-8 lg:p-16 flex flex-col justify-center relative">
                <div className="max-w-md w-full mx-auto">
                    <h2 className="text-3xl font-bold text-white mb-2">Nova Senha</h2>
                    <p className="text-slate-400 mb-8">Digite sua nova senha abaixo.</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-300 ml-1">Nova Senha</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Nova senha"
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

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-300 ml-1">Confirmar Nova Senha</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirme a nova senha"
                                    className={`${inputClasses} pr-10`}
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
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    Redefinir Senha
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
