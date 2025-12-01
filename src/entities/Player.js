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

    this.height = 1.6;
    this.sensitivity = 0.0025;
    this.onGround = true;

    this.stateMachine = new StateMachine("idle");
    this._setupStates();
  }

  reset(spawn) {
    if (spawn) {
      this.camera.position.copy(spawn);
    } else {
      this.camera.position.set(0, this.height, 8);
    }
    this.velocity.set(0, 0, 0);
    this.heading.set(0, 0, 0, "YXZ");
  }

  handleResize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    if (!this.input) return;

    // Look
    const look = this.input.consumeLookDelta();
    this.heading.y -= look.x * this.sensitivity;
    this.heading.x -= look.y * this.sensitivity;
    this.heading.x = MathUtils.clamp(this.heading.x, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    this.camera.quaternion.setFromEuler(this.heading);

    // Move
    const cfg = this.world.gameplayConfig.player;
    const dir = new Vector3();
    const forward = new Vector3(0, 0, -1).applyEuler(this.heading);
    const right = new Vector3(1, 0, 0).applyEuler(this.heading);
    forward.y = 0;
    right.y = 0;
    forward.normalize();
    right.normalize();

    const moveAxis = this.input.getMoveAxis();
    const sprint = this.input.isSprinting();
    const speed = cfg.moveSpeed * (sprint ? cfg.sprintMultiplier : 1);

    dir.add(forward.multiplyScalar(moveAxis.y));
    dir.add(right.multiplyScalar(moveAxis.x));

    if (dir.lengthSq() > 0) dir.normalize().multiplyScalar(speed * dt);

    // Jump and gravity
    if (this.onGround && this.input.consumeJump()) {
      this.velocity.y = cfg.jumpStrength;
      this.onGround = false;
      this.stateMachine.setState("jump");
    }
    this.velocity.y -= cfg.gravity * dt;

    // Integrate motion
    this.camera.position.add(dir);
    this.camera.position.y += this.velocity.y * dt;

    // Ground collision at y = player height
    if (this.camera.position.y < this.height) {
      this.camera.position.y = this.height;
      this.velocity.y = 0;
      this.onGround = true;
    }

    this.stateMachine.update(dt, {
      player: this,
      moving: moveAxis.lengthSq() > 0.01,
      onGround: this.onGround
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
          if (ctx.onGround) this.stateMachine.setState(ctx.moving ? "move" : "idle");
        }
      });
    this.stateMachine.setState("idle");
  }
}
