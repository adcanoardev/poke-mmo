import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTrainer } from "../context/TrainerContext";
import { useNavigate } from "react-router-dom";

function Countdown({ initialMs }: { initialMs: number }) {
    const [ms, setMs] = useState(initialMs);

    useEffect(() => {
        setMs(initialMs);
        if (initialMs <= 0) return;
        const interval = setInterval(() => {
            setMs((prev) => {
                if (prev <= 1000) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1000;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [initialMs]);

    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const str = h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}m ${sec.toString().padStart(2, "0")}s`;

    return <span>{str}</span>;
}

function TokenDots({ filled, max, color }: { filled: number; max: number; color: string }) {
    return (
        <div className="flex gap-1.5 flex-wrap">
            {Array.from({ length: max }).map((_, i) => (
                <div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full transition-all"
                    style={{
                        background: i < filled ? color : "rgba(255,255,255,0.08)",
                        boxShadow: i < filled ? `0 0 6px ${color}` : "none",
                        border: i < filled ? "none" : "1px solid rgba(255,255,255,0.1)",
                    }}
                />
            ))}
        </div>
    );
}

export default function TrainerSidebar() {
    const { user } = useAuth();
    const { trainer, tokens, fragments } = useTrainer();
    const navigate = useNavigate();
    const xpForLevel = (lvl: number) => Math.floor(100 * Math.pow(lvl, 1.8));
    const xpPct = trainer ? Math.min(100, Math.round((trainer.xp / xpForLevel(trainer.level)) * 100)) : 0;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #7b2fff, #4cc9f0)" }}
                >
                    🧢
                </div>
                <div className="min-w-0">
                    <div className="font-display font-bold text-sm truncate">{user?.username}</div>
                    <div className="text-xs" style={{ color: "#8899bb" }}>
                        Nv. {trainer?.level ?? 1}
                    </div>
                </div>
            </div>

            <div>
                <div className="bg-white/5 rounded-full h-1 overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${xpPct}%`, background: "linear-gradient(90deg, #4cc9f0, #7b2fff)" }}
                    />
                </div>
                <div className="flex justify-between text-xs mt-0.5" style={{ color: "#8899bb" }}>
                    <span>{trainer?.xp ?? 0} XP</span>
                    <span>💰 {trainer?.coins ?? 0}</span>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <span
                        className="text-xs font-display font-bold tracking-widest uppercase"
                        style={{ color: "#ffd60a" }}
                    >
                        ⚔️ NPC
                    </span>
                    <span className="font-display font-bold text-xs" style={{ color: "#ffd60a" }}>
                        {tokens?.npcTokens ?? 0}/10
                    </span>
                </div>
                <TokenDots filled={tokens?.npcTokens ?? 0} max={10} color="#ffd60a" />
                {tokens?.nextNpcRechargeMs > 0 && (
                    <div className="text-xs" style={{ color: "#8899bb" }}>
                        +1 en <Countdown initialMs={tokens.nextNpcRechargeMs} />
                    </div>
                )}
            </div>

            <div className="border-t border-border/50" />

            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <span
                        className="text-xs font-display font-bold tracking-widest uppercase"
                        style={{ color: "#e63946" }}
                    >
                        🔴 PvP
                    </span>
                    <span className="font-display font-bold text-xs" style={{ color: "#e63946" }}>
                        {tokens?.pvpTokens ?? 0}/5
                    </span>
                </div>
                <TokenDots filled={tokens?.pvpTokens ?? 0} max={5} color="#e63946" />
                {tokens?.nextPvpRechargeMs > 0 && (
                    <div className="text-xs" style={{ color: "#8899bb" }}>
                        +1 en <Countdown initialMs={tokens.nextPvpRechargeMs} />
                    </div>
                )}
            </div>
            <div className="border-t border-border/50" />

            <div className="flex items-center justify-between">
                <span className="text-xs font-display font-bold tracking-widest uppercase" style={{ color: "#4cc9f0" }}>
                    ◈ Fragmentos
                </span>
                <span
                    className="font-display font-bold text-xs cursor-pointer hover:text-white transition-colors"
                    style={{ color: "#4cc9f0" }}
                    onClick={() => fragments > 0 && navigate("/fragmento")}
                >
                    {fragments}
                </span>
            </div>
        </div>
    );
}
