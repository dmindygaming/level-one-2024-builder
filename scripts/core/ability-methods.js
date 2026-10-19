import { MODULE_ID, BUILTIN_ABILITY_METHODS, POINT_BUY_COSTS } from "../data/constants.js";
import { safeParseJson } from "./util.js";

export function defaultBuiltinAbilityMethodIds() {
  return Object.keys(BUILTIN_ABILITY_METHODS);
}

export function sanitizeAbilityMethodId(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function normalizeCustomAbilityMethod(method, index = 0) {
  if (!method || typeof method !== "object") return null;
  const type = String(method.type ?? "").toLowerCase();
  const label = String(method.label ?? method.name ?? "").trim();
  const id = sanitizeAbilityMethodId(method.id || label || `custom-${index + 1}`);
  if (!id || !label) return null;

  if (type === "array") {
    const scores = Array.isArray(method.scores) ? method.scores.map(Number) : [];
    if (scores.length !== 6 || scores.some(s => !Number.isInteger(s) || s < 3 || s > 18)) return null;
    return { id, label, type: "array", scores, custom: true };
  }

  if (type === "roll") {
    const formula = String(method.formula ?? "").trim();
    if (!formula) return null;
    return { id, label, type: "roll", formula, custom: true };
  }

  if (type === "pointbuy") {
    const points = Number(method.points ?? 27);
    const min = Number(method.min ?? 8);
    const max = Number(method.max ?? 15);
    const costs = method.costs && typeof method.costs === "object" ? method.costs : POINT_BUY_COSTS;
    if (!Number.isInteger(points) || !Number.isInteger(min) || !Number.isInteger(max) || min >= max) return null;
    return { id, label, type: "pointbuy", points, min, max, costs: foundry.utils.deepClone(costs), custom: true };
  }

  return null;
}

export function getEnabledBuiltinAbilityMethodIds() {
  const raw = game.settings?.get(MODULE_ID, "enabledBuiltinAbilityMethods");
  const parsed = safeParseJson(raw, defaultBuiltinAbilityMethodIds());
  const valid = Array.isArray(parsed) ? parsed.filter(id => BUILTIN_ABILITY_METHODS[id]) : defaultBuiltinAbilityMethodIds();
  return valid.length ? valid : defaultBuiltinAbilityMethodIds();
}

export function getCustomAbilityMethods() {
  const raw = game.settings?.get(MODULE_ID, "customAbilityMethods") ?? "[]";
  const parsed = safeParseJson(raw, []);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(normalizeCustomAbilityMethod).filter(Boolean);
}

export function getEnabledCustomAbilityMethodIds(customMethods = getCustomAbilityMethods()) {
  const allIds = customMethods.map(method => method.id);
  const raw = game.settings?.get(MODULE_ID, "enabledCustomAbilityMethods") ?? "__all__";
  if (raw === "__all__") return allIds;
  const parsed = safeParseJson(raw, allIds);
  if (!Array.isArray(parsed)) return allIds;
  return parsed.filter(id => allIds.includes(id));
}

export function getAbilityMethods() {
  const methods = [];
  const seen = new Set();

  for (const id of getEnabledBuiltinAbilityMethodIds()) {
    const method = foundry.utils.deepClone(BUILTIN_ABILITY_METHODS[id]);
    if (method && !seen.has(method.id)) {
      methods.push(method);
      seen.add(method.id);
    }
  }

  const customMethods = getCustomAbilityMethods();
  const enabledCustom = new Set(getEnabledCustomAbilityMethodIds(customMethods));
  for (const method of customMethods) {
    if (enabledCustom.has(method.id) && !seen.has(method.id)) {
      methods.push(method);
      seen.add(method.id);
    }
  }

  return methods.length ? methods : [foundry.utils.deepClone(BUILTIN_ABILITY_METHODS.standard)];
}

export function getAbilityMethod(id) {
  return getAbilityMethods().find(m => m.id === id) ?? getAbilityMethods()[0];
}
