import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Crown, Globe, MapPin } from 'lucide-react';
import {
    avatarFromProfile,
    formatRankingLastValidation,
    formatRankingLocation,
    getRankingPageCount,
    getRankingPageSlice,
    RankingProfile,
    toNumber
} from '../../lib/landingRanking';
import { shouldShowValidationCount } from '../../lib/rankingDisplay';
// [2026-04-15] Na landing o numero de validacoes NUNCA aparece. So posicao (#1, #2,...).
// shouldShowValidationCount ainda eh usado APENAS para calcular leaderCount (referencia
// interna da barra de progresso); o numero em si nao renderiza em nenhum card publico.

const PAGE_SIZE = 10;
const RANKING_EMPTY_STATE = 'min-h-[120px]';

interface LandingRankingCardsProps {
    loading: boolean;
    profiles: RankingProfile[];
    error: string | null;
    cycleLabel: string | null;
}

const renderSkeletonRows = () =>
    Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-transparent p-3 animate-pulse">
            <div className="h-10 w-10 rounded-full bg-white/10" />
            <div className="min-w-0 flex-1 space-y-2 text-left">
                <div className="h-4 w-36 rounded bg-white/10" />
                <div className="h-3 w-40 rounded bg-white/10" />
            </div>
            <div className="space-y-2 text-right">
                <div className="h-4 w-10 rounded bg-white/10" />
                <div className="h-3 w-20 rounded bg-white/10" />
            </div>
        </div>
    ));

