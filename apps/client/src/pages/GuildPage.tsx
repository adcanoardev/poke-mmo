// apps/client/src/pages/GuildPage.tsx
import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { useTrainer } from "../context/TrainerContext";
import ConfirmModal from "../components/ConfirmModal";
import PageTopbar from "../components/PageTopbar";

// ─── Types ────────────────────────────────────────────────────────────────────
interface GuildMember {
  userId:       string;
  username:     string;
  rank:         string;
  role:         "Leader" | "Officer" | "Member";
  power?:       number;
  prestige?:    number;
  level?:       number;
  online?:      boolean;
  lastSeen?:    string;
  questsToday?: number;
}

interface DailyQuest {
  id:          string;
  type:        string;
  description: string;
  target:      number;
  progress:    number;
  pct:         number;
  myContrib:   number;
  claimed50:   boolean;
  claimed100:  boolean;
  reward50:    string;
  reward100:   string;
}

interface GuildData {
  id: string;
  name: string;
  tag: string;
  banner: string;
  level: number;
  power: number;
  wins?: number;
  memberCount?: number;
  members?: GuildMember[];
  description: string;
  leaderId?: string;
}

const RANK_COLOR: Record<string, string> = {
  Mythic:   "#f87171",
  Diamond:  "#e040fb",
  Platinum: "#4cc9f0",
  Gold:     "#ffd60a",
  Silver:   "#e2e8f0",
  Bronze:   "#cd7c5b",
};

const ROLE_COLOR: Record<string, string> = {
  Leader:  "#ffd60a",
  Officer: "#7b2fff",
  Member:  "rgba(255,255,255,0.35)",
};

// ─── Sub-views for "has guild" panel ─────────────────────────────────────────
type GuildTab = "overview" | "members" | "quests" | "activity";

// ─── SVG art ─────────────────────────────────────────────────────────────────
function GuildShieldArt({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 220 160" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <radialGradient id="gsh1" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor="#070b14" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="220" height="160" fill="url(#gsh1)" />
      {/* Shield silhouette */}
      <path d="M110 30 L148 48 L148 88 Q148 118 110 132 Q72 118 72 88 L72 48 Z"
        fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.35" />
      <path d="M110 42 L138 56 L138 86 Q138 108 110 120 Q82 108 82 86 L82 56 Z"
        fill={color} fillOpacity="0.06" />
      {/* Center rune */}
      <line x1="110" y1="58" x2="110" y2="106" stroke={color} strokeWidth="1" strokeOpacity="0.5" />
      <line x1="92" y1="72" x2="128" y2="88" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      <line x1="128" y1="72" x2="92" y2="88" stroke={color} strokeWidth="1" strokeOpacity="0.4" />
      <circle cx="110" cy="80" r="5" fill={color} fillOpacity="0.6" />
      <circle cx="110" cy="80" r="2.5" fill="#070b14" />
      {/* Ambient particles */}
      {[[35,25],[185,20],[22,90],[198,95],[45,135],[175,130]].map(([sx,sy],i) => (
        <circle key={i} cx={sx} cy={sy} r="1.5" fill={color} fillOpacity={0.15 + i * 0.05} />
      ))}
      {/* Corner decorations */}
      <line x1="15" y1="15" x2="40" y2="15" stroke={color} strokeWidth="0.7" strokeOpacity="0.2" />
      <line x1="15" y1="15" x2="15" y2="35" stroke={color} strokeWidth="0.7" strokeOpacity="0.2" />
      <line x1="205" y1="15" x2="180" y2="15" stroke={color} strokeWidth="0.7" strokeOpacity="0.2" />
      <line x1="205" y1="15" x2="205" y2="35" stroke={color} strokeWidth="0.7" strokeOpacity="0.2" />
    </svg>
  );
}

function SearchArt() {
  return (
    <svg viewBox="0 0 220 160" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <defs>
        <radialGradient id="gsrc" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor="#4cc9f0" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#070b14" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="220" height="160" fill="url(#gsrc)" />
      {/* Guild list silhouettes */}
      {[30, 60, 90, 120].map((y, i) => (
        <rect key={i} x="40" y={y} width={80 - i * 8} height="14" rx="2"
          fill="rgba(76,201,240,0.07)" stroke="rgba(76,201,240,0.12)" strokeWidth="0.7" />
      ))}
      {/* Search circle */}
      <circle cx="155" cy="70" r="28" fill="none" stroke="rgba(76,201,240,0.2)" strokeWidth="1.5" />
      <line x1="175" y1="90" x2="192" y2="107" stroke="rgba(76,201,240,0.25)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="155" cy="70" r="18" fill="rgba(76,201,240,0.06)" />
      {/* Stars */}
      {[[20,20],[200,30],[25,140],[195,145]].map(([sx,sy],i)=>(
        <circle key={i} cx={sx} cy={sy} r="1.2" fill={`rgba(76,201,240,${0.2+i*0.07})`} />
      ))}
    </svg>
  );
}


