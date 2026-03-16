-- AlterTable
ALTER TABLE "TrainerProfile" ADD COLUMN     "binderLevel" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sanctumClears" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
