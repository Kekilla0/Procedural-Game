import { WALL_STATE } from './wall.js';

function directionSide(dCol, dRow) {
    if (dRow === -1) return 'north';
    if (dRow === 1) return 'south';
    if (dCol === -1) return 'west';
    return 'east';
}

// Whether the edge(s) between two adjacent cells are open. Orthogonal moves
// check the one shared edge; diagonal moves check both edges of the corner
// being cut, so you can't slip diagonally between two walls that meet at a
// point (a common tile-game convention, and the only sane reading of "single
// wall blocks diagonal movement" once diagonal movement exists at all).
export function canMoveBetween(level, fromCol, fromRow, toCol, toRow) {
    const dCol = toCol - fromCol;
    const dRow = toRow - fromRow;

    if (dCol !== 0 && dRow !== 0) {
        const horizontalSide = dCol === 1 ? 'east' : 'west';
        const verticalSide = dRow === 1 ? 'south' : 'north';
        if (level.getWallState(fromCol, fromRow, horizontalSide) === WALL_STATE.SOLID) return false;
        if (level.getWallState(fromCol, fromRow, verticalSide) === WALL_STATE.SOLID) return false;
        return true;
    }

    return level.getWallState(fromCol, fromRow, directionSide(dCol, dRow)) !== WALL_STATE.SOLID;
}

// Full movement check: level bounds, walls between the two cells, and static
// blocking entities on the destination cell. Non-blocking entities (dropped
// items) never prevent movement — a mover can share a cell with one.
export function canMoveTo(level, fromCol, fromRow, toCol, toRow) {
    if (!level.inBounds(toCol, toRow)) return false;
    if (!canMoveBetween(level, fromCol, fromRow, toCol, toRow)) return false;
    if (level.isBlockedByEntity(toCol, toRow)) return false;
    return true;
}
