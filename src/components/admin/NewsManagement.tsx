import React, { useRef, useState } from 'react';
import { Plus, Trash2, RotateCw, X, Check, AlertCircle, Newspaper, ArrowUpRight, Pencil, Search, Eye } from 'lucide-react';
import { cn } from '../../utils/classNames';
import { AdminNewsItem, CycleMetaRow } from '../../hooks/useAdminData';
import { ADMIN_NEWS_CATEGORIES } from '../../lib/newsCategories';

interface NewsManagementProps {
    newsLoading: boolean;
    adminNewsItems: AdminNewsItem[];
    previousAdminNewsItems: AdminNewsItem[];
    currentNewsCycle: CycleMetaRow | null;
    previousNewsCycle: CycleMetaRow | null;
    newsPublishing: boolean;
    newsMessage: string | null;
    restoringNewsId: string | null;
    handlePublishNews: (formData: any, imageFile: File | null) => Promise<boolean>;
    handleUpdateNews: (id: string, formData: any, imageFile: File | null) => Promise<boolean>;
    handleDeleteNews: (id: string) => Promise<void>;
    handleRestoreNews: (id: string, item: AdminNewsItem) => Promise<void>;
    fetchNews: () => Promise<void>;
}

// Keep interface stable — previousAdminNewsItems and handleRestoreNews are
// accepted but no longer rendered (all news live in every cycle now).

