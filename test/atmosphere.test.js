const assert = require('node:assert/strict');
const test = require('node:test');
const { WGS84_A } = require('../src/geo');
const { createAtmosphere, ATMO_SCALE } = require('../src/atmosphere');

// --- Minimal THREE mock ---

class MockVector3 {
  constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
}

class MockSphereGeometry {
  constructor(r, w, h) { this.radius = r; this.wSeg = w; this.hSeg = h; this._disposed = false; }
  dispose() { this._disposed = true; }
}

class MockShaderMaterial {
  constructor(opts) {
    this.uniforms = opts.uniforms;
    this.vertexShader = opts.vertexShader;
    this.fragmentShader = opts.fragmentShader;
    this.side = opts.side;
    this.transparent = opts.transparent;
    this.depthWrite = opts.depthWrite;
    this._disposed = false;
  }
  dispose() { this._disposed = true; }
}

class MockMesh {
  constructor(g, m) { this.geometry = g; this.material = m; this.name = ''; }
}

const BACK_SIDE = 1;

function createMockTHREE() {
  return {
    Vector3: MockVector3,
    SphereGeometry: MockSphereGeometry,
    ShaderMaterial: MockShaderMaterial,
    Mesh: MockMesh,
    BackSide: BACK_SIDE,
  };
}

// --- Tests ---

test('atmosphere mesh has correct name', () => {
  const atmo = createAtmosphere(createMockTHREE());
  assert.equal(atmo.mesh.name, 'atmosphere');
});

test('atmosphere geometry radius matches WGS84_A * ATMO_SCALE', () => {
  const atmo = createAtmosphere(createMockTHREE());
  const expected = WGS84_A * ATMO_SCALE;
  assert.equal(atmo.mesh.geometry.radius, expected);
});

test('atmosphere material is transparent, BackSide, no depthWrite', () => {
  const THREE = createMockTHREE();
  const atmo = createAtmosphere(THREE);
  assert.equal(atmo.mesh.material.transparent, true);
  assert.equal(atmo.mesh.material.depthWrite, false);
  assert.equal(atmo.mesh.material.side, BACK_SIDE);
});

test('custom colour and intensity', () => {
  const THREE = createMockTHREE();
  const atmo = createAtmosphere(THREE, {
    color: [1, 0.5, 0],
    intensity: 1.2,
    power: 2.0,
  });
  const u = atmo.mesh.material.uniforms;
  assert.equal(u.glowColor.value.x, 1);
  assert.equal(u.glowColor.value.y, 0.5);
  assert.equal(u.intensity.value, 1.2);
  assert.equal(u.power.value, 2.0);
});

test('dispose cleans up geometry and material', () => {
  const atmo = createAtmosphere(createMockTHREE());
  atmo.dispose();
  assert.equal(atmo.mesh.geometry._disposed, true);
  assert.equal(atmo.mesh.material._disposed, true);
});
