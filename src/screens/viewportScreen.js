import { SettingsPopup } from '../ui/settingsPopup.js';
import { settings } from '../state/settings.js';
import { loadSaveGame, saveGameState } from '../state/gameSave.js';
import { TILE_SIZE, ISO_HALF_WIDTH, ISO_HALF_HEIGHT, topDownProject, isoProject, isoUnproject } from '../utils/projection.js';

const MOVE_SPEED = 6; // tiles per second
const STEP_DURATION = 1 / MOVE_SPEED;
const VIEWPORT_MARGIN = 10;
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

        this.player = { col: 0, row: 0 }; // settled tile (always integer)
        this.visual = { col: 0, row: 0 }; // interpolated render position
        this.moving = false;
        this.moveFrom = { col: 0, row: 0 };
        this.moveTo = { col: 0, row: 0 };
        this.moveT = 0;

        this.cogRect = null;
    }

    startNewGame() {
        this.player = { col: 0, row: 0 };
        this.visual = { col: 0, row: 0 };
        this.moving = false;
        this._persist();
    }

    loadGame() {
        const saved = loadSaveGame();
        const col = saved?.player?.col ?? 0;
        const row = saved?.player?.row ?? 0;
        this.player = { col, row };
        this.visual = { col, row };
        this.moving = false;
    }

    _persist() {
        saveGameState({ player: { col: this.player.col, row: this.player.row } });
    }

    onClick(x, y) {
        if (this._hit(this.cogRect, x, y)) {
            this.manager.openPopup(new SettingsPopup({ showExitButton: true }));
        }
    }

    onKeyDown(key) {
        if (key === 'Escape') {
            this.manager.openPopup(new SettingsPopup({ showExitButton: true }));
            return;
        }
        this.keysDown.add(key.toLowerCase());
    }

    onKeyUp(key) {
        this.keysDown.delete(key.toLowerCase());
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
            this.moveFrom = { col: this.player.col, row: this.player.row };
            this.moveTo = { col: this.player.col + dx, row: this.player.row + dy };
            this.moveT = 0;
            this.moving = true;
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
        ctx.fillText(`col: ${this.player.col}  row: ${this.player.row}`, left + 8, top + 18);
    }

    _renderTopDown(ctx, left, top, viewWidth, viewHeight, centerX, centerY) {
        const playerScreen = topDownProject(this.visual.col, this.visual.row);
        const originX = centerX - playerScreen.x;
        const originY = centerY - playerScreen.y;

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

        const size = TILE_SIZE * 0.6;
        ctx.fillStyle = '#4a90d9';
        ctx.fillRect(centerX - size / 2, centerY - size / 2, size, size);
    }

    _renderIsometric(ctx, left, top, viewWidth, viewHeight, centerX, centerY) {
        const playerScreen = isoProject(this.visual.col, this.visual.row);
        const originX = centerX - playerScreen.x;
        const originY = centerY - playerScreen.y;

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
                this._strokeIsoDiamond(ctx, originX + tile.x, originY + tile.y, ISO_HALF_WIDTH, ISO_HALF_HEIGHT);
            }
        }

        this._strokeIsoDiamond(ctx, centerX, centerY, ISO_HALF_WIDTH * 0.5, ISO_HALF_HEIGHT * 0.5, '#4a90d9');
    }

    _strokeIsoDiamond(ctx, x, y, halfWidth, halfHeight, fillColor) {
        ctx.beginPath();
        ctx.moveTo(x, y - halfHeight);
        ctx.lineTo(x + halfWidth, y);
        ctx.lineTo(x, y + halfHeight);
        ctx.lineTo(x - halfWidth, y);
        ctx.closePath();
        if (fillColor) {
            ctx.fillStyle = fillColor;
            ctx.fill();
        } else {
            ctx.stroke();
        }
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
