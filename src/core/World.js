import {
  Scene,
  Color,
  Vector3,
  Group,
  WebGLRenderer,
  SRGBColorSpace
} from "three";
import * as CANNON from "cannon-es";
import Player from "../entities/Player.js";
import Target from "../entities/Target.js";
import SceneBuilder from "../systems/SceneBuilder.js";
import Debris from "../entities/Debris.js";

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
    this.debris = [];
    this.lights = [];
    this.ground = null;
    this.targetGroup = new Group();
    this.hittableGroup = new Group();
    this.scene.add(this.targetGroup, this.hittableGroup);
    this.sceneBuilder = new SceneBuilder(this.scene);
    this.spawnPoints = [];
    this.colliders = [];
    this.dynamicColliders = [];

    this.physicsWorld = new CANNON.World({
      gravity: new CANNON.Vec3(0, -gameplayConfig.player.gravity, 0)
    });
    this.physicsWorld.broadphase = new CANNON.NaiveBroadphase();
    this.physicsWorld.solver.iterations = 10;
    this.physicsMaterials = {
      player: new CANNON.Material("player"),
      static: new CANNON.Material("static")
    };
    const contact = new CANNON.ContactMaterial(
      this.physicsMaterials.player,
      this.physicsMaterials.static,
      { friction: 0.0, restitution: 0.0 }
    );
    this.physicsWorld.addContactMaterial(contact);

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
    this.renderProfile.world = this;
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
    this.hittableGroup.clear();

    // Remove debris
    for (const d of this.debris) d.destroy();
    this.debris = [];

    // Reset player position
    const spawn = sceneConfig?.playerSpawn
      ? new Vector3(...sceneConfig.playerSpawn)
      : new Vector3(0, this.player.height, 8);
    this.player.reset(spawn);

    // Configure render clear color to match sky
    this.renderer.setClearColor(new Color(modeConfig.skyColor), 1);

    // Reset physics world
    this.physicsWorld.bodies.length = 0;
    this._addStaticColliders();
    this.player.setupPhysicsBody();
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
    await target.build(this.scene, this);
    this.targets.push(target);
    this.entities.push(target);
    this.targetGroup.add(target.object3D);
    this.hittableGroup.add(target.hitbox);
    return target;
  }

  remove(entity) {
    if (entity.object3D) {
      this.targetGroup.remove(entity.object3D);
    }
    if (entity.hitbox) {
      this.hittableGroup.remove(entity.hitbox);
    }
  }

  update(dt) {
    // Apply input -> physics velocities
    this.player.update(dt, this);
    for (const entity of this.entities) {
      if (entity.alive && entity.prePhysics) entity.prePhysics(dt, this);
    }

    // Step physics
    const fixed = 1 / 60;
    this.physicsWorld.step(fixed, dt, 3);

    // Sync scene objects from physics bodies
    const colliders = [
      ...(this.colliders || []),
      ...(this.dynamicColliders || [])
    ];
    this.player.syncFromPhysics();
    for (const entity of this.entities) {
      if (entity.alive && entity.postPhysics) entity.postPhysics(dt, this);
    }

    // Update and clean up debris
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.update(dt);
      if (d.isDead()) {
        d.destroy();
        this.debris.splice(i, 1);
      }
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
    this.colliders = [...this.sceneBuilder.colliders];
    if (this.groundCollider) this.colliders.push(this.groundCollider);
    this.currentSceneConfig = sceneConfig;
    // Build physics static bodies for these colliders
    this._addStaticColliders();
  }

  refreshDynamicColliders() {
    this.dynamicColliders = this.targets
      .filter((t) => t.alive && t.getAABB)
      .map((t) => t.getAABB());
  }

  _addStaticColliders() {
    // Remove existing static bodies (keep player/targets)
    this.physicsWorld.bodies = this.physicsWorld.bodies.filter((b) => b.isDynamic);
    for (const c of this.colliders) {
      const size = new Vector3(c.max.x - c.min.x, c.max.y - c.min.y, c.max.z - c.min.z);
      const half = size.multiplyScalar(0.5);
      const shape = new CANNON.Box(new CANNON.Vec3(half.x, half.y, half.z));
      const body = new CANNON.Body({
        mass: 0,
        shape,
        position: new CANNON.Vec3(
          (c.max.x + c.min.x) / 2,
          (c.max.y + c.min.y) / 2,
          (c.max.z + c.min.z) / 2
        ),
        material: this.physicsMaterials.static
      });
      body.isStaticCollider = true;
      this.physicsWorld.addBody(body);
    }
  }
}
