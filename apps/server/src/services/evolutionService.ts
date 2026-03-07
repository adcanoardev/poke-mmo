import { prisma } from "./prisma.js";
import { getCreature } from "./creatureService.js";
import { hasItem, removeItem } from "./inventoryService.js";
import type { ItemType } from "@prisma/client";

// ── Evolución por nivel ───────────────────────────────────────
// Lee la evolución directamente del creatures.json, sin tablas hardcodeadas

export async function checkLevelEvolution(creatureInstanceId: string) {
    const instance = await prisma.creatureInstance.findUniqueOrThrow({
        where: { id: creatureInstanceId },
    });

    const species = getCreature(instance.speciesId);
    if (!species.evolution) return null;
    if (species.evolution.method !== "LEVEL") return null;

    const requiredLevel = Number(species.evolution.value);
    if (instance.level < requiredLevel) return null;

    // Verificar que la forma evolucionada existe
    const nextSpecies = getCreature(species.evolution.evolvesTo);

    await prisma.creatureInstance.update({
        where: { id: creatureInstanceId },
        data: { speciesId: nextSpecies.id },
    });

    return {
        evolved: true,
        from: species.id,
        fromName: species.name,
        to: nextSpecies.id,
        toName: nextSpecies.name,
        art: nextSpecies.art,
    };
}

// ── Evolución por objeto ──────────────────────────────────────

export async function getAvailableItemEvolutions(userId: string, creatureInstanceId: string) {
    const instance = await prisma.creatureInstance.findUniqueOrThrow({
        where: { id: creatureInstanceId, userId },
    });

    const species = getCreature(instance.speciesId);
    if (!species.evolution || species.evolution.method !== "ITEM") {
        return { speciesId: species.id, available: [] };
    }

    const item = species.evolution.value as ItemType;
    const hasIt = await hasItem(userId, item);

    return {
        speciesId: species.id,
        available: hasIt ? [{ evolvesTo: species.evolution.evolvesTo, item }] : [],
    };
}

export async function evolveWithItem(userId: string, creatureInstanceId: string, item: ItemType) {
    const instance = await prisma.creatureInstance.findUniqueOrThrow({
        where: { id: creatureInstanceId, userId },
    });

    const species = getCreature(instance.speciesId);
    if (!species.evolution || species.evolution.method !== "ITEM") {
        return { error: "Este Myth no evoluciona con objetos" };
    }
    if (species.evolution.value !== item) {
        return { error: "Objeto incorrecto para esta evolución" };
    }

    const hasIt = await hasItem(userId, item);
    if (!hasIt) return { error: "No tienes ese objeto en el inventario" };

    const nextSpecies = getCreature(species.evolution.evolvesTo);

    await removeItem(userId, item, 1);
    await prisma.creatureInstance.update({
        where: { id: creatureInstanceId },
        data: { speciesId: nextSpecies.id },
    });

    return {
        evolved: true,
        from: species.id,
        fromName: species.name,
        to: nextSpecies.id,
        toName: nextSpecies.name,
        art: nextSpecies.art,
    };
}

// ── Evolución por prestigio ───────────────────────────────────

export async function evolveWithPrestige(userId: string, creatureInstanceId: string) {
    const instance = await prisma.creatureInstance.findUniqueOrThrow({
        where: { id: creatureInstanceId, userId },
    });

    const species = getCreature(instance.speciesId);
    if (!species.evolution || species.evolution.method !== "PRESTIGE") {
        return { error: "Este Myth no evoluciona por prestigio" };
    }

    const trainer = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });
    const requiredPrestige = Number(species.evolution.value);
    if (trainer.prestige < requiredPrestige) {
        return { error: `Necesitas ${requiredPrestige} de prestigio` };
    }

    const nextSpecies = getCreature(species.evolution.evolvesTo);

    await prisma.creatureInstance.update({
        where: { id: creatureInstanceId },
        data: { speciesId: nextSpecies.id },
    });

    return {
        evolved: true,
        from: species.id,
        fromName: species.name,
        to: nextSpecies.id,
        toName: nextSpecies.name,
        art: nextSpecies.art,
    };
}
