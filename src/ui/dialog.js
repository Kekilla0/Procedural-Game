/**
 * dialog.js - Unified dialog/speech-bubble system
 *
 * Two modes, one class:
 *
 *   Modal  — fixed center-screen panel; message + choices and/or an item list.
 *            Created with dialog.show({ title, message, choices, items }).
 *            Dismissed with dialog.hide() or the built-in × button.
 *
 *   Speech — bubble anchored above an entity in world-space.
 *            Created with dialog.showSpeech(entity, { message, choices }).
 *            Call dialog.updateSpeechPosition(camera) each render frame.
 *            Dismissed with dialog.hideSpeech().
 *
 * Both modes use DOM elements created once and reused.
 */

export class Dialog {
  constructor() {
    this._modal   = this._createModal();
    this._speech  = this._createSpeech();
    this._speechEntity = null;
    this._inv      = this._createInventoryModal();
    this._itemMenu = this._createItemMenu();
    this._currentChest = null;
    this._invDismissHandler = null;
  }

  // -------------------------------------------------------------------------
  // Modal
  // -------------------------------------------------------------------------

  /**
   * Show the modal dialog.
   * @param {Object} config
   * @param {string}   [config.title]
   * @param {string}   [config.message]
   * @param {Array}    [config.choices]  - [{label, action, disabled}]
   * @param {Array}    [config.items]    - [{label, action, disabled}] (scrollable list)
   */
  show({ title, message, choices, items } = {}) {
    const body = this._modal.querySelector('.dialog-body');
    body.innerHTML = '';

    if (title) {
      const h = document.createElement('div');
      h.className = 'dialog-title';
      h.textContent = title;
      body.appendChild(h);
    }

    if (message) {
      const p = document.createElement('div');
      p.className = 'dialog-message';
      p.textContent = message;
      body.appendChild(p);
    }

    if (items && items.length) {
      const list = document.createElement('div');
      list.className = 'dialog-items';
      for (const item of items) {
        list.appendChild(this._makeButton(item));
      }
      body.appendChild(list);
    }

    if (choices && choices.length) {
      const row = document.createElement('div');
      row.className = 'dialog-choices';
      for (const choice of choices) {
        row.appendChild(this._makeButton(choice));
      }
      body.appendChild(row);
    }

    this._modal.classList.add('visible');
  }

  /** Hide the modal dialog. */
  hide() {
    this._modal.classList.remove('visible');
  }

  // -------------------------------------------------------------------------
  // Speech bubble
  // -------------------------------------------------------------------------

  /**
   * Show a speech bubble above an entity.
   * @param {Object} entity       - Any object with .x, .y, .width, .height (world px)
   * @param {Object} config
   * @param {string}   [config.message]
   * @param {Array}    [config.choices]  - [{label, action}]
   */
  showSpeech(entity, { message, choices } = {}) {
    this._speechEntity = entity;
    this._speech.innerHTML = '';

    if (message) {
      const p = document.createElement('div');
      p.className = 'speech-message';
      p.textContent = message;
      this._speech.appendChild(p);
    }

    if (choices && choices.length) {
      const row = document.createElement('div');
      row.className = 'speech-choices';
      for (const choice of choices) {
        row.appendChild(this._makeButton(choice));
      }
      this._speech.appendChild(row);
    }

    this._speech.classList.add('visible');
  }

  /** Hide the speech bubble. */
  hideSpeech() {
    this._speech.classList.remove('visible');
    this._speechEntity = null;
  }

