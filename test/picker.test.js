import assert from 'node:assert/strict';
import test from 'node:test';

import { findNearest } from '../src/picker.js';

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
