import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import PageShell from "../components/PageShell";
import PageTopbar from "../components/PageTopbar";

interface MythInstance {
    id: string;
    speciesId: string;
    name?: string;
    level: number;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    isInParty: boolean;
    slot: number | null;
    inNursery: boolean;
}

const AFFINITY_COLOR: Record<string, string> = {
    EMBER: "#ff6b35",
    TIDE: "#4cc9f0",
    GROVE: "#06d6a0",
    VOLT: "#ffd60a",
    STONE: "#adb5bd",
    FROST: "#a8dadc",
    VENOM: "#7b2fff",
    ASTRAL: "#e040fb",
    SHADE: "#e63946",
    IRON: "#90a4ae",
};

function MythCard({
    myth,
    dragging,
    onDragStart,
    onDragEnd,
    compact = false,
}: {
    myth: MythInstance;
    dragging?: boolean;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    compact?: boolean;
}) {
    return (
        <div
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className={`bg-bg3 border rounded-xl cursor-grab active:cursor-grabbing select-none transition-all
                ${dragging ? "opacity-40 scale-95" : "hover:border-blue/40"}
                ${compact ? "p-2" : "p-3"}`}
            style={{ borderColor: dragging ? "#4cc9f0" : "#1e2d45" }}
        >
            <div className={`flex items-center gap-2 ${compact ? "" : "mb-2"}`}>
                <div
                    className={`flex-shrink-0 rounded-lg flex items-center justify-center font-bold text-bg ${compact ? "w-8 h-8 text-xs" : "w-12 h-12 text-sm"}`}
                    style={{
                        background: AFFINITY_COLOR[(myth as any).affinities?.[0]] ?? "#4cc9f0",
                        boxShadow: `0 0 8px ${AFFINITY_COLOR[(myth as any).affinities?.[0]] ?? "#4cc9f0"}40`,
                    }}
                >
                    {(myth as any).affinities?.[0]?.slice(0, 2) ?? "??"}
                </div>
                <div className="flex-1 min-w-0">
                    <div className={`font-display font-bold truncate ${compact ? "text-xs" : "text-sm"}`}>
                        {(myth as any).name ?? myth.speciesId}
                    </div>
                    <div className="text-muted text-xs">Lv. {myth.level}</div>
                </div>
            </div>
            {!compact && (
                <div className="grid grid-cols-3 gap-1 text-xs text-muted text-center">
                    <div>
                        <span className="text-blue font-bold">{myth.hp}</span>
                        <br />
                        HP
                    </div>
                    <div>
                        <span className="text-red font-bold">{myth.attack}</span>
                        <br />
                        ATK
                    </div>
                    <div>
                        <span className="text-green font-bold">{myth.defense}</span>
                        <br />
                        DEF
                    </div>
                </div>
            )}
        </div>
    );
}

function PartySlot({
    slot,
    myth,
    onDrop,
    onRemove,
    isOver,
    partyCount,
    onDragStart,
    onDragEnd,
}: {
    slot: number;
    myth: MythInstance | null;
    onDrop: (slot: number) => void;
    onRemove: (slot: number) => void;
    isOver: boolean;
    partyCount: number;
    onDragStart?: () => void;
    onDragEnd?: () => void;
}) {
    return (
        <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(slot)}
            className={`rounded-2xl border-2 border-dashed transition-all min-h-32 flex flex-col items-center justify-center
                ${isOver ? "border-blue/60 bg-blue/5" : myth ? "border-border" : "border-border/40"}`}
        >
            {myth ? (
                <div className="w-full p-3">
                    <MythCard myth={myth} onDragStart={onDragStart} onDragEnd={onDragEnd} />{" "}
                    <button
                        onClick={() => onRemove(slot)}
                        disabled={partyCount <= 1}
                        className="w-full mt-2 text-xs text-muted hover:text-red transition-colors font-display tracking-widest disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        ✕ Quitar
                    </button>
                </div>
            ) : (
                <div className="text-muted text-xs font-display tracking-widest text-center px-4">
                    <div className="text-2xl mb-1 opacity-20">＋</div>
                    Slot {slot + 1}
                </div>
            )}
        </div>
    );
}

