import { useCallback, useMemo, useState } from 'react';
import { Copy, Share2 } from 'lucide-react';
import { buildSellerMonthlyLinks } from '../../lib/sellerMonthlyLinks';

type MonthlySellerLinksGridProps = {
    affiliateLink: string;
    className?: string;
    variant?: 'panel' | 'embedded';
};

async function copyToClipboard(text: string) {
    try {
        await navigator.clipboard.writeText(text);
    } catch {
        window.prompt('Copie manualmente:', text);
    }
}

const MonthlySellerLinksGrid = ({
    affiliateLink,
    className = '',
    variant = 'panel'
}: MonthlySellerLinksGridProps) => {
    const [feedback, setFeedback] = useState<string | null>(null);
    const [activeAction, setActiveAction] = useState<string | null>(null);
    const { groups } = useMemo(() => buildSellerMonthlyLinks(affiliateLink), [affiliateLink]);
    const isEmbedded = variant === 'embedded';

    const setFlashMessage = useCallback((message: string, actionKey?: string) => {
        setFeedback(message);
        setActiveAction(actionKey || null);
        globalThis.setTimeout(() => {
            setFeedback((current) => (current === message ? null : current));
            setActiveAction((current) => (current === actionKey ? null : current));
        }, 2400);
    }, []);

    const handleCopy = useCallback(async (link: string, actionKey: string) => {
        if (!link) return;
        await copyToClipboard(link);
        setFlashMessage('Link copiado com sucesso.', actionKey);
    }, [setFlashMessage]);

    const handleShare = useCallback(async (
        title: string,
        text: string,
        link: string,
        actionKey: string
    ) => {
        if (!link) return;

        if (typeof navigator.share === 'function') {
            try {
                await navigator.share({
                    title,
                    text,
                    url: link
                });
                setFlashMessage('Link enviado para compartilhamento.', actionKey);
                return;
            } catch (error: any) {
                if (error?.name === 'AbortError') {
                    return;
                }
            }
        }

        await copyToClipboard(link);
        setFlashMessage('Compartilhamento indisponível. Link copiado para envio manual.', actionKey);
    }, [setFlashMessage]);

    return (
        <section
            className={
                isEmbedded
                    ? className
                    : `rounded-[28px] border border-white/5 bg-white/[0.02] p-6 lg:p-8 ${className}`
            }
        >
            <div className={`flex flex-col gap-4 ${isEmbedded ? 'lg:flex-row lg:items-center lg:justify-between' : 'xl:flex-row xl:items-center xl:justify-between'}`}>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 font-display">
                        Canais de Conversão
                    </p>
                    <h3 className="mt-2 text-base font-black text-white font-display uppercase tracking-tight">
                        Links Comerciais do Vendedor
                    </h3>
                </div>

                <div className="inline-flex w-fit items-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-300 font-display ring-1 ring-cyan-500/10 shadow-sm">
                    9 links prontos para copiar e compartilhar
                </div>
            </div>

            {feedback && (
                <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-emerald-300 font-display animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {feedback}
                    </div>
                </div>
            )}

            <div className="mt-6 space-y-6 sm:mt-8">
                {groups.map((group) => (
                    <div
                        key={group.key}
                        className="rounded-[24px] border border-white/5 bg-white/[0.03] p-5 sm:p-6"
                    >
                        <div className="mb-5 border-b border-white/5 pb-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 font-display">
                                {group.key === 'daily' ? 'Pacote básico' : group.key === 'weekly' ? 'Plano semanal' : 'Plano mensal'}
                            </p>
                            <h4 className="mt-2 text-lg font-black text-white font-display uppercase tracking-tight">
                                {group.title}
                            </h4>
                            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                                {group.subtitle}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {group.items.map((item) => {
                                const copyActionKey = `copy-${item.planId}`;
                                const shareActionKey = `share-${item.planId}`;
                                const isCopyActive = activeAction === copyActionKey;
                                const isShareActive = activeAction === shareActionKey;

                                return (
                                    <article
                                        key={item.planId}
                                        className="rounded-[20px] border border-white/5 bg-[#100726] px-4 py-5"
                                    >
                                        <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <span className="inline-flex items-center rounded-lg border border-white/5 bg-white/5 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 font-display">
                                                        {item.shortName}
                                                    </span>
                                                    <span className="inline-flex items-center rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-amber-300 font-display ring-1 ring-amber-500/20">
                                                        R$ {item.priceLabel}
                                                    </span>
                                                </div>

                                                <p className="mt-4 text-sm font-bold leading-relaxed text-white">
                                                    {item.copyLabel}
                                                </p>

                                                <div className="mt-3 rounded-2xl border border-white/5 bg-black/20 px-3 py-3">
                                                    <code className="block min-w-0 break-all whitespace-normal text-[10px] font-mono text-cyan-300/80">
                                                        {item.link || 'Link indisponível para este vendedor.'}
                                                    </code>
                                                </div>

                                                <p className="mt-4 text-[10px] font-medium leading-relaxed text-slate-500 italic">
                                                    Envie pelo WhatsApp, Direct, e-mail ou qualquer outro canal comercial.
                                                </p>
                                            </div>

                                            <div className={`flex min-w-0 shrink-0 flex-col gap-2 sm:flex-row ${isEmbedded ? 'w-full xl:w-[260px]' : 'w-full lg:w-[220px]'}`}>
                                                <button
                                                    type="button"
                                                    disabled={!item.link}
                                                    onClick={() => void handleCopy(item.link, copyActionKey)}
                                                    className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-[10px] font-black uppercase tracking-widest transition-all font-display ${
                                                        !item.link
                                                            ? 'cursor-not-allowed border-white/5 bg-white/5 text-slate-600'
                                                            : isCopyActive
                                                                ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                                                                : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                                                    }`}
                                                >
                                                    <Copy className="h-3.5 w-3.5" />
                                                    Copiar
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={!item.link}
                                                    onClick={() => void handleShare(item.shareTitle, item.shareText, item.link, shareActionKey)}
                                                    className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-[10px] font-black uppercase tracking-widest transition-all font-display ${
                                                        !item.link
                                                            ? 'cursor-not-allowed border-white/5 bg-white/5 text-slate-600'
                                                            : isShareActive
                                                                ? 'border-cyan-500/30 bg-cyan-500/20 text-cyan-400'
                                                                : 'border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                                                    }`}
                                                >
                                                    <Share2 className="h-3.5 w-3.5" />
                                                    Enviar
                                                </button>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default MonthlySellerLinksGrid;

