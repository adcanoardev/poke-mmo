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
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }}
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
    const [playerHp, setPlayerHp] = useState(0);
    const [enemyHp, setEnemyHp] = useState(0);
    const [turnIdx, setTurnIdx] = useState(0);
    const [animating, setAnimating] = useState(false);

    async function handleBattle() {
        setError("");
        setResult(null);
        setLoading(true);
        try {
            const res = mode === "npc" ? await api.battleNpc() : await api.battlePvp(defId);
            setResult(res);

            // Animar los turnos
            const turns: Turn[] = res.turns;
            const maxPlayerHp = mode === "npc" ? (turns[0]?.playerHpAfter ?? 60) : (turns[0]?.challengerHpAfter ?? 60);
            const maxEnemyHp = mode === "npc" ? (res.enemy?.hp ?? 60) : (turns[0]?.defenderHpAfter ?? 60);
            setPlayerHp(maxPlayerHp);
            setEnemyHp(maxEnemyHp);
            setTurnIdx(0);
            setAnimating(true);

            for (let i = 0; i < turns.length; i++) {
                await new Promise((r) => setTimeout(r, 120));
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

    const maxHp = 60;

    return (
        <Layout sidebar={<TrainerSidebar />}>
            <h1 className="font-display font-bold text-3xl tracking-widest mb-6">
                ⚔️ <span className="text-red">Combate</span>
            </h1>

            {/* Selector NPC / PvP */}
            <div className="flex gap-3 mb-6">
                {(["npc", "pvp"] as const).map((m) => (
                    <button
                        key={m}
                        onClick={() => {
                            setMode(m);
                            setResult(null);
                            setError("");
                        }}
                        className={`px-6 py-2.5 rounded-xl font-display font-bold text-sm tracking-widest uppercase transition-all
                            ${
                                mode === m
                                    ? "text-bg"
                                    : "border border-border text-muted hover:border-blue hover:text-blue"
                            }`}
                        style={
                            mode === m
                                ? {
                                      background:
                                          m === "npc"
                                              ? "linear-gradient(135deg, #ffd60a, #e6a800)"
                                              : "linear-gradient(135deg, #e63946, #c1121f)",
                                      boxShadow: `0 0 16px ${m === "npc" ? "rgba(255,214,10,0.3)" : "rgba(230,57,70,0.3)"}`,
                                  }
                                : {}
                        }
                    >
                        {m === "npc" ? "⚔️ Combate NPC" : "🔴 PvP"}
                    </button>
                ))}
            </div>

            {/* Input PvP */}
            {mode === "pvp" && (
                <div className="mb-4">
                    <label className="block text-xs text-muted tracking-widest uppercase mb-2">User ID del rival</label>
                    <input
                        className="w-full bg-white/5 border border-border rounded-lg px-4 py-3 text-sm outline-none focus:border-blue transition-colors"
                        placeholder="cmme1wo6u00004so54m71pfk2"
                        value={defId}
                        onChange={(e) => setDefId(e.target.value)}
                    />
                </div>
            )}

            {error && (
                <div
                    className="mb-4 px-4 py-3 rounded-xl border text-sm font-semibold"
                    style={{ background: "rgba(230,57,70,0.1)", borderColor: "rgba(230,57,70,0.3)", color: "#e63946" }}
                >
                    ❌ {error}
                </div>
            )}

            {/* Botón combatir */}
            {!result && (
                <button
                    onClick={handleBattle}
                    disabled={loading || (mode === "pvp" && !defId)}
                    className="w-full py-4 rounded-xl font-display font-bold text-xl tracking-widest uppercase mb-6 disabled:opacity-40 transition-all"
                    style={{
                        background: "linear-gradient(135deg, #e63946, #c1121f)",
                        boxShadow: "0 0 24px rgba(230,57,70,0.4)",
                    }}
                >
                    {loading ? "Combatiendo..." : "¡COMBATIR!"}
                </button>
            )}

            {/* Arena de combate */}
            {result && (
                <>
                    {/* Resultado */}
                    <div
                        className={`text-center py-4 mb-6 rounded-2xl font-display font-bold text-4xl tracking-widest border
                        ${result.result === "WIN" ? "border-green/30 text-green" : "border-red/30 text-red"}`}
                        style={{
                            background: result.result === "WIN" ? "rgba(6,214,160,0.08)" : "rgba(230,57,70,0.08)",
                        }}
                    >
                        {result.result === "WIN" ? "🏆 VICTORIA" : "💀 DERROTA"}
                    </div>

                    {/* Arena */}
                    <div
                        className="bg-card border border-border rounded-2xl p-6 mb-4"
                        style={{ background: "linear-gradient(135deg, #0d1525, #0f1923)" }}
                    >
                        <div className="grid grid-cols-2 gap-8">
                            {/* Jugador */}
                            <div className="text-center">
                                <img
                                    src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${mode === "npc" ? (result.turns?.[0]?.playerHpAfter !== undefined ? 25 : 25) : 25}.png`}
                                    className="w-24 h-24 mx-auto"
                                    style={{
                                        imageRendering: "pixelated",
                                        filter: "drop-shadow(0 0 8px rgba(76,201,240,0.5))",
                                    }}
                                    alt="player"
                                />
                                <div className="font-display font-bold text-sm mb-1">TÚ</div>
                                <HpBar current={playerHp} max={maxHp} color="#4cc9f0" />
                                <div className="text-xs text-muted mt-1">
                                    {playerHp}/{maxHp} HP
                                </div>
                            </div>

                            {/* Enemigo */}
                            <div className="text-center">
                                {mode === "npc" && result.enemy && (
                                    <img
                                        src={result.enemy.sprite}
                                        className="w-24 h-24 mx-auto"
                                        style={{
                                            imageRendering: "pixelated",
                                            filter: "drop-shadow(0 0 8px rgba(230,57,70,0.5))",
                                        }}
                                        alt={result.enemy.name}
                                    />
                                )}
                                {mode === "pvp" && (
                                    <div className="w-24 h-24 mx-auto flex items-center justify-center text-5xl">
                                        🧢
                                    </div>
                                )}
                                <div className="font-display font-bold text-sm mb-1 uppercase">
                                    {mode === "npc" ? result.enemy?.name : "RIVAL"}
                                </div>
                                <HpBar current={enemyHp} max={maxHp} color="#e63946" />
                                <div className="text-xs text-muted mt-1">
                                    {enemyHp}/{maxHp} HP
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recompensas */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-card border border-border rounded-xl p-4 text-center">
                            <div className="text-yellow font-display font-bold text-2xl">+{result.xpGained}</div>
                            <div className="text-muted text-xs">XP ganada</div>
                        </div>
                        <div className="bg-card border border-border rounded-xl p-4 text-center">
                            <div className="text-yellow font-display font-bold text-2xl">
                                {mode === "npc" ? result.coinsGained : (result.challenger?.coinsGained ?? 0)}
                            </div>
                            <div className="text-muted text-xs">Monedas</div>
                        </div>
                        <div className="bg-card border border-border rounded-xl p-4 text-center">
                            <div className="text-blue font-display font-bold text-2xl">{result.turns?.length}</div>
                            <div className="text-muted text-xs">Turnos</div>
                        </div>
                    </div>

                    {/* Captura */}
                    {result.captured && (
                        <div
                            className="bg-card border border-green/30 rounded-xl p-4 mb-4 flex items-center gap-3"
                            style={{ background: "rgba(6,214,160,0.08)" }}
                        >
                            <img
                                src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${result.captured.pokedexId}.png`}
                                className="w-12 h-12"
                                style={{ imageRendering: "pixelated" }}
                                alt="captured"
                            />
                            <div>
                                <div className="text-green font-display font-bold">¡Pokémon capturado!</div>
                                <div className="text-muted text-xs capitalize">
                                    {result.captured.name} niv. {result.captured.level} con{" "}
                                    {result.captured.ballUsed.replace(/_/g, " ")}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Log de turnos */}
                    <div className="bg-card border border-border rounded-2xl p-4 max-h-48 overflow-y-auto">
                        <div className="font-display font-semibold text-xs text-muted tracking-widest uppercase mb-3">
                            Log de batalla
                        </div>
                        {result.turns?.map((t: Turn, i: number) => (
                            <div
                                key={i}
                                className={`text-xs py-1 px-2 rounded mb-1 transition-all ${i === turnIdx && animating ? "bg-white/10" : ""}`}
                            >
                                <span className="text-muted">T{t.turn}</span>
                                <span
                                    className={`mx-2 font-semibold ${t.attacker === "player" || t.attacker === "challenger" ? "text-blue" : "text-red"}`}
                                >
                                    {t.attacker === "player" || t.attacker === "challenger" ? "TÚ" : "RIVAL"}
                                </span>
                                causó <span className="text-yellow font-bold">{t.damage}</span> de daño
                                {t.critical && <span className="ml-2 text-yellow text-xs">⚡ CRÍTICO</span>}
                            </div>
                        ))}
                    </div>

                    {/* Volver a combatir */}
                    <button
                        onClick={() => {
                            setResult(null);
                            setError("");
                        }}
                        className="w-full mt-4 py-3 rounded-xl border border-border text-muted font-display font-bold text-sm tracking-widest uppercase hover:border-red hover:text-red transition-all"
                    >
                        Volver a combatir
                    </button>
                </>
            )}
        </Layout>
    );
}
