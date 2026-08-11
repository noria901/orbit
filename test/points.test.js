const assert = require('node:assert/strict');
const test = require('node:test');
const { createPointCloud, hexToRGB } = require('../src/points');

// --- Minimal THREE mock ---

class MockBufferAttribute {
  constructor(array, itemSize) {
    this.array = array;
    this.itemSize = itemSize;
    this.count = array.length / itemSize;
    this.needsUpdate = false;
  }
}

class MockBufferGeometry {
  constructor() { this._attrs = {}; this._drawStart = 0; this._drawCount = 0; this._disposed = false; }
  setAttribute(name, attr) { this._attrs[name] = attr; }
  getAttribute(name) { return this._attrs[name]; }
  setDrawRange(start, count) { this._drawStart = start; this._drawCount = count; }
  dispose() { this._disposed = true; }
}

class MockPointsMaterial {
  constructor(opts) { Object.assign(this, opts); this._disposed = false; }
  dispose() { this._disposed = true; }
}

class MockPoints {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.frustumCulled = true;
  }
}

function createMockTHREE() {
  return {
    BufferGeometry: MockBufferGeometry,
    BufferAttribute: MockBufferAttribute,
    PointsMaterial: MockPointsMaterial,
    Points: MockPoints,
  };
}

// --- Tests ---

test('createPointCloud returns expected API', () => {
  const cloud = createPointCloud(createMockTHREE());
  assert.ok(cloud.mesh);
  assert.equal(cloud.count, 0);
  assert.equal(typeof cloud.update, 'function');
  assert.equal(typeof cloud.dispose, 'function');
});

test('update populates positions and colors', () => {
  const THREE = createMockTHREE();
  const cloud = createPointCloud(THREE, { maxPoints: 100 });

  const items = [
    { lat: 0, lon: 0 },
    { lat: 35.68, lon: 139.69 },
  ];

  cloud.update(items, {
    position: (item) => ({ lat: item.lat, lon: item.lon }),
    color: () => ({ r: 1, g: 0.5, b: 0 }),
  });

  assert.equal(cloud.count, 2);

  const posAttr = cloud.mesh.geometry.getAttribute('position');
  // First point at (0,0) should be on equator at 0°E → x ≈ WGS84_A, y ≈ 0, z ≈ 0
  assert.ok(posAttr.array[0] > 6e6, 'x should be ~WGS84_A for (0,0)');
  assert.ok(Math.abs(posAttr.array[1]) < 1, 'y should be ~0 for (0,0)');

  const colAttr = cloud.mesh.geometry.getAttribute('color');
  assert.equal(colAttr.array[0], 1);
  assert.equal(colAttr.array[1], 0.5);
  assert.equal(colAttr.array[2], 0);
});

test('update respects maxPoints cap', () => {
  const cloud = createPointCloud(createMockTHREE(), { maxPoints: 2 });
  const items = [
    { lat: 0, lon: 0 },
    { lat: 10, lon: 10 },
    { lat: 20, lon: 20 }, // should be ignored
  ];
  cloud.update(items, {
    position: (item) => ({ lat: item.lat, lon: item.lon }),
    color: () => ({ r: 1, g: 1, b: 1 }),
  });
  assert.equal(cloud.count, 2);
});

test('custom size accessor', () => {
  const cloud = createPointCloud(createMockTHREE(), { maxPoints: 10 });
  cloud.update([{ lat: 0, lon: 0, s: 8 }], {
    position: (item) => ({ lat: item.lat, lon: item.lon }),
    color: () => ({ r: 0, g: 0, b: 0 }),
    size: (item) => item.s,
  });
  const sizeAttr = cloud.mesh.geometry.getAttribute('size');
  assert.equal(sizeAttr.array[0], 8);
});

test('dispose cleans up', () => {
  const cloud = createPointCloud(createMockTHREE());
  cloud.dispose();
  assert.equal(cloud.mesh.geometry._disposed, true);
  assert.equal(cloud.mesh.material._disposed, true);
});

test('frustumCulled is false', () => {
  const cloud = createPointCloud(createMockTHREE());
  assert.equal(cloud.mesh.frustumCulled, false);
});

test('hexToRGB parses correctly', () => {
  const c = hexToRGB('#FF6B3D');
  assert.ok(Math.abs(c.r - 1) < 0.01);
  assert.ok(Math.abs(c.g - 0.42) < 0.01);
  assert.ok(Math.abs(c.b - 0.24) < 0.01);
});

test('hexToRGB without hash', () => {
  const c = hexToRGB('5B8CE8');
  assert.ok(Math.abs(c.r - 0.357) < 0.01);
  assert.ok(Math.abs(c.g - 0.549) < 0.01);
  assert.ok(Math.abs(c.b - 0.91) < 0.01);
});
