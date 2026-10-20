import * as THREE from 'three';
import { Assets } from './assets';
import { createWorld, World, ARENA } from './world';
import { Robot, PanelHit, KINDS } from './Robot';
import { Fx } from './fx';
import { Sfx } from './audio';
import { makeProblem, distractors, shuffle } from '../math/problems';
import { EngineEvent, GameSettings, HudState, Op, RobotKind, WaveConfig } from '../types';

export interface HudRefs {
  crosshair: HTMLElement | null;
  damage: HTMLElement | null;
  radar: HTMLCanvasElement | null;
  arrows: HTMLElement | null;
}

export interface EngineOptions {
  ops: Op[];
  waves: WaveConfig[];
  settings: GameSettings;
  touch: boolean;
  reducedMotion: boolean;
  holoFormulas: string[];
  sfx: Sfx;
  hud: HudRefs;
  onHud: (s: HudState) => void;
  onEvent: (e: EngineEvent) => void;
  onLock: (locked: boolean) => void;
  onAnswer: (questionId: string, question: string, correct: boolean) => void;
}

const EYE = 1.65;
const KIND_DOT: { [k: string]: string } = { drone: '#30fff0', mech: '#ff3a2a', spider: '#ffa020' };

export class Engine {
  private w: World;
  private robots: Robot[] = [];
  private fx: Fx;
  private gun: THREE.Object3D;
  private muzzle: THREE.Object3D | null = null;
  private gunBase = new THREE.Vector3(0.2, -0.2, -0.42);
  private raf = 0;
  private last = 0;
  private time = 0;
  private yaw = 0;
  private pitch = 0;
  private pos = new THREE.Vector3(0, EYE, 15);
  private keys: { [k: string]: boolean } = {};
  private moveTouch = new THREE.Vector2();
  private paused = true;
  private attractMode = true;
  private ended = false;
  private locked = false;
  private freeAim = false;
  private aimNdc = new THREE.Vector2();
  private ray = new THREE.Raycaster();
  // gameplay
  private wave = 0;
  private queue: RobotKind[] = [];
  private spawnT = 0;
  private between = 0;
  private score = 0;
  private shield: number;
  private combo = 0;
  private ammo: number;
  private reloadT = 0;
  private fireCd = 0;
  private recoil = 0;
  private shake = 0;
  private dmgFlash = 0;
  private bob = 0;
  private stepT = 0;
  private shots = 0;
  private correct = 0;
  private answered = 0;
  private hudT = 0;
  private aimPanel: THREE.Mesh | null = null;
  private hitMarkT = 0;
  private bodyTipShown = false;
  private arrowEls: HTMLElement[] = [];
  private tmpV = new THREE.Vector3();
  private tmpV2 = new THREE.Vector3();
  private unsub: (() => void)[] = [];

