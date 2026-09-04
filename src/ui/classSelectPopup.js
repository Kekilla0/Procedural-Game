import { Popup } from './popup.js';
import { CLASSES } from '../data/classes.js';
import { wrapText } from './textWrap.js';

const CARD_WIDTH = 200;
const CARD_HEIGHT = 260;
const CARD_GAP = 20;
const SWATCH_SIZE = 56;
const POPUP_WIDTH = CARD_WIDTH * 3 + CARD_GAP * 2 + 40;
const POPUP_HEIGHT = 420;

// Replaces the old full-screen ClassSelectScreen — same three cards/choices,
// now a popup (opened from TitleScreen's "New Game") instead of its own
// screen, so it behaves like every other transient chrome in the game
// (Escape/click-outside closes it, no dedicated screen registration needed).
export class ClassSelectPopup extends Popup {
    constructor({ onSelect }) {
        super({ title: 'Choose Your Class', width: POPUP_WIDTH, height: POPUP_HEIGHT });
        this.onSelect = onSelect;
        this._cardRects = [];
    }

    renderBody(ctx, bodyRect) {
        const classes = Object.values(CLASSES);
        const totalWidth = classes.length * CARD_WIDTH + (classes.length - 1) * CARD_GAP;
        const startX = bodyRect.x + (bodyRect.width - totalWidth) / 2;

        this._cardRects = [];
        classes.forEach((cls, i) => {
            const x = startX + i * (CARD_WIDTH + CARD_GAP);
            this._drawCard(ctx, x, bodyRect.y, cls);
        });
    }

    onBodyClick(x, y, bodyRect, manager) {
        const hit = this._cardRects.find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
        if (!hit) return;
        this.onSelect(hit.classId);
        manager.closePopup();
    }

    _drawCard(ctx, x, y, cls) {
        this._cardRects.push({ x, y, width: CARD_WIDTH, height: CARD_HEIGHT, classId: cls.id });

        ctx.fillStyle = '#161616';
        ctx.fillRect(x, y, CARD_WIDTH, CARD_HEIGHT);
        ctx.strokeStyle = cls.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, CARD_WIDTH, CARD_HEIGHT);

        ctx.fillStyle = cls.color;
        ctx.fillRect(x + CARD_WIDTH / 2 - SWATCH_SIZE / 2, y + 24, SWATCH_SIZE, SWATCH_SIZE);

        ctx.fillStyle = '#e0e0e0';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cls.name, x + CARD_WIDTH / 2, y + 116);

        ctx.fillStyle = '#999';
        ctx.font = '13px sans-serif';
        wrapText(ctx, cls.description, x + CARD_WIDTH / 2, y + 144, CARD_WIDTH - 24, 17, 'center');
    }
}
