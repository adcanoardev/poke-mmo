// apps/client/src/pages/HomePage.tsx
import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTrainer } from "../context/TrainerContext";
import { useMapDrag } from "../hooks/useMapDrag";

type District = {
    id: string; name: string; color: string;
    description: string; route: string;
    px: number; py: number;
    hitW: number; hitH: number; // fraction of map width/height (0..1)
};

// ── DISTRICTS — coords calibrated on landscape mobile calibrator ──
const DISTRICTS: District[] = [
    { id:"nexus",   name:"Nexus",     color:"#a78bfa", description:"Arcane summoning portal",        route:"/nexus",   px:0.517, py:0.402, hitW:0.154, hitH:0.179 },
    { id:"arena",   name:"Arena",     color:"#ef4444", description:"PvP · Duels · Ranked",           route:"/arena",   px:0.681, py:0.230, hitW:0.166, hitH:0.264 },
    { id:"tavern",  name:"Tavern",    color:"#f59e0b", description:"Binders · Ranking · Social",     route:"/tavern",  px:0.360, py:0.230, hitW:0.136, hitH:0.232 },
    { id:"inn",     name:"Outpost",   color:"#84cc16", description:"Mine · Forge · Inventory",       route:"/inn",     px:0.367, py:0.643, hitW:0.163, hitH:0.138 },
    { id:"market",  name:"Market",    color:"#38bdf8", description:"Shop · Gold · Diamonds",         route:"/market",  px:0.726, py:0.543, hitW:0.166, hitH:0.207 },
    { id:"arcanum", name:"Arcanum",   color:"#60a5fa", description:"Mythsdex · Encyclopedia",        route:"/arcanum", px:0.507, py:0.162, hitW:0.142, hitH:0.275 },
    { id:"guild",   name:"Guild",     color:"var(--accent-gold)", description:"Missions · Achievements · Pass", route:"/guild",   px:0.530, py:0.642, hitW:0.128, hitH:0.249 },
    { id:"ruins",   name:"The Ruins", color:"var(--accent-green)", description:"PvE · Sanctums · Boss · Tower",  route:"/ruins",   px:0.289, py:0.463, hitW:0.217, hitH:0.154 },
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

const PVP_RANKS = [
    { name: "Bronze",    color: "#cd7f32", minPvp: 0   },
    { name: "Silver",    color: "#94a3b8", minPvp: 10  },
    { name: "Gold",      color: "var(--accent-gold)", minPvp: 25  },
    { name: "Platinum",  color: "#67e8f9", minPvp: 50  },
    { name: "Diamond",   color: "#818cf8", minPvp: 100 },
    { name: "Ascendant", color: "#f472b6", minPvp: 200 },
    { name: "Mythic",    color: "#a855f7", minPvp: 400 },
];

const RARITY_MULT: Record<string, number> = {
    COMMON: 1.0, RARE: 1.2, EPIC: 1.4, ELITE: 1.6, LEGENDARY: 2.0, MYTHIC: 2.5,
};

const FRAMES = [
    { id: "default",   name: "Default",   color: "#64748b" },
    { id: "silver",    name: "Silver",    color: "#c0c0c0" },
    { id: "gold",      name: "Gold",      color: "var(--accent-gold)" },
    { id: "legendary", name: "Legendary", color: "#f59e0b" },
    { id: "mythic",    name: "Mythic",    color: "var(--accent-red)" },
];

const BOTTOM_BAR = [
    { icon: "📜", label: "Missions",   route: "/missions" },
    { icon: "⚔️", label: "Battle",     route: "/arena", isBattle: true },
    { icon: "👥", label: "Social",     route: "/tavern" },
    { icon: "🎯", label: "Challenges", route: "/challenges" },
];

function getPvpRank(pvp: number) {
    let r = PVP_RANKS[0];
    for (const rank of PVP_RANKS) { if (pvp >= rank.minPvp) r = rank; }
    return r;
}

function calcPower(myth: any): number {
    const mult = RARITY_MULT[myth?.rarity] ?? 1.0;
    return Math.floor(((myth?.maxHp??0)*0.4+(myth?.attack??0)*0.3+(myth?.defense??0)*0.2+(myth?.speed??0)*0.1)*mult);
}

function fmtGold(n: number): string {
    if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
    if (n >= 10_000)    return `${Math.floor(n/1000)}K`;
    return n.toLocaleString();
}

const CITY_URL = "https://cdn.jsdelivr.net/gh/adcanoardev/mythara-assets@6c846616e655b326640372a11da43a34cfae8dd1/maps/main_map_home_bg.webp";
const AVATAR_URL = (av: string) => `https://cdn.jsdelivr.net/gh/adcanoardev/mythara-assets@7613486785dc2b2089f6d345e1281e9316c1d982/avatars/${av}.webp`;

export default function HomePage() {
    const { trainer } = useTrainer();
    const navigate    = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef       = useRef<HTMLDivElement>(null);
    const [hoveredId,   setHoveredId]   = useState<string | null>(null);
    const [chatOpen,    setChatOpen]    = useState(false);
    const [avatarModal, setAvatarModal] = useState(false);
    const [selFrame,    setSelFrame]    = useState("gold");
    const { offset: rawOffset, onMouseDown, onTouchStart, didDrag } = useMapDrag(containerRef, mapRef, { initialYRatio: 0.44 });
    const offset = rawOffset ?? { x: 0, y: 0 };
    // Mobile: draggable 140% map. Desktop: same map but browser shows more of it naturally.


    const t           = trainer as any;
    const binderLevel = t?.binderLevel ?? 1;
    const gold        = t?.gold        ?? 0;
    const diamonds    = t?.diamonds    ?? 0;
    const npcTokens   = t?.npcTokens   ?? 0;
    const pvpTokens   = t?.pvpTokens   ?? 0;
    const avatar      = trainer?.avatar ?? "male_1";
    const username    = t?.username    ?? "Binder";
    const xp          = t?.xp          ?? 0;
    const xpMax       = Math.floor(100 * Math.pow(binderLevel, 1.8));
    const xpPct       = Math.min(100, (xp / xpMax) * 100);
    const pvpRank     = getPvpRank(pvpTokens);
    const guildTag    = t?.guildTag    ?? null;
    const party       = t?.party       ?? [];
    const totalPower  = party.reduce((acc: number, m: any) => acc + calcPower(m), 0);
    const wins        = t?.stats?.wins  ?? 0;
    const losses      = t?.stats?.losses ?? 0;
    const winRate     = (wins+losses) > 0 ? Math.round((wins/(wins+losses))*100) : 0;
    const totalMyths  = t?.totalMyths  ?? 0;
    const frameColor  = FRAMES.find(f => f.id === selFrame)?.color ?? "#fbbf24";

    const nexus = DISTRICTS.find(d => d.id === "nexus")!;

    return (
        <div className="w-screen h-screen overflow-hidden relative bg-black flex flex-col select-none">
            <style>{`
                .city-grab{cursor:grab}.city-grab:active{cursor:grabbing}
                @keyframes fogDrift{0%{transform:translateX(-40%);opacity:0}8%{opacity:var(--fog-op,.2)}92%{opacity:var(--fog-op,.2)}100%{transform:translateX(125%);opacity:0}}
                @keyframes edgeFogBreath{0%,100%{opacity:.55;transform:scaleX(1)}50%{opacity:.78;transform:scaleX(1.04)}}
                @keyframes edgeFogBreathR{0%,100%{opacity:.50;transform:scaleX(1)}50%{opacity:.72;transform:scaleX(1.05)}}
                @keyframes edgeFogBreathV{0%,100%{opacity:.42;transform:scaleY(1)}50%{opacity:.65;transform:scaleY(1.06)}}
                @keyframes nexusBeam{0%,100%{opacity:.52;filter:blur(13px);transform:translateX(-50%) scaleX(1)}50%{opacity:.92;filter:blur(8px);transform:translateX(-50%) scaleX(1.2)}}
                @keyframes nexusBeamCore{0%,100%{opacity:.65;transform:translateX(-50%) scaleX(1)}40%{opacity:1;transform:translateX(-50%) scaleX(1.4)}70%{opacity:.80;transform:translateX(-50%) scaleX(0.9)}}
                @keyframes nexusBaseGlow{0%,100%{opacity:.52;transform:translateX(-50%) scaleX(1)}50%{opacity:.95;transform:translateX(-50%) scaleX(1.28)}}
                @keyframes districtGlowPulse{0%,100%{opacity:.45}50%{opacity:.88}}
                @keyframes xpShimmer{0%{background-position:-200% center}100%{background-position:200% center}}
                @keyframes arrowBobX{0%,100%{transform:translateY(-50%) translateX(0)}50%{transform:translateY(-50%) translateX(6px)}}
                @keyframes chatSlideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
                @keyframes chatSlideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
                @keyframes modalFadeIn{from{opacity:0;transform:scale(0.97)}to{opacity:1;transform:scale(1)}}
                .bar-btn{transition:opacity 0.15s ease}.bar-btn:active{opacity:.7}
                .bar-icon-ring{width:44px;height:44px;border-radius:50%;background:linear-gradient(160deg,rgba(255,255,255,.10),rgba(255,255,255,.04));border:1.5px solid rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.10);transition:all .15s ease}
                .bar-btn:active .bar-icon-ring{transform:scale(.88)}
                .bar-icon-ring-battle{width:48px!important;height:48px!important;background:linear-gradient(160deg,rgba(239,68,68,.65),rgba(153,27,27,.85))!important;border:2px solid rgba(239,68,68,.75)!important;box-shadow:0 0 16px rgba(239,68,68,.45),0 3px 12px rgba(0,0,0,.6)!important}
                .avatar-btn:active{transform:scale(.94)}

            `}</style>

            {/* ── TOP HUD ── */}
            <div className="absolute top-0 left-0 right-0 flex items-start justify-between" style={{
                zIndex:20,
                background:"linear-gradient(to bottom,rgba(4,7,16,.72) 0%,rgba(4,7,16,.38) 65%,transparent 100%)",
                pointerEvents:"none",
                padding:"20px 16px 24px 20px",
                paddingTop:"max(20px,env(safe-area-inset-top))",
                gap:"12px",
            }}>
                {/* Avatar block — clickable */}
                <div className="flex items-center gap-3 pointer-events-auto flex-shrink-0">
                    <button className="avatar-btn" onClick={() => setAvatarModal(true)} style={{
                        position:"relative",width:86,height:86,flexShrink:0,
                        background:"none",border:"none",padding:0,cursor:"pointer",
                        transition:"transform 0.15s ease",
                    }}>
                        <div style={{ position:"absolute",inset:0,borderRadius:12,border:`2.5px solid ${frameColor}cc`,boxShadow:`0 0 18px ${frameColor}44,inset 0 0 12px rgba(0,0,0,.55)`,zIndex:2,pointerEvents:"none" }} />
                        <img src={AVATAR_URL(avatar)} onError={e=>{(e.target as HTMLImageElement).style.display="none"}}
                            style={{ width:"100%",height:"100%",objectFit:"cover",borderRadius:10,display:"block",position:"relative",zIndex:1 }} alt={username} />
                        <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,borderRadius:10,background:"linear-gradient(135deg,#1a1a2e,#16213e)",zIndex:0 }}>🧙</div>
                        <div style={{ position:"absolute",top:-10,left:-10,minWidth:32,height:32,padding:"0 7px",background:"linear-gradient(135deg,#78350f,#f59e0b,#fbbf24)",border:"2.5px solid #020810",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Rajdhani,sans-serif",fontWeight:700,fontSize:14,color:"#020810",lineHeight:1,zIndex:3 }}>{binderLevel}</div>
                    </button>

                    {/* Name + rank + power + XP */}
                    <div style={{ minWidth:0,pointerEvents:"none" }}>
                        <div style={{ fontFamily:"Rajdhani,sans-serif",fontWeight:700,fontSize:22,color:"#fff",lineHeight:1.1,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textShadow:"0 1px 6px rgba(0,0,0,.9)" }}>
                            {guildTag && <span style={{ color:"#7b2fff",marginRight:3,fontWeight:900,letterSpacing:".08em" }}>[{guildTag}]</span>}
                            {username}
                        </div>
                        <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:3 }}>
                            <span style={{ fontSize:13,color:"rgba(251,191,36,.70)",fontFamily:"Rajdhani,sans-serif",fontWeight:600 }}>Binder · Lv {binderLevel}</span>
                            <span style={{ fontSize:11,fontFamily:"Rajdhani,sans-serif",fontWeight:700,color:pvpRank.color,padding:"1px 7px",borderRadius:5,background:`${pvpRank.color}22`,border:`1px solid ${pvpRank.color}55`,textShadow:`0 0 8px ${pvpRank.color}88` }}>{pvpRank.name}</span>
                        </div>
                        {totalPower > 0 && (
                            <div style={{ marginTop:2 }}>
                                <span style={{ fontSize:11,fontFamily:"Rajdhani,sans-serif",fontWeight:700,color:"var(--accent-gold)" }}>⚡ {totalPower.toLocaleString()} PWR</span>
                            </div>
                        )}
                        <div style={{ width:140,height:18,background:"rgba(255,255,255,.10)",borderRadius:6,marginTop:5,overflow:"hidden",position:"relative" }}>
                            <div style={{ width:`${xpPct}%`,height:"100%",borderRadius:6,background:"linear-gradient(90deg,#facc15 0%,#fde68a 45%,#facc15 60%,#facc15 100%)",backgroundSize:"200% auto",animation:"xpShimmer 3s linear infinite",transition:"width 0.5s" }} />
                            <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontFamily:"Rajdhani,sans-serif",fontWeight:700,color:xpPct>40?"#020810":"rgba(251,191,36,.90)",textShadow:xpPct>40?"none":"0 1px 3px rgba(0,0,0,.8)" }}>{Math.round(xpPct)}% XP</div>
                        </div>
                    </div>
                </div>

                {/* Resources + chat */}
                <div style={{ display:"flex",alignItems:"center",gap:6,pointerEvents:"auto",flexWrap:"nowrap" }}>
                    {[
                        { icon:"⚡",  value:String(npcTokens), color:"var(--text-primary)", border:"rgba(255,255,255,.14)" },
                        { icon:"⚔️", value:String(pvpTokens), color:"var(--text-primary)", border:"rgba(255,255,255,.14)" },
                        { icon:"💎",  value:String(diamonds),  color:"#c4b5fd", border:"rgba(139,92,246,.45)" },
                        { icon:"🪙",  value:fmtGold(gold),     color:"#fcd34d", border:"rgba(251,191,36,.45)" },
                    ].map(({ icon, value, color, border }) => (
                        <div key={icon} style={{ display:"flex",alignItems:"center",gap:5,background:"rgba(4,7,16,.88)",border:`1px solid ${border}`,borderRadius:10,padding:"6px 11px" }}>
                            <span style={{ fontSize:15,lineHeight:1 }}>{icon}</span>
                            <span style={{ fontFamily:"Rajdhani,sans-serif",fontWeight:700,fontSize:15,color,lineHeight:1 }}>{value}</span>
                        </div>
                    ))}
                    <button onClick={() => setChatOpen(true)} style={{ width:38,height:38,borderRadius:10,background:"rgba(4,7,16,.88)",border:"1px solid rgba(99,102,241,.50)",boxShadow:"0 0 10px rgba(99,102,241,.20)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:17,flexShrink:0,marginLeft:8,transition:"all .15s ease" }}>💬</button>
                </div>
            </div>

            {/* ── CITY MAP ── */}
            <div ref={containerRef} className="flex-1 relative overflow-hidden"
                style={{ touchAction:"none" }}
                onMouseDown={onMouseDown}
                onTouchStart={onTouchStart}>
                <div ref={mapRef} className="absolute top-0 left-0"
                    style={{ width:"max(140%,560px)", height:"160%", transform:`translate(${offset.x}px,${offset.y}px)`, willChange:"transform", touchAction:"none" }}>
                    <img src={CITY_URL} alt="City of Mythara" draggable={false} className="absolute inset-0 w-full h-full pointer-events-none" style={{ objectFit:"cover", objectPosition:"center center", userSelect:"none" }} />
                    <div className="absolute inset-0 pointer-events-none" style={{ background:"rgba(4,7,16,.06)" }} />
                    <div className="absolute inset-0 pointer-events-none" style={{ background:"radial-gradient(ellipse 92% 90% at 50% 50%,transparent 36%,rgba(4,7,16,.86) 100%)" }} />

                    <div className="absolute pointer-events-none" style={{ top:0,left:0,width:"22%",height:"100%",background:"linear-gradient(to right,rgba(8,12,24,.75),rgba(8,12,24,.35) 55%,transparent)",transformOrigin:"left center",animation:"edgeFogBreath 8s ease-in-out infinite",zIndex:2 }} />
                    <div className="absolute pointer-events-none" style={{ top:0,right:0,width:"22%",height:"100%",background:"linear-gradient(to left,rgba(8,12,24,.75),rgba(8,12,24,.35) 55%,transparent)",transformOrigin:"right center",animation:"edgeFogBreathR 9.5s ease-in-out infinite",zIndex:2 }} />
                    <div className="absolute pointer-events-none" style={{ top:0,left:0,right:0,height:"16%",background:"linear-gradient(to bottom,rgba(8,12,24,.68),transparent)",transformOrigin:"center top",animation:"edgeFogBreathV 11s ease-in-out infinite",zIndex:2 }} />
                    <div className="absolute pointer-events-none" style={{ bottom:0,left:0,right:0,height:"16%",background:"linear-gradient(to top,rgba(8,12,24,.68),transparent)",transformOrigin:"center bottom",animation:"edgeFogBreathV 13s ease-in-out infinite 2s",zIndex:2 }} />

                    {FOG_DRIFT.map(f => (
                        <div key={f.id} className="absolute pointer-events-none" style={{ top:f.top,left:0,width:f.w,height:f.h,borderRadius:"50%",background:"radial-gradient(ellipse,rgba(190,210,248,.50) 0%,rgba(155,182,235,.16) 55%,transparent 76%)",filter:`blur(${f.blur})`,["--fog-op" as any]:f.op,animation:`fogDrift ${f.dur} ${f.delay} linear infinite`,zIndex:3 }} />
                    ))}

                    {/* Nexus beam */}
                    <div className="absolute pointer-events-none" style={{ left:`${nexus.px*100}%`,top:`${nexus.py*100}%`,zIndex:4 }}>
                        <div style={{ position:"absolute",top:"30%",left:"50%",width:"clamp(55px,7vw,95px)",height:"clamp(75px,9vw,135px)",transform:"translate(-50%,-100%)",background:"linear-gradient(to top,rgba(205,228,255,.55),rgba(232,246,255,.82) 40%,rgba(248,254,255,.52) 72%,transparent)",filter:"blur(13px)",animation:"nexusBeam 4s ease-in-out infinite",mixBlendMode:"screen" }} />
                        <div style={{ position:"absolute",top:"30%",left:"50%",width:"clamp(11px,1.4vw,20px)",height:"clamp(58px,7.5vw,110px)",transform:"translate(-50%,-100%)",background:"linear-gradient(to top,rgba(232,246,255,.95),rgba(255,255,255,1) 40%,rgba(242,250,255,.65) 72%,transparent)",filter:"blur(3px)",animation:"nexusBeamCore 3s ease-in-out infinite",mixBlendMode:"screen" }} />
                        <div style={{ position:"absolute",top:"44%",left:"50%",width:"clamp(80px,10vw,145px)",height:"clamp(26px,3vw,44px)",transform:"translate(-50%,-50%)",borderRadius:"50%",background:"radial-gradient(ellipse,rgba(215,235,255,.90),rgba(175,208,255,.45) 42%,transparent 72%)",filter:"blur(9px)",animation:"nexusBaseGlow 3s ease-in-out infinite .4s" }} />
                    </div>

                    {/* Districts */}
                    {DISTRICTS.map(d => {
                        const hovered = hoveredId === d.id;
                        return (
                            <div key={d.id} className="absolute" style={{ left:`${d.px*100}%`,top:`${d.py*100}%`,transform:"translate(-50%,-50%)",width:`${d.hitW*100}%`,height:`${d.hitH*100}%`,zIndex:5,pointerEvents:"all",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end" }}
                                onMouseEnter={() => setHoveredId(d.id)} onMouseLeave={() => setHoveredId(null)} onClick={() => { if (!didDrag.current) navigate(d.route); }}>
                                <div style={{ position:"absolute",inset:0,borderRadius:"40%",background:`radial-gradient(ellipse,${d.color}38 0%,${d.color}12 55%,transparent 78%)`,opacity:hovered?1:0,transition:"opacity .3s ease",animation:hovered?"districtGlowPulse 1.8s ease-in-out infinite":"none",pointerEvents:"none" }} />

                                <div style={{ position:"relative",background:hovered?"rgba(4,7,16,.88)":"rgba(4,7,16,.68)",border:`1.5px solid ${hovered?d.color+"cc":d.color+"55"}`,borderRadius:8,padding:"5px 16px",marginBottom:5,backdropFilter:"blur(6px)",boxShadow:hovered?`0 0 20px ${d.color}55,0 2px 14px rgba(0,0,0,.9)`:"0 2px 10px rgba(0,0,0,.7)",transition:"all .2s ease",pointerEvents:"none" }}>
                                    <div style={{ color:"#fff",fontSize:hovered?"28px":"22px",fontFamily:"Rajdhani,sans-serif",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",lineHeight:1,whiteSpace:"nowrap",textShadow:hovered?`0 0 22px ${d.color},0 0 10px ${d.color}99,0 2px 8px rgba(0,0,0,1)`:"0 1px 4px rgba(0,0,0,1),0 2px 12px rgba(0,0,0,1)",transition:"font-size .18s ease,text-shadow .2s ease" }}>{d.name}</div>
                                </div>
                                {hovered && <div style={{ position:"relative",color:"#fff",fontSize:16,fontFamily:"Exo 2,sans-serif",fontWeight:600,whiteSpace:"nowrap",marginBottom:4,textShadow:`0 0 14px ${d.color},0 1px 6px rgba(0,0,0,1)`,pointerEvents:"none",background:"rgba(4,7,16,.80)",border:`1px solid ${d.color}55`,borderRadius:6,padding:"4px 14px" }}>{d.description}</div>}
                            </div>
                        );
                    })}

                </div>


                <div className="absolute pointer-events-none md:hidden" style={{ right:14,top:"50%",zIndex:8,color:"rgba(232,240,254,.28)",fontSize:28,animation:"arrowBobX 1.5s ease-in-out infinite" }}>›</div>
                <div className="absolute pointer-events-none md:hidden" style={{ left:14,top:"50%",zIndex:8,color:"rgba(232,240,254,.28)",fontSize:28,animation:"arrowBobX 1.5s ease-in-out infinite reverse" }}>‹</div>
            </div>

            {/* ── BOTTOM BAR ── */}
            <div style={{ position:"absolute",bottom:0,left:0,right:0,zIndex:20,background:"rgba(4,7,16,0.72)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderTop:"1px solid rgba(255,255,255,.08)",paddingBottom:"max(6px,env(safe-area-inset-bottom))",paddingTop:4,display:"flex",alignItems:"stretch",boxShadow:"0 -1px 24px rgba(0,0,0,.5)" }}>
                {BOTTOM_BAR.map((btn, idx) => (
                    <button key={btn.route} className="bar-btn" onClick={() => navigate(btn.route)} style={{ flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",gap:4,minHeight:58,padding:"6px 4px 5px",background:"transparent",border:"none",cursor:"pointer",position:"relative",borderRight:idx<BOTTOM_BAR.length-1?"1px solid rgba(255,255,255,.06)":"none" }}>
                        <div style={{ position:"absolute",top:0,left:"20%",right:"20%",height:2,borderRadius:"0 0 2px 2px",background:(btn as any).isBattle?"linear-gradient(90deg,transparent,rgba(239,68,68,.85),transparent)":"linear-gradient(90deg,transparent,rgba(255,255,255,.14),transparent)" }} />
                        <div className={`bar-icon-ring${(btn as any).isBattle?" bar-icon-ring-battle":""}`}>
                            <span style={{ fontSize:(btn as any).isBattle?22:18,lineHeight:1 }}>{btn.icon}</span>
                        </div>
                        <span style={{ fontFamily:"Rajdhani,sans-serif",fontWeight:700,fontSize:9,textTransform:"uppercase",letterSpacing:".09em",lineHeight:1,color:(btn as any).isBattle?"#fca5a5":"rgba(232,240,254,.60)" }}>{btn.label}</span>
                    </button>
                ))}
            </div>

            {/* ── AVATAR MODAL ── */}
            {avatarModal && (
                <>
                    <div onClick={() => setAvatarModal(false)} style={{ position:"fixed",inset:0,zIndex:40,background:"rgba(4,7,16,.82)",backdropFilter:"blur(8px)" }} />
                    <div style={{ position:"fixed",inset:0,zIndex:41,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none" }}>
                        <div style={{ pointerEvents:"all",width:"100%",maxWidth:400,height:"100dvh",maxHeight:"100dvh",background:"rgba(5,9,20,.99)",borderRadius:0,border:"none",display:"flex",flexDirection:"column",overflow:"hidden",animation:"modalFadeIn .22s cubic-bezier(.34,1.2,.64,1) forwards" }}
                            ref={el => {
                                if (!el) return;
                                const apply = () => {
                                    const d = window.innerWidth >= 480;
                                    el.style.height       = d ? "auto"  : "100dvh";
                                    el.style.maxHeight    = d ? "88dvh" : "100dvh";
                                    el.style.borderRadius = d ? "20px"  : "0";
                                    el.style.border       = d ? "1px solid rgba(56,189,248,.22)" : "none";
                                    el.style.boxShadow    = d ? "0 0 0 1px rgba(56,189,248,.10),0 32px 80px rgba(0,0,0,.90)" : "none";
                                };
                                apply();
                                window.addEventListener("resize", apply);
                            }}
                        >
                            {/* Header */}
                            <div style={{ flexShrink:0,padding:"16px 16px 12px",background:"linear-gradient(135deg,rgba(13,21,37,.98),rgba(17,29,53,.98))",borderBottom:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",gap:12,position:"relative" }}>
                                <div style={{ width:64,height:64,borderRadius:12,border:`3px solid ${frameColor}`,boxShadow:`0 0 18px ${frameColor}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,flexShrink:0,position:"relative",overflow:"hidden",background:"linear-gradient(135deg,#1a1a2e,#16213e)" }}>
                                    <img src={AVATAR_URL(avatar)} onError={e=>{(e.target as HTMLImageElement).style.display="none"}} style={{ position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",borderRadius:10 }} alt="" />
                                    <span style={{ position:"relative",zIndex:1 }}>🧙</span>
                                </div>
                                <div style={{ flex:1,minWidth:0 }}>
                                    <div style={{ fontFamily:"Rajdhani,sans-serif",fontWeight:900,fontSize:20,color:"var(--text-primary)",letterSpacing:".04em" }}>
                                        {guildTag && <span style={{ color:"#7b2fff",marginRight:4,fontWeight:900,letterSpacing:".08em" }}>[{guildTag}]</span>}
                                        {username}
                                    </div>
                                    <div style={{ display:"flex",alignItems:"center",gap:8,marginTop:3 }}>
                                        <span style={{ fontSize:11,fontFamily:"Rajdhani,sans-serif",fontWeight:700,color:pvpRank.color,padding:"1px 7px",borderRadius:5,background:`${pvpRank.color}18`,border:`1px solid ${pvpRank.color}40` }}>{pvpRank.name}</span>
                                        {totalPower>0 && <span style={{ fontSize:11,fontFamily:"Rajdhani,sans-serif",fontWeight:700,color:"var(--accent-gold)" }}>⚡ {totalPower.toLocaleString()} PWR</span>}
                                    </div>
                                </div>
                                <button onClick={() => setAvatarModal(false)} style={{ position:"absolute",top:12,right:12,width:32,height:32,borderRadius:"50%",background:"rgba(56,189,248,.15)",border:"2px solid rgba(56,189,248,.65)",color:"#38bdf8",display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,cursor:"pointer",boxShadow:"0 0 12px rgba(56,189,248,.30)" }}>✕</button>
                            </div>

                            {/* Scrollable body */}
                            <div style={{ flex:1,overflowY:"auto",display:"flex",flexDirection:"column" }}>
                                {/* XP bar */}
                                <div style={{ padding:"10px 16px 12px",borderBottom:"1px solid rgba(255,255,255,.05)" }}>
                                    <div style={{ display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:9,fontFamily:"monospace",color:"rgba(255,255,255,.3)" }}>
                                        <span>XP {xp} / {xpMax}</span>
                                        <span>Lv. {binderLevel} → {binderLevel+1}</span>
                                    </div>
                                    <div style={{ height:7,background:"rgba(255,255,255,.07)",borderRadius:4,overflow:"hidden" }}>
                                        <div style={{ width:`${xpPct}%`,height:"100%",borderRadius:4,background:"linear-gradient(90deg,#facc15,#fde68a)",transition:"width .5s" }} />
                                    </div>
                                </div>

                                {/* Stats grid */}
                                <div style={{ padding:"12px 16px 14px",borderBottom:"1px solid rgba(255,255,255,.05)" }}>
                                    <p style={{ fontSize:9,fontFamily:"monospace",letterSpacing:".12em",color:"rgba(255,255,255,.25)",textTransform:"uppercase",marginBottom:10 }}>Combat & Economy</p>
                                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:7 }}>
                                        {[
                                            { val:wins,            label:"NPC Wins",    color:"var(--accent-green)" },
                                            { val:`${winRate}%`,   label:"Win Rate",    color:"var(--accent-blue)" },
                                            { val:fmtGold(gold),   label:"Gold",        color:"#fcd34d" },
                                            { val:`${diamonds}💎`, label:"Diamonds",    color:"#c4b5fd" },
                                            { val:totalMyths,      label:"Myths Owned", color:"#a78bfa" },
                                            { val:pvpTokens,       label:"PvP Tokens",  color:pvpRank.color },
                                        ].map(({ val, label, color }) => (
                                            <div key={label} style={{ background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"10px 12px" }}>
                                                <div style={{ fontFamily:"Rajdhani,sans-serif",fontWeight:900,fontSize:20,lineHeight:1,color }}>{val}</div>
                                                <div style={{ fontSize:9,fontFamily:"monospace",color:"rgba(255,255,255,.28)",marginTop:3,textTransform:"uppercase",letterSpacing:".08em" }}>{label}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Frame picker */}
                                <div style={{ padding:"12px 16px 16px" }}>
                                    <p style={{ fontSize:9,fontFamily:"monospace",letterSpacing:".12em",color:"rgba(255,255,255,.25)",textTransform:"uppercase",marginBottom:12 }}>Avatar Frame</p>
                                    <div style={{ display:"flex",gap:12 }}>
                                        {FRAMES.map(f => (
                                            <button key={f.id} onClick={() => setSelFrame(f.id)} style={{ display:"flex",flexDirection:"column",alignItems:"center",gap:4,background:"none",border:"none",cursor:"pointer",padding:0,transition:"transform .15s",transform:selFrame===f.id?"scale(1.18)":"scale(1)" }}>
                                                <div style={{ width:40,height:40,borderRadius:"50%",border:`2.5px solid ${selFrame===f.id?f.color:f.color+"55"}`,background:`${f.color}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:selFrame===f.id?`0 0 14px ${f.color}70`:"none",transition:"all .15s" }}>🧙</div>
                                                <span style={{ fontSize:8,fontFamily:"monospace",letterSpacing:".06em",color:selFrame===f.id?f.color:"rgba(255,255,255,.28)" }}>{f.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Actions — pinned bottom */}
                            <div style={{ flexShrink:0,padding:"12px 16px 16px",display:"flex",gap:8,borderTop:"1px solid rgba(255,255,255,.08)",background:"rgba(5,9,20,.98)" }}>
                                <button onClick={() => { setAvatarModal(false); navigate("/profile"); }} style={{ flex:1,padding:12,borderRadius:14,background:"rgba(56,189,248,.12)",border:"1.5px solid rgba(56,189,248,.50)",color:"#38bdf8",fontFamily:"Rajdhani,sans-serif",fontWeight:700,fontSize:12,textTransform:"uppercase",letterSpacing:".1em",cursor:"pointer",boxShadow:"0 0 14px rgba(56,189,248,.15)" }}>Full Profile →</button>
                                <button onClick={() => { setAvatarModal(false); navigate("/settings"); }} style={{ padding:"12px 16px",borderRadius:14,background:"rgba(255,255,255,.05)",border:"1.5px solid rgba(255,255,255,.14)",color:"rgba(255,255,255,.55)",fontSize:18,cursor:"pointer" }}>⚙</button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ── CHAT OVERLAY ── */}
            {chatOpen && (
                <>
                    <div onClick={() => setChatOpen(false)} style={{ position:"absolute",inset:0,zIndex:30,background:"rgba(4,7,16,.55)",backdropFilter:"blur(3px)" }} />
                    <div style={{ position:"absolute",zIndex:31,background:"rgba(8,13,26,.98)",display:"flex",flexDirection:"column",...(isMobile?{ left:0,right:0,bottom:0,height:"90%",borderRadius:"20px 20px 0 0",borderTop:"1px solid rgba(99,102,241,.35)",animation:"chatSlideUp .26s cubic-bezier(.34,1.2,.64,1) forwards",boxShadow:"0 -8px 40px rgba(0,0,0,.7)"}:{ top:0,right:0,bottom:0,width:340,borderLeft:"1px solid rgba(99,102,241,.30)",animation:"chatSlideIn .22s cubic-bezier(.34,1.2,.64,1) forwards",boxShadow:"-8px 0 40px rgba(0,0,0,.6)"}) }}>
                        {isMobile && <div style={{ display:"flex",justifyContent:"center",padding:"10px 0 4px" }}><div style={{ width:40,height:4,borderRadius:2,background:"rgba(255,255,255,.20)" }} /></div>}
                        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px 12px",paddingTop:isMobile?"10px":"max(16px,env(safe-area-inset-top))",borderBottom:"1px solid rgba(255,255,255,.07)",background:"rgba(4,7,16,.60)" }}>
                            <div style={{ display:"flex",gap:8 }}>
                                {["Global","Guild"].map((tab,i) => (
                                    <button key={tab} style={{ padding:"6px 16px",borderRadius:8,background:i===0?"rgba(99,102,241,.25)":"transparent",border:i===0?"1px solid rgba(99,102,241,.50)":"1px solid rgba(255,255,255,.10)",color:i===0?"#a5b4fc":"rgba(232,240,254,.45)",fontFamily:"Rajdhani,sans-serif",fontWeight:700,fontSize:14,textTransform:"uppercase",letterSpacing:".06em",cursor:"pointer" }}>{tab}</button>
                                ))}
                            </div>
                            <button onClick={() => setChatOpen(false)} style={{ width:34,height:34,borderRadius:"50%",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",color:"rgba(232,240,254,.55)",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>✕</button>
                        </div>
                        <div style={{ flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:12 }}>
                            {CHAT_MESSAGES.map((msg,i) => (
                                <div key={i} style={{ display:"flex",flexDirection:"column",gap:2 }}>
                                    <span style={{ fontFamily:"Rajdhani,sans-serif",fontWeight:700,fontSize:13,color:"#818cf8" }}>{msg.user}</span>
                                    <span style={{ fontSize:14,color:"rgba(232,240,254,.82)",lineHeight:1.4 }}>{msg.text}</span>
                                </div>
                            ))}
                        </div>
                        <div style={{ padding:"10px 14px",paddingBottom:"max(12px,env(safe-area-inset-bottom))",borderTop:"1px solid rgba(255,255,255,.07)",display:"flex",gap:8,alignItems:"center" }}>
                            <input type="text" placeholder="Enter your message..." style={{ flex:1,padding:"10px 14px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,color:"var(--text-primary)",fontSize:14,fontFamily:"Exo 2,sans-serif",outline:"none" }} />
                            <button style={{ padding:"10px 18px",borderRadius:10,background:"linear-gradient(135deg,#4f46e5,#6366f1)",border:"none",color:"#fff",fontFamily:"Rajdhani,sans-serif",fontWeight:700,fontSize:14,cursor:"pointer" }}>Send</button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
