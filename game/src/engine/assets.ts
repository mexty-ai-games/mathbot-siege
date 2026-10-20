import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { ModelUrls } from '../types';

export interface Assets {
  drone: GLTF;
  mech: GLTF;
  spider: GLTF;
  scout: GLTF;
  titan: GLTF;
  weapons: GLTF;
  arena: GLTF;
}

const cache: { [url: string]: Promise<GLTF> } = {};

function load(loader: GLTFLoader, url: string, onProgress: (f: number) => void): Promise<GLTF> {
  if (!cache[url]) {
    cache[url] = new Promise<GLTF>((resolve, reject) => {
      loader.load(url, resolve, (e) => {
        if (e.total) onProgress(e.loaded / e.total);
      }, (err) => {
        delete cache[url];
        reject(err);
      });
    });
  }
  return cache[url];
}

/** Loads every model; `onProgress` receives 0..1 over all of them. */
export function loadAssets(urls: ModelUrls, onProgress: (f: number) => void): Promise<Assets> {
  const loader = new GLTFLoader();
  loader.setCrossOrigin('anonymous');
  const keys: (keyof ModelUrls)[] = ['arena', 'drone', 'mech', 'spider', 'scout', 'titan', 'weapons'];
  const prog: number[] = keys.map(() => 0);
  const report = () => onProgress(prog.reduce((a, b) => a + b, 0) / keys.length);
  return Promise.all(keys.map((k, i) => load(loader, urls[k], (f) => { prog[i] = f; report(); }).then((g) => {
    prog[i] = 1;
    report();
    return g;
  }))).then((res) => ({
    arena: res[0], drone: res[1], mech: res[2], spider: res[3], scout: res[4], titan: res[5], weapons: res[6],
  }));
}

/** Clone a skinned glTF scene so every robot animates on its own. */
export function cloneSkinned(src: THREE.Object3D): THREE.Object3D {
  return SkeletonUtils.clone(src);
}
