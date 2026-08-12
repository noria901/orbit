import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ==========================================================
   ORBIT — Three.js backend
   ========================================================== */

// ---- WGS84 geo ----
const WGS84_A = 6378137;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = WGS84_F * (2 - WGS84_F);
const WGS84_B = WGS84_A * (1 - WGS84_F);

function geoToEcef(latDeg, lonDeg, h = 0, out = {}) {
  const lat = latDeg * Math.PI / 180, lon = lonDeg * Math.PI / 180;
  const sLat = Math.sin(lat), cLat = Math.cos(lat);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sLat * sLat);
  out.x = (N + h) * cLat * Math.cos(lon);
  out.y = (N + h) * cLat * Math.sin(lon);
  out.z = (N * (1 - WGS84_E2) + h) * sLat;
  return out;
}

function ecefToGeo(x, y, z) {
  const lon = Math.atan2(y, x);
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - WGS84_E2));
  for (let i = 0; i < 8; i++) {
    const sLat = Math.sin(lat);
    const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sLat * sLat);
    const h = p / Math.cos(lat) - N;
    lat = Math.atan2(z, p * (1 - WGS84_E2 * N / (N + h)));
  }
  const sLat = Math.sin(lat);
  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sLat * sLat);
  return {
    latitude: lat * 180 / Math.PI,
    longitude: lon * 180 / Math.PI,
    height: p / Math.cos(lat) - N
  };
}

// ---- Sun position (simplified Meeus) ----
function sunDirectionECEF(date) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const T = (jd - 2451545.0) / 36525.0;
  const mod360 = d => ((d % 360) + 360) % 360;
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

// ---- Colour utils ----
function hexToRGB(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: ((n >> 16) & 0xff) / 255, g: ((n >> 8) & 0xff) / 255, b: (n & 0xff) / 255 };
}
const depthColor = d => d < 70 ? '#FF6B3D' : d < 300 ? '#FFC94D' : '#5B8CE8';
const tempColor = t => t <= 0 ? '#5B8CE8' : t < 10 ? '#5FD3E8' : t < 20 ? '#5FE0A0' : t < 28 ? '#FFC94D' : '#FF6B3D';

// ---- ISS dead reckoning ----
const ISS_R = 6371 + 408;
let issFixTime = null, issFixLat = null, issFixLon = null, issFixAlt = null;
let issSpeedKmh = 0, issHeading = 0, issPrevLat = null, issPrevLon = null;
let issMeta = null;

function issPositionECEF(dateMs, out = {}) {
  if (issFixTime == null) return null;
  const dtH = (dateMs - issFixTime) / 3600000;
  const distKm = issSpeedKmh * dtH;
  const d = distKm / ISS_R;
  const p1 = issFixLat * Math.PI / 180, l1 = issFixLon * Math.PI / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(issHeading));
  const l2 = l1 + Math.atan2(Math.sin(issHeading) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return geoToEcef(p2 * 180 / Math.PI, l2 * 180 / Math.PI, issFixAlt * 1000, out);
}

function issGeoAt(dateMs) {
  if (issFixTime == null) return null;
  const dtH = (dateMs - issFixTime) / 3600000;
  const distKm = issSpeedKmh * dtH;
  const d = distKm / ISS_R;
  const p1 = issFixLat * Math.PI / 180, l1 = issFixLon * Math.PI / 180;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(issHeading));
  const l2 = l1 + Math.atan2(Math.sin(issHeading) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return { latitude: p2 * 180 / Math.PI, longitude: l2 * 180 / Math.PI, altitude: issFixAlt };
}

// ---- Category classification ----
const CAT = {
  qzss:    { re:/^QZS/i,                                    css:'#FFC94D', size:6, label:'みちびき' },
  gps:     { re:/^(GPS|NAVSTAR)/i,                           css:'#5FD3E8', size:3, label:'GPS' },
  glonass: { re:/^(GLONASS|COSMOS 2)/i,                      css:'#FF8B5E', size:3, label:'GLONASS' },
  galileo: { re:/^GALILEO/i,                                 css:'#B98CE0', size:3, label:'Galileo' },
  beidou:  { re:/^(BEIDOU|BDS)/i,                            css:'#6BC26B', size:3, label:'北斗' },
  starlink:{ re:/^STARLINK/i,                                css:'#7FA8E8', size:2, label:'Starlink' },
  oneweb:  { re:/^ONEWEB/i,                                  css:'#4FD1B5', size:2, label:'OneWeb' },
  iridium: { re:/^IRIDIUM/i,                                 css:'#E0708F', size:3, label:'Iridium' },
  weather: { re:/^(NOAA|GOES|HIMAWARI|METEOSAT|METOP|FENGYUN)/i, css:'#E8A23D', size:4, label:'気象衛星' },
  station: { re:/^(ISS|TIANGONG|CSS)/i,                      css:'#EDEDED', size:5, label:'宇宙ステーション' },
  other:   { re:null,                                        css:'#5A6B7C', size:2, label:'その他' }
};
function classify(name) {
  for (const k of Object.keys(CAT)) if (CAT[k].re && CAT[k].re.test(name)) return k;
  return 'other';
}

