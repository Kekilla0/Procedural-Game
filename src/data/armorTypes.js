import { CLASSES } from './classes.js';
import { SUBCLASSES } from './subclasses.js';
import { RARITIES, rollRarity } from './rarities.js';
import { ARMOR_SLOTS } from './armorSlots.js';
import { ITEM_TYPES } from '../items/itemTypes.js';

// 5 armor weight tiers, each associated with a subset of the 12 classes (3
// core + 9 subclasses) — the user's own table. `name` here is the generic
// tier label (used for the Spawn Armor debug tool's Type dropdown) — an
// actual rolled item's display name/value comes from CLASS_ARMOR below, not
// from this object, once a specific class has been picked for it.
// `minLevel` is a hard floor (not a soft weight shift, per the user's own
// choice) below which a tier can never be randomly rolled (see
// rollRandomArmor below) — reuses the exact same 1/5/10/15/20 milestone
// cadence already established by rarities.js's rarity-by-level curve
// (LEVELS_PER_SHIFT=5), deliberately for consistency, not a coincidence.
export const ARMOR_TYPES = {
    light: { id: 'light', name: 'Light Armor', classIds: ['mage', 'archmage'], minLevel: 1 },
    lightMedium: { id: 'lightMedium', name: 'Light-Medium Armor', classIds: ['mageblade', 'spellsword'], minLevel: 5 },
    medium: { id: 'medium', name: 'Medium Armor', classIds: ['battlemage', 'rogue', 'assassin', 'mageknight'], minLevel: 10 },
    mediumHeavy: { id: 'mediumHeavy', name: 'Medium-Heavy Armor', classIds: ['swashbuckler', 'hunter'], minLevel: 15 },
    heavy: { id: 'heavy', name: 'Heavy Armor', classIds: ['warrior', 'barbarian'], minLevel: 20 },
};

// One named armor per class (the user's own worked example: Warrior/Heavy/
// "Splint"). `value` is a per-class refinement of the tier's base value —
// tierBase + 0.5 * (the class's index within its tier's classIds list),
// floored wherever it's actually used as Defense (see classArmorBaseDefense
// below). Half-integer granularity means a tier with only 2 members (most
// of them) stays uniform after flooring (e.g. mage=1.0, archmage=1.5 both
// floor to 1), but Medium's 4 members span a full point (3.0/3.5 floor to
// 3, 4.0/4.5 floor to 4) — larger tiers naturally show more internal
// variety instead of every member being numerically identical, per the
// user's own "on some [tiers], some [classes] go up more than others" idea.
// Deliberately a proposed first pass, not exhaustively re-balanced.
export const CLASS_ARMOR = {
    mage: { name: 'Raiment', value: 1.0 },
    archmage: { name: 'Vestments', value: 1.5 },
    mageblade: { name: 'Jerkin', value: 2.0 },
    spellsword: { name: 'Doublet', value: 2.5 },
    battlemage: { name: 'Cuirass', value: 3.0 },
    rogue: { name: 'Leathers', value: 3.5 },
    assassin: { name: 'Wraps', value: 4.0 },
    mageknight: { name: 'Chain', value: 4.5 },
    swashbuckler: { name: 'Brigandine', value: 4.0 },
    hunter: { name: 'Scale', value: 4.5 },
    warrior: { name: 'Splint', value: 5.0 },
    barbarian: { name: 'Plate', value: 5.5 },
};

// The actual Defense an item made with this class's flavor grants — the
// half-integer `value` above rounded down at the point of use, not stored
// pre-rounded, so the raw value stays inspectable/retunable on its own.
export function classArmorBaseDefense(classId) {
    return Math.floor(CLASS_ARMOR[classId]?.value ?? 0);
}

// Picks which of an armor type's associated classes supplies a freshly
// rolled item's flavor (name + exact Defense value) — uniform random, not
// weighted, so e.g. a "Medium" roll shows up as Battlemage's Cuirass one
// time and Mageknight's Chain another. The affix roll itself (rollAffixes
// below) still weights by the WHOLE tier's class-list, independent of which
// single class ends up supplying the name.
export function pickClassFlavor(armorTypeId) {
    const classIds = ARMOR_TYPES[armorTypeId].classIds;
    return classIds[Math.floor(Math.random() * classIds.length)];
}

