import { prisma } from "./prisma.js";
import { getCreature } from "./creatureService.js";
import { addXp } from "./trainerService.js";
import creaturesData from "../data/creatures.json" with { type: "json" };
import { useNpcToken } from "./tokenService.js";

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export type Affinity =
    | "EMBER" | "TIDE" | "GROVE" | "VOLT" | "STONE"
    | "FROST" | "VENOM" | "ASTRAL" | "IRON" | "SHADE";

export type StatusEffect = "burn" | "poison" | "freeze" | "fear" | "paralyze" | null;

export type MoveType = "physical" | "special" | "support";

export interface MoveEffect {
    type: "apply_status" | "drain" | "buff_atk" | "buff_def" | "heal";
    status?: StatusEffect;
    target?: "enemy" | "self";
    value?: number;
}

export interface Move {
    id: string;
    name: string;
    affinity: Affinity;
    type: MoveType;
    power: number;
    accuracy: number;
    cooldown: number;
    description: string;
    effect: MoveEffect | null;
}

export interface Buff {
    stat: "atk" | "def" | "spd";
    multiplier: number;
    turnsLeft: number;
    emoji: string;
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
    // Estado
    status: StatusEffect;
    statusTurnsLeft: number;         // turnos restantes del estado
    // Cooldowns: moveId → turnos restantes
    cooldownsLeft: Record<string, number>;
    // Buffs activos
    buffs: Buff[];
    defeated: boolean;
}

export interface BattleSession3v3 {
    battleId: string;
    userId: string;
    playerTeam: BattleMyth[];
    enemyTeam: BattleMyth[];
    turn: number;
    // Cola de instanceIds ordenada por SPD, reconstruida cada ronda
    turnQueue: string[];
    // Índice del actor actual en turnQueue
    currentQueueIndex: number;
    status: "ongoing" | "win" | "lose";
    createdAt: number;
    lastAccessedAt: number;
}

// ─────────────────────────────────────────
// Store interno
// ─────────────────────────────────────────

const TTL_MS = 1000 * 60 * 30;
const sessions = new Map<string, BattleSession3v3>();

function setSession(s: BattleSession3v3) { sessions.set(s.battleId, s); }

function getSession3v3(battleId: string): BattleSession3v3 | undefined {
    const s = sessions.get(battleId);
    if (!s) return undefined;
    s.lastAccessedAt = Date.now();
    return s;
}

function deleteSession3v3(battleId: string) { sessions.delete(battleId); }

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
    TIDE:  { EMBER: 2, STONE: 2, VOLT: 0.5, GROVE: 0.5, TIDE: 0.5 },
    GROVE: { TIDE: 2, STONE: 2, EMBER: 0.5, VENOM: 0.5, GROVE: 0.5 },
    VOLT:  { TIDE: 2, IRON: 2, GROVE: 0.5, STONE: 0.5, VOLT: 0.5 },
    STONE: { EMBER: 2, VOLT: 2, GROVE: 0.5, TIDE: 0.5, STONE: 0.5 },
    FROST: { GROVE: 2, ASTRAL: 2, EMBER: 0.5, IRON: 0.5, FROST: 0.5 },
    VENOM: { GROVE: 2, ASTRAL: 2, STONE: 0.5, IRON: 0.5, VENOM: 0.5 },
    ASTRAL:{ SHADE: 2, VENOM: 0.5, ASTRAL: 0.5 },
    IRON:  { FROST: 2, STONE: 2, EMBER: 0.5, IRON: 0.5 },
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
// Cola de turnos por SPD
// ─────────────────────────────────────────

function buildTurnQueue(session: BattleSession3v3): string[] {
    const all = [...session.playerTeam, ...session.enemyTeam]
        .filter(m => !m.defeated)
        .sort((a, b) => effectiveSpeed(b) - effectiveSpeed(a));
    return all.map(m => m.instanceId);
}

function effectiveSpeed(m: BattleMyth): number {
    let spd = m.speed;
    for (const b of m.buffs) {
        if (b.stat === "spd") spd = Math.floor(spd * b.multiplier);
    }
    // Paralyze y freeze reducen efectivamente la velocidad para el orden
    if (m.status === "paralyze" || m.status === "freeze") spd = Math.floor(spd * 0.5);
    return spd;
}

