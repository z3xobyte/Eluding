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
  },
  3: {
    name: 'Dasher',
    color: '#003c66',
    outlineColor: '#001830'
  },
  4: {
    name: 'Homing',
    color: '#7F00FF',
    outlineColor: '#5c4200'
  },
  5: {
    name: 'VoidCrawler',
    color: '#1c0a2d',
    outlineColor: '#0d0517'
  },
  6: {
    name: 'Wall',
    color: '#222222',
    outlineColor: '#111111'
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

class Dasher extends Enemy {
  constructor(x, y, radius, speed, timeToPrepare = 750, timeToDash = 3000, timeBetweenDashes = 750) {
    super(x, y, radius, speed, 3);
    this.speed = speed;
    this.time_to_prepare = 750;
    this.time_to_dash = 3000;
    this.time_between_dashes = 750;
    this.normal_speed = speed;
    this.base_speed = this.normal_speed / 5;
    this.prepare_speed = this.normal_speed / 5;
    this.dash_speed = this.normal_speed;
    this.time_dashing = 0;
    this.time_preparing = 0;
    this.time_since_last_dash = 0;
    this.lastUpdateTimeMs = Date.now();
    
    // Store the original direction
    this.originalVx = this.vx;
    this.originalVy = this.vy;
    this.originalSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    
    // Track if we've hit a wall in the last update
    this.hitWall = false;
  }
  
  compute_speed() {
    let newSpeed = 0;
    
    if (this.time_since_last_dash < this.time_between_dashes && 
        this.time_dashing == 0 && 
        this.time_preparing == 0) {
      // Waiting period - no movement
      newSpeed = 0;
    } else if (this.time_dashing == 0) {
      // Preparing to dash
      newSpeed = this.prepare_speed;
    } else {
      // During dash
      newSpeed = this.base_speed;
    }
    
    // Only update velocity if speed changed
    if (newSpeed !== this.speed) {
      this.speed = newSpeed;
      this.updateVelocity();
    }
  }
  
  updateVelocity() {
    if (this.speed === 0) {
      this.vx = 0;
      this.vy = 0;
      return;
    }
    
    // Maintain the original direction but adjust speed
    if (this.originalSpeed > 0) {
      const dirX = this.originalVx / this.originalSpeed;
      const dirY = this.originalVy / this.originalSpeed;
      
      this.vx = dirX * this.speed;
      this.vy = dirY * this.speed;
    } else {
      // If no original direction, pick a random one
      const angle = Math.random() * Math.PI * 2;
      this.vx = Math.cos(angle) * this.speed;
      this.vy = Math.sin(angle) * this.speed;
      
      // Store as original
      this.originalVx = this.vx;
      this.originalVy = this.vy;
      this.originalSpeed = this.speed;
    }
  }
  
  // Override the parent class update method to preserve our direction control
  update(map, grid, game) {
    // Calculate time elapsed since last update in milliseconds
    const currentTimeMs = Date.now();
    const deltaTimeMs = currentTimeMs - this.lastUpdateTimeMs;
    this.lastUpdateTimeMs = currentTimeMs;
    
    // Save current position to detect collisions
    const prevX = this.x;
    const prevY = this.y;
    const prevVx = this.vx;
    const prevVy = this.vy;
    
    // Apply the behavior logic matching the reference implementation
    this.behavior(deltaTimeMs);
    
    // Call the parent update without using super to avoid random direction changes
    // This is modified version of Enemy.prototype.update that preserves our direction
    
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
      this.hitWall = true;
      
      positionChanged = false;
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
      this.hitWall = true;
      
      positionChanged = false;
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
      this.hitWall = true;
    }

    if (positionChanged) {
      grid.update(this);
    }
    
    // If we hit a wall, update our direction tracking
    if (this.hitWall) {
      this.originalVx = this.vx;
      this.originalVy = this.vy;
      this.originalSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
      this.hitWall = false;
    }
  }
  
  behavior(time) {
    if (this.time_preparing == 0) {
      if (this.time_dashing == 0) {
        if (this.time_since_last_dash < this.time_between_dashes) {
          this.time_since_last_dash += time;
        } else {
          this.time_since_last_dash = 0;
          this.time_preparing += time;
          this.base_speed = this.prepare_speed;
        }
      } else {
        this.time_dashing += time;
        if (this.time_dashing > this.time_to_dash) {
          this.time_dashing = 0;
          this.base_speed = this.normal_speed;
        } else {
          this.base_speed = this.dash_speed * (1 - (this.time_dashing / this.time_to_dash));
        }
      }
    } else {
      this.time_preparing += time;
      if (this.time_preparing > this.time_to_prepare) {
        this.time_preparing = 0;
        this.time_dashing += time;
        this.base_speed = this.dash_speed;
      } else {
        this.base_speed = this.prepare_speed * (1 - (this.time_preparing / this.time_to_prepare));
      }
    }
    this.compute_speed();
  }
  
  serialize() {
    const baseData = super.serialize();
    return {
      ...baseData,
      time_dashing: this.time_dashing,
      time_preparing: this.time_preparing,
      time_since_last_dash: this.time_since_last_dash
    };
  }
}

