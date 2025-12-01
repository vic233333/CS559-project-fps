import { Vector3 } from "three";

export default class WaveManager {
  constructor(world, gameplayConfig) {
    this.world = world;
    this.config = gameplayConfig;
    this.spawnPoints = [];
    this.sceneConfig = null;
    this.waveIndex = 0;
    this.elapsed = 0;
    this.activeTargets = [];
    this.onWave = () => {};
  }

  setSpawnPoints(points) {
    this.spawnPoints = points || [];
  }

  setSceneConfig(cfg) {
    this.sceneConfig = cfg;
  }

  async start() {
    this.waveIndex = 0;
    await this.beginWave(this.waveIndex);
  }

  async beginWave(index) {
    const wave = this.config.waves[index];
    if (!wave) return;
    this.elapsed = 0;
    this.activeTargets = [];

    const moveCount = Math.floor(wave.targets * wave.movingRatio);
    for (let i = 0; i < wave.targets; i++) {
      const moving = i < moveCount;
      const spawn =
        this.spawnPoints.length > 0
          ? this.spawnPoints[i % this.spawnPoints.length].position
          : this._fallbackSpawn(i, wave.targets);
      const target = await this.world.spawnTarget({
        moving,
        speed: wave.speed,
        radius: this.config.target.radius,
        position: spawn.clone()
      });
      this.activeTargets.push(target);
    }
    this.onWave(this.currentWaveNumber());
  }

  currentWaveNumber() {
    return this.waveIndex + 1;
  }

  update(dt) {
    const wave = this.config.waves[this.waveIndex];
    if (!wave) return;
    this.elapsed += dt;

    // Remove dead targets from active list
    this.activeTargets = this.activeTargets.filter((t) => t.alive);

    const waveExpired = this.elapsed >= wave.duration;
    const cleared = this.activeTargets.length === 0;
    if ((waveExpired || cleared) && this.waveIndex < this.config.waves.length - 1) {
      this.waveIndex += 1;
      this.beginWave(this.waveIndex);
    }

    // TODO: Spawn tougher enemy types or add projectiles in later waves to satisfy automation/AI goals.
  }

  _fallbackSpawn(i, total) {
    const angle = (i / total) * Math.PI * 2;
    const radius = this.config.target.moveRadius;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    return new Vector3(x, this.config.playerHeight || 1.2, z);
  }
}
