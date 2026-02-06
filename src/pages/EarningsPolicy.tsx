import { ArrowLeft, DollarSign, FileText, Shield, Zap, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const EarningsPolicy = () => {
    const navigate = useNavigate();

    const packages = [
        {
            title: "Pacote Iniciante",
            price: "R$ 5,00",
            newsCount: 10,
            icon: <Shield className="w-6 h-6 text-blue-400" />,
            borderColor: "border-blue-500/30",
            headerBg: "bg-blue-500/10",
            totalEarnings: "R$ 5,00",
            items: [
                { category: "Política", count: 3, value: "R$ 0,60", total: "R$ 1,80" },
                { category: "Esporte", count: 3, value: "R$ 0,40", total: "R$ 1,20" },
                { category: "Entretenimento/Famosos", count: 2, value: "R$ 0,75", total: "R$ 1,50" },
                { category: "Economia", count: 2, value: "R$ 0,25", total: "R$ 0,50" },
            ]
        },
        {
            title: "Pacote Pro",
            price: "R$ 10,00",
            newsCount: 20,
            icon: <Zap className="w-6 h-6 text-purple-400" />,
            borderColor: "border-purple-500/30",
            headerBg: "bg-purple-500/10",
            totalEarnings: "R$ 10,00",
            items: [
                { category: "Política", count: 6, value: "R$ 0,60", total: "R$ 3,60" },
                { category: "Esporte", count: 6, value: "R$ 0,40", total: "R$ 2,40" },
                { category: "Entretenimento/Famosos", count: 4, value: "R$ 0,75", total: "R$ 3,00" },
                { category: "Economia", count: 4, value: "R$ 0,25", total: "R$ 1,00" },
            ]
        },
        {
            title: "Pacote Expert",
            price: "R$ 20,00",
            newsCount: 40,
            icon: <Crown className="w-6 h-6 text-amber-400" />,
            borderColor: "border-amber-500/30",
            headerBg: "bg-amber-500/10",
            totalEarnings: "R$ 20,00",
            items: [
                { category: "Política", count: 12, value: "R$ 0,60", total: "R$ 7,20" },
                { category: "Esporte", count: 12, value: "R$ 0,40", total: "R$ 4,80" },
                { category: "Entretenimento/Famosos", count: 8, value: "R$ 0,75", total: "R$ 6,00" },
                { category: "Economia", count: 8, value: "R$ 0,25", total: "R$ 2,00" },
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-[#0F0529] text-white font-sans selection:bg-purple-500/30">
            {/* Navbar Simplificada */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#2e0259]/80 backdrop-blur-lg border-b border-white/10 px-6 py-4">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
                        <ArrowLeft className="w-6 h-6 text-slate-300 hover:text-white transition-colors" />
                        <span className="font-bold text-lg">Voltar</span>
                    </div>
                    <img src="/logo.png" alt="Fatopago" className="h-8 md:h-10" />
                </div>
            </nav>

            <main className="pt-32 pb-20 px-6 max-w-4xl mx-auto">
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 px-4 py-2 rounded-full mb-6">
                        <FileText className="w-4 h-4 text-purple-400" />
                        <span className="text-xs font-bold text-purple-200 uppercase tracking-widest">Transparência</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black mb-6">Política de Ganhos</h1>
                    <p className="text-slate-400 text-lg leading-relaxed max-w-2xl mx-auto">
                        Entenda detalhadamente como funciona a remuneração por cada pacote e editoria de notícias.
                    </p>
                </div>

                <div className="space-y-12">
                    {packages.map((pkg, idx) => (
                        <div key={idx} className={`bg-[#1A1040]/40 border ${pkg.borderColor} rounded-[32px] overflow-hidden`}>
                            <div className={`${pkg.headerBg} p-8 flex flex-col md:flex-row justify-between items-center gap-4 border-b border-white/5`}>
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                                        {pkg.icon}
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white">{pkg.title}</h3>
                                        <p className="text-sm text-slate-400 font-medium">{pkg.newsCount} Notícias • Valor: {pkg.price}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Retorno Total Estimado</p>
                                    <p className="text-2xl font-black text-white">{pkg.totalEarnings}</p>
                                </div>
                            </div>

                            <div className="p-0 md:p-8 overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-white/5">
                                            <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Editoria</th>
                                            <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Qtd.</th>
                                            <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Valor Unit.</th>
                                            <th className="py-4 px-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {pkg.items.map((item, i) => (
                                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="py-4 px-6 text-sm font-medium text-slate-300">{item.category}</td>
                                                <td className="py-4 px-6 text-sm font-bold text-white text-center">{item.count}</td>
                                                <td className="py-4 px-6 text-sm font-medium text-slate-400 text-right">{item.value}</td>
                                                <td className="py-4 px-6 text-sm font-bold text-green-400 text-right">{item.total}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-white/[0.02]">
                                            <td className="py-4 px-6 text-sm font-black text-white uppercase">Total</td>
                                            <td className="py-4 px-6 text-sm font-black text-white text-center">{pkg.newsCount}</td>
                                            <td className="py-4 px-6 text-sm font-medium text-slate-500 text-right">—</td>
                                            <td className="py-4 px-6 text-base font-black text-green-400 text-right">{pkg.totalEarnings}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-16 p-8 bg-blue-500/10 border border-blue-500/20 rounded-3xl">
                    <div className="flex gap-4">
                        <DollarSign className="w-6 h-6 text-blue-400 flex-shrink-0" />
                        <div>
                            <h4 className="text-lg font-bold text-white mb-2">Importante sobre os Ganhos</h4>
                            <p className="text-slate-300 text-sm leading-relaxed mb-4">
                                Os valores apresentados acima representam o potencial máximo de retorno de cada pacote ao completar todas as validações com sucesso.
                            </p>
                            <ul className="list-disc list-inside text-sm text-slate-400 space-y-1">
                                <li>O pagamento é creditado em seu saldo imediatamente após a validação.</li>
                                <li>Você pode sacar seus ganhos via PIX assim que atingir o valor mínimo de saque.</li>
                                <li>Valores sujeitos a alterações conforme termos de uso vigentes.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>

            <footer className="py-8 text-center text-slate-600 text-xs font-bold uppercase tracking-widest border-t border-white/5">
                © 2026 Fatopago. Todos os direitos reservados.
            </footer>
        </div>
    );
};

export default EarningsPolicy;
