import { ArrowLeft, Crown, DollarSign, FileText, Shield, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const EarningsPolicy = () => {
    const navigate = useNavigate();

    const packages = [
        {
            title: 'Pacote Iniciante',
            price: 'R$ 6,00',
            newsCount: 10,
            icon: <Shield className="h-6 w-6 text-blue-400" />,
            borderColor: 'border-blue-500/30',
            headerBg: 'bg-blue-500/10',
            totalEarnings: 'R$ 6,00',
            items: [
                { category: 'Política', count: 2, value: 'R$ 0,60', total: 'R$ 1,20' },
                { category: 'Esporte', count: 2, value: 'R$ 0,40', total: 'R$ 0,80' },
                { category: 'Entretenimento/Famosos', count: 5, value: 'R$ 0,75', total: 'R$ 3,75' },
                { category: 'Economia', count: 1, value: 'R$ 0,25', total: 'R$ 0,25' }
            ]
        },
        {
            title: 'Pacote Pro',
            price: 'R$ 10,00',
            newsCount: 20,
            icon: <Zap className="h-6 w-6 text-purple-400" />,
            borderColor: 'border-purple-500/30',
            headerBg: 'bg-purple-500/10',
            totalEarnings: 'R$ 10,00',
            items: [
                { category: 'Política', count: 6, value: 'R$ 0,60', total: 'R$ 3,60' },
                { category: 'Esporte', count: 6, value: 'R$ 0,40', total: 'R$ 2,40' },
                { category: 'Entretenimento/Famosos', count: 4, value: 'R$ 0,75', total: 'R$ 3,00' },
                { category: 'Economia', count: 4, value: 'R$ 0,25', total: 'R$ 1,00' }
            ]
        },
        {
            title: 'Pacote Expert',
            price: 'R$ 20,00',
            newsCount: 40,
            icon: <Crown className="h-6 w-6 text-amber-400" />,
            borderColor: 'border-amber-500/30',
            headerBg: 'bg-amber-500/10',
            totalEarnings: 'R$ 20,00',
            items: [
                { category: 'Política', count: 12, value: 'R$ 0,60', total: 'R$ 7,20' },
                { category: 'Esporte', count: 12, value: 'R$ 0,40', total: 'R$ 4,80' },
                { category: 'Entretenimento/Famosos', count: 8, value: 'R$ 0,75', total: 'R$ 6,00' },
                { category: 'Economia', count: 8, value: 'R$ 0,25', total: 'R$ 2,00' }
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-[#0F0529] font-sans text-white selection:bg-purple-500/30">
            <header className="sticky top-0 z-40 border-b border-white/10 bg-[#1b0837]/85 backdrop-blur-md">
                <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 py-4 lg:px-10">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center gap-3 text-slate-300 transition-colors hover:text-white"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        <span className="text-sm font-bold">Voltar</span>
                    </button>
                    <img src="/logo.png" alt="Fatopago" className="h-8 w-auto" />
                </div>
            </header>

            <main className="mx-auto w-full max-w-[1200px] px-6 py-12 lg:px-10">
                <section className="mb-14 text-center">
                    <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-2">
                        <FileText className="h-4 w-4 text-purple-300" />
                        <span className="text-xs font-bold uppercase tracking-widest text-purple-200">Transparência</span>
                    </div>
                    <h1 className="text-3xl font-black md:text-5xl">Política de ganhos</h1>
                    <p className="mx-auto mt-5 max-w-3xl text-lg leading-relaxed text-slate-400">
                        Entenda como cada pacote converte validações em retorno potencial por categoria.
                    </p>
                </section>

                <section className="space-y-8">
                    {packages.map((pkg, idx) => (
                        <article
                            key={idx}
                            className={`overflow-hidden rounded-[28px] border ${pkg.borderColor} bg-[#1A1040]/40`}
                        >
                            <div className={`${pkg.headerBg} flex flex-col gap-4 border-b border-white/5 p-6 md:flex-row md:items-center md:justify-between md:p-8`}>
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                                        {pkg.icon}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-white">{pkg.title}</h2>
                                        <p className="text-sm font-medium text-slate-400">
                                            {pkg.newsCount} notícias - valor do pacote: {pkg.price}
                                        </p>
                                    </div>
                                </div>
                                <div className="md:text-right">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        Retorno total estimado
                                    </p>
                                    <p className="text-2xl font-black text-white">{pkg.totalEarnings}</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[680px] border-collapse text-left">
                                    <thead>
                                        <tr className="border-b border-white/5">
                                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Editoria</th>
                                            <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Qtd.</th>
                                            <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Valor unit.</th>
                                            <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {pkg.items.map((item, i) => (
                                            <tr key={i} className="transition-colors hover:bg-white/[0.02]">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-300">{item.category}</td>
                                                <td className="px-6 py-4 text-center text-sm font-bold text-white">{item.count}</td>
                                                <td className="px-6 py-4 text-right text-sm font-medium text-slate-400">{item.value}</td>
                                                <td className="px-6 py-4 text-right text-sm font-bold text-green-400">{item.total}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-white/[0.02]">
                                            <td className="px-6 py-4 text-sm font-black uppercase text-white">Total</td>
                                            <td className="px-6 py-4 text-center text-sm font-black text-white">{pkg.newsCount}</td>
                                            <td className="px-6 py-4 text-right text-sm text-slate-500">-</td>
                                            <td className="px-6 py-4 text-right text-base font-black text-green-400">{pkg.totalEarnings}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </article>
                    ))}
                </section>

                <section className="mt-12 rounded-3xl border border-blue-500/20 bg-blue-500/10 p-8">
                    <div className="flex gap-4">
                        <DollarSign className="h-6 w-6 shrink-0 text-blue-400" />
                        <div>
                            <h3 className="mb-2 text-lg font-bold text-white">Importante sobre os ganhos</h3>
                            <p className="mb-4 text-sm leading-relaxed text-slate-300">
                                Os valores acima representam o potencial máximo de retorno ao concluir todas as validações do pacote.
                            </p>
                            <ul className="list-inside list-disc space-y-1 text-sm text-slate-400">
                                <li>Pagamento creditado no saldo após a validação.</li>
                                <li>Saque via PIX ao atingir valor mínimo.</li>
                                <li>Valores podem mudar conforme termos de uso vigentes.</li>
                            </ul>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="border-t border-white/5 py-8 text-center text-xs font-bold uppercase tracking-widest text-slate-600">
                © 2026 Fatopago. Todos os direitos reservados.
            </footer>
        </div>
    );
};

export default EarningsPolicy;
