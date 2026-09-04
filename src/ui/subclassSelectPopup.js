import { Popup } from './popup.js';
import { subclassesFor } from '../data/subclasses.js';
import { wrapText } from './textWrap.js';

const CARD_WIDTH = 200;
const CARD_HEIGHT = 260;
const CARD_GAP = 20;
const POPUP_WIDTH = CARD_WIDTH * 3 + CARD_GAP * 2 + 40;
const POPUP_HEIGHT = 420;

const ATTRIBUTE_LABELS = { strength: 'Strength', dexterity: 'Dexterity', intelligence: 'Intelligence' };

// Opened once (Character panel's "Choose Subclass" button, level 10+, no
// subclass chosen yet) via ViewportScreen — same Popup-with-cards pattern as
// ClassSelectPopup, but filtered to the player's own core class's 3
// subclasses (see src/data/subclasses.js) instead of showing all 9. The
// choice is permanent: there's no unequip/respec path anywhere in the app.
export class SubclassSelectPopup extends Popup {
    constructor({ player, onSelect }) {
        super({ title: 'Choose Your Subclass', width: POPUP_WIDTH, height: POPUP_HEIGHT });
        this.player = player;
        this.onSelect = onSelect;
        this._cardRects = [];
    }

    renderBody(ctx, bodyRect) {
        const subclasses = subclassesFor(this.player.classId);
        const totalWidth = subclasses.length * CARD_WIDTH + (subclasses.length - 1) * CARD_GAP;
        const startX = bodyRect.x + (bodyRect.width - totalWidth) / 2;

        this._cardRects = [];
        subclasses.forEach((sub, i) => {
            const x = startX + i * (CARD_WIDTH + CARD_GAP);
            this._drawCard(ctx, x, bodyRect.y, sub);
        });
    }

    onBodyClick(x, y, bodyRect, manager) {
        const hit = this._cardRects.find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
        if (!hit) return;
        this.onSelect(hit.subclassId);
        manager.closePopup();
    }

    // Each card's border/accent uses the SUBCLASS's own color (a weighted
    // mix of the core class's color and the secondary attribute's color —
    // see subclassColor in subclasses.js), not the flat core-class color —
    // that's the whole point of computing it, so the three cards for one
    // core class visibly differ (e.g. a Warrior's Barbarian/Hunter/
    // Mageknight cards read as pure red / red-orange / red-purple).
    _drawCard(ctx, x, y, sub) {
        this._cardRects.push({ x, y, width: CARD_WIDTH, height: CARD_HEIGHT, subclassId: sub.id });

        ctx.fillStyle = '#161616';
        ctx.fillRect(x, y, CARD_WIDTH, CARD_HEIGHT);
        ctx.strokeStyle = sub.color;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, CARD_WIDTH, CARD_HEIGHT);

        ctx.fillStyle = '#e0e0e0';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(sub.name, x + CARD_WIDTH / 2, y + 40);

        ctx.fillStyle = sub.color;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`Secondary: ${ATTRIBUTE_LABELS[sub.secondaryAttribute]}`, x + CARD_WIDTH / 2, y + 62);

        ctx.fillStyle = '#999';
        ctx.font = '13px sans-serif';
        wrapText(ctx, sub.description, x + CARD_WIDTH / 2, y + 96, CARD_WIDTH - 24, 17, 'center');
    }
}
