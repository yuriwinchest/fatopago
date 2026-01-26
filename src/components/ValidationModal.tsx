
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle, XCircle, Share2, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const withTimeout = (promise: Promise<any>, ms: number, message: string): Promise<any> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
    }) as Promise<any>;
};

interface NewsTask {
    id: string;
    content: {
        title: string;
        description: string;
        reward: number;
        category: string;
        source: string;
        difficulty: string;
        image_url?: string;
    };
}

interface ValidationModalProps {
    task: NewsTask;
    isOpen: boolean;
    onClose: () => void;
    onValidated: () => void; // Callback to refresh dashboard
}

// Main Component
const ValidationModal = ({ task, isOpen, onClose, onValidated }: ValidationModalProps) => {
    const [voting, setVoting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    // False Justification State
    const [isFalseFlow, setIsFalseFlow] = useState(false);
    const [justification, setJustification] = useState("");
    const [proofLink, setProofLink] = useState("");
    // const [proofFile, setProofFile] = useState<File | null>(null);

    if (!isOpen) return null;

    const sheetRef = useRef<HTMLDivElement | null>(null);
    const initialFocusRef = useRef<HTMLButtonElement | null>(null);

    const safePaddingStyle = useMemo(
        () =>
            ({
                paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
                paddingTop: 'calc(8px + env(safe-area-inset-top))'
            }) as React.CSSProperties,
        []
    );

    useEffect(() => {
        // Focus the primary action on open for better "native" feel
        initialFocusRef.current?.focus();
    }, []);

    const handleVote = async (verdict: boolean) => {
        if (verdict === false && !isFalseFlow) {
            setIsFalseFlow(true);
            return;
        }

        // If false flow, validate inputs
        if (verdict === false && isFalseFlow) {
            if (justification.length < 10) {
                alert("Por favor, justifique com pelo menos 10 caracteres.");
                return;
            }
        }

        setVoting(true);

        try {
            // 1. Get User
            const { data: { session }, error: sessionError } = await withTimeout(
                supabase.auth.getSession(),
                8000,
                "Tempo excedido ao validar sessão. Tente novamente."
            );
            if (sessionError) throw sessionError;
            const user = session?.user;
            if (!user) throw new Error("Usuário não autenticado");

            // 2. Upload File if specific (Optional for now as Supabase Storage setup is unknown)
            // For now, we will skip actual file upload to bucket and focus on logic,
            // or we could assume a bucket exists. To avoid breakage, we won't upload file yet 
            // but we will simulate it.

            // 3. Insert Validation
            const { error: insertError } = await supabase.from('validations').insert({
                task_id: task.id,
                user_id: user.id,
                verdict: verdict,
                // Assuming schema might accept these JSON/Text fields, if not they will be ignored or error.
                // Since I can't migrate schema effortlessly right now, I will try to save.
                // If it fails, I'll fallback to basic validation.
                justification: verdict ? null : justification,
                proof_link: verdict ? null : proofLink
            });

            if (insertError) {
                // If schema doesn't support justification yet, DON'T silently drop the data for "FALSO".
                if (insertError.message.includes("column")) {
                    if (verdict === false) {
                        throw new Error(
                            "Seu app precisa de uma atualização no banco para salvar a justificativa do FALSO. (Campos: validations.justification e validations.proof_link)"
                        );
                    }

                    // For TRUE votes we can safely fallback (no extra fields needed)
                    const { error: fallbackError } = await supabase.from('validations').insert({
                        task_id: task.id,
                        user_id: user.id,
                        verdict: verdict
                    });
                    if (fallbackError) throw fallbackError;
                } else {
                    throw insertError;
                }
            }

            // 4. Update User Profile
            const { data: profile } = await supabase.from('profiles').select('current_balance, reputation_score').eq('id', user.id).single();

            if (profile) {
                const newBalance = (profile.current_balance || 0) + task.content.reward;
                const newScore = (profile.reputation_score || 0) + 10;

                await supabase.from('profiles').update({
                    current_balance: newBalance,
                    reputation_score: newScore
                }).eq('id', user.id);
            }

            // Success Animation
            setShowSuccess(true);

            // Wait and close
            setTimeout(() => {
                setShowSuccess(false);
                setVoting(false);
                setIsFalseFlow(false); // Reset
                setJustification("");
                setProofLink("");
                onValidated();
                onClose();
            }, 1500);

        } catch (err) {
            console.error("Error submitting vote:", err);
            setVoting(false);
            alert("Erro ao enviar validação. Tente novamente.");
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Validar notícia"
            onMouseDown={(e) => {
                // close on backdrop tap/click (mobile-native behavior)
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={sheetRef}
                className="bg-[#1A1040] w-full md:max-w-lg border border-white/10 shadow-2xl relative overflow-hidden flex flex-col h-[92vh] md:h-auto md:max-h-[90vh] rounded-t-[28px] md:rounded-3xl animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-200"
                style={safePaddingStyle}
            >
                {/* Drag handle (mobile affordance) */}
                <div className="md:hidden pt-2 pb-1 flex justify-center">
                    <div className="h-1 w-12 rounded-full bg-white/15" />
                </div>

                {/* Header */}
                <div className="px-5 md:px-6 pt-2 md:pt-4 pb-3 border-b border-white/5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <span className="inline-flex bg-purple-500/20 text-purple-300 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                            {task.content.category}
                        </span>
                        <h2 className="mt-3 text-base md:text-xl font-bold text-white leading-snug pr-2 line-clamp-3">
                            {task.content.title}
                        </h2>
                    </div>

                    {!showSuccess && (
                        <button
                            onClick={onClose}
                            className="shrink-0 h-11 w-11 grid place-items-center rounded-full bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
                            aria-label="Fechar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Success Overlay */}
                {showSuccess && (
                    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#0F0529]/95 backdrop-blur-md">
                        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center border-4 border-green-500 mb-4 animate-[bounce_1s_infinite]">
                            <CheckCircle className="w-10 h-10 text-green-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Validado!</h2>
                        <p className="text-green-400 font-bold text-xl mt-1">+ R$ {task.content.reward.toFixed(2)}</p>
                    </div>
                )}

                {/* Body */}
                <div className="px-5 md:px-6 py-4 overflow-y-auto flex-1">

                    {/* Only show description if NOT in False Flow to save space, or keep small? Keep. */}
                    {!isFalseFlow && (
                        <div className="bg-black/20 p-4 rounded-xl border border-white/5 mb-6 max-h-40 overflow-y-auto">
                            <div className="flex items-center gap-2 mb-2">
                                <Share2 className="w-3 h-3 text-purple-400" />
                                <span className="text-xs font-bold text-purple-300 uppercase">Fonte: {task.content.source}</span>
                            </div>
                            <p className="text-slate-300 text-sm leading-relaxed mb-4">
                                {task.content.description}
                            </p>
                            {task.content.image_url && (
                                <img src={task.content.image_url} alt="Reference" className="w-full h-32 object-cover rounded-lg opacity-60 hover:opacity-100 transition-opacity" />
                            )}
                        </div>
                    )}

                    {/* False Justification Form */}
                    {isFalseFlow ? (
                        <div className="space-y-4 mb-6 animate-in slide-in-from-bottom-5 fade-in duration-300">
                            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                                <p className="text-sm text-red-200">Você identificou esta notícia como <b>Falsa</b>. Por favor, forneça provas.</p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase">Justificativa <span className="text-red-400">*</span></label>
                                <textarea
                                    value={justification}
                                    onChange={(e) => setJustification(e.target.value)}
                                    placeholder="Explique por que esta notícia é falsa..."
                                    className="w-full bg-black/20 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-red-500/50 outline-none min-h-[112px] resize-none"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase">Link de Prova</label>
                                <input
                                    type="url"
                                    value={proofLink}
                                    onChange={(e) => setProofLink(e.target.value)}
                                    placeholder="https://fonte-confiavel.com/..."
                                    className="w-full bg-black/20 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-red-500/50 outline-none min-h-[48px]"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-400 uppercase">Anexar Foto (Opcional)</label>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        // onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                                        className="w-full bg-black/20 border border-white/10 rounded-2xl p-2 text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer min-h-[48px]"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-center text-slate-400 text-xs uppercase font-bold tracking-widest mb-2">Qual seu veredito?</p>
                        </div>
                    )}
                </div>

                {/* Footer actions (sticky, thumb-zone, native-like) */}
                <div className="px-5 md:px-6 pt-3 pb-4 border-t border-white/5 bg-[#1A1040]/95 backdrop-blur-md">
                    <div className="grid grid-cols-2 gap-3">
                        {!isFalseFlow ? (
                            <>
                                <button
                                    ref={initialFocusRef}
                                    onClick={() => handleVote(true)}
                                    disabled={voting}
                                    className="min-h-[52px] bg-green-600 hover:bg-green-500 text-white font-black rounded-2xl transition-all shadow-lg hover:shadow-green-500/20 disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {voting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                                    <span className="text-xs tracking-wide">VERDADEIRO</span>
                                </button>

                                <button
                                    onClick={() => handleVote(false)}
                                    disabled={voting}
                                    className="min-h-[52px] bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl transition-all shadow-lg hover:shadow-red-500/20 disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    <XCircle className="w-5 h-5" />
                                    <span className="text-xs tracking-wide">FALSO</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => setIsFalseFlow(false)}
                                    disabled={voting}
                                    className="min-h-[52px] bg-white/5 hover:bg-white/10 text-slate-200 font-black rounded-2xl transition-all active:scale-[0.98]"
                                >
                                    <span className="text-xs tracking-wide">VOLTAR</span>
                                </button>

                                <button
                                    onClick={() => handleVote(false)}
                                    disabled={voting}
                                    className="min-h-[52px] bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl transition-all shadow-lg hover:shadow-red-500/20 disabled:opacity-50 active:scale-[0.98] flex items-center justify-center gap-2"
                                >
                                    {voting ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
                                    <span className="text-xs tracking-wide">CONFIRMAR</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ValidationModal;
