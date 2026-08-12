const assert = require('node:assert/strict');
const test = require('node:test');

const { createISSTracker, forwardAzimuth } = require('../src/iss');

const EPSILON = 1e-6;
function near(a, b, eps = EPSILON) { return Math.abs(a - b) < eps; }

test('forwardAzimuth returns correct bearing', () => {
  // Due east along equator: bearing = π/2
  const az = forwardAzimuth(0, 0, 0, Math.PI / 4);
  assert.ok(near(az, Math.PI / 2, 0.01));

  // Due north from equator
  const az2 = forwardAzimuth(0, 0, Math.PI / 4, 0);
  assert.ok(near(az2, 0, 0.01));
});

test('createISSTracker starts with no position', () => {
  const tracker = createISSTracker();
  assert.equal(tracker.hasPosition, false);
  assert.equal(tracker.positionAt(Date.now()), null);
  assert.equal(tracker.geoAt(Date.now()), null);
});

test('createISSTracker.updateFix then positionAt returns ECEF', () => {
  const tracker = createISSTracker();

  tracker.updateFix({
    latitude: 35.68,
    longitude: 139.77,
    altitude: 408,
    velocity: 27600,
  });

  assert.equal(tracker.hasPosition, true);

  const pos = tracker.positionAt(Date.now());
  assert.ok(pos !== null);
  assert.ok(typeof pos.x === 'number');
  assert.ok(typeof pos.y === 'number');
  assert.ok(typeof pos.z === 'number');

  // Should be at roughly ISS orbit altitude (~6779 km from center)
  const r = Math.sqrt(pos.x ** 2 + pos.y ** 2 + pos.z ** 2) / 1000; // km
  assert.ok(r > 6700 && r < 6900, `radius ${r} km should be in ISS orbit range`);
});

test('createISSTracker predicts movement in the future', () => {
  const tracker = createISSTracker();

  tracker.updateFix({
    latitude: 0,
    longitude: 0,
    altitude: 408,
    velocity: 27600,
  });

  // Need a second fix to establish heading
  tracker.updateFix({
    latitude: 0,
    longitude: 1,  // moved east
    altitude: 408,
    velocity: 27600,
  });

  const now = Date.now();
  const geo0 = tracker.geoAt(now);
  const geo1 = tracker.geoAt(now + 60000); // 1 minute later

  assert.ok(geo0 !== null && geo1 !== null);

  // ISS at ~27600 km/h should move significantly in 1 minute
  const dLon = Math.abs(geo1.longitude - geo0.longitude);
  assert.ok(dLon > 0.01, `ISS should have moved (dLon = ${dLon})`);
});

test('createISSTracker heading updates from successive fixes', () => {
  const tracker = createISSTracker();

  tracker.updateFix({ latitude: 0, longitude: 0, altitude: 408, velocity: 27600 });
  assert.ok(near(tracker.heading, 0)); // no previous fix, heading stays 0

  tracker.updateFix({ latitude: 1, longitude: 0, altitude: 408, velocity: 27600 });
  // Moved north: heading should be ~0
  assert.ok(near(tracker.heading, 0, 0.05));

  tracker.updateFix({ latitude: 1, longitude: 1, altitude: 408, velocity: 27600 });
  // Moved east: heading should be ~π/2
  assert.ok(tracker.heading > 0.5 && tracker.heading < 2.0, `heading ${tracker.heading} should be eastward`);
});

test('createISSTracker.fix returns last raw data', () => {
  const tracker = createISSTracker();
  assert.equal(tracker.fix, null);

  tracker.updateFix({ latitude: 10, longitude: 20, altitude: 400, velocity: 27000 });
  const f = tracker.fix;
  assert.ok(f !== null);
  assert.equal(f.latitude, 10);
  assert.equal(f.longitude, 20);
  assert.equal(f.altitude, 400);
  assert.equal(f.velocity, 27000);
});
