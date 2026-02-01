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
import { Camera } from './camera.js';
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
    
    // Create camera controller
    this.cameraController = new Camera(this.cameras.main, {
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      grid: grid
    });
    
    // Make camera follow player
    this.cameraController.follow(this.player);
    
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
    
    // Mouse wheel zoom - TEMPORARILY DISABLED FOR ISOMETRIC DEVELOPMENT
    // this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY, deltaZ) => {
    //   this.handleZoom(deltaY);
    // });
  }
  
  /**
   * Handle mouse wheel zoom
   * TEMPORARILY DISABLED FOR ISOMETRIC DEVELOPMENT
   * @param {number} deltaY - Mouse wheel delta (positive = zoom out, negative = zoom in)
   */
  /*
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
  */
  
  /**
   * Handle player input (triggers game logic)
   * @param {string} key - Key that was pressed
   */
  handleInput(key) {
    logger.debug('Key pressed:', key);
    
    // Check for view mode toggle
    if (key.toLowerCase() === DATA.VIEW.TOGGLE_KEY) {
      this.cameraController.toggleViewMode();
      this.render();
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
   * Render the game (only called when state changes)
   */
  render() {
    // Clear previous frame
    this.graphics.clear();
    
    // Get current view mode from camera controller
    const viewMode = this.cameraController.getViewMode();
    
    // Canvas handles rendering of background, grid, and all layers
    this.canvas.render(this.graphics, viewMode);
  }
  
  /**
   * Update stats panel with current player stats
   */
  updateStatsPanel() {
    // Base stats
    document.getElementById('stat-strength').textContent = this.player.strength;
    document.getElementById('stat-dexterity').textContent = this.player.dexterity;
    document.getElementById('stat-intelligence').textContent = this.player.intelligence;
    
    // Combat stats
    document.getElementById('stat-health').textContent = this.player.health;
    document.getElementById('stat-defense').textContent = this.player.defense;
    document.getElementById('stat-initiative').textContent = this.player.initiative;
    
    // Other stats
    document.getElementById('stat-capacity').textContent = this.player.capacity;
    document.getElementById('stat-movement').textContent = this.player.movement;
    document.getElementById('stat-skill').textContent = this.player.skill;
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