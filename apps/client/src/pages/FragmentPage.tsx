import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import TrainerSidebar from "../components/TrainerSidebar";
import { api } from "../lib/api";
import { useTrainer } from "../context/TrainerContext";

const RARITY_CONFIG: Record<
    string,
    {
        label: string;
        color: string;
        glow: string;
        bg: string;
        border: string;
        particles: number;
        particleColor: string;
    }
> = {
    COMMON: {
        label: "Común",
        color: "text-slate-300",
        glow: "#F7FFFB",
        bg: "bg-slate-700/40",
        border: "border-slate-500",
        particles: 8,
        particleColor: "#F7FFFB",
    },
    RARE: {
        label: "Raro",
        color: "text-sky-300",
        glow: "#38bdf8",
        bg: "bg-sky-800/30",
        border: "border-sky-500",
        particles: 14,
        particleColor: "#38bdf8",
    },
    ELITE: {
        label: "Élite",
        color: "text-violet-300",
        glow: "#a78bfa",
        bg: "bg-violet-800/30",
        border: "border-violet-400",
        particles: 18,
        particleColor: "#a78bfa",
    },
    LEGENDARY: {
        label: "Legendario",
        color: "text-yellow-300",
        glow: "#fcd34d",
        bg: "bg-yellow-700/20",
        border: "border-yellow-400",
        particles: 24,
        particleColor: "#fcd34d",
    },
    MYTHIC: {
        label: "Mítico",
        color: "text-pink-300",
        glow: "#f472b6",
        bg: "bg-pink-800/20",
        border: "border-pink-400",
        particles: 30,
        particleColor: "#f472b6",
    },
};

type OpenPhase = "idle" | "hover" | "shaking" | "opening" | "revealed";

