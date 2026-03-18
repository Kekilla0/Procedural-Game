/**
 * wall.js - Wall class for edges between grid tiles
 *
 * Walls live on the EDGES between tiles, not on tiles themselves.
 * Each wall has a `side` ('north' or 'west') that identifies which
 * edge of the anchor cell (col, row) it sits on:
 *
 *   'north' wall at (col, row) → boundary between (col,row-1) and (col,row)
 *   'west'  wall at (col, row) → boundary between (col-1,row) and (col,row)
 *
 * place() accepts any of the 4 cardinal sides and normalizes internally.
 *
 * Wall states:
 *   0 SOLID     - visible, impassable   (normal wall)
 *   1 INVISIBLE - invisible, impassable (force field / barrier)
 *   2 HIDDEN    - visible, passable     (secret passage)
 *   3 OPEN      - invisible, passable   (open doorway)
 *
 * Extends Interactable → Entity → Renderable.
 */

import { Interactable } from './interactable.js';

/**
 * Darken a Phaser integer color by a multiplier (0–1).
 * @param {number} colorInt - Integer color (e.g. 0x888888)
 * @param {number} factor   - 1.0 = unchanged, 0.0 = black
 * @returns {number}
 */
function _darkenColor(colorInt, factor) {
  const r = Math.floor(((colorInt >> 16) & 0xFF) * factor);
  const g = Math.floor(((colorInt >> 8)  & 0xFF) * factor);
  const b = Math.floor( (colorInt        & 0xFF) * factor);
  return (r << 16) | (g << 8) | b;
}
import { logger } from '../utils/logger.js';

import { DATA } from '../data/constants.js';

export class Wall extends Interactable {
  /**
   * @param {number} x - Pixel x of anchor cell top-left
   * @param {number} y - Pixel y of anchor cell top-left
   * @param {number} width - Tile size (pixels)
   * @param {number} height - Tile size (pixels)
   * @param {Object} options
   * @param {Grid}   options.grid   - Grid instance (required)
   * @param {number} options.col    - Anchor column (normalized)
   * @param {number} options.row    - Anchor row (normalized)
   * @param {string} options.side   - 'north' or 'west' (normalized)
   * @param {string} [options.color]
   * @param {number} [options.state=0]
   */
  constructor(x, y, width, height, options = {}) {
    super(x, y, width, height, {
      grid: options.grid,
      col: options.col,
      row: options.row,
      passable: true,          // setState() sets the real value
      color: options.color || DATA.WALL.COLOR
    });

    this.side = options.side; // 'north' or 'west'

    this.state = -1;          // force first setState to apply
    this.setState(options.state !== undefined ? options.state : DATA.WALL.STATES.SOLID);

    logger.debug('Wall created:', { col: this.col, row: this.row, side: this.side, state: this.state });
  }

  /**
   * Set state and update passability.
   * @param {number} state
   */
  setState(state) {
    if (this.state === state) return;
    this.state = state;
    const S = DATA.WALL.STATES;
    this.passable = (state === S.HIDDEN || state === S.OPEN);
    logger.debug(`Wall (${this.col},${this.row}) ${this.side} → state ${state} passable=${this.passable}`);
  }

  /**
   * Place a wall on a grid edge.
   * Normalizes 'south' → north of row+1, 'east' → west of col+1.
   * @param {Canvas} canvas
   * @param {number} col
   * @param {number} row
   * @param {string} side  - 'north' | 'south' | 'east' | 'west'
   * @param {Object} [options]
   * @returns {Wall|null}
   */
  static place(canvas, col, row, side, options = {}) {
    const grid = canvas.layers.grid;
    const tileSize = grid.size;

    // Normalize to 'north' or 'west'
    let nCol = col, nRow = row, nSide = side;
    if (side === 'south') { nRow = row + 1; nSide = 'north'; }
    if (side === 'east')  { nCol = col + 1; nSide = 'west'; }

    // Bounds: north wall needs row in [0..rows], west wall needs col in [0..cols]
    if (nSide === 'north' && (nCol < 0 || nCol >= grid.columns || nRow < 0 || nRow > grid.rows)) {
      logger.error(`Wall (north) placement out of bounds: (${nCol}, ${nRow})`);
      return null;
    }
    if (nSide === 'west'  && (nCol < 0 || nCol > grid.columns || nRow < 0 || nRow >= grid.rows)) {
      logger.error(`Wall (west) placement out of bounds: (${nCol}, ${nRow})`);
      return null;
    }

    const existing = canvas.layers.walls.some(w => w.col === nCol && w.row === nRow && w.side === nSide);
    if (existing) {
      logger.warn(`Wall already exists at (${nCol}, ${nRow}) ${nSide}`);
      return null;
    }

    const wall = new Wall(nCol * tileSize, nRow * tileSize, tileSize, tileSize, {
      grid,
      col: nCol,
      row: nRow,
      side: nSide,
      color: options.color,
      state: options.state
    });

    canvas.layers.walls.push(wall);
    logger.info(`Placed ${wall.constructor.name} at (${nCol},${nRow}) ${nSide} state=${wall.state}`);
    return wall;
  }

