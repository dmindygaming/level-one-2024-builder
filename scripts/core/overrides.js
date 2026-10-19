import { MODULE_ID } from "../data/constants.js";
import { safeParseJson, slug } from "./util.js";

const SETTING_KEY = "featureOverrides";

function overrideKey(contextKey, name) {
  return `${contextKey}::${slug(name)}`;
}

export function getAllOverrides() {
  const raw = game.settings?.get(MODULE_ID, SETTING_KEY) ?? "{}";
  const parsed = safeParseJson(raw, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

/** Returns a pinned Compendium UUID for (contextKey, name), or null if unset. */
export function getOverride(contextKey, name) {
  const all = getAllOverrides();
  return all[overrideKey(contextKey, name)] ?? null;
}

export async function setOverride(contextKey, name, uuid) {
  const all = getAllOverrides();
  const key = overrideKey(contextKey, name);
  if (uuid) all[key] = uuid;
  else delete all[key];
  await game.settings.set(MODULE_ID, SETTING_KEY, JSON.stringify(all));
  return all;
}

export async function clearOverride(contextKey, name) {
  return setOverride(contextKey, name, null);
}

/** Human-readable context keys used across the resolver. Keep these stable - they're persisted in world settings. */
export const OVERRIDE_CONTEXT = {
  classFeature: classKey => `class:${classKey}`,
  speciesFeature: speciesKey => `species:${speciesKey}`,
  invocation: () => "invocation",
  originFeat: () => "origin-feat"
};