class Homing extends Enemy {
  constructor(x, y, radius, speed, increment = 0.05, homeRange = 200) {
    super(x, y, radius, speed, 4);
    this.increment = increment;
    this.homeRange = homeRange;
    this.angle = Math.atan2(this.vy, this.vx);
    this.targetAngle = this.angle;
    this.lastUpdateTimeMs = Date.now();
  }
  
  update(map, grid, game) {
    // Calculate time elapsed since last update in milliseconds
    const currentTimeMs = Date.now();
    const deltaTimeMs = currentTimeMs - this.lastUpdateTimeMs;
    this.lastUpdateTimeMs = currentTimeMs;
    
    // Apply behavior before parent update (set new direction)
    this.behavior(deltaTimeMs, game);
    
    // Do regular collision handling from parent class
    super.update(map, grid);
  }
  
  behavior(time, game) {
    // Always update current angle from velocity
    this.angle = Math.atan2(this.vy, this.vx);
    
    // Check for closest player
    const closestPlayer = this.findClosestPlayer(game);
    
    // If player found in range, update target angle
    if (closestPlayer) {
      const dX = closestPlayer.x - this.x;
      const dY = closestPlayer.y - this.y;
      this.targetAngle = Math.atan2(dY, dX);
    }
    
    // Always adjust angle toward target (even if no player, will maintain current direction)
    const angleDiff = Math.atan2(Math.sin(this.targetAngle - this.angle), Math.cos(this.targetAngle - this.angle));
    const angleIncrement = this.increment * (time / 30);
    
    if (Math.abs(angleDiff) >= this.increment) {
      this.angle += Math.sign(angleDiff) * angleIncrement;
    }
    
    // Convert angle to velocity
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
  }
  
  findClosestPlayer(game) {
    if (!game || !game.players) return null;
    
    let closestDist = this.homeRange;
    let closestPlayer = null;
    
    for (const [playerId, player] of game.players) {
      if (player.isDead || player.currentMapId !== game.currentMapId) continue;
      
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < closestDist) {
        closestDist = dist;
        closestPlayer = player;
      }
    }
    
    return closestPlayer;
  }
  
  serialize() {
    const baseData = super.serialize();
    return {
      ...baseData,
      homeRange: this.homeRange,
      angle: this.angle,
      targetAngle: this.targetAngle
    };
  }
}

class VoidCrawler extends Enemy {
  constructor(x, y, radius, speed, increment = 0.05, homeRange = 200) {
    super(x, y, radius, speed, 5);
    this.increment = increment;
    this.homeRange = homeRange;
    
    this.normal_speed = speed;
    this.base_speed = this.normal_speed;
    this.prepare_speed = this.normal_speed / 4;
    this.lurch_speed = this.normal_speed;
    
    this.time_preparing = 0;
    this.time_lurching = 0;
    this.time_since_last_lurch = 0;
    
    this.time_to_lurch = 300;
    this.time_between_lurches = 0;
    this.time_to_prepare = 300;
    
    this.angle = Math.atan2(this.vy, this.vx);
    this.targetAngle = this.angle;
    this.lastUpdateTimeMs = Date.now();
  }
  
  update(map, grid, game) {
    const currentTimeMs = Date.now();
    const deltaTimeMs = currentTimeMs - this.lastUpdateTimeMs;
    this.lastUpdateTimeMs = currentTimeMs;
    this.behavior(deltaTimeMs, game);
    super.update(map, grid);
  }
  
