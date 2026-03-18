// apps/client/src/pages/RuinsPage.tsx
import { useTrainer } from "../context/TrainerContext";
import PageTopbar from "../components/PageTopbar";

// ─── Zone config ──────────────────────────────────────────────────────────────
interface Zone {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  tag: string;
  status: "active" | "locked";
  accent: string;
  accentRgb: string;
  route?: string;
}

const ZONES: Zone[] = [
  {
    id: "sanctuaries",
    name: "Sanctuaries",
    subtitle: "8 Elemental Challenges",
    description:
      "Three 1v1 rounds per run. Bring 5 Myths, max 2 swaps. No healing between rounds.",
    tag: "PvE · Solo",
    status: "active",
    accent: "#a78bfa",
    accentRgb: "167,139,250",
    route: "/sanctuaries",
  },
  {
    id: "death-tower",
    name: "Death Tower",
    subtitle: "Survival Gauntlet",
    description:
      "Climb an endless tower of increasingly brutal encounters. How far can you go?",
    tag: "PvE · Endless",
    status: "locked",
    accent: "#f87171",
    accentRgb: "248,113,113",
  },
  {
    id: "clan-boss",
    name: "Clan Boss",
    subtitle: "Weekly Co-op Raid",
    description:
      "A colossal Myth awakens once a week. Team up with other Binders to bring it down.",
    tag: "Co-op · Weekly",
    status: "locked",
    accent: "#fb923c",
    accentRgb: "251,146,60",
  },
];

// ─── SVG art per zone ─────────────────────────────────────────────────────────
function SanctuariesArt() {
  return (
    <svg viewBox="0 0 220 140" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Sky glow */}
      <radialGradient id="sg1" cx="50%" cy="30%" r="60%">
        <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#070b14" stopOpacity="0" />
      </radialGradient>
      <rect width="220" height="140" fill="url(#sg1)" />
      {/* Pillars */}
      {[30, 60, 90, 130, 160, 190].map((x, i) => (
        <rect key={i} x={x - 4} y={i % 2 === 0 ? 20 : 35} width={8} height={i % 2 === 0 ? 100 : 85}
          fill={`rgba(167,139,250,${i % 2 === 0 ? 0.18 : 0.1})`} rx="2" />
      ))}
      {/* Arch top */}
      <path d="M40 45 Q110 10 180 45" stroke="rgba(167,139,250,0.3)" strokeWidth="1.5" fill="none" />
      {/* Ground line */}
      <line x1="0" y1="120" x2="220" y2="120" stroke="rgba(167,139,250,0.15)" strokeWidth="1" />
      {/* Ground glow */}
      <ellipse cx="110" cy="121" rx="90" ry="8" fill="rgba(167,139,250,0.07)" />
      {/* Magic circle */}
      <circle cx="110" cy="95" r="22" stroke="rgba(167,139,250,0.25)" strokeWidth="1" fill="none" strokeDasharray="4 3" />
      <circle cx="110" cy="95" r="14" stroke="rgba(167,139,250,0.15)" strokeWidth="0.8" fill="none" />
      {/* Center gem */}
      <polygon points="110,82 118,95 110,108 102,95" fill="rgba(167,139,250,0.2)" stroke="rgba(167,139,250,0.5)" strokeWidth="0.8" />
      {/* Stars */}
      {[[20,15],[200,25],[50,60],[185,70],[15,90]].map(([sx,sy],i) => (
        <circle key={i} cx={sx} cy={sy} r="1" fill="rgba(255,255,255,0.5)" />
      ))}
    </svg>
  );
}

function DeathTowerArt() {
  return (
    <svg viewBox="0 0 220 140" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <radialGradient id="dt1" cx="50%" cy="50%" r="55%">
        <stop offset="0%" stopColor="#f87171" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#070b14" stopOpacity="0" />
      </radialGradient>
      <rect width="220" height="140" fill="url(#dt1)" />
      {/* Tower silhouette */}
      <rect x="88" y="10" width="44" height="110" fill="rgba(30,10,10,0.8)" rx="2" />
      <rect x="80" y="20" width="60" height="8" fill="rgba(248,113,113,0.12)" rx="1" />
      {/* Window slits */}
      {[30,50,70,90].map((y, i) => (
        <rect key={i} x="106" y={y} width="8" height="12" fill="rgba(248,113,113,0.3)" rx="1" />
      ))}
      {/* Top flame glow */}
      <radialGradient id="dt2" cx="50%" cy="0%" r="50%">
        <stop offset="0%" stopColor="#f87171" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#f87171" stopOpacity="0" />
      </radialGradient>
      <ellipse cx="110" cy="10" rx="25" ry="18" fill="url(#dt2)" />
      {/* Cracks on ground */}
      <path d="M90 130 L70 140" stroke="rgba(248,113,113,0.2)" strokeWidth="1" />
      <path d="M130 128 L155 140" stroke="rgba(248,113,113,0.15)" strokeWidth="1" />
      {/* Skulls hinted */}
      {[[40,115],[175,112]].map(([sx,sy],i) => (
        <circle key={i} cx={sx} cy={sy} r="5" fill="rgba(248,113,113,0.08)" stroke="rgba(248,113,113,0.2)" strokeWidth="0.8" />
      ))}
      {/* Floor */}
      <line x1="0" y1="125" x2="220" y2="125" stroke="rgba(248,113,113,0.12)" strokeWidth="1" />
    </svg>
  );
}