function effectiveAtk(m: BattleMyth): number {
    let atk = m.attack;
    for (const b of m.buffs) {
        if (b.stat === "atk") atk = Math.floor(atk * b.multiplier);
    }
    return atk;
}

function effectiveDef(m: BattleMyth): number {
    let def = m.defense;
    for (const b of m.buffs) {
        if (b.stat === "def") def = Math.floor(def * b.multiplier);
    }
    return def;
}

// Obtener el Myth que debe actuar ahora
export function getCurrentActor(session: BattleSession3v3): BattleMyth | null {
    // Avanzar en la cola saltando derrotados
    while (session.currentQueueIndex < session.turnQueue.length) {
        const id = session.turnQueue[session.currentQueueIndex];
        const myth = findMyth(session, id);
        if (myth && !myth.defeated) return myth;
        session.currentQueueIndex++;
    }
    return null;
}

function advanceQueue(session: BattleSession3v3): void {
    session.currentQueueIndex++;
    // Si hemos consumido toda la cola, reconstruir para la siguiente ronda
    if (session.currentQueueIndex >= session.turnQueue.length) {
        session.turnQueue = buildTurnQueue(session);
        session.currentQueueIndex = 0;
        session.turn++;
        // Decrementar cooldowns al inicio de cada ronda
        decrementCooldowns(session);
        // Tick de buffs
        tickBuffs(session);
    }
}

function decrementCooldowns(session: BattleSession3v3): void {
    for (const m of [...session.playerTeam, ...session.enemyTeam]) {
        for (const moveId of Object.keys(m.cooldownsLeft)) {
            if (m.cooldownsLeft[moveId] > 0) m.cooldownsLeft[moveId]--;
            if (m.cooldownsLeft[moveId] <= 0) delete m.cooldownsLeft[moveId];
        }
    }
}

function tickBuffs(session: BattleSession3v3): void {
    for (const m of [...session.playerTeam, ...session.enemyTeam]) {
        m.buffs = m.buffs
            .map(b => ({ ...b, turnsLeft: b.turnsLeft - 1 }))
            .filter(b => b.turnsLeft > 0);
    }
}

function findMyth(session: BattleSession3v3, instanceId: string): BattleMyth | undefined {
    return [...session.playerTeam, ...session.enemyTeam].find(m => m.instanceId === instanceId);
}

function isPlayerMyth(session: BattleSession3v3, instanceId: string): boolean {
    return session.playerTeam.some(m => m.instanceId === instanceId);
}

// ─────────────────────────────────────────
// Move básico (fallback timer)
// ─────────────────────────────────────────

function getBasicMove(myth: BattleMyth): Move {
    // Primero: move con cooldown 0 disponible
    const available = myth.moves.filter(mv =>
        mv.type !== "support" &&
        mv.power > 0 &&
        !(myth.cooldownsLeft[mv.id] > 0)
    );
    if (available.length > 0) {
        return available.reduce((a, b) => (a.cooldown <= b.cooldown ? a : b));
    }
    // Fallback: cualquier move con power > 0
    const anyDmg = myth.moves.find(mv => mv.power > 0);
    return anyDmg ?? myth.moves[0];
}

// ─────────────────────────────────────────
// Damage formula
// ─────────────────────────────────────────

function calcDamage(
    attacker: BattleMyth,
    move: Move,
    defender: BattleMyth
): { damage: number; mult: number; crit: boolean; stab: boolean } {
    if (move.type === "support" || move.power === 0) {
        return { damage: 0, mult: 1, crit: false, stab: false };
    }

    const isCrit = Math.random() < 0.0625;
    const isStab = attacker.affinities.includes(move.affinity);
    const mult = getAffinityMultiplier(move.affinity, defender.affinities);
    const stabMult = isStab ? 1.5 : 1;
    const critMult = isCrit ? 1.5 : 1;

    // Burn reduce el ataque físico
    const atkMod = (attacker.status === "burn" && move.type === "physical") ? 0.5 : 1;

    const levelFactor = (2 * attacker.level) / 5 + 2;
    const atk = effectiveAtk(attacker) * atkMod;
    const def = effectiveDef(defender);
    const baseDmg = (atk / def) * (move.power / 50) + 2;

    let dmg = Math.floor(levelFactor * baseDmg * stabMult * mult * critMult);

    if (Math.random() > move.accuracy / 100) dmg = 0;

    return { damage: dmg, mult, crit: isCrit, stab: isStab };
}

