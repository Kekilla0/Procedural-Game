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
    // Call Token constructor with player defaults
    super(x, y, width, height, {
      ...options,
      name: 'Player',
      color: '#0000FF', // Blue
      stats: {
        strength: 0,
        dexterity: 0,
        intelligence: 0
      }
    });
    
    // Movement tracking for turns
    this.movementRemaining = this.movement; // Current movement left this turn
    
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
   * Start a new turn - reset movement
   */
  startTurn() {
    this.movementRemaining = this.movement;
    logger.debug(`Player turn started. Movement: ${this.movementRemaining}`);
  }
  
  /**
   * Move player in a direction (overrides Token.move to consume movement)
   * @param {string} direction - Direction to move ('up', 'down', 'left', 'right')
   * @returns {boolean} True if moved, false if blocked or no movement remaining
   */
  move(direction) {
    // Check if player has movement remaining
    if (this.movementRemaining < 1) {
      logger.debug('No movement remaining this turn');
      return false;
    }
    
    // Try to move using parent method
    const moved = super.move(direction);
    
    // If successfully moved, consume 1 movement
    if (moved) {
      this.movementRemaining -= 1;
      logger.debug(`Movement consumed. Remaining: ${this.movementRemaining}`);
      
      // In DEBUG mode, auto-reset movement after 1 second when it reaches 0
      if (DATA.DEBUG && this.movementRemaining === 0) {
        logger.debug('DEBUG: Movement will reset in 1 second');
        setTimeout(() => {
          this.startTurn();
          logger.debug('DEBUG: Movement auto-reset');
        }, 1000);
      }
    }
    
    return moved;
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