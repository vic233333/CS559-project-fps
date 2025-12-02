import { PerspectiveCamera, Vector3, Euler, MathUtils } from "three";
import StateMachine from "../systems/StateMachine.js";
import * as CANNON from "cannon-es";

// Player movement driven by physics (cannon-es). Camera height is independent of crouch state; physics body height stays constant.
export default class Player {
  constructor({ modeManager, input, world }) {
    this.modeManager = modeManager;
    this.input = input;
    this.world = world;

    this.camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 1.6, 8);
    this.heading = new Euler(0, 0, 0, "YXZ");

    this.eyeHeightStanding = 1.6;
    this.eyeHeightCrouch = 1.1;
    this.interpolatedEyeOffset = this.eyeHeightStanding;
    this.bodyHeight = 1.8;
    this.radius = 0.35;
    this.sensitivity = 0.0025;
    this.onGround = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.isCrouching = false;
    this.isMoving = false;

    this.stateMachine = new StateMachine("idle");
    this._setupStates();

    this.body = null;
  }

  reset(spawn) {
    const target = spawn ? new Vector3().copy(spawn) : new Vector3(0, this.eyeHeightStanding, 8);
    if (this.body) {
      this.body.position.set(target.x, target.y, target.z);
      this.body.velocity.set(0, 0, 0);
      this.body.angularVelocity.set(0, 0, 0);
    } else {
      this.camera.position.copy(target);
    }
    this.heading.set(0, 0, 0, "YXZ");
    this.isCrouching = false;
    this.onGround = true;
  }

  handleResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    if (!this.input || !this.body) return;
    const cfg = this.world.gameplayConfig.player;
    const crouching = this.input.isCrouching();
    this.isCrouching = crouching;

    // Buffer jump input
    if (this.input.consumeJump()) this.jumpBufferTimer = cfg.jumpBufferTime;
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    // Look
    const look = this.input.consumeLookDelta();
    this.heading.y -= look.x * this.sensitivity;
    this.heading.x -= look.y * this.sensitivity;
    this.heading.x = MathUtils.clamp(this.heading.x, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    this.camera.quaternion.setFromEuler(this.heading);

    // Move intent
    const forward = new Vector3(0, 0, -1).applyEuler(this.heading);
    const right = new Vector3(1, 0, 0).applyEuler(this.heading);
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    const moveAxis = this.input.getMoveAxis();
    const sprint = this.input.isSprinting();
    const targetSpeed =
      cfg.moveSpeed *
      (sprint && this.onGround ? cfg.sprintMultiplier : 1) *
      (crouching ? cfg.crouchSpeedMultiplier : 1);
    const moving = moveAxis.lengthSq() > 0.01;
    this.isMoving = moving;

    const desiredDir = forward.multiplyScalar(moveAxis.y).add(right.multiplyScalar(moveAxis.x));
    const desired =
      desiredDir.lengthSq() > 0 ? desiredDir.normalize().multiplyScalar(targetSpeed) : desiredDir.set(0, 0, 0);

    const accel = this.onGround ? cfg.groundAccel : cfg.airAccel;
    if (this.onGround) {
      const step = Math.min(accel * dt, 1);
      this.body.velocity.x += (desired.x - this.body.velocity.x) * step;
      this.body.velocity.z += (desired.z - this.body.velocity.z) * step;
    } else {
      // Air control: add a small portion of desired direction, do not pull to full speed
      this.body.velocity.x += desired.x * accel * dt;
      this.body.velocity.z += desired.z * accel * dt;
    }

    // Clamp horizontal speed to prevent air acceleration spikes
    const maxHoriz = Math.min(cfg.maxSpeed, targetSpeed * (this.onGround ? 1.05 : 1.0));
    const hvx = this.body.velocity.x;
    const hvz = this.body.velocity.z;
    const hmag = Math.hypot(hvx, hvz);
    if (hmag > maxHoriz) {
      const scale = maxHoriz / hmag;
      this.body.velocity.x *= scale;
      this.body.velocity.z *= scale;
    }

    // Coyote timer
    if (this.onGround) this.coyoteTimer = cfg.coyoteTime;
    else if (this.coyoteTimer > 0) this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);

    // Jump
    if (this.jumpBufferTimer > 0 && (this.onGround || this.coyoteTimer > 0)) {
      this.body.velocity.y = cfg.jumpStrength;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.stateMachine.setState("jump");
    }

    const targetEyeOffset = this.isCrouching ? this.eyeHeightCrouch : this.eyeHeightStanding;
    this.interpolatedEyeOffset = MathUtils.lerp(this.interpolatedEyeOffset, targetEyeOffset, 15 * dt);
  }

  syncFromPhysics() {
    if (!this.body) return;

    // Raycast ground check. Cast a ray from the player's center downwards.
    const rayFrom = this.body.position;
    const rayTo = new CANNON.Vec3(rayFrom.x, rayFrom.y - this.bodyHeight * 0.5 - 0.1, rayFrom.z);
    const result = new CANNON.RaycastResult();
    this.world.physicsWorld.raycastClosest(rayFrom, rayTo, {}, result);

    if (result.hasHit && result.hitNormalWorld.y > 0.7) {
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    const feetY = this.body.position.y - this.bodyHeight * 0.5;
    const eyeY = feetY + this.interpolatedEyeOffset;
    this.camera.position.set(this.body.position.x, eyeY, this.body.position.z);

    this.stateMachine.update(0, {
      player: this,
      moving: this.isMoving,
      onGround: this.onGround,
      crouching: this.isCrouching
    });
  }

  _setupStates() {
    this.stateMachine
      .addState("idle", {
        onUpdate: (dt, ctx) => {
          if (!ctx.onGround) this.stateMachine.setState("air");
          else if (ctx.moving) this.stateMachine.setState("move");
        }
      })
      .addState("move", {
        onUpdate: (dt, ctx) => {
          if (!ctx.onGround) this.stateMachine.setState("air");
          else if (!ctx.moving) this.stateMachine.setState("idle");
        }
      })
      .addState("jump", {
        onUpdate: (dt, ctx) => {
          if (!ctx.onGround) this.stateMachine.setState("air");
        }
      })
      .addState("air", {
        onUpdate: (dt, ctx) => {
          if (ctx.onGround) {
            if (ctx.crouching) this.stateMachine.setState("crouch");
            else this.stateMachine.setState(ctx.moving ? "move" : "idle");
          }
        }
      })
      .addState("crouch", {
        onUpdate: (dt, ctx) => {
          if (!ctx.onGround) this.stateMachine.setState("air");
          else if (!ctx.crouching) this.stateMachine.setState(ctx.moving ? "move" : "idle");
        }
      });
    this.stateMachine.setState("idle");
  }

  setupPhysicsBody() {
    const shape = new CANNON.Cylinder(this.radius, this.radius, this.bodyHeight, 8);
    const body = new CANNON.Body({
      mass: 80,
      shape,
      material: this.world.physicsMaterials.player,
      position: new CANNON.Vec3(this.camera.position.x, this.camera.position.y, this.camera.position.z),
      fixedRotation: true,
      linearDamping: 0.08
    });
    body.isDynamic = true;
    body.allowSleep = false;
    this.world.physicsWorld.addBody(body);
    this.body = body;
  }
}
