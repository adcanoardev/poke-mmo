import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTrainer } from "../context/TrainerContext";
import { useMapDrag } from "../hooks/useMapDrag";

type District = {
    id: string; name: string; color: string;
    description: string; route: string;
    px: number; py: number;
    hitW: string; hitH: string;
};

const DISTRICTS: District[] = [
    { id: "nexus",   name: "Nexus",     color: "#a78bfa", description: "Arcane summoning portal",        route: "/nexus",   px: 0.496, py: 0.437, hitW: "20%", hitH: "22%" },
    { id: "arena",   name: "Arena",     color: "#ef4444", description: "PvP · Duels · Ranked",            route: "/arena",   px: 0.696, py: 0.235, hitW: "20%", hitH: "23%" },
    { id: "tavern",  name: "Tavern",    color: "#f59e0b", description: "Binders · Ranking · Social",     route: "/tavern",  px: 0.252, py: 0.495, hitW: "22%", hitH: "17%" },
    { id: "inn",     name: "Inn",       color: "#84cc16", description: "Mine · Forge · Lab · Nursery",   route: "/inn",     px: 0.228, py: 0.687, hitW: "20%", hitH: "19%" },
    { id: "market",  name: "Market",    color: "#38bdf8", description: "Shop · Gold · Diamonds",         route: "/market",  px: 0.776, py: 0.492, hitW: "25%", hitH: "24%" },
    { id: "arcanum", name: "Arcanum",   color: "#60a5fa", description: "Mythsdex · Encyclopedia",        route: "/arcanum", px: 0.500, py: 0.150, hitW: "17%", hitH: "30%" },
    { id: "guild",   name: "Guild",     color: "#fbbf24", description: "Missions · Achievements · Pass", route: "/guild",   px: 0.500, py: 0.690, hitW: "21%", hitH: "20%" },
    { id: "ruins",   name: "The Ruins", color: "#34d399", description: "PvE · Sanctums · Boss · Tower",  route: "/ruins",   px: 0.271, py: 0.252, hitW: "21%", hitH: "25%" },
];

const FOG_DRIFT = [
    { id: 0, dur: "38s", delay: "0s",  top: "5%",  w: "60%", h: "20%", blur: "24px", op: 0.30 },
    { id: 1, dur: "54s", delay: "16s", top: "62%", w: "68%", h: "22%", blur: "30px", op: 0.24 },
    { id: 2, dur: "46s", delay: "8s",  top: "30%", w: "50%", h: "16%", blur: "28px", op: 0.18 },
    { id: 3, dur: "64s", delay: "28s", top: "78%", w: "55%", h: "18%", blur: "32px", op: 0.16 },
];

const CHAT_MESSAGES = [
    { user: "KaelDrake",   text: "Anyone want to do Nexus runs?" },
    { user: "Sylvara99",   text: "I got a Mythic from the Arena!" },
    { user: "IronBinder",  text: "Guild war starts in 2 hours" },
    { user: "NightMythra", text: "Selling EPIC fragments, DM me" },
    { user: "ZarakBolt",   text: "Sanctum 4 solo clear ✓" },
    { user: "KaelDrake",   text: "GG ZarakBolt!!" },
];

// 7 PvP ranks — lowest to highest
const PVP_RANKS = [
    { name: "Bronze",   color: "#cd7f32", minPvp: 0 },
    { name: "Silver",   color: "#94a3b8", minPvp: 10 },
    { name: "Gold",     color: "#fbbf24", minPvp: 25 },
    { name: "Platinum", color: "#67e8f9", minPvp: 50 },
    { name: "Diamond",  color: "#818cf8", minPvp: 100 },
    { name: "Ascendant",color: "#f472b6", minPvp: 200 },
    { name: "Mythic",   color: "#a855f7", minPvp: 400 },
];

function getPvpRank(pvpTokens: number) {
    let rank = PVP_RANKS[0];
    for (const r of PVP_RANKS) {
        if (pvpTokens >= r.minPvp) rank = r;
    }
    return rank;
}

const CITY_URL =
    "https://cdn.jsdelivr.net/gh/adcanoardev/mythara-assets@6b7f2778e450edb983a24af7fae240b33631c287/maps/main_city_base.webp";

