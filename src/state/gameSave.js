import { readJSON, writeJSON } from '../utils/storage.js';

const STORAGE_KEY = 'proceduralGame.save';

export function hasSaveGame() {
    return readJSON(STORAGE_KEY) !== null;
}

export function loadSaveGame() {
    return normalizeSave(readJSON(STORAGE_KEY));
}

export function saveGameState(state) {
    writeJSON(STORAGE_KEY, state);
}

// Older saves only ever had `{ player: {col,row}, class }` (top-level
// `class`, no inventory/equipment/resources). Migrate that shape into
// today's `{ player: {col,row,classId,...} }` so Player.deserialize never
// has to know about the legacy key — it just sees a possibly-partial
// `player` object either way.
function normalizeSave(raw) {
    if (!raw) return raw;
    if (raw.player?.classId !== undefined) return raw; // already current shape
    return { player: { ...raw.player, classId: raw.class ?? null } };
}
