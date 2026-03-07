import { useState } from "react";
import Layout from "../components/Layout";
import TrainerSidebar from "../components/TrainerSidebar";
import { api } from "../lib/api";

interface Turn {
    turn: number;
    attacker: string;
    damage: number;
    critical: boolean;
    playerHpAfter?: number;
    enemyHpAfter?: number;
    challengerHpAfter?: number;
    defenderHpAfter?: number;
}

function HpBar({ current, max, color }: { current: number; max: number; color: string }) {
    const pct = Math.max(0, Math.min(100, (current / max) * 100));
    return (
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%`, background: color, boxShadow: `0 0 6px ${color}` }}
            />
        </div>
    );
}

export default function CombatPage() {
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<"npc" | "pvp">("npc");
    const [defId, setDefId] = useState("");
    const [error, setError] = useState("");
    const [playerHp, setPlayerHp] = useState(60);
    const [enemyHp, setEnemyHp] = useState(60);
    const [animating, setAnimating] = useState(false);
    const [turnIdx, setTurnIdx] = useState(-1);
    const maxHp = 60;

    async function handleBattle() {
        setError("");
        setResult(null);
        setLoading(true);
        setPlayerHp(maxHp);
        setEnemyHp(maxHp);
        try {
            const res = mode === "npc" ? await api.battleNpc() : await api.battlePvp(defId);
            setResult(res);
            const turns: Turn[] = res.turns;
            setAnimating(true);
            for (let i = 0; i < turns.length; i++) {
                await new Promise((r) => setTimeout(r, 100));
                const t = turns[i];
                setTurnIdx(i);
                if (mode === "npc") {
                    setPlayerHp(t.playerHpAfter ?? 0);
                    setEnemyHp(t.enemyHpAfter ?? 0);
                } else {
                    setPlayerHp(t.challengerHpAfter ?? 0);
                    setEnemyHp(t.defenderHpAfter ?? 0);
                }
            }
            setAnimating(false);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Layout sidebar={<TrainerSidebar />}>
            {/* Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
                <h1 className="font-display font-bold text-2xl tracking-widest">
                    ⚔️ <span className="text-red">Combate</span>
                </h1>
                <div className="flex gap-2">
                    {(["npc", "pvp"] as const).map((m) => (
                        <button
                            key={m}
                            onClick={() => {
                                setMode(m);
                                setResult(null);
                                setError("");
                            }}
                            className={`px-4 py-1.5 rounded-lg font-display font-bold text-xs tracking-widest uppercase transition-all
                                ${mode === m ? "text-bg" : "border border-border text-muted hover:border-blue hover:text-blue"}`}
                            style={
                                mode === m
                                    ? {
                                          background:
                                              m === "npc"
                                                  ? "linear-gradient(135deg,#ffd60a,#e6a800)"
                                                  : "linear-gradient(135deg,#e63946,#c1121f)",
                                      }
                                    : {}
                            }
                        >
                            {m === "npc" ? "⚔️ NPC" : "🔴 PvP"}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 flex gap-0 overflow-hidden">
                {/* Columna izquierda */}
                <div className="flex-1 flex flex-col p-4 gap-3 overflow-hidden">
                    {mode === "pvp" && !result && (
                        <input
                            className="flex-shrink-0 bg-white/5 border border-border rounded-lg px-4 py-2 text-sm outline-none focus:border-blue transition-colors"
                            placeholder="User ID del rival"
                            value={defId}
                            onChange={(e) => setDefId(e.target.value)}
                        />
                    )}

                    {error && (
                        <div
                            className="flex-shrink-0 px-4 py-2 rounded-xl border text-sm font-semibold"
                            style={{
                                background: "rgba(230,57,70,0.1)",
                                borderColor: "rgba(230,57,70,0.3)",
                                color: "#e63946",
                            }}
                        >
                            ❌ {error}
                        </div>
                    )}

                    {/* Arena */}
                    <div
                        className="flex-1 bg-card border border-border rounded-2xl flex flex-col overflow-hidden"
                        style={{ background: "linear-gradient(135deg, #0d1525, #0f1923)" }}
                    >
                        {result && (
                            <div
                                className={`flex-shrink-0 text-center py-2 font-display font-bold text-2xl tracking-widest border-b
                                ${result.result === "WIN" ? "text-green border-green/20" : "text-red border-red/20"}`}
                                style={{
                                    background:
                                        result.result === "WIN" ? "rgba(6,214,160,0.08)" : "rgba(230,57,70,0.08)",
                                }}
                            >
                                {result.result === "WIN" ? "🏆 VICTORIA" : "💀 DERROTA"}
                            </div>
                        )}

                        {/* Sprites — emoji placeholder */}
                        <div className="flex-1 flex items-center justify-around px-8">
                            <div className="text-center">
                                <div
                                    className="w-20 h-20 mx-auto flex items-center justify-center text-5xl"
                                    style={{ filter: "drop-shadow(0 0 8px rgba(76,201,240,0.5))" }}
                                >
                                    {result?.playerMyth?.art?.front ?? "🔵"}
                                </div>
                                <div className="font-display font-bold text-xs mb-1 text-blue">TÚ</div>
                                <HpBar current={playerHp} max={maxHp} color="#4cc9f0" />
                                <div className="text-xs text-muted mt-0.5">
                                    {playerHp}/{maxHp}
                                </div>
                            </div>

                            <div className="font-display font-bold text-2xl text-muted">VS</div>

                            <div className="text-center">
                                <div
                                    className="w-20 h-20 mx-auto flex items-center justify-center text-5xl"
                                    style={{ filter: "drop-shadow(0 0 8px rgba(230,57,70,0.5))" }}
                                >
                                    {result?.enemy?.art?.front ?? "❓"}
                                </div>
                                <div className="font-display font-bold text-xs mb-1 text-red uppercase">
                                    {result?.enemy?.name ?? "RIVAL"}
                                </div>
                                <HpBar current={enemyHp} max={maxHp} color="#e63946" />
                                <div className="text-xs text-muted mt-0.5">
                                    {enemyHp}/{maxHp}
                                </div>
                            </div>
                        </div>

                        {/* Recompensas */}
                        {result && (
                            <div className="flex-shrink-0 flex gap-3 px-4 pb-3 pt-2 border-t border-border/50">
                                <div className="flex-1 bg-bg3 rounded-xl p-2 text-center">
                                    <div className="text-yellow font-display font-bold text-lg">+{result.xpGained}</div>
                                    <div className="text-muted text-xs">XP</div>
                                </div>
                                <div className="flex-1 bg-bg3 rounded-xl p-2 text-center">
                                    <div className="text-yellow font-display font-bold text-lg">
                                        +{mode === "npc" ? result.coinsGained : (result.challenger?.coinsGained ?? 0)}
                                    </div>
                                    <div className="text-muted text-xs">Monedas</div>
                                </div>
                                <div className="flex-1 bg-bg3 rounded-xl p-2 text-center">
                                    <div className="text-blue font-display font-bold text-lg">
                                        {result.turns?.length}
                                    </div>
                                    <div className="text-muted text-xs">Turnos</div>
                                </div>
                                {result.captured && (
                                    <div className="flex-1 bg-green/10 border border-green/30 rounded-xl p-2 text-center">
                                        <div className="text-3xl">{result.captured.art?.portrait ?? "✨"}</div>
                                        <div className="text-green text-xs font-display">¡Capturado!</div>
                                        <div className="text-muted text-xs">{result.captured.name}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {!result ? (
                        <button
                            onClick={handleBattle}
                            disabled={loading || (mode === "pvp" && !defId)}
                            className="flex-shrink-0 py-3 rounded-xl font-display font-bold text-lg tracking-widest uppercase disabled:opacity-40 transition-all"
                            style={{
                                background: "linear-gradient(135deg,#e63946,#c1121f)",
                                boxShadow: "0 0 20px rgba(230,57,70,0.4)",
                            }}
                        >
                            {loading ? "Combatiendo..." : "¡COMBATIR!"}
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                setResult(null);
                                setError("");
                                setPlayerHp(maxHp);
                                setEnemyHp(maxHp);
                            }}
                            className="flex-shrink-0 py-3 rounded-xl border border-border text-muted font-display font-bold text-sm tracking-widest uppercase hover:border-red hover:text-red transition-all"
                        >
                            Volver a combatir
                        </button>
                    )}
                </div>

                {/* Log de turnos */}
                <div className="w-52 flex-shrink-0 border-l border-border flex flex-col overflow-hidden">
                    <div className="flex-shrink-0 px-4 py-3 border-b border-border font-display font-semibold text-xs text-muted tracking-widest uppercase">
                        Log de batalla
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
                        {result?.turns?.map((t: Turn, i: number) => (
                            <div
                                key={i}
                                className={`text-xs py-1 px-2 rounded transition-all ${i === turnIdx && animating ? "bg-white/10" : ""}`}
                            >
                                <span className="text-muted">T{t.turn} </span>
                                <span
                                    className={`font-semibold ${t.attacker === "player" || t.attacker === "challenger" ? "text-blue" : "text-red"}`}
                                >
                                    {t.attacker === "player" || t.attacker === "challenger" ? "TÚ" : "RIVAL"}
                                </span>
                                <span className="text-white/60"> → </span>
                                <span className="text-yellow font-bold">{t.damage}</span>
                                {t.critical && <span className="text-yellow"> ⚡</span>}
                            </div>
                        ))}
                        {!result && (
                            <div className="text-muted text-xs text-center py-8 font-display tracking-widest">
                                Sin combate
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
}
