import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { Button } from '../ui/Button';
import {
    SellerContactSellerOption,
    buildDefaultSellerContactMessage,
    createSellerContactMessage,
    listActiveSellersForContact
} from '../../lib/sellerContactMessages';

const getSellerInitial = (name?: string | null) =>
    String(name || '').trim().charAt(0).toUpperCase() || 'V';

type SellerContactModalProps = {
    isOpen: boolean;
    onClose: () => void;
    onSubmitted?: () => void;
};

export default function SellerContactModal({
    isOpen,
    onClose,
    onSubmitted
}: SellerContactModalProps) {
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [sellers, setSellers] = useState<SellerContactSellerOption[]>([]);
    const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
    const [message, setMessage] = useState('');

    const selectedSeller = useMemo(
        () => sellers.find((seller) => seller.id === selectedSellerId) || null,
        [selectedSellerId, sellers]
    );

    const headerSafeAreaStyle = useMemo(
        () =>
            ({
                paddingTop: 'max(1rem, env(safe-area-inset-top))'
            }) as CSSProperties,
        []
    );

    const footerSafeAreaStyle = useMemo(
        () =>
            ({
                paddingBottom: 'max(1rem, env(safe-area-inset-bottom))'
            }) as CSSProperties,
        []
    );

    useEffect(() => {
        if (!isOpen) return;

        const loadSellers = async () => {
            try {
                setLoading(true);
                setError(null);
                setSuccessMessage(null);
                const rows = await listActiveSellersForContact();
                setSellers(rows);
                if (rows[0]) {
                    setSelectedSellerId(rows[0].id);
                    setMessage(buildDefaultSellerContactMessage(rows[0].name));
                } else {
                    setSelectedSellerId(null);
                    setMessage('');
                }
            } catch (requestError: any) {
                console.error('Falha ao listar vendedores para contato:', requestError);
                setError(requestError?.message || 'Não foi possível listar os vendedores agora.');
            } finally {
                setLoading(false);
            }
        };

        void loadSellers();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || typeof document === 'undefined') return;

        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!selectedSeller) return;
        setMessage((current) => {
            const trimmed = current.trim();
            if (!trimmed || trimmed === buildDefaultSellerContactMessage()) {
                return buildDefaultSellerContactMessage(selectedSeller.name);
            }
            return current;
        });
    }, [selectedSeller]);

    const handleSelectSeller = (seller: SellerContactSellerOption) => {
        setSelectedSellerId(seller.id);
        setError(null);
        setSuccessMessage(null);
        setMessage(buildDefaultSellerContactMessage(seller.name));
    };

    const handleSubmit = async () => {
        if (!selectedSeller) {
            setError('Selecione um vendedor para continuar.');
            return;
        }

        if (message.trim().length < 8) {
            setError('Escreva uma mensagem mais completa para o vendedor.');
            return;
        }

        try {
            setSubmitting(true);
            setError(null);
            await createSellerContactMessage(selectedSeller.id, message);
            setSuccessMessage(`Pedido enviado com sucesso. ${selectedSeller.name} vai analisar e habilitar os planos da campanha para a sua conta.`);
            onSubmitted?.();
        } catch (requestError: any) {
            console.error('Falha ao enviar mensagem ao vendedor:', requestError);
            setError(requestError?.message || 'Não foi possível enviar sua mensagem agora.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[160] flex items-end justify-center bg-black/80 backdrop-blur-xl sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Contato com vendedor"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-[#110c2d] shadow-2xl sm:max-h-[92dvh] sm:max-w-5xl sm:rounded-[32px]">
                {/* Background Decor */}
                <div className="absolute top-0 left-0 w-full h-1/2 bg-[radial-gradient(circle_at_top_left,rgba(79,70,229,0.2),transparent_70%)] pointer-events-none" />
                <div className="absolute bottom-0 right-0 w-full h-1/2 bg-[radial-gradient(circle_at_bottom_right,rgba(168,85,247,0.15),transparent_70%)] pointer-events-none" />

                <div className="flex justify-center pt-3 sm:hidden shrink-0">
                    <div className="h-1.5 w-14 rounded-full bg-white/10" />
                </div>

                {/* Header */}
                <div 
                    className="relative z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-indigo-950/30 px-4 py-4 backdrop-blur-xl sm:px-8 sm:py-5"
                    style={headerSafeAreaStyle}
                >
                    <div className="min-w-0 flex-1">
                        <h2 className="text-2xl font-black leading-[0.92] tracking-[-0.04em] text-white sm:text-5xl">
                            Falar com um <span className="text-purple-400 drop-shadow-[0_0_20px_rgba(168,85,247,0.6)]">vendedor</span>
                        </h2>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="relative inline-flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-400 transition-all active:scale-[0.98] sm:h-12 sm:w-12 sm:hover:bg-white/10 sm:hover:text-white"
                        aria-label="Fechar"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain">
                    <div className="grid h-full grid-cols-1 grid-rows-[auto_1fr] lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-1">
                        {/* Sellers Sidebar */}
                        <div className="border-b border-white/5 bg-black/40 p-4 sm:p-5 lg:border-b-0 lg:border-r">
                            <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                                Vendedores Disponíveis
                            </p>
                            
                            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
                                {loading ? (
                                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3">
                                        <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                                        <span className="text-xs font-bold text-slate-400">Consultando...</span>
                                    </div>
                                ) : sellers.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center bg-white/5">
                                        <p className="text-xs font-bold text-slate-500">Nenhum disponível.</p>
                                    </div>
                                ) : (
                                    sellers.map((seller) => {
                                        const selected = seller.id === selectedSellerId;
                                        return (
                                            <button
                                                key={seller.id}
                                                type="button"
                                                onClick={() => handleSelectSeller(seller)}
                                                className={`group relative min-w-[220px] overflow-hidden rounded-[20px] border px-4 py-3 text-left transition-all touch-manipulation lg:min-w-0 ${
                                                    selected
                                                        ? 'border-purple-500/40 bg-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.2)] ring-1 ring-purple-500/20'
                                                        : 'border-white/5 bg-white/5 active:scale-[0.99] lg:hover:bg-white/10'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    {seller.avatar_url ? (
                                                        <img
                                                            src={seller.avatar_url}
                                                            alt={seller.name}
                                                            className={`h-12 w-12 shrink-0 rounded-2xl border object-cover ${
                                                                selected ? 'border-purple-400/40' : 'border-white/10'
                                                            }`}
                                                        />
                                                    ) : (
                                                        <div
                                                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-base font-black ${
                                                                selected
                                                                    ? 'border-purple-400/40 bg-purple-500/20 text-white'
                                                                    : 'border-white/10 bg-white/5 text-slate-200'
                                                            }`}
                                                        >
                                                            {getSellerInitial(seller.name)}
                                                        </div>
                                                    )}

                                                    <div className="min-w-0">
                                                        <p className={`truncate text-base font-black uppercase tracking-tight transition-colors ${selected ? 'text-white' : 'text-slate-300 lg:group-hover:text-white'}`}>
                                                            {seller.name}
                                                        </p>
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Message Composer Area */}
                        <div className="bg-white/[0.01] p-4 sm:p-6 lg:p-8">
                            <div className="relative flex h-full flex-col overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/20 via-transparent to-transparent pointer-events-none" />
                                
                                <div className="relative z-10 mb-6 flex items-center gap-4">
                                    {selectedSeller?.avatar_url ? (
                                        <img
                                            src={selectedSeller.avatar_url}
                                            alt={selectedSeller.name}
                                            className="h-14 w-14 shrink-0 rounded-[20px] border border-purple-400/30 object-cover shadow-[0_0_30px_rgba(168,85,247,0.2)]"
                                        />
                                    ) : (
                                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-purple-400/20 bg-purple-500/10 text-xl font-black text-white ring-1 ring-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.25)]">
                                            {getSellerInitial(selectedSeller?.name)}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Fale com</p>
                                        <h3 className="truncate text-2xl font-black uppercase tracking-tight text-white sm:text-4xl drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">
                                            {selectedSeller ? `${selectedSeller.name}` : 'Aguardando seleção'}
                                        </h3>
                                    </div>
                                </div>

                                <div className="relative z-10 flex flex-1 flex-col space-y-4">
                                    <div className="flex flex-1 flex-col space-y-3">
                                        <label
                                            htmlFor="seller-contact-message"
                                            className="ml-1 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500"
                                        >
                                            Mensagem do pedido
                                        </label>
                                        <textarea
                                            id="seller-contact-message"
                                            value={message}
                                            onChange={(event) => setMessage(event.target.value)}
                                            placeholder="Descreva seu interesse nos planos da campanha..."
                                            spellCheck={false}
                                            className="flex-1 min-h-[220px] w-full resize-none rounded-[28px] border border-white/10 bg-black/40 px-5 py-5 text-sm font-medium leading-relaxed tracking-wide text-white outline-none transition-all placeholder:text-slate-600 focus:border-purple-400/40 sm:min-h-[260px] sm:px-8 sm:py-6 shadow-inner"
                                        />
                                    </div>

                                    {error && (
                                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-xs font-bold text-red-400 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex items-center gap-3">
                                                <AlertCircle className="h-4 w-4 shrink-0" />
                                                <span>{error}</span>
                                            </div>
                                        </div>
                                    )}

                                    {successMessage && (
                                        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-6 py-4 text-xs font-bold text-emerald-400 animate-in fade-in slide-in-from-top-2">
                                            <div className="flex items-center gap-3">
                                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                <span>{successMessage}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-xs leading-relaxed text-slate-400 sm:px-5">
                                        Após o envio, o vendedor pode liberar os planos da campanha para a sua conta.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div 
                    className="relative z-10 p-6 sm:px-12 sm:py-8 border-t border-white/5 bg-black/40 backdrop-blur-md shrink-0"
                    style={footerSafeAreaStyle}
                >
                    <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                        <Button 
                            variant="secondary" 
                            onClick={onClose} 
                            className="h-12 w-full rounded-2xl text-[10px] font-black uppercase tracking-widest sm:w-40"
                        >
                            Voltar
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            isLoading={submitting}
                            disabled={loading || sellers.length === 0 || !selectedSeller}
                            className="h-12 w-full rounded-2xl bg-purple-600 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-purple-500/20 sm:w-72 sm:hover:bg-purple-700"
                        >
                            Enviar Solicitação
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
