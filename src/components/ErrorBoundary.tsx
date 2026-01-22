
import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#0F0529] flex items-center justify-center p-6 text-center text-white">
                    <div className="max-w-md w-full bg-[#1A1040] border border-white/10 p-8 rounded-3xl shadow-2xl">
                        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-10 h-10 text-red-500" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Ops! Algo deu errado.</h1>
                        <p className="text-slate-400 mb-6 text-sm">
                            Ocorreu um erro inesperado na aplicação. Isso geralmente é causado por problemas de tradução automática do navegador.
                        </p>

                        {/* Technical Error Details (Optional, collapsed mostly) */}
                        {this.state.error?.message.includes('removeChild') && (
                            <div className="bg-black/30 p-3 rounded-lg text-xs text-left mb-6 text-amber-300 font-mono">
                                Dica: Desative o Google Tradutor para este site.
                            </div>
                        )}

                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <RotateCw className="w-5 h-5" />
                            Recarregar Página
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
