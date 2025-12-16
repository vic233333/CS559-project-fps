import { Vector2, Vector3, Euler, MathUtils } from "three";

// Manages bullet spread and recoil effects
export default class RecoilSystem {
  constructor() {
    // Spread configuration
    this.baseSpread = 0;          // Base spread when stationary
    this.moveSpreadMultiplier = 2.5;  // Spread multiplier when moving
    this.airSpreadMultiplier = 5.0;   // Spread multiplier when airborne
    this.maxSpread = 0.15;        // Maximum spread angle in radians

    // Recoil configuration
    // - First few shots should feel stable.
    // - Sustained fire becomes less stable (more climb + spread).
    this.stableShots = 3;         // "Stable" shots at the start of a burst
    this.burstResetTime = 0.25;   // Seconds since last shot to reset burst stability

    this.recoilPerShot = 0.0045;  // Recoil heat added per shot (after stable shots)
    this.recoilRampPerShot = 0.15; // Extra heat per shot deeper into a burst
    this.maxViewPunch = 0.05;     // Maximum recoil heat (also drives max spread)
    this.recoverySpeed = 7;       // How fast camera kick target recovers

    // State
    this.currentSpread = 0;
    this.viewPunchAccumulator = 0;
    this.viewPunch = new Euler(0, 0, 0, "YXZ");
    this.targetViewPunch = new Euler(0, 0, 0, "YXZ");

    // Burst tracking for "first 3 shots stable"
    this.timeSinceLastShot = Number.POSITIVE_INFINITY;
    this.burstShots = 0;
  }

  // Calculate spread based on player state
  calculateSpread(playerVelocity, isGrounded, isCrouching, isSprinting) {
    const horizontalSpeed = Math.sqrt(playerVelocity.x ** 2 + playerVelocity.z ** 2);

    let spreadMultiplier = 1;

    // Not grounded = max spread
    if (!isGrounded) {
      spreadMultiplier = this.airSpreadMultiplier;
    } else {
      // Moving increases spread proportionally to speed
      const normalizedSpeed = Math.min(horizontalSpeed / 7.5, 1); // 7.5 is base move speed
      spreadMultiplier = 1 + normalizedSpeed * (this.moveSpreadMultiplier - 1);

      // Crouching reduces spread
      if (isCrouching) {
        spreadMultiplier *= 0.7;
      }

      // Sprinting increases spread further
      if (isSprinting && horizontalSpeed > 3) {
        spreadMultiplier *= 1.5;
      }
    }

    // Include accumulated recoil in spread
    const recoilSpread = this.viewPunchAccumulator * 2;

    this.currentSpread = Math.min(
      (this.baseSpread + recoilSpread) * spreadMultiplier,
      this.maxSpread
    );

    return this.currentSpread;
  }

  // Apply spread to a direction vector
  applySpread(direction, spread = null) {
    const actualSpread = spread !== null ? spread : this.currentSpread;

    if (actualSpread <= 0) {
      return direction.clone();
    }

    // Random angle within spread cone
    const angle = Math.random() * Math.PI * 2;
    const deviation = Math.random() * actualSpread;

    // Create perpendicular vectors
    const up = new Vector3(0, 1, 0);
    const right = new Vector3().crossVectors(direction, up).normalize();
    const actualUp = new Vector3().crossVectors(right, direction).normalize();

    // Apply deviation
    const spreadDir = direction.clone();
    spreadDir.addScaledVector(right, Math.cos(angle) * Math.sin(deviation));
    spreadDir.addScaledVector(actualUp, Math.sin(angle) * Math.sin(deviation));
    spreadDir.normalize();

    return spreadDir;
  }

  // Called when weapon fires
  onFire() {
    // Reset burst if the player paused firing long enough.
    if (this.timeSinceLastShot > this.burstResetTime) {
      this.burstShots = 0;
      this.viewPunchAccumulator = 0;
      this.targetViewPunch.set(0, 0, 0);
    }
    this.timeSinceLastShot = 0;
    this.burstShots += 1;

    const unstableShots = Math.max(0, this.burstShots - this.stableShots);

    // Add recoil "heat" only after the stable shots.
    if (unstableShots > 0) {
      const ramp = 1 + Math.min(unstableShots, 6) * this.recoilRampPerShot;
      this.viewPunchAccumulator = Math.min(
        this.viewPunchAccumulator + this.recoilPerShot * ramp,
        this.maxViewPunch
      );
    }

    const heat01 = this.maxViewPunch > 0 ? (this.viewPunchAccumulator / this.maxViewPunch) : 0;

    // Camera kick: positive X = pitch up in our Player heading convention.
    const stableKick = 0.0018; // gentle up-kick per shot
    const kickFromHeat = 0.0050 * heat01;
    const verticalRandom = Math.random() * (0.00015 + heat01 * 0.0006); // always adds upward
    const pitchKick = stableKick + kickFromHeat + verticalRandom;

    // Horizontal wobble: keep first shots very stable, ramp with heat.
    const yawRange = (unstableShots > 0 ? (0.0003 + heat01 * 0.0022) : 0.0001);
    const yawKick = (Math.random() - 0.5) * 2 * yawRange;

    // Accumulate into the target so sustained fire "climbs" smoothly.
    this.targetViewPunch.x = MathUtils.clamp(this.targetViewPunch.x + pitchKick, 0, 0.18);
    this.targetViewPunch.y = MathUtils.clamp(this.targetViewPunch.y + yawKick, -0.12, 0.12);
  }

  // Update recoil recovery
  update(dt, isFiring = false) {
    this.timeSinceLastShot += dt;
    if (this.timeSinceLastShot > this.burstResetTime) {
      this.burstShots = 0;
    }

    // View punch interpolation
    this.viewPunch.x = MathUtils.lerp(this.viewPunch.x, this.targetViewPunch.x, dt * 20);
    this.viewPunch.y = MathUtils.lerp(this.viewPunch.y, this.targetViewPunch.y, dt * 20);

    // Recovery - target goes back to 0
    this.targetViewPunch.x *= Math.exp(-dt * this.recoverySpeed);
    this.targetViewPunch.y *= Math.exp(-dt * this.recoverySpeed);

    // Accumulator decay (faster when not firing)
    const decayRate = isFiring ? 2 : 6;
    this.viewPunchAccumulator *= Math.exp(-dt * decayRate);

    // Clamp very small values to 0
    if (Math.abs(this.viewPunchAccumulator) < 0.0001) {
      this.viewPunchAccumulator = 0;
    }
  }

  // Get current view punch to apply to camera
  getViewPunch() {
    return this.viewPunch;
  }

  // Get spread value for crosshair display
  getSpreadForCrosshair() {
    // Return normalized spread (0-1) for crosshair expansion
    return this.currentSpread / this.maxSpread;
  }

  // Reset all recoil state
  reset() {
    this.currentSpread = 0;
    this.viewPunchAccumulator = 0;
    this.viewPunch.set(0, 0, 0);
    this.targetViewPunch.set(0, 0, 0);
    this.timeSinceLastShot = Number.POSITIVE_INFINITY;
    this.burstShots = 0;
  }
}
