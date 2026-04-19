
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Zap, Crown, Shield, ArrowRight, Loader2, MessageCircleMore, Star } from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import {
    ALL_PLAN_IDS,
    DAILY_PLAN_IDS,
    formatNewsCount,
    MONTHLY_PLAN_IDS,
    PlanId,
    PLAN_LABELS,
    PLANS_CONFIG,
    WEEKLY_PLAN_IDS,
    getEstimatedValidationCapacity,
    getPlanAvailability,
    getPlanProgressPercentage,
    getPlanRemainingCredit,
    isSellerExclusivePlanId,
    parsePlanId
} from '../lib/planRules';
import {
    fetchActivePlan,
    fetchPlanHistory,
    getCurrentUserId,
    getMySellerCampaignAccess,
    isPlanExhausted,
    PlanPurchase
} from '../lib/planService';
import {
    clearStoredAutoPlanContext,
    persistAutoPlanContext,
    readStoredAutoPlanContext,
    resolveAutoPlanContext
} from '../lib/sellerMonthlyLinks';
import SellerContactModal from '../components/plans/SellerContactModal';
import PixPaymentModal from '../components/PixPaymentModal';
import {
    buildSellerCampaignAcknowledgementKey,
    buildSellerCampaignEnabledMessage,
    getSellerCampaignSourceLabel
} from '../lib/sellerCampaign';

type PlanNoticeTone = 'error' | 'info' | 'success';

type PlanNotice = {
    tone: PlanNoticeTone;
    message: string;
};

