// apps/client/src/pages/PosadaPage.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import Layout from "../components/Layout";
import TrainerSidebar from "../components/TrainerSidebar";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";

const POSADA_IMAGES = {
    mina: "https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/tavern/mina.avif",
    forja: "https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/tavern/forja.avif",
    laboratorio: "https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/tavern/laboratorio.avif",
    guarderia: "https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/tavern/guarderia.avif",
};

const LAB_ITEMS = [
    { id: "elixir", icon: "⚗️", name: "Elixir", desc: "Restaura el HP máximo de un Myth al instante.", color: "#4cc9f0" },
    { id: "turbo_elixir", icon: "💠", name: "Turbo Elixir", desc: "Duplica la velocidad de entrenamiento en guardería por 1h.", color: "#7b2fff" },
    { id: "antidote", icon: "🧪", name: "Antídoto", desc: "Cura estados alterados (veneno, quemadura, parálisis).", color: "#06d6a0" },
    { id: "boost_atk", icon: "🔥", name: "Potenciador ATK", desc: "Aumenta el ATK de un Myth un 20% durante el próximo combate.", color: "#f97316" },
    { id: "boost_def", icon: "🛡️", name: "Potenciador DEF", desc: "Aumenta la DEF de un Myth un 20% durante el próximo combate.", color: "#3b82f6" },
    { id: "mega_elixir", icon: "✨", name: "Mega Elixir", desc: "Restaura todos los Myths del equipo al 100% de HP.", color: "#fcd34d" },
];

const FRAGMENT_RATES = [
    { rarity: "COMÚN",      pct: "92.00%", color: "#F7FFFB", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.25)" },
    { rarity: "RARO",       pct: "7.00%",  color: "#38bdf8", bg: "rgba(56,189,248,0.08)",  border: "rgba(56,189,248,0.3)"  },
    { rarity: "ÉLITE",      pct: "0.80%",  color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.3)" },
    { rarity: "LEGENDARIO", pct: "0.19%",  color: "#fcd34d", bg: "rgba(252,211,77,0.08)",  border: "rgba(252,211,77,0.3)"  },
    { rarity: "MÍTICO",     pct: "0.01%",  color: "#f472b6", bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.3)" },
];

function msToTime(ms: number) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
    if (m > 0) return `${m}m ${sec.toString().padStart(2, "0")}s`;
    return `${sec}s`;
}

// ─── FIX BUG 1: useCountdown correcto ────────────────────────────────────────
// El intervalo ahora se reinicia cada vez que serverMs cambia.
// Esto evita que el timer arranque desde 0 antes de recibir datos del servidor.
function useCountdown(serverMs: number | null): number {
    const [remaining, setRemaining] = useState<number>(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        // Limpiar intervalo anterior
        if (intervalRef.current) clearInterval(intervalRef.current);

        // Si no hay ms del servidor (null) o es 0, no arrancar countdown
        if (serverMs === null || serverMs === undefined) return;

        setRemaining(serverMs);

        if (serverMs <= 0) return;

        intervalRef.current = setInterval(() => {
            setRemaining(prev => {
                if (prev <= 1000) {
                    clearInterval(intervalRef.current!);
                    return 0;
                }
                return prev - 1000;
            });
        }, 1000);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [serverMs]); // Reiniciar cuando serverMs cambia (nueva carga del servidor)

    return remaining;
}

