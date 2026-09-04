import { SettingsPopup } from '../ui/settingsPopup.js';
import { SubclassSelectPopup } from '../ui/subclassSelectPopup.js';
import { ArmorSpawnPopup } from '../ui/armorSpawnPopup.js';
import { Hud } from '../ui/hud.js';
import { itemTypeForSlot } from '../data/armorTypes.js';
import { settings } from '../state/settings.js';
import { loadSaveGame, saveGameState } from '../state/gameSave.js';
import { TILE_SIZE, ISO_HALF_WIDTH, ISO_HALF_HEIGHT, topDownProject, isoProject, isoUnproject } from '../utils/projection.js';
import { createTestLevel } from '../world/testLevel.js';
import { canMoveTo } from '../world/collision.js';
import { interactNear, interactAtClick } from '../world/interact.js';
import { drawWalls, drawEntities, drawCollisionDebugOverlay, drawIsoDiamond } from '../world/levelRenderer.js';
import { Player } from '../player/player.js';
import { syncHealthFromAttributes, syncEnergyFromAttributes, syncCarryCapacityFromAttributes } from '../player/stats.js';
import { CLASSES } from '../data/classes.js';
import { useActionSlot } from '../player/actionBar.js';

const MOVE_SPEED = 6; // tiles per second
const STEP_DURATION = 1 / MOVE_SPEED;
const VIEWPORT_MARGIN = 10;
const DEFAULT_PLAYER_COLOR = '#4a90d9'; // no class chosen yet (shouldn't normally happen via the UI)
const COG_SIZE = 32;

// Game viewport: a scrolling grid with a movable square standing in for the
// player. Renders either top-down or isometric depending on settings.isometric
// (toggled from the Debug popup) — everything else (movement, camera-follow,
// input) is shared between the two, only the col/row -> screen projection differs.
//
// Movement is grid-locked: the player always occupies the exact center of a
// tile. A key press steps it to the neighboring tile center over STEP_DURATION;
// it is never left part-way between tiles under direct player control.
export class ViewportScreen {
    constructor(manager) {
        this.manager = manager;
        this.keysDown = new Set();

        this.player = new Player(); // everything true about the player: position, class, inventory, equipment, resources
        this.visual = { col: 0, row: 0 }; // interpolated render position
        this.moving = false;
        this.moveFrom = { col: 0, row: 0 };
        this.moveTo = { col: 0, row: 0 };
        this.moveT = 0;

        this.cogRect = null;
        this.hud = new Hud();
        this.level = createTestLevel();

        this._openContainer = (entity) => {
            this.hud.openContainer(entity);
        };

        // Debug-only testing aid (Settings -> "Test stat"): bumps the chosen
        // base attribute by 1 with no stat-point cost, then resyncs
        // everything that attribute can drive (mirrors CharacterPanel.onClick's
        // own sync calls after a real stat spend) — or, for the 'level'
        // option, grants a level (+1 stat point, +1 talent point) exactly
        // like a real level-up would, since there's no real XP/combat system
        // granting these yet. This is the ONE place a level is granted
        // anywhere in the app — the Talent panel's tier-gating (see
        // src/data/talents.js's tierUnlockLevel) reads player.level directly,
        // so a debug level grant unlocks tiers exactly like a real one would.
        this._debugIncrementStat = (statKey) => {
            if (statKey === 'level') {
                this.player.level += 1;
                this.player.statPoints += 1;
                this.player.talentPoints += 1;
                syncHealthFromAttributes(this.player); // Health grows a little from level alone now, independent of stat spending
            } else {
                this.player.attributes[statKey] += 1;
                syncHealthFromAttributes(this.player);
                syncEnergyFromAttributes(this.player);
                syncCarryCapacityFromAttributes(this.player, this.level);
            }
            this._persist();
        };

        // Debug-only testing aid (Settings -> "Grant talent"): grants any
        // talent for free, bypassing tier/level-gating and talent-point cost
        // entirely — the real, in-game path is spending a point on an
        // unlocked talent directly in the Talent panel (see hud.js).
        this._debugGrantTalent = (talentId) => {
            if (this.player.talents.includes(talentId)) return;
            this.player.talents.push(talentId);
            this._persist();
        };

        // Debug-only testing aid (Settings -> "Spawn Armor"): opens
        // ArmorSpawnPopup, which rolls one armor piece (any of the 8 slots)
        // of the chosen type + rarity and drops it straight into the
        // inventory — the real, in-game path (a proper loot table) doesn't
        // exist yet, this is a testing shortcut for the procedural armor
        // system itself (see src/data/armorTypes.js/armorSlots.js/rarities.js).
        this._openArmorSpawner = () => {
            this.manager.openPopup(
                new ArmorSpawnPopup({
                    onSpawn: (armorData) => {
                        this.player.inventory.addItem(itemTypeForSlot(armorData.slotId), 1, armorData);
                        this._persist();
                    },
                })
            );
        };
    }

