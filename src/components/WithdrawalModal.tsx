
import { useState } from 'react';
import { X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import {
    getFriendlyPixWithdrawalErrorMessage,
    requestPixWithdrawal
} from '../lib/pixPaymentService';

interface WithdrawalModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentBalance: number;
    onSuccess: () => void;
}

const WithdrawalModal = ({ isOpen, onClose, currentBalance, onSuccess }: WithdrawalModalProps) => {
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'form' | 'success' | 'error'>('form');
    const [amount, setAmount] = useState('');
    const [pixKey, setPixKey] = useState('');
    const [pixType, setPixType] = useState('cpf');
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState('Sua solicitacao foi registrada com sucesso. O status do saque sera atualizado no painel conforme o backend receber o retorno do provedor.');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        const val = parseFloat(amount.replace(',', '.'));

        if (isNaN(val) || val <= 0) {
            setError("Valor inválido.");
            setLoading(false);
            return;
        }

        if (val > currentBalance) {
            setError("Saldo insuficiente.");
            setLoading(false);
            return;
        }

        if (val < 10) {
            setError("O valor mínimo para saque é R$ 10,00.");
            setLoading(false);
            return;
        }

        if (!pixKey.trim()) {
            setError("Informe sua chave PIX.");
            setLoading(false);
            return;
        }

        try {
            const result = await requestPixWithdrawal(val, pixKey.trim(), pixType);
            setSuccessMessage(
                result.manual_review_required
                    ? 'Seu saque foi recebido e entrou em analise de seguranca. Depois da liberacao administrativa, o worker retoma o processamento automaticamente.'
                    : (result.message || 'Sua solicitacao foi registrada com sucesso. O status do saque sera atualizado no painel conforme o backend receber o retorno do provedor.')
            );
            setStep('success');
            onSuccess();
        } catch (err: any) {
            console.error(err);
            setError(getFriendlyPixWithdrawalErrorMessage(err));
            setStep('error');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setStep('form');
        setAmount('');
        setPixKey('');
        setError(null);
        setSuccessMessage('Sua solicitacao foi registrada com sucesso. O status do saque sera atualizado no painel conforme o backend receber o retorno do provedor.');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#1A1040] w-full max-w-md rounded-3xl border border-white/10 p-6 relative shadow-2xl animate-in fade-in zoom-in duration-200">
                <button
                    onClick={handleClose}
                    title="Fechar"
                    aria-label="Fechar"
                    className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {step === 'form' ? (
                    <>
                        <h2 className="text-xl font-bold text-white mb-2">Solicitar Saque PIX</h2>
                        <div className="mb-6 space-y-2">
                            <p className="text-xs text-slate-400">O saque entra na fila e o painel passa a mostrar o status real do processamento conforme o retorno do provedor.</p>
                            <div className="flex items-center gap-2 rounded-lg border border-purple-500/20 bg-purple-500/5 px-3 py-2">
                                <span className="text-[10px] font-bold uppercase text-purple-300">Saque mínimo: R$ 10,00</span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1 uppercase">Valor (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    placeholder="0,00"
                                    className="w-full bg-[#0F0529] border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-600"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                />
                                <p className="text-[10px] text-slate-500 mt-1 text-right">Saldo disponível: R$ {currentBalance.toFixed(2)}</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1 uppercase">Tipo de Chave</label>
                                <div className="flex gap-2">
                                    {['cpf', 'email', 'phone', 'random'].map(type => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setPixType(type)}
                                            className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all border ${pixType === type
                                                    ? 'bg-purple-600 border-purple-500 text-white'
                                                    : 'bg-[#0F0529] border-white/10 text-slate-400 hover:bg-white/5'
                                                }`}
                                        >
                                            {type === 'phone' ? 'Celular' : (type === 'random' ? 'Aleatória' : type)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 mb-1 uppercase">Chave PIX</label>
                                <input
                                    type="text"
                                    placeholder="Digite sua chave..."
                                    className="w-full bg-[#0F0529] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-slate-600"
                                    value={pixKey}
                                    onChange={(e) => setPixKey(e.target.value)}
                                    required
                                />
                            </div>

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg text-center font-medium">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-[#00E676] hover:bg-[#00C853] text-[#003300] font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-green-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Saque'}
                            </button>
                        </form>

                        <div className="mt-4 pt-3 border-t border-white/5 text-center">
                            <p className="text-[10px] text-slate-600">
                                A conciliacao depende do retorno do provedor PIX e do backend da plataforma
                            </p>
                        </div>
                    </>
                ) : step === 'success' ? (
                    <div className="text-center py-8">
                        <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/40">
                            <CheckCircle className="w-10 h-10 text-green-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Saque Solicitado!</h2>
                        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                            {successMessage}<br />
                            O painel mostrará o status atualizado do saque assim que o backend concluir a próxima etapa.
                        </p>
                        <button
                            onClick={handleClose}
                            className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-8 rounded-xl transition-all w-full"
                        >
                            Fechar
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/40">
                            <AlertCircle className="w-10 h-10 text-red-400" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Erro no Saque</h2>
                        <p className="text-slate-400 text-sm mb-8 leading-relaxed">
                            {error || 'Não foi possível processar seu saque. Tente novamente.'}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={handleClose}
                                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all"
                            >
                                Fechar
                            </button>
                            <button
                                onClick={() => { setStep('form'); setError(null); }}
                                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-all"
                            >
                                Tentar Novamente
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WithdrawalModal;
