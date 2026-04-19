import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, CheckCircle, Copy, AlertCircle, Clock, QrCode } from 'lucide-react';
import {
  createPixPayment,
  checkPixPaymentStatus,
  getFriendlyPixCheckoutErrorMessage,
  PixPaymentResponse
} from '../lib/pixPaymentService';
import { buildMetaPixelDedupKey, initializeMetaPixel, trackMetaPixelEvent } from '../lib/metaPixel';

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  planName: string;
  planPrice: number;
  onPaymentApproved: () => void;
}

type ModalStep = 'loading' | 'qr_code' | 'checking' | 'approved' | 'error' | 'expired';

const POLL_INTERVAL_MS = 5000; // Check every 5 seconds
const MAX_POLL_ATTEMPTS = 120; // Max 10 minutes of polling

const PixPaymentModal = ({
  isOpen,
  onClose,
  planId,
  planName,
  planPrice,
  onPaymentApproved,
}: PixPaymentModalProps) => {
  const [step, setStep] = useState<ModalStep>('loading');
  const [paymentData, setPaymentData] = useState<PixPaymentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pollCountRef = useRef(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const createPayment = useCallback(() => createPixPayment(planId), [planId]);

  // Create payment on mount
  useEffect(() => {
    if (!isOpen) return;
    mountedRef.current = true;

    const initPayment = async () => {
      setStep('loading');
      setError(null);
      setPaymentData(null);
      pollCountRef.current = 0;

      try {
        const data = await createPayment();
        if (!mountedRef.current) return;
        setPaymentData(data);
        initializeMetaPixel();
        trackMetaPixelEvent(
          'InitiateCheckout',
          {
            content_name: planName,
            content_ids: [planId],
            content_type: 'product',
            currency: 'BRL',
            num_items: 1,
            value: planPrice,
          },
          buildMetaPixelDedupKey('initiate_checkout', data.payment_id)
        );
        setStep('qr_code');
      } catch (err: any) {
        if (!mountedRef.current) return;
        setError(getFriendlyPixCheckoutErrorMessage(err));
        setStep('error');
      }
    };

    initPayment();

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [createPayment, isOpen, stopPolling]);

  // Start polling when QR code is shown
  useEffect(() => {
    if (step !== 'qr_code' || !paymentData) return;

    stopPolling();

    pollIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current) return;

      try {
        const status = await checkPixPaymentStatus(paymentData.payment_id);
        if (!mountedRef.current) return;

        pollCountRef.current += 1;

        if (status.status === 'approved') {
          stopPolling();
          initializeMetaPixel();
          trackMetaPixelEvent(
            'Purchase',
            {
              content_name: planName,
              content_ids: [planId],
              content_type: 'product',
              currency: 'BRL',
              num_items: 1,
              value: planPrice,
            },
            buildMetaPixelDedupKey('purchase', paymentData.payment_id)
          );
          setStep('approved');
          setTimeout(() => {
            if (mountedRef.current) {
              onPaymentApproved();
            }
          }, 2000);
        } else if (status.status === 'rejected' || status.status === 'cancelled') {
          stopPolling();
          setError('Pagamento recusado ou cancelado.');
          setStep('error');
        }
      } catch {
        // Silently continue polling on error
      }

      if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
        stopPolling();
        setStep('expired');
      }
    }, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [step, paymentData, onPaymentApproved, stopPolling]);

  const handleCopyCode = async () => {
    if (!paymentData?.qr_code) return;
    try {
      await navigator.clipboard.writeText(paymentData.qr_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = paymentData.qr_code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleClose = () => {
    stopPolling();
    onClose();
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#1A1040] w-full max-w-md rounded-3xl border border-white/10 p-6 relative shadow-2xl animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={handleClose}
          title="Fechar"
          aria-label="Fechar"
          className="absolute top-4 right-4 p-2 bg-white/5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* LOADING STATE */}
        {step === 'loading' && (
          <div className="text-center py-12">
            <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Gerando PIX...</h2>
            <p className="text-xs text-slate-400">Criando pagamento via Mercado Pago</p>
          </div>
        )}

        {/* QR CODE STATE */}
        {step === 'qr_code' && paymentData && (
          <>
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
                <QrCode className="w-3.5 h-3.5" />
                PIX Gerado
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Pagar com PIX</h2>
              <p className="text-sm text-slate-400">
                {planName} - <span className="text-white font-bold">{formatCurrency(planPrice)}</span>
              </p>
            </div>

            {/* QR Code Image */}
            <div className="bg-white rounded-2xl p-4 mx-auto max-w-[260px] mb-4">
              {paymentData.qr_code_base64 ? (
                <img
                  src={`data:image/png;base64,${paymentData.qr_code_base64}`}
                  alt="QR Code PIX"
                  className="w-full h-auto"
                />
              ) : (
                <div className="w-full aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
                  <QrCode className="w-16 h-16 text-gray-400" />
                </div>
              )}
            </div>

            {/* Copy Pix Code */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-300 mb-1.5 uppercase">
                Ou copie o código PIX
              </label>
              <div className="flex gap-2">
                <div className="flex-1 bg-[#0F0529] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-400 truncate font-mono">
                  {paymentData.qr_code ? paymentData.qr_code.substring(0, 50) + '...' : 'Código não disponível'}
                </div>
                <button
                  onClick={handleCopyCode}
                  className={`px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 ${
                    copied
                      ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                      : 'bg-purple-600 hover:bg-purple-700 text-white'
                  }`}
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Polling indicator */}
            <div className="bg-[#0F0529] border border-white/5 rounded-xl p-3 flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />
                <div className="absolute inset-0 w-3 h-3 bg-yellow-400 rounded-full animate-ping opacity-40" />
              </div>
              <p className="text-xs text-slate-300">
                Aguardando pagamento... <span className="text-slate-500">verificando automaticamente</span>
              </p>
            </div>

            {/* Instructions */}
            <div className="space-y-2 text-[11px] text-slate-500">
              <p>1. Abra o app do seu banco ou carteira digital</p>
              <p>2. Escaneie o QR Code ou cole o código PIX</p>
              <p>3. Confirme o pagamento de {formatCurrency(planPrice)}</p>
              <p>4. Seu plano será ativado automaticamente</p>
            </div>
          </>
        )}

        {/* APPROVED STATE */}
        {step === 'approved' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/40">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Pagamento Confirmado!</h2>
            <p className="text-slate-400 text-sm mb-2 leading-relaxed">
              Seu plano <span className="text-white font-bold">{planName}</span> foi ativado com sucesso.
            </p>
            <p className="text-green-400 font-bold text-lg mb-8">{formatCurrency(planPrice)}</p>
            <button
              onClick={handleClose}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-8 rounded-xl transition-all w-full active:scale-95"
            >
              Começar a Validar
            </button>
          </div>
        )}

        {/* ERROR STATE */}
        {step === 'error' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/40">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Erro no Pagamento</h2>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              {error || 'Ocorreu um erro ao processar seu pagamento.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setStep('loading');
                  setError(null);
                  // Re-trigger payment creation
                  createPayment()
                    .then(data => {
                      setPaymentData(data);
                      setStep('qr_code');
                    })
                    .catch(err => {
                      setError(getFriendlyPixCheckoutErrorMessage(err));
                      setStep('error');
                    });
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-all"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        )}

        {/* EXPIRED STATE */}
        {step === 'expired' && (
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/40">
              <Clock className="w-10 h-10 text-yellow-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">PIX Expirado</h2>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed">
              O tempo para pagamento expirou. Gere um novo QR Code para continuar.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl transition-all"
              >
                Fechar
              </button>
              <button
                onClick={() => {
                  setStep('loading');
                  pollCountRef.current = 0;
                  createPayment()
                    .then(data => {
                      setPaymentData(data);
                      setStep('qr_code');
                    })
                    .catch(err => {
                      setError(getFriendlyPixCheckoutErrorMessage(err));
                      setStep('error');
                    });
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition-all"
              >
                Gerar Novo PIX
              </button>
            </div>
          </div>
        )}

        {/* Mercado Pago badge */}
        {step === 'qr_code' && (
          <div className="mt-4 pt-4 border-t border-white/5 text-center">
            <p className="text-[10px] text-slate-600">
              Pagamento processado por <span className="text-slate-400 font-bold">Mercado Pago</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PixPaymentModal;
