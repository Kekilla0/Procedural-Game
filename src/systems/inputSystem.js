// src/systems/inputSystem.js
//
// Keyboard + mouse input.
// - Q/E rotate
// - Keyboard 6-dir move (single step, blocked-aware)
// - Mouse hover -> game.hover (col,row,z)
// - Click -> if door under cursor: toggle it
//          else: move to any reachable hex within player.state.moveRange,
//          stepping 1 hex at a time along a BFS path (blocked-aware)

import { Data } from "../engine/data.js";
import { screenToWorldOffset } from "../engine/coords.js";

// ---------- helpers ----------

function clampRotation(rot) {
  const r = rot % 6;
  return r < 0 ? r + 6 : r;
}

function inBounds(col, row, world) {
  return col >= 0 && row >= 0 && col < world.w && row < world.h;
}

function tileKey(col, row, z = 0) {
  return `${col},${row},${z}`;
}

function isBlocked(game, col, row, z = 0) {
  return game.dungeon?.blocked?.has(tileKey(col, row, z)) ?? false;
}

/**
 * Odd-r offset neighbors for pointy-top hexes.
 * Directions: "E","W","NE","NW","SE","SW"
 */
function neighborOddR(col, row, dir) {
  const odd = row & 1;

  switch (dir) {
    case "E":  return { col: col + 1, row };
    case "W":  return { col: col - 1, row };

    case "NE": return odd ? { col: col + 1, row: row - 1 } : { col, row: row - 1 };
    case "NW": return odd ? { col, row: row - 1 } : { col: col - 1, row: row - 1 };

    case "SE": return odd ? { col: col + 1, row: row + 1 } : { col, row: row + 1 };
    case "SW": return odd ? { col, row: row + 1 } : { col: col - 1, row: row + 1 };

    default:
      return { col, row };
  }
}

function rotateLeft(game) {
  game.rotation = clampRotation(game.rotation - 1);
}

function rotateRight(game) {
  game.rotation = clampRotation(game.rotation + 1);
}

function tryMovePlayer(game, dir) {
  const p = game.getPlayer();
  if (!p) return;

  // If currently auto-moving, ignore manual steps
  if (Array.isArray(p.state?.movePath) && p.state.movePath.length > 0) return;

  const n = neighborOddR(p.col, p.row, dir);
  if (!inBounds(n.col, n.row, game.world)) return;
  if (isBlocked(game, n.col, n.row, p.z)) return;

  p.col = n.col;
  p.row = n.row;
}

/**
 * Door interaction:
 * - If hover tile is a door, toggle it open/closed.
 * - Update dungeon.blocked accordingly.
 * Returns true if a door was toggled.
 */
function tryToggleDoorAtHover(game) {
  const h = game.hover;
  if (h?.col == null) return false;

  const d = game.dungeon;
  if (!d?.doors || typeof d.doors.has !== "function") return false;

  const k = tileKey(h.col, h.row, h.z ?? 0);
  if (!d.doors.has(k)) return false;

  const door = d.doors.get(k);
  door.open = !door.open;

  // reflect passability into blocked set
  if (!d.blocked) d.blocked = new Set(); // safety
  if (door.open) d.blocked.delete(k);
  else d.blocked.add(k);

  return true;
}

/**
 * BFS pathfinding limited by maxSteps (blocked-aware).
 * Returns an array of steps [{col,row}, ...] excluding the start tile,
 * or null if unreachable within maxSteps.
 */
function findPathWithinRange(game, startCol, startRow, targetCol, targetRow, z, maxSteps) {
  if (startCol === targetCol && startRow === targetRow) return [];

  // Disallow targeting blocked tiles
  if (isBlocked(game, targetCol, targetRow, z)) return null;

  const startK = tileKey(startCol, startRow, z);
  const targetK = tileKey(targetCol, targetRow, z);

  const q = [{ col: startCol, row: startRow, d: 0 }];
  const visited = new Set([startK]);
  const parent = new Map(); // childKey -> parentKey

  const dirs = ["E", "W", "NE", "NW", "SE", "SW"];

  while (q.length) {
    const cur = q.shift();
    if (cur.d >= maxSteps) continue;

    for (const dir of dirs) {
      const n = neighborOddR(cur.col, cur.row, dir);
      if (!inBounds(n.col, n.row, game.world)) continue;

      const nk = tileKey(n.col, n.row, z);
      if (visited.has(nk)) continue;
      if (isBlocked(game, n.col, n.row, z)) continue;

      visited.add(nk);
      parent.set(nk, tileKey(cur.col, cur.row, z));

      if (nk === targetK) {
        // reconstruct path
        const path = [];
        let k = targetK;
        while (k !== startK) {
          const [cc, rr, zz] = k.split(",").map(Number);
          path.push({ col: cc, row: rr, z: zz });
          k = parent.get(k);
          if (!k) break;
        }
        path.reverse();
        return path.length <= maxSteps ? path.map(s => ({ col: s.col, row: s.row })) : null;
      }

      q.push({ col: n.col, row: n.row, d: cur.d + 1 });
    }
  }

  return null;
}

