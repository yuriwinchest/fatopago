import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle2, RotateCw } from 'lucide-react';

interface CycleConfigProps {
    isSavingCycleConfig: boolean;
    activeCycleId: string;
    cycleConfig: any;
    updateCycleConfig: (data: any) => Promise<void>;
}

const CycleConfig: React.FC<CycleConfigProps> = ({
    isSavingCycleConfig,
    activeCycleId,
    cycleConfig,
    updateCycleConfig
}) => {
    const [formData, setFormData] = useState({
        cycle_number: 1,
        cycle_start_at: '',
        cycle_end_at: '',
        is_active: true
    });
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    useEffect(() => {
        if (cycleConfig) {
            setFormData({
                cycle_number: cycleConfig.cycle_number || 1,
                cycle_start_at: cycleConfig.cycle_start_at ? new Date(cycleConfig.cycle_start_at).toISOString().slice(0, 16) : '',
                cycle_end_at: cycleConfig.cycle_end_at ? new Date(cycleConfig.cycle_end_at).toISOString().slice(0, 16) : '',
                is_active: cycleConfig.is_active ?? true
            });
        }
    }, [cycleConfig]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSuccessMessage(null);

        try {
            await updateCycleConfig({
                ...formData,
                cycle_start_at: new Date(formData.cycle_start_at).toISOString(),
                cycle_end_at: new Date(formData.cycle_end_at).toISOString()
            });
            setSuccessMessage('Configuração do ciclo atualizada com sucesso!');
            setTimeout(() => setSuccessMessage(null), 5000);
        } catch (err) {
            // Error handling is handled by the hook and displayed via adminError in parent if needed
        }
    };

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-white/5 bg-[#1A0B38] p-4 sm:p-6">
                <div>
                    <h2 className="text-xl font-extrabold sm:text-2xl tracking-[0.08em] [word-spacing:0.25em] text-white uppercase font-display">Configuração do Ciclo</h2>
                    <p className="mt-1 text-sm text-slate-400">
                        Defina o número do ciclo atual, datas de início/fim e status global.
                    </p>
                </div>
            </div>

            {successMessage && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    {successMessage}
                </div>
            )}

            <div className="admin-glass-card overflow-hidden">
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">Número do Ciclo</label>
                            <input
                                type="number"
                                required
                                value={formData.cycle_number}
                                onChange={(e) => setFormData({ ...formData, cycle_number: Number(e.target.value) })}
                                className="h-11 w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-2 text-sm text-white focus:border-purple-500/40 focus:outline-none"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">Status do Ciclo</label>
                            <div className="flex items-center gap-4 h-11">
                                <label className="flex cursor-pointer items-center gap-3">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            className="sr-only"
                                        />
                                        <div className={`h-6 w-11 rounded-full transition-colors ${formData.is_active ? 'bg-green-500' : 'bg-slate-700'}`}>
                                            <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all ${formData.is_active ? 'left-6' : 'left-1'}`} />
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-slate-300 uppercase font-display">Ciclo Ativo</span>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">Data de Início</label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.cycle_start_at}
                                onChange={(e) => setFormData({ ...formData, cycle_start_at: e.target.value })}
                                className="h-11 w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-2 text-sm text-white focus:border-purple-500/40 focus:outline-none [color-scheme:dark]"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-display">Data de Término</label>
                            <input
                                type="datetime-local"
                                required
                                value={formData.cycle_end_at}
                                onChange={(e) => setFormData({ ...formData, cycle_end_at: e.target.value })}
                                className="h-11 w-full rounded-xl border border-white/10 bg-[#0F0529] px-4 py-2 text-sm text-white focus:border-purple-500/40 focus:outline-none [color-scheme:dark]"
                            />
                        </div>
                    </div>

                    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 flex items-start gap-4">
                        <AlertCircle className="w-5 h-5 text-purple-400 shrink-0" />
                        <div className="text-xs text-purple-200 leading-relaxed">
                            <p className="font-bold uppercase tracking-widest font-display mb-1 text-[10px]">Importante:</p>
                            Ao atualizar o número do ciclo, novos registros de validação e pacotes vendidos serão associados a este novo número. Certifique-se de que as datas refletem o período correto para o ranking.
                        </div>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={isSavingCycleConfig}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-8 text-xs font-black uppercase tracking-widest text-black shadow-lg shadow-white/10 hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSavingCycleConfig ? <RotateCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Configuração
                        </button>
                    </div>
                </form>
            </div>

            <div className="admin-glass-card p-6 border-l-4 border-cyan-500/50">
                <h3 className="text-xs font-black uppercase tracking-widest text-white font-display mb-2">Informação Adicional</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                    ID do Registro Ativo: <code className="bg-white/5 px-2 py-0.5 rounded text-cyan-400 font-mono">{activeCycleId || 'Carregando...'}</code>
                </p>
            </div>
        </div>
    );
};

export default CycleConfig;
