import { SUBCLASS_UNLOCK_LEVEL } from './subclasses.js';

// Explicitly throwaway placeholder CONTENT (the 6 talents below) — there is
// no real talent design yet, these exist to exercise the talent system end
// to end. The SYSTEM itself is real: 3 categories (general — every class;
// primary — the player's own core class; secondary — the player's chosen
// subclass, see src/data/subclasses.js), each organized into level-gated
// tiers (see tierUnlockLevel below), acquired by spending a talent point
// (player.talentPoints, +1 per level) permanently — no respec path exists
// anywhere. Settings' debug-only "Grant talent" control (settingsPopup.js)
// still exists as a free bypass of all of this, exactly like "Test stat"
// bypasses real stat-point costs — it is no longer the only way to acquire
// a talent, just a testing shortcut.
//
// `label`/`color` mirror ITEM_TYPES entries so a talent renders via the
// exact same action-bar/drag code as an item (see hud.js). `use` is the
// same shape as an item's `use` (see useEffects.js).
//
// `kind` is 'active' (square tile, has a `use`, draggable onto the action
// bar) or 'passive' (circular tile, always-on once learned, no `use` — not
// draggable/usable, same "structure now, real numbers later" placeholder
// pattern already used for Equipment/Talents stat-bonus rows elsewhere).

// General talents aren't tied to any one class, so they get a neutral color
// rather than borrowing red/blue/yellow from one of the three primaries.
export const GENERAL_TALENT_COLOR = '#8a8f98';

export const TALENTS = {
    battleFocus: {
        id: 'battleFocus',
        category: 'general',
        tier: 1,
        kind: 'active',
        name: 'Battle Focus',
        description: 'Restore 10 EP.',
        color: GENERAL_TALENT_COLOR,
        label: 'BF',
        use: { type: 'resourceDelta', resource: 'energy', amount: 10 },
    },
    mendingWard: {
        id: 'mendingWard',
        category: 'general',
        tier: 1,
        kind: 'active',
        name: 'Mending Ward',
        description: 'Restore 10 HP.',
        color: GENERAL_TALENT_COLOR,
        label: 'MW',
        use: { type: 'resourceDelta', resource: 'health', amount: 10 },
    },
    ironWill: {
        id: 'ironWill',
        category: 'general',
        tier: 1,
        kind: 'passive',
        name: 'Iron Will',
        description: 'Passively toughens resolve.',
        color: GENERAL_TALENT_COLOR,
        label: 'IW',
    },
    quickPatch: {
        id: 'quickPatch',
        category: 'general',
        tier: 2,
        kind: 'active',
        name: 'Quick Patch',
        description: 'Restore 12 HP.',
        color: GENERAL_TALENT_COLOR,
        label: 'QP',
        use: { type: 'resourceDelta', resource: 'health', amount: 12 },
    },
    adrenalineRush: {
        id: 'adrenalineRush',
        category: 'general',
        tier: 2,
        kind: 'active',
        name: 'Adrenaline Rush',
        description: 'Restore 12 EP.',
        color: GENERAL_TALENT_COLOR,
        label: 'AD',
        use: { type: 'resourceDelta', resource: 'energy', amount: 12 },
    },
    steadyHands: {
        id: 'steadyHands',
        category: 'general',
        tier: 2,
        kind: 'passive',
        name: 'Steady Hands',
        description: 'Passively steadies the body.',
        color: GENERAL_TALENT_COLOR,
        label: 'SH',
    },
    secondWind: {
        id: 'secondWind',
        category: 'general',
        tier: 3,
        kind: 'active',
        name: 'Second Wind',
        description: 'Restore 15 HP.',
        color: GENERAL_TALENT_COLOR,
        label: 'SW',
        use: { type: 'resourceDelta', resource: 'health', amount: 15 },
    },
    arcaneRecovery: {
        id: 'arcaneRecovery',
        category: 'general',
        tier: 3,
        kind: 'active',
        name: 'Arcane Recovery',
        description: 'Restore 15 EP.',
        color: GENERAL_TALENT_COLOR,
        label: 'AR',
        use: { type: 'resourceDelta', resource: 'energy', amount: 15 },
    },
    unbrokenSpirit: {
        id: 'unbrokenSpirit',
        category: 'general',
        tier: 3,
        kind: 'passive',
        name: 'Unbroken Spirit',
        description: 'Passively hardens the spirit.',
        color: GENERAL_TALENT_COLOR,
        label: 'US',
    },
    // 'primary' (classId-scoped) and 'secondary' (subclassId-scoped) talents
    // are real categories — see talentsFor/talentsByTier below — but have no
    // authored content yet.
};

// Tier N unlocks at level (N-1)*5 + 1 for general/primary — tier 1 is
// available immediately at level 1, not gated. Secondary can't start before
// SUBCLASS_UNLOCK_LEVEL (there's no subclass to gate before then), so its
// own tier 1 starts there and continues the same 5-level cadence.
export function tierUnlockLevel(category, tier) {
    if (category === 'secondary') return SUBCLASS_UNLOCK_LEVEL + (tier - 1) * 5;
    return (tier - 1) * 5 + 1;
}

// All talents in `category`, filtered by classId (primary) / subclassId
// (secondary) as relevant, sorted by tier.
export function talentsFor(category, { classId, subclassId } = {}) {
    return Object.values(TALENTS)
        .filter((t) => t.category === category)
        .filter((t) => category !== 'primary' || t.classId === classId)
        .filter((t) => category !== 'secondary' || t.subclassId === subclassId)
        .sort((a, b) => a.tier - b.tier);
}

// Same talents, grouped into unlock-ordered tier buckets — what the Talent
// panel actually renders per column. Only tiers with >=1 defined talent are
// included, so an empty future tier is never drawn.
export function talentsByTier(category, opts) {
    const byTier = new Map();
    for (const t of talentsFor(category, opts)) {
        if (!byTier.has(t.tier)) byTier.set(t.tier, []);
        byTier.get(t.tier).push(t);
    }
    return [...byTier.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([tier, talents]) => ({ tier, unlockLevel: tierUnlockLevel(category, tier), talents }));
}
