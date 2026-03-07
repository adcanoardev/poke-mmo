import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export type Affinity = "EMBER" | "TIDE" | "GROVE" | "VOLT" | "STONE" | "FROST" | "VENOM" | "ASTRAL" | "IRON" | "SHADE";
export type Rarity = "COMMON" | "RARE" | "ELITE" | "MYTHIC";

export interface Creature {
    id: string;
    slug: string;
    name: string;
    affinities: Affinity[];
    rarity: Rarity;
    description: string;
    baseStats: { hp: number; atk: number; def: number; spd: number };
    catchRate: number;
    evolution?: { evolvesTo: string; method: "LEVEL" | "ITEM" | "PRESTIGE"; value: number | string };
    art: { portrait: string; front: string; back: string };
}

let _cache: Creature[] | null = null;

function load(): Creature[] {
    if (_cache) return _cache;
    const path = join(__dirname, "../data/creatures.json");
    _cache = JSON.parse(readFileSync(path, "utf-8")) as Creature[];
    return _cache;
}

export function getAllCreatures(): Creature[] {
    return load();
}
export function getStarterCreatures(): Creature[] {
    return load().filter((c) => ["001", "004", "007"].includes(c.id));
}
export function isValidStarter(id: string): boolean {
    return ["001", "004", "007"].includes(id);
}

export function getCreature(idOrSlug: string): Creature {
    const found = load().find((c) => c.id === idOrSlug || c.slug === idOrSlug);
    if (!found) throw new Error(`Myth not found: ${idOrSlug}`);
    return found;
}

export const AFFINITY_EMOJI: Record<Affinity, string> = {
    EMBER: "🔥",
    TIDE: "💧",
    GROVE: "🌿",
    VOLT: "⚡",
    STONE: "🪨",
    FROST: "❄️",
    VENOM: "☠️",
    ASTRAL: "✨",
    IRON: "⚙️",
    SHADE: "🌑",
};

export const AFFINITY_COLOR: Record<Affinity, string> = {
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
};
