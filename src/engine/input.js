import { inBounds, screenToWorldOffset } from "./coords.js";
import { isBlocked } from "./map.js";


function getMousePos(canvas, evt) {
  const rect = canvas.getBoundingClientRect();
  return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
}

function tryMove(player, dCol, dRow, WORLD, state) {
  const nc = player.col + dCol;
  const nr = player.row + dRow;
  if (!inBounds(nc, nr, player.z, WORLD)) return false;
  if (state.map && isBlocked(state.map, nc, nr)) return false;
  player.col = nc;
  player.row = nr;
  return true;
}

// 6 directions in odd-r offset coordinates depends on row parity.
// We’ll use standard odd-r neighbor deltas.
function neighborDelta(key, row) {
  const odd = row & 1;

  // Directions: NW, NE, W, E, SW, SE
  // Keys:       W   E   A  D   Z   X
  if (!odd) {
    // even row
    switch (key) {
      case "w": return { dc: -1, dr: -1 }; // NW
      case "e": return { dc: 0,  dr: -1 }; // NE
      case "a": return { dc: -1, dr: 0 };  // W
      case "d": return { dc: +1, dr: 0 };  // E
      case "z": return { dc: -1, dr: +1 }; // SW
      case "x": return { dc: 0,  dr: +1 }; // SE
      default: return null;
    }
  } else {
    // odd row
    switch (key) {
      case "w": return { dc: 0,  dr: -1 }; // NW
      case "e": return { dc: +1, dr: -1 }; // NE
      case "a": return { dc: -1, dr: 0 };  // W
      case "d": return { dc: +1, dr: 0 };  // E
      case "z": return { dc: 0,  dr: +1 }; // SW
      case "x": return { dc: +1, dr: +1 }; // SE
      default: return null;
    }
  }
}

export function createInput({ canvas, state, WORLD, player, hover, onChange }) {
  // Buttons
  state.ui.rotLeftBtn?.addEventListener("click", () => {
    state.rotation = (state.rotation + 5) % 6;
    onChange();
  });
  state.ui.rotRightBtn?.addEventListener("click", () => {
    state.rotation = (state.rotation + 1) % 6;
    onChange();
  });

  // Keyboard
  window.addEventListener("keydown", (e) => {
    const key = e.key.toLowerCase();

    if (key === "q") {
      state.rotation = (state.rotation + 5) % 6;
      return onChange();
    }
    if (key === "e") {
      state.rotation = (state.rotation + 1) % 6;
      return onChange();
    }

    const d = neighborDelta(key, player.row);
    if (!d) return;

    if (tryMove(player, d.dc, d.dr, WORLD, state)) onChange();
  });

  // Mouse hover
  canvas.addEventListener("mousemove", (evt) => {
    const m = getMousePos(canvas, evt);
    const off = screenToWorldOffset(m.x, m.y, WORLD, state);

    const col = Math.floor(off.col);
    const row = Math.floor(off.row);

    if (inBounds(col, row, 0, WORLD)) {
      hover.col = col;
      hover.row = row;
      hover.z = 0;
      state.ui.tileLabel.textContent = `(${col}, ${row}, 0)`;
    } else {
      hover.col = hover.row = null;
      state.ui.tileLabel.textContent = "—";
    }

    onChange();
  });

  canvas.addEventListener("mouseleave", () => {
    hover.col = hover.row = null;
    state.ui.tileLabel.textContent = "—";
    onChange();
  });

  // Click-to-move (teleport for now)
  canvas.addEventListener("click", (evt) => {
    const m = getMousePos(canvas, evt);
    const off = screenToWorldOffset(m.x, m.y, WORLD, state);

    const col = Math.floor(off.col);
    const row = Math.floor(off.row);

    if (!inBounds(col, row, 0, WORLD)) return;
    if (state.map && isBlocked(state.map, col, row)) return;

    player.col = col;
    player.row = row;
    player.z = 0;

    onChange();
  });
}
