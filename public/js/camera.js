export class Camera {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.x = 0;
    this.y = 0;
    this.targetX = 0;
    this.targetY = 0;
    this.lerpFactor = 0.1; // Interpolation factor (0-1): lower means smoother
    this.zoomFactor = 1;
  }
  
  resize(width, height) {
    this.width = width;
    this.height = height;
  }
  
  update(targetX, targetY, deltaTime) {
    // Store target position
    this.targetX = targetX;
    this.targetY = targetY;
    
    // Smoothly interpolate camera position
    if (this.lerpFactor >= 1) {
      // Immediate snap to position (no interpolation)
      this.x = targetX - this.width / 2;
      this.y = targetY - this.height / 2;
    } else {
      // Smooth movement using lerp
      const targetCameraX = targetX - this.width / 2;
      const targetCameraY = targetY - this.height / 2;
      
      // Calculate distance to target
      const dx = targetCameraX - this.x;
      const dy = targetCameraY - this.y;
      
      // Apply lerp based on deltaTime (if provided) or fixed factor
      if (deltaTime) {
        // Time-based lerp for frame-rate independence
        const timeAdjustedLerp = Math.min(1, this.lerpFactor * (deltaTime / 16.67)); // Normalized to 60fps
        this.x += dx * timeAdjustedLerp;
        this.y += dy * timeAdjustedLerp;
      } else {
        // Fixed lerp
        this.x += dx * this.lerpFactor;
        this.y += dy * this.lerpFactor;
      }
    }
  }
  
  // Set camera interpolation speed
  setLerpFactor(factor) {
    this.lerpFactor = Math.max(0, Math.min(1, factor)); // Clamp between 0-1
  }
  
  // Immediately set camera position without interpolation
  setPosition(x, y) {
    this.x = x - this.width / 2;
    this.y = y - this.height / 2;
    this.targetX = x;
    this.targetY = y;
  }
  
  worldToScreen(worldX, worldY) {
    const screenX = (worldX - this.x) * this.zoomFactor;
    const screenY = (worldY - this.y) * this.zoomFactor;
    
    return {
      x: screenX,
      y: screenY
    };
  }
  
  screenToWorld(screenX, screenY) {
    return {
      x: (screenX / this.zoomFactor) + this.x,
      y: (screenY / this.zoomFactor) + this.y
    };
  }
} 