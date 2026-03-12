import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

const TYPE_COLORS: Record<string, string> = {
    grass: "#06d6a0",
    fire: "#ff6b35",
    water: "#4cc9f0",
    electric: "#ffd60a",
};
const TYPE_ICONS: Record<string, string> = {
    grass: "🌿",
    fire: "🔥",
    water: "💧",
    electric: "⚡",
};

type Step = "gender" | "avatar" | "starter";

export default function OnboardingPage() {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>("gender");
    const [data, setData] = useState<any>(null);
    const [gender, setGender] = useState<"male" | "female" | null>(null);
    const [avatar, setAvatar] = useState<string | null>(null);
    const [starter, setStarter] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        api.onboardingData().then(setData);
    }, []);

    const avatarsFiltered = data?.avatars?.filter((a: any) => a.gender === gender) ?? [];

    async function handleFinish() {
        if (!avatar || !gender || !starter) return;
        setLoading(true);
        setError("");
        try {
            await api.onboardingComplete(avatar, gender, starter);
            navigate("/");
            window.location.reload(); // refresca el user context
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    const STEPS: Step[] = ["gender", "avatar", "starter"];
    const stepIdx = STEPS.indexOf(step);

    return (
        <div className="h-screen w-screen overflow-hidden bg-bg flex flex-col items-center justify-center relative">
            {/* Fondo */}
            <div className="absolute inset-0 pointer-events-none">
                <div
                    className="absolute inset-0"
                    style={{
                        background:
                            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(123,47,255,0.15) 0%, transparent 60%)",
                    }}
                />
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage:
                            "linear-gradient(rgba(76,201,240,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(76,201,240,0.03) 1px, transparent 1px)",
                        backgroundSize: "40px 40px",
                    }}
                />
            </div>

            {/* Card principal */}
            <div
                className="relative w-[640px] bg-card border border-border rounded-2xl overflow-hidden flex flex-col"
                style={{ maxHeight: "85vh" }}
            >
                {/* Header */}
                <div className="flex-shrink-0 px-8 pt-8 pb-4 border-b border-border">
                    <div className="flex items-center gap-3 mb-2">
                        <svg className="w-8 h-8" viewBox="0 0 60 60" fill="none">
                            <circle cx="30" cy="30" r="28" stroke="#ffd60a" strokeWidth="2" />
                            <line x1="2" y1="30" x2="58" y2="30" stroke="#ffd60a" strokeWidth="2" />
                            <circle cx="30" cy="30" r="6" fill="#ffd60a" stroke="#070b14" strokeWidth="2" />
                        </svg>
                        <div>
                            <h1 className="font-display font-bold text-2xl tracking-widest text-yellow">
                                ¡Bienvenido, Binder!
                            </h1>
                            <p className="text-muted text-xs tracking-wider">Configura tu perfil antes de comenzar</p>
                        </div>
                    </div>

                    {/* Barra de progreso */}
                    <div className="flex gap-2 mt-4">
                        {["Género", "Avatar", "Myth inicial"].map((label, i) => (
                            <div key={i} className="flex-1">
                                <div
                                    className={`h-1 rounded-full transition-all duration-500 mb-1
                                    ${i <= stepIdx ? "" : "bg-white/10"}`}
                                    style={
                                        i <= stepIdx
                                            ? {
                                                  background: "linear-gradient(90deg, #7b2fff, #4cc9f0)",
                                              }
                                            : {}
                                    }
                                />
                                <div
                                    className={`text-xs font-display text-center transition-all
                                    ${i === stepIdx ? "text-blue" : i < stepIdx ? "text-green" : "text-muted"}`}
                                >
                                    {i < stepIdx ? "✅" : label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Contenido del paso */}
                <div className="flex-1 overflow-y-auto p-8">
                    {/* PASO 1: Género */}
                    {step === "gender" && (
                        <div>
                            <h2 className="font-display font-bold text-xl tracking-widest mb-6 text-center">
                                ¿Quién eres?
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                {(["male", "female"] as const).map((g) => (
                                    <div
                                        key={g}
                                        onClick={() => setGender(g)}
                                        className={`cursor-pointer rounded-2xl p-8 border-2 text-center transition-all
                                            ${gender === g ? "border-blue bg-blue/10" : "border-border hover:border-blue/40 bg-white/3"}`}
                                        style={gender === g ? { boxShadow: "0 0 20px rgba(76,201,240,0.2)" } : {}}
                                    >
                                        <div className="text-6xl mb-3">{g === "male" ? "👦" : "👧"}</div>
                                        <div className="font-display font-bold text-lg tracking-widest uppercase">
                                            {g === "male" ? "Masculino" : "Femenino"}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* PASO 2: Avatar */}
                    {step === "avatar" && (
                        <div>
                            <h2 className="font-display font-bold text-xl tracking-widest mb-6 text-center">
                                Elige tu aspecto
                            </h2>
                            <div className="grid grid-cols-4 gap-3">
                                {avatarsFiltered.map((av: any) => (
                                    <div
                                        key={av.id}
                                        onClick={() => setAvatar(av.id)}
                                        className={`cursor-pointer rounded-2xl p-4 border-2 text-center transition-all
                                            ${avatar === av.id ? "border-yellow bg-yellow/10" : "border-border hover:border-yellow/40 bg-white/3"}`}
                                        style={avatar === av.id ? { boxShadow: "0 0 16px rgba(255,214,10,0.2)" } : {}}
                                    >
                                        <div className="text-4xl mb-2">{av.emoji}</div>
                                        <div className="font-display font-bold text-sm tracking-widest">{av.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* PASO 3: Starter */}
                    {step === "starter" && (
                        <div>
                            <h2 className="font-display font-bold text-xl tracking-widest mb-4 text-center">
                                Elige tu Myth inicial
                            </h2>
                            <div className="grid grid-cols-3 gap-3">
                                {(data?.starters ?? []).map((s: any) => {
                                    const color = s.affinities?.[0]
                                        ? ((
                                              {
                                                  EMBER: "#ff6b35",
                                                  TIDE: "#4cc9f0",
                                                  GROVE: "#06d6a0",
                                                  VOLT: "#ffd60a",
                                                  STONE: "#adb5bd",
                                                  FROST: "#a8dadc",
                                                  VENOM: "#7b2fff",
                                                  ASTRAL: "#e040fb",
                                                  IRON: "#90a4ae",
                                                  SHADE: "#e63946",
                                              } as any
                                          )[s.affinities[0]] ?? "#F7FFFB")
                                        : "#F7FFFB";
                                    return (
                                        <div
                                            key={s.id}
                                            onClick={() => setStarter(s.id)}
                                            className={`cursor-pointer rounded-2xl p-4 border-2 text-center transition-all relative overflow-hidden
                            ${starter === s.id ? "border-2" : "border-border hover:border-white/20 bg-white/3"}`}
                                            style={
                                                starter === s.id
                                                    ? {
                                                          borderColor: color,
                                                          background: `${color}15`,
                                                          boxShadow: `0 0 20px ${color}30`,
                                                      }
                                                    : {}
                                            }
                                        >
                                            <div
                                                className="text-5xl mb-2 mx-auto"
                                                style={{
                                                    filter: starter === s.id ? `drop-shadow(0 0 8px ${color})` : "none",
                                                }}
                                            >
                                                {s.art?.portrait ?? "❓"}
                                            </div>
                                            <div className="font-display font-bold text-sm mt-1">{s.name}</div>
                                            <div
                                                className="text-xs mt-0.5 font-display font-semibold"
                                                style={{ color }}
                                            >
                                                {s.affinities?.[0] ?? ""}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div
                            className="mt-4 px-4 py-2 rounded-xl border text-sm font-semibold text-center"
                            style={{
                                background: "rgba(230,57,70,0.1)",
                                borderColor: "rgba(230,57,70,0.3)",
                                color: "#e63946",
                            }}
                        >
                            ❌ {error}
                        </div>
                    )}
                </div>

                {/* Botones de navegación */}
                <div className="flex-shrink-0 px-8 pb-8 flex gap-3">
                    {stepIdx > 0 && (
                        <button
                            onClick={() => setStep(STEPS[stepIdx - 1])}
                            className="flex-1 py-3 rounded-xl border border-border text-muted font-display font-bold text-sm tracking-widest uppercase hover:border-blue hover:text-blue transition-all"
                        >
                            ← Atrás
                        </button>
                    )}

                    {step !== "starter" ? (
                        <button
                            onClick={() => setStep(STEPS[stepIdx + 1])}
                            disabled={(step === "gender" && !gender) || (step === "avatar" && !avatar)}
                            className="flex-1 py-3 rounded-xl font-display font-bold text-sm tracking-widest uppercase disabled:opacity-30 transition-all text-bg"
                            style={{
                                background: "linear-gradient(135deg, #4cc9f0, #7b2fff)",
                                boxShadow: "0 0 16px rgba(76,201,240,0.3)",
                            }}
                        >
                            Siguiente →
                        </button>
                    ) : (
                        <button
                            onClick={handleFinish}
                            disabled={!starter || loading}
                            className="flex-1 py-3 rounded-xl font-display font-bold text-sm tracking-widest uppercase disabled:opacity-30 transition-all text-bg"
                            style={{
                                background: "linear-gradient(135deg, #e63946, #c1121f)",
                                boxShadow: "0 0 20px rgba(230,57,70,0.4)",
                            }}
                        >
                            {loading ? "Comenzando..." : "🎮 ¡Comenzar aventura!"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