// Every stat's "governing attribute" — derived directly from that stat's own
// formula in stats.js (health/carryCapacity/fire scale off strength,
// defense/speed/lightning off dexterity, energy/acuity/arcane off
// intelligence; base attributes govern themselves). Attack has no governing
// attribute here — its primary/secondary split depends on whichever class
// *wears* the item, not a fixed property of the item itself, so it only
// ever gets the flat BASE_WEIGHT below, never a class-affinity bonus.
//
// blunt/pierce/slash are the 3 physical resistances added alongside the
// existing 3 magic ones (fire/lightning/arcane) — governing attributes are
// a first-pass proposal, not strongly settled: Strength->Blunt (raw
// toughness absorbs impact), Dexterity->Slash (reflexes/angle away from a
// cutting blow, consistent with Dexterity already governing Defense),
// Intelligence->Pierce (completes the clean 1-magic+1-physical-per-attribute
// symmetry — the weakest narrative fit of the three, most negotiable).
export const STAT_GOVERNING_ATTRIBUTE = {
    strength: 'strength',
    dexterity: 'dexterity',
    intelligence: 'intelligence',
    health: 'strength',
    defense: 'dexterity',
    energy: 'intelligence',
    attack: null,
    carryCapacity: 'strength',
    speed: 'dexterity',
    acuity: 'intelligence',
    fire: 'strength',
    lightning: 'dexterity',
    arcane: 'intelligence',
    blunt: 'strength',
    pierce: 'intelligence',
    slash: 'dexterity',
};

export const ALL_STAT_KEYS = Object.keys(STAT_GOVERNING_ATTRIBUTE);

// Same 2:1 primary:secondary ratio already used by the Attack formula
// (ATTACK_PER_SQRT_ATTRIBUTE, 1.0 vs 0.5) and subclass color-blending
// (PRIMARY_WEIGHT, 2/3 vs 1/3) — reused here for consistency, not
// independently chosen. BASE_WEIGHT gives every stat a floor chance even on
// a class this armor type isn't associated with ("any class can wear any
// item, just less likely to roll favorably").
const PRIMARY_BONUS = 2;
const SECONDARY_BONUS = 1;
const BASE_WEIGHT = 1;

// Factor B: which stats thematically fit a given slot (your own examples —
// chest->defense, boots->speed — extended the same way to the rest). A
// stat in its slot's list gets SLOT_BONUS, same scale as SECONDARY_BONUS so
// no one factor dominates the roll.
const SLOT_STAT_AFFINITY = {
    head: ['acuity', 'energy'],
    shoulders: ['defense', 'carryCapacity'],
    chest: ['defense', 'health'],
    hands: ['attack', 'dexterity'],
    belt: ['carryCapacity', 'energy'],
    arms: ['defense', 'attack'],
    pants: ['health', 'defense'],
    boots: ['speed', 'dexterity'],
};
const SLOT_BONUS = 2;

// Factor C: how much investing in a stat actually helps right now — a
// 6-tier ranking (the user's own re-rank, given as inline feedback on the
// original 3-tier High/Medium/Low version):
const MAGNITUDE_TOP = 5;       // Speed — "the single most important stat," alone at the top
const MAGNITUDE_ATTRIBUTE = 4; // Strength/Dexterity/Intelligence — ripple into multiple derived
                                // stats at once (Str->Health+Attack, Dex->Defense+Speed[+Attack],
                                // Int->Energy+Acuity[+Attack], depending on which class's
                                // primary/secondary it is), so worth more than any single
                                // derived stat they feed
const MAGNITUDE_COMBAT = 3;    // Health/Defense/Attack — directly protect/enable the player,
                                // but now ranked below the attributes that drive them
const MAGNITUDE_UTILITY = 2;   // Acuity/Energy — useful but secondary (Energy explicitly
                                // demoted from its old top tier; Acuity placed alongside it,
                                // same governing attribute, not separately specified)
const MAGNITUDE_MINOR = 1;     // CarryCapacity — explicitly "should be low," kept one notch
                                // above the mechanically-inert resistances since it does
                                // something (resizes the inventory grid) even if minor
