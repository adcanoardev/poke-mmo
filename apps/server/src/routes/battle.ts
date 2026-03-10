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

const router = Router();
router.use(requireAuth);

// POST /battle/npc/start
router.post("/npc/start", async (req, res) => {
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
router.post("/npc/turn", async (req, res) => {
    try {
        const { battleId, actingMythId, moveId } = req.body as {
            battleId: string;
            actingMythId: string;
            moveId: string;
        };
        const result = await executeTurn(req.user!.userId, battleId, actingMythId, moveId);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// POST /battle/npc/flee
router.post("/npc/flee", async (req, res) => {
    try {
        const { battleId } = req.body as { battleId: string };
        await fleeBattle(req.user!.userId, battleId);
        res.json({ status: "fled" });
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// POST /battle/npc/capture
router.post("/npc/capture", async (req, res) => {
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
router.get("/npc/active", (req, res) => {
    const session = getActiveBattle(req.user!.userId);
    if (!session) return res.status(404).json({ error: "Sin combate activo" });
    res.json(session);
});

// GET /battle/stats
router.get("/stats", async (req, res) => {
    try {
        const userId = req.user!.userId;
        const logs = await prisma.battleLog.findMany({ where: { userId } });
        const wins = logs.filter((l) => l.result === "WIN").length;
        const losses = logs.filter((l) => l.result === "LOSE").length;
        const captures = logs.filter((l) => !!l.capturedSpeciesId).length;
        res.json({ totalBattles: logs.length, wins, losses, captures });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /battle/pvp — disabled
router.post("/pvp", (_req, res) => {
    res.status(503).json({ error: "PvP en desarrollo — próximamente" });
});

export default router;