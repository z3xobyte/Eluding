const { v4: uuidv4 } = require("uuid");
const SAT = require("sat"); // Import SAT.js library
const config = require("./config");

class Player {
  constructor({ id, name, x, y, mapId }) {
    this.id = id;
    this.name = name || `Player ${id.substring(0, 4)}`;
    this.x = x;
    this.y = y;
    this.radius = 25;
    this.color = "#FFFFFF";
    this.speed = 5;
    this.isDead = false;
    this.currentMapId = mapId;
    this.respawnTimer = null;
    this.score = 0;
    this.kills = 0;
    this.damageDone = 0;
    this.lastProcessedInput = 0; // Track last processed client input
    this.pendingInputs = []; // Store pending inputs for processing
    this.inputBuffer = []; // Buffer for smoothing out network jitter
    this.inputBufferSize = 3; // Number of inputs to buffer
    this.lastUpdateTime = Date.now();
    this.originalColor = this.color;
    this.originalMaxSpeed = this.speed;
    this.vx = 0;
    this.vy = 0;
    this.maxSpeed = this.speed;
    this.targetX = x;
    this.targetY = y;
    this.input = null;
    this.dirX = 0;
    this.dirY = 0;
    this.angle = 0;
    this.distance = 0;
    this.mouseActive = false;
    this.d_x = 0;
    this.d_y = 0;
    this.slippery = false;
    this.collisionCache = new Map();
    this.MAX_COLLISION_CACHE_SIZE = 1000;
    this.COLLISION_CACHE_EVICTION_COUNT = 100;
    this.stuckCounter = 0;
    this.lastPosition = { x: x, y: y }; // Stores position at the START of an update tick
    this.needsToExitTeleporterArea = null;
    this.justTeleportedFlag = false;
    this.TELEPORT_GRACE_DURATION = 100;
    this.lastTeleportTimestamp = 0;
    this.collider = new SAT.Circle(new SAT.Vector(x, y), this.radius);
    this.response = new SAT.Response();
  }

  setInput(input) {
    this.input = input;
    this.setupInputHandlers();
  }

  setupInputHandlers() {
    if (!this.input) return;

    this.input.on("movement", (data) => {
      this.dirX = data.dirX;
      this.dirY = data.dirY;
      this.angle = data.angle;
      this.distance = data.distance;
      this.mouseActive = data.mouseActive;
      this.d_x = data.d_x;
      this.d_y = data.d_y;
    });

    this.input.on("movementUpdate", (data) => {
      this.d_x = data.d_x;
      this.d_y = data.d_y;
      this.angle = data.angle;
      this.slippery = data.slippery;
    });

    this.input.on("mousemove", (x, y) => {
      this.targetX = x;
      this.targetY = y;
    });
  }

