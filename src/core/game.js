/**
 * Game.js - Main game scene (turn-based, event-driven)
 * 
 * This is the core game scene. Unlike real-time games, this is turn-based,
 * so rendering only happens when game state changes (player input, enemy turn, etc).
 * 
 * Extends Phaser.Scene to use Phaser's graphics, input, and scene management.
 */

import { Canvas } from './canvas.js';
import { Player } from './player.js';
import { DATA } from '../data/constants.js';
import { logger } from '../utils/logger.js';
import { toggleDebugPanel, updateDebugPanel } from '../utils/debug.js';

export class Game extends Phaser.Scene {
  
  constructor() {
    super({ key: 'Game' });
  }
  
  /**
   * Create game objects (runs once when scene starts)
   */
  create() {
    logger.info('Game scene created');
    
    // Set initial view mode
    this.viewMode = DATA.VIEW.MODE;
    
    // Create canvas background
    this.canvas = new Canvas(800, 600);
    
    // Create graphics object for rendering
    this.graphics = this.add.graphics();
    
    // Create player at grid position (5, 5)
    const grid = this.canvas.layers.grid;
    const playerCol = 5;
    const playerRow = 5;
    const tileSize = grid.size;
    
    this.player = new Player(
      playerCol * tileSize,  // x
      playerRow * tileSize,  // y
      tileSize,              // width
      tileSize,              // height
      {
        grid: grid,
        col: playerCol,
        row: playerRow
      }
    );
    
    // Add player to tokens layer
    this.canvas.layers.tokens.push(this.player);
    
    // Setup camera
    this.setupCamera();
    
    // Setup keyboard input
    this.setupInput();
    
    // Show/hide debug panel based on DEBUG constant
    toggleDebugPanel();
    
    // Set initial debug panel values
    updateDebugPanel({
      x: 0,
      y: 0,
      col: 0,
      row: 0,
      playerCol: this.player.col,
      playerRow: this.player.row
    });
    
    // Initial render
    this.render();
    
    logger.debug('Initial render complete');
  }
  
  /**
   * Setup camera zoom and following
   */
  setupCamera() {
    const camera = this.cameras.main;
    
    // Set camera bounds to match canvas size
    camera.setBounds(0, 0, this.canvas.width, this.canvas.height);
    
    // Calculate max zoom (when showing minimum tiles in height)
    const grid = this.canvas.layers.grid;
    this.maxZoom = grid.rows / DATA.CAMERA.MIN_TILES_HEIGHT;
    this.minZoom = 1.0; // Show entire map
    
    // Start fully zoomed out
    camera.setZoom(this.minZoom);
    
    // Make camera follow player (smooth following)
    camera.startFollow(this.player, true, 0.1, 0.1);
    
    logger.debug('Camera setup:', {
      minZoom: this.minZoom,
      maxZoom: this.maxZoom,
      following: 'player'
    });
  }
  
