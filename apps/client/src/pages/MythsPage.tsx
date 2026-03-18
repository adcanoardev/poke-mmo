// apps/client/src/pages/MythsPage.tsx
import { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";
import PageShell from "../components/PageShell";
import PageTopbar from "../components/PageTopbar";


// ─── types ────────────────────────────────────────────────────────────────────

type Affinity = "EMBER" | "TIDE" | "GROVE" | "VOLT" | "STONE" | "FROST" | "VENOM" | "ASTRAL" | "IRON" | "SHADE";

type Rarity = "COMMON" | "RARE" | "ELITE" | "EPIC" | "LEGENDARY" | "MYTHIC";

interface Move {
    id: string;
    name: string;
    affinity: Affinity;
    type?: string;
    power: number;
    accuracy: number;
    cooldown?: number;
    description: string;
}

interface Creature {
    id: string;
    slug: string;
    name: string;
    affinities: Affinity[];
    rarity: Rarity;
    description: string;
    baseStats: { hp: number; atk: number; def: number; spd: number };
    evolution?: { evolvesTo: string; method: string; value: number };
    art: { portrait: string; front: string; back: string };
    moves: Move[];
}

// ─── design tokens ────────────────────────────────────────────────────────────

const RARITY_CONFIG: Record<
    Rarity,
    {
        label: string;
        border: string;
        glow: string;
        badge: string;
        text: string;
        glowRgb: string;
    }
> = {
    COMMON: {
        label: "Common",
        border: "border-[#F7FFFB]",
        glow: "shadow-[0_0_12px_rgba(90,106,133,0.4)]",
        badge: "bg-[#1e2d45] text-[#8ca0b8]",
        text: "text-[#8ca0b8]",
        glowRgb: "90,106,133",
    },
    RARE: {
        label: "Rare",
        border: "border-[#4cc9f0]",
        glow: "shadow-[0_0_14px_rgba(76,201,240,0.4)]",
        badge: "bg-[#0a2233] text-[#4cc9f0]",
        text: "text-[#4cc9f0]",
        glowRgb: "76,201,240",
    },
    ELITE: {
        label: "Elite",
        border: "border-[#9b5de5]",
        glow: "shadow-[0_0_16px_rgba(155,93,229,0.45)]",
        badge: "bg-[#1a0b33] text-[#c77dff]",
        text: "text-[#c77dff]",
        glowRgb: "155,93,229",
    },
    EPIC: {
        label: "Epic",
        border: "border-[#f77f00]",
        glow: "shadow-[0_0_18px_rgba(247,127,0,0.5)]",
        badge: "bg-[#2a1500] text-[#f77f00]",
        text: "text-[#f77f00]",
        glowRgb: "247,127,0",
    },
    LEGENDARY: {
        label: "Legendary",
        border: "border-[#ffd60a]",
        glow: "shadow-[0_0_20px_rgba(255,214,10,0.5)]",
        badge: "bg-[#2a1c00] text-[#ffd60a]",
        text: "text-[#ffd60a]",
        glowRgb: "255,214,10",
    },
    MYTHIC: {
        label: "Mythic",
        border: "border-[#ff006e]",
        glow: "shadow-[0_0_22px_rgba(255,0,110,0.55)]",
        badge: "bg-[#2a0015] text-[#ff006e]",
        text: "text-[#ff006e]",
        glowRgb: "255,0,110",
    },
};

const AFFINITY_CONFIG: Record<Affinity, { label: string; color: string; bg: string; emoji: string }> = {
    EMBER: { label: "Ember", color: "text-[#ff6b35]", bg: "bg-[#ff6b35]/15", emoji: "🔥" },
    TIDE: { label: "Tide", color: "text-[#4cc9f0]", bg: "bg-[#4cc9f0]/15", emoji: "🌊" },
    GROVE: { label: "Grove", color: "text-[#06d6a0]", bg: "bg-[#06d6a0]/15", emoji: "🌿" },
    VOLT: { label: "Volt", color: "text-[#ffd60a]", bg: "bg-[#ffd60a]/15", emoji: "⚡" },
    STONE: { label: "Stone", color: "text-[#a8956a]", bg: "bg-[#a8956a]/15", emoji: "🪨" },
    FROST: { label: "Frost", color: "text-[#90e0ef]", bg: "bg-[#90e0ef]/15", emoji: "❄️" },
    VENOM: { label: "Venom", color: "text-[#9b5de5]", bg: "bg-[#9b5de5]/15", emoji: "☠️" },
    ASTRAL: { label: "Astral", color: "text-[#c77dff]", bg: "bg-[#c77dff]/15", emoji: "✨" },
    IRON: { label: "Iron", color: "text-[#8d99ae]", bg: "bg-[#8d99ae]/15", emoji: "⚙️" },
    SHADE: { label: "Shade", color: "text-[#e63946]", bg: "bg-[#e63946]/15", emoji: "🌑" },
};

const MOVE_TYPE_LABEL: Record<string, string> = {
    physical: "PHY",
    special: "SPC",
    support: "SUP",
};

// ─── AffinityBadge ────────────────────────────────────────────────────────────

function AffinityBadge({ affinity }: { affinity: Affinity }) {
    const cfg = AFFINITY_CONFIG[affinity];
    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}
        >
            {cfg.emoji} {cfg.label}
        </span>
    );
}

