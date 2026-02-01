/**
 * camera.js - Camera controller class
 * 
 * Handles all camera operations:
 * - Zoom levels
 * - View mode transformations (2D vs Isometric)
 * - Following entities
 * - Bounds management
 */

import { DATA } from '../data/constants.js';
import { logger } from '../utils/logger.js';

export class Camera {
  /**
   * Create a new Camera controller
   * @param {Phaser.Cameras.Scene2D.Camera} phaserCamera - The Phaser camera instance
   * @param {Object} options - Camera configuration
   * @param {number} options.canvasWidth - Canvas width for bounds
   * @param {number} options.canvasHeight - Canvas height for bounds
   * @param {Grid} options.grid - Grid instance for zoom calculations
   */
  constructor(phaserCamera, options = {}) {
    this.camera = phaserCamera;
    this.canvasWidth = options.canvasWidth;
    this.canvasHeight = options.canvasHeight;
    this.grid = options.grid;
    
    // View mode
    this.viewMode = DATA.VIEW.MODE;
    
    // Zoom limits
    this.minZoom = 1.0;
    this.maxZoom = this.grid.rows / DATA.CAMERA.MIN_TILES_HEIGHT;
    
    // Set initial camera bounds
    this.camera.setBounds(0, 0, this.canvasWidth, this.canvasHeight);
    
    // Start at default zoom
    this.camera.setZoom(this.minZoom);
    
    logger.debug('Camera initialized:', {
      bounds: `${this.canvasWidth}x${this.canvasHeight}`,
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      viewMode: this.viewMode
    });
  }
  
  /**
   * Make camera follow an entity
   * @param {Entity} entity - Entity to follow
   */
  follow(entity) {
    // Smooth following with lerp
    this.camera.startFollow(entity, true, 0.1, 0.1);
    logger.debug('Camera now following entity');
  }
  
  /**
   * Toggle between 2D and isometric view modes
   * NOTE: Isometric is now handled by projection math in Canvas, not camera rotation
   */
  toggleViewMode() {
    // Toggle mode
    this.viewMode = this.viewMode === '2D' ? 'ISOMETRIC' : '2D';
    
    logger.info(`Camera view mode: ${this.viewMode}`);
    
    // No camera transformations needed - projection is handled by Canvas rendering
    if (this.viewMode === 'ISOMETRIC') {
      logger.debug('Isometric mode: Canvas will use projection math');
    } else {
      logger.debug('2D mode: Canvas will render normally');
    }
  }
  
  /**
   * Handle zoom change
   * TEMPORARILY DISABLED FOR ISOMETRIC DEVELOPMENT
   * @param {number} delta - Positive = zoom out, negative = zoom in
   */
  zoom(delta) {
    const currentZoom = this.camera.zoom;
    let targetZoom = currentZoom;
    
    if (delta < 0) {
      // Zoom in
      targetZoom += DATA.CAMERA.ZOOM_SPEED;
    } else if (delta > 0) {
      // Zoom out
      targetZoom -= DATA.CAMERA.ZOOM_SPEED;
    }
    
    // Clamp to limits
    targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, targetZoom));
    
    // Apply smooth zoom
    this.camera.zoomTo(targetZoom, DATA.CAMERA.ZOOM_SMOOTH_DURATION);
    
    logger.debug(`Zoom: ${currentZoom.toFixed(2)} → ${targetZoom.toFixed(2)}`);
  }
  
  /**
   * Get current view mode
   * @returns {string} Current view mode ('2D' or 'ISOMETRIC')
   */
  getViewMode() {
    return this.viewMode;
  }
}