// ─────────────────────────────────────────────────────────────
// apps/server/src/app.ts
// Express app setup — no business logic here.
// ─────────────────────────────────────────────────────────────

import express from "express";
import cors from "cors";
import healthRouter from "./routes/health.js";
import dexRouter from "./routes/dex.js";
import authRouter from "./routes/auth.js";
import trainerRouter from "./routes/trainer.js";
import battleRouter from "./routes/battle.js";
import rankingRouter from "./routes/ranking.js";
import onboardingRouter from "./routes/onboarding.js";
import sanctumsRouter from "./routes/sanctums.js";

export function createApp() {
    const app = express();

    app.use(
        cors({
            origin: process.env.CORS_ORIGIN || "http://localhost:5173",
            credentials: true,
        }),
    );
    app.use(express.json());

    // Routes
    app.use(healthRouter);
    app.use(dexRouter);
    app.use(authRouter);
    app.use(trainerRouter);
    app.use(battleRouter);
    app.use(rankingRouter);
    app.use(sanctumsRouter);
    app.use("/onboarding", onboardingRouter);

    // 404 catch-all
    app.use((_req, res) => {
        res.status(404).json({ error: "Not found" });
    });

    // Global error handler
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        console.error("[Express error]", err);
        res.status(500).json({ error: "Internal server error" });
    });

    return app;
}
