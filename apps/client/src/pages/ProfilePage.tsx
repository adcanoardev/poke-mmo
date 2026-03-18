// apps/client/src/pages/ProfilePage.tsx
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";
import { useTrainer } from "../context/TrainerContext";
import PageTopbar from "../components/PageTopbar";

// ─── Constants ────────────────────────────────────────────────────────────────
const AFFINITY_COLORS: Record<string, string> = {
  EMBER: "#ff6b35", TIDE: "#4cc9f0", GROVE: "#06d6a0", VOLT: "#ffd60a",
  STONE: "#adb5bd", FROST: "#a8dadc", VENOM: "#7b2fff", ASTRAL: "#e040fb",
  SHADE: "#e63946", IRON: "#90a4ae",
};

const RARITY_COLORS: Record<string, string> = {
  COMMON: "#64748b", RARE: "#6366f1", EPIC: "#a855f7",
  ELITE: "#94a3b8", LEGENDARY: "#fbbf24", MYTHIC: "#f87171",
};

const RARITY_MULT: Record<string, number> = {
  COMMON: 1.0, RARE: 1.2, EPIC: 1.4, ELITE: 1.6, LEGENDARY: 2.0, MYTHIC: 2.5,
};

const PVP_RANKS = [
  { name: "Bronze",     min: 0,    color: "#cd7f32" },
  { name: "Silver",     min: 100,  color: "#c0c0c0" },
  { name: "Gold",       min: 300,  color: "var(--accent-gold)" },
  { name: "Platinum",   min: 600,  color: "var(--accent-blue)" },
  { name: "Diamond",    min: 1000, color: "#a78bfa" },
  { name: "Ascendant",  min: 1800, color: "#f97316" },
  { name: "Mythic",     min: 3000, color: "var(--accent-red)" },
];

const EMBLEMS = [
  { icon: "🪨", name: "Stone Emblem",  sanctum: "Kael",  affinity: "STONE",  level: 10 },
  { icon: "💧", name: "Tide Emblem",   sanctum: "Lyra",  affinity: "TIDE",   level: 15 },
  { icon: "⚡", name: "Volt Emblem",   sanctum: "Zeph",  affinity: "VOLT",   level: 20 },
  { icon: "🌿", name: "Grove Emblem",  sanctum: "Mira",  affinity: "GROVE",  level: 25 },
  { icon: "☠️", name: "Venom Emblem",  sanctum: "Voss",  affinity: "VENOM",  level: 30 },
  { icon: "✨", name: "Astral Emblem", sanctum: "Sable", affinity: "ASTRAL", level: 35 },
  { icon: "🔥", name: "Ember Emblem",  sanctum: "Ryn",   affinity: "EMBER",  level: 40 },
  { icon: "🌑", name: "Shade Emblem",  sanctum: "Nox",   affinity: "SHADE",  level: 50 },
];

