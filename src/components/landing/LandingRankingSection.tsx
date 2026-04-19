import { MapPin, RefreshCw, Search, Wallet } from 'lucide-react';
import LandingRankingCards from './LandingRankingCards';
import { avatarFromProfile, CycleMeta, formatBRL, RankingProfile, toNumber } from '../../lib/landingRanking';
// [2026-04-15] Landing nao expoe numero de validacoes publicamente, so posicao.

interface LocationStateOption {
    id: number | string;
    sigla: string;
}

interface LocationCityOption {
    id: number | string;
    nome: string;
}

interface RankingModeData {
    loading: boolean;
    profiles: RankingProfile[];
    error: string | null;
    cycleMeta: CycleMeta | null;
    updatedAt: Date | null;
}

interface LandingRankingSectionProps {
    sectionPaddingX: string;
    sectionPaddingTop: string;
    searchName: string;
    onSearchNameChange: (value: string) => void;
    searchState: string;
    onSearchStateChange: (value: string) => void;
    searchCity: string;
    onSearchCityChange: (value: string) => void;
    states: LocationStateOption[];
    cities: LocationCityOption[];
    onSearch: () => void | Promise<void>;
    isSearching: boolean;
    hasSearched: boolean;
    foundUser: RankingProfile | null;
    foundUserCycle: 'current' | 'previous' | 'profile' | null;
    previousRanking: RankingModeData;
    currentRanking: RankingModeData;
    formatCycleRange: (meta: CycleMeta | null) => string | null;
    historicalWinners: any[];
    historicalWinnersLoading: boolean;
}

