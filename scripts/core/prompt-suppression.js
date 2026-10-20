import { MODULE_ID } from "../data/constants.js";

/**
 * Maps an actor id to the timestamp its suppression window expires at. Each
 * call to suppressExternalBuilderPrompts() opens (or extends) a window for
 * one specific actor - the one the builder is actively importing items onto
 * - rather than a single global window. This matters because the render
 * hooks below (renderApplication/renderApplicationV2/renderDialog/
 * renderDialogV2 - the first two cover legacy AppV1 and current AppV2 apps
 * respectively, since dnd5e's AdvancementManager and CompendiumBrowser are
 * AppV2) fire for every window in the ENTIRE world, not just windows related
 * to the character this builder session is working on.
 *
 * A caller that cannot identify an actor yet (there shouldn't be any left,
 * but keep this safe) falls into the NO_ACTOR_KEY bucket, which
 * shouldSuppressExternalBuilderPrompt() treats as "suppress anything we
 * can't attribute to a specific actor", matching this module's original,
 * unscoped behavior for that narrow case only.
 */
const NO_ACTOR_KEY = "__no-actor__";
const SUPPRESSION_WINDOWS = new Map();

export function suppressExternalBuilderPrompts(ms = 15000, reason = "", actorId = null) {
  const key = actorId || NO_ACTOR_KEY;
  const until = Date.now() + ms;
  const existing = SUPPRESSION_WINDOWS.get(key) ?? 0;
  SUPPRESSION_WINDOWS.set(key, Math.max(existing, until));
  if (reason) console.info(`${MODULE_ID} | Suppressing external character-builder prompts${actorId ? ` for actor ${actorId}` : ""} for ${ms}ms: ${reason}`);
}

function _activeSuppressedActorKeys() {
  const now = Date.now();
  const active = new Set();
  for (const [key, until] of SUPPRESSION_WINDOWS) {
    if (until >= now) active.add(key);
    else SUPPRESSION_WINDOWS.delete(key);
  }
  return active;
}

function _actorIdFromDocument(doc) {
  if (!doc) return null;
  if (doc.documentName === "Actor" && doc.id) return doc.id;
  if (doc.documentName === "Item" && doc.parent?.documentName === "Actor" && doc.parent.id) return doc.parent.id;
  return null;
}

/**
 * Best-effort extraction of "which actor is this rendered window about".
 * Covers the app shapes actually seen in practice: dnd5e's AdvancementManager
 * and similar level-up/equipment/item-choice apps expose the real actor as
 * `.actor` (sometimes as `.clone`, a working copy with the same id); a few
 * Dialog-based prompts instead bind the actor or an owned item as `.object`,
 * `.item`, or `.document`.
 */
function _extractPromptActorId(app) {
  if (!app) return null;
  const candidates = [
    app.actor,
    app.clone,
    app.object,
    app.object?.actor,
    app.item,
    app.item?.actor,
    app.document,
    app.document?.actor,
    app.document?.parent
  ];
  for (const candidate of candidates) {
    const id = _actorIdFromDocument(candidate);
    if (id) return id;
  }
  return null;
}

export function shouldSuppressExternalBuilderPrompt(app) {
  const activeKeys = _activeSuppressedActorKeys();
  if (!activeKeys.size) return false;
  if (!app) return false;

  const ctor = String(app.constructor?.name ?? "").toLowerCase();
  const id = String(app.id ?? app.options?.id ?? "").toLowerCase();
  const title = String(app.title ?? app.options?.title ?? "").toLowerCase();
  const docName = String(app.document?.documentName ?? "").toLowerCase();

  // Never close the module itself, normal actor sheets, or item description sheets.
  if (ctor.includes("levelone2024") || id.includes(MODULE_ID)) return false;
  if (docName === "actor") return false;
  if (docName === "item") return false;

  const haystack = `${ctor} ${id} ${title}`;

  // dnd5e and third-party character builders use a few different app names.
  // This catches the level/class advancement, equipment, item-choice, and
  // Plutonium/charactermancer windows that otherwise appear after class import.
  const matchesKeyword = [
    "advancement",
    "equipment",
    "starting equipment",
    "item choice",
    "item grant",
    "level up",
    "levelup",
    "character builder",
    "characterbuilder",
    "charactermancer",
    "plutonium"
  ].some(term => haystack.includes(term));
  if (!matchesKeyword) return false;

  // Only suppress a prompt we can tie to the specific actor(s) this builder
  // is actively importing onto. Without this check, ANY other actor's
  // Advancement Manager - including a completely unrelated character
  // leveling up through dnd5e's own native "level up" tool - would be
  // force-closed the instant it opened, just because it happened to render
  // during the couple of minutes after someone finished this builder (or
  // after a silent background-origin-feat import) anywhere in the world.
  // That looked like "leveling up does nothing, it never prompts for
  // anything", including for classes (like Ranger) this builder's own
  // Fighting Style change never touches. When a prompt can't be tied to a
  // specific actor at all, fall back to this module's original behavior and
  // suppress it whenever any builder run is still in its window.
  const promptActorId = _extractPromptActorId(app);
  if (promptActorId) return activeKeys.has(promptActorId);
  return activeKeys.has(NO_ACTOR_KEY) || activeKeys.size > 0;
}
