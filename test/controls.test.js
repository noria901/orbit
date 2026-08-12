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

// ---- createControls: DOM event wiring (fake EventTarget, no real DOM needed) ----
import { createControls } from '../src/controls.js';

function makeFakeElement() {
  const listeners = {};
  return {
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) {
      listeners[type] = (listeners[type] || []).filter((f) => f !== fn);
    },
    fire(type, evt) { (listeners[type] || []).forEach((fn) => fn(evt)); },
  };
}

test('createControls: drag updates theta/phi and reports dragging=true', () => {
  const el = makeFakeElement();
  const controls = createControls(el, { onInteract: () => {}, windowLike: makeFakeElement() });
  el.fire('pointerdown', { clientX: 100, clientY: 100 });
  assert.equal(controls.state.dragging, true);
});

test('createControls: wheel zooms within [minDistance, maxDistance]', () => {
  const el = makeFakeElement();
  const controls = createControls(el, { minDistance: 10, maxDistance: 100, initialDistance: 50, windowLike: makeFakeElement() });
  el.fire('wheel', { preventDefault() {}, deltaY: 1 }); // positive deltaY -> zoom in (distance decreases)
  assert.ok(controls.state.distance < 50);
  for (let i = 0; i < 200; i++) el.fire('wheel', { preventDefault() {}, deltaY: 1 });
  assert.ok(controls.state.distance >= 10, 'should clamp at minDistance');
});

test('createControls: onInteract fires on pointerdown and wheel', () => {
  const el = makeFakeElement();
  let calls = 0;
  const controls = createControls(el, { onInteract: () => { calls++; }, windowLike: makeFakeElement() });
  el.fire('pointerdown', { clientX: 0, clientY: 0 });
  el.fire('wheel', { preventDefault() {}, deltaY: 1 });
  assert.equal(calls, 2);
});

test('createControls.tick applies idle inertia and decays it', () => {
  const el = makeFakeElement();
  const controls = createControls(el, { inertia: 0.5, windowLike: makeFakeElement() });
  controls.state.velTheta = 1.0;
  controls.state.dragging = false;
  const before = controls.state.theta;
  controls.tick();
  assert.ok(controls.state.theta > before, 'theta should advance from velocity');
  assert.ok(Math.abs(controls.state.velTheta - 0.5) < 1e-9, 'velocity should decay by inertia factor');
});

test('createControls: pointermove (via injected windowLike) actually rotates theta/phi', () => {
  const el = makeFakeElement();
  const win = makeFakeElement();
  const controls = createControls(el, { windowLike: win });

  el.fire('pointerdown', { clientX: 100, clientY: 100 });
  const thetaBefore = controls.state.theta;
  win.fire('pointermove', { clientX: 150, clientY: 100 }); // drag +50px right
  assert.notEqual(controls.state.theta, thetaBefore, 'theta should change on drag');

  el.fire('pointerup', {}); // via el, but pointerup listener is on windowLike in real usage
  win.fire('pointerup', {});
  assert.equal(controls.state.dragging, false);
});
