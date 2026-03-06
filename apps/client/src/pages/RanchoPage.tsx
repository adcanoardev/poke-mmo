import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import TrainerSidebar from "../components/TrainerSidebar";
import { api } from "../lib/api";

function msToTime(ms: number) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min ${s % 60}s`;
}

const STRUCTURES = [
    { type: "POKEBALL_FACTORY", icon: "🏭", name: "Fábrica de Pokéballs", desc: "Produce Pokéballs automáticamente" },
    { type: "LAB", icon: "🏥", name: "Laboratorio", desc: "Produce pociones y curaciones" },
    { type: "NURSERY", icon: "🥚", name: "Guardería", desc: "Cría huevos con IVs aleatorios" },
];

export default function RanchoPage() {
    const [mine, setMine] = useState<any>(null);
    const [inventory, setInventory] = useState<any[]>([]);
    const [collecting, setCollecting] = useState(false);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        Promise.all([api.mineStatus(), api.inventory()]).then(([m, inv]) => {
            setMine(m);
            setInventory(inv);
        });
    }, []);

    async function handleCollect() {
        setCollecting(true);
        setMsg("");
        try {
            const res = await api.mineCollect();
            setMsg(`✅ Recogiste ${res.collected.quantity}x ${res.collected.item.replace(/_/g, " ")}`);
            const [m, inv] = await Promise.all([api.mineStatus(), api.inventory()]);
            setMine(m);
            setInventory(inv);
        } catch (e: any) {
            setMsg(`⏱ ${e.message}`);
        } finally {
            setCollecting(false);
        }
    }

    return (
        <Layout sidebar={<TrainerSidebar />}>
            <div className="flex items-center justify-between mb-6">
                <h1 className="font-display font-bold text-3xl tracking-widest">
                    Mi <span className="text-red">Rancho</span>
                </h1>
                {inventory.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                        {inventory.slice(0, 3).map((item: any) => (
                            <div
                                key={item.item}
                                className="bg-card border border-border rounded-xl px-3 py-1.5 flex items-center gap-2 text-sm"
                            >
                                <span className="text-yellow font-bold font-display">{item.quantity}x</span>
                                <span className="text-muted text-xs">{item.item.replace(/_/g, " ")}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {msg && (
                <div
                    className="mb-4 px-4 py-3 rounded-xl border text-sm font-semibold"
                    style={{ background: "rgba(6,214,160,0.1)", borderColor: "rgba(6,214,160,0.3)", color: "#06d6a0" }}
                >
                    {msg}
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                {/* Mina */}
                <div
                    className={`bg-card border rounded-2xl p-6 transition-all relative overflow-hidden
                    ${mine?.ready ? "border-green/40" : "border-border hover:border-blue/30"}`}
                    style={mine?.ready ? { boxShadow: "0 0 20px rgba(6,214,160,0.15)" } : {}}
                >
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-5xl">⛏️</span>
                        <span className="bg-bg3 border border-border rounded-lg px-2 py-1 text-xs text-muted font-display font-semibold tracking-widest">
                            NIV {mine?.level ?? 1}
                        </span>
                    </div>
                    <div className="font-display font-bold text-xl mb-1">Mina</div>
                    <div className="text-muted text-xs mb-4">Produce piedras de evolución y objetos raros</div>
                    {mine?.ready ? (
                        <>
                            <div className="text-green text-sm font-semibold mb-3">✅ ¡Lista para recoger!</div>
                            <div
                                className="w-full h-1 rounded-full mb-3"
                                style={{ background: "linear-gradient(90deg, #06d6a0, #4cc9f0)" }}
                            />
                            <button
                                onClick={handleCollect}
                                disabled={collecting}
                                className="w-full py-2.5 rounded-xl font-display font-bold text-sm tracking-widest uppercase text-bg disabled:opacity-50"
                                style={{
                                    background: "linear-gradient(135deg, #06d6a0, #04a57a)",
                                    boxShadow: "0 0 16px rgba(6,214,160,0.3)",
                                }}
                            >
                                {collecting ? "..." : "Recoger objetos"}
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="text-muted text-xs mb-2">
                                ⏱ Lista en {mine ? msToTime(mine.nextCollectMs) : "..."}
                            </div>
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: mine
                                            ? `${Math.max(2, 100 - (mine.nextCollectMs / (4 * 3600 * 1000)) * 100)}%`
                                            : "2%",
                                        background: "linear-gradient(90deg, #4cc9f0, #7b2fff)",
                                    }}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Otras estructuras */}
                {STRUCTURES.map((s) => (
                    <div
                        key={s.type}
                        className="bg-card border border-border rounded-2xl p-6 hover:border-blue/30 transition-all"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <span className="text-5xl">{s.icon}</span>
                            <span className="bg-bg3 border border-border rounded-lg px-2 py-1 text-xs text-muted font-display font-semibold tracking-widest">
                                NIV 1
                            </span>
                        </div>
                        <div className="font-display font-bold text-xl mb-1">{s.name}</div>
                        <div className="text-muted text-xs mb-4">{s.desc}</div>
                        <div className="text-muted text-xs mb-2">⏱ Próximamente</div>
                        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                                className="h-full w-1/3 rounded-full"
                                style={{ background: "linear-gradient(90deg, #4cc9f0, #7b2fff)" }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </Layout>
    );
}
