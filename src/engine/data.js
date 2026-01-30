// src/engine/data.js
//
// Centralized, data-driven configuration tables.
// This module exports ONE object: Data.
// Everything else is internal implementation detail.

const Layers = Object.freeze({
  BACKGROUND: 0,
  WALLS: 1,
  DOORS: 2,
  INTERACTABLES: 3,
  TOKENS: 4,
});

const LayerCanvasId = Object.freeze({
  [Layers.BACKGROUND]: "bg",
  [Layers.WALLS]: "walls",
  [Layers.DOORS]: "doors",
  [Layers.INTERACTABLES]: "interactables",
  [Layers.TOKENS]: "tokens",
});

const EntityType = Object.freeze({
  PLAYER: 1,
  DEBUG_MARKER: 2,
  // Milestone 2+ additions:
  // WALL_SEGMENT: 10,
  // DOOR_SEGMENT: 11,
});

const EntityTypes = Object.freeze({
  [EntityType.PLAYER]: {
    id: EntityType.PLAYER,
    name: "Player",
    layer: Layers.TOKENS,

    render: {
      shape: "dot",
      radius: 7,
      fill: "#ff4d4d",
      stroke: "rgba(0,0,0,0.35)",
      lineWidth: 2,
    },

    collides: true,
    interactable: false,
  },

  [EntityType.DEBUG_MARKER]: {
    id: EntityType.DEBUG_MARKER,
    name: "Debug Marker",
    layer: Layers.INTERACTABLES,

    render: {
      shape: "dot",
      radius: 5,
      fill: "rgba(180,220,255,0.9)",
      stroke: "rgba(0,0,0,0.35)",
      lineWidth: 1,
    },

    collides: false,
    interactable: false,
  },
});

const DefaultWorld = Object.freeze({
  w: 25,
  h: 25,
  levels: 1,
  hexSize: 22,
  drawPadding: 3,
});

const DefaultViewport = Object.freeze({
  width: 1200,
  height: 600,
});

// ---- Public API ----

export const Data = Object.freeze({
  Layers,
  LayerCanvasId,
  EntityType,
  EntityTypes,
  DefaultWorld,
  DefaultViewport,
});
