// apps/client/src/pages/OutpostPage.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import PageTopbar from "../components/PageTopbar";

const IMAGES = {
    mine:    "https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/tavern/mina.avif",
    lab:     "https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/tavern/laboratorio.avif",
    nursery: "https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/tavern/guarderia.avif",
};

const LAB_ITEMS = [
    { id: "elixir",       icon: "⚗️", name: "Elixir",       desc: "Restores a Myth's HP to full.",            color: "var(--accent-blue)" },
    { id: "turbo_elixir", icon: "💠", name: "Turbo Elixir", desc: "2× nursery speed for 1h.",                 color: "var(--accent-purple)" },
    { id: "antidote",     icon: "🧪", name: "Antidote",     desc: "Cures poison, burn & paralysis.",           color: "var(--accent-green)" },
    { id: "boost_atk",    icon: "🔥", name: "ATK Boost",    desc: "+20% ATK for next battle.",                 color: "#f97316" },
    { id: "boost_def",    icon: "🛡️", name: "DEF Boost",    desc: "+20% DEF for next battle.",                 color: "#3b82f6" },
    { id: "mega_elixir",  icon: "✨", name: "Mega Elixir",  desc: "Full HP restore for entire team.",          color: "#fcd34d" },
];

const MINE_DROPS = [
    { icon: "💎", label: "Diamonds",       note: "up to 15/day" },
    { icon: "🪨", label: "Rock Fragments", note: "crafting material" },
    { icon: "🪙", label: "Gold",           note: "bonus on collect" },
];

const MINE_CD: Record<number, number> = { 1: 4*3600e3, 2: 3*3600e3, 3: 2*3600e3, 4: 90*60e3, 5: 3600e3 };
const LAB_CD:  Record<number, number> = { 1: 8*3600e3, 2: 7*3600e3, 3: 6*3600e3, 4: 5*3600e3, 5: 4*3600e3 };

function msToTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2,"0")}m`;
    if (m > 0) return `${m}m ${String(sec).padStart(2,"0")}s`;
    return `${sec}s`;
}

function mythArtUrl(myth: any): string {
    if (!myth?.art) return "";
    if (typeof myth.art === "string") return myth.art;
    return myth.art.front ?? myth.art.portrait ?? "";
}

function useCountdown(serverMs: number | null): number {
    const [rem, setRem] = useState(0);
    const ref = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        if (ref.current) clearInterval(ref.current);
        if (serverMs === null) return;
        setRem(serverMs);
        if (serverMs <= 0) return;
        ref.current = setInterval(() => {
            setRem(p => { if (p <= 1000) { clearInterval(ref.current!); return 0; } return p - 1000; });
        }, 1000);
        return () => { if (ref.current) clearInterval(ref.current); };
    }, [serverMs]);
    return rem;
}

function useCollectFlash(): [boolean, () => void] {
    const [flash, setFlash] = useState(false);
    const trigger = useCallback(() => { setFlash(true); setTimeout(() => setFlash(false), 900); }, []);
    return [flash, trigger];
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ ms, totalMs, color }: { ms: number; totalMs: number; color: string }) {
    const pct = totalMs > 0 ? Math.max(2, Math.min(100, ((totalMs - ms) / totalMs) * 100)) : 100;
    return (
        <div className="w-full h-9 rounded-2xl overflow-hidden relative"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-2xl transition-all duration-1000" style={{ width: `${pct}%`, background: color }} />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-xs font-mono font-bold"
                    style={{ color: "var(--text-secondary)", textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
                    {msToTime(ms)}
                </span>
            </div>
        </div>
    );
}

// ─── SVG art ──────────────────────────────────────────────────────────────────
function MineArt() {
    return (
        <svg viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
                <radialGradient id="mg" cx="50%" cy="60%" r="65%">
                    <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.3"/>
                    <stop offset="100%" stopColor="#070b14" stopOpacity="0"/>
                </radialGradient>
            </defs>
            <rect width="300" height="180" fill="url(#mg)"/>
            <path d="M30 150 L30 80 L55 60 L90 65 L130 52 L170 60 L210 54 L250 68 L270 150 Z"
                fill="rgba(251,191,36,0.05)" stroke="rgba(251,191,36,0.18)" strokeWidth="1"/>
            {[[80,95],[120,75],[165,82],[210,105]].map(([x,y],i) => (
                <polygon key={i} points={`${x},${y-9} ${x+7},${y} ${x},${y+9} ${x-7},${y}`}
                    fill={`rgba(76,201,240,${0.4+i*0.08})`} stroke="rgba(76,201,240,0.7)" strokeWidth="0.8"/>
            ))}
            {/* Pickaxe */}
            <line x1="140" y1="128" x2="168" y2="100" stroke="rgba(251,191,36,0.5)" strokeWidth="5" strokeLinecap="round"/>
            <path d="M162 92 Q178 80 190 90 Q184 106 168 103 Z" fill="rgba(251,191,36,0.55)"/>
            {[162,172,178].map((x,i) => <circle key={i} cx={x} cy={90+i*4} r="2" fill={`rgba(251,191,36,${0.7+i*0.1})`}/>)}
            {[[30,35],[270,28],[18,115],[282,120],[150,18]].map(([x,y],i) => (
                <circle key={i} cx={x} cy={y} r="2" fill={`rgba(76,201,240,${0.18+i*0.06})`}/>
            ))}
        </svg>
    );
}

function LabArt() {
    return (
        <svg viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
                <radialGradient id="la" cx="50%" cy="50%" r="60%">
                    <stop offset="0%" stopColor="#06d6a0" stopOpacity="0.22"/>
                    <stop offset="100%" stopColor="#070b14" stopOpacity="0"/>
                </radialGradient>
            </defs>
            <rect width="300" height="180" fill="url(#la)"/>
            {/* Main flask */}
            <path d="M125 50 L125 100 L95 140 L205 140 L175 100 L175 50 Z"
                fill="rgba(6,214,160,0.06)" stroke="rgba(6,214,160,0.28)" strokeWidth="1.5"/>
            <path d="M100 128 Q108 118 150 120 Q192 118 200 128 L205 140 L95 140 Z"
                fill="rgba(6,214,160,0.2)"/>
            {[[140,108],[155,102],[145,118]].map(([x,y],i) => (
                <circle key={i} cx={x} cy={y} r={2.5+i*0.5} fill="none"
                    stroke={`rgba(6,214,160,${0.5+i*0.1})`} strokeWidth="1.2"/>
            ))}
            {/* Side tubes */}
            <rect x="215" y="65" width="14" height="48" rx="7" fill="rgba(76,201,240,0.07)" stroke="rgba(76,201,240,0.35)" strokeWidth="1"/>
            <rect x="235" y="78" width="14" height="35" rx="7" fill="rgba(167,139,250,0.07)" stroke="rgba(167,139,250,0.35)" strokeWidth="1"/>
            <rect x="52" y="72" width="14" height="40" rx="7" fill="rgba(249,115,22,0.07)" stroke="rgba(249,115,22,0.35)" strokeWidth="1"/>
            {/* Cork */}
            <rect x="122" y="43" width="56" height="11" rx="4" fill="rgba(6,214,160,0.18)" stroke="rgba(6,214,160,0.35)" strokeWidth="1"/>
            {[[25,30],[275,25],[18,145],[282,140],[150,15]].map(([x,y],i) => (
                <circle key={i} cx={x} cy={y} r="1.8" fill={`rgba(6,214,160,${0.14+i*0.05})`}/>
            ))}
        </svg>
    );
}

function NurseryArt() {
    return (
        <svg viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <defs>
                <radialGradient id="na" cx="50%" cy="55%" r="60%">
                    <stop offset="0%" stopColor="#ffd60a" stopOpacity="0.28"/>
                    <stop offset="100%" stopColor="#070b14" stopOpacity="0"/>
                </radialGradient>
            </defs>
            <rect width="300" height="180" fill="url(#na)"/>
            <circle cx="150" cy="92" r="58" fill="none" stroke="rgba(255,214,10,0.06)" strokeWidth="1.5"/>
            <circle cx="150" cy="92" r="42" fill="none" stroke="rgba(255,214,10,0.1)" strokeWidth="1.5"/>
            <circle cx="150" cy="92" r="26" fill="rgba(255,214,10,0.06)" stroke="rgba(255,214,10,0.22)" strokeWidth="1.5"/>
            {[[100,48],[202,42],[88,128],[215,135],[148,22],[152,162]].map(([x,y],i) => (
                <polygon key={i}
                    points={`${x},${y-5} ${x+2},${y-2} ${x+6},${y-2} ${x+3},${y+1} ${x+4},${y+6} ${x},${y+3} ${x-4},${y+6} ${x-3},${y+1} ${x-6},${y-2} ${x-2},${y-2}`}
                    fill={`rgba(255,214,10,${0.18+i*0.05})`}/>
            ))}
            <path d="M144 128 L144 142 L156 142 L156 128 L163 128 L150 114 L137 128 Z"
                fill="rgba(255,214,10,0.3)"/>
        </svg>
    );
}

// ─── Card shell ───────────────────────────────────────────────────────────────
function CardShell({ accent, image, ArtComponent, flash, ready, children }: {
    accent: string; image: string; ArtComponent: () => JSX.Element;
    flash: boolean; ready: boolean; children: React.ReactNode;
}) {
    const rgb = accent.replace('#','');
    const r = parseInt(rgb.slice(0,2),16);
    const g = parseInt(rgb.slice(2,4),16);
    const b = parseInt(rgb.slice(4,6),16);
    return (
        <div className="relative flex flex-col overflow-hidden rounded-2xl h-full group"
            style={{
                border: ready ? `1px solid ${accent}66` : "1px solid rgba(255,255,255,0.07)",
                boxShadow: flash
                    ? `0 0 80px ${accent}70, 0 0 160px ${accent}30`
                    : ready ? `0 0 32px ${accent}22` : "none",
                background: "#060e1a",
                transition: "box-shadow 0.4s ease",
            }}>
            {/* Flash overlay */}
            {flash && (
                <div className="absolute inset-0 z-20 pointer-events-none rounded-2xl"
                    style={{ background: `radial-gradient(ellipse at 50% 40%, rgba(${r},${g},${b},0.45) 0%, transparent 65%)`, animation: "collectFlash 0.9s ease-out forwards" }}/>
            )}
            {/* Background layers */}
            <div className="absolute inset-0">
                <div className="absolute inset-0 z-0 opacity-60"><ArtComponent/></div>
                <div className="absolute inset-0 z-1"
                    style={{ backgroundImage: `url('${image}')`, backgroundSize: "cover", backgroundPosition: "center", opacity: 0.14 }}/>
                <div className="absolute inset-0 z-2"
                    style={{ background: `linear-gradient(180deg, rgba(6,14,26,0.1) 0%, rgba(6,14,26,0.75) 48%, rgba(6,14,26,0.97) 100%)` }}/>
                <div className="absolute inset-0 z-3 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: `radial-gradient(ellipse 80% 55% at 50% 15%, rgba(${r},${g},${b},0.13) 0%, transparent 70%)` }}/>
            </div>
            {/* Left accent bar */}
            <div className="absolute top-0 left-0 bottom-0 w-[3px] z-10"
                style={{ background: `linear-gradient(180deg, transparent 0%, ${accent}cc 35%, ${accent}77 65%, transparent 100%)` }}/>
            {/* Content */}
            <div className="relative z-10 flex flex-col h-full">
                {children}
            </div>
        </div>
    );
}

// ─── MineCard ─────────────────────────────────────────────────────────────────
function MineCard() {
    const [mine, setMine] = useState<any>(null);
    const [collecting, setCollecting] = useState(false);
    const [msg, setMsg] = useState("");
    const [flash, triggerFlash] = useCollectFlash();

    const load = useCallback(async () => { try { setMine(await api.mineStatus()); } catch {} }, []);
    useEffect(() => { load(); }, [load]);

    async function handleCollect() {
        setCollecting(true); setMsg("");
        try {
            const res = await api.mineCollect();
            const c = res.collected;
            const parts: string[] = [];
            if (c.lootQuantity > 0)       parts.push(`+${c.lootQuantity}× ${c.lootItem.replace(/_/g," ")}`);
            if (c.diamondsGained > 0)     parts.push(`+${c.diamondsGained}💎`);
            if (c.rockFragmentsGained > 0) parts.push(`+${c.rockFragmentsGained}🪨`);
            setMsg(parts.join(" · ") || "Collected!"); triggerFlash(); load();
        } catch (e: any) { setMsg(e.message); }
        finally { setCollecting(false); }
    }

    const serverMs = mine !== null ? (mine.nextCollectMs ?? 0) : null;
    const countdown = useCountdown(serverMs);
    const ready = mine?.ready ?? false;
    const showButton = ready || (mine !== null && countdown === 0);
    const accent = "#fbbf24";

    return (
        <CardShell accent={accent} image={IMAGES.mine} ArtComponent={MineArt} flash={flash} ready={showButton}>
            {/* Top: index + level */}
            <div className="flex items-start justify-between px-5 pt-4 pb-2">
                <span className="font-mono text-xs" style={{ color: `${accent}66`, letterSpacing: ".22em" }}>01</span>
                {mine !== null && (
                    <span className="font-mono text-xs px-2 py-0.5 rounded-md"
                        style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.1)" }}>
                        LV {mine.level}
                    </span>
                )}
            </div>

            {/* Art zone */}
            <div className="flex-1 flex items-center justify-center relative px-4">
                {/* Drop pills */}
                <div className="flex flex-col gap-2 w-full">
                    {MINE_DROPS.map(d => (
                        <div key={d.label} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                            <span className="text-xl flex-shrink-0">{d.icon}</span>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-sm text-white leading-tight">{d.label}</p>
                                <p className="font-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>{d.note}</p>
                            </div>
                        </div>
                    ))}
                    {/* Daily diamond counter */}
                    {mine && (
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl mt-1"
                            style={{ background: `${accent}10`, border: `1px solid ${accent}25` }}>
                            <span className="font-mono text-xs" style={{ color: accent }}>💎 Today</span>
                            <span className="font-bold text-sm" style={{ color: accent }}>
                                {mine.dailyDiamonds ?? 0}
                                <span style={{ opacity: 0.4 }}>/{mine.dailyDiamondCap ?? 15}</span>
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom: name + action */}
            <div className="px-5 pb-5 pt-3">
                <div className="mb-1">
                    <span className="font-mono text-[10px] tracking-widest" style={{ color: showButton ? accent : "rgba(255,255,255,0.3)" }}>
                        {showButton ? "⚡ READY TO COLLECT" : "Diamonds · Resources"}
                    </span>
                </div>
                <h2 className="font-black leading-none mb-4"
                    style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "clamp(26px,3.5vw,36px)", color: "var(--text-primary)", textShadow: `0 0 30px ${accent}55`, letterSpacing: ".04em" }}>
                    Mine
                </h2>
                {msg && (
                    <p className="font-mono text-xs mb-3 px-3 py-2 rounded-xl text-center"
                        style={{ background: "rgba(6,214,160,0.1)", color: "var(--accent-green)", border: "1px solid rgba(6,214,160,0.2)" }}>
                        ✅ {msg}
                    </p>
                )}
                {mine === null ? (
                    <div className="h-12 rounded-2xl bg-white/5 animate-pulse"/>
                ) : showButton ? (
                    <button onClick={handleCollect} disabled={collecting}
                        className="w-full py-3.5 rounded-2xl font-black tracking-widest uppercase transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                        style={{ fontSize: "var(--font-base)", fontFamily: "'Rajdhani',sans-serif", background: `linear-gradient(135deg,#fbbf24,#f59e0b)`, color: "#1a0900", boxShadow: `0 0 24px ${accent}44` }}>
                        {collecting ? "Collecting..." : "⛏ Collect"}
                    </button>
                ) : (
                    <ProgressBar ms={countdown} totalMs={MINE_CD[mine.level] ?? 4*3600e3}
                        color="linear-gradient(90deg,#fbbf24,#f59e0b)"/>
                )}
            </div>
        </CardShell>
    );
}

