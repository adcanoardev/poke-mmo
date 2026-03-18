// apps/client/src/components/PageTopbar.tsx
// Topbar estándar para todas las páginas de Mythara.
// height: 48px · back button grande y claro · título centrado · slot derecho opcional.

import { useNavigate } from "react-router-dom";

interface PageTopbarProps {
  title: React.ReactNode;
  /** Ruta del back button. Default: "/" */
  backTo?: string;
  /** Label del back button. Default: "City" */
  backLabel?: string;
  /** Slot derecho — badge, monedas, botón extra, etc. */
  right?: React.ReactNode;
  /** Callback personalizado para el back. Si se pasa, ignora backTo */
  onBack?: () => void;
}

export default function PageTopbar({
  title,
  backTo = "/",
  backLabel = "City",
  right,
  onBack,
}: PageTopbarProps) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(backTo));

  return (
    <div
      className="relative flex-shrink-0 flex items-center justify-between px-4 md:px-6"
      style={{
        height: 48,
        background: "rgba(4,8,15,0.97)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        zIndex: 10,
      }}
    >
      {/* ── Back button — grande, claro, fácil de pulsar ── */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 rounded-lg px-3 py-1.5 transition-all hover:bg-white/8 active:scale-95"
        style={{
          color: "var(--text-primary)",
          fontSize: "var(--font-sm)",
          fontFamily: "'Rajdhani',sans-serif",
          fontWeight: 700,
          letterSpacing: ".06em",
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.05)",
          minWidth: 64,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>◀</span>
        <span className="tracking-widest uppercase hidden sm:inline">{backLabel}</span>
      </button>

      {/* ── Title ── */}
      <div className="flex items-center gap-2">
        {typeof title === "string" ? (
          <span
            className="tracking-[0.22em] uppercase font-black"
            style={{
              fontFamily: "'Rajdhani',sans-serif",
              fontSize: "var(--font-lg)",
              color: "var(--text-primary)",
            }}
          >
            {title}
          </span>
        ) : (
          title
        )}
      </div>

      {/* ── Right slot — misma anchura que el back para centrar el título ── */}
      <div style={{ minWidth: 64, display: "flex", justifyContent: "flex-end" }}>
        {right ?? null}
      </div>
    </div>
  );
}
