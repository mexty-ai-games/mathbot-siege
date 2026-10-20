import * as THREE from 'three';
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WeaponConfig } from '../types';

/** Where each first-person model sits in front of the camera (landscape / portrait). */
const VIEW: { [id: string]: [number, number, number, number] } = {
  // x, y, z, scale
  pistol: [0.21, -0.23, -0.42, 0.85],
  rifle: [0.19, -0.21, -0.38, 0.8],
  shotgun: [0.2, -0.22, -0.4, 0.8],
  sniper: [0.2, -0.25, -0.46, 0.6],
};

/** The four first-person weapons from weapons.glb, attached to the camera. */
export class WeaponRig {
  root = new THREE.Group();
  private models: { [id: string]: THREE.Object3D } = {};
  private muzzles: { [id: string]: THREE.Object3D } = {};
  current = '';
  private switchT = 0;
  private pending = '';
  portrait = false;

  constructor(camera: THREE.Camera, gltf: GLTF, configs: WeaponConfig[]) {
    const scene = gltf.scene.clone(true);
    for (let i = 0; i < configs.length; i++) {
      const id = configs[i].id;
      const node = scene.getObjectByName('WPN_' + id);
      if (!node) continue;
      node.position.set(0, 0, 0);
      node.visible = false;
      node.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.frustumCulled = false;
        m.renderOrder = 20;
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        mat.envMapIntensity = 0.7;
        if (mat.name === 'WLens') mat.emissiveIntensity = 0.35;
        m.material = mat;
      });
      const muzzle = node.getObjectByName('MUZZLE_' + id);
      if (muzzle) this.muzzles[id] = muzzle;
      this.models[id] = node;
      this.root.add(node);
    }
    camera.add(this.root);
    const light = new THREE.PointLight(0xbfe8ff, 0.5, 1.5, 2);
    light.position.set(0.1, 0.2, -0.2);
    camera.add(light);
  }

  has(id: string) {
    return !!this.models[id];
  }

  /** Instant when `now`, otherwise lowers the current gun and raises the new one. */
  select(id: string, now = false) {
    if (!this.models[id] || id === this.current) return;
    if (now || !this.current) {
      if (this.current) this.models[this.current].visible = false;
      this.current = id;
      this.models[id].visible = true;
      this.switchT = 0;
      return;
    }
    this.pending = id;
    this.switchT = 0.36;
  }

  switching() {
    return this.switchT > 0;
  }

  muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    const m = this.muzzles[this.current];
    if (m) return m.getWorldPosition(out);
    return this.root.getWorldPosition(out);
  }

  update(dt: number, bobX: number, bobY: number, recoil: number, reloadDip: number, zoom: number) {
    if (this.switchT > 0) {
      this.switchT -= dt;
      if (this.pending && this.switchT <= 0.18) {
        if (this.current) this.models[this.current].visible = false;
        this.current = this.pending;
        this.models[this.current].visible = true;
        this.pending = '';
      }
    }
    const sw = this.switchT > 0 ? Math.sin((this.switchT / 0.36) * Math.PI) : 0;
    const v = VIEW[this.current] || VIEW.pistol;
    const node = this.models[this.current];
    if (!node) return;
    const px = this.portrait ? v[0] * 0.6 : v[0];
    const pz = this.portrait ? v[2] - 0.08 : v[2];
    // aim down the scope: slide to the centre and hide once the zoom is mostly in
    node.position.set(
      px * (1 - zoom) + bobX * 0.6,
      v[1] * (1 - zoom * 0.4) + bobY * 0.5 - reloadDip * 0.18 - sw * 0.35,
      pz + recoil * 0.07,
    );
    node.scale.setScalar(v[3]);
    node.rotation.set(0.02 + recoil * 0.16 - reloadDip * 0.6 - sw * 0.6, -0.06 * (1 - zoom), reloadDip * 0.4);
    node.visible = zoom < 0.85;
  }
}
