import { MODULE_ID } from "../data/constants.js";
import { safeParseJson } from "./util.js";

// Every category a GM can independently point at specific compendiums via the
// Sourcebook Picker settings menus. "classFeatures" covers class features and
// Eldritch Invocations; "speciesFeatures" covers the individual feat items a
// species grants (Darkvision, Rage, etc. are all imported as "feat" items).
export const SOURCE_TYPE_SETTINGS = {
  species: { label: "Species", types: ["race", "species"] },
  speciesFeatures: { label: "Species Features", types: ["feat"] },
  backgrounds: { label: "Backgrounds", types: ["background"] },
  classes: { label: "Classes", types: ["class"] },
  classFeatures: { label: "Class Features / Invocations", types: ["feat"] },
  feats: { label: "Feats", types: ["feat"] },
  spells: { label: "Spells", types: ["spell"] },
  equipment: { label: "Equipment / Tools", types: ["weapon", "equipment", "consumable", "tool"] }
};

export const SOURCE_TYPE_ORDER = ["species", "speciesFeatures", "backgrounds", "classes", "classFeatures", "feats", "spells", "equipment"];

export function defaultSourceTypeSelections() {
  return Object.fromEntries(SOURCE_TYPE_ORDER.map(key => [key, "__auto__"]));
}

export function parseSourceTypePackSetting(raw) {
  const defaults = defaultSourceTypeSelections();
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return defaults;
    for (const key of SOURCE_TYPE_ORDER) {
      const value = parsed[key];
      if (value === "__auto__") defaults[key] = "__auto__";
      else if (Array.isArray(value)) defaults[key] = value.filter(Boolean);
      else if (typeof value === "string" && value.trim()) defaults[key] = parseSelectedPackSetting(value);
    }
    return defaults;
  } catch (_err) {
    return defaults;
  }
}

export function sourceTypeSelectionMode(value) {
  return value === "__auto__" || value == null ? "auto" : "manual";
}

export function discoverDnd5eItemPacks() {
  return game.packs
    .filter(pack => pack.metadata?.type === "Item")
    .filter(pack => {
      const metadata = pack.metadata ?? {};
      const haystack = [
        pack.collection,
        metadata.id,
        metadata.label,
        metadata.packageName,
        metadata.system
      ].filter(Boolean).join(" ").toLowerCase();
      return metadata.system === "dnd5e"
        || metadata.packageName === "dnd5e"
        || pack.collection.startsWith("dnd5e.")
        || haystack.includes("dnd5e")
        || haystack.includes("dnd-players-handbook")
        || haystack.includes("players handbook")
        || haystack.includes("player's handbook")
        || haystack.includes("dungeon masters guide")
        || haystack.includes("monster manual")
        || haystack.includes("forgotten realms")
        || haystack.includes("eberron")
        || haystack.includes("tasha")
        || haystack.includes("xanathar")
        || haystack.includes("mordenkainen")
        || haystack.includes("fizban")
        || haystack.includes("bigby");
    })
    .sort((a, b) => (a.metadata.label ?? a.collection).localeCompare(b.metadata.label ?? b.collection));
}

export function sourcebookNote(pack) {
  const metadata = pack.metadata ?? {};
  const haystack = [pack.collection, metadata.label, metadata.packageName].filter(Boolean).join(" ").toLowerCase();
  if (haystack.includes("players handbook") || haystack.includes("player's handbook") || haystack.includes("dnd-players-handbook")) return "PHB / likely 2024 source";
  if (haystack.includes("free-rules") || haystack.includes("free rules")) return "Free Rules / core source";
  if (metadata.system === "dnd5e") return "dnd5e source";
  if (pack.collection.startsWith("dnd5e.")) return "dnd5e system pack";
  return "detected sourcebook pack";
}

export function isLikelyDnd5eCharacterSource(pack) {
  const metadata = pack.metadata ?? {};
  const haystack = [pack.collection, metadata.id, metadata.label, metadata.packageName, metadata.system]
    .filter(Boolean).join(" ").toLowerCase();
  if (haystack.includes("cauldron")
    || haystack.includes("plentiful resources")
    || haystack.includes("gambit")
    || haystack.includes("premade")
    || haystack.includes("midi")
    || haystack.includes("dae")
    || haystack.includes("automation")) return false;
  return metadata.system === "dnd5e"
    || metadata.packageName === "dnd5e"
    || pack.collection.startsWith("dnd5e.")
    || haystack.includes("players handbook")
    || haystack.includes("player's handbook")
    || haystack.includes("dnd-players-handbook")
    || haystack.includes("free rules")
    || haystack.includes("free-rules")
    || haystack.includes("tasha")
    || haystack.includes("xanathar")
    || haystack.includes("eberron")
    || haystack.includes("forgotten realms")
    || haystack.includes("bigby")
    || haystack.includes("fizban")
    || haystack.includes("mordenkainen");
}

export function automaticPackIds(packs = discoverDnd5eItemPacks()) {
  const recommended = packs.filter(isLikelyDnd5eCharacterSource).map(pack => pack.collection);
  return recommended.length ? recommended : packs.map(pack => pack.collection);
}

export function parseSelectedPackSetting(raw) {
  if (!raw || raw === "__auto__") return automaticPackIds();
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (_err) {
    return String(raw).split(",").map(s => s.trim()).filter(Boolean);
  }
}

/**
 * The authoritative, GM-configured list of compendium pack IDs for a content
 * category. This is the ONLY function that should decide which packs are
 * eligible sources for a given category - lookups must never fall back to
 * scanning every installed Item pack, or the GM's Sourcebook Picker settings
 * become meaningless.
 */
export function packIdsForSourceType(key, sourceSelections = null) {
  const legacyRaw = game.settings.get(MODULE_ID, "allowedItemPacks")?.trim();
  if (legacyRaw) return parseSelectedPackSetting(legacyRaw);

  const selections = sourceSelections ?? parseSourceTypePackSetting(game.settings.get(MODULE_ID, "selectedPacksByContentType") || "");
  const configured = selections[key];
  if (Array.isArray(configured)) return configured.length ? configured : automaticPackIds();
  if (configured === "__auto__" || configured == null) {
    const oldSelectedRaw = game.settings.get(MODULE_ID, "selectedItemPacks") ?? "__auto__";
    if (oldSelectedRaw && oldSelectedRaw !== "__auto__") {
      const oldSelected = parseSelectedPackSetting(oldSelectedRaw);
      if (oldSelected.length) return oldSelected;
    }
    return automaticPackIds();
  }
  return automaticPackIds();
}
