/**
 * math.js - Mathematical calculation utilities
 * 
 * Handles stat calculations using formula strings.
 * Formulas can reference values using @ prefix and include dice rolls.
 * 
 * Example: "@strength * 10" or "@dexterity / 2" or "@strength * 1d6 + 5"
 */

import { logger } from './logger.js';
import { roll } from './dice.js';

/**
 * Calculate a value from a formula string
 * @param {string} formula - Formula string (e.g., "@strength * 10", "@strength * 1d6")
 * @param {Object} values - Object containing values to substitute
 * @returns {number} Calculated result
 * 
 * @example
 * calculate("@strength * 10", { strength: 5 }) // Returns 50
 * calculate("@dexterity / 2", { dexterity: 14 }) // Returns 7
 * calculate("@value1 + @value2", { value1: 10, value2: 5 }) // Returns 15
 * calculate("@strength * 1d6 + 5", { strength: 3 }) // Returns random (8-23)
 */
export function calculate(formula, values) {
  try {
    let expression = formula;
    
    // Step 1: Find and roll all dice notations first
    // Match patterns like: 1d6, 2d10, 3d8+5, or even complex: 2d6 + 1d8
    const dicePattern = /\d+d\d+(?:\s*[+-]\s*\d+d\d+)*(?:\s*[+-]\s*\d+)?/gi;
    const diceMatches = expression.match(dicePattern);
    
    if (diceMatches) {
      for (const diceNotation of diceMatches) {
        const rollResult = roll(diceNotation);
        // Replace the dice notation with its total
        expression = expression.replace(diceNotation, rollResult.total);
      }
    }
    
    // Step 2: Replace @variables with actual values
    const variables = expression.match(/@\w+/g) || [];
    
    for (const variable of variables) {
      const varName = variable.substring(1); // Remove @ prefix
      const value = values[varName];
      
      if (value === undefined) {
        logger.error(`Variable ${varName} not found in values`, { formula, values });
        return 0;
      }
      
      // Replace @variable with its value
      expression = expression.replace(variable, value);
    }
    
    // Step 3: Evaluate the mathematical expression
    // Using Function constructor for safe evaluation
    const result = Function(`"use strict"; return (${expression})`)();
    
    return Math.floor(result); // Return integer result
    
  } catch (error) {
    logger.error('Error calculating formula:', { formula, values, error: error.message });
    return 0;
  }
}