const LandingRankingSection = ({
    sectionPaddingX,
    sectionPaddingTop,
    searchName,
    onSearchNameChange,
    searchState,
    onSearchStateChange,
    searchCity,
    onSearchCityChange,
    states,
    cities,
    onSearch,
    isSearching,
    hasSearched,
    foundUser,
    foundUserCycle,
    previousRanking,
    currentRanking,
    formatCycleRange,
    historicalWinners,
    historicalWinnersLoading
}: LandingRankingSectionProps) => {
    const topPreviousCycleWinner = previousRanking.profiles.length > 0 ? previousRanking.profiles[0] : null;
    const topPreviousCycleWinnerName = topPreviousCycleWinner
        ? `${topPreviousCycleWinner.name || ''} ${topPreviousCycleWinner.lastname || ''}`.trim() || 'Usuário'
        : null;
    const topPreviousCycleWinnerLoc = topPreviousCycleWinner
        ? `${topPreviousCycleWinner.city || '—'}, ${topPreviousCycleWinner.state || '—'}`
        : null;
    const topPreviousCycleWinnerCount = topPreviousCycleWinner
        ? Math.max(0, Math.trunc(toNumber(topPreviousCycleWinner.validations_count)))
        : 0;

    const currentCycleLabel = currentRanking.cycleMeta?.cycleNumber
        ? `Ciclo #${currentRanking.cycleMeta.cycleNumber}`
        : 'Ciclo atual';

    // [2026-04-15] Calcula a POSICAO do foundUser na lista correta (ciclo atual ou anterior).
    // Se estiver em 'profile', ele nao esta em nenhum ranking do ciclo -> sem posicao.
    const foundUserRank = (() => {
        if (!foundUser) return null;
        if (foundUserCycle === 'current') {
            const idx = currentRanking.profiles.findIndex((p) => p.id === foundUser.id);
            return idx >= 0 ? idx + 1 : null;
        }
        if (foundUserCycle === 'previous') {
            const idx = previousRanking.profiles.findIndex((p) => p.id === foundUser.id);
            return idx >= 0 ? idx + 1 : null;
        }
        return null;
    })();

    return (
        <section className={`${sectionPaddingX} ${sectionPaddingTop} relative`}>
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 md:gap-5">
                <div className="relative mt-0 overflow-hidden rounded-[32px] border border-purple-500/30 bg-[#2E0259]/80 p-6 shadow-2xl">
                    <div className="pointer-events-none absolute right-0 top-0 -z-10 h-96 w-96 rounded-full bg-purple-500/10 blur-[100px]" />

                    <div className="relative z-10 flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex-1 text-center xl:text-left">
                            <h3 className="title-duo-gradient inline-block text-2xl font-black md:text-3xl">Consulte sua Posição</h3>
                            <p className="mt-2 text-sm leading-relaxed text-slate-300 md:text-base">
                                Pesquise um participante e veja sua posição com localização consolidada no ranking geral da plataforma.
                            </p>
                        </div>

                        <div className="flex w-full flex-col gap-2.5 sm:flex-row md:gap-3 xl:w-auto">
                            <div className="relative w-full sm:w-64">
                                <input
                                    type="text"
                                    value={searchName}
                                    onChange={(e) => onSearchNameChange(e.target.value)}
                                    placeholder="Buscar pelo nome..."
                                    className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 pl-11 text-sm text-white transition-all placeholder:text-slate-500 focus:border-purple-500 focus:outline-none"
                                />
                                <Search className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                            </div>

                            <div className="relative w-full sm:w-32">
                                <select 
                                    className="h-12 w-full appearance-none rounded-2xl border border-white/10 bg-white/5 py-0 pl-10 pr-4 text-xs font-bold text-white shadow-xl outline-none ring-indigo-500/50 transition-all focus:border-indigo-500/50 focus:ring-4 sm:pr-10"
                                    value={searchState}
                                    onChange={(e) => onSearchStateChange(e.target.value)}
                                    title="Selecionar Estado"
                                >
                                    <option value="">UF</option>
                                    {states.map((state) => (
                                        <option key={state.id} value={state.sigla} className="bg-[#2E0259]">
                                            {state.sigla}
                                        </option>
                                    ))}
                                </select>
                                <MapPin className="pointer-events-none absolute left-3 top-4 h-4 w-4 text-slate-400" />
                            </div>

                            <div className="relative w-full sm:w-48">
                                <select 
                                    className="h-12 w-full appearance-none rounded-2xl border border-white/10 bg-white/5 py-0 pl-10 pr-4 text-xs font-bold text-white shadow-xl outline-none ring-indigo-500/50 transition-all focus:border-indigo-500/50 focus:ring-4 sm:pr-10"
                                    value={searchCity}
                                    onChange={(e) => onSearchCityChange(e.target.value)}
                                    disabled={!searchState || cities.length === 0}
                                    title="Selecionar Cidade"
                                >
                                    <option value="">Cidade</option>
                                    {cities.map((city) => (
                                        <option key={city.id} value={city.nome} className="bg-[#2E0259]">
                                            {city.nome}
                                        </option>
                                    ))}
                                </select>
                                <MapPin className="pointer-events-none absolute left-3 top-4 h-4 w-4 text-slate-400" />
                            </div>

                            <button
                                onClick={onSearch}
                                disabled={isSearching}
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 font-bold text-white shadow-lg shadow-purple-500/20 transition-all hover:bg-purple-500 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
                            >
                                {isSearching ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Consultar'}
                            </button>
                        </div>
                    </div>

                    {foundUser && (
                        <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 animate-in fade-in slide-in-from-top-4 sm:flex-row sm:items-center">
                            <div className="shrink-0">
                                <div className="h-16 w-16 rounded-full border-2 border-green-400 p-0.5">
                                    <img
                                        src={avatarFromProfile(foundUser)}
                                        alt={`${foundUser.name || 'Usuário'} ${foundUser.lastname || ''}`.trim()}
                                        className="h-full w-full rounded-full object-cover"
                                    />
                                </div>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-lg font-bold text-white">
                                    {foundUser.name} {foundUser.lastname || ''}
                                </h4>
                                <p className="flex items-center gap-1.5 text-sm text-slate-400">
                                    <MapPin className="h-3.5 w-3.5" /> Município/Cidade: {foundUser.city || '—'} • UF: {foundUser.state || '—'}
                                    {/* [2026-04-15] Na landing nao se expoe contagem. So posicao. */}
                                    {foundUserRank ? (
                                        <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[11px] font-black uppercase tracking-widest text-purple-200">
                                            #{foundUserRank} no ranking
                                        </span>
                                    ) : (
                                        <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
                                            Sem posição no ciclo
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                                    {foundUserCycle === 'previous'
                                        ? 'Último ciclo'
                                        : foundUserCycle === 'profile'
                                            ? 'Sem validações no ciclo atual'
                                            : 'Ciclo atual'}
                                </p>
                                <p className="mt-2 flex items-center justify-end gap-1.5 text-[11px] font-bold text-slate-300" title="Saldo acumulado no perfil do usuário">
                                    <Wallet className="h-3 w-3" />
                                    <span className="uppercase tracking-wider text-slate-400">Saldo</span>
                                    {formatBRL(toNumber(foundUser.current_balance))}
                                </p>
                            </div>
                        </div>
                    )}

                    {hasSearched && !foundUser && !isSearching && (
                        <div className="mt-6 animate-in fade-in text-center text-sm text-slate-400">
                            Nenhum validador encontrado com esses critérios.
                        </div>
                    )}
                </div>

                <details className="group rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 open:bg-white/[0.05]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-bold text-slate-100 md:text-[15px]">
                        <span>Como o ranking é calculado?</span>
                        <span className="text-[11px] uppercase tracking-widest text-slate-400 group-open:text-cyan-300">ver regras</span>
                    </summary>
                    <div className="mt-3 grid gap-2 text-xs text-slate-300 md:text-sm">
                        <p>1. Mostra todos os participantes no mesmo ranking geral do ciclo exibido.</p>
                        <p>2. Ordem principal: quantidade de validações no ciclo.</p>
                        <p>3. Desempate: quem validou mais recentemente fica acima.</p>
                        <p>4. O valor em R$ é o <strong className="text-slate-100">saldo do perfil</strong>, não é prêmio do ranking.</p>
                    </div>
                </details>

                <div className="mt-2 w-full self-stretch rounded-[32px] bg-gradient-to-br from-amber-500/20 via-purple-500/10 to-indigo-500/20 p-[1.5px] shadow-2xl">
                    <div className="flex flex-col gap-8 rounded-[31px] border border-white/5 bg-[#140737]/90 p-6 backdrop-blur-xl md:p-8">
                        <div>
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-amber-300 font-display">
                                        Vencedores em Destaque
                                    </div>
                                    <h3 className="mt-4 text-3xl font-extrabold font-display tracking-tight text-white uppercase">
                                        Galeria de Campeões
                                    </h3>
                                </div>
                                <div className="hidden text-right sm:block">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Última atualização</p>
                                    <p className="mt-1 text-lg font-black text-white font-display">
                                        {previousRanking.updatedAt
                                            ? previousRanking.updatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                            : '--:--'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                                {/* Pódio do Último Ciclo */}
                                <div className="space-y-4 rounded-3xl border border-white/5 bg-white/[0.02] p-5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-black uppercase tracking-widest text-amber-200">
                                            Ciclo #{previousRanking.cycleMeta?.cycleNumber || '—'}
                                        </p>
                                        <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-400">
                                            Resultado Oficial
                                        </span>
                                    </div>
                                    
                                    {topPreviousCycleWinner ? (
                                        <div className="flex items-center gap-4 py-2">
                                            <div className="relative shrink-0">
                                                <div className="h-20 w-20 rounded-full border-4 border-amber-400 p-1 shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                                                    <img src={avatarFromProfile(topPreviousCycleWinner)} alt={topPreviousCycleWinnerName || ''} className="h-full w-full rounded-full object-cover" />
                                                </div>
                                                <div className="absolute -right-1 -top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#1A0B2E] bg-amber-500 text-lg font-black text-black">
                                                    1
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-xl font-black text-white font-display uppercase tracking-tight">{topPreviousCycleWinnerName}</p>
                                                <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-400">
                                                    <MapPin className="h-3 w-3" /> {topPreviousCycleWinnerLoc}
                                                </p>
                                                <div className="mt-3 inline-flex items-center gap-3 rounded-xl bg-white/5 px-3 py-1.5 border border-white/10">
                                                    <div className="text-center">
                                                        <p className="text-xs font-black text-amber-200">{topPreviousCycleWinnerCount}</p>
                                                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500 leading-none mt-0.5">Validações no ciclo</p>
                                                    </div>
                                                    <div className="h-6 w-px bg-white/10" />
                                                    <div className="text-center">
                                                        <p className="text-xs font-black text-emerald-300">R$ 6.000,00</p>
                                                        <p className="text-[8px] font-bold uppercase tracking-widest text-slate-500 leading-none mt-0.5">Prêmio do Ciclo</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex h-24 items-center justify-center">
                                            <p className="text-sm font-bold text-slate-500 italic">Aguardando fechamento do ciclo...</p>
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Janela do Ciclo</p>
                                        <p className="mt-1 text-xs font-bold text-slate-300">
                                            {formatCycleRange(previousRanking.cycleMeta) || 'Ranking fechado do ciclo semanal anterior.'}
                                        </p>
                                    </div>
                                </div>

                                {/* Histórico de Ciclos Anteriores */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                                            Últimos Círculos
                                        </p>
                                        <div className="h-px flex-1 mx-4 bg-white/5" />
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {historicalWinnersLoading ? (
                                            Array.from({ length: 4 }).map((_, i) => (
                                                <div key={i} className="h-16 rounded-2xl border border-white/5 bg-white/[0.01] animate-pulse" />
                                            ))
                                        ) : historicalWinners.length === 0 ? (
                                            <p className="col-span-2 text-center text-xs font-bold text-slate-600 py-6">Iniciando contagem histórica...</p>
                                        ) : (
                                            historicalWinners.map((entry) => (
                                                <div key={entry.cycleNumber} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3 transition-colors hover:bg-white/5">
                                                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 p-0.5">
                                                        <img 
                                                            src={avatarFromProfile(entry.winner)} 
                                                            alt={`${entry.winner.name || 'Vencedor'}`} 
                                                            className="h-full w-full rounded-full object-cover grayscale hover:grayscale-0 transition-all"
                                                        />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 leading-none">Ciclo #{entry.cycleNumber}</p>
                                                        <p className="mt-1 truncate text-xs font-black text-slate-100 uppercase tracking-tight">
                                                            {entry.winner.name} {entry.winner.lastname?.charAt(0)}.
                                                        </p>
                                                        <div className="mt-1 flex items-center justify-between">
                                                            <p className="text-[9px] font-bold text-amber-500/80">🏆 Vencedor</p>
                                                            <p className="text-[10px] font-black text-emerald-400">R$ 6.000</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    
                                    <div className="rounded-2xl border border-indigo-500/10 bg-indigo-500/5 p-3">
                                        <p className="text-[9px] font-black text-indigo-300 uppercase tracking-widest leading-relaxed">
                                            O pódio é atualizado automaticamente a cada renovação de ciclo. O pagamento é realizado em até 48h após a auditoria.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <LandingRankingCards
                    loading={currentRanking.loading}
                    profiles={currentRanking.profiles}
                    error={currentRanking.error}
                    cycleLabel={currentCycleLabel}
                />
            </div>
        </section>
    );
};

export type { RankingModeData };
export default LandingRankingSection;