// ─────────────────────────────────────────
// Estado alterado — puede bloquear el turno
// ─────────────────────────────────────────

// Retorna true si el Myth PUEDE actuar, false si el estado lo bloquea
function checkStatusBeforeAct(myth: BattleMyth): { canAct: boolean; statusMsg: string | null } {
    switch (myth.status) {
        case "freeze":
            // 30% de probabilidad de descongelarse
            if (Math.random() < 0.3) {
                myth.status = null;
                myth.statusTurnsLeft = 0;
                return { canAct: true, statusMsg: `${myth.name} se ha descongelado` };
            }
            return { canAct: false, statusMsg: `${myth.name} está congelado y no puede actuar` };
        case "paralyze":
            // 25% de probabilidad de quedar paralizado este turno
            if (Math.random() < 0.25) {
                return { canAct: false, statusMsg: `${myth.name} está paralizado y no puede moverse` };
            }
            return { canAct: true, statusMsg: null };
        case "fear":
            // 20% de probabilidad de no poder actuar
            if (Math.random() < 0.2) {
                return { canAct: false, statusMsg: `${myth.name} tiene miedo y no puede actuar` };
            }
            return { canAct: true, statusMsg: null };
        default:
            return { canAct: true, statusMsg: null };
    }
}

// Tick de daño por estado al FINAL del turno del Myth afectado
function applyStatusTick(myth: BattleMyth): { damage: number; msg: string } | null {
    switch (myth.status) {
        case "burn":
            const burnDmg = Math.max(1, Math.floor(myth.maxHp * 0.0625));
            myth.hp = Math.max(0, myth.hp - burnDmg);
            if (myth.hp === 0) myth.defeated = true;
            return { damage: burnDmg, msg: `🔥 ${myth.name} sufre ${burnDmg} de daño por quemadura` };
        case "poison":
            const poisonDmg = Math.max(1, Math.floor(myth.maxHp * 0.08));
            myth.hp = Math.max(0, myth.hp - poisonDmg);
            if (myth.hp === 0) myth.defeated = true;
            return { damage: poisonDmg, msg: `☠️ ${myth.name} sufre ${poisonDmg} de daño por veneno` };
        default:
            return null;
    }
}

// Decrementar turnos de estado
function tickStatus(myth: BattleMyth): void {
    if (myth.status && myth.statusTurnsLeft > 0) {
        myth.statusTurnsLeft--;
        if (myth.statusTurnsLeft <= 0) {
            myth.status = null;
            myth.statusTurnsLeft = 0;
        }
    }
}

// ─────────────────────────────────────────
// Aplicar efecto del move (support / drain / buff)
// ─────────────────────────────────────────

interface EffectResult {
    heal?: number;
    statusApplied?: StatusEffect;
    buffApplied?: Buff;
    drain?: number;
    logMsg: string;
}