const MAGNITUDE_INERT = 0;     // all 6 resistances — mechanically unused until combat exists
const STAT_MAGNITUDE = {
    speed: MAGNITUDE_TOP,
    strength: MAGNITUDE_ATTRIBUTE,
    dexterity: MAGNITUDE_ATTRIBUTE,
    intelligence: MAGNITUDE_ATTRIBUTE,
    health: MAGNITUDE_COMBAT,
    defense: MAGNITUDE_COMBAT,
    attack: MAGNITUDE_COMBAT,
    acuity: MAGNITUDE_UTILITY,
    energy: MAGNITUDE_UTILITY,
    carryCapacity: MAGNITUDE_MINOR,
    fire: MAGNITUDE_INERT,
    lightning: MAGNITUDE_INERT,
    arcane: MAGNITUDE_INERT,
    blunt: MAGNITUDE_INERT,
    pierce: MAGNITUDE_INERT,
    slash: MAGNITUDE_INERT,
};

// How much each of the 3 base attributes is "favored" by an armor type's
// associated classes — a core-class entry (e.g. 'mage') contributes its
// primaryAttribute only; a subclass entry contributes its core class's
// primaryAttribute AND its own secondaryAttribute. When primary and
// secondary land on the same attribute (a "pure" subclass like Assassin —
// Rogue's own primary is already Dexterity, and Assassin's secondary is
// also Dexterity) both bonuses stack on that one attribute, same pattern
// already established for Attack/subclass-color-blending.
function computeAttributeAffinity(armorTypeId) {
    const affinity = { strength: 0, dexterity: 0, intelligence: 0 };
    for (const classId of ARMOR_TYPES[armorTypeId].classIds) {
        const cls = CLASSES[classId];
        if (cls) {
            affinity[cls.primaryAttribute] += PRIMARY_BONUS;
            continue;
        }
        const sub = SUBCLASSES[classId];
        affinity[CLASSES[sub.coreClass].primaryAttribute] += PRIMARY_BONUS;
        affinity[sub.secondaryAttribute] += SECONDARY_BONUS;
    }
    return affinity;
}

// Combines all 3 factors: A (class/tier affinity, via the governing
// attribute), B (slot thematic fit), C (stat magnitude/impact) — additive,
// same as each factor already was on its own.
function computeStatWeights(armorTypeId, slotId) {
    const affinity = computeAttributeAffinity(armorTypeId);
    const slotStats = SLOT_STAT_AFFINITY[slotId] ?? [];
    const weights = {};
    for (const stat of ALL_STAT_KEYS) {
        const governor = STAT_GOVERNING_ATTRIBUTE[stat];
        const classBonus = governor ? affinity[governor] : 0;
        const slotBonus = slotStats.includes(stat) ? SLOT_BONUS : 0;
        const magnitudeBonus = STAT_MAGNITUDE[stat] ?? 0;
        weights[stat] = BASE_WEIGHT + classBonus + slotBonus + magnitudeBonus;
    }
    return weights;
}

// How much a single stat point (a base-Defense roll or one affix) is worth
// at a given item level — fit exactly to the user's own worked example
// (level 1 rolls 1-2, level 5 rolls 2-5): the low end grows slowly
// (+0.25/level), the high end grows faster (+0.75/level), so the range
// widens the further above level 1 an item drops. One shared curve for
// every stat (not tuned per-stat) — a deliberate simplification matching
// the user's generic "for a given stat" framing.
const STAT_ROLL_LOW_BASE = 1;
const STAT_ROLL_HIGH_BASE = 2;
const STAT_ROLL_LOW_RATE = 0.25;
const STAT_ROLL_HIGH_RATE = 0.75;
export function rollStatRange(level) {
    const low = Math.round(STAT_ROLL_LOW_BASE + STAT_ROLL_LOW_RATE * (level - 1));
    const high = Math.round(STAT_ROLL_HIGH_BASE + STAT_ROLL_HIGH_RATE * (level - 1));
    return low + Math.floor(Math.random() * (high - low + 1));
}

