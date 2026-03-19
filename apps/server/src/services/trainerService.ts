import { prisma } from "./prisma.js";

// XP needed per level (steep curve)
export function xpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.8));
}

export function totalXpForLevel(level: number): number {
    let total = 0;
    for (let i = 1; i < level; i++) total += xpForLevel(i);
    return total;
}

const MEDAL_LEVELS = [10, 15, 20, 25, 30, 35, 40, 50];

export async function getOrCreateTrainer(userId: string) {
    const existing = await prisma.trainerProfile.findUnique({ where: { userId } });
    if (existing) return existing;

    // Create profile + tokens + structures + 2 starter Essences in parallel
    const [trainer] = await Promise.all([
        prisma.trainerProfile.create({
            data: {
                userId,
                essences: 2, // starter Essences for new accounts
            },
        }),
        prisma.combatToken.create({ data: { userId } }),
        prisma.structure.createMany({
            data: [
                { userId, type: "MINE" },
                { userId, type: "FORGE" },
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

    while (level < 100 && xp >= xpForLevel(level)) {
        xp -= xpForLevel(level);
        level++;

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
