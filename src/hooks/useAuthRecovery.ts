import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function useAuthRecovery() {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState('');

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(false);

        if (!email) {
            setError("Por favor, informe seu e-mail.");
            return;
        }

        setLoading(true);

        try {
            const redirectUrl = `${window.location.origin}/reset-password`;
            const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl,
            });

            if (authError) throw authError;
            setSuccess(true);
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Erro ao enviar email de recuperação.");
        } finally {
            setLoading(false);
        }
    };

    return {
        email,
        setEmail,
        loading,
        success,
        error,
        handleForgotPassword
    };
}
