import { useEffect, useState } from 'react';
import { Instagram, Trophy } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const INSTAGRAM_URL = 'https://www.instagram.com/fatopagobr?igsh=Njcyb3l2dDVrbTlz&utm_source=qr';
const WINNERS_LIMIT = 3;

type WinnerProfile = {
    id: string;
    name: string | null;
    lastname: string | null;
    city: string | null;
    state: string | null;
    avatar_url: string | null;
};

const normalizeWinner = (row: any): WinnerProfile => ({
    id: String(row?.id ?? ''),
    name: row?.name ?? null,
    lastname: row?.lastname ?? null,
    city: row?.city ?? null,
    state: row?.state ?? null,
    avatar_url: row?.avatar_url ? String(row.avatar_url) : null
});

const winnerFullName = (winner: WinnerProfile) =>
    `${winner.name || ''} ${winner.lastname || ''}`.trim() || 'Validador';

const winnerAvatarUrl = (winner: WinnerProfile) => {
    if (winner.avatar_url) return winner.avatar_url;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(winnerFullName(winner))}&background=5b21b6&color=fff`;
};

type AuthSocialProofProps = {
    className?: string;
};

export const AuthSocialProof = ({ className = '' }: AuthSocialProofProps) => {
    const [winners, setWinners] = useState<WinnerProfile[]>([]);
    const [headline, setHeadline] = useState('Ganhadores do último ciclo');

    useEffect(() => {
        let active = true;

        const hydrateAvatars = async (rows: WinnerProfile[]) => {
            const missingIds = rows
                .filter((row) => !row.avatar_url && row.id)
                .map((row) => row.id);

            if (missingIds.length === 0) return rows;

            const { data, error } = await supabase
                .from('profiles')
                .select('id, avatar_url')
                .in('id', missingIds);

            if (error) {
                console.warn('Falha ao complementar avatares dos ganhadores:', error);
                return rows;
            }

            const avatarMap = new Map<string, string | null>(
                (data || []).map((row: any) => [String(row?.id || ''), row?.avatar_url ? String(row.avatar_url) : null])
            );

            return rows.map((row) => ({
                ...row,
                avatar_url: row.avatar_url || avatarMap.get(row.id) || null
            }));
        };

        const fetchRanking = async (cycleOffset: 0 | 1) => {
            const { data, error } = await supabase.rpc('get_live_validation_ranking', {
                p_limit: WINNERS_LIMIT,
                p_cycle_offset: cycleOffset
            });

            if (error) throw error;

            const rows = Array.isArray(data) ? data.map(normalizeWinner) : [];
            return hydrateAvatars(rows);
        };

        const loadWinners = async () => {
            try {
                const previousCycle = await fetchRanking(1);
                if (!active) return;

                if (previousCycle.length > 0) {
                    setWinners(previousCycle);
                    setHeadline('Ganhadores do último ciclo');
                    return;
                }

                const currentCycle = await fetchRanking(0);
                if (!active) return;

                setWinners(currentCycle);
                setHeadline(currentCycle.length > 0 ? 'Destaques do ciclo atual' : 'Acompanhe a comunidade Fatopago');
            } catch (error) {
                if (!active) return;
                console.warn('Falha ao carregar prova social pública:', error);
                setHeadline('Acompanhe a comunidade Fatopago');
            }
        };

        void loadWinners();

        return () => {
            active = false;
        };
    }, []);

    const subtitle =
        winners.length > 0
            ? winners.map((winner) => winnerFullName(winner).split(' ')[0]).join(' • ')
            : 'Siga o Instagram oficial e acompanhe os resultados da plataforma.';

    return (
        <div className={className}>
            <div className="rounded-[28px] border border-white/10 bg-black/15 p-4 shadow-[0_16px_40px_rgba(18,6,60,0.28)] backdrop-blur-sm sm:p-5">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                        <div className="flex -space-x-3">
                            {winners.length > 0 ? (
                                winners.slice(0, WINNERS_LIMIT).map((winner) => (
                                    <img
                                        key={winner.id}
                                        src={winnerAvatarUrl(winner)}
                                        alt={winnerFullName(winner)}
                                        className="h-11 w-11 rounded-full border-2 border-[#8a2ce2] object-cover shadow-lg shadow-purple-950/40"
                                    />
                                ))
                            ) : (
                                <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#8a2ce2] bg-white/10">
                                    <Trophy className="h-5 w-5 text-amber-300" />
                                </div>
                            )}
                        </div>

                        <div className="min-w-0 pt-0.5">
                            <span className="block text-sm font-bold leading-tight text-white">{headline}</span>
                            <span className="mt-1 block text-xs leading-relaxed text-purple-200 break-words xl:truncate">{subtitle}</span>
                        </div>
                    </div>

                    <a
                        href={INSTAGRAM_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-fuchsia-100 transition-all hover:border-fuchsia-200/45 hover:bg-fuchsia-400/20 hover:text-white sm:text-[11px] xl:w-auto xl:justify-self-end"
                    >
                        <Instagram className="h-4 w-4" />
                        Instagram oficial
                    </a>
                </div>
            </div>
        </div>
    );
};
