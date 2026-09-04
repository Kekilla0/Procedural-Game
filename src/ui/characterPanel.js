import { GRID_CELL_SIZE, GRID_CELL_GAP } from './gridConstants.js';
import {
    computeDerivedStats,
    syncHealthFromAttributes,
    syncEnergyFromAttributes,
    syncCarryCapacityFromAttributes,
} from '../player/stats.js';
import { CLASSES } from '../data/classes.js';
import { SUBCLASSES, SUBCLASS_UNLOCK_LEVEL, ATTRIBUTE_COLORS } from '../data/subclasses.js';
import { STAT_INFO } from '../player/statInfo.js';
import { computeEquipmentBonuses } from '../items/equipmentBonuses.js';
import { RARITIES } from '../data/rarities.js';
import { wrapText } from './textWrap.js';

// Content drawn inside the Character side panel's left (equipment) and right
// (attributes) sections. Split out of hud.js because it's a self-contained
// chunk of layout state, not just another draw call.
//
// Equipment slots sit on an actual grid (col, row integer coordinates, same
// cell size as the inventory grid) rather than floating at fractional
// positions — a 1x1 equipment slot and a 1x1 inventory cell are the same
// size and shape by construction. Layout is Diablo 3's 3-column paperdoll
// scheme (armor-ish pieces flanking a center column, weapons at the bottom
// corners), given explicitly as a (col,row) grid.
const EQUIP_SLOTS = [
    { id: 'head', label: 'HD', col: 1, row: 0 },
    { id: 'shoulders', label: 'SH', col: 0, row: 1 },
    { id: 'chest', label: 'CH', col: 1, row: 1 },
    { id: 'neck', label: 'NK', col: 2, row: 1 },
    { id: 'hands', label: 'HN', col: 0, row: 2 },
    { id: 'belt', label: 'BE', col: 1, row: 2 },
    { id: 'arms', label: 'AR', col: 2, row: 2 },
    { id: 'leftRing', label: 'LR', col: 0, row: 3 },
    { id: 'pants', label: 'PA', col: 1, row: 3 },
    { id: 'rightRing', label: 'RR', col: 2, row: 3 },
    { id: 'leftHand', label: 'LH', col: 0, row: 4 },
    { id: 'boots', label: 'BO', col: 1, row: 4 },
    { id: 'rightHand', label: 'RH', col: 2, row: 4 },
];
const EQUIP_GRID_COLS = 3;
const EQUIP_GRID_ROWS = 5;

const SECTION_GAP = 16;
const EQUIP_WIDTH_SHARE = 2 / 3;

const STAT_ROW_HEIGHT = 20;
const STAT_BUTTON_SIZE = 16;
// Reserved space for the row's own right-aligned number, wide enough for 4
// digits at the stat-row font size — the + button sits just left of this
// reserved zone (not flush against the row's right edge) so it never
// overlaps the number, including headroom for values that grow later.
const VALUE_RESERVE_WIDTH = 34;

// Base attributes shown with a +button (when points are available), and the
// three tiers of derived stats below them — see src/player/stats.js for how
// each is computed. Labels only; the actual scaling behind these numbers is
// being worked out one stat at a time, not decided here.
const BASE_STAT_ROWS = [
    { key: 'strength', label: 'Strength' },
    { key: 'dexterity', label: 'Dexterity' },
    { key: 'intelligence', label: 'Intelligence' },
];
const TIER_ROWS = [
    {
        title: 'Combat',
        rows: [
            { key: 'health', label: 'Health' },
            { key: 'defense', label: 'Defense' },
            { key: 'energy', label: 'Energy' },
            { key: 'attack', label: 'Attack' },
        ],
    },
    {
        title: 'General',
        rows: [
            { key: 'carryCapacity', label: 'Carry Capacity' },
            { key: 'speed', label: 'Speed' },
            { key: 'acuity', label: 'Acuity' },
        ],
    },
    {
        title: 'Magic Resistances',
        rows: [
            { key: 'fire', label: 'Fire' },
            { key: 'lightning', label: 'Lightning' },
            { key: 'arcane', label: 'Arcane' },
        ],
    },
    {
        title: 'Physical Resistances',
        rows: [
            { key: 'blunt', label: 'Blunt' },
            { key: 'slash', label: 'Slash' },
            { key: 'pierce', label: 'Pierce' },
        ],
    },
];

