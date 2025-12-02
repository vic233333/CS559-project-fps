import {
  BoxGeometry,
  MeshStandardMaterial,
  Mesh,
  Group,
  Color,
  Vector3
} from "three";

// Responsible for translating scene config data into static scene meshes.
export default class SceneBuilder {
  constructor(scene) {
    this.scene = scene;
    this.staticsGroup = new Group();
    this.spawnPoints = [];
    this.colliders = [];
    scene.add(this.staticsGroup);
  }

  clear() {
    this.staticsGroup.children.forEach((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    this.staticsGroup.clear();
    this.spawnPoints = [];
    this.colliders = [];
  }

  build(sceneConfig) {
    this.clear();
    if (!sceneConfig) return;

    for (const item of sceneConfig.statics || []) {
      if (item.type === "box") {
        const geom = new BoxGeometry(...item.size);
        const mat = new MeshStandardMaterial({
          color: new Color(item.color || "#444"),
          metalness: 0.05,
          roughness: 0.8
        });
        const mesh = new Mesh(geom, mat);
        mesh.position.set(...item.pos);
        if (item.rot) mesh.rotation.set(...item.rot);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        this.staticsGroup.add(mesh);
        // record collider AABB
        const half = new Vector3(item.size[0] / 2, item.size[1] / 2, item.size[2] / 2);
        const min = new Vector3(...item.pos).sub(half);
        const max = new Vector3(...item.pos).add(half);
        this.colliders.push({ min, max });
      }
      // TODO: extend to cylinder/model types.
    }

    this.spawnPoints = (sceneConfig.spawns || []).map((s) => ({
      id: s.id,
      position: new Vector3(...s.pos),
      path: s.path,
      axis: s.axis,
      range: s.range,
      radius: s.radius
    }));
  }
}
