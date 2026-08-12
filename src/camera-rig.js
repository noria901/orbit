/**
 * flyTo animation (great-circle slerp) + manual delta-translate tracking.
 *
 * Ported from the Cesium-era implementation after a long debugging saga
 * (see CLAUDE.md, "高速移動オブジェクトのカメラ追従"). Key lessons carried
 * over into this from-scratch version:
 *   - Never rely on a built-in "track this entity" camera abstraction;
 *     it fights manual flyTo animation and user drag input. Tracking here
 *     is just "add the target's frame-to-frame position delta to the
 *     camera position" — nothing touches camera orientation/transform.
 *   - When flying to a fast-moving target (ISS ~7.66km/s), fly toward the
 *     PREDICTED position at arrival time, not the position at click time,
 *     or the camera arrives at empty space the target already left.
 */

'use strict';

/** Spherical-linear interpolation between two ECEF points (interpolates
 *  direction and radius separately, so the path stays roughly on a
 *  constant-altitude great-circle arc rather than cutting through Earth). */
function slerpECEF(from, to, t, out = {}) {
  const r0 = Math.sqrt(from.x ** 2 + from.y ** 2 + from.z ** 2);
  const r1 = Math.sqrt(to.x ** 2 + to.y ** 2 + to.z ** 2);
  const fx = from.x / r0, fy = from.y / r0, fz = from.z / r0;
  const tx = to.x / r1, ty = to.y / r1, tz = to.z / r1;
  const dot = Math.max(-1, Math.min(1, fx * tx + fy * ty + fz * tz));
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
 * Compute a flyTo destination: along the ray from Earth's center through
 * targetECEF, at `altitude` meters beyond the target's own radius.
 */
function flyToDestination(targetECEF, altitude) {
  const r = Math.sqrt(targetECEF.x ** 2 + targetECEF.y ** 2 + targetECEF.z ** 2);
  const scale = r > 1 ? (r + altitude) / r : 1;
  return { x: targetECEF.x * scale, y: targetECEF.y * scale, z: targetECEF.z * scale };
}

/**
 * Create a camera rig managing flyTo animation + post-arrival tracking.
 * The caller supplies a `getCameraPosition`/`setCameraPosition` pair so
 * this module has zero direct Three.js dependency (easier to test, and
 * keeps the animation math reusable if the renderer ever changes).
 */
function createCameraRig({ getCameraPosition, setCameraPosition }) {
  let fly = null; // { from, to, start, duration, onEnd }
  let trackGetPos = null, trackLastPos = null;

  function flyTo(targetECEF, { altitude = 2000000, duration = 2400, onEnd = null } = {}) {
    fly = {
      from: getCameraPosition(),
      to: flyToDestination(targetECEF, altitude),
      start: null,
      duration,
      onEnd,
    };
  }

  function startTracking(getPositionFn) {
    trackGetPos = getPositionFn;
    trackLastPos = null;
  }
  function stopTracking() {
    trackGetPos = null;
    trackLastPos = null;
  }
  function isTracking() { return trackGetPos !== null; }

  /** Call once per animation frame with the current high-res timestamp (ms). */
  function tick(nowMs) {
    if (fly) {
      if (fly.start === null) fly.start = nowMs;
      const t = Math.min(1, (nowMs - fly.start) / fly.duration);
      const eased = 1 - (1 - t) ** 3; // ease-out cubic
      const pos = slerpECEF(fly.from, fly.to, eased);
      setCameraPosition(pos);
      if (t >= 1) {
        const cb = fly.onEnd;
        fly = null;
        if (cb) cb();
        return;
      }
      return; // don't also apply tracking mid-flight
    }
    if (trackGetPos) {
      const pos = trackGetPos();
      if (!pos) return;
      if (trackLastPos) {
        const cur = getCameraPosition();
        setCameraPosition({
          x: cur.x + (pos.x - trackLastPos.x),
          y: cur.y + (pos.y - trackLastPos.y),
          z: cur.z + (pos.z - trackLastPos.z),
        });
      }
      trackLastPos = pos;
    }
  }

  function isFlying() { return fly !== null; }

  return { flyTo, startTracking, stopTracking, isTracking, isFlying, tick };
}

export { slerpECEF, flyToDestination, createCameraRig };
