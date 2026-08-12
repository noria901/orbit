/**
 * GPU instanced point renderer — shared base for quake, amedas, satellite dots.
 *
 * Uses Three.js Points (GL_POINTS) with a BufferGeometry.
 * Each point has: position (vec3), color (vec3), size (float).
 *
 * The caller provides an array of items, plus accessor functions
 * to extract position/color/size from each item.
 *
 * THREE is dependency-injected for testability.
 */

'use strict';

const { geoToEcef } = require('./geo');

/**
 * Create a point cloud layer.
 *
 * @param {object} THREE
 * @param {object} [opts]
 * @param {number} [opts.maxPoints]    — pre-allocated capacity (default 10000)
 * @param {number} [opts.defaultSize]  — fallback point size (default 4)
 * @param {boolean} [opts.sizeAttenuation] — scale with distance (default true)
 * @param {boolean} [opts.depthWrite]  — (default false)
 * @returns {{ mesh, update(items, accessors), count, dispose }}
 */
function createPointCloud(THREE, opts = {}) {
  const maxPoints = opts.maxPoints ?? 10000;
  const defaultSize = opts.defaultSize ?? 4;
  const sizeAttenuation = opts.sizeAttenuation ?? true;

  const positions = new Float32Array(maxPoints * 3);
  const colors = new Float32Array(maxPoints * 3);
  const sizes = new Float32Array(maxPoints);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  // Draw nothing initially
  geometry.setDrawRange(0, 0);

  const material = new THREE.PointsMaterial({
    vertexColors: true,
    size: defaultSize,
    sizeAttenuation,
    depthWrite: opts.depthWrite ?? false,
    transparent: true,
  });

  const mesh = new THREE.Points(geometry, material);
  mesh.frustumCulled = false; // always draw (Earth-scale points)

  let currentCount = 0;

  /**
   * Update the point cloud with new data.
   *
   * @param {Array} items — data items
   * @param {object} accessors
   * @param {function} accessors.position — (item) => {lat, lon, alt?} degrees/meters
   * @param {function} accessors.color    — (item) => {r, g, b} 0-1
   * @param {function} [accessors.size]   — (item) => number (pixel size)
   */
  function update(items, accessors) {
    const count = Math.min(items.length, maxPoints);
    const posAttr = geometry.getAttribute('position');
    const colAttr = geometry.getAttribute('color');
    const sizeAttr = geometry.getAttribute('size');

    const ecef = {};
    for (let i = 0; i < count; i++) {
      const item = items[i];
      const geo = accessors.position(item);
      geoToEcef(geo.lat, geo.lon, geo.alt ?? 0, ecef);

      posAttr.array[i * 3] = ecef.x;
      posAttr.array[i * 3 + 1] = ecef.y;
      posAttr.array[i * 3 + 2] = ecef.z;

      const col = accessors.color(item);
      colAttr.array[i * 3] = col.r;
      colAttr.array[i * 3 + 1] = col.g;
      colAttr.array[i * 3 + 2] = col.b;

      sizeAttr.array[i] = accessors.size ? accessors.size(item) : defaultSize;
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    geometry.setDrawRange(0, count);
    currentCount = count;
  }

  return {
    mesh,
    update,
    get count() { return currentCount; },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * Parse a CSS hex color (#RRGGBB) to {r, g, b} in 0-1 range.
 */
function hexToRGB(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return {
    r: ((n >> 16) & 0xff) / 255,
    g: ((n >> 8) & 0xff) / 255,
    b: (n & 0xff) / 255,
  };
}

module.exports = { createPointCloud, hexToRGB };
