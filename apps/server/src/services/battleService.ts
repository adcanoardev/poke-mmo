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

export type StatusEffect = "burn" | "poison" | "freeze" | "fear" | "paralyze" | "stun" | "curse" | null;

export type MoveType = "physical" | "special" | "support";

export type EffectType =
    | "apply_status" | "drain"
    | "boost_atk" | "boost_def" | "boost_spd" | "boost_acc"
    | "shield" | "heal" | "regen" | "counter" | "revive"
    | "debuff_atk" | "debuff_def" | "debuff_spd" | "debuff_acc"
    | "debuff_heal" | "silence" | "dispel" | "cleanse"
    // aliases legacy creatures.json
    | "buff_atk" | "buff_def";

export type EffectTarget = "self" | "enemy" | "all_enemies" | "ally" | "all_allies" | "all";

export interface MoveEffect {
    type: EffectType;
    target?: EffectTarget;
    value?: number;
    duration?: number;
    status?: StatusEffect;
    chance?: number; // 0-100; omitido = 100%
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
    effect: MoveEffect | MoveEffect[] | null;
}

export interface Buff {
    type: string;      // ej: "boost_atk", "debuff_def"
    stat?: "atk" | "def" | "spd" | "acc";
    multiplier: number; // >1 buff, <1 debuff
    turnsLeft: number;
    emoji: string;
    label: string;     // "⬆ATK", "⬇DEF", etc.
}

