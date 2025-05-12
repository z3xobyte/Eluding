const { Enemy } = require('./BaseEnemy');
const { isPlayerInProtectedTile } = require('../enemy');

class Homing extends Enemy {
  constructor(x, y, radius, speed, increment = 0.05, homeRange = 200) {
    super(x, y, radius, speed, 4);
    this.increment = increment;
    this.homeRangeSq = homeRange * homeRange;
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
    this.angle = Math.atan2(this.vy, this.vx);
    const closestPlayer = this.findClosestPlayer(game);
    if (closestPlayer) {
      const dX = closestPlayer.x - this.x;
      const dY = closestPlayer.y - this.y;
      this.targetAngle = Math.atan2(dY, dX);
    }
    
    const angleDiff = Math.atan2(Math.sin(this.targetAngle - this.angle), Math.cos(this.targetAngle - this.angle));
    const angleIncrement = this.increment * (time / (1000/60));
    
    if (Math.abs(angleDiff) >= 0.01) { 
      this.angle += Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), angleIncrement);
    }
    
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
  }
  
  findClosestPlayer(game) {
    if (!game || !game.players) return null;
    let closestPlayer = null;
    let minDistanceSq = this.homeRangeSq; 
    
    for (const player of game.players.values()) {
      if (player.isDead || player.currentMapId !== game.currentMapId) continue;
      
      // Skip players in protected tiles (safe zones and teleporters)
      if (isPlayerInProtectedTile(player, game)) continue;
      
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < minDistanceSq) {
        minDistanceSq = distanceSq;
        closestPlayer = player;
      }
    }
    return closestPlayer;
  }
  
  serialize() {
    const baseData = super.serialize();
    return { ...baseData, homeRange: Math.sqrt(this.homeRangeSq), angle: this.angle, targetAngle: this.targetAngle };
  }
}

module.exports = { Homing }; 