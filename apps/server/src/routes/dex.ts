import { Router } from "express";
import { getAllCreatures, getCreature } from "../services/creatureService.js";

const router = Router();

// GET /dex/:id — obtiene un Myth por id o slug
router.get("/dex/:id", async (req, res) => {
    try {
        const myth = getCreature(req.params.id);
        res.json(myth);
    } catch (e) {
        res.status(404).json({ error: `Myth not found: ${req.params.id}` });
    }
});

// GET /dex — lista todos los Myths
router.get("/dex", async (_req, res) => {
    try {
        const all = getAllCreatures();
        res.json(all);
    } catch (e) {
        res.status(500).json({ error: "Error cargando bestiario" });
    }
});

export default router;
