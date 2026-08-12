/**
 * Sun direction (simplified Meeus algorithm) + day/night lighting.
 *
 * sunDirectionECEF is pure logic (testable without a browser/Three.js).
 * createLighting/updateSunLight are the Three.js-dependent wiring.
 */

'use strict';

function mod360(d) { return ((d % 360) + 360) % 360; }

/**
 * Compute the unit ECEF vector pointing from Earth's center toward the Sun,
 * for a given JS Date. Simplified Meeus solar position + GMST rotation.
 *
 * @param {Date} date
 * @returns {{x:number, y:number, z:number}} unit vector
 */
function sunDirectionECEF(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525.0;
  const L0 = mod360(280.46646 + 36000.76983 * T);
  const M = mod360(357.52911 + 35999.05029 * T);
  const Mr = M * Math.PI / 180;
  const C = (1.914602 - 0.004817 * T) * Math.sin(Mr) + 0.019993 * Math.sin(2 * Mr);
  const sunLon = mod360(L0 + C) * Math.PI / 180;
  const obl = (23.439291 - 0.0130042 * T) * Math.PI / 180;
  const sL = Math.sin(sunLon), cL = Math.cos(sunLon);
  const ra = Math.atan2(Math.cos(obl) * sL, cL);
  const dec = Math.asin(Math.sin(obl) * sL);
  let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0);
  gmst = mod360(gmst) * Math.PI / 180;
  const ecefLon = ra - gmst;
  const cDec = Math.cos(dec);
  return { x: cDec * Math.cos(ecefLon), y: cDec * Math.sin(ecefLon), z: Math.sin(dec) };
}

/**
 * Create the sun (directional) + ambient lights.
 * @param {object} THREE
 * @returns {{ sunLight: THREE.DirectionalLight, ambientLight: THREE.AmbientLight }}
 */
function createLighting(THREE) {
  const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
  sunLight.name = 'sunLight';
  const ambientLight = new THREE.AmbientLight(0x404060, 0.4);
  return { sunLight, ambientLight };
}

/**
 * Position the sun light along today's real sun direction, far enough away
 * to behave as a directional (parallel-ray) light.
 * @param {object} THREE
 * @param {THREE.DirectionalLight} sunLight
 * @param {number} equatorialRadius - WGS84_A, used to scale the distance
 * @param {Date} [date]
 */
function updateSunLight(THREE, sunLight, equatorialRadius, date = new Date()) {
  const dir = sunDirectionECEF(date);
  const dist = equatorialRadius * 20;
  sunLight.position.set(dir.x * dist, dir.y * dist, dir.z * dist);
}

export { sunDirectionECEF, createLighting, updateSunLight };
