import { Clock, Raycaster, Vector2, Vector3, MathUtils, Euler } from "three";
import GameState from "./GameState.js";
import World from "./World.js";
import AssetManager from "../systems/AssetManager.js";
import InputManager from "../systems/InputManager.js";
import TouchInputManager from "../systems/TouchInputManager.js";
import UIManager from "../systems/UIManager.js";
import ModeManager from "../systems/ModeManager.js";
import WaveManager from "../systems/WaveManager.js";
import WeaponState from "../systems/WeaponState.js";
import InGameUI from "../systems/InGameUI.js";
import VisualEffects from "../systems/VisualEffects.js";
import WeaponViewModel from "../systems/WeaponViewModel.js";
import RecoilSystem from "../systems/RecoilSystem.js";
import { MODE_CONFIGS } from "../config/ModeConfig.js";
import { sceneForMode } from "../config/SceneConfig.js";
import { createProfileForMode } from "../render/RenderProfiles.js";

const _cameraPos = new Vector3();
const _targetPos = new Vector3();

// Weapon configurations
const WEAPONS = {
  pistol: {
    name: "Pistol",
    damage: 30,
    fireRate: 8,
    range: Infinity,
    speedMultiplier: 1.0
  },
  knife: {
    name: "Knife",
    damage: 100,
    fireRate: 2,
    range: 3,
    speedMultiplier: 1.25
  }
};

export default class Game {
  constructor({ canvas, gameplayConfig }) {
    this.canvas = canvas;
    this.gameplayConfig = gameplayConfig;

    this.modeManager = new ModeManager();
    this.state = new GameState();
    this.ui = new UIManager();
    this.input = new InputManager(canvas);

    // Touch input manager
    this.touchInput = new TouchInputManager();
    this.input.setTouchInput(this.touchInput);
    this.touchEnabled = false;

    this.world = new World({
      canvas,
      modeManager: this.modeManager,
      assetManager: null,
      gameplayConfig
    });
    this.assetManager = new AssetManager(this.world.renderer);
    this.world.assetManager = this.assetManager;
    this.world.gameplayConfig = gameplayConfig;
    this.world.setInputManager(this.input);

    this.waveManager = new WaveManager(this.world, gameplayConfig);
    this.weaponState = null;

    this.clock = new Clock();
    this.raycaster = new Raycaster();
    this.raycaster.near = 0.01;
    this.raycaster.far = Number.POSITIVE_INFINITY;
    this.center = new Vector2(0, 0);
    this.accumulators = {
      timeLeft: gameplayConfig.sessionLength,
      score: 0,
      hits: 0,
      shots: 0
    };
    this.autoPlay = false;
    this.autoTarget = null;

    // Game settings from UI
    this.gameMode = "wave"; // "wave" or "continuous"
    this.continuousTargetCount = 5;

    // Current weapon
    this.currentWeapon = "pistol";
    this.weapons = WEAPONS;

    // Pause state
    this.pausedState = null;

    // In-game 3D UI (scoreboard and sensitivity panels)
    this.inGameUI = null;

    // Visual effects system
    this.visualEffects = null;

    // Weapon view model (gun in front of camera)
    this.weaponViewModel = null;

    // Recoil and spread system
    this.recoilSystem = new RecoilSystem();

    // Target type settings
    this.targetType = "geometric"; // "geometric" or "robot"
    this.robotArmor = false;
    this.robotMoving = true;

    // View punch state for camera
    this.viewPunchOffset = new Euler(0, 0, 0, "YXZ");

    this._bindUI();
    this._bindPauseEvents();
    this.loop = this.loop.bind(this);
    this.state.on("change", ({ next }) => this.onStateChange(next));
  }

  async init() {
    // Initialize touch input manager
    this.touchInput.init();

    await this.applyMode(this.modeManager.currentMode());

    // Show tutorial for first-time users
    if (this.ui.shouldShowTutorial()) {
      this.ui.showTutorial();
    } else {
      this.ui.showMenu();
    }

    this.loop();
  }

