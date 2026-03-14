import React, { useState, useEffect, useRef } from "react";
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
    silenced?: number;
    rarity?: "COMMON" | "RARE" | "ELITE" | "LEGENDARY" | "MYTHIC";
    distortionTriggerTurn?: number | null; // turno en el que distorsiona (null si no tiene o ya distorsionó)
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
// HP Bar — barra gruesa con HP numérico en interior
// ─────────────────────────────────────────

function HpBar({ hp, maxHp, shield = 0 }: { hp: number; maxHp: number; shield?: number }) {
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
            borderRadius: 9, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden",
        }}>
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
    x,
    y,
    fromX,
    fromY,
    affinity,
    level,
    onDone,
}: {
    x: number;
    y: number;
    fromX: number;
    fromY: number;
    affinity: Affinity;
    level: 1 | 2 | 3;
    onDone: () => void;
}) {
    const cfg = AFFINITY_CONFIG[affinity];
    const duration = level === 1 ? 500 : level === 2 ? 800 : 1800;
    // Ángulo de impacto — dirección desde la que llega el proyectil
    const impactAngle = Math.atan2(y - fromY, x - fromX);
    const impactDeg = impactAngle * (180 / Math.PI);

    useEffect(() => {
        const t = setTimeout(onDone, duration);
        return () => clearTimeout(t);
    }, []);

    if (level === 3) {
        // ── ULTIMATE — pantalla completa espectacular ──
        const particleCount = 24;
        const shardCount = 8;
        return (
            <>
                {/* Flash blanco full-screen */}
                <div
                    className="fixed inset-0 z-[200] pointer-events-none"
                    style={{ animation: "ultimateFlash 0.5s ease-out forwards" }}
                />
                {/* Shockwave — elipse en la dirección del impacto */}
                {[0, 1, 2, 3].map((i) => (
                    <div
                        key={`sw${i}`}
                        className="fixed z-[201] pointer-events-none"
                        style={{
                            left: x,
                            top: y,
                            width: 20,
                            height: 12,
                            marginLeft: -10,
                            marginTop: -6,
                            border: `${4 - i}px solid ${cfg.glow}`,
                            boxShadow: `0 0 30px ${cfg.glow}, inset 0 0 20px ${cfg.glow}44`,
                            borderRadius: "50%",
                            transform: `rotate(${impactDeg}deg)`,
                            transformOrigin: "center",
                            animation: `ultimateShockwave 0.9s cubic-bezier(0.2,0,0.4,1) ${i * 0.12}s forwards`,
                        }}
                    />
                ))}
                {/* Flash central gigante */}
                <div
                    className="fixed z-[202] pointer-events-none rounded-full"
                    style={{
                        left: x,
                        top: y,
                        width: 300,
                        height: 300,
                        marginLeft: -150,
                        marginTop: -150,
                        background: `radial-gradient(circle, #ffffffcc 0%, ${cfg.glow}dd 25%, ${cfg.glow}88 50%, transparent 75%)`,
                        animation: `ultimateCentralBlast 0.6s ease-out forwards`,
                    }}
                />
                {/* Rayo direccional — alineado con la dirección del impacto */}
                <div
                    className="fixed z-[200] pointer-events-none"
                    style={{
                        left: x,
                        top: y,
                        width: 700,
                        height: 60,
                        marginLeft: -350,
                        marginTop: -30,
                        background: `linear-gradient(90deg, transparent 0%, ${cfg.glow}88 20%, ${cfg.glow}ff 50%, ${cfg.glow}88 80%, transparent 100%)`,
                        transform: `rotate(${impactDeg}deg)`,
                        transformOrigin: "center",
                        animation: `ultimatePillar 0.8s ease-out forwards`,
                    }}
                />
                {/* Rayo perpendicular más tenue */}
                <div
                    className="fixed z-[200] pointer-events-none"
                    style={{
                        left: x,
                        top: y,
                        width: 400,
                        height: 30,
                        marginLeft: -200,
                        marginTop: -15,
                        background: `linear-gradient(90deg, transparent 0%, ${cfg.glow}44 30%, ${cfg.glow}99 50%, ${cfg.glow}44 70%, transparent 100%)`,
                        transform: `rotate(${impactDeg + 90}deg)`,
                        transformOrigin: "center",
                        animation: `ultimatePillar 0.9s ease-out 0.05s forwards`,
                    }}
                />
                {/* Partículas en cono direccional */}
                {Array.from({ length: particleCount }).map((_, i) => {
                    const spread = Math.PI * 0.8;
                    const angle = impactAngle - spread / 2 + (i / particleCount) * spread * 1.5;
                    const dist = 60 + Math.random() * 130;
                    const tx = Math.cos(angle) * dist;
                    const ty = Math.sin(angle) * dist;
                    const size = 5 + Math.floor(Math.random() * 9);
                    return (
                        <div
                            key={`up${i}`}
                            className="fixed z-[203] pointer-events-none rounded-full"
                            style={
                                {
                                    left: x,
                                    top: y,
                                    width: size,
                                    height: size,
                                    marginLeft: -size / 2,
                                    marginTop: -size / 2,
                                    background: i % 3 === 0 ? "#ffffff" : cfg.glow,
                                    boxShadow: `0 0 ${size * 2}px ${cfg.glow}`,
                                    animation: `ultimateParticle 1.2s ease-out ${i * 0.025}s forwards`,
                                    "--tx": `${tx}px`,
                                    "--ty": `${ty}px`,
                                } as React.CSSProperties
                            }
                        />
                    );
                })}
                {/* Shards — en dirección del impacto */}
                {Array.from({ length: shardCount }).map((_, i) => {
                    const spread = Math.PI * 0.9;
                    const angle = impactAngle - spread / 2 + (i / shardCount) * spread;
                    const dist = 80 + Math.random() * 100;
                    const tx = Math.cos(angle) * dist;
                    const ty = Math.sin(angle) * dist;
                    return (
                        <div
                            key={`us${i}`}
                            className="fixed z-[203] pointer-events-none"
                            style={
                                {
                                    left: x,
                                    top: y,
                                    width: 4,
                                    height: 16 + Math.floor(Math.random() * 14),
                                    marginLeft: -2,
                                    marginTop: -8,
                                    background: `linear-gradient(180deg, #ffffff 0%, ${cfg.glow} 100%)`,
                                    boxShadow: `0 0 8px ${cfg.glow}`,
                                    borderRadius: 2,
                                    transform: `rotate(${angle * (180 / Math.PI)}deg)`,
                                    transformOrigin: "center",
                                    animation: `ultimateParticle 1s ease-out ${i * 0.04}s forwards`,
                                    "--tx": `${tx}px`,
                                    "--ty": `${ty}px`,
                                } as React.CSSProperties
                            }
                        />
                    );
                })}
                {/* Screen shake */}
                <div
                    className="fixed inset-0 z-[199] pointer-events-none"
                    style={{ animation: "ultimateScreenShake 0.8s ease-out forwards" }}
                />
                {/* Vignette flash */}
                <div
                    className="fixed inset-0 z-[198] pointer-events-none"
                    style={{
                        background: `radial-gradient(ellipse at center, transparent 30%, ${cfg.glow}44 100%)`,
                        animation: "ultimateVignette 1.5s ease-out forwards",
                    }}
                />
            </>
        );
    }

    // ── Niveles 1 y 2 ──
    const rings = level === 1 ? 1 : 3;
    const maxSize = level === 1 ? 60 : 120;
    const particleCount2 = level === 1 ? 0 : 8;

    return (
        <div
            className="fixed z-[101] pointer-events-none"
            style={{ left: x, top: y, transform: "translate(-50%,-50%)" }}
        >
            {Array.from({ length: rings }).map((_, i) => (
                <div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        border: `${level === 1 ? 2 : 3}px solid ${cfg.glow}`,
                        width: maxSize,
                        height: maxSize,
                        top: -maxSize / 2,
                        left: -maxSize / 2,
                        animation: `ringExpand ${0.35 + i * 0.12}s ease-out ${i * 0.08}s forwards`,
                        opacity: 1 - i * 0.2,
                        boxShadow: `0 0 ${8 + i * 10}px ${cfg.glow}`,
                    }}
                />
            ))}
            <div
                className="absolute rounded-full"
                style={{
                    background: `radial-gradient(circle, ${cfg.glow}ff 0%, ${cfg.glow}44 50%, transparent 100%)`,
                    width: maxSize * 0.5,
                    height: maxSize * 0.5,
                    top: -maxSize * 0.25,
                    left: -maxSize * 0.25,
                    animation: `centralFlash 0.3s ease-out forwards`,
                }}
            />
            {Array.from({ length: particleCount2 }).map((_, i) => {
                const spread = Math.PI * 1.3;
                const angle = impactAngle - spread / 2 + (i / particleCount2) * spread;
                const dist = 55;
                const tx = Math.cos(angle) * dist;
                const ty = Math.sin(angle) * dist;
                return (
                    <div
                        key={`p${i}`}
                        className="absolute rounded-full"
                        style={
                            {
                                width: 7,
                                height: 7,
                                background: cfg.glow,
                                top: -3.5,
                                left: -3.5,
                                boxShadow: `0 0 8px ${cfg.glow}`,
                                animation: `particleFly 0.65s ease-out ${i * 0.04}s forwards`,
                                "--tx": `${tx}px`,
                                "--ty": `${ty}px`,
                            } as React.CSSProperties
                        }
                    />
                );
            })}
        </div>
    );
}

// ─────────────────────────────────────────
// DistortionDots — bolitas de forma bajo la barra de HP
// ─────────────────────────────────────────

