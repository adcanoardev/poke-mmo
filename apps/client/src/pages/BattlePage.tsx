import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
    accuracy: number;       // 0–100, base hit chance
    critChance: number;     // 0–100, % probabilidad crítico
    critDamage: number;     // multiplicador base ej: 150 = ×1.5, 200 = ×2.0
    affinities: Affinity[];
    moves: Move[];
    art: { portrait: string; front: string; back: string };
    status: StatusEffect;
    statusTurnsLeft: number;
    cooldownsLeft: Record<string, number>;
    buffs: Buff[];
    shield?: number;
    shieldTurns?: number;
    silenced?: number;
    rarity?: "COMMON" | "RARE" | "ELITE" | "LEGENDARY" | "MYTHIC";
    distortionTriggerTurn?: number | null; // turno en el que distorsiona (null si no tiene o ya distorsionó)
    distortionFormStartTurn?: number;       // turno en que empezó la forma actual
    nextFormRarity?: string | null;         // rareza de la siguiente forma (para colorear la barra)
    height?: number;            // altura física en metros (0=etéreo, 0.35-2.0 rango)
    defeated: boolean;
}

interface BattleSession {
    battleId: string;
    trainerId: string;          // ← ID del entrenador dueño del combate
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

const CDN = "https://cdn.jsdelivr.net/gh/adcanoardev/mythara-assets@7613486785dc2b2089f6d345e1281e9316c1d982";

// Iconos de estado — WebP 64×64, fondo transparente
const STATUS_ICON_URLS: Record<string, string> = {
    burn:     `${CDN}/status/fire_status_icon.webp`,
    poison:   `${CDN}/status/poison_status_icon.webp`,
    paralyze: `${CDN}/status/paralyze_status_icon.webp`,
    freeze:   `${CDN}/status/freeze_status_icon.webp`,
    fear:     `${CDN}/status/fear_status_icon.webp`,
    stun:     `${CDN}/status/stun_status_icon.webp`,
    curse:    `${CDN}/status/curse_status_icon.webp`,
};

// Fallback emoji para cuando el CDN falla
const STATUS_ICONS: Record<string, string> = {
    burn: "🔥",
    poison: "☠️",
    freeze: "❄️",
    fear: "😨",
    paralyze: "⚡",
    stun: "💫",
    curse: "💀",
};

// Colores por estado para el log
const STATUS_LOG_COLORS: Record<string, string> = {
    burn:     "#fb923c",
    poison:   "#4ade80",
    paralyze: "#fde047",
    freeze:   "#7dd3fc",
    fear:     "#c084fc",
    stun:     "#facc15",
    curse:    "#a855f7",
};

// Iconos de afinidad — WebP, fondo transparente
const AFFINITY_ICON_URLS: Record<string, string> = {
    STONE:  `${CDN}/affinity/stone_affinity_icon.webp`,
    IRON:   `${CDN}/affinity/iron_affinity_icon.webp`,
    FROST:  `${CDN}/affinity/frost_affinity_icon.webp`,
    GROVE:  `${CDN}/affinity/grove_affinity_icon.webp`,
    ASTRAL: `${CDN}/affinity/astral_affinity_icon.webp`,
    EMBER:  `${CDN}/affinity/ember_affinity_icon.webp`,
    VENOM:  `${CDN}/affinity/venom_affinity_icon.webp`,
    TIDE:   `${CDN}/affinity/tide_affinity_icon.webp`,
    SHADE:  `${CDN}/affinity/shade_affinity_icon.webp`,
    VOLT:   `${CDN}/affinity/volt_affinity_icon.webp`,
};

// Componente de icono de estado: imagen CDN con fallback emoji
function StatusIcon({ status, size = 16 }: { status: string; size?: number }) {
    const url = STATUS_ICON_URLS[status];
    const emoji = STATUS_ICONS[status] ?? "⚠️";
    const [failed, setFailed] = React.useState(false);
    if (!url || failed) return <span style={{ fontSize: size * 0.9 }}>{emoji}</span>;
    return (
        <img
            src={url}
            alt={status}
            width={size}
            height={size}
            style={{ display: "inline-block", verticalAlign: "middle", imageRendering: "auto" }}
            onError={() => setFailed(true)}
        />
    );
}

// Componente de icono de afinidad: imagen CDN con fallback emoji
function AffinityIcon({ affinity, size = 18 }: { affinity: string; size?: number }) {
    const url = AFFINITY_ICON_URLS[affinity];
    const cfg = AFFINITY_CONFIG[affinity as Affinity];
    const emoji = cfg?.emoji ?? "❓";
    const [failed, setFailed] = React.useState(false);
    if (!url || failed) return <span style={{ fontSize: size * 0.85 }}>{emoji}</span>;
    return (
        <img
            src={url}
            alt={affinity}
            width={size}
            height={size}
            style={{ display: "inline-block", verticalAlign: "middle", imageRendering: "auto" }}
            onError={() => setFailed(true)}
        />
    );
}

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
        label: "Ember",
        projEmoji: "🔥",
    },
    TIDE: {
        color: "text-blue-400",
        bg: "bg-blue-500/20",
        glow: "#3b82f6",
        glowRgb: "59,130,246",
        emoji: "🌊",
        label: "Tide",
        projEmoji: "💧",
    },
    GROVE: {
        color: "text-green-400",
        bg: "bg-green-500/20",
        glow: "#22c55e",
        glowRgb: "34,197,94",
        emoji: "🌿",
        label: "Grove",
        projEmoji: "🍃",
    },
    VOLT: {
        color: "text-yellow-300",
        bg: "bg-yellow-400/20",
        glow: "#fde047",
        glowRgb: "253,224,71",
        emoji: "⚡",
        label: "Volt",
        projEmoji: "⚡",
    },
    STONE: {
        color: "text-stone-400",
        bg: "bg-stone-500/20",
        glow: "#a8a29e",
        glowRgb: "168,162,158",
        emoji: "🪨",
        label: "Stone",
        projEmoji: "🪨",
    },
    FROST: {
        color: "text-cyan-300",
        bg: "bg-cyan-500/20",
        glow: "#67e8f9",
        glowRgb: "103,232,249",
        emoji: "❄️",
        label: "Frost",
        projEmoji: "❄️",
    },
    VENOM: {
        color: "text-purple-400",
        bg: "bg-purple-500/20",
        glow: "#a855f7",
        glowRgb: "168,85,247",
        emoji: "🧪",
        label: "Venom",
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
        label: "Iron",
        projEmoji: "⚙️",
    },
    SHADE: {
        color: "text-violet-400",
        bg: "bg-violet-700/20",
        glow: "#7c3aed",
        glowRgb: "124,58,237",
        emoji: "🌑",
        label: "Shade",
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
// HP Bar — barra gruesa con HP numérico en interior
// ─────────────────────────────────────────

// ─────────────────────────────────────────

// ─────────────────────────────────────────
// useWindowSize — reactive resize hook
// ─────────────────────────────────────────
function useWindowSize() {
    const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
    useEffect(() => {
        const h = () => setSize({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener("resize", h);
        return () => window.removeEventListener("resize", h);
    }, []);
    return size;
}

// ─────────────────────────────────────────
// MoveCircle — floating circle button for 3-move overlay
// slot: "basic" | "skill" | "ulti"
// Hold (long press) shows description tooltip
// ─────────────────────────────────────────
function MoveCircle({
    move, cfg, ok, onCooldown, cdLeft, slot, onSelect, desktop = false,
}: {
    move: Move;
    cfg: any;
    ok: boolean;
    onCooldown: boolean;
    cdLeft: number;
    slot: "basic" | "skill" | "ulti";
    onSelect: () => void;
    desktop?: boolean;
}) {
    const [showDesc, setShowDesc] = useState(false);
    const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const isUlti = slot === "ulti";
    // Desktop: bigger circles (72/56), mobile: standard (58/44)
    const sz = isUlti ? (desktop ? 90 : 58) : (desktop ? 70 : 44);
    const borderColor = onCooldown
        ? "rgba(100,116,139,0.3)"
        : isUlti
            ? (cfg.glow ?? "rgba(249,115,22,0.7)")
            : `${cfg.glow ?? "rgba(249,115,22,0.5)"}99`;
    const bg = onCooldown
        ? "rgba(10,15,25,0.75)"
        : isUlti
            ? `rgba(${cfg.glow ? "30,12,3" : "20,10,5"},0.88)`
            : "rgba(10,14,22,0.82)";
    const glowShadow = (!onCooldown && isUlti)
        ? `0 0 16px ${cfg.glow ?? "rgba(249,115,22,0.3)"}55, 0 0 6px ${cfg.glow ?? "rgba(249,115,22,0.2)"}33`
        : undefined;

    function startHold(e: React.MouseEvent | React.TouchEvent) {
        e.preventDefault();
        holdTimer.current = setTimeout(() => setShowDesc(true), 400);
    }
    function endHold() {
        if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, position: "relative" }}>
            {/* Tooltip — shown on hold */}
            {showDesc && (
                <div
                    onClick={(e) => { e.stopPropagation(); setShowDesc(false); }}
                    style={{
                        position: "absolute", bottom: sz + 10, left: "50%", transform: "translateX(-50%)",
                        width: 210, background: "rgba(7,11,20,0.97)",
                        border: `1px solid ${cfg.glow ?? "#6366f1"}44`,
                        borderRadius: 10, padding: "8px 12px", zIndex: 60,
                        boxShadow: `0 0 24px rgba(0,0,0,0.8), 0 0 10px ${cfg.glow ?? "#6366f1"}22`,
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                        <AffinityIcon affinity={move.affinity} size={14} />
                        <span style={{ fontFamily: "monospace", fontWeight: 900, color: "#fff", fontSize: 11 }}>{move.name}</span>
                        {move.power > 0 && <span style={{ fontSize: 10, color: cfg.glow ?? "#f97316", fontFamily: "monospace", fontWeight: 900, marginLeft: "auto" }}>⚡{move.power}</span>}
                    </div>
                    <p style={{ fontSize: 10, color: "var(--text-primary)", lineHeight: 1.5 }}>{move.description}</p>
                    {/* Arrow */}
                    <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%) rotate(45deg)", width: 8, height: 8, background: "rgba(7,11,20,0.97)", border: `1px solid ${cfg.glow ?? "#6366f1"}44`, borderTop: "none", borderLeft: "none" }} />
                </div>
            )}

            {/* Circle button */}
            <button
                onClick={() => { setShowDesc(false); ok && onSelect(); }}
                onMouseDown={startHold} onMouseUp={endHold} onMouseLeave={endHold}
                onTouchStart={startHold} onTouchEnd={endHold}
                disabled={!ok && !onCooldown}
                style={{
                    width: sz, height: sz, borderRadius: "50%",
                    background: bg,
                    border: `2px solid ${borderColor}`,
                    boxShadow: glowShadow,
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1,
                    cursor: ok ? "pointer" : "default",
                    opacity: onCooldown ? 0.35 : 1,
                    transition: "opacity 0.2s, box-shadow 0.2s, transform 0.1s",
                    position: "relative", overflow: "hidden",
                    flexShrink: 0,
                }}
                className={ok ? "active:scale-95" : ""}
            >
                {/* CD overlay */}
                {onCooldown && (
                    <div style={{
                        position: "absolute", inset: 0, borderRadius: "50%",
                        background: "rgba(0,0,0,0.72)",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 0,
                    }}>
                        <span style={{ fontSize: isUlti ? (desktop ? 28 : 22) : (desktop ? 22 : 17), fontWeight: 900, color: "#ef4444", lineHeight: 1 }}>{cdLeft}</span>
                        <span style={{ fontSize: desktop ? 8 : 7, color: "rgba(239,68,68,0.6)", letterSpacing: "0.1em" }}>CD</span>
                    </div>
                )}
                <AffinityIcon affinity={move.affinity} size={isUlti ? (desktop ? 28 : 22) : (desktop ? 20 : 16)} />
                {move.power > 0
                    ? <span style={{ fontSize: isUlti ? (desktop ? 11 : 9) : (desktop ? 10 : 8), fontFamily: "monospace", fontWeight: 900, color: cfg.glow ?? "#f97316", lineHeight: 1 }}>⚡{move.power}</span>
                    : <span style={{ fontSize: desktop ? 9 : 7, fontFamily: "monospace", color: "#64748b" }}>STS</span>
                }
                {/* ULT badge */}
                {isUlti && !onCooldown && (
                    <div style={{ position: "absolute", top: -1, right: -1, background: cfg.glow ?? "#f97316", borderRadius: 4, padding: "0 3px", fontSize: 7, fontFamily: "monospace", fontWeight: 900, color: "#000", lineHeight: "13px" }}>ULT</div>
                )}
            </button>

            {/* Name label */}
            <span style={{
                fontSize: desktop ? 9 : 8, fontFamily: "monospace", fontWeight: 700,
                color: onCooldown ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)",
                textAlign: "center", maxWidth: sz + 12, lineHeight: 1.2,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
                {move.name}
            </span>
        </div>
    );
}

function HpBar({ hp, maxHp, shield = 0, shieldTurns = 0 }: { hp: number; maxHp: number; shield?: number; shieldTurns?: number }) {
    const pct = maxHp > 0 ? Math.max(0, (hp / maxHp) * 100) : 0;
    const shieldPct = maxHp > 0 ? Math.min(100 - pct, (shield / maxHp) * 100) : 0;
    const barColor =
        pct > 90 ? "#22c55e"
        : pct > 70 ? "#16a34a"
        : pct > 50 ? "#84cc16"
        : pct > 30 ? "#facc15"
        : pct > 15 ? "#f97316"
        : pct > 5  ? "#ef4444"
                   : "#b91c1c";
    const glowColor =
        pct > 50 ? "rgba(34,197,94,0.5)" : pct > 25 ? "rgba(250,204,21,0.5)" : "rgba(239,68,68,0.6)";
    const textColor = "#ffffff";
    return (
        <div className="relative flex-1" style={{
            height: 18, background: "rgba(0,0,0,0.45)",
            borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", overflow: "visible",
        }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: 9, overflow: "hidden" }}>
                <div className="absolute left-0 top-0 h-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 8px ${glowColor}`, borderRadius: 9 }} />
                {shieldPct > 0 && (
                    <div className="absolute top-0 h-full transition-all duration-700"
                        style={{ left: `${pct}%`, width: `${shieldPct}%`, background: "#60a5fa", boxShadow: "0 0 6px rgba(96,165,250,0.5)" }} />
                )}
                <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
                    <span className="font-mono font-black tabular-nums leading-none select-none"
                        style={{ fontSize: "10px", color: textColor, textShadow: "0 1px 4px rgba(0,0,0,1)", letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
                        {hp}<span style={{ opacity: 0.75, fontWeight: 700 }}>/{maxHp}</span>
                    </span>
                </div>
            </div>
            {/* Badge de escudo con turnos restantes */}
            {shield > 0 && shieldTurns > 0 && (
                <div style={{
                    position: "absolute", top: -7, right: -4, zIndex: 10,
                    background: "#1e40af", border: "1px solid #60a5fa",
                    borderRadius: 4, padding: "1px 4px",
                    display: "flex", alignItems: "center", gap: 2,
                    boxShadow: "0 0 6px rgba(96,165,250,0.6)",
                }}>
                    <span style={{ fontSize: "8px", color: "#60a5fa" }}>🛡️</span>
                    <span style={{ fontSize: "8px", fontFamily: "monospace", fontWeight: 900, color: "#bfdbfe", lineHeight: 1 }}>{shieldTurns}</span>
                </div>
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
    level: 1 | 2 | 3; // 1=básico, 2=medio, 3=ultimate
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
}

function Projectile({ proj }: { proj: ProjectileState }) {
    const cfg = AFFINITY_CONFIG[proj.affinity];
    const size = proj.level === 1 ? 28 : proj.level === 2 ? 44 : 72;
    const glowSize = proj.level === 1 ? 10 : proj.level === 2 ? 22 : 50;

    const dx = proj.toX - proj.fromX;
    const dy = proj.toY - proj.fromY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = Math.max(0.3, Math.min(0.6, dist / 800));

    return (
        <div
            className="fixed z-[100] pointer-events-none"
            style={
                {
                    left: proj.fromX,
                    top: proj.fromY,
                    transform: "translate(-50%, -50%)",
                    animation: `projTravel ${duration}s cubic-bezier(0.4,0,0.2,1) forwards`,
                    "--dx": `${dx}px`,
                    "--dy": `${dy}px`,
                } as React.CSSProperties
            }
        >
            <span
                style={{
                    fontSize: size,
                    filter: `drop-shadow(0 0 ${glowSize}px ${cfg.glow}) drop-shadow(0 0 ${glowSize * 2}px ${cfg.glow})${proj.level === 3 ? ` drop-shadow(0 0 ${glowSize * 3}px #ffffff88)` : ""}`,
                    display: "block",
                }}
            >
                {cfg.projEmoji}
            </span>
            {/* Trail nivel 2 */}
            {proj.level === 2 && (
                <div
                    className="absolute rounded-full pointer-events-none"
                    style={{
                        background: `radial-gradient(circle, ${cfg.glow}88 0%, transparent 70%)`,
                        width: size * 2,
                        height: size * 2,
                        top: -size / 2,
                        left: -size / 2,
                        animation: `trailFade ${duration}s ease-out forwards`,
                    }}
                />
            )}
            {/* Trail nivel 3 — múltiple y brillante */}
            {proj.level === 3 && (
                <>
                    <div
                        className="absolute rounded-full pointer-events-none"
                        style={{
                            background: `radial-gradient(circle, #ffffffaa 0%, ${cfg.glow}cc 30%, transparent 70%)`,
                            width: size * 3,
                            height: size * 3,
                            top: -size,
                            left: -size,
                            animation: `trailFade ${duration}s ease-out forwards`,
                        }}
                    />
                    <div
                        className="absolute rounded-full pointer-events-none"
                        style={{
                            background: `radial-gradient(circle, ${cfg.glow}ff 0%, transparent 60%)`,
                            width: size * 1.5,
                            height: size * 1.5,
                            top: -size * 0.25,
                            left: -size * 0.25,
                            animation: `trailFade ${duration * 0.7}s ease-out forwards`,
                        }}
                    />
                </>
            )}
        </div>
    );
}

function ImpactExplosion({
    x, y, fromX, fromY, affinity, level, onDone,
}: {
    x: number; y: number; fromX: number; fromY: number;
    affinity: Affinity; level: 1 | 2 | 3; onDone: () => void;
}) {
    const cfg = AFFINITY_CONFIG[affinity];
    const duration = level === 1 ? 500 : level === 2 ? 800 : 1600;
    const impactAngle = Math.atan2(y - fromY, x - fromX);
    const impactDeg = impactAngle * (180 / Math.PI);

    useEffect(() => {
        const t = setTimeout(onDone, duration);
        return () => clearTimeout(t);
    }, []);

    // ── Shapes por afinidad ──────────────────────────────────────────────────
    // Cada afinidad tiene partículas con forma/color/animación propios
    const affinityShapes: Record<Affinity, { shape: string; colors: string[] }> = {
        EMBER:   { shape: "flame",   colors: ["#ff4500","#ff6b00","#ffad00","#fff200"] },
        TIDE:    { shape: "droplet", colors: ["#0ea5e9","#38bdf8","#7dd3fc","#e0f2fe"] },
        GROVE:   { shape: "leaf",    colors: ["#16a34a","#22c55e","#4ade80","#bbf7d0"] },
        VOLT:    { shape: "bolt",    colors: ["#fde047","#facc15","#fbbf24","#ffffff"] },
        STONE:   { shape: "shard",   colors: ["#78716c","#a8a29e","#d6d3d1","#e7e5e4"] },
        FROST:   { shape: "crystal", colors: ["#a5f3fc","#67e8f9","#22d3ee","#ffffff"] },
        VENOM:   { shape: "orb",     colors: ["#a855f7","#c084fc","#d8b4fe","#86efac"] },
        ASTRAL:  { shape: "star",    colors: ["#818cf8","#a5b4fc","#c7d2fe","#ffffff"] },
        IRON:    { shape: "shard",   colors: ["#94a3b8","#cbd5e1","#e2e8f0","#ffffff"] },
        SHADE:   { shape: "wisp",    colors: ["#7c3aed","#8b5cf6","#a78bfa","#312e81"] },
    };
    const as = affinityShapes[affinity];

    // ── ULTIMATE (level 3) ─────────────────────────────────────────────────
    if (level === 3) {
        const particleCount = 28;
        const shardCount = 10;
        return (
            <>
                {/* Vignette de color (SIN flash blanco) */}
                <div className="fixed inset-0 z-[198] pointer-events-none"
                    style={{
                        background: `radial-gradient(ellipse at ${x}px ${y}px, ${cfg.glow}66 0%, ${cfg.glow}22 30%, transparent 65%)`,
                        animation: "ultimateVignette 1.4s ease-out forwards",
                    }}
                />
                {/* Shockwaves de color */}
                {[0, 1, 2, 3, 4].map((i) => (
                    <div key={`sw${i}`} className="fixed z-[201] pointer-events-none"
                        style={{
                            left: x, top: y,
                            width: 20, height: 12,
                            marginLeft: -10, marginTop: -6,
                            border: `${3 - Math.floor(i/2)}px solid ${as.colors[i % as.colors.length]}`,
                            boxShadow: `0 0 20px ${cfg.glow}, inset 0 0 12px ${cfg.glow}66`,
                            borderRadius: "50%",
                            transform: `rotate(${impactDeg}deg)`,
                            animation: `ultimateShockwave 1s cubic-bezier(0.15,0,0.3,1) ${i * 0.1}s forwards`,
                        }}
                    />
                ))}
                {/* Flash central de color */}
                <div className="fixed z-[202] pointer-events-none rounded-full"
                    style={{
                        left: x, top: y,
                        width: 260, height: 260,
                        marginLeft: -130, marginTop: -130,
                        background: `radial-gradient(circle, ${as.colors[3] ?? "#fff"}cc 0%, ${cfg.glow}ee 20%, ${cfg.glow}88 50%, transparent 75%)`,
                        animation: "ultimateCentralBlast 0.7s ease-out forwards",
                    }}
                />
                {/* Rayo direccional del color de la afinidad */}
                <div className="fixed z-[200] pointer-events-none"
                    style={{
                        left: x, top: y,
                        width: 650, height: 50,
                        marginLeft: -325, marginTop: -25,
                        background: `linear-gradient(90deg, transparent 0%, ${cfg.glow}66 20%, ${as.colors[0]}ff 50%, ${cfg.glow}66 80%, transparent 100%)`,
                        transform: `rotate(${impactDeg}deg)`,
                        animation: "ultimatePillar 0.75s ease-out forwards",
                    }}
                />
                {/* Partículas en cono — con colores por afinidad */}
                {Array.from({ length: particleCount }).map((_, i) => {
                    const spread = Math.PI * 0.85;
                    const angle = impactAngle - spread / 2 + (i / particleCount) * spread * 1.5;
                    const dist = 55 + Math.random() * 120;
                    const tx = Math.cos(angle) * dist;
                    const ty = Math.sin(angle) * dist;
                    const size = 4 + Math.floor(Math.random() * 10);
                    const col = as.colors[i % as.colors.length];
                    return (
                        <div key={`up${i}`} className="fixed z-[203] pointer-events-none rounded-full"
                            style={{
                                left: x, top: y,
                                width: size, height: size,
                                marginLeft: -size / 2, marginTop: -size / 2,
                                background: col,
                                boxShadow: `0 0 ${size * 2}px ${cfg.glow}`,
                                animation: `ultimateParticle 1.1s ease-out ${i * 0.022}s forwards`,
                                "--tx": `${tx}px`, "--ty": `${ty}px`,
                            } as React.CSSProperties}
                        />
                    );
                })}
                {/* Shards angulares */}
                {Array.from({ length: shardCount }).map((_, i) => {
                    const spread = Math.PI * 0.9;
                    const angle = impactAngle - spread / 2 + (i / shardCount) * spread;
                    const dist = 70 + Math.random() * 90;
                    const tx = Math.cos(angle) * dist;
                    const ty = Math.sin(angle) * dist;
                    const col = as.colors[i % as.colors.length];
                    return (
                        <div key={`us${i}`} className="fixed z-[203] pointer-events-none"
                            style={{
                                left: x, top: y,
                                width: 3, height: 14 + Math.floor(Math.random() * 14),
                                marginLeft: -1.5, marginTop: -7,
                                background: `linear-gradient(180deg, #ffffff 0%, ${col} 100%)`,
                                boxShadow: `0 0 6px ${cfg.glow}`,
                                borderRadius: 2,
                                transform: `rotate(${angle * (180 / Math.PI)}deg)`,
                                animation: `ultimateParticle 0.95s ease-out ${i * 0.04}s forwards`,
                                "--tx": `${tx}px`, "--ty": `${ty}px`,
                            } as React.CSSProperties}
                        />
                    );
                })}
                {/* Screen shake sutil SIN flash blanco */}
                <div className="fixed inset-0 z-[199] pointer-events-none"
                    style={{ animation: "ultimateScreenShake 0.7s ease-out forwards" }}
                />
            </>
        );
    }

    // ── Niveles 1 y 2 — explosión por afinidad ───────────────────────────────
    const rings = level === 1 ? 1 : 3;
    const maxSize = level === 1 ? 55 : 110;
    const particleCount2 = level === 1 ? 0 : 10;

    // Formas especiales por afinidad
    const renderAffinityDetail = () => {
        const count = level === 1 ? 4 : level === 2 ? 7 : 12;
        const spread = maxSize * 0.35;

        if (affinity === "EMBER") {
            return Array.from({ length: count }).map((_, i) => {
                const angle = (i / count) * Math.PI * 2;
                const d = spread * (0.6 + (i % 3) * 0.3);
                const h = 16 + (i % 4) * 10;
                return (
                    <div key={`fl${i}`} className="absolute pointer-events-none"
                        style={{
                            width: 5 + (i % 3) * 3, height: h,
                            left: Math.cos(angle) * d, top: Math.sin(angle) * d - h / 2,
                            background: `linear-gradient(180deg, #fff7 0%, #ffcc00 30%, #ff6b00 70%, #ff4500 100%)`,
                            boxShadow: `0 0 12px #ff6b00, 0 0 24px #ff450066`,
                            borderRadius: "50% 50% 25% 25%",
                            transformOrigin: "bottom center",
                            transform: `rotate(${(angle * 180 / Math.PI) + 90}deg)`,
                            animation: `centralFlash ${0.4 + (i % 3) * 0.1}s ease-out ${i * 0.03}s forwards`,
                        }}
                    />
                );
            });
        }

        if (affinity === "FROST") {
            const pts = level === 1 ? 5 : level === 2 ? 8 : 12;
            return Array.from({ length: pts }).map((_, i) => {
                const angle = (i / pts) * Math.PI * 2;
                const d = spread * (0.5 + (i % 2) * 0.4);
                const len = 12 + (i % 3) * 10;
                return (
                    <div key={`cr${i}`} className="absolute pointer-events-none"
                        style={{
                            width: 3 + (i % 2), height: len,
                            left: Math.cos(angle) * d, top: Math.sin(angle) * d - len / 2,
                            background: `linear-gradient(180deg, #ffffff 0%, #bae6fd 50%, #7dd3fc 100%)`,
                            boxShadow: `0 0 8px #7dd3fc, 0 0 16px #38bdf888`,
                            borderRadius: 2,
                            transform: `rotate(${angle * 180 / Math.PI}deg)`,
                            animation: `iceSpike ${0.35 + (i % 3) * 0.06}s ease-out ${i * 0.04}s forwards`,
                        }}
                    />
                );
            });
        }

        if (affinity === "VOLT") {
            const bolts = level === 1 ? 3 : level === 2 ? 6 : 10;
            return Array.from({ length: bolts }).map((_, i) => {
                const angle = impactAngle + ((i / bolts) - 0.5) * Math.PI * (level === 3 ? 1.4 : 0.9);
                const len = maxSize * (0.5 + (i % 2) * 0.25);
                return (
                    <div key={`z${i}`} className="absolute pointer-events-none"
                        style={{
                            width: 2 + (i % 3), height: len,
                            left: 0, top: -len / 2,
                            background: `linear-gradient(180deg, #ffffff 0%, #fef08a 40%, #fde047 100%)`,
                            boxShadow: `0 0 10px #fde047, 0 0 22px #fde04788`,
                            borderRadius: 1,
                            transform: `rotate(${angle * 180 / Math.PI + 90}deg)`,
                            transformOrigin: "center bottom",
                            animation: `arcZap ${0.28 + (i % 3) * 0.06}s ease-out ${i * 0.04}s forwards`,
                        }}
                    />
                );
            });
        }

        if (affinity === "TIDE") {
            const drops = level === 1 ? 5 : level === 2 ? 8 : 13;
            return Array.from({ length: drops }).map((_, i) => {
                const angle = impactAngle + ((i / drops) - 0.5) * Math.PI * 1.2;
                const d = spread * (0.4 + (i % 3) * 0.25);
                const sz = 7 + (i % 4) * 5;
                return (
                    <div key={`w${i}`} className="absolute rounded-full pointer-events-none"
                        style={{
                            width: sz * 0.65, height: sz,
                            left: Math.cos(angle) * d - sz * 0.3,
                            top: Math.sin(angle) * d - sz / 2,
                            background: `radial-gradient(circle at 35% 25%, #e0f2fe, #38bdf8)`,
                            boxShadow: `0 0 8px #0ea5e9`,
                            animation: `particleFly 0.55s ease-out ${i * 0.04}s forwards`,
                            "--tx": `${Math.cos(angle) * (d + 20)}px`,
                            "--ty": `${Math.sin(angle) * (d + 20)}px`,
                        } as React.CSSProperties}
                    />
                );
            });
        }

        if (affinity === "GROVE") {
            const leaves = level === 1 ? 5 : level === 2 ? 9 : 14;
            return Array.from({ length: leaves }).map((_, i) => {
                const angle = (i / leaves) * Math.PI * 2;
                const d = spread * (0.3 + (i % 3) * 0.35);
                const tx = Math.cos(angle + 0.4) * (d + 35);
                const ty = Math.sin(angle + 0.4) * (d + 35) - 30;
                return (
                    <div key={`lf${i}`} className="absolute pointer-events-none"
                        style={{
                            width: 8 + (i % 3) * 4, height: 12 + (i % 4) * 5,
                            left: Math.cos(angle) * d, top: Math.sin(angle) * d,
                            background: i % 3 === 0
                                ? `radial-gradient(ellipse, #86efac, #16a34a)`
                                : i % 3 === 1
                                ? `radial-gradient(ellipse, #4ade80, #166534)`
                                : `radial-gradient(ellipse, #d9f99d, #65a30d)`,
                            borderRadius: "50% 10% 50% 10%",
                            transform: `rotate(${angle * 120}deg)`,
                            animation: `leafFloat 0.7s ease-out ${i * 0.045}s forwards`,
                            "--tx": `${tx}px`, "--ty": `${ty}px`, "--tr": `${angle * 180}deg`,
                        } as React.CSSProperties}
                    />
                );
            });
        }

        if (affinity === "STONE") {
            const frags = level === 1 ? 5 : level === 2 ? 8 : 12;
            return Array.from({ length: frags }).map((_, i) => {
                const angle = impactAngle + ((i / frags) - 0.5) * Math.PI * 1.1;
                const d = spread * (0.5 + (i % 3) * 0.3);
                const sz = 5 + (i % 4) * 5;
                return (
                    <div key={`st${i}`} className="absolute pointer-events-none"
                        style={{
                            width: sz, height: sz * 0.7,
                            left: Math.cos(angle) * d, top: Math.sin(angle) * d,
                            background: `linear-gradient(135deg, #d6d3d1, #78716c, #57534e)`,
                            boxShadow: `0 2px 6px rgba(0,0,0,0.5)`,
                            borderRadius: 2,
                            transform: `rotate(${angle * 45}deg)`,
                            animation: `particleFly ${0.45 + (i % 3) * 0.1}s ease-out ${i * 0.04}s forwards`,
                            "--tx": `${Math.cos(angle) * (d + 30)}px`,
                            "--ty": `${Math.sin(angle) * (d + 30)}px`,
                        } as React.CSSProperties}
                    />
                );
            });
        }

        if (affinity === "VENOM") {
            const bubbles = level === 1 ? 4 : level === 2 ? 7 : 11;
            return Array.from({ length: bubbles }).map((_, i) => {
                const angle = (i / bubbles) * Math.PI * 2;
                const d = spread * (0.3 + (i % 3) * 0.3);
                const sz = 10 + (i % 4) * 8;
                return (
                    <div key={`vn${i}`} className="absolute rounded-full pointer-events-none"
                        style={{
                            width: sz, height: sz,
                            left: Math.cos(angle) * d - sz / 2, top: Math.sin(angle) * d - sz / 2,
                            background: `radial-gradient(circle at 35% 30%, #bbf7d0aa, #4ade8066, transparent)`,
                            border: `1px solid #4ade8066`,
                            boxShadow: `0 0 10px #4ade8044, inset 0 0 6px #4ade8022`,
                            animation: `venomCloud ${0.5 + (i % 3) * 0.12}s ease-out ${i * 0.05}s forwards`,
                        }}
                    />
                );
            });
        }

        if (affinity === "ASTRAL") {
            const stars = level === 1 ? 5 : level === 2 ? 9 : 14;
            return Array.from({ length: stars }).map((_, i) => {
                const angle = (i / stars) * Math.PI * 2;
                const d = spread * (0.4 + (i % 3) * 0.35);
                const sz = 4 + (i % 4) * 4;
                return (
                    <div key={`as${i}`} className="absolute rounded-full pointer-events-none"
                        style={{
                            width: sz, height: sz,
                            left: Math.cos(angle) * d - sz / 2, top: Math.sin(angle) * d - sz / 2,
                            background: i % 2 === 0
                                ? `radial-gradient(circle, #ffffff, #a5b4fc)`
                                : `radial-gradient(circle, #e0e7ff, #818cf8)`,
                            boxShadow: `0 0 ${sz * 2}px #818cf8, 0 0 ${sz * 4}px #818cf844`,
                            animation: `centralFlash ${0.4 + (i % 3) * 0.1}s ease-out ${i * 0.04}s forwards`,
                        }}
                    />
                );
            });
        }

        if (affinity === "IRON") {
            const sparks = level === 1 ? 6 : level === 2 ? 10 : 16;
            return Array.from({ length: sparks }).map((_, i) => {
                const angle = impactAngle + ((i / sparks) - 0.5) * Math.PI * 1.3;
                const d = spread * (0.3 + (i % 3) * 0.4);
                return (
                    <div key={`ir${i}`} className="absolute pointer-events-none"
                        style={{
                            width: 2, height: 8 + (i % 4) * 5,
                            left: Math.cos(angle) * d, top: Math.sin(angle) * d,
                            background: `linear-gradient(180deg, #f1f5f9 0%, #94a3b8 50%, #475569 100%)`,
                            boxShadow: `0 0 6px #cbd5e1, 0 0 12px #94a3b844`,
                            transform: `rotate(${angle * 180 / Math.PI + 90}deg)`,
                            animation: `particleFly ${0.3 + (i % 3) * 0.08}s ease-out ${i * 0.03}s forwards`,
                            "--tx": `${Math.cos(angle) * (d + 25)}px`,
                            "--ty": `${Math.sin(angle) * (d + 25)}px`,
                        } as React.CSSProperties}
                    />
                );
            });
        }

        if (affinity === "SHADE") {
            const tentacles = level === 1 ? 4 : level === 2 ? 6 : 9;
            return Array.from({ length: tentacles }).map((_, i) => {
                const angle = impactAngle + ((i / tentacles) - 0.5) * Math.PI * 1.5;
                const len = spread * (0.7 + (i % 3) * 0.4);
                return (
                    <div key={`sh${i}`} className="absolute pointer-events-none"
                        style={{
                            width: len, height: 4 + (i % 3) * 2,
                            left: -len / 2, top: -(2 + (i % 3)),
                            background: `linear-gradient(90deg, transparent 0%, #7c3aed88 30%, #4c1d95cc 60%, transparent 100%)`,
                            boxShadow: `0 0 10px #7c3aedaa`,
                            borderRadius: 4,
                            transform: `rotate(${angle * 180 / Math.PI}deg)`,
                            transformOrigin: "center center",
                            animation: `shadeWave ${0.45 + (i % 3) * 0.1}s ease-out ${i * 0.05}s forwards`,
                        }}
                    />
                );
            });
        }

        return null;
    };

    return (
        <div className="fixed z-[101] pointer-events-none"
            style={{ left: x, top: y, transform: "translate(-50%,-50%)" }}
        >
            {/* Anillos de expansión del color de la afinidad */}
            {Array.from({ length: rings }).map((_, i) => (
                <div key={i} className="absolute rounded-full"
                    style={{
                        border: `${level === 1 ? 2 : 3}px solid ${as.colors[i % as.colors.length]}`,
                        width: maxSize, height: maxSize,
                        top: -maxSize / 2, left: -maxSize / 2,
                        animation: `ringExpand ${0.32 + i * 0.1}s ease-out ${i * 0.07}s forwards`,
                        opacity: 1 - i * 0.2,
                        boxShadow: `0 0 ${8 + i * 8}px ${cfg.glow}`,
                    }}
                />
            ))}
            {/* Flash central de color */}
            <div className="absolute rounded-full"
                style={{
                    background: `radial-gradient(circle, ${as.colors[3] ?? "#fff"}ee 0%, ${cfg.glow}88 45%, transparent 100%)`,
                    width: maxSize * 0.55, height: maxSize * 0.55,
                    top: -maxSize * 0.275, left: -maxSize * 0.275,
                    animation: "centralFlash 0.3s ease-out forwards",
                }}
            />
            {/* Detalle por afinidad */}
            {renderAffinityDetail()}
            {/* Partículas radiales */}
            {Array.from({ length: particleCount2 }).map((_, i) => {
                const spread = Math.PI * 1.4;
                const angle = impactAngle - spread / 2 + (i / particleCount2) * spread;
                const dist = 50;
                const tx = Math.cos(angle) * dist;
                const ty = Math.sin(angle) * dist;
                const col = as.colors[i % as.colors.length];
                return (
                    <div key={`p${i}`} className="absolute rounded-full"
                        style={{
                            width: 7, height: 7,
                            background: col,
                            top: -3.5, left: -3.5,
                            boxShadow: `0 0 8px ${cfg.glow}`,
                            animation: `particleFly 0.6s ease-out ${i * 0.04}s forwards`,
                            "--tx": `${tx}px`, "--ty": `${ty}px`,
                        } as React.CSSProperties}
                    />
                );
            })}
        </div>
    );
}

// ─────────────────────────────────────────
// DistortionBar — barra de distorsión con segmentos, integrada bajo la HP bar
// ─────────────────────────────────────────
// Segmentos coloreados según la rareza de la SIGUIENTE forma (nextFormRarity).
// En forma final: DIST MAX con el color de la rareza ACTUAL.

function DistortionBar({
    myth,
    info,
}: {
    myth: BattleMyth;
    info: { isFinal: true } | { isFinal: false; elapsed: number; interval: number; distortsThisTurn: boolean };
}) {
    // Rarity colors — sourced from CSS variables (style.css :root --rarity-*)
    const rarityKeys = ["COMMON","RARE","EPIC","ELITE","LEGENDARY","MYTHIC"] as const;
    type RarityKey = typeof rarityKeys[number];
    const raritySlug: Record<RarityKey, string> = {
        COMMON: "common", RARE: "rare", EPIC: "epic",
        ELITE: "elite", LEGENDARY: "legendary", MYTHIC: "mythic",
    };
    const rarityColors: Record<string, { fill: string; dim: string; glow: string }> = Object.fromEntries(
        rarityKeys.map(r => {
            const s = raritySlug[r];
            return [r, {
                fill: `var(--rarity-${s}-color)`,
                dim:  `var(--rarity-${s}-bg)`,
                glow: `var(--rarity-${s}-glow)`,
            }];
        })
    );

    // DIST MAX: usa rareza de la forma ACTUAL (ya es la última)
    if (info.isFinal) {
        return (
            <div style={{ width: "100%", height: 15, marginTop: 3 }}>
                <div style={{
                    width: "100%", height: "100%", borderRadius: 5,
                    background: "linear-gradient(270deg, #7c3aed, #a855f7, #c084fc, #9333ea, #7c3aed)",
                    backgroundSize: "300% 300%",
                    animation: "distortMaxShimmer 3s ease infinite, distortMaxGlow 2.2s ease-in-out infinite",
                    border: "1px solid #a855f788",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative",
                }}>
                    <span style={{
                        fontSize: "9px", fontFamily: "monospace", fontWeight: 900,
                        letterSpacing: "0.16em",
                        animation: "distortMaxText 2.2s ease-in-out infinite",
                        position: "absolute",
                        left: "50%",
                        transform: "translateX(-50%)",
                        whiteSpace: "nowrap",
                    }}>✦ DIST MAX ✦</span>
                </div>
            </div>
        );
    }

    // Barra de progreso: coloreada según la SIGUIENTE forma (nextFormRarity)
    const rc = rarityColors[myth.nextFormRarity ?? myth.rarity ?? "COMMON"] ?? rarityColors.COMMON;

    const { elapsed, interval, distortsThisTurn } = info;
    const segments = Math.max(1, interval + 1);
    const filled = distortsThisTurn ? segments : Math.min(elapsed + 1, segments - 1);
    const isImminent = distortsThisTurn;

    return (
        <div style={{ width: "100%", height: 15, display: "flex", gap: 2, marginTop: 3 }}>
            {Array.from({ length: segments }).map((_, i) => {
                const isFilled   = i < filled;
                const isLastFill = i === filled - 1;
                const shouldPulse = isImminent ? isFilled : isLastFill;
                return (
                    <div
                        key={i}
                        style={{
                            flex: 1,
                            height: "100%",
                            borderRadius: 5,
                            background: isFilled
                                ? (isImminent ? rc.fill : (isLastFill ? rc.fill : rc.fill + "88"))
                                : rc.dim,
                            border: `1px solid ${isFilled
                                ? (isImminent ? rc.glow : rc.glow + (isLastFill ? "cc" : "44"))
                                : rc.glow + "22"}`,
                            boxShadow: shouldPulse
                                ? `0 0 8px ${rc.glow}cc, 0 0 16px ${rc.glow}55`
                                : isFilled ? `0 0 4px ${rc.glow}44` : "none",
                            transition: "background 0.4s ease, box-shadow 0.4s ease",
                        }}
                    />
                );
            })}
        </div>
    );
}

// ─────────────────────────────────────────
// ArenaMyth — versión estilo Pokémon (sin borde de carta)
// ─────────────────────────────────────────

interface ArenaMythProps {
    myth: BattleMyth;
    side: "player" | "enemy";
    isActing?: boolean;
    targeted?: boolean;
    flashAffinity?: Affinity | null;
    floatingDmg?: { value: number; crit: boolean; mult: number; heal?: boolean; shieldAbsorbed?: number } | null;
    supportOverlay?: { text: string; color: string; glow: string } | null;
    koOverlay?: boolean;
    onClick?: () => void;
    spriteSize?: number;
    mythRef?: React.RefObject<HTMLDivElement | null>;
    distortionInfo?: { isFinal: true } | { isFinal: false; elapsed: number; interval: number; distortsThisTurn: boolean }; // info de distorsión para la barra
}

function ArenaMyth({
    myth,
    side,
    isActing,
    targeted,
    targetColor,
    flashAffinity,
    floatingDmg,
    supportOverlay,
    koOverlay,
    onClick,
    spriteSize = 80,
    mythRef,
    distortionInfo,
    statusBlockedOverlays = {},
    statusEffectOverlays = {},
}: ArenaMythProps & { targetColor?: string; statusBlockedOverlays?: Record<string, string>; statusEffectOverlays?: Record<string, string> }) {
    const cfg = flashAffinity ? AFFINITY_CONFIG[flashAffinity] : null;
    const canClick = onClick && !myth.defeated;
    const primaryAffinity = myth.affinities?.[0];
    const afCfg = primaryAffinity ? AFFINITY_CONFIG[primaryAffinity] : null;

    // Separar buffs (multiplicador > 1) de debuffs (multiplicador < 1)
    const buffs = myth.buffs?.filter((b) => b.multiplier > 1) ?? [];
    const debuffs = myth.buffs?.filter((b) => b.multiplier < 1) ?? [];
    const hasShield = (myth.shield ?? 0) > 0 && (myth.shieldTurns ?? 0) > 0;

    return (
        <div
            ref={mythRef}
            className={`relative flex flex-col items-center gap-0.5 select-none ${canClick ? "cursor-pointer" : ""}`}
            onClick={canClick ? onClick : undefined}
        >
            {/* Buffs/Debuffs — 2 filas estilo LoL, absolutos encima del sprite */}
            {!myth.defeated && (buffs.length > 0 || debuffs.length > 0 || hasShield) && (
                <div className="absolute z-20 pointer-events-none flex flex-col items-center gap-0.5"
                    style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 3 }}>
                    {/* Fila 1 — Buffs (verde) + escudo */}
                    {(buffs.length > 0 || hasShield) && (
                        <div className="flex gap-0.5 justify-center flex-wrap">
                            {hasShield && (
                                <div
                                    title={`Shield: ${myth.shield} pts · ${myth.shieldTurns}t`}
                                    style={{
                                        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2,
                                        width: 22, height: 22, borderRadius: 4,
                                        background: "linear-gradient(135deg, #1e3a8a, #1e40af)",
                                        border: "1.5px solid #60a5fa",
                                        boxShadow: "0 0 8px rgba(96,165,250,0.5)",
                                    }}>
                                    <span style={{ fontSize: "11px", lineHeight: 1 }}>🛡️</span>
                                    <span style={{ fontSize: "8px", fontFamily: "monospace", fontWeight: 900, color: "#bfdbfe", lineHeight: 1 }}>{myth.shieldTurns}</span>
                                </div>
                            )}
                            {buffs.map((b, i) => (
                                <div key={`buff${i}`}
                                    title={`${b.label ?? b.stat?.toUpperCase() ?? ""} ×${b.multiplier.toFixed(1)} (${b.turnsLeft}t)`}
                                    style={{
                                        width: 22, height: 22, borderRadius: 4,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        background: "linear-gradient(135deg, #14532d, #166534)",
                                        border: "1.5px solid #4ade80",
                                        boxShadow: "0 0 6px rgba(74,222,128,0.4)",
                                        fontSize: "12px", lineHeight: 1,
                                    }}>
                                    {b.emoji}
                                </div>
                            ))}
                        </div>
                    )}
                    {/* Fila 2 — Debuffs (rojo) */}
                    {debuffs.length > 0 && (
                        <div className="flex gap-0.5 justify-center flex-wrap">
                            {debuffs.map((b, i) => (
                                <div key={`debuff${i}`}
                                    title={`${b.label ?? b.stat?.toUpperCase() ?? ""} ×${b.multiplier.toFixed(1)} (${b.turnsLeft}t)`}
                                    style={{
                                        width: 22, height: 22, borderRadius: 4,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        background: "linear-gradient(135deg, #7f1d1d, #991b1b)",
                                        border: "1.5px solid #f87171",
                                        boxShadow: "0 0 6px rgba(248,113,113,0.4)",
                                        fontSize: "12px", lineHeight: 1,
                                    }}>
                                    {b.emoji}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Daño / curación flotante — no renderizar si es +0 */}
            {floatingDmg && (!floatingDmg.heal || floatingDmg.value > 0) && (() => {
                const absorbed = floatingDmg.shieldAbsorbed ?? 0;
                const realDmg = floatingDmg.heal ? 0 : Math.max(0, floatingDmg.value - absorbed);
                const onlyShield = absorbed > 0 && realDmg === 0;
                return (
                <>
                    {/* Texto CRÍTICO — solo texto, rojo agresivo, animación propia más grande */}
                    {floatingDmg.crit && !floatingDmg.heal && (
                        <div
                            className="absolute z-31 pointer-events-none font-black uppercase animate-crit-label"
                            style={{
                                top: -88,
                                left: "50%",
                                transform: "translateX(-50%)",
                                fontSize: "2.1rem",
                                color: "#ff1111",
                                WebkitTextStroke: "1.5px #7f0000",
                                letterSpacing: "0.12em",
                                whiteSpace: "nowrap",
                                textShadow: "0 0 20px #ff0000, 0 0 45px #ff000088, 0 0 80px #ff000044, 0 3px 8px rgba(0,0,0,1)",
                                lineHeight: 1,
                            }}
                        >
                            CRÍTICO
                        </div>
                    )}
                    {/* Número azul — escudo absorbido (siempre si absorbed > 0) */}
                    {absorbed > 0 && (
                        <div
                            className="absolute z-30 pointer-events-none font-black tracking-tighter animate-float-dmg"
                            style={{
                                top: onlyShield ? (floatingDmg.crit ? -40 : -24) : -44,
                                left: onlyShield ? "50%" : "38%",
                                transform: "translateX(-50%)",
                                fontSize: onlyShield ? (floatingDmg.crit ? "3.2rem" : "1.8rem") : "1.5rem",
                                color: "#60a5fa",
                                textShadow: "0 0 12px #3b82f6, 0 0 24px #3b82f688, 0 2px 4px rgba(0,0,0,0.9)",
                                letterSpacing: "-0.02em",
                                whiteSpace: "nowrap",
                            }}
                        >
                            🛡️−{absorbed}
                        </div>
                    )}
                    {/* Número blanco — daño real que pasa el escudo (solo si > 0) */}
                    {!floatingDmg.heal && realDmg > 0 && (
                        <div
                            className={`absolute z-30 pointer-events-none font-black tracking-tighter
                                ${floatingDmg.crit ? "animate-crit-dmg" : "animate-float-dmg"}
                                ${floatingDmg.crit ? "text-red-400" : floatingDmg.mult >= 2 ? "text-orange-400" : floatingDmg.mult <= 0.5 ? "text-blue-300" : "text-white"}`}
                            style={{
                                top: absorbed > 0 ? -24 : (floatingDmg.crit ? -40 : -24),
                                left: absorbed > 0 ? "62%" : "50%",
                                transform: "translateX(-50%)",
                                fontSize: absorbed > 0 ? "1.5rem" : (floatingDmg.crit ? "3.2rem" : "1.8rem"),
                                textShadow: floatingDmg.crit
                                    ? "0 0 24px #ff2222, 0 0 50px #ff000088, 0 2px 6px rgba(0,0,0,1)"
                                    : "0 0 10px currentColor, 0 2px 4px rgba(0,0,0,0.8)",
                                letterSpacing: "-0.02em",
                                whiteSpace: "nowrap",
                            }}
                        >
                            −{realDmg}
                        </div>
                    )}
                    {/* Curación */}
                    {floatingDmg.heal && floatingDmg.value > 0 && (
                        <div
                            className="absolute z-30 pointer-events-none font-black tracking-tighter animate-float-dmg text-emerald-400"
                            style={{
                                top: -24,
                                left: "50%",
                                transform: "translateX(-50%)",
                                fontSize: "1.8rem",
                                textShadow: "0 0 12px #4ade80, 0 2px 4px rgba(0,0,0,0.8)",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            +{floatingDmg.value}
                        </div>
                    )}
                    {/* Fallo */}
                    {!floatingDmg.heal && floatingDmg.value === 0 && absorbed === 0 && (
                        <div
                            className="absolute z-30 pointer-events-none font-black tracking-tighter animate-float-dmg text-white"
                            style={{ top: -24, left: "50%", transform: "translateX(-50%)", fontSize: "1.8rem", textShadow: "0 2px 4px rgba(0,0,0,0.8)" }}
                        >
                            Miss!
                        </div>
                    )}
                </>
                );
            })()}

            {/* Support overlay — BUFF / DEBUFF / STATUS */}
            {supportOverlay && (
                <div
                    className="absolute z-40 pointer-events-none animate-support-overlay font-black text-center whitespace-nowrap"
                    style={{
                        top: -40,
                        left: "50%",
                        transform: "translateX(-50%)",
                        fontSize: "1rem",
                        color: supportOverlay.color,
                        textShadow: `0 0 14px ${supportOverlay.glow}, 0 0 28px ${supportOverlay.glow}88, 0 2px 4px rgba(0,0,0,0.9)`,
                        letterSpacing: "0.08em",
                    }}
                >
                    {supportOverlay.text}
                </div>
            )}


            {/* Status blocked overlay — pierde turno por estado */}
            {statusBlockedOverlays[myth.instanceId] && (() => {
                const st = statusBlockedOverlays[myth.instanceId];
                const sc = STATUS_LOG_COLORS[st] ?? "#94a3b8";
                const blockText: Record<string, string> = { burn:"BURNED!", poison:"POISONED!", paralyze:"PARALYZED!", freeze:"FROZEN!", fear:"FEARED!", stun:"STUNNED!", curse:"CURSED!" };
                return (
                    <div className="absolute z-50 pointer-events-none"
                        style={{ top: "50%", left: "50%", transform: "translateX(-50%) translateY(-50%)", animation: "statusBlockedOverlay 2s ease-out forwards" }}>
                        <div style={{
                            display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                            background: `rgba(7,11,20,0.88)`, borderRadius: 10,
                            border: `2px solid ${sc}`,
                            padding: "8px 12px",
                            boxShadow: `0 0 20px ${sc}66, 0 0 40px ${sc}33`,
                        }}>
                            <StatusIcon status={st} size={36} />
                            <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: 900, color: sc, letterSpacing: "0.1em", whiteSpace: "nowrap", textShadow: `0 0 8px ${sc}` }}>
                                {blockText[st] ?? st.toUpperCase()}
                            </span>
                        </div>
                    </div>
                );
            })()}

            {/* Muerte — explosión blanca CSS + aura lila */}
            {koOverlay && (
                <div className="absolute inset-0 pointer-events-none z-50">
                    {/* Burst radial blanco — onda expansiva */}
                    {[0,1,2].map(i => (
                        <div key={i} className="absolute rounded-full" style={{
                            left: "50%", top: "40%",
                            width: spriteSize * (0.6 + i * 0.5),
                            height: spriteSize * (0.6 + i * 0.5),
                            marginLeft: -spriteSize * (0.3 + i * 0.25),
                            marginTop: -spriteSize * (0.3 + i * 0.25),
                            border: `${3 - i}px solid ${i === 0 ? "#ffffff" : i === 1 ? "#e9d5ff" : "#a855f7"}`,
                            boxShadow: i === 0 ? "0 0 20px #ffffff, 0 0 40px #ffffff88" : `0 0 12px #a855f7${i === 1 ? "88" : "44"}`,
                            animation: `deathRing ${0.5 + i * 0.15}s ease-out ${i * 0.08}s forwards`,
                        }} />
                    ))}
                    {/* Partículas lilas dispersándose */}
                    {Array.from({ length: 12 }, (_, i) => {
                        const angle = (i / 12) * Math.PI * 2;
                        const dist = spriteSize * (0.5 + (i % 3) * 0.2);
                        return (
                            <div key={i} className="absolute rounded-full" style={{
                                left: "50%", top: "40%",
                                width: 4 + (i % 4) * 3,
                                height: 4 + (i % 4) * 3,
                                marginLeft: -2, marginTop: -2,
                                background: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? "#c084fc" : "#a855f7",
                                boxShadow: `0 0 8px ${i % 3 === 0 ? "#ffffff" : "#a855f7"}`,
                                animation: `deathParticle 0.9s ease-out ${i * 0.04}s forwards`,
                                ["--dx" as any]: `${Math.cos(angle) * dist}px`,
                                ["--dy" as any]: `${Math.sin(angle) * dist}px`,
                            } as React.CSSProperties} />
                        );
                    })}
                    {/* Flash blanco central */}
                    <div className="absolute rounded-full" style={{
                        left: "50%", top: "40%",
                        width: spriteSize * 1.4, height: spriteSize * 1.4,
                        marginLeft: -spriteSize * 0.7, marginTop: -spriteSize * 0.7,
                        background: "radial-gradient(circle, #ffffff99 0%, #c084fc44 40%, transparent 70%)",
                        animation: "deathFlash 0.6s ease-out forwards",
                    }} />
                    {/* Aura lila flotante — persiste */}
                    <div className="absolute" style={{
                        left: "50%", top: "30%",
                        width: spriteSize * 1.1, height: spriteSize * 1.1,
                        marginLeft: -spriteSize * 0.55, marginTop: -spriteSize * 0.55,
                        animation: "deathAura 3s ease-out 0.4s forwards",
                        background: "radial-gradient(circle, #a855f722 0%, transparent 70%)",
                        borderRadius: "50%",
                    }}>
                        {/* Partículas lilas flotantes que se quedan */}
                        {Array.from({ length: 6 }, (_, i) => (
                            <div key={i} className="absolute rounded-full" style={{
                                width: 4, height: 4,
                                left: `${20 + i * 13}%`,
                                bottom: `${10 + (i % 3) * 15}%`,
                                background: i % 2 === 0 ? "#c084fc" : "#a855f7",
                                boxShadow: "0 0 6px #a855f7",
                                animation: `deathFloat ${1.5 + i * 0.3}s ease-in-out ${0.5 + i * 0.15}s infinite alternate`,
                            }} />
                        ))}
                    </div>
                </div>
            )}

            {/* Sprite container */}
            <div className="relative flex items-end justify-center" style={{ width: spriteSize, height: spriteSize }}>
                {/* Aura Super Saiyan — turno activo */}
                {isActing && !myth.defeated && (
                    <>
                        <div className="active-aura-halo" />
                        <div className="active-aura-ring" />
                        {/* Partículas ascendentes */}
                        {[...Array(5)].map((_, i) => (
                            <div
                                key={`ap${i}`}
                                className="absolute pointer-events-none z-[2] rounded-full"
                                style={{
                                    width: 4 + (i % 3) * 2,
                                    height: 4 + (i % 3) * 2,
                                    bottom: 8 + i * 6,
                                    left: "50%",
                                    background: `rgba(${180 + i * 12}, ${210 + i * 6}, 255, 0.9)`,
                                    boxShadow: `0 0 6px rgba(200,230,255,0.8)`,
                                    ["--px" as any]: `${(i - 2) * 14}px`,
                                    ["--drift" as any]: `${(i % 2 === 0 ? 1 : -1) * (4 + i * 2)}px`,
                                    animation: `activeAuraParticle ${0.9 + i * 0.22}s ease-in ${i * 0.18}s infinite`,
                                }}
                            />
                        ))}
                    </>
                )}
                {/* Status effect overlay — sobre el sprite */}
{/* Status effect overlay — al aplicar o tick, CSS puro sin emojis */}
                {statusEffectOverlays[myth.instanceId] && !myth.defeated && (() => {
                    const st = statusEffectOverlays[myth.instanceId];
                    const sz = spriteSize;
                    const cx = sz / 2;

                    if (st === "burn") return (
                        <div className="absolute inset-0 pointer-events-none z-30" style={{ animation: "burnApply 1.6s ease-out forwards" }}>
                            {[0,1,2,3,4].map(i => {
                                const x = 15 + (i * 17);
                                const delay = i * 0.12;
                                const h = 30 + (i % 3) * 15;
                                return (
                                    <div key={i} className="absolute" style={{
                                        left: `${x}%`, bottom: "5%",
                                        width: 8 + (i%2)*4, height: h,
                                        background: `linear-gradient(180deg, #fff200 0%, #ff6b00 40%, #ff4500 80%, transparent 100%)`,
                                        borderRadius: "50% 50% 20% 20%",
                                        transformOrigin: "bottom center",
                                        animation: `burnFlameRise ${0.5 + delay}s ease-out ${delay}s forwards, burnFlameFlicker 0.2s ease-in-out ${delay}s infinite`,
                                        filter: "blur(1px)",
                                        opacity: 0.9,
                                    }} />
                                );
                            })}
                        </div>
                    );

                    if (st === "poison") return (
                        <div className="absolute inset-0 pointer-events-none z-30">
                            {[0,1,2,3,4,5].map(i => {
                                const x = 10 + (i * 14);
                                const delay = i * 0.1;
                                const bs = 6 + (i%3)*4;
                                return (
                                    <div key={i} className="absolute rounded-full" style={{
                                        left: `${x}%`, bottom: `${15 + (i%2)*10}%`,
                                        width: bs, height: bs,
                                        background: "radial-gradient(circle at 35% 30%, #bbf7d0, #4ade80)",
                                        border: "1px solid #4ade8088",
                                        animation: `poisonBubbleRise ${0.6 + delay}s ease-out ${delay}s forwards, poisonBubblePop 0.2s ease-out ${0.4 + delay}s forwards`,
                                        boxShadow: "0 0 6px #4ade8066",
                                    }} />
                                );
                            })}
                        </div>
                    );

                    if (st === "paralyze") return (
                        <div className="absolute inset-0 pointer-events-none z-30" style={{ animation: "paralyzeShake 0.5s ease-in-out 0.1s 2" }}>
                            {[0,1,2].map(i => {
                                const y = 20 + i * 25;
                                const delay = i * 0.08;
                                return (
                                    <div key={i} className="absolute" style={{
                                        left: "5%", top: `${y}%`,
                                        width: "90%", height: 3,
                                        background: `linear-gradient(90deg, transparent, #fde047, #ffffff, #fde047, transparent)`,
                                        boxShadow: "0 0 8px #fde047, 0 0 16px #fde04766",
                                        animation: `paralyzeZigzag ${0.4 + delay}s ease-out ${delay}s forwards`,
                                        clipPath: "polygon(0% 50%, 8% 0%, 16% 50%, 24% 0%, 32% 50%, 40% 0%, 48% 50%, 56% 0%, 64% 50%, 72% 0%, 80% 50%, 88% 0%, 100% 50%, 88% 100%, 80% 50%, 72% 100%, 64% 50%, 56% 100%, 48% 50%, 40% 100%, 32% 50%, 24% 100%, 16% 50%, 8% 100%, 0% 50%)",
                                    }} />
                                );
                            })}
                        </div>
                    );

                    if (st === "freeze") return (
                        <div className="absolute inset-0 pointer-events-none z-30">
                            {/* Overlay helado */}
                            <div className="absolute inset-0 rounded" style={{
                                background: "radial-gradient(circle, rgba(125,211,252,0.25) 0%, rgba(56,189,248,0.15) 60%, transparent 100%)",
                                animation: "freezeOverlay 1.2s ease-out forwards",
                            }} />
                            {/* Cristales desde los bordes */}
                            {[0,1,2,3,4,5].map(i => {
                                const angle = (i / 6) * 360;
                                const fromEdge = i % 2 === 0;
                                return (
                                    <div key={i} className="absolute" style={{
                                        left: "50%", top: fromEdge ? "0%" : "90%",
                                        marginLeft: -2,
                                        width: 4, height: 20 + (i%3)*12,
                                        background: `linear-gradient(${fromEdge ? 180 : 0}deg, #ffffff 0%, #bae6fd 50%, #7dd3fc 100%)`,
                                        boxShadow: "0 0 6px #7dd3fc",
                                        transformOrigin: fromEdge ? "top center" : "bottom center",
                                        transform: `rotate(${angle * 0.25}deg)`,
                                        animation: `freezeCrystalGrow ${0.35 + i*0.05}s ease-out ${i*0.06}s forwards`,
                                        borderRadius: "2px 2px 0 0",
                                    }} />
                                );
                            })}
                        </div>
                    );

                    if (st === "fear") return (
                        <div className="absolute inset-0 pointer-events-none z-30" style={{ animation: "fearShrink 0.8s ease-in-out 2" }}>
                            {/* Espiral giratoria */}
                            <div className="absolute" style={{
                                left: "50%", top: "50%",
                                marginLeft: -cx * 0.8, marginTop: -cx * 0.8,
                                width: cx * 1.6, height: cx * 1.6,
                                border: "2px solid #c084fc",
                                borderRadius: "50%",
                                borderStyle: "dashed",
                                boxShadow: "0 0 12px #a855f766",
                                animation: "fearSpiral 1.0s ease-out forwards",
                            }} />
                            <div className="absolute" style={{
                                left: "50%", top: "50%",
                                marginLeft: -cx * 0.55, marginTop: -cx * 0.55,
                                width: cx * 1.1, height: cx * 1.1,
                                border: "1.5px solid #a855f7",
                                borderRadius: "50%",
                                borderStyle: "dotted",
                                animation: "fearSpiral 0.8s ease-out 0.15s forwards",
                            }} />
                        </div>
                    );

                    if (st === "stun") return (
                        <div className="absolute pointer-events-none z-30" style={{
                            left: "50%", top: -16,
                            width: 0, height: 0,
                            animation: "stunFadeInOut 1.8s ease-out forwards",
                        }}>
                            {[0,1,2].map(i => (
                                <div key={i} className="absolute" style={{
                                    width: 8, height: 8,
                                    marginLeft: -4, marginTop: -4,
                                    background: i === 0 ? "#fde047" : i === 1 ? "#facc15" : "#fbbf24",
                                    borderRadius: "50% 50% 40% 40%",
                                    boxShadow: `0 0 8px ${i === 0 ? "#fde047" : "#facc15"}`,
                                    transformOrigin: "0 0",
                                    animation: i === 0 ? "stunOrbit1 0.7s linear infinite" : i === 1 ? "stunOrbit2 0.7s linear infinite" : "stunOrbit3 0.7s linear infinite",
                                }} />
                            ))}
                        </div>
                    );

                    if (st === "curse") return (
                        <div className="absolute inset-0 pointer-events-none z-30">
                            {/* Aura oscura */}
                            <div className="absolute inset-0 rounded" style={{
                                background: "radial-gradient(circle, rgba(124,58,237,0.35) 0%, rgba(76,29,149,0.2) 60%, transparent 100%)",
                                animation: "curseAura 1.4s ease-out forwards",
                            }} />
                            {/* Tentáculos */}
                            {[0,1,2,3].map(i => {
                                const angles = ["0deg","90deg","180deg","270deg"];
                                return (
                                    <div key={i} className="absolute" style={{
                                        left: "50%", top: "50%",
                                        marginLeft: -cx * 0.6, marginTop: -1.5,
                                        width: cx * 1.2, height: 3,
                                        background: `linear-gradient(90deg, transparent, #7c3aed, #a855f7, transparent)`,
                                        borderRadius: 2,
                                        transformOrigin: `${cx * 0.6}px center`,
                                        ["--angle" as any]: angles[i],
                                        transform: `rotate(${angles[i]})`,
                                        animation: `curseTentacle ${0.6 + i*0.1}s ease-in-out ${i*0.1}s forwards`,
                                        boxShadow: "0 0 8px #a855f7",
                                    } as React.CSSProperties} />
                                );
                            })}
                        </div>
                    );

                    return null;
                })()}

                {/* Flash de impacto */}
                {cfg && (
                    <div
                        className="absolute inset-0 rounded-full animate-impact-flash pointer-events-none"
                        style={{ background: `radial-gradient(circle, ${cfg.glow}66 0%, transparent 70%)` }}
                    />
                )}
                {/* Target ring — enemy selected effect */}
                {targeted && !myth.defeated && (
                    <>
                        {/* Anillo exterior pulsante */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                inset: -6,
                                border: `2px solid ${targetColor ?? "rgba(248,113,113,0.75)"}`,
                                borderRadius: "50%",
                                animation: "targetRingOuter 1.1s ease-in-out infinite",
                                boxShadow: `0 0 10px ${targetColor ?? "rgba(248,113,113,0.5)"}, 0 0 22px ${targetColor ?? "rgba(248,113,113,0.25)"}`,
                            }}
                        />
                        {/* Anillo interior — desfasado */}
                        <div
                            className="absolute rounded-full pointer-events-none"
                            style={{
                                inset: 2,
                                border: `1.5px solid ${targetColor ?? "rgba(248,113,113,0.45)"}`,
                                borderRadius: "50%",
                                animation: "targetRingInner 1.1s ease-in-out 0.28s infinite",
                            }}
                        />
                        {/* Glow relleno central suave */}
                        <div
                            className="absolute inset-0 rounded-full pointer-events-none"
                            style={{
                                background: `radial-gradient(circle, ${targetColor ?? "rgba(248,113,113,0.12)"} 0%, transparent 70%)`,
                                animation: "targetGlowFill 1.1s ease-in-out infinite",
                            }}
                        />
                    </>
                )}

                {myth.defeated ? (
                    <div style={{ width: spriteSize, height: spriteSize }} />
                ) : (
                    <>
                        <MythArt
                            art={myth.art}
                            px={spriteSize}
                            className={[
                                cfg ? "animate-myth-shake" : isActing ? "animate-myth-idle" : "",
                                isActing && !myth.defeated ? "active-aura-glow" : "",
                            ].filter(Boolean).join(" ")}
                        />

                    </>
                )}


                {/* Escudo */}
                {(myth.shield ?? 0) > 0 && !myth.defeated && (
                    <span className="absolute -top-1 -left-1 text-sm z-20">🛡️</span>
                )}
            </div>

            {/* Sombra */}
            {!myth.defeated && (
                <div className="rounded-full opacity-20 bg-black" style={{ width: spriteSize * 0.7, height: 8, marginTop: -4, filter: "blur(4px)" }} />
            )}

            {/* Info: nombre + HP */}
            <div className="flex flex-col items-center gap-0.5" style={{ width: Math.max(spriteSize, 96) }}>
                {/* Nombre con icono de afinidad */}
                <div className="flex items-center gap-1 justify-center" style={{ maxWidth: Math.max(spriteSize, 96) }}>
                    {isActing && !myth.defeated && <span className="text-yellow-400 animate-pulse" style={{ fontSize: "13px" }}>▶</span>}
                    {myth.affinities?.length > 0 && !myth.defeated && (
                        <div className="flex-shrink-0 flex items-center gap-0.5">
                            {myth.affinities.slice(0, 2).map((aff, ai) => {
                                const ac = AFFINITY_CONFIG[aff as Affinity];
                                if (!ac) return null;
                                return (
                                    <div key={ai} title={aff} style={{ flexShrink: 0, lineHeight: 0 }}>
                                        <AffinityIcon affinity={aff} size={18} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <p
                        className={`font-bold font-mono leading-tight text-center
                            ${myth.defeated ? "text-slate-600" : isActing ? "text-yellow-300" : targeted ? "text-red-400" : "text-white/90"}`}
                        style={{
                            fontSize: "12px",
                            maxWidth: Math.max(spriteSize, 96),
                            wordBreak: "break-word",
                            overflowWrap: "break-word",
                            whiteSpace: "normal",
                            lineHeight: 1.2,
                        }}
                    >
                        {myth.name}
                    </p>
                </div>
                {!myth.defeated && (
                    <>
                        {/* Fila: ⓘ info + Lv badge + HP bar — todo en una sola línea */}
                        {(() => {
                            const [showPop, setShowPop] = React.useState(false);
                            const btnRef = React.useRef<HTMLButtonElement>(null);
                            const popRef = React.useRef<HTMLDivElement>(null);
                            React.useEffect(() => {
                                if (!showPop) return;
                                const close = (e: MouseEvent) => {
                                    if (
                                        btnRef.current && !btnRef.current.contains(e.target as Node) &&
                                        popRef.current && !popRef.current.contains(e.target as Node)
                                    ) setShowPop(false);
                                };
                                const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setShowPop(false); };
                                document.addEventListener("mousedown", close);
                                document.addEventListener("keydown", onKey);
                                return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", onKey); };
                            }, [showPop]);
                            const af = myth.affinities?.[0];
                            const afCfg2 = af ? AFFINITY_CONFIG[af] : null;
                            const rar = myth.rarity ?? "COMMON";
                            // Rarity stats panel colors — CSS variables (style.css :root --rarity-*)
                            const RARITY_SLUGS2: Record<string, string> = {
                                COMMON: "common", RARE: "rare", EPIC: "epic",
                                ELITE: "elite", LEGENDARY: "legendary", MYTHIC: "mythic",
                            };
                            const rarColors2: Record<string, { color: string; border: string; bg: string }> = Object.fromEntries(
                                Object.keys(RARITY_SLUGS2).map(r => {
                                    const s = RARITY_SLUGS2[r];
                                    return [r, {
                                        color:  `var(--rarity-${s}-color)`,
                                        border: `var(--rarity-${s}-border)`,
                                        bg:     `var(--rarity-${s}-bgR)`,
                                    }];
                                })
                            );
                            const rc2 = rarColors2[rar] ?? rarColors2.COMMON;
                            const pctPop = myth.maxHp > 0 ? Math.max(0, myth.hp / myth.maxHp) : 0;
                            const hpClrPop = pctPop > 0.5 ? "#4ade80" : pctPop > 0.25 ? "#fbbf24" : "#f87171";
                            const isPlayerSide = side === "player";
                            return (
                            <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 0, position: "relative" }}>
                            {/* Botón stats — icono 3 líneas */}
                            <button
                                ref={btnRef}
                                onClick={(e) => { e.stopPropagation(); setShowPop(v => !v); }}
                                style={{
                                    flexShrink: 0,
                                    height: 22, width: 22,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: showPop ? "#4338ca" : "rgba(99,102,241,0.2)",
                                    border: showPop ? "1px solid #818cf8" : "1px solid rgba(99,102,241,0.5)",
                                    borderRight: "none",
                                    borderRadius: "6px 0 0 6px",
                                    cursor: "pointer",
                                    transition: "all 0.15s",
                                    boxShadow: showPop ? "0 0 8px rgba(99,102,241,0.5)" : "none",
                                    padding: 0,
                                }}
                            >
                                <svg width="12" height="11" viewBox="0 0 11 10" fill="none">
                                    <line x1="2" y1="2" x2="9" y2="2" stroke={showPop ? "#e2e8f0" : "#a5b4fc"} strokeWidth="1.5" strokeLinecap="round"/>
                                    <line x1="2" y1="5" x2="9" y2="5" stroke={showPop ? "#e2e8f0" : "#a5b4fc"} strokeWidth="1.5" strokeLinecap="round"/>
                                    <line x1="2" y1="8" x2="6.5" y2="8" stroke={showPop ? "#e2e8f0" : "#a5b4fc"} strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                            </button>
                            {/* Popover bocadillo */}
                            {showPop && (
                                <>
                                {/* Backdrop oscuro */}
                                <div
                                    onClick={(e) => { e.stopPropagation(); setShowPop(false); }}
                                    style={{
                                        position: "fixed", inset: 0,
                                        background: "rgba(0,0,0,0.6)",
                                        zIndex: 9998,
                                        backdropFilter: "blur(2px)",
                                    }}
                                />
                                <div
                                    ref={popRef}
                                    onClick={e => e.stopPropagation()}
                                    style={{
                                        position: "fixed",
                                        top: "50%", left: "50%",
                                        transform: "translate(-50%, -50%)",
                                        width: 400,
                                        maxHeight: "80vh",
                                        overflowY: "auto",
                                        zIndex: 9999,
                                        background: "rgba(7,11,20,0.98)",
                                        border: `1px solid ${rc2.border}88`,
                                        borderTop: `3px solid ${rc2.border}`,
                                        borderRadius: 12,
                                        boxShadow: `0 0 0 1px ${rc2.border}22, 0 0 60px ${rc2.border}33, 0 24px 80px rgba(0,0,0,0.95)`,
                                        overflow: "hidden",
                                        animation: "modalPopIn 0.22s cubic-bezier(0.34,1.56,0.64,1) forwards",
                                        backdropFilter: "blur(12px)",
                                    }}
                                >


                                    {/* Header con portrait */}
                                    <div style={{
                                        padding: "12px 14px 10px",
                                        background: `linear-gradient(135deg, ${rc2.bg} 0%, rgba(7,11,20,0.6) 100%)`,
                                        borderBottom: `1px solid ${rc2.border}44`,
                                        display: "flex", alignItems: "center", gap: 10,
                                    }}>
                                        {/* Portrait */}
                                        {myth.art?.portrait && (
                                            <div style={{
                                                width: 60, height: 60, flexShrink: 0,
                                                borderRadius: 8,
                                                border: `2px solid ${rc2.border}88`,
                                                overflow: "hidden",
                                                background: "rgba(0,0,0,0.3)",
                                                boxShadow: `0 0 12px ${rc2.border}44`,
                                            }}>
                                                <img src={myth.art.portrait} alt={myth.name}
                                                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                            </div>
                                        )}
                                        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                                            <span style={{
                                                fontFamily: "'Rajdhani', sans-serif", fontWeight: 900,
                                                fontSize: "16px", color: rc2.color, letterSpacing: "0.04em",
                                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                textShadow: `0 0 12px ${rc2.border}66`,
                                            }}>{myth.name}</span>
                                            <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                                                <span style={{ fontSize: "10px", color: "#93c5fd", fontFamily: "monospace", fontWeight: 900, background: "rgba(29,78,216,0.35)", border: "1px solid rgba(59,130,246,0.5)", borderRadius: 4, padding: "2px 6px" }}>Lv{myth.level}</span>
                                                {myth.affinities?.map((aff, ai) => {
                                                    const ac = AFFINITY_CONFIG[aff as Affinity];
                                                    if (!ac) return null;
                                                    return (
                                                        <span key={ai} style={{ fontSize: "10px", color: ac.glow, fontFamily: "monospace", fontWeight: 900, background: `${ac.glow}22`, border: `1px solid ${ac.glow}55`, borderRadius: 4, padding: "2px 6px", display: "inline-flex", alignItems: "center", gap: 3 }}>
                                                            <AffinityIcon affinity={aff} size={12} /> {ac.label.toUpperCase()}
                                                        </span>
                                                    );
                                                })}
                                                <span style={{ fontSize: "10px", color: rc2.color, fontFamily: "monospace", fontWeight: 900, background: rc2.bg, border: `1px solid ${rc2.border}55`, borderRadius: 4, padding: "2px 6px" }}>{rar}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => setShowPop(false)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: "16px", padding: "4px", lineHeight: 1, flexShrink: 0, borderRadius: 4 }}>✕</button>
                                    </div>

                                    {/* HP */}
                                    <div style={{ padding: "6px 10px 0" }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                            <span style={{ fontSize: "9px", fontFamily: "monospace", color: "#475569", fontWeight: 700 }}>HP</span>
                                            <span style={{ fontSize: "9px", fontFamily: "monospace", color: hpClrPop, fontWeight: 900 }}>{myth.hp}/{myth.maxHp}</span>
                                        </div>
                                        <div style={{ height: 5, borderRadius: 3, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${pctPop*100}%`, background: hpClrPop, borderRadius: 3, transition: "width 0.5s" }} />
                                        </div>
                                        {(myth.shield ?? 0) > 0 && (
                                            <div style={{ fontSize: "8px", fontFamily: "monospace", color: "#60a5fa", marginTop: 2 }}>🛡️ {myth.shield} pts · {myth.shieldTurns}t</div>
                                        )}
                                    </div>

                                    {/* Stats */}
                                    <div style={{ padding: "10px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px" }}>
                                        {[
                                            { icon: "⚔️", label: "ATK",  val: myth.attack },
                                            { icon: "🛡️", label: "DEF",  val: myth.defense },
                                            { icon: "💨", label: "SPD",  val: myth.speed },
                                            { icon: "🎯", label: "ACC",  val: `${myth.accuracy ?? 100}%` },
                                            { icon: "💥", label: "CRIT", val: `${myth.critChance ?? 15}%` },
                                            { icon: "🔥", label: "C.DMG",val: `×${myth.critDamage ? (myth.critDamage <= 150 ? 1.5 : Math.round((1.5 + Math.min(0.75,(myth.critDamage-150)*0.005))*100)/100) : 1.5}` },
                                        ].map(({ icon, label, val }) => (
                                            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                                                <span style={{ fontSize: "11px", flexShrink: 0 }}>{icon}</span>
                                                <span style={{ fontSize: "9px", fontFamily: "monospace", color: "#94a3b8", width: 36, flexShrink: 0 }}>{label}</span>
                                                <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: 900, color: "#f1f5f9" }}>{val}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Status */}
                                    {myth.status && (
                                        <div style={{ margin: "0 12px 8px", padding: "4px 8px", borderRadius: 4, background: `${STATUS_LOG_COLORS[myth.status] ?? "#ef4444"}18`, border: `1px solid ${STATUS_LOG_COLORS[myth.status] ?? "#ef4444"}33`, display: "flex", alignItems: "center", gap: 6 }}>
                                            <StatusIcon status={myth.status} size={16} />
                                            <span style={{ fontSize: "8px", fontFamily: "monospace", color: STATUS_LOG_COLORS[myth.status] ?? "#f87171", fontWeight: 700, textTransform: "uppercase" }}>{myth.status} · {myth.statusTurnsLeft}t</span>
                                        </div>
                                    )}

                                    {/* Moves */}
                                    <div style={{ padding: "4px 14px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
                                        <p style={{ fontSize: "8px", fontFamily: "monospace", color: "#334155", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2 }}>Movimientos</p>
                                        {myth.moves.map((move) => {
                                            const mCfg = AFFINITY_CONFIG[move.affinity];
                                            const onCd = (myth.cooldownsLeft[move.id] ?? 0) > 0;
                                            const lvl = move.cooldown === 0 ? "BAS" : move.cooldown <= 2 ? "CD" : "ULT";
                                            const lvlColor = lvl === "ULT" ? "#fbbf24" : lvl === "CD" ? "#818cf8" : "#475569";
                                            return (
                                                <div key={move.id} style={{
                                                    display: "flex", alignItems: "center", gap: 5,
                                                    padding: "4px 6px", borderRadius: 5,
                                                    background: `${mCfg.glow}0e`,
                                                    border: `1px solid ${onCd ? "rgba(255,255,255,0.04)" : mCfg.glow + "2a"}`,
                                                    opacity: onCd ? 0.45 : 1,
                                                }}>
                                                    <AffinityIcon affinity={move.affinity} size={16} />
                                                    <span style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "11px", fontWeight: 900, color: onCd ? "#334155" : "#e2e8f0", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{move.name}</span>
                                                    <span style={{ fontSize: "7px", fontFamily: "monospace", color: lvlColor, fontWeight: 900, background: `${lvlColor}18`, borderRadius: 2, padding: "1px 3px", flexShrink: 0 }}>{lvl}</span>
                                                    {onCd && <span style={{ fontSize: "8px", fontFamily: "monospace", color: "#ef4444", fontWeight: 900, flexShrink: 0 }}>CD{myth.cooldownsLeft[move.id]}</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                </>
                            )}
                            {/* Lv badge */}
                            <div
                                style={{
                                    flexShrink: 0, height: 22, minWidth: 24,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    background: "#1d4ed8",
                                    border: "1px solid #3b82f6",
                                    borderLeft: "none", borderRight: "none",
                                    fontSize: "10px", color: "#ffffff",
                                    fontFamily: "monospace", fontWeight: 900,
                                    letterSpacing: "0.01em",
                                    paddingLeft: 3, paddingRight: 3,
                                }}
                            >
                                {`Lv${myth.level}`}
                            </div>
                            {/* Barra HP */}
                            <div style={{ flex: 1, position: "relative", height: 14, borderRadius: "0 7px 7px 0", overflow: "visible" }}>
                                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", borderRadius: "0 7px 7px 0", border: "1px solid rgba(255,255,255,0.08)", borderLeft: "none", overflow: "hidden" }}>
                                {(() => {
                                    const pct = myth.maxHp > 0 ? Math.max(0, (myth.hp / myth.maxHp) * 100) : 0;
                                    const shield = myth.shield ?? 0;
                                    const shieldPct = myth.maxHp > 0 ? Math.min(100 - pct, (shield / myth.maxHp) * 100) : 0;
                                    const barColor = pct > 90 ? "#22c55e" : pct > 70 ? "#16a34a" : pct > 50 ? "#84cc16" : pct > 30 ? "#facc15" : pct > 15 ? "#f97316" : pct > 5 ? "#ef4444" : "#b91c1c";
                                    const glowColor = pct > 50 ? "rgba(34,197,94,0.5)" : pct > 25 ? "rgba(250,204,21,0.5)" : "rgba(239,68,68,0.6)";
                                    return (
                                        <>
                                            <div className="absolute left-0 top-0 h-full transition-all duration-700"
                                                style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 6px ${glowColor}` }} />
                                            {shieldPct > 0 && (
                                                <div className="absolute top-0 h-full"
                                                    style={{ left: `${pct}%`, width: `${shieldPct}%`, background: "#60a5fa", boxShadow: "0 0 6px rgba(96,165,250,0.5)" }} />
                                            )}
                                        </>
                                    );
                                })()}
                                </div>
                            </div>
                            </div>
                            );
                        })()}

                        {/* Barra de distorsión — misma anchura que la fila de arriba */}
                        {distortionInfo && (
                            <DistortionBar
                                myth={myth}
                                info={distortionInfo}
                            />
                        )}

                        {/* Estado alterado — fila propia debajo de la barra de distorsión */}
                        {myth.status && (() => {
                            const sc = STATUS_LOG_COLORS[myth.status] ?? "#94a3b8";
                            return (
                                <div style={{ width: "100%", marginTop: 2, display: "flex", gap: 3, flexWrap: "wrap" }}>
                                    <div style={{
                                        display: "inline-flex", alignItems: "center", gap: 4,
                                        background: `${sc}ee`,
                                        border: `1px solid ${sc}`,
                                        borderRadius: 5, padding: "2px 6px",
                                        boxShadow: `0 0 8px ${sc}66`,
                                        flexShrink: 0,
                                    }}>
                                        <StatusIcon status={myth.status} size={16} />
                                        {myth.statusTurnsLeft > 0 && (
                                            <span style={{ fontSize: "10px", fontFamily: "monospace", fontWeight: 900, color: "#ffffff", lineHeight: 1, textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>
                                                {myth.statusTurnsLeft}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </>
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
                    ⚔️ Preparation
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
                            All Myths in battle position
                        </p>
                    )}
                    {partyMyths.length > 0 && (
                        <div className="mb-3">
                            <p className="font-mono text-xs text-slate-500 uppercase tracking-widest mb-2">⚔️ Team</p>
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
                className={`px-12 py-3 rounded-xl border font-mono font-black text-sm tracking-widest uppercase transition-all
        ${
            canStart && !loading
                ? "bg-red/10 border-red/60 text-red hover:bg-red/20 hover:scale-105 shadow-lg shadow-red/20"
                : "bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
        }`}
            >
                {loading ? "Starting..." : `⚔️ Fight (${order.length} Myth${order.length !== 1 ? "s" : ""})`}
            </button>
        </div>
    );
}

// ─────────────────────────────────────────
// ShootingStar — 1 estrella fugaz, posición aleatoria, cada 30-45s
// ─────────────────────────────────────────

function ShootingStar() {
    const [key, setKey] = useState(0);
    const [pos, setPos] = useState({ top: "8%", left: "15%" });

    useEffect(() => {
        function fire() {
            setPos({
                top: `${2 + Math.random() * 22}%`,
                left: `${5 + Math.random() * 60}%`,
            });
            setKey((k) => k + 1);
            // siguiente disparo entre 30 y 45 segundos
            setTimeout(fire, 30000 + Math.random() * 15000);
        }
        // primer disparo entre 3 y 8 segundos tras montar
        const t = setTimeout(fire, 3000 + Math.random() * 5000);
        return () => clearTimeout(t);
    }, []);

    return (
        <div
            key={key}
            style={{
                position: "absolute",
                top: pos.top,
                left: pos.left,
                width: 180,
                height: 2,
                borderRadius: 2,
                transform: "rotate(22deg)",
                transformOrigin: "left center",
                background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.95) 60%, rgba(220,240,255,1) 80%, rgba(255,255,255,0) 100%)",
                boxShadow: "0 0 6px 2px rgba(200,230,255,0.7), 0 0 20px 4px rgba(180,210,255,0.4)",
                animation: "shootingStar 1.1s cubic-bezier(0.4,0,0.6,1) forwards",
            }}
        />
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
                {myth.isInParty ? "party" : "storage"}
            </span>
        </div>
    );
}


// ─────────────────────────────────────────
// ─────────────────────────────────────────
// Main BattlePage
// ─────────────────────────────────────────

type Phase = "prep" | "battle" | "result";
type BattleMode = "npc" | "pvp";

export default function BattlePage() {
    const location = useLocation();
    const navigate = useNavigate();

    // ── Altura real del viewport ──
    useEffect(() => {
        document.body.dataset.page = "battle";
        function setAppHeight() {
            document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
        }
        setAppHeight();
        window.addEventListener("resize", setAppHeight);
        return () => {
            delete document.body.dataset.page;
            window.removeEventListener("resize", setAppHeight);
        };
    }, []);

    // Keyframes de combate → apps/client/src/style.css

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setShowAffinityModal(false);
                setShowBuffsModal(false);
                setShowDebuffsModal(false);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);
    const searchParams = new URLSearchParams(location.search);
    const initialMode: BattleMode =
        (location.state as any)?.mode === "pvp" || searchParams.get("mode") === "pvp" ? "pvp" : "npc";
    const [mode, setMode] = useState<BattleMode>(initialMode);
    const mythRefsMap = useRef<Record<string, React.RefObject<HTMLDivElement | null>>>({});
    const [explosion, setExplosion] = useState<{
        x: number;
        y: number;
        fromX: number;
        fromY: number;
        affinity: Affinity;
        level: 1 | 2 | 3;
    } | null>(null);

    function getMythRef(instanceId: string): React.RefObject<HTMLDivElement | null> {
        if (!mythRefsMap.current[instanceId]) {
            mythRefsMap.current[instanceId] = React.createRef<HTMLDivElement>();
        }
        return mythRefsMap.current[instanceId];
    }

    useEffect(() => {
        const m = (location.state as any)?.mode;
        if (m === "pvp" || m === "npc") setMode(m);
    }, [location.state]);

    const [phase, setPhase] = useState<Phase>("prep");
    const [prepSlots, setPrepSlots] = useState<(any | null)[]>([null, null, null]);
    const [prepSearch, setPrepSearch] = useState("");
    const [enemyRevealIndex, setEnemyRevealIndex] = useState<number>(-1); // cuántos enemigos se han revelado
    const [allMyths, setAllMyths] = useState<any[]>([]);
    const [session, setSession] = useState<BattleSession | null>(null);
    const sessionRef = useRef<BattleSession | null>(null);
    useEffect(() => { sessionRef.current = session; }, [session]);
    const [loadingStart, setLoadingStart] = useState(false);
    const [animating, setAnimating] = useState(false);

    const [currentActorId, setCurrentActorId] = useState<string | null>(null);
    const currentActorIdRef = useRef<string | null>(null);
    useEffect(() => { currentActorIdRef.current = currentActorId; }, [currentActorId]);
    const [targetEnemyMythId, setTargetEnemyMythId] = useState<string | null>(null);
    // (timer eliminado — el jugador elige sin límite de tiempo)

    const [projectile, setProjectile] = useState<ProjectileState | null>(null);
    const [flashMap, setFlashMap] = useState<Record<string, Affinity>>({});
    const [floatMap, setFloatMap] = useState<
        Record<string, { value: number; crit: boolean; mult: number; heal?: boolean; shieldAbsorbed?: number }>
    >({});

    // Overlays flotantes sobre sprites
    const [supportOverlays, setSupportOverlays] = useState<Record<string, { text: string; color: string; glow: string }>>({});
    const [koOverlays, setKoOverlays] = useState<Record<string, boolean>>({});
    const [statusBlockedOverlays, setStatusBlockedOverlays] = useState<Record<string, string>>({});
    const [statusEffectOverlays, setStatusEffectOverlays] = useState<Record<string, string>>({});
    // Distorsión: overlay centrado en el sprite con efecto por rareza
    const [distortionOverlay, setDistortionOverlay] = useState<{
        instanceId: string;
        newName: string;
        newAffinities: string[];
        newRarity: string;
        spriteRect: { x: number; y: number; w: number; h: number };
    } | null>(null);
    // Mapa instanceId → triggerTurn ABSOLUTO (no remaining)
    // Se recalcula desde la sesión en cada finalizeTurn para no perderse
    const [distortionTurnsMap, setDistortionTurnsMap] = useState<Record<string, number>>({});
    const [distortionStartMap,  setDistortionStartMap]  = useState<Record<string, number>>({});

    function triggerKo(instanceId: string) {
        setKoOverlays((prev) => ({ ...prev, [instanceId]: true }));
        setTimeout(() => {
            setKoOverlays((prev) => { const n = { ...prev }; delete n[instanceId]; return n; });
        }, 3600);
    }

    async function triggerDistortion(instanceId: string, newName: string, newAffinities: string[], newRarity: string) {
        const el = mythRefsMap.current[instanceId]?.current;
        const rect = el?.getBoundingClientRect();
        const spriteRect = rect
            ? { x: rect.left, y: rect.top, w: rect.width, h: rect.height }
            : { x: window.innerWidth * 0.3, y: window.innerHeight * 0.4, w: 110, h: 110 };
        // Aplicar animación de shake al sprite antes de mostrar el overlay
        if (el) {
            el.style.animation = "distortSpriteShake 0.5s ease-in-out forwards";
            await sleep(500);
            el.style.animation = "";
        }
        setDistortionOverlay({ instanceId, newName, newAffinities, newRarity, spriteRect });
        await sleep(4500);
        setDistortionOverlay(null);
    }

    function showStatusEffect(instanceId: string, status: string, duration = 1400) {
        setStatusEffectOverlays(prev => ({ ...prev, [instanceId]: status }));
        setTimeout(() => {
            setStatusEffectOverlays(prev => { const n = { ...prev }; delete n[instanceId]; return n; });
        }, duration);
    }

    function showStatusBlockedOverlay(instanceId: string, status: string, duration = 2200) {
        setStatusBlockedOverlays(prev => ({ ...prev, [instanceId]: status }));
        setTimeout(() => {
            setStatusBlockedOverlays(prev => { const n = { ...prev }; delete n[instanceId]; return n; });
        }, duration);
    }

    function showSupportOverlay(instanceId: string, text: string, color: string, glow: string, duration = 1800) {
        setSupportOverlays((prev) => ({ ...prev, [instanceId]: { text, color, glow } }));
        setTimeout(() => {
            setSupportOverlays((prev) => { const n = { ...prev }; delete n[instanceId]; return n; });
        }, duration);
    }

    const [log, setLog] = useState<{
        text: string;
        type: string;
        actorName?: string;
        actorAffinity?: string;
        targetName?: string;
        targetAffinity?: string;
        damage?: number;
        isCrit?: boolean;
    }[]>([]);
    const logRef = useRef<HTMLDivElement>(null);
    const { w: winW } = useWindowSize();
    const isDesktop = winW >= 900;
    const [logOpen, setLogOpen] = useState(() => window.innerWidth >= 900);
    useEffect(() => { setLogOpen(window.innerWidth >= 900); }, [winW >= 900]);
    useEffect(() => {
        const el = logRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [log, logOpen]);
    const [result, setResult] = useState<{ status: "win" | "lose"; xp?: number; coins?: number } | null>(null);
    const { reload, trainer } = useTrainer();
    const { toast } = useToast();

    // ── Items en combate ──
    const [showItemPanel, setShowItemPanel] = useState(false);
    const [showAffinityModal, setShowAffinityModal] = useState(false);
    const [showBuffsModal, setShowBuffsModal] = useState(false);
    const [showDebuffsModal, setShowDebuffsModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<{ type: string; name: string; emoji: string; desc: string } | null>(null);
    const [usingItem, setUsingItem] = useState(false);

    // Items usables en combate — solo SPARK y GRAND_SPARK
    const COMBAT_ITEMS = [
        { type: "SPARK",       name: "Spark",       emoji: "✨", desc: "Cures the status of 1 Myth" },
        { type: "GRAND_SPARK", name: "Grand Spark", emoji: "💎", desc: "Cures all status effects in the team" },
    ];

    function getCombatItemCount(itemType: string): number {
        if (!trainer?.inventory) return 0;
        const entry = trainer.inventory.find((i: any) => i.type === itemType);
        return entry?.quantity ?? 0;
    }

    async function handleUseItem(targetMythId: string) {
        if (!selectedItem || !session || usingItem) return;
        const qty = getCombatItemCount(selectedItem.type);
        if (qty <= 0) { toast("You don't have that item", "error"); return; }
        setUsingItem(true);
        try {
            // TODO servidor: POST /battle/npc/use-item { battleId, itemType, targetInstanceId }
            // Devuelve la sesión actualizada igual que battleNpcTurn
            const res = await fetch("/api/battle/npc/use-item", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    battleId: session.battleId,
                    itemType: selectedItem.type,
                    targetInstanceId: targetMythId,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error ?? "Error using item");
            }
            const data = await res.json();
            if (data.session) setSession(cloneSession(data.session));
            else {
                const updated = await api.battleNpcActive();
                if (updated) setSession(cloneSession(updated));
            }
            toast(`${selectedItem.emoji} ${selectedItem.name} usado con éxito`, "success");
            await reload();
        } catch (e: any) {
            toast(e.message ?? "Error using item", "error");
        } finally {
            setUsingItem(false);
            setSelectedItem(null);
            setShowItemPanel(false);
        }
    }
    const [turnOverlay, setTurnOverlay] = useState<string | null>(null);
    // Último myth del jugador que actuó — se muestra en el panel inferior durante turnos NPC
    const [lastPlayerActorId, setLastPlayerActorId] = useState<string | null>(null);

    // ── Bloquear navegación durante combate ──
    const [showExitConfirm, setShowExitConfirm] = useState(false);
    const pendingNavRef = useRef<string | null>(null);
    const battleLockedRef = useRef(false);

    // Sincronizar phase con la ref Y con localStorage (señal global para otras páginas)
    useEffect(() => {
        const locked = phase === "battle";
        battleLockedRef.current = locked;
        if (locked) {
            localStorage.setItem("mythara_battle_active", "1");
        } else {
            localStorage.removeItem("mythara_battle_active");
        }
    }, [phase]);

    // Limpiar localStorage al desmontar el componente
    useEffect(() => {
        return () => { localStorage.removeItem("mythara_battle_active"); };
    }, []);

    // Interceptar clics en CUALQUIER elemento (links <a> y botones con navigate)
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (!battleLockedRef.current) return;
            const anchor = (e.target as Element)?.closest("a[href]") as HTMLAnchorElement | null;
            if (!anchor) return;
            const href = anchor.getAttribute("href") ?? "";
            if (href.startsWith("/") && !anchor.target) {
                e.preventDefault();
                e.stopPropagation();
                pendingNavRef.current = href;
                setShowExitConfirm(true);
            }
        }
        document.addEventListener("click", handleClick, true);
        return () => document.removeEventListener("click", handleClick, true);
    }, []);

    // Interceptar botón atrás del navegador
    useEffect(() => {
        window.history.pushState(null, "", window.location.href);
        function handlePop() {
            if (!battleLockedRef.current) return;
            window.history.pushState(null, "", window.location.href);
            pendingNavRef.current = null;
            setShowExitConfirm(true);
        }
        window.addEventListener("popstate", handlePop);
        return () => window.removeEventListener("popstate", handlePop);
    }, []);

    // Monkey-patch de window.history.pushState para interceptar navigate() de react-router
    // react-router v6 llama pushState internamente — esto captura logout y cualquier navigate()
    useEffect(() => {
        const originalPush = window.history.pushState.bind(window.history);
        window.history.pushState = function(state: any, unused: string, url?: string | URL | null) {
            // Si hay batalla activa y la URL destino es diferente a /battle → interceptar
            if (battleLockedRef.current && url) {
                const dest = typeof url === "string" ? url : url.toString();
                const destPath = dest.startsWith("/") ? dest : new URL(dest, window.location.origin).pathname;
                if (destPath !== "/battle" && destPath !== window.location.pathname) {
                    // Cancelar el push y mostrar modal
                    pendingNavRef.current = destPath;
                    setShowExitConfirm(true);
                    return; // no llamamos a originalPush → navegación bloqueada
                }
            }
            return originalPush(state, unused, url);
        };
        return () => {
            window.history.pushState = originalPush;
        };
    }, []);

    // Interceptar cierre/recarga del navegador — muestra diálogo nativo
    useEffect(() => {
        function handleBeforeUnload(e: BeforeUnloadEvent) {
            if (!battleLockedRef.current) return;
            e.preventDefault();
            e.returnValue = "You have an active battle. Leaving will count as a defeat.";
        }
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);


    async function handleForfeit(proceed: boolean) {
        setShowExitConfirm(false);
        if (proceed) {
            // 1. Llamar al endpoint de rendición — registra derrota y cierra la sesión
            try {
                if (session?.battleId) {
                    await api.battleNpcForfeit(session.battleId);
                }
            } catch (_) {
                // Si falla la llamada (ej: ya terminó), seguimos igualmente
            }
            // 2. Capturar destino ANTES de limpiar el estado
            const dest = pendingNavRef.current;
            pendingNavRef.current = null;
            // 3. Limpiar estado local completamente
            battleLockedRef.current = false;
            localStorage.removeItem("mythara_battle_active");
            setSession(null);
            setPhase("prep");
            // 4. Navegar al destino pendiente
            if (dest && dest !== "/battle") {
                // Restaurar pushState antes de navegar para que react-router funcione
                navigate(dest);
            }
        } else {
            pendingNavRef.current = null;
        }
    }

    useEffect(() => {
        api.creatures()
            .then((d) => setAllMyths(d ?? []))
            .catch(() => {});
        api.battleNpcActive()
            .then(async (s: any) => {
                if (s?.status === "ongoing") {
                    // SECURITY: Verificar que el combate pertenece al trainer actual
                    // Si el trainerId no coincide, ignoramos la sesión (otro usuario en el mismo browser)
                    if (s.trainerId && trainer?.id && s.trainerId !== trainer.id) {
                        console.warn("[BattlePage] Sesión activa de otro usuario ignorada.");
                        return;
                    }
                    const cloned = cloneSession(s);
                    setSession(cloned);
                    setPhase("battle");
                    setEnemyRevealIndex(999); // todos visibles al recargar
                    const { actorId, isPlayer } = initTurn(cloned);
                    if (!isPlayer && actorId) {
                        await sleep(800);
                        setAnimating(true);
                        try {
                            await handleNpcTurn(cloned, actorId, true);
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
            setLastPlayerActorId(actorId);
        } else {
            // Inicialmente no hay "último jugador", cogemos el primero vivo
            const firstPlayer = s.playerTeam.find((m) => !m.defeated);
            if (firstPlayer) setLastPlayerActorId(firstPlayer.instanceId);
        }
        return { actorId, isPlayer };
    }

    const currentActorIsPlayer = session?.playerTeam.some((m) => m.instanceId === currentActorId) ?? false;
    // Ref estable para el flag — evita que closures viejos del intervalo accedan a estado obsoleto
    const currentActorIsPlayerRef = useRef(false);
    useEffect(() => { currentActorIsPlayerRef.current = currentActorIsPlayer; }, [currentActorIsPlayer]);
    const animatingRef = useRef(false);
    useEffect(() => { animatingRef.current = animating; }, [animating]);

    function addLog(text: string, type = "normal", meta?: {
        actorName?: string; actorAffinity?: string;
        targetName?: string; targetAffinity?: string;
        damage?: number; isCrit?: boolean;
        missed?: boolean; mult?: number;
        statusApplied?: string; statusIcon?: string;
        isPlayerMyth?: boolean;
    }) {
        setLog((l) => [...l.slice(-60), { text, type, ...meta }]);
    }

    function sleep(ms: number) {
        return new Promise<void>((r) => setTimeout(r, ms));
    }

    function getProjectilePositions(
        fromId: string,
        toId: string,
    ): { fromX: number; fromY: number; toX: number; toY: number } | null {
        const fromEl = mythRefsMap.current[fromId]?.current;
        const toEl = mythRefsMap.current[toId]?.current;
        if (!fromEl || !toEl) return null;
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();
        return {
            fromX: fromRect.left + fromRect.width / 2,
            fromY: fromRect.top + fromRect.height / 2,
            toX: toRect.left + toRect.width / 2,
            toY: toRect.top + toRect.height / 2,
        };
    }

    function getMoveLevel(move: Move): 1 | 2 | 3 {
        if (move.cooldown === 0) return 1;
        if (move.cooldown <= 2) return 2;
        return 3;
    }

    async function flashAndFloat(
        instanceId: string,
        affinity: Affinity,
        dmg: number,
        crit: boolean,
        mult: number,
        heal = false,
        shieldAbsorbed = 0,
    ) {
        setFlashMap((m) => ({ ...m, [instanceId]: affinity }));
        setFloatMap((m) => ({ ...m, [instanceId]: { value: dmg, crit, mult, heal, shieldAbsorbed } }));
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
    async function animateTurnAction(action: any, currentSession?: BattleSession) {
        const sessionForLookup = currentSession ?? sessionRef.current ?? session;
        const direction = action.isPlayerMyth ? "ltr" : "rtl";

        // ── Detectar distorsión — el backend envía "🌀 ¡X has distorted!" en effectMsgs ──
        const distortMsg = action.effectMsgs?.find((m: string) => m.startsWith("🌀"));
        if (distortMsg) {
            const allFlat = [...(sessionForLookup?.playerTeam ?? []), ...(sessionForLookup?.enemyTeam ?? [])];
            const actor = allFlat.find(m => m.instanceId === action.actorInstanceId);
            if (actor) {
                addLog(`🌀 ¡${actor.name} has distorted!`, "system");
                const newRarity = (actor as any).rarity ?? "RARE";
                // Para el NPC: actualizar sesión ANTES del overlay para que el sprite/nombre ya estén actualizados
                if (!action.isPlayerMyth && currentSession) {
                    setSession(currentSession);
                    const freshMap = buildDistortionMap(currentSession);
                    setDistortionTurnsMap(prev => ({ ...prev, ...freshMap }));
                    const freshStart = buildDistortionStartMap(currentSession);
                    setDistortionStartMap(prev => ({ ...prev, ...freshStart }));
                }
                await triggerDistortion(action.actorInstanceId, actor.name, actor.affinities ?? [], newRarity);
                action = { ...action, effectMsgs: action.effectMsgs.filter((m: string) => !m.startsWith("🌀")) };
            }
            // Si es distorsión pura del jugador (sin move ejecutado), no hay nada más que animar
            if ((action as any).distorted || (!action.move && action.damage === 0 && !action.blockedByStatus)) {
                return;
            }
        }

        const BUFF_OVERLAYS: Record<string, { text: string; color: string; glow: string }> = {
            boost_atk:  { text: "⚔️ ATK ▲",    color: "#4ade80", glow: "#22c55e" },
            boost_def:  { text: "🛡️ DEF ▲",    color: "var(--accent-green)", glow: "#10b981" },
            boost_spd:  { text: "💨 SPD ▲",    color: "#67e8f9", glow: "#06b6d4" },
            boost_acc:  { text: "🎯 ACC ▲",    color: "#a3e635", glow: "#84cc16" },
            shield:     { text: "🛡️ SHIELD",  color: "#93c5fd", glow: "#3b82f6" },
            regen:      { text: "💚 REGEN",    color: "var(--accent-green)", glow: "#10b981" },
            heal:       { text: "💚 HEAL", color: "#4ade80", glow: "#22c55e" },
            counter:    { text: "🔄 REFLECT",  color: "#fde68a", glow: "#f59e0b" },
            cleanse:    { text: "✨ CLEANSE",   color: "#e0e7ff", glow: "#a5b4fc" },
        };
        const DEBUFF_OVERLAYS: Record<string, { text: string; color: string; glow: string }> = {
            debuff_atk: { text: "⚔️ ATK ▼",   color: "var(--accent-red)", glow: "#ef4444" },
            debuff_def: { text: "🛡️ DEF ▼",   color: "var(--accent-orange)", glow: "#f97316" },
            debuff_spd: { text: "💨 SPD ▼",   color: "var(--accent-gold)", glow: "#f59e0b" },
            debuff_acc: { text: "🎯 ACC ▼",   color: "#f472b6", glow: "#ec4899" },
            silence:    { text: "🔇 SILENCE", color: "#94a3b8", glow: "#64748b" },
            dispel:     { text: "💨 DISPEL",   color: "#a78bfa", glow: "#7c3aed" },
        };
        const STATUS_OVERLAYS: Record<string, { text: string; color: string; glow: string }> = {
            burn:     { text: "🔥 BURNED",   color: "var(--accent-orange)", glow: "#f97316" },
            poison:   { text: "☠️ POISONED",color: "#4ade80", glow: "#22c55e" },
            freeze:   { text: "❄️ FROZEN", color: "#7dd3fc", glow: "#38bdf8" },
            fear:     { text: "😨 FEARED",  color: "#c084fc", glow: "#a855f7" },
            paralyze: { text: "⚡ PARALYZED",color: "#fde047", glow: "#eab308" },
            stun:     { text: "💫 STUNNED",  color: "#facc15", glow: "#ca8a04" },
            curse:    { text: "💀 CURSED",   color: "#a855f7", glow: "#7c3aed" },
        };

        if (action.blockedByStatus) {
            addLog(action.blockedByStatus, "status");
            // Detectar qué estado bloquea para mostrar overlay prominente
            const blockedStatus = action.actorStatus ?? (
                action.blockedByStatus?.includes("quemad") || action.blockedByStatus?.includes("burn") ? "burn" :
                action.blockedByStatus?.includes("paraliz") || action.blockedByStatus?.includes("paralyze") ? "paralyze" :
                action.blockedByStatus?.includes("congel") || action.blockedByStatus?.includes("freeze") ? "freeze" :
                action.blockedByStatus?.includes("miedo") || action.blockedByStatus?.includes("fear") ? "fear" :
                action.blockedByStatus?.includes("aturdi") || action.blockedByStatus?.includes("stun") ? "stun" :
                action.blockedByStatus?.includes("maldici") || action.blockedByStatus?.includes("curse") ? "curse" :
                action.blockedByStatus?.includes("veneno") || action.blockedByStatus?.includes("poison") ? "poison" : null
            );
            if (blockedStatus) {
                showStatusBlockedOverlay(action.actorInstanceId, blockedStatus, 2000);
            }
        } else {
            const logPrefix = action.isPlayerMyth ? "" : "👾 ";
            // Buscar afinidades de actor y target para badges en el log
            const allMythsFlat2 = [...(sessionForLookup?.playerTeam ?? []), ...(sessionForLookup?.enemyTeam ?? [])];
            const logActor  = allMythsFlat2.find(m => m.instanceId === action.actorInstanceId);
            const logTarget = allMythsFlat2.find(m => m.instanceId === action.targetInstanceId);
            const moveObj = (sessionForLookup?.playerTeam ?? [])
                .concat(sessionForLookup?.enemyTeam ?? [])
                .find((m) => m.instanceId === action.actorInstanceId)
                ?.moves.find((mv) => mv.name === action.move);
            const projLevel = moveObj ? getMoveLevel(moveObj) : 1;
            const isSupport = moveObj?.type === "support" || (!action.damage && !action.missed);

            // Para support/buff a self o aliados, el target visual debe ser el propio actor
            const isBeneficialMove = isSupport && (
                action.healAmount > 0
                || (action.buffApplied && action.buffApplied.multiplier > 1)
                || action.buffApplied?.type === "shield"
                || action.buffApplied?.type === "regen"
                || action.buffApplied?.type === "cleanse"
            );
            // Si el move beneficia al actor (escudo/buff/cura), mostrar a él como target
            const logTargetName = isBeneficialMove
                ? action.actorName
                : action.targetName;
            const logTargetAffinity = isBeneficialMove
                ? logActor?.affinities?.[0]
                : logTarget?.affinities?.[0];
            // Log consolidado: todo en una sola entrada, el render se encarga de pintarlo
            const targetSurvivedCheck = sessionForLookup
                ? ([...sessionForLookup.playerTeam, ...sessionForLookup.enemyTeam]
                      .find(m => m.instanceId === action.targetInstanceId)?.hp ?? 1) > 0
                : true;
            const statusForLog = (action.statusApplied && targetSurvivedCheck) ? action.statusApplied : null;
            const statusIconForLog = statusForLog ? (STATUS_ICONS[statusForLog] ?? "⚠️") : undefined;
            addLog(
                `${action.actorName} usa ${action.move}`,
                "normal",
                {
                    actorName:      action.actorName,
                    actorAffinity:  logActor?.affinities?.[0],
                    targetName:     logTargetName,
                    targetAffinity: logTargetAffinity,
                    damage:         action.damage > 0 ? action.damage : undefined,
                    isCrit:         action.crit,
                    missed:         action.missed,
                    mult:           action.mult,
                    statusApplied:  statusForLog ?? undefined,
                    statusIcon:     statusIconForLog,
                    isPlayerMyth:   action.isPlayerMyth,
                }
            );

            await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

            if (isSupport && !action.damage) {
                // ── MOVE DE SOPORTE ──
                const isBeneficial = action.healAmount > 0
                    || (action.buffApplied && action.buffApplied.multiplier > 1)
                    || action.buffApplied?.type === "shield"
                    || action.buffApplied?.type === "regen";
                const isDebuff = action.statusApplied
                    || (action.buffApplied && action.buffApplied.multiplier < 1)
                    || action.buffApplied?.type === "silence";

                if (isBeneficial) {
                    const buffType = (action as any).shieldApplied ? "shield"
                        : action.buffApplied?.type ?? (action.healAmount > 0 ? "heal" : null);
                    const bo = buffType ? BUFF_OVERLAYS[buffType] : null;

                    // Targets del buff: allTargetInstanceIds si llega del servidor (aliados), si no el actor mismo
                    // IMPORTANTE: allTargetInstanceIds para moves all_allies contiene IDs de aliados — NO enemigos
                    const buffTargets: string[] = (action as any).allTargetInstanceIds?.length
                        ? (action as any).allTargetInstanceIds
                        : [action.actorInstanceId];

                    // ── Proyectil beneficioso: vuela desde el actor hacia cada aliado ──
                    // Color: azul para escudo (TIDE), verde para curas (GROVE), afinidad para buffs
                    const beneficialAffinity: Affinity = (action as any).shieldApplied
                        ? "TIDE"
                        : action.healAmount > 0 ? "GROVE" : action.moveAffinity as Affinity;

                    // targetsToShoot: todos los aliados excepto el actor mismo
                    const targetsToShoot = buffTargets.filter(tid => tid !== action.actorInstanceId);

                    if (targetsToShoot.length > 0) {
                        // Destello inicial en el actor
                        showSupportOverlay(action.actorInstanceId, bo?.text ?? "✨", bo?.color ?? "#60a5fa", bo?.glow ?? "#3b82f6");
                        if (action.healAmount > 0) {
                            flashAndFloat(action.actorInstanceId, beneficialAffinity, action.healAmount, false, 1, true);
                        }
                        await sleep(120);
                        // Proyectil hacia cada aliado
                        for (const tid of targetsToShoot) {
                            const pos = getProjectilePositions(action.actorInstanceId, tid);
                            if (pos) {
                                const dur = Math.max(220, Math.min(400,
                                    (Math.sqrt(Math.pow(pos.toX - pos.fromX, 2) + Math.pow(pos.toY - pos.fromY, 2)) / 800) * 700));
                                setProjectile({ affinity: beneficialAffinity, direction, level: 1, ...pos });
                                await sleep(dur);
                                setProjectile(null);
                                setExplosion({ x: pos.toX, y: pos.toY, fromX: pos.fromX, fromY: pos.fromY, affinity: beneficialAffinity, level: 1 });
                                if (action.healAmount > 0) {
                                    flashAndFloat(tid, beneficialAffinity, action.healAmount, false, 1, true);
                                }
                                await sleep(80);
                            }
                        }
                    } else {
                        // Solo el actor (self-buff/self-heal)
                        if (action.healAmount > 0) {
                            await flashAndFloat(action.actorInstanceId, beneficialAffinity, action.healAmount, false, 1, true);
                        }
                    }

                    // Overlays de buff/escudo en todos los targets
                    for (const tid of buffTargets) {
                        if (bo) {
                            showSupportOverlay(tid, bo.text, bo.color, bo.glow);
                        } else if (action.buffApplied?.multiplier > 1) {
                            const statKey = `boost_${action.buffApplied.stat ?? "atk"}`;
                            const so = BUFF_OVERLAYS[statKey] ?? BUFF_OVERLAYS["boost_atk"];
                            showSupportOverlay(tid, so.text, so.color, so.glow);
                        } else if (action.healAmount > 0) {
                            showSupportOverlay(tid, "💚 HEALING", "#4ade80", "#22c55e");
                        }
                    }
                    await sleep(200);
                } else if (isDebuff && action.targetInstanceId) {
                    const positions = getProjectilePositions(action.actorInstanceId, action.targetInstanceId);
                    if (positions) {
                        const dur = Math.max(350, Math.min(650,
                            (Math.sqrt(Math.pow(positions.toX - positions.fromX, 2) + Math.pow(positions.toY - positions.fromY, 2)) / 800) * 1000));
                        setProjectile({ affinity: action.moveAffinity as Affinity, direction, level: 1, ...positions });
                        await sleep(dur);
                        setProjectile(null);
                        setExplosion({ x: positions.toX, y: positions.toY, fromX: positions.fromX, fromY: positions.fromY, affinity: action.moveAffinity as Affinity, level: 1 });
                    }
                    if (action.statusApplied) {
                        const so = STATUS_OVERLAYS[action.statusApplied];
                        if (so) {
                            await showSupportOverlay(action.targetInstanceId, so.text, so.color, so.glow);
                            // Efecto visual CSS del estado al aplicarse
                            showStatusEffect(action.targetInstanceId, action.statusApplied, 1600);
                        }
                    } else if (action.buffApplied) {
                        const debuffType = action.buffApplied.type ?? `debuff_${action.buffApplied.stat ?? "atk"}`;
                        const so = DEBUFF_OVERLAYS[debuffType] ?? DEBUFF_OVERLAYS[`debuff_${action.buffApplied.stat ?? "atk"}`];
                        if (so) await showSupportOverlay(action.targetInstanceId, so.text, so.color, so.glow);
                    }
                }
                await sleep(300);
            } else {
                // ── MOVE DE DAÑO ──
                // Si es área (allTargetInstanceIds), disparar proyectil a cada target secuencialmente
                const areaIds: string[] = (action as any).allTargetInstanceIds?.length
                    ? (action as any).allTargetInstanceIds
                    : action.targetInstanceId ? [action.targetInstanceId] : [];

                // Para ataques de área: flash de carga en el actor antes de bifurcar
                if (areaIds.length > 1) {
                    const actorPos = getProjectilePositions(action.actorInstanceId, areaIds[0]);
                    if (actorPos) {
                        // Flash de carga en el actor
                        setExplosion({ x: actorPos.fromX, y: actorPos.fromY, fromX: actorPos.fromX, fromY: actorPos.fromY, affinity: action.moveAffinity as Affinity, level: 1 });
                    }
                    await sleep(180);
                }

                if (areaIds.length > 1) {
                    // ── ÁREA: proyectiles TRUE simultáneos — uno por target ──
                    // Calcular posiciones para todos los targets
                    const areaPositions = areaIds.map(tid => ({
                        tid,
                        pos: getProjectilePositions(action.actorInstanceId, tid),
                    })).filter(p => p.pos !== null) as { tid: string; pos: NonNullable<ReturnType<typeof getProjectilePositions>> }[];

                    if (areaPositions.length > 0) {
                        const travelDur = Math.max(300, Math.min(500,
                            (Math.sqrt(Math.pow(areaPositions[0].pos.toX - areaPositions[0].pos.fromX, 2) +
                                       Math.pow(areaPositions[0].pos.toY - areaPositions[0].pos.fromY, 2)) / 800) * 900));

                        // Lanzar todos los proyectiles simultáneamente (usamos el primero como visual principal)
                        setProjectile({ affinity: action.moveAffinity as Affinity, direction, level: projLevel, ...areaPositions[0].pos });
                        // Proyectiles adicionales como explosiones diferidas en el origen (efecto bifurcación)
                        for (let i = 1; i < areaPositions.length; i++) {
                            const { pos } = areaPositions[i];
                            setExplosion({ x: pos.fromX + (pos.toX - pos.fromX) * 0.1, y: pos.fromY + (pos.toY - pos.fromY) * 0.1, fromX: pos.fromX, fromY: pos.fromY, affinity: action.moveAffinity as Affinity, level: 1 });
                        }
                        await sleep(travelDur);
                        setProjectile(null);

                        // Impactar TODOS simultáneamente
                        for (const { tid, pos } of areaPositions) {
                            setExplosion({ x: pos.toX, y: pos.toY, fromX: pos.fromX, fromY: pos.fromY, affinity: action.moveAffinity as Affinity, level: projLevel });
                            if (action.damage > 0) {
                                flashAndFloat(tid, action.moveAffinity, action.damage, action.crit, action.mult, false, action.shieldAbsorbed ?? 0);
                            }
                        }
                    }
                    if (action.missed) addLog("Miss!", "miss");
                    await sleep(projLevel === 1 ? 200 : projLevel === 2 ? 380 : 600);
                } else {
                    // ── TARGET ÚNICO ──
                    const tid = areaIds[0];
                    if (!tid) { /* nada */ } else {
                    const positions = getProjectilePositions(action.actorInstanceId, tid);
                    if (positions) {
                        const duration = Math.max(300, Math.min(550,
                            (Math.sqrt(Math.pow(positions.toX - positions.fromX, 2) + Math.pow(positions.toY - positions.fromY, 2)) / 800) * 1000));
                        setProjectile({ affinity: action.moveAffinity as Affinity, direction, level: projLevel, ...positions });
                        await sleep(duration);
                        setProjectile(null);
                        setExplosion({ x: positions.toX, y: positions.toY, fromX: positions.fromX, fromY: positions.fromY, affinity: action.moveAffinity as Affinity, level: projLevel });
                        if (action.damage > 0) {
                            flashAndFloat(tid, action.moveAffinity, action.damage, action.crit, action.mult, false, action.shieldAbsorbed ?? 0);
                        } else if (action.missed) {
                            addLog("Miss!", "miss");
                        }
                        await sleep(projLevel === 1 ? 160 : projLevel === 2 ? 220 : 420);
                    } else {
                        setProjectile({ affinity: action.moveAffinity as Affinity, direction, level: projLevel, fromX: 0, fromY: 0, toX: 0, toY: 0 });
                        await sleep(420);
                        setProjectile(null);
                        if (action.damage > 0) {
                            flashAndFloat(tid, action.moveAffinity, action.damage, action.crit, action.mult);
                        } else if (action.missed) {
                            addLog("Miss!", "miss");
                        }
                        await sleep(80);
                    }
                    }
                }

                if (action.healAmount && action.healAmount > 0) {
                    await flashAndFloat(action.actorInstanceId, action.moveAffinity, action.healAmount, false, 1, true);
                }
                if (action.effectMsgs?.length) {
                    for (const msg of action.effectMsgs) {
                        // Detectar regen tick para mostrar flash verde en el sprite
                        if (msg.includes("regen") || msg.includes("REGEN") || msg.includes("regenera")) {
                            setFlashMap(m => ({ ...m, [action.actorInstanceId]: "GROVE" as Affinity }));
                            setTimeout(() => setFlashMap(m => { const n = {...m}; delete n[action.actorInstanceId]; return n; }), 400);
                        }
                        addLog(msg, "status");
                    }
                }
            }
        }

        if (action.statusTickDamage && action.statusTickDamage > 0) {
            const sess = currentSession ?? sessionRef.current ?? session;
            const actorMyth = [...(sess?.playerTeam ?? []), ...(sess?.enemyTeam ?? [])]
                .find((m) => m.instanceId === action.actorInstanceId);
            if (actorMyth?.status) {
                await sleep(300);
                // Afinidad del tick según el estado (burn=EMBER, poison=VENOM)
                const tickAff: Affinity = actorMyth.status === "burn" ? "EMBER"
                    : actorMyth.status === "poison" ? "VENOM"
                    : action.moveAffinity as Affinity;
                // Efecto visual CSS del tick de estado
                showStatusEffect(action.actorInstanceId, actorMyth.status, 900);
                await flashAndFloat(action.actorInstanceId, tickAff, action.statusTickDamage, false, 1);
                addLog(action.statusTickMsg ?? `🩸 ${action.actorName} takes status damage`, "status");
            }
        }
    }

    function finalizeTurn(
        newSession: BattleSession,
        nextActorId: string | null,
        nextActorIsPlayer: boolean,
        xpGained?: number,
        coinsGained?: number,
    ) {
        // Detectar myths recién derrotados para mostrar K.O.
        const prev = sessionRef.current;
        if (prev) {
            const allPrev = [...prev.playerTeam, ...prev.enemyTeam];
            const allNew = [...newSession.playerTeam, ...newSession.enemyTeam];
            for (const m of allNew) {
                const was = allPrev.find((p) => p.instanceId === m.instanceId);
                if (was && !was.defeated && m.defeated) triggerKo(m.instanceId);
            }
        }
        // Guardar el último actor jugador que actuó (para panel inferior durante turno NPC)
        const currentActor = currentActorIdRef.current;
        if (currentActor && prev?.playerTeam.some((m) => m.instanceId === currentActor)) {
            setLastPlayerActorId(currentActor);
        }
        setSession(newSession);
        // Reconstruir mapa de distorsión desde la sesión nueva (merge — nunca borrar triggers conocidos)
        const freshMap = buildDistortionMap(newSession);
        setDistortionTurnsMap(prev => ({ ...prev, ...freshMap }));
        const freshStart = buildDistortionStartMap(newSession);
        setDistortionStartMap(prev => ({ ...prev, ...freshStart }));
        if (newSession.status === "win" || newSession.status === "lose") {            addLog(
                newSession.status === "win" ? "🏆 Victory!" : "💀 Defeat...",
                newSession.status === "win" ? "good" : "bad",
            );
            setResult({ status: newSession.status, xp: xpGained, coins: coinsGained });
            setPhase("result");
            window.dispatchEvent(new Event("sidebar:reload"));
            return true; // combate terminado
        }
        setCurrentActorId(nextActorId);
        if (nextActorIsPlayer && nextActorId) {
            setLastPlayerActorId(nextActorId);
            const actorName =
                [...newSession.playerTeam, ...newSession.enemyTeam].find((m) => m.instanceId === nextActorId)?.name ??
                "TU MYTH";
            setTurnOverlay(actorName);
            setTimeout(() => setTurnOverlay(null), 3000);
            // Comprobar distorsión ANTES de que el jugador vea los moves
            setTimeout(() => handleBeginPlayerTurn(nextActorId), 200);
        }
        if (nextActorIsPlayer) {
            setTargetEnemyMythId((prev) => {
                const stillAlive = newSession.enemyTeam.find((m) => m.instanceId === prev && !m.defeated);
                return stillAlive ? prev : (newSession.enemyTeam.find((m) => !m.defeated)?.instanceId ?? null);
            });
        }
        return false;
    }

    // Llama a beginTurn cuando le toca al jugador — resuelve distorsión ANTES del input
    async function handleBeginPlayerTurn(actorId: string) {
        // Usar sessionRef para evitar closure stale
        const currentSession = sessionRef.current;
        if (!currentSession) return;
        try {
            const res = await api.battleBeginTurn(currentSession.battleId);
            if (!res) return;
            const newSession = cloneSession(res.session);
            // Actualizar siempre el mapa desde la sesión recibida
            const freshMap = buildDistortionMap(newSession);
            setDistortionTurnsMap(prev => ({ ...prev, ...freshMap }));
            const freshStart = buildDistortionStartMap(newSession);
            setDistortionStartMap(prev => ({ ...prev, ...freshStart }));
            if (res.distorted) {
                // Actualizar sesión primero para que el sprite muestre la nueva forma
                setSession(newSession);
                // Luego mostrar overlay de distorsión
                await animateTurnAction(
                    {
                        actorInstanceId: res.actorInstanceId,
                        actorName: res.actorName,
                        isPlayerMyth: true,
                        move: "", moveAffinity: "ASTRAL" as Affinity, moveType: "support" as MoveType,
                        targetName: "", targetInstanceId: "",
                        damage: 0, mult: 1, crit: false, stab: false, missed: false,
                        effectMsgs: [res.distortionMsg ?? `🌀 ¡${res.actorName} has distorted!`],
                        distorted: true,
                    },
                    newSession
                );
            }
        } catch (_) {
            // Si falla beginTurn (ej: endpoint no implementado aún), ignorar
        }
    }

    async function handleMove(moveId: string, forcedTargetId?: string) {
        if (!session || animating) return;
        const resolvedTarget = forcedTargetId ?? targetEnemyMythId ?? undefined;
        setAnimating(true);
        let chainedToNpc = false;
        try {
            const res = await api.battleNpcTurn(session.battleId, moveId, resolvedTarget);
            const { session: rawSession, action, nextActorId, nextActorIsPlayer, xpGained, coinsGained } = res;
            const newSession = cloneSession(rawSession);
            await animateTurnAction(action, newSession);
            await sleep(150);
            const ended = finalizeTurn(newSession, nextActorId, nextActorIsPlayer, xpGained, coinsGained);
            if (!ended && !nextActorIsPlayer && nextActorId) {
                chainedToNpc = true;
                await sleep(3000);
                await handleNpcTurn(newSession, nextActorId, true);
            }
        } catch (e: any) {
            addLog(`Error: ${e.message}`, "bad");
        } finally {
            if (!chainedToNpc) setAnimating(false);
        }
    }

    async function handleNpcTurn(currentSession: BattleSession, npcActorId: string, isRoot = false) {
        try {
            const res = await api.battleNpcTurn(currentSession.battleId, "__npc__", undefined);
            const { session: rawSession, action, nextActorId, nextActorIsPlayer, xpGained, coinsGained } = res;
            const newSession = cloneSession(rawSession);
            await animateTurnAction(action, newSession);
            await sleep(150);
            const ended = finalizeTurn(newSession, nextActorId, nextActorIsPlayer, xpGained, coinsGained);
            if (!ended && !nextActorIsPlayer && nextActorId) {
                await sleep(1200); // pausa entre NPCs consecutivos (cadena)
                await handleNpcTurn(newSession, nextActorId, false);
            }
        } catch (e: any) {
            addLog(`Error NPC: ${e.message}`, "bad");
        } finally {
            if (isRoot) setAnimating(false);
        }
    }

    // Reconstruye el mapa completo desde la sesión actual (triggerTurn absoluto)
    // distortionTurnsMap: instanceId → triggerTurn absoluto (o -1 si forma final)
    // distortionStartMap:  instanceId → turno en que empezó la forma actual
    // Ambos se actualizan juntos en buildDistortionMap.

    function buildDistortionMap(s: BattleSession): Record<string, number> {
        const map: Record<string, number> = {};
        for (const m of [...s.playerTeam, ...s.enemyTeam]) {
            const trigger = (m as any).distortionTriggerTurn;
            map[m.instanceId] = trigger != null ? trigger : -1;
        }
        return map;
    }

    function buildDistortionStartMap(s: BattleSession): Record<string, number> {
        const map: Record<string, number> = {};
        for (const m of [...s.playerTeam, ...s.enemyTeam]) {
            const start = (m as any).distortionFormStartTurn ?? 1;
            const trigger = (m as any).distortionTriggerTurn;
            if (trigger != null) map[m.instanceId] = start;
        }
        return map;
    }

    // getDistortionInfo: devuelve los datos que necesita DistortionBar
    //   undefined → myth sin distorsión → NO mostrar barra
    //   { isFinal: true } → forma final → DIST MAX
    //   { isFinal: false, elapsed, interval } → progreso en el intervalo actual
    function getDistortionInfo(myth: BattleMyth): undefined | { isFinal: true } | { isFinal: false; elapsed: number; interval: number; distortsThisTurn: boolean } {
        const triggerTurn = distortionTurnsMap[myth.instanceId];
        if (triggerTurn === undefined) return undefined;  // sin distorsión
        if (triggerTurn === -1) return { isFinal: true }; // forma final
        const currentTurn     = session?.turn ?? 1;
        const startTurn       = distortionStartMap[myth.instanceId] ?? 1;
        const interval        = Math.max(1, triggerTurn - startTurn);
        const elapsed         = Math.max(0, currentTurn - startTurn);
        const distortsThisTurn = currentTurn >= triggerTurn; // es el turno exacto de distorsión
        return { isFinal: false, elapsed, interval, distortsThisTurn };
    }

    async function handleStart(order: string[]) {
        setLoadingStart(true);
        try {
            const s = await api.battleNpcStart(order);
            const cloned = cloneSession(s);
            setSession(cloned);
            setPhase("battle");
            // Inicializar mapa de distorsión desde los triggerTurns de la sesión
            setDistortionTurnsMap(buildDistortionMap(cloned));
            setDistortionStartMap(buildDistortionStartMap(cloned));
            addLog("⚔️ Battle start!", "system");
            await reload();
            // Revelar enemigos uno a uno y luego fijar reveal permanente
            setEnemyRevealIndex(0);
            for (let i = 0; i < cloned.enemyTeam.length; i++) {
                await sleep(500);
                setEnemyRevealIndex(i + 1);
            }
            // Una vez revelados todos, usar Infinity para que nunca desaparezcan
            await sleep(200);
            setEnemyRevealIndex(999);
            const { actorId, isPlayer } = initTurn(cloned);
            if (!isPlayer && actorId) {
                await sleep(800);
                setAnimating(true);
                try {
                    await handleNpcTurn(cloned, actorId, true);
                } finally {
                    setAnimating(false);
                }
            }
        } catch (e: any) {
            toast(e.message ?? "Error starting battle", "error");
        } finally {
            setLoadingStart(false);
        }
    }

    const currentActor = session
        ? ([...session.playerTeam, ...session.enemyTeam].find((m) => m.instanceId === currentActorId) ?? null)
        : null;
    const targetEnemy = session?.enemyTeam.find((m) => m.instanceId === targetEnemyMythId);

    // Sprite size — landscape-aware
    // Mobile landscape (width < 900px): smaller sprites to fit 3v3 in arena
    function getMythSpriteSize(myth: BattleMyth): number {
        const h = (myth as any).height;
        const isMobile = winW < 900;
        const minPx = isMobile ? 40 : 75;
        const maxPx = isMobile ? 60 : 130;
        if (h === undefined || h === null) return isMobile ? 52 : 105;
        if (h === 0) return isMobile ? 42 : 90;
        const clamped = Math.max(0.35, Math.min(2.0, h));
        return Math.round(minPx + ((clamped - 0.35) / (2.0 - 0.35)) * (maxPx - minPx));
    }
    // spriteSize base (overridden per myth in render)
    const spriteSize = winW < 900 ? 52 : 105;

    // Distortion turns remaining — calculated via distortionTurnsMap (defined near buildDistortionMap)

    if (mode === "pvp") {
        return (
            <div className="flex flex-col bg-[#070b14]" style={{ width: "100dvw", height: "100dvh", overflow: "hidden" }}>
                <BattleTopBar phase="prep" session={null} currentActorName={undefined} onBack={() => navigate("/")} />
                <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center max-w-sm">
                            <div className="text-6xl mb-4">⚔️</div>
                            <h2 className="font-mono text-2xl font-black text-yellow-400 tracking-widest mb-3">
                                PvP — Coming Soon
                            </h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Binder vs Binder battles are under construction.
                            </p>
                            <div className="mt-6 px-4 py-2 rounded-lg border border-slate-700 text-slate-500 text-xs font-mono tracking-wider">
                                🔒 In development
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Arena + Prep ──
    const battleLocked = phase === "battle";
    const currentActorName = currentActor?.name ?? undefined;

    return (
        <div className="flex flex-col bg-[#070b14]" style={{ width: "100dvw", height: "100dvh", overflow: "hidden" }}>

            {/* ── Exit battle confirmation modal ── */}
            {showExitConfirm && (
                <div className="fixed inset-0 z-[9998] flex items-center justify-center"
                    style={{ background: "rgba(4,8,16,0.85)", backdropFilter: "blur(10px)" }}>
                    <div className="max-w-sm w-full mx-4 rounded-2xl p-8 flex flex-col gap-5 text-center"
                        style={{
                            background: "linear-gradient(135deg, #1a1f2e 0%, #0f1520 100%)",
                            border: "1.5px solid rgba(239,68,68,0.4)",
                            boxShadow: "0 0 60px rgba(239,68,68,0.15), 0 24px 60px rgba(0,0,0,0.7)",
                        }}>
                        <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto"
                            style={{ background: "rgba(239,68,68,0.12)", border: "1.5px solid rgba(239,68,68,0.3)" }}>
                            ⚔️
                        </div>
                        <div className="flex flex-col gap-2">
                            <h2 className="font-mono font-black text-lg tracking-wider uppercase text-white">
                                Abandon battle?
                            </h2>
                            <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
                                If you leave now, this battle will count as a <span style={{ color: "var(--accent-red)", fontWeight: 700 }}>defeat</span>.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2.5">
                            <button
                                onClick={() => handleForfeit(true)}
                                className="w-full py-3 rounded-xl font-mono font-black text-sm tracking-widest uppercase transition-all hover:scale-[1.02] active:scale-[0.98]"
                                style={{
                                    background: "linear-gradient(135deg, rgba(239,68,68,0.20) 0%, rgba(185,28,28,0.25) 100%)",
                                    border: "1.5px solid rgba(239,68,68,0.55)",
                                    color: "var(--accent-red)",
                                    boxShadow: "0 0 20px rgba(239,68,68,0.15)",
                                }}>
                                Leave and lose battle
                            </button>
                            <button
                                onClick={() => handleForfeit(false)}
                                className="w-full py-3 rounded-xl font-mono font-black text-sm tracking-widest uppercase transition-all hover:scale-[1.02] active:scale-[0.98]"
                                style={{
                                    background: "linear-gradient(135deg, rgba(34,197,94,0.18) 0%, rgba(21,128,61,0.22) 100%)",
                                    border: "1.5px solid rgba(34,197,94,0.50)",
                                    color: "#4ade80",
                                    boxShadow: "0 0 20px rgba(34,197,94,0.12)",
                                }}>
                                ⚔️ Keep fighting
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <BattleTopBar
                phase={phase}
                session={session}
                currentActorName={currentActorName}
                onBack={() => {
                    if (battleLocked) setShowExitConfirm(true);
                    else navigate("/");
                }}
            />

            <div className="flex-1 overflow-hidden flex flex-col relative">
                <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>

                    <div className="flex-1 flex overflow-hidden relative" style={{ minHeight: 0 }}>
                        {/* ── Arena principal ── */}
                        <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
                        {/* ── Campo de batalla — fondo CSS puro ── */}
                            <div
                                className="relative flex-1 overflow-hidden"
                                style={{
                                    minHeight: 0,
                                    background: [
                                        "radial-gradient(ellipse 80% 40% at 50% 110%, #1a2744 0%, transparent 70%)",
                                        "radial-gradient(ellipse 60% 30% at 20% 100%, #0d1f3c 0%, transparent 60%)",
                                        "radial-gradient(ellipse 60% 30% at 80% 100%, #1a0d2e 0%, transparent 60%)",
                                        "linear-gradient(180deg, #060c1a 0%, #0b1628 35%, #0f1e38 60%, #162240 100%)",
                                    ].join(", "),
                                }}
                            >
                                {/* Capa 1: estrellas pequeñas parpadeantes lentas */}
                                <div className="absolute inset-0 pointer-events-none star-twinkle-slow" style={{
                                    backgroundImage: [
                                        "radial-gradient(1px 1px at 10% 15%, rgba(255,255,255,0.6) 0%, transparent 100%)",
                                        "radial-gradient(1px 1px at 25% 8%,  rgba(255,255,255,0.5) 0%, transparent 100%)",
                                        "radial-gradient(1px 1px at 40% 20%, rgba(255,255,255,0.55) 0%, transparent 100%)",
                                        "radial-gradient(1px 1px at 55% 5%,  rgba(255,255,255,0.7) 0%, transparent 100%)",
                                        "radial-gradient(1px 1px at 70% 18%, rgba(255,255,255,0.5) 0%, transparent 100%)",
                                        "radial-gradient(1px 1px at 85% 10%, rgba(255,255,255,0.6) 0%, transparent 100%)",
                                        "radial-gradient(1px 1px at 92% 22%, rgba(255,255,255,0.4) 0%, transparent 100%)",
                                        "radial-gradient(1px 1px at 5%  30%, rgba(255,255,255,0.35) 0%, transparent 100%)",
                                        "radial-gradient(1px 1px at 48% 14%, rgba(255,255,255,0.45) 0%, transparent 100%)",
                                        "radial-gradient(1px 1px at 15% 28%, rgba(255,255,255,0.3) 0%, transparent 100%)",
                                    ].join(", "),
                                }} />
                                {/* Capa 2: estrellas medianas, parpadeo más rápido y desfasado */}
                                <div className="absolute inset-0 pointer-events-none star-twinkle-fast" style={{
                                    backgroundImage: [
                                        "radial-gradient(1.5px 1.5px at 33% 12%, rgba(255,255,255,0.9) 0%, transparent 100%)",
                                        "radial-gradient(1.5px 1.5px at 60% 7%,  rgba(200,220,255,0.8) 0%, transparent 100%)",
                                        "radial-gradient(2px   2px   at 78% 16%, rgba(255,255,255,0.7) 0%, transparent 100%)",
                                        "radial-gradient(1.5px 1.5px at 18% 9%,  rgba(220,240,255,0.85) 0%, transparent 100%)",
                                        "radial-gradient(1px   1px   at 90% 6%,  rgba(255,255,255,0.6) 0%, transparent 100%)",
                                        "radial-gradient(1.5px 1.5px at 44% 22%, rgba(255,240,200,0.7) 0%, transparent 100%)",
                                    ].join(", "),
                                }} />
                                {/* Estrella fugaz — 1 sola, larga, brillante, aparece cada 30-45s */}
                                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                    <ShootingStar />
                                </div>
                                {/* Aurora boreal */}
                                <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{
                                    height: "45%",
                                    background: [
                                        "radial-gradient(ellipse 50% 60% at 35% 0%, rgba(32,180,120,0.16) 0%, transparent 70%)",
                                        "radial-gradient(ellipse 40% 50% at 65% 0%, rgba(100,60,200,0.13) 0%, transparent 70%)",
                                        "radial-gradient(ellipse 30% 40% at 80% 0%, rgba(60,140,220,0.10) 0%, transparent 70%)",
                                    ].join(", "),
                                }} />
                                {/* Grid perspectiva — líneas convergentes al horizonte */}
                                <div className="absolute bottom-0 left-0 right-0 overflow-hidden pointer-events-none" style={{ height: "68%" }}>
                                    <svg width="100%" height="100%" viewBox="0 0 800 300" preserveAspectRatio="none">
                                        <line x1="400" y1="0" x2="0"   y2="300" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                                        <line x1="400" y1="0" x2="115" y2="300" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                                        <line x1="400" y1="0" x2="230" y2="300" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                                        <line x1="400" y1="0" x2="345" y2="300" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                                        <line x1="400" y1="0" x2="400" y2="300" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
                                        <line x1="400" y1="0" x2="455" y2="300" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                                        <line x1="400" y1="0" x2="570" y2="300" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                                        <line x1="400" y1="0" x2="685" y2="300" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                                        <line x1="400" y1="0" x2="800" y2="300" stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                                        <line x1="0" y1="80"  x2="800" y2="80"  stroke="rgba(255,255,255,0.025)" strokeWidth="1"/>
                                        <line x1="0" y1="150" x2="800" y2="150" stroke="rgba(255,255,255,0.03)"  strokeWidth="1"/>
                                        <line x1="0" y1="220" x2="800" y2="220" stroke="rgba(255,255,255,0.035)" strokeWidth="1"/>
                                    </svg>
                                </div>
                                {/* Gradiente de suelo */}
                                <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{
                                    height: "72%",
                                    background: "linear-gradient(180deg, transparent 0%, rgba(12,22,45,0.55) 40%, rgba(10,18,38,0.82) 70%, rgba(8,14,30,0.95) 100%)",
                                }} />
                                {/* Pilares laterales */}
                                <div className="absolute bottom-0 pointer-events-none" style={{ left:"2%", width:"5.5%", height:"54%", background:"linear-gradient(180deg,rgba(20,35,65,0) 0%,rgba(15,28,55,0.75) 40%,rgba(10,20,42,1) 100%)", borderTop:"1px solid rgba(255,255,255,0.05)" }}/>
                                <div className="absolute bottom-0 pointer-events-none" style={{ right:"2%", width:"5.5%", height:"54%", background:"linear-gradient(180deg,rgba(20,35,65,0) 0%,rgba(15,28,55,0.75) 40%,rgba(10,20,42,1) 100%)", borderTop:"1px solid rgba(255,255,255,0.05)" }}/>
                                {/* Antorchas */}
                                <div className="absolute pointer-events-none" style={{ top:"41%", left:"5.2%", width:5, height:5, borderRadius:"50%", background:"#f97316", boxShadow:"0 0 14px 5px rgba(249,115,22,0.5)", animation:"mythIdle 1.5s ease-in-out infinite" }}/>
                                <div className="absolute pointer-events-none" style={{ top:"41%", right:"5.2%", width:5, height:5, borderRadius:"50%", background:"#f97316", boxShadow:"0 0 14px 5px rgba(249,115,22,0.5)", animation:"mythIdle 1.5s ease-in-out infinite 0.7s" }}/>
                                {/* Niebla lateral */}
                                <div className="absolute inset-y-0 left-0 pointer-events-none" style={{ width:"10%", background:"linear-gradient(90deg,rgba(6,12,26,0.65) 0%,transparent 100%)" }}/>
                                <div className="absolute inset-y-0 right-0 pointer-events-none" style={{ width:"10%", background:"linear-gradient(270deg,rgba(10,6,22,0.65) 0%,transparent 100%)" }}/>
                                {/* Grietas del suelo */}
                                <div className="absolute inset-0 pointer-events-none" style={{ opacity:0.06 }}>
                                    <svg width="100%" height="100%" viewBox="0 0 800 480">
                                        <path d="M400,180 L418,238 L392,298 L408,378" stroke="white" strokeWidth="1.5" fill="none"/>
                                        <path d="M382,202 L352,258 L372,318" stroke="white" strokeWidth="1" fill="none"/>
                                        <path d="M418,202 L448,268 L432,338" stroke="white" strokeWidth="1" fill="none"/>
                                    </svg>
                                </div>
                                {/* Overlay de preparación — texto central */}
                                {phase === "prep" && (
                                    <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                                        <div className="text-center">
                                            <p className="font-mono text-2xl font-black text-white/10 tracking-[0.3em] uppercase">
                                                SELECT YOUR TEAM
                                            </p>
                                            <p className="font-mono text-xs text-white/5 tracking-widest mt-1">
                                                select myths below · press COMBAT to start
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {turnOverlay && (() => {
                                    // Obtener afinidad del myth activo para colorear el borde
                                    const turnMyth = session?.playerTeam.find(m => m.name === turnOverlay && !m.defeated)
                                        ?? session?.playerTeam.find(m => !m.defeated);
                                    const turnAff = turnMyth?.affinities?.[0];
                                    const turnCfg = turnAff ? AFFINITY_CONFIG[turnAff] : null;
                                    const glowColor = turnCfg?.glow ?? "#fde047";
                                    const glowRgb = turnCfg?.glowRgb ?? "253,224,71";
                                    return (
                                    <div className="absolute inset-0 flex items-center justify-center z-[300] pointer-events-none">
                                        <div className="animate-turn-overlay text-center" style={{
                                            background: `linear-gradient(135deg, rgba(7,11,20,0.96) 0%, rgba(15,22,40,0.98) 100%)`,
                                            border: `1.5px solid ${glowColor}88`,
                                            borderTop: `3px solid ${glowColor}`,
                                            borderRadius: 20,
                                            padding: "18px 52px 16px",
                                            boxShadow: [
                                                `0 0 0 1px ${glowColor}11`,
                                                `0 0 30px ${glowColor}33`,
                                                `0 0 80px ${glowColor}11`,
                                                "0 16px 60px rgba(0,0,0,0.8)",
                                                `inset 0 1px 0 rgba(${glowRgb},0.08)`,
                                            ].join(", "),
                                            backdropFilter: "blur(8px)",
                                            minWidth: 240,
                                        }}>
                                            {/* Línea decorativa con turno */}
                                            <div className="flex items-center justify-center gap-2 mb-2">
                                                <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${glowColor}44)` }} />
                                                <span style={{ fontFamily: "monospace", fontSize: "9px", color: `${glowColor}99`, letterSpacing: "0.25em", textTransform: "uppercase" }}>
                                                    Turno {session?.turn ?? ""}
                                                </span>
                                                <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${glowColor}44, transparent)` }} />
                                            </div>
                                            {/* Label */}
                                            <p style={{ fontFamily: "monospace", fontSize: "10px", color: `${glowColor}99`, letterSpacing: "0.2em", textTransform: "uppercase", marginBottom: 6 }}>
                                                Your turn
                                            </p>
                                            {/* Icono + nombre */}
                                            <div className="flex items-center justify-center gap-3">
                                                {turnMyth && (
                                                    <div style={{
                                                        width: 32, height: 32, borderRadius: "50%",
                                                        background: `${glowColor}22`,
                                                        border: `1.5px solid ${glowColor}66`,
                                                        display: "flex", alignItems: "center", justifyContent: "center",
                                                        boxShadow: `0 0 10px ${glowColor}44`,
                                                    }}>
                                                        {turnAff && <AffinityIcon affinity={turnAff} size={20} />}
                                                    </div>
                                                )}
                                                <p className="font-black tracking-wide uppercase" style={{
                                                    fontFamily: "'Rajdhani', sans-serif",
                                                    fontSize: "1.8rem",
                                                    color: glowColor,
                                                    textShadow: `0 0 20px ${glowColor}cc, 0 0 45px ${glowColor}55, 0 2px 8px rgba(0,0,0,0.9)`,
                                                    letterSpacing: "0.06em",
                                                    lineHeight: 1.1,
                                                }}>
                                                    {turnOverlay}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    );
                                })()}
                                {phase === "result" && result && (
                                    <div className="absolute inset-0 z-50 pointer-events-auto flex items-center justify-center"
                                        style={{
                                            background: result.status === "win"
                                                ? "radial-gradient(ellipse at center, rgba(40,30,5,0.88) 0%, rgba(4,8,16,0.95) 70%)"
                                                : "radial-gradient(ellipse at center, rgba(40,5,10,0.92) 0%, rgba(4,8,16,0.97) 70%)",
                                            animation: result.status === "lose" ? "defeatVignette 2s ease-in-out infinite" : undefined,
                                        }}>

                                        {/* VICTORIA — estrellas CSS flotantes */}
                                        {result.status === "win" && Array.from({ length: 18 }, (_, i) => {
                                            const colors = ["#ffd60a","#ffb700","#ffd60a","#fff7ae","#ffffff","#fbbf24"];
                                            const col = colors[i % colors.length];
                                            const size = 4 + (i % 5) * 4;
                                            const sx = (((i * 137.5) % 200) - 100);
                                            const sy = -(60 + (i % 4) * 30);
                                            const sr = (i * 47) % 360;
                                            const delay = (i * 0.12) % 1.8;
                                            const dur = 1.5 + (i % 3) * 0.5;
                                            return (
                                                <div key={i} className="absolute pointer-events-none" style={{
                                                    left: "50%", top: "40%",
                                                    width: size, height: size,
                                                    marginLeft: -size/2, marginTop: -size/2,
                                                    background: col,
                                                    borderRadius: i % 3 === 0 ? "50%" : "2px",
                                                    boxShadow: `0 0 ${size*2}px ${col}`,
                                                    transform: `rotate(${sr}deg)`,
                                                    animation: `victoryStar ${dur}s ease-out ${delay}s infinite`,
                                                    ["--sx" as any]: `${sx}px`,
                                                    ["--sy" as any]: `${sy}px`,
                                                    ["--sr" as any]: `${sr}deg`,
                                                } as React.CSSProperties} />
                                            );
                                        })}

                                        {/* Modal principal */}
                                        <div className="text-center pointer-events-auto relative"
                                            style={{
                                                padding: "40px 56px",
                                                borderRadius: 24,
                                                border: result.status === "win"
                                                    ? "2px solid rgba(253,214,10,0.65)"
                                                    : "2px solid rgba(230,57,70,0.65)",
                                                background: result.status === "win"
                                                    ? "linear-gradient(160deg, rgba(7,11,20,0.97) 0%, rgba(35,25,5,0.98) 100%)"
                                                    : "linear-gradient(160deg, rgba(7,11,20,0.97) 0%, rgba(35,5,8,0.98) 100%)",
                                                animation: result.status === "win"
                                                    ? "victoryModalIn 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards, victoryGlow 2.5s ease-in-out 0.5s infinite"
                                                    : "defeatModalIn 0.7s cubic-bezier(0.22,1,0.36,1) forwards",
                                                minWidth: 340,
                                                boxShadow: result.status === "win"
                                                    ? "0 0 80px rgba(253,214,10,0.2), 0 32px 80px rgba(0,0,0,0.8)"
                                                    : "0 0 80px rgba(230,57,70,0.2), 0 32px 80px rgba(0,0,0,0.9)",
                                            }}>

                                            {/* Título — VICTORIA cae desde arriba, DERROTA aparece con glitch */}
                                            <h2 className="font-black uppercase mb-2 pointer-events-none"
                                                style={{
                                                    fontFamily: "'Rajdhani', sans-serif",
                                                    fontSize: "4rem",
                                                    letterSpacing: "0.1em",
                                                    lineHeight: 1,
                                                    color: result.status === "win" ? "#ffd60a" : "#e63946",
                                                    textShadow: result.status === "win"
                                                        ? "0 0 40px rgba(253,214,10,1), 0 0 80px rgba(253,214,10,0.6), 0 4px 16px rgba(0,0,0,1)"
                                                        : "0 0 40px rgba(230,57,70,1), 0 0 80px rgba(230,57,70,0.6), 0 4px 16px rgba(0,0,0,1)",
                                                    WebkitTextStroke: result.status === "win" ? "1px rgba(253,214,10,0.3)" : "1px rgba(230,57,70,0.3)",
                                                    animation: result.status === "win"
                                                        ? "victoryTitleDrop 0.65s cubic-bezier(0.34,1.56,0.64,1) 0.1s forwards"
                                                        : "defeatIn 0.8s ease-out forwards, defeatGlitch 3s ease-in-out 1.5s infinite",
                                                    opacity: 0,
                                                }}>
                                                {result.status === "win" ? "VICTORY!" : "DEFEAT..."}
                                            </h2>

                                            {/* Subtítulo */}
                                            <p className="font-mono text-sm mb-6"
                                                style={{ color: result.status === "win" ? "#fbbf24" : "#f87171", opacity: 0.8, letterSpacing: "0.2em" }}>
                                                {result.status === "win" ? "— BATTLE WON —" : "— BATTLE LOST —"}
                                            </p>

                                            {/* Recompensas (victoria) */}
                                            {result.status === "win" && (result.xp || result.coins) && (
                                                <div className="flex gap-4 justify-center mb-6">
                                                    {result.xp && (
                                                        <div style={{
                                                            padding: "10px 20px", borderRadius: 10,
                                                            border: "1px solid rgba(99,102,241,0.5)",
                                                            background: "rgba(99,102,241,0.12)",
                                                        }}>
                                                            <p className="font-mono font-black text-2xl text-indigo-300">+{result.xp}</p>
                                                            <p className="text-slate-400 text-xs font-mono tracking-widest">XP</p>
                                                        </div>
                                                    )}
                                                    {result.coins && (
                                                        <div style={{
                                                            padding: "10px 20px", borderRadius: 10,
                                                            border: "1px solid rgba(251,191,36,0.5)",
                                                            background: "rgba(251,191,36,0.1)",
                                                        }}>
                                                            <p className="font-mono font-black text-2xl text-yellow-300">+{result.coins}</p>
                                                            <p className="text-slate-400 text-xs font-mono tracking-widest">MONEDAS</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Botones */}
                                            <div className="flex gap-3 justify-center">
                                                <button
                                                    onClick={() => {
                                                        setPhase("prep");
                                                        setSession(null);
                                                        setLog([]);
                                                        setResult(null);
                                                        setPrepSlots([null, null, null]);
                                                        setPrepSearch("");
                                                        setEnemyRevealIndex(-1);
                                                    }}
                                                    style={{
                                                        padding: "10px 24px", borderRadius: 12,
                                                        background: result.status === "win"
                                                            ? "linear-gradient(135deg, #b45309, #d97706)"
                                                            : "linear-gradient(135deg, #7f1d1d, #991b1b)",
                                                        border: result.status === "win"
                                                            ? "1px solid rgba(251,191,36,0.6)"
                                                            : "1px solid rgba(248,113,113,0.6)",
                                                        color: "#ffffff", fontFamily: "monospace",
                                                        fontWeight: 900, fontSize: "13px",
                                                        letterSpacing: "0.12em", textTransform: "uppercase",
                                                        cursor: "pointer", transition: "all 0.15s",
                                                        boxShadow: result.status === "win"
                                                            ? "0 0 16px rgba(217,119,6,0.4)"
                                                            : "0 0 16px rgba(153,27,27,0.4)",
                                                    }}
                                                    onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
                                                    onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
                                                >
                                                    ⚔ REMATCH
                                                </button>
                                                <button
                                                    onClick={() => navigate("/")}
                                                    style={{
                                                        padding: "10px 24px", borderRadius: 12,
                                                        background: "transparent",
                                                        border: "1px solid rgba(100,116,139,0.5)",
                                                        color: "#94a3b8", fontFamily: "monospace",
                                                        fontWeight: 700, fontSize: "13px",
                                                        letterSpacing: "0.12em", textTransform: "uppercase",
                                                        cursor: "pointer", transition: "all 0.15s",
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(148,163,184,0.8)"; e.currentTarget.style.color = "#e2e8f0"; }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(100,116,139,0.5)"; e.currentTarget.style.color = "#94a3b8"; }}
                                                >
                                                    POSADA
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {/* Divisor central sutil */}
                                <div className="absolute top-8 bottom-8 pointer-events-none" style={{ left:"50%", width:1, background:"linear-gradient(180deg,transparent 0%,rgba(255,255,255,0.05) 50%,transparent 100%)" }}/>

                                {/* ── Círculos mágicos + sombras de suelo ──
                                    Posiciones alineadas con los depth slots de los sprites
                                    scaleY(0.38) → ilusión de plano horizontal */}
                                {(() => {
                                    // Dynamic ground circles matching current team sizes
                                    const aPC = session ? session.playerTeam.filter(m => !m.defeated).length : 3;
                                    const aEC = session ? session.enemyTeam.filter((m: any) => !m.defeated).length : 3;
                                    const pc = Math.max(aPC, 1), ec = Math.max(aEC, 1);
                                    const circles3v3P = [["16%","39%","13%","player"],["30%","58%","18%","player"],["16%","78%","24%","player"]] as const;
                                    const circles2v2P = [["24%","45%","17%","player"],["24%","72%","23%","player"]] as const;
                                    const circles1v1P = [["28%","55%","26%","player"]] as const;
                                    const circles3v3E = [["84%","39%","13%","enemy"],["70%","58%","18%","enemy"],["84%","78%","24%","enemy"]] as const;
                                    const circles2v2E = [["76%","45%","17%","enemy"],["76%","72%","23%","enemy"]] as const;
                                    const circles1v1E = [["72%","55%","26%","enemy"]] as const;
                                    const pCircles = pc === 1 ? circles1v1P : pc === 2 ? circles2v2P : circles3v3P;
                                    const eCircles = ec === 1 ? circles1v1E : ec === 2 ? circles2v2E : circles3v3E;
                                    const allCircles = [...pCircles, ...eCircles];
                                    return allCircles;
                                })().map(([l, t, sz, side], ci) => {
                                    const isPlayer = side === "player";
                                    const color = isPlayer ? "#22d3ee" : "#f87171";
                                    const shadowSize = `calc(${sz} + 2%)`;
                                    return (
                                        <React.Fragment key={`circle-${ci}`}>
                                            {/* Sombra de suelo */}
                                            <div className="absolute pointer-events-none" style={{
                                                left: l, top: t,
                                                width: shadowSize, paddingBottom: shadowSize,
                                                borderRadius: "50%",
                                                transform: "translate(-50%,-50%) scaleY(0.38)",
                                                background: "radial-gradient(ellipse at center, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 45%, transparent 72%)",
                                                filter: "blur(5px)",
                                                zIndex: 1,
                                            }}/>
                                            {/* Círculo mágico */}
                                            <div className="absolute pointer-events-none" style={{
                                                left: l, top: t,
                                                width: sz, paddingBottom: sz,
                                                borderRadius: "50%",
                                                transform: "translate(-50%,-50%) scaleY(0.38)",
                                                zIndex: 2,
                                            }}>
                                                {/* Relleno glow */}
                                                <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:`radial-gradient(circle, ${color}22 0%, transparent 70%)` }}/>
                                                {/* Anillo exterior — pulsa */}
                                                <div style={{ position:"absolute", inset:0, borderRadius:"50%", border:`2px solid ${color}`, opacity:0.55, boxShadow:`0 0 10px ${color}44`, animation:"circPulse 3s ease-in-out infinite" }}/>
                                                {/* Anillo interior — gira */}
                                                <div style={{ position:"absolute", top:"12%", left:"12%", right:"12%", bottom:"12%", borderRadius:"50%", border:`1px solid ${color}`, opacity:0.35, animation:"circSpin 8s linear infinite" }}/>
                                                {/* Runas SVG */}
                                                <svg style={{ position:"absolute", inset:0, opacity:0.22 }} viewBox="0 0 100 100">
                                                    <line x1="50" y1="10" x2="50" y2="90" stroke={color} strokeWidth="1.5"/>
                                                    <line x1="10" y1="50" x2="90" y2="50" stroke={color} strokeWidth="1.5"/>
                                                    <line x1="22" y1="22" x2="78" y2="78" stroke={color} strokeWidth="0.8"/>
                                                    <line x1="78" y1="22" x2="22" y2="78" stroke={color} strokeWidth="0.8"/>
                                                    <circle cx="50" cy="50" r="22" stroke={color} strokeWidth="0.8" fill="none"/>
                                                </svg>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}

                                {/* Proyectil */}
                                {projectile && <Projectile proj={projectile} />}

                                {/* ── Enemigos (derecha) — profundidad rotativa + dinámica 1v1/2v2/3v3 ── */}
                                {(phase === "prep" ? [null, null, null] : (session?.enemyTeam ?? [null,null,null])).map((myth: any, idx: number) => {
                                    // Count alive enemy myths
                                    const aliveEnemyCount = session ? session.enemyTeam.filter((m: any) => !m.defeated).length : 3;
                                    const totalEnemyCount = session ? session.enemyTeam.length : 3;
                                    const effectiveEnemySize = Math.max(aliveEnemyCount, 1);

                                    // Dynamic slot positions based on team size
                                    // 3v3: staggered depth layout
                                    // 2v2: two centered slots
                                    // 1v1: single centered slot
                                    const depthSlots3v3 = [
                                        { left: "84%", top: "39%", size: 32 }, // back
                                        { left: "70%", top: "58%", size: 40 }, // mid
                                        { left: "84%", top: "78%", size: 54 }, // front
                                    ];
                                    const depthSlots2v2 = [
                                        { left: "76%", top: "45%", size: 38 }, // back-center
                                        { left: "76%", top: "72%", size: 52 }, // front-center
                                        { left: "76%", top: "72%", size: 52 }, // (unused)
                                    ];
                                    const depthSlots1v1 = [
                                        { left: "72%", top: "55%", size: 58 }, // single centered
                                        { left: "72%", top: "55%", size: 58 },
                                        { left: "72%", top: "55%", size: 58 },
                                    ];
                                    const depthSlots = effectiveEnemySize === 1 ? depthSlots1v1 : effectiveEnemySize === 2 ? depthSlots2v2 : depthSlots3v3;

                                    // Active enemy → front, others rotate
                                    let depthIdx = idx;
                                    if (session) {
                                        const team = session.enemyTeam;
                                        const activeIdx = team.findIndex((m: any) => m?.instanceId === currentActorId);
                                        if (activeIdx >= 0) {
                                            const others = [0,1,2].filter(x => x !== activeIdx);
                                            const slotMap: Record<number,number> = {
                                                [activeIdx]: 2,
                                                [others[0]]: 1,
                                                [others[1]]: 0,
                                            };
                                            depthIdx = slotMap[idx] ?? idx;
                                        }
                                        // For 2v2: use only slots 1 and 2
                                        if (effectiveEnemySize === 2) depthIdx = depthIdx === 0 ? 0 : 1;
                                        // For 1v1: always slot 0
                                        if (effectiveEnemySize === 1) depthIdx = 0;
                                    }
                                    const dp = depthSlots[depthIdx];
                                    const zIdx = [5, 8, 12][depthIdx];
                                    const isPrepSlot = phase === "prep" || !myth;
                                    const revealed = myth && (idx < enemyRevealIndex);
                                    return (
                                        <div
                                            key={myth ? myth.instanceId : `eslot-${idx}`}
                                            className="absolute"
                                            style={{
                                                left: dp.left, top: dp.top,
                                                transform: "translate(-50%,-50%)",
                                                zIndex: zIdx,
                                                opacity: isPrepSlot ? 0.2 : (revealed ? 1 : 0),
                                                animation: (!isPrepSlot && revealed) ? `enemyLand 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards` : undefined,
                                                transition: "left 0.45s cubic-bezier(0.4,0,0.2,1), top 0.45s cubic-bezier(0.4,0,0.2,1)",
                                            }}
                                        >
                                            {isPrepSlot ? (
                                                <div className="rounded-full border-2 border-dashed border-red-500/50" style={{ width: spriteSize, height: spriteSize, background: "rgba(239,68,68,0.05)" }} />
                                            ) : (
                                                <ArenaMyth
                                                    myth={myth}
                                                    side="enemy"
                                                    mythRef={getMythRef(myth.instanceId)}
                                                    isActing={myth.instanceId === currentActorId}
                                                    targeted={myth.instanceId === targetEnemyMythId && currentActorIsPlayer}
                                                    flashAffinity={flashMap[myth.instanceId]}
                                                    floatingDmg={floatMap[myth.instanceId]}
                                                    supportOverlay={supportOverlays[myth.instanceId]}
                                                    koOverlay={!!koOverlays[myth.instanceId]}
                                                    spriteSize={dp.size}
                                                    distortionInfo={getDistortionInfo(myth)}
                                                    statusBlockedOverlays={statusBlockedOverlays}
                                                    statusEffectOverlays={statusEffectOverlays}
                                                    onClick={() => { if (!myth.defeated && !animating && currentActorIsPlayer) setTargetEnemyMythId(myth.instanceId); }}
                                                />
                                            )}
                                        </div>
                                    );
                                })}

                                {/* ── Turn number badge ── */}
                                {phase === "battle" && session && (
                                    <div className="absolute left-1/2 z-20 pointer-events-none"
                                        style={{ top: "10px", transform: "translateX(-50%)" }}>
                                        <div className="flex items-center gap-2.5 rounded-full px-5 py-1.5"
                                            style={{
                                                background: "linear-gradient(135deg, rgba(7,11,20,0.92) 0%, rgba(20,30,50,0.95) 100%)",
                                                border: "1px solid rgba(255,255,255,0.15)",
                                                boxShadow: "0 0 20px rgba(0,0,0,0.6), 0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
                                                backdropFilter: "blur(12px)",
                                            }}>
                                            <div style={{ width: 22, height: 1, background: "linear-gradient(90deg, transparent, rgba(148,163,184,0.4))" }} />
                                            <span className="font-mono text-slate-400 tracking-[0.22em] uppercase" style={{ fontSize: "11px" }}>Turn</span>
                                            <span className="font-mono font-black text-white tabular-nums"
                                                style={{ fontSize: "1.25rem", textShadow: "0 0 14px rgba(255,255,255,0.35)", letterSpacing: "-0.01em" }}>
                                                {session.turn}
                                            </span>
                                            <div style={{ width: 22, height: 1, background: "linear-gradient(90deg, rgba(148,163,184,0.4), transparent)" }} />
                                        </div>
                                    </div>
                                )}

                                {/* ── Jugador (izquierda) — profundidad rotativa ── */}
                                {/* El myth activo siempre ocupa el slot frontal (más grande).
                                    Los otros dos rotan a mid/back automáticamente. */}
                                {[0, 1, 2].map((i) => {
                                    // Dynamic depth slots: adapt to 1v1 / 2v2 / 3v3
                                    const myth = phase === "prep" ? prepSlots[i] : session?.playerTeam[i];

                                    const alivePlayerCount = session ? session.playerTeam.filter(m => !m.defeated).length : 3;
                                    const effectivePlayerSize = Math.max(alivePlayerCount, 1);

                                    const depthSlots3v3 = [
                                        { left: "16%",  top: "39%", size: 32 }, // back
                                        { left: "30%",  top: "58%", size: 40 }, // mid
                                        { left: "16%",  top: "78%", size: 54 }, // front
                                    ];
                                    const depthSlots2v2 = [
                                        { left: "24%",  top: "45%", size: 38 }, // back-center
                                        { left: "24%",  top: "72%", size: 52 }, // front-center
                                        { left: "24%",  top: "72%", size: 52 }, // (unused)
                                    ];
                                    const depthSlots1v1 = [
                                        { left: "28%",  top: "55%", size: 58 }, // single centered
                                        { left: "28%",  top: "55%", size: 58 },
                                        { left: "28%",  top: "55%", size: 58 },
                                    ];
                                    const depthSlots = effectivePlayerSize === 1 ? depthSlots1v1 : effectivePlayerSize === 2 ? depthSlots2v2 : depthSlots3v3;

                                    // Active myth → front slot, others rotate
                                    let depthIdx = i;
                                    if (phase === "battle" && session) {
                                        const team = session.playerTeam;
                                        const activeIdx = team.findIndex(m => m.instanceId === currentActorId);
                                        if (activeIdx >= 0) {
                                            const others = [0,1,2].filter(x => x !== activeIdx);
                                            const slotMap: Record<number, number> = {
                                                [activeIdx]: 2,
                                                [others[0]]: 1,
                                                [others[1]]: 0,
                                            };
                                            depthIdx = slotMap[i] ?? i;
                                        }
                                        if (effectivePlayerSize === 2) depthIdx = depthIdx === 0 ? 0 : 1;
                                        if (effectivePlayerSize === 1) depthIdx = 0;
                                    }
                                    const dp = depthSlots[depthIdx];

                                    // zIndex: front > mid > back
                                    const zIdx = [5, 8, 12][depthIdx];

                                    // Handler de drop para prep
                                    const handleDrop = (e: React.DragEvent) => {
                                        e.preventDefault();
                                        const data = e.dataTransfer.getData("mythId");
                                        const from = e.dataTransfer.getData("fromSlot");
                                        const found = allMyths.find((m) => (m.id ?? m.instanceId) === data);
                                        if (!found) return;
                                        const ns = [...prepSlots];
                                        if (from !== "") {
                                            const fromIdx = parseInt(from);
                                            if (!isNaN(fromIdx)) ns[fromIdx] = null;
                                        }
                                        const displaced = ns[i];
                                        ns[i] = found;
                                        if (displaced && from !== "" && !isNaN(parseInt(from))) ns[parseInt(from)] = displaced;
                                        setPrepSlots(ns);
                                    };

                                    return (
                                        <div
                                            key={i}
                                            className="absolute"
                                            style={{
                                                left: dp.left,
                                                top: dp.top,
                                                transform: "translate(-50%,-50%)",
                                                zIndex: zIdx,
                                                transition: "left 0.45s cubic-bezier(0.4,0,0.2,1), top 0.45s cubic-bezier(0.4,0,0.2,1)",
                                            }}
                                            onDragOver={phase === "prep" ? (e) => e.preventDefault() : undefined}
                                            onDrop={phase === "prep" ? handleDrop : undefined}
                                        >
                                            {phase === "prep" ? (
                                                <div
                                                    className={`flex flex-col items-center gap-1 rounded-2xl transition-all p-1
                                                        ${myth ? "" : "border-2 border-dashed border-cyan-400/50 bg-cyan-400/5 hover:border-cyan-400/80 hover:bg-cyan-400/10"}`}
                                                    style={{ minWidth: spriteSize + 12, minHeight: spriteSize + 36, justifyContent: "center" }}
                                                >
                                                    {myth ? (
                                                        <div
                                                            draggable
                                                            onDragStart={(e) => { e.dataTransfer.setData("mythId", myth.id ?? myth.instanceId); e.dataTransfer.setData("fromSlot", String(i)); }}
                                                            onClick={() => { const ns = [...prepSlots]; ns[i] = null; setPrepSlots(ns); }}
                                                            className="flex flex-col items-center gap-1 cursor-grab active:cursor-grabbing"
                                                        >
                                                            <MythArt art={myth.art} px={spriteSize} className="animate-myth-idle" />
                                                            <p className="font-mono text-xs text-white font-bold truncate text-center" style={{ maxWidth: spriteSize + 8 }}>{myth.name}</p>
                                                            <p className="font-mono text-[10px] text-slate-400">Nv.{myth.level}</p>
                                                            <span className="text-[9px] text-red-400/50 font-mono">✕ remove</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1 opacity-40 pointer-events-none">
                                                            <span className="text-cyan-400 text-2xl">＋</span>
                                                            <p className="font-mono text-[10px] text-cyan-400">Slot {i + 1}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : myth ? (
                                                <ArenaMyth
                                                    myth={myth}
                                                    side="player"
                                                    mythRef={getMythRef(myth.instanceId)}
                                                    isActing={myth.instanceId === currentActorId}
                                                    targeted={!!(selectedItem && !myth.defeated)}
                                                    targetColor={selectedItem ? "rgba(251,191,36,0.8)" : undefined}
                                                    flashAffinity={flashMap[myth.instanceId]}
                                                    floatingDmg={floatMap[myth.instanceId]}
                                                    supportOverlay={supportOverlays[myth.instanceId]}
                                                    koOverlay={!!koOverlays[myth.instanceId]}
                                                    spriteSize={dp.size}
                                                    distortionInfo={getDistortionInfo(myth)}
                                                    statusBlockedOverlays={statusBlockedOverlays}
                                                    statusEffectOverlays={statusEffectOverlays}
                                                    onClick={selectedItem && !myth.defeated ? () => handleUseItem(myth.instanceId) : undefined}
                                                />
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ── Prep panel (only during prep phase) ── */}
                            {phase === "prep" && (
                                <div
                                    className="flex-shrink-0 border-t border-slate-800 bg-[#070b14]"
                                    style={{ height: winW < 900 ? "140px" : "200px", overflow: "hidden", flexShrink: 0 }}
                                >
                                    <div className="flex h-full">
                                        <div className="flex-1 flex flex-col min-w-0">
                                            <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 border-b border-slate-800 flex-shrink-0">
                                                <span className="text-slate-500 text-xs">🔍</span>
                                                <input
                                                    type="text"
                                                    value={prepSearch}
                                                    onChange={(e) => setPrepSearch(e.target.value)}
                                                    placeholder="Search myth..."
                                                    className="flex-1 bg-transparent text-xs font-mono text-white placeholder-slate-600 outline-none"
                                                />
                                                <span className="text-slate-600 text-[10px] font-mono">
                                                    {prepSlots.filter(Boolean).length}/3
                                                </span>
                                            </div>
                                            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                                                <div className="flex gap-2 px-3 py-2 h-full items-center" style={{ width: "max-content" }}>
                                                    {allMyths
                                                        .filter((m) => {
                                                            const inSlot = prepSlots.some(
                                                                (s) => s && (s.id ?? s.instanceId) === (m.id ?? m.instanceId)
                                                            );
                                                            const q = prepSearch.toLowerCase();
                                                            const matchesSearch = !q || m.name.toLowerCase().includes(q) || (m.affinities ?? []).some((a: string) => a.toLowerCase().includes(q));
                                                            return !inSlot && matchesSearch;
                                                        })
                                                        .map((m) => {
                                                            const px = winW < 900 ? 48 : 60;
                                                            const canAdd = prepSlots.some((s) => s === null);
                                                            return (
                                                                <div
                                                                    key={m.id ?? m.instanceId}
                                                                    draggable
                                                                    onDragStart={(e) => { e.dataTransfer.setData("mythId", m.id ?? m.instanceId); e.dataTransfer.setData("fromSlot", ""); }}
                                                                    onClick={() => {
                                                                        if (!canAdd) return;
                                                                        const ns = [...prepSlots];
                                                                        const idx = ns.findIndex((s) => s === null);
                                                                        if (idx >= 0) { ns[idx] = m; setPrepSlots(ns); }
                                                                    }}
                                                                    className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all cursor-pointer flex-shrink-0
                                                                        ${canAdd ? "border-slate-700 bg-slate-800/60 hover:border-blue-500/60 hover:bg-blue-500/10 cursor-pointer hover:scale-105" : "border-slate-800 bg-slate-900/40 opacity-40 cursor-not-allowed"}`}
                                                                >
                                                                    <MythArt art={m.art} px={px} className="animate-myth-idle" />
                                                                    <p className="font-mono text-[10px] text-white font-bold truncate text-center" style={{ maxWidth: px + 8 }}>{m.name}</p>
                                                                    <div className="flex gap-0.5">
                                                                        {(m.affinities ?? []).slice(0,2).map((aff: string) => (
                                                                            <AffinityIcon key={aff} affinity={aff} size={12} />
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-shrink-0 flex flex-col gap-2 px-3 py-2 border-l border-slate-800 justify-center items-center" style={{ width: 120 }}>
                                            <button
                                                onClick={() => { const order = prepSlots.filter(Boolean).map((m: any) => m.id ?? m.instanceId); handleStart(order); }}
                                                disabled={prepSlots.filter(Boolean).length < 1 || loadingStart}
                                                className="w-full flex items-center justify-center gap-1.5 rounded-xl font-mono font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                                style={{ height: 44, fontSize: "13px", background: "linear-gradient(135deg,#7c3aed,#4f46e5)", border: "1px solid rgba(139,92,246,0.5)", color: "#fff", boxShadow: "0 0 20px rgba(124,58,237,0.3)" }}
                                            >
                                                <span>{loadingStart ? "..." : "COMBAT"}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                                {/* ── NPC turn waiting indicator ── */}
                                {phase === "battle" && !currentActorIsPlayer && animating && (
                                    <div className="absolute z-25 pointer-events-none"
                                        style={{ bottom: 80, left: "50%", transform: "translateX(-50%)" }}>
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                                            style={{ background: "rgba(7,11,20,0.82)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(6px)" }}>
                                            <span className="flex gap-1">
                                                {[0,1,2].map(i => (
                                                    <span key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: "#818cf8", display: "inline-block", animation: `dotPulse 1s ease-in-out ${i*0.3}s infinite` }} />
                                                ))}
                                            </span>
                                            <span style={{ fontSize: 10, fontFamily: "monospace", color: "#64748b", letterSpacing: "0.08em" }}>Opponent acting</span>
                                        </div>
                                    </div>
                                )}

                                {/* ── 3 floating move circles — battle phase only ── */}
                            {phase === "battle" && (() => {
                                const actorForMoves =
                                    currentActorIsPlayer && currentActor && !currentActor.defeated
                                        ? currentActor
                                        : currentActorIsPlayer
                                          ? (session?.playerTeam.find((m) => !m.defeated) ?? null)
                                          : (() => {
                                                const last = lastPlayerActorId
                                                    ? [...(session?.playerTeam ?? [])].find(m => m.instanceId === lastPlayerActorId && !m.defeated)
                                                    : null;
                                                return last ?? (session?.playerTeam.find(m => !m.defeated) ?? null);
                                            })();

                                if (!actorForMoves) return null;
                                const moves = actorForMoves.moves ?? [];
                                if (moves.length === 0) return null;

                                // Slots: [0]=basic, [1]=skill, [2]=ulti — order: basic left, ulti center (big), skill right
                                const slots: Array<{ move: any; slot: "basic"|"skill"|"ulti" }> = [
                                    { move: moves[0], slot: "basic" },
                                    { move: moves[2] ?? moves[1], slot: "ulti" },
                                    { move: moves[1], slot: "skill" },
                                ];

                                const isDesktopLayout = winW >= 900;

                                return (
                                    <div
                                        className="absolute z-30 flex flex-col items-center gap-2"
                                        style={{ bottom: isDesktopLayout ? 16 : 8, left: "50%", transform: "translateX(-50%)" }}
                                    >
                                        {/* Circles row */}
                                        <div className="flex items-flex-end justify-center gap-3">
                                        {slots.map(({ move, slot }, si) => {
                                            if (!move) return null;
                                            const cfg = AFFINITY_CONFIG[move.affinity as Affinity] ?? AFFINITY_CONFIG.EMBER;
                                            const onCooldown = !!(actorForMoves.cooldownsLeft?.[move.id] > 0);
                                            const cdLeft = actorForMoves.cooldownsLeft?.[move.id] ?? 0;
                                            const firstLiveEnemy = session?.enemyTeam.find((m) => !m.defeated) ?? null;
                                            const effectiveTarget = targetEnemy ?? firstLiveEnemy;
                                            const ok = !animating && !!effectiveTarget && !effectiveTarget.defeated && !onCooldown && currentActorIsPlayer;
                                            return (
                                                <MoveCircle
                                                    key={move.id ?? si}
                                                    move={move}
                                                    cfg={cfg}
                                                    ok={ok}
                                                    onCooldown={onCooldown}
                                                    cdLeft={cdLeft}
                                                    slot={slot}
                                                    desktop={isDesktopLayout}
                                                    onSelect={() => {
                                                        if (!targetEnemy && firstLiveEnemy) setTargetEnemyMythId(firstLiveEnemy.instanceId);
                                                        handleMove(move.id, effectiveTarget?.instanceId);
                                                    }}
                                                />
                                            );
                                        })}
                                        </div>
                                        {/* Desktop: move descriptions row */}
                                        {isDesktopLayout && (
                                            <div className="flex gap-3 justify-center">
                                                {slots.map(({ move, slot }, si) => {
                                                    if (!move) return null;
                                                    const cfg = AFFINITY_CONFIG[move.affinity as Affinity] ?? AFFINITY_CONFIG.EMBER;
                                                    const onCooldown = !!(actorForMoves.cooldownsLeft?.[move.id] > 0);
                                                    const isUlti = slot === "ulti";
                                                    return (
                                                        <div key={move.id ?? si} style={{
                                                            width: isUlti ? 160 : 130,
                                                            background: "rgba(7,11,20,0.82)",
                                                            border: `1px solid ${onCooldown ? "rgba(100,116,139,0.2)" : (cfg.glow ?? "#f97316") + "33"}`,
                                                            borderRadius: 8, padding: "5px 8px",
                                                            backdropFilter: "blur(6px)",
                                                            opacity: onCooldown ? 0.45 : 1,
                                                        }}>
                                                            <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                                                                <AffinityIcon affinity={move.affinity} size={11} />
                                                                <span style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 900, color: cfg.glow ?? "#f97316" }}>
                                                                    {move.name}
                                                                </span>
                                                                {move.power > 0 && <span style={{ fontSize: 9, color: "var(--text-secondary)", marginLeft: "auto", fontFamily: "monospace" }}>⚡{move.power}</span>}
                                                            </div>
                                                            <p style={{ fontSize: 9, color: "var(--text-secondary)", lineHeight: 1.4, margin: 0,
                                                                overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                                                                {move.description}
                                                            </p>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {/* ── Log toggle button — mobile only ── */}
                        {winW < 900 && (
                        <button
                            onClick={() => setLogOpen(v => !v)}
                            className="absolute z-40 flex flex-col items-center justify-center gap-2 transition-all hover:brightness-125 active:scale-95"
                            style={{
                                right: logOpen ? 248 : 0,
                                top: "50%", transform: "translateY(-50%)",
                                width: 32, height: 72,
                                background: logOpen ? "rgba(30,41,59,0.97)" : "rgba(15,23,42,0.85)",
                                border: "1px solid rgba(99,102,241,0.35)",
                                borderRight: logOpen ? "none" : "1px solid rgba(99,102,241,0.35)",
                                borderRadius: "8px 0 0 8px",
                                boxShadow: "0 0 16px rgba(99,102,241,0.15)",
                                transition: "right 0.25s cubic-bezier(0.4,0,0.2,1)",
                                cursor: "pointer",
                            }}
                            title={logOpen ? "Hide log" : "Show log"}
                        >
                            <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
                                <line x1="1" y1="1.5"  x2="13" y2="1.5"  stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round"/>
                                <line x1="1" y1="5.5"  x2="13" y2="5.5"  stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round"/>
                                <line x1="1" y1="9.5"  x2="9"  y2="9.5"  stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            <span style={{ fontSize: 9, color: "#818cf8", opacity: 0.5 }}>{logOpen ? "▶" : "◀"}</span>
                        </button>
                        )}

                        {/* ── Log panel — static on desktop, drawer on mobile ── */}
                        <div
                            className="flex flex-col"
                            style={{
                                width: 248,
                                background: "rgba(7,11,20,0.97)",
                                borderLeft: "1px solid rgba(99,102,241,0.2)",
                                flexShrink: 0,
                                ...(winW < 900 ? {
                                    position: "absolute", right: 0, top: 0, bottom: 0,
                                    transform: logOpen ? "translateX(0)" : "translateX(100%)",
                                    transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
                                    boxShadow: logOpen ? "-8px 0 32px rgba(0,0,0,0.5)" : "none",
                                    zIndex: 30,
                                } : {
                                    zIndex: 10,
                                }),
                            }}
                        >
                            <div className="px-3 py-2.5 border-b border-slate-800 bg-slate-900/60 flex-shrink-0 flex items-center justify-between">
                                <p className="font-mono text-xs text-indigo-400 uppercase tracking-widest font-bold">Combat Log</p>
                                {winW < 900 && <button onClick={() => setLogOpen(false)} className="text-slate-600 hover:text-slate-300 transition-colors text-xs">✕</button>}
                            </div>
                            <div
                                ref={logRef}
                                className="flex-1 overflow-y-auto flex flex-col justify-end min-h-0"
                                style={{ scrollbarWidth: "thin", scrollbarColor: "#1e293b transparent" }}
                            >
                                <div className="flex flex-col gap-px p-2">
                                {log.length === 0 && (
                                    <p className="text-slate-700 text-xs font-mono italic text-center mt-6">
                                        Waiting for action...
                                    </p>
                                )}
                                {log.map((entry, i) => {
                                    const isMainAction = entry.type === "normal" && !!entry.actorName;
                                    const isSystem     = entry.type === "system";
                                    const isStatus     = entry.type === "status";
                                    const isGood       = entry.type === "good";
                                    const isBad        = entry.type === "bad";
                                    const isHeal       = entry.type === "heal";
                                    const isMiss       = entry.type === "miss";

                                    // Badge de nombre — fondo sólido del color de afinidad
                                    function AfBadge({ affinity, name }: { affinity?: string; name?: string }) {
                                        if (!name) return null;
                                        const upper = name.toUpperCase();
                                        const cfg = affinity ? AFFINITY_CONFIG[affinity as keyof typeof AFFINITY_CONFIG] : null;
                                        if (!cfg) return <span className="font-black text-white/80 text-[11px]">{upper}</span>;
                                        return (
                                            <span style={{
                                                display: "inline-flex", alignItems: "center", gap: 3,
                                                background: `${cfg.glow}22`, border: `1px solid ${cfg.glow}66`,
                                                color: "#fff", fontSize: "11px", fontWeight: 900,
                                                borderRadius: 4, padding: "1px 5px 1px 3px",
                                                lineHeight: "16px", whiteSpace: "nowrap",
                                                letterSpacing: "0.04em",
                                                textShadow: "0 1px 2px rgba(0,0,0,0.9)",
                                                verticalAlign: "middle",
                                                fontFamily: "monospace",
                                                textTransform: "uppercase",
                                            }}>
                                                <AffinityIcon affinity={affinity!} size={13} />
                                                {upper}
                                            </span>
                                        );
                                    }

                                    // Entrada principal de acción — todo en 1 línea
                                    if (isMainAction) {
                                        const actorCfg = entry.actorAffinity
                                            ? AFFINITY_CONFIG[entry.actorAffinity as keyof typeof AFFINITY_CONFIG]
                                            : null;
                                        // Extraer el nombre del move del texto
                                        const moveName = entry.text.replace(`${entry.actorName} usa `, "");
                                        const hasDmg   = (entry.damage ?? 0) > 0;
                                        const isCrit   = entry.isCrit;
                                        const isMissed = entry.missed;
                                        const eff      = entry.mult ?? 1;
                                        const status   = entry.statusApplied;
                                        const statusIc = entry.statusIcon;
                                        const isEnemyActor = !entry.isPlayerMyth;

                                        return (
                                            <div key={i} className="animate-log-in" style={{
                                                background: actorCfg ? actorCfg.color + "18" : "rgba(255,255,255,0.03)",
                                                borderLeft: actorCfg ? `3px solid ${actorCfg.glow}99` : "3px solid #334155",
                                                borderRadius: "0 5px 5px 0",
                                                padding: "5px 8px",
                                                marginBottom: 3,
                                            }}>
                                                {/* Línea principal: ACTOR usa MOVE → TARGET [daño] */}
                                                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px", lineHeight: 1.5 }}>
                                                    {isEnemyActor && <span style={{ fontSize: "10px", opacity: 0.5 }}>👾</span>}
                                                    <AfBadge affinity={entry.actorAffinity} name={entry.actorName} />
                                                    <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>usa</span>
                                                    <span style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 700, fontFamily: "monospace" }}>{moveName}</span>
                                                    {entry.targetName && entry.targetName !== entry.actorName && (
                                                        <>
                                                            <span style={{ fontSize: "10px", color: "#475569" }}>→</span>
                                                            <AfBadge affinity={entry.targetAffinity} name={entry.targetName} />
                                                        </>
                                                    )}
                                                    {/* Daño */}
                                                    {hasDmg && (
                                                        <span style={{
                                                            fontSize: "13px", fontWeight: 900, fontFamily: "monospace",
                                                            color: isCrit ? "#ff4444" : eff >= 2 ? "#fb923c" : eff <= 0.5 ? "#60a5fa" : "#f1f5f9",
                                                            textShadow: isCrit ? "0 0 8px #ff000066" : "none",
                                                            marginLeft: 2,
                                                        }}>
                                                            {isCrit ? "💥" : ""}{eff >= 2 ? "⚡" : eff > 0 && eff < 1 ? "💤" : ""}−{entry.damage}
                                                        </span>
                                                    )}
                                                    {isMissed && <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>miss!</span>}
                                                    {/* Estado aplicado */}
                                                    {status && (
                                                        <span style={{ fontSize: "11px", color: "var(--accent-orange)", fontFamily: "monospace" }}>
                                                            {statusIc} {status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Líneas secundarias: system, status, good, bad, heal, miss
                                    // Para líneas de status, detectar el estado en el texto para colorear apropiadamente
                                    const statusColorFromText = isStatus ? (
                                        entry.text?.includes("burn") || entry.text?.includes("burn") ? "#fb923c" :
                                        entry.text?.includes("poison") || entry.text?.includes("poison") ? "#4ade80" :
                                        entry.text?.includes("paralyze") || entry.text?.includes("parálisis") || entry.text?.includes("paraliz") ? "#fde047" :
                                        entry.text?.includes("freeze") || entry.text?.includes("congel") || entry.text?.includes("hielo") ? "#7dd3fc" :
                                        entry.text?.includes("fear") || entry.text?.includes("miedo") || entry.text?.includes("FEARED") ? "#c084fc" :
                                        entry.text?.includes("stun") || entry.text?.includes("aturdi") || entry.text?.includes("STUNNED") ? "#facc15" :
                                        entry.text?.includes("curse") || entry.text?.includes("maldici") || entry.text?.includes("CURSED") ? "#a855f7" :
                                        "#fb923c"
                                    ) : null;
                                    const secondaryColor =
                                        isSystem ? "#818cf8" :
                                        isStatus ? (statusColorFromText ?? "#fb923c") :
                                        isGood   ? "#4ade80" :
                                        isBad    ? "#f87171" :
                                        isHeal   ? "#34d399" :
                                        isMiss   ? "#64748b" : "#94a3b8";

                                    return (
                                        <div key={i} className="animate-log-in" style={{
                                            padding: "2px 11px",
                                            marginBottom: 1,
                                        }}>
                                            <span style={{
                                                fontSize: "11px", fontFamily: "monospace",
                                                color: secondaryColor, lineHeight: 1.5,
                                            }}>
                                                {entry.text}
                                            </span>
                                        </div>
                                    );
                                })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {explosion && (
                <ImpactExplosion
                    x={explosion.x}
                    y={explosion.y}
                    fromX={explosion.fromX}
                    fromY={explosion.fromY}
                    affinity={explosion.affinity}
                    level={explosion.level}
                    onDone={() => setExplosion(null)}
                />
            )}
            {distortionOverlay && (
                <DistortionOverlay
                    mythName={distortionOverlay.newName}
                    newAffinities={distortionOverlay.newAffinities}
                    newRarity={distortionOverlay.newRarity}
                    spriteRect={distortionOverlay.spriteRect}
                />
            )}
        </div>
    );
}

// ─────────────────────────────────────────
// DistortionOverlay — centrado en el sprite, efectos por rareza
// ─────────────────────────────────────────

function DistortionOverlay({
    mythName, newAffinities, newRarity, spriteRect,
}: {
    mythName: string; newAffinities: string[]; newRarity: string;
    spriteRect: { x: number; y: number; w: number; h: number };
}) {
    const cx = spriteRect.x + spriteRect.w / 2;
    const cy = spriteRect.y + spriteRect.h / 2;
    const r = Math.max(spriteRect.w, 80) / 2;

    // Paleta principal: blanco + lila — siempre, independiente de rareza
    const LILA = "#c084fc";
    const LILA2 = "#a855f7";
    const LILA3 = "#7c3aed";
    const WHITE = "#ffffff";

    // Rareza determina intensidad y efectos extra, NO el color
    const intensity = { RARE: 1, EPIC: 1.2, ELITE: 1.4, LEGENDARY: 1.7, MYTHIC: 2.0 }[newRarity] ?? 1;
    const ringCount = Math.round(3 * intensity);
    const particleCount = Math.round(14 * intensity);
    const hasLightBeam = intensity >= 1.2;
    const hasGlitch = newRarity === "MYTHIC";
    const hasGoldAccent = newRarity === "LEGENDARY" || newRarity === "MYTHIC";

    const particles = Array.from({ length: particleCount }, (_, i) => {
        const angle = (i / particleCount) * Math.PI * 2;
        const dist = r * (1.2 + (i % 4) * 0.35);
        return {
            tx: Math.cos(angle) * dist,
            ty: Math.sin(angle) * dist,
            delay: 0.06 + i * 0.04,
            white: i % 3 === 0,
        };
    });

    const shards = intensity >= 1.7 ? Array.from({ length: 10 }, (_, i) => {
        const angle = (i / 10) * Math.PI * 2 + 0.15;
        const dist = r * 2.0;
        return { tx: Math.cos(angle) * dist, ty: Math.sin(angle) * dist, delay: 0.12 + i * 0.055 };
    }) : [];

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 310 }}>

            {/* Tinte de pantalla blanco-lila */}
            <div className="absolute inset-0"
                style={{ background: `radial-gradient(ellipse at ${cx}px ${cy}px, ${LILA}22 0%, ${LILA3}11 40%, transparent 70%)`, animation: "distortWhitePulse 4.5s ease-out forwards" }} />

            {/* Flash blanco central al inicio */}
            <div className="absolute inset-0"
                style={{ background: "#ffffff08", animation: "distortWhitePulse 0.6s ease-out forwards" }} />

            {/* Columna de luz vertical (EPIC+) */}
            {hasLightBeam && (
                <div className="absolute pointer-events-none"
                    style={{
                        left: cx - 24, top: 0,
                        width: 48, height: "100%",
                        background: `linear-gradient(180deg, transparent 0%, ${LILA3}00 25%, ${LILA}55 46%, ${WHITE}99 50%, ${LILA}55 54%, ${LILA3}00 75%, transparent 100%)`,
                        animation: "distortFlash 2.2s ease-out 0.15s forwards",
                        opacity: 0, filter: "blur(5px)",
                    }}
                />
            )}

            {/* Glow radial blanco-lila centrado */}
            <div className="absolute rounded-full pointer-events-none"
                style={{
                    left: cx, top: cy,
                    width: r * 7, height: r * 7,
                    marginLeft: -(r * 3.5), marginTop: -(r * 3.5),
                    background: `radial-gradient(circle, ${WHITE}33 0%, ${LILA}33 25%, ${LILA2}22 50%, transparent 70%)`,
                    animation: "distortLilaPulse 3s ease-out forwards",
                }}
            />

            {/* Anillos expansivos lila/blanco alternos */}
            {Array.from({ length: ringCount }).map((_, i) => (
                <div key={i} className="absolute rounded-full"
                    style={{
                        left: cx, top: cy,
                        width: r * 1.4, height: r * 1.4,
                        marginLeft: -(r * 0.7), marginTop: -(r * 0.7),
                        border: `${Math.max(1, Math.ceil((ringCount - i) * 0.8))}px solid ${i % 2 === 0 ? WHITE : LILA}`,
                        boxShadow: `0 0 ${14 + i * 10}px ${i % 2 === 0 ? WHITE : LILA}99, 0 0 ${28 + i * 14}px ${LILA}44`,
                        animation: `distortRingOut ${0.5 + i * 0.16}s ease-out ${0.05 + i * 0.12}s forwards`,
                        opacity: 0,
                    }}
                />
            ))}

            {/* Partículas radiales blanco/lila */}
            {particles.map((p, i) => (
                <div key={i} className="absolute rounded-full"
                    style={{
                        left: cx, top: cy,
                        width: 4 + (i % 3) * 2, height: 4 + (i % 3) * 2,
                        marginLeft: -(2 + (i % 3)), marginTop: -(2 + (i % 3)),
                        background: p.white ? WHITE : (i % 2 === 0 ? LILA : LILA2),
                        boxShadow: `0 0 ${8 + (i % 3) * 4}px ${p.white ? WHITE : LILA}`,
                        animation: `distortParticle 1.3s ease-out ${p.delay}s forwards`,
                        opacity: 0,
                        ["--tx" as any]: `${p.tx}px`,
                        ["--ty" as any]: `${p.ty}px`,
                    } as React.CSSProperties}
                />
            ))}

            {/* Shards largos (LEGENDARY+) */}
            {shards.map((s, i) => (
                <div key={`sh${i}`} className="absolute"
                    style={{
                        left: cx, top: cy,
                        width: 2.5, height: 20 + (i % 4) * 9,
                        marginLeft: -1.25, marginTop: -10,
                        background: `linear-gradient(180deg, ${WHITE} 0%, ${LILA} 100%)`,
                        boxShadow: `0 0 10px ${LILA}, 0 0 20px ${LILA2}66`,
                        borderRadius: 2,
                        transform: `rotate(${(i / 10) * 360}deg)`,
                        transformOrigin: "center",
                        animation: `distortParticle 1.5s ease-out ${s.delay}s forwards`,
                        opacity: 0,
                        ["--tx" as any]: `${s.tx}px`,
                        ["--ty" as any]: `${s.ty}px`,
                    } as React.CSSProperties}
                />
            ))}

            {/* Acento dorado para LEGENDARY/MYTHIC */}
            {hasGoldAccent && (
                <div className="absolute rounded-full pointer-events-none"
                    style={{
                        left: cx, top: cy,
                        width: r * 3, height: r * 3,
                        marginLeft: -(r * 1.5), marginTop: -(r * 1.5),
                        border: `2px solid #fbbf2466`,
                        boxShadow: `0 0 30px #fbbf2444`,
                        animation: "distortRingOut 0.9s ease-out 0.3s forwards",
                        opacity: 0,
                    }}
                />
            )}

            {/* Glitch MYTHIC */}
            {hasGlitch && (
                <>
                    <div className="absolute rounded-full pointer-events-none"
                        style={{
                            left: cx + 10, top: cy,
                            width: r * 4, height: r * 4,
                            marginLeft: -(r * 2), marginTop: -(r * 2),
                            background: `radial-gradient(circle, #ef444422 0%, transparent 60%)`,
                            animation: "distortGlitch 0.7s ease-out 0.25s forwards", opacity: 0,
                        }}
                    />
                    <div className="absolute rounded-full pointer-events-none"
                        style={{
                            left: cx - 10, top: cy,
                            width: r * 3, height: r * 3,
                            marginLeft: -(r * 1.5), marginTop: -(r * 1.5),
                            background: `radial-gradient(circle, #00ffff18 0%, transparent 60%)`,
                            animation: "distortGlitch 0.7s ease-out 0.4s forwards", opacity: 0,
                        }}
                    />
                </>
            )}

            {/* Nombre — blanco puro con glow lila */}
            <div className="absolute font-black uppercase pointer-events-none"
                style={{
                    left: cx, top: spriteRect.y - 10,
                    transform: "translateX(-50%) translateY(-100%)",
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: newRarity === "MYTHIC" || newRarity === "LEGENDARY" ? "1.75rem" : "1.45rem",
                    color: WHITE,
                    textShadow: `0 0 24px ${LILA}, 0 0 50px ${LILA2}aa, 0 0 90px ${LILA3}55, 0 3px 10px rgba(0,0,0,1)`,
                    WebkitTextStroke: `1.5px ${LILA}`,
                    letterSpacing: "0.12em", whiteSpace: "nowrap",
                    animation: "distortNameIn 0.45s cubic-bezier(0.2,0,0,1.4) 0.4s forwards",
                    opacity: 0,
                }}
            >
                {mythName}
            </div>

            {/* Subtítulo distorsión */}
            <div className="absolute font-mono font-black uppercase pointer-events-none"
                style={{
                    left: cx, top: spriteRect.y + spriteRect.h + 8,
                    transform: "translateX(-50%)",
                    fontSize: "0.65rem", color: LILA,
                    textShadow: `0 0 12px ${LILA}, 0 0 24px ${LILA2}, 0 2px 4px rgba(0,0,0,0.9)`,
                    letterSpacing: "0.35em", whiteSpace: "nowrap",
                    animation: "distortNameIn 0.45s cubic-bezier(0.2,0,0,1.4) 0.55s forwards",
                    opacity: 0,
                }}
            >
                🌀 distorsión
            </div>

            {/* Imagen nueva forma: drop-in dramático desde arriba */}
            <div className="absolute pointer-events-none"
                style={{
                    left: cx, top: cy,
                    transform: "translateX(-50%) translateY(-50%)",
                    zIndex: 5,
                    animation: "distortDropIn 0.85s cubic-bezier(0.22,1,0.36,1) 0.45s forwards",
                    opacity: 0,
                    filter: `drop-shadow(0 0 18px ${LILA}) drop-shadow(0 0 36px ${LILA2}88)`,
                }}>
                {/* Aura lila bajo la imagen */}
                <div style={{
                    width: r * 2.2, height: r * 2.2,
                    marginLeft: -r * 1.1 + r, marginTop: -r * 1.1 + r,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${LILA}44 0%, ${LILA2}22 50%, transparent 70%)`,
                    position: "absolute",
                    top: "50%", left: "50%",
                    transform: "translate(-50%,-50%)",
                }} />
            </div>

            {/* Badges de afinidad */}
            <div className="absolute flex gap-1.5 justify-center pointer-events-none"
                style={{
                    left: cx, top: spriteRect.y + spriteRect.h + 30,
                    transform: "translateX(-50%)",
                    animation: "distortNameIn 0.45s cubic-bezier(0.2,0,0,1.4) 0.72s forwards",
                    opacity: 0,
                }}
            >
                {newAffinities.map((aff) => {
                    const c = AFFINITY_CONFIG[aff as Affinity];
                    if (!c) return null;
                    return (
                        <div key={aff}
                            className="flex items-center justify-center rounded-full"
                            style={{
                                width: 26, height: 26,
                                background: `${LILA}33`, border: `1.5px solid ${LILA}`,
                                boxShadow: `0 0 10px ${LILA}88`,
                            }}
                        >
                            <AffinityIcon affinity={aff} size={18} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}


// ─────────────────────────────────────────

function BattleTopBar({
    phase,
    session,
    currentActorName,
    onBack,
}: {
    phase: string;
    session: BattleSession | null;
    currentActorName?: string;
    onBack: () => void;
}) {
    const { tokens } = useTrainer();
    const tok = tokens as any;
    const pveCount = tok?.npcTokens ?? 0;
    const pveMax   = tok?.npcMax    ?? 10;
    const pvpCount = tok?.pvpTokens ?? 0;
    const pvpMax   = tok?.pvpMax    ?? 5;
    const { w: tbW } = useWindowSize();
    const tbD = tbW >= 900;

    return (
        <div
            className="flex-shrink-0 flex items-center px-3 gap-2.5 z-30"
            style={{
                height: tbD ? 46 : 30,
                background: "rgba(4,8,15,0.96)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
        >
            {/* Back / exit */}
            <button
                onClick={onBack}
                className="flex items-center justify-center flex-shrink-0 transition-all hover:scale-110 active:scale-95"
                style={{
                    width: tbD ? 36 : 22, height: tbD ? 36 : 22, borderRadius: "50%",
                    background: "rgba(239,68,68,0.15)",
                    border: "1px solid rgba(239,68,68,0.4)",
                    color: "var(--accent-red)", fontSize: tbD ? 16 : 11, fontWeight: 900,
                }}
                title={phase === "battle" ? "Exit battle" : "Back"}
            >✕</button>

            {/* Tokens */}
            <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(14,165,233,0.1)", border: "1px solid rgba(14,165,233,0.2)" }}>
                    <span className="font-mono font-bold text-sky-300" style={{ fontSize: tbD ? 14 : 9 }}>
                        {pveCount}<span style={{ opacity: 0.4 }}>/{pveMax}</span>
                    </span>
                    <span style={{ fontSize: tbD ? 15 : 10 }}>⚡</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded"
                    style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)" }}>
                    <span className="font-mono font-bold text-orange-300" style={{ fontSize: tbD ? 14 : 9 }}>
                        {pvpCount}<span style={{ opacity: 0.4 }}>/{pvpMax}</span>
                    </span>
                    <span style={{ fontSize: tbD ? 15 : 10 }}>⚔️</span>
                </div>
            </div>

            {/* Turn / phase indicator */}
            <div className="flex-1 flex items-center justify-center">
                {phase === "battle" && session ? (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <span className="font-mono text-slate-500 tracking-widest uppercase" style={{ fontSize: tbD ? 12 : 8 }}>Turn</span>
                        <span className="font-mono font-black text-white tabular-nums" style={{ fontSize: tbD ? 22 : 13 }}>{session.turn}</span>
                        {currentActorName && (
                            <>
                                <span className="text-slate-700" style={{ fontSize: tbD ? 12 : 8 }}>·</span>
                                <span className="font-mono font-bold truncate" style={{ fontSize: tbD ? 15 : 9, maxWidth: tbD ? 160 : 80, color: "#fde047" }}>
                                    {currentActorName}
                                </span>
                            </>
                        )}
                    </div>
                ) : phase === "prep" ? (
                    <span className="font-mono tracking-widest text-slate-600 uppercase" style={{ fontSize: 8 }}>
                        PvE — Select your team
                    </span>
                ) : null}
            </div>

            {/* Chat placeholder */}
            <button
                className="flex items-center justify-center flex-shrink-0 opacity-40"
                style={{
                    width: tbD ? 36 : 22, height: tbD ? 36 : 22, borderRadius: "50%",
                    background: "rgba(123,47,255,0.12)",
                    border: "1px solid rgba(123,47,255,0.25)",
                    fontSize: tbD ? 18 : 11,
                }}
                title="Chat (coming soon)"
            >💬</button>
        </div>
    );
}

