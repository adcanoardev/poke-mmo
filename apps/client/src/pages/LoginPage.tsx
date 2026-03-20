import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    const onResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isRegister = mode === "register";
  // Móvil landscape: ancho moderado Y alto pequeño
  const isMobile = windowSize.w < 640 || (windowSize.h < 520 && windowSize.w < 1024);

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
    <div
      className="fixed inset-0 flex overflow-hidden"
      style={{ background: "#070b14", fontFamily: "'Exo 2', sans-serif" }}
    >
      {/* Mobile register: ocultar panel izquierdo, formulario full screen */}
      <style>{`
        .login-logo-mobile { display: none; }
      `}</style>
      {/* ── LEFT PANEL — world map ── */}
      <div className="login-left relative flex-1 flex flex-col items-center justify-center overflow-hidden"
        style={{ display: isMobile && isRegister ? "none" : undefined }}>
        {/* Map image */}
        <img
          src="https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/maps/mythara_map.avif"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.45, transform: "scale(1.05)" }}
        />

        {/* Vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 80% at 45% 50%, rgba(7,11,20,0.15) 0%, rgba(7,11,20,0.7) 100%)",
          }}
        />

        {/* Right edge fade into panel */}
        <div
          className="absolute inset-y-0 right-0 w-32"
          style={{
            background: "linear-gradient(to right, transparent, rgba(7,11,20,0.95))",
          }}
        />

        {/* Ambient glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(123,47,255,0.18) 0%, transparent 70%)",
            top: "50%",
            left: "45%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {/* Logo — responsive, ocupa bien el espacio disponible */}
        <div className="relative z-10 flex items-center justify-center select-none">
          <img
            src="https://cdn.jsdelivr.net/gh/adcanoardev/mythara-assets@20c2494c976794775042d559db3df66687914944/logo/mythara_logo.webp"
            alt="Mythara"
            style={{
              width: "clamp(120px, 60vw, 520px)",
              height: "clamp(120px, 30vw, 220px)",
              objectFit: "contain",
            }}
          />
        </div>
      </div>

      {/* ── RIGHT PANEL — form ── */}
      <div
        className="login-right relative flex flex-col overflow-y-auto"
        style={{
          width: isMobile && isRegister ? "100%" : "min(420px, 42vw)",
          minWidth: isMobile && isRegister ? 0 : 300,
          background: "rgba(9,14,26,0.95)",
          borderLeft: isMobile && isRegister ? "none" : "1px solid rgba(123,47,255,0.2)",
          boxShadow: "-24px 0 60px rgba(7,11,20,0.8)",
          padding: 0,
        }}
      >
        {/* Top accent bar */}
        <div
          className="absolute top-0 left-0 right-0"
          style={{
            height: 2,
            background: "linear-gradient(to right, #7b2fff, #4cc9f0)",
            zIndex: 1,
          }}
        />

        {/* Inner wrapper */}
        <div
          className="flex flex-col justify-center"
          style={{
            minHeight: "100%",
            padding: isMobile && isRegister
              ? "12px 32px"
              : "clamp(16px, 4vh, 48px) clamp(20px, 5vw, 40px)",
            gap: isMobile && isRegister ? 8 : undefined,
            maxWidth: isMobile && isRegister ? 480 : undefined,
            margin: isMobile && isRegister ? "0 auto" : undefined,
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* Mode toggle pills */}
          <div
            className="flex relative"
            style={{
              background: "rgba(255,255,255,0.04)",
              borderRadius: 10,
              padding: 3,
              border: "1px solid rgba(255,255,255,0.06)",
              marginBottom: isMobile && isRegister ? 8 : "clamp(12px, 2.5vh, 32px)",
            }}
          >
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                style={{
                  flex: 1,
                  padding: "7px 0",
                  borderRadius: 8,
                  fontFamily: "'Rajdhani', sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: mode === m
                    ? "linear-gradient(135deg, #7b2fff, #4cc9f0)"
                    : "transparent",
                  color: mode === m ? "#fff" : "var(--text-muted, #8892a4)",
                  boxShadow: mode === m ? "0 2px 12px rgba(123,47,255,0.35)" : "none",
                }}
              >
                {m === "login" ? "Sign In" : "Register"}
              </button>
            ))}
          </div>

          {/* Greeting — oculto en móvil register para ganar espacio */}
          {!(isMobile && isRegister) && (
          <div style={{ marginBottom: "clamp(10px, 2vh, 24px)" }}>
            <h2
              style={{
                fontFamily: "'Rajdhani', sans-serif",
                fontWeight: 700,
                fontSize: "clamp(17px, 2.2vw, 22px)",
                color: "var(--text-primary, #e2e8f0)",
                letterSpacing: "0.04em",
                marginBottom: 4,
              }}
            >
              {mode === "login" ? "Welcome back, Binder" : "Begin your journey"}
            </h2>
            <p style={{ fontSize: 13, color: "var(--text-muted, #8892a4)" }}>
              {mode === "login"
                ? "Your myths are waiting for you."
                : "Create your account to enter the world."}
            </p>
          </div>
          )}

          {/* Fields */}
          <div
            className="flex flex-col"
            style={{ gap: isMobile && isRegister ? 6 : "clamp(8px, 1.5vh, 16px)" }}
          >
            {mode === "register" && (
              <div>
                <label style={labelStyle}>Username</label>
                <input
                  style={inputStyle}
                  placeholder="Your Binder name"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
            )}
            <div>
              <label style={labelStyle}>Email</label>
              <input
                style={inputStyle}
                type="email"
                placeholder="binder@mythara.world"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input
                style={inputStyle}
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p
              className="text-center"
              style={{ color: "#f87171", fontSize: 13, marginTop: 12 }}
            >
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px 0",
              borderRadius: 10,
              fontFamily: "'Rajdhani', sans-serif",
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              background: "linear-gradient(135deg, #7b2fff, #4cc9f0)",
              color: "#fff",
              boxShadow: "0 0 28px rgba(123,47,255,0.45)",
              opacity: loading ? 0.5 : 1,
              transition: "opacity 0.2s, box-shadow 0.2s",
              marginTop: isMobile && isRegister ? 8 : "clamp(10px, 2vh, 24px)",
            }}
          >
            {loading ? "Entering..." : mode === "login" ? "Enter Mythara" : "Create Binder"}
          </button>

          {/* Footer note */}
          <p
            className="text-center"
            style={{
              fontSize: 12,
              color: "var(--text-muted, #8892a4)",
              marginTop: "clamp(8px, 1.5vh, 24px)",
            }}
          >
            {mode === "login" ? "No account yet? " : "Already a Binder? "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#a78bfa",
                fontSize: 12,
                fontWeight: 600,
                padding: 0,
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              {mode === "login" ? "Register here" : "Sign in"}
            </button>
          </p>
        </div>

        {/* Bottom accent */}
        <div
          className="absolute bottom-0 left-0 right-0"
          style={{
            height: 1,
            background: "linear-gradient(to right, transparent, rgba(76,201,240,0.3), transparent)",
          }}
        />
      </div>
    </div>
  );
}

// ── Shared styles ──────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--text-muted, #8892a4)",
  marginBottom: 6,
  fontFamily: "'Rajdhani', sans-serif",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 14,
  color: "var(--text-primary, #e2e8f0)",
  outline: "none",
  fontFamily: "'Exo 2', sans-serif",
  transition: "border-color 0.2s, box-shadow 0.2s",
};