export interface BattleMyth {
    instanceId: string;
    speciesId: string;      // cambia tras cada distorsión (slug de la forma actual)
    baseSpeciesId: string;  // ID numérico original ("001"…"050") — NUNCA cambia
    name: string;
    level: number;
    hp: number;
    maxHp: number;
    attack: number;
    defense: number;
    speed: number;
    accuracy: number;
    critChance: number;
    critDamage: number;
    affinities: Affinity[];
    moves: Move[];
    art: { portrait: string; front: string; back: string };
    // Estado
    status: StatusEffect;
    statusTurnsLeft: number;         // turnos restantes del estado
    // Cooldowns: moveId → turnos restantes
    cooldownsLeft: Record<string, number>;
    // Buffs/debuffs activos
    buffs: Buff[];
    // Escudo: absorbe X daño antes de bajar HP
    shield: number;
    shieldTurns: number;  // turnos restantes del escudo (0 = sin escudo)
    // Regen: recupera X% HP al inicio de cada turno
    regenValue: number;   // % del maxHp
    regenTurns: number;
    // Counter: devuelve X% del daño recibido al atacante
    counterValue: number; // %
    counterTurns: number;
    // Silenciado: solo puede usar moves con cooldown base 0
    silenced: number;     // turnos restantes
    // Curse: al morir el maldito, el lanzador recupera X% HP
    cursedBy?: string;    // instanceId del lanzador
    curseHealPct: number;
    // debuff_heal: reduce efectividad de curas recibidas
    debuffHealPct: number;
    debuffHealTurns: number;
    // Turno en el que este Myth distorsiona (null si no hay distorsión pendiente)
    distortionTriggerTurn: number | null;
    // Turno en que empezó la forma actual (1 para la forma base, triggerTurn anterior tras distorsionar)
    distortionFormStartTurn: number;
    // Rareza de la siguiente forma de distorsión (null si es la forma final)
    nextFormRarity: string | null;
    // Rareza de la forma actual (se actualiza al distorsionar)
    rarity: string;
    // Altura del Myth en metros (0 = etéreo) — usado por getMythSpriteSize() en cliente
    height: number;
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

// Fórmula aditiva: stat_final = stat_base + stat_base * Σ(%buff)
// Los porcentajes de buff/debuff se suman (no se multiplican entre sí).
// Cada buff/debuff almacena su multiplier como (1 + val/100) o (1 - val/100).
// Convertimos a delta porcentual: (multiplier - 1), sumamos todos, cap ±50%, y aplicamos al base.
function sumBonusPct(buffs: Buff[], stat: string): number {
    let total = 0;
    for (const b of buffs) {
        if (b.stat === stat) total += b.multiplier - 1; // delta: +0.30 o -0.30
    }
    return Math.max(-0.5, Math.min(0.5, total)); // cap ±50%
}

function effectiveAtk(m: BattleMyth): number {
    const base = m.attack;
    const fearMod = m.status === "fear" ? -0.20 : 0;
    const buffPct = sumBonusPct(m.buffs, "atk");
    const total   = Math.max(-0.5, Math.min(0.5, buffPct + fearMod));
    return Math.max(1, Math.floor(base + base * total));
}

function effectiveDef(m: BattleMyth): number {
    const base = m.defense;
    const buffPct = sumBonusPct(m.buffs, "def");
    return Math.max(1, Math.floor(base + base * buffPct));
}

function effectiveAcc(m: BattleMyth): number {
    const fearMod = m.status === "fear" ? -0.20 : 0;
    const buffPct = sumBonusPct(m.buffs, "acc");
    const total   = Math.max(-0.5, Math.min(0.5, buffPct + fearMod));
    return Math.max(0.1, 1 + total);
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
    // Cola agotada mid-ronda por derrotas — reconstruir ahora
    const rebuilt = buildTurnQueue(session);
    if (rebuilt.length === 0) return null;
    session.turnQueue = rebuilt;
    session.currentQueueIndex = 0;
    const id = session.turnQueue[0];
    const myth = findMyth(session, id);
    return myth && !myth.defeated ? myth : null;
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
        tickSilence(m);
        tickCounter(m);
        tickDebuffHeal(m);
        // tickShield is called per-actor at end of each actor's turn, not per-round
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
    // Primero: move con cooldown 0 disponible (silencio fuerza cooldown base 0)
    const silenced = myth.silenced > 0;
    const available = myth.moves.filter(mv =>
        mv.type !== "support" &&
        mv.power > 0 &&
        !(myth.cooldownsLeft[mv.id] > 0) &&
        (!silenced || mv.cooldown === 0)
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

    const isCrit = Math.random() < attacker.critChance / 100;
    const isStab = attacker.affinities.includes(move.affinity);
    const mult = getAffinityMultiplier(move.affinity, defender.affinities);
    const stabMult = isStab ? 1.5 : 1;
    const critMult = isCrit ? attacker.critDamage / 100 : 1;

    // Burn reduce el ataque físico; special usa 90% ATK
    const atkMod = (attacker.status === "burn" && move.type === "physical") ? 0.5 : 1;
    const typeMod = move.type === "special" ? 0.9 : 1;

    const levelFactor = (2 * attacker.level) / 5 + 2;
    const atk = effectiveAtk(attacker) * atkMod * typeMod;
    const def = effectiveDef(defender);
    const baseDmg = (atk / def) * (move.power / 50) + 2;

    let dmg = Math.floor(levelFactor * baseDmg * stabMult * mult * critMult);

    const accMult = effectiveAcc(attacker);
    if (Math.random() > (move.accuracy / 100) * accMult) dmg = 0;

    return { damage: dmg, mult, crit: isCrit, stab: isStab };
}

// ─────────────────────────────────────────
// Estado alterado — puede bloquear el turno
// ─────────────────────────────────────────

// Retorna true si el Myth PUEDE actuar, false si el estado lo bloquea
function checkStatusBeforeAct(myth: BattleMyth): { canAct: boolean; statusMsg: string | null } {
    switch (myth.status) {
        case "freeze":
            if (Math.random() < 0.3) {
                myth.status = null;
                myth.statusTurnsLeft = 0;
                return { canAct: true, statusMsg: `${myth.name} se descongeló` };
            }
            return { canAct: false, statusMsg: `❄️ ${myth.name} está congelado y no puede actuar` };
        case "paralyze":
            if (Math.random() < 0.25) {
                return { canAct: false, statusMsg: `⚡ ${myth.name} está paralizado y no puede moverse` };
            }
            return { canAct: true, statusMsg: null };
        case "fear":
            if (Math.random() < 0.2) {
                return { canAct: false, statusMsg: `😨 ${myth.name} tiene miedo y no puede actuar` };
            }
            return { canAct: true, statusMsg: null };
        case "stun":
            // stun: pierde el turno seguro (1 turno, sin probabilidad)
            myth.status = null;
            myth.statusTurnsLeft = 0;
            return { canAct: false, statusMsg: `💫 ${myth.name} está aturdido y pierde su turno` };
        default:
            return { canAct: true, statusMsg: null };
    }
}

// Tick de daño por estado al FINAL del turno del Myth afectado
function applyStatusTick(myth: BattleMyth): { damage: number; msg: string } | null {
    switch (myth.status) {
        case "burn": {
            const burnDmg = Math.max(1, Math.floor(myth.maxHp * 0.0625));
            myth.hp = Math.max(0, myth.hp - burnDmg);
            if (myth.hp === 0) myth.defeated = true;
            return { damage: burnDmg, msg: `🔥 ${myth.name} sufre ${burnDmg} de daño por quemadura` };
        }
        case "poison": {
            const poisonDmg = Math.max(1, Math.floor(myth.maxHp * 0.08));
            myth.hp = Math.max(0, myth.hp - poisonDmg);
            if (myth.hp === 0) myth.defeated = true;
            return { damage: poisonDmg, msg: `☠️ ${myth.name} sufre ${poisonDmg} de daño por veneno` };
        }
        default:
            return null;
    }
}

// Tick de regen al INICIO del turno del Myth
function applyRegenTick(myth: BattleMyth, allMyths: BattleMyth[]): string | null {
    if (myth.regenTurns <= 0 || myth.defeated) return null;
    const healAmt = Math.max(1, Math.floor(myth.maxHp * myth.regenValue));
    myth.hp = Math.min(myth.maxHp, myth.hp + healAmt);
    myth.regenTurns--;
    if (myth.regenTurns <= 0) myth.regenValue = 0;
    return `♻️ ${myth.name} regenera ${healAmt} HP`;
}

// Tick de debuff_heal
function tickDebuffHeal(myth: BattleMyth): void {
    if (myth.debuffHealTurns > 0) {
        myth.debuffHealTurns--;
        if (myth.debuffHealTurns <= 0) myth.debuffHealPct = 0;
    }
}

// Tick de silencio
function tickSilence(myth: BattleMyth): void {
    if (myth.silenced > 0) myth.silenced--;
}

// Tick de counter
function tickCounter(myth: BattleMyth): void {
    if (myth.counterTurns > 0) myth.counterTurns--;
}

// Tick de escudo: decrementa turnos y lo limpia al expirar
function tickShield(myth: BattleMyth): void {
    if (myth.shieldTurns > 0) {
        myth.shieldTurns--;
        if (myth.shieldTurns <= 0) {
            myth.shield = 0;
            myth.shieldTurns = 0;
        }
    }
}

// Activar curse al morir: busca al lanzador y le devuelve HP
function applyCurseOnDeath(dead: BattleMyth, allMyths: BattleMyth[]): string | null {
    if (!dead.cursedBy || dead.curseHealPct <= 0) return null;
    const caster = allMyths.find(m => m.instanceId === dead.cursedBy && !m.defeated);
    if (!caster) return null;
    const healAmt = Math.max(1, Math.floor(dead.maxHp * dead.curseHealPct));
    caster.hp = Math.min(caster.maxHp, caster.hp + healAmt);
    return `💀 La maldición de ${dead.name} cura ${healAmt} HP a ${caster.name}`;
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
    shieldApplied?: number;
    areaTargetIds?: string[];   // IDs de todos los targets cuando el efecto es de área
    logMsgs: string[];
}

// Resuelve un solo efecto y lo aplica
function applySingleEffect(
    eff: MoveEffect,
    attacker: BattleMyth,
    target: BattleMyth,
    damageDealt: number,
    allMyths: BattleMyth[],
    playerTeam: BattleMyth[],
    moveAffinity?: Affinity
): Partial<EffectResult> {
    // Comprobar chance, con modificador de afinidad para apply_status
    let chance = eff.chance ?? 100;
    if (eff.type === "apply_status" && moveAffinity) {
        const affinityMult = getAffinityMultiplier(moveAffinity, target.affinities);
        if (affinityMult >= 2) chance *= 1.3;
        else if (affinityMult <= 0.5) chance *= 0.6;
        // neutro (1): sin cambio
    }
    if (Math.random() * 100 > chance) return {};

    const dur = eff.duration ?? 3;
    const val = eff.value ?? 25; // porcentaje por defecto

    // Resolver target
    const attackerIsPlayer = playerTeam.some(m => m.instanceId === attacker.instanceId);
    const resolveTarget = (t?: string): BattleMyth[] => {
        switch (t) {
            case "self": return [attacker];
            case "enemy": return [target];
            case "all_enemies": return attackerIsPlayer
                ? allMyths.filter(m => !playerTeam.some(p => p.instanceId === m.instanceId) && !m.defeated)
                : playerTeam.filter(m => !m.defeated);
            case "ally":
            case "all_allies": return attackerIsPlayer
                ? playerTeam.filter(m => !m.defeated)
                : allMyths.filter(m => !playerTeam.some(p => p.instanceId === m.instanceId) && !m.defeated);
            case "all": return allMyths.filter(m => !m.defeated);
            default: return [target];
        }
    };
    const isAreaTarget = (t?: string) => t === "all_enemies" || t === "all_allies" || t === "all";

    const statusIcons: Record<string, string> = {
        burn: "🔥", poison: "☠️", freeze: "❄️", fear: "😨", paralyze: "⚡", stun: "💫", curse: "💀"
    };
    const statusDurations: Record<string, number> = {
        burn: 4, poison: 5, freeze: 2, fear: 3, paralyze: 3, stun: 1, curse: 0
    };

    switch (eff.type) {
        // ── apply_status ───────────────────────────────────────────────────
        case "apply_status": {
            const st = eff.status ?? null;
            if (!st) return {};
            const tgts = resolveTarget(eff.target);
            const msgs: string[] = [];
            let applied: StatusEffect = null;
            for (const tgt of tgts) {
                if (tgt.status !== null) continue; // ya tiene estado
                if (st === "curse") {
                    tgt.cursedBy = attacker.instanceId;
                    tgt.curseHealPct = val / 100;
                    msgs.push(`💀 ${tgt.name} ha sido maldecido`);
                } else {
                    tgt.status = st;
                    tgt.statusTurnsLeft = statusDurations[st] ?? 3;
                    applied = st;
                    msgs.push(`${statusIcons[st] ?? "✨"} ${tgt.name} sufre ${st}`);
                }
            }
            const area = isAreaTarget(eff.target);
            return {
                statusApplied: applied ?? undefined,
                areaTargetIds: area ? tgts.map(t => t.instanceId) : undefined,
                logMsgs: msgs,
            };
        }
        // ── drain ──────────────────────────────────────────────────────────
        case "drain": {
            if (damageDealt <= 0) return {};
            const drainAmt = Math.min(
                Math.floor(damageDealt * 0.25),
                attacker.maxHp - attacker.hp
            );
            if (drainAmt <= 0) return {};
            attacker.hp = Math.min(attacker.maxHp, attacker.hp + drainAmt);
            return { drain: drainAmt, heal: drainAmt, logMsgs: [`💚 ${attacker.name} absorbe ${drainAmt} HP`] };
        }
        // ── heal ───────────────────────────────────────────────────────────
        case "heal": {
            const tgts = resolveTarget(eff.target ?? "self");
            const msgs: string[] = [];
            let total = 0;
            for (const tgt of tgts) {
                const eff_pct = tgt.debuffHealPct > 0 ? (1 - tgt.debuffHealPct) : 1;
                const amt = Math.max(1, Math.floor(tgt.maxHp * (val / 100) * eff_pct));
                tgt.hp = Math.min(tgt.maxHp, tgt.hp + amt);
                total += amt;
                msgs.push(`💚 ${tgt.name} recupera ${amt} HP`);
            }
            return { heal: total, logMsgs: msgs };
        }
        // ── regen ──────────────────────────────────────────────────────────
        case "regen": {
            const tgts = resolveTarget(eff.target ?? "self");
            for (const tgt of tgts) {
                tgt.regenValue = val / 100;
                tgt.regenTurns = dur;
            }
            return { logMsgs: [`♻️ ${tgts.map(t => t.name).join(", ")} con regeneración ${dur} turnos`] };
        }
        // ── shield ─────────────────────────────────────────────────────────
        case "shield": {
            const tgts = resolveTarget(eff.target ?? "self");
            let total = 0;
            for (const tgt of tgts) {
                const shieldAmt = Math.floor(tgt.maxHp * (val / 100));
                tgt.shield += shieldAmt;
                tgt.shieldTurns = 2;
                total += shieldAmt;
            }
            const area = isAreaTarget(eff.target ?? "self");
            return {
                shieldApplied: total,
                areaTargetIds: area ? tgts.map(t => t.instanceId) : undefined,
                logMsgs: [`🛡️ ${tgts.map(t => t.name).join(", ")} con escudo ${total}`],
            };
        }
        // ── counter ────────────────────────────────────────────────────────
        case "counter": {
            const tgts = resolveTarget(eff.target ?? "self");
            for (const tgt of tgts) {
                tgt.counterValue = val / 100;
                tgt.counterTurns = dur;
            }
            return { logMsgs: [`↩️ ${tgts.map(t => t.name).join(", ")} con reflejo de daño ${dur} turnos`] };
        }
        // ── revive ─────────────────────────────────────────────────────────
        case "revive": {
            const fallen = allMyths.find(m => m.defeated && m !== attacker);
            if (!fallen) return {};
            const reviveHp = Math.max(1, Math.floor(fallen.maxHp * (val / 100)));
            fallen.hp = reviveHp;
            fallen.defeated = false;
            return { heal: reviveHp, logMsgs: [`✨ ${fallen.name} revive con ${reviveHp} HP`] };
        }
        // ── silence ────────────────────────────────────────────────────────
        case "silence": {
            const tgts = resolveTarget(eff.target ?? "enemy");
            for (const tgt of tgts) tgt.silenced = dur;
            return { logMsgs: [`🔇 ${tgts.map(t => t.name).join(", ")} silenciado ${dur} turnos`] };
        }
        // ── debuff_heal ────────────────────────────────────────────────────
        case "debuff_heal": {
            const tgts = resolveTarget(eff.target ?? "enemy");
            for (const tgt of tgts) {
                tgt.debuffHealPct = val / 100;
                tgt.debuffHealTurns = dur;
            }
            return { logMsgs: [`✂️ Curas de ${tgts.map(t => t.name).join(", ")} reducidas ${dur} turnos`] };
        }
        // ── BUFFS (boost_*) — máx 1 del mismo tipo por aliado ──────────────
        case "boost_atk":
        case "buff_atk": {
            const tgts = resolveTarget(eff.target ?? "self");
            const buff: Buff = { type: "boost_atk", stat: "atk", multiplier: 1 + val / 100, turnsLeft: dur, emoji: "⬆", label: "⬆ATK" };
            for (const tgt of tgts) {
                tgt.buffs = tgt.buffs.filter(b => b.type !== "boost_atk" && b.type !== "buff_atk");
                tgt.buffs.push({ ...buff });
            }
            const area = isAreaTarget(eff.target ?? "self");
            return { buffApplied: buff, areaTargetIds: area ? tgts.map(t => t.instanceId) : undefined, logMsgs: [`⬆ATK ${tgts.map(t => t.name).join(", ")} +${val}% ATK`] };
        }
        case "boost_def":
        case "buff_def": {
            const tgts = resolveTarget(eff.target ?? "self");
            const buff: Buff = { type: "boost_def", stat: "def", multiplier: 1 + val / 100, turnsLeft: dur, emoji: "⬆", label: "⬆DEF" };
            for (const tgt of tgts) {
                tgt.buffs = tgt.buffs.filter(b => b.type !== "boost_def" && b.type !== "buff_def");
                tgt.buffs.push({ ...buff });
            }
            const area = isAreaTarget(eff.target ?? "self");
            return { buffApplied: buff, areaTargetIds: area ? tgts.map(t => t.instanceId) : undefined, logMsgs: [`⬆DEF ${tgts.map(t => t.name).join(", ")} +${val}% DEF`] };
        }
        case "boost_spd": {
            const tgts = resolveTarget(eff.target ?? "self");
            const buff: Buff = { type: "boost_spd", stat: "spd", multiplier: 1 + val / 100, turnsLeft: dur, emoji: "⬆", label: "⬆SPD" };
            for (const tgt of tgts) {
                tgt.buffs = tgt.buffs.filter(b => b.type !== "boost_spd");
                tgt.buffs.push({ ...buff });
            }
            const area = isAreaTarget(eff.target ?? "self");
            return { buffApplied: buff, areaTargetIds: area ? tgts.map(t => t.instanceId) : undefined, logMsgs: [`⬆SPD ${tgts.map(t => t.name).join(", ")} +${val}% SPD`] };
        }
        case "boost_acc": {
            const tgts = resolveTarget(eff.target ?? "self");
            const buff: Buff = { type: "boost_acc", stat: "acc", multiplier: 1 + val / 100, turnsLeft: dur, emoji: "⬆", label: "⬆ACC" };
            for (const tgt of tgts) {
                tgt.buffs = tgt.buffs.filter(b => b.type !== "boost_acc");
                tgt.buffs.push({ ...buff });
            }
            const area = isAreaTarget(eff.target ?? "self");
            return { buffApplied: buff, areaTargetIds: area ? tgts.map(t => t.instanceId) : undefined, logMsgs: [`⬆ACC ${tgts.map(t => t.name).join(", ")} +${val}% ACC`] };
        }
        // ── DEBUFFS (debuff_*) — máx 1 del mismo tipo por target ─────────────
        // El debuff siempre calcula su multiplier sobre el stat BASE (val es % fijo del stat base).
        // El cap ±50% se aplica en calcDamage al combinar todos los multiplicadores activos.
        // Si ya hay un debuff del mismo tipo: reemplaza (no acumula), excepto poison (hasta 3 stacks).
        case "debuff_atk": {
            const tgts = resolveTarget(eff.target ?? "enemy");
            const buff: Buff = { type: "debuff_atk", stat: "atk", multiplier: 1 - val / 100, turnsLeft: dur, emoji: "⬇", label: "⬇ATK" };
            for (const tgt of tgts) {
                tgt.buffs = tgt.buffs.filter(b => b.type !== "debuff_atk");
                tgt.buffs.push({ ...buff });
            }
            const area = isAreaTarget(eff.target ?? "enemy");
            return { buffApplied: buff, areaTargetIds: area ? tgts.map(t => t.instanceId) : undefined, logMsgs: [`⬇ATK ${tgts.map(t => t.name).join(", ")} -${val}% ATK`] };
        }
        case "debuff_def": {
            const tgts = resolveTarget(eff.target ?? "enemy");
            const buff: Buff = { type: "debuff_def", stat: "def", multiplier: 1 - val / 100, turnsLeft: dur, emoji: "⬇", label: "⬇DEF" };
            for (const tgt of tgts) {
                tgt.buffs = tgt.buffs.filter(b => b.type !== "debuff_def");
                tgt.buffs.push({ ...buff });
            }
            const area = isAreaTarget(eff.target ?? "enemy");
            return { buffApplied: buff, areaTargetIds: area ? tgts.map(t => t.instanceId) : undefined, logMsgs: [`⬇DEF ${tgts.map(t => t.name).join(", ")} -${val}% DEF`] };
        }
        case "debuff_spd": {
            const tgts = resolveTarget(eff.target ?? "enemy");
            const buff: Buff = { type: "debuff_spd", stat: "spd", multiplier: 1 - val / 100, turnsLeft: dur, emoji: "⬇", label: "⬇SPD" };
            for (const tgt of tgts) {
                tgt.buffs = tgt.buffs.filter(b => b.type !== "debuff_spd");
                tgt.buffs.push({ ...buff });
            }
            const area = isAreaTarget(eff.target ?? "enemy");
            return { buffApplied: buff, areaTargetIds: area ? tgts.map(t => t.instanceId) : undefined, logMsgs: [`⬇SPD ${tgts.map(t => t.name).join(", ")} -${val}% SPD`] };
        }
        case "debuff_acc": {
            const tgts = resolveTarget(eff.target ?? "enemy");
            const buff: Buff = { type: "debuff_acc", stat: "acc", multiplier: 1 - val / 100, turnsLeft: dur, emoji: "⬇", label: "⬇ACC" };
            for (const tgt of tgts) {
                tgt.buffs = tgt.buffs.filter(b => b.type !== "debuff_acc");
                tgt.buffs.push({ ...buff });
            }
            const area = isAreaTarget(eff.target ?? "enemy");
            return { buffApplied: buff, areaTargetIds: area ? tgts.map(t => t.instanceId) : undefined, logMsgs: [`⬇ACC ${tgts.map(t => t.name).join(", ")} -${val}% ACC`] };
        }
        // ── dispel ─────────────────────────────────────────────────────────
        case "dispel": {
            // Elimina todos los buffs activos del/los objetivos (enemigos)
            const tgts = resolveTarget(eff.target ?? "all_enemies");
            const msgs: string[] = [];
            for (const tgt of tgts) {
                const hadBuffs = tgt.buffs.some(b => b.multiplier > 1);
                tgt.buffs = tgt.buffs.filter(b => b.multiplier <= 1); // elimina solo buffs positivos
                if (hadBuffs) msgs.push(`✨ Buffs de ${tgt.name} eliminados`);
            }
            return { logMsgs: msgs };
        }
        // ── cleanse ────────────────────────────────────────────────────────
        case "cleanse": {
            // Limpia estado negativo y debuffs activos del/los aliados
            const tgts = resolveTarget(eff.target ?? "self");
            const msgs: string[] = [];
            for (const tgt of tgts) {
                const hadStatus = tgt.status !== null;
                const hadDebuffs = tgt.buffs.some(b => b.multiplier < 1);
                tgt.status = null;
                tgt.statusTurnsLeft = 0;
                tgt.buffs = tgt.buffs.filter(b => b.multiplier >= 1); // elimina solo debuffs
                if (hadStatus || hadDebuffs) msgs.push(`🌿 ${tgt.name} purificado`);
            }
            return { logMsgs: msgs };
        }
    }
    return {};
}

// Wrapper: soporta effect como objeto o array
function applyMoveEffect(
    attacker: BattleMyth,
    move: Move,
    target: BattleMyth,
    damageDealt: number,
    allMyths: BattleMyth[],
    playerTeam: BattleMyth[]
): EffectResult | null {
    if (!move.effect) return null;
    const effects = Array.isArray(move.effect) ? move.effect : [move.effect];
    const result: EffectResult = { logMsgs: [] };
    for (const eff of effects) {
        const r = applySingleEffect(eff, attacker, target, damageDealt, allMyths, playerTeam, move.affinity);
        if (r.heal) result.heal = (result.heal ?? 0) + r.heal;
        if (r.statusApplied) result.statusApplied = r.statusApplied;
        if (r.buffApplied) result.buffApplied = r.buffApplied;
        if (r.drain) result.drain = r.drain;
        if (r.shieldApplied) result.shieldApplied = r.shieldApplied;
        if (r.areaTargetIds?.length) result.areaTargetIds = r.areaTargetIds;
        if (r.logMsgs) result.logMsgs.push(...r.logMsgs);
    }
    return result.logMsgs.length > 0 ? result : null;
}

// ─────────────────────────────────────────
// NPC AI
// ─────────────────────────────────────────

function npcChooseMove(attacker: BattleMyth, target: BattleMyth): Move {
    const silenced = attacker.silenced > 0;
    const available = attacker.moves.filter(mv =>
        !(attacker.cooldownsLeft[mv.id] > 0) &&
        (!silenced || mv.cooldown === 0)
    );
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

    // Primer triggerTurn de distorsión de esta especie (null si no tiene)
    const firstDistortion = (species as any).distortion?.[0] ?? null;
    const secondDistortion = (species as any).distortion?.[1] ?? null;
    const distortionTriggerTurn: number | null = firstDistortion?.triggerTurn ?? null;

    return {
        instanceId: inst.id,
        speciesId: inst.speciesId,
        baseSpeciesId: inst.speciesId,
        name: species.name,
        level: inst.level,
        hp: inst.hp,
        maxHp: inst.maxHp,
        attack: inst.attack,
        defense: inst.defense,
        speed: inst.speed,
        accuracy:   inst.accuracy   ?? 100,
        critChance: inst.critChance ?? 15,
        critDamage: inst.critDamage ?? 150,
        affinities: species.affinities as Affinity[],
        moves: species.moves as Move[],
        art: species.art,
        status: null,
        statusTurnsLeft: 0,
        cooldownsLeft: {},
        buffs: [],
        shield: 0,
        shieldTurns: 0,
        regenValue: 0,
        regenTurns: 0,
        counterValue: 0,
        counterTurns: 0,
        silenced: 0,
        curseHealPct: 0,
        debuffHealPct: 0,
        debuffHealTurns: 0,
        distortionTriggerTurn,
        distortionFormStartTurn: 1,
        nextFormRarity: firstDistortion?.rarity ?? null,
        rarity: (species as any).rarity ?? "COMMON",
        height: (species as any).height ?? 1.0,
        defeated: false,
    };
}

function buildNpcMyth(speciesId: string, level: number): BattleMyth {
    const species = getCreature(speciesId);
    if (!species) throw new Error(`Especie NPC no encontrada: ${speciesId}`);

    const scale = (base: number) => Math.floor(base * (1 + (level - 1) * 0.08));

    const firstDistortion = (species as any).distortion?.[0] ?? null;
    const distortionTriggerTurn: number | null = firstDistortion?.triggerTurn ?? null;

    return {
        instanceId: `npc_${speciesId}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        speciesId,
        baseSpeciesId: speciesId,
        name: species.name,
        level,
        hp: scale(species.baseStats.hp * 2 + 10),
        maxHp: scale(species.baseStats.hp * 2 + 10),
        attack: scale(species.baseStats.atk),
        defense: scale(species.baseStats.def),
        speed: scale(species.baseStats.spd),
        accuracy:   species.baseStats.acc   ?? 100,
        critChance: species.baseStats.critChance ?? 15,
        critDamage: species.baseStats.critDamage ?? 150,
        affinities: species.affinities as Affinity[],
        moves: species.moves as Move[],
        art: species.art,
        status: null,
        statusTurnsLeft: 0,
        cooldownsLeft: {},
        buffs: [],
        shield: 0,
        shieldTurns: 0,
        regenValue: 0,
        regenTurns: 0,
        counterValue: 0,
        counterTurns: 0,
        silenced: 0,
        curseHealPct: 0,
        debuffHealPct: 0,
        debuffHealTurns: 0,
        distortionTriggerTurn,
        distortionFormStartTurn: 1,
        nextFormRarity: firstDistortion?.rarity ?? null,
        rarity: (species as any).rarity ?? "COMMON",
        height: (species as any).height ?? 1.0,
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
        turn: 1,
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
    // Escudo aplicado
    shieldApplied?: number;
    // IDs de todos los targets en moves de área (all_enemies / all_allies / all)
    allTargetInstanceIds?: string[];
    // Mensajes de efectos (array)
    effectMsgs?: string[];
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
    // true cuando el actor del jugador distorsionó este turno — el move NO se ejecutó,
    // el frontend debe mostrar el overlay y devolver el control al jugador
    distorted?: boolean;
}

// ─────────────────────────────────────────
// DISTORSIÓN — transformación automática
// ─────────────────────────────────────────

function applyDistortion(myth: BattleMyth, currentTurn: number): string | null {
    // ⚠️ Nunca distorsionar un myth derrotado — un golpe letal no puede ser anulado por la distorsión
    if (myth.defeated || myth.hp <= 0) return null;

    const species = (creaturesData as any[]).find(c => c.id === myth.baseSpeciesId);
    if (!species?.distortion?.length) return null;

    // Buscar la forma de distorsión que se activa en este turno exacto
    const form = species.distortion.find((d: any) => d.triggerTurn === currentTurn);
    if (!form) return null;

    // Guardar cooldowns actuales por moveId antes de transformar
    const oldCooldowns = { ...myth.cooldownsLeft };

    // IDs de los moves que se heredan (Slot 0 siempre, Slot 1 en D2 si existe en D1)
    const oldMoveIds = myth.moves.map((mv: Move) => mv.id);

    // Escalar stats base de la nueva forma por nivel del Myth
    const scale = (base: number) => Math.floor(base * (1 + (myth.level - 1) * 0.08));
    const bs = form.baseStats;

    // HP: heredar porcentaje — floor sin clamp a 1, el guard defeated ya protege el caso hp=0
    const hpPct = myth.maxHp > 0 ? myth.hp / myth.maxHp : 1;
    const newMaxHp = scale(bs.hp * 2 + 10);
    myth.hp = Math.floor(newMaxHp * hpPct);
    myth.maxHp = newMaxHp;

    myth.name = form.name;
    myth.speciesId = form.slug;
    myth.affinities = form.affinities as Affinity[];
    myth.rarity = form.rarity ?? myth.rarity;
    myth.height = form.height ?? myth.height;
    myth.attack = scale(bs.atk);
    myth.defense = scale(bs.def);
    myth.speed = scale(bs.spd);
    myth.critChance = bs.critChance ?? myth.critChance;
    myth.critDamage = bs.critDamage ?? myth.critDamage;
    myth.moves = form.moves as Move[];
    myth.art = {
        portrait: `https://cdn.jsdelivr.net/gh/adcanoardev/mythara-assets@main/myths/${species.id}/${form.slug}_portrait.png`,
        front:    `https://cdn.jsdelivr.net/gh/adcanoardev/mythara-assets@main/myths/${species.id}/${form.slug}_front.png`,
        back:     `https://cdn.jsdelivr.net/gh/adcanoardev/mythara-assets@main/myths/${species.id}/${form.slug}_back.png`,
    };

    // Reconstruir cooldownsLeft: transferir cooldowns de moves heredados
    const newCooldowns: Record<string, number> = {};
    for (const newMove of myth.moves) {
        // Si el nuevo move tiene el mismo id que uno viejo → hereda su cooldown
        if (oldMoveIds.includes(newMove.id) && oldCooldowns[newMove.id]) {
            newCooldowns[newMove.id] = oldCooldowns[newMove.id];
        }
    }
    myth.cooldownsLeft = newCooldowns;

    // Actualizar el trigger al siguiente form de distorsión (si existe), o null
    const distortionForms = species.distortion as any[];
    const currentFormIndex = distortionForms.findIndex((d: any) => d.triggerTurn === currentTurn);
    const nextForm = distortionForms[currentFormIndex + 1] ?? null;
    myth.distortionTriggerTurn = nextForm?.triggerTurn ?? null;
    // El inicio de la nueva forma es el turno actual (justo después de distorsionar)
    myth.distortionFormStartTurn = currentTurn;
    myth.nextFormRarity = nextForm?.rarity ?? null;

    return `🌀 ¡${myth.name} ha distorsionado!`;
}

// ─────────────────────────────────────────
// BEGIN TURN — llamado por el frontend al inicio del turno del jugador
// Resuelve distorsión ANTES de que el jugador elija move
// ─────────────────────────────────────────

export interface BeginTurnResult {
    session: BattleSession3v3;
    distorted: boolean;
    distortionMsg?: string;
    actorInstanceId: string;
    actorName: string;
}

export async function beginTurn(userId: string, battleId: string): Promise<BeginTurnResult> {
    const session = getSession3v3(battleId);
    if (!session || session.userId !== userId) throw new Error("Sesión no encontrada");
    if (session.status !== "ongoing") throw new Error("El combate ya ha finalizado");

    const actor = getCurrentActor(session);
    if (!actor) throw new Error("No hay actor en la cola");

    const actorIsPlayer = isPlayerMyth(session, actor.instanceId);
    if (!actorIsPlayer) {
        // No es turno del jugador — no hacer nada
        return { session, distorted: false, actorInstanceId: actor.instanceId, actorName: actor.name };
    }

    // Comprobar distorsión antes de que el jugador elija
    const distortionMsg = applyDistortion(actor, session.turn);
    if (distortionMsg) {
        setSession(session);
        return {
            session,
            distorted: true,
            distortionMsg,
            actorInstanceId: actor.instanceId,
            actorName: actor.name,
        };
    }

    return { session, distorted: false, actorInstanceId: actor.instanceId, actorName: actor.name };
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
        const silenced = actor.silenced > 0;
        const chosen = actor.moves.find(mv => mv.id === moveId);
        // Si está silenciado y el move elegido tiene cooldown base > 0, forzar básico
        if (chosen && silenced && chosen.cooldown > 0) {
            move = getBasicMove(actor);
        } else {
            move = chosen ?? getBasicMove(actor);
        }
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

    // ── Distorsión del NPC: comprobar trigger al inicio del turno ──
    // (Para el jugador, la distorsión ya se resolvió en beginTurn antes de elegir move)
    if (!actorIsPlayer) {
        const distortionMsg = applyDistortion(actor, session.turn);
        if (distortionMsg) {
            action.actorName = actor.name;
            action.effectMsgs = [distortionMsg];
            // NPC sigue ejecutando con los moves de la nueva forma
        }
    }

    // Regen tick al inicio del turno
    const regenMsg = applyRegenTick(actor, [...session.playerTeam, ...session.enemyTeam]);
    if (regenMsg) action.effectMsgs = [regenMsg];

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
            let dmgLeft = dmgResult.damage;
            // Escudo absorbe primero
            if (target.shield > 0) {
                const absorbed = Math.min(target.shield, dmgLeft);
                target.shield -= absorbed;
                dmgLeft -= absorbed;
            }
            target.hp = Math.max(0, target.hp - dmgLeft);
            if (target.hp === 0) target.defeated = true;
            // Counter: devuelve daño al atacante
            if (target.counterTurns > 0 && target.counterValue > 0 && !target.defeated) {
                const counterDmg = Math.max(1, Math.floor(dmgResult.damage * target.counterValue));
                actor.hp = Math.max(0, actor.hp - counterDmg);
                if (actor.hp === 0) actor.defeated = true;
            }
        }

        // ── Aplicar efecto del move ──
        const allMyths = [...session.playerTeam, ...session.enemyTeam];
        const effectRes = applyMoveEffect(actor, move, target, dmgResult.damage, allMyths, session.playerTeam);
        if (effectRes) {
            if (effectRes.statusApplied) action.statusApplied = effectRes.statusApplied;
            if (effectRes.buffApplied) action.buffApplied = effectRes.buffApplied;
            if (effectRes.heal) action.healAmount = effectRes.heal;
            if (effectRes.shieldApplied) action.shieldApplied = effectRes.shieldApplied;
            if (effectRes.areaTargetIds?.length) action.allTargetInstanceIds = effectRes.areaTargetIds;
            if (effectRes.logMsgs?.length) action.effectMsgs = effectRes.logMsgs;
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
    tickShield(actor); // shield decrements once per actor turn, not per round

    // ── Recopilar derrotados + activar curse ──
    const allMythsFlat = [...session.playerTeam, ...session.enemyTeam];
    for (const m of allMythsFlat) {
        if (m.defeated && !defeated.includes(m.instanceId)) {
            defeated.push(m.instanceId);
            const curseMsg = applyCurseOnDeath(m, allMythsFlat);
            if (curseMsg) {
                if (!action.effectMsgs) action.effectMsgs = [];
                action.effectMsgs.push(curseMsg);
            }
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
