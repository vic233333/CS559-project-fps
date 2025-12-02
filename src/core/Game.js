import { Clock, Raycaster, Vector2, Vector3, MathUtils } from "three";
import GameState from "./GameState.js";
import World from "./World.js";
import AssetManager from "../systems/AssetManager.js";
import InputManager from "../systems/InputManager.js";
import UIManager from "../systems/UIManager.js";
import ModeManager from "../systems/ModeManager.js";
import WaveManager from "../systems/WaveManager.js";
import WeaponState from "../systems/WeaponState.js";
import { MODE_CONFIGS } from "../config/ModeConfig.js";
import { sceneForMode } from "../config/SceneConfig.js";
import { createProfileForMode } from "../render/RenderProfiles.js";

const _cameraPos = new Vector3();
const _targetPos = new Vector3();
const _vectorToTarget = new Vector3();

export default class Game {
  constructor({ canvas, gameplayConfig }) {
    this.canvas = canvas;
    this.gameplayConfig = gameplayConfig;

    this.modeManager = new ModeManager();
    this.state = new GameState();
    this.ui = new UIManager();
    this.input = new InputManager(canvas);
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
    this.raycaster.far = Number.POSITIVE_INFINITY; // effectively infinite ray length for hitscan
    this.center = new Vector2(0, 0);
    this.accumulators = {
      timeLeft: gameplayConfig.sessionLength,
      score: 0,
      hits: 0,
      shots: 0
    };
    this.autoPlay = false;
    this.autoTarget = null;

    this._bindUI();
    this.loop = this.loop.bind(this);
    this.state.on("change", ({ next }) => this.onStateChange(next));
  }

  async init() {
    await this.applyMode(this.modeManager.currentMode());
    this.ui.showMenu();
    this.loop();
  }

  _bindUI() {
    document.getElementById("start-btn").addEventListener("click", () => this.start(false));
    document.getElementById("auto-btn").addEventListener("click", () => this.start(true));
    document.getElementById("restart-btn").addEventListener("click", () => this.start(false));
    document.getElementById("menu-btn").addEventListener("click", () => this.toMenu());
  }


  async applyMode(mode) {
    const cfg = MODE_CONFIGS[mode];
    if (!cfg) return;
    this.modeManager.setMode(mode);
    const profile = createProfileForMode(mode, this.assetManager);
    this.world.setRenderProfile(profile);
    const sceneConfig = sceneForMode(mode);
    this.weaponState = new WeaponState(cfg.weapon);
    await this.world.preload(cfg);
    await this.world.setupEnvironment(cfg);
    this.world.buildScene(sceneConfig);
    this.world.reset(cfg, sceneConfig);
    this.waveManager.setSpawnPoints(this.world.spawnPoints);
    this.waveManager.setSceneConfig(sceneConfig);
  }

  async start(auto) {
    this.autoPlay = auto;
    this.autoTarget = null;
    this.state.setState("loading");
    this.accumulators = {
      timeLeft: this.gameplayConfig.sessionLength,
      score: 0,
      hits: 0,
      shots: 0
    };
    await this.applyMode(this.modeManager.currentMode());
    await this.waveManager.start();
    this.state.setState("playing");
    this.ui.showHUD();
    // Try to capture pointer as the user just clicked a button.
    await this.canvas.requestPointerLock?.();
    this.clock.start();
  }

  toMenu() {
    this.state.setState("menu");
    this.ui.showMenu();
  }

  onStateChange(next) {
    if (next === "menu") {
      document.exitPointerLock?.();
    }
  }

