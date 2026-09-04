import { Inventory } from '../items/inventory.js';

const PILE_COLS = 4;
const PILE_ROWS = 4;

// A single dropped item sits on the ground exactly like any other ground
// item (see the helm in testLevel.js) — interact picks it up directly, no
// container panel involved. Tracks its own quantity so a dropped stack
// (Drop All) is still one entity, not one per unit. `armor`, when the
// dropped item was a rolled armor piece, rides along on the entity itself
// (mirroring an inventory item's `.armor` field) and is passed back through
// on pickup so the roll isn't lost.
function createDroppedItem(col, row, itemType, quantity, armor = null) {
    return {
        col,
        row,
        blocksMovement: false,
        type: 'item',
        itemType,
        quantity,
        ...(armor ? { armor } : {}),
        isDroppedItem: true,
        interactable: true,
        interact(entity, level, inventory) {
            const added = inventory.addItem(entity.itemType, entity.quantity, entity.armor ?? null);
            if (added >= entity.quantity) {
                level.removeEntity(entity);
            } else {
                entity.quantity -= added;
            }
        },
    };
}

// A pile is a real container entity — same containerInventory + interact ->
// openContainer mechanism as any level-placed container, so it's lootable
// through the exact same container panel. Only created once a tile holding a
// single dropped item receives a second, different item; a same-type drop on
// top of an existing single item just tops up that item's quantity instead
// (see dropAt) — a stack of potions dropped together stays one simple ground
// item, matching how a stack already behaves everywhere else in this game.
function createPile(col, row) {
    return {
        col,
        row,
        blocksMovement: false,
        type: 'pile',
        isContainer: true,
        isPile: true,
        containerInventory: new Inventory(PILE_COLS, PILE_ROWS),
        interactable: true,
        interact(entity, level, inventory, openContainer) {
            openContainer(entity);
        },
    };
}

// Drops `quantity` units of `item` (from `inventory`) onto the ground at
// (col,row):
//  - empty tile -> a plain ground item (direct pick-up, no panel)
//  - tile already holds a same-type stackable ground item -> tops it up
//  - tile holds a different item (or a second non-stackable one) -> both
//    merge into a new "pile" container
//  - tile already holds a pile -> adds to it
export function dropAt(level, inventory, item, quantity, col, row) {
    const entitiesHere = level.entitiesAt(col, row);
    const pile = entitiesHere.find((e) => e.isPile);
    const groundItem = entitiesHere.find((e) => e.isDroppedItem);

    if (pile) {
        pile.containerInventory.addItem(item.itemType, quantity, item.armor ?? null);
    } else if (groundItem && groundItem.itemType.id === item.itemType.id && item.itemType.stackable) {
        groundItem.quantity += quantity;
    } else if (groundItem) {
        const newPile = createPile(col, row);
        newPile.containerInventory.addItem(groundItem.itemType, groundItem.quantity, groundItem.armor ?? null);
        newPile.containerInventory.addItem(item.itemType, quantity, item.armor ?? null);
        level.removeEntity(groundItem);
        level.addEntity(newPile);
    } else {
        level.addEntity(createDroppedItem(col, row, item.itemType, quantity, item.armor ?? null));
    }

    if (quantity >= item.quantity) {
        inventory.removeItem(item.id);
    } else {
        item.quantity -= quantity;
    }
}
