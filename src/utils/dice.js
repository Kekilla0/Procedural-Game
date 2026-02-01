/**
 * dice.js - Dice rolling utilities
 * 
 * Handles randomization using standard tabletop RPG dice notation.
 * Supports multiple dice in one string: "2d6 + 1d8 + 3"
 * Returns detailed roll information for game mechanics like rerolls and exploding dice.
 */

import { logger } from './logger.js';

/**
 * Roll dice using standard notation (supports multiple dice groups)
 * @param {string} notation - Dice notation (e.g., "1d6", "2d10+5", "2d6 + 1d8 + 3")
 * @returns {Object} Result object with total and detailed roll information
 * 
 * @example
 * roll("2d6 + 1d8 + 3")
 * // Returns:
 * // {
 * //   total: 15,
 * //   rolls: [
 * //     { notation: "2d6", dice: [4, 3], total: 7 },
 * //     { notation: "1d8", dice: [5], total: 5 },
 * //     { notation: "3", dice: [], total: 3 }
 * //   ]
 * // }
 */
export function roll(notation) {
  try {
    // Parse the entire notation string
    // Split by + or - while keeping the operators
    const parts = notation.split(/(\+|\-)/).map(s => s.trim()).filter(s => s !== '');
    
    let total = 0;
    const rolls = [];
    let currentSign = 1; // 1 for +, -1 for -
    
    for (const part of parts) {
      // Check if this is an operator
      if (part === '+') {
        currentSign = 1;
        continue;
      } else if (part === '-') {
        currentSign = -1;
        continue;
      }
      
      // Check if this is a dice notation (XdY) or just a number
      const diceMatch = part.match(/(\d+)d(\d+)/i);
      
      if (diceMatch) {
        // This is a dice roll (XdY)
        const numDice = parseInt(diceMatch[1]);
        const numSides = parseInt(diceMatch[2]);
        
        // Roll each die
        const dice = [];
        let rollTotal = 0;
        for (let i = 0; i < numDice; i++) {
          const value = rollSingle(numSides);
          dice.push(value);
          rollTotal += value;
        }
        
        // Apply sign
        rollTotal *= currentSign;
        total += rollTotal;
        
        rolls.push({
          notation: part,
          dice: dice,
          total: rollTotal
        });
        
      } else {
        // This is a flat modifier (just a number)
        const modifier = parseInt(part) * currentSign;
        total += modifier;
        
        rolls.push({
          notation: part,
          dice: [],
          total: modifier
        });
      }
      
      // Reset sign to positive for next iteration
      currentSign = 1;
    }
    
    const result = { total, rolls };
    logger.debug(`Rolled ${notation}:`, result);
    return result;
    
  } catch (error) {
    logger.error('Error rolling dice:', { notation, error: error.message });
    return { total: 0, rolls: [] };
  }
}

/**
 * Roll a single die with specified number of sides
 * @param {number} sides - Number of sides on the die
 * @returns {number} Random number between 1 and sides (inclusive)
 * 
 * @example
 * rollSingle(6)   // Returns 1-6
 * rollSingle(20)  // Returns 1-20
 */
export function rollSingle(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Roll multiple dice and return individual results
 * @param {number} numDice - Number of dice to roll
 * @param {number} sides - Number of sides on each die
 * @returns {number[]} Array of individual roll results
 * 
 * @example
 * rollMultiple(3, 6)  // Returns [4, 2, 6] (example)
 */
export function rollMultiple(numDice, sides) {
  const results = [];
  for (let i = 0; i < numDice; i++) {
    results.push(rollSingle(sides));
  }
  return results;
}

/**
 * Roll with advantage (roll twice, take higher)
 * @param {string} notation - Dice notation
 * @returns {Object} Result object with higher total
 */
export function rollAdvantage(notation) {
  const roll1 = roll(notation);
  const roll2 = roll(notation);
  return roll1.total >= roll2.total ? roll1 : roll2;
}

/**
 * Roll with disadvantage (roll twice, take lower)
 * @param {string} notation - Dice notation
 * @returns {Object} Result object with lower total
 */
export function rollDisadvantage(notation) {
  const roll1 = roll(notation);
  const roll2 = roll(notation);
  return roll1.total <= roll2.total ? roll1 : roll2;
}