const NewsManagement: React.FC<NewsManagementProps> = ({
    newsLoading,
    adminNewsItems,
    previousAdminNewsItems: _previousAdminNewsItems,
    currentNewsCycle: _currentNewsCycle,
    previousNewsCycle: _previousNewsCycle,
    newsPublishing,
    newsMessage,
    restoringNewsId: _restoringNewsId,
    handlePublishNews,
    handleUpdateNews,
    handleDeleteNews,
    handleRestoreNews: _handleRestoreNews,
    fetchNews
}) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        full_text: '',
        category: 'Brasil',
        source: 'Admin FatoPago',
        image_url: '',
        link: '',
        admin_priority: 1
    });

    const [searchTerm, setSearchTerm] = useState('');
    const [editingNewsId, setEditingNewsId] = useState<string | null>(null);
    const [previewItemId, setPreviewItemId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    const newsListRef = useRef<HTMLDivElement>(null);

    const goToPage = (page: number) => {
        setCurrentPage(page);
        // Manter a posição visual no topo da lista de notícias
        requestAnimationFrame(() => {
            newsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    };

    const handleOpenCreate = () => {
        setFormData({
            title: '',
            description: '',
            full_text: '',
            category: 'Brasil',
            source: 'Admin FatoPago',
            image_url: '',
            link: '',
            admin_priority: 1
        });
        setImageFile(null);
        setEditingNewsId(null);
        setIsFormOpen(true);
    };

    const handleOpenEdit = (item: AdminNewsItem) => {
        setFormData({
            title: item.title,
            description: item.description || '',
            full_text: item.full_text || '',
            category: item.category || 'Brasil',
            source: item.source || 'Admin FatoPago',
            image_url: item.image_url || '',
            link: item.link || '',
            admin_priority: item.admin_priority || 1
        });
        setImageFile(null);
        setEditingNewsId(item.id);
        setIsFormOpen(true);
    };

    const handleCloseForm = () => {
        setIsFormOpen(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) return;

        const success = editingNewsId 
            ? await handleUpdateNews(editingNewsId, formData, imageFile)
            : await handlePublishNews(formData, imageFile);
        
        if (success) {
            handleCloseForm();
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Excluir esta notícia permanentemente?')) {
            await handleDeleteNews(id);
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-white/5 bg-[#1A0B38] p-4 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-xl font-extrabold sm:text-2xl tracking-[0.08em] [word-spacing:0.25em] text-white uppercase font-display">Feed de Notícias</h2>
                        <div className="mt-1 flex items-center gap-3">
                            <p className="text-sm text-slate-400">
                                Notícias cadastradas manualmente — disponíveis em todos os ciclos
                            </p>
                            <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                                {adminNewsItems.length} {adminNewsItems.length === 1 ? 'notícia' : 'notícias'}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Buscar notícia (título ou resumo)..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="h-11 w-full sm:w-64 rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2 text-sm text-white focus:border-emerald-500/40 focus:outline-none placeholder:text-slate-500"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => void fetchNews()}
                                 className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-bold uppercase tracking-wider text-slate-200 hover:bg-white/10 transition-all active:scale-95"
                                title="Recarregar feed"
                                aria-label="Recarregar feed de notícias"
                            >
                                <RotateCw className={`w-4 h-4 ${newsLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={handleOpenCreate}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 transition-all active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                                Nova Notícia
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {newsMessage && (
                <div className={`rounded-2xl border p-4 text-sm flex items-center gap-3 ${newsMessage.includes('Erro') ? 'border-red-500/20 bg-red-500/10 text-red-200' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'}`}>
                    <AlertCircle className="w-5 h-5" />
                    {newsMessage}
                </div>
            )}

            {isFormOpen && (
                <div className="admin-glass-card border border-emerald-500/30 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="border-b border-white/5 bg-white/[0.02] p-6 flex items-center justify-between">
                        <h3 className="text-sm font-black uppercase tracking-widest text-white font-display">
                            {editingNewsId ? 'Editar Notícia' : 'Publicar Notícia Manual'}
                        </h3>
                        <button onClick={handleCloseForm} className="text-slate-500 hover:text-white transition-colors" title="Fechar formulário" aria-label="Fechar formulário">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">Título</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="h-11 w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-2 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
                                    placeholder="Ex: Novo ciclo de validação disponível"
                                />
                            </div>

                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">Resumo da notícia</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="min-h-[110px] w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-3 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
                                    placeholder="Opcional. Escreva o texto principal que o usuário verá primeiro."
                                />
                            </div>

                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">Texto completo da notícia</label>
                                <textarea
                                    value={formData.full_text}
                                    onChange={(e) => setFormData({ ...formData, full_text: e.target.value })}
                                    className="min-h-[160px] w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-3 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
                                    placeholder="Opcional. Se não preencher, o sistema usará o resumo como texto completo."
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="news-category" className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">Categoria</label>
                                <select
                                    id="news-category"
                                    value={formData.category}
                                    title="Selecionar categoria"
                                    aria-label="Selecionar categoria da notícia"
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="h-11 w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-2 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
                                >
                                    {ADMIN_NEWS_CATEGORIES.map((category) => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="news-priority" className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">Prioridade (0-100)</label>
                                <input
                                    id="news-priority"
                                    type="number"
                                    title="Definir prioridade"
                                    value={formData.admin_priority}
                                    onChange={(e) => setFormData({ ...formData, admin_priority: Number(e.target.value) })}
                                    className="h-11 w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-2 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">Fonte</label>
                                <input
                                    type="text"
                                    value={formData.source}
                                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                    className="h-11 w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-2 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
                                    placeholder="Ex: Admin FatoPago"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="news-image-upload" className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">Imagem (Upload)</label>
                                <input
                                    id="news-image-upload"
                                    type="file"
                                    title="Fazer upload de imagem"
                                    accept="image/*"
                                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                                    className="h-11 w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-2 text-xs text-white focus:border-emerald-500/40 focus:outline-none pt-2.5"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">Link Externo (Opcional)</label>
                                <input
                                    type="url"
                                    value={formData.link}
                                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                                    className="h-11 w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-2 text-sm text-white focus:border-emerald-500/40 focus:outline-none"
                                    placeholder="https://..."
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={handleCloseForm}
                                className="h-11 rounded-xl px-6 text-xs font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={newsPublishing}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-8 text-xs font-black uppercase tracking-widest text-white shadow-lg hover:bg-emerald-500 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {newsPublishing ? <RotateCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                {editingNewsId ? 'Atualizar Agora' : 'Publicar Agora'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {!isFormOpen && (
                <>
                    {/* All Admin News */}
                    <div ref={newsListRef} className="admin-glass-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-white/5 p-6 bg-white/[0.01]">
                    <div className="flex items-center gap-3">
                        <Newspaper className="w-5 h-5 text-emerald-400" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-white font-display">Todas as Notícias</h3>
                    </div>
                </div>
                <div className="p-4 sm:p-6 space-y-6 bg-black/20">
                    {newsLoading && (
                        <div className="flex justify-center p-12">
                            <RotateCw className="w-6 h-6 animate-spin text-emerald-500" />
                        </div>
                    )}
                    {!newsLoading && (() => {
                        const filteredItems = adminNewsItems.filter(i => 
                            i.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            (i.description && i.description.toLowerCase().includes(searchTerm.toLowerCase()))
                        );
                        
                        const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
                        const currentItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

                        if (filteredItems.length === 0) {
                            return (
                                <div className="p-12 text-center text-slate-500 text-[10px] font-black uppercase tracking-widest">
                                    Nenhuma notícia encontrada.
                                </div>
                            );
                        }

                        return (
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    {currentItems.map((item) => (
                                        <article
                                            key={item.id}
                                            className="group relative flex flex-col sm:flex-row gap-4 p-4 border border-white/5 bg-white/[0.02] rounded-2xl hover:bg-white/[0.05] transition-all"
                                        >
                                            {item.image_url && (
                                                <div className="shrink-0 w-full sm:w-40 h-28 rounded-lg overflow-hidden border border-white/10 bg-black/40 relative">
                                                    <img
                                                        src={item.image_url}
                                                        alt={item.title}
                                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).style.display = 'none';
                                                        }}
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0 flex flex-col pt-1">
                                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                                    <span className={cn('h-1.5 w-1.5 rounded-full', item.source?.includes('G1') ? 'bg-red-500' : 'bg-blue-500')} />
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                        {item.source || 'ADMIN FATOPAGO'}
                                                    </span>
                                                    <span className="text-white/20">•</span>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                        Prioridade: <span className="text-white">{item.admin_priority || 0}</span>
                                                    </span>
                                                    <span className="text-white/20">•</span>
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                        {item.category}
                                                    </span>
                                                </div>
                                                <h3 className="text-base font-bold text-white line-clamp-2 leading-tight mb-1.5 pr-8">
                                                    {item.title}
                                                </h3>
                                                {item.description && (
                                                    <p className="text-xs text-slate-400 line-clamp-2 mt-auto">
                                                        {item.description}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="shrink-0 flex items-center justify-end sm:flex-col sm:justify-start gap-2 sm:pt-1">
                                                <button
                                                    onClick={() => setPreviewItemId(item.id)}
                                                    className="inline-flex flex-1 sm:flex-none h-9 px-4 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs font-bold text-purple-300 shadow-lg transition-all hover:bg-purple-500/30 hover:border-transparent active:scale-95 gap-2"
                                                    title="Pré-visualizar Notícia (Visão do Usuário)"
                                                >
                                                    <Eye className="h-3.5 w-3.5" /> Prévia
                                                </button>
                                                <button
                                                    onClick={() => handleOpenEdit(item)}
                                                    className="inline-flex flex-1 sm:flex-none h-9 px-4 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white shadow-lg transition-all hover:bg-[hsl(var(--primary))]/90 hover:border-transparent active:scale-95 gap-2"
                                                >
                                                    <Pencil className="h-3.5 w-3.5 text-slate-400" /> Editar
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="inline-flex w-9 h-9 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-red-500 shadow-lg transition-all hover:bg-red-500/20 active:scale-95"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                            {item.link && (
                                                <a
                                                    href={item.link}
                                                    target="_blank"
                                                    rel="noreferrer noopener"
                                                    title="Ver fonte original"
                                                    className="absolute top-5 right-5 text-slate-600 hover:text-white transition-colors hidden sm:block"
                                                >
                                                    <ArrowUpRight className="w-4 h-4" />
                                                </a>
                                            )}
                                        </article>
                                    ))}
                                </div>
                                
                                {totalPages > 1 && (
                                    <div className="mt-8 flex flex-wrap items-center justify-center gap-2 rounded-xl bg-white/5 p-2">
                                        <button
                                            onClick={() => goToPage(Math.max(1, currentPage - 1))}
                                            disabled={currentPage === 1}
                                            className="h-9 rounded-lg px-4 text-xs font-bold uppercase tracking-wider text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                                        >
                                            Anterior
                                        </button>
                                        <div className="flex gap-1">
                                            {Array.from({ length: totalPages }).map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => goToPage(idx + 1)}
                                                    className={`h-9 w-9 rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${
                                                        currentPage === idx + 1
                                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                                            : 'bg-transparent text-slate-400 hover:bg-white/10 hover:text-white'
                                                    }`}
                                                >
                                                    {idx + 1}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={() => goToPage(Math.min(totalPages, currentPage + 1))}
                                            disabled={currentPage === totalPages}
                                            className="h-9 rounded-lg px-4 text-xs font-bold uppercase tracking-wider text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                                        >
                                            Próxima
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>

            </>
            )}
            {/* Preview Modal */}
            {previewItemId && (() => {
                const previewItem = adminNewsItems.find(i => i.id === previewItemId);
                if (!previewItem) return null;
                
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewItemId(null)} />
                        
                        <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-[#0F0529] border border-white/10 rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/10 bg-[#0F0529]/95 backdrop-blur-md">
                                <h3 className="text-sm font-black uppercase text-purple-300 tracking-widest pl-2">Prévia do Usuário</h3>
                                <button
                                    onClick={() => setPreviewItemId(null)}
                                    className="p-2 rounded-full hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-5 h-5 text-white" />
                                </button>
                            </div>

                            {/* Simulated Card / Validation App View */}
                            <div className="p-4 sm:p-6">
                                <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-[#1A1040] shadow-xl h-[420px]">
                                    <div className="absolute inset-0 z-0 bg-slate-800">
                                        {previewItem.image_url && (
                                            <img
                                                src={previewItem.image_url}
                                                alt={previewItem.title}
                                                className="h-full w-full object-cover opacity-60"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                }}
                                            />
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0529] via-[#0F0529]/80 to-transparent" />
                                    </div>

                                    <div className="relative z-10 flex h-full flex-col justify-end p-5">
                                        <div className="mb-auto" />
                                        
                                        <div className="mb-4 flex flex-wrap items-center gap-2">
                                            <div className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300 shadow-sm backdrop-blur-md">
                                                ★ Destaque
                                            </div>
                                            <div className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300 shadow-sm backdrop-blur-md">
                                                R$ {parseFloat('1').toFixed(2)} / Opinião
                                            </div>
                                        </div>

                                        <h3 className="mb-2 text-xl font-bold leading-tight text-white line-clamp-3">
                                            {previewItem.title}
                                        </h3>
                                        <p className="mb-4 text-xs font-medium text-slate-300 line-clamp-2">
                                            {previewItem.description}
                                        </p>

                                        <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-3.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg hover:bg-purple-500 pointer-events-none">
                                            <span>Validar agora</span>
                                        </button>
                                        
                                        <div className="mt-4 flex items-center justify-center gap-4 text-slate-400">
                                            <span className="text-[10px] uppercase font-bold tracking-widest">{previewItem.source || 'FatoPago'}</span>
                                            <span className="text-[10px] opacity-30">•</span>
                                            <span className="text-[10px] uppercase font-bold tracking-widest">Há 2H</span>
                                        </div>
                                    </div>
                                </article>

                                {/* Simulated read text view below card */}
                                {previewItem.full_text && (
                                    <div className="mt-8 pt-8 border-t border-white/5">
                                        <p className="text-[10px] uppercase font-black text-slate-500 mb-4 tracking-widest">Texto completo (após click):</p>
                                        <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed space-y-4">
                                            {previewItem.full_text.split('\n').filter(p => p.trim()).map((paragraph, index) => (
                                                <p key={index}>{paragraph}</p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default NewsManagement;
