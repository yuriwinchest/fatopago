type RecoveryLocation = {
    search: string;
    hash: string;
};

const toSearchParams = (value: string) => {
    if (!value) return new URLSearchParams();
    const normalized = value.startsWith('?') || value.startsWith('#') ? value.slice(1) : value;
    return new URLSearchParams(normalized);
};

export const hasPasswordRecoveryIndicators = ({ search, hash }: RecoveryLocation) => {
    const searchParams = toSearchParams(search);
    const hashParams = toSearchParams(hash);

    return (
        searchParams.get('type') === 'recovery' ||
        hashParams.get('type') === 'recovery' ||
        searchParams.has('code') ||
        hashParams.has('code') ||
        hashParams.has('access_token')
    );
};

export const getPasswordRecoveryPrefilledEmail = (search: string) =>
    toSearchParams(search).get('email')?.trim() || '';

export const isPasswordRecoveryRequestedFromProfile = (search: string) =>
    toSearchParams(search).get('from') === 'profile';

export const buildProfileForgotPasswordRedirectUrl = (origin: string, email?: string | null) => {
    const url = new URL('/forgot-password', origin);
    const normalizedEmail = (email || '').trim();

    if (normalizedEmail) {
        url.searchParams.set('email', normalizedEmail);
    }

    url.searchParams.set('from', 'profile');
    return url.toString();
};
