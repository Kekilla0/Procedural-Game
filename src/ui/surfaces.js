import { hitTestInventoryItem, gridDimensions, cellAt } from './inventoryGridRenderer.js';
import { equipToDefaultSlot, unequipToInventory } from '../items/equipment.js';
import { transferItem } from '../items/loot.js';
import { dropAt } from '../world/drop.js';
import { useItemType } from '../player/actionBar.js';
import { syncHealthFromAttributes, syncEnergyFromAttributes, syncCarryCapacityFromAttributes } from '../player/stats.js';

// Equip/unequip can change Health/Energy max and Carry Capacity (see
// hud.js's _resyncResources, the same fix applied to the drag-and-drop
// equip path) — the right-click Equip/Unequip actions below are a second,
// independent mutation path that needs the same live resync, not just
// whatever the next level-up happens to pick up.
function resyncResources(player, level) {
    syncHealthFromAttributes(player);
    syncEnergyFromAttributes(player);
    syncCarryCapacityFromAttributes(player, level);
}

// A "surface" is anything Hud can resolve a cursor position against — the
// inventory grid, an open container's grid, or the equipment slot grid.
// Unifies what used to be four separate copy-pasted "container -> equipment
// -> inventory" hit-test chains (hover tooltip, drag-start, drop-target,
// context menu) into one shape each of the three implements, so Hud only
// has to walk the list once per concern instead of once per call site.
//
// getInventory/getOrigin/getScale/isOpen are all getters (not snapshotted
// values) so a surface built once in Hud's constructor stays correct as
// panels open/close and as the player object itself is swapped out (new
// game / load game) — see Hud._currentPlayer.

// Shared by the player inventory panel and an open container's panel — both
// are grid-backed Inventory instances, differing only in what they hold and
// what right-click actions make sense on them.
export function createGridSurface(type, getInventory, getOrigin, getScale, isOpen) {
    return {
        type, // 'inventory' | 'container'

        hitTest(x, y) {
            if (!isOpen()) return null;
            const origin = getOrigin();
            if (!origin) return null;
            return hitTestInventoryItem(getInventory(), origin.x, origin.y, getScale(), x, y);
        },

        containsPoint(x, y) {
            if (!isOpen()) return false;
            const origin = getOrigin();
            if (!origin) return false;
            const dims = gridDimensions(getInventory(), getScale());
            return x >= origin.x && x <= origin.x + dims.width && y >= origin.y && y <= origin.y + dims.height;
        },

        slotAt() {
            return null; // grid surfaces drop anywhere there's room, not at a specific slot
        },

        // The grid cell under (x,y), for drag-and-drop placement — where the
        // item actually gets dropped, not just "somewhere with room."
        cellAt(x, y) {
            const origin = getOrigin();
            if (!origin) return { col: -1, row: -1 };
            return cellAt(origin.x, origin.y, getScale(), x, y);
        },

        // Player-inventory items can be Equipped/Used/Dropped (onto the
        // player's own tile — see world/drop.js); container items can only
        // be Taken (moved into the player's inventory) — right-click on a
        // container item is new with this refactor, previously unsupported.
        // "Use" is deliberately inventory-only, not offered on a container
        // item still sitting unlooted — take it first.
        contextActionsFor(item, player, x, y, level) {
            const inventory = getInventory();
            if (type === 'container') {
                return [{ label: 'Take', onSelect: () => transferItem(inventory, player.inventory, item.id) }];
            }
            const options = [];
            if (item.itemType.validSlots) {
                options.push({
                    label: 'Equip',
                    onSelect: () => {
                        if (equipToDefaultSlot(inventory, player.equipment, item)) resyncResources(player, level);
                    },
                });
            }
            if (item.itemType.use) {
                options.push({ label: 'Use', onSelect: () => useItemType(inventory, player, item.itemType.id) });
            }
            options.push({ label: 'Drop', onSelect: () => dropAt(level, inventory, item, 1, player.col, player.row) });
            if (item.itemType.stackable) {
                options.push({
                    label: 'Drop All',
                    onSelect: () => dropAt(level, inventory, item, item.quantity, player.col, player.row),
                });
            }
            return options;
        },
    };
}

export function createEquipmentSurface(getEquipment, characterPanel, isOpen) {
    return {
        type: 'equipment',

        hitTest(x, y) {
            if (!isOpen()) return null;
            const slotId = characterPanel.getSlotAt(x, y);
            return slotId ? getEquipment().get(slotId) : null;
        },

        containsPoint(x, y) {
            return isOpen() && characterPanel.getSlotAt(x, y) !== null;
        },

        slotAt(x, y) {
            if (!isOpen()) return null;
            return characterPanel.getSlotAt(x, y);
        },

        // Right-click Unequip is new with this refactor — previously only
        // reachable by dragging the item out.
        contextActionsFor(item, player, x, y, level) {
            const slotId = characterPanel.getSlotAt(x, y);
            if (!slotId) return [];
            return [
                {
                    label: 'Unequip',
                    onSelect: () => {
                        if (unequipToInventory(getEquipment(), player.inventory, slotId)) resyncResources(player, level);
                    },
                },
            ];
        },
    };
}
