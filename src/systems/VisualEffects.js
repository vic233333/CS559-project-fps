import {
  Vector3,
  BufferGeometry,
  LineBasicMaterial,
  Line,
  PlaneGeometry,
  MeshBasicMaterial,
  Mesh,
  AdditiveBlending,
  DoubleSide,
  CanvasTexture,
  SphereGeometry,
  PointLight,
  Group
} from "three";

// Visual effects manager for bullet tracers, impact decals, and muzzle flash
export default class VisualEffects {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.decals = [];
    this.muzzleFlashes = [];
    this.maxDecals = 50; // Limit decals to prevent performance issues

    // Pre-create decal texture
    this._createDecalTexture();
  }

  _createDecalTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Create bullet hole effect
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(20, 20, 20, 1)');
    gradient.addColorStop(0.3, 'rgba(40, 35, 30, 0.9)');
    gradient.addColorStop(0.5, 'rgba(60, 50, 40, 0.7)');
    gradient.addColorStop(0.7, 'rgba(80, 70, 60, 0.4)');
    gradient.addColorStop(1, 'rgba(100, 90, 80, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();

    // Add some cracks/details
    ctx.strokeStyle = 'rgba(30, 25, 20, 0.8)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
      const innerRadius = 5 + Math.random() * 5;
      const outerRadius = 15 + Math.random() * 10;
      ctx.beginPath();
      ctx.moveTo(32 + Math.cos(angle) * innerRadius, 32 + Math.sin(angle) * innerRadius);
      ctx.lineTo(32 + Math.cos(angle) * outerRadius, 32 + Math.sin(angle) * outerRadius);
      ctx.stroke();
    }

    this.decalTexture = new CanvasTexture(canvas);
  }

  // Create a bullet tracer from start to end position
  createTracer(startPos, endPos, duration = 0.1) {
    const points = [startPos.clone(), endPos.clone()];
    const geometry = new BufferGeometry().setFromPoints(points);

    const material = new LineBasicMaterial({
      color: 0xffdd44,
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending
    });

    const line = new Line(geometry, material);
    this.scene.add(line);

    const tracer = {
      mesh: line,
      lifetime: duration,
      elapsed: 0,
      startOpacity: 0.8
    };

    this.tracers.push(tracer);
    return tracer;
  }

  // Create bullet impact decal at hit point
  createDecal(position, normal) {
    // Remove oldest decal if at limit
    if (this.decals.length >= this.maxDecals) {
      const oldDecal = this.decals.shift();
      this.scene.remove(oldDecal.mesh);
      oldDecal.mesh.geometry.dispose();
      oldDecal.mesh.material.dispose();
    }

    const size = 0.08 + Math.random() * 0.04;
    const geometry = new PlaneGeometry(size, size);
    const material = new MeshBasicMaterial({
      map: this.decalTexture,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: DoubleSide
    });

    const decal = new Mesh(geometry, material);
    decal.position.copy(position);

    // Orient decal to face along the normal
    if (normal) {
      decal.lookAt(position.clone().add(normal));
    }

    // Slight random rotation
    decal.rotation.z = Math.random() * Math.PI * 2;

    // Offset slightly from surface to prevent z-fighting
    if (normal) {
      decal.position.add(normal.clone().multiplyScalar(0.01));
    }

    this.scene.add(decal);

    const decalData = {
      mesh: decal,
      lifetime: 30, // Decals last 30 seconds
      elapsed: 0
    };

    this.decals.push(decalData);
    return decalData;
  }

  // Create muzzle flash effect at gun position
  createMuzzleFlash(position, direction) {
    const group = new Group();
    group.position.copy(position);

    // Flash sprite (multiple overlapping planes for volumetric look)
    const flashColors = [0xffff00, 0xffaa00, 0xff6600];
    const flashSizes = [0.15, 0.12, 0.08];

    for (let i = 0; i < 3; i++) {
      const size = flashSizes[i];
      const geo = new PlaneGeometry(size, size);
      const mat = new MeshBasicMaterial({
        color: flashColors[i],
        transparent: true,
        opacity: 0.9 - i * 0.2,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide
      });

      const flash = new Mesh(geo, mat);
      flash.rotation.z = Math.random() * Math.PI;
      flash.position.z = i * 0.02;
      group.add(flash);

      // Second plane perpendicular
      const flash2 = new Mesh(geo.clone(), mat.clone());
      flash2.rotation.y = Math.PI / 2;
      flash2.rotation.z = Math.random() * Math.PI;
      flash2.position.z = i * 0.02;
      group.add(flash2);
    }

    // Point light for flash illumination
    const light = new PointLight(0xffaa00, 2, 3);
    light.position.copy(position);
    group.add(light);

    // Orient group towards firing direction
    const target = position.clone().add(direction);
    group.lookAt(target);

    this.scene.add(group);

    const muzzleFlash = {
      group: group,
      light: light,
      lifetime: 0.05,
      elapsed: 0
    };

    this.muzzleFlashes.push(muzzleFlash);
    return muzzleFlash;
  }

  // Create spark particles at impact point
  createImpactSparks(position, normal, count = 5) {
    const sparks = [];

    for (let i = 0; i < count; i++) {
      const geo = new SphereGeometry(0.01, 4, 4);
      const mat = new MeshBasicMaterial({
        color: 0xffaa00,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending
      });

      const spark = new Mesh(geo, mat);
      spark.position.copy(position);

      // Random velocity away from surface
      const velocity = new Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 2,
        (Math.random() - 0.5) * 2
      );
      if (normal) {
        velocity.add(normal.clone().multiplyScalar(Math.random() * 2));
      }

      this.scene.add(spark);

      sparks.push({
        mesh: spark,
        velocity: velocity,
        lifetime: 0.3 + Math.random() * 0.2,
        elapsed: 0,
        gravity: -15
      });
    }

    // Store sparks in tracers array for unified update
    this.tracers.push(...sparks.map(s => ({
      ...s,
      isSpark: true
    })));
  }

  update(dt) {
    // Update tracers and sparks
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tracer = this.tracers[i];
      tracer.elapsed += dt;

      if (tracer.isSpark) {
        // Update spark physics
        tracer.velocity.y += tracer.gravity * dt;
        tracer.mesh.position.add(tracer.velocity.clone().multiplyScalar(dt));
        tracer.mesh.material.opacity = 1 - (tracer.elapsed / tracer.lifetime);
      } else {
        // Fade out tracer
        const progress = tracer.elapsed / tracer.lifetime;
        tracer.mesh.material.opacity = tracer.startOpacity * (1 - progress);
      }

      if (tracer.elapsed >= tracer.lifetime) {
        this.scene.remove(tracer.mesh);
        tracer.mesh.geometry.dispose();
        tracer.mesh.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Update decals (fade out old ones)
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const decal = this.decals[i];
      decal.elapsed += dt;

      // Start fading in last 5 seconds
      if (decal.elapsed > decal.lifetime - 5) {
        const fadeProgress = (decal.elapsed - (decal.lifetime - 5)) / 5;
        decal.mesh.material.opacity = 0.9 * (1 - fadeProgress);
      }

      if (decal.elapsed >= decal.lifetime) {
        this.scene.remove(decal.mesh);
        decal.mesh.geometry.dispose();
        decal.mesh.material.dispose();
        this.decals.splice(i, 1);
      }
    }

    // Update muzzle flashes
    for (let i = this.muzzleFlashes.length - 1; i >= 0; i--) {
      const flash = this.muzzleFlashes[i];
      flash.elapsed += dt;

      const progress = flash.elapsed / flash.lifetime;

      // Fade out
      flash.group.traverse((child) => {
        if (child.material) {
          child.material.opacity *= (1 - progress);
        }
      });

      // Reduce light intensity
      if (flash.light) {
        flash.light.intensity = 2 * (1 - progress);
      }

      if (flash.elapsed >= flash.lifetime) {
        this.scene.remove(flash.group);
        flash.group.traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        this.muzzleFlashes.splice(i, 1);
      }
    }
  }

  // Clear all effects
  clear() {
    for (const tracer of this.tracers) {
      this.scene.remove(tracer.mesh);
      tracer.mesh.geometry.dispose();
      tracer.mesh.material.dispose();
    }
    this.tracers = [];

    for (const decal of this.decals) {
      this.scene.remove(decal.mesh);
      decal.mesh.geometry.dispose();
      decal.mesh.material.dispose();
    }
    this.decals = [];

    for (const flash of this.muzzleFlashes) {
      this.scene.remove(flash.group);
      flash.group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    this.muzzleFlashes = [];
  }
}
