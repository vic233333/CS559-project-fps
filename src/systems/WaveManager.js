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
    this.allWavesComplete = false;
  }

  setSpawnPoints(points) {
    this.spawnPoints = points || [];
  }

  setSceneConfig(cfg) {
    this.sceneConfig = cfg;
  }

  async start() {
    this.waveIndex = 0;
    this.allWavesComplete = false;
    await this.beginWave(this.waveIndex);
  }

  async beginWave(index) {
    const wave = this.config.waves[index];
    if (!wave) {
      this.allWavesComplete = true;
      return;
    }
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

  isAllWavesComplete() {
    return this.allWavesComplete;
  }

  update(dt) {
    const wave = this.config.waves[this.waveIndex];
    if (!wave) {
      this.allWavesComplete = true;
      return;
    }
    this.elapsed += dt;

    // Remove dead targets from active list
    this.activeTargets = this.activeTargets.filter((t) => t.alive);

    const waveExpired = this.elapsed >= wave.duration;
    const cleared = this.activeTargets.length === 0;

    if (waveExpired || cleared) {
      if (this.waveIndex < this.config.waves.length - 1) {
        this.waveIndex += 1;
        this.beginWave(this.waveIndex);
      } else {
        // All waves completed
        this.allWavesComplete = true;
      }
    }
  }

  _fallbackSpawn(i, total) {
    // Spawn targets in front of player (negative Z direction)
    const angle = (i / total) * Math.PI - Math.PI / 2; // Spread from -90 to +90 degrees
    const radius = this.config.target.moveRadius;
    const x = Math.cos(angle) * radius;
    const z = -Math.abs(Math.sin(angle) * radius) - 5; // Always in front (negative Z)
    return new Vector3(x, this.config.playerHeight || 1.2, z);
  }
}
