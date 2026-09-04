import { Popup } from './popup.js';
import { ARMOR_TYPES, buildArmorItemData } from '../data/armorTypes.js';
import { ARMOR_SLOTS } from '../data/armorSlots.js';
import { RARITIES, rollRarity } from '../data/rarities.js';

const DROPDOWN_WIDTH = 170;
const DROPDOWN_ROW_HEIGHT = 24;
const ROW_HEIGHT = 34;
const SPAWN_BUTTON_HEIGHT = 32;
const LEVEL_STEP_BUTTON_SIZE = 24;
const LEVEL_VALUE_WIDTH = 40;

// Presentation-only display labels — ARMOR_SLOTS' own ids match
// characterPanel.js's EQUIP_SLOTS ids exactly ('pants', not 'legs'), this
// is just friendlier wording for the dropdown.
const SLOT_LABELS = {
    head: 'Head',
    shoulders: 'Shoulders',
    chest: 'Chest',
    hands: 'Hands',
    belt: 'Belt',
    arms: 'Arms',
    pants: 'Legs',
    boots: 'Boots',
};
const SLOT_OPTIONS = Object.values(ARMOR_SLOTS).map((s) => ({ value: s.id, label: SLOT_LABELS[s.id] ?? s.id }));
// 'random' is a synthetic option, not a real RARITIES entry — resolved via
// rollRarity() (the real weighted roll) at spawn time, first in the list so
// it's the default (exercising the weighted roll is the more interesting
// default for a testing tool than always picking a fixed rarity).
const RARITY_OPTIONS = [{ value: 'random', label: 'Random' }, ...Object.values(RARITIES).map((r) => ({ value: r.id, label: r.name }))];

// Debug tool: spawn one piece of armor (any of the 8 slots) of a specified
// type + rarity directly into the player's inventory, for testing the
// procedural armor system without full loot-table integration (see
// src/data/armorTypes.js/armorSlots.js/rarities.js). Opened from Settings'
// debug section (onOpenArmorSpawner). Doesn't auto-close after spawning —
// a repeatable tool, same idiom as "Test stat"/"Grant talent".
export class ArmorSpawnPopup extends Popup {
    constructor({ onSpawn }) {
        super({ title: 'Spawn Armor', width: 340, height: 160 });
        this.onSpawn = onSpawn;
        this._slotKey = SLOT_OPTIONS[0].value;
        // Stand-in for dungeon depth (no real dungeon/floor system exists
        // yet — see weightsForLevel in rarities.js). Must be set BEFORE
        // _typeOptions() is first called below — it now also filters by
        // each tier's minLevel, so an unset _level would filter out every
        // option and crash on `allowed[0].value`.
        this._level = 1;
        this._typeKey = this._typeOptions()[0].value;
        this._rarityKey = RARITY_OPTIONS[0].value;
        this._slotDropdownOpen = false;
        this._typeDropdownOpen = false;
        this._rarityDropdownOpen = false;
    }

    // Which weight tiers are available for the CURRENTLY selected slot at
    // the CURRENT Dungeon Level — recomputed on every access rather than
    // cached, so it always reflects both. Two independent filters: the
    // slot's own cap (e.g. Belt excludes Medium-Heavy/Heavy — see
    // armorSlots.js) and each tier's hard level floor (ARMOR_TYPES[x]
    // .minLevel — e.g. Heavy never shows before level 20). The debug tool
    // mirrors real rollRandomArmor drop behavior rather than bypassing it —
    // raising the Dungeon Level stepper is how to preview/test higher tiers.
    _typeOptions() {
        return ARMOR_SLOTS[this._slotKey].allowedTierIds
            .filter((id) => this._level >= ARMOR_TYPES[id].minLevel)
            .map((id) => ({ value: id, label: ARMOR_TYPES[id].name }));
    }

    render(ctx, canvasWidth, canvasHeight) {
        // Same "grow the panel to contain an open dropdown's option overlay"
        // accounting as SettingsPopup — otherwise clicks on lower options
        // land outside the panel and close it instead of picking one.
        const slotExtra = this._slotDropdownOpen ? SLOT_OPTIONS.length * DROPDOWN_ROW_HEIGHT : 0;
        const typeExtra = this._typeDropdownOpen ? this._typeOptions().length * DROPDOWN_ROW_HEIGHT : 0;
        const rarityExtra = this._rarityDropdownOpen ? RARITY_OPTIONS.length * DROPDOWN_ROW_HEIGHT : 0;
        this.height = 40 + ROW_HEIGHT * 4 + SPAWN_BUTTON_HEIGHT + 16 + slotExtra + typeExtra + rarityExtra;
        super.render(ctx, canvasWidth, canvasHeight);
    }

