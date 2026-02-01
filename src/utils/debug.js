/**
 * debug.js - Debug panel utilities
 * 
 * Helper functions to update the debug panel with current game state
 */

import { DATA } from '../data/constants.js';

/**
 * Update debug panel with current values
 * @param {Object} values - Object containing debug values to display
 * @param {number} values.x - X coordinate
 * @param {number} values.y - Y coordinate
 * @param {number} values.col - Grid column
 * @param {number} values.row - Grid row
 * @param {number} values.playerCol - Player grid column
 * @param {number} values.playerRow - Player grid row
 */
export function updateDebugPanel(values) {
  // Only update if debug mode is enabled
  if (!DATA.DEBUG) return;
  
  // Update Position (x, y)
  if (values.x !== undefined && values.y !== undefined) {
    const posElement = document.getElementById('debug-position');
    if (posElement) posElement.textContent = `(${values.x}, ${values.y})`;
  }
  
  // Update Grid square (col, row)
  if (values.col !== undefined && values.row !== undefined) {
    const gridElement = document.getElementById('debug-grid');
    if (gridElement) gridElement.textContent = `(${values.col}, ${values.row})`;
  }
  
  // Update Player position (playerCol, playerRow)
  if (values.playerCol !== undefined && values.playerRow !== undefined) {
    const playerElement = document.getElementById('debug-player');
    if (playerElement) playerElement.textContent = `(${values.playerCol}, ${values.playerRow})`;
  }
}

/**
 * Show or hide debug panel based on DEBUG constant
 */
export function toggleDebugPanel() {
  const panel = document.getElementById('debug-panel');
  if (panel) {
    panel.style.display = DATA.DEBUG ? 'block' : 'none';
  }
}