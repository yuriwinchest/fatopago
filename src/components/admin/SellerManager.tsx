import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ChevronDown,
    ChevronUp,
    Copy,
    Download,
    Eye,
    EyeOff,
    ImagePlus,
    KeyRound,
    Mail,
    Phone,
    RefreshCw,
    Search,
    Trash2,
    X
} from 'lucide-react';
import MonthlySellerLinksGrid from '../seller/MonthlySellerLinksGrid';
import { supabase } from '../../lib/supabase';
import { formatCpf, isValidCpf, normalizeCpf } from '../../lib/cpf';
import { getSellerCommissionAmount } from '../../lib/sellerMetrics';
import {
    buildSellerExportFilename,
    buildSellerExportPayload,
    SellerExportPayload
} from '../../lib/sellerExport';

type SellerListItem = {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    cpf?: string | null;
    seller_code: string;
    affiliate_link: string;
    is_active: boolean;
    signup_count: number;
    paid_customers: number;
    total_revenue: number;
    today_revenue: number;
    week_revenue: number;
    month_revenue: number;
    created_at: string;
    last_signup_at: string | null;
    last_sale_at: string | null;
    avatar_url?: string | null;
};

type SellerFormState = {
    name: string;
    email: string;
    phone: string;
    cpf: string;
    password: string;
    notes: string;
};

interface SellerManagerProps {
    sellers: SellerListItem[];
    sellersLoading: boolean;
    sellersError: string | null;
    loadSellers: () => Promise<void>;
    isSavingSeller: boolean;
    saveSeller: (data: {
        name: string;
        email: string;
        phone: string;
        cpf: string;
        password: string;
        avatar_url: string;
        notes: string;
    }) => Promise<void>;
    deleteSeller: (id: string) => Promise<void>;
    resetSellerPassword: (id: string, password: string) => Promise<void>;
}

const INITIAL_FORM: SellerFormState = {
    name: '',
    email: '',
    phone: '',
    cpf: '',
    password: '',
    notes: ''
};

const formatCurrency = (value: number | string | null | undefined) =>
    Number(value || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });

const formatDateTime = (value?: string | null) => {
    if (!value) return 'Sem registro';

    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(value));
};

const copyText = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        window.prompt('Copie manualmente:', text);
    }
};

const downloadJson = (filename: string, payload: unknown) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
};

