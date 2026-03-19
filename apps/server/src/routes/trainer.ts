// apps/server/src/routes/trainer.ts

import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { getOrCreateTrainer } from "../services/trainerService.js";
import { getTokens } from "../services/tokenService.js";
import { getInventory } from "../services/inventoryService.js";
import {
    getMineStatus, collectMine, upgradeMine,
    getForgeStatus, collectForge, upgradeForge,
    getLabStatus, collectLab, upgradeLab,
} from "../services/mineService.js";
import { prisma } from "../services/prisma.js";
import { checkLevelEvolution, getAvailableItemEvolutions, evolveWithItem } from "../services/evolutionService.js";
import { z } from "zod";
import {
    getNurseryStatus, assignToNursery, collectNursery,
    removeFromNursery, upgradeNursery,
} from "../services/nurseryService.js";
import { getCreature } from "../services/creatureService.js";
import { calcBinderLevel } from "../services/sanctumService.js";

const router = Router();

// ─── Rank by level ────────────────────────────────────────────────────────────
function getRank(level: number): string {
    if (level >= 100) return "Mythic";
    if (level >= 80)  return "Legendary";
    if (level >= 65)  return "Grand Master";
    if (level >= 50)  return "Master";
    if (level >= 40)  return "Elite";
    if (level >= 30)  return "Hunter";
    if (level >= 20)  return "Explorer";
    if (level >= 10)  return "Apprentice";
    return "Novice";
}

// ─── TRAINER ─────────────────────────────────────────────────────────────────
router.get("/trainer/me", requireAuth, async (req, res) => {
    try {
        const trainer = await getOrCreateTrainer(req.user!.userId);
        const user = await prisma.user.findUnique({
            where: { id: req.user!.userId },
            select: { username: true },
        });

        // binderLevel always recalculated from XP — do not trust stored field
        const binderLevel = calcBinderLevel(trainer.xp);

        // sanctumClears — ensure array of 8 elements
        const rawClears: number[] = (trainer as any).sanctumClears ?? [];
        const sanctumClears = rawClears.length === 8
            ? rawClears
            : [...rawClears, ...new Array(8 - rawClears.length).fill(0)];

        // Guild info
        const guildTag  = (trainer as any).guildId
            ? (await prisma.guild.findUnique({ where: { id: (trainer as any).guildId }, select: { tag: true } }))?.tag ?? null
            : null;
        const guildRole = (trainer as any).guildRole ?? null;

        res.json({
            ...trainer,
            username: user?.username ?? null,
            rank: getRank(trainer.level),
            binderLevel,
            sanctumClears,
            guildTag,
            guildRole,
        });
    } catch { res.status(500).json({ error: "Internal error" }); }
});

// ─── AVATAR / FRAME ──────────────────────────────────────────────────────────
const VALID_AVATAR_IDS = [
    "avatar_male_1","avatar_male_2","avatar_male_3","avatar_male_4",
    "avatar_female_1","avatar_female_2","avatar_female_3","avatar_female_4",
    // legacy IDs (backwards compatibility)
    "male_1","male_2","male_3","male_4",
    "female_1","female_2","female_3","female_4",
];

const ALL_FRAME_KEYS = [
    "none",
    "frame_1","frame_2","frame_3","frame_4","frame_5","frame_6","frame_7",
];

router.post("/trainer/avatar", requireAuth, async (req, res) => {
    try {
        const userId = req.user!.userId;
        const { avatar, avatarFrame } = req.body as { avatar?: string; avatarFrame?: string };

        const profile = await prisma.trainerProfile.findUnique({ where: { userId } });
        if (!profile) return res.status(404).json({ error: "Profile not found" });

        const updates: Record<string, any> = {};

        if (avatar !== undefined) {
            if (!VALID_AVATAR_IDS.includes(avatar)) {
                return res.status(400).json({ error: "Invalid avatar" });
            }
            const avatarGender = (avatar.includes("female")) ? "female" : "male";
            if (profile.gender && profile.gender !== avatarGender) {
                return res.status(400).json({ error: "Avatar gender mismatch" });
            }
            updates.avatar = avatar;
        }

        if (avatarFrame !== undefined) {
            if (avatarFrame === null || avatarFrame === "none") {
                updates.avatarFrame = null;
            } else {
                if (!ALL_FRAME_KEYS.includes(avatarFrame)) {
                    return res.status(400).json({ error: "Invalid frame" });
                }
                const unlocked: string[] = (profile as any).unlockedFrames?.length
                    ? (profile as any).unlockedFrames
                    : ["none", "frame_1", "frame_2", "frame_3", "frame_4", "frame_5", "frame_6", "frame_7"];
                if (!unlocked.includes(avatarFrame)) {
                    return res.status(403).json({ error: "Frame not unlocked" });
                }
                updates.avatarFrame = avatarFrame;
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: "Nothing to update" });
        }

        const updated = await prisma.trainerProfile.update({ where: { userId }, data: updates });
        res.json({ success: true, avatar: updated.avatar, avatarFrame: (updated as any).avatarFrame });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Internal error" });
    }
});

