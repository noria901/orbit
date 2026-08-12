const assert = require('node:assert/strict');
const test = require('node:test');
const { sunDirectionECEF, dateToJD, mod360, createLighting } = require('../src/lighting');

// --- Minimal THREE mock ---

class MockDirectionalLight {
  constructor(color, intensity) {
    this.color = color; this.intensity = intensity; this.name = '';
    this.position = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } };
    this._disposed = false;
  }
  dispose() { this._disposed = true; }
}

class MockAmbientLight {
  constructor(color, intensity) {
    this.color = color; this.intensity = intensity; this.name = '';
    this._disposed = false;
  }
  dispose() { this._disposed = true; }
}

function createMockTHREE() {
  return { DirectionalLight: MockDirectionalLight, AmbientLight: MockAmbientLight };
}

// --- Tests ---

test('dateToJD: J2000 epoch', () => {
  // J2000.0 = 2000-01-01T12:00:00Z = JD 2451545.0
  const j2000 = new Date('2000-01-01T12:00:00Z');
  assert.ok(Math.abs(dateToJD(j2000) - 2451545.0) < 0.0001);
});

test('mod360 normalizes angles', () => {
  assert.ok(Math.abs(mod360(400) - 40) < 1e-10);
  assert.ok(Math.abs(mod360(-10) - 350) < 1e-10);
  assert.ok(Math.abs(mod360(0) - 0) < 1e-10);
  assert.ok(Math.abs(mod360(360) - 0) < 1e-10);
});

test('sunDirectionECEF returns unit vector', () => {
  const dir = sunDirectionECEF(new Date('2024-06-21T12:00:00Z'));
  const mag = Math.sqrt(dir.x ** 2 + dir.y ** 2 + dir.z ** 2);
  assert.ok(Math.abs(mag - 1.0) < 0.001, `magnitude ${mag} should be ~1`);
});

test('sun is in northern hemisphere around June solstice', () => {
  const dir = sunDirectionECEF(new Date('2024-06-21T12:00:00Z'));
  // Sun's declination should be positive (z > 0) near June solstice
  assert.ok(dir.z > 0, `z=${dir.z} should be positive in June`);
});

test('sun is in southern hemisphere around December solstice', () => {
  const dir = sunDirectionECEF(new Date('2024-12-21T12:00:00Z'));
  assert.ok(dir.z < 0, `z=${dir.z} should be negative in December`);
});

test('createLighting returns expected API', () => {
  const lighting = createLighting(createMockTHREE());
  assert.ok(lighting.sunLight);
  assert.ok(lighting.ambientLight);
  assert.equal(typeof lighting.update, 'function');
  assert.equal(typeof lighting.dispose, 'function');
  assert.equal(lighting.sunLight.name, 'sunLight');
  assert.equal(lighting.ambientLight.name, 'ambientLight');
});

test('createLighting update moves sun position', () => {
  const lighting = createLighting(createMockTHREE());
  const p1 = { ...lighting.sunLight.position };
  lighting.update(new Date('2024-01-01T00:00:00Z'));
  const p2 = { ...lighting.sunLight.position };
  lighting.update(new Date('2024-07-01T00:00:00Z'));
  const p3 = { ...lighting.sunLight.position };
  // Positions at different dates should differ
  assert.ok(p2.x !== p3.x || p2.y !== p3.y || p2.z !== p3.z);
});

test('dispose cleans up lights', () => {
  const lighting = createLighting(createMockTHREE());
  lighting.dispose();
  assert.equal(lighting.sunLight._disposed, true);
  assert.equal(lighting.ambientLight._disposed, true);
});
