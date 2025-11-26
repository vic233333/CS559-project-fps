import { PMREMGenerator } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

export default class AssetManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.gltfCache = new Map();
    this.hdrCache = new Map();
    this.pmrem = new PMREMGenerator(renderer);
  }

  async loadGLTF(url) {
    if (this.gltfCache.has(url)) return this.gltfCache.get(url);
    const loader = new GLTFLoader();
    const asset = await loader.loadAsync(url);
    this.gltfCache.set(url, asset);
    return asset;
  }

  async loadHDR(url) {
    if (this.hdrCache.has(url)) return this.hdrCache.get(url);
    const loader = new RGBELoader();
    const hdr = await loader.loadAsync(url);
    const envMap = this.pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose && hdr.dispose();
    this.hdrCache.set(url, envMap);
    return envMap;
  }

  dispose() {
    this.pmrem.dispose();
    this.gltfCache.clear();
    this.hdrCache.clear();
  }
}
