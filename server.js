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

const staticPath = path.join(__dirname, 'public');
const BINARY_MESSAGE_MOUSE_MOVE = 1;

app.use(express.static(staticPath, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    }
  }
}));

const mapManager = new MapManager();
const game = new Game(mapManager);

function broadcast(stringMessage, excludeWs = null) {
  const compressedMessage = zlib.gzipSync(Buffer.from(stringMessage));
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      try {
        client.send(compressedMessage, { binary: true });
      } catch (e) {
        console.error('Failed to send message to client:', e);
      }
    }
  });
}

async function parseMessageContents(messageData) {
  if (Buffer.isBuffer(messageData)) {
    if (messageData.length === 9 && messageData[0] === BINARY_MESSAGE_MOUSE_MOVE) {
      return {
        type: 'm',
        x: messageData.readInt32LE(1),
        y: messageData.readInt32LE(5)
      };
    }
    
    let textData;
    try {
      textData = await new Promise((resolve, reject) => {
        zlib.gunzip(messageData, (err, buffer) => err ? reject(err) : resolve(buffer.toString('utf8')));
      });
    } catch (gunzipError) {
      try {
        textData = await new Promise((resolve, reject) => {
          zlib.inflate(messageData, (err, buffer) => err ? reject(err) : resolve(buffer.toString('utf8')));
        });
      } catch (inflateError) {
        textData = messageData.toString('utf8');
      }
    }
    return JSON.parse(textData);
  } else {
    return JSON.parse(messageData.toString('utf8'));
  }
}

wss.on('connection', async (ws, req) => {
  const initialMapId = 'map1'; 
  let player; 
  try {
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

    player = new Player(spawnPos.x, spawnPos.y, 25, "#000000");
    await game.addPlayer(player, ws, initialMapId);

    const playerCurrentMap = mapManager.getMapById(player.currentMapId);
    if (!playerCurrentMap) {
      await game.removePlayer(player.id); 
      ws.close(1011, 'Server error: map data unavailable for player.');
      return;
    }

    const enemiesOnPlayerMap = game.mapEnemies.get(player.currentMapId) || new Map();
    const serializedEnemies = Array.from(enemiesOnPlayerMap.values()).map(enemy => enemy.serialize());

    const initDataString = JSON.stringify({
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

    const compressedInitData = zlib.gzipSync(Buffer.from(initDataString));
    ws.send(compressedInitData, { binary: true });

  } catch (error) {
    console.error('Error during player connection setup:', error);
    if (player && player.id) {
      try {
        await game.removePlayer(player.id);
      } catch (removalErr) {
        console.error('Error removing player during setup failure:', removalErr);
      }
    }
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1011, 'Server error during connection setup.');
    }
    return;
  }

  ws.on('message', async (rawMessage) => {
    try {
      const data = await parseMessageContents(rawMessage);
      
      if (data.type === 'm') { 
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
        if (data.message && data.message.trim() === '/reset') {
          const currentMap = mapManager.getMapById(player.currentMapId);
          if (currentMap) {
            const newSpawnPos = currentMap.getRandomTypePosition(2);
            if (newSpawnPos) {
              player.x = newSpawnPos.x;
              player.y = newSpawnPos.y;
              player.reset(); 
              
              ws.send(JSON.stringify({
                type: 'respawn',
                id: player.id,
                x: newSpawnPos.x,
                y: newSpawnPos.y,
                currentMapId: player.currentMapId
              }));
            }
          }
        } else if (data.message) {
          const chatMessageObject = {
            type: 'chat',
            sender: `Player ${player.id.substring(0, 6)}`,
            message: data.message.substring(0, 256) 
          };
          const chatMessageString = JSON.stringify(chatMessageObject);
          ws.send(chatMessageString); 
          broadcast(chatMessageString, ws);
        }
      }
    } catch (e) {
      console.error("Failed to parse or handle message:", e);
    }
  });

  ws.on('close', async () => {
    if (player && player.id) {
      try {
        await game.removePlayer(player.id);
      } catch (removalErr) {
        console.error('Error removing player on close:', removalErr);
      }
    }
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for player ${player ? player.id : 'unknown'}:`, error);
    if (player && player.id) {
        const removePlayerResult = game.removePlayer(player.id);
        if (removePlayerResult && typeof removePlayerResult.catch === 'function') {
            removePlayerResult.catch(err => console.error('Error removing player on WebSocket error:', err));
        } else if (removePlayerResult instanceof Promise) {
             removePlayerResult.then(null, err => console.error('Error removing player on WebSocket error (via .then):', err));
        }
    }
  });
});

game.start();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});