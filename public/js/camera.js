export class Camera {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.x = 0;
    this.y = 0;
    
  }
  
  resize(width, height) {
    this.width = width;
    this.height = height;
  }
  
  update(targetX, targetY) {
    this.x = targetX - this.width / 2;
    this.y = targetY - this.height / 2;
  }
  
  worldToScreen(worldX, worldY) {
    return {
      x: worldX - this.x,
      y: worldY - this.y
    };
  }
  
  screenToWorld(screenX, screenY) {
    return {
      x: screenX + this.x,
      y: screenY + this.y
    };
  }
} 