    _openSettings() {
        this.manager.openPopup(
            new SettingsPopup({
                showExitButton: true,
                onDebugStatIncrement: this._debugIncrementStat,
                onDebugGrantTalent: this._debugGrantTalent,
                onOpenArmorSpawner: this._openArmorSpawner,
            })
        );
    }

    // Fires every time the viewport becomes the active screen (New Game,
    // Continue, auto-continue, or re-entering after "Exit to Title") — debug
    // convenience to jump straight to a HUD panel instead of clicking it open.
    onEnter() {
        if (settings.debug && settings.autoOpenMenu !== 'none') {
            this.hud.openMenu(settings.autoOpenMenu);
        }
    }

    startNewGame(classId) {
        this.player = new Player();
        this.player.classId = classId;
        this.visual = { col: 0, row: 0 };
        this.moving = false;
        this._persist();
    }

    loadGame() {
        const saved = loadSaveGame();
        this.player = Player.deserialize(saved?.player);
        this.visual = { col: this.player.col, row: this.player.row };
        this.moving = false;
    }

    _persist() {
        saveGameState({ player: this.player.serialize() });
    }

    onClick(x, y) {
        if (this._hit(this.cogRect, x, y)) {
            this._openSettings();
            return;
        }
        if (this.hud.onClick(x, y, this.player, this.level)) {
            this._persist(); // covers hud-driven mutations: container loot/loot-all, context-menu delete/equip
            if (this.hud.consumeSubclassPromptRequest()) {
                this.manager.openPopup(
                    new SubclassSelectPopup({
                        player: this.player,
                        onSelect: (subclassId) => {
                            this.player.subclass = subclassId;
                            this._persist();
                        },
                    })
                );
            }
            return;
        }
        if (this._worldOrigin) {
            interactAtClick(
                this.level,
                this.player,
                this._worldIsometric,
                this._worldOrigin.x,
                this._worldOrigin.y,
                x,
                y,
                this.player.inventory,
                this._openContainer
            );
            this._persist(); // covers looting a ground item/container by clicking it in the world
        }
    }

    onKeyDown(key) {
        if (key === 'Escape') {
            this._openSettings();
            return;
        }

        const normalized = key.toLowerCase();
        if (normalized === 'e') {
            if (!this.keysDown.has('e')) {
                interactNear(this.level, this.player.col, this.player.row, this.player.inventory, this._openContainer);
                this._persist(); // covers looting via 'E'
            }
            this.keysDown.add('e');
            return;
        }

        const digit = Number(normalized);
        if (Number.isInteger(digit) && digit >= 1 && digit <= 6) {
            if (!this.keysDown.has(normalized)) {
                useActionSlot(this.player, digit - 1);
                this._persist(); // covers a potion consumed / talent used via 1-6
            }
            this.keysDown.add(normalized);
            return;
        }

        const { keybinds } = settings;
        const menuId =
            normalized === keybinds.character ? 'character' : normalized === keybinds.talent ? 'talent' : normalized === keybinds.inventory ? 'inventory' : null;
        if (menuId) {
            if (!this.keysDown.has(normalized)) this.hud.toggleMenu(menuId);
            this.keysDown.add(normalized);
            return;
        }

        this.keysDown.add(normalized);
    }

    onKeyUp(key) {
        this.keysDown.delete(key.toLowerCase());
    }

