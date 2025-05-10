
class Teleporter {

  constructor(tileX, tileY, code = null, mapId = null) {
    this.tileX = tileX;
    this.tileY = tileY;
    this.code = code;
    this.mapId = mapId;
  }

  getPositionKey() {
    return `${this.tileX}_${this.tileY}`;
  }

  serialize() {
    return {
      tileX: this.tileX,
      tileY: this.tileY,
      code: this.code,
      mapId: this.mapId
    };
  }
}

class TeleporterManager {
  constructor() {
    this.teleportersByPosition = new Map();
    this.teleportersByCode = new Map();
  }

  addTeleporter(teleporter) {
    const key = teleporter.getPositionKey();
    this.teleportersByPosition.set(key, teleporter);
    
    if (teleporter.code) {
      this.teleportersByCode.set(teleporter.code, teleporter);
    }
  }

  getTeleporterByPosition(tileX, tileY) {
    const key = `${tileX}_${tileY}`;
    return this.teleportersByPosition.get(key) || null;
  }

  getTeleporterByCode(code) {
    return this.teleportersByCode.get(code) || null;
  }

  associateTeleporterCodes(teleporterCodes) {
    if (!teleporterCodes || teleporterCodes.length === 0) {
      console.warn("No teleporter codes available for map");
      return;
    }
    
    const teleporterPositions = Array.from(this.teleportersByPosition.keys());
    for (let i = 0; i < teleporterCodes.length; i++) {
      const codeInfo = teleporterCodes[i];
      
      if (i < teleporterPositions.length) {
        const posKey = teleporterPositions[i];
        const teleporter = this.teleportersByPosition.get(posKey);
        
        teleporter.code = codeInfo.code;
        teleporter.mapId = codeInfo.mapId;
        
        this.teleportersByCode.set(codeInfo.code, teleporter);
      }
    }
  }
}

module.exports = { Teleporter, TeleporterManager }; 