const assert = require('node:assert/strict');
const test = require('node:test');

// Mock localStorage
const store = {};
globalThis.localStorage = {
  getItem(k) { return store[k] ?? null; },
  setItem(k, v) { store[k] = String(v); },
  removeItem(k) { delete store[k]; },
};

const { parseQuakes, depthColor, parseAmedas, tempColor, WMO_CODES } = require('../src/data');

test('parseQuakes extracts features correctly', () => {
  const geojson = {
    features: [
      {
        geometry: { coordinates: [139.77, 35.68, 50] },
        properties: { mag: 4.2, place: 'Near Tokyo', time: 1700000000000 },
      },
      {
        geometry: { coordinates: [-120.5, 37.5, 200] },
        properties: { mag: 3.1, place: 'California', time: 1700000001000 },
      },
    ],
  };

  const quakes = parseQuakes(geojson);
  assert.equal(quakes.length, 2);
  assert.equal(quakes[0].lon, 139.77);
  assert.equal(quakes[0].lat, 35.68);
  assert.equal(quakes[0].depth, 50);
  assert.equal(quakes[0].mag, 4.2);
  assert.equal(quakes[0].place, 'Near Tokyo');
  assert.equal(quakes[1].mag, 3.1);
});

test('parseQuakes handles missing depth/mag', () => {
  const geojson = {
    features: [{
      geometry: { coordinates: [0, 0, null] },
      properties: { mag: null, place: 'Unknown', time: 0 },
    }],
  };
  const q = parseQuakes(geojson);
  assert.equal(q[0].depth, 10);  // fallback
  assert.equal(q[0].mag, 2.5);   // fallback
});

test('depthColor returns correct colors', () => {
  assert.equal(depthColor(30), '#FF6B3D');   // shallow
  assert.equal(depthColor(150), '#FFC94D');  // mid
  assert.equal(depthColor(500), '#5B8CE8');  // deep
});

test('parseAmedas extracts valid stations', () => {
  const meta = {
    '44132': { kjName: '東京', lat: [35, 41.5], lon: [139, 45.0] },
    '44133': { kjName: '横浜', lat: [35, 26.0], lon: [139, 39.0] },
  };
  const obs = {
    '44132': { temp: [25.3, 0], wind: [3.2, 0], precipitation1h: [0, 0], humidity: [65, 0] },
    '44133': { temp: [23.1, 1] },  // quality flag != 0, should be excluded
  };

  const result = parseAmedas(obs, meta);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, '東京');
  assert.equal(result[0].temp, 25.3);
  assert.equal(result[0].wind, 3.2);
  assert.equal(result[0].rain, 0);
  assert.equal(result[0].humidity, 65);
});

test('tempColor returns correct colors for temperature ranges', () => {
  assert.equal(tempColor(-5), '#5B8CE8');
  assert.equal(tempColor(0), '#5B8CE8');
  assert.equal(tempColor(5), '#5FD3E8');
  assert.equal(tempColor(15), '#5FE0A0');
  assert.equal(tempColor(25), '#FFC94D');
  assert.equal(tempColor(35), '#FF6B3D');
});

test('WMO_CODES has expected entries', () => {
  assert.equal(WMO_CODES[0], '快晴');
  assert.equal(WMO_CODES[95], '雷雨');
  assert.ok(Object.keys(WMO_CODES).length >= 19);
});
