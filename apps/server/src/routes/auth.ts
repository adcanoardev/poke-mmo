import { Router } from "express";
import { registerUser, loginUser, getUserById } from "../services/authService.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { RegisterBody, LoginBody } from "../validators/auth.validators.js";
import { validate } from "../validators/game.validators.js";

const router = Router();

router.post("/auth/register", async (req, res) => {
    try {
        const { username, email, password } = validate(RegisterBody, req.body);
        const result = await registerUser(username, email, password);
        res.status(201).json(result);
    } catch (e) {
        console.error("REGISTER ERROR:", e); // ← añade esto
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

export default router;
