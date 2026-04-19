// Navigation component for authenticated pages
import { Home, CheckCircle, User, AlertTriangle, CreditCard } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { resolveIsAdminUser } from '../lib/authRouting';

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            const module = await import('../lib/supabase');
            const client = module.supabase;
            if (!client?.auth?.getUser) return;
            const { data: { user } } = await client.auth.getUser();
            const isAdmin = await resolveIsAdminUser(user?.id);
            if (isAdmin) {
                setIsAdmin(true);
            }
        };
        checkUser();
    }, []);

    const isActive = (path: string) => location.pathname === path;

    if (isAdmin) return null;

    const navItems = [
        { icon: <Home className="w-6 h-6" />, label: 'Home', path: '/dashboard' },
        { icon: <CreditCard className="w-6 h-6" />, label: 'Planos', path: '/plans' },
        {
            icon: <CheckCircle className="w-8 h-8 text-white" />,
            label: 'Validar',
            path: '/validation',
            isCenter: true
        },
        { icon: <AlertTriangle className="w-6 h-6" />, label: 'Falsas', path: '/noticias-falsas' },
        { icon: <User className="w-6 h-6" />, label: 'Perfil', path: '/profile' }
    ];

    return (
        <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-[120] flex items-end justify-between border-t border-white/5 bg-[#0F0529]/95 px-[calc(1rem+env(safe-area-inset-left))] pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md lg:hidden">
            {navItems.map((item, idx) => (
                item.isCenter ? (
                    <div key={idx} className="relative -top-6">
                        <button
                            onClick={() => navigate(item.path)}
                            className="pointer-events-auto flex h-16 w-16 transform flex-col items-center justify-center rounded-3xl border-4 border-[#0F0529] bg-purple-600 shadow-2xl shadow-purple-600/40 transition-transform active:scale-95"
                        >
                            {item.icon}
                        </button>
                    </div>
                ) : (
                    <button
                        key={idx}
                        onClick={() => navigate(item.path)}
                        className={`pointer-events-auto flex flex-col items-center gap-1 transition-colors ${isActive(item.path) ? 'text-purple-400' : 'text-slate-500'
                            }`}
                    >
                        {item.icon}
                        <span className="text-[8px] font-black uppercase tracking-wider">{item.label}</span>
                    </button>
                )
            ))}
        </div>
    );
};

export default BottomNav;
