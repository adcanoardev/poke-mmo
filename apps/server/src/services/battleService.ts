import { prisma } from "./prisma.js";
import { createBattleSession, getSession, getUserSession, deleteSession } from "./battleStore.js";
import { getCreature } from "./creatureService.js";
import { addXp } from "./trainerService.js";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type Affinity =
    | "EMBER" | "TIDE" | "GROVE" | "VOLT" | "STONE"
    | "FROST" | "VENOM" | "ASTRAL" | "IRON" | "SHADE";

export interface Move {
    id: string;
    name: string;
    affinity: Affinity;
    power: number;
    accuracy: number;
    description: string;
}

export interface BattleMyth {
    instanceId: string;
    speciesId: string;
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    affinities: Affinity[];
    moves: Move[];
    art: { portrait: string; front: string; back: string };
    status: null | "poisoned" | "burned" | "stunned";
    defeated: boolean;
}

export interface BattleSession3v3 {
    battleId: string;
    userId: string;
    playerTeam: BattleMyth[];
    enemyTeam: BattleMyth[];
    turn: number;
    status: "ongoing" | "win" | "lose";
    createdAt: number;
    lastAccessedAt: number;
}

// ─────────────────────────────────────────
// Session store 3v3 (independiente del battleStore legacy)
// ─────────────────────────────────────────

const TTL_MS = 1000 * 60 * 30;
const sessions = new Map<string, BattleSession3v3>();

function setSession(s: BattleSession3v3) {
    sessions.set(s.battleId, s);
}

function getSession3v3(battleId: string): BattleSession3v3 | undefined {
    const s = sessions.get(battleId);
    if (!s) return undefined;
    s.lastAccessedAt = Date.now();
    return s;
}

function deleteSession3v3(battleId: string) {
    sessions.delete(battleId);
}

function evict() {
    const now = Date.now();
    for (const [id, s] of sessions) {
        if (now - s.lastAccessedAt > TTL_MS) sessions.delete(id);
    }
}

