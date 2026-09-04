import { CLASSES } from './classes.js';
import { mixColors } from '../utils/color.js';

// The 3x3 subclass matrix — one subclass per (core class × secondary stat)
// combination, including "same as primary" for the pure-investment variant
// (Barbarian/Assassin/Archmage). Confirmed by the user as a full table, not
// yet exposed anywhere except SubclassSelectPopup. Unlocks at level 10
// (SUBCLASS_UNLOCK_LEVEL) and is permanent once chosen — no respec.
export const SUBCLASS_UNLOCK_LEVEL = 10;

// Each base attribute's "identity color" is just its class's color — the
// class whose primaryAttribute is that attribute (see classes.js: Strength
// -> Warrior/red, Dexterity -> Rogue/yellow, Intelligence -> Mage/blue).
// Exported so CharacterPanel can color a secondary attribute's row with its
// own identity color (not the core class's color) once a subclass is chosen.
export const ATTRIBUTE_COLORS = {
    strength: CLASSES.warrior.color,
    dexterity: CLASSES.rogue.color,
    intelligence: CLASSES.mage.color,
};

// A subclass's color is a weighted mix of its core class's color and its
// secondary attribute's color — same 2:1 ratio as the Attack formula's
// primary:secondary weighting (1.0 vs 0.5), so e.g. a Warrior/Dexterity
// subclass (Hunter) reads as a red-leaning orange, not a neutral one. When
// primary and secondary are the same attribute (Barbarian/Assassin/Archmage)
// this naturally collapses to the class's own plain color — mixing a color
// with itself changes nothing, which is exactly right for the "pure"
// subclasses.
const PRIMARY_WEIGHT = 2 / 3;

function subclassColor(coreClassId, secondaryAttribute) {
    return mixColors(CLASSES[coreClassId].color, ATTRIBUTE_COLORS[secondaryAttribute], PRIMARY_WEIGHT);
}

export const SUBCLASSES = {
    barbarian: { id: 'barbarian', coreClass: 'warrior', name: 'Barbarian', description: 'Pure brute force and relentless melee rage.', secondaryAttribute: 'strength', color: subclassColor('warrior', 'strength') },
    hunter: { id: 'hunter', coreClass: 'warrior', name: 'Hunter', description: 'Athletic combatant using ranged or skirmish weapons.', secondaryAttribute: 'dexterity', color: subclassColor('warrior', 'dexterity') },
    mageknight: { id: 'mageknight', coreClass: 'warrior', name: 'Mageknight', description: 'Heavy armored soldier utilizing protective arcana.', secondaryAttribute: 'intelligence', color: subclassColor('warrior', 'intelligence') },

    swashbuckler: { id: 'swashbuckler', coreClass: 'rogue', name: 'Swashbuckler', description: 'High-mobility fighter using physical power and leverage.', secondaryAttribute: 'strength', color: subclassColor('rogue', 'strength') },
    assassin: { id: 'assassin', coreClass: 'rogue', name: 'Assassin', description: 'Pure speed, stealth, and rapid critical hits.', secondaryAttribute: 'dexterity', color: subclassColor('rogue', 'dexterity') },
    spellsword: { id: 'spellsword', coreClass: 'rogue', name: 'Spellsword', description: 'Agile skirmisher weaving teleports and illusions into blade strikes.', secondaryAttribute: 'intelligence', color: subclassColor('rogue', 'intelligence') },

    battlemage: { id: 'battlemage', coreClass: 'mage', name: 'Battlemage', description: 'Juggernaut using magic to grant themselves heavy physical power.', secondaryAttribute: 'strength', color: subclassColor('mage', 'strength') },
    mageblade: { id: 'mageblade', coreClass: 'mage', name: 'Mageblade', description: 'Swift martial artist shaping hard-light weapons out of thin air.', secondaryAttribute: 'dexterity', color: subclassColor('mage', 'dexterity') },
    archmage: { id: 'archmage', coreClass: 'mage', name: 'Archmage', description: 'Pure arcane dominance, relying on raw energy and magic shields.', secondaryAttribute: 'intelligence', color: subclassColor('mage', 'intelligence') },
};

export function subclassesFor(coreClassId) {
    return Object.values(SUBCLASSES).filter((s) => s.coreClass === coreClassId);
}
