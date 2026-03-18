/**
 * door.js - Door class for interactive openings
 *
 * A door is a wall edge that can be opened/closed by interact().
 * Closed = state SOLID (visible, impassable)
 * Open   = state OPEN  (invisible, passable)
 *
 * Extends Wall → Interactable → Entity → Renderable.
 */

import { Wall } from './wall.js';
import { logger } from '../utils/logger.js';
import { DATA } from '../data/constants.js';

export class Door extends Wall {
  /**
   * @param {number} x - Pixel x of anchor cell top-left
   * @param {number} y - Pixel y of anchor cell top-left
   * @param {number} width
   * @param {number} height
   * @param {Object} options
   * @param {Grid}   options.grid
   * @param {number} options.col
   * @param {number} options.row
   * @param {string} options.side - 'north' or 'west' (normalized)
   * @param {string} [options.color]
   * @param {number} [options.state=0]
   */
  constructor(x, y, width, height, options = {}) {
    super(x, y, width, height, {
      grid: options.grid,
      col: options.col,
      row: options.row,
      side: options.side,
      color: options.color || DATA.DOOR.COLOR,
      state: options.state !== undefined ? options.state : DATA.WALL.STATES.SOLID
    });

    logger.debug('Door created:', { col: this.col, row: this.row, side: this.side });
  }

  /**
   * Returns context menu items for this door.
   * Open/Close is disabled if the player is not within range 1.
   * @param {Token} player
   * @returns {Array<{label: string, disabled?: boolean, action: Function}>}
   */
  getContextMenuItems(player) {
    const inRange = this.isWithin(player.col, player.row, 1);
    const isOpen = this.state === DATA.WALL.STATES.OPEN;
    return [
      {
        label: isOpen ? 'Close Door' : 'Open Door',
        disabled: !inRange,
        action: () => { this.interact(player); }
      },
      ...super.getContextMenuItems(player)
    ];
  }

  /**
   * Toggle between closed (SOLID) and open (OPEN).
   * @param {Token} token - The token interacting with this door
   */
  interact(token) {
    const S = DATA.WALL.STATES;
    if (this.state === S.SOLID) {
      this.setState(S.OPEN);
      logger.info(`${token.name} opened door at (${this.col},${this.row}) ${this.side}`);
    } else if (this.state === S.OPEN) {
      this.setState(S.SOLID);
      logger.info(`${token.name} closed door at (${this.col},${this.row}) ${this.side}`);
    }
  }

  /**
   * Place a door on a grid edge (same normalization as Wall.place).
   * @param {Canvas} canvas
   * @param {number} col
   * @param {number} row
   * @param {string} side - 'north' | 'south' | 'east' | 'west'
   * @param {Object} [options]
   * @returns {Door|null}
   */
  static place(canvas, col, row, side, options = {}) {
    const grid = canvas.layers.grid;
    const tileSize = grid.size;

    // Normalize
    let nCol = col, nRow = row, nSide = side;
    if (side === 'south') { nRow = row + 1; nSide = 'north'; }
    if (side === 'east')  { nCol = col + 1; nSide = 'west'; }

    if (nSide === 'north' && (nCol < 0 || nCol >= grid.columns || nRow < 0 || nRow > grid.rows)) {
      logger.error(`Door (north) placement out of bounds: (${nCol}, ${nRow})`);
      return null;
    }
    if (nSide === 'west'  && (nCol < 0 || nCol > grid.columns || nRow < 0 || nRow >= grid.rows)) {
      logger.error(`Door (west) placement out of bounds: (${nCol}, ${nRow})`);
      return null;
    }

    const existing = canvas.layers.walls.some(w => w.col === nCol && w.row === nRow && w.side === nSide);
    if (existing) {
      logger.warn(`Wall/door already exists at (${nCol}, ${nRow}) ${nSide}`);
      return null;
    }

    const door = new Door(nCol * tileSize, nRow * tileSize, tileSize, tileSize, {
      grid,
      col: nCol,
      row: nRow,
      side: nSide,
      color: options.color,
      state: options.state
    });

    canvas.layers.walls.push(door);
    logger.info(`Placed Door at (${nCol},${nRow}) ${nSide} state=${door.state}`);
    return door;
  }
}
