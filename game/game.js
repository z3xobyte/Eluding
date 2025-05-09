const zlib = require('zlib');
const { Enemy, Sniper, Dasher, Homing, VoidCrawler, Wall, Bullet, ENEMY_TYPES, initializeGridWithMap } = require('./enemy');
const { Player } = require('./player');
const { Grid } = require('./grid');

class Game {
  constructor(mapManager) {
    this.mapManager = mapManager;
    this.players = new Map();
    this.connections = new Map();
    this.mapEnemies = new Map();
    this.mapBullets = new Map();
    this.mapGrids = new Map();
    this.lastUpdateTime = Date.now();
    this.updateInterval = null;
    this._cachedPlayerIds = new Map();
    this._cachedEnemyIds = new Map();
    this._cachedBulletIds = new Map();
    this._playerIdCounter = 1;
    this._enemyIdCounter = 1;
    this._bulletIdCounter = 1;
    this._idMapNeedsUpdate = true;
    this._updateCounter = 0;
    this._unusedMapTimeout = 5;
    this._mapLastAccessed = new Map();
  }
  
  async loadMapIfNeeded(mapId) {
    this._mapLastAccessed.set(mapId, Date.now());
    
    if (!this.mapGrids.has(mapId) || !this.mapEnemies.has(mapId)) {
      const map = this.mapManager.getMapById(mapId);
      if (!map) {
        console.error(`Failed to load map: ${mapId}. Map not found.`);
        return null;
      }

      console.log(`Loading map resources for ${mapId}...`);
      const grid = initializeGridWithMap(map);
      this.mapGrids.set(mapId, grid);

      this.mapEnemies.set(mapId, new Map());
      this.mapBullets.set(mapId, new Map());
      this.spawnEnemiesForMap(mapId, map, grid);
      console.log(`Map resources for ${mapId} loaded.`);
      return map;
    }
    return this.mapManager.getMapById(mapId);
  }
  
