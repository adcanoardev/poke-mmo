// ─────────────────────────────────────────────────────────────
// apps/server/src/services/battleService.ts
// ─────────────────────────────────────────────────────────────
import { prisma } from "./prisma.js";
import { useNpcToken } from "./tokenService.js";
import { addXp } from "./trainerService.js";
import { hasItem, removeItem } from "./inventoryService.js";
import { getCreature, getAllCreatures } from "./creatureService.js";
import type { Move } from "./creatureService.js";
import type { ItemType } from "@prisma/client";
import { checkLevelEvolution } from "./evolutionService.js";
import { createBattleSession, getSession, getUserSession, deleteSession, type BattleCombatant } from "./battleStore.js";

// ── Tabla de ventajas de afinidad ────────────────────────────
// 2.0 = súper efectivo, 0.5 = poco efectivo, 1.0 = normal
export const AFFINITY_CHART: Record<string, Record<string, number>> = {
    EMBER: { GROVE: 2.0, FROST: 2.0, STONE: 0.5, TIDE: 0.5, EMBER: 0.5 },
    TIDE: { EMBER: 2.0, STONE: 2.0, GROVE: 0.5, VOLT: 0.5, TIDE: 0.5 },
    GROVE: { TIDE: 2.0, STONE: 2.0, EMBER: 0.5, VENOM: 0.5, GROVE: 0.5 },
    VOLT: { TIDE: 2.0, IRON: 2.0, GROVE: 0.5, STONE: 0.5, VOLT: 0.5 },
    STONE: { EMBER: 2.0, FROST: 2.0, GROVE: 0.5, TIDE: 0.5, STONE: 0.5 },
    FROST: { GROVE: 2.0, EMBER: 0.5, FROST: 0.5, TIDE: 0.5 },
    VENOM: { GROVE: 2.0, FROST: 2.0, STONE: 0.5, VENOM: 0.5 },
    ASTRAL: { SHADE: 2.0, VENOM: 2.0, ASTRAL: 0.5 },
    SHADE: { ASTRAL: 2.0, GROVE: 2.0, SHADE: 0.5, EMBER: 0.5 },
    IRON: { FROST: 2.0, STONE: 2.0, EMBER: 0.5, IRON: 0.5 },
};

function getTypeMultiplier(moveAffinity: string, defenderAffinities: string[]): number {
    const chart = AFFINITY_CHART[moveAffinity] ?? {};
    let multiplier = 1.0;
    for (const aff of defenderAffinities) {
        multiplier *= chart[aff] ?? 1.0;
    }
    return multiplier;
}

// ── Stats escalados por nivel — valores más generosos ────────
function calcStat(base: number, level: number): number {
    return Math.floor((2 * base * level) / 100) + Math.floor(level * 0.5) + 15;
}

function calcHp(base: number, level: number): number {
    return Math.floor((2 * base * level) / 100) + level + 50;
}

// ── Fórmula de daño ───────────────────────────────────────────
function calcDamageResult(
    attackerLevel: number,
    attackStat: number,
    defenseStat: number,
    move: Move,
    attackerAffinities: string[],
    defenderAffinities: string[],
): { damage: number; critical: boolean; typeMultiplier: number } {
    const hit = Math.random() < move.accuracy;
    if (!hit) return { damage: 0, critical: false, typeMultiplier: 1 };

    const stab = attackerAffinities.includes(move.affinity) ? 1.5 : 1;
    const isCritical = Math.random() < 0.0625;
    const critical = isCritical ? 1.5 : 1;
    const typeMultiplier = getTypeMultiplier(move.affinity, defenderAffinities);

    // Daño base reducido con divisor mayor para combates más largos
    const base = Math.floor((((2 * attackerLevel) / 5 + 2) * move.power * (attackStat / defenseStat)) / 100 + 2);

    return {
        damage: Math.max(1, Math.floor(base * stab * critical * typeMultiplier) + randInt(-1, 1)),
        critical: isCritical,
        typeMultiplier,
    };
}

