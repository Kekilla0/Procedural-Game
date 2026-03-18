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
import { Container } from './container.js';
import { logger } from '../utils/logger.js';

import { DATA } from '../data/constants.js';

export class Token extends Entity {
  /**
   * Create a new Token
   * @param {number} x - X position in pixels
   * @param {number} y - Y position in pixels
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   * @param {Object} options - Token configuration
   * @param {Grid} options.grid - Grid instance (required)
   * @param {Canvas} [options.canvas] - Canvas instance for collision detection
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
    this.direction = 'south'; // last movement direction: 'north'|'south'|'east'|'west'
    this.useSprite = false;   // when true, Token.render() is skipped (sprite handles it)

    // Canvas reference for collision detection (walls, tokens, bounds)
    this.canvas = options.canvas || null;
    
    // Calculate stats after initialization (only calculates non-overridden stats)
    this.calculateStats();

    // Movement tracking for turns - MUST come after calculateStats()
    this.movementRemaining = this.movement;

    // Personal inventory — capacity derived from maxCapacity stat
    this.container = new Container(0, 0, 0, 0, {
      capacity: Math.max(1, Math.round(this.maxCapacity ?? 4))
    });
    
    logger.debug('Token created:', {
      name: this.name,
      position: `(${this.col}, ${this.row})`,
      health: this.health,
      movement: this.movement,
      movementRemaining: this.movementRemaining
    });
  }
  
  /**
   * Static method to spawn a token at a random position within bounds
   * @param {Class} TokenClass - Token class to instantiate (Player, Enemy, etc.)
   * @param {Canvas} canvas - Canvas instance (contains grid, tokens array)
   * @param {Object} options - Spawn options
   * @param {number} options.x - Top-left column of spawn area
   * @param {number} options.y - Top-left row of spawn area  
   * @param {number} options.w - Width of spawn area in tiles
   * @param {number} options.h - Height of spawn area in tiles
   * @param {string} options.name - Token name
   * @returns {Token|null} The spawned token or null if failed
   */
  static spawn(TokenClass, canvas, options = {}) {
    const grid = canvas.layers.grid;
    const tokens = canvas.layers.tokens;
    const tileSize = grid.size;
    
    // Extract spawn-area params; all remaining options are forwarded to the token constructor
    const { x = 0, y = 0, w = grid.columns, h = grid.rows, ...tokenOptions } = options;

    let col, row;
    let attempts = 0;
    const maxAttempts = 100;

    // Find random unoccupied position within bounds
    do {
      col = x + Math.floor(Math.random() * w);
      row = y + Math.floor(Math.random() * h);
      attempts++;

      // Ensure within grid bounds
      if (col < 0 || col >= grid.columns || row < 0 || row >= grid.rows) {
        continue;
      }

      // Check if position is occupied by another token
      const occupied = tokens.some(token => token.col === col && token.row === row);

      // TODO: Check if position is on impassable tile
      // const impassableTile = canvas.layers.tiles.some(tile =>
      //   tile.col === col && tile.row === row && !tile.passable
      // );

      // TODO: Check if position is on wall
      // const wall = canvas.layers.walls.some(wall =>
      //   wall.col === col && wall.row === row && !wall.passable
      // );

      if (!occupied) {
        break;
      }

      if (attempts >= maxAttempts) {
        logger.error(`Failed to spawn ${tokenOptions.name || 'Token'} after ${maxAttempts} attempts in area (${x}, ${y}, ${w}, ${h})`);
        return null;
      }
    } while (true);

    // Create token — spread all caller options, then override with computed position values
    const token = new TokenClass(
      col * tileSize,
      row * tileSize,
      tileSize,
      tileSize,
      {
        ...tokenOptions,  // img, color, stats, name, monsterType, etc.
        grid,
        canvas,
        col,
        row
      }
    );

    // Add token to tokens layer
    tokens.push(token);

    logger.info(`Spawned ${token.name} at (${col}, ${row})`);
    
    return token;
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
   * Grid coordinates (col, row) are the source of truth - never mutated
   * @param {string} viewMode - Current view mode ('2D' or 'ISOMETRIC')
   */
  updateScreenPosition() {
    const rotation = this.grid.rotation || 0;
    const isoTileWidth = 64;
    const offsetX = 400;
    const offsetY = 100;

    let col = this.col;
    let row = this.row;
    if (rotation !== 0) {
      const rotated = Token.rotateCoordinates(col, row, rotation, this.grid.columns - 1, this.grid.rows - 1);
      col = rotated.col;
      row = rotated.row;
    }

    const isoPos = Token.cartesianToIso(col + 0.5, row + 0.5, isoTileWidth);
    this.x = isoPos.screenX + offsetX - this.width / 2;
    this.y = isoPos.screenY + offsetY - this.height / 2;
  }

  rotate() {
    this.updateScreenPosition();
  }
  
  /**
   * Override calculateStats to keep the personal container capacity in sync with maxCapacity.
   * Called from the constructor (before container exists) and on stat changes (after).
   */
  calculateStats() {
    super.calculateStats();
    if (this.container) {
      this.container.capacity = Math.max(1, Math.round(this.maxCapacity ?? 4));
    }
  }

  /**
   * Start a new turn - reset movement
   */
  startTurn() {
    this.movementRemaining = this.movement;
    logger.debug(`${this.name} turn started. Movement: ${this.movementRemaining}`);
  }
  
  /**
   * Attempt to move in a direction with collision detection
   * Consumes movement points when successful
   * @param {string} direction - Direction to move ('up', 'down', 'left', 'right')
   * @returns {boolean} True if movement succeeded, false if blocked
   */
  move(direction) {
    // Check if token has movement remaining
    if (this.movementRemaining < 1) {
      logger.debug(`${this.name}: No movement remaining this turn`);
      return false;
    }
    
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
    this.direction = direction.toLowerCase();

    // Delegate all collision detection (bounds, walls, token occupancy) to canvas
    if (this.canvas) {
      if (!this.canvas.canMoveTo(this, targetCol, targetRow)) {
        logger.debug(`Movement blocked at (${targetCol}, ${targetRow})`);
        return false;
      }
    } else {
      // Fallback: bounds check only (no canvas reference)
      if (targetCol < 0 || targetCol >= this.grid.columns ||
          targetRow < 0 || targetRow >= this.grid.rows) {
        logger.debug('Movement blocked: out of bounds');
        return false;
      }
    }

    // No collision detected - perform movement
    this.moveTo(targetCol, targetRow);
    
    // Consume movement
    this.movementRemaining -= 1;
    logger.debug(`${this.name} moved to (${targetCol}, ${targetRow}). Remaining: ${this.movementRemaining}`);
    
    // Auto-reset movement in DEBUG mode (only for Player class)
    if (DATA.DEBUG && this.movementRemaining === 0 && this.constructor.name === 'Player') {
      logger.debug('DEBUG: Player movement will reset in 1 second');
      setTimeout(() => {
        this.startTurn();
        logger.debug('DEBUG: Player movement auto-reset');
      }, 1000);
    }
    
    return true;
  }
  
  /**
   * Render token to Phaser graphics
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object
   * @param {string} viewMode - Current view mode ('2D' or 'ISOMETRIC')
   * @param {number} rotation - Map rotation (not used - x,y already rotated)
   * @param {Grid} grid - Grid instance (not used)
   */
  render(graphics, _viewMode, _rotation, _grid) {
    if (this.useSprite) return;
    // No debug outline for tokens (not needed)
    
    // Convert hex color to Phaser number format
    const colorNumber = parseInt(this.color.replace('#', '0x'));
    
    // Use stored x,y position (already accounts for rotation if applied)
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