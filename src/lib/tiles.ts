export function tileConfig() {
  return {
    tileUrl: process.env.SATELLITE_TILE_URL || 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: process.env.SATELLITE_ATTRIBUTION || 'Imagery © Esri, Maxar, Earthstar Geographics · Route © OpenStreetMap contributors',
  }
}
