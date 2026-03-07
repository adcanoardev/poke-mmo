import { prisma } from "./prisma.js";
import { addXp } from "./trainerService.js";
import { useNpcToken } from "./tokenService.js";
import { getCreature } from "./creatureService.js";

// ── 8 Guardianes de Mythara ───────────────────────────────────

export const SANCTUMS = [
    {
        id: 0,
        name: "Sanctum de Piedra",
        guardian: "Kael",
        emblem: "Emblema de Roca",
        requiredLevel: 10,
        myths: [
            { speciesId: "011", level: 12 },
            { speciesId: "011", level: 14 },
        ],
        xpReward: 500,
        coinsReward: 300,
    },
    {
        id: 1,
        name: "Sanctum de Marea",
        guardian: "Lyra",
        emblem: "Emblema de Marea",
        requiredLevel: 15,
        myths: [
            { speciesId: "004", level: 18 },
            { speciesId: "005", level: 21 },
        ],
        xpReward: 800,
        coinsReward: 500,
    },
    {
        id: 2,
        name: "Sanctum de Tormenta",
        guardian: "Zeph",
        emblem: "Emblema de Volt",
        requiredLevel: 20,
        myths: [
            { speciesId: "010", level: 21 },
            { speciesId: "010", level: 24 },
            { speciesId: "010", level: 26 },
        ],
        xpReward: 1200,
        coinsReward: 700,
    },
    {
        id: 3,
        name: "Sanctum del Bosque",
        guardian: "Mira",
        emblem: "Emblema de Vida",
        requiredLevel: 25,
        myths: [
            { speciesId: "007", level: 24 },
            { speciesId: "008", level: 27 },
            { speciesId: "008", level: 29 },
        ],
        xpReward: 1800,
        coinsReward: 1000,
    },
    {
        id: 4,
        name: "Sanctum de Veneno",
        guardian: "Voss",
        emblem: "Emblema de Corrupción",
        requiredLevel: 30,
        myths: [
            { speciesId: "012", level: 32 },
            { speciesId: "012", level: 35 },
            { speciesId: "012", level: 37 },
        ],
        xpReward: 2500,
        coinsReward: 1400,
    },
    {
        id: 5,
        name: "Sanctum Astral",
        guardian: "Sable",
        emblem: "Emblema Cósmico",
        requiredLevel: 35,
        myths: [
            { speciesId: "030", level: 38 },
            { speciesId: "030", level: 40 },
            { speciesId: "030", level: 43 },
        ],
        xpReward: 3500,
        coinsReward: 2000,
    },
    {
        id: 6,
        name: "Sanctum de Brasas",
        guardian: "Ryn",
        emblem: "Emblema de Llama",
        requiredLevel: 40,
        myths: [
            { speciesId: "001", level: 42 },
            { speciesId: "002", level: 44 },
            { speciesId: "002", level: 47 },
        ],
        xpReward: 5000,
        coinsReward: 3000,
    },
    {
        id: 7,
        name: "Sanctum de Sombra",
        guardian: "Nox",
        emblem: "Emblema Oscuro",
        requiredLevel: 50,
        myths: [
            { speciesId: "030", level: 50 },
            { speciesId: "030", level: 55 },
            { speciesId: "003", level: 60 },
        ],
        xpReward: 8000,
        coinsReward: 5000,
    },
];

// ── Motor de combate de Sanctum ───────────────────────────────

function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calcStat(base: number, level: number): number {
    return Math.floor((2 * base * level) / 100) + level + 10;
}

interface SimStats {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
    level: number;
}

function simulateSanctumBattle(player: SimStats, enemies: SimStats[]) {
    let playerHp = player.hp;
    let turnsTotal = 0;

    for (const enemy of enemies) {
        let enemyHp = enemy.hp;
        const playerFirst = player.speed >= enemy.speed;
        let turn = 0;

        while (playerHp > 0 && enemyHp > 0 && turn < 50) {
            turn++;
            turnsTotal++;
            const order = playerFirst ? ["player", "enemy"] : ["enemy", "player"];

            for (const attacker of order) {
                if (playerHp <= 0 || enemyHp <= 0) break;
                const crit = Math.random() < 0.0625 ? 1.5 : 1;
                if (attacker === "player") {
                    const dmg = Math.max(
                        1,
                        Math.floor(((((2 * player.level) / 5 + 2) * player.attack) / enemy.defense / 50 + 2) * crit) +
                            randInt(-2, 2),
                    );
                    enemyHp = Math.max(0, enemyHp - dmg);
                } else {
                    const dmg = Math.max(
                        1,
                        Math.floor(((((2 * enemy.level) / 5 + 2) * enemy.attack) / player.defense / 50 + 2) * crit) +
                            randInt(-2, 2),
                    );
                    playerHp = Math.max(0, playerHp - dmg);
                }
            }
        }

        if (playerHp <= 0) return { won: false, turnsTotal };
        // Recupera 30% HP entre combates
        playerHp = Math.min(player.hp, playerHp + Math.floor(player.hp * 0.3));
    }

    return { won: playerHp > 0, turnsTotal };
}

