import { Vector3, Group, Color } from "three";
import Entity from "../core/Entity.js";
import * as CANNON from "cannon-es";

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

  async build(scene, world) {
    const mesh = await this.renderProfile.createTargetMesh({
      color: this.color,
      radius: this.radius,
      gltfTargets: this.modeConfig.gltfTargets
    });
    if (mesh) this.object3D.add(mesh);

    this.object3D.position.copy(this.position);
    scene.add(this.object3D);

    // Physics body (static but collidable; moving targets are kinematic via manual position updates)
    this.body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Sphere(this.radius),
      position: new CANNON.Vec3(this.position.x, this.position.y, this.position.z)
    });
    this.body.isDynamicCollider = true;
    this.body.entity = this;
    world.physicsWorld.addBody(this.body);
  }

  prePhysics(dt) {
    if (!this.moving || !this.body) return;
    this.time += dt * this.speed;
    const amp = 1.5 + Math.random() * 0.5;
    this.body.position.x += Math.sin(this.time) * amp * dt;
    this.body.position.z += Math.cos(this.time) * amp * dt;
  }

  onHit(damage) {
    this.health -= damage;
    if (this.health <= 0) {
      this.alive = false;
    }
  }

  getAABB() {
    const pos = this.object3D.position;
    const r = this.radius;
    return {
      min: new Vector3(pos.x - r, pos.y - r, pos.z - r),
      max: new Vector3(pos.x + r, pos.y + r, pos.z + r)
    };
  }

  postPhysics() {
    if (this.body) {
      this.object3D.position.copy(this.body.position);
    }
  }
}
