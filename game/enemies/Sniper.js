const { Enemy } = require('./BaseEnemy');
const { Bullet } = require('./Bullet');

class Sniper extends Enemy {
  constructor(x, y, radius, speed, detectionRange = 500, shootingRange = 400, maxShootCooldown = 100, bulletRadius = 5, bulletSpeed = 5) {
    super(x, y, radius, speed, 2);
    this.detectionRangeSq = detectionRange * detectionRange;
    this.shootingRangeSq = shootingRange * shootingRange;
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
      let closestDistanceSq = this.detectionRangeSq;

      for (const player of players.values()) {
        if (player.isDead || player.currentMapId !== game.currentMapId) continue;
        
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const distanceSq = dx * dx + dy * dy;
        
        if (distanceSq < closestDistanceSq) {
          closestDistanceSq = distanceSq;
          closestPlayer = player;
        }
      }

      if (closestPlayer && closestDistanceSq <= this.shootingRangeSq) {
        this.lastTargetX = closestPlayer.x;
        this.lastTargetY = closestPlayer.y;
        const bullet = new Bullet(
          this.x, this.y, 
          this.lastTargetX, this.lastTargetY, 
          this.bulletRadius, this.bulletSpeed
        );

        if (game.mapBullets && game.currentMapId) {
          const bulletsOnMap = game.mapBullets.get(game.currentMapId) || new Map();
          bulletsOnMap.set(bullet.id, bullet);
          game.mapBullets.set(game.currentMapId, bulletsOnMap);
          bullet.addToGrid(grid);
        }
        this.shootCooldown = this.maxShootCooldown;
      } else {
        this.lastTargetX = null;
        this.lastTargetY = null;
      }
    }
  }
  
  serialize() {
    const baseData = super.serialize();
    return {
      ...baseData,
      detectionRange: Math.sqrt(this.detectionRangeSq),
      shootingRange: Math.sqrt(this.shootingRangeSq)
    };
  }
}

module.exports = { Sniper }; 