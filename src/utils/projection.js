/**
 * projection.js - Coordinate projection utilities
 * 
 * Handles conversion between 2D (Cartesian) and Isometric coordinates.
 * Uses a 2:1 ratio for isometric tiles (width is 2x the height).
 */

import { DATA } from '../data/constants.js';

/**
 * Convert 2D (Cartesian) coordinates to Isometric screen coordinates
 * @param {number} x - The 2D x coordinate (e.g., pixel x position)
 * @param {number} y - The 2D y coordinate (e.g., pixel y position)
 * @param {number} tileWidth - The width of the isometric tile (default: 64)
 * @returns {Object} {screenX, screenY} - Isometric screen coordinates
 */
export function cartesianToIso(x, y, tileWidth = 64) {
  // Use half-width and half-height for the offsets
  const halfWidth = tileWidth / 2;
  const halfHeight = tileWidth / 4; // 2:1 ratio
  
  return {
    screenX: (x - y) * halfWidth,
    screenY: (x + y) * halfHeight
  };
}

/**
 * Convert Isometric screen coordinates back to 2D (Cartesian) coordinates
 * Useful for mouse-clicking on tiles!
 * @param {number} screenX - The isometric screen X coordinate
 * @param {number} screenY - The isometric screen Y coordinate
 * @param {number} tileWidth - The width of the isometric tile (default: 64)
 * @returns {Object} {x, y} - 2D Cartesian coordinates
 */
export function isoToCartesian(screenX, screenY, tileWidth = 64) {
  const halfWidth = tileWidth / 2;
  const halfHeight = tileWidth / 4;
  
  return {
    x: (screenX / halfWidth + screenY / halfHeight) / 2,
    y: (screenY / halfHeight - screenX / halfWidth) / 2
  };
}

/**
 * Convert a 2D rectangle to isometric diamond (parallelogram) points
 * @param {number} x - Top-left X of 2D rectangle
 * @param {number} y - Top-left Y of 2D rectangle
 * @param {number} width - Width of 2D rectangle
 * @param {number} height - Height of 2D rectangle
 * @param {number} tileWidth - Isometric tile width (for scaling)
 * @returns {Array} Array of {x, y} points for the isometric shape [topLeft, topRight, bottomRight, bottomLeft]
 */
export function rectToIsoDiamond(x, y, width, height, tileWidth = 64) {
  // Get the four corners of the 2D rectangle
  const topLeft = cartesianToIso(x, y, tileWidth);
  const topRight = cartesianToIso(x + width, y, tileWidth);
  const bottomRight = cartesianToIso(x + width, y + height, tileWidth);
  const bottomLeft = cartesianToIso(x, y + height, tileWidth);
  
  return [topLeft, topRight, bottomRight, bottomLeft];
}