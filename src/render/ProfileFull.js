import {
  Color,
  FogExp2,
  PlaneGeometry,
  MeshStandardMaterial,
  Mesh,
  HemisphereLight,
  DirectionalLight,
  SphereGeometry,
  BoxGeometry
} from "three";

// Visual strategy for Full mode (HDR + PBR + optional glTF targets).
export function createFullProfile(assetManager) {
  return {
    name: "full",
    async applyEnvironment(world, modeConfig) {
      const scene = world.scene;
      scene.background = new Color(modeConfig.skyColor);
      scene.fog = new FogExp2(modeConfig.fog.color, modeConfig.fog.density);

      this._disposeGround(world);
      this._removeLights(world);

      const groundGeo = new PlaneGeometry(240, 240);
      const groundMat = new MeshStandardMaterial({
        color: modeConfig.groundColor,
        roughness: 0.8,
        metalness: 0.1
      });
      const ground = new Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
      world.ground = ground;

      const hemi = new HemisphereLight("#a4c8ff", "#06080f", modeConfig.ambientIntensity);
      const dir = new DirectionalLight("#ffffff", modeConfig.directionalIntensity);
      dir.position.set(10, 18, 8);
      dir.castShadow = true;
      dir.shadow.mapSize.set(2048, 2048);
      dir.shadow.camera.near = 1;
      dir.shadow.camera.far = 80;
      scene.add(hemi);
      scene.add(dir);
      world.lights = [hemi, dir];

      world.renderer.shadowMap.enabled = true;
      world.renderer.setClearColor(new Color(modeConfig.skyColor), 1);

      if (modeConfig.useHDR && modeConfig.hdrUrl) {
        try {
          const envMap = await assetManager.loadHDR(modeConfig.hdrUrl);
          scene.environment = envMap;
        } catch (err) {
          console.warn("HDR load failed, continuing without environment", err);
          scene.environment = null;
        }
      } else {
        scene.environment = null;
      }
    },

    async createTargetMesh({ color, radius, gltfTargets }) {
      if (gltfTargets && gltfTargets.length) {
        const choice = gltfTargets[Math.floor(Math.random() * gltfTargets.length)];
        try {
          const gltf = await assetManager.loadGLTF(choice.url);
          const clone = gltf.scene.clone(true);
          clone.scale.setScalar(choice.scale || 1);
          clone.traverse((child) => {
            child.castShadow = true;
            child.receiveShadow = true;
          });
          return clone;
        } catch {
          // fall back to primitive if loading fails
        }
      }

      const geom =
        Math.random() > 0.5
          ? new SphereGeometry(radius, 32, 24)
          : new BoxGeometry(radius * 1.6, radius * 1.6, radius * 1.6);
      const mat = new MeshStandardMaterial({
        color: new Color(color),
        metalness: 0.35,
        roughness: 0.35,
        emissive: new Color(color).multiplyScalar(0.25)
      });
      const mesh = new Mesh(geom, mat);
      mesh.castShadow = true;
      return mesh;
    },

    _disposeGround(world) {
      if (world.ground) {
        world.scene.remove(world.ground);
        world.ground.geometry.dispose();
        world.ground.material.dispose();
        world.ground = null;
      }
    },

    _removeLights(world) {
      for (const l of world.lights) world.scene.remove(l);
      world.lights = [];
    }
  };
}
