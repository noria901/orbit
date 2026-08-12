import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { findNearest, createPicker } from '../src/picker.js';

// Fake projector: pretends (x,y,z) maps directly to screen (x,y), all in front.
function identityProject(x, y, z) {
  return { screenX: x, screenY: y, behindCamera: false };
}

test('findNearest returns the closest candidate within threshold', () => {
  const candidates = [
    { x: 100, y: 100, z: 0, kind: 'a' },
    { x: 105, y: 100, z: 0, kind: 'b' },
    { x: 500, y: 500, z: 0, kind: 'c' },
  ];
  const picked = findNearest(candidates, 103, 100, identityProject, 12);
  assert.equal(picked.kind, 'b'); // distance 2, closer than 'a' (distance 3)
});

test('findNearest returns null when nothing is within threshold', () => {
  const candidates = [{ x: 1000, y: 1000, z: 0, kind: 'far' }];
  assert.equal(findNearest(candidates, 0, 0, identityProject, 12), null);
});

test('findNearest skips candidates behind the camera', () => {
  const project = (x, y) => ({ screenX: x, screenY: y, behindCamera: x === 50 });
  const candidates = [
    { x: 50, y: 50, z: 0, kind: 'behind' }, // would be nearest, but excluded
    { x: 60, y: 60, z: 0, kind: 'visible' },
  ];
  const picked = findNearest(candidates, 50, 50, project, 100);
  assert.equal(picked.kind, 'visible');
});

test('findNearest respects a custom maxDist', () => {
  const candidates = [{ x: 20, y: 0, z: 0, kind: 'a' }];
  assert.equal(findNearest(candidates, 0, 0, identityProject, 10), null);
  assert.equal(findNearest(candidates, 0, 0, identityProject, 25).kind, 'a');
});

// ---- createPicker: real THREE.PerspectiveCamera projection ----

test('createPicker.pickNearest: a point directly in front of the camera projects near screen center', () => {
  const camera = new THREE.PerspectiveCamera(90, 1, 1, 10000);
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const picker = createPicker(THREE, camera, () => ({ width: 800, height: 800 }));
  const candidates = [{ x: 0, y: 0, z: 0, kind: 'origin' }];
  const picked = picker.pickNearest(candidates, 400, 400, 20); // click at screen center
  assert.ok(picked, 'expected the origin point to be picked at screen center');
  assert.equal(picked.kind, 'origin');
});

test('createPicker.pickNearest: a point far off to one side does not match a center click', () => {
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 10000);
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const picker = createPicker(THREE, camera, () => ({ width: 800, height: 800 }));
  // A point way off to the +X side should project far from screen center.
  const candidates = [{ x: 500, y: 0, z: 0, kind: 'offscreen-ish' }];
  const picked = picker.pickNearest(candidates, 400, 400, 20);
  assert.equal(picked, null);
});

test('createPicker.probeEarth: ray through screen center hits a sphere centered at the origin', () => {
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 10000);
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const earth = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 16));
  earth.updateMatrixWorld();

  const picker = createPicker(THREE, camera, () => ({ width: 800, height: 800 }));
  const hit = picker.probeEarth(400, 400, earth); // dead center click
  assert.ok(hit, 'expected the central ray to hit the sphere');
  assert.ok(Number.isFinite(hit.latitude) && Number.isFinite(hit.longitude));
});

test('createPicker.probeEarth: ray through a corner misses a small sphere', () => {
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 10000);
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  const earth = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 16)); // small sphere
  earth.updateMatrixWorld();

  const picker = createPicker(THREE, camera, () => ({ width: 800, height: 800 }));
  const hit = picker.probeEarth(10, 10, earth); // near corner, should miss
  assert.equal(hit, null);
});
