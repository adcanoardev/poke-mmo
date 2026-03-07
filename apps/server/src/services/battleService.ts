import { prisma } from "./prisma.js";
import { useNpcToken } from "./tokenService.js";
import { addXp } from "./trainerService.js";
import { addItem, hasItem, removeItem } from "./inventoryService.js";
import { getCreature, getAllCreatures } from "./creatureService.js";
import type { ItemType } from "@prisma/client";
import { checkLevelEvolution } from "./evolutionService.js";

// ── Tabla de encuentros por nivel del Binder ──────────────────

function getEncounterPool(trainerLevel: number): string[] {
    const all = getAllCreatures();
    if (trainerLevel <= 10) return all.filter((c) => c.rarity === "COMMON").map((c) => c.id);
    if (trainerLevel <= 25) return all.filter((c) => ["COMMON", "RARE"].includes(c.rarity)).map((c) => c.id);
    if (trainerLevel <= 50) return all.filter((c) => ["COMMON", "RARE", "ELITE"].includes(c.rarity)).map((c) => c.id);
    return all.map((c) => c.id);
}

function getEncounterLevelRange(trainerLevel: number): { min: number; max: number } {
    if (trainerLevel <= 10) return { min: 2, max: 12 };
    if (trainerLevel <= 25) return { min: 8, max: 25 };
    if (trainerLevel <= 50) return { min: 20, max: 45 };
    if (trainerLevel <= 75) return { min: 35, max: 65 };
    return { min: 50, max: 90 };
}

function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randPick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ── Stats escalados por nivel ─────────────────────────────────

function calcStat(base: number, level: number): number {
    return Math.floor((2 * base * level) / 100) + level + 10;
}

function calcHp(base: number, level: number): number {
    return Math.floor((2 * base * level) / 100) + level + 10;
}

// ── Motor de combate ──────────────────────────────────────────

interface CombatantStats {
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    level: number;
    speciesId: string;
    name: string;
}

interface TurnLog {
    turn: number;
    attacker: "player" | "enemy";
    damage: number;
    critical: boolean;
    playerHpAfter: number;
    enemyHpAfter: number;
}

function simulateBattle(player: CombatantStats, enemy: CombatantStats) {
    let playerHp = player.hp;
    let enemyHp = enemy.hp;
    const turns: TurnLog[] = [];
    let turn = 0;
    const playerFirst = player.speed >= enemy.speed;

    while (playerHp > 0 && enemyHp > 0 && turn < 50) {
        turn++;
        const order: ("player" | "enemy")[] = playerFirst ? ["player", "enemy"] : ["enemy", "player"];

        for (const attacker of order) {
            if (playerHp <= 0 || enemyHp <= 0) break;
            const isCritical = Math.random() < 0.0625;
            const mult = isCritical ? 1.5 : 1;

            if (attacker === "player") {
                const dmg =
                    Math.max(
                        1,
                        Math.floor(((((2 * player.level) / 5 + 2) * player.attack) / enemy.defense / 50 + 2) * mult),
                    ) + randInt(-2, 2);
                enemyHp = Math.max(0, enemyHp - dmg);
                turns.push({
                    turn,
                    attacker,
                    damage: dmg,
                    critical: isCritical,
                    playerHpAfter: playerHp,
                    enemyHpAfter: enemyHp,
                });
            } else {
                const dmg =
                    Math.max(
                        1,
                        Math.floor(((((2 * enemy.level) / 5 + 2) * enemy.attack) / player.defense / 50 + 2) * mult),
                    ) + randInt(-2, 2);
                playerHp = Math.max(0, playerHp - dmg);
                turns.push({
                    turn,
                    attacker,
                    damage: dmg,
                    critical: isCritical,
                    playerHpAfter: playerHp,
                    enemyHpAfter: enemyHp,
                });
            }
        }
    }

    return { winner: playerHp > 0 ? "player" : ("enemy" as "player" | "enemy"), turns };
}

// ── Captura ───────────────────────────────────────────────────

const CATCH_RATES: Record<string, number> = {
    POKEBALL: 0.3,
    SUPERBALL: 0.55,
    ULTRABALL: 0.8,
    MASTERBALL: 1.0,
};
const BALL_PRIORITY: ItemType[] = ["MASTERBALL", "ULTRABALL", "SUPERBALL", "POKEBALL"];

async function attemptCapture(userId: string, enemyHpPercent: number, speciesCatchRate: number) {
    let ballUsed: ItemType | null = null;
    for (const ball of BALL_PRIORITY) {
        if (await hasItem(userId, ball)) {
            ballUsed = ball;
            break;
        }
    }
    if (!ballUsed) return { caught: false, ballUsed: null };

    const ballRate = CATCH_RATES[ballUsed];
    const hpBonus = (1 - enemyHpPercent) * 0.3;
    const caught = Math.random() < (ballRate + hpBonus) * speciesCatchRate * 2;

    if (caught) await removeItem(userId, ballUsed, 1);
    return { caught, ballUsed };
}

