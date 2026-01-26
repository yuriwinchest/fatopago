import React, { ReactNode } from 'react';

interface AuthLayoutProps {
    children: ReactNode;
    leftPanelContent?: ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, leftPanelContent }) => {
    return (
        <div className="min-h-screen flex flex-col lg:flex-row font-sans bg-[#0F0529]">
            {/* Left Panel - Vibrant Gradient */}
            <div className="lg:w-[45%] flex flex-col justify-between bg-gradient-to-br from-[#8a2ce2] to-[#6922D9] relative overflow-hidden text-white rounded-b-[50px] lg:rounded-none shadow-2xl z-10 min-h-[300px] lg:min-h-screen">

                {/* Header with Logo */}
                <div className="relative z-20 bg-[#2e0259] pt-8 pb-6 lg:pt-12 lg:pb-8 rounded-b-[40px] shadow-2xl flex justify-center items-center">
                    <div className="flex items-center gap-3 transform scale-100 lg:scale-110 transition-transform">
                        <div className="relative w-10 h-8 lg:w-12 lg:h-10 bg-gradient-to-br from-[#a855f7] to-[#7e22ce] rounded-lg flex items-center justify-center shadow-lg border border-white/20 transform -skew-x-12">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white transform skew-x-12 w-5 h-5 lg:w-6 lg:h-6">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        </div>
                        <h1 className="text-2xl lg:text-3xl font-black tracking-wide text-white drop-shadow-lg italic">FATOPAGO</h1>
                    </div>
                </div>

                {/* Left Panel Content */}
                <div className="relative z-10 flex-1 flex flex-col">
                    {leftPanelContent}
                </div>

                {/* Background Decor */}
                <img
                    src="/watermark.png?v=4"
                    alt=""
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] opacity-[0.05] pointer-events-none select-none mix-blend-screen blur-[1px]"
                />
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-900/20 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />
            </div>

            {/* Right Panel - Form Container */}
            <div className="lg:w-[55%] bg-[#0F0529] p-6 lg:p-16 flex flex-col justify-center relative min-h-[500px]">
                <div className="max-w-md w-full mx-auto relative z-10">
                    {children}
                </div>
            </div>
        </div>
    );
};
