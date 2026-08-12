import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';

import { createISSLayer } from '../src/iss-layer.js';

test('createISSLayer.update writes dot + ground-line positions from geo input', () => {
  const layer = createISSLayer(THREE);
  const geo = { latitude: 35.0, longitude: 139.0, altitude: 408 };
  const issPos = layer.update(geo);

  assert.ok(issPos, 'update should return the ISS ECEF position');
  const dotPos = layer.dot.geometry.attributes.position.array;
  // dotGeom uses a Float32Array (required for WebGL buffers); at ECEF scale
  // (~1e7m) float32 has only ~7 significant digits, so expect sub-meter
  // rounding, not exact equality with the float64 source value.
  assert.ok(Math.abs(dotPos[0] - issPos.x) < 1, `float32 rounding exceeded 1m: ${dotPos[0]} vs ${issPos.x}`);

  const linePos = layer.line.geometry.attributes.position.array;
  assert.ok(Math.abs(linePos[0] - issPos.x) < 1);
  const groundRadius = Math.sqrt(linePos[3] ** 2 + linePos[4] ** 2 + linePos[5] ** 2);
  // WGS84は楕円体なので、緯度35°の地心距離は極半径(~6356752m)〜赤道半径(~6378137m)の間になる。
  assert.ok(groundRadius > 6356000 && groundRadius < 6379000,
    `expected ground point within WGS84 polar-equatorial range, got r=${groundRadius}`);
});

test('createISSLayer.update is a no-op when geo is null (no fix yet)', () => {
  const layer = createISSLayer(THREE);
  const result = layer.update(null);
  assert.equal(result, undefined);
});

test('createISSLayer.group contains both the dot and the line', () => {
  const layer = createISSLayer(THREE);
  assert.equal(layer.group.children.length, 2);
  assert.ok(layer.group.children.includes(layer.dot));
  assert.ok(layer.group.children.includes(layer.line));
});
