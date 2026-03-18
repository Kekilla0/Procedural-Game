/**
 * Grid.js - Grid overlay for game board
 * 
 * Renders grid lines over the canvas to show tile boundaries.
 * Extends Renderable to inherit position and dimensions.
 */

import { Renderable } from './renderable.js';
import { DATA } from '../data/constants.js';
import { logger } from '../utils/logger.js';


export class Grid extends Renderable {
  /**
   * Create a new Grid
   * @param {number} canvasWidth - Canvas width in pixels
   * @param {number} canvasHeight - Canvas height in pixels
   * @param {number} tileSize - Size of each grid square in pixels (default from constants)
   * @param {number} lineWidth - Thickness of grid lines in pixels (default from constants)
   * @param {string} lineColor - Color of grid lines (default from constants)
   */
  constructor(
    canvasWidth, 
    canvasHeight, 
    tileSize = DATA.GRID.SIZE,
    lineWidth = DATA.GRID.WIDTH,
    lineColor = DATA.GRID.COLOR
  ) {
    // Grid covers entire canvas, starts at origin
    super(0, 0, canvasWidth, canvasHeight);
    
    // Grid properties
    this.size = tileSize;         // Pixels per grid square
    this.lineWidth = lineWidth;   // Line thickness
    this.color = lineColor;       // Line color
    
    // Calculate grid dimensions
    this.columns = Math.floor(canvasWidth / tileSize);
    this.rows = Math.floor(canvasHeight / tileSize);
    
    // Current rotation (for rendering highlights)
    this.rotation = 0;
    
    logger.debug('Grid Initialized:', {
      columns: this.columns,
      rows: this.rows,
      tileSize: this.size
    });
  }
  
  /**
   * Rotate the grid (stores rotation for highlight rendering)
   * Grid lines don't rotate, but highlights do
   * @param {number} rotation - New rotation value (0, 90, 180, 270)
   */
  rotate(rotation) {
    this.rotation = rotation;
    logger.debug(`Grid rotation set to ${rotation}°`);
  }
  
  /**
   * Render grid lines to Phaser graphics
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object to draw to
   * @param {string} viewMode - Current view mode ('2D' or 'ISOMETRIC')
   * @param {Array} movementRange - Optional array of {col, row} tiles to highlight
   */
  render(graphics, movementRange = [], rotation = 0) {
    const colorNumber = parseInt(this.color.replace('#', '0x'));
    graphics.lineStyle(this.lineWidth, colorNumber);
    this.renderIsometric(graphics, colorNumber, movementRange, rotation);
  }

  /**
   * Render isometric grid (diamond tiles)
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object
   * @param {number} colorNumber - Line color in Phaser format
   * @param {Array} movementRange - Array of {col, row} tiles to highlight
   */
  renderIsometric(graphics, colorNumber, movementRange = [], rotation = 0) {
    // Use tile size of 64 for isometric projection
    const isoTileWidth = 64;

    // Center the isometric grid in the viewport
    const offsetX = 400;
    const offsetY = 100;

    // Draw each tile as a diamond
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        // Apply rotation to grid coordinates before projecting to screen space
        let visCol = col;
        let visRow = row;
        if (rotation !== 0) {
          const rotated = Grid.rotateCoordinates(col, row, rotation, this.columns - 1, this.rows - 1);
          visCol = rotated.col;
          visRow = rotated.row;
        }

        const topLeft = Grid.cartesianToIso(visCol, visRow, isoTileWidth);
        const topRight = Grid.cartesianToIso(visCol + 1, visRow, isoTileWidth);
        const bottomRight = Grid.cartesianToIso(visCol + 1, visRow + 1, isoTileWidth);
        const bottomLeft = Grid.cartesianToIso(visCol, visRow + 1, isoTileWidth);
        
        // Check if this tile should be highlighted
        const highlightTile = movementRange.find(t => t.col === col && t.row === row);
        
        // Fill diamond if highlighted
        if (highlightTile) {
          if (highlightTile.isHovered) {
            // Hovered tile - use mouse hover color
            graphics.fillStyle(DATA.MOUSE.HOVER_COLOR, DATA.MOUSE.HOVER_OPACITY);
          } else {
            // Regular movement range - use movement range color
            graphics.fillStyle(DATA.MOVEMENT.RANGE_COLOR, DATA.MOVEMENT.RANGE_OPACITY);
          }
          
          graphics.beginPath();
          graphics.moveTo(topLeft.screenX + offsetX, topLeft.screenY + offsetY);
          graphics.lineTo(topRight.screenX + offsetX, topRight.screenY + offsetY);
          graphics.lineTo(bottomRight.screenX + offsetX, bottomRight.screenY + offsetY);
          graphics.lineTo(bottomLeft.screenX + offsetX, bottomLeft.screenY + offsetY);
          graphics.closePath();
          graphics.fillPath();
        }
        
        // Draw the diamond outline
        graphics.beginPath();
        graphics.moveTo(topLeft.screenX + offsetX, topLeft.screenY + offsetY);
        graphics.lineTo(topRight.screenX + offsetX, topRight.screenY + offsetY);
        graphics.lineTo(bottomRight.screenX + offsetX, bottomRight.screenY + offsetY);
        graphics.lineTo(bottomLeft.screenX + offsetX, bottomLeft.screenY + offsetY);
        graphics.closePath();
        graphics.strokePath();
      }
    }
  }
}