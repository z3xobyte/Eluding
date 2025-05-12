import { Renderer } from "./renderer.js";
import { Camera } from "./camera.js";
import { Input } from "./input.js";
import { Network } from "./network.js";

class Game {
  constructor() {
    console.log("Game initializing...");
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    window.game = this;
    this.resize();
    this.resizeHandler = () => this.resize();
    window.addEventListener("resize", this.resizeHandler);

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
    this.isMovementEnabled = false; // Player starts inactive
    this.playerName = "";
    this.isGameActive = false;
    this.playerDataConfirmed = false; // Flag to check if own player data has been received after join
    this.spectatorCameraX = null;
    this.spectatorCameraY = null;

    // UI Elements for name input
    this.menuElement = document.getElementById("menu");
    this.nameInputElement = document.getElementById("name");
    this.playButtonElement = document.getElementById("play");
    this.statusElement = document.getElementById("status");

    this.camera = new Camera(this.canvas.width, this.canvas.height);
    console.log("Camera initialized:", this.camera);

    this.renderer = new Renderer(this.ctx);
    console.log("Renderer initialized:", this.renderer);

    this.input = new Input(this.canvas);
    console.log("Input initialized:", this.input);

    this.network = new Network();
    console.log("Network initialized:", this.network);

    this.lastUpdateTime = Date.now();
    this.deltaTime = 0;

    this.fpsDisplay = document.getElementById("fpsDisplay");
    this.frameCount = 0;
    this.lastFpsUpdate = Date.now();
    this.fps = 0;

    this.maxChatMessages = 100;

    this.setupEventListeners();
    this.setupNameInput(); // Setup name input before chat, as chat might depend on name
    this.setupChat();
    this.startGameLoop();

    if (this.input) {
      this.input.disableMovement(); // Ensure input class also knows movement is initially off
    }
  }

