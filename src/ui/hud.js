import { settings } from '../state/settings.js';
import { CharacterPanel } from './characterPanel.js';
import { drawInventoryGrid, gridDimensions, hitTestInventoryItem } from './inventoryGridRenderer.js';
import { ContextMenu } from './contextMenu.js';
import { drawTooltip, itemTooltipLines } from './tooltip.js';
import { STAT_INFO } from '../player/statInfo.js';
import {
    statBreakdown,
    syncHealthFromAttributes,
    syncEnergyFromAttributes,
    syncCarryCapacityFromAttributes,
} from '../player/stats.js';
import { GRID_CELL_SIZE, GRID_CELL_GAP } from './gridConstants.js';
import { equipItem, unequipToInventoryAt, swapEquipmentSlots } from '../items/equipment.js';
import { transferItem, transferItemTo, transferAll } from '../items/loot.js';
import { Panel } from './panel.js';
import { createGridSurface, createEquipmentSurface } from './surfaces.js';
import { ITEM_TYPES } from '../items/itemTypes.js';
import { TALENTS, talentsByTier, tierUnlockLevel } from '../data/talents.js';
import { ACTION_BAR_SIZE, useActionSlot, useTalent } from '../player/actionBar.js';
import { CLASSES } from '../data/classes.js';
import { SUBCLASSES } from '../data/subclasses.js';
import { wrapText } from './textWrap.js';

const LOOT_ALL_HEIGHT = 36;
const TALENT_COLUMN_GAP = 16; // gap between the General/Primary/Secondary columns
const TALENT_MARGIN_WIDTH = 48; // reserved for the shared level-tracker margin (track + "Lv N" labels)
const TALENT_MARGIN_TRACK_WIDTH = 4; // width of the vertical current-level fill track within the margin
const TALENT_BOX_PADDING = 10; // inset between a column's grey box border and its content
const TALENT_HEADER_HEIGHT = 38; // fixed per-column header footprint, so the row grid starts at the same y regardless of whether a column has a subtitle
const TALENT_CELL_SIZE = 26; // smaller than GRID_CELL_SIZE (40) — a talent column is much narrower than the inventory grid, and needs to fit 3 tiles + real gaps in one row

const BASE = {
    orbRadius: 42,
    actionSize: 40,
    actionCount: ACTION_BAR_SIZE,
    smallGap: 6, // action-slot gap, xp-bar gap
    menuSize: 34,
    menuGap: 8, // gap between stacked menu buttons
    sectionGap: 14, // orb <-> actions, orb <-> menu stack
    bottomMargin: 16, // HUD bar's own clearance from the viewport border
    xpBarHeight: 16,
    panelExtraGap: 10, // extra breathing room between a side panel and the orbs
    panelSideMargin: 24, // gap between a side panel and the viewport border
    panelVerticalMargin: 40, // extra top/bottom shrink beyond orb clearance
    panelCenterGap: 160, // minimum gap between left/right panels so the character stays visible
    panelMinWidth: 380, // below this, only one panel (either side) can be open at once
    panelMaxWidth: 640, // soft ceiling so panels don't get absurd on ultra-wide windows
};

// Titles live on the Panel chrome instances themselves (_characterChrome etc.)
// — only the menu-button letter is needed here.
const MENU_ITEMS = {
    character: { letter: 'C' },
    talent: { letter: 'T' },
    inventory: { letter: 'I' },
};

function computeLayout(scale) {
    const orbRadius = BASE.orbRadius * scale;
    const orbDiameter = orbRadius * 2;
    const actionSize = BASE.actionSize * scale;
    const smallGap = BASE.smallGap * scale;
    const actionsWidth = BASE.actionCount * actionSize + (BASE.actionCount - 1) * smallGap;
    const menuSize = BASE.menuSize * scale;
    const menuGap = BASE.menuGap * scale;
    const sectionGap = BASE.sectionGap * scale;
    const bottomMargin = BASE.bottomMargin * scale;
    const xpBarHeight = BASE.xpBarHeight * scale;
    const panelExtraGap = BASE.panelExtraGap * scale;
    const totalWidth = menuSize + sectionGap + orbDiameter + sectionGap + actionsWidth + sectionGap + orbDiameter + sectionGap + menuSize;

    return {
        scale,
        orbRadius,
        orbDiameter,
        actionSize,
        smallGap,
        actionsWidth,
        menuSize,
        menuGap,
        sectionGap,
        bottomMargin,
        xpBarHeight,
        panelExtraGap,
        totalWidth,
        panelClearance: orbDiameter + bottomMargin + panelExtraGap,
        panelSideMargin: BASE.panelSideMargin * scale,
        panelVerticalMargin: BASE.panelVerticalMargin * scale,
        panelCenterGap: BASE.panelCenterGap * scale,
        panelMinWidth: BASE.panelMinWidth * scale,
        panelMaxWidth: BASE.panelMaxWidth * scale,
    };
}

// Diablo-style bottom HUD: health orb (left) / energy orb (right), six action
// slots between them with an XP bar underneath, and small menu buttons
// flanking the orbs — Character on the left, Talents + Inventory on the
// right. All sizing scales with settings.uiScale.
//
// Character/Talent/Inventory open as docked side panels rather than modal
// popups: at most one panel per side (left holds only Character; right holds
// Talent or Inventory, mutually exclusive), so Character + Talent or
// Character + Inventory can be open together, but Talent and Inventory can't.
// Panel width is dynamic — it grows/shrinks with the window — but if the
// window is too narrow to fit two panels side by side at a readable width,
// only one panel (on either side) is allowed open at a time.
export class Hud {
    constructor() {
        this.leftPanel = null; // null | 'character'
        this.rightPanel = null; // null | 'talent' | 'inventory'
        this.characterPanel = new CharacterPanel();

        // Shared chrome (background/border/title/close-X, optionally header-
        // drag) for each panel — see panel.js. Character/Talent/Inventory stay
        // docked (draggable:false, same fixed layout as always); Container is
        // the one panel the user can drag out of the way.
        this._characterChrome = new Panel({ title: 'Character Sheet' });
        this._talentChrome = new Panel({ title: 'Talents' });
        this._inventoryChrome = new Panel({ title: 'Inventory' });
        this._containerChrome = new Panel({ title: 'Container', draggable: true });
        this._panelDragging = null; // which chrome (if any) is being repositioned by its header right now

        this._canFitBothPanels = true; // recomputed each render from viewport width
        this._lastOpenedSide = null; // 'left' | 'right' — used to resolve a resize-into-too-small conflict

        this._menuButtons = []; // recomputed each render; hit-tested in onClick
        this._actionButtons = []; // [{x, y, width, height, index}]
        this._talentButtons = []; // recomputed each render; [{talentId, x, y, width, height}]

        this.contextMenu = null;
        this._inventoryGridOrigin = null; // set while the inventory panel renders; used to hit-test right-clicks

        // Set when CharacterPanel's "Choose Subclass" button is clicked;
        // only ViewportScreen (via manager) can actually open the picker
        // popup, so it consumes this via consumeSubclassPromptRequest()
        // right after calling onClick.
        this.subclassPromptRequested = false;

        this.container = null; // ground-container entity whose contents are currently open, or null
        this._containerGridOrigin = null;
        this._lootAllRect = null;

        // { item, source: {type: 'inventory'|'equipment'|'container', slotId?}, x, y } while
        // dragging an item between the inventory grid, an equip slot, or an open container.
        this.dragging = null;
        this._suppressNextClick = false; // swallows the synthetic click that follows a drag's mouseup
        this._lastMouseX = null;
        this._lastMouseY = null;

        // The player object passed into whichever public method last ran —
        // set at the top of render/onContextMenu/onMouseDown/onMouseUp so the
        // surfaces below (built once, here) can always resolve the *current*
        // player's inventory/equipment via closures, even across new-game/
        // load-game swapping out the Player instance entirely.
        this._currentPlayer = null;

        // One surface per cursor-resolvable area — see surfaces.js. Used to
        // unify what used to be four separate "container -> equipment ->
        // inventory" hit-test chains (hover tooltip, drag-start, drop-target,
        // context menu) into a single _resolveCursor walk.
        this._containerSurface = createGridSurface(
            'container',
            () => this.container.containerInventory,
            () => this._containerGridOrigin,
            () => settings.uiScale || 1,
            () => !!this.container
        );
        this._inventorySurface = createGridSurface(
            'inventory',
            () => this._currentPlayer.inventory,
            () => this._inventoryGridOrigin,
            () => settings.uiScale || 1,
            () => this.rightPanel === 'inventory'
        );
        this._equipmentSurface = createEquipmentSurface(
            () => this._currentPlayer.equipment,
            this.characterPanel,
            () => this.leftPanel === 'character'
        );
    }

