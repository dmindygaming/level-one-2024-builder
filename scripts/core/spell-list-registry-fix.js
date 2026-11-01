// v1.22.0: The real fix for spells (like "Toll the Dead") that never show up
// under a class's spell list filter in the Browse Spell Compendium window.
//
// Diagnosed live, directly in a GM's actual running world (not guessed):
// this was never a bug in how this module - or dnd5e's own Compendium
// Browser - *resolves* spell identifiers. dnd5e's own free, bundled spell
// compendium (dnd5e.spells24) only contains SRD-licensed content, and the
// official class spell lists (read by dnd5e.registry.spellLists, built from
// the dnd5e.content24 "Cleric Spell List" etc journal pages) are built
// exclusively from that pack. A retail-only 2024 PHB spell was never going
// to be part of a registered class list, no matter how correctly a filter
// resolves identifiers, because it was never in the source data to begin
// with. Confirmed on this project's own live data: dnd5e.spells24 has 340
// spells and does not include "Toll the Dead" at all, while the GM's own
// D&D Beyond import alone has 575 spells, 252 of which aren't in that free
// pack - this was never a single-spell problem.
//
// dnd5e itself provides the real, public extension point for exactly this
// case: any package can declare `flags.dnd5e.spellLists` in its manifest
// pointing at a "spells"-type JournalEntryPage, and
// dnd5e.registry.spellLists.register() merges ("contributes") that page's
// spells into the SAME SpellList object the official content uses - every
// consumer that reads the registry (this module's own dialog, dnd5e's
// native Compendium Browser, anything else) sees the result, for the rest
// of the session. That mechanism is built for spells known ahead of time in
// a manifest, though, and which spells a given GM actually owns (a D&D
// Beyond import, a marketplace pack, a homebrew compendium) is different in
// every world, so this reconciles it live instead, once per session,
// against whatever that GM's own compendiums actually contain - calling the
// exact same public `SpellList#contribute()` method dnd5e's own spell-list
// pages use, not a private/undocumented API.
//
// The ground truth it reads for "which classes can learn this spell",
// rather than a hand-typed table, is `flags.plutonium.spellClassNames` /
// `flags.plutonium.source`: the tag 5etools-derived importers (the D&D
// Beyond importer among them) already stamp onto every 2024 Player's
// Handbook ("XPHB") spell with the official list of classes that can learn
// it. Confirmed directly against this project's own live data: the GM's own
// copy of "Toll the Dead" carries `flags.plutonium = { source: "XPHB",
// spellClassNames: ["Cleric", "Warlock", "Wizard"] }`. Any spell item
// carrying that flag is trusted for its own class membership; nothing here
// is this module guessing which classes a spell belongs to.
import { MODULE_ID } from "../data/constants.js";

let _ran = false;

/**
 * Scan every Item compendium pack for 2024 ("XPHB") spells carrying
 * plutonium's official class-list tag, and merge any spell missing from a
 * class's dnd5e-registered spell list into that list for real, using the
 * same `SpellList#contribute()` method dnd5e's own spell-list journal pages
 * use. Idempotent and safe to call more than once (only the first call does
 * any work). On a world with no plutonium-tagged spell data this quietly
 * finds nothing to add - it only ever extends a class's existing, official
 * spell list, never invents one.
 */
export async function fixOfficialSpellListGaps() {
  if (_ran) return;
  _ran = true;

  try {
    const registry = globalThis.dnd5e?.registry ?? game.dnd5e?.registry;
    const formatIdentifier = globalThis.dnd5e?.utils?.formatIdentifier;
    if (!registry?.spellLists || !formatIdentifier) return;

    // Only ever extend a class identifier dnd5e already has an official,
    // registered spell list for.
    const knownClassKeys = new Set(
      (registry.spellLists.options ?? [])
        .filter(option => option.type === "class")
        .map(option => option.value.split(":")[1])
        .filter(Boolean)
    );
    if (!knownClassKeys.size) return;

    const addedPerClass = new Map(); // classKey -> Set(identifier) already handled this pass
    let totalAdded = 0;

    for (const pack of game.packs) {
      if (pack.metadata?.type !== "Item") continue;
      let index;
      try {
        index = await pack.getIndex({
          fields: ["name", "type", "system.identifier", "flags.plutonium.spellClassNames", "flags.plutonium.source"]
        });
      } catch (err) {
        continue;
      }

      for (const entry of index) {
        if (entry.type !== "spell") continue;
        if (entry.flags?.plutonium?.source !== "XPHB") continue;
        const classNames = entry.flags?.plutonium?.spellClassNames;
        if (!Array.isArray(classNames) || !classNames.length) continue;
        const identifier = entry.system?.identifier || formatIdentifier(entry.name);
        if (!identifier) continue;

        for (const className of classNames) {
          const classKey = formatIdentifier(className);
          if (!knownClassKeys.has(classKey)) continue; // not a known class list (e.g. a subclass-only grant)

          const list = registry.spellLists.forType("class", classKey);
          if (!list || list.identifiers.has(identifier)) continue;

          let seen = addedPerClass.get(classKey);
          if (!seen) {
            seen = new Set();
            addedPerClass.set(classKey, seen);
          }
          if (seen.has(identifier)) continue;
          seen.add(identifier);

          const uuid = `Compendium.${pack.collection}.${entry._id}`;
          list.contribute({
            uuid: `${MODULE_ID}.synthetic.${classKey}.${identifier}`,
            system: { spells: [uuid], unlinkedSpells: [] }
          });
          totalAdded++;
        }
      }
    }

    if (totalAdded) {
      console.log(
        `${MODULE_ID} | Registered ${totalAdded} spell(s) into their official 2024 class spell list(s) that ` +
        `dnd5e's own free compendium doesn't include, using the class tags already present on your own spell ` +
        `items.`,
        Object.fromEntries([...addedPerClass].map(([key, set]) => [key, set.size]))
      );
    }
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not reconcile class spell lists against owned spell data`, err);
  }
}
