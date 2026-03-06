import { prisma } from "./prisma.js";
import { useNpcToken } from "./tokenService.js";
import { addXp } from "./trainerService.js";
import { addItem, hasItem, removeItem } from "./inventoryService.js";
import { fetchPokemon } from "./pokeapi.js";
import type { ItemType } from "@prisma/client";
import { checkLevelEvolution } from "./evolutionService.js";

// ── Tablas de encuentro por nivel del entrenador ───────────────

const ENCOUNTER_TABLE: Record<string, { minId: number; maxId: number; minLvl: number; maxLvl: number }> = {
    "1-10": { minId: 1, maxId: 151, minLvl: 2, maxLvl: 12 },
    "11-25": { minId: 1, maxId: 251, minLvl: 8, maxLvl: 25 },
    "26-50": { minId: 1, maxId: 386, minLvl: 20, maxLvl: 45 },
    "51-75": { minId: 1, maxId: 493, minLvl: 35, maxLvl: 65 },
    "76-100": { minId: 1, maxId: 649, minLvl: 50, maxLvl: 90 },
};

function getEncounterRange(trainerLevel: number) {
    if (trainerLevel <= 10) return ENCOUNTER_TABLE["1-10"];
    if (trainerLevel <= 25) return ENCOUNTER_TABLE["11-25"];
    if (trainerLevel <= 50) return ENCOUNTER_TABLE["26-50"];
    if (trainerLevel <= 75) return ENCOUNTER_TABLE["51-75"];
    return ENCOUNTER_TABLE["76-100"];
}

function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ── Stats de un Pokémon según nivel ───────────────────────────

function calcStat(base: number, level: number): number {
    return Math.floor((2 * base * level) / 100) + level + 10;
}

function calcHp(base: number, level: number): number {
    return Math.floor((2 * base * level) / 100) + level + 10;
}

// ── Motor de combate por turnos ────────────────────────────────

