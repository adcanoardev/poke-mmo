import { prisma } from "./prisma.js";

const NURSERY_COOLDOWN_MS: Record<number, number> = {
    1: 2 * 60 * 60 * 1000,
    2: 4 * 60 * 60 * 1000,
    3: 8 * 60 * 60 * 1000,
    4: 16 * 60 * 60 * 1000,
    5: 24 * 60 * 60 * 1000,
    6: 36 * 60 * 60 * 1000,
    7: 48 * 60 * 60 * 1000,
    8: 72 * 60 * 60 * 1000,
    9: 72 * 60 * 60 * 1000,
    10: 72 * 60 * 60 * 1000,
};
const MAX_MYTH_LEVEL = 60;

function getCooldown(mythLevel: number): number {
    return NURSERY_COOLDOWN_MS[mythLevel] ?? 72 * 60 * 60 * 1000;
}

function formatMyth(myth: any) {
    return {
        id: myth.id,
        speciesId: myth.speciesId,
        level: myth.level,
        hp: myth.hp,
        maxHp: myth.maxHp,
    };
}

export async function getNurseryStatus(userId: string) {
    const nursery = await prisma.structure.findUniqueOrThrow({
        where: { userId_type: { userId, type: "NURSERY" } },
    });

    const myth = await prisma.creatureInstance.findFirst({
        where: { userId, inNursery: true },
    });

    if (!myth) {
        return { level: nursery.level, myth: null, ready: false, nextCollectMs: null };
    }

    if (myth.level >= MAX_MYTH_LEVEL) {
        return { level: nursery.level, myth: formatMyth(myth), ready: false, nextCollectMs: null, maxLevel: true };
    }

    const cooldownMs = getCooldown(myth.level);
    const elapsed = Date.now() - nursery.lastCollected.getTime();
    const ready = elapsed >= cooldownMs;
    const nextCollectMs = ready ? 0 : cooldownMs - elapsed;

    return {
        level: nursery.level,
        myth: formatMyth(myth),
        ready,
        nextCollectMs,
        currentLevelCooldownMs: cooldownMs,
    };
}

export async function assignToNursery(userId: string, creatureId: string) {
    const myth = await prisma.creatureInstance.findFirst({
        where: { id: creatureId, userId, isInParty: true, inNursery: false },
    });
    if (!myth) throw new Error("Myth no encontrado en tu equipo");
    if (myth.level >= MAX_MYTH_LEVEL) throw new Error("Este Myth ya está al nivel máximo");

    // Liberar el que ya estaba en guardería
    const existing = await prisma.creatureInstance.findFirst({
        where: { userId, inNursery: true },
    });
    if (existing) {
        await prisma.creatureInstance.update({
            where: { id: existing.id },
            data: { inNursery: false },
        });
    }

    await Promise.all([
        prisma.creatureInstance.update({
            where: { id: creatureId },
            data: { inNursery: true },
        }),
        prisma.structure.update({
            where: { userId_type: { userId, type: "NURSERY" } },
            data: { lastCollected: new Date() },
        }),
    ]);

    return { success: true };
}

export async function collectNursery(userId: string) {
    const nursery = await prisma.structure.findUniqueOrThrow({
        where: { userId_type: { userId, type: "NURSERY" } },
    });

    const myth = await prisma.creatureInstance.findFirst({
        where: { userId, inNursery: true },
    });
    if (!myth) throw new Error("No hay ningún Myth en la guardería");
    if (myth.level >= MAX_MYTH_LEVEL) throw new Error("Este Myth ya está al nivel máximo");

    const cooldownMs = getCooldown(myth.level);
    const elapsed = Date.now() - nursery.lastCollected.getTime();
    if (elapsed < cooldownMs) throw new Error("La guardería aún no ha terminado");

    const newLevel = myth.level + 1;
    const newHp = Math.floor(myth.maxHp * 1.08);
    const newAttack = Math.floor(myth.attack * 1.05);
    const newDefense = Math.floor(myth.defense * 1.05);
    const newSpeed = Math.floor(myth.speed * 1.04);

    const updated = await prisma.creatureInstance.update({
        where: { id: myth.id },
        data: {
            level: newLevel,
            hp: newHp,
            maxHp: newHp,
            attack: newAttack,
            defense: newDefense,
            speed: newSpeed,
        },
    });

    // Reiniciar timer para el siguiente tramo
    await prisma.structure.update({
        where: { userId_type: { userId, type: "NURSERY" } },
        data: { lastCollected: new Date() },
    });

    return {
        myth: formatMyth(updated),
        leveledUp: true,
        newLevel,
        nextCooldownMs: newLevel < MAX_MYTH_LEVEL ? getCooldown(newLevel) : null,
    };
}

export async function removeFromNursery(userId: string) {
    const myth = await prisma.creatureInstance.findFirst({
        where: { userId, inNursery: true },
    });
    if (!myth) throw new Error("No hay ningún Myth en la guardería");

    await prisma.creatureInstance.update({
        where: { id: myth.id },
        data: { inNursery: false },
    });

    return { success: true };
}
