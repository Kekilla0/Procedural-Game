// Converts grid (col, row) positions to screen-space offsets, for either view mode.
export const TILE_SIZE = 40;
export const ISO_HALF_WIDTH = 32;
export const ISO_HALF_HEIGHT = 16;

export function topDownProject(col, row) {
    return { x: col * TILE_SIZE, y: row * TILE_SIZE };
}

export function isoProject(col, row) {
    return { x: (col - row) * ISO_HALF_WIDTH, y: (col + row) * ISO_HALF_HEIGHT };
}

// Inverse of isoProject, relative to an already-placed origin — used to figure out
// which col/row range is visible on screen so the iso grid only draws what's in view.
export function isoUnproject(screenX, screenY, originX, originY) {
    const localX = screenX - originX;
    const localY = screenY - originY;
    const col = (localX / ISO_HALF_WIDTH + localY / ISO_HALF_HEIGHT) / 2;
    const row = (localY / ISO_HALF_HEIGHT - localX / ISO_HALF_WIDTH) / 2;
    return { col, row };
}
