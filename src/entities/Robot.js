import { Vector3, Group, Color, Box3, BoxGeometry, SphereGeometry, CylinderGeometry, MeshStandardMaterial, Mesh, AnimationMixer, LoopOnce } from "three";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import Entity from "../core/Entity.js";
import * as CANNON from "cannon-es";
import Debris from "./Debris.js";

const ROBOT_MODEL_URL = `${import.meta.env.BASE_URL}assets/models/RobotExpressive/RobotExpressive.glb`;
const ROBOT_FOOT_SOLE_OFFSET = 0.08; // Approx. ankle -> sole distance in meters
const ROBOT_HEAD_TARGET_Y = 1.6; // Aim head center at player eye height

// Robot target with head/body/legs hitboxes and armor system
export default class Robot extends Entity {
  constructor({ modeConfig, renderProfile, moving, speed, position, hasArmor = false, modelScale = 1, modelYOffset = 0 }) {
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
    this.radius = 0.6;

    this.object3D.userData.entity = this;
    this.hitboxes = {
      head: null,
      body: null,
      legs: null
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

    // Derived from model (when glTF is used) to keep hitboxes/physics in sync with asset scale.
    this._hitboxLayout = null; // { headCenterY, headRadius, bodyCenterY, bodySize, legsCenterY, legsSize, neckY, hipsY }

    // Manual tuning knobs (applied on top of normalization).
    this.modelScale = Number.isFinite(modelScale) ? modelScale : 1;
    this.modelYOffset = Number.isFinite(modelYOffset) ? modelYOffset : 0;
    this._baseModelScale = new Vector3(1, 1, 1);
    this._baseModelPosition = new Vector3();
    this._baseRobotHeight = this.robotHeight;
    this._baseRadius = this.radius;
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
    const physicsRadius = 0.3 * this.modelScale;
    this.body = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Cylinder(physicsRadius, physicsRadius, this.robotHeight, 8),
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
      this._baseModelScale.copy(root.scale);
      this._baseModelPosition.copy(root.position);
      this._tagModelMeshesForHitTesting(root);

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

      // Derive hitbox layout from the actual rig proportions (so model scale/units don't break hitboxes).
      this._hitboxLayout = this._computeHitboxLayoutFromModel(root);
      if (this._hitboxLayout?.headCenterY && this._hitboxLayout?.headRadius) {
        // Keep the physics proxy height roughly consistent with the visible model.
        this.robotHeight = Math.max(1.2, this._hitboxLayout.headCenterY + this._hitboxLayout.headRadius * 1.15);
      }
      this._baseRobotHeight = this.robotHeight;
      this._baseRadius = this.radius;

      // Apply user tuning (scale/height) on top of the normalized model.
      this.setModelTuning(this.modelScale, this.modelYOffset);

      // Note: _normalizeAndScaleModel already positions the model with feet at Y=0
      // Don't call _snapFeetToGround as it may interfere
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

  _tagModelMeshesForHitTesting(root) {
    if (!root) return;
    root.traverse((child) => {
      if (!child.isMesh) return;
      const name = (child.name || "").toLowerCase();
      let bodyPart = "body";
      if (name.includes("head")) bodyPart = "head";
      else if (name.includes("leg") || name.includes("foot")) bodyPart = "legs";
      child.userData.entity = this;
      child.userData.bodyPart = bodyPart;
    });
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
    // Prefer skeleton-based normalization so cm-authored assets and odd bounding boxes
    // (e.g. outstretched hands) don't throw off scale.
    const bones = this._getSkeletonBones(root);
    const headBone = bones?.find((b) => b?.name === "Head") || null;
    const footLBone = bones?.find((b) => b?.name === "Foot.L") || null;
    const footRBone = bones?.find((b) => b?.name === "Foot.R") || null;

    if (headBone && (footLBone || footRBone)) {
      const tmp = new Vector3();
      root.updateWorldMatrix(true, true);
      headBone.getWorldPosition(tmp);
      const headY = tmp.y;

      let minFootY = Number.POSITIVE_INFINITY;
      if (footLBone) {
        footLBone.getWorldPosition(tmp);
        minFootY = Math.min(minFootY, tmp.y);
      }
      if (footRBone) {
        footRBone.getWorldPosition(tmp);
        minFootY = Math.min(minFootY, tmp.y);
      }

      const footSoleY = minFootY - ROBOT_FOOT_SOLE_OFFSET;
      const headHeight = headY - footSoleY;
      if (headHeight > 0.001) {
        const scaleFactor = ROBOT_HEAD_TARGET_Y / headHeight;
        root.scale.multiplyScalar(scaleFactor);
      }

      root.updateWorldMatrix(true, true);
      this._snapFeetToGround(root);

      // Debug: log resulting bbox after normalization (useful when assets come in different units).
      root.updateWorldMatrix(true, true);
      const scaledBox = new Box3().setFromObject(root);
      const scaledSize = new Vector3();
      scaledBox.getSize(scaledSize);
      console.log(
        `Robot model normalized bbox: ${scaledSize.x.toFixed(2)} x ${scaledSize.y.toFixed(2)} x ${scaledSize.z.toFixed(2)} meters`
      );
      return;
    }

    // Fallback: bbox-based normalization (works for simple static meshes).
    const targetHeight = this.robotHeight;

    // First, compute the model's original bounding box
    root.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(root);
    const size = new Vector3();
    box.getSize(size);

    console.log(`Robot model original bbox size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`);

    // Scale model so its height becomes targetHeight (1.75m)
    // Regardless of what units the model uses, we want final height = targetHeight
    let scaleFactor = 1.0;
    if (size.y > 0.001) {
      scaleFactor = targetHeight / size.y;
      console.log(`Robot scale factor: ${scaleFactor.toFixed(6)} (${size.y.toFixed(2)} -> ${targetHeight}m)`);
    }

    // Preserve any authoring/export scale on the root (e.g. cm-authored models)
    // by applying our normalization as a multiplier instead of overwriting it.
    root.scale.multiplyScalar(scaleFactor);

    // Recompute bounding box after scaling
    root.updateWorldMatrix(true, true);
    const scaledBox = new Box3().setFromObject(root);
    const scaledSize = new Vector3();
    scaledBox.getSize(scaledSize);

    console.log(`Robot model scaled bbox: ${scaledSize.x.toFixed(2)} x ${scaledSize.y.toFixed(2)} x ${scaledSize.z.toFixed(2)} meters`);
    console.log(`Robot scaled bbox min.y: ${scaledBox.min.y.toFixed(4)}`);

    // Move model so its feet (bottom of bounding box) are at Y = 0.
    // Subtract instead of overwriting to preserve any authoring offset.
    root.position.y -= scaledBox.min.y;
    console.log(`Robot root.position.y adjusted to: ${root.position.y.toFixed(4)}`);
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

  _getSkeletonBones(root) {
    if (!root) return null;
    let skinnedMesh = null;
    root.traverse((obj) => {
      if (!skinnedMesh && obj.isSkinnedMesh) skinnedMesh = obj;
    });
    return skinnedMesh?.skeleton?.bones || null;
  }

  _computeHitboxLayoutFromModel(root) {
    const bones = this._getSkeletonBones(root);
    if (!bones || bones.length === 0) return null;

    const byName = new Map();
    for (const b of bones) {
      if (!b?.name) continue;
      if (!byName.has(b.name)) byName.set(b.name, b);
    }

    const head = byName.get("Head") || null;
    const neck = byName.get("Neck") || null;
    const hips = byName.get("Hips") || null;
    const footL = byName.get("Foot.L") || null;
    const footR = byName.get("Foot.R") || null;
    const shL = byName.get("Shoulder.L") || null;
    const shR = byName.get("Shoulder.R") || null;
    const legL = byName.get("UpperLeg.L") || null;
    const legR = byName.get("UpperLeg.R") || null;

    const tmp = new Vector3();
    const tmp2 = new Vector3();

    root.updateWorldMatrix(true, true);

    if (!head || !hips || !neck) return null;

    head.getWorldPosition(tmp);
    const headY = tmp.y;

    neck.getWorldPosition(tmp);
    const neckY = tmp.y;

    hips.getWorldPosition(tmp);
    const hipsY = tmp.y;

    let minFootY = Number.POSITIVE_INFINITY;
    if (footL) {
      footL.getWorldPosition(tmp);
      minFootY = Math.min(minFootY, tmp.y);
    }
    if (footR) {
      footR.getWorldPosition(tmp);
      minFootY = Math.min(minFootY, tmp.y);
    }
    const groundY = Number.isFinite(minFootY) ? (minFootY - ROBOT_FOOT_SOLE_OFFSET) : 0;

    // Width heuristics from rig measurements
    let shoulderWidth = 0;
    if (shL && shR) {
      shL.getWorldPosition(tmp);
      shR.getWorldPosition(tmp2);
      shoulderWidth = tmp.distanceTo(tmp2);
    }

    let hipWidth = 0;
    if (legL && legR) {
      legL.getWorldPosition(tmp);
      legR.getWorldPosition(tmp2);
      hipWidth = tmp.distanceTo(tmp2);
    }

    // Fallback widths from overall bounds if rig points are missing/unreasonable.
    const bounds = new Box3().setFromObject(root);
    const boundsSize = new Vector3();
    bounds.getSize(boundsSize);
    if (!Number.isFinite(shoulderWidth) || shoulderWidth < 0.05) shoulderWidth = boundsSize.x * 0.25;
    if (!Number.isFinite(hipWidth) || hipWidth < 0.05) hipWidth = boundsSize.x * 0.18;

    const headRadius = Math.max(0.12, Math.min(0.28, shoulderWidth * 0.22));
    const bodyWidth = Math.max(0.25, shoulderWidth * 0.95);
    const bodyDepth = Math.max(0.18, bodyWidth * 0.55);
    const bodyHeight = Math.max(0.35, neckY - hipsY);

    const legsWidth = Math.max(0.22, hipWidth * 1.25);
    const legsDepth = Math.max(0.16, legsWidth * 0.55);
    const legsHeight = Math.max(0.25, hipsY - groundY);

    return {
      headCenterY: headY,
      headRadius,
      bodyCenterY: hipsY + bodyHeight * 0.5,
      bodySize: new Vector3(bodyWidth, bodyHeight, bodyDepth),
      legsCenterY: groundY + legsHeight * 0.5,
      legsSize: new Vector3(legsWidth, legsHeight, legsDepth),
      neckY,
      hipsY,
      groundY
    };
  }

  setModelTuning(scale, yOffset) {
    const nextScale = Number.isFinite(scale) ? scale : this.modelScale;
    const nextYOffset = Number.isFinite(yOffset) ? yOffset : this.modelYOffset;

    this.modelScale = Math.max(0.001, nextScale);
    this.modelYOffset = nextYOffset;

    // Keep derived dimensions consistent for physics + overlap checks.
    this.robotHeight = this._baseRobotHeight * this.modelScale;
    this.radius = this._baseRadius * this.modelScale;

    // Apply to the visual model.
    if (this.modelRoot) {
      this.modelRoot.scale.copy(this._baseModelScale).multiplyScalar(this.modelScale);
      // Scale the base position too so feet stay grounded when scaling.
      this.modelRoot.position.copy(this._baseModelPosition).multiplyScalar(this.modelScale);
      this.modelRoot.position.y += this.modelYOffset;
      this.modelRoot.updateWorldMatrix(true, true);
    } else {
      // Fallback meshes live directly under object3D.
      this.object3D.scale.setScalar(this.modelScale);
    }

    // Apply to hitboxes (if already created).
    for (const hitbox of Object.values(this.hitboxes)) {
      if (!hitbox) continue;
      hitbox.scale.setScalar(this.modelScale);
    }
    this._syncHitboxPositions();

    this._refreshPhysicsShape();
  }

  _refreshPhysicsShape() {
    if (!this.body) return;
    const physicsRadius = 0.3 * this.modelScale;
    const shapes = [...this.body.shapes];
    for (const s of shapes) this.body.removeShape(s);
    this.body.addShape(new CANNON.Cylinder(physicsRadius, physicsRadius, this.robotHeight, 8));
    this.body.updateBoundingRadius();
    this.body.aabbNeedsUpdate = true;
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

    // Calculate positions from ground up to ensure proper proportions
    // Total height: 1.8m, head center at ~1.6m (player eye level)
    const footHeight = 0.05;
    const lowerLegLength = 0.4;
    const kneeRadius = this.legRadius * 1.2;
    const upperLegLength = 0.4;
    const hipHeight = 0.1;
    const neckHeight = 0.1;

    // Position calculations from ground (Y=0) upward
    const footY = footHeight / 2;                                    // 0.025
    const lowerLegY = footHeight + lowerLegLength / 2;               // 0.25
    const kneeY = footHeight + lowerLegLength;                       // 0.45
    const upperLegY = kneeY + upperLegLength / 2;                    // 0.65
    const hipY = kneeY + upperLegLength + hipHeight / 2;             // 0.9
    const bodyY = hipY + hipHeight / 2 + this.bodyHeight / 2;        // 1.3
    const neckY = bodyY + this.bodyHeight / 2 + neckHeight / 2;      // 1.7
    const headY = neckY + neckHeight / 2 + this.headRadius;          // 1.87 -> adjusted

    // Adjust so head center is at 1.6m (player eye level)
    const headTargetY = 1.6;
    const currentHeadY = neckY + neckHeight / 2 + this.headRadius;
    const yOffset = headTargetY - currentHeadY;

    // Head (sphere) - positioned at player eye level
    const headGeo = new SphereGeometry(this.headRadius, 16, 12);
    const headMesh = new Mesh(headGeo, bodyMat.clone());
    headMesh.material.emissive = new Color(0xff0000).multiplyScalar(0.2);
    headMesh.position.y = headTargetY;
    headMesh.castShadow = true;
    headMesh.userData.bodyPart = 'head';
    this.object3D.add(headMesh);

    // Neck
    const neckGeo = new CylinderGeometry(0.06, 0.1, neckHeight, 8);
    const neckMesh = new Mesh(neckGeo, jointMat);
    neckMesh.position.y = headTargetY - this.headRadius - neckHeight / 2;
    neckMesh.castShadow = true;
    this.object3D.add(neckMesh);

    // Body (box)
    const bodyActualY = neckMesh.position.y - neckHeight / 2 - this.bodyHeight / 2;
    const bodyGeo = new BoxGeometry(this.bodyWidth, this.bodyHeight, this.bodyWidth * 0.6);
    const bodyMesh = new Mesh(bodyGeo, this.hasArmor ? armorMat : bodyMat);
    bodyMesh.position.y = bodyActualY;
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
    const hipActualY = bodyActualY - this.bodyHeight / 2 - hipHeight / 2;
    const hipGeo = new BoxGeometry(this.bodyWidth * 0.8, hipHeight, this.bodyWidth * 0.5);
    const hipMesh = new Mesh(hipGeo, jointMat);
    hipMesh.position.y = hipActualY;
    hipMesh.castShadow = true;
    this.object3D.add(hipMesh);

    // Legs - calculate from hip down to ground
    const legSpacing = this.bodyWidth * 0.35;
    const legTopY = hipActualY - hipHeight / 2;
    const totalLegHeight = legTopY - footHeight; // Distance from hip bottom to foot top
    const upperLegActualLength = totalLegHeight * 0.5;
    const lowerLegActualLength = totalLegHeight * 0.5;

    // Left upper leg
    const leftUpperLegGeo = new CylinderGeometry(this.legRadius, this.legRadius * 0.85, upperLegActualLength, 8);
    const leftUpperLegMesh = new Mesh(leftUpperLegGeo, this.hasArmor ? armorMat : bodyMat);
    leftUpperLegMesh.position.set(-legSpacing, legTopY - upperLegActualLength / 2, 0);
    leftUpperLegMesh.castShadow = true;
    leftUpperLegMesh.userData.bodyPart = 'legs';
    this.object3D.add(leftUpperLegMesh);

    // Left knee joint
    const leftKneeY = legTopY - upperLegActualLength;
    const leftKneeGeo = new SphereGeometry(this.legRadius * 1.1, 8, 8);
    const leftKneeMesh = new Mesh(leftKneeGeo, jointMat);
    leftKneeMesh.position.set(-legSpacing, leftKneeY, 0);
    leftKneeMesh.castShadow = true;
    this.object3D.add(leftKneeMesh);

    // Left lower leg
    const leftLowerLegGeo = new CylinderGeometry(this.legRadius * 0.85, this.legRadius * 0.7, lowerLegActualLength, 8);
    const leftLowerLegMesh = new Mesh(leftLowerLegGeo, bodyMat);
    leftLowerLegMesh.position.set(-legSpacing, leftKneeY - lowerLegActualLength / 2, 0);
    leftLowerLegMesh.castShadow = true;
    leftLowerLegMesh.userData.bodyPart = 'legs';
    this.object3D.add(leftLowerLegMesh);

    // Left foot
    const leftFootGeo = new BoxGeometry(this.legRadius * 2.5, footHeight, this.legRadius * 3.5);
    const leftFootMesh = new Mesh(leftFootGeo, jointMat);
    leftFootMesh.position.set(-legSpacing, footHeight / 2, this.legRadius * 0.8);
    leftFootMesh.castShadow = true;
    leftFootMesh.userData.bodyPart = 'legs';
    this.object3D.add(leftFootMesh);

    // Right leg (mirror of left)
    const rightUpperLegMesh = new Mesh(leftUpperLegGeo.clone(), this.hasArmor ? armorMat.clone() : bodyMat.clone());
    rightUpperLegMesh.position.set(legSpacing, legTopY - upperLegActualLength / 2, 0);
    rightUpperLegMesh.castShadow = true;
    rightUpperLegMesh.userData.bodyPart = 'legs';
    this.object3D.add(rightUpperLegMesh);

    const rightKneeMesh = new Mesh(leftKneeGeo.clone(), jointMat.clone());
    rightKneeMesh.position.set(legSpacing, leftKneeY, 0);
    rightKneeMesh.castShadow = true;
    this.object3D.add(rightKneeMesh);

    const rightLowerLegMesh = new Mesh(leftLowerLegGeo.clone(), bodyMat.clone());
    rightLowerLegMesh.position.set(legSpacing, leftKneeY - lowerLegActualLength / 2, 0);
    rightLowerLegMesh.castShadow = true;
    rightLowerLegMesh.userData.bodyPart = 'legs';
    this.object3D.add(rightLowerLegMesh);

    const rightFootMesh = new Mesh(leftFootGeo.clone(), jointMat.clone());
    rightFootMesh.position.set(legSpacing, footHeight / 2, this.legRadius * 0.8);
    rightFootMesh.castShadow = true;
    rightFootMesh.userData.bodyPart = 'legs';
    this.object3D.add(rightFootMesh);

    // Eyes (glowing) - positioned at head level
    const eyeMat = new MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 2
    });
    const eyeGeo = new SphereGeometry(0.03, 8, 8);

    const leftEye = new Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.06, headTargetY, this.headRadius * 0.85);
    this.object3D.add(leftEye);

    const rightEye = new Mesh(eyeGeo, eyeMat.clone());
    rightEye.position.set(0.06, headTargetY, this.headRadius * 0.85);
    this.object3D.add(rightEye);
  }

