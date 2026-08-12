import assert from 'node:assert/strict';
import test from 'node:test';

import { Vec3, Mat3, Mat4, Quat, Transforms, toRadians, toDegrees } from '../src/math.js';
import { geoToEcef } from '../src/geo.js';

const EPSILON = 1e-9;
function near(a, b, eps = EPSILON) { return Math.abs(a - b) < eps; }

test('Vec3.add / subtract / scale', () => {
  const a = { x: 1, y: 2, z: 3 };
  const b = { x: 4, y: 5, z: 6 };
  const sum = Vec3.add(a, b);
  assert.ok(near(sum.x, 5) && near(sum.y, 7) && near(sum.z, 9));

  const diff = Vec3.subtract(b, a);
  assert.ok(near(diff.x, 3) && near(diff.y, 3) && near(diff.z, 3));

  const scaled = Vec3.scale(a, 2);
  assert.ok(near(scaled.x, 2) && near(scaled.y, 4) && near(scaled.z, 6));
});

test('Vec3.dot / cross', () => {
  const x = Vec3.UNIT_X, y = Vec3.UNIT_Y, z = Vec3.UNIT_Z;
  assert.ok(near(Vec3.dot(x, y), 0));
  assert.ok(near(Vec3.dot(x, x), 1));

  const c = Vec3.cross(x, y);
  assert.ok(near(c.x, 0) && near(c.y, 0) && near(c.z, 1));
});

test('Vec3.magnitude / distance / normalize', () => {
  const v = { x: 3, y: 4, z: 0 };
  assert.ok(near(Vec3.magnitude(v), 5));
  assert.ok(near(Vec3.distance(Vec3.ZERO, v), 5));

  const n = Vec3.normalize(v);
  assert.ok(near(Vec3.magnitude(n), 1));
  assert.ok(near(n.x, 0.6) && near(n.y, 0.8));
});

test('Mat3.identity multiplied by vec3 returns vec3', () => {
  const id = Mat3.identity();
  const v = { x: 7, y: -3, z: 11 };
  const r = Mat3.multiplyVec3(id, v);
  assert.ok(near(r.x, v.x) && near(r.y, v.y) && near(r.z, v.z));
});

test('Mat4.identity preserves translation', () => {
  const id = Mat4.identity();
  const t = Mat4.getTranslation(id);
  assert.ok(near(t.x, 0) && near(t.y, 0) && near(t.z, 0));
});

test('Mat4.fromRotationTranslation round-trips', () => {
  const rot = Mat3.identity();
  const trans = { x: 10, y: 20, z: 30 };
  const m = Mat4.fromRotationTranslation(rot, trans);
  const t = Mat4.getTranslation(m);
  assert.ok(near(t.x, 10) && near(t.y, 20) && near(t.z, 30));
});

test('Quat.fromAxisAngle creates correct rotation', () => {
  // 90 degrees around Z axis
  const q = Quat.fromAxisAngle(Vec3.UNIT_Z, Math.PI / 2);
  const rot = Quat.toMat3(q);
  // Rotate UNIT_X should give UNIT_Y
  const r = Mat3.multiplyVec3(rot, Vec3.UNIT_X);
  assert.ok(near(r.x, 0) && near(r.y, 1) && near(r.z, 0));
});

test('Quat.fromHeadingPitchRoll identity', () => {
  const q = Quat.fromHeadingPitchRoll(0, 0, 0);
  assert.ok(near(q.w, 1) && near(q.x, 0) && near(q.y, 0) && near(q.z, 0));
});

test('toRadians / toDegrees', () => {
  assert.ok(near(toRadians(180), Math.PI));
  assert.ok(near(toDegrees(Math.PI), 180));
  assert.ok(near(toDegrees(toRadians(45)), 45));
});

test('Transforms.eastNorthUpToFixedFrame at equator 0E', () => {
  const pos = geoToEcef(0, 0, 0);
  const enu = Transforms.eastNorthUpToFixedFrame(pos);

  // At (0,0,0): East = +Y, North = +Z, Up = +X
  // East column (col 0)
  assert.ok(near(enu[0], 0, 1e-6));  // east.x ~ 0
  assert.ok(near(enu[1], 1, 1e-6));  // east.y ~ 1
  assert.ok(near(enu[2], 0, 1e-6));  // east.z ~ 0

  // Up column (col 2)
  assert.ok(near(enu[8], 1, 1e-6));   // up.x ~ 1
  assert.ok(near(enu[9], 0, 1e-6));   // up.y ~ 0
  assert.ok(near(enu[10], 0, 1e-6));  // up.z ~ 0

  // Translation = position
  assert.ok(near(enu[12], pos.x, 1));
  assert.ok(near(enu[13], pos.y, 1));
  assert.ok(near(enu[14], pos.z, 1));
});

test('Transforms.headingPitchRollToFixedFrame returns valid 4x4', () => {
  const pos = geoToEcef(35.68, 139.77, 0);
  const m = Transforms.headingPitchRollToFixedFrame(pos, 0, 0, 0);
  // Should be a valid matrix (not NaN)
  for (let i = 0; i < 16; i++) {
    assert.ok(!isNaN(m[i]), `m[${i}] is NaN`);
  }
  // Translation should match position
  assert.ok(near(m[12], pos.x, 1));
  assert.ok(near(m[13], pos.y, 1));
  assert.ok(near(m[14], pos.z, 1));
});
