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
   * @param {Function} gridToScreen - Function to convert grid coords to screen coords
   */
  render(graphics, viewMode = '2D', gridToScreen = null) {
    // Call parent render for debug outline
    super.render(graphics);
    
    // Convert hex color string to Phaser number format
    const colorNumber = parseInt(this.color.replace('#', '0x'));
    
    // Set line style
    graphics.lineStyle(this.lineWidth, colorNumber);
    
    if (viewMode === 'ISOMETRIC' && gridToScreen) {
      this.renderIsometric(graphics, gridToScreen);
    } else {
      this.render2D(graphics);
    }
  }
  
  /**
   * Render 2D grid
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
   * Render isometric grid
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object
   * @param {Function} gridToScreen - Function to convert grid coords to screen coords
   */
  renderIsometric(graphics, gridToScreen) {
    // Draw diamond-shaped tiles
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.columns; col++) {
        // Get corner positions
        const topLeft = gridToScreen(col, row);
        const topRight = gridToScreen(col + 1, row);
        const bottomRight = gridToScreen(col + 1, row + 1);
        const bottomLeft = gridToScreen(col, row + 1);
        
        // Draw diamond
        graphics.beginPath();
        graphics.moveTo(topLeft.x, topLeft.y);
        graphics.lineTo(topRight.x, topRight.y);
        graphics.lineTo(bottomRight.x, bottomRight.y);
        graphics.lineTo(bottomLeft.x, bottomLeft.y);
        graphics.closePath();
        graphics.strokePath();
      }
    }
  }
}