export default class Entity {
  constructor(object3D) {
    this.object3D = object3D;
    this.alive = true;
    this.tags = new Set();
  }

  update(dt) {
    // override in subclasses
  }

  onHit(damage) {
    // optional override
  }

  destroy(scene) {
    if (scene && this.object3D) {
      scene.remove(this.object3D);
    }
    this.alive = false;
  }
}
