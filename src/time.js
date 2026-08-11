/**
 * Time utilities — replaces Cesium.JulianDate and clock helpers.
 *
 * The current app uses:
 *   - Cesium.JulianDate.now()          → Date.now() / new Date()
 *   - Cesium.JulianDate.toDate(jd)     → already a Date
 *   - Cesium.JulianDate.addSeconds()   → simple Date arithmetic
 *   - viewer.clock.currentTime         → managed by animation loop
 *   - viewer.clock.shouldAnimate       → boolean flag
 *
 * This module provides a lightweight clock that ticks via requestAnimationFrame
 * and fires callbacks, replacing Cesium's clock.onTick system.
 */

'use strict';

/**
 * Create a simple animation clock.
 * Fires tick callbacks with { time: Date, deltaMs: number } each frame.
 */
function createClock() {
  let running = false;
  let lastTime = 0;
  let rafId = null;
  const listeners = new Set();

  function tick(now) {
    if (!running) return;
    const deltaMs = lastTime ? now - lastTime : 0;
    lastTime = now;
    const time = new Date();
    for (const fn of listeners) {
      fn({ time, deltaMs, now });
    }
    rafId = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = 0;
      rafId = requestAnimationFrame(tick);
    },

    stop() {
      running = false;
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null; }
    },

    get running() { return running; },

    /** Register a per-frame callback */
    onTick(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** Remove a callback */
    offTick(fn) { listeners.delete(fn); },
  };
}

/**
 * Add seconds to a Date and return a new Date.
 * Replaces Cesium.JulianDate.addSeconds.
 */
function addSeconds(date, seconds) {
  return new Date(date.getTime() + seconds * 1000);
}

/**
 * Format time as JST HH:MM:SS.
 */
function formatJST(date) {
  return date.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour12: false,
  });
}

/**
 * Format time as JST HH:MM.
 */
function formatJSTShort(date) {
  return date.toLocaleTimeString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format a Date as ISO date string (YYYY-MM-DD).
 */
function toISODate(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Get the GIBS imagery date (2 days ago).
 */
function gibsDate() {
  return toISODate(new Date(Date.now() - 2 * 86400000));
}

module.exports = {
  createClock, addSeconds,
  formatJST, formatJSTShort, toISODate, gibsDate,
};
