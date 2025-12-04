import { createPrototypeProfile } from "./ProfilePrototype.js";
import { createFullProfile } from "./ProfileFull.js";
import { MODE_NAMES } from "../config/ModeConfig.js";

// Creates the appropriate rendering profile for the given mode.
// assetManager is only passed to Full mode as it may need to load GLTF models and HDR maps.
// Prototype mode uses only primitive geometries and doesn't require asset loading.
export function createProfileForMode(assetManager, mode = MODE_NAMES.PROTOTYPE) {
  if (mode === MODE_NAMES.FULL) {
    return createFullProfile(assetManager);
  }
  return createPrototypeProfile();
}
