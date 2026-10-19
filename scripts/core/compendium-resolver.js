// ============================================================
// Deterministic compendium resolution.
//
// This replaces the old behaviour of scanning every installed Item
// compendium and guessing the right document from text heuristics. That
// approach ignored the GM's Sourcebook Picker settings entirely and could
// silently attach the wrong item when two compendiums had same-named
// content (the classic case: Barbarian and Monk both have "Unarmored
// Defense", and depending on pack load order the builder could grab either).
//
// The rules here are intentionally simple and auditable:
//   1. A GM-pinned override (see overrides.js) always wins.
//   2. Otherwise, only packs the GM has configured for that content
//      category (see source-types.js) are searched at all.
//   3. Among matches in those packs, class/species-specific metadata
//      (system.type.subtype, identifier, requirements) is scored first,
//      then official-sourcebook priority, then a fully deterministic
//      alphabetical pack-id tiebreak so results never depend on pack
//      scan/load order.
// ============================================================

import { automaticPackIds, packIdsForSourceType } from "./source-types.js";
import { getOverride } from "./overrides.js";
import { slug } from "./util.js";

const EXCLUDED_HINTS = ["cauldron", "plentiful resources", "gambit", "premade", "automation", "rider", "midi", "dae"];

function packHaystack(packId) {
  const pack = packId ? game.packs.get(packId) : null;
  const metadata = pack?.metadata ?? {};
  return [pack?.collection, metadata.label, metadata.packageName, metadata.system, metadata.id]
    .filter(Boolean).join(" ").toLowerCase();
}

/** Higher = more authoritative / official source. Used only as a tiebreaker among in-scope candidates. */
export function officialSourcePriority(item) {
  const h = [packHaystack(item?.pack), item?.system?.source?.book, item?.system?.source?.custom, item?.pack]
    .filter(Boolean).join(" ").toLowerCase();
  if (EXCLUDED_HINTS.some(hint => h.includes(hint))) return -1000;
  if (h.includes("phb 2024") || h.includes("phb'24") || h.includes("dnd-players-handbook") || h.includes("player's handbook") || h.includes("players handbook")) return 100;
  if (h.includes("character origins")) return 95;
  if (h.includes("free rules") || h.includes("free-rules") || h.includes("srd 5.2")) return 90;
  if (h.includes("srd 5.1") || h.includes("srd")) return 40;
  if (String(item?.pack ?? "").startsWith("dnd5e.")) return 75;
  return 50;
}

/**
 * Scores how well an item's own metadata (subtype/identifier/requirements)
 * matches the class or species we're importing for, and penalizes it if the
 * metadata instead points to one of the other known classes/species. This is
 * what tells Barbarian Unarmored Defense apart from Monk Unarmored Defense
 * when both live in an in-scope compendium.
 */
export function contextMatchScore(item, { key = null, otherKeys = [] } = {}) {
  if (!key) return 0;
  const keySlug = slug(key);
  const system = item?.system ?? {};
  const type = system.type ?? {};
  const haystack = [system.requirements, system.identifier, type.value, type.subtype, system.source?.book, system.source?.custom, item?.name, item?.pack]
    .filter(Boolean).join(" ").toLowerCase();

  let score = 0;
  if (slug(type.subtype) === keySlug) score += 10000;
  if (slug(system.identifier).includes(keySlug)) score += 8000;
  if (new RegExp(`(^|[^a-z0-9])${keySlug}([^a-z0-9]|$)`, "i").test(haystack)) score += 6000;

  for (const other of otherKeys) {
    if (!other || slug(other) === keySlug) continue;
    const otherSlug = slug(other);
    if (slug(type.subtype) === otherSlug) score -= 10000;
    else if (new RegExp(`(^|[^a-z0-9])${otherSlug}([^a-z0-9]|$)`, "i").test(haystack)) score -= 4000;
  }
  return score;
}

function compareCandidates(a, b, ctx) {
  const matchDiff = contextMatchScore(a, ctx) - contextMatchScore(b, ctx);
  if (matchDiff !== 0) return matchDiff;
  const priorityDiff = officialSourcePriority(a) - officialSourcePriority(b);
  if (priorityDiff !== 0) return priorityDiff;
  // Deterministic final tiebreak, independent of pack scan/load order.
  if (a.pack === b.pack) return 0;
  return a.pack < b.pack ? 1 : -1;
}

