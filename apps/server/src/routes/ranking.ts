import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { prisma } from "../services/prisma.js";

const router = Router();

// Rangos de prestigio
function getPrestigeRank(prestige: number): string {
    if (prestige >= 1000) return "Campeón";
    if (prestige >= 600) return "Elite";
    if (prestige >= 300) return "Rival";
    if (prestige >= 100) return "Entrenador";
    return "Novato";
}

router.get("/ranking", requireAuth, async (req, res) => {
    try {
        const top = await prisma.trainerProfile.findMany({
            orderBy: { prestige: "desc" },
            take: 50,
            include: { user: { select: { username: true } }, guild: { select: { tag: true } } },
        });

        const ranking = top.map((t, i) => ({
            position: i + 1,
            userId: t.userId,
            username: t.user.username,
            guildTag: t.guild?.tag ?? null,
            prestige: t.prestige,
            rank: getPrestigeRank(t.prestige),
            level: t.level,
            medals: t.medals.length,
        }));

        // Posición del jugador actual
        const myPosition = ranking.findIndex((r) => r.userId === req.user!.userId);

        res.json({
            ranking,
            myPosition: myPosition !== -1 ? myPosition + 1 : null,
        });
    } catch (e) {
        res.status(500).json({ error: "Internal error" });
    }
});

export default router;
