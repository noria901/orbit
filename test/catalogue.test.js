const assert = require('node:assert/strict');
const test = require('node:test');

const { classify, parseTLE, buildCategoryIndex, CATEGORIES } = require('../src/catalogue');

test('classify identifies known categories', () => {
  assert.equal(classify('QZS-1R (MICHIBIKI-1)'), 'qzss');
  assert.equal(classify('GPS BIIR-2  (PRN 13)'), 'gps');
  assert.equal(classify('NAVSTAR 32 (USA 79)'), 'gps');
  assert.equal(classify('GLONASS 760'), 'glonass');
  assert.equal(classify('COSMOS 2564'), 'glonass');
  assert.equal(classify('GALILEO 27 (27S)'), 'galileo');
  assert.equal(classify('BEIDOU-3 M17'), 'beidou');
  assert.equal(classify('BDS G3'), 'beidou');
  assert.equal(classify('STARLINK-1234'), 'starlink');
  assert.equal(classify('ONEWEB-0123'), 'oneweb');
  assert.equal(classify('IRIDIUM 33 DEB'), 'iridium');
  assert.equal(classify('NOAA 15'), 'weather');
  assert.equal(classify('GOES 16'), 'weather');
  assert.equal(classify('HIMAWARI 8'), 'weather');
  assert.equal(classify('ISS (ZARYA)'), 'station');
  assert.equal(classify('TIANGONG 2'), 'station');
  assert.equal(classify('CSS (TIANHE)'), 'station');
  assert.equal(classify('UNKNOWN SAT 42'), 'other');
});

test('parseTLE parses 3-line TLE and excludes ISS', () => {
  const tle = [
    'ISS (ZARYA)',
    '1 25544U 98067A   24001.50000000  .00010000  00000-0  18000-3 0  9999',
    '2 25544  51.6400 100.0000 0007000 300.0000  60.0000 15.50000000000009',
    'STARLINK-1234',
    '1 44238U 19029A   24001.50000000  .00000500  00000-0  35000-4 0  9998',
    '2 44238  53.0000 200.0000 0001500 100.0000 260.0000 15.06000000000007',
    'QZS-1R (MICHIBIKI-1)',
    '1 49336U 21087A   24001.50000000  .00000010  00000-0  10000-3 0  9993',
    '2 49336  43.0000  90.0000 0750000 270.0000  80.0000  1.00270000000005',
  ].join('\n');

  const entries = parseTLE(tle);
  assert.equal(entries.length, 2); // ISS excluded
  assert.equal(entries[0].name, 'STARLINK-1234');
  assert.equal(entries[0].category, 'starlink');
  assert.equal(entries[1].name, 'QZS-1R (MICHIBIKI-1)');
  assert.equal(entries[1].category, 'qzss');
});

test('parseTLE handles malformed lines gracefully', () => {
  const tle = [
    'GOOD SAT',
    '1 99999U 24001A   24001.50000000  .00000100  00000-0  10000-3 0  9999',
    '2 99999  51.6000 100.0000 0007000 300.0000  60.0000 15.50000000000009',
    'BAD SAT',
    'not a tle line 1',
    'not a tle line 2',
  ].join('\n');

  const entries = parseTLE(tle);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, 'GOOD SAT');
});

test('buildCategoryIndex groups indices correctly', () => {
  const records = [
    { category: 'starlink' },
    { category: 'gps' },
    { category: 'starlink' },
    { category: 'other' },
  ];
  const idx = buildCategoryIndex(records);
  assert.deepEqual(idx.starlink, [0, 2]);
  assert.deepEqual(idx.gps, [1]);
  assert.deepEqual(idx.other, [3]);
  assert.deepEqual(idx.qzss, []);
});

test('CATEGORIES has expected structure', () => {
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    assert.ok(typeof cat.css === 'string', `${key} has css`);
    assert.ok(typeof cat.size === 'number', `${key} has size`);
    assert.ok(typeof cat.label === 'string', `${key} has label`);
  }
});