  /**
   * Check if a token is within `range` squares of this wall edge.
   * Overrides Interactable.isWithin() with edge-based semantics.
   *
   * A wall edge touches exactly two tiles (its "roots"):
   *   'north' at (col, row) → roots: (col, row) and (col, row-1)
   *   'west'  at (col, row) → roots: (col, row) and (col-1, row)
   *
   * Distance to this wall = min Manhattan distance to either root + 1.
   * (+1 because even occupying a root tile puts you 1 "step" from the edge itself.)
   *
   *   range=1 → player must be in one of the two root tiles (directly adjacent)
   *   range=2 → player within 1 extra step of either root
   *
   * @param {number} playerCol
   * @param {number} playerRow
   * @param {number} [range=1]
   * @returns {boolean}
   */
  isWithin(playerCol, playerRow, range = 1) {
    const root1 = { col: this.col, row: this.row };
    const root2 = this.side === 'north'
      ? { col: this.col,     row: this.row - 1 }
      : { col: this.col - 1, row: this.row     };

    const dist1 = Math.abs(playerCol - root1.col) + Math.abs(playerRow - root1.row);
    const dist2 = Math.abs(playerCol - root2.col) + Math.abs(playerRow - root2.row);
    return (Math.min(dist1, dist2) + 1) <= range;
  }

  /**
   * Check if a 2D world point is close to this wall's edge.
   * Used for right-click interaction detection.
   * @param {number} worldX
   * @param {number} worldY
   * @param {number} [threshold=5]
   * @returns {boolean}
   */
  isNearPoint(worldX, worldY, threshold = 5) {
    const s = this.grid.size;
    if (this.side === 'north') {
      const edgeY = this.row * s;
      return Math.abs(worldY - edgeY) <= threshold
          && worldX >= this.col * s
          && worldX <= (this.col + 1) * s;
    } else { // 'west'
      const edgeX = this.col * s;
      return Math.abs(worldX - edgeX) <= threshold
          && worldY >= this.row * s
          && worldY <= (this.row + 1) * s;
    }
  }

  /**
   * Distance from a visual ISO grid point to this wall's base edge (perpendicular distance).
   * Used to pick the closest wall when multiple face areas overlap.
   * @param {number} visGridX
   * @param {number} visGridY
   * @param {number} rotation
   * @returns {number}
   */
  gridEdgeDist(visGridX, visGridY, rotation) {
    let p1, p2;
    if (this.side === 'north') {
      p1 = { col: this.col,     row: this.row };
      p2 = { col: this.col + 1, row: this.row };
    } else {
      p1 = { col: this.col, row: this.row     };
      p2 = { col: this.col, row: this.row + 1 };
    }
    const rp1 = Wall.rotateCorner(p1.col, p1.row, rotation, this.grid.columns, this.grid.rows);
    const rp2 = Wall.rotateCorner(p2.col, p2.row, rotation, this.grid.columns, this.grid.rows);

    // Distance to nearest point on the segment (clamped)
    if (rp1.row === rp2.row) {
      const clampedX = Math.max(Math.min(rp1.col, rp2.col), Math.min(visGridX, Math.max(rp1.col, rp2.col)));
      return Math.sqrt((visGridX - clampedX) ** 2 + (visGridY - rp1.row) ** 2);
    } else {
      const clampedY = Math.max(Math.min(rp1.row, rp2.row), Math.min(visGridY, Math.max(rp1.row, rp2.row)));
      return Math.sqrt((visGridX - rp1.col) ** 2 + (visGridY - clampedY) ** 2);
    }
  }

