import { PerspectiveCamera, Vector3, Euler, MathUtils } from "three";
import StateMachine from "../systems/StateMachine.js";

export default class Player {
  constructor({ modeManager, input, world }) {
    this.modeManager = modeManager;
    this.input = input;
    this.world = world;

    this.camera = new PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );
    this.camera.position.set(0, 1.6, 8);
    this.velocity = new Vector3();
    this.heading = new Euler(0, 0, 0, "YXZ");

    this.standingHeight = 1.6;
    this.crouchHeight = this.standingHeight - 0.5;
    this.currentHeight = this.standingHeight;
    this.height = this.standingHeight; // legacy ground check uses this.height
    this.sensitivity = 0.0025;
    this.onGround = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;

    this.stateMachine = new StateMachine("idle");
    this._setupStates();
  }

  reset(spawn) {
    if (spawn) {
      this.camera.position.copy(spawn);
    } else {
      this.camera.position.set(0, this.standingHeight, 8);
    }
    this.velocity.set(0, 0, 0);
    this.heading.set(0, 0, 0, "YXZ");
    this.currentHeight = this.standingHeight;
  }

  handleResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    if (!this.input) return;
    const cfg = this.world.gameplayConfig.player;
    const wasOnGround = this.onGround;
    let jumpedThisFrame = false;
    const crouching = this.input.isCrouching();

    // Buffer jump input so it can fire when conditions allow
    if (this.input.consumeJump()) {
      this.jumpBufferTimer = cfg.jumpBufferTime;
    }
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    // Look
    const look = this.input.consumeLookDelta();
    this.heading.y -= look.x * this.sensitivity;
    this.heading.x -= look.y * this.sensitivity;
    this.heading.x = MathUtils.clamp(this.heading.x, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    this.camera.quaternion.setFromEuler(this.heading);

    // Move
    const dir = new Vector3();
    const forward = new Vector3(0, 0, -1).applyEuler(this.heading);
    const right = new Vector3(1, 0, 0).applyEuler(this.heading);
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    const moveAxis = this.input.getMoveAxis();
    const sprint = this.input.isSprinting();
    const speed =
      cfg.moveSpeed *
      (sprint ? cfg.sprintMultiplier : 1) *
      (crouching ? cfg.crouchSpeedMultiplier : 1);
    const moving = moveAxis.lengthSq() > 0.01;

    dir.add(forward.multiplyScalar(moveAxis.y));
    dir.add(right.multiplyScalar(moveAxis.x));

    if (dir.lengthSq() > 0) dir.normalize().multiplyScalar(speed * dt);

    // Update coyote timer based on ground contact
    if (this.onGround) {
      this.coyoteTimer = cfg.coyoteTime;
    } else if (this.coyoteTimer > 0) {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    const wantsJump = this.jumpBufferTimer > 0;
    const canJump = this.onGround || this.coyoteTimer > 0;

    if (wantsJump && canJump) {
      this.velocity.y = cfg.jumpStrength;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      jumpedThisFrame = true;
      this.stateMachine.setState("jump");
    }

    // Gravity
    this.velocity.y -= cfg.gravity * dt;

    // Integrate motion
    this.camera.position.add(dir);
    this.camera.position.y += this.velocity.y * dt;

    // Smooth crouch height adjustment
    const targetHeight = crouching ? this.crouchHeight : this.standingHeight;
    this.currentHeight = MathUtils.lerp(this.currentHeight, targetHeight, Math.min(10 * dt, 1));

    // Ground collision at y = player height
    if (this.camera.position.y < this.currentHeight) {
      const landing = !wasOnGround;
      this.camera.position.y = this.currentHeight;
      this.velocity.y = 0;
      this.onGround = true;
      // If we buffered jump during air and are landing within the buffer window, jump immediately
      if (!jumpedThisFrame && this.jumpBufferTimer > 0) {
        this.velocity.y = cfg.jumpStrength;
        this.onGround = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        jumpedThisFrame = true;
        this.stateMachine.setState("jump");
      }
    }

    this.stateMachine.update(dt, {
      player: this,
      moving,
      onGround: this.onGround,
      crouching
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
}
