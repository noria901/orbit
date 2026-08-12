/**
 * ISS position prediction via great-circle dead reckoning.
 *
 * Between API polls (5s), the ISS position is predicted by propagating
 * the last known fix along the great-circle bearing at the measured
 * velocity.  This produces smooth continuous motion instead of discrete
 * jumps every 5 seconds.
 *
 * Zero rendering dependencies.
 */

'use strict';

const { geoToEcef } = require('./geo');

const ISS_R = 6371 + 408;  // mean orbit radius in km (surface + altitude)

/**
 * Compute forward azimuth (bearing) from (lat1,lon1) to (lat2,lon2).
 * All inputs/output in radians.
 */
function forwardAzimuth(lat1, lon1, lat2, lon2) {
  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  if (Math.hypot(y, x) < 1e-9) return 0;
  return Math.atan2(y, x);
}

/**
 * Create an ISS tracker that predicts position from dead reckoning.
 */
function createISSTracker() {
  let fixTime = null;   // ms timestamp of last API fix
  let fixLat = null;    // degrees
  let fixLon = null;    // degrees
  let fixAlt = null;    // km
  let speedKmh = 0;     // km/h
  let heading = 0;      // radians (forward azimuth)
  let prevLat = null;   // previous fix for heading computation
  let prevLon = null;

  return {
    /** Get current heading in radians */
    get heading() { return heading; },
    get hasPosition() { return fixTime != null; },

    /**
     * Update with a new API measurement.
     * @param {{ latitude, longitude, altitude, velocity, footprint, visibility }} data
     */
    updateFix(data) {
      if (prevLat != null) {
        const newHeading = forwardAzimuth(
          prevLat * Math.PI / 180, prevLon * Math.PI / 180,
          data.latitude * Math.PI / 180, data.longitude * Math.PI / 180,
        );
        heading = newHeading;
      }

      prevLat = data.latitude;
      prevLon = data.longitude;
      fixTime = Date.now();
      fixLat = data.latitude;
      fixLon = data.longitude;
      fixAlt = data.altitude;
      speedKmh = data.velocity;
    },

    /**
     * Predict ISS position at an arbitrary time (ms timestamp).
     * Returns ECEF { x, y, z } in meters, or null if no fix.
     */
    positionAt(dateMs) {
      if (fixTime == null) return null;

      const dtH = (dateMs - fixTime) / 3600000;
      const distKm = speedKmh * dtH;
      const delta = distKm / ISS_R;  // angular distance in radians

      const phi1 = fixLat * Math.PI / 180;
      const lam1 = fixLon * Math.PI / 180;
      const theta = heading;

      const phi2 = Math.asin(
        Math.sin(phi1) * Math.cos(delta) +
        Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
      );
      const lam2 = lam1 + Math.atan2(
        Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
        Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
      );

      return geoToEcef(
        phi2 * 180 / Math.PI,
        lam2 * 180 / Math.PI,
        fixAlt * 1000,  // km → m
      );
    },

    /**
     * Get predicted geodetic coordinates at a time.
     * Returns { latitude, longitude, altitude } in degrees/km, or null.
     */
    geoAt(dateMs) {
      if (fixTime == null) return null;

      const dtH = (dateMs - fixTime) / 3600000;
      const distKm = speedKmh * dtH;
      const delta = distKm / ISS_R;

      const phi1 = fixLat * Math.PI / 180;
      const lam1 = fixLon * Math.PI / 180;
      const theta = heading;

      const phi2 = Math.asin(
        Math.sin(phi1) * Math.cos(delta) +
        Math.cos(phi1) * Math.sin(delta) * Math.cos(theta),
      );
      const lam2 = lam1 + Math.atan2(
        Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
        Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
      );

      return {
        latitude: phi2 * 180 / Math.PI,
        longitude: lam2 * 180 / Math.PI,
        altitude: fixAlt,
      };
    },

    /** Get the last raw API data needed for UI display */
    get fix() {
      if (fixTime == null) return null;
      return { time: fixTime, latitude: fixLat, longitude: fixLon, altitude: fixAlt, velocity: speedKmh };
    },
  };
}

module.exports = { createISSTracker, forwardAzimuth, ISS_R };
