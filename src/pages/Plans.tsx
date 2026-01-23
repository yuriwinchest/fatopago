
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Crown, Shield, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AppHeader from '../components/AppHeader';

// Main Component
const Plans = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

    // Logic: 
    // - Check LocalStorage for 'fatopago_plan_status'
    // - Format: { lastPlan: 'starter' | 'pro' | 'expert' | null, date: 'ISOString' }
    // - If no history, ALL unlocked? Or Start with Starter? Assuming user can start anywhere or start with Starter. 
    //   "Se ele escolheu um ciclo de 5" implies he starts low. Let's assume he must start with Starter or we allow any choice initially?
    //   Rules say: "If he chose 5... next is 10... then 15... then back to 5".
    //   Implies sequential progression. I will LOCK higher tiers if previous not bought? No, usually upsell is allowed.
    //   The rule says "If he wants to buy AGAIN, he has to go up".
    //   Interpretation: You can't buy the SAME plan twice in a row (or within 24h). You must upgrade OR wait.

    // Let's implement dynamic disabled state.

    const [planStatus, setPlanStatus] = useState<{ lastPlan: string | null, date: string | null } | null>(() => {
        const stored = localStorage.getItem('fatopago_plan_status');
        return stored ? JSON.parse(stored) : null;
    });

    const isPlanLocked = (planId: string) => {
        if (!planStatus) return false; // First time, everything open

        const lastPlan = planStatus.lastPlan;
        const lastDate = new Date(planStatus.date || '');
        const now = new Date();
        const hoursDiff = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);

        // Reset cycle if > 24h?
        if (hoursDiff > 24) return false;

        // "If he chose 5... next is 10"
        // Meaning: If last was starter, starter is LOCKED (unless > 24h), Pro is OPEN.
        // If last was Pro, Pro is LOCKED, Expert is OPEN.
        // If last was Expert, Expert is LOCKED, Starter is OPEN (Cycle reset).

        if (lastPlan === 'starter') {
            if (planId === 'starter') return true; // Block same
            // Allow others
        }
        if (lastPlan === 'pro') {
            if (planId === 'starter') return true; // Can't go down immediately? "Next is 10... then 15". Usually you can go UP.
            if (planId === 'pro') return true; // Block same
        }
        if (lastPlan === 'expert') {
            // "When he gets to 15, then he goes back to 5"
            // Meaning 15 (expert) is locked, but 5 (starter) is UNLOCKED.
            // Pro should be locked? Or just enforce the cycle order?
            // Let's force the specific cycle: Starter -> Pro -> Expert -> Starter
            if (planId === 'expert') return true;
            if (planId === 'pro') return true; // Force restart at Starter? "He goes back to 5".
        }

        return false;
    };

    const getButtonText = (planId: string, locked: boolean) => {
        if (loading && selectedPlan === planId) return "PROCESSANDO...";
        if (locked) {
            // Check why locked
            if (planStatus?.lastPlan === planId) return "INDISPONÍVEL (AGUARDE 24H)";
            if (planStatus?.lastPlan === 'expert' && planId !== 'starter') return "REINICIE O CICLO NO INICIANTE";
            return "BLOQUEADO";
        }
        return "COMEÇAR AGORA";
    };

    const plans = [
        {
            id: 'starter',
            name: 'Iniciante',
            price: 5.00,
            color: 'from-blue-400 to-blue-600',
            icon: Shield,
            features: [
                'Acesso a 5 validações (Ciclo Rápido)',
                'Ganhos de até R$ 25,00/ciclo',
                'Suporte Básico',
                'Ideal para começar'
            ]
        },
        {
            id: 'pro',
            name: 'Profissional',
            price: 10.00,
            recommended: true,
            color: 'from-purple-400 to-purple-600',
            icon: Zap,
            features: [
                'Acesso a 10 validações (Ciclo Pro)',
                'Ganhos de até R$ 50,00/ciclo',
                'Multiplicador de XP 1.5x',
                'Saques Prioritários'
            ]
        },
        {
            id: 'expert',
            name: 'Especialista',
            price: 15.00,
            color: 'from-amber-400 to-amber-600',
            icon: Crown,
            features: [
                'Acesso a 15 validações (Ciclo Max)',
                'Ganhos de até R$ 75,00/ciclo',
                'Multiplicador de XP 2x',
                'Saques Imediatos (PIX)'
            ]
        }
    ];

    const handleSelectPlan = async (planId: string) => {
        if (isPlanLocked(planId)) return;

        setSelectedPlan(planId);
        setLoading(true);

        try {
            // Get current user
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;

            if (!user) {
                navigate('/login');
                return;
            }

            // SIMULATION: Update user plan in simulate DB or create fake transaction
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Save Plan Status
            const newStatus = {
                lastPlan: planId,
                date: new Date().toISOString()
            };
            localStorage.setItem('fatopago_plan_status', JSON.stringify(newStatus));
            setPlanStatus(newStatus); // Update state

            navigate('/dashboard');

        } catch (error) {
            console.error('Error selecting plan:', error);
        } finally {
            setLoading(false);
            setSelectedPlan(null); // Reset selection
        }
    };

    return (
        <div className="min-h-screen bg-[#0F0529] font-sans text-white overflow-y-auto pb-safe-area-bottom">
            {/* Header with Logo */}
            <AppHeader
                title="Escolha seu Plano"
                subtitle="Complete os ciclos de validação para desbloquear novos níveis de ganho."
            />

            {/* Status Indicator */}
            {planStatus && (
                <div className="text-center -mt-4 mb-4 relative z-20">
                    <div className="inline-block bg-white/10 px-4 py-1 rounded-full border border-white/5">
                        <p className="text-xs text-purple-200">
                            Último ciclo: <span className="font-bold text-white uppercase">{planStatus.lastPlan}</span> ({new Date(planStatus.date || '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                        </p>
                    </div>
                </div>
            )}

            {/* Plans Grid */}
            <div className="px-6 pb-12 flex flex-col gap-6 max-w-lg mx-auto">
                {plans.map((plan) => {
                    const locked = isPlanLocked(plan.id);

                    return (
                        <div
                            key={plan.id}
                            className={`relative rounded-3xl p-1 transition-all duration-300 
                                ${selectedPlan === plan.id ? 'ring-2 ring-white scale-105 z-10' : (locked ? 'opacity-80 grayscale-[0.5]' : 'hover:scale-[1.02]')}
                                ${plan.recommended && !locked ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'bg-white/5 border border-white/10'}
                            `}
                        >
                            {plan.recommended && !locked && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-bold px-3 py-1 rounded-full border border-white/20 shadow-lg">
                                    RECOMENDADO
                                </div>
                            )}

                            <div className="bg-[#150a33] rounded-[1.4rem] p-6 h-full flex flex-col relative overflow-hidden">
                                {locked && (
                                    <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center p-4">
                                        {/* Lock Icon overlay if desired, but button text explains it */}
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
                                            <div className="mt-0.5 p-0.5 rounded-full bg-green-500/20">
                                                <Check className="w-3 h-3 text-green-400" />
                                            </div>
                                            {feature}
                                        </li>
                                    ))}
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
            <div className="text-center px-6 pb-8">
                <p className="text-xs text-slate-500">
                    * Os valores são referentes a um ciclo de acesso.
                    <br />Complete o ciclo para desbloquear o próximo nível.
                </p>
            </div>
        </div>
    );
};

export default Plans;