// ---- Cache / backoff ----
const LS_PREFIX = 'orbit:';
function lsGet(k) { try { const v = localStorage.getItem(LS_PREFIX + k); return v != null ? JSON.parse(v) : null; } catch { return null; } }
function lsSet(k, v) { try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); return true; } catch { return false; } }
const TTL = { amedas: 240000, quake: 240000, probe: 600000, tle: 10800000 };
const backoff = { amedas: TTL.amedas, quake: TTL.quake, iss: 5000 };
const BACKOFF_MAX = 600000, ISS_BACKOFF_MAX = 60000;
const cache = {
  amedasStamp: lsGet('amedasStamp'), amedasAt: lsGet('amedasAt') || 0,
  quakeAt: lsGet('quakeAt') || 0, probe: new Map(), elev: new Map()
};
let tabVisible = !document.hidden;
document.addEventListener('visibilitychange', () => {
  tabVisible = !document.hidden;
  if (tabVisible) { pollISS(); observeAll(); }
});
function probeKey(lat, lon) { return lat.toFixed(2) + ',' + lon.toFixed(2); }
const WMO = {0:'快晴',1:'晴れ',2:'一部曇',3:'曇り',45:'霧',48:'霧氷',51:'霧雨',53:'霧雨',55:'霧雨(強)',
  61:'雨(弱)',63:'雨',65:'雨(強)',71:'雪(弱)',73:'雪',75:'雪(強)',80:'にわか雨',81:'にわか雨',
  82:'にわか雨(強)',85:'にわか雪',86:'にわか雪(強)',95:'雷雨',96:'雷雨(雹)',99:'雷雨(強雹)'};

// ==============================================================
// Three.js scene
// ==============================================================
const container = document.getElementById('globe');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070C);

const cam = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 100, 1e9);
cam.position.set(0, 0, 34000000);
cam.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  cam.aspect = innerWidth / innerHeight;
  cam.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---- Earth ellipsoid ----
const earthGeom = new THREE.SphereGeometry(1, 64, 64);
{
  const pos = earthGeom.getAttribute('position');
  for (let i = 0; i < pos.count; i++)
    pos.setXYZ(i, pos.getX(i) * WGS84_A, pos.getY(i) * WGS84_A, pos.getZ(i) * WGS84_B);
  pos.needsUpdate = true;
  earthGeom.computeVertexNormals();
}
const earthMat = new THREE.MeshPhongMaterial({ color: 0x1a3a5c, shininess: 15 });
const earth = new THREE.Mesh(earthGeom, earthMat);
earth.name = 'earth';
scene.add(earth);

// Load base texture
{
  const loader = new THREE.TextureLoader();
  loader.load('https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png', tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    earthMat.map = tex;
    earthMat.color.set(0xffffff);
    earthMat.needsUpdate = true;
    // Remove boot overlay once texture loads
    const b = document.getElementById('boot');
    if (b) { b.style.opacity = 0; setTimeout(() => b.remove(), 1200); }
  });
}

// ---- Atmosphere glow ----
const atmoGeom = new THREE.SphereGeometry(WGS84_A * 1.025, 64, 64);
const atmoMat = new THREE.ShaderMaterial({
  uniforms: {
    glowColor: { value: new THREE.Vector3(0.3, 0.6, 1.0) },
    intensity: { value: 0.7 },
    power: { value: 3.5 }
  },
  vertexShader: `
    varying vec3 vNormal; varying vec3 vPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position,1.0)).xyz;
      gl_Position = projectionMatrix * vec4(vPosition,1.0);
    }`,
  fragmentShader: `
    uniform vec3 glowColor; uniform float intensity; uniform float power;
    varying vec3 vNormal; varying vec3 vPosition;
    void main() {
      vec3 viewDir = normalize(-vPosition);
      float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
      float glow = pow(rim, power) * intensity;
      gl_FragColor = vec4(glowColor, glow);
    }`,
  side: THREE.BackSide, transparent: true, depthWrite: false
});
scene.add(new THREE.Mesh(atmoGeom, atmoMat));

// ---- Sun light ----
const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
sunLight.name = 'sunLight';
const ambientLight = new THREE.AmbientLight(0x404060, 0.15);
scene.add(sunLight);
scene.add(ambientLight);

function updateSunLight() {
  const dir = sunDirectionECEF(new Date());
  const dist = WGS84_A * 20;
  sunLight.position.set(dir.x * dist, dir.y * dist, dir.z * dist);
}
updateSunLight();

// ---- Orbit controls (spherical) ----
let ctrlDist = 34000000, ctrlTheta = 0, ctrlPhi = Math.PI / 2;
let vTheta = 0, vPhi = 0, dragging = false;
const MIN_DIST = WGS84_A * 1.02, MAX_DIST = WGS84_A * 10;
const ROT_SPEED = 0.003, ZOOM_SPEED = 0.1, INERTIA = 0.92;

function clampPhi(p) { return Math.max(0.01, Math.min(Math.PI - 0.01, p)); }
function sphericalToXYZ(r, t, p) {
  const sp = Math.sin(p);
  return { x: r * sp * Math.cos(t), y: r * sp * Math.sin(t), z: r * Math.cos(p) };
}

let pointerDown = false, lastPX = 0, lastPY = 0, idle = true;
const canvas = renderer.domElement;

canvas.addEventListener('pointerdown', e => {
  pointerDown = true; dragging = true;
  lastPX = e.clientX; lastPY = e.clientY;
  idle = false; fadeHint();
});
window.addEventListener('pointermove', e => {
  if (!pointerDown) return;
  const dx = e.clientX - lastPX, dy = e.clientY - lastPY;
  lastPX = e.clientX; lastPY = e.clientY;
  ctrlTheta -= dx * ROT_SPEED;
  ctrlPhi = clampPhi(ctrlPhi - dy * ROT_SPEED);
  vTheta = -dx * ROT_SPEED; vPhi = -dy * ROT_SPEED;
});
window.addEventListener('pointerup', () => { pointerDown = false; dragging = false; });
canvas.addEventListener('wheel', e => {
  e.preventDefault(); idle = false; fadeHint();
  const factor = 1 - Math.sign(e.deltaY) * ZOOM_SPEED;
  ctrlDist = Math.max(MIN_DIST, Math.min(MAX_DIST, ctrlDist * factor));
}, { passive: false });

