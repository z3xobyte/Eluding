const { Enemy } = require('./BaseEnemy');
const { RecursiveBullet } = require('./RecursiveBullet');

class RecursiveBulletBoss extends Enemy {
  constructor(x, y, radius, speed, shootCooldown = 120, bulletRadius = 8, bulletSpeed = 4, recursionLevels = 2) {
    super(x, y, radius, speed, 7); // Using type 7 for this new enemy
    this.color = '#AD85FF'; // Light purple
    this.outlineColor = '#5D2E8C'; // Dark purple
    
    this.shootCooldown = 0;
    this.maxShootCooldown = shootCooldown;
    this.bulletRadius = bulletRadius;
    this.bulletSpeed = bulletSpeed;
    this.recursionLevels = recursionLevels;
    
    // Rotation
    this.rotationAngle = 0;
    this.rotationSpeed = 0.03; // Constant rotation speed
    
    // Last time direction updated
    this.lastUpdateTimeMs = Date.now();
  }
  
  update(map, grid, game) {
    // Call super.update with only map and grid
    // The base Enemy class doesn't expect game parameter
    super.update(map, grid);
    
    const currentTimeMs = Date.now();
    const deltaTimeMs = currentTimeMs - this.lastUpdateTimeMs;
    this.lastUpdateTimeMs = currentTimeMs;
    
    // Rotate continuously
    this.rotationAngle += this.rotationSpeed;
    if (this.rotationAngle > Math.PI * 2) {
      this.rotationAngle -= Math.PI * 2;
    }
    
    // Handle shooting cooldown
    if (this.shootCooldown > 0) {
      this.shootCooldown--;
    }

    // Ready to shoot
    if (game && this.shootCooldown === 0) {
      // Rotating shot pattern
      this.fireSpiral(6, grid, game);
      this.shootCooldown = this.maxShootCooldown;
    }
  }
  
  fireSpiral(bulletCount, grid, game) {
    if (!game || !game.mapBullets || !game.currentMapId) return;

    
    for (let i = 0; i < bulletCount; i++) {
      const angle = this.rotationAngle + ((Math.PI * 2) / bulletCount) * i;
      const targetX = this.x + Math.cos(angle) * 100;
      const targetY = this.y + Math.sin(angle) * 100;
      
      const bullet = new RecursiveBullet(
        this.x, this.y, 
        targetX, targetY, 
        this.bulletRadius, 
        this.bulletSpeed,
        this.recursionLevels,
        200 // Longer lifespan
      );
      
      const bulletsOnMap = game.mapBullets.get(game.currentMapId) || new Map();
      bulletsOnMap.set(bullet.id, bullet);
      game.mapBullets.set(game.currentMapId, bulletsOnMap);
      bullet.addToGrid(grid);
    }
  }
  
  serialize() {
    const baseData = super.serialize();
    return {
      ...baseData,
      shootCooldown: this.shootCooldown,
      maxShootCooldown: this.maxShootCooldown,
      recursionLevels: this.recursionLevels,
      rotationAngle: this.rotationAngle
    };
  }
}

module.exports = { RecursiveBulletBoss }; 