const SellerManager: React.FC<SellerManagerProps> = ({
    sellers,
    sellersLoading,
    sellersError,
    loadSellers,
    isSavingSeller,
    saveSeller,
    deleteSeller,
    resetSellerPassword
}) => {
    const [formData, setFormData] = useState<SellerFormState>(INITIAL_FORM);
    const [showPassword, setShowPassword] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedSellerId, setExpandedSellerId] = useState<string | null>(null);
    const [localMessage, setLocalMessage] = useState<string | null>(null);
    const [localError, setLocalError] = useState<string | null>(null);
    const [loadingReportId, setLoadingReportId] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
    const [resetPasswordSellerId, setResetPasswordSellerId] = useState<string | null>(null);
    const [resetPasswordValue, setResetPasswordValue] = useState('');
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [savingResetPassword, setSavingResetPassword] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const filteredSellers = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const normalized = [...(sellers || [])].sort((a, b) => {
            const aTime = new Date(a.created_at || 0).getTime();
            const bTime = new Date(b.created_at || 0).getTime();
            return bTime - aTime;
        });

        if (!query) return normalized;

        return normalized.filter((seller) =>
            [
                seller.name,
                seller.email,
                seller.phone,
                seller.cpf,
                seller.seller_code
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query))
        );
    }, [searchTerm, sellers]);

    const updateField = (field: keyof SellerFormState, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        if (!avatarFile) {
            setAvatarPreviewUrl(null);
            return;
        }

        const objectUrl = URL.createObjectURL(avatarFile);
        setAvatarPreviewUrl(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [avatarFile]);

    const resetForm = () => {
        setFormData(INITIAL_FORM);
        setShowPassword(false);
        setAvatarFile(null);
        setAvatarPreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const uploadAvatarIfNeeded = async () => {
        if (!avatarFile) return '';

        const {
            data: { user },
            error: userError
        } = await supabase.auth.getUser();

        if (userError || !user?.id) {
            throw new Error('Não foi possível validar a sessão do admin para enviar a foto do vendedor.');
        }

        const fileExt = avatarFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `seller-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${fileExt}`;
        const filePath = `${user.id}/sellers/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, avatarFile, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            throw new Error(uploadError.message || 'Não foi possível enviar a foto do vendedor.');
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        return data?.publicUrl || '';
    };

    const handleAvatarFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        if (!file) {
            setAvatarFile(null);
            return;
        }

        if (!file.type.startsWith('image/')) {
            setLocalError('Selecione um arquivo de imagem válido para a foto do vendedor.');
            event.target.value = '';
            return;
        }

        setLocalError(null);
        setAvatarFile(file);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setLocalError(null);
        setLocalMessage(null);

        const payload = {
            name: formData.name.trim(),
            email: formData.email.trim().toLowerCase(),
            phone: formData.phone.trim(),
            cpf: normalizeCpf(formData.cpf).trim(),
            password: formData.password,
            avatar_url: '',
            notes: formData.notes.trim()
        };

        if (payload.name.length < 3) {
            setLocalError('Informe um nome válido para o vendedor.');
            return;
        }

        if (!payload.email.includes('@')) {
            setLocalError('Informe um e-mail válido para o vendedor.');
            return;
        }

        if (payload.password.length < 6) {
            setLocalError('A senha precisa ter no mínimo 6 caracteres.');
            return;
        }

        if (!payload.cpf) {
            setLocalError('CPF do vendedor é obrigatório.');
            return;
        }

        if (!isValidCpf(payload.cpf)) {
            setLocalError('Informe um CPF válido para o vendedor.');
            return;
        }

        try {
            payload.avatar_url = await uploadAvatarIfNeeded();
            await saveSeller(payload);
            resetForm();
            setLocalMessage(`Vendedor ${payload.name} cadastrado com sucesso.`);
        } catch (error: any) {
            setLocalError(error?.message || 'Não foi possível cadastrar o vendedor.');
        }
    };

    const handleDelete = async (seller: SellerListItem) => {
        const confirmed = window.confirm(
            `Excluir o vendedor ${seller.name}? Isso remove o login e o cadastro comercial.`
        );

        if (!confirmed) return;

        setLocalMessage(null);
        setLocalError(null);
        await deleteSeller(seller.id);
        if (expandedSellerId === seller.id) {
            setExpandedSellerId(null);
        }
    };

    const handleResetPassword = async (seller: SellerListItem) => {
        const nextPassword = resetPasswordValue.trim();

        if (nextPassword.length < 6) {
            setLocalError('A nova senha do vendedor precisa ter no mínimo 6 caracteres.');
            return;
        }

        setLocalError(null);
        setLocalMessage(null);
        setSavingResetPassword(true);

        try {
            await resetSellerPassword(seller.id, nextPassword);
            setLocalMessage(`Senha do vendedor ${seller.name} redefinida com sucesso.`);
            setResetPasswordSellerId(null);
            setResetPasswordValue('');
            setShowResetPassword(false);
        } catch (error: any) {
            setLocalError(error?.message || 'Não foi possível redefinir a senha do vendedor.');
        } finally {
            setSavingResetPassword(false);
        }
    };

    const handleExport = async (seller: SellerListItem) => {
        setLocalError(null);
        setLocalMessage(null);
        setLoadingReportId(seller.id);

        try {
            const { data, error } = await supabase.rpc('admin_get_seller_report', {
                p_seller_id: seller.id
            });

            if (error) throw error;

            const payload = buildSellerExportPayload((data || {}) as SellerExportPayload);
            const filename = buildSellerExportFilename(seller.name);
            downloadJson(filename, payload);
            setLocalMessage(`Exportação do vendedor ${seller.name} gerada com sucesso.`);
        } catch (error: any) {
            setLocalError(error?.message || 'Não foi possível exportar os dados do vendedor.');
        } finally {
            setLoadingReportId(null);
        }
    };

    return (
        <div className="grid w-full min-w-0 max-w-full gap-4 overflow-x-hidden lg:gap-6 xl:grid-cols-[minmax(0,390px)_minmax(0,1fr)]">
            <section className="w-full min-w-0 max-w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#16082f] p-3 sm:rounded-[28px] sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-3 sm:mb-6 sm:gap-4">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300/70">
                            Cadastro
                        </p>
                        <h2 className="mt-2 text-2xl font-black text-white">Novo vendedor</h2>
                    </div>
                    <button
                        type="button"
                        onClick={() => void loadSellers()}
                        className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10"
                        title="Atualizar lista"
                    >
                        <RefreshCw className={`h-5 w-5 ${sellersLoading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {(localError || sellersError) && (
                    <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                        {localError || sellersError}
                    </div>
                )}

                {localMessage && (
                    <div className="mb-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                        {localMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="min-w-0 space-y-3 sm:space-y-4">
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(event) => updateField('name', event.target.value)}
                        className="min-h-[52px] w-full rounded-2xl border border-white/10 bg-[#f1f5f9] px-4 text-base text-[#16082f] outline-none transition focus:border-cyan-400/40"
                        placeholder="Nome do vendedor"
                        autoComplete="off"
                    />

                    <input
                        type="email"
                        value={formData.email}
                        onChange={(event) => updateField('email', event.target.value)}
                        className="min-h-[52px] w-full rounded-2xl border border-white/10 bg-[#0f0524] px-4 text-base text-white outline-none transition focus:border-cyan-400/40"
                        placeholder="E-mail"
                        autoComplete="off"
                    />

                    <input
                        type="text"
                        value={formData.phone}
                        onChange={(event) => updateField('phone', event.target.value)}
                        className="min-h-[52px] w-full rounded-2xl border border-white/10 bg-[#f1f5f9] px-4 text-base text-[#16082f] outline-none transition focus:border-cyan-400/40"
                        placeholder="Telefone"
                        autoComplete="off"
                    />

                    <input
                        type="text"
                        value={formData.cpf}
                        onChange={(event) => updateField('cpf', event.target.value)}
                        className="min-h-[52px] w-full rounded-2xl border border-white/10 bg-[#0f0524] px-4 text-base text-white outline-none transition focus:border-cyan-400/40"
                        placeholder="CPF do vendedor"
                        required
                        autoComplete="off"
                    />

                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={(event) => updateField('password', event.target.value)}
                            className="min-h-[52px] w-full rounded-2xl border border-white/10 bg-[#0f0524] px-4 pr-14 text-base text-white outline-none transition focus:border-cyan-400/40"
                            placeholder="Senha"
                            autoComplete="new-password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
                            title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                    </div>

                    <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0f0524] p-4">
                        <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                            <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                                    Foto do vendedor
                                </div>
                                <p className="mt-2 max-w-[320px] text-sm leading-relaxed text-slate-300">
                                    Selecione a foto do computador ou celular.
                                </p>
                            </div>

                            <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row md:w-auto md:justify-end">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarFileChange}
                                    className="hidden"
                                    id="seller-avatar-upload"
                                />
                                <label
                                    htmlFor="seller-avatar-upload"
                                    className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 text-[11px] font-black uppercase tracking-[0.16em] text-cyan-100 sm:w-auto sm:min-w-[176px] sm:whitespace-nowrap"
                                >
                                    <ImagePlus className="h-4 w-4" />
                                    Selecionar foto
                                </label>

                                {avatarFile ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAvatarFile(null);
                                            if (fileInputRef.current) {
                                                fileInputRef.current.value = '';
                                            }
                                        }}
                                        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-[11px] font-black uppercase tracking-[0.16em] text-white sm:w-auto sm:min-w-[144px] sm:whitespace-nowrap"
                                    >
                                        <X className="h-4 w-4" />
                                        Remover
                                    </button>
                                ) : null}
                            </div>
                        </div>

                        {avatarFile ? (
                            <div className="mt-4 flex min-w-0 flex-col gap-4 rounded-2xl border border-white/10 bg-[#14092d] p-3 sm:flex-row sm:items-center">
                                {avatarPreviewUrl ? (
                                    <img
                                        src={avatarPreviewUrl}
                                        alt="Prévia do vendedor"
                                        className="h-20 w-20 rounded-2xl object-cover"
                                    />
                                ) : null}
                                <div className="min-w-0">
                                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                                        Arquivo selecionado
                                    </div>
                                    <p className="mt-2 break-words text-sm font-bold leading-relaxed text-white">
                                        {avatarFile.name}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        {(avatarFile.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-[#14092d] px-4 py-5 text-sm text-slate-400">
                                Nenhuma foto selecionada.
                            </div>
                        )}
                    </div>

                    <textarea
                        value={formData.notes}
                        onChange={(event) => updateField('notes', event.target.value)}
                        className="min-h-[88px] w-full rounded-2xl border border-white/10 bg-[#0f0524] px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
                        placeholder="Observações internas"
                    />

                    <button
                        type="submit"
                        disabled={isSavingSeller}
                        className="inline-flex min-h-[54px] w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-sm font-black uppercase tracking-[0.24em] text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isSavingSeller ? <RefreshCw className="h-5 w-5 animate-spin" /> : null}
                        {isSavingSeller ? 'Salvando...' : 'Cadastrar vendedor'}
                    </button>
                </form>
            </section>

            <section className="w-full min-w-0 max-w-full overflow-hidden rounded-[24px] border border-white/10 bg-[#16082f] p-3 sm:rounded-[28px] sm:p-6">
                <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300/70">
                            Painel comercial
                        </p>
                        <h2 className="mt-2 text-2xl font-black text-white">Vendedores e links</h2>
                    </div>

                    <label className="relative block w-full min-w-0 max-w-none lg:max-w-[420px]">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                            type="search"
                            name="seller-panel-search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="h-14 w-full rounded-2xl border border-white/10 bg-[#0f0524] pl-11 pr-4 text-sm text-white outline-none transition focus:border-cyan-400/40"
                            placeholder="Buscar por nome, e-mail, telefone ou código..."
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="none"
                            spellCheck={false}
                        />
                    </label>
                </div>

                {sellersLoading && (
                    <div className="flex min-h-[220px] items-center justify-center">
                        <div className="flex flex-col items-center gap-3 text-slate-400">
                            <RefreshCw className="h-7 w-7 animate-spin" />
                            <span className="text-[11px] font-black uppercase tracking-[0.24em]">
                                Carregando vendedores
                            </span>
                        </div>
                    </div>
                )}

                {!sellersLoading && filteredSellers.length === 0 && (
                    <div className="flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-[#120726] px-6 text-center text-sm text-slate-400">
                        Nenhum vendedor encontrado.
                    </div>
                )}

                <div className="min-w-0 space-y-4">
                    {!sellersLoading &&
                        filteredSellers.map((seller) => {
                            const isExpanded = expandedSellerId === seller.id;
                            const sellerInitial = seller.name?.trim()?.charAt(0)?.toUpperCase() || 'V';

                            return (
                                <article
                                    key={seller.id}
                                    className="overflow-hidden rounded-[24px] border border-white/10 bg-[#120726]"
                                >
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setExpandedSellerId((current) =>
                                                current === seller.id ? null : seller.id
                                            )
                                        }
                                    className="flex w-full min-w-0 items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-white/[0.03] sm:gap-4 sm:px-5"
                                    >
                                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                                            {seller.avatar_url ? (
                                                <img
                                                    src={seller.avatar_url}
                                                    alt={seller.name}
                                                    className="h-12 w-12 flex-shrink-0 rounded-2xl border border-white/10 object-cover sm:h-14 sm:w-14"
                                                />
                                            ) : (
                                                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-black text-cyan-200 sm:h-14 sm:w-14 sm:text-xl">
                                                    {sellerInitial}
                                                </div>
                                            )}

                                            <div className="min-w-0">
                                                <h3 className="truncate text-xl font-black text-white sm:text-2xl">
                                                    {seller.name}
                                                </h3>
                                                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.28em] text-cyan-300/80">
                                                    {isExpanded ? 'Clique para recolher' : 'Clique para abrir'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
                                            <span
                                                className={`hidden rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] sm:inline-flex ${
                                                    seller.is_active
                                                        ? 'bg-emerald-500/15 text-emerald-200'
                                                        : 'bg-slate-500/20 text-slate-300'
                                                }`}
                                            >
                                                {seller.is_active ? 'Ativo' : 'Inativo'}
                                            </span>
                                            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white sm:h-12 sm:w-12">
                                                {isExpanded ? (
                                                    <ChevronUp className="h-5 w-5" />
                                                ) : (
                                                    <ChevronDown className="h-5 w-5" />
                                                )}
                                            </span>
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="border-t border-white/10 px-4 py-4 sm:px-5 sm:py-5">
                                            <div className="min-w-0 space-y-5">
                                                <div className="grid gap-4 md:grid-cols-4">
                                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2">
                                                        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                            <div className="min-w-0">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                                    Contato
                                                                </p>
                                                                <div className="mt-3 space-y-2 text-sm text-white">
                                                                    <div className="flex items-center gap-2">
                                                                        <Mail className="h-4 w-4 text-cyan-300" />
                                                                        <span className="break-all">{seller.email}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Phone className="h-4 w-4 text-cyan-300" />
                                                                        <span>{seller.phone || 'Sem telefone'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-cyan-300">CPF</span>
                                                                        <span>{seller.cpf ? formatCpf(seller.cpf) : 'Sem CPF'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            {seller.avatar_url ? (
                                                                <img
                                                                    src={seller.avatar_url}
                                                                    alt={seller.name}
                                                                    className="h-16 w-16 rounded-2xl object-cover"
                                                                />
                                                            ) : null}
                                                        </div>
                                                    </div>

                                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                            Semana
                                                        </p>
                                                        <p className="mt-3 text-2xl font-black text-white sm:text-3xl">
                                                            {formatCurrency(seller.week_revenue)}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                            Comissão Semana
                                                        </p>
                                                        <p className="mt-3 text-2xl font-black text-emerald-200 sm:text-3xl">
                                                            {formatCurrency(getSellerCommissionAmount(Number(seller.week_revenue || 0)))}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                            Pagantes
                                                        </p>
                                                        <p className="mt-3 text-2xl font-black text-white sm:text-3xl">
                                                            {seller.paid_customers || 0}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => void copyText(seller.seller_code)}
                                                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-[0.2em] text-white sm:w-auto"
                                                    >
                                                        <Copy className="h-4 w-4" />
                                                        Código
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => void copyText(seller.email)}
                                                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-[0.2em] text-white sm:w-auto"
                                                    >
                                                        <Mail className="h-4 w-4" />
                                                        E-mail
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => void handleExport(seller)}
                                                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 text-xs font-black uppercase tracking-[0.2em] text-cyan-100 sm:w-auto"
                                                        disabled={loadingReportId === seller.id}
                                                    >
                                                        {loadingReportId === seller.id ? (
                                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            <Download className="h-4 w-4" />
                                                        )}
                                                        Exportar dados
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => void handleDelete(seller)}
                                                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 px-4 text-xs font-black uppercase tracking-[0.2em] text-red-100 sm:w-auto"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Excluir vendedor
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setLocalError(null);
                                                            setLocalMessage(null);
                                                            setResetPasswordSellerId((current) =>
                                                                current === seller.id ? null : seller.id
                                                            );
                                                            setResetPasswordValue('');
                                                            setShowResetPassword(false);
                                                        }}
                                                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 text-xs font-black uppercase tracking-[0.2em] text-amber-100 sm:w-auto"
                                                    >
                                                        <KeyRound className="h-4 w-4" />
                                                        Redefinir senha
                                                    </button>
                                                </div>

                                                {resetPasswordSellerId === seller.id ? (
                                                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200/80">
                                                                    Nova senha do vendedor
                                                                </p>
                                                                <div className="relative mt-3">
                                                                    <input
                                                                        type={showResetPassword ? 'text' : 'password'}
                                                                        name={`seller-reset-password-${seller.id}`}
                                                                        value={resetPasswordValue}
                                                                        onChange={(event) => setResetPasswordValue(event.target.value)}
                                                                        className="h-12 w-full rounded-2xl border border-white/10 bg-[#0f0524] px-4 pr-14 text-sm text-white outline-none transition focus:border-amber-400/40"
                                                                        placeholder="Digite a nova senha"
                                                                        autoComplete="new-password"
                                                                        data-lpignore="true"
                                                                        data-1p-ignore="true"
                                                                        data-form-type="other"
                                                                        onClick={(event) => event.stopPropagation()}
                                                                        onFocus={(event) => event.stopPropagation()}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowResetPassword((prev) => !prev)}
                                                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
                                                                        title={showResetPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                                                    >
                                                                        {showResetPassword ? (
                                                                            <EyeOff className="h-5 w-5" />
                                                                        ) : (
                                                                            <Eye className="h-5 w-5" />
                                                                        )}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setResetPasswordSellerId(null);
                                                                        setResetPasswordValue('');
                                                                        setShowResetPassword(false);
                                                                    }}
                                                                    className="inline-flex h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-[0.2em] text-white sm:w-auto"
                                                                >
                                                                    Cancelar
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => void handleResetPassword(seller)}
                                                                    disabled={savingResetPassword}
                                                                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 text-xs font-black uppercase tracking-[0.2em] text-amber-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                                                                >
                                                                    {savingResetPassword ? (
                                                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                                                    ) : (
                                                                        <KeyRound className="h-4 w-4" />
                                                                    )}
                                                                    {savingResetPassword ? 'Salvando...' : 'Salvar nova senha'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : null}

                                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 md:col-span-2">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                            Link base
                                                        </p>
                                                        <p className="mt-3 break-all text-sm font-bold text-white">
                                                            {seller.affiliate_link}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                            Hoje
                                                        </p>
                                                        <p className="mt-3 text-xl font-black text-white">
                                                            {formatCurrency(seller.today_revenue)}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                            Mês
                                                        </p>
                                                        <p className="mt-3 text-xl font-black text-white">
                                                            {formatCurrency(seller.month_revenue)}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                            Comissão Mês
                                                        </p>
                                                        <p className="mt-3 text-xl font-black text-emerald-200">
                                                            {formatCurrency(getSellerCommissionAmount(Number(seller.month_revenue || 0)))}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                            Total
                                                        </p>
                                                        <p className="mt-3 text-xl font-black text-white">
                                                            {formatCurrency(seller.total_revenue)}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                            Comissão Total
                                                        </p>
                                                        <p className="mt-3 text-xl font-black text-emerald-200">
                                                            {formatCurrency(getSellerCommissionAmount(Number(seller.total_revenue || 0)))}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                            Último cadastro
                                                        </p>
                                                        <p className="mt-3 text-sm font-bold text-white">
                                                            {formatDateTime(seller.last_signup_at)}
                                                        </p>
                                                    </div>

                                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">
                                                            Última venda
                                                        </p>
                                                        <p className="mt-3 text-sm font-bold text-white">
                                                            {formatDateTime(seller.last_sale_at)}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="pt-1">
                                                    <div className="mb-4">
                                                        <p className="text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
                                                            Links comerciais do vendedor
                                                        </p>
                                                        <h4 className="mt-2 text-xl font-black text-white">
                                                            9 links comerciais prontos para copiar e compartilhar
                                                        </h4>
                                                    </div>

                                                    <MonthlySellerLinksGrid
                                                        affiliateLink={seller.affiliate_link}
                                                        variant="embedded"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                </div>
            </section>
        </div>
    );
};

export default SellerManager;
