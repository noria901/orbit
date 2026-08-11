const assert = require('node:assert/strict');
const test = require('node:test');
const { createAmedasLayer, tempToColor, TEMP_COLORS } = require('../src/amedas-layer');

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

test('TEMP_COLORS has five bands', () => {
  assert.equal(Object.keys(TEMP_COLORS).length, 5);
  for (const c of Object.values(TEMP_COLORS)) {
    assert.equal(typeof c.r, 'number');
  }
});

test('tempToColor returns correct band', () => {
  assert.strictEqual(tempToColor(-5), TEMP_COLORS.freezing);
  assert.strictEqual(tempToColor(5), TEMP_COLORS.cool);
  assert.strictEqual(tempToColor(15), TEMP_COLORS.mild);
  assert.strictEqual(tempToColor(25), TEMP_COLORS.warm);
  assert.strictEqual(tempToColor(35), TEMP_COLORS.hot);
});

test('createAmedasLayer returns expected API', () => {
  const layer = createAmedasLayer(createMockTHREE());
  assert.equal(layer.mesh.name, 'amedas');
  assert.equal(layer.count, 0);
  assert.equal(typeof layer.refresh, 'function');
});

test('refresh populates points', () => {
  const layer = createAmedasLayer(createMockTHREE());
  layer.refresh([
    { lat: 35.68, lon: 139.69, name: 'Tokyo', temp: 28, wind: 3, rain: 0, humidity: 60 },
    { lat: 43.06, lon: 141.35, name: 'Sapporo', temp: 5, wind: 2, rain: 0, humidity: 70 },
  ]);
  assert.equal(layer.count, 2);
});

test('dispose cleans up', () => {
  const layer = createAmedasLayer(createMockTHREE());
  layer.dispose();
  assert.equal(layer.mesh.geometry._disposed, true);
});
