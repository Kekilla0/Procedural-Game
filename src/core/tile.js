/**
 * tile.js - Ground tile for the game grid
 *
 * Each tile occupies one grid cell and is rendered as:
 *   2D mode    — filled square with pixel-art color variation
 *   ISOMETRIC  — filled diamond matching the grid projection
 *
 * Tile types and their palettes are defined in TILE_PALETTE below.
 * Pixel variation is deterministic (based on col/row) so tiles look
 * consistent every frame without storing extra state.
 */

import { Renderable } from './renderable.js';


// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------

const TILE_PALETTE = {
  grass: {
    base:      0x5a8c50,
    variation: [0x3d6e42, 0x4e7a44, 0x6ea05e, 0x72ad62, 0x3a6030]
  },
  sand: {
    base:      0xcfb26a,
    variation: [0xb89450, 0xc4a85e, 0xddc07c, 0xe8d090, 0xa87e40]
  },
  stone: {
    base:      0x888888,
    variation: [0x666666, 0x777777, 0x999999, 0xaaaaaa, 0x5e5e5e]
  }
};

// ---------------------------------------------------------------------------
// Deterministic hash (no Math.random — same result every render)
// ---------------------------------------------------------------------------

function _hash(n) {
  n = ((n >>> 16) ^ n) * 0x45d9f3b;
  n = ((n >>> 16) ^ n) * 0x45d9f3b;
  return ((n >>> 16) ^ n) >>> 0;
}

// ---------------------------------------------------------------------------
// Tile class
// ---------------------------------------------------------------------------

export class Tile extends Renderable {
  /**
   * @param {number} x      - Pixel X (col * grid.size)
   * @param {number} y      - Pixel Y (row * grid.size)
   * @param {number} width  - Pixel width  (grid.size)
   * @param {number} height - Pixel height (grid.size)
   * @param {Object} options
   * @param {object} [options.grid]
   * @param {number} [options.col]
   * @param {number} [options.row]
   * @param {string} [options.type='grass']  - 'grass' | 'sand' | 'stone'
   */
  constructor(x, y, width, height, options = {}) {
    super(x, y, width, height);
    this.type = options.type || 'grass';
    const grid = options.grid || null;
    if (options.col !== undefined && options.row !== undefined) {
      this.col = options.col;
      this.row = options.row;
    } else if (grid) {
      this.col = Math.floor(x / grid.size);
      this.row = Math.floor(y / grid.size);
    } else {
      this.col = 0;
      this.row = 0;
    }
  }

  /**
   * @param {Phaser.GameObjects.Graphics} graphics
   * @param {string} viewMode
   * @param {number} rotation
   * @param {Grid}   grid
   */
  render(graphics, viewMode, rotation, grid) {
    if (viewMode === 'ISOMETRIC') {
      this._renderIso(graphics, rotation, grid);
    } else {
      this._render2D(graphics, grid);
    }
  }

  // -------------------------------------------------------------------------

  _render2D(graphics, grid) {
    const s      = grid.size;
    const px     = this.col * s;
    const py     = this.row * s;
    const pal    = TILE_PALETTE[this.type] || TILE_PALETTE.grass;
    const seed   = _hash(this.col * 73856093 ^ this.row * 19349663);

    // Base fill
    graphics.fillStyle(pal.base, 1);
    graphics.fillRect(px, py, s, s);

    // Pixel-art variation — 8 deterministic pixels per tile
    const count = 8;
    for (let i = 0; i < count; i++) {
      const h     = _hash(seed + i * 2654435761);
      const dx    = h % s;
      const dy    = _hash(h + 1) % s;
      const color = pal.variation[h % pal.variation.length];
      graphics.fillStyle(color, 1);
      graphics.fillRect(px + dx, py + dy, 1, 1);
    }
  }

  _renderIso(graphics, rotation, grid) {
    const isoTileWidth = 64;
    const offsetX = 400;
    const offsetY = 100;

    // Mirror grid.js: rotate tile center coords, then project all 4 corners
    const { col: vc, row: vr } = Tile.rotateCoordinates(
      this.col, this.row, rotation, grid.columns - 1, grid.rows - 1
    );

    const tl = Tile.cartesianToIso(vc,     vr,     isoTileWidth);
    const tr = Tile.cartesianToIso(vc + 1, vr,     isoTileWidth);
    const br = Tile.cartesianToIso(vc + 1, vr + 1, isoTileWidth);
    const bl = Tile.cartesianToIso(vc,     vr + 1, isoTileWidth);

    const pal = TILE_PALETTE[this.type] || TILE_PALETTE.grass;

    graphics.fillStyle(pal.base, 1);
    graphics.beginPath();
    graphics.moveTo(tl.screenX + offsetX, tl.screenY + offsetY);
    graphics.lineTo(tr.screenX + offsetX, tr.screenY + offsetY);
    graphics.lineTo(br.screenX + offsetX, br.screenY + offsetY);
    graphics.lineTo(bl.screenX + offsetX, bl.screenY + offsetY);
    graphics.closePath();
    graphics.fillPath();
  }
}
