import { Suspense, lazy, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resolveIsAdminUser } from '../lib/authRouting';
import PageLoader from '../components/ui/PageLoader';

const AdminDashboard = lazy(() => import('./AdminDashboard'));
const SellerDashboard = lazy(() => import('./SellerDashboard'));

type BackofficeRole = 'admin' | 'seller' | 'user';

const BackofficeDashboard = () => {
    const [loading, setLoading] = useState(true);
    const [role, setRole] = useState<BackofficeRole>('user');

    useEffect(() => {
        const resolveRole = async () => {
            try {
                const { data: { user }, error: userError } = await supabase.auth.getUser();
                if (userError || !user) {
                    setRole('user');
                    return;
                }

                const isAdmin = await resolveIsAdminUser(user.id);
                if (isAdmin) {
                    setRole('admin');
                    return;
                }

                const { data: sellerData, error: sellerError } = await supabase.rpc('get_my_seller_profile');
                if (!sellerError) {
                    const isSeller = Array.isArray(sellerData)
                        ? sellerData.length > 0
                        : Boolean(sellerData && typeof sellerData === 'object' && (sellerData as { id?: string }).id);

                    if (isSeller) {
                        setRole('seller');
                        return;
                    }
                }

                setRole('user');
            } catch (error) {
                console.error('Falha ao resolver papel do backoffice:', error);
                setRole('user');
            } finally {
                setLoading(false);
            }
        };

        void resolveRole();
    }, []);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0F0529]">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
        );
    }

    if (role === 'admin') {
        return (
            <Suspense fallback={<PageLoader label="Carregando painel administrativo..." fullScreen />}>
                <AdminDashboard />
            </Suspense>
        );
    }

    if (role === 'seller') {
        return (
            <Suspense fallback={<PageLoader label="Carregando painel do vendedor..." fullScreen />}>
                <SellerDashboard />
            </Suspense>
        );
    }

    return <Navigate to="/validation" replace />;
};

export default BackofficeDashboard;
