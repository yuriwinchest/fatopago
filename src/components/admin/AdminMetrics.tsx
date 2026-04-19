import React from 'react';
import { User, Users, DollarSign, TrendingUp, CalendarDays } from 'lucide-react';

interface AdminMetricsProps {
    totalUsers: number;
    totalReferralsSystem: number;
    totalCommissionsSystem: number;
    cycleRevenue: number;
    monthRevenue: number;
}

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const AdminMetrics: React.FC<AdminMetricsProps> = ({
    totalUsers,
    totalReferralsSystem,
    totalCommissionsSystem,
    cycleRevenue,
    monthRevenue
}) => {
    return (
        <div className="mb-10 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-5">
            <div className="admin-glass-card p-8 group transition-all duration-500 hover:bg-white/[0.04] border-white/10 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 grayscale opacity-[0.05] group-hover:opacity-[0.15] transition-opacity duration-700 pointer-events-none">
                    <User className="h-32 w-32" />
                </div>
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-purple-500/10 rounded-xl border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)] group-hover:scale-110 transition-transform">
                        <User className="h-5 w-5 text-purple-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 font-display">Hub de Usuarios</span>
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black font-display tracking-tight text-white">{totalUsers}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 italic font-tech">registrados</span>
                </div>
            </div>

            <div className="admin-glass-card p-8 group transition-all duration-500 hover:bg-white/[0.04] border-white/10 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 grayscale opacity-[0.05] group-hover:opacity-[0.15] transition-opacity duration-700 pointer-events-none">
                    <Users className="h-32 w-32" />
                </div>
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-cyan-500/10 rounded-xl border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.15)] group-hover:scale-110 transition-transform">
                        <Users className="h-5 w-5 text-cyan-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 font-display">Rede de Afiliados</span>
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black font-display tracking-tight text-white">{totalReferralsSystem}</span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1 italic font-tech">indicacoes</span>
                </div>
            </div>

            <div className="admin-glass-card p-8 group transition-all duration-500 hover:bg-white/[0.04] border-white/10 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 grayscale opacity-[0.05] group-hover:opacity-[0.15] transition-opacity duration-700 pointer-events-none">
                    <DollarSign className="h-32 w-32" />
                </div>
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-amber-500/10 rounded-xl border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)] group-hover:scale-110 transition-transform">
                        <DollarSign className="h-5 w-5 text-amber-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 font-display">Volume de Retorno</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-3xl font-black font-display tracking-tight text-white italic">
                        {formatCurrency(totalCommissionsSystem)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 font-tech">capital de comissoes</span>
                </div>
            </div>

            <div className="admin-glass-card p-8 group transition-all duration-500 hover:bg-white/[0.04] border-emerald-500/20 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 grayscale opacity-[0.05] group-hover:opacity-[0.15] transition-opacity duration-700 pointer-events-none">
                    <TrendingUp className="h-32 w-32" />
                </div>
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-emerald-500/10 rounded-xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)] group-hover:scale-110 transition-transform">
                        <TrendingUp className="h-5 w-5 text-emerald-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 font-display">Venda do Ciclo</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-3xl font-black font-display tracking-tight text-emerald-300">
                        {formatCurrency(cycleRevenue)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 font-tech">receita ciclo atual</span>
                </div>
            </div>

            <div className="admin-glass-card p-8 group transition-all duration-500 hover:bg-white/[0.04] border-fuchsia-500/20 relative overflow-hidden">
                <div className="absolute -right-4 -top-4 grayscale opacity-[0.05] group-hover:opacity-[0.15] transition-opacity duration-700 pointer-events-none">
                    <CalendarDays className="h-32 w-32" />
                </div>
                <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-fuchsia-500/10 rounded-xl border border-fuchsia-500/20 shadow-[0_0_15px_rgba(217,70,239,0.15)] group-hover:scale-110 transition-transform">
                        <CalendarDays className="h-5 w-5 text-fuchsia-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 font-display">Venda do Mes</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-3xl font-black font-display tracking-tight text-fuchsia-300">
                        {formatCurrency(monthRevenue)}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1 font-tech">receita mensal total</span>
                </div>
            </div>
        </div>
    );
};

export default AdminMetrics;