// ---- flyTo + tracking ----
let flyFrom = null, flyTo_ = null, flyStart = null, flyDur = 2400, flyOnEnd = null;
let trackGetPos = null, trackLastPos = null;

function flyTo(targetECEF, opts = {}) {
  const alt = opts.altitude ?? 2000000;
  const r = Math.sqrt(targetECEF.x ** 2 + targetECEF.y ** 2 + targetECEF.z ** 2);
  const scale = r > 1 ? (r + alt) / r : 1;
  const dest = { x: targetECEF.x * scale, y: targetECEF.y * scale, z: targetECEF.z * scale };
  flyFrom = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
  flyTo_ = dest;
  flyDur = opts.duration ?? 2400;
  flyStart = null;
  flyOnEnd = opts.onEnd ?? null;
}

function slerp(from, to, t, out) {
  const r0 = Math.sqrt(from.x ** 2 + from.y ** 2 + from.z ** 2);
  const r1 = Math.sqrt(to.x ** 2 + to.y ** 2 + to.z ** 2);
  const fx = from.x / r0, fy = from.y / r0, fz = from.z / r0;
  const tx = to.x / r1, ty = to.y / r1, tz = to.z / r1;
  let dot = Math.max(-1, Math.min(1, fx * tx + fy * ty + fz * tz));
  const angle = Math.acos(dot);
  const r = r0 + (r1 - r0) * t;
  if (Math.abs(angle) < 1e-6) {
    out.x = from.x + (to.x - from.x) * t;
    out.y = from.y + (to.y - from.y) * t;
    out.z = from.z + (to.z - from.z) * t;
    return out;
  }
  const sinA = Math.sin(angle);
  const s0 = Math.sin((1 - t) * angle) / sinA;
  const s1 = Math.sin(t * angle) / sinA;
  out.x = (fx * s0 + tx * s1) * r; out.y = (fy * s0 + ty * s1) * r; out.z = (fz * s0 + tz * s1) * r;
  return out;
}

function startTracking(fn) { trackGetPos = fn; trackLastPos = null; }
function stopTracking() { trackGetPos = null; trackLastPos = null; }

// ---- Point cloud helper ----
function createPointCloud(maxPts, defaultSize = 4, sizeAttn = false) {
  const positions = new Float32Array(maxPts * 3);
  const colors = new Float32Array(maxPts * 3);
  const sizes = new Float32Array(maxPts);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.setDrawRange(0, 0);
  const mat = new THREE.PointsMaterial({ vertexColors: true, size: defaultSize, sizeAttenuation: sizeAttn, depthWrite: false, transparent: true });
  const mesh = new THREE.Points(geom, mat);
  mesh.frustumCulled = false;
  return { mesh, geom, positions, colors, sizes, maxPts };
}

// ---- Data layers ----
// Quakes
const quakeCloud = createPointCloud(500, 5, true);
quakeCloud.mesh.name = 'quakes';
scene.add(quakeCloud.mesh);
let quakeItems = [];

function renderQuakes(gj) {
  quakeItems = gj.features.map(f => {
    const [lon, lat, dep] = f.geometry.coordinates;
    return { lon, lat, depth: dep ?? 10, mag: f.properties.mag || 2.5, place: f.properties.place, time: f.properties.time };
  });
  const q = quakeCloud, ecef = {};
  const count = Math.min(quakeItems.length, q.maxPts);
  for (let i = 0; i < count; i++) {
    const item = quakeItems[i];
    geoToEcef(item.lat, item.lon, 0, ecef);
    q.positions[i * 3] = ecef.x; q.positions[i * 3 + 1] = ecef.y; q.positions[i * 3 + 2] = ecef.z;
    const c = hexToRGB(depthColor(item.depth));
    q.colors[i * 3] = c.r; q.colors[i * 3 + 1] = c.g; q.colors[i * 3 + 2] = c.b;
  }
  q.geom.getAttribute('position').needsUpdate = true;
  q.geom.getAttribute('color').needsUpdate = true;
  q.geom.setDrawRange(0, count);
  document.getElementById('c-quake').textContent = quakeItems.length;
  document.getElementById('t-q').textContent = quakeItems.length + '件';
}

// Amedas
const amedasCloud = createPointCloud(2000, 3, true);
amedasCloud.mesh.name = 'amedas';
scene.add(amedasCloud.mesh);
let amedasMeta = null, amedasItems = [];

function renderAmedas(obs, stamp) {
  if (!amedasMeta) return;
  amedasItems = [];
  const ecef = {};
  let n = 0;
  for (const [id, v] of Object.entries(obs)) {
    const meta = amedasMeta[id];
    if (!meta || !v.temp || v.temp[1] !== 0) continue;
    const t = v.temp[0];
    const lat = meta.lat[0] + meta.lat[1] / 60, lon = meta.lon[0] + meta.lon[1] / 60;
    amedasItems.push({ lat, lon, name: meta.kjName || id, temp: t,
      wind: (v.wind && v.wind[1] === 0) ? v.wind[0] : null,
      rain: (v.precipitation1h && v.precipitation1h[1] === 0) ? v.precipitation1h[0] : null,
      hum: (v.humidity && v.humidity[1] === 0) ? v.humidity[0] : null });
    if (n >= amedasCloud.maxPts) continue;
    geoToEcef(lat, lon, 0, ecef);
    amedasCloud.positions[n * 3] = ecef.x; amedasCloud.positions[n * 3 + 1] = ecef.y; amedasCloud.positions[n * 3 + 2] = ecef.z;
    const c = hexToRGB(tempColor(t));
    amedasCloud.colors[n * 3] = c.r; amedasCloud.colors[n * 3 + 1] = c.g; amedasCloud.colors[n * 3 + 2] = c.b;
    n++;
  }
  amedasCloud.geom.getAttribute('position').needsUpdate = true;
  amedasCloud.geom.getAttribute('color').needsUpdate = true;
  amedasCloud.geom.setDrawRange(0, n);
  document.getElementById('c-amedas').textContent = n;
  const d = new Date(+stamp.slice(0, 4), +stamp.slice(4, 6) - 1, +stamp.slice(6, 8), +stamp.slice(8, 10), +stamp.slice(10, 12));
  document.getElementById('t-a').textContent = d.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false });
}

