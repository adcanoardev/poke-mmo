import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import TrainerSidebar from "../components/TrainerSidebar";
import { api } from "../lib/api";
import { useTrainer } from "../context/TrainerContext";
import { useToast } from "../components/Layout";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

type Affinity = "EMBER" | "TIDE" | "GROVE" | "VOLT" | "STONE" | "FROST" | "VENOM" | "ASTRAL" | "IRON" | "SHADE";
type StatusEffect = "burn" | "poison" | "freeze" | "fear" | "paralyze" | "stun" | "curse" | null;
type MoveType = "physical" | "special" | "support";

interface Buff {
    type?: string;
    stat?: "atk" | "def" | "spd" | "acc";
    multiplier: number;
    turnsLeft: number;
    emoji: string;
    label?: string;
}

interface Move {
    id: string;
    name: string;
    affinity: Affinity;
    type: MoveType;
    power: number;
    accuracy: number;
    cooldown: number;
    description: string;
    effect: any;
}

interface BattleMyth {
    instanceId: string;
    speciesId: string;
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    affinities: Affinity[];
    moves: Move[];
    art: { portrait: string; front: string; back: string };
    status: StatusEffect;
    statusTurnsLeft: number;
    cooldownsLeft: Record<string, number>;
    buffs: Buff[];
    shield?: number;
    silenced?: number;
    defeated: boolean;
}

interface BattleSession {
    battleId: string;
    playerTeam: BattleMyth[];
    enemyTeam: BattleMyth[];
    turn: number;
    turnQueue: string[];
    currentQueueIndex: number;
    status: "ongoing" | "win" | "lose";
}

function cloneSession(s: any): BattleSession {
    return JSON.parse(JSON.stringify(s));
}

const STATUS_ICONS: Record<string, string> = {
    burn: "🔥",
    poison: "☠️",
    freeze: "❄️",
    fear: "😨",
    paralyze: "⚡",
    stun: "💫",
    curse: "💀",
};

// ─────────────────────────────────────────
// Affinity config
// ─────────────────────────────────────────

const AFFINITY_CONFIG: Record<
    Affinity,
    {
        color: string;
        bg: string;
        glow: string;
        glowRgb: string;
        emoji: string;
        label: string;
        projEmoji: string;
    }
> = {
    EMBER: {
        color: "text-orange-400",
        bg: "bg-orange-500/20",
        glow: "#f97316",
        glowRgb: "249,115,22",
        emoji: "🔥",
        label: "Brasa",
        projEmoji: "🔥",
    },
    TIDE: {
        color: "text-blue-400",
        bg: "bg-blue-500/20",
        glow: "#3b82f6",
        glowRgb: "59,130,246",
        emoji: "🌊",
        label: "Marea",
        projEmoji: "💧",
    },
    GROVE: {
        color: "text-green-400",
        bg: "bg-green-500/20",
        glow: "#22c55e",
        glowRgb: "34,197,94",
        emoji: "🌿",
        label: "Bosque",
        projEmoji: "🍃",
    },
    VOLT: {
        color: "text-yellow-300",
        bg: "bg-yellow-400/20",
        glow: "#fde047",
        glowRgb: "253,224,71",
        emoji: "⚡",
        label: "Voltio",
        projEmoji: "⚡",
    },
    STONE: {
        color: "text-stone-400",
        bg: "bg-stone-500/20",
        glow: "#a8a29e",
        glowRgb: "168,162,158",
        emoji: "🪨",
        label: "Piedra",
        projEmoji: "🪨",
    },
    FROST: {
        color: "text-cyan-300",
        bg: "bg-cyan-500/20",
        glow: "#67e8f9",
        glowRgb: "103,232,249",
        emoji: "❄️",
        label: "Escarcha",
        projEmoji: "❄️",
    },
    VENOM: {
        color: "text-purple-400",
        bg: "bg-purple-500/20",
        glow: "#a855f7",
        glowRgb: "168,85,247",
        emoji: "🧪",
        label: "Veneno",
        projEmoji: "☠️",
    },
    ASTRAL: {
        color: "text-indigo-300",
        bg: "bg-indigo-500/20",
        glow: "#818cf8",
        glowRgb: "129,140,248",
        emoji: "✨",
        label: "Astral",
        projEmoji: "✨",
    },
    IRON: {
        color: "text-slate-300",
        bg: "bg-slate-500/20",
        glow: "#94a3b8",
        glowRgb: "148,163,184",
        emoji: "⚙️",
        label: "Hierro",
        projEmoji: "⚙️",
    },
    SHADE: {
        color: "text-violet-400",
        bg: "bg-violet-700/20",
        glow: "#7c3aed",
        glowRgb: "124,58,237",
        emoji: "🌑",
        label: "Sombra",
        projEmoji: "🌑",
    },
};

// ─────────────────────────────────────────
// MythArt — imagen o emoji
// ─────────────────────────────────────────

function MythArt({
    art,
    px,
    className = "",
}: {
    art?: { front?: string; portrait?: string; back?: string };
    px: number;
    className?: string;
}) {
    const src = art?.front || art?.portrait || "";
    if (src.startsWith("http")) {
        return (
            <img
                src={src}
                alt=""
                className={`object-contain drop-shadow-lg ${className}`}
                style={{ width: px, height: px }}
            />
        );
    }
    return (
        <span style={{ fontSize: px * 0.6 }} className={className}>
            {src || "❓"}
        </span>
    );
}

// ─────────────────────────────────────────
// HP Bar
// ─────────────────────────────────────────

function HpBar({ hp, maxHp, shield = 0 }: { hp: number; maxHp: number; shield?: number }) {
    const pct = maxHp > 0 ? Math.max(0, (hp / maxHp) * 100) : 0;
    const shieldPct = maxHp > 0 ? Math.min(100 - pct, (shield / maxHp) * 100) : 0;
    const color = pct > 50 ? "bg-emerald-400" : pct > 25 ? "bg-yellow-400" : "bg-red-500";
    return (
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex">
            <div
                className={`h-full rounded-l-full ${color} transition-all duration-700`}
                style={{ width: `${pct}%` }}
            />
            {shieldPct > 0 && (
                <div className="h-full bg-blue-400/70 transition-all duration-700" style={{ width: `${shieldPct}%` }} />
            )}
        </div>
    );
}

