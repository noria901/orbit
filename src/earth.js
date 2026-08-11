/**
 * Earth mesh — WGS84 ellipsoid geometry with base texture.
 *
 * THREE is dependency-injected so the module stays testable in Node.
 * The texture URL (Natural Earth II or Blue Marble) is configurable.
 */

const { WGS84_A, WGS84_F } = require('./geo');

// WGS84 semi-minor axis in meters
const WGS84_B = WGS84_A * (1 - WGS84_F);

// Default base texture — Natural Earth II from Cesium Ion CDN (public, no key needed)
const DEFAULT_TEXTURE_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Blue_Marble_2002.png/1280px-Blue_Marble_2002.png';

/**
 * Create the Earth mesh.
 *
 * @param {object} THREE  — Three.js namespace (injected)
 * @param {object} [opts]
 * @param {string} [opts.textureURL]  — override base texture
 * @param {number} [opts.segments]    — sphere segments (default 64)
 * @returns {{ mesh, update, dispose }}
 */
function createEarth(THREE, opts = {}) {
  const segments = opts.segments ?? 64;
  const textureURL = opts.textureURL ?? DEFAULT_TEXTURE_URL;

  // WGS84 ellipsoid: stretch a unit sphere by (a, a, b)
  const geometry = new THREE.SphereGeometry(1, segments, segments);
  scaleGeometry(geometry, WGS84_A, WGS84_A, WGS84_B);

  // Material — starts with a solid colour, texture loads async
  const material = new THREE.MeshPhongMaterial({
    color: 0x1a3a5c,  // ocean blue fallback
    shininess: 15,
  });

  // Load texture asynchronously
  let textureLoaded = false;
  if (typeof THREE.TextureLoader === 'function') {
    const loader = new THREE.TextureLoader();
    loader.load(textureURL, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      material.map = texture;
      material.color.set(0xffffff);
      material.needsUpdate = true;
      textureLoaded = true;
    });
  }

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'earth';

  return {
    mesh,
    get textureLoaded() { return textureLoaded; },
    dispose() {
      geometry.dispose();
      material.dispose();
      if (material.map) material.map.dispose();
    },
  };
}

/**
 * Scale geometry vertex positions in-place (for ellipsoid shaping).
 * Works with both BufferGeometry position attribute.
 */
function scaleGeometry(geometry, sx, sy, sz) {
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) * sx, pos.getY(i) * sy, pos.getZ(i) * sz);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

module.exports = { createEarth, WGS84_B, DEFAULT_TEXTURE_URL, scaleGeometry };
