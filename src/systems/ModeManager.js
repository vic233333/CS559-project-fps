import { MODE_CONFIGS, MODE_NAMES, detectModeFromURL } from "../config/ModeConfig.js";

export default class ModeManager {
  constructor() {
    this.mode = detectModeFromURL();
    this.listeners = [];
  }

  currentMode() {
    return this.mode;
  }

  currentConfig() {
    return MODE_CONFIGS[this.mode];
  }

  onChange(cb) {
    this.listeners.push(cb);
  }

  setMode(nextMode) {
    if (!MODE_CONFIGS[nextMode]) return;
    if (nextMode === this.mode) return;
    this.mode = nextMode;
    this.listeners.forEach((cb) => cb(nextMode, MODE_CONFIGS[nextMode]));
    const url = new URL(window.location.href);
    url.searchParams.set("mode", nextMode);
    window.history.replaceState({}, "", url.toString());
  }
}
