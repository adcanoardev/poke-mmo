// apps/client/src/components/PageShell.tsx
// Wrapper estándar para todas las páginas de Mythara.
// Provee: fondo #070b14, ambient BG (radial + grid), font Exo 2.

interface PageShellProps {
  children: React.ReactNode;
  /** Color del radial gradient. Default: rgba(123,47,255,0.06) — purple */
  ambientColor?: string;
  className?: string;
}

export default function PageShell({
  children,
  ambientColor = "rgba(123,47,255,0.06)",
  className = "",
}: PageShellProps) {
  return (
    <div
      className={`fixed inset-0 flex flex-col ${className}`}
      style={{ background: "#070b14", fontFamily: "'Exo 2',sans-serif" }}
    >
      {/* Ambient BG */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(ellipse 70% 50% at 50% -10%,${ambientColor} 0%,transparent 60%)`,
        }} />
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px)," +
            "linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)",
          backgroundSize: "40px 40px",
        }} />
      </div>
      {children}
    </div>
  );
}
