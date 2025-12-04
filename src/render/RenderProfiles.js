import { createPrototypeProfile } from "./ProfilePrototype.js";
import { createFullProfile } from "./ProfileFull.js";
import { MODE_NAMES } from "../config/ModeConfig.js";

export function createProfileForMode(assetManager, mode = MODE_NAMES.PROTOTYPE) {
  if (mode === MODE_NAMES.FULL) {
    return createFullProfile(assetManager);
  }
  return createPrototypeProfile();
}
