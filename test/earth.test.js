import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { createEarth } from '../src/earth.js';
import { WGS84_A, WGS84_F } from '../src/geo.js';

test('createEarth scales a unit sphere into a WGS84 ellipsoid', () => {
  const { mesh, material } = createEarth(THREE, { segments: 16 });
  assert.equal(mesh.name, 'earth');
  assert.equal(material.type, 'MeshPhongMaterial');

  const pos = mesh.geometry.getAttribute('position');
  let maxEquatorial = 0, maxPolar = 0;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    maxEquatorial = Math.max(maxEquatorial, Math.hypot(x, z)); // equatorial plane
    maxPolar = Math.max(maxPolar, Math.abs(y)); // polar axis (pre-rotation)
  }
  const expectedB = WGS84_A * (1 - WGS84_F);
  assert.ok(Math.abs(maxEquatorial - WGS84_A) < 1, `equatorial radius off: ${maxEquatorial}`);
  assert.ok(Math.abs(maxPolar - expectedB) < 1, `polar radius off: ${maxPolar}`);
});
