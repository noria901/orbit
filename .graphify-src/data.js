/**
 * Data fetching layer: quake, amedas, ISS, probe, TLE.
 *
 * Pure fetch + caching logic.  Returns plain objects; rendering is the
 * caller's job.  Zero dependencies on Cesium or Three.js.
 */

'use strict';

const { lsGet, lsSet, TTL, createBackoff, BACKOFF_MAX, ISS_BACKOFF_MAX } = require('./cache');

// ---------- WMO weather code table ----------

const WMO_CODES = {
  0:'快晴',1:'晴れ',2:'一部曇',3:'曇り',45:'霧',48:'霧氷',51:'霧雨',53:'霧雨',55:'霧雨(強)',
  61:'雨(弱)',63:'雨',65:'雨(強)',71:'雪(弱)',73:'雪',75:'雪(強)',80:'にわか雨',81:'にわか雨',
  82:'にわか雨(強)',85:'にわか雪',86:'にわか雪(強)',95:'雷雨',96:'雷雨(雹)',99:'雷雨(強雹)',
};

// ---------- Backoff instances ----------

const backoffs = {
  quake:  createBackoff(TTL.quake,  BACKOFF_MAX),
  amedas: createBackoff(TTL.amedas, BACKOFF_MAX),
  iss:    createBackoff(5000,       ISS_BACKOFF_MAX),
};

// ---------- Earthquake (USGS) ----------

/**
 * Fetch USGS earthquake data.
 * @returns {{ features: Array } | null} GeoJSON, or null on failure
 */
async function fetchQuakes() {
  const res = await fetch(
    'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
  );
  return res.json();
}

/**
 * Parse earthquake features into a flat array of display-ready objects.
 * @param {object} geojson
 * @returns {Array<{lon,lat,depth,mag,place,time}>}
 */
function parseQuakes(geojson) {
  return geojson.features.map(f => {
    const [lon, lat, dep] = f.geometry.coordinates;
    return {
      lon, lat,
      depth: dep ?? 10,
      mag: f.properties.mag || 2.5,
      place: f.properties.place,
      time: f.properties.time,
    };
  });
}

/**
 * Depth → CSS color (same as current app).
 */
function depthColor(depth) {
  if (depth < 70)  return '#FF6B3D';
  if (depth < 300) return '#FFC94D';
  return '#5B8CE8';
}

// ---------- Amedas (JMA) ----------

/**
 * Fetch amedas station metadata (mostly static, cache permanently).
 * @returns {object|null}
 */
async function fetchAmedasMeta() {
  const cached = lsGet('amedasMeta');
  if (cached) return cached;
  const meta = await (await fetch(
    'https://www.jma.go.jp/bosai/amedas/const/amedastable.json',
  )).json();
  lsSet('amedasMeta', meta);
  return meta;
}

/**
 * Fetch latest amedas observation.
 * Returns null if the timestamp hasn't changed since lastStamp.
 * @param {string|null} lastStamp
 * @returns {{ obs, stamp } | null}
 */
async function fetchAmedas(lastStamp) {
  const latest = (await (await fetch(
    'https://www.jma.go.jp/bosai/amedas/data/latest_time.txt',
  )).text()).trim();
  const d = new Date(latest);
  const p = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}00`;

  if (stamp === lastStamp) return null;  // no new data

  const obs = await (await fetch(
    `https://www.jma.go.jp/bosai/amedas/data/map/${stamp}.json`,
  )).json();
  return { obs, stamp };
}

/**
 * Parse amedas observations into display-ready array.
 * @param {object} obs     - raw observation data
 * @param {object} meta    - station metadata
 * @returns {Array<{lat,lon,name,temp,wind,rain,humidity}>}
 */
function parseAmedas(obs, meta) {
  const results = [];
  for (const [id, v] of Object.entries(obs)) {
    const m = meta && meta[id];
    if (!m || !v.temp || v.temp[1] !== 0) continue;

    const t = v.temp[0];
    results.push({
      lat: m.lat[0] + m.lat[1] / 60,
      lon: m.lon[0] + m.lon[1] / 60,
      name: m.kjName || id,
      temp: t,
      wind:  (v.wind && v.wind[1] === 0) ? v.wind[0] : null,
      rain:  (v.precipitation1h && v.precipitation1h[1] === 0) ? v.precipitation1h[0] : null,
      humidity: (v.humidity && v.humidity[1] === 0) ? v.humidity[0] : null,
    });
  }
  return results;
}

/**
 * Temperature → CSS color (same as current app).
 */
function tempColor(t) {
  if (t <= 0)  return '#5B8CE8';
  if (t < 10)  return '#5FD3E8';
  if (t < 20)  return '#5FE0A0';
  if (t < 28)  return '#FFC94D';
  return '#FF6B3D';
}

// ---------- ISS (wheretheiss.at) ----------

/**
 * Fetch ISS position from wheretheiss.at.
 * @returns {{ latitude, longitude, altitude, velocity, footprint, visibility }}
 */
async function fetchISS() {
  return (await fetch('https://api.wheretheiss.at/v1/satellites/25544')).json();
}

// ---------- Point probe (Open-Meteo) ----------

/**
 * Fetch weather + elevation for a coordinate.
 * @param {number} lat
 * @param {number} lon
 * @param {number|undefined} cachedElev - skip elevation fetch if available
 * @returns {{ weather, elevation }}
 */
async function fetchProbe(lat, lon, cachedElev) {
  const [forecast, elevData] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`).then(r => r.json()),
    cachedElev !== undefined
      ? Promise.resolve({ elevation: [cachedElev] })
      : fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`).then(r => r.json()).catch(() => ({})),
  ]);

  const c = forecast.current || {};
  return {
    weather: {
      code: c.weather_code,
      label: WMO_CODES[c.weather_code] ?? '–',
      temperature: c.temperature_2m,
      windSpeed: c.wind_speed_10m,
      humidity: c.relative_humidity_2m,
    },
    elevation: elevData.elevation ? elevData.elevation[0] : null,
  };
}

// ---------- TLE catalogue ----------

/**
 * Fetch TLE catalogue + metadata from same-origin static files.
 * Uses localStorage cache with 3h TTL.
 * @returns {{ text, meta } | null}
 */
async function fetchTLE() {
  const cachedMeta = lsGet('tleMeta');
  const now = Date.now();

  if (cachedMeta && cachedMeta.cachedAt && (now - cachedMeta.cachedAt) < TTL.tle) {
    const cachedText = lsGet('tleText');
    if (cachedText) return { text: cachedText, meta: cachedMeta };
  }

  const [text, meta] = await Promise.all([
    fetch('data/active.tle').then(r => { if (!r.ok) throw new Error('active.tle ' + r.status); return r.text(); }),
    fetch('data/meta.json').then(r => { if (!r.ok) throw new Error('meta.json ' + r.status); return r.json(); }),
  ]);

  const fullMeta = { ...meta, cachedAt: now };
  lsSet('tleText', text);
  lsSet('tleMeta', fullMeta);
  return { text, meta: fullMeta };
}

// ---------- Exports ----------

module.exports = {
  WMO_CODES, backoffs,
  fetchQuakes, parseQuakes, depthColor,
  fetchAmedasMeta, fetchAmedas, parseAmedas, tempColor,
  fetchISS,
  fetchProbe,
  fetchTLE,
};
