import { useState } from 'react';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Login = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Logging in:', formData);
        // Mock successful login
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen bg-brand-dark flex flex-col justify-center items-center text-white font-sans p-6">
            <div className="w-full max-w-md">
                <div className="flex items-center justify-center gap-2 mb-8">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="font-bold text-primary text-xl">✓</span>
                    </div>
                    <span className="font-bold text-2xl tracking-tight">FatoPago</span>
                </div>

                <div className="bg-[#1A1040] p-8 rounded-3xl border border-white/5 shadow-2xl">
                    <h2 className="text-3xl font-bold mb-2 text-center">Boas-vindas</h2>
                    <p className="text-slate-400 mb-8 text-center">Entre na sua conta para validar.</p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-300">E-mail</label>
                            <div className="relative">
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="seu@email.com"
                                    className="w-full bg-[#0F0826] border border-[#2D2A55] rounded-lg px-4 py-3 pl-10 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-600 font-bold"
                                    onChange={handleChange}
                                />
                                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-sm font-semibold text-slate-300">Senha</label>
                                <a href="#" className="text-xs text-primary font-bold hover:underline">Esqueceu?</a>
                            </div>
                            <div className="relative">
                                <input
                                    type="password"
                                    name="password"
                                    placeholder="••••••••"
                                    className="w-full bg-[#0F0826] border border-[#2D2A55] rounded-lg px-4 py-3 pl-10 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-600 font-bold"
                                    onChange={handleChange}
                                />
                                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                            </div>
                        </div>

                        <button type="submit" className="w-full bg-primary hover:bg-purple-600 text-white font-bold py-3.5 rounded-lg transition-all flex items-center justify-center gap-2 group shadow-lg shadow-primary/25">
                            Entrar na Plataforma
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>

                    <p className="text-center mt-8 text-sm text-slate-400">
                        Não tem uma conta? <Link to="/" className="text-primary font-bold hover:underline">Cadastre-se</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
