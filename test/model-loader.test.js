const assert = require('node:assert/strict');
const test = require('node:test');
const { loadISSModel, createFallbackMesh, placeModel, ISS_MODEL_URL } = require('../src/model-loader');

// --- Minimal THREE mock ---
class MockMaterial {
  constructor(opts) { Object.assign(this, opts); this._disposed = false; }
  dispose() { this._disposed = true; }
}
class MockGeometry {
  constructor() { this._disposed = false; }
  dispose() { this._disposed = true; }
}
class MockMesh {
  constructor(g, m) {
    this.geometry = g; this.material = m; this.name = '';
    this.matrixAutoUpdate = true;
    this.matrixWorldNeedsUpdate = false;
    this.matrix = {
      elements: new Array(16).fill(0),
      fromArray(arr) { for (let i = 0; i < 16; i++) this.elements[i] = arr[i]; return this; },
    };
  }
}
class MockGroup {
  constructor() { this.name = ''; this.children = []; this.matrixAutoUpdate = true; this.matrixWorldNeedsUpdate = false; this.matrix = { elements: new Array(16).fill(0), fromArray(arr) { for (let i = 0; i < 16; i++) this.elements[i] = arr[i]; return this; } }; }
  add(child) { this.children.push(child); }
  traverse(fn) { fn(this); for (const c of this.children) { fn(c); if (c.traverse) c.traverse(fn); } }
}
function createMockTHREE() {
  return {
    MeshBasicMaterial: MockMaterial,
    BoxGeometry: MockGeometry,
    Mesh: MockMesh,
    Group: MockGroup,
  };
}

// --- Tests ---

test('ISS_MODEL_URL points to NASA asset', () => {
  assert.ok(ISS_MODEL_URL.includes('nasa.gov'));
  assert.ok(ISS_MODEL_URL.endsWith('.glb'));
});

test('createFallbackMesh returns group with two meshes', () => {
  const { mesh } = createFallbackMesh(createMockTHREE());
  assert.equal(mesh.name, 'iss-fallback');
  assert.equal(mesh.children.length, 2);
  assert.equal(mesh.children[0].name, 'iss-truss');
  assert.equal(mesh.children[1].name, 'iss-hab');
});

test('loadISSModel with fallback=true resolves to fallback mesh', async () => {
  const result = await loadISSModel(createMockTHREE(), null, { fallback: true });
  assert.equal(result.isFallback, true);
  assert.ok(result.mesh);
  assert.equal(typeof result.place, 'function');
  assert.equal(typeof result.dispose, 'function');
});

test('loadISSModel with no GLTFLoader resolves to fallback', async () => {
  const result = await loadISSModel(createMockTHREE(), null);
  assert.equal(result.isFallback, true);
});

test('placeModel sets matrixAutoUpdate=false and matrixWorldNeedsUpdate=true', () => {
  const mesh = new MockGroup();
  placeModel(mesh, { latitude: 35.0, longitude: 139.0, altitude: 408 });
  assert.equal(mesh.matrixAutoUpdate, false);
  assert.equal(mesh.matrixWorldNeedsUpdate, true);
});

test('placeModel sets translation in matrix elements 12-14', () => {
  const mesh = new MockGroup();
  placeModel(mesh, { latitude: 0, longitude: 0, altitude: 408 });
  // At (0,0,408km), x ≈ WGS84_A + 408000
  assert.ok(Math.abs(mesh.matrix.elements[12]) > 6e6, `elements[12]=${mesh.matrix.elements[12]}`);
  assert.ok(Math.abs(mesh.matrix.elements[13]) < 1);
  assert.ok(Math.abs(mesh.matrix.elements[14]) < 1);
});

test('fallback dispose does not throw', () => {
  loadISSModel(createMockTHREE(), null, { fallback: true }).then(result => {
    assert.doesNotThrow(() => result.dispose());
  });
});

test('loadISSModel error path falls back gracefully', async () => {
  // GLTFLoader that immediately calls error callback
  class MockGLTFLoaderAlwaysFail {
    load(_url, _ok, _progress, error) {
      error(new Error('mock network error'));
    }
  }
  const result = await loadISSModel(createMockTHREE(), MockGLTFLoaderAlwaysFail);
  assert.equal(result.isFallback, true);
});
