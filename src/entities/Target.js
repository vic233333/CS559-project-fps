import { Vector3, Group, Color, Box3, Matrix4, SphereGeometry, MeshBasicMaterial, Mesh } from "three";
import Entity from "../core/Entity.js";
import * as CANNON from "cannon-es";
import Debris from "./Debris.js";
import { OBB } from "three/examples/jsm/math/OBB.js";

const _hitboxBounds = new Box3();
const _hitboxCenterWorld = new Vector3();
const _hitboxSize = new Vector3();
const _hitboxOffsetWorld = new Vector3();

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
    this.hitbox = null;
    this.world = null;

    // Cached bounds for AABB broadphase and OBB narrowphase
    this._worldAABB = new Box3();
    this._localBounds = new Box3();
    this._inverseWorld = new Matrix4();
    this._obb = new OBB();
    this._boundsDirty = true;
    this._hitboxOffset = new Vector3();
    this._hitboxRadius = radius || 0.6;
  }

  async build(scene, world) {
    this.world = world;
    const mesh = await this.renderProfile.createTargetMesh({
      color: this.color,
      radius: this.radius,
      gltfTargets: this.modeConfig.gltfTargets
    });
    if (mesh) this.object3D.add(mesh);

    const hitboxMat = new MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      visible: true // Visible for debugging; set to false to hide
    });

    this.object3D.position.copy(this.position);
    scene.add(this.object3D);

    this._refreshHitboxDescriptor();
    const hitboxGeo = new SphereGeometry(this._hitboxRadius || this.radius, 12, 12);
    this.hitbox = new Mesh(hitboxGeo, hitboxMat);
    this.hitbox.userData.entity = this;
    this._syncHitboxTransform();

    // Ensure initial bounds are computed after placement
    this._boundsDirty = true;

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
    this._boundsDirty = true;
  }

  onHit(damage, hitPoint) {
    if (!this.alive) return;
    this.health -= damage;
    if (this.health <= 0) {
      this.alive = false;

      // Remove body and mesh from world
      if (this.body) {
        this.world.physicsWorld.removeBody(this.body);
      }
      this.world.remove(this);
      
      // Create shatter debris
      const numDebris = 10;
      const explosionStrength = 8;
      for (let i = 0; i < numDebris; i++) {
        const size = this.radius * (0.2 + Math.random() * 0.4);
        const randomDir = new CANNON.Vec3(
          Math.random() - 0.5,
          Math.random() - 0.5,
          Math.random() - 0.5
        ).unit();
        
        const debris = new Debris({
          world: this.world,
          initialPosition: new CANNON.Vec3().copy(this.body.position),
          initialVelocity: randomDir.scale(explosionStrength * (Math.random() * 0.75 + 0.25)),
          size: size,
          color: this.color,
          lifespan: 1 + Math.random() * 1.5,
        });
        this.world.debris.push(debris);
      }
    }
  }

  getAABB() {
    const box = this.getAABBBox();
    return { min: box.min.clone(), max: box.max.clone() };
  }

  getAABBBox() {
    if (this._boundsDirty) this._recomputeBounds();
    return this._worldAABB;
  }

  getOBB() {
    if (this._boundsDirty) this._recomputeBounds();
    return this._obb;
  }

  _recomputeBounds() {
    if (!this.object3D) return;
    // Keep matrixWorld up to date before extracting bounds
    this.object3D.updateWorldMatrix(true, true);
    const worldMatrix = this.object3D.matrixWorld;

    // Convert world-aligned box into local space to derive a tight OBB, then reapply world transform
    this._localBounds.setFromObject(this.object3D);
    this._inverseWorld.copy(worldMatrix).invert();
    this._localBounds.applyMatrix4(this._inverseWorld);

    this._obb.fromBox3(this._localBounds);
    this._obb.applyMatrix4(worldMatrix);

    // World-space AABB for cheap broadphase
    this._worldAABB.setFromObject(this.object3D);
    this._boundsDirty = false;
  }

  postPhysics() {
    if (this.body && this.alive) {
      this.object3D.position.copy(this.body.position);
      this._syncHitboxTransform();
      this._boundsDirty = true;
    }
  }

  _refreshHitboxDescriptor() {
    if (!this.object3D) return;
    this.object3D.updateWorldMatrix(true, true);
    _hitboxBounds.setFromObject(this.object3D);
    if (_hitboxBounds.isEmpty()) {
      this._hitboxOffset.set(0, 0, 0);
      this._hitboxRadius = this.radius;
      return;
    }
    _hitboxBounds.getCenter(_hitboxCenterWorld);
    this._hitboxOffset.copy(_hitboxCenterWorld);
    this.object3D.worldToLocal(this._hitboxOffset);
    _hitboxBounds.getSize(_hitboxSize);
    this._hitboxRadius = Math.max(_hitboxSize.x, _hitboxSize.y, _hitboxSize.z) * 0.5 || this.radius;
  }

  _syncHitboxTransform() {
    if (!this.hitbox || !this.object3D) return;
    _hitboxOffsetWorld.copy(this._hitboxOffset);
    _hitboxOffsetWorld.multiply(this.object3D.scale);
    _hitboxOffsetWorld.applyQuaternion(this.object3D.quaternion);
    this.hitbox.position.copy(this.object3D.position).add(_hitboxOffsetWorld);
    this.hitbox.quaternion.copy(this.object3D.quaternion);
  }
}
