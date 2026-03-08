/*
  Warnings:

  - The values [POKEBALL,SUPERBALL,ULTRABALL,MASTERBALL,POTION,SUPER_POTION,HYPER_POTION,REVIVE,MAX_REVIVE,FIRE_STONE,WATER_STONE,THUNDER_STONE,LEAF_STONE,ICE_STONE,LINK_CABLE,DRAGON_SCALE,METAL_COAT,KINGS_ROCK,UPGRADE] on the enum `ItemType` will be removed. If these variants are still used in the database, this will fail.
  - The values [POKEBALL_FACTORY] on the enum `StructureType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ItemType_new" AS ENUM ('FRAGMENT', 'SHARD', 'CRYSTAL', 'RUNE', 'ELIXIR', 'MEGA_ELIXIR', 'GRAND_ELIXIR', 'SPARK', 'GRAND_SPARK', 'EMBER_SHARD', 'TIDE_SHARD', 'VOLT_SHARD', 'GROVE_SHARD', 'FROST_SHARD', 'BOND_CRYSTAL', 'ASTRAL_SCALE', 'IRON_COAT', 'SOVEREIGN_STONE', 'CIPHER_CORE');
ALTER TABLE "Inventory" ALTER COLUMN "item" TYPE "ItemType_new" USING ("item"::text::"ItemType_new");
ALTER TYPE "ItemType" RENAME TO "ItemType_old";
ALTER TYPE "ItemType_new" RENAME TO "ItemType";
DROP TYPE "public"."ItemType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "StructureType_new" AS ENUM ('MINE', 'FRAGMENT_FORGE', 'LAB', 'NURSERY');
ALTER TABLE "Structure" ALTER COLUMN "type" TYPE "StructureType_new" USING ("type"::text::"StructureType_new");
ALTER TYPE "StructureType" RENAME TO "StructureType_old";
ALTER TYPE "StructureType_new" RENAME TO "StructureType";
DROP TYPE "public"."StructureType_old";
COMMIT;

-- RenameForeignKey
ALTER TABLE "CreatureInstance" RENAME CONSTRAINT "PokemonInstance_userId_fkey" TO "CreatureInstance_userId_fkey";
