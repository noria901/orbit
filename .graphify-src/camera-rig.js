/**
 * Camera rig — flyTo animation and target-tracking mode.
 *
 * Implements two modes:
 *
 * 1. flyTo(targetECEF, opts): smooth spherical interpolation from current
 *    camera position to a point above the target. Integrates with
 *    controls.js for post-fly spherical state.
 *
 * 2. Tracking mode: per-frame, shifts the camera position by the same
 *    delta that the tracked target has moved since the last frame.
 *    Matches the approach proven in the existing Cesium implementation
 *    (scene.postUpdate parallel translation, no camera.transform touching).
 *
 * THREE is dependency-injected. The rig mutates the camera.position
 * directly, so it is compatible with any Three.js camera.
 *
 * Lessons from CLAUDE.md applied:
 * - No trackedEntity equivalent; tracking is pure position delta.
 * - flyTo uses predicted future position (caller must supply it).
 * - Camera transform is never modified — only position.
 */

'use strict';

const DEFAULT_FLY_DURATION = 2400; // ms
const DEFAULT_FLY_ALTITUDE  = 2000000; // m above target
const EASING_POWER = 2;

/**
 * Smooth easing function (ease in-out quadratic).
 */
function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, EASING_POWER) / 2;
}

/**
 * Spherical linear interpolation between two 3D positions.
 * Keeps the camera at a constant angular distance from origin during fly.
 *
 * @param {object} from — {x,y,z} start position
 * @param {object} to   — {x,y,z} end position
 * @param {number} t    — 0-1
 * @param {object} out  — result {x,y,z}
 */
function slerp(from, to, t, out) {
  const r0 = Math.sqrt(from.x**2 + from.y**2 + from.z**2);
  const r1 = Math.sqrt(to.x**2 + to.y**2 + to.z**2);

  // Normalise
  const fx = from.x / r0, fy = from.y / r0, fz = from.z / r0;
  const tx = to.x / r1,   ty = to.y / r1,   tz = to.z / r1;

  let dot = fx * tx + fy * ty + fz * tz;
  dot = Math.max(-1, Math.min(1, dot));

  const angle = Math.acos(dot);
  const r = r0 + (r1 - r0) * t;

  if (Math.abs(angle) < 1e-6) {
    out.x = from.x + (to.x - from.x) * t;
    out.y = from.y + (to.y - from.y) * t;
    out.z = from.z + (to.z - from.z) * t;
    return out;
  }

  const sinA = Math.sin(angle);
  const s0 = Math.sin((1 - t) * angle) / sinA;
  const s1 = Math.sin(t * angle) / sinA;

  out.x = (fx * s0 + tx * s1) * r;
  out.y = (fy * s0 + ty * s1) * r;
  out.z = (fz * s0 + tz * s1) * r;
  return out;
}

/**
 * Compute a camera position above targetECEF at altitude meters.
 * Places the camera radially outward from Earth centre.
 */
function cameraPositionAbove(targetECEF, altitude) {
  const r = Math.sqrt(targetECEF.x**2 + targetECEF.y**2 + targetECEF.z**2);
  if (r < 1) return { x: 0, y: 0, z: altitude };
  const scale = (r + altitude) / r;
  return { x: targetECEF.x * scale, y: targetECEF.y * scale, z: targetECEF.z * scale };
}

/**
 * Create the camera rig.
 *
 * @param {object} camera — Three.js camera (must have .position.set() and .lookAt())
 * @param {object} [opts]
 * @param {number} [opts.flyDuration]  — ms (default 2400)
 * @param {number} [opts.flyAltitude]  — m above target (default 2,000,000)
 * @returns {{
 *   flyTo(targetECEF, opts?),
 *   startTracking(getPositionFn),
 *   stopTracking(),
 *   tick(nowMs),
 *   get flying(), get tracking()
 * }}
 */
function createCameraRig(camera, opts = {}) {
  const flyDuration = opts.flyDuration ?? DEFAULT_FLY_DURATION;
  const flyAltitude = opts.flyAltitude ?? DEFAULT_FLY_ALTITUDE;

  // Fly state
  let flyStart = null;
  let flyFrom = null;
  let flyTo_ = null;
  let flyDur = flyDuration;
  let onFlyEnd = null;

  // Track state
  let trackGetPos = null;
  let trackLastPos = null;

  const _tmp = { x: 0, y: 0, z: 0 };

  /**
   * Smoothly fly to a position above targetECEF.
   *
   * @param {{ x,y,z }} targetECEF — ECEF metres (caller supplies predicted position)
   * @param {object} [flyOpts]
   * @param {number} [flyOpts.altitude]    — override fly altitude
   * @param {number} [flyOpts.duration]    — override fly duration ms
   * @param {function} [flyOpts.onEnd]     — callback when fly completes
   */
  function flyTo(targetECEF, flyOpts = {}) {
    const alt = flyOpts.altitude ?? flyAltitude;
    const dest = cameraPositionAbove(targetECEF, alt);

    flyFrom = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    };
    flyTo_ = dest;
    flyDur  = flyOpts.duration ?? flyDuration;
    flyStart = null; // will be set on first tick
    onFlyEnd = flyOpts.onEnd ?? null;
  }

  /**
   * Begin tracking a moving target.
   * Each tick, camera shifts by the delta of the target's ECEF position.
   *
   * @param {function} getPositionFn — () => {x,y,z} current target ECEF
   */
  function startTracking(getPositionFn) {
    trackGetPos  = getPositionFn;
    trackLastPos = null; // will be set on first tick
  }

  function stopTracking() {
    trackGetPos  = null;
    trackLastPos = null;
  }

  /**
   * Advance the rig by one frame.
   * Call this inside the animation loop.
   *
   * @param {number} nowMs — performance.now() or Date.now()
   */
  function tick(nowMs) {
    // --- Fly animation ---
    if (flyTo_ !== null) {
      if (flyStart === null) flyStart = nowMs;

      const elapsed = nowMs - flyStart;
      const raw = Math.min(elapsed / flyDur, 1);
      const t = easeInOut(raw);

      slerp(flyFrom, flyTo_, t, _tmp);
      camera.position.set(_tmp.x, _tmp.y, _tmp.z);

      if (raw >= 1) {
        flyTo_ = null;
        flyFrom = null;
        flyStart = null;
        if (onFlyEnd) { onFlyEnd(); onFlyEnd = null; }
      }
      return; // don't apply tracking during fly
    }

    // --- Tracking ---
    if (trackGetPos) {
      const pos = trackGetPos();
      if (pos) {
        if (trackLastPos) {
          const dx = pos.x - trackLastPos.x;
          const dy = pos.y - trackLastPos.y;
          const dz = pos.z - trackLastPos.z;
          camera.position.x += dx;
          camera.position.y += dy;
          camera.position.z += dz;
        }
        trackLastPos = { x: pos.x, y: pos.y, z: pos.z };
      }
    }
  }

  return {
    flyTo,
    startTracking,
    stopTracking,
    tick,
    get flying()   { return flyTo_ !== null; },
    get tracking() { return trackGetPos !== null; },
  };
}

module.exports = {
  createCameraRig,
  slerp,
  cameraPositionAbove,
  easeInOut,
  DEFAULT_FLY_DURATION,
  DEFAULT_FLY_ALTITUDE,
};
