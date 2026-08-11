/**
 * Satellite catalogue visualization layer.
 *
 * Renders all tracked satellites as category-coloured dots using points.js.
 * Position data comes from catalogue.js (propagateToECEF).
 *
 * THREE is dependency-injected for testability.
 */

'use strict';

const { createPointCloud, hexToRGB } = require('./points');
const { CATEGORIES } = require('./catalogue');

// Precompute category colours as RGB 0-1
const CATEGORY_RGB = {};
for (const [key, cat] of Object.entries(CATEGORIES)) {
  CATEGORY_RGB[key] = hexToRGB(cat.css);
}

/**
 * Create the satellite catalogue layer.
 *
 * @param {object} THREE
 * @param {object} [opts]
 * @param {number} [opts.maxPoints] — capacity (default 10000)
 * @returns {{ mesh, refresh(positions), count, dispose }}
 */
function createSatellitesLayer(THREE, opts = {}) {
  const cloud = createPointCloud(THREE, {
    maxPoints: opts.maxPoints ?? 10000,
    defaultSize: 2,
    sizeAttenuation: false,
  });

  cloud.mesh.name = 'satellites';

  /**
   * Refresh satellite positions.
   *
   * @param {Array<{ecef: {x,y,z}, category: string}>} satellites
   *   — ecef in meters, category key from catalogue.js
   */
  function refresh(satellites) {
    cloud.update(satellites, {
      position: (s) => ({
        // points.js expects {lat, lon, alt} and calls geoToEcef internally,
        // but we already have ECEF. Use a direct override via _ecef flag.
        lat: 0, lon: 0, alt: 0,
        _ecef: s.ecef,
      }),
      color: (s) => CATEGORY_RGB[s.category] ?? CATEGORY_RGB.other,
      size: (s) => CATEGORIES[s.category]?.size ?? 2,
    });
  }

  /**
   * Direct ECEF update — bypasses geoToEcef for performance.
   * Preferred when caller already has ECEF positions.
   *
   * @param {Array<{ecef: {x,y,z}, category: string}>} satellites
   */
  function refreshECEF(satellites) {
    const geom = cloud.mesh.geometry;
    const posAttr = geom.getAttribute('position');
    const colAttr = geom.getAttribute('color');
    const sizeAttr = geom.getAttribute('size');
    const count = Math.min(satellites.length, posAttr.array.length / 3);

    for (let i = 0; i < count; i++) {
      const s = satellites[i];
      posAttr.array[i * 3] = s.ecef.x;
      posAttr.array[i * 3 + 1] = s.ecef.y;
      posAttr.array[i * 3 + 2] = s.ecef.z;

      const col = CATEGORY_RGB[s.category] ?? CATEGORY_RGB.other;
      colAttr.array[i * 3] = col.r;
      colAttr.array[i * 3 + 1] = col.g;
      colAttr.array[i * 3 + 2] = col.b;

      sizeAttr.array[i] = CATEGORIES[s.category]?.size ?? 2;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    geom.setDrawRange(0, count);
  }

  return {
    mesh: cloud.mesh,
    refresh,
    refreshECEF,
    get count() { return cloud.count; },
    dispose() { cloud.dispose(); },
  };
}

module.exports = { createSatellitesLayer, CATEGORY_RGB };
