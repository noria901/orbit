/**
 * Minimal 3D math utilities for ORBIT.
 *
 * Replaces Cesium.Cartesian3, Matrix3, Matrix4, HeadingPitchRoll,
 * BoundingSphere, NearFarScalar, and related helpers.
 *
 * All vectors are plain {x,y,z} objects.  Matrices are Float64Array(9|16)
 * in column-major order (OpenGL / Three.js convention).
 */

'use strict';

// ---------- Vec3 ----------

const Vec3 = {
  create(x = 0, y = 0, z = 0) { return { x, y, z }; },

  clone(v) { return { x: v.x, y: v.y, z: v.z }; },

  set(out, x, y, z) { out.x = x; out.y = y; out.z = z; return out; },

  add(a, b, out = {}) { out.x = a.x + b.x; out.y = a.y + b.y; out.z = a.z + b.z; return out; },

  subtract(a, b, out = {}) { out.x = a.x - b.x; out.y = a.y - b.y; out.z = a.z - b.z; return out; },

  scale(v, s, out = {}) { out.x = v.x * s; out.y = v.y * s; out.z = v.z * s; return out; },

  dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; },

  cross(a, b, out = {}) {
    out.x = a.y * b.z - a.z * b.y;
    out.y = a.z * b.x - a.x * b.z;
    out.z = a.x * b.y - a.y * b.x;
    return out;
  },

  magnitude(v) { return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z); },

  magnitudeSquared(v) { return v.x * v.x + v.y * v.y + v.z * v.z; },

  distance(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },

  normalize(v, out = {}) {
    const m = Vec3.magnitude(v);
    if (m < Number.EPSILON) { out.x = 0; out.y = 0; out.z = 0; return out; }
    return Vec3.scale(v, 1 / m, out);
  },

  lerp(a, b, t, out = {}) {
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
    return out;
  },

  ZERO:  Object.freeze({ x: 0, y: 0, z: 0 }),
  UNIT_X: Object.freeze({ x: 1, y: 0, z: 0 }),
  UNIT_Y: Object.freeze({ x: 0, y: 1, z: 0 }),
  UNIT_Z: Object.freeze({ x: 0, y: 0, z: 1 }),
};

// ---------- Mat3 (column-major Float64Array[9]) ----------

const Mat3 = {
  create() { return new Float64Array(9); },

  identity(out = new Float64Array(9)) {
    out.fill(0);
    out[0] = out[4] = out[8] = 1;
    return out;
  },

  /** Multiply Mat3 * Vec3 */
  multiplyVec3(m, v, out = {}) {
    out.x = m[0] * v.x + m[3] * v.y + m[6] * v.z;
    out.y = m[1] * v.x + m[4] * v.y + m[7] * v.z;
    out.z = m[2] * v.x + m[5] * v.y + m[8] * v.z;
    return out;
  },

  /** Extract upper-left 3x3 from a 4x4 matrix */
  fromMat4(m4, out = new Float64Array(9)) {
    out[0] = m4[0]; out[1] = m4[1]; out[2] = m4[2];
    out[3] = m4[4]; out[4] = m4[5]; out[5] = m4[6];
    out[6] = m4[8]; out[7] = m4[9]; out[8] = m4[10];
    return out;
  },
};

// ---------- Mat4 (column-major Float64Array[16]) ----------

const Mat4 = {
  create() { return new Float64Array(16); },

  identity(out = new Float64Array(16)) {
    out.fill(0);
    out[0] = out[5] = out[10] = out[15] = 1;
    return out;
  },

  clone(m) { return new Float64Array(m); },

  /** Get the translation column (column 3) */
  getTranslation(m, out = {}) {
    out.x = m[12]; out.y = m[13]; out.z = m[14];
    return out;
  },

  /** Set the translation column */
  setTranslation(m, v, out) {
    if (out !== m) { out = new Float64Array(m); }
    out[12] = v.x; out[13] = v.y; out[14] = v.z;
    return out;
  },

  /** Extract upper-left 3x3 as Mat3 */
  getMatrix3(m, out) { return Mat3.fromMat4(m, out); },

  /** Build a 4x4 from rotation (Mat3) + translation (Vec3) */
  fromRotationTranslation(rot, trans, out = new Float64Array(16)) {
    out[0] = rot[0]; out[1] = rot[1]; out[2] = rot[2]; out[3] = 0;
    out[4] = rot[3]; out[5] = rot[4]; out[6] = rot[5]; out[7] = 0;
    out[8] = rot[6]; out[9] = rot[7]; out[10] = rot[8]; out[11] = 0;
    out[12] = trans.x; out[13] = trans.y; out[14] = trans.z; out[15] = 1;
    return out;
  },

  /** Multiply two 4x4 matrices */
  multiply(a, b, out = new Float64Array(16)) {
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[k * 4 + row] * b[col * 4 + k];
        }
        out[col * 4 + row] = sum;
      }
    }
    return out;
  },
};

