import assert from 'node:assert/strict';
import test from 'node:test';

// Mock localStorage for Node.js
const store = {};
globalThis.localStorage = {
  getItem(k) { return store[k] ?? null; },
  setItem(k, v) { store[k] = String(v); },
  removeItem(k) { delete store[k]; },
};

import {
  lsGet, lsSet, lsDel,
  createBackoff, createTimestampGate, probeKey,
} from '../src/cache.js';

test('lsGet/lsSet round-trip', () => {
  lsSet('test1', { a: 1 });
  const v = lsGet('test1');
  assert.deepEqual(v, { a: 1 });
});

test('lsGet returns null for missing key', () => {
  assert.equal(lsGet('nonexistent'), null);
});

test('lsDel removes key', () => {
  lsSet('test2', 'hello');
  lsDel('test2');
  assert.equal(lsGet('test2'), null);
});

test('createBackoff starts at base, doubles on fail, resets', () => {
  const b = createBackoff(1000, 8000);
  assert.equal(b.interval, 1000);

  b.fail();
  assert.equal(b.interval, 2000);

  b.fail();
  assert.equal(b.interval, 4000);

  b.fail();
  assert.equal(b.interval, 8000);

  b.fail(); // should not exceed max
  assert.equal(b.interval, 8000);

  b.reset();
  assert.equal(b.interval, 1000);
});

test('createTimestampGate gates fetches', () => {
  const b = createBackoff(100, 1000);
  const gate = createTimestampGate('gate_test', b);

  assert.ok(gate.canFetch()); // first time always allowed
  gate.markFetched();
  assert.ok(!gate.canFetch()); // too soon
});

test('probeKey produces consistent keys', () => {
  assert.equal(probeKey(35.681, 139.767), '35.68,139.77');
  assert.equal(probeKey(-33.868, 151.209), '-33.87,151.21');
});
