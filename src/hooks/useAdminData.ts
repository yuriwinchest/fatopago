import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { resolveIsAdminUser } from '../lib/authRouting';
import {
    buildWinnerFollowupDraftMap,
    buildWinnerFollowupHistoryMap,
    countWinnerFollowupsByFilter,
    filterWinnerFollowups,
    searchWinnerFollowups,
    sortWinnerFollowups,
    WinnerFollowupFields,
    WinnerFollowupHistoryItem,
    WinnerFollowupFilter,
    WinnerFollowupSort
} from '../lib/winnerFollowups';
import { readSupabaseFunctionErrorMessage } from '../lib/supabaseFunctionErrors';

export interface ExtendedAdminUser {
    id: string;
    name: string;
    lastname: string;
    email: string;
    phone?: string | null;
    avatar_url?: string;
    city: string;
    state: string;
    created_at: string;
    plan_status?: string;
    referral_code?: string;
    affiliate_code?: string;
    cpf?: string | null;
    birth_date?: string | null;
    referrals_count: number;
    total_commission: number;
    current_balance: number;
    total_loaded: number;
    total_spent: number;
}

export type CycleMetaRow = {
    cycle_start_at: string;
    cycle_end_at: string;
    cycle_number: number;
    is_active: boolean;
};

export type CycleOption = CycleMetaRow & { offset: number };

export type CycleBundle = {
    offset: number;
    meta: CycleMetaRow;
    ranking: any[];
    transactions: any[];
    referrals: any[];
    pixPayments: any[];
    pixAccessOk: boolean;
    pixError?: string | null;
    profilesCreated: any[];
    isActive: boolean;
    cycleNumber: number;
    start: string;
    end: string;
    validatorsCount: number;
    totalValidations: number;
    revenue: number;
    salesCount: number;
    winner: any | null;
    affiliates: any[];
    affiliatesCount: number;
    topAffiliate: any | null;
    leadsNotPaid: any[];
    pendingPix: any[];
    pendingPixUserIds: Set<string>;
};

export type CycleWinnerRow = {
    cycle_offset: number;
    cycle_number: number;
    cycle_start_at: string;
    cycle_end_at: string;
    is_active: boolean;
    winner_user_id: string | null;
    winner_name: string | null;
    winner_lastname: string | null;
    winner_email: string | null;
    winner_phone: string | null;
    winner_city: string | null;
    winner_state: string | null;
    validations_count: number;
    last_validation_at: string | null;
    contacted: boolean;
    prize_paid: boolean;
    image_received: boolean;
    notes: string | null;
    followup_updated_at: string | null;
};

export type WinnerBundle = {
    cycle_number: number;
    winner: any;
    validations_count: number;
    history: any[]; // Or WinnerFollowupHistoryItem[]
};

export type AdminNewsItem = {
    id: string;
    created_at: string;
    cycle_number: number | null;
    cycle_start_at: string | null;
    admin_priority: number | null;
    title: string;
    category: string;
    source: string;
    image_url: string | null;
    link: string | null;
};

const APPROVED_PAYMENT_STATUSES = new Set(['approved', 'paid', 'completed', 'authorized', 'active']);
const PENDING_PAYMENT_STATUSES = new Set(['pending', 'in_process', 'waiting_payment', 'waiting', 'open']);