  constructor(private container: HTMLElement, private assets: Assets, private o: EngineOptions) {
    this.w = createWorld(container, assets, o.touch, o.holoFormulas);
    this.fx = new Fx(this.w.scene, this.w.camera);
    this.shield = o.settings.shield;
    this.ammo = o.settings.magazine;

    this.gun = assets.blaster.scene.clone(true);
    this.gun.traverse((x) => {
      if (x.name === 'MUZZLE') this.muzzle = x;
      const m = x as THREE.Mesh;
      if (m.isMesh) {
        m.frustumCulled = false;
        m.renderOrder = 20;
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        m.material = mat;
        mat.envMapIntensity = 0.6;
        if (mat.name === 'GunBody' || mat.name === 'Glove') mat.color.multiplyScalar(0.55);
      }
    });
    this.gun.scale.setScalar(0.85);
    this.gun.position.copy(this.gunBase);
    this.gun.rotation.set(0.02, -0.06, 0);
    this.w.camera.add(this.gun);
    this.gun.visible = false;
    const gunLight = new THREE.PointLight(0xbfe8ff, 0.5, 1.5, 2);
    gunLight.position.set(0.1, 0.2, -0.2);
    this.w.camera.add(gunLight);

    this.setHud(o.hud);
    this.bind();
    this.onResize();
    this.attract();
    this.updateCamera(0);
    this.loop = this.loop.bind(this);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------------ input
  private bind() {
    const el = this.w.renderer.domElement;
    const on = (t: EventTarget, ev: string, fn: (e: any) => void, opts?: any) => {
      t.addEventListener(ev, fn, opts);
      this.unsub.push(() => t.removeEventListener(ev, fn, opts));
    };
    on(window, 'resize', () => this.onResize());
    on(window, 'keydown', (e: KeyboardEvent) => {
      if (this.paused || this.ended) return;
      const k = e.code;
      this.keys[k] = true;
      if (k === 'Space' || k === 'Enter') { this.fire(this.centerNdc()); e.preventDefault(); }
      if (k === 'KeyR') this.startReload();
      if (k === 'Tab') { this.cycleAim(e.shiftKey ? -1 : 1); e.preventDefault(); }
      if (k.indexOf('Arrow') === 0) e.preventDefault();
    });
    on(window, 'keyup', (e: KeyboardEvent) => { this.keys[e.code] = false; });
    on(window, 'blur', () => { this.keys = {}; });
    if (!this.o.touch) {
      on(el, 'mousedown', (e: MouseEvent) => {
        if (this.paused || this.ended || e.button !== 0) return;
        this.o.sfx.unlock();
        if (!this.locked && !this.freeAim) {
          this.requestLock();
          return;
        }
        this.fire(this.locked ? this.centerNdc() : this.aimNdc.clone());
      });
      on(document, 'mousemove', (e: MouseEvent) => {
        if (this.paused || this.ended) return;
        if (this.locked) {
          this.yaw -= e.movementX * 0.0022;
          this.pitch -= e.movementY * 0.0022;
          this.aimPanel = null;
        } else if (this.freeAim) {
          const r = el.getBoundingClientRect();
          this.aimNdc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        }
      });
      on(document, 'pointerlockchange', () => {
        const was = this.locked;
        this.locked = document.pointerLockElement === el;
        this.o.onLock(this.locked || this.freeAim);
        if (was && !this.locked && !this.ended) this.o.onEvent({ type: 'lockLost' });
      });
      on(document, 'pointerlockerror', () => {
        // inside a sandboxed frame: aim with the cursor instead
        this.freeAim = true;
        this.o.onLock(true);
      });
    }
  }

  requestLock() {
    const el = this.w.renderer.domElement as any;
    if (this.o.touch) return;
    try {
      const p = el.requestPointerLock && el.requestPointerLock();
      if (p && typeof p.catch === 'function') p.catch(() => { this.freeAim = true; this.o.onLock(true); });
    } catch (e) {
      this.freeAim = true;
      this.o.onLock(true);
    }
  }

  /** The React HUD mounts after the engine: hand over its elements. */
  setHud(h: HudRefs) {
    this.o.hud = h;
    if (h.arrows && !this.arrowEls.length) {
      for (let i = 0; i < 8; i++) {
        const a = document.createElement('div');
        a.className = 'msb-arrow';
        a.style.display = 'none';
        h.arrows.appendChild(a);
        this.arrowEls.push(a);
      }
    }
  }

  isAttract() {
    return this.attractMode;
  }

  /** Touch: joystick vector (-1..1) */
  setMove(x: number, y: number) {
    this.moveTouch.set(x, y);
  }

  /** Touch: drag to look (pixels) */
  look(dx: number, dy: number) {
    this.yaw -= dx * 0.0042;
    this.pitch -= dy * 0.0042;
    this.aimPanel = null;
  }

  /** Touch: tap a point of the screen to shoot there */
  fireAtScreen(clientX: number, clientY: number) {
    const r = this.w.renderer.domElement.getBoundingClientRect();
    this.fire(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1));
  }

  fireCenter() {
    this.fire(this.centerNdc());
  }

  private centerNdc() {
    return new THREE.Vector2(0, 0);
  }

  // ------------------------------------------------------------------ lifecycle
  /** Title screen: three robots lined up like the key art, camera drifting. */
  private attract() {
    const line: [RobotKind, number, number][] = [['drone', -1.7, 11.2], ['mech', 0, 10.4], ['drone', 1.7, 11.2]];
    for (let i = 0; i < line.length; i++) {
      const r = new Robot(line[i][0], this.assets[line[i][0]], this.w.scene, new THREE.Vector3(line[i][1], 0, line[i][2]));
      r.display = true;
      r.root.rotation.y = (-line[i][1]) * 0.08;
      this.wave = 1 + i;
      this.assignProblem(r);
      this.robots.push(r);
    }
    this.wave = 0;
  }