export class CharacterPanel {
    constructor() {
        this._slotRects = []; // recomputed each render; hit-tested for drag/drop and tooltips
        this._statButtonRects = []; // recomputed each render; [{stat, x, y, width, height}]
        this._statRowRects = []; // recomputed each render; [{key, x, y, width, height}] — every stat row, base + derived, for hover tooltips
        this._subclassButtonRect = null; // recomputed each render; null unless level >= SUBCLASS_UNLOCK_LEVEL and no subclass chosen yet
        // Set true when the "Choose Subclass" button is clicked; Hud reads
        // and clears this after onClick, since only ViewportScreen (via
        // Hud) has access to `manager` to actually open the picker popup.
        this.subclassPromptRequested = false;
    }

    render(ctx, contentRect, scale, player) {
        const gap = SECTION_GAP * scale;
        const equipWidth = contentRect.width * EQUIP_WIDTH_SHARE - gap / 2;

        const equipRect = { x: contentRect.x, y: contentRect.y, width: equipWidth, height: contentRect.height };
        const attributesRect = {
            x: contentRect.x + equipWidth + gap,
            y: contentRect.y,
            width: contentRect.width - equipWidth - gap,
            height: contentRect.height,
        };

        this._drawEquipment(ctx, equipRect, scale, player.equipment);
        this._drawAttributes(ctx, attributesRect, scale, player);
    }

    // Slot id under (x,y) if the equipment grid is currently on screen, else null.
    getSlotAt(x, y) {
        const hit = this._slotRects.find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
        return hit ? hit.slotId : null;
    }

    // {key, zone} under (x,y) if a stat row is currently on screen, else
    // null — used by Hud to show a hover tooltip. `zone` is 'label' (shows
    // STAT_INFO's description) or 'value' (shows statBreakdown's source
    // breakdown — see stats.js).
    getStatHoverAt(x, y) {
        const hit = this._statRowRects.find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
        return hit ? { key: hit.key, zone: hit.zone } : null;
    }

