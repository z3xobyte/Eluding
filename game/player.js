const { v4: uuidv4 } = require('uuid');

class Player {
  constructor(x, y, radius, color) {
    this.id = uuidv4();
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.originalColor = color;
    this.vx = 0;
    this.vy = 0;
    this.maxSpeed = 10;
    this.originalMaxSpeed = this.maxSpeed;
    this.targetX = x;
    this.targetY = y;
    this.lastUpdateTime = Date.now();
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
    this.lastPosition = { x: x, y: y };
    this.isDead = false;
    this.currentMapId = null;
    this.lastTeleporterIdUsed = null;
    this.isOnTeleporter = false;
    this.isFullyInsideTeleporter = false;
    this.lastTeleporterCodeUsed = null;
    this.teleporterCooldown = 0;
    this.canTeleport = true;
    this.wasFullyOutsideTeleporter = true;
  }

  setInput(input) {
    this.input = input;
    this.setupInputHandlers();
  }

  setupInputHandlers() {
    if (!this.input) return;
    
    this.input.on('movement', (data) => {
      this.dirX = data.dirX;
      this.dirY = data.dirY;
      this.angle = data.angle;
      this.distance = data.distance;
      this.mouseActive = data.mouseActive;
      this.d_x = data.d_x;
      this.d_y = data.d_y;
    });

    this.input.on('movementUpdate', (data) => {
      this.d_x = data.d_x;
      this.d_y = data.d_y;
      this.angle = data.angle;
      this.slippery = data.slippery;
    });

    this.input.on('mousemove', (x, y) => {
      this.targetX = x;
      this.targetY = y;
    });
  }

  update(map, gameInstance) {
    const grid = gameInstance.mapGrids.get(this.currentMapId);
    if (!grid) return;

    if (this.teleporterCooldown > 0) {
      this.teleporterCooldown--;
    }
    const wasOnTeleporter = this.isOnTeleporter;
    
    const currentTime = Date.now();
    const actualDeltaTimeMs = currentTime - this.lastUpdateTime;
    const deltaTimeFactor = actualDeltaTimeMs / 16.67; 
    this.lastUpdateTime = currentTime;

    const dxMoved = this.x - this.lastPosition.x;
    const dyMoved = this.y - this.lastPosition.y;
    const movedDistanceSq = dxMoved * dxMoved + dyMoved * dyMoved;
    
    if (movedDistanceSq < (0.1 * 0.1) && (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1)) {
      this.stuckCounter++;
    } else {
      this.stuckCounter = 0;
    }

    this.lastPosition.x = this.x;
    this.lastPosition.y = this.y;

    if (this.isDead) {
      this.vx = 0;
      this.vy = 0;
      return;
    }

    let currentVx = 0;
    let currentVy = 0;

    if (this.input) {
      currentVx = this.d_x * this.maxSpeed;
      currentVy = this.d_y * this.maxSpeed;
    } else {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > 1) {
        const distance = Math.sqrt(distanceSq);
        const speedFactor = Math.min(distance / 150, 1);
        
        const dirX = dx / distance;
        const dirY = dy / distance;
        currentVx = dirX * this.maxSpeed * speedFactor;
        currentVy = dirY * this.maxSpeed * speedFactor;
      } else {
        this.x = this.targetX;
        this.y = this.targetY;
        this.vx = 0;
        this.vy = 0;
        return;
      }
    }
    
    this.vx = currentVx;
    this.vy = currentVy;
    
    if (this.stuckCounter > 3) {
      const pushDistance = 0.5;
      const pushDirections = [
        { x: pushDistance, y: 0 }, { x: -pushDistance, y: 0 },
        { x: 0, y: pushDistance }, { x: 0, y: -pushDistance }
      ];
      
      for (const dir of pushDirections) {
        if (!this.collidesWithWall(this.x + dir.x, this.y + dir.y, map)) {
          this.x += dir.x;
          this.y += dir.y;
          this.stuckCounter = 0;
          break;
        }
      }
    }
    
    const intendedNewX = this.x + this.vx * deltaTimeFactor;
    const intendedNewY = this.y + this.vy * deltaTimeFactor;
    
    const canMoveX = !this.collidesWithWall(intendedNewX, this.y, map);
    const canMoveY = !this.collidesWithWall(this.x, intendedNewY, map);

    if (canMoveX) this.x = intendedNewX;
    if (canMoveY) this.y = intendedNewY;

    if (!canMoveX && !canMoveY && (this.vx !== 0 || this.vy !== 0)) {
       this.handleSliding(map, deltaTimeFactor);
    }


    if (this.input && (!canMoveX || !canMoveY)) {
      this.input.setSlippery(false);
    }

    this.isOnTeleporter = grid.checkTeleporterCollision(this);
    this.isFullyInsideTeleporter = this.isOnTeleporter && grid.isFullyInsideTeleporter(this);
    
    if (this.wasFullyOutsideTeleporter && !this.isFullyInsideTeleporter && this.isOnTeleporter) {
        
    } else if (!this.isOnTeleporter) {
        this.wasFullyOutsideTeleporter = true;
    }


