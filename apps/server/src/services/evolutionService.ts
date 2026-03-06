import { prisma } from "./prisma.js";
import { hasItem, removeItem } from "./inventoryService.js";
import type { ItemType } from "@prisma/client";

// ── Evoluciones por nivel ──────────────────────────────────────

const LEVEL_EVOLUTIONS: Record<number, { evolvesTo: number; level: number }> = {
    // Gen 1
    1: { evolvesTo: 2, level: 16 }, // Bulbasaur → Ivysaur
    2: { evolvesTo: 3, level: 32 }, // Ivysaur → Venusaur
    4: { evolvesTo: 5, level: 16 }, // Charmander → Charmeleon
    5: { evolvesTo: 6, level: 36 }, // Charmeleon → Charizard
    7: { evolvesTo: 8, level: 16 }, // Squirtle → Wartortle
    8: { evolvesTo: 9, level: 36 }, // Wartortle → Blastoise
    10: { evolvesTo: 11, level: 7 }, // Caterpie → Metapod
    11: { evolvesTo: 12, level: 10 }, // Metapod → Butterfree
    13: { evolvesTo: 14, level: 7 }, // Weedle → Kakuna
    14: { evolvesTo: 15, level: 10 }, // Kakuna → Beedrill
    16: { evolvesTo: 17, level: 18 }, // Pidgey → Pidgeotto
    17: { evolvesTo: 18, level: 36 }, // Pidgeotto → Pidgeot
    19: { evolvesTo: 20, level: 20 }, // Rattata → Raticate
    21: { evolvesTo: 22, level: 20 }, // Spearow → Fearow
    23: { evolvesTo: 24, level: 22 }, // Ekans → Arbok
    25: { evolvesTo: 26, level: 99 }, // Pikachu → Raichu (necesita piedra, aquí bloqueado)
    27: { evolvesTo: 28, level: 22 }, // Sandshrew → Sandslash
    29: { evolvesTo: 30, level: 16 }, // Nidoran♀ → Nidorina
    30: { evolvesTo: 31, level: 36 }, // Nidorina → Nidoqueen
    32: { evolvesTo: 33, level: 16 }, // Nidoran♂ → Nidorino
    33: { evolvesTo: 34, level: 36 }, // Nidorino → Nidoking
    41: { evolvesTo: 42, level: 22 }, // Zubat → Golbat
    43: { evolvesTo: 44, level: 21 }, // Oddish → Gloom
    46: { evolvesTo: 47, level: 24 }, // Paras → Parasect
    48: { evolvesTo: 49, level: 31 }, // Venonat → Venomoth
    50: { evolvesTo: 51, level: 26 }, // Diglett → Dugtrio
    52: { evolvesTo: 53, level: 28 }, // Meowth → Persian
    54: { evolvesTo: 55, level: 33 }, // Psyduck → Golduck
    56: { evolvesTo: 57, level: 28 }, // Mankey → Primeape
    60: { evolvesTo: 61, level: 25 }, // Poliwag → Poliwhirl
    63: { evolvesTo: 64, level: 16 }, // Abra → Kadabra
    66: { evolvesTo: 67, level: 28 }, // Machop → Machoke
    67: { evolvesTo: 68, level: 99 }, // Machoke → Machamp (cable)
    69: { evolvesTo: 70, level: 21 }, // Bellsprout → Weepinbell
    72: { evolvesTo: 73, level: 30 }, // Tentacool → Tentacruel
    74: { evolvesTo: 75, level: 25 }, // Geodude → Graveler
    75: { evolvesTo: 76, level: 99 }, // Graveler → Golem (cable)
    77: { evolvesTo: 78, level: 40 }, // Ponyta → Rapidash
    79: { evolvesTo: 80, level: 37 }, // Slowpoke → Slowbro
    81: { evolvesTo: 82, level: 30 }, // Magnemite → Magneton
    84: { evolvesTo: 85, level: 31 }, // Doduo → Dodrio
    86: { evolvesTo: 87, level: 34 }, // Seel → Dewgong
    88: { evolvesTo: 89, level: 38 }, // Grimer → Muk
    92: { evolvesTo: 93, level: 25 }, // Gastly → Haunter
    93: { evolvesTo: 94, level: 99 }, // Haunter → Gengar (cable)
    96: { evolvesTo: 97, level: 26 }, // Drowzee → Hypno
    98: { evolvesTo: 99, level: 28 }, // Krabby → Kingler
    100: { evolvesTo: 101, level: 30 }, // Voltorb → Electrode
    102: { evolvesTo: 103, level: 30 }, // Exeggcute → Exeggutor (piedra hoja en objeto)
    104: { evolvesTo: 105, level: 28 }, // Cubone → Marowak
    108: { evolvesTo: 108, level: 99 }, // Lickitung (no evoluciona por nivel)
    109: { evolvesTo: 110, level: 35 }, // Koffing → Weezing
    111: { evolvesTo: 112, level: 42 }, // Rhyhorn → Rhydon
    116: { evolvesTo: 117, level: 32 }, // Horsea → Seadra
    118: { evolvesTo: 119, level: 33 }, // Goldeen → Seaking
    120: { evolvesTo: 121, level: 99 }, // Staryu (piedra agua)
    129: { evolvesTo: 130, level: 20 }, // Magikarp → Gyarados
    133: { evolvesTo: 134, level: 99 }, // Eevee (piedra)
    138: { evolvesTo: 139, level: 40 }, // Omanyte → Omastar
    140: { evolvesTo: 141, level: 40 }, // Kabuto → Kabutops
    147: { evolvesTo: 148, level: 30 }, // Dratini → Dragonair
    148: { evolvesTo: 149, level: 55 }, // Dragonair → Dragonite
};

