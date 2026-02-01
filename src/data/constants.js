/**
 * constants.js - Centralized default values and constants
 * 
 * All game-wide defaults and constant values should be stored here.
 * Import using: import { DATA } from './data/constants.js';
 * Access values: DATA.CANVAS.COLOR
 */

// ====================
// GENERAL SETTINGS
// ====================

/**
 * Debug mode - enables debug rendering (outlines, info, etc)
 */
const DEBUG = true;

// ====================
// VIEW MODE
// ====================

/**
 * View mode settings
 */
const VIEW = {
  MODE: '2D',           // Default view mode ('2D' or 'ISOMETRIC')
  TOGGLE_KEY: 'x',      // Key to toggle view mode (lowercase for comparison)
  ISO_ROTATION: 45      // Rotation angle for isometric view (degrees)
};

// ====================
// CANVAS DEFAULTS
// ====================

/**
 * Canvas default settings
 */
const CANVAS = {
  COLOR: '#CCCCCC' // Default background color (medium light grey)
};

// ====================
// GRID DEFAULTS
// ====================

/**
 * Grid default settings
 */
const GRID = {
  COLOR: '#000000', // Grid line color (black)
  SIZE: 25,         // Tile size in pixels
  WIDTH: 2          // Line thickness in pixels
};

// ====================
// CAMERA DEFAULTS
// ====================

/**
 * Camera zoom settings
 */
const CAMERA = {
  MIN_TILES_HEIGHT: 10,  // Minimum number of tiles visible in height when fully zoomed in
  ZOOM_SPEED: 0.1,       // Zoom increment per mouse wheel tick
  ZOOM_SMOOTH_DURATION: 200  // Duration of zoom animation in milliseconds
};

// ====================
// STATS CALCULATIONS
// ====================

/**
 * Formulas for calculating sub-stats from base stats
 * Use @variable to reference stat values (e.g., @strength, @dexterity)
 * Use @bonuses for any additional modifiers
 * These will need balancing during game design
 */
const STATS = {
  // Health calculation
  HEALTH_CALCULATION: "@strength * 5 + @bonuses",
  
  // Capacity calculation
  CAPACITY_CALCULATION: "@strength * 2 + @bonuses",
  
  // Defense calculation
  DEFENSE_CALCULATION: "@dexterity + 5 + @bonuses",
  
  // Movement calculation
  MOVEMENT_CALCULATION: "2 + @dexterity / 3 + @bonuses",
  
  // Initiative calculation
  INITIATIVE_CALCULATION: "@intelligence + @bonuses",
  
  // Skill calculation
  SKILL_CALCULATION: "@intelligence + @bonuses"
};

/**
 * DATA - Exported constants object
 * Contains all default values and constants for the game
 */
export const DATA = {
  DEBUG,
  VIEW,
  CANVAS,
  GRID,
  CAMERA,
  STATS
};