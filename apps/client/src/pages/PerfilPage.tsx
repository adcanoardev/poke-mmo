import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import TrainerSidebar from "../components/TrainerSidebar";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

const EMBLEM_INFO = [
    { icon: "🪨", name: "Emblema Roca", sanctum: "Kael", affinity: "STONE", level: 10 },
    { icon: "💧", name: "Emblema Marea", sanctum: "Lyra", affinity: "TIDE", level: 15 },
    { icon: "⚡", name: "Emblema Tormenta", sanctum: "Zeph", affinity: "VOLT", level: 20 },
    { icon: "🌿", name: "Emblema Bosque", sanctum: "Mira", affinity: "GROVE", level: 25 },
    { icon: "☠️", name: "Emblema Veneno", sanctum: "Voss", affinity: "VENOM", level: 30 },
    { icon: "✨", name: "Emblema Astral", sanctum: "Sable", affinity: "ASTRAL", level: 35 },
    { icon: "🔥", name: "Emblema Brasas", sanctum: "Ryn", affinity: "EMBER", level: 40 },
    { icon: "🌑", name: "Emblema Sombra", sanctum: "Nox", affinity: "SHADE", level: 50 },
];

const AVATAR_EMOJI: Record<string, string> = {
    male_1: "👦",
    male_2: "🧑",
    male_3: "👨",
    male_4: "🧔",
    female_1: "👧",
    female_2: "👩",
    female_3: "🧕",
    female_4: "👱‍♀️",
};

const AFFINITY_COLORS: Record<string, string> = {
    EMBER: "#ff6b35",
    TIDE: "#4cc9f0",
    GROVE: "#06d6a0",
    VOLT: "#ffd60a",
    STONE: "#adb5bd",
    FROST: "#a8dadc",
    VENOM: "#7b2fff",
    ASTRAL: "#e040fb",
    SHADE: "#e63946",
    IRON: "#90a4ae",
};

const RARITY_COLORS: Record<string, string> = {
    COMMON: "#9ca3af",
    RARE: "#4cc9f0",
    ELITE: "#ffd60a",
    LEGENDARY: "#e63946",
    MYTHIC: "#a78bfa",
};

const RARITY_LABELS: Record<string, string> = {
    COMMON: "Común",
    RARE: "Rara",
    ELITE: "Élite",
    LEGENDARY: "Legendaria",
    MYTHIC: "Mítica",
};

const RANK_LABELS = ["Novato", "Binder", "Rival", "Élite", "Maestro"];
const RANK_COLORS = ["#5a6a85", "#4cc9f0", "#e63946", "#7b2fff", "#ffd60a"];
const RANK_THRESHOLDS = [0, 100, 300, 600, 1000];

function StatRow({ label, value, color = "#fff" }: { label: string; value: string | number; color?: string }) {
    return (
        <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
            <span className="text-muted text-xs font-display tracking-wide">{label}</span>
            <span className="font-display font-bold text-sm" style={{ color }}>
                {value}
            </span>
        </div>
    );
}

