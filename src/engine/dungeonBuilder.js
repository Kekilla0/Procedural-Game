// src/engine/dungeonBuilder.js
//
// DungeonBuilder produces dungeon DATA (not entities, not rendering).
// Track B: dungeon size dictates world/canvas size.
//
// This file provides:
// - static computeRoomCount({playerLevel, monsterLevel, difficultyLevel})
// - static estimateWorldSize({playerLevel, monsterLevel, difficultyLevel, ...})
// - buildDungeon({playerLevel, monsterLevel, difficultyLevel, z})
//
// Dungeon output fields (data-first):
// - rooms: [{ left,right,top,bottom, doorKeys: [] }, ...]
// - floor: Set<tileKey>
// - blocked: Set<tileKey>   (perimeter walls + any closed doors; corridors/floor unblocked)
// - doors: Map<tileKey, { open: boolean }>
// - walls: [{ from:{col,row,z}, to:{col,row,z} }, ...]  (render segments on WALLS layer)
// - meta: { name, notes }
// - spawn: { col,row,z } (suggested player spawn inside room[0])

function keyOf(col, row, z = 0) {
  return `${col},${row},${z}`;
}

function parseKey(k) {
  const [col, row, z] = k.split(",").map(Number);
  return { col, row, z };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function inBounds(col, row, world) {
  return col >= 0 && row >= 0 && col < world.w && row < world.h;
}

function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

// Odd-r offset neighbors for pointy-top hexes
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

function baseRoomsFromDelta(delta) {
  // Matches the progression you described
  if (delta <= -4) return 3;
  if (delta === -3) return 4;
  if (delta === -2) return 4;
  if (delta === -1) return 5;
  return 5; // delta >= 0 baseline
}

function deltaBonus(delta, k = 1.35) {
  // delta must be >= 1
  return Math.ceil(k * Math.sqrt(delta));
}

function rectsOverlap(a, b, pad = 0) {
  return !(
    a.right + pad < b.left ||
    a.left - pad > b.right ||
    a.bottom + pad < b.top ||
    a.top - pad > b.bottom
  );
}

function rectCenter(r) {
  return {
    col: Math.floor((r.left + r.right) / 2),
    row: Math.floor((r.top + r.bottom) / 2),
  };
}

function rectContains(r, col, row) {
  return col >= r.left && col <= r.right && row >= r.top && row <= r.bottom;
}

// BFS for corridors in “carve mode”:
// - Walk only in-bounds
// - Prefer straight-ish movement by ordering directions
// - Allow pathing through empty space and through corridor tiles already carved
function bfsPath(world, start, goal, blockedSet, z = 0) {
  const startK = keyOf(start.col, start.row, z);
  const goalK = keyOf(goal.col, goal.row, z);

  const q = [{ col: start.col, row: start.row }];
  const visited = new Set([startK]);
  const parent = new Map();

  // Direction order biases "mostly east/west first" then diagonals
  const dirs = ["E", "W", "NE", "NW", "SE", "SW"];

  while (q.length) {
    const cur = q.shift();
    const ck = keyOf(cur.col, cur.row, z);
    if (ck === goalK) break;

    for (const dir of dirs) {
      const n = neighborOddR(cur.col, cur.row, dir);
      if (!inBounds(n.col, n.row, world)) continue;

      const nk = keyOf(n.col, n.row, z);
      if (visited.has(nk)) continue;

      // For corridor carving, we DO allow walking through blocked tiles,
      // because "blocked" includes room perimeter walls.
      // Instead, we treat out-of-bounds as hard stop only.
      // This keeps corridor carving simple.
      visited.add(nk);
      parent.set(nk, ck);
      q.push({ col: n.col, row: n.row });
    }
  }

  if (!parent.has(goalK) && goalK !== startK) return null;

  // reconstruct
  const path = [];
  let k = goalK;
  while (k && k !== startK) {
    const { col, row } = parseKey(k);
    path.push({ col, row });
    k = parent.get(k);
  }
  path.reverse();
  return path;
}

export class DungeonBuilder {
  constructor({ world, rng = Math.random } = {}) {
    if (!world) throw new Error("DungeonBuilder requires { world }");
    this.world = world;
    this.rng = rng;
  }

  // ---------- Track B: sizing helpers ----------

  static computeRoomCount({ playerLevel, monsterLevel, difficultyLevel }) {
    const delta = (playerLevel | 0) - (monsterLevel | 0);
    const base = baseRoomsFromDelta(delta);
    const difficultyRooms = (difficultyLevel | 0) * 2;

    let rooms = base + difficultyRooms;

    if (delta >= 1) rooms += deltaBonus(delta, 1.35);

    // Always enforce minimum 3
    rooms = Math.max(3, rooms);
    return rooms | 0;
  }

  static estimateWorldSize({
    playerLevel,
    monsterLevel,
    difficultyLevel,
    // Tuning knobs (safe defaults)
    roomMinW = 7,
    roomMaxW = 11,
    roomMinH = 5,
    roomMaxH = 9,
    margin = 6,
    corridorPad = 3,
  }) {
    const roomCount = DungeonBuilder.computeRoomCount({ playerLevel, monsterLevel, difficultyLevel });

    // Conservative packing estimate: approximate a square of "cells"
    const side = Math.ceil(Math.sqrt(roomCount));

    // Cell size should cover one room plus spacing for corridors
    const cellW = roomMaxW + corridorPad;
    const cellH = roomMaxH + corridorPad;

    // Convert to world dims with margin padding on all sides
    const w = side * cellW + margin * 2;
    const h = side * cellH + margin * 2;

    return {
      roomCount,
      w: Math.max(15, w | 0),
      h: Math.max(15, h | 0),
    };
  }

  // ---------- Main builder ----------

  /**
   * Procedurally generates:
   * - N rooms
   * - corridors connecting them sequentially
   * - doors at room/corridor junctions
   *
   * Current room geometry: odd-r rectangle in col/row space.
   * Walls: perimeter tiles are blocked.
   * Corridors: carved by clearing blocked tiles along a path.
   */
  buildDungeon({
    playerLevel = 1,
    monsterLevel = 1,
    difficultyLevel = 1,
    z = 0,

    // room sizing knobs (can be made difficulty-dependent later)
    roomMinW = 7,
    roomMaxW = 11,
    roomMinH = 5,
    roomMaxH = 9,

    // placement knobs
    roomPad = 2,       // minimum spacing between rooms (prevents overlaps)
    maxRoomAttempts = 80,

    // corridor knobs
    corridorWidth = 1, // keep at 1 for now
  } = {}) {
    const world = this.world;
    const rng = this.rng;

    const roomCount = DungeonBuilder.computeRoomCount({ playerLevel, monsterLevel, difficultyLevel });

    const floor = new Set();
    const blocked = new Set();
    const doors = new Map();
    const walls = [];
    const rooms = [];

    const margin = 2;

    function stampRoom(roomRect) {
      // interior floor
      for (let row = roomRect.top + 1; row <= roomRect.bottom - 1; row++) {
        for (let col = roomRect.left + 1; col <= roomRect.right - 1; col++) {
          if (!inBounds(col, row, world)) continue;
          floor.add(keyOf(col, row, z));
        }
      }

      // perimeter walls blocked (doors carve gaps later)
      for (let row = roomRect.top; row <= roomRect.bottom; row++) {
        for (let col = roomRect.left; col <= roomRect.right; col++) {
          if (!inBounds(col, row, world)) continue;
          const isEdge = row === roomRect.top || row === roomRect.bottom || col === roomRect.left || col === roomRect.right;
          if (!isEdge) continue;
          blocked.add(keyOf(col, row, z));
        }
      }
    }

    function addDoorTile(col, row, open = false) {
      const k = keyOf(col, row, z);
      doors.set(k, { open: !!open });
      if (open) blocked.delete(k);
      else blocked.add(k);
      return k;
    }

    function carveTile(col, row) {
      const k = keyOf(col, row, z);
      floor.add(k);
      blocked.delete(k);
    }

    function carveCorridor(path) {
      if (!Array.isArray(path)) return;
      for (const p of path) {
        // corridor width == 1 for now (future: widen around p)
        carveTile(p.col, p.row);
      }
    }

    function pickPerimeterDoorToward(roomRect, targetCol, targetRow) {
      // Choose a perimeter tile on the side most “facing” the target.
      // Returns {col,row}.
      const c = rectCenter(roomRect);
      const dc = targetCol - c.col;
      const dr = targetRow - c.row;

      // Prefer horizontal vs vertical-ish based on magnitude
      if (Math.abs(dc) >= Math.abs(dr)) {
        // East or West side
        if (dc >= 0) {
          // right wall
          return { col: roomRect.right, row: clamp(targetRow, roomRect.top + 1, roomRect.bottom - 1) };
        }
        return { col: roomRect.left, row: clamp(targetRow, roomRect.top + 1, roomRect.bottom - 1) };
      } else {
        // North or South side
        if (dr >= 0) {
          // bottom wall
          return { col: clamp(targetCol, roomRect.left + 1, roomRect.right - 1), row: roomRect.bottom };
        }
        return { col: clamp(targetCol, roomRect.left + 1, roomRect.right - 1), row: roomRect.top };
      }
    }

    function rebuildWallSegmentsForRoom(roomRect, doorKeys) {
      // doorKeys are tile keys on the perimeter that should create a gap in segments
      const doorSet = new Set(doorKeys);

      function seg(aCol, aRow, bCol, bRow) {
        walls.push({ from: { col: aCol, row: aRow, z }, to: { col: bCol, row: bRow, z } });
      }

      // top edge
      for (let col = roomRect.left; col < roomRect.right; col++) {
        const a = keyOf(col, roomRect.top, z);
        const b = keyOf(col + 1, roomRect.top, z);
        if (doorSet.has(a) || doorSet.has(b)) continue;
        if (!inBounds(col, roomRect.top, world) || !inBounds(col + 1, roomRect.top, world)) continue;
        seg(col, roomRect.top, col + 1, roomRect.top);
      }

      // bottom edge
      for (let col = roomRect.left; col < roomRect.right; col++) {
        const a = keyOf(col, roomRect.bottom, z);
        const b = keyOf(col + 1, roomRect.bottom, z);
        if (doorSet.has(a) || doorSet.has(b)) continue;
        if (!inBounds(col, roomRect.bottom, world) || !inBounds(col + 1, roomRect.bottom, world)) continue;
        seg(col, roomRect.bottom, col + 1, roomRect.bottom);
      }

      // left edge
      for (let row = roomRect.top; row < roomRect.bottom; row++) {
        const a = keyOf(roomRect.left, row, z);
        const b = keyOf(roomRect.left, row + 1, z);
        if (doorSet.has(a) || doorSet.has(b)) continue;
        if (!inBounds(roomRect.left, row, world) || !inBounds(roomRect.left, row + 1, world)) continue;
        seg(roomRect.left, row, roomRect.left, row + 1);
      }

      // right edge
      for (let row = roomRect.top; row < roomRect.bottom; row++) {
        const a = keyOf(roomRect.right, row, z);
        const b = keyOf(roomRect.right, row + 1, z);
        if (doorSet.has(a) || doorSet.has(b)) continue;
        if (!inBounds(roomRect.right, row, world) || !inBounds(roomRect.right, row + 1, world)) continue;
        seg(roomRect.right, row, roomRect.right, row + 1);
      }
    }

    // --- 1) Place rooms ---
    // First room is centered to keep camera/testing sane.
    const centerCol = Math.floor((world.w - 1) / 2);
    const centerRow = Math.floor((world.h - 1) / 2);

    function tryPlaceRoomAtCenter(col, row, w, h) {
      const left = col - Math.floor(w / 2);
      const right = left + w - 1;
      const top = row - Math.floor(h / 2);
      const bottom = top + h - 1;

      // require in-bounds with margins
      if (left < margin || top < margin || right >= world.w - margin || bottom >= world.h - margin) return null;

      return { left, right, top, bottom, doorKeys: [] };
    }

    // room[0]
    {
      const rw = randInt(rng, roomMinW, roomMaxW);
      const rh = randInt(rng, roomMinH, roomMaxH);
      const r0 = tryPlaceRoomAtCenter(centerCol, centerRow, rw, rh);
      if (!r0) throw new Error("Failed to place initial room. Increase estimated world size.");
      rooms.push(r0);
      stampRoom(r0);
    }

    // remaining rooms
    for (let i = 1; i < roomCount; i++) {
      let placed = null;

      for (let a = 0; a < maxRoomAttempts; a++) {
        const rw = randInt(rng, roomMinW, roomMaxW);
        const rh = randInt(rng, roomMinH, roomMaxH);

        // Sample around the previous room center at some distance
        const prevC = rectCenter(rooms[i - 1]);
        const dist = randInt(rng, 6, 14);

        const angleBucket = randInt(rng, 0, 5);
        const dir = ["E", "W", "NE", "NW", "SE", "SW"][angleBucket];
        let candidate = { col: prevC.col, row: prevC.row };
        for (let s = 0; s < dist; s++) candidate = neighborOddR(candidate.col, candidate.row, dir);

        const rr = tryPlaceRoomAtCenter(candidate.col, candidate.row, rw, rh);
        if (!rr) continue;

        // Overlap test with padding
        let overlaps = false;
        for (const existing of rooms) {
          if (rectsOverlap(rr, existing, roomPad)) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) continue;

        placed = rr;
        break;
      }

      if (!placed) break; // if we can't place more, stop early (world may be tight)
      rooms.push(placed);
      stampRoom(placed);
    }

    // --- 2) Connect rooms with corridors + doors ---
    // For each new room, connect it to the previous room with one corridor.
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1];
      const b = rooms[i];

      const ac = rectCenter(a);
      const bc = rectCenter(b);

      // pick door tiles on perimeters facing each other
      const aDoorPos = pickPerimeterDoorToward(a, bc.col, bc.row);
      const bDoorPos = pickPerimeterDoorToward(b, ac.col, ac.row);

      // add doors (start closed for now; can change later)
      const aDoorKey = addDoorTile(aDoorPos.col, aDoorPos.row, false);
      const bDoorKey = addDoorTile(bDoorPos.col, bDoorPos.row, false);

      a.doorKeys.push(aDoorKey);
      b.doorKeys.push(bDoorKey);

      // carve the door tiles as passable only when open;
      // corridor carving should still carve around them, so carve corridor from just outside each door.
      // Compute start/goal corridor points one step outward from the door.
      function stepOut(roomRect, doorPos) {
        // Determine which side the door is on, then step outward
        if (doorPos.row === roomRect.top) return { col: doorPos.col, row: doorPos.row - 1 };
        if (doorPos.row === roomRect.bottom) return { col: doorPos.col, row: doorPos.row + 1 };
        if (doorPos.col === roomRect.left) return { col: doorPos.col - 1, row: doorPos.row };
        if (doorPos.col === roomRect.right) return { col: doorPos.col + 1, row: doorPos.row };
        // fallback
        return { col: doorPos.col, row: doorPos.row };
      }

      const start = stepOut(a, aDoorPos);
      const goal = stepOut(b, bDoorPos);

      if (inBounds(start.col, start.row, world)) carveTile(start.col, start.row);
      if (inBounds(goal.col, goal.row, world)) carveTile(goal.col, goal.row);

      const path = bfsPath(world, start, goal, blocked, z);
      if (path) carveCorridor(path);

      // Ensure corridor tiles do not accidentally remain blocked
      // (corridor carving already clears blocked)
    }

    // --- 3) Build wall segments (render-only) ---
    // Rebuild per room perimeter wall segments, skipping segments adjacent to doors.
    for (const r of rooms) {
      rebuildWallSegmentsForRoom(r, r.doorKeys);
    }

    // --- 4) Suggested spawn (inside room[0], 1 tile in from top-left) ---
    const r0 = rooms[0];
    const spawn = {
      col: clamp(r0.left + 2, 0, world.w - 1),
      row: clamp(r0.top + 2, 0, world.h - 1),
      z,
    };

    return Object.freeze({
      meta: Object.freeze({
        name: "Procedural Dungeon",
        notes:
          "Rooms + corridors. Perimeters blocked as walls. Doors are tiles stored in doors Map and reflected into blocked when closed.",
      }),
      rooms: rooms.map(r => Object.freeze({ ...r, doorKeys: [...r.doorKeys] })),
      spawn: Object.freeze(spawn),

      floor,
      blocked,
      doors,
      walls,
    });
  }

  // Backwards-compatible wrapper: single room + one door (your current working test)
  buildDefault({ z = 0 } = {}) {
    // Equivalent to a tiny procedural dungeon: 1 room
    const d = this.buildDungeon({
      playerLevel: 1,
      monsterLevel: 1,
      difficultyLevel: 0,
      z,
      roomMinW: 9,
      roomMaxW: 9,
      roomMinH: 7,
      roomMaxH: 7,
      maxRoomAttempts: 1,
    });

    // Ensure at least one door exists (center of bottom wall) to keep your current behavior
    const r0 = d.rooms[0];
    const doorCol = Math.floor((r0.left + r0.right) / 2);
    const doorRow = r0.bottom;
    const k = keyOf(doorCol, doorRow, z);

    if (!d.doors.has(k)) {
      // NOTE: d is frozen. So rebuild a compatible “single room + door” dungeon object here.
      const blocked = new Set(d.blocked);
      const floor = new Set(d.floor);
      const doors = new Map(d.doors);
      const walls = Array.isArray(d.walls) ? [...d.walls] : [];
      const rooms = d.rooms.map(r => ({ ...r, doorKeys: [...(r.doorKeys ?? [])] }));

      doors.set(k, { open: false });
      blocked.add(k);
      rooms[0].doorKeys.push(k);

      // Remove wall segments adjacent to the door tile for a gap
      // (Simpler: keep as-is; DOORS layer shows it and movement uses blocked)
      return Object.freeze({
        meta: Object.freeze({ name: "Single Room + Door", notes: "Default test room." }),
        rooms: rooms.map(r => Object.freeze(r)),
        spawn: d.spawn,
        floor,
        blocked,
        doors,
        walls,
        door: Object.freeze({ col: doorCol, row: doorRow, z }),
      });
    }

    // Provide the old convenience door pointer if it exists
    return Object.freeze({
      ...d,
      door: Object.freeze({ col: Math.floor((r0.left + r0.right) / 2), row: r0.bottom, z }),
    });
  }
}
