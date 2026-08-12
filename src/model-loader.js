/**
 * ISS glTF model loader: lazy load, centroid-offset correction, and a
 * procedural fallback shape if the model fails or is implausible.
 *
 * Background (see CLAUDE.md "高速移動オブジェクトのカメラ追従" for the full
 * saga): the Cesium-era version of this feature broke twice because
 * Cesium.Model#boundingSphere threw when read before the primitive had
 * been through a render pass, and a later fix accidentally measured the
 * centroid AFTER a rough placement had already been applied (so it
 * captured world-space coordinates and mistook them for local ones,
 * sending the model millions of meters off).
 *
 * Three.js sidesteps both problems structurally: GLTFLoader resolves with
 * a fully-parsed scene graph, and THREE.Box3().setFromObject() computes a
 * real bounding box immediately — no render-pass wait, no ambiguity about
 * which transform state was in effect when it was measured (we measure
 * it before the object is ever added to the scene / given a transform).
 */

'use strict';

/**
 * Build a simple representative satellite silhouette (body + solar
 * panels) as a fallback when the real model isn't available. Not an
 * accurate CAD replica of any specific satellite — see CLAUDE.md's
 * stance on representative vs. real geometry.
 *
 * @param {object} THREE
 * @param {object} [options]
 * @param {[number,number,number]} [options.bodySize=[2,2,3]]
 * @param {[number,number,number]} [options.panelSize=[0.3,18,3]]
 */
function createFallbackShape(THREE, options = {}) {
  const { bodySize = [2, 2, 3], panelSize = [0.3, 18, 3] } = options;
  const group = new THREE.Group();
  group.name = 'model-fallback';

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(...bodySize),
    new THREE.MeshPhongMaterial({ color: 0xb8c4d0 }),
  );
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(...panelSize),
    new THREE.MeshPhongMaterial({ color: 0x2a4e8c, transparent: true, opacity: 0.9 }),
  );
  group.add(body, panel);
  return group;
}

/**
 * Load a glTF model and re-center it so its bounding-box centroid sits at
 * the object's own origin (so callers can place/rotate it about its
 * visual center rather than whatever arbitrary point the source asset
 * used as its origin).
 *
 * @param {object} THREE
 * @param {object} GLTFLoader - the GLTFLoader class from three/addons
 * @param {string} url
 * @param {object} [options]
 * @param {number} [options.maxPlausibleOffset=500] - meters; if the
 *   measured centroid offset exceeds this, treat the asset as unusable
 *   (matches the Cesium-era safety net) and reject.
 * @returns {Promise<THREE.Object3D>}
 */
async function loadCenteredModel(THREE, GLTFLoader, url, options = {}) {
  const { maxPlausibleOffset = 500 } = options;
  const loader = new GLTFLoader();

  const gltf = await new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });

  const scene = gltf.scene || gltf.scenes[0];
  const box = new THREE.Box3().setFromObject(scene);
  const center = box.getCenter(new THREE.Vector3());
  const offset = center.length();

  if (!Number.isFinite(offset) || offset > maxPlausibleOffset) {
    throw new Error(`model centroid offset implausible (${offset}m > ${maxPlausibleOffset}m)`);
  }

  // Re-center: shift the geometry so the bounding-box center becomes the
  // object's local origin. A wrapping group keeps this reusable even if
  // the caller wants to swap models later.
  scene.position.sub(center);
  const wrapper = new THREE.Group();
  wrapper.name = 'model-wrapper';
  wrapper.add(scene);
  return wrapper;
}

/**
 * High-level helper: try to load the real model; fall back to the
 * procedural shape on any failure. Never throws.
 *
 * @returns {Promise<{ object: THREE.Object3D, isReal: boolean }>}
 */
async function loadModelWithFallback(THREE, GLTFLoader, url, options = {}) {
  try {
    const object = await loadCenteredModel(THREE, GLTFLoader, url, options);
    return { object, isReal: true };
  } catch (e) {
    console.warn('[orbit] ISS実モデル読込失敗。代表シルエットで継続します。', e);
    return { object: createFallbackShape(THREE, options.fallback), isReal: false };
  }
}

export { createFallbackShape, loadCenteredModel, loadModelWithFallback };