export default function FragmentPage() {
    const navigate = useNavigate();

    const [phase, setPhase] = useState<OpenPhase>("idle");
    const [creature, setCreature] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [particles, setParticles] = useState<{ x: number; y: number; delay: number; size: number }[]>([]);
    const { fragments: ctxFragments, reload } = useTrainer();
    const [fragments, setFragments] = useState<number>(0);

    useEffect(() => {
        setFragments(ctxFragments ?? 0);
    }, [ctxFragments]);

    async function handleOpen() {
        if (fragments <= 0 || loading || phase !== "idle") return;
        setLoading(true);
        setPhase("hover");

        await sleep(200);
        setPhase("shaking");
        await sleep(900);
        setPhase("opening");
        await sleep(600);

        try {
            const result = await api.forgeOpen();
            setCreature(result);
            reload(); // el contexto actualiza fragments solo desde el servidor
            // Generar partículas
            const cfg = RARITY_CONFIG[result.rarity ?? "COMMON"];
            const pts = Array.from({ length: cfg.particles }, (_, i) => ({
                x: 40 + Math.random() * 20,
                y: 40 + Math.random() * 20,
                delay: i * 40,
                size: 4 + Math.random() * 8,
            }));
            setParticles(pts);

            await sleep(300);
            setPhase("revealed");
        } catch (e: any) {
            alert(e.message ?? "Error al abrir fragmento");
            setPhase("idle");
        } finally {
            setLoading(false);
        }
    }

    function handleOpenAnother() {
        setCreature(null);
        setPhase("idle");
        setParticles([]);
    }

    function sleep(ms: number) {
        return new Promise<void>((r) => setTimeout(r, ms));
    }

    const cfg = creature ? (RARITY_CONFIG[creature.rarity ?? "COMMON"] ?? RARITY_CONFIG.COMMON) : null;

    return (
        <Layout sidebar={<TrainerSidebar />}>
            <style>{`
                @keyframes fragmentFloat {
                    0%,100% { transform: translateY(0px) rotate(-2deg); }
                    50%     { transform: translateY(-10px) rotate(2deg); }
                }
                @keyframes fragmentShake {
                    0%,100% { transform: translateX(0) rotate(0deg); }
                    15%     { transform: translateX(-8px) rotate(-4deg); }
                    30%     { transform: translateX(8px) rotate(4deg); }
                    45%     { transform: translateX(-6px) rotate(-3deg); }
                    60%     { transform: translateX(6px) rotate(3deg); }
                    75%     { transform: translateX(-3px) rotate(-1deg); }
                    90%     { transform: translateX(3px) rotate(1deg); }
                }
                @keyframes fragmentOpen {
                    0%   { transform: scale(1) rotate(0deg); opacity:1; }
                    40%  { transform: scale(1.3) rotate(-10deg); opacity:0.9; filter: brightness(3); }
                    70%  { transform: scale(1.8) rotate(15deg); opacity:0.6; filter: brightness(5); }
                    100% { transform: scale(2.2) rotate(0deg); opacity:0; filter: brightness(8); }
                }
                @keyframes revealPop {
                    0%   { opacity:0; transform: scale(0.4) translateY(20px); }
                    60%  { opacity:1; transform: scale(1.08) translateY(-4px); }
                    80%  { transform: scale(0.96) translateY(2px); }
                    100% { opacity:1; transform: scale(1) translateY(0); }
                }
                @keyframes glowPulse {
                    0%,100% { opacity:0.5; transform: scale(1); }
                    50%     { opacity:1; transform: scale(1.08); }
                }
                @keyframes particle {
                    0%   { opacity:1; transform: translate(0,0) scale(1); }
                    100% { opacity:0; transform: translate(var(--tx), var(--ty)) scale(0.2); }
                }
                @keyframes statsSlide {
                    from { opacity:0; transform: translateY(8px); }
                    to   { opacity:1; transform: translateY(0); }
                }
                .anim-float   { animation: fragmentFloat 3s ease-in-out infinite; }
                .anim-shake   { animation: fragmentShake 0.9s ease-in-out; }
                .anim-open    { animation: fragmentOpen 0.8s cubic-bezier(0.4,0,1,1) forwards; }
                .anim-reveal  { animation: revealPop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards; }
                .anim-glow    { animation: glowPulse 2s ease-in-out infinite; }
                .anim-stats   { animation: statsSlide 0.4s ease-out both; }
            `}</style>

            <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
                {/* ── Estado idle / animación ── */}
                {phase !== "revealed" && (
                    <div className="flex flex-col items-center gap-8 w-full max-w-sm">
                        {/* Fragmento grande animado */}
                        <div className="relative flex items-center justify-center h-52 w-52">
                            {/* Halo */}
                            <div
                                className="absolute inset-0 rounded-full opacity-20"
                                style={{ background: "radial-gradient(circle, #818cf8 0%, transparent 70%)" }}
                            />

                            {/* El fragmento */}
                            <div
                                className={`relative z-10 text-9xl select-none
                                    ${phase === "idle" ? "anim-float" : ""}
                                    ${phase === "hover" ? "anim-float" : ""}
                                    ${phase === "shaking" ? "anim-shake" : ""}
                                    ${phase === "opening" ? "anim-open" : ""}
                                `}
                                style={{
                                    filter:
                                        phase === "idle"
                                            ? "drop-shadow(0 0 20px rgba(129,140,248,0.5))"
                                            : phase === "shaking"
                                              ? "drop-shadow(0 0 30px rgba(129,140,248,0.9)) brightness(1.3)"
                                              : phase === "opening"
                                                ? "drop-shadow(0 0 50px white) brightness(3)"
                                                : "drop-shadow(0 0 20px rgba(129,140,248,0.5))",
                                }}
                            >
                                ◈
                            </div>
                        </div>

                        {/* Botones abrir */}
                        <div className="flex items-center gap-4 w-full">
                            {/* Botón abrir — flex-1 para que ocupe el espacio */}
                            <button
                                onClick={handleOpen}
                                disabled={fragments <= 0 || loading || phase !== "idle"}
                                className={`flex-1 flex flex-col items-center py-3 rounded-xl font-mono font-black
                                    text-sm tracking-widest uppercase transition-all
                                    ${
                                        fragments > 0 && phase === "idle"
                                            ? "bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 shadow-lg shadow-indigo-900/60"
                                            : "bg-slate-800 text-slate-600 cursor-not-allowed"
                                    }`}
                            >
                                <span>{loading ? "Abriendo..." : "◈ Abrir fragmento"}</span>
                                <span
                                    className={`text-xs mt-0.5 font-normal
                                    ${fragments > 0 ? "text-indigo-300" : "text-slate-600"}`}
                                >
                                    {fragments} disponible{fragments !== 1 ? "s" : ""}
                                </span>
                            </button>
                        </div>

                        {fragments === 0 && (
                            <p className="text-slate-600 text-xs font-mono text-center -mt-4">
                                Recoge más fragmentos en la Forja
                            </p>
                        )}
                    </div>
                )}

                {/* ── Reveal ── */}
                {phase === "revealed" && creature && cfg && (
                    <div className="flex flex-col items-center gap-6 w-full max-w-md">
                        {/* Partículas */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            {particles.map((p, i) => (
                                <div
                                    key={i}
                                    className="absolute rounded-full"
                                    style={{
                                        width: p.size,
                                        height: p.size,
                                        left: `${p.x}%`,
                                        top: `${p.y}%`,
                                        background: cfg.particleColor,
                                        boxShadow: `0 0 ${p.size * 2}px ${cfg.particleColor}`,
                                        animation: `particle 1.2s ease-out ${p.delay}ms forwards`,
                                        ["--tx" as any]: `${(Math.random() - 0.5) * 200}px`,
                                        ["--ty" as any]: `${(Math.random() - 0.5) * 200}px`,
                                    }}
                                />
                            ))}
                        </div>

                        {/* Tarjeta del Myth revelado */}
                        <div className="anim-reveal relative">
                            {/* Halo de rareza */}
                            <div
                                className="absolute -inset-6 rounded-full anim-glow pointer-events-none"
                                style={{ background: `radial-gradient(circle, ${cfg.glow}30 0%, transparent 70%)` }}
                            />

                            <div
                                className={`relative z-10 flex flex-col items-center gap-3 p-6 rounded-2xl border-2
                                ${cfg.bg} ${cfg.border}`}
                                style={{ boxShadow: `0 0 40px ${cfg.glow}40, 0 0 80px ${cfg.glow}20` }}
                            >
                                {/* Arte del Myth — grande */}
                                <div className="text-8xl" style={{ filter: `drop-shadow(0 0 16px ${cfg.glow})` }}>
                                    {creature.art?.front ?? "❓"}
                                </div>

                                {/* Badge rareza */}
                                <span
                                    className={`px-3 py-1 rounded-full text-xs font-mono font-black uppercase tracking-widest
                                    ${cfg.color} border ${cfg.border}`}
                                    style={{ boxShadow: `0 0 12px ${cfg.glow}60` }}
                                >
                                    {cfg.label}
                                </span>

                                <div className="text-center">
                                    <p className={`font-mono font-black text-xl tracking-widest ${cfg.color}`}>
                                        {creature.name}
                                    </p>
                                    <p className="text-slate-500 text-xs font-mono mt-1">
                                        #{creature.speciesId} · Nv.{creature.level ?? 5}
                                    </p>
                                </div>

                                {/* Affinities */}
                                {creature.affinities?.length > 0 && (
                                    <div className="flex gap-2">
                                        {creature.affinities.map((a: string) => (
                                            <span
                                                key={a}
                                                className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono"
                                            >
                                                {a}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Stats */}
                                <div
                                    className="anim-stats grid grid-cols-3 gap-3 mt-1 w-full"
                                    style={{ animationDelay: "200ms" }}
                                >
                                    {[
                                        { label: "HP", value: creature.hp ?? creature.maxHp },
                                        { label: "ATK", value: creature.attack },
                                        { label: "DEF", value: creature.defense },
                                    ].map((s) => (
                                        <div key={s.label} className="flex flex-col items-center gap-0.5">
                                            <p className="text-slate-500 text-xs font-mono uppercase">{s.label}</p>
                                            <p className={`font-mono font-black text-sm ${cfg.color}`}>
                                                {s.value ?? "—"}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <p className="text-slate-500 text-xs font-mono italic text-center mt-1">
                                    Guardado en el almacén
                                </p>
                            </div>
                        </div>

                        {/* Botones post-reveal */}
                        <div className="flex items-center gap-4 w-full anim-stats" style={{ animationDelay: "400ms" }}>
                            <button
                                onClick={handleOpenAnother}
                                disabled={fragments <= 0}
                                className={`flex-1 flex flex-col items-center py-3 rounded-xl font-mono font-black
                                    text-sm tracking-widest uppercase transition-all
                                    ${
                                        fragments > 0
                                            ? "bg-indigo-600 text-white hover:bg-indigo-500 hover:scale-105 shadow-lg shadow-indigo-900/60"
                                            : "bg-slate-800 text-slate-600 cursor-not-allowed"
                                    }`}
                            >
                                <span>◈ Abrir otro</span>
                                <span
                                    className={`text-xs mt-0.5 font-normal ${fragments > 0 ? "text-indigo-300" : "text-slate-600"}`}
                                >
                                    {fragments} disponible{fragments !== 1 ? "s" : ""}
                                </span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
