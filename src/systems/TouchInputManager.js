import { Vector2 } from "three";

/**
 * TouchInputManager - Handles all touch input for mobile/tablet gameplay
 * Provides virtual joystick for movement, touch look area, and action buttons
 */
export default class TouchInputManager {
    constructor() {
        this.enabled = false;

        // Movement joystick state
        this.joystickActive = false;
        this.joystickTouchId = null;
        this.joystickCenter = new Vector2();
        this.joystickPosition = new Vector2();
        this.joystickRadius = 60; // Max distance from center
        this._moveAxis = new Vector2();

        // Look state
        this.lookTouchId = null;
        this.lookStart = new Vector2();
        this.lookDelta = new Vector2();
        this.lookSensitivity = 0.4;

        // Action states
        this.fireHeld = false;
        this.jumpQueued = false;
        this.crouchHeld = false;
        this.switchQueue = null;

        // DOM elements (set via init)
        this.overlay = null;
        this.joystickBase = null;
        this.joystickThumb = null;
        this.lookArea = null;
        this.fireBtn = null;
        this.jumpBtn = null;
        this.crouchBtn = null;
        this.weapon1Btn = null;
        this.weapon2Btn = null;
    }

    /**
     * Initialize touch controls with DOM elements
     */
    init() {
        this.overlay = document.getElementById("touch-controls-layer");
        this.joystickBase = document.querySelector(".joystick-base");
        this.joystickThumb = document.querySelector(".joystick-thumb");
        this.lookArea = document.getElementById("touch-look-area");
        this.fireBtn = document.getElementById("touch-fire-btn");
        this.jumpBtn = document.getElementById("touch-jump-btn");
        this.crouchBtn = document.getElementById("touch-crouch-btn");
        this.weapon1Btn = document.getElementById("touch-weapon1-btn");
        this.weapon2Btn = document.getElementById("touch-weapon2-btn");

        this._bindEvents();
    }

