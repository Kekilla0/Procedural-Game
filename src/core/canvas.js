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
   * @param {object} options - Various options for data imported to constructor.
   */
  constructor(width, height, options = {}) {
    // Canvas always starts at origin (0, 0)
    super(0, 0, width, height);
    
    // Background appearance
    this.img = options.img || null; 
    this.color = options.color || DATA.CANVAS.COLOR; 

    this.viewMode = 'ISOMETRIC';
    this.rotation = 0;
    
    // Layer data storage — named for direct access (layers.tokens, etc.)
    // Rendered in the order defined by layerOrder (index 0 = bottom, drawn first).
    this.layers = {
      tiles:      [],           // 0 — ground tiles
      grid:       null,         // 1 — grid lines + highlights
      walls:      [],           // 2 — walls and doors (depth-sorted per-wall in ISO)
      tokens:     [],           // 3 — player and enemies
      containers: []            // 4 — lootable containers (chests, barrels, etc.)
    };
    this.layerOrder = ['tiles', 'grid', 'walls', 'tokens', 'containers'];

    this.layers.grid = new Grid(width, height);

    // When true, game.js renders walls externally (per-wall Graphics for correct z-depth)
    this.externalWallRenderer = false;

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
    this._renderBackground(graphics);
    this._renderLayers(graphics, movementRange);
  }

  _renderBackground(graphics) {
    const colorNumber = parseInt(this.color.replace('#', '0x'));
    graphics.fillStyle(0x000000);
    graphics.fillRect(0, 0, 2000, 2000);
    graphics.fillStyle(colorNumber);
    const grid = this.layers.grid;
    const diamondCols = (this.rotation === 90 || this.rotation === 270) ? grid.rows : grid.columns;
    const diamondRows = (this.rotation === 90 || this.rotation === 270) ? grid.columns : grid.rows;
    const pts = Canvas.rectToIsoDiamond(0, 0, diamondCols, diamondRows, 64);
    const offsetX = 400, offsetY = 100;
    graphics.beginPath();
    graphics.moveTo(pts[0].screenX + offsetX, pts[0].screenY + offsetY);
    graphics.lineTo(pts[1].screenX + offsetX, pts[1].screenY + offsetY);
    graphics.lineTo(pts[2].screenX + offsetX, pts[2].screenY + offsetY);
    graphics.lineTo(pts[3].screenX + offsetX, pts[3].screenY + offsetY);
    graphics.closePath();
    graphics.fillPath();
  }

  _renderLayers(graphics, movementRange) {
    const { rotation } = this;
    const grid = this.layers.grid;

    for (const layerName of this.layerOrder) {
      const layer = this.layers[layerName];
      if (!layer) continue;

      if (layerName === 'grid') {
        layer.render(graphics, movementRange, rotation);
        continue;
      }

      // Walls and tokens are depth-sorted together in ISO
      if (layerName === 'walls' || layerName === 'tokens') continue;

      for (const item of layer) {
        item.render(graphics, 'ISOMETRIC', rotation, grid);
      }
    }

    this._renderDepthSorted(graphics, rotation);
  }

  /**
   * Depth-sort walls and tokens together back-to-front (painter's algorithm).
   * Only used in ISOMETRIC mode.
   */
  _renderDepthSorted(graphics, rotation) {
    const grid = this.layers.grid;
    const maxCol = grid.columns - 1;
    const maxRow = grid.rows - 1;

    const renderables = [];

    if (!this.externalWallRenderer) {
      for (const wall of this.layers.walls) {
        const r1 = Canvas.rotateCoordinates(wall.col, wall.row, rotation, maxCol, maxRow);
        const r2col = wall.side === 'north' ? wall.col            : Math.max(0, wall.col - 1);
        const r2row = wall.side === 'north' ? Math.max(0, wall.row - 1) : wall.row;
        const r2 = Canvas.rotateCoordinates(r2col, r2row, rotation, maxCol, maxRow);
        renderables.push({ obj: wall, depth: Math.max(r1.col + r1.row, r2.col + r2.row) });
      }
    }

    for (const token of this.layers.tokens) {
      const r = Canvas.rotateCoordinates(token.col, token.row, rotation, maxCol, maxRow);
      renderables.push({ obj: token, depth: r.col + r.row + 0.5 });
    }

    renderables.sort((a, b) => a.depth - b.depth);

    for (const { obj } of renderables) {
      obj.render(graphics, 'ISOMETRIC', rotation, grid);
    }
  }

  /**
   * Rotate all objects on the canvas
   * @param {number} rotation - New rotation value (0, 90, 180, 270)
   */
  rotate(rotation) {
    this.rotation = rotation % 360;

    for (const layerName of this.layerOrder) {
      const layer = this.layers[layerName];
      if (!layer) continue;
      const items = Array.isArray(layer) ? layer : [layer];
      for (const item of items) {
        if (item.rotate) item.rotate(this.rotation, this.viewMode);
      }
    }
  }
  
  /**
   * Return the painter's-algorithm sort depth for a wall at a given rotation.
   * Matches the formula used in renderSorted().
   * @param {Wall} wall
   * @param {number} rotation - Current map rotation (0/90/180/270)
   * @returns {number}
   */
  getWallSortDepth(wall, rotation) {
    const grid   = this.layers.grid;
    const maxCol = grid.columns - 1;
    const maxRow = grid.rows - 1;
    const r1    = Canvas.rotateCoordinates(wall.col, wall.row, rotation, maxCol, maxRow);
    const r2col = wall.side === 'north' ? wall.col            : Math.max(0, wall.col - 1);
    const r2row = wall.side === 'north' ? Math.max(0, wall.row - 1) : wall.row;
    const r2    = Canvas.rotateCoordinates(r2col, r2row, rotation, maxCol, maxRow);
    return Math.max(r1.col + r1.row, r2.col + r2.row);
  }

  /**
   * Find the interactable wall/door closest to a world point.
   * In 2D mode uses pixel proximity; in ISOMETRIC mode converts to grid space first.
   * @param {number} worldX - World x (pixels in 2D, ISO rendering space in ISO mode)
   * @param {number} worldY - World y
   * @param {string} [viewMode='2D'] - Current view mode
   * @param {number} [rotation=0] - Current map rotation
   * @param {number} [threshold=6] - Max distance (pixels in 2D, tile units * 100 in ISO)
   * @returns {Interactable|null}
   */
  getInteractableAt(worldX, worldY, rotation = 0) {
    const isoTileWidth = 64;
    const offsetX = 400;
    const offsetY = 100;
    const { x: visGridX, y: visGridY } = Canvas.isoToCartesian(
      worldX - offsetX,
      worldY - offsetY,
      isoTileWidth
    );
    const grid = this.layers.grid;
    const maxCol = grid.columns - 1;
    const maxRow = grid.rows - 1;
    const clickCol = Math.floor(visGridX);
    const clickRow = Math.floor(visGridY);

    // Tokens take priority
    for (const token of this.layers.tokens) {
      if (!token.getContextMenuItems) continue;
      const rt = Canvas.rotateCoordinates(token.col, token.row, rotation, maxCol, maxRow);
      if (rt.col === clickCol && rt.row === clickRow) return token;
    }

    // Containers (chests)
    for (const container of this.layers.containers) {
      const rt = Canvas.rotateCoordinates(container.col, container.row, rotation, maxCol, maxRow);
      if (rt.col === clickCol && rt.row === clickRow) return container;
    }

    // Walls/doors
    let best = null;
    let bestDepth = -Infinity;
    for (const wall of this.layers.walls) {
      if (wall.isNearGridEdge && wall.isNearGridEdge(visGridX, visGridY, rotation)) {
        const r1 = Canvas.rotateCoordinates(wall.col, wall.row, rotation, maxCol, maxRow);
        const r2col = wall.side === 'north' ? wall.col            : Math.max(0, wall.col - 1);
        const r2row = wall.side === 'north' ? Math.max(0, wall.row - 1) : wall.row;
        const r2 = Canvas.rotateCoordinates(r2col, r2row, rotation, maxCol, maxRow);
        const depth = Math.max(r1.col + r1.row, r2.col + r2.row);
        if (depth > bestDepth) { bestDepth = depth; best = wall; }
      }
    }
    return best;
  }

  /**
   * Check whether a token can move to the given grid cell.
   * Checks bounds, solid walls on the crossed edge, and token occupancy.
   * @param {Token} token - The token attempting to move
   * @param {number} targetCol - Target column
   * @param {number} targetRow - Target row
   * @returns {boolean} True if movement is allowed
   */
  canMoveTo(token, targetCol, targetRow) {
    const grid = this.layers.grid;

    // Bounds check
    if (targetCol < 0 || targetCol >= grid.columns || targetRow < 0 || targetRow >= grid.rows) {
      return false;
    }

    // Wall check — only the edge being crossed, based on delta
    const dCol = targetCol - token.col;
    const dRow = targetRow - token.row;
    for (const wall of this.layers.walls) {
      if (wall.passable) continue;
      let blocked = false;
      if      (dRow === -1) blocked = wall.side === 'north' && wall.col === token.col   && wall.row === token.row;
      else if (dRow ===  1) blocked = wall.side === 'north' && wall.col === token.col   && wall.row === targetRow;
      else if (dCol === -1) blocked = wall.side === 'west'  && wall.col === token.col   && wall.row === token.row;
      else if (dCol ===  1) blocked = wall.side === 'west'  && wall.col === targetCol   && wall.row === token.row;
      if (blocked) return false;
    }

    // Token occupancy check
    for (const other of this.layers.tokens) {
      if (other === token) continue;
      if (other.col === targetCol && other.row === targetRow) return false;
    }

    return true;
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