    renderBody(ctx, bodyRect) {
        let y = bodyRect.y;
        y = this._drawDropdownRow(ctx, bodyRect, y, 'Slot', 'slot');
        y = this._drawDropdownRow(ctx, bodyRect, y, 'Type', 'type');
        y = this._drawDropdownRow(ctx, bodyRect, y, 'Rarity', 'rarity');
        y = this._drawLevelRow(ctx, bodyRect, y);

        y += 12;
        this._spawnRect = { x: bodyRect.x, y, width: bodyRect.width, height: SPAWN_BUTTON_HEIGHT };
        ctx.fillStyle = '#1f3a1f';
        ctx.fillRect(this._spawnRect.x, this._spawnRect.y, this._spawnRect.width, this._spawnRect.height);
        ctx.strokeStyle = '#4a7a4a';
        ctx.strokeRect(this._spawnRect.x, this._spawnRect.y, this._spawnRect.width, this._spawnRect.height);
        ctx.fillStyle = '#c0e0c0';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Spawn', this._spawnRect.x + this._spawnRect.width / 2, this._spawnRect.y + this._spawnRect.height / 2 + 5);

        // Drawn last so the open dropdown's option list overlays everything below it.
        if (this._slotDropdownOpen) this._drawOptions(ctx, this._slotDropdownRect, SLOT_OPTIONS, this._slotKey, '_slotOptionRects');
        if (this._typeDropdownOpen) this._drawOptions(ctx, this._typeDropdownRect, this._typeOptions(), this._typeKey, '_typeOptionRects');
        if (this._rarityDropdownOpen) this._drawOptions(ctx, this._rarityDropdownRect, RARITY_OPTIONS, this._rarityKey, '_rarityOptionRects');
    }

    _drawDropdownRow(ctx, bodyRect, rowY, label, kind) {
        const options = kind === 'slot' ? SLOT_OPTIONS : kind === 'type' ? this._typeOptions() : RARITY_OPTIONS;
        const currentKey = kind === 'slot' ? this._slotKey : kind === 'type' ? this._typeKey : this._rarityKey;
        const isOpen = kind === 'slot' ? this._slotDropdownOpen : kind === 'type' ? this._typeDropdownOpen : this._rarityDropdownOpen;

        ctx.fillStyle = '#e0e0e0';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, bodyRect.x, rowY + DROPDOWN_ROW_HEIGHT / 2 + 5);

        const rect = { x: bodyRect.x + bodyRect.width - DROPDOWN_WIDTH, y: rowY, width: DROPDOWN_WIDTH, height: DROPDOWN_ROW_HEIGHT };
        if (kind === 'slot') this._slotDropdownRect = rect;
        else if (kind === 'type') this._typeDropdownRect = rect;
        else this._rarityDropdownRect = rect;

        const current = options.find((o) => o.value === currentKey) ?? options[0];
        ctx.fillStyle = '#242424';
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeStyle = '#555';
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(current.label, rect.x + 8, rowY + DROPDOWN_ROW_HEIGHT / 2 + 5);
        ctx.textAlign = 'right';
        ctx.fillText(isOpen ? '▲' : '▼', rect.x + DROPDOWN_WIDTH - 8, rowY + DROPDOWN_ROW_HEIGHT / 2 + 5);

