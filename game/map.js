const fs = require('fs');
const path = require('path');
const { Map } = require('./mapLogic');

class MapManager {
  constructor() {
    this.maps = {};
    this.currentMapId = 'map1';
    this.loadMaps();
  }

  loadMaps() {
    const mapFiles = ['map1', 'map2', 'map3'];
    
    mapFiles.forEach(mapId => {
      const mapDataPath = path.join(__dirname, 'maps', `${mapId}.json`);
      console.log(`Loading map from: ${mapDataPath}`);
      try {
        const fileContent = fs.readFileSync(mapDataPath, 'utf8');
        console.log(`File content read: ${fileContent.substring(0, 50)}...`);
        const mapData = JSON.parse(fileContent);
        console.log(`Map data parsed: ${Object.keys(mapData).join(', ')}`);
        mapData.mapId = mapId;
        
        this.maps[mapId] = new Map(mapData);
        console.log(`Map ${mapId} loaded successfully`);
      } catch (error) {
        console.error(`Error loading map ${mapId}:`, error);
      }
    });
  }
  
  getCurrentMap() {
    return this.maps[this.currentMapId];
  }

  getMapById(mapId) {
    return this.maps[mapId] || null;
  }
  
  changeMap(mapId) {
    if (this.maps[mapId]) {
      this.currentMapId = mapId;
      return true;
    }
    return false;
  }
}

class MapBackwardCompatibility {
  constructor() {
    const mapDataPath = path.join(__dirname, 'maps', 'map1.json');
    console.log(`Loading backward compatibility map from: ${mapDataPath}`);
    try {
      const fileContent = fs.readFileSync(mapDataPath, 'utf8');
      const mapData = JSON.parse(fileContent);
      mapData.mapId = 'map1';
      return new Map(mapData);
    } catch (error) {
      console.error("Error in MapBackwardCompatibility:", error);
      return null;
    }
  }
}

module.exports = { 
  MapManager, 
  Map: MapBackwardCompatibility 
}; 