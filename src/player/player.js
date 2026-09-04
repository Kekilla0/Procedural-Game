import { Inventory } from '../items/inventory.js';
import { Equipment } from '../items/equipment.js';
import { syncHealthFromAttributes, syncEnergyFromAttributes, capacityFor } from './stats.js';
import { computeEquipmentBonuses } from '../items/equipmentBonuses.js';
import { DEFAULT_ATTRIBUTES } from './attributeDefaults.js';
import { ACTION_BAR_SIZE, sanitizeActionSlot } from './actionBar.js';
import { TALENTS } from '../data/talents.js';

const INVENTORY_COLS = 4;
const INVENTORY_ROWS = 5; // 4x5 = 20 slots minimum; how this expands is a later decision

// Single source of truth for everything true about the player — position,
// class, inventory, equipment, resource stats, base attributes, level.
//
// Movement *interpolation* state (visual position, move tween progress)
// deliberately does NOT live here — that's render/controller state owned by
// ViewportScreen, not something "true about the player." Player holds only
// the settled tile.
export class Player {
    constructor() {
        this.col = 0;
        this.row = 0;
        this.classId = null;
        this.inventory = new Inventory(INVENTORY_COLS, INVENTORY_ROWS);
        this.equipment = new Equipment();
        this.resources = {
            health: { current: 1, max: 1 }, // placeholder — syncHealthFromAttributes below sets the real values
            energy: { current: 1, max: 1 }, // placeholder — syncEnergyFromAttributes below sets the real values
            xp: { current: 0, max: 1000 },
        };
        // Base stats — grow via level-ups (statPoints, spent on whichever
        // stat via CharacterPanel's + buttons) and, later, items. Derived
        // stats (health/defense/energy/damage, carry weight/speed/acuity,
        // resistances) are computed from these on the fly — see
        // src/player/stats.js — not stored here.
        this.attributes = { ...DEFAULT_ATTRIBUTES };
        this.level = 1;
        this.statPoints = 0; // unspent level-up points; CharacterPanel's + buttons only show when > 0
        this.subclass = null; // subclass id (see src/data/subclasses.js) — choosable once level >= SUBCLASS_UNLOCK_LEVEL, permanent once set
        this.talentPoints = 0; // unspent talent points; +1 per level granted, spent 1-for-1 learning a talent, never regained
        this.talents = []; // granted talent ids (see src/data/talents.js) — permanent, no removal path anywhere
        // 6 action-bar slots: null (empty), {type:'item', itemTypeId}, or
        // {type:'talent', talentId} — see src/player/actionBar.js. Items are
        // referenced by TYPE, not instance id, since Inventory never persists
        // instance ids across a save (see Inventory.serialize's own comment).
        this.actionBar = new Array(ACTION_BAR_SIZE).fill(null);

        // Real starting health/energy come from these, not the placeholder above.
        syncHealthFromAttributes(this);
        syncEnergyFromAttributes(this);
        // Direct call, not syncCarryCapacityFromAttributes: no `level` exists
        // yet, and a fresh inventory is always empty at exactly base capacity
        // (20 at 5 STR), so nothing can ever be evicted here regardless.
        this.inventory.resizeCapacity(capacityFor(this.attributes.strength));
    }

    serialize() {
        return {
            col: this.col,
            row: this.row,
            classId: this.classId,
            inventory: this.inventory.serialize(),
            equipment: this.equipment.serialize(),
            resources: this.resources,
            attributes: this.attributes,
            level: this.level,
            statPoints: this.statPoints,
            subclass: this.subclass,
            talentPoints: this.talentPoints,
            talents: this.talents,
            actionBar: this.actionBar,
        };
    }

    static deserialize(data) {
        const player = new Player();
        player.col = data?.col ?? 0;
        player.row = data?.row ?? 0;
        player.classId = data?.classId ?? null;
        if (data?.inventory) {
            player.inventory = Inventory.deserialize(data.inventory, INVENTORY_COLS, INVENTORY_ROWS);
        }
        if (data?.equipment) {
            player.equipment = Equipment.deserialize(data.equipment);
        }
        if (data?.resources) {
            player.resources = data.resources;
        }
        if (data?.attributes) {
            player.attributes = { ...DEFAULT_ATTRIBUTES, ...data.attributes };
        }
        player.level = data?.level ?? 1;
        player.statPoints = data?.statPoints ?? 0;
        player.subclass = data?.subclass ?? null;
        player.talentPoints = data?.talentPoints ?? 0;
        player.talents = Array.isArray(data?.talents) ? data.talents.filter((id) => TALENTS[id]) : [];
        player.actionBar = Array.from({ length: ACTION_BAR_SIZE }, (_, i) => sanitizeActionSlot(data?.actionBar?.[i]));

        // Keeps a loaded save's health/energy pools consistent with their attributes.
        syncHealthFromAttributes(player);
        syncEnergyFromAttributes(player);
        // Same direct-call reasoning as the constructor (no `level`/world at
        // deserialize time to hand evicted items to — see
        // syncCarryCapacityFromAttributes) — but DOES need equipment bonuses
        // folded in here, unlike the constructor's always-empty-inventory
        // case: a saved player with a Strength/Carry-Capacity-boosting item
        // already equipped must keep that item's room on every reload, not
        // silently shrink back to the un-equipped capacity and evict nothing
        // only because resizeCapacity itself never rejects a resize.
        const bonuses = computeEquipmentBonuses(player.equipment);
        player.inventory.resizeCapacity(capacityFor(player.attributes.strength + bonuses.strength) + bonuses.carryCapacity);
        return player;
    }
}
