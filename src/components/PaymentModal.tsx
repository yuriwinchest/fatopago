
import React, { useState, useEffect, useRef } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2, X } from 'lucide-react';

// Make sure to call loadStripe outside of a component’s render to avoid
// recreating the Stripe object on every render.
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY as string | undefined;
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    planId: string;
    onSuccess: () => void;
    amount: number; // in reais
}

const CheckoutForm = ({ onSuccess, amount, clientSecret }: { onSuccess: () => void, amount: number, clientSecret: string }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isPolling, setIsPolling] = useState(false);
    const pollStartRef = useRef<number | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        setIsLoading(true);

        const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                // Return URL mainly for redirect-based payments (like some banking apps), 
                // but we try to handle inline first. 
                // Note: For pure credit card often no redirect needed. 
                // For PIX, it shows QR code then waits.
                return_url: window.location.href,
            },
            redirect: 'if_required'

        });

        if (error) {
            if (error.type === "card_error" || error.type === "validation_error") {
                setMessage(error.message || "Ocorreu um erro no pagamento.");
            } else {
                setMessage("Ocorreu um erro inesperado.");
            }
            setIsLoading(false);
            setIsPolling(false);
        } else if (paymentIntent && paymentIntent.status === "succeeded") {
            setMessage("Pagamento realizado com sucesso!");
            setIsPolling(false);
            onSuccess();
            // We don't set loading false immediately to prevent button flicker before close
        } else if (paymentIntent && (paymentIntent.status === "processing" || paymentIntent.status === "requires_action")) {
            setMessage("PIX gerado. Conclua o pagamento para liberar o plano.");
            setIsLoading(false);
            pollStartRef.current = Date.now();
            setIsPolling(true);
        } else {
            // Handling other statuses if needed
            setIsLoading(false);
            setIsPolling(false);
        }
    };

    useEffect(() => {
        if (!stripe || !clientSecret || !isPolling) return;

        let cancelled = false;
        let timeoutId: number | null = null;

        const pollOnce = async () => {
            if (cancelled) return;

            const startTime = pollStartRef.current ?? Date.now();
            pollStartRef.current = startTime;

            if (Date.now() - startTime > 10 * 60 * 1000) {
                setMessage('Tempo esgotado. Se você já pagou, aguarde alguns instantes e tente novamente.');
                setIsPolling(false);
                return;
            }

            const res = await stripe.retrievePaymentIntent(clientSecret);
            if (cancelled) return;

            if (res.error) {
                setMessage(res.error.message || 'Falha ao verificar o pagamento.');
                setIsPolling(false);
                return;
            }

            const status = res.paymentIntent?.status;
            if (status === 'succeeded') {
                setMessage('Pagamento confirmado! Liberando seu plano...');
                setIsPolling(false);
                onSuccess();
                return;
            }

            if (status === 'processing' || status === 'requires_action') {
                timeoutId = window.setTimeout(pollOnce, 3000);
                return;
            }

            if (status === 'canceled') {
                setMessage('Pagamento cancelado.');
                setIsPolling(false);
                return;
            }

            if (status === 'requires_payment_method') {
                setMessage('Pagamento não concluído. Gere um novo PIX para tentar novamente.');
                setIsPolling(false);
                return;
            }

            timeoutId = window.setTimeout(pollOnce, 3000);
        };

        pollOnce();
        return () => {
            cancelled = true;
            if (timeoutId != null) window.clearTimeout(timeoutId);
        };
    }, [clientSecret, isPolling, onSuccess, stripe]);

    const submitLabel = isPolling
        ? 'Aguardando confirmação do pagamento...'
        : isLoading
            ? 'Gerando PIX...'
            : `Gerar PIX • R$ ${amount.toFixed(2)}`;

    return (
        <form id="payment-form" onSubmit={handleSubmit} className="space-y-6">
            <PaymentElement id="payment-element" options={{ layout: "tabs" }} />

            {message && (
                <div
                    role="status"
                    aria-live="polite"
                    className={`p-3 rounded-lg text-xs font-bold ${message.includes('sucesso') || message.includes('PIX') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}
                >
                    {message}
                </div>
            )}

            <button
                type="submit"
                disabled={isLoading || isPolling || !stripe || !elements}
                id="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 text-sm uppercase tracking-wide flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0529]"
            >
                {(isLoading || isPolling) && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                <span>{submitLabel}</span>
            </button>
        </form>
    );
}

export const PaymentModal = ({ isOpen, onClose, planId, onSuccess, amount }: PaymentModalProps) => {
    const [clientSecret, setClientSecret] = useState("");
    const [loadingClientSecret, setLoadingClientSecret] = useState(false);
    const [clientSecretError, setClientSecretError] = useState<string | null>(null);
    const [reloadNonce, setReloadNonce] = useState(0);
    const closeButtonRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => {
        if (!isOpen || !planId) return;

        let cancelled = false;
        const run = async () => {
            setClientSecret("");
            setClientSecretError(null);
            setLoadingClientSecret(true);

            try {
                const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';
                const res = await fetch(baseUrl + "/api/create-payment-intent", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ planId }),
                });

                let payload: any = null;
                try {
                    payload = await res.json();
                } catch {
                    payload = null;
                }

                if (!res.ok) {
                    const msg = payload?.error || 'Não foi possível iniciar o checkout.';
                    throw new Error(msg);
                }

                const secret = payload?.clientSecret;
                if (!secret) throw new Error('Resposta inválida do servidor (clientSecret ausente).');
                if (!cancelled) setClientSecret(secret);
            } catch (err: any) {
                if (!cancelled) setClientSecretError(err?.message || 'Falha ao iniciar o checkout.');
            } finally {
                if (!cancelled) setLoadingClientSecret(false);
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [isOpen, planId, reloadNonce]);

    useEffect(() => {
        if (!isOpen) return;

        closeButtonRef.current?.focus();

        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const appearance = {
        theme: 'night' as const,
        variables: {
            colorPrimary: '#a855f7',
            colorBackground: '#1e1b4b',
            colorText: '#f8fafc',
            colorDanger: '#ef4444',
            fontFamily: 'Inter, system-ui, sans-serif',
            borderRadius: '12px',
        },
    };

    const options = {
        clientSecret,
        appearance,
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="payment-modal-title"
                aria-describedby="payment-modal-description"
                className="bg-[#0F0529] border border-white/10 rounded-3xl w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto"
            >
                <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={onClose}
                    aria-label="Fechar"
                    title="Fechar"
                    className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0529]"
                >
                    <X className="w-5 h-5" aria-hidden="true" />
                </button>

                <div className="mb-6">
                    <h2 id="payment-modal-title" className="text-xl font-bold text-white mb-1">Finalizar Pagamento</h2>
                    <p id="payment-modal-description" className="text-sm text-slate-400">Pague via PIX (QR Code).</p>
                </div>

                {!stripePromise ? (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-2xl px-4 py-3">
                        Checkout indisponível: configure VITE_STRIPE_PUBLIC_KEY.
                    </div>
                ) : clientSecretError ? (
                    <div className="space-y-4">
                        <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-2xl px-4 py-3">
                            {clientSecretError}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setReloadNonce((v) => v + 1)}
                                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all active:scale-95 text-xs uppercase tracking-wide"
                            >
                                Tentar novamente
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full bg-white/10 hover:bg-white/15 text-white font-bold py-3 rounded-xl border border-white/10 transition-all active:scale-95 text-xs uppercase tracking-wide"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                ) : clientSecret ? (
                    <Elements options={options} stripe={stripePromise}>
                        <CheckoutForm onSuccess={onSuccess} amount={amount} clientSecret={clientSecret} />
                    </Elements>
                ) : (
                    <div className="flex justify-center py-12">
                        <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                            {loadingClientSecret && (
                                <span className="text-xs text-slate-400">Carregando checkout...</span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
