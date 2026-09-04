import { ITEM_TYPES } from './itemTypes.js';

// Equipped items live here, separate from the inventory grid — one item per
// named slot, regardless of what footprint that item type has in the grid.
export class Equipment {
    constructor() {
        this.slots = {}; // slotId -> item ({id, itemType, quantity}) | absent
    }

    get(slotId) {
        return this.slots[slotId] ?? null;
    }

    // Returns whatever was previously in the slot (or null).
    equip(slotId, item) {
        const previous = this.slots[slotId] ?? null;
        this.slots[slotId] = item;
        return previous;
    }

    unequip(slotId) {
        const item = this.slots[slotId] ?? null;
        delete this.slots[slotId];
        return item;
    }

    serialize() {
        const slots = {};
        for (const [slotId, item] of Object.entries(this.slots)) {
            slots[slotId] = {
                itemTypeId: item.itemType.id,
                quantity: item.quantity,
                ...(item.armor ? { armor: item.armor } : {}),
            };
        }
        return { slots };
    }

    // Skips slots whose saved item type no longer exists in the registry
    // instead of throwing. Equipped items never stack (no current equippable
    // item type is stackable), so ids don't need to be meaningful here.
    static deserialize(data) {
        const equipment = new Equipment();
        let nextId = 1;
        for (const [slotId, saved] of Object.entries(data.slots ?? {})) {
            const itemType = ITEM_TYPES[saved.itemTypeId];
            if (!itemType) {
                console.warn(`Equipment.deserialize: unknown item type "${saved.itemTypeId}", skipping slot "${slotId}"`);
                continue;
            }
            equipment.slots[slotId] = {
                id: nextId++,
                itemType,
                quantity: saved.quantity,
                ...(saved.armor ? { armor: saved.armor } : {}),
            };
        }
        return equipment;
    }
}

export function canEquip(itemType, slotId) {
    return Array.isArray(itemType.validSlots) && itemType.validSlots.includes(slotId);
}

// Moves `item` from the inventory into slotId, swapping out whatever was
// equipped there (back into the inventory) if anything. Rolls back entirely
// if the swapped-out item can't fit back in the inventory, so nothing is
// ever lost. Returns true on success.
export function equipItem(inventory, equipment, item, slotId) {
    if (!canEquip(item.itemType, slotId)) return false;

    inventory.removeItem(item.id);
    const previous = equipment.equip(slotId, item);

    if (previous) {
        const quantity = previous.quantity ?? 1;
        const added = inventory.addItem(previous.itemType, quantity, previous.armor ?? null);
        if (added < quantity) {
            // Not enough room to swap the old item out — undo everything.
            equipment.equip(slotId, previous);
            inventory.addItem(item.itemType, item.quantity ?? 1, item.armor ?? null);
            return false;
        }
    }

    return true;
}

// Right-click "Equip": picks an empty valid slot if one exists, otherwise the
// first valid slot (which will swap with whatever's equipped there).
export function equipToDefaultSlot(inventory, equipment, item) {
    const slots = item.itemType.validSlots;
    if (!slots || slots.length === 0) return false;

    const targetSlot = slots.find((slotId) => !equipment.get(slotId)) ?? slots[0];
    return equipItem(inventory, equipment, item, targetSlot);
}

// Unequips slotId into inventory. Leaves the item equipped (no-op) if there's
// no room. Assumes equipped items never stack (true of every current
// equippable type), so a failed addItem can't leave a partial stack behind —
// it's always all-or-nothing.
export function unequipToInventory(equipment, inventory, slotId) {
    const item = equipment.get(slotId);
    if (!item) return false;

    const added = inventory.addItem(item.itemType, item.quantity ?? 1, item.armor ?? null);
    if (added < (item.quantity ?? 1)) return false;

    equipment.unequip(slotId);
    return true;
}

// Like unequipToInventory, but tries to land at an exact (col,row) first —
// matching wherever the drag was dropped — falling back to auto-placement if
// that spot doesn't work out. Still all-or-nothing (equipped items never
// stack, so there's no partial-placement case to worry about).
export function unequipToInventoryAt(equipment, inventory, slotId, col, row) {
    const item = equipment.get(slotId);
    if (!item) return false;
    const quantity = item.quantity ?? 1;

    let remaining = inventory.placeAt(item.itemType, quantity, col, row, item.armor ?? null);
    if (remaining === quantity) {
        remaining = quantity - inventory.addItem(item.itemType, quantity, item.armor ?? null);
    }
    if (remaining > 0) return false;

    equipment.unequip(slotId);
    return true;
}

// Swaps the items in two equipment slots (or just moves fromSlotId's item
// into toSlotId if it's empty). Fails without mutating anything if either
// item isn't valid for the slot it would end up in.
export function swapEquipmentSlots(equipment, fromSlotId, toSlotId) {
    if (fromSlotId === toSlotId) return false;

    const fromItem = equipment.get(fromSlotId);
    if (!fromItem || !canEquip(fromItem.itemType, toSlotId)) return false;

    const toItem = equipment.get(toSlotId);
    if (toItem && !canEquip(toItem.itemType, fromSlotId)) return false;

    equipment.equip(toSlotId, fromItem);
    if (toItem) equipment.equip(fromSlotId, toItem);
    else equipment.unequip(fromSlotId);
    return true;
}
