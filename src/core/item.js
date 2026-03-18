/**
 * item.js - Base class for all game items
 *
 * Item extends Interactable (→ Entity → Renderable) so that:
 *   - Items can exist as map objects (renderable, interactable for pick-up)
 *   - Items can exist inside a Container (no grid, no map position)
 *   - Items carry flat stat bonuses that add to the owning entity's stats when equipped
 *
 * Items do NOT use the Entity calculateStats() formula system.
 * All stat values on an Item are static bonuses supplied at creation.
 *
 * size {x, y} follows a Diablo 2-style inventory grid.
 * Default 1×1; larger sizes to be implemented later.
 */

import { Interactable } from './interactable.js';
import { logger } from '../utils/logger.js';

export class Item extends Interactable {
  /**
   * @param {number} x       - Pixel X (0 for inventory items)
   * @param {number} y       - Pixel Y (0 for inventory items)
   * @param {number} width   - Pixel width (0 for inventory items)
   * @param {number} height  - Pixel height (0 for inventory items)
   * @param {Object} options
   * @param {string}  [options.name='Item']
   * @param {string}  [options.img=null]        - Texture key for rendering
   * @param {string}  [options.color='#CCAA55']
   * @param {Grid}    [options.grid=null]        - Only needed when placed on map
   * @param {number}  [options.col]              - Only needed when placed on map
   * @param {number}  [options.row]              - Only needed when placed on map
   * @param {boolean} [options.equipped=false]
   * @param {number}  [options.bonusStrength=0]
   * @param {number}  [options.bonusDexterity=0]
   * @param {number}  [options.bonusIntelligence=0]
   * @param {number}  [options.bonusDefense=0]
   * @param {number}  [options.bonusMovement=0]
   * @param {number}  [options.bonusInitiative=0]
   * @param {number}  [options.bonusSkill=0]
   */
  constructor(x, y, width, height, options = {}) {
    super(x, y, width, height, {
      grid:     options.grid    || null,
      col:      options.col,
      row:      options.row,
      passable: true,
      color:    options.color   || '#CCAA55'
    });

    this.name     = options.name     || 'Item';
    this.img      = options.img      || null;
    this.equipped = options.equipped || false;

    // D2-style inventory grid size (1×1 for now; larger sizes to be implemented)
    this.size = { x: 1, y: 1 };

    // Flat stat bonuses — applied to the owning entity when this item is equipped
    this.bonusStrength     = options.bonusStrength     || 0;
    this.bonusDexterity    = options.bonusDexterity    || 0;
    this.bonusIntelligence = options.bonusIntelligence || 0;
    this.bonusDefense      = options.bonusDefense      || 0;
    this.bonusMovement     = options.bonusMovement     || 0;
    this.bonusInitiative   = options.bonusInitiative   || 0;
    this.bonusSkill        = options.bonusSkill        || 0;
  }

  /**
   * Items use flat bonus stats only — no derived formula calculations.
   * Overrides Entity.calculateStats() to prevent the formula system from running.
   */
  calculateStats() { /* no-op */ }

  /**
   * Context menu when right-clicking this item on the map.
   * "Pick Up" is disabled if the item has no grid (it's in an inventory, not on the map)
   * or if the player is out of range.
   * @param {Token} player
   */
  getContextMenuItems(player) {
    const onMap   = !!this.grid;
    const inRange = onMap && this.isWithin(player.col, player.row, 1);
    return [
      {
        label:  'Examine',
        action: () => logger.info(`${this.name} — item at (${this.col}, ${this.row})`)
      },
      {
        label:    'Pick Up',
        disabled: !inRange,
        action:   () => {
          // TODO: add item to player's container and remove from map
          logger.info(`${player.name} picks up ${this.name}`);
        }
      }
    ];
  }
}
