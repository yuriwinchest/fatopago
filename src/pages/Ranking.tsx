import { useEffect, useMemo, useState } from 'react';
import { MapPin, Loader2, Crown, ChevronDown, Users, AlertCircle, Search, BadgeInfo } from 'lucide-react';
import { AppLayout } from '../layouts/AppLayout';
import { useRanking } from '../hooks/useRanking';
import {
    filterRankingProfiles,
    formatRankingLocation,
    normalizeValidationCount,
    shouldShowValidationCount
} from '../lib/rankingDisplay';

const Ranking = () => {
    const {
        profiles,
        scope,
        setScope,
        loading,
        states,
        cities,
        selectedState,
        setSelectedState,
        selectedCity,
        setSelectedCity,
        cycleNumber,
        cycleStartAt,
        cycleEndAt,
        myRank,
        totalParticipants,
        error
    } = useRanking();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

    // [2026-04-15] Regra corrigida: TODOS os usuarios aparecem no ranking com nome,
    // avatar, posicao e localizacao. Apenas o NUMERO de validacoes fica oculto ate a
    // pessoa cruzar 100 validacoes — nesse ponto o contador aparece no card dela.
    // Posicao no ranking eh calculada sobre a lista inteira (nao apenas elegiveis),
    // pra que a ordenacao publica continue estavel e todo mundo tenha um lugar.
    const visibleProfiles = useMemo(
        () => filterRankingProfiles(profiles, searchTerm),
        [profiles, searchTerm]
    );
    const isSearching = Boolean(searchTerm.trim());
    const top3 = useMemo(() => (isSearching ? [] : visibleProfiles.slice(0, 3)), [isSearching, visibleProfiles]);
    const others = useMemo(() => (isSearching ? visibleProfiles : visibleProfiles.slice(3)), [isSearching, visibleProfiles]);
    const myIndex = useMemo(
        () => (myRank?.profile ? profiles.findIndex((p) => p.id === myRank.profile!.id) : -1),
        [profiles, myRank?.profile]
    );
    const myIsInTop3 = myIndex >= 0 && myIndex < 3;
    const showMyRankCard = Boolean(myRank?.profile) && !myIsInTop3;

    // [2026-04-15] No perfil logado o gate de exibicao do numero eh COMPOSTO:
    //   canViewerSeeCounts = eu (viewer) tenho >= 100 validacoes no ciclo
    //   shouldShowValidationCount(alvo) = o perfil-alvo tambem tem >= 100
    // So se os DOIS forem verdadeiros eu vejo o numero do alvo. Senao, exibo posicao.
    const viewerCount = normalizeValidationCount(myRank?.profile?.validations_count ?? 0);
    const canViewerSeeCounts = shouldShowValidationCount(viewerCount);
    const canShowCountFor = (targetCount: unknown) =>
        canViewerSeeCounts && shouldShowValidationCount(targetCount);

    const formatDateTimeBR = (iso?: string | null) => {
        if (!iso) return '--';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '--';
        return d.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const avatarFromProfile = (profile: { avatar_url?: string | null; name: string; lastname?: string }) => {
        if (profile.avatar_url) return profile.avatar_url;
        const fullName = `${profile.name || ''} ${profile.lastname || ''}`.trim() || 'Usuario';
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=2e1065&color=fff`;
    };

    const formatValidations = (count: number) => `${count} ${count === 1 ? 'validação' : 'validações'}`;

    const getProfileRank = (profileId?: string | null) => {
        if (!profileId) return null;
        // [2026-04-15] Posicao calculada sobre TODOS os perfis. O gate >= 100 eh apenas
        // visual (esconde o numero de validacoes), nao filtra a lista do ranking.
        const index = profiles.findIndex((profile) => profile.id === profileId);
        return index >= 0 ? index + 1 : null;
    };

    const selectedProfile = useMemo(
        () => visibleProfiles.find((profile) => profile.id === selectedProfileId) || visibleProfiles[0] || null,
        [selectedProfileId, visibleProfiles]
    );
    const selectedProfileRank = getProfileRank(selectedProfile?.id);

    useEffect(() => {
        setSearchTerm('');
    }, [scope, selectedState, selectedCity]);

    useEffect(() => {
        if (!visibleProfiles.length) {
            setSelectedProfileId(null);
            return;
        }

        if (!selectedProfileId || !visibleProfiles.some((profile) => profile.id === selectedProfileId)) {
            setSelectedProfileId(visibleProfiles[0].id);
        }
    }, [selectedProfileId, visibleProfiles]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center text-white">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <AppLayout title="Ranking" showBackButton={true}>
            <div className="animate-in fade-in flex h-full flex-col bg-background pb-24 text-foreground duration-500 lg:pb-4">
                <div className="sticky top-0 z-20 mb-6 rounded-2xl border border-white/5 bg-background/85 px-4 pb-4 pt-3 backdrop-blur-md">
                    <div className="mb-3 flex rounded-xl border border-white/5 bg-secondary/20 p-1">
                        <button
                            onClick={() => setScope('national')}
                            className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wide transition-all duration-300 ${scope === 'national' ? 'cursor-default bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Geral
                        </button>
                        <button
                            onClick={() => setScope('state')}
                            className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wide transition-all duration-300 ${scope === 'state' ? 'cursor-default bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Estadual
                        </button>
                        <button
                            onClick={() => setScope('city')}
                            className={`flex-1 rounded-lg py-2 text-xs font-bold uppercase tracking-wide transition-all duration-300 ${scope === 'city' ? 'cursor-default bg-primary text-white shadow-md' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Municipal
                        </button>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-secondary/20 px-3 py-2">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-300">
                            <Users className="h-4 w-4 text-primary" />
                            <span>{cycleNumber ? `Ciclo #${cycleNumber}` : 'Ciclo atual'}</span>
                            <span className="text-slate-500">•</span>
                            <span>{totalParticipants} participante(s)</span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                            {formatDateTimeBR(cycleStartAt)} → {formatDateTimeBR(cycleEndAt)}
                        </span>
                    </div>

                    {(scope === 'state' || scope === 'city') && (
                        <div className="animate-in slide-in-from-top-2 flex gap-2">
                            <div className="group relative flex-1">
                                <select
                                    value={selectedState}
                                    onChange={(e) => setSelectedState(e.target.value)}
                                    className="w-full appearance-none rounded-xl border border-white/10 bg-secondary/30 py-2.5 pl-3 pr-8 text-sm font-medium text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 group-hover:bg-secondary/40"
                                >
                                    {states.length === 0 && <option value="">Sem estados</option>}
                                    {states.map((uf) => (
                                        <option key={uf} value={uf} className="bg-background">{uf}</option>
                                    ))}
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                            </div>

                            {scope === 'city' && (
                                <div className="group relative flex-1">
                                    <select
                                        value={selectedCity}
                                        onChange={(e) => setSelectedCity(e.target.value)}
                                        className="w-full appearance-none rounded-xl border border-white/10 bg-secondary/30 py-2.5 pl-3 pr-8 text-sm font-medium text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 group-hover:bg-secondary/40"
                                    >
                                        {cities.length === 0 && <option value="">Sem cidades</option>}
                                        {cities.map((city) => (
                                            <option key={city} value={city} className="bg-background">{city}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-3 group relative">
                        <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={scope === 'national' ? 'Buscar participante, cidade ou estado...' : 'Buscar participante dentro deste filtro...'}
                            className="h-11 w-full rounded-xl border border-white/10 bg-secondary/30 py-2.5 pl-9 pr-3 text-sm font-medium text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 group-hover:bg-secondary/40"
                        />
                    </div>
                </div>

                {error && (
                    <div className="mb-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
                        <div className="flex items-center gap-2 text-sm text-yellow-100">
                            <AlertCircle className="h-4 w-4 text-yellow-300" />
                            <span>{error}</span>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="space-y-6 lg:col-span-5">
                        <div className="relative rounded-3xl border border-white/10 bg-secondary/10 p-4 sm:p-6">
                            {isSearching ? (
                                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-left">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">Busca ativa</p>
                                    <h3 className="mt-2 text-lg font-black text-white">{visibleProfiles.length} participante(s) encontrado(s)</h3>
                                    <p className="mt-2 text-sm text-slate-400">
                                        Clique em um nome no ranking para ver município/cidade, estado e métricas do participante.
                                    </p>
                                </div>
                            ) : top3.length === 0 ? (
                                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-slate-400">
                                    Ainda não há validações no ciclo atual para este filtro.
                                </div>
                            ) : (
                                <div className="relative flex items-end justify-center gap-2 px-2 sm:gap-4">
                                    {top3[1] && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedProfileId(top3[1].id)}
                                            className="order-1 flex flex-1 flex-col items-center justify-end rounded-2xl px-2 py-1 text-left transition-all hover:bg-white/5"
                                        >
                                            <div className="relative mb-2">
                                                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-slate-300 bg-slate-200 shadow-lg sm:h-20 sm:w-20">
                                                    <img src={avatarFromProfile(top3[1])} alt={top3[1].name} className="h-full w-full object-cover" />
                                                </div>
                                                <div className="absolute -bottom-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-slate-500 bg-slate-700 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
                                                    #{getProfileRank(top3[1].id)}
                                                </div>
                                            </div>
                                            <p className="mt-1 w-full truncate text-center text-xs font-bold text-foreground/90 sm:text-sm">{top3[1].name.split(' ')[0]}</p>
                                            <p className="mt-1 w-full truncate text-center text-[10px] text-slate-400">
                                                {formatRankingLocation(top3[1]).cityLabel} • {formatRankingLocation(top3[1]).stateLabel}
                                            </p>
                                            {canShowCountFor(top3[1].validations_count) ? (
                                                <p className="text-[10px] font-bold text-primary sm:text-xs">
                                                    {normalizeValidationCount(top3[1].validations_count)} validações
                                                </p>
                                            ) : (
                                                <p className="text-[10px] font-bold text-primary sm:text-xs">
                                                    #{getProfileRank(top3[1].id)} no ranking
                                                </p>
                                            )}
                                            <div className="mx-auto mt-2 h-16 w-full max-w-[80px] rounded-t-lg bg-gradient-to-t from-slate-400/10 to-transparent" />
                                        </button>
                                    )}

                                    {top3[0] && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedProfileId(top3[0].id)}
                                            className="order-2 z-10 -mt-8 flex flex-1 flex-col items-center justify-end rounded-2xl px-2 py-1 text-left transition-all hover:bg-white/5"
                                        >
                                            <div className="relative mb-3">
                                                {getProfileRank(top3[0].id) === 1 && (
                                                    <Crown className="pointer-events-none absolute -top-8 left-1/2 h-8 w-8 -translate-x-1/2 animate-bounce fill-yellow-400 text-yellow-400 drop-shadow-md" />
                                                )}
                                                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-yellow-400 bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-[0_0_20px_rgba(250,204,21,0.4)] ring-4 ring-yellow-400/20 sm:h-28 sm:w-28">
                                                    <img src={avatarFromProfile(top3[0])} alt={top3[0].name} className="h-full w-full object-cover" />
                                                </div>
                                                <div className="absolute -bottom-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full border border-yellow-300 bg-yellow-500 px-3 py-1 text-xs font-bold text-yellow-950 shadow-lg">
                                                    #{getProfileRank(top3[0].id)}
                                                </div>
                                            </div>
                                            <p className="mt-2 w-full truncate px-1 text-center text-sm font-bold text-yellow-500 sm:text-base">{top3[0].name}</p>
                                            <p className="mt-1 w-full truncate text-center text-[10px] text-slate-400">
                                                {formatRankingLocation(top3[0]).cityLabel} • {formatRankingLocation(top3[0]).stateLabel}
                                            </p>
                                            {canShowCountFor(top3[0].validations_count) ? (
                                                <p className="text-xs font-bold text-yellow-600/80 sm:text-sm">
                                                    {formatValidations(normalizeValidationCount(top3[0].validations_count))}
                                                </p>
                                            ) : (
                                                <p className="text-xs font-bold text-yellow-600/80 sm:text-sm">
                                                    #{getProfileRank(top3[0].id)} no ranking
                                                </p>
                                            )}
                                            <div className="mx-auto mt-2 h-24 w-full max-w-[100px] rounded-t-lg bg-gradient-to-t from-yellow-400/10 to-transparent" />
                                        </button>
                                    )}

                                    {top3[2] && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedProfileId(top3[2].id)}
                                            className="order-3 flex flex-1 flex-col items-center justify-end rounded-2xl px-2 py-1 text-left transition-all hover:bg-white/5"
                                        >
                                            <div className="relative mb-2">
                                                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-amber-600 bg-amber-700 shadow-lg sm:h-20 sm:w-20">
                                                    <img src={avatarFromProfile(top3[2])} alt={top3[2].name} className="h-full w-full object-cover" />
                                                </div>
                                                <div className="absolute -bottom-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border border-amber-600 bg-amber-800 px-2 py-0.5 text-[10px] font-bold text-white shadow-lg">
                                                    #{getProfileRank(top3[2].id)}
                                                </div>
                                            </div>
                                            <p className="mt-1 w-full truncate text-center text-xs font-bold text-foreground/90 sm:text-sm">{top3[2].name.split(' ')[0]}</p>
                                            <p className="mt-1 w-full truncate text-center text-[10px] text-slate-400">
                                                {formatRankingLocation(top3[2]).cityLabel} • {formatRankingLocation(top3[2]).stateLabel}
                                            </p>
                                            {canShowCountFor(top3[2].validations_count) ? (
                                                <p className="text-[10px] font-bold text-primary sm:text-xs">
                                                    {normalizeValidationCount(top3[2].validations_count)} validações
                                                </p>
                                            ) : (
                                                <p className="text-[10px] font-bold text-primary sm:text-xs">
                                                    #{getProfileRank(top3[2].id)} no ranking
                                                </p>
                                            )}
                                            <div className="mx-auto mt-2 h-12 w-full max-w-[80px] rounded-t-lg bg-gradient-to-t from-amber-600/10 to-transparent" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {showMyRankCard && myRank?.profile && (
                            <div className="hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 p-4 lg:block">
                                <div className="flex items-center gap-4">
                                    <span className="w-8 text-center text-lg font-bold text-primary">
                                        {myIndex >= 0 ? `#${myIndex + 1}` : '#--'}
                                    </span>
                                    <img
                                        src={avatarFromProfile(myRank.profile)}
                                        alt="Você"
                                        className="h-10 w-10 rounded-full border-2 border-primary object-cover shadow-sm"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-bold text-foreground">Você</p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {formatRankingLocation(myRank.profile).cityLabel}, {formatRankingLocation(myRank.profile).stateLabel}
                                        </p>
                                    </div>
                                    {/* [2026-04-15] Regra atualizada: o viewer so ve contagem apos cruzar 100.
                                        Ate la, exibe apenas a posicao dele tambem. */}
                                    <div className="pr-2 text-right">
                                        {canViewerSeeCounts ? (
                                            <>
                                                <p className="text-lg font-bold text-primary">
                                                    {normalizeValidationCount(myRank.profile.validations_count)}
                                                </p>
                                                <p className="-mt-1 text-[10px] text-muted-foreground">validações</p>
                                            </>
                                        ) : (
                                            <>
                                                <p className="text-lg font-bold text-primary">
                                                    #{myIndex >= 0 ? myIndex + 1 : '--'}
                                                </p>
                                                <p className="-mt-1 text-[10px] text-muted-foreground">posição</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3 px-1 lg:col-span-7">
                        {selectedProfile && (
                            <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 p-4">
                                <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-primary">
                                    <BadgeInfo className="h-4 w-4" />
                                    Detalhes do participante
                                </div>
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                                    <div className="flex items-center gap-3">
                                        <img
                                            src={avatarFromProfile(selectedProfile)}
                                            alt={selectedProfile.name}
                                            className="h-14 w-14 rounded-full border border-white/10 object-cover"
                                        />
                                        <div>
                                            <p className="text-base font-black text-white">
                                                {selectedProfile.name} {selectedProfile.lastname}
                                            </p>
                                            <p className="text-xs text-slate-300">
                                                #{selectedProfileRank || '--'} no ranking atual
                                            </p>
                                        </div>
                                    </div>
                                    <div className="grid flex-1 grid-cols-1 gap-3 text-sm text-slate-200 sm:grid-cols-2">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Município/Cidade</p>
                                            <p className="font-semibold">{formatRankingLocation(selectedProfile).cityLabel}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Estado</p>
                                            <p className="font-semibold">{formatRankingLocation(selectedProfile).stateLabel}</p>
                                        </div>
                                        {canShowCountFor(selectedProfile.validations_count) ? (
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Validações</p>
                                                <p className="font-semibold">{normalizeValidationCount(selectedProfile.validations_count)}</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Posição</p>
                                                <p className="font-semibold">#{selectedProfileRank || '--'}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Reputação</p>
                                            <p className="font-semibold">{selectedProfile.reputation_score}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mb-1 flex items-center justify-between">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Ranking geral</h3>
                            <span className="text-[10px] text-slate-500">{visibleProfiles.length} no ranking</span>
                        </div>

                        {visibleProfiles.length === 0 && (
                            <div className="rounded-2xl border border-white/10 bg-secondary/10 p-4 text-center text-sm text-slate-400">
                                Nenhum participante encontrado para essa busca.
                            </div>
                        )}

                        {others.map((profile) => {
                            const rank = getProfileRank(profile.id);
                            return (
                                <button
                                    key={profile.id}
                                    type="button"
                                    onClick={() => setSelectedProfileId(profile.id)}
                                    className={`flex w-full items-center gap-4 rounded-2xl border p-3 text-left transition-all active:scale-[0.98] active:bg-secondary/20 ${selectedProfile?.id === profile.id ? 'border-primary/30 bg-primary/10' : 'border-white/5 bg-secondary/10 hover:bg-white/5'}`}
                                >
                                    <div className="w-6 text-center text-sm font-bold text-muted-foreground">#{rank || '--'}</div>
                                    <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-secondary">
                                        <img src={avatarFromProfile(profile)} alt={profile.name} className="h-full w-full object-cover" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="flex items-center gap-1 truncate text-sm font-bold text-foreground">
                                            {profile.name} {profile.lastname}
                                        </h3>
                                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                                            <MapPin className="h-3 w-3" />
                                            <span className="truncate">
                                                {formatRankingLocation(profile).cityLabel} • {formatRankingLocation(profile).stateLabel}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="whitespace-nowrap text-right">
                                        {canShowCountFor(profile.validations_count) ? (
                                            <>
                                                <div className="text-sm font-bold text-primary">
                                                    {normalizeValidationCount(profile.validations_count)}
                                                </div>
                                                <div className="text-[9px] font-medium lowercase text-muted-foreground">val.</div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="text-sm font-bold text-primary">#{rank || '--'}</div>
                                                <div className="text-[9px] font-medium uppercase text-muted-foreground">posição</div>
                                            </>
                                        )}
                                    </div>
                                </button>
                            );
                        })}

                        {!isSearching && visibleProfiles.length > 0 && others.length === 0 && (
                            <div className="rounded-2xl border border-white/10 bg-secondary/10 p-4 text-center text-sm text-slate-400">
                                Somente os 3 primeiros colocados têm validações neste filtro.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {showMyRankCard && myRank?.profile && (
                <div className="animate-in slide-in-from-bottom-5 fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-background/80 p-4 pb-safe-bottom backdrop-blur-xl lg:hidden">
                    <div className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 to-primary/5 p-3 shadow-lg">
                        <div className="absolute bottom-0 left-0 top-0 w-1 bg-primary" />

                        <span className="w-8 text-center text-lg font-bold text-primary">
                            {myIndex >= 0 ? `#${myIndex + 1}` : '#--'}
                        </span>

                        <img
                            src={avatarFromProfile(myRank.profile)}
                            alt="Você"
                            className="h-10 w-10 rounded-full border-2 border-primary object-cover shadow-sm"
                        />

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-foreground">Você</p>
                            <p className="truncate text-xs text-muted-foreground">
                                {formatRankingLocation(myRank.profile).cityLabel}, {formatRankingLocation(myRank.profile).stateLabel}
                            </p>
                        </div>

                        {/* [2026-04-15] Regra atualizada: viewer so ve contagem apos cruzar 100. */}
                        <div className="pr-2 text-right">
                            {canViewerSeeCounts ? (
                                <>
                                    <p className="text-lg font-bold text-primary">
                                        {normalizeValidationCount(myRank.profile.validations_count)}
                                    </p>
                                    <p className="-mt-1 text-[10px] text-muted-foreground">validações</p>
                                </>
                            ) : (
                                <>
                                    <p className="text-lg font-bold text-primary">
                                        #{myIndex >= 0 ? myIndex + 1 : '--'}
                                    </p>
                                    <p className="-mt-1 text-[10px] text-muted-foreground">posição</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
};

export default Ranking;
