// apps/server/src/routes/sanctums.ts

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import {
    getSanctumList,
    challengeSanctum,
} from "../services/sanctumService.js";

const router = Router();
router.use(requireAuth);

// GET /sanctum/list — devuelve los 8 sanctums con estado del jugador
router.get("/sanctum/list", async (req, res) => {
    try {
        const list = await getSanctumList(req.user!.userId);
        res.json(list);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// POST /sanctum/challenge — retar un sanctum
// Body: { sanctumId: number, mythIds: string[] }
router.post("/sanctum/challenge", async (req, res) => {
    try {
        const { sanctumId, mythIds } = req.body as {
            sanctumId: number;
            mythIds: string[];
        };

        if (typeof sanctumId !== "number") {
            return res.status(400).json({ error: "sanctumId requerido" });
        }
        if (!Array.isArray(mythIds) || mythIds.length === 0) {
            return res.status(400).json({ error: "mythIds debe ser un array con 1-5 IDs" });
        }

        const result = await challengeSanctum(req.user!.userId, sanctumId, mythIds);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

export default router;
