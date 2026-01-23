import { Trophy, CheckCircle, BarChart2, TrendingUp } from 'lucide-react';
// No types import here, checking file again

interface UserStats {
    totalValidations: number;
    accuracy: number;
    pendingTasks: number;
    weeklyEarnings: number;
}

interface StatsGridProps {
    stats: UserStats;
    reputationScore: number;
}

const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

export const StatsGrid = ({ stats, reputationScore }: StatsGridProps) => {
    const statItems = [
        {
            icon: Trophy,
            value: reputationScore,
            label: 'XP Total',
            color: 'text-yellow-400',
            bgColor: 'bg-yellow-500/10',
            borderColor: 'border-yellow-500/30'
        },
        {
            icon: CheckCircle,
            value: stats.totalValidations,
            label: 'Validações',
            color: 'text-green-400',
            bgColor: 'bg-green-500/10',
            borderColor: 'border-green-500/30'
        },
        {
            icon: BarChart2,
            value: `${stats.accuracy}%`,
            label: 'Precisão',
            color: 'text-blue-400',
            bgColor: 'bg-blue-500/10',
            borderColor: 'border-blue-500/30'
        },
        {
            icon: TrendingUp,
            value: formatCurrency(stats.weeklyEarnings),
            label: 'Ganhos 7d',
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/10',
            borderColor: 'border-purple-500/30'
        }
    ];

    return (
        <div className="grid grid-cols-4 gap-3">
            {statItems.map((item, index) => (
                <div
                    key={index}
                    className={`${item.bgColor} border ${item.borderColor} rounded-2xl p-3 text-center transition-transform hover:scale-105`}
                >
                    <item.icon className={`w-5 h-5 ${item.color} mx-auto mb-2`} />
                    <p className="text-base font-bold text-white truncate">
                        {item.value}
                    </p>
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wide">
                        {item.label}
                    </p>
                </div>
            ))}
        </div>
    );
};
