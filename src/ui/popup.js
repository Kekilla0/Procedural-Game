// Base class for modal popups usable from any screen (e.g. Settings).
// Draws a dimmed backdrop, a centered panel with title + close button,
// and delegates the panel's inner content to subclasses via renderBody/onBodyClick.
export class Popup {
    constructor({ title, width = 360, height = 240 }) {
        this.title = title;
        this.width = width;
        this.height = height;
    }

    // Override in subclasses to draw content inside bodyRect.
    renderBody(ctx, bodyRect) {}

    // Override in subclasses. Return value is ignored; call this.close(manager) if needed.
    onBodyClick(x, y, bodyRect, manager) {}

    onKeyDown(key, manager) {
        if (key === 'Escape') manager.closePopup();
    }

    render(ctx, canvasWidth, canvasHeight) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const panelX = (canvasWidth - this.width) / 2;
        const panelY = (canvasHeight - this.height) / 2;
        this._panelRect = { x: panelX, y: panelY, width: this.width, height: this.height };

        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(panelX, panelY, this.width, this.height);
        ctx.strokeStyle = '#3a3a3a';
        ctx.lineWidth = 1;
        ctx.strokeRect(panelX, panelY, this.width, this.height);

        ctx.fillStyle = '#e0e0e0';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(this.title, panelX + 20, panelY + 34);

        this._closeRect = { x: panelX + this.width - 40, y: panelY + 12, width: 24, height: 24 };
        ctx.strokeStyle = '#888';
        ctx.strokeRect(this._closeRect.x, this._closeRect.y, this._closeRect.width, this._closeRect.height);
        ctx.fillStyle = '#888';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('x', this._closeRect.x + this._closeRect.width / 2, this._closeRect.y + 17);

        this._bodyRect = {
            x: panelX + 20,
            y: panelY + 56,
            width: this.width - 40,
            height: this.height - 76,
        };
        this.renderBody(ctx, this._bodyRect);
    }

    onClick(x, y, manager) {
        if (this._hit(this._closeRect, x, y)) {
            manager.closePopup();
            return;
        }
        if (!this._hit(this._panelRect, x, y)) {
            manager.closePopup();
            return;
        }
        this.onBodyClick(x, y, this._bodyRect, manager);
    }

    _hit(rect, x, y) {
        return !!rect && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }
}
