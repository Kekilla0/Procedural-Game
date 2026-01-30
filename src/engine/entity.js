// src/engine/entity.js
//
// Minimal base class for all world entities.
// Differentiation is done via entity.type (integer) with Data.EntityTypes lookup.
//
// Notes:
// - This class performs LIGHT structural validation only.
// - Full semantic validation (does the type exist in Data?) should happen in the registry/game.

function generateId() {
  // High-entropy, short, readable ID
  // Example: e_k9f3x2m8p
  return (
    "e_" +
    Math.random().toString(36).slice(2, 8) +
    Math.random().toString(36).slice(2, 6)
  );
}

export class Entity {
  constructor({ type, col = 0, row = 0, z = 0, state = null, id = null } = {}) {
    // Structural validation
    if (!Number.isInteger(type)) {
      throw new Error(`Entity requires an integer 'type'. Received: ${type}`);
    }

    this.id = id ?? generateId();
    this.type = type;

    // grid position (odd-r offset coordinates)
    this.col = col;
    this.row = row;
    this.z = z;

    // optional per-entity state bag (open/closed, hp, flags, etc.)
    // Must remain JSON-serializable.
    this.state = state ?? {};
  }

  setPos(col, row, z = this.z) {
    this.col = col;
    this.row = row;
    this.z = z;
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      col: this.col,
      row: this.row,
      z: this.z,
      state: this.state,
    };
  }

  static fromJSON(data) {
    return new Entity({
      id: data.id ?? null,
      type: data.type,
      col: data.col,
      row: data.row,
      z: data.z ?? 0,
      state: data.state ?? {},
    });
  }
}
