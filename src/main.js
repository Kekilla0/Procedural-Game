import { WORLD, player, hover, state } from "./engine/world.js";
import { createInput } from "./engine/input.js";
import { render } from "./engine/render.js";

function bindUI() {
  state.ui = {
    tileLabel: document.getElementById("tileLabel"),
    posLabel: document.getElementById("posLabel"),
    rotLabel: document.getElementById("rotLabel"),
    rotLeftBtn: document.getElementById("rotLeft"),
    rotRightBtn: document.getElementById("rotRight"),
  };
}

bindUI();

const redraw = () => render({ ctx: state.ctx, state, WORLD, player, hover });

createInput({
  canvas: state.canvas,
  state,
  WORLD,
  player,
  hover,
  onChange: redraw,
});

redraw();
