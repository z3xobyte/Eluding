const { Enemy, Sniper, Dasher, Homing, VoidCrawler, Wall } = require('./enemy');

class EnemySpawner {
  constructor(mapManager, mapGrids, mapEnemies) {
    this.mapManager = mapManager;
    this.mapGrids = mapGrids;
    this.mapEnemies = mapEnemies;
  }

  spawnEnemiesForMap(mapId, map, grid) {
    if (!map || !grid) {
      console.error(`cannot spawn enemies for ${mapId} map or grid missing.`);
      return;
    }
    const enemiesOnThisMap = this.mapEnemies.get(mapId);
    if (!enemiesOnThisMap) {
      console.error(`enemy map not initialized for ${mapId}`);
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
}

module.exports = { EnemySpawner }; 