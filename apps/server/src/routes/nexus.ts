// apps/server/src/routes/nexus.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getActiveBanner, getTrainerPity, pullEssences } from "../services/nexusService.js";

const router = Router();

// GET /nexus/banner — banner activo + myths boosteados
router.get("/nexus/banner", requireAuth, async (req, res) => {
    try {
        const banner = await getActiveBanner();
        res.json({ banner: banner ?? null });
    } catch (err) {
        console.error("[nexus/banner]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /nexus/pity — contadores pity del trainer autenticado
router.get("/nexus/pity", requireAuth, async (req, res) => {
    try {
        const userId = (req as any).userId as string;
        const pity = await getTrainerPity(userId);
        res.json(pity);
    } catch (err) {
        console.error("[nexus/pity]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// POST /nexus/pull — body: { amount: 1 | 5 }
router.post("/nexus/pull", requireAuth, async (req, res) => {
    try {
        const userId = (req as any).userId as string;
        const { amount } = req.body;

        if (amount !== 1 && amount !== 5) {
            return res.status(400).json({ error: "amount must be 1 or 5" });
        }

        const results = await pullEssences(userId, amount as 1 | 5);
        res.json({ results });
    } catch (err: any) {
        if (err.message === "Not enough Essences") {
            return res.status(400).json({ error: err.message });
        }
        console.error("[nexus/pull]", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