  spawnEnemiesForMap(mapId, map, grid) {
    if (!map || !grid) {
      console.error(`Cannot spawn enemies for ${mapId}, map or grid missing.`);
      return;
    }
    const enemiesOnThisMap = this.mapEnemies.get(mapId);
    if (!enemiesOnThisMap) {
      console.error(`Enemy map not initialized for ${mapId}`);
      return;
    }

    const { spawnTileType, types } = map.enemyConfig;
    let totalEnemiesSpawned = 0;

    for (const [type, config] of Object.entries(types)) {
      const { count, radius, minSpeed, maxSpeed } = config;
      
      if (type === "basic") {
        for (let i = 0; i < count; i++) {
          const spawnPos = map.getValidSpawnPosition(spawnTileType, radius, grid);
          if (!spawnPos) continue;

          const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
          const enemy = new Enemy(spawnPos.x, spawnPos.y, radius, speed, 1);
          
          enemy.addToGrid(grid);
          enemiesOnThisMap.set(enemy.id, enemy);
          totalEnemiesSpawned++;
        }
      } else if (type === "sniper") {
        for (let i = 0; i < count; i++) {
          const spawnPos = map.getValidSpawnPosition(spawnTileType, radius, grid);
          if (!spawnPos) continue;

          const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
          const sniper = new Sniper(
            spawnPos.x, 
            spawnPos.y, 
            radius, 
            speed,
            config.detectionRange,
            config.shootingRange,
            config.maxShootCooldown,
            config.bulletRadius,
            config.bulletSpeed
          );
          
          sniper.addToGrid(grid);
          enemiesOnThisMap.set(sniper.id, sniper);
          totalEnemiesSpawned++;
        }
      } else if (type === "dasher") {
        for (let i = 0; i < count; i++) {
          const spawnPos = map.getValidSpawnPosition(spawnTileType, radius, grid);
          if (!spawnPos) continue;

          const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
          const dasher = new Dasher(
            spawnPos.x, 
            spawnPos.y, 
            radius, 
            speed,
            config.timeToPrepare,
            config.timeToDash,
            config.timeBetweenDashes
          );
          
          dasher.addToGrid(grid);
          enemiesOnThisMap.set(dasher.id, dasher);
          totalEnemiesSpawned++;
        }
      } else if (type === "homing") {
        for (let i = 0; i < count; i++) {
          const spawnPos = map.getValidSpawnPosition(spawnTileType, radius, grid);
          if (!spawnPos) continue;

          const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
          const homing = new Homing(
            spawnPos.x, 
            spawnPos.y, 
            radius, 
            speed,
            config.turnIncrement,
            config.homeRange
          );
          
          homing.addToGrid(grid);
          enemiesOnThisMap.set(homing.id, homing);
          totalEnemiesSpawned++;
        }
      } else if (type === "void_crawler") {
        for (let i = 0; i < count; i++) {
          const spawnPos = map.getValidSpawnPosition(spawnTileType, radius, grid);
          if (!spawnPos) continue;

          const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
          const voidCrawler = new VoidCrawler(
            spawnPos.x, 
            spawnPos.y, 
            radius, 
            speed,
            config.turnIncrement,
            config.homeRange
          );
          
          voidCrawler.addToGrid(grid);
          enemiesOnThisMap.set(voidCrawler.id, voidCrawler);
          totalEnemiesSpawned++;
        }
      } else if (type === "wall") {
        const regions = map.findConnectedRegions(1);
        let wallsSpawned = 0;
        
        const moveClockwise = config.moveClockwise !== undefined ? config.moveClockwise : true;
        const patternAlternate = config.patternAlternate !== undefined ? config.patternAlternate : false;
        const initialSide = config.initialSide !== undefined ? config.initialSide : 0;
        
        regions.sort((a, b) => {
          const perimeterA = 2 * ((a.maxX - a.minX + 1) + (a.maxY - a.minY + 1));
          const perimeterB = 2 * ((b.maxX - b.minX + 1) + (b.maxY - b.minY + 1));
          return perimeterB - perimeterA;
        });
        
        let totalPerimeter = 0;
        const regionPerimeters = regions.map(region => {
          const width = (region.maxX - region.minX + 1) * map.tileSize;
          const height = (region.maxY - region.minY + 1) * map.tileSize;
          const perimeter = 2 * (width + height);
          totalPerimeter += perimeter;
          return { region, perimeter };
        });
        
        const minViablePerimeter = radius * 10;
        
        for (const { region, perimeter } of regionPerimeters) {
          if (perimeter < minViablePerimeter) {
            console.log(`Region too small (perimeter: ${perimeter}) for wall placement, skipping`);
            continue;
          }
          
          const regionWallCount = Math.max(1, Math.floor((perimeter / totalPerimeter) * count));
          
          if (region.tiles.length < 4) continue;
          
          const minX = Math.min(...region.tiles.map(t => t.x));
          const maxX = Math.max(...region.tiles.map(t => t.x));
          const minY = Math.min(...region.tiles.map(t => t.y));
          const maxY = Math.max(...region.tiles.map(t => t.y));
          
          const boundaryX = minX * map.tileSize;
          const boundaryY = minY * map.tileSize;
          const boundaryWidth = (maxX - minX + 1) * map.tileSize;
          const boundaryHeight = (maxY - minY + 1) * map.tileSize;
          
          const minSpacing = radius * 3;
          
          const regionPerimeter = 2 * (boundaryWidth + boundaryHeight);
          const maxWallsWithSpacing = Math.floor(regionPerimeter / minSpacing);
          
          if (maxWallsWithSpacing < 2) {
            console.log(`Region can only fit ${maxWallsWithSpacing} walls with proper spacing, skipping`);
            continue;
          }
              
          const wallsForThisRegion = Math.min(regionWallCount, maxWallsWithSpacing, count - wallsSpawned);
          
          const actualSpacing = regionPerimeter / wallsForThisRegion;
          
          const tempWalls = [];
          for (let i = 0; i < wallsForThisRegion; i++) {
            const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
            const wallMoveClockwise = patternAlternate ? (i % 2 === 0 ? moveClockwise : !moveClockwise) : moveClockwise;
            const wallInitialSide = initialSide;
            
            const wall = new Wall(
              0, 
              0, 
              radius,
              speed,
              boundaryX,
              boundaryY,
              boundaryWidth,
              boundaryHeight,
              i, // wallIndex
              wallsForThisRegion,
              wallMoveClockwise,
              wallInitialSide,
              actualSpacing
            );
            
            tempWalls.push(wall);
          }
          
          const validWalls = [];
          for (const wall of tempWalls) {
            let overlaps = false;
            
            for (const validWall of validWalls) {
              const dx = wall.x - validWall.x;
              const dy = wall.y - validWall.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance < wall.radius + validWall.radius) {
                overlaps = true;
                break;
              }
            }
            
            if (!overlaps) {
              validWalls.push(wall);
            }
          }
          
          for (const wall of validWalls) {
            wall.addToGrid(grid);
            enemiesOnThisMap.set(wall.id, wall);
            wallsSpawned++;
          }
          
          console.log(`Added ${validWalls.length} wall enemies to region (requested: ${wallsForThisRegion})`);
          
          if (wallsSpawned >= count) break;
        }
        
        totalEnemiesSpawned += wallsSpawned;
      }
    }
    
