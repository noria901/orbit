const assert = require('node:assert/strict');
const test = require('node:test');
const { createQuakeLayer, magToSize, DEPTH_COLORS } = require('../src/quakes');

// --- Minimal THREE mock ---
class MockBufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize; this.needsUpdate = false; }
}
class MockBufferGeometry {
  constructor() { this._attrs = {}; this._drawCount = 0; this._disposed = false; }
  setAttribute(name, attr) { this._attrs[name] = attr; }
  getAttribute(name) { return this._attrs[name]; }
  setDrawRange(s, c) { this._drawCount = c; }
  dispose() { this._disposed = true; }
}
class MockPointsMaterial {
  constructor(opts) { Object.assign(this, opts); this._disposed = false; }
  dispose() { this._disposed = true; }
}
class MockPoints {
  constructor(g, m) { this.geometry = g; this.material = m; this.frustumCulled = true; this.name = ''; }
}
function createMockTHREE() {
  return { BufferGeometry: MockBufferGeometry, BufferAttribute: MockBufferAttribute, PointsMaterial: MockPointsMaterial, Points: MockPoints };
}

// --- Tests ---

test('magToSize scales correctly', () => {
  assert.ok(magToSize(2.5) >= 2);
  assert.ok(magToSize(5) > magToSize(2.5));
  assert.ok(magToSize(8) <= 20);
});

test('DEPTH_COLORS has three bands', () => {
  assert.ok(DEPTH_COLORS.shallow);
  assert.ok(DEPTH_COLORS.mid);
  assert.ok(DEPTH_COLORS.deep);
  for (const c of Object.values(DEPTH_COLORS)) {
    assert.equal(typeof c.r, 'number');
    assert.equal(typeof c.g, 'number');
    assert.equal(typeof c.b, 'number');
  }
});

test('createQuakeLayer returns expected API', () => {
  const layer = createQuakeLayer(createMockTHREE());
  assert.equal(layer.mesh.name, 'quakes');
  assert.equal(layer.count, 0);
  assert.equal(typeof layer.refresh, 'function');
  assert.equal(typeof layer.dispose, 'function');
});

test('refresh populates points from quake data', () => {
  const layer = createQuakeLayer(createMockTHREE(), { maxPoints: 100 });
  const quakes = [
    { lat: 35.68, lon: 139.69, depth: 20, mag: 4.5, place: 'Tokyo', time: Date.now() },
    { lat: -33.87, lon: 151.21, depth: 150, mag: 6.0, place: 'Sydney', time: Date.now() },
  ];
  layer.refresh(quakes);
  assert.equal(layer.count, 2);
});

test('dispose cleans up', () => {
  const layer = createQuakeLayer(createMockTHREE());
  layer.dispose();
  assert.equal(layer.mesh.geometry._disposed, true);
  assert.equal(layer.mesh.material._disposed, true);
});
