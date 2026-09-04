import { Popup } from './popup.js';
import { settings, saveSettings } from '../state/settings.js';
import { TALENTS } from '../data/talents.js';

const CHECKBOX_SIZE = 18;
const ROW_HEIGHT = 30;
const DEBUG_INDENT = 24;
const EXIT_BUTTON_HEIGHT = 40;
const EXIT_BLOCK_HEIGHT = EXIT_BUTTON_HEIGHT + 16;

const UI_SCALE_MIN = 0.5;
const UI_SCALE_MAX = 2;
const UI_SCALE_STEP = 0.1;
const STEP_BUTTON_SIZE = 20;
const STEP_ROW_HEIGHT = 34;

const AUTO_OPEN_MENU_OPTIONS = [
    { value: 'none', label: 'None' },
    { value: 'character', label: 'Character' },
    { value: 'talent', label: 'Talent' },
    { value: 'inventory', label: 'Inventory' },
];
const DROPDOWN_WIDTH = 120;
const DROPDOWN_ROW_HEIGHT = 24;
const MILESTONES_BUTTON_WIDTH = 90;
const MILESTONES_BUTTON_HEIGHT = 24;
const ARMOR_SPAWNER_BUTTON_WIDTH = 90;
const ARMOR_SPAWNER_BUTTON_HEIGHT = 24;

// 'level' folds what used to be a separate "Grant level-up" button into this
// same dropdown+button — one debug control instead of two.
const DEBUG_STAT_OPTIONS = [
    { value: 'level', label: 'Level' },
    { value: 'strength', label: 'Strength' },
    { value: 'dexterity', label: 'Dexterity' },
    { value: 'intelligence', label: 'Intelligence' },
];
const STAT_DROPDOWN_WIDTH = 110;
const STAT_PLUS_BUTTON_SIZE = 24;

// Unfiltered by class, matching "Test stat"'s own precedent — a blunt
// testing tool, not a real acquisition system (see src/data/talents.js).
const DEBUG_TALENT_OPTIONS = Object.values(TALENTS).map((t) => ({ value: t.id, label: t.name }));
const TALENT_DROPDOWN_WIDTH = 150;
const TALENT_PLUS_BUTTON_SIZE = 24;

const HOTKEY_ACTIONS = [
    { id: 'character', label: 'Open Character' },
    { id: 'talent', label: 'Open Talents' },
    { id: 'inventory', label: 'Open Inventory' },
];
const HOTKEY_HEADER_HEIGHT = 26;
const HOTKEY_BUTTON_WIDTH = 60;
const HOTKEY_BUTTON_HEIGHT = 24;
// Reserved for movement/interact — rejected as a hotkey assignment so
// rebinding "Open Inventory" to 'e' can't silently break interacting.
const RESERVED_KEYS = new Set(['w', 'a', 's', 'd', 'e']);

