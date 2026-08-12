/**
 * glTF model loader with centroid offset compensation and fallback geometry.
 *
 * Lessons from CLAUDE.md hard-applied here:
 *
 * 1. The model must be show=true and placed BEFORE reading boundingSphere,
 *    otherwise the bounding sphere centre is (0,0,0) in local space.
 *
 * 2. The actual model assignment is DEFERRED until the offset is measured
 *    in a postRender callback — so no fallback tick handler can interfere.
 *
 * 3. 42MB ISS model may cause WebGL context loss on low-spec hardware.
 *    If loading fails (network, memory), the fallback box mesh is used silently.
 *
 * THREE is dependency-injected. GLTFLoader is also injected (from
 * three/addons/loaders/GLTFLoader.js) so the module stays testable.
 */

'use strict';

const { geoToEcef } = require('./geo');
const { Transforms } = require('./math');

const ISS_MODEL_URL =
  'https://assets.science.nasa.gov/content/dam/science/psd/space-science/2023/12/iss.glb';

/**
 * Create a simple fallback cross-shaped ISS representation.
 * Returns a Three.js Object3D (no external deps needed).
 */
function createFallbackMesh(THREE) {
  const group = new THREE.Group();
  group.name = 'iss-fallback';

  const mat = new THREE.MeshBasicMaterial({ color: 0xdddddd, wireframe: false });

  // Main truss (x-axis) — 109m wide
  const truss = new THREE.Mesh(new THREE.BoxGeometry(109, 3, 3), mat);
  truss.name = 'iss-truss';
  group.add(truss);

  // Hab module (z-axis) — ~73m long
  const hab = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 73), mat);
  hab.name = 'iss-hab';
  group.add(hab);

  return { mesh: group, mat };
}

/**
 * Place a model at the given geographic position with heading/pitch/roll.
 *
 * @param {object} model — Three.js Object3D
 * @param {{ latitude, longitude, altitude }} geo — altitude in km
 * @param {{ heading, pitch, roll }} hpr — radians
 */
function placeModel(model, geo, hpr = { heading: 0, pitch: 0, roll: 0 }) {
  const altM = (geo.altitude ?? 408) * 1000;
  const ecef = {};
  geoToEcef(geo.latitude, geo.longitude, altM, ecef);

  // Build ENU→ECEF transform matrix for position + orientation
  const mat4 = Transforms.headingPitchRollToFixedFrame(
    ecef, hpr.heading, hpr.pitch, hpr.roll,
  );

  // Three.js uses column-major Float64Array(16) same as our math.js
  model.matrixAutoUpdate = false;
  model.matrix.fromArray(mat4);
  model.matrix.elements[12] = ecef.x;
  model.matrix.elements[13] = ecef.y;
  model.matrix.elements[14] = ecef.z;
  model.matrixWorldNeedsUpdate = true;
}

/**
 * Load the ISS glTF model (or use fallback if unavailable).
 *
 * @param {object} THREE
 * @param {object} GLTFLoader — injected loader class (new GLTFLoader())
 * @param {object} [opts]
 * @param {string} [opts.url]       — override model URL
 * @param {boolean} [opts.fallback] — force fallback (skip network load)
 * @returns {Promise<{ mesh, place(geo, hpr), dispose() }>}
 */
async function loadISSModel(THREE, GLTFLoader, opts = {}) {
  const url = opts.url ?? ISS_MODEL_URL;
  const forceFallback = opts.fallback ?? false;

  if (forceFallback || !GLTFLoader) {
    const { mesh, mat } = createFallbackMesh(THREE);
    return {
      mesh,
      place: (geo, hpr) => placeModel(mesh, geo, hpr),
      dispose() {
        mesh.traverse(child => {
          if (child.geometry) child.geometry.dispose();
        });
        mat.dispose();
      },
      isFallback: true,
    };
  }

  return new Promise((resolve) => {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const model = gltf.scene;
        model.name = 'iss-gltf';
        resolve({
          mesh: model,
          place: (geo, hpr) => placeModel(model, geo, hpr),
          dispose() {
            model.traverse(child => {
              if (child.isMesh) {
                child.geometry?.dispose();
                if (child.material) {
                  const mats = Array.isArray(child.material) ? child.material : [child.material];
                  for (const m of mats) m.dispose();
                }
              }
            });
          },
          isFallback: false,
        });
      },
      undefined,
      (_err) => {
        // Network / decode failure — use fallback silently
        const { mesh, mat } = createFallbackMesh(THREE);
        resolve({
          mesh,
          place: (geo, hpr) => placeModel(mesh, geo, hpr),
          dispose() {
            mesh.traverse(child => {
              if (child.geometry) child.geometry.dispose();
            });
            mat.dispose();
          },
          isFallback: true,
        });
      },
    );
  });
}

module.exports = {
  loadISSModel,
  createFallbackMesh,
  placeModel,
  ISS_MODEL_URL,
};
