import assert from 'node:assert/strict';
import test from 'node:test';

import { quakesToRenderItems } from '../src/quakes.js';

const sampleGeojson = {
  features: [
    { geometry: { coordinates: [139.7, 35.7, 30] }, properties: { mag: 4.2, place: 'Tokyo', time: 1000 } },
    { geometry: { coordinates: [-118.2, 34.0, null] }, properties: { mag: 2.5, place: 'LA', time: 2000 } },
  ],
};

test('quakesToRenderItems produces one item per feature with ECEF position', () => {
  const items = quakesToRenderItems(sampleGeojson);
  assert.equal(items.length, 2);
  for (const it of items) {
    const r = Math.sqrt(it.x ** 2 + it.y ** 2 + it.z ** 2);
    assert.ok(Math.abs(r - 6378137) < 50000, `expected near-surface radius, got ${r}`);
    assert.match(it.color, /^#[0-9A-Fa-f]{6}$/);
  }
});

test('quakesToRenderItems defaults missing depth to 10km', () => {
  const items = quakesToRenderItems(sampleGeojson);
  assert.equal(items[1].depth, 10);
});

test('quakesToRenderItems preserves magnitude/place/time metadata', () => {
  const items = quakesToRenderItems(sampleGeojson);
  assert.equal(items[0].mag, 4.2);
  assert.equal(items[0].place, 'Tokyo');
  assert.equal(items[0].time, 1000);
});

test('quakesToRenderItems handles empty feature list', () => {
  assert.deepEqual(quakesToRenderItems({ features: [] }), []);
});

// ---- createQuakeLayer: real THREE point cloud rendering ----
import * as THREE from 'three';
import { createQuakeLayer } from '../src/quakes.js';

test('createQuakeLayer.render populates the mesh and DOM-facing counts', () => {
  const layer = createQuakeLayer(THREE, 500);
  const result = layer.render(sampleGeojson);
  assert.equal(result.total, 2);
  assert.equal(result.shown, 2);
  assert.equal(layer.mesh.geometry.drawRange.count, 2);
  assert.equal(layer.items.length, 2);
});