  getTilesInBoundingBox(aabbX, aabbY, aabbWidth, aabbHeight, map) {
    const tiles = [];
    const tileSize = map.tileSize;

    const leftTile = Math.floor(aabbX / tileSize);
    const rightTile = Math.floor((aabbX + aabbWidth) / tileSize);
    const topTile = Math.floor(aabbY / tileSize);
    const bottomTile = Math.floor((aabbY + aabbHeight) / tileSize);

    for (let ty = topTile; ty <= bottomTile; ty++) {
      for (let tx = leftTile; tx <= rightTile; tx++) {
        if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
          // Return tile world coordinates and dimensions
          tiles.push({
            tx,
            ty,
            x: tx * tileSize,
            y: ty * tileSize,
            width: tileSize,
            height: tileSize,
          });
        }
      }
    }
    return tiles;
  }

  update(dt, grids) {
    if (this.isDead) return;

    // Process all pending inputs in the buffer
    this.processInputs(dt, grids);
  }

  processInputs(dt, grids) {
    // Skip if no inputs to process
    if (this.inputBuffer.length === 0) return;
    
    // Get current time for movement calculations
    const currentTime = Date.now();
    const deltaTimeSeconds = (currentTime - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = currentTime;
    
    // Sort inputs by sequence number and process them in order
    this.inputBuffer.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    
    // Process each input
    while (this.inputBuffer.length > 0) {
      const input = this.inputBuffer.shift();
      
      // Update last processed input
      this.lastProcessedInput = Math.max(this.lastProcessedInput, input.sequenceNumber);
      
      // Skip invalid inputs
      if (!input || this.isDead) continue;
      
      let dx = 0;
      let dy = 0;
      
      // Calculate movement from input data
      if (input.mouseActive) {
        // Mouse-based movement
        dx = input.distance * Math.cos(input.angle) * this.speed;
        dy = input.distance * Math.sin(input.angle) * this.speed;
      } else {
        // Keyboard-based movement
        dx = input.dirX * this.speed;
        dy = input.dirY * this.speed;
        
        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
          const normalizer = 1 / Math.sqrt(2);
          dx *= normalizer;
          dy *= normalizer;
        }
      }
      
      // Apply movement if valid
      if (!isNaN(dx) && !isNaN(dy) && (dx !== 0 || dy !== 0)) {
        const newX = this.x + dx;
        const newY = this.y + dy;
        
        // Check for collisions
        if (!this.checkCollision(newX, this.y, grids)) {
          this.x = newX;
        }
        
        if (!this.checkCollision(this.x, newY, grids)) {
          this.y = newY;
        }
      }
    }
  }

  // Handle client input message
  handleInput(input) {
    // Add new input to buffer, maintaining size limit
    this.inputBuffer.push(input);
    
    // Trim buffer if it exceeds max size
    if (this.inputBuffer.length > this.inputBufferSize) {
      // Keep the most recent inputs
      this.inputBuffer = this.inputBuffer.slice(-this.inputBufferSize);
    }
  }

  checkCollision(newX, newY, grids) {
    // Get relevant collision grid
    const collisionGrid = grids?.collision;
    if (!collisionGrid) return false;

    // Get tile coordinates
    const tileSize = collisionGrid.tileSize;
    const tileX = Math.floor(newX / tileSize);
    const tileY = Math.floor(newY / tileSize);

    // Check player radius against tiles
    const radius = this.radius;
    
    // Check surrounding tiles
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const checkX = tileX + dx;
        const checkY = tileY + dy;
        
        // Skip out-of-bounds tiles
        if (checkX < 0 || checkY < 0 || 
            checkX >= collisionGrid.width || 
            checkY >= collisionGrid.height) {
          continue;
        }
        
        // Skip non-solid tiles
        if (!collisionGrid.isSolid(checkX, checkY)) {
          continue;
        }
        
        // Calculate closest point on the tile to the player center
        const tileLeft = checkX * tileSize;
        const tileTop = checkY * tileSize;
        const tileRight = tileLeft + tileSize;
        const tileBottom = tileTop + tileSize;
        
        // Find closest point on rectangle to circle center
        const closestX = Math.max(tileLeft, Math.min(newX, tileRight));
        const closestY = Math.max(tileTop, Math.min(newY, tileBottom));
        
        // Calculate distance from closest point to circle center
        const distX = newX - closestX;
        const distY = newY - closestY;
        const distanceSquared = distX * distX + distY * distY;
        
        // Collision if distance is less than radius
        if (distanceSquared < radius * radius) {
          return true;
        }
      }
    }
    
    return false;
  }

  takeDamage(amount, attacker) {
    if (this.isDead) return;
    
    // Handle damage and death logic...
  }

  die() {
    if (this.isDead) return;
    
    this.isDead = true;
    this.inputBuffer = []; // Clear input buffer on death
    
    // Start respawn timer
    this.respawnTimer = setTimeout(() => {
      this.respawn();
    }, config.RESPAWN_TIME);
  }

  respawn() {
    this.isDead = false;
    this.inputBuffer = []; // Clear input buffer on respawn
    
    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer);
      this.respawnTimer = null;
    }
  }

  teleport(x, y, mapId) {
    this.x = x;
    this.y = y;
    this.currentMapId = mapId;
    this.inputBuffer = []; // Clear input buffer on teleport
  }

  // Get serialized data for client updates
  getUpdateData() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      isDead: this.isDead,
      name: this.name,
      lastProcessedInput: this.lastProcessedInput // Add sequence number
    };
  }

  // Get serialized data for initial client state
  getFullData() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      radius: this.radius,
      color: this.color,
      isDead: this.isDead,
      name: this.name,
      lastProcessedInput: this.lastProcessedInput
    };
  }

  cleanup() {
    if (this.respawnTimer) {
      clearTimeout(this.respawnTimer);
      this.respawnTimer = null;
    }
  }

  // Check if player collides with a wall (useful for external checks)
  collidesWithWall(wall) {
    // Create SAT polygon for the wall
    const wallPolygon = new SAT.Box(
      new SAT.Vector(wall.x, wall.y),
      wall.width,
      wall.height,
    ).toPolygon();

    // Reset response object
    this.response.clear();

    // Test collision
    return SAT.testCirclePolygon(this.collider, wallPolygon, this.response);
  }

  setTarget(x, y) {
    this.targetX = x;
    this.targetY = y;
  }

  getPosition() {
    return { x: this.x, y: this.y };
  }

  hitByEnemy() {
    if (!this.isDead) {
      this.isDead = true;
      this.color = "#FF0000";
      this.maxSpeed = 0; // Also zero out velocities
      this.vx = 0;
      this.vy = 0;
    }
  }

  reviveByPlayer() {
    if (this.isDead) {
      this.isDead = false;
      this.color = this.originalColor;
      this.maxSpeed = this.originalMaxSpeed;
    }
  }

  reset() {
    this.isDead = false;
    this.color = this.originalColor || "#FFFFFF";
    this.maxSpeed = this.originalMaxSpeed;
    this.vx = 0;
    this.vy = 0;
    this.stuckCounter = 0;
    this.mouseActive = false;
    this.dirX = 0;
    this.dirY = 0;
    this.d_x = 0;
    this.d_y = 0;
    this.collisionCache.clear();
    // Reset new teleporter states
    this.needsToExitTeleporterArea = null;
    this.justTeleportedFlag = false;
    this.lastTeleportTimestamp = 0;
    // Update SAT collider position
    this.collider.pos.x = this.x;
    this.collider.pos.y = this.y;
  }

  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      radius: this.radius,
      color: this.color,
      isDead: this.isDead,
      currentMapId: this.currentMapId,
      name: this.name,
    };
  }
}

module.exports = Player;
