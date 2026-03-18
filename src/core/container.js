/**
 * container.js - Base class for all inventory containers
 *
 * Container extends Interactable (→ Entity → Renderable) so that:
 *   - Map-placed containers (chests, barrels, drawers) are renderable and interactable
 *   - Tokens (players, enemies) can carry a personal Container as their inventory
 *
 * When placed on a map, provide grid + col + row; pixel position is computed from those.
 * When used as a personal inventory (no map position), omit grid/col/row — they default
 * to null / 0,0 via the Entity null-safe fallback.
 *
 * Subclasses (Chest, Barrel, …) set their own img and default capacity.
 */

import { Interactable } from './interactable.js';
import { logger } from '../utils/logger.js';

export class Container extends Interactable {
  /**
   * @param {number} x       - Pixel X (col * grid.size for map containers; 0 for personal)
   * @param {number} y       - Pixel Y
   * @param {number} width   - Pixel width  (grid.size for map containers; 0 for personal)
   * @param {number} height  - Pixel height
   * @param {Object} options
   * @param {string}  [options.name='Container']
   * @param {string}  [options.img=null]       - Texture key; renders in place of color when set
   * @param {string}  [options.color='#886622']
   * @param {number}  [options.capacity=4]     - Maximum inventory slots
   * @param {Array}   [options.inventory=[]]   - Initial items
   * @param {Grid}    [options.grid=null]       - Required for map-placed containers
   * @param {number}  [options.col]
   * @param {number}  [options.row]
   * @param {boolean} [options.passable=true]
   */
  constructor(x, y, width, height, options = {}) {
    super(x, y, width, height, {
      grid:     options.grid    || null,
      col:      options.col,
      row:      options.row,
      passable: options.passable !== undefined ? options.passable : true,
      color:    options.color   || '#886622'
    });

    this.name      = options.name      || 'Container';
    this.img       = options.img       || null;
    this.capacity  = Math.max(1, options.capacity ?? 4);
    this.inventory = options.inventory ? [...options.inventory] : [];

    // Set externally by game.js — called when the player chooses Open/Loot
    this.onOpen = null;
  }

  /**
   * Containers use capacity as their own property, not Entity's formula-derived stats.
   * Override to prevent formula system from running.
   */
  calculateStats() { /* no-op */ }

  /** Rendering is handled by the Phaser sprite in game.js — nothing to draw here. */
  render() { /* no-op */ }

  /** True when inventory is at capacity. */
  get isFull() {
    return this.inventory.length >= this.capacity;
  }

  /**
   * Add an item to this container.
   * @param {Item} item
   * @returns {boolean} true if added, false if full
   */
  addItem(item) {
    if (this.isFull) {
      logger.debug(`${this.name} is full (${this.capacity} slots)`);
      return false;
    }
    this.inventory.push(item);
    return true;
  }

  /**
   * Remove a specific item from inventory.
   * @param {Item} item
   * @returns {boolean} true if removed
   */
  removeItem(item) {
    const idx = this.inventory.indexOf(item);
    if (idx !== -1) {
      this.inventory.splice(idx, 1);
      logger.info(`Took ${item.name} from ${this.name}.`);
      return true;
    }
    return false;
  }

  /**
   * Context menu items for right-clicking this container on the map.
   * "Open" is disabled if the container has a grid position and the player is out of range.
   * Personal-inventory containers (no grid) never use this menu directly.
   * @param {Token} player
   * @returns {Array<{label:string, disabled?:boolean, action:Function}>}
   */
  getContextMenuItems(player) {
    const inRange = this.grid
      ? this.isWithin(player.col, player.row, 1)
      : false;

    return [
      {
        label:  'Examine',
        action: () => logger.info(
          `${this.name} — ${this.inventory.length} / ${this.capacity} item(s)`
        )
      },
      {
        label:    'Open',
        disabled: !inRange,
        action:   () => this.onOpen && this.onOpen(this)
      }
    ];
  }
}
