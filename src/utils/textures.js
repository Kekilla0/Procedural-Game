/**
 * textures.js - Sprite sheet generation for all game entities (isometric only)
 *
 * Sheet layout — 4 frames × 1 row per entity:
 *
 *   south  north  east   west
 *   [0]    [1]    [2]    [3]
 *
 * To swap in real PNG assets later:
 *   1. Drop `entity.png` (FRAME_W*4 × FRAME_H) in assets/sprites/
 *   2. Replace buildSheet() with scene.load.spritesheet(...)
 *   3. Frame indices stay identical.
 */

import { MONSTER_DEFS } from '../data/monsters.js';

export const FRAME_W = 32;
export const FRAME_H = 40;

const DIRS = ['south', 'north', 'east', 'west'];

/** Map direction → frame index. */
export const SPRITE_FRAME = { south: 0, north: 1, east: 2, west: 3 };

/** Chest frame index. */
export const CHEST_FRAME = 0;

// ---------------------------------------------------------------------------
// Spritesheet builder
// ---------------------------------------------------------------------------

function buildSheet(scene, key, drawISO) {
  const W = FRAME_W, H = FRAME_H;
  const rt = scene.add.renderTexture(0, 0, W * DIRS.length, H);

  for (let i = 0; i < DIRS.length; i++) {
    const g = scene.add.graphics();
    drawISO(g, DIRS[i]);
    rt.draw(g, i * W, 0);
    g.destroy();
  }

  rt.saveTexture(key);
  rt.destroy();

  const tex = scene.textures.get(key);
  for (let i = 0; i < DIRS.length; i++) {
    tex.add(i, 0, i * W, 0, W, H);
  }
}

