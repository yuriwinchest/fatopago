import { supabase } from './supabase';

export type AuthRole = 'admin' | 'seller' | 'collaborator' | 'user';

// Fallback legado para ambientes sem RPC atualizada.
export const ADMIN_EMAIL = 'fatopago@gmail.com';

const toBooleanRpcResult = (value: unknown): boolean => {
    if (Array.isArray(value)) return Boolean(value[0]);
    if (value && typeof value === 'object' && 'is_admin' in (value as Record<string, unknown>)) {
        return Boolean((value as Record<string, unknown>).is_admin);
    }
    return Boolean(value);
};

export async function resolveIsAdminUser(userId?: string | null): Promise<boolean> {
    if (!userId) return false;

    const { data, error } = await supabase.rpc('is_admin_user', { p_user_id: userId });
    if (error) {
        console.warn('Falha ao resolver papel admin via RPC is_admin_user:', error.message);
        return false;
    }

    return toBooleanRpcResult(data);
}

export async function resolveIsCollaboratorUser(userId?: string | null): Promise<boolean> {
    if (!userId) return false;

    const { data, error } = await supabase.rpc('is_collaborator_user', { p_user_id: userId });
    if (error) {
        console.warn('Falha ao resolver papel colaborador via RPC is_collaborator_user:', error.message);
        return false;
    }

    return toBooleanRpcResult(data);
}

export function getRoleFromContext({
    email,
    isAdmin = false,
    isSeller = false,
    isCollaborator = false
}: {
    email?: string | null;
    isAdmin?: boolean;
    isSeller?: boolean;
    isCollaborator?: boolean;
}): AuthRole {
    if (isAdmin) return 'admin';
    if (email && email.toLowerCase() === ADMIN_EMAIL) return 'admin';
    if (isSeller) return 'seller';
    if (isCollaborator) return 'collaborator';
    return 'user';
}

export function getRoleRedirect(role: AuthRole): string {
    switch (role) {
        case 'admin':
        case 'seller':
        case 'collaborator':
            return '/admin-dashboard';
        default:
            return '/validation';
    }
}
