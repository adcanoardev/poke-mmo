import { useState, useEffect, useRef } from "react";
import Layout from "../components/Layout";
import TrainerSidebar from "../components/TrainerSidebar";
import { api } from "../lib/api";

const COMBAT_BACKGROUNDS = [
    "https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/battlemaps/battlemap1.avif",
    "https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/battlemaps/battlemap2.avif",
];

interface Move {
    id: string;
    name: string;
    affinity: string;
    power: number;
    accuracy: number;
    description: string;
}
interface Combatant {
    speciesId: string;
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    art: { portrait: string; front: string; back: string };
    affinities: string[];
    moves?: Move[];
}
interface TurnResult {
    turn: number;
    playerMove: string;
    playerMoveName: string;
    playerMoveAffinity: string;
    enemyMove: string;
    enemyMoveName: string;
    enemyMoveAffinity: string;
    playerDamage: number;
    enemyDamage: number;
    playerCritical: boolean;
    enemyCritical: boolean;
    playerTypeMultiplier: number;
    enemyTypeMultiplier: number;
    playerHpAfter: number;
    enemyHpAfter: number;
}
interface BattleState {
    battleId: string;
    player: Combatant;
    enemy: Combatant;
    playerFirst: boolean;
    log?: TurnResult[];
}
interface BattleResult {
    result: "WIN" | "LOSE";
    xpGained: number;
    coinsGained: number;
    trainerLevel: number;
    captured: any;
    evolution: any;
}
interface FloatingDmg {
    id: number;
    value: number;
    critical: boolean;
    side: "player" | "enemy";
}

const AFFINITY_COLOR: Record<string, string> = {
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
const AFFINITY_EMOJI: Record<string, string> = {
    EMBER: "🔥",
    TIDE: "💧",
    GROVE: "🌿",
    VOLT: "⚡",
    STONE: "🪨",
    FROST: "❄️",
    VENOM: "☠️",
    ASTRAL: "✨",
    SHADE: "🌑",
    IRON: "⚙️",
};
const SUPER_EFFECTIVE: Record<string, string[]> = {
    EMBER: ["GROVE", "FROST"],
    TIDE: ["EMBER", "STONE"],
    GROVE: ["TIDE", "STONE"],
    VOLT: ["TIDE", "IRON"],
    STONE: ["EMBER", "FROST"],
    FROST: ["GROVE"],
    VENOM: ["GROVE", "FROST"],
    ASTRAL: ["SHADE", "VENOM"],
    SHADE: ["ASTRAL", "GROVE"],
    IRON: ["FROST", "STONE"],
};

function HpBar({ current, max, color }: { current: number; max: number; color: string }) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    const isLow = pct < 25;
    return (
        <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                    width: `${pct}%`,
                    background: isLow ? "#e63946" : color,
                    boxShadow: `0 0 6px ${isLow ? "#e63946" : color}`,
                }}
            />
        </div>
    );
}

function TypeBadge({ affinity }: { affinity: string }) {
    const color = AFFINITY_COLOR[affinity] ?? "#5a6a85";
    return (
        <span
            className="text-xs font-display font-bold px-1.5 py-0.5 rounded inline-flex items-center justify-center"
            style={{ background: `${color}25`, color, border: `1px solid ${color}40`, width: "90px" }}
        >
            {AFFINITY_EMOJI[affinity]} {affinity}
        </span>
    );
}

function MoveButton({ move, onClick, disabled }: { move: Move; onClick: () => void; disabled: boolean }) {
    const color = AFFINITY_COLOR[move.affinity] ?? "#5a6a85";
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="flex flex-col items-start p-4 rounded-xl border transition-all disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98] text-left h-full"
            style={{ borderColor: `${color}40`, background: `${color}10` }}
            onMouseEnter={(e) => {
                if (!disabled) (e.currentTarget as HTMLElement).style.borderColor = color;
            }}
            onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = `${color}40`;
            }}
        >
            <div className="flex items-center justify-between w-full mb-1.5">
                <span className="font-display font-bold text-base tracking-wide" style={{ color }}>
                    {AFFINITY_EMOJI[move.affinity]} {move.name}
                </span>
                <span className="text-sm font-display font-bold" style={{ color: "#5a6a85" }}>
                    POW {move.power}
                </span>
            </div>
            <div className="text-sm leading-tight" style={{ color: "#8899bb" }}>
                {move.description}
            </div>
        </button>
    );
}

