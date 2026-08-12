/**
 * Satellite catalogue: TLE parsing, category classification, SGP4 bridge.
 *
 * Uses satellite.js for SGP4 propagation but wraps it so the rest of the
 * app doesn't import satellite.js directly.  Zero rendering dependencies.
 */

'use strict';

// ---------- Category classification ----------

const CATEGORIES = {
  qzss:    { re: /^QZS/i,                                    css: '#FFC94D', size: 6, label: 'みちびき' },
  gps:     { re: /^(GPS|NAVSTAR)/i,                           css: '#5FD3E8', size: 3, label: 'GPS' },
  glonass: { re: /^(GLONASS|COSMOS 2)/i,                      css: '#FF8B5E', size: 3, label: 'GLONASS' },
  galileo: { re: /^GALILEO/i,                                 css: '#B98CE0', size: 3, label: 'Galileo' },
  beidou:  { re: /^(BEIDOU|BDS)/i,                            css: '#6BC26B', size: 3, label: '北斗' },
  starlink:{ re: /^STARLINK/i,                                css: '#7FA8E8', size: 2, label: 'Starlink' },
  oneweb:  { re: /^ONEWEB/i,                                  css: '#4FD1B5', size: 2, label: 'OneWeb' },
  iridium: { re: /^IRIDIUM/i,                                 css: '#E0708F', size: 3, label: 'Iridium' },
  weather: { re: /^(NOAA|GOES|HIMAWARI|METEOSAT|METOP|FENGYUN)/i, css: '#E8A23D', size: 4, label: '気象衛星' },
  station: { re: /^(ISS|TIANGONG|CSS)/i,                      css: '#EDEDED', size: 5, label: '宇宙ステーション' },
  other:   { re: null,                                        css: '#5A6B7C', size: 2, label: 'その他' },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);

function classify(name) {
  for (const k of CATEGORY_KEYS) {
    if (CATEGORIES[k].re && CATEGORIES[k].re.test(name)) return k;
  }
  return 'other';
}

// ---------- TLE parsing ----------

/**
 * Parse 3-line TLE text into an array of { name, line1, line2, category }.
 * Excludes ISS (ZARYA) since it has a dedicated real-time entity.
 */
function parseTLE(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const entries = [];

  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    if (line1[0] !== '1' || line2[0] !== '2') continue;
    if (name.indexOf('ISS (ZARYA)') === 0) continue;

    entries.push({
      name,
      line1,
      line2,
      category: classify(name),
    });
  }

  return entries;
}

/**
 * Build SGP4 satellite records from parsed TLE entries.
 * Requires satellite.js to be available (passed as dependency).
 *
 * @param {Array} entries - from parseTLE()
 * @param {object} satelliteLib - the satellite.js module
 * @returns {Array<{name, satrec, category, noradId}>}
 */
function buildSatrecs(entries, satelliteLib) {
  const results = [];
  for (const entry of entries) {
    let satrec;
    try {
      satrec = satelliteLib.twoline2satrec(entry.line1, entry.line2);
    } catch (e) { continue; }
    if (!satrec) continue;

    results.push({
      name: entry.name,
      satrec,
      category: entry.category,
      noradId: satrec.satnum,
    });
  }
  return results;
}

/**
 * Propagate a satrec to a given Date and return ECEF position in meters.
 *
 * @param {object} satrec - from satellite.js
 * @param {Date} date
 * @param {object} satelliteLib - the satellite.js module
 * @returns {{ x, y, z } | null} ECEF position in meters, or null on failure
 */
function propagateToECEF(satrec, date, satelliteLib) {
  try {
    const pv = satelliteLib.propagate(satrec, date);
    if (!pv || !pv.position) return null;
    const gmst = satelliteLib.gstime(date);
    const ecf = satelliteLib.eciToEcf(pv.position, gmst);
    return { x: ecf.x * 1000, y: ecf.y * 1000, z: ecf.z * 1000 };
  } catch (e) { return null; }
}

/**
 * Propagate a satrec and return geodetic coordinates.
 *
 * @returns {{ latitude, longitude, height, velocity } | null}
 *   latitude/longitude in degrees, height in km, velocity in km/s
 */
function propagateToGeo(satrec, date, satelliteLib) {
  try {
    const pv = satelliteLib.propagate(satrec, date);
    if (!pv || !pv.position) return null;
    const gmst = satelliteLib.gstime(date);
    const geo = satelliteLib.eciToGeodetic(pv.position, gmst);
    const velocity = pv.velocity
      ? Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z)
      : 0;
    return {
      latitude: geo.latitude * 180 / Math.PI,
      longitude: geo.longitude * 180 / Math.PI,
      height: geo.height,
      velocity,
      inclination: satrec.inclo * 180 / Math.PI,
    };
  } catch (e) { return null; }
}

/**
 * Group satellite indices by category.
 * @param {Array} records - from buildSatrecs()
 * @returns {Object<string, number[]>}
 */
function buildCategoryIndex(records) {
  const idx = {};
  for (const k of CATEGORY_KEYS) idx[k] = [];
  for (let i = 0; i < records.length; i++) {
    idx[records[i].category].push(i);
  }
  return idx;
}

// ---------- Exports ----------

export {
  CATEGORIES, CATEGORY_KEYS,
  classify, parseTLE, buildSatrecs,
  propagateToECEF, propagateToGeo,
  buildCategoryIndex,
};
