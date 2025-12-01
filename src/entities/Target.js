import { Vector3, Group, Color } from "three";
import Entity from "../core/Entity.js";

export default class Target extends Entity {
  constructor({ modeConfig, renderProfile, moving, speed, radius, position }) {
    super(new Group());
    this.modeConfig = modeConfig;
    this.renderProfile = renderProfile;
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
    const mesh = await this.renderProfile.createTargetMesh({
      color: this.color,
      radius: this.radius,
      gltfTargets: this.modeConfig.gltfTargets
    });
    if (mesh) this.object3D.add(mesh);

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
