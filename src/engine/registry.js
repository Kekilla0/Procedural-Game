// src/engine/registry.js
//
// World entity store.
// Responsibilities:
// - Owns all PLACEABLE entities (Entities are world objects in Option A)
// - Enforces unique IDs
// - Performs semantic validation of entity.type against Data.EntityTypes
// - Provides fast queries (all / byId / byType / byLayer)

import { Data } from "./data.js";

export class Registry {
  constructor() {
    this._byId = new Map();     // id -> Entity
    this._byType = new Map();   // type -> Set<Entity>
    this._byLayer = new Map();  // layer -> Set<Entity>
  }

  size() {
    return this._byId.size;
  }

  has(id) {
    return this._byId.has(id);
  }

  get(id) {
    return this._byId.get(id) ?? null;
  }

  all() {
    return Array.from(this._byId.values());
  }

  /**
   * Validate that a type exists in the data table.
   * (Entity does structural checks; Registry does semantic checks.)
   */
  _assertKnownType(type) {
    const def = Data.EntityTypes[type];
    if (!def) {
      throw new Error(`Unknown entity type: ${type}. Missing from Data.EntityTypes.`);
    }
    return def;
  }

  /**
   * Add an entity to the registry.
   */
  add(entity) {
    if (!entity) throw new Error("Registry.add(entity): entity is required.");

    // Structural expectations
    if (typeof entity.id !== "string" || entity.id.length === 0) {
      throw new Error("Registry.add(entity): entity.id must be a non-empty string.");
    }
    if (!Number.isInteger(entity.type)) {
      throw new Error(`Registry.add(entity): entity.type must be an integer. Received: ${entity.type}`);
    }

    // Semantic validation
    const def = this._assertKnownType(entity.type);

    // Uniqueness
    if (this._byId.has(entity.id)) {
      throw new Error(`Registry.add(entity): duplicate entity id '${entity.id}'.`);
    }

    this._byId.set(entity.id, entity);

    // Index by type
    if (!this._byType.has(entity.type)) this._byType.set(entity.type, new Set());
    this._byType.get(entity.type).add(entity);

    // Index by layer (from data definition)
    const layer = def.layer;
    if (!this._byLayer.has(layer)) this._byLayer.set(layer, new Set());
    this._byLayer.get(layer).add(entity);

    return entity;
  }

  /**
   * Remove an entity by id (or by entity object).
   */
  remove(idOrEntity) {
    const id = typeof idOrEntity === "string" ? idOrEntity : idOrEntity?.id;
    if (!id) return null;

    const entity = this._byId.get(id);
    if (!entity) return null;

    // Need def to remove from layer index
    const def = Data.EntityTypes[entity.type];

    this._byId.delete(id);

    // type index
    const typeSet = this._byType.get(entity.type);
    if (typeSet) {
      typeSet.delete(entity);
      if (typeSet.size === 0) this._byType.delete(entity.type);
    }

    // layer index
    if (def) {
      const layerSet = this._byLayer.get(def.layer);
      if (layerSet) {
        layerSet.delete(entity);
        if (layerSet.size === 0) this._byLayer.delete(def.layer);
      }
    }

    return entity;
  }

  /**
   * Get entities by type.
   */
  byType(type) {
    const set = this._byType.get(type);
    return set ? Array.from(set) : [];
  }

  /**
   * Get entities by layer.
   */
  byLayer(layer) {
    const set = this._byLayer.get(layer);
    return set ? Array.from(set) : [];
  }

  /**
   * Clear everything.
   */
  clear() {
    this._byId.clear();
    this._byType.clear();
    this._byLayer.clear();
  }
}