// Satellite catalogue
const satCloud = createPointCloud(10000, 2, false);
satCloud.mesh.name = 'satellites';
scene.add(satCloud.mesh);

const catalogue = { satrecs: [], names: [], cats: [], catIndex: {}, meta: null };

// ISS layer
const issGroup = new THREE.Group(); issGroup.name = 'iss';
const issDotGeom = new THREE.BufferGeometry();
issDotGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
const issDot = new THREE.Points(issDotGeom, new THREE.PointsMaterial({ color: 0x00ffcc, size: 8, sizeAttenuation: false, depthWrite: false }));
issGroup.add(issDot);
const issLineGeom = new THREE.BufferGeometry();
issLineGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
const issLine = new THREE.Line(issLineGeom, new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.4 }));
issGroup.add(issLine);
scene.add(issGroup);

let issECEF = {}, issGroundECEF = {};

function updateISSVisuals() {
  const geo = issGeoAt(Date.now());
  if (!geo) return;
  const altM = geo.altitude * 1000;
  geoToEcef(geo.latitude, geo.longitude, altM, issECEF);
  geoToEcef(geo.latitude, geo.longitude, 0, issGroundECEF);
  const dp = issDotGeom.getAttribute('position');
  dp.array[0] = issECEF.x; dp.array[1] = issECEF.y; dp.array[2] = issECEF.z;
  dp.needsUpdate = true;
  const lp = issLineGeom.getAttribute('position');
  lp.array[0] = issECEF.x; lp.array[1] = issECEF.y; lp.array[2] = issECEF.z;
  lp.array[3] = issGroundECEF.x; lp.array[4] = issGroundECEF.y; lp.array[5] = issGroundECEF.z;
  lp.needsUpdate = true;
}

// QZS track
const trackLineGeom = new THREE.BufferGeometry();
const trackLineMat = new THREE.LineBasicMaterial({ color: 0xFFC94D, transparent: true, opacity: 0.55 });
const trackLine = new THREE.Line(trackLineGeom, trackLineMat);
trackLine.name = 'qzs-track';
trackLine.frustumCulled = false;
scene.add(trackLine);

// ---- Data fetching ----
async function loadQuakes() {
  if (!tabVisible) return;
  const now = Date.now();
  if (now - cache.quakeAt < backoff.quake) return;
  cache.quakeAt = now; lsSet('quakeAt', now);
  try {
    const gj = await (await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson')).json();
    renderQuakes(gj); lsSet('quakeGeojson', gj); backoff.quake = TTL.quake;
  } catch (e) {
    document.getElementById('c-quake').textContent = '×';
    backoff.quake = Math.min(backoff.quake * 2, BACKOFF_MAX);
  }
}

async function loadAmedas() {
  if (!tabVisible) return;
  const now = Date.now();
  if (now - cache.amedasAt < backoff.amedas) return;
  cache.amedasAt = now; lsSet('amedasAt', now);
  try {
    if (!amedasMeta) {
      const cached = lsGet('amedasMeta');
      amedasMeta = cached || await (await fetch('https://www.jma.go.jp/bosai/amedas/const/amedastable.json')).json();
      if (!cached) lsSet('amedasMeta', amedasMeta);
    }
    const latest = (await (await fetch('https://www.jma.go.jp/bosai/amedas/data/latest_time.txt')).text()).trim();
    const d = new Date(latest), p = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}00`;
    if (stamp === cache.amedasStamp) { backoff.amedas = TTL.amedas; return; }
    const obs = await (await fetch(`https://www.jma.go.jp/bosai/amedas/data/map/${stamp}.json`)).json();
    renderAmedas(obs, stamp);
    cache.amedasStamp = stamp; lsSet('amedasStamp', stamp); lsSet('amedasSnapshot', { obs, stamp });
    backoff.amedas = TTL.amedas;
  } catch {
    document.getElementById('c-amedas').textContent = '×';
    backoff.amedas = Math.min(backoff.amedas * 2, BACKOFF_MAX);
  }
}

async function loadCatalogue() {
  const t0 = performance.now();
  let text, meta;
  const cachedMeta = lsGet('tleMeta');
  const now = Date.now();
  if (cachedMeta && cachedMeta.cachedAt && (now - cachedMeta.cachedAt) < TTL.tle) {
    const cachedText = lsGet('tleText');
    if (cachedText) { text = cachedText; meta = cachedMeta; }
  }
  if (!text) {
    try {
      const [t, m] = await Promise.all([
        fetch('data/active.tle').then(r => { if (!r.ok) throw new Error('active.tle ' + r.status); return r.text(); }),
        fetch('data/meta.json').then(r => { if (!r.ok) throw new Error('meta.json ' + r.status); return r.json(); })
      ]);
      text = t; meta = { ...m, cachedAt: now };
      lsSet('tleText', text); lsSet('tleMeta', meta);
    } catch {
      document.getElementById('debugline').textContent = '衛星カタログ準備中…';
      return;
    }
  }

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const catIndex = {}; Object.keys(CAT).forEach(k => catIndex[k] = []);
  catalogue.satrecs = []; catalogue.names = []; catalogue.cats = [];

  for (let i = 0; i + 2 < lines.length; i += 3) {
    const name = lines[i], l1 = lines[i + 1], l2 = lines[i + 2];
    if (l1[0] !== '1' || l2[0] !== '2') continue;
    if (name.indexOf('ISS (ZARYA)') === 0) continue;
    let satrec;
    try { satrec = satellite.twoline2satrec(l1, l2); } catch { continue; }
    if (!satrec) continue;
    const cat = classify(name);
    const idx = catalogue.satrecs.length;
    catalogue.satrecs.push(satrec); catalogue.names.push(name); catalogue.cats.push(cat);
    catIndex[cat].push(idx);
  }
  catalogue.catIndex = catIndex; catalogue.meta = meta;

  // Init colours
  const ecef = {};
  for (let i = 0; i < Math.min(catalogue.satrecs.length, satCloud.maxPts); i++) {
    const c = hexToRGB(CAT[catalogue.cats[i]].css);
    satCloud.colors[i * 3] = c.r; satCloud.colors[i * 3 + 1] = c.g; satCloud.colors[i * 3 + 2] = c.b;
  }
  satCloud.geom.getAttribute('color').needsUpdate = true;

  Object.keys(CAT).forEach(k => {
    const el = document.getElementById('c-' + k);
    if (el) el.textContent = catIndex[k].length.toLocaleString();
  });

  const dt = (performance.now() - t0).toFixed(0);
  console.info(`[orbit] カタログ解析完了: ${catalogue.satrecs.length}機 (${dt}ms)`);
  updateDebugLine();
  updateAllPositions();
  drawQzsTrack();
}

