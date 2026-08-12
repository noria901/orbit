const assert = require('node:assert/strict');
const test = require('node:test');
const { createOrbitControls, sphericalToCartesian, clampPhi, MIN_DISTANCE } = require('../src/controls');
const { WGS84_A } = require('../src/geo');

test('sphericalToCartesian: equator +X', () => {
  const p = sphericalToCartesian(1, 0, Math.PI / 2);
  assert.ok(Math.abs(p.x - 1) < 1e-10);
  assert.ok(Math.abs(p.y) < 1e-10);
  assert.ok(Math.abs(p.z) < 1e-10);
});

test('sphericalToCartesian: north pole', () => {
  const p = sphericalToCartesian(1, 0, 0.01); // near pole
  assert.ok(p.z > 0.99);
});

test('clampPhi prevents exact 0 and pi', () => {
  assert.equal(clampPhi(0), 0.01);
  assert.equal(clampPhi(Math.PI), Math.PI - 0.01);
  assert.equal(clampPhi(1), 1);
});

test('createOrbitControls defaults', () => {
  const ctrl = createOrbitControls();
  assert.equal(ctrl.distance, WGS84_A * 5);
  assert.equal(ctrl.theta, 0);
  assert.equal(ctrl.phi, Math.PI / 2);
  assert.equal(ctrl.dragging, false);
});

test('update returns Cartesian position', () => {
  const ctrl = createOrbitControls({ distance: 1000, theta: 0, phi: Math.PI / 2 });
  const pos = ctrl.update();
  assert.ok(Math.abs(pos.x - 1000) < 1);
  assert.ok(Math.abs(pos.y) < 1);
  assert.ok(Math.abs(pos.z) < 1);
});

test('rotate changes theta and phi', () => {
  const ctrl = createOrbitControls({ distance: 1000 });
  const t0 = ctrl.theta;
  const p0 = ctrl.phi;
  ctrl.rotate(100, 50);
  assert.notEqual(ctrl.theta, t0);
  assert.notEqual(ctrl.phi, p0);
});

test('zoom changes distance', () => {
  const ctrl = createOrbitControls({ distance: WGS84_A * 3 });
  const d0 = ctrl.distance;
  ctrl.zoom(1); // zoom in
  assert.ok(ctrl.distance < d0);
});

test('zoom clamps to min/max', () => {
  const ctrl = createOrbitControls({ distance: MIN_DISTANCE * 1.01 });
  ctrl.zoom(100); // aggressive zoom in
  assert.ok(ctrl.distance >= MIN_DISTANCE);
});

test('inertia decays when not dragging', () => {
  const ctrl = createOrbitControls({ distance: 1000 });
  ctrl.rotate(50, 0); // give velocity
  ctrl.endDrag();

  const pos1 = ctrl.update();
  const theta1 = ctrl.theta;
  const pos2 = ctrl.update();
  const theta2 = ctrl.theta;
  const pos3 = ctrl.update();
  const theta3 = ctrl.theta;

  // Each step should be smaller (decaying)
  const d1 = Math.abs(theta2 - theta1);
  const d2 = Math.abs(theta3 - theta2);
  assert.ok(d2 < d1, 'inertia should decay');
});

test('drag suppresses inertia', () => {
  const ctrl = createOrbitControls({ distance: 1000 });
  ctrl.rotate(50, 0);
  ctrl.startDrag();

  const theta1 = ctrl.theta;
  ctrl.update();
  const theta2 = ctrl.theta;

  // While dragging, inertia should not apply
  assert.equal(theta1, theta2);
});
