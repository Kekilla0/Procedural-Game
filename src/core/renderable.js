/**
 * Renderable.js - Base class for anything that can be rendered
 * 
 * Handles core rendering properties: position (x, y) and dimensions (width, height)
 * Subclasses should override render() to implement specific rendering logic
 */

import { DATA } from '../data/constants.js';

export class Renderable {
  /**
   * Create a new Renderable
   * @param {number} x - X position in pixels
   * @param {number} y - Y position in pixels
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   */
  constructor(x, y, width, height) {
    // Position (pixels)
    this.x = x;
    this.y = y;
    
    // Dimensions (pixels)
    this.width = width;
    this.height = height;
  }
  
  /**
   * Render this object to Phaser graphics
   * Override this in subclasses to implement specific rendering
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object to draw to
   */
  render(graphics) {
    // Draw debug boundary if debug mode is enabled
    if (DATA.DEBUG) {
      graphics.lineStyle(1, 0xFF0000); // 1px red outline
      graphics.strokeRect(this.x, this.y, this.width, this.height);
    }
  }

  // ---------------------------------------------------------------------------
  // Rotation utilities (static — no instance state needed)
  // ---------------------------------------------------------------------------

  static rotateCoordinates(col, row, rotation, maxCol, maxRow) {
    switch (rotation) {
      case 90:  return { col: maxRow - row, row: col };
      case 180: return { col: maxCol - col, row: maxRow - row };
      case 270: return { col: row, row: maxCol - col };
      default:  return { col, row };
    }
  }

  static rotateCorner(col, row, rotation, gridCols, gridRows) {
    switch (rotation) {
      case 90:  return { col: gridRows - row, row: col };
      case 180: return { col: gridCols - col, row: gridRows - row };
      case 270: return { col: row, row: gridCols - col };
      default:  return { col, row };
    }
  }

  static unrotateCoordinates(col, row, rotation, gridColumns, gridRows) {
    const maxCol = gridColumns - 1;
    const maxRow = gridRows - 1;
    switch (rotation) {
      case 90:  return { col: row, row: maxRow - col };
      case 180: return { col: maxCol - col, row: maxRow - row };
      case 270: return { col: maxCol - row, row: col };
      default:  return { col, row };
    }
  }

  static rotatePixelPosition(x, y, rotation, canvasWidth, canvasHeight) {
    switch (rotation) {
      case 90:  return { x: canvasHeight - y, y: x };
      case 180: return { x: canvasWidth - x, y: canvasHeight - y };
      case 270: return { x: y, y: canvasWidth - x };
      default:  return { x, y };
    }
  }

  // ---------------------------------------------------------------------------
  // Projection utilities (static — no instance state needed)
  // ---------------------------------------------------------------------------

  static cartesianToIso(x, y, tileWidth = 64) {
    const halfWidth  = tileWidth / 2;
    const halfHeight = tileWidth / 4;
    return { screenX: (x - y) * halfWidth, screenY: (x + y) * halfHeight };
  }

  static isoToCartesian(screenX, screenY, tileWidth = 64) {
    const halfWidth  = tileWidth / 2;
    const halfHeight = tileWidth / 4;
    return {
      x: (screenX / halfWidth  + screenY / halfHeight) / 2,
      y: (screenY / halfHeight - screenX / halfWidth)  / 2
    };
  }

  static rectToIsoDiamond(x, y, width, height, tileWidth = 64) {
    return [
      Renderable.cartesianToIso(x,         y,          tileWidth),
      Renderable.cartesianToIso(x + width,  y,          tileWidth),
      Renderable.cartesianToIso(x + width,  y + height, tileWidth),
      Renderable.cartesianToIso(x,          y + height, tileWidth)
    ];
  }
}