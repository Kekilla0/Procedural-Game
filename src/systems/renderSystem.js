// src/systems/renderSystem.js

import { Data } from "../engine/data.js";
import {
  inBounds,
  worldToViewAxial,
  axialToScreen,
  screenToWorldOffset,
  axialToWorld2D,
  world2DToIsoScreen,
} from "../engine/coords.js";

// ----- drawing helpers -----

function drawDot(ctx, x, y, renderDef) {
  const r = renderDef?.radius ?? 6;

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);

  ctx.fillStyle = renderDef?.fill ?? "#ff4d4d";
  ctx.fill();

  ctx.strokeStyle = renderDef?.stroke ?? "rgba(0,0,0,0.35)";
  ctx.lineWidth = renderDef?.lineWidth ?? 2;
  ctx.stroke();

  ctx.lineWidth = 1;
}

function drawHexIso(ctx, q, r, hexSize, camera, fill, stroke = "rgba(255,255,255,0.10)") {
  const { wx, wy } = axialToWorld2D(q, r, hexSize);
  const size = hexSize;

  const pts = [];
  for (let k = 0; k < 6; k++) {
    const angle = (Math.PI / 180) * (30 + 60 * k);
    const cx = wx + size * Math.cos(angle);
    const cy = wy + size * Math.sin(angle);
    pts.push(world2DToIsoScreen(cx, cy, camera));
  }

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();

  ctx.fillStyle = fill;
  ctx.fill();

  ctx.strokeStyle = stroke;
  ctx.stroke();
}

// ----- hex math -----

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

function tileKey(col, row, z = 0) {
  return `${col},${row},${z}`;
}

function isBlocked(game, col, row, z = 0) {
  return game.dungeon?.blocked?.has(tileKey(col, row, z)) ?? false;
}

// BFS reachability with blocking
function computeReachable(game, fromCol, fromRow, range, z = 0) {
  const visited = new Set();
  const reachable = new Set();

  const startKey = tileKey(fromCol, fromRow, z);
  visited.add(startKey);
  reachable.add(startKey);

  const q = [{ col: fromCol, row: fromRow, d: 0 }];
  const dirs = ["E", "W", "NE", "NW", "SE", "SW"];

  while (q.length) {
    const cur = q.shift();
    if (cur.d >= range) continue;

    for (const dir of dirs) {
      const n = neighborOddR(cur.col, cur.row, dir);
      if (!inBounds(n.col, n.row, z, game.world)) continue;

      const k = tileKey(n.col, n.row, z);
      if (visited.has(k)) continue;
      if (isBlocked(game, n.col, n.row, z)) continue;

      visited.add(k);
      reachable.add(k);
      q.push({ col: n.col, row: n.row, d: cur.d + 1 });
    }
  }

  return reachable;
}

// ----- viewport bounds -----

function estimateVisibleBounds(game, canvas) {
  const { world } = game;

  const corners = [
    { x: 0, y: 0 },
    { x: canvas.width, y: 0 },
    { x: 0, y: canvas.height },
    { x: canvas.width, y: canvas.height },
  ];

  let minC = Infinity, minR = Infinity, maxC = -Infinity, maxR = -Infinity;

  for (const c of corners) {
    const off = screenToWorldOffset(c.x, c.y, world, game);
    minC = Math.min(minC, off.col);
    minR = Math.min(minR, off.row);
    maxC = Math.max(maxC, off.col);
    maxR = Math.max(maxR, off.row);
  }

  const pad = world.drawPadding;
  return {
    minC: Math.max(0, Math.floor(minC) - pad),
    minR: Math.max(0, Math.floor(minR) - pad),
    maxC: Math.min(world.w - 1, Math.ceil(maxC) + pad),
    maxR: Math.min(world.h - 1, Math.ceil(maxR) + pad),
  };
}

// ----- wall rendering -----

function worldTileCenterScreen(game, col, row) {
  const av = worldToViewAxial(col, row, game.world, game);
  return axialToScreen(av.q, av.r, game.world, game);
}

function drawDungeonWalls(game) {
  const ctx = game.getLayerCtx(Data.Layers.WALLS);
  if (!ctx) return;

  const walls = game.dungeon?.walls ?? [];
  if (!Array.isArray(walls) || walls.length === 0) return;

  ctx.save();

  // Style for walls (distinct, readable)
  ctx.strokeStyle = "rgba(230,230,230,0.85)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";

  for (const w of walls) {
    if (!w?.from || !w?.to) continue;

    const a = worldTileCenterScreen(game, w.from.col, w.from.row);
    const b = worldTileCenterScreen(game, w.to.col, w.to.row);

    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // subtle inner stroke to give it definition
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // reset for next wall
    ctx.strokeStyle = "rgba(230,230,230,0.85)";
    ctx.lineWidth = 6;
  }

  ctx.restore();
}

