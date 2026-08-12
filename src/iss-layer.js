/**
 * ISS layer: real-time dot + ground-projection line, driven by the
 * dead-reckoning tracker in iss.js.
 */

'use strict';

import { geoToEcef } from './geo.js';

/** @param {object} THREE */
function createISSLayer(THREE) {
  const group = new THREE.Group();
  group.name = 'iss';

  const dotGeom = new THREE.BufferGeometry();
  dotGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
  const dot = new THREE.Points(
    dotGeom,
    new THREE.PointsMaterial({ color: 0x00ffcc, size: 8, sizeAttenuation: false, depthWrite: false }),
  );
  group.add(dot);

  const lineGeom = new THREE.BufferGeometry();
  lineGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(
    lineGeom,
    new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.4 }),
  );
  group.add(line);

  /**
   * Update the dot + ground line from a tracker's geoAt(dateMs) result.
   * @param {{latitude, longitude, altitude}|null} geo
   */
  function update(geo) {
    if (!geo) return;
    const altM = geo.altitude * 1000;
    const iss = geoToEcef(geo.latitude, geo.longitude, altM);
    const ground = geoToEcef(geo.latitude, geo.longitude, 0);

    const dp = dotGeom.getAttribute('position');
    dp.array[0] = iss.x; dp.array[1] = iss.y; dp.array[2] = iss.z;
    dp.needsUpdate = true;

    const lp = lineGeom.getAttribute('position');
    lp.array[0] = iss.x; lp.array[1] = iss.y; lp.array[2] = iss.z;
    lp.array[3] = ground.x; lp.array[4] = ground.y; lp.array[5] = ground.z;
    lp.needsUpdate = true;

    return iss; // handy for camera flyTo/tracking callers
  }

  return { group, dot, line, update };
}

export { createISSLayer };
