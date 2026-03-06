import { prisma } from "./prisma.js";
import { addItem } from "./inventoryService.js";
import type { ItemType, StructureType } from "@prisma/client";

// Tiempo de recolección por nivel de mina (en ms)
const MINE_COOLDOWN_MS: Record<number, number> = {
    1: 4 * 60 * 60 * 1000, // 4 horas
    2: 3 * 60 * 60 * 1000, // 3 horas
    3: 2 * 60 * 60 * 1000, // 2 horas
    4: 90 * 60 * 1000, // 1.5 horas
    5: 60 * 60 * 1000, // 1 hora
};

// Tabla de loot por nivel de mina
const MINE_LOOT: Record<number, { item: ItemType; weight: number }[]> = {
    1: [
        { item: "FIRE_STONE", weight: 25 },
        { item: "WATER_STONE", weight: 25 },
        { item: "THUNDER_STONE", weight: 25 },
        { item: "LEAF_STONE", weight: 25 },
    ],
    2: [
        { item: "FIRE_STONE", weight: 20 },
        { item: "WATER_STONE", weight: 20 },
        { item: "THUNDER_STONE", weight: 20 },
        { item: "LEAF_STONE", weight: 20 },
        { item: "ICE_STONE", weight: 20 },
    ],
    3: [
        { item: "FIRE_STONE", weight: 15 },
        { item: "WATER_STONE", weight: 15 },
        { item: "THUNDER_STONE", weight: 15 },
        { item: "LEAF_STONE", weight: 15 },
        { item: "ICE_STONE", weight: 15 },
        { item: "LINK_CABLE", weight: 25 },
    ],
    4: [
        { item: "FIRE_STONE", weight: 10 },
        { item: "WATER_STONE", weight: 10 },
        { item: "THUNDER_STONE", weight: 10 },
        { item: "LEAF_STONE", weight: 10 },
        { item: "ICE_STONE", weight: 10 },
        { item: "LINK_CABLE", weight: 20 },
        { item: "DRAGON_SCALE", weight: 15 },
        { item: "METAL_COAT", weight: 15 },
    ],
    5: [
        { item: "FIRE_STONE", weight: 8 },
        { item: "WATER_STONE", weight: 8 },
        { item: "THUNDER_STONE", weight: 8 },
        { item: "LEAF_STONE", weight: 8 },
        { item: "ICE_STONE", weight: 8 },
        { item: "LINK_CABLE", weight: 15 },
        { item: "DRAGON_SCALE", weight: 15 },
        { item: "METAL_COAT", weight: 15 },
        { item: "KINGS_ROCK", weight: 8 },
        { item: "UPGRADE", weight: 7 },
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

    // Cantidad de items: 1 base + 1 extra por cada 2 niveles
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
