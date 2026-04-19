import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, UserCheck, Upload } from 'lucide-react';
import { useRegisterForm } from '../hooks/useRegisterForm';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { AuthLayout } from '../layouts/AuthLayout';
import { AuthSocialProof } from '../components/auth/AuthSocialProof';
import PromoMediaAsset from '../components/PromoMediaAsset';
import { usePromoMedia } from '../hooks/usePromoMedia';

const Register = () => {
    const [showSocialProof, setShowSocialProof] = useState(false);
    const { mediaKind, mediaUrl } = usePromoMedia();
    const {
        formData,
        loading,
        error,
        states,
        cities,
        loadingCities,
        hasReferral,
        sellerLinkNotice,
        handleChange,
        handleFileChange, // Added handleFileChange
        handleSubmit
    } = useRegisterForm();

    useEffect(() => {
        let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
        let idleId: number | null = null;

        const enableSocialProof = () => setShowSocialProof(true);

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            idleId = (window as Window & {
                requestIdleCallback: (cb: () => void, options?: { timeout: number }) => number;
            }).requestIdleCallback(enableSocialProof, { timeout: 1000 });
        } else {
            timeoutId = globalThis.setTimeout(enableSocialProof, 450);
        }

        return () => {
            if (idleId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
                (window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(idleId);
            }
            if (timeoutId !== null) {
                globalThis.clearTimeout(timeoutId);
            }
        };
    }, []);

    const LeftContent = (
        <>
            <div className="relative z-10 flex flex-col items-center px-5 pt-7 text-center sm:px-8 lg:px-16">
                <div className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-purple-100 shadow-[0_12px_24px_rgba(34,10,88,0.18)]">
                    Sua primeira plataforma de validação de notícias
                </div>

                <h1 className="mt-6 max-w-none text-balance text-[clamp(1.38rem,4.3vw,2.35rem)] font-extrabold leading-[0.97] tracking-[-0.035em] text-white">
                    <span className="block sm:whitespace-nowrap">SEJA O PRIMEIRO</span>
                    <span className="block sm:whitespace-nowrap">DO RANKING E RECEBA</span>
                </h1>

                <div className="relative mt-7 inline-flex">
                    <div className="pointer-events-none absolute -inset-3 rounded-[38px] bg-[radial-gradient(circle,rgba(251,191,36,0.42),rgba(249,115,22,0.18),rgba(249,115,22,0))] blur-2xl opacity-95" />
                    <div className="relative overflow-hidden rounded-[30px] border border-amber-100/35 bg-[linear-gradient(135deg,rgba(255,240,179,0.30),rgba(249,115,22,0.18),rgba(255,255,255,0.08))] px-4 sm:px-5 py-5 shadow-[0_24px_58px_rgba(120,34,0,0.34)] backdrop-blur-md">
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
                        <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-amber-50/85">
                            Prêmio em destaque
                        </span>
                        <span className="mt-2 flex items-end justify-center gap-2 bg-[linear-gradient(135deg,#fff8d1_0%,#ffffff_42%,#ffd166_100%)] bg-clip-text text-transparent drop-shadow-[0_8px_22px_rgba(255,209,102,0.35)]">
                            <span className="text-[clamp(1.7rem,5.4vw,2.5rem)] font-black leading-none tracking-[-0.04em]">
                                R$
                            </span>
                            <span className="text-[clamp(2.7rem,9.8vw,4.6rem)] font-black leading-none tracking-[-0.06em]">
                                6.000,00
                            </span>
                        </span>
                    </div>
                </div>

                <div className="mt-8 flex w-full justify-center">
                    <div className="relative w-full max-w-[272px] sm:max-w-[340px]">
                        <div className="pointer-events-none absolute inset-x-6 -top-3 h-12 rounded-full bg-white/12 blur-2xl" />
                        <div className="pointer-events-none absolute -inset-6 rounded-[42px] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.18),rgba(255,255,255,0)_58%),radial-gradient(circle_at_bottom,rgba(251,191,36,0.22),rgba(251,191,36,0)_60%)] blur-3xl opacity-80" />
                        <div className="relative overflow-hidden rounded-[34px] border border-white/18 bg-black/10 shadow-[0_28px_70px_rgba(14,4,40,0.42)]">
                            <PromoMediaAsset
                                mediaKind={mediaKind}
                                src={mediaUrl}
                                alt="Mídia principal da plataforma FatoPago"
                                className="block aspect-[9/16] w-full object-cover"
                            />
                        </div>
                    </div>
                </div>
            </div>
            {showSocialProof ? (
                <AuthSocialProof className="relative z-10 mt-auto px-5 pb-8 pt-8 sm:px-8 lg:mt-12 lg:px-16" />
            ) : (
                <div className="relative z-10 mt-auto px-5 pb-8 pt-8 sm:px-8 lg:mt-12 lg:px-16">
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-4 shadow-[0_16px_40px_rgba(18,6,60,0.28)] backdrop-blur-sm sm:p-5">
                        <div className="grid gap-4">
                            <div className="h-5 w-44 rounded-full bg-white/10" />
                            <div className="h-3.5 w-full rounded-full bg-white/5" />
                            <div className="h-3.5 w-4/5 rounded-full bg-white/5" />
                            <div className="h-10 rounded-full bg-white/10" />
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    return (
        <AuthLayout leftPanelContent={LeftContent}>
            <h2 className="text-3xl font-bold text-white mb-2">Criar conta</h2>
            <p className="text-slate-400 mb-8">Comece sua jornada como validador hoje mesmo.</p>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" autoComplete="off">

                {/* Avatar Upload */}
                <div className="mb-6 rounded-[28px] border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                    <div className="flex flex-col items-center justify-center">
                    <label className="cursor-pointer group relative flex flex-col items-center justify-center w-24 h-24 rounded-full border-2 border-dashed border-slate-500 hover:border-purple-500 bg-white/5 hover:bg-white/10 transition-all">
                        {formData.avatar ? (
                            <img
                                src={URL.createObjectURL(formData.avatar)}
                                alt="Avatar Preview"
                                className="w-full h-full rounded-full object-cover"
                            />
                        ) : (
                            <div className="flex flex-col items-center">
                                <Upload className="w-6 h-6 text-slate-400 group-hover:text-purple-400 mb-1" />
                                <span className="text-[10px] text-slate-500 group-hover:text-purple-300">Foto</span>
                            </div>
                        )}
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        {formData.avatar && (
                            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload className="w-6 h-6 text-white" />
                            </div>
                        )}
                    </label>
                        <span className="mt-3 text-center text-xs text-slate-400">
                            Adicione sua foto de perfil pelo celular ou computador
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        label="Nome"
                        name="name"
                        placeholder="Ex: João"
                        value={formData.name}
                        onChange={handleChange}
                        required
                    />
                    <Input
                        label="Sobrenome"
                        name="lastname"
                        placeholder="Ex: Silva"
                        value={formData.lastname}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        label="CPF"
                        name="cpf"
                        placeholder="000.000.000-00"
                        value={formData.cpf}
                        onChange={handleChange}
                        mask="999.999.999-99"
                        required
                    />
                    <Input
                        label="Data de Nascimento"
                        type="text"
                        name="birthDate"
                        placeholder="DD/MM/AAAA"
                        value={formData.birthDate}
                        onChange={handleChange}
                        mask="99/99/9999"
                        maskChar={null}
                        inputMode="numeric"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                        label="E-mail corporativo ou pessoal"
                        type="email"
                        name="email"
                        placeholder="nome@exemplo.com"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                    <Input
                        label="Telefone com DDD"
                        type="text"
                        name="phone"
                        placeholder="(11) 99999-9999"
                        value={formData.phone}
                        onChange={handleChange}
                        mask="(99) 99999-9999"
                        maskChar={null}
                        inputMode="tel"
                        required
                    />
                </div>

                <Input
                    label="Senha de acesso"
                    type="password"
                    name="password"
                    placeholder="Mínimo 8 caracteres"
                    value={formData.password}
                    onChange={handleChange}
                    minLength={8}
                    required
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Select
                        label="Estado"
                        name="state"
                        options={states.map(uf => ({ value: uf.sigla, label: uf.sigla }))}
                        value={formData.state}
                        onChange={handleChange}
                        required
                    />
                    {cities.length > 0 ? (
                        <Select
                            label="Cidade"
                            name="city"
                            options={cities.map((city) => ({ value: city.nome, label: city.nome }))}
                            value={formData.city}
                            onChange={handleChange}
                            disabled={!formData.state || loadingCities}
                            placeholder={
                                !formData.state
                                    ? "Selecione o estado"
                                    : loadingCities
                                        ? "Carregando cidades..."
                                        : "Selecione sua cidade"
                            }
                            required
                        />
                    ) : (
                        <Input
                            label="Cidade"
                            name="city"
                            placeholder={
                                !formData.state
                                    ? "Selecione o estado"
                                    : loadingCities
                                        ? "Carregando cidades..."
                                        : "Digite sua cidade"
                            }
                            value={formData.city}
                            onChange={handleChange}
                            disabled={!formData.state || loadingCities}
                            autoComplete="off"
                            required
                        />
                    )}
                </div>

                {!!formData.state && !loadingCities && cities.length === 0 && (
                    <p className="ml-1 text-xs text-amber-300/90">
                        Não foi possível carregar a lista agora. Digite sua cidade manualmente.
                    </p>
                )}

                {hasReferral && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2">
                        <UserCheck className="h-4 w-4 text-green-400" />
                        <span className="text-xs font-bold text-green-400">Você foi indicado. Código aplicado automaticamente pelo link.</span>
                    </div>
                )}

                {sellerLinkNotice && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                        <UserCheck className="h-4 w-4 text-amber-300" />
                        <span className="text-xs font-bold text-amber-100">{sellerLinkNotice}</span>
                    </div>
                )}

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
                    Já possui uma conta? <Link to="/" className="font-bold text-[hsl(var(--primary))] hover:underline">Entrar agora</Link>
                </p>
            </div>

            <div className="mt-12 border-t border-white/5 pt-6 text-center sm:mt-16 sm:pt-8">
                <p className="text-[10px] font-bold text-slate-600 tracking-widest uppercase">
                    Plataforma de Verificação Criptografada
                </p>
            </div>
        </AuthLayout>
    );
};

const TermsCheckbox = ({ checked, onChange }: { checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) => (
    <div className="flex min-h-[44px] items-start gap-3 py-2">
        <div className="relative flex items-center">
            <input
                type="checkbox"
                name="acceptedTerms"
                id="terms"
                checked={checked}
                onChange={onChange}
                className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-500 bg-[#1E1245] checked:border-[hsl(var(--primary))] checked:bg-[hsl(var(--primary))] transition-all"
            />
            {/* Custom check icon could go here if needed, simplified for now */}
        </div>
        <label htmlFor="terms" className="text-xs text-slate-400 mt-0.5 cursor-pointer select-none">
            Ao se cadastrar, você concorda com nossos <Link to="/termos" className="text-white hover:underline">Termos de Uso</Link> e <Link to="/privacidade" className="text-white hover:underline">Política de Privacidade</Link>.
        </label>
    </div>
);

export default Register;
