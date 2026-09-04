import { ITEM_TYPES } from '../items/itemTypes.js';
import { TALENTS } from '../data/talents.js';
import { applyUse } from '../items/useEffects.js';

export const ACTION_BAR_SIZE = 6;

// Uses one unit of an item type from the player's own inventory — consumes
// it (see Inventory.consumeOne) and applies its effect. No-ops (but still
// consumes) if the item somehow has no `use` — callers are expected to have
// only assigned usable item types to begin with (see surfaces.js's "Use"
// context option and Hud's action-bar assignment, both gated on
// `itemType.use`), so this isn't re-checked defensively here.
export function useItemType(inventory, player, itemTypeId) {
    const itemType = ITEM_TYPES[itemTypeId];
    if (!itemType) return;
    if (!inventory.consumeOne(itemTypeId)) return; // player no longer has any — nothing to use
    applyUse(itemType.use, player);
}

// Talents aren't held items — using one just applies its effect. Never
// removed from player.talents; granting a talent is permanent (see
// player.js, settingsPopup.js's debug "Grant talent").
export function useTalent(player, talentId) {
    const talent = TALENTS[talentId];
    if (!talent) return;
    applyUse(talent.use, player);
}

// The single "use slot N" entry point — shared by a click on the action bar
// and a 1-6 keypress (see viewportScreen.js), so there is exactly one
// implementation of "what happens when you trigger this slot."
export function useActionSlot(player, index) {
    const slot = player.actionBar[index];
    if (!slot) return;
    if (slot.type === 'item') useItemType(player.inventory, player, slot.itemTypeId);
    else if (slot.type === 'talent') useTalent(player, slot.talentId);
}

// Validates one deserialized action-bar slot against the live registries —
// an item type or talent removed/renamed since the save was made just clears
// that slot instead of leaving a dangling reference. Mirrors the
// unknown-item-type handling already in Inventory.deserialize.
export function sanitizeActionSlot(slot) {
    if (!slot) return null;
    if (slot.type === 'item' && ITEM_TYPES[slot.itemTypeId]) return slot;
    if (slot.type === 'talent' && TALENTS[slot.talentId]) return slot;
    return null;
}
