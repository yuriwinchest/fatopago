import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Financeiro from './pages/Financeiro';
import HowItWorks from './pages/HowItWorks';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ValidationHub from './pages/ValidationHub';
import ValidationTask from './pages/ValidationTask';
import Ranking from './pages/Ranking';
import Profile from './pages/Profile';
import Plans from './pages/Plans';
import LandingPage from './pages/LandingPage';
import FakeNews from './pages/FakeNews';
import { ProtectedRoute } from './components/ProtectedRoute';
import './App.css';

function App() {
    return (
        <Router>
            <Routes>
                {/* Rotas Públicas */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/noticias-falsas" element={<FakeNews />} />

                {/* Rotas Protegidas - Requerem Autenticação */}
                <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                <Route path="/validation" element={<ProtectedRoute><ValidationHub /></ProtectedRoute>} />
                <Route path="/validation/task/:id" element={<ProtectedRoute><ValidationTask /></ProtectedRoute>} />
                <Route path="/ranking" element={<ProtectedRoute><Ranking /></ProtectedRoute>} />
                <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
            </Routes>
        </Router>
    );
}

export default App;