  _createHitboxes() {
    const hitboxMat = new MeshStandardMaterial({
      color: 0xff0000,
      wireframe: true,
      visible: false // Set to true for debugging
    });

    const layout = this._hitboxLayout;
    const headRadius = layout?.headRadius || this.headRadius * 1.3;
    const bodySize = layout?.bodySize || new Vector3(this.bodyWidth * 1.2, this.bodyHeight * 1.2, this.bodyWidth * 0.8);
    const legsSize = layout?.legsSize || null;

    // Head hitbox
    const headHitboxGeo = new SphereGeometry(headRadius, 8, 8);
    this.hitboxes.head = new Mesh(headHitboxGeo, hitboxMat.clone());
    this.hitboxes.head.userData.entity = this;
    this.hitboxes.head.userData.bodyPart = 'head';
    this.hitboxes.head.scale.setScalar(this.modelScale);

    // Body hitbox
    const bodyHitboxGeo = new BoxGeometry(bodySize.x, bodySize.y, bodySize.z);
    this.hitboxes.body = new Mesh(bodyHitboxGeo, hitboxMat.clone());
    this.hitboxes.body.userData.entity = this;
    this.hitboxes.body.userData.bodyPart = 'body';
    this.hitboxes.body.scale.setScalar(this.modelScale);

    // Legs hitbox (combined)
    if (legsSize) {
      const legsHitboxGeo = new BoxGeometry(legsSize.x, legsSize.y, legsSize.z);
      this.hitboxes.legs = new Mesh(legsHitboxGeo, hitboxMat.clone());
    } else {
      // Fallback dimensions
      const headY = ROBOT_HEAD_TARGET_Y;
      const neckHeight = 0.1;
      const hipHeight = 0.1;
      const bodyBottomY = headY - this.headRadius - neckHeight - this.bodyHeight - hipHeight / 2;
      const legsHeight = bodyBottomY;
      const legsHitboxGeo = new BoxGeometry(this.bodyWidth * 1.0, legsHeight, this.bodyWidth * 0.5);
      this.hitboxes.legs = new Mesh(legsHitboxGeo, hitboxMat.clone());
    }
    this.hitboxes.legs.userData.entity = this;
    this.hitboxes.legs.userData.bodyPart = 'legs';
    this.hitboxes.legs.scale.setScalar(this.modelScale);

    this._syncHitboxPositions();
  }

