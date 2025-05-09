class Grid {
  constructor(width, height, cellSize) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.inverseCellSize = 1.0 / cellSize;

    this.cellsX = Math.ceil(width / cellSize);
    this.cellsY = Math.ceil(height / cellSize);

    this.maxCellX = this.cellsX - 1;
    this.maxCellY = this.cellsY - 1;

    this.cells = new Array(this.cellsX * this.cellsY).fill(null).map(() => ({
      entities: new Set(),
      isWall: false,
      isSafeZone: false,
      isTeleporter: false,
      teleporterInfo: null
    }));

    this.entities = new Map(); 
  }

  getCellIndex(x, y) {
    const cellX = Math.min(Math.max(Math.floor(x * this.inverseCellSize), 0), this.maxCellX);
    const cellY = Math.min(Math.max(Math.floor(y * this.inverseCellSize), 0), this.maxCellY);
    return cellX * this.cellsY + cellY;
  }

  getCellCoords(x, y) {
    return {
      x: Math.min(Math.max(Math.floor(x * this.inverseCellSize), 0), this.maxCellX),
      y: Math.min(Math.max(Math.floor(y * this.inverseCellSize), 0), this.maxCellY)
    };
  }

  initializeMapData(map) {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i].isWall = false;
      this.cells[i].isSafeZone = false;
      this.cells[i].isTeleporter = false;
      this.cells[i].teleporterInfo = null;
    }

    for (let tileY = 0; tileY < map.height; tileY++) {
      for (let tileX = 0; tileX < map.width; tileX++) {
        const tileType = map.getTileType(tileX, tileY);
        if (tileType === null || tileType === undefined) continue;

        const worldMinX = tileX * map.tileSize;
        const worldMinY = tileY * map.tileSize;
        const worldMaxX = worldMinX + map.tileSize;
        const worldMaxY = worldMinY + map.tileSize;

        const minCellX = Math.floor(worldMinX * this.inverseCellSize);
        const minCellY = Math.floor(worldMinY * this.inverseCellSize);
        const maxCellX = Math.floor((worldMaxX - 0.0001) * this.inverseCellSize);
        const maxCellY = Math.floor((worldMaxY - 0.0001) * this.inverseCellSize);


        const gridMinX = Math.max(0, Math.min(minCellX, this.maxCellX));
        const gridMinY = Math.max(0, Math.min(minCellY, this.maxCellY));
        const gridMaxX = Math.max(0, Math.min(maxCellX, this.maxCellX));
        const gridMaxY = Math.max(0, Math.min(maxCellY, this.maxCellY));

        for (let cellX = gridMinX; cellX <= gridMaxX; cellX++) {
          for (let cellY = gridMinY; cellY <= gridMaxY; cellY++) {
            const cellIndex = cellX * this.cellsY + cellY;
            if (tileType === 0) {
              this.cells[cellIndex].isWall = true;
            } else if (tileType === 2) {
              this.cells[cellIndex].isSafeZone = true;
            } else if (tileType === 3) {
              this.cells[cellIndex].isTeleporter = true;
              const teleporter = map.getTeleporter(tileX, tileY);
              if (teleporter) {
                this.cells[cellIndex].teleporterInfo = {
                  tileX,
                  tileY,
                  code: teleporter.code,
                  mapId: teleporter.mapId
                };
              }
            }
          }
        }
      }
    }
  }

  insert(entity) {
    const entityRadius = entity.radius || 0;
    const minX = Math.min(Math.max(Math.floor((entity.x - entityRadius) * this.inverseCellSize), 0), this.maxCellX);
    const minY = Math.min(Math.max(Math.floor((entity.y - entityRadius) * this.inverseCellSize), 0), this.maxCellY);
    const maxX = Math.min(Math.max(Math.floor((entity.x + entityRadius) * this.inverseCellSize), 0), this.maxCellX);
    const maxY = Math.min(Math.max(Math.floor((entity.y + entityRadius) * this.inverseCellSize), 0), this.maxCellY);

    const cellIndices = [];

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const cellIndex = x * this.cellsY + y;
        this.cells[cellIndex].entities.add(entity.id);
        cellIndices.push(cellIndex);
      }
    }

    this.entities.set(entity.id, {
      entity,
      minX, minY, maxX, maxY,
      cellIndices
    });

    return cellIndices;
  }

  remove(entityId) {
    const entityData = this.entities.get(entityId);
    if (!entityData) return;

    for (const cellIndex of entityData.cellIndices) {
      if (this.cells[cellIndex]) {
        this.cells[cellIndex].entities.delete(entityId);
      }
    }
    this.entities.delete(entityId);
  }

  update(entity) {
    this.remove(entity.id);
    return this.insert(entity);
  }

  getNearbyEntities(entity) {
    const entityData = this.entities.get(entity.id);
    if (!entityData) return [];

    const nearbyIds = new Set();
    for (const cellIndex of entityData.cellIndices) {
      for (const id of this.cells[cellIndex].entities) {
        if (id !== entity.id) {
          nearbyIds.add(id);
        }
      }
    }
    return Array.from(nearbyIds);
  }

  _checkOverlapWithCellProperty(checkX, checkY, checkRadius, cellPredicate) {
    const entityCellX = Math.floor(checkX * this.inverseCellSize);
    const entityCellY = Math.floor(checkY * this.inverseCellSize);
    const radiusInCells = Math.ceil(checkRadius * this.inverseCellSize);

    const minTestCellX = Math.max(0, entityCellX - radiusInCells);
    const minTestCellY = Math.max(0, entityCellY - radiusInCells);
    const maxTestCellX = Math.min(this.maxCellX, entityCellX + radiusInCells);
    const maxTestCellY = Math.min(this.maxCellY, entityCellY + radiusInCells);

    for (let cx = minTestCellX; cx <= maxTestCellX; cx++) {
      for (let cy = minTestCellY; cy <= maxTestCellY; cy++) {
        const cellIndex = cx * this.cellsY + cy;
        const cell = this.cells[cellIndex];

        if (cell && cellPredicate(cell)) {

          const cellWorldMinX = cx * this.cellSize;
          const cellWorldMinY = cy * this.cellSize;
          const cellWorldMaxX = cellWorldMinX + this.cellSize;
          const cellWorldMaxY = cellWorldMinY + this.cellSize;

          const entityWorldMinX = checkX - checkRadius;
          const entityWorldMinY = checkY - checkRadius;
          const entityWorldMaxX = checkX + checkRadius;
          const entityWorldMaxY = checkY + checkRadius;

          if (entityWorldMinX < cellWorldMaxX &&
              entityWorldMaxX > cellWorldMinX &&
              entityWorldMinY < cellWorldMaxY &&
              entityWorldMaxY > cellWorldMinY) {
            return true;
          }
        }
      }
    }
    return false;
  }


  checkWallCollision(entity) {
    if (entity.x - entity.radius < 0 ||
        entity.x + entity.radius > this.width ||
        entity.y - entity.radius < -2 ||
        entity.y + entity.radius > this.height) {
      return true;
    }
    return this._checkOverlapWithCellProperty(entity.x, entity.y, entity.radius, (cell) => cell.isWall);
  }

  checkSafeZoneCollision(entity) {
    return this._checkOverlapWithCellProperty(entity.x, entity.y, entity.radius, (cell) => cell.isSafeZone);
  }

  queryArea(x, y, radius) {
    const entityRadius = radius || 0;
    const minX = Math.min(Math.max(Math.floor((x - entityRadius) * this.inverseCellSize), 0), this.maxCellX);
    const minY = Math.min(Math.max(Math.floor((y - entityRadius) * this.inverseCellSize), 0), this.maxCellY);
    const maxX = Math.min(Math.max(Math.floor((x + entityRadius) * this.inverseCellSize), 0), this.maxCellX);
    const maxY = Math.min(Math.max(Math.floor((y + entityRadius) * this.inverseCellSize), 0), this.maxCellY);

    const entityIds = new Set();
    for (let cellX = minX; cellX <= maxX; cellX++) {
      for (let cellY = minY; cellY <= maxY; cellY++) {
        const cellIndex = cellX * this.cellsY + cellY;
        for (const id of this.cells[cellIndex].entities) {
          entityIds.add(id);
        }
      }
    }
    return Array.from(entityIds);
  }

  clear() {
    this.cells.forEach(cell => {
      cell.entities.clear();
    });
    this.entities.clear();
  }

  getGridStats() {
    let totalEntities = this.entities.size;
    let occupiedCells = 0;
    let maxEntitiesInCell = 0;

    for (const cell of this.cells) {
      if (cell.entities.size > 0) {
        occupiedCells++;
        maxEntitiesInCell = Math.max(maxEntitiesInCell, cell.entities.size);
      }
    }

    return {
      totalEntities,
      occupiedCells,
      maxEntitiesInCell,
      totalCells: this.cellsX * this.cellsY
    };
  }

  bulkInsert(entities) {
    if (!entities || entities.length === 0) return;

    for (const entity of entities) {
      if (this.entities.has(entity.id)) {
        this.remove(entity.id);
      }
    }

    for (const entity of entities) {
      this.insert(entity);
    }
  }

  isValidSpawnPosition(x, y, radius) {
    if (x - radius < 0 ||
        x + radius > this.width ||
        y - radius < 0 ||
        y + radius > this.height) {
      return false;
    }

    if (this._checkOverlapWithCellProperty(x, y, radius, (cell) => cell.isWall || cell.isSafeZone || cell.isTeleporter)) {
      return false;
    }

    return true;
  }

  checkTeleporterCollision(entity) {
    const x = entity.x;
    const y = entity.y;
    const radius = entity.radius || 0;
    const centerCellIndex = this.getCellIndex(x, y);
    if (centerCellIndex >= 0 && centerCellIndex < this.cells.length && this.cells[centerCellIndex].isTeleporter) {
      return true;
    }
    const numPoints = 8;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      
      const cellIndex = this.getCellIndex(px, py);
      if (cellIndex >= 0 && cellIndex < this.cells.length && this.cells[cellIndex].isTeleporter) {
        return true;
      }
    }
    
    return false;
  }

  getTeleporterAt(x, y) {
    const cellX = Math.floor(x * this.inverseCellSize);
    const cellY = Math.floor(y * this.inverseCellSize);
    
    if (cellX < 0 || cellY < 0 || cellX > this.maxCellX || cellY > this.maxCellY) {
      return null;
    }
    
    const cellIndex = cellX * this.cellsY + cellY;
    const cell = this.cells[cellIndex];
    
    if (cell && cell.isTeleporter && cell.teleporterInfo) {
      return cell.teleporterInfo;
    }
    
    return null;
  }

  isFullyOutsideTeleporter(entity) {
    const x = entity.x;
    const y = entity.y;
    const radius = entity.radius || 0;
    const centerCellIndex = this.getCellIndex(x, y);
    if (centerCellIndex >= 0 && centerCellIndex < this.cells.length && this.cells[centerCellIndex].isTeleporter) {
      return false;
    }
    const numPoints = 12;
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      
      const cellIndex = this.getCellIndex(px, py);
      if (cellIndex >= 0 && cellIndex < this.cells.length && this.cells[cellIndex].isTeleporter) {
        return false;
      }
    }
    
    return true;
  }

  isFullyInsideTeleporter(entity) {
    const centerTeleporter = this.getTeleporterAt(entity.x, entity.y);
    if (!centerTeleporter) {
      return false;
    }
    return true;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = Grid;
}
