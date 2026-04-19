import React, { useMemo } from 'react';
import {
    AlertTriangle,
    CheckCheck,
    RefreshCw,
    ShieldAlert,
    Siren,
    ShieldCheck,
    Clock3
} from 'lucide-react';
import { SecurityAlertRow } from '../../hooks/useAdminData';

interface SecurityAlertsPanelProps {
    alerts: SecurityAlertRow[];
    loading: boolean;
    error: string | null;
    onRefresh: () => Promise<void>;
    onAcknowledge: (alertId: number) => Promise<void>;
    acknowledgingAlertId: number | null;
}

const severityConfig: Record<SecurityAlertRow['severity'], { label: string; className: string; cardClass: string }> = {
    critical: {
        label: 'Crítico',
        className: 'border-red-500/30 bg-red-500/15 text-red-300',
        cardClass: 'border-red-500/25 shadow-[0_0_0_1px_rgba(239,68,68,0.12)]'
    },
    high: {
        label: 'Alto',
        className: 'border-orange-500/30 bg-orange-500/15 text-orange-300',
        cardClass: 'border-orange-500/20'
    },
    medium: {
        label: 'Médio',
        className: 'border-amber-500/30 bg-amber-500/15 text-amber-200',
        cardClass: 'border-amber-500/15'
    },
    low: {
        label: 'Baixo',
        className: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300',
        cardClass: 'border-cyan-500/15'
    }
};

const formatDateTime = (value?: string | null) => {
    if (!value) return 'Agora há pouco';
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(value));
};

const formatMetadata = (metadata: Record<string, unknown> | null | undefined) => {
    if (!metadata || typeof metadata !== 'object') return [];

    return Object.entries(metadata)
        .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
        .slice(0, 6)
        .map(([key, value]) => ({
            key: key.replace(/_/g, ' '),
            value: typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
                ? String(value)
                : JSON.stringify(value)
        }));
};

const getAlertGuidance = (alert: SecurityAlertRow) => {
    const title = alert.title?.toLowerCase() || '';
    const message = alert.message?.toLowerCase() || '';
    const eventKey = alert.event_key?.toLowerCase() || '';
    const source = alert.source?.toLowerCase() || '';
    const category = alert.category?.toLowerCase() || '';

    if (
        category.includes('withdraw') ||
        source.includes('withdraw') ||
        eventKey.includes('withdraw') ||
        eventKey.includes('pix_withdraw')
    ) {
        return {
            action: 'Abrir Fila de Saques',
            steps: [
                'Abra a aba de "Saques" no dashboard administrativo.',
                'Confira status interno, tentativas, retorno do provedor e se existe provider id associado.',
                'Se o saque estiver em revisão manual, aprove ou rejeite com justificativa; se estiver em processing, valide o retorno do Mercado Pago antes de qualquer compensação.'
            ],
            link: 'withdrawals'
        };
    }

    if (title.includes('tarifa') || message.includes('tarifa')) {
        return {
            action: 'Verificar Configuração de Tarifas',
            steps: [
                'Acesse as configurações de sistema para validar os valores de tarifa ativos.',
                'Verifique se houve alteração manual no banco de dados ou erro de sincronização com o gateway.',
                'Se o erro persistir, revise os logs do serviço de pagamentos.'
            ],
            link: '/admin/config'
        };
    }

    if (eventKey === 'manual_review_required' || title.includes('revisão manual')) {
        return {
            action: 'Realizar Revisão Manual',
            steps: [
                'Abra a aba de "Revisão Manual" no dashboard administrativo.',
                'Analise as evidências da notícia (link, conteúdo, votos divergentes).',
                'Aprove ou Rejeite a notícia para liberar o consenso e os pagamentos associados.'
            ],
            link: 'manual_review'
        };
    }

    return {
        action: 'Investigação Padrão',
        steps: [
            'Revise o metadata do alerta para detalhes técnicos.',
            'Verifique se o usuário associado possui comportamento suspeito.',
            'Confirme se o backend está operando normalmente.'
        ]
    };
};

