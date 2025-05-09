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
    this.cacheTimeout = 100;
    this.lastCacheCleanup = Date.now();
    this.stuckCounter = 0;
    this.lastPosition = { x, y };
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
    this.collisionCache.clear();
    
    const grid = gameInstance.mapGrids.get(this.currentMapId);
    if (!grid) return;
    if (this.teleporterCooldown > 0) {
      this.teleporterCooldown--;
    }
    const wasOnTeleporter = this.isOnTeleporter;
    const wasFullyOutsideTeleporter = this.wasFullyOutsideTeleporter;
    
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 16.67;
    this.lastUpdateTime = currentTime;

    const movedDistance = Math.sqrt(
      Math.pow(this.x - this.lastPosition.x, 2) + 
      Math.pow(this.y - this.lastPosition.y, 2)
    );
    
    if (movedDistance < 0.1 && (Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1)) {
      this.stuckCounter++;
    } else {
      this.stuckCounter = 0;
    }

    this.lastPosition = { x: this.x, y: this.y };

    if (currentTime - this.lastCacheCleanup > 500) {
      this.collisionCache.clear();
      this.lastCacheCleanup = currentTime;
    }

    if (this.isDead) {
      this.vx = 0;
      this.vy = 0;
      return;
    }

    if (this.input) {
      this.vx = this.d_x * this.maxSpeed;
      this.vy = this.d_y * this.maxSpeed;
    } else {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > 1) {
        const speedFactor = Math.min(distance / 150, 1);
        
        const dirX = dx / distance;
        const dirY = dy / distance;
        this.vx = dirX * this.maxSpeed * speedFactor;
        this.vy = dirY * this.maxSpeed * speedFactor;
      } else {
        this.x = this.targetX;
        this.y = this.targetY;
        this.vx = 0;
        this.vy = 0;
        return;
      }
    }
    
    if (this.stuckCounter > 3) {
      const pushDistance = 0.5;
      const pushDirections = [
        { x: pushDistance, y: 0 },
        { x: -pushDistance, y: 0 },
        { x: 0, y: pushDistance },
        { x: 0, y: -pushDistance }
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
    
    const newX = this.x + this.vx;
    const newY = this.y + this.vy;
    
    const canMoveX = !this.collidesWithWall(newX, this.y, map);
    const canMoveY = !this.collidesWithWall(this.x, newY, map);

    if (canMoveX) this.x = newX;
    if (canMoveY) this.y = newY;

    if (!canMoveX && !canMoveY) {
      this.handleSliding(map);
    }

    if (this.input && (!canMoveX || !canMoveY)) {
      this.input.setSlippery(false);
    }
    this.isOnTeleporter = grid.checkTeleporterCollision(this);
    this.isFullyInsideTeleporter = this.isOnTeleporter && grid.isFullyInsideTeleporter(this);
    this.wasFullyOutsideTeleporter = grid.isFullyOutsideTeleporter(this);
    if (this.isOnTeleporter || wasOnTeleporter) {
      // console.log('gg');
    }
    if (this.wasFullyOutsideTeleporter) {
      if (!this.canTeleport) {
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
        }
      }
    }
  }
  
  handleSliding(map) {
    for (let i = 0.9; i >= 0.1; i -= 0.1) {
      const slideX = this.x + this.vx * i;
      if (!this.collidesWithWall(slideX, this.y, map)) {
        this.x = slideX;
        break;
      }
    }
    
    for (let i = 0.9; i >= 0.1; i -= 0.1) {
      const slideY = this.y + this.vy * i;
      if (!this.collidesWithWall(this.x, slideY, map)) {
        this.y = slideY;
        break;
      }
    }
    
    if (Math.abs(this.vx) > 0.1 && Math.abs(this.vy) > 0.1) {
      for (let i = 0.9; i >= 0.1; i -= 0.1) {
        const slideX = this.x + this.vx * i;
        const slideY = this.y + this.vy * i;
        if (!this.collidesWithWall(slideX, slideY, map)) {
          this.x = slideX;
          this.y = slideY;
          break;
        }
      }
    }
  }
  
  collidesWithWall(x, y, map) {
    const cacheKey = `${x.toFixed(1)},${y.toFixed(1)}`;
    if (this.collisionCache.has(cacheKey)) {
      return this.collisionCache.get(cacheKey);
    }
    
    const result = this.spatialCheckCollision(x, y, map);
    
    this.collisionCache.set(cacheKey, result);
    
    return result;
  }
  
  spatialCheckCollision(x, y, map) {
    const tileSize = map.tileSize;
    
    const playerLeft = x - this.radius;
    const playerRight = x + this.radius;
    const playerTop = y - this.radius;
    const playerBottom = y + this.radius;
    
    const leftTile = Math.floor(playerLeft / tileSize);
    const rightTile = Math.floor(playerRight / tileSize);
    const topTile = Math.floor(playerTop / tileSize);
    const bottomTile = Math.floor(playerBottom / tileSize);
    
    return this.checkTilesInRange(leftTile, rightTile, topTile, bottomTile, map);
  }
  
  checkTilesInRange(left, right, top, bottom, map) {
    if (right < 0 || left >= map.width || bottom < 0 || top >= map.height) {
      return false;
    }
    
    for (let tx = Math.max(0, left); tx <= Math.min(right, map.width - 1); tx++) {
      for (let ty = Math.max(0, top); ty <= Math.min(bottom, map.height - 1); ty++) {
        if (map.isWall(tx, ty)) {
          return true;
        }
      }
    }
    
    if (left < 0 || right >= map.width || top < 0 || bottom >= map.height) {
      return true;
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