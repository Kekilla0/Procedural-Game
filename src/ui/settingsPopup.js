import { Popup } from './popup.js';
import { settings, saveSettings } from '../state/settings.js';

const CHECKBOX_SIZE = 18;
const ROW_HEIGHT = 30;
const DEBUG_INDENT = 24;
const EXIT_BUTTON_HEIGHT = 40;
const EXIT_BLOCK_HEIGHT = EXIT_BUTTON_HEIGHT + 16;

// Settings panel. Pass { showExitButton: true } when opening it from in-game
// (adds an "Exit to Title" button) — the title screen opens it without that option.
//
// "Debug mode" reveals indented debug-only sub-options (currently: isometric
// view, coordinate HUD) below it — this is the only place they're reachable,
// there's no separate debug screen/button.
export class SettingsPopup extends Popup {
    constructor({ showExitButton = false } = {}) {
        super({ title: 'Settings', width: 360, height: 200 });
        this.showExitButton = showExitButton;
    }

    render(ctx, canvasWidth, canvasHeight) {
        const rowCount = settings.debug ? 3 : 1;
        this.height = 76 + rowCount * ROW_HEIGHT + (this.showExitButton ? EXIT_BLOCK_HEIGHT : 0);
        super.render(ctx, canvasWidth, canvasHeight);
    }

    renderBody(ctx, bodyRect) {
        this._checkboxRect = { x: bodyRect.x, y: bodyRect.y, width: CHECKBOX_SIZE, height: CHECKBOX_SIZE };
        this._drawCheckbox(ctx, this._checkboxRect, settings.debug, 'Debug mode');

        this._isoRect = null;
        this._coordsRect = null;

        if (settings.debug) {
            this._isoRect = {
                x: bodyRect.x + DEBUG_INDENT,
                y: bodyRect.y + ROW_HEIGHT,
                width: CHECKBOX_SIZE,
                height: CHECKBOX_SIZE,
            };
            this._drawCheckbox(ctx, this._isoRect, settings.isometric, 'Isometric view');

            this._coordsRect = {
                x: bodyRect.x + DEBUG_INDENT,
                y: bodyRect.y + ROW_HEIGHT * 2,
                width: CHECKBOX_SIZE,
                height: CHECKBOX_SIZE,
            };
            this._drawCheckbox(ctx, this._coordsRect, settings.showCoords, 'Show coordinates');
        }

        if (this.showExitButton) {
            this._exitRect = {
                x: bodyRect.x,
                y: bodyRect.y + bodyRect.height - EXIT_BUTTON_HEIGHT,
                width: bodyRect.width,
                height: EXIT_BUTTON_HEIGHT,
            };
            ctx.fillStyle = '#3a1f1f';
            ctx.fillRect(this._exitRect.x, this._exitRect.y, this._exitRect.width, this._exitRect.height);
            ctx.strokeStyle = '#7a3f3f';
            ctx.strokeRect(this._exitRect.x, this._exitRect.y, this._exitRect.width, this._exitRect.height);
            ctx.fillStyle = '#e0b0b0';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
                'Exit to Title',
                this._exitRect.x + this._exitRect.width / 2,
                this._exitRect.y + this._exitRect.height / 2 + 5
            );
        }
    }

    _drawCheckbox(ctx, rect, checked, label) {
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
        ctx.strokeRect(rect.x, rect.y, CHECKBOX_SIZE, CHECKBOX_SIZE);
        if (checked) {
            ctx.fillStyle = '#4a90d9';
            ctx.fillRect(rect.x + 3, rect.y + 3, CHECKBOX_SIZE - 6, CHECKBOX_SIZE - 6);
        }

        ctx.fillStyle = '#e0e0e0';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, rect.x + CHECKBOX_SIZE + 10, rect.y + CHECKBOX_SIZE - 3);
    }

    onBodyClick(x, y, bodyRect, manager) {
        if (this._hit(this._checkboxRect, x, y)) {
            settings.debug = !settings.debug;
            saveSettings();
            return;
        }
        if (this._hit(this._isoRect, x, y)) {
            settings.isometric = !settings.isometric;
            saveSettings();
            return;
        }
        if (this._hit(this._coordsRect, x, y)) {
            settings.showCoords = !settings.showCoords;
            saveSettings();
            return;
        }
        if (this.showExitButton && this._hit(this._exitRect, x, y)) {
            manager.switchTo('title');
        }
    }
}
