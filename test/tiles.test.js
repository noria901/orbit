const assert = require('node:assert/strict');
const test = require('node:test');
const { gibsTileURL, tileToBBox, tileGridSize, geoToTile, LAYERS } = require('../src/tiles');

test('tileGridSize at level 0', () => {
  const g = tileGridSize(0);
  assert.equal(g.cols, 2);
  assert.equal(g.rows, 1);
});

test('tileGridSize at level 3', () => {
  const g = tileGridSize(3);
  assert.equal(g.cols, 16);
  assert.equal(g.rows, 8);
});

test('tileToBBox level 0 covers full globe', () => {
  // Tile (0,0) = left half
  const b0 = tileToBBox(0, 0, 0);
  assert.deepEqual(b0, [-180, -90, 0, 90]);

  // Tile (1,0) = right half
  const b1 = tileToBBox(0, 1, 0);
  assert.deepEqual(b1, [0, -90, 180, 90]);
});

test('tileToBBox level 1', () => {
  // Level 1: 4 cols × 2 rows, each tile 90°×90°
  const b = tileToBBox(1, 0, 0);
  assert.deepEqual(b, [-180, 0, -90, 90]);
});

test('gibsTileURL for Blue Marble', () => {
  const url = gibsTileURL('blueMarble', 0, 0, 0);
  assert.ok(url.includes('BlueMarble_NextGeneration'));
  assert.ok(url.includes('BBOX=-180,-90,0,90'));
  assert.ok(url.includes('FORMAT=image/jpeg'));
  assert.ok(!url.includes('TIME='));
});

test('gibsTileURL for VIIRS includes TIME', () => {
  const date = new Date('2024-06-15T12:00:00Z');
  const url = gibsTileURL('viirs', 0, 0, 0, date);
  assert.ok(url.includes('VIIRS_SNPP'));
  assert.ok(url.includes('TIME=2024-06-15'));
  assert.ok(url.includes('FORMAT=image/png'));
});

test('gibsTileURL throws for unknown layer', () => {
  assert.throws(() => gibsTileURL('nonexistent', 0, 0, 0), /Unknown GIBS layer/);
});

test('geoToTile at level 0', () => {
  // Tokyo (35.68, 139.69) should be in right tile
  const t = geoToTile(35.68, 139.69, 0);
  assert.equal(t.col, 1);
  assert.equal(t.row, 0);
});

test('geoToTile at level 1', () => {
  // (0, 0) is in col 2, row 1 at level 1 (4 cols × 2 rows)
  const t = geoToTile(0, 0, 1);
  assert.equal(t.col, 2);
  assert.equal(t.row, 1);
});

test('geoToTile clamps out-of-range', () => {
  const t = geoToTile(91, 181, 0);
  assert.equal(t.col, 1);
  assert.equal(t.row, 0);
});
