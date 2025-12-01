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

// Visual strategy for Prototype mode (primitives only, no HDR).
export function createPrototypeProfile() {
  return {
    name: "prototype",
    async applyEnvironment(world, modeConfig) {
      const scene = world.scene;
      scene.background = new Color(modeConfig.skyColor);
      scene.fog = new FogExp2(modeConfig.fog.color, modeConfig.fog.density);

      this._disposeGround(world);
      this._removeLights(world);

      const groundGeo = new PlaneGeometry(200, 200);
      const groundMat = new MeshStandardMaterial({
        color: modeConfig.groundColor,
        roughness: 0.9,
        metalness: 0.05
      });
      const ground = new Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
      world.ground = ground;

      const hemi = new HemisphereLight("#88aaff", "#080910", modeConfig.ambientIntensity);
      const dir = new DirectionalLight("#ffffff", modeConfig.directionalIntensity);
      dir.position.set(8, 15, 6);
      dir.castShadow = true;
      dir.shadow.mapSize.set(1024, 1024);
      dir.shadow.camera.near = 1;
      dir.shadow.camera.far = 50;
      scene.add(hemi);
      scene.add(dir);
      world.lights = [hemi, dir];

      world.renderer.shadowMap.enabled = true;
      world.renderer.setClearColor(new Color(modeConfig.skyColor), 1);
    },

    createTargetMesh({ color, radius }) {
      const useSphere = Math.random() > 0.5;
      const geom = useSphere
        ? new SphereGeometry(radius, 24, 18)
        : new BoxGeometry(radius * 1.6, radius * 1.6, radius * 1.6);
      const mat = new MeshStandardMaterial({
        color: new Color(color),
        metalness: 0.25,
        roughness: 0.4,
        emissive: new Color(color).multiplyScalar(0.2)
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