// ── Función principal ─────────────────────────────────────────

export async function challengeSanctum(userId: string, sanctumId: number) {
    const sanctum = SANCTUMS[sanctumId];
    if (!sanctum) return { error: "Sanctum no válido" };

    const hasToken = await useNpcToken(userId);
    if (!hasToken) return { error: "No NPC tokens available" };

    const trainer = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });

    if (trainer.level < sanctum.requiredLevel) {
        return { error: `Nivel insuficiente. Necesitas nivel ${sanctum.requiredLevel} (tienes ${trainer.level})` };
    }

    if (trainer.medals.includes(sanctumId)) {
        return { error: "Ya tienes este emblema" };
    }

    if (sanctumId > 0 && !trainer.medals.includes(sanctumId - 1)) {
        return { error: `Debes conseguir el emblema de ${SANCTUMS[sanctumId - 1].name} primero` };
    }

    const playerMyth = await prisma.creatureInstance.findFirst({
        where: { userId, isInParty: true },
        orderBy: { slot: "asc" },
    });
    if (!playerMyth) return { error: "No tienes ningún Myth en el equipo" };

    const playerStats: SimStats = {
        hp: playerMyth.maxHp,
        attack: playerMyth.attack,
        defense: playerMyth.defense,
        speed: playerMyth.speed,
        level: playerMyth.level,
    };

    const enemyStats: SimStats[] = sanctum.myths.map((m) => {
        const species = getCreature(m.speciesId);
        return {
            hp: calcStat(species.baseStats.hp, m.level),
            attack: calcStat(species.baseStats.atk, m.level),
            defense: calcStat(species.baseStats.def, m.level),
            speed: calcStat(species.baseStats.spd, m.level),
            level: m.level,
        };
    });

    const { won, turnsTotal } = simulateSanctumBattle(playerStats, enemyStats);

    if (won) {
        const newMedals = [...trainer.medals, sanctumId];
        await Promise.all([
            prisma.trainerProfile.update({
                where: { userId },
                data: { medals: newMedals, coins: { increment: sanctum.coinsReward } },
            }),
            addXp(userId, sanctum.xpReward),
        ]);
    }

    const updatedTrainer = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });

    await prisma.battleLog.create({
        data: {
            userId,
            type: "NPC",
            result: won ? "WIN" : "LOSE",
            xpGained: won ? sanctum.xpReward : Math.floor(sanctum.xpReward * 0.1),
            coinsGained: won ? sanctum.coinsReward : 0,
            playerSpeciesId: playerMyth.speciesId,
            playerLevel: playerMyth.level,
            enemySpeciesId: sanctum.myths[0].speciesId,
            enemyLevel: sanctum.myths[sanctum.myths.length - 1].level,
        },
    });

    return {
        result: won ? "WIN" : "LOSE",
        sanctum: {
            id: sanctum.id,
            name: sanctum.name,
            guardian: sanctum.guardian,
            emblem: sanctum.emblem,
        },
        xpGained: won ? sanctum.xpReward : Math.floor(sanctum.xpReward * 0.1),
        coinsGained: won ? sanctum.coinsReward : 0,
        turnsTotal,
        medals: updatedTrainer.medals,
        trainerLevel: updatedTrainer.level,
        emblemEarned: won,
    };
}

export async function getSanctumsStatus(userId: string) {
    const trainer = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });

    return SANCTUMS.map((s) => ({
        id: s.id,
        name: s.name,
        guardian: s.guardian,
        emblem: s.emblem,
        requiredLevel: s.requiredLevel,
        earned: trainer.medals.includes(s.id),
        unlocked: trainer.level >= s.requiredLevel && (s.id === 0 || trainer.medals.includes(s.id - 1)),
    }));
}
