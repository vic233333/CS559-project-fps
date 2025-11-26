import {
  Scene,
  Color,
  FogExp2,
  PlaneGeometry,
  MeshStandardMaterial,
  Mesh,
  HemisphereLight,
  DirectionalLight,
  Vector3,
  Group,
  WebGLRenderer,
  SRGBColorSpace
} from "three";
import Player from "../entities/Player.js";
import Target from "../entities/Target.js";

export default class World {
  constructor({ canvas, modeManager, assetManager, gameplayConfig }) {
    this.canvas = canvas;
    this.modeManager = modeManager;
    this.assetManager = assetManager;
    this.gameplayConfig = gameplayConfig;

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

  async setupEnvironment(modeConfig) {
    this.scene.background = new Color(modeConfig.skyColor);
    this.scene.fog = new FogExp2(modeConfig.fog.color, modeConfig.fog.density);

    // Remove old ground/lights
    if (this.ground) {
      this.scene.remove(this.ground);
      this.ground.geometry.dispose();
      this.ground.material.dispose();
    }
    for (const light of this.lights) this.scene.remove(light);
    this.lights = [];

    // Ground
    const groundGeo = new PlaneGeometry(200, 200);
    const groundMat = new MeshStandardMaterial({
      color: modeConfig.groundColor,
      roughness: 0.9,
      metalness: 0.05
    });
    this.ground = new Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Lights
    const hemi = new HemisphereLight("#88aaff", "#080910", modeConfig.ambientIntensity);
    const dir = new DirectionalLight("#ffffff", modeConfig.directionalIntensity);
    dir.position.set(8, 15, 6);
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 50;
    this.scene.add(hemi);
    this.scene.add(dir);
    this.lights.push(hemi, dir);

    // HDR environment if requested
    if (modeConfig.useHDR && modeConfig.hdrUrl) {
      try {
        const envMap = await this.assetManager.loadHDR(modeConfig.hdrUrl);
        this.scene.environment = envMap;
      } catch (err) {
        console.warn("HDR load failed, falling back to no environment", err);
        this.scene.environment = null;
      }
    } else {
      this.scene.environment = null;
    }
  }

  reset(modeConfig) {
    // Remove existing targets/entities
    for (const t of this.targets) t.destroy(this.scene);
    this.targets = [];
    this.entities = [];
    this.targetGroup.clear();

    // Reset player position
    this.player.reset();

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
      assetManager: this.assetManager,
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
}
