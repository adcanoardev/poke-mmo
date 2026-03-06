import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const NAV = [
    { icon: "🏡", label: "Mi Rancho", path: "/" },
    { icon: "⚔️", label: "Combatir", path: "/combate" },
    { icon: "🎒", label: "Inventario", path: "/inventario" },
    { icon: "🏅", label: "Gimnasios", path: "/gimnasios" },
    { icon: "🏆", label: "Ranking", path: "/ranking" },
    { icon: "👤", label: "Perfil", path: "/perfil" },
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
        <div className="min-h-screen bg-bg">
            {/* Top bar */}
            <header className="sticky top-0 z-50 bg-bg/90 backdrop-blur border-b border-border px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
                    <svg className="w-7 h-7" viewBox="0 0 60 60" fill="none">
                        <circle cx="30" cy="30" r="28" stroke="#ffd60a" strokeWidth="2" />
                        <line x1="2" y1="30" x2="58" y2="30" stroke="#ffd60a" strokeWidth="2" />
                        <circle cx="30" cy="30" r="6" fill="#ffd60a" stroke="#070b14" strokeWidth="2" />
                    </svg>
                    <span className="font-display font-bold text-xl tracking-widest text-yellow">POKÉMMO</span>
                </div>
                <div className="flex items-center gap-4">
                    <span className="font-display text-sm text-muted tracking-wider hidden sm:block">
                        {user?.username}
                    </span>
                    <button
                        onClick={logout}
                        className="px-4 py-1.5 border border-border rounded-lg text-muted text-xs font-display tracking-widest uppercase hover:border-red hover:text-red transition-all"
                    >
                        Salir
                    </button>
                </div>
            </header>

            <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-[260px_1fr] gap-6">
                {/* Sidebar */}
                <aside>
                    {sidebar}
                    {/* Navegación */}
                    <nav className="bg-card border border-border rounded-2xl p-3 flex flex-col gap-1">
                        {NAV.map((item) => {
                            const active = location.pathname === item.path;
                            return (
                                <div
                                    key={item.path}
                                    onClick={() => navigate(item.path)}
                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-all
                                        ${
                                            active
                                                ? "bg-red/10 text-red border-l-2 border-red pl-3"
                                                : "text-muted hover:bg-white/5 hover:text-white"
                                        }`}
                                >
                                    {item.icon} {item.label}
                                </div>
                            );
                        })}
                    </nav>
                </aside>

                {/* Contenido */}
                <main>{children}</main>
            </div>
        </div>
    );
}
