import { Vector2 } from "three";

// Intent-based input manager: movement axes, look delta, and actions.
export default class InputManager {
  constructor(canvas) {
    this.canvas = canvas;

    // State
    this.keys = new Set();
    this.pointerLocked = false;

    // Look
    this.lookDelta = new Vector2(); // accumulated look delta since last consume
    this._moveAxis = new Vector2(); // cached movement axis

    // Actions
    this.fireHeld = false;
    this.jumpQueued = false;
    this.reloadQueued = false;
    this.useQueued = false;
    this.switchQueue = null; // weapon slot number

    this._bindEvents();
  }

  _bindEvents() {
    const gameKeyCodes = new Set([
      "KeyW", "KeyA", "KeyS", "KeyD",
      "Space",
      "ShiftLeft", "ShiftRight",
      "ControlLeft", "ControlRight",
      "KeyR", "KeyE",
      "Digit1", "Digit2", "Digit3", "Digit4", "Digit5",
    ]);

    // Keyboard: use document instead of window for slightly more reliable focus handling.
    document.addEventListener("keydown", (e) => {
      if (gameKeyCodes.has(e.code)) {
        e.preventDefault(); // Prevent default scrolling on Space / Shift+Space.
      }

      this.keys.add(e.code);

      if (e.code === "Space") this.jumpQueued = true;
      if (e.code === "KeyR") this.reloadQueued = true;
      if (e.code === "KeyE") this.useQueued = true;
      if (e.code.startsWith("Digit")) {
        this.switchQueue = Number(e.code.replace("Digit", ""));
      }
    });

    document.addEventListener("keyup", (e) => {
      if (gameKeyCodes.has(e.code)) {
        e.preventDefault();
      }
      this.keys.delete(e.code);
    });

    // Click the canvas to request pointer lock
    this.canvas.addEventListener("click", () => {
      if (this.pointerLocked) return;

      try {
        const maybePromise = this.canvas.requestPointerLock?.();
        if (maybePromise && typeof maybePromise.catch === "function") {
          maybePromise.catch((err) => {
            // Some browsers throw SecurityError when the user rapidly cancels; ignore those
            if (err && err.name === "SecurityError") return;
            console.warn("Pointer lock request failed:", err);
          });
        }
      } catch (err) {
        console.warn("Pointer lock threw:", err);
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked) {
        this.lookDelta.set(0, 0);
        this.fireHeld = false;
      }
    });

    // Mouse movement (only accumulate while pointer locked)
    document.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked) return;
      this.lookDelta.x += e.movementX;
      this.lookDelta.y += e.movementY;
    }, { passive: true });

    // Mouse buttons.
    document.addEventListener("mousedown", (e) => {
      if (e.button === 0) this.fireHeld = true;
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.fireHeld = false;
    });
  }

  getMoveAxis() {
    const x = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const y = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0);

    this._moveAxis.set(x, y);
    if (this._moveAxis.lengthSq() > 1) {
      this._moveAxis.normalize();
    }
    return this._moveAxis;
  }

  consumeLookDelta() {
    const x = this.lookDelta.x;
    const y = this.lookDelta.y;
    this.lookDelta.set(0, 0);
    return { x, y };
  }

  consumeJump() {
    const val = this.jumpQueued;
    this.jumpQueued = false;
    return val;
  }

  consumeReload() {
    const val = this.reloadQueued;
    this.reloadQueued = false;
    return val;
  }

  consumeUse() {
    const val = this.useQueued;
    this.useQueued = false;
    return val;
  }

  consumeWeaponSwitch() {
    const val = this.switchQueue;
    this.switchQueue = null;
    return val;
  }

  isFiring() {
    return this.fireHeld && this.pointerLocked;
  }

  isSprinting() {
    return this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
  }

  isCrouching() {
    return this.keys.has("ControlLeft") || this.keys.has("ControlRight");
  }
}