function buildChestSheet(scene) {
  const W = FRAME_W, H = FRAME_H;
  const rt = scene.add.renderTexture(0, 0, W, H);

  const g = scene.add.graphics();
  _drawChestISO(g);
  rt.draw(g, 0, 0);
  g.destroy();

  rt.saveTexture('chest');
  rt.destroy();

  const tex = scene.textures.get('chest');
  tex.add(CHEST_FRAME, 0, 0, 0, W, H);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function loadEntityTextures(scene) {
  for (const [cls, pal] of Object.entries(PLAYER_PALETTES)) {
    buildSheet(scene, `player_${cls}`, (g, dir) => _drawISOPlayer(g, dir, pal));
  }

  for (const [name, def] of Object.entries(MONSTER_DEFS)) {
    buildSheet(scene, `monster_${name}`, (g, dir) => _drawISOMonster(g, dir, def.image_def));
  }

  buildChestSheet(scene);
}

// ---------------------------------------------------------------------------
// Player palettes
// ---------------------------------------------------------------------------

const PLAYER_PALETTES = {
  warrior:  { body: 0xAA3322, legs: 0x3A2010, accent: 0xCC5544, skin: 0xF5C8A0, hair: 0x3A2010 },
  rogue:    { body: 0x334433, legs: 0x221A22, accent: 0x558855, skin: 0xF0B888, hair: 0x1A1008 },
  sorcerer: { body: 0x2233AA, legs: 0x1A1A3A, accent: 0x4466CC, skin: 0xF5D0B0, hair: 0x220088 }
};

// ---------------------------------------------------------------------------
// Player draw functions
// ---------------------------------------------------------------------------

function _drawISOPlayer(g, dir, pal) {
  const { body, legs, accent, skin, hair } = pal;
  const dark = 0x111111;
  const cx = 13;

  g.fillStyle(hair); g.fillCircle(cx, 7, 6);
  g.fillStyle(skin); g.fillCircle(cx, 7, 5);

  if (dir === 'south') {
    g.fillStyle(dark);
    g.fillRect(10, 5, 2, 2); g.fillRect(14, 5, 2, 2);
    g.fillRect(11, 8, 4, 1);
  } else if (dir === 'east') {
    g.fillStyle(dark); g.fillRect(15, 5, 2, 2); g.fillRect(15, 8, 3, 1);
  } else if (dir === 'west') {
    g.fillStyle(dark); g.fillRect(9, 5, 2, 2); g.fillRect(8, 8, 3, 1);
  }

  g.fillStyle(body); g.fillRect(cx - 5, 13, 10, 11);
  g.fillStyle(accent); g.fillRect(cx - 5, 20, 10, 2);

  g.fillStyle(body);
  if (dir === 'south' || dir === 'north') {
    g.fillRect(cx - 9, 14, 4, 8); g.fillRect(cx + 5, 14, 4, 8);
    g.fillStyle(skin); g.fillRect(cx - 9, 21, 4, 2); g.fillRect(cx + 5, 21, 4, 2);
  } else if (dir === 'east') {
    g.fillRect(cx + 5, 14, 4, 8); g.fillStyle(skin); g.fillRect(cx + 5, 21, 4, 2);
  } else {
    g.fillRect(cx - 9, 14, 4, 8); g.fillStyle(skin); g.fillRect(cx - 9, 21, 4, 2);
  }

  g.fillStyle(legs);
  g.fillRect(cx - 5, 24, 4, 9); g.fillRect(cx + 1, 24, 4, 9);
  g.fillStyle(dark);
  if (dir === 'south' || dir === 'west') {
    g.fillRect(cx - 7, 32, 6, 2); g.fillRect(cx - 1, 33, 5, 2);
  } else {
    g.fillRect(cx - 5, 32, 5, 2); g.fillRect(cx + 1, 32, 6, 2);
  }
}

// ---------------------------------------------------------------------------
// Monster draw functions
// ---------------------------------------------------------------------------

function _drawISOMonster(g, dir, def) {
  const { bodyColor, accentColor, bodyW, bodyH, headW, headH, earType, tusks } = def;
  const W = 26, H = 40;
  const cx = Math.floor(W / 2);
  const bH = Math.min(bodyH, H - headH - 4);
  const startY = Math.floor((H - (headH + bH)) / 2);
  const hx = cx - Math.floor(headW / 2);
  const headY = startY;
  const bodyY = startY + headH;
  const bx = cx - Math.floor(bodyW / 2);

  if (earType === 'pointy') {
    g.fillStyle(bodyColor);
    g.fillRect(hx - 1, headY - 6, 2, 6);
    g.fillRect(hx + headW - 1, headY - 6, 2, 6);
  } else if (earType === 'wide') {
    g.fillStyle(bodyColor);
    g.fillRect(hx - 5, headY + 2, 5, 4);
    g.fillRect(hx + headW, headY + 2, 5, 4);
  }

  g.fillStyle(bodyColor);
  g.fillRect(hx, headY, headW, headH);

  g.fillStyle(accentColor);
  if (dir === 'south') {
    g.fillRect(hx + 1, headY + 3, 2, 2);
    g.fillRect(hx + headW - 3, headY + 3, 2, 2);
  } else if (dir === 'east') {
    g.fillRect(hx + headW - 3, headY + 3, 2, 2);
  } else if (dir === 'west') {
    g.fillRect(hx + 1, headY + 3, 2, 2);
  }

  if (tusks && dir !== 'north') {
    g.fillStyle(0xeeeebb);
    if (dir === 'south') {
      g.fillRect(hx + 2, headY + headH, 2, 4);
      g.fillRect(hx + headW - 4, headY + headH, 2, 4);
    } else if (dir === 'east') {
      g.fillRect(hx + headW - 2, headY + headH, 2, 4);
    } else {
      g.fillRect(hx, headY + headH, 2, 4);
    }
  }

  g.fillStyle(bodyColor);
  g.fillRect(bx, bodyY, bodyW, bH);
  g.fillStyle(accentColor);
  g.fillRect(bx, bodyY + Math.floor(bH * 0.5), bodyW, 2);
}

// ---------------------------------------------------------------------------
// Chest draw function
// ---------------------------------------------------------------------------

function _drawChestISO(g) {
  const cx = 13;
  g.fillStyle(0x6b3a1f); g.fillRect(cx - 8, 20, 16, 12);
  g.fillStyle(0x8b5a2b); g.fillRect(cx - 8, 14, 16, 8);
  g.fillStyle(0x3a1a08); g.fillRect(cx - 8, 22, 16, 2);
  g.fillStyle(0xddaa44); g.fillRect(cx - 2, 25, 4, 4);
  g.fillStyle(0x3a1a08); g.fillRect(cx - 1, 26, 2, 3);
  g.lineStyle(1, 0x1a0a00); g.strokeRect(cx - 8, 14, 16, 18);
}
