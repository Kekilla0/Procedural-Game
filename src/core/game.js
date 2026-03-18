/**
 * Game.js - Main game scene (turn-based, event-driven)
 * 
 * This is the core game scene. Unlike real-time games, this is turn-based,
 * so rendering only happens when game state changes (player input, enemy turn, etc).
 * 
 * Extends Phaser.Scene to use Phaser's graphics, input, and scene management.
 */

import { Canvas } from './canvas.js';
import { Token } from './token.js';
import { Player } from './player.js';
import { Enemy } from './enemy.js';
import { Wall } from './wall.js';
import { Door } from './door.js';
import { Item } from './item.js';
import { Camera } from './camera.js';
import { DATA } from '../data/constants.js';
import { logger } from '../utils/logger.js';
import { toggleDebugPanel, updateDebugPanel } from '../utils/debug.js';
import { Dialog } from '../ui/dialog.js';
import { Tile } from './tile.js';
import { MONSTER_DEFS } from '../data/monsters.js';
import { loadEntityTextures, SPRITE_FRAME, CHEST_FRAME } from '../utils/textures.js';

export class Game extends Phaser.Scene {
  
  constructor() {
    super({ key: 'Game' });
    this.rotation = 0; // 0, 90, 180, or 270
  }
  
  preload() {
    loadEntityTextures(this);
  }

