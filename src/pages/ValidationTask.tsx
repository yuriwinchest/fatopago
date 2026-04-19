import { useState } from 'react';
import {
    AlertCircle,
    CheckCircle,
    Copy,
    ExternalLink,
    History,
    Loader2,
    Upload,
    XCircle
} from 'lucide-react';
import { useValidationTask } from '../hooks/useValidationTask';
import { AppLayout } from '../layouts/AppLayout';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { cn } from '../utils/classNames';
import {
    uploadValidationProofImage,
    validateFalseEvidenceInput,
    VALIDATION_PROOF_ACCEPT
} from '../lib/validationProofs';

const ValidationTask = () => {
    const {
        task,
        loading,
        voting,
        showSuccess,
        showHistory,
        setShowHistory,
        recentValidations,
        handleVote,
        navigate,
        planBlocked,
        planMessage
    } = useValidationTask();

    const [isFalseFlow, setIsFalseFlow] = useState(false);
    const [justification, setJustification] = useState('');
    const [proofLink, setProofLink] = useState('');
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [showInAppReader, setShowInAppReader] = useState(false);
    const [falseEvidenceError, setFalseEvidenceError] = useState<string | null>(null);

    const resetFalseEvidence = () => {
        setIsFalseFlow(false);
        setJustification('');
        setProofLink('');
        setProofFile(null);
        setFalseEvidenceError(null);
    };

    const sourceLink = task?.content?.link || '';
    const fullText = (task?.content?.full_text || '').trim();
    const displayText = (fullText || task?.content?.description || '').trim();
    const isExcerptOnly = !fullText && !!displayText && displayText.endsWith('...') && !!sourceLink;

    const handleCopyLink = async () => {
        if (!sourceLink) return;
        try {
            await navigator.clipboard.writeText(sourceLink);
            setLinkCopied(true);
            window.setTimeout(() => setLinkCopied(false), 1500);
        } catch {
            // Fallback: at least show the link for manual copy.
            window.prompt('Copie o link da notícia:', sourceLink);
        }
    };

    const onVote = async (verdict: boolean) => {
        if (verdict === false && !isFalseFlow) {
            setIsFalseFlow(true);
            setFalseEvidenceError(null);
            return;
        }

        if (verdict === false && isFalseFlow) {
            const validation = validateFalseEvidenceInput({
                justification,
                proofLink,
                proofFile
            });

            if (!validation.ok) {
                setFalseEvidenceError(validation.error);
                return;
            }

            setFalseEvidenceError(null);
            try {
                const proofImageUrl = await uploadValidationProofImage(validation.data.proofFile);
                await handleVote(false, validation.data.justification, validation.data.proofLink, proofImageUrl);
            } catch (error: any) {
                setFalseEvidenceError(error?.message || 'Não foi possível enviar a foto da prova.');
            }
            return;
        }

        await handleVote(verdict, justification, proofLink);
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0F0529] text-white">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
        );
    }

    if (!task) {
        if (planBlocked) {
            return (
                <AppLayout title="Validação" showBackButton={true}>
                    <Card tone="soft" className="mx-auto max-w-2xl border-yellow-500/30 bg-yellow-500/10 p-6 text-center">
                        <p className="text-sm text-yellow-100">
                            {planMessage || 'Você não tem notícias disponíveis para validar.'}
                        </p>
                        <Button
                            className="mt-4"
                            onClick={() => navigate('/plans?reason=no-balance&returnTo=/validation')}
                        >
                            Escolher plano
                        </Button>
                    </Card>
                </AppLayout>
            );
        }

        return (
            <AppLayout title="Validação" showBackButton={true}>
                <Card tone="soft" className="mx-auto max-w-xl border-white/10 bg-white/5 p-6 text-center">
                    <p className="text-sm text-slate-300">Tarefa não encontrada.</p>
                    <Button variant="secondary" className="mt-4" onClick={() => navigate('/validation')}>
                        Voltar ao Painel
                    </Button>
                </Card>
            </AppLayout>
        );
    }

    return (
        <AppLayout
            title="Validar Notícia"
            subtitle="Analise o conteúdo e registre seu veredito"
            showBackButton={true}
        >
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F0529]/90 backdrop-blur-sm">
                    <div className="text-center">
                        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-green-500 bg-green-500/20">
                            <CheckCircle className="h-12 w-12 text-green-500" />
                        </div>
                        <h2 className="mb-2 text-3xl font-bold text-white">Validação confirmada</h2>
                        <p className="h-8 text-xl font-bold text-purple-300">Consumo: 1 notícia do pacote</p>
                        <p className="mt-4 text-sm text-slate-400">Redirecionando...</p>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                <div className="flex justify-end">
                    <Button
                        variant={showHistory ? 'primary' : 'secondary'}
                        className="min-h-0 px-4 py-2 text-xs"
                        onClick={() => setShowHistory(!showHistory)}
                        leftIcon={<History className="h-4 w-4" />}
                    >
                        Histórico
                    </Button>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                    <section className="space-y-4 xl:col-span-8">
                        <Card tone="elevated" className="relative overflow-hidden border-white/10 bg-[#1A1040] p-6">
                            <div className="absolute right-0 top-0 rounded-bl-2xl bg-purple-600 px-3 py-1.5 text-xs font-bold">
                                CONSOME 1 NOTÍCIA
                            </div>

                            <div className="mb-6 mt-4 flex items-center justify-between">
                                <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    {task.content.category}
                                </span>
                                
                                <div className="flex gap-2">
                                    <span className="rounded-md border border-green-400/20 bg-green-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-green-400">
                                        É Fato
                                    </span>
                                    <span className="rounded-md border border-red-400/20 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-red-400">
                                        É Fake
                                    </span>
                                </div>
                            </div>

                            <h2 className="mb-4 text-2xl font-bold leading-tight text-white">
                                {task.content.title}
                            </h2>

                             {!isFalseFlow ? (
                                 <div className="mb-6 rounded-xl border border-white/5 bg-black/20 p-4">
                                     <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                                         {sourceLink && (
                                             <div className="flex flex-wrap items-center justify-end gap-2">
                                                 <a
                                                     href={sourceLink}
                                                     target="_blank"
                                                     rel="noreferrer noopener"
                                                     className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white hover:bg-white/10"
                                                 >
                                                     Abrir fonte <ExternalLink className="h-3.5 w-3.5" />
                                                 </a>
                                                 {isExcerptOnly && (
                                                     <button
                                                         type="button"
                                                         onClick={() => setShowInAppReader((v) => !v)}
                                                         className="inline-flex items-center gap-1.5 rounded-full border border-purple-400/20 bg-purple-600/20 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-purple-100 hover:bg-purple-600/30"
                                                     >
                                                         {showInAppReader ? 'Fechar leitor' : 'Ler no app'} <ExternalLink className="h-3.5 w-3.5" />
                                                     </button>
                                                 )}
                                                 <button
                                                     type="button"
                                                     onClick={() => void handleCopyLink()}
                                                     className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-200 hover:bg-white/10"
                                                 >
                                                     {linkCopied ? 'Copiado' : 'Copiar link'} <Copy className="h-3.5 w-3.5" />
                                                 </button>
                                             </div>
                                         )}
                                     </div>

                                     <div className={cn(
                                         'rounded-xl border border-white/5 bg-black/10 p-4',
                                         displayText.length > 900 ? 'max-h-[52vh] overflow-y-auto pr-2 custom-scrollbar' : ''
                                     )}>
                                         <p className="text-base leading-relaxed text-slate-200 whitespace-pre-line break-words">
                                             {displayText || 'Conteúdo indisponível.'}
                                         </p>
                                     </div>

                                     {isExcerptOnly && (
                                         <p className="mt-3 text-xs leading-relaxed text-slate-400">
                                             Este texto é um <b>resumo</b>. Para ler a notícia completa, clique em <b>Ler no app</b> ou <b>Abrir fonte</b>.
                                         </p>
                                     )}

                                     {showInAppReader && sourceLink && (
                                         <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                                             <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3">
                                                 <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-200">
                                                     Leitor no app
                                                 </span>
                                                 <button
                                                     type="button"
                                                     onClick={() => setShowInAppReader(false)}
                                                     className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-200 hover:bg-white/10"
                                                 >
                                                     Fechar
                                                 </button>
                                             </div>
                                             <iframe
                                                 src={sourceLink}
                                                 title="Notícia (fonte)"
                                                 className="h-[70vh] w-full bg-black"
                                                 referrerPolicy="no-referrer"
                                             />
                                             <div className="px-4 py-3 text-xs text-slate-400">
                                                 Se a página não carregar aqui, o site pode bloquear embed (X-Frame-Options/CSP). Nesse caso, use <b>Abrir fonte</b>.
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             ) : (
                                 <div className="mb-6 space-y-4">
                                    <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                                        <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                                        <p className="text-sm text-red-200">
                                            Você identificou esta notícia como <b>falsa</b>. Para confirmar, informe a justificativa, o link da prova e anexe a foto da evidência.
                                        </p>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label htmlFor="page-validation-justification" className="text-xs font-bold uppercase text-slate-400">
                                            Justificativa da reprovação
                                        </label>
                                        <textarea
                                            id="page-validation-justification"
                                            value={justification}
                                            onChange={(e) => {
                                                setJustification(e.target.value);
                                                if (falseEvidenceError) setFalseEvidenceError(null);
                                            }}
                                            placeholder="Explique por que esta notícia é falsa e qual é a inconsistência encontrada..."
                                            className="min-h-[112px] w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-red-500/50"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label htmlFor="page-validation-proof-link" className="text-xs font-bold uppercase text-slate-400">
                                            Link da fonte ou da prova
                                        </label>
                                        <input
                                            id="page-validation-proof-link"
                                            type="url"
                                            value={proofLink}
                                            onChange={(e) => {
                                                setProofLink(e.target.value);
                                                if (falseEvidenceError) setFalseEvidenceError(null);
                                            }}
                                            placeholder="https://fonte-confiavel.com/..."
                                            className="min-h-[48px] w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-red-500/50"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label htmlFor="page-validation-proof-file" className="text-xs font-bold uppercase text-slate-400">
                                            Foto da evidência
                                        </label>
                                        <label
                                            htmlFor="page-validation-proof-file"
                                            className="flex min-h-[68px] cursor-pointer items-center justify-between gap-3 rounded-2xl border border-dashed border-white/15 bg-black/20 px-4 py-3 transition-all hover:border-red-500/40 hover:bg-black/30"
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-white">
                                                    {proofFile ? proofFile.name : 'Selecione a foto que comprova a falsidade'}
                                                </p>
                                                <p className="mt-1 text-xs text-slate-400">
                                                    PNG, JPG, WEBP, AVIF ou HEIC com até 5 MB
                                                </p>
                                            </div>
                                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-slate-300">
                                                <Upload className="h-4 w-4" />
                                            </span>
                                        </label>
                                        <input
                                            id="page-validation-proof-file"
                                            type="file"
                                            accept={VALIDATION_PROOF_ACCEPT}
                                            className="hidden"
                                            onChange={(e) => {
                                                setProofFile(e.target.files?.[0] || null);
                                                if (falseEvidenceError) setFalseEvidenceError(null);
                                            }}
                                        />
                                    </div>

                                    {falseEvidenceError && (
                                        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                            {falseEvidenceError}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                                <span>Consumo por validação: 1 notícia</span>
                                <span>Fonte original disponível</span>
                            </div>
                        </Card>

                        <Card tone="default" className="border-white/10 bg-[#1A1040] p-5">
                            <p className="mb-4 text-center text-sm text-slate-400">Esta notícia é fato ou fake?</p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {!isFalseFlow ? (
                                    <>
                                        <button
                                            onClick={() => void onVote(true)}
                                            disabled={voting}
                                            className="flex flex-col items-center gap-1 rounded-2xl border-b-4 border-green-800 bg-gradient-to-br from-green-500 to-green-700 py-4 font-bold text-white shadow-lg transition-all active:translate-y-1 active:border-b-0 disabled:opacity-50"
                                        >
                                            <CheckCircle className="h-6 w-6" />
                                            É FATO
                                        </button>

                                        <button
                                            onClick={() => void onVote(false)}
                                            disabled={voting}
                                            className="flex flex-col items-center gap-1 rounded-2xl border-b-4 border-red-800 bg-gradient-to-br from-red-500 to-red-700 py-4 font-bold text-white shadow-lg transition-all active:translate-y-1 active:border-b-0 disabled:opacity-50"
                                        >
                                            <XCircle className="h-6 w-6" />
                                            É FAKE
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={resetFalseEvidence}
                                            disabled={voting}
                                            className="rounded-2xl bg-white/5 py-4 font-bold text-slate-200 transition-all hover:bg-white/10 disabled:opacity-50"
                                        >
                                            VOLTAR
                                        </button>

                                        <button
                                            onClick={() => void onVote(false)}
                                            disabled={voting}
                                            className="flex flex-col items-center justify-center gap-1 rounded-2xl border-b-4 border-red-800 bg-gradient-to-br from-red-500 to-red-700 py-4 font-bold text-white shadow-lg transition-all active:translate-y-1 active:border-b-0 disabled:opacity-50"
                                        >
                                            {voting ? <Loader2 className="h-6 w-6 animate-spin" /> : <XCircle className="h-6 w-6" />}
                                            CONFIRMAR
                                        </button>
                                    </>
                                )}
                            </div>
                        </Card>
                    </section>

                    <aside className="xl:col-span-4">
                        <Card tone="default" className="border-white/10 bg-[#1A1040] p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Últimas validações</h3>
                                {showHistory && <span className="h-2 w-2 rounded-full bg-red-500" />}
                            </div>
                            <div className="max-h-[460px] space-y-3 overflow-y-auto pr-1">
                                {showHistory && recentValidations.length > 0 ? (
                                    recentValidations.map((val: any) => (
                                        <div key={val.id} className="flex items-start gap-3 border-b border-white/5 pb-3 last:border-0">
                                            <div className={cn(
                                                'mt-0.5 h-2 w-2 shrink-0 rounded-full',
                                                val.verdict ? 'bg-green-500' : 'bg-red-500'
                                            )} />
                                            <div>
                                                <p className="text-xs font-bold leading-tight text-white">
                                                    {val.news_tasks?.content?.title || 'Notícia validada'}
                                                </p>
                                                <p className="mt-1 text-[10px] text-slate-500">
                                                    {new Date(val.created_at).toLocaleDateString('pt-BR')} - {val.verdict ? 'Aprovado' : 'Reprovado'}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="py-4 text-center text-xs text-slate-500">
                                        {showHistory ? 'Nenhuma validação recente.' : 'Clique em Histórico para exibir.'}
                                    </p>
                                )}
                            </div>
                        </Card>
                    </aside>
                </div>
            </div>
        </AppLayout>
    );
};

export default ValidationTask;
