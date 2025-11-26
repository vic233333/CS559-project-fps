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
    skyColor: "#0a0c12",
    groundColor: "#121825",
    useHDR: true,
    hdrUrl: "/assets/hdr/studio_small_03_1k.hdr",
    ambientIntensity: 0.7,
    directionalIntensity: 1.5,
    fog: { color: "#0a0c12", density: 0.01 },
    targetPalette: ["#6dd3ff", "#ffc857", "#ff6f61", "#c792ea"],
    weapon: {
      fireRate: 8,
      spread: 0.006,
      damage: 30,
      muzzleFlash: true,
      recoil: 0.006
    },
    geometryStyle: "hybrid", // mix glTF + primitives
    postprocessing: true,
    gltfTargets: [
      { url: "/assets/models/target_drone.glb", scale: 1.1 },
      { url: "/assets/models/target_sphere.glb", scale: 0.9 }
    ],
    environmentFX: {
      enableBloom: true,
      enableChromaticAberration: false
    }
    // TODO: Add post-processing pipeline to actually use environmentFX flags (bloom, CA, etc.).
  }
};

export function detectModeFromURL() {
  const params = new URLSearchParams(window.location.search);
  const param = params.get("mode");
  if (param && MODE_CONFIGS[param]) return param;
  return MODE_NAMES.PROTOTYPE;
}
