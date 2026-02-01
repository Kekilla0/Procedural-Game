/**
 * main.js - Entry point for Phaser 3 game
 */
import { Game } from './core/game.js';
import { logger } from './utils/logger.js';
import { roll, rollSingle, rollAdvantage, rollDisadvantage } from './utils/dice.js';
import { calculate } from './utils/math.js';

// Phaser 3 configuration
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game',
  backgroundColor: '#000000', // Black background (Canvas will draw over this)
  scene: [Game], // Add Game scene
  physics: {
    default: false // We don't need physics
  }
};

// Create Phaser game
const game = new Phaser.Game(config);

// Expose to window for debugging
window.game = game;
window.logger = logger;

// Expose dice and math utilities for testing
window.roll = roll;
window.calculate = calculate;

logger.info('Phaser 3 game initialized');