import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";
import * as CANNON from "cannon-es";

export default class Debris {
  constructor({ world, initialPosition, initialVelocity, size, color, lifespan = 2 }) {
    this.world = world;
    this.lifespan = lifespan;

    // Create physics body
    const shape = new CANNON.Box(new CANNON.Vec3(size * 0.5, size * 0.5, size * 0.5));
    this.body = new CANNON.Body({
      mass: size * 5, // Mass proportional to size
      position: initialPosition,
      velocity: initialVelocity,
      shape: shape,
      linearDamping: 0.1, // Some air resistance
      angularDamping: 0.5,
    });

    // Create visual mesh
    const geometry = new BoxGeometry(size, size, size);
    const material = new MeshStandardMaterial({ color: color, roughness: 0.5, metalness: 0.5 });
    this.mesh = new Mesh(geometry, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // Add to world
    this.world.physicsWorld.addBody(this.body);
    this.world.scene.add(this.mesh);
  }

  update(dt) {
    this.lifespan -= dt;

    // Sync mesh to physics body
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
  }

  isDead() {
    return this.lifespan <= 0;
  }

  destroy() {
    this.world.physicsWorld.removeBody(this.body);
    this.world.scene.remove(this.mesh);
  }
}
