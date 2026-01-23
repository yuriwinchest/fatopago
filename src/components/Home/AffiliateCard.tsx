import { Copy, Users } from 'lucide-react';
import { useState } from 'react';

interface AffiliateCardProps {
    affiliateCode: string;
}

export const AffiliateCard = ({ affiliateCode }: AffiliateCardProps) => {
    const [copied, setCopied] = useState(false);

    const referralLink = `fatopago.com/convite/${affiliateCode || 'gerar'}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-gradient-to-r from-[#1A1040] to-[#251854] rounded-2xl p-5 border border-white/5 relative overflow-hidden group">
            <div className="flex items-start gap-4 mb-4">
                <div className="bg-purple-500/10 p-2.5 rounded-xl border border-purple-500/20">
                    <Users className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                    <h3 className="font-bold text-white text-sm">Programa de Indicação</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                        Ganhe <span className="text-purple-300 font-bold">R$ 10,00</span> por cada novo validador que você convidar para o porto fatora.
                    </p>
                </div>
            </div>

            <div className="relative">
                <div className="bg-black/20 p-2 rounded-xl border border-white/5 flex items-center justify-between pl-4">
                    <span className="text-[10px] text-slate-300 font-mono truncate mr-2">
                        {referralLink}
                    </span>
                    <button
                        onClick={handleCopy}
                        className={`px-4 py-2 rounded-lg text-[10px] font-bold flex items-center gap-2 transition-all ${copied ? 'bg-green-500 text-white' : 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                            }`}
                    >
                        {copied ? 'COPIADO' : 'COPIAR'} <Copy className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Subtle glow effect on hover */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl group-hover:bg-purple-600/20 transition-all" />
        </div>
    );
};
