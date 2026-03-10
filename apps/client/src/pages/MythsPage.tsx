import { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";

// ─── types ────────────────────────────────────────────────────────────────────

type Affinity = "EMBER" | "TIDE" | "GROVE" | "VOLT" | "STONE" | "FROST" | "VENOM" | "ASTRAL" | "IRON" | "SHADE";

type Rarity = "COMMON" | "RARE" | "ELITE" | "LEGENDARY" | "MYTHIC";

interface Move {
    id: string;
    name: string;
    affinity: Affinity;
    power: number;
    accuracy: number;
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
    catchRate: number;
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
        label: "Común",
        border: "border-[#5a6a85]",
        glow: "shadow-[0_0_12px_rgba(90,106,133,0.4)]",
        badge: "bg-[#1e2d45] text-[#8ca0b8]",
        text: "text-[#8ca0b8]",
        glowRgb: "90,106,133",
    },
    RARE: {
        label: "Raro",
        border: "border-[#4cc9f0]",
        glow: "shadow-[0_0_14px_rgba(76,201,240,0.4)]",
        badge: "bg-[#0a2233] text-[#4cc9f0]",
        text: "text-[#4cc9f0]",
        glowRgb: "76,201,240",
    },
    ELITE: {
        label: "Élite",
        border: "border-[#9b5de5]",
        glow: "shadow-[0_0_16px_rgba(155,93,229,0.45)]",
        badge: "bg-[#1a0b33] text-[#c77dff]",
        text: "text-[#c77dff]",
        glowRgb: "155,93,229",
    },
    LEGENDARY: {
        label: "Legendario",
        border: "border-[#ffd60a]",
        glow: "shadow-[0_0_20px_rgba(255,214,10,0.5)]",
        badge: "bg-[#2a1c00] text-[#ffd60a]",
        text: "text-[#ffd60a]",
        glowRgb: "255,214,10",
    },
    MYTHIC: {
        label: "Mítico",
        border: "border-[#ff006e]",
        glow: "shadow-[0_0_22px_rgba(255,0,110,0.55)]",
        badge: "bg-[#2a0015] text-[#ff006e]",
        text: "text-[#ff006e]",
        glowRgb: "255,0,110",
    },
};

