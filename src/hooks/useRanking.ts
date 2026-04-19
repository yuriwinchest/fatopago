import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

export type RankingScope = 'city' | 'state' | 'national';

export interface RankingProfile {
    id: string;
    name: string;
    lastname: string;
    city: string;
    state: string;
    reputation_score: number;
    validations_count: number;
    last_validation_at: string | null;
    avatar_url?: string | null;
}

type MyRank = {
    rank: number | null;
    inTop3: boolean;
    profile: RankingProfile | null;
};

export function useRanking() {
    const [loading, setLoading] = useState(true);
    const [profiles, setProfiles] = useState<RankingProfile[]>([]);
    const [scope, setScope] = useState<RankingScope>('national');
    const [states, setStates] = useState<string[]>([]);
    const [cities, setCities] = useState<string[]>([]);
    const [selectedState, setSelectedState] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [cycleNumber, setCycleNumber] = useState<number | null>(null);
    const [cycleStartAt, setCycleStartAt] = useState<string | null>(null);
    const [cycleEndAt, setCycleEndAt] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [currentUserProfile, setCurrentUserProfile] = useState<RankingProfile | null>(null);
    const [myRank, setMyRank] = useState<MyRank | null>(null);

    const normalizeProfile = (row: any): RankingProfile => ({
        id: String(row?.id || ''),
        name: String(row?.name || 'Usuário'),
        lastname: String(row?.lastname || ''),
        city: String(row?.city || ''),
        state: String(row?.state || ''),
        reputation_score: Number(row?.reputation_score || 0),
        validations_count: Number(row?.validations_count || 0),
        last_validation_at: row?.last_validation_at ? String(row.last_validation_at) : null,
        avatar_url: row?.avatar_url ? String(row.avatar_url) : null
    });

    const hydrateAvatarUrls = useCallback(async (rows: RankingProfile[]): Promise<RankingProfile[]> => {
        const missingAvatarIds = Array.from(
            new Set(rows.filter((row) => !row.avatar_url && row.id).map((row) => row.id))
        );

        if (missingAvatarIds.length === 0) return rows;

        const { data, error } = await supabase
            .from('profiles')
            .select('id, avatar_url')
            .in('id', missingAvatarIds);

        if (error) {
            console.warn('Falha ao completar avatares no ranking:', error);
            return rows;
        }

        const avatarById = new Map<string, string>();
        for (const row of data || []) {
            const id = String((row as any)?.id || '');
            const avatarUrl = (row as any)?.avatar_url ? String((row as any).avatar_url) : '';
            if (id && avatarUrl) avatarById.set(id, avatarUrl);
        }

        if (avatarById.size === 0) return rows;

        return rows.map((row) => ({
            ...row,
            avatar_url: row.avatar_url || avatarById.get(row.id) || null
        }));
    }, []);

    const fetchStateOptions = useCallback(async () => {
        try {
            const { data, error } = await supabase.rpc('get_live_validation_ranking', {
                p_state: null,
                p_city: null,
                p_limit: 500,
                p_cycle_offset: 0
            });

            if (error) throw error;

            const normalizedStates = ((data || []) as any[])
                .map((r: any) => String(r?.state || '').trim().toUpperCase())
                .filter((v: string) => Boolean(v));

            const uniqueStates = Array.from(new Set<string>(normalizedStates))
                .sort((a: string, b: string) => a.localeCompare(b));

            setStates(uniqueStates);
            if (uniqueStates.length > 0 && !uniqueStates.includes(selectedState)) {
                setSelectedState(uniqueStates[0] || '');
            }
        } catch (e) {
            console.error('Falha ao carregar estados do ranking:', e);
        }
    }, [selectedState]);

    const fetchCityOptions = useCallback(async (stateUf: string) => {
        if (!stateUf) {
            setCities([]);
            setSelectedCity('');
            return;
        }

        try {
            const { data, error } = await supabase
                .rpc('get_live_validation_ranking', {
                    p_state: stateUf,
                    p_city: null,
                    p_limit: 500,
                    p_cycle_offset: 0
                });

            if (error) throw error;

            const normalizedCities = ((data || []) as any[])
                .map((r: any) => String(r?.city || '').trim())
                .filter((v: string) => Boolean(v));

            const uniqueCities = Array.from(new Set<string>(normalizedCities))
                .sort((a: string, b: string) => a.localeCompare(b));

            setCities(uniqueCities);
            if (!uniqueCities.includes(selectedCity)) {
                setSelectedCity(uniqueCities[0] || '');
            }
        } catch (e) {
            console.error('Falha ao carregar cidades do ranking:', e);
            setCities([]);
            setSelectedCity('');
        }
    }, [selectedCity]);

    const fetchCurrentUserContext = useCallback(async () => {
        const { data: userRes, error: userErr } = await supabase.auth.getUser();
        if (userErr) {
            console.warn('Falha ao ler usuário autenticado:', userErr);
            return;
        }

        const user = userRes.user;
        if (!user) return;

        setCurrentUserId(user.id);

        const { data: myProfile, error: profileErr } = await supabase
            .from('profiles')
            .select('id, name, lastname, city, state, reputation_score, avatar_url')
            .eq('id', user.id)
            .maybeSingle();

        if (profileErr) {
            console.warn('Falha ao ler perfil do usuário no ranking:', profileErr);
            return;
        }

        if (myProfile) {
            const normalized = normalizeProfile({ ...myProfile, validations_count: 0, last_validation_at: null });
            setCurrentUserProfile(normalized);

            if (!selectedState && normalized.state) {
                setSelectedState(normalized.state.toUpperCase());
            }
            if (!selectedCity && normalized.city) {
                setSelectedCity(normalized.city);
            }
        }
    }, [selectedCity, selectedState]);

    const fetchRanking = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const pState = scope === 'national' ? null : (selectedState || null);
            const pCity = scope === 'city' ? (selectedCity || null) : null;

            const [metaRes, rankingRes] = await Promise.all([
                supabase.rpc('get_validation_cycle_meta', { p_cycle_offset: 0 }),
                supabase.rpc('get_live_validation_ranking', {
                    p_state: pState,
                    p_city: pCity,
                    p_limit: 500,
                    p_cycle_offset: 0
                })
            ]);

            if (metaRes.error) throw metaRes.error;
            if (rankingRes.error) throw rankingRes.error;

            const meta = (Array.isArray(metaRes.data) ? metaRes.data[0] : metaRes.data) as any;
            setCycleNumber(meta?.cycle_number ? Number(meta.cycle_number) : null);
            setCycleStartAt(meta?.cycle_start_at ? String(meta.cycle_start_at) : null);
            setCycleEndAt(meta?.cycle_end_at ? String(meta.cycle_end_at) : null);

            const rows = ((rankingRes.data || []) as any[]).map(normalizeProfile);
            const rowsWithAvatar = await hydrateAvatarUrls(rows);
            setProfiles(rowsWithAvatar);

            if (!currentUserId) {
                setMyRank(null);
            } else {
                const idx = rowsWithAvatar.findIndex((r) => r.id === currentUserId);
                if (idx >= 0) {
                    setMyRank({
                        rank: idx + 1,
                        inTop3: idx < 3,
                        profile: rowsWithAvatar[idx]
                    });
                } else {
                    setMyRank({
                        rank: null,
                        inTop3: false,
                        profile: currentUserProfile
                    });
                }
            }
        } catch (e: any) {
            console.error('Erro ao carregar ranking real:', e);
            setProfiles([]);
            setMyRank(currentUserProfile ? { rank: null, inTop3: false, profile: currentUserProfile } : null);
            setError(e?.message || 'Falha ao carregar ranking.');
        } finally {
            setLoading(false);
        }
    }, [scope, selectedState, selectedCity, currentUserId, currentUserProfile, hydrateAvatarUrls]);

    useEffect(() => {
        void fetchStateOptions();
        void fetchCurrentUserContext();
    }, [fetchStateOptions, fetchCurrentUserContext]);

    useEffect(() => {
        if (selectedState) {
            void fetchCityOptions(selectedState);
        } else {
            setCities([]);
            setSelectedCity('');
        }
    }, [selectedState, fetchCityOptions]);

    useEffect(() => {
        if (scope === 'national') {
            void fetchRanking();
            return;
        }

        if (scope === 'state') {
            if (!selectedState) return;
            void fetchRanking();
            return;
        }

        if (!selectedState || !selectedCity) return;
        void fetchRanking();
    }, [scope, selectedState, selectedCity, fetchRanking]);

    const totalParticipants = useMemo(() => profiles.length, [profiles]);

    return {
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
    };
}
