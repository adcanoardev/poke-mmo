import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getOrCreateTrainer } from "../services/trainerService.js";
import { getTokens } from "../services/tokenService.js";
import { getInventory } from "../services/inventoryService.js";
import { getMineStatus, collectMine } from "../services/mineService.js";
import { prisma } from "../services/prisma.js";
import { checkLevelEvolution, getAvailableItemEvolutions, evolveWithItem } from "../services/evolutionService.js";
import { z } from "zod";

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

// Endpoint temporal para añadir Pokémon al equipo (desarrollo)
router.post("/dev/add-pokemon", requireAuth, async (req, res) => {
    try {
        const pokemon = await prisma.pokemonInstance.create({
            data: {
                userId: req.user!.userId,
                pokedexId: 25,
                level: 10,
                hp: 60,
                maxHp: 60,
                attack: 55,
                defense: 40,
                speed: 90,
                isInParty: true,
                slot: 0,
            },
        });
        res.json(pokemon);
    } catch (e) {
        res.status(500).json({ error: "Internal error" });
    }
});

// Ver todos los Pokémon del jugador
router.get("/pokemon/me", requireAuth, async (req, res) => {
    try {
        const pokemon = await prisma.pokemonInstance.findMany({
            where: { userId: req.user!.userId },
            orderBy: [{ isInParty: "desc" }, { slot: "asc" }, { level: "desc" }],
        });
        res.json(pokemon);
    } catch (e) {
        res.status(500).json({ error: "Internal error" });
    }
});

// Ver solo el equipo activo
router.get("/pokemon/party", requireAuth, async (req, res) => {
    try {
        const party = await prisma.pokemonInstance.findMany({
            where: { userId: req.user!.userId, isInParty: true },
            orderBy: { slot: "asc" },
        });
        res.json(party);
    } catch (e) {
        res.status(500).json({ error: "Internal error" });
    }
});

// Endpoint temporal para limpiar Pokémon corruptos (desarrollo)
router.delete("/dev/clean-pokemon", requireAuth, async (req, res) => {
    try {
        await prisma.pokemonInstance.deleteMany({
            where: {
                userId: req.user!.userId,
                id: "",
            },
        });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: "Internal error" });
    }
});

// Ver evoluciones disponibles por objeto para un Pokémon
router.get("/pokemon/:id/evolutions", requireAuth, async (req, res) => {
    try {
        const result = await getAvailableItemEvolutions(req.user!.userId, req.params.id);
        res.json(result);
    } catch (e) {
        res.status(404).json({ error: "Pokemon not found" });
    }
});

// Evolucionar con objeto
router.post("/pokemon/:id/evolve", requireAuth, async (req, res) => {
    try {
        const { item } = z.object({ item: z.string() }).parse(req.body);
        const result = await evolveWithItem(req.user!.userId, req.params.id, item as any);
        if ("error" in result) return res.status(400).json(result);
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: "Invalid request" });
    }
});

export default router;
