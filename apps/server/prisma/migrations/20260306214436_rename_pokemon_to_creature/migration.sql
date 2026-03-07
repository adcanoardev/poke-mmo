-- Renombrar tabla
ALTER TABLE "PokemonInstance" RENAME TO "CreatureInstance";

-- Renombrar primary key (una sola sentencia)
ALTER TABLE "CreatureInstance" RENAME CONSTRAINT "PokemonInstance_pkey" TO "CreatureInstance_pkey";

-- Añadir speciesId con default temporal
ALTER TABLE "CreatureInstance" ADD COLUMN "speciesId" TEXT NOT NULL DEFAULT '001';

-- Eliminar pokedexId
ALTER TABLE "CreatureInstance" DROP COLUMN "pokedexId";

-- Quitar default temporal
ALTER TABLE "CreatureInstance" ALTER COLUMN "speciesId" DROP DEFAULT;

-- BattleLog: columnas nuevas con defaults para filas existentes
ALTER TABLE "BattleLog" ADD COLUMN "playerSpeciesId"   TEXT    NOT NULL DEFAULT 'unknown';
ALTER TABLE "BattleLog" ADD COLUMN "playerLevel"       INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "BattleLog" ADD COLUMN "enemySpeciesId"    TEXT    NOT NULL DEFAULT 'unknown';
ALTER TABLE "BattleLog" ADD COLUMN "enemyLevel"        INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "BattleLog" ADD COLUMN "capturedSpeciesId" TEXT;

-- BattleLog: quitar defaults temporales
ALTER TABLE "BattleLog" ALTER COLUMN "playerSpeciesId" DROP DEFAULT;
ALTER TABLE "BattleLog" ALTER COLUMN "playerLevel"     DROP DEFAULT;
ALTER TABLE "BattleLog" ALTER COLUMN "enemySpeciesId"  DROP DEFAULT;
ALTER TABLE "BattleLog" ALTER COLUMN "enemyLevel"      DROP DEFAULT;

-- BattleLog: eliminar columnas antiguas
ALTER TABLE "BattleLog" DROP COLUMN IF EXISTS "playerPokemonId";
ALTER TABLE "BattleLog" DROP COLUMN IF EXISTS "playerPokemonLvl";
ALTER TABLE "BattleLog" DROP COLUMN IF EXISTS "enemyPokemonId";
ALTER TABLE "BattleLog" DROP COLUMN IF EXISTS "enemyPokemonLvl";
ALTER TABLE "BattleLog" DROP COLUMN IF EXISTS "capturedPokemonId";