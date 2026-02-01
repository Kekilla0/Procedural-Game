/**
 * logger - Simple logging system
 * 
 * Usage:
 *   import { logger } from './utils/logger.js';
 *   logger.info('Info message');
 *   logger.debug('Debug message'); // Only shows if DATA.DEBUG is true
 *   logger.error('Error message');
 * 
 * Debug Mode:
 *   Controlled by DATA.DEBUG constant in /src/data/constants.js
 */

import { DATA } from '../data/constants.js';

class Logger {
  constructor() {
    this.title = 'Game';
  }

  setTitle(title) {
    this.title = title;
  }

  info(...args) {
    console.log(`${this.title} | `, ...args);
  }

  debug(...args) {
    if (DATA.DEBUG) {
      console.log(`%c${this.title} | DEBUG |`, `color:red`, ...args);
    }
  }

  error(...args) {
    console.error(`${this.title} | ERROR | `, ...args);
  }

  warn(...args) {
    console.warn(`${this.title} | WARN | `, ...args);
  }
}

// Export singleton instance
export const logger = new Logger();