import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RobotKind } from '../types';
import { Problem } from '../math/problems';
import { cloneSkinned } from './assets';
import { drawLed, LED_RED, LED_GREEN, LED_DIM, LedStyle } from './segment';

export interface KindSpec {
  speed: number;        // m/s
  problems: number;     // correct hits needed to power down
  armor: number;        // armour colour
  glow: number;         // emissive colour
  scale: number;
  boardY: number;       // equation board height above the root
  radius: number;       // body hit radius
  height: number;
  tier: number;         // number difficulty bonus
  points: number;
  hover?: number;       // flying height added to the root (scouts)
  proxyY?: number;      // body centre for hit tests (before scale)
}

export interface Nav {
  steer: (p: THREE.Vector3, dir: THREE.Vector3, r: number) => THREE.Vector3;
  resolve: (p: THREE.Vector3, r: number) => void;
}

export const KINDS: { [k: string]: KindSpec } = {
  drone: { speed: 1.6, problems: 1, armor: 0x0f8f86, glow: 0x30fff0, scale: 1.3, boardY: 2.45, radius: 0.42, height: 2.0, tier: 0, points: 100 },
  mech: { speed: 1.15, problems: 2, armor: 0x9a1016, glow: 0xff2a18, scale: 1.25, boardY: 2.95, radius: 0.6, height: 2.5, tier: 1, points: 150 },
  spider: { speed: 2.3, problems: 1, armor: 0x8a4a12, glow: 0xffa020, scale: 1.3, boardY: 1.75, radius: 0.9, height: 1.2, tier: 2, points: 150 },
  scout: { speed: 2.6, problems: 1, armor: 0x5a22c8, glow: 0xd070ff, scale: 1.25, boardY: 2.35, radius: 0.75, height: 0.9, tier: 1, points: 150, hover: 1.1, proxyY: 1.6 },
  titan: { speed: 0.85, problems: 4, armor: 0xa8781a, glow: 0xffc030, scale: 1.6, boardY: 2.95, radius: 0.75, height: 2.6, tier: 2, points: 500 },
};

export type RobotState = 'spawning' | 'walking' | 'attacking' | 'down' | 'gone';

export interface PanelHit { robot: Robot; index: number }

let nextId = 1;

export class Robot {
  id = nextId++;
  kind: RobotKind;
  spec: KindSpec;
  root = new THREE.Group();
  state: RobotState = 'spawning';
  problem: Problem | null = null;
  values: number[] = [];
  correctIndex = 0;
  problemsLeft: number;
  mistakes = 0;
  panels: THREE.Mesh[] = [];
  proxy: THREE.Mesh;
  private canvases: HTMLCanvasElement[] = [];
  private board: THREE.Mesh;
  private boardCanvas: HTMLCanvasElement;
  private mixer: THREE.AnimationMixer;
  private actions: { [name: string]: THREE.AnimationAction } = {};
  private current: THREE.AnimationAction | null = null;
  private armorMats: THREE.MeshStandardMaterial[] = [];
  private glowMats: THREE.MeshStandardMaterial[] = [];
  private t = 0;
  private stateT = 0;
  private attackCd = 1.2;
  private zapPending = -1;
  private hitFlash = 0;
  private blink = false;
  private blinkT = 0;
  hintOn = false;
  speedMul = 1;
  targeted = false;
  /** Title-screen showcase robot: idles in place, never attacks */
  display = false;
  /** Flying height (scouts) */
  hover = 0;
  private stuckT = 0;
  private detour = 0;

