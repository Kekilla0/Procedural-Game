/**
 * Grid.js - Grid overlay for game board
 * 
 * Renders grid lines over the canvas to show tile boundaries.
 * Extends Renderable to inherit position and dimensions.
 */

import { Renderable } from './renderable.js';
import { DATA } from '../data/constants.js';
import { logger } from '../utils/logger.js';
import { cartesianToIso } from '../utils/projection.js';
import { rotatePixelPosition } from '../utils/rotation.js';

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
    
    logger.debug('Grid Initialized:', {
      columns: this.columns,
      rows: this.rows,
      tileSize: this.size
    });
  }
  
  /**
   * Render grid lines to Phaser graphics
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object to draw to
   * @param {string} viewMode - Current view mode ('2D' or 'ISOMETRIC')
   * @param {Array} movementRange - Optional array of {col, row} tiles to highlight
   */
  render(graphics, viewMode = '2D', movementRange = [], rotation = 0) {
    // No debug outline for grid (not needed)
    
    // Convert hex color string to Phaser number format
    const colorNumber = parseInt(this.color.replace('#', '0x'));
    
    // Set line style
    graphics.lineStyle(this.lineWidth, colorNumber);
    
    if (viewMode === 'ISOMETRIC') {
      // Isometric mode ignores rotation
      this.renderIsometric(graphics, colorNumber, movementRange);
    } else {
      // 2D mode supports rotation
      this.render2D(graphics, movementRange, rotation);
    }
  }
  
  /**
   * Render 2D grid (square tiles)
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object
   * @param {Array} movementRange - Array of {col, row} tiles to highlight
   * @param {number} rotation - Map rotation in degrees (0/90/180/270)
   */
  render2D(graphics, movementRange = [], rotation = 0) {
    // First, render movement highlights (before grid lines)
    // Note: Grid lines themselves don't rotate, but highlights do
    if (movementRange.length > 0) {
      for (const tile of movementRange) {
        // Apply rotation to tile position
        const rotated = rotatePixelPosition(
          tile.col * this.size,
          tile.row * this.size,
          rotation,
          this.width,
          this.height
        );
        
        const x = this.x + rotated.x;
        const y = this.y + rotated.y;
        
        if (tile.isHovered) {
          // Hovered tile - use mouse hover color
          logger.debug(`2D: Rendering HOVERED tile (${tile.col}, ${tile.row}) at rotated position (${x}, ${y})`);
          graphics.fillStyle(DATA.MOUSE.HOVER_COLOR, DATA.MOUSE.HOVER_OPACITY);
        } else {
          // Regular movement range - use movement range color
          graphics.fillStyle(DATA.MOVEMENT.RANGE_COLOR, DATA.MOVEMENT.RANGE_OPACITY);
        }
        
        graphics.fillRect(x, y, this.size, this.size);
      }
    }
    
    // Then draw grid lines on top
    // Draw vertical lines
    for (let col = 0; col <= this.columns; col++) {
      const x = this.x + (col * this.size);
      graphics.beginPath();
      graphics.moveTo(x, this.y);
      graphics.lineTo(x, this.y + this.height);
      graphics.strokePath();
    }
    
    // Draw horizontal lines
    for (let row = 0; row <= this.rows; row++) {
      const y = this.y + (row * this.size);
      graphics.beginPath();
      graphics.moveTo(this.x, y);
      graphics.lineTo(this.x + this.width, y);
      graphics.strokePath();
    }
  }
  
  /**
   * Render isometric grid (diamond tiles)
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object
   * @param {number} colorNumber - Line color in Phaser format
   * @param {Array} movementRange - Array of {col, row} tiles to highlight
   */
  renderIsometric(graphics, colorNumber, movementRange = []) {
    // Use tile size of 64 for isometric projection
    const isoTileWidth = 64;
    
    // Center the isometric grid in the viewport
    const offsetX = 400;
    const offsetY = 100;
    
    // Draw each tile as a diamond
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        // Use GRID coordinates (col, row), not pixel coordinates
        // cartesianToIso will handle the conversion to screen space
        const topLeft = cartesianToIso(col, row, isoTileWidth);
        const topRight = cartesianToIso(col + 1, row, isoTileWidth);
        const bottomRight = cartesianToIso(col + 1, row + 1, isoTileWidth);
        const bottomLeft = cartesianToIso(col, row + 1, isoTileWidth);
        
        // Check if this tile should be highlighted
        const highlightTile = movementRange.find(t => t.col === col && t.row === row);
        
        // Fill diamond if highlighted
        if (highlightTile) {
          if (highlightTile.isHovered) {
            // Hovered tile - use mouse hover color
            logger.debug(`ISO: Rendering HOVERED tile (${col}, ${row}) - Color: ${DATA.MOUSE.HOVER_COLOR.toString(16)}, Opacity: ${DATA.MOUSE.HOVER_OPACITY}`);
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