const SecurityAlertsPanel: React.FC<SecurityAlertsPanelProps & { onActionClick?: (tab: string) => void }> = ({
    alerts,
    loading,
    error,
    onRefresh,
    onAcknowledge,
    acknowledgingAlertId,
    onActionClick
}) => {
    const metrics = useMemo(() => {
        const open = alerts.filter((alert) => !alert.acknowledged_at);
        return {
            total: alerts.length,
            open: open.length,
            critical: open.filter((alert) => alert.severity === 'critical').length,
            high: open.filter((alert) => alert.severity === 'high').length,
            acknowledged: alerts.filter((alert) => Boolean(alert.acknowledged_at)).length
        };
    }, [alerts]);

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-white/5 bg-[#1A0B38] p-4 sm:p-8">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-red-300 font-display">
                            <Siren className="h-3.5 w-3.5" />
                            Observabilidade ativa
                        </div>
                        <h2 className="mt-4 text-3xl font-extrabold sm:text-4xl font-display tracking-[0.08em] text-white uppercase">
                            Alertas de Segurança
                        </h2>
                        <p className="mt-2 max-w-3xl text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                            Eventos críticos do webhook, saques, fila assíncrona e bloqueios defensivos do backend.
                        </p>
                    </div>
                    <button
                        onClick={onRefresh}
                        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-white/10 active:scale-95 font-display"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar alertas
                    </button>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
                    {[
                        { label: 'Abertos', value: metrics.open, icon: ShieldAlert, tone: 'text-red-300 border-red-500/20 bg-red-500/10' },
                        { label: 'Críticos', value: metrics.critical, icon: AlertTriangle, tone: 'text-red-300 border-red-500/20 bg-red-500/10' },
                        { label: 'Altos', value: metrics.high, icon: Siren, tone: 'text-orange-300 border-orange-500/20 bg-orange-500/10' },
                        { label: 'Reconhecidos', value: metrics.acknowledged, icon: CheckCheck, tone: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/10' },
                        { label: 'Total', value: metrics.total, icon: ShieldCheck, tone: 'text-cyan-300 border-cyan-500/20 bg-cyan-500/10' }
                    ].map((metric) => (
                        <div
                            key={metric.label}
                            className={`rounded-2xl border p-4 ${metric.tone}`}
                        >
                            <div className="flex items-center justify-between">
                                <metric.icon className="h-4 w-4" />
                                <span className="text-[10px] font-black uppercase tracking-[0.28em]">{metric.label}</span>
                            </div>
                            <div className="mt-4 text-3xl font-black tracking-tight text-white font-display tabular-nums">
                                {metric.value}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm font-semibold text-red-200">
                    {error}
                </div>
            )}

            {loading && alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#1A0B38] py-20">
                    <RefreshCw className="mb-4 h-10 w-10 animate-spin text-fuchsia-400" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Sincronizando alertas...</p>
                </div>
            ) : alerts.length === 0 ? (
                <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-6 py-16 text-center">
                    <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-emerald-300" />
                    <p className="text-xl font-black uppercase tracking-[0.16em] text-white font-display">Nenhum alerta aberto</p>
                    <p className="mt-2 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-200/80">
                        O backend não registrou anomalias relevantes neste momento.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {alerts.map((alert) => {
                        const config = severityConfig[alert.severity];
                        const metadataItems = formatMetadata(alert.metadata);
                        const isAcknowledged = Boolean(alert.acknowledged_at);

                        return (
                            <article
                                key={alert.id}
                                className={`rounded-2xl border bg-[#160A32] p-5 transition-all ${config.cardClass} ${!isAcknowledged ? 'animate-[pulse_2.2s_ease-in-out_infinite]' : 'opacity-80'}`}
                            >
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] ${config.className}`}>
                                                {config.label}
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-300">
                                                {alert.category}
                                            </span>
                                            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-slate-500">
                                                {alert.source}
                                            </span>
                                            {isAcknowledged && (
                                                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-emerald-300">
                                                    Reconhecido
                                                </span>
                                            )}
                                        </div>

                                        <div>
                                            <h3 className="text-2xl font-black uppercase tracking-[0.04em] text-white font-display">
                                                {alert.title}
                                            </h3>
                                            <p className="mt-2 max-w-3xl text-sm font-semibold text-slate-300">
                                                {alert.message}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-3 lg:items-end">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                                <div className="text-[9px] font-black uppercase tracking-[0.28em] text-slate-500">Ocorrências</div>
                                                <div className="mt-2 text-2xl font-black text-white tabular-nums font-display">{alert.occurrence_count}</div>
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                                <div className="text-[9px] font-black uppercase tracking-[0.28em] text-slate-500">Última vez</div>
                                                <div className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-slate-200">
                                                    <Clock3 className="h-3.5 w-3.5 text-slate-500" />
                                                    {formatDateTime(alert.last_seen_at)}
                                                </div>
                                            </div>
                                        </div>

                                        {!isAcknowledged && (
                                            <button
                                                onClick={() => onAcknowledge(alert.id)}
                                                disabled={acknowledgingAlertId === alert.id}
                                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/15 px-5 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200 transition-all hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                            >
                                                {acknowledgingAlertId === alert.id ? (
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <CheckCheck className="h-4 w-4" />
                                                )}
                                                Reconhecer alerta
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {(() => {
                                    const guidance = getAlertGuidance(alert);
                                    return (
                                        <div className="mt-6 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-5">
                                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <div className="text-[10px] font-black uppercase tracking-[0.28em] text-indigo-300">
                                                        Como resolver
                                                    </div>
                                                    <h4 className="mt-1 text-sm font-black text-white uppercase tracking-wider">
                                                        {guidance.action}
                                                    </h4>
                                                </div>
                                                {guidance.link && onActionClick && (
                                                    <button
                                                        onClick={() => onActionClick(guidance.link)}
                                                        className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/20 px-4 text-[9px] font-black uppercase tracking-widest text-indigo-200 transition-all hover:bg-indigo-500/30 active:scale-95"
                                                    >
                                                        Ir para página
                                                    </button>
                                                )}
                                            </div>
                                            <ul className="mt-4 space-y-2">
                                                {guidance.steps.map((step, idx) => (
                                                    <li key={idx} className="flex gap-3 text-xs font-semibold text-slate-300 leading-relaxed">
                                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-[10px] font-black text-indigo-300">
                                                            {idx + 1}
                                                        </span>
                                                        {step}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    );
                                })()}

                                {metadataItems.length > 0 && (
                                    <div className="mt-5 flex flex-wrap gap-2">
                                        {metadataItems.map((item) => (
                                            <div
                                                key={`${alert.id}-${item.key}`}
                                                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                                            >
                                                <div className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-600">
                                                    {item.key}
                                                </div>
                                                <div className="mt-1 max-w-[320px] truncate text-xs font-semibold text-slate-300">
                                                    {item.value}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SecurityAlertsPanel;
