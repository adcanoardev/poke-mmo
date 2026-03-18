// apps/client/src/pages/TavernPage.tsx
import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import PageTopbar from "../components/PageTopbar";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DistortionEntry {
    name: string;
    slug?: string;
    rarity?: string;
    art?: { portrait?: string; front?: string; back?: string };
    baseStats?: { hp?:number; atk?:number; def?:number; spd?:number; critChance?:number };
    moves?: Move[];
    description?: string;
    triggerTurn?: number;
}
interface Myth {
    id: string;
    speciesId: string;
    name?: string;
    level: number;
    rarity: string;
    affinities: string[];
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    accuracy?: number;
    critChance?: number;
    moves?: Move[];
    art?: { portrait?: string; front?: string; back?: string } | string;
    distortion?: DistortionEntry[];   // from creatures.json via API
    inParty?: boolean;
    partySlot?: number;
    enhancer?: Enhancer | null;
}
interface Move {
    id: string;
    name: string;
    affinity: string;
    power?: number;
    cooldown: number;
    effect?: string;
    description?: string;
}
interface Enhancer {
    id: string;
    name: string;
    slot: string;
    level: number;
    statBoosts?: Record<string, number>;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const RARITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
    COMMON:    { label: "COM",   color: "#94a3b8", bg: "rgba(100,116,139,.18)", border: "rgba(100,116,139,.28)" },
    RARE:      { label: "RARE",  color: "#818cf8", bg: "rgba(99,102,241,.18)",  border: "rgba(99,102,241,.28)"  },
    EPIC:      { label: "EPIC",  color: "#c084fc", bg: "rgba(192,132,252,.18)", border: "rgba(192,132,252,.28)" },
    ELITE:     { label: "ELITE", color: "var(--text-primary)", bg: "rgba(226,232,240,.18)", border: "rgba(226,232,240,.28)" },
    LEGENDARY: { label: "LEG",   color: "var(--accent-gold)", bg: "rgba(251,191,36,.18)",  border: "rgba(251,191,36,.28)"  },
    MYTHIC:    { label: "MYT",   color: "#f472b6", bg: "rgba(244,114,182,.18)", border: "rgba(244,114,182,.28)" },
};

const RARITY_GLOW: Record<string, string> = {
    COMMON: "rgba(148,163,184,.35)", RARE: "rgba(99,102,241,.45)",
    EPIC: "rgba(192,132,252,.45)", ELITE: "rgba(226,232,240,.45)",
    LEGENDARY: "rgba(251,191,36,.5)", MYTHIC: "rgba(244,114,182,.55)",
};

const AFFINITY_ICON: Record<string, string> = {
    EMBER: "🔥", TIDE: "💧", GROVE: "🌿", VOLT: "⚡",
    STONE: "🪨", FROST: "❄️", VENOM: "☠️", IRON: "⚙️",
    SHADE: "🌑", ASTRAL: "🌀",
};

const AFFINITY_FILTERS = ["ALL", "EMBER", "TIDE", "GROVE", "VOLT", "FROST", "VENOM", "SHADE", "ASTRAL"];

const STAT_CONFIG = [
    { key: "maxHp",    label: "HP",   max: 200, color: "linear-gradient(90deg,#06d6a0,#0891b2)" },
    { key: "attack",   label: "ATK",  max: 160, color: "linear-gradient(90deg,#ef4444,#f97316)" },
    { key: "defense",  label: "DEF",  max: 160, color: "linear-gradient(90deg,#3b82f6,#6366f1)" },
    { key: "speed",    label: "SPD",  max: 160, color: "linear-gradient(90deg,#a78bfa,#7b2fff)" },
    { key: "accuracy", label: "ACC",  max: 100, color: "linear-gradient(90deg,#fbbf24,#f59e0b)" },
    { key: "critChance", label: "CRIT", max: 100, color: "linear-gradient(90deg,#f472b6,#ec4899)" },
];

// ─── Utils ────────────────────────────────────────────────────────────────────
// portrait → para cards pequeñas (grid izquierda)
function mythArtUrl(myth: Myth): string {
    if (!myth.art) return "";
    if (typeof myth.art === "string") return myth.art;
    return myth.art.portrait ?? myth.art.front ?? myth.art.back ?? "";
}

// front → para el display grande central
function mythFrontUrl(art: any): string {
    if (!art) return "";
    if (typeof art === "string") return art;
    return art.front ?? art.portrait ?? art.back ?? "";
}

function calcPower(m: Myth): number {
    const MULT: Record<string, number> = { COMMON:1, RARE:1.2, EPIC:1.4, ELITE:1.6, LEGENDARY:2, MYTHIC:2.5 };
    return Math.floor(((m.maxHp||0)*.4+(m.attack||0)*.3+(m.defense||0)*.2+(m.speed||0)*.1)*(MULT[m.rarity]??1));
}

