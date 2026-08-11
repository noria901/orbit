const assert = require('node:assert/strict');
const test = require('node:test');
const { createSatellitesLayer, CATEGORY_RGB } = require('../src/satellites-layer');
const { CATEGORIES } = require('../src/catalogue');

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

test('CATEGORY_RGB covers all categories', () => {
  for (const key of Object.keys(CATEGORIES)) {
    assert.ok(CATEGORY_RGB[key], `Missing RGB for ${key}`);
    assert.equal(typeof CATEGORY_RGB[key].r, 'number');
  }
});

test('createSatellitesLayer returns expected API', () => {
  const layer = createSatellitesLayer(createMockTHREE());
  assert.equal(layer.mesh.name, 'satellites');
  assert.equal(layer.count, 0);
  assert.equal(typeof layer.refresh, 'function');
  assert.equal(typeof layer.refreshECEF, 'function');
});

test('refreshECEF populates ECEF positions directly', () => {
  const layer = createSatellitesLayer(createMockTHREE(), { maxPoints: 100 });
  const sats = [
    { ecef: { x: 7000000, y: 0, z: 0 }, category: 'gps' },
    { ecef: { x: 0, y: 7000000, z: 0 }, category: 'starlink' },
  ];
  layer.refreshECEF(sats);

  const posAttr = layer.mesh.geometry.getAttribute('position');
  assert.equal(posAttr.array[0], 7000000);
  assert.equal(posAttr.array[1], 0);
  assert.equal(posAttr.array[3], 0);
  assert.equal(posAttr.array[4], 7000000);

  // Check colours match categories (approx due to Float32 precision)
  const colAttr = layer.mesh.geometry.getAttribute('color');
  assert.ok(Math.abs(colAttr.array[0] - CATEGORY_RGB.gps.r) < 0.001);
  assert.ok(Math.abs(colAttr.array[3] - CATEGORY_RGB.starlink.r) < 0.001);
});

test('dispose cleans up', () => {
  const layer = createSatellitesLayer(createMockTHREE());
  layer.dispose();
  assert.equal(layer.mesh.geometry._disposed, true);
});
