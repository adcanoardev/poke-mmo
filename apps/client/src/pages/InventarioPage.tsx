import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import TrainerSidebar from "../components/TrainerSidebar";
import { api } from "../lib/api";

const ITEM_ICONS: Record<string, string> = {
    FRAGMENT: "🔴",
    SHARD: "🔵",
    CRYSTAL: "⚫",
    RUNE: "🟣",
    ELIXIR: "🧪",
    MEGA_ELIXIR: "🧪",
    GRAND_ELIXIR: "🧪",
    SPARK: "💊",
    GRAND_SPARK: "✨",
    EMBER_SHARD: "🔥",
    TIDE_SHARD: "💧",
    VOLT_SHARD: "⚡",
    GROVE_SHARD: "🌿",
    FROST_SHARD: "❄️",
    BOND_CRYSTAL: "🔗",
    ASTRAL_SCALE: "🐉",
    IRON_COAT: "⚙️",
    SOVEREIGN_STONE: "👑",
    CIPHER_CORE: "⬆️",
};

const ITEM_COLORS: Record<string, string> = {
    FRAGMENT: "#e63946",
    SHARD: "#4cc9f0",
    CRYSTAL: "#adb5bd",
    RUNE: "#7b2fff",
    ELIXIR: "#06d6a0",
    MEGA_ELIXIR: "#06d6a0",
    GRAND_ELIXIR: "#06d6a0",
    SPARK: "#ffd60a",
    GRAND_SPARK: "#ffd60a",
    EMBER_SHARD: "#ff6b35",
    TIDE_SHARD: "#4cc9f0",
    VOLT_SHARD: "#ffd60a",
    GROVE_SHARD: "#06d6a0",
    FROST_SHARD: "#a8dadc",
    BOND_CRYSTAL: "#adb5bd",
    ASTRAL_SCALE: "#7b2fff",
    IRON_COAT: "#adb5bd",
    SOVEREIGN_STONE: "#ffd60a",
    CIPHER_CORE: "#e040fb",
};

const ITEM_NAMES: Record<string, string> = {
    FRAGMENT: "Fragmento",
    SHARD: "Astilla",
    CRYSTAL: "Cristal",
    RUNE: "Runa",
    ELIXIR: "Elixir",
    MEGA_ELIXIR: "Mega Elixir",
    GRAND_ELIXIR: "Gran Elixir",
    SPARK: "Chispa",
    GRAND_SPARK: "Gran Chispa",
    EMBER_SHARD: "Shard Ember",
    TIDE_SHARD: "Shard Tide",
    VOLT_SHARD: "Shard Volt",
    GROVE_SHARD: "Shard Grove",
    FROST_SHARD: "Shard Frost",
    BOND_CRYSTAL: "Cristal Vínculo",
    ASTRAL_SCALE: "Escama Astral",
    IRON_COAT: "Capa de Hierro",
    SOVEREIGN_STONE: "Piedra Soberana",
    CIPHER_CORE: "Núcleo Cifrado",
};

const CATEGORIES: Record<string, string[]> = {
    Fragmentos: ["FRAGMENT", "SHARD", "CRYSTAL", "RUNE"],
    Elixires: ["ELIXIR", "MEGA_ELIXIR", "GRAND_ELIXIR", "SPARK", "GRAND_SPARK"],
    Shards: ["EMBER_SHARD", "TIDE_SHARD", "VOLT_SHARD", "GROVE_SHARD", "FROST_SHARD"],
    Objetos: ["BOND_CRYSTAL", "ASTRAL_SCALE", "IRON_COAT", "SOVEREIGN_STONE", "CIPHER_CORE"],
};

export default function InventarioPage() {
    const [inventory, setInventory] = useState<any[]>([]);
    const [filter, setFilter] = useState("Todos");

    useEffect(() => {
        api.inventory().then(setInventory);
    }, []);

    const filtered = filter === "Todos" ? inventory : inventory.filter((i) => CATEGORIES[filter]?.includes(i.item));

    return (
        <Layout sidebar={<TrainerSidebar />}>
            <div className="flex-shrink-0 px-6 py-4 border-b border-border flex items-center justify-between">
                <h1 className="font-display font-bold text-2xl tracking-widest">
                    🎒 <span className="text-blue">Inventario</span>
                </h1>
                <div className="flex gap-2">
                    {["Todos", ...Object.keys(CATEGORIES)].map((cat) => (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            className={`px-3 py-1 rounded-lg font-display font-bold text-xs tracking-widest uppercase transition-all
                                ${filter === cat ? "text-bg" : "border border-border text-muted hover:border-blue hover:text-blue"}`}
                            style={filter === cat ? { background: "linear-gradient(135deg,#4cc9f0,#7b2fff)" } : {}}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 p-6 overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted">
                        <div className="text-5xl mb-4">📦</div>
                        <div className="font-display font-bold text-xl tracking-widest">
                            {filter === "Todos" ? "Inventario vacío" : `Sin ${filter.toLowerCase()}`}
                        </div>
                        <div className="text-sm mt-2">Combate y recoge la mina para conseguir objetos</div>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-3 h-full content-start overflow-y-auto">
                        {filtered.map((item: any) => {
                            const icon = ITEM_ICONS[item.item] ?? "📦";
                            const color = ITEM_COLORS[item.item] ?? "#F7FFFB";
                            const name = ITEM_NAMES[item.item] ?? item.item.replace(/_/g, " ");
                            return (
                                <div
                                    key={item.item}
                                    className="bg-card border border-border rounded-2xl p-4 hover:border-blue/40 transition-all relative overflow-hidden group aspect-square flex flex-col justify-between"
                                >
                                    <div
                                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                        style={{
                                            background: `radial-gradient(ellipse at top left, ${color}15, transparent 60%)`,
                                        }}
                                    />
                                    <span className="text-3xl relative">{icon}</span>
                                    <div className="relative">
                                        <div className="font-display font-bold text-lg" style={{ color }}>
                                            {item.quantity}
                                        </div>
                                        <div className="font-display text-xs text-muted truncate">{name}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Layout>
    );
}
