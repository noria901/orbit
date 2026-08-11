const assert = require('node:assert/strict');
const test = require('node:test');
const { WGS84_A, WGS84_F } = require('../src/geo');
const { createEarth, WGS84_B, scaleGeometry } = require('../src/earth');

// --- Minimal THREE mock ---

class MockColor {
  constructor(c) { this.val = c; }
  set(c) { this.val = c; }
}

class MockBufferAttribute {
  constructor(array, itemSize) {
    this._data = array;
    this._itemSize = itemSize;
    this.count = array.length / itemSize;
    this.needsUpdate = false;
  }
  getX(i) { return this._data[i * this._itemSize]; }
  getY(i) { return this._data[i * this._itemSize + 1]; }
  getZ(i) { return this._data[i * this._itemSize + 2]; }
  setXYZ(i, x, y, z) {
    this._data[i * this._itemSize] = x;
    this._data[i * this._itemSize + 1] = y;
    this._data[i * this._itemSize + 2] = z;
  }
}

class MockSphereGeometry {
  constructor(radius, wSeg, hSeg) {
    // Generate a simple unit sphere with a few vertices
    const verts = [];
    for (let j = 0; j <= hSeg; j++) {
      const phi = Math.PI * j / hSeg;
      for (let i = 0; i <= wSeg; i++) {
        const theta = 2 * Math.PI * i / wSeg;
        verts.push(
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi),
          radius * Math.sin(phi) * Math.sin(theta),
        );
      }
    }
    this._positions = new MockBufferAttribute(new Float32Array(verts), 3);
    this._disposed = false;
  }
  getAttribute(name) {
    if (name === 'position') return this._positions;
    return null;
  }
  computeVertexNormals() {}
  dispose() { this._disposed = true; }
}

class MockMeshPhongMaterial {
  constructor(opts) {
    this.color = new MockColor(opts?.color ?? 0);
    this.shininess = opts?.shininess ?? 30;
    this.map = null;
    this.needsUpdate = false;
    this._disposed = false;
  }
  dispose() { this._disposed = true; }
}

class MockMesh {
  constructor(geometry, material) {
    this.geometry = geometry;
    this.material = material;
    this.name = '';
  }
}

function createMockTHREE() {
  return {
    SphereGeometry: MockSphereGeometry,
    MeshPhongMaterial: MockMeshPhongMaterial,
    Mesh: MockMesh,
    SRGBColorSpace: 'srgb',
    // No TextureLoader — texture loading is skipped in test
  };
}

// --- Tests ---

test('WGS84_B matches semi-minor axis', () => {
  const expected = WGS84_A * (1 - WGS84_F);
  assert.equal(WGS84_B, expected);
});

test('createEarth returns mesh with correct name', () => {
  const THREE = createMockTHREE();
  const earth = createEarth(THREE, { segments: 4 });
  assert.equal(earth.mesh.name, 'earth');
  assert.equal(typeof earth.dispose, 'function');
});

test('ellipsoid geometry has correct axis scaling', () => {
  const THREE = createMockTHREE();
  const earth = createEarth(THREE, { segments: 4 });
  const pos = earth.mesh.geometry.getAttribute('position');

  // Find max extent along each axis
  let maxX = 0, maxY = 0, maxZ = 0;
  for (let i = 0; i < pos.count; i++) {
    maxX = Math.max(maxX, Math.abs(pos.getX(i)));
    maxY = Math.max(maxY, Math.abs(pos.getY(i)));
    maxZ = Math.max(maxZ, Math.abs(pos.getZ(i)));
  }

  // X and Z should be scaled to WGS84_A (equatorial)
  // Note: in our SphereGeometry mock, x=sin(phi)*cos(theta), y=cos(phi), z=sin(phi)*sin(theta)
  // After scaling: x *= WGS84_A, y *= WGS84_A, z *= WGS84_B
  // So maxX ≈ WGS84_A, maxY ≈ WGS84_A (poles), maxZ ≈ WGS84_B
  assert.ok(Math.abs(maxX - WGS84_A) / WGS84_A < 0.01, `maxX ${maxX} should be near WGS84_A`);
  assert.ok(Math.abs(maxY - WGS84_A) / WGS84_A < 0.01, `maxY ${maxY} should be near WGS84_A`);
  // Z axis corresponds to semi-minor (B) in our scaling
  assert.ok(Math.abs(maxZ - WGS84_B) / WGS84_B < 0.01, `maxZ ${maxZ} should be near WGS84_B`);
});

test('textureLoaded is false when no TextureLoader', () => {
  const THREE = createMockTHREE();
  const earth = createEarth(THREE, { segments: 4 });
  assert.equal(earth.textureLoaded, false);
});

test('dispose cleans up geometry and material', () => {
  const THREE = createMockTHREE();
  const earth = createEarth(THREE, { segments: 4 });
  earth.dispose();
  assert.equal(earth.mesh.geometry._disposed, true);
  assert.equal(earth.mesh.material._disposed, true);
});

test('scaleGeometry modifies positions in-place', () => {
  const data = new Float32Array([1, 2, 3, 4, 5, 6]);
  const attr = new MockBufferAttribute(data, 3);
  const geom = { getAttribute: () => attr, computeVertexNormals() {} };
  scaleGeometry(geom, 2, 3, 4);
  assert.equal(attr.getX(0), 2);
  assert.equal(attr.getY(0), 6);
  assert.equal(attr.getZ(0), 12);
  assert.equal(attr.getX(1), 8);
  assert.equal(attr.getY(1), 15);
  assert.equal(attr.getZ(1), 24);
});
