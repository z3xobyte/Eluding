const fs = require('fs');
const path = require('path');
const { Map } = require('./mapLogic');
const BinaryMapEncoder = require('./maps/BinaryMapEncoder');

class MapManager {
  constructor() {
    this.maps = {};
    this.currentMapId = 'map1';
    this.useBinaryMaps = true;
    this.loadMaps();
  }

  loadMaps() {
    const mapFiles = ['map1', 'map2', 'map3'];
    
    mapFiles.forEach(mapId => {
      const binaryMapPath = path.join(__dirname, 'maps', `${mapId}.bmap`);
      const jsonMapPath = path.join(__dirname, 'maps', `${mapId}.json`);
      
      try {
        if (this.useBinaryMaps && fs.existsSync(binaryMapPath)) {
          console.log(`Loading binary map from: ${binaryMapPath}`);
          const startTime = Date.now();
          
          const mapData = BinaryMapEncoder.loadBinaryMap(binaryMapPath);
          mapData.mapId = mapId;
          
          this.maps[mapId] = new Map(mapData);
          
          const loadTime = Date.now() - startTime;
          console.log(`Binary map ${mapId} loaded successfully in ${loadTime}ms`);
        } 
        else {
          console.log(`Loading JSON map from: ${jsonMapPath}`);
          const startTime = Date.now();
          
          const fileContent = fs.readFileSync(jsonMapPath, 'utf8');
          const mapData = JSON.parse(fileContent);
          mapData.mapId = mapId;
          
          this.maps[mapId] = new Map(mapData);
          
          const loadTime = Date.now() - startTime;
          console.log(`JSON map ${mapId} loaded successfully in ${loadTime}ms`);
          
          if (this.useBinaryMaps) {
            try {
              const binarySize = BinaryMapEncoder.saveBinaryMap(mapData, binaryMapPath);
              console.log(`Converted ${mapId} to binary format (${binarySize} bytes)`);
            } catch (conversionError) {
              console.error(`Error converting map ${mapId} to binary:`, conversionError);
            }
          }
        }
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
  
  convertAllMapsToBinary() {
    const sourceDir = path.join(__dirname, 'maps');
    const conversionResults = BinaryMapEncoder.convertJsonMapsToBinary(sourceDir, sourceDir);
    console.log('Map conversion results:', conversionResults);
    return conversionResults;
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