const LandingRankingCards = ({ loading, profiles, error, cycleLabel }: LandingRankingCardsProps) => {
    const [currentPage, setCurrentPage] = useState(1);

    // [2026-04-15] Regra: TODO MUNDO aparece no ranking (nome, posicao, avatar, localizacao).
    // A unica coisa que fica oculta ate a pessoa atingir 100 validacoes eh o NUMERO de
    // validacoes. A lista continua cheia. Consistente com pedido do produto.
    const totalPages = useMemo(() => getRankingPageCount(profiles.length, PAGE_SIZE), [profiles.length]);
    const visibleProfiles = useMemo(
        () => getRankingPageSlice(profiles, currentPage, PAGE_SIZE),
        [profiles, currentPage]
    );

    useEffect(() => {
        setCurrentPage(1);
    }, [profiles]);

    // Lider visivel: so quem ja atingiu 100 serve de referencia pra barra de progresso.
    // Se ninguem atingiu ainda, leaderCount=0 e a barra fica zerada (inofensivo).
    const topEligible = profiles.find((p) => shouldShowValidationCount(p.validations_count));
    const leaderCount = topEligible ? Math.max(0, Math.trunc(toNumber(topEligible.validations_count))) : 0;

    return (
        <div className="space-y-2 md:space-y-3">
            <div className="overflow-hidden rounded-[32px] border border-white/5 bg-[#1A0B2E] shadow-2xl">
                <div className="border-b border-white/5 bg-white/[0.02] p-6 pb-4">
                    <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20">
                                    <Globe className="h-4 w-4 text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-purple-300">Ranking</p>
                                    <p className="text-lg font-black leading-none text-white">Geral</p>
                                </div>
                            </div>
                            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                                Visão consolidada da plataforma, com todos os participantes no mesmo ranking e a localização de cada perfil no próprio card.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-slate-200">
                                {profiles.length} participantes
                            </span>
                            {cycleLabel && (
                                <span className="inline-flex items-center rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-amber-200">
                                    {cycleLabel}
                                </span>
                            )}
                            <span className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white shadow-lg">
                                Página {currentPage}/{totalPages}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2 px-4 py-4 lg:max-h-[720px] lg:overflow-y-auto lg:pr-3">
                    {loading ? renderSkeletonRows() : error ? (
                        <div className={`flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center ${RANKING_EMPTY_STATE}`}>
                            <p className="text-base font-bold text-white">Não foi possível carregar o ranking</p>
                            <p className="mt-1 text-sm text-slate-400">{error}</p>
                        </div>
                    ) : profiles.length === 0 ? (
                        <div className={`flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center ${RANKING_EMPTY_STATE}`}>
                            <p className="text-base font-bold text-white">Ainda não há ranking disponível</p>
                            <p className="mt-1 text-sm text-slate-400">Assim que houver validações registradas, o ranking geral aparecerá aqui.</p>
                        </div>
                    ) : (
                        visibleProfiles.map((user, index) => {
                            const absoluteIndex = (currentPage - 1) * PAGE_SIZE + index;
                            const fullName = `${user.name || ''} ${user.lastname || ''}`.trim() || 'Usuário';
                            const count = Math.max(0, Math.trunc(toNumber(user.validations_count)));
                            const gapToLeader = Math.max(0, leaderCount - count);
                            const progressPct = leaderCount > 0 ? Math.min(100, Math.round((count / leaderCount) * 100)) : 0;
                            const isLeader = absoluteIndex === 0;
                            const lastValidationLabel = formatRankingLastValidation(user.last_validation_at);

                            return (
                                <div
                                    key={user.id}
                                    className={`flex items-center gap-3 rounded-2xl border p-3 transition-all hover:bg-white/5 ${
                                        isLeader
                                            ? 'border-yellow-500/20 bg-gradient-to-r from-yellow-500/10 to-transparent'
                                            : 'border-white/5 bg-transparent'
                                    }`}
                                >
                                    <div className="relative shrink-0">
                                        <div className={`h-10 w-10 rounded-full p-0.5 ${isLeader ? 'border-2 border-yellow-400' : 'border border-white/10'}`}>
                                            <img src={avatarFromProfile(user)} alt={fullName} className="h-full w-full rounded-full object-cover" />
                                        </div>
                                        {isLeader && <Crown className="absolute -right-1 -top-2 h-4 w-4 animate-bounce fill-yellow-400 text-yellow-400" />}
                                        <div className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border text-[9px] font-bold ${
                                            isLeader ? 'border-yellow-400 bg-yellow-500 text-black' : 'border-slate-700 bg-slate-800 text-slate-300'
                                        }`}>
                                            {absoluteIndex + 1}
                                        </div>
                                    </div>

                                    <div className="min-w-0 flex-1 text-left">
                                        <p className={`truncate text-sm font-bold ${isLeader ? 'text-yellow-100' : 'text-white'}`}>{fullName}</p>
                                        <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                                            <MapPin className="h-3 w-3 shrink-0" />
                                            {formatRankingLocation(user)}
                                        </p>
                                        <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                                            {leaderCount > 0 ? (
                                                <div
                                                    className={`h-full rounded-full transition-[width] duration-700 ${
                                                        isLeader
                                                            ? 'bg-gradient-to-r from-yellow-400 to-amber-300'
                                                            : 'bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400'
                                                    }`}
                                                    style={{ width: `${progressPct}%` }}
                                                />
                                            ) : (
                                                // [2026-04-15] Ninguem atingiu 100 ainda: barra animada (shimmer) pra nao ficar vazia.
                                                <div className="ranking-progress-shimmer absolute inset-0 h-full w-full rounded-full bg-gradient-to-r from-purple-500/40 via-indigo-400/70 to-cyan-400/40" />
                                            )}
                                        </div>
                                        {/* [2026-04-15] Removido "Faltam X para #1" a pedido do produto.
                                            Mantidos somente os rotulos de Lider / Empatado (informacao positiva). */}
                                        {(isLeader || gapToLeader === 0) && (
                                            <p className="mt-1 text-[10px] font-semibold text-slate-500">
                                                {isLeader ? 'Líder do ranking geral' : 'Empatado com o líder'}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-col items-end text-right">
                                        {/* [2026-04-15] Publica: so posicao, nunca numero de validacoes. */}
                                        <p className={`text-base font-black leading-none ${isLeader ? 'text-yellow-100' : 'text-purple-200'}`}>#{absoluteIndex + 1}</p>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">posição</p>
                                        {lastValidationLabel && (
                                            <div
                                                className="mt-1 rounded bg-white/5 px-1.5 py-1 text-right"
                                                title="Data e horário da última validação"
                                            >
                                                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Última validação</p>
                                                <p className="text-[10px] font-semibold text-purple-200">{lastValidationLabel}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {profiles.length > PAGE_SIZE && (
                    <div className="flex flex-col gap-3 border-t border-white/5 bg-white/[0.02] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-slate-400">
                            Exibindo participantes {(currentPage - 1) * PAGE_SIZE + 1} a {Math.min(currentPage * PAGE_SIZE, profiles.length)} de {profiles.length}.
                        </p>
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                                type="button"
                                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                                disabled={currentPage === 1}
                                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Anterior
                            </button>
                            <button
                                type="button"
                                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                                disabled={currentPage === totalPages}
                                className="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Próxima
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LandingRankingCards;
