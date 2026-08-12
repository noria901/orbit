/**
 * Orbital path and ground trace line rendering.
 *
 * Draws:
 * 1. 3D orbital path (Line at satellite altitude)
 * 2. Ground trace (Line projected to Earth surface)
 *
 * Uses BufferGeometry with pre-allocated vertex arrays that get
 * updated when the orbit is recomputed.
 *
 * THREE is dependency-injected for testability.
 */

'use strict';

const { geoToEcef } = require('./geo');

const DEFAULT_SEGMENTS = 180;  // one point per 2° of orbit
const ORBIT_COLOR = 0x5FD3E8;
const TRACE_COLOR = 0x5FD3E8;
const TRACE_OPACITY = 0.3;

/**
 * Create an orbit + ground trace line group.
 *
 * @param {object} THREE
 * @param {object} [opts]
 * @param {number} [opts.maxSegments] — max vertices (default 180)
 * @param {number} [opts.orbitColor]  — (default 0x5FD3E8)
 * @param {number} [opts.traceColor] — (default 0x5FD3E8)
 * @returns {{ group, updateOrbit(geoPoints), updateTrace(geoPoints), dispose }}
 */
function createOrbitLines(THREE, opts = {}) {
  const maxSeg = opts.maxSegments ?? DEFAULT_SEGMENTS;
  const group = new THREE.Group();
  group.name = 'orbit-lines';

  // --- Orbital path (3D) ---
  const orbitPos = new Float32Array(maxSeg * 3);
  const orbitGeom = new THREE.BufferGeometry();
  orbitGeom.setAttribute('position', new THREE.BufferAttribute(orbitPos, 3));
  orbitGeom.setDrawRange(0, 0);

  const orbitMat = new THREE.LineBasicMaterial({
    color: opts.orbitColor ?? ORBIT_COLOR,
    transparent: true,
    opacity: 0.7,
  });
  const orbitLine = new THREE.Line(orbitGeom, orbitMat);
  orbitLine.name = 'orbit-path';
  orbitLine.frustumCulled = false;
  group.add(orbitLine);

  // --- Ground trace ---
  const tracePos = new Float32Array(maxSeg * 3);
  const traceGeom = new THREE.BufferGeometry();
  traceGeom.setAttribute('position', new THREE.BufferAttribute(tracePos, 3));
  traceGeom.setDrawRange(0, 0);

  const traceMat = new THREE.LineBasicMaterial({
    color: opts.traceColor ?? TRACE_COLOR,
    transparent: true,
    opacity: TRACE_OPACITY,
  });
  const traceLine = new THREE.Line(traceGeom, traceMat);
  traceLine.name = 'ground-trace';
  traceLine.frustumCulled = false;
  group.add(traceLine);

  const ecef = {};

  /**
   * Update the orbital path with geographic points.
   * @param {Array<{lat: number, lon: number, alt: number}>} points
   *   — alt in km
   */
  function updateOrbit(points) {
    const count = Math.min(points.length, maxSeg);
    const attr = orbitGeom.getAttribute('position');
    for (let i = 0; i < count; i++) {
      const p = points[i];
      geoToEcef(p.lat, p.lon, (p.alt ?? 0) * 1000, ecef);
      attr.array[i * 3] = ecef.x;
      attr.array[i * 3 + 1] = ecef.y;
      attr.array[i * 3 + 2] = ecef.z;
    }
    attr.needsUpdate = true;
    orbitGeom.setDrawRange(0, count);
  }

  /**
   * Update the ground trace with geographic points (projected to surface).
   * @param {Array<{lat: number, lon: number}>} points
   */
  function updateTrace(points) {
    const count = Math.min(points.length, maxSeg);
    const attr = traceGeom.getAttribute('position');
    for (let i = 0; i < count; i++) {
      const p = points[i];
      geoToEcef(p.lat, p.lon, 0, ecef);
      attr.array[i * 3] = ecef.x;
      attr.array[i * 3 + 1] = ecef.y;
      attr.array[i * 3 + 2] = ecef.z;
    }
    attr.needsUpdate = true;
    traceGeom.setDrawRange(0, count);
  }

  return {
    group,
    updateOrbit,
    updateTrace,
    dispose() {
      orbitGeom.dispose();
      orbitMat.dispose();
      traceGeom.dispose();
      traceMat.dispose();
    },
  };
}

module.exports = { createOrbitLines, DEFAULT_SEGMENTS };
