import assert from 'node:assert/strict';
import test from 'node:test';

import { hexToRGB } from '../src/points.js';

test('hexToRGB: pure red/green/blue', () => {
  assert.deepEqual(hexToRGB('#FF0000'), { r: 1, g: 0, b: 0 });
  assert.deepEqual(hexToRGB('#00FF00'), { r: 0, g: 1, b: 0 });
  assert.deepEqual(hexToRGB('#0000FF'), { r: 0, g: 0, b: 1 });
});

test('hexToRGB: black and white', () => {
  assert.deepEqual(hexToRGB('#000000'), { r: 0, g: 0, b: 0 });
  assert.deepEqual(hexToRGB('#FFFFFF'), { r: 1, g: 1, b: 1 });
});

test('hexToRGB: mixed value matches expected fractions', () => {
  const c = hexToRGB('#FF6B3D');
  assert.ok(Math.abs(c.r - 1) < 1e-9);
  assert.ok(Math.abs(c.g - 0x6b / 255) < 1e-9);
  assert.ok(Math.abs(c.b - 0x3d / 255) < 1e-9);
});
