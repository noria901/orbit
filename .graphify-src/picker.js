/**
 * Raycaster-based point picking for the globe.
 *
 * Given a mouse event on the renderer canvas, finds the nearest data point
 * (quake, amedas station, satellite, ISS) within a configurable pixel radius.
 *
 * Layers are registered with a name and an array of items that have ECEF
 * positions. The picker projects each item to NDC, computes screen distance,
 * and returns the closest hit.
 *
 * THREE is dependency-injected for testability.
 */

'use strict';

const DEFAULT_PIXEL_RADIUS = 12;  // pixels

/**
 * Create a picker instance.
 *
 * @param {object} THREE
 * @param {object} camera     — Three.js PerspectiveCamera
 * @param {object} [opts]
 * @param {number} [opts.pixelRadius] — hit radius in CSS pixels (default 12)
 * @returns {{ addLayer, removeLayer, pick(x, y, w, h), dispose }}
 */
function createPicker(THREE, camera, opts = {}) {
  const pixelRadius = opts.pixelRadius ?? DEFAULT_PIXEL_RADIUS;
  const layers = new Map();  // name → { items, getECEF }

  /**
   * Register a data layer for picking.
   *
   * @param {string} name       — layer identifier
   * @param {object} descriptor
   * @param {function} descriptor.getItems   — () => array of items
   * @param {function} descriptor.getECEF    — (item) => {x, y, z} in meters
   */
  function addLayer(name, descriptor) {
    layers.set(name, descriptor);
  }

  function removeLayer(name) {
    layers.delete(name);
  }

  // Reusable Vector3 for projection (avoids GC pressure)
  const worldPos = new THREE.Vector3();
  const projPos = new THREE.Vector3();

  /**
   * Find the closest data point under the mouse cursor.
   *
   * @param {number} mouseX — CSS pixel X from canvas left edge
   * @param {number} mouseY — CSS pixel Y from canvas top edge
   * @param {number} canvasW — canvas CSS width in pixels
   * @param {number} canvasH — canvas CSS height in pixels
   * @returns {{ layer: string, item: any, dist: number } | null}
   */
  function pick(mouseX, mouseY, canvasW, canvasH) {
    const ndcX = (mouseX / canvasW) * 2 - 1;
    const ndcY = -(mouseY / canvasH) * 2 + 1;

    let best = null;
    let bestPixelDist = pixelRadius;

    for (const [name, desc] of layers) {
      const items = desc.getItems();
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const ecef = desc.getECEF(item);

        worldPos.set(ecef.x, ecef.y, ecef.z);
        projPos.copy(worldPos).project(camera);

        // projPos is in NDC [-1,1]; convert to pixel space
        const px = (projPos.x * 0.5 + 0.5) * canvasW;
        const py = (-projPos.y * 0.5 + 0.5) * canvasH;

        const dx = px - mouseX;
        const dy = py - mouseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Reject points behind camera (projPos.z > 1 in clip space)
        if (projPos.z > 1) continue;

        if (dist < bestPixelDist) {
          bestPixelDist = dist;
          best = { layer: name, item, dist, index: i };
        }
      }
    }

    return best;
  }

  return { addLayer, removeLayer, pick };
}

module.exports = { createPicker, DEFAULT_PIXEL_RADIUS };