    // What's under the cursor, checking the container (floats on top), then
    // equipment, then inventory. Returns {surface, item} or null.
    _resolveCursor(x, y) {
        for (const surface of [this._containerSurface, this._equipmentSurface, this._inventorySurface]) {
            const item = surface.hitTest(x, y);
            if (item) return { surface, item };
        }
        return null;
    }

    // {talentId, state} under (x,y) if the Talent panel is open and a tile is
    // there, else null — mirrors _resolveCursor's "hit-test once, branch on
    // the result everywhere" shape. `state` ('locked'|'available'|'learned',
    // set on every tile when _drawTalentPanel renders it) is what every
    // consumer (drag-start, click-to-learn, right-click Use, tooltip)
    // branches on. Talents aren't backed by an Inventory-shaped surface (see
    // surfaces.js), so they get their own tiny hit-test rather than being
    // forced into that abstraction.
    _talentAt(x, y) {
        if (this.rightPanel !== 'talent') return null;
        const hit = this._talentButtons.find((b) => this._hit(b, x, y));
        return hit ? { talentId: hit.talentId, state: hit.state } : null;
    }

    // A talent duck-typed as an item — {width:1,height:1,color,label,name} —
    // so the existing drag-ghost/tooltip code (which only ever reads
    // item.itemType.*) works on a talent with zero changes there. Talents
    // have no inventory footprint of their own, hence the hardcoded 1x1.
    _talentAsItem(talentId) {
        const talent = TALENTS[talentId];
        if (!talent) return null;
        return { itemType: { width: 1, height: 1, color: talent.color, label: talent.label, name: talent.name }, quantity: null };
    }

    // What to draw/drag for one action-bar slot — an item slot resolves to
    // the real ITEM_TYPES entry, with `quantity` summed across every
    // matching stack the player currently holds (shown as a badge — see
    // _drawActionSlot) and "available" only while that's > 0 (a
    // fully-consumed stack dims the slot rather than clearing the
    // assignment, so it re-lights automatically if more are picked up
    // later); a talent slot always resolves via _talentAsItem, is always
    // available (talents are never consumed), and has `quantity: null` —
    // the badge only ever applies to items, per the user's explicit ask, and
    // gating it on `quantity != null` means the draw code doesn't need a
    // second type-check to know that. Returns null for an empty slot or one
    // whose item type/talent no longer exists.
    _resolveActionSlotVisual(slot) {
        if (!slot) return null;
        if (slot.type === 'item') {
            const itemType = ITEM_TYPES[slot.itemTypeId];
            if (!itemType) return null;
            const quantity = this._currentPlayer.inventory.items
                .filter((it) => it.itemType.id === slot.itemTypeId)
                .reduce((sum, it) => sum + it.quantity, 0);
            return { item: { itemType, quantity: null }, available: quantity > 0, quantity };
        }
        if (slot.type === 'talent') {
            const item = this._talentAsItem(slot.talentId);
            return item ? { item, available: true, quantity: null } : null;
        }
        return null;
    }

    // The chrome (Panel instance) for a given right/left-panel id.
    _chromeFor(id) {
        if (id === 'character') return this._characterChrome;
        if (id === 'talent') return this._talentChrome;
        return this._inventoryChrome;
    }

    // Currently-open panel chromes, topmost first — container floats above
    // the docked side panels, so it gets first refusal on both header-drag
    // and item hit-testing.
    _openChromes() {
        const list = [];
        if (this.container) list.push(this._containerChrome);
        if (this.leftPanel === 'character') list.push(this._characterChrome);
        if (this.rightPanel) list.push(this._chromeFor(this.rightPanel));
        return list;
    }

    // Opens (or replaces) the non-modal container panel. Unlike the side
    // panels, there's no toggle — interacting with a different container just
    // swaps what's shown. Titled "Pile" for a player-dropped pile (see
    // world/drop.js) vs "Container" for a level-placed one.
    openContainer(entity) {
        this.container = entity;
        this._containerChrome.title = entity.isPile ? 'Pile' : 'Container';
    }

    closeContainer() {
        if (settings.debug && settings.refillContainers) {
            this.container?.refill?.();
        }
        this.container = null;
    }

    onWheel(deltaY, x, y) {
        if (this.leftPanel === 'character') {
            return this.characterPanel.onWheel?.(deltaY, x, y) ?? false;
        }
        return false;
    }

    // Deterministic "make sure this menu is open" — unlike _toggle (used by
    // clicking a menu button), never closes it. Used by the debug
    // auto-open-menu setting.
    openMenu(id) {
        if (id === 'character') {
            this.leftPanel = 'character';
        } else if (id === 'talent' || id === 'inventory') {
            this.rightPanel = id;
        }
    }

    // True (and resets to false) exactly once after the "Choose Subclass"
    // button was clicked — ViewportScreen.onClick checks this right after
    // calling hud.onClick to decide whether to open SubclassSelectPopup.
    consumeSubclassPromptRequest() {
        const requested = this.subclassPromptRequested;
        this.subclassPromptRequested = false;
        return requested;
    }