function updateDebugLine() {
  const m = catalogue.meta, dl = document.getElementById('debugline');
  if (!m) { dl.textContent = ''; return; }
  const age = Math.round((Date.now() - new Date(m.generated_at).getTime()) / 60000);
  dl.textContent = `カタログ ${catalogue.satrecs.length.toLocaleString()}機 ・ 取得(Actions) ${age}分前 ・ ${m.generated_at.slice(0, 16).replace('T', ' ')}UTC`;
}

function updateAllPositions() {
  if (catalogue.satrecs.length === 0) return;
  const now = new Date();
  const gmst = satellite.gstime(now);
  const count = Math.min(catalogue.satrecs.length, satCloud.maxPts);
  for (let i = 0; i < count; i++) {
    let pv;
    try { pv = satellite.propagate(catalogue.satrecs[i], now); } catch { continue; }
    if (!pv || !pv.position) continue;
    const ecf = satellite.eciToEcf(pv.position, gmst);
    satCloud.positions[i * 3] = ecf.x * 1000; satCloud.positions[i * 3 + 1] = ecf.y * 1000; satCloud.positions[i * 3 + 2] = ecf.z * 1000;
  }
  satCloud.geom.getAttribute('position').needsUpdate = true;
  satCloud.geom.setDrawRange(0, count);
}
setInterval(() => { if (tabVisible) updateAllPositions(); }, 2000);

function drawQzsTrack() {
  const qi = catalogue.catIndex.qzss && catalogue.catIndex.qzss[0];
  if (qi === undefined) return;
  const satrec = catalogue.satrecs[qi];
  const pts = [];
  const start = Date.now();
  for (let k = 0; k <= 288; k++) {
    const t = new Date(start + k * 300000);
    const gmst = satellite.gstime(t);
    let pv; try { pv = satellite.propagate(satrec, t); } catch { continue; }
    if (!pv || !pv.position) continue;
    const ecf = satellite.eciToEcf(pv.position, gmst);
    pts.push(ecf.x * 1000, ecf.y * 1000, ecf.z * 1000);
  }
  if (pts.length < 6) return;
  trackLineGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  trackLineGeom.setDrawRange(0, pts.length / 3);
}

loadCatalogue();
setInterval(() => { if (tabVisible) loadCatalogue(); }, TTL.tle);

// ISS polling
let issPollTimer = null;
async function pollISS() {
  if (!tabVisible) return;
  clearTimeout(issPollTimer);
  try {
    const d = await (await fetch('https://api.wheretheiss.at/v1/satellites/25544')).json();
    issMeta = d;
    if (issPrevLat != null) {
      const p1 = issPrevLat * Math.PI / 180, p2 = d.latitude * Math.PI / 180, dl = (d.longitude - issPrevLon) * Math.PI / 180;
      const y = Math.sin(dl) * Math.cos(p2);
      const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
      if (Math.hypot(y, x) > 1e-9) issHeading = Math.atan2(y, x);
    }
    issPrevLat = d.latitude; issPrevLon = d.longitude;
    issFixTime = Date.now(); issFixLat = d.latitude; issFixLon = d.longitude; issFixAlt = d.altitude;
    issSpeedKmh = d.velocity;
    document.getElementById('c-iss').textContent = Math.round(d.altitude) + 'km';
    document.getElementById('t-i').textContent = `${d.latitude.toFixed(1)}, ${d.longitude.toFixed(1)} / ${Math.round(d.velocity).toLocaleString()}km/h`;
    backoff.iss = 5000;
  } catch {
    document.getElementById('c-iss').textContent = '×';
    document.getElementById('t-i').textContent = '取得不可';
    backoff.iss = Math.min(backoff.iss * 2, ISS_BACKOFF_MAX);
  }
  issPollTimer = setTimeout(pollISS, backoff.iss);
}
pollISS();

// ---- Selection / card / picker ----
const card = document.getElementById('card'), cardBody = document.getElementById('card-body');
document.querySelector('#card .x').onclick = () => { card.style.display = 'none'; clearSelection(); };
function showCard(x, y, html) {
  cardBody.innerHTML = html; card.style.display = 'block';
  const w = card.offsetWidth, h = card.offsetHeight;
  card.style.left = Math.min(Math.max(x - w / 2, 8), innerWidth - w - 8) + 'px';
  card.style.top = Math.max(y - h - 14, 8) + 'px';
}

let selectionKind = null;
const btnIss = document.getElementById('btn-iss');

