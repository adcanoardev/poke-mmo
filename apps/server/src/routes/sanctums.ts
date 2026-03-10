import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getSanctumsStatus, challengeSanctum } from "../services/gymService.js";

const router = Router();
router.use(requireAuth);

// GET /sanctums
router.get("/sanctums", async (req, res) => {
    try {
        const data = await getSanctumsStatus(req.user!.userId);
        res.json(data);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// POST /sanctums/:id/challenge
router.post("/sanctums/:id/challenge", async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });
        const result = await challengeSanctum(req.user!.userId, id);
        if ("error" in result) return res.status(400).json(result);
        res.json(result);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

export default router;