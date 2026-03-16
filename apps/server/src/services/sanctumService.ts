// apps/server/src/services/sanctumService.ts
// Sistema de Sanctums — 8 sanctums, 1 por afinidad
// Formato: 3 rondas 1v1, jugador lleva 5 myths, máx 2 cambios, sin curación entre rondas
// Bloqueo por binderLevel: Sanctum 0→Lv5, 1→Lv10, ..., 7→Lv40

import { prisma } from "./prisma.js";
import creaturesData from "../data/creatures.json" with { type: "json" };

// ─────────────────────────────────────────
// Configuración de los 8 Sanctums
// ─────────────────────────────────────────

export interface SanctumConfig {
    id: number;
    name: string;
    affinity: string;
    requiredLevel: number;
    guardian: string;
    enemySpeciesIds: string[]; // 3 myths del guardián, en orden de rondas
    enemyLevel: number;
    xpReward: number;
    goldReward: number;
}

export const SANCTUMS: SanctumConfig[] = [
    {
        id: 0,
        name: "EMBER",
        affinity: "EMBER",
        requiredLevel: 5,
        guardian: "Ignar el Forjado",
        enemySpeciesIds: ["003", "014", "028"], // 3 myths EMBER del json
        enemyLevel: 8,
        xpReward: 300,
        goldReward: 500,
    },
    {
        id: 1,
        name: "TIDE",
        affinity: "TIDE",
        requiredLevel: 10,
        guardian: "Marina de las Profundidades",
        enemySpeciesIds: ["005", "016", "030"],
        enemyLevel: 14,
        xpReward: 600,
        goldReward: 900,
    },
    {
        id: 2,
        name: "GROVE",
        affinity: "GROVE",
        requiredLevel: 15,
        guardian: "Sylvara la Ancestral",
        enemySpeciesIds: ["007", "018", "032"],
        enemyLevel: 20,
        xpReward: 1000,
        goldReward: 1400,
    },
    {
        id: 3,
        name: "VOLT",
        affinity: "VOLT",
        requiredLevel: 20,
        guardian: "Zarak el Tempestuoso",
        enemySpeciesIds: ["009", "020", "034"],
        enemyLevel: 26,
        xpReward: 1500,
        goldReward: 2000,
    },
    {
        id: 4,
        name: "STONE",
        affinity: "STONE",
        requiredLevel: 25,
        guardian: "Petra Ironwall",
        enemySpeciesIds: ["011", "022", "036"],
        enemyLevel: 32,
        xpReward: 2100,
        goldReward: 2800,
    },
    {
        id: 5,
        name: "SHADE",
        affinity: "SHADE",
        requiredLevel: 30,
        guardian: "Noxar el Desterrado",
        enemySpeciesIds: ["013", "024", "038"],
        enemyLevel: 38,
        xpReward: 2800,
        goldReward: 3600,
    },
    {
        id: 6,
        name: "FROST",
        affinity: "FROST",
        requiredLevel: 35,
        guardian: "Cryo el Eterno",
        enemySpeciesIds: ["015", "026", "040"],
        enemyLevel: 44,
        xpReward: 3600,
        goldReward: 4500,
    },
    {
        id: 7,
        name: "ASTRAL",
        affinity: "ASTRAL",
        requiredLevel: 40,
        guardian: "Voryn el Sin Forma",
        enemySpeciesIds: ["017", "028", "050"],
        enemyLevel: 50,
        xpReward: 4500,
        goldReward: 6000,
    },
];

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function getCreatureById(id: string): any | null {
    return (creaturesData as any[]).find((c: any) => c.id === id) ?? null;
}

function getCreaturesByAffinity(affinity: string, exclude: string[] = []): any[] {
    return (creaturesData as any[]).filter((c: any) =>
        Array.isArray(c.affinities) &&
        c.affinities.includes(affinity) &&
        !exclude.includes(c.id)
    );
}

