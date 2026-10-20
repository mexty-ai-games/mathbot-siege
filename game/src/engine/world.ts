import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode,
  VignetteEffect, ChromaticAberrationEffect, SMAAEffect, BlendFunction,
} from 'postprocessing';
import { Assets } from './assets';

export interface World {
  renderer: THREE.WebGLRenderer;
  composer: EffectComposer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  colliders: THREE.Object3D[];
  chroma: ChromaticAberrationEffect;
  vignette: VignetteEffect;
  bloom: BloomEffect;
  ambience: (dt: number, t: number) => void;
  portals: THREE.Vector3[];
  resize: (w: number, h: number) => void;
  dispose: () => void;
}

export const ARENA = { minX: -7.4, maxX: 7.4, minZ: -9, maxZ: 18.4 };

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

export function createWorld(container: HTMLElement, assets: Assets, mobile: boolean, holoFormulas: string[]): World {
  const renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, depth: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.3 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03060a);
  scene.fog = new THREE.Fog(0x041019, 16, 52);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  (scene as any).environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(mobile ? 74 : 70, 1, 0.05, 140);
  scene.add(camera);

  // lighting: cool sky fill, a key light, coloured practicals along the hangar
  scene.add(new THREE.HemisphereLight(0x6fa8ff, 0x0b0f14, 0.55));
  const key = new THREE.DirectionalLight(0xcfe8ff, 1.5);
  key.position.set(4, 9, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xff4060, 0.6);
  rim.position.set(-3, 4, -14);
  scene.add(rim);
  const practical: [number, number, number, number, number][] = [
    [-5.8, 1.8, -16.5, 0xff2a20, 9], [5.8, 1.8, -16.5, 0xff2a20, 9],
    [0, 5.5, -6, 0x40d8ff, 26], [0, 5.5, 6, 0x40d8ff, 26], [-6.5, 2.5, 12, 0x40ff90, 14], [6.5, 2.5, 0, 0x40ff90, 14],
  ];
  for (let i = 0; i < practical.length; i++) {
    const p = practical[i];
    const l = new THREE.PointLight(p[3], p[4], 14, 1.6);
    l.position.set(p[0], p[1], p[2]);
    scene.add(l);
  }

  const arena = assets.arena.scene;
  const colliders: THREE.Object3D[] = [];
  arena.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    colliders.push(m);
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.envMapIntensity = 1.0;
    if (mat.name === 'Floor') {
      mat.roughness = 0.28;
      mat.metalness = 0.75;
      mat.emissiveIntensity = 0.9;
      if (mat.map) mat.map.anisotropy = 8;
    }
    if (mat.name === 'Wall' && mat.map) mat.map.anisotropy = 4;
  });
  scene.add(arena);

  // fake volumetric light shafts under ceiling lamps
  const shaftGeo = new THREE.CylinderGeometry(0.9, 2.2, 6.8, 20, 1, true);
  const shaftMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0.35, 0.7, 1.0) } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform float uTime; uniform vec3 uColor; varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(abs(dot(vN,vV)),1.6); float fall=smoothstep(0.0,1.0,vUv.y); float flick=0.85+0.15*sin(uTime*1.7+vUv.x*12.0); gl_FragColor=vec4(uColor*f*fall*0.11*flick,1.0); }',
  });
  const shafts: THREE.Mesh[] = [];
  for (let z = -14; z <= 14; z += 8) {
    for (let x = -4.5; x <= 4.5; x += 9) {
      const s = new THREE.Mesh(shaftGeo, shaftMat);
      s.position.set(x, 3.5, z);
      scene.add(s);
      shafts.push(s);
    }
  }

  // floating dust motes
  const DUST = mobile ? 250 : 600;
  const dpos = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dpos[i * 3] = (Math.random() - 0.5) * 17;
    dpos[i * 3 + 1] = Math.random() * 6.5;
    dpos[i * 3 + 2] = (Math.random() - 0.5) * 38;
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({
    size: 0.025, color: 0x9fdcff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(dust);

  // holographic formulas drifting by the walls (like the key art)
  const holos: THREE.Mesh[] = [];
  for (let i = 0; i < holoFormulas.length; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const h = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({
      map: holoTexture(holoFormulas[i]), transparent: true, opacity: 0.55, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide,
    }));
    h.position.set(side * 7.9, 3.2 + (i % 3) * 0.8, -14 + i * (28 / Math.max(1, holoFormulas.length)));
    h.rotation.y = side * Math.PI / 2 * -1;
    h.userData.base = h.position.y;
    scene.add(h);
    holos.push(h);
  }

  // post-processing: bloom does the "2026 neon" look, ACES for filmic colour
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new BloomEffect({ mipmapBlur: true, luminanceThreshold: 0.72, luminanceSmoothing: 0.25, intensity: 1.35, radius: 0.72 });
  const chroma = new ChromaticAberrationEffect({ offset: new THREE.Vector2(0.0006, 0.0006), radialModulation: true, modulationOffset: 0.3 });
  const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.62 });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  composer.addPass(new EffectPass(camera, bloom, tone));
  composer.addPass(new EffectPass(camera, chroma, vignette));
  if (!mobile) composer.addPass(new EffectPass(camera, new SMAAEffect()));
  (vignette as any).blendMode.blendFunction = BlendFunction.NORMAL;

  const ambience = (dt: number, t: number) => {
    shaftMat.uniforms.uTime.value = t;
    const p = dgeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < DUST; i++) {
      let y = dpos[i * 3 + 1] + dt * 0.08;
      if (y > 6.5) y = 0;
      dpos[i * 3 + 1] = y;
      dpos[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.03;
    }
    p.needsUpdate = true;
    for (let i = 0; i < holos.length; i++) {
      holos[i].position.y = holos[i].userData.base + Math.sin(t * 0.6 + i) * 0.12;
      (holos[i].material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.15 * Math.sin(t * 2 + i * 1.7);
    }
  };

  const resize = (w: number, h: number) => {
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / Math.max(1, h);
    // keep at least ~62° of horizontal view on portrait phones
    const baseFov = mobile ? 74 : 70;
    const minH = (62 * Math.PI) / 180;
    const needV = (2 * Math.atan(Math.tan(minH / 2) / camera.aspect) * 180) / Math.PI;
    camera.fov = Math.min(100, Math.max(baseFov, needV));
    camera.updateProjectionMatrix();
  };

  const dispose = () => {
    composer.dispose();
    envRT.dispose();
    pmrem.dispose();
    renderer.dispose();
    if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
  };

  return {
    renderer, composer, scene, camera, colliders, chroma, vignette, bloom, ambience, resize, dispose,
    portals: [new THREE.Vector3(-5.8, 0, -16.6), new THREE.Vector3(5.8, 0, -16.6), new THREE.Vector3(0, 0, -18.2)],
  };
}