    // A + button under (x,y) spends one stat point on it, if any are
    // available. Returns true if it handled the click. `level` is only
    // needed for Carry Capacity's sync (a shrink can evict items onto the
    // ground) — Health/Energy don't need it.
    onClick(x, y, player, level) {
        if (this._subclassButtonRect && this._hit(this._subclassButtonRect, x, y)) {
            this.subclassPromptRequested = true;
            return true;
        }

        if (player.statPoints <= 0) return false;
        const hit = this._statButtonRects.find((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
        if (!hit) return false;

        player.attributes[hit.stat] += 1;
        player.statPoints -= 1;
        // Each only actually changes something when its own governing stat
        // was the one just spent, but all three are cheap/idempotent otherwise.
        syncHealthFromAttributes(player);
        syncEnergyFromAttributes(player);
        syncCarryCapacityFromAttributes(player, level);
        return true;
    }

    _hit(rect, x, y) {
        return !!rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }

    _drawEquipment(ctx, rect, scale, equipment) {
        const cellSize = GRID_CELL_SIZE * scale;
        const cellGap = GRID_CELL_GAP * scale;
        const gridWidth = EQUIP_GRID_COLS * cellSize + (EQUIP_GRID_COLS - 1) * cellGap;
        const gridHeight = EQUIP_GRID_ROWS * cellSize + (EQUIP_GRID_ROWS - 1) * cellGap;

        // Placeholder box for the character background image fills the whole
        // equipment section (not just the slot grid's own footprint), so
        // there's actual room for a character image once one exists. The
        // slot grid is centered on top of it.
        ctx.fillStyle = '#161616';
        ctx.strokeStyle = '#4a4a4a';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        ctx.setLineDash([]);
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

        const originX = rect.x + Math.max(0, (rect.width - gridWidth) / 2);
        const originY = rect.y + Math.max(0, (rect.height - gridHeight) / 2);

        this._slotRects = [];
        for (const slot of EQUIP_SLOTS) {
            const slotX = originX + slot.col * (cellSize + cellGap);
            const slotY = originY + slot.row * (cellSize + cellGap);
            this._slotRects.push({ slotId: slot.id, x: slotX, y: slotY, width: cellSize, height: cellSize });

            const equipped = equipment?.get(slot.id);
            if (equipped) {
                ctx.fillStyle = equipped.itemType.color;
                ctx.fillRect(slotX, slotY, cellSize, cellSize);
                ctx.strokeStyle = equipped.armor ? RARITIES[equipped.armor.rarityId]?.color ?? '#e0e0e0' : '#e0e0e0';
                ctx.strokeRect(slotX, slotY, cellSize, cellSize);

                ctx.fillStyle = '#111';
                ctx.font = `bold ${Math.round(11 * scale)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(equipped.itemType.label, slotX + cellSize / 2, slotY + cellSize / 2 + 4 * scale);
            } else {
                ctx.fillStyle = '#1c1c1c';
                ctx.fillRect(slotX, slotY, cellSize, cellSize);
                ctx.strokeStyle = '#555';
                ctx.strokeRect(slotX, slotY, cellSize, cellSize);

                ctx.fillStyle = '#888';
                ctx.font = `${Math.round(11 * scale)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(slot.label, slotX + cellSize / 2, slotY + cellSize / 2 + 4 * scale);
            }
        }
    }

    _drawAttributes(ctx, rect, scale, player) {
        ctx.fillStyle = '#151515';
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeStyle = '#3a3a3a';
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        this._statButtonRects = [];
        this._statRowRects = [];
        const pad = 10 * scale;
        let y = rect.y + 20 * scale;
        const lineHeight = STAT_ROW_HEIGHT * scale;
        const cls = CLASSES[player.classId];

        ctx.textAlign = 'left';
        ctx.fillStyle = '#e0e0e0';
        ctx.font = `bold ${Math.round(15 * scale)}px sans-serif`;
        ctx.fillText(`Level ${player.level}`, rect.x + pad, y);
        y += lineHeight * 1.3;

        if (cls) y = this._drawClassInfo(ctx, rect, scale, pad, y, cls);

        const subclass = player.subclass ? SUBCLASSES[player.subclass] : null;
        y = this._drawSubclassInfo(ctx, rect, scale, pad, y, lineHeight, player, cls, subclass);

        const equipmentBonuses = computeEquipmentBonuses(player.equipment);

        for (const { key, label } of BASE_STAT_ROWS) {
            const isPrimary = cls?.primaryAttribute === key;
            const isSecondary = !isPrimary && subclass?.secondaryAttribute === key;
            const accentColor = isPrimary ? cls.color : isSecondary ? ATTRIBUTE_COLORS[key] : null;
            const displayedValue = player.attributes[key] + equipmentBonuses[key];
            this._drawStatRow(ctx, rect, scale, pad, y, lineHeight, key, label, displayedValue, accentColor, true, isPrimary);
            if (player.statPoints > 0) {
                const buttonRect = {
                    stat: key,
                    x: rect.x + rect.width - pad - VALUE_RESERVE_WIDTH * scale - STAT_BUTTON_SIZE * scale,
                    y: y - (STAT_BUTTON_SIZE - 2) * scale,
                    width: STAT_BUTTON_SIZE * scale,
                    height: STAT_BUTTON_SIZE * scale,
                };
                this._statButtonRects.push(buttonRect);
                this._drawStatButton(ctx, buttonRect, scale);
            }
            y += lineHeight;
        }

        if (player.statPoints > 0) {
            ctx.fillStyle = '#6fa8dc';
            ctx.font = `${Math.round(12 * scale)}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(`${player.statPoints} point${player.statPoints === 1 ? '' : 's'} to spend`, rect.x + pad, y);
            y += lineHeight;
        }

        y += lineHeight * 0.6;

        const derived = computeDerivedStats(player.attributes, player.classId, player.level, player.subclass, equipmentBonuses);
        // Both resistance sections pull from the same derived.tier3 bucket
        // (it now holds all 6 resistance keys, magic and physical alike) —
        // only the row keys each section lists differ.
        const tierData = {
            Combat: derived.tier1,
            General: derived.tier2,
            'Magic Resistances': derived.tier3,
            'Physical Resistances': derived.tier3,
        };
        for (const tier of TIER_ROWS) {
            ctx.fillStyle = '#888';
            ctx.font = `bold ${Math.round(11 * scale)}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(tier.title.toUpperCase(), rect.x + pad, y);
            y += lineHeight * 0.85;

            for (const { key, label } of tier.rows) {
                this._drawStatRow(ctx, rect, scale, pad, y, lineHeight, key, label, tierData[tier.title][key], null, true);
                y += lineHeight;
            }
            y += lineHeight * 0.4;
        }
    }

    // Class name + wrapped description, shown above the base attribute rows.
    // Returns the y position just past what it drew.
    _drawClassInfo(ctx, rect, scale, pad, y, cls) {
        ctx.fillStyle = cls.color;
        ctx.font = `bold ${Math.round(13 * scale)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(cls.name, rect.x + pad, y);
        y += 16 * scale;

        ctx.fillStyle = '#999';
        ctx.font = `${Math.round(11 * scale)}px sans-serif`;
        y = wrapText(ctx, cls.description, rect.x + pad, y, rect.width - pad * 2, 14 * scale, 'left');

        return y + 8 * scale;
    }

    // Below the class blurb: the chosen subclass's name (once picked,
    // permanent — see src/data/subclasses.js), or a "Choose Subclass" button
    // once `player.level >= SUBCLASS_UNLOCK_LEVEL` and none is chosen yet, or
    // nothing at all below that level (hidden-unless-available, same pattern
    // as the stat-point + buttons). Returns the y position just past what it
    // drew (unchanged if nothing was drawn).
    _drawSubclassInfo(ctx, rect, scale, pad, y, lineHeight, player, cls, subclass) {
        this._subclassButtonRect = null;
        if (!cls) return y;

        if (subclass) {
            ctx.fillStyle = subclass.color;
            ctx.font = `${Math.round(11 * scale)}px sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(`Subclass: ${subclass.name}`, rect.x + pad, y);
            return y + lineHeight * 0.9;
        }

        if (player.level < SUBCLASS_UNLOCK_LEVEL) return y;

        const buttonHeight = 22 * scale;
        this._subclassButtonRect = { x: rect.x + pad, y, width: rect.width - pad * 2, height: buttonHeight };
        ctx.fillStyle = '#2f4f7a';
        ctx.fillRect(this._subclassButtonRect.x, this._subclassButtonRect.y, this._subclassButtonRect.width, buttonHeight);
        ctx.strokeStyle = '#6fa8dc';
        ctx.strokeRect(this._subclassButtonRect.x, this._subclassButtonRect.y, this._subclassButtonRect.width, buttonHeight);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = `bold ${Math.round(12 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Choose Subclass', this._subclassButtonRect.x + this._subclassButtonRect.width / 2, y + buttonHeight * 0.68);

        return y + buttonHeight + lineHeight * 0.9;
    }

    // `accentColor`, when given, marks this as the class's primary attribute
    // (bold + tinted) or, with `bold: false`, its subclass's secondary
    // attribute (tinted only, not bold) — a lighter visual weight so primary
    // still clearly reads as the bigger deal. Tracks the row's hit rect(s)
    // (keyed by `key`, into STAT_INFO) for Hud's hover tooltip regardless of
    // emphasis. `hasBreakdown` splits the row into a 'label' zone (hover
    // shows STAT_INFO's description, as before) and a 'value' zone over the
    // number itself (hover shows statBreakdown's source breakdown) — every
    // row passes true today (statBreakdown covers every stat key), the flag
    // exists so a future stat with no meaningful breakdown can still opt out.
    _drawStatRow(ctx, rect, scale, pad, y, lineHeight, key, label, value, accentColor, hasBreakdown = false, bold = true) {
        const rowY = y - lineHeight * 0.75;
        if (hasBreakdown) {
            const split = rect.x + rect.width * 0.6;
            this._statRowRects.push({ key, zone: 'label', x: rect.x, y: rowY, width: split - rect.x, height: lineHeight });
            this._statRowRects.push({ key, zone: 'value', x: split, y: rowY, width: rect.x + rect.width - split, height: lineHeight });
        } else {
            this._statRowRects.push({ key, zone: 'label', x: rect.x, y: rowY, width: rect.width, height: lineHeight });
        }

        ctx.fillStyle = accentColor ?? '#bbb';
        ctx.font = `${accentColor && bold ? 'bold ' : ''}${Math.round(13 * scale)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(label, rect.x + pad, y);

        ctx.fillStyle = accentColor ?? '#e0e0e0';
        ctx.textAlign = 'right';
        ctx.fillText(String(value), rect.x + rect.width - pad, y);
    }

    _drawStatButton(ctx, buttonRect, scale) {
        ctx.fillStyle = '#2f4f7a';
        ctx.fillRect(buttonRect.x, buttonRect.y, buttonRect.width, buttonRect.height);
        ctx.strokeStyle = '#6fa8dc';
        ctx.strokeRect(buttonRect.x, buttonRect.y, buttonRect.width, buttonRect.height);

        ctx.fillStyle = '#e0e0e0';
        ctx.font = `bold ${Math.round(12 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('+', buttonRect.x + buttonRect.width / 2, buttonRect.y + buttonRect.height / 2 + 4 * scale);
    }
}