  behavior(time, game) {
    if (this.time_preparing == 0) {
      if (this.time_lurching == 0) {
        if (this.time_since_last_lurch < this.time_between_lurches) {
          this.time_since_last_lurch += time;
        } else {
          this.time_since_last_lurch = 0;
          this.time_preparing += time;
          this.base_speed = this.prepare_speed;
        }
      } else {
        this.time_lurching += time;
        if (this.time_lurching >= this.time_to_lurch) {
          this.time_lurching = 0;
          this.base_speed = this.normal_speed;
        } else {
          this.base_speed = this.lurch_speed * (
            1 - Math.pow(this.time_lurching / this.time_to_lurch, 5)
          );
          this.compute_speed();
        }
      }
    } else {
      this.time_preparing += time;
      if (this.time_preparing >= this.time_to_prepare) {
        this.time_preparing = 0;
        this.time_lurching += time;
        this.base_speed = this.lurch_speed;
      } else {
        this.base_speed = this.prepare_speed * (
          1 - (this.time_preparing / this.time_to_prepare)
        );
        this.compute_speed();
      }
    }
    this.angle = Math.atan2(this.vy, this.vx);
    const closestPlayer = this.findClosestPlayer(game);
    if (closestPlayer) {
      const dX = closestPlayer.x - this.x;
      const dY = closestPlayer.y - this.y;
      this.targetAngle = Math.atan2(dY, dX);
    }

    const angleDiff = Math.atan2(Math.sin(this.targetAngle - this.angle), Math.cos(this.targetAngle - this.angle));
    const angleIncrement = this.increment * (time / 30);
    
    if (Math.abs(angleDiff) >= this.increment) {
      this.angle += Math.sign(angleDiff) * angleIncrement;
    }
    
    this.compute_speed();
  }
  
  compute_speed() {
    this.speed = this.base_speed;
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
  }
  
  findClosestPlayer(game) {
    if (!game || !game.players) return null;
    
    let closestDist = this.homeRange;
    let closestPlayer = null;
    
    for (const [playerId, player] of game.players) {
      if (player.isDead || player.currentMapId !== game.currentMapId) continue;
      
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < closestDist) {
        closestDist = dist;
        closestPlayer = player;
      }
    }
    
    return closestPlayer;
  }
  
  serialize() {
    const baseData = super.serialize();
    return {
      ...baseData,
      time_preparing: this.time_preparing,
      time_lurching: this.time_lurching,
      time_since_last_lurch: this.time_since_last_lurch,
      angle: this.angle,
      targetAngle: this.targetAngle
    };
  }
}

class Wall extends Enemy {
  constructor(x, y, radius, speed, boundaryX, boundaryY, boundaryWidth, boundaryHeight, wallIndex, count, moveClockwise = true, initialSide = 0, spacing = null) {
    super(x, y, radius, speed, 6);
    this.speed = speed;
    
    this.boundary = {
      x: boundaryX,
      y: boundaryY,
      w: boundaryWidth,
      h: boundaryHeight
    };
    
    this.moveClockwise = !moveClockwise;
    this.wallIndex = wallIndex;
    this.direction = initialSide;
    
    // Calculate initial position based on wallIndex and count
    const perimeter = 2 * (this.boundary.w + this.boundary.h);
    
    // If spacing is provided, use it for precise distribution
    let distance;
    if (spacing) {
      // Calculate position based on exact spacing
      distance = wallIndex * spacing;
    } else {
      // Legacy calculation for backward compatibility
      distance = wallIndex * perimeter / count;
    }
    
    this.initialSide = initialSide;
    this.positionAlong(distance, radius);
    this.applySpeed();
  }
  
  top() {
    return this.boundary.y;
  }
  
  bottom() {
    return this.boundary.y + this.boundary.h;
  }
  
  right() {
    return this.boundary.x + this.boundary.w;
  }
  
  left() {
    return this.boundary.x;
  }
  
  rotate(direction, moveClockwise) {
    switch (direction) {
      case 0: // up
        return (moveClockwise) ? 3 : 1;
      case 2: // down
        return (moveClockwise) ? 1 : 3;
      case 1: // right
        return (moveClockwise) ? 0 : 2;
      case 3: // left
        return (moveClockwise) ? 2 : 0;
    }
  }
  