    console.log(`Spawned ${totalEnemiesSpawned} enemies for map ${mapId} (Types: ${Object.keys(types).join(', ')})`);
  }
  
  async addPlayer(player, connection, initialMapId = 'map1') {
    player.currentMapId = initialMapId;
    await this.loadMapIfNeeded(initialMapId);

    this.players.set(player.id, player);
    this.connections.set(player.id, connection);
    
    this.broadcastNewPlayer(player);
    this._idMapNeedsUpdate = true;
  }
  
  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      this.connections.delete(playerId);
      this._cachedPlayerIds.delete(player.id);
      this._idMapNeedsUpdate = true;
      this.broadcastPlayerLeave(playerId, player.currentMapId);
    }
  }
  
  updatePlayerDirection(playerId, mouseX, mouseY) {
    const player = this.players.get(playerId);
    if (player) {
      player.setTarget(mouseX, mouseY);
    }
  }
  
  start() {
    this.updateInterval = setInterval(() => this.update(), 16);
  }
  
  stop() {
    clearInterval(this.updateInterval);
  }
  
  update() {
    const currentTime = Date.now();
    this.lastUpdateTime = currentTime;
    
    if (this._updateCounter % 1800 === 0) {
      this.cleanupUnusedMaps();
    }
    
    for (const [playerId, player] of this.players) {
      const mapId = player.currentMapId;
      const map = this.mapManager.getMapById(mapId);
      const grid = this.mapGrids.get(mapId);

      if (mapId) {
        this._mapLastAccessed.set(mapId, currentTime);
      }

      if (!map || !grid) {
        console.warn(`Player ${playerId} on unloaded map ${mapId}. Skipping update.`);
        continue;
      }
      player.update(map, this);
    }
    
    for (const [mapId, enemiesOnThisMap] of this.mapEnemies) {
      const map = this.mapManager.getMapById(mapId);
      const grid = this.mapGrids.get(mapId);
      if (!map || !grid) {
        console.warn(`Skipping enemy updates for unloaded map ${mapId}.`);
        continue;
      }

      this.currentMapId = mapId;
      
      for (const [enemyId, enemy] of enemiesOnThisMap) {
        if (enemy instanceof Sniper) {
          enemy.update(map, grid, this);
        } else if (enemy instanceof Dasher) {
          enemy.update(map, grid, this);
        } else if (enemy instanceof Homing) {
          enemy.update(map, grid, this);
        } else if (enemy instanceof VoidCrawler) {
          enemy.update(map, grid, this);
        } else if (enemy instanceof Wall) {
          enemy.update(map, grid, this);
        } else {
          enemy.update(map, grid);
        }
      }

      const bulletsOnThisMap = this.mapBullets.get(mapId) || new Map();
      for (const [bulletId, bullet] of bulletsOnThisMap) {
        if (!bullet.isActive) {
          bullet.removeFromGrid(grid);
          bulletsOnThisMap.delete(bulletId);
          continue;
        }
        bullet.update(map, grid);
      }
    }
    
    this.checkCollisions();
    
    this.broadcastGameState();
    
    this._updateCounter++;

    if (this._updateCounter % 1000 === 0) {
      this.cleanupCachedIds();
    }
  }
  
  checkCollisions() {
    const playersByMap = new Map();
    for (const player of this.players.values()) {
      if (!playersByMap.has(player.currentMapId)) {
        playersByMap.set(player.currentMapId, []);
      }
      playersByMap.get(player.currentMapId).push(player);
    }

    for (const [mapId, playersOnThisMap] of playersByMap) {
      const grid = this.mapGrids.get(mapId);
      const enemiesOnThisMap = this.mapEnemies.get(mapId);
      const bulletsOnThisMap = this.mapBullets.get(mapId) || new Map();
      const currentMap = this.mapManager.getMapById(mapId);

      if (!grid || !enemiesOnThisMap || !currentMap) continue;

      for (const player of playersOnThisMap) {
        if (player.isDead) continue;

        const queryRadius = player.radius + 30;
        const nearbyEntities = grid.queryArea(player.x, player.y, queryRadius);
        let wasHit = false;

        for (const entityId of nearbyEntities) {
          const enemy = enemiesOnThisMap.get(entityId);
          if (!enemy) continue;
          
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const distSquared = dx * dx + dy * dy;
          const radiusSum = player.radius + enemy.radius;
          
          if (distSquared < radiusSum * radiusSum) {
            player.hitByEnemy();
            wasHit = true;
            break;
          }
        }
        
        if (!wasHit) {
          for (const entityId of nearbyEntities) {
            const bullet = bulletsOnThisMap.get(entityId);
            if (!bullet || !bullet.isActive) continue;
            
            const dx = player.x - bullet.x;
            const dy = player.y - bullet.y;
            const distSquared = dx * dx + dy * dy;
            const radiusSum = player.radius + bullet.radius;
            
            if (distSquared < radiusSum * radiusSum) {
              player.hitByEnemy();
              bullet.isActive = false;
              break;
            }
          }
        }
      }
      
      const alivePlayers = [];
      const deadPlayers = [];
      
      for (const player of playersOnThisMap) {
        if (player.isDead) {
          deadPlayers.push(player);
        } else {
          alivePlayers.push(player);
        }
      }
      
      if (deadPlayers.length > 0 && alivePlayers.length > 0) {
        for (const deadPlayer of deadPlayers) {
          const nearbyEntities = grid.queryArea(deadPlayer.x, deadPlayer.y, deadPlayer.radius * 2);
          
          for (const alivePlayer of alivePlayers) {
            const dx = deadPlayer.x - alivePlayer.x;
            const dy = deadPlayer.y - alivePlayer.y;
            const distSquared = dx * dx + dy * dy;
            const radiusSum = deadPlayer.radius + alivePlayer.radius;
            
            if (distSquared < radiusSum * radiusSum) {
              deadPlayer.reviveByPlayer();
              break;
            }
          }
        }
      }
    }
  }
  
  async handlePlayerTeleport(playerId, teleporterUsed) {
    const player = this.players.get(playerId);
    if (!player) return;
    const teleporterCode = teleporterUsed.code;
    const currentMapId = player.currentMapId;
    
    console.log(`[GAME] Handling teleport for player ${playerId.substring(0, 8)} with code: ${teleporterCode}`);

    if (!teleporterCode) {
      console.log(`[GAME] Player ${playerId.substring(0, 8)} used a teleporter with no code. Ignoring.`);
      return;
    }
    let destinationMapId = null;
    for (const [mapId, map] of Object.entries(this.mapManager.maps)) {
      if (mapId !== currentMapId) {
        const teleporter = map.getTeleporterByCode(teleporterCode);
        if (teleporter) {
          destinationMapId = mapId;
          break;
        }
      }
    }

    if (!destinationMapId) {
      console.log(`[GAME] Player ${playerId.substring(0, 8)} used teleporter with code ${teleporterCode} on ${currentMapId}, but no destination map found.`);
      return;
    }
    const destinationMap = await this.loadMapIfNeeded(destinationMapId);
    if (!destinationMap) {
      console.error(`[GAME] Teleport failed for player ${playerId.substring(0, 8)}: Destination map ${destinationMapId} could not be loaded.`);
      return;
    }
    const targetTeleporter = destinationMap.getTeleporterByCode(teleporterCode);
    if (!targetTeleporter) {
      console.error(`[GAME] Teleport failed for player ${playerId.substring(0, 8)}: No teleporter with code ${teleporterCode} found on map ${destinationMapId}.`);
      return;
    }
    const newX = targetTeleporter.tileX * destinationMap.tileSize + destinationMap.tileSize / 2;
    const newY = targetTeleporter.tileY * destinationMap.tileSize + destinationMap.tileSize / 2;
    const oldMapId = player.currentMapId;
    player.x = newX;
    player.y = newY;
    player.currentMapId = destinationMapId;
    player.lastTeleporterCodeUsed = teleporterCode;
    player.isOnTeleporter = true;
    player.isFullyInsideTeleporter = true;
    player.wasFullyOutsideTeleporter = false;
    player.canTeleport = false;
    player.teleporterCooldown = 60;

    console.log(`[GAME] Player ${playerId.substring(0, 8)} teleported from ${oldMapId} to ${destinationMapId} at (${newX}, ${newY}) via teleporter with code ${teleporterCode}`);
    const connection = this.connections.get(playerId);
    if (connection && connection.readyState === 1) {
      const enemiesOnNewMap = this.mapEnemies.get(destinationMapId) || new Map();
      const serializedEnemies = Array.from(enemiesOnNewMap.values()).map(e => e.serialize());
      
      const bulletsOnNewMap = this.mapBullets.get(destinationMapId) || new Map();
      const serializedBullets = Array.from(bulletsOnNewMap.values())
        .filter(b => b.isActive)
        .map(b => b.serialize());
      
      const mapChangeData = {
        type: 'mapChange',
        newMapId: destinationMapId,
        map: destinationMap.tiles,
        mapWidth: destinationMap.width,
        mapHeight: destinationMap.height,
        tileSize: destinationMap.tileSize,
        enemyTypes: ENEMY_TYPES,
        enemies: serializedEnemies,
        bullets: serializedBullets,
        playerData: player.serialize()
      };
      const message = JSON.stringify(mapChangeData);
      try {
        const compressed = zlib.gzipSync(message);
        connection.send(compressed);
      } catch (e) {
        console.error("Failed to compress and send mapChange data:", e);
        connection.send(message);
      }
    }
    this._idMapNeedsUpdate = true;
  }
  
  broadcastGameState() {
    this._updateCounter++;
    const needsFullIdMapForAll = this._idMapNeedsUpdate || this._updateCounter < 5;

    if (needsFullIdMapForAll) {
      this._cachedPlayerIds.clear();
      this._cachedEnemyIds.clear();
      this._cachedBulletIds.clear();
      this._playerIdCounter = 1;
      this._enemyIdCounter = 1;
      this._bulletIdCounter = 1;
      
      for (const player of this.players.values()) {
        if (!this._cachedPlayerIds.has(player.id)) {
          this._cachedPlayerIds.set(player.id, this._playerIdCounter++);
        }
      }
      for (const enemiesOnMap of this.mapEnemies.values()) {
        for (const enemy of enemiesOnMap.values()) {
          if (!this._cachedEnemyIds.has(enemy.id)) {
            this._cachedEnemyIds.set(enemy.id, this._enemyIdCounter++);
          }
        }
      }
      for (const bulletsOnMap of this.mapBullets.values()) {
        for (const bullet of bulletsOnMap.values()) {
          if (!this._cachedBulletIds.has(bullet.id)) {
            this._cachedBulletIds.set(bullet.id, this._bulletIdCounter++);
          }
        }
      }
    }
    
    for (const [playerId, connection] of this.connections) {
      if (connection.readyState !== 1) continue;

      const player = this.players.get(playerId);
      if (!player) continue;

      const playerMapId = player.currentMapId;
      
      const playersOnThisMap = [];
      for (const p of this.players.values()) {
        if (p.currentMapId === playerMapId) {
          playersOnThisMap.push(p);
        }
      }

      const enemiesToSerialise = this.mapEnemies.get(playerMapId) || new Map();
      const bulletsToSerialise = this.mapBullets.get(playerMapId) || new Map();

      const gameState = {
        t: 'u',
        p: playersOnThisMap.map(p => [
          this._cachedPlayerIds.get(p.id) || p.id,
          Math.round(p.x),
          Math.round(p.y),
          p.isDead ? 1 : 0
        ]),
        e: Array.from(enemiesToSerialise.values()).map(e => [
          this._cachedEnemyIds.get(e.id) || e.id,
          e.type,
          Math.round(e.x),
          Math.round(e.y),
          e.radius
        ]),
        b: Array.from(bulletsToSerialise.values())
          .filter(b => b.isActive)
          .map(b => [
            this._cachedBulletIds.get(b.id) || b.id,
            Math.round(b.x),
            Math.round(b.y),
            b.radius
          ])
      };

      if (needsFullIdMapForAll) {
        gameState.idMap = { p: {}, e: {}, b: {} };
        for (const p of playersOnThisMap) {
          const shortId = this._cachedPlayerIds.get(p.id);
          if (shortId) gameState.idMap.p[shortId] = p.id;
        }
        for (const e of enemiesToSerialise.values()) {
          const shortId = this._cachedEnemyIds.get(e.id);
          if (shortId) gameState.idMap.e[shortId] = e.id;
        }
        for (const b of bulletsToSerialise.values()) {
          if (!b.isActive) continue;
          const shortId = this._cachedBulletIds.get(b.id);
          if (shortId) gameState.idMap.b[shortId] = b.id;
        }
      }
      
      const message = JSON.stringify(gameState);
      try {
        const compressed = zlib.gzipSync(message);
        connection.send(compressed);
      } catch (e) {
        console.error("Failed to compress and send game state:", e);
      }
    }
    if (needsFullIdMapForAll) {
      this._idMapNeedsUpdate = false;
    }
  }
  
  broadcastNewPlayer(newPlayer) {
    const messageData = {
      type: 'newPlayer',
      player: newPlayer.serialize()
    };
    const message = JSON.stringify(messageData);
    const compressed = zlib.gzipSync(message);

    for (const [playerId, connection] of this.connections) {
      const existingPlayer = this.players.get(playerId);
      if (existingPlayer && existingPlayer.id !== newPlayer.id && existingPlayer.currentMapId === newPlayer.currentMapId) {
        if (connection.readyState === 1) {
          connection.send(compressed);
        }
      }
    }
  }
  
  broadcastPlayerLeave(leftPlayerId, mapIdOfLeftPlayer) {
    const messageData = {
      type: 'playerLeave',
      playerId: leftPlayerId
    };
    const message = JSON.stringify(messageData);
    const compressed = zlib.gzipSync(message);

    for (const [playerId, connection] of this.connections) {
      const existingPlayer = this.players.get(playerId);
      if (existingPlayer && existingPlayer.currentMapId === mapIdOfLeftPlayer) {
        if (connection.readyState === 1) {
          connection.send(compressed);
        }
      }
    }
  }

  cleanupUnusedMaps() {
    const currentTime = Date.now();
    const activeMapIds = new Set();
    
    for (const player of this.players.values()) {
      if (player.currentMapId) {
        activeMapIds.add(player.currentMapId);
      }
    }
    
    for (const [mapId, lastAccessed] of this._mapLastAccessed.entries()) {
      if (activeMapIds.has(mapId)) continue;
      
      const secondsSinceLastAccess = (currentTime - lastAccessed) / 1000;
      if (secondsSinceLastAccess > this._unusedMapTimeout) {
        console.log(`Cleaning up unused map: ${mapId} (unused for ${Math.floor(secondsSinceLastAccess)} seconds)`);
        
        if (this.mapGrids.has(mapId)) {
          const grid = this.mapGrids.get(mapId);
          grid.clear();
          this.mapGrids.delete(mapId);
        }
        
        if (this.mapEnemies.has(mapId)) {
          this.mapEnemies.delete(mapId);
        }
        
        if (this.mapBullets.has(mapId)) {
          this.mapBullets.delete(mapId);
        }
        
        this._mapLastAccessed.delete(mapId);
      }
    }
  }

  cleanupCachedIds() {
    for (const [id, shortId] of this._cachedPlayerIds.entries()) {
      if (!this.players.has(id)) {
        this._cachedPlayerIds.delete(id);
      }
    }
    
    const activeEnemyIds = new Set();
    for (const enemiesMap of this.mapEnemies.values()) {
      for (const enemyId of enemiesMap.keys()) {
        activeEnemyIds.add(enemyId);
      }
    }
    
    for (const [id] of this._cachedEnemyIds.entries()) {
      if (!activeEnemyIds.has(id)) {
        this._cachedEnemyIds.delete(id);
      }
    }
    
    const activeBulletIds = new Set();
    for (const bulletsMap of this.mapBullets.values()) {
      for (const bulletId of bulletsMap.keys()) {
        activeBulletIds.add(bulletId);
      }
    }
    
    for (const [id] of this._cachedBulletIds.entries()) {
      if (!activeBulletIds.has(id)) {
        this._cachedBulletIds.delete(id);
      }
    }
  }
}

module.exports = { Game }; 