// ─── MythCard (left grid) ─────────────────────────────────────────────────────
function MythCard({ myth, selected, onClick }: { myth: Myth; selected: boolean; onClick: () => void }) {
    const rar = RARITY_CONFIG[myth.rarity] ?? RARITY_CONFIG.COMMON;
    const aff = myth.affinities?.[0] ?? "";
    const artUrl = mythArtUrl(myth);
    const power = calcPower(myth);

    return (
        <div onClick={onClick}
            className="relative overflow-hidden cursor-pointer transition-all duration-200"
            style={{
                borderRadius: 10,
                aspectRatio: "0.72",
                border: selected ? `2px solid ${rar.color}cc` : `1px solid ${rar.border}`,
                boxShadow: selected ? `0 0 16px ${RARITY_GLOW[myth.rarity]}` : "none",
                background: "linear-gradient(135deg,#0d1525,#070f1a)",
                transform: selected ? "scale(1.04)" : "scale(1)",
            }}>
            {/* Art background */}
            {artUrl ? (
                <img src={artUrl} alt={myth.name ?? myth.speciesId}
                    className="absolute inset-0 w-full h-full object-cover object-top"
                    style={{ opacity: 0.85 }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center"
                    style={{ fontSize: 36, opacity: 0.4 }}>
                    {AFFINITY_ICON[aff] ?? "❓"}
                </div>
            )}
            {/* Gradient overlay bottom */}
            <div className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, transparent 30%, rgba(4,8,15,.96) 80%)" }} />
            {/* Top badges */}
            <div className="absolute top-1.5 left-1.5 right-1.5 flex justify-between items-start">
                <span className="font-mono text-[7px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: rar.bg, color: rar.color, border: `1px solid ${rar.border}` }}>
                    {rar.label}
                </span>
                {myth.inParty && (
                    <span className="w-2 h-2 rounded-full"
                        style={{ background: "#06d6a0", boxShadow: "0 0 6px #06d6a0", display: "block" }} />
                )}
            </div>
            {/* Bottom info */}
            <div className="absolute bottom-0 left-0 right-0 px-1.5 pb-1.5">
                <div className="tvn-card-name font-black text-white leading-tight truncate" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "var(--font-2xs)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                    {myth.name ?? myth.speciesId}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                    <span style={{ fontSize: 7, fontFamily: "monospace", color: "rgba(255,255,255,.45)" }}>
                        {AFFINITY_ICON[aff]} {aff}
                    </span>
                    <span style={{ fontSize: 7, fontFamily: "monospace", color: "rgba(255,255,255,.4)" }}>
                        Lv.{myth.level}
                    </span>
                </div>
                <div style={{ fontSize: 7, fontFamily: "monospace", color: "var(--accent-gold)" }}>⚡{power}</div>
            </div>
        </div>
    );
}

// ─── Right panel tabs ─────────────────────────────────────────────────────────
type Tab = "stats" | "skills" | "gear";

const VTABS: { id: Tab; icon: string; label: string }[] = [
    { id: "stats",  icon: "📊", label: "Stats"  },
    { id: "skills", icon: "⚔️", label: "Skills" },
    { id: "gear",   icon: "💎", label: "Gear"   },
];

function StatsPanel({ myth }: { myth: Myth }) {
    const rar = RARITY_CONFIG[myth.rarity] ?? RARITY_CONFIG.COMMON;
    const power = calcPower(myth);

    return (
        <div className="flex flex-col p-2 overflow-hidden h-full" style={{ gap: 3 }}>
            {STAT_CONFIG.map(({ key, label, max, color }) => {
                const val = (myth as any)[key] ?? 0;
                const pct = Math.min(100, (val / max) * 100);
                return (
                    <div key={key} className="tvn-stat-row flex items-center flex-shrink-0"
                        style={{ gap: 6, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 7, padding: "3px 8px" }}>
                        <span className="tvn-stat-label font-mono flex-shrink-0"
                            style={{ color: "rgba(255,255,255,.38)", letterSpacing: ".07em", fontSize: "var(--font-xs)", width: 26 }}>{label}</span>
                        <span className="tvn-stat-value font-black flex-shrink-0"
                            style={{ fontFamily: "'Rajdhani',sans-serif", color: "var(--text-primary)", fontSize: "var(--font-md)", width: 26 }}>{val}</span>
                        <div className="tvn-stat-bar flex-1 rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,.07)" }}>
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                        </div>
                    </div>
                );
            })}
            {/* Affinity + Rarity + Power — inline at bottom, no scroll */}
            <div className="flex items-center justify-between flex-shrink-0 mt-1" style={{ gap: 4 }}>
                <div className="flex gap-1 flex-wrap flex-1">
                    {(myth.affinities ?? []).map(a => (
                        <span key={a} className="tvn-aff-tag font-mono px-1.5 py-0.5 rounded-md"
                            style={{ fontSize: "var(--font-2xs)", background: "rgba(99,102,241,.12)", border: "1px solid rgba(99,102,241,.25)", color: "#818cf8" }}>
                            {AFFINITY_ICON[a] ?? ""} {a}
                        </span>
                    ))}
                    <span className="font-mono px-1.5 py-0.5 rounded-md"
                        style={{ fontSize: "var(--font-2xs)", background: rar.bg, color: rar.color, border: `1px solid ${rar.border}` }}>
                        {myth.rarity}
                    </span>
                </div>
                <div className="tvn-power font-black flex-shrink-0 px-2 py-1 rounded-lg"
                    style={{ fontFamily: "'Rajdhani',sans-serif", color: "var(--accent-gold)", fontSize: "var(--font-md)",
                        background: "rgba(251,191,36,.07)", border: "1px solid rgba(251,191,36,.18)" }}>
                    ⚡{power.toLocaleString()}
                </div>
            </div>
        </div>
    );
}

