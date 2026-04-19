import {
    buildWinnerFollowupHistoryMap,
    buildWinnerFollowupDraftMap,
    countWinnerFollowupsByFilter,
    exportWinnerFollowupsCsv,
    filterWinnerFollowups,
    getWinnerFollowupDraft,
    searchWinnerFollowups,
    sortWinnerFollowups
} from '../winnerFollowups';

describe('winnerFollowups', () => {
    it('normaliza valores vazios para o draft padrão', () => {
        expect(getWinnerFollowupDraft()).toEqual({
            contacted: false,
            prize_paid: false,
            image_received: false,
            notes: ''
        });
    });

    it('monta mapa por ciclo com os dados persistidos', () => {
        expect(buildWinnerFollowupDraftMap([
            {
                cycle_number: 7,
                contacted: true,
                prize_paid: false,
                image_received: true,
                notes: 'Contato feito por WhatsApp'
            }
        ])).toEqual({
            7: {
                contacted: true,
                prize_paid: false,
                image_received: true,
                notes: 'Contato feito por WhatsApp'
            }
        });
    });

    it('filtra corretamente ganhadores pendentes por status operacional', () => {
        const rows = [
            {
                cycle_number: 1,
                winner_user_id: 'user-1',
                contacted: false,
                prize_paid: false,
                image_received: false,
                notes: null
            },
            {
                cycle_number: 2,
                winner_user_id: 'user-2',
                contacted: true,
                prize_paid: false,
                image_received: true,
                notes: null
            },
            {
                cycle_number: 3,
                winner_user_id: null,
                contacted: false,
                prize_paid: false,
                image_received: false,
                notes: null
            }
        ];

        const drafts = buildWinnerFollowupDraftMap(rows);

        expect(filterWinnerFollowups(rows, drafts, 'all')).toHaveLength(3);
        expect(filterWinnerFollowups(rows, drafts, 'needs_contact').map((row) => row.cycle_number)).toEqual([1]);
        expect(filterWinnerFollowups(rows, drafts, 'needs_prize').map((row) => row.cycle_number)).toEqual([1, 2]);
        expect(filterWinnerFollowups(rows, drafts, 'needs_image').map((row) => row.cycle_number)).toEqual([1]);
        expect(countWinnerFollowupsByFilter(rows, drafts, 'needs_prize')).toBe(2);
    });

    it('busca por nome, email e telefone do ganhador', () => {
        const rows = [
            {
                cycle_number: 1,
                winner_user_id: 'user-1',
                winner_name: 'Maria',
                winner_lastname: 'Silva',
                winner_email: 'maria@fatopago.com',
                winner_phone: '(11) 99999-0001'
            },
            {
                cycle_number: 2,
                winner_user_id: 'user-2',
                winner_name: 'Joao',
                winner_lastname: 'Souza',
                winner_email: 'joao@fatopago.com',
                winner_phone: '(21) 98888-0002'
            }
        ];

        expect(searchWinnerFollowups(rows, 'maria').map((row) => row.cycle_number)).toEqual([1]);
        expect(searchWinnerFollowups(rows, 'joao@fatopago').map((row) => row.cycle_number)).toEqual([2]);
        expect(searchWinnerFollowups(rows, '999990001').map((row) => row.cycle_number)).toEqual([1]);
    });

    it('ordena por urgencia priorizando pendencias e acompanhamentos mais antigos', () => {
        const rows = [
            {
                cycle_number: 1,
                winner_user_id: 'user-1',
                cycle_end_at: '2026-03-15T14:00:00.000Z',
                followup_updated_at: null,
                contacted: false,
                prize_paid: false,
                image_received: false
            },
            {
                cycle_number: 2,
                winner_user_id: 'user-2',
                cycle_end_at: '2026-03-22T14:00:00.000Z',
                followup_updated_at: '2026-03-22T18:00:00.000Z',
                contacted: true,
                prize_paid: false,
                image_received: true
            },
            {
                cycle_number: 3,
                winner_user_id: 'user-3',
                cycle_end_at: '2026-03-29T14:00:00.000Z',
                followup_updated_at: '2026-03-29T18:00:00.000Z',
                contacted: true,
                prize_paid: true,
                image_received: true
            }
        ];

        const drafts = buildWinnerFollowupDraftMap(rows);

        expect(sortWinnerFollowups(rows, drafts, 'urgent').map((row) => row.cycle_number)).toEqual([1, 2, 3]);
        expect(sortWinnerFollowups(rows, drafts, 'latest').map((row) => row.cycle_number)).toEqual([3, 2, 1]);
        expect(sortWinnerFollowups(rows, drafts, 'oldest').map((row) => row.cycle_number)).toEqual([1, 2, 3]);
    });

    it('agrupa historico por ciclo e ordena por data mais recente', () => {
        expect(buildWinnerFollowupHistoryMap([
            {
                id: 1,
                cycle_number: 4,
                notes: 'Primeiro registro',
                created_at: '2026-03-20T10:00:00.000Z'
            },
            {
                id: 2,
                cycle_number: 4,
                notes: 'Registro mais novo',
                created_at: '2026-03-21T10:00:00.000Z'
            }
        ])).toEqual({
            4: [
                {
                    id: 2,
                    cycle_number: 4,
                    notes: 'Registro mais novo',
                    created_at: '2026-03-21T10:00:00.000Z'
                },
                {
                    id: 1,
                    cycle_number: 4,
                    notes: 'Primeiro registro',
                    created_at: '2026-03-20T10:00:00.000Z'
                }
            ]
        });
    });

    it('gera csv dos ganhadores com status atuais', () => {
        const rows = [
            {
                cycle_number: 5,
                cycle_start_at: '2026-03-22T15:00:00.000Z',
                cycle_end_at: '2026-03-29T14:00:00.000Z',
                is_active: false,
                winner_name: 'Maria',
                winner_lastname: 'Silva',
                winner_email: 'maria@fatopago.com',
                winner_phone: '(11) 99999-0001',
                winner_city: 'São Paulo',
                winner_state: 'SP',
                validations_count: 42,
                last_validation_at: '2026-03-28T20:00:00.000Z',
                followup_updated_at: '2026-03-29T12:00:00.000Z',
                notes: 'Premio enviado',
                contacted: true,
                prize_paid: true,
                image_received: false
            }
        ];

        const csv = exportWinnerFollowupsCsv(rows, buildWinnerFollowupDraftMap(rows));

        expect(csv).toContain('Ciclo;Início do ciclo;Fim do ciclo;Status do ciclo');
        expect(csv).toContain('Maria');
        expect(csv).toContain('maria@fatopago.com');
        expect(csv).toContain('Sim;Sim;Não;Premio enviado');
    });
});
