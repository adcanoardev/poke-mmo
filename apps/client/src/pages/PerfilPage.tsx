import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import TrainerSidebar from "../components/TrainerSidebar";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

const EMBLEM_INFO = [
    { icon:"🪨", name:"Emblema Roca",        level:10 },
    { icon:"💧", name:"Emblema Marea",        level:15 },
    { icon:"⚡", name:"Emblema Tormenta",     level:20 },
    { icon:"🌿", name:"Emblema Bosque",       level:25 },
    { icon:"☠️", name:"Emblema Veneno",       level:30 },
    { icon:"✨", name:"Emblema Astral",       level:35 },
    { icon:"🔥", name:"Emblema Brasas",       level:40 },
    { icon:"🌑", name:"Emblema Sombra",       level:50 },
];

const RANK_LABELS     = ["Novato","Binder","Rival","Élite","Maestro"];
const RANK_COLORS     = ["#5a6a85","#4cc9f0","#e63946","#7b2fff","#ffd60a"];
const RANK_THRESHOLDS = [0,100,300,600,1000];

export default function PerfilPage() {
    const { user }              = useAuth();
    const [trainer, setTrainer] = useState<any>(null);
    const [party,   setParty]   = useState<any[]>([]);

    useEffect(() => {
        Promise.all([api.trainer(), api.party()])
            .then(([t, p]) => { setTrainer(t); setParty(p); });
    }, []);

    const xpForLevel = (lvl: number) => Math.floor(100 * Math.pow(lvl, 1.8));
    const xpPct    = trainer ? Math.min(100, Math.round((trainer.xp / xpForLevel(trainer.level)) * 100)) : 0;
    const rankIdx  = trainer ? RANK_THRESHOLDS.filter(t => trainer.prestige >= t).length - 1 : 0;

    return (
        <Layout sidebar={<TrainerSidebar />}>
            {/* Banner */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-border relative overflow-hidden"
                style={{ background: "linear-gradient(135deg, #0d1525, #111d35)" }}>
                <div className="absolute inset-0"
                    style={{ background: "radial-gradient(ellipse 60% 100% at 90% 50%, rgba(123,47,255,0.15) 0%, transparent 60%)" }}/>
                <div className="relative flex items-center gap-5">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-3xl flex-shrink-0"
                        style={{ background:"linear-gradient(135deg,#7b2fff,#4cc9f0)", boxShadow:"0 0 20px rgba(76,201,240,0.3)" }}>
                        🧢
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="font-display font-bold text-2xl">{user?.username}</div>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-muted text-sm">Nivel {trainer?.level ?? 1}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full border font-display font-semibold"
                                style={{ borderColor:`${RANK_COLORS[rankIdx]}44`, color:RANK_COLORS[rankIdx], background:`${RANK_COLORS[rankIdx]}15` }}>
                                {RANK_LABELS[rankIdx]}
                            </span>
                        </div>
                        <div className="mt-2 max-w-xs">
                            <div className="bg-white/5 rounded-full h-1.5 overflow-hidden mb-0.5">
                                <div className="h-full rounded-full"
                                    style={{ width:`${xpPct}%`, background:"linear-gradient(90deg,#4cc9f0,#7b2fff)" }}/>
                            </div>
                            <div className="text-xs text-muted">{trainer?.xp ?? 0} / {xpForLevel(trainer?.level ?? 1)} XP</div>
                        </div>
                    </div>
                    <div className="flex gap-6 text-center flex-shrink-0">
                        <div>
                            <div className="font-display font-bold text-xl text-yellow">{trainer?.coins ?? 0}</div>
                            <div className="text-xs text-muted">Monedas</div>
                        </div>
                        <div>
                            <div className="font-display font-bold text-xl" style={{color:"#a78bfa"}}>{trainer?.prestige ?? 0}</div>
                            <div className="text-xs text-muted">Prestigio</div>
                        </div>
                        <div>
                            <div className="font-display font-bold text-xl text-blue">{trainer?.medals?.length ?? 0}/8</div>
                            <div className="text-xs text-muted">Emblemas</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex gap-4 p-6 overflow-hidden">
                {/* Emblemas */}
                <div className="flex-1 bg-card border border-border rounded-2xl p-5 flex flex-col overflow-hidden">
                    <div className="font-display font-bold text-lg tracking-widest mb-4 flex-shrink-0">🏅 Emblemas</div>
                    <div className="grid grid-cols-4 gap-4 flex-1 content-center">
                        {EMBLEM_INFO.map((emblem, i) => {
                            const earned = trainer?.medals?.includes(i);
                            return (
                                <div key={i} className="text-center">
                                    <div className={`text-4xl transition-all ${earned ? "" : "grayscale opacity-25"}`}>{emblem.icon}</div>
                                    <div className="text-xs mt-1 font-display" style={{ color: earned ? "#ffd60a" : "#5a6a85" }}>
                                        {earned ? emblem.name.split(" ")[1] : `Nv.${emblem.level}`}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Equipo */}
                <div className="w-64 flex-shrink-0 bg-card border border-border rounded-2xl p-5 flex flex-col overflow-hidden">
                    <div className="font-display font-bold text-lg tracking-widest mb-4 flex-shrink-0">🐾 Equipo</div>
                    {party.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-muted text-sm text-center font-display tracking-widest">
                            Sin Myths en el equipo
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2 flex-1 overflow-y-auto">
                            {party.map((p: any) => (
                                <div key={p.id} className="flex items-center gap-3 bg-bg3 rounded-xl p-3">
                                    <div className="text-3xl flex-shrink-0">{p.art?.portrait ?? "❓"}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-display font-bold text-sm truncate">{p.name ?? p.speciesId}</div>
                                        <div className="text-muted text-xs">Nv. {p.level}</div>
                                    </div>
                                    <div className="text-right text-xs text-muted flex-shrink-0">
                                        <div>{p.hp}/{p.maxHp} HP</div>
                                        <div>ATK {p.attack}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </Layout>
    );
}