  handleShooting(dt) {
    const weapon = this.modeManager.currentConfig().weapon;
    const wantsFire = this.autoPlay ? Boolean(this.autoTarget) : this.input.isFiring();
    if (!wantsFire) return;
    if (this.input.consumeReload() && this.weaponState) {
      this.weaponState.startReload();
      return;
    }
    if (this.weaponState && !this.weaponState.tryFire()) return;
    this.accumulators.shots += 1;

    // Cast a ray from camera center
    // Make sure scene graph world matrices are up-to-date before raycast;
    // when we shoot earlier than the render pass, transforms may still be stale.
    this.world.scene.updateMatrixWorld(true);
    this.world.player.camera.updateMatrixWorld(true);

    this.raycaster.setFromCamera(this.center, this.world.player.camera);
    const hits = this.raycaster.intersectObjects(this.world.hittableGroup.children, true);
    if (hits.length === 0) return;

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
      const lethalDamage = Number.isFinite(entity.health) ? entity.health : weapon.damage;
      entity.onHit(lethalDamage, hit.point);
      this.accumulators.hits += 1;

      if (wasAlive && !entity.alive) {
        this.accumulators.score += 100;
      } else {
        this.accumulators.score += 25;
      }

      // In autoplay mode, switch to a new target after each hit for better demo behavior
      if (this.autoPlay) {
        this.autoTarget = null;
      }
    }
  }

  loop() {
    requestAnimationFrame(this.loop);
    const dt = this.clock.getDelta();
    if (this.state.is("playing")) {
      this.accumulators.timeLeft -= dt;
      if (this.accumulators.timeLeft <= 0) {
        this.finishSession();
      }
      if (this.autoPlay) this.driveAuto(dt);
      if (this.weaponState) this.weaponState.update(dt);
      this.handleShooting(dt);
      this.waveManager.update(dt);
      this.world.update(dt);
      this.ui.updateHUD({
        score: this.accumulators.score,
        time: this.accumulators.timeLeft,
        wave: this.waveManager.currentWaveNumber(),
        health: this.gameplayConfig.player.health
      });
    } else if (this.state.is("menu")) {
      // idle render
      this.world.renderer.render(this.world.scene, this.world.player.camera);
    }
  }

  _acquireAutoTarget(existingTarget) {
    if (existingTarget?.alive) return existingTarget;
    if (!this.world?.targets?.length) return null;
    const player = this.world.player;
    if (!player?.camera) return null;

    this.world.scene.updateMatrixWorld(true);
    player.camera.updateMatrixWorld(true);
    player.camera.getWorldPosition(_cameraPos);

    let best = null;
    let bestDist = Infinity;
    for (const target of this.world.targets) {
      // Use hitbox for targeting since that's what the raycaster actually hits
      if (!target?.alive || !target.hitbox) continue;
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
    // Use hitbox for aiming since that's what the raycaster actually hits
    if (!player?.camera || !target?.hitbox) return;
    target.hitbox.getWorldPosition(_targetPos);
    player.camera.getWorldPosition(_cameraPos);
    _vectorToTarget.copy(_targetPos).sub(_cameraPos);
    if (_vectorToTarget.lengthSq() === 0) return;
    _vectorToTarget.normalize();

    const yaw = Math.atan2(_vectorToTarget.x, -_vectorToTarget.z);
    const pitch = Math.atan2(
      _vectorToTarget.y,
      Math.hypot(_vectorToTarget.x, _vectorToTarget.z)
    );
    const limit = Math.PI / 2 - 0.05;
    player.heading.y = yaw;
    player.heading.x = MathUtils.clamp(pitch, -limit, limit);
    player.camera.quaternion.setFromEuler(player.heading);
  }

  driveAuto(dt) {
    const player = this.world.player;
    if (!player?.camera) return;
    const target = this._acquireAutoTarget(this.autoTarget);
    this.autoTarget = target;

    if (target) {
      this._aimAtTarget(target);
    } else {
      // Fall back to a slow scan when no targets are available.
      player.heading.y += dt * 0.6;
      player.heading.x = Math.sin(performance.now() * 0.001) * 0.1;
      player.camera.quaternion.setFromEuler(player.heading);
    }
  }

  finishSession() {
    this.state.setState("ended");
    this.ui.showEnd();
    const accuracy =
      this.accumulators.shots === 0
        ? 0
        : (this.accumulators.hits / this.accumulators.shots) * 100;
    this.ui.updateEnd({
      score: this.accumulators.score,
      wave: this.waveManager.currentWaveNumber(),
      accuracy
    });
    document.exitPointerLock?.();
  }

  // TODO: Implement player damage and fail conditions (e.g., decrement health on enemy hits and end session when HP <= 0).
}
