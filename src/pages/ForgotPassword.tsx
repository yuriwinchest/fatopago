import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Mail, AlertCircle } from 'lucide-react';
import { useAuthRecovery } from '../hooks/useAuthRecovery';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { AuthLayout } from '../layouts/AuthLayout';
import { NewsCarousel } from '../components/NewsCarousel';
import { MOCK_NEWS } from '../data/mockNews';

const ForgotPassword = () => {
    const {
        email,
        setEmail,
        loading,
        success,
        error,
        handleForgotPassword
    } = useAuthRecovery();

    const LeftContent = (
        <div className="flex-1 flex flex-col px-8 lg:px-16 pt-8 pb-8">
            <h1 className="text-4xl lg:text-5xl font-extrabold mb-4 leading-tight">
                Recupere seu acesso
            </h1>
            <p className="text-purple-100 text-lg mb-8 leading-relaxed max-w-md">
                Não se preocupe, vamos ajudar você a voltar a validar notícias e lucrar.
            </p>

            <div className="w-full max-w-sm mx-auto lg:mx-0 mt-auto">
                <div className="mb-6 scale-90 origin-bottom-left lg:scale-100">
                    <NewsCarousel
                        tasks={MOCK_NEWS}
                        onValidate={() => { }}
                        isReadOnly={true}
                        autoPlay={true}
                        interval={3000}
                    />
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex -space-x-3">
                        {[1, 5, 8].map(img => (
                            <img key={img} src={`https://i.pravatar.cc/100?img=${img}`} alt="User" className="w-10 h-10 rounded-full border-2 border-[#8a2ce2]" />
                        ))}
                    </div>
                    <div>
                        <span className="block text-sm font-bold text-white">+12k usuários</span>
                        <span className="text-xs text-purple-200">validando agora</span>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <AuthLayout leftPanelContent={LeftContent}>
            <Link to="/" className="absolute top-0 lg:top-8 left-0 lg:left-8 mb-6 relative text-slate-400 hover:text-white flex items-center gap-2 transition-colors w-fit">
                <ArrowLeft className="w-4 h-4" /> Voltar para login
            </Link>

            <h2 className="text-3xl font-bold text-white mb-2">Esqueceu a senha?</h2>
            <p className="text-slate-400 mb-8">Digite seu e-mail e enviaremos um link para redefinir sua senha.</p>

            {success ? (
                <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-xl text-center animate-in fade-in zoom-in-95">
                    <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Mail className="w-6 h-6 text-green-400" />
                    </div>
                    <h3 className="text-lg font-bold text-green-400 mb-2">E-mail enviado!</h3>
                    <p className="text-slate-300 mb-6 text-sm">Verifique sua caixa de entrada (e spam) para encontrar o link de redefinição.</p>
                    <Link to="/" className="text-white bg-green-600 hover:bg-green-700 font-medium py-2 px-4 rounded-lg transition-colors inline-block">
                        Voltar para Login
                    </Link>
                </div>
            ) : (
                <form onSubmit={handleForgotPassword} className="space-y-5">
                    <Input
                        label="E-mail cadastrado"
                        type="email"
                        placeholder="nome@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    {error && (
                        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 p-3 rounded-lg border border-red-400/20 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <Button
                        type="submit"
                        fullWidth
                        isLoading={loading}
                        rightIcon={!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                    >
                        {loading ? "Enviando..." : "Enviar Link"}
                    </Button>
                </form>
            )}
        </AuthLayout>
    );
};

export default ForgotPassword;
