import { PlusCircle, Users, Trophy, Wallet } from 'lucide-react';

interface QuickActionsProps {
    onAction: (action: string) => void;
}

export const QuickActions = ({ onAction }: QuickActionsProps) => {
    const actions = [
        {
            id: 'validate',
            label: 'Validar Notícia',
            icon: PlusCircle,
            color: 'bg-green-500',
            textColor: 'text-green-500'
        },
        {
            id: 'affiliates',
            label: 'Indicações',
            icon: Users,
            color: 'bg-blue-500',
            textColor: 'text-blue-500'
        },
        {
            id: 'ranking',
            label: 'Ranking Global',
            icon: Trophy,
            color: 'bg-yellow-500',
            textColor: 'text-yellow-500'
        },
        {
            id: 'financeiro',
            label: 'Minha Carteira',
            icon: Wallet,
            color: 'bg-purple-500',
            textColor: 'text-purple-500'
        }
    ];

    return (
        <div className="grid grid-cols-2 gap-4">
            {actions.map((action) => (
                <button
                    key={action.id}
                    onClick={() => onAction(action.id)}
                    className="flex items-center gap-3 bg-[#1A1040] hover:bg-[#251854] text-white p-4 rounded-2xl border border-white/5 transition-all active:scale-95 text-left shadow-lg group"
                >
                    <div className={`${action.color} p-2.5 rounded-xl shadow-lg shadow-black/20 group-hover:scale-110 transition-transform`}>
                        <action.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="font-bold text-sm leading-tight">{action.label}</span>
                </button>
            ))}
        </div>
    );
};