function applyMoveEffect(
    attacker: BattleMyth,
    move: Move,
    target: BattleMyth,
    damageDealt: number
): EffectResult | null {
    if (!move.effect) return null;

    const { effect } = move;

    switch (effect.type) {
        case "apply_status": {
            const statusTarget = effect.target === "self" ? attacker : target;
            if (statusTarget.status !== null) return null; // ya tiene estado
            const status = effect.status ?? null;
            statusTarget.status = status;
            // Duración por estado
            const durations: Record<string, number> = {
                burn: 4, poison: 6, freeze: 3, fear: 3, paralyze: 5
            };
            statusTarget.statusTurnsLeft = status ? (durations[status] ?? 3) : 0;

            const icons: Record<string, string> = {
                burn: "🔥", poison: "☠️", freeze: "❄️", fear: "😨", paralyze: "⚡"
            };
            const icon = status ? (icons[status] ?? "✨") : "";
            return {
                statusApplied: status,
                logMsg: `${icon} ${statusTarget.name} está ahora ${status}`
            };
        }
        case "drain": {
            if (damageDealt <= 0) return null;
            const maxDrain = Math.floor(damageDealt * 0.25); // capado al 25%
            const drainAmt = Math.min(maxDrain, attacker.maxHp - attacker.hp);
            if (drainAmt <= 0) return null;
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + drainAmt);
            return {
                drain: drainAmt,
                heal: drainAmt,
                logMsg: `💚 ${attacker.name} absorbe ${drainAmt} HP`
            };
        }
        case "buff_atk": {
            const buff: Buff = { stat: "atk", multiplier: effect.value ?? 1.5, turnsLeft: 3, emoji: "⬆️" };
            attacker.buffs.push(buff);
            return { buffApplied: buff, logMsg: `⬆️ ¡ATK de ${attacker.name} aumentó!` };
        }
        case "buff_def": {
            const buff: Buff = { stat: "def", multiplier: effect.value ?? 1.5, turnsLeft: 3, emoji: "🛡️" };
            attacker.buffs.push(buff);
            return { buffApplied: buff, logMsg: `🛡️ ¡DEF de ${attacker.name} aumentó!` };
        }
        case "heal": {
            const healAmt = Math.floor(attacker.maxHp * (effect.value ?? 0.25));
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + healAmt);
            return { heal: healAmt, logMsg: `💚 ${attacker.name} recupera ${healAmt} HP` };
        }
    }
    return null;
}

// ─────────────────────────────────────────
// NPC AI
// ─────────────────────────────────────────

function npcChooseMove(attacker: BattleMyth, target: BattleMyth): Move {
    const available = attacker.moves.filter(mv => !(attacker.cooldownsLeft[mv.id] > 0));
    if (available.length === 0) return getBasicMove(attacker);

    let best: Move = available[0];
    let bestScore = -1;

    for (const move of available) {
        let score: number;
        if (move.type === "support") {
            // Usar support si el enemigo no tiene estado
            score = target.status === null ? move.accuracy * 0.8 : -1;
        } else {
            const mult = getAffinityMultiplier(move.affinity, target.affinities);
            const stab = attacker.affinities.includes(move.affinity) ? 1.5 : 1;
            score = move.power * mult * stab;
        }
        if (score > bestScore) { bestScore = score; best = move; }
    }
    return best;
}

function npcChooseTarget(attacker: BattleMyth, enemies: BattleMyth[]): BattleMyth {
    const alive = enemies.filter(m => !m.defeated);
    if (alive.length === 0) throw new Error("No hay enemigos vivos");
    // Elige al que tenga menos HP (más cerca de caer)
    return alive.reduce((a, b) => (a.hp / a.maxHp <= b.hp / b.maxHp ? a : b));
}

// ─────────────────────────────────────────
// Build BattleMyth helpers
// ─────────────────────────────────────────

async function buildPlayerMyth(instanceId: string, userId: string): Promise<BattleMyth> {
    const inst = await prisma.creatureInstance.findFirst({ where: { id: instanceId, userId } });
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
        statusTurnsLeft: 0,
        cooldownsLeft: {},
        buffs: [],
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
        statusTurnsLeft: 0,
        cooldownsLeft: {},
        buffs: [],
        defeated: false,
    };
}

// ─────────────────────────────────────────
// START
// ─────────────────────────────────────────

export async function startNpcBattle(userId: string, order: string[]): Promise<BattleSession3v3> {
    evict();

    const tokenUsed = await useNpcToken(userId);
    if (!tokenUsed) throw new Error("Sin fichas NPC disponibles");

    const playerTeam: BattleMyth[] = [];
    for (const id of order.slice(0, 3)) {
        playerTeam.push(await buildPlayerMyth(id, userId));
    }
    if (playerTeam.length === 0) throw new Error("Necesitas al menos 1 Myth en el equipo");

    const avgLevel = Math.round(playerTeam.reduce((s, m) => s + m.level, 0) / playerTeam.length);
    const enemyLevel = Math.max(1, Math.floor(avgLevel * (0.9 + Math.random() * 0.3)));
    const enemyCount = Math.min(playerTeam.length, 3);
    const creatures = creaturesData as any[];
    const pool = creatures
        .filter(c => c.id && Array.isArray(c.moves) && c.moves.length >= 1)
        .sort(() => Math.random() - 0.5)
        .slice(0, enemyCount);

    const enemyTeam: BattleMyth[] = pool.map(c => buildNpcMyth(c.id, enemyLevel));

    const session: BattleSession3v3 = {
        battleId: makeBattleId(),
        userId,
        playerTeam,
        enemyTeam,
        turn: 0,
        turnQueue: [],
        currentQueueIndex: 0,
        status: "ongoing",
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
    };

    // Construir la cola inicial
    session.turnQueue = buildTurnQueue(session);

    setSession(session);
    return session;
}

