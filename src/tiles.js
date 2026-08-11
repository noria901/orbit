/**
 * GIBS (NASA) tile management — URL construction and quadtree tile logic.
 *
 * Handles Blue Marble (base) and VIIRS SNPP (overlay) layers.
 * Tile coordinates follow the EPSG:4326 Geographic tiling scheme used by GIBS:
 *   Level 0: 2 tiles wide × 1 tile tall (each 256×256 px covering 180°×180°)
 *   Level n: 2^(n+1) × 2^n tiles
 *
 * This module is pure logic — no THREE dependency.
 * Actual texture creation happens in the rendering layer.
 */

const { toISODate } = require('./time');

// ---- GIBS layer configuration ----

const GIBS_BASE = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

const LAYERS = {
  blueMarble: {
    name: 'BlueMarble_NextGeneration',
    format: 'image/jpeg',
    maxLevel: 8,
    tileSize: 256,
  },
  viirs: {
    name: 'VIIRS_SNPP_CorrectedReflectance_TrueColor',
    format: 'image/png',
    maxLevel: 8,
    tileSize: 256,
    dated: true, // requires TIME parameter
  },
};

/**
 * Build a GIBS WMS GetMap URL for a specific tile.
 *
 * @param {string} layerKey — key in LAYERS
 * @param {number} level — zoom level (0-based)
 * @param {number} col — tile column (0-based, left to right)
 * @param {number} row — tile row (0-based, top to bottom)
 * @param {Date} [date] — required for dated layers
 * @returns {string} tile URL
 */
function gibsTileURL(layerKey, level, col, row, date) {
  const layer = LAYERS[layerKey];
  if (!layer) throw new Error(`Unknown GIBS layer: ${layerKey}`);

  const bbox = tileToBBox(level, col, row);

  const params = [
    'SERVICE=WMS',
    'REQUEST=GetMap',
    'VERSION=1.1.1',
    `LAYERS=${layer.name}`,
    'SRS=EPSG:4326',
    `BBOX=${bbox.join(',')}`,
    `WIDTH=${layer.tileSize}`,
    `HEIGHT=${layer.tileSize}`,
    `FORMAT=${layer.format}`,
    'TRANSPARENT=true',
  ];

  if (layer.dated && date) {
    params.push(`TIME=${toISODate(date)}`);
  }

  return `${GIBS_BASE}?${params.join('&')}`;
}

/**
 * Compute the EPSG:4326 bounding box for a tile at given level/col/row.
 *
 * GIBS EPSG:4326 grid:
 *   Full extent: -180 to 180 longitude, -90 to 90 latitude
 *   Level 0: 2 cols × 1 row (each tile is 180°×180°)
 *   Level n: 2^(n+1) cols × 2^n rows
 *
 * WMS 1.1.1 BBOX order: minX, minY, maxX, maxY (lon, lat, lon, lat)
 *
 * @param {number} level
 * @param {number} col
 * @param {number} row
 * @returns {number[]} [minLon, minLat, maxLon, maxLat]
 */
function tileToBBox(level, col, row) {
  const numCols = 2 * Math.pow(2, level); // 2^(level+1)
  const numRows = Math.pow(2, level);     // 2^level

  const tileWidth = 360 / numCols;
  const tileHeight = 180 / numRows;

  const minLon = -180 + col * tileWidth;
  const maxLon = minLon + tileWidth;
  const maxLat = 90 - row * tileHeight;
  const minLat = maxLat - tileHeight;

  return [minLon, minLat, maxLon, maxLat];
}

/**
 * Get tile grid dimensions at a given level.
 *
 * @param {number} level
 * @returns {{ cols: number, rows: number }}
 */
function tileGridSize(level) {
  return {
    cols: 2 * Math.pow(2, level),
    rows: Math.pow(2, level),
  };
}

/**
 * Convert geographic coordinates to tile indices at a given level.
 *
 * @param {number} lat — degrees
 * @param {number} lon — degrees
 * @param {number} level
 * @returns {{ col: number, row: number }}
 */
function geoToTile(lat, lon, level) {
  const { cols, rows } = tileGridSize(level);
  const tileWidth = 360 / cols;
  const tileHeight = 180 / rows;

  let col = Math.floor((lon + 180) / tileWidth);
  let row = Math.floor((90 - lat) / tileHeight);

  // Clamp to valid range
  col = Math.max(0, Math.min(col, cols - 1));
  row = Math.max(0, Math.min(row, rows - 1));

  return { col, row };
}

module.exports = {
  GIBS_BASE,
  LAYERS,
  gibsTileURL,
  tileToBBox,
  tileGridSize,
  geoToTile,
};
