import { useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { useTrainer } from "../context/TrainerContext";

const NAV = [
    { icon: "🏡", label: "Posada", path: "/" },
    { icon: "👤", label: "Perfil", path: "/profile" },
    { icon: "🐾", label: "Equipo", path: "/team" },
    { icon: "⚔️", label: "Combatir", path: "/battle" },
    { icon: "◈", label: "Fragmentos", path: "/fragment" },
    { icon: "📖", label: "Arcanum", path: "/myths" },
    { icon: "🎒", label: "Inventario", path: "/inventory" },
    { icon: "🏅", label: "Santuarios", path: "/sanctums" },
    { icon: "🏆", label: "Ranking", path: "/ranking" },
];

// ─────────────────────────────────────────
// Toast system
// ─────────────────────────────────────────

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
    return useContext(ToastContext);
}

const TOAST_COLORS: Record<ToastType, string> = {
    success: "border-emerald-500/60 bg-emerald-500/10 text-emerald-300",
    error: "border-red-500/60    bg-red-500/10    text-red-300",
    info: "border-blue-500/60   bg-blue-500/10   text-blue-300",
    warning: "border-yellow-500/60 bg-yellow-500/10 text-yellow-300",
};

const TOAST_ICONS: Record<ToastType, string> = {
    success: "✅",
    error: "❌",
    info: "ℹ️",
    warning: "⚠️",
};

