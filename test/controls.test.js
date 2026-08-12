import assert from 'node:assert/strict';
import test from 'node:test';

import { clampPhi, sphericalToXYZ } from '../src/controls.js';

test('clampPhi keeps values within (0, PI) away from poles', () => {
  assert.ok(clampPhi(-5) > 0);
  assert.ok(clampPhi(Math.PI + 5) < Math.PI);
  assert.equal(clampPhi(Math.PI / 2), Math.PI / 2);
});

test('sphericalToXYZ: phi=PI/2 theta=0 lands on +X axis at given radius', () => {
  const p = sphericalToXYZ(100, 0, Math.PI / 2);
  assert.ok(Math.abs(p.x - 100) < 1e-9);
  assert.ok(Math.abs(p.y) < 1e-9);
  assert.ok(Math.abs(p.z) < 1e-9);
});

test('sphericalToXYZ: phi=0 lands on +Z axis regardless of theta', () => {
  const p = sphericalToXYZ(50, 2.3, 0);
  assert.ok(Math.abs(p.x) < 1e-9);
  assert.ok(Math.abs(p.y) < 1e-9);
  assert.ok(Math.abs(p.z - 50) < 1e-9);
});

test('sphericalToXYZ magnitude equals radius for arbitrary angles', () => {
  const p = sphericalToXYZ(777, 1.234, 2.1);
  const mag = Math.sqrt(p.x ** 2 + p.y ** 2 + p.z ** 2);
  assert.ok(Math.abs(mag - 777) < 1e-6);
});
