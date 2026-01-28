import { worldToViewAxial, axialToScreen } from "./coords.js";

export function updateCameraFollow(player, WORLD, state) {
  const av = worldToViewAxial(player.col, player.row, WORLD, state);

  const desired = {
    x: Math.floor(state.canvas.width / 2),
    y: Math.floor(state.canvas.height / 2),
  };

  // axialToScreen uses camera, so call it with camera=(0,0) to get “raw” position
  const rawState = { ...state, camera: { x: 0, y: 0 } };
  const p = axialToScreen(av.q, av.r, WORLD, rawState);

  state.camera.x = desired.x - p.x;
  state.camera.y = desired.y - p.y;
}
