import { SettingsPopup } from '../ui/settingsPopup.js';
import { ClassSelectPopup } from '../ui/classSelectPopup.js';
import { hasSaveGame } from '../state/gameSave.js';
import { settings } from '../state/settings.js';

const BUTTON_WIDTH = 220;
const BUTTON_HEIGHT = 44;
const BUTTON_GAP = 16;

// First screen shown on load: Continue / New Game / Settings.
// Debug tools live inside the Settings popup itself (indented sub-options
// under "Debug mode"), not as a separate button here.
export class TitleScreen {
    constructor(manager) {
        this.manager = manager;
        this.buttons = []; // recomputed each render; hit-tested in onClick
    }

    // Re-check for a save every time we arrive at the title screen (e.g. after
    // "Exit to Title"), not just once at startup.
    onEnter() {
        this.hasSave = hasSaveGame();

        // Debug convenience: skip straight past the title screen. Applies on
        // every arrival here, so it also fires right back into the game after
        // "Exit to Title" — that's intentional for rapid dev iteration.
        if (settings.debug && settings.autoContinue && this.hasSave) {
            this.manager.getScreen('viewport').loadGame();
            this.manager.switchTo('viewport');
        }
    }

    onClick(x, y) {
        const hit = this.buttons.find(
            (b) => !b.disabled && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height
        );
        if (!hit) return;

        if (hit.id === 'newGame') {
            this.manager.openPopup(
                new ClassSelectPopup({
                    onSelect: (classId) => {
                        this.manager.getScreen('viewport').startNewGame(classId);
                        this.manager.switchTo('viewport');
                    },
                })
            );
        }
        if (hit.id === 'continue') {
            this.manager.getScreen('viewport').loadGame();
            this.manager.switchTo('viewport');
        }
        if (hit.id === 'settings') this.manager.openPopup(new SettingsPopup());
    }

    render(ctx, width, height) {
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, width, height);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#e0e0e0';
        ctx.font = 'bold 48px sans-serif';
        ctx.fillText('Procedural Game', width / 2, height / 2 - 100);

        const startX = width / 2 - BUTTON_WIDTH / 2;
        const startY = height / 2 - 20;

        const buttonDefs = [
            { id: 'continue', label: 'Continue', disabled: !this.hasSave },
            { id: 'newGame', label: 'New Game' },
            { id: 'settings', label: 'Settings' },
        ];

        this.buttons = [];
        buttonDefs.forEach((def, i) => {
            this._drawButton(ctx, {
                ...def,
                x: startX,
                y: startY + i * (BUTTON_HEIGHT + BUTTON_GAP),
                width: BUTTON_WIDTH,
                height: BUTTON_HEIGHT,
            });
        });
    }

    _drawButton(ctx, button) {
        this.buttons.push(button);

        ctx.fillStyle = button.disabled ? '#161616' : '#242424';
        ctx.fillRect(button.x, button.y, button.width, button.height);
        ctx.strokeStyle = button.disabled ? '#2a2a2a' : '#555';
        ctx.strokeRect(button.x, button.y, button.width, button.height);

        ctx.fillStyle = button.disabled ? '#4a4a4a' : '#e0e0e0';
        ctx.font = '18px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(button.label, button.x + button.width / 2, button.y + button.height / 2 + 6);
    }
}
