export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
    this.backgroundPattern = null;
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    this.tileRenderCache = new Map();
    this.lastCamera = { x: 0, y: 0, width: 0, height: 0 };
    this.dirtyCache = true;
    this.arrowSize = 20;
    this.gridSubdivisions = 2;
  }

  renderMap(map, mapWidth, mapHeight, tileSize, camera) {
    if (this.offscreenCanvas.width !== this.ctx.canvas.width ||
        this.offscreenCanvas.height !== this.ctx.canvas.height) {
      this.offscreenCanvas.width = this.ctx.canvas.width;
      this.offscreenCanvas.height = this.ctx.canvas.height;
      this.dirtyCache = true;
    }

    const cameraChanged =
      this.lastCamera.x !== camera.x ||
      this.lastCamera.y !== camera.y ||
      this.lastCamera.width !== camera.width ||
      this.lastCamera.height !== camera.height;

    if (cameraChanged) {
      this.lastCamera = { ...camera };
      this.dirtyCache = true;
    }

    if (this.dirtyCache) {
      this.offscreenCtx.fillStyle = '#333';
      this.offscreenCtx.fillRect(0, 0, this.offscreenCanvas.width, this.offscreenCanvas.height);

      this.renderContiguousAreas(map, mapWidth, mapHeight, tileSize, camera, 1, 'white', this.offscreenCtx);
      this.renderContiguousAreas(map, mapWidth, mapHeight, tileSize, camera, 2, 'darkgray', this.offscreenCtx);
      this.renderContiguousAreas(map, mapWidth, mapHeight, tileSize, camera, 3, '#ffdd7d', this.offscreenCtx);
      this.renderGridLines(map, mapWidth, mapHeight, tileSize, camera, this.offscreenCtx);

      this.dirtyCache = false;
    }
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    this.ctx.drawImage(this.offscreenCanvas, 0, 0);
  }

  renderContiguousAreas(map, mapWidth, mapHeight, tileSize, camera, tileType, color, targetCtx = this.ctx) {
    const ctx = targetCtx;
    const startCol = Math.max(0, Math.floor(camera.x / tileSize) - 1);
    const endCol = Math.min(mapWidth, Math.floor((camera.x + camera.width) / tileSize) + 1);
    const startRow = Math.max(0, Math.floor(camera.y / tileSize) - 1);
    const endRow = Math.min(mapHeight, Math.floor((camera.y + camera.height) / tileSize) + 1);

    ctx.fillStyle = color;

    for (let y = startRow; y < endRow; y++) {
      let rowStart = -1;

      for (let x = startCol; x <= endCol; x++) {
        const currentTileType = (map[y] && x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) ? map[y][x] : undefined;
        const isMatchingTile = currentTileType === tileType;

        if (isMatchingTile && rowStart === -1) {
          rowStart = x;
        } else if ((!isMatchingTile || x === endCol) && rowStart !== -1) {
          const worldX = rowStart * tileSize;
          const worldY = y * tileSize;
          const blockWidthInTiles = (isMatchingTile && x === endCol) ? (x - rowStart + 1) : (x - rowStart);
          const width = blockWidthInTiles * tileSize;

          const screenPosStart = camera.worldToScreen(worldX, worldY);

          if (screenPosStart.x < this.offscreenCanvas.width &&
              screenPosStart.y < this.offscreenCanvas.height &&
              screenPosStart.x + width > 0 &&
              screenPosStart.y + tileSize > 0) {
            ctx.fillRect(
              Math.floor(screenPosStart.x),
              Math.floor(screenPosStart.y),
              Math.ceil(width),
              Math.ceil(tileSize)
            );
            if (tileType === 3) {
              ctx.save();
              for (let i = 0; i < blockWidthInTiles; i++) {
                const tileMiddleX = screenPosStart.x + (i * tileSize) + (tileSize / 2);
                const tileMiddleY = screenPosStart.y + (tileSize / 2);
            
                ctx.fillStyle = '#d1b255';
                const fontSize = Math.floor(tileSize * 0.65);
                ctx.font = `${fontSize}px Arial`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'alphabetic';
            
                const text = '➜';
                const metrics = ctx.measureText(text);
                const actualHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
                ctx.fillText(text, tileMiddleX, tileMiddleY + (metrics.actualBoundingBoxAscent - actualHeight / 2));
              }
              ctx.restore();
            }
          }
          rowStart = -1;
        }
      }
    }
  }

  renderPlayers(players, camera) {
    if (!players || players.size === 0) return;

    const colorGroups = new Map();
    const currentPlayer = this.getCurrentPlayer(players);

    for (const [, player] of players) {
      if (!player) continue;

      const screenPos = camera.worldToScreen(player.x, player.y);

      if (screenPos.x < -player.radius ||
          screenPos.y < -player.radius ||
          screenPos.x > this.ctx.canvas.width + player.radius ||
          screenPos.y > this.ctx.canvas.height + player.radius) {
        continue;
      }

      const color = player.color || 'white';
      if (!colorGroups.has(color)) {
        colorGroups.set(color, []);
      }
      colorGroups.get(color).push({
        x: screenPos.x,
        y: screenPos.y,
        radius: player.radius,
        isDead: player.isDead
      });
    }

    for (const [color, playersToDraw] of colorGroups) {
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      for (const p of playersToDraw) {
        this.ctx.moveTo(p.x + p.radius, p.y);
        this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      }
      this.ctx.fill();
    }

    this.ctx.strokeStyle = '#800000';
    this.ctx.lineWidth = 2;
    let hasDeadPlayerStrokes = false;
    this.ctx.beginPath();

    for (const [, playersToDraw] of colorGroups) {
        for (const p of playersToDraw) {
            if (p.isDead) {
                this.ctx.moveTo(p.x + p.radius, p.y);
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                hasDeadPlayerStrokes = true;
            }
        }
    }
    if(hasDeadPlayerStrokes) {
        this.ctx.stroke();
    }
    this.ctx.lineWidth = 1;

    if (currentPlayer && !currentPlayer.isDead) {
      this.renderDirectionArrows(players, currentPlayer, camera);
    }
  }

  getCurrentPlayer(players) {
    for (const [id, player] of players) {
      if (window.game && window.game.playerId === id) {
        return player;
      }
    }
    return null;
  }

  renderDirectionArrows(players, currentPlayer, camera) {
    const padding = 50;
    const centerX = this.ctx.canvas.width / 2;
    const centerY = this.ctx.canvas.height / 2;

    for (const [id, player] of players) {
      if ((window.game && window.game.playerId === id) || !player.isDead) {
        continue;
      }

      const screenPos = camera.worldToScreen(player.x, player.y);

      const isVisible = !(
        screenPos.x < -player.radius ||
        screenPos.y < -player.radius ||
        screenPos.x > this.ctx.canvas.width + player.radius ||
        screenPos.y > this.ctx.canvas.height + player.radius
      );

      if (!isVisible) {
        const dx = player.x - currentPlayer.x;
        const dy = player.y - currentPlayer.y;
        const angle = Math.atan2(dy, dx);

        let arrowX, arrowY;

        const minX = padding;
        const maxX = this.ctx.canvas.width - padding;
        const minY = padding;
        const maxY = this.ctx.canvas.height - padding;

        const dirX = Math.cos(angle);
        const dirY = Math.sin(angle);

        let t = Infinity;
        if (Math.abs(dirX) > 1e-6) {
            let t_candidate_x1 = (minX - centerX) / dirX;
            let t_candidate_x2 = (maxX - centerX) / dirX;
            if (t_candidate_x1 > 0) t = Math.min(t, t_candidate_x1);
            if (t_candidate_x2 > 0) t = Math.min(t, t_candidate_x2);
        }
        if (Math.abs(dirY) > 1e-6) {
            let t_candidate_y1 = (minY - centerY) / dirY;
            let t_candidate_y2 = (maxY - centerY) / dirY;
            if (t_candidate_y1 > 0) t = Math.min(t, t_candidate_y1);
            if (t_candidate_y2 > 0) t = Math.min(t, t_candidate_y2);
        }

        arrowX = centerX + dirX * t;
        arrowY = centerY + dirY * t;

        arrowX = Math.max(minX, Math.min(maxX, arrowX));
        arrowY = Math.max(minY, Math.min(maxY, arrowY));

        this.drawArrow(arrowX, arrowY, angle, player.color || '#FF0000');
      }
    }
  }

  drawArrow(x, y, angle, color) {
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(angle);

    this.ctx.beginPath();
    this.ctx.moveTo(this.arrowSize * 0.8, 0);
    this.ctx.lineTo(-this.arrowSize / 2, this.arrowSize * 0.7);
    this.ctx.lineTo(-this.arrowSize / 2, -this.arrowSize * 0.7);
    this.ctx.closePath();

    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.restore();
  }

  renderEnemies(enemies, previousEnemies, lerpAmount, camera) {
    if (!enemies || enemies.size === 0) return;

    this.ctx.lineWidth = 3;
    const fillStyle = '#808080';
    const strokeStyle = '#666666';

    for (const [id, enemy] of enemies) {
      if (!enemy) continue;

      let x, y;
      if ('prevX' in enemy && 'prevY' in enemy) {
        x = enemy.prevX + (enemy.x - enemy.prevX) * lerpAmount;
        y = enemy.prevY + (enemy.y - enemy.prevY) * lerpAmount;
      } else {
        const previousEnemy = previousEnemies.get(id);
        if (previousEnemy) {
          x = previousEnemy.x + (enemy.x - previousEnemy.x) * lerpAmount;
          y = previousEnemy.y + (enemy.y - previousEnemy.y) * lerpAmount;
        } else {
          x = enemy.x;
          y = enemy.y;
        }
      }

      const screenPos = camera.worldToScreen(x, y);

      if (screenPos.x < -enemy.radius ||
          screenPos.y < -enemy.radius ||
          screenPos.x > this.ctx.canvas.width + enemy.radius ||
          screenPos.y > this.ctx.canvas.height + enemy.radius) {
        continue;
      }

      this.ctx.fillStyle = enemy.type === 2 ? '#a05353' : (enemy.color || fillStyle);
      this.ctx.strokeStyle = enemy.outlineColor || strokeStyle;

      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, enemy.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }

    this.ctx.lineWidth = 1;
  }

  renderBullets(bullets, previousBullets, lerpAmount, camera) {
    if (!bullets || bullets.size === 0) return;

    this.ctx.lineWidth = 2;

    for (const [id, bullet] of bullets) {
      if (!bullet) continue;

      let x, y;
      if ('prevX' in bullet && 'prevY' in bullet) {
        x = bullet.prevX + (bullet.x - bullet.prevX) * lerpAmount;
        y = bullet.prevY + (bullet.y - bullet.prevY) * lerpAmount;
      } else {
        const previousBullet = previousBullets.get(id);
        if (previousBullet) {
          x = previousBullet.x + (bullet.x - previousBullet.x) * lerpAmount;
          y = previousBullet.y + (bullet.y - previousBullet.y) * lerpAmount;
        } else {
          x = bullet.x;
          y = bullet.y;
        }
      }

      const screenPos = camera.worldToScreen(x, y);

      if (screenPos.x < -bullet.radius ||
          screenPos.y < -bullet.radius ||
          screenPos.x > this.ctx.canvas.width + bullet.radius ||
          screenPos.y > this.ctx.canvas.height + bullet.radius) {
        continue;
      }

      this.ctx.fillStyle = '#a05353';
      this.ctx.strokeStyle = '#000';

      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, bullet.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }

    this.ctx.lineWidth = 1;
  }

  renderGridLines(map, mapWidth, mapHeight, tileSize, camera, targetCtx = this.ctx) {
    const ctx = targetCtx;
    const startCol = Math.max(0, Math.floor(camera.x / tileSize) - 1);
    const endCol = Math.min(mapWidth, Math.floor((camera.x + camera.width) / tileSize) + 1);
    const startRow = Math.max(0, Math.floor(camera.y / tileSize) - 1);
    const endRow = Math.min(mapHeight, Math.floor((camera.y + camera.height) / tileSize) + 1);
    
    const subTileSize = tileSize / this.gridSubdivisions;
    
    ctx.save();
    const gridColors = {
      1: '#D7D7D7',
      2: '#999999',
      3: '#E6C26F'
    };
    for (let x = startCol; x <= endCol; x++) {
      for (let subX = 0; subX <= this.gridSubdivisions; subX++) {
        const isEdgeGridLine = subX === 0 || subX === this.gridSubdivisions;
        
        const worldX = x * tileSize + subX * subTileSize;
        
        for (let y = startRow; y < endRow; y++) {
          const currentTileType = (map[y] && x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) ? map[y][x] : 0;
          if (currentTileType === 0) continue;
          if (currentTileType === 3 && !isEdgeGridLine) continue;
          let rightTileType = 0;
          if (subX === this.gridSubdivisions && x < mapWidth - 1) {
            rightTileType = (map[y] && x + 1 >= 0 && x + 1 < mapWidth) ? map[y][x + 1] : 0;
          }
          
          const isBoundary = rightTileType !== 0 && rightTileType !== currentTileType && subX === this.gridSubdivisions;
          const lineWidth = isBoundary ? 1 : 2;
          
          ctx.beginPath();
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = gridColors[currentTileType] || '#D7D7D7';
          
          const screenPosStart = camera.worldToScreen(worldX, y * tileSize);
          const screenPosEnd = camera.worldToScreen(worldX, (y + 1) * tileSize);
          
          ctx.moveTo(Math.floor(screenPosStart.x) + 0.5, Math.floor(screenPosStart.y));
          ctx.lineTo(Math.floor(screenPosEnd.x) + 0.5, Math.floor(screenPosEnd.y));
          ctx.stroke();
        }
      }
    }
    for (let y = startRow; y <= endRow; y++) {
      for (let subY = 0; subY <= this.gridSubdivisions; subY++) {
        const isEdgeGridLine = subY === 0 || subY === this.gridSubdivisions;
        
        const worldY = y * tileSize + subY * subTileSize;
        
        for (let x = startCol; x < endCol; x++) {
          const currentTileType = (map[y] && x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) ? map[y][x] : 0;
          if (currentTileType === 0) continue;
          if (currentTileType === 3 && !isEdgeGridLine) continue;
          let bottomTileType = 0;
          if (subY === this.gridSubdivisions && y < mapHeight - 1) {
            bottomTileType = (map[y + 1] && x >= 0 && x < mapWidth) ? map[y + 1][x] : 0;
          }
          
          const isBoundary = bottomTileType !== 0 && bottomTileType !== currentTileType && subY === this.gridSubdivisions;
          const lineWidth = isBoundary ? 1 : 2;
          
          ctx.beginPath();
          ctx.lineWidth = lineWidth;
          ctx.strokeStyle = gridColors[currentTileType] || '#D7D7D7';
          
          const screenPosStart = camera.worldToScreen(x * tileSize, worldY);
          const screenPosEnd = camera.worldToScreen((x + 1) * tileSize, worldY);
          
          ctx.moveTo(Math.floor(screenPosStart.x), Math.floor(screenPosStart.y) + 0.5);
          ctx.lineTo(Math.floor(screenPosEnd.x), Math.floor(screenPosEnd.y) + 0.5);
          ctx.stroke();
        }
      }
    }
    
    ctx.restore();
  }
}