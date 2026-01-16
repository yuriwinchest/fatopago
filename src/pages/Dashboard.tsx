
import { useState } from 'react';
import {
    Users,
    MapPin,
    Trophy,
    Wallet,
    BarChart2,
    Copy,
    CheckCircle,
    Medal,
    Home,
    User,
    ShieldCheck,
    CreditCard
} from 'lucide-react';

const Dashboard = () => {
    const [selectedTab, setSelectedTab] = useState<'cidade' | 'estado' | 'brasil'>('cidade');

    return (
        <div className="min-h-screen bg-brand-dark text-white font-sans pb-24">
            {/* Navbar */}
            <div className="flex justify-between items-center p-6 lg:px-8 bg-brand-dark/50 backdrop-blur-md sticky top-0 z-50 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <span className="font-bold text-white text-sm">✓</span>
                    </div>
                    <span className="font-bold text-lg tracking-tight">FatoPago</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Bem-vindo</p>
                        <p className="text-sm font-bold">João Pereira</p>
                    </div>
                    <div className="w-10 h-10 rounded-full border-2 border-white/20 overflow-hidden">
                        <img src="https://i.pravatar.cc/150?u=a042581f4e29026704d" alt="Profile" className="w-full h-full object-cover" />
                    </div>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 mt-6 space-y-6">

                {/* Balance Card - The Purple Glow Card */}
                <div className="bg-gradient-to-br from-[#8a2ce2] to-[#6a1b9a] rounded-3xl p-6 shadow-[0_0_40px_-10px_rgba(138,44,226,0.5)] relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-[10px] font-bold text-purple-200 uppercase tracking-widest mb-1">Saldo Disponível</p>
                                <h2 className="text-4xl font-extrabold text-white">R$ 67,50</h2>
                            </div>
                            <button className="bg-white text-purple-900 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg hover:scale-105 transition-transform">
                                Sacar Saldo <Wallet className="w-3 h-3" />
                            </button>
                        </div>

                        <div className="inline-flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg mb-6 backdrop-blur-sm border border-white/10">
                            <ShieldCheck className="w-3 h-3 text-purple-200" />
                            <span className="text-[10px] font-bold text-white">A liberar: R$ 14,00 em análise</span>
                        </div>

                        <div>
                            <div className="flex justify-between text-[10px] font-bold text-purple-200 mb-2">
                                <span>Progresso da Meta Diária</span>
                                <span className="text-white">80%</span>
                            </div>
                            <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                                <div className="h-full bg-white w-[80%] rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                            </div>
                            <p className="text-[10px] text-purple-200 mt-2">Faltam apenas R$ 12,50 para o bônus!</p>
                        </div>
                    </div>

                    {/* Decorative Circles */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10" />
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -ml-5 -mb-5" />
                </div>

                {/* Global Ranking Section */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <BarChart2 className="w-5 h-5 text-purple-400" />
                            <h3 className="font-bold text-lg">Ranking Global</h3>
                        </div>
                        <button className="text-[10px] font-bold text-purple-400 hover:text-white transition-colors">Ver detalhes</button>
                    </div>

                    {/* Tabs */}
                    <div className="bg-[#1A1040] p-1 rounded-xl flex mb-4 border border-white/5">
                        {(['cidade', 'estado', 'brasil'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setSelectedTab(tab)}
                                className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${selectedTab === tab
                                        ? 'bg-[#8a2ce2] text-white shadow-lg'
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Ranking List */}
                    <div className="space-y-3">
                        {/* Item 1 */}
                        <div className="bg-[#1A1040] p-4 rounded-2xl flex items-center justify-between border border-white/5 relative overflow-hidden group">
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-xs font-bold">1</div>
                                <div className="w-10 h-10 rounded-xl bg-purple-900 flex items-center justify-center text-xs font-bold text-purple-200 uppercase border border-purple-500/30">SP</div>
                                <div>
                                    <p className="font-bold text-sm">São Paulo</p>
                                    <p className="text-[10px] text-slate-400">103 notícias validadas</p>
                                </div>
                            </div>
                            <Trophy className="w-4 h-4 text-purple-400" />
                        </div>

                        {/* Item 2 */}
                        <div className="bg-[#1A1040] p-4 rounded-2xl flex items-center justify-between border border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="w-6 h-6 rounded-full bg-slate-700/50 text-slate-400 flex items-center justify-center text-xs font-bold">2</div>
                                <div className="w-10 h-10 rounded-xl bg-[#2D2A55] flex items-center justify-center text-xs font-bold text-slate-300 uppercase border border-slate-600/30">BS</div>
                                <div>
                                    <p className="font-bold text-sm">Brasília</p>
                                    <p className="text-[10px] text-slate-400">98 notícias validadas</p>
                                </div>
                            </div>
                            <Trophy className="w-4 h-4 text-slate-600" />
                        </div>

                        {/* User Ranking Card (Floating) */}
                        <div className="bg-gradient-to-r from-[#2D2A55] to-[#1A1040] p-4 rounded-2xl flex items-center justify-between border border-purple-500/30 shadow-lg relative mt-6 transform scale-105">
                            <div className="absolute -top-3 left-4 bg-purple-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">Sua Posição</div>
                            <div className="flex items-center gap-4">
                                <div className="w-6 h-6 rounded-full bg-white/10 text-white flex items-center justify-center text-xs font-bold">4</div>
                                <div className="w-10 h-10 rounded-xl bg-white text-purple-900 flex items-center justify-center text-xs font-extrabold uppercase shadow-lg">JO</div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-sm">João Pereira</p>
                                        <span className="bg-white/10 text-[9px] px-1.5 rounded text-white font-medium">VOCÊ</span>
                                    </div>
                                    <p className="text-[10px] text-purple-200">39 notícias validadas</p>
                                </div>
                            </div>
                            <Medal className="w-4 h-4 text-purple-400" />
                        </div>
                    </div>
                </div>

                {/* Performance Stats */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-slate-400" />
                        <h3 className="font-bold text-lg">Seu Desempenho</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-[#1A1040] p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                                <CheckCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-white leading-none">81%</h4>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Taxa de Precisão</p>
                            </div>
                        </div>

                        <div className="bg-[#1A1040] p-4 rounded-2xl border border-white/5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                                <Trophy className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="text-2xl font-bold text-white leading-none">57</h4>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mt-1">Pontos Totais</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Referral Program */}
                <div className="bg-[#1A1040] rounded-3xl p-5 border border-white/5 relative overflow-hidden">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center shrink-0">
                            <Users className="w-6 h-6 text-purple-300" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-sm">Programa de Indicação</h3>
                            <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">Ganhe <span className="text-purple-300 font-bold">R$ 10,00</span> por cada novo validador convidado.</p>
                        </div>
                        <button className="ml-auto bg-gradient-to-r from-[#BB86FC] to-[#8a2ce2] text-white text-[10px] font-bold px-4 py-2 rounded-lg shadow-lg hover:opacity-90 transition-opacity">
                            CONVIDAR AGORA
                        </button>
                    </div>
                </div>

                {/* Link Copy Section */}
                <div className="text-center">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-3">Seu Link Exclusivo</p>
                    <div className="bg-[#1A1040] p-2 rounded-xl border border-white/5 flex items-center justify-between pl-4">
                        <span className="text-xs text-slate-300 font-mono truncate mr-2">fatopago.com/convite/joao772</span>
                        <button className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 px-4 py-2 rounded-lg text-[10px] font-bold flex items-center gap-2 transition-colors">
                            COPIAR <Copy className="w-3 h-3" />
                        </button>
                    </div>
                </div>

                {/* Info Footer */}
                <div className="bg-[#1A1040] rounded-3xl p-6 border border-white/5 mb-8">
                    <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                        <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Informações de Saque</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">
                        As transferências são processadas em até <strong className="text-white">24 horas úteis</strong>. A validação das notícias passa por auditoria antes do crédito ser liberado.
                    </p>
                    <div className="flex gap-2">
                        <span className="text-[9px] font-bold text-slate-500 bg-black/20 px-2 py-1 rounded border border-white/5">PIX INSTANTÂNEO</span>
                        <span className="text-[9px] font-bold text-slate-500 bg-black/20 px-2 py-1 rounded border border-white/5">MÍNIMO R$ 50,00</span>
                    </div>
                </div>
            </div>

            {/* Bottom Nav */}
            <div className="fixed bottom-0 left-0 right-0 bg-[#0F0826] border-t border-white/5 px-6 py-4 flex justify-between items-end z-50 lg:hidden">
                <button className="flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors group">
                    <Home className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                    <span className="text-[9px] font-bold">INÍCIO</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors group">
                    <BarChart2 className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                    <span className="text-[9px] font-bold">RANKING</span>
                </button>
                <div className="relative -top-5">
                    <button className="w-14 h-14 bg-[#8a2ce2] rounded-2xl flex flex-col items-center justify-center shadow-[0_0_20px_rgba(138,44,226,0.5)] border-4 border-[#0F0826] hover:scale-105 transition-transform">
                        <CheckCircle className="w-6 h-6 text-white fill-current" />
                    </button>
                    <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-purple-300">VALIDAR</span>
                </div>
                <button className="flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors group">
                    <Wallet className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                    <span className="text-[9px] font-bold">SALDO</span>
                </button>
                <button className="flex flex-col items-center gap-1 text-slate-500 hover:text-white transition-colors group">
                    <User className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                    <span className="text-[9px] font-bold">PERFIL</span>
                </button>
            </div>
        </div>
    );
};

export default Dashboard;
