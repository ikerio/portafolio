/* =====================================================================
   ChainNetwork — the Witzil landmark (station 4): blockchain donation
   transparency. A rising helix "chain of linked blocks" — cube-clusters of
   glyph points spiralling upward, strung together by link-beads, with a
   brightness pulse that climbs the chain (funds traced to their destination).

   Built as ONE glyph-point cloud reusing road.vert (the pulse flows along
   aT, which here is height up the chain) + points.frag + the shared glyph
   atlas — same visual language as the bead-road / steps / garden. Reveals
   with its chapter (driven from the active landmark, like the garden).
   ===================================================================== */

import {
  BufferGeometry,
  BufferAttribute,
  Points,
  ShaderMaterial,
  AdditiveBlending,
  Color,
  type Vector3,
} from 'three';
import vertexShader from '../shaders/chain.vert';
import fragmentShader from '../shaders/points.frag';
import { getGlyphAtlas } from './glyphAtlas';
import { CHAIN, PALETTE } from '../core/config';

export interface ChainNetworkOpts {
  center: Vector3; // station route point (helix base sits here)
  pixelRatio: number;
}

export class ChainNetwork {
  readonly points: Points;
  readonly material: ShaderMaterial;

  constructor(opts: ChainNetworkOpts) {
    const { blocks, edgePoints, blockSize, edgeJitter, linkBeads, linkJitter, radius, height, baseLift, turns } = CHAIN;

    // Node (block) centres along the helix, in local space (base at y=0).
    const node = (i: number): [number, number, number] => {
      const f = blocks > 1 ? i / (blocks - 1) : 0; // 0..1 up the chain
      const ang = f * turns * Math.PI * 2;
      return [Math.cos(ang) * radius, baseLift + f * height, Math.sin(ang) * radius];
    };

    const h = blockSize * 0.5;
    // 8 cube corners (local to a block centre) and the 12 edges joining them.
    const corner = [
      [-h, -h, -h], [h, -h, -h], [h, h, -h], [-h, h, -h],
      [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h],
    ];
    const edge = [
      [0, 1], [1, 2], [2, 3], [3, 0], // front face (z-)
      [4, 5], [5, 6], [6, 7], [7, 4], // back face (z+)
      [0, 4], [1, 5], [2, 6], [3, 7], // connecting edges
    ];

    const perBlock = edge.length * edgePoints;
    const total = blocks * perBlock + Math.max(0, blocks - 1) * linkBeads;
    const position = new Float32Array(total * 3);
    const aSeed = new Float32Array(total);
    const aBright = new Float32Array(total);
    const aT = new Float32Array(total); // 0..1 height fraction → the pulse climbs this
    const aIsBlock = new Float32Array(total); // 1 = block edge, 0 = link bead

    let w = 0;
    for (let b = 0; b < blocks; b++) {
      const [nx, ny, nz] = node(b);
      const fT = blocks > 1 ? b / (blocks - 1) : 0;

      // Block — a dotted-wireframe cube: glyphs strung along the 12 edges, so
      // it reads as a crisp ledger "block" rather than a fuzzy cloud.
      for (const [a, c] of edge) {
        const ca = corner[a];
        const cb = corner[c];
        for (let p = 0; p < edgePoints; p++) {
          const t = p / (edgePoints - 1);
          position[w * 3 + 0] = nx + ca[0] + (cb[0] - ca[0]) * t + (Math.random() - 0.5) * edgeJitter;
          position[w * 3 + 1] = ny + ca[1] + (cb[1] - ca[1]) * t + (Math.random() - 0.5) * edgeJitter;
          position[w * 3 + 2] = nz + ca[2] + (cb[2] - ca[2]) * t + (Math.random() - 0.5) * edgeJitter;
          aSeed[w] = Math.random();
          aBright[w] = 0.78 + Math.random() * 0.22; // edges read bright
          aT[w] = fT;
          aIsBlock[w] = 1;
          w++;
        }
      }

      // Link — a dense bead strand to the next block (the chain itself).
      if (b < blocks - 1) {
        const [mx, my, mz] = node(b + 1);
        const span = 1 / (blocks - 1);
        for (let k = 0; k < linkBeads; k++) {
          const t = (k + 1) / (linkBeads + 1);
          position[w * 3 + 0] = nx + (mx - nx) * t + (Math.random() - 0.5) * linkJitter;
          position[w * 3 + 1] = ny + (my - ny) * t + (Math.random() - 0.5) * linkJitter;
          position[w * 3 + 2] = nz + (mz - nz) * t + (Math.random() - 0.5) * linkJitter;
          aSeed[w] = Math.random();
          aBright[w] = 0.5 + Math.random() * 0.3; // links a touch dimmer than blocks
          aT[w] = fT + span * t; // continuous height → pulse flows through links
          aIsBlock[w] = 0;
          w++;
        }
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(position, 3));
    geo.setAttribute('aSeed', new BufferAttribute(aSeed, 1));
    geo.setAttribute('aBright', new BufferAttribute(aBright, 1));
    geo.setAttribute('aT', new BufferAttribute(aT, 1));
    geo.setAttribute('aIsBlock', new BufferAttribute(aIsBlock, 1));

    const atlas = getGlyphAtlas();
    this.material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: CHAIN.pointSize },
        uScale: { value: 30 },
        uPixelRatio: { value: opts.pixelRatio },
        uReveal: { value: 0 },
        uFlowSpeed: { value: CHAIN.flowSpeed },
        uGlyphCount: { value: atlas.count },
        uGlyphAtlas: { value: atlas.texture },
        uColorCore: { value: new Color(PALETTE.glowCore) },
        uColorWarm: { value: new Color(PALETTE.amber) },
      },
    });

    this.points = new Points(geo, this.material);
    this.points.position.copy(opts.center);
    this.points.frustumCulled = false;
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  setReveal(v: number): void {
    this.material.uniforms.uReveal.value = v;
  }

  setPixelRatio(r: number): void {
    this.material.uniforms.uPixelRatio.value = r;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
