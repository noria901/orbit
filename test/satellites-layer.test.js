import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { createSatellitesLayer } from '../src/satellites-layer.js';

function makeStubLib() {
  return {
    twoline2satrec(l1, l2) { return { line1: l1, line2: l2 }; },
    propagate(satrec, date) {
      const t = date.getTime() / 1000;
      return { position: { x: Math.cos(t) * 7000, y: Math.sin(t) * 7000, z: 500 } };
    },
    gstime() { return 0; },
    eciToEcf(pos) { return pos; },
  };
}

const entries = [
  { name: 'STARLINK-1', line1: '1 X', line2: '2 X', category: 'starlink' },
  { name: 'QZS-1', line1: '1 Y', line2: '2 Y', category: 'qzss' },
];

test('createSatellitesLayer.load builds records + category index and colors the buffer', () => {
  const layer = createSatellitesLayer(THREE, 100);
  const { total, catIndex } = layer.load(entries, makeStubLib());
  assert.equal(total, 2);
  assert.equal(catIndex.starlink.length, 1);
  assert.equal(catIndex.qzss.length, 1);
  assert.equal(layer.records.length, 2);
});

test('createSatellitesLayer.updatePositions writes propagated ECEF into the buffer', () => {
  const layer = createSatellitesLayer(THREE, 100);
  layer.load(entries, makeStubLib());
  layer.updatePositions(new Date(0), makeStubLib());
  const pos = layer.mesh.geometry.attributes.position.array;
  // At t=0, stub propagate gives x=cos(0)*7000=7000, y=sin(0)*7000=0, z=500 (km),
  // and propagateToECEF converts km -> m (x1000).
  assert.ok(Math.abs(pos[0] - 7000000) < 1e-3);
  assert.ok(Math.abs(pos[1] - 0) < 1e-3);
  assert.ok(Math.abs(pos[2] - 500000) < 1e-3);
  assert.equal(layer.mesh.geometry.drawRange.count, 2);
});

test('createSatellitesLayer.updatePositions leaves last-known position on propagation failure', () => {
  const layer = createSatellitesLayer(THREE, 100);
  layer.load(entries, makeStubLib());
  layer.updatePositions(new Date(0), makeStubLib());
  const before = Array.from(layer.mesh.geometry.attributes.position.array.slice(0, 3));

  const failingLib = { ...makeStubLib(), propagate: () => null };
  layer.updatePositions(new Date(1000), failingLib);
  const after = Array.from(layer.mesh.geometry.attributes.position.array.slice(0, 3));
  assert.deepEqual(before, after, 'position should not reset to origin on propagation failure');
});
