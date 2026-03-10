import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTrainer } from "../context/TrainerContext";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(seconds: number): string {
    if (seconds <= 0) return "listo";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function TokenDot({ filled }: { filled: boolean }) {
    return (
        <span
            className={`inline-block w-3.5 h-3.5 rounded-full border transition-all duration-300 ${
                filled ? "bg-yellow border-yellow shadow-[0_0_6px_rgba(255,214,10,0.5)]" : "bg-bg border-border"
            }`}
        />
    );
}

const AVATAR_EMOJI: Record<string, string> = {
    male_1: "👦",
    male_2: "🧑",
    male_3: "👨",
    male_4: "🧔",
    female_1: "👧",
    female_2: "👩",
    female_3: "🧕",
    female_4: "👱‍♀️",
};

// ─── component ────────────────────────────────────────────────────────────────

export default function TrainerSidebar() {
    const navigate = useNavigate();
    const { trainer, tokens, fragments, reload } = useTrainer();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Auto-reload every 30s + listen for sidebar:reload event
    useEffect(() => {
        intervalRef.current = setInterval(reload, 30_000);
        const handler = () => reload();
        window.addEventListener("sidebar:reload", handler);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            window.removeEventListener("sidebar:reload", handler);
        };
    }, [reload]);

    // ── derived ────────────────────────────────────────────────────────────────

    const npcTokens = tokens?.npcTokens ?? 0;
    const pvpTokens = tokens?.pvpTokens ?? 0;
    const MAX_NPC = 10;
    const MAX_PVP = 5;

    /** Seconds until next NPC token */
    const npcSecondsLeft = (() => {
        if (!tokens?.lastNpcRecharge || npcTokens >= MAX_NPC) return 0;
        const rechargeMs = 30 * 60 * 1000; // 30 min
        const elapsed = Date.now() - new Date(tokens.lastNpcRecharge).getTime();
        const remaining = rechargeMs - (elapsed % rechargeMs);
        return Math.max(0, Math.floor(remaining / 1000));
    })();

    const pvpSecondsLeft = (() => {
        if (!tokens?.lastPvpRecharge || pvpTokens >= MAX_PVP) return 0;
        const rechargeMs = 2 * 60 * 60 * 1000; // 2 h
        const elapsed = Date.now() - new Date(tokens.lastPvpRecharge).getTime();
        const remaining = rechargeMs - (elapsed % rechargeMs);
        return Math.max(0, Math.floor(remaining / 1000));
    })();

    // Live countdown — re-render every second
    const [, setTick] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setTick((n: number) => n + 1), 1_000);
        return () => clearInterval(t);
    }, []);

    // ── handlers ──────────────────────────────────────────────────────────────

    const goNpc = () => navigate("/battle", { state: { mode: "npc" } });
    const goPvp = () => navigate("/battle", { state: { mode: "pvp" } });
    const goFragments = () => navigate("/fragment");
    const goProfile = () => navigate("/profile");
    // ── render ────────────────────────────────────────────────────────────────

    if (!trainer) {
        return (
            <aside className="w-56 shrink-0 flex flex-col gap-3 py-4 px-3">
                <div className="h-20 rounded-xl bg-card animate-pulse" />
                <div className="h-32 rounded-xl bg-card animate-pulse" />
                <div className="h-32 rounded-xl bg-card animate-pulse" />
            </aside>
        );
    }

    return (
        <aside className="w-56 shrink-0 flex flex-col gap-3 py-4 px-3 overflow-y-auto">
            {/* ── Trainer card ─────────────────────────────────────────────────── */}
            <div
                onClick={goProfile}
                className="bg-card border border-border rounded-xl px-4 py-3 flex flex-col gap-1 cursor-pointer hover:border-blue/40 hover:bg-bg3 transition-all"
            >
                <div className="flex items-center gap-2">
                    <span className="text-2xl">{AVATAR_EMOJI[trainer?.avatar] ?? "🧙"}</span>
                    <div className="min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{trainer?.username ?? "—"}</p>
                        <p className="text-muted text-xs">Nivel {trainer?.level ?? "—"}</p>
                    </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                    <span className="text-yellow text-xs font-medium">
                        🪙 {trainer?.coins?.toLocaleString() ?? "—"}
                    </span>
                    {fragments > 0 && (
                        <button
                            onClick={goFragments}
                            className="text-xs text-blue hover:text-white transition-colors"
                            title="Abrir fragmentos"
                        >
                            ◈ ×{fragments}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Divider ──────────────────────────────────────────────────────── */}
            <p className="text-muted text-[10px] uppercase tracking-widest px-1 mt-1">Combate</p>

            {/* ── NPC section ──────────────────────────────────────────────────── */}
            <button
                onClick={goNpc}
                className={`
    group w-full bg-card border rounded-xl px-4 py-3 text-left
    transition-all duration-200
    ${
        npcTokens > 0
            ? "border-border hover:border-yellow hover:bg-bg3 cursor-pointer"
            : "border-border opacity-60 hover:border-yellow hover:bg-bg3 cursor-pointer"
    }
  `}
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-xs font-semibold uppercase tracking-wide">vs NPC</span>
                    <span className="text-muted text-xs">
                        {npcTokens}/{MAX_NPC}
                    </span>
                </div>

                {/* Token dots */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {Array.from({ length: MAX_NPC }).map((_, i) => (
                        <TokenDot key={i} filled={i < npcTokens} />
                    ))}
                </div>

                {/* Countdown */}
                {npcTokens < MAX_NPC && (
                    <p className="text-muted text-[11px]">
                        Próxima ficha: <span className="text-blue">{formatCountdown(npcSecondsLeft)}</span>
                    </p>
                )}

                {npcTokens > 0 && (
                    <p className="text-yellow text-[11px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        ▶ Iniciar combate NPC
                    </p>
                )}
            </button>

            {/* ── Visual separator ─────────────────────────────────────────────── */}
            <div className="border-t border-border mx-1" />

            {/* ── PvP section ──────────────────────────────────────────────────── */}
            <button
                onClick={goPvp}
                className={`
    group w-full bg-card border rounded-xl px-4 py-3 text-left
    transition-all duration-200
    ${
        pvpTokens > 0
            ? "border-border hover:border-red hover:bg-bg3 cursor-pointer"
            : "border-border opacity-60 hover:border-red hover:bg-bg3 cursor-pointer"
    }
  `}
            >
                <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-xs font-semibold uppercase tracking-wide">PvP</span>
                    <span className="text-muted text-xs">
                        {pvpTokens}/{MAX_PVP}
                    </span>
                </div>

                {/* Token dots */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {Array.from({ length: MAX_PVP }).map((_, i) => (
                        <TokenDot key={i} filled={i < pvpTokens} />
                    ))}
                </div>

                {/* Countdown */}
                {pvpTokens < MAX_PVP && (
                    <p className="text-muted text-[11px]">
                        Próxima ficha: <span className="text-blue">{formatCountdown(pvpSecondsLeft)}</span>
                    </p>
                )}

                {pvpTokens > 0 && (
                    <p className="text-red text-[11px] mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        ⚔ Buscar rival
                    </p>
                )}
            </button>
        </aside>
    );
}
