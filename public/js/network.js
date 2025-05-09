import { CompressionUtils } from './compression-utils.js';
import pako from 'pako';

export class Network {
  constructor() {
    this.socket = null;
    this.events = {};
    this.lastSentMousePos = { x: 0, y: 0 };
    this.movementThrottle = 16;
    this.lastMovementTime = 0;
    this.ping = 0;
    this.pingInterval = null;
    
    this.playerIdMap = new Map();
    this.enemyIdMap = new Map();
    this.bulletIdMap = new Map();
    
    this.connect();
  }
  
  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    this.socket = new WebSocket(`${protocol}//${host}`);
    this.socket.binaryType = 'arraybuffer';
    
    this.socket.onopen = () => {
      console.log('Connected to server');
      this.startPingInterval();
    };
    
    this.socket.onclose = () => {
      console.log('Disconnected from server');
      this.clearPingInterval();
      setTimeout(() => this.connect(), 1000);
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    this.socket.onmessage = async (event) => {
      try {
        let message;
        
        if (event.data instanceof ArrayBuffer) {
          const compressedData = new Uint8Array(event.data);
          const decompressedData = await CompressionUtils.decompressGzip(compressedData);
          const text = new TextDecoder().decode(decompressedData);
          message = JSON.parse(text);
        } else {
          message = JSON.parse(event.data);
        }
        
        this.handleMessage(message);
      } catch (e) {
        console.error('Failed to parse message:', e);
      }
    };
  }
  
  handleMessage(message) {
    if (message.type === 'init') {
      console.log('Received init message with ID:', message.id);
      this._ownPlayerId = message.id;
      
      this._idMapNeedsUpdate = true;
      this.playerIdMap.clear();
      this.enemyIdMap.clear();
      this.bulletIdMap.clear();
      
      this.emit('init', message);
    }
    else if (message.type === 'mapChange') {
      console.log('Received mapChange message for map:', message.newMapId);
      this._idMapNeedsUpdate = true;
      this.playerIdMap.clear();
      this.enemyIdMap.clear();
      this.bulletIdMap.clear();
      this.emit('mapChange', message);
    }
    else if (message.t === 'u') {
      if (message.idMap) {
        if (message.idMap.p) {
          for (const [shortId, fullId] of Object.entries(message.idMap.p)) {
            this.playerIdMap.set(parseInt(shortId), fullId);
          }
        }
        
        if (message.idMap.e) {
          for (const [shortId, fullId] of Object.entries(message.idMap.e)) {
            this.enemyIdMap.set(parseInt(shortId), fullId);
          }
        }
        
        if (message.idMap.b) {
          for (const [shortId, fullId] of Object.entries(message.idMap.b)) {
            this.bulletIdMap.set(parseInt(shortId), fullId);
          }
        }
        
        this._idMapNeedsUpdate = false;
      } else if (this._idMapNeedsUpdate) {
        this.send({ type: 'requestIdMap' });
      }
      
      if (this.events['u'] || this.events['update']) {
        const expandedMsg = {
          type: 'update',
          players: message.p.map(p => {
            const shortId = p[0];
            const fullId = this.playerIdMap.get(shortId) || shortId.toString();
            return {
              id: fullId,
              x: p[1],
              y: p[2],
              isDead: p[3] === 1
            };
          }),
          enemies: message.e ? message.e.map(e => {
            const shortId = e[0];
            const fullId = this.enemyIdMap.get(shortId) || shortId.toString();
            return {
              id: fullId,
              type: e[1],
              x: e[2],
              y: e[3],
              radius: e[4]
            };
          }) : [],
          bullets: message.b ? message.b.map(b => {
            const shortId = b[0];
            const fullId = this.bulletIdMap.get(shortId) || shortId.toString();
            return {
              id: fullId,
              x: b[1],
              y: b[2],
              radius: b[3]
            };
          }) : []
        };
        
        if (this.events['u']) {
          this.emit('u', expandedMsg);
        }
        if (this.events['update']) {
          this.emit('update', expandedMsg);
        }
      }
    }
    else if (message.type === 'm' && message.x !== undefined && message.y !== undefined && this.events['mousemove']) {
      const expandedMsg = {
        type: 'mousemove',
        x: message.x,
        y: message.y
      };
      this.emit('mousemove', expandedMsg);
    } 
    else if (message.type === 'pong') {
      const now = Date.now();
      this.ping = now - message.clientTime;
      this.updatePingDisplay();
    }
    else if (message.type === 'chat') {
      this.emit('chat', message);
    }
    else if (message.type && this.events[message.type]) {
      this.emit(message.type, message);
    }
  }
  
  startPingInterval() {
    this.clearPingInterval();
    this.pingInterval = setInterval(() => this.sendPing(), 1000);
  }
  
  clearPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  sendPing() {
    this.send({
      type: 'ping',
      time: Date.now()
    });
  }
  
  updatePingDisplay() {
    const pingDisplay = document.getElementById('pingDisplay');
    if (pingDisplay) {
      pingDisplay.textContent = `Ping: ${this.ping} ms`;
    }
  }
  
  sendMouseMove(x, y) {
    const now = Date.now();
    const dx = x - this.lastSentMousePos.x;
    const dy = y - this.lastSentMousePos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 1 || now - this.lastMovementTime > this.movementThrottle) {
      const buffer = new ArrayBuffer(9);
      const view = new DataView(buffer);
      
      view.setUint8(0, 1);
      
      view.setInt32(1, Math.round(x), true);
      view.setInt32(5, Math.round(y), true);
      
      this.socket.send(buffer);
      
      this.lastSentMousePos.x = x;
      this.lastSentMousePos.y = y;
      this.lastMovementTime = now;
    }
  }
  
  sendChatMessage(message) {
    this.send({
      type: 'chat',
      message: message
    });
  }
  
  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const jsonStr = JSON.stringify(data);
      
      if (jsonStr.length > 80) {
        try {
          const textEncoder = new TextEncoder();
          const uint8Array = textEncoder.encode(jsonStr);
          
          const compressed = pako.deflate(uint8Array);
          
          this.socket.send(compressed.buffer);
          return;
        } catch (e) {
          console.error('Compression failed:', e);
        }
      }
      
      this.socket.send(jsonStr);
    }
  }
  
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push(callback);
  }
  
  emit(event, data) {
    const callbacks = this.events[event];
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
} 