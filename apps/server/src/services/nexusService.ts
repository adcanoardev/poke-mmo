// apps/server/src/services/nexusService.ts
import { prisma } from "./prisma.js";
import { getAllCreatures } from "./creatureService.js";
import type { Rarity } from "./creatureService.js";

// ─── Probabilidades base de rareza ────────────────────────────

const BASE_WEIGHTS: Record<Rarity, number> = {
    COMMON:    60.0,
    RARE:      30.0,
    EPIC:       7.0,
    ELITE:      2.5,
    LEGENDARY:  0.5,
    MYTHIC:     0,   // reservado — Corrupted Essence (desactivado)
};

// Multiplicador de tasa para myths boosteados en el banner activo
const BOOSTED_MULTIPLIER = 3;

// ─── Pity thresholds ──────────────────────────────────────────

const PITY_RARE      = 10;
const PITY_EPIC      = 30;
const PITY_ELITE     = 100;
const PITY_LEGENDARY = 150;

// ─── Tipos ────────────────────────────────────────────────────

export interface PullResult {
    speciesId:  string;
    name:       string;
    rarity:     Rarity;
    affinities: string[];
    level:      number;
    maxHp:      number;
    attack:     number;
    defense:    number;
    speed:      number;
    instanceId: string;
    isPityGuarantee: boolean;
}

// ─── Banner activo ────────────────────────────────────────────

export async function getActiveBanner() {
    const now = new Date();
    const banner = await prisma.nexusBanner.findFirst({
        where: {
            isActive: true,
            startsAt: { lte: now },
            endsAt:   { gte: now },
        },
        orderBy: { startsAt: "desc" },
    });
    return banner; // null si no hay ninguno activo
}

// ─── Pity del trainer ────────────────────────────────────────

export async function getTrainerPity(userId: string) {
    const profile = await prisma.trainerProfile.findUnique({
        where: { userId },
        select: {
            essences:         true,
            corruptedEssences: true,
            pityRare:         true,
            pityEpic:         true,
            pityElite:        true,
            pityLegendary:    true,
        },
    });
    if (!profile) throw new Error("Trainer not found");
    return profile;
}

// ─── Pull principal ───────────────────────────────────────────

export async function pullEssences(userId: string, amount: 1 | 5): Promise<PullResult[]> {
    // 1. Verificar que tiene suficientes Essences
    const profile = await prisma.trainerProfile.findUnique({
        where: { userId },
        select: {
            essences:      true,
            pityRare:      true,
            pityEpic:      true,
            pityElite:     true,
            pityLegendary: true,
        },
    });

    if (!profile) throw new Error("Trainer not found");
    if (profile.essences < amount) throw new Error("Not enough Essences");

    // 2. Banner activo (para boosted chance)
    const banner = await getActiveBanner();
    const boostedIds = banner?.boostedMythIds ?? [];

    // 3. Pool completo de myths
    const allCreatures = getAllCreatures();
    if (allCreatures.length === 0) throw new Error("No myths available");

    // 4. Ejecutar pulls uno a uno, actualizando pity en memoria
    let { pityRare, pityEpic, pityElite, pityLegendary } = profile;
    const results: PullResult[] = [];

    for (let i = 0; i < amount; i++) {
        const { rarity, isPityGuarantee, newPityRare, newPityEpic, newPityElite, newPityLegendary } =
            resolvePityAndRoll(pityRare, pityEpic, pityElite, pityLegendary);

        pityRare      = newPityRare;
        pityEpic      = newPityEpic;
        pityElite     = newPityElite;
        pityLegendary = newPityLegendary;

        // Pool de la rareza obtenida, con boosted weight para myths del banner
        const pool = allCreatures.filter((c) => c.rarity === rarity);
        const fallbackPool = pool.length > 0 ? pool : allCreatures.filter((c) => c.rarity === "COMMON");

        const species = weightedPickFromPool(fallbackPool, boostedIds);

        // Stats al nivel 5 (nivel base de invocación)
        const level    = 5;
        const maxHp    = Math.floor(species.baseStats.hp    * (1 + level * 0.1));
        const attack   = Math.floor(species.baseStats.atk   * (1 + level * 0.05));
        const defense  = Math.floor(species.baseStats.def   * (1 + level * 0.05));
        const speed    = Math.floor(species.baseStats.spd   * (1 + level * 0.05));

        // Crear instancia en BD
        const instance = await prisma.creatureInstance.create({
            data: {
                userId,
                speciesId: species.id,
                level,
                xp:        0,
                hp:        maxHp,
                maxHp,
                attack,
                defense,
                speed,
                isInParty: false,
                inNursery: false,
            },
        });

        results.push({
            speciesId:       species.id,
            name:            species.name,
            rarity,
            affinities:      species.affinities,
            level,
            maxHp,
            attack,
            defense,
            speed,
            instanceId:      instance.id,
            isPityGuarantee,
        });
    }

    // 5. Transacción final: consumir Essences + guardar pity actualizado
    await prisma.trainerProfile.update({
        where: { userId },
        data: {
            essences:      { decrement: amount },
            pityRare,
            pityEpic,
            pityElite,
            pityLegendary,
        },
    });

    return results;
}

