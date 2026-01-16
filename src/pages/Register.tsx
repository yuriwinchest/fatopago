import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, CheckCircle, BarChart2, AlertCircle, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const Register = () => {
    const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        lastname: '',
        email: '',
        password: '',
        state: '',
        city: '',
        affiliateCode: '',
        acceptedTerms: false
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        const type = e.target.type;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
        if (error) setError(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.acceptedTerms) {
            setError("Você precisa aceitar os Termos de Uso.");
            return;
        }

        if (!formData.email || !formData.password || !formData.name || !formData.lastname || !formData.state) {
            setError("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        setLoading(true);

        const signUp = async () => {
            try {
                const { data, error: signUpError } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            name: formData.name,
                            lastname: formData.lastname,
                            city: formData.city,
                            state: formData.state,
                            affiliate_code: formData.affiliateCode || null, // Optional
                        }
                    }
                });

                if (signUpError) throw signUpError;

                if (data.user) {
                    // Success
                    // If email confirmation is enabled, we might want to tell them.
                    // For now, let's navigate to login with a query param or just dashboard if auto-sign-in works (it usually doesn't without confirmation in production).
                    navigate('/login?registered=true');
                }
            } catch (err: any) {
                console.error(err);
                setError(err.message || "Erro ao criar conta. Tente novamente.");
            } finally {
                setLoading(false);
            }
        };

        signUp();
    };

    return (
        <div className="min-h-screen flex flex-col lg:flex-row font-sans">
            {/* Left Panel - Vibrant Purple */}
            <div className="lg:w-[45%] p-8 lg:p-16 flex flex-col justify-between bg-gradient-to-br from-[#9D5CFF] to-[#6922D9] relative overflow-hidden text-white">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-12">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <span className="font-bold text-white">✓</span>
                        </div>
                        <span className="font-bold text-xl tracking-tight">FatoPago</span>
                    </div>

                    <h1 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">
                        Junte-se à elite da verificação
                    </h1>
                    <p className="text-purple-100 text-lg mb-12 leading-relaxed max-w-md">
                        Transforme sua percepção em lucro. Valide notícias, suba no ranking e receba recompensas reais por sua acurácia.
                    </p>

                    <div className="space-y-6">
                        <div className="flex gap-4 items-center p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/5">
                            <div className="p-3 bg-white/20 rounded-xl shrink-0">
                                <div className="w-6 h-6 flex items-center justify-center font-bold text-lg">$</div>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Ganhe por Validação</h3>
                                <p className="text-purple-100/90 text-xs mt-0.5">Receba pagamentos via PIX por cada notícia verificada com sucesso.</p>
                            </div>
                        </div>

                        <div className="flex gap-4 items-center p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/5">
                            <div className="p-3 bg-white/20 rounded-xl shrink-0">
                                <BarChart2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg">Ranking Competitivo</h3>
                                <p className="text-purple-100/90 text-xs mt-0.5">Dispute o topo e desbloqueie bônus exclusivos de multiplicador.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 mt-12 flex items-center gap-4">
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

                {/* Decorative */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-900/20 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
            </div>

            {/* Right Panel - Dark Navy Form */}
            <div className="lg:w-[55%] bg-[#0F0529] p-8 lg:p-16 flex flex-col justify-center">
                <div className="max-w-md w-full mx-auto">
                    <h2 className="text-3xl font-bold text-white mb-2">Criar conta</h2>
                    <p className="text-slate-400 mb-8">Comece sua jornada como validador hoje mesmo.</p>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300 ml-1">Nome</label>
                                <input
                                    type="text"
                                    name="name"
                                    placeholder="Ex: João"
                                    className="w-full bg-[#1E1245] border border-[#2D2A55] rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#9D5CFF] focus:border-transparent outline-none transition-all placeholder:text-slate-600 text-white font-medium"
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300 ml-1">Sobrenome</label>
                                <input
                                    type="text"
                                    name="lastname"
                                    placeholder="Ex: Silva"
                                    className="w-full bg-[#1E1245] border border-[#2D2A55] rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#9D5CFF] focus:border-transparent outline-none transition-all placeholder:text-slate-600 text-white font-medium"
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-300 ml-1">E-mail corporativo ou pessoal</label>
                            <input
                                type="email"
                                name="email"
                                placeholder="nome@exemplo.com"
                                className="w-full bg-[#1E1245] border border-[#2D2A55] rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#9D5CFF] focus:border-transparent outline-none transition-all placeholder:text-slate-600 text-white font-medium"
                                onChange={handleChange}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-300 ml-1">Senha de acesso</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    placeholder="Mínimo 8 caracteres"
                                    className="w-full bg-[#1E1245] border border-[#2D2A55] rounded-xl px-4 py-3.5 pr-10 focus:ring-2 focus:ring-[#9D5CFF] focus:border-transparent outline-none transition-all placeholder:text-slate-600 text-white font-medium"
                                    onChange={handleChange}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3.5 text-slate-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {/* Additional Fields for Business Logic */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300 ml-1">Estado</label>
                                <select
                                    name="state"
                                    className="w-full bg-[#1E1245] border border-[#2D2A55] rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#9D5CFF] focus:border-transparent outline-none transition-all text-white font-medium appearance-none"
                                    onChange={handleChange}
                                    defaultValue=""
                                >
                                    <option value="" disabled>Estado</option>
                                    <option value="SP">SP</option>
                                    <option value="RJ">RJ</option>
                                    <option value="MG">MG</option>
                                    {/* Simplified for design match */}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300 ml-1">Cidade</label>
                                <input
                                    type="text"
                                    name="city"
                                    placeholder="Cidade"
                                    className="w-full bg-[#1E1245] border border-[#2D2A55] rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-[#9D5CFF] focus:border-transparent outline-none transition-all placeholder:text-slate-600 text-white font-medium"
                                    onChange={handleChange}
                                />
                            </div>
                        </div>

                        <div className="flex items-start gap-3 py-2">
                            <div className="relative flex items-center">
                                <input
                                    type="checkbox"
                                    name="acceptedTerms"
                                    id="terms"
                                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-600 bg-[#1E1245] checked:border-[#9D5CFF] checked:bg-[#9D5CFF] transition-all"
                                    onChange={handleChange}
                                />
                                <CheckCircle className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 text-white opacity-0 peer-checked:opacity-100" />
                            </div>
                            <label htmlFor="terms" className="text-xs text-slate-400 mt-0.5">
                                Ao se cadastrar, você concorda com nossos <a href="#" className="text-white hover:underline">Termos de Uso</a> e <a href="#" className="text-white hover:underline">Política de Privacidade</a>.
                            </label>
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
                                    Criando conta...
                                </>
                            ) : (
                                <>
                                    Criar Minha Conta
                                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-slate-400">
                            Já possui uma conta? <Link to="/login" className="text-[#B084FF] font-bold hover:underline">Entrar agora</Link>
                        </p>
                    </div>

                    <div className="mt-16 text-center border-t border-white/5 pt-8">
                        <p className="text-[10px] font-bold text-slate-600 tracking-widest uppercase">Plataforma de Verificação Criptografada</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
