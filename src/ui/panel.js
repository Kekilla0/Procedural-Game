// Shared chrome for every floating box in the UI: background, border, title,
// close button, and (optionally) header-drag repositioning. Replaces what
// used to be three separate hand-drawn copies of the same background/
// border/title/close-X code (Popup, Hud's side panels, Hud's container panel).
//
// A Panel never invents its own docking/centering/reserved-gap layout — the
// caller passes a `rect` each render() call with wherever it wants the panel
// *by default*. A non-draggable Panel always uses that rect verbatim, every
// frame (so today's docked-panel layouts are unchanged). A draggable Panel
// uses the caller's rect only until the user first drags it by its header;
// after that it keeps its own x/y (but still adopts the caller's width/height
// every frame, so it still resizes correctly on window resize).
const HEADER_HEIGHT = 56;
const CONTENT_PAD = 20;
const CLOSE_SIZE = 24;
const CLOSE_MARGIN = 12;

export class Panel {
    constructor({ title, width = 360, height = 240, draggable = false, backgroundColor = 'rgba(10, 10, 10, 0.92)', borderColor = '#3a3a3a' } = {}) {
        this.title = title;
        this.width = width;
        this.height = height;
        this.draggable = draggable;
        this.backgroundColor = backgroundColor;
        this.borderColor = borderColor;

        this._userPositioned = false; // draggable only: has the user moved this panel at least once?
        this.x = 0;
        this.y = 0;
        this._dragging = false;
        this._dragOffset = { x: 0, y: 0 };

        this._rect = null; // last-rendered {x,y,width,height}, for hit-testing
        this._closeRect = null;
        this.bodyRect = null;
    }

    // Returns bodyRect — the area the caller should draw its own content
    // into (also stored as this.bodyRect for convenience).
    render(ctx, rect, scale = 1) {
        const width = rect.width;
        const height = rect.height;
        const x = this.draggable && this._userPositioned ? this.x : rect.x;
        const y = this.draggable && this._userPositioned ? this.y : rect.y;
        this._rect = { x, y, width, height };
        this._headerHeight = HEADER_HEIGHT * scale;

        ctx.fillStyle = this.backgroundColor;
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = this.borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = '#e0e0e0';
        ctx.font = `bold ${Math.round(20 * scale)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(this.title, x + CONTENT_PAD * scale, y + 34 * scale);

        this._closeRect = {
            x: x + width - (CLOSE_SIZE + CLOSE_MARGIN) * scale,
            y: y + CLOSE_MARGIN * scale,
            width: CLOSE_SIZE * scale,
            height: CLOSE_SIZE * scale,
        };
        ctx.strokeStyle = '#888';
        ctx.strokeRect(this._closeRect.x, this._closeRect.y, this._closeRect.width, this._closeRect.height);
        ctx.fillStyle = '#888';
        ctx.font = `${Math.round(16 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('x', this._closeRect.x + this._closeRect.width / 2, this._closeRect.y + 17 * scale);

        this.bodyRect = {
            x: x + CONTENT_PAD * scale,
            y: y + HEADER_HEIGHT * scale,
            width: width - CONTENT_PAD * 2 * scale,
            height: height - HEADER_HEIGHT * scale - CONTENT_PAD * scale,
        };
        return this.bodyRect;
    }

    hitPanel(x, y) {
        return this._hit(this._rect, x, y);
    }

    hitClose(x, y) {
        return this._hit(this._closeRect, x, y);
    }

    hitHeader(x, y) {
        if (!this._rect) return false;
        const headerRect = { x: this._rect.x, y: this._rect.y, width: this._rect.width, height: this._headerHeight };
        return this._hit(headerRect, x, y);
    }

    // Starts a header-drag if this panel is draggable and (x,y) is on its
    // header (but not the close button). Returns true if it grabbed the
    // gesture, so the caller knows not to also start something else with it.
    onMouseDown(x, y) {
        if (!this.draggable || !this._rect) return false;
        if (this.hitClose(x, y)) return false;
        if (!this.hitHeader(x, y)) return false;

        this.x = this._rect.x;
        this.y = this._rect.y;
        this._dragOffset = { x: x - this.x, y: y - this.y };
        this._dragging = true;
        this._userPositioned = true;
        return true;
    }

    onMouseMove(x, y) {
        if (!this._dragging) return false;
        this.x = x - this._dragOffset.x;
        this.y = y - this._dragOffset.y;
        return true;
    }

    onMouseUp() {
        if (!this._dragging) return false;
        this._dragging = false;
        return true;
    }

    _hit(rect, x, y) {
        return !!rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }
}
