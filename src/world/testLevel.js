import { Level } from './level.js';
import { WALL_STATE } from './wall.js';
import { Inventory } from '../items/inventory.js';
import { rollRandomArmor, itemTypeForSlot } from '../data/armorTypes.js';

// chestArmor is a 2x3 footprint — 3 of them side by side need 6 columns
// (2 per item, no overlap) and 3 rows; 6x4 gives that exactly, plus one
// spare row so the container doesn't look packed to the pixel. The
// previous 5x4 container could only ever fit 2 of the 3 (confirmed by
// running Inventory.addItem against both sizes) — 5 columns has room for
// only two clean 2-wide pairs (cols 0-1, 2-3), leaving column 4 unable to
// pair with anything without colliding, since two 3-tall items can't also
// be split across rows in a grid only 4 rows deep.
const CONTAINER_COLS = 6;
const CONTAINER_ROWS = 4;
const CONTAINER_ITEM_COUNT = 3;

function fillContainer(inventory) {
    for (let i = 0; i < CONTAINER_ITEM_COUNT; i++) {
        const armorData = rollRandomArmor();
        inventory.addItem(itemTypeForSlot(armorData.slotId), 1, armorData);
    }
}

// Temporary hand-built room for exercising walls/collision/entities before
// procedural generation exists. Player spawns at (0,0), roughly centered.
// Replace with a generator once that's built — this file is scaffolding, not
// a real level format.
export function createTestLevel() {
    const level = new Level(-8, -8, 8, 8);

    for (let col = level.minCol; col <= level.maxCol; col++) {
        level.setWall(col, level.minRow, 'north');
        level.setWall(col, level.maxRow, 'south');
    }
    for (let row = level.minRow; row <= level.maxRow; row++) {
        level.setWall(level.minCol, row, 'west');
        level.setWall(level.maxCol, row, 'east');
    }

    // A short interior partition, to test wall collision distinct from the
    // room's outer bounds — with a door through it (starts closed) to test
    // the interact system.
    for (let col = 0; col <= 3; col++) {
        level.setWall(col, -3, 'north');
    }
    level.setWall(1, -3, 'north', WALL_STATE.SOLID, { isDoor: true });

    level.addEntity({ col: 3, row: 0, blocksMovement: true, type: 'object' });

    // A lootable ground item — clicking it (or 'E' while adjacent) picks it up
    // if the player's inventory has room for its footprint. `entity.armor`
    // carries the roll through to the player's inventory on pickup (same
    // "the item instance's data must survive being moved" rule as every
    // other item-moving path — see equipItem/transferItem/dropAt).
    const groundArmor = rollRandomArmor();
    level.addEntity({
        col: 1,
        row: 0,
        blocksMovement: false,
        type: 'item',
        itemType: itemTypeForSlot(groundArmor.slotId),
        armor: groundArmor,
        interactable: true,
        interact(entity, level, inventory) {
            if (inventory.addItem(entity.itemType, 1, entity.armor)) {
                level.removeEntity(entity);
            }
        },
    });

    // Interactable test entity — toggles a visible "activated" state so the
    // entity-interact pathway (as opposed to the door pathway) is exercisable.
    level.addEntity({
        col: -2,
        row: 0,
        blocksMovement: true,
        type: 'object',
        interactable: true,
        activated: false,
        interact(entity) {
            entity.activated = !entity.activated;
        },
    });

    // A lootable container in a corner of the room — interact opens a
    // secondary inventory (see Hud.openContainer) rather than looting directly.
    const containerInventory = new Inventory(CONTAINER_COLS, CONTAINER_ROWS);
    fillContainer(containerInventory);
    level.addEntity({
        col: level.minCol + 1,
        row: level.minRow + 1,
        blocksMovement: true,
        type: 'container',
        isContainer: true,
        containerInventory,
        interactable: true,
        interact(entity, level, inventory, openContainer) {
            openContainer(entity);
        },
        refill() {
            this.containerInventory = new Inventory(CONTAINER_COLS, CONTAINER_ROWS);
            fillContainer(this.containerInventory);
        },
    });

    return level;
}