    // Right-click whatever's under the cursor — inventory items get Equip/
    // Drop/Drop All, equipped items get Unequip, container items get Take
    // (the latter two are new: previously only inventory items had a context
    // menu at all).
    onContextMenu(x, y, player, level) {
        this._currentPlayer = player;
        this.contextMenu = null;

        const talentHit = this._talentAt(x, y);
        if (talentHit) {
            // Only a learned, active talent has a "Use" — passives are
            // always-on once learned, nothing to trigger; locked/available/
            // passive tiles all still consume the right-click (no menu),
            // same as a plain left-click on them does nothing but isn't
            // ignored either.
            if (talentHit.state === 'learned' && TALENTS[talentHit.talentId]?.kind === 'active') {
                this.contextMenu = new ContextMenu(x, y, [
                    { label: 'Use', onSelect: () => useTalent(player, talentHit.talentId) },
                ]);
            }
            return true;
        }

        const hit = this._resolveCursor(x, y);
        if (!hit) return false;

        const options = hit.surface.contextActionsFor(hit.item, player, x, y, level);
        if (options.length === 0) return false;

        this.contextMenu = new ContextMenu(x, y, options);
        return true;
    }

    // Drag an item from the inventory grid, an equipment slot, or an open
    // container's grid, toward any of the other two. Only starts a drag when
    // the mouse goes down directly on an item; dropping anywhere that isn't a
    // valid target is simply a no-op — nothing is mutated until a valid drop
    // is confirmed in onMouseUp.
    onMouseDown(x, y, player) {
        this._currentPlayer = player;
        if (this.contextMenu) return; // let the open context menu handle this click instead

        // Header-drag (repositioning a whole panel) takes priority over
        // item-drag: the header band and the body/grid are spatially
        // disjoint, so there's no ambiguity about which gesture this
        // mousedown is starting.
        for (const chrome of this._openChromes()) {
            if (chrome.onMouseDown(x, y)) {
                this._panelDragging = chrome;
                return;
            }
        }

        // Only a 'learned', 'active' talent starts a drag — passives are
        // always-on once learned, so there's nothing to place on the action
        // bar for them, same as 'locked'/'available' having nothing usable
        // yet. Either way the mousedown is swallowed here, so a plain
        // click-without-drag on 'available' still reaches onClick's
        // learn-a-talent handling below (this.dragging stays null, so
        // onMouseUp does nothing and never sets _suppressNextClick).
        const talentHit = this._talentAt(x, y);
        if (talentHit) {
            if (talentHit.state === 'learned' && TALENTS[talentHit.talentId]?.kind === 'active') {
                const item = this._talentAsItem(talentHit.talentId);
                if (item) this.dragging = { item, source: { type: 'talent', talentId: talentHit.talentId }, x, y };
            }
            return;
        }

        // Action-bar slots fully capture their own mousedowns (occupied or
        // not) rather than falling through — an occupied slot starts a drag;
        // an empty/invalid one just swallows the gesture so the natural
        // click that follows still reaches onClick's use-slot handling
        // (this.dragging stays null, so onMouseUp does nothing and never
        // sets _suppressNextClick).
        const actionHit = this._actionButtons.find((b) => this._hit(b, x, y));
        if (actionHit) {
            const visual = this._resolveActionSlotVisual(player.actionBar[actionHit.index]);
            if (visual) this.dragging = { item: visual.item, source: { type: 'actionBar', slotId: actionHit.index }, x, y };
            return;
        }

        const hit = this._resolveCursor(x, y);
        if (hit) {
            this.dragging = { item: hit.item, source: { type: hit.surface.type, slotId: hit.surface.slotAt(x, y) }, x, y };
            return;
        }

        // The container floats on top and must fully capture clicks within
        // its bounds even where it has no item, so they don't fall through
        // to whatever's underneath.
        if (this.container && this._containerChrome.hitPanel(x, y)) return;
    }

    onMouseMove(x, y) {
        this._lastMouseX = x;
        this._lastMouseY = y;
        if (this._panelDragging) {
            this._panelDragging.onMouseMove(x, y);
            return;
        }
        if (this.dragging) {
            this.dragging.x = x;
            this.dragging.y = y;
        }
    }

    onMouseUp(x, y, player, level) {
        const { inventory, equipment } = player;
        this._currentPlayer = player;
        if (this._panelDragging) {
            this._panelDragging.onMouseUp();
            this._panelDragging = null;
            this._suppressNextClick = true;
            return;
        }

        if (!this.dragging) return;
        const { item, source } = this.dragging;
        this.dragging = null;

        const target = this._dropTargetAt(x, y);
        if (target) {
            if (this._performDrop(item, source, target, inventory, equipment, x, y, level)) {
                this._suppressNextClick = true;
            }
        } else if (source.type === 'actionBar') {
            // Dropped in empty space: unassign — there's no precedent
            // elsewhere for this (every other failed drop is a silent
            // no-op), but a bar slot isn't "moving" the underlying
            // item/talent, just a reference to it, so clearing it is the
            // only sane behavior for "I dragged this off the bar."
            player.actionBar[source.slotId] = null;
            this._suppressNextClick = true;
        }
    }

    // Where a drag would land if released at (x,y) — the same three places a
    // drag can start from. The container is checked against its whole panel
    // (header, padding, Loot All button included), not just its grid cells —
    // a forgiving drop target since the grid auto-places new items anywhere
    // there's room; equipment/inventory use their surfaces' tighter
    // grid-region containsPoint since those are unchanged from before.
    _dropTargetAt(x, y) {
        const actionHit = this._actionButtons.find((b) => this._hit(b, x, y));
        if (actionHit) return { type: 'actionBar', slotId: actionHit.index };

        if (this.container && this._containerChrome.hitPanel(x, y)) {
            return { type: 'container', slotId: null };
        }
        for (const surface of [this._equipmentSurface, this._inventorySurface]) {
            if (surface.containsPoint(x, y)) {
                return { type: surface.type, slotId: surface.slotAt(x, y) };
            }
        }
        return null;
    }

    // Equip/unequip can change Health/Energy max (a Strength/Intelligence
    // affix, or a direct Health/Energy affix, on the item involved) and
    // Carry Capacity (a Strength/Carry-Capacity affix) — keeps the HUD orbs
    // AND the actual inventory grid size live-consistent with the Character
    // panel's displayed numbers the moment gear changes, not just at next
    // level-up/stat-spend (the only other places these already got called —
    // this was the real gap: Carry Capacity's *displayed* number already
    // reflected equipment, but the grid itself never resized until now).
    // swapEquipmentSlots doesn't need this: moving two equipped items
    // between slots never changes the total equipment bonus sum. `level` is
    // only needed for a capacity DECREASE that evicts something — growing
    // (the common case) never does, but it's threaded through regardless
    // since resizeCapacity itself doesn't know in advance which it'll be.
    _resyncResources(level) {
        syncHealthFromAttributes(this._currentPlayer);
        syncEnergyFromAttributes(this._currentPlayer);
        syncCarryCapacityFromAttributes(this._currentPlayer, level);
    }

