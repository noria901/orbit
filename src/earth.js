/**
 * Earth ellipsoid mesh + base texture loading.
 *
 * Builds a WGS84 ellipsoid by scaling a unit sphere (matches Cesium's
 * ellipsoid convention: equatorial radius A on X/Z, polar radius B on Y
 * before the ECEF Z-up rotation is applied by the caller).
 */

'use strict';

import { WGS84_A, WGS84_F } from './geo.js';

const WGS84_B = WGS84_A * (1 - WGS84_F);

/**
 * Create the Earth mesh. Caller is responsible for adding it to the scene
 * and rotating it -90deg on X so the sphere's Y-up becomes ECEF Z-up.
 *
 * @param {object} THREE - the Three.js module namespace
 * @param {object} [options]
 * @param {number} [options.segments=64]
 * @returns {{ mesh: THREE.Mesh, material: THREE.MeshPhongMaterial }}
 */
function createEarth(THREE, { segments = 64 } = {}) {
  const geom = new THREE.SphereGeometry(1, segments, segments);
  const pos = geom.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) * WGS84_A, pos.getY(i) * WGS84_B, pos.getZ(i) * WGS84_A);
  }
  pos.needsUpdate = true;
  geom.computeVertexNormals();

  const material = new THREE.MeshPhongMaterial({
    color: 0xcccccc, shininess: 15, emissive: 0x334455, emissiveIntensity: 0.35,
  });
  const mesh = new THREE.Mesh(geom, material);
  mesh.name = 'earth';
  return { mesh, material };
}

/**
 * Load a base texture onto the earth material. Resolves once the texture
 * has loaded (or rejects on error) so the caller can drive a boot overlay.
 *
 * @param {object} THREE
 * @param {THREE.MeshPhongMaterial} material
 * @param {string} url
 */
function loadBaseTexture(THREE, material, url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        material.map = tex;
        material.emissiveMap = tex;
        material.color.set(0xffffff);
        material.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      (err) => reject(err),
    );
  });
}

export { createEarth, loadBaseTexture, WGS84_B };
