/**
 * Atmospheric glow effect — a slightly oversized translucent shell
 * around the Earth with Fresnel-based rim lighting.
 *
 * Uses a custom ShaderMaterial with vertex/fragment shaders for
 * view-dependent glow (brighter at limb, transparent at centre).
 *
 * THREE is dependency-injected for testability.
 */

const { WGS84_A } = require('./geo');

// Atmosphere shell extends ~2% beyond Earth's surface
const ATMO_SCALE = 1.025;

const VERTEX_SHADER = `
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * vec4(vPosition, 1.0);
}
`;

const FRAGMENT_SHADER = `
uniform vec3 glowColor;
uniform float intensity;
uniform float power;
varying vec3 vNormal;
varying vec3 vPosition;
void main() {
  vec3 viewDir = normalize(-vPosition);
  float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
  float glow = pow(rim, power) * intensity;
  gl_FragColor = vec4(glowColor, glow);
}
`;

/**
 * Create the atmosphere glow mesh.
 *
 * @param {object} THREE — Three.js namespace (injected)
 * @param {object} [opts]
 * @param {number[]} [opts.color]  — RGB array [r,g,b] 0-1 (default sky blue)
 * @param {number} [opts.intensity] — glow brightness (default 0.7)
 * @param {number} [opts.power]     — Fresnel power (default 3.5)
 * @param {number} [opts.scale]     — shell scale factor (default 1.025)
 * @returns {{ mesh, dispose }}
 */
function createAtmosphere(THREE, opts = {}) {
  const color = opts.color ?? [0.3, 0.6, 1.0];
  const intensity = opts.intensity ?? 0.7;
  const power = opts.power ?? 3.5;
  const scale = opts.scale ?? ATMO_SCALE;

  const radius = WGS84_A * scale;
  const geometry = new THREE.SphereGeometry(radius, 64, 64);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Vector3(color[0], color[1], color[2]) },
      intensity: { value: intensity },
      power: { value: power },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'atmosphere';

  return {
    mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

module.exports = {
  createAtmosphere,
  ATMO_SCALE,
  VERTEX_SHADER,
  FRAGMENT_SHADER,
};
