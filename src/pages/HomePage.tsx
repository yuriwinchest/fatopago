import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { useUserData } from '../hooks/useUserData';
import AppHeader from '../components/AppHeader';
import { BalanceCard } from '../components/Home/BalanceCard';
import { StatsGrid } from '../components/Home/StatsGrid';
import { QuickActions } from '../components/Home/QuickActions';
import { AffiliateCard } from '../components/Home/AffiliateCard';
import { NewsPreview } from '../components/Home/NewsPreview';
import { NewsTask } from '../types';
import { BottomNav } from '../components/BottomNav';

const HomePage = () => {
    const navigate = useNavigate();
    const {
        profile,
        tasks,
        stats,
        loading,
        error,
        refetch,
        isAuthenticated
    } = useUserData();

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0F0529] flex flex-col items-center justify-center text-white p-6">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                    <Loader2 className="w-8 h-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-500 animate-pulse" />
                </div>
                <p className="mt-6 text-slate-400 font-medium animate-pulse">Carregando sua experiência...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        navigate('/login');
        return null;
    }

    const handleAction = (actionId: string) => {
        switch (actionId) {
            case 'validate':
                navigate('/validation/hub');
                break;
            case 'affiliates':
                // navigate('/affiliates'); // To be implemented
                alert('Módulo de indicações em breve!');
                break;
            case 'ranking':
                navigate('/ranking');
                break;
            case 'financeiro':
                navigate('/financeiro');
                break;
            default:
                break;
        }
    };

    const handleSelectTask = (task: NewsTask) => {
        navigate(`/validation/task/${task.id}`);
    };

    return (
        <div className="min-h-screen bg-[#0F0529] font-sans text-white pb-24">
            <AppHeader
                title={profile ? `Olá, ${profile.name}!` : 'Bem-vindo!'}
                subtitle="Central de Controle FatoPago"
            />

            <div className="px-6 -mt-6 relative z-20 space-y-8">
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 text-red-400">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-xs font-medium leading-tight">{error}</p>
                        </div>
                        <button
                            onClick={refetch}
                            className="p-2 hover:bg-red-500/20 rounded-full transition-colors"
                        >
                            <RefreshCw className="w-4 h-4 text-red-400" />
                        </button>
                    </div>
                )}

                {/* Main Balance Card */}
                <BalanceCard
                    profile={profile}
                    onNavigateFinanceiro={() => navigate('/financeiro')}
                />

                {/* User Stats Grid */}
                <StatsGrid
                    stats={stats}
                    reputationScore={profile?.reputation_score || 0}
                />

                {/* Affiliate Program */}
                <AffiliateCard affiliateCode={profile?.affiliate_code || ''} />

                {/* Quick Shortcuts */}
                <section className="space-y-4">
                    <h3 className="font-bold text-lg text-white px-2">Acesso Rápido</h3>
                    <QuickActions onAction={handleAction} />
                </section>

                {/* News Preview / Tasks */}
                <NewsPreview
                    tasks={tasks}
                    onSeeAll={() => navigate('/validation/hub')}
                    onSelectTask={handleSelectTask}
                />
            </div>
            <BottomNav />
        </div>
    );
};

export default HomePage;
