import { useState } from 'react';
import { Users, Trophy, Wallet, Copy, CheckCircle, Loader2, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NewsTask } from '../types';
import ValidationModal from '../components/ValidationModal';
import { NewsCarousel } from '../components/NewsCarousel';
import { AppLayout } from '../layouts/AppLayout';
import { useDashboard } from '../hooks/useDashboard';
import { VALIDATION_UNIT_VALUE } from '../lib/planRules';
import { getPlanAccessForCurrentUser } from '../lib/planService';

const Dashboard = () => {
    const navigate = useNavigate();
    const { profile, tasks, setTasks, loading, activePlan } = useDashboard();

    const [selectedTask, setSelectedTask] = useState<NewsTask | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [planNotice, setPlanNotice] = useState<string | null>(null);
    const [checkingPlan, setCheckingPlan] = useState(false);

    const handleOpenValidation = async (task: NewsTask) => {
        if (checkingPlan) return;
        setCheckingPlan(true);
        setPlanNotice(null);

        const access = await getPlanAccessForCurrentUser();
        if (access.status === 'ok') {
            setSelectedTask(task);
            setIsModalOpen(true);
            setCheckingPlan(false);
            return;
        }

        if (access.status === 'no-session') {
            navigate('/login');
            setCheckingPlan(false);
            return;
        }

        if (access.status === 'no-plan' || access.status === 'exhausted') {
            setPlanNotice('Você não tem saldo para validar. Escolha um plano para continuar.');
            navigate('/plans?reason=no-balance&returnTo=/dashboard');
            setCheckingPlan(false);
            return;
        }

        setPlanNotice(access.status === 'error' ? access.message : 'Não foi possível verificar seu plano.');
        setCheckingPlan(false);
        return;
    };

    const handleValidationComplete = () => {
        if (selectedTask) {
            setTasks(prev => prev.filter(t => t.id !== selectedTask.id));
        }
        setIsModalOpen(false);
        setSelectedTask(null);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        alert("Link copiado!");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0F0529] flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    const reputationScore = profile?.reputation_score || 0;
    const reputationLevel = reputationScore > 500 ? 'Diamante' : (reputationScore > 100 ? 'Ouro' : 'Bronze');
    const reputationPercent = reputationScore % 100;
    const remainingValidations = activePlan ? Math.max(activePlan.max_validations - activePlan.used_validations, 0) : 0;
    const cycleBalance = remainingValidations * VALIDATION_UNIT_VALUE;
    const cycleTotal = activePlan ? activePlan.max_validations * VALIDATION_UNIT_VALUE : 0;
    const cycleUsed = Math.max(cycleTotal - cycleBalance, 0);
    const cyclePercent = cycleTotal > 0 ? Math.min((cycleBalance / cycleTotal) * 100, 100) : 0;

    return (
        <AppLayout
            title="Central de Validação"
            subtitle="Sua jornada contra a desinformação"
            showLogout={true}
        >
            <div className="space-y-8">
                {planNotice && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-xs rounded-2xl px-4 py-3">
                        {planNotice}
                    </div>
                )}
                {/* Balance Card */}
                <div
                    className="group bg-gradient-to-br from-[#6D28D9] to-[#4C1D95] rounded-[32px] p-8 relative overflow-hidden shadow-2xl border border-white/10 cursor-pointer hover:scale-[1.02] transition-all"
                    onClick={() => navigate('/financeiro')}
                >
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-purple-200 uppercase tracking-widest">Saldo Disponível</p>
                                <h2 className="text-4xl font-black text-white">{formatCurrency(profile?.current_balance || 0)}</h2>
                            </div>
                            <button className="bg-white text-purple-900 px-5 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-lg">
                                Sacar <Wallet className="w-3 h-3 ml-2 inline" />
                            </button>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-3">
                            <div className="flex items-center justify-between text-[10px] font-bold text-white uppercase">
                                <span>Saldo do Ciclo</span>
                                <span className="text-green-200">{formatCurrency(cycleBalance)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-bold text-purple-100 uppercase">
                                <span>Validações Restantes</span>
                                <span>{remainingValidations}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-200 uppercase">
                                <span>Consumo do Ciclo</span>
                                <span>{formatCurrency(cycleUsed)} / {formatCurrency(cycleTotal)}</span>
                            </div>
                            <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                                <div className="h-full bg-green-300 rounded-full transition-all" style={{ width: `${cyclePercent}%` }} />
                            </div>
                            <div className="flex justify-between items-center mb-2 text-[10px] font-bold text-white uppercase">
                                <span>🏆 Nível: {reputationLevel}</span>
                                <span>{reputationPercent}%</span>
                            </div>
                            <div className="h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white rounded-full" style={{ width: `${reputationPercent}%` }} />
                            </div>
                        </div>
                    </div>
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 blur-[80px] rounded-full" />
                </div>

                {/* News Section (Hub) */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-purple-400" />
                            <h3 className="font-bold text-lg">Notícias para Validar</h3>
                        </div>
                    </div>

                    <NewsCarousel
                        tasks={tasks}
                        onValidate={handleOpenValidation}
                        autoPlay={true}
                        interval={3000}
                    />
                </div>

                {/* Performance */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#1A1040] p-5 rounded-[28px] border border-white/5 flex flex-col gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-green-500/10 flex items-center justify-center">
                            <CheckCircle className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-white">100%</p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Precisão</p>
                        </div>
                    </div>
                    <div className="bg-[#1A1040] p-5 rounded-[28px] border border-white/5 flex flex-col gap-3 cursor-pointer" onClick={() => navigate('/ranking')}>
                        <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                            <Trophy className="w-5 h-5 text-purple-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-black text-white">{reputationScore}</p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Ranking XP</p>
                        </div>
                    </div>
                </div>

                {/* Referral */}
                <div className="bg-gradient-to-r from-[#1A1040] to-transparent p-5 rounded-[32px] border border-white/5 flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                            <Users className="w-6 h-6 text-purple-300" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-bold text-white">Indique e Ganhe</p>
                            <p className="text-[10px] text-slate-400">R$ 10,00 por indicação</p>
                        </div>
                        <button className="bg-purple-600 px-4 py-2 rounded-xl text-[10px] font-bold">CONVIDAR</button>
                    </div>
                    <div className="bg-black/20 p-2 rounded-xl flex items-center justify-between pl-4">
                        <span className="text-[10px] font-mono text-slate-500 truncate mr-2">fatopago.com/convite/{profile?.affiliate_code}</span>
                        <button onClick={() => copyToClipboard(`fatopago.com/convite/${profile?.affiliate_code}`)} className="bg-white/5 px-4 py-2 rounded-lg text-[9px] font-black uppercase flex items-center gap-2">
                            COPIAR <Copy className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>

            {selectedTask && (
                <ValidationModal
                    task={selectedTask}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onValidated={handleValidationComplete}
                />
            )}
        </AppLayout>
    );
};

export default Dashboard;