  _syncHitboxPositions() {
    if (!this.hitboxes.head) return;

    const pos = this.object3D.position;
    const layout = this._hitboxLayout;
    const scale = this.modelScale;
    const yOffset = this.modelYOffset;

    // Head
    const headY = (layout?.headCenterY ?? ROBOT_HEAD_TARGET_Y) * scale + yOffset;
    this.hitboxes.head.position.set(pos.x, pos.y + headY, pos.z);
    this.hitboxes.head.quaternion.copy(this.object3D.quaternion);

    // Body
    const bodyBaseY = layout?.bodyCenterY ?? (ROBOT_HEAD_TARGET_Y - this.headRadius - 0.1 - this.bodyHeight / 2);
    const bodyY = bodyBaseY * scale + yOffset;
    this.hitboxes.body.position.set(pos.x, pos.y + bodyY, pos.z);
    this.hitboxes.body.quaternion.copy(this.object3D.quaternion);

    // Legs
    const legsBaseY = layout?.legsCenterY ?? ((ROBOT_HEAD_TARGET_Y - this.headRadius - 0.1 - this.bodyHeight - 0.1) / 2);
    const legsY = legsBaseY * scale + yOffset;
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

    const layout = this._hitboxLayout;
    const scale = this.modelScale;
    const yOffset = this.modelYOffset;

    const neckBaseY = layout?.neckY ?? (ROBOT_HEAD_TARGET_Y - this.headRadius - 0.1);
    const hipsBaseY = layout?.hipsY ?? (neckBaseY - this.bodyHeight - 0.1);
    const neckY = neckBaseY * scale + yOffset;
    const hipsY = hipsBaseY * scale + yOffset;

    // Head zone (from neck top upward)
    if (localY > neckY) {
      return 'head';
    }
    // Body zone (from hip top to neck bottom)
    if (localY > hipsY) {
      return 'body';
    }
    // Legs zone (from ground to hip)
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
