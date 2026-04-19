import { Wallet, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../../types';

interface BalanceCardProps {
    profile: UserProfile | null;
    onWithdraw?: () => void;
    onNavigateFinanceiro?: () => void;
}

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const getLevel = (score: number): string => {
    if (score > 500) return 'Diamante';
    if (score > 100) return 'Ouro';
    return 'Iniciante';
};

export const BalanceCard = ({ profile, onNavigateFinanceiro }: BalanceCardProps) => {
    const balance = profile?.current_balance || 0;
    const level = getLevel(profile?.reputation_score || 0);
    const progress = (profile?.reputation_score || 0) % 100;

    return (
        <div
            className="bg-gradient-to-br from-[#6D28D9] to-[#4C1D95] rounded-3xl p-6 relative overflow-hidden shadow-2xl group cursor-pointer transition-transform hover:scale-[1.02]"
            onClick={onNavigateFinanceiro}
        >
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <p className="text-[10px] font-bold text-purple-200 uppercase tracking-widest mb-1">
                            Saldo Disponível
                        </p>
                        <h2 className="text-4xl font-extrabold text-white">
                            {formatCurrency(balance)}
                        </h2>
                    </div>
                    <button className="bg-white text-purple-900 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-transform">
                        Sacar Saldo <Wallet className="w-3 h-3" />
                    </button>
                </div>

                <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg mb-6 backdrop-blur-sm border border-white/10">
                    <ShieldCheck className="w-3 h-3 text-purple-200" />
                    <span className="text-[10px] font-bold text-white">Nível: {level}</span>
                </div>

                <div>
                    <div className="flex justify-between text-[10px] font-bold text-purple-200 mb-2">
                        <span>Progresso para Próximo Nível</span>
                        <span className="text-white">{progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Decorative Circles */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -ml-5 -mb-5" />
        </div>
    );
};
