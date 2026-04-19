import { ArrowRight, Clock } from 'lucide-react';
import { NewsTask } from '../../types';

interface NewsPreviewProps {
    tasks: NewsTask[];
    onSeeAll: () => void;
    onSelectTask: (task: NewsTask) => void;
}

export const NewsPreview = ({ tasks, onSeeAll, onSelectTask }: NewsPreviewProps) => {
    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
                <h3 className="font-bold text-lg text-white">Notícias para Validar</h3>
                <button
                    onClick={onSeeAll}
                    className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                >
                    Ver Todas <ArrowRight className="w-3 h-3" />
                </button>
            </div>

            <div className="space-y-3">
                {tasks.slice(0, 3).map((task) => (
                    <div
                        key={task.id}
                        onClick={() => onSelectTask(task)}
                        className="bg-[#1A1040] border border-white/5 rounded-2xl p-4 flex gap-4 hover:border-purple-500/30 transition-all cursor-pointer active:scale-[0.98] group overflow-hidden"
                    >
                        {task.content.image_url ? (
                            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-800">
                                <img
                                    src={task.content.image_url}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                    alt={task.content.title}
                                />
                            </div>
                        ) : (
                            <div className="w-20 h-20 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0 border border-purple-500/20">
                                <Clock className="w-6 h-6 text-purple-400 opacity-50" />
                            </div>
                        )}

                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                                <h4 className="font-bold text-sm text-white line-clamp-2 leading-tight group-hover:text-purple-300 transition-colors">
                                    {task.content.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-2 opacity-60">
                                    <span className="text-[10px] uppercase font-bold text-purple-200">
                                        {task.content.category}
                                    </span>
                                    <span className="text-[10px] text-white">
                                        • {task.content.source}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-between items-end mt-2">
                                <span className="text-sm font-black text-[#00E676]">
                                    + {formatCurrency(task.content.reward)}
                                </span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${task.content.difficulty === 'easy' ? 'bg-green-500/10 text-green-400' :
                                    task.content.difficulty === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
                                        'bg-red-500/10 text-red-400'
                                    }`}>
                                    {task.content.difficulty === 'easy' ? 'Fácil' :
                                        task.content.difficulty === 'medium' ? 'Médio' : 'Difícil'}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
