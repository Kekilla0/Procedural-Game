// src/engine/game.js

import { Data } from "./data.js";
import { Registry } from "./registry.js";
import { Entity } from "./entity.js";

export class Game {
  constructor({ ui = null } = {}) {
    // --- config / state ---
    this.world = { ...Data.DefaultWorld };
    this.viewport = { ...Data.DefaultViewport };

    this.rotation = 0;

    this.camera = {
      x: Math.floor(this.viewport.width / 2),
      y: Math.floor(this.viewport.height / 2),
    };

    this.ui = ui;

    // --- canvas layers ---
    // Populated by attachCanvases(...)
    this.canvas = {
      layers: {}, // { [canvasId]: { canvas, ctx } }
    };

    // --- entities ---
    this.registry = new Registry();

    // player entity id (set in spawnPlayer)
    this.playerId = null;

    // hover (input can update this)
    this.hover = { col: null, row: null, z: 0 };

    // --- systems ---
    this.systems = [];

    // --- loop control ---
    this._running = false;
    this._lastMs = 0;
    this._raf = null;
  }

  // ----- canvas setup -----

  attachCanvases(layerCanvasIdMap) {
    const ids = Object.values(layerCanvasIdMap);

    const layers = {};
    for (const domId of ids) {
      const canvas = document.getElementById(domId);
      if (!canvas) throw new Error(`Missing canvas element: #${domId}`);

      canvas.width = this.viewport.width;
      canvas.height = this.viewport.height;

      const ctx = canvas.getContext("2d");
      layers[domId] = { canvas, ctx };
    }

    this.canvas.layers = layers;
  }

  getLayerCtx(layerId) {
    const domId = Data.LayerCanvasId[layerId];
    const layer = this.canvas.layers[domId];
    return layer?.ctx ?? null;
  }

  getLayerCanvas(layerId) {
    const domId = Data.LayerCanvasId[layerId];
    const layer = this.canvas.layers[domId];
    return layer?.canvas ?? null;
  }

  clearAllLayers() {
    for (const key of Object.keys(this.canvas.layers)) {
      const { ctx, canvas } = this.canvas.layers[key];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // ----- entity helpers -----

  addEntity(entity) {
    return this.registry.add(entity);
  }

  removeEntity(idOrEntity) {
    return this.registry.remove(idOrEntity);
  }

  getEntity(id) {
    return this.registry.get(id);
  }

  getPlayer() {
    return this.playerId ? this.registry.get(this.playerId) : null;
  }

  spawnPlayer({ col, row, z = 0 } = {}) {
    const e = new Entity({
      type: Data.EntityType.PLAYER,
      col,
      row,
      z,
      state: {
        // Temporary, Milestone 1/2 scaffolding:
        // later this will be derived from stats (Dexterity, buffs, etc.)
        moveRange: 2,
      },
    });

    this.addEntity(e);
    this.playerId = e.id;
    return e;
  }

  // ----- systems -----

  addSystem(system) {
    this.systems.push(system);
    if (typeof system.init === "function") system.init(this);
    return system;
  }

  // ----- loop -----

  start() {
    if (this._running) return;
    this._running = true;
    this._lastMs = performance.now();

    const tick = (nowMs) => {
      if (!this._running) return;

      const dt = Math.max(0, (nowMs - this._lastMs) / 1000);
      this._lastMs = nowMs;

      for (const s of this.systems) {
        if (typeof s.update === "function") s.update(this, dt, nowMs);
      }

      for (const s of this.systems) {
        if (typeof s.render === "function") s.render(this);
      }

      this._raf = requestAnimationFrame(tick);
    };

    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }
}