// ---------- system ----------

export const InputSystem = {
  init(game) {
    // --- UI buttons ---
    if (game.ui?.rotLeftBtn) game.ui.rotLeftBtn.addEventListener("click", () => rotateLeft(game));
    if (game.ui?.rotRightBtn) game.ui.rotRightBtn.addEventListener("click", () => rotateRight(game));

    // --- Keyboard ---
    window.addEventListener("keydown", (ev) => {
      const tag = ev.target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea") return;

      switch (ev.code) {
        case "KeyQ": rotateLeft(game); ev.preventDefault(); return;
        case "KeyE": rotateRight(game); ev.preventDefault(); return;

        case "KeyA": tryMovePlayer(game, "W");  ev.preventDefault(); return;
        case "KeyD": tryMovePlayer(game, "E");  ev.preventDefault(); return;
        case "KeyW": tryMovePlayer(game, "NW"); ev.preventDefault(); return;
        case "KeyS": tryMovePlayer(game, "SE"); ev.preventDefault(); return;
        case "KeyZ": tryMovePlayer(game, "SW"); ev.preventDefault(); return;
        case "KeyC": tryMovePlayer(game, "NE"); ev.preventDefault(); return;

        case "ArrowLeft":  tryMovePlayer(game, "W");  ev.preventDefault(); return;
        case "ArrowRight": tryMovePlayer(game, "E");  ev.preventDefault(); return;
        case "ArrowUp":    tryMovePlayer(game, "NW"); ev.preventDefault(); return;
        case "ArrowDown":  tryMovePlayer(game, "SE"); ev.preventDefault(); return;
        case "Home":       tryMovePlayer(game, "NE"); ev.preventDefault(); return;
        case "End":        tryMovePlayer(game, "SW"); ev.preventDefault(); return;

        default:
          return;
      }
    });

    // --- Mouse hover & click ---
    const topCanvas = game.getLayerCanvas(Data.Layers.TOKENS);
    if (!topCanvas) return;

    topCanvas.addEventListener("mousemove", (ev) => {
      const rect = topCanvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;

      const off = screenToWorldOffset(x, y, game.world, game);
      if (inBounds(off.col, off.row, game.world)) {
        game.hover.col = off.col;
        game.hover.row = off.row;
        game.hover.z = 0;
      } else {
        game.hover.col = null;
        game.hover.row = null;
        game.hover.z = 0;
      }
    });

    topCanvas.addEventListener("click", () => {
      const p = game.getPlayer();
      if (!p) return;

      // If currently auto-moving, ignore clicks
      if (Array.isArray(p.state?.movePath) && p.state.movePath.length > 0) return;

      // ---- Door interaction routing ----
      // Click the door tile to toggle it (open/closed)
      if (tryToggleDoorAtHover(game)) return;

      // ---- Move routing (range-limited, blocked-aware) ----
      const h = game.hover;
      if (h.col == null) return;

      const maxSteps = Number.isInteger(p.state?.moveRange) ? p.state.moveRange : 0;
      if (maxSteps <= 0) return;

      const path = findPathWithinRange(game, p.col, p.row, h.col, h.row, p.z, maxSteps);
      if (!path) return;

      p.state.movePath = path;
      p.state._moveStepDelay = 0.10;
      p.state._moveStepTimer = 0;
    });
  },

  update(game, dt) {
    const p = game.getPlayer();
    if (!p) return;

    const path = p.state?.movePath;
    if (!Array.isArray(path) || path.length === 0) return;

    const delay = typeof p.state._moveStepDelay === "number" ? p.state._moveStepDelay : 0.10;
    p.state._moveStepTimer = (p.state._moveStepTimer ?? 0) - dt;

    if (p.state._moveStepTimer > 0) return;

    const next = path.shift();
    if (next) {
      // Safety: avoid stepping into blocked tiles if dungeon changes mid-walk
      if (!isBlocked(game, next.col, next.row, p.z)) {
        p.col = next.col;
        p.row = next.row;
      } else {
        // Cancel movement if something blocks the next tile
        p.state.movePath = [];
      }
    }

    p.state._moveStepTimer = delay;

    if (p.state.movePath.length === 0) {
      p.state._moveStepTimer = 0;
    }
  },
};
