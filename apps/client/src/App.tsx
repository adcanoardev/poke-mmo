import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { api } from "./lib/api";

// Guard: if there's an active battle, redirect to /battle.
// Wraps all routes except /battle, /login, /onboarding, /fragment.
function BattleGuard({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (localStorage.getItem("mythara_battle_active") === "1") {
      navigate("/battle", { replace: true });
      return;
    }
    let cancelled = false;
    api.battleNpcActive()
      .then((session: any) => {
        if (cancelled) return;
        if (session?.status === "ongoing") {
          localStorage.setItem("mythara_battle_active", "1");
          navigate("/battle", { replace: true });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [location.pathname, navigate]);
  return <>{children}</>;
}

import LoginPage        from "./pages/LoginPage";
import OnboardingPage   from "./pages/OnboardingPage";
import HomePage         from "./pages/HomePage";
import BattlePage       from "./pages/BattlePage";
import OutpostPage      from "./pages/OutpostPage";
import TavernPage       from "./pages/TavernPage";
import SanctuariesPage  from "./pages/SanctuariesPage";
import ProfilePage      from "./pages/ProfilePage";
import TeamPage         from "./pages/TeamPage";
import InventoryPage    from "./pages/InventoryPage";
import MythsPage        from "./pages/MythsPage";
import RankingPage      from "./pages/RankingPage";
import RuinsPage        from "./pages/RuinsPage";
import ArenaPage        from "./pages/ArenaPage";
import GuildPage        from "./pages/GuildPage";
import MarketPage       from "./pages/MarketPage";
import ChatPanel        from "./components/ChatPanel";

// Placeholder for pages not yet implemented
function ComingSoon({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-bg">
      <div className="font-display text-2xl text-yellow tracking-widest opacity-50">
        {name}
      </div>
    </div>
  );
}

// Todas las páginas son fullscreen landscape con topbar propio — no hay Layout wrapper
function ChatButtonFloating({ user, onOpen }: { user: any; onOpen: () => void }) {
  const location = useLocation();
  // No mostrar en páginas que ya tienen el botón integrado en su topbar
  const pagesWithOwnChat = ["/tavern", "/outpost", "/guild", "/arena", "/ruins", "/market", "/battle"];
  const hasOwnChat = pagesWithOwnChat.some(r => location.pathname.startsWith(r));
  if (!user || hasOwnChat) return null;
  return (
    <button
      onClick={onOpen}
      style={{
        position: "fixed", top: 12, right: 12, zIndex: 500,
        width: 38, height: 38, borderRadius: "50%",
        background: "rgba(7,11,20,0.92)",
        border: "1px solid rgba(123,47,255,0.35)",
        color: "rgba(255,255,255,0.65)", fontSize: 16,
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 12px rgba(123,47,255,0.2)",
      }}
      title="Chat"
    >
      💬
    </button>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <div className="font-display text-2xl text-yellow tracking-widest animate-pulse">
          LOADING...
        </div>
      </div>
    );

  // Helper: require auth + wrap with BattleGuard
  const guard = (el: React.ReactNode) =>
    user ? <BattleGuard>{el}</BattleGuard> : <Navigate to="/login" />;

  return (
    <>
      <Routes>
        {/* ── Auth ─────────────────────────────────────────────── */}
      <Route path="/login"      element={!user ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/onboarding" element={user ? <OnboardingPage /> : <Navigate to="/login" />} />

      {/* ── Home — fullscreen, no Layout ─────────────────────── */}
      <Route
        path="/"
        element={
          user
            ? user.onboardingComplete
              ? <BattleGuard><HomePage /></BattleGuard>
              : <Navigate to="/onboarding" />
            : <Navigate to="/login" />
        }
      />

      {/* ── City districts — fullscreen, no Layout ───────────── */}
      <Route path="/arena"   element={guard(<ArenaPage />)} />
      <Route path="/ruins"   element={guard(<RuinsPage />)} />
      <Route path="/tavern"  element={guard(<TavernPage />)} />
      <Route path="/nexus"   element={guard(<ComingSoon name="NEXUS" />)} />
      <Route path="/market"  element={guard(<MarketPage />)} />
      <Route path="/guild"   element={guard(<GuildPage />)} />
      <Route path="/arcanum" element={guard(<ComingSoon name="ARCANUM" />)} />

      {/* ── Game pages — fullscreen, no Layout ──────────────── */}
      <Route path="/battle"      element={user ? <BattlePage /> : <Navigate to="/login" />} />
      <Route path="/outpost"     element={guard(<OutpostPage />)} />
      <Route path="/inn"         element={<Navigate to="/outpost" />} />
      <Route path="/sanctuaries" element={guard(<SanctuariesPage />)} />
      <Route path="/profile"     element={guard(<ProfilePage />)} />
      <Route path="/team"        element={guard(<TeamPage />)} />
      <Route path="/inventory"   element={guard(<InventoryPage />)} />
      <Route path="/myths"       element={guard(<MythsPage />)} />
      <Route path="/ranking"     element={guard(<RankingPage />)} />

      {/* ── Fallback ──────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>

    {/* ── Global chat button — solo en páginas fullscreen (sin Layout) ── */}
    <ChatButtonFloating user={user} onOpen={() => setChatOpen(true)} />

    {/* ── Chat panel ── */}
    {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
    </>
  );
}
