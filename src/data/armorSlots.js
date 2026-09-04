// Deliberately NOT imported from armorTypes.js's ARMOR_TYPES keys — this
// file has no imports so armorTypes.js can safely import ARMOR_SLOTS back
// (rollRandomArmor needs it) without a cycle. Must stay in sync with
// ARMOR_TYPES' own keys by hand (light/lightMedium/medium/mediumHeavy/heavy)
// — there are only 5, unlikely to drift.
const ALL_TIER_IDS = ['light', 'lightMedium', 'medium', 'mediumHeavy', 'heavy'];

// The 8 real armor slots (see characterPanel.js's EQUIP_SLOTS — neck/rings/
// weapon hands are excluded, they're not armor). `suffix` is the generic
// per-slot word appended to a class's CLASS_ARMOR material name to build a
// rolled item's display name (e.g. Warrior's "Splint" -> "Splint Greaves"
// for pants) — deliberately none of these collide with an existing material
// name (notably "Chestplate", not "Cuirass" — that's already Battlemage's
// material). `allowedTierIds` is every weight tier except for Belt, capped
// to Light/Light-Medium/Medium — even a Barbarian in full plate wears a
// functional strap for a belt, not slab armor; the other 7 slots are all
// legitimate full-scale armor pieces at any weight, so no other cap is
// proposed this pass.
//
// `defenseWeight` scales a rolled item's final Defense by how much real
// protection that body part represents (chest/head/legs cover the most
// vital/largest area; shoulders/arms partial coverage; hands/boots are
// extremities; belt is genuinely minimal, same "strap not slab armor" logic
// that already caps its allowed tiers above) — a proposed first pass, easy
// to retune. Applied in armorTypes.js's buildArmorItemData.
export const ARMOR_SLOTS = {
    head: { id: 'head', itemTypeId: 'helm', suffix: 'Helm', allowedTierIds: ALL_TIER_IDS, defenseWeight: 0.7 },
    shoulders: { id: 'shoulders', itemTypeId: 'shoulderArmor', suffix: 'Pauldrons', allowedTierIds: ALL_TIER_IDS, defenseWeight: 0.6 },
    chest: { id: 'chest', itemTypeId: 'chestArmor', suffix: 'Chestplate', allowedTierIds: ALL_TIER_IDS, defenseWeight: 1.0 },
    hands: { id: 'hands', itemTypeId: 'gloveArmor', suffix: 'Gauntlets', allowedTierIds: ALL_TIER_IDS, defenseWeight: 0.45 },
    belt: { id: 'belt', itemTypeId: 'belt', suffix: 'Belt', allowedTierIds: ['light', 'lightMedium', 'medium'], defenseWeight: 0.2 },
    arms: { id: 'arms', itemTypeId: 'armArmor', suffix: 'Bracers', allowedTierIds: ALL_TIER_IDS, defenseWeight: 0.6 },
    pants: { id: 'pants', itemTypeId: 'legArmor', suffix: 'Greaves', allowedTierIds: ALL_TIER_IDS, defenseWeight: 0.7 },
    boots: { id: 'boots', itemTypeId: 'bootArmor', suffix: 'Boots', allowedTierIds: ALL_TIER_IDS, defenseWeight: 0.45 },
};
