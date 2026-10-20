import * as THREE from 'three';
import { Assets } from './assets';
import { createWorld, World } from './world';
import { Robot, PanelHit, KINDS } from './Robot';
import { Fx } from './fx';
import { Sfx } from './audio';
import { WeaponRig } from './weapons';
import { Loot } from './loot';
import { planWave } from './waves';
import { makeProblem, distractors } from '../math/problems';
import {
  EndlessConfig, EngineEvent, GameSettings, HudState, LootConfig, Op, RobotKind, UpgradeConfig, UpgradeId, WavePlan,
  WeaponConfig,
} from '../types';

export interface HudRefs {
  crosshair: HTMLElement | null;
  damage: HTMLElement | null;
  radar: HTMLCanvasElement | null;
  arrows: HTMLElement | null;
}

export interface EngineOptions {
  ops: Op[];
  endless: EndlessConfig;
  settings: GameSettings;
  weapons: WeaponConfig[];
  upgrades: UpgradeConfig[];
  loot: LootConfig;
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

type Phase = 'attract' | 'intermission' | 'play' | 'ended';

const EYE = 1.65;
const KIND_DOT: { [k: string]: string } = { drone: '#30fff0', mech: '#ff3a2a', spider: '#ffa020', scout: '#d070ff', titan: '#ffd040' };
const LONG_SHOT = 25;

export class Engine {
  private w: World;
  private robots: Robot[] = [];
  private fx: Fx;
  private loot: Loot;
  private rig: WeaponRig;
  private raf = 0;
  private last = 0;
  private time = 0;
  private yaw = 0;
  private pitch = 0;
  private pos = new THREE.Vector3(0, EYE, 0);
  private keys: { [k: string]: boolean } = {};
  private moveTouch = new THREE.Vector2();
  private paused = false;
  private phase: Phase = 'attract';
  private locked = false;
  private freeAim = false;
  private aimNdc = new THREE.Vector2();
  private ray = new THREE.Raycaster();
  // run state
  private wave = 0;
  private plan: WavePlan | null = null;
  private queue: RobotKind[] = [];
  private spawnT = 0;
  private between = 0;
  private score = 0;
  private cores = 0;
  private shield: number;
  private combo = 0;
  private unlocked: string[] = [];
  private levels: { [id: string]: number } = {};
  private ammo: { [id: string]: number } = {};
  private weapon = '';
  private reloadT = 0;
  private reloadMax = 1;
  private fireCd = 0;
  private trigger = false;
  private zoomWanted = false;
  private zoom = 0;
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
    this.loot = new Loot(this.w.scene);
    this.rig = new WeaponRig(this.w.camera, assets.weapons, o.weapons);
    this.rig.root.visible = false;
    this.shield = o.settings.shield;
    const start = this.w.meta.player;
    this.pos.set(start[0], EYE, start[1]);
    for (let i = 0; i < o.weapons.length; i++) {
      const wc = o.weapons[i];
      if (wc.cost <= 0 && this.rig.has(wc.id)) this.unlocked.push(wc.id);
    }
    if (!this.unlocked.length && o.weapons.length) this.unlocked.push(o.weapons[0].id);
    for (let i = 0; i < o.weapons.length; i++) this.ammo[o.weapons[i].id] = this.magazineOf(o.weapons[i]);
    this.equip(this.unlocked[0], true);

    this.setHud(o.hud);
    this.bind();
    this.onResize();
    this.attract();
    this.updateCamera(0);
    this.loop = this.loop.bind(this);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------------ config helpers
  private cfg(id = this.weapon): WeaponConfig {
    for (let i = 0; i < this.o.weapons.length; i++) if (this.o.weapons[i].id === id) return this.o.weapons[i];
    return this.o.weapons[0];
  }

  private level(id: UpgradeId) {
    return this.levels[id] || 0;
  }

  private magazineOf(wc: WeaponConfig) {
    return Math.max(1, Math.round(wc.magazine * (1 + 0.3 * this.level('magazine'))));
  }

  private maxShield() {
    return this.o.settings.shield + this.level('shield');
  }

