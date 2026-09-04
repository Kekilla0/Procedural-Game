import { WALL_STATE } from './wall.js';
import { wallSegment } from './levelRenderer.js';
import { topDownProject, isoProject } from '../utils/projection.js';

const ORTHOGONAL_SIDES = ['north', 'south', 'east', 'west'];
// Entities can be interacted with from any of the 8 surrounding cells, plus
// the player's own cell (e.g. a dropped item pile sits exactly where the
// player was standing when they dropped it — see world/drop.js) — doors stay
// orthogonal-only below (a door is a wall edge, and edges only exist between
// orthogonally-adjacent cells, so "diagonal door" isn't a real thing).
const ENTITY_ADJACENCY_OFFSETS = [
    [0, 0],
    [0, -1], [0, 1], [-1, 0], [1, 0],
    [-1, -1], [1, -1], [-1, 1], [1, 1],
];
const CLICK_HIT_DISTANCE = 10; // px, generous enough to click a thin door line

// Interactables come in two shapes: doors, which live on cell edges (part of
// the wall data), and entities, which occupy a cell and opt in via
// `interactable: true` + an `interact(entity, level, inventory, openContainer)`
// callback. Doors require orthogonal adjacency (the only kind an edge has);
// entities allow any of the 8 surrounding cells, diagonals included.
// `inventory`/`openContainer` are threaded through purely for entity.interact
// implementations to use (a lootable item uses `inventory`, a container uses
// `openContainer`); doors ignore both.
export function findAdjacentDoors(level, col, row) {
    return ORTHOGONAL_SIDES.map((side) => level.getWallEntry(col, row, side)).filter((wall) => wall?.isDoor);
}

export function findAdjacentInteractableEntities(level, col, row) {
    const found = [];
    for (const [dCol, dRow] of ENTITY_ADJACENCY_OFFSETS) {
        for (const entity of level.entitiesAt(col + dCol, row + dRow)) {
            if (entity.interactable) found.push(entity);
        }
    }
    return found;
}

export function toggleDoor(wall) {
    wall.state = wall.state === WALL_STATE.SOLID ? WALL_STATE.OPEN : WALL_STATE.SOLID;
}

// Interacts with whatever's adjacent to (col,row) — doors take priority over
// entities. Returns true if something was interacted with.
export function interactNear(level, col, row, inventory, openContainer) {
    const [door] = findAdjacentDoors(level, col, row);
    if (door) {
        toggleDoor(door);
        return true;
    }

    const [entity] = findAdjacentInteractableEntities(level, col, row);
    if (entity) {
        entity.interact(entity, level, inventory, openContainer);
        return true;
    }

    return false;
}

// Click-driven interaction: only considers targets already adjacent to the
// player, then hit-tests the click against each one's on-screen shape.
export function interactAtClick(level, player, isometric, originX, originY, clickX, clickY, inventory, openContainer) {
    for (const door of findAdjacentDoors(level, player.col, player.row)) {
        const seg = wallSegment(door, isometric, originX, originY);
        if (distanceToSegment(clickX, clickY, seg) <= CLICK_HIT_DISTANCE) {
            toggleDoor(door);
            return true;
        }
    }

    for (const entity of findAdjacentInteractableEntities(level, player.col, player.row)) {
        const pos = isometric ? isoProject(entity.col, entity.row) : topDownProject(entity.col, entity.row);
        const x = originX + pos.x;
        const y = originY + pos.y;
        if (Math.hypot(clickX - x, clickY - y) <= CLICK_HIT_DISTANCE * 2) {
            entity.interact(entity, level, inventory, openContainer);
            return true;
        }
    }

    return false;
}

function distanceToSegment(px, py, seg) {
    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - seg.x1) * dx + (py - seg.y1) * dy) / lengthSq));
    const closestX = seg.x1 + t * dx;
    const closestY = seg.y1 + t * dy;
    return Math.hypot(px - closestX, py - closestY);
}
