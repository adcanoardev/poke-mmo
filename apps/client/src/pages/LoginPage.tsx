import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
    const { login, register } = useAuth();
    const [mode, setMode] = useState<"login" | "register">("login");
    const [form, setForm] = useState({ username: "", email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleSubmit() {
        setError("");
        setLoading(true);
        try {
            if (mode === "login") await login(form.email, form.password);
            else await register(form.username, form.email, form.password);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-bg flex items-center justify-center relative overflow-hidden">
            {/* Fondo */}
            <div className="absolute inset-0 pointer-events-none">
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(ellipse 80% 60% at 20% 50%, rgba(123,47,255,0.12) 0%, transparent 60%), radial-gradient(ellipse 60% 80% at 80% 30%, rgba(76,201,240,0.08) 0%, transparent 60%)",
                    }}
                />
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage:
                            "linear-gradient(rgba(76,201,240,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(76,201,240,0.03) 1px, transparent 1px)",
                        backgroundSize: "40px 40px",
                    }}
                />
            </div>

            {/* Card */}
            <div className="relative w-[420px] bg-card border border-border rounded-2xl p-12 shadow-2xl">
                {/* Logo */}
                <div className="text-center mb-10">
                    <svg className="w-16 h-16 mx-auto mb-4" viewBox="0 0 60 60" fill="none">
                        {/* Hexágono exterior */}
                        <polygon
                            points="30,3 54,16 54,44 30,57 6,44 6,16"
                            stroke="url(#logoGrad)"
                            strokeWidth="2"
                            fill="none"
                        />
                        {/* Runa interior */}
                        <line
                            x1="30"
                            y1="12"
                            x2="30"
                            y2="48"
                            stroke="url(#logoGrad)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                        <line
                            x1="14"
                            y1="22"
                            x2="46"
                            y2="38"
                            stroke="url(#logoGrad)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                        <line
                            x1="46"
                            y1="22"
                            x2="14"
                            y2="38"
                            stroke="url(#logoGrad)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                        />
                        {/* Núcleo */}
                        <circle cx="30" cy="30" r="5" fill="url(#logoGrad)" opacity="0.9" />
                        <circle cx="30" cy="30" r="2.5" fill="#070b14" />
                        <defs>
                            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#7b2fff" />
                                <stop offset="100%" stopColor="#4cc9f0" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <h1
                        className="font-display font-bold text-4xl tracking-[6px] uppercase"
                        style={{
                            background: "linear-gradient(135deg, #7b2fff, #4cc9f0)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                        }}
                    >
                        MYTHARA
                    </h1>
                    <p className="text-muted text-xs tracking-[8px] uppercase mt-1">Online</p>
                </div>

                {/* Campos */}
                {mode === "register" && (
                    <div className="mb-4">
                        <label className="block text-xs text-muted tracking-widest uppercase mb-2">Binder</label>
                        <input
                            className="w-full bg-white/5 border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-blue transition-colors"
                            placeholder="Tu nombre de Binder"
                            value={form.username}
                            onChange={(e) => setForm({ ...form, username: e.target.value })}
                        />
                    </div>
                )}
                <div className="mb-4">
                    <label className="block text-xs text-muted tracking-widest uppercase mb-2">Email</label>
                    <input
                        className="w-full bg-white/5 border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-blue transition-colors"
                        placeholder="binder@mythara.world"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                </div>
                <div className="mb-6">
                    <label className="block text-xs text-muted tracking-widest uppercase mb-2">Contraseña</label>
                    <input
                        className="w-full bg-white/5 border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-blue transition-colors"
                        placeholder="••••••••"
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    />
                </div>

                {error && <p className="text-red text-sm mb-4 text-center">{error}</p>}

                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full py-4 rounded-xl font-display font-bold text-lg tracking-widest uppercase transition-all disabled:opacity-50"
                    style={{
                        background: "linear-gradient(135deg, #7b2fff, #4cc9f0)",
                        boxShadow: "0 0 24px rgba(123,47,255,0.4)",
                    }}
                >
                    {loading ? "..." : mode === "login" ? "Entrar a Mythara" : "Crear Binder"}
                </button>

                <div className="relative my-5 text-center">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border" />
                    </div>
                    <span className="relative bg-card px-3 text-xs text-muted">o</span>
                </div>

                <button
                    onClick={() => {
                        setMode(mode === "login" ? "register" : "login");
                        setError("");
                    }}
                    className="w-full py-3 rounded-xl border border-border text-muted font-display font-semibold text-sm tracking-widest uppercase hover:border-blue hover:text-blue transition-all"
                >
                    {mode === "login" ? "Crear nueva cuenta" : "Ya tengo cuenta"}
                </button>
            </div>
        </div>
    );
}
