import { useState, useEffect } from 'react';
import {
    Users,
    Trophy,
    Wallet,
    BarChart2,
    Copy,
    CheckCircle,
    Home,
    User,
    ShieldCheck,
    Loader2,
    Briefcase
} from 'lucide-react';
// ... imports
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { UserProfile, NewsTask } from '../types';

// Interfaces moved to ../types/index.ts

import ValidationModal from '../components/ValidationModal';
import { MOCK_NEWS } from '../data/mockNews';
import { NewsCarousel } from '../components/NewsCarousel';

const withTimeout = (promise: Promise<any>, ms: number, message: string): Promise<any> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    }) as Promise<any>;
};

const Dashboard = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [tasks, setTasks] = useState<NewsTask[]>([]);

    // Carousel State
    const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

    // Modal State
    const [selectedTask, setSelectedTask] = useState<NewsTask | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const loadDashboard = async () => {
        setLoadError(null);
        try {
            // 1. Get Current User
            const { data: { session }, error: sessionError } = await withTimeout(
                supabase.auth.getSession(),
                8000,
                'Tempo excedido ao validar sessão. Tente novamente.'
            );

            if (sessionError) {
                throw sessionError;
            }

            const user = session?.user;
            if (!user) {
                navigate('/login');
                return;
            }

            // 2. Fetch Profile
            const metadata = user.user_metadata as Record<string, unknown> | null | undefined;
            const fallbackProfile: UserProfile = {
                name: (metadata?.name as string) || '',
                lastname: (metadata?.lastname as string) || '',
                current_balance: 0,
                reputation_score: 0,
                city: '',
                state: '',
                affiliate_code: ''
            };

            const { data: profileData, error: profileError } = await withTimeout(
                supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single(),
                12000,
                'Tempo excedido ao carregar perfil. Tente novamente.'
            );

            if (profileError) {
                setProfile(fallbackProfile);
                setLoadError('Perfil indisponível no momento. Mostrando dados básicos.');
            } else {
                setProfile(profileData || fallbackProfile);
            }

            // 3. Fetch Tasks (Pending Validations)
            // Fetch validations by this user first
            const { data: validations, error: validationsError } = await withTimeout(
                supabase
                    .from('validations')
                    .select('task_id')
                    .eq('user_id', user.id),
                12000,
                'Tempo excedido ao carregar validações. Tente novamente.'
            );

            const validatedTaskIds: string[] = validationsError ? [] : (validations?.map((v: any) => v.task_id) || []);

            const { data: tasksData, error: tasksError } = await withTimeout(
                supabase
                    .from('news_tasks')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50),
                12000,
                'Tempo excedido ao carregar notícias. Tente novamente.'
            );

            if (validationsError) {
                setLoadError('Validações indisponíveis. Mostrando notícias sem filtro.');
            }

            const baseTasks = tasksError ? [] : ((tasksData || []) as NewsTask[]);
            let finalTasks = baseTasks.filter((t) => !validatedTaskIds.includes(t.id));

            if (tasksError) {
                setLoadError('Notícias indisponíveis no momento. Mostrando conteúdo de exemplo.');
                finalTasks = MOCK_NEWS;
            } else if (finalTasks.length === 0) {
                finalTasks = MOCK_NEWS;
            }

            setTasks(finalTasks);

            // If current index is out of bounds after refresh, reset it
            if (currentTaskIndex >= finalTasks.length) {
                setCurrentTaskIndex(0);
            }

        } catch (error) {
            console.error('Error loading dashboard:', error);
            setLoadError((error as any)?.message || 'Falha ao carregar. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, [navigate]);

    // Swipe State using Refs - REMOVED (Moved to NewsCarousel)

    // Min swipe distance (px) - REMOVED

    const handleOpenValidation = (task: NewsTask) => {
        setSelectedTask(task);
        setIsModalOpen(true);
    };

    const handleValidationComplete = () => {
        // Create an optimized local update for instant feedback
        if (selectedTask) {
            setTasks(prev => prev.filter(t => t.id !== selectedTask.id));
        }

        // Also reload from server to ensure sync, but in background
        // loadDashboard(); // Optional: disabling full reload to prevent flicker, relying on local state for speed.

        setIsModalOpen(false);
        setSelectedTask(null);

        // Index adjustment is handled by useEffect
    };

    // Ensure index stays valid when tasks are removed
    useEffect(() => {
        if (currentTaskIndex >= tasks.length && tasks.length > 0) {
            setCurrentTaskIndex(0);
        } else if (tasks.length === 0) {
            setCurrentTaskIndex(0);
        }
    }, [tasks]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

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
        <div className="min-h-screen bg-[#8a2ce2] text-white font-sans pb-24 relative overflow-x-hidden">

            {/* Header / Hero Section - Darker Purple */}
            <div className="relative bg-[#2e0259] min-h-[160px] pb-8 pt-8 rounded-b-[50px] shadow-2xl z-30">

                {/* Top Navigation (Profile/Logout) - Absolute to not push logo */}
                <div className="absolute top-0 right-0 p-4 z-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden bg-white/10 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform backdrop-blur-sm shadow-lg" onClick={() => navigate('/profile')}>
                            <span className="font-bold text-xs">{profile?.name?.charAt(0)}{profile?.lastname?.charAt(0)}</span>
                        </div>
                        <button onClick={handleLogout} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white backdrop-blur-sm" title="Sair">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Centered Logo Area - Top of screen */}
                <div className="flex flex-col items-center justify-center mb-4 pt-2">
                    <div className="flex items-center gap-3 transform scale-110">
                        {/* Custom Logo Construction */}
                        <div className="relative w-14 h-12 bg-gradient-to-br from-[#a855f7] to-[#7e22ce] rounded-xl flex items-center justify-center shadow-lg border border-white/20 transform -skew-x-12">
                            {/* SVG Checkmark instead of Lucide to ensure rendering */}
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white transform skew-x-12">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <h1 className="text-4xl font-black tracking-wide text-white drop-shadow-lg italic">FATOPAGO</h1>
                    </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute top-1/2 right-4 w-6 h-6 bg-purple-500 rounded-full blur-xl opacity-60 animate-pulse" />
                <div className="absolute top-10 left-10 w-32 h-32 bg-purple-600/20 rounded-full blur-3xl" />
            </div>

            {/* Welcome Text Section - In the lighter purple body */}
            <div className="text-center px-8 pt-8 pb-6 relative z-20">
                <h2 className="text-3xl font-bold mb-3 drop-shadow-md">Bem-vindo de volta</h2>
                <p className="text-white/90 text-sm leading-relaxed max-w-xs mx-auto font-medium">
                    Acesse seu painel para validar novas notícias e acompanhar seus rendimentos.
                </p>
            </div>

            <div className="max-w-md mx-auto px-4 space-y-6 relative z-20">


                {/* Balance Card - The Purple Glow Card */}
                <div
                    className="bg-gradient-to-br from-[#6D28D9] to-[#4C1D95] rounded-3xl p-6 relative overflow-hidden shadow-2xl group cursor-pointer transition-transform hover:scale-[1.02]"
                    onClick={() => navigate('/financeiro')}
                >
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

                {/* Carousel News Validation Card */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-purple-400" />
                            <h3 className="font-bold text-lg">Tarefas Disponíveis</h3>
                        </div>
                    </div>

                    {loadError && (
                        <div className="mb-3 bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-4">
                            <p className="text-xs text-slate-300">{loadError}</p>
                            <button
                                onClick={() => { setLoading(true); loadDashboard(); }}
                                className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                            >
                                Tentar de novo
                            </button>
                        </div>
                    )}

                    <NewsCarousel
                        tasks={tasks}
                        onValidate={handleOpenValidation}
                        autoPlay={true}
                        interval={2000}
                    />
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

                        <div onClick={() => navigate('/ranking')} className="bg-[#1A1040] p-4 rounded-2xl border border-white/5 flex items-center gap-3 cursor-pointer hover:border-purple-500/50 transition-colors">
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
            </div >

            {/* Modal */}
            {
                selectedTask && (
                    <ValidationModal
                        task={selectedTask}
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onValidated={handleValidationComplete}
                    />
                )
            }

            {/* Bottom Nav - Visible on all screens now but optimized for mobile, desktop users have top nav too but this can stay or be hidden on lg if strictly asked. User said 'appear below menus when accessed by PC'. Let's keep it visible or hide on lg if top nav is enough. I added top nav. I will hide bottom nav on lg. */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#0F0826] border-t border-white/5 px-6 py-4 flex justify-between items-end z-50 lg:hidden">
                <button className="flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors group">
                    <Home className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                    <span className="text-[9px] font-bold">INÍCIO</span>
                </button>
                <div className="relative -top-5">
                    <button onClick={() => tasks.length > 0 && handleOpenValidation(tasks[0])} className="w-14 h-14 bg-[#8a2ce2] rounded-2xl flex flex-col items-center justify-center shadow-[0_0_20px_rgba(138,44,226,0.5)] border-4 border-[#0F0826] hover:scale-105 transition-transform">
                        <CheckCircle className="w-6 h-6 text-white fill-current" />
                    </button>
                    <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-purple-300">VALIDAR</span>
                </div>
                <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors group">
                    <User className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                    <span className="text-[9px] font-bold">PERFIL</span>
                </button>
            </div>
        </div >
    );
};


// End of component

export default Dashboard;
