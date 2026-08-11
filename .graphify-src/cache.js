/**
 * localStorage cache + exponential backoff infrastructure.
 *
 * Zero rendering dependencies.  Extracted from index.html's cache/backoff
 * system so the same logic works with any 3D engine.
 */

'use strict';

const LS_PREFIX = 'orbit:';

// ---------- localStorage wrappers ----------

function lsGet(key) {
  try {
    const v = localStorage.getItem(LS_PREFIX + key);
    return v != null ? JSON.parse(v) : null;
  } catch (e) { return null; }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
    return true;
  } catch (e) { return false; }
}

function lsDel(key) {
  try { localStorage.removeItem(LS_PREFIX + key); } catch (e) { /* noop */ }
}

// ---------- TTL constants ----------

const TTL = Object.freeze({
  amedas: 4 * 60 * 1000,    // 4 min
  quake:  4 * 60 * 1000,    // 4 min
  probe: 10 * 60 * 1000,    // 10 min
  tle:    3 * 60 * 60 * 1000, // 3 hours (Actions fetch interval)
});

const BACKOFF_MAX     = 10 * 60 * 1000;  // 10 min
const ISS_BACKOFF_MAX =      60 * 1000;  // 60 sec

// ---------- Backoff tracker ----------

/**
 * Manages exponential backoff for a data source.
 * @param {number} baseInterval - normal polling interval in ms
 * @param {number} maxInterval  - maximum backoff in ms
 */
function createBackoff(baseInterval, maxInterval) {
  let interval = baseInterval;
  return {
    get interval() { return interval; },
    reset()  { interval = baseInterval; },
    fail()   { interval = Math.min(interval * 2, maxInterval); },
  };
}

// ---------- Timestamp gate ----------

/**
 * Gate that prevents fetching more often than the backoff interval.
 * Returns true if enough time has elapsed.
 * @param {string} lsKey     - localStorage key to store last-fetch timestamp
 * @param {object} backoff   - backoff tracker (from createBackoff)
 */
function createTimestampGate(lsKey, backoff) {
  let lastAt = lsGet(lsKey) || 0;
  return {
    get lastAt() { return lastAt; },
    canFetch() {
      return Date.now() - lastAt >= backoff.interval;
    },
    markFetched() {
      lastAt = Date.now();
      lsSet(lsKey, lastAt);
    },
  };
}

// ---------- Probe cache (coordinate-keyed) ----------

function probeKey(lat, lon) {
  return lat.toFixed(2) + ',' + lon.toFixed(2);
}

function createProbeCache() {
  const mem = new Map();

  return {
    get(lat, lon) {
      const key = probeKey(lat, lon);
      let hit = mem.get(key);
      if (!hit) {
        const ls = lsGet('probe:' + key);
        if (ls) { hit = ls; mem.set(key, ls); }
      }
      if (hit && Date.now() - hit.at < TTL.probe) return hit;
      return null;
    },
    set(lat, lon, html) {
      const key = probeKey(lat, lon);
      const entry = { at: Date.now(), html };
      mem.set(key, entry);
      lsSet('probe:' + key, entry);
    },
  };
}

// ---------- Elevation cache (permanent) ----------

function createElevationCache() {
  const mem = new Map();
  return {
    get(lat, lon) {
      const key = probeKey(lat, lon);
      let v = mem.get(key);
      if (v === undefined) { v = lsGet('elev:' + key) ?? undefined; }
      return v;
    },
    set(lat, lon, elevation) {
      const key = probeKey(lat, lon);
      mem.set(key, elevation);
      lsSet('elev:' + key, elevation);
    },
  };
}

// ---------- Exports ----------

module.exports = {
  LS_PREFIX,
  lsGet, lsSet, lsDel,
  TTL, BACKOFF_MAX, ISS_BACKOFF_MAX,
  createBackoff, createTimestampGate,
  probeKey, createProbeCache, createElevationCache,
};
