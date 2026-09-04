import { ITEM_TYPES } from './itemTypes.js';

const CAPACITY_BASE_COLS = 4;
const CAPACITY_BASE_ROWS = 5;

// Yields [col,row] pairs forever in the order new cells unlock as capacity
// grows past the base rectangle: the new rightmost column top-to-bottom
// (spanning the new row count), then the new bottom row right-to-left
// (spanning only the original columns) — one full "ring," repeated with the
// rectangle one bigger each time.
function* unlockOrderCells(baseCols, baseRows) {
    for (let r = 0; r < baseRows; r++) {
        for (let c = 0; c < baseCols; c++) yield [c, r];
    }
    let cols = baseCols;
    let rows = baseRows;
    for (;;) {
        const newCol = cols;
        const newRow = rows;
        for (let r = 0; r <= rows; r++) yield [newCol, r];
        for (let c = cols - 1; c >= 0; c--) yield [c, newRow];
        cols += 1;
        rows += 1;
    }
}

// The bounding box + set of unlocked cells for a given capacity. Never
// smaller than the base rectangle. A capacity landing mid-"ring" produces a
// bounding box sized for the ring in progress, with only some of its cells
// actually active — the rest stay locked until capacity catches up.
function computeCapacityShape(capacity) {
    const target = Math.max(Math.round(capacity), CAPACITY_BASE_COLS * CAPACITY_BASE_ROWS);
    const active = new Set();
    let maxCol = CAPACITY_BASE_COLS - 1;
    let maxRow = CAPACITY_BASE_ROWS - 1;
    let count = 0;
    for (const [c, r] of unlockOrderCells(CAPACITY_BASE_COLS, CAPACITY_BASE_ROWS)) {
        if (count >= target) break;
        active.add(`${c},${r}`);
        if (c > maxCol) maxCol = c;
        if (r > maxRow) maxRow = r;
        count++;
    }
    return { cols: maxCol + 1, rows: maxRow + 1, active };
}

