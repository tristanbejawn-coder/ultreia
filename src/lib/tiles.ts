export function tileConfig() {
  return {
    tileUrl: process.env.SATELLITE_TILE_URL || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: process.env.SATELLITE_ATTRIBUTION || 'Imagery © Esri, Maxar, Earthstar Geographics · Route © OpenStreetMap contributors · Terrain: Mapzen/AWS',
    // Relief. Terrarium-encoded elevation tiles from the AWS Open Data
    // terrain set need no key. Set TERRAIN=off to flatten the world.
    terrainUrl: process.env.TERRAIN === 'off' ? null : (process.env.TERRAIN_TILE_URL || 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'),
  }
}