  private hintAfter() {
    return this.level('scanner') > 0 ? 1 : this.o.settings.hintAfterMistakes;
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
      if (!this.playing()) return;
      const k = e.code;
      this.keys[k] = true;
      if (k === 'Space' || k === 'Enter') { this.trigger = true; this.fire(this.aimPoint()); e.preventDefault(); }
      if (k === 'KeyR') this.startReload();
      if (k === 'KeyF') this.toggleZoom();
      if (k === 'Tab') { this.cycleAim(e.shiftKey ? -1 : 1); e.preventDefault(); }
      if (k.indexOf('Digit') === 0) {
        const n = parseInt(k.slice(5), 10) - 1;
        if (this.o.weapons[n]) this.selectWeapon(this.o.weapons[n].id);
      }
      if (k.indexOf('Arrow') === 0) e.preventDefault();
    });
    on(window, 'keyup', (e: KeyboardEvent) => {
      this.keys[e.code] = false;
      if (e.code === 'Space' || e.code === 'Enter') this.trigger = false;
    });
    on(window, 'blur', () => { this.keys = {}; this.trigger = false; });
    if (!this.o.touch) {
      on(el, 'mousedown', (e: MouseEvent) => {
        if (!this.playing()) return;
        this.o.sfx.unlock();
        if (!this.locked && !this.freeAim) { this.requestLock(); return; }
        if (e.button === 2) { this.zoomWanted = true; return; }
        if (e.button !== 0) return;
        this.trigger = true;
        this.fire(this.aimPoint());
      });
      on(window, 'mouseup', (e: MouseEvent) => {
        if (e.button === 2) this.zoomWanted = false;
        if (e.button === 0) this.trigger = false;
      });
      on(el, 'wheel', (e: WheelEvent) => {
        if (!this.playing()) return;
        this.cycleWeapon(e.deltaY > 0 ? 1 : -1);
      }, { passive: true });
      on(document, 'mousemove', (e: MouseEvent) => {
        if (!this.playing()) return;
        if (this.locked) {
          const sens = 0.0022 * (this.w.camera.fov / this.w.baseFov());
          this.yaw -= e.movementX * sens;
          this.pitch -= e.movementY * sens;
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
        if (was && !this.locked && this.phase === 'play') this.o.onEvent({ type: 'lockLost' });
      });
      on(document, 'pointerlockerror', () => {
        // inside a sandboxed frame: aim with the cursor instead
        this.freeAim = true;
        this.o.onLock(true);
      });
    }
  }

  private playing() {
    return this.phase === 'play' && !this.paused;
  }

  private aimPoint() {
    return this.freeAim && !this.o.touch ? this.aimNdc.clone() : new THREE.Vector2(0, 0);
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
    return this.phase === 'attract';
  }

  setMove(x: number, y: number) {
    this.moveTouch.set(x, y);
  }

  look(dx: number, dy: number) {
    const sens = 0.0042 * (this.w.camera.fov / this.w.baseFov());
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    this.aimPanel = null;
  }