export default function TeamPage() {
    const [all, setAll] = useState<MythInstance[]>([]);
    const [party, setParty] = useState<(MythInstance | null)[]>([null, null, null]);
    const [dragId, setDragId] = useState<string | null>(null);
    const dragIdRef = useRef<string | null>(null);
    const [overSlot, setOverSlot] = useState<number | null>(null);
    const [msg, setMsg] = useState("");

    useEffect(() => {
        load();
    }, []);

    async function load() {
        const creatures = await api.creatures();
        setAll(creatures);
        const newParty: (MythInstance | null)[] = [null, null, null];
        creatures
            .filter((c: MythInstance) => c.isInParty && !c.inNursery && c.slot !== null && c.slot >= 0)
            .forEach((c: MythInstance) => {
                if (c.slot !== null && c.slot <= 2) newParty[c.slot] = c;
            });
        setParty(newParty);
    }

    // Guarda automáticamente cada vez que cambia el equipo
    async function saveParty(newParty: (MythInstance | null)[]) {
        try {
            const partyPayload = newParty.map((m, slot) => (m ? { id: m.id, slot } : null)).filter(Boolean) as {
                id: string;
                slot: number;
            }[];
            await api.partyUpdate(partyPayload);
            setMsg("✅ Guardado");
            setTimeout(() => setMsg(""), 2000);
            load();
        } catch (e: any) {
            setMsg(`❌ ${e.message}`);
        }
    }

    const storage = all.filter((c) => !c.isInParty && !c.inNursery);

    function handleDrop(slot: number) {
        const id = dragIdRef.current;
        if (!id) return;
        const myth = all.find((c) => c.id === id);
        if (!myth) return;
        const newParty = party.map((p) => (p?.id === id ? null : p));
        newParty[slot] = myth;
        setParty(newParty);
        setDragId(null);
        dragIdRef.current = null;
        setOverSlot(null);
        saveParty(newParty);
    }

    function handleRemove(slot: number) {
        const newParty = [...party];
        newParty[slot] = null;
        setParty(newParty);
        saveParty(newParty);
    }

    function handleDropToStorage() {
        const id = dragIdRef.current;
        if (!id) return;
        const isInParty = party.some((p) => p?.id === id);
        if (!isInParty) return;
        const totalInParty = party.filter(Boolean).length;
        if (totalInParty <= 1) {
            setMsg("Need at least 1 Myth in the team");
            setTimeout(() => setMsg(""), 2000);
            return;
        }
        const newParty = party.map((p) => (p?.id === id ? null : p));
        setParty(newParty);
        setDragId(null);
        dragIdRef.current = null;
        saveParty(newParty);
    }
    return (
        <PageShell>
            <PageTopbar title="Team" />
            <div className="relative flex-shrink-0 flex items-center justify-between px-4 py-2 border-b" style={{ borderColor:"rgba(255,255,255,0.06)" }}>
                <span className="text-sm font-bold" style={{ color:"var(--text-primary)" }}>🐾 Active Team</span>
                {msg && (
                    <span
                        className="text-xs font-semibold"
                        style={{ color: msg.startsWith("✅") ? "#06d6a0" : "#e63946" }}
                    >
                        {msg}
                    </span>
                )}
            </div>

            <div className="relative flex-1 flex overflow-hidden p-6 gap-6">
                {/* Active Team */}
                <div className="w-64 flex-shrink-0 flex flex-col gap-3">
                    <div className="font-display font-bold text-sm tracking-widest text-white uppercase mb-1">
                        Active Team
                    </div>
                    {[0, 1, 2].map((slot) => (
                        <PartySlot
                            key={slot}
                            slot={slot}
                            myth={party[slot]}
                            onDrop={handleDrop}
                            onRemove={handleRemove}
                            isOver={overSlot === slot}
                            partyCount={party.filter(Boolean).length}
                            onDragStart={() => {
                                const m = party[slot];
                                if (m) {
                                    setDragId(m.id);
                                    dragIdRef.current = m.id;
                                }
                            }}
                            onDragEnd={() => {
                                setDragId(null);
                                dragIdRef.current = null;
                                setOverSlot(null);
                            }}
                        />
                    ))}
                    <div className="text-xs text-muted font-display text-center mt-1">
                        {party.filter(Boolean).length}/3 Myths
                    </div>
                </div>

                {/* Storage */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="font-display font-bold text-sm tracking-widest text-white uppercase mb-3 flex-shrink-0">
                        Storage — {storage.length} Myths
                    </div>
                    <div
                        className="flex-1 overflow-y-auto rounded-2xl border border-border bg-card/50 p-4"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDropToStorage}
                    >
                        {storage.length === 0 && all.filter((c) => !c.inNursery).length > 0 && (
                            <div className="text-white/60 text-xs text-center py-8 font-display tracking-widest">
                                Todos los Myths están en el equipo
                            </div>
                        )}
                        {storage.length === 0 && all.length === 0 && (
                            <div className="text-white/60 text-xs text-center py-8 font-display tracking-widest">
                                Sin Myths capturados aún
                            </div>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                            {storage.map((myth) => (
                                <MythCard
                                    key={myth.id}
                                    myth={myth}
                                    dragging={dragId === myth.id}
                                    onDragStart={() => {
                                        setDragId(myth.id);
                                        dragIdRef.current = myth.id;
                                    }}
                                    onDragEnd={() => {
                                        setDragId(null);
                                        dragIdRef.current = null;
                                        setOverSlot(null);
                                    }}
                                />
                            ))}
                        </div>
                    </div>

                    {all.filter((c) => c.inNursery).length > 0 && (
                        <div className="flex-shrink-0 mt-3 flex gap-2 flex-wrap items-center">
                            <div className="text-xs text-muted font-display tracking-widest">🥚 En guardería:</div>
                            {all
                                .filter((c) => c.inNursery)
                                .map((c) => (
                                    <div
                                        key={c.id}
                                        className="text-xs bg-yellow/10 border border-yellow/20 rounded-lg px-2 py-1 text-yellow font-display"
                                    >
                                        {(c as any).name ?? c.speciesId} Nv.{c.level}
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>
        </PageShell>
    );
}
