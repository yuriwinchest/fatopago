import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LandingFakeNewsSectionProps {
    sectionPaddingX: string;
    sectionPaddingY: string;
}

const LandingFakeNewsSection = ({
    sectionPaddingX,
    sectionPaddingY
}: LandingFakeNewsSectionProps) => {
    const navigate = useNavigate();

    return (
        <section className={`${sectionPaddingY} ${sectionPaddingX} relative overflow-hidden`}>
            <div className="absolute top-0 left-0 w-96 h-96 bg-red-600/10 blur-[120px] rounded-full -z-10" />
            <div className="max-w-7xl mx-auto">
                <div className="bg-gradient-to-br from-red-950/40 via-[#1A1040]/60 to-purple-950/40 border-2 border-red-500/20 rounded-[40px] p-8 md:p-12 relative overflow-hidden group hover:border-red-500/40 transition-all">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 blur-[80px] rounded-full" />

                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                        <div className="flex-shrink-0">
                            <div className="w-20 h-20 md:w-24 md:h-24 bg-red-500/10 rounded-3xl flex items-center justify-center border-2 border-red-500/30 group-hover:scale-110 transition-transform">
                                <AlertTriangle className="w-10 h-10 md:w-12 md:h-12 text-red-400" />
                            </div>
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <h2 className="inline-flex text-2xl md:text-4xl font-black mb-3 items-center justify-center md:justify-start gap-3 flex-wrap title-duo-gradient">
                                Notícias Falsas Verificadas
                            </h2>
                            <p className="text-slate-300 text-base md:text-lg leading-relaxed mb-6 max-w-2xl">
                                Veja em tempo real as notícias que foram identificadas como falsas pela nossa comunidade de verificadores.
                                <span className="text-white font-bold"> Transparência total</span> com justificativas e provas.
                            </p>

                            <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
                                <button
                                    onClick={() => navigate('/noticias-falsas')}
                                    className="w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl font-black text-base shadow-lg shadow-red-500/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
                                >
                                    <AlertTriangle className="w-5 h-5" />
                                    VER NOTÍCIAS FALSAS
                                </button>
                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_#ef4444]" />
                                    <span className="font-bold">Atualizado em tempo real</span>
                                </div>
                            </div>
                        </div>

                        <div className="hidden lg:flex flex-col gap-3 w-64">
                            <div className="bg-black/30 border border-red-500/20 rounded-2xl p-4 backdrop-blur-sm">
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-400 font-bold mb-1">Política</p>
                                        <p className="text-sm text-white font-bold line-clamp-2">Informação verificada como falsa...</p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-black/30 border border-red-500/20 rounded-2xl p-4 backdrop-blur-sm">
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-400 font-bold mb-1">Saúde</p>
                                        <p className="text-sm text-white font-bold line-clamp-2">Notícia desmentida pela comunidade...</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-0 right-0 text-9xl font-black text-white/[0.02] pointer-events-none">
                        FAKE
                    </div>
                </div>
            </div>
        </section>
    );
};

export default LandingFakeNewsSection;