interface CombatantStats {
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    level: number;
    pokedexId: number;
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

function simulateBattle(
    player: CombatantStats,
    enemy: CombatantStats,
): {
    winner: "player" | "enemy";
    turns: TurnLog[];
} {
    let playerHp = player.hp;
    let enemyHp = enemy.hp;
    const turns: TurnLog[] = [];
    let turn = 0;

    // Decide quién ataca primero por velocidad
    let playerFirst = player.speed >= enemy.speed;

    while (playerHp > 0 && enemyHp > 0 && turn < 50) {
        turn++;
        const attackers: ("player" | "enemy")[] = playerFirst ? ["player", "enemy"] : ["enemy", "player"];

        for (const attacker of attackers) {
            if (playerHp <= 0 || enemyHp <= 0) break;

            const isCritical = Math.random() < 0.0625; // 1/16 chance
            const multiplier = isCritical ? 1.5 : 1;

            if (attacker === "player") {
                const rawDmg = Math.max(
                    1,
                    Math.floor(((((2 * player.level) / 5 + 2) * player.attack) / enemy.defense / 50 + 2) * multiplier),
                );
                const damage = rawDmg + randInt(-2, 2); // variación aleatoria
                enemyHp = Math.max(0, enemyHp - damage);
                turns.push({
                    turn,
                    attacker,
                    damage,
                    critical: isCritical,
                    playerHpAfter: playerHp,
                    enemyHpAfter: enemyHp,
                });
            } else {
                const rawDmg = Math.max(
                    1,
                    Math.floor(((((2 * enemy.level) / 5 + 2) * enemy.attack) / player.defense / 50 + 2) * multiplier),
                );
                const damage = rawDmg + randInt(-2, 2);
                playerHp = Math.max(0, playerHp - damage);
                turns.push({
                    turn,
                    attacker,
                    damage,
                    critical: isCritical,
                    playerHpAfter: playerHp,
                    enemyHpAfter: enemyHp,
                });
            }
        }
    }

    return {
        winner: playerHp > 0 ? "player" : "enemy",
        turns,
    };
}

// ── Captura ────────────────────────────────────────────────────

const CATCH_RATES: Record<string, number> = {
    POKEBALL: 0.3,
    SUPERBALL: 0.55,
    ULTRABALL: 0.8,
    MASTERBALL: 1.0,
};

const BALL_PRIORITY: ItemType[] = ["MASTERBALL", "ULTRABALL", "SUPERBALL", "POKEBALL"];

async function attemptCapture(
    userId: string,
    enemyHpPercent: number,
): Promise<{
    caught: boolean;
    ballUsed: ItemType | null;
}> {
    // Busca la mejor bola disponible
    let ballUsed: ItemType | null = null;
    for (const ball of BALL_PRIORITY) {
        if (await hasItem(userId, ball)) {
            ballUsed = ball;
            break;
        }
    }
    if (!ballUsed) return { caught: false, ballUsed: null };

    const baseRate = CATCH_RATES[ballUsed];
    // HP baja = más fácil capturar
    const hpBonus = (1 - enemyHpPercent) * 0.3;
    const caught = Math.random() < baseRate + hpBonus;

    if (caught) {
        await removeItem(userId, ballUsed, 1);
    }

    return { caught, ballUsed };
}

// ── XP ganada ─────────────────────────────────────────────────

function calcXpGained(enemyLevel: number, won: boolean): number {
    const base = Math.floor(enemyLevel * 1.5);
    return won ? base : Math.floor(base * 0.2); // 20% XP si pierde
}

function calcCoinsGained(enemyLevel: number, won: boolean): number {
    if (!won) return 0;
    return randInt(enemyLevel * 2, enemyLevel * 5);
}

// ── Función principal ──────────────────────────────────────────

export async function runNpcBattle(userId: string) {
    // 1. Verificar ficha
    const hasToken = await useNpcToken(userId);
    if (!hasToken) {
        return { error: "No NPC tokens available" };
    }

    // 2. Obtener perfil del entrenador
    const trainer = await prisma.trainerProfile.findUniqueOrThrow({ where: { userId } });

    // 3. Obtener Pokémon del jugador (primero del equipo)
    const playerPokemon = await prisma.pokemonInstance.findFirst({
        where: { userId, isInParty: true },
        orderBy: { slot: "asc" },
    });

    if (!playerPokemon) {
        return { error: "No Pokémon in party" };
    }

    // 4. Generar Pokémon enemigo
    const range = getEncounterRange(trainer.level);
    const enemyPokedexId = randInt(range.minId, range.maxId);
    const enemyLevel = randInt(range.minLvl, range.maxLvl);
    const enemyDex = await fetchPokemon(enemyPokedexId);

    // Stats base aproximados (usamos stats de PokéAPI en el futuro)
    const BASE_STATS = { hp: 45, attack: 50, defense: 45, speed: 45 };

    const playerStats: CombatantStats = {
        hp: playerPokemon.hp,
        maxHp: playerPokemon.maxHp,
        attack: playerPokemon.attack,
        defense: playerPokemon.defense,
        speed: playerPokemon.speed,
        level: playerPokemon.level,
        pokedexId: playerPokemon.pokedexId,
        name: "Tu Pokémon",
    };

    const enemyStats: CombatantStats = {
        hp: calcHp(BASE_STATS.hp, enemyLevel),
        maxHp: calcHp(BASE_STATS.hp, enemyLevel),
        attack: calcStat(BASE_STATS.attack, enemyLevel),
        defense: calcStat(BASE_STATS.defense, enemyLevel),
        speed: calcStat(BASE_STATS.speed, enemyLevel),
        level: enemyLevel,
        pokedexId: enemyPokedexId,
        name: enemyDex.name,
    };

    // 5. Simular combate
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

    // 7. Intentar captura si ganó
    let captured = null;
    if (won) {
        const enemyHpPercent = turns[turns.length - 1].enemyHpAfter / enemyStats.maxHp;
        const { caught, ballUsed } = await attemptCapture(userId, enemyHpPercent);

        if (caught) {
            const newPokemon = await prisma.pokemonInstance.create({
                data: {
                    userId,
                    pokedexId: enemyPokedexId,
                    level: enemyLevel,
                    hp: calcHp(BASE_STATS.hp, enemyLevel),
                    maxHp: calcHp(BASE_STATS.hp, enemyLevel),
                    attack: calcStat(BASE_STATS.attack, enemyLevel),
                    defense: calcStat(BASE_STATS.defense, enemyLevel),
                    speed: calcStat(BASE_STATS.speed, enemyLevel),
                    isInParty: false,
                },
            });
            captured = { pokedexId: enemyPokedexId, name: enemyDex.name, level: enemyLevel, ballUsed };
        }
    }

    // 8. Guardar BattleLog
    await prisma.battleLog.create({
        data: {
            userId,
            type: "NPC",
            result: won ? "WIN" : "LOSE",
            xpGained,
            coinsGained,
            playerPokemonId: playerPokemon.pokedexId,
            playerPokemonLvl: playerPokemon.level,
            enemyPokemonId: enemyPokedexId,
            enemyPokemonLvl: enemyLevel,
            capturedPokemonId: captured?.pokedexId ?? null,
        },
    });

    // Comprobar evolución por nivel tras ganar XP
    const evoResult = await checkLevelEvolution(playerPokemon.id);

    return {
        result: won ? "WIN" : "LOSE",
        xpGained,
        coinsGained,
        trainerLevel: updatedTrainer.level,
        trainerXp: updatedTrainer.xp,
        enemy: {
            pokedexId: enemyPokedexId,
            name: enemyDex.name,
            level: enemyLevel,
            sprite: enemyDex.sprite,
        },
        captured,
        turns,
        evolution: evoResult, // null si no evolucionó
    };
}