  start(ops?: Op[]) {
    if (ops && ops.length) this.o.ops = ops;
    for (let i = 0; i < this.robots.length; i++) this.robots[i].dispose();
    this.robots = [];
    this.attractMode = false;
    this.gun.visible = true;
    this.yaw = 0;
    this.pitch = 0;
    this.paused = false;
    this.o.sfx.unlock();
    this.o.sfx.startMusic();
    this.nextWave();
  }

  setPaused(p: boolean) {
    if (this.ended) return;
    this.paused = p;
    this.keys = {};
    if (p) {
      if (this.locked && document.exitPointerLock) document.exitPointerLock();
      this.o.sfx.suspend();
    } else {
      this.o.sfx.resume();
      this.last = performance.now();
    }
  }

  isLocked() {
    return this.locked || this.freeAim || this.o.touch;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    for (let i = 0; i < this.unsub.length; i++) this.unsub[i]();
    if (this.locked && document.exitPointerLock) document.exitPointerLock();
    for (let i = 0; i < this.robots.length; i++) this.robots[i].dispose();
    this.o.sfx.stopMusic();
    if (this.o.hud.arrows) this.o.hud.arrows.innerHTML = '';
    this.w.camera.remove(this.gun);
    this.w.dispose();
  }

  private onResize() {
    const r = this.container.getBoundingClientRect();
    this.w.resize(Math.max(1, r.width), Math.max(1, r.height));
    // pull the weapon in on portrait screens so it stays visible
    const portrait = r.height > r.width;
    this.gunBase.set(portrait ? 0.12 : 0.21, portrait ? -0.24 : -0.23, portrait ? -0.5 : -0.4);
  }

  // ------------------------------------------------------------------ waves
  private nextWave() {
    this.wave++;
    const cfg = this.o.waves[this.wave - 1];
    if (!cfg) return;
    const q: RobotKind[] = [];
    for (let i = 0; i < cfg.drones; i++) q.push('drone');
    for (let i = 0; i < cfg.mechs; i++) q.push('mech');
    for (let i = 0; i < cfg.spiders; i++) q.push('spider');
    this.queue = shuffle(q);
    // first robot of a wave is always the easiest kind present
    this.queue.sort((a, b) => (a === 'drone' ? -1 : 0) - (b === 'drone' ? -1 : 0));
    this.spawnT = 1.5;
    this.o.sfx.waveStart();
    this.o.onEvent({ type: 'waveStart', wave: this.wave });
  }

  private spawn(kind: RobotKind) {
    const cfg = this.o.waves[this.wave - 1];
    const portals = this.w.portals;
    const p = portals[Math.floor(Math.random() * portals.length)].clone();
    p.x += (Math.random() - 0.5) * 0.6;
    const r = new Robot(kind, this.assets[kind], this.w.scene, p);
    r.speedMul = cfg ? cfg.speed : 1;
    this.assignProblem(r);
    this.robots.push(r);
    this.fx.ring(this.tmpV.copy(p).setY(1.2), new THREE.Color(KINDS[kind].glow), 2.4);
    this.fx.sparks(this.tmpV.copy(p).setY(1.0), new THREE.Color(KINDS[kind].glow), 40, 3, 0.7);
  }

  private assignProblem(r: Robot) {
    const p = makeProblem(this.o.ops, this.wave, r.spec.tier, this.o.settings.numbers);
    const n = r.panels.length;
    const vals = distractors(p, n - 1);
    const ci = Math.floor(Math.random() * n);
    vals.splice(ci, 0, p.answer);
    r.setProblem(p, vals, ci);
  }

  // ------------------------------------------------------------------ shooting
  private startReload() {
    if (this.reloadT > 0 || this.ammo === this.o.settings.magazine) return;
    this.reloadT = 1.1;
    this.o.sfx.reload();
  }

  private alivePanels(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (let i = 0; i < this.robots.length; i++) {
      const r = this.robots[i];
      if (r.state !== 'walking' && r.state !== 'attacking') continue;
      for (let j = 0; j < r.panels.length; j++) out.push(r.panels[j]);
    }
    return out;
  }

