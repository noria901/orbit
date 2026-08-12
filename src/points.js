/**
 * Generic Three.js Points (point-cloud) helper, used by the quake/amedas/
 * satellite layers. Pre-allocates fixed-size buffers (no per-frame GC
 * churn) and exposes a draw range so the number of visible points can
 * change without reallocating.
 */

'use strict';

/** '#RRGGBB' -> {r,g,b} in [0,1]. Pure function, no Three.js dependency. */
function hexToRGB(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 };
}

/**
 * @param {object} THREE
 * @param {number} maxPts - fixed buffer capacity
 * @param {number} [defaultSize=4]
 * @param {boolean} [sizeAttenuation=false] - true = shrink with distance (world-space feel), false = constant screen size
 */
function createPointCloud(THREE, maxPts, defaultSize = 4, sizeAttenuation = false) {
  const positions = new Float32Array(maxPts * 3);
  const colors = new Float32Array(maxPts * 3);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.setDrawRange(0, 0);
  const material = new THREE.PointsMaterial({
    vertexColors: true, size: defaultSize, sizeAttenuation, depthWrite: false, transparent: true,
  });
  const mesh = new THREE.Points(geom, material);
  mesh.frustumCulled = false;
  return { mesh, geom, positions, colors, maxPts };
}

/**
 * Write {x,y,z,color:'#RRGGBB'}[] into a point cloud's buffers and flag
 * them for GPU upload. Silently truncates to the cloud's capacity.
 */
function updatePointCloud(cloud, items) {
  const count = Math.min(items.length, cloud.maxPts);
  for (let i = 0; i < count; i++) {
    const it = items[i];
    cloud.positions[i * 3] = it.x;
    cloud.positions[i * 3 + 1] = it.y;
    cloud.positions[i * 3 + 2] = it.z;
    const c = hexToRGB(it.color);
    cloud.colors[i * 3] = c.r;
    cloud.colors[i * 3 + 1] = c.g;
    cloud.colors[i * 3 + 2] = c.b;
  }
  cloud.geom.getAttribute('position').needsUpdate = true;
  cloud.geom.getAttribute('color').needsUpdate = true;
  cloud.geom.setDrawRange(0, count);
  return count;
}

export { hexToRGB, createPointCloud, updatePointCloud };