/**
 * Scans only the GM-configured packs for `sourceType`, applying an optional
 * predicate/index-field list. Returns lightweight index-shaped candidates.
 *
 * Safety net: if the configured packs produce zero matches at all, this
 * category's Sourcebook Picker setting is very likely stale - some
 * categories (Class Features / Invocations, most notably) were silently
 * ignored by earlier versions of this module, so their setting may point at
 * packs that don't actually contain this content and was never validated.
 * In that case, fall back to the automatically-detected dnd5e packs and log
 * a console warning so the GM can find and fix the setting, rather than
 * silently importing nothing.
 */
export async function scanConfiguredPacks(sourceType, { itemTypes = null, indexFields = null, predicate = null, fetchFullDocIf = null, fallbackSourceTypes = [] } = {}) {
  const opts = { itemTypes, indexFields, predicate, fetchFullDocIf, sourceType };
  const packIds = packIdsForSourceType(sourceType);
  const checked = new Set(packIds);
  let results = await scanPackIds(packIds, opts);

  if (!results.length) {
    const autoIds = automaticPackIds().filter(id => !checked.has(id));
    if (autoIds.length) {
      const fallback = await scanPackIds(autoIds, opts);
      autoIds.forEach(id => checked.add(id));
      if (fallback.length) {
        console.warn(`level-one-2024-builder | No matches found in the "${sourceType}" packs configured in Settings > Level One 2024 Builder. Falling back to automatically-detected dnd5e packs this time - open the "${sourceType}" Sourcebook Picker to fix this permanently.`);
        results = fallback;
      }
    }
  }

  // Second-tier fallback for categories that may not yet be configured at
  // all (e.g. Species Features is new) or whose automatic detection is too
  // narrow for a particular install: also try packs already configured for
  // related categories, since those are proven to work in this world.
  if (!results.length && fallbackSourceTypes.length) {
    const extraIds = [...new Set(fallbackSourceTypes.flatMap(key => packIdsForSourceType(key)))].filter(id => !checked.has(id));
    if (extraIds.length) {
      const fallback = await scanPackIds(extraIds, opts);
      if (fallback.length) {
        console.warn(`level-one-2024-builder | No matches found for "${sourceType}" in configured or automatically-detected packs. Falling back to packs configured for [${fallbackSourceTypes.join(", ")}] - open the "${sourceType}" Sourcebook Picker to fix this permanently.`);
        results = fallback;
      }
    }
  }

  return results;
}

async function scanPackIds(packIds, { itemTypes = null, indexFields = null, predicate = null, fetchFullDocIf = null, sourceType = "" } = {}) {
  const fields = indexFields ?? ["type", "system.source", "system.identifier", "system.type", "system.requirements"];
  const results = [];
  for (const packId of packIds) {
    const pack = game.packs.get(packId);
    if (!pack || pack.metadata?.type !== "Item") continue;
    try {
      const index = await pack.getIndex({ fields });
      for (const entry of index) {
        if (itemTypes && !itemTypes.includes(entry.type)) continue;
        let candidate = { uuid: `Compendium.${pack.collection}.${entry._id}`, name: entry.name, pack: pack.collection, system: entry.system ?? {}, type: entry.type };
        if (predicate && !predicate(candidate)) continue;
        if (fetchFullDocIf && fetchFullDocIf(candidate)) {
          const doc = await pack.getDocument(entry._id).catch(() => null);
          if (doc) candidate = doc;
        }
        results.push(candidate);
      }
    } catch (err) {
      console.warn(`level-one-2024-builder | Could not scan ${pack.collection} for ${sourceType}`, err);
    }
  }
  return results;
}

/**
 * Resolves a set of feature names (class features, species features, etc.)
 * against ONLY the packs configured for `sourceType`. GM overrides are
 * honored first. Returns a Map of slug -> best candidate.
 */
