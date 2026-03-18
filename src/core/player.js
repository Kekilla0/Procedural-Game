/**
 * player.js - Player character class
 * 
 * Represents the player-controlled character.
 * Extends Token with player-specific properties and stats.
 */

import { Token } from './token.js';
import { logger } from '../utils/logger.js';
import { DATA } from '../data/constants.js';

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
    // Call Token constructor with player defaults from constants
    super(x, y, width, height, {
      ...options,
      name: options.name || DATA.PLAYER.NAME,
      color: options.color || DATA.PLAYER.COLOR,
      stats: options.stats || DATA.PLAYER.BASE_STATS
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
   * Calculate which tiles are within movement range
   * @returns {Array} Array of {col, row} objects representing reachable tiles
   */
  getMovementRange() {
    const range = [];
    const maxDist = Math.floor(this.movementRemaining);
    
    // Simple Manhattan distance for now (can move in cardinal directions)
    for (let dCol = -maxDist; dCol <= maxDist; dCol++) {
      for (let dRow = -maxDist; dRow <= maxDist; dRow++) {
        const distance = Math.abs(dCol) + Math.abs(dRow);
        
        if (distance > 0 && distance <= maxDist) {
          const targetCol = this.col + dCol;
          const targetRow = this.row + dRow;
          
          // Check if within grid bounds
          if (targetCol >= 0 && targetCol < this.grid.columns &&
              targetRow >= 0 && targetRow < this.grid.rows) {
            range.push({ col: targetCol, row: targetRow });
          }
        }
      }
    }
    
    return range;
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
    if (!document.getElementById('stat-strength')) {
      logger.debug('Stats panel not found in DOM');
      return;
    }

    // Base stats (flat values)
    document.getElementById('stat-strength').textContent     = this.strength;
    document.getElementById('stat-dexterity').textContent    = this.dexterity;
    document.getElementById('stat-intelligence').textContent = this.intelligence;

    // Pool stats — show current / max
    const maxHP  = this.maxHealth   ?? this.health;
    const maxMOV = this.movement    ?? 0;
    const maxCAP = this.maxCapacity ?? 0;
    const maxSKL = this.maxSkill    ?? this.skill;

    document.getElementById('stat-health').textContent     = `${this.health}/${maxHP}`;
    document.getElementById('stat-defense').textContent    = this.defense;
    document.getElementById('stat-initiative').textContent = this.initiative;
    document.getElementById('stat-capacity').textContent   = `${this.usedCapacity ?? 0}/${maxCAP}`;
    document.getElementById('stat-movement').textContent   = `${this.movementRemaining ?? maxMOV}/${maxMOV}`;
    document.getElementById('stat-skill').textContent      = `${this.skill}/${maxSKL}`;

    logger.debug('Stats panel updated');
  }
}