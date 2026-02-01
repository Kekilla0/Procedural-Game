/**
 * Renderable.js - Base class for anything that can be rendered
 * 
 * Handles core rendering properties: position (x, y) and dimensions (width, height)
 * Subclasses should override render() to implement specific rendering logic
 */

import { DATA } from '../data/constants.js';

export class Renderable {
  /**
   * Create a new Renderable
   * @param {number} x - X position in pixels
   * @param {number} y - Y position in pixels
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   */
  constructor(x, y, width, height) {
    // Position (pixels)
    this.x = x;
    this.y = y;
    
    // Dimensions (pixels)
    this.width = width;
    this.height = height;
  }
  
  /**
   * Render this object to Phaser graphics
   * Override this in subclasses to implement specific rendering
   * @param {Phaser.GameObjects.Graphics} graphics - Phaser graphics object to draw to
   */
  render(graphics) {
    // Draw debug boundary if debug mode is enabled
    if (DATA.DEBUG) {
      graphics.lineStyle(1, 0xFF0000); // 1px red outline
      graphics.strokeRect(this.x, this.y, this.width, this.height);
    }
  }
}