import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LandingFakeNewsSection from '../components/landing/LandingFakeNewsSection';
import LandingFooter from '../components/landing/LandingFooter';
import LandingHeroSection from '../components/landing/LandingHeroSection';
import LandingPlansSection from '../components/landing/LandingPlansSection';
import LandingRankingSection from '../components/landing/LandingRankingSection';
import { useLocation } from '../hooks/useLocation';
import { usePromoMedia } from '../hooks/usePromoMedia';
import {
    CycleMeta,
    RankingProfile,
    formatBRL,
    formatCycleRange,
    hydrateRankingAvatars,
    normalizeRankingProfile,
    toNumber
} from '../lib/landingRanking';
import { WEEKLY_WINNER_PRIZE_BRL } from '../lib/cycleSchedule';
import { supabase } from '../lib/supabase';

const LANDING_SECTION_PX = 'px-6 md:px-8 lg:px-10';
const LANDING_SECTION_STACK_GAP = 'mb-6 md:mb-8';
const LANDING_SECTION_TIGHT_TOP = 'pt-6 md:pt-8';
const LANDING_SECTION_TIGHT_BOTTOM = 'pb-6 md:pb-8';
const LANDING_SECTION_TIGHT_Y = 'py-6 md:py-8';

const LandingPage = () => {
    const navigate = useNavigate();
    const { states, cities, fetchCities } = useLocation();
    const { mediaKind: promoMediaKind, mediaUrl: promoMediaUrl } = usePromoMedia();

    const [searchName, setSearchName] = useState('');
    const [searchState, setSearchState] = useState('');
    const [searchCity, setSearchCity] = useState('');
    const [foundUser, setFoundUser] = useState<RankingProfile | null>(null);
    const [foundUserCycle, setFoundUserCycle] = useState<'current' | 'previous' | 'profile' | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const [previousRankingLoading, setPreviousRankingLoading] = useState(true);
    const [previousRankingProfiles, setPreviousRankingProfiles] = useState<RankingProfile[]>([]);
    const [previousRankingError, setPreviousRankingError] = useState<string | null>(null);
    const [previousRankingUpdatedAt, setPreviousRankingUpdatedAt] = useState<Date | null>(null);
    const [previousCycleMeta, setPreviousCycleMeta] = useState<CycleMeta | null>(null);

    const [historicalWinners, setHistoricalWinners] = useState<any[]>([]);
    const [historicalWinnersLoading, setHistoricalWinnersLoading] = useState(true);
    const [currentRankingLoading, setCurrentRankingLoading] = useState(true);
    const [currentRankingProfiles, setCurrentRankingProfiles] = useState<RankingProfile[]>([]);
    const [currentRankingError, setCurrentRankingError] = useState<string | null>(null);
    const [currentRankingUpdatedAt, setCurrentRankingUpdatedAt] = useState<Date | null>(null);
    const [currentCycleMeta, setCurrentCycleMeta] = useState<CycleMeta | null>(null);

    useEffect(() => {
        let cancelled = false;
        let inFlightPrevious = false;
        let inFlightCurrent = false;

        const run = async (cycleOffset: 0 | 1) => {
            const { data, error } = await supabase.rpc('get_live_validation_ranking', {
                p_limit: 500,
                p_cycle_offset: cycleOffset
            });
            if (error) throw error;

            const raw: unknown[] = Array.isArray(data) ? data : [];
            const rows = raw.map(normalizeRankingProfile);
            return hydrateRankingAvatars(rows);
        };

        const fetchCurrentRanking = async () => {
            if (inFlightCurrent) return;
            inFlightCurrent = true;

            setCurrentRankingLoading(true);
            setCurrentRankingError(null);

            try {
                const rows = await run(0);
                if (cancelled) return;
                setCurrentRankingProfiles(rows);
                setCurrentRankingUpdatedAt(new Date());
            } catch (error: any) {
                if (cancelled) return;
                setCurrentRankingProfiles([]);
                setCurrentRankingError(error?.message || 'Falha ao carregar ranking');
            } finally {
                if (!cancelled) {
                    setCurrentRankingLoading(false);
                }
                inFlightCurrent = false;
            }
        };

        const fetchPreviousRanking = async () => {
            if (inFlightPrevious) return;
            inFlightPrevious = true;

            setPreviousRankingLoading(true);
            setPreviousRankingError(null);

            try {
                const rows = await run(1);
                if (cancelled) return;
                setPreviousRankingProfiles(rows);
                setPreviousRankingUpdatedAt(new Date());
            } catch (error: any) {
                if (cancelled) return;
                setPreviousRankingProfiles([]);
                setPreviousRankingError(error?.message || 'Falha ao carregar ranking');
            } finally {
                if (!cancelled) {
                    setPreviousRankingLoading(false);
                }
                inFlightPrevious = false;
            }
        };

        const fetchCurrentCycleMeta = async () => {
            try {
                const { data, error } = await supabase.rpc('get_validation_cycle_meta', { p_cycle_offset: 0 });
                if (error) throw error;
                if (cancelled) return;

                const row = Array.isArray(data) ? data[0] : null;
                if (!row) {
                    setCurrentCycleMeta(null);
                    return;
                }

                setCurrentCycleMeta({
                    cycleNumber: Math.max(0, Math.trunc(toNumber(row?.cycle_number))) || null,
                    startAt: row?.cycle_start_at ? new Date(row.cycle_start_at) : null,
                    endAt: row?.cycle_end_at ? new Date(row.cycle_end_at) : null
                });
            } catch (error) {
                console.warn('Falha ao carregar ciclo atual (best effort):', error);
                if (!cancelled) setCurrentCycleMeta(null);
            }
        };

        const fetchPreviousCycleMeta = async () => {
            try {
                const { data, error } = await supabase.rpc('get_validation_cycle_meta', { p_cycle_offset: 1 });
                if (error) throw error;
                if (cancelled) return;

                const row = Array.isArray(data) ? data[0] : null;
                if (!row) {
                    setPreviousCycleMeta(null);
                    return;
                }

                setPreviousCycleMeta({
                    cycleNumber: Math.max(0, Math.trunc(toNumber(row?.cycle_number))) || null,
                    startAt: row?.cycle_start_at ? new Date(row.cycle_start_at) : null,
                    endAt: row?.cycle_end_at ? new Date(row.cycle_end_at) : null
                });
            } catch (error) {
                console.warn('Falha ao carregar ciclo anterior (best effort):', error);
                if (!cancelled) setPreviousCycleMeta(null);
            }
        };

        const fetchHistoricalWinners = async () => {
            setHistoricalWinnersLoading(true);
            try {
                const results = await Promise.all([1, 2, 3, 4].map(async (offset) => {
                    const [{ data: meta }, { data: ranking }] = await Promise.all([
                        supabase.rpc('get_validation_cycle_meta', { p_cycle_offset: offset }),
                        supabase.rpc('get_live_validation_ranking', { p_limit: 1, p_cycle_offset: offset })
                    ]);
                    const metaRow = Array.isArray(meta) ? meta[0] : null;
                    const winner = Array.isArray(ranking) ? ranking[0] : null;
                    if (!metaRow || !winner) return null;
                    return {
                        cycleNumber: metaRow.cycle_number,
                        winner: normalizeRankingProfile(winner),
                        meta: metaRow
                    };
                }));
                if (cancelled) return;
                setHistoricalWinners(results.filter(Boolean));
            } catch (err) {
                console.warn('Falha ao carregar histórico de vencedores:', err);
            } finally {
                if (!cancelled) setHistoricalWinnersLoading(false);
            }
        };

        void Promise.all([
            fetchCurrentRanking(),
            fetchCurrentCycleMeta(),
            fetchPreviousRanking(),
            fetchPreviousCycleMeta(),
            fetchHistoricalWinners()
        ]);

        return () => {
            cancelled = true;
        };
    }, []);

    const landingPrizeAmountLabel = formatBRL(WEEKLY_WINNER_PRIZE_BRL).replace(/^R\$\s*/, '');

    const handleSearch = async () => {
        if (!searchName && !searchState && !searchCity) return;

        setIsSearching(true);
        setHasSearched(true);
        setFoundUser(null);
        setFoundUserCycle(null);

        const run = async (cycleOffset: 0 | 1) => {
            const { data, error } = await supabase.rpc('get_live_validation_ranking', {
                p_state: searchState || null,
                p_city: searchCity || null,
                p_limit: 500,
                p_cycle_offset: cycleOffset
            });

            if (error) throw error;

            const raw: unknown[] = Array.isArray(data) ? data : [];
            const rows = await hydrateRankingAvatars(raw.map(normalizeRankingProfile));
            const q = searchName.trim().toLowerCase();
            const filtered = q
                ? rows.filter((row) => `${row.name || ''} ${row.lastname || ''}`.trim().toLowerCase().includes(q))
                : rows;

            return filtered[0] || null;
        };

        const runProfileFallback = async () => {
            let query = supabase
                .from('profiles')
                .select('id, name, lastname, city, state, current_balance, reputation_score, avatar_url')
                .limit(500);

            if (searchState.trim()) query = query.ilike('state', `%${searchState.trim()}%`);
            if (searchCity.trim()) query = query.ilike('city', `%${searchCity.trim()}%`);

            const { data, error } = await query;
            if (error) throw error;

            const rows = (Array.isArray(data) ? data : []).map((row: any) =>
                normalizeRankingProfile({
                    ...row,
                    validations_count: 0,
                    last_validation_at: null
                })
            );

            const hydratedRows = await hydrateRankingAvatars(rows);
            const q = searchName.trim().toLowerCase();
            const filtered = q
                ? hydratedRows.filter((row) => `${row.name || ''} ${row.lastname || ''}`.trim().toLowerCase().includes(q))
                : hydratedRows;

            return filtered[0] || null;
        };

        try {
            const hitCurrent = await run(0);
            if (hitCurrent) {
                setFoundUser(hitCurrent);
                setFoundUserCycle('current');
                return;
            }

            const hitPrevious = await run(1);
            if (hitPrevious) {
                setFoundUser(hitPrevious);
                setFoundUserCycle('previous');
                return;
            }

            const hitProfile = await runProfileFallback();
            if (hitProfile) {
                setFoundUser(hitProfile);
                setFoundUserCycle('profile');
                return;
            }
        } catch (error) {
            console.error('Search exception:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchStateChange = (nextState: string) => {
        setSearchState(nextState);
        setSearchCity('');
        fetchCities(nextState);
    };

    const previousRankingData = {
        loading: previousRankingLoading,
        profiles: previousRankingProfiles,
        error: previousRankingError,
        cycleMeta: previousCycleMeta,
        updatedAt: previousRankingUpdatedAt
    };

    const currentRankingData = {
        loading: currentRankingLoading,
        profiles: currentRankingProfiles,
        error: currentRankingError,
        cycleMeta: currentCycleMeta,
        updatedAt: currentRankingUpdatedAt
    };

    return (
        <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#0F0529] font-sans selection:bg-fuchsia-500/30 selection:text-white">
            <nav className="fixed top-0 left-0 right-0 z-50 px-0 md:px-0 pt-safe pl-safe pr-safe">
                <div className="bg-[#2e0259] shadow-2xl border-b border-white/10 px-6 py-4 md:py-5 rounded-b-[32px] md:rounded-b-[45px] transition-all duration-300">
                    <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
                        <img
                            src="/logo.png"
                            alt="Fatopago Logo"
                            className="h-8 cursor-pointer drop-shadow-2xl transition-transform md:h-12 md:hover:scale-105"
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        />
                        <div className="flex items-center gap-2 md:gap-4">
                            <button
                                onClick={() => navigate('/login')}
                                className="min-h-[44px] rounded-2xl px-3 text-sm font-bold text-slate-300 transition-colors active:scale-[0.98] md:hover:text-white touch-manipulation"
                            >
                                Entrar
                            </button>
                            <button
                                onClick={() => navigate('/register')}
                                className="min-h-[46px] rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-purple-500/20 transition-all active:scale-95 md:px-7 md:hover:scale-105 md:hover:from-purple-500 md:hover:to-indigo-500 touch-manipulation"
                            >
                                Criar Conta
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            <LandingHeroSection
                sectionPaddingX={LANDING_SECTION_PX}
                sectionStackGap={LANDING_SECTION_STACK_GAP}
                landingPrizeAmountLabel={landingPrizeAmountLabel}
                promoMediaKind={promoMediaKind}
                promoMediaUrl={promoMediaUrl}
            />

            <LandingPlansSection
                sectionPaddingX={LANDING_SECTION_PX}
                sectionPaddingTop={LANDING_SECTION_TIGHT_TOP}
                sectionPaddingBottom={LANDING_SECTION_TIGHT_BOTTOM}
            />

            <LandingRankingSection
                sectionPaddingX={LANDING_SECTION_PX}
                sectionPaddingTop={LANDING_SECTION_TIGHT_TOP}
                searchName={searchName}
                onSearchNameChange={setSearchName}
                searchState={searchState}
                onSearchStateChange={handleSearchStateChange}
                searchCity={searchCity}
                onSearchCityChange={setSearchCity}
                states={states}
                cities={cities}
                onSearch={handleSearch}
                isSearching={isSearching}
                hasSearched={hasSearched}
                foundUser={foundUser}
                foundUserCycle={foundUserCycle}
                previousRanking={previousRankingData}
                currentRanking={currentRankingData}
                formatCycleRange={formatCycleRange}
                historicalWinners={historicalWinners}
                historicalWinnersLoading={historicalWinnersLoading}
            />

            <LandingFakeNewsSection
                sectionPaddingX={LANDING_SECTION_PX}
                sectionPaddingY={LANDING_SECTION_TIGHT_Y}
            />

            <LandingFooter sectionPaddingX={LANDING_SECTION_PX} />
        </div>
    );
};

export default LandingPage;