    if (this.wasFullyOutsideTeleporter) {
      if (!this.canTeleport && !this.isOnTeleporter) {
        this.canTeleport = true;
      }
    }

    if (this.isFullyInsideTeleporter && this.teleporterCooldown === 0 && this.canTeleport) {
      const teleporter = grid.getTeleporterAt(this.x, this.y);
      
      if (teleporter && teleporter.code) {
        if (gameInstance && typeof gameInstance.handlePlayerTeleport === 'function') {
          gameInstance.handlePlayerTeleport(this.id, teleporter);
          this.lastTeleporterCodeUsed = teleporter.code;
          this.teleporterCooldown = 60; 
          this.canTeleport = false;
          this.wasFullyOutsideTeleporter = false; 
        }
      }
    }
  }
  
  handleSliding(map, deltaTimeFactor) {
    let currentSlideX = this.x;
    let currentSlideY = this.y;

    for (let i = 0.9; i >= 0.1; i -= 0.1) {
      const slideXAttempt = this.x + this.vx * deltaTimeFactor * i;
      if (!this.collidesWithWall(slideXAttempt, this.y, map)) {
        currentSlideX = slideXAttempt;
        break;
      }
    }
    this.x = currentSlideX; 
    
    for (let i = 0.9; i >= 0.1; i -= 0.1) {
      const slideYAttempt = this.y + this.vy * deltaTimeFactor * i;
      if (!this.collidesWithWall(this.x, slideYAttempt, map)) {
        currentSlideY = slideYAttempt;
        break;
      }
    }
    this.y = currentSlideY;

    if (this.x === this.lastPosition.x && this.y === this.lastPosition.y) {
       if (Math.abs(this.vx) > 0.01 && Math.abs(this.vy) > 0.01) {
            for (let i = 0.9; i >= 0.1; i -= 0.1) {
                const slideX = this.x + this.vx * deltaTimeFactor * i;
                const slideY = this.y + this.vy * deltaTimeFactor * i;
                if (!this.collidesWithWall(slideX, slideY, map)) {
                    this.x = slideX;
                    this.y = slideY;
                    break;
                }
            }
        }
    }
  }
  
  collidesWithWall(x, y, map) {
    const cacheKey = `${Math.round(x * 100)}:${Math.round(y * 100)}`;
    if (this.collisionCache.has(cacheKey)) {
      return this.collisionCache.get(cacheKey);
    }
    
    const result = this.spatialCheckCollision(x, y, map);
    
    this.collisionCache.set(cacheKey, result);
    
    if (this.collisionCache.size > this.MAX_COLLISION_CACHE_SIZE) {
      const keys = this.collisionCache.keys();
      for (let i = 0; i < this.COLLISION_CACHE_EVICTION_COUNT; i++) {
        const keyToDelete = keys.next().value;
        if (keyToDelete) {
            this.collisionCache.delete(keyToDelete);
        } else {
            break; 
        }
      }
    }
    
    return result;
  }
  
  spatialCheckCollision(x, y, map) {
    const tileSize = map.tileSize;
    
    const playerLeft = x - this.radius;
    const playerRight = x + this.radius;
    const playerTop = y - this.radius;
    const playerBottom = y + this.radius;
    
    if (playerRight <= 0 || playerLeft >= map.width * tileSize || 
        playerBottom <= 0 || playerTop >= map.height * tileSize) {
      return false; 
    }
    
    const leftTile = Math.floor(playerLeft / tileSize);
    const rightTile = Math.floor(playerRight / tileSize);
    const topTile = Math.floor(playerTop / tileSize);
    const bottomTile = Math.floor(playerBottom / tileSize);
    
    const clampedLeftTile = Math.max(0, leftTile);
    const clampedRightTile = Math.min(rightTile, map.width - 1);
    const clampedTopTile = Math.max(0, topTile);
    const clampedBottomTile = Math.min(bottomTile, map.height - 1);

    for (let tx = clampedLeftTile; tx <= clampedRightTile; tx++) {
      for (let ty = clampedTopTile; ty <= clampedBottomTile; ty++) {
        if (map.isWall(tx, ty)) {
          return true;
        }
      }
    }
    
    return false;
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
      this.color = '#FF0000';
      this.maxSpeed = 0;
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
    this.color = this.originalColor;
    this.maxSpeed = this.originalMaxSpeed;
    this.vx = 0;
    this.vy = 0;
    this.stuckCounter = 0;
    this.mouseActive = false;
    this.targetX = this.x;
    this.targetY = this.y;
    this.dirX = 0;
    this.dirY = 0;
    this.d_x = 0;
    this.d_y = 0;
    this.lastTeleporterCodeUsed = null;
    this.isOnTeleporter = false;
    this.isFullyInsideTeleporter = false;
    this.teleporterCooldown = 0;
    this.collisionCache.clear();
    this.canTeleport = true;
    this.wasFullyOutsideTeleporter = true;
  }
  
  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      radius: this.radius,
      color: this.color,
      isDead: this.isDead,
      currentMapId: this.currentMapId
    };
  }
}

module.exports = { Player };