// ----- door rendering -----

function drawDungeonDoors(game) {
  const ctx = game.getLayerCtx(Data.Layers.DOORS);
  if (!ctx) return;

  const doors = game.dungeon?.doors;
  if (!doors || typeof doors.entries !== "function") return;

  ctx.save();

  for (const [k, door] of doors.entries()) {
    const [col, row, z] = k.split(",").map(Number);
    if (z !== 0) continue;

    const p = worldTileCenterScreen(game, col, row);

    // diamond marker (small)
    const s = 10;

    ctx.beginPath();
    ctx.moveTo(p.x, p.y - s);
    ctx.lineTo(p.x + s, p.y);
    ctx.lineTo(p.x, p.y + s);
    ctx.lineTo(p.x - s, p.y);
    ctx.closePath();

    if (door?.open) {
      ctx.fillStyle = "rgba(40,40,40,0.15)";
      ctx.fill();
      ctx.strokeStyle = "rgba(230,230,255,0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = "rgba(230,230,255,0.55)";
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  ctx.restore();
}

// ----- render system -----

export const RenderSystem = {
  render(game) {
    game.clearAllLayers();

    const bgCanvas = game.getLayerCanvas(Data.Layers.BACKGROUND);
    const bgCtx = game.getLayerCtx(Data.Layers.BACKGROUND);
    if (!bgCanvas || !bgCtx) return;

    const player = game.getPlayer();
    const moveRange = player?.state?.moveRange ?? 0;

    const reachable =
      player ? computeReachable(game, player.col, player.row, moveRange, player.z) : new Set();

    const hoverKey =
      game.hover?.col != null ? tileKey(game.hover.col, game.hover.row, game.hover.z) : null;

    // --- tiles on background layer ---
    const bounds = estimateVisibleBounds(game, bgCanvas);

    const cells = [];
    for (let row = bounds.minR; row <= bounds.maxR; row++) {
      for (let col = bounds.minC; col <= bounds.maxC; col++) {
        if (!inBounds(col, row, 0, game.world)) continue;

        const av = worldToViewAxial(col, row, game.world, game);
        const p = axialToScreen(av.q, av.r, game.world, game);
        cells.push({ col, row, q: av.q, r: av.r, sy: p.y });
      }
    }
    cells.sort((a, b) => a.sy - b.sy);

    for (const cell of cells) {
      const { col, row, q, r } = cell;
      const k = tileKey(col, row, 0);

      let fill =
        (col + row) % 2 === 0
          ? "rgba(80,110,155,0.24)"
          : "rgba(80,110,155,0.18)";

      // reachable + hover
      if (reachable.has(k)) fill = "rgba(120,255,160,0.14)";
      if (hoverKey === k && reachable.has(k)) fill = "rgba(180,220,255,0.28)";

      // player tile
      if (player && player.col === col && player.row === row) fill = "rgba(255,120,120,0.18)";

      // blocked tiles shaded (testing aid; later you may remove this)
      if (isBlocked(game, col, row, 0)) fill = "rgba(80,80,80,0.35)";

      drawHexIso(bgCtx, q, r, game.world.hexSize, game.camera, fill);
    }

    // --- draw dungeon walls on WALLS layer ---
    drawDungeonWalls(game);

    // --- draw dungeon doors on DOORS layer ---
    drawDungeonDoors(game);

    // --- entities layer-by-layer ---
    const layerOrder = [
      Data.Layers.INTERACTABLES,
      Data.Layers.TOKENS,
    ];

    for (const layerId of layerOrder) {
      const ctx = game.getLayerCtx(layerId);
      if (!ctx) continue;

      const ents = game.registry.byLayer(layerId);
      const drawable = [];

      for (const e of ents) {
        const def = Data.EntityTypes[e.type];
        if (!def) continue;

        const av = worldToViewAxial(e.col, e.row, game.world, game);
        const p = axialToScreen(av.q, av.r, game.world, game);
        drawable.push({ e, def, x: p.x, y: p.y });
      }

      drawable.sort((a, b) => a.y - b.y);

      for (const d of drawable) {
        if (d.def.render?.shape === "dot") drawDot(ctx, d.x, d.y, d.def.render);
      }
    }
  },
};
