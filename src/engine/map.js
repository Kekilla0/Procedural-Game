import { offsetToAxial, axialToOffset, axialToCube, cubeRound } from "./hex.js";
import { axialToWorld2D, world2DToAxial } from "./coords.js";

// --- Wall representation ---
// Each wall: { a:{wx,wy}, b:{wx,wy} } in WORLD2D space (top-down plane)

export function createMap(WORLD) {
  const map = {
    walls: [],
    blocked: new Set(), // keys: "col,row"
  };

  // Example walls (feel free to delete these and add via editor later)
  // A diagonal-ish segment through the middle.
  {
    const mid = mapCenterWorld2D(WORLD);
    map.walls.push({
      a: { wx: mid.wx - 250, wy: mid.wy - 40 },
      b: { wx: mid.wx + 220, wy: mid.wy + 120 },
    });
  }

  rebuildBlocked(map, WORLD);
  return map;
}

export function key(col, row) {
  return `${col},${row}`;
}

export function isBlocked(map, col, row) {
  return map.blocked.has(key(col, row));
}

export function rebuildBlocked(map, WORLD) {
  map.blocked.clear();

  // Sampling step: smaller = more accurate, slightly more CPU.
  // Tie to hex size so scaling stays consistent.
  const step = Math.max(6, WORLD.hexSize * 0.35);

  for (const w of map.walls) {
    const dx = w.b.wx - w.a.wx;
    const dy = w.b.wy - w.a.wy;
    const len = Math.hypot(dx, dy);
    const n = Math.max(2, Math.ceil(len / step));

    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const wx = w.a.wx + dx * t;
      const wy = w.a.wy + dy * t;

      const off = world2DToOffset(wx, wy, WORLD);
      if (off.col < 0 || off.row < 0 || off.col >= WORLD.w || off.row >= WORLD.h) continue;
      map.blocked.add(key(off.col, off.row));
    }
  }
}

// Center of map in WORLD2D coordinates
export function mapCenterWorld2D(WORLD) {
  const centerCol = Math.floor((WORLD.w - 1) / 2);
  const centerRow = Math.floor((WORLD.h - 1) / 2);
  const a = offsetToAxial(centerCol, centerRow);
  const p = axialToWorld2D(a.q, a.r, WORLD.hexSize);
  return { wx: p.wx, wy: p.wy };
}

// Proper WORLD2D point -> offset using WORLD.hexSize
export function world2DToOffset(wx, wy, WORLD) {
  const frac = world2DToAxial(wx, wy, WORLD.hexSize);
  const cubeFrac = { x: frac.q, z: frac.r, y: -frac.q - frac.r };
  const cube = cubeRound(cubeFrac);
  const ax = { q: cube.x, r: cube.z };
  return axialToOffset(ax.q, ax.r);
}

// Patch rebuildBlocked to use the correct helper
function world2DPointToOffset(wx, wy) {
  throw new Error("world2DPointToOffset placeholder should not be called directly.");
}
