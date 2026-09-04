// The three base classes — "rule of threes" per the project's design
// philosophy. Mostly identity (id/name/description/color); no starting kits
// yet, that's a later step. `baseAttack` feeds the Tier 1 Attack derived
// stat (see src/player/stats.js) — flat placeholder numbers, not balanced,
// pending the same stat-by-stat scaling discussion as everything else.
//
// `color` is each class's primary color — used for the class-select card,
// the player's own map marker, and to highlight `primaryAttribute` on the
// Character panel. These are true RYB primaries (red/yellow/blue), not RGB —
// green is a *secondary* color in RYB (blue+yellow), which the user
// corrected after the first pass mistakenly used red/green/blue. Subclass
// colors (see src/data/subclasses.js) are a weighted mix of these three,
// which is exactly why they need to be real primaries: a tertiary color only
// reads correctly as "a blend of two primaries" if both inputs are actually
// primary. `primaryAttribute`
// is the base attribute this class is built around — matches each class's
// combat identity (Warrior fights up close and tanks hits -> Strength,
// Rogue is fast/precise -> Dexterity, Mage casts from range -> Intelligence)
// and, not coincidentally, each attribute's own 1:1:3 mapping in
// computeDerivedStats (Strength -> Health/Carry Capacity/Fire, Dexterity ->
// Defense/Speed/Lightning, Intelligence -> Energy/Acuity/Arcane).
export const CLASSES = {
    warrior: {
        id: 'warrior',
        name: 'Warrior',
        description: 'Strong and resilient. Fights up close with weapons and armor.',
        color: '#dc3232',
        primaryAttribute: 'strength',
        baseAttack: 10,
    },
    mage: {
        id: 'mage',
        name: 'Mage',
        description: 'Wields arcane power at a distance. Fragile up close.',
        color: '#3266dc',
        primaryAttribute: 'intelligence',
        baseAttack: 10,
    },
    rogue: {
        id: 'rogue',
        name: 'Rogue',
        description: 'Fast and precise. Favors stealth and critical strikes.',
        color: '#d4b62e',
        primaryAttribute: 'dexterity',
        baseAttack: 10,
    },
};