// ─── LabCard ──────────────────────────────────────────────────────────────────
function LabCard() {
    const [lab, setLab] = useState<any>(null);
    const [collecting, setCollecting] = useState(false);
    const [msg, setMsg] = useState("");
    const [selItem, setSelItem] = useState<typeof LAB_ITEMS[0] | null>(null);
    const [flash, triggerFlash] = useCollectFlash();

    const load = useCallback(async () => { try { setLab(await api.labStatus()); } catch {} }, []);
    useEffect(() => { load(); }, [load]);

    async function handleCollect() {
        setCollecting(true); setMsg("");
        try {
            const res = await api.labCollect();
            const c = res.collected;
            const parts: string[] = [];
            if (c.elixirsGained > 0)    parts.push(`+${c.elixirsGained}× Elixir`);
            if (c.arcaneGearsGained > 0) parts.push(`+${c.arcaneGearsGained}× Arcane Gear`);
            setMsg(parts.join(" · ") || "Collected!"); triggerFlash(); load();
        } catch (e: any) { setMsg(e.message); }
        finally { setCollecting(false); }
    }

    const serverMs = lab !== null ? (lab.nextCollectMs ?? 0) : null;
    const countdown = useCountdown(serverMs);
    const ready = lab?.ready ?? false;
    const showButton = ready || (lab !== null && countdown === 0);
    const accent = "#06d6a0";

    return (
        <>
            {/* Item detail modal */}
            {selItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
                    style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)" }}
                    onClick={() => setSelItem(null)}>
                    <div className="rounded-2xl p-7 max-w-xs w-full flex flex-col items-center gap-4"
                        style={{ background: "#0a1520", border: `1px solid ${selItem.color}45`, boxShadow: `0 0 60px ${selItem.color}22` }}
                        onClick={e => e.stopPropagation()}>
                        <div className="text-6xl" style={{ filter: `drop-shadow(0 0 16px ${selItem.color})` }}>{selItem.icon}</div>
                        <p className="font-black text-xl text-white" style={{ fontFamily: "'Rajdhani',sans-serif", letterSpacing: ".06em" }}>{selItem.name}</p>
                        <p className="text-sm text-center leading-relaxed" style={{ color: "var(--text-secondary)" }}>{selItem.desc}</p>
                        <span className="text-xs font-mono px-3 py-1.5 rounded-full"
                            style={{ background: `${selItem.color}15`, color: selItem.color, border: `1px solid ${selItem.color}30` }}>
                            Coming soon
                        </span>
                        <button onClick={() => setSelItem(null)} className="text-sm transition-colors" style={{ color: "var(--text-muted)" }}>
                            Close ✕
                        </button>
                    </div>
                </div>
            )}

            <CardShell accent={accent} image={IMAGES.lab} ArtComponent={LabArt} flash={flash} ready={showButton}>
                <div className="flex items-start justify-between px-5 pt-4 pb-2">
                    <span className="font-mono text-xs" style={{ color: `${accent}66`, letterSpacing: ".22em" }}>02</span>
                    {lab !== null && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded-md"
                            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            LV {lab.level}
                        </span>
                    )}
                </div>

                {/* Items grid */}
                <div className="flex-1 px-4 flex flex-col justify-center gap-2">
                    <p className="font-mono text-[10px] tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                        CRAFTABLE ITEMS
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                        {LAB_ITEMS.map(item => (
                            <button key={item.id} onClick={() => setSelItem(item)}
                                className="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-1 transition-all hover:scale-105 active:scale-95"
                                style={{ background: `${item.color}0d`, border: `1px solid ${item.color}28` }}>
                                <span className="text-2xl" style={{ filter: `drop-shadow(0 0 6px ${item.color}99)` }}>{item.icon}</span>
                                <span className="text-[9px] font-mono text-center leading-tight" style={{ color: "var(--text-secondary)" }}>
                                    {item.name}
                                </span>
                            </button>
                        ))}
                    </div>
                    <p className="font-mono text-[9px] text-center mt-1" style={{ color: "var(--text-muted)" }}>
                        Tap any item to learn more
                    </p>
                </div>

                <div className="px-5 pb-5 pt-3">
                    <div className="mb-1">
                        <span className="font-mono text-[10px] tracking-widest" style={{ color: showButton ? accent : "rgba(255,255,255,0.3)" }}>
                            {showButton ? "⚡ READY TO COLLECT" : "Items · Consumables"}
                        </span>
                    </div>
                    <h2 className="font-black leading-none mb-4"
                        style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "clamp(26px,3.5vw,36px)", color: "var(--text-primary)", textShadow: `0 0 30px ${accent}55`, letterSpacing: ".04em" }}>
                        Laboratory
                    </h2>
                    {msg && (
                        <p className="font-mono text-xs mb-3 px-3 py-2 rounded-xl text-center"
                            style={{ background: "rgba(6,214,160,0.1)", color: "var(--accent-green)", border: "1px solid rgba(6,214,160,0.2)" }}>
                            ✅ {msg}
                        </p>
                    )}
                    {lab === null ? (
                        <div className="h-12 rounded-2xl bg-white/5 animate-pulse"/>
                    ) : showButton ? (
                        <button onClick={handleCollect} disabled={collecting}
                            className="w-full py-3.5 rounded-2xl font-black tracking-widest uppercase transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                            style={{ fontSize: "var(--font-base)", fontFamily: "'Rajdhani',sans-serif", background: "linear-gradient(135deg,#06d6a0,#04a57a)", color: "#001a12", boxShadow: "0 0 24px rgba(6,214,160,0.4)" }}>
                            {collecting ? "Collecting..." : "🧪 Collect"}
                        </button>
                    ) : (
                        <ProgressBar ms={countdown} totalMs={LAB_CD[lab.level] ?? 8*3600e3}
                            color="linear-gradient(90deg,#06d6a0,#0891b2)"/>
                    )}
                </div>
            </CardShell>
        </>
    );
}