export async function resolveFeaturesByName({ names, sourceType, contextKey = null, matchKey = null, otherKeys = [], itemTypes = ["feat"], fallbackSourceTypes = [] }) {
  const wanted = new Map(names.map(name => [slug(name), name]));
  const found = new Map();

  if (contextKey) {
    for (const [slugName, name] of [...wanted]) {
      const uuid = getOverride(contextKey, name);
      if (uuid) {
        const pack = uuid.startsWith("Compendium.") ? uuid.split(".").slice(1, -1).join(".") : "";
        found.set(slugName, { uuid, name, pack, overridden: true });
        wanted.delete(slugName);
      }
    }
  }
  if (!wanted.size) return [...found.values()];

  const candidates = await scanConfiguredPacks(sourceType, {
    itemTypes,
    fallbackSourceTypes,
    predicate: candidate => wanted.has(slug(candidate.name))
  });

  const ctx = { key: matchKey, otherKeys };
  for (const candidate of candidates) {
    const entrySlug = slug(candidate.name);
    const current = found.get(entrySlug);
    if (!current || compareCandidates(candidate, current, ctx) > 0) found.set(entrySlug, candidate);
  }
  return [...found.values()];
}

/**
 * Resolves a single named item (e.g. an Origin feat) against only the packs
 * configured for `sourceType`. `matchNames` may include aliases so a single
 * logical feat (e.g. a generic "Magic Initiate") can match several possible
 * compendium entry names.
 */
export async function resolveSingleItemByName({ matchNames, sourceType, contextKey = null, name = null, itemTypes = ["feat"], extraMatch = null }) {
  const lookupName = name ?? matchNames?.[0];
  if (contextKey && lookupName) {
    const uuid = getOverride(contextKey, lookupName);
    if (uuid) return { uuid, name: lookupName, pack: uuid.startsWith("Compendium.") ? uuid.split(".").slice(1, -1).join(".") : "", overridden: true };
  }

  const wantedSlugs = new Set((matchNames ?? []).map(slug));
  const candidates = await scanConfiguredPacks(sourceType, {
    itemTypes,
    indexFields: ["type", "system.source", "system.identifier", "system.type", "system.category", "system.requirements", "system.description.value"],
    predicate: candidate => {
      const nameSlug = slug(candidate.name);
      const identifierSlug = slug(candidate.system?.identifier);
      if (wantedSlugs.has(nameSlug) || wantedSlugs.has(identifierSlug)) return true;
      return extraMatch ? extraMatch(candidate) : false;
    }
  });

  let best = null;
  for (const candidate of candidates) {
    if (!best || compareCandidates(candidate, best, {}) > 0) best = candidate;
  }
  return best;
}

/**
 * Resolves Eldritch Invocation-like options from only the packs configured
 * for `sourceType` (defaults to "classFeatures"). Ambiguous index entries
 * (missing subtype metadata) are upgraded to a full document fetch so the
 * real dnd5e fields can be checked, same as before - just scoped now.
 */
export async function resolveInvocationOptions({ sourceType = "classFeatures", cachedItems = [] } = {}) {
  const byName = new Map();
  const isInvocationCandidate = candidate => {
    const indexText = [candidate.name, candidate.type, candidate.system?.identifier, candidate.system?.type?.subtype, candidate.system?.category, candidate.system?.requirements, candidate.system?.description?.value]
      .filter(Boolean).join(" ").toLowerCase();
    return (candidate.type === "feat" || candidate.type === "feature" || indexText.includes("invocation"));
  };

  for (const item of cachedItems) {
    if (!isInvocationCandidate(item)) continue;
    const key = slug(item.name);
    const current = byName.get(key);
    if (!current || officialSourcePriority(item) > officialSourcePriority(current)) byName.set(key, item);
  }

  const scanned = await scanConfiguredPacks(sourceType, {
    itemTypes: null,
    indexFields: ["type", "system.source", "system.identifier", "system.type", "system.category", "system.requirements", "system.description.value"],
    predicate: isInvocationCandidate,
    fetchFullDocIf: candidate => {
      const indexText = [candidate.name, candidate.system?.type?.subtype, candidate.system?.category].filter(Boolean).join(" ").toLowerCase();
      return indexText.includes("invocation") || String(candidate.name ?? "").toLowerCase().includes("pact of");
    }
  });

  for (const item of scanned) {
    const key = slug(item.name);
    const current = byName.get(key);
    if (!current || officialSourcePriority(item) > officialSourcePriority(current)) byName.set(key, item);
  }

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}