// ─── StatBar ──────────────────────────────────────────────────────────────────

function StatBar({ label, value, max = 160 }: { label: string; value: number; max?: number }) {
    const pct = Math.min(100, Math.round((value / max) * 100));
    const color = pct >= 70 ? "bg-[#06d6a0]" : pct >= 40 ? "bg-[#ffd60a]" : "bg-[#e63946]";
    return (
        <div className="flex items-center gap-2">
            <span className="text-[#F7FFFB] text-xs w-8 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-[#070b14] rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} rounded-full transition-all duration-700`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-white text-xs w-7 text-right font-mono">{value}</span>
        </div>
    );
}

// ─── MoveCard ─────────────────────────────────────────────────────────────────

function MoveCard({ move }: { move: Move }) {
    const mCfg = AFFINITY_CONFIG[move.affinity];
    const isSupport = move.type === "support" || move.power === 0;
    return (
        <div
            className={`relative rounded-xl p-3 border border-[#1e2d45] ${mCfg.bg} flex flex-col gap-1.5 overflow-hidden`}
        >
            {/* Accent top line */}
            <div
                className="absolute top-0 left-0 right-0 h-0.5 rounded-t-xl opacity-60"
                style={{ background: `currentColor` }}
            />

            {/* Name + type badge */}
            <div className="flex items-start justify-between gap-1">
                <span className={`text-sm font-bold leading-tight ${mCfg.color}`}>{move.name}</span>
                {move.type && (
                    <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 opacity-80"
                        style={{ background: "rgba(255,255,255,0.07)", color: "var(--text-secondary)" }}
                    >
                        {MOVE_TYPE_LABEL[move.type] ?? move.type.toUpperCase()}
                    </span>
                )}
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-3 text-xs text-[#F7FFFB]">
                {isSupport ? (
                    <span className="text-[#F7FFFB] italic text-xs">Sin daño</span>
                ) : (
                    <span title="Potencia">💥 <span className="text-white font-mono">{move.power}</span></span>
                )}
                <span title="Precisión">🎯 <span className="text-white font-mono">{move.accuracy}%</span></span>
                {move.cooldown != null && move.cooldown > 0 && (
                    <span title="Cooldown">⏳ <span className="text-white font-mono">{move.cooldown}t</span></span>
                )}
            </div>

            {/* Description */}
            <p className="text-[#F7FFFB] text-[11px] leading-snug line-clamp-2">{move.description}</p>
        </div>
    );
}

// ─── MythModal ────────────────────────────────────────────────────────────────

function MythModal({ myth, onClose }: { myth: Creature; onClose: () => void }) {
    const rCfg = RARITY_CONFIG[myth.rarity];
    const total = myth.baseStats.hp + myth.baseStats.atk + myth.baseStats.def + myth.baseStats.spd;

    // Usar front para el panel grande; portrait para fallback
    const frontUrl = myth.art.front || myth.art.portrait;
    const isEmoji = !frontUrl.startsWith("http");

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(7,11,20,0.92)", backdropFilter: "blur(12px)" }}
            onClick={onClose}
        >
            <div
                className={`relative w-full max-w-2xl bg-[#0d1520] border-2 ${rCfg.border} rounded-2xl overflow-hidden`}
                style={{
                    boxShadow: `0 0 60px rgba(${rCfg.glowRgb},0.25), 0 0 120px rgba(${rCfg.glowRgb},0.1)`,
                    animation: "mythModalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                    maxHeight: "90vh",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top accent bar */}
                <div className="h-1 w-full" style={{ background: `rgba(${rCfg.glowRgb},0.7)` }} />

                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-[#F7FFFB] hover:text-white hover:bg-[#1e2d45] transition-all text-lg"
                >
                    ✕
                </button>

                {/* ── Main layout: imagen izquierda + info derecha ── */}
                <div className="flex" style={{ minHeight: 0 }}>

                    {/* ── Panel izquierdo: imagen front ── */}
                    <div
                        className="relative shrink-0 flex items-center justify-center"
                        style={{
                            width: "40%",
                            background: `radial-gradient(ellipse at center, rgba(${rCfg.glowRgb},0.12) 0%, rgba(7,11,20,0.8) 70%)`,
                            borderRight: "1px solid rgba(255,255,255,0.06)",
                        }}
                    >
                        {/* Glow blob detrás de la imagen */}
                        <div
                            className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            style={{
                                background: `radial-gradient(circle at 50% 55%, rgba(${rCfg.glowRgb},0.18) 0%, transparent 65%)`,
                            }}
                        />

                        <div
                            className="relative z-10 flex items-center justify-center p-6 w-full"
                            style={{ minHeight: 200 }}
                        >
                            {isEmoji ? (
                                <span style={{ fontSize: "7rem" }}>{frontUrl}</span>
                            ) : (
                                <img
                                    src={frontUrl}
                                    alt={myth.name}
                                    className="w-full object-contain drop-shadow-2xl"
                                    style={{
                                        filter: `drop-shadow(0 0 20px rgba(${rCfg.glowRgb},0.5))`,
                                    }}
                                />
                            )}
                        </div>

                        {/* ID badge abajo */}
                        <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                            <span className="text-[#F7FFFB] text-sm font-mono font-bold bg-[#070b14]/80 px-3 py-1 rounded-full border border-[#1e2d45]">
                                #{myth.id}
                            </span>
                        </div>
                    </div>

                    {/* ── Panel derecho: info + stats + moves ── */}
                    <div className="flex-1 overflow-y-auto" style={{ maxHeight: "88vh" }}>

                        {/* Header: nombre + rareza + afinidades */}
                        <div className="px-5 pt-4 pb-3">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${rCfg.badge}`}>
                                    {rCfg.label}
                                </span>
                                {myth.affinities.map((a) => (
                                    <AffinityBadge key={a} affinity={a} />
                                ))}
                            </div>
                            <h2 className="text-white text-2xl font-bold tracking-tight mt-1">{myth.name}</h2>
                            <p className="text-[#F7FFFB] text-xs leading-relaxed italic mt-2">{myth.description}</p>
                        </div>

                        {/* Stats */}
                        <div className="px-5 pb-4">
                            <div className="flex items-center justify-between mb-2.5">
                                <h3 className="text-[#8ca0b8] text-[10px] font-bold uppercase tracking-widest">
                                    Stats base
                                </h3>
                                <span className="text-[#F7FFFB] text-xs">
                                    Total <span className="text-white font-bold">{total}</span>
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <StatBar label="PS" value={myth.baseStats.hp} />
                                <StatBar label="ATQ" value={myth.baseStats.atk} />
                                <StatBar label="DEF" value={myth.baseStats.def} />
                                <StatBar label="VEL" value={myth.baseStats.spd} />
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-[#1e2d45] mx-5" />

                        {/* Moves grid 2×2 */}
                        {myth.moves?.length > 0 && (
                            <div className="px-5 py-4">
                                <h3 className="text-[#8ca0b8] text-[10px] font-bold uppercase tracking-widest mb-3">
                                    Ataques
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {myth.moves.slice(0, 4).map((move) => (
                                        <MoveCard key={move.id} move={move} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Evolution */}
                        {myth.evolution && (
                            <div className="px-5 pb-5">
                                <div className="rounded-xl bg-[#070b14] border border-[#1e2d45] px-4 py-3 text-sm flex items-center gap-2">
                                    <span className="text-[#F7FFFB]">Evolves to</span>
                                    <span className="text-white font-bold">#{myth.evolution.evolvesTo}</span>
                                    <span className="text-[#F7FFFB]">
                                        (
                                        {myth.evolution.method === "LEVEL"
                                            ? `level ${myth.evolution.value}`
                                            : myth.evolution.method === "ITEM"
                                              ? `item (${myth.evolution.value})`
                                              : myth.evolution.method}
                                        )
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes mythModalIn {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
        </div>
    );
}

// ─── MythCard ─────────────────────────────────────────────────────────────────

function MythCard({ myth, onClick }: { myth: Creature; onClick: () => void }) {
    const rCfg = RARITY_CONFIG[myth.rarity];
    const cardArt = myth.art.front || myth.art.portrait;
    const isEmoji = !cardArt.startsWith("http");

    return (
        <button
            onClick={onClick}
            className={`group relative bg-[#0f1923] border-2 ${rCfg.border} rounded-xl p-3
        flex flex-col items-center gap-2
        transition-all duration-200 hover:scale-105 hover:bg-[#111d35] cursor-pointer w-full`}
            style={{ "--glow-rgb": rCfg.glowRgb } as React.CSSProperties}
        >
            {/* Hover glow overlay */}
            <div
                className="absolute inset-0 rounded-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{
                    background: `radial-gradient(ellipse at 50% 0%, rgba(${rCfg.glowRgb},0.15) 0%, transparent 70%)`,
                }}
            />

            {/* Art */}
            <div
                className="relative w-14 h-14 flex items-center justify-center"
                style={{ fontSize: isEmoji ? "2.6rem" : undefined }}
            >
                {isEmoji ? (
                    cardArt
                ) : (
                    <img src={cardArt} alt={myth.name} className="w-full h-full object-contain" />
                )}
            </div>

            {/* ID + name */}
            <div className="text-center w-full">
                <p className="text-[#F7FFFB] text-[10px] font-mono">#{myth.id}</p>
                <p className="text-white text-xs font-semibold leading-tight truncate w-full px-1">{myth.name}</p>
            </div>

            {/* Affinities */}
            <div className="flex justify-center gap-0.5">
                {myth.affinities.map((a) => (
                    <span key={a} className="text-sm" title={AFFINITY_CONFIG[a].label}>
                        {AFFINITY_CONFIG[a].emoji}
                    </span>
                ))}
            </div>

            {/* Rarity */}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${rCfg.badge}`}>{rCfg.label}</span>
        </button>
    );
}

// ─── constants ────────────────────────────────────────────────────────────────

const ALL_RARITIES: Rarity[] = ["COMMON", "RARE", "ELITE", "EPIC", "LEGENDARY", "MYTHIC"];
const ALL_AFFINITIES: Affinity[] = [
    "EMBER",
    "TIDE",
    "GROVE",
    "VOLT",
    "STONE",
    "FROST",
    "VENOM",
    "ASTRAL",
    "IRON",
    "SHADE",
];

// ─── MythsPage ────────────────────────────────────────────────────────────────

export default function MythsPage() {
    const [creatures, setCreatures] = useState<Creature[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Creature | null>(null);
    const [search, setSearch] = useState("");
    const [filterRarity, setFilterRarity] = useState<Rarity | "ALL">("ALL");
    const [filterAffinity, setFilterAffinity] = useState<Affinity | "ALL">("ALL");

    useEffect(() => {
        setLoading(true);
        (api as any)
            .dex()
            .then((data: Creature[]) => setCreatures(Array.isArray(data) ? data : []))
            .catch(() => setError("Failed to load Arcanum. Please reload."))
            .finally(() => setLoading(false));
    }, []);

    const filtered = useMemo(
        () =>
            creatures.filter((c) => {
                if (filterRarity !== "ALL" && c.rarity !== filterRarity) return false;
                if (filterAffinity !== "ALL" && !c.affinities.includes(filterAffinity as Affinity)) return false;
                if (search) {
                    const q = search.toLowerCase();
                    if (!c.name.toLowerCase().includes(q) && !c.id.includes(q)) return false;
                }
                return true;
            }),
        [creatures, filterRarity, filterAffinity, search],
    );

    return (
        <PageShell>
            <PageTopbar
                title="Myths"
                right={
                    <input
                        type="text"
                        placeholder="Name or #id…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-32 md:w-48 rounded-lg px-3 py-1.5 focus:outline-none transition-colors"
                        style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"var(--text-primary)", fontSize:"var(--font-sm)" }}
                    />
                }
            />

            {/* Filters */}
            <div className="relative flex-shrink-0 flex flex-wrap items-center gap-2 px-4 md:px-6 py-2 border-b" style={{ borderColor:"rgba(255,255,255,0.06)", background:"rgba(4,8,15,0.7)" }}>
                    {/* Rarity chips */}
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => setFilterRarity("ALL")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                filterRarity === "ALL"
                                    ? "bg-[#111d35] border-[#4cc9f0] text-white"
                                    : "border-[#1e2d45] text-[#F7FFFB] hover:text-white"
                            }`}
                        >
                            Todas
                        </button>
                        {ALL_RARITIES.map((r) => {
                            const cfg = RARITY_CONFIG[r];
                            return (
                                <button
                                    key={r}
                                    onClick={() => setFilterRarity(filterRarity === r ? "ALL" : r)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                                        filterRarity === r
                                            ? `${cfg.badge} ${cfg.border}`
                                            : "border-[#1e2d45] text-[#F7FFFB] hover:text-white"
                                    }`}
                                >
                                    {cfg.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Affinity buttons */}
                    <div className="flex flex-wrap gap-1 ml-auto">
                        {ALL_AFFINITIES.map((a) => {
                            const cfg = AFFINITY_CONFIG[a];
                            const active = filterAffinity === a;
                            return (
                                <button
                                    key={a}
                                    onClick={() => setFilterAffinity(active ? "ALL" : a)}
                                    title={cfg.label}
                                    className={`w-7 h-7 flex items-center justify-center rounded-lg border text-sm transition-all ${
                                        active
                                            ? `${cfg.bg} border-current ${cfg.color}`
                                            : "border-[#1e2d45] text-[#F7FFFB] hover:text-white hover:border-[#F7FFFB]"
                                    }`}
                                >
                                    {cfg.emoji}
                                </button>
                            );
                        })}
                    </div>
            </div>

            {/* ── Grid ── */}
            <div className="relative flex-1 overflow-y-auto px-4 md:px-6 py-4" style={{ scrollbarWidth:"none" }}>
                {loading && (
                    <div
                        className="grid gap-3"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}
                    >
                        {Array.from({ length: 50 }).map((_, i) => (
                            <div key={i} className="h-36 rounded-xl bg-[#0f1923] animate-pulse" />
                        ))}
                    </div>
                )}

                {error && !loading && (
                    <div className="flex items-center justify-center h-40">
                        <p className="text-[#e63946] text-sm">{error}</p>
                    </div>
                )}

                {!loading && !error && filtered.length === 0 && (
                    <div className="flex items-center justify-center h-40">
                        <p className="text-[#F7FFFB] text-sm">Sin resultados para los filtros actuales.</p>
                    </div>
                )}

                {!loading && !error && filtered.length > 0 && (
                    <div
                        className="grid gap-3"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}
                    >
                        {filtered.map((c) => (
                            <MythCard key={c.id} myth={c} onClick={() => setSelected(c)} />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Modal ── */}
            {selected && <MythModal myth={selected} onClose={() => setSelected(null)} />}
        </PageShell>
    );
}
