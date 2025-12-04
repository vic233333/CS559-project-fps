import {
  Group,
  PlaneGeometry,
  MeshBasicMaterial,
  Mesh,
  CanvasTexture,
  DoubleSide,
  BoxGeometry,
  Vector3
} from "three";

// In-game 3D UI elements: scoreboard and sensitivity adjustment panels
export default class InGameUI {
  constructor(world, game) {
    this.world = world;
    this.game = game;
    this.group = new Group();
    this.scoreboardCanvas = null;
    this.scoreboardTexture = null;
    this.scoreboardMesh = null;
    this.sensitivityPanels = [];
    this.lastScore = -1;
    this.lastTime = -1;
    this.lastWaveNumber = null;
    this.lastIsWaveMode = null;
    this.lastSensitivity = -1;
    
    // Sensitivity panel dimensions (shared between creation and hit detection)
    this.panelWidth = 1.2;
    this.panelDepth = 0.8;
    this.panelHeight = 0.1;
  }

  async build() {
    this._createScoreboard();
    this._createSensitivityPanels();
    this.world.scene.add(this.group);
  }

  _createScoreboard() {
    // Create a large vertical plane for the scoreboard
    const width = 30;
    const height = 15;
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    this.scoreboardCanvas = canvas;

    this._renderScoreboard(0, 60, { waveNumber: 1, isWaveMode: true });

    this.scoreboardTexture = new CanvasTexture(canvas);
    const geometry = new PlaneGeometry(width, height);
    const material = new MeshBasicMaterial({
      map: this.scoreboardTexture,
      transparent: true,
      side: DoubleSide,
      opacity: 0.95
    });

    this.scoreboardMesh = new Mesh(geometry, material);
    // Position the scoreboard in front of the player, high up
    this.scoreboardMesh.position.set(0, height / 2 + 2, -12);
    this.scoreboardMesh.rotation.x = -0.1; // Slight tilt toward player

    this.group.add(this.scoreboardMesh);
  }

  _renderScoreboard(score, time, { waveNumber, isWaveMode }) {
    const ctx = this.scoreboardCanvas.getContext("2d");
    const w = this.scoreboardCanvas.width;
    const h = this.scoreboardCanvas.height;

    // Clear with dark background
    ctx.fillStyle = "rgba(10, 10, 15, 0.9)";
    ctx.fillRect(0, 0, w, h);

    // Border
    ctx.strokeStyle = "#ffc800";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Header line
    ctx.fillStyle = "#ffc800";
    ctx.fillRect(10, 60, w - 20, 2);

    // Title
    ctx.font = "bold 48px Rajdhani, sans-serif";
    ctx.fillStyle = "#ffc800";
    ctx.textAlign = "center";
    ctx.fillText("FPS TRAINING RANGE", w / 2, 50);

    // Time display (large)
    const timeStr = Math.max(0, Math.ceil(time)).toString();
    ctx.font = "bold 180px Rajdhani, sans-serif";
    ctx.fillStyle = time <= 10 ? "#ff3333" : "#ffffff";
    ctx.fillText(timeStr, w / 2, 250);

    // Labels
    ctx.font = "32px Rajdhani, sans-serif";
    ctx.fillStyle = "#666666";
    ctx.fillText("TIME REMAINING", w / 2, 290);

    // Score and Wave
    ctx.font = "bold 64px Rajdhani, sans-serif";
    ctx.fillStyle = "#ffc800";
    ctx.textAlign = "left";
    ctx.fillText(`SCORE: ${score}`, 40, 400);

    ctx.textAlign = "right";
    const waveText = isWaveMode ? `WAVE: ${waveNumber}` : `MODE: ∞`;
    ctx.fillText(waveText, w - 40, 400);

    // Bottom decorative line
    ctx.fillStyle = "#ffc800";
    ctx.fillRect(10, h - 70, w - 20, 2);

    // System info
    ctx.font = "24px Rajdhani, sans-serif";
    ctx.fillStyle = "#444444";
    ctx.textAlign = "center";
    ctx.fillText("// SYS.DISPLAY.ACTIVE //", w / 2, h - 30);
  }

  _createSensitivityPanels() {
    const spacing = 1.4;
    const baseY = 0.05;
    const baseZ = 8; // In front of player spawn

    // Panel configurations: [label, delta, color]
    const configs = [
      ["-0.01", -0.001, "#ff6666"],
      ["-0.1", -0.0005, "#ffaa66"],
      ["SENS", 0, "#ffc800"], // Center display
      ["+0.1", 0.0005, "#66ff66"],
      ["+0.01", 0.001, "#66ffaa"]
    ];

    configs.forEach((cfg, i) => {
      const [label, delta, color] = cfg;
      const xPos = (i - 2) * spacing;

      const panel = this._createSensitivityPanel(label, delta, color, this.panelWidth, this.panelDepth, this.panelHeight);
      panel.position.set(xPos, baseY, baseZ);
      panel.userData.sensitivityDelta = delta;
      panel.userData.isSensitivityPanel = true;
      panel.userData.isCenter = delta === 0;

      this.group.add(panel);
      this.sensitivityPanels.push(panel);
    });
  }

