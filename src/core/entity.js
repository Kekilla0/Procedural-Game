/**
 * entity.js - Base class for game entities with stats
 * 
 * Entity represents anything in the game that has statistics:
 * - Tokens (players, monsters)
 * - Walls
 * - Tiles
 * 
 * Stores both grid position (col, row) and pixel position (x, y).
 * Has base stats and calculated sub-stats that can be overridden.
 */

import { Renderable } from './renderable.js';
import { DATA } from '../data/constants.js';
import { calculate } from '../utils/math.js';
import { logger } from '../utils/logger.js';

export class Entity extends Renderable {
  /**
   * Create a new Entity
   * @param {number} x - X position in pixels
   * @param {number} y - Y position in pixels
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   * @param {Object} options - Entity configuration
   * @param {Grid} options.grid - Grid instance (required for grid positioning)
   * @param {number} [options.col] - Grid column position
   * @param {number} [options.row] - Grid row position
   * @param {boolean} [options.passable=true] - Whether entities can move through this
   * @param {number} [options.strength=0] - Strength stat
   * @param {number} [options.dexterity=0] - Dexterity stat
   * @param {number} [options.intelligence=0] - Intelligence stat
   * @param {number} [options.health] - Health override (bypasses calculation)
   * @param {number} [options.capacity] - Capacity override
   * @param {number} [options.defense] - Defense override
   * @param {number} [options.movement] - Movement override
   * @param {number} [options.initiative] - Initiative override
   * @param {number} [options.skill] - Skill override
   */
  constructor(x, y, width, height, options = {}) {
    // Initialize Renderable with pixel position and size
    super(x, y, width, height);
    
    // Store grid reference (required)
    this.grid = options.grid;
    
    // Calculate and store grid position from pixel position if not provided
    if (options.col !== undefined && options.row !== undefined) {
      this.col = options.col;
      this.row = options.row;
    } else {
      // Calculate from pixel position
      this.col = Math.floor(x / this.grid.size);
      this.row = Math.floor(y / this.grid.size);
    }
    
    // Collision property
    this.passable = options.passable !== undefined ? options.passable : true;
    
    // Base stats (default to 0, can be overridden in options)
    this.strength = options.strength || 0;
    this.dexterity = options.dexterity || 0;
    this.intelligence = options.intelligence || 0;
    
    // Sub-stats (default to 0, will be calculated or overridden)
    this.health = 0;
    this.capacity = 0;
    this.defense = 0;
    this.movement = 0;
    this.initiative = 0;
    this.skill = 0;
    
    // Apply stat overrides if provided (allows things like walls with 0 STR but 400 HP)
    if (options.health !== undefined) this.health = options.health;
    if (options.capacity !== undefined) this.capacity = options.capacity;
    if (options.defense !== undefined) this.defense = options.defense;
    if (options.movement !== undefined) this.movement = options.movement;
    if (options.initiative !== undefined) this.initiative = options.initiative;
    if (options.skill !== undefined) this.skill = options.skill;
    
    // Calculate sub-stats (after subclass may override base stats)
    // Note: Subclasses should call this.calculateStats() after setting their stats
  }
  
  /**
   * Calculate all sub-stats from base stats
   * Only calculates stats that weren't overridden in constructor
   * Subclasses can override individual calculation methods
   */
  calculateStats() {
    // Only calculate if not overridden
    if (this.health === 0) this.health = this.calculateHealth();
    if (this.capacity === 0) this.capacity = this.calculateCapacity();
    if (this.defense === 0) this.defense = this.calculateDefense();
    if (this.movement === 0) this.movement = this.calculateMovement();
    if (this.initiative === 0) this.initiative = this.calculateInitiative();
    if (this.skill === 0) this.skill = this.calculateSkill();
  }
  
  /**
   * Calculate health from strength
   * Override in subclass to change calculation
   */
  calculateHealth() {
    return calculate(DATA.STATS.HEALTH_CALCULATION, {
      strength: this.strength,
      bonuses: 0
    });
  }
  
  /**
   * Calculate capacity from strength
   * Override in subclass to change calculation
   */
  calculateCapacity() {
    return calculate(DATA.STATS.CAPACITY_CALCULATION, {
      strength: this.strength,
      bonuses: 0
    });
  }
  
  /**
   * Calculate defense from dexterity
   * Override in subclass to change calculation
   */
  calculateDefense() {
    return calculate(DATA.STATS.DEFENSE_CALCULATION, {
      dexterity: this.dexterity,
      bonuses: 0
    });
  }
  
  /**
   * Calculate movement from dexterity
   * Override in subclass to change calculation
   */
  calculateMovement() {
    return calculate(DATA.STATS.MOVEMENT_CALCULATION, {
      dexterity: this.dexterity,
      bonuses: 0
    });
  }
  
  /**
   * Calculate initiative from intelligence
   * Override in subclass to change calculation
   */
  calculateInitiative() {
    return calculate(DATA.STATS.INITIATIVE_CALCULATION, {
      intelligence: this.intelligence,
      bonuses: 0
    });
  }
  
  /**
   * Calculate skill from intelligence
   * Override in subclass to change calculation
   */
  calculateSkill() {
    return calculate(DATA.STATS.SKILL_CALCULATION, {
      intelligence: this.intelligence,
      bonuses: 0
    });
  }
}