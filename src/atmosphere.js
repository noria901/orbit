/**
 * Atmosphere rim-glow shader.
 * Simple Fresnel-style glow rendered on the back side of an enlarged
 * sphere, replacing Cesium's built-in skyAtmosphere.
 */

'use strict';

const VERTEX_SHADER = `
  varying vec3 vNormal; varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = (modelViewMatrix * vec4(position,1.0)).xyz;
    gl_Position = projectionMatrix * vec4(vPosition,1.0);
  }`;

const FRAGMENT_SHADER = `
  uniform vec3 glowColor; uniform float intensity; uniform float power;
  varying vec3 vNormal; varying vec3 vPosition;
  void main() {
    vec3 viewDir = normalize(-vPosition);
    float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
    float glow = pow(rim, power) * intensity;
    gl_FragColor = vec4(glowColor, glow);
  }`;

/**
 * @param {object} THREE
 * @param {number} equatorialRadius - WGS84_A in meters
 * @param {object} [options]
 * @returns {THREE.Mesh}
 */
function createAtmosphere(THREE, equatorialRadius, options = {}) {
  const {
    scale = 1.025,
    segments = 64,
    glowColor = [0.3, 0.6, 1.0],
    intensity = 0.7,
    power = 3.5,
  } = options;

  const geom = new THREE.SphereGeometry(equatorialRadius * scale, segments, segments);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Vector3(...glowColor) },
      intensity: { value: intensity },
      power: { value: power },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = 'atmosphere';
  return mesh;
}

export { createAtmosphere };
