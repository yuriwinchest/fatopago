import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    useEffect(() => {
        let active = true;

        const resolveSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!active) return;
                setIsAuthenticated(Boolean(session));
            } catch (error) {
                if (!active) return;
                console.error('Auth check error:', error);
                setIsAuthenticated(false);
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        const { data: authListener } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
            if (!active) return;
            setIsAuthenticated(Boolean(session));
            setLoading(false);
        });

        void resolveSession();

        return () => {
            active = false;
            authListener.subscription.unsubscribe();
        };
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0F0529] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};
