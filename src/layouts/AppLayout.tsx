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
        <div className="min-h-screen bg-[#0F0529] text-white font-sans pb-24 relative overflow-x-hidden">
            <AppHeader
                title={title}
                subtitle={subtitle}
                showBackButton={showBackButton}
                showLogout={showLogout}
                onLogout={handleLogout}
                className={headerClassName}
            />

            <CycleTimer />

            <main className="max-w-md mx-auto px-6 mt-6">
                {children}
            </main>

            <BottomNav />
        </div>
    );
};
