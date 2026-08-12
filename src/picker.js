/**
 * Picking: nearest-point-in-screen-space for point-cloud layers (quakes,
 * amedas, satellites, ISS), plus a Raycaster-based earth-surface probe.
 *
 * Point clouds use screen-space distance rather than Raycaster+threshold
 * because with tens of thousands of points, per-pixel raycasting against
 * a Points object is comparatively expensive and less predictable than a
 * simple projected-distance nearest-neighbour scan.
 */

'use strict';

import { ecefToGeo } from './geo.js';

/**
 * Pure nearest-candidate search in screen space.
 * @param {Array<{x,y,z,kind,index?}>} candidates - ECEF positions + metadata
 * @param {number} mx - mouse X in CSS pixels
 * @param {number} my - mouse Y in CSS pixels
 * @param {(x:number,y:number,z:number) => {screenX:number, screenY:number, behindCamera:boolean}} project
 * @param {number} [maxDist=12] - pixel threshold
 * @returns {object|null} the nearest candidate within maxDist, or null
 */
function findNearest(candidates, mx, my, project, maxDist = 12) {
  let best = null, bestDist = maxDist;
  for (const c of candidates) {
    const { screenX, screenY, behindCamera } = project(c.x, c.y, c.z);
    if (behindCamera) continue;
    const d = Math.hypot(screenX - mx, screenY - my);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

/**
 * @param {object} THREE
 * @param {THREE.Camera} camera
 * @param {number} width - viewport CSS width
 * @param {number} height - viewport CSS height
 */
function createPicker(THREE, camera, getViewportSize) {
  const projVec = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const mouseNDC = new THREE.Vector2();

  function project(x, y, z) {
    const { width, height } = getViewportSize();
    projVec.set(x, y, z).project(camera);
    return {
      screenX: (projVec.x * 0.5 + 0.5) * width,
      screenY: (-projVec.y * 0.5 + 0.5) * height,
      behindCamera: projVec.z > 1,
    };
  }

  /** @param {Array<{x,y,z,kind,index?}>} candidates */
  function pickNearest(candidates, mx, my, maxDist = 12) {
    return findNearest(candidates, mx, my, project, maxDist);
  }

  /**
   * Raycast against the earth mesh; returns geodetic {latitude,longitude}
   * of the hit point, or null if the click missed the globe.
   */
  function probeEarth(mx, my, earthMesh) {
    const { width, height } = getViewportSize();
    mouseNDC.set((mx / width) * 2 - 1, -(my / height) * 2 + 1);
    raycaster.setFromCamera(mouseNDC, camera);
    const hits = raycaster.intersectObject(earthMesh);
    if (hits.length === 0) return null;
    const p = hits[0].point;
    const geo = ecefToGeo(p.x, p.y, p.z);
    return { latitude: geo.latitude, longitude: geo.longitude };
  }

  return { pickNearest, probeEarth };
}

export { findNearest, createPicker };
