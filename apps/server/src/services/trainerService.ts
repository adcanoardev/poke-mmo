import { prisma } from "./prisma.js";

// XP necesaria para cada nivel (curva pronunciada)
export function xpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.8));
}

export function totalXpForLevel(level: number): number {
    let total = 0;
    for (let i = 1; i < level; i++) total += xpForLevel(i);
    return total;
}

// Medalla desbloqueada según nivel
const MEDAL_LEVELS = [10, 15, 20, 25, 30, 35, 40, 50];

export async function getOrCreateTrainer(userId: string) {
    const existing = await prisma.trainerProfile.findUnique({ where: { userId } });
    if (existing) return existing;

    // Crear perfil + fichas + estructuras + inventario vacío en paralelo
    const [trainer] = await Promise.all([
        prisma.trainerProfile.create({ data: { userId } }),
        prisma.combatToken.create({ data: { userId } }),
        prisma.structure.createMany({
            data: [
                { userId, type: "MINE" },
                { userId, type: "FRAGMENT_FORGE" },
                { userId, type: "LAB" },
                { userId, type: "NURSERY" },
            ],
        }),
    ]);
    return trainer;
}

export async function addXp(userId: string, amount: number) {
    const trainer = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });
    if (trainer.level >= 100) return trainer;

    let { xp, level, medals } = trainer;
    xp += amount;

    // Subir niveles mientras haya XP suficiente
    while (level < 100 && xp >= xpForLevel(level)) {
        xp -= xpForLevel(level);
        level++;

        // Desbloquear medalla si toca
        const medalIndex = MEDAL_LEVELS.indexOf(level);
        if (medalIndex !== -1 && !medals.includes(medalIndex)) {
            medals = [...medals, medalIndex];
        }
    }

    return prisma.trainerProfile.update({
        where: { userId },
        data: { xp, level, medals },
    });
}

export async function addPrestige(userId: string, amount: number) {
    const trainer = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });
    const newPrestige = Math.max(0, trainer.prestige + amount);
    return prisma.trainerProfile.update({
        where: { userId },
        data: { prestige: newPrestige },
    });
}
