const { v4: uuidv4 } = require('uuid');
const Grid = require('./grid');

const ENEMY_TYPES = {
  1: {
    name: 'Basic',
    color: '#808080',
    outlineColor: '#000000'
  },
  2: {
    name: 'Sniper',
    color: '#8B0000',
    outlineColor: '#000000'
  }
};

let gridInstance = null;

function getGrid() {
  if (!gridInstance) {
    throw new Error("Grid accessed before initialization. Call Enemy.initGrid() or Enemy.initializeGridWithMap() first.");
  }
  return gridInstance;
}

class Bullet {
  constructor(x, y, targetX, targetY, radius, speed) {
    this.id = `bullet_${uuidv4()}`;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.radius = radius;
    this.speed = speed;
    this.color = '#FFFF00';
    this.outlineColor = '#FF8C00';

    const dx = targetX - x;
    const dy = targetY - y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    this.vx = (dx / length) * speed;
    this.vy = (dy / length) * speed;
    
    this.lastUpdateTime = Date.now();
    this.isActive = true;
  }
  
  update(map, grid) {
    if (!this.isActive) return;
    
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 16.67;
    this.lastUpdateTime = currentTime;
    
    this.prevX = this.x;
    this.prevY = this.y;
    
    const newX = this.x + this.vx * deltaTime;
    const newY = this.y + this.vy * deltaTime;
    
    const bulletObj = {
      id: this.id,
      x: newX,
      y: newY,
      radius: this.radius
    };

    if (grid.checkWallCollision(bulletObj) || 
        grid.checkSafeZoneCollision(bulletObj) ||
        grid.checkTeleporterCollision(bulletObj) ||
        newX - this.radius < 0 || 
        newX + this.radius > map.width * map.tileSize || 
        newY - this.radius < 0 || 
        newY + this.radius > map.height * map.tileSize) {
      this.isActive = false;
      return;
    }
    
    this.x = newX;
    this.y = newY;
    grid.update(this);
  }
  
  serialize() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      prevX: this.prevX,
      prevY: this.prevY,
      radius: this.radius,
      isActive: this.isActive
    };
  }
  
  addToGrid(grid) {
    grid.insert(this);
  }
  
  removeFromGrid(grid) {
    grid.remove(this.id);
  }
}

class Enemy {
  static counter = 0;
  
  constructor(x, y, radius, speed, type = 1) {
    this.id = `${type}_${Enemy.counter++}`;
    this.type = type;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.radius = radius;
    this.color = ENEMY_TYPES[type].color;
    this.outlineColor = ENEMY_TYPES[type].outlineColor;
    
    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: 1 },
      { x: 1, y: -1 },
      { x: -1, y: -1 }
    ];
    
    const randomDir = directions[Math.floor(Math.random() * directions.length)];
    
    const offsetX = (Math.random() * 0.4) - 0.2;
    const offsetY = (Math.random() * 0.4) - 0.2;
    
    const dirX = randomDir.x + offsetX;
    const dirY = randomDir.y + offsetY;
    
    const length = Math.sqrt(dirX * dirX + dirY * dirY);
    
    this.vx = (dirX / length) * speed;
    this.vy = (dirY / length) * speed;
    
    this.speed = speed;
    this.lastUpdateTime = Date.now();
  }
  
  update(map, grid) {
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 16.67;
    this.lastUpdateTime = currentTime;
    
    this.prevX = this.x;
    this.prevY = this.y;
    
    let positionChanged = false;

    const newX = this.x + this.vx * deltaTime;
    const newY = this.y + this.vy * deltaTime;
    
    const tempX = {
      id: this.id,
      x: newX,
      y: this.y,
      radius: this.radius
    };

    if (grid.checkWallCollision(tempX) || grid.checkSafeZoneCollision(tempX) || grid.checkTeleporterCollision(tempX)) {
      this.vx = -this.vx;

      this.vx += (Math.random() - 0.5) * 0.2;
      this.vy += (Math.random() - 0.5) * 0.2;

      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      this.vx = (this.vx / speed) * this.speed;
      this.vy = (this.vy / speed) * this.speed;
    } else {
      this.x = newX;
      positionChanged = true;
    }

    const tempY = {
      id: this.id,
      x: this.x,
      y: newY,
      radius: this.radius
    };
    
    if (grid.checkWallCollision(tempY) || grid.checkSafeZoneCollision(tempY) || grid.checkTeleporterCollision(tempY)) {
      this.vy = -this.vy;

      this.vx += (Math.random() - 0.5) * 0.2;
      this.vy += (Math.random() - 0.5) * 0.2;

      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      this.vx = (this.vx / speed) * this.speed;
      this.vy = (this.vy / speed) * this.speed;
    } else {
      this.y = newY;
      positionChanged = true;
    }

    const boundaryCheck = {
      id: this.id,
      x: this.x,
      y: this.y,
      radius: this.radius
    };
    
    if (grid.checkWallCollision(boundaryCheck) || 
        grid.checkSafeZoneCollision(boundaryCheck) ||
        grid.checkTeleporterCollision(boundaryCheck) ||
        this.x - this.radius < 0 || 
        this.x + this.radius > map.width * map.tileSize || 
        this.y - this.radius < 0 || 
        this.y + this.radius > map.height * map.tileSize) {


      this.x = this.prevX;
      this.y = this.prevY;
      positionChanged = false;

      this.vx = -this.vx;
      this.vy = -this.vy;

      this.vx += (Math.random() - 0.5) * 0.5;
      this.vy += (Math.random() - 0.5) * 0.5;

      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      this.vx = (this.vx / speed) * this.speed;
      this.vy = (this.vy / speed) * this.speed;
    }

    if (positionChanged) {
      grid.update(this);
    }
  }
  
  checkEnemyCollisions(grid) {
    const nearbyEnemyIds = grid.getNearbyEntities(this);
    const collisions = [];
    
    for (const id of nearbyEnemyIds) {
      const otherEnemy = grid.entities.get(id)?.entity;
      if (!otherEnemy) continue;
      
      const dx = this.x - otherEnemy.x;
      const dy = this.y - otherEnemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < this.radius + otherEnemy.radius) {
        collisions.push(otherEnemy);
      }
    }
    
    return collisions;
  }
  
  serialize() {
    return {
      id: this.id,
      type: this.type,
      x: this.x,
      y: this.y,
      prevX: this.prevX,
      prevY: this.prevY,
      radius: this.radius
    };
  }
  
  addToGrid(grid) {
    grid.insert(this);
  }
  
  removeFromGrid(grid) {
    grid.remove(this.id);
  }
}

