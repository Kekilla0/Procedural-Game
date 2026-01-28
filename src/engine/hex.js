// Pointy-top hex math using axial/cube coordinates.
// We store world positions as offset coords: (col,row) in an "odd-r" layout.

export function rotToLabel(rot) {
  const deg = (((rot % 6) + 6) % 6) * 60;
  return `${deg}°`;
}

// ---- Offset (odd-r) <-> Axial ----
// odd-r offset: https://www.redblobgames.com/grids/hex-grids/
export function offsetToAxial(col, row) {
  // q = col - (row - (row&1))/2, r=row
  const q = col - ((row - (row & 1)) / 2);
  const r = row;
  return { q, r };
}

export function axialToOffset(q, r) {
  // col = q + (r - (r&1))/2, row=r
  const col = q + ((r - (r & 1)) / 2);
  const row = r;
  return { col, row };
}

// ---- Axial <-> Cube ----
export function axialToCube(q, r) {
  // cube coords: x=q, z=r, y=-x-z
  const x = q;
  const z = r;
  const y = -x - z;
  return { x, y, z };
}

export function cubeToAxial(x, y, z) {
  return { q: x, r: z };
}

// ---- Rotate cube around origin ----
// clockwise 60°: (x,y,z) -> (-z,-x,-y)
export function cubeRotateCW(c) {
  return { x: -c.z, y: -c.x, z: -c.y };
}
// counter-clockwise 60°: (x,y,z) -> (-y,-z,-x)
export function cubeRotateCCW(c) {
  return { x: -c.y, y: -c.z, z: -c.x };
}

export function cubeAdd(a, b) {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
export function cubeSub(a, b) {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function cubeRotate(c, stepsCW) {
  let out = { ...c };
  const s = ((stepsCW % 6) + 6) % 6;
  for (let i = 0; i < s; i++) out = cubeRotateCW(out);
  return out;
}

export function cubeUnrotate(c, stepsCW) {
  // inverse rotation by rotating CCW same steps
  let out = { ...c };
  const s = ((stepsCW % 6) + 6) % 6;
  for (let i = 0; i < s; i++) out = cubeRotateCCW(out);
  return out;
}

// ---- Hex rounding (fractional axial -> nearest hex) ----
export function cubeRound(frac) {
  let rx = Math.round(frac.x);
  let ry = Math.round(frac.y);
  let rz = Math.round(frac.z);

  const xDiff = Math.abs(rx - frac.x);
  const yDiff = Math.abs(ry - frac.y);
  const zDiff = Math.abs(rz - frac.z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { x: rx, y: ry, z: rz };
}
