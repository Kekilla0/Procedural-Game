/**
 * token.js - Token class for players and monsters
 * 
 * Token represents entities that can move and take turns:
 * - Players
 * - Monsters/Enemies
 * 
 * Extends Entity to inherit stats and position.
 */

import { Entity } from './entity.js';
import { logger } from '../utils/logger.js';
import { cartesianToIso } from '../utils/projection.js';

export class Token extends Entity {
  /**
   * Create a new Token
   * @param {number} x - X position in pixels
   * @param {number} y - Y position in pixels
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   * @param {Object} options - Token configuration
   * @param {Grid} options.grid - Grid instance (required)
   * @param {number} [options.col] - Grid column position
   * @param {number} [options.row] - Grid row position
   * @param {string} [options.name] - Token name
   * @param {string} [options.color] - Token color (hex string)
   * @param {string} [options.img] - Token image path
   * @param {Object} [options.stats] - Stat overrides (can include base stats or sub-stats)
   */
  constructor(x, y, width, height, options = {}) {
    // Extract stats from options if provided
    const stats = options.stats || {};
    
    // Call Entity constructor with standardized signature
    super(x, y, width, height, {
      grid: options.grid,
      col: options.col,
      row: options.row,
      ...stats // Spread stat overrides (strength, dexterity, intelligence, health, etc.)
    });
    
    // Token properties
    this.name = options.name || 'Token';
    this.color = options.color || '#FFFFFF';
    this.img = options.img || null;
    
    // Calculate stats after initialization (only calculates non-overridden stats)
    this.calculateStats();
    
    logger.debug('Token created:', {
      name: this.name,
      position: `(${this.col}, ${this.row})`,
      health: this.health
    });
  }
  
  /**
   * Move token to new grid position
   * Updates both grid and pixel positions
   */
  moveTo(col, row) {
    this.col = col;
    this.row = row;
    
    // Update pixel position
    const tileSize = this.grid.size;
    this.x = col * tileSize;
    this.y = row * tileSize;
  }
  
  /**
   * Update screen position based on view mode
   * Required for camera to follow token correctly in isometric mode
   * @param {string} viewMode - Current view mode ('2D' or 'ISOMETRIC')
   */
  updateScreenPosition(viewMode = '2D') {
    if (viewMode === 'ISOMETRIC') {
      // Calculate isometric screen position for camera to follow
      const isoTileWidth = 64;
      const offsetX = 400;
      const offsetY = 100;
      
      const tileCenterCol = this.col + 0.5;
      const tileCenterRow = this.row + 0.5;
      
      const isoPos = cartesianToIso(tileCenterCol, tileCenterRow, isoTileWidth);
      
      // Update x,y to match visual position for camera following
      this.x = isoPos.screenX + offsetX - this.width / 2;
      this.y = isoPos.screenY + offsetY - this.height / 2;
    } else {
      // 2D mode - use grid position
      const tileSize = this.grid.size;
      this.x = this.col * tileSize;
      this.y = this.row * tileSize;
    }
  }
  
  /**
   * Attempt to move in a direction with collision detection
   * @param {string} direction - Direction to move ('up', 'down', 'left', 'right')
   * @returns {boolean} True if movement succeeded, false if blocked
   */
  move(direction) {
    // Calculate target position based on direction
    let targetCol = this.col;
    let targetRow = this.row;
    
    switch(direction.toLowerCase()) {
      case 'up':
        targetRow -= 1;
        break;
      case 'down':
        targetRow += 1;
        break;
      case 'left':
        targetCol -= 1;
        break;
      case 'right':
        targetCol += 1;
        break;
      default:
        logger.error('Invalid direction:', direction);
        return false;
    }
    
    // Check collision with map boundaries
    if (targetCol < 0 || targetCol >= this.grid.columns || 
        targetRow < 0 || targetRow >= this.grid.rows) {
      logger.debug('Movement blocked: out of bounds');
      return false;
    }
    
    // TODO: Check collision with walls
    // - Loop through canvas.layers.walls
    // - Check if any wall is at (targetCol, targetRow)
    // - If wall.passable === false, return false
    
    // TODO: Check collision with tiles
    // - Loop through canvas.layers.tiles
    // - Check if any tile is at (targetCol, targetRow)
    // - If tile.passable === false, return false
    
    // TODO: Check collision with other tokens
    // - Loop through canvas.layers.tokens
    // - Check if any token (except this) is at (targetCol, targetRow)
    // - If token.passable === false, return false
    
    // No collision detected - perform movement
    this.moveTo(targetCol, targetRow);
    return true;
  }
  
  /**
   * Render token to Phaser graphics
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object
   * @param {string} viewMode - Current view mode ('2D' or 'ISOMETRIC')
   */
  render(graphics, viewMode = '2D') {
    // Only render debug outline in 2D mode (isometric position doesn't match grid)
    if (viewMode === '2D') {
      super.render(graphics);
    }
    
    // Convert hex color to Phaser number format
    const colorNumber = parseInt(this.color.replace('#', '0x'));
    
    // Use x,y position (already updated by updateScreenPosition for isometric)
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    
    // Draw token as filled circle
    const radius = this.width * 0.4; // 40% of tile size
    
    graphics.fillStyle(colorNumber);
    graphics.fillCircle(centerX, centerY, radius);
    
    // Draw outline
    graphics.lineStyle(2, 0x000000);
    graphics.strokeCircle(centerX, centerY, radius);
    
    // Render image on top of circle if it exists (gives it a border)
    if (this.img) {
      // TODO: Image rendering not yet implemented
      logger.debug('Image rendering not yet implemented');
    }
  }
}