  /**
   * Create game objects (runs once when scene starts)
   */
  create() {
    logger.info('Game scene created');
    
    this.graphics = this.add.graphics();


    //TODO : This should be created/decided once all rooms have been "generated", assuming only 800,600 here.
    this.world = new Canvas(800, 600);
    const grid = this.world.layers.grid;
    
    // Spawn player outside the room (bottom-right area)
    this.player = Token.spawn(Player, this.world, {
      x: 22,
      y: 18,
      w: 8,
      h: 6,
      name: 'Player'
    });
    
    if (!this.player) {
      logger.error('Failed to spawn player!');
      return;
    }
    
    // Room bounds — 10 wide × 8 tall
    const ROOM = { c0: 10, c1: 20, r0: 8, r1: 16 };

    // Positions already occupied (player + any spawned monster)
    const taken = [{ col: this.player.col, row: this.player.row }];

    // Goblin — random tile OUTSIDE the room
    const goblinPos = this._randomOutside(grid, ROOM, taken);
    taken.push(goblinPos);
    this.goblin = Token.spawn(Enemy, this.world, {
      x: goblinPos.col, y: goblinPos.row, w: 1, h: 1,
      name: 'Goblin', img: 'monster_goblin', monsterType: 'goblin'
    });
    this._applyMonsterDef(this.goblin, 'goblin');

    // Orc — random tile INSIDE the room
    const orcPos = this._randomInside(ROOM, taken);
    taken.push(orcPos);
    const orc = Token.spawn(Enemy, this.world, {
      x: orcPos.col, y: orcPos.row, w: 1, h: 1,
      name: 'Orc', img: 'monster_orc', monsterType: 'orc'
    });
    this._applyMonsterDef(orc, 'orc');

    // Skeleton — random tile INSIDE the room
    const skelPos = this._randomInside(ROOM, taken);
    taken.push(skelPos);
    const skeleton = Token.spawn(Enemy, this.world, {
      x: skelPos.col, y: skelPos.row, w: 1, h: 1,
      name: 'Skeleton', img: 'monster_skeleton', monsterType: 'skeleton'
    });
    this._applyMonsterDef(skeleton, 'skeleton');

    // Fill ground tiles: stone inside the room, grass/sand outside
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.columns; col++) {
        const isInRoom = col >= ROOM.c0 && col <= ROOM.c1 && row >= ROOM.r0 && row <= ROOM.r1;
        let type;
        if (isInRoom) {
          type = 'stone';
        } else {
          const h = ((col * 73856093) ^ (row * 19349663)) >>> 0;
          type = (h % 100) < 15 ? 'sand' : 'grass';
        }
        const grid = this.world.layers.grid;
        this.world.layers.tiles.push(new Tile(col * grid.size, row * grid.size, grid.size, grid.size, { col, row, type, grid }));
      }
    }

    // Room walls — loop-built, door in center of south wall
    const doorCol = Math.floor((ROOM.c0 + ROOM.c1) / 2);
    for (let c = ROOM.c0; c <= ROOM.c1; c++) {
      Wall.place(this.world, c, ROOM.r0, 'north');                               // north wall
      if (c === doorCol) Door.place(this.world, c, ROOM.r1, 'south');            // door
      else               Wall.place(this.world, c, ROOM.r1, 'south');            // south wall
    }
    for (let r = ROOM.r0; r <= ROOM.r1; r++) {
      Wall.place(this.world, ROOM.c0, r, 'west');                                // west wall
      Wall.place(this.world, ROOM.c1, r, 'east');                                // east wall
    }

    // Hand wall rendering to game.js so each wall gets its own Phaser Graphics
    // at the correct sort depth, allowing sprites to interleave with walls correctly.
    this.world.externalWallRenderer = true;
    this._wallGraphics = new Map();
    for (const wall of this.world.layers.walls) {
      const gfx = this.add.graphics();
      this._wallGraphics.set(wall, gfx);
    }

    // Create camera controller
    this.cameraController = new Camera(this.cameras.main, {
      canvasWidth: this.world.width,
      canvasHeight: this.world.height,
      grid: grid
    });
    
    // Make camera follow player
    this.cameraController.follow(this.player);
    
    // Set initial screen positions for all tokens
    for (const token of this.world.layers.tokens) {
      token.updateScreenPosition();
    }
    
    // Monster sprites — one Phaser Image per enemy; texture key comes from token.img
    this._monsterSprites = [];
    this._chestSprites = []; // { chest, spr } pairs
    for (const token of this.world.layers.tokens) {
      if (!(token instanceof Enemy) || !token.img) continue;
      const spr = this.add.image(0, 0, token.img, SPRITE_FRAME.south);
      token.useSprite = true;
      this._monsterSprites.push({ token, spr });
    }

    // Dialog system (modal + speech bubbles)
    this.dialog = new Dialog();
    this.gameStarted = false;

    // Game creation screen — class selection
    this.dialog.show({
      title: 'Choose Your Class',
      message: 'Select a class to begin your adventure.',
      choices: [
        { label: 'Warrior  (STR)',   action: () => this._startGame('warrior') },
        { label: 'Rogue    (DEX)',   action: () => this._startGame('rogue') },
        { label: 'Sorcerer (INT)',   action: () => this._startGame('sorcerer') }
      ]
    });

    if (this.goblin) {
      this.dialog.showSpeech(this.goblin, {
        message: 'Halt! Who dares enter my domain?',
        choices: [
          { label: 'Attack',    action: () => console.log(`Player attacks ${this.goblin.name}!`) },
          { label: 'Negotiate', action: () => console.log(`Player tries to negotiate with ${this.goblin.name}.`) },
          { label: 'Flee',      action: () => { console.log('Player flees!'); this.dialog.hideSpeech(); } }
        ]
      });
    }

    // Cache context menu DOM element and suppress browser right-click menu
    this.contextMenu = document.getElementById('context-menu');
    document.addEventListener('contextmenu', (e) => e.preventDefault());

    // Setup keyboard input
    this.setupInput();
    
    // Show/hide debug panel based on DEBUG constant
    toggleDebugPanel();
    
    // Set initial debug panel values
    updateDebugPanel({
      x: 0,
      y: 0,
      col: 0,
      row: 0,
      playerCol: this.player.col,
      playerRow: this.player.row,
      zoom: this.cameras.main.zoom,
      rotation: this.rotation
    });
    
    // Initial render
    this.render();
    
    logger.debug('Initial render complete');
  }
  
  /**
   * Setup keyboard input handlers
   */
  setupInput() {
    this.input.keyboard.on('keydown', (event) => {
      this.handleInput(event.key);
    });
    
    // Track hovered tile for highlighting
    this.hoveredTile = null;
    
    // Track mouse position for debug and hover highlighting
    this.input.on('pointermove', (pointer) => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const worldX = worldPoint.x;
      const worldY = worldPoint.y;

      const isoTileWidth = 64;
      const offsetX = 400;
      const offsetY = 100;

      // Convert ISO screen pos → visual grid coords (rotated space)
      const gridPos = Canvas.isoToCartesian(worldX - offsetX, worldY - offsetY, isoTileWidth);
      const visCol = Math.floor(gridPos.x);
      const visRow = Math.floor(gridPos.y);

      // Un-rotate visual coords → world grid coords
      const grid = this.world.layers.grid;
      const worldTile = Canvas.unrotateCoordinates(visCol, visRow, this.rotation, grid.columns, grid.rows);
      const col = worldTile.col;
      const row = worldTile.row;
      
      // Update hovered tile if within movement range
      const movementRange = this.player.getMovementRange();
      const isInRange = movementRange.some(t => t.col === col && t.row === row);
      
      if (isInRange) {
        this.hoveredTile = { col, row };
      } else {
        this.hoveredTile = null;
      }
      
      updateDebugPanel({
        x: Math.floor(pointer.x),
        y: Math.floor(pointer.y),
        col: col,
        row: row,
        playerCol: this.player.col,
        playerRow: this.player.row,
        zoom: this.cameras.main.zoom,
        rotation: this.rotation
      });
      
      // Re-render to show hover highlight
      this.render();
    });
    
    // Left-click: move player. Right-click: context menu for interactables.
    this.input.on('pointerdown', (pointer) => {
      if (pointer.rightButtonDown()) {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const interactable = this.world.getInteractableAt(worldPoint.x, worldPoint.y, this.rotation);
        if (interactable) {
          this.showContextMenu(pointer.event.clientX, pointer.event.clientY, interactable);
        } else {
          this.hideContextMenu();
        }
        return;
      }

      // Left-click: hide any open context menu, then move if applicable
      this.hideContextMenu();
      if (this.hoveredTile) {
        this.movePlayerToTile(this.hoveredTile.col, this.hoveredTile.row);
      }
    });
    
    // Mouse wheel zoom
    this.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY, _deltaZ) => {
      this.handleZoom(deltaY);
    });
  }
  
  /**
   * Handle mouse wheel zoom
   * @param {number} deltaY - Mouse wheel delta (positive = zoom out, negative = zoom in)
   */
  handleZoom(deltaY) {
    const currentZoom = this.cameras.main.zoom;
    let targetZoom = currentZoom;
    
    if (deltaY < 0) {
      // Scroll up - zoom in
      targetZoom += DATA.CAMERA.ZOOM_SPEED;
    } else if (deltaY > 0) {
      // Scroll down - zoom out
      targetZoom -= DATA.CAMERA.ZOOM_SPEED;
    }
    
    // Clamp to limits
    targetZoom = Math.max(this.cameraController.minZoom, Math.min(this.cameraController.maxZoom, targetZoom));
    
    // Apply smooth zoom
    this.cameras.main.zoomTo(targetZoom, DATA.CAMERA.ZOOM_SMOOTH_DURATION);
    
    // Update debug panel with new zoom
    updateDebugPanel({
      zoom: targetZoom
    });
    
    logger.debug(`Zoom: ${currentZoom.toFixed(2)} → ${targetZoom.toFixed(2)}`);
  }
  
  /**
   * Handle player input (triggers game logic)
   * @param {string} key - Key that was pressed
   */
  handleInput(key) {
    logger.debug('Key pressed:', key);
    
    // E/Q — rotate the isometric map
    if (key.toLowerCase() === DATA.VIEW.ROTATION_KEY) {
      this.rotation = (this.rotation + DATA.VIEW.ROTATION_INCREMENT) % 360;
      this.world.rotate(this.rotation);
      updateDebugPanel({ rotation: this.rotation });
      this.render();
      return;
    }
    if (key.toLowerCase() === DATA.VIEW.ROTATION_KEY_CCW) {
      this.rotation = (this.rotation - DATA.VIEW.ROTATION_INCREMENT + 360) % 360;
      this.world.rotate(this.rotation);
      updateDebugPanel({ rotation: this.rotation });
      this.render();
      return;
    }

    // WASD movement - remapped based on current rotation so controls match what the player sees.
    // Phaser setAngle(90) maps: world-right → screen-down, world-up → screen-right.
    // So at 90°, W (screen-up) must move world-left, D (screen-right) must move world-up, etc.
    if (!this.gameStarted) return;

    // WASD remapped so controls feel correct at each rotation
    const DIRECTION_MAP = {
      0:   { w: 'up',    s: 'down',  a: 'left',  d: 'right' },
      90:  { w: 'left',  s: 'right', a: 'down',  d: 'up'    },
      180: { w: 'down',  s: 'up',    a: 'right', d: 'left'  },
      270: { w: 'right', s: 'left',  a: 'up',    d: 'down'  }
    };
    const lowerKey = key.toLowerCase();
    let moved = false;
    const direction = (DIRECTION_MAP[this.rotation] || DIRECTION_MAP[0])[lowerKey];
    if (direction) {
      moved = this.player.move(direction);
    }

    if (moved) {
      logger.debug(`Player moved to grid (${this.player.col}, ${this.player.row})`);
      this.player.updateScreenPosition();

      // Update debug panel with new player position
      updateDebugPanel({
        playerCol: this.player.col,
        playerRow: this.player.row,
        zoom: this.cameras.main.zoom
      });
      
      this.render();
    }
  }
  
  /**
   * Move player to target tile with pathfinding and animation
   * @param {number} targetCol - Target column
   * @param {number} targetRow - Target row
   */
  async movePlayerToTile(targetCol, targetRow) {
    // Calculate path (simple Manhattan pathfinding)
    const path = this.findPath(this.player.col, this.player.row, targetCol, targetRow);
    
    if (path.length === 0) {
      logger.debug('No path found to target');
      return;
    }
    
    // Move along path one step at a time
    for (const step of path) {
      // Determine direction
      const dCol = step.col - this.player.col;
      const dRow = step.row - this.player.row;
      
      let direction;
      if (dRow < 0) direction = 'up';
      else if (dRow > 0) direction = 'down';
      else if (dCol < 0) direction = 'left';
      else if (dCol > 0) direction = 'right';
      
      // Move player
      const moved = this.player.move(direction);
      
      if (!moved) {
        logger.debug('Movement blocked');
        break;
      }
      
      this.player.updateScreenPosition();

      // Update debug panel
      updateDebugPanel({
        playerCol: this.player.col,
        playerRow: this.player.row
      });
      
      // Render
      this.render();
      
      // Wait before next step
      await new Promise(resolve => setTimeout(resolve, DATA.MOVEMENT.STEP_DELAY));
    }
  }
  
  /**
   * Find path from start to end (simple Manhattan distance pathfinding)
   * @param {number} startCol - Start column
   * @param {number} startRow - Start row
   * @param {number} endCol - End column
   * @param {number} endRow - End row
   * @returns {Array} Path as array of {col, row} steps
   */
  findPath(startCol, startRow, endCol, endRow) {
    const path = [];
    let currentCol = startCol;
    let currentRow = startRow;
    
    // Simple greedy pathfinding - move one axis at a time
    while (currentCol !== endCol || currentRow !== endRow) {
      // Move vertically first
      if (currentRow < endRow) {
        currentRow++;
      } else if (currentRow > endRow) {
        currentRow--;
      }
      // Then horizontally
      else if (currentCol < endCol) {
        currentCol++;
      } else if (currentCol > endCol) {
        currentCol--;
      }
      
      path.push({ col: currentCol, row: currentRow });
    }
    
    return path;
  }
  
  /**
   * Render the game (only called when state changes)
   */
  render() {
    // Clear previous frame
    this.graphics.clear();
    
    // Get player movement range for highlighting
    const movementRange = this.player.getMovementRange();
    
    // Mark the hovered tile if it exists (don't duplicate, just mark it)
    const highlights = movementRange.map(tile => {
      if (this.hoveredTile && tile.col === this.hoveredTile.col && tile.row === this.hoveredTile.row) {
        return { ...tile, isHovered: true };
      }
      return tile;
    });
    
    // Canvas handles rendering of background, grid, and all layers
    this.world.render(this.graphics, highlights);

    this._updateWallGraphics();
    this._updatePlayerSprite();
    this._updateMonsterSprites();
    this._updateChestSprites();

    // Keep speech bubble anchored to its entity
    this.dialog.updateSpeechPosition(this.cameras.main);

    // Keep stats panel current (movement pool changes on each move)
    if (this.gameStarted) this.player.updateStatsPanel();
  }
  
  /**
   * Update method (runs every frame)
   * For turn-based games, we don't need continuous updates
   */
  update() {
    // Intentionally empty - we use event-driven rendering
  }
  
  /**
   * Process a turn for an entity
   * @param {Object} entity - Entity taking their turn
   */
  processTurn(_entity) {
    // TODO: Implement turn processing
    // - Execute entity's action
    // - Update game state
    // - Re-render
    this.render();
  }

  /**
   * Show the context menu at screen position for a given interactable.
   * Populates menu items based on the interactable's type and state.
   * @param {number} clientX - Browser client X (from pointer.event.clientX)
   * @param {number} clientY - Browser client Y (from pointer.event.clientY)
   * @param {Object} interactable - The wall/door/etc that was right-clicked
   */
  showContextMenu(clientX, clientY, interactable) {
    if (!this.contextMenu) return;

    const items = interactable.getContextMenuItems(this.player);

    // Populate DOM
    this.contextMenu.innerHTML = '';
    for (const item of items) {
      const btn = document.createElement('button');
      btn.textContent = item.label;
      if (item.disabled) {
        btn.classList.add('disabled');
        btn.title = 'Too far away';
      } else {
        btn.addEventListener('click', () => {
          item.action();
          this._cleanupDeadEnemies();
          this.render();
          this.hideContextMenu();
        });
      }
      this.contextMenu.appendChild(btn);
    }

    // Position and show
    this.contextMenu.style.left = `${clientX}px`;
    this.contextMenu.style.top  = `${clientY}px`;
    this.contextMenu.classList.add('visible');
  }

  _startGame(characterClass) {
    this.player.characterClass = characterClass;
    const stats = DATA.CHARACTER_CLASSES[characterClass];
    this.player.strength     = stats.strength;
    this.player.dexterity    = stats.dexterity;
    this.player.intelligence = stats.intelligence;
    this.player.calculateStats();
    this.gameStarted = true;
    this.dialog.hide();

    // Set up the Phaser sprite for the player (depth set dynamically each frame)
    this.player.img = `player_${characterClass}`;
    this._playerSprite = this.add.image(0, 0, this.player.img, SPRITE_FRAME.south);
    this.player.useSprite = true;

    this._updatePlayerSprite();
    this.render();
    logger.info(`Game started as ${characterClass}`);
  }

  _updatePlayerSprite() {
    if (!this._playerSprite || !this.player.img) return;
    const DIR_MAP = { up: 'north', down: 'south', left: 'west', right: 'east' };
    const dir = DIR_MAP[this.player.direction] || this.player.direction || 'south';
    this._playerSprite.setTexture(this.player.img);
    this._playerSprite.setFrame(SPRITE_FRAME[dir]);

    const grid   = this.world.layers.grid;
    const maxCol = grid.columns - 1;
    const maxRow = grid.rows - 1;
    const { col: rc, row: rr } = Canvas.rotateCoordinates(this.player.col, this.player.row, this.rotation, maxCol, maxRow);
    this._playerSprite.setDepth((rc + rr) * 10 + 5);

    this._playerSprite.setOrigin(0.5, 1.0);
    this._playerSprite.setAngle(0);
    this._playerSprite.setPosition(
      this.player.x + this.player.width / 2,
      this.player.y + this.player.height
    );
  }

  /**
   * Hide the context menu.
   */
  hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.classList.remove('visible');
    }
  }


  // ---------------------------------------------------------------------------
  // Enemy lifecycle
  // ---------------------------------------------------------------------------

  _cleanupDeadEnemies() {
    if (!this._monsterSprites) return;
    const dead = this._monsterSprites.filter(({ token }) => token.alive === false);
    const grid = this.world.layers.grid;

    for (const { token, spr } of dead) {
      // Remove token from canvas
      const idx = this.world.layers.tokens.indexOf(token);
      if (idx !== -1) this.world.layers.tokens.splice(idx, 1);
      spr.destroy();

      if (!token.container) continue;

      // Morph the token's personal container into a map-placed lootable container.
      // The container already holds the monster's loot (populated in _applyMonsterDef).
      const c    = token.container;
      c.col      = token.col;
      c.row      = token.row;
      c.x        = token.col * grid.size;
      c.y        = token.row * grid.size;
      c.width    = grid.size;
      c.height   = grid.size;
      c.grid     = grid;
      c.img      = 'chest';
      c.onOpen   = (ct) => this._openChestDialog(ct);

      this.world.layers.containers.push(c);

      // Sprite starts at 2D world position; _updateChestSprites corrects for ISO each frame
      const chestSpr = this.add.image(c.x + c.width / 2, c.y + c.height / 2, 'chest', CHEST_FRAME);
      chestSpr.setDepth((c.col + c.row) * 10 + 3);
      this._chestSprites.push({ chest: c, spr: chestSpr });
    }
    this._monsterSprites = this._monsterSprites.filter(({ token }) => token.alive !== false);
  }

  // ---------------------------------------------------------------------------
  // Monster placement helpers
  // ---------------------------------------------------------------------------

  _randomOutside(grid, room, taken) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const col = Math.floor(Math.random() * grid.columns);
      const row = Math.floor(Math.random() * grid.rows);
      const inRoom = col >= room.c0 && col <= room.c1 && row >= room.r0 && row <= room.r1;
      if (inRoom) continue;
      if (taken.some(t => t.col === col && t.row === row)) continue;
      return { col, row };
    }
    return { col: 0, row: 0 };
  }

  _randomInside(room, taken) {
    const cols = room.c1 - room.c0 + 1;
    const rows = room.r1 - room.r0 + 1;
    for (let attempt = 0; attempt < 50; attempt++) {
      const col = room.c0 + Math.floor(Math.random() * cols);
      const row = room.r0 + Math.floor(Math.random() * rows);
      if (taken.some(t => t.col === col && t.row === row)) continue;
      return { col, row };
    }
    return { col: room.c0, row: room.r0 };
  }

  // ---------------------------------------------------------------------------
  // Wall rendering (per-wall Phaser Graphics so depth interleaves with sprites)
  // ---------------------------------------------------------------------------

  _updateWallGraphics() {
    if (!this._wallGraphics) return;
    const grid    = this.world.layers.grid;
    const maxCol  = grid.columns - 1;
    const maxRow  = grid.rows - 1;
    const fadeDist = DATA.WALL.FADE_DISTANCE;

    // Player's depth in rotated space
    const { col: prc, row: prr } = Canvas.rotateCoordinates(
      this.player.col, this.player.row, this.rotation, maxCol, maxRow
    );
    const playerDepth = prc + prr;

    for (const [wall, gfx] of this._wallGraphics) {
      gfx.clear();
      const wallDepth = this.world.getWallSortDepth(wall, this.rotation);
      gfx.setDepth(wallDepth * 10 + 1);

      // Distance from player to this wall's nearest root tile (Manhattan)
      const root2 = wall.side === 'north'
        ? { col: wall.col,     row: wall.row - 1 }
        : { col: wall.col - 1, row: wall.row     };
      const d1 = Math.abs(this.player.col - wall.col)  + Math.abs(this.player.row - wall.row);
      const d2 = Math.abs(this.player.col - root2.col) + Math.abs(this.player.row - root2.row);
      const dist = Math.min(d1, d2);

      // Fade walls that render ON TOP of the player (strictly higher depth) AND are close
      let alpha = 1;
      if (wallDepth > playerDepth && dist <= fadeDist) {
        alpha = Math.max(0.08, dist / fadeDist);
      }

      wall.render(gfx, this.rotation, alpha);
    }
  }

  // ---------------------------------------------------------------------------
  // Monster sprite management
  // ---------------------------------------------------------------------------

  _updateMonsterSprites() {
    if (!this._monsterSprites) return;
    const DIR_MAP = { up: 'north', down: 'south', left: 'west', right: 'east' };
    const grid   = this.world.layers.grid;
    const maxCol = grid.columns - 1;
    const maxRow = grid.rows - 1;

    for (const { token, spr } of this._monsterSprites) {
      const dir = DIR_MAP[token.direction] || token.direction || 'south';
      spr.setTexture(token.img);
      spr.setFrame(SPRITE_FRAME[dir]);

      const { col: rc, row: rr } = Canvas.rotateCoordinates(token.col, token.row, this.rotation, maxCol, maxRow);
      spr.setDepth((rc + rr) * 10 + 5);

      spr.setOrigin(0.5, 1.0);
      spr.setAngle(0);
      spr.setPosition(token.x + token.width / 2, token.y + token.height);
    }
  }


  /** Apply MONSTER_DEFS base_stats and loot to a freshly spawned enemy token. */
  _applyMonsterDef(token, typeName) {
    if (!token) return;
    const def = MONSTER_DEFS[typeName];
    if (!def) return;
    if (def.base_stats) {
      token.strength     = def.base_stats.strength     ?? 0;
      token.dexterity    = def.base_stats.dexterity    ?? 0;
      token.intelligence = def.base_stats.intelligence ?? 0;
      token.fullResetStats();
      token.movementRemaining = token.movement;
      // Rebuild container with correct capacity from new stats
      if (token.container) {
        token.container.capacity  = Math.max(1, Math.round(token.maxCapacity ?? 4));
        token.container.inventory = [];
      }
    }
    // Populate inventory with Item instances from loot definition
    if (def.loot && token.container) {
      for (const lootDef of def.loot) {
        token.container.addItem(new Item(0, 0, 0, 0, { name: lootDef.name }));
      }
    }
  }

  /** Update position/depth of chest sprites each frame. */
  _updateChestSprites() {
    if (!this._chestSprites) return;
    const grid   = this.world.layers.grid;
    const maxCol = grid.columns - 1;
    const maxRow = grid.rows - 1;

    for (const { chest, spr } of this._chestSprites) {
      const { col: rc, row: rr } = Canvas.rotateCoordinates(chest.col, chest.row, this.rotation, maxCol, maxRow);
      spr.setDepth((rc + rr) * 10 + 3);
      spr.setTexture('chest');
      spr.setFrame(CHEST_FRAME);
      spr.setOrigin(0.5, 1.0);
      spr.setAngle(0);
      const isoPos = Canvas.cartesianToIso(rc + 0.5, rr + 0.5, 64);
      spr.setPosition(isoPos.screenX + 400, isoPos.screenY + 100 + 16);
    }
  }

  /** Show the loot/inventory dialog for a chest. */
  _openChestDialog(chest) {
    this.dialog.showInventory(chest);
  }

}