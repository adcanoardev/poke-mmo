import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { startNpcBattle, executeTurn, fleeBattle, getActiveBattle } from "../services/battleService.js";
import { runPvpBattle } from "../services/pvpService.js";
import { z } from "zod";
import { challengeSanctum, getSanctumsStatus } from "../services/gymService.js";
import { prisma } from "../services/prisma.js";
import { getCreature } from "../services/creatureService.js";

const router = Router();

// ── NPC Battle ────────────────────────────────────────────────

router.post("/battle/npc/start", requireAuth, async (req, res) => {
    try {
        const result = await startNpcBattle(req.user!.userId);
        if ("error" in result) return res.status(400).json(result);
        res.json(result);
    } catch (e) {
        console.error("[battle/npc/start]", e);
        res.status(500).json({ error: "Internal error" });
    }
});

router.post("/battle/npc/turn", requireAuth, async (req, res) => {
    try {
        const { battleId, moveId } = z.object({ battleId: z.string(), moveId: z.string() }).parse(req.body);
        const result = await executeTurn(req.user!.userId, battleId, moveId);
        if ("error" in result) return res.status(400).json(result);
        res.json(result);
    } catch (e) {
        console.error("[battle/npc/turn]", e);
        res.status(500).json({ error: "Internal error" });
    }
});

router.post("/battle/npc/flee", requireAuth, async (req, res) => {
    try {
        const { battleId } = z.object({ battleId: z.string() }).parse(req.body);
        const result = await fleeBattle(req.user!.userId, battleId);
        if ("error" in result) return res.status(400).json(result);
        res.json(result);
    } catch (e) {
        console.error("[battle/npc/flee]", e);
        res.status(500).json({ error: "Internal error" });
    }
});

router.get("/battle/npc/active", requireAuth, async (req, res) => {
    try {
        const session = getActiveBattle(req.user!.userId);
        if (!session) return res.status(404).json({ error: "No hay combate activo" });
        res.json(session);
    } catch (e) {
        res.status(500).json({ error: "Internal error" });
    }
});

// ── Battle Stats ────────────────────────────────────────────────

router.get("/battle/stats", requireAuth, async (req, res) => {
    try {
        const userId = req.user!.userId;

        const [logs, creatures] = await Promise.all([
            prisma.battleLog.findMany({ where: { userId } }),
            prisma.creatureInstance.findMany({ where: { userId } }),
        ]);

        const npcWins = logs.filter(l => l.type === "NPC" && l.result === "WIN").length;
        const npcLosses = logs.filter(l => l.type === "NPC" && l.result === "LOSE").length;
        const pvpWins = logs.filter(l => l.type === "PVP" && l.result === "WIN").length;
        const pvpLosses = logs.filter(l => l.type === "PVP" && l.result === "LOSE").length;
        const captured = logs.filter(l => l.capturedSpeciesId !== null).length;
        const totalXp = logs.reduce((sum, l) => sum + (l.xpGained ?? 0), 0);
        const totalCoins = logs.reduce((sum, l) => sum + (l.coinsGained ?? 0), 0);

        const byRarity: Record<string, number> = {
            COMMON: 0, RARE: 0, ELITE: 0, LEGENDARY: 0, MYTHIC: 0,
        };

        for (const c of creatures) {
            try {
                const species = getCreature(c.speciesId);
                byRarity[species.rarity] = (byRarity[species.rarity] ?? 0) + 1;
            } catch { }
        }

        res.json({
            npcWins, npcLosses, pvpWins, pvpLosses,
            captured, totalXp, totalCoins,
            totalMyths: creatures.length,
            byRarity,
        });
    } catch (e) {
        res.status(500).json({ error: "Internal error" });
    }
});

// ── PvP Battle (simulado, sin cambios) ───────────────────────

router.post("/battle/pvp", requireAuth, async (req, res) => {
    try {
        const { defenderUserId } = z.object({ defenderUserId: z.string() }).parse(req.body);
        const result = await runPvpBattle(req.user!.userId, defenderUserId);
        if ("error" in result) return res.status(400).json(result);
        res.json(result);
    } catch (e) {
        console.error("[battle/pvp]", e);
        res.status(500).json({ error: "Internal error" });
    }
});

// ── Santuarios ────────────────────────────────────────────────

router.get("/gyms", requireAuth, async (req, res) => {
    try {
        const status = await getSanctumsStatus(req.user!.userId);
        res.json(status);
    } catch (e) {
        res.status(500).json({ error: "Internal error" });
    }
});

router.post("/gyms/:id/challenge", requireAuth, async (req, res) => {
    try {
        const gymId = parseInt(req.params.id);
        if (isNaN(gymId)) return res.status(400).json({ error: "Invalid gym ID" });
        const result = await challengeSanctum(req.user!.userId, gymId);
        if ("error" in result) return res.status(400).json(result);
        res.json(result);
    } catch (e) {
        console.error("[gyms/challenge]", e);
        res.status(500).json({ error: "Internal error" });
    }
});

export default router;
