/**
 * enemy.js - Enemy class for AI-controlled entities
 * 
 * Enemy represents hostile entities that can:
 * - Move around the map
 * - Attack the player
 * - Be controlled by AI (future)
 * 
 * Unlike Player, Enemy does not:
 * - Show movement highlighting
 * - Have user input control
 * - Update stats panel
 */

import { Token } from './token.js';
import { logger } from '../utils/logger.js';
import { DATA } from '../data/constants.js';

export class Enemy extends Token {
  /**
   * Create a new Enemy
   * @param {number} x - X position in pixels
   * @param {number} y - Y position in pixels
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   * @param {Object} options - Enemy configuration (same as Token options)
   */
  constructor(x, y, width, height, options = {}) {
    // Call Token constructor with enemy defaults from constants
    super(x, y, width, height, {
      ...options,
      name: options.name || DATA.ENEMY.NAME,
      color: options.color || DATA.ENEMY.COLOR,
      stats: options.stats || DATA.ENEMY.BASE_STATS
    });
    
    logger.info('Enemy created:', {
      name: this.name,
      position: `(${this.col}, ${this.row})`,
      stats: {
        STR: this.strength,
        DEX: this.dexterity,
        INT: this.intelligence,
        HP: this.health,
        MOV: this.movement
      }
    });
  }
  
  /**
   * AI: Take a turn (placeholder for future AI implementation)
   * For now, enemies don't move automatically
   */
  takeTurn() {
    // TODO: Implement AI behavior
    // - Calculate path to player
    // - Move towards player
    // - Attack if in range
    // - Use abilities
    
    logger.debug(`${this.name} is thinking... (AI not implemented yet)`);
  }
}