  private pickPanel(ndc: THREE.Vector2, tolerancePx: number): { panel: THREE.Mesh | null; point: THREE.Vector3; dist: number; proxy: Robot | null } {
    const cam = this.w.camera;
    this.ray.setFromCamera(ndc, cam);
    const panels = this.alivePanels();
    const ph = this.ray.intersectObjects(panels, false);
    const wh = this.ray.intersectObjects(this.w.colliders, false);
    const wallD = wh.length ? wh[0].distance : 999;
    if (ph.length && ph[0].distance < wallD) {
      return { panel: ph[0].object as THREE.Mesh, point: ph[0].point.clone(), dist: ph[0].distance, proxy: null };
    }
    // forgiving aim: nearest panel centre within a few pixels of the crosshair / tap
    const r = this.w.renderer.domElement.getBoundingClientRect();
    let best: THREE.Mesh | null = null;
    let bestD = tolerancePx;
    for (let i = 0; i < panels.length; i++) {
      panels[i].getWorldPosition(this.tmpV);
      const d3 = this.tmpV.distanceTo(cam.position);
      this.tmpV.project(cam);
      if (this.tmpV.z > 1) continue;
      const dx = (this.tmpV.x - ndc.x) * r.width / 2;
      const dy = (this.tmpV.y - ndc.y) * r.height / 2;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD && d3 < wallD) {
        bestD = d;
        best = panels[i];
      }
    }
    if (best) {
      const pt = new THREE.Vector3();
      best.getWorldPosition(pt);
      return { panel: best, point: pt, dist: pt.distanceTo(cam.position), proxy: null };
    }
    const proxies: THREE.Object3D[] = [];
    for (let i = 0; i < this.robots.length; i++) if (this.robots[i].isAlive()) proxies.push(this.robots[i].proxy);
    const bh = this.ray.intersectObjects(proxies, false);
    if (bh.length && bh[0].distance < wallD) {
      return { panel: null, point: bh[0].point.clone(), dist: bh[0].distance, proxy: bh[0].object.userData.robot as Robot };
    }
    const far = wh.length ? wh[0].point.clone() : this.ray.ray.at(60, new THREE.Vector3());
    return { panel: null, point: far, dist: wallD, proxy: null };
  }

  private fire(ndc: THREE.Vector2) {
    if (this.paused || this.ended || this.fireCd > 0) return;
    if (this.reloadT > 0) return;
    if (this.ammo <= 0) { this.startReload(); return; }
    this.ammo--;
    this.shots++;
    this.fireCd = 0.2;
    this.recoil = 1;
    this.o.sfx.shoot();
    this.w.scene.updateMatrixWorld();
    const muzzle = new THREE.Vector3();
    if (this.muzzle) this.muzzle.getWorldPosition(muzzle); else this.w.camera.getWorldPosition(muzzle);
    this.fx.lightFlash(muzzle, 0x66ddff, 18);
    this.fx.sparks(muzzle, new THREE.Color(0.4, 0.9, 1), 8, 1.5, 0.15, 0);
    const hit = this.pickPanel(ndc, this.o.touch ? 34 : 14);
    this.fx.tracer(muzzle, hit.point);
    if (hit.panel) {
      const info = hit.panel.userData.panel as PanelHit;
      if (info) this.resolveAnswer(info, hit.point);
    } else if (hit.proxy) {
      hit.proxy.hitBody();
      this.o.sfx.clank();
      this.fx.sparks(hit.point, new THREE.Color(1, 0.8, 0.5), 14, 3, 0.4);
      if (!this.bodyTipShown) { this.bodyTipShown = true; this.o.onEvent({ type: 'body' }); }
    } else {
      this.fx.sparks(hit.point, new THREE.Color(0.5, 0.9, 1), 10, 2.5, 0.35);
      this.fx.ring(hit.point, new THREE.Color(0.3, 0.8, 1), 0.35);
    }
    if (this.ammo <= 0) this.startReload();
  }

  private resolveAnswer(info: PanelHit, point: THREE.Vector3) {
    const r = info.robot;
    if (!r.problem) return;
    const p = r.problem;
    const picked = r.values[info.index];
    this.answered++;
    const qid = p.op + ':' + p.a + ':' + p.b;
    if (info.index === r.correctIndex) {
      this.correct++;
      this.combo = Math.min(5, this.combo + 1);
      const pts = r.spec.points * this.combo;
      this.score += pts;
      this.o.sfx.correct();
      this.hitMarkT = 0.25;
      this.fx.sparks(point, new THREE.Color(0.3, 1, 0.6), 46, 4.5, 0.8);
      this.fx.ring(point, new THREE.Color(0.3, 1, 0.6), 0.9);
      this.fx.floatText(this.tmpV.copy(point).setY(point.y + 0.4), '+' + pts, '#7dffb2');
      this.o.onEvent({ type: 'correct', problem: p.text, answer: p.answer, points: pts, combo: this.combo });
      this.o.onAnswer(qid, p.text, true);
      const down = r.hitCorrect();
      if (down) {
        this.o.sfx.powerDown();
        const c = r.center(this.tmpV);
        this.fx.sparks(c, new THREE.Color(KINDS[r.kind].glow), 120, 6, 1.4, 2);
        this.fx.sparks(c, new THREE.Color(1, 0.9, 0.6), 60, 8, 0.6, 1);
        this.fx.ring(this.tmpV2.copy(r.root.position).setY(0.05), new THREE.Color(KINDS[r.kind].glow).multiplyScalar(0.5), 3.2, true, 0.6);
        this.fx.lightFlash(c, KINDS[r.kind].glow, 60);
        this.shake = Math.max(this.shake, 0.25);
      } else {
        this.assignProblem(r);
      }
    } else {
      this.combo = 0;
      this.o.sfx.wrong();
      r.hitWrong();
      const hint = r.mistakes >= this.o.settings.hintAfterMistakes;
      if (hint) { r.hintOn = true; }
      this.fx.sparks(point, new THREE.Color(1, 0.2, 0.15), 24, 3, 0.5);
      this.fx.floatText(this.tmpV.copy(point).setY(point.y + 0.35), String(picked) + ' ✗', '#ff6a5a');
      this.damage(this.o.settings.wrongAnswerDamage, 0.6);
      this.o.onEvent({ type: 'wrong', problem: p.text, picked, hint });
      this.o.onAnswer(qid, p.text, false);
    }
  }

  private damage(cells: number, strength: number) {
    if (cells <= 0) return;
    this.shield = Math.max(0, this.shield - cells);
    this.dmgFlash = strength;
    if (!this.o.reducedMotion) this.shake = Math.max(this.shake, 0.35 * strength);
    if (this.shield <= 0) this.finish(false);
  }

  private finish(victory: boolean) {
    if (this.ended) return;
    this.ended = true;
    this.o.sfx.stopMusic();
    if (victory) this.o.sfx.victory(); else this.o.sfx.defeat();
    if (this.locked && document.exitPointerLock) document.exitPointerLock();
    this.pushHud(true);
    this.o.onEvent({
      type: 'end', victory, score: this.score, wave: this.wave, correct: this.correct, shots: this.shots, answered: this.answered,
    });
  }

  /** Tab: jump the aim to the next answer panel (keyboard-only play). */
  private cycleAim(dir: number) {
    const panels = this.alivePanels();
    if (!panels.length) return;
    // order by robot distance, then left-to-right
    const cam = this.w.camera;
    const scored = panels.map((p) => {
      p.getWorldPosition(this.tmpV);
      const d = this.tmpV.distanceTo(cam.position);
      const v = this.tmpV.clone().project(cam);
      return { p, k: Math.round(d / 3) * 10 + v.x };
    });
    scored.sort((a, b) => a.k - b.k);
    let idx = -1;
    for (let i = 0; i < scored.length; i++) if (scored[i].p === this.aimPanel) idx = i;
    idx = (idx + dir + scored.length) % scored.length;
    this.aimPanel = scored[idx].p;
  }

  // ------------------------------------------------------------------ frame
  private loop(now: number) {
    this.raf = requestAnimationFrame(this.loop);
    let dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.attractMode) {
      this.time += dt;
      const pr = this.tmpV2.set(0, 0, 40);
      for (let i = 0; i < this.robots.length; i++) this.robots[i].update(dt, pr, this.w.camera, this.robots);
      this.fx.update(dt);
      this.yaw = Math.sin(this.time * 0.25) * 0.12;
      this.pitch = 0.06 + Math.sin(this.time * 0.17) * 0.03;
      this.w.ambience(dt, this.time);
      this.updateCamera(0);
      this.w.composer.render(dt);
      return;
    }
    if (this.paused) dt = 0;
    this.time += dt;
    if (dt > 0) this.update(dt);
    this.w.ambience(dt, this.time);
    this.updateCamera(dt);
    this.w.composer.render(dt);
  }

  private update(dt: number) {
    const s = this.o.settings;
    // movement
    if (!this.ended) {
      const k = this.keys;
      let mx = this.moveTouch.x;
      let mz = -this.moveTouch.y;
      if (k.KeyW || k.KeyZ) mz -= 1;
      if (k.KeyS) mz += 1;
      if (k.KeyA || k.KeyQ) mx -= 1;
      if (k.KeyD) mx += 1;
      if (k.ArrowLeft) { this.yaw += dt * 2.2; this.aimPanel = null; }
      if (k.ArrowRight) { this.yaw -= dt * 2.2; this.aimPanel = null; }
      if (k.ArrowUp) { this.pitch += dt * 1.4; this.aimPanel = null; }
      if (k.ArrowDown) { this.pitch -= dt * 1.4; this.aimPanel = null; }
      const len = Math.sqrt(mx * mx + mz * mz);
      if (len > 0.05) {
        const sp = 4.2 * Math.min(1, len) / Math.max(1, len);
        const sin = Math.sin(this.yaw);
        const cos = Math.cos(this.yaw);
        this.pos.x += (mx * cos + mz * sin) * sp * dt;
        this.pos.z += (-mx * sin + mz * cos) * sp * dt;
        this.bob += dt * 9 * Math.min(1, len);
        this.stepT -= dt;
        if (this.stepT <= 0) { this.stepT = 0.42; this.o.sfx.step1(); }
      }
      this.pos.x = Math.max(ARENA.minX, Math.min(ARENA.maxX, this.pos.x));
      this.pos.z = Math.max(ARENA.minZ, Math.min(ARENA.maxZ, this.pos.z));
      // robots are solid
      for (let i = 0; i < this.robots.length; i++) {
        const r = this.robots[i];
        if (!r.isAlive()) continue;
        const dx = this.pos.x - r.root.position.x;
        const dz = this.pos.z - r.root.position.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        const min = r.spec.radius + 0.5;
        if (d < min && d > 0.001) {
          this.pos.x = r.root.position.x + (dx / d) * min;
          this.pos.z = r.root.position.z + (dz / d) * min;
        }
      }
    }
    // keyboard aim assist
    if (this.aimPanel) {
      if (!this.aimPanel.userData.panel) this.aimPanel = null;
      else {
        this.aimPanel.getWorldPosition(this.tmpV);
        const d = this.tmpV.sub(this.pos);
        const ty = Math.atan2(-d.x, -d.z);
        const tp = Math.atan2(d.y, Math.sqrt(d.x * d.x + d.z * d.z));
        let dy = ty - this.yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        this.yaw += dy * Math.min(1, dt * 12);
        this.pitch += (tp - this.pitch) * Math.min(1, dt * 12);
      }
    }
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));

    // weapon timers
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.ammo = s.magazine;
    }
    this.recoil = Math.max(0, this.recoil - dt * 7);
    this.shake = Math.max(0, this.shake - dt * 1.4);
    this.dmgFlash = Math.max(0, this.dmgFlash - dt * 1.6);
    this.hitMarkT = Math.max(0, this.hitMarkT - dt);

    // waves
    if (!this.ended && this.wave > 0) {
      const cfg = this.o.waves[this.wave - 1];
      let active = 0;
      for (let i = 0; i < this.robots.length; i++) if (this.robots[i].isAlive()) active++;
      if (this.queue.length) {
        this.spawnT -= dt;
        if (this.spawnT <= 0 && active < (cfg ? cfg.maxActive : 3)) {
          this.spawn(this.queue.shift() as RobotKind);
          this.spawnT = 1.4 + Math.random() * 1.4;
        }
      } else if (active === 0 && this.between <= 0) {
        this.between = 3.2;
        this.shield = Math.min(s.shield, this.shield + s.waveHeal);
        this.score += 250 * this.wave;
        this.o.sfx.waveClear();
        this.o.onEvent({ type: 'waveCleared', wave: this.wave });
      }
      if (this.between > 0) {
        this.between -= dt;
        if (this.between <= 0) {
          if (this.wave >= this.o.waves.length) this.finish(true);
          else this.nextWave();
        }
      }
    }

    // robots
    const playerFlat = this.tmpV2.set(this.pos.x, 0, this.pos.z);
    for (let i = this.robots.length - 1; i >= 0; i--) {
      const r = this.robots[i];
      const ev = r.update(dt, playerFlat, this.w.camera, this.robots);
      if (ev === 'zap' && !this.ended) {
        this.o.sfx.zap();
        this.combo = 0;
        const c = r.center(this.tmpV);
        this.fx.tracer(c, this.w.camera.position, new THREE.Color(3, 0.4, 0.2));
        this.fx.sparks(this.tmpV.lerp(this.w.camera.position, 0.8), new THREE.Color(1, 0.3, 0.2), 30, 2, 0.4);
        this.o.onEvent({ type: 'zapped' });
        this.damage(s.robotZapDamage, 1);
      }
      if (ev === 'gone') {
        const c = r.center(this.tmpV);
        this.fx.sparks(c.setY(0.4), new THREE.Color(0.6, 0.9, 1), 50, 3, 0.8);
        r.dispose();
        this.robots.splice(i, 1);
      }
    }
    this.fx.update(dt);
    this.pushHud(false, dt);
  }

  private updateCamera(dt: number) {
    const cam = this.w.camera;
    const motion = this.o.reducedMotion ? 0 : 1;
    const bobY = Math.sin(this.bob) * 0.035 * motion;
    const bobX = Math.cos(this.bob * 0.5) * 0.025 * motion;
    const sh = this.shake * motion;
    cam.position.set(this.pos.x + (Math.random() - 0.5) * sh * 0.15, this.pos.y + bobY + (Math.random() - 0.5) * sh * 0.15, this.pos.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch + this.recoil * 0.025 * (motion ? 1 : 0.3);
    cam.rotation.z = (Math.random() - 0.5) * sh * 0.04;
    // weapon sway, recoil and reload dip
    const reloadDip = this.reloadT > 0 ? Math.sin(Math.min(1, (1.1 - this.reloadT) / 1.1) * Math.PI) : 0;
    this.gun.position.set(
      this.gunBase.x + bobX * 0.6,
      this.gunBase.y + bobY * 0.5 - reloadDip * 0.18,
      this.gunBase.z + this.recoil * 0.07,
    );
    this.gun.rotation.set(0.02 + this.recoil * 0.18 - reloadDip * 0.6, -0.06, reloadDip * 0.4);
    // post effects react to damage
    const ca = 0.0006 + this.dmgFlash * 0.006;
    this.w.chroma.offset.set(ca, ca);
    if (this.o.hud.damage) this.o.hud.damage.style.opacity = String(Math.min(0.85, this.dmgFlash));
    if (dt === 0 && !this.paused) return;
    this.updateCrosshair();
    this.drawRadar();
    this.drawArrows();
  }

  private updateCrosshair() {
    const el = this.o.hud.crosshair;
    if (!el) return;
    const cam = this.w.camera;
    cam.updateMatrixWorld();
    const ndc = this.freeAim ? this.aimNdc : this.centerNdc();
    let target: Robot | null = null;
    let onPanel = false;
    if (!this.paused && !this.ended) {
      const h = this.pickPanel(ndc, this.o.touch ? 0 : 14);
      if (h.panel && h.panel.userData.panel) {
        onPanel = true;
        target = (h.panel.userData.panel as PanelHit).robot;
      } else if (h.proxy) target = h.proxy;
    }
    for (let i = 0; i < this.robots.length; i++) this.robots[i].targeted = this.robots[i] === target;
    const cls = 'msb-cross' + (onPanel ? ' on' : '') + (this.recoil > 0.5 ? ' kick' : '') + (this.hitMarkT > 0 ? ' hit' : '');
    if (el.className !== cls) el.className = cls;
    if (this.freeAim && !this.o.touch) {
      const r = this.w.renderer.domElement.getBoundingClientRect();
      el.style.left = ((this.aimNdc.x + 1) / 2) * r.width + 'px';
      el.style.top = ((1 - this.aimNdc.y) / 2) * r.height + 'px';
    } else {
      el.style.left = '50%';
      el.style.top = '50%';
    }
  }

  private drawRadar() {
    const c = this.o.hud.radar;
    if (!c) return;
    const g = c.getContext('2d');
    if (!g) return;
    const S = c.width;
    const R = S / 2;
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath();
    g.arc(R, R, R - 2, 0, Math.PI * 2);
    g.clip();
    const grd = g.createRadialGradient(R, R, 0, R, R, R);
    grd.addColorStop(0, 'rgba(20,160,220,0.55)');
    grd.addColorStop(1, 'rgba(5,40,70,0.75)');
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(120,230,255,0.35)';
    g.lineWidth = 1;
    for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(R, R, (R * i) / 3, 0, Math.PI * 2); g.stroke(); }
    // sweep
    const a = this.time * 2.2;
    g.fillStyle = 'rgba(140,240,255,0.18)';
    g.beginPath(); g.moveTo(R, R); g.arc(R, R, R, a, a + 0.5); g.closePath(); g.fill();
    const range = 26;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    for (let i = 0; i < this.robots.length; i++) {
      const r = this.robots[i];
      if (r.state === 'gone') continue;
      const dx = r.root.position.x - this.pos.x;
      const dz = r.root.position.z - this.pos.z;
      // rotate into view space: forward is up
      const vx = dx * cos - dz * sin;
      const vz = dx * sin + dz * cos;
      const px = R + (vx / range) * R;
      const py = R + (vz / range) * R;
      g.fillStyle = r.isAlive() ? KIND_DOT[r.kind] : 'rgba(120,120,120,0.6)';
      g.shadowColor = g.fillStyle as string;
      g.shadowBlur = 8;
      g.beginPath(); g.arc(px, py, r.kind === 'mech' ? 5 : 4, 0, Math.PI * 2); g.fill();
    }
    g.shadowBlur = 0;
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(R, R - 7); g.lineTo(R - 5, R + 5); g.lineTo(R + 5, R + 5); g.closePath(); g.fill();
    g.restore();
  }

  private drawArrows() {
    if (!this.arrowEls.length) return;
    const cam = this.w.camera;
    const r = this.w.renderer.domElement.getBoundingClientRect();
    let n = 0;
    for (let i = 0; i < this.robots.length && n < this.arrowEls.length; i++) {
      const rb = this.robots[i];
      if (!rb.isAlive() || this.paused || this.ended) continue;
      rb.center(this.tmpV);
      this.tmpV.project(cam);
      const behind = this.tmpV.z > 1;
      let x = this.tmpV.x;
      let y = this.tmpV.y;
      if (!behind && Math.abs(x) < 0.95 && Math.abs(y) < 0.95) continue;
      if (behind) { x = -x; y = -y; }
      const ang = Math.atan2(y, x);
      const m = Math.max(Math.abs(x), Math.abs(y)) || 1;
      x /= m; y /= m;
      const el = this.arrowEls[n++];
      el.style.display = 'block';
      el.style.left = ((x * 0.9 + 1) / 2) * r.width + 'px';
      el.style.top = ((1 - y * 0.85) / 2) * r.height + 'px';
      el.style.transform = 'translate(-50%,-50%) rotate(' + (-ang) + 'rad)';
      el.style.color = KIND_DOT[rb.kind];
    }
    for (let i = n; i < this.arrowEls.length; i++) this.arrowEls[i].style.display = 'none';
  }

  private pushHud(force: boolean, dt = 0) {
    this.hudT -= dt;
    if (!force && this.hudT > 0) return;
    this.hudT = 0.1;
    let left = this.queue.length;
    for (let i = 0; i < this.robots.length; i++) if (this.robots[i].isAlive()) left++;
    this.o.onHud({
      wave: this.wave, waves: this.o.waves.length, robotsLeft: left, score: this.score, shield: this.shield,
      maxShield: this.o.settings.shield, combo: this.combo, ammo: this.ammo, magazine: this.o.settings.magazine,
      reloading: this.reloadT > 0, locked: this.isLocked(),
    });
  }
}
