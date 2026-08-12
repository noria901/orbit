import assert from 'node:assert/strict';
import test from 'node:test';

import { sunDirectionECEF } from '../src/lighting.js';

test('sunDirectionECEF returns a unit vector', () => {
  const d = sunDirectionECEF(new Date('2026-08-12T12:00:00Z'));
  const mag = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
  assert.ok(Math.abs(mag - 1) < 1e-9, `expected unit vector, got magnitude ${mag}`);
});

test('sunDirectionECEF declination stays within +-23.5deg (obliquity bound)', () => {
  // Sample across a year; z-component = sin(declination), so it must stay
  // within sin(+-23.44deg) regardless of date.
  const maxSinDec = Math.sin(23.5 * Math.PI / 180);
  for (let m = 0; m < 12; m++) {
    const d = sunDirectionECEF(new Date(Date.UTC(2026, m, 15)));
    assert.ok(Math.abs(d.z) <= maxSinDec + 1e-6, `month ${m}: z=${d.z} exceeds obliquity bound`);
  }
});

test('sunDirectionECEF is roughly opposite at 6-month offset', () => {
  // Not exactly opposite (orbit isn't a perfect circle / dates aren't
  // exactly symmetric around solstices), but should be in the same
  // hemisphere-flip ballpark for declination sign near solstices.
  const june = sunDirectionECEF(new Date('2026-06-21T00:00:00Z'));
  const december = sunDirectionECEF(new Date('2026-12-21T00:00:00Z'));
  assert.ok(june.z > 0.3, `expected positive (northern summer) declination, got ${june.z}`);
  assert.ok(december.z < -0.3, `expected negative (southern summer) declination, got ${december.z}`);
});