// Fallback: si los IDs configurados no existen en creatures.json, busca por afinidad
function resolveEnemySpeciesIds(config: SanctumConfig): string[] {
    const resolved: string[] = [];
    for (const id of config.enemySpeciesIds) {
        if (getCreatureById(id)) {
            resolved.push(id);
        }
    }
    if (resolved.length < 3) {
        const byAffinity = getCreaturesByAffinity(config.affinity, resolved);
        const shuffled = byAffinity.sort(() => Math.random() - 0.5);
        for (const c of shuffled) {
            if (resolved.length >= 3) break;
            if (!resolved.includes(c.id)) resolved.push(c.id);
        }
    }
    // Si aún no hay 3, completa con cualquier criatura
    if (resolved.length < 3) {
        const all = (creaturesData as any[]).filter((c: any) => !resolved.includes(c.id));
        const shuffled = all.sort(() => Math.random() - 0.5);
        for (const c of shuffled) {
            if (resolved.length >= 3) break;
            resolved.push(c.id);
        }
    }
    return resolved.slice(0, 3);
}

// ─────────────────────────────────────────
// Calcular binderLevel desde XP
// XP necesaria por nivel: 200 * nivel^1.5
// ─────────────────────────────────────────

export function calcBinderLevel(xp: number): number {
    let level = 1;
    while (level < 40) {
        const xpNeeded = Math.floor(200 * Math.pow(level, 1.5));
        if (xp < xpNeeded) break;
        xp -= xpNeeded;
        level++;
    }
    return level;
}

// ─────────────────────────────────────────
// GET /sanctum/list — devuelve los 8 sanctums con estado del jugador
// ─────────────────────────────────────────

export async function getSanctumList(userId: string) {
    const trainer = await prisma.trainerProfile.findUnique({ where: { userId } });
    if (!trainer) throw new Error("Perfil de entrenador no encontrado");

    const binderLevel = calcBinderLevel(trainer.xp);
    const sanctumClears: number[] = trainer.sanctumClears.length === 8
        ? trainer.sanctumClears
        : [...trainer.sanctumClears, ...new Array(8 - trainer.sanctumClears.length).fill(0)];

    return SANCTUMS.map(s => ({
        id: s.id,
        name: s.name,
        affinity: s.affinity,
        guardian: s.guardian,
        requiredLevel: s.requiredLevel,
        unlocked: binderLevel >= s.requiredLevel,
        earned: (sanctumClears[s.id] ?? 0) > 0,
        clears: sanctumClears[s.id] ?? 0,
        xpReward: s.xpReward,
        goldReward: s.goldReward,
    }));
}

// ─────────────────────────────────────────
// POST /sanctum/challenge — retamos a un sanctum
// Devuelve battleId para que el cliente navegue a /battle
// Por ahora: simulación inmediata (aleatorizada) hasta implementar
// sistema de combat 1v1 Sanctum completo
// ─────────────────────────────────────────

export interface SanctumChallengeResult {
    sanctumId: number;
    result: "WIN" | "LOSE";
    xpGained: number;
    goldGained: number;
    newClears: number;
    newBinderLevel: number;
    sanctumName: string;
    guardian: string;
}

