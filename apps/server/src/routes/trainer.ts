import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getOrCreateTrainer } from "../services/trainerService.js";
import { getTokens } from "../services/tokenService.js";
import { getInventory } from "../services/inventoryService.js";
import { getMineStatus, collectMine } from "../services/mineService.js";

const router = Router();

router.get("/trainer/me", requireAuth, async (req, res) => {
    try {
        const trainer = await getOrCreateTrainer(req.user!.userId);
        res.json(trainer);
    } catch (e) {
        res.status(500).json({ error: "Internal error" });
    }
});

router.get("/tokens/me", requireAuth, async (req, res) => {
    try {
        const tokens = await getTokens(req.user!.userId);
        res.json(tokens);
    } catch (e) {
        res.status(500).json({ error: "Internal error" });
    }
});

router.get("/inventory/me", requireAuth, async (req, res) => {
    try {
        const inventory = await getInventory(req.user!.userId);
        res.json(inventory);
    } catch (e) {
        res.status(500).json({ error: "Internal error" });
    }
});

router.get("/mine/me", requireAuth, async (req, res) => {
    try {
        const status = await getMineStatus(req.user!.userId);
        res.json(status);
    } catch (e) {
        res.status(500).json({ error: "Internal error" });
    }
});

router.post("/mine/collect", requireAuth, async (req, res) => {
    try {
        const result = await collectMine(req.user!.userId);
        if (!result) {
            return res.status(400).json({ error: "Mine not ready yet" });
        }
        res.json({ collected: result });
    } catch (e) {
        res.status(500).json({ error: "Internal error" });
    }
});

export default router;
