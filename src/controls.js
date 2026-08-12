/**
 * Manual spherical orbit controls (drag to rotate, wheel to zoom).
 *
 * Deliberately not using Three.js's OrbitControls or any "look at target"
 * abstraction — this project's Cesium-era lesson was that built-in
 * "track this thing" camera abstractions fight custom fly-to/tracking
 * logic. A plain spherical (theta, phi, distance) state that the caller
 * reads each frame avoids that class of bug entirely.
 */

'use strict';

/** Clamp polar angle away from the poles to avoid gimbal-lock flips. */
function clampPhi(p) {
  return Math.max(0.01, Math.min(Math.PI - 0.01, p));
}

/** Convert spherical (radius, theta=azimuth, phi=polar) to Cartesian XYZ. */
function sphericalToXYZ(r, theta, phi, out = {}) {
  const sp = Math.sin(phi);
  out.x = r * sp * Math.cos(theta);
  out.y = r * sp * Math.sin(theta);
  out.z = r * Math.cos(phi);
  return out;
}

/**
 * Create a spherical-orbit controller bound to a DOM element.
 *
 * @param {HTMLElement} domElement - typically the renderer's canvas
 * @param {object} [options]
 * @param {number} [options.minDistance]
 * @param {number} [options.maxDistance]
 * @param {number} [options.initialDistance]
 * @param {() => void} [options.onInteract] - called on any drag/wheel input
 */
function createControls(domElement, options = {}) {
  const {
    minDistance = 1, maxDistance = Number.MAX_VALUE,
    initialDistance = minDistance * 10,
    rotateSpeed = 0.003, zoomSpeed = 0.1, inertia = 0.92,
    onInteract = () => {},
    // pointermove/pointerupはドラッグ中にポインタがcanvas外へ出ても追跡できるよう
    // windowレベルで購読する。テスト時はフェイクのwindow相当オブジェクトを注入できる。
    windowLike = typeof window !== 'undefined' ? window : null,
  } = options;

  const state = {
    distance: initialDistance, theta: 0, phi: Math.PI / 2,
    velTheta: 0, velPhi: 0, dragging: false,
  };

  let pointerDown = false, lastX = 0, lastY = 0;

  function onPointerDown(e) {
    pointerDown = true; state.dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    onInteract();
  }
  function onPointerMove(e) {
    if (!pointerDown) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    state.theta -= dx * rotateSpeed;
    state.phi = clampPhi(state.phi - dy * rotateSpeed);
    state.velTheta = -dx * rotateSpeed;
    state.velPhi = -dy * rotateSpeed;
  }
  function onPointerUp() { pointerDown = false; state.dragging = false; }
  function onWheel(e) {
    e.preventDefault();
    onInteract();
    const factor = 1 - Math.sign(e.deltaY) * zoomSpeed;
    state.distance = Math.max(minDistance, Math.min(maxDistance, state.distance * factor));
  }

  domElement.addEventListener('pointerdown', onPointerDown);
  windowLike?.addEventListener('pointermove', onPointerMove);
  windowLike?.addEventListener('pointerup', onPointerUp);
  domElement.addEventListener('wheel', onWheel, { passive: false });

  /** Apply idle-rotation inertia; call once per frame when not dragging. */
  function tick() {
    if (!state.dragging) {
      state.theta += state.velTheta;
      state.phi = clampPhi(state.phi + state.velPhi);
      state.velTheta *= inertia;
      state.velPhi *= inertia;
    }
  }

  function dispose() {
    domElement.removeEventListener('pointerdown', onPointerDown);
    windowLike?.removeEventListener('pointermove', onPointerMove);
    windowLike?.removeEventListener('pointerup', onPointerUp);
    domElement.removeEventListener('wheel', onWheel);
  }

  return { state, tick, dispose, clampPhi, sphericalToXYZ };
}

export { createControls, clampPhi, sphericalToXYZ };