let _toastCounter = 0;

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-lg shadow-black/40
                        font-mono text-xs max-w-xs pointer-events-auto
                        animate-toast-in
                        ${TOAST_COLORS[t.type]}`}
                >
                    <span className="flex-shrink-0 text-sm">{TOAST_ICONS[t.type]}</span>
                    <p className="leading-relaxed flex-1">{t.message}</p>
                    <button
                        onClick={() => onRemove(t.id)}
                        className="flex-shrink-0 opacity-50 hover:opacity-100 transition-opacity ml-1 text-xs"
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}

// ─────────────────────────────────────────
// Affinity table data
// ─────────────────────────────────────────

type Affinity = "EMBER" | "TIDE" | "GROVE" | "VOLT" | "STONE" | "FROST" | "VENOM" | "ASTRAL" | "IRON" | "SHADE";

const AFFINITIES: Affinity[] = ["EMBER", "TIDE", "GROVE", "VOLT", "STONE", "FROST", "VENOM", "ASTRAL", "IRON", "SHADE"];

const AFFINITY_EMOJI: Record<Affinity, string> = {
    EMBER: "🔥",
    TIDE: "🌊",
    GROVE: "🌿",
    VOLT: "⚡",
    STONE: "🪨",
    FROST: "❄️",
    VENOM: "🧪",
    ASTRAL: "✨",
    IRON: "⚙️",
    SHADE: "🌑",
};

const AFFINITY_LABEL: Record<Affinity, string> = {
    EMBER: "Brasa",
    TIDE: "Marea",
    GROVE: "Bosque",
    VOLT: "Voltio",
    STONE: "Piedra",
    FROST: "Escarcha",
    VENOM: "Veneno",
    ASTRAL: "Astral",
    IRON: "Hierro",
    SHADE: "Sombra",
};

const AFFINITY_CHART: Record<Affinity, Partial<Record<Affinity, number>>> = {
    EMBER: { GROVE: 2, FROST: 2, TIDE: 0.5, STONE: 0.5, EMBER: 0.5 },
    TIDE: { EMBER: 2, STONE: 2, VOLT: 0.5, GROVE: 0.5, TIDE: 0.5 },
    GROVE: { TIDE: 2, STONE: 2, EMBER: 0.5, VENOM: 0.5, GROVE: 0.5 },
    VOLT: { TIDE: 2, IRON: 2, GROVE: 0.5, STONE: 0.5, VOLT: 0.5 },
    STONE: { EMBER: 2, VOLT: 2, GROVE: 0.5, TIDE: 0.5, STONE: 0.5 },
    FROST: { GROVE: 2, ASTRAL: 2, EMBER: 0.5, IRON: 0.5, FROST: 0.5 },
    VENOM: { GROVE: 2, ASTRAL: 2, STONE: 0.5, IRON: 0.5, VENOM: 0.5 },
    ASTRAL: { SHADE: 2, VENOM: 0.5, ASTRAL: 0.5 },
    IRON: { FROST: 2, STONE: 2, EMBER: 0.5, IRON: 0.5 },
    SHADE: { ASTRAL: 2, VENOM: 2, SHADE: 0.5 },
};

function getCell(atk: Affinity, def: Affinity): number {
    return AFFINITY_CHART[atk]?.[def] ?? 1;
}


// ─────────────────────────────────────────
// Layout
// ─────────────────────────────────────────

interface Props {
    children: React.ReactNode;
    sidebar?: React.ReactNode;
}

export default function Layout({ children, sidebar }: Props) {
    const { user, logout } = useAuth();
    const { reset: resetTrainer } = useTrainer();
    const navigate = useNavigate();
    const location = useLocation();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [logoutLoading, setLogoutLoading] = useState(false);

    const handleLogoutClick = () => {
        if (localStorage.getItem("mythara_battle_active") === "1") {
            setShowLogoutConfirm(true);
        } else {
            resetTrainer();
            logout();
        }
    };

    const handleLogoutConfirm = async () => {
        setLogoutLoading(true);
        try {
            const session = await api.battleNpcActive();
            if (session?.battleId || session?.id) {
                const battleId = session.battleId ?? session.id;
                await api.battleNpcForfeit(battleId);
            }
        } catch (_) {
            // Si falla, seguimos con el logout igualmente
        } finally {
            localStorage.removeItem("mythara_battle_active");
            setLogoutLoading(false);
            setShowLogoutConfirm(false);
            resetTrainer();
            logout();
        }
    };

    // Toast state
    const [toasts, setToasts] = useState<Toast[]>([]);
    const timersRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

    const addToast = useCallback((message: string, type: ToastType = "info") => {
        const id = ++_toastCounter;
        setToasts((prev) => [...prev, { id, message, type }]);
        timersRef.current[id] = setTimeout(() => removeToast(id), 3500);
    }, []);

    const removeToast = useCallback((id: number) => {
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    // Limpiar timers al desmontar
    useEffect(() => {
        return () => {
            Object.values(timersRef.current).forEach(clearTimeout);
        };
    }, []);

    // Escape cierra cualquier modal abierto
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (showLogoutConfirm && !logoutLoading) setShowLogoutConfirm(false);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [showLogoutConfirm, logoutLoading]);

    return (
        <ToastContext.Provider value={{ toast: addToast }}>
            <div className="w-screen overflow-hidden flex flex-col bg-bg" style={{ height: "100dvh" }}>
                <style>{`
            @keyframes toastIn {
                from { opacity: 0; transform: translateX(100%) scale(0.95); }
                to   { opacity: 1; transform: translateX(0)   scale(1); }
            }
            .animate-toast-in { animation: toastIn 0.25s cubic-bezier(0.34,1.56,0.64,1) both; }
        `}</style>
                {/* Top bar */}
                <header className="flex-shrink-0 bg-bg/90 backdrop-blur border-b border-border px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
                        <svg className="w-6 h-6" viewBox="0 0 60 60" fill="none">
                            <defs>
                                <linearGradient id="navLogoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#7b2fff" />
                                    <stop offset="100%" stopColor="#4cc9f0" />
                                </linearGradient>
                            </defs>
                            <polygon
                                points="30,3 54,16 54,44 30,57 6,44 6,16"
                                stroke="url(#navLogoGrad)"
                                strokeWidth="2"
                                fill="none"
                            />
                            <line
                                x1="30"
                                y1="12"
                                x2="30"
                                y2="48"
                                stroke="url(#navLogoGrad)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                            <line
                                x1="14"
                                y1="22"
                                x2="46"
                                y2="38"
                                stroke="url(#navLogoGrad)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                            <line
                                x1="46"
                                y1="22"
                                x2="14"
                                y2="38"
                                stroke="url(#navLogoGrad)"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                            <circle cx="30" cy="30" r="5" fill="url(#navLogoGrad)" opacity="0.9" />
                            <circle cx="30" cy="30" r="2.5" fill="#070b14" />
                        </svg>
                        <span className="font-display font-bold text-lg tracking-widest text-yellow">MYTHARA</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="font-display text-sm text-muted tracking-wider hidden sm:block">
                            {user?.username}
                        </span>
                        <button
                            onClick={handleLogoutClick}
                            className="px-3 py-1 border border-border rounded-lg text-muted text-xs font-display tracking-widest uppercase hover:border-red hover:text-red transition-all"
                        >
                            Salir
                        </button>
                    </div>
                </header>

                {/* Body */}
                <div className="flex-1 flex overflow-hidden">
                    <aside className="w-56 flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
                        {sidebar && <div className="flex-shrink-0 overflow-y-auto">{sidebar}</div>}
                        <nav className="flex-1 p-2 flex flex-col gap-0.5">
                            {NAV.map((item) => {
                                const active = location.pathname === item.path;
                                return (
                                    <div
                                        key={item.path}
                                        onClick={() => navigate(item.path)}
                                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all
                                        ${
                                            active
                                                ? "bg-red/10 text-red border-l-2 border-red"
                                                : "text-muted hover:bg-white/5 hover:text-white"
                                        }`}
                                    >
                                        <span>{item.icon}</span>
                                        <span className="font-display tracking-wide">{item.label}</span>
                                    </div>
                                );
                            })}
                        </nav>
                    </aside>

                    {/* Main content */}
                    <main className="flex-1 overflow-hidden flex flex-col relative">
                        {children}

                    </main>
                </div>

                {/* Logout confirmation modal */}
                {showLogoutConfirm && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                        onClick={() => { if (!logoutLoading) setShowLogoutConfirm(false); }}>
                        <div className="bg-card border border-border rounded-xl p-6 w-80 flex flex-col gap-4 shadow-2xl"
                            onClick={e => e.stopPropagation()}>
                            <h2 className="font-display text-base tracking-widest text-yellow uppercase text-center">
                                ⚠️ Combate activo
                            </h2>
                            <p className="text-sm text-muted text-center leading-relaxed">
                                Si cierras sesión ahora, el combate actual se registrará como <span className="text-red font-semibold">derrota</span>. ¿Seguro que quieres salir?
                            </p>
                            <div className="flex gap-3 mt-1">
                                <button
                                    onClick={() => setShowLogoutConfirm(false)}
                                    disabled={logoutLoading}
                                    className="flex-1 py-2 rounded-lg border border-border text-muted text-xs font-display tracking-widest uppercase hover:bg-white/5 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleLogoutConfirm}
                                    disabled={logoutLoading}
                                    className="flex-1 py-2 rounded-lg border border-red bg-red/10 text-red text-xs font-display tracking-widest uppercase hover:bg-red/20 transition-all disabled:opacity-50"
                                >
                                    {logoutLoading ? "Saliendo..." : "Salir y perder"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Toasts — fuera del div principal para no ser afectados por overflow:hidden */}
            <ToastContainer toasts={toasts} onRemove={removeToast} />
        </ToastContext.Provider>
    );
}