router.get("/tokens/me", requireAuth, async (req, res) => {
    try {
        res.json(await getTokens(req.user!.userId));
    } catch { res.status(500).json({ error: "Internal error" }); }
});

router.get("/inventory/me", requireAuth, async (req, res) => {
    try {
        res.json(await getInventory(req.user!.userId));
    } catch { res.status(500).json({ error: "Internal error" }); }
});

// ─── MINE ─────────────────────────────────────────────────────────────────────
router.get("/mine/me", requireAuth, async (req, res) => {
    try {
        res.json(await getMineStatus(req.user!.userId));
    } catch (e: any) {
        console.error("MINE ERROR:", e.message, e.stack);
        res.status(500).json({ error: e.message });
    }
});

router.post("/mine/collect", requireAuth, async (req, res) => {
    try {
        const result = await collectMine(req.user!.userId);
        if (!result) return res.status(400).json({ error: "Mine is not ready yet" });
        res.json({ collected: result });
    } catch { res.status(500).json({ error: "Internal error" }); }
});

router.post("/mine/upgrade", requireAuth, async (req, res) => {
    try {
        const result = await upgradeMine(req.user!.userId);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// ─── FORGE ────────────────────────────────────────────────────────────────────
router.get("/forge/me", requireAuth, async (req, res) => {
    try {
        res.json(await getForgeStatus(req.user!.userId));
    } catch { res.status(500).json({ error: "Internal error" }); }
});

router.post("/forge/collect", requireAuth, async (req, res) => {
    try {
        const result = await collectForge(req.user!.userId);
        if (!result) return res.status(400).json({ error: "Forge is not ready yet" });
        res.json({ collected: result });
    } catch { res.status(500).json({ error: "Internal error" }); }
});

router.post("/forge/upgrade", requireAuth, async (req, res) => {
    try {
        const result = await upgradeForge(req.user!.userId);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// ─── LAB ──────────────────────────────────────────────────────────────────────
router.get("/lab/me", requireAuth, async (req, res) => {
    try {
        res.json(await getLabStatus(req.user!.userId));
    } catch { res.status(500).json({ error: "Internal error" }); }
});

router.post("/lab/collect", requireAuth, async (req, res) => {
    try {
        const result = await collectLab(req.user!.userId);
        if (!result) return res.status(400).json({ error: "Lab is not ready yet" });
        res.json({ collected: result });
    } catch { res.status(500).json({ error: "Internal error" }); }
});

router.post("/lab/upgrade", requireAuth, async (req, res) => {
    try {
        const result = await upgradeLab(req.user!.userId);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// ─── NURSERY ──────────────────────────────────────────────────────────────────
router.get("/nursery/me", requireAuth, async (req, res) => {
    try {
        res.json(await getNurseryStatus(req.user!.userId));
    } catch { res.status(500).json({ error: "Internal error" }); }
});

router.post("/nursery/assign", requireAuth, async (req, res) => {
    try {
        const { creatureId } = req.body;
        if (!creatureId) return res.status(400).json({ error: "Missing creatureId" });
        res.json(await assignToNursery(req.user!.userId, creatureId));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post("/nursery/collect", requireAuth, async (req, res) => {
    try {
        res.json(await collectNursery(req.user!.userId));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post("/nursery/remove", requireAuth, async (req, res) => {
    try {
        res.json(await removeFromNursery(req.user!.userId));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post("/nursery/upgrade", requireAuth, async (req, res) => {
    try {
        const result = await upgradeNursery(req.user!.userId);
        res.json(result);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

// ─── CREATURES ────────────────────────────────────────────────────────────────
router.post("/dev/add-creature", requireAuth, async (req, res) => {
    try {
        const creature = await prisma.creatureInstance.create({
            data: {
                userId: req.user!.userId,
                speciesId: "001",
                level: 10,
                xp: 0,
                hp: 60,
                maxHp: 60,
                attack: 55,
                defense: 40,
                speed: 90,
                isInParty: true,
                slot: 0,
            },
        });
        res.json(creature);
    } catch { res.status(500).json({ error: "Internal error" }); }
});

router.get("/creatures/me", requireAuth, async (req, res) => {
    try {
        const creatures = await prisma.creatureInstance.findMany({
            where: { userId: req.user!.userId },
            orderBy: [{ isInParty: "desc" }, { slot: "asc" }, { level: "desc" }],
        });
        const enriched = creatures.map((c) => {
            try {
                const species = getCreature(c.speciesId) as any;
                return {
                    ...c,
                    name:        species.name,
                    affinities:  species.affinities  ?? [],
                    art:         species.art          ?? {},
                    rarity:      species.rarity       ?? "COMMON",
                    description: species.description  ?? "",
                    height:      species.height       ?? 1.0,
                    weight:      species.weight       ?? 0,
                    moves:       species.moves        ?? [],
                    distortion:  species.distortion   ?? [],
                };
            } catch {
                return { ...c, name: c.speciesId, affinities: [], art: {}, rarity: "COMMON", moves: [], distortion: [] };
            }
        });
        res.json(enriched);
    } catch { res.status(500).json({ error: "Internal error" }); }
});

router.get("/creatures/party", requireAuth, async (req, res) => {
    try {
        const party = await prisma.creatureInstance.findMany({
            where: { userId: req.user!.userId, isInParty: true, inNursery: false },
            orderBy: { slot: "asc" },
        });
        res.json(party);
    } catch { res.status(500).json({ error: "Internal error" }); }
});

router.delete("/dev/clean-creatures", requireAuth, async (req, res) => {
    try {
        await prisma.creatureInstance.deleteMany({
            where: { userId: req.user!.userId, id: "" },
        });
        res.json({ ok: true });
    } catch { res.status(500).json({ error: "Internal error" }); }
});

router.get("/creatures/:id/evolutions", requireAuth, async (req, res) => {
    try {
        const result = await getAvailableItemEvolutions(req.user!.userId, req.params.id);
        res.json(result);
    } catch { res.status(404).json({ error: "Creature not found" }); }
});

router.post("/creatures/:id/evolve", requireAuth, async (req, res) => {
    try {
        const { item } = z.object({ item: z.string() }).parse(req.body);
        const result = await evolveWithItem(req.user!.userId, req.params.id, item as any);
        if ("error" in result) return res.status(400).json(result);
        res.json(result);
    } catch { res.status(400).json({ error: "Invalid request" }); }
});

router.post("/creatures/party/update", requireAuth, async (req, res) => {
    try {
        const userId = req.user!.userId;
        const { party } = req.body as { party: { id: string; slot: number }[] };

        if (!Array.isArray(party) || party.length > 3) {
            return res.status(400).json({ error: "Team must have between 0 and 3 Myths" });
        }
        const slots = party.map((p) => p.slot);
        if (new Set(slots).size !== slots.length) {
            return res.status(400).json({ error: "Duplicate slots" });
        }
        const ids = party.map((p) => p.id);
        const owned = await prisma.creatureInstance.findMany({
            where: { id: { in: ids }, userId },
            select: { id: true },
        });
        if (owned.length !== ids.length) {
            return res.status(403).json({ error: "Myth not found" });
        }
        await prisma.creatureInstance.updateMany({
            where: { userId },
            data: { isInParty: false, slot: null },
        });
        await Promise.all(
            party.map(({ id, slot }) =>
                prisma.creatureInstance.update({ where: { id }, data: { isInParty: true, slot } })
            )
        );
        res.json({ success: true });
    } catch { res.status(500).json({ error: "Internal error" }); }
});

export default router;
