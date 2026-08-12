import assert from 'node:assert/strict';
import test from 'node:test';

import { slerpECEF, flyToDestination, createCameraRig } from '../src/camera-rig.js';

test('slerpECEF: t=0 returns from, t=1 returns to', () => {
  const from = { x: 1e7, y: 0, z: 0 };
  const to = { x: 0, y: 1e7, z: 0 };
  const p0 = slerpECEF(from, to, 0);
  const p1 = slerpECEF(from, to, 1);
  assert.ok(Math.abs(p0.x - from.x) < 1e-6 && Math.abs(p0.y - from.y) < 1e-6);
  assert.ok(Math.abs(p1.x - to.x) < 1e-6 && Math.abs(p1.y - to.y) < 1e-6);
});

test('slerpECEF: radius interpolates linearly between two different-altitude points', () => {
  const from = { x: 1e7, y: 0, z: 0 };   // r = 1e7
  const to = { x: 0, y: 2e7, z: 0 };     // r = 2e7
  const mid = slerpECEF(from, to, 0.5);
  const r = Math.sqrt(mid.x ** 2 + mid.y ** 2 + mid.z ** 2);
  assert.ok(Math.abs(r - 1.5e7) < 1, `expected r~1.5e7, got ${r}`);
});

test('flyToDestination places the point beyond the target at the given altitude', () => {
  const target = { x: 6378137, y: 0, z: 0 }; // on the equator at Earth's surface
  const dest = flyToDestination(target, 1000000);
  const r = Math.sqrt(dest.x ** 2 + dest.y ** 2 + dest.z ** 2);
  assert.ok(Math.abs(r - (6378137 + 1000000)) < 1e-3);
  // Same direction as target (just farther out)
  assert.ok(dest.x > 0 && Math.abs(dest.y) < 1e-6 && Math.abs(dest.z) < 1e-6);
});

test('createCameraRig: flyTo reaches destination and fires onEnd once', () => {
  let camPos = { x: 0, y: 0, z: 1e8 };
  const rig = createCameraRig({
    getCameraPosition: () => camPos,
    setCameraPosition: (p) => { camPos = p; },
  });

  let ended = 0;
  const target = { x: 6378137, y: 0, z: 0 };
  rig.flyTo(target, { altitude: 1000000, duration: 1000, onEnd: () => { ended++; } });

  rig.tick(0);      // start
  assert.ok(rig.isFlying());
  rig.tick(500);     // mid-flight
  assert.ok(rig.isFlying());
  rig.tick(1000);    // arrival
  assert.equal(ended, 1);
  assert.ok(!rig.isFlying());

  const r = Math.sqrt(camPos.x ** 2 + camPos.y ** 2 + camPos.z ** 2);
  assert.ok(Math.abs(r - (6378137 + 1000000)) < 10, `expected arrival radius, got ${r}`);
});

test('createCameraRig: tracking translates camera by target delta, not to target itself', () => {
  let camPos = { x: 1000, y: 2000, z: 3000 };
  const rig = createCameraRig({
    getCameraPosition: () => camPos,
    setCameraPosition: (p) => { camPos = p; },
  });

  let targetPos = { x: 0, y: 0, z: 0 };
  rig.startTracking(() => targetPos);

  rig.tick(0); // first tick just records trackLastPos, no movement yet
  const afterFirst = { ...camPos };
  assert.deepEqual(afterFirst, { x: 1000, y: 2000, z: 3000 });

  targetPos = { x: 10, y: -5, z: 2 }; // target moved
  rig.tick(16);
  // Camera should move by the SAME delta the target moved, preserving offset
  assert.ok(Math.abs(camPos.x - 1010) < 1e-9);
  assert.ok(Math.abs(camPos.y - 1995) < 1e-9);
  assert.ok(Math.abs(camPos.z - 3002) < 1e-9);

  rig.stopTracking();
  assert.ok(!rig.isTracking());
});

test('createCameraRig: flyTo takes priority over tracking while airborne', () => {
  let camPos = { x: 0, y: 0, z: 1e8 };
  const rig = createCameraRig({
    getCameraPosition: () => camPos,
    setCameraPosition: (p) => { camPos = p; },
  });
  rig.startTracking(() => ({ x: 999, y: 999, z: 999 }));
  rig.flyTo({ x: 6378137, y: 0, z: 0 }, { altitude: 0, duration: 100 });
  assert.ok(rig.isFlying());
  rig.tick(0);
  rig.tick(50);
  // Still flying; tracking's target position must not have been applied directly
  assert.ok(rig.isFlying());
});
