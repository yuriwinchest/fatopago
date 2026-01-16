import { useState } from 'react';
import { Mail, Lock, User, ArrowRight, BarChart2, Wallet } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Register = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        lastname: '',
        email: '',
        password: '',
        acceptedTerms: false
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Registering:', formData);
        // Mock successful registration
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen bg-brand-dark flex flex-col lg:flex-row text-white font-sans">
            {/* Left Panel */}
            <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-center bg-gradient-to-br from-[#8a2ce2] to-[#4B0082] relative overflow-hidden">
                <div className="relative z-10 max-w-lg">
                    <div className="flex items-center gap-2 mb-8">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                            <span className="font-bold text-white">✓</span>
                        </div>
                        <span className="font-bold text-xl tracking-tight">FatoPago</span>
                    </div>

                    <h1 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">
                        Junte-se à elite da verificação
                    </h1>
                    <p className="text-purple-100 text-lg mb-10 leading-relaxed">
                        Transforme sua percepção em lucro. Valide notícias, suba no ranking e receba recompensas reais por sua acurácia.
                    </p>

                    <div className="space-y-6">
                        <div className="flex gap-4 items-start">
                            <div className="p-3 bg-white/10 rounded-lg shrink-0">
                                <Wallet className="w-6 h-6 text-purple-200" />
                            </div>
                            <div>
                                <h3 className="font-bold text-xl mb-1">Ganhe por Validação</h3>
                                <p className="text-purple-100/80 text-sm">Receba pagamentos via PIX por cada notícia verificada com sucesso.</p>
                            </div>
                        </div>

                        <div className="flex gap-4 items-start">
                            <div className="p-3 bg-white/10 rounded-lg shrink-0">
                                <BarChart2 className="w-6 h-6 text-purple-200" />
                            </div>
                            <div>
                                <h3 className="font-bold text-xl mb-1">Ranking Competitivo</h3>
                                <p className="text-purple-100/80 text-sm">Dispute o topo e desbloqueie bônus exclusivos de multiplicador.</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-12 flex items-center gap-3">
                        <div className="flex -space-x-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="w-10 h-10 rounded-full border-2 border-primary bg-slate-800" />
                            ))}
                        </div>
                        <span className="text-sm font-medium text-purple-100">+12k usuários validando agora</span>
                    </div>
                </div>

                {/* Background decorative elements */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 bg-black/10 rounded-full blur-3xl" />
            </div>

            {/* Right Panel - Form */}
            <div className="lg:w-1/2 p-8 lg:p-16 flex flex-col justify-center bg-brand-dark">
                <div className="max-w-md w-full mx-auto">
                    <h2 className="text-3xl font-bold mb-2">Criar conta</h2>
                    <p className="text-slate-400 mb-8">Comece sua jornada como validador hoje mesmo.</p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-300">Nome</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="name"
                                        placeholder="Ex: João"
                                        className="w-full bg-[#1A1040] border border-[#2D2A55] rounded-lg px-4 py-3 pl-10 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-600 font-bold"
                                        onChange={handleChange}
                                    />
                                    <User className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-300">Sobrenome</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="lastname"
                                        placeholder="Ex: Silva"
                                        className="w-full bg-[#1A1040] border border-[#2D2A55] rounded-lg px-4 py-3 pl-10 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-600 font-bold"
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-300">E-mail corporativo ou pessoal</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="nome@exemplo.com"
                                    className="w-full bg-[#1A1040] border border-[#2D2A55] rounded-lg px-4 py-3 pl-10 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-600 font-bold"
                                    onChange={handleChange}
                                />
                                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-300">Senha de acesso</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    name="password"
                                    placeholder="Mínimo 8 caracteres"
                                    className="w-full bg-[#1A1040] border border-[#2D2A55] rounded-lg px-4 py-3 pl-10 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-600 font-bold"
                                    onChange={handleChange}
                                />
                                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-300">Estado</label>
                                <div className="relative">
                                    <select
                                        name="state"
                                        className="w-full bg-[#1A1040] border border-[#2D2A55] rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-white font-bold appearance-none"
                                        onChange={handleChange}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Selecione</option>
                                        <option value="AC">AC</option>
                                        <option value="AL">AL</option>
                                        <option value="AP">AP</option>
                                        <option value="AM">AM</option>
                                        <option value="BA">BA</option>
                                        <option value="CE">CE</option>
                                        <option value="DF">DF</option>
                                        <option value="ES">ES</option>
                                        <option value="GO">GO</option>
                                        <option value="MA">MA</option>
                                        <option value="MT">MT</option>
                                        <option value="MS">MS</option>
                                        <option value="MG">MG</option>
                                        <option value="PA">PA</option>
                                        <option value="PB">PB</option>
                                        <option value="PR">PR</option>
                                        <option value="PE">PE</option>
                                        <option value="PI">PI</option>
                                        <option value="RJ">RJ</option>
                                        <option value="RN">RN</option>
                                        <option value="RS">RS</option>
                                        <option value="RO">RO</option>
                                        <option value="RR">RR</option>
                                        <option value="SC">SC</option>
                                        <option value="SP">SP</option>
                                        <option value="SE">SE</option>
                                        <option value="TO">TO</option>
                                    </select>
                                    <MapPin className="absolute right-3 top-3.5 w-5 h-5 text-slate-500 pointer-events-none" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-slate-300">Cidade</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        name="city"
                                        placeholder="Minha Cidade"
                                        className="w-full bg-[#1A1040] border border-[#2D2A55] rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-600 font-bold"
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-300">Código de Afiliado (Exclusivo)</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="affiliateCode"
                                    placeholder="Código do convite (Opcional)"
                                    className="w-full bg-[#1A1040] border border-[#2D2A55] rounded-lg px-4 py-3 pl-10 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-600 font-bold"
                                    onChange={handleChange}
                                />
                                <Users className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                name="acceptedTerms"
                                id="terms"
                                className="mt-1 rounded bg-[#1A1040] border-[#2D2A55] text-primary focus:ring-primary"
                                onChange={handleChange}
                            />
                            <label htmlFor="terms" className="text-xs text-slate-400">
                                Ao se cadastrar, você concorda com nossos <a href="#" className="text-primary hover:underline">Termos de Uso</a> e <a href="#" className="text-primary hover:underline">Política de Privacidade</a>.
                            </label>
                        </div>

                        <button type="submit" className="w-full bg-primary hover:bg-purple-600 text-white font-bold py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 group shadow-lg shadow-primary/25">
                            Criar Minha Conta
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>

                    <p className="text-center mt-8 text-sm text-slate-400">
                        Já possui uma conta? <Link to="/login" className="text-primary font-bold hover:underline">Entrar agora</Link>
                    </p>

                    <div className="mt-16 text-center">
                        <p className="text-[10px] font-bold text-slate-600 tracking-widest uppercase">Plataforma de Verificação Criptografada</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
