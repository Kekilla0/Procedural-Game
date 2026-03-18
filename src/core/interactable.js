/**
 * interactable.js - Base class for things a player can interact with
 *
 * Interactable represents static grid objects that can be interacted with:
 * - Walls (block movement)
 * - Doors (open/close)
 * - Containers (chests, barrels)
 * - Tiles (floor traps, pressure plates)
 *
 * Provides:
 *   isWithin(playerCol, playerRow, range) - proximity check (Manhattan distance for tile-based)
 *   getContextMenuItems(player)           - base menu items; subclasses extend this
 *   interact(token)                       - override in subclasses
 *
 * Extends Entity → Renderable for consistent class hierarchy.
 */

import { Entity } from './entity.js';
import { logger } from '../utils/logger.js';

export class Interactable extends Entity {
  /**
   * Create a new Interactable
   * @param {number} x - X position in pixels
   * @param {number} y - Y position in pixels
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   * @param {Object} options - Configuration
   * @param {Grid} options.grid - Grid instance (required)
   * @param {number} [options.col] - Grid column position
   * @param {number} [options.row] - Grid row position
   * @param {boolean} [options.passable=true] - Whether tokens can move through this
   * @param {string} [options.color] - Display color (hex string)
   */
  constructor(x, y, width, height, options = {}) {
    super(x, y, width, height, {
      grid: options.grid,
      col: options.col,
      row: options.row,
      passable: options.passable !== undefined ? options.passable : true
    });

    this.color = options.color || '#FFFFFF';
  }

  /**
   * Check if a token is within `range` squares of this interactable.
   * Uses Manhattan distance from the player to this object's (col, row).
   * Edge-based subclasses (Wall) override this for boundary-based semantics.
   * @param {number} playerCol
   * @param {number} playerRow
   * @param {number} [range=1]
   * @returns {boolean}
   */
  isWithin(playerCol, playerRow, range = 1) {
    return Math.abs(playerCol - this.col) + Math.abs(playerRow - this.row) <= range;
  }

  /**
   * Return the list of context menu items to show when this object is right-clicked.
   * Each item: { label: string, disabled?: boolean, action: () => void }
   * Subclasses should call super.getContextMenuItems(player) and prepend/append their own.
   * @param {Token} player - The player that right-clicked
   * @returns {Array<{label: string, disabled?: boolean, action: Function}>}
   */
  getContextMenuItems(_player) {
    return [
      {
        label: 'Examine',
        action: () => {
          logger.info(`Examined ${this.constructor.name} at (${this.col}, ${this.row})`);
        }
      }
    ];
  }

  /**
   * Called when a token interacts with this object.
   * Override in subclasses to implement specific behavior.
   * @param {Token} token - The token interacting with this object
   */
  interact(token) {
    logger.debug(`${token.name} interacted with ${this.constructor.name} at (${this.col}, ${this.row})`);
  }
}