function ClanBossArt() {
  return (
    <svg viewBox="0 0 220 140" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <radialGradient id="cb1" cx="50%" cy="60%" r="65%">
        <stop offset="0%" stopColor="#fb923c" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#070b14" stopOpacity="0" />
      </radialGradient>
      <rect width="220" height="140" fill="url(#cb1)" />
      {/* Boss silhouette — massive horned creature */}
      <ellipse cx="110" cy="85" rx="45" ry="50" fill="rgba(20,10,5,0.85)" />
      {/* Horns */}
      <path d="M78 55 Q55 20 65 10" stroke="rgba(251,146,60,0.4)" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M142 55 Q165 20 155 10" stroke="rgba(251,146,60,0.4)" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* Eyes */}
      <ellipse cx="97" cy="72" rx="6" ry="4" fill="rgba(251,146,60,0.7)" />
      <ellipse cx="123" cy="72" rx="6" ry="4" fill="rgba(251,146,60,0.7)" />
      <ellipse cx="97" cy="72" rx="3" ry="2" fill="rgba(251,146,60,1)" />
      <ellipse cx="123" cy="72" rx="3" ry="2" fill="rgba(251,146,60,1)" />
      {/* Aura rings */}
      <circle cx="110" cy="85" r="55" stroke="rgba(251,146,60,0.08)" strokeWidth="2" fill="none" />
      <circle cx="110" cy="85" r="65" stroke="rgba(251,146,60,0.05)" strokeWidth="1.5" fill="none" />
      {/* Ground shadow */}
      <ellipse cx="110" cy="130" rx="50" ry="8" fill="rgba(0,0,0,0.5)" />
      {/* Runes around */}
      {[0,60,120,180,240,300].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const rx2 = 80 * Math.cos(rad) + 110;
        const ry2 = 40 * Math.sin(rad) + 85;
        return <circle key={i} cx={rx2} cy={ry2} r="2" fill="rgba(251,146,60,0.3)" />;
      })}
    </svg>
  );
}

const ZONE_ART: Record<string, () => JSX.Element> = {
  sanctuaries: SanctuariesArt,
  "death-tower": DeathTowerArt,
  "clan-boss": ClanBossArt,
};

