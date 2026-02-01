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
import { isoToCartesian } from '../utils/projection.js';

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
    
    // Create player at grid position (20, 20) - centered to avoid debug panel
    const grid = this.canvas.layers.grid;
    const playerCol = 20;
    const playerRow = 20;
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
    
    // Set initial player screen position for current view mode
    this.player.updateScreenPosition(this.cameraController.getViewMode());
    
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
      playerRow: this.player.row,
      zoom: this.cameras.main.zoom
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
    
    // Track hovered tile for highlighting
    this.hoveredTile = null;
    
    // Track mouse position for debug and hover highlighting
    this.input.on('pointermove', (pointer) => {
      const viewMode = this.cameraController.getViewMode();
      
      // Convert pointer to world coordinates (accounts for zoom and scroll)
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const worldX = worldPoint.x;
      const worldY = worldPoint.y;
      
      let col, row;
      
      if (viewMode === 'ISOMETRIC') {
        // Convert isometric world coordinates back to grid coordinates
        const isoTileWidth = 64;
        const offsetX = 400;
        const offsetY = 100;
        
        // Remove offset to get relative position
        const relativeX = worldX - offsetX;
        const relativeY = worldY - offsetY;
        
        // Convert back to cartesian grid coordinates
        const gridPos = isoToCartesian(relativeX, relativeY, isoTileWidth);
        
        col = Math.floor(gridPos.x);
        row = Math.floor(gridPos.y);
      } else {
        // 2D mode - simple division using world coordinates
        col = Math.floor(worldX / DATA.GRID.SIZE);
        row = Math.floor(worldY / DATA.GRID.SIZE);
      }
      
      // Update hovered tile if within movement range
      const movementRange = this.player.getMovementRange();
      const isInRange = movementRange.some(t => t.col === col && t.row === row);
      
      if (isInRange) {
        this.hoveredTile = { col, row };
        logger.debug(`Setting hoveredTile to (${col}, ${row}) in ${viewMode} mode`);
      } else {
        if (this.hoveredTile) {
          logger.debug(`Clearing hoveredTile (was at ${this.hoveredTile.col}, ${this.hoveredTile.row})`);
        }
        this.hoveredTile = null;
      }
      
      updateDebugPanel({
        x: Math.floor(pointer.x),
        y: Math.floor(pointer.y),
        col: col,
        row: row,
        playerCol: this.player.col,
        playerRow: this.player.row,
        zoom: this.cameras.main.zoom
      });
      
      // Re-render to show hover highlight
      this.render();
    });
    
    // Click to move
    this.input.on('pointerdown', (pointer) => {
      if (this.hoveredTile) {
        this.movePlayerToTile(this.hoveredTile.col, this.hoveredTile.row);
      }
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
    const currentZoom = this.cameras.main.zoom;
    let targetZoom = currentZoom;
    
    if (deltaY < 0) {
      // Scroll up - zoom in
      targetZoom += DATA.CAMERA.ZOOM_SPEED;
    } else if (deltaY > 0) {
      // Scroll down - zoom out
      targetZoom -= DATA.CAMERA.ZOOM_SPEED;
    }
    
    // Clamp to limits
    targetZoom = Math.max(this.cameraController.minZoom, Math.min(this.cameraController.maxZoom, targetZoom));
    
    // Apply smooth zoom
    this.cameras.main.zoomTo(targetZoom, DATA.CAMERA.ZOOM_SMOOTH_DURATION);
    
    // Update debug panel with new zoom
    updateDebugPanel({
      zoom: targetZoom
    });
    
    logger.debug(`Zoom: ${currentZoom.toFixed(2)} → ${targetZoom.toFixed(2)}`);
  }
  
  /**
   * Handle player input (triggers game logic)
   * @param {string} key - Key that was pressed
   */
  handleInput(key) {
    logger.debug('Key pressed:', key);
    
    // Check for view mode toggle
    if (key.toLowerCase() === DATA.VIEW.TOGGLE_KEY) {
      this.cameraController.toggleViewMode();
      
      // Update all token screen positions for new view mode
      const viewMode = this.cameraController.getViewMode();
      for (const token of this.canvas.layers.tokens) {
        token.updateScreenPosition(viewMode);
      }
      
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
      logger.debug(`Player moved to grid (${this.player.col}, ${this.player.row})`);
      
      // Update player screen position for camera following
      const viewMode = this.cameraController.getViewMode();
      this.player.updateScreenPosition(viewMode);
      
      // Update debug panel with new player position
      updateDebugPanel({
        playerCol: this.player.col,
        playerRow: this.player.row,
        zoom: this.cameras.main.zoom
      });
      
      this.render();
    }
  }
  
  /**
   * Move player to target tile with pathfinding and animation
   * @param {number} targetCol - Target column
   * @param {number} targetRow - Target row
   */
  async movePlayerToTile(targetCol, targetRow) {
    // Calculate path (simple Manhattan pathfinding)
    const path = this.findPath(this.player.col, this.player.row, targetCol, targetRow);
    
    if (path.length === 0) {
      logger.debug('No path found to target');
      return;
    }
    
    // Move along path one step at a time
    for (const step of path) {
      // Determine direction
      const dCol = step.col - this.player.col;
      const dRow = step.row - this.player.row;
      
      let direction;
      if (dRow < 0) direction = 'up';
      else if (dRow > 0) direction = 'down';
      else if (dCol < 0) direction = 'left';
      else if (dCol > 0) direction = 'right';
      
      // Move player
      const moved = this.player.move(direction);
      
      if (!moved) {
        logger.debug('Movement blocked');
        break;
      }
      
      // Update screen position for camera following
      const viewMode = this.cameraController.getViewMode();
      this.player.updateScreenPosition(viewMode);
      
      // Update debug panel
      updateDebugPanel({
        playerCol: this.player.col,
        playerRow: this.player.row
      });
      
      // Render
      this.render();
      
      // Wait before next step
      await new Promise(resolve => setTimeout(resolve, DATA.MOVEMENT.STEP_DELAY));
    }
  }
  
  /**
   * Find path from start to end (simple Manhattan distance pathfinding)
   * @param {number} startCol - Start column
   * @param {number} startRow - Start row
   * @param {number} endCol - End column
   * @param {number} endRow - End row
   * @returns {Array} Path as array of {col, row} steps
   */
  findPath(startCol, startRow, endCol, endRow) {
    const path = [];
    let currentCol = startCol;
    let currentRow = startRow;
    
    // Simple greedy pathfinding - move one axis at a time
    while (currentCol !== endCol || currentRow !== endRow) {
      // Move vertically first
      if (currentRow < endRow) {
        currentRow++;
      } else if (currentRow > endRow) {
        currentRow--;
      }
      // Then horizontally
      else if (currentCol < endCol) {
        currentCol++;
      } else if (currentCol > endCol) {
        currentCol--;
      }
      
      path.push({ col: currentCol, row: currentRow });
    }
    
    return path;
  }
  
  /**
   * Render the game (only called when state changes)
   */
  render() {
    // Clear previous frame
    this.graphics.clear();
    
    // Get current view mode from camera controller
    const viewMode = this.cameraController.getViewMode();
    
    // Get player movement range for highlighting
    const movementRange = this.player.getMovementRange();
    
    // Mark the hovered tile if it exists (don't duplicate, just mark it)
    const highlights = movementRange.map(tile => {
      if (this.hoveredTile && tile.col === this.hoveredTile.col && tile.row === this.hoveredTile.row) {
        logger.debug(`Marking tile (${tile.col}, ${tile.row}) as hovered in ${viewMode} mode`);
        return { ...tile, isHovered: true };
      }
      return tile;
    });
    
    // Canvas handles rendering of background, grid, and all layers
    this.canvas.render(this.graphics, viewMode, highlights);
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