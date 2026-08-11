const assert = require('node:assert/strict');
const test = require('node:test');

const { ecefToGeo, geoToEcef, WGS84_A } = require('../src/geo');

test('geoToEcef matches the WGS84 equator origin', () => {
  const point = geoToEcef(0, 0);
  assert.ok(Math.abs(point.x - WGS84_A) < 1e-9);
  assert.equal(point.y, 0);
  assert.equal(point.z, 0);
});

test('geoToEcef places the north pole on the z axis', () => {
  const point = geoToEcef(90, 0);
  assert.ok(Math.abs(point.x) < 1e-9);
  assert.ok(Math.abs(point.y) < 1e-9);
  assert.ok(Math.abs(point.z - 6356752.314245179) < 1e-6);
});

test('geoToEcef and ecefToGeo round-trip surface and orbital points', () => {
  for (const [latitude, longitude, height] of [
    [35.681236, 139.767125, 40],
    [-33.8688, 151.2093, 25],
    [51.5074, -0.1278, 408000],
    [0, 180, 24000000],
  ]) {
    const ecef = geoToEcef(latitude, longitude, height);
    const geo = ecefToGeo(ecef.x, ecef.y, ecef.z);
    assert.ok(Math.abs(geo.latitude - latitude) < 1e-9);
    assert.ok(Math.abs(geo.longitude - longitude) < 1e-9);
    assert.ok(Math.abs(geo.height - height) < 1e-3);
  }
});
