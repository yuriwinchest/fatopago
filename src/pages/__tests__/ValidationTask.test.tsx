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
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
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
                getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: 'test-user' } } }, error: null }))
            },
            from: vi.fn(() => mockQuery)
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
    });

    it('renders task details correctly', async () => {
        renderPage();

        await waitFor(() => {
            expect(screen.getByText('Test News Title')).toBeInTheDocument();
            expect(screen.getByText('Fonte: Test Source')).toBeInTheDocument();
        });
    });

    it('shows justification flow when clicking FALSO / FAKE', async () => {
        renderPage();

        const falsoBtn = await screen.findByText('FALSO / FAKE');
        fireEvent.click(falsoBtn);

        expect(screen.getByText(/identificou esta notícia como/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Explique por que esta notícia é falsa/i)).toBeInTheDocument();
    });

    it('calls RPC with justification when confirming FALSO', async () => {
        const rpcMock = vi.mocked(supabase.rpc).mockResolvedValue({ data: { status: 'success' }, error: null });
        renderPage();

        const falsoBtn = await screen.findByText('FALSO / FAKE');
        fireEvent.click(falsoBtn);

        const textarea = screen.getByPlaceholderText(/Explique por que esta notícia é falsa/i);
        fireEvent.change(textarea, { target: { value: 'Esta notícia é claramente falsa porque...' } });

        const confirmBtn = screen.getByText('CONFIRMAR');
        fireEvent.click(confirmBtn);

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('submit_validation', expect.objectContaining({
                p_verdict: false,
                p_justification: 'Esta notícia é claramente falsa porque...'
            }));
        });
    });
});