  _bindUI() {
    document.getElementById("start-btn").addEventListener("click", () => this.start(false));
    document.getElementById("auto-btn").addEventListener("click", () => this.start(true));
    document.getElementById("restart-btn").addEventListener("click", () => this.start(false));
    document.getElementById("menu-btn").addEventListener("click", () => this.toMenu());

    // Settings buttons
    const settingsBtn = document.getElementById("settings-btn");
    if (settingsBtn) {
      settingsBtn.addEventListener("click", () => this.ui.showSettings());
    }

    const settingsSaveBtn = document.getElementById("settings-save-btn");
    if (settingsSaveBtn) {
      settingsSaveBtn.addEventListener("click", () => {
        this.applySettings();
        if (this.state.is("paused")) this.ui.showPause();
        else this.ui.showMenu();
      });
    }

    const settingsCancelBtn = document.getElementById("settings-cancel-btn");
    if (settingsCancelBtn) {
      settingsCancelBtn.addEventListener("click", () => {
        if (this.state.is("paused")) this.ui.showPause();
        else this.ui.showMenu();
      });
    }

    // Pause buttons
    const resumeBtn = document.getElementById("resume-btn");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", () => this.resumeGame());
    }

    const pauseSettingsBtn = document.getElementById("pause-settings-btn");
    if (pauseSettingsBtn) {
      pauseSettingsBtn.addEventListener("click", () => this.ui.showSettings());
    }

    const quitBtn = document.getElementById("quit-btn");
    if (quitBtn) {
      quitBtn.addEventListener("click", () => this.quitToMenu());
    }

    // Live robot model tuning (applies immediately without page reload)
    this.ui.on("robotModelTuning", ({ scale, yOffset }) => {
      this.world.setRobotModelTuning(scale, yOffset, { applyToExisting: true });
      // log the new values
      console.log("New robot model scale:", scale);
      console.log("New robot model Y offset:", yOffset);
    });

