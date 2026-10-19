export function isStandaloneLineageOption(docOrEntry) {
  const name = String(docOrEntry?.name ?? "").toLowerCase();
  const source = String(docOrEntry?.system?.source?.book ?? docOrEntry?.system?.source?.custom ?? docOrEntry?.pack ?? "").toLowerCase();
  const identifier = String(docOrEntry?.system?.identifier ?? docOrEntry?.system?.slug ?? "").toLowerCase();
  const haystack = `${name} ${source} ${identifier}`;

  // 2024 species entries that must be selected through their parent species item,
  // not as standalone species documents. This catches entries like Dragonborn (Copper),
  // Dragonborn (Dragonblood; Red), Elf (Drow), Tiefling (Chthonic), etc.
  if (/\([^)]*\)/.test(name)) return true;
  if (name.includes(";")) return true;
  if (haystack.includes("lineage")) return true;

  const standalonePrefixes = [
    "dragonborn-", "dragonblood-", "gem-", "metallic-", "chromatic-",
    "elf-", "drow-", "eladrin-", "shadar-kai-",
    "gnome-", "deep-gnome-", "svirfneblin-",
    "aasimar-", "tiefling-", "goliath-"
  ];
  return standalonePrefixes.some(prefix => identifier.startsWith(prefix));
}

export function mainSpeciesKey(item) {
  const name = String(item?.name ?? "").trim();
  return name.toLowerCase().replace(/\s*\([^)]*\)/g, "").replace(/\s*;.*/g, "").replace(/\s+/g, " ");
}

export function sourcePriorityLabel(item) {
  const pack = item.pack ? game.packs.get(item.pack) : null;
  return [pack?.metadata?.label, pack?.metadata?.packageName, item?.system?.source?.book, item?.system?.source?.custom, item?.pack]
    .filter(Boolean).join(" ").toLowerCase();
}

export function speciesSourceScore(item) {
  const h = sourcePriorityLabel(item);
  if (h.includes("phb 2024") || h.includes("phb'24") || h.includes("player") || h.includes("dnd-players-handbook")) return 100;
  if (h.includes("character origins")) return 95;
  if (h.includes("srd 5.2") || h.includes("free rules")) return 90;
  if (h.includes("srd 5.1")) return 40;
  if (h.includes("cauldron") || h.includes("gambit") || h.includes("premade") || h.includes("automation")) return -100;
  return 50;
}

export function detectSpeciesChoiceGroupKey(itemOrName) {
  const name = String(itemOrName?.name ?? itemOrName ?? "").toLowerCase();
  const identifier = String(itemOrName?.system?.identifier ?? itemOrName?.system?.slug ?? "").toLowerCase();
  const source = String(itemOrName?.system?.source?.book ?? itemOrName?.system?.source?.custom ?? itemOrName?.pack ?? "").toLowerCase();
  const haystack = `${name} ${identifier} ${source}`;

  // Only these 2024 species have a required level-1 species option that this
  // builder must handle after suppressing built-in species advancement prompts.
  if (/\bdragonborn\b/.test(haystack)) return "dragonborn";
  if (/\btiefling\b/.test(haystack)) return "tiefling";
  if (/\bgnome\b/.test(haystack)) return "gnome";
  if (/\bgoliath\b/.test(haystack)) return "goliath";

  // Match Elf but avoid false positives from unrelated words where possible.
  if (/\belf\b/.test(haystack) || /\belven\b/.test(haystack)) return "elf";

  return "";
}
