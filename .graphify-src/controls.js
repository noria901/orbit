/**
 * Orbit camera controls — spherical coordinate camera around the Earth.
 *
 * Handles mouse/touch input for rotation and zooming with inertia.
 * Camera orbits the origin (Earth centre) at a configurable distance.
 *
 * This module is pure logic — input binding happens externally.
 * THREE is NOT required; the module works with plain {x,y,z} objects.
 */

const { WGS84_A } = require('./geo');

const MIN_DISTANCE = WGS84_A * 1.02;   // ~100km above surface
const MAX_DISTANCE = WGS84_A * 10;     // ~57,000km
const INERTIA_DECAY = 0.92;
const ROTATE_SPEED = 0.003;            // radians per pixel
const ZOOM_SPEED = 0.1;                // fraction per scroll unit

/**
 * Create orbit controls state and update functions.
 *
 * @param {object} [opts]
 * @param {number} [opts.distance]     — initial distance from origin (m)
 * @param {number} [opts.theta]        — initial azimuth (radians, 0 = +X)
 * @param {number} [opts.phi]          — initial polar angle (radians, 0 = +Z pole)
 * @param {number} [opts.minDistance]
 * @param {number} [opts.maxDistance]
 * @param {number} [opts.rotateSpeed]
 * @param {number} [opts.zoomSpeed]
 * @param {number} [opts.inertiaDecay]
 * @returns {object}
 */
function createOrbitControls(opts = {}) {
  let distance = opts.distance ?? WGS84_A * 5;
  let theta = opts.theta ?? 0;           // azimuth
  let phi = opts.phi ?? Math.PI / 2;     // polar (pi/2 = equator)

  const minDist = opts.minDistance ?? MIN_DISTANCE;
  const maxDist = opts.maxDistance ?? MAX_DISTANCE;
  const rotSpeed = opts.rotateSpeed ?? ROTATE_SPEED;
  const zmSpeed = opts.zoomSpeed ?? ZOOM_SPEED;
  const decay = opts.inertiaDecay ?? INERTIA_DECAY;

  // Inertia velocities
  let vTheta = 0;
  let vPhi = 0;
  let dragging = false;

  /**
   * Apply a rotation delta (from mouse/touch drag).
   * @param {number} dx — horizontal pixels
   * @param {number} dy — vertical pixels
   */
  function rotate(dx, dy) {
    theta -= dx * rotSpeed;
    phi -= dy * rotSpeed;
    phi = clampPhi(phi);

    vTheta = -dx * rotSpeed;
    vPhi = -dy * rotSpeed;
  }

  /**
   * Apply zoom (from scroll wheel or pinch).
   * @param {number} delta — positive = zoom in, negative = zoom out
   */
  function zoom(delta) {
    const factor = 1 - delta * zmSpeed;
    distance = clampDistance(distance * factor, minDist, maxDist);
  }

  /**
   * Tick the inertia simulation. Call once per frame.
   * Returns the current camera position in Cartesian {x, y, z}.
   */
  function update() {
    if (!dragging) {
      theta += vTheta;
      phi += vPhi;
      phi = clampPhi(phi);
      vTheta *= decay;
      vPhi *= decay;

      // Stop when negligible
      if (Math.abs(vTheta) < 1e-6) vTheta = 0;
      if (Math.abs(vPhi) < 1e-6) vPhi = 0;
    }

    return sphericalToCartesian(distance, theta, phi);
  }

  function startDrag() { dragging = true; }
  function endDrag() { dragging = false; }

  return {
    rotate,
    zoom,
    update,
    startDrag,
    endDrag,
    get distance() { return distance; },
    set distance(d) { distance = clampDistance(d, minDist, maxDist); },
    get theta() { return theta; },
    set theta(t) { theta = t; },
    get phi() { return phi; },
    set phi(p) { phi = clampPhi(p); },
    get dragging() { return dragging; },
  };
}

/**
 * Clamp polar angle to avoid gimbal lock at poles.
 */
function clampPhi(phi) {
  return Math.max(0.01, Math.min(Math.PI - 0.01, phi));
}

function clampDistance(d, min, max) {
  return Math.max(min, Math.min(max, d));
}

/**
 * Convert spherical (distance, theta, phi) to Cartesian {x, y, z}.
 * theta: azimuth from +X axis in XY plane
 * phi: polar angle from +Z axis (0 = north pole, pi = south pole)
 */
function sphericalToCartesian(r, theta, phi) {
  const sinPhi = Math.sin(phi);
  return {
    x: r * sinPhi * Math.cos(theta),
    y: r * sinPhi * Math.sin(theta),
    z: r * Math.cos(phi),
  };
}

module.exports = {
  createOrbitControls,
  sphericalToCartesian,
  clampPhi,
  MIN_DISTANCE,
  MAX_DISTANCE,
};
