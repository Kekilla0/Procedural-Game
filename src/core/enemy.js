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

    // Monster type key (e.g. 'goblin') used for MONSTER_DEFS lookup and texture naming
    this.monsterType = options.monsterType || null;

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
   * Check if player is within `range` tiles of this enemy (Manhattan distance).
   * @param {number} playerCol
   * @param {number} playerRow
   * @param {number} [range=1]
   * @returns {boolean}
   */
  isWithin(playerCol, playerRow, range = 1) {
    return Math.abs(playerCol - this.col) + Math.abs(playerRow - this.row) <= range;
  }

  /**
   * Context menu items shown when the player right-clicks this enemy.
   * @param {Token} player
   * @returns {Array<{label: string, disabled?: boolean, action: Function}>}
   */
  getContextMenuItems(player) {
    const inRange = this.isWithin(player.col, player.row, 1);
    return [
      {
        label: 'Examine',
        action: () => logger.info(`Examined ${this.name} at (${this.col}, ${this.row})`)
      },
      {
        label: 'Attack',
        disabled: !inRange,
        action: () => this.kill()
      }
    ];
  }

  /**
   * Mark this enemy as dead so game.js can remove it from the scene.
   */
  kill() {
    this.alive = false;
    logger.info(`${this.name} has been slain!`);
  }

  /**
   * AI: Take a turn (placeholder for future AI implementation)
   */
  takeTurn() {
    logger.debug(`${this.name} is thinking... (AI not implemented yet)`);
  }
}