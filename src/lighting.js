/**
 * Lighting — sun position from date, directional light for day/night.
 *
 * Sun position is computed using a simplified astronomical algorithm
 * (Jean Meeus, "Astronomical Algorithms") accurate to ~1° for dates
 * within a few centuries of J2000. This is more than sufficient for
 * visual day/night rendering.
 *
 * THREE is dependency-injected for testability.
 */

const { WGS84_A } = require('./geo');
const { toRadians } = require('./math');

const AU_METERS = 149597870700; // 1 AU in meters

/**
 * Compute the sun's ECEF direction (unit vector) for a given JS Date.
 *
 * Returns {x, y, z} in ECEF frame. The direction points FROM Earth TO Sun.
 * This uses a simplified solar position model:
 * 1. Compute ecliptic longitude of the sun
 * 2. Convert to equatorial coordinates (RA, Dec)
 * 3. Rotate by Earth's sidereal rotation to get ECEF
 *
 * @param {Date} date
 * @returns {{ x: number, y: number, z: number }}
 */
function sunDirectionECEF(date) {
  const jd = dateToJD(date);
  const T = (jd - 2451545.0) / 36525.0; // Julian centuries from J2000

  // Mean longitude of the sun (degrees)
  const L0 = mod360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);

  // Mean anomaly of the sun (degrees)
  const M = mod360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
  const Mrad = toRadians(M);

  // Equation of center (degrees)
  const C = (1.914602 - 0.004817 * T) * Math.sin(Mrad)
          + 0.019993 * Math.sin(2 * Mrad)
          + 0.000289 * Math.sin(3 * Mrad);

  // Sun's ecliptic longitude (degrees)
  const sunLon = toRadians(mod360(L0 + C));

  // Obliquity of the ecliptic (degrees)
  const obliquity = toRadians(23.439291 - 0.0130042 * T);

  // Equatorial coordinates (RA, Dec)
  const sinLon = Math.sin(sunLon);
  const cosLon = Math.cos(sunLon);
  const cosObl = Math.cos(obliquity);
  const sinObl = Math.sin(obliquity);

  // Right ascension and declination
  const ra = Math.atan2(cosObl * sinLon, cosLon);
  const dec = Math.asin(sinObl * sinLon);

  // Greenwich Mean Sidereal Time (radians)
  const gmst = greenwichMeanSiderealTime(jd);

  // Hour angle → ECEF longitude of subsolar point
  const ecefLon = ra - gmst;

  // Sun direction in ECEF (unit vector)
  const cosDec = Math.cos(dec);
  return {
    x: cosDec * Math.cos(ecefLon),
    y: cosDec * Math.sin(ecefLon),
    z: Math.sin(dec),
  };
}

/**
 * Convert JS Date to Julian Date.
 */
function dateToJD(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

/**
 * Greenwich Mean Sidereal Time in radians.
 */
function greenwichMeanSiderealTime(jd) {
  const T = (jd - 2451545.0) / 36525.0;
  // GMST in degrees
  let gmst = 280.46061837
    + 360.98564736629 * (jd - 2451545.0)
    + 0.000387933 * T * T
    - T * T * T / 38710000;
  gmst = mod360(gmst);
  return toRadians(gmst);
}

/**
 * Reduce angle to [0, 360) range.
 */
function mod360(deg) {
  return ((deg % 360) + 360) % 360;
}

/**
 * Create a directional light representing the sun, plus ambient light.
 *
 * @param {object} THREE
 * @param {object} [opts]
 * @param {number} [opts.sunIntensity] — directional light intensity (default 1.5)
 * @param {number} [opts.ambientIntensity] — ambient fill (default 0.15)
 * @returns {{ sunLight, ambientLight, update(date), dispose() }}
 */
function createLighting(THREE, opts = {}) {
  const sunIntensity = opts.sunIntensity ?? 1.5;
  const ambientIntensity = opts.ambientIntensity ?? 0.15;

  const sunLight = new THREE.DirectionalLight(0xffffff, sunIntensity);
  sunLight.name = 'sunLight';

  const ambientLight = new THREE.AmbientLight(0x404060, ambientIntensity);
  ambientLight.name = 'ambientLight';

  function update(date) {
    const dir = sunDirectionECEF(date);
    // Position the light far along the sun direction
    const dist = WGS84_A * 20;
    sunLight.position.set(dir.x * dist, dir.y * dist, dir.z * dist);
  }

  // Initialize to now
  update(new Date());

  return {
    sunLight,
    ambientLight,
    update,
    dispose() {
      sunLight.dispose();
      ambientLight.dispose();
    },
  };
}

module.exports = {
  sunDirectionECEF,
  dateToJD,
  greenwichMeanSiderealTime,
  mod360,
  createLighting,
};
