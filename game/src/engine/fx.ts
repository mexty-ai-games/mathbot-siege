import * as THREE from 'three';

function dotTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.8)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface Tracer { mesh: THREE.Mesh; life: number; max: number }
interface Ring { mesh: THREE.Mesh; life: number; max: number; size: number; floor: boolean }
interface Floater { sprite: THREE.Sprite; canvas: HTMLCanvasElement; life: number; vy: number }

const N = 900;

/** Pooled particle sparks, laser tracers, impact rings, light flashes and floating score text. */
export class Fx {
  private points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private base: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private head = 0;
  private tracers: Tracer[] = [];
  private rings: Ring[] = [];
  private floaters: Floater[] = [];
  private flash: THREE.PointLight;
  private flashLife = 0;
  private tmp = new THREE.Vector3();

  constructor(private scene: THREE.Scene, private camera: THREE.Camera) {
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3);
    this.col = new Float32Array(N * 3);
    this.vel = new Float32Array(N * 3);
    this.base = new Float32Array(N * 3);
    this.life = new Float32Array(N);
    this.maxLife = new Float32Array(N);
    for (let i = 0; i < N; i++) this.pos[i * 3 + 1] = -100;
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.09, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);

    const tracerGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    tracerGeo.rotateX(Math.PI / 2);
    tracerGeo.translate(0, 0, 0.5);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(tracerGeo, new THREE.MeshBasicMaterial({
        color: new THREE.Color(0.6, 2.2, 3.0), transparent: true, blending: THREE.AdditiveBlending,
        depthWrite: false, toneMapped: false,
      }));
      m.visible = false;
      scene.add(m);
      this.tracers.push({ mesh: m, life: 0, max: 0.1 });
    }
    const ringGeo = new THREE.RingGeometry(0.8, 1, 40);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        side: THREE.DoubleSide, toneMapped: false,
      }));
      m.visible = false;
      scene.add(m);
      this.rings.push({ mesh: m, life: 0, max: 0.3, size: 1, floor: false });
    }
    for (let i = 0; i < 8; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 96;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
      sprite.scale.set(1.2, 0.45, 1);
      sprite.visible = false;
      sprite.renderOrder = 10;
      scene.add(sprite);
      this.floaters.push({ sprite, canvas, life: 0, vy: 0 });
    }
    this.flash = new THREE.PointLight(0x66ddff, 0, 9, 2);
    scene.add(this.flash);
  }

  sparks(at: THREE.Vector3, color: THREE.Color, count: number, speed = 4, life = 0.6, up = 1.5) {
    for (let k = 0; k < count; k++) {
      const i = this.head;
      this.head = (this.head + 1) % N;
      this.pos[i * 3] = at.x;
      this.pos[i * 3 + 1] = at.y;
      this.pos[i * 3 + 2] = at.z;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      const s = speed * (0.3 + Math.random() * 0.9);
      this.vel[i * 3] = Math.sin(ph) * Math.cos(th) * s;
      this.vel[i * 3 + 1] = Math.cos(ph) * s + up;
      this.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * s;
      const b = 1.5 + Math.random() * 2.5;
      this.base[i * 3] = color.r * b;
      this.base[i * 3 + 1] = color.g * b;
      this.base[i * 3 + 2] = color.b * b;
      this.maxLife[i] = this.life[i] = life * (0.5 + Math.random() * 0.8);
    }
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, color?: THREE.Color) {
    const t = this.tracers.find((x) => x.life <= 0) || this.tracers[0];
    const m = t.mesh;
    m.visible = true;
    m.position.copy(from);
    m.lookAt(to);
    const len = from.distanceTo(to);
    m.scale.set(0.022, 0.022, len);
    (m.material as THREE.MeshBasicMaterial).color.copy(color || new THREE.Color(0.6, 2.2, 3.0));
    t.life = t.max = 0.12;
  }

  ring(at: THREE.Vector3, color: THREE.Color, size: number, floor = false, life = 0.35) {
    const r = this.rings.find((x) => x.life <= 0) || this.rings[0];
    r.mesh.visible = true;
    r.mesh.position.copy(at);
    if (floor) r.mesh.rotation.set(-Math.PI / 2, 0, 0);
    (r.mesh.material as THREE.MeshBasicMaterial).color.copy(color).multiplyScalar(2.5);
    r.life = r.max = life;
    r.size = size;
    r.floor = floor;
  }

  lightFlash(at: THREE.Vector3, color: number, intensity = 30) {
    this.flash.position.copy(at);
    this.flash.color.setHex(color);
    this.flash.intensity = intensity;
    this.flashLife = 0.12;
  }

  floatText(at: THREE.Vector3, text: string, color: string) {
    const f = this.floaters.find((x) => x.life <= 0) || this.floaters[0];
    const g = f.canvas.getContext('2d')!;
    g.clearRect(0, 0, 256, 96);
    g.font = 'italic 900 64px "Segoe UI", system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 8;
    g.strokeStyle = 'rgba(0,0,0,0.75)';
    g.strokeText(text, 128, 50);
    g.shadowColor = color;
    g.shadowBlur = 18;
    g.fillStyle = color;
    g.fillText(text, 128, 50);
    ((f.sprite.material as THREE.SpriteMaterial).map as THREE.CanvasTexture).needsUpdate = true;
    f.sprite.position.copy(at);
    f.sprite.visible = true;
    f.life = 1.1;
    f.vy = 1.1;
  }

  update(dt: number) {
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      this.vel[i * 3 + 1] -= 9.8 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.02) {
        this.pos[i * 3 + 1] = 0.02;
        this.vel[i * 3 + 1] *= -0.35;
        this.vel[i * 3] *= 0.6;
        this.vel[i * 3 + 2] *= 0.6;
      }
      this.col[i * 3] = this.base[i * 3] * k;
      this.col[i * 3 + 1] = this.base[i * 3 + 1] * k;
      this.col[i * 3 + 2] = this.base[i * 3 + 2] * k;
      if (this.life[i] <= 0) this.pos[i * 3 + 1] = -100;
    }
    const g = this.points.geometry;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;

    for (let i = 0; i < this.tracers.length; i++) {
      const t = this.tracers[i];
      if (t.life <= 0) continue;
      t.life -= dt;
      const k = Math.max(0, t.life / t.max);
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = k;
      t.mesh.scale.x = t.mesh.scale.y = 0.022 * (0.4 + k);
      if (t.life <= 0) t.mesh.visible = false;
    }
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i];
      if (r.life <= 0) continue;
      r.life -= dt;
      const k = Math.max(0, r.life / r.max);
      const s = r.size * (1.15 - k);
      r.mesh.scale.set(s, s, s);
      if (!r.floor) r.mesh.quaternion.copy(this.camera.quaternion);
      (r.mesh.material as THREE.MeshBasicMaterial).opacity = k;
      if (r.life <= 0) r.mesh.visible = false;
    }
    for (let i = 0; i < this.floaters.length; i++) {
      const f = this.floaters[i];
      if (f.life <= 0) continue;
      f.life -= dt;
      f.sprite.position.y += f.vy * dt;
      f.vy *= 0.95;
      (f.sprite.material as THREE.SpriteMaterial).opacity = Math.min(1, f.life * 2);
      if (f.life <= 0) f.sprite.visible = false;
    }
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      this.flash.intensity *= 0.7;
      if (this.flashLife <= 0) this.flash.intensity = 0;
    }
    this.tmp.set(0, 0, 0);
  }
}
