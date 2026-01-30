// src/systems/cameraSystem.js

import { Data } from "../engine/data.js";
import { worldToViewAxial, axialToScreen } from "../engine/coords.js";

export const CameraSystem = {
  update(game) {
    const p = game.getPlayer();
    if (!p) return;

    const canvas = game.getLayerCanvas(Data.Layers.BACKGROUND);
    if (!canvas) return;

    // player render position in current rotation
    const av = worldToViewAxial(p.col, p.row, game.world, game);
    const screen = axialToScreen(av.q, av.r, game.world, game);

    const targetX = Math.floor(canvas.width / 2);
    const targetY = Math.floor(canvas.height / 2);

    // Keep player centered; direct snap for Milestone 1
    game.camera.x += (targetX - screen.x);
    game.camera.y += (targetY - screen.y);
  },
};
