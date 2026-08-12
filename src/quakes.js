/**
 * Earthquake layer: USGS GeoJSON -> point-cloud render items.
 */

'use strict';

import { geoToEcef } from './geo.js';
import { depthColor } from './data.js';
import { createPointCloud, updatePointCloud } from './points.js';

/**
 * Pure transform: USGS GeoJSON FeatureCollection -> render items.
 * No Three.js/DOM dependency, fully testable.
 * @param {object} geojson
 * @returns {Array<{x,y,z,color,mag,depth,place,time}>}
 */
function quakesToRenderItems(geojson) {
  const ecef = {};
  return (geojson.features || []).map((f) => {
    const [lon, lat, dep] = f.geometry.coordinates;
    const depth = dep ?? 10;
    const mag = f.properties.mag || 2.5;
    geoToEcef(lat, lon, 0, ecef);
    return {
      x: ecef.x, y: ecef.y, z: ecef.z,
      color: depthColor(depth),
      mag, depth, place: f.properties.place, time: f.properties.time,
    };
  });
}

/** @param {object} THREE */
function createQuakeLayer(THREE, maxPts = 500) {
  const cloud = createPointCloud(THREE, maxPts, 5, true);
  cloud.mesh.name = 'quakes';
  let items = [];

  function render(geojson) {
    items = quakesToRenderItems(geojson);
    const shown = updatePointCloud(cloud, items);
    return { total: items.length, shown };
  }

  return { mesh: cloud.mesh, render, get items() { return items; } };
}

export { quakesToRenderItems, createQuakeLayer };
