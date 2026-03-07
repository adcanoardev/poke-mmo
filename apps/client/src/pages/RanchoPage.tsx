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
    { type: "POKEBALL_FACTORY", icon: "🏭", name: "Fábrica", desc: "Produce Fragmentos de captura" },
    { type: "LAB", icon: "🏥", name: "Laboratorio", desc: "Produce pociones" },
    { type: "NURSERY", icon: "🥚", name: "Guardería", desc: "Cría huevos" },
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
            setMsg(`✅ ${res.collected.quantity}x ${res.collected.item.replace(/_/g, " ")}`);
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
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
                <h1 className="font-display font-bold text-2xl tracking-widest">
                    Mi <span className="text-red">Rancho</span>
                </h1>
                <div className="flex gap-2">
                    {inventory.slice(0, 4).map((item: any) => (
                        <div
                            key={item.item}
                            className="bg-bg3 border border-border rounded-lg px-2 py-1 flex items-center gap-1 text-xs"
                        >
                            <span className="text-yellow font-bold font-display">{item.quantity}</span>
                            <span className="text-muted">{item.item.replace(/_/g, " ")}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Mensaje */}
            {msg && (
                <div
                    className="flex-shrink-0 mx-6 mt-3 px-4 py-2 rounded-xl border text-sm font-semibold"
                    style={{ background: "rgba(6,214,160,0.1)", borderColor: "rgba(6,214,160,0.3)", color: "#06d6a0" }}
                >
                    {msg}
                </div>
            )}

            {/* Grid de estructuras — ocupa todo el espacio restante */}
            <div className="flex-1 p-6 grid grid-cols-2 grid-rows-2 gap-4 overflow-hidden">
                {/* Mina */}
                <div
                    className={`bg-card border rounded-2xl p-5 flex flex-col transition-all
                    ${mine?.ready ? "border-green/40" : "border-border"}`}
                    style={mine?.ready ? { boxShadow: "0 0 20px rgba(6,214,160,0.15)" } : {}}
                >
                    <div className="flex justify-between items-start mb-3">
                        <span className="text-4xl">⛏️</span>
                        <span className="bg-bg3 border border-border rounded-lg px-2 py-0.5 text-xs text-muted font-display font-semibold">
                            NIV {mine?.level ?? 1}
                        </span>
                    </div>
                    <div className="font-display font-bold text-lg mb-1">Mina</div>
                    <div className="text-muted text-xs mb-3 flex-1">Produce piedras de evolución y objetos raros</div>
                    {mine?.ready ? (
                        <>
                            <div className="text-green text-xs font-semibold mb-2">✅ ¡Lista!</div>
                            <button
                                onClick={handleCollect}
                                disabled={collecting}
                                className="py-2 rounded-xl font-display font-bold text-xs tracking-widest uppercase text-bg disabled:opacity-50"
                                style={{
                                    background: "linear-gradient(135deg, #06d6a0, #04a57a)",
                                    boxShadow: "0 0 12px rgba(6,214,160,0.3)",
                                }}
                            >
                                {collecting ? "..." : "Recoger"}
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="text-muted text-xs mb-1.5">
                                ⏱ {mine ? msToTime(mine.nextCollectMs) : "..."}
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
                        className="bg-card border border-border rounded-2xl p-5 flex flex-col hover:border-blue/30 transition-all"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <span className="text-4xl">{s.icon}</span>
                            <span className="bg-bg3 border border-border rounded-lg px-2 py-0.5 text-xs text-muted font-display font-semibold">
                                NIV 1
                            </span>
                        </div>
                        <div className="font-display font-bold text-lg mb-1">{s.name}</div>
                        <div className="text-muted text-xs mb-3 flex-1">{s.desc}</div>
                        <div className="text-muted text-xs mb-1.5">⏱ Próximamente</div>
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
