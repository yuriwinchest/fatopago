import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import {
    User,
    MapPin,
    Trophy,
    Activity,
    History,
    Settings,
    Camera,
    CheckCircle,
    XCircle,
    Loader2,
    Copy,
    Eye,
    EyeOff,
    AlertTriangle,
    Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { useProfile } from '../hooks/useProfile';
import { useLocation } from '../hooks/useLocation';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/classNames';

const Profile = () => {
    const normalizePhone = (value: string) => value.replace(/\D/g, '');
    const formatPhone = (value: string) => {
        const digits = normalizePhone(value).slice(0, 11);
        if (digits.length <= 2) return digits;
        if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    };

    const [showCode, setShowCode] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSavingAccount, setIsSavingAccount] = useState(false);
    const [accountError, setAccountError] = useState<string | null>(null);
    const [accountSuccess, setAccountSuccess] = useState<string | null>(null);

    const [editName, setEditName] = useState('');
    const [editLastname, setEditLastname] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editState, setEditState] = useState('');
    const [editCity, setEditCity] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const navigate = useNavigate();
    const { states, cities, loadingCities, fetchCities } = useLocation();

    const {
        profile,
        stats,
        history,
        loading,
        activeTab,
        setActiveTab,
        refetch
    } = useProfile();

    useEffect(() => {
        if (!profile) return;
        setEditName(profile.name || '');
        setEditLastname(profile.lastname || '');
        setEditEmail(profile.email || '');
        setEditPhone(formatPhone(profile.phone || ''));
        setEditState((profile.state || '').toUpperCase());
        setEditCity(profile.city || '');
    }, [profile]);

    useEffect(() => {
        if (!editState) return;
        void fetchCities(editState);
    }, [editState, fetchCities]);

    useEffect(() => {
        return () => {
            if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
        };
    }, [avatarPreviewUrl]);

    const avatarSrc = avatarPreviewUrl || profile?.avatar_url || null;

    const handlePickAvatar = () => {
        setAccountError(null);
        setAccountSuccess(null);
        fileInputRef.current?.click();
    };

    const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setAccountError('Selecione uma imagem válida (PNG/JPG).');
            return;
        }

        const maxBytes = 5 * 1024 * 1024;
        if (file.size > maxBytes) {
            setAccountError('Imagem muito grande. Tamanho máximo: 5MB.');
            return;
        }

        if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
        setAvatarFile(file);
        setAvatarPreviewUrl(URL.createObjectURL(file));
    };

    const handleSaveAccount = async () => {
        try {
            setIsSavingAccount(true);
            setAccountError(null);
            setAccountSuccess(null);

            const nextName = editName.trim();
            const nextLastname = editLastname.trim();
            const nextEmail = editEmail.trim();
            const nextPhone = normalizePhone(editPhone);
            const nextState = editState.trim().toUpperCase();
            const nextCity = editCity.trim();

            if (!nextName) throw new Error('Informe seu nome.');
            if (!nextEmail) throw new Error('Informe seu e-mail.');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) throw new Error('E-mail inválido.');
            if (!nextPhone || ![10, 11].includes(nextPhone.length)) throw new Error('Informe um telefone válido com DDD.');
            if (nextState && !/^[A-Z]{2}$/.test(nextState)) throw new Error('Informe o estado com 2 letras (ex: SP).');
            if (nextState && !nextCity) throw new Error('Selecione sua cidade.');

            const { data: userRes, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            const user = userRes.user;
            if (!user) throw new Error('Usuário não autenticado.');

            // 1) Upload avatar (optional)
            let uploadedAvatarUrl: string | null = null;
            let avatarNotice = '';
            if (avatarFile) {
                const rawExt = avatarFile.name.split('.').pop() || 'jpg';
                const safeExt = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
                const filePath = `${user.id}/avatar.${safeExt}`;

                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, avatarFile, { upsert: true });

                if (uploadError) {
                    console.warn('Falha no upload do avatar:', uploadError);
                    avatarNotice = ' Foto não foi atualizada agora.';
                }

                if (!uploadError) {
                    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
                    if (publicUrlData?.publicUrl) {
                        const sep = publicUrlData.publicUrl.includes('?') ? '&' : '?';
                        uploadedAvatarUrl = `${publicUrlData.publicUrl}${sep}v=${Date.now()}`;
                    } else {
                        avatarNotice = ' Foto não foi atualizada agora.';
                    }
                }
            }

            // 2) Update auth email if changed
            // IMPORTANT: compare against the AUTH email (source of truth), not profile.email (can be stale).
            const currentAuthEmail = (user.email || '').trim();
            let emailNotice = '';
            if (!currentAuthEmail || nextEmail.toLowerCase() !== currentAuthEmail.toLowerCase()) {
                const { error: emailError } = await supabase.auth.updateUser({ email: nextEmail });
                if (emailError) throw emailError;
                emailNotice = ' Enviamos um link para confirmar o novo e-mail.';
            }

            // 3) Update profile row
            const updates: any = {
                name: nextName,
                lastname: nextLastname,
                email: nextEmail,
                phone: nextPhone,
                city: nextCity,
                state: nextState,
                updated_at: new Date().toISOString()
            };
            if (uploadedAvatarUrl) updates.avatar_url = uploadedAvatarUrl;

            // Use upsert so the profile becomes editable even if the row didn't exist yet.
            const { error: updateError } = await supabase
                .from('profiles')
                .upsert({ id: user.id, ...updates }, { onConflict: 'id' });

            if (updateError) throw updateError;

            setAvatarFile(null);
            if (avatarPreviewUrl) {
                URL.revokeObjectURL(avatarPreviewUrl);
                setAvatarPreviewUrl(null);
            }

            await refetch();
            setAccountSuccess(`Perfil atualizado com sucesso.${emailNotice}${avatarNotice}`);
        } catch (error: any) {
            console.error('Erro ao salvar conta:', error);
            setAccountError(error?.message || 'Não foi possível salvar suas alterações.');
        } finally {
            setIsSavingAccount(false);
        }
    };

    const handleDeleteAccount = async () => {
        try {
            setIsDeleting(true);

            const { data, error } = await supabase.functions.invoke('delete-account');
            if (error) throw error;
            if ((data as any)?.error) throw new Error((data as any).error);

            await supabase.auth.signOut();
            navigate('/');
        } catch (error) {
            console.error('Erro ao deletar conta:', error);
            alert('Erro ao deletar conta. Verifique sua conexão ou contate o suporte.');
        } finally {
            setIsDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0F0529] text-white">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <AppLayout
            title="Meu Perfil"
            showLogout={true}
        >
            <div className="space-y-6 pb-2 lg:space-y-8">
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                    <aside className="space-y-4 xl:col-span-4">
                        <Card tone="elevated" className="relative overflow-hidden border-purple-400/20 bg-gradient-to-br from-[#32106B] via-[#1A1040] to-[#120a2a] p-6">
                            <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-purple-400/20 blur-3xl" />
                            <div className="relative z-10">
                                    <div className="mx-auto mb-4 flex w-fit flex-col items-center">
                                    <div
                                        className="group relative cursor-pointer"
                                        onClick={handlePickAvatar}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') handlePickAvatar();
                                        }}
                                        title="Trocar foto"
                                    >
                                        <div className="h-28 w-28 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 p-1">
                                            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#1A1040]">
                                                {avatarSrc ? (
                                                    <img
                                                        src={avatarSrc}
                                                        alt="Foto do perfil"
                                                        className="h-full w-full object-cover"
                                                        onError={() => {
                                                            if (avatarPreviewUrl) {
                                                                URL.revokeObjectURL(avatarPreviewUrl);
                                                                setAvatarPreviewUrl(null);
                                                            }
                                                        }}
                                                    />
                                                ) : profile?.name ? (
                                                    <span className="text-4xl font-bold text-white">{profile.name.charAt(0)}</span>
                                                ) : (
                                                    <User className="h-12 w-12 text-slate-400" />
                                                )}
                                            </div>
                                        </div>
                                        <div className="absolute bottom-0 right-0 rounded-full border-2 border-[#120a2a] bg-white p-2 text-purple-900 shadow-lg">
                                            <Camera className="h-4 w-4" />
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleAvatarChange}
                                        />
                                    </div>
                                </div>

                                <h2 className="text-center text-2xl font-black text-white">
                                    {profile?.name || 'Usuario'} {profile?.lastname || ''}
                                </h2>
                                <p className="mt-1 flex items-center justify-center gap-1 text-sm text-slate-300">
                                    <MapPin className="h-3 w-3" />
                                    {profile?.city || 'Brasil'}, {profile?.state || 'BR'}
                                </p>
                                <p className="mt-1 text-center text-xs text-slate-400">
                                    {formatPhone(profile?.phone || '') || 'Telefone não informado'}
                                </p>
                            </div>
                        </Card>

                        <div className="grid grid-cols-3 gap-3 xl:grid-cols-1">
                            <Card tone="default" className="border-white/10 bg-[#1A1040] p-4 text-center">
                                <Trophy className="mx-auto mb-2 h-5 w-5 text-yellow-400" />
                                <p className="text-xl font-black text-white">{profile?.reputation_score || 0}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">XP Total</p>
                            </Card>

                            <Card tone="default" className="border-white/10 bg-[#1A1040] p-4 text-center">
                                <Activity className="mx-auto mb-2 h-5 w-5 text-green-400" />
                                <p className="text-xl font-black text-white">{stats.total}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Validacoes</p>
                            </Card>

                            <Card tone="default" className="border-white/10 bg-[#1A1040] p-4 text-center">
                                <CheckCircle className="mx-auto mb-2 h-5 w-5 text-blue-400" />
                                <p className="text-xl font-black text-white">{stats.accuracy}%</p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Precisao</p>
                            </Card>
                        </div>
                    </aside>

                    <section className="space-y-4 xl:col-span-8">
                        <Card tone="default" className="border-white/10 bg-[#1A1040] p-2">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setActiveTab('history')}
                                    className={cn(
                                        'flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition-all',
                                        activeTab === 'history'
                                            ? 'bg-[hsl(var(--primary))] text-white shadow-[var(--platform-surface-shadow)]'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    )}
                                >
                                    <History className="h-4 w-4" />
                                    Historico
                                </button>

                                <button
                                    onClick={() => setActiveTab('settings')}
                                    className={cn(
                                        'flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition-all',
                                        activeTab === 'settings'
                                            ? 'bg-[hsl(var(--primary))] text-white shadow-[var(--platform-surface-shadow)]'
                                            : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                    )}
                                >
                                    <Settings className="h-4 w-4" />
                                    Configuracoes
                                </button>
                            </div>
                        </Card>

                        {activeTab === 'history' ? (
                            <Card tone="default" className="border-white/10 bg-[#1A1040] p-5">
                                {history.length > 0 ? (
                                    <div className="space-y-3">
                                        {history.map(item => (
                                            <div key={item.id} className="flex gap-4 rounded-2xl border border-white/10 bg-[#120a2a] p-4">
                                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.verdict ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                                    {item.verdict ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                                                </div>
                                                <div className="overflow-hidden">
                                                    <p className="mb-1 truncate text-sm font-bold text-white">
                                                        {item.news_tasks?.content?.title || 'Noticia indisponivel'}
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${item.verdict ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                                                            {item.verdict ? 'VERDADEIRO' : 'FALSO'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">
                                                            {new Date(item.created_at).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="py-12 text-center text-slate-500">
                                        <History className="mx-auto mb-3 h-12 w-12 opacity-20" />
                                        <p>Nenhuma validacao encontrada.</p>
                                    </div>
                                )}
                            </Card>
                         ) : (
                             <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                                 <Card tone="default" className="border-white/10 bg-[#1A1040] p-5">
                                     <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Conta</h3>
                                    <div className="space-y-4">
                                        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0F0529] p-4 md:flex-row md:items-center md:justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-black/20">
                                                    {avatarSrc ? (
                                                        <img src={avatarSrc} alt="Foto do perfil" className="h-full w-full object-cover" />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center text-slate-500">
                                                            <User className="h-5 w-5" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-white">Foto de perfil</p>
                                                    <p className="text-xs text-slate-500">PNG/JPG, até 5MB</p>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="secondary"
                                                onClick={handlePickAvatar}
                                                leftIcon={<Camera className="h-4 w-4" />}
                                            >
                                                Trocar foto
                                            </Button>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div>
                                                <label htmlFor="profile-firstname" className="mb-1 block text-xs font-bold text-slate-400">Nome</label>
                                                <input
                                                    id="profile-firstname"
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    className="w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-3 text-sm font-medium text-white placeholder:text-slate-600 focus:border-purple-500/50 focus:outline-none"
                                                    placeholder="Seu nome"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="profile-lastname" className="mb-1 block text-xs font-bold text-slate-400">Sobrenome</label>
                                                <input
                                                    id="profile-lastname"
                                                    value={editLastname}
                                                    onChange={(e) => setEditLastname(e.target.value)}
                                                    className="w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-3 text-sm font-medium text-white placeholder:text-slate-600 focus:border-purple-500/50 focus:outline-none"
                                                    placeholder="Seu sobrenome"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div>
                                                <label htmlFor="profile-email" className="mb-1 block text-xs font-bold text-slate-400">E-mail</label>
                                                <input
                                                    id="profile-email"
                                                    value={editEmail}
                                                    onChange={(e) => setEditEmail(e.target.value)}
                                                    className="w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-3 text-sm font-medium text-white placeholder:text-slate-600 focus:border-purple-500/50 focus:outline-none"
                                                    placeholder="seuemail@exemplo.com"
                                                    inputMode="email"
                                                    autoComplete="email"
                                                />
                                                <p className="mt-1 text-[11px] text-slate-500">
                                                    Se você mudar o e-mail, vamos enviar um link de confirmação para o novo endereço.
                                                </p>
                                            </div>
                                            <div>
                                                <label htmlFor="profile-phone" className="mb-1 block text-xs font-bold text-slate-400">Telefone</label>
                                                <input
                                                    id="profile-phone"
                                                    value={editPhone}
                                                    onChange={(e) => setEditPhone(formatPhone(e.target.value))}
                                                    className="w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-3 text-sm font-medium text-white placeholder:text-slate-600 focus:border-purple-500/50 focus:outline-none"
                                                    placeholder="(11) 99999-9999"
                                                    inputMode="tel"
                                                    autoComplete="tel"
                                                />
                                                <p className="mt-1 text-[11px] text-slate-500">
                                                    Esse telefone aparece para o admin quando você vencer um ciclo.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div>
                                                <label htmlFor="profile-state" className="mb-1 block text-xs font-bold text-slate-400">Estado (UF)</label>
                                                <select
                                                    id="profile-state"
                                                    value={editState}
                                                    onChange={(e) => {
                                                        const uf = e.target.value.toUpperCase();
                                                        setEditState(uf);
                                                        setEditCity('');
                                                    }}
                                                    className="w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-3 text-sm font-medium text-white focus:border-purple-500/50 focus:outline-none"
                                                >
                                                    <option value="" className="bg-[#120a2a]">Selecione</option>
                                                    {states.map((state) => (
                                                        <option key={state.id} value={state.sigla} className="bg-[#120a2a]">
                                                            {state.sigla}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor="profile-city" className="mb-1 block text-xs font-bold text-slate-400">Cidade</label>
                                                {cities.length > 0 ? (
                                                    <select
                                                        id="profile-city"
                                                        value={editCity}
                                                        onChange={(e) => setEditCity(e.target.value)}
                                                        disabled={!editState || loadingCities}
                                                        className="w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-3 text-sm font-medium text-white focus:border-purple-500/50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        <option value="" disabled>
                                                            {!editState ? 'Selecione o estado' : (loadingCities ? 'Carregando cidades...' : 'Selecione sua cidade')}
                                                        </option>
                                                        {cities.map((city) => (
                                                            <option key={city.id} value={city.nome} className="bg-[#120a2a]">
                                                                {city.nome}
                                                            </option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        id="profile-city"
                                                        value={editCity}
                                                        onChange={(e) => setEditCity(e.target.value)}
                                                        disabled={!editState}
                                                        autoComplete="off"
                                                        placeholder={!editState ? 'Selecione o estado' : (loadingCities ? 'Carregando cidades...' : 'Digite sua cidade')}
                                                        className="w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-3 text-sm font-medium text-white focus:border-purple-500/50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                                    />
                                                )}
                                                {!!editState && !loadingCities && cities.length === 0 && (
                                                    <p className="mt-1 text-[11px] text-amber-300/90">
                                                        Nao foi possivel carregar a lista agora. Digite sua cidade manualmente.
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {accountError && (
                                            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-200">
                                                {accountError}
                                            </div>
                                        )}

                                        {accountSuccess && (
                                            <div className="flex items-start gap-2 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-200">
                                                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                                                <span>{accountSuccess}</span>
                                            </div>
                                        )}

                                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <p className="text-xs text-slate-500">
                                                Dica: troque a foto clicando no avatar à esquerda.
                                            </p>
                                            <Button
                                                type="button"
                                                onClick={handleSaveAccount}
                                                isLoading={isSavingAccount}
                                                className="w-full md:w-auto"
                                            >
                                                Salvar Alterações
                                            </Button>
                                        </div>
                                    </div>
                                </Card>

                                <Card tone="default" className={cn(
                                    'border p-5 transition-all',
                                    profile?.referral_active
                                        ? 'border-purple-500/30 bg-gradient-to-br from-purple-900/40 to-indigo-900/40'
                                        : 'border-white/10 bg-[#1A1040]'
                                )}>
                                    <div className="mb-4 flex items-center justify-between">
                                        <h3 className={cn(
                                            'text-sm font-bold uppercase tracking-wider',
                                            profile?.referral_active ? 'text-purple-200' : 'text-slate-400'
                                        )}>
                                            Indicacao e ganhos
                                        </h3>

                                        {profile?.referral_active ? (
                                            <div className="rounded border border-green-500/30 bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400">
                                                ATIVO
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 rounded bg-slate-700/50 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                                                <XCircle className="h-3 w-3" /> BLOQUEADO
                                            </div>
                                        )}
                                    </div>

                                    {profile?.referral_active ? (
                                        <div className="space-y-4">
                                            <div className="rounded-xl border border-purple-500/20 bg-[#0F0529] p-3">
                                                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Seu codigo de indicacao</p>
                                                <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/40 p-3">
                                                    <div className="flex min-w-0 flex-1 items-center gap-3">
                                                        <code className="truncate font-mono text-xl font-bold tracking-[0.2em] text-white">
                                                            {showCode ? (profile?.referral_code || '---') : '••••••••'}
                                                        </code>
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowCode(!showCode)}
                                                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/10"
                                                            title={showCode ? 'Ocultar' : 'Mostrar'}
                                                        >
                                                            {showCode ? <EyeOff size={16} /> : <Eye size={16} />}
                                                        </button>
                                                    </div>

                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        className="min-h-0 whitespace-nowrap px-3 py-2 text-[10px]"
                                                        onClick={() => {
                                                            if (profile?.referral_code) {
                                                                navigator.clipboard.writeText(profile.referral_code);
                                                                setCopied(true);
                                                                setTimeout(() => setCopied(false), 1500);
                                                            }
                                                        }}
                                                        leftIcon={<Copy className="h-3 w-3" />}
                                                    >
                                                        {copied ? 'COPIADO' : 'COPIAR'}
                                                    </Button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-slate-300">
                                                Compartilhe este codigo e ganhe comissoes por cada novo validador ativo.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="py-2 text-center">
                                            <p className="mb-2 text-sm font-medium text-slate-300">
                                                Desbloqueie seu codigo de indicacao
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Adquira um plano para indicar amigos e ganhar comissoes em dinheiro.
                                            </p>
                                        </div>
                                    )}
                                </Card>

                                <Card tone="default" className="border-white/10 bg-[#1A1040] p-5">
                                    <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Seguranca</h3>
                                    <button className="group flex w-full items-center justify-between rounded-xl border border-white/10 bg-[#0F0529] p-3 text-left transition-colors hover:border-purple-500/50">
                                        <div>
                                            <p className="text-sm font-bold text-white">Alterar Senha</p>
                                            <p className="text-xs text-slate-500 transition-colors group-hover:text-purple-300">Atualize sua senha de acesso</p>
                                        </div>
                                        <Settings className="h-4 w-4 text-slate-600 group-hover:text-purple-400" />
                                    </button>
                                </Card>

                                <Card tone="default" className="border-red-500/20 bg-[#1A1040] p-5">
                                    <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-red-400">Zona de Perigo</h3>
                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="group flex w-full items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-left transition-colors hover:bg-red-500/10"
                                    >
                                        <div>
                                            <p className="text-sm font-bold text-red-400">Deletar Conta</p>
                                            <p className="text-xs text-red-300/60">Excluir permanentemente sua conta e todos os dados</p>
                                        </div>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                    </button>
                                </Card>
                            </div>
                        )}
                    </section>
                </div>

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-[#1A1040] p-6 shadow-2xl">
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500 mx-auto">
                                <AlertTriangle className="h-6 w-6" />
                            </div>

                            <h3 className="mb-2 text-center text-xl font-bold text-white">Deletar Conta?</h3>
                            <p className="mb-6 text-center text-sm text-slate-300">
                                A conta será encerrada. Se existir histórico financeiro, os dados pessoais serão anonimizados e o livro-razão será preservado para auditoria.
                            </p>

                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="secondary"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={isDeleting}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    className="bg-red-600 text-white hover:bg-red-700 hover:shadow-red-900/20"
                                    onClick={handleDeleteAccount}
                                    isLoading={isDeleting}
                                >
                                    Sim, Deletar
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

export default Profile;
