// Lightweight finite state machine usable for player and items.
export default class StateMachine {
  constructor(initial) {
    this.states = new Map();
    this.current = null;
    this.currentName = initial || null;
  }

  addState(name, config) {
    this.states.set(name, {
      onEnter: config.onEnter || (() => {}),
      onUpdate: config.onUpdate || (() => {}),
      onExit: config.onExit || (() => {})
    });
    return this;
  }

  setState(name, payload) {
    if (this.currentName === name || !this.states.has(name)) return;
    if (this.current) this.current.onExit(payload);
    this.current = this.states.get(name);
    this.currentName = name;
    this.current.onEnter(payload);
  }

  update(dt, context) {
    if (this.current) this.current.onUpdate(dt, context);
  }
}
