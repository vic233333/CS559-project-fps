export const GAMEPLAY_CONFIG = {
  sessionLength: 60, // seconds
  player: {
    moveSpeed: 7.5, // base walk speed (m/s)
    sprintMultiplier: 1.4,
    crouchSpeedMultiplier: 0.65, // crouch movement speed is 65% of normal
    crouchHeightOffset: 0.5, // percentage of player height when crouching
    maxSpeed: 10, // horizontal clamp
    groundAccel: 30, // acceleration toward desired speed on ground
    airAccel: 1.5, // weaker acceleration in air to avoid mid-air boosts
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

// Default UI settings
export const UI_DEFAULTS = {
  sensitivity: 0.0025,
  gameMode: "wave", // "wave" or "continuous"
  sessionDuration: GAMEPLAY_CONFIG.sessionLength,
  waveCount: GAMEPLAY_CONFIG.waves.length,
  continuousTargets: 5,
  continuousDuration: GAMEPLAY_CONFIG.sessionLength,
  // Default settings for creating new waves dynamically
  // Use the first wave as the base template
  baseWave: {
    duration: GAMEPLAY_CONFIG.waves[0].duration,
    targets: GAMEPLAY_CONFIG.waves[0].targets,
    speed: GAMEPLAY_CONFIG.waves[0].speed,
    movingRatio: GAMEPLAY_CONFIG.waves[0].movingRatio
  }
};
