import {
  Group,
  BoxGeometry,
  CylinderGeometry,
  SphereGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Mesh,
  Vector3,
  Quaternion,
  Euler,
  AdditiveBlending,
  PlaneGeometry,
  DoubleSide,
  PointLight
} from "three";
import StateMachine from "./StateMachine.js";

// Weapon view model - the gun/knife that appears in front of the camera
export default class WeaponViewModel {
  constructor(camera) {
    this.camera = camera;
    this.container = new Group();
    this.camera.add(this.container);

    // Weapon models
    this.weapons = {};
    this.currentWeapon = null;
    this.currentWeaponKey = "pistol";

    // Recoil state
    this.recoil = {
      current: new Vector3(),      // Current recoil offset
      target: new Vector3(),       // Target recoil to interpolate to
      recovery: new Vector3(),     // Recovery velocity
      viewPunch: new Euler(),      // Camera punch rotation
      viewPunchVelocity: new Euler(),
      accumulator: 0,              // Accumulated recoil for sustained fire
      timeSinceLastShot: Number.POSITIVE_INFINITY,
      burstShots: 0
    };

    // Tunables for view-model recoil feel
    this.recoilConfig = {
      stableShots: 3,
      burstResetTime: 0.25
    };

    // Animation state
    this.animation = {
      bobPhase: 0,
      bobAmplitude: 0,
      swayOffset: new Vector3(),
      swayVelocity: new Vector3()
    };

    // Muzzle flash state
    this.muzzleFlash = {
      active: false,
      timer: 0,
      light: null,
      meshes: []
    };

    // Knife attack state machine
    this.knifeState = new StateMachine("ready");
    this._setupKnifeStates();
    this.knifeSwingProgress = 0;
    this.knifeCanDamage = false;

    this._createWeapons();
  }

  _createWeapons() {
    this._createPistol();
    this._createKnife();
    this.switchWeapon("pistol");
  }

  _createPistol() {
    const group = new Group();

    const metalMat = new MeshStandardMaterial({
      color: 0x333333,
      metalness: 0.9,
      roughness: 0.3
    });

    const gripMat = new MeshStandardMaterial({
      color: 0x222222,
      metalness: 0.2,
      roughness: 0.8
    });

    // Slide (top part)
    const slideGeo = new BoxGeometry(0.04, 0.035, 0.18);
    const slide = new Mesh(slideGeo, metalMat);
    slide.position.set(0, 0.02, 0);
    group.add(slide);

    // Barrel
    const barrelGeo = new CylinderGeometry(0.008, 0.008, 0.06, 8);
    const barrel = new Mesh(barrelGeo, metalMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.12);
    group.add(barrel);

    // Frame (lower part)
    const frameGeo = new BoxGeometry(0.035, 0.025, 0.12);
    const frame = new Mesh(frameGeo, metalMat);
    frame.position.set(0, -0.005, 0.02);
    group.add(frame);

    // Grip
    const gripGeo = new BoxGeometry(0.03, 0.08, 0.035);
    const grip = new Mesh(gripGeo, gripMat);
    grip.position.set(0, -0.05, 0.06);
    grip.rotation.x = -0.2;
    group.add(grip);

    // Trigger guard
    const guardGeo = new BoxGeometry(0.025, 0.02, 0.04);
    const guard = new Mesh(guardGeo, metalMat);
    guard.position.set(0, -0.02, 0.03);
    group.add(guard);

    // Sights
    const frontSightGeo = new BoxGeometry(0.006, 0.01, 0.006);
    const frontSight = new Mesh(frontSightGeo, metalMat);
    frontSight.position.set(0, 0.045, -0.08);
    group.add(frontSight);

    const rearSightGeo = new BoxGeometry(0.02, 0.008, 0.006);
    const rearSight = new Mesh(rearSightGeo, metalMat);
    rearSight.position.set(0, 0.043, 0.06);
    group.add(rearSight);

    // Muzzle flash point
    group.userData.muzzlePoint = new Vector3(0, 0.02, -0.15);

    // Position in view
    group.position.set(0.15, -0.12, -0.3);
    group.rotation.set(0, 0, 0);

    this.weapons.pistol = group;
    this.container.add(group);
    group.visible = false;

    // Create muzzle flash for pistol
    this._createMuzzleFlash(group);
  }