// ─────────────────────────────────────────
// Projectile
// ─────────────────────────────────────────

interface ProjectileState {
    affinity: Affinity;
    direction: "ltr" | "rtl";
}

function Projectile({ proj }: { proj: ProjectileState }) {
    const cfg = AFFINITY_CONFIG[proj.affinity];
    return (
        <div
            className={`absolute top-1/2 z-50 pointer-events-none text-3xl
                ${proj.direction === "ltr" ? "animate-proj-ltr left-8" : "animate-proj-rtl right-8"}`}
            style={{ filter: `drop-shadow(0 0 10px ${cfg.glow}) drop-shadow(0 0 20px ${cfg.glow})` }}
        >
            {cfg.projEmoji}
        </div>
    );
}

// ─────────────────────────────────────────
// Arena Myth — versión estilo Pokémon (sin borde de carta)
// ─────────────────────────────────────────

interface ArenaMythProps {
    myth: BattleMyth;
    side: "player" | "enemy"; // player = back view, enemy = front view
    isActing?: boolean;
    targeted?: boolean;
    flashAffinity?: Affinity | null;
    floatingDmg?: { value: number; crit: boolean; mult: number; heal?: boolean } | null;
    onClick?: () => void;
    spriteSize?: number;
}

function ArenaMyth({
    myth,
    side,
    isActing,
    targeted,
    flashAffinity,
    floatingDmg,
    onClick,
    spriteSize = 80,
}: ArenaMythProps) {
    const cfg = flashAffinity ? AFFINITY_CONFIG[flashAffinity] : null;
    const canClick = onClick && !myth.defeated;
    const primaryAffinity = myth.affinities?.[0];
    const afCfg = primaryAffinity ? AFFINITY_CONFIG[primaryAffinity] : null;

    return (
        <div
            className={`relative flex flex-col items-center gap-1 select-none ${canClick ? "cursor-pointer" : ""}`}
            onClick={canClick ? onClick : undefined}
        >
            {/* Daño / curación flotante */}
            {floatingDmg && (
                <div
                    className={`absolute z-30 font-black text-base pointer-events-none animate-float-dmg
                        ${floatingDmg.heal ? "text-emerald-400" : floatingDmg.crit ? "text-yellow-300" : floatingDmg.mult >= 2 ? "text-orange-400" : floatingDmg.mult <= 0.5 ? "text-blue-300" : "text-white"}`}
                    style={{ top: -28, left: "50%", transform: "translateX(-50%)" }}
                >
                    {floatingDmg.heal
                        ? `+${floatingDmg.value}`
                        : floatingDmg.value > 0
                          ? `-${floatingDmg.value}`
                          : "¡Fallo!"}
                    {floatingDmg.crit && !floatingDmg.heal && <span className="text-xs ml-0.5">!</span>}
                </div>
            )}

            {/* Sprite container — sin borde */}
            <div className="relative flex items-end justify-center" style={{ width: spriteSize, height: spriteSize }}>
                {/* Flash de impacto */}
                {cfg && (
                    <div
                        className="absolute inset-0 rounded-full animate-impact-flash pointer-events-none"
                        style={{ background: `radial-gradient(circle, ${cfg.glow}66 0%, transparent 70%)` }}
                    />
                )}

                {/* Glow del actor activo */}
                {isActing && !myth.defeated && (
                    <div
                        className="absolute inset-0 rounded-full animate-pulse pointer-events-none"
                        style={{
                            background: afCfg
                                ? `radial-gradient(circle, ${afCfg.glow}33 0%, transparent 70%)`
                                : undefined,
                        }}
                    />
                )}

                {/* Target ring */}
                {targeted && !myth.defeated && (
                    <div className="absolute inset-0 rounded-full border-2 border-red-400/60 animate-pulse pointer-events-none" />
                )}

                {myth.defeated ? (
                    <span className="text-4xl opacity-30">💀</span>
                ) : (
                    <MythArt
                        art={
                            side === "player"
                                ? { front: myth.art?.back || myth.art?.front, portrait: myth.art?.portrait }
                                : myth.art
                        }
                        px={spriteSize}
                        className={[
                            cfg ? "animate-myth-shake" : isActing ? "animate-myth-idle" : "",
                            myth.status ? `aura-${myth.status}` : "",
                        ]
                            .filter(Boolean)
                            .join(" ")}
                    />
                )}

                {/* Estado alterado — esquina superior derecha */}
                {myth.status && !myth.defeated && (
                    <span className="absolute -top-1 -right-1 text-sm z-20 drop-shadow">
                        {STATUS_ICONS[myth.status] ?? "⚠️"}
                    </span>
                )}

                {/* Escudo */}
                {(myth.shield ?? 0) > 0 && !myth.defeated && (
                    <span className="absolute -top-1 -left-1 text-sm z-20">🛡️</span>
                )}
            </div>

            {/* Sombra elíptica debajo del sprite */}
            {!myth.defeated && (
                <div
                    className="rounded-full opacity-20 bg-black"
                    style={{ width: spriteSize * 0.7, height: 8, marginTop: -4, filter: "blur(4px)" }}
                />
            )}

            {/* Info: nombre + HP — compacto */}
            <div className="flex flex-col items-center gap-0.5" style={{ width: Math.max(spriteSize, 72) }}>
                <div className="flex items-center gap-1 justify-center">
                    {isActing && !myth.defeated && <span className="text-yellow-400 text-xs animate-pulse">▶</span>}
                    <p
                        className={`text-xs font-bold truncate font-mono text-center
                        ${myth.defeated ? "text-slate-600" : isActing ? "text-yellow-300" : targeted ? "text-red-400" : "text-white"}`}
                        style={{ maxWidth: Math.max(spriteSize, 72) }}
                    >
                        {myth.name}
                    </p>
                </div>

                {!myth.defeated && (
                    <>
                        <HpBar hp={myth.hp} maxHp={myth.maxHp} shield={myth.shield} />
                        <p className="text-slate-500 text-[10px] font-mono tabular-nums">
                            {myth.hp}
                            <span className="text-slate-700">/{myth.maxHp}</span>
                        </p>
                    </>
                )}

                {/* Buffs activos */}
                {!myth.defeated && myth.buffs && myth.buffs.length > 0 && (
                    <div className="flex gap-0.5 flex-wrap justify-center">
                        {myth.buffs.slice(0, 4).map((b, i) => (
                            <span
                                key={i}
                                className="text-xs"
                                title={`${b.label ?? b.stat?.toUpperCase() ?? ""} ×${b.multiplier.toFixed(1)} (${b.turnsLeft}t)`}
                            >
                                {b.emoji}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────
// Prep screen
// ─────────────────────────────────────────

function PrepScreen({
    myths,
    onStart,
    loading,
}: {
    myths: any[];
    onStart: (order: string[]) => void;
    loading: boolean;
}) {
    const [slots, setSlots] = useState<(any | null)[]>([null, null, null]);
    const [bench, setBench] = useState<any[]>([]);
    const [ready, setReady] = useState(false);
    const dragRef = useRef<{ myth: any; from: "slot" | "bench"; slotIdx: number } | null>(null);

    useEffect(() => {
        if (myths.length > 0 && !ready) {
            setBench(myths);
            setReady(true);
        }
    }, [myths, ready]);

    const mythId = (m: any): string => m.id ?? m.instanceId ?? "";

    const handleDragStart = (myth: any, from: "slot" | "bench", slotIdx: number) => {
        dragRef.current = { myth, from, slotIdx };
    };

    const handleDropSlot = (idx: number) => {
        if (!dragRef.current) return;
        const { myth, from, slotIdx } = dragRef.current;
        const ns = [...slots];
        const nb = [...bench];
        if (from === "bench") {
            const displaced = ns[idx];
            ns[idx] = myth;
            if (displaced) nb.push(displaced);
            setBench(nb.filter((m) => mythId(m) !== mythId(myth)));
        } else {
            const tmp = ns[idx];
            ns[idx] = myth;
            ns[slotIdx] = tmp;
        }
        setSlots(ns);
        dragRef.current = null;
    };

    const handleDropBench = () => {
        if (!dragRef.current || dragRef.current.from !== "slot") {
            dragRef.current = null;
            return;
        }
        const { myth, slotIdx } = dragRef.current;
        const ns = [...slots];
        ns[slotIdx] = null;
        setSlots(ns);
        setBench((b) => [...b, myth]);
        dragRef.current = null;
    };

    const order = slots.filter(Boolean).map(mythId);
    const canStart = order.length >= 1;
    const partyMyths = bench.filter((m) => m.isInParty);
    const storeMyths = bench.filter((m) => !m.isInParty);

    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 overflow-auto">
            <div className="text-center">
                <h2 className="font-mono text-xl font-black tracking-widest text-yellow-400 uppercase">
                    ⚔️ Preparación
                </h2>
                <p className="text-slate-400 text-sm mt-1">Arrastra hasta 3 Myths a los slots para combatir</p>
            </div>

            <div className="flex gap-4">
                {slots.map((myth, i) => (
                    <div
                        key={i}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => handleDropSlot(i)}
                        className={`w-24 h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-all
                            ${myth ? "border-blue-500/60 bg-blue-500/5" : "border-slate-700 bg-slate-800/30 hover:border-slate-500"}`}
                    >
                        {myth ? (
                            <div
                                draggable
                                onDragStart={() => handleDragStart(myth, "slot", i)}
                                className="flex flex-col items-center gap-1 cursor-grab px-2 w-full"
                            >
                                <MythArt art={myth.art} px={48} />
                                <p className="font-mono text-xs text-white font-bold truncate w-full text-center">
                                    {myth.name}
                                </p>
                                <p className="text-slate-400 text-xs font-mono">Nv.{myth.level}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-1 opacity-25">
                                <span className="text-2xl">＋</span>
                                <p className="font-mono text-xs text-slate-500">Slot {i + 1}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div className="w-full max-w-2xl" onDragOver={(e) => e.preventDefault()} onDrop={handleDropBench}>
                <p className="font-mono text-xs text-slate-500 uppercase tracking-widest mb-2 text-center">
                    — Myths disponibles —
                </p>
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 min-h-20">
                    {bench.length === 0 && (
                        <p className="text-slate-600 text-xs text-center font-mono">
                            Todos los Myths en posición de combate
                        </p>
                    )}
                    {partyMyths.length > 0 && (
                        <div className="mb-3">
                            <p className="font-mono text-xs text-slate-500 uppercase tracking-widest mb-2">⚔️ Equipo</p>
                            <div className="flex flex-wrap gap-2">
                                {partyMyths.map((m) => (
                                    <BenchCard key={mythId(m)} myth={m} onDragStart={handleDragStart} />
                                ))}
                            </div>
                        </div>
                    )}
                    {storeMyths.length > 0 && (
                        <div>
                            <p className="font-mono text-xs text-slate-500 uppercase tracking-widest mb-2">
                                📦 Almacén
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {storeMyths.map((m) => (
                                    <BenchCard key={mythId(m)} myth={m} onDragStart={handleDragStart} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <button
                onClick={() => canStart && onStart(order)}
                disabled={!canStart || loading}
                className={`px-12 py-3 rounded-xl font-mono font-black text-sm tracking-widest uppercase transition-all
                    ${canStart && !loading ? "bg-red-600 text-white hover:bg-red-500 hover:scale-105 shadow-lg shadow-red-900/50" : "bg-slate-800 text-slate-600 cursor-not-allowed"}`}
            >
                {loading ? "Iniciando..." : `⚔️ Combatir (${order.length} Myth${order.length !== 1 ? "s" : ""})`}
            </button>
        </div>
    );
}

function BenchCard({ myth, onDragStart }: { myth: any; onDragStart: (m: any, from: "bench", idx: number) => void }) {
    const mythId = (m: any) => m.id ?? m.instanceId ?? "";
    return (
        <div
            draggable
            onDragStart={() => onDragStart(myth, "bench", -1)}
            className="flex flex-col items-center gap-1 w-20 cursor-grab active:cursor-grabbing p-2 rounded-lg border border-slate-700 bg-slate-800/60 hover:border-slate-500 transition-all select-none"
        >
            <MythArt art={myth.art} px={40} />
            <p className="font-mono text-xs text-white font-bold truncate w-full text-center">{myth.name}</p>
            <p className="text-slate-500 text-xs font-mono">Nv.{myth.level}</p>
            <span className={`text-xs font-mono ${myth.isInParty ? "text-blue-400" : "text-slate-500"}`}>
                {myth.isInParty ? "equipo" : "almacén"}
            </span>
        </div>
    );
}

// ─────────────────────────────────────────
// Main BattlePage
// ─────────────────────────────────────────

type Phase = "prep" | "battle" | "result";
type BattleMode = "npc" | "pvp";

export default function BattlePage() {
    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);
    const initialMode: BattleMode =
        (location.state as any)?.mode === "pvp" || searchParams.get("mode") === "pvp" ? "pvp" : "npc";
    const [mode, setMode] = useState<BattleMode>(initialMode);

    useEffect(() => {
        const m = (location.state as any)?.mode;
        if (m === "pvp" || m === "npc") setMode(m);
    }, [location.state]);

    const [phase, setPhase] = useState<Phase>("prep");
    const [allMyths, setAllMyths] = useState<any[]>([]);
    const [session, setSession] = useState<BattleSession | null>(null);
    const [loadingStart, setLoadingStart] = useState(false);
    const [animating, setAnimating] = useState(false);

    const [currentActorId, setCurrentActorId] = useState<string | null>(null);
    const [targetEnemyMythId, setTargetEnemyMythId] = useState<string | null>(null);
    const [timer, setTimer] = useState<number>(15);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [projectile, setProjectile] = useState<ProjectileState | null>(null);
    const [flashMap, setFlashMap] = useState<Record<string, Affinity>>({});
    const [floatMap, setFloatMap] = useState<
        Record<string, { value: number; crit: boolean; mult: number; heal?: boolean }>
    >({});

    const [log, setLog] = useState<{ text: string; type: string }[]>([]);
    const logRef = useRef<HTMLDivElement>(null);
    const [result, setResult] = useState<{ status: "win" | "lose"; xp?: number; coins?: number } | null>(null);
    const { reload } = useTrainer();
    const { toast } = useToast();

    useEffect(() => {
        api.creatures()
            .then((d) => setAllMyths(d ?? []))
            .catch(() => {});
        api.battleNpcActive()
            .then((s: any) => {
                if (s?.status === "ongoing") {
                    const cloned = cloneSession(s);
                    setSession(cloned);
                    setPhase("battle");
                    initTurn(cloned);
                }
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        api.creatures()
            .then((d) => setAllMyths(d ?? []))
            .catch(() => {});
        api.battleNpcActive()
            .then(async (s: any) => {
                if (s?.status === "ongoing") {
                    const cloned = cloneSession(s);
                    setSession(cloned);
                    setPhase("battle");
                    const { actorId, isPlayer } = initTurn(cloned);
                    if (!isPlayer && actorId) {
                        await sleep(800);
                        setAnimating(true);
                        try {
                            await handleNpcTurn(cloned, actorId);
                        } finally {
                            setAnimating(false);
                        }
                    }
                }
            })
            .catch(() => {});
    }, []);

    function initTurn(s: BattleSession): { actorId: string | null; isPlayer: boolean } {
        const actorId = s.turnQueue?.[s.currentQueueIndex ?? 0] ?? null;
        setCurrentActorId(actorId);
        const isPlayer = s.playerTeam.some((m) => m.instanceId === actorId);
        if (isPlayer) {
            const firstEnemy = s.enemyTeam.find((m) => !m.defeated);
            if (firstEnemy) setTargetEnemyMythId(firstEnemy.instanceId);
        }
        return { actorId, isPlayer };
    }

    const currentActorIsPlayer = session?.playerTeam.some((m) => m.instanceId === currentActorId) ?? false;

    // Timer — solo turno del jugador
    useEffect(() => {
        if (phase !== "battle" || animating || !currentActorIsPlayer) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }
        setTimer(15);
        timerRef.current = setInterval(() => {
            setTimer((t) => {
                if (t <= 1) {
                    clearInterval(timerRef.current!);
                    handleTimerExpired();
                    return 0;
                }
                return t - 1;
            });
        }, 1000);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current!);
        };
    }, [currentActorId, phase, animating]);

    function handleTimerExpired() {
        if (!session) return;
        const actor = session.playerTeam.find((m) => m.instanceId === currentActorId);
        if (!actor) return;
        const basicMove =
            actor.moves
                .filter((mv) => mv.power > 0 && !(actor.cooldownsLeft?.[mv.id] > 0))
                .sort((a, b) => a.cooldown - b.cooldown)[0] ?? actor.moves[0];
        const firstEnemy = session.enemyTeam.find((m) => !m.defeated);
        if (!basicMove || !firstEnemy) return;
        handleMove(basicMove.id, firstEnemy.instanceId);
    }

    function addLog(text: string, type = "normal") {
        setLog((l) => [...l.slice(-50), { text, type }]);
    }

    function sleep(ms: number) {
        return new Promise<void>((r) => setTimeout(r, ms));
    }

    async function flashAndFloat(
        instanceId: string,
        affinity: Affinity,
        dmg: number,
        crit: boolean,
        mult: number,
        heal = false,
    ) {
        setFlashMap((m) => ({ ...m, [instanceId]: affinity }));
        setFloatMap((m) => ({ ...m, [instanceId]: { value: dmg, crit, mult, heal } }));
        await sleep(600);
        setFlashMap((m) => {
            const n = { ...m };
            delete n[instanceId];
            return n;
        });
        await sleep(400);
        setFloatMap((m) => {
            const n = { ...m };
            delete n[instanceId];
            return n;
        });
    }

    // Lógica de animación compartida entre turno jugador y NPC
    async function animateTurnAction(action: any) {
        const direction = action.isPlayerMyth ? "ltr" : "rtl";
        if (action.blockedByStatus) {
            addLog(action.blockedByStatus, "status");
        } else {
            const logPrefix = action.isPlayerMyth ? "" : "👾 ";
            addLog(`${logPrefix}${action.actorName} usa ${action.move} → ${action.targetName}`, "normal");
            setProjectile({ affinity: action.moveAffinity as Affinity, direction });
            await sleep(480);
            setProjectile(null);
            await sleep(80);

            if (action.targetInstanceId && action.damage > 0) {
                await flashAndFloat(
                    action.targetInstanceId,
                    action.moveAffinity,
                    action.damage,
                    action.crit,
                    action.mult,
                );
            } else if (action.missed) {
                addLog("¡Falló!", "miss");
            }

            if (action.mult >= 2) addLog(`⚡ ¡Súper eficaz! ×${action.mult}`, action.isPlayerMyth ? "good" : "bad");
            else if (action.mult > 0 && action.mult < 1)
                addLog(`💤 Poco eficaz ×${action.mult}`, action.isPlayerMyth ? "bad" : "good");
            if (action.crit) addLog("💥 ¡Golpe crítico!", "crit");

            if (action.statusApplied) {
                const icon = STATUS_ICONS[action.statusApplied] ?? "⚠️";
                addLog(`${icon} ¡${action.targetName} afectado por ${action.statusApplied}!`, "status");
            }
            if (action.buffApplied) {
                const label = action.buffApplied.label ?? action.buffApplied.stat?.toUpperCase() ?? "";
                addLog(
                    `${action.buffApplied.emoji} ${action.actorName} ${label}`,
                    action.isPlayerMyth ? "good" : "bad",
                );
            }
            if (action.healAmount && action.healAmount > 0) {
                await flashAndFloat(action.actorInstanceId, action.moveAffinity, action.healAmount, false, 1, true);
                addLog(`💚 ${action.actorName} recupera ${action.healAmount} HP`, "heal");
            }
            if (action.effectMsgs?.length) {
                for (const msg of action.effectMsgs) addLog(msg, "status");
            }
        }

        if (action.statusTickDamage && action.statusTickDamage > 0) {
            await sleep(300);
            await flashAndFloat(action.actorInstanceId, action.moveAffinity, action.statusTickDamage, false, 1);
            addLog(action.statusTickMsg ?? `${action.actorName} sufre daño por estado`, "status");
        }
    }

    function finalizeTurn(
        newSession: BattleSession,
        nextActorId: string | null,
        nextActorIsPlayer: boolean,
        xpGained?: number,
        coinsGained?: number,
    ) {
        setSession(newSession);
        if (newSession.status === "win" || newSession.status === "lose") {
            addLog(
                newSession.status === "win" ? "🏆 ¡Victoria!" : "💀 Derrota...",
                newSession.status === "win" ? "good" : "bad",
            );
            setResult({ status: newSession.status, xp: xpGained, coins: coinsGained });
            setPhase("result");
            window.dispatchEvent(new Event("sidebar:reload"));
            return true; // combate terminado
        }
        setCurrentActorId(nextActorId);
        if (nextActorIsPlayer) {
            setTargetEnemyMythId((prev) => {
                const stillAlive = newSession.enemyTeam.find((m) => m.instanceId === prev && !m.defeated);
                return stillAlive ? prev : (newSession.enemyTeam.find((m) => !m.defeated)?.instanceId ?? null);
            });
        }
        return false;
    }

    async function handleMove(moveId: string, forcedTargetId?: string) {
        if (!session || animating) return;
        if (timerRef.current) clearInterval(timerRef.current);
        const resolvedTarget = forcedTargetId ?? targetEnemyMythId ?? undefined;
        setAnimating(true);
        try {
            const res = await api.battleNpcTurn(session.battleId, moveId, resolvedTarget);
            const { session: rawSession, action, nextActorId, nextActorIsPlayer, xpGained, coinsGained } = res;
            const newSession = cloneSession(rawSession);
            await animateTurnAction(action);
            await sleep(150);
            const ended = finalizeTurn(newSession, nextActorId, nextActorIsPlayer, xpGained, coinsGained);
            if (!ended && !nextActorIsPlayer && nextActorId) {
                await sleep(600);
                await handleNpcTurn(newSession, nextActorId);
            }
        } catch (e: any) {
            addLog(`Error: ${e.message}`, "bad");
        } finally {
            setAnimating(false);
        }
    }

    async function handleNpcTurn(currentSession: BattleSession, npcActorId: string) {
        try {
            const res = await api.battleNpcTurn(currentSession.battleId, "__npc__", undefined);
            const { session: rawSession, action, nextActorId, nextActorIsPlayer, xpGained, coinsGained } = res;
            const newSession = cloneSession(rawSession);
            await animateTurnAction(action);
            await sleep(150);
            const ended = finalizeTurn(newSession, nextActorId, nextActorIsPlayer, xpGained, coinsGained);
            if (!ended && !nextActorIsPlayer && nextActorId) {
                await sleep(600);
                await handleNpcTurn(newSession, nextActorId);
            }
        } catch (e: any) {
            addLog(`Error NPC: ${e.message}`, "bad");
        }
    }

    async function handleStart(order: string[]) {
        setLoadingStart(true);
        try {
            const s = await api.battleNpcStart(order);
            const cloned = cloneSession(s);
            setSession(cloned);
            setPhase("battle");
            const { actorId, isPlayer } = initTurn(cloned);
            addLog("⚔️ ¡Comienza el combate!", "system");
            await reload();
            // Si el primer turno es del NPC, ejecutarlo automáticamente
            if (!isPlayer && actorId) {
                await sleep(800);
                setAnimating(true);
                try {
                    await handleNpcTurn(cloned, actorId);
                } finally {
                    setAnimating(false);
                }
            }
        } catch (e: any) {
            toast(e.message ?? "Error al iniciar combate", "error");
        } finally {
            setLoadingStart(false);
        }
    }

    const currentActor = session
        ? ([...session.playerTeam, ...session.enemyTeam].find((m) => m.instanceId === currentActorId) ?? null)
        : null;
    const targetEnemy = session?.enemyTeam.find((m) => m.instanceId === targetEnemyMythId);

    // ── PvP ──
    if (mode === "pvp") {
        return (
            <Layout sidebar={<TrainerSidebar />}>
                <div className="flex-1 flex flex-col overflow-hidden">
                    <TabBar mode={mode} onSwitch={setMode} />
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center max-w-sm">
                            <div className="text-6xl mb-4">⚔️</div>
                            <h2 className="font-mono text-2xl font-black text-yellow-400 tracking-widest mb-3">
                                PvP — Próximamente
                            </h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                El combate entre Binders está en construcción.
                            </p>
                            <div className="mt-6 px-4 py-2 rounded-lg border border-slate-700 text-slate-500 text-xs font-mono tracking-wider">
                                🔒 En desarrollo
                            </div>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    // ── Resultado ──
    if (phase === "result" && result) {
        return (
            <Layout sidebar={<TrainerSidebar />}>
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center max-w-sm">
                        <div className="text-7xl mb-4 animate-bounce">{result.status === "win" ? "🏆" : "💀"}</div>
                        <h2
                            className={`font-mono text-3xl font-black tracking-widest mb-2 ${result.status === "win" ? "text-yellow-400" : "text-red-500"}`}
                        >
                            {result.status === "win" ? "¡VICTORIA!" : "DERROTA"}
                        </h2>
                        {result.status === "win" && (
                            <div className="flex gap-4 justify-center mt-4 mb-6">
                                {result.xp && (
                                    <div className="px-4 py-2 rounded-lg border border-blue-500/40 bg-blue-500/10">
                                        <p className="font-mono font-black text-lg text-blue-300">+{result.xp}</p>
                                        <p className="text-slate-500 text-xs font-mono">XP</p>
                                    </div>
                                )}
                                {result.coins && (
                                    <div className="px-4 py-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                                        <p className="font-mono font-black text-lg text-yellow-300">+{result.coins}</p>
                                        <p className="text-slate-500 text-xs font-mono">Monedas</p>
                                    </div>
                                )}
                            </div>
                        )}
                        <div className="flex gap-3 justify-center mt-4">
                            <button
                                onClick={() => {
                                    setPhase("prep");
                                    setSession(null);
                                    setLog([]);
                                    setResult(null);
                                }}
                                className="px-6 py-2.5 rounded-xl bg-red-700 text-white font-mono font-black text-sm tracking-widest uppercase hover:bg-red-600 transition-all"
                            >
                                ⚔️ Volver a combatir
                            </button>
                            <button
                                onClick={() => navigate("/")}
                                className="px-6 py-2.5 rounded-xl border border-slate-700 text-slate-400 font-mono text-sm tracking-widest uppercase hover:border-slate-500 hover:text-white transition-all"
                            >
                                🏡 Posada
                            </button>
                        </div>
                    </div>
                </div>
            </Layout>
        );
    }

    // ── Prep ──
    if (phase === "prep") {
        return (
            <Layout sidebar={<TrainerSidebar />}>
                <div className="flex-1 flex flex-col overflow-hidden">
                    <TabBar mode={mode} onSwitch={setMode} />
                    <PrepScreen myths={allMyths} onStart={handleStart} loading={loadingStart} />
                </div>
            </Layout>
        );
    }

    // ── Arena ──
    return (
        <Layout sidebar={<TrainerSidebar />}>
            <style>{`
                @keyframes projLtr {
                    0%   { opacity:0; transform:translateY(-50%) scale(0.5) translateX(0px); }
                    15%  { opacity:1; transform:translateY(-50%) scale(1.2) translateX(20px); }
                    85%  { opacity:1; transform:translateY(-50%) scale(1) translateX(240px); }
                    100% { opacity:0; transform:translateY(-50%) scale(0.8) translateX(280px); }
                }
                @keyframes projRtl {
                    0%   { opacity:0; transform:translateY(-50%) scale(0.5) translateX(0px); }
                    15%  { opacity:1; transform:translateY(-50%) scale(1.2) translateX(-20px); }
                    85%  { opacity:1; transform:translateY(-50%) scale(1) translateX(-240px); }
                    100% { opacity:0; transform:translateY(-50%) scale(0.8) translateX(-280px); }
                }
                @keyframes floatDmg {
                    0%   { opacity:0; transform:translateX(-50%) translateY(0) scale(0.8); }
                    15%  { opacity:1; transform:translateX(-50%) translateY(-4px) scale(1.1); }
                    80%  { opacity:1; transform:translateX(-50%) translateY(-20px) scale(1); }
                    100% { opacity:0; transform:translateX(-50%) translateY(-32px) scale(0.9); }
                }
                @keyframes impactFlash {
                    0%,100% { opacity:0; }
                    20%,70% { opacity:1; }
                }
                @keyframes mythShake {
                    0%,100% { transform:translateX(0) rotate(0deg); }
                    20%     { transform:translateX(-5px) rotate(-2deg); }
                    40%     { transform:translateX(5px) rotate(2deg); }
                    60%     { transform:translateX(-3px) rotate(-1deg); }
                    80%     { transform:translateX(3px) rotate(1deg); }
                }
                @keyframes mythIdle {
                    0%,100% { transform:translateY(0px); }
                    50%     { transform:translateY(-4px); }
                }
                @keyframes logFadeIn {
                    from { opacity:0; transform:translateX(-6px); }
                    to   { opacity:1; transform:translateX(0); }
                }
                .animate-proj-ltr { animation: projLtr 0.52s cubic-bezier(0.4,0,0.2,1) forwards; }
                .animate-proj-rtl { animation: projRtl 0.52s cubic-bezier(0.4,0,0.2,1) forwards; }
                .animate-float-dmg { animation: floatDmg 0.9s ease-out forwards; }
                .animate-impact-flash { animation: impactFlash 0.55s ease-in-out; }
                .animate-myth-shake { animation: mythShake 0.45s ease-in-out; }
                .animate-myth-idle  { animation: mythIdle 2s ease-in-out infinite; }
                .animate-log-in { animation: logFadeIn 0.2s ease-out both; }
                /* ── Auras de estado ── */
@keyframes poisonPulse {
    0%,100% { filter: drop-shadow(0 0 4px #4ade80) drop-shadow(0 0 12px #16a34a44); }
    50%     { filter: drop-shadow(0 0 10px #4ade80) drop-shadow(0 0 24px #16a34a88); }
}
@keyframes burnFlicker {
    0%,100% { filter: drop-shadow(0 0 4px #f97316) drop-shadow(0 0 10px #ea580c66); }
    33%     { filter: drop-shadow(0 0 8px #fb923c) drop-shadow(0 0 20px #f9731688); }
    66%     { filter: drop-shadow(0 0 6px #ef4444) drop-shadow(0 0 16px #dc262677); }
}
@keyframes paralyzeZap {
    0%,90%,100% { filter: drop-shadow(0 0 2px #fde047); opacity:1; }
    92%         { filter: drop-shadow(0 0 12px #fde047) drop-shadow(0 0 4px #fff); opacity:0.7; }
    95%         { filter: drop-shadow(0 0 2px #fde047); opacity:1; }
    97%         { filter: drop-shadow(0 0 10px #fde047); opacity:0.8; }
}
@keyframes freezePulse {
    0%,100% { filter: drop-shadow(0 0 6px #67e8f9) drop-shadow(0 0 16px #06b6d444); }
    50%     { filter: drop-shadow(0 0 12px #67e8f9) drop-shadow(0 0 30px #06b6d488); }
}
@keyframes fearShiver {
    0%,100% { transform:translateX(0); filter:drop-shadow(0 0 4px #a855f7); }
    25%     { transform:translateX(-2px) rotate(-1deg); }
    75%     { transform:translateX(2px) rotate(1deg); }
}
@keyframes stunSpin {
    0%    { filter: drop-shadow(0 0 4px #fbbf24); }
    50%   { filter: drop-shadow(0 0 10px #fbbf24) drop-shadow(0 0 20px #fbbf2466); }
    100%  { filter: drop-shadow(0 0 4px #fbbf24); }
}
.aura-poison   { animation: poisonPulse 1.6s ease-in-out infinite; }
.aura-burn     { animation: burnFlicker 0.8s ease-in-out infinite; }
.aura-paralyze { animation: paralyzeZap 2s ease-in-out infinite; }
.aura-freeze   { animation: freezePulse 2s ease-in-out infinite; }
.aura-fear     { animation: fearShiver 0.4s ease-in-out infinite; }
.aura-stun     { animation: stunSpin 1s ease-in-out infinite; }
.aura-curse    { animation: poisonPulse 2s ease-in-out infinite; filter: hue-rotate(270deg); }
            `}</style>

            <div className="flex-1 flex flex-col overflow-hidden">
                <TabBar mode={mode} onSwitch={setMode} />

                <div className="flex-1 flex overflow-hidden">
                    {/* ── Arena principal ── */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* ── Campo de batalla estilo Pokémon ── */}
                        <div
                            className="relative flex-1 flex flex-col justify-between px-6 py-4 overflow-hidden"
                            style={{
                                background:
                                    "linear-gradient(180deg, #0a1628 0%, #0d1f3c 40%, #111827 70%, #0a0f1a 100%)",
                                minHeight: 0,
                            }}
                        >
                            {/* Suelo decorativo */}
                            <div
                                className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
                                style={{
                                    background: "linear-gradient(180deg, transparent 0%, rgba(30,45,70,0.4) 100%)",
                                }}
                            />

                            {/* Línea divisoria central sutil */}
                            <div
                                className="absolute left-8 right-8 pointer-events-none"
                                style={{ top: "50%", height: 1, background: "rgba(255,255,255,0.04)" }}
                            />

                            {/* Proyectil ltr */}
                            {projectile?.direction === "ltr" && (
                                <div className="absolute inset-0 pointer-events-none">
                                    <Projectile proj={projectile} />
                                </div>
                            )}
                            {/* Proyectil rtl */}
                            {projectile?.direction === "rtl" && (
                                <div className="absolute inset-0 pointer-events-none">
                                    <Projectile proj={projectile} />
                                </div>
                            )}

                            {/* ── Fila enemigos (arriba, front view) ── */}
                            <div className="flex justify-around items-end pt-2 relative z-10">
                                {session?.enemyTeam.map((myth) => (
                                    <ArenaMyth
                                        key={myth.instanceId}
                                        myth={myth}
                                        side="enemy"
                                        isActing={myth.instanceId === currentActorId}
                                        targeted={myth.instanceId === targetEnemyMythId && currentActorIsPlayer}
                                        flashAffinity={flashMap[myth.instanceId]}
                                        floatingDmg={floatMap[myth.instanceId]}
                                        spriteSize={90}
                                        onClick={() => {
                                            if (!myth.defeated && !animating && currentActorIsPlayer)
                                                setTargetEnemyMythId(myth.instanceId);
                                        }}
                                    />
                                ))}
                            </div>

                            {/* ── Info turno central ── */}
                            <div className="flex items-center justify-between px-4 py-1 relative z-10">
                                <span className="font-mono text-xs text-slate-600 tracking-widest">
                                    T{session?.turn ?? 0}
                                </span>
                                <div className="flex items-center gap-3">
                                    {animating && (
                                        <span className="font-mono text-xs text-yellow-400 animate-pulse">
                                            ⚡ Resolviendo...
                                        </span>
                                    )}
                                    {currentActorIsPlayer && !animating && (
                                        <div
                                            className={`flex items-center gap-1.5 font-mono text-xs font-black tabular-nums
                                            ${timer <= 5 ? "text-red-400 animate-pulse" : timer <= 10 ? "text-yellow-400" : "text-slate-400"}`}
                                        >
                                            ⏱ {timer}s
                                            <div className="w-12 h-1 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ease-linear
                                                    ${timer <= 5 ? "bg-red-500" : timer <= 10 ? "bg-yellow-500" : "bg-emerald-500"}`}
                                                    style={{ width: `${(timer / 15) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {currentActorIsPlayer ? (
                                        <span className="text-yellow-300 text-xs font-mono animate-pulse">
                                            ⚔️ {currentActor?.name} →{" "}
                                            {targetEnemy ? `🎯 ${targetEnemy.name}` : "elige objetivo"}
                                        </span>
                                    ) : (
                                        <span className="text-slate-500 text-xs font-mono animate-pulse">
                                            👾{" "}
                                            {session
                                                ? ([...session.playerTeam, ...session.enemyTeam].find(
                                                      (m) => m.instanceId === currentActorId,
                                                  )?.name ?? "...")
                                                : "..."}
                                        </span>
                                    )}
                                </div>
                                <span className="w-10" />
                            </div>

                            {/* ── Fila jugador (abajo, back view) ── */}
                            <div className="flex justify-around items-start pb-2 relative z-10">
                                {session?.playerTeam.map((myth) => (
                                    <ArenaMyth
                                        key={myth.instanceId}
                                        myth={myth}
                                        side="player"
                                        isActing={myth.instanceId === currentActorId}
                                        flashAffinity={flashMap[myth.instanceId]}
                                        floatingDmg={floatMap[myth.instanceId]}
                                        spriteSize={90}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* ── Panel de moves — ocupa el espacio restante inferior ── */}
                        <div
                            className="flex-shrink-0 border-t border-slate-800 bg-[#070b14]"
                            style={{ minHeight: 160 }}
                        >
                            {(() => {
                                // Si el actor actual es del jugador y está vivo, úsalo.
                                // Si está muerto (acaba de caer), usa el siguiente myth vivo del jugador.
                                const actorForMoves =
                                    currentActorIsPlayer && currentActor && !currentActor.defeated
                                        ? currentActor
                                        : currentActorIsPlayer
                                          ? (session?.playerTeam.find((m) => !m.defeated) ?? null)
                                          : null;

                                return actorForMoves ? (
                                    <div className="p-3">
                                        <p className="font-mono text-xs text-yellow-400 font-bold mb-2 px-1">
                                            Moves de {actorForMoves.name}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {actorForMoves.moves.map((move) => {
                                                const cfg = AFFINITY_CONFIG[move.affinity];
                                                const onCooldown = !!(actorForMoves.cooldownsLeft?.[move.id] > 0);
                                                const cdLeft = actorForMoves.cooldownsLeft?.[move.id] ?? 0;
                                                const ok =
                                                    !animating && !!targetEnemy && !targetEnemy.defeated && !onCooldown;
                                                return (
                                                    <button
                                                        key={move.id}
                                                        onClick={() => ok && handleMove(move.id)}
                                                        disabled={!ok}
                                                        className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all
                                    ${
                                        ok
                                            ? `${cfg.bg} ${cfg.color} border-white/10 hover:border-white/30 hover:scale-[1.02] active:scale-[0.98]`
                                            : "bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                                    }`}
                                                    >
                                                        <span className="text-2xl mt-0.5">{cfg.emoji}</span>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <p className="font-mono text-sm font-bold">
                                                                    {move.name}
                                                                </p>
                                                                {onCooldown && (
                                                                    <span className="text-xs text-red-400 font-mono font-black">
                                                                        ⏳{cdLeft}t
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs opacity-70 font-mono mb-1">
                                                                {move.power > 0 ? `💥 ${move.power}` : "estado"} · 🎯{" "}
                                                                {move.accuracy}%
                                                                {move.cooldown > 0 && ` · CD${move.cooldown}`}
                                                            </p>
                                                            <p className="text-xs opacity-60 leading-snug line-clamp-2">
                                                                {move.description}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center h-full" style={{ minHeight: 160 }}>
                                        <p className="text-slate-200 text-sm font-mono font-bold">
                                            {animating
                                                ? "⚡ Resolviendo..."
                                                : `👾 Turno de ${
                                                      session
                                                          ? ([...session.playerTeam, ...session.enemyTeam].find(
                                                                (m) => m.instanceId === currentActorId,
                                                            )?.name ?? "rival")
                                                          : "rival"
                                                  }...`}
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* ── Log panel ── */}
                    <div className="w-64 flex-shrink-0 border-l border-slate-800 flex flex-col overflow-hidden">
                        <div className="px-3 py-2.5 border-b border-slate-800 bg-slate-900/60 flex-shrink-0">
                            <p className="font-mono text-xs text-yellow-400 uppercase tracking-widest font-bold">
                                📜 Registro
                            </p>
                        </div>
                        <div
                            ref={logRef}
                            className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5 scroll-smooth"
                            style={{ scrollbarWidth: "thin", scrollbarColor: "#334155 transparent" }}
                        >
                            {log.length === 0 && (
                                <p className="text-slate-700 text-xs font-mono italic text-center mt-6">
                                    Esperando acción...
                                </p>
                            )}
                            {log.map((entry, i) => (
                                <div key={i} className="animate-log-in flex items-start gap-1">
                                    <span className="text-slate-700 font-mono text-xs mt-px flex-shrink-0">›</span>
                                    <p
                                        className="font-mono text-xs leading-relaxed break-words"
                                        style={{
                                            color:
                                                entry.type === "good"
                                                    ? "#4ade80"
                                                    : entry.type === "bad"
                                                      ? "#f87171"
                                                      : entry.type === "crit"
                                                        ? "#fbbf24"
                                                        : entry.type === "miss"
                                                          ? "#64748b"
                                                          : entry.type === "system"
                                                            ? "#818cf8"
                                                            : entry.type === "status"
                                                              ? "#fb923c"
                                                              : entry.type === "heal"
                                                                ? "#34d399"
                                                                : "#e2e8f0",
                                        }}
                                    >
                                        {entry.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

// ─────────────────────────────────────────
// TabBar
// ─────────────────────────────────────────

function TabBar({ mode, onSwitch }: { mode: BattleMode; onSwitch: (m: BattleMode) => void }) {
    return (
        <div className="flex border-b border-slate-800 flex-shrink-0">
            {(["npc", "pvp"] as BattleMode[]).map((m) => (
                <button
                    key={m}
                    onClick={() => onSwitch(m)}
                    className={`px-6 py-3 font-mono text-sm tracking-widest uppercase transition-colors
                        ${mode === m ? "text-red-400 border-b-2 border-red-500" : "text-slate-500 hover:text-slate-300"}`}
                >
                    {m === "npc" ? "⚔️ NPC" : "👥 PvP"}
                </button>
            ))}
        </div>
    );
}
