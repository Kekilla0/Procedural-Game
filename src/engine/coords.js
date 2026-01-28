import {
  offsetToAxial,
  axialToOffset,
  axialToCube,
  cubeToAxial,
  cubeRotate,
  cubeUnrotate,
  cubeSub,
  cubeAdd,
  cubeRound,
} from "./hex.js";

export function inBounds(col, row, z, WORLD) {
  return (
    col >= 0 && row >= 0 && z >= 0 &&
    col < WORLD.w && row < WORLD.h && z < WORLD.levels
  );
}

function mapCenterCube(WORLD) {
  const centerCol = Math.floor((WORLD.w - 1) / 2);
  const centerRow = Math.floor((WORLD.h - 1) / 2);
  const a = offsetToAxial(centerCol, centerRow);
  return axialToCube(a.q, a.r);
}

export function worldToViewAxial(col, row, WORLD, state) {
  const a = offsetToAxial(col, row);
  const c = axialToCube(a.q, a.r);

  const center = mapCenterCube(WORLD);
  const rel = cubeSub(c, center);
  const rot = cubeRotate(rel, state.rotation);
  const back = cubeAdd(rot, center);

  const av = cubeToAxial(back.x, back.y, back.z);
  return av;
}

export function viewToWorldOffset(qView, rView, WORLD, state) {
  const cView = axialToCube(qView, rView);
  const center = mapCenterCube(WORLD);

  const rel = cubeSub(cView, center);
  const unrot = cubeUnrotate(rel, state.rotation);
  const back = cubeAdd(unrot, center);

  const a = cubeToAxial(back.x, back.y, back.z);
  return axialToOffset(a.q, a.r);
}

// ----- Hex axial <-> "world 2D" (top-down hex plane) -----
export function axialToWorld2D(q, r, size) {
  // pointy-top
  const wx = size * Math.sqrt(3) * (q + r / 2);
  const wy = size * (3 / 2) * r;
  return { wx, wy };
}

export function world2DToAxial(wx, wy, size) {
  const q = (Math.sqrt(3) / 3 * wx - 1 / 3 * wy) / size;
  const r = (2 / 3 * wy) / size;
  return { q, r };
}

// ----- Isometric projection (affine) ----
export const ISO_A = 0.55;
export const ISO_B = 0.275;

export function world2DToIsoScreen(wx, wy, cam) {
  const sx = (wx - wy) * ISO_A + cam.x;
  const sy = (wx + wy) * ISO_B + cam.y;
  return { x: sx, y: sy };
}

export function isoScreenToWorld2D(sx, sy, cam) {
  const dx = sx - cam.x;
  const dy = sy - cam.y;

  const u = dx / ISO_A; // wx - wy
  const v = dy / ISO_B; // wx + wy

  const wx = (u + v) / 2;
  const wy = (v - u) / 2;
  return { wx, wy };
}


// ----- Public: axial <-> screen (ISOMETRIC) -----
export function axialToScreen(q, r, WORLD, state) {
  const { wx, wy } = axialToWorld2D(q, r, WORLD.hexSize);
  return world2DToIsoScreen(wx, wy, state.camera);
}

export function screenToAxial(screenX, screenY, WORLD, state) {
  const { wx, wy } = isoScreenToWorld2D(screenX, screenY, state.camera);
  return world2DToAxial(wx, wy, WORLD.hexSize);
}

export function screenToWorldOffset(screenX, screenY, WORLD, state) {
  // screen -> fractional axial (view) -> round -> invert rotation -> offset
  const frac = screenToAxial(screenX, screenY, WORLD, state);
  const cubeFrac = axialToCube(frac.q, frac.r);
  const cube = cubeRound(cubeFrac);
  const av = { q: cube.x, r: cube.z };

  const off = viewToWorldOffset(av.q, av.r, WORLD, state);
  return off;
}
