export default class UIManager {
  constructor() {
    this.menu = document.getElementById("menu-screen");
    this.settings = document.getElementById("settings-screen");
    this.pause = document.getElementById("pause-screen");
    this.hud = document.getElementById("hud");
    this.end = document.getElementById("end-screen");
    this.scoreEl = document.getElementById("hud-score");
    this.timeEl = document.getElementById("hud-time");
    this.waveEl = document.getElementById("hud-wave");
    this.healthEl = document.getElementById("hud-health");
    this.weaponEl = document.getElementById("hud-weapon");
    this.sensitivityEl = document.getElementById("hud-sensitivity");
    this.finalScore = document.getElementById("final-score");
    this.finalWave = document.getElementById("final-wave");
    this.finalAccuracy = document.getElementById("final-accuracy");
    this.countdownLayer = document.getElementById("countdown-layer");

    // Settings elements
    this.sensitivitySlider = document.getElementById("sensitivity-slider");
    this.sensitivityValue = document.getElementById("sensitivity-value");
    this.gameModeRadios = document.querySelectorAll('input[name="game-mode"]');
    this.sessionDuration = document.getElementById("session-duration");
    this.waveCount = document.getElementById("wave-count");
    this.waveConfigList = document.getElementById("wave-config-list");
    this.continuousTargets = document.getElementById("continuous-targets");
    this.continuousDuration = document.getElementById("continuous-duration");
    this.waveSettings = document.querySelector(".wave-settings");
    this.continuousSettings = document.querySelector(".continuous-settings");

    // Game settings state
    this.gameSettings = {
      sensitivity: 0.0025,
      gameMode: "wave", // "wave" or "continuous"
      sessionDuration: 60,
      waveCount: 5,
      waves: [],
      continuousTargets: 5,
      continuousDuration: 60
    };

    this._initDefaultWaves();
    this._bindSettingsEvents();
  }

  _initDefaultWaves() {
    this.gameSettings.waves = [
      { id: 1, duration: 12, targets: 6, speed: 1.0, movingRatio: 0.2 },
      { id: 2, duration: 12, targets: 8, speed: 1.2, movingRatio: 0.4 },
      { id: 3, duration: 14, targets: 10, speed: 1.4, movingRatio: 0.5 },
      { id: 4, duration: 14, targets: 12, speed: 1.6, movingRatio: 0.6 },
      { id: 5, duration: 16, targets: 14, speed: 1.8, movingRatio: 0.7 }
    ];
  }

