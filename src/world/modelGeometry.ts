/* =====================================================================
   modelGeometry — load a GLB and return a single, normalized BufferGeometry
   (position + normal only) ready to be surface-sampled into a glyph cloud by
   LandmarkObject. Merges all meshes, bakes world transforms, centers on the
   bounding box, scales the largest dimension to `targetSize`, optionally rests
   it on the ground (base at y=0) and rotates it. Used for the WHO I AM self-
   portrait (iker.glb) replacing the procedural bust proxy — no shader change.
   ===================================================================== */

import { BufferGeometry, BufferAttribute, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface AsciiGeometryOpts {
  /** Largest bounding-box dimension after normalization (local units). */
  targetSize: number;
  /** Translate so the base sits at y=0 (a resting bust) instead of centred.
      Position/rotation/scale are applied on the object (so they're live-tunable
      in the GUI), not baked here. */
  restOnGround?: boolean;
}

interface LoadedMesh {
  isMesh?: boolean;
  geometry?: BufferGeometry;
  matrixWorld: { clone(): unknown };
}

export async function loadAsciiGeometry(url: string, opts: AsciiGeometryOpts): Promise<BufferGeometry> {
  const gltf = await new Promise<{ scene: { updateMatrixWorld(f: boolean): void; traverse(cb: (o: LoadedMesh) => void): void } }>(
    (resolve, reject) => new GLTFLoader().load(url, resolve as never, undefined, reject),
  );
  gltf.scene.updateMatrixWorld(true);

  // Collect each mesh as a non-indexed position+normal geometry in world space
  // (stripping uv/tangent/skin etc. so all parts are merge-compatible).
  const parts: BufferGeometry[] = [];
  gltf.scene.traverse((o) => {
    const mesh = o as unknown as { isMesh?: boolean; geometry?: BufferGeometry; matrixWorld: never };
    if (!mesh.isMesh || !mesh.geometry) return;
    const src = mesh.geometry;
    const g = src.index ? src.toNonIndexed() : src.clone();
    g.applyMatrix4((o as unknown as { matrixWorld: never }).matrixWorld as never);
    if (!g.attributes.normal) g.computeVertexNormals();
    const stripped = new BufferGeometry();
    stripped.setAttribute('position', (g.attributes.position as BufferAttribute).clone());
    stripped.setAttribute('normal', (g.attributes.normal as BufferAttribute).clone());
    parts.push(stripped);
    g.dispose();
  });
  if (parts.length === 0) throw new Error(`No mesh found in ${url}`);

  let geo = parts.length === 1 ? parts[0] : (mergeGeometries(parts, false) as BufferGeometry | null);
  if (!geo) throw new Error(`Failed to merge meshes in ${url}`);
  if (parts.length > 1) parts.forEach((p) => p.dispose());

  // Center on bbox, scale so the largest dimension == targetSize.
  geo.computeBoundingBox();
  const size = new Vector3();
  const center = new Vector3();
  geo.boundingBox!.getSize(size);
  geo.boundingBox!.getCenter(center);
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  geo.translate(-center.x, -center.y, -center.z);
  const s = opts.targetSize / maxDim;
  geo.scale(s, s, s);

  // Rest on the ground (base at y=0). Origin ends at the base-centre, so an
  // object-level rotation spins the bust cleanly about its vertical axis.
  geo.computeBoundingBox();
  if (opts.restOnGround) geo.translate(0, -geo.boundingBox!.min.y, 0);

  geo.computeVertexNormals(); // clean unit normals for the ASCII light shading
  geo.computeBoundingBox();
  return geo;
}