    onWheel(deltaY, x, y) {
        this.hud.onWheel(deltaY, x, y);
    }

    onContextMenu(x, y) {
        this.hud.onContextMenu(x, y, this.player, this.level);
    }

    onMouseDown(x, y) {
        this.hud.onMouseDown(x, y, this.player);
    }

    onMouseMove(x, y) {
        this.hud.onMouseMove(x, y);
    }

    onMouseUp(x, y) {
        this.hud.onMouseUp(x, y, this.player, this.level);
        this._persist(); // covers drag-and-drop mutations: equip/unequip/swap/transfer
    }

    update(dt) {
        if (this.moving) {
            this.moveT = Math.min(1, this.moveT + dt / STEP_DURATION);
            this.visual.col = this.moveFrom.col + (this.moveTo.col - this.moveFrom.col) * this.moveT;
            this.visual.row = this.moveFrom.row + (this.moveTo.row - this.moveFrom.row) * this.moveT;

            if (this.moveT >= 1) {
                this.player.col = this.moveTo.col;
                this.player.row = this.moveTo.row;
                this.moving = false;
                this._persist();
            }
            return;
        }

        let dx = 0;
        let dy = 0;
        if (this.keysDown.has('w') || this.keysDown.has('arrowup')) dy -= 1;
        if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) dy += 1;
        if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) dx -= 1;
        if (this.keysDown.has('d') || this.keysDown.has('arrowright')) dx += 1;

        if (dx !== 0 || dy !== 0) {
            const targetCol = this.player.col + dx;
            const targetRow = this.player.row + dy;
            if (canMoveTo(this.level, this.player.col, this.player.row, targetCol, targetRow)) {
                this.moveFrom = { col: this.player.col, row: this.player.row };
                this.moveTo = { col: targetCol, row: targetRow };
                this.moveT = 0;
                this.moving = true;
            }
        }
    }

    render(ctx, width, height) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        const innerX = VIEWPORT_MARGIN;
        const innerY = VIEWPORT_MARGIN;
        const innerWidth = width - VIEWPORT_MARGIN * 2;
        const innerHeight = height - VIEWPORT_MARGIN * 2;
        const centerX = innerX + innerWidth / 2;
        const centerY = innerY + innerHeight / 2;

        ctx.save();
        ctx.beginPath();
        ctx.rect(innerX, innerY, innerWidth, innerHeight);
        ctx.clip();

        ctx.fillStyle = '#141414';
        ctx.fillRect(innerX, innerY, innerWidth, innerHeight);

        if (settings.isometric) {
            this._renderIsometric(ctx, innerX, innerY, innerWidth, innerHeight, centerX, centerY);
        } else {
            this._renderTopDown(ctx, innerX, innerY, innerWidth, innerHeight, centerX, centerY);
        }

        ctx.restore();

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.strokeRect(innerX, innerY, innerWidth, innerHeight);

        this._drawCogButton(ctx, width);
        this._drawDebugHud(ctx, innerX, innerY);
        this.hud.render(ctx, innerX, innerY, innerWidth, innerHeight, this.player);
    }

    // Grid position readout — the camera always recenters the player on screen,
    // so without this there's no visible way to tell where you actually are
    // (useful for confirming save/load actually persisted a position). Toggled
    // via "Show coordinates" under Debug mode in the Settings popup.
    _drawDebugHud(ctx, left, top) {
        if (!settings.debug || !settings.showCoords) return;

        ctx.fillStyle = '#8f8';
        ctx.font = '13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`col: ${this.player.col}  row: ${this.player.row}  class: ${this.player.classId ?? '—'}`, left + 8, top + 18);
    }

    _renderTopDown(ctx, left, top, viewWidth, viewHeight, centerX, centerY) {
        const playerScreen = topDownProject(this.visual.col, this.visual.row);
        const originX = centerX - playerScreen.x;
        const originY = centerY - playerScreen.y;
        this._worldOrigin = { x: originX, y: originY };
        this._worldIsometric = false;

        // Grid lines are tile *boundaries*, offset half a tile from the integer
        // col/row positions that tile centers (and the player) sit on.
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;

        const firstCol = Math.floor((left - originX) / TILE_SIZE) - 1;
        const lastCol = Math.ceil((left + viewWidth - originX) / TILE_SIZE) + 1;
        const firstRow = Math.floor((top - originY) / TILE_SIZE) - 1;
        const lastRow = Math.ceil((top + viewHeight - originY) / TILE_SIZE) + 1;

        for (let col = firstCol; col <= lastCol; col++) {
            const x = originX + (col + 0.5) * TILE_SIZE;
            ctx.beginPath();
            ctx.moveTo(x, top);
            ctx.lineTo(x, top + viewHeight);
            ctx.stroke();
        }
        for (let row = firstRow; row <= lastRow; row++) {
            const y = originY + (row + 0.5) * TILE_SIZE;
            ctx.beginPath();
            ctx.moveTo(left, y);
            ctx.lineTo(left + viewWidth, y);
            ctx.stroke();
        }

        drawWalls(ctx, this.level, false, originX, originY);
        drawEntities(ctx, this.level, false, originX, originY);
        if (settings.debug && settings.showCollision) {
            drawCollisionDebugOverlay(ctx, this.level, false, this.player, originX, originY);
        }

        const size = TILE_SIZE * 0.6;
        ctx.fillStyle = CLASSES[this.player.classId]?.color ?? DEFAULT_PLAYER_COLOR;
        ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size);
    }

    _renderIsometric(ctx, left, top, viewWidth, viewHeight, centerX, centerY) {
        const playerScreen = isoProject(this.visual.col, this.visual.row);
        const originX = centerX - playerScreen.x;
        const originY = centerY - playerScreen.y;
        this._worldOrigin = { x: originX, y: originY };
        this._worldIsometric = true;

        // Only the col/row range actually covering the viewport gets drawn —
        // find it by unprojecting the four corners of the inner viewport rect.
        const corners = [
            isoUnproject(left, top, originX, originY),
            isoUnproject(left + viewWidth, top, originX, originY),
            isoUnproject(left, top + viewHeight, originX, originY),
            isoUnproject(left + viewWidth, top + viewHeight, originX, originY),
        ];
        const minCol = Math.floor(Math.min(...corners.map((c) => c.col))) - 1;
        const maxCol = Math.ceil(Math.max(...corners.map((c) => c.col))) + 1;
        const minRow = Math.floor(Math.min(...corners.map((c) => c.row))) - 1;
        const maxRow = Math.ceil(Math.max(...corners.map((c) => c.row))) + 1;

        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = 1;
        for (let col = minCol; col <= maxCol; col++) {
            for (let row = minRow; row <= maxRow; row++) {
                const tile = isoProject(col, row);
                drawIsoDiamond(ctx, originX + tile.x, originY + tile.y, ISO_HALF_WIDTH, ISO_HALF_HEIGHT);
            }
        }

        drawWalls(ctx, this.level, true, originX, originY);
        drawEntities(ctx, this.level, true, originX, originY);
        if (settings.debug && settings.showCollision) {
            drawCollisionDebugOverlay(ctx, this.level, true, this.player, originX, originY);
        }

        drawIsoDiamond(ctx, centerX, centerY, ISO_HALF_WIDTH * 0.5, ISO_HALF_HEIGHT * 0.5, CLASSES[this.player.classId]?.color ?? DEFAULT_PLAYER_COLOR);
    }

    _drawCogButton(ctx, width) {
        const x = width - VIEWPORT_MARGIN - COG_SIZE - 6;
        const y = VIEWPORT_MARGIN + 6;
        this.cogRect = { x, y, width: COG_SIZE, height: COG_SIZE };

        ctx.fillStyle = '#242424';
        ctx.fillRect(x, y, COG_SIZE, COG_SIZE);
        ctx.strokeStyle = '#555';
        ctx.strokeRect(x, y, COG_SIZE, COG_SIZE);

        ctx.fillStyle = '#e0e0e0';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚙', x + COG_SIZE / 2, y + COG_SIZE / 2 + 6);
    }

    _hit(rect, x, y) {
        return !!rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }
}
