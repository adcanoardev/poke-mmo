import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { api } from "./lib/api";

// Guard: if there's an active battle, redirect to /battle.
// Wraps all routes except /battle, /login, /onboarding.
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

import LoginPage           from "./pages/LoginPage";
import OnboardingPage      from "./pages/OnboardingPage";
import HomePage            from "./pages/HomePage";
import BattlePage          from "./pages/BattlePage";
import OutpostPage         from "./pages/OutpostPage";
import TavernPage          from "./pages/TavernPage";
import SanctuariesPage     from "./pages/SanctuariesPage";
import ProfilePage         from "./pages/ProfilePage";
import TeamPage            from "./pages/TeamPage";
import InventoryPage       from "./pages/InventoryPage";
import MythsPage           from "./pages/MythsPage";
import RankingPage         from "./pages/RankingPage";
import RuinsPage           from "./pages/RuinsPage";
import ArenaPage           from "./pages/ArenaPage";
import GuildPage           from "./pages/GuildPage";
import MarketPage          from "./pages/MarketPage";
import NexusPage           from "./pages/NexusPage";
import AccountSettingsPage from "./pages/AccountSettingsPage";
import ChatPanel           from "./components/ChatPanel";
import MailPanel           from "./components/MailPanel";
import LoadingScreen       from "./components/LoadingScreen";
import { useTrainer }      from "./context/TrainerContext";

function ComingSoon({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-bg">
      <div className="font-display text-2xl text-yellow tracking-widest opacity-50">
        {name}
      </div>
    </div>
  );
}

function ChatButtonFloating({ user, onOpenChat, onOpenMail, unreadMail }: {
  user: any;
  onOpenChat: () => void;
  onOpenMail: () => void;
  unreadMail: number;
}) {
  const location = useLocation();
  const pagesWithOwnChat = ["/", "/tavern", "/outpost", "/guild", "/arena", "/ruins", "/market", "/battle", "/login", "/onboarding", "/nexus"];
  const hasOwnChat = pagesWithOwnChat.some(r => location.pathname === r || (r !== "/" && location.pathname.startsWith(r)));
  if (!user || hasOwnChat) return null;
  return (
    <div style={{
      position: "fixed", top: 4, right: 12, zIndex: 500,
      display: "flex", gap: 6,
    }}>
      {/* Mail button */}
      <button
        onClick={onOpenMail}
        style={{
          position: "relative",
          width: 40, height: 38, borderRadius: "30%",
          background: "rgba(7,11,20,0.92)",
          border: "2px solid rgba(103,232,249,0.35)",
          color: "rgba(255,255,255,0.65)", fontSize: 16,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 12px rgba(103,232,249,0.15)",
        }}
        title="Mailbox"
      >
        ✉️
        {unreadMail > 0 && (
          <span style={{
            position: "absolute", top: -5, right: -5,
            minWidth: 16, height: 16, borderRadius: 8,
            background: "#f87171",
            color: "#fff",
            fontSize: 9,
            fontFamily: "monospace",
            fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px",
            border: "1.5px solid #070b14",
          }}>
            {unreadMail > 99 ? "99+" : unreadMail}
          </span>
        )}
      </button>
      {/* Chat button */}
      <button
        onClick={onOpenChat}
        style={{
          width: 40, height: 38, borderRadius: "30%",
          background: "rgba(7,11,20,0.92)",
          border: "2px solid rgba(123,47,255,0.35)",
          color: "rgba(255,255,255,0.65)", fontSize: 16,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 0 12px rgba(123,47,255,0.2)",
        }}
        title="Chat"
      >
        💬
      </button>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const { trainerReady } = useTrainer();
  const [chatOpen, setChatOpen] = useState(false);
  const [mailOpen, setMailOpen] = useState(false);
  const [unreadMail, setUnreadMail] = useState(0);
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMinTimePassed(true), 800);
    return () => clearTimeout(t);
  }, []);

  if (loading || (user && !trainerReady) || !minTimePassed) return <LoadingScreen />;

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
        <Route path="/nexus"   element={guard(<NexusPage />)} />
        <Route path="/market"  element={guard(<MarketPage />)} />
        <Route path="/guild"   element={guard(<GuildPage />)} />
        <Route path="/arcanum" element={guard(<ComingSoon name="ARCANUM" />)} />

        {/* ── Game pages — fullscreen, no Layout ──────────────── */}
        <Route path="/battle"      element={user ? <BattlePage /> : <Navigate to="/login" />} />
        <Route path="/outpost"     element={guard(<OutpostPage />)} />
        <Route path="/inn"         element={<Navigate to="/outpost" />} />
        <Route path="/sanctuaries" element={guard(<SanctuariesPage />)} />
        <Route path="/profile"     element={guard(<ProfilePage />)} />
        <Route path="/account"     element={guard(<AccountSettingsPage />)} />
        <Route path="/team"        element={guard(<TeamPage />)} />
        <Route path="/inventory"   element={guard(<InventoryPage />)} />
        <Route path="/myths"       element={guard(<MythsPage />)} />
        <Route path="/ranking"     element={guard(<RankingPage />)} />

        {/* ── Fallback ──────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <ChatButtonFloating user={user} onOpenChat={() => setChatOpen(true)} onOpenMail={() => setMailOpen(true)} unreadMail={unreadMail} />
      {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
      {mailOpen && <MailPanel onClose={() => setMailOpen(false)} onUnreadChange={setUnreadMail} />}
    </>
  );
}
