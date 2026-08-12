import assert from 'node:assert/strict';
import test from 'node:test';

import { sampleGroundTrack } from '../src/orbits.js';

// Minimal stub mimicking satellite.js's API surface used by propagateToECEF.
function makeStubLib({ fails = false } = {}) {
  return {
    propagate(satrec, date) {
      if (fails) return null;
      // Circular path parametrized by time, just enough to produce distinct points.
      const t = date.getTime() / 1000;
      return { position: { x: Math.cos(t / 1000) * 7000, y: Math.sin(t / 1000) * 7000, z: 500 } };
    },
    gstime() { return 0; },
    eciToEcf(pos) { return pos; }, // identity for the stub
  };
}

test('sampleGroundTrack returns steps+1 points (3 numbers each) on success', () => {
  const pts = sampleGroundTrack({}, makeStubLib(), Date.now(), 10);
  assert.equal(pts.length, (10 + 1) * 3);
});

test('sampleGroundTrack skips failed propagations without throwing', () => {
  const pts = sampleGroundTrack({}, makeStubLib({ fails: true }), Date.now(), 10);
  assert.equal(pts.length, 0);
});

test('sampleGroundTrack default step count covers ~24h at 5-minute spacing', () => {
  const pts = sampleGroundTrack({}, makeStubLib(), Date.now());
  assert.equal(pts.length, (288 + 1) * 3);
});
