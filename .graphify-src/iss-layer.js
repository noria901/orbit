/**
 * ISS visualization layer — marker, ground projection, label sprite.
 *
 * Renders the ISS as:
 * 1. A bright dot at orbital altitude (via a single-point Points)
 * 2. A dashed line from ISS to the ground (nadir projection)
 * 3. A text sprite label (optional, requires canvas)
 *
 * Works with iss.js tracker for position data.
 * THREE is dependency-injected for testability.
 */

'use strict';

const { geoToEcef } = require('./geo');

const ISS_COLOR = 0x00ffcc;
const GROUND_LINE_COLOR = 0x00ffcc;

/**
 * Create the ISS visualization layer.
 *
 * @param {object} THREE
 * @param {object} [opts]
 * @returns {{ group, update(geo), dispose }}
 */
function createISSLayer(THREE, opts = {}) {
  const group = new THREE.Group();
  group.name = 'iss';

  // --- ISS dot ---
  const dotGeometry = new THREE.BufferGeometry();
  const dotPositions = new Float32Array(3);
  dotGeometry.setAttribute('position', new THREE.BufferAttribute(dotPositions, 3));

  const dotMaterial = new THREE.PointsMaterial({
    color: ISS_COLOR,
    size: opts.dotSize ?? 8,
    sizeAttenuation: false,
    depthWrite: false,
  });
  const dot = new THREE.Points(dotGeometry, dotMaterial);
  dot.name = 'iss-dot';
  group.add(dot);

  // --- Ground projection line ---
  const linePositions = new Float32Array(6); // 2 points × 3 components
  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

  const lineMaterial = new THREE.LineBasicMaterial({
    color: GROUND_LINE_COLOR,
    transparent: true,
    opacity: 0.4,
  });
  const line = new THREE.Line(lineGeometry, lineMaterial);
  line.name = 'iss-nadir';
  group.add(line);

  const ecefISS = {};
  const ecefGround = {};

  /**
   * Update ISS position.
   * @param {{ latitude: number, longitude: number, altitude: number }} geo
   *   — altitude in km (from iss.js geoAt or API)
   */
  function update(geo) {
    if (!geo) return;

    const altMeters = (geo.altitude ?? 408) * 1000;
    geoToEcef(geo.latitude, geo.longitude, altMeters, ecefISS);
    geoToEcef(geo.latitude, geo.longitude, 0, ecefGround);

    // Update dot position
    const dp = dotGeometry.getAttribute('position');
    dp.array[0] = ecefISS.x;
    dp.array[1] = ecefISS.y;
    dp.array[2] = ecefISS.z;
    dp.needsUpdate = true;

    // Update nadir line (ISS → ground)
    const lp = lineGeometry.getAttribute('position');
    lp.array[0] = ecefISS.x;
    lp.array[1] = ecefISS.y;
    lp.array[2] = ecefISS.z;
    lp.array[3] = ecefGround.x;
    lp.array[4] = ecefGround.y;
    lp.array[5] = ecefGround.z;
    lp.needsUpdate = true;
  }

  return {
    group,
    update,
    dispose() {
      dotGeometry.dispose();
      dotMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
    },
  };
}

module.exports = { createISSLayer, ISS_COLOR, GROUND_LINE_COLOR };
