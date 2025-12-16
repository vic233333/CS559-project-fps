import { Vector3, Group, Color, Box3, BoxGeometry, SphereGeometry, CylinderGeometry, MeshStandardMaterial, Mesh, AnimationMixer, LoopOnce } from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import Entity from "../core/Entity.js";
import * as CANNON from "cannon-es";
import Debris from "./Debris.js";

const ROBOT_MODEL_URL = `${import.meta.env.BASE_URL}assets/models/RobotExpressive/RobotExpressive.glb`;
const ROBOT_FOOT_SOLE_OFFSET = 0.08; // Approx. ankle -> sole distance in meters

// Robot target with head/body/legs hitboxes and armor system
export default class Robot extends Entity {
  constructor({ modeConfig, renderProfile, moving, speed, position, hasArmor = false }) {
    super(new Group());
    this.modeConfig = modeConfig;
    this.renderProfile = renderProfile;
    this.moving = moving;
    this.speed = speed;
    this.position = position ? position.clone() : new Vector3();

    // Robot stats
    this.maxHealth = 100;
    this.health = 100;
    this.maxArmor = hasArmor ? 50 : 0;
    this.armor = this.maxArmor;
    this.hasArmor = hasArmor;

    // Damage values for different body parts
    this.damageMultipliers = {
      head: 160,    // Headshot - instant kill potential
      body: 40,     // Body shot
      legs: 34      // Leg shot
    };

    // Armor absorbs 50% damage to body and legs
    this.armorAbsorption = 0.5;

    this.time = Math.random() * Math.PI * 2;
    this.moveDirection = new Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    this.moveTimer = 0;
    this.directionChangeInterval = 2 + Math.random() * 2;

    // Robot dimensions
    // Head center sits at ~1.6m when feet are on ground (aligns with player camera height).
    this.robotHeight = 1.75;
    this.headRadius = 0.15;
    this.bodyWidth = 0.4;
    this.bodyHeight = 0.6;
    this.legHeight = 0.6;
    this.legRadius = 0.08;

    // Radius for overlap detection
    this.radius = 0.5;

    this.object3D.userData.entity = this;
    this.hitboxes = {
      head: null,
      body: null,
      leftLeg: null,
      rightLeg: null
    };
    this.world = null;

    // Color based on armor
    this.baseColor = hasArmor ? 0x4488ff : 0x44ff88;
    this.armorColor = 0x8888ff;

    // Imported model + skeletal animation
    this.modelRoot = null;
    this.mixer = null;
    this.actions = {};
    this.activeAction = null;
    this.activeActionName = null;

    // Death animation / cleanup
    this.dying = false;
    this.deathTimer = 0;
    this.deathDuration = 0;
    this.deathPosition = new Vector3();
    this.updateWhileDead = false;
    this.pendingRemoval = false;

    // Hit flash state (per-robot materials are cloned)
    this._flashBaseline = new Map(); // material.uuid -> { emissive, emissiveIntensity, color }
    this._flashTimeout = null;
  }

