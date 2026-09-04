import { classArmorBaseDefense } from '../data/armorTypes.js';
import { RARITIES } from '../data/rarities.js';
import { STAT_INFO } from '../player/statInfo.js';

const PADDING = 8;
const LINE_HEIGHT = 18;
const CURSOR_OFFSET = 16;
const COLUMN_GAP = 16; // minimum space between a two-column line's label and value

// Generic hover tooltip: a small box of text lines near a screen point,
// clamped to stay within given bounds. Not tied to items — talents, enemies,
// etc. can reuse this the same way once they need hover info too.
//
// Each entry in `lines` is either a plain string (drawn left-aligned, full
// width — item names, stat descriptions) or a `{label, value}` object
// (drawn as two columns: label left-aligned, value right-aligned to the
// box's right edge — stat source breakdowns), so the two can be freely
// mixed, e.g. a plain-string heading followed by breakdown rows.
export function drawTooltip(ctx, cursorX, cursorY, lines, boundsLeft, boundsTop, boundsWidth, boundsHeight) {
    ctx.font = '13px sans-serif';
    const measured = lines.map((line) => {
        if (typeof line === 'string') return { text: line, width: ctx.measureText(line).width };
        const value = String(line.value);
        const width = ctx.measureText(line.label).width + COLUMN_GAP + ctx.measureText(value).width;
        return { label: line.label, value, width };
    });
    const textWidth = Math.max(...measured.map((line) => line.width));
    const width = textWidth + PADDING * 2;
    const height = lines.length * LINE_HEIGHT + PADDING * 2;

    let x = cursorX + CURSOR_OFFSET;
    let y = cursorY + CURSOR_OFFSET;
    if (x + width > boundsLeft + boundsWidth) x = cursorX - CURSOR_OFFSET - width;
    if (y + height > boundsTop + boundsHeight) y = cursorY - CURSOR_OFFSET - height;

    ctx.fillStyle = 'rgba(20, 20, 20, 0.95)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    ctx.fillStyle = '#e0e0e0';
    measured.forEach((line, i) => {
        const lineY = y + PADDING + (i + 0.8) * LINE_HEIGHT;
        if (line.text != null) {
            ctx.textAlign = 'left';
            ctx.fillText(line.text, x + PADDING, lineY);
        } else {
            ctx.textAlign = 'left';
            ctx.fillText(line.label, x + PADDING, lineY);
            ctx.textAlign = 'right';
            ctx.fillText(line.value, x + width - PADDING, lineY);
        }
    });
}

export function itemTooltipLines(item) {
    if (item.armor) {
        const rarity = RARITIES[item.armor.rarityId];
        const lines = [item.armor.name, `Rarity: ${rarity?.name ?? 'Unknown'}`];
        lines.push({ label: 'Defense', value: `+${item.armor.defense ?? classArmorBaseDefense(item.armor.classId)}` });
        for (const affix of item.armor.affixes ?? []) {
            lines.push({ label: STAT_INFO[affix.stat]?.label ?? affix.stat, value: `+${affix.amount}` });
        }
        return lines;
    }

    const lines = [item.itemType.name];
    if (item.itemType.description) lines.push(item.itemType.description);
    if (item.itemType.stackable) lines.push(`Quantity: ${item.quantity}`);
    return lines;
}
