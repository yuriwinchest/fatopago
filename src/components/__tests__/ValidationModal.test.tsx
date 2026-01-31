import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ValidationModal from '../ValidationModal';
import { supabase } from '../../lib/supabase';
import { MemoryRouter } from 'react-router-dom';

// Mock Supabase
vi.mock('../../lib/supabase', () => {
    const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.resolve({
            data: { current_balance: 0, reputation_score: 0 },
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
        plan: { id: 'test-plan', used_validations: 0, max_validations: 10 }
    }))
}));

const mockTask = {
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
};

const renderModal = (props = {}) => {
    const defaultProps = {
        task: mockTask,
        isOpen: true,
        onClose: vi.fn(),
        onValidated: vi.fn(),
    };
    return render(
        <MemoryRouter>
            <ValidationModal {...defaultProps} {...props} />
        </MemoryRouter>
    );
};

describe('ValidationModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders task title and source', () => {
        renderModal();
        expect(screen.getByText('Test News Title')).toBeInTheDocument();
        expect(screen.getByText('Fonte: Test Source')).toBeInTheDocument();
    });

    it('calls RPC when clicking VERDADEIRO', async () => {
        const rpcMock = vi.mocked(supabase.rpc).mockResolvedValue({ data: { status: 'success' }, error: null });
        renderModal();

        fireEvent.click(screen.getByText('VERDADEIRO'));

        await waitFor(() => {
            expect(rpcMock).toHaveBeenCalledWith('submit_validation', expect.objectContaining({
                p_task_id: 'task-123',
                p_verdict: true
            }));
        });
    });

    it('shows justification flow when clicking FALSO', () => {
        renderModal();
        fireEvent.click(screen.getByText('FALSO'));

        expect(screen.getByText(/identificou esta notícia como/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(/Explique por que esta notícia é falsa/i)).toBeInTheDocument();
    });

    it('prevents submission of FALSO without justification', async () => {
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => { });
        renderModal();

        // Go to false flow
        fireEvent.click(screen.getByText('FALSO'));

        // Click confirm without justification
        fireEvent.click(screen.getByText('CONFIRMAR'));

        expect(alertMock).toHaveBeenCalledWith(expect.stringContaining('justifique com pelo menos 10 caracteres'));
    });
});