        return rowY + ROW_HEIGHT;
    }

    // "Dungeon Level" stepper (-, value, +) — now always matters: it feeds
    // rollRarity when Rarity is 'random' (see weightsForLevel in
    // rarities.js), filters Type's available tiers via each tier's minLevel
    // floor (see _typeOptions above), and drives the level-scaled Defense/
    // affix value range (rollStatRange in armorTypes.js) on every spawn.
    _drawLevelRow(ctx, bodyRect, rowY) {
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Dungeon Level', bodyRect.x, rowY + LEVEL_STEP_BUTTON_SIZE / 2 + 5);

        const controlsRight = bodyRect.x + bodyRect.width;
        this._levelPlusRect = { x: controlsRight - LEVEL_STEP_BUTTON_SIZE, y: rowY, width: LEVEL_STEP_BUTTON_SIZE, height: LEVEL_STEP_BUTTON_SIZE };
        const valueX = this._levelPlusRect.x - 6 - LEVEL_VALUE_WIDTH;
        this._levelMinusRect = { x: valueX - 6 - LEVEL_STEP_BUTTON_SIZE, y: rowY, width: LEVEL_STEP_BUTTON_SIZE, height: LEVEL_STEP_BUTTON_SIZE };

        this._drawStepButton(ctx, this._levelMinusRect, '-');
        this._drawStepButton(ctx, this._levelPlusRect, '+');

        ctx.fillStyle = '#e0e0e0';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(String(this._level), valueX + LEVEL_VALUE_WIDTH / 2, rowY + LEVEL_STEP_BUTTON_SIZE / 2 + 5);

        return rowY + ROW_HEIGHT;
    }

    _drawStepButton(ctx, rect, label) {
        ctx.fillStyle = '#242424';
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        ctx.strokeStyle = '#555';
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        ctx.fillStyle = '#e0e0e0';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2 + 5);
    }

    _drawOptions(ctx, dropdownRect, options, currentKey, rectsField) {
        this[rectsField] = [];
        let optY = dropdownRect.y + dropdownRect.height;
        for (const option of options) {
            const rect = { x: dropdownRect.x, y: optY, width: DROPDOWN_WIDTH, height: DROPDOWN_ROW_HEIGHT, value: option.value };
            this[rectsField].push(rect);

            const selected = option.value === currentKey;
            ctx.fillStyle = selected ? '#2f4f7a' : '#1c1c1c';
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            ctx.strokeStyle = selected ? '#6fa8dc' : '#555';
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

            ctx.fillStyle = '#e0e0e0';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(option.label, rect.x + 8, rect.y + DROPDOWN_ROW_HEIGHT / 2 + 5);

            optY += DROPDOWN_ROW_HEIGHT;
        }
    }

    // Re-validates _typeKey against the current (slot + level) filtered
    // option set, falling back to the first allowed tier if the current
    // selection no longer qualifies — shared by the slot dropdown and both
    // level-stepper buttons, since either can invalidate the current Type.
    _resetTypeKeyIfInvalid() {
        const allowed = this._typeOptions();
        if (!allowed.some((o) => o.value === this._typeKey)) this._typeKey = allowed[0].value;
    }

    onBodyClick(x, y, bodyRect, manager) {
        if (this._slotDropdownOpen) {
            const hit = (this._slotOptionRects || []).find((r) => this._hit(r, x, y));
            if (hit && hit.value !== this._slotKey) {
                this._slotKey = hit.value;
                this._resetTypeKeyIfInvalid();
            }
            this._slotDropdownOpen = false;
            return;
        }
        if (this._typeDropdownOpen) {
            const hit = (this._typeOptionRects || []).find((r) => this._hit(r, x, y));
            if (hit) this._typeKey = hit.value;
            this._typeDropdownOpen = false;
            return;
        }
        if (this._rarityDropdownOpen) {
            const hit = (this._rarityOptionRects || []).find((r) => this._hit(r, x, y));
            if (hit) this._rarityKey = hit.value;
            this._rarityDropdownOpen = false;
            return;
        }
        if (this._hit(this._slotDropdownRect, x, y)) {
            this._slotDropdownOpen = true;
            return;
        }
        if (this._hit(this._typeDropdownRect, x, y)) {
            this._typeDropdownOpen = true;
            return;
        }
        if (this._hit(this._rarityDropdownRect, x, y)) {
            this._rarityDropdownOpen = true;
            return;
        }
        if (this._hit(this._levelMinusRect, x, y)) {
            this._level = Math.max(1, this._level - 1);
            this._resetTypeKeyIfInvalid();
            return;
        }
        if (this._hit(this._levelPlusRect, x, y)) {
            this._level += 1;
            this._resetTypeKeyIfInvalid();
            return;
        }
        if (this._hit(this._spawnRect, x, y)) {
            // 'random' resolves to a real weighted roll (rollRarity),
            // shifted toward rarer tiers by the current Dungeon Level, right
            // here once per spawn — the stored item always gets a real
            // rarityId, never the literal 'random' sentinel.
            const rarityId = this._rarityKey === 'random' ? rollRarity(this._level) : this._rarityKey;
            this.onSpawn(buildArmorItemData(this._typeKey, rarityId, this._slotKey, this._level));
        }
    }
}
