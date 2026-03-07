// Solo primeras evoluciones, no legendarios, no raros
// Organizados por región para la UI
export const STARTERS = [
    // Kanto
    { id: 1, name: "Bulbasaur", region: "Kanto", type: "grass" },
    { id: 4, name: "Charmander", region: "Kanto", type: "fire" },
    { id: 7, name: "Squirtle", region: "Kanto", type: "water" },
    { id: 25, name: "Pikachu", region: "Kanto", type: "electric" },
    // Johto
    { id: 152, name: "Chikorita", region: "Johto", type: "grass" },
    { id: 155, name: "Cyndaquil", region: "Johto", type: "fire" },
    { id: 158, name: "Totodile", region: "Johto", type: "water" },
    // Hoenn
    { id: 252, name: "Treecko", region: "Hoenn", type: "grass" },
    { id: 255, name: "Torchic", region: "Hoenn", type: "fire" },
    { id: 258, name: "Mudkip", region: "Hoenn", type: "water" },
    // Sinnoh
    { id: 387, name: "Turtwig", region: "Sinnoh", type: "grass" },
    { id: 390, name: "Chimchar", region: "Sinnoh", type: "fire" },
    { id: 393, name: "Piplup", region: "Sinnoh", type: "water" },
    // Unova
    { id: 495, name: "Snivy", region: "Unova", type: "grass" },
    { id: 498, name: "Tepig", region: "Unova", type: "fire" },
    { id: 501, name: "Oshawott", region: "Unova", type: "water" },
];

export const STARTER_IDS = new Set(STARTERS.map((s) => s.id));