// Rolls `count` distinct stats from the weighted pool, without replacement
// (each chosen stat is removed before the next roll) — "removing any stat
// increase that we achieve as we go" per the original request. Each affix's
// amount is now a level-scaled range roll (rollStatRange) instead of a flat
// +1.
export function rollAffixes(armorTypeId, count, slotId, level) {
    const weights = computeStatWeights(armorTypeId, slotId);
    const pool = [...ALL_STAT_KEYS];
    const chosen = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
        const total = pool.reduce((sum, stat) => sum + weights[stat], 0);
        let roll = Math.random() * total;
        let picked = pool[pool.length - 1];
        for (const stat of pool) {
            roll -= weights[stat];
            if (roll <= 0) {
                picked = stat;
                break;
            }
        }
        chosen.push({ stat: picked, amount: rollStatRange(level) });
        pool.splice(pool.indexOf(picked), 1);
    }
    return chosen;
}

// The real ITEM_TYPES entry a given armor slot's rolled items use — the
// pairing lives in armorSlots.js (ARMOR_SLOTS), this just resolves it.
export function itemTypeForSlot(slotId) {
    return ITEM_TYPES[ARMOR_SLOTS[slotId].itemTypeId];
}

// Assembles one rolled item's `.armor` data given a type, rarity, and slot
// that are already decided (by a caller that knows all three, e.g. the
// Spawn Armor debug tool) — rolls the affixes and the class flavor, the two
// genuinely random parts, and builds the display name (material + the
// slot's generic suffix, e.g. "Splint Greaves"). The single place both
// armorSpawnPopup.js and world loot (see rollRandomArmor below) build this
// shape, so they can't drift apart.
//
// `level` (the item's own drop level — the same "dungeon depth" stand-in
// rollRarity already uses) now also drives the level-scaled value range
// (rollStatRange). Final Defense is computed once here and stored on the
// returned data (not left to be recomputed later from just `classId`, since
// it now also depends on `slotId` and `level`): the class/tier anchor
// (classArmorBaseDefense) plus a level-scaled roll, both then scaled by the
// slot's defenseWeight — scaling the *combined* total (not just the tier
// anchor) keeps a low-defenseWeight slot like Belt meaningfully weaker than
// Chest even at high level, where the additive level-roll would otherwise
// dominate and wash out the slot-importance signal.
export function buildArmorItemData(armorTypeId, rarityId, slotId, level = 1) {
    const rarity = RARITIES[rarityId];
    const affixes = rollAffixes(armorTypeId, rarity.affixCount, slotId, level);
    const classId = pickClassFlavor(armorTypeId);
    const name = `${CLASS_ARMOR[classId].name} ${ARMOR_SLOTS[slotId].suffix}`;
    const defense = Math.max(1, Math.round((classArmorBaseDefense(classId) + rollStatRange(level)) * ARMOR_SLOTS[slotId].defenseWeight));
    return { armorTypeId, classId, rarityId, affixes, name, slotId, level, defense };
}

// Fully random armor: also picks the slot AND the type itself (both
// uniformly, unlike the affix roll's weighting — a piece of loot doesn't
// know in advance who's going to want it), respecting both that slot's own
// allowed tiers (e.g. Belt never rolls Heavy — see armorSlots.js) AND each
// tier's hard level floor (ARMOR_TYPES[x].minLevel — e.g. Heavy never rolls
// before level 20) before rolling rarity at `level` and handing off to
// buildArmorItemData for the rest. This is what world loot (a ground item,
// a container's contents) uses — the debug spawner instead lets slot + type
// be chosen explicitly (see armorSpawnPopup.js, which applies the same
// minLevel filter to its own Type dropdown so it mirrors real drops).
export function rollRandomArmor(level = 1) {
    const slotIds = Object.keys(ARMOR_SLOTS);
    const slotId = slotIds[Math.floor(Math.random() * slotIds.length)];
    const allowedTierIds = ARMOR_SLOTS[slotId].allowedTierIds;
    // Light's minLevel is 1, so this is never empty in practice — the
    // fallback just guards against a future tier ever being added with a
    // higher floor than the slot's lowest allowed tier.
    const eligibleTierIds = allowedTierIds.filter((id) => level >= ARMOR_TYPES[id].minLevel);
    const pickFrom = eligibleTierIds.length > 0 ? eligibleTierIds : [allowedTierIds[0]];
    const armorTypeId = pickFrom[Math.floor(Math.random() * pickFrom.length)];
    const rarityId = rollRarity(level);
    return buildArmorItemData(armorTypeId, rarityId, slotId, level);
}
