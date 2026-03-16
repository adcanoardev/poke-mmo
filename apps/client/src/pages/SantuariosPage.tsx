import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useTrainer } from "../context/TrainerContext";
import { api } from "../lib/api";

// ─────────────────────────────────────────
// Datos de los 8 Sanctums
// ─────────────────────────────────────────

const SANCTUM_DATA = [
    {
        id: 0,
        name: "EMBER",
        icon: "🔥",
        color: "#ff6b35",
        requiredLevel: 5,
        biome: "Volcánico",
        guardian: "Ignar el Forjado",
        lore: "Llanuras de ceniza y ríos de lava ardiente. Ignar domina la llama y la destrucción pura.",
        cx: 0.18, cy: 0.68,
    },
    {
        id: 1,
        name: "TIDE",
        icon: "🌊",
        color: "#38bdf8",
        requiredLevel: 10,
        biome: "Costero",
        guardian: "Marina de las Profundidades",
        lore: "Costa neblinosa donde el mar y la tormenta se funden en olas eternas.",
        cx: 0.31, cy: 0.52,
    },
    {
        id: 2,
        name: "GROVE",
        icon: "🌿",
        color: "#4ade80",
        requiredLevel: 15,
        biome: "Forestal",
        guardian: "Sylvara la Ancestral",
        lore: "Bosque eterno donde los Myths más antiguos duermen entre raíces milenarias.",
        cx: 0.50, cy: 0.30,
    },
    {
        id: 3,
        name: "VOLT",
        icon: "⚡",
        color: "#facc15",
        requiredLevel: 20,
        biome: "Tormentoso",
        guardian: "Zarak el Tempestuoso",
        lore: "Meseta de las tormentas eternas. El rayo cae sin cesar desde hace siglos.",
        cx: 0.67, cy: 0.42,
    },
    {
        id: 4,
        name: "STONE",
        icon: "🪨",
        color: "#94a3b8",
        requiredLevel: 25,
        biome: "Rocoso",
        guardian: "Petra Ironwall",
        lore: "Cañones milenarios donde la roca misma tiene memoria de batallas antiguas.",
        cx: 0.81, cy: 0.60,
    },
    {
        id: 5,
        name: "SHADE",
        icon: "🌑",
        color: "#a78bfa",
        requiredLevel: 30,
        biome: "Corrupto",
        guardian: "Noxar el Desterrado",
        lore: "Tierras donde la luz no llega. Los Myths corrompidos esperan en la oscuridad.",
        cx: 0.64, cy: 0.71,
    },
    {
        id: 6,
        name: "FROST",
        icon: "❄️",
        color: "#bae6fd",
        requiredLevel: 35,
        biome: "Glacial",
        guardian: "Cryo el Eterno",
        lore: "Cumbres heladas donde el tiempo parece haberse detenido para siempre.",
        cx: 0.28, cy: 0.24,
    },
    {
        id: 7,
        name: "ASTRAL",
        icon: "✨",
        color: "#e879f9",
        requiredLevel: 40,
        biome: "Astral",
        guardian: "Voryn el Sin Forma",
        lore: "El Sanctum final. Un plano entre dimensiones donde solo los más fuertes sobreviven.",
        cx: 0.49, cy: 0.57,
    },
];

const CONNECTIONS: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
    [2, 7], [7, 5], [6, 2], [6, 1], [1, 7],
];

// ─────────────────────────────────────────
// Canvas map drawing
// ─────────────────────────────────────────

function hexToRgba(hex: string, a: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
}

