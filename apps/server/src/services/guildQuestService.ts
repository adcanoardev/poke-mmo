// apps/server/src/services/guildQuestService.ts

import { prisma } from "./prisma.js";

// ─── Quest templates ──────────────────────────────────────────────────────────

const QUEST_TEMPLATES = [
  { type: "WIN_BATTLES"      as const, description: "Win battles (NPC or PvP)",  target: 30 },
  { type: "OPEN_ESSENCES"    as const, description: "Open Essences at the Nexus", target: 15 },
  { type: "COLLECT_MINE"     as const, description: "Collect from the Mine",      target: 20 },
  { type: "COMPLETE_SANCTUM" as const, description: "Complete Sanctum runs",      target: 10 },
  { type: "WIN_PVP"          as const, description: "Win PvP ranked matches",     target: 10 },
];

// Guild XP per quest completion
const QUEST_XP = 50;

// Guild level thresholds (level = index + 1)
const LEVEL_XP = [0, 500, 1200, 2500, 4500, 7000, 10500, 15000, 21000, 30000];

function calcGuildLevel(xp: number): number {
  let level = 1;
  for (let i = LEVEL_XP.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP[i]) { level = i + 1; break; }
  }
  return Math.min(level, 10);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ─── getOrCreateDailyQuests ───────────────────────────────────────────────────

export async function getOrCreateDailyQuests(guildId: string) {
  const today = todayStr();

  const existing = await prisma.guildQuest.findMany({
    where: { guildId, date: today },
    include: { contributions: true },
  });

  if (existing.length >= 3) return existing;

  const shuffled = [...QUEST_TEMPLATES].sort(() => Math.random() - 0.5).slice(0, 3);

  await prisma.guildQuest.createMany({
    data: shuffled.map(q => ({
      guildId,
      type:        q.type,
      description: q.description,
      target:      q.target,
      date:        today,
    })),
    skipDuplicates: true,
  });

  return prisma.guildQuest.findMany({
    where: { guildId, date: today },
    include: { contributions: true },
  });
}

// ─── contributeToQuest ────────────────────────────────────────────────────────

export async function contributeToQuest(
  userId: string,
  guildId: string,
  questType: string,
  amount: number = 1
) {
  const today = todayStr();

  const quest = await prisma.guildQuest.findFirst({
    where: { guildId, date: today, type: questType as any },
  });

  if (!quest || quest.progress >= quest.target) return;

  const newProgress = Math.min(quest.progress + amount, quest.target);

  await prisma.$transaction([
    prisma.guildQuestContribution.create({
      data: { questId: quest.id, userId, amount },
    }),
    prisma.guildQuest.update({
      where: { id: quest.id },
      data: { progress: newProgress },
    }),
  ]);

  if (quest.progress < quest.target && newProgress >= quest.target) {
    await prisma.guild.update({
      where: { id: guildId },
      data: { xp: { increment: QUEST_XP } },
    });
    const guild = await prisma.guild.findUnique({ where: { id: guildId }, select: { xp: true } });
    if (guild) {
      const newLevel = calcGuildLevel(guild.xp);
      await prisma.guild.update({ where: { id: guildId }, data: { level: newLevel } });
    }
  }
}

// ─── claimReward ─────────────────────────────────────────────────────────────

export async function claimReward(
  userId: string,
  guildId: string,
  questId: string,
  threshold: 50 | 100
) {
  const quest = await prisma.guildQuest.findUnique({ where: { id: questId } });
  if (!quest || quest.guildId !== guildId) throw new Error("Quest not found");

  const pct = Math.floor((quest.progress / quest.target) * 100);
  if (pct < threshold) throw new Error(`Quest is only ${pct}% complete`);

  const claimedField = threshold === 50 ? "claimed50" : "claimed100";
  const alreadyClaimed: string[] = (quest as any)[claimedField] ?? [];
  if (alreadyClaimed.includes(userId)) throw new Error("Already claimed");

  const tokens = threshold === 50 ? 3 : 5;
  const gems   = threshold === 100 ? 5 : 0;

  await prisma.$transaction(async tx => {
    await tx.guildQuest.update({
      where: { id: questId },
      data: { [claimedField]: { push: userId } },
    });
    await tx.combatToken.update({
      where: { userId },
      data: { npcTokens: { increment: tokens } },
    });
    if (gems > 0) {
      await tx.trainerProfile.update({
        where: { userId },
        data: { diamonds: { increment: gems } },
      });
    }
  });

  return { tokens, gems };
}

// ─── getDailyQuestsForUser ────────────────────────────────────────────────────

export async function getDailyQuestsForUser(userId: string, guildId: string) {
  const quests = await getOrCreateDailyQuests(guildId);

  return quests.map(q => {
    const myContrib = q.contributions
      .filter(c => c.userId === userId)
      .reduce((sum, c) => sum + c.amount, 0);

    const pct = Math.floor((q.progress / q.target) * 100);

    return {
      id:          q.id,
      type:        q.type,
      description: q.description,
      target:      q.target,
      progress:    q.progress,
      pct,
      myContrib,
      claimed50:   q.claimed50.includes(userId),
      claimed100:  q.claimed100.includes(userId),
      reward50:    q.reward50,
      reward100:   q.reward100,
    };
  });
}