  /**
   * Check if a visual ISO grid position (from isoToCartesian) is near this wall's edge.
   * Used for right-click detection in ISOMETRIC mode.
   * @param {number} visGridX - Visual grid X (isoToCartesian result, offset already removed)
   * @param {number} visGridY - Visual grid Y
   * @param {number} rotation - Current map rotation
   * @param {number} [threshold=0.25] - Max distance in tile units
   * @returns {boolean}
   */
  isNearGridEdge(visGridX, visGridY, rotation) {
    const dg = DATA.WALL.HEIGHT; // 1.5 tiles — rising up-left shifts both axes by -dg

    let p1, p2;
    if (this.side === 'north') {
      p1 = { col: this.col,     row: this.row };
      p2 = { col: this.col + 1, row: this.row };
    } else {
      p1 = { col: this.col, row: this.row     };
      p2 = { col: this.col, row: this.row + 1 };
    }

    const rp1 = Wall.rotateCorner(p1.col, p1.row, rotation, this.grid.columns, this.grid.rows);
    const rp2 = Wall.rotateCorner(p2.col, p2.row, rotation, this.grid.columns, this.grid.rows);

    if (rp1.row === rp2.row) {
      // Horizontal base edge: parallelogram bounded by base row R, top row R-dg,
      // left/right edges slanting at slope 1 (x shifts with y by the same amount)
      const minCol = Math.min(rp1.col, rp2.col);
      const maxCol = Math.max(rp1.col, rp2.col);
      const R = rp1.row;
      const offset = visGridY - R; // negative inside face
      return visGridY >= R - dg && visGridY <= R
          && visGridX >= minCol + offset && visGridX <= maxCol + offset;
    } else {
      // Vertical base edge: parallelogram bounded by base col C, left col C-dg,
      // top/bottom edges slanting at slope 1
      const minRow = Math.min(rp1.row, rp2.row);
      const maxRow = Math.max(rp1.row, rp2.row);
      const C = rp1.col;
      const offset = visGridX - C; // negative inside face
      return visGridX >= C - dg && visGridX <= C
          && visGridY >= minRow + offset && visGridY <= maxRow + offset;
    }
  }

  /**
   * Render the wall edge.
   * @param {Phaser.GameObjects.Graphics} graphics
   * @param {string} viewMode
   * @param {number} rotation
   */
  render(graphics, rotation = 0, alphaOverride = 1) {
    const S = DATA.WALL.STATES;
    if (this.state === S.OPEN) return;

    if (this.state === S.INVISIBLE) {
      if (!DATA.DEBUG) return;
      this._renderEdge(graphics, rotation, 0xFF00FF, 0.4 * alphaOverride, 1);
      return;
    }

    const colorNumber = parseInt(this.color.replace('#', '0x'));
    this._renderEdge(graphics, rotation, colorNumber, alphaOverride, 4);
  }

  /**
   * Draw the wall as a line along its edge.
   * Uses rotateCorner to find the correct visual endpoints in ISO mode.
   * @param {Phaser.GameObjects.Graphics} graphics
   * @param {string} viewMode
   * @param {number} rotation
   * @param {number} colorNumber - Phaser color int
   * @param {number} alpha
   * @param {number} thickness - line width in pixels
   */
  _renderEdge(graphics, rotation, colorNumber, alpha, thickness) {
    const isoTileWidth = 64;
    const offsetX = 400;
    const offsetY = 100;
    const cols = this.grid.columns;
    const rows = this.grid.rows;

    let p1, p2;
    if (this.side === 'north') {
      p1 = { col: this.col,     row: this.row };
      p2 = { col: this.col + 1, row: this.row };
    } else {
      p1 = { col: this.col, row: this.row     };
      p2 = { col: this.col, row: this.row + 1 };
    }

    const rp1 = Wall.rotateCorner(p1.col, p1.row, rotation, cols, rows);
    const rp2 = Wall.rotateCorner(p2.col, p2.row, rotation, cols, rows);

    const ip1 = Wall.cartesianToIso(rp1.col, rp1.row, isoTileWidth);
    const ip2 = Wall.cartesianToIso(rp2.col, rp2.row, isoTileWidth);

    const x1 = ip1.screenX + offsetX;
    const y1 = ip1.screenY + offsetY;
    const x2 = ip2.screenX + offsetX;
    const y2 = ip2.screenY + offsetY;

    const wallHeightPx = DATA.WALL.HEIGHT * (isoTileWidth / 2);

    // Front face
    graphics.fillStyle(_darkenColor(colorNumber, 0.65), alpha);
    graphics.beginPath();
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.lineTo(x2, y2 - wallHeightPx);
    graphics.lineTo(x1, y1 - wallHeightPx);
    graphics.closePath();
    graphics.fillPath();

    // Top edge
    graphics.lineStyle(2, colorNumber, alpha);
    graphics.beginPath();
    graphics.moveTo(x1, y1 - wallHeightPx);
    graphics.lineTo(x2, y2 - wallHeightPx);
    graphics.strokePath();

    // Base edge
    graphics.lineStyle(1, _darkenColor(colorNumber, 0.4), alpha);
    graphics.beginPath();
    graphics.moveTo(x1, y1);
    graphics.lineTo(x2, y2);
    graphics.strokePath();
  }
}
