// ============================================================
// Small, dependency-free helper functions shared across the module.
// ============================================================

/** Lowercase, hyphenated slug used for name-matching (e.g. "Rage" -> "rage"). */
export function slug(name) {
  return String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function safeParseJson(raw, fallback) {
  try {
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (_err) {
    return fallback;
  }
}

export function scoreCounts(scores) {
  const counts = {};
  for (const score of scores.map(Number)) counts[score] = (counts[score] ?? 0) + 1;
  return counts;
}

export function numericAssignedScores(values) {
  return values
    .filter(v => v !== "" && v !== null && v !== undefined)
    .map(Number)
    .filter(Number.isFinite);
}

export function arraysHaveSameScoreMultiset(a, b) {
  const ac = scoreCounts(a);
  const bc = scoreCounts(b);
  const keys = new Set([...Object.keys(ac), ...Object.keys(bc)]);
  for (const key of keys) if ((ac[key] ?? 0) !== (bc[key] ?? 0)) return false;
  return true;
}

export function gmWhisperIds() {
  const ids = game.users.filter(u => u.isGM).map(u => u.id);
  return ids.length ? ids : [game.user.id];
}

export function titleCase(value) {
  return String(value ?? "").replace(/\b\w/g, c => c.toUpperCase());
}
