import { Vector3, Group, Color, Box3, Matrix4, SphereGeometry, MeshBasicMaterial, Mesh } from "three";
import Entity from "../core/Entity.js";
import * as CANNON from "cannon-es";
import Debris from "./Debris.js";
import { OBB } from "three/examples/jsm/math/OBB.js";

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
  }

  async build(scene, world) {
    this.world = world;
    const mesh = await this.renderProfile.createTargetMesh({
      color: this.color,
      radius: this.radius,
      gltfTargets: this.modeConfig.gltfTargets
    });
    if (mesh) this.object3D.add(mesh);

    // Use the mesh's geometry for the hitbox, but simplify if it's too complex
    let targetGeo;
    if (mesh.isMesh) {
      targetGeo = mesh.geometry;
    } else {
      mesh.traverse(child => {
        if (child.isMesh && !targetGeo) {
          targetGeo = child.geometry;
        }
      });
    }

    let hitboxGeo;
    if (targetGeo && targetGeo.attributes.position.count > 100) {
      // For complex models (like drones), use a simple sphere
      hitboxGeo = new SphereGeometry(this.radius, 8, 8);
    } else if (targetGeo) {
      // For simple shapes, use their actual geometry
      hitboxGeo = targetGeo;
    } else {
      // Fallback for GLTFs or other complex objects without a single geometry
      hitboxGeo = new SphereGeometry(this.radius, 8, 8);
    }

    const hitboxMat = new MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      visible: true // Visible for debugging; set to false to hide
    });
    this.hitbox = new Mesh(hitboxGeo, hitboxMat);
    this.hitbox.userData.entity = this;

    this.object3D.position.copy(this.position);
    this.hitbox.position.copy(this.position);
    scene.add(this.object3D);

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
      this.hitbox.position.copy(this.body.position);
      this._boundsDirty = true;
    }
  }
}
