-- AlterTable
ALTER TABLE "TrainerProfile" ADD COLUMN     "avatar" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "onboardingComplete" BOOLEAN NOT NULL DEFAULT false;