  /**
   * Setup keyboard input handlers
   */
  setupInput() {
    this.input.keyboard.on('keydown', (event) => {
      this.handleInput(event.key);
    });
    
    // Track mouse position for debug
    this.input.on('pointermove', (pointer) => {
      // Calculate which grid square the mouse is in
      const col = Math.floor(pointer.x / DATA.GRID.SIZE);
      const row = Math.floor(pointer.y / DATA.GRID.SIZE);
      
      updateDebugPanel({
        x: Math.floor(pointer.x),
        y: Math.floor(pointer.y),
        col: col,
        row: row,
        playerCol: this.player.col,
        playerRow: this.player.row
      });
    });
    
    // Mouse wheel zoom
    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
      this.handleZoom(deltaY);
    });
  }
  
  /**
   * Handle mouse wheel zoom
   * @param {number} deltaY - Mouse wheel delta (positive = zoom out, negative = zoom in)
   */
  handleZoom(deltaY) {
    const camera = this.cameras.main;
    const currentZoom = camera.zoom;
    
    // Calculate new zoom level
    let targetZoom = currentZoom;
    
    if (deltaY < 0) {
      // Scroll up - zoom in
      targetZoom += DATA.CAMERA.ZOOM_SPEED;
    } else if (deltaY > 0) {
      // Scroll down - zoom out
      targetZoom -= DATA.CAMERA.ZOOM_SPEED;
    }
    
    // Clamp zoom to min/max
    targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, targetZoom));
    
    // Apply smooth zoom
    camera.zoomTo(targetZoom, DATA.CAMERA.ZOOM_SMOOTH_DURATION);
    
    logger.debug(`Zoom: ${currentZoom.toFixed(2)} → ${targetZoom.toFixed(2)}`);
  }
  
  /**
   * Handle player input (triggers game logic)
   * @param {string} key - Key that was pressed
   */
  handleInput(key) {
    logger.debug('Key pressed:', key);
    
    // Check for view mode toggle
    if (key === DATA.VIEW.TOGGLE_KEY) {
      this.toggleViewMode();
      return;
    }
    
    // WASD movement
    const lowerKey = key.toLowerCase();
    let moved = false;
    
    if (lowerKey === 'w') {
      // Move up
      moved = this.player.move('up');
    } else if (lowerKey === 's') {
      // Move down
      moved = this.player.move('down');
    } else if (lowerKey === 'a') {
      // Move left
      moved = this.player.move('left');
    } else if (lowerKey === 'd') {
      // Move right
      moved = this.player.move('right');
    }
    
    // Re-render if player moved
    if (moved) {
      logger.debug(`Player moved to (${this.player.col}, ${this.player.row})`);
      
      // Update debug panel with new player position
      updateDebugPanel({
        playerCol: this.player.col,
        playerRow: this.player.row
      });
      
      this.render();
    }
  }
  
  /**
   * Toggle between 2D and isometric view modes
   */
  toggleViewMode() {
    // Toggle mode
    this.viewMode = this.viewMode === '2D' ? 'ISOMETRIC' : '2D';
    
    logger.info(`View mode changed to: ${this.viewMode}`);
    
    // Update all entity positions
    this.updateEntityPositions();
    
    // Re-render
    this.render();
  }
  
  /**
   * Update all entity pixel positions based on current view mode
   */
  updateEntityPositions() {
    // Update all tokens
    for (const token of this.canvas.layers.tokens) {
      const pos = this.gridToScreen(token.col, token.row);
      token.x = pos.x;
      token.y = pos.y;
    }
    
    // TODO: Update walls when implemented
    // TODO: Update tiles when implemented
  }
  
  /**
   * Convert grid coordinates to screen coordinates based on view mode
   * @param {number} col - Grid column
   * @param {number} row - Grid row
   * @returns {Object} Screen position {x, y}
   */
  gridToScreen(col, row) {
    if (this.viewMode === 'ISOMETRIC') {
      // Isometric projection
      const isoX = (col - row) * (DATA.VIEW.ISO_TILE_WIDTH / 2);
      const isoY = (col + row) * (DATA.VIEW.ISO_TILE_HEIGHT / 2);
      
      // Center the isometric view
      const offsetX = this.canvas.width / 2;
      const offsetY = 50; // Offset from top
      
      return {
        x: isoX + offsetX,
        y: isoY + offsetY
      };
    } else {
      // 2D mode
      const tileSize = this.canvas.layers.grid.size;
      return {
        x: col * tileSize,
        y: row * tileSize
      };
    }
  }
  
  /**
   * Render the game (only called when state changes)
   */
  render() {
    // Clear previous frame
    this.graphics.clear();
    
    // Canvas handles rendering of background, grid, and all layers
    this.canvas.render(this.graphics, this.viewMode, this.gridToScreen.bind(this));
  }
  
  /**
   * Update method (runs every frame)
   * For turn-based games, we don't need continuous updates
   */
  update() {
    // Intentionally empty - we use event-driven rendering
  }
  
  /**
   * Process a turn for an entity
   * @param {Object} entity - Entity taking their turn
   */
  processTurn(entity) {
    // TODO: Implement turn processing
    // - Execute entity's action
    // - Update game state
    // - Re-render
    this.render();
  }
}