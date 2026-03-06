import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

function TokenDots({ filled, max, color }: { filled: number; max: number; color: string }) {
    return (
        <div className="flex gap-1 mt-1 flex-wrap">
            {Array.from({ length: max }).map((_, i) => (
                <div
                    key={i}
                    className="w-2 h-2 rounded-full transition-all"
                    style={{
                        background: i < filled ? color : "rgba(255,255,255,0.1)",
                        boxShadow: i < filled ? `0 0 6px ${color}` : "none",
                    }}
                />
            ))}
        </div>
    );
}

function msToTime(ms: number) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min ${s % 60}s`;
}

export default function TrainerSidebar() {
    const { user } = useAuth();
    const [trainer, setTrainer] = useState<any>(null);
    const [tokens, setTokens] = useState<any>(null);

    useEffect(() => {
        Promise.all([api.trainer(), api.tokens()]).then(([t, tk]) => {
            setTrainer(t);
            setTokens(tk);
        });
    }, []);

    const xpForLevel = (lvl: number) => Math.floor(100 * Math.pow(lvl, 1.8));
    const xpPct = trainer ? Math.min(100, Math.round((trainer.xp / xpForLevel(trainer.level)) * 100)) : 0;

    const RANK_LABELS = ["Novato", "Entrenador", "Rival", "Elite", "Campeón"];
    const RANK_THRESHOLDS = [0, 100, 300, 600, 1000];
    const rankIdx = trainer ? RANK_THRESHOLDS.filter((t) => trainer.prestige >= t).length - 1 : 0;

    return (
        <div className="bg-card border border-border rounded-2xl p-6 mb-4">
            {/* Avatar + nombre */}
            <div className="text-center mb-5 pb-5 border-b border-border">
                <div
                    className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-3xl"
                    style={{
                        background: "linear-gradient(135deg, #7b2fff, #4cc9f0)",
                        boxShadow: "0 0 20px rgba(76,201,240,0.2)",
                    }}
                >
                    🧢
                </div>
                <div className="font-display font-bold text-lg">{user?.username}</div>
                <div className="text-muted text-xs mb-1">Nivel {trainer?.level ?? 1}</div>
                <span
                    className="text-xs px-2 py-0.5 rounded-full border font-display font-semibold"
                    style={{ borderColor: "#ffd60a44", color: "#ffd60a", background: "rgba(255,214,10,0.08)" }}
                >
                    {RANK_LABELS[rankIdx]}
                </span>

                {/* Barra XP */}
                <div className="mt-3">
                    <div className="bg-white/5 rounded-full h-1.5 overflow-hidden mb-1">
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                                width: `${xpPct}%`,
                                background: "linear-gradient(90deg, #4cc9f0, #7b2fff)",
                                boxShadow: "0 0 8px rgba(76,201,240,0.5)",
                            }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-muted">
                        <span>{trainer?.xp ?? 0} XP</span>
                        <span>{xpForLevel(trainer?.level ?? 1)} XP</span>
                    </div>
                </div>
            </div>

            {/* Monedas */}
            <div className="py-3 border-b border-white/5">
                <div className="flex justify-between items-center">
                    <span className="text-xs text-muted">💰 Monedas</span>
                    <span className="font-display font-bold text-yellow">{trainer?.coins ?? 0}</span>
                </div>
                <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-muted">⭐ Prestigio</span>
                    <span className="font-display font-bold text-purple-400">{trainer?.prestige ?? 0}</span>
                </div>
            </div>

            {/* Fichas NPC */}
            <div className="py-3 border-b border-white/5">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="text-xs text-muted">⚔️ Fichas NPC</div>
                        <TokenDots filled={tokens?.npcTokens ?? 0} max={10} color="#ffd60a" />
                        {tokens?.nextNpcRechargeMs && (
                            <div className="text-xs text-muted mt-1">+1 en {msToTime(tokens.nextNpcRechargeMs)}</div>
                        )}
                    </div>
                    <span className="font-display font-bold text-yellow text-lg">{tokens?.npcTokens ?? 0}/10</span>
                </div>
            </div>

            {/* Tokens PvP */}
            <div className="pt-3">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="text-xs text-muted">🔴 Tokens PvP</div>
                        <TokenDots filled={tokens?.pvpTokens ?? 0} max={5} color="#e63946" />
                        {tokens?.nextPvpRechargeMs && (
                            <div className="text-xs text-muted mt-1">+1 en {msToTime(tokens.nextPvpRechargeMs)}</div>
                        )}
                    </div>
                    <span className="font-display font-bold text-red text-lg">{tokens?.pvpTokens ?? 0}/5</span>
                </div>
            </div>
        </div>
    );
}