// ─────────────────────────────────────────
// TURN RESULT TYPE
// ─────────────────────────────────────────

export interface TurnAction {
    actorInstanceId: string;
    actorName: string;
    isPlayerMyth: boolean;
    move: string;
    moveAffinity: Affinity;
    moveType: MoveType;
    targetName: string;
    targetInstanceId: string;
    damage: number;
    mult: number;
    crit: boolean;
    stab: boolean;
    missed: boolean;
    // Estado alterado
    statusApplied?: StatusEffect;
    // Tick de estado (al final del turno)
    statusTickDamage?: number;
    statusTickMsg?: string;
    // Buff
    buffApplied?: Buff;
    // Drain / heal
    healAmount?: number;
    // Bloqueado por estado (no pudo actuar)
    blockedByStatus?: string;
}

export interface TurnResult {
    session: BattleSession3v3;
    action: TurnAction;
    // instanceId del próximo actor (para que el frontend sepa si es del jugador)
    nextActorId: string | null;
    nextActorIsPlayer: boolean;
    defeated: string[];
    xpGained?: number;
    coinsGained?: number;
}

// ─────────────────────────────────────────
// EXECUTE TURN
// ─────────────────────────────────────────

export async function executeTurn(
    userId: string,
    battleId: string,
    moveId: string,
    targetMythId?: string
): Promise<TurnResult> {
    const session = getSession3v3(battleId);
    if (!session || session.userId !== userId) throw new Error("Sesión de combate no encontrada");
    if (session.status !== "ongoing") throw new Error("El combate ya ha finalizado");

    // ── Actor actual ──
    const actor = getCurrentActor(session);
    if (!actor) throw new Error("No hay actor en la cola");

    const actorIsPlayer = isPlayerMyth(session, actor.instanceId);

    // ── Elegir move ──
    let move: Move;
    if (actorIsPlayer) {
        // El jugador elige el move (o moveId viene del timer = básico)
        move = actor.moves.find(mv => mv.id === moveId) ?? getBasicMove(actor);
    } else {
        // NPC: IA elige el move (ignora moveId del body)
        const playerAlive = session.playerTeam.filter(m => !m.defeated);
        const npcTarget = npcChooseTarget(actor, playerAlive);
        move = npcChooseMove(actor, npcTarget);
    }

    // Verificar cooldown
    if (actor.cooldownsLeft[move.id] > 0) {
        move = getBasicMove(actor);
    }

    // ── Verificar si el estado bloquea la acción ──
    const statusCheck = checkStatusBeforeAct(actor);
    const action: TurnAction = {
        actorInstanceId: actor.instanceId,
        actorName: actor.name,
        isPlayerMyth: actorIsPlayer,
        move: move.name,
        moveAffinity: move.affinity,
        moveType: move.type,
        targetName: "",
        targetInstanceId: "",
        damage: 0,
        mult: 1,
        crit: false,
        stab: false,
        missed: false,
    };

    const defeated: string[] = [];

    if (!statusCheck.canAct) {
        action.blockedByStatus = statusCheck.statusMsg ?? undefined;
    } else {
        // ── Elegir objetivo ──
        let target: BattleMyth;
        if (actorIsPlayer) {
            const enemies = session.enemyTeam.filter(m => !m.defeated);
            if (enemies.length === 0) throw new Error("No hay enemigos vivos");
            target = enemies.find(m => m.instanceId === targetMythId) ?? enemies[0];
        } else {
            const playerAlive = session.playerTeam.filter(m => !m.defeated);
            if (playerAlive.length === 0) throw new Error("No hay Myths del jugador vivos");
            target = npcChooseTarget(actor, playerAlive);
        }

        action.targetName = target.name;
        action.targetInstanceId = target.instanceId;

        // ── Calcular y aplicar daño ──
        const dmgResult = calcDamage(actor, move, target);
        action.damage = dmgResult.damage;
        action.mult = dmgResult.mult;
        action.crit = dmgResult.crit;
        action.stab = dmgResult.stab;
        action.missed = dmgResult.damage === 0 && move.accuracy < 100;

        if (dmgResult.damage > 0) {
            target.hp = Math.max(0, target.hp - dmgResult.damage);
            if (target.hp === 0) target.defeated = true;
        }

        // ── Aplicar efecto del move ──
        const effectRes = applyMoveEffect(actor, move, target, dmgResult.damage);
        if (effectRes) {
            if (effectRes.statusApplied) action.statusApplied = effectRes.statusApplied;
            if (effectRes.buffApplied) action.buffApplied = effectRes.buffApplied;
            if (effectRes.heal) action.healAmount = effectRes.heal;
        }

        // ── Registrar cooldown del move ──
        if (move.cooldown > 0) {
            actor.cooldownsLeft[move.id] = move.cooldown;
        }
    }

    // ── Tick de estado al final del turno del actor ──
    const tick = applyStatusTick(actor);
    if (tick) {
        action.statusTickDamage = tick.damage;
        action.statusTickMsg = tick.msg;
    }
    tickStatus(actor);

    // ── Recopilar derrotados ──
    for (const m of [...session.playerTeam, ...session.enemyTeam]) {
        if (m.defeated && !defeated.includes(m.instanceId)) {
            defeated.push(m.instanceId);
        }
    }

    // ── Comprobar fin de combate ──
    const allEnemyDefeated = session.enemyTeam.every(m => m.defeated);
    const allPlayerDefeated = session.playerTeam.every(m => m.defeated);

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
                    playerSpeciesId: session.playerTeam[0]?.speciesId ?? "000",
                    playerLevel: session.playerTeam[0]?.level ?? 1,
                    enemySpeciesId: session.enemyTeam[0]?.speciesId ?? "000",
                    enemyLevel: session.enemyTeam[0]?.level ?? 1,
                },
            });
        }

        deleteSession3v3(battleId);
        return { session, action, nextActorId: null, nextActorIsPlayer: false, defeated, xpGained, coinsGained };
    }

    // ── Avanzar cola ──
    advanceQueue(session);
    setSession(session);

    // ── Siguiente actor ──
    const nextActor = getCurrentActor(session);
    const nextIsPlayer = nextActor ? isPlayerMyth(session, nextActor.instanceId) : false;

    return {
        session,
        action,
        nextActorId: nextActor?.instanceId ?? null,
        nextActorIsPlayer: nextIsPlayer,
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

    const target = session.enemyTeam.find(m => m.instanceId === targetMythId && !m.defeated);
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

        if (session.enemyTeam.every(m => m.defeated)) {
            session.status = "win";
            deleteSession3v3(battleId);
        } else {
            // Reconstruir cola sin el capturado
            session.turnQueue = buildTurnQueue(session);
            session.currentQueueIndex = 0;
            setSession(session);
        }

        return { success: true, session, newInstanceId: newInst.id };

    } else {
        target.hp = Math.min(target.maxHp, Math.floor(target.hp + target.maxHp * 0.15));

        const playerTarget = session.playerTeam.find(m => !m.defeated);
        let counterDamage = 0;

        if (playerTarget) {
            const counterMove = npcChooseMove(target, playerTarget);
            const res = calcDamage(target, counterMove, playerTarget);
            counterDamage = res.damage;
            playerTarget.hp = Math.max(0, playerTarget.hp - counterDamage);
            if (playerTarget.hp === 0) {
                playerTarget.defeated = true;
                if (session.playerTeam.every(m => m.defeated)) {
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
// MYTH XP
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
            xp, level,
            maxHp: Math.floor(inst.maxHp * Math.pow(1.08, multiplier)),
            hp: Math.floor(inst.maxHp * Math.pow(1.08, multiplier)),
            attack: Math.floor(inst.attack * Math.pow(1.05, multiplier)),
            defense: Math.floor(inst.defense * Math.pow(1.05, multiplier)),
            speed: Math.floor(inst.speed * Math.pow(1.04, multiplier)),
        },
    });
}