  /**
   * Reposition the speech bubble over its entity.
   * Call this every render frame while a speech bubble is visible.
   * @param {Phaser.Cameras.Scene2D.Camera} camera
   */
  updateSpeechPosition(camera) {
    if (!this._speechEntity || !this._speech.classList.contains('visible')) return;

    const e = this._speechEntity;

    // Anchor: top-center of the entity in world space
    const wx = e.x + e.width  / 2;
    const wy = e.y;

    // World → screen pixel (within the #game canvas element)
    const sx = (wx - camera.scrollX) * camera.zoom + camera.x;
    const sy = (wy - camera.scrollY) * camera.zoom + camera.y;

    // The arrow tip (bottom-center of bubble) should sit at (sx, sy).
    // Arrow height is 7px (matches the CSS border-width).
    const ARROW_H = 7;
    this._speech.style.left = `${sx - this._speech.offsetWidth / 2}px`;
    this._speech.style.top  = `${sy - this._speech.offsetHeight - ARROW_H}px`;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  _makeButton({ label, action, disabled }) {
    const btn = document.createElement('button');
    btn.textContent = label;
    if (disabled) {
      btn.classList.add('disabled');
    } else if (action) {
      btn.addEventListener('click', () => action());
    }
    return btn;
  }

  _createModal() {
    const el = document.createElement('div');
    el.id = 'dialog-modal';

    // Close button
    const close = document.createElement('button');
    close.className = 'dialog-close';
    close.textContent = '×';
    close.addEventListener('click', () => this.hide());
    el.appendChild(close);

    const body = document.createElement('div');
    body.className = 'dialog-body';
    el.appendChild(body);

    const gameEl = document.querySelector('#game') || document.body;
    gameEl.appendChild(el);
    return el;
  }

  _createSpeech() {
    const el = document.createElement('div');
    el.id = 'dialog-speech';
    // Append inside the game container so overflow:hidden clips it at the viewport edge
    const gameEl = document.querySelector('#game') || document.body;
    gameEl.appendChild(el);
    return el;
  }

  // -------------------------------------------------------------------------
  // Inventory dialog (chest / loot container)
  // -------------------------------------------------------------------------

  showInventory(chest) {
    this._currentChest = chest;
    this._inv.classList.add('visible');
    this._renderInventory(chest);

    // Close item menu when clicking outside
    const dismiss = (e) => {
      if (!this._itemMenu.contains(e.target)) {
        this._itemMenu.classList.remove('visible');
      }
    };
    document.addEventListener('mousedown', dismiss, { once: false });
    this._invDismissHandler = dismiss;
  }

  hideInventory() {
    this._inv.classList.remove('visible');
    this._itemMenu.classList.remove('visible');
    if (this._invDismissHandler) {
      document.removeEventListener('mousedown', this._invDismissHandler);
      this._invDismissHandler = null;
    }
    this._currentChest = null;
  }

  _renderInventory(chest) {
    const cols = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(chest.capacity))));

    const titleEl = this._inv.querySelector('.inventory-title');
    titleEl.textContent = `${chest.name}'s Remains`;

    const subEl = this._inv.querySelector('.inventory-subtitle');
    subEl.textContent = `${chest.inventory.length} / ${chest.capacity} slots used`;

    const grid = this._inv.querySelector('.inventory-grid');
    grid.style.gridTemplateColumns = `repeat(${cols}, 44px)`;
    grid.innerHTML = '';

    for (let i = 0; i < chest.capacity; i++) {
      const item = chest.inventory[i] || null;
      const slot = document.createElement('div');
      slot.className = 'inventory-slot' + (item ? ' filled' : '');
      slot.textContent = item ? item.name : '';

      if (item) {
        slot.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._showItemMenu(e.clientX, e.clientY, item, chest);
        });
      }

      grid.appendChild(slot);
    }
  }

  _showItemMenu(x, y, item, chest) {
    this._itemMenu.innerHTML = '';
    const takeBtn = document.createElement('button');
    takeBtn.textContent = 'Take';
    takeBtn.addEventListener('click', () => {
      chest.removeItem(item);
      this._itemMenu.classList.remove('visible');
      this._renderInventory(chest); // refresh grid
    });
    this._itemMenu.appendChild(takeBtn);
    this._itemMenu.style.left = `${x}px`;
    this._itemMenu.style.top  = `${y}px`;
    this._itemMenu.classList.add('visible');
  }

  _createInventoryModal() {
    const el = document.createElement('div');
    el.id = 'inventory-modal';

    const title = document.createElement('div');
    title.className = 'inventory-title';
    el.appendChild(title);

    const sub = document.createElement('div');
    sub.className = 'inventory-subtitle';
    el.appendChild(sub);

    const grid = document.createElement('div');
    grid.className = 'inventory-grid';
    el.appendChild(grid);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'inventory-close-btn';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => this.hideInventory());
    el.appendChild(closeBtn);

    // Close button (×) top-right
    const x = document.createElement('button');
    x.className = 'dialog-close';
    x.textContent = '×';
    x.addEventListener('click', () => this.hideInventory());
    el.insertBefore(x, el.firstChild);

    const gameEl = document.querySelector('#game') || document.body;
    gameEl.appendChild(el);
    return el;
  }

  _createItemMenu() {
    const el = document.createElement('div');
    el.id = 'inventory-item-menu';
    document.body.appendChild(el);
    return el;
  }
}
