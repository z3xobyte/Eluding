class GameMap {
  constructor(mapConfig) {
    this.width = mapConfig.width;
    this.height = mapConfig.height;
    this.tileSize = mapConfig.tileSize;
    this.enemyConfig = mapConfig.enemyConfig;
    this.encodedMap = mapConfig.encodedMap;
    this.tiles = this.decodeMap(this.encodedMap);
    this.mapId = mapConfig.mapId || null;
    this.teleportersByPosition = new Map();
    this.teleportersByCode = new Map();
    this.findTeleporterTiles();
    if (mapConfig.teleporterCodes) {
      this.teleporterCodes = mapConfig.teleporterCodes;
      this.associateTeleporterCodes();
    }
  }
  
  findTeleporterTiles() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[y][x] === 3) {
          const key = `${x}_${y}`;
          const teleporter = {
            tileX: x,
            tileY: y,
            code: null,
            mapId: null
          };
          this.teleportersByPosition.set(key, teleporter);
        }
      }
    }
  }
  
  associateTeleporterCodes() {
    if (!this.teleporterCodes || this.teleporterCodes.length === 0) {
      console.warn("No teleporter codes available for map");
      return;
    }
    const teleporterPositions = Array.from(this.teleportersByPosition.keys());
    for (let i = 0; i < this.teleporterCodes.length; i++) {
      const codeInfo = this.teleporterCodes[i];
      
      if (i < teleporterPositions.length) {
        const posKey = teleporterPositions[i];
        const teleporter = this.teleportersByPosition.get(posKey);
        
        teleporter.code = codeInfo.code;
        teleporter.mapId = codeInfo.mapId;
        
        this.teleportersByCode.set(codeInfo.code, teleporter);
      }
    }
  }
  
  decodeMap(encoded) {
    const map = [];
    let rowIndex = 0;
    let colIndex = 0;
    
    for (let i = 0; i < encoded.length; i += 2) {
      const value = encoded[i];
      const count = encoded[i + 1];
      
      if (!map[rowIndex]) {
        map[rowIndex] = [];
      }
      
      for (let j = 0; j < count; j++) {
        map[rowIndex][colIndex] = value;
        colIndex++;
        
        if (colIndex >= this.width) {
          colIndex = 0;
          rowIndex++;
          if (rowIndex < this.height && !map[rowIndex]) {
            map[rowIndex] = [];
          }
        }
      }
    }
    
    return map;
  }
  
  isWall(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return true;
    }
    return this.tiles[y][x] === 0;
  }
  
  getTileType(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return 0;
    }
    return this.tiles[y][x];
  }
  
  isSafeZone(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return false;
    }
    return this.tiles[y][x] === 2;
  }
  
  getRandomTypePosition(tileType) {
    const positions = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[y][x] === tileType) {
          positions.push({ x, y });
        }
      }
    }
    
    if (positions.length === 0) {
      return null;
    }
    
    const randomPos = positions[Math.floor(Math.random() * positions.length)];
    return {
      x: randomPos.x * this.tileSize + this.tileSize / 2,
      y: randomPos.y * this.tileSize + this.tileSize / 2
    };
  }
  
  getValidSpawnPosition(tileType, radius, grid) {
    const positions = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.getTileType(x,y) === tileType) {
          const worldX = x * this.tileSize + this.tileSize / 2;
          const worldY = y * this.tileSize + this.tileSize / 2;
          
          if (grid.isValidSpawnPosition(worldX, worldY, radius)) {
            positions.push({ x: worldX, y: worldY });
          }
        }
      }
    }
    
    if (positions.length === 0) {
      return null;
    }
    return positions[Math.floor(Math.random() * positions.length)];
  }

  isTeleporter(tileX, tileY) {
    return this.tiles[tileY][tileX] === 3;
  }

  getTeleporter(tileX, tileY) {
    const key = `${tileX}_${tileY}`;
    return this.teleportersByPosition.get(key) || null;
  }

  getTeleporterByCode(code) {
    return this.teleportersByCode.get(code) || null;
  }
}

module.exports = { Map: GameMap }; 