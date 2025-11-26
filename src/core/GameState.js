const VALID_STATES = ["menu", "loading", "playing", "paused", "ended"];

export default class GameState {
  constructor() {
    this.state = "menu";
    this.listeners = new Map();
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

  setState(next) {
    if (!VALID_STATES.includes(next)) {
      console.warn(`Invalid state: ${next}`);
      return;
    }
    if (this.state === next) return;
    const prev = this.state;
    this.state = next;
    this.emit("change", { prev, next });
  }

  reset() {
    this.state = "menu";
    this.emit("change", { prev: null, next: "menu" });
  }

  is(state) {
    return this.state === state;
  }
}
