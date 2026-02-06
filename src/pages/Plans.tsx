
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Zap, Crown, Shield, ArrowRight, Loader2 } from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { PlanId, PLANS_CONFIG, getPlanAvailability, PLAN_LABELS } from '../lib/planRules';
import { createPlanPurchase, fetchActivePlan, fetchPlanHistory, getCurrentUserId, PlanPurchase } from '../lib/planService';
import { PaymentModal } from '../components/PaymentModal';

// Main Component
const Plans = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
    const [planHistory, setPlanHistory] = useState<PlanPurchase[]>([]);
    const [activePlan, setActivePlan] = useState<PlanPurchase | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

    const returnTo = searchParams.get('returnTo') || '/dashboard';
    const reason = searchParams.get('reason');

    useEffect(() => {
        if (!reason) return;
        if (reason === 'no-balance') {
            setNotice('Você não tem saldo para validar. Escolha um plano para continuar.');
        }
    }, [reason]);

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

                setActivePlan(active);
                setPlanHistory(history);
            } catch (error) {
                console.error('Erro ao carregar planos:', error);
                setNotice('Não foi possível carregar seus planos agora.');
            } finally {
                setLoadingPlans(false);
            }
        };

        loadPlans();
    }, [navigate]);

    const availabilityMap = useMemo(() => {
        const map: Record<PlanId, ReturnType<typeof getPlanAvailability>> = {
            starter: getPlanAvailability('starter', planHistory),
            pro: getPlanAvailability('pro', planHistory),
            expert: getPlanAvailability('expert', planHistory)
        };
        return map;
    }, [planHistory]);

    const getButtonText = (planId: PlanId, locked: boolean) => {
        if (loading && selectedPlan === planId) return 'PROCESSANDO...';
        if (activePlan?.plan_id === planId) return 'PLANO ATIVO';
        if (activePlan) return 'PLANO EM ANDAMENTO';
        if (locked) return availabilityMap[planId].reason || 'BLOQUEADO';
        return 'COMEÇAR AGORA';
    };

    const plans: Array<{
        id: PlanId;
        name: string;
        price: number;
        color: string;
        icon: typeof Shield;
        recommended?: boolean;
        maxValidations: number;
        features: string[];
    }> = [
            {
                id: 'starter',
                name: PLANS_CONFIG.starter.name,
                price: PLANS_CONFIG.starter.price,
                color: 'from-blue-400 to-blue-600',
                icon: Shield,
                maxValidations: PLANS_CONFIG.starter.maxValidations,
                features: [
                    '10 notícias validadas por pacote',
                    '20% de comissão por indicação por cada pacote'
                ]
            },
            {
                id: 'pro',
                name: PLANS_CONFIG.pro.name,
                price: PLANS_CONFIG.pro.price,
                recommended: true,
                color: 'from-purple-400 to-purple-600',
                icon: Zap,
                maxValidations: PLANS_CONFIG.pro.maxValidations,
                features: [
                    '20 notícias validadas por pacote',
                    '20% de comissão por indicação por cada pacote'
                ]
            },
            {
                id: 'expert',
                name: PLANS_CONFIG.expert.name,
                price: PLANS_CONFIG.expert.price,
                color: 'from-amber-400 to-amber-600',
                icon: Crown,
                maxValidations: PLANS_CONFIG.expert.maxValidations,
                features: [
                    '40 notícias validadas por pacote',
                    '20% de comissão por indicação por cada pacote'
                ]
            }
        ];

    const handleSelectPlan = async (planId: PlanId) => {
        setNotice(null);
        if (activePlan) {
            setNotice('Você já possui um plano ativo. Finalize-o para escolher outro.');
            return;
        }

        const availability = availabilityMap[planId];
        if (availability.locked) {
            setNotice(availability.reason || 'Plano indisponível no momento.');
            return;
        }

        setSelectedPlan(planId);
        setIsPaymentModalOpen(true);
        // Temporariamente desabilitado - aguardando integração Stripe
        // handlePaymentSuccess();
    };

    const handlePaymentSuccess = async () => {
        if (!selectedPlan) return;

        setLoading(true);
        setIsPaymentModalOpen(false);

        try {
            const userId = await getCurrentUserId();
            if (!userId) {
                navigate('/login');
                return;
            }

            const newPlan = await createPlanPurchase(userId, selectedPlan);
            setActivePlan(newPlan);
            setPlanHistory((prev) => [newPlan, ...prev]);
            navigate(returnTo);

        } catch (error) {
            console.error('Error activating plan:', error);
            setNotice('Pagamento confirmado, mas houve erro ao ativar o plano. Contate o suporte.');
        } finally {
            setLoading(false);
            setSelectedPlan(null);
        }
    };

    return (
        <AppLayout
            title="Escolha seu Plano"
            subtitle="Complete os ciclos de validação para desbloquear novos níveis de ganho."
            showBackButton={true}
        >
            {/* Status Indicator */}
            {notice && (
                <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-2xl px-4 py-3 animate-in fade-in slide-in-from-top-2">
                    {notice}
                </div>
            )}

            {activePlan && (
                <div className="text-center mb-6 relative z-20">
                    <div className="inline-block bg-white/10 px-4 py-1.5 rounded-full border border-white/5 backdrop-blur-md">
                        <p className="text-xs text-purple-200">
                            Plano ativo: <span className="font-bold text-white uppercase ml-1">{PLAN_LABELS[activePlan.plan_id]}</span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">({activePlan.used_validations}/{activePlan.max_validations} validações utilizadas)</span>
                        </p>
                    </div>
                </div>
            )}

            {/* Plans Grid */}
            <div className="flex flex-col gap-6 pb-8">
                {plans.map((plan) => {
                    const availability = availabilityMap[plan.id];
                    const locked = loadingPlans || availability.locked || Boolean(activePlan);

                    return (
                        <div
                            key={plan.id}
                            className={`relative rounded-3xl p-1 transition-all duration-300 
                                ${selectedPlan === plan.id ? 'ring-2 ring-white scale-[1.02] z-10' : (locked ? 'opacity-80 grayscale-[0.5]' : 'hover:scale-[1.01]')}
                                ${plan.recommended && !locked ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'bg-white/5 border border-white/10'}
                            `}
                        >
                            {plan.recommended && !locked && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/20 shadow-lg z-30 uppercase tracking-wide">
                                    Recomendado
                                </div>
                            )}

                            <div className="bg-[#150a33] rounded-[1.4rem] p-6 h-full flex flex-col relative overflow-hidden">
                                {locked && (
                                    <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center p-4">
                                        {/* Overlay content if needed */}
                                    </div>
                                )}

                                {/* Card Header */}
                                <div className="flex justify-between items-start mb-4 relative z-10">
                                    <div>
                                        <h3 className={`text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r ${plan.color}`}>
                                            {plan.name}
                                        </h3>
                                        <div className="flex items-baseline gap-1 mt-1">
                                            <span className="text-sm text-slate-400">R$</span>
                                            <span className="text-3xl font-bold text-white">{plan.price.toFixed(2).replace('.', ',')}</span>
                                            <span className="text-xs text-slate-500">/ciclo</span>
                                        </div>
                                    </div>
                                    <div className={`p-3 rounded-xl bg-gradient-to-br ${plan.color} bg-opacity-20`}>
                                        <plan.icon className="w-6 h-6 text-white" />
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-px w-full bg-white/5 mb-4 relative z-10" />

                                {/* Features */}
                                <ul className="space-y-3 mb-8 flex-1 relative z-10">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-sm text-slate-300">
                                            <div className="mt-0.5 p-0.5 rounded-full bg-green-500/20 shrink-0">
                                                <Check className="w-3 h-3 text-green-400" />
                                            </div>
                                            <span className="leading-tight">{feature}</span>
                                        </li>
                                    ))}
                                    <li className="flex items-start gap-3 text-sm text-slate-300">
                                        <div className="mt-0.5 p-0.5 rounded-full bg-green-500/20 shrink-0">
                                            <Check className="w-3 h-3 text-green-400" />
                                        </div>
                                        <span className="leading-tight">{plan.maxValidations} validações por ciclo</span>
                                    </li>
                                </ul>

                                {/* Action Button */}
                                <button
                                    onClick={() => handleSelectPlan(plan.id)}
                                    disabled={loading || locked}
                                    className={`w-full py-3.5 rounded-xl font-bold text-xs tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2 relative z-30
                                        ${locked
                                            ? 'bg-white/10 text-slate-500 cursor-not-allowed border border-white/5'
                                            : (plan.recommended ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:shadow-lg hover:shadow-purple-500/25 text-white' : 'bg-white text-[#0F0529] hover:bg-slate-200')
                                        }
                                    `}
                                >
                                    {loading && selectedPlan === plan.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            {getButtonText(plan.id, locked)}
                                            {!locked && <ArrowRight className="w-4 h-4" />}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Note */}
            <div className="text-center px-4 pb-4">
                <p className="text-[10px] text-slate-500 leading-relaxed font-bold">
                    * ATENÇÃO: Os créditos de validação NÃO ACUMULAM.
                    <br />Qualquer saldo restante expira automaticamente ao final do ciclo atual ({PLANS_CONFIG.starter.maxValidations}h duração média).
                </p>
            </div>

            {/* Temporariamente desabilitado - aguardando integração Stripe */}
            {selectedPlan && (
                <PaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => setIsPaymentModalOpen(false)}
                    planId={selectedPlan}
                    onSuccess={handlePaymentSuccess}
                    amount={plans.find(p => p.id === selectedPlan)?.price || 0}
                />
            )}
        </AppLayout>
    );
};

export default Plans;
