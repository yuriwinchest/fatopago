import { useNavigate } from 'react-router-dom';
import { PLATFORM_CONTACT_EMAIL, PLATFORM_CONTACT_MAILTO } from '../../lib/platformContact';

interface LandingFooterProps {
    sectionPaddingX: string;
}

const LandingFooter = ({ sectionPaddingX }: LandingFooterProps) => {
    const navigate = useNavigate();

    return (
        <footer className={`py-12 md:py-14 ${sectionPaddingX} border-t border-white/5 bg-black/20`}>
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
                <div>
                    <img src="/logo.png" alt="Fatopago Logo" className="h-10 mb-6" />
                    <p className="text-slate-500 text-sm max-w-xs leading-relaxed font-medium">
                        Combata a desinformação e seja recompensado por isso. A primeira plataforma focada na verdade dos fatos.
                    </p>
                </div>
                <div className="flex flex-col items-center md:items-end gap-4">
                    <div className="flex gap-6">
                        <button onClick={() => navigate('/termos')} className="text-slate-400 hover:text-white transition-colors">Termos</button>
                        <button onClick={() => navigate('/privacidade')} className="text-slate-400 hover:text-white transition-colors">Privacidade</button>
                        <button onClick={() => navigate('/politica-ganhos')} className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Política de Ganhos</button>
                        <button onClick={() => navigate('/contato')} className="text-slate-400 hover:text-white transition-colors">Contato</button>
                    </div>
                    <div className="flex flex-col items-center gap-1 md:items-end">
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">E-mail oficial</p>
                        <a
                            href={PLATFORM_CONTACT_MAILTO}
                            className="text-sm font-semibold text-slate-300 transition-colors hover:text-white"
                        >
                            {PLATFORM_CONTACT_EMAIL}
                        </a>
                    </div>
                        <div className="flex flex-col items-center gap-3 md:items-end">
                            <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">© 2026 FATOPAGO. TODOS OS DIREITOS RESERVADOS.</p>
                            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest flex items-center gap-2">
                                Desenvolvedor responsável: 
                                <a 
                                    href="https://yuriwinchester.com.br/" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-purple-400 hover:text-purple-300 transition-colors border-b border-purple-500/30 pb-0.5"
                                >
                                    Yuri Winchester
                                </a>
                            </p>
                        </div>
                </div>
            </div>
        </footer>
    );
};

export default LandingFooter;
