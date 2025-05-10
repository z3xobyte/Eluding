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
      console.log(`Added teleporter with code ${teleporter.code} at position ${key}`);
    } else {
      console.log(`Added teleporter at position ${key} (no code yet)`);
    }
  }

  getTeleporterByPosition(tileX, tileY) {
    const key = `${tileX}_${tileY}`;
    return this.teleportersByPosition.get(key) || null;
  }

  getTeleporterByCode(code) {
    const teleporter = this.teleportersByCode.get(code) || null;
    console.log(`Looking for teleporter with code ${code}: ${teleporter ? 'FOUND' : 'NOT FOUND'}`);
    return teleporter;
  }

  associateTeleporterCodes(teleporterCodes) {
    if (!teleporterCodes || teleporterCodes.length === 0) {
      console.warn("No teleporter codes available for map");
      return;
    }
    
    console.log(`Associating ${teleporterCodes.length} teleporter codes`);
    
    const teleporterPositions = Array.from(this.teleportersByPosition.keys());
    for (let i = 0; i < teleporterCodes.length; i++) {
      const codeInfo = teleporterCodes[i];
      
      if (i < teleporterPositions.length) {
        const posKey = teleporterPositions[i];
        const teleporter = this.teleportersByPosition.get(posKey);
        
        teleporter.code = codeInfo.code;
        teleporter.mapId = codeInfo.mapId;
        
        this.teleportersByCode.set(codeInfo.code, teleporter);
        console.log(`Associated teleporter at ${posKey} with code ${codeInfo.code} -> ${codeInfo.mapId}`);
      } else {
        console.warn(`Not enough teleporter positions for code ${codeInfo.code}`);
      }
    }
  }
}

module.exports = { Teleporter, TeleporterManager }; 