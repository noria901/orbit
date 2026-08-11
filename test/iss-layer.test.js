const assert = require('node:assert/strict');
const test = require('node:test');
const { createISSLayer, ISS_COLOR } = require('../src/iss-layer');

// --- Minimal THREE mock ---
class MockBufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.needsUpdate = false; }
}
class MockBufferGeometry {
  constructor() { this._attrs = {}; this._disposed = false; }
  setAttribute(name, attr) { this._attrs[name] = attr; }
  getAttribute(name) { return this._attrs[name]; }
  dispose() { this._disposed = true; }
}
class MockPointsMaterial {
  constructor(opts) { Object.assign(this, opts); this._disposed = false; }
  dispose() { this._disposed = true; }
}
class MockLineBasicMaterial {
  constructor(opts) { Object.assign(this, opts); this._disposed = false; }
  dispose() { this._disposed = true; }
}
class MockPoints {
  constructor(g, m) { this.geometry = g; this.material = m; this.name = ''; }
}
class MockLine {
  constructor(g, m) { this.geometry = g; this.material = m; this.name = ''; }
}
class MockGroup {
  constructor() { this.children = []; this.name = ''; }
  add(child) { this.children.push(child); }
}

function createMockTHREE() {
  return {
    BufferGeometry: MockBufferGeometry,
    BufferAttribute: MockBufferAttribute,
    PointsMaterial: MockPointsMaterial,
    LineBasicMaterial: MockLineBasicMaterial,
    Points: MockPoints,
    Line: MockLine,
    Group: MockGroup,
  };
}

test('createISSLayer returns group with dot and line', () => {
  const layer = createISSLayer(createMockTHREE());
  assert.equal(layer.group.name, 'iss');
  assert.equal(layer.group.children.length, 2);
  assert.equal(layer.group.children[0].name, 'iss-dot');
  assert.equal(layer.group.children[1].name, 'iss-nadir');
});

test('update sets ISS position in ECEF', () => {
  const layer = createISSLayer(createMockTHREE());
  layer.update({ latitude: 0, longitude: 0, altitude: 408 });

  const dotPos = layer.group.children[0].geometry.getAttribute('position');
  // At (0°, 0°, 408km), x should be ~WGS84_A + 408000
  assert.ok(dotPos.array[0] > 6e6, `x=${dotPos.array[0]} should be > 6M`);
  assert.ok(Math.abs(dotPos.array[1]) < 1);
  assert.ok(Math.abs(dotPos.array[2]) < 1);
});

test('nadir line connects ISS to ground', () => {
  const layer = createISSLayer(createMockTHREE());
  layer.update({ latitude: 0, longitude: 0, altitude: 408 });

  const linePos = layer.group.children[1].geometry.getAttribute('position');
  // ISS point (index 0) should be higher than ground point (index 1)
  const issX = linePos.array[0];
  const groundX = linePos.array[3];
  assert.ok(issX > groundX, 'ISS should be further from centre than ground');
});

test('update with null geo does nothing', () => {
  const layer = createISSLayer(createMockTHREE());
  // Should not throw
  layer.update(null);
  const dotPos = layer.group.children[0].geometry.getAttribute('position');
  assert.equal(dotPos.array[0], 0);
});

test('dispose cleans up all geometries and materials', () => {
  const layer = createISSLayer(createMockTHREE());
  layer.dispose();
  for (const child of layer.group.children) {
    assert.equal(child.geometry._disposed, true);
    assert.equal(child.material._disposed, true);
  }
});
