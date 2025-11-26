import {
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  BoxGeometry,
  Vector3,
  Group,
  Color
} from "three";
import Entity from "../core/Entity.js";

export default class Target extends Entity {
  constructor({ modeConfig, assetManager, moving, speed, radius, position }) {
    super(new Group());
    this.modeConfig = modeConfig;
    this.assetManager = assetManager;
    this.moving = moving;
    this.speed = speed;
    this.radius = radius || 0.6;
    this.position = position ? position.clone() : new Vector3();
    this.health = 30;
    this.time = Math.random() * Math.PI * 2;
    this.color =
      modeConfig.targetPalette[
        Math.floor(Math.random() * modeConfig.targetPalette.length)
      ];
    this.object3D.userData.entity = this;
  }

  async build(scene) {
    // Choose representation based on mode
    if (this.modeConfig.geometryStyle === "hybrid" && this.modeConfig.gltfTargets?.length) {
      const choice =
        this.modeConfig.gltfTargets[Math.floor(Math.random() * this.modeConfig.gltfTargets.length)];
      const gltf = await this.assetManager.loadGLTF(choice.url);
      const clone = gltf.scene.clone(true);
      clone.scale.setScalar(choice.scale || 1);
      clone.traverse((child) => {
        child.castShadow = true;
        child.receiveShadow = true;
      });
      this.object3D.add(clone);
    } else {
      const geom =
        Math.random() > 0.5
          ? new SphereGeometry(this.radius, 24, 18)
          : new BoxGeometry(this.radius * 1.6, this.radius * 1.6, this.radius * 1.6);
      const mat = new MeshStandardMaterial({
        color: new Color(this.color),
        metalness: 0.25,
        roughness: 0.4,
        emissive: new Color(this.color).multiplyScalar(0.2)
      });
      const mesh = new Mesh(geom, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      this.object3D.add(mesh);
    }

    this.object3D.position.copy(this.position);
    scene.add(this.object3D);
  }

  update(dt) {
    if (!this.moving) return;
    this.time += dt * this.speed;
    const amp = 1.5 + Math.random() * 0.5;
    this.object3D.position.x += Math.sin(this.time) * amp * dt;
    this.object3D.position.z += Math.cos(this.time) * amp * dt;
    this.object3D.rotation.y += dt * 0.6;
  }

  onHit(damage) {
    this.health -= damage;
    if (this.health <= 0) {
      this.alive = false;
    }
  }
}
