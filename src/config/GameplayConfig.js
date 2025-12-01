export const GAMEPLAY_CONFIG = {
  sessionLength: 60, // seconds
  player: {
    moveSpeed: 8,
    sprintMultiplier: 1.6,
    jumpStrength: 8,
    gravity: 18,
    coyoteTime: 0.1,
    jumpBufferTime: 0.1,
    health: 100
  },
  waves: [
    { id: 1, duration: 12, targets: 6, speed: 1.0, movingRatio: 0.2 },
    { id: 2, duration: 12, targets: 8, speed: 1.2, movingRatio: 0.4 },
    { id: 3, duration: 14, targets: 10, speed: 1.4, movingRatio: 0.5 },
    { id: 4, duration: 14, targets: 12, speed: 1.6, movingRatio: 0.6 },
    { id: 5, duration: 16, targets: 14, speed: 1.8, movingRatio: 0.7 }
  ],
  target: {
    baseHealth: 30,
    radius: 0.6,
    moveRadius: 6,
    respawnDelay: 2.5
  }
};