  _createKnife() {
    const group = new Group();

    const bladeMat = new MeshStandardMaterial({
      color: 0x888899,
      metalness: 0.95,
      roughness: 0.1
    });

    const handleMat = new MeshStandardMaterial({
      color: 0x332211,
      metalness: 0.1,
      roughness: 0.9
    });

    // Blade
    const bladeGeo = new BoxGeometry(0.01, 0.025, 0.2);
    const blade = new Mesh(bladeGeo, bladeMat);
    blade.position.set(0, 0, -0.1);
    group.add(blade);

    // Blade edge (tapered)
    const edgeShape = new BoxGeometry(0.005, 0.02, 0.18);
    const edge = new Mesh(edgeShape, bladeMat);
    edge.position.set(-0.005, 0, -0.1);
    group.add(edge);

    // Blade tip
    const tipGeo = new BoxGeometry(0.008, 0.015, 0.03);
    const tip = new Mesh(tipGeo, bladeMat);
    tip.position.set(-0.002, 0, -0.21);
    tip.rotation.y = 0.3;
    group.add(tip);

    // Guard
    const guardGeo = new BoxGeometry(0.04, 0.008, 0.015);
    const guard = new Mesh(guardGeo, handleMat);
    guard.position.set(0, 0, 0.01);
    group.add(guard);

    // Handle
    const handleGeo = new CylinderGeometry(0.012, 0.015, 0.12, 8);
    const handle = new Mesh(handleGeo, handleMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0, 0.08);
    group.add(handle);

    // Position in view
    group.position.set(0.2, -0.15, -0.35);
    group.rotation.set(0.2, 0.5, 0);

    this.weapons.knife = group;
    this.container.add(group);
    group.visible = false;
  }

