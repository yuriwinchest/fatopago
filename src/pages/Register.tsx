import { Link } from 'react-router-dom';
import { ArrowRight, BarChart2 } from 'lucide-react';
import { useRegisterForm } from '../hooks/useRegisterForm';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { AuthLayout } from '../layouts/AuthLayout';

const Register = () => {
    const {
        formData,
        loading,
        error,
        states,
        cities,
        loadingCities,
        handleChange,
        handleSubmit
    } = useRegisterForm();

    const LeftContent = (
        <>
            <div className="relative z-10 px-8 lg:px-16 pt-8">
                <h1 className="text-4xl lg:text-5xl font-extrabold mb-6 leading-tight">
                    Junte-se à elite da verificação
                </h1>
                <p className="text-purple-100 text-lg mb-12 leading-relaxed max-w-md">
                    Transforme sua percepção em lucro. Valide notícias, suba no ranking e receba recompensas reais por sua acurácia.
                </p>

                <div className="space-y-6">
                    <FeatureCard
                        icon={<div className="font-bold text-lg">$</div>}
                        title="Ganhe por Validação"
                        desc="Receba pagamentos via PIX por cada notícia verificada com sucesso."
                    />
                    <FeatureCard
                        icon={<BarChart2 className="w-6 h-6" />}
                        title="Ranking Competitivo"
                        desc="Dispute o topo e desbloqueie bônus exclusivos de multiplicador."
                    />
                </div>
            </div>

            <SocialProof />
        </>
    );

    return (
        <AuthLayout leftPanelContent={LeftContent}>
            <h2 className="text-3xl font-bold text-white mb-2">Criar conta</h2>
            <p className="text-slate-400 mb-8">Comece sua jornada como validador hoje mesmo.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Nome"
                        name="name"
                        placeholder="Ex: João"
                        value={formData.name}
                        onChange={handleChange}
                    />
                    <Input
                        label="Sobrenome"
                        name="lastname"
                        placeholder="Ex: Silva"
                        value={formData.lastname}
                        onChange={handleChange}
                    />
                </div>

                <Input
                    label="E-mail corporativo ou pessoal"
                    type="email"
                    name="email"
                    placeholder="nome@exemplo.com"
                    value={formData.email}
                    onChange={handleChange}
                />

                <Input
                    label="Senha de acesso"
                    type="password"
                    name="password"
                    placeholder="Mínimo 8 caracteres"
                    value={formData.password}
                    onChange={handleChange}
                />

                <div className="grid grid-cols-2 gap-4">
                    <Select
                        label="Estado"
                        name="state"
                        options={states.map(uf => ({ value: uf.sigla, label: uf.sigla }))}
                        value={formData.state}
                        onChange={handleChange}
                    />
                    <Select
                        label="Cidade"
                        name="city"
                        placeholder={loadingCities ? "Carregando..." : "Selecione"}
                        options={cities.map(c => ({ value: c.nome, label: c.nome }))}
                        value={formData.city}
                        onChange={handleChange}
                        disabled={!formData.state || loadingCities}
                    />
                </div>

                <Input
                    label="Código de Indicação (Opcional)"
                    name="affiliateCode"
                    placeholder="Código do influenciador"
                    value={formData.affiliateCode}
                    onChange={handleChange}
                />

                <TermsCheckbox
                    checked={formData.acceptedTerms}
                    onChange={handleChange}
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
                    {loading ? "Criando conta..." : "Criar Minha Conta"}
                </Button>
            </form>

            <div className="mt-8 text-center">
                <p className="text-sm text-slate-400">
                    Já possui uma conta? <Link to="/" className="text-[#B084FF] font-bold hover:underline">Entrar agora</Link>
                </p>
            </div>

            <div className="mt-16 text-center border-t border-white/5 pt-8">
                <p className="text-[10px] font-bold text-slate-600 tracking-widest uppercase">
                    Plataforma de Verificação Criptografada
                </p>
            </div>
        </AuthLayout>
    );
};

// Subcomponents
const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
    <div className="flex gap-4 items-center p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/5 hover:bg-white/15 transition-colors">
        <div className="p-3 bg-white/20 rounded-xl shrink-0">
            <div className="w-6 h-6 flex items-center justify-center font-bold text-lg text-white">
                {icon}
            </div>
        </div>
        <div>
            <h3 className="font-bold text-lg text-white">{title}</h3>
            <p className="text-purple-100/90 text-xs mt-0.5">{desc}</p>
        </div>
    </div>
);

const SocialProof = () => (
    <div className="relative z-10 mt-auto lg:mt-12 flex items-center gap-4 px-8 lg:px-16 pb-8 pt-8">
        <div className="flex -space-x-3">
            {[1, 5, 8].map(img => (
                <img key={img} src={`https://i.pravatar.cc/100?img=${img}`} alt="User" className="w-10 h-10 rounded-full border-2 border-[#8a2ce2]" />
            ))}
        </div>
        <div>
            <span className="block text-sm font-bold text-white">+12k usuários</span>
            <span className="text-xs text-purple-200">validando agora</span>
        </div>
    </div>
);

const TermsCheckbox = ({ checked, onChange }: { checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <div className="flex items-start gap-3 py-2">
        <div className="relative flex items-center">
            <input
                type="checkbox"
                name="acceptedTerms"
                id="terms"
                checked={checked}
                onChange={onChange}
                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-600 bg-[#1E1245] checked:border-[#9D5CFF] checked:bg-[#9D5CFF] transition-all"
            />
            {/* Custom check icon could go here if needed, simplified for now */}
        </div>
        <label htmlFor="terms" className="text-xs text-slate-400 mt-0.5 cursor-pointer select-none">
            Ao se cadastrar, você concorda com nossos <a href="#" className="text-white hover:underline">Termos de Uso</a> e <a href="#" className="text-white hover:underline">Política de Privacidade</a>.
        </label>
    </div>
);

export default Register;
