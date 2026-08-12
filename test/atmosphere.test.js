import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { createAtmosphere } from '../src/atmosphere.js';

test('createAtmosphere builds a back-side, transparent glow shell scaled beyond the given radius', () => {
  const equatorialRadius = 6378137;
  const mesh = createAtmosphere(THREE, equatorialRadius, { scale: 1.025, segments: 8 });
  assert.equal(mesh.name, 'atmosphere');
  assert.equal(mesh.material.type, 'ShaderMaterial');
  assert.equal(mesh.material.side, THREE.BackSide);
  assert.equal(mesh.material.transparent, true);

  const pos = mesh.geometry.getAttribute('position');
  const r = Math.hypot(pos.getX(0), pos.getY(0), pos.getZ(0));
  assert.ok(Math.abs(r - equatorialRadius * 1.025) < 1, `expected radius scaled by 1.025, got ${r}`);
});
