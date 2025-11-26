import { Vector2 } from "three";

export default class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDelta = new Vector2();
    this.pointerLocked = false;
    this.fireHeld = false;
    this.jumpQueued = false;

    this._bindEvents();
  }

  _bindEvents() {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code === "Space") this.jumpQueued = true;
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });

    this.canvas.addEventListener("click", () => {
      if (!this.pointerLocked) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked) return;
      this.mouseDelta.x += e.movementX;
      this.mouseDelta.y += e.movementY;
    });

    window.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.fireHeld = true;
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.fireHeld = false;
    });
  }

  consumeMouseDelta() {
    const delta = this.mouseDelta.clone();
    this.mouseDelta.set(0, 0);
    return delta;
  }

  isKeyDown(code) {
    return this.keys.has(code);
  }

  isFiring() {
    return this.fireHeld && this.pointerLocked;
  }

  consumeJump() {
    const val = this.jumpQueued;
    this.jumpQueued = false;
    return val;
  }
}
