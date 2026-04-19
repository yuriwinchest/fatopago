import React, { ReactNode } from 'react';

interface AuthLayoutProps {
    children: ReactNode;
    leftPanelContent?: ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, leftPanelContent }) => {
    return (
        <div className="min-h-screen min-h-[100dvh] overflow-x-hidden bg-[#0F0529] pb-safe font-sans">
            <div className="mx-auto flex min-h-screen min-h-[100dvh] w-full max-w-[1440px] flex-col overflow-x-hidden lg:px-6 xl:px-8 lg:py-6">
                <div className="flex flex-1 flex-col lg:flex-row lg:overflow-hidden lg:rounded-[34px] lg:border lg:border-white/10 lg:bg-[#120734]/65 lg:shadow-[var(--platform-surface-shadow)]">
                    {/* Left Panel - Vibrant Gradient */}
                    <div className="relative z-10 flex min-h-[280px] flex-col justify-between overflow-hidden rounded-b-[42px] bg-gradient-to-br from-[#8a2ce2] to-[#6922D9] text-white shadow-2xl lg:min-h-full lg:w-[44%] lg:rounded-none lg:rounded-l-[34px]">

                        {/* Header with Logo */}
                        <div className="relative z-20 flex items-center justify-center rounded-b-[40px] bg-[#2e0259] pb-6 pt-[calc(2rem+env(safe-area-inset-top))] shadow-2xl pl-safe pr-safe lg:rounded-b-[30px] lg:pb-8 lg:pt-12">
                            <div className="flex scale-100 transform items-center justify-center transition-transform lg:scale-110">
                                <img
                                    src="/logo.png"
                                    alt="Fatopago Logo"
                                    className="h-auto w-48 sm:w-56 md:w-64 drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                                />
                            </div>
                        </div>

                        {/* Left Panel Content */}
                        <div className="relative z-10 flex flex-1 flex-col">
                            {leftPanelContent}
                        </div>

                        {/* Background Decor */}
                        <img
                            src="/watermark.png?v=4"
                            alt=""
                            className="pointer-events-none absolute left-1/2 top-1/2 w-[120%] -translate-x-1/2 -translate-y-1/2 select-none mix-blend-screen opacity-[0.05] blur-[1px]"
                        />
                        <div className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-purple-400/20 blur-3xl" />
                        <div className="pointer-events-none absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full bg-purple-900/20 blur-3xl" />
                    </div>

                    {/* Right Panel - Form Container */}
                    <div className="relative flex min-h-[500px] flex-col justify-center bg-[#0F0529] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 lg:min-h-full lg:w-[56%] lg:bg-transparent lg:p-16 xl:p-20">
                        <div className="relative z-10 mx-auto w-full max-w-md min-w-0">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