function clearSelection() {
  selectionKind = null;
  stopTracking();
  btnIss.textContent = 'ISS を追う'; btnIss.classList.remove('home');
}

// Screen-space picking via projection
const projVec = new THREE.Vector3();
function pickNearest(mx, my) {
  const ndcX = (mx / innerWidth) * 2 - 1, ndcY = -(my / innerHeight) * 2 + 1;
  let best = null, bestDist = 12;

  // Check ISS
  if (issGroup.visible && issFixTime) {
    projVec.set(issECEF.x, issECEF.y, issECEF.z).project(cam);
    if (projVec.z <= 1) {
      const px = (projVec.x * 0.5 + 0.5) * innerWidth, py = (-projVec.y * 0.5 + 0.5) * innerHeight;
      const d = Math.hypot(px - mx, py - my);
      if (d < bestDist) { bestDist = d; best = { kind: 'iss' }; }
    }
  }

  // Check quakes
  if (quakeCloud.mesh.visible) {
    for (let i = 0; i < quakeItems.length; i++) {
      projVec.set(quakeCloud.positions[i * 3], quakeCloud.positions[i * 3 + 1], quakeCloud.positions[i * 3 + 2]).project(cam);
      if (projVec.z > 1) continue;
      const px = (projVec.x * 0.5 + 0.5) * innerWidth, py = (-projVec.y * 0.5 + 0.5) * innerHeight;
      const d = Math.hypot(px - mx, py - my);
      if (d < bestDist) { bestDist = d; best = { kind: 'quake', index: i }; }
    }
  }

  // Check amedas
  if (amedasCloud.mesh.visible) {
    for (let i = 0; i < amedasItems.length; i++) {
      projVec.set(amedasCloud.positions[i * 3], amedasCloud.positions[i * 3 + 1], amedasCloud.positions[i * 3 + 2]).project(cam);
      if (projVec.z > 1) continue;
      const px = (projVec.x * 0.5 + 0.5) * innerWidth, py = (-projVec.y * 0.5 + 0.5) * innerHeight;
      const d = Math.hypot(px - mx, py - my);
      if (d < bestDist) { bestDist = d; best = { kind: 'amedas', index: i }; }
    }
  }

  // Check satellites
  if (satCloud.mesh.visible) {
    const count = Math.min(catalogue.satrecs.length, satCloud.maxPts);
    for (let i = 0; i < count; i++) {
      projVec.set(satCloud.positions[i * 3], satCloud.positions[i * 3 + 1], satCloud.positions[i * 3 + 2]).project(cam);
      if (projVec.z > 1) continue;
      const px = (projVec.x * 0.5 + 0.5) * innerWidth, py = (-projVec.y * 0.5 + 0.5) * innerHeight;
      const d = Math.hypot(px - mx, py - my);
      if (d < bestDist) { bestDist = d; best = { kind: 'bulkSat', index: i }; }
    }
  }

  return best;
}

// Earth surface click (raycast)
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2();

