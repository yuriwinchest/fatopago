import { useNavigate } from 'react-router-dom';

interface SellerHeaderProps {
    title?: string;
    subtitle?: string;
    onLogout?: () => void;
}

export function SellerHeader({
    title = 'Painel do Vendedor',
    subtitle = 'Acompanhe suas métricas e performance em tempo real.',
    onLogout
}: SellerHeaderProps) {
    const navigate = useNavigate();

    return (
        <header className="relative z-30 pt-4 px-4 sm:px-6 lg:max-w-7xl lg:mx-auto w-full">
            <div className="admin-glass-card overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5 pointer-events-none" />
                
                <div className="relative px-6 py-8 sm:px-8 flex flex-col items-center text-center">
                    <div className="absolute top-4 right-4 flex items-center gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="hidden md:inline-flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-white/70 hover:bg-white/10 hover:text-white transition-all font-display"
                        >
                            Início
                        </button>
                        {onLogout && (
                            <button
                                onClick={onLogout}
                                className="group p-2.5 bg-white/5 hover:bg-red-500/20 rounded-xl transition-all border border-white/5 hover:border-red-500/30 text-white/60 hover:text-red-400"
                                title="Sair"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" x2="9" y1="12" y2="12" />
                                </svg>
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col items-center">
                        <img
                            src="/logo.png"
                            alt="Fatopago"
                            className="h-12 w-auto drop-shadow-[0_0_20px_rgba(168,85,247,0.3)] hover:scale-105 transition-transform duration-500"
                        />

                        <div className="mt-6 max-w-2xl">
                            <h1 className="text-3xl sm:text-4xl font-black text-white font-display uppercase tracking-tight leading-none">
                                {title}
                            </h1>
                            <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                                <span className="h-px w-8 bg-gradient-to-r from-transparent via-cyan-500 to-transparent hidden sm:block" />
                                <p className="text-sm font-medium text-slate-400 font-sans tracking-wide">
                                    {subtitle}
                                </p>
                                <span className="h-px w-8 bg-gradient-to-r from-transparent via-purple-500 to-transparent hidden sm:block" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}
