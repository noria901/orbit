/**
 * Satellite catalogue layer: point cloud rendering for the whole GP/TLE
 * catalogue, colored by CATEGORIES from catalogue.js.
 */

'use strict';

import { CATEGORIES, buildSatrecs, buildCategoryIndex, propagateToECEF } from './catalogue.js';
import { createPointCloud, hexToRGB } from './points.js';

/**
 * @param {object} THREE
 * @param {number} maxPts
 */
function createSatellitesLayer(THREE, maxPts = 20000) {
  const cloud = createPointCloud(THREE, maxPts, 2, false);
  cloud.mesh.name = 'satellites';
  let records = [];
  let catIndex = {};

  /**
   * Load a parsed TLE entry list (from catalogue.parseTLE) and (re)build
   * the point cloud's static color buffer.
   * @param {object} satelliteLib - the satellite.js module
   */
  function load(entries, satelliteLib) {
    records = buildSatrecs(entries, satelliteLib);
    catIndex = buildCategoryIndex(records);

    const count = Math.min(records.length, cloud.maxPts);
    for (let i = 0; i < count; i++) {
      const c = hexToRGB(CATEGORIES[records[i].category].css);
      cloud.colors[i * 3] = c.r;
      cloud.colors[i * 3 + 1] = c.g;
      cloud.colors[i * 3 + 2] = c.b;
    }
    cloud.geom.getAttribute('color').needsUpdate = true;
    return { total: records.length, catIndex };
  }

  /** Propagate all satrecs to `date` and upload positions to the GPU buffer. */
  function updatePositions(date, satelliteLib) {
    const count = Math.min(records.length, cloud.maxPts);
    for (let i = 0; i < count; i++) {
      const p = propagateToECEF(records[i].satrec, date, satelliteLib);
      if (!p) continue; // leave last-known position rather than snapping to origin
      cloud.positions[i * 3] = p.x;
      cloud.positions[i * 3 + 1] = p.y;
      cloud.positions[i * 3 + 2] = p.z;
    }
    cloud.geom.getAttribute('position').needsUpdate = true;
    cloud.geom.setDrawRange(0, count);
  }

  return {
    mesh: cloud.mesh,
    load,
    updatePositions,
    get records() { return records; },
    get catIndex() { return catIndex; },
  };
}

export { createSatellitesLayer };
