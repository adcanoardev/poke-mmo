import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import TrainerSidebar from "../components/TrainerSidebar";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

const RANK_COLORS: Record<string, string> = {
    Campeón: "#ffd60a",
    Elite: "#7b2fff",
    Rival: "#e63946",
    Entrenador: "#4cc9f0",
    Novato: "#F7FFFB",
};

export default function RankingPage() {
    const { user } = useAuth();
    const [data, setData] = useState<any>(null);

    useEffect(() => {
        api.ranking().then(setData);
    }, []);

    const top3 = data?.ranking?.slice(0, 3) ?? [];
    const rest = data?.ranking?.slice(3) ?? [];
    const myPos = data?.myPosition;

    return (
        <Layout sidebar={<TrainerSidebar />}>
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
                <h1 className="font-display font-bold text-2xl tracking-widest">
                    🏆 <span className="text-yellow">Ranking Global</span>
                </h1>
                {myPos && (
                    <div className="px-4 py-1.5 bg-yellow/5 border border-yellow/20 rounded-xl text-sm font-display text-yellow tracking-widest">
                        Tu posición: #{myPos}
                    </div>
                )}
            </div>

            <div className="flex-1 flex gap-4 p-6 overflow-hidden">
                {/* Podio */}
                <div className="w-56 flex-shrink-0 flex flex-col gap-3">
                    {[top3[0], top3[1], top3[2]].map((trainer: any, i: number) => {
                        if (!trainer) return null;
                        const medals = ["🥇", "🥈", "🥉"];
                        return (
                            <div
                                key={trainer.userId}
                                className={`bg-card border rounded-2xl p-4 text-center
                                    ${i === 0 ? "border-yellow/40" : "border-border"}`}
                                style={i === 0 ? { boxShadow: "0 0 16px rgba(255,214,10,0.1)" } : {}}
                            >
                                <div className="text-3xl mb-1">{medals[i]}</div>
                                <div className="font-display font-bold">{trainer.username}</div>
                                <div
                                    className="font-display font-bold text-xl mt-1"
                                    style={{ color: RANK_COLORS[trainer.rank] }}
                                >
                                    {trainer.prestige}
                                </div>
                                <div className="text-xs font-display" style={{ color: RANK_COLORS[trainer.rank] }}>
                                    {trainer.rank}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Lista */}
                <div className="flex-1 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
                    <div className="flex-shrink-0 grid grid-cols-[40px_1fr_60px_80px] gap-3 px-4 py-2 border-b border-border text-xs text-muted font-display tracking-widest uppercase">
                        <span>#</span>
                        <span>Entrenador</span>
                        <span>Nv.</span>
                        <span>Prestigio</span>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {rest.map((trainer: any) => {
                            const isMe = trainer.username === user?.username;
                            return (
                                <div
                                    key={trainer.userId}
                                    className={`grid grid-cols-[40px_1fr_60px_80px] gap-3 px-4 py-3 border-b border-border/40 last:border-0
                                        ${isMe ? "bg-yellow/5" : "hover:bg-white/3"}`}
                                >
                                    <span className={`font-display font-bold ${isMe ? "text-yellow" : "text-muted"}`}>
                                        {trainer.position}
                                    </span>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="font-semibold truncate">{trainer.username}</span>
                                        {isMe && (
                                            <span className="text-xs text-yellow font-display flex-shrink-0">(tú)</span>
                                        )}
                                    </div>
                                    <span className="text-muted font-display">{trainer.level}</span>
                                    <div>
                                        <span
                                            className="font-display font-bold"
                                            style={{ color: RANK_COLORS[trainer.rank] }}
                                        >
                                            {trainer.prestige}
                                        </span>
                                        <div
                                            className="text-xs font-display"
                                            style={{ color: RANK_COLORS[trainer.rank] }}
                                        >
                                            {trainer.rank}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