export async function challengeSanctum(
    userId: string,
    sanctumId: number,
    playerMythIds: string[]  // hasta 5 IDs de CreatureInstance del jugador
): Promise<SanctumChallengeResult> {
    // 1. Validaciones
    if (sanctumId < 0 || sanctumId > 7) throw new Error("Sanctum inválido");

    const config = SANCTUMS[sanctumId];

    const trainer = await prisma.trainerProfile.findUnique({ where: { userId } });
    if (!trainer) throw new Error("Perfil de entrenador no encontrado");

    const binderLevel = calcBinderLevel(trainer.xp);
    if (binderLevel < config.requiredLevel) {
        throw new Error(`Necesitas nivel ${config.requiredLevel} para retar este Sanctum (tu nivel: ${binderLevel})`);
    }

    // 2. Verificar que los myths pertenecen al jugador
    if (!playerMythIds || playerMythIds.length === 0) {
        throw new Error("Debes seleccionar al menos 1 Myth para retar el Sanctum");
    }
    if (playerMythIds.length > 5) {
        throw new Error("Solo puedes llevar hasta 5 Myths al Sanctum");
    }

    const playerMyths = await prisma.creatureInstance.findMany({
        where: { id: { in: playerMythIds }, userId },
    });
    if (playerMyths.length === 0) throw new Error("No se encontraron Myths válidos");

    // 3. Resolver los 3 myths del guardián
    const enemyIds = resolveEnemySpeciesIds(config);

    // 4. Simular las 3 rondas 1v1
    // Lógica simplificada: comparación de stats escaladas
    // TODO: integrar con battleService para combate real por turnos
    let playerWins = 0;
    let mythIndex = 0;  // índice del myth del jugador actual
    let changesLeft = 2; // máx 2 cambios en toda la run

    for (let round = 0; round < 3; round++) {
        if (mythIndex >= playerMyths.length) break;
        const playerMyth = playerMyths[mythIndex];
        const enemySpecies = getCreatureById(enemyIds[round]);

        if (!enemySpecies) { playerWins++; continue; }

        const scale = (base: number) => Math.floor(base * (1 + (config.enemyLevel - 1) * 0.08));

        const playerPower = playerMyth.attack + Math.floor(playerMyth.defense * 0.5) + playerMyth.speed;
        const enemyPower  = scale(enemySpecies.baseStats.atk) +
                            Math.floor(scale(enemySpecies.baseStats.def) * 0.5) +
                            scale(enemySpecies.baseStats.spd);

        // Factor nivel del jugador
        const levelFactor = playerMyth.level / config.enemyLevel;

        // Probabilidad de victoria basada en power ratio + algo de aleatoriedad
        const winChance = Math.min(0.85, Math.max(0.15,
            (playerPower * levelFactor) / (playerPower * levelFactor + enemyPower) + (Math.random() * 0.2 - 0.1)
        ));

        const roundResult = Math.random() < winChance;
        if (roundResult) {
            playerWins++;
        } else {
            // Si pierde el round y quedan cambios, avanza al siguiente myth
            if (changesLeft > 0 && mythIndex + 1 < playerMyths.length) {
                changesLeft--;
                mythIndex++;
                // Retry con el siguiente myth (cuenta como cambio)
                const retryMyth = playerMyths[mythIndex];
                const retryPower = retryMyth.attack + Math.floor(retryMyth.defense * 0.5) + retryMyth.speed;
                const retryChance = Math.min(0.80, Math.max(0.10,
                    (retryPower * (retryMyth.level / config.enemyLevel)) /
                    (retryPower * (retryMyth.level / config.enemyLevel) + enemyPower) +
                    (Math.random() * 0.2 - 0.1)
                ));
                if (Math.random() < retryChance) playerWins++;
            }
        }
    }

    const won = playerWins >= 2; // necesita ganar al menos 2 de 3 rondas

    // 5. Recompensas y actualización en BD
    const xpGained  = won ? config.xpReward : Math.floor(config.xpReward * 0.1);
    const goldGained = won ? config.goldReward : Math.floor(config.goldReward * 0.05);

    // Actualizar clears
    const currentClears: number[] = trainer.sanctumClears.length === 8
        ? [...trainer.sanctumClears]
        : [...trainer.sanctumClears, ...new Array(8 - trainer.sanctumClears.length).fill(0)];

    if (won) currentClears[sanctumId] = (currentClears[sanctumId] ?? 0) + 1;

    const newXp = trainer.xp + xpGained;
    const newBinderLevel = calcBinderLevel(newXp);

    await prisma.trainerProfile.update({
        where: { userId },
        data: {
            xp:           newXp,
            binderLevel:  newBinderLevel,
            gold:         { increment: goldGained },
            sanctumClears: currentClears,
        },
    });

    // Log de batalla
    const playerMyth = playerMyths[0];
    await prisma.battleLog.create({
        data: {
            userId,
            type: "NPC",
            result: won ? "WIN" : "LOSE",
            xpGained,
            coinsGained: goldGained,
            playerSpeciesId: playerMyth.speciesId,
            playerLevel:     playerMyth.level,
            enemySpeciesId:  enemyIds[0] ?? "000",
            enemyLevel:      config.enemyLevel,
        },
    });

    return {
        sanctumId,
        result:          won ? "WIN" : "LOSE",
        xpGained,
        goldGained,
        newClears:       currentClears[sanctumId] ?? 0,
        newBinderLevel,
        sanctumName:     config.name,
        guardian:        config.guardian,
    };
}
