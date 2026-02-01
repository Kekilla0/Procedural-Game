/**
 * Canvas.js - Data storage for game board background
 * 
 * Stores canvas dimensions and background appearance.
 * Extends Renderable to support rendering to Phaser graphics.
 */

import { Renderable } from './renderable.js';
import { Grid } from './grid.js';
import { DATA } from '../data/constants.js';
import { logger } from '../utils/logger.js';

export class Canvas extends Renderable {
  /**
   * Create a new Canvas
   * @param {number} width - Canvas width in pixels
   * @param {number} height - Canvas height in pixels
   */
  constructor(width, height) {
    // Canvas always starts at origin (0, 0)
    super(0, 0, width, height);
    
    // Background appearance
    this.img = null; // Optional: image asset path
    this.color = DATA.CANVAS.COLOR; // Default: medium light grey
    
    // Layer data storage
    this.layers = {
      grid: new Grid(width, height), // Initialize grid with canvas dimensions
      walls: [],  // Walls layer data
      tiles: [],  // Tiles layer data
      tokens: []  // Tokens layer data
    };

    logger.debug("Canvas Initialized.");
  }
  
  /**
   * Render canvas background to Phaser graphics
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object to draw to
   * @param {string} viewMode - Current view mode ('2D' or 'ISOMETRIC')
   * @param {Function} gridToScreen - Function to convert grid coords to screen coords
   */
  render(graphics, viewMode = '2D', gridToScreen = null) {
    // Call parent render for basic setup (debug outline)
    super.render(graphics);
    
    // Draw background color as filled rectangle
    const colorNumber = parseInt(this.color.replace('#', '0x'));
    graphics.fillStyle(colorNumber);
    graphics.fillRect(this.x, this.y, this.width, this.height);
    
    // Draw background image on top if it exists (image will overlay color)
    if (this.img) {
      // TODO: Draw image when image loading is implemented
      logger.debug("Image rendering not yet implemented");
    }
    
    // Render grid layer if it exists
    if (this.layers.grid) {
      this.layers.grid.render(graphics, viewMode, gridToScreen);
    }
    
    // Render tokens layer
    this.renderTokens(graphics);
  }
  
  /**
   * Render all tokens in the tokens layer
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object to draw to
   */
  renderTokens(graphics) {
    for (const token of this.layers.tokens) {
      token.render(graphics);
    }
  }
  
  /**
   * Get the background (image or color)
   * @returns {string|null} Background image path or color
   */
  getBackground() {
    // If image is set, return that; otherwise return color
    return this.img || this.color;
  }
  
  /**
   * Set background color
   * @param {string} color - Hex color code (e.g., '#CCCCCC')
   */
  setBackgroundColor(color) {
    // Validate color format (hex color: #RGB or #RRGGBB)
    const isValidHex = /^#([0-9A-F]{3}){1,2}$/i.test(color);
    
    if (isValidHex)
      this.color = color;
    else{
      this.color = DATA.CANVAS.COLOR;
      logger.error(`Invalid Background Color.`, {color});
    }
  }
  
  /**
   * Set background image
   * @param {string} imagePath - Path to background image asset
   */
  setBackgroundImage(imagePath) {
    this.img = imagePath;
  }
}