    // Dispatches a confirmed drag+drop to the right transfer function.
    // Returns true if something actually moved (so the caller can suppress
    // the synthetic click that follows). (x,y) is the drop point — used to
    // land the item at the exact grid cell it was dropped on, rather than
    // wherever addItem's first-fit scan would put it. Dropping within the
    // SAME grid (inventory-to-inventory, container-to-container) repositions
    // the item there instead of being treated as a no-op — see Inventory.moveItem.
    _performDrop(item, source, target, inventory, equipment, x, y, level) {
        if (source.type === 'equipment' && target.type === 'equipment') {
            if (source.slotId === target.slotId) return false;
            return swapEquipmentSlots(equipment, source.slotId, target.slotId);
        }

        if (target.type === 'actionBar') {
            const actionBar = this._currentPlayer.actionBar;
            if (source.type === 'actionBar') {
                // Same-slot "drag" (no real movement) is a deliberate no-op,
                // not a bug: returning false here means onMouseUp never sets
                // _suppressNextClick, so the native click that always
                // follows a mousedown+mouseup still reaches onClick — that's
                // what makes a plain click-without-drag on a slot use it.
                if (source.slotId === target.slotId) return false;
                const temp = actionBar[target.slotId];
                actionBar[target.slotId] = actionBar[source.slotId];
                actionBar[source.slotId] = temp;
                return true;
            }
            if (source.type === 'talent') {
                actionBar[target.slotId] = { type: 'talent', talentId: source.talentId };
                return true;
            }
            if (!item.itemType.use) return false; // only usable items can be assigned
            actionBar[target.slotId] = { type: 'item', itemTypeId: item.itemType.id };
            return true;
        }

        if (source.type === 'actionBar') {
            // Dropped somewhere other than the action bar: just clears the
            // reference — reassignment moves a pointer, never the underlying
            // item/talent, so there's nothing to actually transfer.
            this._currentPlayer.actionBar[source.slotId] = null;
            return true;
        }

        if (source.type === 'talent') return false; // talents can only ever be dropped onto the action bar

        const sourceInventory = source.type === 'container' ? this.container?.containerInventory : inventory;
        const targetInventory = target.type === 'container' ? this.container?.containerInventory : inventory;

        if (target.type === 'equipment') {
            if (source.type === 'equipment') return false; // handled above
            if (!sourceInventory) return false;
            const equipped = equipItem(sourceInventory, equipment, item, target.slotId);
            if (equipped) this._resyncResources(level);
            return equipped;
        }

        const targetSurface = target.type === 'container' ? this._containerSurface : this._inventorySurface;
        const { col, row } = targetSurface.cellAt(x, y);

        if (source.type === 'equipment') {
            if (!targetInventory) return false;
            const unequipped = unequipToInventoryAt(equipment, targetInventory, source.slotId, col, row);
            if (unequipped) this._resyncResources(level);
            return unequipped;
        }

        if (!sourceInventory || !targetInventory) return false;
        if (sourceInventory === targetInventory) {
            return sourceInventory.moveItem(item.id, col, row);
        }
        return transferItemTo(sourceInventory, targetInventory, item.id, col, row);
    }

    onClick(x, y, player, level) {
        const inventory = player.inventory;

        if (this._suppressNextClick) {
            this._suppressNextClick = false;
            return true;
        }

        if (this.contextMenu) {
            this.contextMenu.handleClick(x, y);
            this.contextMenu = null;
            return true;
        }

        if (this.leftPanel === 'character' && this.characterPanel.onClick(x, y, player, level)) {
            if (this.characterPanel.subclassPromptRequested) {
                this.subclassPromptRequested = true;
                this.characterPanel.subclassPromptRequested = false;
            }
            return true;
        }

        if (this.rightPanel === 'talent') {
            const talentHit = this._talentAt(x, y);
            if (talentHit) {
                // Learning a talent: permanent, costs exactly 1 point, only
                // for an unlocked-but-not-yet-learned tile. 'locked' and
                // 'available' with 0 points both silently no-op (the tooltip
                // already explains why) — either way the click is consumed
                // so it can't fall through to whatever's underneath.
                if (talentHit.state === 'available' && player.talentPoints > 0) {
                    player.talentPoints -= 1;
                    player.talents.push(talentHit.talentId);
                }
                return true;
            }
        }

        if (this.container) {
            if (this._containerChrome.hitClose(x, y)) {
                this.closeContainer();
                return true;
            }
            if (this._hit(this._lootAllRect, x, y)) {
                transferAll(this.container.containerInventory, inventory);
                return true;
            }
            const scale = settings.uiScale || 1;
            const item = hitTestInventoryItem(
                this.container.containerInventory,
                this._containerGridOrigin.x,
                this._containerGridOrigin.y,
                scale,
                x,
                y
            );
            if (item) {
                transferItem(this.container.containerInventory, inventory, item.id);
                return true;
            }
            if (this._containerChrome.hitPanel(x, y)) return true;
        }

        const menuHit = this._menuButtons.find((b) => this._hit(b, x, y));
        if (menuHit) {
            this.toggleMenu(menuHit.id);
            return true;
        }
        if (this.leftPanel === 'character' && this._characterChrome.hitClose(x, y)) {
            this.leftPanel = null;
            return true;
        }
        if (this.rightPanel && this._chromeFor(this.rightPanel).hitClose(x, y)) {
            this.rightPanel = null;
            return true;
        }

        const actionHit = this._actionButtons.find((b) => this._hit(b, x, y));
        if (actionHit) {
            useActionSlot(player, actionHit.index);
            return true;
        }
        return false;
    }

    // Opens/closes menu `id` ('character' | 'talent' | 'inventory') exactly as
    // clicking its HUD button would — shared by the menu buttons themselves
    // and by the rebindable open-panel hotkeys (see ViewportScreen.onKeyDown).
    toggleMenu(id) {
        if (id === 'character') {
            if (this.leftPanel === 'character') {
                this.leftPanel = null;
            } else {
                this.leftPanel = 'character';
                if (!this._canFitBothPanels) this.rightPanel = null;
                this._lastOpenedSide = 'left';
            }
        } else if (this.rightPanel === id) {
            this.rightPanel = null;
        } else {
            this.rightPanel = id;
            if (!this._canFitBothPanels) this.leftPanel = null;
            this._lastOpenedSide = 'right';
        }
    }

