import { prisma } from "./prisma.js";
import { addItem } from "./inventoryService.js";
import type { ItemType, StructureType } from "@prisma/client";

const MINE_COOLDOWN_MS: Record<number, number> = {
    1: 4 * 60 * 60 * 1000,
    2: 3 * 60 * 60 * 1000,
    3: 2 * 60 * 60 * 1000,
    4: 90 * 60 * 1000,
    5: 60 * 60 * 1000,
};

const MINE_LOOT: Record<number, { item: ItemType; weight: number }[]> = {
    1: [
        { item: "EMBER_SHARD", weight: 25 },
        { item: "TIDE_SHARD", weight: 25 },
        { item: "VOLT_SHARD", weight: 25 },
        { item: "GROVE_SHARD", weight: 25 },
    ],
    2: [
        { item: "EMBER_SHARD", weight: 20 },
        { item: "TIDE_SHARD", weight: 20 },
        { item: "VOLT_SHARD", weight: 20 },
        { item: "GROVE_SHARD", weight: 20 },
        { item: "FROST_SHARD", weight: 20 },
    ],
    3: [
        { item: "EMBER_SHARD", weight: 15 },
        { item: "TIDE_SHARD", weight: 15 },
        { item: "VOLT_SHARD", weight: 15 },
        { item: "GROVE_SHARD", weight: 15 },
        { item: "FROST_SHARD", weight: 15 },
        { item: "BOND_CRYSTAL", weight: 25 },
    ],
    4: [
        { item: "EMBER_SHARD", weight: 10 },
        { item: "TIDE_SHARD", weight: 10 },
        { item: "VOLT_SHARD", weight: 10 },
        { item: "GROVE_SHARD", weight: 10 },
        { item: "FROST_SHARD", weight: 10 },
        { item: "BOND_CRYSTAL", weight: 20 },
        { item: "ASTRAL_SCALE", weight: 15 },
        { item: "IRON_COAT", weight: 15 },
    ],
    5: [
        { item: "EMBER_SHARD", weight: 8 },
        { item: "TIDE_SHARD", weight: 8 },
        { item: "VOLT_SHARD", weight: 8 },
        { item: "GROVE_SHARD", weight: 8 },
        { item: "FROST_SHARD", weight: 8 },
        { item: "BOND_CRYSTAL", weight: 15 },
        { item: "ASTRAL_SCALE", weight: 15 },
        { item: "IRON_COAT", weight: 15 },
        { item: "SOVEREIGN_STONE", weight: 8 },
        { item: "CIPHER_CORE", weight: 7 },
    ],
};

function rollLoot(level: number): ItemType {
    const table = MINE_LOOT[level] ?? MINE_LOOT[1];
    const total = table.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * total;
    for (const entry of table) {
        roll -= entry.weight;
        if (roll <= 0) return entry.item;
    }
    return table[0].item;
}

export async function getStructure(userId: string, type: StructureType) {
    return prisma.structure.findUniqueOrThrow({
        where: { userId_type: { userId, type } },
    });
}

export async function getMineStatus(userId: string) {
    const mine = await getStructure(userId, "MINE");
    const cooldownMs = MINE_COOLDOWN_MS[mine.level] ?? MINE_COOLDOWN_MS[1];
    const elapsed = Date.now() - mine.lastCollected.getTime();
    const ready = elapsed >= cooldownMs;
    const nextCollectMs = ready ? 0 : cooldownMs - elapsed;
    return { level: mine.level, ready, nextCollectMs };
}

export async function collectMine(userId: string): Promise<{ item: ItemType; quantity: number } | null> {
    const mine = await getStructure(userId, "MINE");
    const cooldownMs = MINE_COOLDOWN_MS[mine.level] ?? MINE_COOLDOWN_MS[1];
    const elapsed = Date.now() - mine.lastCollected.getTime();
    if (elapsed < cooldownMs) return null;

    const quantity = 1 + Math.floor(mine.level / 2);
    const item = rollLoot(mine.level);

    await Promise.all([
        addItem(userId, item, quantity),
        prisma.structure.update({
            where: { userId_type: { userId, type: "MINE" } },
            data: { lastCollected: new Date() },
        }),
    ]);

    return { item, quantity };
}

// ─── FRAGMENT FORGE ──────────────────────────────────────────────────────────

const FORGE_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h fijo nivel 1

export async function getForgeStatus(userId: string) {
    const forge = await getStructure(userId, "FRAGMENT_FORGE");
    const elapsed = Date.now() - forge.lastCollected.getTime();
    const ready = elapsed >= FORGE_COOLDOWN_MS;
    const nextCollectMs = ready ? 0 : FORGE_COOLDOWN_MS - elapsed;
    return { level: forge.level, ready, nextCollectMs };
}

export async function collectForge(userId: string): Promise<{ item: ItemType; quantity: number } | null> {
    const forge = await getStructure(userId, "FRAGMENT_FORGE");
    const elapsed = Date.now() - forge.lastCollected.getTime();
    if (elapsed < FORGE_COOLDOWN_MS) return null;
    const quantity = 1 + Math.floor(forge.level / 2);
    await Promise.all([
        addItem(userId, "FRAGMENT", quantity),
        prisma.structure.update({
            where: { userId_type: { userId, type: "FRAGMENT_FORGE" } },
            data: { lastCollected: new Date() },
        }),
    ]);
    return { item: "FRAGMENT" as ItemType, quantity };
}

// ─── LAB ─────────────────────────────────────────────────────────────────────

const LAB_COOLDOWN_MS = 8 * 60 * 60 * 1000; // 8h fijo nivel 1

export async function getLabStatus(userId: string) {
    const lab = await getStructure(userId, "LAB");
    const elapsed = Date.now() - lab.lastCollected.getTime();
    const ready = elapsed >= LAB_COOLDOWN_MS;
    const nextCollectMs = ready ? 0 : LAB_COOLDOWN_MS - elapsed;
    return { level: lab.level, ready, nextCollectMs };
}

export async function collectLab(userId: string): Promise<{ item: ItemType; quantity: number } | null> {
    const lab = await getStructure(userId, "LAB");
    const elapsed = Date.now() - lab.lastCollected.getTime();
    if (elapsed < LAB_COOLDOWN_MS) return null;
    const quantity = 1 + Math.floor(lab.level / 2);
    await Promise.all([
        addItem(userId, "ELIXIR", quantity),
        prisma.structure.update({
            where: { userId_type: { userId, type: "LAB" } },
            data: { lastCollected: new Date() },
        }),
    ]);
    return { item: "ELIXIR" as ItemType, quantity };
}
