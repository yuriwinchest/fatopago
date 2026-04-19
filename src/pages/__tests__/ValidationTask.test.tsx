import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ValidationTask from '../ValidationTask';
import { supabase } from '../../lib/supabase';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

// Mock Supabase
vi.mock('../../lib/supabase', () => {
    const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({
            data: { current_balance: 0, compensatory_credit_balance: 0 },
            error: null
        })),
        single: vi.fn().mockImplementation(() => Promise.resolve({
            data: {
                id: 'task-123',
                content: {
                    title: 'Test News Title',
                    description: 'Test News Description',
                    reward: 50,
                    category: 'Politics',
                    source: 'Test Source',
                    difficulty: 'Easy'
                },
                created_at: new Date().toISOString()
            },
            error: null
        })),
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnThis()
    };

    return {
        supabase: {
            rpc: vi.fn(),
            auth: {
                getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: 'test-user' } } }, error: null })),
                getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user' } }, error: null }))
            },
            from: vi.fn(() => mockQuery),
            storage: {
                from: vi.fn(() => ({
                    upload: vi.fn(() => Promise.resolve({ data: { path: 'test-user/proof.png' }, error: null })),
                    getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://cdn.test/proof.png' } }))
                }))
            }
        }
    };
});

// Mock Plan Service
vi.mock('../../lib/planService', () => ({
    getPlanAccessForCurrentUser: vi.fn(() => Promise.resolve({
        status: 'ok',
        userId: 'test-user',
        plan: { id: 'test-plan', used_validations: 0, max_validations: 10, user_id: 'test-user' }
    })),
    consumeActivePlanValidation: vi.fn()
}));

const renderPage = () => {
    return render(
        <MemoryRouter initialEntries={['/validation/task-123']}>
            <Routes>
                <Route path="/validation/:id" element={<ValidationTask />} />
            </Routes>
        </MemoryRouter>
    );
};

describe('ValidationTask', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(supabase.rpc).mockImplementation(async (fn: string) => {
            if (fn === 'submit_validation') {
                return { data: { status: 'success' }, error: null } as any;
            }

            if (fn === 'get_validation_cycle_meta') {
                return {
                    data: {
                        cycleStartAt: '2026-04-05T15:00:00.000Z',
                        cycleEndAt: '2026-04-12T14:00:00.000Z',
                        nextCycleStartAt: '2026-04-12T15:00:00.000Z',
                        timeRemaining: 256139422,
                        currentCycleNumber: 1
                    },
                    error: null
                } as any;
            }

            if (fn === 'is_admin_user') {
                return { data: false, error: null } as any;
            }

            return { data: null, error: null } as any;
        });
    });

    it('renders task details correctly', async () => {
        renderPage();

        await waitFor(() => {
            expect(screen.getByText('Test News Title')).toBeInTheDocument();
            expect(screen.getByText('É FATO')).toBeInTheDocument();
        });
    });

    it('shows false flow when clicking É FAKE', async () => {
        renderPage();

        const falsoBtn = await screen.findByText('É FAKE');
        fireEvent.click(falsoBtn);

        expect(screen.getByText(/identificou esta notícia como/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Explique por que esta notícia é falsa/i)).toBeInTheDocument();
    });

    it('bloqueia falso sem prova completa', async () => {
        renderPage();

        const falsoBtn = await screen.findByText('É FAKE');
        fireEvent.click(falsoBtn);
        fireEvent.click(screen.getByText('CONFIRMAR'));

        await waitFor(() => {
            expect(screen.getByText(/justificativa com pelo menos/i)).toBeInTheDocument();
        });

        expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalledWith('submit_validation', expect.anything());
    });

    it('envia falso com justificativa, link e foto', async () => {
        const rpcMock = vi.mocked(supabase.rpc);
        renderPage();

        const falsoBtn = await screen.findByText('É FAKE');
        fireEvent.click(falsoBtn);
        fireEvent.change(screen.getByPlaceholderText(/Explique por que esta notícia é falsa/i), {
            target: { value: 'A notícia foi desmentida por documento oficial.' }
        });
        fireEvent.change(screen.getByPlaceholderText(/https:\/\/fonte-confiavel.com/i), {
            target: { value: 'fonte-oficial.com/prova' }
        });
        fireEvent.change(screen.getByLabelText(/Foto da evidência/i), {
            target: {
                files: [new File(['proof'], 'evidencia.png', { type: 'image/png' })]
            }
        });
        fireEvent.click(screen.getByText('CONFIRMAR'));

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('submit_validation', expect.objectContaining({
                p_verdict: false,
                p_justification: 'A notícia foi desmentida por documento oficial.',
                p_proof_link: 'https://fonte-oficial.com/prova',
                p_proof_image_url: 'https://cdn.test/proof.png'
            }));
        });
    });
});