function RarityBar({ rarity, count, total }: { rarity: string; count: number; total: number }) {
    const pct = total > 0 ? Math.max(4, Math.round((count / total) * 100)) : 4;
    const color = RARITY_COLORS[rarity] ?? "#4cc9f0";
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs font-display w-20 text-right flex-shrink-0" style={{ color }}>
                {RARITY_LABELS[rarity]}
            </span>
            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}60` }}
                />
            </div>
            <span className="text-xs font-display font-bold w-6 flex-shrink-0" style={{ color }}>
                {count}
            </span>
        </div>
    );
}

export default function PerfilPage() {
    const { user } = useAuth();
    const [trainer, setTrainer] = useState<any>(null);
    const [party, setParty] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);

    useEffect(() => {
        Promise.all([api.trainer(), api.party(), api.battleStats()]).then(([t, p, s]) => {
            setTrainer(t);
            setParty(p);
            setStats(s);
        });
    }, []);

    const xpForLevel = (lvl: number) => Math.floor(100 * Math.pow(lvl, 1.8));
    const xpPct = trainer ? Math.min(100, Math.round((trainer.xp / xpForLevel(trainer.level)) * 100)) : 0;
    const rankIdx = trainer ? RANK_THRESHOLDS.filter((t) => trainer.prestige >= t).length - 1 : 0;
    const totalCombats = (stats?.npcWins ?? 0) + (stats?.npcLosses ?? 0);
    const winRate = totalCombats > 0 ? Math.round(((stats?.npcWins ?? 0) / totalCombats) * 100) : 0;
    const totalByRarity = stats
        ? Object.values(stats.byRarity as Record<string, number>).reduce((a: number, b: number) => a + b, 0)
        : 0;

    return (
        <Layout sidebar={<TrainerSidebar />}>
            {/* Banner */}
            <div
                className="flex-shrink-0 px-6 py-4 border-b border-border relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #0d1525, #111d35)" }}
            >
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(ellipse 60% 100% at 90% 50%, rgba(123,47,255,0.15) 0%, transparent 60%)",
                    }}
                />
                <div className="relative flex items-center gap-5">
                    <div
                        className="w-14 h-14 rounded-full flex items-center justify-center text-3xl flex-shrink-0"
                        style={{
                            background: "linear-gradient(135deg,#7b2fff,#4cc9f0)",
                            boxShadow: "0 0 20px rgba(76,201,240,0.3)",
                        }}
                    >
                        {AVATAR_EMOJI[trainer?.avatar] ?? "🧙"}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-display font-bold text-2xl">{user?.username}</div>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-muted text-sm">Nivel {trainer?.level ?? 1}</span>
                            <span
                                className="text-xs px-2 py-0.5 rounded-full border font-display font-semibold"
                                style={{
                                    borderColor: `${RANK_COLORS[rankIdx]}44`,
                                    color: RANK_COLORS[rankIdx],
                                    background: `${RANK_COLORS[rankIdx]}15`,
                                }}
                            >
                                {RANK_LABELS[rankIdx]}
                            </span>
                        </div>
                        <div className="mt-2 max-w-xs">
                            <div className="bg-white/5 rounded-full h-1.5 overflow-hidden mb-0.5">
                                <div
                                    className="h-full rounded-full"
                                    style={{ width: `${xpPct}%`, background: "linear-gradient(90deg,#4cc9f0,#7b2fff)" }}
                                />
                            </div>
                            <div className="text-xs text-muted">
                                {trainer?.xp ?? 0} / {xpForLevel(trainer?.level ?? 1)} XP
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-6 text-center flex-shrink-0">
                        <div>
                            <div className="font-display font-bold text-xl text-yellow">{trainer?.coins ?? 0}</div>
                            <div className="text-xs text-muted">Monedas</div>
                        </div>
                        <div>
                            <div className="font-display font-bold text-xl" style={{ color: "#a78bfa" }}>
                                {trainer?.prestige ?? 0}
                            </div>
                            <div className="text-xs text-muted">Prestigio</div>
                        </div>
                        <div>
                            <div className="font-display font-bold text-xl text-blue">
                                {trainer?.medals?.length ?? 0}/8
                            </div>
                            <div className="text-xs text-muted">Emblemas</div>
                        </div>
                        <div>
                            <div className="font-display font-bold text-xl text-green">{stats?.totalMyths ?? 0}</div>
                            <div className="text-xs text-muted">Myths</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Cuerpo — 3 columnas */}
            <div className="flex-1 flex gap-4 p-6 overflow-hidden">
                {/* Columna 1 — Emblemas */}
                <div className="w-52 flex-shrink-0 bg-card border border-border rounded-2xl p-5 flex flex-col overflow-hidden">
                    <div className="font-display font-bold text-sm tracking-widest uppercase mb-4 flex-shrink-0 text-white">
                        🏅 Emblemas
                    </div>
                    <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                        {EMBLEM_INFO.map((emblem, i) => {
                            const earned = trainer?.medals?.includes(i);
                            return (
                                <div
                                    key={i}
                                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2 border transition-all ${
                                        earned ? "border-yellow/30 bg-yellow/5" : "border-border/30 opacity-40"
                                    }`}
                                >
                                    <span className={`text-xl flex-shrink-0 ${earned ? "" : "grayscale"}`}>
                                        {emblem.icon}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div
                                            className="font-display font-bold text-xs truncate"
                                            style={{ color: earned ? "#ffd60a" : "#5a6a85" }}
                                        >
                                            {emblem.sanctum}
                                        </div>
                                        <div className="text-muted text-xs truncate">
                                            {earned ? "✓ Conseguido" : `Nv. ${emblem.level}`}
                                        </div>
                                    </div>
                                    {earned && (
                                        <div
                                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                            style={{ background: "#ffd60a", boxShadow: "0 0 6px #ffd60a" }}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Columna 2 — Estadísticas */}
                <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                    {/* Combate */}
                    <div className="bg-card border border-border rounded-2xl p-5 flex-shrink-0">
                        <div className="font-display font-bold text-sm tracking-widest uppercase mb-3 text-white">
                            ⚔️ Combate
                        </div>
                        <div className="grid grid-cols-2 gap-x-6">
                            <div>
                                <StatRow label="Victorias NPC" value={stats?.npcWins ?? 0} color="#06d6a0" />
                                <StatRow label="Derrotas NPC" value={stats?.npcLosses ?? 0} color="#e63946" />
                                <StatRow label="Tasa de victoria" value={`${winRate}%`} color="#4cc9f0" />
                            </div>
                            <div>
                                <StatRow label="Victorias PvP" value={stats?.pvpWins ?? 0} color="#06d6a0" />
                                <StatRow label="Derrotas PvP" value={stats?.pvpLosses ?? 0} color="#e63946" />
                                <StatRow label="Myths capturados" value={stats?.captured ?? 0} color="#ffd60a" />
                            </div>
                        </div>
                        {/* Barra win rate */}
                        <div className="mt-3 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{
                                    width: `${winRate}%`,
                                    background: "linear-gradient(90deg, #06d6a0, #4cc9f0)",
                                    boxShadow: "0 0 8px rgba(6,214,160,0.4)",
                                }}
                            />
                        </div>
                    </div>

                    {/* Colección */}
                    <div className="bg-card border border-border rounded-2xl p-5 flex-1 overflow-hidden flex flex-col">
                        <div className="font-display font-bold text-sm tracking-widest uppercase mb-4 text-white flex-shrink-0">
                            📖 Colección — {stats?.totalMyths ?? 0} Myths
                        </div>
                        <div className="flex flex-col gap-3 flex-1 justify-center">
                            {["COMMON", "RARE", "ELITE", "LEGENDARY", "MYTHIC"].map((r) => (
                                <RarityBar key={r} rarity={r} count={stats?.byRarity?.[r] ?? 0} total={totalByRarity} />
                            ))}
                        </div>
                        <div className="mt-4 flex gap-4 pt-3 border-t border-border/30 flex-shrink-0">
                            <StatRow label="XP total ganada" value={stats?.totalXp ?? 0} color="#4cc9f0" />
                        </div>
                    </div>
                </div>

                {/* Columna 3 — Equipo */}
                <div className="w-64 flex-shrink-0 bg-card border border-border rounded-2xl p-5 flex flex-col overflow-hidden">
                    <div className="font-display font-bold text-sm tracking-widest uppercase mb-4 flex-shrink-0 text-white">
                        🐾 Equipo
                    </div>
                    {party.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-muted text-sm text-center font-display tracking-widest">
                            Sin Myths en el equipo
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
                            {party.map((p: any) => (
                                <div key={p.id} className="bg-bg3 rounded-xl p-3 border border-border/40">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="text-3xl flex-shrink-0">{p.art?.front ?? "❓"}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-display font-bold text-sm truncate">
                                                {p.name ?? p.speciesId}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-muted text-xs">Nv. {p.level}</span>
                                                {(p.affinities ?? []).map((aff: string) => (
                                                    <span
                                                        key={aff}
                                                        className="text-xs px-1.5 py-0 rounded font-display font-semibold"
                                                        style={{
                                                            color: AFFINITY_COLORS[aff] ?? "#4cc9f0",
                                                            background: `${AFFINITY_COLORS[aff] ?? "#4cc9f0"}20`,
                                                        }}
                                                    >
                                                        {aff.slice(0, 2)}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs text-muted">
                                        <span>
                                            HP{" "}
                                            <span className="text-blue font-bold">
                                                {p.hp}/{p.maxHp}
                                            </span>
                                        </span>
                                        <span>
                                            ATQ <span className="text-red font-bold">{p.attack}</span>
                                        </span>
                                        <span>
                                            DEF <span className="text-green font-bold">{p.defense}</span>
                                        </span>
                                        <span>
                                            VEL <span className="text-yellow font-bold">{p.speed}</span>
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}
