import { Suspense, lazy, ComponentType, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import PageLoader from './components/ui/PageLoader';
import { attemptChunkRecovery, isChunkLoadError } from './lib/chunkRecovery';
import { initializeMetaPixel, trackMetaPixelPageView } from './lib/metaPixel';
import './App.css';

// Wrapper que recarrega a página com cache-busting se o chunk falhar após deploy novo.
function lazyWithReload<T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>
) {
    return lazy(() =>
        factory().catch((err) => {
            if (isChunkLoadError(err)) {
                attemptChunkRecovery();
            }
            throw err;
        })
    );
}

const Register = lazyWithReload(() => import('./pages/Register'));
const Dashboard = lazyWithReload(() => import('./pages/Dashboard'));
const Financeiro = lazyWithReload(() => import('./pages/Financeiro'));
const HowItWorks = lazyWithReload(() => import('./pages/HowItWorks'));
const Login = lazyWithReload(() => import('./pages/Login'));
const ForgotPassword = lazyWithReload(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyWithReload(() => import('./pages/ResetPassword'));
const ValidationHub = lazyWithReload(() => import('./pages/ValidationHub'));
const ValidationTask = lazyWithReload(() => import('./pages/ValidationTask'));
const Ranking = lazyWithReload(() => import('./pages/Ranking'));
const Profile = lazyWithReload(() => import('./pages/Profile'));
const Plans = lazyWithReload(() => import('./pages/Plans'));
const LandingPage = lazyWithReload(() => import('./pages/LandingPage'));
const FakeNews = lazyWithReload(() => import('./pages/FakeNews'));
const EarningsPolicy = lazyWithReload(() => import('./pages/EarningsPolicy'));
const TermsPage = lazyWithReload(() => import('./pages/TermsPage'));
const PrivacyPage = lazyWithReload(() => import('./pages/PrivacyPage'));
const ContactPage = lazyWithReload(() => import('./pages/ContactPage'));
const Convite = lazyWithReload(() => import('./pages/Convite'));
const BackofficeDashboard = lazyWithReload(() => import('./pages/BackofficeDashboard'));
const LocalSentrySmokeTest = lazyWithReload(() => import('./components/LocalSentrySmokeTest'));

const RouteLoader = () => <PageLoader label="Carregando tela..." fullScreen />;

function MetaPixelTracker() {
    const location = useLocation();

    useEffect(() => {
        initializeMetaPixel();
    }, []);

    useEffect(() => {
        trackMetaPixelPageView(location.pathname, location.search);
    }, [location.pathname, location.search]);

    return null;
}

function App() {
    return (
        <Router>
            <MetaPixelTracker />
            <Suspense fallback={null}>
                <LocalSentrySmokeTest />
            </Suspense>
            <Suspense fallback={<RouteLoader />}>
                <Routes>
                    {/* Rotas Públicas */}
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/how-it-works" element={<HowItWorks />} />
                    <Route path="/noticias-falsas" element={<FakeNews />} />
                    <Route path="/politica-ganhos" element={<EarningsPolicy />} />
                    <Route path="/termos" element={<TermsPage />} />
                    <Route path="/privacidade" element={<PrivacyPage />} />
                    <Route path="/contato" element={<ContactPage />} />
                    <Route path="/convite/:code" element={<Convite />} />

                    {/* Rotas Protegidas - Requerem Autenticação */}
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/validation" element={<ProtectedRoute><ValidationHub /></ProtectedRoute>} />
                    <Route path="/validation/task/:id" element={<ProtectedRoute><ValidationTask /></ProtectedRoute>} />
                    <Route path="/ranking" element={<ProtectedRoute><Ranking /></ProtectedRoute>} />
                    <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                    <Route path="/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />

                    {/* Admin Route */}
                    <Route path="/admin-dashboard" element={<ProtectedRoute><BackofficeDashboard /></ProtectedRoute>} />
                    <Route path="/seller-dashboard" element={<ProtectedRoute><BackofficeDashboard /></ProtectedRoute>} />
                </Routes>
            </Suspense>
        </Router>
    );
}

export default App;