  getVector() {
    switch (this.direction) {
      case 0: // up
        this.vx = 0;
        this.vy = -this.speed;
        break;
      case 2: // down
        this.vx = 0;
        this.vy = this.speed;
        break;
      case 1: // right
        this.vx = this.speed;
        this.vy = 0;
        break;
      case 3: // left
        this.vx = -this.speed;
        this.vy = 0;
        break;
    }
  }
  
  applySpeed() {
    this.getVector();
  }
  
  positionAlong(distance, radius) {
    // Set initial position based on initialSide, positioning enemy center at radius distance from boundary
    if (this.initialSide === 0) {
      this.x = (this.boundary.w / 2) + this.left();
      this.y = this.top() + radius;
    } else if (this.initialSide === 1) {
      this.x = this.right() - radius;
      this.y = (this.boundary.h / 2) + this.top();
    } else if (this.initialSide === 2) {
      this.x = (this.boundary.w / 2) + this.left();
      this.y = this.bottom() - radius;
    } else if (this.initialSide === 3) {
      this.x = this.left() + radius;
      this.y = (this.boundary.h / 2) + this.top();
    }
    
    this.direction = this.rotate(this.initialSide, this.moveClockwise);
    
    // Move along by distance
    let antiCrash = 0;
    while (distance > 0) {
      if (antiCrash > 1000) {
        console.error("Anti-crash triggered in Wall enemy positioning");
        break;
      }
      antiCrash++;
      
      if (this.direction === 0) { // up
        this.y -= distance;
        if (this.y < this.top() + radius) {
          distance = (this.top() + radius) - this.y;
          this.y = this.top() + radius;
          this.direction = this.rotate(this.direction, this.moveClockwise);
        } else {
          break;
        }
      } else if (this.direction === 1) { // right
        this.x += distance;
        if (this.x > this.right() - radius) {
          distance = this.x - (this.right() - radius);
          this.x = this.right() - radius;
          this.direction = this.rotate(this.direction, this.moveClockwise);
        } else {
          break;
        }
      } else if (this.direction === 2) { // down
        this.y += distance;
        if (this.y > this.bottom() - radius) {
          distance = this.y - (this.bottom() - radius);
          this.y = this.bottom() - radius;
          this.direction = this.rotate(this.direction, this.moveClockwise);
        } else {
          break;
        }
      } else if (this.direction === 3) { // left
        this.x -= distance;
        if (this.x < this.left() + radius) {
          distance = (this.left() + radius) - this.x;
          this.x = this.left() + radius;
          this.direction = this.rotate(this.direction, this.moveClockwise);
        } else {
          break;
        }
      }
    }
  }
  
  update(map, grid, game) {
    this.prevX = this.x;
    this.prevY = this.y;
    
    // Apply movement based on current direction
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 16.67;
    this.lastUpdateTime = currentTime;
    
    // Calculate new position
    const newX = this.x + this.vx * deltaTime;
    const newY = this.y + this.vy * deltaTime;
    
    const radius = this.radius;
    
    // Handle boundary collisions and direction changes
    if (this.direction === 0 && newY < this.top() + radius) {
      this.y = this.top() + radius;
      this.direction = this.rotate(this.direction, this.moveClockwise);
      this.applySpeed();
    } else if (this.direction === 1 && newX > this.right() - radius) {
      this.x = this.right() - radius;
      this.direction = this.rotate(this.direction, this.moveClockwise);
      this.applySpeed();
    } else if (this.direction === 2 && newY > this.bottom() - radius) {
      this.y = this.bottom() - radius;
      this.direction = this.rotate(this.direction, this.moveClockwise);
      this.applySpeed();
    } else if (this.direction === 3 && newX < this.left() + radius) {
      this.x = this.left() + radius;
      this.direction = this.rotate(this.direction, this.moveClockwise);
      this.applySpeed();
    } else {
      // Just move normally if no boundary collision
      this.x = newX;
      this.y = newY;
    }
    
    // Update position in grid
    grid.update(this);
  }
  
  serialize() {
    const baseData = super.serialize();
    return {
      ...baseData,
      direction: this.direction,
      moveClockwise: this.moveClockwise,
      boundary: this.boundary
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
  Dasher,
  Homing,
  VoidCrawler,
  Wall,
  Bullet,
  ENEMY_TYPES, 
  initializeGridWithMap: Enemy.initializeGridWithMap,
  bulkAddToGrid: Enemy.bulkAddToGrid
}; 