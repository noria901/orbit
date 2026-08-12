/**
 * Earthquake visualization layer.
 *
 * Bridges data.js (parseQuakes, depthColor) with points.js (GPU points).
 * Renders each earthquake as a coloured dot sized by magnitude.
 *
 * THREE is dependency-injected for testability.
 */

'use strict';

const { createPointCloud, hexToRGB } = require('./points');
const { depthColor } = require('./data');

// Precompute depth colour bands as RGB {r,g,b} 0-1
const DEPTH_COLORS = {
  shallow: hexToRGB(depthColor(30)),   // <70km
  mid:     hexToRGB(depthColor(150)),  // 70-300km
  deep:    hexToRGB(depthColor(400)),  // >300km
};

/**
 * Magnitude → point size (pixels).
 * M2.5 → 3px, M5 → 8px, M7+ → 16px
 */
function magToSize(mag) {
  return Math.max(2, Math.min(20, mag * 2.5 - 3));
}

/**
 * Create the earthquake layer.
 *
 * @param {object} THREE
 * @param {object} [opts]
 * @param {number} [opts.maxPoints] — capacity (default 500)
 * @returns {{ mesh, refresh(quakeArray), count, dispose }}
 */
function createQuakeLayer(THREE, opts = {}) {
  const cloud = createPointCloud(THREE, {
    maxPoints: opts.maxPoints ?? 500,
    defaultSize: 5,
    sizeAttenuation: true,
  });

  cloud.mesh.name = 'quakes';

  function colorForQuake(q) {
    if (q.depth < 70)  return DEPTH_COLORS.shallow;
    if (q.depth < 300) return DEPTH_COLORS.mid;
    return DEPTH_COLORS.deep;
  }

  /**
   * Refresh the layer with new earthquake data.
   * @param {Array<{lat,lon,depth,mag,place,time}>} quakes — from parseQuakes()
   */
  function refresh(quakes) {
    cloud.update(quakes, {
      position: (q) => ({ lat: q.lat, lon: q.lon }),
      color: colorForQuake,
      size: (q) => magToSize(q.mag),
    });
  }

  return {
    mesh: cloud.mesh,
    refresh,
    get count() { return cloud.count; },
    dispose() { cloud.dispose(); },
  };
}

module.exports = { createQuakeLayer, magToSize, DEPTH_COLORS };
