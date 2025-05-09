import { Renderer } from './renderer.js';
import { Camera } from './camera.js';
import { Input } from './input.js';
import { Network } from './network.js';

class Game {
  constructor() {
    console.log('Game initializing...');
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    window.game = this; 
    this.resize();
    this.resizeHandler = () => this.resize();
    window.addEventListener('resize', this.resizeHandler);
    
    this.players = new Map();
    this.enemies = new Map();
    this.bullets = new Map();

    this.inactiveEnemies = new Set();
    this.inactiveBullets = new Set();
    
    this.enemyTypes = {};
    this.playerId = null;
    this.map = null;
    this.mapWidth = 0;
    this.mapHeight = 0;
    this.tileSize = 0;
    this.isMovementEnabled = true;
    
    this.camera = new Camera(this.canvas.width, this.canvas.height);
    console.log('Camera initialized:', this.camera);
    
    this.renderer = new Renderer(this.ctx);
    console.log('Renderer initialized:', this.renderer);
    
    this.input = new Input(this.canvas);
    console.log('Input initialized:', this.input);
    
    this.network = new Network();
    console.log('Network initialized:', this.network);
    
    this.lastUpdateTime = Date.now();
    this.deltaTime = 0;

    // FPS tracking
    this.fpsDisplay = document.getElementById('fpsDisplay');
    this.frameCount = 0;
    this.lastFpsUpdate = Date.now();
    this.fps = 0;

    this.maxChatMessages = 100;
    
    this.setupEventListeners();
    this.setupChat();
    this.startGameLoop();
  }
  
  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    if (this.camera) {
      this.camera.resize(this.canvas.width, this.canvas.height);
    }
  }
  
  setupChat() {
    const chatInput = document.getElementById('chat-input');
    const chatWindow = document.getElementById('chat-window');
    const chatElement = document.getElementById('chat');
    
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !chatInput.matches(':focus') && 
          !document.activeElement.matches('input, textarea, select, [contenteditable]')) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Enter pressed - focusing chat input');
        
        setTimeout(() => chatInput.focus(), 0);
      }
    }, true);
    
    document.addEventListener('click', (e) => {
      if (!chatInput.contains(e.target) && !chatWindow.contains(e.target)) {
        chatInput.blur();
      }
    });
    
    chatInput.addEventListener('focus', () => {
      console.log('Chat input focused');
    });
    
    chatInput.addEventListener('blur', () => {
      console.log('Chat input blurred');
    });
    
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const message = chatInput.value.trim();
        if (message) {
          this.network.sendChatMessage(message);
          chatInput.value = '';
          chatInput.blur();
        } else {
          chatInput.blur();
        }
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
    
    this.network.on('chat', (data) => {
      this.addChatMessage(data.sender || 'Unknown', data.message);
    });
  }
  
  addChatMessage(sender, message) {
    const chatWindow = document.getElementById('chat-window');
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    messageElement.textContent = `${sender}: ${message}`;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    while (chatWindow.children.length > this.maxChatMessages) {
      chatWindow.removeChild(chatWindow.firstChild);
    }
  }
  
  setupEventListeners() {
    this.network.on('init', data => {
      this.playerId = data.id;
      this.map = data.map;
      this.mapWidth = data.mapWidth;
      this.mapHeight = data.mapHeight;
      this.tileSize = data.tileSize;
      this.enemyTypes = data.enemyTypes || {};
      
      this.players.clear();
      this.enemies.clear();
      this.bullets.clear();

      if (data.playerData) {
          this.players.set(data.playerData.id, data.playerData);
          if (data.playerData.id === this.playerId) {
              this.camera.update(data.playerData.x, data.playerData.y, 0);
          }
      } else if (this.playerId) {
          this.network.send({ type: 'requestIdMap' });
      }

      if (data.enemies) {
        data.enemies.forEach(enemyData => {
          this.addEnemy(enemyData);
        });
      }
      
      if (data.bullets) {
        data.bullets.forEach(bulletData => {
          this.addBullet(bulletData);
        });
      }
      
      this.renderer.dirtyCache = true;
    });

    this.network.on('mapChange', data => {
      console.log(`Processing mapChange to ${data.newMapId}`);
      this.map = data.map;
      this.mapWidth = data.mapWidth;
      this.mapHeight = data.mapHeight;
      this.tileSize = data.tileSize;
      this.enemyTypes = data.enemyTypes || {};

      this.players.clear();
      this.enemies.clear();
      this.bullets.clear();

      if (data.playerData && data.playerData.id === this.playerId) {
        this.players.set(data.playerData.id, data.playerData);
        if (this.camera) {
             this.camera.update(data.playerData.x, data.playerData.y, 0);
        }
      }

      if (data.enemies) {
        data.enemies.forEach(enemyData => {
          this.addEnemy(enemyData);
        });
      }
      
      if (data.bullets) {
        data.bullets.forEach(bulletData => {
          this.addBullet(bulletData);
        });
      }
      
      this.renderer.dirtyCache = true;
      console.log("Map changed, renderer cache invalidated.");
    });

    this.network.on('update', data => {
      data.players.forEach(playerData => {
        const existingPlayer = this.players.get(playerData.id);
        
        if (existingPlayer) {
          existingPlayer.x = playerData.x;
          existingPlayer.y = playerData.y;
          if (playerData.color !== undefined) existingPlayer.color = playerData.color;
          if (playerData.isDead !== undefined) existingPlayer.isDead = playerData.isDead;
        } else {
          this.players.set(playerData.id, {
            id: playerData.id,
            x: playerData.x,
            y: playerData.y,
            radius: playerData.radius || 25,
            color: playerData.color || '#000000',
            isDead: playerData.isDead || false
          });
          console.log(`Added player with ID: ${playerData.id}`);
        }
      });
      
      if (data.enemies) {
        this.inactiveEnemies = new Set(this.enemies.keys());
        
        data.enemies.forEach(enemyData => {
          this.addEnemy(enemyData);
          this.inactiveEnemies.delete(enemyData.id);
        });

        for (const enemyId of this.inactiveEnemies) {
          this.enemies.delete(enemyId);
        }
      }
      
      if (data.bullets) {
        this.inactiveBullets = new Set(this.bullets.keys());
        
        data.bullets.forEach(bulletData => {
          this.addBullet(bulletData);
          this.inactiveBullets.delete(bulletData.id);
        });

        for (const bulletId of this.inactiveBullets) {
          this.bullets.delete(bulletId);
        }
      }

      if (this.players.size > 0 && this.playerId) {
        if (!this.players.has(this.playerId)) {
          this.network.send({ type: 'requestIdMap' });
        }
      }
    });

    this.network.on('u', data => {
      if (this.playerId && !this.players.has(this.playerId)) {
          const ownPlayerData = data.players.find(p => p.id === this.playerId);
          if (ownPlayerData) {
              this.players.set(ownPlayerData.id, {
                  id: ownPlayerData.id,
                  x: ownPlayerData.x,
                  y: ownPlayerData.y,
                  radius: ownPlayerData.radius || 25,
                  color: ownPlayerData.color || '#000000',
                  isDead: ownPlayerData.isDead || false
              });
              console.log(`Re-added own player ${this.playerId} during 'u' processing.`);
          } else {
              console.warn(`Own player ${this.playerId} not found in 'u' update and not in local players map. Requesting ID map.`);
              this.network.send({ type: 'requestIdMap' });
          }
      }

      data.players.forEach(playerData => {
        const existingPlayer = this.players.get(playerData.id);
        
        if (existingPlayer) {
          existingPlayer.x = playerData.x;
          existingPlayer.y = playerData.y;
          if (playerData.color !== undefined) existingPlayer.color = playerData.color;
          if (playerData.isDead !== undefined) existingPlayer.isDead = playerData.isDead;
        } else {
          this.players.set(playerData.id, {
            id: playerData.id,
            x: playerData.x,
            y: playerData.y,
            radius: playerData.radius || 25,
            color: playerData.color || '#000000',
            isDead: playerData.isDead || false
          });
        }
      });
      
      if (data.enemies) {
        this.inactiveEnemies = new Set(this.enemies.keys());
        
        data.enemies.forEach(enemyData => {
          this.addEnemy(enemyData);
          this.inactiveEnemies.delete(enemyData.id);
        });

        for (const enemyId of this.inactiveEnemies) {
          this.enemies.delete(enemyId);
        }
      }
      
      if (data.b) {

        this.inactiveBullets = new Set(this.bullets.keys());
        
        data.b.forEach(bulletInfo => {
          const id = bulletInfo[0];
          const bullet = this.bullets.get(id) || {
            id: id,
            x: bulletInfo[1],
            y: bulletInfo[2],
            radius: bulletInfo[3],
            color: '#FFFF00',
            outlineColor: '#FF8C00'
          };
          
          bullet.prevX = bullet.x;
          bullet.prevY = bullet.y;
          bullet.x = bulletInfo[1];
          bullet.y = bulletInfo[2];
          bullet.radius = bulletInfo[3];
          
          this.bullets.set(id, bullet);
          this.inactiveBullets.delete(id);
        });

        for (const bulletId of this.inactiveBullets) {
          this.bullets.delete(bulletId);
        }
      }
    });
    
    this.network.on('newPlayer', data => {
      const player = data.player;
      if (!player.color) player.color = '#000000';
      player.isDead = player.isDead || false;
      this.players.set(player.id, player);
    });
    
    this.network.on('playerLeave', data => {
      this.players.delete(data.playerId);
    });
    
    this.input.on('mousemove', (x, y) => {
      if (this.playerId && this.isMovementEnabled) {
        const player = this.players.get(this.playerId);
        if (player && !player.isDead) {
          const worldX = x + this.camera.x;
          const worldY = y + this.camera.y;
          this.network.sendMouseMove(worldX, worldY);
        }
      }
    });
    
    this.input.on('movementtoggled', (isEnabled) => {
      this.isMovementEnabled = isEnabled;
      
      if (!isEnabled && this.playerId) {
        const player = this.players.get(this.playerId);
        if (player) {
          this.network.sendMouseMove(player.x, player.y);
        }
      }
    });

    this.network.on('respawn', data => {
        if (this.playerId === data.id) {
            const player = this.players.get(this.playerId);
            if (player) {
                player.x = data.x;
                player.y = data.y;
                player.isDead = false;
                this.isMovementEnabled = data.mouseActive !== undefined ? data.mouseActive : true; 
                if (this.input) {
                    if(this.isMovementEnabled) this.input.enableMovement();
                    else this.input.disableMovement();
                }
            }
        } else {
        }
    });
  }
  
  update() {
    const currentTime = Date.now();
    this.deltaTime = currentTime - this.lastUpdateTime;
    this.lastUpdateTime = currentTime;
    
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.fpsDisplay.textContent = `FPS: ${this.fps}`;
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
    }
    
    const player = this.players.get(this.playerId);
    if (player) {
      this.camera.update(player.x, player.y, this.deltaTime);
    }
  }
  
  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    if (this.map && this.players.size > 0) {
      const player = this.players.get(this.playerId);
      if (player) {
        this.renderer.renderMap(this.map, this.mapWidth, this.mapHeight, this.tileSize, this.camera);
        this.renderer.renderPlayers(this.players, this.camera);
        
        const lerpAmount = Math.min(1, this.deltaTime / 100);
        this.renderer.renderEnemies(this.enemies, this.enemies, lerpAmount, this.camera);
        this.renderer.renderBullets(this.bullets, this.bullets, lerpAmount, this.camera);
      } else {
      }
    } else {
      console.log('Not rendering - map or players missing', { 
        mapExists: !!this.map, 
        playerCount: this.players.size 
      });
    }
  }
  
  dispose() {
    if (this.gameLoopRequestId) {
      cancelAnimationFrame(this.gameLoopRequestId);
      this.gameLoopRequestId = null;
    }

    if (this.input) {
      this.input.cleanup();
      this.input = null;
    }

    if (this.network && this.network.socket) {
      this.network.socket.close();
      this.network = null;
    }

    window.removeEventListener('resize', this.resizeHandler);

    this.players.clear();
    this.enemies.clear();
    this.bullets.clear();
    this.inactiveEnemies.clear();
    this.inactiveBullets.clear();

    this.canvas = null;
    this.ctx = null;

    if (window.game === this) {
      window.game = null;
    }
    
    console.log('Game disposed');
  }
  
  gameLoop() {
    this.update();
    this.render();
    this.gameLoopRequestId = requestAnimationFrame(() => this.gameLoop());
  }


  startGameLoop() {
    this.gameLoop();
  }
  
  addEnemy(enemyData) {
    const typeInfo = this.enemyTypes[enemyData.type] || { color: '#808080', outlineColor: '#000000' };

    const existingEnemy = this.enemies.get(enemyData.id);
    
    if (existingEnemy) {
      existingEnemy.prevX = existingEnemy.x;
      existingEnemy.prevY = existingEnemy.y;

      existingEnemy.x = enemyData.x;
      existingEnemy.y = enemyData.y;
      existingEnemy.radius = enemyData.radius;
      existingEnemy.type = enemyData.type;
    } else {
      const enemy = {
        ...enemyData,
        prevX: enemyData.x,
        prevY: enemyData.y,
        color: typeInfo.color,
        outlineColor: typeInfo.outlineColor
      };
      
      this.enemies.set(enemyData.id, enemy);
    }
  }
  
  addBullet(bulletData) {
    const existingBullet = this.bullets.get(bulletData.id);
    
    if (existingBullet) {
      existingBullet.prevX = existingBullet.x;
      existingBullet.prevY = existingBullet.y;

      existingBullet.x = bulletData.x;
      existingBullet.y = bulletData.y;
      existingBullet.radius = bulletData.radius;
      existingBullet.isActive = bulletData.isActive;
    } else {
      const bullet = {
        ...bulletData,
        prevX: bulletData.x,
        prevY: bulletData.y,
        color: bulletData.color || '#FFFF00',
        outlineColor: bulletData.outlineColor || '#FF8C00'
      };
      
      this.bullets.set(bulletData.id, bullet);
    }
  }
}

const game = new Game(); 