  setupNameInput() {
    if (
      !this.playButtonElement ||
      !this.nameInputElement ||
      !this.menuElement ||
      !this.statusElement
    ) {
      console.error("Name input UI elements not found");
      return;
    }

    this.playButtonElement.addEventListener("click", () => {
      const name = this.nameInputElement.value.trim();
      if (name && name.length > 0 && name.length <= 16) {
        this.playerName = name;
        
        // Instead of directly joining, start the anime.js intro animation
        this.startAnimeIntroAnimation();

        this.menuElement.style.display = "none";
        this.statusElement.textContent = "";

        // Movement should be off initially.
        if (this.input) {
          this.input.disableMovement();
        }
        this.isMovementEnabled = false; 
      } else {
        this.statusElement.textContent =
          "Please enter a name (1-16 characters).";
      }
    });

    this.nameInputElement.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        this.playButtonElement.click();
      }
    });
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    if (this.camera) {
      this.camera.resize(this.canvas.width, this.canvas.height);
    }
  }

  setupChat() {
    const chatInput = document.getElementById("sendmsg");
    const chatWindow = document.getElementById("messages");
    // const chatElement = document.getElementById('chat'); // This element is no longer the main container

    if (!chatInput || !chatWindow) {
      console.error("Chat UI elements #sendmsg or #messages not found");
      return;
    }

    document.addEventListener(
      "keydown",
      (e) => {
        if (
          e.key === "Enter" &&
          !chatInput.matches(":focus") &&
          !document.activeElement.matches(
            "input, textarea, select, [contenteditable]",
          )
        ) {
          e.preventDefault();
          e.stopPropagation();
          console.log("Enter pressed - focusing chat input");

          setTimeout(() => chatInput.focus(), 0);
        }
      },
      true,
    );

    document.addEventListener("click", (e) => {
      if (!chatInput.contains(e.target) && !chatWindow.contains(e.target)) {
        chatInput.blur();
      }
    });

    chatInput.addEventListener("focus", () => {
      console.log("Chat input focused");
    });

    chatInput.addEventListener("blur", () => {
      console.log("Chat input blurred");
    });

    chatInput.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter") {
          const message = chatInput.value.trim();
          if (message) {
            this.network.sendChatMessage(message);
            chatInput.value = "";
            chatInput.blur();
          } else {
            chatInput.blur();
          }
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true,
    );

    this.network.on("chat", (data) => {
      this.addChatMessage(data.sender || "Unknown", data.message, data.color);
    });
  }

  addChatMessage(sender, message, color) {
    const chatWindow = document.getElementById("messages");
    if (!chatWindow) return;

    const messageElement = document.createElement("p"); // Use 'p' as per new CSS
    // messageElement.className = 'chat-message'; // Class name if needed by CSS, but new CSS targets p
    const displayName = sender === this.playerId ? this.playerName : sender; // Use local name for own messages if sender is just ID
    messageElement.textContent = `${displayName}: ${message}`;
    
    // Default text color if none specified
    const textColor = color || "#FFFFFF";
    messageElement.style.color = textColor;
    
    // Create a darker outline/shadow based on the text color
    // Parse the color to RGB if it's a hex color
    let shadowColor = "#000000"; // Default shadow
    
    if (textColor.startsWith("#")) {
      // For hex colors, we can darken them programmatically
      try {
        let r = parseInt(textColor.slice(1, 3), 16);
        let g = parseInt(textColor.slice(3, 5), 16);
        let b = parseInt(textColor.slice(5, 7), 16);
        
        // Make each component darker by multiplying by 0.4
        r = Math.floor(r * 0.4);
        g = Math.floor(g * 0.4);
        b = Math.floor(b * 0.4);
        
        shadowColor = `rgb(${r}, ${g}, ${b})`;
      } catch (e) {
        // If any parsing error, use default black shadow
        shadowColor = "#000000";
      }
    }
    
    // Apply text shadow for outline effect
    messageElement.style.textShadow = `1px 1px 1px ${shadowColor}, -1px -1px 1px ${shadowColor}, 1px -1px 1px ${shadowColor}, -1px 1px 1px ${shadowColor}`;
    
    // Ensure Baloo Paaji 2 font is applied
    messageElement.style.fontFamily = "'Baloo Paaji 2', sans-serif";
    
    // If this is a server message, make it bold
    if (sender === "SERVER") {
      messageElement.style.fontWeight = "bold";
    }

    chatWindow.appendChild(messageElement);
    // For flex-direction: column-reverse, new items at bottom, scroll to see latest (bottom)
    chatWindow.scrollTop = chatWindow.scrollHeight;

    while (chatWindow.children.length > this.maxChatMessages) {
      chatWindow.removeChild(chatWindow.firstChild);
    }
  }

  setupEventListeners() {
    this.network.on("init", (data) => {
      // This is the initial connection data. Player might not be fully "in" the game yet.
      // PlayerId received here might be temporary or final.
      this.playerId = data.id;
      if (
        this.playerId &&
        data.playerData &&
        data.playerData.id === this.playerId
      ) {
        // If server sends our name back in init (e.g. reconnecting)
        this.playerName = data.playerData.name || this.playerName;
      }

      const startMapRender = performance.now();
      this.map = data.map;
      this.mapWidth = data.mapWidth;
      this.mapHeight = data.mapHeight;
      this.tileSize = data.tileSize;
      this.enemyTypes = data.enemyTypes || {};

      this.players.clear();
      this.enemies.clear();
      this.bullets.clear();

      // Process other players first (for spectator mode)
      if (data.players && Array.isArray(data.players)) {
        data.players.forEach((playerData) => {
          // Ensure not to add self if by any chance it's in this list during initial spectate
          if (
            playerData.id !== this.playerId ||
            (playerData.id === this.playerId && this.isGameActive)
          ) {
            const pData = {
              ...playerData,
              name:
                playerData.name ||
                "Player " +
                  (playerData.id ? playerData.id.substring(0, 4) : "???"),
            };
            this.players.set(playerData.id, pData);
          }
        });
      }

      // Process self player data (especially after joinGame or reconnect)
      if (data.playerData && data.playerData.id === this.playerId) {
        const pData = {
          ...data.playerData,
          name:
            data.playerData.name ||
            this.playerName ||
            "Player " +
              (data.playerData.id ? data.playerData.id.substring(0, 4) : "???"),
        };
        this.players.set(pData.id, pData);
        if (this.isGameActive) {
          // Only center camera on self if game is active for this player
          this.camera.update(pData.x, pData.y, 0);
          this.playerDataConfirmed = true; // Own player data received and processed
        }
      } else if (
        this.playerId &&
        this.isGameActive &&
        !this.playerDataConfirmed
      ) {
        // Game is active, but player's own data hasn't been confirmed yet after join attempt.
        // This state implies we are waiting for the server to send our specific player data.
        // Avoid sending requestIdMap immediately here, wait for 'u' or 'update'.
        console.log(
          `Game active for ${this.playerId}, but own data not yet confirmed via init.`,
        );
      } else if (
        this.playerId &&
        this.isGameActive &&
        this.playerDataConfirmed &&
        !this.players.has(this.playerId)
      ) {
        // Game is active, player data WAS confirmed, but now it's missing. This is an issue.
        console.warn(
          `Player ${this.playerId} was confirmed but now missing. Requesting ID map.`,
        );
        this.network.send({ type: "requestIdMap" });
        this.playerDataConfirmed = false; // Need re-confirmation
      }

      // Set spectator camera if provided and not yet active
      if (
        data.spectatorCameraX !== undefined &&
        data.spectatorCameraY !== undefined &&
        !this.isGameActive
      ) {
        this.spectatorCameraX = data.spectatorCameraX;
        this.spectatorCameraY = data.spectatorCameraY;
        if (this.camera) {
          this.camera.update(this.spectatorCameraX, this.spectatorCameraY, 0);
        }
      }

      if (data.enemies) {
        data.enemies.forEach((enemyData) => {
          this.addEnemy(enemyData);
        });
      }

      if (data.bullets) {
        data.bullets.forEach((bulletData) => {
          this.addBullet(bulletData);
        });
      }

      this.renderer.dirtyCache = true;
      console.log(
        `Map rendering prepared in ${(performance.now() - startMapRender).toFixed(2)}ms`,
      );
    });

    this.network.on("mapChange", (data) => {
      console.log(`Processing mapChange to ${data.newMapId}`);
      const startMapChange = performance.now();

      this.map = data.map;
      this.mapWidth = data.mapWidth;
      this.mapHeight = data.mapHeight;
      this.tileSize = data.tileSize;
      this.enemyTypes = data.enemyTypes || {};

      this.players.clear();
      this.enemies.clear();
      this.bullets.clear();
      this.playerDataConfirmed = false; // Reset on any map change

      if (data.playerData && data.playerData.id === this.playerId) {
        const pData = {
          ...data.playerData,
          name:
            data.playerData.name ||
            this.playerName ||
            "Player " +
              (data.playerData.id ? data.playerData.id.substring(0, 4) : "???"),
        };
        this.players.set(pData.id, pData);
        if (this.camera && this.isGameActive) {
          // Only center camera if game is active
          this.camera.update(pData.x, pData.y, 0);
          this.playerDataConfirmed = true; // Own player data received on mapChange
        }
      }

      if (data.enemies) {
        data.enemies.forEach((enemyData) => {
          this.addEnemy(enemyData);
        });
      }

      if (data.bullets) {
        data.bullets.forEach((bulletData) => {
          this.addBullet(bulletData);
        });
      }

      this.renderer.dirtyCache = true;
      console.log(
        `Map changed, renderer cache invalidated. Process took ${(performance.now() - startMapChange).toFixed(2)}ms`,
      );
    });

    this.network.on("update", (data) => {
      data.players.forEach((playerData) => {
        const existingPlayer = this.players.get(playerData.id);

        if (existingPlayer) {
          existingPlayer.x = playerData.x;
          existingPlayer.y = playerData.y;
          if (playerData.color !== undefined)
            existingPlayer.color = playerData.color;
          if (playerData.isDead !== undefined)
            existingPlayer.isDead = playerData.isDead;
          if (playerData.name !== undefined)
            existingPlayer.name = playerData.name;
        } else {
          this.players.set(playerData.id, {
            id: playerData.id,
            x: playerData.x,
            y: playerData.y,
            radius: playerData.radius || 25,
            color: playerData.color || "#FFFFFF",
            isDead: playerData.isDead || false,
            name:
              playerData.name ||
              "Player " +
                (playerData.id ? playerData.id.substring(0, 4) : "???"),
          });
          // console.log(`Added player with ID: ${playerData.id}`); // Reduced logging
        }
      });

      if (data.enemies) {
        this.inactiveEnemies = new Set(this.enemies.keys());

        data.enemies.forEach((enemyData) => {
          this.addEnemy(enemyData);
          this.inactiveEnemies.delete(enemyData.id);
        });

        for (const enemyId of this.inactiveEnemies) {
          this.enemies.delete(enemyId);
        }
      }

      if (data.bullets) {
        this.inactiveBullets = new Set(this.bullets.keys());

        data.bullets.forEach((bulletData) => {
          this.addBullet(bulletData);
          this.inactiveBullets.delete(bulletData.id);
        });

        for (const bulletId of this.inactiveBullets) {
          this.bullets.delete(bulletId);
        }
      }

      // After processing players from data.players:
      if (this.playerId && this.isGameActive) {
        if (!this.players.has(this.playerId)) {
          // Player data is NOT in this update
          if (this.playerDataConfirmed) {
            // Was previously confirmed, but now missing. This is an issue.
            console.warn(
              `Player ${this.playerId} confirmed but now missing from 'update' message. Requesting ID map.`,
            );
            this.network.send({ type: "requestIdMap" });
            this.playerDataConfirmed = false; // Needs re-confirmation.
          } else {
            // Game is active, but player data hasn't been confirmed yet (e.g. waiting for server response to joinGame).
            // Do not spam requestIdMap here. Wait for server's init/update that specifically includes self.
            // console.log(`Player ${this.playerId} still awaiting data confirmation in 'update' (game active).`);
          }
        }
        // Note: We do NOT set playerDataConfirmed = true here based on general updates.
        // Confirmation only comes from 'init' or 'mapChange' messages with specific playerData for self.
      }
    });

    this.network.on("u", (data) => {
      // First, ensure this.players is updated fromProcess all player updates from data.players (as currently implemented)
      // ... (existing logic to update this.players from data.players in 'u' message) ...
      // After processing players from data.players in 'u' message:

      if (this.playerId && this.isGameActive) {
        if (this.players.has(this.playerId)) {
          // If our player is in the update, it doesn't mean it's the *initial* confirmation.
          // Initial confirmation comes from 'init' or 'mapChange' with specific playerData.
        } else {
          // Player data is NOT in this 'u' update
          const ownPlayerDataFromUpdate = data.players.find(
            (p) => p.id === this.playerId,
          ); // Check if it was in this specific 'u' message
          if (ownPlayerDataFromUpdate) {
            // This case should ideally be handled by the generic loop that processes data.players.
            // If it reaches here, it implies the generic loop might not have set it.
            // For safety, if found, set it and confirm.
            this.players.set(ownPlayerDataFromUpdate.id, {
              id: ownPlayerDataFromUpdate.id,
              x: ownPlayerDataFromUpdate.x,
              y: ownPlayerDataFromUpdate.y,
              radius: ownPlayerDataFromUpdate.radius || 25,
              color: ownPlayerDataFromUpdate.color || "#FFFFFF",
              isDead: ownPlayerDataFromUpdate.isDead || false,
              name:
                ownPlayerDataFromUpdate.name ||
                this.playerName ||
                "Player " +
                  (ownPlayerDataFromUpdate.id
                    ? ownPlayerDataFromUpdate.id.substring(0, 4)
                    : "???"),
            });
            // If we found our player data in this specific 'u' message,
            // this is a form of confirmation if we were waiting.
            // However, the primary confirmation should come from 'init'/'mapChange' that specifically targets self.
            // Let's not set to true here to keep logic strict: 'init'/'mapChange' are for self-confirmation.
          } else if (this.playerDataConfirmed) {
            // Was previously confirmed, but now missing from this 'u' update. This is an issue.
            console.warn(
              `Player ${this.playerId} confirmed but now missing from 'u' message. Requesting ID map.`,
            );
            this.network.send({ type: "requestIdMap" });
            this.playerDataConfirmed = false; // Needs re-confirmation.
          } else {
            // Game is active, but player data hasn't been confirmed yet.
            console.log(
              `Player ${this.playerId} still awaiting data confirmation in 'u' (game active).`,
            );
          }
        }
      }

      data.players.forEach((playerData) => {
        const existingPlayer = this.players.get(playerData.id);

        if (existingPlayer) {
          existingPlayer.x = playerData.x;
          existingPlayer.y = playerData.y;
          if (playerData.color !== undefined)
            existingPlayer.color = playerData.color;
          if (playerData.isDead !== undefined)
            existingPlayer.isDead = playerData.isDead;
          if (playerData.name !== undefined)
            existingPlayer.name = playerData.name;
        } else {
          this.players.set(playerData.id, {
            id: playerData.id,
            x: playerData.x,
            y: playerData.y,
            radius: playerData.radius || 25,
            color: playerData.color || "#FFFFFF",
            isDead: playerData.isDead || false,
            name:
              playerData.name ||
              "Player " +
                (playerData.id ? playerData.id.substring(0, 4) : "???"),
          });
        }
      });

      if (data.enemies) {
        this.inactiveEnemies = new Set(this.enemies.keys());

        data.enemies.forEach((enemyData) => {
          this.addEnemy(enemyData);
          this.inactiveEnemies.delete(enemyData.id);
        });

        for (const enemyId of this.inactiveEnemies) {
          this.enemies.delete(enemyId);
        }
      }

      if (data.b) {
        this.inactiveBullets = new Set(this.bullets.keys());

        data.b.forEach((bulletInfo) => {
          const id = bulletInfo[0];
          const bullet = this.bullets.get(id) || {
            id: id,
            x: bulletInfo[1],
            y: bulletInfo[2],
            radius: bulletInfo[3],
            color: "#FFFF00",
            outlineColor: "#FF8C00",
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

    this.network.on("newPlayer", (data) => {
      const newPlayerData = data.player;
      if (!newPlayerData.color) newPlayerData.color = "#FFFFFF";
      newPlayerData.isDead = newPlayerData.isDead || false;
      newPlayerData.name =
        newPlayerData.name ||
        "Player " +
          (newPlayerData.id ? newPlayerData.id.substring(0, 4) : "???");

      this.players.set(newPlayerData.id, newPlayerData);
      // If this newPlayer event is for ourselves after sending name
      if (newPlayerData.id === this.playerId && !this.playerName) {
        this.playerName = newPlayerData.name;
      }
    });

    this.network.on("playerLeave", (data) => {
      this.players.delete(data.playerId);
    });

    this.input.on("mousemove", (x, y) => {
      if (this.isGameActive && this.playerId && this.isMovementEnabled) {
        const player = this.players.get(this.playerId);
        if (player && !player.isDead) {
          const worldX = x + this.camera.x;
          const worldY = y + this.camera.y;
          this.network.sendMouseMove(worldX, worldY);
        }
      }
    });

    this.input.on("movementtoggled", (isEnabled) => {
      if (this.isGameActive) {
        // Only allow movement toggling if game is active
        this.isMovementEnabled = isEnabled;

        if (!isEnabled && this.playerId) {
          const player = this.players.get(this.playerId);
          if (player) {
            // Send current player position as target to stop movement if mouse was primary input
            this.network.sendMouseMove(player.x, player.y);
          }
        }
      } else {
        // If game not active, the input event already handled disabling itself.
        // We just need to update the game's state.
        this.isMovementEnabled = false;
      }
    });

    this.network.on("respawn", (data) => {
      if (this.isGameActive && this.playerId === data.id) {
        // Ensure game active for respawn to matter
        const player = this.players.get(this.playerId);
        if (player) {
          player.x = data.x;
          player.y = data.y;
          player.isDead = false;
          this.isMovementEnabled = false; // Ensure movement is off after reset
          if (this.input) {
            this.input.disableMovement(); // Tell Input class to disable its state
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

    // FPS calculation can run even if game not active
    this.frameCount++;
    if (currentTime - this.lastFpsUpdate >= 1000) {
      this.fps = this.frameCount;
      this.fpsDisplay.textContent = `FPS: ${this.fps}`;
      this.frameCount = 0;
      this.lastFpsUpdate = currentTime;
    }

    if (!this.isGameActive) {
      // Spectator mode camera logic
      if (
        this.spectatorCameraX !== null &&
        this.spectatorCameraY !== null &&
        this.camera
      ) {
        this.camera.update(
          this.spectatorCameraX,
          this.spectatorCameraY,
          this.deltaTime,
        );
      } else {
        // Fallback if spectator coords not set: center on first other player or map center
        const firstOtherPlayer =
          this.players.size > 0
            ? Array.from(this.players.values()).find(
                (p) => p.id !== this.playerId,
              ) || this.players.values().next().value
            : null;
        if (firstOtherPlayer && this.camera) {
          this.camera.update(
            firstOtherPlayer.x,
            firstOtherPlayer.y,
            this.deltaTime,
          );
        } else if (this.mapWidth > 0 && this.mapHeight > 0 && this.camera) {
          // map loaded
          this.camera.update(
            (this.mapWidth * this.tileSize) / 2,
            (this.mapHeight * this.tileSize) / 2,
            this.deltaTime,
          );
        }
      }
      // No player-specific input processing or movement updates if spectating
      return;
    }

    // If game is active for this player:
    const player = this.players.get(this.playerId);
    if (player && this.camera) {
      this.camera.update(player.x, player.y, this.deltaTime);
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render map, other players, enemies even if this client is spectating or in menu
    if (this.map) {
      this.renderer.renderMap(
        this.map,
        this.mapWidth,
        this.mapHeight,
        this.tileSize,
        this.camera,
      );

      // Always render players and enemies if they exist, regardless of this client's active state
      this.renderer.renderPlayers(this.players, this.camera); // Assumes Renderer handles names

      const lerpAmount = Math.min(1, this.deltaTime / 100); // deltaTime could be large if tabbed out
      this.renderer.renderEnemies(
        this.enemies,
        this.enemies,
        lerpAmount,
        this.camera,
      );
      this.renderer.renderBullets(
        this.bullets,
        this.bullets,
        lerpAmount,
        this.camera,
      );
    } else if (
      this.network &&
      (this.network.socket?.readyState === WebSocket.CONNECTING ||
        this.network.socket?.readyState === WebSocket.OPEN)
    ) {
      // If map is null but we are connected/connecting, show loading or wait.
      // For now, just a blank screen until map data arrives.
    } else {
      // Potentially show "Connecting..." or error if map is null and not connected.
      // console.log('Not rendering - map missing and not connected/connecting.');
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

    window.removeEventListener("resize", this.resizeHandler);

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

    console.log("Game disposed");
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
    const typeInfo = this.enemyTypes[enemyData.type] || {
      color: "#808080",
      outlineColor: "#000000",
    };

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
        outlineColor: typeInfo.outlineColor,
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
        color: bulletData.color || "#FFFF00",
        outlineColor: bulletData.outlineColor || "#FF8C00",
      };

      this.bullets.set(bulletData.id, bullet);
    }
  }

  startAnimeIntroAnimation() {
    const introOverlay = document.getElementById('intro-overlay');
    const orbitContainer = document.getElementById('intro-orbit-container');
    const playerElement = document.getElementById('intro-player');
    const textElement = document.getElementById('intro-text');
    const particlesContainer = document.getElementById('particles-js');

    if (!introOverlay || !orbitContainer || !playerElement || !textElement || !particlesContainer) {
      console.error("Intro animation elements not found for orbit animation!");
      this.isGameActive = true;
      this.playerDataConfirmed = false;
      this.network.send({ type: "joinGame", name: this.playerName });
      return;
    }

    introOverlay.style.display = 'block'; // Show the overlay (using block to let absolute positioning work inside)
    introOverlay.style.pointerEvents = 'auto'; 

    // Initialize particles.js with our config
    try {
      particlesJS('particles-js', {
        "particles": {
          "number": {
            "value": 80,
            "density": {
              "enable": true,
              "value_area": 800
            }
          },
          "color": {
            "value": "#ffffff"
          },
          "shape": {
            "type": "circle",
            "stroke": {
              "width": 0,
              "color": "#000000"
            },
            "polygon": {
              "nb_sides": 3
            }
          },
          "opacity": {
            "value": 1,
            "random": true,
            "anim": {
              "enable": false,
              "speed": 1,
              "opacity_min": 0.1,
              "sync": false
            }
          },
          "size": {
            "value": 3,
            "random": true,
            "anim": {
              "enable": false,
              "speed": 40,
              "size_min": 0.1,
              "sync": false
            }
          },
          "line_linked": {
            "enable": true,
            "distance": 150,
            "color": "#ffffff",
            "opacity": 0.4,
            "width": 1
          },
          "move": {
            "enable": true,
            "speed": 6,
            "direction": "none",
            "random": true,
            "straight": false,
            "out_mode": "out",
            "bounce": false,
            "attract": {
              "enable": true,
              "rotateX": 1600,
              "rotateY": 1200
            }
          }
        },
        "interactivity": {
          "detect_on": "canvas",
          "events": {
            "onhover": {
              "enable": false
            },
            "onclick": {
              "enable": false
            },
            "resize": true
          }
        },
        "retina_detect": false
      });
    } catch (e) {
      console.error("Failed to initialize particles.js:", e);
    }

    // --- Player Setup ---
    textElement.textContent = this.playerName;

    // --- Enemy Setup ---
    orbitContainer.innerHTML = ''; // Clear previous enemies
    const enemyTypesForAnim = [
        { id: 1, color: '#808080', size: 20, speed: 1.0 },     // Basic
        { id: 2, color: '#8B0000', size: 22, speed: 0.95 },    // Sniper
        { id: 3, color: '#003c66', size: 25, speed: 1.05 },    // Dasher
        { id: 4, color: '#7F00FF', size: 18, speed: 0.97 },    // Homing
        { id: 5, color: '#1c0a2d', size: 28, speed: 0.93 },    // VoidCrawler
        { id: 2, color: '#a05353', size: 16, speed: 1.03 },    // Extra enemy type 
        { id: 3, color: '#003c66', size: 25, speed: 0.98 },    // Extra enemy type
        { id: 4, color: '#7F00FF', size: 18, speed: 1.02 },    // Extra enemy type
        { id: 1, color: '#808080', size: 20, speed: 0.94 },    // Extra enemy type
        { id: 5, color: '#1c0a2d', size: 24, speed: 1.01 },    // Extra enemy type
        { id: 4, color: '#7F00FF', size: 18, speed: 0.99 },    // Extra enemy type
        { id: 2, color: '#8B0000', size: 22, speed: 1.04 }     // Extra enemy type
        // Add more types if desired, adjusting orbitRadius and speed
    ];

    // Use a single orbit radius for all enemies - perfect circle
    const PERFECT_ORBIT_RADIUS = Math.min(window.innerWidth, window.innerHeight) / 2.8; // Responsive orbit size
    
    // Use actual enemy types if available from server init data
    const availableEnemyTypes = this.enemyTypes || {};
    enemyTypesForAnim.forEach(animType => {
        const serverType = availableEnemyTypes[animType.id];
        if (serverType && serverType.color) {
            animType.color = serverType.color;
        }
        // Add the same orbit radius to all enemies
        animType.orbitRadius = PERFECT_ORBIT_RADIUS;
    });
    
    enemyTypesForAnim.forEach((enemyType, index) => {
        const enemyDiv = document.createElement('div');
        enemyDiv.classList.add('intro-enemy');
        enemyDiv.style.width = `${enemyType.size}px`;
        enemyDiv.style.height = `${enemyType.size}px`;
        enemyDiv.style.backgroundColor = enemyType.color;
        // Position relative to center with margins to account for element size
        enemyDiv.style.marginLeft = `${-enemyType.size / 2}px`; 
        enemyDiv.style.marginTop = `${-enemyType.size / 2}px`;
        // Initial transform - will be at center (because of CSS left/top: 50%)
        enemyDiv.style.transform = 'translate(0, 0) scale(0)';

        // Store orbit data directly on the element for anime.js
        enemyDiv.dataset.orbitRadius = enemyType.orbitRadius;
        enemyDiv.dataset.speed = enemyType.speed;
        enemyDiv.dataset.initialAngle = (index / enemyTypesForAnim.length) * 360; // Evenly spaced around the circle

        orbitContainer.appendChild(enemyDiv);
    });

    // --- Animation Timeline ---
    const orbitDuration = 6000; // Longer duration to showcase the orbit

    const timeline = anime.timeline({
      autoplay: true,
      easing: 'easeInOutSine', // Smoother easing
      complete: () => {
        introOverlay.style.display = 'none';
        introOverlay.style.pointerEvents = 'none';
        this.isGameActive = true;
        this.playerDataConfirmed = false;
        console.log("Intro animation finished. Joining game...");
        this.network.send({ type: "joinGame", name: this.playerName });
        if (this.input) this.input.disableMovement();
        this.isMovementEnabled = false;
      }
    });

    timeline
      // First, fade in the particles (stars)
      .add({
        targets: particlesContainer,
        opacity: [0, 1],
        duration: 800,
        easing: 'linear'
      })
      // Then, fade in the dark background (overlay)
      .add({
        targets: introOverlay,
        backgroundColor: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.9)'], // From transparent to dark
        duration: 500,
        easing: 'linear'
      }, '-=400') // Overlap with particles fade-in
      // Player appears
      .add({
        targets: playerElement,
        opacity: [0, 1],
        transform: ['translate(0, 0) scale(0.5)', 'translate(0, 0) scale(1)'],
        duration: 1000,
      }, '-=300') // Overlap slightly with fade in
      // Name appears above player
      .add({
          targets: textElement,
          opacity: [0, 1],
          duration: 800,
          easing: 'easeOutExpo'
      }, '-=700') // Overlap with player appearance
      
      // Enemies fly out to their orbits
      .add({
          targets: '.intro-enemy',
          transform: (el) => {
              const radius = parseFloat(el.dataset.orbitRadius);
              const angle = parseFloat(el.dataset.initialAngle) * (Math.PI / 180);
              const x = Math.cos(angle) * radius;
              const y = Math.sin(angle) * radius;
              return `translate(${x}px, ${y}px) scale(1)`;
          },
          opacity: [0, 1],
          delay: anime.stagger(100, { start: 500 }),
          duration: 1500,
          easing: 'easeOutExpo'
      }, 300) // Start after overlay fade and player starts appearing

      // Orbiting animation - using a dummy target and update callback
      .add({
          targets: { angle: 0 }, // Dummy object to animate angle property
          angle: (el) => 360 * 2, // Rotate twice
          duration: orbitDuration,
          easing: 'linear', // Constant speed orbit
          update: function(anim) {
              document.querySelectorAll('.intro-enemy').forEach(el => {
                  const radius = parseFloat(el.dataset.orbitRadius);
                  const speedFactor = parseFloat(el.dataset.speed);
                  const initialAngle = parseFloat(el.dataset.initialAngle);
                  const currentAngleRad = (initialAngle + (anim.progress / 100 * 360 * 2 * speedFactor)) * (Math.PI / 180); // Use animated angle % + speed factor
                  
                  const x = Math.cos(currentAngleRad) * radius;
                  const y = Math.sin(currentAngleRad) * radius;
                  
                  el.style.transform = `translate(${x}px, ${y}px) scale(1)`;
              });
          }
      }, '-=1000') // Start orbiting while they are still flying out

      // Fade out everything before completion
      .add({
          targets: ['#intro-player', '#intro-text'],
          opacity: 0,
          transform: ['translate(0, 0) scale(1)', 'translate(0, 0) scale(0.8)'],
          duration: 800,
          easing: 'easeInExpo'
      }, `-=${orbitDuration * 0.3}`) // Start fade out during the last 30% of orbit

      // Separate fade-out for enemies with transform
      .add({
          targets: '.intro-enemy',
          opacity: 0,
          // Don't touch transform as it's being controlled by the orbit animation
          duration: 800,
          easing: 'easeInExpo'
      }, `-=${orbitDuration * 0.3}`) // Same timing as other elements

      .add({
        targets: introOverlay,
        opacity: [1, 0],
        duration: 500,
        easing: 'linear'
      }, '-=500'); // Fade out overlay at the very end
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new Game();
});