// ─── Helpers ──────────────────────────────────────────────────

function resolvePityAndRoll(
    pityRare: number,
    pityEpic: number,
    pityElite: number,
    pityLegendary: number,
): {
    rarity: Rarity;
    isPityGuarantee: boolean;
    newPityRare: number;
    newPityEpic: number;
    newPityElite: number;
    newPityLegendary: number;
} {
    let rarity: Rarity;
    let isPityGuarantee = false;

    const nextRare      = pityRare      + 1;
    const nextEpic      = pityEpic      + 1;
    const nextElite     = pityElite     + 1;
    const nextLegendary = pityLegendary + 1;

    // Pity checks — prioridad: LEGENDARY > ELITE > EPIC > RARE
    if (nextLegendary >= PITY_LEGENDARY) {
        rarity = "LEGENDARY";
        isPityGuarantee = true;
    } else if (nextElite >= PITY_ELITE) {
        rarity = "ELITE";
        isPityGuarantee = true;
    } else if (nextEpic >= PITY_EPIC) {
        rarity = "EPIC";
        isPityGuarantee = true;
    } else if (nextRare >= PITY_RARE) {
        rarity = "RARE";
        isPityGuarantee = true;
    } else {
        rarity = rollRarity();
    }

    // Actualizar contadores:
    // - Si la rareza obtenida ES la del contador o está por encima → resetear a 0
    // - Si está por debajo → incrementar
    const newPityRare      = RARITY_RANK[rarity] >= RARITY_RANK["RARE"]      ? 0 : nextRare;
    const newPityEpic      = RARITY_RANK[rarity] >= RARITY_RANK["EPIC"]      ? 0 : nextEpic;
    const newPityElite     = RARITY_RANK[rarity] >= RARITY_RANK["ELITE"]     ? 0 : nextElite;
    const newPityLegendary = RARITY_RANK[rarity] >= RARITY_RANK["LEGENDARY"] ? 0 : nextLegendary;

    return { rarity, isPityGuarantee, newPityRare, newPityEpic, newPityElite, newPityLegendary };
}

const RARITY_RANK: Record<Rarity, number> = {
    COMMON:    0,
    RARE:      1,
    EPIC:      2,
    ELITE:     3,
    LEGENDARY: 4,
    MYTHIC:    5,
};

function isRarityAbove(rarity: Rarity, threshold: Rarity): boolean {
    return RARITY_RANK[rarity] > RARITY_RANK[threshold];
}

function rollRarity(): Rarity {
    const total = Object.values(BASE_WEIGHTS).reduce((a, b) => a + b, 0);
    const roll  = Math.random() * total;
    let cumulative = 0;
    for (const [r, w] of Object.entries(BASE_WEIGHTS) as [Rarity, number][]) {
        cumulative += w;
        if (roll < cumulative) return r;
    }
    return "COMMON";
}

function weightedPickFromPool(
    pool: ReturnType<typeof getAllCreatures>,
    boostedIds: string[],
): ReturnType<typeof getAllCreatures>[number] {
    if (pool.length === 0) throw new Error("Empty pool");

    const weights = pool.map((c) => (boostedIds.includes(c.id) ? BOOSTED_MULTIPLIER : 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalWeight;

    for (let i = 0; i < pool.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return pool[i];
    }

    return pool[pool.length - 1];
}
