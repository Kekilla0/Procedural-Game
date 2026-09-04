import { GRID_CELL_SIZE, GRID_CELL_GAP } from './gridConstants.js';
import { RARITIES } from '../data/rarities.js';

// Shared grid drawing + hit-testing for anything that renders an Inventory
// (the HUD's inventory panel, the container loot popup). Keeps the two in
// visual sync for free instead of two copies of the same drawing code.
export function gridDimensions(inventory, scale) {
    const cellSize = GRID_CELL_SIZE * scale;
    const gap = GRID_CELL_GAP * scale;
    return {
        width: inventory.cols * cellSize + (inventory.cols - 1) * gap,
        height: inventory.rows * cellSize + (inventory.rows - 1) * gap,
    };
}

export function drawInventoryGrid(ctx, inventory, originX, originY, scale) {
    const cellSize = GRID_CELL_SIZE * scale;
    const gap = GRID_CELL_GAP * scale;
    const cellX = (col) => originX + col * (cellSize + gap);
    const cellY = (row) => originY + row * (cellSize + gap);

    for (let row = 0; row < inventory.rows; row++) {
        for (let col = 0; col < inventory.cols; col++) {
            // Locked cells (not part of current Carry Capacity — see
            // Inventory.resizeCapacity) get a faint outline only, visually
            // distinct from both an empty active cell and an occupied one.
            // Only ever true for the player's own inventory, and only when
            // capacity landed mid-"ring" — every other inventory (containers,
            // piles) is never locked anywhere, isLocked is always false.
            if (inventory.isLocked?.(col, row)) {
                ctx.strokeStyle = '#2a2a2a';
                ctx.strokeRect(cellX(col), cellY(row), cellSize, cellSize);
                continue;
            }
            ctx.fillStyle = '#1c1c1c';
            ctx.strokeStyle = '#4a4a4a';
            ctx.fillRect(cellX(col), cellY(row), cellSize, cellSize);
            ctx.strokeRect(cellX(col), cellY(row), cellSize, cellSize);
        }
    }

    for (const item of inventory.items) {
        const x = cellX(item.col);
        const y = cellY(item.row);
        const width = item.itemType.width * cellSize + (item.itemType.width - 1) * gap;
        const height = item.itemType.height * cellSize + (item.itemType.height - 1) * gap;

        ctx.fillStyle = item.itemType.color;
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = item.armor ? RARITIES[item.armor.rarityId]?.color ?? '#e0e0e0' : '#e0e0e0';
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = '#111';
        ctx.font = `bold ${Math.round(12 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(item.itemType.label, x + width / 2, y + height / 2 + 4 * scale);

        if (item.itemType.stackable) {
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.round(10 * scale)}px sans-serif`;
            ctx.textAlign = 'right';
            ctx.fillText(String(item.quantity), x + width - 3 * scale, y + height - 3 * scale);
        }
    }
}

// The grid cell (col,row) under (x,y) — not bounds-checked against the
// inventory's own cols/rows, callers that need that (hit-testing) check
// separately; callers that just want a placement target (drag-and-drop) let
// Inventory.placeAt's own bounds check reject it instead.
export function cellAt(originX, originY, scale, x, y) {
    const cellSize = GRID_CELL_SIZE * scale;
    const gap = GRID_CELL_GAP * scale;
    return {
        col: Math.floor((x - originX) / (cellSize + gap)),
        row: Math.floor((y - originY) / (cellSize + gap)),
    };
}

// Returns the item occupying the cell under (x,y), or null.
export function hitTestInventoryItem(inventory, originX, originY, scale, x, y) {
    const { col, row } = cellAt(originX, originY, scale, x, y);
    if (col < 0 || row < 0 || col >= inventory.cols || row >= inventory.rows) return null;
    return inventory.itemAt(col, row);
}
