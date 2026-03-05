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
import { rectToIsoDiamond } from '../utils/projection.js';

export class Canvas extends Renderable {
  /**
   * Create a new Canvas
   * @param {number} width - Canvas width in pixels
   * @param {number} height - Canvas height in pixels
   * @param {object} options - Various options for data imported to constructor.
   */
  constructor(width, height, options = {}) {
    // Canvas always starts at origin (0, 0)
    super(0, 0, width, height);
    
    // Background appearance
    this.img = options.img || null; 
    this.color = options.color || DATA.CANVAS.COLOR; 

    this.viewMode = '2D';
    this.rotation = 0;
    
    // Layer data storage
    this.layers = {
      grid: null, 
      walls: [],  
      tiles: [],  
      tokens: []  
    };

    this.layers.grid = new Grid(width, height);

    logger.debug("Canvas Initialized.");
  }
  
  /**
   * Render canvas background to Phaser graphics
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object to draw to
   * @param {string} viewMode - Current view mode ('2D' or 'ISOMETRIC')
   * @param {Array} movementRange - Optional array of tiles to highlight for movement
   * @param {number} rotation - Map rotation in degrees (2D only, 0/90/180/270)
   */
  render(graphics, movementRange = []) {    
    if (this.viewMode === 'ISOMETRIC') {
      // In isometric mode: fill entire viewport with black first
      graphics.fillStyle(0x000000); // Black background
      graphics.fillRect(0, 0, 2000, 2000); // Fill large area (bigger than viewport)
      
      // Then draw the gray diamond on top
      const colorNumber = parseInt(this.color.replace('#', '0x'));
      graphics.fillStyle(colorNumber);
      
      // Use GRID dimensions, not pixel dimensions!
      const grid = this.layers.grid;
      const isoPoints = rectToIsoDiamond(0, 0, grid.columns, grid.rows, 64);
      
      // Center the isometric view in the viewport
      const offsetX = 400;
      const offsetY = 100;
      
      // Fill the diamond (gray)
      graphics.beginPath();
      graphics.moveTo(isoPoints[0].screenX + offsetX, isoPoints[0].screenY + offsetY);
      graphics.lineTo(isoPoints[1].screenX + offsetX, isoPoints[1].screenY + offsetY);
      graphics.lineTo(isoPoints[2].screenX + offsetX, isoPoints[2].screenY + offsetY);
      graphics.lineTo(isoPoints[3].screenX + offsetX, isoPoints[3].screenY + offsetY);
      graphics.closePath();
      graphics.fillPath();
      
      // No border - just the diamond shape
      
      // Render grid and tokens without rotation
      if (this.layers.grid) {
        this.layers.grid.render(graphics, viewMode, movementRange, 0);
      }
      this.renderTokens(graphics, viewMode, 0);
    } 
    if(viewMode === "2D") {
      // 2D mode - draw background (rotation is handled by individual objects)
      const colorNumber = parseInt(this.color.replace('#', '0x'));
      graphics.fillStyle(colorNumber);
      graphics.fillRect(this.x, this.y, this.width, this.height);
      
      // Draw background image on top if it exists (image will overlay color)
      if (this.img) {
        // TODO: Draw image when image loading is implemented
        logger.debug("Image rendering not yet implemented");
      }
      
      // Render grid layer - rotation passed to each object
      if (this.layers.grid) {
        this.layers.grid.render(graphics, viewMode, movementRange, rotation);
      }
      
      // Render tokens - rotation passed to each object
      this.renderTokens(graphics, viewMode, rotation);
    }
  }
  
  /**
   * Render all tokens in the tokens layer
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object to draw to
   * @param {string} viewMode - Current view mode ('2D' or 'ISOMETRIC')
   * @param {number} rotation - Map rotation in degrees (2D only, 0/90/180/270)
   */
  renderTokens(graphics, viewMode = '2D', rotation = 0) {
    for (const token of this.layers.tokens) {
      token.render(graphics, viewMode, rotation, this.layers.grid);
    }
  }
  
  /**
   * Rotate all objects on the canvas
   * @param {number} rotation - New rotation value (0, 90, 180, 270)
   */
  rotate(rotation) {
    logger.debug(`Canvas rotating to ${rotation}°`);

    //rotate canvas
    this.rotation = (this.rotation + rotation) % 360;
    
    
    // Rotate grid
    if (this.layers.grid) {
      this.layers.grid.rotate(rotation);
    }
    
    // Rotate all tokens
    for (const token of this.layers.tokens) {
      token.rotate(rotation);
    }
    
    // TODO: Rotate walls when implemented
    // for (const wall of this.layers.walls) {
    //   wall.rotate(rotation);
    // }
    
    // TODO: Rotate tiles when implemented
    // for (const tile of this.layers.tiles) {
    //   tile.rotate(rotation);
    // }
    
    logger.debug(`Canvas rotation complete`);
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