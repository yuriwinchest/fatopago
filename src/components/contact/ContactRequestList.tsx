import type { ReactNode } from 'react';
import { Clock3, Mail, MessageSquareMore, Phone, UserRound } from 'lucide-react';
import {
    SellerContactMessageRow,
    buildSellerContactExcerpt,
    getSellerContactStatusLabel
} from '../../lib/sellerContactMessages';
import {
    getSellerCampaignAccessStatusLabel,
    getSellerCampaignAccessStatusTone
} from '../../lib/sellerCampaign';

type ContactRequestListProps = {
    title: string;
    subtitle: string;
    emptyMessage: string;
    messages: SellerContactMessageRow[];
    loading?: boolean;
    showSeller?: boolean;
    renderActions?: (message: SellerContactMessageRow) => ReactNode;
};

function formatDateTimeBR(value?: string | null) {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export default function ContactRequestList({
    title,
    subtitle,
    emptyMessage,
    messages,
    loading = false,
    showSeller = false,
    renderActions
}: ContactRequestListProps) {
    return (
        <section className="admin-glass-card p-6 lg:p-8">
            <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 font-display">Inbox Comercial</p>
                    <h3 className="mt-2 text-2xl font-black text-white font-display uppercase tracking-tight">{title}</h3>
                </div>
                <p className="max-w-xl text-xs font-medium leading-relaxed text-slate-400 font-sans border-l-2 border-white/10 pl-4">{subtitle}</p>
            </div>

            {loading ? (
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center text-sm text-slate-400 font-display animate-pulse uppercase tracking-widest">
                    Buscando mensagens...
                </div>
            ) : messages.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-sm text-slate-500 font-display italic">
                    {emptyMessage}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    {messages.map((message) => (
                        <article
                            key={message.id}
                            className="rounded-[28px] border border-white/5 bg-white/[0.03] p-6 hover:bg-white/[0.05] transition-all group overflow-hidden relative"
                        >
                            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/20 group-hover:bg-cyan-500 transition-colors" />
                            
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-lg bg-cyan-500/10 ring-1 ring-cyan-500/20">
                                            <UserRound className="h-4 w-4 text-cyan-400" />
                                        </div>
                                        <div>
                                            <p className="truncate text-base font-black text-white font-display group-hover:text-cyan-400 transition-colors">
                                                {[message.user_name, message.user_lastname].filter(Boolean).join(' ') || 'Usuário'}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Clock3 className="h-3 w-3 text-slate-500" />
                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{formatDateTimeBR(message.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 border border-white/5">
                                            <Mail className="h-3.5 w-3.5 text-slate-500" />
                                            {message.user_email}
                                        </span>
                                        {message.user_phone && (
                                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 border border-white/5">
                                                <Phone className="h-3.5 w-3.5 text-slate-500" />
                                                {message.user_phone}
                                            </span>
                                        )}
                                        {showSeller && (
                                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest text-cyan-300 ring-1 ring-cyan-500/20 font-display">
                                                {message.seller_name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2.5">
                                    <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-400 ring-1 ring-emerald-500/20 font-display">
                                        {getSellerContactStatusLabel(message.status)}
                                    </span>
                                    <span className={`rounded-lg px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest ring-1 ring-white/10 font-display ${getSellerCampaignAccessStatusTone(message.campaign_access_status)}`}>
                                        {getSellerCampaignAccessStatusLabel(message.campaign_access_status)}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-6 rounded-2xl bg-[#0d0724] p-5 border border-white/5 relative">
                                <div className="absolute -top-2.5 left-4 px-2 bg-[#0d0724] text-[9px] font-black uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                                    <MessageSquareMore className="h-3 w-3" />
                                    Mensagem
                                </div>
                                <p className="text-sm leading-relaxed text-slate-300 font-medium italic">
                                    "{buildSellerContactExcerpt(message.message, 180)}"
                                </p>
                            </div>

                            {renderActions && (
                                <div className="mt-6 flex flex-wrap gap-3 border-t border-white/5 pt-5">
                                    {renderActions(message)}
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
