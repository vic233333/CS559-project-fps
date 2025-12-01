import {
  Scene,
  Color,
  Vector3,
  Group,
  WebGLRenderer,
  SRGBColorSpace
} from "three";
import Player from "../entities/Player.js";
import Target from "../entities/Target.js";
import SceneBuilder from "../systems/SceneBuilder.js";

export default class World {
  constructor({ canvas, modeManager, assetManager, gameplayConfig }) {
    this.canvas = canvas;
    this.modeManager = modeManager;
    this.assetManager = assetManager;
    this.gameplayConfig = gameplayConfig;
    this.renderProfile = null;

    this.scene = new Scene();
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));

    this.entities = [];
    this.targets = [];
    this.lights = [];
    this.ground = null;
    this.targetGroup = new Group();
    this.scene.add(this.targetGroup);
    this.sceneBuilder = new SceneBuilder(this.scene);
    this.spawnPoints = [];

    this.player = new Player({
      modeManager,
      input: null, // will be set later
      world: this
    });

    window.addEventListener("resize", () => this.handleResize());
  }

  setInputManager(input) {
    this.player.input = input;
  }

  setRenderProfile(profile) {
    this.renderProfile = profile;
  }

  async setupEnvironment(modeConfig) {
    if (!this.renderProfile) throw new Error("Render profile not set");
    await this.renderProfile.applyEnvironment(this, modeConfig);
  }

  reset(modeConfig, sceneConfig) {
    // Remove existing targets/entities
    for (const t of this.targets) t.destroy(this.scene);
    this.targets = [];
    this.entities = [];
    this.targetGroup.clear();

    // Reset player position
    const spawn = sceneConfig?.playerSpawn
      ? new Vector3(...sceneConfig.playerSpawn)
      : new Vector3(0, this.player.height, 8);
    this.player.reset(spawn);

    // Configure render clear color to match sky
    this.renderer.setClearColor(new Color(modeConfig.skyColor), 1);
  }

  async preload(modeConfig) {
    // Preload GLTF targets for Full mode
    if (modeConfig.gltfTargets) {
      await Promise.all(
        modeConfig.gltfTargets.map((entry) => this.assetManager.loadGLTF(entry.url).catch(() => null))
      );
    }
  }

  async spawnTarget({ moving = false, speed = 1, position, radius }) {
    const modeConfig = this.modeManager.currentConfig();
    const target = new Target({
      modeConfig,
      renderProfile: this.renderProfile,
      moving,
      speed,
      radius,
      position
    });
    await target.build(this.scene);
    this.targets.push(target);
    this.entities.push(target);
    this.targetGroup.add(target.object3D);
    return target;
  }

  update(dt) {
    // Update player
    this.player.update(dt, this);

    // Update entities
    for (const entity of this.entities) {
      if (entity.alive && entity.update) entity.update(dt, this);
    }

    this.renderer.render(this.scene, this.player.camera);
  }

  handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    this.player.handleResize(width, height);
  }

  buildScene(sceneConfig) {
    this.sceneBuilder.build(sceneConfig);
    this.spawnPoints = this.sceneBuilder.spawnPoints;
    this.currentSceneConfig = sceneConfig;
  }
}