const AVATAR_URL = (av: string) =>
    `https://cdn.jsdelivr.net/gh/adcanoardev/mythara-assets@7613486785dc2b2089f6d345e1281e9316c1d982/avatars/${av}.webp`;

function fmtGold(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000)    return `${Math.floor(n / 1000)}K`;
    return n.toLocaleString();
}

const BOTTOM_BAR: { icon: string; label: string; route: string; accent?: string }[] = [
    { icon: "📜", label: "Missions",   route: "/missions" },
    { icon: "🎯", label: "Challenges", route: "/challenges" },
    { icon: "🏛️", label: "Sanctums",   route: "/sanctuaries" },
    { icon: "👥", label: "Social",     route: "/tavern" },
    { icon: "⚔️", label: "Battle",     route: "/battle", accent: "#ef4444" },
];

export default function HomePage() {
    const { trainer } = useTrainer();
    const navigate    = useNavigate();

    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef       = useRef<HTMLDivElement>(null);
    const [hoveredId, setHoveredId] = useState<string | null>(null);
    const [chatOpen,  setChatOpen]  = useState(false);
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

    const { offset: rawOffset, onMouseDown, onTouchStart, didDrag } = useMapDrag(containerRef, mapRef, { initialYRatio: 0.15 });
    const offset = rawOffset ?? { x: 0, y: 0 };

    const binderLevel = (trainer as any)?.binderLevel ?? 1;
    const gold        = (trainer as any)?.gold        ?? 0;
    const diamonds    = (trainer as any)?.diamonds    ?? 0;
    const npcTokens   = (trainer as any)?.npcTokens   ?? 0;
    const pvpTokens   = (trainer as any)?.pvpTokens   ?? 0;
    const avatar      = trainer?.avatar ?? "male_1";
    const username    = (trainer as any)?.username ?? "Binder";
    const xp          = (trainer as any)?.xp ?? 0;
    const xpPct       = Math.min(100, (xp % 1000) / 10);
    const pvpRank     = getPvpRank(pvpTokens);

    function handleDistrictClick(d: District) {
        if (didDrag.current) return;
        navigate(d.route);
    }

    const nexus = DISTRICTS.find(d => d.id === "nexus")!;

    return (
        <div className="w-screen h-screen overflow-hidden relative bg-black flex flex-col select-none">
            <style>{`
                .city-grab        { cursor: grab; }
                .city-grab:active { cursor: grabbing; }

                @keyframes fogDrift {
                    0%   { transform: translateX(-40%); opacity: 0; }
                    8%   { opacity: var(--fog-op, 0.2); }
                    92%  { opacity: var(--fog-op, 0.2); }
                    100% { transform: translateX(125%); opacity: 0; }
                }
                @keyframes edgeFogBreath  { 0%,100%{opacity:.55;transform:scaleX(1)} 50%{opacity:.78;transform:scaleX(1.04)} }
                @keyframes edgeFogBreathR { 0%,100%{opacity:.50;transform:scaleX(1)} 50%{opacity:.72;transform:scaleX(1.05)} }
                @keyframes edgeFogBreathV { 0%,100%{opacity:.42;transform:scaleY(1)} 50%{opacity:.65;transform:scaleY(1.06)} }

                @keyframes nexusBeam {
                    0%,100% { opacity:.52; filter:blur(13px); transform:translateX(-50%) scaleX(1); }
                    50%     { opacity:.92; filter:blur(8px);  transform:translateX(-50%) scaleX(1.2); }
                }
                @keyframes nexusBeamCore {
                    0%,100% { opacity:.65; transform:translateX(-50%) scaleX(1); }
                    40%     { opacity:1;   transform:translateX(-50%) scaleX(1.4); }
                    70%     { opacity:.80; transform:translateX(-50%) scaleX(0.9); }
                }
                @keyframes nexusBaseGlow {
                    0%,100% { opacity:.52; transform:translateX(-50%) scaleX(1); }
                    50%     { opacity:.95; transform:translateX(-50%) scaleX(1.28); }
                }

                @keyframes districtGlowPulse { 0%,100%{opacity:.45} 50%{opacity:.88} }
                @keyframes xpShimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
                @keyframes arrowBobX { 0%,100%{transform:translateY(-50%) translateX(0)} 50%{transform:translateY(-50%) translateX(6px)} }
                @keyframes chatSlideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
                @keyframes chatSlideUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }

                .bar-icon-wrap {
                    width:48px; height:48px; border-radius:50%;
                    background:linear-gradient(160deg,rgba(255,255,255,0.13) 0%,rgba(255,255,255,0.05) 100%);
                    border:2px solid rgba(255,255,255,0.18);
                    display:flex; align-items:center; justify-content:center;
                    transition:all 0.15s ease;
                    box-shadow:0 3px 10px rgba(0,0,0,0.55),inset 0 1px 0 rgba(255,255,255,0.12),inset 0 -1px 0 rgba(0,0,0,0.3);
                }
                .bar-btn:active .bar-icon-wrap { transform:scale(0.88); }
                .bar-icon-wrap-battle {
                    width:54px !important; height:54px !important;
                    background:linear-gradient(160deg,rgba(239,68,68,0.70) 0%,rgba(153,27,27,0.85) 100%) !important;
                    border:2.5px solid rgba(239,68,68,0.80) !important;
                    box-shadow:0 0 18px rgba(239,68,68,0.50),0 3px 12px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,160,160,0.20) !important;
                }
            `}</style>

            {/* ── TOP HUD ─────────────────────────────────────────────────── */}
            <div
                className="absolute top-0 left-0 right-0 flex items-start justify-between"
                style={{
                    zIndex: 20,
                    background: "linear-gradient(to bottom, rgba(4,7,16,0.72) 0%, rgba(4,7,16,0.38) 65%, transparent 100%)",
                    pointerEvents: "none",
                    padding: "20px 16px 24px 20px",
                    paddingTop: "max(20px, env(safe-area-inset-top))",
                    gap: "12px",
                }}
            >
                {/* ── AVATAR BLOCK ── */}
                <div className="flex items-center gap-3 pointer-events-all flex-shrink-0">
                    <div style={{ position: "relative", width: "86px", height: "86px", flexShrink: 0 }}>
                        <div style={{
                            position: "absolute", inset: 0, borderRadius: "12px",
                            border: "2.5px solid rgba(251,191,36,0.80)",
                            boxShadow: "0 0 18px rgba(251,191,36,0.32), inset 0 0 12px rgba(0,0,0,0.55)",
                            zIndex: 2, pointerEvents: "none",
                        }} />
                        <img src={AVATAR_URL(avatar)}
                            onError={e => { (e.target as HTMLImageElement).style.opacity = "0"; }}
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "10px", display: "block" }}
                            alt={username} />
                        <div style={{
                            position: "absolute", top: "-10px", left: "-10px",
                            minWidth: "32px", height: "32px", padding: "0 7px",
                            background: "linear-gradient(135deg, #78350f, #f59e0b, #fbbf24)",
                            border: "2.5px solid #020810", borderRadius: "8px",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "Rajdhani, sans-serif", fontWeight: 700,
                            fontSize: "14px", color: "#020810", lineHeight: 1, zIndex: 3,
                        }}>{binderLevel}</div>
                    </div>

                    {/* Username + rank + XP bar */}
                    <div style={{ minWidth: 0 }}>
                        {/* Username */}
                        <div style={{
                            fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "22px",
                            color: "#ffffff", lineHeight: 1.1, maxWidth: "160px",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            textShadow: "0 1px 6px rgba(0,0,0,0.9)",
                        }}>{username}</div>

                        {/* Binder · Lv + PvP rank on same row */}
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px" }}>
                            <span style={{ fontSize: "14px", color: "rgba(251,191,36,0.70)", fontFamily: "Rajdhani, sans-serif", fontWeight: 600 }}>
                                Binder · Lv {binderLevel}
                            </span>
                            <span style={{
                                fontSize: "12px", fontFamily: "Rajdhani, sans-serif", fontWeight: 700,
                                color: pvpRank.color, padding: "1px 7px", borderRadius: "5px",
                                background: `${pvpRank.color}22`, border: `1px solid ${pvpRank.color}55`,
                                textShadow: `0 0 8px ${pvpRank.color}88`,
                            }}>
                                {pvpRank.name}
                            </span>
                        </div>

                        {/* XP bar with % inside */}
                        <div style={{ width: "140px", height: "18px", background: "rgba(255,255,255,0.10)", borderRadius: "6px", marginTop: "7px", overflow: "hidden", position: "relative" }}>
                            <div style={{
                                width: `${xpPct}%`, height: "100%", borderRadius: "6px",
                                background: "linear-gradient(90deg, #facc15 0%, #fde68a 45%, #facc15 60%, #facc15 100%)",
                                backgroundSize: "200% auto", animation: "xpShimmer 3s linear infinite",
                                transition: "width 0.5s",
                            }} />
                            {/* XP % text inside bar */}
                            <div style={{
                                position: "absolute", inset: 0, display: "flex",
                                alignItems: "center", justifyContent: "center",
                                fontSize: "11px", fontFamily: "Rajdhani, sans-serif", fontWeight: 700,
                                color: xpPct > 40 ? "#020810" : "rgba(251,191,36,0.90)",
                                textShadow: xpPct > 40 ? "none" : "0 1px 3px rgba(0,0,0,0.8)",
                            }}>
                                {Math.round(xpPct)}% XP
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── RESOURCES + CHAT — single row: ⚡ ⚔️ 💎 🪙 💬 ── */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px", pointerEvents: "all", flexWrap: "nowrap" }}>
                    {[
                        { icon: "⚡",  value: String(npcTokens), color: "#e2e8f0", border: "rgba(255,255,255,0.14)" },
                        { icon: "⚔️", value: String(pvpTokens), color: "#e2e8f0", border: "rgba(255,255,255,0.14)" },
                        { icon: "💎",  value: String(diamonds),  color: "#c4b5fd", border: "rgba(139,92,246,0.45)" },
                        { icon: "🪙",  value: fmtGold(gold),     color: "#fcd34d", border: "rgba(251,191,36,0.45)" },
                    ].map(({ icon, value, color, border }) => (
                        <div key={icon} style={{
                            display: "flex", alignItems: "center", gap: "5px",
                            background: "rgba(4,7,16,0.88)", border: `1px solid ${border}`,
                            borderRadius: "10px", padding: "6px 11px",
                        }}>
                            <span style={{ fontSize: "15px", lineHeight: 1 }}>{icon}</span>
                            <span style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: "15px", color, lineHeight: 1 }}>{value}</span>
                        </div>
                    ))}
                    {/* Chat — last in row */}
                    <button onClick={() => setChatOpen(true)} style={{
                        width: "38px", height: "38px", borderRadius: "10px",
                        background: "rgba(4,7,16,0.88)", border: "1px solid rgba(99,102,241,0.50)",
                        boxShadow: "0 0 10px rgba(99,102,241,0.20)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", fontSize: "17px", flexShrink: 0,
                        marginLeft: "8px", transition: "all 0.15s ease",
                    }} title="Chat">💬</button>
                </div>
            </div>

            {/* ── CITY MAP ────────────────────────────────────────────────── */}
            <div ref={containerRef} className="flex-1 relative overflow-hidden city-grab"
                onMouseDown={onMouseDown} onTouchStart={onTouchStart}>
                <div ref={mapRef} className="absolute top-0 left-0" style={{
                    width: "max(100%, 900px)", minHeight: "100%", aspectRatio: "16/9",
                    transform: `translate(${offset.x}px, ${offset.y}px)`,
                    willChange: "transform", touchAction: "none",
                }}>
                    <img src={CITY_URL} alt="City of Mythara" draggable={false}
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{ objectFit: "cover", objectPosition: "center top", userSelect: "none" }} />

                    <div className="absolute inset-0 pointer-events-none" style={{ background: "rgba(4,7,16,0.06)" }} />
                    <div className="absolute inset-0 pointer-events-none"
                        style={{ background: "radial-gradient(ellipse 92% 90% at 50% 50%, transparent 36%, rgba(4,7,16,0.86) 100%)" }} />

                    {/* Edge fog */}
                    <div className="absolute pointer-events-none" style={{ top:0,left:0,width:"22%",height:"100%",background:"linear-gradient(to right,rgba(8,12,24,0.75) 0%,rgba(8,12,24,0.35) 55%,transparent 100%)",transformOrigin:"left center",animation:"edgeFogBreath 8s ease-in-out infinite",zIndex:2 }} />
                    <div className="absolute pointer-events-none" style={{ top:0,right:0,width:"22%",height:"100%",background:"linear-gradient(to left,rgba(8,12,24,0.75) 0%,rgba(8,12,24,0.35) 55%,transparent 100%)",transformOrigin:"right center",animation:"edgeFogBreathR 9.5s ease-in-out infinite",zIndex:2 }} />
                    <div className="absolute pointer-events-none" style={{ top:0,left:0,right:0,height:"16%",background:"linear-gradient(to bottom,rgba(8,12,24,0.68) 0%,transparent 100%)",transformOrigin:"center top",animation:"edgeFogBreathV 11s ease-in-out infinite",zIndex:2 }} />
                    <div className="absolute pointer-events-none" style={{ bottom:0,left:0,right:0,height:"16%",background:"linear-gradient(to top,rgba(8,12,24,0.68) 0%,transparent 100%)",transformOrigin:"center bottom",animation:"edgeFogBreathV 13s ease-in-out infinite 2s",zIndex:2 }} />

                    {/* Drifting fog */}
                    {FOG_DRIFT.map(f => (
                        <div key={f.id} className="absolute pointer-events-none" style={{
                            top:f.top,left:0,width:f.w,height:f.h,borderRadius:"50%",
                            background:"radial-gradient(ellipse,rgba(190,210,248,0.50) 0%,rgba(155,182,235,0.16) 55%,transparent 76%)",
                            filter:`blur(${f.blur})`,["--fog-op" as any]:f.op,
                            animation:`fogDrift ${f.dur} ${f.delay} linear infinite`,zIndex:3,
                        }} />
                    ))}

                    {/* ── NEXUS BEAM ── */}
                    <div className="absolute pointer-events-none" style={{ left:`${nexus.px*100}%`, top:`${nexus.py*100}%`, zIndex:4 }}>
                        <div style={{ position:"absolute", top:"30%", left:"50%", width:"clamp(55px,7vw,95px)", height:"clamp(75px,9vw,135px)", transform:"translate(-50%,-100%)", background:"linear-gradient(to top,rgba(205,228,255,0.55) 0%,rgba(232,246,255,0.82) 40%,rgba(248,254,255,0.52) 72%,transparent 100%)", filter:"blur(13px)", animation:"nexusBeam 4s ease-in-out infinite", mixBlendMode:"screen" }} />
                        <div style={{ position:"absolute", top:"30%", left:"50%", width:"clamp(11px,1.4vw,20px)", height:"clamp(58px,7.5vw,110px)", transform:"translate(-50%,-100%)", background:"linear-gradient(to top,rgba(232,246,255,0.95) 0%,rgba(255,255,255,1) 40%,rgba(242,250,255,0.65) 72%,transparent 100%)", filter:"blur(3px)", animation:"nexusBeamCore 3s ease-in-out infinite", mixBlendMode:"screen" }} />
                        <div style={{ position:"absolute", top:"44%", left:"50%", width:"clamp(80px,10vw,145px)", height:"clamp(26px,3vw,44px)", transform:"translate(-50%,-50%)", borderRadius:"50%", background:"radial-gradient(ellipse,rgba(215,235,255,0.90) 0%,rgba(175,208,255,0.45) 42%,transparent 72%)", filter:"blur(9px)", animation:"nexusBaseGlow 3s ease-in-out infinite 0.4s" }} />
                    </div>

                    {/* ── DISTRICT MARKERS ── */}
                    {DISTRICTS.map(d => {
                        const hovered = hoveredId === d.id;
                        return (
                            <div key={d.id} className="absolute" style={{
                                left:`${d.px*100}%`, top:`${d.py*100}%`,
                                transform:"translate(-50%,-50%)",
                                width:d.hitW, height:d.hitH,
                                zIndex:5, pointerEvents:"all", cursor:"pointer",
                                display:"flex", flexDirection:"column",
                                alignItems:"center", justifyContent:"flex-end",
                            }}
                                onMouseEnter={() => setHoveredId(d.id)}
                                onMouseLeave={() => setHoveredId(null)}
                                onClick={() => handleDistrictClick(d)}
                            >
                                <div style={{ position:"absolute", inset:0, borderRadius:"40%", background:`radial-gradient(ellipse,${d.color}38 0%,${d.color}12 55%,transparent 78%)`, opacity:hovered?1:0, transition:"opacity 0.3s ease", animation:hovered?"districtGlowPulse 1.8s ease-in-out infinite":"none", pointerEvents:"none" }} />

                                {/* Name pill */}
                                <div style={{ position:"relative", background:hovered?"rgba(4,7,16,0.88)":"rgba(4,7,16,0.68)", border:`1.5px solid ${hovered?d.color+"cc":d.color+"55"}`, borderRadius:"8px", padding:"5px 16px", marginBottom:"5px", backdropFilter:"blur(6px)", boxShadow:hovered?`0 0 20px ${d.color}55,0 2px 14px rgba(0,0,0,0.9)`:"0 2px 10px rgba(0,0,0,0.7)", transition:"all 0.2s ease", pointerEvents:"none" }}>
                                    <div style={{ color:"#ffffff", fontSize:hovered?"28px":"22px", fontFamily:"Rajdhani, sans-serif", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", lineHeight:1, whiteSpace:"nowrap", textShadow:hovered?`0 0 22px ${d.color},0 0 10px ${d.color}99,0 2px 8px rgba(0,0,0,1)`:"0 1px 4px rgba(0,0,0,1),0 2px 12px rgba(0,0,0,1)", transition:"font-size 0.18s ease,text-shadow 0.2s ease" }}>{d.name}</div>
                                </div>

                                {/* Description on hover */}
                                {hovered && (
                                    <div style={{ position:"relative", color:"#ffffff", fontSize:"16px", fontFamily:"Exo 2, sans-serif", fontWeight:600, whiteSpace:"nowrap", marginBottom:"4px", textShadow:`0 0 14px ${d.color},0 1px 6px rgba(0,0,0,1)`, pointerEvents:"none", background:"rgba(4,7,16,0.80)", border:`1px solid ${d.color}55`, borderRadius:"6px", padding:"4px 14px" }}>{d.description}</div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="absolute pointer-events-none md:hidden" style={{ right:"14px",top:"50%",zIndex:8,color:"rgba(232,240,254,0.28)",fontSize:"28px",animation:"arrowBobX 1.5s ease-in-out infinite" }}>›</div>
            </div>

            {/* ── BOTTOM BAR — solid, no transparency ─────────────────────── */}
            <div style={{
                position:"absolute", bottom:0, left:0, right:0, zIndex:20,
                // Solid dark background — no transparency
                background:"#06080f",
                borderTop:"1px solid rgba(255,255,255,0.10)",
                paddingBottom:"max(8px,env(safe-area-inset-bottom))",
                paddingTop:"6px",
                display:"flex",
                boxShadow:"0 -2px 20px rgba(0,0,0,0.8)",
            }}>
                {BOTTOM_BAR.map((btn, idx) => {
                    const isBattle = !!btn.accent;
                    return (
                        <button key={btn.route} className="bar-btn" onClick={() => navigate(btn.route)} style={{
                            flex:1, display:"flex", flexDirection:"column",
                            alignItems:"center", justifyContent:"center", gap:"5px",
                            minHeight:"72px", padding:"8px 4px",
                            background:"transparent", border:"none",
                            borderRight:idx<BOTTOM_BAR.length-1?"1px solid rgba(255,255,255,0.06)":"none",
                            cursor:"pointer", position:"relative",
                        }}>
                            {/* Top accent line */}
                            <div style={{ position:"absolute", top:0, left:"20%", right:"20%", height:"2px", borderRadius:"0 0 2px 2px", background:isBattle?"linear-gradient(90deg,transparent,rgba(239,68,68,0.90),transparent)":"linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)" }} />
                            <div className={`bar-icon-wrap${isBattle?" bar-icon-wrap-battle":""}`}>
                                <span style={{ fontSize:isBattle?"28px":"24px", lineHeight:1 }}>{btn.icon}</span>
                            </div>
                            <span style={{ fontFamily:"Rajdhani, sans-serif", fontWeight:700, fontSize:"11px", textTransform:"uppercase", letterSpacing:"0.09em", color:isBattle?"#fca5a5":"rgba(232,240,254,0.70)", lineHeight:1 }}>{btn.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* ── CHAT OVERLAY ─────────────────────────────────────────────── */}
            {chatOpen && (
                <>
                    <div onClick={() => setChatOpen(false)} style={{ position:"absolute",inset:0,zIndex:30,background:"rgba(4,7,16,0.55)",backdropFilter:"blur(3px)" }} />
                    <div style={{
                        position:"absolute", zIndex:31,
                        background:"rgba(8,13,26,0.98)",
                        display:"flex", flexDirection:"column",
                        ...(isMobile ? { left:0,right:0,bottom:0,height:"90%",borderRadius:"20px 20px 0 0",borderTop:"1px solid rgba(99,102,241,0.35)",animation:"chatSlideUp 0.26s cubic-bezier(0.34,1.2,0.64,1) forwards",boxShadow:"0 -8px 40px rgba(0,0,0,0.7)" }
                                     : { top:0,right:0,bottom:0,width:"340px",borderLeft:"1px solid rgba(99,102,241,0.30)",animation:"chatSlideIn 0.22s cubic-bezier(0.34,1.2,0.64,1) forwards",boxShadow:"-8px 0 40px rgba(0,0,0,0.6)" }),
                    }}>
                        {isMobile && <div style={{ display:"flex",justifyContent:"center",padding:"10px 0 4px" }}><div style={{ width:"40px",height:"4px",borderRadius:"2px",background:"rgba(255,255,255,0.20)" }} /></div>}
                        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px 12px",paddingTop:isMobile?"10px":"max(16px,env(safe-area-inset-top))",borderBottom:"1px solid rgba(255,255,255,0.07)",background:"rgba(4,7,16,0.60)" }}>
                            <div style={{ display:"flex",gap:"8px" }}>
                                {["Global","Guild"].map((tab,i) => (
                                    <button key={tab} style={{ padding:"6px 16px",borderRadius:"8px",background:i===0?"rgba(99,102,241,0.25)":"transparent",border:i===0?"1px solid rgba(99,102,241,0.50)":"1px solid rgba(255,255,255,0.10)",color:i===0?"#a5b4fc":"rgba(232,240,254,0.45)",fontFamily:"Rajdhani, sans-serif",fontWeight:700,fontSize:"14px",textTransform:"uppercase",letterSpacing:"0.06em",cursor:"pointer" }}>{tab}</button>
                                ))}
                            </div>
                            <button onClick={() => setChatOpen(false)} style={{ width:"34px",height:"34px",borderRadius:"50%",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",color:"rgba(232,240,254,0.55)",fontSize:"16px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
                        </div>
                        <div style={{ flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:"12px" }}>
                            {CHAT_MESSAGES.map((msg,i) => (
                                <div key={i} style={{ display:"flex",flexDirection:"column",gap:"2px" }}>
                                    <span style={{ fontFamily:"Rajdhani, sans-serif",fontWeight:700,fontSize:"13px",color:"#818cf8" }}>{msg.user}</span>
                                    <span style={{ fontSize:"14px",color:"rgba(232,240,254,0.82)",lineHeight:1.4 }}>{msg.text}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding:"10px 14px",paddingBottom:"max(12px,env(safe-area-inset-bottom))",borderTop:"1px solid rgba(255,255,255,0.07)",display:"flex",gap:"8px",alignItems:"center" }}>
                            <input type="text" placeholder="Enter your message..." style={{ flex:1,padding:"10px 14px",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"10px",color:"#e8f0fe",fontSize:"14px",fontFamily:"Exo 2, sans-serif",outline:"none" }} />
                            <button style={{ padding:"10px 18px",borderRadius:"10px",background:"linear-gradient(135deg,#4f46e5,#6366f1)",border:"none",color:"#fff",fontFamily:"Rajdhani, sans-serif",fontWeight:700,fontSize:"14px",cursor:"pointer" }}>Send</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
