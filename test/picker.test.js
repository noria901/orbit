const assert = require('node:assert/strict');
const test = require('node:test');
const { createPicker, DEFAULT_PIXEL_RADIUS } = require('../src/picker');
const { WGS84_A } = require('../src/geo');

// --- Minimal THREE mock ---

class MockVector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  // Fake project: maps world (WGS84_A,0,0) → NDC (0,0,0), (0,WGS84_A,0) → NDC (1,0,0)
  project(camera) {
    // Simplified: just normalise to NDC based on pre-set camera
    const proj = camera._mockProject(this);
    this.x = proj.x; this.y = proj.y; this.z = proj.z;
    return this;
  }
}

function createMockTHREE() {
  return { Vector3: MockVector3 };
}

// Camera that projects ECEF to a known NDC
function createMockCamera(ecefToNDC) {
  return {
    _mockProject(v) {
      return ecefToNDC(v.x, v.y, v.z);
    },
  };
}

test('DEFAULT_PIXEL_RADIUS is 12', () => {
  assert.equal(DEFAULT_PIXEL_RADIUS, 12);
});

test('pick returns null when no layers', () => {
  const camera = createMockCamera(() => ({ x: 0, y: 0, z: 0 }));
  const picker = createPicker(createMockTHREE(), camera);
  assert.equal(picker.pick(400, 300, 800, 600), null);
});

test('addLayer / removeLayer', () => {
  const camera = createMockCamera(() => ({ x: 99, y: 99, z: 99 }));
  const picker = createPicker(createMockTHREE(), camera);

  picker.addLayer('quakes', { getItems: () => [{ lat: 0, lon: 0 }], getECEF: () => ({ x: 1, y: 0, z: 0 }) });
  picker.removeLayer('quakes');

  // After removal no hits
  assert.equal(picker.pick(400, 300, 800, 600), null);
});

test('pick finds nearest point within pixel radius', () => {
  const W = 800, H = 600;

  // Camera that maps ECEF point to NDC (0,0,0) → centre of canvas
  const camera = createMockCamera((x, y, z) => ({ x: 0, y: 0, z: 0 }));
  const picker = createPicker(createMockTHREE(), camera);

  const item = { name: 'Tokyo', mag: 4.5 };
  picker.addLayer('quakes', {
    getItems: () => [item],
    getECEF: () => ({ x: WGS84_A, y: 0, z: 0 }),
  });

  // Click at canvas centre — NDC (0,0) maps to pixel (400,300)
  const result = picker.pick(400, 300, W, H);
  assert.ok(result !== null);
  assert.equal(result.layer, 'quakes');
  assert.equal(result.item, item);
});

test('pick returns null when click is outside pixel radius', () => {
  const W = 800, H = 600;

  // Point projected to NDC (0,0) → pixel (400,300)
  const camera = createMockCamera(() => ({ x: 0, y: 0, z: 0 }));
  const picker = createPicker(createMockTHREE(), camera, { pixelRadius: 5 });

  picker.addLayer('quakes', {
    getItems: () => [{ name: 'Far' }],
    getECEF: () => ({ x: WGS84_A, y: 0, z: 0 }),
  });

  // Click 50px away from projected point
  const result = picker.pick(450, 300, W, H);
  assert.equal(result, null);
});

test('pick rejects points behind camera (z > 1)', () => {
  const W = 800, H = 600;
  const camera = createMockCamera(() => ({ x: 0, y: 0, z: 1.5 })); // behind camera
  const picker = createPicker(createMockTHREE(), camera);

  picker.addLayer('quakes', {
    getItems: () => [{ name: 'Behind' }],
    getECEF: () => ({ x: WGS84_A, y: 0, z: 0 }),
  });

  assert.equal(picker.pick(400, 300, W, H), null);
});

test('pick returns closest when multiple layers have hits', () => {
  const W = 800, H = 600;
  const camera = createMockCamera((x, y) => {
    // Point A at NDC (0,0), Point B at NDC (0.01,0)
    if (x === 1) return { x: 0, y: 0, z: 0 };     // layer A → pixel centre
    return { x: 0.01, y: 0, z: 0 };                // layer B → 4px right of centre
  });
  const picker = createPicker(createMockTHREE(), camera, { pixelRadius: 20 });

  const itemA = { name: 'A' };
  const itemB = { name: 'B' };

  picker.addLayer('layerA', { getItems: () => [itemA], getECEF: () => ({ x: 1, y: 0, z: 0 }) });
  picker.addLayer('layerB', { getItems: () => [itemB], getECEF: () => ({ x: 2, y: 0, z: 0 }) });

  const result = picker.pick(400, 300, W, H);
  assert.ok(result !== null);
  // Layer A maps to exact centre, so it should win
  assert.equal(result.item.name, 'A');
});
