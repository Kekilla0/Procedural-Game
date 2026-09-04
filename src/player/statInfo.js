// Hover-tooltip text for every stat shown on the Character panel — base
// attributes and all three derived tiers (see computeDerivedStats in
// stats.js). Kept as plain description text, not exact formulas/numbers —
// this is in-game player-facing copy, not a design reference. Honest about
// what's not built yet (Attack, resistances) rather than overpromising.
// Shown when hovering a stat's label; hovering its number instead shows
// statBreakdown's source breakdown (see stats.js).
//
// `lines` are pre-wrapped (drawTooltip doesn't wrap text itself — it sizes
// the box to whatever's longest) rather than one long sentence per stat.
export const STAT_INFO = {
    strength: { label: 'Strength', lines: ['Raises Health, Carry Capacity,', 'and Fire Resistance.'] },
    dexterity: { label: 'Dexterity', lines: ['Raises Defense, Speed, and', 'Lightning Resistance.'] },
    intelligence: { label: 'Intelligence', lines: ['Raises Energy, Acuity, and', 'Arcane Resistance.'] },

    health: { label: 'Health', lines: ['Damage you can take before dying.', 'Scales with Strength and Level.'] },
    defense: { label: 'Defense', lines: ["Subtracted from an attacker's roll", 'before you take damage.', 'Scales with Dexterity.'] },
    energy: { label: 'Energy', lines: ['Spent on actively-used abilities.', 'Scales with Intelligence.'] },
    attack: { label: 'Attack', lines: ["Added to your attack rolls.", "Scales with your class's primary stat,", 'and (once subclassed) half as much', 'from your secondary stat.'] },

    carryCapacity: { label: 'Carry Capacity', lines: ['Number of inventory slots you have.', 'Scales with Strength.'] },
    speed: { label: 'Speed', lines: ['Actions available per combat round.', 'Scales with Dexterity — deliberately', 'the slowest-growing stat in the game.'] },
    acuity: { label: 'Acuity', lines: ['Added to your initiative roll, which', 'decides turn order in combat.', 'Scales with Intelligence.'] },

    fire: { label: 'Fire Resistance', lines: ['Reduces fire damage taken.', 'Scales with Strength.', 'Not yet used in combat.'] },
    lightning: { label: 'Lightning Resistance', lines: ['Reduces lightning damage taken.', 'Scales with Dexterity.', 'Not yet used in combat.'] },
    arcane: { label: 'Arcane Resistance', lines: ['Reduces arcane damage taken.', 'Scales with Intelligence.', 'Not yet used in combat.'] },

    blunt: { label: 'Blunt Resistance', lines: ['Reduces blunt damage taken.', 'Scales with Strength.', 'Not yet used in combat.'] },
    slash: { label: 'Slash Resistance', lines: ['Reduces slashing damage taken.', 'Scales with Dexterity.', 'Not yet used in combat.'] },
    pierce: { label: 'Pierce Resistance', lines: ['Reduces piercing damage taken.', 'Scales with Intelligence.', 'Not yet used in combat.'] },
};
