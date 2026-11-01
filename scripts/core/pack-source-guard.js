// ============================================================
// Keeps automation/effects-only packs (e.g. "CPR"/Cauldron of Plentiful
// Resources, "GPS"/Gambit's Premades-style spell riders) out of dnd5e's own
// native "Browse Spell/Species/Background/Class Compendium" window.
//
// That window (dnd5e.applications.CompendiumBrowser, added to this module's
// own flows in v1.10.11) does NOT use this module's internal pack-scoring
// heuristics (officialSourcePriority/_isLikelyAutomationSpell/etc. in
// compendium-resolver.js and builder-app.js) at all. It only ever looks at
// dnd5e's own world-scope setting "packSourceConfiguration" - a pack shows up
// in the Compendium Browser unless that setting has an explicit `false`
// entry for the pack's collection id (see
// CompendiumBrowserSettingsConfig.collateSources() in dnd5e's own source).
//
// So detecting "this looks like an automation pack, not real spell content"
// is only half the job; to actually keep it out of the native browser we
// also have to write into dnd5e's own setting. That setting is world-scope,
// so only a GM can write it - non-GM players can detect/log but can't fix it
// themselves, which is why this always logs what it found either way.
// ============================================================

import { EXCLUDED_HINTS, packHaystack } from "./compendium-resolver.js";
import { MODULE_ID } from "../data/constants.js";

const DND5E_SETTING_NAMESPACE = "dnd5e";
const DND5E_SETTING_KEY = "packSourceConfiguration";

// Avoid re-notifying every time the builder window opens in the same
// session: only speak up when something actually changes.
let hasLoggedThisSession = false;

/**
 * Pack collections (Item packs only - this is about hiding automation
 * "spell" items from the Spells tab, not general source curation) whose
 * metadata matches one of the known automation/effects-only hint keywords.
 * @returns {string[]}
 */
function detectAutomationPackCollections() {
  const matches = [];
  for (const pack of game.packs) {
    if (pack.metadata?.type !== "Item") continue;
    const haystack = packHaystack(pack.collection);
    if (EXCLUDED_HINTS.some(hint => haystack.includes(hint))) matches.push(pack.collection);
  }
  return matches;
}

/**
 * Ensures every detected automation/effects-only pack is excluded from
 * dnd5e's native Compendium Browser by writing `{ [collection]: false }`
 * into dnd5e's own "packSourceConfiguration" world setting. Safe to call
 * repeatedly (e.g. on every builder open) - it only writes when there is an
 * actual delta, and it never un-hides a pack a GM chose to re-enable (it
 * only ever adds `false` entries, it never removes or flips one back to
 * true/undefined).
 */
export async function blockAutomationPacksFromCompendiumBrowser() {
  try {
    const automationPackIds = detectAutomationPackCollections();
    if (!automationPackIds.length) return;

    let current = {};
    try {
      current = game.settings.get(DND5E_SETTING_NAMESPACE, DND5E_SETTING_KEY) ?? {};
    } catch (err) {
      // dnd5e not active, or this version of dnd5e doesn't have the
      // Compendium Browser source setting yet - nothing to do.
      return;
    }

    const newlyBlocked = automationPackIds.filter(id => current[id] !== false);
    if (!newlyBlocked.length) return;

    if (!hasLoggedThisSession) {
      console.log(`${MODULE_ID} | Detected automation/effects-only compendium pack(s) that are not real spell/item sources: ${newlyBlocked.join(", ")}`);
    }

    if (!game.user?.isGM) {
      if (!hasLoggedThisSession) {
        console.warn(`${MODULE_ID} | A GM needs to open this world to hide these packs from the dnd5e Compendium Browser (only a GM can write dnd5e's world-scope Pack Source Configuration setting).`);
        hasLoggedThisSession = true;
      }
      return;
    }

    const merged = { ...current };
    for (const id of newlyBlocked) merged[id] = false;
    await game.settings.set(DND5E_SETTING_NAMESPACE, DND5E_SETTING_KEY, merged);

    console.log(`${MODULE_ID} | Hid ${newlyBlocked.length} automation/effects-only pack(s) from the dnd5e Compendium Browser: ${newlyBlocked.join(", ")}`);
    ui.notifications?.info(`Level One 2024 Builder: hid ${newlyBlocked.length} automation/effects-only compendium pack${newlyBlocked.length === 1 ? "" : "s"} (not real spell sources) from the dnd5e Compendium Browser.`);
    hasLoggedThisSession = true;
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not check/update dnd5e's Compendium Browser pack source configuration`, err);
  }
}