// Main Component
const Plans = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
    const [planHistory, setPlanHistory] = useState<PlanPurchase[]>([]);
    const [activePlan, setActivePlan] = useState<PlanPurchase | null>(null);
    const [notice, setNotice] = useState<PlanNotice | null>(null);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [showPixModal, setShowPixModal] = useState(false);
    const [pixPlanId, setPixPlanId] = useState<PlanId | null>(null);
    const [canBuySellerPlans, setCanBuySellerPlans] = useState(false);
    const [showSellerContactModal, setShowSellerContactModal] = useState(false);
    const [sellerCampaignAccess, setSellerCampaignAccess] = useState<Awaited<ReturnType<typeof getMySellerCampaignAccess>> | null>(null);

    const returnTo = searchParams.get('returnTo') || '/validation';
    const reason = searchParams.get('reason');
    const searchKey = searchParams.toString();
    const urlAutoPlanResolution = useMemo(() => resolveAutoPlanContext(
        parsePlanId(searchParams.get('autoPlan')),
        {}
    ), [searchKey, searchParams]);
    const storedAutoPlanResolution = useMemo(() => readStoredAutoPlanContext(), [searchKey]);
    const autoPlanResolution = urlAutoPlanResolution.status !== 'none'
        ? urlAutoPlanResolution
        : storedAutoPlanResolution;
    const autoPlanContext = autoPlanResolution.status === 'valid' ? autoPlanResolution.context : null;
    const autoPlanId = autoPlanContext?.planId || null;
    const autoPlanRef = useRef(false);
    const campaignAccessRefreshRef = useRef<number | null>(null);

    useEffect(() => {
        if (!reason) return;
        if (reason === 'no-balance') {
            setNotice({
                tone: 'info',
                message: 'Você não tem notícias disponíveis para validar. Escolha um plano para continuar.'
            });
        }
    }, [reason]);

    useEffect(() => {
        if (urlAutoPlanResolution.status === 'valid' && urlAutoPlanResolution.context) {
            persistAutoPlanContext(urlAutoPlanResolution.context);
            return;
        }

        if (urlAutoPlanResolution.status === 'expired' || urlAutoPlanResolution.status === 'invalid') {
            clearStoredAutoPlanContext();
            setNotice({
                tone: 'error',
                message: urlAutoPlanResolution.message || 'O link mensal informado não está mais disponível.'
            });
        }
    }, [urlAutoPlanResolution]);

    useEffect(() => {
        if (autoPlanResolution.status === 'expired' || autoPlanResolution.status === 'invalid') {
            setNotice({
                tone: 'error',
                message: autoPlanResolution.message || 'O link mensal informado não está mais disponível.'
            });
        }
    }, [autoPlanResolution]);

    const applySellerCampaignAccess = useCallback((campaignAccess: Awaited<ReturnType<typeof getMySellerCampaignAccess>>) => {
        const hasAccess = campaignAccess.has_access === true;

        setSellerCampaignAccess(campaignAccess);
        setCanBuySellerPlans(hasAccess);

        if (!hasAccess) return;

        const acknowledgementKey = buildSellerCampaignAcknowledgementKey({
            sellerId: campaignAccess.seller_id,
            source: campaignAccess.source,
            campaignEnabledAt: campaignAccess.campaign_enabled_at
        });

        if (!acknowledgementKey || typeof window === 'undefined') return;
        if (window.sessionStorage.getItem(acknowledgementKey) === 'seen') return;

        window.sessionStorage.setItem(acknowledgementKey, 'seen');
        setNotice({
            tone: 'success',
            message: buildSellerCampaignEnabledMessage({
                sellerName: campaignAccess.seller_name,
                source: campaignAccess.source
            })
        });
    }, []);

    const fetchSellerCampaignAccess = useCallback(async () => {
        return getMySellerCampaignAccess().catch((error) => {
            console.warn('Falha ao verificar acesso comercial do vendedor:', error);
            return {
                has_access: false,
                seller_id: null,
                seller_name: null,
                seller_code: null,
                seller_referral_id: null,
                source: null,
                campaign_enabled_at: null,
                affiliate_link: null
            };
        });
    }, []);

    useEffect(() => {
        const loadPlans = async () => {
            try {
                const userId = await getCurrentUserId();
                if (!userId) {
                    navigate('/login');
                    return;
                }

                const [active, history] = await Promise.all([
                    fetchActivePlan(userId),
                    fetchPlanHistory(userId)
                ]);

                const campaignAccess = await fetchSellerCampaignAccess();

                setActivePlan(active);
                setPlanHistory(history);
                applySellerCampaignAccess(campaignAccess);
            } catch (error) {
                console.error('Erro ao carregar planos:', error);
                setNotice({
                    tone: 'error',
                    message: 'Não foi possível carregar seus planos agora.'
                });
            } finally {
                setLoadingPlans(false);
            }
        };

        loadPlans();
    }, [applySellerCampaignAccess, fetchSellerCampaignAccess, navigate]);

    useEffect(() => {
        if (loadingPlans) return;

        let cancelled = false;

        const syncCampaignAccess = async () => {
            const campaignAccess = await fetchSellerCampaignAccess();
            if (cancelled) return;
            applySellerCampaignAccess(campaignAccess);
        };

        void syncCampaignAccess();

        const intervalId = window.setInterval(() => {
            void syncCampaignAccess();
        }, 15000);
        campaignAccessRefreshRef.current = intervalId;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void syncCampaignAccess();
            }
        };

        const handleFocus = () => {
            void syncCampaignAccess();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        return () => {
            cancelled = true;
            if (campaignAccessRefreshRef.current !== null) {
                window.clearInterval(campaignAccessRefreshRef.current);
                campaignAccessRefreshRef.current = null;
            }
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, [applySellerCampaignAccess, fetchSellerCampaignAccess, loadingPlans]);

    const availabilityMap = useMemo(() => {
        const map = {} as Record<PlanId, ReturnType<typeof getPlanAvailability>>;
        ALL_PLAN_IDS.forEach((planId) => {
            map[planId] = getPlanAvailability(planId, planHistory);
        });
        return map;
    }, [planHistory]);

    const getButtonText = (planId: PlanId, locked: boolean) => {
        if (loading && selectedPlan === planId) return 'PROCESSANDO...';

        const exhausted = isPlanExhausted(activePlan);

        if (activePlan?.plan_id === planId) {
            return exhausted ? 'RENOVAR AGORA' : 'PLANO ATIVO';
        }

        if (activePlan) { // Has active plan but different ID
            return exhausted ? 'COMEÇAR AGORA' : 'FINALIZE O PLANO ATUAL';
        }

        if (locked) return availabilityMap[planId].reason || 'BLOQUEADO';
        return 'COMEÇAR AGORA';
    };

    const planCatalog: Record<PlanId, {
        id: PlanId;
        name: string;
        price: number;
        color: string;
        icon: typeof Shield;
        recommended?: boolean;
        features: string[];
    }> = {
        starter: {
            id: 'starter',
            name: PLANS_CONFIG.starter.name,
            price: PLANS_CONFIG.starter.price,
            color: 'from-blue-400 to-blue-600',
            icon: Shield,
            features: [
                `${formatNewsCount(getEstimatedValidationCapacity('starter'))} liberadas neste pacote`,
                'Cada notícia validada consome 1 unidade do pacote',
                'Se as notícias acabarem antes do fim do ciclo, você pode comprar outro pacote imediatamente'
            ]
        },
        pro: {
            id: 'pro',
            name: PLANS_CONFIG.pro.name,
            price: PLANS_CONFIG.pro.price,
            recommended: true,
            color: 'from-purple-400 to-purple-600',
            icon: Zap,
            features: [
                `${formatNewsCount(getEstimatedValidationCapacity('pro'))} liberadas neste pacote`,
                'Cada notícia validada consome 1 unidade do pacote',
                'Se as notícias acabarem antes do fim do ciclo, você pode comprar outro pacote imediatamente'
            ]
        },
        expert: {
            id: 'expert',
            name: PLANS_CONFIG.expert.name,
            price: PLANS_CONFIG.expert.price,
            color: 'from-amber-400 to-amber-600',
            icon: Crown,
            features: [
                `${formatNewsCount(getEstimatedValidationCapacity('expert'))} liberadas neste pacote`,
                'Cada notícia validada consome 1 unidade do pacote',
                'Se as notícias acabarem antes do fim do ciclo, você pode comprar outro pacote imediatamente'
            ]
        },
        starter_weekly: {
            id: 'starter_weekly',
            name: PLANS_CONFIG.starter_weekly.name,
            price: PLANS_CONFIG.starter_weekly.price,
            color: 'from-cyan-400 to-sky-600',
            icon: Shield,
            features: [
                `${formatNewsCount(getEstimatedValidationCapacity('starter_weekly'))} disponíveis para consumo total no pacote`,
                'Pacote comercial do vendedor liberado para a sua campanha',
                'Cada notícia validada consome 1 unidade do pacote'
            ]
        },
        pro_weekly: {
            id: 'pro_weekly',
            name: PLANS_CONFIG.pro_weekly.name,
            price: PLANS_CONFIG.pro_weekly.price,
            recommended: true,
            color: 'from-fuchsia-400 to-pink-600',
            icon: Zap,
            features: [
                `${formatNewsCount(getEstimatedValidationCapacity('pro_weekly'))} disponíveis para consumo total no pacote`,
                'Pacote comercial do vendedor liberado para a sua campanha',
                'Cada notícia validada consome 1 unidade do pacote'
            ]
        },
        expert_weekly: {
            id: 'expert_weekly',
            name: PLANS_CONFIG.expert_weekly.name,
            price: PLANS_CONFIG.expert_weekly.price,
            color: 'from-rose-400 to-orange-500',
            icon: Crown,
            features: [
                `${formatNewsCount(getEstimatedValidationCapacity('expert_weekly'))} disponíveis para consumo total no pacote`,
                'Pacote comercial do vendedor liberado para a sua campanha',
                'Cada notícia validada consome 1 unidade do pacote'
            ]
        },
        starter_monthly: {
            id: 'starter_monthly',
            name: PLANS_CONFIG.starter_monthly.name,
            price: PLANS_CONFIG.starter_monthly.price,
            color: 'from-indigo-400 to-blue-600',
            icon: Shield,
            features: [
                `${formatNewsCount(getEstimatedValidationCapacity('starter_monthly'))} disponíveis para consumo total no pacote`,
                'Plano mensal com uso flexível até consumir todas as notícias liberadas',
                'Cada notícia validada consome 1 unidade do pacote'
            ]
        },
        pro_monthly: {
            id: 'pro_monthly',
            name: PLANS_CONFIG.pro_monthly.name,
            price: PLANS_CONFIG.pro_monthly.price,
            recommended: true,
            color: 'from-fuchsia-400 to-pink-600',
            icon: Zap,
            features: [
                `${formatNewsCount(getEstimatedValidationCapacity('pro_monthly'))} disponíveis para consumo total no pacote`,
                'Plano mensal com uso flexível até consumir todas as notícias liberadas',
                'Cada notícia validada consome 1 unidade do pacote'
            ]
        },
        expert_monthly: {
            id: 'expert_monthly',
            name: PLANS_CONFIG.expert_monthly.name,
            price: PLANS_CONFIG.expert_monthly.price,
            color: 'from-amber-400 to-orange-500',
            icon: Crown,
            features: [
                `${formatNewsCount(getEstimatedValidationCapacity('expert_monthly'))} disponíveis para consumo total no pacote`,
                'Plano mensal com uso flexível até consumir todas as notícias liberadas',
                'Cada notícia validada consome 1 unidade do pacote'
            ]
        }
    };
    const dailyPlans = DAILY_PLAN_IDS.map((planId) => planCatalog[planId]);
    const weeklyPlans = WEEKLY_PLAN_IDS.map((planId) => planCatalog[planId]);
    const monthlyPlans = MONTHLY_PLAN_IDS.map((planId) => planCatalog[planId]);

    const handleSelectPlan = useCallback(async (planId: PlanId) => {
        setNotice(null);
        const exhausted = isPlanExhausted(activePlan);

        if (activePlan && !exhausted) {
            setNotice({
                tone: 'info',
                message: 'Você já possui um plano ativo. Finalize-o para escolher outro.'
            });
            return;
        }

        if (isSellerExclusivePlanId(planId) && !canBuySellerPlans) {
            setNotice({
                tone: 'info',
                message: 'Os planos semanal e mensal desta campanha estão disponíveis apenas para usuários vinculados a vendedor ativo.'
            });
            return;
        }

        const availability = availabilityMap[planId];
        if (availability.locked) {
            setNotice({
                tone: 'info',
                message: availability.reason || 'Plano indisponível no momento.'
            });
            return;
        }

        // Open PIX payment modal
        setPixPlanId(planId);
        setSelectedPlan(planId);
        setShowPixModal(true);
    }, [activePlan, availabilityMap, canBuySellerPlans]);

    useEffect(() => {
        if (!autoPlanId || loadingPlans || autoPlanRef.current) return;
        if (autoPlanResolution.status === 'expired' || autoPlanResolution.status === 'invalid') {
            autoPlanRef.current = true;
            return;
        }

        autoPlanRef.current = true;
        void handleSelectPlan(autoPlanId);
        clearStoredAutoPlanContext();

        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('autoPlan');
        nextParams.delete('windowStartAt');
        nextParams.delete('windowEndAt');
        const next = nextParams.toString();
        navigate(next ? `/plans?${next}` : '/plans', { replace: true });
    }, [autoPlanId, autoPlanResolution.status, handleSelectPlan, loadingPlans, navigate, searchParams]);

    const handlePaymentApproved = async () => {
        // Payment approved - plan is activated by edge function
        // Refresh local data
        try {
            const userId = await getCurrentUserId();
            if (!userId) return;

            const [active, history] = await Promise.all([
                fetchActivePlan(userId),
                fetchPlanHistory(userId)
            ]);

            setActivePlan(active);
            setPlanHistory(history);

            // Navigate after short delay
            setTimeout(() => {
                navigate(returnTo);
            }, 1500);
        } catch (error) {
            console.error('Error refreshing after payment:', error);
        }
    };

    const handlePixModalClose = () => {
        setShowPixModal(false);
        setPixPlanId(null);
        setSelectedPlan(null);
        setLoading(false);
    };

    const handleSellerContactSent = () => {
        setNotice({
            tone: 'info',
            message: 'Pedido enviado com sucesso. O vendedor vai analisar e habilitar os planos da campanha para a sua conta.'
        });
    };

    return (
        <AppLayout
            title="Escolha seu Plano"
            subtitle="Escolha o pacote ideal para você e comece a validar notícias."
            showBackButton={true}
        >
            <div className="space-y-6">
                {/* Status Indicator */}
                {notice && (
                    <div
                        className={`animate-in slide-in-from-top-2 fade-in rounded-2xl border px-4 py-3 text-sm ${
                            notice.tone === 'success'
                                ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
                                : notice.tone === 'info'
                                    ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'
                                    : 'border-red-500/20 bg-red-500/10 text-red-300'
                        }`}
                    >
                        {notice.message}
                    </div>
                )}

                {activePlan && (
                    <div className="relative z-20 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
                        <div className="relative inline-block overflow-hidden rounded-[2rem] border border-white/10 bg-[#1a1438]/40 p-[2px] backdrop-blur-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] group">
                            {/* Animated glowing border effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/30 via-cyan-500/30 to-purple-500/30 animate-pulse-slow opacity-50" />
                            
                            <div className="relative rounded-[1.9rem] bg-[#0a051d]/90 px-8 py-5">
                                <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                        <p className="font-display text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400/80">
                                            Assinatura em Vigor
                                        </p>
                                    </div>
                                    
                                    <h4 className="font-display text-2xl font-black text-white uppercase tracking-tighter sm:text-3xl">
                                        {PLAN_LABELS[activePlan.plan_id]}
                                    </h4>
                                    
                                    <div className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-white/5 pt-4">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Notícias Disponíveis</span>
                                            <span className="font-display text-sm font-bold text-white">
                                                {formatNewsCount(getPlanRemainingCredit(activePlan))}
                                            </span>
                                        </div>
                                        <div className="hidden sm:block w-px h-8 bg-white/5 self-center" />
                                        <div className="flex flex-col items-center">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Uso do Ciclo</span>
                                            <span className="font-display text-sm font-bold text-emerald-400">
                                                {formatNewsCount(activePlan.used_validations)}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 flex items-center gap-2 rounded-full bg-white/5 px-4 py-1.5 border border-white/5">
                                        <Shield className="h-3 w-3 text-slate-400" />
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                                                Uso por quantidade: <span className="text-slate-200">até consumir todas as notícias do pacote</span>
                                            </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {/* Daily Plan */}
                    <div className="admin-glass-card group relative overflow-hidden border-white/5 bg-[#120c2d]/20 px-6 py-8 ring-1 ring-white/10 transition-all duration-500 hover:bg-white/[0.04] hover:ring-blue-500/20">
                        <div className="pointer-events-none absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-blue-400 to-blue-600 opacity-20 transition-opacity group-hover:opacity-100" />
                        <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-blue-500/5 blur-3xl transition-colors group-hover:bg-blue-500/10" />
                        
                        <div className="flex items-center gap-4 mb-6 relative">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 shadow-lg shadow-blue-500/5 group-hover:rotate-12 transition-transform">
                                <Zap className="h-6 w-6 text-blue-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-tech text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Plano Padrão</p>
                                <p className="font-display text-lg font-black text-white uppercase tracking-tight">Plano Básico</p>
                            </div>
                        </div>

                        <h3 className="font-display text-xl font-black text-white uppercase tracking-tight mb-2">Flexibilidade Total</h3>
                        <p className="text-xs leading-relaxed text-slate-400 font-medium mb-8 font-tech">
                            Ideal para validações pontuais. Cada compra libera 6, 10 ou 20 notícias, conforme o pacote escolhido, e segue ativa até consumir todas as notícias do pacote.
                        </p>

                        <div className="space-y-4 mb-8">
                            <div className="flex items-center gap-3 text-sm text-slate-300 font-tech">
                                <div className="h-1 w-1 rounded-full bg-blue-400/50" />
                                <span>Acesso Imediato</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-300 font-tech">
                                <div className="h-1 w-1 rounded-full bg-blue-400/50" />
                                <span>Ideal para testes</span>
                            </div>
                        </div>
                    </div>

                    {/* Weekly Plan (MOST POPULAR) */}
                    <div className="admin-glass-card group relative z-20 scale-105 overflow-hidden border-purple-500/20 bg-[#1a1438]/20 px-6 py-8 ring-2 ring-purple-500/30 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.4)] transition-all duration-500 hover:scale-[1.07]">
                        {/* Best Seller Badge */}
                        <div className="pointer-events-none absolute -top-[1px] right-8 z-30 flex h-12 w-20 flex-col items-center justify-center rounded-b-2xl border-x border-b border-purple-400/30 bg-purple-600 shadow-lg shadow-purple-500/20 transition-all group-hover:h-14">
                            <Star className="h-4 w-4 text-white fill-white mb-0.5 animate-pulse" />
                            <span className="text-[8px] font-black text-white uppercase tracking-widest font-tech">Popular</span>
                        </div>

                        <div className="pointer-events-none absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-purple-500 to-pink-500 opacity-60" />
                        <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-purple-500/10 blur-3xl" />
                        
                        <div className="flex items-center gap-4 mb-6 relative">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/20 border border-purple-500/30 shadow-lg shadow-purple-500/10 group-hover:rotate-12 transition-transform ring-1 ring-purple-400/20">
                                <Shield className="h-6 w-6 text-purple-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-tech text-[10px] font-black uppercase tracking-[0.3em] text-purple-400">Melhor Escolha</p>
                                <p className="font-display text-lg font-black text-white uppercase tracking-tight">Plano Semanal</p>
                            </div>
                        </div>

                        <h3 className="font-display text-xl font-black text-white uppercase tracking-tight mb-2">Foco Comercial</h3>
                        <p className="text-xs leading-relaxed text-slate-400 font-medium mb-8 font-tech">
                            Pacote semanal habilitado via vendedor. Cada compra libera 42, 70 ou 140 notícias e segue ativo até consumir todas as notícias do pacote.
                        </p>

                        <div className="space-y-4 mb-8">
                            <div className="flex items-center gap-3 text-sm text-slate-300 font-tech">
                                <div className="h-1 w-1 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                                <span>Uso flexível por quantidade</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-300 font-tech">
                                <div className="h-1 w-1 rounded-full bg-purple-400/50" />
                                <span>Prioridade no Vendedor</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-300 font-tech">
                                <div className="h-1 w-1 rounded-full bg-purple-400/50" />
                                <span>Taxas Otimizadas</span>
                            </div>
                        </div>
                    </div>

                    {/* Monthly Plan */}
                    <div className="admin-glass-card group relative overflow-hidden border-white/5 bg-[#120c2d]/20 px-6 py-8 ring-1 ring-white/10 transition-all duration-500 hover:bg-white/[0.04] hover:ring-cyan-500/20">
                        <div className="pointer-events-none absolute top-0 left-0 h-full w-1 bg-gradient-to-b from-cyan-400 to-emerald-600 opacity-20 transition-opacity group-hover:opacity-100" />
                        <div className="pointer-events-none absolute -top-12 -right-12 h-32 w-32 rounded-full bg-cyan-500/5 blur-3xl transition-colors group-hover:bg-cyan-500/10" />
                        
                        <div className="flex items-center gap-4 mb-6 relative">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 border border-cyan-500/20 shadow-lg shadow-cyan-500/5 group-hover:rotate-12 transition-transform">
                                <Crown className="h-6 w-6 text-cyan-400" />
                            </div>
                            <div className="min-w-0">
                                <p className="font-tech text-[10px] font-black uppercase tracking-[0.3em] text-cyan-400">Plano Elite</p>
                                <p className="font-display text-lg font-black text-white uppercase tracking-tight">Plano Mensal</p>
                            </div>
                        </div>

                        <h3 className="font-display text-xl font-black text-white uppercase tracking-tight mb-2">Máxima Performance</h3>
                        <p className="text-xs leading-relaxed text-slate-400 font-medium mb-8 font-tech">
                            Pacote mensal com 180, 300 ou 600 notícias, com consumo flexível até terminar todas as notícias liberadas.
                        </p>

                        <div className="space-y-4 mb-8">
                            <div className="flex items-center gap-3 text-sm text-slate-300 font-tech">
                                <div className="h-1 w-1 rounded-full bg-cyan-400/50 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                                <span>Uso flexível por quantidade</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-slate-300 font-tech">
                                <div className="h-1 w-1 rounded-full bg-cyan-400/50" />
                                <span>Maior Economia</span>
                            </div>
                        </div>
                    </div>
                </div>

                {canBuySellerPlans && sellerCampaignAccess?.seller_name && (
                    <section className="admin-glass-card border-emerald-500/10 px-6 py-6 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent pointer-events-none" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400 font-display">
                            Acesso Premium Ativo
                        </p>
                        <p className="mt-3 text-base leading-relaxed text-white font-display uppercase tracking-tight">
                            Você está vinculado ao vendedor <span className="text-emerald-400 font-black">{sellerCampaignAccess.seller_name}</span>
                        </p>
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500 border-t border-white/5 pt-4">
                            <span>Vínculo: <span className="text-emerald-300/60">{getSellerCampaignSourceLabel(sellerCampaignAccess.source)}</span></span>
                            <span className="hidden sm:block">•</span>
                            <span>Benefício: <span className="text-slate-300">Planos Semanais & Mensais</span></span>
                        </div>
                    </section>
                )}

                {!canBuySellerPlans && (
                    <section className="admin-glass-card overflow-hidden group relative">
                        {/* Animated background highlights */}
                        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-500/10 blur-[100px] pointer-events-none" />
                        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[100px] pointer-events-none" />
                        
                        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1.5fr_0.5fr]">
                            <div className="p-8 md:p-12 relative">
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="h-px w-8 bg-cyan-500/50" />
                                    <p className="font-display text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400">
                                        Campanha Exclusiva
                                    </p>
                                </div>
                                <h2 className="font-display text-3xl font-black leading-tight text-white uppercase tracking-[0.1em] [word-spacing:0.3em] sm:text-4xl lg:text-5xl">
                                    Libere Pacotes de <span className="text-glow-amber mx-1">Maior Volume</span>
                                </h2>
                                <p className="mt-6 text-sm leading-relaxed text-slate-400 font-medium max-w-xl italic">
                                    "A maior rentabilidade do sistema está nos planos comerciais. Mais notícias liberadas para quem opera com estratégia."
                                </p>
                                <p className="mt-4 text-sm leading-relaxed text-slate-300 font-medium max-w-xl">
                                    Envie uma solicitação para o vendedor agora e aguarde a análise do seu perfil para habilitação das novas tabelas.
                                </p>
                            </div>
                            <div className="flex items-center justify-center bg-white/[0.01] p-8 lg:p-12 border-t lg:border-t-0 lg:border-l border-white/5 relative group/btn">
                                <button
                                    type="button"
                                    onClick={() => setShowSellerContactModal(true)}
                                    className="relative flex flex-col items-center gap-5 w-full transition-transform duration-300 group-hover/btn:scale-105"
                                >
                                    <div className="relative h-20 w-20 rounded-3xl border border-cyan-400/20 bg-cyan-500/10 flex items-center justify-center shadow-[0_0_50px_rgba(34,211,238,0.1)] ring-2 ring-cyan-500/10 group-hover/btn:bg-cyan-500/20 transition-all duration-500">
                                        <div className="absolute inset-0 rounded-3xl bg-cyan-400 opacity-0 group-hover/btn:opacity-10 animate-pulse" />
                                        <MessageCircleMore className="h-10 w-10 text-cyan-400" />
                                    </div>
                                    <div className="text-center">
                                        <span className="block font-display text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-1 group-hover/btn:text-cyan-400 transition-colors">
                                            Analista VIP
                                        </span>
                                        <span className="block font-display text-xl font-black text-white uppercase tracking-tight">
                                            Falar agora
                                        </span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {[
                    {
                        key: 'daily',
                        title: 'Pacotes básicos',
                        subtitle: 'Catálogo aberto da plataforma: R$ 6, R$ 10 e R$ 20. Cada compra libera 6, 10 ou 20 notícias e segue ativa até consumir todas as notícias do pacote.',
                        items: dailyPlans
                    },
                    ...(canBuySellerPlans ? [{
                        key: 'weekly',
                        title: 'Planos semanais do vendedor',
                        subtitle: 'Pacotes comerciais semanais: R$ 42, R$ 70 e R$ 140. Cada compra libera 42, 70 ou 140 notícias e segue ativa até consumir todas as notícias do pacote.',
                        items: weeklyPlans
                    },
                    {
                        key: 'monthly',
                        title: 'Planos mensais do vendedor',
                        subtitle: 'Pacotes mensais: R$ 180, R$ 300 e R$ 600. Cada compra libera 180, 300 ou 600 notícias e segue ativa até consumir todas as notícias do pacote.',
                        items: monthlyPlans
                    }] : [])
                ].map((section) => (
                    <section key={section.key} className="space-y-4 pt-10">
                        <div className="flex flex-col gap-1 border-l-4 border-white/10 pl-5">
                            <h2 className="text-2xl font-black text-white font-display uppercase tracking-tight">{section.title}</h2>
                            <p className="text-[11px] font-medium text-slate-400 leading-relaxed max-w-2xl tracking-wide">{section.subtitle}</p>
                        </div>
                        <div className="grid grid-cols-1 gap-6 pb-4 md:grid-cols-2 xl:grid-cols-3">
                            {section.items.map((plan) => {
                                const exhausted = isPlanExhausted(activePlan);
                                const availability = availabilityMap[plan.id];
                                const locked = loadingPlans || availability.locked || (Boolean(activePlan) && !exhausted);
                                const progressPct = activePlan?.plan_id === plan.id ? getPlanProgressPercentage(activePlan) : 0;

                                return (
                                    <div
                                        key={plan.id}
                                        className={`relative rounded-3xl p-1 transition-all duration-300 
                                ${selectedPlan === plan.id ? 'ring-2 ring-white scale-[1.02] z-10' : (locked ? 'opacity-80 grayscale-[0.5]' : 'hover:scale-[1.01]')}
                                ${plan.recommended && !locked ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'bg-white/5 border border-white/10'}
                            `}
                                    >
                                        {plan.recommended && !locked && (
                                            <div className="absolute -top-3 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/20 bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
                                                Recomendado
                                            </div>
                                        )}

                                        <div className="relative flex h-full flex-col overflow-hidden rounded-[1.4rem] bg-[#150a33] p-8">
                                            <div className="relative z-10 mb-6 flex items-start justify-between">
                                                <div className="min-w-0">
                                                    <h3 className={`bg-gradient-to-r bg-clip-text text-xl font-black text-transparent font-display uppercase tracking-tight ${plan.color}`}>
                                                        {plan.name}
                                                    </h3>
                                                    <div className="mt-2 flex items-baseline gap-1.5">
                                                        <span className="text-xs font-black text-slate-500">R$</span>
                                                        <span className="text-4xl font-black text-white font-display leading-[0.8]">{plan.price.toFixed(0)}</span>
                                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">
                                                            / pacote
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={`rounded-2xl border border-white/5 bg-white/5 p-4 shadow-xl ring-1 ring-white/10`}>
                                                    <plan.icon className={`h-6 w-6 text-white/90`} />
                                                </div>
                                            </div>

                                            <div className="relative z-10 mb-6 h-px w-full bg-gradient-to-r from-white/10 via-white/5 to-transparent" />

                                            <ul className="relative z-10 mb-8 flex-1 space-y-4">
                                                {plan.features.map((feature, idx) => (
                                                    <li key={idx} className="flex items-start gap-3">
                                                        <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                                            <Check className="h-2.5 w-2.5 text-emerald-400" />
                                                        </div>
                                                        <span className="text-[13px] font-medium leading-relaxed text-slate-300">
                                                            {feature}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>

                                            {activePlan?.plan_id === plan.id && (
                                                <div className="relative z-10 mb-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                                    <div className="flex items-center justify-between gap-3 text-[11px] font-bold text-slate-300">
                                                        <span>Notícias restantes</span>
                                                        <span className="text-white">
                                                            {formatNewsCount(getPlanRemainingCredit(activePlan))}
                                                        </span>
                                                    </div>
                                                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 transition-all"
                                                            style={{ width: `${progressPct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            )}

                                            <button
                                                onClick={() => handleSelectPlan(plan.id)}
                                                disabled={loading || locked}
                                                className={`relative z-30 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-xs font-bold tracking-wide transition-all active:scale-95
                                        ${locked
                                                        ? 'cursor-not-allowed border border-white/5 bg-white/10 text-slate-500'
                                                        : (plan.recommended ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg hover:shadow-purple-500/25 text-white' : 'bg-white text-[#0F0529] hover:bg-slate-200')
                                                    }
                                    `}
                                            >
                                                {loading && selectedPlan === plan.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        {getButtonText(plan.id, locked)}
                                                        {!locked && <ArrowRight className="h-4 w-4" />}
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))}

                {/* Footer Note */}
                <div className="px-4 pb-4 text-center">
                    <p className="mx-auto max-w-2xl text-[10px] leading-relaxed text-slate-500">
                        * Cada plano libera uma quantidade total de notícias para validar. Cada notícia validada consome 1 unidade do pacote.
                        <br />Quando as notícias acabarem, você pode comprar outro plano do catálogo disponível para o seu perfil.
                        <br />Pagamento seguro via PIX - Mercado Pago
                    </p>
                </div>
            </div>

            {/* PIX Payment Modal */}
            {pixPlanId && (
                <PixPaymentModal
                    isOpen={showPixModal}
                    onClose={handlePixModalClose}
                    planId={pixPlanId}
                    planName={PLANS_CONFIG[pixPlanId].name}
                    planPrice={PLANS_CONFIG[pixPlanId].price}
                    onPaymentApproved={handlePaymentApproved}
                />
            )}

            <SellerContactModal
                isOpen={showSellerContactModal}
                onClose={() => setShowSellerContactModal(false)}
                onSubmitted={handleSellerContactSent}
            />
        </AppLayout>
    );
};

export default Plans;