// ─── NoGuildView props ────────────────────────────────────────────────────────
interface NoGuildViewProps {
  mode: "browse" | "create";
  setMode: (m: "browse" | "create") => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  createName: string;
  setCreateName: (v: string) => void;
  createTag: string;
  setCreateTag: (v: string) => void;
  filteredGuilds: GuildData[];
  actionLoading: boolean;
  error: string;
  onCreate: () => void;
  onJoin: (id: string) => void;
}

// ─── HasGuildView props ───────────────────────────────────────────────────────
interface HasGuildViewProps {
  guild:         GuildData;
  tab:           GuildTab;
  setTab:        (t: GuildTab) => void;
  actionLoading: boolean;
  onLeave:       () => void;
  quests:        DailyQuest[];
  questsLoading: boolean;
  myUserId:      string;
  myRole:        string | null;
  onKick:        (userId: string, username: string) => void;
  onPromote:     (userId: string, username: string) => void;
  onDemote:      (userId: string, username: string) => void;
  onClaimReward: (questId: string, threshold: 50 | 100) => void;
}


function NoGuildView({
  mode, setMode, searchQuery, setSearchQuery,
  createName, setCreateName, createTag, setCreateTag,
  filteredGuilds, actionLoading, error, onCreate, onJoin,
}: NoGuildViewProps) {
  return (
  <div className="relative flex-1 flex flex-col md:flex-row overflow-hidden">
    {/* Left panel — Create */}
    <div
      className="relative flex-1 flex flex-col overflow-hidden group transition-all duration-300"
      style={{ borderRight: "1px solid rgba(255,255,255,0.04)" }}
    >
      {/* Art bg */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{
          background: "linear-gradient(180deg, rgba(7,11,20,0.1) 0%, rgba(7,11,20,0.72) 55%, rgba(7,11,20,0.97) 100%)",
          zIndex: 1,
        }} />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(123,47,255,0.1) 0%, transparent 70%)",
          zIndex: 2,
        }} />
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 0 }}>
          <GuildShieldArt color="#7b2fff" />
        </div>
      </div>
      {/* Left accent bar */}
      <div className="absolute top-0 left-0 bottom-0 w-0.5" style={{
        background: "linear-gradient(180deg, transparent 0%, #7b2fff80 40%, #7b2fff40 70%, transparent 100%)",
        zIndex: 3,
      }} />

      <div className="relative flex-1 flex flex-col px-5 py-5 overflow-y-auto" style={{ zIndex: 4, scrollbarWidth: "none" }}>
        <div className="mb-auto pt-2">
          <span className="font-mono tracking-widest" style={{ fontSize: "var(--font-xs)", color: "rgba(123,47,255,0.5)" }}>01</span>
        </div>

        <div className="mb-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono tracking-widest"
            style={{ fontSize: "var(--font-xs)", background: "rgba(123,47,255,0.1)", border: "1px solid rgba(123,47,255,0.25)", color: "var(--accent-purple)" }}>
            FOUND · Guilds
          </span>
        </div>

        <h2 className="font-black tracking-wide leading-none mb-1"
          style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(20px, 3vw, 28px)", color: "var(--text-primary)" }}>
          Create Guild
        </h2>
        <p className="font-mono mb-4" style={{ fontSize: "var(--font-xs)", color: "var(--accent-purple)", letterSpacing: "0.08em" }}>
          Forge your own legacy
        </p>
        <p className="leading-relaxed mb-5" style={{ fontSize: "var(--font-sm)", color: "var(--text-secondary)", lineHeight: 1.55 }}>
          Start a new guild, recruit binders and compete as a unit. You become the Guild Leader.
        </p>

        {mode === "create" ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className="block font-mono tracking-widest mb-1.5" style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)" }}>
                GUILD NAME
              </label>
              <input
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                placeholder="e.g. Void Walkers"
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(123,47,255,0.3)", color: "var(--text-primary)", fontFamily: "'Exo 2', sans-serif" }}
              />
            </div>
            <div>
              <label className="block font-mono tracking-widest mb-1.5" style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)" }}>
                TAG (4 chars)
              </label>
              <input
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
                placeholder="VOID"
                maxLength={4}
                value={createTag}
                onChange={e => setCreateTag(e.target.value.toUpperCase())}
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(123,47,255,0.3)", color: "var(--text-primary)", fontFamily: "monospace", letterSpacing: "0.2em" }}
              />
            </div>
            {error && (
              <p className="text-xs font-mono" style={{ color: "var(--accent-red)" }}>{error}</p>
            )}
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setMode("browse")}
                className="flex-1 py-2 rounded-xl font-mono tracking-widest transition-all"
                style={{ fontSize: "var(--font-xs)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "var(--text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={onCreate}
                disabled={createName.length < 3 || createTag.length < 2 || actionLoading}
                className="flex-1 py-2 rounded-xl font-black tracking-widest uppercase transition-all disabled:opacity-30"
                style={{ fontSize: "var(--font-xs)", background: "linear-gradient(135deg, #7b2fff, #4cc9f0)", color: "#070b14", fontFamily: "'Rajdhani', sans-serif" }}
              >
                {actionLoading ? "..." : "Create ▶"}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setMode("create")}
            className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 w-fit"
            style={{ background: "rgba(123,47,255,0.1)", border: "1px solid rgba(123,47,255,0.28)" }}
          >
            <span className="font-black tracking-widest uppercase" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "var(--font-sm)", color: "var(--accent-purple)" }}>
              Create
            </span>
            <span style={{ fontSize: "var(--font-xs)", color: "var(--accent-purple)" }}>▶</span>
          </button>
        )}
      </div>
    </div>

    {/* Right panel — Browse & Join */}
    <div className="relative flex-1 flex flex-col overflow-hidden group transition-all duration-300">
      {/* Art bg */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{
          background: "linear-gradient(180deg, rgba(7,11,20,0.1) 0%, rgba(7,11,20,0.72) 55%, rgba(7,11,20,0.97) 100%)",
          zIndex: 1,
        }} />
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{
          background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(76,201,240,0.09) 0%, transparent 70%)",
          zIndex: 2,
        }} />
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 0 }}>
          <SearchArt />
        </div>
      </div>
      <div className="absolute top-0 left-0 bottom-0 w-0.5" style={{
        background: "linear-gradient(180deg, transparent 0%, #4cc9f080 40%, #4cc9f040 70%, transparent 100%)",
        zIndex: 3,
      }} />

      <div className="relative flex-1 flex flex-col px-5 py-5 overflow-hidden" style={{ zIndex: 4 }}>
        <div className="flex-shrink-0 mb-auto pt-2">
          <span className="font-mono tracking-widest" style={{ fontSize: "var(--font-xs)", color: "rgba(76,201,240,0.5)" }}>02</span>
        </div>

        <div className="flex-shrink-0 mb-3">
          <span className="inline-flex items-center px-2 py-0.5 rounded-md font-mono tracking-widest"
            style={{ fontSize: "var(--font-xs)", background: "rgba(76,201,240,0.1)", border: "1px solid rgba(76,201,240,0.22)", color: "var(--accent-blue)" }}>
            JOIN · Guilds
          </span>
        </div>

        <h2 className="flex-shrink-0 font-black tracking-wide leading-none mb-1"
          style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(20px, 3vw, 28px)", color: "var(--text-primary)" }}>
          Find a Guild
        </h2>
        <p className="flex-shrink-0 font-mono mb-3" style={{ fontSize: "var(--font-xs)", color: "var(--accent-blue)", letterSpacing: "0.08em" }}>
          Join an existing crew
        </p>

        {/* Search input */}
        <div className="flex-shrink-0 relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ fontSize: "var(--font-sm)", color: "var(--text-muted)" }}>🔍</span>
          <input
            className="w-full rounded-lg pl-8 pr-3 py-2 text-sm outline-none transition-colors"
            placeholder="Search guilds..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(76,201,240,0.2)", color: "var(--text-primary)", fontFamily: "'Exo 2', sans-serif" }}
          />
        </div>

        {/* Guild list */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5" style={{ scrollbarWidth: "none" }}>
          {filteredGuilds.map(g => (
            <div
              key={g.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer group/row"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = `${g.banner}40`)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)")}
            >
              {/* Banner dot */}
              <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black"
                style={{ background: `${g.banner}18`, border: `1px solid ${g.banner}40`, fontFamily: "'Rajdhani', sans-serif", fontSize: "var(--font-xs)", color: g.banner }}>
                {g.tag}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate" style={{ color: "var(--text-primary)" }}>{g.name}</div>
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", fontFamily: "monospace" }}>Lv.{g.level}</span>
                  <span style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)" }}>·</span>
                  <span style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", fontFamily: "monospace" }}>{g.power.toLocaleString()} PWR</span>
                </div>
              </div>
              <button
                onClick={() => onJoin(g.id)}
                disabled={actionLoading}
                className="flex-shrink-0 px-2.5 py-1 rounded-lg font-black tracking-widest uppercase transition-all disabled:opacity-40"
                style={{ fontSize: "var(--font-xs)", background: `${g.banner}15`, border: `1px solid ${g.banner}35`, color: g.banner, fontFamily: "'Rajdhani', sans-serif" }}
              >
                Join
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
}

function HasGuildView({ guild, tab, setTab, actionLoading, onLeave, quests, questsLoading, myUserId, myRole, onKick, onPromote, onDemote, onClaimReward }: HasGuildViewProps) {
  const onlineCount = guild.members?.filter(m => m.online).length ?? 0;

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden">
      {/* Guild accent ambient */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute" style={{
          width: "50%", height: "45%", top: "-5%", right: "-5%",
          background: `radial-gradient(ellipse, ${guild.banner}15 0%, transparent 70%)`,
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.006) 3px, rgba(255,255,255,0.006) 4px)",
        }} />
      </div>

      {/* Guild identity bar */}
      <div className="relative flex-shrink-0 flex items-center gap-4 px-4 py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)", zIndex: 5 }}>
        {/* Shield badge */}
        <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-black"
          style={{ background: `${guild.banner}20`, border: `1px solid ${guild.banner}50`, fontFamily: "'Rajdhani', sans-serif", fontSize: "var(--font-sm)", color: guild.banner }}>
          {guild.tag}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black tracking-wide" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: 16, color: "var(--text-primary)" }}>
              {guild.name}
            </span>
            <span className="px-1.5 py-0.5 rounded font-mono tracking-widest"
              style={{ fontSize: "var(--font-2xs)", background: "rgba(255,214,10,0.1)", border: "1px solid rgba(255,214,10,0.25)", color: "var(--accent-gold)" }}>
              Lv.{guild.level}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: "var(--font-xs)", color: "var(--text-secondary)", fontFamily: "monospace" }}>
              {(guild.power ?? 0).toLocaleString()} PWR
            </span>
            <span style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)" }}>·</span>
            <span style={{ fontSize: "var(--font-xs)", color: "var(--text-secondary)", fontFamily: "monospace" }}>
              {guild.wins ?? 0}W
            </span>
            <span style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)" }}>·</span>
            <span style={{ fontSize: "var(--font-xs)", fontFamily: "monospace" }}>
              <span style={{ color: "var(--accent-green)" }}>●</span>
              <span style={{ color: "var(--text-secondary)" }}> {onlineCount} online</span>
            </span>
          </div>
        </div>
        {/* Leave button */}
        <button
          onClick={onLeave}
          disabled={actionLoading}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg font-mono tracking-widest transition-all disabled:opacity-40"
          style={{ fontSize: "var(--font-xs)", background: "rgba(230,57,70,0.06)", border: "1px solid rgba(230,57,70,0.2)", color: "rgba(230,57,70,0.6)" }}
        >
          {actionLoading ? "..." : "Leave"}
        </button>
      </div>

      {/* Tabs */}
      <div className="relative flex-shrink-0 flex border-b" style={{ borderColor: "rgba(255,255,255,0.06)", zIndex: 5 }}>
        {(["overview", "members", "quests", "activity"] as GuildTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2.5 font-black tracking-widest uppercase transition-all"
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: "var(--font-sm)",
              color: tab === t ? guild.banner : "rgba(255,255,255,0.25)",
              borderBottom: tab === t ? `2px solid ${guild.banner}` : "2px solid transparent",
              background: tab === t ? `${guild.banner}08` : "transparent",
            }}
          >
            {t === "overview" ? "⚔️ Overview" : t === "members" ? "👥 Members" : t === "quests" ? "🗺️ Quests" : "📜 Activity"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="relative flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: "none", zIndex: 4 }}>

        {/* ── Overview tab ── */}
        {tab === "overview" && (
          <div className="flex flex-col gap-4 h-full">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "POWER",   value: (guild.power ?? 0).toLocaleString(), color: guild.banner },
                { label: "WINS",    value: String(guild.wins ?? 0),            color: "var(--accent-gold)" },
                { label: "MEMBERS", value: String(guild.members?.length ?? guild.memberCount ?? 0),  color: "var(--accent-blue)" },
              ].map(stat => (
                <div key={stat.label} className="rounded-xl p-3 text-center"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="font-black text-xl" style={{ fontFamily: "'Rajdhani', sans-serif", color: stat.color }}>
                    {stat.value}
                  </div>
                  <div className="font-mono tracking-widest" style={{ fontSize: "var(--font-2xs)", color: "var(--text-muted)" }}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="font-mono tracking-widest mb-2" style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)" }}>DESCRIPTION</div>
              <p style={{ fontSize: "var(--font-base)", color: "var(--text-secondary)", lineHeight: 1.6 }}>{guild.description}</p>
            </div>

            {/* Top members preview */}
            <div className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="px-4 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                <span className="font-mono tracking-widest" style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)" }}>TOP MEMBERS</span>
              </div>
              {(guild.members ?? []).slice(0, 3).map((m, i) => (
                <div key={m.username} className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0"
                  style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                  <span className="font-mono" style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", width: 16 }}>#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{m.username}</span>
                  </div>
                  <span className="font-mono" style={{ fontSize: "var(--font-xs)", color: ROLE_COLOR[m.role] }}>{m.role}</span>
                  <span className="font-black text-sm" style={{ fontFamily: "'Rajdhani', sans-serif", color: guild.banner }}>
                    {(m.prestige ?? m.power ?? 0).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>

            {/* Guild war placeholder */}
            <div className="rounded-xl p-4 flex flex-col items-center justify-center gap-2 flex-1"
              style={{ background: "rgba(255,255,255,0.015)", border: "1px dashed rgba(255,255,255,0.08)", minHeight: 80 }}>
              <span style={{ fontSize: 22, opacity: 0.4 }}>⚔️</span>
              <span className="font-mono tracking-widest" style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)" }}>GUILD WARS — COMING SOON</span>
            </div>
          </div>
        )}

        {/* ── Members tab ── */}
        {tab === "members" && (
          <div className="flex flex-col gap-1.5">
            {(guild.members ?? []).map(m => {
              const isMe = m.userId === myUserId;
              const canManage = (myRole === "Leader") || (myRole === "Officer" && m.role === "Member");
              const canPromote = myRole === "Leader" && m.role === "Member";
              const canDemote  = myRole === "Leader" && m.role === "Officer";
              const lastSeen = m.online ? null : m.lastSeen
                ? (() => {
                    const diff = Date.now() - new Date(m.lastSeen).getTime();
                    const h = Math.floor(diff / 3600000);
                    const d = Math.floor(diff / 86400000);
                    return d > 0 ? `${d}d ago` : h > 0 ? `${h}h ago` : "< 1h ago";
                  })()
                : null;
              return (
                <div key={m.userId ?? m.username} className="flex flex-col gap-2 px-3 py-3 rounded-xl"
                  style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${isMe ? "rgba(76,201,240,0.15)" : "rgba(255,255,255,0.05)"}` }}>
                  {/* Row 1 — identity */}
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: m.online ? "#06d6a0" : "rgba(255,255,255,0.15)" }} />
                    <span className="font-semibold text-sm flex-1 truncate" style={{ color: "var(--text-primary)" }}>{m.username}</span>
                    <span style={{ fontSize: "var(--font-xs)", color: RANK_COLOR[m.rank] ?? "#e2e8f0", fontFamily: "monospace" }}>{m.rank}</span>
                    <span style={{ fontSize: "var(--font-xs)", color: ROLE_COLOR[m.role], fontFamily: "monospace" }}>{m.role}</span>
                  </div>
                  {/* Row 2 — stats */}
                  <div className="flex items-center gap-3">
                    <span className="font-black" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "var(--font-base)", color: guild.banner }}>
                      {(m.prestige ?? m.power ?? 0).toLocaleString()} PWR
                    </span>
                    {m.questsToday !== undefined && (
                      <>
                        <span style={{ color: "var(--text-disabled)", fontSize: "var(--font-xs)" }}>·</span>
                        <span style={{ fontSize: "var(--font-xs)", color: "var(--accent-purple)", fontFamily: "monospace" }}>
                          {m.questsToday} quests today
                        </span>
                      </>
                    )}
                    {lastSeen && (
                      <>
                        <span style={{ color: "var(--text-disabled)", fontSize: "var(--font-xs)" }}>·</span>
                        <span style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", fontFamily: "monospace" }}>{lastSeen}</span>
                      </>
                    )}
                    {m.online && (
                      <>
                        <span style={{ color: "var(--text-disabled)", fontSize: "var(--font-xs)" }}>·</span>
                        <span style={{ fontSize: "var(--font-xs)", color: "var(--accent-green)", fontFamily: "monospace" }}>online</span>
                      </>
                    )}
                  </div>
                  {/* Row 3 — actions (solo si tengo permisos y no es mi propio perfil) */}
                  {!isMe && canManage && (
                    <div className="flex gap-1.5 pt-1 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                      {canPromote && (
                        <button onClick={() => onPromote(m.userId, m.username)}
                          style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid rgba(123,47,255,0.3)", background: "rgba(123,47,255,0.08)", color: "var(--accent-purple)", fontSize: "var(--font-xs)", fontFamily: "monospace", cursor: "pointer" }}>
                          ⬆ Promote
                        </button>
                      )}
                      {canDemote && (
                        <button onClick={() => onDemote(m.userId, m.username)}
                          style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid rgba(255,214,10,0.25)", background: "rgba(255,214,10,0.06)", color: "var(--accent-gold)", fontSize: "var(--font-xs)", fontFamily: "monospace", cursor: "pointer" }}>
                          ⬇ Demote
                        </button>
                      )}
                      <button onClick={() => onKick(m.userId, m.username)}
                        style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid rgba(230,57,70,0.25)", background: "rgba(230,57,70,0.06)", color: "var(--accent-red)", fontSize: "var(--font-xs)", fontFamily: "monospace", cursor: "pointer" }}>
                        ✕ Kick
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Quests tab ── */}
        {tab === "quests" && (
          <div className="flex flex-col gap-3">
            {questsLoading ? (
              <div className="flex items-center justify-center py-8">
                <span className="font-mono tracking-widest text-xs" style={{ color: "var(--text-muted)" }}>Loading quests...</span>
              </div>
            ) : quests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <span style={{ fontSize: 28, opacity: 0.3 }}>🗺️</span>
                <span className="font-mono tracking-widest text-xs" style={{ color: "var(--text-muted)" }}>NO QUESTS TODAY</span>
              </div>
            ) : (
              <>
                {/* Guild XP bar */}
                <div className="rounded-xl p-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono tracking-widest" style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)" }}>GUILD LEVEL {guild.level}</span>
                    <span className="font-black" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "var(--font-base)", color: guild.banner }}>
                      {guild.xp ?? 0} XP
                    </span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${guild.banner}, ${guild.banner}88)`, width: `${Math.min(((guild.xp ?? 0) % 500) / 500 * 100, 100)}%`, transition: "width 0.5s" }} />
                  </div>
                </div>

                {/* Quest cards */}
                {quests.map(q => (
                  <div key={q.id} className="rounded-xl overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{q.description}</div>
                          <div style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>
                            {q.progress}/{q.target} · Your contribution: {q.myContrib}
                          </div>
                        </div>
                        <span className="font-black flex-shrink-0" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 16, color: q.pct >= 100 ? "#06d6a0" : guild.banner }}>
                          {q.pct}%
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden", marginBottom: 10 }}>
                        <div style={{
                          height: "100%", borderRadius: 4,
                          background: q.pct >= 100 ? "linear-gradient(90deg,#06d6a0,#4cc9f0)" : `linear-gradient(90deg,${guild.banner},${guild.banner}88)`,
                          width: `${Math.min(q.pct, 100)}%`,
                          transition: "width 0.5s",
                        }} />
                      </div>
                      {/* Reward buttons */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => onClaimReward(q.id, 50)}
                          disabled={q.pct < 50 || q.claimed50}
                          style={{
                            flex: 1, padding: "7px 6px", borderRadius: 8, fontSize: "var(--font-xs)",
                            fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, letterSpacing: "0.05em",
                            cursor: q.pct >= 50 && !q.claimed50 ? "pointer" : "not-allowed",
                            background: q.claimed50 ? "rgba(255,255,255,0.03)" : q.pct >= 50 ? "rgba(255,214,10,0.1)" : "rgba(255,255,255,0.03)",
                            border: `1px solid ${q.claimed50 ? "rgba(255,255,255,0.05)" : q.pct >= 50 ? "rgba(255,214,10,0.3)" : "rgba(255,255,255,0.05)"}`,
                            color: q.claimed50 ? "rgba(255,255,255,0.2)" : q.pct >= 50 ? "#ffd60a" : "rgba(255,255,255,0.15)",
                          }}>
                          {q.claimed50 ? "✓ 50% Claimed" : "🎁 50% · +3 Tokens"}
                        </button>
                        <button
                          onClick={() => onClaimReward(q.id, 100)}
                          disabled={q.pct < 100 || q.claimed100}
                          style={{
                            flex: 1, padding: "7px 6px", borderRadius: 8, fontSize: "var(--font-xs)",
                            fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, letterSpacing: "0.05em",
                            cursor: q.pct >= 100 && !q.claimed100 ? "pointer" : "not-allowed",
                            background: q.claimed100 ? "rgba(255,255,255,0.03)" : q.pct >= 100 ? "rgba(6,214,160,0.1)" : "rgba(255,255,255,0.03)",
                            border: `1px solid ${q.claimed100 ? "rgba(255,255,255,0.05)" : q.pct >= 100 ? "rgba(6,214,160,0.3)" : "rgba(255,255,255,0.05)"}`,
                            color: q.claimed100 ? "rgba(255,255,255,0.2)" : q.pct >= 100 ? "#06d6a0" : "rgba(255,255,255,0.15)",
                          }}>
                          {q.claimed100 ? "✓ 100% Claimed" : "🏆 100% · +5 Tokens +5💎"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── Activity tab ── */}
        {tab === "activity" && (
          <div className="flex flex-col gap-2">
            {[
              { time: "2m ago",   icon: "⚔️", text: "Kaelith won a ranked battle",          color: "var(--accent-gold)" },
              { time: "14m ago",  icon: "🏆", text: "Void Walkers climbed to rank #3",       color: guild.banner },
              { time: "1h ago",   icon: "👋", text: "Solvein joined the guild",              color: "var(--accent-blue)" },
              { time: "3h ago",   icon: "⚔️", text: "Nyxara won a ranked battle",            color: "var(--accent-gold)" },
              { time: "5h ago",   icon: "⬆️", text: "Guild leveled up to Lv.7",             color: "var(--accent-green)" },
              { time: "1d ago",   icon: "⚔️", text: "Adrián won a ranked battle",            color: "var(--accent-gold)" },
              { time: "2d ago",   icon: "👋", text: "Torrath joined the guild",              color: "var(--accent-blue)" },
            ].map((evt, i) => (
              <div key={i} className="flex items-start gap-3 px-3 py-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: "var(--font-md)", lineHeight: 1.4 }}>{evt.icon}</span>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: "var(--font-base)", color: evt.color, lineHeight: 1.4 }}>{evt.text}</p>
                </div>
                <span className="flex-shrink-0 font-mono" style={{ fontSize: "var(--font-xs)", color: "var(--text-muted)" }}>{evt.time}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── GuildPage ────────────────────────────────────────────────────────────────
export default function GuildPage() {
  const { reload: reloadTrainer } = useTrainer();

  const [myGuild, setMyGuild] = useState<GuildData | null>(null);
  const [guildList, setGuildList] = useState<GuildData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<GuildTab>("overview");
  const [mode, setMode] = useState<"browse" | "create">("browse");
  const [searchQuery, setSearchQuery] = useState("");
  const [createName, setCreateName] = useState("");
  const [createTag, setCreateTag] = useState("");
  const [createBanner, setCreateBanner] = useState("#7b2fff");
  const [createDesc, setCreateDesc] = useState("");
  const [actionLoading, setActionLoading]   = useState(false);
  const [leaveModal, setLeaveModal]         = useState(false);
  const [kickModal, setKickModal]           = useState<{userId:string;username:string}|null>(null);
  const [promoteModal, setPromoteModal]     = useState<{userId:string;username:string}|null>(null);
  const [demoteModal, setDemoteModal]       = useState<{userId:string;username:string}|null>(null);
  const [quests, setQuests]                 = useState<DailyQuest[]>([]);
  const [questsLoading, setQuestsLoading]   = useState(false);

  const loadGuild = useCallback(async () => {
    try {
      const [mine, list] = await Promise.all([api.myGuild(), api.guildList()]);
      setMyGuild(mine);
      setGuildList(list ?? []);
      // Cargar quests si está en una guild
      if (mine) {
        setQuestsLoading(true);
        api.guildQuests().then(q => { setQuests(q ?? []); setQuestsLoading(false); }).catch(() => setQuestsLoading(false));
      }
    } catch { } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadGuild(); }, [loadGuild]);

  const filteredGuilds = guildList.filter(g =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  async function handleCreate() {
    if (!createName || !createTag) return;
    setActionLoading(true);
    setError("");
    try {
      await api.guildCreate({ name: createName, tag: createTag, banner: createBanner, description: createDesc });
      await loadGuild();
      reloadTrainer();
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleJoin(guildId: string) {
    setActionLoading(true);
    setError("");
    try {
      await api.guildJoin(guildId);
      await loadGuild();
      reloadTrainer();
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(false); }
  }

  function handleLeave() {
    setLeaveModal(true);
  }

  async function confirmLeave() {
    setLeaveModal(false);
    setActionLoading(true);
    setError("");
    try {
      await api.guildLeave();
      setMyGuild(null);
      await loadGuild();
      reloadTrainer();
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(false); }
  }

  async function confirmKick() {
    if (!kickModal) return;
    setKickModal(null);
    setActionLoading(true);
    try {
      await api.guildKick(kickModal.userId);
      await loadGuild();
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(false); }
  }

  async function confirmPromote() {
    if (!promoteModal) return;
    setPromoteModal(null);
    setActionLoading(true);
    try {
      await api.guildPromote(promoteModal.userId);
      await loadGuild();
      reloadTrainer();
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(false); }
  }

  async function confirmDemote() {
    if (!demoteModal) return;
    setDemoteModal(null);
    setActionLoading(true);
    try {
      await api.guildDemote(demoteModal.userId);
      await loadGuild();
    } catch (e: any) { setError(e.message); }
    finally { setActionLoading(false); }
  }

  async function handleClaimReward(questId: string, threshold: 50 | 100) {
    try {
      await api.guildClaimReward(questId, threshold);
      // Recargar quests
      const updated = await api.guildQuests();
      setQuests(updated ?? []);
      reloadTrainer();
    } catch (e: any) { setError(e.message); }
  }



  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#070b14" }}>
        <span className="font-black tracking-widest animate-pulse" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "var(--font-md)", color: "rgba(123,47,255,0.6)" }}>
          LOADING...
        </span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background:"#070b14", fontFamily:"'Exo 2', sans-serif" }}>
      {/* ── Ambient background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute" style={{ width:"55%",height:"50%",top:"-10%",right:"-10%", background:"radial-gradient(ellipse, rgba(80,20,120,0.1) 0%, transparent 70%)" }} />
        <div className="absolute" style={{ width:"45%",height:"40%",bottom:"-5%",left:"-5%", background:"radial-gradient(ellipse, rgba(20,60,100,0.09) 0%, transparent 70%)" }} />
        <div className="absolute inset-0" style={{ backgroundImage:"repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.007) 3px, rgba(255,255,255,0.007) 4px)" }} />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="absolute rounded-full" style={{
            width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2,
            background: i % 2 === 0 ? "#7b2fff" : "#4cc9f0",
            boxShadow: `0 0 8px ${i % 2 === 0 ? "#7b2fff" : "#4cc9f0"}`,
            left: `${10 + i * 15}%`, top: `${15 + (i % 3) * 25}%`,
            animation: `nurseryXP ${3.5 + i * 0.4}s ease-in-out infinite ${i * 0.6}s`, opacity: 0.4,
          }} />
        ))}
      </div>

      <PageTopbar
        title={
          <div className="flex flex-col items-center">
            <span className="tracking-[0.22em] uppercase font-black" style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:"var(--font-lg)", color:"var(--text-primary)" }}>Guild</span>
            <span className="tracking-widest uppercase" style={{ fontSize:"var(--font-2xs)", color:"var(--text-muted)", fontFamily:"monospace" }}>
              {myGuild ? myGuild.name : "No Guild"}
            </span>
          </div>
        }
        right={myGuild ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background:`${myGuild.banner}12`, border:`1px solid ${myGuild.banner}35` }}>
            <span className="font-mono font-bold tabular-nums tracking-widest" style={{ fontSize:"var(--font-sm)", color:myGuild.banner }}>
              [{myGuild.tag}]
            </span>
          </div>
        ) : undefined}
      />

      {/* ── Main content ── */}
      {myGuild
        ? <HasGuildView
            guild={myGuild}
            tab={tab}
            setTab={setTab}
            actionLoading={actionLoading}
            onLeave={handleLeave}
            quests={quests}
            questsLoading={questsLoading}
            myUserId={(myGuild as any).myUserId ?? ""}
            myRole={(myGuild as any).myRole ?? null}
            onKick={(userId, username) => setKickModal({userId, username})}
            onPromote={(userId, username) => setPromoteModal({userId, username})}
            onDemote={(userId, username) => setDemoteModal({userId, username})}
            onClaimReward={handleClaimReward}
          />
        : <NoGuildView
            mode={mode}
            setMode={setMode}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            createName={createName}
            setCreateName={setCreateName}
            createTag={createTag}
            setCreateTag={setCreateTag}
            filteredGuilds={filteredGuilds}
            actionLoading={actionLoading}
            error={error}
            onCreate={handleCreate}
            onJoin={handleJoin}
          />
      }

      {/* ── Kick modal ── */}
      {kickModal && (
        <ConfirmModal
          open={!!kickModal}
          onClose={() => setKickModal(null)}
          onConfirm={confirmKick}
          title="Kick Member"
          description={`Remove ${kickModal.username} from the guild? They will be able to rejoin later.`}
          confirmLabel="Kick"
          accent="#e63946"
          icon="✕"
          loading={actionLoading}
        />
      )}

      {/* ── Promote modal ── */}
      {promoteModal && (
        <ConfirmModal
          open={!!promoteModal}
          onClose={() => setPromoteModal(null)}
          onConfirm={confirmPromote}
          title="Promote to Officer"
          description={`Promote ${promoteModal.username} to Officer? They will be able to kick and manage regular members.`}
          confirmLabel="Promote"
          accent="#7b2fff"
          icon="⬆️"
          loading={actionLoading}
        />
      )}

      {/* ── Demote modal ── */}
      {demoteModal && (
        <ConfirmModal
          open={!!demoteModal}
          onClose={() => setDemoteModal(null)}
          onConfirm={confirmDemote}
          title="Demote to Member"
          description={`Demote ${demoteModal.username} from Officer to Member?`}
          confirmLabel="Demote"
          accent="#ffd60a"
          icon="⬇️"
          loading={actionLoading}
        />
      )}

      {/* ── Leave guild modal ── */}
      {myGuild && (() => {
        const isLeader = myGuild.leaderId === undefined
          ? false
          : myGuild.members?.find(m => m.role === "Leader")?.username !== undefined;
        const memberCount = myGuild.members?.length ?? myGuild.memberCount ?? 1;
        const isOnlyMember = memberCount <= 1;
        const iAmLeader = myGuild.members?.some(m => m.role === "Leader") ?? false;

        const title = iAmLeader && isOnlyMember
          ? "Disband Guild"
          : "Leave Guild";

        const description = iAmLeader && isOnlyMember
          ? `You are the only member of [${myGuild.tag}] ${myGuild.name}. Leaving will permanently dissolve the guild.`
          : iAmLeader
          ? `You are the leader of [${myGuild.tag}] ${myGuild.name}. Leaving will automatically transfer leadership to the member with the highest prestige.`
          : `Are you sure you want to leave [${myGuild.tag}] ${myGuild.name}?`;

        const warning = iAmLeader && isOnlyMember
          ? "The guild and all its history will be permanently deleted."
          : iAmLeader
          ? "This action cannot be undone. The new leader will be selected automatically."
          : undefined;

        const confirmLabel = iAmLeader && isOnlyMember ? "Disband" : "Leave Guild";

        return (
          <ConfirmModal
            open={leaveModal}
            onClose={() => setLeaveModal(false)}
            onConfirm={confirmLeave}
            title={title}
            description={description}
            warning={warning}
            confirmLabel={confirmLabel}
            accent="#e63946"
            icon={iAmLeader ? "⚔️" : "🚪"}
            loading={actionLoading}
          />
        );
      })()}
    </div>
  );
}
