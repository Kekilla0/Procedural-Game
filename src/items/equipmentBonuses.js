import { ALL_STAT_KEYS, classArmorBaseDefense } from '../data/armorTypes.js';

// A flat 12-key map (all ALL_STAT_KEYS), every value 0 — the default
// `computeDerivedStats`/`statBreakdown` fall back to when nothing's
// equipped, and the base every real bonus map starts from. Frozen since
// it's shared/reused, never mutated in place.
export const ZERO_BONUSES = Object.freeze(
    Object.fromEntries(ALL_STAT_KEYS.map((stat) => [stat, 0]))
);

// Sums every equipped item's contribution into one flat per-stat map: an
// armor piece's own final rolled Defense (computed once at roll time in
// buildArmorItemData, incorporating class/tier + slot importance + item
// level — see armorTypes.js) goes into `defense`, and each of its rolled
// affixes adds into that affix's own stat. Non-armor equipment (nothing
// currently has `.armor`) contributes nothing.
//
// Falls back to the old classId-only computation for items rolled before
// `.defense` started being stored on the armor data, so a pre-existing save
// keeps working without a migration step.
export function computeEquipmentBonuses(equipment) {
    const bonuses = { ...ZERO_BONUSES };
    for (const item of Object.values(equipment.slots)) {
        if (!item?.armor) continue;
        bonuses.defense += item.armor.defense ?? classArmorBaseDefense(item.armor.classId);
        for (const affix of item.armor.affixes ?? []) {
            bonuses[affix.stat] = (bonuses[affix.stat] ?? 0) + affix.amount;
        }
    }
    return bonuses;
}