    // Touch controls toggle
    this.ui.on("touchControlsToggle", (enabled) => {
      this.setTouchEnabled(enabled);
    });
  }

  setTouchEnabled(enabled) {
    this.touchEnabled = enabled;
    this.input.setTouchEnabled(enabled);

    // Toggle body class for CSS-based HUD repositioning
    document.body.classList.toggle("touch-mode", enabled);

    // Show/hide touch overlay
    const touchLayer = document.getElementById("touch-controls-layer");
    if (touchLayer) {
      touchLayer.classList.toggle("visible", enabled && this.state.is("playing"));
    }
  }

  _bindPauseEvents() {
    // Listen for pointer lock change to detect ESC press (only when not in touch mode)
    document.addEventListener("pointerlockchange", () => {
      if (this.touchEnabled) return; // Don't pause on pointer lock changes in touch mode
      const isLocked = document.pointerLockElement === this.canvas;
      if (!isLocked && this.state.is("playing")) {
        this.pauseGame();
      }
    });
  }

  applySettings() {
    const settings = this.ui.getGameSettings();

    // Apply sensitivity
    if (this.world.player) {
      this.world.player.sensitivity = settings.sensitivity;
    }

    // Apply game mode
    this.gameMode = settings.gameMode;
    this.continuousTargetCount = settings.continuousTargets;

    // Apply wave/session settings
    if (settings.gameMode === "wave") {
      this.gameplayConfig.sessionLength = settings.sessionDuration;
      this.gameplayConfig.waves = settings.waves.map((w, i) => ({
        id: i + 1,
        duration: w.duration || 12 + i * 2,
        targets: w.targets,
        speed: w.speed || 1.0 + i * 0.2,
        movingRatio: w.movingRatio
      }));
    } else {
      this.gameplayConfig.sessionLength = settings.continuousDuration;
    }

    // Apply distribute angle
    this.gameplayConfig.distributeAngle = settings.distributeAngle;

    // Apply target type settings
    this.targetType = settings.targetType || "geometric";
    this.robotArmor = settings.robotArmor || false;
    this.robotMoving = settings.robotMoving !== false;

    // Apply robot model tuning (used for new spawns and live-updated for existing robots)
    this.world.setRobotModelTuning(settings.robotModelScale, settings.robotModelYOffset, { applyToExisting: true });

    // Update waveManager with new config
    this.waveManager.config = this.gameplayConfig;
  }

  async applyMode(mode) {
    const cfg = MODE_CONFIGS[mode];
    if (!cfg) return;
    this.modeManager.setMode(mode);
    const profile = createProfileForMode(this.assetManager);
    this.world.setRenderProfile(profile);
    const sceneConfig = sceneForMode();
    this.weaponState = new WeaponState(this.weapons[this.currentWeapon]);
    await this.world.preload(cfg);
    await this.world.setupEnvironment(cfg);
    this.world.buildScene(sceneConfig);
    this.world.reset(cfg, sceneConfig);
    this.waveManager.setSpawnPoints(this.world.spawnPoints);
    this.waveManager.setSceneConfig(sceneConfig);

    // Setup in-game 3D UI (scoreboard and sensitivity panels)
    if (this.inGameUI) {
      this.inGameUI.destroy();
    }
    this.inGameUI = new InGameUI(this.world, this);
    await this.inGameUI.build();

    // Setup visual effects system
    if (this.visualEffects) {
      this.visualEffects.clear();
    }
    this.visualEffects = new VisualEffects(this.world.scene);

    // Setup weapon view model
    if (this.weaponViewModel) {
      this.world.player.camera.remove(this.weaponViewModel.container);
    }
    this.weaponViewModel = new WeaponViewModel(this.world.player.camera);

    // Reset recoil system
    this.recoilSystem.reset();
  }

  async start(auto) {
    this.autoPlay = auto;
    this.autoTarget = null;
    this.state.setState("loading");

    // Apply current settings before starting
    this.applySettings();

    // Reset weapon to pistol
    this.currentWeapon = "pistol";
    this.weaponState = new WeaponState(this.weapons[this.currentWeapon]);

    // Apply sensitivity to player
    const settings = this.ui.getGameSettings();
    if (this.world.player) {
      this.world.player.sensitivity = settings.sensitivity;
    }

    this.accumulators = {
      timeLeft: this.gameplayConfig.sessionLength,
      score: 0,
      hits: 0,
      shots: 0
    };
    this.statsHistory = [];
    this.statsTimer = 0;

    if (!auto) {
      await this.ui.startCountdown();
    }

    await this.applyMode(this.modeManager.currentMode());

    // Set target settings on wave manager
    this.waveManager.setTargetSettings(this.targetType, this.robotArmor, this.robotMoving);

    // Start based on game mode
    if (this.gameMode === "wave") {
      await this.waveManager.start();
    } else {
      // Continuous mode - spawn initial targets
      await this._spawnContinuousTargets();
    }

    this.state.setState("playing");
    this.ui.showHUD();

    // Show touch overlay if touch enabled, otherwise request pointer lock
    if (this.touchEnabled) {
      const touchLayer = document.getElementById("touch-controls-layer");
      if (touchLayer) touchLayer.classList.add("visible");
    } else {
      await this.canvas.requestPointerLock?.();
    }
    this.clock.start();
  }

  async _spawnContinuousTargets() {
    const currentCount = this.world.targets.filter((t) => t.alive).length;
    const needed = this.continuousTargetCount - currentCount;

    for (let i = 0; i < needed; i++) {
      const spawn =
        this.world.spawnPoints.length > 0
          ? this.world.spawnPoints[Math.floor(Math.random() * this.world.spawnPoints.length)].position
          : new Vector3((Math.random() - 0.5) * 10, 1.2, -5 - Math.random() * 10);

      // Use target type settings
      const isRobot = this.targetType === "robot";
      const moving = isRobot ? this.robotMoving : Math.random() > 0.5;

      await this.world.spawnTarget({
        moving: moving,
        speed: 1.0 + Math.random() * 0.5,
        radius: this.gameplayConfig.target.radius,
        position: spawn.clone(),
        targetType: this.targetType,
        hasArmor: this.robotArmor,
        maxHeightY: isRobot ? null : 4.5 // Only apply height variation to geometric targets
      });
    }
  }

  pauseGame() {
    if (!this.state.is("playing")) return;
    this.pausedState = "playing";
    this.state.setState("paused");
    this.ui.showPause();
    this.clock.stop();

    // Hide touch overlay on pause
    if (this.touchEnabled) {
      const touchLayer = document.getElementById("touch-controls-layer");
      if (touchLayer) touchLayer.classList.remove("visible");
    }
  }

  async resumeGame() {
    if (!this.state.is("paused")) return;

    // Show countdown before resuming
    await this.ui.startCountdown(3);

    this.state.setState("playing");
    this.ui.showHUD();

    // Show touch overlay if touch enabled, otherwise request pointer lock
    if (this.touchEnabled) {
      const touchLayer = document.getElementById("touch-controls-layer");
      if (touchLayer) touchLayer.classList.add("visible");
    } else {
      await this.canvas.requestPointerLock?.();
    }
    this.clock.start();
    this.pausedState = null;
  }

  quitToMenu() {
    this.pausedState = null;
    this.state.setState("menu");
    this.ui.showMenu();
    document.exitPointerLock?.();

    // Hide touch overlay
    const touchLayer = document.getElementById("touch-controls-layer");
    if (touchLayer) touchLayer.classList.remove("visible");
  }

  toMenu() {
    this.state.setState("menu");
    this.ui.showMenu();

    // Hide touch overlay
    const touchLayer = document.getElementById("touch-controls-layer");
    if (touchLayer) touchLayer.classList.remove("visible");
  }

  onStateChange(next) {
    if (next === "menu") {
      document.exitPointerLock?.();
    }
  }

  switchWeapon(weaponKey) {
    if (!this.weapons[weaponKey]) return;
    if (this.currentWeapon === weaponKey) return;

    this.currentWeapon = weaponKey;
    this.weaponState = new WeaponState(this.weapons[weaponKey]);

    // Sync weapon view model
    if (this.weaponViewModel) {
      this.weaponViewModel.switchWeapon(weaponKey);
    }

    // Reset recoil when switching weapons
    this.recoilSystem.reset();
  }

  handleWeaponSwitch() {
    const switchTo = this.input.consumeWeaponSwitch();
    if (switchTo === 1) {
      this.switchWeapon("pistol");
    } else if (switchTo === 2) {
      this.switchWeapon("knife");
    }
  }

  adjustSensitivity(delta) {
    if (!this.world.player) return;
    const newSens = Math.max(0.0005, Math.min(0.1, this.world.player.sensitivity + delta));
    this.world.player.sensitivity = newSens;
    this.ui.gameSettings.sensitivity = newSens;
  }

  handleShooting(dt) {
    const weapon = this.weapons[this.currentWeapon];
    const wantsFire = this.autoPlay ? Boolean(this.autoTarget) : this.input.isFiring();

    // Handle reload
    if (this.input.consumeReload() && this.weaponState) {
      this.weaponState.startReload();
      return;
    }

    if (!wantsFire) return;

    // Handle knife attack
    if (this.currentWeapon === "knife") {
      this._handleKnifeAttack(dt, weapon);
      return;
    }

    // Gun shooting
    if (this.weaponState && !this.weaponState.tryFire()) return;
    this.accumulators.shots += 1;

    // Trigger weapon view model fire animation
    if (this.weaponViewModel) {
      this.weaponViewModel.fire();
    }

    // Apply recoil
    this.recoilSystem.onFire();

    this.world.scene.updateMatrixWorld(true);
    this.world.player.camera.updateMatrixWorld(true);

    // Calculate bullet spread based on player state
    const playerVel = this.world.player.body ?
      new Vector3(this.world.player.body.velocity.x, this.world.player.body.velocity.y, this.world.player.body.velocity.z) :
      new Vector3();
    const spread = this.recoilSystem.calculateSpread(
      playerVel,
      this.world.player.onGround,
      this.world.player.isCrouching,
      this.input.isSprinting()
    );

    // Get base ray direction and apply spread
    this.raycaster.setFromCamera(this.center, this.world.player.camera);
    const rayDir = this.recoilSystem.applySpread(this.raycaster.ray.direction, spread);
    this.raycaster.ray.direction.copy(rayDir);

    // Set max distance based on weapon range
    const originalFar = this.raycaster.far;
    if (weapon.range !== Infinity) {
      this.raycaster.far = weapon.range;
    }

    // Get muzzle position for tracer
    const muzzlePos = this.weaponViewModel ?
      this.weaponViewModel.getMuzzleWorldPosition() :
      this.world.player.camera.position.clone();

    // First check sensitivity panels
    if (this.inGameUI) {
      const panelObjects = this.inGameUI.getHittableObjects();
      const panelHits = this.raycaster.intersectObjects(panelObjects, true);
      if (panelHits.length > 0) {
        const hit = panelHits[0];
        let sensitivityDelta = hit.object.userData.sensitivityDelta;
        if (sensitivityDelta === undefined) {
          let parent = hit.object.parent;
          while (parent) {
            if (parent.userData.sensitivityDelta !== undefined) {
              sensitivityDelta = parent.userData.sensitivityDelta;
              break;
            }
            parent = parent.parent;
          }
        }
        if (sensitivityDelta !== undefined && sensitivityDelta !== 0) {
          this.adjustSensitivity(sensitivityDelta);
          this.raycaster.far = originalFar;
          return;
        }
      }
    }

    // Check for hits (use rendered target meshes directly)
    const hits = this.raycaster.intersectObjects(this.world.targetGroup.children, true);

    // Calculate end point for tracer
    let hitPoint;
    let hitNormal = null;
    let hitEntity = null;
    let hitBodyPart = null;

    if (hits.length > 0) {
      const hit = hits[0];
      hitPoint = hit.point.clone();
      hitNormal = hit.face ? hit.face.normal.clone() : null;
      hitBodyPart = hit.object.userData.bodyPart || null;

      // Find entity
      let current = hit.object;
      while (current) {
        if (current.userData.entity) {
          hitEntity = current.userData.entity;
          break;
        }
        current = current.parent;
      }
    } else {
      // Miss - trace to max distance
      hitPoint = this.raycaster.ray.origin.clone().add(
        this.raycaster.ray.direction.clone().multiplyScalar(weapon.range === Infinity ? 100 : weapon.range)
      );
    }

    this.raycaster.far = originalFar;

    // Create tracer effect
    if (this.visualEffects) {
      this.visualEffects.createTracer(muzzlePos, hitPoint, 0.08);

      // Impact sparks only (bullet-hole decals removed)
      if (hitNormal) {
        this.visualEffects.createImpactSparks(hitPoint, hitNormal, 3);
      }
    }

    // Handle hit on entity
    if (hitEntity && hitEntity.alive && hitEntity.onHit) {
      const wasAlive = hitEntity.alive;

      // For robots, pass the body part
      if (hitEntity.constructor.name === 'Robot' && hitBodyPart) {
        hitEntity.onHit(weapon.damage, hitPoint, hitBodyPart);
      } else {
        hitEntity.onHit(weapon.damage, hitPoint);
      }

      this.accumulators.hits += 1;

      if (wasAlive && !hitEntity.alive) {
        this.accumulators.score += 100;
      } else {
        this.accumulators.score += 25;
      }

      if (this.autoPlay) {
        this.autoTarget = null;
      }
    }
  }

  _handleKnifeAttack(dt, weapon) {
    if (!this.weaponViewModel) return;

    // Try to start knife attack
    if (this.weaponViewModel.isKnifeReady()) {
      if (!this.weaponViewModel.tryKnifeAttack()) return;
      this.accumulators.shots += 1;
    }

    // Check for damage during damage window
    if (this.weaponViewModel.canKnifeDamage()) {
      this._checkKnifeDamage(weapon);
      // Prevent multiple hits per swing
      this.weaponViewModel.knifeCanDamage = false;
    }
  }

  _checkKnifeDamage(weapon) {
    this.world.scene.updateMatrixWorld(true);
    this.world.player.camera.updateMatrixWorld(true);

    this.raycaster.setFromCamera(this.center, this.world.player.camera);
    this.raycaster.far = weapon.range;

    const hits = this.raycaster.intersectObjects(this.world.targetGroup.children, true);

    if (hits.length > 0) {
      const hit = hits[0];
      let entity = null;
      let current = hit.object;
      while (current) {
        if (current.userData.entity) {
          entity = current.userData.entity;
          break;
        }
        current = current.parent;
      }

      if (entity && entity.alive && entity.onHit) {
        const wasAlive = entity.alive;
        const bodyPart = hit.object.userData.bodyPart || null;

        if (entity.constructor.name === 'Robot' && bodyPart) {
          entity.onHit(weapon.damage, hit.point, bodyPart);
        } else {
          entity.onHit(weapon.damage, hit.point);
        }

        this.accumulators.hits += 1;

        if (wasAlive && !entity.alive) {
          this.accumulators.score += 100;
        } else {
          this.accumulators.score += 25;
        }

        if (this.autoPlay) {
          this.autoTarget = null;
        }
      }
    }

    this.raycaster.far = Number.POSITIVE_INFINITY;
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = this.clock.getDelta();

    if (this.state.is("playing")) {
      this.accumulators.timeLeft -= dt;

      // Record stats every 1s
      this.statsTimer += dt;
      if (this.statsTimer >= 1.0) {
        this.statsTimer = 0;
        this.statsHistory.push({
          time: this.gameplayConfig.sessionLength - this.accumulators.timeLeft,
          score: this.accumulators.score
        });
      }

      // Check for time-based end
      if (this.accumulators.timeLeft <= 0) {
        this.finishSession();
        return;
      }

      // Check for wave completion in wave mode
      if (this.gameMode === "wave" && this.waveManager.isAllWavesComplete()) {
        this.finishSession();
        return;
      }

      // Handle weapon switching
      this.handleWeaponSwitch();

      // Apply weapon speed multiplier to player
      if (this.world.player) {
        this.world.player.weaponSpeedMultiplier = this.weapons[this.currentWeapon].speedMultiplier;
      }

      if (this.autoPlay) this.driveAuto(dt);
      if (this.weaponState) this.weaponState.update(dt);
      this.handleShooting(dt);

      // Update recoil system
      this.recoilSystem.update(dt, this.input.isFiring());

      // Update weapon view model
      if (this.weaponViewModel) {
        const playerVel = this.world.player.body ?
          new Vector3(this.world.player.body.velocity.x, this.world.player.body.velocity.y, this.world.player.body.velocity.z) :
          new Vector3();
        this.weaponViewModel.update(dt, playerVel, this.world.player.onGround, this.input.isFiring());
      }

      // Apply view punch to camera (recoil effect)
      const viewPunch = this.recoilSystem.getViewPunch();
      this.viewPunchOffset.x = MathUtils.lerp(this.viewPunchOffset.x, viewPunch.x, dt * 10);
      this.viewPunchOffset.y = MathUtils.lerp(this.viewPunchOffset.y, viewPunch.y, dt * 10);

      // Set view punch on player for camera rotation
      if (this.world.player) {
        this.world.player.viewPunchOffset = this.viewPunchOffset;
      }

      // Update visual effects
      if (this.visualEffects) {
        this.visualEffects.update(dt);
      }

      // Update based on game mode
      if (this.gameMode === "wave") {
        this.waveManager.update(dt);
      } else {
        // Continuous mode - maintain target count
        this._maintainContinuousTargets();
      }

      this.world.update(dt);

      // Update HUD with weapon and sensitivity info
      const currentWeaponInfo = this.weapons[this.currentWeapon];
      const currentSensitivity = this.world.player?.sensitivity || 0.0025;
      const currentWave = this.gameMode === "wave" ? this.waveManager.currentWaveNumber() : "∞";

      this.ui.updateHUD({
        score: this.accumulators.score,
        time: this.accumulators.timeLeft,
        wave: currentWave,
        health: this.gameplayConfig.player.health,
        weapon: currentWeaponInfo.name,
        sensitivity: currentSensitivity
      });

      // Update in-game 3D UI
      if (this.inGameUI) {
        this.inGameUI.update(
          this.accumulators.score,
          this.accumulators.timeLeft,
          currentWave,
          currentSensitivity
        );
      }
    } else if (this.state.is("menu") || this.state.is("paused")) {
      // Idle render
      this.world.renderer.render(this.world.scene, this.world.player.camera);
    }
  }

  _maintainContinuousTargets() {
    const currentCount = this.world.targets.filter((t) => t.alive).length;
    if (currentCount < this.continuousTargetCount) {
      this._spawnContinuousTargets();
    }
  }

  _acquireAutoTarget(existingTarget) {
    if (existingTarget?.alive && existingTarget?.hitbox && existingTarget.health > 0) {
      return existingTarget;
    }

    if (!this.world?.targets?.length) return null;
    const player = this.world.player;
    if (!player?.camera) return null;

    this.world.scene.updateMatrixWorld(true);
    player.camera.updateMatrixWorld(true);
    player.camera.getWorldPosition(_cameraPos);

    let best = null;
    let bestDist = Infinity;
    for (const target of this.world.targets) {
      if (!target?.alive || !target.hitbox || target.health <= 0) continue;

      target.hitbox.getWorldPosition(_targetPos);
      const distanceSq = _cameraPos.distanceToSquared(_targetPos);
      if (distanceSq < bestDist) {
        bestDist = distanceSq;
        best = target;
      }
    }
    return best;
  }

  _aimAtTarget(target) {
    const player = this.world.player;
    if (!player?.camera || !target?.hitbox || !target.alive) return;

    target.hitbox.getWorldPosition(_targetPos);
    player.camera.lookAt(_targetPos);

    player.heading.setFromQuaternion(player.camera.quaternion, "YXZ");

    const limit = Math.PI / 2 - 0.05;
    player.heading.x = MathUtils.clamp(player.heading.x, -limit, limit);

    player.camera.quaternion.setFromEuler(player.heading);
  }

  driveAuto(dt) {
    const player = this.world.player;
    if (!player?.camera) return;

    const target = this._acquireAutoTarget(this.autoTarget);
    this.autoTarget = target;

    if (target && target.alive && target.hitbox && target.health > 0) {
      this._aimAtTarget(target);
    } else {
      this.autoTarget = null;
      player.heading.y += dt * 0.6;
      player.heading.x = Math.sin(performance.now() * 0.001) * 0.1;
      player.camera.quaternion.setFromEuler(player.heading);
    }
  }

  finishSession() {
    this.state.setState("ended");
    this.ui.showEnd();
    const accuracy =
      this.accumulators.shots === 0 ? 0 : (this.accumulators.hits / this.accumulators.shots) * 100;
    this.ui.updateEnd({
      score: this.accumulators.score,
      wave: this.gameMode === "wave" ? this.waveManager.currentWaveNumber() : "∞",
      accuracy,
      history: this.statsHistory
    });
    document.exitPointerLock?.();
  }
}