    render(ctx, left, top, viewWidth, viewHeight, player) {
        const { inventory, equipment, resources } = player;
        this._currentPlayer = player;
        const L = computeLayout(settings.uiScale || 1);

        this._menuButtons = [];
        this._actionButtons = [];
        this._talentButtons = [];

        this._drawSidePanels(ctx, L, left, top, viewWidth, viewHeight, inventory, equipment);

        const centerY = top + viewHeight - L.bottomMargin - L.orbRadius;
        const startX = left + (viewWidth - L.totalWidth) / 2;

        this._drawMenuButton(ctx, L, startX, centerY - L.menuSize / 2, 'character');

        const healthCenterX = startX + L.menuSize + L.sectionGap + L.orbRadius;
        this._drawOrb(ctx, L, healthCenterX, centerY, resources.health, '#7a1f1f', '#d94a4a');

        const actionsX = healthCenterX + L.orbRadius + L.sectionGap;
        const actionsY = centerY - L.actionSize / 2 - (L.xpBarHeight + L.smallGap) / 2;
        for (let i = 0; i < BASE.actionCount; i++) {
            const x = actionsX + i * (L.actionSize + L.smallGap);
            this._drawActionSlot(ctx, L, x, actionsY, i);
        }
        const xpY = actionsY + L.actionSize + L.smallGap;
        this._drawXpBar(ctx, L, actionsX, xpY, L.actionsWidth, resources.xp);

        const energyCenterX = actionsX + L.actionsWidth + L.sectionGap + L.orbRadius;
        this._drawOrb(ctx, L, energyCenterX, centerY, resources.energy, '#1f3f7a', '#4a90d9');

        const rightMenuX = energyCenterX + L.orbRadius + L.sectionGap;
        const rightStackTop = centerY - (L.menuSize * 2 + L.menuGap) / 2;
        this._drawMenuButton(ctx, L, rightMenuX, rightStackTop, 'talent');
        this._drawMenuButton(ctx, L, rightMenuX, rightStackTop + L.menuSize + L.menuGap, 'inventory');

        if (this.container) {
            this._drawContainerPanel(ctx, L, left, top, viewWidth, viewHeight);
        }

        if (this.contextMenu) {
            this.contextMenu.render(ctx, left, top, viewWidth, viewHeight);
        } else if (!this.dragging) {
            this._drawHoverTooltip(ctx, left, top, viewWidth, viewHeight);
        }

        if (this.dragging) {
            this._drawDragGhost(ctx, L);
        }
    }

    // Shows item info for whatever's under the cursor — inventory items,
    // equipped items, and open-container items — or, when the Character
    // panel is open, a stat's description (hovering its label) or its
    // source breakdown (hovering its number) — see statBreakdown in stats.js.
    // (talents/enemies/etc. can reuse drawTooltip the same way once they
    // need it). Suppressed while dragging or while a context menu is open.
    _drawHoverTooltip(ctx, left, top, viewWidth, viewHeight) {
        const x = this._lastMouseX;
        const y = this._lastMouseY;
        if (x == null || y == null) return;

        if (this.leftPanel === 'character') {
            const hover = this.characterPanel.getStatHoverAt(x, y);
            if (hover) {
                const info = STAT_INFO[hover.key];
                const breakdown = hover.zone === 'value' ? statBreakdown(this._currentPlayer, hover.key) : null;
                if (breakdown) {
                    drawTooltip(ctx, x, y, [info.label, ...breakdown], left, top, viewWidth, viewHeight);
                    return;
                }
                if (info) {
                    drawTooltip(ctx, x, y, [info.label, ...info.lines], left, top, viewWidth, viewHeight);
                    return;
                }
            }
        }

        const talentHit = this._talentAt(x, y);
        if (talentHit) {
            const talent = TALENTS[talentHit.talentId];
            if (talent) {
                const lines = [talent.name, talent.description, talent.kind === 'passive' ? 'Passive' : 'Active'];
                if (talentHit.state === 'locked') {
                    lines.push(`Requires level ${tierUnlockLevel(talent.category, talent.tier)}`);
                } else if (talentHit.state === 'available') {
                    lines.push(this._currentPlayer.talentPoints > 0 ? 'Click to learn (1 talent point)' : 'Requires 1 talent point');
                }
                drawTooltip(ctx, x, y, lines, left, top, viewWidth, viewHeight);
                return;
            }
        }

        const actionHit = this._actionButtons.find((b) => this._hit(b, x, y));
        if (actionHit) {
            const visual = this._resolveActionSlotVisual(this._currentPlayer?.actionBar[actionHit.index]);
            if (visual) {
                const lines = [visual.item.itemType.name];
                if (visual.item.itemType.description) lines.push(visual.item.itemType.description);
                drawTooltip(ctx, x, y, lines, left, top, viewWidth, viewHeight);
                return;
            }
        }

        const hit = this._resolveCursor(x, y);
        if (!hit) return;

        drawTooltip(ctx, x, y, itemTooltipLines(hit.item), left, top, viewWidth, viewHeight);
    }

    // Size of the floating container panel — needed both to draw it and to
    // reserve room for it between the side panels (see _effectiveCenterGap),
    // so it never overlaps them and hides/blocks whatever's underneath.
    _containerPanelSize(L) {
        const inventory = this.container.containerInventory;
        const dims = gridDimensions(inventory, L.scale);
        const lootAllHeight = LOOT_ALL_HEIGHT * L.scale;
        const pad = 20 * L.scale;
        return {
            width: Math.max(280 * L.scale, dims.width + pad * 2),
            height: 56 * L.scale + dims.height + 16 * L.scale + lootAllHeight + 20 * L.scale,
        };
    }