function makeBattleId(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length: 18 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ─────────────────────────────────────────
// Affinity chart
// ─────────────────────────────────────────

export const AFFINITY_CHART: Record<Affinity, Partial<Record<Affinity, number>>> = {
    EMBER: { GROVE: 2, FROST: 2, TIDE: 0.5, STONE: 0.5, EMBER: 0.5 },
    TIDE: { EMBER: 2, STONE: 2, VOLT: 0.5, GROVE: 0.5, TIDE: 0.5 },
    GROVE: { TIDE: 2, STONE: 2, EMBER: 0.5, VENOM: 0.5, GROVE: 0.5 },
    VOLT: { TIDE: 2, IRON: 2, GROVE: 0.5, STONE: 0.5, VOLT: 0.5 },
    STONE: { EMBER: 2, VOLT: 2, GROVE: 0.5, TIDE: 0.5, STONE: 0.5 },
    FROST: { GROVE: 2, ASTRAL: 2, EMBER: 0.5, IRON: 0.5, FROST: 0.5 },
    VENOM: { GROVE: 2, ASTRAL: 2, STONE: 0.5, IRON: 0.5, VENOM: 0.5 },
    ASTRAL: { SHADE: 2, VENOM: 0.5, ASTRAL: 0.5 },
    IRON: { FROST: 2, STONE: 2, EMBER: 0.5, IRON: 0.5 },
    SHADE: { ASTRAL: 2, VENOM: 2, SHADE: 0.5 },
};

export function getAffinityMultiplier(moveAffinity: Affinity, defenderAffinities: Affinity[]): number {
    let mult = 1;
    for (const a of defenderAffinities) {
        mult *= AFFINITY_CHART[moveAffinity]?.[a] ?? 1;
    }
    return mult;
}

// ─────────────────────────────────────────
// Damage formula
// ─────────────────────────────────────────

function calcDamage(
    attacker: BattleMyth,
    move: Move,
    defender: BattleMyth
): { damage: number; mult: number; crit: boolean; stab: boolean } {
    const isCrit = Math.random() < 0.0625;
    const isStab = attacker.affinities.includes(move.affinity);
    const mult = getAffinityMultiplier(move.affinity, defender.affinities);
    const stabMult = isStab ? 1.5 : 1;
    const critMult = isCrit ? 1.5 : 1;

    let dmg = Math.floor(
        ((2 * attacker.level) / 5 + 2) *
        move.power *
        (attacker.attack / defender.defense / 50 + 2) *
        stabMult *
        mult *
        critMult
    );
    if (Math.random() > move.accuracy / 100) dmg = 0;
    return { damage: dmg, mult, crit: isCrit, stab: isStab };
}

// ─────────────────────────────────────────
// Build BattleMyth helpers
// ─────────────────────────────────────────

async function buildPlayerMyth(instanceId: string, userId: string): Promise<BattleMyth> {
    const inst = await prisma.creatureInstance.findFirst({
        where: { id: instanceId, userId },
    });
    if (!inst) throw new Error(`Myth ${instanceId} no pertenece al jugador`);

    const species = getCreature(inst.speciesId);
    if (!species) throw new Error(`Especie no encontrada: ${inst.speciesId}`);

    return {
        instanceId: inst.id,
        speciesId: inst.speciesId,
        name: species.name,
        level: inst.level,
        hp: inst.hp,
        maxHp: inst.maxHp,
        attack: inst.attack,
        defense: inst.defense,
        speed: inst.speed,
        affinities: species.affinities as Affinity[],
        moves: species.moves as Move[],
        art: species.art,
        status: null,
        defeated: false,
    };
}

function buildNpcMyth(speciesId: string, level: number): BattleMyth {
    const species = getCreature(speciesId);
    if (!species) throw new Error(`Especie NPC no encontrada: ${speciesId}`);

    const scale = (base: number) => Math.floor(base * (1 + (level - 1) * 0.08));

    return {
        instanceId: `npc_${speciesId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        speciesId,
        name: species.name,
        level,
        hp: scale(species.baseStats.hp * 2 + 10),
        maxHp: scale(species.baseStats.hp * 2 + 10),
        attack: scale(species.baseStats.atk),
        defense: scale(species.baseStats.def),
        speed: scale(species.baseStats.spd),
        affinities: species.affinities as Affinity[],
        moves: species.moves as Move[],
        art: species.art,
        status: null,
        defeated: false,
    };
}

// ─────────────────────────────────────────
// NPC AI
// ─────────────────────────────────────────

function npcChooseMove(attacker: BattleMyth, target: BattleMyth): Move {
    let best: Move = attacker.moves[0];
    let bestScore = -1;
    for (const move of attacker.moves) {
        const mult = getAffinityMultiplier(move.affinity, target.affinities);
        const stab = attacker.affinities.includes(move.affinity) ? 1.5 : 1;
        const score = move.power * mult * stab;
        if (score > bestScore) { bestScore = score; best = move; }
    }
    return best;
}

function npcFastestAlive(team: BattleMyth[]): BattleMyth | null {
    return team.filter((m) => !m.defeated).sort((a, b) => b.speed - a.speed)[0] ?? null;
}

// ─────────────────────────────────────────
// START
// ─────────────────────────────────────────

export async function startNpcBattle(
    userId: string,
    order: string[]
): Promise<BattleSession3v3> {
    evict();

    // Consumir ficha NPC
    const tokenRow = await prisma.combatToken.findUnique({ where: { userId } });
    if (!tokenRow || tokenRow.npcTokens <= 0) throw new Error("Sin fichas NPC disponibles");

    await prisma.combatToken.update({
        where: { userId },
        data: { npcTokens: { decrement: 1 } },
    });

    // Construir equipo del jugador (máx 3)
    const playerTeam: BattleMyth[] = [];
    for (const id of order.slice(0, 3)) {
        playerTeam.push(await buildPlayerMyth(id, userId));
    }
    if (playerTeam.length === 0) throw new Error("Necesitas al menos 1 Myth en el equipo");

    // Nivel medio del equipo del jugador
    const avgLevel = Math.round(
        playerTeam.reduce((s, m) => s + m.level, 0) / playerTeam.length
    );
    const enemyLevel = Math.max(1, Math.floor(avgLevel * (0.9 + Math.random() * 0.3)));

    // Equipo NPC — mismo número que el jugador (nunca >doble)
    const enemyCount = Math.min(playerTeam.length, 3);
    const creatures = (await import("../data/creatures.json", { assert: { type: "json" } })).default as any[];
    const pool = creatures
        .filter((c) => c.id && Array.isArray(c.moves) && c.moves.length >= 1)
        .sort(() => Math.random() - 0.5)
        .slice(0, enemyCount);

    const enemyTeam: BattleMyth[] = pool.map((c) => buildNpcMyth(c.id, enemyLevel));

    const session: BattleSession3v3 = {
        battleId: makeBattleId(),
        userId,
        playerTeam,
        enemyTeam,
        turn: 0,
        status: "ongoing",
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
    };

    setSession(session);
    return session;
}

// ─────────────────────────────────────────
// TURN
// ─────────────────────────────────────────

export interface TurnResult {
    session: BattleSession3v3;
    playerAction: {
        myth: string;
        move: string;
        moveAffinity: Affinity;
        target: string;
        damage: number;
        mult: number;
        crit: boolean;
        stab: boolean;
    };
    npcAction: {
        myth: string;
        move: string;
        moveAffinity: Affinity;
        target: string;
        damage: number;
        mult: number;
        crit: boolean;
        stab: boolean;
    };
    defeated: string[];
    xpGained?: number;
    coinsGained?: number;
}

export async function executeTurn(
    userId: string,
    battleId: string,
    actingMythId: string,
    moveId: string,
    targetMythId?: string   // opcional — si no viene, primer vivo
): Promise<TurnResult> {
    const session = getSession3v3(battleId);
    if (!session || session.userId !== userId) throw new Error("Sesión de combate no encontrada");
    if (session.status !== "ongoing") throw new Error("El combate ya ha finalizado");

    // ── Myth del jugador ──
    const playerMyth = session.playerTeam.find(
        (m) => m.instanceId === actingMythId && !m.defeated
    );
    if (!playerMyth) throw new Error("Myth del jugador no válido o ya derrotado");

    const playerMove = playerMyth.moves.find((mv) => mv.id === moveId);
    if (!playerMove) throw new Error("Move no válido");

    // ── Objetivo del jugador (el que seleccionó, o primero vivo) ──
    const playerTarget =
        (targetMythId
            ? session.enemyTeam.find((m) => m.instanceId === targetMythId && !m.defeated)
            : undefined) ?? session.enemyTeam.find((m) => !m.defeated);
    if (!playerTarget) throw new Error("No hay Myths enemigos disponibles");

    // ── IA NPC: Myth más rápido vivo ataca al primero vivo del jugador ──
    const npcAttacker = npcFastestAlive(session.enemyTeam);
    if (!npcAttacker) throw new Error("No hay Myths enemigos vivos");

    const npcTarget = session.playerTeam.find((m) => !m.defeated);
    if (!npcTarget) throw new Error("No hay Myths del jugador vivos");

    const npcMove = npcChooseMove(npcAttacker, npcTarget);

    // ── Resolución simultánea ──
    const playerResult = calcDamage(playerMyth, playerMove, playerTarget);
    const npcResult = calcDamage(npcAttacker, npcMove, npcTarget);

    playerTarget.hp = Math.max(0, playerTarget.hp - playerResult.damage);
    npcTarget.hp = Math.max(0, npcTarget.hp - npcResult.damage);

    if (playerTarget.hp === 0) playerTarget.defeated = true;
    if (npcTarget.hp === 0) npcTarget.defeated = true;

    const defeated: string[] = [];
    if (playerTarget.defeated) defeated.push(playerTarget.instanceId);
    if (npcTarget.defeated && npcTarget.instanceId !== playerTarget.instanceId)
        defeated.push(npcTarget.instanceId);

    session.turn += 1;

    // ── Comprobar fin de combate ──
    const allEnemyDefeated = session.enemyTeam.every((m) => m.defeated);
    const allPlayerDefeated = session.playerTeam.every((m) => m.defeated);

    let xpGained: number | undefined;
    let coinsGained: number | undefined;

    if (allEnemyDefeated || allPlayerDefeated) {
        session.status = allEnemyDefeated ? "win" : "lose";

        if (session.status === "win") {
            const avgEnemyLevel = Math.round(
                session.enemyTeam.reduce((s, m) => s + m.level, 0) / session.enemyTeam.length
            );
            xpGained = Math.floor(50 * Math.pow(avgEnemyLevel, 1.4));
            coinsGained = Math.floor(avgEnemyLevel * 5 + Math.random() * 20);

            await addXp(userId, xpGained);
            await prisma.trainerProfile.update({
                where: { userId },
                data: { coins: { increment: coinsGained } },
            });
            await prisma.battleLog.create({
                data: {
                    userId,
                    type: "NPC",
                    result: "WIN",
                    xpGained: xpGained ?? 0,
                    coinsGained: coinsGained ?? 0,
                    playerSpeciesId: playerMyth.speciesId,
                    playerLevel: playerMyth.level,
                    enemySpeciesId: playerTarget.speciesId,
                    enemyLevel: playerTarget.level,
                },
            });
        }

        deleteSession3v3(battleId);
    } else {
        setSession(session);
    }

    return {
        session,
        playerAction: {
            myth: playerMyth.name,
            move: playerMove.name,
            moveAffinity: playerMove.affinity,
            target: playerTarget.name,
            damage: playerResult.damage,
            mult: playerResult.mult,
            crit: playerResult.crit,
            stab: playerResult.stab,
        },
        npcAction: {
            myth: npcAttacker.name,
            move: npcMove.name,
            moveAffinity: npcMove.affinity,
            target: npcTarget.name,
            damage: npcResult.damage,
            mult: npcResult.mult,
            crit: npcResult.crit,
            stab: npcResult.stab,
        },
        defeated,
        xpGained,
        coinsGained,
    };
}

// ─────────────────────────────────────────
// FLEE
// ─────────────────────────────────────────

export async function fleeBattle(userId: string, battleId: string): Promise<void> {
    const session = getSession3v3(battleId);
    if (!session || session.userId !== userId) throw new Error("Sesión no encontrada");
    session.status = "lose";
    deleteSession3v3(battleId);
}

// ─────────────────────────────────────────
// CAPTURE
// ─────────────────────────────────────────

export interface CaptureResult {
    success: boolean;
    session: BattleSession3v3;
    counterDamage?: number;
    newInstanceId?: string;
}

export async function captureMyth(
    userId: string,
    battleId: string,
    targetMythId: string
): Promise<CaptureResult> {
    const session = getSession3v3(battleId);
    if (!session || session.userId !== userId) throw new Error("Sesión no encontrada");
    if (session.status !== "ongoing") throw new Error("El combate ya ha finalizado");

    const target = session.enemyTeam.find(
        (m) => m.instanceId === targetMythId && !m.defeated
    );
    if (!target) throw new Error("Objetivo no válido o ya derrotado");

    if (target.hp / target.maxHp >= 0.25)
        throw new Error("El Myth debe tener menos del 25% de HP para capturarlo");

    const success = Math.random() < 0.6;

    if (success) {
        const newInst = await prisma.creatureInstance.create({
            data: {
                userId,
                speciesId: target.speciesId,
                level: target.level,
                xp: 0,
                hp: target.maxHp,
                maxHp: target.maxHp,
                attack: target.attack,
                defense: target.defense,
                speed: target.speed,
                isInParty: false,
                slot: null,
            },
        });

        target.defeated = true;

        await prisma.battleLog.create({
            data: {
                userId,
                type: "NPC",
                result: "WIN",
                xpGained: 0,
                coinsGained: 0,
                playerSpeciesId: session.playerTeam[0]?.speciesId ?? "000",
                playerLevel: session.playerTeam[0]?.level ?? 1,
                enemySpeciesId: target.speciesId,
                enemyLevel: target.level,
                capturedSpeciesId: target.speciesId,
            },
        });
        if (session.enemyTeam.every((m) => m.defeated)) {
            session.status = "win";
            deleteSession3v3(battleId);
        } else {
            setSession(session);
        }

        return { success: true, session, newInstanceId: newInst.id };

    } else {
        // Fallo: recupera 15% HP y contraataca
        target.hp = Math.min(target.maxHp, Math.floor(target.hp + target.maxHp * 0.15));

        const playerTarget = session.playerTeam.find((m) => !m.defeated);
        let counterDamage = 0;

        if (playerTarget) {
            const counterMove = npcChooseMove(target, playerTarget);
            const res = calcDamage(target, counterMove, playerTarget);
            counterDamage = res.damage;
            playerTarget.hp = Math.max(0, playerTarget.hp - counterDamage);
            if (playerTarget.hp === 0) {
                playerTarget.defeated = true;
                if (session.playerTeam.every((m) => m.defeated)) {
                    session.status = "lose";
                    deleteSession3v3(battleId);
                    return { success: false, session, counterDamage };
                }
            }
        }

        setSession(session);
        return { success: false, session, counterDamage };
    }
}

// ─────────────────────────────────────────
// GET ACTIVE BATTLE
// ─────────────────────────────────────────

export function getActiveBattle(userId: string): BattleSession3v3 | null {
    for (const s of sessions.values()) {
        if (s.userId === userId && s.status === "ongoing") return s;
    }
    return null;
}

// ─────────────────────────────────────────
// MYTH XP (compatibilidad)
// ─────────────────────────────────────────

export async function addMythXp(instanceId: string, xpAmount: number): Promise<void> {
    const inst = await prisma.creatureInstance.findUniqueOrThrow({ where: { id: instanceId } });
    let { xp, level } = inst;
    xp += xpAmount;
    const xpNeeded = () => Math.floor(50 * Math.pow(level, 1.6));
    while (xp >= xpNeeded() && level < 60) {
        xp -= xpNeeded();
        level++;
    }
    const multiplier = level - inst.level;
    await prisma.creatureInstance.update({
        where: { id: instanceId },
        data: {
            xp,
            level,
            maxHp: Math.floor(inst.maxHp * Math.pow(1.08, multiplier)),
            hp: Math.floor(inst.maxHp * Math.pow(1.08, multiplier)),
            attack: Math.floor(inst.attack * Math.pow(1.05, multiplier)),
            defense: Math.floor(inst.defense * Math.pow(1.05, multiplier)),
            speed: Math.floor(inst.speed * Math.pow(1.04, multiplier)),
        },
    });
}