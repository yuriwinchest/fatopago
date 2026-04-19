import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { hasPasswordRecoveryIndicators } from '../lib/passwordRecovery';

export function usePasswordReset() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [checkingRecovery, setCheckingRecovery] = useState(true);
    const [hasRecoverySession, setHasRecoverySession] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const recoveryTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        let active = true;
        const hasRecoveryIndicators = hasPasswordRecoveryIndicators(window.location);

        const applyInvalidRecoveryState = () => {
            if (!active) return;
            setHasRecoverySession(false);
            setCheckingRecovery(false);
            setError('Link de recuperação inválido ou expirado. Solicite um novo e-mail.');
        };

        const applyValidRecoveryState = () => {
            if (!active) return;
            setHasRecoverySession(true);
            setCheckingRecovery(false);
            setError(null);
        };

        const resolveRecoverySession = async () => {
            const { data, error: sessionError } = await supabase.auth.getSession();

            if (!active) return;

            if (sessionError) {
                applyInvalidRecoveryState();
                return;
            }

            if (data.session) {
                applyValidRecoveryState();
                return;
            }

            if (!hasRecoveryIndicators) {
                applyInvalidRecoveryState();
                return;
            }

            if (recoveryTimeoutRef.current) {
                window.clearTimeout(recoveryTimeoutRef.current);
            }

            recoveryTimeoutRef.current = window.setTimeout(async () => {
                const { data: delayedData } = await supabase.auth.getSession();

                if (!active) return;

                if (delayedData.session) {
                    applyValidRecoveryState();
                    return;
                }

                applyInvalidRecoveryState();
            }, 1800);
        };

        const { data } = supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
            if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
                applyValidRecoveryState();
            }
        });

        void resolveRecoverySession();

        return () => {
            active = false;
            if (recoveryTimeoutRef.current) {
                window.clearTimeout(recoveryTimeoutRef.current);
            }
            data.subscription.unsubscribe();
        };
    }, []);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!hasRecoverySession) {
            setError('Link de recuperação inválido ou expirado. Solicite um novo e-mail.');
            return;
        }

        if (!password || !confirmPassword) {
            setError("Preencha todos os campos.");
            return;
        }

        if (password !== confirmPassword) {
            setError("As senhas não coincidem.");
            return;
        }

        if (password.length < 6) {
            setError("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        setLoading(true);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) throw updateError;

            const { error: signOutError } = await supabase.auth.signOut();
            if (signOutError) throw signOutError;

            navigate('/login?reset=success', { replace: true });
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erro ao atualizar a senha.");
        } finally {
            setLoading(false);
        }
    };

    return {
        password,
        setPassword,
        confirmPassword,
        setConfirmPassword,
        loading,
        checkingRecovery,
        hasRecoverySession,
        error,
        handleReset
    };
}
