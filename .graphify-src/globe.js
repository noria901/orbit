/**
 * Globe renderer — Three.js scene, camera, renderer, animation loop.
 *
 * This is the core rendering scaffold that replaces Cesium.Viewer.
 * Everything else (earth mesh, tiles, overlays) attaches to this scene.
 *
 * Usage (browser, ESM):
 *   import { createGlobe } from './globe.js';
 *   const globe = createGlobe(document.getElementById('globe'));
 *   globe.start();
 *
 * For Node.js tests, THREE is injected via the constructor.
 */

'use strict';

/**
 * @param {HTMLElement} container - DOM element to mount the canvas
 * @param {object} THREE - Three.js module (injected for testability)
 * @param {object} [options]
 * @param {number} [options.fov=45]
 * @param {number} [options.near=100]
 * @param {number} [options.far=1e9]
 * @param {boolean} [options.antialias=true]
 * @param {number} [options.pixelRatio] - defaults to devicePixelRatio
 */
function createGlobe(container, THREE, options = {}) {
  const {
    fov = 45,
    near = 100,
    far = 1e9,
    antialias = true,
    pixelRatio = (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1),
  } = options;

  // ---- Scene ----
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070C);

  // ---- Camera ----
  const width = container.clientWidth || 1;
  const height = container.clientHeight || 1;
  const camera = new THREE.PerspectiveCamera(fov, width / height, near, far);
  camera.position.set(0, 0, 34000000); // ~34,000 km (startup position)
  camera.lookAt(0, 0, 0);

  // ---- Renderer ----
  const renderer = new THREE.WebGLRenderer({
    antialias,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(pixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);

  // ---- Resize ----
  function onResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  let resizeObserver = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(container);
  } else if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize);
  }

  // ---- Animation loop ----
  let running = false;
  let rafId = null;
  let lastTime = 0;
  const preUpdateCallbacks = new Set();
  const postUpdateCallbacks = new Set();

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);

    const deltaMs = lastTime ? now - lastTime : 0;
    lastTime = now;
    const ctx = { time: new Date(), deltaMs, now };

    // Pre-update (data, positions)
    for (const fn of preUpdateCallbacks) fn(ctx);

    // Render
    renderer.render(scene, camera);

    // Post-update (camera follow, UI sync)
    for (const fn of postUpdateCallbacks) fn(ctx);
  }

  return {
    scene,
    camera,
    renderer,
    canvas: renderer.domElement,

    start() {
      if (running) return;
      running = true;
      lastTime = 0;
      rafId = requestAnimationFrame(frame);
    },

    stop() {
      running = false;
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    },

    get running() { return running; },

    /** Register a callback that runs before each render */
    onPreUpdate(fn) {
      preUpdateCallbacks.add(fn);
      return () => preUpdateCallbacks.delete(fn);
    },

    /** Register a callback that runs after each render */
    onPostUpdate(fn) {
      postUpdateCallbacks.add(fn);
      return () => postUpdateCallbacks.delete(fn);
    },

    resize: onResize,

    dispose() {
      running = false;
      if (rafId != null) cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    },
  };
}

module.exports = { createGlobe };