  constructor(kind: RobotKind, gltf: GLTF, private scene: THREE.Scene, spawn: THREE.Vector3) {
    this.kind = kind;
    const base = KINDS[kind];
    this.spec = Object.assign({}, base, {
      boardY: base.boardY * base.scale, radius: base.radius * base.scale, height: base.height * base.scale,
      proxyY: (base.proxyY !== undefined ? base.proxyY : base.height / 2) * base.scale,
    });
    this.hover = base.hover || 0;
    this.problemsLeft = this.spec.problems;
    const model = cloneSkinned(gltf.scene);
    model.scale.setScalar(this.spec.scale);
    this.root.add(model);
    this.root.position.copy(spawn);
    scene.add(this.root);

    // own materials so colours / flashes / power-down are per robot
    const cloned: { [name: string]: THREE.Material } = {};
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = false;
      m.frustumCulled = false;
      const src = m.material as THREE.MeshStandardMaterial;
      if (!cloned[src.name]) {
        const c = src.clone();
        if (src.name === 'Armor') {
          c.color.setHex(this.spec.armor);
          this.armorMats.push(c);
        } else if (src.name === 'Glow') {
          c.emissive.setHex(this.spec.glow);
          c.color.setHex(this.spec.glow);
          c.emissiveIntensity = 4;
          c.toneMapped = false;
          this.glowMats.push(c);
        }
        c.envMapIntensity = 1.2;
        cloned[src.name] = c;
      }
      m.material = cloned[src.name];
    });

    // LED answer screens on the PANEL_* sockets exported from Blender
    const sockets: THREE.Object3D[] = [];
    model.traverse((o) => { if (o.name.indexOf('PANEL_') === 0) sockets.push(o); });
    sockets.sort((a, b) => (a.name < b.name ? -1 : 1));
    model.updateMatrixWorld(true);
    for (let i = 0; i < sockets.length; i++) {
      const s = sockets[i];
      const w = (s.userData.panel_w as number) || 0.2;
      const h = (s.userData.panel_h as number) || 0.15;
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = Math.round(256 * h / w);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.9, 1.9, 1.9) });
      // undo the socket's world scale; the screen slightly overhangs its bezel to read from afar
      const ws = new THREE.Vector3();
      s.getWorldScale(ws);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry((w * 1.12) / ws.x, (h * 1.12) / ws.y), mat);
      panel.userData.panel = { robot: this, index: i } as PanelHit;
      s.add(panel);
      this.panels.push(panel);
      this.canvases.push(canvas);
    }

    // floating equation board (red LED, always faces the camera)
    this.boardCanvas = document.createElement('canvas');
    this.boardCanvas.width = 512;
    this.boardCanvas.height = 128;
    const btex = new THREE.CanvasTexture(this.boardCanvas);
    btex.colorSpace = THREE.SRGBColorSpace;
    this.board = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.375), new THREE.MeshBasicMaterial({
      map: btex, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, depthWrite: false,
    }));
    this.board.position.y = this.spec.boardY;
    this.board.renderOrder = 5;
    this.root.add(this.board);

    // invisible body proxy for "you hit the armour" sparks
    this.proxy = new THREE.Mesh(new THREE.CylinderGeometry(this.spec.radius, this.spec.radius, this.spec.height, 8),
      new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.y = this.spec.proxyY as number;
    this.proxy.userData.robot = this;
    this.root.add(this.proxy);

    this.mixer = new THREE.AnimationMixer(model);
    for (let i = 0; i < gltf.animations.length; i++) {
      const clip = gltf.animations[i];
      const a = this.mixer.clipAction(clip);
      if (clip.name === 'PowerDown' || clip.name === 'Attack' || clip.name === 'Hit') {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = clip.name === 'PowerDown';
      }
      this.actions[clip.name] = a;
    }
    this.play('Idle', 0);
    this.root.scale.setScalar(0.001);
  }

  private play(name: string, fade = 0.25) {
    const next = this.actions[name];
    if (!next || next === this.current) return;
    next.reset();
    next.setEffectiveWeight(1);
    next.play();
    if (this.current) this.current.crossFadeTo(next, fade, false);
    this.current = next;
  }

  setProblem(p: Problem, values: number[], correctIndex: number) {
    this.problem = p;
    this.values = values;
    this.correctIndex = correctIndex;
    this.mistakes = 0;
    this.hintOn = false;
    this.drawBoard(LED_RED);
    this.drawPanels();
  }

  boardText(): string {
    return this.problem ? this.problem.text.replace(/ /g, '') + '=?' : '';
  }

  drawBoard(style: LedStyle) {
    drawLed(this.boardCanvas, this.boardText(), style, 0.16);
    ((this.board.material as THREE.MeshBasicMaterial).map as THREE.Texture).needsUpdate = true;
  }

  drawPanels(dim = false) {
    for (let i = 0; i < this.panels.length; i++) {
      const v = this.values[i];
      const style = dim ? LED_DIM : (this.hintOn && this.blink && i === this.correctIndex ? LED_GREEN : LED_RED);
      drawLed(this.canvases[i], v === undefined ? '' : String(v), style, 0.2);
      ((this.panels[i].material as THREE.MeshBasicMaterial).map as THREE.Texture).needsUpdate = true;
    }
  }

  /** Correct answer shot. Returns true when the robot powers down. */
  hitCorrect(): boolean {
    this.problemsLeft--;
    this.hitFlash = 0.25;
    if (this.problemsLeft <= 0) {
      this.powerDown();
      return true;
    }
    this.play('Hit', 0.05);
    return false;
  }

  hitWrong() {
    this.mistakes++;
    this.hitFlash = 0.12;
  }

  hitBody() {
    this.hitFlash = 0.08;
  }

  private powerDown() {
    this.state = 'down';
    this.stateT = 0;
    this.play('PowerDown', 0.1);
    this.drawBoard(LED_GREEN);
    this.drawPanels(true);
    for (let i = 0; i < this.panels.length; i++) this.panels[i].userData.panel = null;
  }

  isAlive() {
    return this.state === 'spawning' || this.state === 'walking' || this.state === 'attacking';
  }

  /** Returns 'zap' on the frame an attack lands. */
  update(dt: number, player: THREE.Vector3, camera: THREE.Camera, others: Robot[], nav?: Nav): 'zap' | 'gone' | null {
    this.t += dt;
    this.stateT += dt;
    this.mixer.update(dt);
    let ev: 'zap' | 'gone' | null = null;

    // glow pulse + hit flash
    const pulse = this.state === 'down' ? Math.max(0, 4 - this.stateT * 4) : 3.2 + Math.sin(this.t * 6) * 1.2;
    for (let i = 0; i < this.glowMats.length; i++) this.glowMats[i].emissiveIntensity = pulse;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    for (let i = 0; i < this.armorMats.length; i++) {
      const m = this.armorMats[i];
      m.emissive.setRGB(1, 1, 1);
      m.emissiveIntensity = this.hitFlash > 0 ? this.hitFlash * 6 : 0;
      if (this.state === 'down') m.color.lerp(new THREE.Color(0x151515), Math.min(1, dt * 1.5));
    }

    // board faces the camera (yaw only)
    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const bw = new THREE.Vector3();
    this.board.getWorldPosition(bw);
    const yaw = Math.atan2(camPos.x - bw.x, camPos.z - bw.z);
    this.board.rotation.y = yaw - this.root.rotation.y;
    const bs = this.targeted && this.isAlive() ? 1.18 : 1;
    this.board.scale.lerp(new THREE.Vector3(bs, bs, bs), Math.min(1, dt * 10));

    if (this.hintOn && this.isAlive()) {
      this.blinkT += dt;
      if (this.blinkT > 0.3) {
        this.blinkT = 0;
        this.blink = !this.blink;
        this.drawPanels();
      }
    }

    const toP = new THREE.Vector3(player.x - this.root.position.x, 0, player.z - this.root.position.z);
    const dist = toP.length();
    // face the player when close or busy; while walking they face their path
    if (this.isAlive() && !this.display && (this.state !== 'walking' || dist < 7)) {
      const targetYaw = Math.atan2(toP.x, toP.z);
      let dy = targetYaw - this.root.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.root.rotation.y += dy * Math.min(1, dt * 4);
    }

    if (this.state === 'spawning') {
      const k = Math.min(1, this.stateT / 0.7);
      const e = 1 - Math.pow(1 - k, 3);
      this.root.scale.set(e, e, e);
      this.root.position.y = this.hover * e;
      if (k >= 1) { this.state = 'walking'; this.stateT = 0; }
    } else if (this.state === 'walking' && this.display) {
      this.play('Idle');
    } else if (this.state === 'walking') {
      const stop = (this.hover ? 2.6 : 1.9) + this.spec.radius;
      if (this.hover) this.root.position.y = this.hover + Math.sin(this.t * 1.7) * 0.15;
      if (dist > stop) {
        const v = this.spec.speed * this.speedMul;
        let dir = toP.normalize();
        // ground robots walk around cover; flyers go over it
        if (nav && !this.hover) {
          dir = nav.steer(this.root.position, dir, this.spec.radius * 0.8);
          if (this.detour > 0) {
            this.detour -= dt;
            dir = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(this.id % 2 ? 1 : -1).add(dir.clone().multiplyScalar(0.3)).normalize();
          }
        }
        const before = this.root.position.clone();
        const move = dir.clone().multiplyScalar(v * dt);
        // separation from other robots
        for (let i = 0; i < others.length; i++) {
          const o = others[i];
          if (o === this || o.state === 'gone') continue;
          const d = new THREE.Vector3().subVectors(this.root.position, o.root.position);
          d.y = 0;
          const l = d.length();
          const min = this.spec.radius + o.spec.radius + 0.5;
          if (l > 0.001 && l < min) move.add(d.multiplyScalar(((min - l) / l) * dt * 2));
        }
        this.root.position.add(move);
        if (nav && !this.hover) nav.resolve(this.root.position, this.spec.radius);
        // stuck against cover: sidestep for a moment
        if (before.distanceTo(this.root.position) < v * dt * 0.25) {
          this.stuckT += dt;
          if (this.stuckT > 0.8) { this.detour = 1.2; this.stuckT = 0; }
        } else this.stuckT = 0;
        // face where we walk
        const fy = Math.atan2(dir.x, dir.z);
        let dyaw = fy - this.root.rotation.y;
        while (dyaw > Math.PI) dyaw -= Math.PI * 2;
        while (dyaw < -Math.PI) dyaw += Math.PI * 2;
        this.root.rotation.y += dyaw * Math.min(1, dt * 3);
        this.play('Walk');
        if (this.actions.Walk) this.actions.Walk.timeScale = Math.max(0.6, this.speedMul);
      } else {
        this.play('Idle');
        this.attackCd -= dt;
        if (this.attackCd <= 0) {
          this.state = 'attacking';
          this.stateT = 0;
          this.play('Attack', 0.1);
          this.zapPending = 0.5;
        }
      }
    } else if (this.state === 'attacking') {
      if (this.zapPending > 0) {
        this.zapPending -= dt;
        if (this.zapPending <= 0) ev = 'zap';
      }
      if (this.stateT > 1.15) {
        this.state = 'walking';
        this.stateT = 0;
        this.attackCd = 2.4;
        this.play('Idle');
      }
    } else if (this.state === 'down') {
      if (this.hover) this.root.position.y = Math.max(0, this.root.position.y - dt * 2.5);
      if (this.stateT > 2.4) {
        const k = Math.min(1, (this.stateT - 2.4) / 0.6);
        this.root.position.y = -k * 1.2 * this.spec.scale;
        this.board.visible = false;
        if (k >= 1) {
          this.state = 'gone';
          ev = 'gone';
        }
      }
    }
    return ev;
  }

  center(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.root.position).setY(this.root.position.y + (this.spec.proxyY as number) * 1.1);
  }

  dispose() {
    this.scene.remove(this.root);
    this.mixer.stopAllAction();
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.userData.panel !== undefined) {
        (m.material as THREE.MeshBasicMaterial).map?.dispose();
        (m.material as THREE.Material).dispose();
        m.geometry.dispose();
      }
    });
    (this.board.material as THREE.MeshBasicMaterial).map?.dispose();
  }
}