function drawMap(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width;
    const H = canvas.height;

    // 1. SKY
    const sky = ctx.createLinearGradient(0, 0, 0, H * 0.58);
    sky.addColorStop(0, "#020610");
    sky.addColorStop(0.4, "#060e22");
    sky.addColorStop(0.75, "#0b1a38");
    sky.addColorStop(1, "#122040");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Moon glow
    const moon = ctx.createRadialGradient(W * 0.72, H * 0.12, 0, W * 0.72, H * 0.12, W * 0.22);
    moon.addColorStop(0, "rgba(180,210,255,0.16)");
    moon.addColorStop(0.4, "rgba(100,150,220,0.05)");
    moon.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, W, H);

    // Nebula smear
    const neb = ctx.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, W * 0.32);
    neb.addColorStop(0, "rgba(80,40,140,0.08)");
    neb.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, W, H);

    // Stars — deterministic positions
    for (let i = 0; i < 180; i++) {
        const sx = ((Math.sin(i * 12.98 + 1) * 0.5 + 0.5)) * W;
        const sy = ((Math.sin(i * 78.23 + 2) * 0.5 + 0.5)) * H * 0.52;
        const sr = Math.sin(i * 0.3) < 0.7 ? 0.5 : 1.2;
        const op = 0.18 + (Math.sin(i * 4.7) * 0.5 + 0.5) * 0.7;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${op})`;
        ctx.fill();
    }
    for (let i = 0; i < 16; i++) {
        const sx = ((Math.sin(i * 23.1 + 5) * 0.5 + 0.5)) * W;
        const sy = ((Math.sin(i * 17.4 + 3) * 0.5 + 0.5)) * H * 0.44;
        const g2 = ctx.createRadialGradient(sx, sy, 0, sx, sy, 3);
        g2.addColorStop(0, "rgba(255,255,255,0.85)");
        g2.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g2;
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    // 2. MOUNTAINS — 3 layers
    function mtn(pts: [number, number][], col: string) {
        ctx!.fillStyle = col;
        ctx!.beginPath();
        ctx!.moveTo(0, H);
        pts.forEach(([x, y]) => ctx!.lineTo(x * W, y * H));
        ctx!.lineTo(W, H);
        ctx!.closePath();
        ctx!.fill();
    }
    mtn([[0, 0.6], [0.04, 0.38], [0.09, 0.51], [0.15, 0.30], [0.22, 0.45], [0.28, 0.25], [0.35, 0.42], [0.42, 0.28], [0.48, 0.44], [0.55, 0.26], [0.62, 0.41], [0.69, 0.29], [0.76, 0.44], [0.83, 0.32], [0.90, 0.46], [0.96, 0.35], [1, 0.52]], "#081528");
    mtn([[0, 0.68], [0.05, 0.45], [0.11, 0.57], [0.18, 0.36], [0.24, 0.52], [0.31, 0.32], [0.38, 0.50], [0.44, 0.36], [0.51, 0.54], [0.58, 0.38], [0.65, 0.53], [0.72, 0.37], [0.79, 0.52], [0.86, 0.40], [0.93, 0.54], [1, 0.60]], "#0a1c34");
    mtn([[0, 0.74], [0.06, 0.56], [0.12, 0.66], [0.19, 0.50], [0.26, 0.63], [0.33, 0.48], [0.40, 0.62], [0.47, 0.50], [0.54, 0.65], [0.61, 0.51], [0.68, 0.64], [0.75, 0.52], [0.82, 0.65], [0.89, 0.55], [0.95, 0.66], [1, 0.68]], "#0d2244");

    // 3. MIST between mountains and ground
    const mistY = H * 0.62;
    const mist = ctx.createLinearGradient(0, mistY - H * 0.08, 0, mistY + H * 0.06);
    mist.addColorStop(0, "rgba(20,40,80,0)");
    mist.addColorStop(0.3, "rgba(30,55,100,0.42)");
    mist.addColorStop(0.6, "rgba(18,38,72,0.62)");
    mist.addColorStop(1, "rgba(10,20,45,0)");
    ctx.fillStyle = mist;
    ctx.fillRect(0, mistY - H * 0.08, W, H * 0.14);

    // 4. GROUND BASE
    const groundY = H * 0.72;
    const ground = ctx.createLinearGradient(0, groundY, 0, H);
    ground.addColorStop(0, "#0e2245");
    ground.addColorStop(0.35, "#0b1a36");
    ground.addColorStop(1, "#060d1e");
    ctx.fillStyle = ground;
    ctx.fillRect(0, groundY, W, H - groundY);

    // 5. BIOME TERRAIN ZONES
    SANCTUM_DATA.forEach(z => {
        const gx = z.cx * W;
        const gy = z.cy * H;
        const rx = 0.14 * W;
        const ry = 0.16 * H;

        // Atmospheric halo
        const atm = ctx.createRadialGradient(gx, gy, 0, gx, gy, rx * 1.8);
        atm.addColorStop(0, hexToRgba(z.color, 0.18));
        atm.addColorStop(0.5, hexToRgba(z.color, 0.07));
        atm.addColorStop(1, hexToRgba(z.color, 0));
        ctx.beginPath();
        ctx.ellipse(gx, gy, rx * 1.8, ry * 1.8, 0, 0, Math.PI * 2);
        ctx.fillStyle = atm;
        ctx.fill();

        // Ground patch (perspective trapezoid below groundY)
        const patchCy = Math.max(gy, groundY);
        if (patchCy < H) {
            const pw = rx * 1.4;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(gx - pw * 0.5, patchCy);
            ctx.lineTo(gx + pw * 0.5, patchCy);
            ctx.lineTo(gx + pw * 0.85, H);
            ctx.lineTo(gx - pw * 0.85, H);
            ctx.closePath();
            const gPatch = ctx.createLinearGradient(0, patchCy, 0, H);
            gPatch.addColorStop(0, hexToRgba(z.color, 0));
            gPatch.addColorStop(0.2, hexToRgba(z.color, 0.22));
            gPatch.addColorStop(0.65, hexToRgba(z.color, 0.36));
            gPatch.addColorStop(1, hexToRgba(z.color, 0.12));
            ctx.fillStyle = gPatch;
            ctx.fill();
            ctx.restore();
        }

        // Inner glow at marker
        const inner = ctx.createRadialGradient(gx, gy * 0.95, 0, gx, gy, rx);
        inner.addColorStop(0, hexToRgba(z.color, 0.32));
        inner.addColorStop(0.55, hexToRgba(z.color, 0.14));
        inner.addColorStop(1, hexToRgba(z.color, 0));
        ctx.beginPath();
        ctx.ellipse(gx, gy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = inner;
        ctx.fill();
    });

    // 6. PERSPECTIVE GRID
    ctx.strokeStyle = "rgba(80,130,255,0.05)";
    ctx.lineWidth = 0.7;
    for (let i = 0; i <= 18; i++) {
        ctx.beginPath();
        ctx.moveTo(W * 0.5, groundY);
        ctx.lineTo((i / 18) * W, H);
        ctx.stroke();
    }
    for (let j = 1; j <= 8; j++) {
        const gy2 = groundY + (j / 8) * (H - groundY);
        ctx.beginPath();
        ctx.moveTo(0, gy2);
        ctx.lineTo(W, gy2);
        ctx.stroke();
    }

    // 7. GROUND FOG WISPS
    for (let w = 0; w < 5; w++) {
        const wy = groundY + w * (H - groundY) * 0.18;
        const wisp = ctx.createLinearGradient(0, wy, W, wy);
        wisp.addColorStop(0, "rgba(15,35,75,0)");
        wisp.addColorStop(0.2, "rgba(20,45,90,0.16)");
        wisp.addColorStop(0.5, "rgba(16,38,78,0.07)");
        wisp.addColorStop(0.8, "rgba(20,45,90,0.14)");
        wisp.addColorStop(1, "rgba(15,35,75,0)");
        ctx.fillStyle = wisp;
        ctx.fillRect(0, wy, W, H * 0.04);
    }

    // 8. HORIZON GLOW
    const horizon = ctx.createLinearGradient(0, groundY - H * 0.06, 0, groundY + H * 0.04);
    horizon.addColorStop(0, "rgba(20,50,110,0)");
    horizon.addColorStop(0.5, "rgba(30,70,150,0.10)");
    horizon.addColorStop(1, "rgba(20,50,110,0)");
    ctx.fillStyle = horizon;
    ctx.fillRect(0, groundY - H * 0.06, W, H * 0.10);
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────

export default function SantuariosPage() {
    const { trainer } = useTrainer();
    const navigate = useNavigate();
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [sanctumClears, setSanctumClears] = useState<number[]>(new Array(8).fill(0));
    const [selectedSanctum, setSelectedSanctum] = useState<typeof SANCTUM_DATA[0] | null>(null);
    const [hoveredId, setHoveredId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState<any>(null);

    const binderLevel: number = (trainer as any)?.binderLevel ?? 1;

    // Cargar clears del trainer
    useEffect(() => {
        if ((trainer as any)?.sanctumClears) {
            setSanctumClears((trainer as any).sanctumClears);
        }
    }, [trainer]);

    // Dibujar canvas y redibujar en resize
    const redrawCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        canvas.width = container.offsetWidth;
        canvas.height = container.offsetHeight;
        drawMap(canvas);
    }, []);

    useEffect(() => {
        redrawCanvas();
        const ro = new ResizeObserver(redrawCanvas);
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [redrawCanvas]);

    // Cerrar modal con Escape
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") { setSelectedSanctum(null); setError(""); }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    async function handleChallenge(sanctumId: number) {
        setError("");
        setResult(null);
        setLoading(true);
        try {
            const res = await api.challengeSanctum(sanctumId);
            setResult(res);
            if (res.result === "WIN") {
                setSanctumClears(prev => {
                    const next = [...prev];
                    next[sanctumId] = (next[sanctumId] ?? 0) + 1;
                    return next;
                });
            }
            if (res.battleId) {
                setSelectedSanctum(null);
                navigate("/battle");
            }
        } catch (e: any) {
            setError(e.message ?? "Error al iniciar el combate");
        } finally {
            setLoading(false);
        }
    }

    const isUnlocked = (s: typeof SANCTUM_DATA[0]) => binderLevel >= s.requiredLevel;
    const isCleared  = (s: typeof SANCTUM_DATA[0]) => (sanctumClears[s.id] ?? 0) > 0;
    const clearCount = (s: typeof SANCTUM_DATA[0]) => sanctumClears[s.id] ?? 0;

    return (
        <Layout>
            {/* ── Header ── */}
            <div className="flex-shrink-0 px-6 py-3 border-b border-border flex items-center justify-between">
                <h1 className="font-display font-bold text-xl tracking-widest">
                    🏛️ <span className="text-yellow">Santuarios</span>
                </h1>
                <div className="flex items-center gap-3">
                    {result && (
                        <div className={`px-3 py-1 rounded-xl border font-display font-bold text-xs
                            ${result.result === "WIN"
                                ? "border-green/30 text-green bg-green/10"
                                : "border-red/30 text-red bg-red/10"}`}>
                            {result.result === "WIN" ? "🏆 Victoria" : "💀 Derrota"}
                            {result.xpGained != null && (
                                <span className="text-muted font-normal ml-2">+{result.xpGained}XP</span>
                            )}
                        </div>
                    )}
                    {error && !selectedSanctum && (
                        <div className="px-3 py-1 rounded-xl border border-red/30 text-red bg-red/10 font-display text-xs">
                            ❌ {error}
                        </div>
                    )}
                    <div className="px-3 py-1 rounded-xl border border-border bg-card font-display text-xs text-muted">
                        Binder Lv <span className="text-yellow font-bold">{binderLevel}</span>
                    </div>
                </div>
            </div>

            {/* ── Mapa ── */}
            <div ref={containerRef} className="flex-1 relative overflow-hidden">

                {/* Canvas fondo */}
                <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    style={{ zIndex: 1 }}
                />

                {/* Vignette */}
                <div className="absolute inset-0 pointer-events-none" style={{
                    zIndex: 2,
                    background: "radial-gradient(ellipse 85% 80% at 50% 50%, transparent 30%, rgba(4,7,16,0.88) 100%)",
                }} />

                {/* Edge fade */}
                <div className="absolute inset-0 pointer-events-none" style={{
                    zIndex: 2,
                    background: `linear-gradient(to bottom, rgba(4,7,16,0.5) 0%, transparent 16%),
                                 linear-gradient(to top, rgba(4,7,16,0.65) 0%, transparent 18%)`,
                }} />

                {/* SVG caminos punteados */}
                <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ zIndex: 3 }}
                    viewBox="0 0 1000 1000"
                    preserveAspectRatio="none"
                >
                    {CONNECTIONS.map(([a, b], i) => {
                        const za = SANCTUM_DATA[a];
                        const zb = SANCTUM_DATA[b];
                        return (
                            <line
                                key={i}
                                x1={za.cx * 1000} y1={za.cy * 1000}
                                x2={zb.cx * 1000} y2={zb.cy * 1000}
                                stroke="rgba(232,240,254,0.08)"
                                strokeWidth="1.5"
                                strokeDasharray="5 9"
                            />
                        );
                    })}
                </svg>

                {/* Biome hover highlight */}
                {hoveredId !== null && (() => {
                    const z = SANCTUM_DATA[hoveredId];
                    return (
                        <div className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{
                            zIndex: 3,
                            background: `radial-gradient(ellipse 36% 32% at ${z.cx * 100}% ${z.cy * 100}%, ${z.color}28 0%, transparent 100%)`,
                        }} />
                    );
                })()}

                {/* Zone markers */}
                {SANCTUM_DATA.map(z => {
                    const unlocked = isUnlocked(z);
                    const cleared  = isCleared(z);
                    const size     = "clamp(28px, 3.4vw, 44px)";

                    return (
                        <div
                            key={z.id}
                            className="absolute"
                            style={{
                                left: `${z.cx * 100}%`,
                                top: `${z.cy * 100}%`,
                                transform: "translate(-50%, -50%)",
                                zIndex: 6,
                                cursor: "pointer",
                            }}
                            onMouseEnter={() => unlocked && setHoveredId(z.id)}
                            onMouseLeave={() => setHoveredId(null)}
                            onClick={() => { setError(""); setResult(null); setSelectedSanctum(z); }}
                        >
                            {/* Pulse rings */}
                            {unlocked && [0, 0.9].map((delay, ri) => (
                                <div
                                    key={ri}
                                    className="absolute rounded-full pointer-events-none"
                                    style={{
                                        inset: "-10px",
                                        border: `${ri === 0 ? 1.5 : 1}px solid ${z.color}`,
                                        animation: "sanctumPulse 2.8s ease-out infinite",
                                        animationDelay: `${z.id * 0.35 + delay}s`,
                                    }}
                                />
                            ))}

                            {/* Icon circle */}
                            <div
                                className="relative flex items-center justify-center rounded-full transition-all duration-200"
                                style={{
                                    width: size,
                                    height: size,
                                    background: "rgba(4,7,16,0.82)",
                                    border: `2px solid ${unlocked ? z.color : "rgba(255,255,255,0.12)"}`,
                                    fontSize: "clamp(12px, 1.6vw, 20px)",
                                    boxShadow: unlocked ? `0 0 12px ${z.color}, inset 0 0 8px rgba(0,0,0,0.6)` : "none",
                                    opacity: unlocked ? 1 : 0.28,
                                    filter: unlocked ? "none" : "grayscale(1)",
                                }}
                            >
                                {z.icon}
                                {/* Cleared dot */}
                                {cleared && unlocked && (
                                    <div className="absolute flex items-center justify-center rounded-full font-bold" style={{
                                        bottom: "-3px", right: "-3px",
                                        width: "clamp(9px, 1vw, 13px)",
                                        height: "clamp(9px, 1vw, 13px)",
                                        background: "#4ade80",
                                        border: "2px solid #020810",
                                        fontSize: "clamp(5px, 0.55vw, 8px)",
                                        color: "#020810",
                                    }}>✓</div>
                                )}
                            </div>

                            {/* Level badge */}
                            <div className="absolute font-bold pointer-events-none" style={{
                                top: "clamp(-11px, -1.1vw, -7px)",
                                right: "clamp(-9px, -0.9vw, -5px)",
                                background: "#080f22",
                                border: "1px solid rgba(255,255,255,0.18)",
                                borderRadius: "10px",
                                padding: "1px 5px",
                                fontSize: "clamp(6px, 0.62vw, 9px)",
                                color: unlocked ? "rgba(232,240,254,0.5)" : "rgba(232,240,254,0.25)",
                            }}>
                                Lv{z.requiredLevel}
                            </div>

                            {/* Hover label */}
                            {hoveredId === z.id && unlocked && (
                                <div className="absolute whitespace-nowrap font-bold uppercase tracking-widest pointer-events-none" style={{
                                    top: "calc(100% + 7px)",
                                    left: "50%",
                                    transform: "translateX(-50%)",
                                    background: "rgba(4,7,16,0.92)",
                                    border: `1px solid ${z.color}`,
                                    borderRadius: "4px",
                                    padding: "2px 8px",
                                    color: "#e8f0fe",
                                    fontSize: "clamp(7px, 0.75vw, 10px)",
                                    boxShadow: `0 0 8px ${z.color}`,
                                    zIndex: 10,
                                }}>
                                    {z.name}
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* ── MODAL ── */}
                {selectedSanctum && (
                    <div
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                            zIndex: 20,
                            background: "rgba(4,7,16,0.7)",
                            backdropFilter: "blur(8px)",
                        }}
                        onClick={e => { if (e.target === e.currentTarget) { setSelectedSanctum(null); setError(""); } }}
                    >
                        <div
                            className="relative rounded-2xl overflow-hidden"
                            style={{
                                width: "clamp(260px, 26vw, 320px)",
                                background: "#0b1324",
                                border: `1px solid ${selectedSanctum.color}`,
                                boxShadow: `0 0 50px ${selectedSanctum.color}44, 0 20px 50px rgba(0,0,0,0.7)`,
                            }}
                        >
                            {/* Close btn */}
                            <button
                                className="absolute top-2.5 right-3 text-white/20 hover:text-white transition-colors bg-transparent border-none"
                                style={{ fontSize: "clamp(13px, 1.3vw, 17px)", lineHeight: 1, cursor: "pointer" }}
                                onClick={() => { setSelectedSanctum(null); setError(""); setResult(null); }}
                            >✕</button>

                            {/* Header */}
                            <div className="flex items-center gap-3 border-b border-white/[0.07]"
                                style={{ padding: "clamp(12px,1.4vw,16px)" }}>
                                <div className="flex-shrink-0 flex items-center justify-center rounded-full" style={{
                                    width: "clamp(36px,4.2vw,50px)",
                                    height: "clamp(36px,4.2vw,50px)",
                                    background: "rgba(4,7,16,0.85)",
                                    border: `2px solid ${selectedSanctum.color}`,
                                    fontSize: "clamp(15px,1.9vw,22px)",
                                    boxShadow: `0 0 16px ${selectedSanctum.color}55`,
                                }}>
                                    {selectedSanctum.icon}
                                </div>
                                <div>
                                    <div className="font-display font-bold text-white"
                                        style={{ fontSize: "clamp(13px,1.5vw,17px)" }}>
                                        Sanctum {selectedSanctum.name}
                                    </div>
                                    <div className="text-white/40"
                                        style={{ fontSize: "clamp(9px,0.85vw,11px)", marginTop: "2px" }}>
                                        Bioma {selectedSanctum.biome} · Nivel {selectedSanctum.requiredLevel} requerido
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div style={{ padding: "clamp(10px,1.2vw,15px) clamp(12px,1.4vw,16px) clamp(12px,1.3vw,16px)" }}>
                                {/* Lore */}
                                <p className="italic" style={{
                                    color: "rgba(232,240,254,0.55)",
                                    fontSize: "clamp(9px,0.9vw,11px)",
                                    lineHeight: 1.7,
                                    marginBottom: "clamp(8px,1vw,12px)",
                                    paddingLeft: "9px",
                                    borderLeft: `2px solid ${selectedSanctum.color}`,
                                }}>
                                    {selectedSanctum.lore}
                                </p>

                                {/* Stats rows */}
                                {[
                                    ["Entrenador",   selectedSanctum.guardian],
                                    ["Formato",      "3 rondas · 1v1"],
                                    ["Tu equipo",    "5 Myths · máx. 2 cambios"],
                                    ["Curación",     "⚠ No entre rondas"],
                                    ["Victorias",    `${clearCount(selectedSanctum)} victoria${clearCount(selectedSanctum) !== 1 ? "s" : ""}`],
                                ].map(([k, v]) => (
                                    <div key={k} className="flex justify-between" style={{ marginBottom: "5px" }}>
                                        <span style={{ color: "rgba(232,240,254,0.32)", fontSize: "clamp(8px,0.8vw,10px)" }}>{k}</span>
                                        <span className="font-bold" style={{
                                            color: k === "Victorias" && clearCount(selectedSanctum) > 0 ? "#4ade80"
                                                 : k === "Curación" ? "#f87171" : "#e8f0fe",
                                            fontSize: "clamp(8px,0.8vw,10px)",
                                        }}>{v}</span>
                                    </div>
                                ))}

                                <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "clamp(8px,1vw,11px) 0" }} />

                                {error && (
                                    <div className="mb-2 text-xs text-center font-display" style={{ color: "#f87171" }}>
                                        ❌ {error}
                                    </div>
                                )}

                                {/* CTA */}
                                {isUnlocked(selectedSanctum) ? (
                                    <button
                                        onClick={() => handleChallenge(selectedSanctum.id)}
                                        disabled={loading}
                                        className="w-full font-display font-bold uppercase tracking-widest transition-all disabled:opacity-50"
                                        style={{
                                            padding: "clamp(7px,0.85vw,10px)",
                                            borderRadius: "7px",
                                            border: "none",
                                            cursor: loading ? "not-allowed" : "pointer",
                                            background: selectedSanctum.color,
                                            color: "#020810",
                                            fontSize: "clamp(9px,0.95vw,12px)",
                                        }}
                                    >
                                        {loading ? "..." : "⚔️  RETAR AL SANCTUM"}
                                    </button>
                                ) : (
                                    <button disabled className="w-full font-display font-bold uppercase tracking-widest" style={{
                                        padding: "clamp(7px,0.85vw,10px)",
                                        borderRadius: "7px",
                                        border: "1px solid rgba(255,255,255,0.08)",
                                        background: "rgba(255,255,255,0.04)",
                                        color: "rgba(232,240,254,0.22)",
                                        fontSize: "clamp(9px,0.95vw,12px)",
                                        cursor: "not-allowed",
                                    }}>
                                        🔒 Nivel {selectedSanctum.requiredLevel} requerido
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Hint */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none font-display uppercase tracking-widest"
                    style={{
                        zIndex: 8,
                        color: "rgba(232,240,254,0.28)",
                        fontSize: "clamp(7px,0.72vw,10px)",
                        animation: "sanctumBlink 3s ease-in-out infinite",
                    }}>
                    Clic en un sanctum para retarlo
                </div>
            </div>

            {/* Keyframes */}
            <style>{`
                @keyframes sanctumPulse {
                    0%   { transform: scale(0.65); opacity: 0.75; }
                    100% { transform: scale(2.5);  opacity: 0; }
                }
                @keyframes sanctumBlink {
                    0%, 100% { opacity: 0.28; }
                    50%      { opacity: 0.65; }
                }
            `}</style>
        </Layout>
    );
}
