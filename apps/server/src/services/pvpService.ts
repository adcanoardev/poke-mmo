import { prisma } from "./prisma.js";
import { usePvpToken } from "./tokenService.js";
import { addPrestige } from "./trainerService.js";
import { getCreature } from "./creatureService.js";
import type { Move } from "./creatureService.js";
import { AFFINITY_CHART } from "./battleService.js";

const PRESTIGE_WIN = 5;
const PRESTIGE_LOSE = -5;

// ── Helpers ───────────────────────────────────────────────────

function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randPick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getTypeMultiplier(moveAffinity: string, defenderAffinities: string[]): number {
    const chart = AFFINITY_CHART[moveAffinity] ?? {};
    let multiplier = 1.0;
    for (const aff of defenderAffinities) {
        multiplier *= chart[aff] ?? 1.0;
    }
    return multiplier;
}

interface PvpCombatant {
    userId: string;
    instanceId: string;
    speciesId: string;
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    affinities: string[];
    moves: Move[];
}

interface TurnLog {
    turn: number;
    challengerMove: string;
    challengerMoveName: string;
    challengerDamage: number;
    challengerCritical: boolean;
    challengerTypeMultiplier: number;
    defenderMove: string;
    defenderMoveName: string;
    defenderDamage: number;
    defenderCritical: boolean;
    defenderTypeMultiplier: number;
    challengerHpAfter: number;
    defenderHpAfter: number;
}

function calcDamage(
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
    const critMult = isCritical ? 1.5 : 1;
    const typeMultiplier = getTypeMultiplier(move.affinity, defenderAffinities);

    const base = Math.floor((((2 * attackerLevel) / 5 + 2) * move.power * (attackStat / defenseStat)) / 100 + 2);

    return {
        damage: Math.max(1, Math.floor(base * stab * critMult * typeMultiplier) + randInt(-1, 1)),
        critical: isCritical,
        typeMultiplier,
    };
}

function simulatePvp(challenger: PvpCombatant, defender: PvpCombatant) {
    let challengerHp = challenger.hp;
    let defenderHp = defender.hp;
    const turns: TurnLog[] = [];
    let turn = 0;
    const challengerFirst = challenger.speed >= defender.speed;

    while (challengerHp > 0 && defenderHp > 0 && turn < 50) {
        turn++;

        const cMove = randPick(challenger.moves);
        const dMove = randPick(defender.moves);

        let cDmg = 0,
            cCrit = false,
            cTypeMult = 1;
        let dDmg = 0,
            dCrit = false,
            dTypeMult = 1;

        const first = challengerFirst ? ["challenger", "defender"] : ["defender", "challenger"];

        for (const attacker of first) {
            if (challengerHp <= 0 || defenderHp <= 0) break;

            if (attacker === "challenger") {
                const r = calcDamage(
                    challenger.level,
                    challenger.attack,
                    defender.defense,
                    cMove,
                    challenger.affinities,
                    defender.affinities,
                );
                cDmg = r.damage;
                cCrit = r.critical;
                cTypeMult = r.typeMultiplier;
                defenderHp = Math.max(0, defenderHp - cDmg);
            } else {
                const r = calcDamage(
                    defender.level,
                    defender.attack,
                    challenger.defense,
                    dMove,
                    defender.affinities,
                    challenger.affinities,
                );
                dDmg = r.damage;
                dCrit = r.critical;
                dTypeMult = r.typeMultiplier;
                challengerHp = Math.max(0, challengerHp - dDmg);
            }
        }

        turns.push({
            turn,
            challengerMove: cMove.id,
            challengerMoveName: cMove.name,
            challengerDamage: cDmg,
            challengerCritical: cCrit,
            challengerTypeMultiplier: cTypeMult,
            defenderMove: dMove.id,
            defenderMoveName: dMove.name,
            defenderDamage: dDmg,
            defenderCritical: dCrit,
            defenderTypeMultiplier: dTypeMult,
            challengerHpAfter: challengerHp,
            defenderHpAfter: defenderHp,
        });
    }

    return {
        winner: challengerHp > 0 ? "challenger" : ("defender" as "challenger" | "defender"),
        turns,
    };
}

// ── runPvpBattle ──────────────────────────────────────────────

export async function runPvpBattle(challengerUserId: string, defenderUserId: string) {
    if (challengerUserId === defenderUserId) return { error: "No puedes retarte a ti mismo" };

    const hasToken = await usePvpToken(challengerUserId);
    if (!hasToken) return { error: "No PvP tokens available" };

    const [challengerMyth, defenderMyth] = await Promise.all([
        prisma.creatureInstance.findFirst({
            where: { userId: challengerUserId, isInParty: true, inNursery: false },
            orderBy: { slot: "asc" },
        }),
        prisma.creatureInstance.findFirst({
            where: { userId: defenderUserId, isInParty: true, inNursery: false },
            orderBy: { slot: "asc" },
        }),
    ]);

    if (!challengerMyth) return { error: "El retador no tiene ningún Myth en el equipo" };
    if (!defenderMyth) return { error: "El defensor no tiene ningún Myth en el equipo" };

    const [challengerSpecies, defenderSpecies] = [
        getCreature(challengerMyth.speciesId),
        getCreature(defenderMyth.speciesId),
    ];

    const [challengerTrainer, defenderTrainer] = await Promise.all([
        prisma.trainerProfile.findUniqueOrThrow({ where: { userId: challengerUserId } }),
        prisma.trainerProfile.findUniqueOrThrow({ where: { userId: defenderUserId } }),
    ]);

    const challenger: PvpCombatant = {
        userId: challengerUserId,
        instanceId: challengerMyth.id,
        speciesId: challengerMyth.speciesId,
        name: challengerSpecies.name,
        level: challengerMyth.level,
        hp: challengerMyth.hp,
        maxHp: challengerMyth.maxHp,
        attack: challengerMyth.attack,
        defense: challengerMyth.defense,
        speed: challengerMyth.speed,
        affinities: challengerSpecies.affinities,
        moves: challengerSpecies.moves,
    };

    const defender: PvpCombatant = {
        userId: defenderUserId,
        instanceId: defenderMyth.id,
        speciesId: defenderMyth.speciesId,
        name: defenderSpecies.name,
        level: defenderMyth.level,
        hp: defenderMyth.hp,
        maxHp: defenderMyth.maxHp,
        attack: defenderMyth.attack,
        defense: defenderMyth.defense,
        speed: defenderMyth.speed,
        affinities: defenderSpecies.affinities,
        moves: defenderSpecies.moves,
    };

    const { winner, turns } = simulatePvp(challenger, defender);
    const challengerWon = winner === "challenger";

    await Promise.all([
        addPrestige(challengerUserId, challengerWon ? PRESTIGE_WIN : PRESTIGE_LOSE),
        addPrestige(defenderUserId, challengerWon ? PRESTIGE_LOSE : PRESTIGE_WIN),
    ]);

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
