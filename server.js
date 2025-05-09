const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const zlib = require('zlib');
const { Player } = require('./game/player');
const { Game } = require('./game/game');
const { MapManager } = require('./game/map');
const { ENEMY_TYPES } = require('./game/enemy');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

const staticPath = process.env.NODE_ENV === 'production' 
  ? path.join(__dirname, 'public')
  : path.join(__dirname, 'public');

app.use(express.static(staticPath, {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

const mapManager = new MapManager();
const game = new Game(mapManager);

function broadcast(message, excludeWs = null) {
  const compressed = zlib.gzipSync(message);
  
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(compressed);
    }
  });
}

function parseMessage(message) {
  if (Buffer.isBuffer(message)) {
    try {
      const decompressed = zlib.gunzipSync(message);
      return JSON.parse(decompressed.toString());
    } catch (err) {
      try {
        const decompressed = zlib.inflateSync(message);
        return JSON.parse(decompressed.toString());
      } catch (err2) {
        return JSON.parse(message.toString());
      }
    }
  } else {
    return JSON.parse(message.toString());
  }
}

wss.on('connection', async (ws, req) => {
  const initialMapId = 'map1';
  const initialMap = mapManager.getMapById(initialMapId);
  if (!initialMap) {
    ws.close(1011, 'Server error: Default map not available.');
    return;
  }

  await game.loadMapIfNeeded(initialMapId);

  const spawnPos = initialMap.getRandomTypePosition(2);
  if (!spawnPos) {
    ws.close(1011, 'Server error: No spawn on default map.');
    return;
  }

  const player = new Player(spawnPos.x, spawnPos.y, 25, "#000000");
  await game.addPlayer(player, ws, initialMapId);

  ws.on('message', (message) => {
    try {
      const data = parseMessage(message);
      
      if (data.type === 'mousemove' || (data.type === 'm' && data.x !== undefined && data.y !== undefined)) {
        game.updatePlayerDirection(player.id, data.x, data.y);
      } else if (data.type === 'ping') {
        const response = JSON.stringify({
          type: 'pong',
          clientTime: data.time,
          serverTime: Date.now()
        });
        ws.send(response);
      } else if (data.type === 'requestIdMap') {
        game._idMapNeedsUpdate = true;
      } else if (data.type === 'chat') {
        if (data.message === '/reset') {
          const currentMap = mapManager.getMapById(player.currentMapId);
          if (currentMap) {
            const newSpawnPos = currentMap.getRandomTypePosition(2);
            if (newSpawnPos) {
              player.x = newSpawnPos.x;
              player.y = newSpawnPos.y;
              player.reset();
              
              ws.send(JSON.stringify({
                type: 'respawn',
                x: newSpawnPos.x,
                y: newSpawnPos.y,
                currentMapId: player.currentMapId
              }));
            } else {
            }
          } else {
          }
        } else {
          const chatMessage = {
            type: 'chat',
            sender: `Player ${player.id.substring(0, 6)}`,
            message: data.message
          };
          ws.send(JSON.stringify(chatMessage));
          broadcast(JSON.stringify(chatMessage), ws);
        }
      }
    } catch (e) {
      console.error("failed to parse message:", e);
    }
  });

  ws.on('close', () => {
    game.removePlayer(player.id);
  });

  const playerCurrentMap = mapManager.getMapById(player.currentMapId);
 
  if (!playerCurrentMap) {
    game.removePlayer(player.id);
    ws.close(1011, 'Server error: map data unavailable for player.');
    return;
  }

  const enemiesOnPlayerMap = game.mapEnemies.get(player.currentMapId) || new Map();
  const serializedEnemies = Array.from(enemiesOnPlayerMap.values()).map(enemy => enemy.serialize());

  console.log(`New player ${player.id} joined on map ${player.currentMapId}`);

  const initData = JSON.stringify({
    type: 'init',
    id: player.id,
    map: playerCurrentMap.tiles,
    mapWidth: playerCurrentMap.width,
    mapHeight: playerCurrentMap.height,
    tileSize: playerCurrentMap.tileSize,
    enemyTypes: ENEMY_TYPES,
    enemies: serializedEnemies,
    playerData: player.serialize()
  });

  game._idMapNeedsUpdate = true;

  const compressed = zlib.gzipSync(initData);
  ws.send(compressed);
});

game.start();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
