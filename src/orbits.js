/**
 * Ground-track polyline for a satellite (e.g. QZSS's figure-eight analemma).
 * Samples one sidereal day of propagation from `satrec`.
 */

'use strict';

import { propagateToECEF } from './catalogue.js';

/**
 * Pure sampling function: returns a flat [x,y,z,x,y,z,...] array tracing
 * the satellite's ECEF path starting at `startMs` over one sidereal day.
 * Testable with a stub satelliteLib.
 *
 * @param {object} satrec
 * @param {object} satelliteLib
 * @param {number} startMs
 * @param {number} [steps=288] - 288 * 5min = 24h
 * @returns {number[]}
 */
function sampleGroundTrack(satrec, satelliteLib, startMs, steps = 288) {
  const pts = [];
  for (let k = 0; k <= steps; k++) {
    const t = new Date(startMs + k * 300000);
    const p = propagateToECEF(satrec, t, satelliteLib);
    if (!p) continue;
    pts.push(p.x, p.y, p.z);
  }
  return pts;
}

/** @param {object} THREE */
function createOrbitTrack(THREE, color = 0xFFC94D) {
  const geom = new THREE.BufferGeometry();
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.55 });
  const line = new THREE.Line(geom, material);
  line.name = 'orbit-track';
  line.frustumCulled = false;

  function draw(satrec, satelliteLib, startMs = Date.now(), steps = 288) {
    const pts = sampleGroundTrack(satrec, satelliteLib, startMs, steps);
    if (pts.length < 6) return false;
    geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
    geom.setDrawRange(0, pts.length / 3);
    return true;
  }

  return { line, draw };
}

export { sampleGroundTrack, createOrbitTrack };
