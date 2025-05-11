class Grid {
  static NUM_POINTS_8 = 8;
  static ANGLES_COS_8 = [];
  static ANGLES_SIN_8 = [];
  static NUM_POINTS_12 = 12;
  static ANGLES_COS_12 = [];
  static ANGLES_SIN_12 = [];

  static {
    for (let i = 0; i < Grid.NUM_POINTS_8; i++) {
      const angle = (i / Grid.NUM_POINTS_8) * Math.PI * 2;
      Grid.ANGLES_COS_8.push(Math.cos(angle));
      Grid.ANGLES_SIN_8.push(Math.sin(angle));
    }
    for (let i = 0; i < Grid.NUM_POINTS_12; i++) {
      const angle = (i / Grid.NUM_POINTS_12) * Math.PI * 2;
      Grid.ANGLES_COS_12.push(Math.cos(angle));
      Grid.ANGLES_SIN_12.push(Math.sin(angle));
    }
  }

  constructor(width, height, cellSize) {
    this.width = width;
    this.height = height;
    this.cellSize = cellSize;
    this.inverseCellSize = 1.0 / cellSize;

    this.cellsX = Math.ceil(width / cellSize);
    this.cellsY = Math.ceil(height / cellSize);

    this.maxCellX = this.cellsX - 1;
    this.maxCellY = this.cellsY - 1;

    this.cells = new Array(this.cellsX * this.cellsY);
    for (let i = 0; i < this.cells.length; ++i) {
      this.cells[i] = {
        entities: new Set(),
        isWall: false,
        isSafeZone: false,
        isTeleporter: false,
        teleporterInfo: null,
        isPlayerSpawnable: false, 
      };
    }
    this.entities = new Map();
  }

  getCellIndex(x, y) {
    let cellX = ~~(x * this.inverseCellSize);
    cellX = cellX < 0 ? 0 : cellX > this.maxCellX ? this.maxCellX : cellX;
    let cellY = ~~(y * this.inverseCellSize);
    cellY = cellY < 0 ? 0 : cellY > this.maxCellY ? this.maxCellY : cellY;
    return cellX * this.cellsY + cellY;
  }

  getCellCoords(x, y) {
    let cellX = ~~(x * this.inverseCellSize);
    cellX = cellX < 0 ? 0 : cellX > this.maxCellX ? this.maxCellX : cellX;
    let cellY = ~~(y * this.inverseCellSize);
    cellY = cellY < 0 ? 0 : cellY > this.maxCellY ? this.maxCellY : cellY;
    return { x: cellX, y: cellY };
  }

  initializeMapData(map) {
    const cells = this.cells;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      cell.isWall = false;
      cell.isSafeZone = false;
      cell.isTeleporter = false;
      cell.teleporterInfo = null;
      cell.isPlayerSpawnable = false;
    }

    const invCellSize = this.inverseCellSize;
    const maxCX = this.maxCellX;
    const maxCY = this.maxCellY;
    const cellsYCount = this.cellsY;
    const mapTileSize = map.tileSize;

    for (let tileY = 0; tileY < map.height; tileY++) {
      for (let tileX = 0; tileX < map.width; tileX++) {
        const tileType = map.getTileType(tileX, tileY);
        if (tileType === null || tileType === undefined) continue;

        const worldMinX = tileX * mapTileSize;
        const worldMinY = tileY * mapTileSize;
        const worldMaxX = worldMinX + mapTileSize;
        const worldMaxY = worldMinY + mapTileSize;

        const minCellX = ~~(worldMinX * invCellSize);
        const minCellY = ~~(worldMinY * invCellSize);
        const maxCellXBoundary = ~~((worldMaxX - 0.0001) * invCellSize);
        const maxCellYBoundary = ~~((worldMaxY - 0.0001) * invCellSize);

        const gridMinX = minCellX < 0 ? 0 : minCellX > maxCX ? maxCX : minCellX;
        const gridMinY = minCellY < 0 ? 0 : minCellY > maxCY ? maxCY : minCellY;
        const gridMaxX =
          maxCellXBoundary < 0
            ? 0
            : maxCellXBoundary > maxCX
              ? maxCX
              : maxCellXBoundary;
        const gridMaxY =
          maxCellYBoundary < 0
            ? 0
            : maxCellYBoundary > maxCY
              ? maxCY
              : maxCellYBoundary;

        for (let cX = gridMinX; cX <= gridMaxX; cX++) {
          for (let cY = gridMinY; cY <= gridMaxY; cY++) {
            const cellIndex = cX * cellsYCount + cY;
            const currentCell = cells[cellIndex];
            
            // Reset flags for the cell before applying new properties based on tileType
            // currentCell.isWall = false; // Already done in the initial loop for all cells
            // currentCell.isSafeZone = false; // Already done
            // currentCell.isTeleporter = false; // Already done
            // currentCell.isPlayerSpawnable = false; // Already done

            if (tileType === 0) { // Wall
              currentCell.isWall = true;
            } else if (tileType === 2) { // Player-spawnable Safe Zone
              currentCell.isSafeZone = true;
              currentCell.isPlayerSpawnable = true;
            } else if (tileType === 3) { // Teleporter
              currentCell.isTeleporter = true;
              const teleporter = map.getTeleporter(tileX, tileY);
              if (teleporter) {
                currentCell.teleporterInfo = {
                  tileX,
                  tileY,
                  code: teleporter.code,
                  mapId: teleporter.mapId,
                };
              }
            } else if (tileType === 4) { // Non-player-spawnable Safe Zone
              currentCell.isSafeZone = true;
              currentCell.isPlayerSpawnable = false; // Explicitly false, though it's the default
            }
          }
        }
      }
    }
  }

  insert(entity) {
    const entityRadius = entity.radius || 0;
    const invCellSize = this.inverseCellSize;
    const maxCX = this.maxCellX;
    const maxCY = this.maxCellY;
    const cellsYCount = this.cellsY;
    const entityId = entity.id;

    let minX = ~~((entity.x - entityRadius) * invCellSize);
    minX = minX < 0 ? 0 : minX > maxCX ? maxCX : minX;
    let minY = ~~((entity.y - entityRadius) * invCellSize);
    minY = minY < 0 ? 0 : minY > maxCY ? maxCY : minY;
    let maxX = ~~((entity.x + entityRadius) * invCellSize);
    maxX = maxX < 0 ? 0 : maxX > maxCX ? maxCX : maxX;
    let maxY = ~~((entity.y + entityRadius) * invCellSize);
    maxY = maxY < 0 ? 0 : maxY > maxCY ? maxCY : maxY;

    const cellIndices = [];
    const currentCells = this.cells;

    if (maxX >= minX && maxY >= minY) {
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          const cellIndex = x * cellsYCount + y;
          currentCells[cellIndex].entities.add(entityId);
          cellIndices.push(cellIndex);
        }
      }
    }

    this.entities.set(entityId, {
      entity,
      minX,
      minY,
      maxX,
      maxY,
      cellIndices,
    });
    return cellIndices;
  }

  remove(entityId) {
    const entityData = this.entities.get(entityId);
    if (!entityData) return;

    const currentCells = this.cells;
    for (const cellIndex of entityData.cellIndices) {
      if (currentCells[cellIndex]) {
        currentCells[cellIndex].entities.delete(entityId);
      }
    }
    this.entities.delete(entityId);
  }

  update(entity) {
    const entityId = entity.id;
    const entityData = this.entities.get(entityId);

    if (!entityData) {
      return this.insert(entity);
    }

    const oldCellIndices = entityData.cellIndices;
    const oldMinX = entityData.minX;
    const oldMinY = entityData.minY;
    const oldMaxX = entityData.maxX;
    const oldMaxY = entityData.maxY;

    const entityRadius = entity.radius || 0;
    const invCellSize = this.inverseCellSize;
    const maxCX = this.maxCellX;
    const maxCY = this.maxCellY;
    const cellsYCount = this.cellsY;
    const currentCells = this.cells;

    let newMinX = ~~((entity.x - entityRadius) * invCellSize);
    newMinX = newMinX < 0 ? 0 : newMinX > maxCX ? maxCX : newMinX;
    let newMinY = ~~((entity.y - entityRadius) * invCellSize);
    newMinY = newMinY < 0 ? 0 : newMinY > maxCY ? maxCY : newMinY;
    let newMaxX = ~~((entity.x + entityRadius) * invCellSize);
    newMaxX = newMaxX < 0 ? 0 : newMaxX > maxCX ? maxCX : newMaxX;
    let newMaxY = ~~((entity.y + entityRadius) * invCellSize);
    newMaxY = newMaxY < 0 ? 0 : newMaxY > maxCY ? maxCY : newMaxY;

    if (
      newMinX === oldMinX &&
      newMinY === oldMinY &&
      newMaxX === oldMaxX &&
      newMaxY === oldMaxY
    ) {
      entityData.entity = entity;
      return oldCellIndices;
    }

    const newCellIndicesArray = [];
    if (newMaxX >= newMinX && newMaxY >= newMinY) {
      for (let x = newMinX; x <= newMaxX; x++) {
        for (let y = newMinY; y <= newMaxY; y++) {
          newCellIndicesArray.push(x * cellsYCount + y);
        }
      }
    }

    const oldCellIndicesSet = new Set(oldCellIndices);
    const newCellIndicesSet = new Set(newCellIndicesArray);

    for (const cellIndex of oldCellIndicesSet) {
      if (!newCellIndicesSet.has(cellIndex)) {
        if (currentCells[cellIndex]) {
          currentCells[cellIndex].entities.delete(entityId);
        }
      }
    }

    for (const cellIndex of newCellIndicesSet) {
      if (!oldCellIndicesSet.has(cellIndex)) {
        if (currentCells[cellIndex]) {
          currentCells[cellIndex].entities.add(entityId);
        }
      }
    }

    entityData.entity = entity;
    entityData.minX = newMinX;
    entityData.minY = newMinY;
    entityData.maxX = newMaxX;
    entityData.maxY = newMaxY;
    entityData.cellIndices = newCellIndicesArray;

    return newCellIndicesArray;
  }

  getNearbyEntities(entity) {
    const entityData = this.entities.get(entity.id);
    if (!entityData) return [];

    const nearbyIds = new Set();
    const entityIdToExclude = entity.id;
    const currentCells = this.cells;

    for (const cellIndex of entityData.cellIndices) {
      for (const id of currentCells[cellIndex].entities) {
        if (id !== entityIdToExclude) {
          nearbyIds.add(id);
        }
      }
    }
    return Array.from(nearbyIds);
  }

  _checkOverlapWithCellProperty(checkX, checkY, checkRadius, cellPredicate) {
    const invCellSize = this.inverseCellSize;
    const maxCX = this.maxCellX;
    const maxCY = this.maxCellY;
    const cellsYCount = this.cellsY;
    const cSize = this.cellSize;
    const currentCells = this.cells;

    const entityCellX = ~~(checkX * invCellSize);
    const entityCellY = ~~(checkY * invCellSize);

    const radiusInCells = Math.ceil(checkRadius * invCellSize);

    let minTestCellX = entityCellX - radiusInCells;
    minTestCellX =
      minTestCellX < 0 ? 0 : minTestCellX > maxCX ? maxCX : minTestCellX;
    let minTestCellY = entityCellY - radiusInCells;
    minTestCellY =
      minTestCellY < 0 ? 0 : minTestCellY > maxCY ? maxCY : minTestCellY;
    let maxTestCellX = entityCellX + radiusInCells;
    maxTestCellX =
      maxTestCellX > maxCX ? maxCX : maxTestCellX < 0 ? 0 : maxTestCellX;
    let maxTestCellY = entityCellY + radiusInCells;
    maxTestCellY =
      maxTestCellY > maxCY ? maxCY : maxTestCellY < 0 ? 0 : maxTestCellY;

    const entityWorldMinX = checkX - checkRadius;
    const entityWorldMinY = checkY - checkRadius;
    const entityWorldMaxX = checkX + checkRadius;
    const entityWorldMaxY = checkY + checkRadius;

    for (let cx = minTestCellX; cx <= maxTestCellX; cx++) {
      for (let cy = minTestCellY; cy <= maxTestCellY; cy++) {
        const cellIndex = cx * cellsYCount + cy;
        const cell = currentCells[cellIndex];

        if (cell && cellPredicate(cell)) {
          const cellWorldMinX = cx * cSize;
          const cellWorldMinY = cy * cSize;
          const cellWorldMaxX = cellWorldMinX + cSize;
          const cellWorldMaxY = cellWorldMinY + cSize;

          if (
            entityWorldMinX < cellWorldMaxX &&
            entityWorldMaxX > cellWorldMinX &&
            entityWorldMinY < cellWorldMaxY &&
            entityWorldMaxY > cellWorldMinY
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  checkWallCollision(entity) {
    const radius = entity.radius || 0;
    if (
      entity.x - radius < 0 ||
      entity.x + radius > this.width ||
      entity.y - radius < -2 ||
      entity.y + radius > this.height
    ) {
      return true;
    }
    return this._checkOverlapWithCellProperty(
      entity.x,
      entity.y,
      radius,
      (cell) => cell.isWall,
    );
  }

  checkSafeZoneCollision(entity) {
    return this._checkOverlapWithCellProperty(
      entity.x,
      entity.y,
      entity.radius || 0,
      (cell) => cell.isSafeZone,
    );
  }

  queryArea(x, y, radius) {
    const entityRadius = radius || 0;
    const invCellSize = this.inverseCellSize;
    const maxCX = this.maxCellX;
    const maxCY = this.maxCellY;
    const cellsYCount = this.cellsY;

    let minX = ~~((x - entityRadius) * invCellSize);
    minX = minX < 0 ? 0 : minX > maxCX ? maxCX : minX;
    let minY = ~~((y - entityRadius) * invCellSize);
    minY = minY < 0 ? 0 : minY > maxCY ? maxCY : minY;
    let maxX = ~~((x + entityRadius) * invCellSize);
    maxX = maxX < 0 ? 0 : maxX > maxCX ? maxCX : maxX;
    let maxY = ~~((y + entityRadius) * invCellSize);
    maxY = maxY < 0 ? 0 : maxY > maxCY ? maxCY : maxY;

    const entityIds = new Set();
    const currentCells = this.cells;
    if (maxX >= minX && maxY >= minY) {
      for (let cellXLoop = minX; cellXLoop <= maxX; cellXLoop++) {
        for (let cellYLoop = minY; cellYLoop <= maxY; cellYLoop++) {
          const cellIndex = cellXLoop * cellsYCount + cellYLoop;
          for (const id of currentCells[cellIndex].entities) {
            entityIds.add(id);
          }
        }
      }
    }
    return Array.from(entityIds);
  }

  clear() {
    this.cells.forEach((cell) => {
      cell.entities.clear();
    });
    this.entities.clear();
  }

  getGridStats() {
    let totalEntities = this.entities.size;
    let occupiedCells = 0;
    let maxEntitiesInCell = 0;
    for (const cell of this.cells) {
      const size = cell.entities.size;
      if (size > 0) {
        occupiedCells++;
        if (size > maxEntitiesInCell) {
          maxEntitiesInCell = size;
        }
      }
    }
    return {
      totalEntities,
      occupiedCells,
      maxEntitiesInCell,
      totalCells: this.cellsX * this.cellsY,
    };
  }

  bulkInsert(entitiesToAdd) {
    if (!entitiesToAdd || entitiesToAdd.length === 0) return;
    for (const entity of entitiesToAdd) {
      if (this.entities.has(entity.id)) {
        this.remove(entity.id);
      }
    }
    for (const entity of entitiesToAdd) {
      this.insert(entity);
    }
  }

  isValidSpawnPosition(x, y, radius) {
    const rad = radius || 0;
    if (
      x - rad < 0 ||
      x + rad > this.width ||
      y - rad < 0 ||
      y + rad > this.height
    ) {
      return false;
    }
    return !this._checkOverlapWithCellProperty(
      x,
      y,
      rad,
      (cell) => cell.isWall || cell.isTeleporter || (cell.isSafeZone && !cell.isPlayerSpawnable),
    );
  }

  checkTeleporterCollision(entity) {
    const x = entity.x;
    const y = entity.y;
    const radius = entity.radius || 0;

    // Use the same approach as _checkOverlapWithCellProperty
    return this._checkOverlapWithCellProperty(
      x,
      y,
      radius,
      (cell) => cell.isTeleporter,
    );
  }
  getTeleporterAt(x, y) {
    let cellX = ~~(x * this.inverseCellSize);
    let cellY = ~~(y * this.inverseCellSize);

    if (
      cellX < 0 ||
      cellX > this.maxCellX ||
      cellY < 0 ||
      cellY > this.maxCellY
    ) {
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
    return !this._checkOverlapWithCellProperty(
      entity.x,
      entity.y,
      entity.radius || 0,
      (cell) => cell.isTeleporter,
    );
  }

  isFullyInsideTeleporter(entity) {
    const centerTeleporterInfo = this.getTeleporterAt(entity.x, entity.y);
    if (!centerTeleporterInfo) {
      return false;
    }

    const x = entity.x;
    const y = entity.y;
    const radius = entity.radius || 0;
    const centerCode = centerTeleporterInfo.code;
    const invCellSize = this.inverseCellSize;
    const cellsYCount = this.cellsY;

    const minX = Math.floor((x - radius) * invCellSize);
    const minY = Math.floor((y - radius) * invCellSize);
    const maxX = Math.floor((x + radius) * invCellSize);
    const maxY = Math.floor((y + radius) * invCellSize);

    for (let cx = minX; cx <= maxX; cx++) {
      for (let cy = minY; cy <= maxY; cy++) {
        const cellCenterX = (cx + 0.5) * this.cellSize;
        const cellCenterY = (cy + 0.5) * this.cellSize;
        const distSq =
          (cellCenterX - x) * (cellCenterX - x) +
          (cellCenterY - y) * (cellCenterY - y);
        const testRadius = radius + Math.sqrt(2) * (this.cellSize / 2);

        if (distSq > testRadius * testRadius) continue;

        const cellIndex = cx * cellsYCount + cy;
        if (cellIndex < 0 || cellIndex >= this.cells.length) continue;

        const cell = this.cells[cellIndex];
        if (
          !cell.isTeleporter ||
          !cell.teleporterInfo ||
          cell.teleporterInfo.code !== centerCode
        ) {
          return false;
        }
      }
    }
    return true;
  }
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = Grid;
}
