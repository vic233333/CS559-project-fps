export const MODE_NAMES = {
  PROTOTYPE: "prototype",
  FULL: "full"
};

export const MODE_CONFIGS = {
  [MODE_NAMES.PROTOTYPE]: {
    label: "Prototype",
    skyColor: "#1b1f2a",
    groundColor: "#2a3040",
    useHDR: false,
    ambientIntensity: 0.5,
    directionalIntensity: 1.0,
    fog: { color: "#0e1118", density: 0.015 },
    targetPalette: ["#5de6ff", "#ff9f43", "#f45d79", "#8cff6b"],
    weapon: {
      fireRate: 6,
      spread: 0.01,
      damage: 25,
      muzzleFlash: false,
      recoil: 0.004
    },
    geometryStyle: "primitive", // boxes/spheres
    postprocessing: false
  },
  [MODE_NAMES.FULL]: {
    label: "Full",
    skyColor: "#1a1e2a",
    groundColor: "#2c3140",
    useHDR: false,
    ambientIntensity: 0.6,
    directionalIntensity: 1.2,
    fog: { color: "#0f1219", density: 0.012 },
    targetPalette: ["#00d4ff", "#ff9500", "#ff4d6d", "#7cff6b"],
    weapon: {
      fireRate: 7,
      spread: 0.008,
      damage: 30,
      muzzleFlash: true,
      recoil: 0.005
    },
    geometryStyle: "full", // allows loaded objects and textures
    postprocessing: true,
    // gltfTargets: Array of GLTF model configurations for targets.
    // Each entry should have: { url: string, scale?: number }
    // Example: [{ url: "/models/target.glb", scale: 1.5 }]
    gltfTargets: [] // can be populated with GLTF models if available
  }
};

export function detectModeFromURL() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode');
  if (mode === MODE_NAMES.FULL) return MODE_NAMES.FULL;
  return MODE_NAMES.PROTOTYPE;
}
