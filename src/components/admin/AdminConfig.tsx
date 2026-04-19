import React, { useState, useEffect } from 'react';
import { Home, Image as ImageIcon, Save, RotateCw, X, Plus, ExternalLink } from 'lucide-react';

interface AdminConfigProps {
    homeConfig: any;
    isSavingHomeConfig: boolean;
    updateHomeConfig: (data: any) => Promise<void>;
}

const AdminConfig: React.FC<AdminConfigProps> = ({
    homeConfig,
    isSavingHomeConfig,
    updateHomeConfig
}) => {
    const [banners, setBanners] = useState<any[]>([]);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (homeConfig?.banners) {
            setBanners(homeConfig.banners);
        } else {
            setBanners([]);
        }
    }, [homeConfig]);

    const handleAddBanner = () => {
        setBanners([...banners, { image_url: '', link_url: '', active: true, priority: banners.length }]);
    };

    const handleRemoveBanner = (index: number) => {
        setBanners(banners.filter((_, i) => i !== index));
    };

    const handleUpdateBanner = (index: number, field: string, value: any) => {
        const newBanners = [...banners];
        newBanners[index] = { ...newBanners[index], [field]: value };
        setBanners(newBanners);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage(null);

        try {
            await updateHomeConfig({ banners });
            setSuccessMessage('Configurações da Home atualizadas com sucesso!');
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err) {
            // Error managed by hook
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-white/5 bg-[#1A0B38] p-4 sm:p-6">
                <div>
                    <h2 className="text-xl font-extrabold sm:text-2xl tracking-[0.08em] [word-spacing:0.25em] text-white uppercase font-display">Configurações Gerais (Home)</h2>
                    <p className="mt-1 text-sm text-slate-400">
                        Gerencie os banners rotativos e links da página inicial.
                    </p>
                </div>
            </div>

            {successMessage && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200 flex items-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                    {successMessage}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="admin-glass-card overflow-hidden">
                    <div className="border-b border-white/5 bg-white/[0.02] p-6 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Home className="w-5 h-5 text-purple-400" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-white font-display">Banners da Home</h3>
                        </div>
                        <button
                            type="button"
                            onClick={handleAddBanner}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 text-[10px] font-black uppercase tracking-widest text-white shadow-lg hover:bg-purple-500 transition-all active:scale-95"
                        >
                            <Plus className="w-3 h-3" />
                            Add Banner
                        </button>
                    </div>

                    <div className="p-6 space-y-8 divide-y divide-white/5">
                        {banners.length === 0 && (
                            <div className="py-12 text-center text-slate-500 text-xs font-bold uppercase tracking-widest font-display">
                                Nenhum banner configurado. Clique em "Add Banner" para começar.
                            </div>
                        )}
                        
                        {banners.map((banner, idx) => (
                            <div key={idx} className={`pt-8 first:pt-0 group transition-all ${!banner.active ? 'opacity-50' : ''}`}>
                                <div className="flex flex-col lg:flex-row gap-6">
                                    {/* Preview container */}
                                    <div className="flex-shrink-0">
                                        <div className="relative aspect-video w-full lg:w-48 rounded-xl bg-[#0F0529] border border-white/10 overflow-hidden flex items-center justify-center group-hover:border-purple-500/30 transition-colors">
                                            {banner.image_url ? (
                                                <img src={banner.image_url} alt={`Banner ${idx + 1}`} className="h-full w-full object-cover" />
                                            ) : (
                                                <ImageIcon className="w-8 h-8 text-slate-700" />
                                            )}
                                            <div className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-lg bg-black/60 text-[10px] font-black text-white backdrop-blur-sm border border-white/10">
                                                {idx + 1}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Inputs container */}
                                    <div className="flex-grow grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-1.5 md:col-span-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">URL da Imagem</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={banner.image_url}
                                                    onChange={(e) => handleUpdateBanner(idx, 'image_url', e.target.value)}
                                                    className="h-10 w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 text-xs text-white focus:border-purple-500/40 focus:outline-none placeholder:text-slate-600"
                                                    placeholder="https://..."
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">Link de Destino</label>
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={banner.link_url}
                                                    onChange={(e) => handleUpdateBanner(idx, 'link_url', e.target.value)}
                                                    className="h-10 w-full rounded-xl border border-white/10 bg-[#0F0529] pl-4 pr-10 text-xs text-white focus:border-purple-500/40 focus:outline-none placeholder:text-slate-600"
                                                    placeholder="/validate ou https://..."
                                                />
                                                <ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-6">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">Ordem / Prioridade</label>
                                                <input
                                                    type="number"
                                                    value={banner.priority}
                                                    onChange={(e) => handleUpdateBanner(idx, 'priority', Number(e.target.value))}
                                                    className="h-10 w-24 rounded-xl border border-white/10 bg-[#0F0529] px-4 text-xs text-white focus:border-purple-500/40 focus:outline-none"
                                                />
                                            </div>
                                            
                                            <div className="flex items-center gap-4 self-end h-10">
                                                <label className="flex cursor-pointer items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={banner.active}
                                                        onChange={(e) => handleUpdateBanner(idx, 'active', e.target.checked)}
                                                        className="h-4 w-4 rounded border-white/10 bg-[#0F0529] text-purple-600 focus:ring-purple-500/40"
                                                    />
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase font-display">Ativo</span>
                                                </label>

                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveBanner(idx)}
                                                    className="p-2 text-slate-600 hover:text-red-400 transition-colors"
                                                    title="Remover"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={isSavingHomeConfig}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-10 text-xs font-black uppercase tracking-widest text-black shadow-lg hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isSavingHomeConfig ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Banners
                    </button>
                </div>
            </form>
        </div>
    );
};

export default AdminConfig;
