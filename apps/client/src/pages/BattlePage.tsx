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
// HP Bar
// ─────────────────────────────────────────

function HpBar({ hp, maxHp, shield = 0 }: { hp: number; maxHp: number; shield?: number }) {
    const pct = maxHp > 0 ? Math.max(0, (hp / maxHp) * 100) : 0;
    const shieldPct = maxHp > 0 ? Math.min(100 - pct, (shield / maxHp) * 100) : 0;
    // Color progresivo: 90%=verde claro → 50%=amarillo → 30%=naranja → 10%=rojo intenso
    const barColor =
        pct > 90 ? "#6ee7b7"
        : pct > 70 ? "#34d399"
        : pct > 50 ? "#a3e635"
        : pct > 30 ? "#facc15"
        : pct > 15 ? "#f97316"
        : pct > 5  ? "#ef4444"
                   : "#b91c1c";
    const glowColor =
        pct > 50 ? "rgba(52,211,153,0.5)" : pct > 25 ? "rgba(250,204,21,0.5)" : "rgba(239,68,68,0.6)";
    return (
        <div className="w-full h-3 bg-black/40 rounded-full overflow-hidden flex" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <div
                className="h-full rounded-l-full transition-all duration-700"
                style={{ width: `${pct}%`, background: barColor, boxShadow: `0 0 6px ${glowColor}` }}
            />
            {shieldPct > 0 && (
                <div className="h-full transition-all duration-700" style={{ width: `${shieldPct}%`, background: "#60a5fa", boxShadow: "0 0 6px rgba(96,165,250,0.5)" }} />
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
// Arena Myth — versión estilo Pokémon (sin borde de carta)
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
                    {/* Texto CRÍTICO — fondo blanco, texto rojo con contorno rojo oscuro */}
                    {floatingDmg.crit && !floatingDmg.heal && (
                        <div
                            className="absolute z-31 pointer-events-none font-black tracking-widest uppercase animate-float-dmg"
                            style={{
                                top: -72,
                                left: "50%",
                                transform: "translateX(-50%)",
                                fontSize: "1.45rem",
                                color: "#cc0000",
                                background: "white",
                                borderRadius: 6,
                                padding: "1px 10px 2px 10px",
                                border: "2.5px solid #cc0000",
                                WebkitTextStroke: "0.5px #7f0000",
                                letterSpacing: "0.15em",
                                whiteSpace: "nowrap",
                                boxShadow: "0 0 16px #ff000066, 0 2px 8px rgba(0,0,0,0.7)",
                            }}
                        >
                            ¡CRÍTICO!
                        </div>
                    )}
                    <div
                        className={`absolute z-30 pointer-events-none animate-float-dmg font-black tracking-tighter
                            ${floatingDmg.heal ? "text-emerald-400" : floatingDmg.crit ? "text-red-400" : floatingDmg.mult >= 2 ? "text-orange-400" : floatingDmg.mult <= 0.5 ? "text-blue-300" : "text-white"}`}
                        style={{
                            top: -24,
                            left: "50%",
                            transform: "translateX(-50%)",
                            fontSize: floatingDmg.crit ? "2.6rem" : "1.8rem",
                            textShadow: floatingDmg.heal
                                ? "0 0 12px #4ade80, 0 2px 4px rgba(0,0,0,0.8)"
                                : floatingDmg.crit
                                  ? "0 0 20px #ff2222, 0 0 40px #ff000088, 0 2px 4px rgba(0,0,0,0.9)"
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
                {/* Target ring */}
                {targeted && !myth.defeated && (
                    <div
                        className="absolute inset-0 rounded-full border-2 animate-pulse pointer-events-none"
                        style={{ borderColor: targetColor ?? "rgba(248,113,113,0.7)" }}
                    />
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
                    {isActing && !myth.defeated && <span className="text-yellow-400 text-xs animate-pulse">▶</span>}
                    {primaryAffinity && afCfg && (
                        <div
                            className="flex-shrink-0 flex items-center justify-center rounded-full font-black"
                            title={primaryAffinity}
                            style={{
                                width: 16, height: 16,
                                background: afCfg.color,
                                boxShadow: `0 0 6px ${afCfg.glow}bb`,
                                fontSize: "7px", color: "#fff",
                                textShadow: "0 1px 2px rgba(0,0,0,0.9)",
                                flexShrink: 0,
                            }}
                        >
                            {primaryAffinity.slice(0, 2).toUpperCase()}
                        </div>
                    )}
                    <p
                        className={`text-xs font-bold truncate font-mono
                            ${myth.defeated ? "text-slate-600" : isActing ? "text-yellow-300" : targeted ? "text-red-400" : "text-white/90"}`}
                        style={{ maxWidth: Math.max(spriteSize - 22, 58) }}
                    >
                        {myth.name}
                    </p>
                </div>
                {!myth.defeated && (
                    <>
                        {/* Barra de nivel + HP integrados */}
                        <div className="flex items-center gap-1 w-full justify-center">
                            {/* Badge de nivel — ligeramente más alto que la barra */}
                            <div
                                className="flex-shrink-0 flex items-center justify-center font-black font-mono rounded"
                                style={{
                                    width: 28, height: 18,
                                    background: "linear-gradient(135deg, #1e3a5f 0%, #0f2340 100%)",
                                    border: "1px solid rgba(96,165,250,0.5)",
                                    boxShadow: "0 0 6px rgba(96,165,250,0.25)",
                                    fontSize: "10px", color: "#93c5fd",
                                    letterSpacing: "0.02em", flexShrink: 0,
                                }}
                            >
                                {`Lv${myth.level}`}
                            </div>
                            <HpBar hp={myth.hp} maxHp={myth.maxHp} shield={myth.shield} />
                        </div>
                        {/* HP número */}
                        <p className="font-mono font-bold tabular-nums" style={{ fontSize: "0.8rem", color: "#e2e8f0", textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
                            <span style={{ fontWeight: 900 }}>{myth.hp}</span>
                            <span style={{ color: "#475569", fontWeight: 400 }}>/{myth.maxHp}</span>
                        </p>
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

    function triggerKo(instanceId: string) {
        setKoOverlays((prev) => ({ ...prev, [instanceId]: true }));
        setTimeout(() => {
            setKoOverlays((prev) => { const n = { ...prev }; delete n[instanceId]; return n; });
        }, 2400);
    }

    function showSupportOverlay(instanceId: string, text: string, color: string, glow: string, duration = 1800) {
        setSupportOverlays((prev) => ({ ...prev, [instanceId]: { text, color, glow } }));
        setTimeout(() => {
            setSupportOverlays((prev) => { const n = { ...prev }; delete n[instanceId]; return n; });
        }, duration);
    }

    const [log, setLog] = useState<{ text: string; type: string }[]>([]);
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
        }
        return { actorId, isPlayer };
    }

    const currentActorIsPlayer = session?.playerTeam.some((m) => m.instanceId === currentActorId) ?? false;
    // Ref estable para el flag — evita que closures viejos del intervalo accedan a estado obsoleto
    const currentActorIsPlayerRef = useRef(false);
    useEffect(() => { currentActorIsPlayerRef.current = currentActorIsPlayer; }, [currentActorIsPlayer]);
    const animatingRef = useRef(false);
    useEffect(() => { animatingRef.current = animating; }, [animating]);

    function addLog(text: string, type = "normal") {
        setLog((l) => [...l.slice(-50), { text, type }]);
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
            addLog(`${logPrefix}${action.actorName} usa ${action.move} → ${action.targetName}`, "normal");
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

                if (action.mult >= 2) addLog(`⚡ ¡Súper eficaz! ×${action.mult}`, action.isPlayerMyth ? "good" : "bad");
                else if (action.mult > 0 && action.mult < 1)
                    addLog(`💤 Poco eficaz ×${action.mult}`, action.isPlayerMyth ? "bad" : "good");
                if (action.crit) addLog("💥 ¡Golpe crítico!", "crit");

                if (action.statusApplied) {
                    const icon = STATUS_ICONS[action.statusApplied] ?? "⚠️";
                    addLog(`${icon} ¡${action.targetName} afectado por ${action.statusApplied}!`, "status");
                    if (action.targetInstanceId) {
                        const so = STATUS_OVERLAYS[action.statusApplied];
                        if (so) showSupportOverlay(action.targetInstanceId, so.text, so.color, so.glow, 1400);
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
        if (nextActorIsPlayer && nextActorId) {
            const actorName =
                [...newSession.playerTeam, ...newSession.enemyTeam].find((m) => m.instanceId === nextActorId)?.name ??
                "TU MYTH";
            setTurnOverlay(actorName);
            setTimeout(() => setTurnOverlay(null), 3000);
        }
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
                await sleep(3000); // pausa 3s entre ataque jugador y respuesta NPC
                await handleNpcTurn(newSession, nextActorId, true);
            }
        } catch (e: any) {
            addLog(`Error: ${e.message}`, "bad");
        } finally {
            // setAnimating(false) solo si NO encadenamos NPC
            // (handleNpcTurn lo hace en su propio finally con isRoot=true)
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

    async function handleStart(order: string[]) {
        setLoadingStart(true);
        try {
            const s = await api.battleNpcStart(order);
            const cloned = cloneSession(s);
            setSession(cloned);
            setPhase("battle");
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
    return (
        <>
            {screenWarningOverlay}
            <Layout sidebar={<TrainerSidebar />}>
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
                                                background:
                                                    "linear-gradient(135deg, rgba(7,11,20,0.92) 0%, rgba(30,45,69,0.95) 100%)",
                                                border: "2px solid rgba(253,214,10,0.7)",
                                                borderRadius: 20,
                                                padding: "18px 48px",
                                                boxShadow: "0 0 60px rgba(253,214,10,0.35), 0 8px 40px rgba(0,0,0,0.7)",
                                            }}
                                        >
                                            <p className="font-mono text-xs text-yellow-400/70 tracking-widest uppercase mb-1">
                                                Tu turno
                                            </p>
                                            <p
                                                className="font-mono font-black text-3xl text-yellow-300 tracking-widest uppercase"
                                                style={{ textShadow: "0 0 24px rgba(253,214,10,0.9), 0 0 48px rgba(253,214,10,0.5)" }}
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
                                                    onClick={() => { if (!myth.defeated && !animating && currentActorIsPlayer) setTargetEnemyMythId(myth.instanceId); }}
                                                />
                                            )}
                                        </div>
                                    );
                                })}

                                {/* ── Barra de turno central — grande y visual ── */}
                                <div className="absolute left-0 right-0 flex flex-col items-center justify-center gap-2 z-20 pointer-events-none" style={{ top: "50%", transform: "translateY(-50%)" }}>
                                    {/* Turno número */}
                                    <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-full px-5 py-1 border border-white/10">
                                        <span className="font-mono text-xs text-slate-500 tracking-[0.2em] uppercase">Turno</span>
                                        <span className="font-mono font-black text-white text-base">{session?.turn ?? 0}</span>
                                    </div>

                                    {/* Indicador turno jugador — sin timer */}
                                    {currentActorIsPlayer && !animating && (
                                        <div className="text-xs font-mono font-bold text-yellow-300/90 tracking-wide" style={{ textShadow: "0 0 10px rgba(253,224,71,0.5)" }}>
                                            ⚔️ {currentActor?.name} → {targetEnemy ? `🎯 ${targetEnemy.name}` : "elige objetivo"}
                                        </div>
                                    )}
                                </div>

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
                                                  : null;

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

                                                    {/* Contenido sobre el fondo */}
                                                    <div className="relative z-[2] flex flex-col h-full px-3 py-2 gap-1">

                                                        {/* Nombre */}
                                                        <p className="font-black leading-none truncate"
                                                            style={{ fontFamily: "'Rajdhani', sans-serif", fontSize: "1.25rem", color: "#f0f8ff", letterSpacing: "0.01em", textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}>
                                                            {actorForMoves.name}
                                                        </p>

                                                        {/* Nivel + afinidad en fila */}
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <div className="flex items-center justify-center font-black font-mono rounded-md px-1.5"
                                                                style={{
                                                                    height: 18,
                                                                    background: "linear-gradient(135deg, #1e3a5f 0%, #0f2340 100%)",
                                                                    border: "1px solid rgba(96,165,250,0.6)",
                                                                    boxShadow: "0 0 8px rgba(96,165,250,0.3)",
                                                                    fontSize: "11px", color: "#93c5fd", letterSpacing: "0.02em",
                                                                }}>
                                                                Lv{actorForMoves.level}
                                                            </div>
                                                            {(() => {
                                                                const af = actorForMoves.affinities?.[0];
                                                                const afCfg2 = af ? AFFINITY_CONFIG[af] : null;
                                                                return afCfg2 ? (
                                                                    <div className="flex items-center gap-1 rounded-full px-2"
                                                                        style={{
                                                                            height: 18,
                                                                            background: `${afCfg2.glow}28`,
                                                                            border: `1px solid ${afCfg2.glow}80`,
                                                                            boxShadow: `0 0 8px ${afCfg2.glow}44`,
                                                                        }}>
                                                                        <span style={{ fontSize: "12px" }}>{afCfg2.emoji}</span>
                                                                        <span className="font-mono font-black" style={{ fontSize: "10px", color: afCfg2.glow, letterSpacing: "0.05em" }}>
                                                                            {afCfg2.label.toUpperCase()}
                                                                        </span>
                                                                    </div>
                                                                ) : null;
                                                            })()}
                                                        </div>

                                                        {/* Separador */}
                                                        <div className="h-px bg-slate-700/60 my-0.5" />

                                                        {/* Stats ATK / DEF / SPD con formato base→real */}
                                                        <div className="flex flex-col gap-1 flex-1">
                                                            {(["attack","defense","speed"] as const).map((stat) => {
                                                                const baseVal = actorForMoves[stat];
                                                                const buffKey = stat === "attack" ? "atk" : stat === "defense" ? "def" : "spd";
                                                                const buffStages = actorForMoves.buffs?.[buffKey] ?? 0;
                                                                const buffMult = buffStages > 0 ? 1 + buffStages * 0.25 : buffStages < 0 ? 1 / (1 + Math.abs(buffStages) * 0.25) : 1;
                                                                const realVal = Math.round(baseVal * buffMult);
                                                                const pctDiff = buffStages !== 0 ? Math.round((buffMult - 1) * 100) : 0;
                                                                const label = stat === "attack" ? "ATK" : stat === "defense" ? "DEF" : "SPD";
                                                                const icon = stat === "attack" ? "⚔️" : stat === "defense" ? "🛡️" : "💨";
                                                                return (
                                                                    <div key={stat} className="flex items-baseline gap-1.5">
                                                                        <span className="text-[11px] flex-shrink-0">{icon}</span>
                                                                        <span className="font-mono text-[10px] text-slate-400 flex-shrink-0" style={{ width: 24 }}>{label}</span>
                                                                        {pctDiff !== 0 ? (
                                                                            <>
                                                                                <span className="font-mono text-[11px] text-slate-400">{baseVal}</span>
                                                                                <span className="font-mono text-[9px] text-yellow-400 font-bold">{pctDiff > 0 ? `+${pctDiff}%` : `${pctDiff}%`}</span>
                                                                                <span className={`font-mono text-[13px] font-black ${pctDiff > 0 ? "text-emerald-400" : "text-red-400"}`}
                                                                                    style={{ textShadow: pctDiff > 0 ? "0 0 8px rgba(74,222,128,0.5)" : "0 0 8px rgba(248,113,113,0.5)" }}>
                                                                                    {realVal}
                                                                                </span>
                                                                            </>
                                                                        ) : (
                                                                            <span className="font-mono text-[13px] font-black text-white">{baseVal}</span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Barra HP — gruesa, full-width */}
                                                        <div className="mt-auto pt-1">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="font-mono text-[10px] font-bold text-slate-300">HP</span>
                                                                <span className="font-mono font-black tabular-nums"
                                                                    style={{ fontSize: "11px", color: "#e2e8f0", textShadow: "0 1px 4px rgba(0,0,0,0.8)" }}>
                                                                    <span className="text-white">{actorForMoves.hp}</span>
                                                                    <span className="text-slate-500 font-normal">/{actorForMoves.maxHp}</span>
                                                                </span>
                                                            </div>
                                                            <div className="h-3 rounded-full bg-slate-900/80 overflow-hidden w-full"
                                                                style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,0.6)" }}>
                                                                <div className="h-full rounded-full transition-all duration-300"
                                                                    style={{
                                                                        width: `${Math.max(0, (actorForMoves.hp / actorForMoves.maxHp) * 100)}%`,
                                                                        background: actorForMoves.hp / actorForMoves.maxHp > 0.5
                                                                            ? "linear-gradient(90deg, #16a34a, #4ade80)"
                                                                            : actorForMoves.hp / actorForMoves.maxHp > 0.25
                                                                            ? "linear-gradient(90deg, #b45309, #fbbf24)"
                                                                            : "linear-gradient(90deg, #991b1b, #f87171)",
                                                                        boxShadow: actorForMoves.hp / actorForMoves.maxHp > 0.5
                                                                            ? "0 0 8px rgba(74,222,128,0.5)"
                                                                            : actorForMoves.hp / actorForMoves.maxHp > 0.25
                                                                            ? "0 0 8px rgba(251,191,36,0.5)"
                                                                            : "0 0 8px rgba(248,113,113,0.5)",
                                                                    }} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* ── Moves (75%) ── */}
                                                <div className="flex-1 p-2 min-w-0 flex flex-col relative">
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
                                            <div className="flex items-center justify-center h-full">
                                                <p className="text-slate-400 text-sm font-mono">
                                                    {`👾 Turno de ${
                                                          session
                                                              ? ([...session.playerTeam, ...session.enemyTeam].find(
                                                                    (m) => m.instanceId === currentActorId,
                                                                )?.name ?? "rival")
                                                              : "rival"
                                                      }...`}
                                                </p>
                                            </div>
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
        </>
    );
}

// ─────────────────────────────────────────
// TabBar
// ─────────────────────────────────────────

function TabBar({ mode, onSwitch, battleActive }: { mode: BattleMode; onSwitch: (m: BattleMode) => void; battleActive?: boolean }) {
    return (
        <div className="flex border-b border-slate-800 flex-shrink-0">
            {(["npc", "pvp"] as BattleMode[]).map((m) => {
                const blocked = battleActive && m === "pvp";
                return (
                    <button
                        key={m}
                        onClick={() => { if (!blocked) onSwitch(m); }}
                        title={blocked ? "No puedes cambiar a PvP con un combate NPC en curso" : undefined}
                        className={`px-6 py-3 font-mono text-sm tracking-widest uppercase transition-colors relative
                            ${mode === m
                                ? "text-red-400 border-b-2 border-red-500"
                                : blocked
                                  ? "text-slate-700 cursor-not-allowed"
                                  : "text-slate-500 hover:text-slate-300"}`}
                    >
                        {m === "npc" ? "⚔️ NPC" : "👥 PvP"}
                        {blocked && (
                            <span className="ml-1 text-xs text-slate-700">🔒</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
