import { readJSON, writeJSON } from '../utils/storage.js';

const STORAGE_KEY = 'proceduralGame.settings';
const defaults = {
    debug: false,
    isometric: false,
    showCoords: false,
    showCollision: false,
    refillContainers: false,
    autoContinue: false,
    autoOpenMenu: 'none', // 'none' | 'character' | 'talent' | 'inventory'
    uiScale: 1,
    keybinds: { character: 'c', talent: 't', inventory: 'i' }, // rebindable in Settings; movement (wasd/arrows) and interact ('e') stay fixed
};

// Shared, mutable settings singleton. ES modules cache the module instance,
// so every importer sees the same object — no separate store/event plumbing needed yet.
// Loaded once from localStorage at startup; call saveSettings() after mutating
// a field to persist it (the checkboxes in SettingsPopup do this).
export const settings = { ...defaults, ...readJSON(STORAGE_KEY) };

export function saveSettings() {
    writeJSON(STORAGE_KEY, settings);
}
