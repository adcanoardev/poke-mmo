import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import TrainerSidebar from "../components/TrainerSidebar";
import { api } from "../lib/api";

const EMBLEM_ICONS = ["🪨", "💧", "⚡", "🌿", "☠️", "✨", "🔥", "🌑"];

export default function SantuariosPage() {
    const [sanctums, setSanctums] = useState<any[]>([]);
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState<number | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        api.sanctums().then(setSanctums);
    }, []);

    async function handleChallenge(id: number) {
        setError("");
        setResult(null);
        setLoading(id);
        try {
            const res = await api.challengeSanctum(id);
            setResult(res);
            setSanctums(await api.sanctums());
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(null);
        }
    }

    return (
        <Layout sidebar={<TrainerSidebar />}>
            <div className="flex-shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
                <h1 className="font-display font-bold text-2xl tracking-widest">
                    🏅 <span className="text-yellow">Sanctums</span>
                </h1>
                {result && (
                    <div
                        className={`px-4 py-1.5 rounded-xl border font-display font-bold text-sm
                        ${result.result === "WIN" ? "border-green/30 text-green bg-green/10" : "border-red/30 text-red bg-red/10"}`}
                    >
                        {result.result === "WIN" ? `🏆 ${result.sanctum?.emblem ?? "Emblema"}` : "💀 Derrota"}
                        <span className="text-muted font-normal ml-2 text-xs">
                            +{result.xpGained}XP +{result.coinsGained}💰
                        </span>
                    </div>
                )}
                {error && (
                    <div className="px-4 py-1.5 rounded-xl border border-red/30 text-red bg-red/10 font-display text-sm">
                        ❌ {error}
                    </div>
                )}
            </div>

            <div
                className="flex-1 p-6 grid grid-cols-4 grid-rows-2 gap-3 overflow-hidden relative"
                style={{
                    backgroundImage: `url('https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/maps/mythara_map.avif')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                }}
            >
                {/* Overlay oscuro para que las cards sean legibles */}
                <div className="absolute inset-0 bg-bg/80 pointer-events-none" />
                {sanctums.map((s: any) => (
                    <div
                        key={s.id}
                        className={`relative z-10 bg-card border rounded-2xl p-4 flex flex-col transition-all overflow-hidden
                            ${s.earned ? "border-yellow/40" : s.unlocked ? "border-border hover:border-blue/40" : "border-border opacity-50"}`}
                        style={s.earned ? { boxShadow: "0 0 12px rgba(255,214,10,0.1)" } : {}}
                    >
                        {s.earned && <div className="absolute top-3 right-3 text-lg">✅</div>}
                        <div className="text-3xl mb-2">{EMBLEM_ICONS[s.id]}</div>
                        <div className="font-display font-bold text-sm leading-tight mb-0.5">{s.name}</div>
                        <div className="text-muted text-xs mb-1">{s.guardian}</div>
                        <div className="text-xs text-muted flex-1">
                            Nv. mín. <span className="text-yellow font-bold font-display">{s.requiredLevel}</span>
                        </div>
                        {s.unlocked && !s.earned && (
                            <button
                                onClick={() => handleChallenge(s.id)}
                                disabled={loading === s.id}
                                className="mt-2 py-1.5 rounded-lg font-display font-bold text-xs tracking-widest uppercase disabled:opacity-50 transition-all"
                                style={{ background: "linear-gradient(135deg,#e63946,#c1121f)" }}
                            >
                                {loading === s.id ? "..." : "⚔️ Retar"}
                            </button>
                        )}
                        {!s.unlocked && !s.earned && (
                            <div className="mt-2 text-center text-muted text-xs font-display">🔒</div>
                        )}
                    </div>
                ))}
            </div>
        </Layout>
    );
}