class Sniper extends Enemy {
  constructor(x, y, radius, speed, detectionRange = 500, shootingRange = 400, maxShootCooldown = 100, bulletRadius = 5, bulletSpeed = 5) {
    super(x, y, radius, speed, 2);
    this.detectionRange = detectionRange;
    this.shootingRange = shootingRange;
    this.shootCooldown = 0;
    this.maxShootCooldown = maxShootCooldown;
    this.bulletRadius = bulletRadius;
    this.bulletSpeed = bulletSpeed;
    this.lastTargetX = null;
    this.lastTargetY = null;
  }
  
  update(map, grid, game) {
    super.update(map, grid);
    
    if (this.shootCooldown > 0) {
      this.shootCooldown--;
    }

    if (game && this.shootCooldown === 0) {
      const players = game.players;
      let closestPlayer = null;
      let closestDistance = Infinity;

      for (const [playerId, player] of players) {
        if (player.isDead || player.currentMapId !== game.currentMapId) continue;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < this.detectionRange && distance < closestDistance) {
          closestDistance = distance;
          closestPlayer = player;
          this.lastTargetX = player.x;
          this.lastTargetY = player.y;
        }
      }

      if (closestPlayer && this.lastTargetX !== null && this.lastTargetY !== null && closestDistance <= this.shootingRange) {
        const bullet = new Bullet(
          this.x, 
          this.y, 
          this.lastTargetX, 
          this.lastTargetY, 
          this.bulletRadius, 
          this.bulletSpeed
        );

        if (game.mapBullets && game.currentMapId) {
          const bulletsOnMap = game.mapBullets.get(game.currentMapId) || new Map();
          bulletsOnMap.set(bullet.id, bullet);
          game.mapBullets.set(game.currentMapId, bulletsOnMap);

          bullet.addToGrid(grid);
        }
        
        this.shootCooldown = this.maxShootCooldown;
      }
    }
  }
  
  serialize() {
    const baseData = super.serialize();
    return {
      ...baseData,
      detectionRange: this.detectionRange,
      shootingRange: this.shootingRange
    };
  }
}

Enemy.initializeGridWithMap = function(map) {
  const effectiveCellSize = map.tileSize || 64;
  const grid = new Grid(map.width * map.tileSize, map.height * map.tileSize, effectiveCellSize);
  grid.initializeMapData(map);
  return grid;
};

Enemy.bulkAddToGrid = function(enemies, grid) {
  if (!enemies || enemies.length === 0) return;
  
  grid.bulkInsert(enemies);
  
  return grid;
};

module.exports = { 
  Enemy, 
  Sniper,
  Bullet,
  ENEMY_TYPES, 
  initializeGridWithMap: Enemy.initializeGridWithMap,
  bulkAddToGrid: Enemy.bulkAddToGrid
}; 