  fireAtScreen(clientX: number, clientY: number) {
    const r = this.w.renderer.domElement.getBoundingClientRect();
    this.fire(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1));
  }

  fireCenter() {
    this.fire(new THREE.Vector2(0, 0));
  }

  /** Touch: FIRE button held (automatic weapons keep firing). */
  setTrigger(down: boolean) {
    this.trigger = down;
    if (down) this.fireCenter();
  }

  toggleZoom() {
    if (this.cfg().zoomFov > 0) {
      this.zoomWanted = !this.zoomWanted;
      this.o.sfx.ui();
    }
  }

  selectWeapon(id: string) {
    if (this.unlocked.indexOf(id) < 0 || id === this.weapon) return;
    this.equip(id, false);
  }

  cycleWeapon(dir: number) {
    if (this.unlocked.length < 2) return;
    const order = this.o.weapons.map((w) => w.id).filter((id) => this.unlocked.indexOf(id) >= 0);
    const i = order.indexOf(this.weapon);
    this.selectWeapon(order[(i + dir + order.length) % order.length]);
  }

  private equip(id: string, now: boolean) {
    this.weapon = id;
    this.rig.select(id, now);
    this.reloadT = 0;
    this.zoomWanted = false;
    this.fireCd = now ? 0 : 0.36;
    if (!now) this.o.sfx.reload();
    this.pushHud(true);
  }

  // ------------------------------------------------------------------ shop
  /** Price of the next level of an upgrade, or of unlocking a weapon; -1 when maxed / owned. */
  price(kind: 'weapon' | 'upgrade', id: string): number {
    if (kind === 'weapon') {
      if (this.unlocked.indexOf(id) >= 0) return -1;
      return this.cfg(id).cost;
    }
    const u = this.o.upgrades.filter((x) => x.id === id)[0];
    if (!u) return -1;
    const lvl = this.level(id as UpgradeId);
    if (u.maxLevel > 0 && lvl >= u.maxLevel) return -1;
    if (id === 'repair' && this.shield >= this.maxShield()) return -1;
    return Math.round(u.cost * Math.pow(u.costGrowth || 1, lvl));
  }

  buy(kind: 'weapon' | 'upgrade', id: string): boolean {
    const p = this.price(kind, id);
    if (p < 0 || p > this.cores) return false;
    this.cores -= p;
    if (kind === 'weapon') {
      this.unlocked.push(id);
      this.equip(id, true);
    } else if (id === 'repair') {
      this.shield = this.maxShield();
    } else {
      this.levels[id] = this.level(id as UpgradeId) + 1;
      if (id === 'shield') this.shield = Math.min(this.maxShield(), this.shield + 1);
      if (id === 'magazine') for (let i = 0; i < this.o.weapons.length; i++) this.ammo[this.o.weapons[i].id] = this.magazineOf(this.o.weapons[i]);
    }
    this.o.sfx.correct();
    this.pushHud(true);
    return true;
  }

  // ------------------------------------------------------------------ lifecycle
  /** Title screen: three robots lined up like the key art, camera drifting. */
  private attract() {
    const px = this.pos.x;
    const pz = this.pos.z;
    const line: [RobotKind, number, number][] = [['drone', -1.8, -3.8], ['titan', 0, -5.2], ['scout', 1.9, -3.9]];
    for (let i = 0; i < line.length; i++) {
      const k = line[i][0];
      const r = new Robot(k, this.assets[k], this.w.scene, new THREE.Vector3(px + line[i][1], 0, pz + line[i][2]));
      r.display = true;
      r.state = 'walking';
      r.root.scale.setScalar(1);
      r.root.rotation.y = -line[i][1] * 0.08;
      this.wave = 1 + i;
      this.assignProblem(r);
      this.robots.push(r);
    }
    this.wave = 0;
  }

  /** Begin a run: clears the showcase and opens the briefing (intermission before wave 1). */
  start(ops?: Op[]) {
    if (ops && ops.length) this.o.ops = ops;
    for (let i = 0; i < this.robots.length; i++) this.robots[i].dispose();
    this.robots = [];
    this.rig.root.visible = true;
    this.yaw = 0;
    this.pitch = 0;
    this.o.sfx.unlock();
    this.o.sfx.startMusic();
    this.phase = 'intermission';
    this.pushHud(true);
    this.o.onEvent({ type: 'intermission', wave: 0 });
  }

  /** Leave the shop / lesson and send the next wave. */
  nextWave() {
    if (this.phase !== 'intermission') return;
    this.phase = 'play';
    this.paused = false;
    this.last = performance.now();
    this.wave++;
    this.plan = planWave(this.wave, this.o.endless);
    this.queue = this.plan.robots.slice();
    this.spawnT = 1.2;
    this.between = 0;
    this.o.sfx.waveStart();
    this.o.onEvent({ type: 'waveStart', wave: this.wave, boss: this.plan.boss });
    if (!this.o.touch) this.requestLock();
  }

  endRun() {
    this.finish();
  }

  setPaused(p: boolean) {
    if (this.phase === 'ended') return;
    this.paused = p;
    this.keys = {};
    this.trigger = false;
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
    this.w.dispose();
  }

  private onResize() {
    const r = this.container.getBoundingClientRect();
    this.w.resize(Math.max(1, r.width), Math.max(1, r.height));
    this.rig.portrait = r.height > r.width;
  }

  // ------------------------------------------------------------------ waves
  private spawn(kind: RobotKind) {
    const sp = this.w.meta.spawns;
    // the three nearest portals that are not right next to the player: robots arrive quickly, from several sides
    const dist = (s: [number, number]) => Math.hypot(s[0] - this.pos.x, s[1] - this.pos.z);
    const far = sp.filter((s) => dist(s) > 18).sort((a, b) => dist(a) - dist(b)).slice(0, 3);
    const pool = far.length ? far : sp;
    const s = pool[Math.floor(Math.random() * pool.length)];
    const p = new THREE.Vector3(s[0] + (Math.random() - 0.5) * 0.8, 0, s[1] + (Math.random() - 0.5) * 0.8);
    const r = new Robot(kind, this.assets[kind], this.w.scene, p);
    r.speedMul = this.plan ? this.plan.speed : 1;
    this.assignProblem(r);
    this.robots.push(r);
    this.fx.ring(this.tmpV.copy(p).setY(1.4), new THREE.Color(KINDS[kind].glow), kind === 'titan' ? 4 : 2.4);
    this.fx.sparks(this.tmpV.copy(p).setY(1.0), new THREE.Color(KINDS[kind].glow), 40, 3, 0.7);
  }

  private assignProblem(r: Robot) {
    const p = makeProblem(this.o.ops, Math.max(1, this.wave), r.spec.tier, this.o.settings.numbers);
    const n = r.panels.length;
    const vals = distractors(p, n - 1);
    const ci = Math.floor(Math.random() * n);
    vals.splice(ci, 0, p.answer);
    r.setProblem(p, vals, ci);
  }

  // ------------------------------------------------------------------ shooting
  private startReload() {
    const mag = this.magazineOf(this.cfg());
    if (this.reloadT > 0 || this.ammo[this.weapon] >= mag) return;
    this.reloadMax = this.cfg().reload * Math.max(0.4, 1 - 0.18 * this.level('reload'));
    this.reloadT = this.reloadMax;
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
    // forgiving aim: nearest visible panel centre within a few pixels of the crosshair / tap
    const r = this.w.renderer.domElement.getBoundingClientRect();
    let best: THREE.Mesh | null = null;
    let bestD = tolerancePx;
    const camPos = cam.getWorldPosition(this.tmpV2);
    for (let i = 0; i < panels.length; i++) {
      panels[i].getWorldPosition(this.tmpV);
      const d3 = this.tmpV.distanceTo(camPos);
      if (!this.w.clearLine(camPos, this.tmpV)) continue;
      this.tmpV.project(cam);
      if (this.tmpV.z > 1) continue;
      const dx = (this.tmpV.x - ndc.x) * r.width / 2;
      const dy = (this.tmpV.y - ndc.y) * r.height / 2;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD && d3 < wallD + 1) {
        bestD = d;
        best = panels[i];
      }
    }
    if (best) {
      const pt = new THREE.Vector3();
      best.getWorldPosition(pt);
      return { panel: best, point: pt, dist: pt.distanceTo(camPos), proxy: null };
    }
    const proxies: THREE.Object3D[] = [];
    for (let i = 0; i < this.robots.length; i++) if (this.robots[i].isAlive()) proxies.push(this.robots[i].proxy);
    const bh = this.ray.intersectObjects(proxies, false);
    if (bh.length && bh[0].distance < wallD) {
      return { panel: null, point: bh[0].point.clone(), dist: bh[0].distance, proxy: bh[0].object.userData.robot as Robot };
    }
    const far = wh.length ? wh[0].point.clone() : this.ray.ray.at(80, new THREE.Vector3());
    return { panel: null, point: far, dist: wallD, proxy: null };
  }

  private fire(ndc: THREE.Vector2) {
    if (!this.playing() || this.fireCd > 0 || this.rig.switching()) return;
    if (this.reloadT > 0) return;
    const wc = this.cfg();
    if (this.ammo[this.weapon] <= 0) { this.startReload(); return; }
    this.ammo[this.weapon]--;
    this.shots++;
    this.fireCd = wc.fireRate;
    this.recoil = this.weapon === 'rifle' ? 0.6 : 1;
    this.o.sfx.shoot(this.weapon);
    this.w.scene.updateMatrixWorld();
    const muzzle = this.zoom > 0.85 ? this.w.camera.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -0.15, 0)) : this.rig.muzzleWorld(new THREE.Vector3());
    this.fx.lightFlash(muzzle, 0x66ddff, this.weapon === 'shotgun' ? 28 : 16);
    this.fx.sparks(muzzle, new THREE.Color(0.4, 0.9, 1), this.weapon === 'shotgun' ? 18 : 8, 1.5, 0.15, 0);
    const tolerance = (this.o.touch ? 1.6 : 1) * wc.aimAssistPx * (this.zoom > 0.5 ? 0.6 : 1);
    const hit = this.pickPanel(ndc, tolerance);
    this.fx.tracer(muzzle, hit.point);
    // scatter pellets are visual: the shot answers the screen nearest the crosshair
    for (let i = 1; i < wc.pellets; i++) {
      const spread = 0.6 + hit.dist * 0.04;
      this.fx.tracer(muzzle, hit.point.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)));
    }
    if (hit.panel) {
      const info = hit.panel.userData.panel as PanelHit;
      if (info) this.resolveAnswer(info, hit.point, hit.dist);
    } else if (hit.proxy) {
      hit.proxy.hitBody();
      this.o.sfx.clank();
      this.fx.sparks(hit.point, new THREE.Color(1, 0.8, 0.5), 14, 3, 0.4);
      if (!this.bodyTipShown) { this.bodyTipShown = true; this.o.onEvent({ type: 'body' }); }
    } else {
      this.fx.sparks(hit.point, new THREE.Color(0.5, 0.9, 1), 10, 2.5, 0.35);
      this.fx.ring(hit.point, new THREE.Color(0.3, 0.8, 1), 0.35);
    }
    if (this.ammo[this.weapon] <= 0) this.startReload();
    this.pushHud(true);
  }

  private resolveAnswer(info: PanelHit, point: THREE.Vector3, dist: number) {
    const r = info.robot;
    if (!r.problem) return;
    const p = r.problem;
    const picked = r.values[info.index];
    this.answered++;
    const qid = p.op + ':' + p.a + ':' + p.b;
    if (info.index === r.correctIndex) {
      this.correct++;
      this.combo = Math.min(5, this.combo + 1);
      const longShot = dist > LONG_SHOT;
      const pts = Math.round(r.spec.points * this.combo * (longShot ? 1.5 : 1));
      this.score += pts;
      this.o.sfx.correct();
      this.hitMarkT = 0.25;
      this.fx.sparks(point, new THREE.Color(0.3, 1, 0.6), 46, 4.5, 0.8);
      this.fx.ring(point, new THREE.Color(0.3, 1, 0.6), 0.9);
      this.fx.floatText(this.tmpV.copy(point).setY(point.y + 0.4), '+' + pts, longShot ? '#ffd84a' : '#7dffb2');
      this.o.onEvent({ type: 'correct', problem: p.text, answer: p.answer, points: pts, combo: this.combo, longShot });
      this.o.onAnswer(qid, p.text, true);
      const down = r.hitCorrect();
      if (down) {
        this.o.sfx.powerDown();
        const c = r.center(this.tmpV.clone());
        this.fx.sparks(c, new THREE.Color(KINDS[r.kind].glow), r.kind === 'titan' ? 260 : 120, 6, 1.4, 2);
        this.fx.sparks(c, new THREE.Color(1, 0.9, 0.6), 60, 8, 0.6, 1);
        this.fx.ring(this.tmpV2.copy(r.root.position).setY(0.05), new THREE.Color(KINDS[r.kind].glow).multiplyScalar(0.5), r.kind === 'titan' ? 6 : 3.2, true, 0.6);
        this.fx.lightFlash(c, KINDS[r.kind].glow, 60);
        this.shake = Math.max(this.shake, r.kind === 'titan' ? 0.6 : 0.25);
        this.dropLoot(r, c);
      } else {
        this.assignProblem(r);
      }
    } else {
      this.combo = 0;
      this.o.sfx.wrong();
      r.hitWrong();
      const hint = r.mistakes >= this.hintAfter();
      if (hint) r.hintOn = true;
      this.fx.sparks(point, new THREE.Color(1, 0.2, 0.15), 24, 3, 0.5);
      this.fx.floatText(this.tmpV.copy(point).setY(point.y + 0.35), String(picked) + ' ✗', '#ff6a5a');
      this.damage(this.o.settings.wrongAnswerDamage, 0.6);
      this.o.onEvent({ type: 'wrong', problem: p.text, picked, hint });
      this.o.onAnswer(qid, p.text, false);
    }
  }

  private dropLoot(r: Robot, at: THREE.Vector3) {
    const lc = this.o.loot;
    const amount = Math.max(1, Math.round((r.spec.points / 50) * lc.coresPerRobot));
    this.loot.drop(at, 'cores', amount, Math.min(6, amount));
    if (r.kind === 'titan' || Math.random() < lc.shieldChance) this.loot.drop(at, 'shield', 1, 1);
  }

  private damage(cells: number, strength: number) {
    if (cells <= 0) return;
    this.shield = Math.max(0, this.shield - cells);
    this.dmgFlash = strength;
    if (!this.o.reducedMotion) this.shake = Math.max(this.shake, 0.35 * strength);
    if (this.shield <= 0) this.finish();
  }

  private finish() {
    if (this.phase === 'ended') return;
    this.phase = 'ended';
    this.trigger = false;
    this.o.sfx.stopMusic();
    this.o.sfx.defeat();
    if (this.locked && document.exitPointerLock) document.exitPointerLock();
    this.pushHud(true);
    this.o.onEvent({ type: 'end', score: this.score, wave: this.wave, correct: this.correct, shots: this.shots, answered: this.answered });
  }

  /** Tab: jump the aim to the next answer panel (keyboard-only play). */
  private cycleAim(dir: number) {
    const panels = this.alivePanels();
    if (!panels.length) return;
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
    if (this.phase === 'attract' || this.phase === 'intermission') {
      this.time += dt;
      if (this.phase === 'attract') {
        const pr = this.tmpV2.set(this.pos.x, 0, this.pos.z + 40);
        for (let i = 0; i < this.robots.length; i++) this.robots[i].update(dt, pr, this.w.camera, this.robots);
        this.yaw = Math.sin(this.time * 0.25) * 0.12;
        this.pitch = 0.08 + Math.sin(this.time * 0.17) * 0.03;
      } else {
        // slow look-around behind the shop
        this.yaw += dt * 0.05;
        this.pitch += (0.02 - this.pitch) * Math.min(1, dt * 2);
        this.zoom = 0;
      }
      this.fx.update(dt);
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
    const active = this.phase === 'play';
    if (active) {
      const k = this.keys;
      let mx = this.moveTouch.x;
      let mz = -this.moveTouch.y;
      if (k.KeyW || k.KeyZ) mz -= 1;
      if (k.KeyS) mz += 1;
      if (k.KeyA || k.KeyQ) mx -= 1;
      if (k.KeyD) mx += 1;
      const turn = this.w.camera.fov / this.w.baseFov();
      if (k.ArrowLeft) { this.yaw += dt * 2.2 * turn; this.aimPanel = null; }
      if (k.ArrowRight) { this.yaw -= dt * 2.2 * turn; this.aimPanel = null; }
      if (k.ArrowUp) { this.pitch += dt * 1.4 * turn; this.aimPanel = null; }
      if (k.ArrowDown) { this.pitch -= dt * 1.4 * turn; this.aimPanel = null; }
      const len = Math.sqrt(mx * mx + mz * mz);
      if (len > 0.05) {
        const sp = (this.zoom > 0.5 ? 2.2 : 5.0) * Math.min(1, len) / Math.max(1, len);
        const sin = Math.sin(this.yaw);
        const cos = Math.cos(this.yaw);
        this.pos.x += (mx * cos + mz * sin) * sp * dt;
        this.pos.z += (-mx * sin + mz * cos) * sp * dt;
        this.bob += dt * 9 * Math.min(1, len);
        this.stepT -= dt;
        if (this.stepT <= 0) { this.stepT = 0.4; this.o.sfx.step1(); }
      }
      this.w.resolve(this.pos, 0.45);
      for (let i = 0; i < this.robots.length; i++) {
        const r = this.robots[i];
        if (!r.isAlive() || r.hover) continue;
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

    // weapon timers, automatic fire, zoom
    const wc = this.cfg();
    if (this.fireCd > 0) this.fireCd -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.ammo[this.weapon] = this.magazineOf(wc);
    }
    if (this.trigger && wc.auto && this.fireCd <= 0) this.fire(this.aimPoint());
    const zt = this.zoomWanted && wc.zoomFov > 0 && this.reloadT <= 0 ? 1 : 0;
    this.zoom += (zt - this.zoom) * Math.min(1, dt * 10);
    this.recoil = Math.max(0, this.recoil - dt * 7);
    this.shake = Math.max(0, this.shake - dt * 1.4);
    this.dmgFlash = Math.max(0, this.dmgFlash - dt * 1.6);
    this.hitMarkT = Math.max(0, this.hitMarkT - dt);

    // waves
    if (active && this.plan) {
      let alive = 0;
      for (let i = 0; i < this.robots.length; i++) if (this.robots[i].isAlive()) alive++;
      if (this.queue.length) {
        this.spawnT -= dt;
        if (this.spawnT <= 0 && alive < this.plan.maxActive) {
          this.spawn(this.queue.shift() as RobotKind);
          this.spawnT = 1.2 + Math.random() * 1.6;
        }
      } else if (alive === 0 && this.between <= 0) {
        this.between = 2.6;
        const bonus = 3 + this.wave;
        this.cores += bonus;
        this.score += 250 * this.wave;
        this.o.sfx.waveClear();
        this.o.onEvent({ type: 'waveCleared', wave: this.wave, bonus });
      }
      if (this.between > 0) {
        this.between -= dt;
        if (this.between <= 0) {
          this.plan = null;
          this.phase = 'intermission';
          this.trigger = false;
          this.zoomWanted = false;
          if (this.locked && document.exitPointerLock) document.exitPointerLock();
          this.pushHud(true);
          this.o.onEvent({ type: 'intermission', wave: this.wave });
        }
      }
    }

    // robots
    this.w.setFlowTarget(this.pos.x, this.pos.z);
    const playerFlat = this.tmpV2.set(this.pos.x, 0, this.pos.z);
    const nav = { steer: this.w.steer, resolve: this.w.resolve };
    for (let i = this.robots.length - 1; i >= 0; i--) {
      const r = this.robots[i];
      const ev = r.update(dt, playerFlat, this.w.camera, this.robots, nav);
      if (ev === 'zap' && this.phase === 'play') {
        this.o.sfx.zap();
        this.combo = 0;
        const c = r.center(this.tmpV);
        this.fx.tracer(c, this.w.camera.position, new THREE.Color(3, 0.4, 0.2));
        this.fx.sparks(this.tmpV.lerp(this.w.camera.position, 0.8), new THREE.Color(1, 0.3, 0.2), 30, 2, 0.4);
        this.o.onEvent({ type: 'zapped' });
        this.damage(r.kind === 'titan' ? s.robotZapDamage * 2 : s.robotZapDamage, 1);
      }
      if (ev === 'gone') {
        const c = r.center(this.tmpV);
        this.fx.sparks(c.setY(0.4), new THREE.Color(0.6, 0.9, 1), 50, 3, 0.8);
        r.dispose();
        this.robots.splice(i, 1);
      }
    }
    // loot flies to the player
    const got = this.loot.update(dt, this.pos);
    for (let i = 0; i < got.length; i++) {
      const g = got[i];
      if (g.kind === 'cores') this.cores += g.amount;
      else this.shield = Math.min(this.maxShield(), this.shield + g.amount);
      this.o.sfx.pickup(g.kind === 'shield');
      this.o.onEvent({ type: 'loot', kind: g.kind, amount: g.amount });
    }
    this.fx.update(dt);
    this.pushHud(false, dt);
  }

  private updateCamera(dt: number) {
    const cam = this.w.camera;
    const motion = this.o.reducedMotion ? 0 : 1;
    const bobY = Math.sin(this.bob) * 0.035 * motion * (1 - this.zoom);
    const bobX = Math.cos(this.bob * 0.5) * 0.025 * motion * (1 - this.zoom);
    const sh = this.shake * motion;
    cam.position.set(this.pos.x + (Math.random() - 0.5) * sh * 0.15, this.pos.y + bobY + (Math.random() - 0.5) * sh * 0.15, this.pos.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch + this.recoil * 0.025 * (motion ? 1 : 0.3) * (1 - this.zoom * 0.7);
    cam.rotation.z = (Math.random() - 0.5) * sh * 0.04;
    const zf = this.cfg().zoomFov || this.w.baseFov();
    const fov = this.w.baseFov() + (zf - this.w.baseFov()) * this.zoom;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const reloadDip = this.reloadT > 0 ? Math.sin(Math.min(1, (this.reloadMax - this.reloadT) / this.reloadMax) * Math.PI) : 0;
    this.rig.update(dt, bobX, bobY, this.recoil, reloadDip, this.zoom);
    if (this.w.chroma) {
      const ca = 0.0005 + this.dmgFlash * 0.006;
      this.w.chroma.offset.set(ca, ca);
    }
    if (this.o.hud.damage) this.o.hud.damage.style.opacity = String(Math.min(0.85, this.dmgFlash));
    if (this.phase !== 'play') return;
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
    const ndc = this.freeAim && !this.o.touch ? this.aimNdc : new THREE.Vector2(0, 0);
    let target: Robot | null = null;
    let onPanel = false;
    if (this.playing()) {
      const h = this.pickPanel(ndc, this.o.touch ? 0 : this.cfg().aimAssistPx);
      if (h.panel && h.panel.userData.panel) {
        onPanel = true;
        target = (h.panel.userData.panel as PanelHit).robot;
      } else if (h.proxy) target = h.proxy;
    }
    for (let i = 0; i < this.robots.length; i++) this.robots[i].targeted = this.robots[i] === target;
    const cls = 'msb-cross w-' + this.weapon + (onPanel ? ' on' : '') + (this.recoil > 0.5 ? ' kick' : '') + (this.hitMarkT > 0 ? ' hit' : '') + (this.zoom > 0.85 ? ' scoped' : '');
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
    const a = this.time * 2.2;
    g.fillStyle = 'rgba(140,240,255,0.18)';
    g.beginPath(); g.moveTo(R, R); g.arc(R, R, R, a, a + 0.5); g.closePath(); g.fill();
    const range = 45;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    for (let i = 0; i < this.robots.length; i++) {
      const r = this.robots[i];
      if (r.state === 'gone') continue;
      const dx = r.root.position.x - this.pos.x;
      const dz = r.root.position.z - this.pos.z;
      const vx = dx * cos - dz * sin;
      const vz = dx * sin + dz * cos;
      const l = Math.sqrt(vx * vx + vz * vz);
      const k = l > range ? range / l : 1;
      const px = R + ((vx * k) / range) * (R - 5);
      const py = R + ((vz * k) / range) * (R - 5);
      g.fillStyle = r.isAlive() ? KIND_DOT[r.kind] : 'rgba(120,120,120,0.6)';
      g.shadowColor = g.fillStyle as string;
      g.shadowBlur = 8;
      g.beginPath(); g.arc(px, py, r.kind === 'titan' ? 7 : r.kind === 'mech' ? 5 : 4, 0, Math.PI * 2); g.fill();
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
      if (!rb.isAlive() || !this.playing()) continue;
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
      wave: this.wave, robotsLeft: left, score: this.score, cores: this.cores, shield: this.shield, maxShield: this.maxShield(),
      combo: this.combo, ammo: this.ammo[this.weapon] || 0, magazine: this.magazineOf(this.cfg()), reloading: this.reloadT > 0,
      locked: this.isLocked(), weapon: this.weapon, unlocked: this.unlocked.slice(), zoom: this.zoom,
      levels: Object.assign({}, this.levels),
    });
  }
}