// ─── NurseryCard ──────────────────────────────────────────────────────────────
function NurseryCard() {
    const [nursery, setNursery] = useState<any>(null);
    const [allMyths, setAllMyths] = useState<any[]>([]);
    const [collecting, setCollecting] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [msg, setMsg] = useState("");
    const [flash, triggerFlash] = useCollectFlash();

    const load = useCallback(async () => {
        try {
            const [n, all] = await Promise.all([api.nurseryStatus(), api.creatures()]);
            setNursery(n);
            const inNurseryId = n?.myth?.id ?? null;
            setAllMyths((all as any[]).filter((c: any) => c.level < 60 && c.id !== inNurseryId && !c.inNursery));
        } catch {}
    }, []);
    useEffect(() => { load(); }, [load]);

    async function handleAssign(creatureId: string) {
        setAssigning(true); setShowPicker(false);
        try { await (api as any).nurseryAssign?.({ creatureId }); load(); }
        catch {} finally { setAssigning(false); }
    }
    async function handleRemove() {
        try { await (api as any).nurseryRemove?.(); load(); } catch {}
    }
    async function handleCollect() {
        setCollecting(true); setMsg("");
        try {
            await (api as any).nurseryCollect?.();
            setMsg("Level up!"); triggerFlash(); load();
        } catch (e: any) { setMsg(e.message); }
        finally { setCollecting(false); }
    }

    const hasMyth = !!nursery?.myth;
    const isMaxLevel = hasMyth && nursery.myth.level >= 60;
    const serverMs = hasMyth ? (nursery.nextCollectMs ?? 0) : null;
    const countdown = useCountdown(serverMs);
    const showButton = hasMyth && !isMaxLevel && ((nursery?.ready ?? false) || countdown === 0);
    const accent = "#ffd60a";
    const inParty   = allMyths.filter((c: any) => c.inParty);
    const inStorage = allMyths.filter((c: any) => !c.inParty);
    const artUrl = hasMyth ? mythArtUrl(nursery.myth) : "";

    return (
        <>
            {showPicker && (
                <div className="fixed inset-0 z-50 flex items-end justify-center"
                    style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
                    onClick={() => setShowPicker(false)}>
                    <div className="w-full max-w-sm rounded-t-2xl overflow-hidden"
                        style={{ background: "#0a1520", border: "1px solid rgba(255,214,10,0.25)", boxShadow: "0 -8px 40px rgba(0,0,0,0.6)" }}
                        onClick={e => e.stopPropagation()}>
                        <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(255,214,10,0.1)" }}>
                            <p className="font-black text-base" style={{ fontFamily: "'Rajdhani',sans-serif", color: "var(--text-primary)" }}>
                                Select Myth to Train
                            </p>
                            <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                                Myths in training gain XP passively
                            </p>
                        </div>
                        <div className="max-h-72 overflow-y-auto">
                            {inParty.length > 0 && (
                                <p className="text-[9px] font-mono px-4 py-2 tracking-widest" style={{ color: "var(--text-muted)" }}>PARTY</p>
                            )}
                            {inParty.map((c: any) => (
                                <button key={c.id} onClick={() => handleAssign(c.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: "rgba(255,214,10,0.08)", border: "1px solid rgba(255,214,10,0.15)" }}>
                                        {mythArtUrl(c) ? (
                                            <img src={mythArtUrl(c)} className="w-8 h-8 object-contain" alt=""/>
                                        ) : <span className="text-xl">❓</span>}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-white">{c.name ?? c.speciesId}</p>
                                        <p className="font-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>Lv. {c.level}</p>
                                    </div>
                                </button>
                            ))}
                            {inStorage.length > 0 && (
                                <p className="text-[9px] font-mono px-4 py-2 tracking-widest" style={{ color: "var(--text-muted)" }}>STORAGE</p>
                            )}
                            {inStorage.map((c: any) => (
                                <button key={c.id} onClick={() => handleAssign(c.id)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                                        {mythArtUrl(c) ? (
                                            <img src={mythArtUrl(c)} className="w-8 h-8 object-contain" alt=""/>
                                        ) : <span className="text-xl">❓</span>}
                                    </div>
                                    <div>
                                        <p className="font-bold text-sm text-white">{c.name ?? c.speciesId}</p>
                                        <p className="font-mono text-[10px]" style={{ color: "var(--text-secondary)" }}>Lv. {c.level}</p>
                                    </div>
                                </button>
                            ))}
                            {inParty.length === 0 && inStorage.length === 0 && (
                                <p className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                                    No myths available to train
                                </p>
                            )}
                        </div>
                        <button onClick={() => setShowPicker(false)}
                            className="w-full py-3.5 text-sm font-mono hover:bg-white/5 transition-colors"
                            style={{ color: "var(--text-muted)", borderTop: "1px solid rgba(255,214,10,0.08)" }}>
                            Cancel ✕
                        </button>
                    </div>
                </div>
            )}

            <CardShell accent={accent} image={IMAGES.nursery} ArtComponent={NurseryArt} flash={flash} ready={showButton}>
                <div className="flex items-start justify-between px-5 pt-4 pb-1">
                    <span className="font-mono text-xs" style={{ color: `${accent}66`, letterSpacing: ".22em" }}>03</span>
                    {nursery !== null && (
                        <span className="font-mono text-xs px-2 py-0.5 rounded-md"
                            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.1)" }}>
                            LV {nursery.level}
                        </span>
                    )}
                </div>

                {/* Myth zone — protagonist */}
                <div className="flex-1 flex flex-col items-center justify-center relative px-4 py-2">
                    {!hasMyth ? (
                        /* Empty state */
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="w-20 h-20 rounded-full flex items-center justify-center"
                                style={{ background: "rgba(255,214,10,0.06)", border: "2px dashed rgba(255,214,10,0.2)" }}>
                                <span style={{ fontSize: 36, opacity: 0.35 }}>🌿</span>
                            </div>
                            <div>
                                <p className="font-bold text-sm text-white mb-0.5">No myth training</p>
                                <p className="font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                                    Assign a myth to gain XP<br/>passively over time
                                </p>
                            </div>
                        </div>
                    ) : (
                        /* Training myth — big and centered */
                        <div className="flex flex-col items-center gap-3 w-full">
                            {/* Glow rings */}
                            <div className="relative flex items-center justify-center">
                                <div className="absolute rounded-full pointer-events-none"
                                    style={{ width: 110, height: 110, background: `radial-gradient(circle, ${accent}22 0%, transparent 70%)`, animation: "nurseryPulse 2.5s ease-in-out infinite" }}/>
                                <div className="absolute rounded-full pointer-events-none"
                                    style={{ width: 72, height: 72, background: `radial-gradient(circle, ${accent}33 0%, transparent 70%)`, animation: "nurseryPulse 2.5s ease-in-out infinite 0.4s" }}/>
                                {/* Myth art */}
                                <div className="relative z-10 flex items-center justify-center w-20 h-20 rounded-2xl"
                                    style={{ background: `${accent}0f`, border: `1.5px solid ${accent}44`, boxShadow: `0 0 30px ${accent}33` }}>
                                    {artUrl ? (
                                        <img src={artUrl} alt={nursery.myth.name}
                                            className="w-16 h-16 object-contain"
                                            style={{ filter: `drop-shadow(0 0 12px ${accent}88)`, animation: "nurseryFloat 3s ease-in-out infinite" }}/>
                                    ) : (
                                        <span style={{ fontSize: 48, filter: `drop-shadow(0 0 12px ${accent}88)`, animation: "nurseryFloat 3s ease-in-out infinite" }}>❓</span>
                                    )}
                                </div>
                                {/* XP particles */}
                                {[...Array(5)].map((_,i) => (
                                    <div key={i} className="absolute pointer-events-none rounded-full"
                                        style={{ width: 5, height: 5, background: accent, boxShadow: `0 0 8px ${accent}`, left: `${18+i*16}%`, top: "15%", animation: `nurseryXP 2s ease-in-out infinite ${i*0.4}s`, opacity: 0.8 }}/>
                                ))}
                            </div>
                            {/* Myth name + level */}
                            <div className="text-center">
                                <p className="font-black text-base leading-tight" style={{ fontFamily: "'Rajdhani',sans-serif", color: accent, letterSpacing: ".06em" }}>
                                    {nursery.myth.name ?? nursery.myth.speciesId}
                                </p>
                                {isMaxLevel ? (
                                    <p className="font-mono text-xs" style={{ color: `${accent}88` }}>🏆 MAX LEVEL (60)</p>
                                ) : (
                                    <p className="font-mono text-xs" style={{ color: "var(--text-secondary)" }}>
                                        Lv. {nursery.myth.level} → {nursery.myth.level + 1}
                                    </p>
                                )}
                            </div>
                            <button onClick={handleRemove}
                                className="font-mono text-[10px] transition-colors hover:text-white/50"
                                style={{ color: "var(--text-muted)" }}>
                                Remove from nursery ✕
                            </button>
                        </div>
                    )}
                </div>

                {/* Bottom */}
                <div className="px-5 pb-5 pt-2">
                    <div className="mb-1">
                        <span className="font-mono text-[10px] tracking-widest" style={{ color: showButton ? accent : "rgba(255,255,255,0.3)" }}>
                            {showButton ? "⚡ READY TO LEVEL UP" : hasMyth ? "Training..." : "Myth Training"}
                        </span>
                    </div>
                    <h2 className="font-black leading-none mb-4"
                        style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "clamp(26px,3.5vw,36px)", color: "var(--text-primary)", textShadow: `0 0 30px ${accent}55`, letterSpacing: ".04em" }}>
                        Nursery
                    </h2>
                    {msg && (
                        <p className="font-mono text-xs mb-3 px-3 py-2 rounded-xl text-center"
                            style={{ background: "rgba(6,214,160,0.1)", color: "var(--accent-green)", border: "1px solid rgba(6,214,160,0.2)" }}>
                            ✅ {msg}
                        </p>
                    )}
                    {nursery === null ? (
                        <div className="h-12 rounded-2xl bg-white/5 animate-pulse"/>
                    ) : !hasMyth ? (
                        <button onClick={() => setShowPicker(true)} disabled={assigning}
                            className="w-full py-3.5 rounded-2xl font-black tracking-widest uppercase transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                            style={{ fontSize: "var(--font-base)", fontFamily: "'Rajdhani',sans-serif", background: `rgba(255,214,10,0.12)`, color: accent, border: `1.5px solid rgba(255,214,10,0.35)` }}>
                            {assigning ? "Assigning..." : "＋ Assign Myth"}
                        </button>
                    ) : isMaxLevel ? (
                        <button onClick={handleRemove}
                            className="w-full py-3.5 rounded-2xl font-black tracking-widest uppercase transition-all hover:brightness-110 active:scale-[0.98]"
                            style={{ fontSize: "var(--font-base)", fontFamily: "'Rajdhani',sans-serif", background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.12)" }}>
                            Return to Storage
                        </button>
                    ) : showButton ? (
                        <button onClick={handleCollect} disabled={collecting}
                            className="w-full py-3.5 rounded-2xl font-black tracking-widest uppercase transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
                            style={{ fontSize: "var(--font-base)", fontFamily: "'Rajdhani',sans-serif", background: "linear-gradient(135deg,#ffd60a,#f59e0b)", color: "#1a0900", boxShadow: "0 0 28px rgba(255,214,10,0.45)" }}>
                            {collecting ? "Leveling Up..." : "⬆ Level Up"}
                        </button>
                    ) : (
                        <ProgressBar ms={countdown} totalMs={nursery.currentLevelCooldownMs ?? serverMs ?? 1}
                            color="linear-gradient(90deg,#ffd60a,#f59e0b)"/>
                    )}
                </div>
            </CardShell>
        </>
    );
}

