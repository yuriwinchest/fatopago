// Navigation component for authenticated pages
import { Home, CheckCircle, User, AlertTriangle, CreditCard } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

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
        <div className="fixed bottom-0 left-0 right-0 bg-[#0F0529]/95 backdrop-blur-md border-t border-white/5 px-4 py-3 flex justify-between items-end z-50">
            {navItems.map((item, idx) => (
                item.isCenter ? (
                    <div key={idx} className="relative -top-6">
                        <button
                            onClick={() => navigate(item.path)}
                            className="w-16 h-16 bg-purple-600 rounded-3xl flex flex-col items-center justify-center shadow-2xl shadow-purple-600/40 border-4 border-[#0F0529] transform active:scale-95 transition-transform"
                        >
                            {item.icon}
                        </button>
                    </div>
                ) : (
                    <button
                        key={idx}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center gap-1 transition-colors ${isActive(item.path) ? 'text-purple-400' : 'text-slate-500'
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
