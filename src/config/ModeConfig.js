export const MODE_NAMES = {
  PROTOTYPE: "prototype"
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
  }
};

export function detectModeFromURL() {
  return MODE_NAMES.PROTOTYPE;
}
