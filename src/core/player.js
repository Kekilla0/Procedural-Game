/**
 * player.js - Player character class
 * 
 * Represents the player-controlled character.
 * Extends Token with player-specific properties and stats.
 */

import { Token } from './token.js';
import { logger } from '../utils/logger.js';

export class Player extends Token {
  /**
   * Create a new Player
   * @param {number} x - X position in pixels
   * @param {number} y - Y position in pixels
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   * @param {Object} options - Player configuration
   * @param {Grid} options.grid - Grid instance (required)
   * @param {number} [options.col] - Grid column position
   * @param {number} [options.row] - Grid row position
   */
  constructor(x, y, width, height, options = {}) {
    // Call Token constructor with player defaults
    super(x, y, width, height, {
      ...options,
      name: 'Player',
      color: '#0000FF', // Blue
      stats: {
        strength: 12,
        dexterity: 14,
        intelligence: 10
      }
    });
    
    logger.info('Player created:', {
      position: `(${this.col}, ${this.row})`,
      stats: {
        STR: this.strength,
        DEX: this.dexterity,
        INT: this.intelligence,
        HP: this.health,
        DEF: this.defense,
        MOV: this.movement
      }
    });
    
    // Initial stats panel update
    this.updateStatsPanel();
  }
  
  /**
   * Calculate all sub-stats from base stats
   * Overrides parent to also update stats panel
   */
  calculateStats() {
    // Call parent calculation
    super.calculateStats();
    
    // Update stats panel if it exists
    this.updateStatsPanel();
  }
  
  /**
   * Update the stats panel in the UI with current player stats
   */
  updateStatsPanel() {
    // Check if stats panel exists in DOM
    if (!document.getElementById('stat-strength')) {
      logger.debug('Stats panel not found in DOM');
      return;
    }
    
    // Base stats
    document.getElementById('stat-strength').textContent = this.strength;
    document.getElementById('stat-dexterity').textContent = this.dexterity;
    document.getElementById('stat-intelligence').textContent = this.intelligence;
    
    // Combat stats
    document.getElementById('stat-health').textContent = this.health;
    document.getElementById('stat-defense').textContent = this.defense;
    document.getElementById('stat-initiative').textContent = this.initiative;
    
    // Other stats
    document.getElementById('stat-capacity').textContent = this.capacity;
    document.getElementById('stat-movement').textContent = this.movement;
    document.getElementById('stat-skill').textContent = this.skill;
    
    logger.debug('Stats panel updated');
  }
}