import { MODE_NAMES } from "../config/ModeConfig.js";
import { createPrototypeProfile } from "./ProfilePrototype.js";
import { createFullProfile } from "./ProfileFull.js";

export function createProfileForMode(mode, assetManager) {
  if (mode === MODE_NAMES.FULL) return createFullProfile(assetManager);
  return createPrototypeProfile();
}
