// Split out of player.js so stats.js can reference "what's the base value of
// this attribute" (for statBreakdown's tooltip) without an import cycle —
// player.js already imports from stats.js.
export const DEFAULT_ATTRIBUTES = { strength: 5, dexterity: 5, intelligence: 5 };