// ─── OutpostPage ──────────────────────────────────────────────────────────────
export default function OutpostPage() {
    return (
        <div className="fixed inset-0 flex flex-col overflow-hidden" style={{ background: "#070b14", fontFamily: "'Exo 2',sans-serif" }}>
            <style>{`
                @keyframes collectFlash { 0%{opacity:1} 100%{opacity:0} }
            `}</style>

            {/* Ambient BG */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
                <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 70% 50% at 50% -10%,rgba(123,47,255,0.06) 0%,transparent 60%)" }} />
                <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)",backgroundSize:"40px 40px" }} />
            </div>

            <PageTopbar
                title={
                    <div className="flex flex-col items-center">
                        <span className="tracking-[0.22em] uppercase font-black" style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:"var(--font-lg)", color:"var(--text-primary)" }}>Outpost</span>
                        <span className="tracking-widest uppercase" style={{ fontSize:"var(--font-2xs)", color:"var(--text-muted)", fontFamily:"monospace" }}>Mine · Lab · Nursery</span>
                    </div>
                }
            />

            {/* 3-column grid */}
            <div className="relative flex-1 grid grid-cols-1 md:grid-cols-3 overflow-hidden p-3 md:p-4 gap-3 md:gap-4" style={{ zIndex: 1 }}>
                <MineCard/>
                <LabCard/>
                <NurseryCard/>
            </div>
        </div>
    );
}
