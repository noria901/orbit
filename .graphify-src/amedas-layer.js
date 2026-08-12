/**
 * AMeDAS weather station visualization layer.
 *
 * Renders JMA observation stations as temperature-coloured dots.
 * Bridges data.js (parseAmedas, tempColor) with points.js.
 *
 * THREE is dependency-injected for testability.
 */

'use strict';

const { createPointCloud, hexToRGB } = require('./points');
const { tempColor } = require('./data');

// Precompute temperature colour bands
const TEMP_COLORS = {
  freezing: hexToRGB(tempColor(-5)),   // <=0
  cool:     hexToRGB(tempColor(5)),    // 0-10
  mild:     hexToRGB(tempColor(15)),   // 10-20
  warm:     hexToRGB(tempColor(25)),   // 20-28
  hot:      hexToRGB(tempColor(35)),   // >28
};

function tempToColor(t) {
  if (t <= 0)  return TEMP_COLORS.freezing;
  if (t < 10)  return TEMP_COLORS.cool;
  if (t < 20)  return TEMP_COLORS.mild;
  if (t < 28)  return TEMP_COLORS.warm;
  return TEMP_COLORS.hot;
}

/**
 * Create the AMeDAS layer.
 *
 * @param {object} THREE
 * @param {object} [opts]
 * @param {number} [opts.maxPoints] — capacity (default 2000)
 * @returns {{ mesh, refresh(stations), count, dispose }}
 */
function createAmedasLayer(THREE, opts = {}) {
  const cloud = createPointCloud(THREE, {
    maxPoints: opts.maxPoints ?? 2000,
    defaultSize: 3,
    sizeAttenuation: true,
  });

  cloud.mesh.name = 'amedas';

  /**
   * Refresh with parsed station data.
   * @param {Array<{lat,lon,name,temp,wind,rain,humidity}>} stations — from parseAmedas()
   */
  function refresh(stations) {
    cloud.update(stations, {
      position: (s) => ({ lat: s.lat, lon: s.lon }),
      color: (s) => tempToColor(s.temp),
    });
  }

  return {
    mesh: cloud.mesh,
    refresh,
    get count() { return cloud.count; },
    dispose() { cloud.dispose(); },
  };
}

module.exports = { createAmedasLayer, tempToColor, TEMP_COLORS };
