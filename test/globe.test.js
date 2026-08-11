const assert = require('node:assert/strict');
const test = require('node:test');

// Minimal THREE mock — just enough to exercise createGlobe logic
function createMockTHREE() {
  class Color { constructor(c) { this.hex = c; } }
  class Scene { constructor() { this.background = null; } }
  class PerspectiveCamera {
    constructor(fov, aspect, near, far) {
      Object.assign(this, { fov, aspect, near, far });
      this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    }
    lookAt() {}
    updateProjectionMatrix() {}
  }
  const domElement = { parentNode: null };
  class WebGLRenderer {
    constructor(opts) { this.opts = opts; this.domElement = domElement; }
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
  }
  return {
    Color, Scene, PerspectiveCamera, WebGLRenderer,
    SRGBColorSpace: 'srgb',
  };
}

function createMockContainer() {
  const children = [];
  return {
    clientWidth: 800,
    clientHeight: 600,
    appendChild(el) { children.push(el); el.parentNode = this; },
    removeChild(el) { const i = children.indexOf(el); if (i >= 0) children.splice(i, 1); el.parentNode = null; },
    _children: children,
  };
}

const { createGlobe } = require('../src/globe');

test('createGlobe returns expected API surface', () => {
  const THREE = createMockTHREE();
  const container = createMockContainer();
  const globe = createGlobe(container, THREE);

  assert.ok(globe.scene);
  assert.ok(globe.camera);
  assert.ok(globe.renderer);
  assert.ok(globe.canvas);
  assert.equal(typeof globe.start, 'function');
  assert.equal(typeof globe.stop, 'function');
  assert.equal(typeof globe.onPreUpdate, 'function');
  assert.equal(typeof globe.onPostUpdate, 'function');
  assert.equal(typeof globe.resize, 'function');
  assert.equal(typeof globe.dispose, 'function');
  assert.equal(globe.running, false);
});

test('camera defaults', () => {
  const THREE = createMockTHREE();
  const container = createMockContainer();
  const globe = createGlobe(container, THREE);

  assert.equal(globe.camera.fov, 45);
  assert.equal(globe.camera.near, 100);
  assert.equal(globe.camera.far, 1e9);
  assert.equal(globe.camera.position.z, 34000000);
});

test('custom options override defaults', () => {
  const THREE = createMockTHREE();
  const container = createMockContainer();
  const globe = createGlobe(container, THREE, { fov: 60, near: 1, far: 1e8 });

  assert.equal(globe.camera.fov, 60);
  assert.equal(globe.camera.near, 1);
  assert.equal(globe.camera.far, 1e8);
});

test('canvas is appended to container', () => {
  const THREE = createMockTHREE();
  const container = createMockContainer();
  createGlobe(container, THREE);

  assert.equal(container._children.length, 1);
});

test('onPreUpdate / onPostUpdate register and unregister', () => {
  const THREE = createMockTHREE();
  const container = createMockContainer();
  const globe = createGlobe(container, THREE);

  let called = false;
  const unsub = globe.onPreUpdate(() => { called = true; });
  assert.equal(typeof unsub, 'function');

  // Unsubscribe should return without error
  unsub();
});

test('dispose removes canvas from container', () => {
  const THREE = createMockTHREE();
  const container = createMockContainer();
  const globe = createGlobe(container, THREE);

  assert.equal(container._children.length, 1);
  globe.dispose();
  assert.equal(container._children.length, 0);
});

test('scene background is dark', () => {
  const THREE = createMockTHREE();
  const container = createMockContainer();
  const globe = createGlobe(container, THREE);

  assert.equal(globe.scene.background.hex, 0x05070C);
});
