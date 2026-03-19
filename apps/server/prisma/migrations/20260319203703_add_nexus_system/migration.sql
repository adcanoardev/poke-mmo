-- CreateEnum
CREATE TYPE "QuestType" AS ENUM ('WIN_BATTLES', 'OPEN_ESSENCES', 'COLLECT_MINE', 'COMPLETE_SANCTUM', 'WIN_PVP');

-- CreateEnum
CREATE TYPE "StructureType" AS ENUM ('MINE', 'FORGE', 'LAB', 'NURSERY');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('SHARD', 'CRYSTAL', 'RUNE', 'ELIXIR', 'MEGA_ELIXIR', 'GRAND_ELIXIR', 'SPARK', 'GRAND_SPARK', 'EMBER_SHARD', 'TIDE_SHARD', 'VOLT_SHARD', 'GROVE_SHARD', 'FROST_SHARD', 'BOND_CRYSTAL', 'ASTRAL_SCALE', 'IRON_COAT', 'SOVEREIGN_STONE', 'CIPHER_CORE', 'BLUE_DIAMOND', 'ROCK_FRAGMENT', 'ARCANE_GEAR', 'FLAME_CORE');

-- CreateEnum
CREATE TYPE "BattleType" AS ENUM ('NPC', 'PVP');

-- CreateEnum
CREATE TYPE "BattleResult" AS ENUM ('WIN', 'LOSE', 'DRAW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "starterId" INTEGER NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "prestige" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "medals" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "avatar" TEXT,
    "gender" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "gold" INTEGER NOT NULL DEFAULT 0,
    "diamonds" INTEGER NOT NULL DEFAULT 0,
    "avatarFrame" TEXT,
    "unlockedFrames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "binderLevel" INTEGER NOT NULL DEFAULT 1,
    "sanctumClears" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "essences" INTEGER NOT NULL DEFAULT 0,
    "corruptedEssences" INTEGER NOT NULL DEFAULT 0,
    "pityRare" INTEGER NOT NULL DEFAULT 0,
    "pityEpic" INTEGER NOT NULL DEFAULT 0,
    "pityElite" INTEGER NOT NULL DEFAULT 0,
    "pityLegendary" INTEGER NOT NULL DEFAULT 0,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "guildId" TEXT,
    "guildRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NexusBanner" (
    "id" SERIAL NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "boostedMythIds" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NexusBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "banner" TEXT NOT NULL DEFAULT '#7b2fff',
    "level" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL DEFAULT '',
    "leaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildQuest" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" "QuestType" NOT NULL,
    "description" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "date" TEXT NOT NULL,
    "reward50" TEXT NOT NULL DEFAULT 'TOKENS',
    "reward100" TEXT NOT NULL DEFAULT 'TOKENS_GEMS',
    "claimed50" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "claimed100" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildQuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildQuestContribution" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildQuestContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuildMessage" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "guildTag" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "guildTag" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CombatToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "npcTokens" INTEGER NOT NULL DEFAULT 10,
    "pvpTokens" INTEGER NOT NULL DEFAULT 5,
    "lastNpcRecharge" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPvpRecharge" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CombatToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Structure" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "StructureType" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "lastCollected" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "structureXp" INTEGER NOT NULL DEFAULT 0,
    "dailyDiamonds" INTEGER NOT NULL DEFAULT 0,
    "lastDiamondReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Structure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "item" "ItemType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatureInstance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "nickname" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "hp" INTEGER NOT NULL,
    "maxHp" INTEGER NOT NULL,
    "attack" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "accuracy" INTEGER NOT NULL DEFAULT 100,
    "critChance" INTEGER NOT NULL DEFAULT 15,
    "critDamage" INTEGER NOT NULL DEFAULT 150,
    "isInParty" BOOLEAN NOT NULL DEFAULT false,
    "slot" INTEGER,
    "obtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "inNursery" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CreatureInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "BattleType" NOT NULL,
    "result" "BattleResult" NOT NULL,
    "xpGained" INTEGER NOT NULL DEFAULT 0,
    "coinsGained" INTEGER NOT NULL DEFAULT 0,
    "playerSpeciesId" TEXT NOT NULL,
    "playerLevel" INTEGER NOT NULL,
    "enemySpeciesId" TEXT NOT NULL,
    "enemyLevel" INTEGER NOT NULL,
    "capturedSpeciesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Game_userId_key" ON "Game"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainerProfile_userId_key" ON "TrainerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_name_key" ON "Guild"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Guild_tag_key" ON "Guild"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "CombatToken_userId_key" ON "CombatToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Structure_userId_type_key" ON "Structure"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_userId_item_key" ON "Inventory"("userId", "item");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerProfile" ADD CONSTRAINT "TrainerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainerProfile" ADD CONSTRAINT "TrainerProfile_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildQuest" ADD CONSTRAINT "GuildQuest_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildQuestContribution" ADD CONSTRAINT "GuildQuestContribution_questId_fkey" FOREIGN KEY ("questId") REFERENCES "GuildQuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuildMessage" ADD CONSTRAINT "GuildMessage_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CombatToken" ADD CONSTRAINT "CombatToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Structure" ADD CONSTRAINT "Structure_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatureInstance" ADD CONSTRAINT "CreatureInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleLog" ADD CONSTRAINT "BattleLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
