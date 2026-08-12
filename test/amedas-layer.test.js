import assert from 'node:assert/strict';
import test from 'node:test';

import { amedasToRenderItems } from '../src/amedas-layer.js';

const meta = {
  '44132': { kjName: '東京', lat: [35, 41.4], lon: [139, 45.6] },
  '99999': { kjName: '欠測地点', lat: [40, 0], lon: [140, 0] },
};

test('amedasToRenderItems skips stations with bad quality flag', () => {
  const obs = {
    '44132': { temp: [25.3, 0] },
    '99999': { temp: [10.0, 1] }, // quality flag != 0 -> excluded
  };
  const items = amedasToRenderItems(obs, meta);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, '東京');
  assert.equal(items[0].temp, 25.3);
});

test('amedasToRenderItems skips stations with no meta entry', () => {
  const obs = { unknown_id: { temp: [1, 0] } };
  assert.deepEqual(amedasToRenderItems(obs, meta), []);
});

test('amedasToRenderItems returns [] when meta is not loaded yet', () => {
  assert.deepEqual(amedasToRenderItems({ '44132': { temp: [1, 0] } }, null), []);
});

test('amedasToRenderItems includes optional wind/rain/humidity only when quality-flagged good', () => {
  const obs = {
    '44132': { temp: [20, 0], wind: [3.2, 0], precipitation1h: [0.5, 1], humidity: [55, 0] },
  };
  const items = amedasToRenderItems(obs, meta);
  assert.equal(items[0].wind, 3.2);
  assert.equal(items[0].rain, null); // flagged bad (1), excluded
  assert.equal(items[0].hum, 55);
});

// ---- createAmedasLayer: real THREE point cloud rendering ----
import * as THREE from 'three';
import { createAmedasLayer } from '../src/amedas-layer.js';

test('createAmedasLayer.render populates the mesh, skipping bad-quality stations', () => {
  const layer = createAmedasLayer(THREE, 2000);
  const obs = { '44132': { temp: [25.3, 0] }, '99999': { temp: [10.0, 1] } };
  const result = layer.render(obs, meta);
  assert.equal(result.total, 1);
  assert.equal(layer.mesh.geometry.drawRange.count, 1);
});
