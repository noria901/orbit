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

// ---- createPointCloud/updatePointCloud: real THREE.BufferGeometry ----
import * as THREE from 'three';
import { createPointCloud, updatePointCloud } from '../src/points.js';

test('createPointCloud allocates fixed-size buffers and starts with drawRange 0', () => {
  const cloud = createPointCloud(THREE, 100, 5, true);
  assert.equal(cloud.positions.length, 300);
  assert.equal(cloud.colors.length, 300);
  assert.equal(cloud.geom.drawRange.count, 0);
  assert.equal(cloud.mesh.type, 'Points');
});

test('updatePointCloud writes positions/colors and sets the correct draw range', () => {
  const cloud = createPointCloud(THREE, 10);
  const items = [
    { x: 1, y: 2, z: 3, color: '#FF0000' },
    { x: 4, y: 5, z: 6, color: '#00FF00' },
  ];
  const count = updatePointCloud(cloud, items);
  assert.equal(count, 2);
  assert.equal(cloud.geom.drawRange.count, 2);
  assert.deepEqual(Array.from(cloud.positions.slice(0, 6)), [1, 2, 3, 4, 5, 6]);
  assert.ok(cloud.colors[0] > 0.9 && cloud.colors[1] < 0.1); // first point is red
});

test('updatePointCloud truncates to capacity without throwing', () => {
  const cloud = createPointCloud(THREE, 2);
  const items = [
    { x: 1, y: 0, z: 0, color: '#FFFFFF' },
    { x: 2, y: 0, z: 0, color: '#FFFFFF' },
    { x: 3, y: 0, z: 0, color: '#FFFFFF' }, // exceeds capacity of 2
  ];
  const count = updatePointCloud(cloud, items);
  assert.equal(count, 2);
});
