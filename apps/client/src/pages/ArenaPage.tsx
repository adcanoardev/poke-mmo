// apps/client/src/pages/ArenaPage.tsx
import { useTrainer } from "../context/TrainerContext";
import PageTopbar from "../components/PageTopbar";

// ─── Mode config ──────────────────────────────────────────────────────────────
interface ArenaMode {
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

const MODES: ArenaMode[] = [
  {
    id: "pvp",
    name: "PvP Battle",
    subtitle: "Ranked Matches",
    description:
      "Face real Binders in 3v3 turn-based combat. Climb the ranks and prove your team is the strongest.",
    tag: "PvP · Ranked",
    status: "active",
    accent: "#f59e0b",
    accentRgb: "245,158,11",
    route: "/battle",
  },
  {
    id: "ranking",
    name: "Ranking",
    subtitle: "Global Leaderboard",
    description:
      "View the top Binders worldwide. Bronze to Mythic — where do you stand among the elite?",
    tag: "PvP · Global",
    status: "active",
    accent: "#38bdf8",
    accentRgb: "56,189,248",
    route: "/ranking",
  },
  {
    id: "tournament",
    name: "Tournament",
    subtitle: "Weekly Championship",
    description:
      "A weekly bracket-style tournament. Only the strongest 64 Binders compete. Registration opens Fridays.",
    tag: "PvP · Weekly",
    status: "locked",
    accent: "#e879f9",
    accentRgb: "232,121,249",
  },
];

// ─── SVG art per mode ─────────────────────────────────────────────────────────
function PvPArt() {
  return (
    <svg viewBox="0 0 220 140" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <radialGradient id="pv1" cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#070b14" stopOpacity="0" />
      </radialGradient>
      <rect width="220" height="140" fill="url(#pv1)" />
      {/* Arena floor perspective lines */}
      {[-3,-1,1,3].map((offset, i) => (
        <line key={i} x1="110" y1="70" x2={offset < 0 ? 0 : 220} y2={100 + Math.abs(offset) * 12}
          stroke="rgba(245,158,11,0.1)" strokeWidth="0.8" />
      ))}
      <line x1="0" y1="110" x2="220" y2="110" stroke="rgba(245,158,11,0.15)" strokeWidth="1" />
      {/* Two opposing myth silhouettes */}
      {/* Left myth */}
      <ellipse cx="65" cy="90" rx="18" ry="28" fill="rgba(245,158,11,0.15)" />
      <circle cx="65" cy="60" r="10" fill="rgba(245,158,11,0.2)" />
      {/* Right myth — mirrored */}
      <ellipse cx="155" cy="90" rx="18" ry="28" fill="rgba(245,158,11,0.1)" />
      <circle cx="155" cy="60" r="10" fill="rgba(245,158,11,0.15)" />
      {/* VS in center */}
      <text x="110" y="80" textAnchor="middle" fontSize="20" fontWeight="900"
        fill="rgba(245,158,11,0.35)" fontFamily="sans-serif">VS</text>
      {/* Impact lines */}
      {[[-1,-1],[1,-1],[-1,1],[1,1]].map(([dx,dy],i) => (
        <line key={i} x1="110" y1="70" x2={110+dx*40} y2={70+dy*30}
          stroke="rgba(245,158,11,0.12)" strokeWidth="1.5" />
      ))}
      {/* Energy orbs */}
      {[[35,30],[185,25],[20,85],[200,90]].map(([sx,sy],i) => (
        <circle key={i} cx={sx} cy={sy} r="2.5" fill={`rgba(245,158,11,${0.2+i*0.08})`} />
      ))}
    </svg>
  );
}

function RankingArt() {
  return (
    <svg viewBox="0 0 220 140" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <radialGradient id="rk1" cx="50%" cy="70%" r="65%">
        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#070b14" stopOpacity="0" />
      </radialGradient>
      <rect width="220" height="140" fill="url(#rk1)" />
      {/* Podium */}
      {/* 2nd place */}
      <rect x="55" y="85" width="40" height="40" fill="rgba(56,189,248,0.1)" stroke="rgba(56,189,248,0.2)" strokeWidth="0.8" rx="1" />
      {/* 1st place — tallest */}
      <rect x="90" y="60" width="40" height="65" fill="rgba(56,189,248,0.18)" stroke="rgba(56,189,248,0.3)" strokeWidth="1" rx="1" />
      {/* 3rd place */}
      <rect x="125" y="98" width="40" height="27" fill="rgba(56,189,248,0.08)" stroke="rgba(56,189,248,0.15)" strokeWidth="0.8" rx="1" />
      {/* Crown on 1st */}
      <path d="M95 55 L110 42 L125 55 Z" fill="rgba(245,158,11,0.5)" />
      <circle cx="110" cy="42" r="3" fill="rgba(245,158,11,0.8)" />
      {/* Numbers */}
      <text x="75" y="102" textAnchor="middle" fontSize="11" fill="rgba(56,189,248,0.5)" fontFamily="monospace">2</text>
      <text x="110" y="80" textAnchor="middle" fontSize="13" fill="rgba(56,189,248,0.7)" fontWeight="bold" fontFamily="monospace">1</text>
      <text x="145" y="112" textAnchor="middle" fontSize="10" fill="rgba(56,189,248,0.4)" fontFamily="monospace">3</text>
      {/* Stars */}
      {[[30,20],[190,15],[20,60],[200,55],[15,100]].map(([sx,sy],i) => (
        <circle key={i} cx={sx} cy={sy} r="1.2" fill={`rgba(56,189,248,${0.3+i*0.08})`} />
      ))}
      {/* Rank labels floating */}
      <text x="30" y="45" fontSize="8" fill="rgba(245,158,11,0.4)" fontFamily="monospace">MYTHIC</text>
      <text x="155" y="40" fontSize="8" fill="rgba(192,192,192,0.3)" fontFamily="monospace">DIAMOND</text>
    </svg>
  );
}

function TournamentArt() {
  return (
    <svg viewBox="0 0 220 140" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <radialGradient id="tr1" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stopColor="#e879f9" stopOpacity="0.18" />
        <stop offset="100%" stopColor="#070b14" stopOpacity="0" />
      </radialGradient>
      <rect width="220" height="140" fill="url(#tr1)" />
      {/* Bracket structure */}
      {/* Left side matches */}
      {[25,55].map((y, i) => (
        <rect key={i} x="15" y={y} width="40" height="16" rx="2"
          fill="rgba(232,121,249,0.08)" stroke="rgba(232,121,249,0.2)" strokeWidth="0.7" />
      ))}
      <line x1="55" y1="33" x2="70" y2="33" stroke="rgba(232,121,249,0.2)" strokeWidth="0.8" />
      <line x1="55" y1="63" x2="70" y2="63" stroke="rgba(232,121,249,0.2)" strokeWidth="0.8" />
      <line x1="70" y1="33" x2="70" y2="63" stroke="rgba(232,121,249,0.2)" strokeWidth="0.8" />
      <line x1="70" y1="48" x2="85" y2="48" stroke="rgba(232,121,249,0.2)" strokeWidth="0.8" />
      {/* Center final */}
      <rect x="85" y="38" width="50" height="20" rx="2"
        fill="rgba(232,121,249,0.12)" stroke="rgba(232,121,249,0.35)" strokeWidth="1" />
      {/* Right side matches */}
      {[25,55].map((y, i) => (
        <rect key={i} x="165" y={y} width="40" height="16" rx="2"
          fill="rgba(232,121,249,0.08)" stroke="rgba(232,121,249,0.2)" strokeWidth="0.7" />
      ))}
      <line x1="165" y1="33" x2="150" y2="33" stroke="rgba(232,121,249,0.2)" strokeWidth="0.8" />
      <line x1="165" y1="63" x2="150" y2="63" stroke="rgba(232,121,249,0.2)" strokeWidth="0.8" />
      <line x1="150" y1="33" x2="150" y2="63" stroke="rgba(232,121,249,0.2)" strokeWidth="0.8" />
      <line x1="150" y1="48" x2="135" y2="48" stroke="rgba(232,121,249,0.2)" strokeWidth="0.8" />
      {/* Trophy */}
      <path d="M105 75 Q110 85 115 75" stroke="rgba(245,158,11,0.5)" strokeWidth="1.5" fill="none" />
      <rect x="107" y="84" width="6" height="8" fill="rgba(245,158,11,0.3)" />
      <rect x="103" y="91" width="14" height="3" rx="1" fill="rgba(245,158,11,0.3)" />
      <text x="110" y="115" textAnchor="middle" fontSize="8" fill="rgba(232,121,249,0.3)" fontFamily="monospace">COMING SOON</text>
    </svg>
  );
}

const MODE_ART: Record<string, () => JSX.Element> = {
  pvp: PvPArt,
  ranking: RankingArt,
  tournament: TournamentArt,
};

// ─── ArenaPage ────────────────────────────────────────────────────────────────
export default function ArenaPage() {
  const { tokens } = useTrainer();
  const tok = tokens as any;
  const pvpCount = tok?.pvpTokens ?? 0;
  const pvpMax = tok?.pvpMax ?? 10;

  return (
    <div
      className="fixed inset-0 flex flex-col"
      style={{ background: "#070b14", fontFamily: "'Exo 2', sans-serif" }}
    >
      {/* ── Ambient background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute" style={{ width:"55%",height:"50%",top:"-10%",right:"-10%", background:"radial-gradient(ellipse, rgba(120,80,10,0.12) 0%, transparent 70%)" }} />
        <div className="absolute" style={{ width:"45%",height:"40%",bottom:"-5%",left:"-5%", background:"radial-gradient(ellipse, rgba(14,100,160,0.1) 0%, transparent 70%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage:"repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.007) 3px, rgba(255,255,255,0.007) 4px)" }} />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="absolute rounded-full" style={{
            width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
            background: i % 2 === 0 ? "#f59e0b" : "#38bdf8",
            boxShadow: `0 0 8px ${i % 2 === 0 ? "#f59e0b" : "#38bdf8"}`,
            left: `${8 + i * 12}%`, top: `${12 + (i % 4) * 20}%`,
            animation: `nurseryXP ${3 + i * 0.3}s ease-in-out infinite ${i * 0.45}s`, opacity: 0.45,
          }} />
        ))}
      </div>

      <PageTopbar
        title={
          <div className="flex flex-col items-center">
            <span className="tracking-[0.22em] uppercase font-black" style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:"var(--font-lg)", color:"var(--text-primary)" }}>The Arena</span>
            <span className="tracking-widest uppercase" style={{ fontSize:"var(--font-2xs)", color:"var(--text-muted)", fontFamily:"monospace" }}>PvP · Combat</span>
          </div>
        }
        right={
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.2)" }}>
            <span style={{ fontSize:"var(--font-base)" }}>⚔️</span>
            <span className="font-mono font-bold tabular-nums" style={{ fontSize:"var(--font-sm)", color:"#fcd34d" }}>
              {pvpCount}<span style={{ opacity:0.35 }}>/{pvpMax}</span>
            </span>
          </div>
        }
      />

      {/* ── Mode cards ── */}
      <div className="relative flex-1 flex flex-col md:flex-row items-stretch gap-0 overflow-hidden">
        {MODES.map((mode, idx) => {
          const Art = MODE_ART[mode.id];
          const isLocked = mode.status === "locked";
          const noTokens = !isLocked && mode.id === "pvp" && pvpCount <= 0;
          const disabled = isLocked || noTokens;

          return (
            <div
              key={mode.id}
              onClick={() => !disabled && mode.route && navigate(mode.route)}
              className="relative flex-1 flex flex-col overflow-hidden transition-all duration-300 group"
              style={{
                cursor: disabled ? "default" : "pointer",
                borderRight: idx < MODES.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                filter: isLocked ? "grayscale(0.5)" : "none",
                opacity: isLocked ? 0.6 : 1,
                minHeight: 0,
              }}
            >
              {/* Art background */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute inset-0" style={{
                  background: isLocked
                    ? "rgba(7,11,20,0.6)"
                    : `linear-gradient(180deg, rgba(7,11,20,0.15) 0%, rgba(7,11,20,0.72) 60%, rgba(7,11,20,0.97) 100%)`,
                  zIndex: 1,
                }} />
                {!isLocked && (
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
                    background: `radial-gradient(ellipse 80% 60% at 50% 30%, rgba(${mode.accentRgb},0.12) 0%, transparent 70%)`,
                    zIndex: 2,
                  }} />
                )}
                <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 0 }}>
                  <Art />
                </div>
              </div>

              {/* Left accent bar */}
              <div className="absolute top-0 left-0 bottom-0 w-0.5" style={{
                background: isLocked
                  ? "rgba(255,255,255,0.05)"
                  : `linear-gradient(180deg, transparent 0%, ${mode.accent}80 40%, ${mode.accent}40 70%, transparent 100%)`,
                zIndex: 3,
              }} />

              {/* Content */}
              <div className="relative flex flex-col justify-end h-full px-4 py-4 md:px-5 md:py-5" style={{ zIndex: 4 }}>
                {/* Zone number */}
                <div className="mb-auto pt-3">
                  <span className="font-mono tracking-widest"
                    style={{ fontSize: "var(--font-xs)", color: isLocked ? "rgba(255,255,255,0.1)" : `rgba(${mode.accentRgb},0.45)` }}>
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                </div>

                {/* Tag pill */}
                <div className="mb-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono tracking-widest"
                    style={{
                      fontSize: "var(--font-xs)",
                      background: isLocked ? "rgba(255,255,255,0.04)" : `rgba(${mode.accentRgb},0.1)`,
                      border: `1px solid ${isLocked ? "rgba(255,255,255,0.08)" : `rgba(${mode.accentRgb},0.22)`}`,
                      color: isLocked ? "rgba(255,255,255,0.18)" : mode.accent,
                    }}>
                    {isLocked ? "COMING SOON" : mode.tag}
                  </span>
                </div>

                {/* Name */}
                <h2 className="font-black tracking-wide leading-none mb-1"
                  style={{
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: "clamp(18px, 3vw, 26px)",
                    color: isLocked ? "rgba(255,255,255,0.22)" : "#e2e8f0",
                    textShadow: isLocked ? "none" : `0 0 30px rgba(${mode.accentRgb},0.4)`,
                  }}>
                  {mode.name}
                </h2>

                {/* Subtitle */}
                <p className="font-mono mb-2"
                  style={{ fontSize: "var(--font-xs)", color: isLocked ? "rgba(255,255,255,0.14)" : mode.accent, letterSpacing: "0.08em" }}>
                  {mode.subtitle}
                </p>

                {/* Description */}
                <p className="leading-relaxed mb-3"
                  style={{ fontSize: "var(--font-sm)", color: "var(--text-secondary)", lineHeight: 1.55 }}>
                  {mode.description}
                </p>

                {/* No tokens warning */}
                {noTokens && !isLocked && (
                  <div className="mb-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg w-fit"
                    style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <span style={{ fontSize: "var(--font-xs)", color: "var(--accent-red)", fontFamily: "monospace" }}>⚔️ NO ENERGY</span>
                  </div>
                )}

                {/* Enter button */}
                {!isLocked && (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 w-fit"
                    style={{
                      background: noTokens ? "rgba(255,255,255,0.04)" : `rgba(${mode.accentRgb},0.1)`,
                      border: `1px solid ${noTokens ? "rgba(255,255,255,0.08)" : `rgba(${mode.accentRgb},0.28)`}`,
                    }}
                  >
                    <span className="font-black tracking-widest uppercase"
                      style={{
                        fontFamily: "'Rajdhani', sans-serif",
                        fontSize: "var(--font-sm)",
                        color: noTokens ? "rgba(255,255,255,0.18)" : mode.accent,
                      }}>
                      {mode.id === "ranking" ? "View" : "Enter"}
                    </span>
                    <span style={{ fontSize: "var(--font-xs)", color: noTokens ? "rgba(255,255,255,0.14)" : mode.accent }}>▶</span>
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
