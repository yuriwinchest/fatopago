import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, CheckCircle, BarChart2, AlertCircle, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';

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

    const { states, cities, loadingCities, fetchCities } = useLocation();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        const type = e.target.type;

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        if (name === 'state') {
            fetchCities(value);
            // We don't rely on formData state for submission anymore, but we keep it for UI feedback if needed
        }

        if (error) setError(null);
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        // 1. Capture data directly from the HTML form (Truth source)
        const form = e.currentTarget;
        const formDataObj = new FormData(form);
        const name = formDataObj.get('name') as string;
        const lastname = formDataObj.get('lastname') as string;
        const email = formDataObj.get('email') as string;
        const password = formDataObj.get('password') as string;
        const state = formDataObj.get('state') as string;
        const city = formDataObj.get('city') as string;
        const affiliateCode = formDataObj.get('affiliateCode') as string;

        // Handle checkbox correctly
        const termsCheckbox = form.querySelector('#terms') as HTMLInputElement;
        const acceptedTerms = termsCheckbox?.checked;

        // 2. Validate
        if (!acceptedTerms) {
            setError("Você precisa aceitar os Termos de Uso.");
            setLoading(false);
            return;
        }

        if (!email || !password || !name || !lastname || !state || !city) {
            setError("Por favor, preencha todos os campos obrigatórios.");
            setLoading(false);
            return;
        }

        try {
            // 3. Create Auth User
            const signUpPromise = supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        name: name,
                        lastname: lastname,
                        city: city,
                        state: state,
                        affiliate_code: affiliateCode || null
                    }
                }
            });

            const { data: authData, error: signUpError } = await Promise.race([
                signUpPromise,
                new Promise<never>((_resolve, reject) =>
                    setTimeout(() => reject(new Error("Tempo excedido ao cadastrar. Tente novamente.")), 20000)
                )
            ]);

            if (signUpError) throw signUpError;

            if (authData.user) {
                // 4. Force Profile Creation (Redundancy)
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert([
                        {
                            id: authData.user.id,
                            name: name,
                            lastname: lastname,
                            city: city,
                            state: state,
                            affiliate_code: affiliateCode || null,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }
                    ], { onConflict: 'id' });

                if (profileError) {
                    console.warn('Profile upsert warning:', profileError);
                    // We don't throw here because the trigger might have worked.
                    // We continue to login/success.
                }
            }

            navigate('/login?registered=true');
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erro ao criar conta. Tente novamente.");
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

                <div className="relative z-10 mt-12 flex items-center gap-4 px-8 lg:px-16 pb-8">
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
                    {/* Logo removed - now in header */}

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
                                    className={inputClasses}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300 ml-1">Sobrenome</label>
                                <input
                                    type="text"
                                    name="lastname"
                                    placeholder="Ex: Silva"
                                    className={inputClasses}
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
                                className={inputClasses}
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
                                    className={`${inputClasses} pr-10`}
                                    onChange={handleChange}
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

                        {/* Location Fields - Integrated with IBGE */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300 ml-1">Estado</label>
                                <select
                                    name="state"
                                    className={inputClasses}
                                    onChange={handleChange}
                                    value={formData.state}
                                >
                                    <option value="" disabled>Selecione</option>
                                    {states.map((uf) => (
                                        <option key={uf.id} value={uf.sigla}>{uf.sigla}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-slate-300 ml-1">Cidade</label>
                                <select
                                    name="city"
                                    className={inputClasses}
                                    onChange={handleChange}
                                    value={formData.city}
                                    disabled={!formData.state || loadingCities}
                                >
                                    <option value="" disabled>
                                        {loadingCities ? "Carregando..." : (!formData.state ? "Selecione Estado" : "Selecione")}
                                    </option>
                                    {cities.map((city) => (
                                        <option key={city.id} value={city.nome}>{city.nome}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-300 ml-1">Código de Indicação (Opcional)</label>
                            <input
                                type="text"
                                name="affiliateCode"
                                placeholder="Código do influenciador"
                                className={inputClasses}
                                onChange={handleChange}
                            />
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
                            Já possui uma conta? <Link to="/" className="text-[#B084FF] font-bold hover:underline">Entrar agora</Link>
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
