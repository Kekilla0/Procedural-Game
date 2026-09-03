// Tiny localStorage JSON helpers shared by anything that persists state
// (settings, save games). Fails silently if storage is unavailable
// (private browsing, quota) — persistence is a nice-to-have, not fatal.
export function readJSON(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function writeJSON(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // ignore
    }
}
