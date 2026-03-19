// apps/server/src/services/mineService.ts

import { prisma } from "./prisma.js";
import { addItem } from "./inventoryService.js";
import {
    addStructureXp,
    progressionInfo,
    upgradeStructure,
    UPGRADE_MATERIAL,
    upgradeMaterialCost,
    xpToNextLevel,
} from "./structureProgression.js";
import type { ItemType, StructureType } from "@prisma/client";

// ─── Mine cooldowns by level ──────────────────────────────────────────────────
const MINE_COOLDOWN_MS: Record<number, number> = {
    1: 4 * 60 * 60 * 1000,
    2: 3 * 60 * 60 * 1000,
    3: 2 * 60 * 60 * 1000,
    4: 90 * 60 * 1000,
    5: 60 * 60 * 1000,
};

// ─── Mine loot table by level ─────────────────────────────────────────────────
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

const DIAMONDS_PER_COLLECT: Record<number, number> = {
    1: 1, 2: 2, 3: 3, 4: 4, 5: 5,
};
const DAILY_DIAMOND_CAP = 15;

const ROCK_FRAGMENTS_PER_COLLECT: Record<number, number> = {
    1: 1, 2: 1, 3: 2, 4: 2, 5: 3,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function isSameDay(a: Date, b: Date): boolean {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

export async function getStructure(userId: string, type: StructureType) {
    return prisma.structure.upsert({
        where: { userId_type: { userId, type } },
        update: {},
        create: {
            userId,
            type,
            level: 1,
            lastCollected: new Date(0),
            structureXp: 0,
            dailyDiamonds: 0,
            lastDiamondReset: new Date(),
        },
    });
}

// ─── MINE — Status ────────────────────────────────────────────────────────────

export async function getMineStatus(userId: string) {
    const mine = await getStructure(userId, "MINE");
    const cooldownMs = MINE_COOLDOWN_MS[mine.level] ?? MINE_COOLDOWN_MS[1];
    const elapsed = Date.now() - mine.lastCollected.getTime();
    const ready = elapsed >= cooldownMs;
    const nextCollectMs = ready ? 0 : cooldownMs - elapsed;

    const now = new Date();
    const dailyDiamonds = isSameDay(mine.lastDiamondReset, now)
        ? mine.dailyDiamonds
        : 0;
    const diamondsFull = dailyDiamonds >= DAILY_DIAMOND_CAP;

    const prog = progressionInfo(mine);

    return {
        level: mine.level,
        ready,
        nextCollectMs,
        dailyDiamonds,
        dailyDiamondCap: DAILY_DIAMOND_CAP,
        diamondsFull,
        structureXp: prog.structureXp,
        xpToNextLevel: prog.xpToNextLevel,
        upgradeRequirement: {
            item: UPGRADE_MATERIAL["MINE"],
            quantity: upgradeMaterialCost(mine.level),
        },
        canUpgradeXp: prog.canUpgradeXp,
    };
}

// ─── MINE — Collect ───────────────────────────────────────────────────────────

export async function collectMine(userId: string): Promise<{
    lootItem: ItemType;
    lootQuantity: number;
    diamondsGained: number;
    rockFragmentsGained: number;
    xpGained: number;
    diamondsFull: boolean;
} | null> {
    const mine = await getStructure(userId, "MINE");
    const cooldownMs = MINE_COOLDOWN_MS[mine.level] ?? MINE_COOLDOWN_MS[1];
    const elapsed = Date.now() - mine.lastCollected.getTime();
    if (elapsed < cooldownMs) return null;

    const now = new Date();

    const currentDailyDiamonds = isSameDay(mine.lastDiamondReset, now)
        ? mine.dailyDiamonds
        : 0;

    const diamondsToGive = DIAMONDS_PER_COLLECT[mine.level] ?? 1;
    const diamondsCanGive = Math.max(
        0,
        Math.min(diamondsToGive, DAILY_DIAMOND_CAP - currentDailyDiamonds)
    );
    const newDailyDiamonds = currentDailyDiamonds + diamondsCanGive;
    const diamondsFull = newDailyDiamonds >= DAILY_DIAMOND_CAP;

    const rockFragments = ROCK_FRAGMENTS_PER_COLLECT[mine.level] ?? 1;
    const lootQuantity = 1 + Math.floor(mine.level / 2);
    const lootItem = rollLoot(mine.level);
    const XP_PER_COLLECT = 100;

    const updates: Promise<any>[] = [
        addItem(userId, lootItem, lootQuantity),
        addItem(userId, "ROCK_FRAGMENT", rockFragments),
        prisma.structure.update({
            where: { userId_type: { userId, type: "MINE" } },
            data: {
                lastCollected: now,
                structureXp: { increment: XP_PER_COLLECT },
                dailyDiamonds: newDailyDiamonds,
                lastDiamondReset: isSameDay(mine.lastDiamondReset, now) ? undefined : now,
            },
        }),
    ];

    if (diamondsCanGive > 0) {
        updates.push(addItem(userId, "BLUE_DIAMOND", diamondsCanGive));
    }

    await Promise.all(updates);

    return { lootItem, lootQuantity, diamondsGained: diamondsCanGive, rockFragmentsGained: rockFragments, xpGained: XP_PER_COLLECT, diamondsFull };
}

// ─── MINE — Upgrade ───────────────────────────────────────────────────────────

export async function upgradeMine(userId: string) {
    return upgradeStructure(userId, "MINE");
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORGE
// ═══════════════════════════════════════════════════════════════════════════════

const FORGE_COOLDOWN_MS: Record<number, number> = {
    1: 6 * 60 * 60 * 1000,
    2: 5 * 60 * 60 * 1000,
    3: 4 * 60 * 60 * 1000,
    4: 3 * 60 * 60 * 1000,
    5: 2 * 60 * 60 * 1000,
};

// Flame Cores (Nursery upgrade material) produced per collect
const FLAME_CORES_PER_COLLECT: Record<number, number> = {
    1: 1, 2: 1, 3: 2, 4: 2, 5: 3,
};

// Arcane Gears (Forge upgrade material) produced per collect
const ARCANE_GEARS_PER_COLLECT: Record<number, number> = {
    1: 1, 2: 1, 3: 2, 4: 2, 5: 3,
};

export async function getForgeStatus(userId: string) {
    const forge = await getStructure(userId, "FORGE");
    const cooldownMs = FORGE_COOLDOWN_MS[forge.level] ?? FORGE_COOLDOWN_MS[1];
    const elapsed = Date.now() - forge.lastCollected.getTime();
    const ready = elapsed >= cooldownMs;
    const nextCollectMs = ready ? 0 : cooldownMs - elapsed;
    const prog = progressionInfo(forge);

    return {
        level: forge.level,
        ready,
        nextCollectMs,
        structureXp: prog.structureXp,
        xpToNextLevel: xpToNextLevel(forge.level),
        upgradeRequirement: {
            item: UPGRADE_MATERIAL["FORGE"],
            quantity: upgradeMaterialCost(forge.level),
        },
        canUpgradeXp: prog.canUpgradeXp,
    };
}

export async function collectForge(userId: string): Promise<{
    flameCoresGained: number;
    arcaneGearsGained: number;
    xpGained: number;
} | null> {
    const forge = await getStructure(userId, "FORGE");
    const cooldownMs = FORGE_COOLDOWN_MS[forge.level] ?? FORGE_COOLDOWN_MS[1];
    const elapsed = Date.now() - forge.lastCollected.getTime();
    if (elapsed < cooldownMs) return null;

    const flameCoresGained  = FLAME_CORES_PER_COLLECT[forge.level] ?? 1;
    const arcaneGearsGained = ARCANE_GEARS_PER_COLLECT[forge.level] ?? 1;
    const XP_PER_COLLECT = 100;

    await Promise.all([
        addItem(userId, "FLAME_CORE", flameCoresGained),
        addItem(userId, "ARCANE_GEAR", arcaneGearsGained),
        prisma.structure.update({
            where: { userId_type: { userId, type: "FORGE" } },
            data: {
                lastCollected: new Date(),
                structureXp: { increment: XP_PER_COLLECT },
            },
        }),
    ]);

    return { flameCoresGained, arcaneGearsGained, xpGained: XP_PER_COLLECT };
}

export async function upgradeForge(userId: string) {
    return upgradeStructure(userId, "FORGE");
}

// ═══════════════════════════════════════════════════════════════════════════════
// LAB
// ═══════════════════════════════════════════════════════════════════════════════

const LAB_COOLDOWN_MS: Record<number, number> = {
    1: 8 * 60 * 60 * 1000,
    2: 7 * 60 * 60 * 1000,
    3: 6 * 60 * 60 * 1000,
    4: 5 * 60 * 60 * 1000,
    5: 4 * 60 * 60 * 1000,
};

const LAB_ARCANE_GEARS_PER_COLLECT: Record<number, number> = {
    1: 1, 2: 1, 3: 2, 4: 2, 5: 3,
};

export async function getLabStatus(userId: string) {
    const lab = await getStructure(userId, "LAB");
    const cooldownMs = LAB_COOLDOWN_MS[lab.level] ?? LAB_COOLDOWN_MS[1];
    const elapsed = Date.now() - lab.lastCollected.getTime();
    const ready = elapsed >= cooldownMs;
    const nextCollectMs = ready ? 0 : cooldownMs - elapsed;
    const prog = progressionInfo(lab);

    return {
        level: lab.level,
        ready,
        nextCollectMs,
        structureXp: prog.structureXp,
        xpToNextLevel: xpToNextLevel(lab.level),
        upgradeRequirement: {
            item: UPGRADE_MATERIAL["LAB"],
            quantity: upgradeMaterialCost(lab.level),
        },
        canUpgradeXp: prog.canUpgradeXp,
    };
}

export async function collectLab(userId: string): Promise<{
    elixirsGained: number;
    arcaneGearsGained: number;
    xpGained: number;
} | null> {
    const lab = await getStructure(userId, "LAB");
    const cooldownMs = LAB_COOLDOWN_MS[lab.level] ?? LAB_COOLDOWN_MS[1];
    const elapsed = Date.now() - lab.lastCollected.getTime();
    if (elapsed < cooldownMs) return null;

    const elixirsGained     = 1 + Math.floor(lab.level / 2);
    const arcaneGearsGained = LAB_ARCANE_GEARS_PER_COLLECT[lab.level] ?? 1;
    const XP_PER_COLLECT = 100;

    await Promise.all([
        addItem(userId, "ELIXIR", elixirsGained),
        addItem(userId, "ARCANE_GEAR", arcaneGearsGained),
        prisma.structure.update({
            where: { userId_type: { userId, type: "LAB" } },
            data: {
                lastCollected: new Date(),
                structureXp: { increment: XP_PER_COLLECT },
            },
        }),
    ]);

    return { elixirsGained, arcaneGearsGained, xpGained: XP_PER_COLLECT };
}

export async function upgradeLab(userId: string) {
    return upgradeStructure(userId, "LAB");
}
