import * as THREE from 'three';

export type LootKind = 'cores' | 'shield';

interface Pickup {
  mesh: THREE.Mesh;
  kind: LootKind;
  amount: number;
  vel: THREE.Vector3;
  age: number;
  active: boolean;
}

/** Robots drop glowing energy cores (currency) and sometimes a shield cell; they fly to the player. */
export class Loot {
  private pool: Pickup[] = [];
  private coreGeo = new THREE.OctahedronGeometry(0.11, 0);
  private cellGeo = new THREE.BoxGeometry(0.22, 0.3, 0.22);
  private coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.6, 2.4), toneMapped: false });
  private cellMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.4, 0.9), toneMapped: false });

  constructor(private scene: THREE.Scene) {}

  drop(at: THREE.Vector3, kind: LootKind, amount: number, pieces: number) {
    for (let i = 0; i < pieces; i++) {
      let p = this.pool.filter((x) => !x.active)[0];
      if (!p) {
        p = { mesh: new THREE.Mesh(this.coreGeo, this.coreMat), kind, amount: 0, vel: new THREE.Vector3(), age: 0, active: false };
        this.scene.add(p.mesh);
        this.pool.push(p);
      }
      p.kind = kind;
      p.mesh.geometry = kind === 'cores' ? this.coreGeo : this.cellGeo;
      p.mesh.material = kind === 'cores' ? this.coreMat : this.cellMat;
      p.amount = i === 0 ? amount - (pieces - 1) * Math.floor(amount / pieces) : Math.floor(amount / pieces);
      p.mesh.position.copy(at);
      const a = Math.random() * Math.PI * 2;
      p.vel.set(Math.cos(a) * (1 + Math.random() * 2), 3 + Math.random() * 2, Math.sin(a) * (1 + Math.random() * 2));
      p.age = 0;
      p.active = true;
      p.mesh.visible = true;
    }
  }

  /** Returns what the player picked up this frame. */
  update(dt: number, player: THREE.Vector3): { kind: LootKind; amount: number; at: THREE.Vector3 }[] {
    const got: { kind: LootKind; amount: number; at: THREE.Vector3 }[] = [];
    const target = new THREE.Vector3(player.x, player.y - 0.5, player.z);
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.age += dt;
      const m = p.mesh;
      m.rotation.y += dt * 3;
      m.rotation.x += dt * 1.3;
      const dist = m.position.distanceTo(target);
      if (p.age > 0.7 && (dist < 9 || p.age > 2.2)) {
        // magnet: home in on the player, faster over time
        const speed = 6 + p.age * 8;
        const d = target.clone().sub(m.position).normalize().multiplyScalar(speed);
        p.vel.lerp(d, Math.min(1, dt * 6));
      } else {
        p.vel.y -= 12 * dt;
      }
      m.position.addScaledVector(p.vel, dt);
      if (m.position.y < 0.15 && p.age <= 0.7) {
        m.position.y = 0.15;
        p.vel.y = Math.abs(p.vel.y) * 0.4;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
      }
      if (dist < 0.7 || p.age > 6) {
        p.active = false;
        m.visible = false;
        got.push({ kind: p.kind, amount: p.amount, at: m.position.clone() });
      }
    }
    return got;
  }

  clear() {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].active = false;
      this.pool[i].mesh.visible = false;
    }
  }
}
