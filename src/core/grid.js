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
   */
  render(graphics, viewMode = '2D') {
    // Call parent render for debug outline
    super.render(graphics);
    
    // Convert hex color string to Phaser number format
    const colorNumber = parseInt(this.color.replace('#', '0x'));
    
    // Set line style
    graphics.lineStyle(this.lineWidth, colorNumber);
    
    if (viewMode === 'ISOMETRIC') {
      this.renderIsometric(graphics, colorNumber);
    } else {
      this.render2D(graphics);
    }
  }
  
  /**
   * Render 2D grid (square tiles)
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object
   */
  render2D(graphics) {
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
   */
  renderIsometric(graphics, colorNumber) {
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