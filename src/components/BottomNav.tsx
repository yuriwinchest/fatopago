import { Home, CheckCircle, User, Wallet, Trophy } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

export const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    // Profile path fix since it's /profile
    const isProfileActive = isActive('/profile');
    const isHomeActive = isActive('/home');
    const isRankingActive = isActive('/ranking');
    const isFinanceiroActive = isActive('/financeiro');
    const isHubActive = isActive('/validation/hub');

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-[#0F0826]/90 backdrop-blur-xl border-t border-white/5 px-4 py-3 flex justify-between items-center z-50 lg:hidden shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            {/* Home */}
            <button
                onClick={() => navigate('/home')}
                className={`flex flex-col items-center gap-1 transition-all group ${isHomeActive ? 'text-purple-400' : 'text-slate-500 hover:text-white'}`}
            >
                <Home className={`w-5 h-5 ${isHomeActive ? 'scale-110' : 'group-hover:-translate-y-1'} transition-transform`} />
                <span className="text-[9px] font-bold tracking-tighter">INÍCIO</span>
            </button>

            {/* Ranking */}
            <button
                onClick={() => navigate('/ranking')}
                className={`flex flex-col items-center gap-1 transition-all group ${isRankingActive ? 'text-purple-400' : 'text-slate-500 hover:text-white'}`}
            >
                <Trophy className={`w-5 h-5 ${isRankingActive ? 'scale-110' : 'group-hover:-translate-y-1'} transition-transform`} />
                <span className="text-[9px] font-bold tracking-tighter">RANKING</span>
            </button>

            {/* Primary Action - Register / Validate */}
            <div className="relative -top-6">
                <button
                    onClick={() => navigate('/validation/hub')}
                    className={`w-14 h-14 bg-gradient-to-br from-[#A855F7] to-[#7E22CE] rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(138,44,226,0.6)] border-4 border-[#0F0826] hover:scale-110 active:scale-95 transition-all group overflow-hidden`}
                >
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CheckCircle className="w-6 h-6 text-white" />
                </button>
                <span className={`absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-black tracking-widest ${isHubActive ? 'text-purple-300' : 'text-slate-500 opacity-80'}`}>VALIDAR</span>
            </div>

            {/* Wallet */}
            <button
                onClick={() => navigate('/financeiro')}
                className={`flex flex-col items-center gap-1 transition-all group ${isFinanceiroActive ? 'text-purple-400' : 'text-slate-500 hover:text-white'}`}
            >
                <Wallet className={`w-5 h-5 ${isFinanceiroActive ? 'scale-110' : 'group-hover:-translate-y-1'} transition-transform`} />
                <span className="text-[9px] font-bold tracking-tighter">CARTEIRA</span>
            </button>

            {/* Profile */}
            <button
                onClick={() => navigate('/profile')}
                className={`flex flex-col items-center gap-1 transition-all group ${isProfileActive ? 'text-purple-400' : 'text-slate-500 hover:text-white'}`}
            >
                <User className={`w-5 h-5 ${isProfileActive ? 'scale-110' : 'group-hover:-translate-y-1'} transition-transform`} />
                <span className="text-[9px] font-bold tracking-tighter">PERFIL</span>
            </button>
        </div>
    );
};
