import { WALL_STATE } from './wall.js';
import { canMoveTo } from './collision.js';
import { TILE_SIZE, ISO_HALF_WIDTH, ISO_HALF_HEIGHT, topDownProject, isoProject } from '../utils/projection.js';

// Draws a Level's walls/entities/collision-debug overlay in either view mode.
// Kept separate from ViewportScreen so "how a Level looks" doesn't grow inside
// the screen that just handles input/camera/movement.
//
// Simplification for now: walls are drawn as thin lines (not solid, tall
// panels) and entities/player are drawn in a fixed order (walls, then
// entities, then player) rather than true depth-sorted-by-position occlusion.
// That's fine while everything on screen is flat/thin; once walls get real
// height or enemies show up, this will need proper depth sorting.
const ENTITY_COLORS = {
    object: '#8a6d3b',
    item: '#c9a227',
    container: '#6b4423',
    pile: '#a0895a',
};

export function drawIsoDiamond(ctx, x, y, halfWidth, halfHeight, fillColor) {
    ctx.beginPath();
    ctx.moveTo(x, y - halfHeight);
    ctx.lineTo(x + halfWidth, y);
    ctx.lineTo(x, y + halfHeight);
    ctx.lineTo(x - halfWidth, y);
    ctx.closePath();
    if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fill();
    } else {
        ctx.stroke();
    }
}

export function drawWalls(ctx, level, isometric, originX, originY) {
    for (const wall of level.walls.values()) {
        if (wall.isDoor) {
            drawDoorSegment(ctx, wall, isometric, originX, originY);
        } else if (wall.state === WALL_STATE.SOLID) {
            const seg = wallSegment(wall, isometric, originX, originY);
            ctx.strokeStyle = '#9c6b3f';
            ctx.lineWidth = isometric ? 2 : 3;
            strokeSegment(ctx, seg);
        }
    }
}

// Closed doors draw like a solid wall but in a distinct color; open doors draw
// as a dashed line so a doorway stays visible/legible instead of just vanishing.
function drawDoorSegment(ctx, wall, isometric, originX, originY) {
    const seg = wallSegment(wall, isometric, originX, originY);
    ctx.strokeStyle = '#c97b3f';
    ctx.lineWidth = isometric ? 2 : 3;
    ctx.setLineDash(wall.state === WALL_STATE.SOLID ? [] : [5, 4]);
    strokeSegment(ctx, seg);
    ctx.setLineDash([]);
}

function strokeSegment(ctx, seg) {
    ctx.beginPath();
    ctx.moveTo(seg.x1, seg.y1);
    ctx.lineTo(seg.x2, seg.y2);
    ctx.stroke();
}

export function wallSegment(wall, isometric, originX, originY) {
    return isometric
        ? isoWallSegment(wall.col, wall.row, wall.side, originX, originY)
        : topDownWallSegment(wall.col, wall.row, wall.side, originX, originY);
}

function topDownWallSegment(col, row, side, originX, originY) {
    if (side === 'north') {
        const y = originY + (row - 0.5) * TILE_SIZE;
        return { x1: originX + (col - 0.5) * TILE_SIZE, y1: y, x2: originX + (col + 0.5) * TILE_SIZE, y2: y };
    }
    const x = originX + (col - 0.5) * TILE_SIZE;
    return { x1: x, y1: originY + (row - 0.5) * TILE_SIZE, x2: x, y2: originY + (row + 0.5) * TILE_SIZE };
}

// The north edge of a diamond tile is its top-right side (toward the north
// neighbor, which projects up-and-right); the west edge is its top-left side.
function isoWallSegment(col, row, side, originX, originY) {
    const center = isoProject(col, row);
    const cx = originX + center.x;
    const cy = originY + center.y;
    const topX = cx;
    const topY = cy - ISO_HALF_HEIGHT;
    if (side === 'north') return { x1: topX, y1: topY, x2: cx + ISO_HALF_WIDTH, y2: cy };
    return { x1: topX, y1: topY, x2: cx - ISO_HALF_WIDTH, y2: cy };
}

export function drawEntities(ctx, level, isometric, originX, originY) {
    for (const entity of level.entities) {
        const pos = isometric ? isoProject(entity.col, entity.row) : topDownProject(entity.col, entity.row);
        const x = originX + pos.x;
        const y = originY + pos.y;
        const color = entity.activated ? '#4caf50' : entity.itemType?.color ?? ENTITY_COLORS[entity.type] ?? '#888888';
        const scale = entity.blocksMovement ? 0.55 : 0.32;

        if (isometric) {
            drawIsoDiamond(ctx, x, y, ISO_HALF_WIDTH * scale, ISO_HALF_HEIGHT * scale, color);
        } else {
            const size = TILE_SIZE * scale;
            ctx.fillStyle = color;
            ctx.fillRect(x - size / 2, y - size / 2, size, size);
        }
    }
}

// Tints the tiles around `player` that canMoveTo() currently rejects — a
// direct, dynamic check of the collision logic (walls or entities) rather
// than just confirming wall geometry renders where expected.
export function drawCollisionDebugOverlay(ctx, level, isometric, player, originX, originY) {
    const neighborOffsets = [
        [-1, -1], [0, -1], [1, -1],
        [-1, 0], [1, 0],
        [-1, 1], [0, 1], [1, 1],
    ];

    for (const [dCol, dRow] of neighborOffsets) {
        const col = player.col + dCol;
        const row = player.row + dRow;
        if (canMoveTo(level, player.col, player.row, col, row)) continue;

        const pos = isometric ? isoProject(col, row) : topDownProject(col, row);
        const x = originX + pos.x;
        const y = originY + pos.y;
        const fill = 'rgba(220, 50, 50, 0.35)';

        if (isometric) {
            drawIsoDiamond(ctx, x, y, ISO_HALF_WIDTH, ISO_HALF_HEIGHT, fill);
        } else {
            ctx.fillStyle = fill;
            ctx.fillRect(x - TILE_SIZE / 2, y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
        }
    }
}
