/**
 * rotation.js - 2D Map Rotation Utilities
 * 
 * Handles coordinate transformation for rotating the 2D map view.
 * Rotation is visual only - game state (col, row) remains unchanged.
 */

/**
 * Transform grid coordinates based on rotation
 * @param {number} col - Grid column
 * @param {number} row - Grid row  
 * @param {number} rotation - Rotation in degrees (0, 90, 180, 270)
 * @param {number} maxCol - Maximum column (grid.columns - 1)
 * @param {number} maxRow - Maximum row (grid.rows - 1)
 * @returns {{col: number, row: number}} Transformed coordinates
 */
export function rotateCoordinates(col, row, rotation, maxCol, maxRow) {
  switch (rotation) {
    case 0:
      // No rotation
      return { col, row };
      
    case 90:
      // 90° clockwise: (col, row) → (maxRow - row, col)
      return {
        col: maxRow - row,
        row: col
      };
      
    case 180:
      // 180°: (col, row) → (maxCol - col, maxRow - row)
      return {
        col: maxCol - col,
        row: maxRow - row
      };
      
    case 270:
      // 270° clockwise (90° counter-clockwise): (col, row) → (row, maxCol - col)
      return {
        col: row,
        row: maxCol - col
      };
      
    default:
      console.error(`Invalid rotation: ${rotation}. Must be 0, 90, 180, or 270.`);
      return { col, row };
  }
}

/**
 * Transform pixel position based on rotation
 * @param {number} x - X position in pixels
 * @param {number} y - Y position in pixels
 * @param {number} rotation - Rotation in degrees (0, 90, 180, 270)
 * @param {number} canvasWidth - Canvas width in pixels
 * @param {number} canvasHeight - Canvas height in pixels
 * @returns {{x: number, y: number}} Transformed pixel coordinates
 */
export function rotatePixelPosition(x, y, rotation, canvasWidth, canvasHeight) {
  switch (rotation) {
    case 0:
      // No rotation
      return { x, y };
      
    case 90:
      // 90° clockwise
      return {
        x: canvasHeight - y,
        y: x
      };
      
    case 180:
      // 180°
      return {
        x: canvasWidth - x,
        y: canvasHeight - y
      };
      
    case 270:
      // 270° clockwise
      return {
        x: y,
        y: canvasWidth - x
      };
      
    default:
      console.error(`Invalid rotation: ${rotation}. Must be 0, 90, 180, or 270.`);
      return { x, y };
  }
}