    // Non-modal panel for a ground container's contents — floats centered
    // over the viewport (no dark backdrop; the world stays visible and
    // clickable everywhere else) so it can be used alongside the inventory
    // and character panels for cross-panel drag-and-drop.
    _drawContainerPanel(ctx, L, left, top, viewWidth, viewHeight) {
        const inventory = this.container.containerInventory;
        const scale = L.scale;
        const dims = gridDimensions(inventory, scale);
        const lootAllHeight = LOOT_ALL_HEIGHT * scale;
        const { width, height } = this._containerPanelSize(L);

        const defaultRect = {
            x: left + (viewWidth - width) / 2,
            y: top + (viewHeight - height) / 2 - 60 * scale,
            width,
            height,
        };
        const bodyRect = this._containerChrome.render(ctx, defaultRect, scale);

        this._containerGridOrigin = { x: bodyRect.x, y: bodyRect.y };
        drawInventoryGrid(ctx, inventory, this._containerGridOrigin.x, this._containerGridOrigin.y, scale);

        this._lootAllRect = {
            x: this._containerGridOrigin.x,
            y: this._containerGridOrigin.y + dims.height + 16 * scale,
            width: dims.width,
            height: lootAllHeight,
        };
        ctx.fillStyle = '#243a24';
        ctx.fillRect(this._lootAllRect.x, this._lootAllRect.y, this._lootAllRect.width, this._lootAllRect.height);
        ctx.strokeStyle = '#4a7a4a';
        ctx.strokeRect(this._lootAllRect.x, this._lootAllRect.y, this._lootAllRect.width, this._lootAllRect.height);
        ctx.fillStyle = '#c0e0c0';
        ctx.font = `bold ${Math.round(15 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(
            'Loot All',
            this._lootAllRect.x + this._lootAllRect.width / 2,
            this._lootAllRect.y + this._lootAllRect.height / 2 + 5 * scale
        );
    }

    // Ghost is drawn at the item's actual grid footprint (matching how it's
    // drawn in a grid), not a fixed 1-cell icon — otherwise a 2x2/1x3 item
    // visually shrinks the moment you pick it up.
    _drawDragGhost(ctx, L) {
        const { item, x, y } = this.dragging;
        const cellSize = GRID_CELL_SIZE * L.scale;
        const gap = GRID_CELL_GAP * L.scale;
        const width = item.itemType.width * cellSize + (item.itemType.width - 1) * gap;
        const height = item.itemType.height * cellSize + (item.itemType.height - 1) * gap;

        ctx.globalAlpha = 0.8;
        ctx.fillStyle = item.itemType.color;
        ctx.fillRect(x - width / 2, y - height / 2, width, height);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x - width / 2, y - height / 2, width, height);
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#111';
        ctx.font = `bold ${Math.round(12 * L.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(item.itemType.label, x, y + 4 * L.scale);
    }

    // The gap side panels leave between them — normally just panelCenterGap
    // (so the character stays visible), but widened to fit the floating
    // container panel when one's open, so it never overlaps a side panel and
    // hides/blocks part of its grid underneath.
    _effectiveCenterGap(L) {
        if (!this.container) return L.panelCenterGap;
        const { width } = this._containerPanelSize(L);
        return Math.max(L.panelCenterGap, width + 40 * L.scale);
    }

    // Panel width is dynamic: it fills whatever space the window gives it
    // (between panelMinWidth and panelMaxWidth), keeping a fixed side margin
    // from the viewport border and a minimum center gap so the character
    // (drawn at viewport center) stays visible between two open panels. If
    // the window can't fit two panels at panelMinWidth, single-panel mode
    // kicks in: the one open panel gets the full available width instead.
    _drawSidePanels(ctx, L, left, top, viewWidth, viewHeight, inventory, equipment) {
        const verticalInset = L.panelClearance + L.panelVerticalMargin;
        const panelTop = top + verticalInset;
        const panelHeight = viewHeight - verticalInset * 2;

        const centerGap = this._effectiveCenterGap(L);
        const dualWidth = (viewWidth - L.panelSideMargin * 2 - centerGap) / 2;
        this._canFitBothPanels = dualWidth >= L.panelMinWidth;

        if (this.leftPanel && this.rightPanel && !this._canFitBothPanels) {
            if (this._lastOpenedSide === 'left') this.rightPanel = null;
            else this.leftPanel = null;
        }

        const panelWidth = this._canFitBothPanels
            ? Math.min(L.panelMaxWidth, dualWidth)
            : Math.min(L.panelMaxWidth, viewWidth - L.panelSideMargin * 2);

        if (this.leftPanel) {
            const rect = { x: left + L.panelSideMargin, y: panelTop, width: panelWidth, height: panelHeight };
            this._drawSidePanel(ctx, L, rect, this.leftPanel, inventory, equipment);
        }
        if (this.rightPanel) {
            const rect = {
                x: left + viewWidth - L.panelSideMargin - panelWidth,
                y: panelTop,
                width: panelWidth,
                height: panelHeight,
            };
            this._drawSidePanel(ctx, L, rect, this.rightPanel, inventory, equipment);
        }
    }

    _drawSidePanel(ctx, L, rect, id, inventory, equipment) {
        const bodyRect = this._chromeFor(id).render(ctx, rect, L.scale);

        if (id === 'character') {
            this.characterPanel.render(ctx, bodyRect, L.scale, this._currentPlayer);
        } else if (id === 'talent') {
            this._drawTalentPanel(ctx, L, bodyRect);
        } else if (id === 'inventory') {
            this._drawInventoryPanel(ctx, L, bodyRect, inventory);
        }
    }

    // 3 side-by-side boxed columns — General (every class), Primary (the
    // player's own core class), Secondary (the player's subclass, once
    // chosen) — each a tier-gated browser of src/data/talents.js content,
    // plus a single shared level-tracker margin running the full height of
    // the panel (Diablo2-style), rather than 3 independent trackers:
    // General/Primary's tiers unlock at 1/6/11 but Secondary's don't start
    // until 10 (see tierUnlockLevel in talents.js), so the 3 columns' tier
    // rows don't line up — a shared axis lists every distinct unlock level
    // across all 3 and each column just leaves a level's row blank if it
    // has nothing there, keeping one consistent vertical rhythm instead of
    // 3 unrelated ones. A tile's state ('locked'/'available'/'learned', see
    // _drawTalentTile) is resolved once here and stored on its
    // _talentButtons entry, so every other consumer (drag-start,
    // click-to-learn, right-click Use, hover tooltip) just reads it back via
    // _talentAt instead of recomputing it. Populates this._talentButtons
    // (reset once per render, alongside _actionButtons/_menuButtons).
    _drawTalentPanel(ctx, L, contentRect) {
        const player = this._currentPlayer;
        let y = contentRect.y;

        // Always drawn, even at 0, and always the same height — so gaining
        // or spending a point never shifts the columns below it (a real
        // layout bug this used to have when the line only existed
        // conditionally).
        ctx.fillStyle = player.talentPoints > 0 ? '#6fa8dc' : '#888';
        ctx.font = `${Math.round(12 * L.scale)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(
            `${player.talentPoints} talent point${player.talentPoints === 1 ? '' : 's'} to spend`,
            contentRect.x,
            y + 12 * L.scale
        );
        y += 24 * L.scale;

        const cls = CLASSES[player.classId];
        const subclass = player.subclass ? SUBCLASSES[player.subclass] : null;

        const generalTiers = talentsByTier('general');
        const primaryTiers = talentsByTier('primary', { classId: player.classId });
        const secondaryTiers = player.subclass ? talentsByTier('secondary', { subclassId: player.subclass }) : [];

        const levels = [...new Set([...generalTiers, ...primaryTiers, ...secondaryTiers].map((g) => g.unlockLevel))].sort(
            (a, b) => a - b
        );
        const rowIndexForLevel = new Map(levels.map((level, i) => [level, i]));

        const marginWidth = TALENT_MARGIN_WIDTH * L.scale;
        const gap = TALENT_COLUMN_GAP * L.scale;
        const boxWidth = (contentRect.width - marginWidth - gap * 2) / 3;
        const boxX = (i) => contentRect.x + marginWidth + i * (boxWidth + gap);

        const cellSize = TALENT_CELL_SIZE * L.scale;
        const rowHeight = cellSize + 10 * L.scale;
        const headerHeight = TALENT_HEADER_HEIGHT * L.scale;
        const gridTop = y + headerHeight;
        const gridBottom = gridTop + Math.max(1, levels.length) * rowHeight;
        const rowCenterY = (i) => gridTop + i * rowHeight + rowHeight / 2;

        // Per-level horizontal lines, drawn before anything else so the
        // column boxes (and everything in them) layer on top of them —
        // each one "extends out from the level requirement" in the margin,
        // running the full width behind all 3 talent containers.
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        levels.forEach((level, i) => {
            const lineY = rowCenterY(i);
            ctx.beginPath();
            ctx.moveTo(contentRect.x, lineY);
            ctx.lineTo(boxX(2) + boxWidth, lineY);
            ctx.stroke();
        });

        for (let i = 0; i < 3; i++) {
            this._drawTalentColumnBox(ctx, { x: boxX(i), y, width: boxWidth, height: gridBottom - y });
        }

        // Shared level-tracker margin: a vertical fill track showing the
        // player's exact current level relative to the milestone rows
        // (Grim Dawn-style), plus the "Lv N" label for each row.
        this._drawTalentLevelTrack(ctx, L, contentRect.x, gridTop, gridBottom, levels, rowCenterY, player.level);

        ctx.fillStyle = '#888';
        ctx.font = `bold ${Math.round(11 * L.scale)}px sans-serif`;
        ctx.textAlign = 'left';
        const labelX = contentRect.x + (TALENT_MARGIN_TRACK_WIDTH + 6) * L.scale;
        levels.forEach((level, i) => {
            ctx.fillText(`Lv ${level}`, labelX, rowCenterY(i) + 4 * L.scale);
        });

        const pad = TALENT_BOX_PADDING * L.scale;
        const colX = (i) => boxX(i) + pad;
        const colWidth = boxWidth - pad * 2;

        this._drawTalentColumnHeader(ctx, L, { x: colX(0), y }, 'General', null);
        this._drawTalentColumnHeader(ctx, L, { x: colX(1), y }, 'Primary', cls?.name ?? null);
        this._drawTalentColumnHeader(ctx, L, { x: colX(2), y }, 'Secondary', subclass?.name ?? null);

        this._drawTalentColumnTiers(ctx, L, { x: colX(0), y: gridTop, width: colWidth }, generalTiers, rowIndexForLevel, rowHeight, cellSize);

        if (primaryTiers.length === 0) {
            this._drawTalentColumnPlaceholder(ctx, L, { x: colX(1), width: colWidth }, gridTop, 'No talents yet.');
        } else {
            this._drawTalentColumnTiers(ctx, L, { x: colX(1), y: gridTop, width: colWidth }, primaryTiers, rowIndexForLevel, rowHeight, cellSize);
        }

        if (!player.subclass) {
            this._drawTalentColumnPlaceholder(ctx, L, { x: colX(2), width: colWidth }, gridTop, 'Choose a subclass at level 10.');
        } else if (secondaryTiers.length === 0) {
            this._drawTalentColumnPlaceholder(ctx, L, { x: colX(2), width: colWidth }, gridTop, 'No talents yet.');
        } else {
            this._drawTalentColumnTiers(ctx, L, { x: colX(2), y: gridTop, width: colWidth }, secondaryTiers, rowIndexForLevel, rowHeight, cellSize);
        }
    }

    // The grey background box behind one column (title + tier grid) —
    // restores the look the original 3-placeholder-box talent panel had
    // before this session's tier content replaced it, matching the
    // reference "one bordered box per tree" layout.
    _drawTalentColumnBox(ctx, rect) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeStyle = '#3a3a3a';
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }

    // A dim background bar the full height of the row grid, filled from the
    // top down to the player's current level — Grim Dawn-style. The fill
    // boundary is piecewise-linear between whichever two milestone rows
    // bracket the player's level, interpolated by rank/row-index (matching
    // how the rows themselves are evenly spaced regardless of the raw level
    // gap between adjacent milestones), so the fill sits exactly on a row's
    // center line whenever the player is exactly at that milestone level —
    // e.g. level 8 (between the Lv 6 and Lv 11 rows) sits proportionally
    // between their two center lines, not snapped to either.
    _drawTalentLevelTrack(ctx, L, x, top, bottom, levels, rowCenterY, playerLevel) {
        const width = TALENT_MARGIN_TRACK_WIDTH * L.scale;

        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x, top, width, bottom - top);

        let lo = 0;
        while (lo < levels.length - 1 && levels[lo + 1] <= playerLevel) lo++;
        const hi = Math.min(lo + 1, levels.length - 1);
        const fraction = hi > lo ? Math.min(1, Math.max(0, (playerLevel - levels[lo]) / (levels[hi] - levels[lo]))) : 0;
        const fillY = rowCenterY(lo) + fraction * (rowCenterY(hi) - rowCenterY(lo));

        ctx.fillStyle = '#6fa8dc';
        ctx.fillRect(x, top, width, fillY - top);

        ctx.beginPath();
        ctx.arc(x + width / 2, fillY, 4 * L.scale, 0, Math.PI * 2);
        ctx.fillStyle = '#bfe0ff';
        ctx.fill();
    }

    // One category's tiles, placed by the shared row-index map rather than
    // stacked sequentially — `rowIndexForLevel` (built once in
    // _drawTalentPanel from the union of all 3 columns' unlock levels) is
    // what keeps General/Primary/Secondary's rows aligned to the one shared
    // margin axis instead of each column free-flowing at its own pace. No
    // "Tier N" label is drawn — the level itself is already shown once in
    // the shared margin. Each tier's talents are space-evenly distributed:
    // the gap is derived from the leftover width (`(rect.width - n*cellSize)
    // / (n+1)`) so container-edge-to-tile1, tile-to-tile, and
    // tileN-to-container-edge all come out to the exact same gap — e.g. at
    // n=3, tile 1 sits equidistant between the container's left edge and
    // tile 2's edge, and tile 3 mirrors it on the right, which is what
    // pins the center tile exactly in the middle. A fixed/hardcoded gap
    // (an earlier version of this) doesn't have that property — the edge
    // margins come out as whatever's left over, not tied to the same gap.
    // This assumes a tier's talents fit in one row (true for all authored
    // content today, see talents.js) — a tier with more talents than
    // comfortably fit this way would need real wrapping, not handled here.
    _drawTalentColumnTiers(ctx, L, rect, tierGroups, rowIndexForLevel, rowHeight, cellSize) {
        for (const group of tierGroups) {
            const rowY = rect.y + rowIndexForLevel.get(group.unlockLevel) * rowHeight;
            const tileY = rowY + (rowHeight - cellSize) / 2;
            const n = group.talents.length;
            const gap = (rect.width - n * cellSize) / (n + 1);

            group.talents.forEach((talent, i) => {
                const x = rect.x + gap * (i + 1) + cellSize * i;

                const state = this._currentPlayer.talents.includes(talent.id)
                    ? 'learned'
                    : this._currentPlayer.level >= group.unlockLevel
                      ? 'available'
                      : 'locked';
                this._talentButtons.push({ talentId: talent.id, x, y: tileY, width: cellSize, height: cellSize, state });
                this._drawTalentTile(ctx, L, x, tileY, cellSize, talent, state);
            });
        }
    }

    _drawTalentColumnHeader(ctx, L, rect, title, subtitle) {
        ctx.fillStyle = '#e0e0e0';
        ctx.font = `bold ${Math.round(13 * L.scale)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(title, rect.x, rect.y + 14 * L.scale);

        if (!subtitle) return rect.y + 22 * L.scale;

        ctx.fillStyle = '#888';
        ctx.font = `${Math.round(11 * L.scale)}px sans-serif`;
        ctx.fillText(subtitle, rect.x, rect.y + 30 * L.scale);
        return rect.y + 38 * L.scale;
    }

    _drawTalentColumnPlaceholder(ctx, L, rect, y, message) {
        ctx.fillStyle = '#666';
        ctx.font = `${Math.round(12 * L.scale)}px sans-serif`;
        ctx.textAlign = 'left';
        wrapText(ctx, message, rect.x, y + 12 * L.scale, rect.width, 15 * L.scale, 'left');
    }

    // The 3 interaction states a talent tile can be in: 'locked' (level not
    // reached — dimmed, not clickable), 'available' (unlocked, not yet
    // learned — gold outline, click spends a talent point to learn it
    // permanently), 'learned' (already in player.talents — normal full
    // color, draggable onto the action bar exactly like before this feature
    // existed, zero regression there). Shape signals kind, not state:
    // 'active' talents (have a `use`) draw square, 'passive' ones (always-on
    // once learned, no `use`, not draggable/usable — see hud.js's other
    // talent.kind checks) draw circular.
    _drawTalentTile(ctx, L, x, y, size, talent, state) {
        ctx.globalAlpha = state === 'locked' ? 0.35 : 1;

        ctx.fillStyle = talent.color;
        ctx.strokeStyle = state === 'available' ? '#c9a227' : '#e0e0e0';
        ctx.lineWidth = state === 'available' ? 2 : 1;
        if (talent.kind === 'passive') {
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else {
            ctx.fillRect(x, y, size, size);
            ctx.strokeRect(x, y, size, size);
        }
        ctx.lineWidth = 1;

        ctx.fillStyle = '#111';
        ctx.font = `bold ${Math.round(11 * L.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(talent.label, x + size / 2, y + size / 2 + 4 * L.scale);

        ctx.globalAlpha = 1;
    }

    _drawInventoryPanel(ctx, L, contentRect, inventory) {
        this._inventoryGridOrigin = { x: contentRect.x, y: contentRect.y };
        drawInventoryGrid(ctx, inventory, contentRect.x, contentRect.y, L.scale);
    }

    _drawOrb(ctx, L, centerX, centerY, resource, darkColor, fillColor) {
        const r = L.orbRadius;
        const fillRatio = resource.max > 0 ? resource.current / resource.max : 0;

        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, r - 3, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = darkColor;
        ctx.fillRect(centerX - r, centerY - r, r * 2, r * 2);
        const fillHeight = (r - 3) * 2 * fillRatio;
        ctx.fillStyle = fillColor;
        ctx.fillRect(centerX - r, centerY + (r - 3) - fillHeight, r * 2, fillHeight);
        ctx.restore();

        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#f0f0f0';
        ctx.font = `bold ${Math.round(13 * L.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${resource.current}/${resource.max}`, centerX, centerY + 4 * L.scale);
    }

    // `index` is 0-based (player.actionBar's own indexing); the drawn label
    // is index+1 to match the 1-6 keys that trigger the same slot. An
    // assigned item/talent is drawn dimmed (not omitted) when currently
    // unavailable (a fully-consumed item stack) — see _resolveActionSlotVisual.
    _drawActionSlot(ctx, L, x, y, index) {
        const rect = { x, y, width: L.actionSize, height: L.actionSize, index };
        this._actionButtons.push(rect);

        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(x, y, L.actionSize, L.actionSize);

        const visual = this._resolveActionSlotVisual(this._currentPlayer?.actionBar[index]);
        if (visual) {
            ctx.globalAlpha = visual.available ? 1 : 0.35;
            ctx.fillStyle = visual.item.itemType.color;
            ctx.fillRect(x + 2 * L.scale, y + 2 * L.scale, L.actionSize - 4 * L.scale, L.actionSize - 4 * L.scale);
            ctx.fillStyle = '#111';
            ctx.font = `bold ${Math.round(12 * L.scale)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(visual.item.itemType.label, x + L.actionSize / 2, y + L.actionSize / 2 + 4 * L.scale);

            // Use-count badge — items only (talents have quantity:null, per
            // the user's explicit "not talents"), same visual convention as
            // the inventory grid's own stack-quantity badge. Drawn inside
            // the dim block on purpose: a depleted stack shows a dimmed "0"
            // rather than nothing, which is more informative about *why*
            // the slot is greyed out.
            if (visual.quantity != null) {
                ctx.fillStyle = '#fff';
                ctx.font = `bold ${Math.round(10 * L.scale)}px sans-serif`;
                ctx.textAlign = 'right';
                ctx.fillText(String(visual.quantity), x + L.actionSize - 3 * L.scale, y + L.actionSize - 3 * L.scale);
            }

            ctx.globalAlpha = 1;
        }

        ctx.strokeStyle = '#4a4a4a';
        ctx.strokeRect(x, y, L.actionSize, L.actionSize);

        ctx.fillStyle = '#555';
        ctx.font = `${Math.round(11 * L.scale)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(String(index + 1), x + 3 * L.scale, y + L.actionSize - 4 * L.scale);
    }

    _drawXpBar(ctx, L, x, y, width, xp) {
        const fillRatio = xp.max > 0 ? Math.min(1, xp.current / xp.max) : 0;

        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(x, y, width, L.xpBarHeight);
        ctx.fillStyle = '#c9a227';
        ctx.fillRect(x, y, width * fillRatio, L.xpBarHeight);
        ctx.strokeStyle = '#4a4a4a';
        ctx.strokeRect(x, y, width, L.xpBarHeight);

        ctx.fillStyle = '#f0f0f0';
        ctx.font = `${Math.round(10 * L.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`XP ${xp.current}/${xp.max}`, x + width / 2, y + L.xpBarHeight - 4 * L.scale);
    }

    _drawMenuButton(ctx, L, x, y, id) {
        const { letter } = MENU_ITEMS[id];
        const active = this.leftPanel === id || this.rightPanel === id;
        const rect = { x, y, width: L.menuSize, height: L.menuSize, id };
        this._menuButtons.push(rect);

        ctx.fillStyle = active ? '#2f4f7a' : '#242424';
        ctx.fillRect(x, y, L.menuSize, L.menuSize);
        ctx.strokeStyle = active ? '#6fa8dc' : '#555';
        ctx.strokeRect(x, y, L.menuSize, L.menuSize);

        ctx.fillStyle = '#e0e0e0';
        ctx.font = `bold ${Math.round(15 * L.scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(letter, x + L.menuSize / 2, y + L.menuSize / 2 + 5 * L.scale);
    }

    _hit(rect, x, y) {
        return !!rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }
}