function DistortionDots({ myth, distortionTurns }: { myth: BattleMyth; distortionTurns: number | null }) {
    // Calcular cuántas formas totales tiene y en qué forma está ahora
    // distortionTurns = null → ya en la última forma (o sin más)
    // distortionTurns > 0 → quedan N turnos para la siguiente
    // Necesitamos saber cuántas formas tiene para dibujar N bolitas
    // Como el frontend no tiene acceso a creaturesData, usamos una convención:
    // el número de bolitas = formas que ha pasado (activa) + formas pendientes
    // Usamos distortionTriggerTurn para inferir: si tiene trigger = 1 forma pendiente mínimo
    // Para simplificar: siempre mostramos 2 bolitas si tiene distortionTriggerTurn, 3 si hay cadena COMMON
    // La bolita actual siempre activa, las siguientes grises
    const hasPending = distortionTurns != null && distortionTurns > 0;
    const isDistorted = distortionTurns === null; // ya distorsionó (no hay más pendientes conocidas)

    // Inferir número de dots desde la rareza del myth (COMMON → 3 formas, RARE/ELITE → 2, LEGENDARY/MYTHIC → 1+1)
    const rarity = myth.rarity ?? "COMMON";
    const totalForms = rarity === "COMMON" ? 3 : rarity === "RARE" || rarity === "ELITE" ? 2 : 2;

    // Forma actual: si tiene pending → en la primera forma. Si distortionTurns=null y rarity implica cadena larga → podría ser 2ª forma
    // Simplificación segura: si no hay pending → en la última forma conocida
    const currentForm = hasPending ? 0 : totalForms - 1;

    const dotColors: Record<string, { active: string; glow: string }> = {
        COMMON:    { active: "#c084fc", glow: "#a855f7" },
        RARE:      { active: "#818cf8", glow: "#6366f1" },
        EPIC:      { active: "#c084fc", glow: "#a855f7" },
        ELITE:     { active: "#e2e8f0", glow: "#94a3b8" },
        LEGENDARY: { active: "#fbbf24", glow: "#f59e0b" },
        MYTHIC:    { active: "#f87171", glow: "#ef4444" },
    };
    const dc = dotColors[rarity] ?? dotColors.COMMON;

    return (
        <div className="flex items-center gap-1 justify-center mt-0.5">
            {Array.from({ length: totalForms }).map((_, i) => {
                const isActive = i === currentForm;
                const isPast = i < currentForm;
                return (
                    <div
                        key={i}
                        className="rounded-full"
                        style={{
                            width: isActive ? 7 : 5,
                            height: isActive ? 7 : 5,
                            background: isActive
                                ? dc.active
                                : isPast
                                  ? dc.active + "55"
                                  : "rgba(148,163,184,0.25)",
                            boxShadow: isActive
                                ? `0 0 8px ${dc.glow}, 0 0 14px ${dc.glow}66`
                                : isPast
                                  ? `0 0 4px ${dc.glow}44`
                                  : "none",
                            border: isActive
                                ? `1px solid ${dc.glow}cc`
                                : "1px solid rgba(148,163,184,0.15)",
                            animation: isActive ? "distortionBadgePulse 1.4s ease-in-out infinite" : undefined,
                            transition: "all 0.4s ease",
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
    floatingDmg?: { value: number; crit: boolean; mult: number; heal?: boolean } | null;
    supportOverlay?: { text: string; color: string; glow: string } | null;
    koOverlay?: boolean;
    onClick?: () => void;
    spriteSize?: number;
    mythRef?: React.RefObject<HTMLDivElement | null>;
    distortionTurns?: number | null; // turnos restantes para distorsionar (null = ya distorsionó o no tiene)
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
    distortionTurns,
}: ArenaMythProps & { targetColor?: string }) {
    const cfg = flashAffinity ? AFFINITY_CONFIG[flashAffinity] : null;
    const canClick = onClick && !myth.defeated;
    const primaryAffinity = myth.affinities?.[0];
    const afCfg = primaryAffinity ? AFFINITY_CONFIG[primaryAffinity] : null;

    // Separar buffs (multiplicador > 1) de debuffs (multiplicador < 1)
    const buffs = myth.buffs?.filter((b) => b.multiplier > 1) ?? [];
    const debuffs = myth.buffs?.filter((b) => b.multiplier < 1) ?? [];

    return (
        <div
            ref={mythRef}
            className={`relative flex flex-col items-center gap-0.5 select-none ${canClick ? "cursor-pointer" : ""}`}
            onClick={canClick ? onClick : undefined}
        >
            {/* Buffs (azul) y debuffs (amarillo) — absolutos encima del sprite, no desplazan layout */}
            {!myth.defeated && (buffs.length > 0 || debuffs.length > 0) && (
                <div className="absolute flex gap-0.5 flex-wrap justify-center z-20 pointer-events-none" style={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 2 }}>
                    {buffs.map((b, i) => (
                        <span
                            key={`buff${i}`}
                            className="text-sm drop-shadow"
                            style={{ filter: "drop-shadow(0 0 4px #3b82f6)" }}
                            title={`${b.label ?? b.stat?.toUpperCase() ?? ""} ×${b.multiplier.toFixed(1)} (${b.turnsLeft}t)`}
                        >
                            {b.emoji}
                        </span>
                    ))}
                    {debuffs.map((b, i) => (
                        <span
                            key={`debuff${i}`}
                            className="text-sm drop-shadow"
                            style={{ filter: "drop-shadow(0 0 4px #facc15)" }}
                            title={`${b.label ?? b.stat?.toUpperCase() ?? ""} ×${b.multiplier.toFixed(1)} (${b.turnsLeft}t)`}
                        >
                            {b.emoji}
                        </span>
                    ))}
                </div>
            )}

            {/* Daño / curación flotante — no renderizar si es +0 */}
            {floatingDmg && (!floatingDmg.heal || floatingDmg.value > 0) && (
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
                    {/* Número de daño */}
                    <div
                        className={`absolute z-30 pointer-events-none font-black tracking-tighter
                            ${floatingDmg.heal ? "animate-float-dmg" : floatingDmg.crit ? "animate-crit-dmg" : "animate-float-dmg"}
                            ${floatingDmg.heal ? "text-emerald-400" : floatingDmg.crit ? "text-red-400" : floatingDmg.mult >= 2 ? "text-orange-400" : floatingDmg.mult <= 0.5 ? "text-blue-300" : "text-white"}`}
                        style={{
                            top: floatingDmg.crit ? -40 : -24,
                            left: "50%",
                            transform: "translateX(-50%)",
                            fontSize: floatingDmg.crit ? "3.2rem" : "1.8rem",
                            textShadow: floatingDmg.heal
                                ? "0 0 12px #4ade80, 0 2px 4px rgba(0,0,0,0.8)"
                                : floatingDmg.crit
                                  ? "0 0 24px #ff2222, 0 0 50px #ff000088, 0 2px 6px rgba(0,0,0,1)"
                                  : "0 0 10px currentColor, 0 2px 4px rgba(0,0,0,0.8)",
                            letterSpacing: "-0.02em",
                        }}
                    >
                        {floatingDmg.heal ? `+${floatingDmg.value}` : floatingDmg.value > 0 ? `-${floatingDmg.value}` : "¡Fallo!"}
                    </div>
                </>
            )}

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

            {/* KO overlay — lanzado desde lejos, aplasta al myth */}
            {koOverlay && (
                <div
                    className="absolute pointer-events-none z-50 animate-ko-overlay"
                    style={{ top: 10, left: "50%", transform: "translateX(-50%)" }}
                >
                    <span
                        className="font-black select-none block"
                        style={{
                            fontSize: "3.5rem",
                            color: "#ff1111",
                            textShadow: "0 0 40px #ff0000, 0 0 80px #ff000088, 0 0 120px #ff000044, 0 4px 12px rgba(0,0,0,1)",
                            WebkitTextStroke: "2.5px #6f0000",
                            letterSpacing: "0.06em",
                            lineHeight: 1,
                        }}
                    >
                        K.O.
                    </span>
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
                    <span className="text-4xl opacity-30">💀</span>
                ) : (
                    <MythArt
                        art={myth.art}
                        px={spriteSize}
                        className={[
                            cfg ? "animate-myth-shake" : isActing ? "animate-myth-idle" : "",
                            myth.status ? `aura-${myth.status}` : "",
                            isActing && !myth.defeated ? "active-aura-glow" : "",
                        ].filter(Boolean).join(" ")}
                    />
                )}

                {/* Estado alterado */}
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

            {/* Sombra */}
            {!myth.defeated && (
                <div className="rounded-full opacity-20 bg-black" style={{ width: spriteSize * 0.7, height: 8, marginTop: -4, filter: "blur(4px)" }} />
            )}

            {/* Info: nombre + HP */}
            <div className="flex flex-col items-center gap-0.5" style={{ width: Math.max(spriteSize, 96) }}>
                {/* Nombre con icono de afinidad */}
                <div className="flex items-center gap-1 justify-center" style={{ maxWidth: Math.max(spriteSize, 96) }}>
                    {isActing && !myth.defeated && <span className="text-yellow-400 animate-pulse" style={{ fontSize: "13px" }}>▶</span>}
                    {primaryAffinity && afCfg && (
                        <div
                            className="flex-shrink-0 flex items-center justify-center rounded-full font-black"
                            title={primaryAffinity}
                            style={{
                                width: 18, height: 18,
                                background: afCfg.color,
                                boxShadow: `0 0 6px ${afCfg.glow}bb`,
                                fontSize: "8px", color: "#fff",
                                textShadow: "0 1px 2px rgba(0,0,0,0.9)",
                                flexShrink: 0,
                            }}
                        >
                            {primaryAffinity.slice(0, 2).toUpperCase()}
                        </div>
                    )}
                    <p
                        className={`font-bold truncate font-mono
                            ${myth.defeated ? "text-slate-600" : isActing ? "text-yellow-300" : targeted ? "text-red-400" : "text-white/90"}`}
                        style={{ fontSize: "13px", maxWidth: Math.max(spriteSize - 22, 58) }}
                    >
                        {myth.name}
                    </p>
                </div>
                {!myth.defeated && (
                    <>
                        {/* Fila Lv + barra HP (HP numérico ya va dentro de la barra) */}
                        <div className="flex items-center gap-0" style={{ width: "100%" }}>
                            {/* Badge de nivel — pegado a la barra, mismo border-radius izquierdo */}
                            <div
                                className="flex-shrink-0 flex items-center justify-center font-black font-mono"
                                style={{
                                    height: 20, minWidth: 34,
                                    background: "linear-gradient(135deg, #1e3a5f 0%, #0f2340 100%)",
                                    border: "1px solid rgba(96,165,250,0.5)",
                                    borderRight: "none",
                                    borderRadius: "10px 0 0 10px",
                                    boxShadow: "0 0 6px rgba(96,165,250,0.25)",
                                    fontSize: "11px", color: "#93c5fd",
                                    letterSpacing: "0.02em", flexShrink: 0,
                                    paddingLeft: 5, paddingRight: 5,
                                }}
                            >
                                {`Lv${myth.level}`}
                            </div>
                            {/* Barra HP — radio izquierdo 0 para pegarse al badge */}
                            <div className="flex-1 relative" style={{
                                height: 20, background: "rgba(0,0,0,0.45)",
                                borderRadius: "0 10px 10px 0",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderLeft: "none",
                                overflow: "hidden",
                            }}>
                                {(() => {
                                    const pct = myth.maxHp > 0 ? Math.max(0, (myth.hp / myth.maxHp) * 100) : 0;
                                    const shield = myth.shield ?? 0;
                                    const shieldPct = myth.maxHp > 0 ? Math.min(100 - pct, (shield / myth.maxHp) * 100) : 0;
                                    const barColor = pct > 90 ? "#22c55e" : pct > 70 ? "#16a34a" : pct > 50 ? "#84cc16" : pct > 30 ? "#facc15" : pct > 15 ? "#f97316" : pct > 5 ? "#ef4444" : "#b91c1c";
                                    const glowColor = pct > 50 ? "rgba(34,197,94,0.5)" : pct > 25 ? "rgba(250,204,21,0.5)" : "rgba(239,68,68,0.6)";
                                    const textColor = "#ffffff";
                                    return (
                                        <>
                                            <div className="absolute left-0 top-0 h-full transition-all duration-700"
                                                style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 8px ${glowColor}` }} />
                                            {shieldPct > 0 && (
                                                <div className="absolute top-0 h-full"
                                                    style={{ left: `${pct}%`, width: `${shieldPct}%`, background: "#60a5fa", boxShadow: "0 0 6px rgba(96,165,250,0.5)" }} />
                                            )}
                                            <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 2 }}>
                                                <span className="font-mono font-black tabular-nums leading-none select-none"
                                                    style={{ fontSize: "11px", color: textColor, textShadow: "0 1px 4px rgba(0,0,0,1)", whiteSpace: "nowrap" }}>
                                                    {myth.hp}<span style={{ opacity: 0.75, fontWeight: 700 }}>/{myth.maxHp}</span>
                                                </span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Bolitas de forma de distorsión */}
                        {distortionTurns != null && (
                            <DistortionDots myth={myth} distortionTurns={distortionTurns} />
                        )}
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
                className={`px-12 py-3 rounded-xl border font-mono font-black text-sm tracking-widest uppercase transition-all
        ${
            canStart && !loading
                ? "bg-red/10 border-red/60 text-red hover:bg-red/20 hover:scale-105 shadow-lg shadow-red/20"
                : "bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
        }`}
            >
                {loading ? "Iniciando..." : `⚔️ Combatir (${order.length} Myth${order.length !== 1 ? "s" : ""})`}
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
                {myth.isInParty ? "equipo" : "almacén"}
            </span>
        </div>
    );
}


// ─────────────────────────────────────────
// ScreenWarning — aviso pantalla pequeña / móvil
// ─────────────────────────────────────────

function ScreenWarning({ onDismiss }: { onDismiss: () => void }) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
            style={{ background: "rgba(7,11,20,0.88)", backdropFilter: "blur(14px)" }}
        >
            <div
                className="max-w-sm w-full rounded-2xl p-8 flex flex-col items-center gap-6 text-center"
                style={{
                    background: "linear-gradient(135deg, #1e2d45 0%, #162035 100%)",
                    border: "1px solid rgba(253,224,71,0.45)",
                    boxShadow: "0 0 0 1px rgba(253,224,71,0.08), 0 0 60px rgba(253,224,71,0.18), 0 24px 64px rgba(0,0,0,0.75)",
                }}
            >
                {/* Icono */}
                <div
                    className="w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                    style={{ background: "rgba(253,224,71,0.12)", border: "2px solid rgba(253,224,71,0.35)" }}
                >
                    {isMobile ? "📱" : "🖥️"}
                </div>

                {/* Título */}
                <div className="flex flex-col gap-3">
                    <h2 className="font-mono font-black text-xl tracking-wider uppercase" style={{ color: "#fde047" }}>
                        {isMobile ? "Dispositivo no compatible" : "Ventana demasiado pequeña"}
                    </h2>
                    <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
                        {isMobile
                            ? "Mythara Online está diseñado para PC. En móvil la experiencia de combate no será la óptima."
                            : "Para jugar Mythara Online necesitas una ventana más ancha."}
                    </p>
                    {/* Instrucción concreta — solo escritorio */}
                    {!isMobile && (
                        <div
                            className="rounded-xl px-4 py-3 text-sm font-mono leading-relaxed"
                            style={{ background: "rgba(253,224,71,0.08)", border: "1px solid rgba(253,224,71,0.2)", color: "#fde047" }}
                        >
                            Maximiza la ventana del navegador<br/>
                            <span style={{ color: "#94a3b8", fontSize: "0.75rem" }}>
                                o pulsa <strong style={{ color: "#fde047" }}>F11</strong> para pantalla completa
                            </span>
                        </div>
                    )}
                </div>

                {/* Botón — solo móvil (escritorio no tiene dismiss fácil) */}
                {isMobile && (
                    <button
                        onClick={onDismiss}
                        className="w-full py-3 rounded-xl font-mono font-black text-sm tracking-widest uppercase transition-all active:scale-95"
                        style={{
                            background: "linear-gradient(135deg, #fde047 0%, #f59e0b 100%)",
                            color: "#0f172a",
                            boxShadow: "0 0 20px rgba(253,224,71,0.35), 0 4px 12px rgba(0,0,0,0.4)",
                        }}
                    >
                        Continuar de todas formas
                    </button>
                )}

                {/* Footer */}
                <p className="text-xs font-mono" style={{ color: "#475569" }}>
                    {isMobile ? "La experiencia será limitada en móvil" : "El aviso desaparece al ampliar la ventana"}
                </p>
            </div>
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

    // ── Altura real del viewport ──
    useEffect(() => {
        function setAppHeight() {
            document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
        }
        setAppHeight();
        window.addEventListener("resize", setAppHeight);
        return () => window.removeEventListener("resize", setAppHeight);
    }, []);

    // ── Inyectar keyframes de los círculos mágicos (no dependen de Tailwind) ──
    useEffect(() => {
        const id = "mythara-circle-keyframes";
        if (document.getElementById(id)) return;
        const style = document.createElement("style");
        style.id = id;
        style.textContent = `
            @keyframes circPulse { 0%,100%{opacity:0.55} 50%{opacity:1} }
            @keyframes circSpin  { from{transform:translate(-50%,-50%) scaleY(0.38) rotate(0deg)} to{transform:translate(-50%,-50%) scaleY(0.38) rotate(360deg)} }
            @keyframes distortFlash { 0%{opacity:0} 8%{opacity:1} 30%{opacity:0.85} 70%{opacity:0.7} 100%{opacity:0} }
            @keyframes distortSpriteShake { 0%{transform:translateX(0) scale(1)} 15%{transform:translateX(-6px) scale(1.05)} 30%{transform:translateX(6px) scale(1.08)} 45%{transform:translateX(-4px) scale(1.06)} 60%{transform:translateX(4px) scale(1.04)} 75%{transform:translateX(-2px) scale(1.02)} 100%{transform:translateX(0) scale(1)} }
            @keyframes distortSpriteOut { 0%{opacity:1;transform:scale(1) rotate(0deg)} 50%{opacity:0;transform:scale(1.4) rotate(-8deg)} 100%{opacity:0;transform:scale(1.6)} }
            @keyframes distortSpriteIn  { 0%{opacity:0;transform:scale(0.5) rotate(4deg)} 60%{opacity:1;transform:scale(1.15) rotate(-1deg)} 80%{transform:scale(0.97)} 100%{opacity:1;transform:scale(1) rotate(0deg)} }
            @keyframes distortNameIn    { 0%{opacity:0;transform:translateX(-50%) translateY(16px) scale(0.75)} 60%{opacity:1;transform:translateX(-50%) translateY(-5px) scale(1.08)} 100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
            @keyframes distortRingOut   { 0%{opacity:0.95;transform:scale(0.4)} 100%{opacity:0;transform:scale(3)} }
            @keyframes distortParticle  { 0%{opacity:1;transform:translate(0,0) scale(1)} 100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0)} }
            @keyframes distortGlitch    { 0%{clip-path:inset(0 0 100% 0)} 10%{clip-path:inset(20% 0 60% 0);transform:translateX(-4px)} 20%{clip-path:inset(60% 0 20% 0);transform:translateX(4px)} 30%{clip-path:inset(40% 0 40% 0);transform:translateX(-2px)} 50%{clip-path:inset(0 0 0 0);transform:translateX(0)} 100%{clip-path:inset(0 0 0 0)} }
            @keyframes distortionBadgePulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.18)} }
            @keyframes distortLegendaryBurst { 0%{opacity:0;transform:scale(0.3)} 40%{opacity:1;transform:scale(1.2)} 70%{transform:scale(0.95)} 100%{opacity:0;transform:scale(1.5)} }
            @keyframes statusProjectile { 0%{opacity:1;transform:translate(0,0) scale(1)} 100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(0.3)} }
            @keyframes statusBurn  { 0%,100%{box-shadow:0 0 8px #f97316, 0 0 16px #f9731688} 50%{box-shadow:0 0 20px #f97316, 0 0 40px #f97316aa} }
            @keyframes statusFreeze{ 0%,100%{box-shadow:0 0 8px #67e8f9, 0 0 16px #67e8f988} 50%{box-shadow:0 0 20px #67e8f9, 0 0 40px #67e8f9aa} }
        `;
        document.head.appendChild(style);
        return () => { document.getElementById(id)?.remove(); };
    }, []);

    // ── Aviso pantalla pequeña / móvil ──
    const [showScreenWarning, setShowScreenWarning] = useState(false);
    useEffect(() => {
        const MIN_W = 1024;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile || window.innerWidth < MIN_W) setShowScreenWarning(true);
        const onResize = () => { if (window.innerWidth < MIN_W) setShowScreenWarning(true); };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
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
        Record<string, { value: number; crit: boolean; mult: number; heal?: boolean }>
    >({});

    // Overlays flotantes sobre sprites
    const [supportOverlays, setSupportOverlays] = useState<Record<string, { text: string; color: string; glow: string }>>({});
    const [koOverlays, setKoOverlays] = useState<Record<string, boolean>>({});
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
        await sleep(3200);
        setDistortionOverlay(null);
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
    // Scroll al fondo del log cada vez que llega un mensaje — estilo Twitch
    useEffect(() => {
        const el = logRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [log]);
    const [result, setResult] = useState<{ status: "win" | "lose"; xp?: number; coins?: number } | null>(null);
    const { reload, trainer } = useTrainer();
    const { toast } = useToast();

    // ── Items en combate ──
    const [showItemPanel, setShowItemPanel] = useState(false);
    const [showAffinityModal, setShowAffinityModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState<{ type: string; name: string; emoji: string; desc: string } | null>(null);
    const [usingItem, setUsingItem] = useState(false);

    // Items usables en combate — solo SPARK y GRAND_SPARK
    const COMBAT_ITEMS = [
        { type: "SPARK",       name: "Spark",       emoji: "✨", desc: "Cura el estado de 1 Myth" },
        { type: "GRAND_SPARK", name: "Grand Spark", emoji: "💎", desc: "Cura todos los estados del equipo" },
    ];

    function getCombatItemCount(itemType: string): number {
        if (!trainer?.inventory) return 0;
        const entry = trainer.inventory.find((i: any) => i.type === itemType);
        return entry?.quantity ?? 0;
    }

    async function handleUseItem(targetMythId: string) {
        if (!selectedItem || !session || usingItem) return;
        const qty = getCombatItemCount(selectedItem.type);
        if (qty <= 0) { toast("No tienes ese objeto", "error"); return; }
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
                throw new Error(err.error ?? "Error al usar objeto");
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
            toast(e.message ?? "Error al usar objeto", "error");
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
            e.returnValue = "Tienes un combate en curso. Si sales, el combate contará como derrota.";
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
            // 2. Limpiar estado local completamente
            battleLockedRef.current = false;
            localStorage.removeItem("mythara_battle_active");
            setSession(null);
            setPhase("prepare");
            setSelectedMythIds([]);
            setEnemyTargetId(null);
            // 3. Navegar al destino pendiente o quedarse en /battle (pantalla preparación)
            const dest = pendingNavRef.current;
            pendingNavRef.current = null;
            if (dest && dest !== "/battle") {
                navigate(dest);
            }
            // Si no había destino o era /battle, se queda en /battle mostrando la preparación
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
    }) {
        setLog((l) => [...l.slice(-50), { text, type, ...meta }]);
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
    async function animateTurnAction(action: any, currentSession?: BattleSession) {
        const sessionForLookup = currentSession ?? sessionRef.current ?? session;
        const direction = action.isPlayerMyth ? "ltr" : "rtl";

        // ── Detectar distorsión — el backend envía "🌀 ¡X ha distorsionado!" en effectMsgs ──
        const distortMsg = action.effectMsgs?.find((m: string) => m.startsWith("🌀"));
        if (distortMsg) {
            const allFlat = [...(sessionForLookup?.playerTeam ?? []), ...(sessionForLookup?.enemyTeam ?? [])];
            const actor = allFlat.find(m => m.instanceId === action.actorInstanceId);
            if (actor) {
                addLog(`🌀 ¡${actor.name} ha distorsionado!`, "system");
                const newRarity = (actor as any).rarity ?? "RARE";
                // Para el NPC: actualizar sesión ANTES del overlay para que el sprite/nombre ya estén actualizados
                if (!action.isPlayerMyth && currentSession) {
                    setSession(currentSession);
                    const freshMap = buildDistortionMap(currentSession);
                    setDistortionTurnsMap(prev => ({ ...prev, ...freshMap }));
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
            boost_atk:  { text: "⚔️ ATK UP!",   color: "#4ade80", glow: "#22c55e" },
            boost_def:  { text: "🛡️ DEF UP!",   color: "#4ade80", glow: "#22c55e" },
            boost_spd:  { text: "💨 SPD UP!",   color: "#4ade80", glow: "#22c55e" },
            boost_acc:  { text: "🎯 ACC UP!",   color: "#4ade80", glow: "#22c55e" },
            shield:     { text: "🛡️ BARRIER!",  color: "#60a5fa", glow: "#3b82f6" },
            regen:      { text: "✨ REGEN!",     color: "#34d399", glow: "#10b981" },
            heal:       { text: "💚 HEALING",   color: "#4ade80", glow: "#22c55e" },
        };
        const DEBUFF_OVERLAYS: Record<string, { text: string; color: string; glow: string }> = {
            debuff_atk: { text: "⚔️ ATK DOWN!", color: "#f87171", glow: "#ef4444" },
            debuff_def: { text: "🛡️ DEF DOWN!", color: "#f87171", glow: "#ef4444" },
            debuff_spd: { text: "💨 SPD DOWN!", color: "#f87171", glow: "#ef4444" },
            debuff_acc: { text: "🎯 ACC DOWN!", color: "#f87171", glow: "#ef4444" },
            silence:    { text: "🔇 SILENCED",  color: "#94a3b8", glow: "#64748b" },
        };
        const STATUS_OVERLAYS: Record<string, { text: string; color: string; glow: string }> = {
            burn:     { text: "🔥 BURN",      color: "#f97316", glow: "#f97316" },
            poison:   { text: "☠️ POISON",    color: "#a855f7", glow: "#a855f7" },
            freeze:   { text: "❄️ FROZEN",    color: "#67e8f9", glow: "#67e8f9" },
            fear:     { text: "😨 FEARED",    color: "#c084fc", glow: "#a855f7" },
            paralyze: { text: "⚡ PARALYZED", color: "#fde047", glow: "#fde047" },
            stun:     { text: "💫 STUNNED",   color: "#fbbf24", glow: "#fbbf24" },
            curse:    { text: "💀 CURSED",    color: "#818cf8", glow: "#818cf8" },
        };

        if (action.blockedByStatus) {
            addLog(action.blockedByStatus, "status");
        } else {
            const logPrefix = action.isPlayerMyth ? "" : "👾 ";
            // Buscar afinidades de actor y target para badges en el log
            const allMythsFlat2 = [...(sessionForLookup?.playerTeam ?? []), ...(sessionForLookup?.enemyTeam ?? [])];
            const logActor  = allMythsFlat2.find(m => m.instanceId === action.actorInstanceId);
            const logTarget = allMythsFlat2.find(m => m.instanceId === action.targetInstanceId);
            addLog(
                `${logPrefix}${action.actorName} usa ${action.move}${action.targetName ? ` → ${action.targetName}` : ""}`,
                "normal",
                {
                    actorName:      action.actorName,
                    actorAffinity:  logActor?.affinities?.[0],
                    targetName:     action.targetName,
                    targetAffinity: logTarget?.affinities?.[0],
                }
            );
            const moveObj = (sessionForLookup?.playerTeam ?? [])
                .concat(sessionForLookup?.enemyTeam ?? [])
                .find((m) => m.instanceId === action.actorInstanceId)
                ?.moves.find((mv) => mv.name === action.move);
            const projLevel = moveObj ? getMoveLevel(moveObj) : 1;
            const isSupport = moveObj?.type === "support" || (!action.damage && !action.missed);

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
                    if (action.healAmount > 0) {
                        await flashAndFloat(action.actorInstanceId, action.moveAffinity, action.healAmount, false, 1, true);
                    }
                    const buffType = action.buffApplied?.type ?? (action.healAmount > 0 ? "heal" : null);
                    const bo = buffType ? BUFF_OVERLAYS[buffType] : null;
                    if (bo) {
                        await showSupportOverlay(action.actorInstanceId, bo.text, bo.color, bo.glow);
                    } else if (action.buffApplied?.multiplier > 1) {
                        const statKey = `boost_${action.buffApplied.stat ?? "atk"}`;
                        const so = BUFF_OVERLAYS[statKey] ?? BUFF_OVERLAYS["boost_atk"];
                        await showSupportOverlay(action.actorInstanceId, so.text, so.color, so.glow);
                    } else if (action.healAmount > 0) {
                        await showSupportOverlay(action.actorInstanceId, "💚 HEALING", "#4ade80", "#22c55e");
                    }
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
                        if (so) await showSupportOverlay(action.targetInstanceId, so.text, so.color, so.glow);
                    } else if (action.buffApplied) {
                        const debuffType = action.buffApplied.type ?? `debuff_${action.buffApplied.stat ?? "atk"}`;
                        const so = DEBUFF_OVERLAYS[debuffType] ?? DEBUFF_OVERLAYS[`debuff_${action.buffApplied.stat ?? "atk"}`];
                        if (so) await showSupportOverlay(action.targetInstanceId, so.text, so.color, so.glow);
                    }
                }
                await sleep(300);
            } else {
                // ── MOVE DE DAÑO ──
                const positions = getProjectilePositions(action.actorInstanceId, action.targetInstanceId);
                if (positions) {
                    const duration = Math.max(350, Math.min(650,
                        (Math.sqrt(Math.pow(positions.toX - positions.fromX, 2) + Math.pow(positions.toY - positions.fromY, 2)) / 800) * 1000));
                    setProjectile({ affinity: action.moveAffinity as Affinity, direction, level: projLevel, ...positions });
                    await sleep(duration);
                    setProjectile(null);
                    setExplosion({ x: positions.toX, y: positions.toY, fromX: positions.fromX, fromY: positions.fromY, affinity: action.moveAffinity as Affinity, level: projLevel });
                    await sleep(projLevel === 1 ? 200 : projLevel === 2 ? 300 : 600);
                } else {
                    setProjectile({ affinity: action.moveAffinity as Affinity, direction, level: projLevel, fromX: 0, fromY: 0, toX: 0, toY: 0 });
                    await sleep(480);
                    setProjectile(null);
                    await sleep(80);
                }

                if (action.targetInstanceId && action.damage > 0) {
                    await flashAndFloat(action.targetInstanceId, action.moveAffinity, action.damage, action.crit, action.mult);
                } else if (action.missed) {
                    addLog("¡Falló!", "miss");
                }

                // Daño infligido — siempre que haya daño real
                if (action.damage > 0 && !action.crit) {
                    addLog(`−${action.damage} dmg`, action.isPlayerMyth ? "dmg_player" : "dmg_enemy", { damage: action.damage });
                }
                if (action.mult >= 2) addLog(`⚡ ¡Súper eficaz! ×${action.mult}`, action.isPlayerMyth ? "good" : "bad");
                else if (action.mult > 0 && action.mult < 1)
                    addLog(`💤 Poco eficaz ×${action.mult}`, action.isPlayerMyth ? "bad" : "good");
                if (action.crit) addLog(
                    `💥 ¡CRÍTICO! −${action.damage} dmg`,
                    "crit",
                    { damage: action.damage, isCrit: true }
                );

                if (action.statusApplied) {
                    const icon = STATUS_ICONS[action.statusApplied] ?? "⚠️";
                    addLog(`${icon} ¡${action.targetName} afectado por ${action.statusApplied}!`, "status");
                    if (action.targetInstanceId) {
                        const so = STATUS_OVERLAYS[action.statusApplied];
                        // Proyectil de estado — viaja desde el actor al target con el color del estado
                        const statusAffinityMap: Record<string, Affinity> = {
                            burn: "EMBER", poison: "VENOM", freeze: "FROST",
                            paralyze: "VOLT", fear: "SHADE", stun: "IRON", curse: "ASTRAL",
                        };
                        const statusAff = statusAffinityMap[action.statusApplied] ?? "ASTRAL" as Affinity;
                        const sPos = getProjectilePositions(action.actorInstanceId, action.targetInstanceId);
                        if (sPos) {
                            const sDur = Math.max(300, Math.min(600,
                                (Math.sqrt(Math.pow(sPos.toX - sPos.fromX, 2) + Math.pow(sPos.toY - sPos.fromY, 2)) / 800) * 1000));
                            setProjectile({ affinity: statusAff, direction, level: 1, ...sPos });
                            await sleep(sDur);
                            setProjectile(null);
                            setExplosion({ x: sPos.toX, y: sPos.toY, fromX: sPos.fromX, fromY: sPos.fromY, affinity: statusAff, level: 1 });
                            await sleep(150);
                        }
                        if (so) showSupportOverlay(action.targetInstanceId, so.text, so.color, so.glow, 1600);
                    }
                }
                if (action.buffApplied) {
                    const label = action.buffApplied.label ?? action.buffApplied.stat?.toUpperCase() ?? "";
                    addLog(`${action.buffApplied.emoji} ${action.actorName} ${label}`, action.isPlayerMyth ? "good" : "bad");
                }
                if (action.healAmount && action.healAmount > 0) {
                    await flashAndFloat(action.actorInstanceId, action.moveAffinity, action.healAmount, false, 1, true);
                    addLog(`💚 ${action.actorName} recupera ${action.healAmount} HP`, "heal");
                }
                if (action.effectMsgs?.length) {
                    for (const msg of action.effectMsgs) addLog(msg, "status");
                }
            }
        }

        if (action.statusTickDamage && action.statusTickDamage > 0) {
            const sess = currentSession ?? sessionRef.current ?? session;
            const actorMyth = [...(sess?.playerTeam ?? []), ...(sess?.enemyTeam ?? [])]
                .find((m) => m.instanceId === action.actorInstanceId);
            if (actorMyth?.status) {
                await sleep(300);
                await flashAndFloat(action.actorInstanceId, action.moveAffinity, action.statusTickDamage, false, 1);
                addLog(action.statusTickMsg ?? `${action.actorName} sufre daño por estado`, "status");
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
        if (newSession.status === "win" || newSession.status === "lose") {            addLog(
                newSession.status === "win" ? "🏆 ¡Victoria!" : "💀 Derrota...",
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
                        effectMsgs: [res.distortionMsg ?? `🌀 ¡${res.actorName} ha distorsionado!`],
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
    function buildDistortionMap(s: BattleSession): Record<string, number> {
        const map: Record<string, number> = {};
        for (const m of [...s.playerTeam, ...s.enemyTeam]) {
            const trigger = (m as any).distortionTriggerTurn;
            if (trigger != null) map[m.instanceId] = trigger;
        }
        return map;
    }

    // Calcula remaining desde el mapa absoluto y el turno actual de sesión
    function getDistortionTurns(myth: BattleMyth): number | null {
        const triggerTurn = distortionTurnsMap[myth.instanceId];
        if (triggerTurn == null) return null;
        const currentTurn = session?.turn ?? 0;
        const remaining = triggerTurn - currentTurn;
        return remaining > 0 ? remaining : null;
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
            addLog("⚔️ ¡Comienza el combate!", "system");
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
            toast(e.message ?? "Error al iniciar combate", "error");
        } finally {
            setLoadingStart(false);
        }
    }

    const currentActor = session
        ? ([...session.playerTeam, ...session.enemyTeam].find((m) => m.instanceId === currentActorId) ?? null)
        : null;
    const targetEnemy = session?.enemyTeam.find((m) => m.instanceId === targetEnemyMythId);

    // Sprites fijos a 110px — caben las 2 filas + panel de moves sin scroll en pantallas ~728px de alto
    const spriteSize = 110;

    // Calcula los turnos restantes hasta la próxima Distorsión — delegado a la función definida junto a buildDistortionMap

    // ── Overlay de pantalla — fixed, siempre encima de todo ──
    const screenWarningOverlay = showScreenWarning
        ? <ScreenWarning onDismiss={() => setShowScreenWarning(false)} />
        : null;

    if (mode === "pvp") {
        return (
            <>
                {screenWarningOverlay}
                <Layout sidebar={<TrainerSidebar />}>
                <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
                    <TabBar mode={mode} onSwitch={setMode} battleActive={false} />
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
            </>
        );
    }

    // ── Arena + Prep integrada ──
    const battleLocked = phase === "battle";

    return (
        <>
            {screenWarningOverlay}

            {/* ── Modal confirmación salida del combate ── */}
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
                                ¿Abandonar combate?
                            </h2>
                            <p className="text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
                                Si sales ahora, el combate contará como <span style={{ color: "#f87171", fontWeight: 700 }}>derrota</span>.
                            </p>
                        </div>
                        <div className="flex flex-col gap-2.5">
                            <button
                                onClick={() => handleForfeit(true)}
                                className="w-full py-3 rounded-xl font-mono font-black text-sm tracking-widest uppercase transition-all hover:scale-[1.02] active:scale-[0.98]"
                                style={{
                                    background: "linear-gradient(135deg, rgba(239,68,68,0.20) 0%, rgba(185,28,28,0.25) 100%)",
                                    border: "1.5px solid rgba(239,68,68,0.55)",
                                    color: "#f87171",
                                    boxShadow: "0 0 20px rgba(239,68,68,0.15)",
                                }}>
                                Salir y perder combate
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
                                ⚔️ Seguir luchando
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <Layout sidebar={
                <div className="relative h-full">
                    <TrainerSidebar />
                    {/* Overlay que bloquea clics en el sidebar durante combate activo.
                        El click interceptor y popstate capturan cualquier navigate() (incluido logout). */}
                    {battleLocked && (
                        <div
                            className="absolute inset-0 z-[200]"
                            style={{ cursor: "not-allowed", background: "rgba(4,8,16,0.50)" }}
                            onClick={(e) => { e.stopPropagation(); setShowExitConfirm(true); }}
                            title="Tienes un combate en curso"
                        />
                    )}
                </div>
            }>
                <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: 0 }}>
                    <TabBar mode={mode} onSwitch={setMode} battleActive={phase === "battle"} />

                    <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
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
                                                ELIGE TU EQUIPO
                                            </p>
                                            <p className="font-mono text-xs text-white/5 tracking-widest mt-1">
                                                selecciona myths abajo · pulsa COMBAT para empezar
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {turnOverlay && (
                                    <div className="absolute inset-0 flex items-center justify-center z-[300] pointer-events-none">
                                        <div
                                            className="animate-turn-overlay text-center"
                                            style={{
                                                background: "linear-gradient(135deg, rgba(7,11,20,0.94) 0%, rgba(25,40,65,0.96) 100%)",
                                                border: "1.5px solid rgba(253,224,71,0.55)",
                                                borderRadius: 24,
                                                padding: "20px 56px 18px",
                                                boxShadow: [
                                                    "0 0 0 1px rgba(253,224,71,0.08)",
                                                    "0 0 40px rgba(253,224,71,0.22)",
                                                    "0 0 100px rgba(253,224,71,0.08)",
                                                    "0 16px 60px rgba(0,0,0,0.75)",
                                                    "inset 0 1px 0 rgba(255,255,255,0.06)",
                                                ].join(", "),
                                            }}
                                        >
                                            {/* Número de turno pequeño arriba */}
                                            <div className="flex items-center justify-center gap-2 mb-2">
                                                <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, transparent, rgba(253,224,71,0.3))" }} />
                                                <span className="font-mono text-[10px] text-yellow-400/50 tracking-[0.25em] uppercase">
                                                    Turno {session?.turn ?? ""}
                                                </span>
                                                <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(253,224,71,0.3), transparent)" }} />
                                            </div>
                                            {/* Label */}
                                            <p className="font-mono text-[11px] text-yellow-400/60 tracking-[0.2em] uppercase mb-1.5">
                                                Tu turno
                                            </p>
                                            {/* Nombre del myth */}
                                            <p
                                                className="font-black tracking-wide uppercase"
                                                style={{
                                                    fontFamily: "'Rajdhani', sans-serif",
                                                    fontSize: "2rem",
                                                    color: "#fde047",
                                                    textShadow: "0 0 20px rgba(253,224,71,0.85), 0 0 45px rgba(253,224,71,0.40), 0 2px 8px rgba(0,0,0,0.9)",
                                                    letterSpacing: "0.06em",
                                                    lineHeight: 1.1,
                                                }}
                                            >
                                                ⚔️ {turnOverlay}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {phase === "result" && result && (
                                    <div
                                        className="absolute inset-0 z-50 pointer-events-auto flex items-center justify-center"
                                        style={{ background: "rgba(4,8,16,0.75)", backdropFilter: "blur(2px)" }}
                                    >
                                        <div
                                            className={`text-center pointer-events-auto ${result.status === "win" ? "animate-victory-in" : "animate-defeat-in"} animate-result-glow`}
                                            style={
                                                {
                                                    padding: "32px 48px",
                                                    borderRadius: 24,
                                                    border:
                                                        result.status === "win"
                                                            ? "2px solid rgba(253,214,10,0.7)"
                                                            : "2px solid rgba(230,57,70,0.7)",
                                                    background:
                                                        result.status === "win"
                                                            ? "linear-gradient(135deg, rgba(7,11,20,0.95) 0%, rgba(40,30,5,0.97) 100%)"
                                                            : "linear-gradient(135deg, rgba(7,11,20,0.95) 0%, rgba(40,5,10,0.97) 100%)",
                                                    "--glow":
                                                        result.status === "win"
                                                            ? "rgba(253,214,10,0.4)"
                                                            : "rgba(230,57,70,0.4)",
                                                    "--glow2":
                                                        result.status === "win"
                                                            ? "rgba(253,214,10,0.15)"
                                                            : "rgba(230,57,70,0.15)",
                                                } as React.CSSProperties
                                            }
                                        >
                                            <p className="font-mono text-6xl mb-3">
                                                {result.status === "win" ? "🏆" : "💀"}
                                            </p>
                                            <h2
                                                className="font-mono font-black tracking-widest uppercase mb-4"
                                                style={{
                                                    fontSize: "3rem",
                                                    color: result.status === "win" ? "#ffd60a" : "#e63946",
                                                    textShadow:
                                                        result.status === "win"
                                                            ? "0 0 30px rgba(253,214,10,0.9), 0 0 60px rgba(253,214,10,0.5)"
                                                            : "0 0 30px rgba(230,57,70,0.9), 0 0 60px rgba(230,57,70,0.5)",
                                                }}
                                            >
                                                {result.status === "win" ? "¡VICTORIA!" : "DERROTA..."}
                                            </h2>
                                            {result.status === "win" && (
                                                <div className="flex gap-4 justify-center mb-6">
                                                    {result.xp && (
                                                        <div className="px-4 py-2 rounded-lg border border-blue-500/40 bg-blue-500/10">
                                                            <p className="font-mono font-black text-xl text-blue-300">
                                                                +{result.xp}
                                                            </p>
                                                            <p className="text-slate-500 text-xs font-mono">XP</p>
                                                        </div>
                                                    )}
                                                    {result.coins && (
                                                        <div className="px-4 py-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10">
                                                            <p className="font-mono font-black text-xl text-yellow-300">
                                                                +{result.coins}
                                                            </p>
                                                            <p className="text-slate-500 text-xs font-mono">Monedas</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
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
                                                    className="px-6 py-2.5 rounded-xl bg-red-700 text-white font-mono font-black text-sm tracking-widest uppercase hover:bg-red-600 transition-all"
                                                >
                                                    ⚔️ Revancha
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
                                )}
                                {/* Divisor central sutil */}
                                <div className="absolute top-8 bottom-8 pointer-events-none" style={{ left:"50%", width:1, background:"linear-gradient(180deg,transparent 0%,rgba(255,255,255,0.05) 50%,transparent 100%)" }}/>

                                {/* ── Círculos mágicos + sombras de suelo ──
                                    Posiciones: top/left en % del campo → sprite siempre centrado
                                    Tamaño crece de atrás (pequeño) a delante (grande) = perspectiva
                                    scaleY(0.38) en el círculo y sombra → ilusión de plano horizontal */}
                                {[
                                    // [left%, top%, size%, side] — calibrados con el calibrador visual
                                    ["21.9%","37.5%","13%","player"],  // P slot 0 — fondo
                                    ["29.9%","55%",  "19%","player"],  // P slot 1 — centro avanzado
                                    ["16.3%","72.5%","24%","player"],  // P slot 2 — delante
                                    ["78%",  "37.2%","13%","enemy"],   // E slot 0 — fondo
                                    ["69.4%","55%",  "19%","enemy"],   // E slot 1 — centro avanzado
                                    ["83.6%","73%",  "24%","enemy"],   // E slot 2 — delante
                                ].map(([l, t, sz, side], ci) => {
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

                                {/* ── Enemigos (derecha) — posiciones según círculos del mapa ── */}
                                {/* idx=0: fondo-der; idx=1: centro avanzado; idx=2: delante-der */}
                                {(phase === "prep" ? [null, null, null] : (session?.enemyTeam ?? [null,null,null])).map((myth: any, idx: number) => {
                                    // left/top calibrados manualmente con el calibrador visual
                                    const leftPcts = ["78%", "69.4%", "83.6%"];
                                    const topPcts  = ["37.2%", "55%", "73%"];
                                    const isPrepSlot = phase === "prep" || !myth;
                                    const revealed = myth && (idx < enemyRevealIndex);
                                    return (
                                        <div
                                            key={myth ? myth.instanceId : `eslot-${idx}`}
                                            className="absolute z-10"
                                            style={{ left: leftPcts[idx], top: topPcts[idx], transform: "translate(-50%,-50%)", opacity: isPrepSlot ? 0.2 : (revealed ? 1 : 0), animation: (!isPrepSlot && revealed) ? `enemyLand 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards` : undefined }}
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
                                                    spriteSize={spriteSize}
                                                    distortionTurns={getDistortionTurns(myth)}
                                                    onClick={() => { if (!myth.defeated && !animating && currentActorIsPlayer) setTargetEnemyMythId(myth.instanceId); }}
                                                />
                                            )}
                                        </div>
                                    );
                                })}

                                {/* ── Indicador central de turno — bonito ── */}
                                {phase === "battle" && session && (
                                    <div className="absolute left-1/2 z-20 pointer-events-none"
                                        style={{ top: "10px", transform: "translateX(-50%)" }}>
                                        <div className="flex flex-col items-center gap-1.5">
                                            {/* Badge número de turno */}
                                            <div className="flex items-center gap-2.5 rounded-full px-5 py-1.5"
                                                style={{
                                                    background: "linear-gradient(135deg, rgba(7,11,20,0.92) 0%, rgba(20,30,50,0.95) 100%)",
                                                    border: "1px solid rgba(255,255,255,0.15)",
                                                    boxShadow: "0 0 20px rgba(0,0,0,0.6), 0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
                                                    backdropFilter: "blur(12px)",
                                                }}>
                                                <div style={{ width: 22, height: 1, background: "linear-gradient(90deg, transparent, rgba(148,163,184,0.4))" }} />
                                                <span className="font-mono text-slate-400 tracking-[0.22em] uppercase" style={{ fontSize: "11px" }}>Turno</span>
                                                <span className="font-mono font-black text-white tabular-nums"
                                                    style={{ fontSize: "1.25rem", textShadow: "0 0 14px rgba(255,255,255,0.35)", letterSpacing: "-0.01em" }}>
                                                    {session.turn}
                                                </span>
                                                <div style={{ width: 22, height: 1, background: "linear-gradient(90deg, rgba(148,163,184,0.4), transparent)" }} />
                                            </div>
                                            {/* Sub-línea — quién actúa */}
                                            {!animating && (
                                                <div className="flex items-center gap-2 px-4 py-1 rounded-full"
                                                    style={{
                                                        background: currentActorIsPlayer
                                                            ? "rgba(234,179,8,0.12)"
                                                            : "rgba(239,68,68,0.12)",
                                                        border: currentActorIsPlayer
                                                            ? "1px solid rgba(234,179,8,0.30)"
                                                            : "1px solid rgba(239,68,68,0.25)",
                                                    }}>
                                                    <span style={{ fontSize: "11px" }}>{currentActorIsPlayer ? "⚔️" : "👾"}</span>
                                                    <span className="font-mono font-black"
                                                        style={{
                                                            fontSize: "12px",
                                                            color: currentActorIsPlayer ? "rgba(253,224,71,0.95)" : "rgba(248,113,113,0.9)",
                                                            textShadow: currentActorIsPlayer ? "0 0 10px rgba(253,224,71,0.45)" : "0 0 10px rgba(248,113,113,0.35)",
                                                            letterSpacing: "0.04em",
                                                        }}>
                                                        {currentActorIsPlayer
                                                            ? (targetEnemy ? `${currentActor?.name ?? ""} → 🎯 ${targetEnemy.name}` : `${currentActor?.name ?? ""} — elige objetivo`)
                                                            : `${currentActor?.name ?? "Rival"} atacando...`}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ── Jugador (izquierda) — posiciones según círculos del mapa ── */}
                                {/* idx=0: arriba-izq; idx=1: medio más al centro; idx=2: abajo-izq */}
                                {[0, 1, 2].map((i) => {
                                    // Posiciones alineadas con los círculos mágicos DOM:
                                    // left/top calibrados manualmente con el calibrador visual
                                    const leftPcts = ["21.9%", "29.9%", "16.3%"];
                                    const topPcts  = ["33%", "55%", "72.5%"];
                                    const myth = phase === "prep" ? prepSlots[i] : session?.playerTeam[i];

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
                                            className="absolute z-10"
                                            style={{ left: leftPcts[i], top: topPcts[i], transform: "translate(-50%,-50%)" }}
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
                                                            <span className="text-[9px] text-red-400/50 font-mono">✕ quitar</span>
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
                                                    spriteSize={spriteSize}
                                                    distortionTurns={getDistortionTurns(myth)}
                                                    onClick={selectedItem && !myth.defeated ? () => handleUseItem(myth.instanceId) : undefined}
                                                />
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* ── Panel inferior — selector (prep) o moves (batalla) ── */}
                            <div
                                className="flex-shrink-0 border-t border-slate-800 bg-[#070b14]"
                                style={{ height: "200px", overflow: "hidden", flexShrink: 0 }}
                            >
                                {phase === "prep" ? (
                                    // ── Selector de myths ──
                                    <div className="flex h-full">
                                        {/* Lista scrollable */}
                                        <div className="flex-1 flex flex-col min-w-0">
                                            {/* Buscador */}
                                            <div className="flex items-center gap-2 px-3 pt-2 pb-1.5 border-b border-slate-800 flex-shrink-0">
                                                <span className="text-slate-500 text-xs">🔍</span>
                                                <input
                                                    type="text"
                                                    value={prepSearch}
                                                    onChange={(e) => setPrepSearch(e.target.value)}
                                                    placeholder="Buscar myth..."
                                                    className="flex-1 bg-transparent text-xs font-mono text-white placeholder-slate-600 outline-none"
                                                />
                                                <span className="text-slate-600 text-[10px] font-mono">
                                                    {prepSlots.filter(Boolean).length}/3
                                                </span>
                                            </div>
                                            {/* Cards */}
                                            <div className="flex-1 overflow-x-auto overflow-y-hidden">
                                                <div className="flex gap-2 px-3 py-2 h-full items-center" style={{ width: "max-content" }}>
                                                    {allMyths
                                                        .filter((m) => {
                                                            const inSlot = prepSlots.some(
                                                                (s) => s && (s.id ?? s.instanceId) === (m.id ?? m.instanceId),
                                                            );
                                                            const matchSearch =
                                                                !prepSearch ||
                                                                m.name.toLowerCase().includes(prepSearch.toLowerCase());
                                                            return !inSlot && matchSearch;
                                                        })
                                                        .map((myth) => {
                                                            const canAdd = prepSlots.some((s) => !s);
                                                            return (
                                                                <div
                                                                    key={myth.id ?? myth.instanceId}
                                                                    draggable={canAdd}
                                                                    onDragStart={(e) => {
                                                                        e.dataTransfer.setData("mythId", myth.id ?? myth.instanceId);
                                                                        e.dataTransfer.setData("fromSlot", "");
                                                                    }}
                                                                    onClick={() => {
                                                                        if (!canAdd) return;
                                                                        const ns = [...prepSlots];
                                                                        const idx = ns.findIndex((s) => !s);
                                                                        if (idx !== -1) { ns[idx] = myth; setPrepSlots(ns); }
                                                                    }}
                                                                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all select-none flex-shrink-0
                                                                        ${canAdd ? "border-slate-700 bg-slate-800/60 hover:border-blue-500/60 hover:bg-blue-500/10 cursor-pointer hover:scale-105" : "border-slate-800 bg-slate-900/40 opacity-40 cursor-not-allowed"}`}
                                                                    style={{ width: 72 }}
                                                                >
                                                                    <MythArt art={myth.art} px={40} />
                                                                    <p className="font-mono text-[10px] text-white font-bold truncate w-full text-center">{myth.name}</p>
                                                                    <p className="text-slate-500 text-[10px] font-mono">Nv.{myth.level}</p>
                                                                    {myth.isInParty && <span className="text-[9px] text-blue-400 font-mono">equipo</span>}
                                                                </div>
                                                            );
                                                        })}
                                                    {allMyths.filter((m) => {
                                                        const inSlot = prepSlots.some(
                                                            (s) => s && (s.id ?? s.instanceId) === (m.id ?? m.instanceId),
                                                        );
                                                        return !inSlot && (!prepSearch || m.name.toLowerCase().includes(prepSearch.toLowerCase()));
                                                    }).length === 0 && (
                                                        <p className="text-slate-600 text-xs font-mono italic px-4">
                                                            {prepSearch ? "Sin resultados" : "Todos en posición"}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        {/* Botón combatir */}
                                        <div className="flex-shrink-0 flex items-center justify-center px-4 border-l border-slate-800">
                                            <button
                                                onClick={() => {
                                                    const order = prepSlots
                                                        .filter(Boolean)
                                                        .map((m) => m.id ?? m.instanceId);
                                                    if (order.length >= 1 && !loadingStart) handleStart(order);
                                                }}
                                                disabled={prepSlots.every((s) => !s) || loadingStart}
                                                className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl border font-mono font-black text-sm tracking-widest uppercase transition-all
                                                    ${prepSlots.some(Boolean) && !loadingStart
                                                        ? "bg-red-900/30 border-red-500/60 text-red-400 hover:bg-red-900/50 hover:scale-105 shadow-lg shadow-red-900/30"
                                                        : "bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-40"
                                                    }`}
                                            >
                                                <span className="text-2xl">{loadingStart ? "⏳" : "⚔️"}</span>
                                                <span>{loadingStart ? "..." : "COMBAT"}</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    // ── Moves de batalla ──
                                    (() => {
                                        const actorForMoves =
                                            currentActorIsPlayer && currentActor && !currentActor.defeated
                                                ? currentActor
                                                : currentActorIsPlayer
                                                  ? (session?.playerTeam.find((m) => !m.defeated) ?? null)
                                                  : (() => {
                                                      // Turno NPC — mostrar el último myth del jugador que actuó (o el primero vivo)
                                                      const last = lastPlayerActorId
                                                          ? [...(session?.playerTeam ?? [])].find(m => m.instanceId === lastPlayerActorId && !m.defeated)
                                                          : null;
                                                      return last ?? (session?.playerTeam.find(m => !m.defeated) ?? null);
                                                  })();

                                        const rarityClass = (r?: string) => {
                                            switch(r) {
                                                case "COMMON":    return "rarity-common";
                                                case "RARE":      return "rarity-rare";
                                                case "ELITE":     return "rarity-elite";
                                                case "LEGENDARY": return "rarity-legendary";
                                                case "MYTHIC":    return "rarity-mythic";
                                                default:          return "rarity-common";
                                            }
                                        };

                                        return actorForMoves ? (
                                            <div className="flex h-full">
                                                {/* ── Stats del myth activo (22%) — portrait de fondo ── */}
                                                <div className={`flex-shrink-0 border-r flex flex-col justify-between overflow-hidden relative ${rarityClass(actorForMoves.rarity)}`}
                                                    style={{ width: "22%", minWidth: 0, borderRightColor: "rgba(30,41,59,1)" }}>

                                                    {/* Portrait como fondo difuminado */}
                                                    {actorForMoves.art?.portrait && (
                                                        <div className="absolute inset-0 pointer-events-none z-0"
                                                            style={{
                                                                backgroundImage: `url(${actorForMoves.art.portrait})`,
                                                                backgroundSize: "cover",
                                                                backgroundPosition: "center center",
                                                                backgroundRepeat: "no-repeat",
                                                                imageRendering: "pixelated",
                                                                opacity: 0.45,
                                                                filter: "saturate(1.15)",
                                                            }} />
                                                    )}
                                                    {/* Gradiente oscuro sobre la imagen */}
                                                    <div className="absolute inset-0 pointer-events-none z-[1]"
                                                        style={{ background: "linear-gradient(180deg, rgba(7,11,20,0.40) 0%, rgba(7,11,20,0.62) 60%, rgba(7,11,20,0.80) 100%)" }} />

                                                    {/* Gradient de HP — color de la caja cambia según vida actual */}
                                                    {(() => {
                                                        const hpR = actorForMoves.maxHp > 0
                                                            ? Math.max(0, Math.min(1, actorForMoves.hp / actorForMoves.maxHp))
                                                            : 0;
                                                        const hpPctPanel = Math.round(hpR * 100);
                                                        // El color activo varía según HP:
                                                        // >50% → verde | 25-50% → naranja | <25% → rojo
                                                        // El gradient siempre cubre solo el % de vida (de izquierda a derecha)
                                                        // El color del gradient mismo cambia según HP — así al 100% todo es verde,
                                                        // al 50% lo que queda es naranja, al 20% rojo.
                                                        const hpGrad = hpR > 0.50
                                                            ? `linear-gradient(90deg, rgba(16,120,55,0.28) 0%, rgba(74,222,128,0.22) 100%)`
                                                            : hpR > 0.25
                                                            ? `linear-gradient(90deg, rgba(146,64,14,0.30) 0%, rgba(251,191,36,0.22) 100%)`
                                                            : `linear-gradient(90deg, rgba(127,29,29,0.35) 0%, rgba(248,113,113,0.22) 100%)`;
                                                        return (
                                                            <div
                                                                className="absolute pointer-events-none z-[2]"
                                                                style={{
                                                                    top: 0, left: 0, bottom: 0,
                                                                    width: `${hpPctPanel}%`,
                                                                    background: hpGrad,
                                                                    transition: "width 0.5s ease, background 0.5s ease",
                                                                    borderRadius: "inherit",
                                                                }}
                                                            />
                                                        );
                                                    })()}

                                                    {/* Contenido sobre el fondo */}
                                                    <div className="relative z-[3] flex flex-col h-full px-3 py-2 gap-1">

                                                        {/* Fila única: nombre · nivel · tipo · ❤️% */}
                                                        {(() => {
                                                            const hpR2 = actorForMoves.maxHp > 0 ? Math.max(0, Math.min(1, actorForMoves.hp / actorForMoves.maxHp)) : 0;
                                                            const hpPct2 = Math.round(hpR2 * 100);
                                                            const hpClr2 = hpR2 > 0.5 ? "#4ade80" : hpR2 > 0.25 ? "#fbbf24" : "#f87171";
                                                            const af = actorForMoves.affinities?.[0];
                                                            const afCfg2 = af ? AFFINITY_CONFIG[af] : null;
                                                            return (
                                                                <div className="flex items-center gap-1.5 w-full" style={{ minWidth: 0 }}>
                                                                    {/* Nombre — crece pero no empuja el corazón */}
                                                                    <span className="font-black leading-none truncate flex-shrink min-w-0"
                                                                        style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "1.05rem", color: "#f0f8ff", letterSpacing: "0.01em", textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
                                                                        {actorForMoves.name}
                                                                    </span>
                                                                    {/* Nivel */}
                                                                    <div className="flex items-center justify-center font-black font-mono rounded-md px-1 flex-shrink-0"
                                                                        style={{
                                                                            height: 16, minWidth: 28,
                                                                            background: "linear-gradient(135deg, #1e3a5f 0%, #0f2340 100%)",
                                                                            border: "1px solid rgba(96,165,250,0.6)",
                                                                            fontSize: "10px", color: "#93c5fd", letterSpacing: "0.01em",
                                                                        }}>
                                                                        Lv{actorForMoves.level}
                                                                    </div>
                                                                    {/* Tipo */}
                                                                    {afCfg2 && (
                                                                        <div className="flex items-center gap-0.5 rounded-full px-1.5 flex-shrink-0"
                                                                            style={{
                                                                                height: 16,
                                                                                background: `${afCfg2.glow}28`,
                                                                                border: `1px solid ${afCfg2.glow}80`,
                                                                            }}>
                                                                            <span style={{ fontSize: "10px", lineHeight: 1 }}>{afCfg2.emoji}</span>
                                                                            <span className="font-mono font-black" style={{ fontSize: "9px", color: afCfg2.glow, letterSpacing: "0.04em" }}>
                                                                                {afCfg2.label.toUpperCase()}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {/* Spacer */}
                                                                    <div className="flex-1" />
                                                                    {/* ❤️ HP% — derecha, más grande */}
                                                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                                                        <span style={{ fontSize: "16px", filter: `drop-shadow(0 0 6px ${hpClr2}bb)`, lineHeight: 1 }}>❤️</span>
                                                                        <span className="font-mono font-black tabular-nums"
                                                                            style={{ fontSize: "17px", color: hpClr2, textShadow: `0 0 12px ${hpClr2}88`, lineHeight: 1 }}>
                                                                            {hpPct2}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}

                                                        {/* Separador */}
                                                        <div className="h-px bg-slate-700/60 my-0.5" />

                                                        {/* Stats: ATK/DEF/SPD/ACC + CRIT%/CRIT.DMG */}
                                                        <div className="flex flex-col gap-[3px] flex-1">
                                                            {(() => {
                                                                // Helper: calcula el valor real de un stat aplicando buffs con cap ±50%
                                                                function calcStat(baseVal: number, buffKey: string) {
                                                                    const safe = (typeof baseVal === "number" && isFinite(baseVal)) ? baseVal : 0;
                                                                    const raw = (actorForMoves.buffs ?? [])
                                                                        .filter((b: Buff) => b.stat === buffKey)
                                                                        .reduce((acc: number, b: Buff) => acc * b.multiplier, 1);
                                                                    const mult = Math.max(0.5, Math.min(1.5, raw));
                                                                    const realVal = Math.round(safe * mult);
                                                                    const pct = mult !== 1 ? Math.round((mult - 1) * 100) : 0;
                                                                    return { baseVal: safe, realVal, pct, buffed: pct > 0, nerfed: pct < 0 };
                                                                }

                                                                // Fórmula CRIT.DMG escalable:
                                                                // Base: ×1.5 (150). Cada punto sobre 150 añade 0.5% más de multiplicador.
                                                                // Ej: 150 → ×1.50 | 200 → ×1.75 | 300 → ×2.25 | 400 → ×2.75
                                                                // Cap suave: a partir de 300 el rendimiento decrece (raíz cuadrada del exceso)
                                                                function calcCritMult(critDmg: number) {
                                                                    const base = 150;
                                                                    if (critDmg <= base) return 1.5;
                                                                    const excess = critDmg - base;
                                                                    const scaled = excess <= 150
                                                                        ? excess * 0.005           // tramo lineal: 150–300
                                                                        : 0.75 + Math.sqrt(excess - 150) * 0.025; // tramo logarítmico: >300
                                                                    return Math.round((1.5 + scaled) * 100) / 100;
                                                                }

                                                                const atk = calcStat(actorForMoves.attack,  "atk");
                                                                const def = calcStat(actorForMoves.defense, "def");
                                                                const spd = calcStat(actorForMoves.speed,   "spd");
                                                                const acc = calcStat(actorForMoves.accuracy ?? 100, "acc");

                                                                // CRIT% y CRIT.DMG no tienen buffs de stat por ahora — se muestran como base
                                                                const critChance = actorForMoves.critChance ?? 15;
                                                                const critDmgRaw = actorForMoves.critDamage ?? 150;
                                                                const critMult   = calcCritMult(critDmgRaw);

                                                                // CRIT% y CRIT.DMG también pasan por calcStat para soportar buffs futuros
                                                                const critChanceStat = calcStat(critChance, "crit_chance");
                                                                const critDmgStat    = calcStat(critDmgRaw, "crit_dmg");

                                                                const rows: { icon: string; label: string; baseVal: number; realVal: number; pct: number; buffed: boolean; nerfed: boolean; suffix: string }[] = [
                                                                    { icon: "⚔️",  label: "ATK",      ...atk,          suffix: ""  },
                                                                    { icon: "🛡️",  label: "DEF",      ...def,          suffix: ""  },
                                                                    { icon: "💨",  label: "SPD",      ...spd,          suffix: ""  },
                                                                    { icon: "🎯",  label: "ACC",      ...acc,          suffix: "%" },
                                                                    { icon: "💥",  label: "%CRIT",    ...critChanceStat, suffix: "%" },
                                                                    { icon: "🔥",  label: "CRIT DMG", ...critDmgStat,   suffix: "%" },
                                                                ];

                                                                return rows.map(({ icon, label, baseVal, realVal, pct, buffed, nerfed, suffix }) => {
                                                                    const isModified = pct !== 0;
                                                                    const valColor = realVal > baseVal ? "#4ade80" : realVal < baseVal ? "#f87171" : "#ffffff";
                                                                    const valGlow  = realVal > baseVal ? "0 0 8px rgba(74,222,128,0.55)" : realVal < baseVal ? "0 0 8px rgba(248,113,113,0.55)" : "none";
                                                                    // Fuente uniforme para los 3 valores: base, delta, final
                                                                    const sf = { fontFamily: "'Exo 2', monospace", fontWeight: 900, fontSize: "12px" } as React.CSSProperties;
                                                                    return (
                                                                        <div key={label}
                                                                            style={{
                                                                                display: "grid",
                                                                                gridTemplateColumns: "15px 60px 1fr auto",
                                                                                alignItems: "center",
                                                                                columnGap: "6px",
                                                                                minWidth: 0,
                                                                            }}>
                                                                            <span style={{ fontSize: "12px", lineHeight: 1, textAlign: "center" }}>{icon}</span>
                                                                            <span style={{ ...sf, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                                {label}
                                                                            </span>
                                                                            <div className="flex items-center gap-1 justify-end">
                                                                                {isModified && (
                                                                                    <>
                                                                                        <span style={{ ...sf, color: "#ffffff" }}>
                                                                                            {baseVal}{suffix}
                                                                                        </span>
                                                                                        <span style={{ ...sf, color: "#facc15", textShadow: "0 0 6px rgba(250,204,21,0.5)" }}>
                                                                                            {pct > 0 ? `+${pct}%` : `${pct}%`}
                                                                                        </span>
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                            <span style={{ ...sf, color: valColor, textShadow: valGlow, textAlign: "right" }}>
                                                                                {realVal}{suffix}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>


                                                    </div>
                                                </div>

                                                {/* ── Moves (75%) ── */}
                                                <div className="flex-1 p-2 min-w-0 flex flex-col relative">
                                                    {/* Overlay de espera durante turno NPC */}
                                                    {!currentActorIsPlayer && animating && (
                                                        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-r-xl pointer-events-none"
                                                            style={{ background: "rgba(7,11,20,0.72)", backdropFilter: "blur(2px)" }}>
                                                            <div className="flex flex-col items-center gap-2">
                                                                <div className="flex gap-1.5">
                                                                    {[0,1,2].map(i => (
                                                                        <div key={i} className="rounded-full"
                                                                            style={{
                                                                                width: 7, height: 7,
                                                                                background: "#818cf8",
                                                                                boxShadow: "0 0 8px #818cf888",
                                                                                animation: `activeAuraParticle 0.8s ease-in-out ${i * 0.22}s infinite`,
                                                                            }} />
                                                                    ))}
                                                                </div>
                                                                <span className="font-mono text-[10px] text-slate-500 tracking-widest uppercase">Rival atacando</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {/* Header: título + botones OBJETOS + TABLA TIPOS */}
                                                    <div className="flex items-center justify-between mb-1.5 px-1 gap-1">
                                                        <p className="font-mono text-xs text-yellow-400 font-bold truncate flex-1">
                                                            Movimientos de {actorForMoves.name}
                                                        </p>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            {/* Botón OBJETOS */}
                                                            <button
                                                                onClick={() => { setShowItemPanel((v) => !v); setSelectedItem(null); setShowAffinityModal(false); }}
                                                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border font-mono font-black transition-all whitespace-nowrap
                                                                    ${showItemPanel
                                                                        ? "bg-amber-500/25 border-amber-400/70 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.2)]"
                                                                        : "bg-slate-800/70 border-slate-700 text-slate-400 hover:border-amber-600/60 hover:text-amber-400 hover:bg-amber-900/20"
                                                                    }`}
                                                                style={{ fontSize: "10px", letterSpacing: "0.06em" }}
                                                            >
                                                                🎒 <span>OBJETOS</span>
                                                            </button>
                                                            {/* Botón TABLA DE TIPOS */}
                                                            <button
                                                                onClick={() => { setShowAffinityModal((v) => !v); setShowItemPanel(false); setSelectedItem(null); }}
                                                                className={`flex items-center gap-1 px-2 py-1 rounded-lg border font-mono font-black transition-all whitespace-nowrap
                                                                    ${showAffinityModal
                                                                        ? "bg-indigo-500/25 border-indigo-400/70 text-indigo-300 shadow-[0_0_10px_rgba(129,140,248,0.2)]"
                                                                        : "bg-slate-800/70 border-slate-700 text-slate-400 hover:border-indigo-600/60 hover:text-indigo-400 hover:bg-indigo-900/20"
                                                                    }`}
                                                                style={{ fontSize: "10px", letterSpacing: "0.06em" }}
                                                            >
                                                                📊 <span>TIPOS</span>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* ── Panel de items (overlay dentro del panel de moves) ── */}
                                                    {showItemPanel && (
                                                        <div className="absolute inset-0 z-20 rounded-xl flex flex-col"
                                                            style={{
                                                                background: "rgba(7,11,20,0.97)",
                                                                border: "1px solid rgba(251,191,36,0.3)",
                                                                boxShadow: "0 0 30px rgba(251,191,36,0.1)",
                                                                backdropFilter: "blur(8px)",
                                                                top: 0, left: 0, right: 0, bottom: 0,
                                                            }}>
                                                            {/* Header items */}
                                                            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 flex-shrink-0">
                                                                <p className="font-mono text-xs text-amber-400 font-bold uppercase tracking-widest">
                                                                    🎒 Objetos de combate
                                                                </p>
                                                                <button onClick={() => { setShowItemPanel(false); setSelectedItem(null); }}
                                                                    className="text-slate-500 hover:text-white text-sm font-mono transition-colors">✕</button>
                                                            </div>

                                                            {/* Lista de items */}
                                                            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5 min-h-0">
                                                                {COMBAT_ITEMS.map((item) => {
                                                                    const qty = getCombatItemCount(item.type);
                                                                    const isSelected = selectedItem?.type === item.type;
                                                                    return (
                                                                        <button
                                                                            key={item.type}
                                                                            disabled={qty <= 0 || animating || usingItem}
                                                                            onClick={() => setSelectedItem(isSelected ? null : item)}
                                                                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all
                                                                                ${qty <= 0 || animating || usingItem
                                                                                    ? "opacity-30 cursor-not-allowed bg-slate-900/40 border-slate-800"
                                                                                    : isSelected
                                                                                        ? "bg-amber-500/20 border-amber-400/70 shadow-[0_0_12px_rgba(251,191,36,0.2)]"
                                                                                        : "bg-slate-900/60 border-slate-700 hover:border-slate-500 hover:bg-slate-800/60"
                                                                                }`}
                                                                        >
                                                                            <span className="text-xl flex-shrink-0">{item.emoji}</span>
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <p className="font-mono text-xs font-bold text-white truncate">{item.name}</p>
                                                                                    <span className={`font-mono text-[10px] font-black px-1.5 rounded-full
                                                                                        ${qty > 0 ? "bg-emerald-900/60 text-emerald-400 border border-emerald-700/50" : "bg-slate-900 text-slate-600"}`}>
                                                                                        ×{qty}
                                                                                    </span>
                                                                                </div>
                                                                                <p className="font-mono text-[10px] text-slate-400 truncate">{item.desc}</p>
                                                                            </div>
                                                                            {isSelected && <span className="text-amber-400 text-sm flex-shrink-0">▶</span>}
                                                                        </button>
                                                                    );
                                                                })}
                                                                {COMBAT_ITEMS.every((i) => getCombatItemCount(i.type) === 0) && (
                                                                    <p className="text-slate-600 text-xs font-mono text-center mt-4 italic">
                                                                        No tienes objetos de combate
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Instrucciones de uso */}
                                                            {selectedItem && (
                                                                <div className="flex-shrink-0 px-3 py-2 border-t border-amber-900/40 bg-amber-900/10">
                                                                    <p className="font-mono text-[10px] text-amber-300 text-center leading-relaxed">
                                                                        {selectedItem.type === "GRAND_SPARK"
                                                                            ? <>✨ Selecciona cualquier Myth tuyo para aplicar al equipo</>
                                                                            : <>👆 Toca uno de tus Myths para curarle el estado</>
                                                                        }
                                                                    </p>
                                                                    {/* Targets clickables — tu equipo */}
                                                                    <div className="flex gap-2 mt-1.5 justify-center">
                                                                        {session?.playerTeam.filter((m) => !m.defeated).map((m) => (
                                                                            <button
                                                                                key={m.instanceId}
                                                                                onClick={() => handleUseItem(m.instanceId)}
                                                                                disabled={usingItem}
                                                                                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl border border-amber-500/50 bg-amber-900/20 hover:bg-amber-800/30 hover:border-amber-400 transition-all"
                                                                            >
                                                                                {m.art?.portrait ? (
                                                                                    <img src={m.art.portrait} alt={m.name}
                                                                                        className="rounded-lg object-cover"
                                                                                        style={{ width: 32, height: 32, imageRendering: "pixelated" }} />
                                                                                ) : (
                                                                                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 text-xs">?</div>
                                                                                )}
                                                                                <span className="font-mono text-[9px] text-amber-300 font-bold truncate max-w-[48px]">{m.name}</span>
                                                                                {m.status && (
                                                                                    <span className="text-[10px]">{STATUS_ICONS[m.status]}</span>
                                                                                )}
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {/* ── Tabla de Tipos — modal fixed centrado ── */}
                                                    {showAffinityModal && (
                                                        <div
                                                            className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
                                                            onClick={() => setShowAffinityModal(false)}
                                                        >
                                                            <div
                                                                className="relative rounded-2xl overflow-hidden max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                                                                style={{
                                                                    background: "rgba(7,11,20,0.97)",
                                                                    border: "1px solid rgba(129,140,248,0.4)",
                                                                    boxShadow: "0 0 60px rgba(129,140,248,0.15), 0 20px 60px rgba(0,0,0,0.8)",
                                                                    backdropFilter: "blur(12px)",
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                {/* Header */}
                                                                <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 sticky top-0 bg-[#070b14]/95 backdrop-blur-sm z-10">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xl">📊</span>
                                                                        <p className="font-black text-indigo-300 uppercase tracking-widest" style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "1.4rem" }}>
                                                                            Tabla de Tipos
                                                                        </p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => setShowAffinityModal(false)}
                                                                        className="text-slate-500 hover:text-white text-lg font-mono transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800"
                                                                    >✕</button>
                                                                </div>
                                                                {/* Tabla */}
                                                                <div className="p-4 overflow-x-auto">
                                                                    {(() => {
                                                                        const affinities: Affinity[] = ["EMBER","TIDE","GROVE","VOLT","STONE","FROST","VENOM","ASTRAL","IRON","SHADE"];
                                                                        // Ventajas: [atacante][defensor] → multiplicador
                                                                        const matchups: Record<string, Record<string, number>> = {
                                                                            EMBER:  { GROVE: 2, FROST: 2, IRON: 0.5, TIDE: 0.5, EMBER: 0.5 },
                                                                            TIDE:   { EMBER: 2, STONE: 2, GROVE: 0.5, VOLT: 0.5, FROST: 0.5 },
                                                                            GROVE:  { TIDE: 2, STONE: 2, EMBER: 0.5, VENOM: 0.5, FROST: 0.5 },
                                                                            VOLT:   { TIDE: 2, IRON: 2, GROVE: 0.5, STONE: 0.5, VOLT: 0.5 },
                                                                            STONE:  { EMBER: 2, VOLT: 2, TIDE: 0.5, GROVE: 0.5, STONE: 0.5 },
                                                                            FROST:  { GROVE: 2, VENOM: 2, EMBER: 0.5, TIDE: 0.5, FROST: 0.5 },
                                                                            VENOM:  { GROVE: 2, ASTRAL: 2, FROST: 0.5, IRON: 0.5, VENOM: 0.5 },
                                                                            ASTRAL: { SHADE: 2, VENOM: 2, IRON: 0.5, ASTRAL: 0.5 },
                                                                            IRON:   { FROST: 2, ASTRAL: 2, EMBER: 0.5, VOLT: 0.5, IRON: 0.5 },
                                                                            SHADE:  { ASTRAL: 2, IRON: 2, SHADE: 0.5, EMBER: 0.5 },
                                                                        };
                                                                        return (
                                                                            <table className="w-full border-collapse" style={{ minWidth: 640 }}>
                                                                                <thead>
                                                                                    <tr>
                                                                                        <th className="p-1 text-left">
                                                                                            <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider">ATK ↓ DEF →</span>
                                                                                        </th>
                                                                                        {affinities.map((af) => {
                                                                                            const c = AFFINITY_CONFIG[af];
                                                                                            return (
                                                                                                <th key={af} className="p-1 text-center" style={{ minWidth: 50 }}>
                                                                                                    <div className="flex flex-col items-center gap-0.5">
                                                                                                        <span style={{ fontSize: 20 }}>{c.emoji}</span>
                                                                                                        <span className="font-mono font-black" style={{ fontSize: "11px", color: c.glow }}>{c.label.slice(0,4).toUpperCase()}</span>
                                                                                                    </div>
                                                                                                </th>
                                                                                            );
                                                                                        })}
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {affinities.map((atk) => {
                                                                                        const atkCfg = AFFINITY_CONFIG[atk];
                                                                                        return (
                                                                                            <tr key={atk} className="border-t border-slate-800/60 hover:bg-slate-800/20 transition-colors">
                                                                                                <td className="p-1.5 pr-3">
                                                                                                    <div className="flex items-center gap-1.5">
                                                                                                        <span style={{ fontSize: 20 }}>{atkCfg.emoji}</span>
                                                                                                        <span className="font-mono font-bold" style={{ fontSize: "13px", color: atkCfg.glow }}>{atkCfg.label}</span>
                                                                                                    </div>
                                                                                                </td>
                                                                                                {affinities.map((def) => {
                                                                                                    const mult = matchups[atk]?.[def] ?? 1;
                                                                                                    const bg = mult === 2 ? "rgba(34,197,94,0.15)" : mult === 0.5 ? "rgba(239,68,68,0.12)" : "transparent";
                                                                                                    const border = mult === 2 ? "rgba(34,197,94,0.3)" : mult === 0.5 ? "rgba(239,68,68,0.25)" : "transparent";
                                                                                                    const txt = mult === 2 ? "#4ade80" : mult === 0.5 ? "#f87171" : "#334155";
                                                                                                    const label = mult === 2 ? "2×" : mult === 0.5 ? "½" : "—";
                                                                                                    return (
                                                                                                        <td key={def} className="p-1 text-center">
                                                                                                            <div className="inline-flex items-center justify-center rounded font-mono font-black"
                                                                                                                style={{
                                                                                                                    width: 36, height: 30,
                                                                                                                    background: bg,
                                                                                                                    border: `1px solid ${border}`,
                                                                                                                    fontSize: mult === 1 ? "13px" : "15px",
                                                                                                                    color: txt,
                                                                                                                }}>
                                                                                                                {label}
                                                                                                            </div>
                                                                                                        </td>
                                                                                                    );
                                                                                                })}
                                                                                            </tr>
                                                                                        );
                                                                                    })}
                                                                                </tbody>
                                                                            </table>
                                                                        );
                                                                    })()}
                                                                </div>
                                                                {/* Leyenda */}
                                                                <div className="px-5 pb-4 flex items-center gap-4">
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-5 h-4 rounded" style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)" }} />
                                                                        <span className="font-mono text-[12px] text-emerald-400 font-bold">2× — Muy eficaz</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-5 h-4 rounded" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }} />
                                                                        <span className="font-mono text-[12px] text-red-400 font-bold">½ — Poco eficaz</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <div className="w-5 h-4 rounded" style={{ background: "transparent", border: "1px solid #334155" }} />
                                                                        <span className="font-mono text-[12px] text-slate-500 font-bold">— Normal</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-2 gap-1.5">
                                                        {actorForMoves.moves.map((move) => {
                                                            const cfg = AFFINITY_CONFIG[move.affinity];
                                                            const onCooldown = !!(actorForMoves.cooldownsLeft?.[move.id] > 0);
                                                            const cdLeft = actorForMoves.cooldownsLeft?.[move.id] ?? 0;
                                                            const ok =
                                                                !animating &&
                                                                !!targetEnemy &&
                                                                !targetEnemy.defeated &&
                                                                !onCooldown;
                                                            return (
                                                                <button
                                                                    key={move.id}
                                                                    onClick={() => ok && handleMove(move.id)}
                                                                    disabled={!ok}
                                                                    className={`flex items-start gap-1.5 px-2 py-1.5 rounded-xl border text-left transition-all
                                                                        ${ok
                                                                            ? `${cfg.bg} ${cfg.color} border-white/10 hover:border-white/30 hover:scale-[1.02] active:scale-[0.98]`
                                                                            : "bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                                                                        }`}
                                                                >
                                                                    <span className="text-lg mt-0.5">{cfg.emoji}</span>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                                            <p className="font-mono text-xs font-bold">{move.name}</p>
                                                                            {onCooldown && (
                                                                                <span className="text-xs text-red-400 font-mono font-black">
                                                                                    ⏳{cdLeft}t
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-[10px] opacity-70 font-mono mb-0.5">
                                                                            {move.power > 0 ? `💥 ${move.power}` : "estado"} · 🎯{" "}
                                                                            {move.accuracy}%
                                                                            {move.cooldown > 0 && ` · CD${move.cooldown}`}
                                                                        </p>
                                                                        <p className="text-[11px] leading-snug line-clamp-2" style={{ color: "rgba(255,255,255,0.82)" }}>
                                                                            {move.description}
                                                                        </p>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            // ── Turno NPC: panel frozen del último myth jugador ──
                                            (() => {
                                                const frozenMyth = session
                                                    ? (session.playerTeam.find((m) => m.instanceId === lastPlayerActorId && !m.defeated)
                                                        ?? session.playerTeam.find((m) => !m.defeated)
                                                        ?? null)
                                                    : null;
                                                if (!frozenMyth) return (
                                                    <div className="flex items-center justify-center h-full">
                                                        <p className="text-slate-500 text-xs font-mono animate-pulse">Procesando...</p>
                                                    </div>
                                                );
                                                const fAf = frozenMyth.affinities?.[0];
                                                const fAfCfg = fAf ? AFFINITY_CONFIG[fAf] : null;
                                                const fBuffMult = (stat: string) => {
                                                    const key = stat === "attack" ? "atk" : stat === "defense" ? "def" : "spd";
                                                    const raw = (frozenMyth.buffs ?? []).filter((b: Buff) => b.stat === key).reduce((acc: number, b: Buff) => acc * b.multiplier, 1);
                                                    return Math.max(0.5, Math.min(1.5, raw));
                                                };
                                                return (
                                                    <div className="flex h-full" style={{ opacity: 0.55, pointerEvents: "none" }}>
                                                        {/* Stats frozen */}
                                                        <div className={`flex-shrink-0 border-r flex flex-col justify-between overflow-hidden relative ${rarityClass(frozenMyth.rarity)}`}
                                                            style={{ width: "22%", minWidth: 0, borderRightColor: "rgba(30,41,59,1)", filter: "saturate(0.45) brightness(0.8)" }}>
                                                            {frozenMyth.art?.portrait && (
                                                                <div className="absolute inset-0 pointer-events-none z-0"
                                                                    style={{ backgroundImage: `url(${frozenMyth.art.portrait})`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.35 }} />
                                                            )}
                                                            <div className="absolute inset-0 pointer-events-none z-[1]"
                                                                style={{ background: "linear-gradient(180deg, rgba(7,11,20,0.55) 0%, rgba(7,11,20,0.72) 60%, rgba(7,11,20,0.88) 100%)" }} />
                                                            <div className="relative z-[2] flex flex-col h-full px-3 py-2 gap-1">
                                                                <p className="font-black leading-none truncate"
                                                                    style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "1.25rem", color: "#64748b", letterSpacing: "0.01em" }}>
                                                                    {frozenMyth.name}
                                                                </p>
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <div className="flex items-center justify-center font-black font-mono rounded-md px-1.5"
                                                                        style={{ height: 18, background: "rgba(15,23,40,0.8)", border: "1px solid rgba(51,65,85,0.5)", fontSize: "11px", color: "#475569" }}>
                                                                        Lv{frozenMyth.level}
                                                                    </div>
                                                                    {fAfCfg && (
                                                                        <div className="flex items-center gap-1 rounded-full px-2"
                                                                            style={{ height: 18, background: `${fAfCfg.glow}12`, border: `1px solid ${fAfCfg.glow}30` }}>
                                                                            <span style={{ fontSize: "11px" }}>{fAfCfg.emoji}</span>
                                                                            <span className="font-mono font-black" style={{ fontSize: "9px", color: "#475569" }}>{fAfCfg.label.toUpperCase()}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="h-px bg-slate-800/60 my-0.5" />
                                                                <div className="flex flex-col gap-[3px] flex-1">
                                                                    {(() => {
                                                                        function calcFrozenStat(baseVal: number, buffKey: string) {
                                                                            const raw = (frozenMyth.buffs ?? [])
                                                                                .filter((b: Buff) => b.stat === buffKey)
                                                                                .reduce((acc: number, b: Buff) => acc * b.multiplier, 1);
                                                                            const mult = Math.max(0.5, Math.min(1.5, raw));
                                                                            return { baseVal, realVal: Math.round(baseVal * mult), pct: mult !== 1 ? Math.round((mult - 1) * 100) : 0 };
                                                                        }
                                                                        function calcFrozenCritMult(cd: number) {
                                                                            if (cd <= 150) return 1.5;
                                                                            const ex = cd - 150;
                                                                            return Math.round((1.5 + (ex <= 150 ? ex * 0.005 : 0.75 + Math.sqrt(ex - 150) * 0.025)) * 100) / 100;
                                                                        }
                                                                        const rows = [
                                                                            { icon: "⚔️",  label: "ATK",      ...calcFrozenStat(frozenMyth.attack,             "atk") },
                                                                            { icon: "🛡️",  label: "DEF",      ...calcFrozenStat(frozenMyth.defense,            "def") },
                                                                            { icon: "💨",  label: "SPD",      ...calcFrozenStat(frozenMyth.speed,              "spd") },
                                                                            { icon: "🎯",  label: "ACC",      ...calcFrozenStat(frozenMyth.accuracy ?? 100,    "acc"), suffix: "%" },
                                                                            { icon: "💥",  label: "CRIT%",    baseVal: frozenMyth.critChance ?? 15, realVal: frozenMyth.critChance ?? 15, pct: 0, suffix: "%" },
                                                                            { icon: "🔥",  label: "CRIT.DMG", baseVal: frozenMyth.critDamage ?? 150, realVal: frozenMyth.critDamage ?? 150, pct: 0, display: `×${calcFrozenCritMult(frozenMyth.critDamage ?? 150)}` },
                                                                        ] as any[];
                                                                        return rows.map(({ icon, label, baseVal, realVal, pct, suffix, display }: any) => {
                                                                            const buffed = pct > 0, nerfed = pct < 0;
                                                                            const showDisplay = display ?? (realVal + (suffix ?? ""));
                                                                            return (
                                                                                <div key={label} className="flex items-baseline gap-1" style={{ opacity: 0.6 }}>
                                                                                    <span className="text-[10px] flex-shrink-0 leading-none">{icon}</span>
                                                                                    <span className="font-mono text-[9px] text-slate-600 flex-shrink-0 uppercase tracking-wider" style={{ width: 36 }}>{label}</span>
                                                                                    {pct !== 0 ? (
                                                                                        <>
                                                                                            <span className="font-mono text-[9px] text-slate-600">{baseVal + (suffix ?? "")}</span>
                                                                                            <span className="font-mono text-[8px] font-black text-yellow-600">{pct > 0 ? `+${pct}%` : `${pct}%`}</span>
                                                                                            <span className={`font-mono text-[12px] font-black ${buffed ? "text-emerald-700" : "text-red-800"}`}>{showDisplay}</span>
                                                                                        </>
                                                                                    ) : (
                                                                                        <span className="font-mono text-[12px] font-black text-slate-500">{showDisplay}</span>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </div>
                                                                <div className="mt-auto pt-1">
                                                                    <div className="flex items-center justify-between mb-1">
                                                                        <span className="font-mono text-[10px] text-slate-600">HP</span>
                                                                        <span className="font-mono text-[10px] text-slate-500">{frozenMyth.hp}/{frozenMyth.maxHp}</span>
                                                                    </div>
                                                                    <HpBar hp={frozenMyth.hp} maxHp={frozenMyth.maxHp} shield={frozenMyth.shield} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Moves frozen */}
                                                        <div className="flex-1 flex flex-col justify-between overflow-hidden"
                                                            style={{ background: "rgba(7,11,20,0.3)" }}>
                                                            <div className="px-3 pt-2 pb-1 border-b border-slate-800/60 flex-shrink-0">
                                                                <span className="font-mono text-[10px] text-slate-600 uppercase tracking-widest">Movimientos de {frozenMyth.name}</span>
                                                            </div>
                                                            <div className="flex-1 overflow-hidden p-2">
                                                                <div className="grid grid-cols-2 gap-1.5">
                                                                    {frozenMyth.moves.map((move) => {
                                                                        const cfg = AFFINITY_CONFIG[move.affinity];
                                                                        return (
                                                                            <div key={move.id}
                                                                                className="flex items-start gap-1.5 px-2 py-1.5 rounded-xl border bg-slate-900/30 border-slate-800/60 opacity-40">
                                                                                <span className="text-lg mt-0.5">{cfg.emoji}</span>
                                                                                <div className="min-w-0 flex-1">
                                                                                    <p className="font-mono text-xs font-bold text-slate-600">{move.name}</p>
                                                                                    <p className="text-[10px] text-slate-700 font-mono">{move.power > 0 ? `💥 ${move.power}` : "estado"} · 🎯 {move.accuracy}%</p>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })()
                                        );
                                    })()
                                )}
                            </div>
                        </div>

                        {/* ── Log panel ── */}
                        <div
                            className="w-64 flex-shrink-0 border-l border-slate-800 flex flex-col overflow-hidden"
                            style={{ minHeight: 0 }}
                        >
                            <div className="px-3 py-2.5 border-b border-slate-800 bg-slate-900/60 flex-shrink-0">
                                <p className="font-mono text-xs text-yellow-400 uppercase tracking-widest font-bold">
                                    📜 Registro
                                </p>
                            </div>
                            <div
                                ref={logRef}
                                className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5"
                                style={{ scrollbarWidth: "thin", scrollbarColor: "#334155 transparent" }}
                            >
                                {log.length === 0 && (
                                    <p className="text-slate-700 text-xs font-mono italic text-center mt-6">
                                        Esperando acción...
                                    </p>
                                )}
                                {log.map((entry, i) => {
                                    // Colores base por tipo
                                    const typeColor: Record<string, string> = {
                                        good:       "#4ade80",
                                        bad:        "#f87171",
                                        crit:       "#ff4444",
                                        miss:       "#64748b",
                                        system:     "#818cf8",
                                        status:     "#fb923c",
                                        heal:       "#34d399",
                                        dmg_player: "#e2e8f0",
                                        dmg_enemy:  "#e2e8f0",
                                        normal:     "#cbd5e1",
                                    };
                                    const color = typeColor[entry.type] ?? "#e2e8f0";
                                    const isCritLine   = entry.type === "crit";
                                    const isDmgLine    = entry.type === "dmg_player" || entry.type === "dmg_enemy";
                                    const isMainAction = entry.type === "normal" && !!entry.actorName;

                                    // Badge de afinidad inline
                                    function AfBadge({ affinity, name }: { affinity?: string; name?: string }) {
                                        const upper = name?.toUpperCase();
                                        if (!affinity || !name) return <span className="font-black">{upper}</span>;
                                        const cfg = AFFINITY_CONFIG[affinity as keyof typeof AFFINITY_CONFIG];
                                        if (!cfg) return <span className="font-black">{upper}</span>;
                                        return (
                                            <span
                                                className="inline-flex items-center font-black rounded px-1.5 uppercase"
                                                style={{
                                                    background: cfg.color + "2a",
                                                    border: `1px solid ${cfg.color}55`,
                                                    color: cfg.glow,
                                                    fontSize: "11px",
                                                    lineHeight: "16px",
                                                    verticalAlign: "middle",
                                                    whiteSpace: "nowrap",
                                                    letterSpacing: "0.05em",
                                                    textShadow: `0 0 6px ${cfg.glow}66`,
                                                }}
                                            >
                                                {upper}
                                            </span>
                                        );
                                    }

                                    return (
                                        <div key={i} className="animate-log-in flex items-start gap-1">
                                            <span className="text-slate-700 font-mono text-[10px] mt-[2px] flex-shrink-0">›</span>

                                            {/* Línea principal de acción: actor usa move → target */}
                                            {isMainAction ? (
                                                <p className="font-mono text-[11px] leading-relaxed break-words" style={{ color }}>
                                                    {entry.text.startsWith("👾 ") && <span className="opacity-70">👾 </span>}
                                                    <AfBadge affinity={entry.actorAffinity} name={entry.actorName} />
                                                    {" usa "}
                                                    <span className="font-bold text-white/90">
                                                        {entry.text.replace(/^👾 /, "").replace(`${entry.actorName} usa `, "").replace(` → ${entry.targetName}`, "")}
                                                    </span>
                                                    {entry.targetName && (
                                                        <>
                                                            {" → "}
                                                            <AfBadge affinity={entry.targetAffinity} name={entry.targetName} />
                                                        </>
                                                    )}
                                                </p>
                                            ) : isCritLine ? (
                                                /* Línea de crítico — rojo brillante, negrita grande */
                                                <p className="font-mono text-xs leading-relaxed font-black" style={{ color: "#ff3333", textShadow: "0 0 8px #ff000066" }}>
                                                    {entry.text.replace(`−${entry.damage} dmg`, "")}
                                                    {entry.damage != null && entry.damage > 0 && (
                                                        <span className="font-black" style={{ color: "#ff6666" }}>
                                                            {" "}−<span style={{ fontSize: "0.95em" }}>{entry.damage}</span>
                                                            <span className="text-[9px] opacity-70"> dmg</span>
                                                        </span>
                                                    )}
                                                </p>
                                            ) : isDmgLine ? (
                                                /* Línea de daño normal — discreta pero legible */
                                                <p className="font-mono text-xs leading-relaxed" style={{ color: entry.type === "dmg_player" ? "#94a3b8" : "#94a3b8" }}>
                                                    <span className="font-black text-white/70">−{entry.damage}</span>
                                                    <span className="text-[9px] text-slate-500"> dmg</span>
                                                </p>
                                            ) : (
                                                /* Resto de líneas */
                                                <p className="font-mono text-[11px] leading-relaxed break-words" style={{ color, fontWeight: isCritLine ? 900 : 400 }}>
                                                    {entry.text}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </Layout>
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
        </>
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
    const r = spriteRect.w / 2;
    const primaryAff = newAffinities[0] as Affinity | undefined;
    const cfg = primaryAff ? AFFINITY_CONFIG[primaryAff] : AFFINITY_CONFIG["ASTRAL"];

    type RarityFx = {
        particleCount: number; rings: number; ringColor: string;
        particleColor: string; nameColor: string; glowLayers: string;
        nameBorder: string; particleSize: number; duration: string;
        lightBeam: boolean; glitch: boolean; legendaryBurst: boolean; screenTint: string | null;
    };
    const rarityFx: Record<string, RarityFx> = {
        RARE:      { particleCount: 10, rings: 2, ringColor: "#818cf8", particleColor: "#c4b5fd", nameColor: "#e0e7ff", glowLayers: "0 0 20px #818cf8, 0 0 45px #818cf855",      nameBorder: "1px #818cf8",  particleSize: 4, duration: "2s",   lightBeam: false, glitch: false, legendaryBurst: false, screenTint: null },
        EPIC:      { particleCount: 16, rings: 3, ringColor: "#a855f7", particleColor: "#c084fc", nameColor: "#f3e8ff", glowLayers: "0 0 30px #a855f7, 0 0 65px #a855f788, 0 0 100px #a855f744", nameBorder: "1.5px #c084fc", particleSize: 5, duration: "2.2s", lightBeam: true,  glitch: false, legendaryBurst: false, screenTint: "#a855f711" },
        ELITE:     { particleCount: 18, rings: 3, ringColor: "#e2e8f0", particleColor: "#f1f5f9", nameColor: "#ffffff", glowLayers: "0 0 35px #e2e8f0, 0 0 70px #94a3b8aa, 0 0 120px #e2e8f033", nameBorder: "1.5px #e2e8f0", particleSize: 5, duration: "2.4s", lightBeam: true,  glitch: false, legendaryBurst: false, screenTint: "#e2e8f00a" },
        LEGENDARY: { particleCount: 22, rings: 5, ringColor: "#fbbf24", particleColor: "#fde68a", nameColor: "#fef3c7", glowLayers: "0 0 40px #fbbf24, 0 0 90px #f59e0baa, 0 0 140px #fbbf2444", nameBorder: "2px #fbbf24",  particleSize: 7, duration: "2.6s", lightBeam: true,  glitch: false, legendaryBurst: true,  screenTint: "#fbbf2418" },
        MYTHIC:    { particleCount: 28, rings: 6, ringColor: "#ef4444", particleColor: "#fca5a5", nameColor: "#fee2e2", glowLayers: "0 0 50px #ef4444, 0 0 110px #dc2626aa, 0 0 180px #ef444433", nameBorder: "2px #ef4444",  particleSize: 8, duration: "2.8s", lightBeam: true,  glitch: true,  legendaryBurst: true,  screenTint: "#ef444422" },
    };
    const fx = rarityFx[newRarity] ?? rarityFx["RARE"];

    const particles = Array.from({ length: fx.particleCount }, (_, i) => {
        const angle = (i / fx.particleCount) * Math.PI * 2;
        const dist = r * 1.4 + (i % 4) * 14;
        return { tx: Math.cos(angle) * dist, ty: Math.sin(angle) * dist, delay: 0.08 + i * 0.035 };
    });

    // Estrellas tipo "shard" adicionales para LEGENDARY/MYTHIC
    const shards = (fx.legendaryBurst ? Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2 + 0.2;
        const dist = r * 2.2;
        return { tx: Math.cos(angle) * dist, ty: Math.sin(angle) * dist, delay: 0.15 + i * 0.06 };
    }) : []);

    return (
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 310 }}>

            {/* Tinte de pantalla suave por rareza */}
            {fx.screenTint && (
                <div className="absolute inset-0"
                    style={{ background: fx.screenTint, animation: "distortFlash 2.4s ease-out forwards" }} />
            )}

            {/* Columna de luz vertical desde el sprite (EPIC+) */}
            {fx.lightBeam && (
                <div className="absolute pointer-events-none"
                    style={{
                        left: cx - 18,
                        top: 0,
                        width: 36,
                        height: "100%",
                        background: `linear-gradient(180deg, transparent 0%, ${fx.ringColor}00 30%, ${fx.ringColor}55 48%, ${fx.ringColor}88 52%, ${fx.ringColor}55 56%, ${fx.ringColor}00 75%, transparent 100%)`,
                        animation: "distortFlash 1.8s ease-out 0.1s forwards",
                        opacity: 0,
                        filter: `blur(6px)`,
                    }}
                />
            )}

            {/* Glow radial centrado en el sprite */}
            <div className="absolute rounded-full pointer-events-none"
                style={{
                    left: cx, top: cy,
                    width: r * 6, height: r * 6,
                    marginLeft: -(r * 3), marginTop: -(r * 3),
                    background: `radial-gradient(circle, ${fx.ringColor}44 0%, ${fx.ringColor}22 40%, transparent 70%)`,
                    animation: "distortFlash 2s ease-out forwards",
                }}
            />

            {/* Anillos expansivos */}
            {Array.from({ length: fx.rings }).map((_, i) => (
                <div key={i} className="absolute rounded-full"
                    style={{
                        left: cx, top: cy,
                        width: r * 1.2, height: r * 1.2,
                        marginLeft: -(r * 0.6), marginTop: -(r * 0.6),
                        border: `${Math.max(1, Math.ceil((fx.rings - i) * 0.7))}px solid ${fx.ringColor}`,
                        boxShadow: `0 0 ${12 + i * 8}px ${fx.ringColor}88, 0 0 ${24 + i * 12}px ${fx.ringColor}44`,
                        animation: `distortRingOut ${0.55 + i * 0.13}s ease-out ${0.04 + i * 0.1}s forwards`,
                        opacity: 0,
                    }}
                />
            ))}

            {/* Partículas radiales */}
            {particles.map((p, i) => (
                <div key={i} className="absolute rounded-full"
                    style={{
                        left: cx, top: cy,
                        width: fx.particleSize, height: fx.particleSize,
                        marginLeft: -fx.particleSize / 2, marginTop: -fx.particleSize / 2,
                        background: i % 3 === 0 ? "#ffffff" : i % 3 === 1 ? fx.particleColor : fx.ringColor,
                        boxShadow: `0 0 ${fx.particleSize * 2}px ${fx.ringColor}`,
                        animation: `distortParticle 1.1s ease-out ${p.delay}s forwards`,
                        opacity: 0,
                        ["--tx" as any]: `${p.tx}px`,
                        ["--ty" as any]: `${p.ty}px`,
                    } as React.CSSProperties}
                />
            ))}

            {/* Shards largos para LEGENDARY/MYTHIC */}
            {shards.map((s, i) => (
                <div key={`sh${i}`} className="absolute"
                    style={{
                        left: cx, top: cy,
                        width: 3, height: 18 + (i % 3) * 8,
                        marginLeft: -1.5, marginTop: -9,
                        background: `linear-gradient(180deg, #ffffff 0%, ${fx.ringColor} 100%)`,
                        boxShadow: `0 0 10px ${fx.ringColor}`,
                        borderRadius: 2,
                        transform: `rotate(${(i / 8) * 360}deg)`,
                        transformOrigin: "center",
                        animation: `distortParticle 1.3s ease-out ${s.delay}s forwards`,
                        opacity: 0,
                        ["--tx" as any]: `${s.tx}px`,
                        ["--ty" as any]: `${s.ty}px`,
                    } as React.CSSProperties}
                />
            ))}

            {/* Efecto glitch solo MYTHIC — duplicado desplazado del glow */}
            {fx.glitch && (
                <>
                    <div className="absolute rounded-full pointer-events-none"
                        style={{
                            left: cx + 8, top: cy,
                            width: r * 4, height: r * 4,
                            marginLeft: -(r * 2), marginTop: -(r * 2),
                            background: `radial-gradient(circle, #ef444433 0%, transparent 60%)`,
                            animation: "distortGlitch 0.6s ease-out 0.2s forwards",
                            opacity: 0,
                        }}
                    />
                    <div className="absolute rounded-full pointer-events-none"
                        style={{
                            left: cx - 8, top: cy,
                            width: r * 3, height: r * 3,
                            marginLeft: -(r * 1.5), marginTop: -(r * 1.5),
                            background: `radial-gradient(circle, #00ffff22 0%, transparent 60%)`,
                            animation: "distortGlitch 0.6s ease-out 0.3s forwards",
                            opacity: 0,
                        }}
                    />
                </>
            )}

            {/* Nombre encima del sprite */}
            <div className="absolute font-black uppercase pointer-events-none"
                style={{
                    left: cx, top: spriteRect.y - 8,
                    transform: "translateX(-50%) translateY(-100%)",
                    fontFamily: "'Rajdhani', sans-serif",
                    fontSize: newRarity === "MYTHIC" || newRarity === "LEGENDARY" ? "1.6rem" : "1.35rem",
                    color: fx.nameColor,
                    textShadow: fx.glowLayers + ", 0 3px 10px rgba(0,0,0,1)",
                    WebkitTextStroke: fx.nameBorder,
                    letterSpacing: "0.12em", whiteSpace: "nowrap",
                    animation: "distortNameIn 0.4s cubic-bezier(0.2,0,0,1.4) 0.35s forwards",
                    opacity: 0,
                }}
            >
                {mythName}
            </div>

            {/* Subtítulo "distorsión" bajo el sprite */}
            <div className="absolute font-mono font-black uppercase pointer-events-none"
                style={{
                    left: cx, top: spriteRect.y + spriteRect.h + 6,
                    transform: "translateX(-50%)",
                    fontSize: "0.62rem", color: cfg.glow,
                    textShadow: `0 0 10px ${cfg.glow}, 0 2px 4px rgba(0,0,0,0.9)`,
                    letterSpacing: "0.3em", whiteSpace: "nowrap",
                    animation: "distortNameIn 0.4s cubic-bezier(0.2,0,0,1.4) 0.5s forwards",
                    opacity: 0,
                }}
            >
                🌀 distorsión
            </div>

            {/* Badges de afinidad */}
            <div className="absolute flex gap-1 justify-center pointer-events-none"
                style={{
                    left: cx, top: spriteRect.y + spriteRect.h + 28,
                    transform: "translateX(-50%)",
                    animation: "distortNameIn 0.4s cubic-bezier(0.2,0,0,1.4) 0.65s forwards",
                    opacity: 0,
                }}
            >
                {newAffinities.map((aff) => {
                    const c = AFFINITY_CONFIG[aff as Affinity];
                    if (!c) return null;
                    return (
                        <div key={aff}
                            className="flex items-center justify-center rounded-full font-black font-mono"
                            style={{
                                width: 22, height: 22,
                                background: c.glow + "33", border: `1.5px solid ${c.glow}`,
                                boxShadow: `0 0 8px ${c.glow}88`,
                                fontSize: "8px", color: "#fff",
                                textShadow: "0 1px 2px rgba(0,0,0,0.9)",
                            }}
                        >
                            {aff.slice(0, 2)}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────
// TabBar
// ─────────────────────────────────────────

function TabBar({ mode, onSwitch, battleActive }: { mode: BattleMode; onSwitch: (m: BattleMode) => void; battleActive?: boolean }) {
    return (
        <div className="flex border-b border-slate-800 flex-shrink-0">
            {(["npc", "pvp"] as BattleMode[]).map((m) => {
                // Durante combate activo, TODAS las pestañas están bloqueadas
                const blocked = !!battleActive;
                const isActive = mode === m;
                return (
                    <button
                        key={m}
                        onClick={() => { if (!blocked) onSwitch(m); }}
                        title={blocked ? "No puedes cambiar de pestaña durante un combate" : undefined}
                        className={`px-6 py-3 font-mono text-sm tracking-widest uppercase transition-colors relative
                            ${isActive
                                ? blocked ? "text-red-400/50 border-b-2 border-red-500/50" : "text-red-400 border-b-2 border-red-500"
                                : blocked
                                  ? "text-slate-700 cursor-not-allowed"
                                  : "text-slate-500 hover:text-slate-300"}`}
                    >
                        {m === "npc" ? "⚔️ NPC" : "👥 PvP"}
                    </button>
                );
            })}
        </div>
    );
}
