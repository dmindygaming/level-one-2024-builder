import { FALLBACK_LANGUAGE_LABELS } from "../data/constants.js";

// dnd5e's own language config only ever groups real player languages under
// these two top-level categories ("Standard Languages" / "Rare Languages" in
// both the 2014 and 2024 rules). Import/conversion modules - D&D Beyond
// Importer is the known offender, adding a "ddb" category it labels "D&D
// Beyond Rare Languages" - attach ADDITIONAL top-level categories to
// CONFIG.DND5E.languages that are not player languages at all: DDB's alone
// contributes 135 entries, almost all of them monster/creature communication
// abilities (e.g. "Giant Eagle", "Winter Wolf", "Blink Dog" - things a
// monster can "speak" to its own kind, not something a player character
// picks from Standard/Rare Languages). Only descending into the categories
// dnd5e itself defines keeps those out of the builder's Languages step
// without needing to know every noisy category name every import module
// might add.
const KNOWN_LANGUAGE_CATEGORY_KEYS = new Set(["standard", "exotic"]);

export function flattenDnd5eLanguageConfig(source, out = [], { topLevel = true } = {}) {
  if (!source || typeof source !== "object") return out;

  for (const [key, value] of Object.entries(source)) {
    if (!value) continue;

    // At the top level, only descend into dnd5e's own known categories.
    // Anything else - however it's labeled - is a third-party addition and
    // is skipped entirely rather than assumed to contain real languages.
    if (topLevel && typeof value === "object" && !KNOWN_LANGUAGE_CATEGORY_KEYS.has(String(key).toLowerCase())) continue;

    if (typeof value === "string") {
      out.push({ key, label: game.i18n?.localize?.(value) ?? value });
      continue;
    }

    if (typeof value === "object") {
      const hasNestedLanguages = value.children || value.options;

      // Category headers (e.g. "Standard Languages") are not themselves a
      // selectable language - recurse into their children/options instead.
      if (!hasNestedLanguages && typeof value.label === "string") {
        out.push({ key, label: game.i18n?.localize?.(value.label) ?? value.label });
      }

      if (value.children) flattenDnd5eLanguageConfig(value.children, out, { topLevel: false });
      if (value.options) flattenDnd5eLanguageConfig(value.options, out, { topLevel: false });
    }
  }

  return out;
}

export function languageChoices() {
  const configured = flattenDnd5eLanguageConfig(CONFIG?.DND5E?.languages ?? {});
  const base = configured.length ? configured : Object.entries(FALLBACK_LANGUAGE_LABELS).map(([key, label]) => ({ key, label }));
  const seen = new Set();
  return base
    .map(entry => ({ key: String(entry.key), label: String(entry.label ?? entry.key) }))
    .filter(entry => {
      const slug = String(entry.key).toLowerCase();
      if (!entry.key || seen.has(entry.key) || slug === "common") return false;
      seen.add(entry.key);
      return true;
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}
