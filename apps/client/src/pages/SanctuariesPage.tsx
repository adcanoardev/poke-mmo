import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTrainer } from "../context/TrainerContext";
import PageTopbar from "../components/PageTopbar";
import { useMapDrag } from "../hooks/useMapDrag";
import { api } from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Sanctum data
// px/py = position 0–1 over the map image — adjust after seeing on screen
// ─────────────────────────────────────────────────────────────────────────────

const SANCTUM_DATA = [
    {
        id: 0, name: "EMBER",  icon: "🔥", color: "var(--accent-orange)",
        requiredLevel: 5,  biome: "Volcanic",   guardian: "Ignar the Forged",
        lore: "Plains of ash and rivers of burning lava. Ignar commands flame and pure destruction.",
        px: 0.38, py: 0.52,
    },
    {
        id: 1, name: "TIDE",   icon: "🌊", color: "#38bdf8",
        requiredLevel: 10, biome: "Coastal",    guardian: "Marina of the Depths",
        lore: "A misty coastline where sea and storm merge into endless crashing waves.",
        px: 0.18, py: 0.62,
    },
    {
        id: 2, name: "GROVE",  icon: "🌿", color: "#4ade80",
        requiredLevel: 15, biome: "Forest",     guardian: "Sylvara the Ancient",
        lore: "An eternal forest where the oldest Myths sleep among millennial roots.",
        px: 0.72, py: 0.22,
    },
    {
        id: 3, name: "VOLT",   icon: "⚡", color: "#facc15",
        requiredLevel: 20, biome: "Stormlands", guardian: "Zarak the Tempestuous",
        lore: "A plateau of endless storms. Lightning has fallen without pause for centuries.",
        px: 0.62, py: 0.28,
    },
    {
        id: 4, name: "STONE",  icon: "🪨", color: "#94a3b8",
        requiredLevel: 25, biome: "Rocky",      guardian: "Petra Ironwall",
        lore: "Ancient canyons where the rock itself holds memories of ancient battles.",
        px: 0.55, py: 0.45,
    },
    {
        id: 5, name: "SHADE",  icon: "🌑", color: "#a78bfa",
        requiredLevel: 30, biome: "Corrupted",  guardian: "Noxar the Banished",
        lore: "Lands where light never reaches. Corrupted Myths wait in the darkness.",
        px: 0.78, py: 0.68,
    },
    {
        id: 6, name: "FROST",  icon: "❄️", color: "#bae6fd",
        requiredLevel: 35, biome: "Glacial",    guardian: "Cryo the Eternal",
        lore: "Frozen peaks where time itself seems to have stopped forever.",
        px: 0.22, py: 0.18,
    },
    {
        id: 7, name: "ASTRAL", icon: "✨", color: "#e879f9",
        requiredLevel: 40, biome: "Astral",     guardian: "Voryn the Formless",
        lore: "The final Sanctum. A plane between dimensions where only the strongest survive.",
        px: 0.48, py: 0.70,
    },
] as const;

type SanctumDef = typeof SANCTUM_DATA[number];

const MAP_URL =
    "https://cdn.jsdelivr.net/gh/adcanoardev/mythara-assets@e36395adab28ecd23770629b143c8f9426eac800/maps/biomes_map.webp";

// ─────────────────────────────────────────────────────────────────────────────

