// 5-tier rarity scheme (own design) — affixCount drives how many stats an
// item rolls; `weight` now drives a real weighted random roll (rollRarity
// below), used by the Spawn Armor debug tool's "Random" option and ready
// for a future real loot table to reuse as-is.
export const RARITIES = {
    common: { id: 'common', name: 'Common', color: '#b0b0b0', affixCount: 0, weight: 100 },
    uncommon: { id: 'uncommon', name: 'Uncommon', color: '#4caf50', affixCount: 1, weight: 50 },
    rare: { id: 'rare', name: 'Rare', color: '#4a90d9', affixCount: 2, weight: 20 },
    epic: { id: 'epic', name: 'Epic', color: '#a259e6', affixCount: 3, weight: 5 },
    legendary: { id: 'legendary', name: 'Legendary', color: '#e08e0b', affixCount: 4, weight: 1 },
};

// Per-tier weight shift, expressed as "this much every LEVELS_PER_SHIFT
// levels" (user-specified: Common -15 per 5 levels, i.e. -3/level, and so
// on) but applied CONTINUOUSLY, one level at a time — not as a step
// function that jumps only at multiples of 5. The user's own table sampled
// levels 1/5/10/15/20 to illustrate the shape, not to say nothing moves in
// between; every level in between nudges the weights too. Deltas sum to
// exactly 0, so shifting the whole table toward rarer loot never changes
// the total weight — Common gives up exactly what Uncommon/Rare/Epic/
// Legendary gain, in fixed proportion. A 6th tier ("Unique", rarer than
// Legendary) is planned to eventually absorb further shift once Common
// bottoms out — not built yet.
const RARITY_LEVEL_DELTAS = {
    common: -15,
    uncommon: 7,
    rare: 5,
    epic: 2,
    legendary: 1,
};
const LEVELS_PER_SHIFT = 5;

// Every rarity's weight at a given level: base weight + delta * (levels
// descended past the first / LEVELS_PER_SHIFT), so level 1 is exactly
// today's unshifted baseline and every level after it nudges the weights a
// little further — not frozen until the next multiple of 5. Rounded to a
// whole number per tier (purely cosmetic — the weighted roll below works
// identically on fractional weights) and clamped at 0 so a tier already
// exhausted (Common, the only negative-delta tier) never goes negative and
// corrupts the weighted roll. Only Common can ever hit this floor with
// today's deltas — the other four all grow without bound, so the table's
// total stops being exactly conserved once that happens (expected, and
// exactly the gap "Unique" is meant to fill in later, not a bug to work
// around now).
export function weightsForLevel(level) {
    const levelsDescended = (level - 1) / LEVELS_PER_SHIFT;
    const weights = {};
    for (const rarity of Object.values(RARITIES)) {
        const shifted = rarity.weight + RARITY_LEVEL_DELTAS[rarity.id] * levelsDescended;
        weights[rarity.id] = Math.max(0, Math.round(shifted));
    }
    return weights;
}

// Weighted random pick across every rarity, at the given level — same
// weighted-without-replacement-style scan as rollAffixes in armorTypes.js,
// just a single draw with no removal (rarity isn't "used up" the way a stat
// is). `level` defaults to 1 (the table's own baseline column), so existing
// callers that don't have a level yet keep today's exact behavior.
export function rollRarity(level = 1) {
    const weights = weightsForLevel(level);
    const entries = Object.entries(weights);
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * total;
    for (const [id, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return id;
    }
    return entries[entries.length - 1][0];
}