    /**
     * Enable or disable touch controls
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (this.overlay) {
            this.overlay.style.display = enabled ? "block" : "none";
        }
        if (!enabled) {
            this._reset();
        }
    }

    _reset() {
        this.joystickActive = false;
        this.joystickTouchId = null;
        this._moveAxis.set(0, 0);
        this.lookTouchId = null;
        this.lookDelta.set(0, 0);
        this.fireHeld = false;
        this.jumpQueued = false;
        this.crouchHeld = false;
        this.switchQueue = null;

        // Reset joystick visual
        if (this.joystickThumb) {
            this.joystickThumb.style.transform = "translate(-50%, -50%)";
        }
    }

    _bindEvents() {
        // Joystick touch events
        const joystickContainer = document.getElementById("touch-joystick");
        if (joystickContainer) {
            joystickContainer.addEventListener("touchstart", (e) => this._onJoystickStart(e), { passive: false });
            joystickContainer.addEventListener("touchmove", (e) => this._onJoystickMove(e), { passive: false });
            joystickContainer.addEventListener("touchend", (e) => this._onJoystickEnd(e), { passive: false });
            joystickContainer.addEventListener("touchcancel", (e) => this._onJoystickEnd(e), { passive: false });
        }

        // Look area touch events
        if (this.lookArea) {
            this.lookArea.addEventListener("touchstart", (e) => this._onLookStart(e), { passive: false });
            this.lookArea.addEventListener("touchmove", (e) => this._onLookMove(e), { passive: false });
            this.lookArea.addEventListener("touchend", (e) => this._onLookEnd(e), { passive: false });
            this.lookArea.addEventListener("touchcancel", (e) => this._onLookEnd(e), { passive: false });
        }

        // Fire button
        if (this.fireBtn) {
            this.fireBtn.addEventListener("touchstart", (e) => {
                e.preventDefault();
                this.fireHeld = true;
            }, { passive: false });
            this.fireBtn.addEventListener("touchend", (e) => {
                e.preventDefault();
                this.fireHeld = false;
            }, { passive: false });
            this.fireBtn.addEventListener("touchcancel", () => {
                this.fireHeld = false;
            });
        }

        // Jump button
        if (this.jumpBtn) {
            this.jumpBtn.addEventListener("touchstart", (e) => {
                e.preventDefault();
                this.jumpQueued = true;
            }, { passive: false });
            this.jumpBtn.addEventListener("touchend", (e) => {
                e.preventDefault();
            }, { passive: false });
        }

        // Crouch button (hold)
        if (this.crouchBtn) {
            this.crouchBtn.addEventListener("touchstart", (e) => {
                e.preventDefault();
                this.crouchHeld = true;
            }, { passive: false });
            this.crouchBtn.addEventListener("touchend", (e) => {
                e.preventDefault();
                this.crouchHeld = false;
            }, { passive: false });
            this.crouchBtn.addEventListener("touchcancel", () => {
                this.crouchHeld = false;
            });
        }

        // Weapon switch buttons
        if (this.weapon1Btn) {
            this.weapon1Btn.addEventListener("touchstart", (e) => {
                e.preventDefault();
                this.switchQueue = 1;
            }, { passive: false });
        }
        if (this.weapon2Btn) {
            this.weapon2Btn.addEventListener("touchstart", (e) => {
                e.preventDefault();
                this.switchQueue = 2;
            }, { passive: false });
        }
    }

    _onJoystickStart(e) {
        if (!this.enabled) return;
        e.preventDefault();

        const touch = e.changedTouches[0];
        if (this.joystickTouchId !== null) return;

        this.joystickTouchId = touch.identifier;
        this.joystickActive = true;

        // Get joystick center from element position
        const rect = e.currentTarget.getBoundingClientRect();
        this.joystickCenter.set(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2
        );

        this._updateJoystick(touch.clientX, touch.clientY);
    }

    _onJoystickMove(e) {
        if (!this.enabled || !this.joystickActive) return;
        e.preventDefault();

        for (const touch of e.changedTouches) {
            if (touch.identifier === this.joystickTouchId) {
                this._updateJoystick(touch.clientX, touch.clientY);
                break;
            }
        }
    }

    _onJoystickEnd(e) {
        e.preventDefault();

        for (const touch of e.changedTouches) {
            if (touch.identifier === this.joystickTouchId) {
                this.joystickTouchId = null;
                this.joystickActive = false;
                this._moveAxis.set(0, 0);

                // Reset visual
                if (this.joystickThumb) {
                    this.joystickThumb.style.transform = "translate(-50%, -50%)";
                }
                break;
            }
        }
    }

    _updateJoystick(x, y) {
        const dx = x - this.joystickCenter.x;
        const dy = y - this.joystickCenter.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let normX = dx;
        let normY = dy;

        if (dist > this.joystickRadius) {
            normX = (dx / dist) * this.joystickRadius;
            normY = (dy / dist) * this.joystickRadius;
        }

        // Update visual
        if (this.joystickThumb) {
            this.joystickThumb.style.transform = `translate(calc(-50% + ${normX}px), calc(-50% + ${normY}px))`;
        }

        // Normalize to -1 to 1 range
        this._moveAxis.x = normX / this.joystickRadius;
        // Invert Y because screen Y is inverted compared to game forward
        this._moveAxis.y = -normY / this.joystickRadius;
    }

    _onLookStart(e) {
        if (!this.enabled) return;
        e.preventDefault();

        const touch = e.changedTouches[0];
        if (this.lookTouchId !== null) return;

        this.lookTouchId = touch.identifier;
        this.lookStart.set(touch.clientX, touch.clientY);
    }

    _onLookMove(e) {
        if (!this.enabled || this.lookTouchId === null) return;
        e.preventDefault();

        for (const touch of e.changedTouches) {
            if (touch.identifier === this.lookTouchId) {
                const dx = touch.clientX - this.lookStart.x;
                const dy = touch.clientY - this.lookStart.y;

                // Accumulate delta
                this.lookDelta.x += dx * this.lookSensitivity;
                this.lookDelta.y += dy * this.lookSensitivity;

                // Update start position for incremental movement
                this.lookStart.set(touch.clientX, touch.clientY);
                break;
            }
        }
    }

    _onLookEnd(e) {
        e.preventDefault();

        for (const touch of e.changedTouches) {
            if (touch.identifier === this.lookTouchId) {
                this.lookTouchId = null;
                break;
            }
        }
    }

    // --- Public API matching InputManager ---

    getMoveAxis() {
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

    consumeWeaponSwitch() {
        const val = this.switchQueue;
        this.switchQueue = null;
        return val;
    }

    isFiring() {
        return this.fireHeld && this.enabled;
    }

    isCrouching() {
        return this.crouchHeld;
    }

    isSprinting() {
        // No sprint on touch - requires holding shift
        return false;
    }
}
