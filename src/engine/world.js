import { createMap } from "./map.js";

export const WORLD = {
  w: 25,
  h: 25,
  levels: 1,
  hexSize: 22,
  drawPadding: 3,
};

export const player = { col: 12, row: 12, z: 0 };
export const hover = { col: null, row: null, z: 0 };

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

export const state = {
  canvas,
  ctx,
  rotation: 0,
  camera: { x: Math.floor(canvas.width / 2), y: Math.floor(canvas.height / 2) },
  ui: null,
  map: createMap(WORLD), // ✅ add this
};
