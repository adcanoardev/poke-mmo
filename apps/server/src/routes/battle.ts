import { prisma } from "../services/prisma.js";
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
    startNpcBattle,
    executeTurn,
    fleeBattle,
    captureMyth,
    getActiveBattle,
} from "../services/battleService.js";
import { getCreature } from "../services/creatureService.js";
const router = Router();
router.use(requireAuth);
// POST /battle/npc/start
router.post("/battle/npc/start", async (req, res) => {
    try {
        const { order } = req.body as { order: string[] };
        if (!Array.isArray(order) || order.length === 0) {
            return res.status(400).json({ error: "order debe ser un array con 1-3 IDs" });
        }
        const session = await startNpcBattle(req.user!.userId, order);
        res.json(session);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});
// POST /battle/npc/turn
router.post("/battle/npc/turn", async (req, res) => {
    try {
        const { battleId, moveId, targetMythId } = req.body as {
            battleId: string;
            moveId: string;
            targetMythId?: string;
        };
        const result = await executeTurn(req.user!.userId, battleId, moveId, targetMythId);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});
// POST /battle/npc/flee
router.post("/battle/npc/flee", async (req, res) => {
    try {
        const { battleId } = req.body as { battleId: string };
        await fleeBattle(req.user!.userId, battleId);
        res.json({ status: "fled" });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});
// POST /battle/npc/capture
router.post("/battle/npc/capture", async (req, res) => {
    try {
        const { battleId, targetMythId } = req.body as {
            battleId: string;
            targetMythId: string;
        };
        const result = await captureMyth(req.user!.userId, battleId, targetMythId);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});
// GET /battle/npc/active
router.get("/battle/npc/active", (req, res) => {
    const session = getActiveBattle(req.user!.userId);
    res.json(session ?? null);
});
// GET /battle/stats
router.get("/battle/stats", async (req: any, res) => {
    try {
        const userId = req.user!.userId;
        const [wins, losses, captures, allInstances] = await Promise.all([
            prisma.battleLog.count({ where: { userId, type: "NPC", result: "WIN" } }),
            prisma.battleLog.count({ where: { userId, type: "NPC", result: "LOSE" } }),
            prisma.battleLog.count({ where: { userId, capturedSpeciesId: { not: null } } }),
            prisma.creatureInstance.findMany({ where: { userId }, select: { speciesId: true } }),
        ]);
        const byRarity: Record<string, number> = {
            COMMON: 0, RARE: 0, ELITE: 0, LEGENDARY: 0, MYTHIC: 0,
        };
        for (const inst of allInstances) {
            const species = getCreature(inst.speciesId);
            if (species?.rarity) {
                byRarity[species.rarity] = (byRarity[species.rarity] ?? 0) + 1;
            }
        }
        const trainer = await prisma.trainerProfile.findUnique({ where: { userId } });
        res.json({
            wins,
            losses,
            captures,
            totalMyths: allInstances.length,
            byRarity,
            totalXp: trainer?.xp ?? 0,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error al obtener estadísticas" });
    }
});
// POST /battle/pvp — disabled
router.post("/battle/pvp", (_req, res) => {
    res.status(503).json({ error: "PvP en desarrollo — próximamente" });
});
export default router;