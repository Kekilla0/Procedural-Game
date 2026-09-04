import { Panel } from './panel.js';

// Base class for modal popups usable from any screen (e.g. Settings). Draws
// a dimmed backdrop (the one thing that makes it "modal" — Panel itself has
// no concept of that), then the shared Panel chrome centered on screen, and
// delegates the panel's inner content to subclasses via renderBody/onBodyClick.
export class Popup extends Panel {
    constructor({ title, width = 360, height = 240 } = {}) {
        super({ title, width, height, draggable: false });
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

        const rect = { x: (canvasWidth - this.width) / 2, y: (canvasHeight - this.height) / 2, width: this.width, height: this.height };
        const bodyRect = super.render(ctx, rect);
        this.renderBody(ctx, bodyRect);
    }

    onClick(x, y, manager) {
        if (this.hitClose(x, y)) {
            manager.closePopup();
            return;
        }
        if (!this.hitPanel(x, y)) {
            manager.closePopup();
            return;
        }
        this.onBodyClick(x, y, this.bodyRect, manager);
    }
}
