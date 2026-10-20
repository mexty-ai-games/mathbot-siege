import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, ChromaticAberrationEffect, SMAAEffect,
} from 'postprocessing';
import { Assets } from './assets';

/** Layout exported from Blender on the ARENA_META node (three.js coordinates). */
export interface ArenaMeta {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  player: [number, number];
  spawns: [number, number][];
  obstacles: [number, number, number, number][]; // cx, cz, halfX, halfZ
  lights: [number, number, number, number, number][];
  shafts: [number, number][];
  height: number;
}

export interface World {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  colliders: THREE.Object3D[];
  chroma: ChromaticAberrationEffect | null;
  meta: ArenaMeta;
  ambience: (dt: number, t: number) => void;
  resize: (w: number, h: number) => void;
  /** Push a circle of radius r out of every obstacle (xz plane). */
  resolve: (p: THREE.Vector3, r: number) => void;
  /** Walking direction toward the flow target: straight when the way is open, else along the shortest path. */
  steer: (p: THREE.Vector3, dir: THREE.Vector3, r: number) => THREE.Vector3;
  /** Rebuild the path field toward this point (the player) when it changed cell. */
  setFlowTarget: (x: number, z: number) => void;
  /** Is the straight line between two points free of obstacles? */
  clearLine: (a: THREE.Vector3, b: THREE.Vector3) => boolean;
  baseFov: () => number;
  dispose: () => void;
}

const FALLBACK: ArenaMeta = {
  bounds: { minX: -7.4, maxX: 7.4, minZ: -9, maxZ: 18.4 }, player: [0, 15],
  spawns: [[-5.8, -16.6], [5.8, -16.6], [0, -18.2]], obstacles: [], lights: [], shafts: [], height: 7,
};

function holoTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.font = 'italic 600 62px "Segoe UI", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = '#40e0ff';
  g.shadowBlur = 16;
  g.fillStyle = 'rgba(150,240,255,0.9)';
  g.fillText(text, 256, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function readMeta(arena: THREE.Object3D): ArenaMeta {
  let meta: ArenaMeta = FALLBACK;
  arena.traverse((o) => {
    if (o.name === 'ARENA_META' && typeof o.userData.meta === 'string') {
      try { meta = JSON.parse(o.userData.meta) as ArenaMeta; } catch (e) { /* keep fallback */ }
    }
  });
  return meta;
}

export function createWorld(container: HTMLElement, assets: Assets, mobile: boolean, holoFormulas: string[]): World {
  const renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, depth: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const arena = assets.arena.scene;
  const meta = readMeta(arena);
  const span = Math.max(meta.bounds.maxZ - meta.bounds.minZ, meta.bounds.maxX - meta.bounds.minX);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03060a);
  scene.fog = new THREE.Fog(0x041019, span * 0.45, span * 1.25);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  (scene as any).environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(mobile ? 74 : 70, 1, 0.05, span * 2 + 40);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0x6fa8ff, 0x0b0f14, 0.6));
  const key = new THREE.DirectionalLight(0xcfe8ff, 1.4);
  key.position.set(6, 14, 12);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff4060, 0.5);
  rim.position.set(-4, 6, -30);
  scene.add(rim);
  // practical lights from the Blender layout (fewer on phones)
  const lights = mobile ? meta.lights.filter((l, i) => i % 2 === 0) : meta.lights;
  for (let i = 0; i < lights.length; i++) {
    const p = lights[i];
    const l = new THREE.PointLight(p[3], p[4] * (mobile ? 1.3 : 1), 18, 1.6);
    l.position.set(p[0], p[1], p[2]);
    scene.add(l);
  }

  const colliders: THREE.Object3D[] = [];
  arena.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    if (mat.name !== 'Space') colliders.push(m);
    mat.envMapIntensity = 1.0;
    if (mat.name === 'Floor') {
      mat.roughness = mobile ? 0.45 : 0.3;
      mat.metalness = 0.7;
      mat.emissiveIntensity = mobile ? 0.5 : 0.8;
      if (mat.map) mat.map.anisotropy = 8;
    }
    if (mat.name === 'Space') { mat.fog = false; mat.toneMapped = true; }
    if (mat.name === 'Wall' && mat.map) mat.map.anisotropy = 4;
    // tone the neon down on phones (less glare under bloom)
    if (mobile && mat.name.indexOf('Neon') === 0) mat.emissiveIntensity *= 0.55;
  });
  scene.add(arena);

  // fake volumetric light shafts under the skylights (desktop only)
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.35, 0.7, 1.0) } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(abs(dot(vN,vV)),1.6); float fall=smoothstep(0.0,1.0,vUv.y); float flick=0.85+0.15*sin(uTime*1.7+vUv.x*12.0); gl_FragColor=vec4(uColor*f*fall*0.09*flick,1.0); }',
  });
  if (!mobile) {
    const h = meta.height - 0.3;
    const shaftGeo = new THREE.CylinderGeometry(1.2, 3.0, h, 20, 1, true);
    for (let i = 0; i < meta.shafts.length; i++) {
      const s = new THREE.Mesh(shaftGeo, shaftMat);
      s.position.set(meta.shafts[i][0], h / 2, meta.shafts[i][1]);
      scene.add(s);
    }
  }

  // floating dust motes
  const b = meta.bounds;
  const DUST = mobile ? 150 : 900;
  const dpos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dpos[i * 3] = b.minX + Math.random() * (b.maxX - b.minX);
    dpos[i * 3 + 1] = Math.random() * meta.height * 0.8;
    dpos[i * 3 + 2] = b.minZ + Math.random() * (b.maxZ - b.minZ);
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  scene.add(new THREE.Points(dgeo, new THREE.PointsMaterial({
    size: 0.03, color: 0x9fdcff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
  })));

  // holographic formulas drifting along the side walls
  const holos: THREE.Mesh[] = [];
  for (let i = 0; i < holoFormulas.length; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const h = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({
      map: holoTexture(holoFormulas[i]), transparent: true, opacity: 0.55, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    }));
    const t = (i + 0.5) / holoFormulas.length;
    h.position.set(side * (b.maxX - 0.6), 2.6 + (i % 3) * 0.7, b.minZ + t * (b.maxZ - b.minZ));
    h.rotation.y = side * Math.PI / 2 * -1;
    h.userData.base = h.position.y;
    scene.add(h);
    holos.push(h);
  }

  // post-processing: lighter on phones (less glare, no chromatic aberration, no SMAA)
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const bloom = mobile
    ? new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.92, luminanceSmoothing: 0.15, intensity: 0.55, radius: 0.5 })
    : new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.75, luminanceSmoothing: 0.22, intensity: 1.15, radius: 0.68 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  const vignette = new VignetteEffect({ offset: 0.32, darkness: mobile ? 0.45 : 0.6 });
  let chroma: ChromaticAberrationEffect | null = null;
  composer.addPass(new EffectPass(camera, bloom, tone, vignette));
  if (!mobile) {
    chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0005, 0.0005), radialModulation: true, modulationOffset: 0.3 });
    composer.addPass(new EffectPass(camera, chroma));
    composer.addPass(new EffectPass(camera, new SMAAEffect()));
  }

  const ambience = (dt: number, t: number) => {
    shaftMat.uniforms.uTime.value = t;
    const p = dgeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < DUST; i++) {
      let y = dpos[i * 3 + 1] + dt * 0.08;
      if (y > meta.height * 0.8) y = 0;
      dpos[i * 3 + 1] = y;
      dpos[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.03;
    }
    p.needsUpdate = true;
    for (let i = 0; i < holos.length; i++) {
      holos[i].position.y = holos[i].userData.base + Math.sin(t * 0.6 + i) * 0.12;
      (holos[i].material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.15 * Math.sin(t * 2 + i * 1.7);
    }
  };

  const baseFov = () => {
    // keep at least ~62° of horizontal view on portrait phones
    const minH = (62 * Math.PI) / 180;
    const needV = (2 * Math.atan(Math.tan(minH / 2) / camera.aspect) * 180) / Math.PI;
    return Math.min(100, Math.max(mobile ? 74 : 70, needV));
  };

  const resize = (w: number, h: number) => {
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    camera.fov = baseFov();
    camera.updateProjectionMatrix();
  };

  const obs = meta.obstacles;
  const resolve = (p: THREE.Vector3, r: number) => {
    p.x = Math.max(b.minX + r * 0.5, Math.min(b.maxX - r * 0.5, p.x));
    p.z = Math.max(b.minZ + r * 0.5, Math.min(b.maxZ - r * 0.5, p.z));
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      const qx = Math.max(o[0] - o[2], Math.min(o[0] + o[2], p.x));
      const qz = Math.max(o[1] - o[3], Math.min(o[1] + o[3], p.z));
      let dx = p.x - qx;
      let dz = p.z - qz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 < 1e-6) {
        // centre inside the box: leave by the nearest face
        const px = o[2] - Math.abs(p.x - o[0]);
        const pz = o[3] - Math.abs(p.z - o[1]);
        if (px < pz) p.x = o[0] + Math.sign(p.x - o[0] || 1) * (o[2] + r);
        else p.z = o[1] + Math.sign(p.z - o[1] || 1) * (o[3] + r);
        continue;
      }
      const d = Math.sqrt(d2);
      dx /= d; dz /= d;
      p.x = qx + dx * r;
      p.z = qz + dz * r;
    }
  };

  // segment vs expanded AABB (slab test) in xz
  const segHits = (ax: number, az: number, bx: number, bz: number, o: number[], r: number) => {
    const minX = o[0] - o[2] - r, maxX = o[0] + o[2] + r, minZ = o[1] - o[3] - r, maxZ = o[1] + o[3] + r;
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dz = bz - az;
    const clip = (p: number, q: number) => {
      if (Math.abs(p) < 1e-9) return q >= 0;
      const t = q / p;
      if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
      return true;
    };
    return clip(-dx, ax - minX) && clip(dx, maxX - ax) && clip(-dz, az - minZ) && clip(dz, maxZ - az) && t0 <= t1;
  };

  // ---- flow field: 1 m grid, cover inflated by a robot body, BFS distance from the player
  const CELL = 1;
  const INFL = 0.85;
  const gw = Math.ceil((b.maxX - b.minX) / CELL);
  const gh = Math.ceil((b.maxZ - b.minZ) / CELL);
  const blocked = new Uint8Array(gw * gh);
  const dist = new Int32Array(gw * gh);
  const queue = new Int32Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      const cx = b.minX + (i + 0.5) * CELL;
      const cz = b.minZ + (j + 0.5) * CELL;
      for (let k = 0; k < obs.length; k++) {
        const o = obs[k];
        if (Math.abs(cx - o[0]) < o[2] + INFL && Math.abs(cz - o[1]) < o[3] + INFL) { blocked[j * gw + i] = 1; break; }
      }
    }
  }
  const cellOf = (x: number, z: number) => {
    const i = Math.max(0, Math.min(gw - 1, Math.floor((x - b.minX) / CELL)));
    const j = Math.max(0, Math.min(gh - 1, Math.floor((z - b.minZ) / CELL)));
    return j * gw + i;
  };
  let flowCell = -1;
  const target = new THREE.Vector3();
  const setFlowTarget = (x: number, z: number) => {
    target.set(x, 0, z);
    const start = cellOf(x, z);
    if (start === flowCell) return;
    flowCell = start;
    dist.fill(0x3fffffff);
    let head = 0;
    let tail = 0;
    dist[start] = 0;
    queue[tail++] = start;
    while (head < tail) {
      const c = queue[head++];
      const ci = c % gw;
      const cj = (c - ci) / gw;
      const nd = dist[c] + 1;
      for (let k = 0; k < 4; k++) {
        const ni = ci + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const nj = cj + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (ni < 0 || nj < 0 || ni >= gw || nj >= gh) continue;
        const n = nj * gw + ni;
        if (blocked[n] || dist[n] <= nd) continue;
        dist[n] = nd;
        queue[tail++] = n;
      }
    }
  };

  const steer = (p: THREE.Vector3, dir: THREE.Vector3, r: number) => {
    // open line of sight to the player: walk straight
    let open = true;
    for (let i = 0; i < obs.length && open; i++) if (segHits(p.x, p.z, target.x, target.z, obs[i], r)) open = false;
    if (open || flowCell < 0) return dir;
    const c = cellOf(p.x, p.z);
    const ci = c % gw;
    const cj = (c - ci) / gw;
    // pick the lowest-distance free neighbour (8-connected), looking two cells ahead for smoother paths
    let best = -1;
    let bestD = blocked[c] ? 0x3fffffff : dist[c];
    for (let dj = -2; dj <= 2; dj++) {
      for (let di = -2; di <= 2; di++) {
        if (!di && !dj) continue;
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= gw || nj >= gh) continue;
        const n = nj * gw + ni;
        if (blocked[n]) continue;
        const d = dist[n] + (Math.abs(di) + Math.abs(dj)) * 0.01;
        if (d < bestD) { bestD = d; best = n; }
      }
    }
    if (best < 0) return dir;
    const bi = best % gw;
    const bj = (best - bi) / gw;
    const tx = b.minX + (bi + 0.5) * CELL - p.x;
    const tz = b.minZ + (bj + 0.5) * CELL - p.z;
    const l = Math.sqrt(tx * tx + tz * tz) || 1;
    return new THREE.Vector3(tx / l, 0, tz / l);
  };

  const clearLine = (a: THREE.Vector3, c: THREE.Vector3) => {
    for (let i = 0; i < obs.length; i++) if (segHits(a.x, a.z, c.x, c.z, obs[i], 0)) return false;
    return true;
  };

  const dispose = () => {
    composer.dispose();
    envRT.dispose();
    pmrem.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
  };

  return { renderer, composer, scene, camera, colliders, chroma, meta, ambience, resize, resolve, steer, setFlowTarget, clearLine, baseFov, dispose };
}
