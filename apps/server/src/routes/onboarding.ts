import { Router } from "express";
import { prisma } from "../services/prisma.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getStarterCreatures, getCreature, isValidStarter } from "../services/creatureService.js";
import { AVATARS } from "../data/avatars.js";

const router = Router();

// GET /onboarding/data
router.get("/data", requireAuth, async (req, res) => {
    try {
        const starters = getStarterCreatures();
        res.json({ starters, avatars: AVATARS });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error cargando starters" });
    }
});

// POST /onboarding/complete
router.post("/complete", requireAuth, async (req, res) => {
    try {
        const userId = req.user!.userId;
        const { gender, avatar, starterId } = req.body;

        if (!gender || !avatar || !starterId) {
            return res.status(400).json({ error: "Faltan campos: gender, avatar, starterId" });
        }

        const species = getCreature(starterId);
        if (!isValidStarter(species.id)) {
            return res.status(400).json({ error: "Starter no válido" });
        }

        const profile = await prisma.trainerProfile.findUnique({ where: { userId } });
        if (profile?.onboardingComplete) {
            return res.status(400).json({ error: "Onboarding ya completado" });
        }

        const level = 5;
        const { hp, atk, def, spd } = species.baseStats;
        const scaledHp = Math.floor(hp * (1 + level * 0.1));
        const scaledAtk = Math.floor(atk * (1 + level * 0.1));
        const scaledDef = Math.floor(def * (1 + level * 0.1));
        const scaledSpd = Math.floor(spd * (1 + level * 0.1));

        await prisma.$transaction([
            prisma.trainerProfile.update({
                where: { userId },
                data: { gender, avatar, onboardingComplete: true },
            }),
            prisma.creatureInstance.create({
                data: {
                    userId,
                    speciesId: species.id,
                    level,
                    xp: 0,
                    hp: scaledHp,
                    maxHp: scaledHp,
                    attack: scaledAtk,
                    defense: scaledDef,
                    speed: scaledSpd,
                    isInParty: true,
                    slot: 0,
                },
            }),
        ]);

        res.json({
            success: true,
            myth: {
                speciesId: species.id,
                name: species.name,
                art: species.art,
                level,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error completando onboarding" });
    }
});

export default router;
