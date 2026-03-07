import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { runNpcBattle } from "../services/battleService.js";
import { runPvpBattle } from "../services/pvpService.js";
import { z } from "zod";
import { challengeSanctum, getSanctumsStatus } from "../services/gymService.js";

const router = Router();

router.post("/battle/npc", requireAuth, async (req, res) => {
    try {
        const result = await runNpcBattle(req.user!.userId);
        if ("error" in result) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (e) {
        console.error("[battle/npc]", e);
        res.status(500).json({ error: "Internal error" });
    }
});

router.post("/battle/pvp", requireAuth, async (req, res) => {
    try {
        const { defenderUserId } = z
            .object({
                defenderUserId: z.string(),
            })
            .parse(req.body);

        const result = await runPvpBattle(req.user!.userId, defenderUserId);
        if ("error" in result) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (e) {
        console.error("[battle/pvp]", e);
        res.status(500).json({ error: "Internal error" });
    }
});

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
