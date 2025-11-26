import { Clock, Raycaster, Vector2 } from "three";
import GameState from "./GameState.js";
import World from "./World.js";
import AssetManager from "../systems/AssetManager.js";
import InputManager from "../systems/InputManager.js";
import UIManager from "../systems/UIManager.js";
import ModeManager from "../systems/ModeManager.js";
import WaveManager from "../systems/WaveManager.js";
import { MODE_CONFIGS } from "../config/modes.js";

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

    this.clock = new Clock();
    this.raycaster = new Raycaster();
    this.center = new Vector2(0, 0);
    this.accumulators = {
      timeLeft: gameplayConfig.sessionLength,
      score: 0,
      hits: 0,
      shots: 0
    };
    this.lastShotTime = 0;
    this.autoPlay = false;

    this._bindUI();
    this._bindModeSwitch();
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

  _bindModeSwitch() {
    const buttons = document.querySelectorAll(".mode-btn");
    buttons.forEach((btn) => {
      btn.addEventListener("click", async () => {
        const mode = btn.dataset.mode;
        await this.applyMode(mode);
        buttons.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
      });
    });
  }

  async applyMode(mode) {
    const cfg = MODE_CONFIGS[mode];
    if (!cfg) return;
    this.modeManager.setMode(mode);
    await this.world.preload(cfg);
    await this.world.setupEnvironment(cfg);
    this.world.reset(cfg);
  }

  async start(auto) {
    this.autoPlay = auto;
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
    this.canvas.requestPointerLock?.();
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
    const fireInterval = 1 / weapon.fireRate;
    this.lastShotTime += dt;
    const wantsFire = this.autoPlay || this.input.isFiring();
    if (!wantsFire) return;
    if (this.lastShotTime < fireInterval) return;
    this.lastShotTime = 0;
    this.accumulators.shots += 1;

    // Cast a ray from camera center
    this.raycaster.setFromCamera(this.center, this.world.player.camera);
    const hits = this.raycaster.intersectObjects(this.world.targetGroup.children, true);
    if (hits.length > 0) {
      const hit = hits[0];
      const entity = hit.object.userData.entity;
      if (entity && entity.onHit) {
        entity.onHit(weapon.damage);
        this.accumulators.hits += 1;
        if (!entity.alive) {
          this.world.targetGroup.remove(entity.object3D);
          entity.destroy(this.world.scene);
          this.accumulators.score += 100;
        } else {
          this.accumulators.score += 25;
        }
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

  driveAuto(dt) {
    const player = this.world.player;
    // Slowly rotate to scan the arena
    player.heading.y += dt * 0.6;
    player.heading.x = Math.sin(performance.now() * 0.001) * 0.1;
    player.camera.quaternion.setFromEuler(player.heading);

    // Circle strafe movement
    const radius = 0.2;
    player.camera.position.x += Math.cos(performance.now() * 0.0015) * radius;
    player.camera.position.z += Math.sin(performance.now() * 0.0015) * radius;
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
