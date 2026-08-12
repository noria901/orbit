/**
 * WGS84 geographic/ECEF coordinate conversions.
 *
 * Geographic coordinates use degrees and meters at the public boundary.
 * ECEF coordinates use meters in an Earth-fixed right-handed frame:
 *   x: 0°E on the equator
 *   y: 90°E on the equator
 *   z: North pole
 */

const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);

function geoToEcef(latitudeDeg, longitudeDeg, heightM = 0, result = {}) {
  const latitude = latitudeDeg * Math.PI / 180;
  const longitude = longitudeDeg * Math.PI / 180;
  const sinLatitude = Math.sin(latitude);
  const cosLatitude = Math.cos(latitude);
  const primeVerticalRadius = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLatitude ** 2);

  result.x = (primeVerticalRadius + heightM) * cosLatitude * Math.cos(longitude);
  result.y = (primeVerticalRadius + heightM) * cosLatitude * Math.sin(longitude);
  result.z = (primeVerticalRadius * (1 - WGS84_E2) + heightM) * sinLatitude;
  return result;
}

/**
 * Convert an ECEF point to geodetic WGS84 coordinates.
 * Bowring's initial estimate followed by a short iteration is stable for
 * the Earth surface and the satellite altitudes used by ORBIT.
 */
function ecefToGeo(x, y, z, result = {}) {
  const longitude = Math.atan2(y, x);
  const horizontalRadius = Math.hypot(x, y);
  const pole = horizontalRadius < Number.EPSILON;

  if (pole) {
    result.latitude = z < 0 ? -90 : 90;
    result.longitude = 0;
    result.height = Math.abs(z) - WGS84_A * (1 - WGS84_F);
    return result;
  }

  let latitude = Math.atan2(z, horizontalRadius * (1 - WGS84_E2));
  for (let i = 0; i < 8; i += 1) {
    const sinLatitude = Math.sin(latitude);
    const primeVerticalRadius = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLatitude ** 2);
    const height = horizontalRadius / Math.cos(latitude) - primeVerticalRadius;
    const nextLatitude = Math.atan2(
      z,
      horizontalRadius * (1 - WGS84_E2 * primeVerticalRadius / (primeVerticalRadius + height)),
    );
    if (Math.abs(nextLatitude - latitude) < 1e-12) {
      latitude = nextLatitude;
      break;
    }
    latitude = nextLatitude;
  }

  const sinLatitude = Math.sin(latitude);
  const primeVerticalRadius = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLatitude ** 2);
  result.latitude = latitude * 180 / Math.PI;
  result.longitude = longitude * 180 / Math.PI;
  result.height = horizontalRadius / Math.cos(latitude) - primeVerticalRadius;
  return result;
}

export {
  WGS84_A,
  WGS84_F,
  WGS84_E2,
  geoToEcef,
  ecefToGeo,
};
