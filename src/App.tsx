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
import './App.css';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/how-it-works" element={<HowItWorks />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/validation" element={<ValidationHub />} />
                <Route path="/validation/task/:id" element={<ValidationTask />} />
                <Route path="/ranking" element={<Ranking />} />
                <Route path="/financeiro" element={<Financeiro />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/plans" element={<Plans />} />
            </Routes>
        </Router>
    );
}

export default App;