  _createMuzzleFlash(weaponGroup) {
    const flashGroup = new Group();

    // Multiple flash planes
    const flashMat = new MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      side: DoubleSide
    });

    for (let i = 0; i < 3; i++) {
      const size = 0.08 - i * 0.02;
      const geo = new PlaneGeometry(size, size);
      const flash = new Mesh(geo, flashMat.clone());
      flash.rotation.z = (i / 3) * Math.PI;
      flashGroup.add(flash);

      const flash2 = new Mesh(geo.clone(), flashMat.clone());
      flash2.rotation.y = Math.PI / 2;
      flash2.rotation.z = (i / 3) * Math.PI + 0.5;
      flashGroup.add(flash2);

      this.muzzleFlash.meshes.push(flash, flash2);
    }

    // Flash light
    const light = new PointLight(0xffaa00, 0, 2);
    flashGroup.add(light);
    this.muzzleFlash.light = light;

    // Position at muzzle
    flashGroup.position.copy(weaponGroup.userData.muzzlePoint || new Vector3(0, 0, -0.15));
    weaponGroup.add(flashGroup);

    this.muzzleFlash.group = flashGroup;
  }

  _setupKnifeStates() {
    this.knifeState
      .addState("ready", {
        onEnter: () => {
          this.knifeSwingProgress = 0;
          this.knifeCanDamage = false;
        }
      })
      .addState("swing", {
        onEnter: () => {
          this.knifeSwingProgress = 0;
          // Instant damage on swing start
          this.knifeCanDamage = true;
        },
        onUpdate: (dt) => {
          this.knifeSwingProgress += dt / 0.2; // 200ms swing
          // Damage window in first half of swing
          this.knifeCanDamage = this.knifeSwingProgress < 0.5;
          if (this.knifeSwingProgress >= 1) {
            this.knifeState.setState("recovery");
          }
        }
      })
      .addState("recovery", {
        onEnter: () => {
          this.knifeSwingProgress = 0;
          this.knifeCanDamage = false;
        },
        onUpdate: (dt) => {
          this.knifeSwingProgress += dt / 0.15; // 150ms recovery
          if (this.knifeSwingProgress >= 1) {
            this.knifeState.setState("ready");
          }
        }
      });
  }

  switchWeapon(weaponKey) {
    if (this.currentWeapon) {
      this.currentWeapon.visible = false;
    }

    if (this.weapons[weaponKey]) {
      this.weapons[weaponKey].visible = true;
      this.currentWeapon = this.weapons[weaponKey];
      this.currentWeaponKey = weaponKey;

      // Reset recoil
      this.recoil.current.set(0, 0, 0);
      this.recoil.target.set(0, 0, 0);
      this.recoil.accumulator = 0;
      this.recoil.timeSinceLastShot = Number.POSITIVE_INFINITY;
      this.recoil.burstShots = 0;

      // Reset knife state
      if (weaponKey === "knife") {
        this.knifeState.setState("ready");
      }
    }
  }

  // Try to start knife attack - returns true if attack started
  tryKnifeAttack() {
    if (this.currentWeaponKey !== "knife") return false;
    if (this.knifeState.currentName !== "ready") return false;

    // Go directly to swing (no windup)
    this.knifeState.setState("swing");
    return true;
  }

  // Check if knife can deal damage this frame
  canKnifeDamage() {
    return this.knifeCanDamage;
  }

  // Check if knife attack is complete
  isKnifeReady() {
    return this.knifeState.currentName === "ready";
  }

  // Called when weapon fires
  fire() {
    if (this.currentWeaponKey === "knife") {
      return this.tryKnifeAttack();
    }

    // Reset burst if we paused long enough (keeps first few shots stable)
    if (this.recoil.timeSinceLastShot > this.recoilConfig.burstResetTime) {
      this.recoil.burstShots = 0;
      this.recoil.accumulator = 0;
    }
    this.recoil.timeSinceLastShot = 0;
    this.recoil.burstShots += 1;

    const unstableShots = Math.max(0, this.recoil.burstShots - this.recoilConfig.stableShots);

    // Build up recoil only after the stable shots
    if (unstableShots > 0) {
      const ramp = 1 + Math.min(unstableShots, 6) * 0.12;
      this.recoil.accumulator = Math.min(this.recoil.accumulator + 0.01 * ramp, 0.12);
    }

    const heat01 = Math.min(1, this.recoil.accumulator / 0.12);

    // Apply recoil kick
    this.recoil.target.z = 0.02 + heat01 * 0.015; // Kick back
    this.recoil.target.y = 0.004 + heat01 * 0.006; // Kick up slightly
    const xRange = unstableShots > 0 ? (0.0008 + heat01 * 0.0035) : 0.0002;
    this.recoil.target.x = (Math.random() - 0.5) * 2 * xRange;

    // View punch (camera shake)
    this.recoil.viewPunch.x = 0.01 + heat01 * 0.03; // Punch up
    this.recoil.viewPunch.y = (Math.random() - 0.5) * (0.002 + heat01 * 0.01);

    // Trigger muzzle flash
    this.muzzleFlash.active = true;
    this.muzzleFlash.timer = 0.05;

    return true;
  }

  // Get view punch to apply to camera
  getViewPunch() {
    return this.recoil.viewPunch;
  }

  // Get accumulated recoil for crosshair spread
  getRecoilAccumulator() {
    return this.recoil.accumulator;
  }

  update(dt, playerVelocity = new Vector3(), isGrounded = true, isFiring = false) {
    this.recoil.timeSinceLastShot += dt;
    if (this.recoil.timeSinceLastShot > this.recoilConfig.burstResetTime) {
      this.recoil.burstShots = 0;
    }

    // Update knife state machine
    if (this.currentWeaponKey === "knife") {
      this.knifeState.update(dt);
      this._updateKnifeAnimation(dt);
    }

    // Weapon bob based on movement
    const speed = Math.sqrt(playerVelocity.x ** 2 + playerVelocity.z ** 2);
    this.animation.bobAmplitude = Math.min(speed * 0.003, 0.015);
    this.animation.bobPhase += dt * speed * 0.8;

    const bobX = Math.sin(this.animation.bobPhase) * this.animation.bobAmplitude;
    const bobY = Math.abs(Math.cos(this.animation.bobPhase * 2)) * this.animation.bobAmplitude * 0.5;

    // Weapon sway (delayed follow of view movement)
    const swayTarget = new Vector3(
      -this.camera.rotation.y * 0.02,
      this.camera.rotation.x * 0.02,
      0
    );
    this.animation.swayOffset.lerp(swayTarget, dt * 5);

    // Recoil recovery
    this.recoil.current.lerp(this.recoil.target, dt * 20);
    this.recoil.target.lerp(new Vector3(0, 0, 0), dt * 10);

    // View punch recovery
    this.recoil.viewPunch.x *= Math.exp(-dt * 15);
    this.recoil.viewPunch.y *= Math.exp(-dt * 15);

    // Recoil accumulator decay (faster when not firing)
    if (!isFiring) {
      this.recoil.accumulator *= Math.exp(-dt * 3);
    }

    // Apply all offsets to weapon
    if (this.currentWeapon && this.currentWeaponKey === "pistol") {
      const basePos = new Vector3(0.15, -0.12, -0.3);
      this.currentWeapon.position.copy(basePos);
      this.currentWeapon.position.x += bobX + this.animation.swayOffset.x + this.recoil.current.x;
      this.currentWeapon.position.y += bobY + this.animation.swayOffset.y + this.recoil.current.y;
      this.currentWeapon.position.z += this.recoil.current.z;

      // Slight rotation from recoil
      this.currentWeapon.rotation.x = this.recoil.current.z * 2.5;
    }

    // Update muzzle flash
    this._updateMuzzleFlash(dt);
  }

  _updateKnifeAnimation(dt) {
    if (!this.weapons.knife) return;

    const knife = this.weapons.knife;
    const state = this.knifeState.currentName;
    const progress = this.knifeSwingProgress;

    // Base position
    const basePos = new Vector3(0.2, -0.15, -0.35);
    const baseRot = new Euler(0.2, 0.5, 0);

    switch (state) {
      case "ready":
        knife.position.copy(basePos);
        knife.rotation.copy(baseRot);
        break;

      case "swing":
        // Fast swing forward (no more windup case needed)
        const swingCurve = Math.sin(progress * Math.PI);
        knife.position.x = basePos.x - progress * 0.15;
        knife.position.y = basePos.y - progress * 0.1;
        knife.position.z = basePos.z - progress * 0.25;
        knife.rotation.x = baseRot.x + progress * 1.0;
        knife.rotation.y = baseRot.y - progress * 0.8;
        knife.rotation.z = -progress * 0.4;
        break;

      case "recovery":
        // Return to ready position
        const easedProgress = 1 - Math.pow(1 - progress, 2);
        knife.position.lerpVectors(
          new Vector3(basePos.x - 0.05, basePos.y - 0.05, basePos.z - 0.15),
          basePos,
          easedProgress
        );
        knife.rotation.x = baseRot.x + 0.7 * (1 - easedProgress);
        knife.rotation.y = baseRot.y - 0.5 * (1 - easedProgress);
        knife.rotation.z = -0.2 * (1 - easedProgress);
        break;
    }
  }

  _updateMuzzleFlash(dt) {
    if (this.muzzleFlash.timer > 0) {
      this.muzzleFlash.timer -= dt;
      const intensity = this.muzzleFlash.timer / 0.05;

      // Update flash meshes
      for (const mesh of this.muzzleFlash.meshes) {
        mesh.material.opacity = intensity * 0.9;
        mesh.rotation.z += dt * 50; // Spin effect
      }

      // Update light
      if (this.muzzleFlash.light) {
        this.muzzleFlash.light.intensity = intensity * 3;
      }
    } else {
      this.muzzleFlash.active = false;
      for (const mesh of this.muzzleFlash.meshes) {
        mesh.material.opacity = 0;
      }
      if (this.muzzleFlash.light) {
        this.muzzleFlash.light.intensity = 0;
      }
    }
  }

  // Get muzzle world position for tracer origin
  getMuzzleWorldPosition() {
    if (!this.currentWeapon) return this.camera.position.clone();

    const muzzleLocal = this.currentWeapon.userData.muzzlePoint || new Vector3(0, 0, -0.15);
    const muzzleWorld = muzzleLocal.clone();
    this.currentWeapon.localToWorld(muzzleWorld);
    return muzzleWorld;
  }
}
