import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomNav from '../components/BottomNav';
import { CycleTimer } from '../components/CycleTimer';
import { supabase } from '../lib/supabase';

interface AppLayoutProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    showLogout?: boolean;
    showBackButton?: boolean;
    headerClassName?: string;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
    children,
    title,
    subtitle,
    showLogout = false,
    showBackButton = false,
    headerClassName
}) => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    return (
        <div className="relative min-h-screen min-h-[100dvh] touch-pan-y overflow-x-hidden bg-[#0F0529] pb-[calc(6rem+env(safe-area-inset-bottom))] text-white font-sans lg:pb-10">
            <AppHeader
                title={title}
                subtitle={subtitle}
                showBackButton={showBackButton}
                showLogout={showLogout}
                onLogout={handleLogout}
                className={headerClassName}
            />

            <CycleTimer />

            <main className="mx-auto mt-6 w-full max-w-md touch-pan-y px-6 md:px-8 lg:mt-8 lg:max-w-[1200px] lg:px-10">
                {children}
            </main>

            <BottomNav />
        </div>
    );
};
