/* =====================================================================
   CameraDebug (dev only) — author the camera path interactively. Toggle
   free-fly (OrbitControls), review existing checkpoints, and capture the
   current position + look-at as nodes, then export config-ready arrays to
   paste into core/config.CAMERA. Also draws the position/target curves so
   the authored route is visible.
   ===================================================================== */

import {
  Line,
  BufferGeometry,
  LineBasicMaterial,
  Color,
  Vector3,
  type PerspectiveCamera,
  type Scene,
  type WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { CameraRig } from '../render/CameraRig';
import { PALETTE } from '../core/config';

const round = (v: number) => Math.round(v * 10) / 10;

interface Node {
  pos: [number, number, number];
  target: [number, number, number];
}

export class CameraDebug {
  enabled = false;
  private controls: OrbitControls;
  private canvas: HTMLCanvasElement;
  private captured: Node[] = [];
  private posLine: Line;
  private targetLine: Line;

  constructor(
    private camera: PerspectiveCamera,
    renderer: WebGLRenderer,
    private rig: CameraRig,
    scene: Scene,
    private nodePositions: Vector3[],
    private nodeTargets: Vector3[],
  ) {
    this.canvas = renderer.domElement;
    this.controls = new OrbitControls(camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.enabled = false;

    this.posLine = this.makeLine(rig.positionCurve.getPoints(150), PALETTE.amber);
    this.targetLine = this.makeLine(rig.targetCurve.getPoints(150), PALETTE.ink2);
    this.posLine.visible = false;
    this.targetLine.visible = false;
    scene.add(this.posLine, this.targetLine);
  }

  private makeLine(points: Vector3[], color: string): Line {
    return new Line(
      new BufferGeometry().setFromPoints(points),
      new LineBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.7 }),
    );
  }

  /** Enter/exit free-fly. While free, the canvas is raised so it receives input. */
  enable(on: boolean): void {
    this.enabled = on;
    this.controls.enabled = on;
    if (on) {
      this.controls.target.copy(this.rig.currentTarget);
      this.canvas.style.zIndex = '30';
      this.canvas.style.pointerEvents = 'auto';
      this.controls.update();
    } else {
      this.canvas.style.zIndex = '0';
      this.canvas.style.pointerEvents = '';
    }
  }

  showPath(on: boolean): void {
    this.posLine.visible = on;
    this.targetLine.visible = on;
  }

  get nodeCount(): number {
    return this.nodePositions.length;
  }

  /** Snap the free camera to a derived path node, to review/adjust it. */
  gotoNode(i: number): void {
    const p = this.nodePositions[i];
    const t = this.nodeTargets[i];
    if (!p || !t) return;
    this.camera.position.copy(p);
    this.controls.target.copy(t);
    this.controls.update();
  }

  /** Record the current pose as the next node. */
  captureNode(): void {
    const p = this.camera.position;
    const t = this.controls.target;
    const node: Node = {
      pos: [round(p.x), round(p.y), round(p.z)],
      target: [round(t.x), round(t.y), round(t.z)],
    };
    this.captured.push(node);
    // eslint-disable-next-line no-console
    console.log(`[camera] node #${this.captured.length}:`, JSON.stringify(node));
  }

  /** Log (and copy) the captured nodes as config-ready arrays. */
  exportNodes(): void {
    if (!this.captured.length) {
      console.log('[camera] no nodes captured yet — fly + "capture node" first.');
      return;
    }
    const pos = this.captured.map((n) => `    [${n.pos.join(', ')}],`).join('\n');
    const tgt = this.captured.map((n) => `    [${n.target.join(', ')}],`).join('\n');
    const out = `positionNodes: [\n${pos}\n  ] as Vec3[],\n  targetNodes: [\n${tgt}\n  ] as Vec3[],`;
    // eslint-disable-next-line no-console
    console.log('[camera] paste into core/config.CAMERA:\n' + out);
    navigator.clipboard?.writeText(out).catch(() => {});
  }

  clearCaptured(): void {
    this.captured = [];
    console.log('[camera] captured nodes cleared.');
  }

  update(): void {
    if (this.enabled) this.controls.update();
  }

  dispose(): void {
    this.controls.dispose();
    this.posLine.geometry.dispose();
    this.targetLine.geometry.dispose();
  }
}
