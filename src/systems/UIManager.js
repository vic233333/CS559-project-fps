export default class UIManager {
  constructor() {
    this.menu = document.getElementById("menu-screen");
    this.hud = document.getElementById("hud");
    this.end = document.getElementById("end-screen");
    this.scoreEl = document.getElementById("hud-score");
    this.timeEl = document.getElementById("hud-time");
    this.waveEl = document.getElementById("hud-wave");
    this.healthEl = document.getElementById("hud-health");
    this.finalScore = document.getElementById("final-score");
    this.finalWave = document.getElementById("final-wave");
    this.finalAccuracy = document.getElementById("final-accuracy");
  }

  showMenu() {
    this.menu.classList.add("visible");
    this.hud.classList.remove("visible");
    this.end.classList.remove("visible");
  }

  showHUD() {
    this.menu.classList.remove("visible");
    this.end.classList.remove("visible");
    this.hud.classList.add("visible");
  }

  showEnd() {
    this.end.classList.add("visible");
    this.menu.classList.remove("visible");
    this.hud.classList.remove("visible");
  }

  updateHUD({ score, time, wave, health }) {
    if (score !== undefined) this.scoreEl.textContent = `Score: ${score}`;
    if (time !== undefined) this.timeEl.textContent = `Time: ${Math.max(0, time).toFixed(0)}`;
    if (wave !== undefined) this.waveEl.textContent = `Wave: ${wave}`;
    if (health !== undefined) this.healthEl.textContent = `HP: ${health}`;
  }

  updateEnd(stats) {
    if (stats.score !== undefined) this.finalScore.textContent = `Score: ${stats.score}`;
    if (stats.wave !== undefined) this.finalWave.textContent = `Wave Reached: ${stats.wave}`;
    if (stats.accuracy !== undefined) {
      this.finalAccuracy.textContent = `Accuracy: ${stats.accuracy.toFixed(1)}%`;
    }
  }
}