// Settings panel. Pass { showExitButton: true } when opening it from in-game
// (adds an "Exit to Title" button) — the title screen opens it without that option.
//
// "Debug mode" reveals indented debug-only sub-options below it (isometric
// view, coordinate HUD, collision overlay, container-refill-on-close,
// auto-continue, auto-open-menu, open-milestones, test stat) — this is
// the only place they're reachable, there's no separate debug screen/button.
// UI Scale sits below the debug block regardless of whether it's expanded —
// it's not a debug-only option.
export class SettingsPopup extends Popup {
    constructor({ showExitButton = false, onDebugStatIncrement = null, onDebugGrantTalent = null, onOpenArmorSpawner = null } = {}) {
        super({ title: 'Settings', width: 360, height: 200 });
        this.showExitButton = showExitButton;
        // Debug-only testing aid: opens ArmorSpawnPopup, which lets you spawn
        // a chest armor of a chosen weight-tier type + rarity directly into
        // the inventory (see src/data/armorTypes.js/rarities.js). Only
        // provided when opened from an active game.
        this.onOpenArmorSpawner = onOpenArmorSpawner;
        // Debug-only testing aid: the "Test stat" dropdown+button. Bumps the
        // chosen base attribute directly (no stat-point cost), or — for the
        // 'level' option — grants a level (+1 stat point), folding what used
        // to be a separate "Grant level-up" button into this one control.
        // Only provided when opened from an active game (not the title
        // screen, which has no player yet).
        this.onDebugStatIncrement = onDebugStatIncrement;
        this._debugStatKey = 'level';
        // Debug-only testing aid: "Grant talent" dropdown+button — grants any
        // talent for free, bypassing tier/level-gating and talent-point cost
        // entirely (same bypass role "Test stat" plays for base attributes).
        // The real, in-game path is the Talent panel itself. See
        // src/data/talents.js.
        this.onDebugGrantTalent = onDebugGrantTalent;
        this._debugTalentKey = DEBUG_TALENT_OPTIONS[0]?.value ?? null;
        this._menuDropdownOpen = false;
        this._statDropdownOpen = false;
        this._talentDropdownOpen = false;
        // id ('character'|'talent'|'inventory') of the hotkey currently
        // waiting for its next keypress, or null. See onKeyDown.
        this._listeningHotkey = null;
    }

    render(ctx, canvasWidth, canvasHeight) {
        const debugRowCount =
            settings.debug
                ? 8 +
                  (this.onDebugStatIncrement ? 1 : 0) +
                  (this.onDebugGrantTalent ? 1 : 0) +
                  (this.onOpenArmorSpawner ? 1 : 0)
                : 1;
        // Open dropdowns' option lists are drawn as overlays, but the panel
        // itself still needs to be tall enough to contain them — otherwise
        // clicks on the lower options land outside the panel and close the
        // whole popup instead of picking an option. Only one dropdown is
        // ever open at a time (opening any closes the others).
        const dropdownExtra = this._menuDropdownOpen ? AUTO_OPEN_MENU_OPTIONS.length * DROPDOWN_ROW_HEIGHT : 0;
        const statDropdownExtra =
            settings.debug && this._statDropdownOpen ? DEBUG_STAT_OPTIONS.length * DROPDOWN_ROW_HEIGHT : 0;
        const talentDropdownExtra =
            settings.debug && this._talentDropdownOpen ? DEBUG_TALENT_OPTIONS.length * DROPDOWN_ROW_HEIGHT : 0;
        const hotkeysHeight = HOTKEY_HEADER_HEIGHT + HOTKEY_ACTIONS.length * ROW_HEIGHT;
        this.height =
            76 +
            debugRowCount * ROW_HEIGHT +
            STEP_ROW_HEIGHT +
            dropdownExtra +
            statDropdownExtra +
            talentDropdownExtra +
            hotkeysHeight +
            (this.showExitButton ? EXIT_BLOCK_HEIGHT : 0);
        super.render(ctx, canvasWidth, canvasHeight);
    }

