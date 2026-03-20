// apps/server/src/routes/mail.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { prisma } from "../services/prisma.js";

const router = Router();

const MAIL_EXPIRY_DAYS = 7;

// ─── GET /mail — lista mensajes del trainer ───────────────────
router.get("/mail", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const now = new Date();

    const messages = await prisma.mailMessage.findMany({
      where: { userId, expiresAt: { gte: now } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = messages.filter(m => !m.isRead).length;
    res.json({ messages, unreadCount });
  } catch (err) {
    console.error("[mail/GET]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /mail/:id/read — marcar leído ───────────────────────
router.post("/mail/:id/read", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const msg = await prisma.mailMessage.findFirst({ where: { id, userId } });
    if (!msg) return res.status(404).json({ error: "Message not found" });

    await prisma.mailMessage.update({ where: { id }, data: { isRead: true } });
    res.json({ success: true });
  } catch (err) {
    console.error("[mail/read]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /mail/:id/claim — reclamar adjuntos ─────────────────
router.post("/mail/:id/claim", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const msg = await prisma.mailMessage.findFirst({ where: { id, userId } });
    if (!msg) return res.status(404).json({ error: "Message not found" });
    if (msg.claimedAt) return res.status(400).json({ error: "Already claimed" });
    if (!msg.attachments) return res.status(400).json({ error: "No attachments" });

    const att = msg.attachments as {
      gold?: number;
      diamonds?: number;
      essences?: number;
      goldEssences?: number;
      items?: { itemSlug: string; qty: number }[];
    };

    // Transacción: marcar claimed + entregar recursos
    await prisma.$transaction(async (tx) => {
      // Marcar como claimed y leído
      await tx.mailMessage.update({
        where: { id },
        data: { claimedAt: new Date(), isRead: true },
      });

      // Entregar gold / diamonds / essences
      const profileUpdate: Record<string, any> = {};
      if (att.gold)         profileUpdate.gold         = { increment: att.gold };
      if (att.diamonds)     profileUpdate.diamonds     = { increment: att.diamonds };
      if (att.essences)     profileUpdate.essences     = { increment: att.essences };
      if (att.goldEssences) profileUpdate.goldEssences = { increment: att.goldEssences };

      if (Object.keys(profileUpdate).length > 0) {
        await tx.trainerProfile.update({ where: { userId }, data: profileUpdate });
      }

      // Entregar ítems al inventario
      if (att.items && att.items.length > 0) {
        for (const { itemSlug, qty } of att.items) {
          const item = await tx.item.findUnique({ where: { slug: itemSlug } });
          if (!item) continue;

          await tx.trainerInventory.upsert({
            where: { userId_itemId: { userId, itemId: item.id } },
            create: { userId, itemId: item.id, quantity: qty },
            update: { quantity: { increment: qty } },
          });
        }
      }
    });

    res.json({ success: true, claimed: att });
  } catch (err) {
    console.error("[mail/claim]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /mail/:id — eliminar mensaje ─────────────────────
router.delete("/mail/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const msg = await prisma.mailMessage.findFirst({ where: { id, userId } });
    if (!msg) return res.status(404).json({ error: "Message not found" });

    await prisma.mailMessage.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("[mail/delete]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /mail/read-all — marcar todos como leídos ──────────
router.post("/mail/read-all", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    await prisma.mailMessage.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[mail/read-all]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Helper exportado — crear mensaje desde otros servicios ──
export async function sendMail(
  userId: string,
  data: {
    type?: "SYSTEM" | "GUILD" | "PROMO";
    title: string;
    body: string;
    attachments?: object;
    actionData?: object;
    expiryDays?: number;
  }
) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (data.expiryDays ?? MAIL_EXPIRY_DAYS));

  return prisma.mailMessage.create({
    data: {
      userId,
      type:        (data.type ?? "SYSTEM") as any,
      title:       data.title,
      body:        data.body,
      attachments: data.attachments ?? null,
      actionData:  data.actionData ?? null,
      expiresAt,
    },
  });
}

export default router;
