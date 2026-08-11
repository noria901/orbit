const assert = require('node:assert/strict');
const test = require('node:test');
const { createOrbitLines } = require('../src/orbits');

// --- Minimal THREE mock ---
class MockBufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.needsUpdate = false; }
}
class MockBufferGeometry {
  constructor() { this._attrs = {}; this._drawStart = 0; this._drawCount = 0; this._disposed = false; }
  setAttribute(name, attr) { this._attrs[name] = attr; }
  getAttribute(name) { return this._attrs[name]; }
  setDrawRange(s, c) { this._drawStart = s; this._drawCount = c; }
  dispose() { this._disposed = true; }
}
class MockLineBasicMaterial {
  constructor(opts) { Object.assign(this, opts); this._disposed = false; }
  dispose() { this._disposed = true; }
}
class MockLine {
  constructor(g, m) { this.geometry = g; this.material = m; this.frustumCulled = true; this.name = ''; }
}
class MockGroup {
  constructor() { this.children = []; this.name = ''; }
  add(child) { this.children.push(child); }
}
function createMockTHREE() {
  return { BufferGeometry: MockBufferGeometry, BufferAttribute: MockBufferAttribute, LineBasicMaterial: MockLineBasicMaterial, Line: MockLine, Group: MockGroup };
}

test('createOrbitLines returns group with two lines', () => {
  const ol = createOrbitLines(createMockTHREE());
  assert.equal(ol.group.name, 'orbit-lines');
  assert.equal(ol.group.children.length, 2);
  assert.equal(ol.group.children[0].name, 'orbit-path');
  assert.equal(ol.group.children[1].name, 'ground-trace');
});

test('updateOrbit sets positions in ECEF', () => {
  const ol = createOrbitLines(createMockTHREE(), { maxSegments: 10 });
  const pts = [
    { lat: 0, lon: 0, alt: 408 },
    { lat: 10, lon: 20, alt: 408 },
  ];
  ol.updateOrbit(pts);

  const attr = ol.group.children[0].geometry.getAttribute('position');
  // First point at (0,0,408km) should have x ≈ WGS84_A + 408000
  assert.ok(attr.array[0] > 6e6);
  assert.equal(ol.group.children[0].geometry._drawCount, 2);
});

test('updateTrace projects to surface (alt=0)', () => {
  const ol = createOrbitLines(createMockTHREE(), { maxSegments: 10 });
  ol.updateTrace([{ lat: 0, lon: 0 }]);

  const attr = ol.group.children[1].geometry.getAttribute('position');
  // At (0,0,0) → x ≈ WGS84_A
  assert.ok(attr.array[0] > 6.37e6 && attr.array[0] < 6.38e6);
  assert.equal(ol.group.children[1].geometry._drawCount, 1);
});

test('caps at maxSegments', () => {
  const ol = createOrbitLines(createMockTHREE(), { maxSegments: 2 });
  const pts = [
    { lat: 0, lon: 0, alt: 400 },
    { lat: 10, lon: 10, alt: 400 },
    { lat: 20, lon: 20, alt: 400 },
  ];
  ol.updateOrbit(pts);
  assert.equal(ol.group.children[0].geometry._drawCount, 2);
});

test('dispose cleans up all geometries and materials', () => {
  const ol = createOrbitLines(createMockTHREE());
  ol.dispose();
  for (const child of ol.group.children) {
    assert.equal(child.geometry._disposed, true);
    assert.equal(child.material._disposed, true);
  }
});
