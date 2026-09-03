import { readJSON, writeJSON } from '../utils/storage.js';

const STORAGE_KEY = 'proceduralGame.save';

export function hasSaveGame() {
    return readJSON(STORAGE_KEY) !== null;
}

export function loadSaveGame() {
    return readJSON(STORAGE_KEY);
}

export function saveGameState(state) {
    writeJSON(STORAGE_KEY, state);
}