function SkillsPanel({ myth }: { myth: Myth }) {
    const moves = myth.moves ?? [];
    const CD_LABEL: Record<number, string> = { 0: "Basic · CD:0", 2: "Skill · CD:2" };
    return (
        <div className="flex flex-col gap-2 p-3 overflow-y-auto h-full" style={{ scrollbarWidth: "none" }}>
            <p className="font-mono text-[8px] tracking-widest mb-1" style={{ color: "rgba(255,255,255,.2)" }}>MOVES</p>
            {moves.length === 0 && (
                <p className="font-mono text-[10px] text-center mt-4" style={{ color: "rgba(255,255,255,.25)" }}>No move data</p>
            )}
            {moves.map((move, i) => {
                const aff = move.affinity ?? "";
                const cdLabel = i === 0 ? "Basic · CD:0" : i === 1 ? "Skill · CD:2" : `Ultimate · CD:${move.cooldown}+`;
                return (
                    <div key={move.id ?? i} className="p-2.5 rounded-xl"
                        style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)" }}>
                        <div className="flex items-center justify-between mb-1">
                            <span className="tvn-move-name font-black" style={{ fontFamily: "'Rajdhani',sans-serif", color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                                {AFFINITY_ICON[aff] ?? ""} {move.name}
                            </span>
                            <span className="font-mono text-[8px] px-1.5 py-0.5 rounded-md"
                                style={{ background: "rgba(167,139,250,.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,.2)" }}>
                                {cdLabel}
                            </span>
                        </div>
                        {(move.description ?? move.effect) && (
                            <p className="tvn-move-desc font-mono leading-relaxed" style={{ color: "rgba(255,255,255,.38)", fontSize: "var(--font-xs)" }}>
                                {move.description ?? move.effect}
                            </p>
                        )}
                        {move.power && (
                            <p className="font-mono text-[9px] mt-1" style={{ color: "var(--accent-gold)" }}>Power: {move.power}</p>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

function GearPanel({ myth }: { myth: Myth }) {
    const enhancer = myth.enhancer ?? null;
    const slots = [
        { id: "weapon",    label: "Weapon",    unlockLv: 1  },
        { id: "armor",     label: "Armor",     unlockLv: 20 },
        { id: "accessory", label: "Accessory", unlockLv: 40 },
    ];
    return (
        <div className="flex flex-col gap-2 p-3 overflow-y-auto h-full" style={{ scrollbarWidth: "none" }}>
            <p className="font-mono text-[8px] tracking-widest mb-1" style={{ color: "rgba(255,255,255,.2)" }}>EQUIPPED GEMS</p>
            {slots.map(slot => {
                const locked = myth.level < slot.unlockLv;
                const equipped = !locked && enhancer?.slot === slot.id;
                return (
                    <div key={slot.id} className="flex items-center gap-2.5 p-2.5 rounded-xl"
                        style={{
                            background: equipped ? "rgba(251,191,36,.05)" : "rgba(255,255,255,.02)",
                            border: equipped ? "1px solid rgba(251,191,36,.22)" : locked ? "1px dashed rgba(255,255,255,.07)" : "1px dashed rgba(255,255,255,.12)",
                            opacity: locked ? 0.45 : 1,
                        }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: equipped ? "rgba(251,191,36,.12)" : "rgba(255,255,255,.04)", border: equipped ? "1px solid rgba(251,191,36,.28)" : "1px dashed rgba(255,255,255,.12)", fontSize: 18 }}>
                            {locked ? "🔒" : equipped ? "💎" : "＋"}
                        </div>
                        <div className="flex-1 min-w-0">
                            {equipped && enhancer ? (
                                <>
                                    <p className="font-black text-xs" style={{ fontFamily: "'Rajdhani',sans-serif", color: "var(--text-primary)", textTransform: "uppercase" }}>
                                        {enhancer.name} Lv.{enhancer.level}
                                    </p>
                                    <p className="font-mono text-[9px]" style={{ color: "rgba(251,191,36,.7)" }}>
                                        {Object.entries(enhancer.statBoosts ?? {}).map(([k,v]) => `+${v} ${k}`).join(" · ")}
                                    </p>
                                </>
                            ) : locked ? (
                                <p className="font-mono text-[9px]" style={{ color: "rgba(255,255,255,.22)" }}>
                                    {slot.label} · Unlock Lv.{slot.unlockLv}
                                </p>
                            ) : (
                                <p className="font-mono text-[9px]" style={{ color: "rgba(255,255,255,.3)" }}>
                                    {slot.label} slot — empty
                                </p>
                            )}
                        </div>
                        {equipped && (
                            <button className="font-mono text-[9px] transition-colors hover:text-white/60"
                                style={{ color: "rgba(255,255,255,.25)" }}>⬆ Upgrade</button>
                        )}
                    </div>
                );
            })}
            <div className="mt-2 p-2.5 rounded-xl text-center"
                style={{ background: "rgba(255,255,255,.02)", border: "1px dashed rgba(255,255,255,.07)" }}>
                <p className="font-mono text-[9px]" style={{ color: "rgba(255,255,255,.22)" }}>
                    Gems drop from Sanctuaries & Events
                </p>
            </div>
        </div>
    );
}

function FormPanel({ myth }: { myth: Myth }) {
    const rar = RARITY_CONFIG[myth.rarity] ?? RARITY_CONFIG.COMMON;
    const [activeForm, setActiveForm] = useState(0);

    const forms = [
        {
            label: "BASE",
            sublabel: "Current form",
            color: rar.color,
            glow: RARITY_GLOW[myth.rarity],
            desc: "Original form. Balanced stats and standard move set.",
            statMods: {} as Record<string,string>,
            moveMod: null as string|null,
        },
        {
            label: "FORM 2",
            sublabel: "50% Distortion",
            color: "#a78bfa",
            glow: "rgba(167,139,250,.5)",
            desc: "Power surge at half Distortion. ATK and SPD increase, DEF drops.",
            statMods: { ATK: "+15", SPD: "+10", DEF: "-8" } as Record<string,string>,
            moveMod: "Skill move evolves — enhanced version unlocked.",
        },
        {
            label: "FORM 3",
            sublabel: "MAX Distortion",
            color: "#f472b6",
            glow: "rgba(244,114,182,.55)",
            desc: "True form unleashed. All stats amplified. New ultimate move activated.",
            statMods: { HP: "+25", ATK: "+30", SPD: "+20", DEF: "+10" } as Record<string,string>,
            moveMod: "Ultimate move changes to its most powerful version.",
        },
    ];

    const active = forms[activeForm];

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Form selector pills */}
            <div className="flex gap-1.5 p-2 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                {forms.map((f, i) => (
                    <button key={i} onClick={() => setActiveForm(i)}
                        className="flex-1 rounded-lg transition-all active:scale-95"
                        style={{
                            padding: "5px 4px",
                            background: activeForm === i ? `${f.color}20` : "rgba(255,255,255,.03)",
                            border: activeForm === i ? `1px solid ${f.color}55` : "1px solid rgba(255,255,255,.08)",
                            boxShadow: activeForm === i ? `0 0 10px ${f.color}22` : "none",
                            cursor: "pointer", outline: "none",
                        }}>
                        <div className="font-black" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "var(--font-xs)", letterSpacing: ".06em",
                            color: activeForm === i ? f.color : "rgba(255,255,255,.3)", textTransform: "uppercase" }}>
                            {f.label}
                        </div>
                        <div className="font-mono" style={{ fontSize: 7, color: activeForm === i ? `${f.color}88` : "rgba(255,255,255,.2)", marginTop: 1 }}>
                            {f.sublabel}
                        </div>
                    </button>
                ))}
            </div>

            {/* Active form content */}
            <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
                <p className="font-mono text-[9px] leading-relaxed" style={{ color: "rgba(255,255,255,.45)", lineHeight: 1.5 }}>
                    {active.desc}
                </p>

                {Object.keys(active.statMods).length > 0 && (
                    <>
                        <p className="font-mono text-[8px] tracking-widest" style={{ color: "rgba(255,255,255,.2)" }}>STAT CHANGES</p>
                        <div className="grid grid-cols-2 gap-1">
                            {Object.entries(active.statMods).map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between px-2 py-1 rounded-lg"
                                    style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)" }}>
                                    <span className="font-mono" style={{ fontSize: "var(--font-2xs)", color: "rgba(255,255,255,.4)" }}>{k}</span>
                                    <span className="font-black" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "var(--font-base)",
                                        color: v.startsWith("+") ? "#06d6a0" : "#ef4444" }}>{v}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {active.moveMod && (
                    <div className="px-2 py-2 rounded-xl"
                        style={{ background: `${active.color}0d`, border: `1px solid ${active.color}30` }}>
                        <p className="font-mono text-[9px] leading-relaxed" style={{ color: `${active.color}cc` }}>
                            ⚔️ {active.moveMod}
                        </p>
                    </div>
                )}

                {activeForm === 0 && (
                    <div className="px-2 py-2 rounded-xl"
                        style={{ background: "rgba(167,139,250,.06)", border: "1px solid rgba(167,139,250,.15)" }}>
                        <p className="font-mono text-[9px] leading-relaxed" style={{ color: "rgba(167,139,250,.8)" }}>
                            🌀 Fill the Distortion bar in battle to unlock Form 2 and Form 3.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── TavernPage ───────────────────────────────────────────────────────────────
// ─── Inventory items ──────────────────────────────────────────────────────────
const INV_ITEMS = [
    { id:"elixir",       icon:"⚗️", name:"Elixir",       rarity:"Consumable", color:"var(--accent-blue)", desc:"Instantly restores a Myth's HP to full. Use before a tough battle.",           source:"Laboratory · Outpost" },
    { id:"turbo_elixir", icon:"💠", name:"Turbo Elixir", rarity:"Consumable", color:"var(--accent-purple)", desc:"Doubles nursery training speed for 1 hour. Great for fast leveling.",           source:"Laboratory · Special Events" },
    { id:"antidote",     icon:"🧪", name:"Antidote",     rarity:"Consumable", color:"var(--accent-green)", desc:"Cures all status effects: poison, burn and paralysis in one use.",              source:"Laboratory · Outpost" },
    { id:"boost_atk",    icon:"🔥", name:"ATK Boost",    rarity:"Consumable", color:"#f97316", desc:"Increases a Myth's ATK by 20% for the duration of the next battle.",            source:"Laboratory · PvP Rewards" },
    { id:"boost_def",    icon:"🛡️", name:"DEF Boost",    rarity:"Consumable", color:"#3b82f6", desc:"Increases a Myth's DEF by 20% for the duration of the next battle.",            source:"Laboratory · Sanctuaries" },
    { id:"mega_elixir",  icon:"✨", name:"Mega Elixir",  rarity:"Consumable", color:"#fcd34d", desc:"Restores the entire team to 100% HP. Rare and powerful — save it for bosses.",  source:"Special Events · Guild Rewards" },
    { id:"fragment",     icon:"◈",  name:"Fragment",     rarity:"Material",   color:"#ffffff", desc:"Mythara essence compressed into crystalline form. Open at the Forge to summon a Myth.", source:"Forge · Sanctuaries · Events" },
    { id:"rock_fragment",icon:"🪨", name:"Rock Fragment", rarity:"Material",  color:"#94a3b8", desc:"Raw mineral extracted from the Mine. Used in future crafting recipes.",         source:"Mine · Outpost" },
    { id:"arcane_gear",  icon:"⚙️", name:"Arcane Gear",  rarity:"Material",   color:"#64748b", desc:"Mechanical part imbued with arcane energy. Used in future crafting.",           source:"Laboratory · Bosses" },
];

export default function TavernPage() {
    const [myths, setMyths] = useState<Myth[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Myth | null>(null);
    const [tab, setTab] = useState<Tab>("stats");
    const [affFilter, setAffFilter] = useState("ALL");
    const [leftTab, setLeftTab] = useState<"myths" | "inventory">("myths");
    const [selItem, setSelItem] = useState<typeof INV_ITEMS[0] | null>(INV_ITEMS[0]);
    const [selectedForm, setSelectedForm] = useState(0);
    const [distortionFlash, setDistortionFlash] = useState(false);

    // Normaliza un creature del backend: moves/distortion/stats pueden venir
    // directos o anidados en speciesData segun la version del backend
    const normalizeMyth = (c: any): Myth => {
        const sd = c.speciesData ?? c.species ?? c.speciesInfo ?? {};
        return {
            ...c,
            moves:      c.moves?.length      ? c.moves      : sd.moves?.length      ? sd.moves      : [],
            distortion: c.distortion?.length ? c.distortion : sd.distortion?.length ? sd.distortion : [],
            art:        c.art    ?? sd.art   ?? null,
            affinities: c.affinities?.length ? c.affinities : sd.affinities?.length ? sd.affinities : [],
            maxHp:      c.maxHp      ?? c.hp   ?? sd.baseStats?.hp        ?? 0,
            attack:     c.attack     ?? c.atk  ?? sd.baseStats?.atk       ?? 0,
            defense:    c.defense    ?? c.def  ?? sd.baseStats?.def       ?? 0,
            speed:      c.speed      ?? c.spd  ?? sd.baseStats?.spd       ?? 0,
            accuracy:   c.accuracy            ?? sd.baseStats?.acc        ?? 100,
            critChance: c.critChance           ?? sd.baseStats?.critChance ?? 0,
            rarity:     c.rarity    ?? sd.rarity   ?? "COMMON",
            name:       c.name      ?? sd.name     ?? c.speciesId,
        };
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const raw = await api.creatures() as any[];
            const all: Myth[] = (raw ?? []).map(normalizeMyth);
            setMyths(all);
            if (all.length > 0) setSelected(all[0]);
        } catch {}
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = myths.filter(m =>
        affFilter === "ALL" || (m.affinities ?? []).includes(affFilter)
    );

    const rar = selected ? (RARITY_CONFIG[selected.rarity] ?? RARITY_CONFIG.COMMON) : null;
    const artUrl = selected ? mythArtUrl(selected) : "";         // portrait — for left grid cards
    const power = selected ? calcPower(selected) : 0;

    return (
        <div className="fixed inset-0 flex flex-col overflow-hidden"
            style={{ background: "#070b14", fontFamily: "'Exo 2',sans-serif" }}>
            <style>{`
                @media (min-width: 768px) {
                    .tvn-card-name  { font-size: 13px !important; }
                    .tvn-stat-label { font-size: 13px !important; }
                    .tvn-stat-value { font-size: 22px !important; }
                    .tvn-stat-row   { padding: 6px 12px !important; border-radius: 10px !important; }
                    .tvn-stat-bar   { height: 8px !important; }
                    .tvn-move-name  { font-size: 16px !important; }
                    .tvn-move-desc  { font-size: 11px !important; }
                    .tvn-move-row   { padding: 10px 12px !important; border-radius: 12px !important; }
                    .tvn-vtab-icon  { font-size: 20px !important; }
                    .tvn-vtab-label { font-size: 9px  !important; }
                    .tvn-vtab-btn   { padding-top: 12px !important; padding-bottom: 12px !important; gap: 5px !important; }
                    .tvn-filter-btn { font-size: 11px !important; padding: 3px 9px !important; }
                    .tvn-left-tab   { font-size: 10px !important; }
                    .tvn-inv-name   { font-size: 13px !important; }
                    .tvn-inv-rarity { font-size: 9px  !important; }
                    .tvn-inv-dname  { font-size: 16px !important; }
                    .tvn-inv-desc   { font-size: 11px !important; }
                    .tvn-inv-src    { font-size: 10px !important; }
                    .tvn-power      { font-size: 20px !important; }
                    .tvn-panel-lbl  { font-size: 10px !important; letter-spacing: .18em !important; margin-bottom: 6px !important; }
                    .tvn-right      { width: clamp(260px, 36%, 420px) !important; }
                    .tvn-vtabs-col  { width: 56px !important; }
                    .tvn-aff-tag    { font-size: 10px !important; padding: 2px 8px !important; }
                    .tvn-cd-badge   { font-size: 9px  !important; padding: 2px 8px !important; }
                }
                @media (min-width: 1280px) {
                    .tvn-card-name  { font-size: 14px !important; }
                    .tvn-stat-label { font-size: 14px !important; }
                    .tvn-stat-value { font-size: 26px !important; }
                    .tvn-stat-row   { padding: 8px 14px !important; }
                    .tvn-stat-bar   { height: 9px !important; }
                    .tvn-move-name  { font-size: 18px !important; }
                    .tvn-move-desc  { font-size: 12px !important; }
                    .tvn-move-row   { padding: 12px 14px !important; }
                    .tvn-vtab-icon  { font-size: 22px !important; }
                    .tvn-vtab-label { font-size: 10px !important; }
                    .tvn-vtab-btn   { padding-top: 14px !important; padding-bottom: 14px !important; }
                    .tvn-filter-btn { font-size: 12px !important; padding: 4px 11px !important; }
                    .tvn-left-tab   { font-size: 12px !important; }
                    .tvn-inv-name   { font-size: 15px !important; }
                    .tvn-inv-rarity { font-size: 10px !important; }
                    .tvn-inv-dname  { font-size: 18px !important; }
                    .tvn-inv-desc   { font-size: 13px !important; }
                    .tvn-inv-src    { font-size: 12px !important; }
                    .tvn-power      { font-size: 24px !important; }
                    .tvn-panel-lbl  { font-size: 11px !important; }
                    .tvn-right      { width: clamp(300px, 38%, 480px) !important; }
                    .tvn-vtabs-col  { width: 62px !important; }
                    .tvn-aff-tag    { font-size: 11px !important; padding: 3px 10px !important; }
                    .tvn-cd-badge   { font-size: 10px !important; padding: 2px 10px !important; }
                }
            `}</style>

            {/* Ambient BG */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div style={{ position:"absolute",inset:0,background:"radial-gradient(ellipse 70% 50% at 50% -10%,rgba(123,47,255,0.06) 0%,transparent 60%)" }} />
                <div style={{ position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px)",backgroundSize:"40px 40px" }} />
            </div>

            <PageTopbar
                title={
                    <div className="flex flex-col items-center">
                        <span className="tracking-[.22em] uppercase font-black" style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:"var(--font-lg)", color:"var(--text-primary)" }}>Tavern</span>
                        <span className="tracking-widest uppercase" style={{ fontSize:"var(--font-2xs)", color:"var(--text-muted)", fontFamily:"monospace" }}>My Myths · Inventory</span>
                    </div>
                }
            />

            {/* Main: 3 columns */}
            <div className="relative flex-1 flex overflow-hidden min-h-0">

                {/* ── LEFT: myth card grid / inventory ── */}
                <div className="flex flex-col overflow-hidden flex-shrink-0"
                    style={{ width: "clamp(160px,30%,260px)", borderRight: "1px solid rgba(255,255,255,.05)" }}>

                    {/* ── Left tabs: Myths / Inventory ── */}
                    <div className="flex flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                        {(["myths","inventory"] as const).map(lt => (
                            <button key={lt} onClick={() => setLeftTab(lt)}
                                className="tvn-left-tab flex-1 py-2 font-mono uppercase tracking-widest transition-all"
                                style={{
                                    fontSize: "var(--font-2xs)",
                                    borderBottom: leftTab === lt ? "2px solid #a78bfa" : "2px solid transparent",
                                    color: leftTab === lt ? "#a78bfa" : "rgba(255,255,255,.3)",
                                    background: leftTab === lt ? "rgba(167,139,250,.06)" : "transparent",
                                    cursor: "pointer", border: "none", outline: "none",
                                    borderBottomWidth: 2, borderBottomStyle: "solid",
                                    borderBottomColor: leftTab === lt ? "#a78bfa" : "transparent",
                                }}>
                                {lt === "myths" ? "🐉 Myths" : "🎒 Inventory"}
                            </button>
                        ))}
                    </div>

                    {leftTab === "myths" ? (<>
                    {/* Affinity filter */}
                    <div className="flex gap-1.5 flex-wrap p-2 flex-shrink-0"
                        style={{ borderBottom: "1px solid rgba(255,255,255,.05)" }}>
                        {AFFINITY_FILTERS.map(f => (
                            <button key={f} onClick={() => setAffFilter(f)}
                                className="tvn-filter-btn transition-all active:scale-95"
                                style={{
                                    padding: "2px 7px", borderRadius: 5, fontSize: "var(--font-xs)", fontFamily: "monospace", cursor: "pointer",
                                    background: affFilter === f ? "rgba(167,139,250,.18)" : "rgba(255,255,255,.03)",
                                    border: affFilter === f ? "1px solid rgba(167,139,250,.35)" : "1px solid rgba(255,255,255,.07)",
                                    color: affFilter === f ? "#a78bfa" : "rgba(255,255,255,.35)",
                                }}>
                                {f === "ALL" ? "All" : AFFINITY_ICON[f] ?? f}
                            </button>
                        ))}
                    </div>
                    {/* Grid */}
                    <div className="flex-1 overflow-y-auto p-2"
                        style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5, alignContent: "start", scrollbarWidth: "none" }}>
                        {loading ? (
                            [...Array(6)].map((_,i) => (
                                <div key={i} className="rounded-xl animate-pulse"
                                    style={{ aspectRatio: ".72", background: "rgba(255,255,255,.05)" }} />
                            ))
                        ) : filtered.map(m => (
                            <MythCard key={m.id} myth={m} selected={selected?.id === m.id}
                                onClick={() => { setSelected(m); setTab("stats"); setSelectedForm(0); setDistortionFlash(false); }} />
                        ))}
                        {!loading && filtered.length === 0 && (
                            <div className="col-span-3 text-center pt-8 font-mono text-[10px]"
                                style={{ color: "rgba(255,255,255,.25)" }}>No myths found</div>
                        )}
                    </div>
                    {/* Footer count */}
                    <div className="flex-shrink-0 px-3 py-2 font-mono text-[9px] text-center"
                        style={{ color: "rgba(255,255,255,.22)", borderTop: "1px solid rgba(255,255,255,.05)" }}>
                        {myths.length} myths · {myths.filter(m => m.inParty).length} in party 🟢
                    </div>
                    </>) : (
                    /* ── INVENTORY view ── */
                    <div className="flex-1 flex overflow-hidden min-h-0">
                        {/* Items list */}
                        <div className="flex flex-col overflow-y-auto flex-1" style={{ scrollbarWidth: "none" }}>
                            {INV_ITEMS.map(item => (
                                <button key={item.id} onClick={() => setSelItem(item)}
                                    className="flex items-center gap-3 px-3 py-2.5 transition-all text-left flex-shrink-0"
                                    style={{
                                        borderBottom: "1px solid rgba(255,255,255,.04)",
                                        background: selItem?.id === item.id ? `${item.color}0e` : "transparent",
                                        borderLeft: selItem?.id === item.id ? `2px solid ${item.color}` : "2px solid transparent",
                                        cursor: "pointer",
                                    }}>
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                                        style={{ background: `${item.color}12`, border: `1px solid ${item.color}28`, filter: `drop-shadow(0 0 6px ${item.color}55)` }}>
                                        {item.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="tvn-inv-name font-black leading-tight truncate" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "var(--font-sm)", color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: ".04em" }}>
                                            {item.name}
                                        </p>
                                        <p className="tvn-inv-rarity font-mono" style={{ fontSize: "var(--font-2xs)", color: `${item.color}aa`, marginTop: 1 }}>
                                            {item.rarity}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                        {/* Item detail */}
                        {selItem && (
                            <div className="flex flex-col p-3 overflow-y-auto"
                                style={{ width: "55%", borderLeft: "1px solid rgba(255,255,255,.06)", scrollbarWidth: "none" }}>
                                {/* Big icon */}
                                <div className="flex items-center justify-center mb-3">
                                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                        style={{ background: `${selItem.color}12`, border: `1px solid ${selItem.color}30`, fontSize: 38, filter: `drop-shadow(0 0 14px ${selItem.color}77)` }}>
                                        {selItem.icon}
                                    </div>
                                </div>
                                <p className="tvn-inv-dname font-black text-center mb-0.5"
                                    style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "var(--font-base)", color: selItem.color, textTransform: "uppercase", letterSpacing: ".06em" }}>
                                    {selItem.name}
                                </p>
                                <p className="font-mono text-center mb-3"
                                    style={{ fontSize: "var(--font-2xs)", color: "rgba(255,255,255,.3)", letterSpacing: ".1em" }}>
                                    {selItem.rarity}
                                </p>
                                <p className="tvn-inv-desc font-mono leading-relaxed mb-3"
                                    style={{ fontSize: "var(--font-xs)", color: "rgba(255,255,255,.5)", lineHeight: 1.55 }}>
                                    {selItem.desc}
                                </p>
                                <div className="px-2.5 py-2 rounded-xl"
                                    style={{ background: `${selItem.color}0a`, border: `1px solid ${selItem.color}22` }}>
                                    <p className="font-mono mb-0.5" style={{ fontSize: 7, color: "rgba(255,255,255,.25)", letterSpacing: ".12em", textTransform: "uppercase" }}>
                                        Where to get
                                    </p>
                                    <p className="tvn-inv-src font-mono" style={{ fontSize: "var(--font-xs)", color: selItem.color }}>
                                        {selItem.source}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                    )}
                </div>

                {/* ── CENTER: selected myth art ── */}
                <div className="flex-1 flex flex-col relative overflow-hidden min-w-0">
                    {/* Ambient glow */}
                    {selected && (
                        <div className="absolute inset-0 pointer-events-none"
                            style={{ background: `radial-gradient(ellipse 70% 75% at 50% 55%, ${RARITY_GLOW[selected.rarity]} 0%, transparent 70%)` }} />
                    )}
                    {/* Grid texture */}
                    <div className="absolute inset-0 pointer-events-none"
                        style={{ background: "repeating-linear-gradient(0deg,rgba(255,255,255,.01) 0px,transparent 1px,transparent 32px),repeating-linear-gradient(90deg,rgba(255,255,255,.01) 0px,transparent 1px,transparent 32px)" }} />

                    {selected ? (() => {
                        // Build form tabs from real distortion data
                        const FORM_COLORS = ["#e2e8f0", "#a78bfa", "#f472b6", "#fbbf24"];
                        const distForms = selected.distortion ?? [];
                        const allForms = [
                            {
                                label: "BASE",
                                sublabel: "Original",
                                color: rar?.color ?? "#e2e8f0",
                                artUrl: mythFrontUrl(selected.art),   // front for center display
                                displayName: selected.name ?? selected.speciesId,
                            },
                            ...distForms.map((d, i) => {
                                const dArt = d.art;
                                const dArtUrl = mythFrontUrl(dArt); // front for center display
                                return {
                                    label: `FORM ${i + 2}`,
                                    sublabel: d.name,
                                    color: FORM_COLORS[i + 1] ?? "#a78bfa",
                                    artUrl: dArtUrl,
                                    displayName: d.name,
                                };
                            }),
                        ];
                        const clampedForm = Math.min(selectedForm, allForms.length - 1);
                        const activeForm = allForms[clampedForm];
                        const activeGlow = RARITY_GLOW[selected.rarity] ?? "rgba(226,232,240,.4)";

                        return (
                            <div className="flex flex-col h-full">
                                {/* ── Distortion sub-tabs — only show if myth has distortions ── */}
                                {allForms.length > 1 && (
                                    <div className="flex gap-1.5 px-3 pt-2.5 pb-0 flex-shrink-0">
                                        {allForms.map((f, i) => (
                                            <button key={i} onClick={() => {
                                                    if (i === clampedForm) return;
                                                    setDistortionFlash(true);
                                                    setTimeout(() => {
                                                        setSelectedForm(i);
                                                        setDistortionFlash(false);
                                                    }, 420);
                                                }}
                                                className="flex-1 rounded-lg transition-all active:scale-95"
                                                style={{
                                                    padding: "4px 2px",
                                                    background: clampedForm === i ? `${f.color}20` : "rgba(255,255,255,.03)",
                                                    border: clampedForm === i ? `1px solid ${f.color}55` : "1px solid rgba(255,255,255,.07)",
                                                    boxShadow: clampedForm === i ? `0 0 10px ${f.color}22` : "none",
                                                    cursor: "pointer", outline: "none",
                                                }}>
                                                <div className="font-black" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "var(--font-xs)",
                                                    letterSpacing: ".08em", textTransform: "uppercase",
                                                    color: clampedForm === i ? f.color : "rgba(255,255,255,.28)" }}>
                                                    {f.label}
                                                </div>
                                                <div className="font-mono" style={{ fontSize: 6,
                                                    color: clampedForm === i ? `${f.color}88` : "rgba(255,255,255,.18)", marginTop: 1 }}>
                                                    {f.sublabel}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Glow rings — color cambia con la forma activa */}
                                <div className="absolute pointer-events-none"
                                    style={{ width: 180, height: 180, borderRadius: "50%",
                                        border: `1px solid ${activeForm.color}22`,
                                        top: "48%", left: "50%", transform: "translate(-50%,-55%)",
                                        transition: "border-color .4s" }} />
                                <div className="absolute pointer-events-none"
                                    style={{ width: 120, height: 120, borderRadius: "50%",
                                        border: `1px solid ${activeForm.color}35`,
                                        top: "48%", left: "50%", transform: "translate(-50%,-55%)",
                                        transition: "border-color .4s" }} />

                                {/* Art — cambia según la forma */}
                                <div className="flex-1 flex items-center justify-center relative min-h-0">
                                    {activeForm.artUrl ? (
                                        <img
                                            key={activeForm.artUrl}
                                            src={activeForm.artUrl}
                                            alt={activeForm.displayName}
                                            className="object-contain object-center select-none"
                                            style={{
                                                maxHeight: "55%", maxWidth: "65%",
                                                filter: `drop-shadow(0 0 30px ${activeGlow}) drop-shadow(0 0 60px ${activeGlow})`,
                                                animation: "nurseryFloat 4s ease-in-out infinite",
                                                opacity: distortionFlash ? 0 : 1,
                                                transition: "opacity 0.2s ease",
                                            }}
                                            draggable={false} />
                                    ) : (
                                        <div className="select-none" style={{ fontSize: 72,
                                            filter: `drop-shadow(0 0 30px ${activeGlow})`,
                                            animation: "nurseryFloat 4s ease-in-out infinite",
                                            opacity: distortionFlash ? 0 : 1,
                                            transition: "opacity 0.2s ease" }}>
                                            {AFFINITY_ICON[selected.affinities?.[0]] ?? "❓"}
                                        </div>
                                    )}
                                    {/* Super Saiyan distortion flash overlay */}
                                    {distortionFlash && (
                                        <div className="absolute inset-0 pointer-events-none flex items-center justify-center" style={{ zIndex: 20 }}>
                                            {/* Outer energy burst */}
                                            <div className="absolute rounded-full" style={{
                                                width: "100%", height: "100%",
                                                background: "radial-gradient(ellipse 60% 80% at 50% 50%, rgba(167,139,250,0) 0%, rgba(167,139,250,0.5) 40%, rgba(232,121,249,0.35) 65%, transparent 100%)",
                                                animation: "distortionBurst 0.42s ease-out forwards",
                                            }} />
                                            {/* Inner core flash */}
                                            <div className="absolute rounded-full" style={{
                                                width: 120, height: 180,
                                                background: "radial-gradient(ellipse at 50% 60%, rgba(255,255,255,0.95) 0%, rgba(167,139,250,0.9) 25%, rgba(232,121,249,0.6) 55%, transparent 80%)",
                                                animation: "distortionCore 0.42s ease-out forwards",
                                                filter: "blur(2px)",
                                            }} />
                                            {/* Energy streaks */}
                                            {[...Array(8)].map((_, i) => (
                                                <div key={i} className="absolute" style={{
                                                    width: 2,
                                                    height: `${40 + i * 12}px`,
                                                    background: "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(167,139,250,0.7) 50%, transparent 100%)",
                                                    top: "50%",
                                                    left: "50%",
                                                    transformOrigin: "50% 0%",
                                                    transform: `translate(-50%, -100%) rotate(${i * 45}deg)`,
                                                    animation: `distortionStreak 0.42s ease-out forwards`,
                                                    animationDelay: `${i * 0.02}s`,
                                                    filter: "blur(0.5px)",
                                                }} />
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Info bottom — flex-shrink-0 garantiza que nunca se corte */}
                                <div className="flex-shrink-0 text-center px-3 pb-3">
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <span className="font-mono px-2 py-0.5 rounded-md"
                                            style={{ fontSize: "var(--font-xs)", background: rar?.bg, color: rar?.color,
                                                border: `1px solid ${rar?.border}`, letterSpacing: ".12em", textTransform: "uppercase" }}>
                                            {selected.rarity}
                                        </span>
                                        <span className="font-mono" style={{ fontSize: "var(--font-xs)", color: "rgba(255,255,255,.3)" }}>
                                            {AFFINITY_ICON[selected.affinities?.[0]]} {selected.affinities?.[0]} · Lv. {selected.level}/60
                                        </span>
                                    </div>
                                    <h2 className="font-black leading-none"
                                        style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "clamp(18px,3vw,28px)",
                                            color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: ".06em",
                                            textShadow: `0 0 30px ${activeForm.color}55`,
                                            transition: "text-shadow .4s" }}>
                                        {activeForm.displayName}
                                    </h2>
                                    <div className="flex items-center justify-center gap-2 mt-1">
                                        <div className="tvn-power font-black"
                                            style={{ color: "var(--accent-gold)", fontFamily: "'Rajdhani',sans-serif", fontWeight: 700, fontSize: "var(--font-md)" }}>
                                            ⚡ {power.toLocaleString()} PWR
                                        </div>
                                        {selected.inParty && (
                                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono"
                                                style={{ fontSize: "var(--font-2xs)", background: "rgba(6,214,160,.1)", border: "1px solid rgba(6,214,160,.25)", color: "var(--accent-green)" }}>
                                                ✓ Party
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })() : (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="font-mono text-sm" style={{ color: "rgba(255,255,255,.2)" }}>Select a myth</p>
                        </div>
                    )}
                </div>

                {/* ── RIGHT: vtabs + panel ── */}
                <div className="tvn-right flex overflow-hidden flex-shrink-0"
                    style={{ width: "clamp(200px,32%,320px)", borderLeft: "1px solid rgba(255,255,255,.05)" }}>
                    {/* Vertical tabs */}
                    <div className="tvn-vtabs-col flex flex-col flex-shrink-0 pt-2 gap-0.5"
                        style={{ width: 44, borderRight: "1px solid rgba(255,255,255,.05)" }}>
                        {VTABS.map(t => (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className="tvn-vtab-btn flex flex-col items-center gap-1 py-3 transition-all"
                                style={{
                                    borderTop: "none", borderBottom: "none", borderLeft: "none",
                                    borderRightWidth: 2, borderRightStyle: "solid",
                                    borderRightColor: tab === t.id ? "#e2e8f0" : "transparent",
                                    background: tab === t.id ? "rgba(226,232,240,.06)" : "transparent",
                                    cursor: "pointer", outline: "none",
                                }}>
                                <span className="tvn-vtab-icon" style={{ fontSize: "var(--font-md)" }}>{t.icon}</span>
                                <span className="tvn-vtab-label font-mono uppercase tracking-wide text-center leading-tight"
                                    style={{ fontSize: 6, color: tab === t.id ? "rgba(226,232,240,.7)" : "rgba(255,255,255,.25)" }}>
                                    {t.label}
                                </span>
                            </button>
                        ))}
                    </div>
                    {/* Panel content */}
                    <div className="flex-1 overflow-hidden">
                        {selected ? (
                            tab === "stats"  ? <StatsPanel myth={selected} /> :
                            tab === "skills" ? <SkillsPanel myth={selected} /> :
                                              <GearPanel myth={selected} />
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="font-mono text-[10px]" style={{ color: "rgba(255,255,255,.2)" }}>Select a myth</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