canvas.addEventListener('click', async e => {
  if (dragging) return; // don't pick during drag
  const mx = e.clientX, my = e.clientY;

  const picked = pickNearest(mx, my);
  if (picked) {
    if (picked.kind === 'iss') {
      const d = issMeta;
      showCard(mx, my, d ? `
        <div class="ct">ISS</div>
        <div class="cs">国際宇宙ステーション ・ NORAD 25544</div>
        <div class="kv"><span>緯度経度</span><b>${d.latitude.toFixed(2)}, ${d.longitude.toFixed(2)}</b></div>
        <div class="kv"><span>高度</span><b>${d.altitude.toFixed(1)} km</b></div>
        <div class="kv"><span>速度</span><b>${Math.round(d.velocity).toLocaleString()} km/h</b></div>
        <div class="kv"><span>日照</span><b>${d.visibility === 'daylight' ? '昼' : '夜'}</b></div>
        <div class="cf">実測位置 ・ wheretheiss.at</div>` : '<div class="ct">取得中…</div>');
      selectionKind = 'iss';
      const target = issPositionECEF(Date.now() + 2400);
      if (target) flyTo(target, { altitude: 350000, onEnd: () => startTracking(() => issPositionECEF(Date.now())) });
      btnIss.textContent = '追尾を解除'; btnIss.classList.add('home');
      return;
    }
    if (picked.kind === 'quake') {
      const q = quakeItems[picked.index];
      showCard(mx, my, `
        <div class="ct">M ${q.mag}</div>
        <div class="cs">${q.place || ''}</div>
        <div class="kv"><span>深さ</span><b>${q.depth != null ? q.depth.toFixed(0) + ' km' : '–'}</b></div>
        <div class="kv"><span>発生</span><b>${new Date(q.time).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false })}</b></div>
        <div class="cf">USGS Earthquake Hazards Program（Public Domain）</div>`);
      clearSelection();
      return;
    }
    if (picked.kind === 'amedas') {
      const a = amedasItems[picked.index];
      showCard(mx, my, `
        <div class="ct">${a.name}</div>
        <div class="cs">気象庁 アメダス観測所</div>
        <div class="kv"><span>気温</span><b>${a.temp} ℃</b></div>
        ${a.wind != null ? `<div class="kv"><span>風速</span><b>${a.wind} m/s</b></div>` : ''}
        ${a.rain != null ? `<div class="kv"><span>降水 1h</span><b>${a.rain} mm</b></div>` : ''}
        ${a.hum != null ? `<div class="kv"><span>湿度</span><b>${a.hum} %</b></div>` : ''}
        <div class="cf">気象庁（政府標準利用規約）</div>`);
      clearSelection();
      return;
    }
    if (picked.kind === 'bulkSat') {
      const idx = picked.index;
      const name = catalogue.names[idx], cat = catalogue.cats[idx], satrec = catalogue.satrecs[idx];
      const now = new Date(), gmst = satellite.gstime(now);
      let html;
      try {
        const pv = satellite.propagate(satrec, now);
        const geo = satellite.eciToGeodetic(pv.position, gmst);
        const vel = Math.hypot(pv.velocity.x, pv.velocity.y, pv.velocity.z);
        html = `
          <div class="ct">${name}</div>
          <div class="cs">${CAT[cat].label} ・ NORAD ${satrec.satnum}</div>
          <div class="kv"><span>直下点</span><b>${(geo.latitude * 180 / Math.PI).toFixed(2)}, ${(geo.longitude * 180 / Math.PI).toFixed(2)}</b></div>
          <div class="kv"><span>高度</span><b>${geo.height.toFixed(0)} km</b></div>
          <div class="kv"><span>速度</span><b>${vel.toFixed(2)} km/s</b></div>
          <div class="kv"><span>軌道傾斜</span><b>${(satrec.inclo * 180 / Math.PI).toFixed(1)}°</b></div>
          <div class="cf">SGP4解析伝播 ・ CelesTrak TLE</div>`;
      } catch {
        html = `<div class="ct">${name}</div><div class="cs">${CAT[cat].label}</div><div class="cf">伝播計算失敗</div>`;
      }
      showCard(mx, my, html);
      selectionKind = 'bulkSat';
      const target = { x: satCloud.positions[idx * 3], y: satCloud.positions[idx * 3 + 1], z: satCloud.positions[idx * 3 + 2] };
      flyTo(target, { altitude: 600000 });
      return;
    }
  }

  // Earth surface probe
  clearSelection();
  mouseNDC.set((mx / innerWidth) * 2 - 1, -(my / innerHeight) * 2 + 1);
  raycaster.setFromCamera(mouseNDC, cam);
  const hits = raycaster.intersectObject(earth);
  if (hits.length === 0) { card.style.display = 'none'; return; }
  const pt = hits[0].point;
  const geo = ecefToGeo(pt.x, pt.y, pt.z);
  const lat = geo.latitude, lon = geo.longitude;
  const key = probeKey(lat, lon);

  let hit = cache.probe.get(key);
  if (!hit) { const ls = lsGet('probe:' + key); if (ls) { hit = ls; cache.probe.set(key, ls); } }
  if (hit && Date.now() - hit.at < TTL.probe) {
    showCard(mx, my, hit.html + '<div class="cf" style="opacity:.6">キャッシュ表示</div>');
    return;
  }

  showCard(mx, my, `<div class="ct">観測中…</div><div class="cs mono">${lat.toFixed(3)}, ${lon.toFixed(3)}</div>`);
  try {
    let elevCached = cache.elev.get(key);
    if (elevCached === undefined) elevCached = lsGet('elev:' + key) ?? undefined;
    const [fc, el] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`).then(r => r.json()),
      elevCached !== undefined ? Promise.resolve({ elevation: [elevCached] }) :
        fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`).then(r => r.json()).catch(() => ({}))
    ]);
    if (el.elevation) { cache.elev.set(key, el.elevation[0]); lsSet('elev:' + key, el.elevation[0]); }
    const c = fc.current || {};
    const html = `
      <div class="ct">地点プローブ</div>
      <div class="cs mono">${lat.toFixed(3)}, ${lon.toFixed(3)}</div>
      <div class="kv"><span>天気</span><b>${WMO[c.weather_code] ?? '–'}</b></div>
      <div class="kv"><span>気温</span><b>${c.temperature_2m ?? '–'} ℃</b></div>
      <div class="kv"><span>風速</span><b>${c.wind_speed_10m ?? '–'} km/h</b></div>
      <div class="kv"><span>湿度</span><b>${c.relative_humidity_2m ?? '–'} %</b></div>
      <div class="kv"><span>標高</span><b>${el.elevation ? el.elevation[0] + ' m' : '–'}</b></div>
      <div class="cf"><a href="https://open-meteo.com/" target="_blank">Weather data by Open-Meteo.com</a>（CC BY 4.0）</div>`;
    const entry = { at: Date.now(), html };
    cache.probe.set(key, entry); lsSet('probe:' + key, entry);
    showCard(mx, my, html);
  } catch {
    showCard(mx, my, `<div class="ct">取得失敗</div><div class="cs">ネットワーク制限の可能性があります</div>`);
  }
});

// Prevent click from firing after drag
let clickSuppressed = false;
canvas.addEventListener('pointerdown', () => { clickSuppressed = false; });
canvas.addEventListener('pointermove', () => { clickSuppressed = true; });
canvas.addEventListener('click', e => { if (clickSuppressed) e.stopImmediatePropagation(); }, true);

// ---- Layer toggles ----
document.getElementById('layers-head').onclick = () => document.getElementById('layers').classList.toggle('collapsed');

const layerVisibility = {};
document.querySelectorAll('.lyr').forEach(el => {
  const k = el.dataset.k;
  layerVisibility[k] = true;
  el.onclick = () => {
    const on = !el.classList.contains('on');
    el.classList.toggle('on', on); el.classList.toggle('off', !on);
    layerVisibility[k] = on;
    if (k === 'iss') issGroup.visible = on;
    if (k === 'track') trackLine.visible = on;
    if (k === 'quake') quakeCloud.mesh.visible = on;
    if (k === 'amedas') amedasCloud.mesh.visible = on;
    if (k === 'night') { sunLight.intensity = on ? 1.5 : 0; ambientLight.intensity = on ? 0.15 : 1.0; }
    // Individual satellite categories: hide by moving offscreen (no per-category mesh)
    // For simplicity, toggle entire satellite cloud visibility when any sat category is toggled
    if (CAT[k]) {
      const anyOn = Object.keys(CAT).some(ck => layerVisibility[ck] !== false);
      satCloud.mesh.visible = anyOn;
    }
  };
});

