import { useEffect, useMemo, useState } from 'react';
import { Film, Image as ImageIcon, Link2, RefreshCw, RotateCcw, Save, Upload, Video } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
    DEFAULT_PROMO_IMAGE_URL,
    DEFAULT_PROMO_MEDIA_KIND,
    PROMO_MEDIA_BUCKET,
    PROMO_MEDIA_SETTING_KEY,
    fetchPromoMediaSetting,
    inferPromoMediaKindFromMime,
    inferPromoMediaKindFromUrl,
    isExternalPromoMediaUrl,
    isValidExternalPromoMediaUrl,
    resolvePromoMedia,
    resolvePromoMediaUrl,
    type PromoMediaKind,
    type PromoMediaSetting
} from '../../lib/promoMedia';

const MAX_PROMO_VIDEO_SIZE_MB = 100;
const MAX_PROMO_IMAGE_SIZE_MB = 12;

const MEDIA_KIND_LABEL: Record<PromoMediaKind, string> = {
    image: 'Foto',
    video: 'Vídeo'
};

const formatDateTimeBR = (iso?: string | null) => {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getMaxSizeForKind = (kind: PromoMediaKind) =>
    kind === 'video' ? MAX_PROMO_VIDEO_SIZE_MB : MAX_PROMO_IMAGE_SIZE_MB;

const buildStoragePath = (file: File, userId: string) => {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
    return `${userId}/promo-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
};

const PromoMediaManager = () => {
    const [currentSetting, setCurrentSetting] = useState<PromoMediaSetting | null>(null);
    const [mediaKindInput, setMediaKindInput] = useState<PromoMediaKind>(DEFAULT_PROMO_MEDIA_KIND);
    const [mediaUrlInput, setMediaUrlInput] = useState('');
    const [mediaFile, setMediaFile] = useState<File | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [restoring, setRestoring] = useState(false);
    const [objectPreviewUrl, setObjectPreviewUrl] = useState<string | null>(null);

    const loadSetting = async () => {
        try {
            setLoading(true);
            const setting = await fetchPromoMediaSetting();
            const resolved = resolvePromoMedia(setting);
            setCurrentSetting(setting);
            setMediaKindInput(resolved.mediaKind);
            setMediaUrlInput(
                setting && !setting.storage_path && isExternalPromoMediaUrl(setting.source_url)
                    ? setting.source_url
                    : ''
            );
        } catch (error) {
            console.error('Falha ao carregar configuração da mídia promocional:', error);
            setMessage('Não foi possível carregar a mídia promocional atual.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadSetting();
    }, []);

    useEffect(() => {
        if (!mediaFile) {
            setObjectPreviewUrl(null);
            return;
        }

        const nextUrl = URL.createObjectURL(mediaFile);
        setObjectPreviewUrl(nextUrl);

        return () => {
            URL.revokeObjectURL(nextUrl);
        };
    }, [mediaFile]);

    const resolvedCurrentMedia = useMemo(() => resolvePromoMedia(currentSetting), [currentSetting]);

    const previewMediaKind = useMemo(() => {
        if (mediaFile) {
            return inferPromoMediaKindFromMime(mediaFile.type) || mediaKindInput;
        }

        if (mediaUrlInput.trim()) {
            return inferPromoMediaKindFromUrl(mediaUrlInput.trim()) || mediaKindInput;
        }

        return resolvedCurrentMedia.mediaKind;
    }, [mediaFile, mediaKindInput, mediaUrlInput, resolvedCurrentMedia.mediaKind]);

    const previewUrl = useMemo(() => {
        if (objectPreviewUrl) return objectPreviewUrl;
        if (mediaUrlInput.trim() && isValidExternalPromoMediaUrl(mediaUrlInput.trim())) return mediaUrlInput.trim();
        return resolvePromoMediaUrl(resolvedCurrentMedia.mediaKind, currentSetting?.source_url);
    }, [currentSetting?.source_url, mediaUrlInput, objectPreviewUrl, resolvedCurrentMedia.mediaKind]);

    const currentSourceTypeLabel = currentSetting?.storage_path
        ? 'Upload próprio'
        : isExternalPromoMediaUrl(currentSetting?.source_url)
            ? 'URL externa'
            : 'Mídia padrão';

    const removeStorageFile = async (storagePath?: string | null) => {
        if (!storagePath) return;
        const { error } = await supabase.storage.from(PROMO_MEDIA_BUCKET).remove([storagePath]);
        if (error) {
            console.warn('Falha ao remover mídia promocional antiga:', error);
        }
    };

    const uploadMediaFile = async (file: File, userId: string) => {
        const storagePath = buildStoragePath(file, userId);

        const { error: uploadError } = await supabase.storage
            .from(PROMO_MEDIA_BUCKET)
            .upload(storagePath, file, {
                upsert: false,
                contentType: file.type || 'application/octet-stream'
            });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from(PROMO_MEDIA_BUCKET).getPublicUrl(storagePath);
        if (!data?.publicUrl) throw new Error('Não foi possível gerar a URL pública da mídia.');

        return {
            storagePath,
            publicUrl: data.publicUrl
        };
    };

    const persistSetting = async (mediaKind: PromoMediaKind, sourceUrl: string, storagePath: string | null, userId: string) => {
        const { data, error } = await supabase
            .from('site_media_settings')
            .upsert(
                {
                    setting_key: PROMO_MEDIA_SETTING_KEY,
                    media_kind: mediaKind,
                    source_url: sourceUrl,
                    storage_path: storagePath,
                    updated_by: userId
                },
                { onConflict: 'setting_key' }
            )
            .select('setting_key, media_kind, source_url, storage_path, updated_at, updated_by')
            .single();

        if (error) throw error;
        return data as PromoMediaSetting;
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selected = event.target.files?.[0] || null;
        setMessage(null);

        if (!selected) {
            setMediaFile(null);
            return;
        }

        const inferredKind = inferPromoMediaKindFromMime(selected.type);
        if (!inferredKind) {
            setMediaFile(null);
            setMessage('Selecione um arquivo de foto ou vídeo válido.');
            return;
        }

        const maxSizeMb = getMaxSizeForKind(inferredKind);
        if (selected.size > maxSizeMb * 1024 * 1024) {
            setMediaFile(null);
            setMessage(`${MEDIA_KIND_LABEL[inferredKind]} excede ${maxSizeMb} MB.`);
            return;
        }

        setMediaKindInput(inferredKind);
        setMediaFile(selected);
        setMediaUrlInput('');
        event.target.value = '';
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setMessage(null);

            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!userData.user) throw new Error('Sessão inválida. Faça login novamente.');

            let nextMediaKind = mediaKindInput;
            let nextSourceUrl = '';
            let nextStoragePath: string | null = null;

            if (mediaFile) {
                nextMediaKind = inferPromoMediaKindFromMime(mediaFile.type) || mediaKindInput;
                const uploaded = await uploadMediaFile(mediaFile, userData.user.id);
                nextSourceUrl = uploaded.publicUrl;
                nextStoragePath = uploaded.storagePath;
            } else {
                const trimmedUrl = mediaUrlInput.trim();
                if (!trimmedUrl) throw new Error('Informe uma URL válida ou envie uma foto/vídeo do computador.');
                if (!isValidExternalPromoMediaUrl(trimmedUrl)) {
                    throw new Error('Use uma URL direta com http:// ou https:// para a mídia.');
                }
                nextMediaKind = inferPromoMediaKindFromUrl(trimmedUrl) || mediaKindInput;
                nextSourceUrl = trimmedUrl;
                nextStoragePath = null;
            }

            const previousStoragePath = currentSetting?.storage_path || null;
            const nextSetting = await persistSetting(nextMediaKind, nextSourceUrl, nextStoragePath, userData.user.id);

            if (previousStoragePath && previousStoragePath !== nextStoragePath) {
                await removeStorageFile(previousStoragePath);
            }

            setCurrentSetting(nextSetting);
            setMediaKindInput(nextMediaKind);
            setMediaFile(null);
            setMediaUrlInput(nextStoragePath ? '' : nextSourceUrl);
            setMessage('Mídia promocional atualizada para home, login e cadastro.');
        } catch (error: any) {
            console.error('Falha ao salvar mídia promocional:', error);
            setMessage(error?.message || 'Não foi possível atualizar a mídia promocional.');
        } finally {
            setSaving(false);
        }
    };

    const handleRestoreDefault = async () => {
        try {
            setRestoring(true);
            setMessage(null);

            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!userData.user) throw new Error('Sessão inválida. Faça login novamente.');

            const previousStoragePath = currentSetting?.storage_path || null;
            const nextSetting = await persistSetting('image', DEFAULT_PROMO_IMAGE_URL, null, userData.user.id);

            if (previousStoragePath) {
                await removeStorageFile(previousStoragePath);
            }

            setCurrentSetting(nextSetting);
            setMediaKindInput('image');
            setMediaFile(null);
            setMediaUrlInput('');
            setMessage('Mídia padrão da plataforma restaurada.');
        } catch (error: any) {
            console.error('Falha ao restaurar mídia promocional padrão:', error);
            setMessage(error?.message || 'Não foi possível restaurar a mídia padrão.');
        } finally {
            setRestoring(false);
        }
    };

    const uploadHint = mediaKindInput === 'video'
        ? `MP4, WebM, OGG, MOV ou M4V até ${MAX_PROMO_VIDEO_SIZE_MB} MB`
        : `JPG, PNG, WEBP, GIF ou AVIF até ${MAX_PROMO_IMAGE_SIZE_MB} MB`;

    const acceptInput = mediaKindInput === 'video'
        ? 'video/mp4,video/webm,video/ogg,video/quicktime,video/x-m4v,video/*'
        : 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/*';

    const urlPlaceholder = mediaKindInput === 'video'
        ? 'https://cdn.seudominio.com/promo.mp4'
        : 'https://cdn.seudominio.com/promo.jpg';

    return (
        <div className="space-y-6">
            <section className="rounded-2xl border border-white/5 bg-[#1A0B38] p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="text-xl font-extrabold sm:text-2xl">Mídia Promocional Global</h2>
                        <p className="mt-1 text-sm text-slate-400">
                            Configure aqui a foto ou o vídeo principal exibido automaticamente na home, no login e no cadastro.
                        </p>
                    </div>
                    <button
                        onClick={() => void loadSetting()}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Recarregar
                    </button>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
                <section className="rounded-2xl border border-white/5 bg-[#1A0B38] p-4 sm:p-6">
                    <div className="mb-4 flex items-center gap-3">
                        <Film className="h-5 w-5 text-fuchsia-300" />
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Configuração atual</h3>
                            <p className="text-xs text-slate-500">Aplica em Home, Login e Cadastro</p>
                        </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr),300px]">
                        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-fuchsia-100">
                                    {currentSourceTypeLabel}
                                </span>
                                <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-100">
                                    {MEDIA_KIND_LABEL[resolvedCurrentMedia.mediaKind]}
                                </span>
                            </div>

                            <div className="space-y-2 text-sm text-slate-300">
                                <p>
                                    <span className="font-bold text-white">URL ativa:</span>{' '}
                                    <span className="break-all">{resolvePromoMediaUrl(resolvedCurrentMedia.mediaKind, currentSetting?.source_url)}</span>
                                </p>
                                <p>
                                    <span className="font-bold text-white">Última atualização:</span>{' '}
                                    {formatDateTimeBR(currentSetting?.updated_at)}
                                </p>
                                <p>
                                    <span className="font-bold text-white">Origem:</span>{' '}
                                    {currentSetting?.storage_path || 'Arquivo padrão do projeto'}
                                </p>
                            </div>

                            <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
                                Se você trocar a mídia aqui, a home, o login e o cadastro passam a usar a nova foto ou o novo vídeo automaticamente.
                            </div>
                        </div>

                        <div className="rounded-[28px] border border-white/10 bg-[#0F0529] p-3 shadow-[0_22px_48px_rgba(0,0,0,0.28)]">
                            <div className="overflow-hidden rounded-[22px] border border-white/10 bg-black">
                                {previewMediaKind === 'video' ? (
                                    <video
                                        key={previewUrl}
                                        src={previewUrl}
                                        controls
                                        playsInline
                                        preload="metadata"
                                        className="aspect-[9/16] w-full object-cover"
                                    />
                                ) : (
                                    <img
                                        src={previewUrl}
                                        alt="Pré-visualização da mídia promocional"
                                        className="aspect-[9/16] w-full object-cover"
                                        loading="lazy"
                                        decoding="async"
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-white/5 bg-[#1A0B38] p-4 sm:p-6">
                    <div className="mb-4 flex items-center gap-3">
                        {mediaKindInput === 'video' ? (
                            <Video className="h-5 w-5 text-emerald-300" />
                        ) : (
                            <ImageIcon className="h-5 w-5 text-emerald-300" />
                        )}
                        <div>
                            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">Trocar mídia</h3>
                            <p className="text-xs text-slate-500">Você pode usar URL direta ou upload do computador.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Tipo da mídia
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['image', 'video'] as PromoMediaKind[]).map((kind) => (
                                    <button
                                        key={kind}
                                        type="button"
                                        onClick={() => {
                                            setMediaKindInput(kind);
                                            setMessage(null);
                                        }}
                                        className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-black transition ${
                                            mediaKindInput === kind
                                                ? 'border-emerald-400/35 bg-emerald-500/15 text-white'
                                                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                                        }`}
                                    >
                                        {kind === 'video' ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                                        {MEDIA_KIND_LABEL[kind]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                URL externa da mídia
                            </label>
                            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3">
                                <Link2 className="h-4 w-4 text-slate-400" />
                                <input
                                    type="url"
                                    value={mediaUrlInput}
                                    onChange={(event) => {
                                        const nextUrl = event.target.value;
                                        setMediaUrlInput(nextUrl);
                                        if (nextUrl.trim()) {
                                            setMediaFile(null);
                                            const inferredKind = inferPromoMediaKindFromUrl(nextUrl);
                                            if (inferredKind) setMediaKindInput(inferredKind);
                                        }
                                    }}
                                    placeholder={urlPlaceholder}
                                    className="h-12 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                                />
                            </div>
                            <p className="text-xs text-slate-500">
                                Use uma URL direta com http:// ou https://. Ao preencher a URL, o upload do computador é limpo.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Upload do computador
                            </label>
                            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-6 text-center transition hover:border-fuchsia-300/35 hover:bg-white/[0.05]">
                                <Upload className="h-6 w-6 text-fuchsia-200" />
                                <span className="text-sm font-bold text-white">
                                    {mediaFile ? mediaFile.name : `Selecionar ${mediaKindInput === 'video' ? 'vídeo' : 'foto'}`}
                                </span>
                                <span className="text-xs text-slate-400">{uploadHint}</span>
                                <input
                                    type="file"
                                    accept={acceptInput}
                                    className="hidden"
                                    onChange={handleFileChange}
                                />
                            </label>
                            <p className="text-xs text-slate-500">
                                Ao selecionar um arquivo, ele passa a ter prioridade sobre a URL digitada.
                            </p>
                        </div>

                        {message && (
                            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200">
                                {message}
                            </div>
                        )}

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <button
                                onClick={() => void handleSave()}
                                disabled={saving || restoring || (!mediaFile && !mediaUrlInput.trim())}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-[#08141a] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <Save className="h-4 w-4" />
                                {saving ? 'Salvando mídia...' : 'Salvar mídia global'}
                            </button>
                            <button
                                onClick={() => void handleRestoreDefault()}
                                disabled={saving || restoring}
                                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <RotateCcw className={`h-4 w-4 ${restoring ? 'animate-spin' : ''}`} />
                                {restoring ? 'Restaurando...' : 'Restaurar mídia padrão'}
                            </button>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default PromoMediaManager;