export const useAdminData = (activeTab: string) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Métrica Totais
    const [totals, setTotals] = useState({
        total_users: 0,
        total_referrals: 0,
        total_commissions: 0
    });

    // Usuários
    const [users, setUsers] = useState<ExtendedAdminUser[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentUsersPage, setCurrentUsersPage] = useState(1);
    const [selectedUser, setSelectedUser] = useState<ExtendedAdminUser | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    // Ciclos
    const [cycleOptions, setCycleOptions] = useState<CycleOption[]>([]);
    const [selectedCycleOffset, setSelectedCycleOffset] = useState(0);
    const [cycleBundle, setCycleBundle] = useState<CycleBundle | null>(null);
    const [prevCycleBundle, setPrevCycleBundle] = useState<CycleBundle | null>(null);
    const [cycleLoading, setCycleLoading] = useState(false);
    const [cycleError, setCycleError] = useState<string | null>(null);

    // Ganhadores
    const [cycleWinners, setCycleWinners] = useState<CycleWinnerRow[]>([]);
    const [winnersLoading, setWinnersLoading] = useState(false);
    const [winnersError, setWinnersError] = useState<string | null>(null);
    const [winnerDrafts, setWinnerDrafts] = useState<Record<number, WinnerFollowupFields>>({});
    const [winnerHistoryByCycle, setWinnerHistoryByCycle] = useState<Record<number, WinnerFollowupHistoryItem[]>>({});
    const [savingWinnerCycle, setSavingWinnerCycle] = useState<number | null>(null);
    const [winnerStatusFilter, setWinnerStatusFilter] = useState<WinnerFollowupFilter>('all');
    const [winnerSearchTerm, setWinnerSearchTerm] = useState('');
    const [winnerSortOrder, setWinnerSortOrder] = useState<WinnerFollowupSort>('urgent');

    // Notícias
    const [adminNewsLoading, setAdminNewsLoading] = useState(false);
    const [adminNewsItems, setAdminNewsItems] = useState<AdminNewsItem[]>([]);
    const [previousAdminNewsItems, setPreviousAdminNewsItems] = useState<AdminNewsItem[]>([]);
    const [currentNewsCycle, setCurrentNewsCycle] = useState<CycleMetaRow | null>(null);
    const [previousNewsCycle, setPreviousNewsCycle] = useState<CycleMetaRow | null>(null);
    const [newsPublishing, setNewsPublishing] = useState(false);
    const [newsMessage, setNewsMessage] = useState<string | null>(null);
    const [restoringNewsId, setRestoringNewsId] = useState<string | null>(null);

    // Vendedores (Sellers)
    const [sellers, setSellers] = useState<any[]>([]);
    const [sellersLoading, setSellersLoading] = useState(false);
    const [sellersError, setSellersError] = useState<string | null>(null);
    const [isSavingSeller, setIsSavingSeller] = useState(false);

    // Configurações da Home (Banners)
    const [homeConfig, setHomeConfig] = useState<any>(null);
    const [isSavingHomeConfig, setIsSavingHomeConfig] = useState(false);

    // Configurações de Ciclo
    const [cycleConfig, setCycleConfig] = useState<any>(null);
    const [activeCycleId, setActiveCycleId] = useState<string>('');
    const [isSavingCycleConfig, setIsSavingCycleConfig] = useState(false);

    const toNumber = (v: any) => {
        const n = typeof v === 'number' ? v : Number(v);
        return Number.isFinite(n) ? n : 0;
    };

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const isAdmin = await resolveIsAdminUser(user?.id);
        if (isAdmin) {
            setIsAdmin(true);
        } else {
            if (user) {
                navigate('/validation');
            } else {
                navigate('/login');
            }
        }
    };

    const fetchTotals = async () => {
        try {
            const [{ count: userCount }, { count: referralCount }, { data: commissionsData }] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }),
                supabase.from('referrals').select('*', { count: 'exact', head: true }),
                supabase.from('commissions').select('amount')
            ]);

            const sumCommissions = (commissionsData || []).reduce((acc: number, curr: { amount: unknown }) => acc + toNumber(curr.amount), 0);

            setTotals({
                total_users: toNumber(userCount),
                total_referrals: toNumber(referralCount),
                total_commissions: sumCommissions
            });
        } catch (err) {
            console.error('Erro ao buscar totais:', err);
        }
    };

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const { data: filteredProfiles, error: filteredProfilesError } = await supabase
                .from('profiles')
                .select('*')
                .eq('is_deleted', false)
                .order('created_at', { ascending: false });

            let profiles = filteredProfiles;
            let profilesError = filteredProfilesError;

            if (filteredProfilesError && /is_deleted/i.test(String(filteredProfilesError.message || ''))) {
                const fallbackProfilesRes = await supabase
                    .from('profiles')
                    .select('*')
                    .order('created_at', { ascending: false });
                profiles = fallbackProfilesRes.data;
                profilesError = fallbackProfilesRes.error;
            }

            const [{ data: referrals }, { data: commissions }, { data: transactions }] = await Promise.all([
                supabase.from('referrals').select('referrer_id, referred_id, created_at'),
                supabase.from('commissions').select('referrer_id, amount'),
                supabase.from('transactions').select('user_id, amount, type, status, description, created_at')
            ]);

            if (profilesError) throw profilesError;

            const referralCounts: Record<string, number> = {};
            referrals?.forEach((r: any) => { referralCounts[r.referrer_id] = (referralCounts[r.referrer_id] || 0) + 1; });

            const commissionSums: Record<string, number> = {};
            commissions?.forEach((c: any) => { commissionSums[c.referrer_id] = (commissionSums[c.referrer_id] || 0) + toNumber(c.amount); });

            const loadedSums: Record<string, number> = {};
            const spentSums: Record<string, number> = {};

            transactions?.forEach((t: any) => {
                const amount = toNumber(t.amount);
                if (t.type === 'credit' && t.status === 'completed') loadedSums[t.user_id] = (loadedSums[t.user_id] || 0) + amount;
                if (t.type === 'debit' && t.status !== 'failed') spentSums[t.user_id] = (spentSums[t.user_id] || 0) + amount;
            });

            const enrichedUsers: ExtendedAdminUser[] = (profiles || []).map((p: any) => ({
                ...p,
                referrals_count: referralCounts[p.id] || 0,
                total_commission: commissionSums[p.id] || 0,
                current_balance: toNumber(p.current_balance),
                total_loaded: loadedSums[p.id] || 0,
                total_spent: spentSums[p.id] || 0
            }));

            setUsers(enrichedUsers);
        } catch (error) {
            console.error('Erro ao buscar dados:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleDeleteUser = async (userId: string) => {
        if (!window.confirm('Tem certeza que deseja remover este usuário? Com histórico financeiro, a conta será anonimizada e bloqueada.')) return;
        try {
            const { data, error } = await supabase.functions.invoke('admin-delete-user', {
                body: { user_id: userId }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            if (data?.mode === 'anonymized') {
                alert('Usuário anonimizado e bloqueado. Histórico financeiro preservado.');
            }
            setUsers(prev => prev.filter(u => u.id !== userId));
            if (selectedUser?.id === userId) {
                setShowDetailsModal(false);
                setSelectedUser(null);
            }
            setCycleBundle(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    profilesCreated: prev.profilesCreated.filter((profile: any) => String(profile.id) !== userId),
                    leadsNotPaid: prev.leadsNotPaid.filter((profile: any) => String(profile.id) !== userId),
                    pendingPix: prev.pendingPix.filter((payment: any) => String(payment.user_id) !== userId),
                    pendingPixUserIds: new Set(Array.from(prev.pendingPixUserIds).filter((id) => String(id) !== userId))
                };
            });
            setPrevCycleBundle(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    profilesCreated: prev.profilesCreated.filter((profile: any) => String(profile.id) !== userId),
                    leadsNotPaid: prev.leadsNotPaid.filter((profile: any) => String(profile.id) !== userId),
                    pendingPix: prev.pendingPix.filter((payment: any) => String(payment.user_id) !== userId),
                    pendingPixUserIds: new Set(Array.from(prev.pendingPixUserIds).filter((id) => String(id) !== userId))
                };
            });
            await loadCycleBundles(selectedCycleOffset);
            await fetchWinnersHistory();
        } catch (err: any) {
            alert('Erro ao deletar: ' + err.message);
        }
    };

    const fetchCycleOptions = useCallback(async () => {
        try {
            const offsets = Array.from({ length: 12 }, (_, i) => i);
            const results = await Promise.all(offsets.map(async (offset) => {
                const { data, error } = await supabase.rpc('get_validation_cycle_meta', { p_cycle_offset: offset });
                if (error) return null;
                const row = (Array.isArray(data) ? data[0] : data) as CycleMetaRow | undefined;
                if (!row?.cycle_start_at) return null;
                return { offset, ...row } as CycleOption;
            }));
            setCycleOptions(results.filter(Boolean) as CycleOption[]);
        } catch (e: any) {
            console.warn('Falha ao carregar ciclos:', e?.message || e);
        }
    }, []);

    const fetchWinnerFollowupLogs = useCallback(async () => {
        const { data, error } = await supabase.rpc('admin_list_cycle_winner_followup_logs', { p_cycle_limit: 16, p_log_limit: 8 });
        if (error) throw error;
        setWinnerHistoryByCycle(buildWinnerFollowupHistoryMap((data || []) as WinnerFollowupHistoryItem[]));
    }, []);

    const fetchWinnersHistory = useCallback(async () => {
        try {
            setWinnersLoading(true);
            const { data, error } = await supabase.rpc('admin_list_cycle_winners', { p_limit: 16 });
            if (error) throw error;
            const rows = (data || []) as CycleWinnerRow[];
            setCycleWinners(rows);
            setWinnerDrafts(buildWinnerFollowupDraftMap(rows));
            await fetchWinnerFollowupLogs();
        } catch (e: any) {
            console.error('Falha ao carregar ganhadores:', e);
            setWinnersError(e?.message || 'Não foi possível carregar o histórico de ganhadores.');
        } finally {
            setWinnersLoading(false);
        }
    }, [fetchWinnerFollowupLogs]);

    const handleSaveWinnerFollowup = async (winner: any) => {
        const draft = winnerDrafts[winner.cycle_number];
        if (!draft) return;
        setSavingWinnerCycle(winner.cycle_number);
        try {
            const { error } = await supabase
                .from('winner_followups')
                .upsert({
                    cycle_number: winner.cycle_number,
                    contacted: draft.contacted,
                    prize_paid: draft.prize_paid,
                    image_received: draft.image_received,
                    notes: draft.notes,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'cycle_number' });
            if (error) throw error;
            await fetchWinnersHistory();
        } catch (err: any) {
            setWinnersError(err.message);
        } finally {
            setSavingWinnerCycle(null);
        }
    };

    const fetchCycleBundle = useCallback(async (offset: number): Promise<CycleBundle | null> => {
        const { data: metaData, error: metaError } = await supabase.rpc('get_validation_cycle_meta', { p_cycle_offset: offset });
        if (metaError) throw metaError;
        const metaRow = (Array.isArray(metaData) ? metaData[0] : metaData) as CycleMetaRow | undefined;
        if (!metaRow?.cycle_start_at) return null;

        const start = String(metaRow.cycle_start_at);
        const end = String(metaRow.cycle_end_at);

        const [rankingRes, txRes, refRes, pixRes, profilesRes] = await Promise.all([
            supabase.rpc('get_live_validation_ranking', { p_state: null, p_city: null, p_limit: 500, p_cycle_offset: offset }),
            supabase.from('transactions').select('user_id, amount, type, status, description, created_at').gte('created_at', start).lt('created_at', end),
            supabase.from('referrals').select('referrer_id, referred_id, created_at').gte('created_at', start).lt('created_at', end),
            supabase.from('pix_payments').select('user_id, plan_id, amount, status, created_at, expires_at, plan_activated_at, mp_payment_id').gte('created_at', start).lt('created_at', end),
            supabase.from('profiles').select('id, name, lastname, email, city, state, created_at, affiliate_code, referral_code, avatar_url').gte('created_at', start).lt('created_at', end)
        ]);

        const ranking = (rankingRes.data || []) as any[];
        const transactions = (txRes.data || []) as any[];
        const referrals = (refRes.data || []) as any[];
        const pixPayments = (pixRes.data || []) as any[];
        const profilesCreated = (profilesRes.data || []) as any[];

        const approvedPix = pixPayments.filter((payment: any) => {
            const status = String(payment?.status || '').toLowerCase();
            return APPROVED_PAYMENT_STATUSES.has(status) || Boolean(payment?.plan_activated_at);
        });

        const pendingPix = pixPayments.filter((payment: any) => {
            const status = String(payment?.status || '').toLowerCase();
            return PENDING_PAYMENT_STATUSES.has(status) && !payment?.plan_activated_at;
        });

        const approvedUsers = new Set(approvedPix.map((payment: any) => String(payment.user_id)));
        const pendingPixUserIds = new Set(pendingPix.map((payment: any) => String(payment.user_id)));
        const leadsNotPaid = profilesCreated.filter((profile: any) => !approvedUsers.has(String(profile.id)));

        const totalValidations = ranking.reduce(
            (sum: number, item: any) => sum + toNumber(item.validations_count),
            0
        );

        const revenue = approvedPix.reduce(
            (sum: number, payment: any) => sum + toNumber(payment.amount),
            0
        );

        const profilesById = new Map<string, any>(users.map((profile) => [String(profile.id), profile]));
        const affiliateMap = new Map<string, any>();
        const referredPaidByAffiliate = new Map<string, Set<string>>();
        const revenueByUser = new Map<string, number>();

        approvedPix.forEach((payment: any) => {
            const userId = String(payment.user_id || '');
            revenueByUser.set(userId, (revenueByUser.get(userId) || 0) + toNumber(payment.amount));
        });

        referrals.forEach((referral: any) => {
            const referrerId = String(referral.referrer_id || '');
            const referredId = String(referral.referred_id || '');
            if (!referrerId) return;

            const profile = profilesById.get(referrerId);
            const current = affiliateMap.get(referrerId) || {
                referrer_id: referrerId,
                name: profile?.name || 'Afiliado',
                email: profile?.email || '',
                referrals: 0,
                paid: 0,
                revenue: 0
            };

            current.referrals += 1;

            if (referredId && revenueByUser.has(referredId)) {
                const paidSet = referredPaidByAffiliate.get(referrerId) || new Set<string>();
                if (!paidSet.has(referredId)) {
                    current.paid += 1;
                    paidSet.add(referredId);
                    referredPaidByAffiliate.set(referrerId, paidSet);
                }
                current.revenue += revenueByUser.get(referredId) || 0;
            }

            affiliateMap.set(referrerId, current);
        });

        const affiliates = Array.from(affiliateMap.values()).sort((left, right) => {
            if (right.referrals !== left.referrals) return right.referrals - left.referrals;
            if (right.revenue !== left.revenue) return right.revenue - left.revenue;
            return right.paid - left.paid;
        });

        return {
            offset,
            meta: metaRow,
            ranking,
            transactions,
            referrals,
            pixPayments,
            pixAccessOk: !pixRes.error,
            pixError: pixRes.error ? String((pixRes.error as any).message || pixRes.error) : null,
            profilesCreated,
            isActive: Boolean(metaRow.is_active),
            cycleNumber: toNumber(metaRow.cycle_number),
            start,
            end,
            validatorsCount: ranking.length,
            totalValidations,
            revenue,
            salesCount: approvedPix.length,
            winner: ranking[0] || null,
            affiliates,
            affiliatesCount: affiliates.length,
            topAffiliate: affiliates[0] || null,
            leadsNotPaid,
            pendingPix,
            pendingPixUserIds
        };
    }, [users]);

    const loadCycleBundles = useCallback(async (offset: number) => {
        setCycleLoading(true);
        setCycleError(null);
        try {
            const [current, previous] = await Promise.all([fetchCycleBundle(offset), fetchCycleBundle(offset + 1)]);
            setCycleBundle(current);
            setPrevCycleBundle(previous);
        } catch (e: any) {
            setCycleError(e?.message || 'Falha ao carregar dados do ciclo.');
        } finally {
            setCycleLoading(false);
        }
    }, [fetchCycleBundle]);

    const fetchAdminNewsFeed = useCallback(async () => {
        try {
            setAdminNewsLoading(true);
            const [currentRes, previousRes, currentMetaRes, previousMetaRes] = await Promise.all([
                supabase.rpc('admin_list_news_by_cycle', { p_cycle_offset: 0 }),
                supabase.rpc('admin_list_news_by_cycle', { p_cycle_offset: 1 }),
                supabase.rpc('get_validation_cycle_meta', { p_cycle_offset: 0 }),
                supabase.rpc('get_validation_cycle_meta', { p_cycle_offset: 1 })
            ]);
            setAdminNewsItems((currentRes.data || []) as AdminNewsItem[]);
            setPreviousAdminNewsItems((previousRes.data || []) as AdminNewsItem[]);
            setCurrentNewsCycle(((Array.isArray(currentMetaRes.data) ? currentMetaRes.data[0] : currentMetaRes.data) || null) as CycleMetaRow | null);
            setPreviousNewsCycle(((Array.isArray(previousMetaRes.data) ? previousMetaRes.data[0] : previousMetaRes.data) || null) as CycleMetaRow | null);
        } catch (e: any) {
            setNewsMessage('Falha ao carregar notícias.');
        } finally {
            setAdminNewsLoading(false);
        }
    }, []);

    const handlePublishNews = async (formData: any, imageFile: File | null) => {
        setNewsPublishing(true);
        setNewsMessage(null);
        try {
            let finalImageUrl = formData.image_url;
            if (imageFile) {
                const fileName = `${Date.now()}-${imageFile.name}`;
                const { data: uploadData, error: uploadError } = await supabase.storage.from('news-images').upload(fileName, imageFile);
                if (uploadError) throw uploadError;
                const { data: { publicUrl } } = supabase.storage.from('news-images').getPublicUrl(uploadData.path);
                finalImageUrl = publicUrl;
            }
            const { error } = await supabase.from('news_manually').insert([{ ...formData, image_url: finalImageUrl }]);
            if (error) throw error;
            setNewsMessage('Notícia publicada com sucesso!');
            await fetchAdminNewsFeed();
        } catch (err: any) {
            setNewsMessage('Erro ao publicar: ' + err.message);
        } finally {
            setNewsPublishing(false);
        }
    };

    const handleDeleteNews = async (id: string) => {
        try {
            const { error } = await supabase.from('news_manually').delete().eq('id', id);
            if (error) throw error;
            await fetchAdminNewsFeed();
        } catch (err: any) {
            setNewsMessage('Erro ao deletar notícia: ' + err.message);
        }
    };

    const handleRestoreNews = async (id: string, item: AdminNewsItem) => {
        setRestoringNewsId(id);
        try {
            const { error } = await supabase.from('news_manually').insert([{
                title: item.title,
                category: item.category,
                source: item.source,
                image_url: item.image_url,
                link: item.link,
                admin_priority: item.admin_priority,
                cycle_number: currentNewsCycle?.cycle_number
            }]);
            if (error) throw error;
            await fetchAdminNewsFeed();
        } catch (err: any) {
            setNewsMessage('Erro ao restaurar: ' + err.message);
        } finally {
            setRestoringNewsId(null);
        }
    };

    const loadSellers = async () => {
        setSellersLoading(true);
        setSellersError(null);
        try {
            const { data, error } = await supabase.rpc('admin_list_sellers');
            if (error) throw error;
            setSellers(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setSellers([]);
            setSellersError(err?.message || 'Não foi possível carregar os vendedores.');
        } finally {
            setSellersLoading(false);
        }
    };

    const saveSeller = async (sellerData: any) => {
        setIsSavingSeller(true);
        setSellersError(null);
        try {
            if (sellerData?.id) {
                throw new Error('A edição de vendedor ainda não está liberada neste painel.');
            }

            const payload = {
                name: String(sellerData?.name || '').trim(),
                email: String(sellerData?.email || '').trim().toLowerCase(),
                password: String(sellerData?.password || ''),
                phone: sellerData?.phone ? String(sellerData.phone).trim() : null,
                cpf: sellerData?.cpf ? String(sellerData.cpf).replace(/\D/g, '').trim() : null,
                notes: sellerData?.notes ? String(sellerData.notes).trim() : null,
                avatar_url: sellerData?.avatar_url ? String(sellerData.avatar_url).trim() : null
            };

            const { data, error } = await supabase.functions.invoke('admin-create-seller-user', {
                body: payload
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            await loadSellers();
        } catch (err: any) {
            const message = await readSupabaseFunctionErrorMessage(
                err,
                'Não foi possível cadastrar o vendedor.'
            );
            setSellersError(message);
            throw new Error(message);
        } finally {
            setIsSavingSeller(false);
        }
    };

    const deleteSeller = async (id: string) => {
        setSellersError(null);
        try {
            const { data, error } = await supabase.functions.invoke('admin-delete-seller-user', {
                body: { seller_id: id }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            await loadSellers();
        } catch (err: any) {
            const message = await readSupabaseFunctionErrorMessage(
                err,
                'Não foi possível excluir o vendedor.'
            );
            setSellersError(message);
        }
    };

    const resetSellerPassword = async (id: string, password: string) => {
        setSellersError(null);
        try {
            const { data, error } = await supabase.functions.invoke('admin-reset-seller-password', {
                body: { seller_id: id, password }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            return data;
        } catch (err: any) {
            const message = await readSupabaseFunctionErrorMessage(
                err,
                'Não foi possível redefinir a senha do vendedor.'
            );
            setSellersError(message);
            throw new Error(message);
        }
    };

    const loadHomeConfig = async () => {
        try {
            const { data, error } = await supabase.from('admin_configs').select('*').eq('key', 'home_page').single();
            if (error && error.code !== 'PGRST116') throw error;
            setHomeConfig(data?.value || { banners: [] });
        } catch (err) {
            console.error('Erro ao carregar banners:', err);
        }
    };

    const updateHomeConfig = async (configValue: any) => {
        setIsSavingHomeConfig(true);
        try {
            const { error } = await supabase.from('admin_configs').upsert({
                key: 'home_page',
                value: configValue,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            if (error) throw error;
            setHomeConfig(configValue);
        } finally {
            setIsSavingHomeConfig(false);
        }
    };

    const loadCycleConfig = async () => {
        try {
            const { data, error } = await supabase.from('admin_configs').select('*').eq('key', 'cycle_config').single();
            if (error && error.code !== 'PGRST116') throw error;
            const val = data?.value || { cycle_number: 1, start_date: '', end_date: '', active: false };
            setCycleConfig(val);
            setActiveCycleId(data?.id || '');
        } catch (err) {
            console.error('Erro ao carregar config de ciclo:', err);
        }
    };

    const updateCycleConfig = async (configValue: any) => {
        setIsSavingCycleConfig(true);
        try {
            const { error } = await supabase.from('admin_configs').upsert({
                key: 'cycle_config',
                value: configValue,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });
            if (error) throw error;
            setCycleConfig(configValue);
            await fetchCycleOptions();
        } finally {
            setIsSavingCycleConfig(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    // Filtros calculados
    const visibleCycleWinners = useMemo(() => {
        let items = [...cycleWinners];
        items = searchWinnerFollowups(items, winnerSearchTerm);
        items = filterWinnerFollowups(items, winnerDrafts, winnerStatusFilter);
        return sortWinnerFollowups(items, winnerDrafts, winnerSortOrder);
    }, [cycleWinners, winnerSearchTerm, winnerStatusFilter, winnerSortOrder, winnerDrafts]);

    const winnerFilterOptions = useMemo(() => {
        const counts = {
            all: cycleWinners.length,
            needs_contact: countWinnerFollowupsByFilter(cycleWinners, winnerDrafts, 'needs_contact'),
            needs_prize: countWinnerFollowupsByFilter(cycleWinners, winnerDrafts, 'needs_prize'),
            needs_image: countWinnerFollowupsByFilter(cycleWinners, winnerDrafts, 'needs_image')
        };
        return [
            { id: 'all', label: 'Todos', count: counts.all },
            { id: 'needs_contact', label: 'Sem Contato', count: counts.needs_contact },
            { id: 'needs_prize', label: 'Sem Pagamento', count: counts.needs_prize },
            { id: 'needs_image', label: 'Sem Prova', count: counts.needs_image }
        ];
    }, [cycleWinners, winnerDrafts]);

    const updateWinnerDraft = (cycle: number, data: any) => {
        setWinnerDrafts(prev => ({
            ...prev,
            [cycle]: { ...prev[cycle], ...data }
        }));
    };

    useEffect(() => { checkAdmin(); fetchData(); fetchTotals(); }, [fetchData]);

    useEffect(() => {
        if (isAdmin) {
            loadSellers();
            loadHomeConfig();
            loadCycleConfig();
            fetchCycleOptions();
            if (activeTab === 'cycles') loadCycleBundles(selectedCycleOffset);
            if (activeTab === 'news') fetchAdminNewsFeed();
            if (activeTab === 'winners') fetchWinnersHistory();
        }
    }, [isAdmin, activeTab, selectedCycleOffset, loadCycleBundles, fetchAdminNewsFeed, fetchWinnersHistory, fetchCycleOptions]);

    return {
        loading, isAdmin, totals, users, searchTerm, setSearchTerm, currentUsersPage, setCurrentUsersPage,
        selectedUser, setSelectedUser, showDetailsModal, setShowDetailsModal, handleDeleteUser,
        cycleOptions, selectedCycleOffset, setSelectedCycleOffset, cycleBundle, prevCycleBundle,
        cycleLoading, cycleError, fetchCycleData: loadCycleBundles,
        cycleWinners, winnersLoading, winnersError, fetchWinnersHistory, handleExportWinnerCsv: () => {}, // TODO
        winnerFilterOptions, winnerStatusFilter, setWinnerStatusFilter, winnerSearchTerm, setWinnerSearchTerm,
        winnerSortOrder, setWinnerSortOrder, visibleCycleWinners, winnerDrafts, updateWinnerDraft,
        fetchWinners: fetchWinnersHistory, // Alias for component compatibility
        handleSaveWinnerFollowup, savingWinnerCycle, winnerHistoryByCycle,
        adminNewsLoading, adminNewsItems, previousAdminNewsItems, currentNewsCycle, previousNewsCycle,
        newsPublishing, newsMessage, restoringNewsId, handlePublishNews, handleDeleteNews, handleRestoreNews, fetchNews: fetchAdminNewsFeed,
        sellers, sellersLoading, sellersError, loadSellers, isSavingSeller, saveSeller, deleteSeller, resetSellerPassword,
        homeConfig, isSavingHomeConfig, updateHomeConfig,
        activeCycleId, cycleConfig, isSavingCycleConfig, updateCycleConfig,
        handleLogout
    };
};
