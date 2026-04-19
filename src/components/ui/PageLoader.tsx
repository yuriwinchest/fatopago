interface PageLoaderProps {
    label?: string;
    fullScreen?: boolean;
}

const PageLoader = ({
    label = 'Carregando...',
    fullScreen = false
}: PageLoaderProps) => {
    const wrapperClassName = fullScreen
        ? 'flex min-h-screen items-center justify-center bg-[#0F0529]'
        : 'admin-glass-card p-12 text-center text-slate-400 font-display uppercase tracking-widest text-[10px] font-bold';

    return (
        <div className={wrapperClassName}>
            <div className="flex flex-col items-center gap-4">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-fuchsia-500" />
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                    {label}
                </p>
            </div>
        </div>
    );
};

export default PageLoader;
