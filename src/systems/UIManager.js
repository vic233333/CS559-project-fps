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
    this.countdownLayer = document.getElementById("countdown-layer");
  }

  async startCountdown() {
    this.menu.classList.remove("visible");
    this.end.classList.remove("visible");
    this.countdownLayer.classList.add("active");

    const steps = ["3", "2", "1", "GO"];
    for (const step of steps) {
      this.countdownLayer.textContent = step;
      // Re-trigger animation
      this.countdownLayer.classList.remove("active");
      void this.countdownLayer.offsetWidth; // Force reflow
      this.countdownLayer.classList.add("active");

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.countdownLayer.classList.remove("active");
    this.countdownLayer.textContent = "";
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

      // Update Charts
      const accBar = document.getElementById('bar-accuracy');
      if (accBar) accBar.style.width = `${Math.min(100, stats.accuracy)}%`;

      if (stats.history) {
        this.drawChart(stats.history);
      }
    }
  }

  drawChart(data) {
    const canvas = document.getElementById('performance-chart');
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // Find Max Score for Scaling
    const maxScore = Math.max(...data.map(d => d.score), 100);

    // Draw Line
    ctx.strokeStyle = '#ffc800'; // Endfield Yellow
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (point.score / maxScore) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Fill
    ctx.fillStyle = 'rgba(255, 200, 0, 0.1)';
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();

    // Draw Points
    ctx.fillStyle = '#ffffff';
    data.forEach((point, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (point.score / maxScore) * h;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