// A grid-based inventory: `cols` x `rows` unit cells, where an item occupies
// a rectangular footprint (width x height cells) rather than always exactly
// one slot. Stackable item types can hold up to maxStack per cell instead of
// needing a new footprint for every unit. Pure data + placement logic — no
// rendering, no input.
//
// Cells hold one of three things: `null` (empty, usable), an item id
// (occupied), or `undefined` (locked — not part of current capacity, only
// ever introduced by resizeCapacity). Locked cells behave exactly like
// occupied ones everywhere that matters (_fits's `!== null` check already
// excludes undefined for free), so only resizeCapacity and the two spots
// noted below know locked cells exist at all — every inventory that never
// calls resizeCapacity (containers, ground piles) is a plain fully-active
// rectangle exactly as before.
export class Inventory {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.cells = new Array(cols * rows).fill(null); // item id per cell, or null
        this.items = []; // { id, itemType, col, row, quantity } — col/row is the top-left anchor
        this._nextId = 1;
    }

    _index(col, row) {
        return row * this.cols + col;
    }

    _fits(col, row, width, height) {
        if (col < 0 || row < 0 || col + width > this.cols || row + height > this.rows) return false;
        for (let r = row; r < row + height; r++) {
            for (let c = col; c < col + width; c++) {
                if (this.cells[this._index(c, r)] !== null) return false;
            }
        }
        return true;
    }

    _occupy(col, row, width, height, id) {
        for (let r = row; r < row + height; r++) {
            for (let c = col; c < col + width; c++) {
                this.cells[this._index(c, r)] = id;
            }
        }
    }

    // First-fit scan, reading order (top-left to bottom-right). Good enough
    // until inventory management becomes a more deliberate feature.
    findFreeSpot(width, height) {
        for (let row = 0; row <= this.rows - height; row++) {
            for (let col = 0; col <= this.cols - width; col++) {
                if (this._fits(col, row, width, height)) return { col, row };
            }
        }
        return null;
    }

    hasRoomFor(itemType) {
        return this.findFreeSpot(itemType.width, itemType.height) !== null;
    }

    itemAt(col, row) {
        if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return null;
        const id = this.cells[this._index(col, row)];
        return id === null || id === undefined ? null : this.items.find((item) => item.id === id) ?? null;
    }

    // True if (col,row) is locked (not part of current capacity) — out-of-
    // bounds counts as locked too. Only ever true for inventories that have
    // had resizeCapacity called on them with a mid-ring capacity.
    isLocked(col, row) {
        if (col < 0 || row < 0 || col >= this.cols || row >= this.rows) return true;
        return this.cells[this._index(col, row)] === undefined;
    }

    // Rebuilds this inventory's shape for a target capacity — always applies
    // it, never rejected. Reuses _fits/_occupy/findFreeSpot rather than new
    // placement logic: stages a new cells array for the new bounding box
    // (active cells -> null, locked cells -> undefined), re-occupies every
    // item that still fits at its current (col,row), then findFreeSpot's any
    // item that got displaced. Displaced items that find a new spot move
    // there and stay; any that fit nowhere in the new shape are fully
    // removed (via this.removeItem) and returned — this class has no notion
    // of "the ground," so what happens to returned items is the caller's
    // job. Growing never displaces anything, so the returned array is always
    // empty when capacity only increases.
    resizeCapacity(targetCapacity) {
        const shape = computeCapacityShape(targetCapacity);

        this.cols = shape.cols;
        this.rows = shape.rows;
        this.cells = new Array(shape.cols * shape.rows).fill(undefined);
        for (const key of shape.active) {
            const [c, r] = key.split(',').map(Number);
            this.cells[this._index(c, r)] = null;
        }

        const displaced = [];
        for (const item of this.items) {
            let fits = true;
            for (let r = item.row; r < item.row + item.itemType.height && fits; r++) {
                for (let c = item.col; c < item.col + item.itemType.width && fits; c++) {
                    if (!shape.active.has(`${c},${r}`)) fits = false;
                }
            }
            if (fits) {
                this._occupy(item.col, item.row, item.itemType.width, item.itemType.height, item.id);
            } else {
                displaced.push(item);
            }
        }

        const evicted = [];
        for (const item of displaced) {
            const spot = this.findFreeSpot(item.itemType.width, item.itemType.height);
            if (spot) {
                this._occupy(spot.col, spot.row, item.itemType.width, item.itemType.height, item.id);
                item.col = spot.col;
                item.row = spot.row;
            } else {
                evicted.push(item);
            }
        }
        // Evicted items were never occupied in the new grid (no cells to
        // free), so just drop them from the list directly — NOT via
        // removeItem, which would clear cells at the item's stale pre-resize
        // (col,row) under the new grid's indexing and could corrupt an
        // unrelated cell that now means something different.
        if (evicted.length > 0) {
            this.items = this.items.filter((item) => !evicted.includes(item));
        }

        return evicted;
    }

    // Places up to `quantity` units of itemType with its top-left at exactly
    // (col,row) — for drag-and-drop, where the user chose where it lands,
    // unlike addItem's first-fit scan. If (col,row) already holds a same-type
    // stack, tops that stack up instead of requiring the footprint to be
    // fully free. Returns how much did NOT get placed (0 = fully placed) —
    // same contract as addItem, so callers can fall back the same way.
    // `instanceData` (e.g. a rolled armor's {armorTypeId,rarityId,affixes})
    // carries through onto the new item literal as `.armor` when provided —
    // this is how a moved item's roll survives a placeAt-based move (see
    // Inventory.addItem's matching param for the full rationale).
    placeAt(itemType, quantity, col, row, instanceData = null) {
        if (itemType.stackable) {
            const existing = this.itemAt(col, row);
            if (existing && existing.itemType.id === itemType.id) {
                const room = itemType.maxStack - existing.quantity;
                const add = Math.max(0, Math.min(room, quantity));
                existing.quantity += add;
                return quantity - add;
            }
        }

        if (!this._fits(col, row, itemType.width, itemType.height)) return quantity;

        const id = this._nextId++;
        this._occupy(col, row, itemType.width, itemType.height, id);
        this.items.push({ id, itemType, col, row, quantity, ...(instanceData ? { armor: instanceData } : {}) });
        return 0;
    }

    // Repositions an existing item to exactly (col,row) within the SAME
    // inventory — dragging an item to a different cell in the grid it's
    // already in. Frees its own old cells before checking fit, so shifting
    // it by a column/row that overlaps its old footprint still works. Leaves
    // the item exactly where it was (no partial move) if the target doesn't
    // fit — occupied by something else, or out of bounds.
    moveItem(id, col, row) {
        const item = this.items.find((it) => it.id === id);
        if (!item) return false;
        if (item.col === col && item.row === row) return true;

        const { col: oldCol, row: oldRow, itemType } = item;
        for (let r = oldRow; r < oldRow + itemType.height; r++) {
            for (let c = oldCol; c < oldCol + itemType.width; c++) {
                this.cells[this._index(c, r)] = null;
            }
        }

        if (!this._fits(col, row, itemType.width, itemType.height)) {
            this._occupy(oldCol, oldRow, itemType.width, itemType.height, item.id); // rollback
            return false;
        }

        this._occupy(col, row, itemType.width, itemType.height, item.id);
        item.col = col;
        item.row = row;
        return true;
    }

    // Adds up to `quantity` units of itemType: tops up existing stacks first
    // (if stackable), then places new stacks/items in free spots until either
    // everything's placed or there's no room left. Returns how much actually
    // got added (0..quantity) — callers decide what to do with any remainder
    // (e.g. leave it where it came from).
    // `instanceData`, when provided, is attached as `.armor` on the newly
    // created item (never on a topped-up stack — armor is never stackable,
    // so the stacking loop above never applies to it). This is both how the
    // debug spawner hands a freshly-rolled item its data, and how every
    // move-an-existing-item call site (equip/unequip, container transfer,
    // drop/pickup) re-attaches `item.armor` so a rolled item's stats survive
    // being moved anywhere — without this, addItem would silently rebuild a
    // blank item from the shared static itemType alone.
    addItem(itemType, quantity = 1, instanceData = null) {
        let remaining = quantity;

        if (itemType.stackable) {
            for (const item of this.items) {
                if (remaining <= 0) break;
                if (item.itemType.id !== itemType.id) continue;
                const room = itemType.maxStack - item.quantity;
                if (room <= 0) continue;
                const add = Math.min(room, remaining);
                item.quantity += add;
                remaining -= add;
            }
        }

        while (remaining > 0) {
            const spot = this.findFreeSpot(itemType.width, itemType.height);
            if (!spot) break;

            const stackQty = itemType.stackable ? Math.min(remaining, itemType.maxStack) : 1;
            const id = this._nextId++;
            this._occupy(spot.col, spot.row, itemType.width, itemType.height, id);
            this.items.push({
                id,
                itemType,
                col: spot.col,
                row: spot.row,
                quantity: stackQty,
                ...(instanceData ? { armor: instanceData } : {}),
            });
            remaining -= stackQty;

            if (!itemType.stackable) break; // one placement attempt per call for non-stackables
        }

        return quantity - remaining;
    }

    // Removes an item entirely (all of its stack) and frees its cells.
    // Returns the removed item, or null if no item with that id exists.
    removeItem(id) {
        const index = this.items.findIndex((item) => item.id === id);
        if (index === -1) return null;

        const [item] = this.items.splice(index, 1);
        for (let r = item.row; r < item.row + item.itemType.height; r++) {
            for (let c = item.col; c < item.col + item.itemType.width; c++) {
                this.cells[this._index(c, r)] = null;
            }
        }
        return item;
    }

    // Removes exactly one unit from the first stack matching itemTypeId (any
    // instance is equivalent — there's no meaningful difference between two
    // Health Potion stacks) — for the action bar / "Use" context-menu action
    // consuming a potion. Decrements in place; only frees cells (via
    // removeItem) once the stack hits 0. Returns true if a unit was
    // consumed, false if no matching item exists at all.
    consumeOne(itemTypeId) {
        const item = this.items.find((it) => it.itemType.id === itemTypeId);
        if (!item) return false;

        item.quantity -= 1;
        if (item.quantity <= 0) this.removeItem(item.id);
        return true;
    }

    // Item ids are never referenced across a save boundary by anything else
    // (equipment/drag state don't store inventory item ids), so serialize
    // drops them and deserialize assigns fresh ones. lockedCells is only
    // ever non-empty for a capacity-resized inventory caught mid-ring —
    // every other inventory (containers, piles) always saves an empty list.
    serialize() {
        const lockedCells = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (this.cells[this._index(c, r)] === undefined) lockedCells.push(`${c},${r}`);
            }
        }
        return {
            cols: this.cols,
            rows: this.rows,
            lockedCells,
            items: this.items.map((item) => ({
                itemTypeId: item.itemType.id,
                col: item.col,
                row: item.row,
                quantity: item.quantity,
                ...(item.armor ? { armor: item.armor } : {}),
            })),
        };
    }

    // Rebuilds an inventory at its saved layout (same cells, not re-run
    // through findFreeSpot) — skips items whose type no longer exists in the
    // registry instead of throwing, so a save referencing a removed item type
    // just silently drops that item. lockedCells defaults to none (old saves
    // predate capacity-resized inventories, so there's nothing to lock).
    static deserialize(data, fallbackCols, fallbackRows) {
        const inventory = new Inventory(data.cols ?? fallbackCols, data.rows ?? fallbackRows);
        for (const key of data.lockedCells ?? []) {
            const [c, r] = key.split(',').map(Number);
            if (c >= 0 && r >= 0 && c < inventory.cols && r < inventory.rows) {
                inventory.cells[inventory._index(c, r)] = undefined;
            }
        }
        for (const saved of data.items ?? []) {
            const itemType = ITEM_TYPES[saved.itemTypeId];
            if (!itemType) {
                console.warn(`Inventory.deserialize: unknown item type "${saved.itemTypeId}", skipping`);
                continue;
            }
            const id = inventory._nextId++;
            inventory._occupy(saved.col, saved.row, itemType.width, itemType.height, id);
            inventory.items.push({
                id,
                itemType,
                col: saved.col,
                row: saved.row,
                quantity: saved.quantity,
                ...(saved.armor ? { armor: saved.armor } : {}),
            });
        }
        return inventory;
    }
}
