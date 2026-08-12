/**
 * AMeDAS layer: raw JMA observation object -> point-cloud render items.
 */

'use strict';

import { geoToEcef } from './geo.js';
import { tempColor } from './data.js';
import { createPointCloud, updatePointCloud } from './points.js';

/**
 * Pure transform: (obs map, station meta map) -> render items.
 * Skips stations with no valid temperature reading (quality flag !== 0).
 * @returns {Array<{x,y,z,color,name,temp,wind,rain,hum}>}
 */
function amedasToRenderItems(obs, meta) {
  if (!meta) return [];
  const ecef = {};
  const items = [];
  for (const [id, v] of Object.entries(obs)) {
    const m = meta[id];
    if (!m || !v.temp || v.temp[1] !== 0) continue;
    const temp = v.temp[0];
    const lat = m.lat[0] + m.lat[1] / 60, lon = m.lon[0] + m.lon[1] / 60;
    geoToEcef(lat, lon, 0, ecef);
    items.push({
      x: ecef.x, y: ecef.y, z: ecef.z,
      color: tempColor(temp),
      name: m.kjName || id,
      temp,
      wind: (v.wind && v.wind[1] === 0) ? v.wind[0] : null,
      rain: (v.precipitation1h && v.precipitation1h[1] === 0) ? v.precipitation1h[0] : null,
      hum: (v.humidity && v.humidity[1] === 0) ? v.humidity[0] : null,
    });
  }
  return items;
}

/** @param {object} THREE */
function createAmedasLayer(THREE, maxPts = 2000) {
  const cloud = createPointCloud(THREE, maxPts, 3, true);
  cloud.mesh.name = 'amedas';
  let items = [];

  function render(obs, meta) {
    items = amedasToRenderItems(obs, meta);
    const shown = updatePointCloud(cloud, items);
    return { total: items.length, shown };
  }

  return { mesh: cloud.mesh, render, get items() { return items; } };
}

export { amedasToRenderItems, createAmedasLayer };