function AffinityTable({
    playerAffinities,
    enemyAffinities,
}: {
    playerAffinities: string[];
    enemyAffinities: string[];
}) {
    const allTypes = Object.keys(AFFINITY_COLOR);
    const playerAdvantages = playerAffinities.flatMap((pa) =>
        (SUPER_EFFECTIVE[pa] ?? []).filter((t) => enemyAffinities.includes(t)).map((t) => ({ from: pa, to: t })),
    );
    const enemyAdvantages = enemyAffinities.flatMap((ea) =>
        (SUPER_EFFECTIVE[ea] ?? []).filter((t) => playerAffinities.includes(t)).map((t) => ({ from: ea, to: t })),
    );
    return (
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 h-full overflow-y-auto">
            <div
                className="font-display font-bold text-sm tracking-widest uppercase text-center"
                style={{ color: "#8899bb" }}
            >
                📊 Afinidades
            </div>
            {playerAdvantages.length > 0 && (
                <div>
                    <div className="text-xs font-display font-bold mb-2 text-center" style={{ color: "#06d6a0" }}>
                        ✅ Tus ventajas
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {playerAdvantages.map((a, i) => (
                            <div
                                key={i}
                                className="grid items-center gap-1 px-2 py-1.5 rounded-lg"
                                style={{
                                    gridTemplateColumns: "1fr auto 1fr",
                                    background: "rgba(6,214,160,0.08)",
                                    border: "1px solid rgba(6,214,160,0.2)",
                                }}
                            >
                                <div className="flex justify-end">
                                    <TypeBadge affinity={a.from} />
                                </div>
                                <span className="font-bold text-sm px-1" style={{ color: "#06d6a0" }}>
                                    → x2
                                </span>
                                <div className="flex justify-start">
                                    <TypeBadge affinity={a.to} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {enemyAdvantages.length > 0 && (
                <div>
                    <div className="text-xs font-display font-bold mb-2 text-center" style={{ color: "#e63946" }}>
                        ⚠️ Rival
                    </div>
                    <div className="flex flex-col gap-1.5">
                        {enemyAdvantages.map((a, i) => (
                            <div
                                key={i}
                                className="grid items-center gap-1 px-2 py-1.5 rounded-lg"
                                style={{
                                    gridTemplateColumns: "1fr auto 1fr",
                                    background: "rgba(230,57,70,0.08)",
                                    border: "1px solid rgba(230,57,70,0.2)",
                                }}
                            >
                                <div className="flex justify-end">
                                    <TypeBadge affinity={a.from} />
                                </div>
                                <span className="font-bold text-sm px-1" style={{ color: "#e63946" }}>
                                    → x2
                                </span>
                                <div className="flex justify-start">
                                    <TypeBadge affinity={a.to} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {playerAdvantages.length === 0 && enemyAdvantages.length === 0 && (
                <div className="text-sm text-center py-2" style={{ color: "#3a4a65" }}>
                    Sin ventajas directas
                </div>
            )}
            <div className="border-t pt-2" style={{ borderColor: "#1e2d45" }}>
                <div className="text-xs font-display mb-2 text-center" style={{ color: "#5a6a85" }}>
                    Tabla completa
                </div>
                <div className="flex flex-col gap-1.5 items-center w-full">
                    {allTypes.map((atk) => {
                        const targets = SUPER_EFFECTIVE[atk];
                        if (!targets?.length) return null;
                        return (
                            <div key={atk} className="flex items-center gap-2" style={{ width: "220px" }}>
                                <div style={{ width: "90px", flexShrink: 0 }}>
                                    <TypeBadge affinity={atk} />
                                </div>
                                <span
                                    className="text-xs"
                                    style={{ color: "#3a4a65", width: "20px", textAlign: "center", flexShrink: 0 }}
                                >
                                    →
                                </span>
                                <div className="flex gap-1 flex-wrap" style={{ width: "90px" }}>
                                    {targets.map((t) => (
                                        <TypeBadge key={t} affinity={t} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

function FloatingDamage({ floats }: { floats: FloatingDmg[] }) {
    return (
        <>
            {floats.map((f) => (
                <div
                    key={f.id}
                    className="absolute pointer-events-none font-display font-black"
                    style={{
                        top: "25%",
                        left: f.side === "player" ? "5%" : "auto",
                        right: f.side === "enemy" ? "5%" : "auto",
                        fontSize: f.critical ? "2.4rem" : "1.8rem",
                        color: f.critical ? "#e63946" : "#ffffff",
                        textShadow: f.critical
                            ? "0 0 16px #e63946, 0 2px 4px rgba(0,0,0,0.8)"
                            : "0 2px 8px rgba(0,0,0,0.9)",
                        zIndex: 10,
                        animation: "floatUp 1.9s ease-out forwards",
                    }}
                >
                    -{f.value}
                    {f.critical ? " ⚡" : ""}
                </div>
            ))}
        </>
    );
}

export default function CombatPage() {
    const [mode, setMode] = useState<"npc" | "pvp">("npc");
    const [defId, setDefId] = useState("");
    const [error, setError] = useState("");
    const [battle, setBattle] = useState<BattleState | null>(null);
    const [playerHp, setPlayerHp] = useState(0);
    const [enemyHp, setEnemyHp] = useState(0);
    const [log, setLog] = useState<TurnResult[]>([]);
    const [result, setResult] = useState<BattleResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastTurn, setLastTurn] = useState<TurnResult | null>(null);
    const [pvpResult, setPvpResult] = useState<any>(null);
    const [floats, setFloats] = useState<FloatingDmg[]>([]);
    // Myth del jugador cargado al inicio (para mostrar antes de combatir)
    const [playerCreature, setPlayerCreature] = useState<Combatant | null>(null);
    // Snapshot de ambos combatientes al terminar (para mantenerlos en pantalla)
    const [lastCombatants, setLastCombatants] = useState<{ player: Combatant; enemy: Combatant } | null>(null);
    const floatCounter = useRef(0);
    const [bg] = useState(() => COMBAT_BACKGROUNDS[Math.floor(Math.random() * COMBAT_BACKGROUNDS.length)]);

    useEffect(() => {
        const style = document.createElement("style");
        style.textContent = `
            @keyframes floatUp {
                0%   { opacity: 1; transform: translateY(0) scale(1); }
                60%  { opacity: 1; transform: translateY(-45px) scale(1.1); }
                100% { opacity: 0; transform: translateY(-80px) scale(0.85); }
            }
        `;
        document.head.appendChild(style);
        return () => {
            document.head.removeChild(style);
        };
    }, []);

    // Al montar: carga el myth del jugador y recupera sesión activa si existe
    useEffect(() => {
        async function init() {
            try {
                const party = await api.party();
                if (party?.length > 0) setPlayerCreature(party[0]);
            } catch {
                /* sin party */
            }
            try {
                const res = await api.battleNpcActive();
                if (res?.battleId) {
                    setBattle(res);
                    setPlayerHp(res.player.hp);
                    setEnemyHp(res.enemy.hp);
                    setLog(res.log ?? []);
                    if (res.log?.length > 0) setLastTurn(res.log[res.log.length - 1]);
                }
            } catch {
                /* sin sesión activa */
            }
        }
        init();
    }, []);

    function spawnFloat(value: number, critical: boolean, side: "player" | "enemy") {
        const id = floatCounter.current++;
        setFloats((prev) => [...prev, { id, value, critical, side }]);
        setTimeout(() => setFloats((prev) => prev.filter((f) => f.id !== id)), 1400);
    }

    async function handleStartNpc() {
        setError("");
        setResult(null);
        setBattle(null);
        setLog([]);
        setLastTurn(null);
        setLastCombatants(null);
        setLoading(true);
        try {
            const res = await api.battleNpcStart();
            setBattle(res);
            setPlayerHp(res.player.hp);
            setEnemyHp(res.enemy.hp);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleMove(moveId: string) {
        if (!battle) return;
        setLoading(true);
        try {
            const res = await api.battleNpcTurn(battle.battleId, moveId);
            const turn: TurnResult = res.turn;
            setLog((prev) => [...prev, turn]);
            setLastTurn(turn);
            setPlayerHp(turn.playerHpAfter);
            setEnemyHp(turn.enemyHpAfter);
            if (turn.enemyDamage > 0) spawnFloat(turn.enemyDamage, turn.enemyCritical, "player");
            if (turn.playerDamage > 0) spawnFloat(turn.playerDamage, turn.playerCritical, "enemy");
            if (res.status !== "ongoing") {
                // Guardar snapshot ANTES de borrar battle
                setLastCombatants({ player: battle.player, enemy: battle.enemy });
                setResult({
                    result: res.result,
                    xpGained: res.xpGained,
                    coinsGained: res.coinsGained,
                    trainerLevel: res.trainerLevel,
                    captured: res.captured,
                    evolution: res.evolution,
                });
                setBattle(null);
                window.dispatchEvent(new CustomEvent("sidebar:reload"));
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    async function handleFlee() {
        if (!battle) return;
        setLoading(true);
        try {
            await api.battleNpcFlee(battle.battleId);
            setBattle(null);
            setResult(null);
            setLog([]);
            setLastTurn(null);
            setLastCombatants(null);
            setError("Has huido del combate.");
            window.dispatchEvent(new CustomEvent("sidebar:reload"));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    function handleReset() {
        setBattle(null);
        setResult(null);
        setLog([]);
        setLastTurn(null);
        setError("");
        setPvpResult(null);
        setLastCombatants(null);
    }

    async function handlePvp() {
        setError("");
        setPvpResult(null);
        setLoading(true);
        try {
            const res = await api.battlePvp(defId);
            setPvpResult(res);
            window.dispatchEvent(new CustomEvent("sidebar:reload"));
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    function typeMultiplierLabel(mult: number) {
        if (mult >= 2)
            return (
                <span className="font-bold" style={{ color: "#06d6a0" }}>
                    {" "}
                    ¡SÚPER EFECTIVO!
                </span>
            );
        if (mult <= 0.5) return <span style={{ color: "#5a6a85" }}> Poco efectivo</span>;
        return null;
    }

    const isBattleActive = !!battle;
    const isBattleOver = !!result;

    // Datos a mostrar en arena — prioridad: batalla activa > snapshot final > myth del jugador cargado
    const displayPlayer =
        battle?.player ??
        lastCombatants?.player ??
        (playerCreature ? { ...playerCreature, hp: playerCreature.hp, maxHp: playerCreature.maxHp } : null);
    const displayEnemy = battle?.enemy ?? lastCombatants?.enemy ?? null;
    const displayPlayerHp = battle ? playerHp : lastCombatants ? playerHp : (playerCreature?.hp ?? 0);
    const displayEnemyHp = battle ? enemyHp : lastCombatants ? enemyHp : 0;

    // Afinidades para la tabla
    const tablePlayerAffinities =
        battle?.player.affinities ?? lastCombatants?.player.affinities ?? playerCreature?.affinities ?? [];
    const tableEnemyAffinities = battle?.enemy.affinities ?? lastCombatants?.enemy.affinities ?? [];
    const showAffinityTable = tablePlayerAffinities.length > 0 || tableEnemyAffinities.length > 0;

    return (
        <Layout sidebar={<TrainerSidebar />}>
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
                <h1 className="font-display font-bold text-2xl tracking-widest">
                    ⚔️ <span className="text-red">Combate</span>
                </h1>
                {!isBattleActive && !isBattleOver && (
                    <div className="flex gap-2">
                        {(["npc", "pvp"] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => {
                                    setMode(m);
                                    handleReset();
                                }}
                                className={`px-4 py-1.5 rounded-lg font-display font-bold text-sm tracking-widest uppercase transition-all
                                    ${mode === m ? "text-bg" : "border border-border text-muted hover:border-blue hover:text-blue"}`}
                                style={
                                    mode === m
                                        ? {
                                              background:
                                                  m === "npc"
                                                      ? "linear-gradient(135deg,#ffd60a,#e6a800)"
                                                      : "linear-gradient(135deg,#e63946,#c1121f)",
                                          }
                                        : {}
                                }
                            >
                                {m === "npc" ? "⚔️ NPC" : "🔴 PvP"}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
                    {error && (
                        <div
                            className="flex-shrink-0 px-4 py-2 rounded-xl border text-sm font-semibold"
                            style={{
                                background: "rgba(230,57,70,0.1)",
                                borderColor: "rgba(230,57,70,0.3)",
                                color: "#e63946",
                            }}
                        >
                            {error}
                        </div>
                    )}

                    {/* ── Arena ── */}
                    <div
                        className="flex-shrink-0 rounded-2xl border border-border overflow-hidden relative"
                        style={{
                            height: 250,
                            backgroundImage: `url('${bg}')`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                        }}
                    >
                        {/* Overlay oscuro para que se vean las barras de HP y los personajes */}
                        <div className="absolute inset-0 bg-bg/70" />
                        <FloatingDamage floats={floats} />
                        {isBattleOver && (
                            <div
                                className={`absolute top-0 left-0 right-0 text-center py-2 font-display font-bold text-xl tracking-widest z-10
                                ${result!.result === "WIN" ? "text-green" : "text-red"}`}
                                style={{
                                    background:
                                        result!.result === "WIN" ? "rgba(6,214,160,0.18)" : "rgba(230,57,70,0.18)",
                                }}
                            >
                                {result!.result === "WIN" ? "🏆 VICTORIA" : "💀 DERROTA"}
                            </div>
                        )}
                        <div className="flex items-center justify-around px-10 h-full relative z-10">
                            {/* Jugador */}
                            <div className="text-center w-44">
                                <div
                                    className="w-20 h-20 mx-auto flex items-center justify-center text-5xl mb-3"
                                    style={{ filter: "drop-shadow(0 0 10px rgba(76,201,240,0.6))" }}
                                >
                                    🔵
                                </div>
                                <div className="font-display font-bold text-lg mb-1 text-blue">
                                    {displayPlayer?.name ?? "—"}
                                    <span className="text-sm ml-1.5 opacity-75">Nv.{displayPlayer?.level ?? "?"}</span>
                                </div>
                                <div className="flex justify-center gap-1 mb-2.5">
                                    {(displayPlayer?.affinities ?? []).map((a) => (
                                        <TypeBadge key={a} affinity={a} />
                                    ))}
                                </div>
                                <HpBar current={displayPlayerHp} max={displayPlayer?.maxHp ?? 1} color="#4cc9f0" />
                                <div className="text-sm font-display font-semibold mt-1.5" style={{ color: "#7a9abb" }}>
                                    {displayPlayer ? `${displayPlayerHp} / ${displayPlayer.maxHp} HP` : ""}
                                </div>
                            </div>

                            <div className="font-display font-bold text-3xl" style={{ color: "#ffffff" }}>
                                VS
                            </div>

                            {/* Enemigo */}
                            <div className="text-center w-44">
                                <div
                                    className="w-20 h-20 mx-auto flex items-center justify-center text-5xl mb-3"
                                    style={{ filter: "drop-shadow(0 0 10px rgba(230,57,70,0.6))" }}
                                >
                                    ❓
                                </div>
                                <div className="font-display font-bold text-lg mb-1 text-red uppercase">
                                    {displayEnemy?.name ?? "—"}
                                    <span className="text-sm ml-1.5 opacity-75">
                                        {displayEnemy ? `Nv.${displayEnemy.level}` : ""}
                                    </span>
                                </div>
                                <div className="flex justify-center gap-1 mb-2.5">
                                    {(displayEnemy?.affinities ?? []).map((a) => (
                                        <TypeBadge key={a} affinity={a} />
                                    ))}
                                </div>
                                <HpBar current={displayEnemyHp} max={displayEnemy?.maxHp ?? 1} color="#e63946" />
                                <div className="text-sm font-display font-semibold mt-1.5" style={{ color: "#9a6a6a" }}>
                                    {displayEnemy ? `${displayEnemyHp} / ${displayEnemy.maxHp} HP` : ""}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Último turno — espacio fijo reservado ── */}
                    <div className="flex-shrink-0 h-12 flex gap-2">
                        {lastTurn && isBattleActive ? (
                            <>
                                <div
                                    className="flex-1 rounded-lg px-3 py-2 flex items-center gap-2 text-sm"
                                    style={{
                                        background: "rgba(76,201,240,0.08)",
                                        border: "1px solid rgba(76,201,240,0.2)",
                                    }}
                                >
                                    <span className="font-bold text-blue">{lastTurn.playerMoveName}</span>
                                    <span style={{ color: "#3a4a65" }}>→</span>
                                    <span className="font-bold">{lastTurn.playerDamage} dmg</span>
                                    {lastTurn.playerCritical && (
                                        <span className="text-yellow font-bold">⚡CRÍTICO</span>
                                    )}
                                    {typeMultiplierLabel(lastTurn.playerTypeMultiplier)}
                                </div>
                                <div
                                    className="flex-1 rounded-lg px-3 py-2 flex items-center gap-2 text-sm"
                                    style={{
                                        background: "rgba(230,57,70,0.08)",
                                        border: "1px solid rgba(230,57,70,0.2)",
                                    }}
                                >
                                    <span className="font-bold text-red">{lastTurn.enemyMoveName}</span>
                                    <span style={{ color: "#3a4a65" }}>→</span>
                                    <span className="font-bold">{lastTurn.enemyDamage} dmg</span>
                                    {lastTurn.enemyCritical && <span className="text-yellow font-bold">⚡CRÍTICO</span>}
                                    {typeMultiplierLabel(lastTurn.enemyTypeMultiplier)}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1" />
                        )}
                    </div>

                    {/* ── Recompensas ── */}
                    {isBattleOver && (
                        <div className="flex-shrink-0 flex gap-3">
                            <div className="flex-1 bg-bg3 rounded-xl p-2 text-center">
                                <div className="text-yellow font-display font-bold text-xl">+{result!.xpGained}</div>
                                <div className="text-sm" style={{ color: "#5a6a85" }}>
                                    XP
                                </div>
                            </div>
                            <div className="flex-1 bg-bg3 rounded-xl p-2 text-center">
                                <div className="text-yellow font-display font-bold text-xl">+{result!.coinsGained}</div>
                                <div className="text-sm" style={{ color: "#5a6a85" }}>
                                    Monedas
                                </div>
                            </div>
                            <div className="flex-1 bg-bg3 rounded-xl p-2 text-center">
                                <div className="text-blue font-display font-bold text-xl">{log.length}</div>
                                <div className="text-sm" style={{ color: "#5a6a85" }}>
                                    Turnos
                                </div>
                            </div>
                            {result!.captured && (
                                <div
                                    className="flex-1 rounded-xl p-2 text-center"
                                    style={{
                                        background: "rgba(6,214,160,0.1)",
                                        border: "1px solid rgba(6,214,160,0.3)",
                                    }}
                                >
                                    <div className="text-2xl">✨</div>
                                    <div className="text-green text-sm font-display font-bold">¡Capturado!</div>
                                </div>
                            )}
                            {result!.evolution?.evolved && (
                                <div
                                    className="flex-1 rounded-xl p-2 text-center"
                                    style={{
                                        background: "rgba(255,214,10,0.1)",
                                        border: "1px solid rgba(255,214,10,0.3)",
                                    }}
                                >
                                    <div className="text-2xl">⬆️</div>
                                    <div className="text-yellow text-sm font-display font-bold">¡Evolución!</div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Zona de acción ── */}
                    <div className="flex-shrink-0">
                        {mode === "npc" && (
                            <>
                                <div className="flex gap-3">
                                    <div style={{ flex: "0 0 65%" }} className="flex flex-col gap-2">
                                        {isBattleActive && (
                                            <div className="grid grid-cols-2 gap-2" style={{ minHeight: 130 }}>
                                                {battle!.player.moves!.map((move) => (
                                                    <MoveButton
                                                        key={move.id}
                                                        move={move}
                                                        onClick={() => handleMove(move.id)}
                                                        disabled={loading}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        {!isBattleActive && !isBattleOver && (
                                            <button
                                                onClick={handleStartNpc}
                                                disabled={loading}
                                                className="w-full py-4 rounded-xl font-display font-bold text-xl tracking-widest uppercase disabled:opacity-40 transition-all"
                                                style={{
                                                    background: "linear-gradient(135deg,#e63946,#c1121f)",
                                                    boxShadow: "0 0 24px rgba(230,57,70,0.4)",
                                                }}
                                            >
                                                {loading ? "Buscando rival..." : "⚔️ ¡COMBATIR!"}
                                            </button>
                                        )}
                                        {isBattleOver && (
                                            <button
                                                onClick={handleReset}
                                                className="w-full py-4 rounded-xl border border-border font-display font-bold text-base tracking-widest uppercase hover:border-red hover:text-red transition-all"
                                            >
                                                Volver a combatir
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ flex: "0 0 calc(35% - 0.75rem)" }}>
                                        {showAffinityTable ? (
                                            <AffinityTable
                                                playerAffinities={tablePlayerAffinities}
                                                enemyAffinities={tableEnemyAffinities}
                                            />
                                        ) : (
                                            <div
                                                className="bg-card border border-border rounded-2xl h-full flex items-center justify-center"
                                                style={{ minHeight: 130 }}
                                            >
                                                <div
                                                    className="text-sm font-display tracking-widest"
                                                    style={{ color: "#2a3a55" }}
                                                >
                                                    📊 Afinidades
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {isBattleActive && (
                                    <button
                                        onClick={handleFlee}
                                        disabled={loading}
                                        className="w-full mt-3 py-3 rounded-xl border font-display font-bold text-base tracking-widest uppercase transition-all disabled:opacity-40"
                                        style={{ borderColor: "#2a3a55", color: "#5a6a85" }}
                                        onMouseEnter={(e) => {
                                            (e.currentTarget as HTMLElement).style.borderColor = "#e63946";
                                            (e.currentTarget as HTMLElement).style.color = "#e63946";
                                        }}
                                        onMouseLeave={(e) => {
                                            (e.currentTarget as HTMLElement).style.borderColor = "#2a3a55";
                                            (e.currentTarget as HTMLElement).style.color = "#5a6a85";
                                        }}
                                    >
                                        🏃 Huir del combate
                                    </button>
                                )}
                            </>
                        )}
                        {mode === "pvp" && (
                            <>
                                {!pvpResult && (
                                    <input
                                        className="w-full bg-white/5 border border-border rounded-lg px-4 py-3 text-base outline-none focus:border-blue transition-colors mb-3"
                                        placeholder="User ID del rival"
                                        value={defId}
                                        onChange={(e) => setDefId(e.target.value)}
                                    />
                                )}
                                {!pvpResult ? (
                                    <button
                                        onClick={handlePvp}
                                        disabled={loading || !defId}
                                        className="w-full py-4 rounded-xl font-display font-bold text-xl tracking-widest uppercase disabled:opacity-40 transition-all"
                                        style={{
                                            background: "linear-gradient(135deg,#e63946,#c1121f)",
                                            boxShadow: "0 0 24px rgba(230,57,70,0.4)",
                                        }}
                                    >
                                        {loading ? "Combatiendo..." : "🔴 ¡RETAR!"}
                                    </button>
                                ) : (
                                    <>
                                        <div
                                            className={`text-center py-4 rounded-xl font-display font-bold text-2xl tracking-widest
                                            ${pvpResult.result === "WIN" ? "text-green bg-green/10 border border-green/20" : "text-red bg-red/10 border border-red/20"}`}
                                        >
                                            {pvpResult.result === "WIN" ? "🏆 VICTORIA PvP" : "💀 DERROTA PvP"}
                                        </div>
                                        <button
                                            onClick={handleReset}
                                            className="w-full mt-3 py-3 rounded-xl border border-border font-display font-bold text-base tracking-widest uppercase hover:border-red hover:text-red transition-all"
                                        >
                                            Volver a combatir
                                        </button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ── Log de turnos ── */}
                <div className="w-64 flex-shrink-0 border-l border-border flex flex-col overflow-hidden">
                    <div
                        className="flex-shrink-0 px-4 py-3 border-b border-border font-display font-bold text-sm tracking-widest uppercase"
                        style={{ color: "#5a6a85" }}
                    >
                        Log de batalla
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                        {log.length === 0 && (
                            <div
                                className="text-sm text-center py-8 font-display tracking-widest"
                                style={{ color: "#2a3a55" }}
                            >
                                Sin combate
                            </div>
                        )}
                        {log.map((t, i) => (
                            <div
                                key={i}
                                className="text-sm rounded-xl px-3 py-2.5 flex flex-col gap-1.5"
                                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1e2d45" }}
                            >
                                <div
                                    className="font-display text-xs font-bold tracking-widest"
                                    style={{ color: "#3a4a65" }}
                                >
                                    TURNO {t.turn}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-blue">{t.playerMoveName}</span>
                                    <span style={{ color: "#3a4a65" }}>→</span>
                                    <span className="font-bold">{t.playerDamage}</span>
                                    {t.playerCritical && <span className="text-yellow text-xs font-bold">⚡CRIT</span>}
                                    {t.playerTypeMultiplier >= 2 && (
                                        <span className="text-green text-xs font-bold">✅x2</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-red">{t.enemyMoveName}</span>
                                    <span style={{ color: "#3a4a65" }}>→</span>
                                    <span className="font-bold">{t.enemyDamage}</span>
                                    {t.enemyCritical && <span className="text-yellow text-xs font-bold">⚡CRIT</span>}
                                    {t.enemyTypeMultiplier >= 2 && (
                                        <span className="text-red text-xs font-bold">⚠️x2</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
