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
  ROTATION_KEY: 'e',       // Key to rotate clockwise (lowercase for comparison)
  ROTATION_KEY_CCW: 'q',   // Key to rotate counter-clockwise (lowercase for comparison)
  ROTATION_INCREMENT: 90   // Degrees to rotate per key press (90 = quarter turn)
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
  ZOOM_SPEED: 0.15,      // Zoom increment per mouse wheel tick
  ZOOM_SMOOTH_DURATION: 200  // Duration of zoom animation in milliseconds
};

/**
 * Movement settings
 */
const MOVEMENT = {
  STEP_DELAY: 100,        // Delay in ms between movement steps (0.1 seconds)
  RANGE_COLOR: 0x87CEEB,  // Light blue color for movement range
  RANGE_OPACITY: 0.5      // Opacity for movement range (0-1)
};

/**
 * Mouse interaction settings
 */
const MOUSE = {
  HOVER_COLOR: 0xFFFFFF,   // White color for hovered tile
  HOVER_OPACITY: 0.4       // Opacity for hovered tile (0-1)
};

/**
 * Player defaults
 */
const PLAYER = {
  NAME: 'Player',
  COLOR: '#0000FF',  // Blue
  BASE_STATS: {
    strength: 10,
    dexterity: 10,
    intelligence: 10
  }
};

/**
 * Wall defaults
 */
const WALL = {
  COLOR: '#4d4d4d',       // Gray
  HEIGHT: 1.5,            // Wall height in tile units (ISO only). Screen px = HEIGHT * isoTileWidth/2
  FADE_DISTANCE: 4,       // Tiles radius within which walls in front of the player become transparent
  STATES: {
    SOLID:     0,  // visible, impassable (normal wall)
    INVISIBLE: 1,  // invisible to player, impassable (force field / barrier)
    HIDDEN:    2,  // visible (looks solid), passable (secret passage)
    OPEN:      3   // invisible, passable (open doorway)
  }
};

/**
 * Door defaults
 */
const DOOR = {
  COLOR: '#5a2d0a'  // Brown
};

/**
 * Enemy defaults
 */
const ENEMY = {
  NAME: 'Enemy',
  COLOR: '#FF0000',  // Red
  BASE_STATS: {
    strength: 0,
    dexterity: 0,
    intelligence: 0
  }
};

const CHARACTER_CLASSES = {
  warrior:  { strength: 15, dexterity: 10, intelligence: 5 },
  rogue:    { strength: 10, dexterity: 15, intelligence: 5 },
  sorcerer: { strength: 5,  dexterity: 10, intelligence: 15 }
};

// ====================
// STATS CALCULATIONS
// ====================

/**
 * Formulas for calculating sub-stats from base stats
 * Use @variable to reference stat values (e.g., @strength, @dexterity)
 * Use @bonuses for any additional modifiers
 * Math.js evaluates these formulas and supports parentheses
 */
const STATS = {
  // Health calculation
  HEALTH_CALCULATION: "(@strength) * 5 + @bonuses",
  
  // Capacity calculation
  CAPACITY_CALCULATION: "10 + (@strength - 10 / 2) + @bonuses",
  
  // Defense calculation
  DEFENSE_CALCULATION: "@dexterity - 10 + 5 + @bonuses",
  
  // Movement calculation
  MOVEMENT_CALCULATION: "(@dexterity / 5) + @bonuses",
  
  // Initiative calculation
  INITIATIVE_CALCULATION: "@intelligence / 2 + @bonuses",
  
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
  MOVEMENT,
  MOUSE,
  PLAYER,
  WALL,
  DOOR,
  ENEMY,
  CHARACTER_CLASSES,
  STATS
};