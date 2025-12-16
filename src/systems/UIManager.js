import { GAMEPLAY_CONFIG, UI_DEFAULTS } from "../config/GameplayConfig.js";

export default class UIManager {
  constructor() {
    this.listeners = new Map();

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
    this.sensitivityInput = document.getElementById("sensitivity-input");
    this.sensitivityValue = document.getElementById("sensitivity-value");
    this.gameModeRadios = document.querySelectorAll('input[name="game-mode"]');
    this.sessionDuration = document.getElementById("session-duration");
    this.waveCount = document.getElementById("wave-count");
    this.waveConfigList = document.getElementById("wave-config-list");
    this.continuousTargets = document.getElementById("continuous-targets");
    this.continuousDuration = document.getElementById("continuous-duration");
    this.distributeAngleSlider = document.getElementById("distribute-angle-slider");
    this.distributeAngleValue = document.getElementById("distribute-angle-value");
    this.waveSettings = document.querySelector(".wave-settings");
    this.continuousSettings = document.querySelector(".continuous-settings");

    // Target type settings elements
    this.targetTypeRadios = document.querySelectorAll('input[name="target-type"]');
    this.robotArmorCheckbox = document.getElementById("robot-armor");
    this.robotMovingCheckbox = document.getElementById("robot-moving");
    this.robotSettings = document.querySelector(".robot-settings");
    this.robotScaleSlider = document.getElementById("robot-scale-slider");
    this.robotScaleInput = document.getElementById("robot-scale-input");
    this.robotScaleValue = document.getElementById("robot-scale-value");
    this.robotYOffsetSlider = document.getElementById("robot-yoffset-slider");
    this.robotYOffsetInput = document.getElementById("robot-yoffset-input");
    this.robotYOffsetValue = document.getElementById("robot-yoffset-value");

    // Game settings state
    this.gameSettings = {
      sensitivity: UI_DEFAULTS.sensitivity,
      gameMode: UI_DEFAULTS.gameMode,
      sessionDuration: UI_DEFAULTS.sessionDuration,
      waveCount: UI_DEFAULTS.waveCount,
      waves: [],
      continuousTargets: UI_DEFAULTS.continuousTargets,
      continuousDuration: UI_DEFAULTS.continuousDuration,
      distributeAngle: UI_DEFAULTS.distributeAngle,
      targetType: "geometric",
      robotArmor: false,
      robotMoving: true,
      robotModelScale: UI_DEFAULTS.robotModelScale,
      robotModelYOffset: UI_DEFAULTS.robotModelYOffset
    };

    this._initDefaultWaves();
    this._bindSettingsEvents();
  }

  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(cb);
  }

  emit(event, payload) {
    if (!this.listeners.has(event)) return;
    for (const cb of this.listeners.get(event)) {
      cb(payload);
    }
  }

  _initDefaultWaves() {
    // Use deep copy to avoid modifying the original config
    this.gameSettings.waves = GAMEPLAY_CONFIG.waves.map(wave => ({ ...wave }));
  }

  _bindSettingsEvents() {
    // Sensitivity slider
    if (this.sensitivitySlider) {
      this.sensitivitySlider.addEventListener("input", (e) => {
        this._setSensitivity(parseFloat(e.target.value));
      });
    }

    // Sensitivity input box
    if (this.sensitivityInput) {
      this.sensitivityInput.addEventListener("input", (e) => {
        this._setSensitivity(parseFloat(e.target.value));
      });
    }

    // Distribute angle slider
    if (this.distributeAngleSlider) {
      this.distributeAngleSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        this.gameSettings.distributeAngle = val;
        if (this.distributeAngleValue) {
          this.distributeAngleValue.textContent = `${val}°`;
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

    // Target type toggle
    this.targetTypeRadios.forEach((radio) => {
      radio.addEventListener("change", (e) => {
        this.gameSettings.targetType = e.target.value;
        this._toggleTargetTypeSettings();
      });
    });

    // Robot settings
    if (this.robotArmorCheckbox) {
      this.robotArmorCheckbox.addEventListener("change", (e) => {
        this.gameSettings.robotArmor = e.target.checked;
      });
    }

    if (this.robotMovingCheckbox) {
      this.robotMovingCheckbox.addEventListener("change", (e) => {
        this.gameSettings.robotMoving = e.target.checked;
      });
    }

    // Robot model tuning
    if (this.robotScaleSlider) {
      this.robotScaleSlider.addEventListener("input", (e) => {
        this._setRobotModelScale(parseFloat(e.target.value));
      });
    }
    if (this.robotScaleInput) {
      this.robotScaleInput.addEventListener("input", (e) => {
        this._setRobotModelScale(parseFloat(e.target.value));
      });
    }
    if (this.robotYOffsetSlider) {
      this.robotYOffsetSlider.addEventListener("input", (e) => {
        this._setRobotModelYOffset(parseFloat(e.target.value));
      });
    }
    if (this.robotYOffsetInput) {
      this.robotYOffsetInput.addEventListener("input", (e) => {
        this._setRobotModelYOffset(parseFloat(e.target.value));
      });
    }
  }

  _toggleTargetTypeSettings() {
    if (this.robotSettings) {
      this.robotSettings.style.display = this.gameSettings.targetType === "robot" ? "block" : "none";
    }
  }

  _getSensitivityLimits() {
    const min = parseFloat(this.sensitivitySlider?.min ?? this.sensitivityInput?.min ?? "0.0005");
    const max = parseFloat(this.sensitivitySlider?.max ?? this.sensitivityInput?.max ?? "0.1");
    return {
      min: Number.isFinite(min) ? min : 0.0005,
      max: Number.isFinite(max) ? max : 0.1
    };
  }

  _setSensitivity(value) {
    if (Number.isNaN(value)) return;

    const { min, max } = this._getSensitivityLimits();
    const clamped = Math.min(max, Math.max(min, value));

    this.gameSettings.sensitivity = clamped;

    if (this.sensitivitySlider) {
      this.sensitivitySlider.value = clamped;
    }

    if (this.sensitivityInput) {
      this.sensitivityInput.value = clamped.toFixed(4);
    }

    if (this.sensitivityValue) {
      this.sensitivityValue.textContent = clamped.toFixed(4);
    }
  }

  _getRobotScaleLimits() {
    const min = parseFloat(this.robotScaleSlider?.min ?? this.robotScaleInput?.min ?? "0.001");
    const max = parseFloat(this.robotScaleSlider?.max ?? this.robotScaleInput?.max ?? "5");
    return {
      min: Number.isFinite(min) ? min : 0.001,
      max: Number.isFinite(max) ? max : 5
    };
  }

  _setRobotModelScale(value, { emit = true } = {}) {
    if (Number.isNaN(value)) return;
    const { min, max } = this._getRobotScaleLimits();
    const clamped = Math.min(max, Math.max(min, value));

    this.gameSettings.robotModelScale = clamped;

    if (this.robotScaleSlider) this.robotScaleSlider.value = clamped;
    if (this.robotScaleInput) this.robotScaleInput.value = clamped.toFixed(3);
    if (this.robotScaleValue) this.robotScaleValue.textContent = clamped.toFixed(3);

    if (emit) {
      this.emit("robotModelTuning", {
        scale: this.gameSettings.robotModelScale,
        yOffset: this.gameSettings.robotModelYOffset
      });
    }
  }

  _getRobotYOffsetLimits() {
    const min = parseFloat(this.robotYOffsetSlider?.min ?? this.robotYOffsetInput?.min ?? "-2");
    const max = parseFloat(this.robotYOffsetSlider?.max ?? this.robotYOffsetInput?.max ?? "2");
    return {
      min: Number.isFinite(min) ? min : -2,
      max: Number.isFinite(max) ? max : 2
    };
  }

  _setRobotModelYOffset(value, { emit = true } = {}) {
    if (Number.isNaN(value)) return;
    const { min, max } = this._getRobotYOffsetLimits();
    const clamped = Math.min(max, Math.max(min, value));

    this.gameSettings.robotModelYOffset = clamped;

    if (this.robotYOffsetSlider) this.robotYOffsetSlider.value = clamped;
    if (this.robotYOffsetInput) this.robotYOffsetInput.value = clamped.toFixed(2);
    if (this.robotYOffsetValue) this.robotYOffsetValue.textContent = clamped.toFixed(2);

    if (emit) {
      this.emit("robotModelTuning", {
        scale: this.gameSettings.robotModelScale,
        yOffset: this.gameSettings.robotModelYOffset
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
      const lastWave = this.gameSettings.waves[this.gameSettings.waves.length - 1] || UI_DEFAULTS.baseWave;
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
    this._setSensitivity(this.gameSettings.sensitivity);
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
    if (this.distributeAngleSlider) {
      this.distributeAngleSlider.value = this.gameSettings.distributeAngle;
    }
    if (this.distributeAngleValue) {
      this.distributeAngleValue.textContent = `${this.gameSettings.distributeAngle}°`;
    }
    // Sync target type settings
    this.targetTypeRadios.forEach((radio) => {
      radio.checked = radio.value === this.gameSettings.targetType;
    });
    if (this.robotArmorCheckbox) {
      this.robotArmorCheckbox.checked = this.gameSettings.robotArmor;
    }
    if (this.robotMovingCheckbox) {
      this.robotMovingCheckbox.checked = this.gameSettings.robotMoving;
    }
    this._setRobotModelScale(this.gameSettings.robotModelScale, { emit: false });
    this._setRobotModelYOffset(this.gameSettings.robotModelYOffset, { emit: false });
    this._toggleTargetTypeSettings();
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