// ── Encounter pool — filtra por nivel de evolución ───────────
function getEncounterPool(trainerLevel: number): string[] {
    const all = getAllCreatures();

    let rarityFilter: string[];
    if (trainerLevel <= 10) rarityFilter = ["COMMON"];
    else if (trainerLevel <= 25) rarityFilter = ["COMMON", "RARE"];
    else if (trainerLevel <= 50) rarityFilter = ["COMMON", "RARE", "ELITE"];
    else rarityFilter = ["COMMON", "RARE", "ELITE", "LEGENDARY", "MYTHIC"];

    return all.filter((c) => rarityFilter.includes(c.rarity)).map((c) => c.id);
}

function getEncounterLevelRange(trainerLevel: number): { min: number; max: number } {
    if (trainerLevel <= 10) return { min: 3, max: 10 };
    if (trainerLevel <= 25) return { min: 8, max: 22 };
    if (trainerLevel <= 50) return { min: 18, max: 40 };
    if (trainerLevel <= 75) return { min: 30, max: 60 };
    return { min: 45, max: 80 };
}

// Genera un nivel válido para la especie — respeta evolvesAt
function getValidEnemyLevel(speciesId: string, min: number, max: number): number {
    const species = getCreature(speciesId);
    // Si evoluciona por nivel, el enemigo no puede aparecer >= ese nivel
    if (species.evolution?.method === "LEVEL" && typeof species.evolution.value === "number") {
        max = Math.min(max, species.evolution.value - 1);
    }
    if (min > max) min = max;
    return randInt(min, max);
}

function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randPick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ── Captura ───────────────────────────────────────────────────
const CATCH_RATES: Record<string, number> = {
    FRAGMENT: 0.3,
    SHARD: 0.55,
    CRYSTAL: 0.8,
    RUNE: 1.0,
};
const BALL_PRIORITY: ItemType[] = ["RUNE", "CRYSTAL", "SHARD", "FRAGMENT"];

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

// ── GET ACTIVE — Recuperar sesión activa ──────────────────────
export function getActiveBattle(userId: string) {
    const session = getUserSession(userId);
    if (!session) return null;
    return {
        battleId: session.battleId,
        player: {
            speciesId: session.player.speciesId,
            name: session.player.name,
            level: session.player.level,
            hp: session.player.hp,
            maxHp: session.player.maxHp,
            art: session.player.art,
            affinities: session.player.affinities,
            moves: session.player.moves,
        },
        enemy: {
            speciesId: session.enemy.speciesId,
            name: session.enemy.name,
            level: session.enemy.level,
            hp: session.enemy.hp,
            maxHp: session.enemy.maxHp,
            art: session.enemy.art,
            affinities: session.enemy.affinities,
        },
        playerFirst: session.player.speed >= session.enemy.speed,
        log: session.log,
    };
}

