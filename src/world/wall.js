// Walls live on cell edges, not in cells — a wall between two adjacent cells
// is one object, not two. Canonical storage form is (col, row, 'north'|'west'):
// the north edge of (col,row) is the boundary with (col,row-1); the west edge
// is the boundary with (col-1,row). A "south of (col,row)" or "east of (col,row)"
// request normalizes to the north/west edge of the neighboring cell instead,
// so the same physical edge always maps to the same key.
export const WALL_STATE = {
    SOLID: 'solid',
    OPEN: 'open',
};

export function normalizeEdge(col, row, side) {
    if (side === 'south') return { col, row: row + 1, side: 'north' };
    if (side === 'east') return { col: col + 1, row, side: 'west' };
    return { col, row, side };
}

export function edgeKey(col, row, side) {
    return `${col},${row},${side}`;
}
