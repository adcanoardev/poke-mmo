import { prisma } from "./prisma.js";
import { usePvpToken } from "./tokenService.js";
import { addPrestige } from "./trainerService.js";
import { getCreature } from "./creatureService.js";

const PRESTIGE_WIN = 5;
const PRESTIGE_LOSE = -5;

interface CombatantStats {
    hp: number;
    attack: number;
    defense: number;
    speed: number;
    level: number;
    userId: string;
    instanceId: string;
    speciesId: string;
}

interface TurnLog {
    turn: number;
    attacker: "challenger" | "defender";
    damage: number;
    critical: boolean;
    challengerHpAfter: number;
    defenderHpAfter: number;
}

function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function simulatePvp(challenger: CombatantStats, defender: CombatantStats) {
    let challengerHp = challenger.hp;
    let defenderHp = defender.hp;
    const turns: TurnLog[] = [];
    let turn = 0;
    const challengerFirst = challenger.speed >= defender.speed;

    while (challengerHp > 0 && defenderHp > 0 && turn < 50) {
        turn++;
        const order: ("challenger" | "defender")[] = challengerFirst
            ? ["challenger", "defender"]
            : ["defender", "challenger"];

        for (const attacker of order) {
            if (challengerHp <= 0 || defenderHp <= 0) break;
            const isCritical = Math.random() < 0.0625;
            const mult = isCritical ? 1.5 : 1;

            if (attacker === "challenger") {
                const dmg = Math.max(
                    1,
                    Math.floor(
                        ((((2 * challenger.level) / 5 + 2) * challenger.attack) / defender.defense / 50 + 2) * mult,
                    ) + randInt(-2, 2),
                );
                defenderHp = Math.max(0, defenderHp - dmg);
                turns.push({
                    turn,
                    attacker,
                    damage: dmg,
                    critical: isCritical,
                    challengerHpAfter: challengerHp,
                    defenderHpAfter: defenderHp,
                });
            } else {
                const dmg = Math.max(
                    1,
                    Math.floor(
                        ((((2 * defender.level) / 5 + 2) * defender.attack) / challenger.defense / 50 + 2) * mult,
                    ) + randInt(-2, 2),
                );
                challengerHp = Math.max(0, challengerHp - dmg);
                turns.push({
                    turn,
                    attacker,
                    damage: dmg,
                    critical: isCritical,
                    challengerHpAfter: challengerHp,
                    defenderHpAfter: defenderHp,
                });
            }
        }
    }

    return { winner: challengerHp > 0 ? "challenger" : ("defender" as "challenger" | "defender"), turns };
}

export async function runPvpBattle(challengerUserId: string, defenderUserId: string) {
    if (challengerUserId === defenderUserId) return { error: "No puedes retarte a ti mismo" };

    const hasToken = await usePvpToken(challengerUserId);
    if (!hasToken) return { error: "No PvP tokens available" };

    // Myths de ambos jugadores
    const [challengerMyth, defenderMyth] = await Promise.all([
        prisma.creatureInstance.findFirst({
            where: { userId: challengerUserId, isInParty: true },
            orderBy: { slot: "asc" },
        }),
        prisma.creatureInstance.findFirst({
            where: { userId: defenderUserId, isInParty: true },
            orderBy: { slot: "asc" },
        }),
    ]);

    if (!challengerMyth) return { error: "El retador no tiene ningún Myth en el equipo" };
    if (!defenderMyth) return { error: "El defensor no tiene ningún Myth en el equipo" };

    const [challengerSpecies, defenderSpecies] = [
        getCreature(challengerMyth.speciesId),
        getCreature(defenderMyth.speciesId),
    ];

    // Perfiles de prestigio
    const [challengerTrainer, defenderTrainer] = await Promise.all([
        prisma.trainerProfile.findUniqueOrThrow({ where: { userId: challengerUserId } }),
        prisma.trainerProfile.findUniqueOrThrow({ where: { userId: defenderUserId } }),
    ]);

    const challengerStats: CombatantStats = {
        hp: challengerMyth.hp,
        attack: challengerMyth.attack,
        defense: challengerMyth.defense,
        speed: challengerMyth.speed,
        level: challengerMyth.level,
        userId: challengerUserId,
        instanceId: challengerMyth.id,
        speciesId: challengerMyth.speciesId,
    };

    const defenderStats: CombatantStats = {
        hp: defenderMyth.hp,
        attack: defenderMyth.attack,
        defense: defenderMyth.defense,
        speed: defenderMyth.speed,
        level: defenderMyth.level,
        userId: defenderUserId,
        instanceId: defenderMyth.id,
        speciesId: defenderMyth.speciesId,
    };

    const { winner, turns } = simulatePvp(challengerStats, defenderStats);
    const challengerWon = winner === "challenger";

    // Actualizar prestigio
    await Promise.all([
        addPrestige(challengerUserId, challengerWon ? PRESTIGE_WIN : PRESTIGE_LOSE),
        addPrestige(defenderUserId, challengerWon ? PRESTIGE_LOSE : PRESTIGE_WIN),
    ]);

    // BattleLog para ambos
    await prisma.battleLog.createMany({
        data: [
            {
                userId: challengerUserId,
                type: "PVP",
                result: challengerWon ? "WIN" : "LOSE",
                xpGained: 0,
                coinsGained: challengerWon ? 150 : 0,
                playerSpeciesId: challengerMyth.speciesId,
                playerLevel: challengerMyth.level,
                enemySpeciesId: defenderMyth.speciesId,
                enemyLevel: defenderMyth.level,
            },
            {
                userId: defenderUserId,
                type: "PVP",
                result: challengerWon ? "LOSE" : "WIN",
                xpGained: 0,
                coinsGained: challengerWon ? 0 : 150,
                playerSpeciesId: defenderMyth.speciesId,
                playerLevel: defenderMyth.level,
                enemySpeciesId: challengerMyth.speciesId,
                enemyLevel: challengerMyth.level,
            },
        ],
    });

    const [updatedChallenger, updatedDefender] = await Promise.all([
        prisma.trainerProfile.findUniqueOrThrow({ where: { userId: challengerUserId } }),
        prisma.trainerProfile.findUniqueOrThrow({ where: { userId: defenderUserId } }),
    ]);

    return {
        result: challengerWon ? "WIN" : "LOSE",
        winner: challengerWon ? challengerUserId : defenderUserId,
        turns,
        challenger: {
            userId: challengerUserId,
            speciesId: challengerMyth.speciesId,
            name: challengerSpecies.name,
            art: challengerSpecies.art,
            level: challengerMyth.level,
            prestigeBefore: challengerTrainer.prestige,
            prestigeAfter: updatedChallenger.prestige,
            prestigeDelta: challengerWon ? +PRESTIGE_WIN : PRESTIGE_LOSE,
            coinsGained: challengerWon ? 150 : 0,
        },
        defender: {
            userId: defenderUserId,
            speciesId: defenderMyth.speciesId,
            name: defenderSpecies.name,
            art: defenderSpecies.art,
            level: defenderMyth.level,
            prestigeBefore: defenderTrainer.prestige,
            prestigeAfter: updatedDefender.prestige,
            prestigeDelta: challengerWon ? PRESTIGE_LOSE : +PRESTIGE_WIN,
            coinsGained: challengerWon ? 0 : 150,
        },
    };
}