// ── START — Iniciar combate NPC ───────────────────────────────
export async function startNpcBattle(userId: string) {
    const existing = getUserSession(userId);
    if (existing) return { error: "Ya tienes un combate activo" };

    const hasToken = await useNpcToken(userId);
    if (!hasToken) return { error: "No tienes fichas de combate NPC" };

    const trainer = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });

    const playerMyth = await prisma.creatureInstance.findFirst({
        where: { userId, isInParty: true },
        orderBy: { slot: "asc" },
    });
    if (!playerMyth) return { error: "No tienes ningún Myth en el equipo" };

    const playerSpecies = getCreature(playerMyth.speciesId);

    const pool = getEncounterPool(trainer.level);
    const enemySpecies = getCreature(randPick(pool));
    const { min, max } = getEncounterLevelRange(trainer.level);
    const enemyLevel = getValidEnemyLevel(enemySpecies.id, min, max);

    const player: BattleCombatant = {
        speciesId: playerMyth.speciesId,
        name: playerSpecies.name,
        level: playerMyth.level,
        hp: playerMyth.hp,
        maxHp: playerMyth.maxHp,
        attack: playerMyth.attack,
        defense: playerMyth.defense,
        speed: playerMyth.speed,
        moves: playerSpecies.moves,
        art: playerSpecies.art,
        affinities: playerSpecies.affinities,
    };

    const enemy: BattleCombatant = {
        speciesId: enemySpecies.id,
        name: enemySpecies.name,
        level: enemyLevel,
        hp: calcHp(enemySpecies.baseStats.hp, enemyLevel),
        maxHp: calcHp(enemySpecies.baseStats.hp, enemyLevel),
        attack: calcStat(enemySpecies.baseStats.atk, enemyLevel),
        defense: calcStat(enemySpecies.baseStats.def, enemyLevel),
        speed: calcStat(enemySpecies.baseStats.spd, enemyLevel),
        moves: enemySpecies.moves,
        art: enemySpecies.art,
        affinities: enemySpecies.affinities,
    };

    const session = createBattleSession({
        userId,
        player,
        enemy,
        playerInstanceId: playerMyth.id,
        turn: 0,
        status: "active",
        log: [],
    });

    return {
        battleId: session.battleId,
        player: {
            speciesId: player.speciesId,
            name: player.name,
            level: player.level,
            hp: player.hp,
            maxHp: player.maxHp,
            art: player.art,
            affinities: player.affinities,
            moves: player.moves,
        },
        enemy: {
            speciesId: enemy.speciesId,
            name: enemy.name,
            level: enemy.level,
            hp: enemy.hp,
            maxHp: enemy.maxHp,
            art: enemy.art,
            affinities: enemy.affinities,
        },
        playerFirst: player.speed >= enemy.speed,
    };
}

