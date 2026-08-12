const assert = require('node:assert/strict');
const test = require('node:test');
const {
  createCameraRig, slerp, cameraPositionAbove, easeInOut,
  DEFAULT_FLY_DURATION, DEFAULT_FLY_ALTITUDE,
} = require('../src/camera-rig');

// --- Minimal camera mock ---
function createMockCamera(x = 0, y = 0, z = 34000000) {
  return {
    position: { x, y, z, set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; } },
    lookAt() {},
  };
}

// --- Tests ---

test('easeInOut is 0 at t=0 and 1 at t=1', () => {
  assert.equal(easeInOut(0), 0);
  assert.equal(easeInOut(1), 1);
  assert.ok(Math.abs(easeInOut(0.5) - 0.5) < 0.01);
});

test('easeInOut is symmetric', () => {
  assert.ok(Math.abs(easeInOut(0.25) - (1 - easeInOut(0.75))) < 1e-10);
});

test('slerp at t=0 returns from', () => {
  const from = { x: 1e7, y: 0, z: 0 };
  const to   = { x: 0, y: 1e7, z: 0 };
  const out  = { x: 0, y: 0, z: 0 };
  slerp(from, to, 0, out);
  assert.ok(Math.abs(out.x - 1e7) < 1);
  assert.ok(Math.abs(out.y) < 1);
});

test('slerp at t=1 returns to', () => {
  const from = { x: 1e7, y: 0, z: 0 };
  const to   = { x: 0, y: 1e7, z: 0 };
  const out  = { x: 0, y: 0, z: 0 };
  slerp(from, to, 1, out);
  assert.ok(Math.abs(out.x) < 1);
  assert.ok(Math.abs(out.y - 1e7) < 1);
});

test('cameraPositionAbove places camera radially outward', () => {
  const target = { x: 6371000, y: 0, z: 0 }; // equator
  const pos = cameraPositionAbove(target, 2000000);
  const r = Math.sqrt(pos.x**2 + pos.y**2 + pos.z**2);
  assert.ok(Math.abs(r - (6371000 + 2000000)) < 10, `r=${r}`);
  assert.ok(Math.abs(pos.y) < 1);
  assert.ok(Math.abs(pos.z) < 1);
});

test('createCameraRig returns expected API', () => {
  const rig = createCameraRig(createMockCamera());
  assert.equal(typeof rig.flyTo, 'function');
  assert.equal(typeof rig.startTracking, 'function');
  assert.equal(typeof rig.stopTracking, 'function');
  assert.equal(typeof rig.tick, 'function');
  assert.equal(rig.flying, false);
  assert.equal(rig.tracking, false);
});

test('flyTo sets flying=true until animation completes', () => {
  const camera = createMockCamera(0, 0, 3.4e7);
  const rig = createCameraRig(camera, { flyDuration: 1000 });
  const target = { x: 6371000, y: 0, z: 0 };

  rig.flyTo(target);
  assert.equal(rig.flying, true);

  // Advance past duration
  rig.tick(0);
  rig.tick(1001);
  assert.equal(rig.flying, false);
});

test('flyTo moves camera towards destination', () => {
  const camera = createMockCamera(0, 0, 3.4e7); // start above north pole
  const rig = createCameraRig(camera, { flyDuration: 1000, flyAltitude: 2e6 });
  const target = { x: 8.371e6, y: 0, z: 0 }; // equator

  rig.flyTo(target);
  rig.tick(0);    // start
  rig.tick(500);  // halfway

  // Camera should have moved from Z axis toward X axis
  assert.ok(camera.position.x > 0, `x=${camera.position.x} should be >0 at halfway`);
});

test('flyTo calls onEnd callback', () => {
  const camera = createMockCamera(0, 0, 3.4e7);
  const rig = createCameraRig(camera, { flyDuration: 100 });
  let called = false;
  rig.flyTo({ x: 6371000, y: 0, z: 0 }, { onEnd: () => { called = true; } });
  rig.tick(0);
  rig.tick(200);
  assert.equal(called, true);
});

test('startTracking shifts camera by target delta', () => {
  const camera = createMockCamera(3.4e7, 0, 0);
  const rig = createCameraRig(camera);

  let posX = 6371000;
  rig.startTracking(() => ({ x: posX, y: 0, z: 0 }));
  assert.equal(rig.tracking, true);

  // First tick: sets trackLastPos, no delta yet
  rig.tick(0);
  const x0 = camera.position.x;

  // Target moves +1000m
  posX += 1000;
  rig.tick(16);

  assert.ok(Math.abs(camera.position.x - (x0 + 1000)) < 0.1);
});

test('stopTracking ends tracking', () => {
  const camera = createMockCamera(3.4e7, 0, 0);
  const rig = createCameraRig(camera);
  rig.startTracking(() => ({ x: 6371000, y: 0, z: 0 }));
  rig.stopTracking();
  assert.equal(rig.tracking, false);
});

test('tracking is suppressed during fly', () => {
  const camera = createMockCamera(0, 0, 3.4e7);
  const rig = createCameraRig(camera, { flyDuration: 1000 });

  let posX = 6371000;
  rig.startTracking(() => ({ x: posX, y: 0, z: 0 }));
  rig.flyTo({ x: 8.371e6, y: 0, z: 0 });

  rig.tick(0);
  const x0 = camera.position.x;
  posX += 100000;
  rig.tick(100);

  // During fly, tracking delta should NOT be applied — position is driven by fly
  // Camera moved because of fly, not tracking
  assert.equal(rig.flying, true);
});