// ─── RuinsPage ────────────────────────────────────────────────────────────────
export default function RuinsPage() {
  const { tokens } = useTrainer();
  const tok = tokens as any;
  const pveCount = tok?.npcTokens ?? 0;
  const pveMax = tok?.npcMax ?? 10;

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background:"#070b14", fontFamily:"'Exo 2', sans-serif" }}>
      {/* ── Ambient background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute" style={{ width:"60%",height:"55%",top:"-10%",left:"-15%", background:"radial-gradient(ellipse, rgba(88,28,135,0.12) 0%, transparent 70%)" }} />
        <div className="absolute" style={{ width:"50%",height:"45%",bottom:"-5%",right:"-10%", background:"radial-gradient(ellipse, rgba(127,29,29,0.1) 0%, transparent 70%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage:"repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.008) 3px, rgba(255,255,255,0.008) 4px)" }} />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute rounded-full" style={{
            width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
            background: i % 2 === 0 ? "#a78bfa" : "#f87171",
            boxShadow: `0 0 8px ${i % 2 === 0 ? "#a78bfa" : "#f87171"}`,
            left: `${10 + i * 11}%`, top: `${15 + (i % 4) * 18}%`,
            animation: `nurseryXP ${2.8 + i * 0.35}s ease-in-out infinite ${i * 0.5}s`, opacity: 0.5,
          }} />
        ))}
      </div>

      <PageTopbar
        title={
          <div className="flex flex-col items-center">
            <span className="tracking-[0.22em] uppercase font-black" style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:"var(--font-lg)", color:"var(--text-primary)" }}>The Ruins</span>
            <span className="tracking-widest uppercase" style={{ fontSize:"var(--font-2xs)", color:"var(--text-muted)", fontFamily:"monospace" }}>PvE · Exploration</span>
          </div>
        }
        right={
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background:"rgba(14,165,233,0.08)", border:"1px solid rgba(14,165,233,0.2)" }}>
            <span style={{ fontSize:"var(--font-base)" }}>⚡</span>
            <span className="font-mono font-bold tabular-nums" style={{ fontSize:"var(--font-sm)", color:"#7dd3fc" }}>
              {pveCount}<span style={{ opacity:0.35 }}>/{pveMax}</span>
            </span>
          </div>
        }
      />

      {/* ── Zone cards ── */}
      <div className="relative flex-1 flex flex-col md:flex-row items-stretch gap-0 overflow-hidden">
        {ZONES.map((zone, idx) => {
          const Art = ZONE_ART[zone.id];
          const isLocked = zone.status === "locked";
          const noTokens = !isLocked && pveCount <= 0;
          const disabled = isLocked || noTokens;

          return (
            <div
              key={zone.id}
              onClick={() => !disabled && zone.route && navigate(zone.route)}
              className="relative flex-1 flex flex-col overflow-hidden transition-all duration-300 group"
              style={{
                cursor: disabled ? "default" : "pointer",
                borderRight: idx < ZONES.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                filter: isLocked ? "grayscale(0.5)" : "none",
                opacity: isLocked ? 0.65 : 1,
                minHeight: 0,
              }}
            >
              {/* Art background — fills top portion */}
              <div className="absolute inset-0 overflow-hidden">
                {/* Gradient overlay on art */}
                <div className="absolute inset-0" style={{
                  background: isLocked
                    ? "rgba(7,11,20,0.6)"
                    : `linear-gradient(180deg, rgba(7,11,20,0.2) 0%, rgba(7,11,20,0.75) 65%, rgba(7,11,20,0.97) 100%)`,
                  zIndex: 1,
                }} />
                {/* Accent glow on hover */}
                {!isLocked && (
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                    background: `radial-gradient(ellipse 80% 60% at 50% 30%, rgba(${zone.accentRgb},0.12) 0%, transparent 70%)`,
                    zIndex: 2,
                  }} />
                )}
                {/* SVG art */}
                <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 0 }}>
                  <Art />
                </div>
              </div>

              {/* Left accent bar */}
              <div className="absolute top-0 left-0 bottom-0 w-0.5" style={{
                background: isLocked
                  ? "rgba(255,255,255,0.06)"
                  : `linear-gradient(180deg, transparent 0%, ${zone.accent}80 40%, ${zone.accent}40 70%, transparent 100%)`,
                zIndex: 3,
              }} />

              {/* Content — sits at bottom */}
              <div className="relative flex flex-col justify-end h-full px-4 py-4 md:px-5 md:py-5" style={{ zIndex: 4 }}>
                {/* Zone number */}
                <div className="mb-auto pt-3">
                  <span className="font-mono tracking-widest"
                    style={{ fontSize: "var(--font-xs)", color: isLocked ? "rgba(255,255,255,0.12)" : `rgba(${zone.accentRgb},0.5)` }}>
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </div>

                {/* Tag pill */}
                <div className="mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono tracking-widest"
                    style={{
                      fontSize: "var(--font-xs)",
                      background: isLocked ? "rgba(255,255,255,0.04)" : `rgba(${zone.accentRgb},0.12)`,
                      border: `1px solid ${isLocked ? "rgba(255,255,255,0.08)" : `rgba(${zone.accentRgb},0.25)`}`,
                      color: isLocked ? "rgba(255,255,255,0.2)" : zone.accent,
                    }}>
                    {isLocked ? "COMING SOON" : zone.tag}
                  </span>
                </div>

                {/* Name */}
                <h2 className="font-black tracking-wide leading-none mb-1"
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: "clamp(18px, 3vw, 26px)",
                    color: isLocked ? "rgba(255,255,255,0.25)" : "#e2e8f0",
                    textShadow: isLocked ? "none" : `0 0 30px rgba(${zone.accentRgb},0.4)`,
                  }}>
                  {zone.name}
                </h2>

                {/* Subtitle */}
                <p className="font-mono mb-2"
                  style={{
                    fontSize: "var(--font-xs)",
                    color: isLocked ? "rgba(255,255,255,0.15)" : zone.accent,
                    opacity: 0.9,
                    letterSpacing: "0.08em",
                  }}>
                  {zone.subtitle}
                </p>

                {/* Description */}
                <p className="leading-relaxed mb-3"
                  style={{ fontSize: "var(--font-sm)", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  {zone.description}
                </p>

                {/* No tokens warning */}
                {noTokens && !isLocked && (
                  <div className="mb-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg w-fit"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <span style={{ fontSize: "var(--font-xs)", color: "var(--accent-red)", fontFamily: "monospace" }}>⚡ NO ENERGY</span>
                  </div>
                )}

                {/* Enter button — active only */}
                {!isLocked && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 w-fit"
                    style={{
                      background: noTokens ? "rgba(255,255,255,0.04)" : `rgba(${zone.accentRgb},0.12)`,
                      border: `1px solid ${noTokens ? "rgba(255,255,255,0.08)" : `rgba(${zone.accentRgb},0.3)`}`,
                    }}
                  >
                    <span className="font-black tracking-widest uppercase"
                      style={{
                        fontFamily: "'Rajdhani', sans-serif",
                        fontSize: "var(--font-sm)",
                        color: noTokens ? "rgba(255,255,255,0.2)" : zone.accent,
                      }}>
                      Enter
                    </span>
                    <span style={{ fontSize: "var(--font-xs)", color: noTokens ? "rgba(255,255,255,0.15)" : zone.accent }}>▶</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