// ---------- Quaternion ----------

const Quat = {
  create(x = 0, y = 0, z = 0, w = 1) { return { x, y, z, w }; },

  /** From axis (unit Vec3) + angle (radians) */
  fromAxisAngle(axis, angle) {
    const half = angle / 2;
    const s = Math.sin(half);
    return { x: axis.x * s, y: axis.y * s, z: axis.z * s, w: Math.cos(half) };
  },

  /** From heading (yaw), pitch, roll in radians — ZYX intrinsic order */
  fromHeadingPitchRoll(heading, pitch, roll) {
    const ch = Math.cos(heading / 2), sh = Math.sin(heading / 2);
    const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
    const cr = Math.cos(roll / 2), sr = Math.sin(roll / 2);
    return {
      x: sr * cp * ch - cr * sp * sh,
      y: cr * sp * ch + sr * cp * sh,
      z: cr * cp * sh - sr * sp * ch,
      w: cr * cp * ch + sr * sp * sh,
    };
  },

  /** Convert quaternion to 3x3 rotation matrix (column-major) */
  toMat3(q, out = new Float64Array(9)) {
    const { x, y, z, w } = q;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;

    out[0] = 1 - yy - zz; out[1] = xy + wz;     out[2] = xz - wy;
    out[3] = xy - wz;     out[4] = 1 - xx - zz;  out[5] = yz + wx;
    out[6] = xz + wy;     out[7] = yz - wx;      out[8] = 1 - xx - yy;
    return out;
  },

  /** Quaternion multiplication */
  multiply(a, b) {
    return {
      x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
      y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
      z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
      w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    };
  },

  normalize(q) {
    const m = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
    if (m < Number.EPSILON) return { x: 0, y: 0, z: 0, w: 1 };
    return { x: q.x / m, y: q.y / m, z: q.z / m, w: q.w / m };
  },
};

// ---------- Transforms (ENU / heading-pitch-roll) ----------

const Transforms = {
  /**
   * Build a local East-North-Up (ENU) frame at the given ECEF position.
   * Returns a 4x4 matrix whose columns are [East, North, Up, Position].
   */
  eastNorthUpToFixedFrame(position, out = new Float64Array(16)) {
    const { x, y, z } = position;
    const mag = Math.sqrt(x * x + y * y + z * z);
    if (mag < Number.EPSILON) return Mat4.identity(out);

    // Up = normalized position
    const ux = x / mag, uy = y / mag, uz = z / mag;

    // East = normalize(cross(UNIT_Z, up))
    let ex = -uy, ey = ux, ez = 0;
    const emag = Math.sqrt(ex * ex + ey * ey);
    if (emag < Number.EPSILON) {
      // At pole: use UNIT_X as east
      ex = 1; ey = 0; ez = 0;
    } else {
      ex /= emag; ey /= emag;
    }

    // North = cross(up, east)
    const nx = uy * ez - uz * ey;
    const ny = uz * ex - ux * ez;
    const nz = ux * ey - uy * ex;

    // Column-major
    out[0] = ex;  out[1] = ey;  out[2] = ez;  out[3] = 0;
    out[4] = nx;  out[5] = ny;  out[6] = nz;  out[7] = 0;
    out[8] = ux;  out[9] = uy;  out[10] = uz; out[11] = 0;
    out[12] = x;  out[13] = y;  out[14] = z;  out[15] = 1;
    return out;
  },

  /**
   * Build a fixed-frame 4x4 from ECEF position + heading/pitch/roll.
   * Equivalent to Cesium.Transforms.headingPitchRollToFixedFrame.
   */
  headingPitchRollToFixedFrame(position, heading, pitch, roll, out) {
    const enu = Transforms.eastNorthUpToFixedFrame(position, out);
    const q = Quat.fromHeadingPitchRoll(heading, pitch, roll);
    const rot = Quat.toMat3(q);

    // Multiply ENU rotation (upper 3x3) by HPR rotation
    const r = new Float64Array(9);
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 3; row++) {
        r[col * 3 + row] =
          enu[0 * 4 + row] * rot[col * 3 + 0] +
          enu[1 * 4 + row] * rot[col * 3 + 1] +
          enu[2 * 4 + row] * rot[col * 3 + 2];
      }
    }

    // Write back combined rotation, keep translation
    enu[0] = r[0]; enu[1] = r[1]; enu[2] = r[2];
    enu[4] = r[3]; enu[5] = r[4]; enu[6] = r[5];
    enu[8] = r[6]; enu[9] = r[7]; enu[10] = r[8];
    return enu;
  },
};

// ---------- Angle helpers ----------

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function toRadians(degrees) { return degrees * DEG; }
function toDegrees(radians) { return radians * RAD; }

// ---------- Exports ----------

export {
  Vec3, Mat3, Mat4, Quat, Transforms,
  toRadians, toDegrees, DEG, RAD,
};