  async build(scene, world) {
    this.world = world;

    // Create robot mesh (prefer imported model with animations, fallback to primitives)
    await this._createRobotModel();

    this.object3D.position.copy(this.position);
    scene.add(this.object3D);

    // Create hitboxes for each body part
    this._createHitboxes();

    // Physics body (simple cylinder for movement)
    this.body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Cylinder(0.3, 0.3, this.robotHeight, 8),
      position: new CANNON.Vec3(this.position.x, this.position.y, this.position.z)
    });
    this.body.isDynamicCollider = true;
    this.body.entity = this;
    world.physicsWorld.addBody(this.body);
  }

  async _createRobotModel() {
    try {
      const assetManager = this.world?.assetManager;
      if (!assetManager) {
        throw new Error("AssetManager not available");
      }

      // Vite is deployed under a non-root base path; try BASE_URL first, then fall back to root.
      const urlsToTry = [
        ROBOT_MODEL_URL,
        "/assets/models/RobotExpressive/RobotExpressive.glb"
      ];

      let gltf = null;
      let lastErr = null;
      for (const url of urlsToTry) {
        try {
          gltf = await assetManager.loadGLTF(url);
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!gltf) throw lastErr || new Error("Failed to load robot GLTF");

      const root = SkeletonUtils.clone(gltf.scene);
      this._cloneModelMaterials(root);

      this._normalizeAndScaleModel(root);

      // Shadows
      root.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      this.object3D.add(root);
      this.modelRoot = root;

      this._setupAnimations(gltf.animations || []);
      this._setAnimation(this.moving ? "Walking" : "Idle", true);
      if (this.mixer) {
        // Ensure the initial pose is applied before we do any post-normalization.
        this.mixer.update(0);
      }
      this._snapFeetToGround(root);
      return;
    } catch (err) {
      console.warn(
        "Robot model load failed, using primitive fallback:",
        ROBOT_MODEL_URL,
        err
      );
      this._createFallbackRobotMesh();
    }
  }

  _cloneModelMaterials(root) {
    root.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      if (Array.isArray(child.material)) {
        child.material = child.material.map((m) => (m ? m.clone() : m));
      } else {
        child.material = child.material.clone();
      }
    });
  }

  _setupAnimations(clips) {
    if (!this.modelRoot || clips.length === 0) return;

    this.mixer = new AnimationMixer(this.modelRoot);
    this.actions = {};
    for (const clip of clips) {
      this.actions[clip.name] = this.mixer.clipAction(clip);
    }
  }

  _setAnimation(name, immediate = false) {
    if (!this.actions || !this.actions[name] || this.activeActionName === name) return;

    const next = this.actions[name];
    next.enabled = true;
    next.reset();

    if (!this.activeAction) {
      next.play();
      this.activeAction = next;
      this.activeActionName = name;
      return;
    }

    if (immediate) {
      this.activeAction.stop();
      next.play();
      this.activeAction = next;
      this.activeActionName = name;
      return;
    }

    const from = this.activeAction;
    next.play();
    from.crossFadeTo(next, 0.2, false);
    this.activeAction = next;
    this.activeActionName = name;
  }

  _normalizeAndScaleModel(root) {
    const desiredHeadY = this.robotHeight - this.headRadius; // ~1.6m
    root.updateWorldMatrix(true, true);

    let skinnedMesh = null;
    root.traverse((obj) => {
      if (!skinnedMesh && obj.isSkinnedMesh) skinnedMesh = obj;
    });
    const bones = skinnedMesh?.skeleton?.bones || null;

    const findBone = (name, fallbackRegex = null) => {
      if (!bones) return null;
      const exact = bones.find((b) => b.name === name);
      if (exact) return exact;
      if (!fallbackRegex) return null;
      return (
        bones.find((b) => fallbackRegex.test(b.name) && !/(end|tip)$/i.test(b.name)) ||
        bones.find((b) => fallbackRegex.test(b.name)) ||
        null
      );
    };

    const headBone = findBone("Head", /head$/i);
    const footLBone = findBone("Foot.L", /^foot\.l$/i);
    const footRBone = findBone("Foot.R", /^foot\.r$/i);
    const footBones = [footLBone, footRBone].filter(Boolean);

    const alignFeet = () => {
      if (footBones.length === 0) return false;
      root.updateWorldMatrix(true, true);
      let minFootY = Number.POSITIVE_INFINITY;
      const tmp = new Vector3();
      for (const b of footBones) {
        b.getWorldPosition(tmp);
        if (tmp.y < minFootY) minFootY = tmp.y;
      }
      if (!Number.isFinite(minFootY)) return false;
      const groundY = minFootY - ROBOT_FOOT_SOLE_OFFSET;
      root.position.y -= groundY;
      return true;
    };

    if (headBone && footBones.length > 0) {
      // Align feet first, then scale based on head height, then re-align feet.
      alignFeet();
      root.updateWorldMatrix(true, true);
      const headPos = new Vector3();
      headBone.getWorldPosition(headPos);
      if (headPos.y > 0.001) {
        const scale = desiredHeadY / headPos.y;
        root.scale.setScalar(scale);
      }
      alignFeet();
      return;
    }

    // Fallback: use bounding box based alignment + overall height scaling.
    root.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(root);
    if (Number.isFinite(box.min.y) && Number.isFinite(box.max.y)) {
      root.position.y -= box.min.y;
    }
    const size = new Vector3();
    box.getSize(size);
    if (size.y > 0.001) {
      root.scale.setScalar(this.robotHeight / size.y);
    }
    root.updateWorldMatrix(true, true);
    const box2 = new Box3().setFromObject(root);
    if (Number.isFinite(box2.min.y) && Number.isFinite(box2.max.y)) {
      root.position.y -= box2.min.y;
    }
  }

  _snapFeetToGround(root) {
    if (!root) return;
    let skinnedMesh = null;
    root.traverse((obj) => {
      if (!skinnedMesh && obj.isSkinnedMesh) skinnedMesh = obj;
    });
    const bones = skinnedMesh?.skeleton?.bones || null;
    if (!bones) return;

    const footLBone = bones.find((b) => b.name === "Foot.L") || null;
    const footRBone = bones.find((b) => b.name === "Foot.R") || null;
    const footBones = [footLBone, footRBone].filter(Boolean);
    if (footBones.length === 0) return;

    root.updateWorldMatrix(true, true);
    let minFootY = Number.POSITIVE_INFINITY;
    const tmp = new Vector3();
    for (const b of footBones) {
      b.getWorldPosition(tmp);
      if (tmp.y < minFootY) minFootY = tmp.y;
    }
    if (!Number.isFinite(minFootY)) return;

    const groundY = minFootY - ROBOT_FOOT_SOLE_OFFSET;
    if (Math.abs(groundY) > 0.001) {
      root.position.y -= groundY;
    }
  }

  _createFallbackRobotMesh() {
    const bodyMat = new MeshStandardMaterial({
      color: new Color(this.baseColor),
      metalness: 0.6,
      roughness: 0.3,
      emissive: new Color(this.baseColor).multiplyScalar(0.1)
    });

    const armorMat = new MeshStandardMaterial({
      color: new Color(this.armorColor),
      metalness: 0.8,
      roughness: 0.2,
      emissive: new Color(this.armorColor).multiplyScalar(0.15)
    });

    const jointMat = new MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.9,
      roughness: 0.1
    });

    // Head (sphere)
    const headGeo = new SphereGeometry(this.headRadius, 16, 12);
    const headMesh = new Mesh(headGeo, bodyMat.clone());
    headMesh.material.emissive = new Color(0xff0000).multiplyScalar(0.2);
    headMesh.position.y = this.robotHeight - this.headRadius;
    headMesh.castShadow = true;
    headMesh.userData.bodyPart = 'head';
    this.object3D.add(headMesh);

    // Neck
    const neckGeo = new CylinderGeometry(0.05, 0.08, 0.1, 8);
    const neckMesh = new Mesh(neckGeo, jointMat);
    neckMesh.position.y = this.robotHeight - this.headRadius * 2 - 0.05;
    neckMesh.castShadow = true;
    this.object3D.add(neckMesh);

    // Body (box)
    const bodyGeo = new BoxGeometry(this.bodyWidth, this.bodyHeight, this.bodyWidth * 0.6);
    const bodyMesh = new Mesh(bodyGeo, this.hasArmor ? armorMat : bodyMat);
    bodyMesh.position.y = this.robotHeight - this.headRadius * 2 - 0.1 - this.bodyHeight / 2 - 0.05;
    bodyMesh.castShadow = true;
    bodyMesh.userData.bodyPart = 'body';
    this.object3D.add(bodyMesh);

    // Chest plate (armor indicator)
    if (this.hasArmor) {
      const chestGeo = new BoxGeometry(this.bodyWidth * 0.8, this.bodyHeight * 0.6, this.bodyWidth * 0.65);
      const chestMesh = new Mesh(chestGeo, armorMat);
      chestMesh.position.copy(bodyMesh.position);
      chestMesh.position.z += 0.02;
      chestMesh.castShadow = true;
      this.object3D.add(chestMesh);
    }

    // Hip joint
    const hipY = bodyMesh.position.y - this.bodyHeight / 2 - 0.05;
    const hipGeo = new BoxGeometry(this.bodyWidth * 0.8, 0.1, this.bodyWidth * 0.5);
    const hipMesh = new Mesh(hipGeo, jointMat);
    hipMesh.position.y = hipY;
    hipMesh.castShadow = true;
    this.object3D.add(hipMesh);

    // Legs
    const legSpacing = this.bodyWidth * 0.3;
    const legStartY = hipY - 0.05;

    // Left leg
    const leftLegGeo = new CylinderGeometry(this.legRadius, this.legRadius * 0.8, this.legHeight, 8);
    const leftLegMesh = new Mesh(leftLegGeo, this.hasArmor ? armorMat : bodyMat);
    leftLegMesh.position.set(-legSpacing, legStartY - this.legHeight / 2, 0);
    leftLegMesh.castShadow = true;
    leftLegMesh.userData.bodyPart = 'legs';
    this.object3D.add(leftLegMesh);

    // Left knee joint
    const leftKneeGeo = new SphereGeometry(this.legRadius * 1.2, 8, 8);
    const leftKneeMesh = new Mesh(leftKneeGeo, jointMat);
    leftKneeMesh.position.set(-legSpacing, legStartY - this.legHeight, 0);
    leftKneeMesh.castShadow = true;
    this.object3D.add(leftKneeMesh);

    // Left lower leg
    const leftLowerLegGeo = new CylinderGeometry(this.legRadius * 0.7, this.legRadius * 0.6, this.legHeight * 0.8, 8);
    const leftLowerLegMesh = new Mesh(leftLowerLegGeo, bodyMat);
    leftLowerLegMesh.position.set(-legSpacing, legStartY - this.legHeight - this.legHeight * 0.4, 0);
    leftLowerLegMesh.castShadow = true;
    leftLowerLegMesh.userData.bodyPart = 'legs';
    this.object3D.add(leftLowerLegMesh);

    // Left foot
    const leftFootGeo = new BoxGeometry(this.legRadius * 2.5, 0.05, this.legRadius * 3);
    const leftFootMesh = new Mesh(leftFootGeo, jointMat);
    leftFootMesh.position.set(-legSpacing, 0.025, this.legRadius * 0.5);
    leftFootMesh.castShadow = true;
    leftFootMesh.userData.bodyPart = 'legs';
    this.object3D.add(leftFootMesh);

    // Right leg (mirror of left)
    const rightLegMesh = new Mesh(leftLegGeo.clone(), this.hasArmor ? armorMat.clone() : bodyMat.clone());
    rightLegMesh.position.set(legSpacing, legStartY - this.legHeight / 2, 0);
    rightLegMesh.castShadow = true;
    rightLegMesh.userData.bodyPart = 'legs';
    this.object3D.add(rightLegMesh);

    const rightKneeMesh = new Mesh(leftKneeGeo.clone(), jointMat.clone());
    rightKneeMesh.position.set(legSpacing, legStartY - this.legHeight, 0);
    rightKneeMesh.castShadow = true;
    this.object3D.add(rightKneeMesh);

    const rightLowerLegMesh = new Mesh(leftLowerLegGeo.clone(), bodyMat.clone());
    rightLowerLegMesh.position.set(legSpacing, legStartY - this.legHeight - this.legHeight * 0.4, 0);
    rightLowerLegMesh.castShadow = true;
    rightLowerLegMesh.userData.bodyPart = 'legs';
    this.object3D.add(rightLowerLegMesh);

    const rightFootMesh = new Mesh(leftFootGeo.clone(), jointMat.clone());
    rightFootMesh.position.set(legSpacing, 0.025, this.legRadius * 0.5);
    rightFootMesh.castShadow = true;
    rightFootMesh.userData.bodyPart = 'legs';
    this.object3D.add(rightFootMesh);

    // Eyes (glowing)
    const eyeMat = new MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 2
    });
    const eyeGeo = new SphereGeometry(0.02, 8, 8);

    const leftEye = new Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.05, this.robotHeight - this.headRadius, this.headRadius * 0.8);
    this.object3D.add(leftEye);

    const rightEye = new Mesh(eyeGeo, eyeMat.clone());
    rightEye.position.set(0.05, this.robotHeight - this.headRadius, this.headRadius * 0.8);
    this.object3D.add(rightEye);
  }

  _createHitboxes() {
    const hitboxMat = new MeshStandardMaterial({
      color: 0xff0000,
      wireframe: true,
      visible: false // Set to true for debugging
    });

    // Head hitbox
    const headHitboxGeo = new SphereGeometry(this.headRadius * 1.2, 8, 8);
    this.hitboxes.head = new Mesh(headHitboxGeo, hitboxMat.clone());
    this.hitboxes.head.userData.entity = this;
    this.hitboxes.head.userData.bodyPart = 'head';

    // Body hitbox
    const bodyHitboxGeo = new BoxGeometry(this.bodyWidth * 1.1, this.bodyHeight * 1.1, this.bodyWidth * 0.7);
    this.hitboxes.body = new Mesh(bodyHitboxGeo, hitboxMat.clone());
    this.hitboxes.body.userData.entity = this;
    this.hitboxes.body.userData.bodyPart = 'body';

    // Legs hitbox (combined)
    const legsHitboxGeo = new BoxGeometry(this.bodyWidth * 1.2, this.legHeight * 1.8 + 0.1, this.bodyWidth * 0.6);
    this.hitboxes.legs = new Mesh(legsHitboxGeo, hitboxMat.clone());
    this.hitboxes.legs.userData.entity = this;
    this.hitboxes.legs.userData.bodyPart = 'legs';

    this._syncHitboxPositions();
  }

  _syncHitboxPositions() {
    if (!this.hitboxes.head) return;

    const pos = this.object3D.position;

    // Head
    this.hitboxes.head.position.set(
      pos.x,
      pos.y + this.robotHeight - this.headRadius,
      pos.z
    );
    this.hitboxes.head.quaternion.copy(this.object3D.quaternion);

    // Body
    const bodyY = this.robotHeight - this.headRadius * 2 - 0.1 - this.bodyHeight / 2 - 0.05;
    this.hitboxes.body.position.set(pos.x, pos.y + bodyY, pos.z);
    this.hitboxes.body.quaternion.copy(this.object3D.quaternion);

    // Legs
    const hipY = bodyY - this.bodyHeight / 2 - 0.05;
    const legsY = (hipY + 0) / 2; // Average between hip and ground
    this.hitboxes.legs.position.set(pos.x, pos.y + legsY, pos.z);
    this.hitboxes.legs.quaternion.copy(this.object3D.quaternion);
  }

  prePhysics(dt) {
    if (this.mixer) this.mixer.update(dt);

    if (this.dying) {
      this.deathTimer += dt;
      if (this.deathTimer >= this.deathDuration) {
        this._finalizeDeath();
      }
      return;
    }

    // Animation state selection
    if (this.moving) {
      const moveClip = this.speed >= 1.4 ? "Running" : "Walking";
      this._setAnimation(moveClip);
      if (this.activeAction) {
        this.activeAction.timeScale = Math.max(0.8, this.speed);
      }
    } else {
      this._setAnimation("Idle");
      if (this.activeAction) {
        this.activeAction.timeScale = 1;
      }
    }

    if (!this.moving || !this.body) return;

    this.time += dt * this.speed;
    this.moveTimer += dt;

    // Change direction periodically
    if (this.moveTimer > this.directionChangeInterval) {
      this.moveTimer = 0;
      this.directionChangeInterval = 2 + Math.random() * 2;
      this.moveDirection.set(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    }

    // Move robot
    const moveSpeed = 1.5 * this.speed;
    this.body.position.x += this.moveDirection.x * moveSpeed * dt;
    this.body.position.z += this.moveDirection.z * moveSpeed * dt;

    // Keep in bounds (simple boundary check)
    const bounds = 15;
    if (Math.abs(this.body.position.x) > bounds) {
      this.moveDirection.x *= -1;
      this.body.position.x = Math.sign(this.body.position.x) * bounds;
    }
    if (this.body.position.z < -bounds || this.body.position.z > 5) {
      this.moveDirection.z *= -1;
      this.body.position.z = Math.max(-bounds, Math.min(5, this.body.position.z));
    }
  }

  onHit(damage, hitPoint, bodyPart = 'body') {
    if (!this.alive) return { killed: false, damage: 0, bodyPart };

    // Determine body part from hitPoint if not provided
    if (!bodyPart && hitPoint) {
      bodyPart = this._getBodyPartFromPoint(hitPoint);
    }

    // Get actual damage based on body part
    let actualDamage = this.damageMultipliers[bodyPart] || this.damageMultipliers.body;

    // Apply armor absorption for body and legs
    if (this.armor > 0 && (bodyPart === 'body' || bodyPart === 'legs')) {
      const armorDamage = actualDamage * this.armorAbsorption;
      const absorbedDamage = Math.min(this.armor, armorDamage);
      this.armor -= absorbedDamage;
      actualDamage -= absorbedDamage;

      // Visual feedback for armor hit
      this._flashArmorHit();
    }

    this.health -= actualDamage;

    // Visual feedback for hit
    this._flashHit(bodyPart);

    if (this.health <= 0) {
      this._beginDeath();
      return { killed: true, damage: actualDamage, bodyPart };
    }

    return { killed: false, damage: actualDamage, bodyPart };
  }

  _getBodyPartFromPoint(hitPoint) {
    const localY = hitPoint.y - this.object3D.position.y;

    // Head zone (top 0.3 units)
    if (localY > this.robotHeight - this.headRadius * 2 - 0.1) {
      return 'head';
    }
    // Body zone (middle section)
    if (localY > this.robotHeight - this.headRadius * 2 - 0.1 - this.bodyHeight - 0.1) {
      return 'body';
    }
    // Legs zone (lower section)
    return 'legs';
  }

  _flashHit(bodyPart) {
    const flash = {
      head: { color: 0xff3333, intensity: 2.0, durationMs: 120 },
      body: { color: 0xff0000, intensity: 1.6, durationMs: 100 },
      legs: { color: 0xcc0033, intensity: 1.4, durationMs: 100 }
    }[bodyPart] || { color: 0xff0000, intensity: 1.6, durationMs: 100 };

    if (this.modelRoot) {
      this._flashModel(flash.color, flash.intensity, flash.durationMs);
      return;
    }

    // Fallback: flash the hit body part red briefly
    const targetColor = new Color(flash.color);
    this.object3D.traverse((child) => {
      if (!child.isMesh) return;
      if (child.userData.bodyPart !== bodyPart) return;
      if (!child.material || !child.material.emissive) return;

      const originalEmissive = child.material.emissive.clone();
      const originalIntensity = child.material.emissiveIntensity ?? 1;
      child.material.emissive.copy(targetColor);
      child.material.emissiveIntensity = flash.intensity;
      setTimeout(() => {
        if (!child.material) return;
        if (child.material.emissive) child.material.emissive.copy(originalEmissive);
        if (child.material.emissiveIntensity !== undefined) {
          child.material.emissiveIntensity = originalIntensity;
        }
      }, flash.durationMs);
    });
  }

  _flashArmorHit() {
    if (this.modelRoot) {
      this._flashModel(0x00ffff, 1.6, 120);
      return;
    }

    // Flash armor blue briefly
    this.object3D.traverse((child) => {
      if (!child.isMesh) return;
      if (!child.material?.color) return;
      if (child.material.color.getHex() !== this.armorColor) return;
      if (!child.material.emissive) return;

      const originalEmissive = child.material.emissive.clone();
      const originalIntensity = child.material.emissiveIntensity ?? 1;
      child.material.emissive.set(0x00ffff);
      child.material.emissiveIntensity = Math.max(originalIntensity, 1.6);
      setTimeout(() => {
        if (!child.material) return;
        if (child.material.emissive) child.material.emissive.copy(originalEmissive);
        if (child.material.emissiveIntensity !== undefined) {
          child.material.emissiveIntensity = originalIntensity;
        }
      }, 100);
    });
  }

  _flashModel(color, intensity = 1.6, durationMs = 100) {
    if (!this.modelRoot) return;

    if (this._flashTimeout) {
      clearTimeout(this._flashTimeout);
      this._flashTimeout = null;
    }

    const flashColor = new Color(color);
    const touched = new Set();

    this.modelRoot.traverse((child) => {
      if (!child.isMesh || !child.material) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        if (!mat || touched.has(mat.uuid)) continue;
        touched.add(mat.uuid);

        if (!this._flashBaseline.has(mat.uuid)) {
          this._flashBaseline.set(mat.uuid, {
            emissive: mat.emissive ? mat.emissive.clone() : null,
            emissiveIntensity: mat.emissiveIntensity ?? null,
            color: mat.color ? mat.color.clone() : null
          });
        }

        if (mat.emissive) {
          mat.emissive.copy(flashColor);
          if (mat.emissiveIntensity !== undefined && mat.emissiveIntensity !== null) {
            mat.emissiveIntensity = Math.max(mat.emissiveIntensity, intensity);
          }
        } else if (mat.color) {
          mat.color.lerp(flashColor, 0.6);
        }
      }
    });

    this._flashTimeout = setTimeout(() => {
      for (const uuid of touched) {
        const base = this._flashBaseline.get(uuid);
        if (!base) continue;

        this.modelRoot.traverse((child) => {
          if (!child.isMesh || !child.material) return;
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const mat of materials) {
            if (!mat || mat.uuid !== uuid) continue;
            if (base.emissive && mat.emissive) mat.emissive.copy(base.emissive);
            if (base.emissiveIntensity !== null && mat.emissiveIntensity !== undefined) {
              mat.emissiveIntensity = base.emissiveIntensity;
            }
            if (base.color && mat.color) mat.color.copy(base.color);
          }
        });
      }
      this._flashTimeout = null;
    }, durationMs);
  }

  _beginDeath() {
    if (this.dying) return;
    this.alive = false;
    this.dying = true;
    this.updateWhileDead = true;
    this.deathTimer = 0;
    this.moving = false;

    // Stop physics and lock current position.
    if (this.body) {
      this.object3D.position.copy(this.body.position);
      this.deathPosition.copy(this.body.position);
      this.world.physicsWorld.removeBody(this.body);
      this.body = null;
    } else {
      this.deathPosition.copy(this.object3D.position);
    }

    // Remove hitboxes so the dead body can't be shot again.
    if (this.hitboxes && this.world?.hittableGroup) {
      for (const key in this.hitboxes) {
        if (this.hitboxes[key]) {
          this.world.hittableGroup.remove(this.hitboxes[key]);
        }
      }
    }

    // Play the model's Death animation if present.
    const deathAction = this.actions?.Death || this.actions?.death || null;
    if (deathAction) {
      if (this.activeAction && this.activeAction !== deathAction) {
        this.activeAction.stop();
      }
      deathAction.reset();
      deathAction.enabled = true;
      deathAction.setLoop(LoopOnce, 1);
      deathAction.clampWhenFinished = true;
      deathAction.timeScale = 1;
      deathAction.play();
      this.activeAction = deathAction;
      this.activeActionName = "Death";
      this.deathDuration = (deathAction.getClip()?.duration || 1.2) + 0.15;
    } else {
      this.deathDuration = 0.4;
    }
  }

  _finalizeDeath() {
    if (!this.dying) return;
    this.dying = false;
    this.updateWhileDead = false;

    // Create shatter debris
    const numDebris = 15;
    const explosionStrength = 10;
    const colors = [this.baseColor, 0x333333, this.hasArmor ? this.armorColor : this.baseColor];

    for (let i = 0; i < numDebris; i++) {
      const size = 0.05 + Math.random() * 0.1;
      const randomDir = new CANNON.Vec3(
        Math.random() - 0.5,
        Math.random() * 0.5 + 0.3,
        Math.random() - 0.5
      ).unit();

      const debris = new Debris({
        world: this.world,
        initialPosition: new CANNON.Vec3(
          this.deathPosition.x + (Math.random() - 0.5) * 0.5,
          this.deathPosition.y + Math.random() * this.robotHeight,
          this.deathPosition.z + (Math.random() - 0.5) * 0.5
        ),
        initialVelocity: randomDir.scale(explosionStrength * (Math.random() * 0.75 + 0.25)),
        size: size,
        color: colors[Math.floor(Math.random() * colors.length)],
        lifespan: 1 + Math.random() * 1.5,
      });
      this.world.debris.push(debris);
    }

    this.pendingRemoval = true;
  }

  postPhysics() {
    if (this.body && this.alive) {
      this.object3D.position.copy(this.body.position);
      this._syncHitboxPositions();
    }
  }

  getHitboxes() {
    return Object.values(this.hitboxes).filter(h => h !== null);
  }

  // For compatibility with Target interface
  get hitbox() {
    return this.hitboxes.body;
  }

  getAABB() {
    const box = new Box3().setFromObject(this.object3D);
    return { min: box.min.clone(), max: box.max.clone() };
  }

  destroy(scene) {
    // Remove all hitboxes
    for (const key in this.hitboxes) {
      if (this.hitboxes[key]) {
        if (this.hitboxes[key].parent) {
          this.hitboxes[key].parent.remove(this.hitboxes[key]);
        }
        if (this.hitboxes[key].geometry) {
          this.hitboxes[key].geometry.dispose();
        }
        if (this.hitboxes[key].material) {
          this.hitboxes[key].material.dispose();
        }
      }
    }

    // Dispose all meshes in object3D
    this.object3D.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    // Call parent destroy
    super.destroy(scene);
  }
}
