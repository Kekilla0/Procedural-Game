import { WALL_STATE, normalizeEdge, edgeKey } from './wall.js';

// A Level is pure data: bounds, wall edges, and entities. No rendering, no
// input — ViewportScreen renders a Level and lets the player move through it.
// Bounds are an inclusive [min, max] range on each axis (not 0-based) so a
// level doesn't have to start at the origin — e.g. the player can spawn at
// (0,0) in the middle of a room rather than in its corner.
export class Level {
    constructor(minCol, minRow, maxCol, maxRow) {
        this.minCol = minCol;
        this.minRow = minRow;
        this.maxCol = maxCol;
        this.maxRow = maxRow;
        this.walls = new Map(); // edgeKey -> { col, row, side, state }
        this.entities = []; // { col, row, blocksMovement, type, ... }
    }

    inBounds(col, row) {
        return col >= this.minCol && col <= this.maxCol && row >= this.minRow && row <= this.maxRow;
    }

    setWall(col, row, side, state = WALL_STATE.SOLID, { isDoor = false } = {}) {
        const edge = normalizeEdge(col, row, side);
        this.walls.set(edgeKey(edge.col, edge.row, edge.side), { ...edge, state, isDoor });
    }

    // Edge state for the boundary between (col,row) and its neighbor on `side`.
    // Missing edges default to OPEN — most cell boundaries have no wall at all.
    getWallState(col, row, side) {
        return this.getWallEntry(col, row, side)?.state ?? WALL_STATE.OPEN;
    }

    // Full wall entry ({col,row,side,state,isDoor}) for the edge between
    // (col,row) and its neighbor on `side`, or undefined if there's no wall there.
    getWallEntry(col, row, side) {
        const edge = normalizeEdge(col, row, side);
        return this.walls.get(edgeKey(edge.col, edge.row, edge.side));
    }

    addEntity(entity) {
        this.entities.push(entity);
        return entity;
    }

    removeEntity(entity) {
        const index = this.entities.indexOf(entity);
        if (index !== -1) this.entities.splice(index, 1);
    }

    entitiesAt(col, row) {
        return this.entities.filter((e) => e.col === col && e.row === row);
    }

    isBlockedByEntity(col, row) {
        return this.entities.some((e) => e.blocksMovement && e.col === col && e.row === row);
    }
}
