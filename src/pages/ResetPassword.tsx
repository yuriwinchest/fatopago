import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePasswordReset } from '../hooks/usePasswordReset';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { AuthLayout } from '../layouts/AuthLayout';
import { NewsCarousel } from '../components/NewsCarousel';
import { MOCK_NEWS } from '../data/mockNews';

const ResetPassword = () => {
    const {
        password,
        setPassword,
        confirmPassword,
        setConfirmPassword,
        loading,
        checkingRecovery,
        hasRecoverySession,
        error,
        handleReset
    } = usePasswordReset();

    const LeftContent = (
        <div className="flex-1 flex flex-col px-8 lg:px-16 pt-8 pb-8">
            <h1 className="text-4xl lg:text-5xl font-extrabold mb-4 leading-tight">
                Redefinir Senha
            </h1>
            <p className="text-purple-100 text-lg mb-8 leading-relaxed max-w-md">
                Crie uma nova senha segura para proteger sua conta e seus ganhos.
            </p>

            <div className="w-full max-w-sm mx-auto lg:mx-0 mt-auto">
                <div className="mb-6 scale-90 origin-bottom-left lg:scale-100">
                    <NewsCarousel
                        tasks={MOCK_NEWS}
                        onValidate={() => { }}
                        isReadOnly={true}
                        autoPlay={false}
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
            <h2 className="text-3xl font-bold text-white mb-2">Nova Senha</h2>
            <p className="text-slate-400 mb-8">
                {checkingRecovery
                    ? 'Validando seu link de recuperação...'
                    : hasRecoverySession
                        ? 'Digite sua nova senha abaixo.'
                        : 'Solicite um novo e-mail para redefinir sua senha.'}
            </p>

            {checkingRecovery ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
                    Aguarde alguns instantes enquanto validamos o link enviado para seu e-mail.
                </div>
            ) : hasRecoverySession ? (
                <form onSubmit={handleReset} className="space-y-5">
                    <Input
                        label="Nova Senha"
                        type="password"
                        placeholder="Nova senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <Input
                        label="Confirmar Nova Senha"
                        type="password"
                        placeholder="Confirme a nova senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />

                    {error && (
                        <div className="p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}

                    <Button
                        type="submit"
                        fullWidth
                        isLoading={loading}
                        rightIcon={!loading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                    >
                        {loading ? "Salvando..." : "Salvar nova senha"}
                    </Button>
                </form>
            ) : (
                <div className="space-y-5">
                    {error && (
                        <div className="p-3 rounded-lg bg-red-400/10 border border-red-400/20 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                            {error}
                        </div>
                    )}

                    <Link
                        to="/forgot-password"
                        className="inline-flex w-full items-center justify-center rounded-xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    >
                        Solicitar novo link
                    </Link>
                </div>
            )}
        </AuthLayout>
    );
};

export default ResetPassword;