  _bindSettingsEvents() {
    // Sensitivity slider
    if (this.sensitivitySlider) {
      this.sensitivitySlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value);
        this.gameSettings.sensitivity = val;
        if (this.sensitivityValue) {
          this.sensitivityValue.textContent = val.toFixed(4);
        }
      });
    }

    // Game mode toggle
    this.gameModeRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.gameSettings.gameMode = e.target.value;
        this._toggleModeSettings();
      });
    });

    // Wave count change
    if (this.waveCount) {
      this.waveCount.addEventListener("change", (e) => {
        const count = parseInt(e.target.value, 10);
        this.gameSettings.waveCount = count;
        this._adjustWaveConfigs(count);
        this._renderWaveConfigs();
      });
    }

    // Session duration
    if (this.sessionDuration) {
      this.sessionDuration.addEventListener("change", (e) => {
        this.gameSettings.sessionDuration = parseInt(e.target.value, 10);
      });
    }

    // Continuous mode settings
    if (this.continuousTargets) {
      this.continuousTargets.addEventListener("change", (e) => {
        this.gameSettings.continuousTargets = parseInt(e.target.value, 10);
      });
    }

    if (this.continuousDuration) {
      this.continuousDuration.addEventListener("change", (e) => {
        this.gameSettings.continuousDuration = parseInt(e.target.value, 10);
      });
    }
  }

  _toggleModeSettings() {
    if (this.gameSettings.gameMode === "wave") {
      if (this.waveSettings) this.waveSettings.style.display = "block";
      if (this.continuousSettings) this.continuousSettings.style.display = "none";
    } else {
      if (this.waveSettings) this.waveSettings.style.display = "none";
      if (this.continuousSettings) this.continuousSettings.style.display = "block";
    }
  }

  _adjustWaveConfigs(count) {
    while (this.gameSettings.waves.length < count) {
      const lastWave = this.gameSettings.waves[this.gameSettings.waves.length - 1] || {
        duration: 12,
        targets: 6,
        speed: 1.0,
        movingRatio: 0.2
      };
      this.gameSettings.waves.push({
        id: this.gameSettings.waves.length + 1,
        duration: lastWave.duration + 2,
        targets: lastWave.targets + 2,
        speed: Math.min(lastWave.speed + 0.2, 3.0),
        movingRatio: Math.min(lastWave.movingRatio + 0.1, 1.0)
      });
    }
    this.gameSettings.waves = this.gameSettings.waves.slice(0, count);
  }

  _renderWaveConfigs() {
    if (!this.waveConfigList) return;
    this.waveConfigList.innerHTML = "";

    this.gameSettings.waves.forEach((wave, index) => {
      const item = document.createElement("div");
      item.className = "wave-config-item";
      item.innerHTML = `
        <span>Wave ${wave.id}</span>
        <label>Targets:</label>
        <input type="number" min="1" max="20" value="${wave.targets}" data-wave="${index}" data-field="targets">
        <label>Moving%:</label>
        <input type="number" min="0" max="100" value="${Math.round(wave.movingRatio * 100)}" data-wave="${index}" data-field="movingRatio">
      `;
      this.waveConfigList.appendChild(item);
    });

    // Bind events to new inputs
    this.waveConfigList.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", (e) => {
        const waveIndex = parseInt(e.target.dataset.wave, 10);
        const field = e.target.dataset.field;
        let value = parseInt(e.target.value, 10);
        if (field === "movingRatio") {
          value = value / 100;
        }
        this.gameSettings.waves[waveIndex][field] = value;
      });
    });
  }

  getGameSettings() {
    return { ...this.gameSettings };
  }

  async startCountdown(seconds = 3) {
    this.hideAll();
    this.countdownLayer.classList.add("active");

    const steps = [];
    for (let i = seconds; i >= 1; i--) {
      steps.push(String(i));
    }
    steps.push("GO");

    for (const step of steps) {
      this.countdownLayer.textContent = step;
      this.countdownLayer.classList.remove("active");
      void this.countdownLayer.offsetWidth;
      this.countdownLayer.classList.add("active");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.countdownLayer.classList.remove("active");
    this.countdownLayer.textContent = "";
  }

  hideAll() {
    this.menu.classList.remove("visible");
    this.settings.classList.remove("visible");
    this.pause.classList.remove("visible");
    this.hud.classList.remove("visible");
    this.end.classList.remove("visible");
  }

  showMenu() {
    this.hideAll();
    this.menu.classList.add("visible");
  }

  showSettings() {
    this.hideAll();
    this.settings.classList.add("visible");
    this._renderWaveConfigs();
    this._toggleModeSettings();
    // Sync UI with current settings
    if (this.sensitivitySlider) {
      this.sensitivitySlider.value = this.gameSettings.sensitivity;
    }
    if (this.sensitivityValue) {
      this.sensitivityValue.textContent = this.gameSettings.sensitivity.toFixed(4);
    }
    if (this.sessionDuration) {
      this.sessionDuration.value = this.gameSettings.sessionDuration;
    }
    if (this.waveCount) {
      this.waveCount.value = this.gameSettings.waveCount;
    }
    if (this.continuousTargets) {
      this.continuousTargets.value = this.gameSettings.continuousTargets;
    }
    if (this.continuousDuration) {
      this.continuousDuration.value = this.gameSettings.continuousDuration;
    }
  }

  showPause() {
    this.hideAll();
    this.pause.classList.add("visible");
  }

  showHUD() {
    this.hideAll();
    this.hud.classList.add("visible");
  }

  showEnd() {
    this.hideAll();
    this.end.classList.add("visible");
  }

  updateHUD({ score, time, wave, health, weapon, sensitivity }) {
    if (score !== undefined) this.scoreEl.textContent = `Score: ${score}`;
    if (time !== undefined) this.timeEl.textContent = `Time: ${Math.max(0, time).toFixed(0)}`;
    if (wave !== undefined) this.waveEl.textContent = `Wave: ${wave}`;
    if (health !== undefined) this.healthEl.textContent = `HP: ${health}`;
    if (weapon !== undefined && this.weaponEl) this.weaponEl.textContent = `Weapon: ${weapon}`;
    if (sensitivity !== undefined && this.sensitivityEl) {
      this.sensitivityEl.textContent = `Sens: ${sensitivity.toFixed(4)}`;
    }
  }

  updateEnd(stats) {
    if (stats.score !== undefined) this.finalScore.textContent = `Score: ${stats.score}`;
    if (stats.wave !== undefined) this.finalWave.textContent = `Wave Reached: ${stats.wave}`;
    if (stats.accuracy !== undefined) {
      this.finalAccuracy.textContent = `Accuracy: ${stats.accuracy.toFixed(1)}%`;

      const accBar = document.getElementById("bar-accuracy");
      if (accBar) accBar.style.width = `${Math.min(100, stats.accuracy)}%`;

      if (stats.history) {
        this.drawChart(stats.history);
      }
    }
  }

  drawChart(data) {
    const canvas = document.getElementById("performance-chart");
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext("2d");
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    const maxScore = Math.max(...data.map((d) => d.score), 100);

    ctx.strokeStyle = "#ffc800";
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (point.score / maxScore) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.fillStyle = "rgba(255, 200, 0, 0.1)";
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    data.forEach((point, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (point.score / maxScore) * h;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
