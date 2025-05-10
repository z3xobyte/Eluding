const zlib = require('zlib');
const config = require('../config');

async function parseMessageContents(messageData) {
  if (Buffer.isBuffer(messageData)) {
    if (messageData.length === 9 && messageData[0] === config.BINARY_MESSAGE_MOUSE_MOVE) {
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

function handleMouseMove(game, playerId, x, y) {
  game.updatePlayerDirection(playerId, x, y);
}

function handlePing(ws, clientTime) {
  const response = JSON.stringify({
    type: 'pong',
    clientTime: clientTime,
    serverTime: Date.now()
  });
  ws.send(response);
}

function handleChatMessage(game, ws, player, message, broadcast) {
  if (message && message.trim() === '/reset') {
    handleResetCommand(game, ws, player);
  } else if (message) {
    const chatMessageObject = {
      type: 'chat',
      sender: `Player ${player.id.substring(0, 6)}`,
      message: message.substring(0, config.MAX_CHAT_MESSAGE_LENGTH)
    };
    const chatMessageString = JSON.stringify(chatMessageObject);
    ws.send(chatMessageString);
    broadcast(chatMessageString, ws);
  }
}

function handleResetCommand(game, ws, player) {
  const currentMap = game.mapManager.getMapById(player.currentMapId);
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
}

async function handlePlayerMessage(game, ws, player, rawMessage, broadcast) {
  try {
    const data = await parseMessageContents(rawMessage);
    
    if (data.type === 'm') {
      handleMouseMove(game, player.id, data.x, data.y);
    } else if (data.type === 'ping') {
      handlePing(ws, data.time);
    } else if (data.type === 'requestIdMap') {
      game._idMapNeedsUpdate = true;
    } else if (data.type === 'chat') {
      handleChatMessage(game, ws, player, data.message, broadcast);
    }
  } catch (e) {
    console.error("Failed to parse or handle message:", e);
  }
}

module.exports = {
  handlePlayerMessage,
  parseMessageContents
}; 