export default function SanctuariesPage() {
    const { trainer } = useTrainer();
    const navigate    = useNavigate();

    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef       = useRef<HTMLDivElement>(null);

    const [sanctumClears, setSanctumClears] = useState<number[]>(new Array(8).fill(0));
    const [selected,  setSelected]  = useState<SanctumDef | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [loading,   setLoading]   = useState(false);
    const [error,     setError]     = useState("");
    const [result,    setResult]    = useState<any>(null);
    const [hint,      setHint]      = useState(true);

    const binderLevel: number = (trainer as any)?.binderLevel ?? 1;
    const { offset, onMouseDown, onTouchStart, didDrag } = useMapDrag(containerRef, mapRef);

    useEffect(() => {
        const c = (trainer as any)?.sanctumClears;
        if (Array.isArray(c)) setSanctumClears(c);
    }, [trainer]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeSheet(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    function openSheet(z: SanctumDef) {
        if (didDrag.current) return;
        setSelected(z); setError(""); setResult(null); setHint(false);
        requestAnimationFrame(() => setSheetOpen(true));
    }

    function closeSheet() {
        setSheetOpen(false);
        setTimeout(() => setSelected(null), 280);
    }

    async function handleChallenge(sanctumId: number) {
        setError(""); setResult(null); setLoading(true);
        try {
            const party   = await api.getParty();
            const mythIds = party.map((m: any) => m.id).slice(0, 5);
            if (!mythIds.length) throw new Error("You need at least 1 Myth in your party");
            const res = await api.challengeSanctum(sanctumId, mythIds);
            setResult(res);
            if (res.result === "WIN") {
                setSanctumClears(prev => {
                    const next = [...prev];
                    next[sanctumId] = (next[sanctumId] ?? 0) + 1;
                    return next;
                });
            }
            if (res.battleId) { closeSheet(); navigate("/battle"); }
        } catch (e: any) {
            setError(e.message ?? "Error starting combat");
        } finally {
            setLoading(false);
        }
    }

    const isUnlocked = (z: SanctumDef) => binderLevel >= z.requiredLevel;
    const isCleared  = (z: SanctumDef) => (sanctumClears[z.id] ?? 0) > 0;
    const clearCount = (z: SanctumDef) => sanctumClears[z.id] ?? 0;

    return (
        <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background:"#070b14", fontFamily:"'Exo 2',sans-serif" }}>
            <style>{`
                @keyframes smPulse  { 0%{transform:translate(-50%,-50%) scale(.6);opacity:.8} 100%{transform:translate(-50%,-50%) scale(2.6);opacity:0} }
                @keyframes sheetUp  { from{transform:translateY(100%)} to{transform:translateY(0)} }
                @keyframes sheetDn  { from{transform:translateY(0)} to{transform:translateY(100%)} }
                @keyframes hintFade { 0%,100%{opacity:.32} 50%{opacity:.75} }
                @keyframes arrowBob { 0%,100%{transform:translateX(0)} 50%{transform:translateX(4px)} }
                .sm-grab        { cursor: grab; }
                .sm-grab:active { cursor: grabbing; }
                @media(min-width:768px) {
                    .sm-sheet {
                        position: absolute !important;
                        bottom: auto !important; left: 50% !important; right: auto !important;
                        top: 50% !important; transform: translate(-50%,-50%) !important;
                        animation: none !important; border-radius: 14px !important;
                        max-width: 340px !important; width: 100% !important;
                    }
                }
            `}</style>

            {/* Ambient BG */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 70% 50% at 50% -10%,rgba(123,47,255,0.06) 0%,transparent 60%)" }} />
                <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)",backgroundSize:"40px 40px" }} />
            </div>

            {/* Header */}
            <PageTopbar
                title={<span className="font-display font-bold text-lg tracking-widest">🏛️ <span className="text-yellow">Sanctuaries</span></span>}
                right={
                    <div className="flex items-center gap-2">
                        {result && (
                            <span className={`px-2.5 py-1 rounded-xl border font-display font-bold text-xs
                                ${result.result === "WIN" ? "border-green/30 text-green bg-green/10" : "border-red/30 text-red bg-red/10"}`}>
                                {result.result === "WIN" ? "🏆 Victory" : "💀 Defeat"}
                                {result.xpGained != null && (
                                    <span className="text-muted font-normal ml-1.5">+{result.xpGained} XP</span>
                                )}
                            </span>
                        )}
                        <span className="px-2.5 py-1 rounded-xl border border-border bg-card font-display text-xs text-muted">
                            Lv <span className="text-yellow font-bold">{binderLevel}</span>
                        </span>
                    </div>
                }
            />

            {/* Draggable map */}
            <div
                ref={containerRef}
                className="flex-1 relative overflow-hidden sm-grab select-none"
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}
            >
                <div
                    ref={mapRef}
                    className="absolute top-0 left-0"
                    style={{
                        width: "max(100%, 900px)",
                        minHeight: "100%",
                        aspectRatio: "4/3",
                        transform: `translate(${offset.x}px, ${offset.y}px)`,
                        willChange: "transform",
                        touchAction: "none",
                    }}
                >
                    <img
                        src={MAP_URL}
                        alt="Mythara biomes map"
                        draggable={false}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{ objectFit: "cover", objectPosition: "center", userSelect: "none" }}
                    />

                    {/* Subtle overlay */}
                    <div className="absolute inset-0 pointer-events-none"
                        style={{ background: "rgba(4,7,16,0.22)" }} />

                    {/* Vignette */}
                    <div className="absolute inset-0 pointer-events-none"
                        style={{ background: "radial-gradient(ellipse 88% 85% at 50% 50%, transparent 40%, rgba(4,7,16,0.78) 100%)" }} />

                    {/* Sanctum markers */}
                    {SANCTUM_DATA.map(z => {
                        const unlocked = isUnlocked(z);
                        const cleared  = isCleared(z);
                        const sz = "clamp(30px,4vw,46px)";
                        return (
                            <div
                                key={z.id}
                                className="absolute"
                                style={{ left: `${z.px * 100}%`, top: `${z.py * 100}%`, zIndex: 5, pointerEvents: "all" }}
                                onClick={() => openSheet(z)}
                            >
                                {/* Pulse rings — unlocked only */}
                                {unlocked && [0, 0.85].map((delay, ri) => (
                                    <div key={ri} className="absolute rounded-full pointer-events-none" style={{
                                        width: sz, height: sz, top: 0, left: 0,
                                        border: `${ri === 0 ? 1.5 : 1}px solid ${z.color}`,
                                        animation: "smPulse 2.8s ease-out infinite",
                                        animationDelay: `${z.id * 0.3 + delay}s`,
                                        transformOrigin: "center",
                                        transform: "translate(-50%,-50%)",
                                    }} />
                                ))}

                                {/* Icon */}
                                <div
                                    className="flex items-center justify-center rounded-full"
                                    style={{
                                        width: sz, height: sz,
                                        background: "rgba(4,7,16,0.82)",
                                        border: `2px solid ${unlocked ? z.color : "rgba(255,255,255,0.12)"}`,
                                        fontSize: "clamp(12px,2vw,20px)",
                                        boxShadow: unlocked ? `0 0 16px ${z.color}99, inset 0 0 8px rgba(0,0,0,0.6)` : "none",
                                        opacity: unlocked ? 1 : 0.25,
                                        filter: unlocked ? "none" : "grayscale(1)",
                                        position: "relative",
                                        transform: "translate(-50%,-50%)",
                                        cursor: "pointer",
                                        transition: "box-shadow .2s",
                                    }}
                                >
                                    {z.icon}
                                    {cleared && unlocked && (
                                        <div
                                            className="absolute flex items-center justify-center rounded-full font-bold"
                                            style={{
                                                bottom: "-3px", right: "-3px",
                                                width: "clamp(10px,1.2vw,14px)", height: "clamp(10px,1.2vw,14px)",
                                                background: "#4ade80", border: "2px solid #020810",
                                                fontSize: "clamp(6px,.6vw,8px)", color: "#020810", zIndex: 2,
                                            }}
                                        >✓</div>
                                    )}
                                </div>

                                {/* Level badge */}
                                <div
                                    className="absolute font-bold pointer-events-none whitespace-nowrap"
                                    style={{
                                        top: "calc(-50% - 13px)", left: "50%",
                                        transform: "translateX(-50%)",
                                        background: "rgba(4,7,16,0.88)",
                                        border: "1px solid rgba(255,255,255,0.18)",
                                        borderRadius: "8px", padding: "1px 5px",
                                        fontSize: "clamp(7px,.7vw,9px)",
                                        color: unlocked ? "rgba(232,240,254,.55)" : "rgba(232,240,254,.2)",
                                    }}
                                >
                                    Lv{z.requiredLevel}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Drag hint */}
                {hint && (
                    <div
                        className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none font-display uppercase tracking-widest text-center"
                        style={{ zIndex: 8, color: "rgba(232,240,254,.3)", fontSize: "clamp(7px,.72vw,10px)", animation: "hintFade 3s ease-in-out infinite" }}
                    >
                        Drag to explore · Tap a sanctum
                    </div>
                )}

                {/* Scroll hint arrow — mobile only */}
                <div
                    className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none md:hidden"
                    style={{ zIndex: 8, color: "rgba(232,240,254,.3)", fontSize: "22px", animation: "arrowBob 1.5s ease-in-out infinite" }}
                >
                    ›
                </div>

                {/* Bottom sheet / centered modal */}
                {selected && (
                    <>
                        <div
                            className="absolute inset-0 transition-opacity duration-300"
                            style={{ zIndex: 10, background: "rgba(4,7,16,.65)", backdropFilter: "blur(6px)", opacity: sheetOpen ? 1 : 0 }}
                            onClick={closeSheet}
                        />

                        <div
                            className="absolute left-0 right-0 bottom-0 sm-sheet"
                            style={{
                                zIndex: 11,
                                animation: sheetOpen ? "sheetUp .28s cubic-bezier(.34,1.2,.64,1) forwards" : "sheetDn .22s ease-in forwards",
                                background: "#0b1324",
                                borderTop: `2px solid ${selected.color}`,
                                borderRadius: "16px 16px 0 0",
                                boxShadow: `0 -8px 40px ${selected.color}33, 0 -2px 60px rgba(0,0,0,.6)`,
                                overflow: "hidden",
                            }}
                        >
                            {/* Handle (mobile) */}
                            <div className="flex justify-center pt-3 pb-1 md:hidden">
                                <div className="rounded-full" style={{ width: "36px", height: "4px", background: "rgba(255,255,255,.2)" }} />
                            </div>

                            <button
                                onClick={closeSheet}
                                className="absolute top-3 right-3 bg-transparent border-none"
                                style={{ color: "rgba(232,240,254,.25)", fontSize: "16px", cursor: "pointer", lineHeight: 1 }}
                            >✕</button>

                            {/* Sheet header */}
                            <div className="flex items-center gap-3 border-b border-white/[0.07]" style={{ padding: "12px 16px" }}>
                                <div
                                    className="flex-shrink-0 flex items-center justify-center rounded-full"
                                    style={{
                                        width: "48px", height: "48px",
                                        background: "rgba(4,7,16,.85)",
                                        border: `2px solid ${selected.color}`,
                                        fontSize: "22px",
                                        boxShadow: `0 0 18px ${selected.color}55`,
                                    }}
                                >
                                    {selected.icon}
                                </div>
                                <div>
                                    <div className="font-display font-bold text-white text-base">Sanctum {selected.name}</div>
                                    <div className="text-white/40 text-xs mt-0.5">
                                        {selected.biome} biome · Level {selected.requiredLevel} required
                                    </div>
                                </div>
                            </div>

                            {/* Sheet body */}
                            <div className="px-4 py-3">
                                <p
                                    className="italic text-xs leading-relaxed mb-3"
                                    style={{ color: "rgba(232,240,254,.55)", paddingLeft: "9px", borderLeft: `2px solid ${selected.color}` }}
                                >
                                    {selected.lore}
                                </p>

                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
                                    {([
                                        ["Guardian",  selected.guardian],
                                        ["Format",    "3 rounds · 1v1"],
                                        ["Your team", "5 Myths · max 2 swaps"],
                                        ["Healing",   "⚠ None between rounds"],
                                        ["Clears",    `${clearCount(selected)} clear${clearCount(selected) !== 1 ? "s" : ""}`],
                                    ] as [string, string][]).map(([k, v]) => (
                                        <div key={k} className="flex flex-col">
                                            <span className="text-white/30 text-xs">{k}</span>
                                            <span
                                                className="font-bold text-xs"
                                                style={{
                                                    color: k === "Clears" && clearCount(selected) > 0 ? "#4ade80"
                                                         : k === "Healing" ? "#f87171"
                                                         : "#e8f0fe",
                                                }}
                                            >
                                                {v}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {error && (
                                    <div className="mb-2 text-xs text-center font-display" style={{ color: "var(--accent-red)" }}>
                                        ❌ {error}
                                    </div>
                                )}

                                {result && (
                                    <div className={`mb-2 text-center text-sm font-bold font-display py-1.5 rounded-lg
                                        ${result.result === "WIN" ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"}`}>
                                        {result.result === "WIN"
                                            ? `🏆 Victory · +${result.xpGained} XP · +${result.goldGained} 🪙`
                                            : `💀 Defeat · +${result.xpGained} XP`}
                                    </div>
                                )}

                                <div className="pb-safe">
                                    {isUnlocked(selected) ? (
                                        <button
                                            onClick={() => handleChallenge(selected.id)}
                                            disabled={loading}
                                            className="w-full font-display font-bold uppercase tracking-widest text-sm py-3 rounded-xl transition-all disabled:opacity-50 active:scale-95"
                                            style={{
                                                background: selected.color,
                                                color: "#020810",
                                                border: "none",
                                                cursor: loading ? "not-allowed" : "pointer",
                                            }}
                                        >
                                            {loading ? "Loading..." : "⚔️  CHALLENGE SANCTUM"}
                                        </button>
                                    ) : (
                                        <button
                                            disabled
                                            className="w-full font-display font-bold uppercase tracking-widest text-sm py-3 rounded-xl"
                                            style={{
                                                background: "rgba(255,255,255,.05)",
                                                color: "rgba(232,240,254,.22)",
                                                border: "1px solid rgba(255,255,255,.08)",
                                                cursor: "not-allowed",
                                            }}
                                        >
                                            🔒 Level {selected.requiredLevel} required
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
