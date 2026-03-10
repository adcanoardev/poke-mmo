import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import CombatPage from "./pages/CombatPage";
import InventarioPage from "./pages/InventarioPage";
import RankingPage from "./pages/RankingPage";
import PerfilPage from "./pages/PerfilPage";
import OnboardingPage from "./pages/OnboardingPage";
import PosadaPage from "./pages/PosadaPage";
import SantuariosPage from "./pages/SantuariosPage";
import EquipoPage from "./pages/EquipoPage";
import FragmentPage from "./pages/FragmentPage";
import MythsPage from "./pages/MythsPage";

export default function App() {
    const { user, loading } = useAuth();
    console.log("App render — user:", user, "loading:", loading);
    if (loading)
        return (
            <div className="flex items-center justify-center min-h-screen bg-bg">
                <div className="font-display text-2xl text-yellow tracking-widest animate-pulse">CARGANDO...</div>
            </div>
        );

    return (
        <Routes>
            <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
            <Route
                path="/"
                element={
                    user ? (
                        user.onboardingComplete ? (
                            <PosadaPage />
                        ) : (
                            <Navigate to="/onboarding" />
                        )
                    ) : (
                        <Navigate to="/login" />
                    )
                }
            />
            <Route path="/ranking" element={user ? <RankingPage /> : <Navigate to="/login" />} />
            <Route path="/onboarding" element={user ? <OnboardingPage /> : <Navigate to="/login" />} />
            <Route path="/myths" element={user ? <MythsPage /> : <Navigate to="/login" />} />
            <Route path="/profile" element={user ? <PerfilPage /> : <Navigate to="/login" />} />
            <Route path="/team" element={user ? <EquipoPage /> : <Navigate to="/login" />} />
            <Route path="/battle" element={user ? <CombatPage /> : <Navigate to="/login" />} />
            <Route path="/fragment" element={<FragmentPage />} />
            <Route path="/inventory" element={user ? <InventarioPage /> : <Navigate to="/login" />} />
            <Route path="/sanctums" element={user ? <SantuariosPage /> : <Navigate to="/login" />} />
        </Routes>
    );
}
