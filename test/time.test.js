const assert = require('node:assert/strict');
const test = require('node:test');

const { addSeconds, toISODate, gibsDate } = require('../src/time');

test('addSeconds adds correctly', () => {
  const base = new Date('2024-01-01T00:00:00Z');
  const result = addSeconds(base, 90);
  assert.equal(result.getTime() - base.getTime(), 90000);
});

test('addSeconds handles negative values', () => {
  const base = new Date('2024-01-01T00:01:30Z');
  const result = addSeconds(base, -30);
  assert.equal(result.toISOString(), '2024-01-01T00:01:00.000Z');
});

test('toISODate formats correctly', () => {
  assert.equal(toISODate(new Date('2024-06-15T12:00:00Z')), '2024-06-15');
});

test('gibsDate returns a date 2 days ago', () => {
  const today = new Date();
  const expected = new Date(today.getTime() - 2 * 86400000);
  const result = gibsDate();
  assert.equal(result, expected.toISOString().slice(0, 10));
});