function ProgressBar({ ms, totalMs, color = "linear-gradient(90deg,#4cc9f0,#7b2fff)" }: {
    ms: number; totalMs: number; color?: string;
}) {
    const pct = totalMs > 0 ? Math.max(2, Math.min(100, ((totalMs - ms) / totalMs) * 100)) : 100;
    return (
        <div className="w-4/5 mx-auto">
            <div className="w-full h-7 bg-white/5 rounded-full overflow-hidden relative">
                <div className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${pct}%`, background: color }} />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-xs font-mono font-bold"
                        style={{ color: "rgba(255,255,255,0.9)", textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
                        {msToTime(ms)}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ─── MINA ─────────────────────────────────────────────────────────────────────
function MineCard() {
    const [mine, setMine] = useState<any>(null);
    const [collecting, setCollecting] = useState(false);
    const [msg, setMsg] = useState("");

    const load = useCallback(async () => {
        try { setMine(await api.mineStatus()); } catch {}
    }, []);

    useEffect(() => { load(); }, [load]);

    async function handleCollect() {
        setCollecting(true); setMsg("");
        try {
            const res = await api.mineCollect();
            // ─── FIX BUG 2: usar campos reales de la respuesta del backend ───
            // Backend devuelve: { collected: { lootItem, lootQuantity, diamondsGained, rockFragmentsGained, xpGained, diamondsFull } }
            const c = res.collected;
            const parts: string[] = [];
            if (c.lootQuantity > 0) parts.push(`+${c.lootQuantity}× ${c.lootItem.replace(/_/g, " ")}`);
            if (c.diamondsGained > 0) parts.push(`+${c.diamondsGained}× BLUE DIAMOND`);
            if (c.rockFragmentsGained > 0) parts.push(`+${c.rockFragmentsGained}× ROCK FRAGMENT`);
            setMsg(parts.join(" · ") || "Recolectado");
            load();
        } catch (e: any) { setMsg(e.message); }
        finally { setCollecting(false); }
    }

    const serverReady = mine?.ready ?? false;
    const serverMs = mine !== null ? (mine.nextCollectMs ?? 0) : null;
    const countdown = useCountdown(serverMs);
    const showButton = serverReady || (mine !== null && countdown === 0);

    return (
        <div className="relative rounded-2xl overflow-hidden flex flex-col" style={{
            border: showButton ? "1px solid rgba(6,214,160,0.4)" : "1px solid rgba(255,255,255,0.07)",
            boxShadow: showButton ? "0 0 24px rgba(6,214,160,0.12)" : "none",
            background: "#0a1520",
        }}>
            <div className="absolute inset-0" style={{
                backgroundImage: `url('${POSADA_IMAGES.mina}')`,
                backgroundSize: "cover", backgroundPosition: "center", opacity: 0.18,
            }} />
            <div className="absolute inset-0" style={{
                background: "linear-gradient(180deg, rgba(10,21,32,0.3) 0%, rgba(10,21,32,0.95) 60%)",
            }} />

            <div className="relative z-10 flex flex-col h-full p-5">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
                            style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.2)" }}>
                            ⛏️
                        </div>
                        <div>
                            <p className="font-bold text-white text-sm leading-tight">Mina</p>
                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Recursos y evoluciones</p>
                        </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        NIV {mine?.level ?? 1}
                    </span>
                </div>

                {/* Diamantes del día */}
                {mine !== null && (
                    <div className="mb-3 flex items-center gap-2">
                        <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
                            💎 {mine.dailyDiamonds ?? 0}/{mine.dailyDiamondCap ?? 15} hoy
                        </span>
                        {mine.diamondsFull && (
                            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full"
                                style={{ background: "rgba(76,201,240,0.12)", color: "#4cc9f0", border: "1px solid rgba(76,201,240,0.25)" }}>
                                LLENO
                            </span>
                        )}
                    </div>
                )}

                <div className="flex-1" />

                {msg && (
                    <p className="text-xs font-mono mb-2 px-2 py-1 rounded-lg text-center"
                        style={{ background: "rgba(6,214,160,0.1)", color: "#06d6a0", border: "1px solid rgba(6,214,160,0.2)" }}>
                        ✅ {msg}
                    </p>
                )}

                {mine === null ? (
                    <div className="w-4/5 mx-auto h-7 bg-white/5 rounded-full animate-pulse" />
                ) : showButton ? (
                    <button onClick={handleCollect} disabled={collecting}
                        className="w-full py-2.5 rounded-xl font-bold text-xs tracking-widest uppercase transition-all disabled:opacity-50 hover:brightness-110"
                        style={{ background: "linear-gradient(135deg,#06d6a0,#04a57a)", color: "#001a12", boxShadow: "0 0 16px rgba(6,214,160,0.3)" }}>
                        {collecting ? "Recogiendo..." : "⛏ Recoger"}
                    </button>
                ) : (
                    <ProgressBar ms={countdown} totalMs={MINE_COOLDOWN_MS[mine.level] ?? 4 * 3600 * 1000}
                        color="linear-gradient(90deg,#fbbf24,#f59e0b)" />
                )}
            </div>
        </div>
    );
}

// Cooldowns espejo del backend (para calcular totalMs de la barra)
const MINE_COOLDOWN_MS: Record<number, number> = { 1: 4*3600*1000, 2: 3*3600*1000, 3: 2*3600*1000, 4: 90*60*1000, 5: 3600*1000 };
const FORGE_COOLDOWN_MS: Record<number, number> = { 1: 6*3600*1000, 2: 5*3600*1000, 3: 4*3600*1000, 4: 3*3600*1000, 5: 2*3600*1000 };
const LAB_COOLDOWN_MS: Record<number, number>   = { 1: 8*3600*1000, 2: 7*3600*1000, 3: 6*3600*1000, 4: 5*3600*1000, 5: 4*3600*1000 };

// ─── FORJA ────────────────────────────────────────────────────────────────────
function ForgeCard() {
    const navigate = useNavigate();
    const [forge, setForge] = useState<any>(null);
    const [fragmentCount, setFragmentCount] = useState<number>(0);
    const [collecting, setCollecting] = useState(false);
    const [msg, setMsg] = useState("");

    const load = useCallback(async () => {
        try {
            const [f, inv] = await Promise.all([api.forgeStatus(), api.inventory()]);
            setForge(f);
            const frag = (inv as any[]).find((i: any) => i.item === "FRAGMENT");
            setFragmentCount(frag?.quantity ?? 0);
        } catch {}
    }, []);

    useEffect(() => { load(); }, [load]);

    async function handleCollect() {
        setCollecting(true); setMsg("");
        try {
            const res = await api.forgeCollect();
            // Backend devuelve: { collected: { fragmentsGained, flameCoresGained, xpGained } }
            const c = res.collected;
            const parts: string[] = [];
            if (c.fragmentsGained > 0) parts.push(`+${c.fragmentsGained}× Fragmento`);
            if (c.flameCoresGained > 0) parts.push(`+${c.flameCoresGained}× Núcleo de Llama`);
            setMsg(parts.join(" · ") || "Recogido");
            load();
        } catch (e: any) { setMsg(e.message); }
        finally { setCollecting(false); }
    }

    const serverReady = forge?.ready ?? false;
    const serverMs = forge !== null ? (forge.nextCollectMs ?? 0) : null;
    const countdown = useCountdown(serverMs);
    const showButton = serverReady || (forge !== null && countdown === 0);

    return (
        <div className="relative rounded-2xl overflow-hidden flex flex-col" style={{
            border: showButton ? "1px solid rgba(76,201,240,0.4)" : "1px solid rgba(255,255,255,0.07)",
            boxShadow: showButton ? "0 0 24px rgba(76,201,240,0.12)" : "none",
            background: "#0a1520",
        }}>
            <div className="absolute inset-0" style={{
                backgroundImage: `url('${POSADA_IMAGES.forja}')`,
                backgroundSize: "cover", backgroundPosition: "center", opacity: 0.18,
            }} />
            <div className="absolute inset-0" style={{
                background: "linear-gradient(180deg, rgba(10,21,32,0.3) 0%, rgba(10,21,32,0.95) 55%)",
            }} />

            <div className="relative z-10 flex flex-col h-full p-5">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
                            style={{ background: "rgba(76,201,240,0.12)", border: "1px solid rgba(76,201,240,0.2)" }}>
                            ◈
                        </div>
                        <div>
                            <p className="font-bold text-white text-sm leading-tight">Forja de Fragmentos</p>
                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Invocación de Myths</p>
                        </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        NIV {forge?.level ?? 1}
                    </span>
                </div>

                {/* Tasas de rareza */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                    {FRAGMENT_RATES.map((r) => (
                        <div key={r.rarity} className="flex flex-col items-center justify-center gap-1 rounded-xl py-2 px-1"
                            style={{ background: r.bg, border: `1px solid ${r.border}`, aspectRatio: "1/1" }}>
                            <span className="text-[10px] font-mono font-bold" style={{ color: r.color }}>{r.pct}</span>
                            <span className="text-[8px] font-mono text-center leading-tight"
                                style={{ color: "rgba(255,255,255,0.4)" }}>{r.rarity}</span>
                        </div>
                    ))}
                </div>

                {/* Fragmento ◈ animado */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="relative flex items-center justify-center w-20 h-20">
                        <div className="absolute inset-0 rounded-full"
                            style={{ background: "radial-gradient(circle,rgba(255,255,255,0.12) 0%,transparent 70%)", animation: "forgeGlow 2.5s ease-in-out infinite" }} />
                        <span className="text-6xl select-none" style={{
                            color: "#ffffff",
                            filter: "drop-shadow(0 0 14px rgba(255,255,255,0.85)) drop-shadow(0 0 30px rgba(76,201,240,0.5))",
                            animation: "forgeFloat 3s ease-in-out infinite",
                        }}>◈</span>
                    </div>
                </div>

                {msg && (
                    <p className="text-xs font-mono mb-2 px-2 py-1 rounded-lg text-center"
                        style={{ background: "rgba(6,214,160,0.1)", color: "#06d6a0", border: "1px solid rgba(6,214,160,0.2)" }}>
                        ✅ {msg}
                    </p>
                )}

                {forge === null ? (
                    <div className="w-4/5 mx-auto h-7 bg-white/5 rounded-full animate-pulse mb-2" />
                ) : showButton ? (
                    <button onClick={handleCollect} disabled={collecting}
                        className="w-full py-2.5 rounded-xl font-bold text-xs tracking-widest uppercase transition-all disabled:opacity-50 hover:brightness-110 mb-2"
                        style={{ background: "linear-gradient(135deg,#06d6a0,#04a57a)", color: "#001a12", boxShadow: "0 0 16px rgba(6,214,160,0.3)" }}>
                        {collecting ? "..." : "Recoger fragmento"}
                    </button>
                ) : (
                    <div className="mb-2">
                        <ProgressBar ms={countdown} totalMs={FORGE_COOLDOWN_MS[forge.level] ?? 6 * 3600 * 1000}
                            color="linear-gradient(90deg,#4cc9f0,#7b2fff)" />
                    </div>
                )}

                {fragmentCount > 0 && (
                    <button onClick={() => navigate("/fragment")}
                        className="w-full py-2.5 rounded-xl font-bold text-xs tracking-widest uppercase transition-all hover:brightness-110"
                        style={{ background: "linear-gradient(135deg,#4cc9f0 0%,#7b2fff 100%)", color: "#fff", boxShadow: "0 0 16px rgba(76,201,240,0.25)" }}>
                        ◈ Abrir fragmentos ({fragmentCount})
                    </button>
                )}
            </div>

            <style>{`
                @keyframes forgeFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
                @keyframes forgeGlow  { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } }
            `}</style>
        </div>
    );
}

// ─── LAB ──────────────────────────────────────────────────────────────────────
function LabCard() {
    const [lab, setLab] = useState<any>(null);
    const [collecting, setCollecting] = useState(false);
    const [msg, setMsg] = useState("");
    const [selectedItem, setSelectedItem] = useState<typeof LAB_ITEMS[0] | null>(null);

    const load = useCallback(async () => {
        try { setLab(await api.labStatus()); } catch {}
    }, []);

    useEffect(() => { load(); }, [load]);

    async function handleCollect() {
        setCollecting(true); setMsg("");
        try {
            const res = await api.labCollect();
            // Backend devuelve: { collected: { elixirsGained, arcaneGearsGained, xpGained } }
            const c = res.collected;
            const parts: string[] = [];
            if (c.elixirsGained > 0) parts.push(`+${c.elixirsGained}× Elixir`);
            if (c.arcaneGearsGained > 0) parts.push(`+${c.arcaneGearsGained}× Engranaje Arcano`);
            setMsg(parts.join(" · ") || "Recogido");
            load();
        } catch (e: any) { setMsg(e.message); }
        finally { setCollecting(false); }
    }

    const serverReady = lab?.ready ?? false;
    const serverMs = lab !== null ? (lab.nextCollectMs ?? 0) : null;
    const countdown = useCountdown(serverMs);
    const showButton = serverReady || (lab !== null && countdown === 0);

    return (
        <>
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
                    onClick={() => setSelectedItem(null)}>
                    <div className="relative rounded-2xl p-6 max-w-xs w-full flex flex-col items-center gap-3"
                        style={{ background: "#0e1e2e", border: `1px solid ${selectedItem.color}40`, boxShadow: `0 0 40px ${selectedItem.color}20` }}
                        onClick={(e) => e.stopPropagation()}>
                        <div className="text-5xl" style={{ filter: `drop-shadow(0 0 12px ${selectedItem.color})` }}>
                            {selectedItem.icon}
                        </div>
                        <p className="font-bold text-white text-lg">{selectedItem.name}</p>
                        <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.5)" }}>{selectedItem.desc}</p>
                        <span className="text-[10px] font-mono px-3 py-1 rounded-full"
                            style={{ background: `${selectedItem.color}15`, color: selectedItem.color, border: `1px solid ${selectedItem.color}30` }}>
                            Próximamente
                        </span>
                        <button onClick={() => setSelectedItem(null)}
                            className="mt-1 text-xs text-white/30 hover:text-white/60 transition-colors">
                            Cerrar ✕
                        </button>
                    </div>
                </div>
            )}

            <div className="relative rounded-2xl overflow-hidden flex flex-col" style={{
                border: showButton ? "1px solid rgba(6,214,160,0.4)" : "1px solid rgba(255,255,255,0.07)",
                boxShadow: showButton ? "0 0 24px rgba(6,214,160,0.12)" : "none",
                background: "#0a1520",
            }}>
                <div className="absolute inset-0" style={{
                    backgroundImage: `url('${POSADA_IMAGES.laboratorio}')`,
                    backgroundSize: "cover", backgroundPosition: "center", opacity: 0.18,
                }} />
                <div className="absolute inset-0" style={{
                    background: "linear-gradient(180deg, rgba(10,21,32,0.3) 0%, rgba(10,21,32,0.95) 50%)",
                }} />

                <div className="relative z-10 flex flex-col h-full p-5">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
                                style={{ background: "rgba(6,214,160,0.12)", border: "1px solid rgba(6,214,160,0.2)" }}>
                                🧪
                            </div>
                            <div>
                                <p className="font-bold text-white text-sm leading-tight">Laboratorio</p>
                                <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Objetos y consumibles</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md"
                            style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                            NIV {lab?.level ?? 1}
                        </span>
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide"
                        style={{ scrollbarWidth: "none" }}>
                        {LAB_ITEMS.map((item) => (
                            <button key={item.id} onClick={() => setSelectedItem(item)}
                                className="flex-shrink-0 flex flex-col items-center gap-1.5 rounded-xl p-2.5 transition-all hover:scale-105 hover:brightness-110"
                                style={{ width: 64, background: `${item.color}10`, border: `1px solid ${item.color}25` }}>
                                <span className="text-2xl" style={{ filter: `drop-shadow(0 0 6px ${item.color}80)` }}>
                                    {item.icon}
                                </span>
                                <span className="text-[9px] font-mono text-center leading-tight"
                                    style={{ color: "rgba(255,255,255,0.5)" }}>
                                    {item.name.split(" ")[0]}
                                </span>
                            </button>
                        ))}
                    </div>

                    <div className="flex-1" />

                    {msg && (
                        <p className="text-xs font-mono mb-2 px-2 py-1 rounded-lg text-center"
                            style={{ background: "rgba(6,214,160,0.1)", color: "#06d6a0", border: "1px solid rgba(6,214,160,0.2)" }}>
                            ✅ {msg}
                        </p>
                    )}

                    {lab === null ? (
                        <div className="w-4/5 mx-auto h-7 bg-white/5 rounded-full animate-pulse" />
                    ) : showButton ? (
                        <button onClick={handleCollect} disabled={collecting}
                            className="w-full py-2.5 rounded-xl font-bold text-xs tracking-widest uppercase transition-all disabled:opacity-50 hover:brightness-110"
                            style={{ background: "linear-gradient(135deg,#06d6a0,#04a57a)", color: "#001a12", boxShadow: "0 0 16px rgba(6,214,160,0.3)" }}>
                            {collecting ? "..." : "🧪 Recoger Elixir"}
                        </button>
                    ) : (
                        <ProgressBar ms={countdown} totalMs={LAB_COOLDOWN_MS[lab.level] ?? 8 * 3600 * 1000}
                            color="linear-gradient(90deg,#06d6a0,#0891b2)" />
                    )}
                </div>
            </div>
        </>
    );
}

// ─── GUARDERÍA ────────────────────────────────────────────────────────────────
function NurseryCard() {
    const [nursery, setNursery] = useState<any>(null);
    const [allMyths, setAllMyths] = useState<any[]>([]);
    const [collecting, setCollecting] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [msg, setMsg] = useState("");

    const load = useCallback(async () => {
        try {
            // ─── FIX BUG 3: cargar nursery y creatures en paralelo ────────────
            // nursery.myth viene del backend con name, art, level ya calculados.
            // allMyths excluye el myth que ya está en nursery y los de nivel max.
            const [n, all] = await Promise.all([api.nurseryStatus(), api.creatures()]);
            setNursery(n);
            const nurseryMythId = n?.myth?.id ?? null;
            setAllMyths((all as any[]).filter((c: any) =>
                c.level < 60 && c.id !== nurseryMythId && !c.inNursery
            ));
        } catch {}
    }, []);

    useEffect(() => { load(); }, [load]);

    async function handleAssign(creatureId: string) {
        setAssigning(true); setShowPicker(false);
        try {
            await api.nurseryAssign(creatureId);
            setMsg("Myth asignado");
            await load(); // Esperar a que se recargue para que el Myth aparezca
        } catch (e: any) { setMsg(e.message); }
        finally { setAssigning(false); }
    }

    async function handleCollect() {
        setCollecting(true); setMsg("");
        try {
            const res = await api.nurseryCollect();
            setMsg(`⬆ ${res.myth?.name ?? res.myth?.speciesId ?? "Myth"} → Nv. ${res.newLevel}`);
            await load();
        } catch (e: any) { setMsg(e.message); }
        finally { setCollecting(false); }
    }

    async function handleRemove() {
        try {
            await api.nurseryRemove();
            setMsg("Myth devuelto al almacén");
            await load();
        } catch (e: any) { setMsg(e.message); }
    }

    const hasMyth = !!nursery?.myth;
    const serverReady = nursery?.ready ?? false;
    // ─── FIX: nextCollectMs puede ser null cuando no hay myth o es maxLevel ──
    const serverMs = nursery !== null && nursery.nextCollectMs !== null && nursery.nextCollectMs !== undefined
        ? nursery.nextCollectMs
        : null;
    const isMaxLevel = nursery?.maxLevel ?? false;
    const countdown = useCountdown(serverMs);
    const showButton = serverReady || (nursery !== null && hasMyth && !isMaxLevel && serverMs !== null && countdown === 0);

    const inParty = allMyths.filter((c) => c.isInParty);
    const inStorage = allMyths.filter((c) => !c.isInParty);

    // Art helper: el backend devuelve art como objeto { portrait, front, back }
    // donde cada campo es un emoji string, o directamente un string
    function mythArt(myth: any): string {
        if (!myth?.art) return "❓";
        if (typeof myth.art === "string") return myth.art;
        return myth.art.front ?? myth.art.portrait ?? "❓";
    }

    return (
        <div className="relative rounded-2xl overflow-hidden flex flex-col" style={{
            border: showButton ? "1px solid rgba(255,214,10,0.4)" : "1px solid rgba(255,255,255,0.07)",
            boxShadow: showButton ? "0 0 24px rgba(255,214,10,0.1)" : "none",
            background: "#0a1520",
        }}>
            <div className="absolute inset-0" style={{
                backgroundImage: `url('${POSADA_IMAGES.guarderia}')`,
                backgroundSize: "cover", backgroundPosition: "center", opacity: 0.18,
            }} />
            <div className="absolute inset-0" style={{
                background: "linear-gradient(180deg, rgba(10,21,32,0.3) 0%, rgba(10,21,32,0.95) 55%)",
            }} />

            <div className="relative z-10 flex flex-col h-full p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl"
                            style={{ background: "rgba(255,214,10,0.12)", border: "1px solid rgba(255,214,10,0.2)" }}>
                            🥚
                        </div>
                        <div>
                            <p className="font-bold text-white text-sm leading-tight">Guardería</p>
                            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Entrena tu Myth</p>
                        </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md"
                        style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        NIV {nursery?.level ?? 1}
                    </span>
                </div>

                {/* Loading skeleton */}
                {nursery === null && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="w-16 h-16 rounded-full bg-white/5 animate-pulse" />
                    </div>
                )}

                {/* Sin Myth */}
                {nursery !== null && !hasMyth && (
                    <>
                        <div className="flex-1 flex flex-col items-center justify-center gap-3">
                            <div className="text-5xl opacity-30 select-none">🥚</div>
                            <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.35)" }}>
                                Ningún Myth en entrenamiento
                            </p>
                            <button
                                onClick={() => setShowPicker(true)}
                                disabled={assigning}
                                className="px-4 py-2 rounded-xl font-bold text-xs tracking-widest uppercase transition-all hover:brightness-110 disabled:opacity-50"
                                style={{ background: "linear-gradient(135deg,#ffd60a,#e6a800)", color: "#1a0f00" }}>
                                {assigning ? "Asignando..." : "Asignar Myth"}
                            </button>
                        </div>

                        {showPicker && (
                            <div className="mt-3 rounded-xl overflow-hidden"
                                style={{ border: "1px solid rgba(255,214,10,0.2)", background: "rgba(255,214,10,0.04)" }}>
                                <p className="text-[10px] font-mono px-3 py-2 border-b"
                                    style={{ color: "rgba(255,255,255,0.4)", borderColor: "rgba(255,214,10,0.15)" }}>
                                    SELECCIONA UN MYTH
                                </p>
                                <div className="max-h-40 overflow-y-auto">
                                    {allMyths.length === 0 && (
                                        <p className="text-xs text-center py-3" style={{ color: "rgba(255,255,255,0.3)" }}>
                                            Sin Myths disponibles
                                        </p>
                                    )}
                                    {inParty.length > 0 && (
                                        <>
                                            <p className="text-[9px] font-mono px-3 py-1"
                                                style={{ color: "rgba(255,255,255,0.25)" }}>EQUIPO</p>
                                            {inParty.map((c: any) => (
                                                <button key={c.id}
                                                    onClick={() => handleAssign(c.id)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left">
                                                    <span className="text-xl">{mythArt(c)}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-white truncate">{c.name ?? c.speciesId}</p>
                                                        <p className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
                                                            Nv. {c.level}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))}
                                        </>
                                    )}
                                    {inStorage.length > 0 && (
                                        <>
                                            <p className="text-[9px] font-mono px-3 py-1"
                                                style={{ color: "rgba(255,255,255,0.25)" }}>ALMACÉN</p>
                                            {inStorage.map((c: any) => (
                                                <button key={c.id}
                                                    onClick={() => handleAssign(c.id)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left">
                                                    <span className="text-xl">{mythArt(c)}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-white truncate">{c.name ?? c.speciesId}</p>
                                                        <p className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>
                                                            Nv. {c.level}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                                <button onClick={() => setShowPicker(false)}
                                    className="w-full py-2 text-[10px] font-mono transition-colors hover:bg-white/5"
                                    style={{ color: "rgba(255,255,255,0.3)", borderTop: "1px solid rgba(255,214,10,0.1)" }}>
                                    Cancelar ✕
                                </button>
                            </div>
                        )}
                    </>
                )}

                {/* Con Myth asignado */}
                {nursery !== null && hasMyth && !isMaxLevel && (
                    <>
                        <div className="flex-1 flex flex-col items-center justify-center relative mb-3">
                            <div className="absolute rounded-full"
                                style={{
                                    width: 120, height: 120,
                                    background: "radial-gradient(circle, rgba(255,214,10,0.15) 0%, transparent 70%)",
                                    animation: "nurseryPulse 2.5s ease-in-out infinite",
                                }} />
                            <div className="absolute rounded-full"
                                style={{
                                    width: 80, height: 80,
                                    background: "radial-gradient(circle, rgba(255,214,10,0.25) 0%, transparent 70%)",
                                    animation: "nurseryPulse 2.5s ease-in-out infinite 0.4s",
                                }} />
                            <div className="relative z-10 text-7xl select-none"
                                style={{
                                    filter: "drop-shadow(0 0 16px rgba(255,214,10,0.6)) drop-shadow(0 0 32px rgba(255,214,10,0.3))",
                                    animation: "nurseryFloat 3s ease-in-out infinite",
                                }}>
                                {mythArt(nursery.myth)}
                            </div>
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="absolute rounded-full pointer-events-none"
                                    style={{
                                        width: 4, height: 4,
                                        background: "#ffd60a",
                                        boxShadow: "0 0 6px #ffd60a",
                                        left: `${30 + i * 13}%`,
                                        animation: `nurseryXP 2s ease-in-out infinite ${i * 0.5}s`,
                                    }} />
                            ))}
                        </div>

                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="font-bold text-sm" style={{ color: "#ffd60a" }}>
                                    {nursery.myth.name ?? nursery.myth.speciesId}
                                </p>
                                <p className="text-[11px] font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
                                    Nv. {nursery.myth.level} → {nursery.myth.level + 1}
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                {showButton && (
                                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                                        style={{ background: "rgba(255,214,10,0.15)", color: "#ffd60a", border: "1px solid rgba(255,214,10,0.3)" }}>
                                        ⚡ Listo
                                    </span>
                                )}
                                <button onClick={handleRemove}
                                    className="text-[9px] font-mono hover:text-white/60 transition-colors"
                                    style={{ color: "rgba(255,255,255,0.2)" }}>
                                    retirar ✕
                                </button>
                            </div>
                        </div>

                        {msg && (
                            <p className="text-xs font-mono mb-2 px-2 py-1 rounded-lg text-center"
                                style={{ background: "rgba(6,214,160,0.1)", color: "#06d6a0", border: "1px solid rgba(6,214,160,0.2)" }}>
                                {msg}
                            </p>
                        )}

                        {showButton ? (
                            <button onClick={handleCollect} disabled={collecting}
                                className="w-full py-2.5 rounded-xl font-bold text-xs tracking-widest uppercase transition-all disabled:opacity-50 hover:brightness-110"
                                style={{ background: "linear-gradient(135deg,#ffd60a,#e6a800)", color: "#1a0f00", boxShadow: "0 0 16px rgba(255,214,10,0.3)" }}>
                                {collecting ? "..." : "⬆ Subir nivel"}
                            </button>
                        ) : serverMs !== null ? (
                            <ProgressBar ms={countdown} totalMs={nursery.currentLevelCooldownMs ?? serverMs}
                                color="linear-gradient(90deg,#ffd60a,#f59e0b)" />
                        ) : null}
                    </>
                )}

                {/* Myth a nivel máximo */}
                {nursery !== null && hasMyth && isMaxLevel && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2">
                        <div className="text-5xl" style={{ filter: "drop-shadow(0 0 12px rgba(255,214,10,0.6))" }}>
                            {mythArt(nursery.myth)}
                        </div>
                        <p className="text-xs font-bold" style={{ color: "#ffd60a" }}>🏆 Nivel máximo (60)</p>
                        <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                            {nursery.myth.name ?? nursery.myth.speciesId}
                        </p>
                        <button onClick={handleRemove}
                            className="mt-2 text-[10px] font-mono px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                            style={{ color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            Retirar al almacén
                        </button>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes nurseryPulse {
                    0%,100% { transform: scale(1); opacity: 0.6; }
                    50%      { transform: scale(1.15); opacity: 1; }
                }
                @keyframes nurseryFloat {
                    0%,100% { transform: translateY(0px); }
                    50%     { transform: translateY(-8px); }
                }
                @keyframes nurseryXP {
                    0%   { transform: translateY(0px); opacity: 0; }
                    30%  { opacity: 1; }
                    100% { transform: translateY(-40px); opacity: 0; }
                }
            `}</style>
        </div>
    );
}

// ─── PÁGINA ───────────────────────────────────────────────────────────────────
export default function PosadaPage() {
    const [inventory, setInventory] = useState<any[]>([]);

    useEffect(() => {
        api.inventory().then(setInventory).catch(() => {});
    }, []);

    return (
        <Layout sidebar={<TrainerSidebar />}>
            <style>{`
                .scrollbar-hide::-webkit-scrollbar { display: none; }
            `}</style>

            <div className="flex-shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
                <h1 className="font-display font-bold text-2xl tracking-widest">
                    Mi <span className="text-red">Posada</span>
                </h1>
                <div className="flex gap-2">
                    {inventory.slice(0, 4).map((item: any) => (
                        <div key={item.item}
                            className="bg-bg3 border border-border rounded-lg px-2 py-1 flex items-center gap-1 text-xs">
                            <span className="text-yellow font-bold font-display">{item.quantity}</span>
                            <span className="text-muted">{item.item.replace(/_/g, " ")}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 p-5 grid grid-cols-2 grid-rows-2 gap-4 overflow-hidden">
                <MineCard />
                <ForgeCard />
                <LabCard />
                <NurseryCard />
            </div>
        </Layout>
    );
}
