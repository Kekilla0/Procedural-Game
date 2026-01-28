export function rotToLabel(rot) {
  const deg = ((rot % 4) + 4) % 4 * 90;
  return `${deg}°`;
}

export function rotateXY(x, y, rot, w, h) {
  const r = ((rot % 4) + 4) % 4;
  switch (r) {
    case 0: return { x, y };
    case 1: return { x: (w - 1) - y, y: x };
    case 2: return { x: (w - 1) - x, y: (h - 1) - y };
    case 3: return { x: y, y: (h - 1) - x };
    default: return { x, y };
  }
}

export function unrotateXY(x, y, rot, w, h) {
  const r = ((rot % 4) + 4) % 4;
  switch (r) {
    case 0: return { x, y };
    case 1: return { x: y, y: (w - 1) - x };
    case 2: return { x: (w - 1) - x, y: (h - 1) - y };
    case 3: return { x: (h - 1) - y, y: x };
    default: return { x, y };
  }
}

export function viewMoveToWorldDelta(dxView, dyView, rot) {
  const r = ((rot % 4) + 4) % 4;
  switch (r) {
    case 0: return { dx: dxView, dy: dyView };
    case 1: return { dx: dyView, dy: -dxView };
    case 2: return { dx: -dxView, dy: -dyView };
    case 3: return { dx: -dyView, dy: dxView };
    default: return { dx: dxView, dy: dyView };
  }
}
