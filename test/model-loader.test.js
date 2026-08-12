import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { createFallbackShape, loadCenteredModel } from '../src/model-loader.js';

test('createFallbackShape returns a Group containing a body + panel mesh', () => {
  const group = createFallbackShape(THREE);
  assert.equal(group.type, 'Group');
  assert.equal(group.children.length, 2);
  assert.ok(group.children.every((c) => c.type === 'Mesh'));
});

// Fake GLTFLoader mimicking the real API surface (load(url, onLoad, onProgress, onError))
// without any network access, so the centroid-correction math can be verified in isolation.
function makeFakeGLTFLoader(sceneFactory) {
  return class FakeGLTFLoader {
    load(url, onLoad, onProgress, onError) {
      try {
        onLoad({ scene: sceneFactory() });
      } catch (e) {
        onError(e);
      }
    }
  };
}

test('loadCenteredModel re-centers a scene whose origin is offset from its geometry', async () => {
  // Build a scene whose only mesh sits far from the scene's own origin —
  // exactly the "asset origin != visual center" problem that broke the
  // Cesium-era version twice.
  const scene = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  mesh.position.set(100, 50, -30); // offset from scene origin
  scene.add(mesh);

  const FakeLoader = makeFakeGLTFLoader(() => scene);
  const wrapper = await loadCenteredModel(THREE, FakeLoader, 'fake://model.glb');

  // After recentering, the scene's bounding-box center (in the wrapper's
  // local space) should sit at/near the wrapper's own origin.
  const box = new THREE.Box3().setFromObject(wrapper);
  const center = box.getCenter(new THREE.Vector3());
  assert.ok(center.length() < 1e-6, `expected near-zero centroid, got ${center.toArray()}`);
});

test('loadCenteredModel rejects when the measured offset is implausibly large', async () => {
  const scene = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  mesh.position.set(1e7, 0, 0); // absurd offset (this is the exact failure mode from CLAUDE.md)
  scene.add(mesh);

  const FakeLoader = makeFakeGLTFLoader(() => scene);
  await assert.rejects(
    () => loadCenteredModel(THREE, FakeLoader, 'fake://model.glb', { maxPlausibleOffset: 500 }),
    /implausible/,
  );
});

test('loadCenteredModel accepts a small, plausible offset (e.g. real ISS model asymmetry)', async () => {
  const scene = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  mesh.position.set(6.58, 0, 5.38); // matches a real measured ISS-model offset from earlier debugging
  scene.add(mesh);

  const FakeLoader = makeFakeGLTFLoader(() => scene);
  const wrapper = await loadCenteredModel(THREE, FakeLoader, 'fake://model.glb', { maxPlausibleOffset: 500 });
  assert.ok(wrapper); // did not throw
});
