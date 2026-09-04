// Owns the current screen and forwards the game loop + input events to it.
// A screen implements any of: onEnter, onExit, update(dt), render(ctx, width, height),
// onClick(x, y), onKeyDown(key), onKeyUp(key), onWheel(deltaY, x, y), onContextMenu(x, y),
// onMouseDown(x, y), onMouseMove(x, y), onMouseUp(x, y) (the latter three exist for
// drag-and-drop; 'click' still fires as usual afterward on a plain click).
//
// Also owns a single optional modal popup (see src/ui/popup.js) that sits on top
// of whatever screen is active. While a popup is open it receives clicks/keydowns
// instead of the current screen, and is rendered after it. A popup's onClose()
// (if it has one) always fires when it stops being the active popup — via the
// close button/click-outside/Escape (all route through closePopup), or via
// openPopup replacing it, or switchTo tearing it down.
export class ScreenManager {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.screens = new Map();
        this.current = null;
        this.popup = null;

        canvas.addEventListener('click', (e) => {
            if (this.popup) {
                this.popup.onClick(e.offsetX, e.offsetY, this);
            } else {
                this.current?.onClick?.(e.offsetX, e.offsetY);
            }
        });
        window.addEventListener('keydown', (e) => {
            if (this.popup) {
                this.popup.onKeyDown?.(e.key, this);
            } else {
                this.current?.onKeyDown?.(e.key);
            }
        });
        window.addEventListener('keyup', (e) => {
            this.current?.onKeyUp?.(e.key);
        });
        canvas.addEventListener(
            'wheel',
            (e) => {
                if (!this.popup) this.current?.onWheel?.(e.deltaY, e.offsetX, e.offsetY);
                e.preventDefault();
            },
            { passive: false }
        );
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // always suppress the native browser menu
            if (!this.popup) this.current?.onContextMenu?.(e.offsetX, e.offsetY);
        });
        canvas.addEventListener('mousedown', (e) => {
            if (!this.popup && e.button === 0) this.current?.onMouseDown?.(e.offsetX, e.offsetY);
        });
        canvas.addEventListener('mousemove', (e) => {
            if (!this.popup) this.current?.onMouseMove?.(e.offsetX, e.offsetY);
        });
        canvas.addEventListener('mouseup', (e) => {
            if (!this.popup && e.button === 0) this.current?.onMouseUp?.(e.offsetX, e.offsetY);
        });
    }

    register(name, screen) {
        this.screens.set(name, screen);
    }

    getScreen(name) {
        return this.screens.get(name);
    }

    switchTo(name) {
        const next = this.screens.get(name);
        if (!next) throw new Error(`Unknown screen: ${name}`);

        this.popup?.onClose?.();
        this.popup = null;
        this.current?.onExit?.();
        this.current = next;
        this.current.onEnter?.();
    }

    openPopup(popup) {
        this.popup?.onClose?.();
        this.popup = popup;
    }

    closePopup() {
        this.popup?.onClose?.();
        this.popup = null;
    }

    update(dt) {
        this.current?.update?.(dt);
    }

    render() {
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        this.current?.render?.(ctx, canvas.width, canvas.height);
        this.popup?.render(ctx, canvas.width, canvas.height);
    }
}