// Placeholder frames — pending CDN assets
const FRAMES = [
  { id: "default",   name: "Default",   color: "#475569" },
  { id: "silver",    name: "Silver",    color: "#c0c0c0" },
  { id: "gold",      name: "Gold",      color: "var(--accent-gold)" },
  { id: "legendary", name: "Legendary", color: "var(--accent-gold)" },
  { id: "mythic",    name: "Mythic",    color: "var(--accent-red)" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcPower(myth: any): number {
  const mult = RARITY_MULT[myth.rarity] ?? 1.0;
  return Math.floor(
    (myth.maxHp * 0.4 + myth.attack * 0.3 + myth.defense * 0.2 + myth.speed * 0.1) * mult
  );
}

function getPvpRank(pvpTokens: number) {
  let rank = PVP_RANKS[0];
  for (const r of PVP_RANKS) {
    if (pvpTokens >= r.min) rank = r;
  }
  return rank;
}

// ─── StatRow ─────────────────────────────────────────────────────────────────
function StatRow({ label, value, color = "rgba(255,255,255,0.7)" }: {
  label: string; value: string | number; color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-xs font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

// ─── ProfilePage ─────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth();
  const { guildTag } = useTrainer();
  const [trainer, setTrainer] = useState<any>(null);
  const [party, setParty] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  // Username change modal
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [usernameMsg, setUsernameMsg] = useState("");
  const [changingUsername, setChangingUsername] = useState(false);

  // Frame picker
  const [showFramePicker, setShowFramePicker] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState("default");

  useEffect(() => {
    Promise.all([
      api.trainer(),
      api.party(),
      api.battleStats().catch(() => null),
    ]).then(([t, p, s]) => {
      setTrainer(t);
      setParty(p);
      setStats(s);
      if (t?.avatarFrame) setSelectedFrame(t.avatarFrame);
    });
  }, []);

  const xpForLevel = (lvl: number) => Math.floor(100 * Math.pow(lvl, 1.8));
  const xpPct = trainer ? Math.min(100, Math.round((trainer.xp / xpForLevel(trainer.level)) * 100)) : 0;
  const totalCombats = (stats?.wins ?? 0) + (stats?.losses ?? 0);
  const winRate = totalCombats > 0 ? Math.round(((stats?.wins ?? 0) / totalCombats) * 100) : 0;
  const pvpRank = getPvpRank(trainer?.pvpTokens ?? 0);

  // Power calc from party
  const totalPower = party.reduce((acc, p) => acc + calcPower(p), 0);
  const avgPower = party.length > 0 ? Math.round(totalPower / party.length) : 0;

  const totalByRarity = stats?.byRarity
    ? Object.values(stats.byRarity as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
    : 0;

  const diamonds = trainer?.diamonds ?? 0;
  const frameColor = FRAMES.find((f) => f.id === selectedFrame)?.color ?? "#475569";

  async function handleUsernameChange() {
    if (!newUsername.trim() || newUsername.length < 3) {
      setUsernameMsg("Min 3 characters.");
      return;
    }
    if (diamonds < 150) {
      setUsernameMsg("Not enough diamonds (need 150 💎).");
      return;
    }
    setChangingUsername(true); setUsernameMsg("");
    try {
      await (api as any).changeUsername?.({ username: newUsername.trim() });
      setUsernameMsg("Username updated!");
      setShowUsernameModal(false);
    } catch (e: any) {
      setUsernameMsg(e.message ?? "Error updating username.");
    } finally { setChangingUsername(false); }
  }

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background:"#070b14", fontFamily:"'Exo 2',sans-serif" }}>
      {/* Ambient BG */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 70% 50% at 50% -10%,rgba(123,47,255,0.06) 0%,transparent 60%)" }} />
          <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)",backgroundSize:"40px 40px" }} />
      </div>
      <PageTopbar title="Profile" />
      {/* ── Username change modal ── */}
      {showUsernameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setShowUsernameModal(false)}>
          <div className="relative rounded-2xl w-full max-w-xs p-6 flex flex-col gap-4"
            style={{ background: "#0a1020", border: "1px solid rgba(167,139,250,0.25)" }}
            onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="font-black tracking-widest uppercase text-sm mb-1"
                style={{ fontFamily: "'Rajdhani',sans-serif", color: "var(--text-primary)" }}>
                Change Username
              </p>
              <p className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>
                Cost: <span style={{ color: "#a78bfa" }}>150 💎</span> · You have: <span style={{ color: diamonds >= 150 ? "#a78bfa" : "#f87171" }}>{diamonds} 💎</span>
              </p>
            </div>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="New username..."
              maxLength={20}
              className="w-full px-3 py-2.5 rounded-xl text-sm font-mono outline-none"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(167,139,250,0.25)",
                color: "var(--text-primary)",
              }}
            />
            {usernameMsg && (
              <p className="text-[10px] font-mono" style={{ color: usernameMsg.includes("!") ? "#06d6a0" : "#f87171" }}>
                {usernameMsg}
              </p>
            )}
            <button onClick={handleUsernameChange} disabled={changingUsername || diamonds < 150}
              className="w-full py-2.5 rounded-xl font-bold text-xs tracking-widest uppercase transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#7b2fff,#a78bfa)", color: "#fff" }}>
              {changingUsername ? "Changing..." : "Confirm — 150 💎"}
            </button>
            <button onClick={() => setShowUsernameModal(false)}
              className="text-[10px] font-mono text-center transition-colors hover:opacity-60"
              style={{ color: "var(--text-muted)" }}>
              Cancel ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Frame picker modal ── */}
      {showFramePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.8)" }}
          onClick={() => setShowFramePicker(false)}>
          <div className="relative rounded-2xl w-full max-w-xs p-5 flex flex-col gap-4"
            style={{ background: "#0a1020", border: "1px solid rgba(255,255,255,0.1)" }}
            onClick={(e) => e.stopPropagation()}>
            <p className="font-black tracking-widest uppercase text-sm"
              style={{ fontFamily: "'Rajdhani',sans-serif", color: "var(--text-primary)" }}>
              Avatar Frame
            </p>
            <div className="flex flex-col gap-2">
              {FRAMES.map((f) => (
                <button key={f.id} onClick={() => { setSelectedFrame(f.id); setShowFramePicker(false); }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
                  style={{
                    background: selectedFrame === f.id ? `${f.color}12` : "rgba(255,255,255,0.03)",
                    border: `1px solid ${selectedFrame === f.id ? f.color + "50" : "rgba(255,255,255,0.07)"}`,
                  }}>
                  <div className="w-8 h-8 rounded-full flex-shrink-0"
                    style={{ background: `${f.color}20`, border: `2px solid ${f.color}60` }} />
                  <span className="text-sm font-bold" style={{ color: selectedFrame === f.id ? f.color : "var(--text-primary)" }}>
                    {f.name}
                  </span>
                  {selectedFrame === f.id && (
                    <span className="ml-auto text-[9px] font-mono" style={{ color: f.color }}>ACTIVE</span>
                  )}
                </button>
              ))}
            </div>
            <p className="text-[9px] font-mono text-center" style={{ color: "var(--text-muted)" }}>
              More frames coming soon
            </p>
            <button onClick={() => setShowFramePicker(false)}
              className="text-[10px] font-mono text-center" style={{ color: "var(--text-muted)" }}>
              Close ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Banner ── */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 md:py-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg,#0d1525,#111d35)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 55% 100% at 85% 50%, rgba(123,47,255,0.12) 0%, transparent 60%)" }} />
        <div className="relative flex items-center gap-4">
          {/* Avatar with frame */}
          <div className="relative flex-shrink-0">
            <div className="w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center text-3xl"
              style={{
                background: "linear-gradient(135deg,#1a1a2e,#16213e)",
                border: `3px solid ${frameColor}`,
                boxShadow: `0 0 20px ${frameColor}40`,
              }}>
              🧙
            </div>
            <button onClick={() => setShowFramePicker(true)}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center transition-all hover:brightness-125 active:scale-90"
              style={{ background: frameColor, fontSize: "var(--font-xs)" }}
              title="Change frame">
              ✏
            </button>
          </div>

          {/* User info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-black text-xl md:text-2xl tracking-wide"
                style={{ fontFamily: "'Rajdhani',sans-serif", color: "var(--text-primary)" }}>
                {guildTag && (
                  <span style={{ color: "#7b2fff", marginRight: 4, fontWeight: 900, letterSpacing: ".08em" }}>
                    [{guildTag}]
                  </span>
                )}
                {user?.username ?? "—"}
              </span>
              <button onClick={() => setShowUsernameModal(true)}
                className="text-[9px] font-mono px-2 py-0.5 rounded-md transition-all hover:brightness-125 active:scale-95"
                style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
                rename
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                Lv. {trainer?.level ?? 1}
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full font-bold"
                style={{
                  background: `${pvpRank.color}15`,
                  color: pvpRank.color,
                  border: `1px solid ${pvpRank.color}35`,
                }}>
                {pvpRank.name}
              </span>
              <span className="text-xs font-mono" style={{ color: "#a78bfa" }}>
                ⚡ {totalPower.toLocaleString()} PWR
              </span>
            </div>
          </div>

          {/* Diamonds */}
          <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
            <span style={{ fontSize: "var(--font-md)" }}>💎</span>
            <span className="font-mono font-bold text-sm tabular-nums" style={{ color: "#c4b5fd" }}>
              {diamonds}
            </span>
          </div>
        </div>

        {/* XP bar */}
        <div className="relative mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>
              XP {trainer?.xp ?? 0} / {xpForLevel(trainer?.level ?? 1)}
            </span>
            <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>{xpPct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${xpPct}%`,
                background: "linear-gradient(90deg,#7b2fff,#4cc9f0)",
                boxShadow: "0 0 8px rgba(76,201,240,0.4)",
              }} />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 flex flex-col md:flex-row gap-0 md:gap-4 p-3 md:p-5 overflow-hidden min-h-0">

        {/* Col 1 — Emblems */}
        <div className="w-full md:w-48 flex-shrink-0 rounded-2xl p-4 flex flex-col mb-3 md:mb-0 overflow-hidden"
          style={{ background: "#0a1020", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="font-black tracking-widest uppercase text-xs mb-3 flex-shrink-0"
            style={{ fontFamily: "'Rajdhani',sans-serif", color: "var(--text-secondary)" }}>
            Emblems
          </p>
          <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {EMBLEMS.map((emblem, i) => {
              const earned = trainer?.medals?.includes(i);
              return (
                <div key={i} className="flex items-center gap-2 rounded-xl px-2.5 py-2 transition-all"
                  style={{
                    background: earned ? "rgba(255,214,10,0.05)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${earned ? "rgba(255,214,10,0.2)" : "rgba(255,255,255,0.05)"}`,
                    opacity: earned ? 1 : 0.45,
                  }}>
                  <span className={`text-lg flex-shrink-0 ${earned ? "" : "grayscale"}`}>{emblem.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate"
                      style={{ color: earned ? "#ffd60a" : "rgba(255,255,255,0.5)" }}>
                      {emblem.sanctum}
                    </p>
                    <p className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>
                      {earned ? "✓ Earned" : `Lv. ${emblem.level}`}
                    </p>
                  </div>
                  {earned && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: "#ffd60a", boxShadow: "0 0 6px #ffd60a" }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Col 2 — Stats */}
        <div className="flex-1 flex flex-col gap-3 overflow-hidden min-w-0">

          {/* Combat stats */}
          <div className="rounded-2xl p-4 flex-shrink-0"
            style={{ background: "#0a1020", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="font-black tracking-widest uppercase text-xs mb-3"
              style={{ fontFamily: "'Rajdhani',sans-serif", color: "var(--text-secondary)" }}>
              Combat
            </p>
            <div className="grid grid-cols-2 gap-x-6">
              <div>
                <StatRow label="NPC Wins"   value={stats?.wins ?? 0}   color="#06d6a0" />
                <StatRow label="NPC Losses" value={stats?.losses ?? 0} color="#f87171" />
                <StatRow label="Win Rate"   value={`${winRate}%`}      color="#4cc9f0" />
              </div>
              <div>
                <StatRow label="PvP Wins"   value={0}                      color="#06d6a0" />
                <StatRow label="PvP Losses" value={0}                      color="#f87171" />
                <StatRow label="Team Power" value={avgPower.toLocaleString()} color="#fbbf24" />
              </div>
            </div>
            <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${winRate}%`,
                  background: "linear-gradient(90deg,#06d6a0,#4cc9f0)",
                  boxShadow: "0 0 8px rgba(6,214,160,0.35)",
                }} />
            </div>
          </div>

          {/* Collection */}
          <div className="rounded-2xl p-4 flex-1 overflow-hidden flex flex-col"
            style={{ background: "#0a1020", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="font-black tracking-widest uppercase text-xs mb-3 flex-shrink-0"
              style={{ fontFamily: "'Rajdhani',sans-serif", color: "var(--text-secondary)" }}>
              Collection — {stats?.totalMyths ?? 0} Myths
            </p>
            <div className="flex flex-col gap-2 flex-1 justify-center">
              {["COMMON","RARE","ELITE","LEGENDARY","MYTHIC"].map((r) => {
                const count = stats?.byRarity?.[r] ?? 0;
                const pct = totalByRarity > 0 ? Math.max(3, Math.round((count / totalByRarity) * 100)) : 3;
                const color = RARITY_COLORS[r] ?? "#4cc9f0";
                return (
                  <div key={r} className="flex items-center gap-2">
                    <span className="text-[9px] font-mono w-16 text-right flex-shrink-0" style={{ color }}>{r}</span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}60` }} />
                    </div>
                    <span className="text-[9px] font-bold w-5 flex-shrink-0" style={{ color }}>{count}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <StatRow label="Total XP earned" value={(stats?.totalXp ?? 0).toLocaleString()} color="#4cc9f0" />
            </div>
          </div>
        </div>

        {/* Col 3 — Team */}
        <div className="w-full md:w-56 flex-shrink-0 rounded-2xl p-4 flex flex-col mt-3 md:mt-0 overflow-hidden"
          style={{ background: "#0a1020", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="font-black tracking-widest uppercase text-xs mb-3 flex-shrink-0"
            style={{ fontFamily: "'Rajdhani',sans-serif", color: "var(--text-secondary)" }}>
            Team
          </p>
          {party.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs font-mono text-center" style={{ color: "var(--text-muted)" }}>
                No Myths in team
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {party.map((p: any) => {
                const power = calcPower(p);
                const rarityColor = RARITY_COLORS[p.rarity] ?? "#64748b";
                return (
                  <div key={p.id} className="rounded-xl p-2.5"
                    style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.06)` }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="text-2xl flex-shrink-0">
                        {typeof p.art?.front === "string" && p.art.front.startsWith("http")
                          ? <img src={p.art.front} className="w-8 h-8 object-contain" alt="" />
                          : p.art?.front ?? "❓"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                          {p.name ?? p.speciesId}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono" style={{ color: "var(--text-secondary)" }}>Lv. {p.level}</span>
                          <span className="text-[8px] font-mono px-1 py-0 rounded" style={{ color: rarityColor, background: `${rarityColor}15` }}>
                            {p.rarity?.slice(0,3)}
                          </span>
                          {(p.affinities ?? []).map((aff: string) => (
                            <span key={aff} className="text-[8px] font-mono px-1 rounded"
                              style={{ color: AFFINITY_COLORS[aff] ?? "#4cc9f0", background: `${AFFINITY_COLORS[aff] ?? "#4cc9f0"}15` }}>
                              {aff.slice(0,2)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-[9px] font-mono font-bold flex-shrink-0" style={{ color: "var(--accent-gold)" }}>
                        {power}⚡
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-x-1 gap-y-0.5">
                      {[
                        ["HP",  p.maxHp,    "#4cc9f0"],
                        ["ATK", p.attack,   "#f87171"],
                        ["DEF", p.defense,  "#06d6a0"],
                        ["SPD", p.speed,    "#ffd60a"],
                      ].map(([label, val, color]) => (
                        <div key={label as string} className="text-center">
                          <p className="text-[7px] font-mono" style={{ color: "var(--text-muted)" }}>{label}</p>
                          <p className="text-[9px] font-bold" style={{ color: color as string }}>{val}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
