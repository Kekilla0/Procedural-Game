// src/main.js

import { Game } from "./engine/game.js";
import { Data } from "./engine/data.js";

import { DungeonBuilder } from "./engine/dungeonBuilder.js";

import { RenderSystem } from "./systems/renderSystem.js";
import { InputSystem } from "./systems/inputSystem.js";
import { CameraSystem } from "./systems/cameraSystem.js";

// --- UI elements (optional) ---
const ui = {
  posLabel: document.getElementById("posLabel"),
  rotLabel: document.getElementById("rotLabel"),
  rotLeftBtn: document.getElementById("rotLeft"),
  rotRightBtn: document.getElementById("rotRight"),
};

// --- create game ---
const game = new Game({ ui });

// Attach canvases by layer
game.attachCanvases(Data.LayerCanvasId);

// Build and store a default dungeon (single test wall)
const builder = new DungeonBuilder({ world: game.world });
game.dungeon = builder.buildDefault({ z: 0 });

// Spawn player (place them left of the wall by default)
const d = game.dungeon;
game.spawnPlayer({
  col: d.door.col,       // start near door to test quickly
  row: d.door.row - 1,   // one tile inside the room
  z: 0,
});

// Add systems (order matters: input -> camera -> render)
game.addSystem(InputSystem);
game.addSystem(CameraSystem);
game.addSystem(RenderSystem);

// Start loop
game.start();
