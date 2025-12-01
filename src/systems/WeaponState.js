// Manages weapon firing/reload timing via a tiny state machine.
import StateMachine from "./StateMachine.js";

export default class WeaponState {
  constructor(config) {
    this.setConfig(config);
    this.machine = new StateMachine("ready");
    this._setupStates();
  }

  setConfig(config) {
    this.config = config;
    this.cooldown = 0;
    this.reloadTimer = 0;
  }

  _setupStates() {
    this.machine
      .addState("ready", {})
      .addState("cooldown", {
        onUpdate: (dt) => {
          this.cooldown -= dt;
          if (this.cooldown <= 0) this.machine.setState("ready");
        }
      })
      .addState("reload", {
        onUpdate: (dt) => {
          this.reloadTimer -= dt;
          if (this.reloadTimer <= 0) this.machine.setState("ready");
        }
      });
  }

  update(dt) {
    this.machine.update(dt);
  }

  tryFire() {
    if (this.machine.currentName !== "ready") return false;
    this.cooldown = 1 / (this.config.fireRate || 6);
    this.machine.setState("cooldown");
    return true;
  }

  startReload() {
    if (this.machine.currentName === "reload") return;
    this.reloadTimer = this.config.reloadTime || 1.2;
    this.machine.setState("reload");
  }
}
