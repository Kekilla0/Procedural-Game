const ROW_HEIGHT = 28;
const WIDTH = 140;
const PADDING = 6;

// Lightweight right-click context menu: a stack of labeled actions at a
// screen point. Generic — not tied to inventory — so anything that wants a
// "right-click for options" affordance later can reuse it the same way.
// Owned/rendered by whatever opened it (currently Hud); it doesn't manage
// its own open/close lifecycle beyond hit-testing a click against its rows.
export class ContextMenu {
    constructor(x, y, items) {
        this.x = x;
        this.y = y;
        this.items = items; // [{ label, onSelect }]
        this._rects = [];
    }

    render(ctx, boundsLeft, boundsTop, boundsWidth, boundsHeight) {
        const height = this.items.length * ROW_HEIGHT + PADDING * 2;
        const x = Math.min(this.x, boundsLeft + boundsWidth - WIDTH - 4);
        const y = Math.min(this.y, boundsTop + boundsHeight - height - 4);

        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(x, y, WIDTH, height);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, WIDTH, height);

        this._rects = this.items.map((item, i) => {
            const rowY = y + PADDING + i * ROW_HEIGHT;
            const rect = { x: x + PADDING, y: rowY, width: WIDTH - PADDING * 2, height: ROW_HEIGHT };

            ctx.fillStyle = '#e0e0e0';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, rect.x + 6, rect.y + ROW_HEIGHT / 2 + 5);

            return rect;
        });
    }

    // A context menu always closes on the next click regardless of where it
    // lands — this just decides whether that click also selected an action.
    handleClick(x, y) {
        const index = this._rects.findIndex((r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height);
        if (index !== -1) this.items[index].onSelect();
    }
}
