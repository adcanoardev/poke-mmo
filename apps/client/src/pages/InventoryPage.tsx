// apps/client/src/pages/InventoryPage.tsx
import { useState, useEffect } from "react";
import { api } from "../lib/api";
import PageShell from "../components/PageShell";
import PageTopbar from "../components/PageTopbar";

const ITEM_ICONS: Record<string, string> = {
    FRAGMENT:"🔴", SHARD:"🔵", CRYSTAL:"⚫", RUNE:"🟣",
    ELIXIR:"🧪", MEGA_ELIXIR:"🧪", GRAND_ELIXIR:"🧪",
    SPARK:"💊", GRAND_SPARK:"✨",
    EMBER_SHARD:"🔥", TIDE_SHARD:"💧", VOLT_SHARD:"⚡", GROVE_SHARD:"🌿", FROST_SHARD:"❄️",
    BOND_CRYSTAL:"🔗", ASTRAL_SCALE:"🐉", IRON_COAT:"⚙️", SOVEREIGN_STONE:"👑", CIPHER_CORE:"⬆️",
};

const ITEM_COLORS: Record<string, string> = {
    FRAGMENT:"#e63946", SHARD:"#4cc9f0", CRYSTAL:"#adb5bd", RUNE:"#7b2fff",
    ELIXIR:"#06d6a0", MEGA_ELIXIR:"#06d6a0", GRAND_ELIXIR:"#06d6a0",
    SPARK:"#ffd60a", GRAND_SPARK:"#ffd60a",
    EMBER_SHARD:"#ff6b35", TIDE_SHARD:"#4cc9f0", VOLT_SHARD:"#ffd60a",
    GROVE_SHARD:"#06d6a0", FROST_SHARD:"#a8dadc",
    BOND_CRYSTAL:"#adb5bd", ASTRAL_SCALE:"#7b2fff",
    IRON_COAT:"#adb5bd", SOVEREIGN_STONE:"#ffd60a", CIPHER_CORE:"#e040fb",
};

const ITEM_NAMES: Record<string, string> = {
    FRAGMENT:"Fragment", SHARD:"Shard", CRYSTAL:"Crystal", RUNE:"Rune",
    ELIXIR:"Elixir", MEGA_ELIXIR:"Mega Elixir", GRAND_ELIXIR:"Grand Elixir",
    SPARK:"Spark", GRAND_SPARK:"Grand Spark",
    EMBER_SHARD:"Ember Shard", TIDE_SHARD:"Tide Shard", VOLT_SHARD:"Volt Shard",
    GROVE_SHARD:"Grove Shard", FROST_SHARD:"Frost Shard",
    BOND_CRYSTAL:"Bond Crystal", ASTRAL_SCALE:"Astral Scale",
    IRON_COAT:"Iron Coat", SOVEREIGN_STONE:"Sovereign Stone", CIPHER_CORE:"Cipher Core",
};

const CATEGORIES: Record<string, string[]> = {
    Fragments: ["FRAGMENT", "SHARD", "CRYSTAL", "RUNE"],
    Elixirs:   ["ELIXIR", "MEGA_ELIXIR", "GRAND_ELIXIR", "SPARK", "GRAND_SPARK"],
    Shards:    ["EMBER_SHARD", "TIDE_SHARD", "VOLT_SHARD", "GROVE_SHARD", "FROST_SHARD"],
    Items:     ["BOND_CRYSTAL", "ASTRAL_SCALE", "IRON_COAT", "SOVEREIGN_STONE", "CIPHER_CORE"],
};

export default function InventoryPage() {
    const [inventory, setInventory] = useState<any[]>([]);
    const [filter, setFilter] = useState("All");

    useEffect(() => { api.inventory().then(setInventory); }, []);

    const filtered = filter === "All" ? inventory : inventory.filter(i => CATEGORIES[filter]?.includes(i.item));

    return (
        <PageShell>
            <PageTopbar title="Inventory" />

            {/* Filter bar */}
            <div className="relative flex-shrink-0 flex items-center gap-2 px-4 py-2.5 border-b" style={{ borderColor:"rgba(255,255,255,0.06)" }}>
                {["All", ...Object.keys(CATEGORIES)].map(cat => (
                    <button key={cat} onClick={() => setFilter(cat)}
                        className="px-3 py-1 rounded-lg text-xs font-bold tracking-widest uppercase transition-all"
                        style={{
                            background: filter === cat ? "linear-gradient(135deg,#4cc9f0,#7b2fff)" : "rgba(255,255,255,0.04)",
                            color: filter === cat ? "#070b14" : "rgba(255,255,255,0.5)",
                            border: filter === cat ? "none" : "1px solid rgba(255,255,255,0.1)",
                            fontFamily:"'Rajdhani',sans-serif",
                        }}>
                        {cat}
                    </button>
                ))}
            </div>

            {/* Grid */}
            <div className="relative flex-1 p-4 overflow-y-auto" style={{ scrollbarWidth:"none" }}>
                {filtered.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                        <div style={{ fontSize:48 }}>📦</div>
                        <p className="font-bold tracking-widest uppercase text-lg" style={{ fontFamily:"'Rajdhani',sans-serif", color:"var(--text-secondary)" }}>
                            {filter === "All" ? "Inventory empty" : `No ${filter.toLowerCase()}`}
                        </p>
                        <p style={{ fontSize: "var(--font-base)", color:"var(--text-muted)" }}>
                            Battle and collect from the mine to get items
                        </p>
                    </div>
                ) : (
                    <div className="grid gap-3" style={{ gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))" }}>
                        {filtered.map((item: any) => {
                            const icon  = ITEM_ICONS[item.item]  ?? "📦";
                            const color = ITEM_COLORS[item.item] ?? "#e2e8f0";
                            const name  = ITEM_NAMES[item.item]  ?? item.item.replace(/_/g," ");
                            return (
                                <div key={item.item} className="group relative rounded-2xl p-4 flex flex-col justify-between aspect-square transition-all hover:scale-105"
                                    style={{ background:"rgba(255,255,255,0.03)", border:`1px solid rgba(255,255,255,0.07)` }}>
                                    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                                        style={{ background:`radial-gradient(ellipse at top left,${color}18,transparent 65%)` }} />
                                    <span style={{ fontSize:28 }}>{icon}</span>
                                    <div>
                                        <div className="font-black text-xl" style={{ fontFamily:"'Rajdhani',sans-serif", color }}>{item.quantity}</div>
                                        <div className="text-xs font-mono truncate" style={{ color:"var(--text-secondary)" }}>{name}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </PageShell>
    );
}
