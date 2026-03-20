import { Router } from "express";
import { registerUser, loginUser, getUserById } from "../services/authService.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { RegisterBody, LoginBody } from "../validators/auth.validators.js";
import { validate } from "../validators/game.validators.js";
import { prisma } from "../services/prisma.js";
import bcrypt from "bcrypt";

const router = Router();

router.post("/auth/register", async (req, res) => {
    try {
        const { username, email, password } = validate(RegisterBody, req.body);
        const result = await registerUser(username, email, password);
        res.status(201).json(result);
    } catch (e) {
        console.error("REGISTER ERROR:", e);
        const msg = e instanceof Error ? e.message : "Internal error";
        res.status(400).json({ error: msg });
    }
});

router.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = validate(LoginBody, req.body);
        const result = await loginUser(email, password);
        res.json(result);
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Internal error";
        res.status(401).json({ error: msg });
    }
});

router.get("/auth/me", requireAuth, async (req, res) => {
    try {
        const user = await getUserById(req.user!.userId);
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch {
        res.status(500).json({ error: "Internal error" });
    }
});

// POST /auth/change-username — costs 150 diamonds
router.post("/auth/change-username", requireAuth, async (req, res) => {
    try {
        const userId = req.user!.userId;
        const { username } = req.body;

        if (!username || typeof username !== "string" || username.trim().length < 3) {
            return res.status(400).json({ error: "Username must be at least 3 characters." });
        }
        const clean = username.trim();
        if (clean.length > 20) {
            return res.status(400).json({ error: "Username must be 20 characters or less." });
        }

        // Check diamonds
        const profile = await prisma.trainerProfile.findUnique({
            where: { userId },
            select: { diamonds: true },
        });
        if (!profile) return res.status(404).json({ error: "Trainer not found" });
        if (profile.diamonds < 150) return res.status(400).json({ error: "Not enough diamonds (need 150)." });

        // Check uniqueness
        const existing = await prisma.user.findFirst({ where: { username: clean } });
        if (existing) return res.status(400).json({ error: "Username already taken." });

        // Update
        await prisma.$transaction([
            prisma.user.update({ where: { id: userId }, data: { username: clean } }),
            prisma.trainerProfile.update({ where: { userId }, data: { diamonds: { decrement: 150 } } }),
        ]);

        res.json({ success: true, username: clean });
    } catch (e) {
        console.error("[auth/change-username]", e);
        res.status(500).json({ error: "Internal error" });
    }
});

// POST /auth/change-password
router.post("/auth/change-password", requireAuth, async (req, res) => {
    try {
        const userId = req.user!.userId;
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: "Both current and new password are required." });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: "New password must be at least 6 characters." });
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return res.status(404).json({ error: "User not found" });

        const valid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!valid) return res.status(401).json({ error: "Current password is incorrect." });

        const newHash = await bcrypt.hash(newPassword, 12);
        await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

        res.json({ success: true });
    } catch (e) {
        console.error("[auth/change-password]", e);
        res.status(500).json({ error: "Internal error" });
    }
});

export default router;