  _createSensitivityPanel(label, delta, color, width, depth, height) {
    const group = new Group();

    // Base platform
    const baseGeo = new BoxGeometry(width, height, depth);
    const baseMat = new MeshBasicMaterial({
      color: delta === 0 ? 0x222222 : 0x111111,
      transparent: true,
      opacity: 0.9
    });
    const baseMesh = new Mesh(baseGeo, baseMat);
    group.add(baseMesh);

    // Top surface with label
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = delta === 0 ? "#1a1a1a" : "#0a0a0a";
    ctx.fillRect(0, 0, 256, 128);

    // Border
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 248, 120);

    // Label
    ctx.font = "bold 48px Rajdhani, sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 128, 64);

    const texture = new CanvasTexture(canvas);
    const topGeo = new PlaneGeometry(width * 0.95, depth * 0.95);
    const topMat = new MeshBasicMaterial({
      map: texture,
      transparent: true
    });
    const topMesh = new Mesh(topGeo, topMat);
    topMesh.rotation.x = -Math.PI / 2;
    topMesh.position.y = height / 2 + 0.01;
    topMesh.userData.canvas = canvas;
    topMesh.userData.texture = texture;
    topMesh.userData.label = label;
    topMesh.userData.color = color;

    group.add(topMesh);
    group.userData.topMesh = topMesh;

    return group;
  }

  updateSensitivityDisplay(sensitivity) {
    // Update the center panel to show current sensitivity
    const centerPanel = this.sensitivityPanels.find((p) => p.userData.isCenter);
    if (centerPanel && centerPanel.userData.topMesh) {
      const topMesh = centerPanel.userData.topMesh;
      const canvas = topMesh.userData.canvas;
      const ctx = canvas.getContext("2d");

      // Clear and redraw
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(0, 0, 256, 128);

      ctx.strokeStyle = "#ffc800";
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, 248, 120);

      ctx.font = "bold 32px Rajdhani, sans-serif";
      ctx.fillStyle = "#ffc800";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(sensitivity.toFixed(4), 128, 64);

      topMesh.userData.texture.needsUpdate = true;
    }
  }

  update(score, time, wave, sensitivity) {
    // Convert wave parameter to structured format
    const isWaveMode = typeof wave === "number";
    const waveNumber = isWaveMode ? wave : null;

    // Only update scoreboard if values changed
    if (
      score !== this.lastScore ||
      Math.floor(time) !== Math.floor(this.lastTime) ||
      waveNumber !== this.lastWaveNumber ||
      isWaveMode !== this.lastIsWaveMode
    ) {
      this._renderScoreboard(score, time, { waveNumber, isWaveMode });
      this.scoreboardTexture.needsUpdate = true;
      this.lastScore = score;
      this.lastTime = time;
      this.lastWaveNumber = waveNumber;
      this.lastIsWaveMode = isWaveMode;
    }

    // Update sensitivity display if changed
    if (Math.abs(sensitivity - this.lastSensitivity) > 0.00001) {
      this.updateSensitivityDisplay(sensitivity);
      this.lastSensitivity = sensitivity;
    }
  }

  // Check if a hit intersects with sensitivity panels
  checkSensitivityPanelHit(hitPoint) {
    for (const panel of this.sensitivityPanels) {
      if (panel.userData.isCenter) continue; // Center panel doesn't adjust

      const panelPos = panel.position;
      const halfWidth = this.panelWidth / 2;
      const halfDepth = this.panelDepth / 2;

      if (
        hitPoint.x >= panelPos.x - halfWidth &&
        hitPoint.x <= panelPos.x + halfWidth &&
        hitPoint.z >= panelPos.z - halfDepth &&
        hitPoint.z <= panelPos.z + halfDepth &&
        hitPoint.y >= 0 &&
        hitPoint.y <= 0.2
      ) {
        return panel.userData.sensitivityDelta;
      }
    }
    return null;
  }

  getHittableObjects() {
    // Return meshes that can be hit for sensitivity adjustment
    const objects = [];
    for (const panel of this.sensitivityPanels) {
      if (!panel.userData.isCenter) {
        panel.traverse((child) => {
          if (child.isMesh) {
            child.userData.sensitivityDelta = panel.userData.sensitivityDelta;
            objects.push(child);
          }
        });
      }
    }
    return objects;
  }

  destroy() {
    this.world.scene.remove(this.group);
    // Dispose geometries and materials
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (child.material.map) child.material.map.dispose();
        child.material.dispose();
      }
    });
  }
}
