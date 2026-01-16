import { useState, useEffect } from 'react';
import {
    Users,
    Trophy,
    Wallet,
    BarChart2,
    Copy,
    CheckCircle,
    Medal,
    Home,
    User,
    ShieldCheck,
    Loader2,
    Briefcase
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface UserProfile {
    name: string;
    lastname: string;
    current_balance: number;
    reputation_score: number;
    city: string;
    state: string;
    affiliate_code: string;
}

interface NewsTask {
    id: string;
    content: {
        title: string;
        description: string;
        reward: number;
        category: string;
        source: string;
        difficulty: string;
    };
    created_at: string;
}

const Dashboard = () => {
    const navigate = useNavigate();
    const [selectedTab, setSelectedTab] = useState<'cidade' | 'estado' | 'brasil'>('cidade');
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [tasks, setTasks] = useState<NewsTask[]>([]);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                // 1. Get Current User
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    navigate('/login');
                    return;
                }

                // 2. Fetch Profile
                const { data: profileData, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profileError) throw profileError;
                setProfile(profileData);

                // 3. Fetch Tasks (Pending Validations)
                // In a real app, we would filter tasks not yet validated by this user.
                const { data: tasksData, error: tasksError } = await supabase
                    .from('news_tasks')
                    .select('*')
                    .limit(5)
                    .order('created_at', { ascending: false });

                if (tasksError) throw tasksError;
                setTasks(tasksData || []);

            } catch (error) {
                console.error('Error loading dashboard:', error);
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, [navigate]);

    // Helpers
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0F0529] flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-brand-dark text-white font-sans pb-24">
            {/* Navbar */}
            <div className="flex justify-between items-center p-6 lg:px-8 bg-brand-dark/50 backdrop-blur-md sticky top-0 z-50 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="font-bold text-white text-sm">✓</span>
                    </div>
                    <span className="font-bold text-lg tracking-tight">FatoPago</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Bem-vindo</p>
                        <p className="text-sm font-bold">{profile?.name} {profile?.lastname}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full border-2 border-green-500/50 overflow-hidden bg-purple-900 flex items-center justify-center">
                        <span className="font-bold text-xs">{profile?.name?.charAt(0)}{profile?.lastname?.charAt(0)}</span>
                    </div>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 mt-6 space-y-6">

                {/* Balance Card - The Purple Glow Card */}
                <div className="bg-gradient-to-br from-[#8a2ce2] to-[#6a1b9a] rounded-3xl p-6 shadow-[0_0_40px_-10px_rgba(138,44,226,0.5)] relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-[10px] font-bold text-purple-200 uppercase tracking-widest mb-1">Saldo Disponível</p>
                                <h2 className="text-4xl font-extrabold text-white">{formatCurrency(profile?.current_balance || 0)}</h2>
                            </div>
                            <button className="bg-white text-purple-900 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-transform">
                                Sacar Saldo <Wallet className="w-3 h-3" />
                            </button>
                        </div>

                        <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg mb-6 backdrop-blur-sm border border-white/10">
                            <ShieldCheck className="w-3 h-3 text-purple-200" />
                            <span className="text-[10px] font-bold text-white">Nível: {profile?.reputation_score ? (profile.reputation_score > 500 ? 'Diamante' : (profile.reputation_score > 100 ? 'Ouro' : 'Iniciante')) : 'Iniciante'}</span>
                        </div>

                        <div>
                            <div className="flex justify-between text-[10px] font-bold text-purple-200 mb-2">
                                <span>Progresso para Próximo Nível</span>
                                <span className="text-white">{(profile?.reputation_score || 0) % 100}%</span>
                            </div>
                            <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ width: `${(profile?.reputation_score || 0) % 100}%` }} />
                            </div>
                        </div>
                    </div>

                    {/* Decorative Circles */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -ml-5 -mb-5" />
                </div>

                {/* Available Tasks List (NEW) */}
                <div>
                    <div className="flex items-center gap-2 mb-4">
                        <Briefcase className="w-5 h-5 text-purple-400" />
                        <h3 className="font-bold text-lg">Tarefas Disponíveis</h3>
                    </div>

                    <div className="space-y-3">
                        {tasks.length === 0 ? (
                            <div className="bg-[#1A1040] p-6 rounded-2xl border border-white/5 text-center">
                                <p className="text-slate-400 text-sm">Nenhuma tarefa disponível no momento.</p>
                            </div>
                        ) : (
                            tasks.map(task => (
                                <div key={task.id} className="bg-[#1A1040] p-4 rounded-2xl flex items-center justify-between border border-white/5 hover:border-purple-500/50 transition-colors group cursor-pointer">
                                    <div className="flex-1 mr-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${task.content.difficulty === 'easy' ? 'bg-green-500/20 text-green-400' : (task.content.difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400')}`}>
                                                {task.content.difficulty === 'easy' ? 'Fácil' : (task.content.difficulty === 'medium' ? 'Médio' : 'Difícil')}
                                            </span>
                                            <span className="text-[9px] text-slate-500 uppercase font-bold">{task.content.category}</span>
                                        </div>
                                        <h4 className="font-bold text-sm text-white leading-snug group-hover:text-purple-300 transition-colors">{task.content.title}</h4>
                                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">{task.content.description}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className="text-sm font-extrabold text-[#00E676]">{formatCurrency(task.content.reward)}</span>
                                        <button className="bg-purple-600 hover:bg-purple-500 text-white p-2 rounded-lg transition-colors">
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Performance Stats */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-slate-400" />
                        <h3 className="font-bold text-lg">Seu Desempenho</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#1A1040] p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                                <CheckCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-white leading-none">100%</h4>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Precisão</p>
                            </div>
                        </div>

                        <div className="bg-[#1A1040] p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                                <Trophy className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-white leading-none">{profile?.reputation_score || 0}</h4>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Pontos XP</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Referral Program */}
                <div className="bg-[#1A1040] rounded-3xl p-5 border border-white/5 relative overflow-hidden">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                            <Users className="w-6 h-6 text-purple-300" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm">Programa de Indicação</h3>
                            <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">Ganhe <span className="text-purple-300 font-bold">R$ 10,00</span> por cada novo validador convidado.</p>
                        </div>
                        <button className="ml-auto bg-gradient-to-r from-[#BB86FC] to-[#8a2ce2] text-white text-[10px] font-bold px-4 py-2 rounded-lg shadow-lg hover:opacity-90 transition-opacity">
                            CONVIDAR
                        </button>
                    </div>
                </div>

                {/* Link Copy Section */}
                <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">Seu Link Exclusivo</p>
                    <div className="bg-[#1A1040] p-2 rounded-xl border border-white/5 flex items-center justify-between pl-4">
                        <span className="text-xs text-slate-300 font-mono truncate mr-2">fatopago.com/convite/{profile?.affiliate_code || 'gerar'}</span>
                        <button className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 px-4 py-2 rounded-lg text-[10px] font-bold flex items-center gap-2 transition-colors">
                            COPIAR <Copy className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                {/* Info Footer will follow same pattern */}
                <div className="pb-8"></div>
            </div>

            {/* Bottom Nav */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#0F0826] border-t border-white/5 px-6 py-4 flex justify-between items-end z-50 lg:hidden">
                <button className="flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors group">
                    <Home className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                    <span className="text-[9px] font-bold">INÍCIO</span>
                </button>
                <div className="relative -top-5">
                    <button className="w-14 h-14 bg-[#8a2ce2] rounded-2xl flex flex-col items-center justify-center shadow-[0_0_20px_rgba(138,44,226,0.5)] border-4 border-[#0F0826] hover:scale-105 transition-transform">
                        <CheckCircle className="w-6 h-6 text-white fill-current" />
                    </button>
                    <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-purple-300">VALIDAR</span>
                </div>
                <button className="flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors group">
                    <User className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                    <span className="text-[9px] font-bold">PERFIL</span>
                </button>
            </div>
        </div>
    );
};

// Missing Icon Component
function ArrowRight({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
    )
}

export default Dashboard;
