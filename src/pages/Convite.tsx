import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { trackSellerFunnelEvent } from '../lib/sellerFunnel';

/**
 * Pagina de redirecionamento para links de convite.
 * URL: /convite/:code
 * Redireciona para: /register?ref=CODE
 */
const Convite = () => {
    const { code } = useParams<{ code: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const syncRedirect = async () => {
            const plan = searchParams.get('plan') || '';
            const params = new URLSearchParams();

            if (plan) params.set('plan', plan);

            if (code) {
                params.set('ref', code);

                try {
                    await trackSellerFunnelEvent({
                        affiliateCode: code,
                        eventType: 'link_click',
                        path: `/convite/${code}`,
                        metadata: plan ? { plan } : {}
                    });
                } catch (error) {
                    console.warn('Falha ao rastrear clique de convite:', error);
                }

                navigate(`/register?${params.toString()}`, { replace: true });
                return;
            }

            const next = params.toString();
            navigate(next ? `/register?${next}` : '/register', { replace: true });
        };

        void syncRedirect();
    }, [code, navigate, searchParams]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#0A0118]">
            <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                <p className="text-sm text-slate-400">Redirecionando...</p>
            </div>
        </div>
    );
};

export default Convite;
