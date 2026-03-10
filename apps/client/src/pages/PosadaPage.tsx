import { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import TrainerSidebar from "../components/TrainerSidebar";
import { api } from "../lib/api";
import { useNavigate } from "react-router-dom";

const POSADA_IMAGES = {
    mina: "https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/tavern/mina.avif",
    forja: "https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/tavern/forja.avif",
    laboratorio: "https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/tavern/laboratorio.avif",
    guarderia: "https://raw.githubusercontent.com/adcanoardev/mythara-assets/refs/heads/main/tavern/guarderia.avif",
};

function msToTime(ms: number) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}min`;
    return `${m}min ${s % 60}s`;
}

function ProgressBar({
    ms,
    totalMs,
    color = "linear-gradient(90deg, #4cc9f0, #7b2fff)",
}: {
    ms: number;
    totalMs: number;
    color?: string;
}) {
    const pct = totalMs > 0 ? Math.max(2, Math.min(100, ((totalMs - ms) / totalMs) * 100)) : 100;
    return (
        <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-1000"
                style={{ width: `${pct}%`, background: color }}
            />
        </div>
    );
}

// ─── Tarjeta Mina ─────────────────────────────────────────────────────────────
function MineCard({ inventory }: { inventory: any[] }) {
    const [mine, setMine] = useState<any>(null);
    const [collecting, setCollecting] = useState(false);
    const [msg, setMsg] = useState("");

    const load = useCallback(async () => {
        const m = await api.mineStatus();
        setMine(m);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function handleCollect() {
        setCollecting(true);
        setMsg("");
        try {
            const res = await api.mineCollect();
            setMsg(`✅ +${res.collected.quantity}x ${res.collected.item.replace(/_/g, " ")}`);
            load();
        } catch (e: any) {
            setMsg(`⏱ ${e.message}`);
        } finally {
            setCollecting(false);
        }
    }

    return (
        <StructureCard
            icon="⛏️"
            name="Mina"
            desc="Produce piedras de evolución y objetos raros"
            level={mine?.level ?? 1}
            ready={mine?.ready ?? false}
            nextCollectMs={mine?.nextCollectMs ?? null}
            totalCooldownMs={4 * 3600 * 1000}
            msg={msg}
            collecting={collecting}
            onCollect={handleCollect}
            bgImage={POSADA_IMAGES.mina}
        />
    );
}

// ─── Tarjeta Forja ────────────────────────────────────────────────────────────
function ForgeCard() {
    const navigate = useNavigate();
    const [forge, setForge] = useState<any>(null);
    const [fragmentCount, setFragmentCount] = useState<number>(0);
    const [collecting, setCollecting] = useState(false);
    const [msg, setMsg] = useState("");

    const load = useCallback(async () => {
        const [f, inv] = await Promise.all([api.forgeStatus(), api.inventory()]);
        setForge(f);
        const frag = (inv as any[]).find((i: any) => i.item === "FRAGMENT");
        setFragmentCount(frag?.quantity ?? 0);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function handleCollect() {
        setCollecting(true);
        setMsg("");
        try {
            const res = await api.forgeCollect();
            setMsg(`✅ +${res.collected.quantity}x Fragmento`);
            load();
        } catch (e: any) {
            setMsg(`⏱ ${e.message}`);
        } finally {
            setCollecting(false);
        }
    }

    const ready = forge?.ready ?? false;
    const nextCollectMs = forge?.nextCollectMs ?? null;
    const totalCooldownMs = 6 * 3600 * 1000;

    return (
        <div
            className={`border rounded-2xl p-5 flex flex-col transition-all relative overflow-hidden
            ${ready ? "border-green/40" : "border-border"}`}
            style={{
                backgroundImage: `url('${POSADA_IMAGES.forja}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                ...(ready ? { boxShadow: "0 0 20px rgba(6,214,160,0.15)" } : {}),
            }}
        >
            {/* Overlay */}
            <div className="absolute inset-0 bg-bg/80 rounded-2xl" />

            {/* Contenido */}
            <div className="relative z-10 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-3">
                    <span className="text-4xl">🏭</span>
                    <span className="bg-bg3 border border-border rounded-lg px-2 py-0.5 text-xs text-muted font-display font-semibold">
                        NIV {forge?.level ?? 1}
                    </span>
                </div>
                <div className="font-display font-bold text-lg mb-1">Forja de Fragmentos</div>
                <div className="text-muted text-xs mb-3 flex-1">Produce Fragmentos para invocar Myths</div>

                {msg && (
                    <div
                        className="text-xs font-semibold mb-2"
                        style={{ color: msg.startsWith("✅") ? "#06d6a0" : "#e63946" }}
                    >
                        {msg}
                    </div>
                )}

                {ready ? (
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
                            ⏱ {nextCollectMs != null ? msToTime(nextCollectMs) : "..."}
                        </div>
                        <ProgressBar ms={nextCollectMs ?? totalCooldownMs} totalMs={totalCooldownMs} />
                    </>
                )}

                {fragmentCount > 0 && (
                    <button
                        onClick={() => navigate("/fragmento")}
                        className="mt-3 py-2 rounded-xl font-display font-bold text-xs tracking-widest uppercase text-bg transition-all"
                        style={{
                            background: "linear-gradient(135deg, #4cc9f0 0%, #7b2fff 100%)",
                            boxShadow: "0 0 12px rgba(76,201,240,0.3)",
                        }}
                    >
                        ◈ Abrir fragmentos ({fragmentCount})
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── Tarjeta Lab ──────────────────────────────────────────────────────────────
function LabCard() {
    const [lab, setLab] = useState<any>(null);
    const [collecting, setCollecting] = useState(false);
    const [msg, setMsg] = useState("");

    const load = useCallback(async () => {
        const l = await api.labStatus();
        setLab(l);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function handleCollect() {
        setCollecting(true);
        setMsg("");
        try {
            const res = await api.labCollect();
            setMsg(`✅ +${res.collected.quantity}x Elixir`);
            load();
        } catch (e: any) {
            setMsg(`⏱ ${e.message}`);
        } finally {
            setCollecting(false);
        }
    }

    return (
        <StructureCard
            icon="🏥"
            name="Laboratorio"
            desc="Produce Elixires"
            level={lab?.level ?? 1}
            ready={lab?.ready ?? false}
            nextCollectMs={lab?.nextCollectMs ?? null}
            totalCooldownMs={8 * 3600 * 1000}
            msg={msg}
            collecting={collecting}
            onCollect={handleCollect}
            bgImage={POSADA_IMAGES.laboratorio}
        />
    );
}

// ─── Tarjeta Guardería ────────────────────────────────────────────────────────
function NurseryCard() {
    const [nursery, setNursery] = useState<any>(null);
    const [allMyths, setAllMyths] = useState<any[]>([]);
    const [collecting, setCollecting] = useState(false);
    const [assigning, setAssigning] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [msg, setMsg] = useState("");

    const load = useCallback(async () => {
        const [n, all] = await Promise.all([api.nurseryStatus(), api.creatures()]);
        setNursery(n);
        setAllMyths((all as any[]).filter((c: any) => !c.inNursery && c.level < 60));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    async function handleAssign(creatureId: string) {
        setAssigning(true);
        setShowPicker(false);
        try {
            await api.nurseryAssign(creatureId);
            setMsg("✅ Myth asignado a la guardería");
            load();
        } catch (e: any) {
            setMsg(`❌ ${e.message}`);
        } finally {
            setAssigning(false);
        }
    }

    async function handleCollect() {
        setCollecting(true);
        setMsg("");
        try {
            const res = await api.nurseryCollect();
            setMsg(`⬆️ ¡${res.myth.name ?? res.myth.speciesId} subió al nivel ${res.newLevel}!`);
            load();
        } catch (e: any) {
            setMsg(`⏱ ${e.message}`);
        } finally {
            setCollecting(false);
        }
    }

    async function handleRemove() {
        try {
            await api.nurseryRemove();
            setMsg("Myth devuelto al almacén");
            load();
        } catch (e: any) {
            setMsg(`❌ ${e.message}`);
        }
    }

    const hasMyth = !!nursery?.myth;
    const isReady = nursery?.ready ?? false;
    const isMaxLevel = nursery?.maxLevel ?? false;
    const inParty = allMyths.filter((c) => c.isInParty);
    const inStorage = allMyths.filter((c) => !c.isInParty);

    return (
        <div
            className={`border rounded-2xl p-5 flex flex-col transition-all relative overflow-hidden
            ${isReady ? "border-yellow/40" : "border-border"}`}
            style={{
                backgroundImage: `url('${POSADA_IMAGES.guarderia}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                ...(isReady ? { boxShadow: "0 0 20px rgba(255,214,10,0.12)" } : {}),
            }}
        >
            {/* Overlay */}
            <div className="absolute inset-0 bg-bg/80 rounded-2xl" />

            {/* Contenido */}
            <div className="relative z-10 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-3">
                    <span className="text-4xl">🥚</span>
                    <span className="bg-bg3 border border-border rounded-lg px-2 py-0.5 text-xs text-muted font-display font-semibold">
                        NIV {nursery?.level ?? 1}
                    </span>
                </div>
                <div className="font-display font-bold text-lg mb-1">Guardería</div>
                <div className="text-muted text-xs mb-3">Entrena un Myth lentamente mientras exploras</div>

                {msg && (
                    <div
                        className="text-xs font-semibold mb-2"
                        style={{ color: msg.startsWith("✅") || msg.startsWith("⬆️") ? "#06d6a0" : "#e63946" }}
                    >
                        {msg}
                    </div>
                )}

                {/* Sin Myth asignado */}
                {!hasMyth && (
                    <>
                        <div className="text-muted text-xs mb-3 flex-1">Sin Myth asignado</div>
                        <button
                            onClick={() => setShowPicker((s) => !s)}
                            disabled={assigning}
                            className="py-2 rounded-xl font-display font-bold text-xs tracking-widest uppercase border border-border text-muted hover:border-yellow hover:text-yellow transition-all disabled:opacity-50"
                        >
                            {assigning ? "..." : "＋ Asignar Myth"}
                        </button>

                        {showPicker && (
                            <div className="mt-2 flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                                {allMyths.length === 0 && (
                                    <div className="text-muted text-xs text-center py-2">Sin Myths disponibles</div>
                                )}
                                {inParty.length > 0 && (
                                    <>
                                        <div className="text-muted/60 text-xs font-display uppercase tracking-widest px-1">
                                            Equipo
                                        </div>
                                        {inParty.map((c: any) => (
                                            <button
                                                key={c.id}
                                                onClick={() => handleAssign(c.id)}
                                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg3 border border-border hover:border-yellow/40 transition-all text-xs"
                                            >
                                                <span className="font-display font-bold text-blue">
                                                    {c.name ?? c.speciesId}
                                                </span>
                                                <span className="text-muted">Nv. {c.level}</span>
                                            </button>
                                        ))}
                                    </>
                                )}
                                {inStorage.length > 0 && (
                                    <>
                                        <div className="text-muted/60 text-xs font-display uppercase tracking-widest px-1 mt-1">
                                            Almacén
                                        </div>
                                        {inStorage.map((c: any) => (
                                            <button
                                                key={c.id}
                                                onClick={() => handleAssign(c.id)}
                                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-bg3 border border-border hover:border-yellow/40 transition-all text-xs"
                                            >
                                                <span className="font-display font-bold text-muted">
                                                    {c.name ?? c.speciesId}
                                                </span>
                                                <span className="text-muted">Nv. {c.level}</span>
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* Con Myth asignado */}
                {hasMyth && !isMaxLevel && (
                    <>
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="text-3xl leading-none">{nursery.myth.art?.front ?? "❓"}</div>
                                <div>
                                    <span className="font-display font-bold text-sm text-blue">
                                        {nursery.myth.name ?? nursery.myth.speciesId}
                                    </span>
                                    <div className="text-muted text-xs">
                                        Nv. {nursery.myth.level} → {nursery.myth.level + 1}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleRemove}
                                className="text-xs text-muted hover:text-red transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {isReady ? (
                            <>
                                <div className="text-yellow text-xs font-semibold mb-2">⚡ ¡Listo para subir!</div>
                                <button
                                    onClick={handleCollect}
                                    disabled={collecting}
                                    className="py-2 rounded-xl font-display font-bold text-xs tracking-widest uppercase text-bg disabled:opacity-50"
                                    style={{
                                        background: "linear-gradient(135deg, #ffd60a, #e6a800)",
                                        boxShadow: "0 0 12px rgba(255,214,10,0.3)",
                                    }}
                                >
                                    {collecting ? "..." : "⬆️ Subir nivel"}
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="text-muted text-xs mb-1.5">⏱ {msToTime(nursery.nextCollectMs)}</div>
                                <ProgressBar
                                    ms={nursery.nextCollectMs}
                                    totalMs={nursery.currentLevelCooldownMs}
                                    color="linear-gradient(90deg, #ffd60a, #e6a800)"
                                />
                            </>
                        )}
                    </>
                )}

                {hasMyth && isMaxLevel && (
                    <div className="text-green text-xs font-semibold flex-1">🏆 Nivel máximo alcanzado (60)</div>
                )}
            </div>
        </div>
    );
}

// ─── Componente genérico de estructura ────────────────────────────────────────
function StructureCard({
    icon,
    name,
    desc,
    level,
    ready,
    nextCollectMs,
    totalCooldownMs,
    msg,
    collecting,
    onCollect,
    bgImage,
}: {
    icon: string;
    name: string;
    desc: string;
    level: number;
    ready: boolean;
    nextCollectMs: number | null;
    totalCooldownMs: number;
    msg: string;
    collecting: boolean;
    onCollect: () => void;
    bgImage?: string;
}) {
    return (
        <div
            className={`border rounded-2xl p-5 flex flex-col transition-all relative overflow-hidden
            ${ready ? "border-green/40" : "border-border"}`}
            style={{
                ...(bgImage
                    ? { backgroundImage: `url('${bgImage}')`, backgroundSize: "cover", backgroundPosition: "center" }
                    : { background: "var(--color-card, #0f1923)" }),
                ...(ready ? { boxShadow: "0 0 20px rgba(6,214,160,0.15)" } : {}),
            }}
        >
            {/* Overlay oscuro para legibilidad */}
            {bgImage && <div className="absolute inset-0 bg-bg/80 rounded-2xl" />}

            {/* Contenido */}
            <div className="relative z-10 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-3">
                    <span className="text-4xl">{icon}</span>
                    <span className="bg-bg3 border border-border rounded-lg px-2 py-0.5 text-xs text-muted font-display font-semibold">
                        NIV {level}
                    </span>
                </div>
                <div className="font-display font-bold text-lg mb-1">{name}</div>
                <div className="text-muted text-xs mb-3 flex-1">{desc}</div>

                {msg && (
                    <div
                        className="text-xs font-semibold mb-2"
                        style={{ color: msg.startsWith("✅") ? "#06d6a0" : "#e63946" }}
                    >
                        {msg}
                    </div>
                )}

                {ready ? (
                    <>
                        <div className="text-green text-xs font-semibold mb-2">✅ ¡Lista!</div>
                        <button
                            onClick={onCollect}
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
                            ⏱ {nextCollectMs != null ? msToTime(nextCollectMs) : "..."}
                        </div>
                        <ProgressBar ms={nextCollectMs ?? totalCooldownMs} totalMs={totalCooldownMs} />
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export default function PosadaPage() {
    const [inventory, setInventory] = useState<any[]>([]);

    useEffect(() => {
        api.inventory().then(setInventory);
    }, []);

    return (
        <Layout sidebar={<TrainerSidebar />}>
            <div className="flex-shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
                <h1 className="font-display font-bold text-2xl tracking-widest">
                    Mi <span className="text-red">Posada</span>
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

            <div className="flex-1 p-6 grid grid-cols-2 grid-rows-2 gap-4 overflow-hidden">
                <MineCard inventory={inventory} />
                <ForgeCard />
                <LabCard />
                <NurseryCard />
            </div>
        </Layout>
    );
}
