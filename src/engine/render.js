import { rotToLabel } from "./hex.js";
import { updateCameraFollow } from "./camera.js";
import {
  inBounds,
  worldToViewAxial,
  axialToScreen,
  screenToWorldOffset,
  axialToWorld2D,
  world2DToIsoScreen,
} from "./coords.js";

import { isBlocked, mapCenterWorld2D } from "./map.js";

function clear(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawDot(ctx, x, y, r = 7) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ff4d4d";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.lineWidth = 1;
}

function drawHexIso(ctx, q, r, WORLD, state, fill, stroke = "rgba(255,255,255,0.10)") {
  // Build hex corners in WORLD2D, then project each corner to ISO screen.
  const { wx, wy } = axialToWorld2D(q, r, WORLD.hexSize);
  const size = WORLD.hexSize;

  const pts = [];
  for (let k = 0; k < 6; k++) {
    const angle = (Math.PI / 180) * (30 + 60 * k); // pointy-top
    const cx = wx + size * Math.cos(angle);
    const cy = wy + size * Math.sin(angle);
    pts.push(world2DToIsoScreen(cx, cy, state.camera));
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

function rotateWorld2DPoint(wx, wy, cx, cy, stepsCW) {
  // Euclidean rotation by 60° increments around (cx,cy)
  const angle = -stepsCW * (Math.PI / 3); // clockwise
  const s = Math.sin(angle);
  const c = Math.cos(angle);

  const x = wx - cx;
  const y = wy - cy;

  const rx = x * c - y * s;
  const ry = x * s + y * c;

  return { wx: rx + cx, wy: ry + cy };
}

function drawWalls(ctx, WORLD, state) {
  if (!state.map) return;

  const center = mapCenterWorld2D(WORLD);

  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(210,210,210,0.75)";
  ctx.beginPath();

  for (const w of state.map.walls) {
    const aR = rotateWorld2DPoint(w.a.wx, w.a.wy, center.wx, center.wy, state.rotation);
    const bR = rotateWorld2DPoint(w.b.wx, w.b.wy, center.wx, center.wy, state.rotation);

    const aS = world2DToIsoScreen(aR.wx, aR.wy, state.camera);
    const bS = world2DToIsoScreen(bR.wx, bR.wy, state.camera);

    ctx.moveTo(aS.x, aS.y);
    ctx.lineTo(bS.x, bS.y);
  }

  ctx.stroke();
  ctx.lineWidth = 1;
}

function estimateVisibleBounds(WORLD, state) {
  const corners = [
    { x: 0, y: 0 },
    { x: state.canvas.width, y: 0 },
    { x: 0, y: state.canvas.height },
    { x: state.canvas.width, y: state.canvas.height },
  ];

  let minC = Infinity, minR = Infinity, maxC = -Infinity, maxR = -Infinity;
  for (const c of corners) {
    const off = screenToWorldOffset(c.x, c.y, WORLD, state);
    minC = Math.min(minC, off.col);
    minR = Math.min(minR, off.row);
    maxC = Math.max(maxC, off.col);
    maxR = Math.max(maxR, off.row);
  }

  const pad = WORLD.drawPadding;
  minC = Math.max(0, Math.floor(minC) - pad);
  minR = Math.max(0, Math.floor(minR) - pad);
  maxC = Math.min(WORLD.w - 1, Math.ceil(maxC) + pad);
  maxR = Math.min(WORLD.h - 1, Math.ceil(maxR) + pad);

  return { minC, minR, maxC, maxR };
}

export function render({ ctx, state, WORLD, player, hover }) {
  updateCameraFollow(player, WORLD, state);
  clear(ctx, state.canvas);

  const b = estimateVisibleBounds(WORLD, state);

  // Painter order: sort by screenY of hex centers
  const cells = [];
  for (let row = b.minR; row <= b.maxR; row++) {
    for (let col = b.minC; col <= b.maxC; col++) {
      if (!inBounds(col, row, 0, WORLD)) continue;

      const av = worldToViewAxial(col, row, WORLD, state);
      const p = axialToScreen(av.q, av.r, WORLD, state);

      cells.push({ col, row, q: av.q, r: av.r, sy: p.y });
    }
  }
  cells.sort((a, b) => a.sy - b.sy);

  // Draw tiles
  for (const cell of cells) {
    const { col, row, q, r } = cell;

    const blocked = state.map ? isBlocked(state.map, col, row) : false;
    const isHover = hover.col === col && hover.row === row;
    const isPlayer = player.col === col && player.row === row;

    let fill = "rgba(80, 110, 155, 0.18)";
    if ((col + row) % 2 === 0) fill = "rgba(80, 110, 155, 0.24)";
    if (blocked) fill = "rgba(35, 35, 35, 0.55)";
    if (isHover && !blocked) fill = "rgba(180, 220, 255, 0.26)";
    if (isPlayer && !blocked) fill = "rgba(255, 120, 120, 0.18)";

    drawHexIso(ctx, q, r, WORLD, state, fill);
  }

  // Draw walls over tiles
  drawWalls(ctx, WORLD, state);

  // Draw player dot
  const pav = worldToViewAxial(player.col, player.row, WORLD, state);
  const pp = axialToScreen(pav.q, pav.r, WORLD, state);
  drawDot(ctx, pp.x, pp.y, 7);

  if (state.ui) {
    state.ui.posLabel.textContent = `(${player.col}, ${player.row}, ${player.z})`;
    state.ui.rotLabel.textContent = rotToLabel(state.rotation);
  }
}