// ── Evoluciones por objeto ─────────────────────────────────────

const ITEM_EVOLUTIONS: Record<number, { evolvesTo: number; item: ItemType }[]> = {
    25: [{ evolvesTo: 26, item: "THUNDER_STONE" }], // Pikachu → Raichu
    35: [{ evolvesTo: 36, item: "FIRE_STONE" }], // Clefairy → Clefable (piedra fuego aprox)
    37: [{ evolvesTo: 38, item: "FIRE_STONE" }], // Vulpix → Ninetales
    44: [{ evolvesTo: 45, item: "LEAF_STONE" }], // Gloom → Vileplume
    58: [{ evolvesTo: 59, item: "FIRE_STONE" }], // Growlithe → Arcanine
    61: [{ evolvesTo: 62, item: "WATER_STONE" }], // Poliwhirl → Poliwrath
    64: [{ evolvesTo: 65, item: "LINK_CABLE" }], // Kadabra → Alakazam
    67: [{ evolvesTo: 68, item: "LINK_CABLE" }], // Machoke → Machamp
    70: [{ evolvesTo: 71, item: "LEAF_STONE" }], // Weepinbell → Victreebel
    75: [{ evolvesTo: 76, item: "LINK_CABLE" }], // Graveler → Golem
    80: [{ evolvesTo: 199, item: "KINGS_ROCK" }], // Slowpoke → Slowking
    93: [{ evolvesTo: 94, item: "LINK_CABLE" }], // Haunter → Gengar
    102: [{ evolvesTo: 103, item: "LEAF_STONE" }], // Exeggcute → Exeggutor
    112: [{ evolvesTo: 464, item: "UPGRADE" }], // Rhydon → Rhyperior
    116: [{ evolvesTo: 230, item: "DRAGON_SCALE" }], // Seadra → Kingdra
    120: [{ evolvesTo: 121, item: "WATER_STONE" }], // Staryu → Starmie
    121: [{ evolvesTo: 0, item: "WATER_STONE" }], // placeholder
    133: [
        { evolvesTo: 134, item: "WATER_STONE" }, // Eevee → Vaporeon
        { evolvesTo: 135, item: "THUNDER_STONE" }, // Eevee → Jolteon
        { evolvesTo: 136, item: "FIRE_STONE" }, // Eevee → Flareon
        { evolvesTo: 470, item: "LEAF_STONE" }, // Eevee → Leafeon
        { evolvesTo: 471, item: "ICE_STONE" }, // Eevee → Glaceon
    ],
    138: [{ evolvesTo: 185, item: "WATER_STONE" }], // Porygon → Porygon2
    211: [{ evolvesTo: 212, item: "METAL_COAT" }], // Scyther → Scizor
    223: [{ evolvesTo: 224, item: "WATER_STONE" }], // Remoraid → Octillery
    228: [{ evolvesTo: 229, item: "FIRE_STONE" }], // Houndour → Houndoom
    246: [{ evolvesTo: 247, item: "WATER_STONE" }], // Larvitar → Pupitar
};

// ── Lógica principal ───────────────────────────────────────────

export async function checkLevelEvolution(pokemonInstanceId: string) {
    const pokemon = await prisma.pokemonInstance.findUniqueOrThrow({
        where: { id: pokemonInstanceId },
    });

    const evo = LEVEL_EVOLUTIONS[pokemon.pokedexId];
    if (!evo || pokemon.level < evo.level || evo.level === 99) return null;

    // Evolucionar automáticamente
    const evolved = await prisma.pokemonInstance.update({
        where: { id: pokemonInstanceId },
        data: { pokedexId: evo.evolvesTo },
    });

    return { evolved: true, from: pokemon.pokedexId, to: evo.evolvesTo };
}

export async function getAvailableItemEvolutions(userId: string, pokemonInstanceId: string) {
    const pokemon = await prisma.pokemonInstance.findUniqueOrThrow({
        where: { id: pokemonInstanceId, userId },
    });

    const evos = ITEM_EVOLUTIONS[pokemon.pokedexId] ?? [];
    const available = [];

    for (const evo of evos) {
        if (evo.evolvesTo === 0) continue;
        const hasIt = await hasItem(userId, evo.item);
        if (hasIt) available.push(evo);
    }

    return { pokedexId: pokemon.pokedexId, available };
}

export async function evolveWithItem(userId: string, pokemonInstanceId: string, item: ItemType) {
    const pokemon = await prisma.pokemonInstance.findUniqueOrThrow({
        where: { id: pokemonInstanceId, userId },
    });

    const evos = ITEM_EVOLUTIONS[pokemon.pokedexId] ?? [];
    const evo = evos.find((e) => e.item === item);
    if (!evo || evo.evolvesTo === 0) return { error: "Invalid evolution" };

    const hasIt = await hasItem(userId, item);
    if (!hasIt) return { error: "Item not in inventory" };

    await removeItem(userId, item, 1);
    const evolved = await prisma.pokemonInstance.update({
        where: { id: pokemonInstanceId },
        data: { pokedexId: evo.evolvesTo },
    });

    return { evolved: true, from: pokemon.pokedexId, to: evo.evolvesTo };
}