// ── XP y monedas ─────────────────────────────────────────────

function calcXpGained(enemyLevel: number, won: boolean): number {
    const base = Math.floor(enemyLevel * 1.5);
    return won ? base : Math.floor(base * 0.2);
}

function calcCoinsGained(enemyLevel: number, won: boolean): number {
    if (!won) return 0;
    return randInt(enemyLevel * 2, enemyLevel * 5);
}

// ── Función principal ─────────────────────────────────────────

export async function runNpcBattle(userId: string) {
    // 1. Ficha NPC
    const hasToken = await useNpcToken(userId);
    if (!hasToken) return { error: "No NPC tokens available" };

    // 2. Perfil del Binder
    const trainer = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });

    // 3. Myth del jugador (primero del equipo)
    const playerMyth = await prisma.creatureInstance.findFirst({
        where: { userId, isInParty: true },
        orderBy: { slot: "asc" },
    });
    if (!playerMyth) return { error: "No Myth in party" };

    const playerSpecies = getCreature(playerMyth.speciesId);

    // 4. Generar Myth enemigo aleatorio según nivel del Binder
    const pool = getEncounterPool(trainer.level);
    const enemyId = randPick(pool);
    const enemySpecies = getCreature(enemyId);
    const { min, max } = getEncounterLevelRange(trainer.level);
    const enemyLevel = randInt(min, max);

    const playerStats: CombatantStats = {
        hp: playerMyth.hp,
        maxHp: playerMyth.maxHp,
        attack: playerMyth.attack,
        defense: playerMyth.defense,
        speed: playerMyth.speed,
        level: playerMyth.level,
        speciesId: playerMyth.speciesId,
        name: playerSpecies.name,
    };

    const enemyStats: CombatantStats = {
        hp: calcHp(enemySpecies.baseStats.hp, enemyLevel),
        maxHp: calcHp(enemySpecies.baseStats.hp, enemyLevel),
        attack: calcStat(enemySpecies.baseStats.atk, enemyLevel),
        defense: calcStat(enemySpecies.baseStats.def, enemyLevel),
        speed: calcStat(enemySpecies.baseStats.spd, enemyLevel),
        level: enemyLevel,
        speciesId: enemySpecies.id,
        name: enemySpecies.name,
    };

    // 5. Combate
    const { winner, turns } = simulateBattle(playerStats, enemyStats);
    const won = winner === "player";

    // 6. XP y monedas
    const xpGained = calcXpGained(enemyLevel, won);
    const coinsGained = calcCoinsGained(enemyLevel, won);

    const [updatedTrainer] = await Promise.all([
        addXp(userId, xpGained),
        won && coinsGained > 0
            ? prisma.trainerProfile.update({
                  where: { userId },
                  data: { coins: { increment: coinsGained } },
              })
            : Promise.resolve(),
    ]);

    // 7. Captura si ganó
    let captured = null;
    if (won) {
        const enemyHpPercent = turns[turns.length - 1].enemyHpAfter / enemyStats.maxHp;
        const { caught, ballUsed } = await attemptCapture(userId, enemyHpPercent, enemySpecies.catchRate);

        if (caught) {
            await prisma.creatureInstance.create({
                data: {
                    userId,
                    speciesId: enemySpecies.id,
                    level: enemyLevel,
                    hp: enemyStats.hp,
                    maxHp: enemyStats.maxHp,
                    attack: enemyStats.attack,
                    defense: enemyStats.defense,
                    speed: enemyStats.speed,
                    isInParty: false,
                },
            });
            captured = { speciesId: enemySpecies.id, name: enemySpecies.name, level: enemyLevel, ballUsed };
        }
    }

    // 8. BattleLog
    await prisma.battleLog.create({
        data: {
            userId,
            type: "NPC",
            result: won ? "WIN" : "LOSE",
            xpGained,
            coinsGained,
            playerSpeciesId: playerMyth.speciesId,
            playerLevel: playerMyth.level,
            enemySpeciesId: enemySpecies.id,
            enemyLevel,
            capturedSpeciesId: captured?.speciesId ?? null,
        },
    });

    // 9. Evolución por nivel
    const evoResult = await checkLevelEvolution(playerMyth.id);

    return {
        result: won ? "WIN" : "LOSE",
        xpGained,
        coinsGained,
        trainerLevel: updatedTrainer.level,
        trainerXp: updatedTrainer.xp,
        enemy: {
            speciesId: enemySpecies.id,
            name: enemySpecies.name,
            level: enemyLevel,
            art: enemySpecies.art,
            affinities: enemySpecies.affinities,
        },
        captured,
        turns,
        evolution: evoResult,
    };
}
