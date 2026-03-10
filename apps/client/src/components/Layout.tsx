import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

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

interface Props {
    children: React.ReactNode;
    sidebar?: React.ReactNode;
}

export default function Layout({ children, sidebar }: Props) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <div className="h-screen w-screen overflow-hidden flex flex-col bg-bg">
            {/* Top bar — altura fija */}
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
                        onClick={logout}
                        className="px-3 py-1 border border-border rounded-lg text-muted text-xs font-display tracking-widest uppercase hover:border-red hover:text-red transition-all"
                    >
                        Salir
                    </button>
                </div>
            </header>

            {/* Body — ocupa todo lo restante */}
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar — ancho fijo, scroll interno si hace falta */}
                <aside className="w-56 flex-shrink-0 border-r border-border flex flex-col overflow-hidden">
                    {/* Info del entrenador */}
                    {sidebar && <div className="flex-shrink-0 p-3 border-b border-border">{sidebar}</div>}
                    {/* Navegación */}
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

                {/* Contenido principal — ocupa el resto, sin overflow */}
                <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
            </div>
        </div>
    );
}
