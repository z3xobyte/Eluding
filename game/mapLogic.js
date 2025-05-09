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

  findConnectedRegions(tileType) {
    const visited = new Array(this.height).fill(0).map(() => new Array(this.width).fill(false));
    const regions = [];
    
    const bfs = (startX, startY) => {
      const queue = [{x: startX, y: startY}];
      const tiles = [];
      visited[startY][startX] = true;
      
      while (queue.length > 0) {
        const {x, y} = queue.shift();
        tiles.push({x, y});
        
        const directions = [
          {dx: 1, dy: 0},  // right
          {dx: -1, dy: 0}, // left
          {dx: 0, dy: 1},  // down
          {dx: 0, dy: -1}  // up
        ];
        
        for (const {dx, dy} of directions) {
          const nx = x + dx;
          const ny = y + dy;
          
          if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) {
            continue;
          }
          
          if (this.tiles[ny][nx] === tileType && !visited[ny][nx]) {
            visited[ny][nx] = true;
            queue.push({x: nx, y: ny});
          }
        }
      }
      
      const minX = Math.min(...tiles.map(t => t.x));
      const maxX = Math.max(...tiles.map(t => t.x));
      const minY = Math.min(...tiles.map(t => t.y));
      const maxY = Math.max(...tiles.map(t => t.y));
      
      return {
        tiles,
        centerX: Math.floor(tiles.reduce((sum, t) => sum + t.x, 0) / tiles.length),
        centerY: Math.floor(tiles.reduce((sum, t) => sum + t.y, 0) / tiles.length),
        minX,
        maxX,
        minY,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1
      };
    };
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[y][x] === tileType && !visited[y][x]) {
          const region = bfs(x, y);
          regions.push(region);
        }
      }
    }
    
    return regions;
  }
}

module.exports = { Map: GameMap }; 