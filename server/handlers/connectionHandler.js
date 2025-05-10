const zlib = require('zlib');
const { Player } = require('../../game/player');
const { ENEMY_TYPES } = require('../../game/enemy');
const config = require('../config');
const { handlePlayerMessage } = require('./messageHandler');

async function handleNewConnection(ws, req, game, broadcast) {
  const initialMapId = config.DEFAULT_MAP_ID; 
  let player; 
  
  try {
    const initialMap = game.mapManager.getMapById(initialMapId);
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

    const playerCurrentMap = game.mapManager.getMapById(player.currentMapId);
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

    ws.on('message', async (rawMessage) => {
      await handlePlayerMessage(game, ws, player, rawMessage, broadcast);
    });

    ws.on('close', async () => {
      await handleConnectionClose(game, player);
    });

    ws.on('error', (error) => {
      handleConnectionError(game, player, error);
    });

    return player;
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
    return null;
  }
}

async function handleConnectionClose(game, player) {
  if (player && player.id) {
    try {
      await game.removePlayer(player.id);
    } catch (removalErr) {
      console.error('Error removing player on close:', removalErr);
    }
  }
}

function handleConnectionError(game, player, error) {
  console.error(`WebSocket error for player ${player ? player.id : 'unknown'}:`, error);
  if (player && player.id) {
    const removePlayerResult = game.removePlayer(player.id);
    if (removePlayerResult && typeof removePlayerResult.catch === 'function') {
      removePlayerResult.catch(err => console.error('Error removing player on WebSocket error:', err));
    } else if (removePlayerResult instanceof Promise) {
      removePlayerResult.then(null, err => console.error('Error removing player on WebSocket error (via .then):', err));
    }
  }
}

module.exports = {
  handleNewConnection,
  handleConnectionClose,
  handleConnectionError
}; 