// ── TURN — Ejecutar un turno ──────────────────────────────────
export async function executeTurn(userId: string, battleId: string, moveId: string) {
    const session = getSession(battleId);
    if (!session) return { error: "Combate no encontrado" };
    if (session.userId !== userId) return { error: "No autorizado" };
    if (session.status !== "active") return { error: "El combate ya ha terminado" };

    const playerMove = session.player.moves.find((m) => m.id === moveId);
    if (!playerMove) return { error: "Move no válido" };

    const enemyMove = randPick(session.enemy.moves);

    let playerHp = session.player.hp;
    let enemyHp = session.enemy.hp;
    session.turn++;

    const playerFirst = session.player.speed >= session.enemy.speed;
    const order = playerFirst ? ["player", "enemy"] : ["enemy", "player"];

    let playerDamage = 0,
        enemyDamage = 0;
    let playerCritical = false,
        enemyCritical = false;
    let playerTypeMultiplier = 1,
        enemyTypeMultiplier = 1;

    for (const attacker of order) {
        if (playerHp <= 0 || enemyHp <= 0) break;

        if (attacker === "player") {
            const result = calcDamageResult(
                session.player.level,
                session.player.attack,
                session.enemy.defense,
                playerMove,
                session.player.affinities,
                session.enemy.affinities,
            );
            playerDamage = result.damage;
            playerCritical = result.critical;
            playerTypeMultiplier = result.typeMultiplier;
            enemyHp = Math.max(0, enemyHp - playerDamage);
        } else {
            const result = calcDamageResult(
                session.enemy.level,
                session.enemy.attack,
                session.player.defense,
                enemyMove,
                session.enemy.affinities,
                session.player.affinities,
            );
            enemyDamage = result.damage;
            enemyCritical = result.critical;
            enemyTypeMultiplier = result.typeMultiplier;
            playerHp = Math.max(0, playerHp - enemyDamage);
        }
    }

    session.player.hp = playerHp;
    session.enemy.hp = enemyHp;

    const turnResult = {
        turn: session.turn,
        playerMove: playerMove.id,
        playerMoveName: playerMove.name,
        playerMoveAffinity: playerMove.affinity,
        enemyMove: enemyMove.id,
        enemyMoveName: enemyMove.name,
        enemyMoveAffinity: enemyMove.affinity,
        playerDamage,
        enemyDamage,
        playerCritical,
        enemyCritical,
        playerTypeMultiplier,
        enemyTypeMultiplier,
        playerHpAfter: playerHp,
        enemyHpAfter: enemyHp,
    };
    session.log.push(turnResult);

    const battleOver = playerHp <= 0 || enemyHp <= 0;
    if (!battleOver) {
        return { status: "ongoing", turn: turnResult, playerHp, enemyHp };
    }

    const won = enemyHp <= 0;
    session.status = won ? "won" : "lost";

    const xpGained = calcXpGained(session.enemy.level, won);
    const coinsGained = calcCoinsGained(session.enemy.level, won);

    const [updatedTrainer] = await Promise.all([
        addXp(userId, xpGained),
        won && coinsGained > 0
            ? prisma.trainerProfile.update({
                  where: { userId },
                  data: { coins: { increment: coinsGained } },
              })
            : Promise.resolve(),
    ]);

    let captured = null;
    if (won) {
        const enemyHpPercent = session.enemy.hp / session.enemy.maxHp;
        const enemySpecies = getCreature(session.enemy.speciesId);
        const { caught, ballUsed } = await attemptCapture(userId, enemyHpPercent, enemySpecies.catchRate);

        if (caught) {
            await prisma.creatureInstance.create({
                data: {
                    userId,
                    speciesId: session.enemy.speciesId,
                    level: session.enemy.level,
                    xp: 0,
                    hp: session.enemy.maxHp,
                    maxHp: session.enemy.maxHp,
                    attack: session.enemy.attack,
                    defense: session.enemy.defense,
                    speed: session.enemy.speed,
                    isInParty: false,
                },
            });
            captured = {
                speciesId: session.enemy.speciesId,
                name: session.enemy.name,
                level: session.enemy.level,
                art: session.enemy.art,
                ballUsed,
            };
        }
    }

    await prisma.battleLog.create({
        data: {
            userId,
            type: "NPC",
            result: won ? "WIN" : "LOSE",
            xpGained,
            coinsGained,
            playerSpeciesId: session.player.speciesId,
            playerLevel: session.player.level,
            enemySpeciesId: session.enemy.speciesId,
            enemyLevel: session.enemy.level,
            capturedSpeciesId: captured?.speciesId ?? null,
        },
    });

    const evoResult = await checkLevelEvolution(session.playerInstanceId);
    deleteSession(battleId);

    return {
        status: won ? "won" : "lost",
        turn: turnResult,
        playerHp,
        enemyHp,
        result: won ? "WIN" : "LOSE",
        xpGained,
        coinsGained,
        trainerLevel: updatedTrainer.level,
        trainerXp: updatedTrainer.xp,
        captured,
        evolution: evoResult,
    };
}

// ── FLEE — Huir del combate ───────────────────────────────────
export async function fleeBattle(userId: string, battleId: string) {
    const session = getSession(battleId);
    if (!session) return { error: "Combate no encontrado" };
    if (session.userId !== userId) return { error: "No autorizado" };
    if (session.status !== "active") return { error: "El combate ya ha terminado" };

    const xpGained = calcXpGained(session.enemy.level, false);
    await addXp(userId, xpGained);

    await prisma.battleLog.create({
        data: {
            userId,
            type: "NPC",
            result: "LOSE",
            xpGained,
            coinsGained: 0,
            playerSpeciesId: session.player.speciesId,
            playerLevel: session.player.level,
            enemySpeciesId: session.enemy.speciesId,
            enemyLevel: session.enemy.level,
        },
    });

    deleteSession(battleId);
    return { status: "fled", xpGained };
}