const AFFINITY_CONFIG: Record<Affinity, { label: string; color: string; bg: string; emoji: string }> = {
    EMBER: { label: "Brasa", color: "text-[#ff6b35]", bg: "bg-[#ff6b35]/15", emoji: "🔥" },
    TIDE: { label: "Marea", color: "text-[#4cc9f0]", bg: "bg-[#4cc9f0]/15", emoji: "🌊" },
    GROVE: { label: "Bosque", color: "text-[#06d6a0]", bg: "bg-[#06d6a0]/15", emoji: "🌿" },
    VOLT: { label: "Tormenta", color: "text-[#ffd60a]", bg: "bg-[#ffd60a]/15", emoji: "⚡" },
    STONE: { label: "Piedra", color: "text-[#a8956a]", bg: "bg-[#a8956a]/15", emoji: "🪨" },
    FROST: { label: "Escarcha", color: "text-[#90e0ef]", bg: "bg-[#90e0ef]/15", emoji: "❄️" },
    VENOM: { label: "Veneno", color: "text-[#9b5de5]", bg: "bg-[#9b5de5]/15", emoji: "☠️" },
    ASTRAL: { label: "Astral", color: "text-[#c77dff]", bg: "bg-[#c77dff]/15", emoji: "✨" },
    IRON: { label: "Hierro", color: "text-[#8d99ae]", bg: "bg-[#8d99ae]/15", emoji: "⚙️" },
    SHADE: { label: "Sombra", color: "text-[#e63946]", bg: "bg-[#e63946]/15", emoji: "🌑" },
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
            <span className="text-[#5a6a85] text-xs w-8 shrink-0">{label}</span>
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

// ─── MythModal ────────────────────────────────────────────────────────────────

function MythModal({ myth, onClose }: { myth: Creature; onClose: () => void }) {
    const rCfg = RARITY_CONFIG[myth.rarity];
    const total = myth.baseStats.hp + myth.baseStats.atk + myth.baseStats.def + myth.baseStats.spd;
    const isEmoji = !myth.art.portrait.startsWith("http");

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
            style={{ background: "rgba(7,11,20,0.9)", backdropFilter: "blur(10px)" }}
            onClick={onClose}
        >
            <div
                className={`relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-[#0f1923] border-2 ${rCfg.border} rounded-2xl`}
                style={{
                    boxShadow: `0 0 40px rgba(${rCfg.glowRgb},0.3)`,
                    animation: "mythModalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Top accent bar */}
                <div className="h-1 w-full rounded-t-2xl" style={{ background: `rgba(${rCfg.glowRgb},0.6)` }} />

                {/* Header */}
                <div className="flex items-start gap-4 p-5 pb-3">
                    <div
                        className={`shrink-0 w-28 h-28 rounded-xl flex items-center justify-center border-2 ${rCfg.border} bg-[#070b14]`}
                        style={{
                            fontSize: isEmoji ? "3.8rem" : undefined,
                            boxShadow: `inset 0 0 20px rgba(${rCfg.glowRgb},0.15)`,
                        }}
                    >
                        {isEmoji ? (
                            myth.art.portrait
                        ) : (
                            <img
                                src={myth.art.portrait}
                                alt={myth.name}
                                className="w-full h-full object-contain rounded-xl"
                            />
                        )}
                    </div>

                    <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[#5a6a85] text-xs font-mono">#{myth.id}</span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rCfg.badge}`}>
                                {rCfg.label}
                            </span>
                        </div>
                        <h2 className="text-white text-2xl font-bold tracking-tight">{myth.name}</h2>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {myth.affinities.map((a) => (
                                <AffinityBadge key={a} affinity={a} />
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="shrink-0 mt-1 text-[#5a6a85] hover:text-white transition-colors text-xl leading-none"
                    >
                        ✕
                    </button>
                </div>

                {/* Description */}
                <p className="text-[#5a6a85] text-sm px-5 pb-4 leading-relaxed italic">{myth.description}</p>

                {/* Stats */}
                <div className="px-5 pb-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-white text-xs font-bold uppercase tracking-widest">Stats base</h3>
                        <span className="text-[#5a6a85] text-xs">
                            Total <span className="text-white font-bold">{total}</span>
                        </span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                        <StatBar label="PS" value={myth.baseStats.hp} />
                        <StatBar label="ATQ" value={myth.baseStats.atk} />
                        <StatBar label="DEF" value={myth.baseStats.def} />
                        <StatBar label="VEL" value={myth.baseStats.spd} />
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-[#1e2d45] mx-5" />

                {/* Moves */}
                {myth.moves?.length > 0 && (
                    <div className="px-5 py-4">
                        <h3 className="text-white text-xs font-bold uppercase tracking-widest mb-3">Ataques</h3>
                        <div className="flex flex-col gap-2">
                            {myth.moves.map((move) => {
                                const mCfg = AFFINITY_CONFIG[move.affinity];
                                return (
                                    <div key={move.id} className={`rounded-xl p-3 border border-[#1e2d45] ${mCfg.bg}`}>
                                        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-sm font-bold ${mCfg.color}`}>{move.name}</span>
                                                <AffinityBadge affinity={move.affinity} />
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-[#5a6a85]">
                                                <span title="Potencia">💥 {move.power}</span>
                                                <span title="Precisión">🎯 {Math.round(move.accuracy * 100)}%</span>
                                            </div>
                                        </div>
                                        <p className="text-[#5a6a85] text-xs leading-relaxed">{move.description}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Evolution */}
                {myth.evolution && (
                    <div className="px-5 pb-5">
                        <div className="rounded-xl bg-[#070b14] border border-[#1e2d45] px-4 py-3 text-sm flex items-center gap-2">
                            <span className="text-[#5a6a85]">Evoluciona a</span>
                            <span className="text-white font-bold">#{myth.evolution.evolvesTo}</span>
                            <span className="text-[#5a6a85]">
                                (
                                {myth.evolution.method === "LEVEL"
                                    ? `nivel ${myth.evolution.value}`
                                    : myth.evolution.method === "ITEM"
                                      ? `objeto (${myth.evolution.value})`
                                      : myth.evolution.method}
                                )
                            </span>
                        </div>
                    </div>
                )}
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
    const isEmoji = !myth.art.portrait.startsWith("http");

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
                    myth.art.portrait
                ) : (
                    <img src={myth.art.portrait} alt={myth.name} className="w-full h-full object-contain" />
                )}
            </div>

            {/* ID */}
            <div className="text-center w-full">
                <p className="text-[#5a6a85] text-[10px] font-mono">#{myth.id}</p>
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

const ALL_RARITIES: Rarity[] = ["COMMON", "RARE", "ELITE", "LEGENDARY", "MYTHIC"];
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
        // api.dex() calls GET /dex — returns Creature[]
        (api as any)
            .dex()
            .then((data: Creature[]) => setCreatures(Array.isArray(data) ? data : []))
            .catch(() => setError("Error al cargar el Arcanium. Intenta recargar la página."))
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
        <div
            className="h-screen w-screen overflow-hidden flex flex-col"
            style={{ background: "#070b14", color: "#fff" }}
        >
            {/* ── Header ── */}
            <div className="shrink-0 px-6 pt-5 pb-3 border-b border-[#1e2d45]">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Arcanum</h1>
                        <p className="text-[#5a6a85] text-xs mt-0.5">
                            {loading ? "Cargando…" : `${filtered.length} de ${creatures.length} Myths registrados`}
                        </p>
                    </div>
                    <input
                        type="text"
                        placeholder="Nombre o #id…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-48 bg-[#0f1923] border border-[#1e2d45] rounded-lg px-3 py-1.5 text-sm placeholder-[#5a6a85] focus:outline-none focus:border-[#4cc9f0] transition-colors"
                        style={{ color: "#fff" }}
                    />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Rarity */}
                    <div className="flex flex-wrap gap-1.5">
                        <button
                            onClick={() => setFilterRarity("ALL")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                                filterRarity === "ALL"
                                    ? "bg-[#111d35] border-[#4cc9f0] text-white"
                                    : "border-[#1e2d45] text-[#5a6a85] hover:text-white"
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
                                            : "border-[#1e2d45] text-[#5a6a85] hover:text-white"
                                    }`}
                                >
                                    {cfg.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Affinity */}
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
                                            : "border-[#1e2d45] text-[#5a6a85] hover:text-white hover:border-[#5a6a85]"
                                    }`}
                                >
                                    {cfg.emoji}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* ── Grid ── */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
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
                        <p className="text-[#5a6a85] text-sm">Sin resultados para los filtros actuales.</p>
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
        </div>
    );
}