// ---- Jump buttons ----
document.querySelector('.jbtn.home').onclick = () => {
  card.style.display = 'none'; clearSelection(); idle = true;
  const dest = {}; geoToEcef(25, 137.5, 24000000, dest);
  flyTo(dest, { altitude: 0, duration: 2600 });
};
btnIss.onclick = () => {
  if (trackGetPos) { clearSelection(); return; }
  if (!issFixTime) { btnIss.textContent = '位置取得中…'; return; }
  card.style.display = 'none';
  selectionKind = 'iss';
  const target = issPositionECEF(Date.now() + 2400);
  if (target) flyTo(target, { altitude: 350000, onEnd: () => startTracking(() => issPositionECEF(Date.now())) });
  btnIss.textContent = '追尾を解除'; btnIss.classList.add('home');
};
document.querySelectorAll('.jbtn[data-lon]').forEach(b => {
  b.onclick = () => {
    card.style.display = 'none'; clearSelection(); idle = false;
    const dest = {}; geoToEcef(+b.dataset.lat - 0.35, +b.dataset.lon, +b.dataset.h, dest);
    flyTo(dest, { altitude: 0, duration: 3000 });
  };
});
document.getElementById('btn-here').onclick = () => {
  const btn = document.getElementById('btn-here');
  if (!navigator.geolocation) { btn.textContent = '非対応'; setTimeout(() => btn.textContent = '📍 現在地', 2000); return; }
  btn.textContent = '取得中…';
  navigator.geolocation.getCurrentPosition(pos => {
    btn.textContent = '📍 現在地';
    card.style.display = 'none'; clearSelection(); idle = false;
    const dest = {}; geoToEcef(pos.coords.latitude - 0.35, pos.coords.longitude, 90000, dest);
    flyTo(dest, { altitude: 0, duration: 3000 });
  }, err => {
    btn.textContent = err.code === 1 ? '許可が必要' : '取得失敗';
    setTimeout(() => btn.textContent = '📍 現在地', 2500);
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
};

// ---- Clock ----
setInterval(() => {
  document.getElementById('t-c').textContent = new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false });
}, 1000);

// ---- Hint ----
let hintGone = false;
function fadeHint() {
  if (hintGone) return; hintGone = true;
  const h = document.getElementById('hint');
  if (h) { h.style.opacity = 0; setTimeout(() => h.remove(), 700); }
}
setTimeout(fadeHint, 9000);

// Boot fallback
setTimeout(() => { const b = document.getElementById('boot'); if (b) { b.style.opacity = 0; setTimeout(() => b.remove(), 1200); } }, 6000);

// ---- Cache restore ----
{
  const g = lsGet('quakeGeojson');
  if (g) renderQuakes(g);
  const a = lsGet('amedasSnapshot');
  if (a) {
    amedasMeta = lsGet('amedasMeta');
    if (amedasMeta) renderAmedas(a.obs, a.stamp);
  }
}

function observeAll() { loadQuakes(); loadAmedas(); }
observeAll();
setInterval(observeAll, 30000);

// ---- Sun light update ----
setInterval(updateSunLight, 60000);

// ==============================================================
// Animation loop
// ==============================================================
const _slerpOut = { x: 0, y: 0, z: 0 };
let lastT = performance.now();

function animate(nowMs) {
  requestAnimationFrame(animate);
  const dt = (nowMs - lastT) / 1000;
  lastT = nowMs;

  // --- flyTo ---
  if (flyTo_) {
    if (flyStart === null) flyStart = nowMs;
    const elapsed = nowMs - flyStart;
    const raw = Math.min(elapsed / flyDur, 1);
    const t = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
    slerp(flyFrom, flyTo_, t, _slerpOut);
    cam.position.set(_slerpOut.x, _slerpOut.y, _slerpOut.z);
    cam.lookAt(0, 0, 0);
    if (raw >= 1) {
      // Sync spherical controls
      const r = cam.position.length();
      ctrlDist = r;
      ctrlTheta = Math.atan2(cam.position.y, cam.position.x);
      ctrlPhi = Math.acos(cam.position.z / r);
      flyTo_ = null; flyFrom = null; flyStart = null;
      if (flyOnEnd) { flyOnEnd(); flyOnEnd = null; }
    }
  } else if (trackGetPos) {
    // --- Tracking ---
    const pos = trackGetPos();
    if (pos) {
      if (trackLastPos) {
        cam.position.x += pos.x - trackLastPos.x;
        cam.position.y += pos.y - trackLastPos.y;
        cam.position.z += pos.z - trackLastPos.z;
      }
      trackLastPos = { x: pos.x, y: pos.y, z: pos.z };
      cam.lookAt(pos.x, pos.y, pos.z);
      // Sync spherical
      ctrlDist = cam.position.length();
      ctrlTheta = Math.atan2(cam.position.y, cam.position.x);
      ctrlPhi = Math.acos(cam.position.z / ctrlDist);
    }
  } else {
    // --- Normal orbit controls ---
    if (!dragging) {
      ctrlTheta += vTheta; ctrlPhi = clampPhi(ctrlPhi + vPhi);
      vTheta *= INERTIA; vPhi *= INERTIA;
      if (Math.abs(vTheta) < 1e-6) vTheta = 0;
      if (Math.abs(vPhi) < 1e-6) vPhi = 0;
    }
    // Idle rotation
    if (idle && ctrlDist > 8000000) ctrlTheta -= dt * 0.012;

    const p = sphericalToXYZ(ctrlDist, ctrlTheta, ctrlPhi);
    cam.position.set(p.x, p.y, p.z);
    cam.lookAt(0, 0, 0);
  }

  // Update ISS visuals
  updateISSVisuals();

  renderer.render(scene, cam);
}
requestAnimationFrame(animate);

