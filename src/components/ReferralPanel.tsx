import { useState, useCallback } from 'react';
import {
    Users,
    Copy,
    Share2,
    Clock,
    TrendingUp,
    UserPlus
} from 'lucide-react';
import { Card } from './ui/Card';
import { cn } from '../utils/classNames';
import { useReferral, CommissionData } from '../hooks/useReferral';
import { PLANS_CONFIG, PlanId } from '../lib/planRules';

const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });

const planLabel = (planId: string): string => {
    const config = PLANS_CONFIG[planId as PlanId];
    return config?.name || planId;
};

const statusLabel = (status: string) => {
    if (status === 'paid') return 'Pago';
    if (status === 'pending') return 'Pendente';
    return 'Cancelado';
};

const ReferralPanel = () => {
    const {
        referralCode,
        referralActive,
        commissions,
        stats,
        loading
    } = useReferral();

    const [copied, setCopied] = useState(false);

    const referralLink = `https://fatopago.com/convite/${referralCode || ''}`;

    const copyToClipboard = useCallback(async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, []);

    const handleShare = useCallback(async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'FatoPago - Indique e Ganhe',
                    text: 'Valide notícias e ganhe dinheiro. Use meu link de convite:',
                    url: referralLink,
                });
            } catch {
                copyToClipboard(referralLink);
            }
        } else {
            copyToClipboard(referralLink);
        }
    }, [referralLink, copyToClipboard]);

    if (loading) {
        return (
            <Card tone="default" className="border-white/10 bg-[#1A1040] p-6">
                <div className="flex items-center justify-center py-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <Card tone="default" className="border-white/10 bg-[#1A1040] p-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/10">
                        <Users className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Programa de Indicação</h3>
                        <p className="text-xs text-slate-400">Ganhe 20% de comissão por cada indicado que comprar um plano</p>
                    </div>
                </div>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Card tone="soft" className="space-y-1 border-green-400/20 bg-green-500/5 p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-green-300">
                        <TrendingUp className="h-3 w-3" />
                        Total Ganho
                    </p>
                    <p className="text-lg font-black text-white">{formatCurrency(stats.totalCommissions)}</p>
                </Card>

                <Card tone="soft" className="space-y-1 border-yellow-400/20 bg-yellow-500/5 p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-yellow-300">
                        <Clock className="h-3 w-3" />
                        Pendente
                    </p>
                    <p className="text-lg font-black text-white">{formatCurrency(stats.pendingCommissions)}</p>
                </Card>

                <Card tone="soft" className="space-y-1 border-purple-400/20 bg-purple-500/5 p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-purple-300">
                        <UserPlus className="h-3 w-3" />
                        Indicados
                    </p>
                    <p className="text-lg font-black text-white">{stats.referralCount}</p>
                </Card>

                <Card tone="soft" className="space-y-1 border-blue-400/20 bg-blue-500/5 p-4">
                    <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-blue-300">
                        <Users className="h-3 w-3" />
                        Status
                    </p>
                    <p className="text-sm font-black text-white">
                        {referralActive ? 'Ativo' : 'Bloqueado'}
                    </p>
                    {!referralActive && (
                        <p className="text-[9px] text-slate-500">Compre um plano para ativar</p>
                    )}
                </Card>
            </div>

            {/* Invite Link */}
            <Card tone="default" className="border-purple-500/20 bg-gradient-to-r from-purple-900/20 to-transparent p-5">
                <p className="mb-3 text-xs font-bold text-white">Seu Link de Convite</p>
                <div className="flex items-center gap-2">
                    <div className="flex-1 overflow-hidden rounded-xl bg-black/30 px-4 py-3">
                        <span className="block truncate font-mono text-[11px] text-slate-400">
                            {referralCode ? `fatopago.com/convite/${referralCode}` : 'Carregando...'}
                        </span>
                    </div>
                    <button
                        onClick={() => copyToClipboard(referralLink)}
                        className={cn(
                            "flex items-center gap-1.5 rounded-xl px-4 py-3 text-[10px] font-bold uppercase transition-all",
                            copied
                                ? "bg-green-500/20 text-green-400"
                                : "bg-white/5 text-slate-300 hover:bg-white/10"
                        )}
                    >
                        <Copy className="h-3.5 w-3.5" />
                        {copied ? 'Copiado!' : 'Copiar'}
                    </button>
                    <button
                        onClick={handleShare}
                        className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-3 text-[10px] font-bold uppercase text-white transition-colors hover:bg-purple-500"
                    >
                        <Share2 className="h-3.5 w-3.5" />
                        Compartilhar
                    </button>
                </div>
            </Card>

            {/* Commissions Table */}
            <Card tone="default" className="border-white/10 bg-[#1A1040] p-5">
                <h4 className="mb-4 text-sm font-bold text-white">Histórico de Comissões</h4>

                {commissions.length > 0 ? (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                        {commissions.map((commission: CommissionData) => (
                            <div
                                key={commission.id}
                                className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#120a2a] p-4 transition-colors hover:border-purple-500/30"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-500/10">
                                        <UserPlus className="h-4 w-4 text-purple-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-white">
                                            {planLabel(commission.plan_id)}
                                        </p>
                                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                                            <Clock className="h-3 w-3" />
                                            {formatDate(commission.created_at)}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-green-400">
                                        +{formatCurrency(commission.amount)}
                                    </p>
                                    <p className={cn(
                                        'mt-1 inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold',
                                        commission.status === 'paid' && 'bg-green-500/10 text-green-300',
                                        commission.status === 'pending' && 'bg-yellow-500/10 text-yellow-300',
                                        commission.status === 'cancelled' && 'bg-red-500/10 text-red-300'
                                    )}>
                                        {statusLabel(commission.status)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center opacity-50">
                        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/5">
                            <Users className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-300">Nenhuma comissão ainda</p>
                        <p className="mt-1 text-xs text-slate-500">
                            Compartilhe seu link e ganhe 20% quando seus indicados comprarem um plano.
                        </p>
                    </div>
                )}
            </Card>
        </div>
    );
};

export default ReferralPanel;