    renderBody(ctx, bodyRect) {
        this._checkboxRect = { x: bodyRect.x, y: bodyRect.y, width: CHECKBOX_SIZE, height: CHECKBOX_SIZE };
        this._drawCheckbox(ctx, this._checkboxRect, settings.debug, 'Debug mode');

        this._isoRect = null;
        this._coordsRect = null;
        this._collisionRect = null;
        this._refillRect = null;
        this._autoContinueRect = null;
        this._menuDropdownRect = null;
        this._openMilestonesRect = null;
        this._statDropdownRect = null;
        this._statPlusRect = null;
        this._talentDropdownRect = null;
        this._talentPlusRect = null;
        this._armorSpawnerRect = null;

        let nextRow = 1;
        if (settings.debug) {
            this._isoRect = {
                x: bodyRect.x + DEBUG_INDENT,
                y: bodyRect.y + ROW_HEIGHT * nextRow++,
                width: CHECKBOX_SIZE,
                height: CHECKBOX_SIZE,
            };
            this._drawCheckbox(ctx, this._isoRect, settings.isometric, 'Isometric view');

            this._coordsRect = {
                x: bodyRect.x + DEBUG_INDENT,
                y: bodyRect.y + ROW_HEIGHT * nextRow++,
                width: CHECKBOX_SIZE,
                height: CHECKBOX_SIZE,
            };
            this._drawCheckbox(ctx, this._coordsRect, settings.showCoords, 'Show coordinates');

            this._collisionRect = {
                x: bodyRect.x + DEBUG_INDENT,
                y: bodyRect.y + ROW_HEIGHT * nextRow++,
                width: CHECKBOX_SIZE,
                height: CHECKBOX_SIZE,
            };
            this._drawCheckbox(ctx, this._collisionRect, settings.showCollision, 'Show collision');

            this._refillRect = {
                x: bodyRect.x + DEBUG_INDENT,
                y: bodyRect.y + ROW_HEIGHT * nextRow++,
                width: CHECKBOX_SIZE,
                height: CHECKBOX_SIZE,
            };
            this._drawCheckbox(ctx, this._refillRect, settings.refillContainers, 'Refill containers on close');

            this._autoContinueRect = {
                x: bodyRect.x + DEBUG_INDENT,
                y: bodyRect.y + ROW_HEIGHT * nextRow++,
                width: CHECKBOX_SIZE,
                height: CHECKBOX_SIZE,
            };
            this._drawCheckbox(ctx, this._autoContinueRect, settings.autoContinue, 'Auto-continue on (re)start');

            this._drawAutoOpenMenuRow(ctx, bodyRect, bodyRect.y + ROW_HEIGHT * nextRow++);

            this._drawOpenMilestonesRow(ctx, bodyRect, bodyRect.y + ROW_HEIGHT * nextRow++);

            if (this.onDebugStatIncrement) {
                this._drawTestStatRow(ctx, bodyRect, bodyRect.y + ROW_HEIGHT * nextRow++);
            }
            if (this.onDebugGrantTalent) {
                this._drawGrantTalentRow(ctx, bodyRect, bodyRect.y + ROW_HEIGHT * nextRow++);
            }
            if (this.onOpenArmorSpawner) {
                this._drawArmorSpawnerRow(ctx, bodyRect, bodyRect.y + ROW_HEIGHT * nextRow++);
            }
        }

        let y = bodyRect.y + ROW_HEIGHT * nextRow;
        this._drawUiScaleStepper(ctx, bodyRect, y);
        y += STEP_ROW_HEIGHT;

        y = this._drawHotkeysSection(ctx, bodyRect, y);

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

        // Drawn last so the open option list overlays whatever's below it.
        if (this._menuDropdownOpen && this._menuDropdownRect) {
            this._drawAutoOpenMenuOptions(ctx);
        }
        if (this._statDropdownOpen && this._statDropdownRect) {
            this._drawTestStatOptions(ctx);
        }
        if (this._talentDropdownOpen && this._talentDropdownRect) {
            this._drawGrantTalentOptions(ctx);
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

    _drawAutoOpenMenuRow(ctx, bodyRect, rowY) {
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Auto-open menu', bodyRect.x, rowY + DROPDOWN_ROW_HEIGHT / 2 + 5);

        this._menuDropdownRect = {
            x: bodyRect.x + bodyRect.width - DROPDOWN_WIDTH,
            y: rowY,
            width: DROPDOWN_WIDTH,
            height: DROPDOWN_ROW_HEIGHT,
        };
        const current = AUTO_OPEN_MENU_OPTIONS.find((o) => o.value === settings.autoOpenMenu) ?? AUTO_OPEN_MENU_OPTIONS[0];

        ctx.fillStyle = '#242424';
        ctx.fillRect(this._menuDropdownRect.x, this._menuDropdownRect.y, this._menuDropdownRect.width, this._menuDropdownRect.height);
        ctx.strokeStyle = '#555';
        ctx.strokeRect(this._menuDropdownRect.x, this._menuDropdownRect.y, this._menuDropdownRect.width, this._menuDropdownRect.height);

        ctx.fillStyle = '#e0e0e0';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(current.label, this._menuDropdownRect.x + 8, rowY + DROPDOWN_ROW_HEIGHT / 2 + 5);
        ctx.textAlign = 'right';
        ctx.fillText(this._menuDropdownOpen ? '▲' : '▼', this._menuDropdownRect.x + DROPDOWN_WIDTH - 8, rowY + DROPDOWN_ROW_HEIGHT / 2 + 5);
    }

    _drawAutoOpenMenuOptions(ctx) {
        this._menuOptionRects = [];
        let optY = this._menuDropdownRect.y + this._menuDropdownRect.height;

        for (const option of AUTO_OPEN_MENU_OPTIONS) {
            const rect = { x: this._menuDropdownRect.x, y: optY, width: DROPDOWN_WIDTH, height: DROPDOWN_ROW_HEIGHT, value: option.value };
            this._menuOptionRects.push(rect);

            const selected = option.value === settings.autoOpenMenu;
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

    _drawOpenMilestonesRow(ctx, bodyRect, rowY) {
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Milestones', bodyRect.x, rowY + MILESTONES_BUTTON_HEIGHT / 2 + 5);

        this._openMilestonesRect = {
            x: bodyRect.x + bodyRect.width - MILESTONES_BUTTON_WIDTH,
            y: rowY,
            width: MILESTONES_BUTTON_WIDTH,
            height: MILESTONES_BUTTON_HEIGHT,
        };
        ctx.fillStyle = '#242424';
        ctx.fillRect(this._openMilestonesRect.x, this._openMilestonesRect.y, MILESTONES_BUTTON_WIDTH, MILESTONES_BUTTON_HEIGHT);
        ctx.strokeStyle = '#555';
        ctx.strokeRect(this._openMilestonesRect.x, this._openMilestonesRect.y, MILESTONES_BUTTON_WIDTH, MILESTONES_BUTTON_HEIGHT);

        ctx.fillStyle = '#e0e0e0';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            'Open ↗',
            this._openMilestonesRect.x + MILESTONES_BUTTON_WIDTH / 2,
            rowY + MILESTONES_BUTTON_HEIGHT / 2 + 5
        );
    }

    _drawTestStatRow(ctx, bodyRect, rowY) {
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Test stat', bodyRect.x, rowY + STAT_PLUS_BUTTON_SIZE / 2 + 5);

        const controlsRight = bodyRect.x + bodyRect.width;
        this._statPlusRect = { x: controlsRight - STAT_PLUS_BUTTON_SIZE, y: rowY, width: STAT_PLUS_BUTTON_SIZE, height: STAT_PLUS_BUTTON_SIZE };
        this._statDropdownRect = {
            x: this._statPlusRect.x - 6 - STAT_DROPDOWN_WIDTH,
            y: rowY,
            width: STAT_DROPDOWN_WIDTH,
            height: DROPDOWN_ROW_HEIGHT,
        };
        const current = DEBUG_STAT_OPTIONS.find((o) => o.value === this._debugStatKey) ?? DEBUG_STAT_OPTIONS[0];

        ctx.fillStyle = '#242424';
        ctx.fillRect(this._statDropdownRect.x, this._statDropdownRect.y, this._statDropdownRect.width, this._statDropdownRect.height);
        ctx.strokeStyle = '#555';
        ctx.strokeRect(this._statDropdownRect.x, this._statDropdownRect.y, this._statDropdownRect.width, this._statDropdownRect.height);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(current.label, this._statDropdownRect.x + 8, rowY + DROPDOWN_ROW_HEIGHT / 2 + 5);
        ctx.textAlign = 'right';
        ctx.fillText(this._statDropdownOpen ? '▲' : '▼', this._statDropdownRect.x + STAT_DROPDOWN_WIDTH - 8, rowY + DROPDOWN_ROW_HEIGHT / 2 + 5);

        this._drawStepButton(ctx, this._statPlusRect, '+');
    }

    _drawTestStatOptions(ctx) {
        this._statOptionRects = [];
        let optY = this._statDropdownRect.y + this._statDropdownRect.height;

        for (const option of DEBUG_STAT_OPTIONS) {
            const rect = { x: this._statDropdownRect.x, y: optY, width: STAT_DROPDOWN_WIDTH, height: DROPDOWN_ROW_HEIGHT, value: option.value };
            this._statOptionRects.push(rect);

            const selected = option.value === this._debugStatKey;
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

    _drawGrantTalentRow(ctx, bodyRect, rowY) {
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Grant talent', bodyRect.x, rowY + TALENT_PLUS_BUTTON_SIZE / 2 + 5);

        const controlsRight = bodyRect.x + bodyRect.width;
        this._talentPlusRect = { x: controlsRight - TALENT_PLUS_BUTTON_SIZE, y: rowY, width: TALENT_PLUS_BUTTON_SIZE, height: TALENT_PLUS_BUTTON_SIZE };
        this._talentDropdownRect = {
            x: this._talentPlusRect.x - 6 - TALENT_DROPDOWN_WIDTH,
            y: rowY,
            width: TALENT_DROPDOWN_WIDTH,
            height: DROPDOWN_ROW_HEIGHT,
        };
        const current = DEBUG_TALENT_OPTIONS.find((o) => o.value === this._debugTalentKey) ?? DEBUG_TALENT_OPTIONS[0];

        ctx.fillStyle = '#242424';
        ctx.fillRect(this._talentDropdownRect.x, this._talentDropdownRect.y, this._talentDropdownRect.width, this._talentDropdownRect.height);
        ctx.strokeStyle = '#555';
        ctx.strokeRect(this._talentDropdownRect.x, this._talentDropdownRect.y, this._talentDropdownRect.width, this._talentDropdownRect.height);
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(current?.label ?? '—', this._talentDropdownRect.x + 8, rowY + DROPDOWN_ROW_HEIGHT / 2 + 5);
        ctx.textAlign = 'right';
        ctx.fillText(this._talentDropdownOpen ? '▲' : '▼', this._talentDropdownRect.x + TALENT_DROPDOWN_WIDTH - 8, rowY + DROPDOWN_ROW_HEIGHT / 2 + 5);

        this._drawStepButton(ctx, this._talentPlusRect, '+');
    }

    _drawGrantTalentOptions(ctx) {
        this._talentOptionRects = [];
        let optY = this._talentDropdownRect.y + this._talentDropdownRect.height;

        for (const option of DEBUG_TALENT_OPTIONS) {
            const rect = { x: this._talentDropdownRect.x, y: optY, width: TALENT_DROPDOWN_WIDTH, height: DROPDOWN_ROW_HEIGHT, value: option.value };
            this._talentOptionRects.push(rect);

            const selected = option.value === this._debugTalentKey;
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

    _drawArmorSpawnerRow(ctx, bodyRect, rowY) {
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('Spawn Armor', bodyRect.x, rowY + ARMOR_SPAWNER_BUTTON_HEIGHT / 2 + 5);

        this._armorSpawnerRect = {
            x: bodyRect.x + bodyRect.width - ARMOR_SPAWNER_BUTTON_WIDTH,
            y: rowY,
            width: ARMOR_SPAWNER_BUTTON_WIDTH,
            height: ARMOR_SPAWNER_BUTTON_HEIGHT,
        };
        ctx.fillStyle = '#242424';
        ctx.fillRect(this._armorSpawnerRect.x, this._armorSpawnerRect.y, ARMOR_SPAWNER_BUTTON_WIDTH, ARMOR_SPAWNER_BUTTON_HEIGHT);
        ctx.strokeStyle = '#555';
        ctx.strokeRect(this._armorSpawnerRect.x, this._armorSpawnerRect.y, ARMOR_SPAWNER_BUTTON_WIDTH, ARMOR_SPAWNER_BUTTON_HEIGHT);

        ctx.fillStyle = '#e0e0e0';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
            'Open ↗',
            this._armorSpawnerRect.x + ARMOR_SPAWNER_BUTTON_WIDTH / 2,
            rowY + ARMOR_SPAWNER_BUTTON_HEIGHT / 2 + 5
        );
    }

    // Always-visible (not debug-gated) rebindable-hotkey list — returns the y
    // position just past what it drew, so the caller can keep flowing
    // whatever comes after it (currently just the Exit button, which is
    // bottom-anchored and doesn't need it, but keeps this self-contained).
    _drawHotkeysSection(ctx, bodyRect, startY) {
        ctx.fillStyle = '#888';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('HOTKEYS', bodyRect.x, startY + HOTKEY_HEADER_HEIGHT - 8);

        this._hotkeyButtonRects = [];
        let y = startY + HOTKEY_HEADER_HEIGHT;
        for (const action of HOTKEY_ACTIONS) {
            ctx.fillStyle = '#e0e0e0';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(action.label, bodyRect.x, y + HOTKEY_BUTTON_HEIGHT / 2 + 5);

            const rect = { id: action.id, x: bodyRect.x + bodyRect.width - HOTKEY_BUTTON_WIDTH, y, width: HOTKEY_BUTTON_WIDTH, height: HOTKEY_BUTTON_HEIGHT };
            this._hotkeyButtonRects.push(rect);

            const listening = this._listeningHotkey === action.id;
            ctx.fillStyle = listening ? '#2f4f7a' : '#242424';
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            ctx.strokeStyle = listening ? '#6fa8dc' : '#555';
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

            ctx.fillStyle = '#e0e0e0';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(
                listening ? '…' : settings.keybinds[action.id].toUpperCase(),
                rect.x + rect.width / 2,
                rect.y + rect.height / 2 + 5
            );

            y += ROW_HEIGHT;
        }
        return y;
    }

    _drawUiScaleStepper(ctx, bodyRect, rowY) {
        ctx.fillStyle = '#e0e0e0';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('UI Scale', bodyRect.x, rowY + STEP_BUTTON_SIZE - 5);

        const controlsRight = bodyRect.x + bodyRect.width;
        const percentWidth = 44;
        this._uiScalePlusRect = { x: controlsRight - STEP_BUTTON_SIZE, y: rowY, width: STEP_BUTTON_SIZE, height: STEP_BUTTON_SIZE };
        const percentX = this._uiScalePlusRect.x - 6 - percentWidth;
        this._uiScaleMinusRect = { x: percentX - 6 - STEP_BUTTON_SIZE, y: rowY, width: STEP_BUTTON_SIZE, height: STEP_BUTTON_SIZE };

        this._drawStepButton(ctx, this._uiScaleMinusRect, '-');
        this._drawStepButton(ctx, this._uiScalePlusRect, '+');

        ctx.fillStyle = '#e0e0e0';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(settings.uiScale * 100)}%`, percentX + percentWidth / 2, rowY + STEP_BUTTON_SIZE - 5);
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

    onBodyClick(x, y, bodyRect, manager) {
        // A hotkey button waiting for its next keypress: clicking another
        // hotkey button switches which one is listening, clicking anything
        // else just cancels (swallowing the click either way, so it can't
        // also trigger whatever's underneath).
        if (this._listeningHotkey) {
            const hit = (this._hotkeyButtonRects || []).find((r) => this._hit(r, x, y));
            this._listeningHotkey = hit ? hit.id : null;
            return;
        }

        // The open dropdown captures the next click no matter where in the
        // body it lands — pick an option if one was clicked, then close either way.
        if (this._menuDropdownOpen) {
            const hit = (this._menuOptionRects || []).find((r) => this._hit(r, x, y));
            if (hit) {
                settings.autoOpenMenu = hit.value;
                saveSettings();
            }
            this._menuDropdownOpen = false;
            return;
        }
        if (this._statDropdownOpen) {
            const hit = (this._statOptionRects || []).find((r) => this._hit(r, x, y));
            if (hit) this._debugStatKey = hit.value;
            this._statDropdownOpen = false;
            return;
        }
        if (this._talentDropdownOpen) {
            const hit = (this._talentOptionRects || []).find((r) => this._hit(r, x, y));
            if (hit) this._debugTalentKey = hit.value;
            this._talentDropdownOpen = false;
            return;
        }
        if (this._hit(this._menuDropdownRect, x, y)) {
            this._menuDropdownOpen = true;
            return;
        }
        if (this._hit(this._statDropdownRect, x, y)) {
            this._statDropdownOpen = true;
            return;
        }
        if (this._hit(this._talentDropdownRect, x, y)) {
            this._talentDropdownOpen = true;
            return;
        }

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
        if (this._hit(this._collisionRect, x, y)) {
            settings.showCollision = !settings.showCollision;
            saveSettings();
            return;
        }
        if (this._hit(this._refillRect, x, y)) {
            settings.refillContainers = !settings.refillContainers;
            saveSettings();
            return;
        }
        if (this._hit(this._autoContinueRect, x, y)) {
            settings.autoContinue = !settings.autoContinue;
            saveSettings();
            return;
        }
        if (this._hit(this._openMilestonesRect, x, y)) {
            window.open('milestones.html', '_blank');
            return;
        }
        if (this._hit(this._statPlusRect, x, y)) {
            this.onDebugStatIncrement?.(this._debugStatKey);
            return;
        }
        if (this._hit(this._talentPlusRect, x, y)) {
            this.onDebugGrantTalent?.(this._debugTalentKey);
            return;
        }
        if (this._hit(this._armorSpawnerRect, x, y)) {
            this.onOpenArmorSpawner?.();
            return;
        }
        const hotkeyHit = (this._hotkeyButtonRects || []).find((r) => this._hit(r, x, y));
        if (hotkeyHit) {
            this._listeningHotkey = hotkeyHit.id;
            return;
        }
        if (this._hit(this._uiScaleMinusRect, x, y)) {
            this._adjustUiScale(-UI_SCALE_STEP);
            return;
        }
        if (this._hit(this._uiScalePlusRect, x, y)) {
            this._adjustUiScale(UI_SCALE_STEP);
            return;
        }
        if (this.showExitButton && this._hit(this._exitRect, x, y)) {
            manager.switchTo('title');
        }
    }

    // Intercepts the next keypress while a hotkey button is "listening"
    // (clicked, awaiting reassignment) instead of falling through to Popup's
    // default Escape-closes-the-popup behavior — Escape here just cancels
    // listening, matching the click-away cancel in onBodyClick. Single
    // printable characters only (movement/interact excluded via
    // RESERVED_KEYS) — modifier/function keys are silently rejected rather
    // than bound, since they don't fire like a normal keydown for gameplay.
    onKeyDown(key, manager) {
        if (this._listeningHotkey) {
            if (key !== 'Escape') {
                const normalized = key.toLowerCase();
                if (normalized.length === 1 && !RESERVED_KEYS.has(normalized)) {
                    settings.keybinds[this._listeningHotkey] = normalized;
                    saveSettings();
                }
            }
            this._listeningHotkey = null;
            return;
        }
        super.onKeyDown(key, manager);
    }

    _adjustUiScale(delta) {
        const next = Math.round((settings.uiScale + delta) * 100) / 100;
        settings.uiScale = Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, next));
        saveSettings();
    }
}
