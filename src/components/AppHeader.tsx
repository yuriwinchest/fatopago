import { useNavigate } from 'react-router-dom';

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

    return (
        <div className={`relative z-30 bg-[#2e0259] rounded-b-[40px] shadow-2xl pb-6 pt-8 px-6 ${className}`}>
            {/* Navigation buttons */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-50">
                {showBackButton ? (
                    <button
                        title="Voltar"
                        onClick={() => navigate(-1)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white backdrop-blur-sm"
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
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors text-white/80 hover:text-white backdrop-blur-sm"
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
                            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">
                                {title}
                            </h1>
                        )}
                        {subtitle && (
                            <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-sm mx-auto">
                                {subtitle}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AppHeader;
