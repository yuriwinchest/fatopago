import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Home, CreditCard, CheckCircle, AlertTriangle, User } from 'lucide-react';
import { resolveIsAdminUser } from '../lib/authRouting';

interface AppHeaderProps {
    title?: string;
    subtitle?: string;
    showBackButton?: boolean;
    showLogout?: boolean;
    onLogout?: () => void;
    className?: string;
}

const AppHeader = ({
    title,
    subtitle,
    showBackButton = false,
    showLogout = false,
    onLogout,
    className = ''
}: AppHeaderProps) => {
    const navigate = useNavigate();
    const location = useLocation();

    const [isAdmin, setIsAdmin] = useState(false);
    const [balance, setBalance] = useState<number | null>(null);
    const [validationsCount, setValidationsCount] = useState<number>(0);

    useEffect(() => {
        const checkUser = async () => {
            const module = await import('../lib/supabase');
            const client = module.supabase;
            if (!client?.auth?.getUser) return;
            const { data: { user } } = await client.auth.getUser();
            const isAdmin = await resolveIsAdminUser(user?.id);
            if (isAdmin) {
                setIsAdmin(true);
            } else if (user) {
                // Fetch user profile balance
                const { data: profile } = await client.from('profiles').select('current_balance').eq('id', user.id).maybeSingle();
                if (profile) {
                    setBalance(profile.current_balance || 0);
                }
                
                // Fetch validations count for today/cycle
                const { data: plans } = await client.from('plan_purchases')
                    .select('used_validations')
                    .eq('user_id', user.id)
                    .in('status', ['active', 'completed']);
                
                if (plans && plans.length > 0) {
                    const totalValidations = plans.reduce((sum: number, p: any) => sum + (p.used_validations || 0), 0);
                    setValidationsCount(totalValidations);
                }
            }
        };
        checkUser();
    }, []);

    const headerContainerClass = `relative z-30 bg-gradient-to-br from-[#1a0133] via-[#2e0259] to-[#1a0133] rounded-b-[40px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-b border-white/5 pb-6 pt-[calc(2rem+env(safe-area-inset-top))] px-6 pl-safe pr-safe lg:mx-auto lg:mt-4 lg:max-w-[1400px] lg:rounded-[32px] lg:px-8 backdrop-blur-xl ${className}`;

    if (isAdmin) {
        return (
            <div className={headerContainerClass}>
                <div className="flex flex-col items-center justify-center pt-4">
                    <img
                        src="/logo.png"
                        alt="Fatopago Logo"
                        className="h-auto w-48 sm:w-56 md:w-64 drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                    />
                    {(title || subtitle) && (
                        <div className="text-center mt-4">
                            {title && (
                                <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-white to-purple-400 font-display uppercase tracking-[0.2em]">
                                    {title}
                                </h1>
                            )}
                            {subtitle && (
                                <p className="text-slate-400 mt-2 text-[10px] font-bold uppercase tracking-[0.3em] font-tech max-w-sm mx-auto opacity-70 leading-relaxed">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    )}
                    <div className="mt-4">
                        {showLogout && onLogout && (
                            <button
                                onClick={onLogout}
                                className="px-6 py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded-2xl text-white text-[11px] font-black uppercase tracking-widest transition-all font-display shadow-lg"
                            >
                                Sair do Sistema
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={headerContainerClass}>
            {/* Navigation buttons */}
            <div className="pointer-events-none absolute top-4 left-4 right-4 z-50 flex items-center justify-between">
                {showBackButton ? (
                    <button
                        title="Voltar"
                        onClick={() => navigate(-1)}
                        className="pointer-events-auto rounded-full bg-white/10 p-2 text-white/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5M12 19l-7-7 7-7" />
                        </svg>
                    </button>
                ) : (
                    <div />
                )}

                {showLogout && onLogout && (
                    <button
                        onClick={onLogout}
                        className="pointer-events-auto rounded-full bg-white/10 p-2 text-white/80 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
                        title="Sair"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" x2="9" y1="12" y2="12" />
                        </svg>
                    </button>
                )}
            </div>

            {/* Centered Logo */}
            <div className="flex flex-col items-center justify-center pt-4">
                <img
                    src="/logo.png"
                    alt="Fatopago Logo"
                    className="h-auto w-48 sm:w-56 md:w-64 drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                />

                {/* Title/Subtitle if provided */}
                {(title || subtitle) && (
                    <div className="text-center mt-4">
                        {title && (
                            <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-white to-purple-400 font-display uppercase tracking-[0.2em]">
                                {title}
                            </h1>
                        )}
                        {subtitle && (
                            <p className="text-slate-400 mt-2 text-[10px] font-bold uppercase tracking-[0.3em] font-tech max-w-sm mx-auto opacity-70 leading-relaxed">
                                {subtitle}
                            </p>
                        )}
                    </div>
                )}

                {/* User Quick Stats (Balance & Validations) - Visible everywhere */}
                {balance !== null && (
                    <div className="flex items-center gap-3 px-4 py-2 mt-4 bg-black/20 border border-white/5 rounded-full backdrop-blur-md">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase text-purple-300 tracking-widest">Saldo:</span>
                            <span className="text-sm font-black text-emerald-400">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(balance)}
                            </span>
                        </div>
                        <div className="w-px h-3 bg-white/10" />
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase text-purple-300 tracking-widest">Validadas:</span>
                            <span className="text-sm font-black text-white">{validationsCount}</span>
                        </div>
                    </div>
                )}

                {/* Desktop Navigation */}
                <div className="hidden lg:flex flex-col items-center gap-3 mt-4">
                    <nav className="flex items-center gap-1 bg-white/5 p-1 rounded-2xl border border-white/5 backdrop-blur-md shadow-inner">
                        {[
                            { icon: <Home className="w-4 h-4" />, label: 'Home', path: '/dashboard' },
                            { icon: <CreditCard className="w-4 h-4" />, label: 'Planos', path: '/plans' },
                            { icon: <CheckCircle className="w-4 h-4" />, label: 'Validar', path: '/validation' },
                            { icon: <AlertTriangle className="w-4 h-4" />, label: 'Falsas', path: '/noticias-falsas' },
                            { icon: <User className="w-4 h-4" />, label: 'Perfil', path: '/profile' }
                        ].map((item) => {
                            const active = location.pathname === item.path;
                            return (
                                <button
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    className={`
                                        flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 font-display
                                        ${active
                                            ? 'bg-purple-600 text-white shadow-[0_5px_15px_rgba(147,51,234,0.4)] ring-1 ring-white/20 scale-105'
                                            : 'text-slate-400 hover:text-white hover:bg-white/10'
                                        }
                                    `}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>
        </div>
    );
};

export default AppHeader;
