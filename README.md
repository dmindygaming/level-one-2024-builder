# D&D Character Builder

Current version: v1.23.0

## v1.23.0: v1.22.9 only fixed half of the Second Wind/Favored Enemy warning - the Fighter/Ranger class item itself was still the 2014 one

**Reported by the same live user**, right after rebuilding fresh Fighter and Ranger test characters on v1.22.9 to confirm the previous fix: the same "Maximum Uses formula...has references to missing data" warning was still there on both sheets.

v1.22.9's fix (below) was real but incomplete. It made sure the *feature* item itself - "Second Wind", "Favored Enemy" - imports as its 2024-rules copy, and confirmed live that it does. But the Max Uses formula on that feature item (`@scale.fighter.second-wind`, `@scale.ranger.favored-enemy`) doesn't read from the feature item at all - it reads a scale value that has to come from the actor's *class* item. Checked live: `actor.getRollData().scale.fighter` only had `indomitable` and `action-surge`, even on a freshly-rebuilt v1.22.9 character - no `second-wind` key at all, on either the before or after character. The missing piece was one level up the chain from where v1.22.9 looked.

The actual cause: this builder normalizes every selected class to a single canonical pack, `dnd5e.classes`, before creating the class item on the actor (`_normalizeClassSelection()`/`_coreClassUuidForName()` in `builder-app.js`) - for a good reason (other modules validate class items against that pack, and DDB/custom class copies can fail those checks), unrelated to the Second Wind bug. The problem: `dnd5e.classes` is the *2014 SRD* class pack ("Classes (SRD)") - the actual dnd5e system also ships a separate, official `dnd5e.classes24` pack ("Character Classes") with the real 2024 content, and confirmed live that only *that* pack's Fighter and Ranger class items define the `Second Wind`/`Favored Enemy` ScaleValue advancements the feature items' formulas need - `dnd5e.classes`' Fighter only has Indomitable and Action Surge, `dnd5e.classes`' Ranger only has Spells Known. Every class gets silently downgraded to the 2014-rules class item by this normalization step, regardless of which ruleset's feature items it ends up with - v1.22.9 fixed the feature item, but the class item underneath it was always going to be the 2014 one.

`DND5E_CORE_CLASS_PACK_ID` (a single pack id) is now `DND5E_CORE_CLASS_PACK_IDS` (an ordered list, `["dnd5e.classes24", "dnd5e.classes"]`) in `constants.js`, and `_coreClassUuidForName()`/`_normalizeClassSelection()`/`_mainClassOptions()` in `builder-app.js` all try the 2024 pack first, falling back to the legacy pack only for a class `dnd5e.classes24` doesn't have (none of the 12 core 2024 classes, confirmed live - every one of them resolves to `dnd5e.classes24` now) or for an older dnd5e install that doesn't ship the split pack yet. Verified live: rebuilt the Fighter and Ranger test characters again, `actor.getRollData().scale.fighter` now includes `second-wind`, Second Wind's and Favored Enemy's Max Uses both resolve to a real number, and the warning icon is gone from both sheets. Also re-checked all 12 core classes resolve successfully through the new pack order with no `NOT FOUND` failures, so this isn't a Fighter/Ranger-only fix that happened to miss breaking the other ten.

## v1.22.9: Second Wind and Favored Enemy could import as their 2014-rules versions, breaking their Max Uses formula

**Reported by a live user**: after building one test character per class, the Fighter and Ranger character sheets both showed a warning icon - "The Maximum Uses formula within Second Wind has references to missing data: `@scale.fighter.second-wind`" (and the equivalent for Ranger's Favored Enemy, `@scale.ranger.favored-enemy`). The user's first guess was that Fighting Style was missing entirely, since that's the other level-1 Fighter feature in the same area of the sheet - but Fighter's Fighting Style was present and correct the whole time (it's added as an item named after the style actually chosen, e.g. "Defense", not a generic "Fighting Style" item, which is also why Ranger correctly has none: Ranger doesn't gain Fighting Style until level 2 in the 2024 rules, confirmed against the published level-1 Ranger feature list).

The real cause: this world's class-features compendium carries *two* copies of both "Second Wind" and "Favored Enemy" - a 2014-rules one and a 2024-rules one - same name, same class, same identifier. `_findFeatureItemsByNames()` (`compendium-resolver.js`) already disambiguates same-named features by class/species metadata (subtype, identifier, requirements - this is the fix that already keeps Barbarian and Monk's "Unarmored Defense" apart), but it had no tiebreaker at all for two entries that match the class equally well and differ only in which ruleset they belong to. With no tiebreaker, the deterministic pack-order fallback picked whichever copy happened to sort first, which turned out to be the 2014 one for these two features. The 2014-rules Second Wind and Favored Enemy both scale their uses via a class-item scale value (`@scale.fighter.second-wind`, `@scale.ranger.favored-enemy`) that only exists on the *2014* Fighter/Ranger class item - the 2024 class items don't define it, so the formula resolved to nothing and dnd5e flagged it as broken data.

Added a `rulesPriority()` check to `compareCandidates()` in `compendium-resolver.js`: when two candidates are tied after the existing class/species match check, the one tagged `system.source.rules === "2024"` now always wins over a `"2014"`-tagged one (content with no rules tag at all is treated as neutral, so it's never penalized). This only ever runs as a *tiebreaker after* the existing subtype/identifier/requirements check, so it can't override that logic - Barbarian vs. Monk Unarmored Defense disambiguation is untouched, confirmed by re-checking both characters' AC formula live after this change (still `unarmoredBarb` / `unarmoredMonk` respectively, still the correct AC values). Verified live: rebuilt both the Fighter and Ranger test characters after the fix, and both Second Wind and Favored Enemy now import as their 2024-rules copies (`system.source.rules: "2024"`), Max Uses resolves to a real number instead of an unresolved scale reference, and the warning icon is gone from both sheets.

## v1.22.8: The v1.22.7 Unarmored Defense fix was a no-op - fixed for real this time

**Reported by the same live user**, after updating to v1.22.7: the Barbarian AC bug from v1.22.7 below was still happening, unchanged.

v1.22.7's fix looked for the broken `system.attributes.ac.calcs` effect at `effect.changes` on the raw item data about to be created. That's where a *live* ActiveEffect Document exposes it (dnd5e keeps a `.changes` getter there for convenience), but the actual data - what `item.toObject()` returns, and what a compendium entry is actually shaped like on disk - stores it one level deeper, at `effect.system.changes`. Confirmed live: `Array.isArray(effect.changes)` was `false` on the real data this builder was about to create the item from, so the fix's loop body never ran and the bad `unarmoredMonk` value passed through completely untouched - the warning never even logged. v1.22.7 shipped having only been checked by reasoning through the code, not by running it against real data; this time it was re-run against the exact same compendium entry step by step before shipping, confirming the corrected value actually comes out right.

`_fixLevelOneClassFeatureData()` now checks `effect.system.changes` first, falling back to `effect.changes` for any content shaped the older way. Everything else about the fix (which classes/formulas it checks, when it applies) is unchanged from v1.22.7's entry below.

## v1.22.7: A Barbarian's Unarmored Defense could come out using Monk's formula (Dex+Wis instead of Dex+Con)

**Reported by a live user**, with a screenshot: a freshly built Barbarian showed "Unarmored Defense (Monk)" on their AC breakdown, computed as 10 + Dex + Wis, instead of the Barbarian's own 10 + Dex + Con.

This builder already has dedicated logic (`_findFeatureItemsByNames()` in `compendium-resolver.js`, added after an earlier version of this same class of bug) to make sure a same-named feature like "Unarmored Defense" is matched to the right class's own compendium entry - by identifier, requirements, and subtype, not just the name. Confirmed live that it worked exactly as designed here: the imported item was correctly matched to the Barbarian's own entry (identifier `unarmored-defense-barbarian`, requirements "Barbarian 1", and 2014 Barbarian description text, not Monk's). The bug was one level deeper: that specific compendium entry's own built-in Active Effect - the one that actually tells dnd5e's AC calculator which formula to use (`system.attributes.ac.calcs`, one of dnd5e's own `unarmoredBarb`/`unarmoredMonk`/`unarmoredBard` ids) - was itself set to `unarmoredMonk` inside the compendium data, a data error in that entry, unrelated to which item got matched. Checked the other three "Unarmored Defense" entries in the same world compendium for the same mistake; only this one Barbarian-flavored entry had it.

Since `_findFeatureItemsByNames()` already knows for certain which class a feature is being imported for by the time the item is created, `_fixLevelOneClassFeatureData()` now also double-checks any `ac.calcs` effect on a feature named "Unarmored Defense" against the formula that actually matches its class (Barbarian → `unarmoredBarb`, Monk → `unarmoredMonk`, Bard → `unarmoredBard`) and corrects it if the compendium data disagrees, logging a console warning when it does. This protects against the same kind of mismatched data regardless of which compendium or sourcebook content a given world has installed, the same way this builder already patches a handful of other known-wrong level-1 feature data (Rage/Second Wind/Favored Enemy/Lay on Hands/Bardic Inspiration uses formulas - see the v1.10.4/v1.10.5 entries below). The one existing character already affected in the reporting user's world was repaired directly (its Unarmored Defense effect corrected from `unarmoredMonk` to `unarmoredBarb`, AC recalculated from 15 to the correct 17); every other character in that world was checked and none of them had the same issue.

## v1.22.6: Renamed the module to "D&D Character Builder"; documented Foundry v14 / dnd5e 6.0+ support

**Requested by a live user**: rename the module from "Level One 2024 Character Builder" to "D&D Character Builder", and make sure the documentation actually states what Foundry/dnd5e versions it supports.

**Rename.** Every user-facing display string - the wizard window title, the Actor Directory footer button, the actor sheet header button, the actor directory right-click menu entry, every settings-menu window title (Sourcebook Picker, Ability Score Methods, Feature Overrides, Character Actor Folder), notification text, and the `source` field recorded on items the builder creates - now reads "D&D Character Builder" (or a short form like "D&D Builder" where space is tight) instead of "Level One 2024 Character Builder". Everything else was deliberately left exactly as it was: the module id/folder name (`level-one-2024-builder`), the settings/flag namespace (`MODULE_ID`), every CSS class selector (`.level-one-2024-builder`, `.l12024b-*`), every JS class and global (`LevelOne2024Builder`, `LevelOne2024BuilderAPI`, `LevelOne2024SourcebookSettings`, etc.), and the GitHub repo slug. That split matters: this module has been live in people's worlds since v0.1.x, and changing the id/namespace would have silently orphaned every existing GM setting, actor flag, and `LevelOne2024BuilderAPI.*` macro or script people already have saved. Only the name on screen changed - nothing about how the module is installed, referenced from a macro, or stores its data did.

**Compatibility documentation.** The "What it does" compatibility line at the top of this README still said "A Foundry VTT v13 / dnd5e 5.x module", which was true when it was written but never updated after compatibility was later extended and verified further - the module's own `module.json` compatibility block has stated `minimum: "13", verified: "14"` for Foundry and `minimum: "5.3.0", verified: "6.0.6"` for dnd5e for some time now, and that's also what Foundry itself reports: this was re-confirmed live by checking the running world's actual version ("Version 14 Build 369") before writing this entry. The README now states the same range Foundry's own module manager uses to decide compatibility, instead of an old snapshot of it. The install, sourcebook-setup, and launching sections below, and the step-order list under "What it does", were also updated to match the current button/menu names and step order (the last step reorder, Class before Ability Scores Generation, shipped in v1.22.5 but hadn't been reflected here yet).

## v1.22.5: Class selection now comes before Ability Scores Generation

**Requested by a live user**: pick a class before assigning ability scores, not after, so the player knows what they're building for (which ability to prioritize, etc.) before placing their generated scores.

Moved "Class" in the wizard's step order from its old spot (right before "Class Choices", near the end of the flow) to right after naming the character, before "Ability Scores Generation". "Class Choices" (class skills, Fighting Style, Divine/Primal Order, weapon masteries, Eldritch Invocations) deliberately stayed in its original spot, after Background: its class-skill picker hides skills your background already grants (`_classSkillOptions()`/`_backgroundSkillKeys()`), and that check only works if Background has already been chosen - moving it earlier too would have silently broken that overlap check and let a player double up on a skill without knowing it. New order: Actor → Name → **Class** → Ability Scores Generation → Species → Background → Background Ability Scores → [Human Choices] → [Skilled Proficiencies] → Class Choices → Starting Equipment → Spells → Languages → Review.

This is a pure step-ordering change in `_steps()` - every step's own validation and rendering is keyed by name, not position, and nothing else in the builder reads step order by index, so there was no other code to touch. Verified live in the same world before shipping: simulated the new step list against a real builder instance in both a minimal state and a state with every conditional step active (Human species, a Skilled-granting background), and separately confirmed the background/class-skill overlap exclusion still works correctly with Class Choices in its unchanged position (Rogue + Charlatan: Deception and Sleight of Hand, both granted by Charlatan, are still correctly hidden from Rogue's own class skill choices).

## v1.22.4: Removed the redundant icon gallery from Species/Background/Class now that "Browse All Sources" does the same job

**Requested by a live user**: once a "Browse All Sources" button is present on a step, the in-wizard icon list showing the same options is extra GUI that isn't needed.

The Species, Background, and Class steps each had two ways to pick an entry: a "Browse All Sources" button that opens dnd5e's own Compendium Browser (searchable, filterable, already scoped to the right content type), and, directly below it, a second, redundant picker built into the wizard itself - a scrollable grid of icon cards (one per known species/background/class, with its own art, name, and a "Details" button) plus its own separate search box just for filtering that grid. Both pickers called the same selection logic; the icon grid was just a second, more limited way to do what the Browse button already did better.

Removed the icon grid and its search box from all three steps, keeping only the "Selected: <name>" heading and the "Browse All Sources" button. This is a pure template change (`templates/builder.hbs`) - nothing about how species, backgrounds, or classes are selected, searched, or applied to the actor was touched, so there's no functional risk here, only a simpler step panel. Verified by rendering the updated template against real live data (the actual `getData()` output from a fresh builder instance in the same world) for all three steps before shipping: each renders cleanly, still shows "Browse All Sources", and no longer emits the icon grid or its search box.

## v1.22.3: New characters finished with less than full HP, no usable spell slots, and chosen spells not actually prepared

**Reported by a live user**: "When the features and spells are added, the character's health isn't full, they have no unused spell slots and the spells they select aren't prepared." Three separate, unrelated root causes, all found and confirmed live against a disposable test character instead of guessed:

**HP not full.** `_setLevelOneHitPoints()` hand-computed starting HP as `hit die + CON modifier` instead of reading the actor's own, already-derived `system.attributes.hp.max`. That's wrong whenever anything else also raises max HP at level 1 - most commonly a 2024 Origin Feat like Tough (+2 HP). By the time this function runs, every level-1 item (including origin feats) is already on the actor, so dnd5e has already correctly derived the true max - the function just never looked at it. Confirmed live: a Cleric (d8, CON 14) with the Tough feat added derives `hp.max: 12` (10 base + 2 from Tough), but the old hand-rolled formula only ever wrote `hp.value: 10`, leaving the character visibly short of full health (83%) the moment they were created. Fixed by reading `actor.system.attributes.hp.max` directly and setting `hp.value` to match it, falling back to the old hand-rolled formula only if max somehow isn't derived yet.

**No unused spell slots.** dnd5e correctly derives `system.spells.spellN.max` for a level-1 caster (e.g. 2 for a level-1 Cleric), but the actual "slots available right now" value is separate, literal source data that was never initialized anywhere in the finish flow - confirmed live: a freshly built Cleric had `spell1: {max: 2, value: 0}`. This was a missing step, not a wrong one, mirroring the same max-vs-value split HP already had. Added `_setLevelOneSpellSlots()`, which runs right after HP is set and copies every spell block's derived `max` into its `value` (covers every spell level 1-9 and Pact Magic).

**Chosen spells not marked prepared.** The builder wrote `system.preparation = {mode: "prepared", prepared: true}` on class-list spells, but dnd5e 6.x removed that object entirely in favor of flat `system.method` ("spell"/"innate"/...) and `system.prepared` (an integer enum: 0 unprepared, 1 prepared, 2 always). dnd5e keeps a backward-compatibility shim for the old field, but it only copies `.mode`/`.prepared` into the new fields when the item's own serialized data doesn't *already* have `method`/`prepared` as explicit keys - true for most real compendium items (e.g. anything imported via ddb-importer) - and deletes the legacy object either way. So the old write was silently discarded for most spells and only "worked" by accident on ones whose source data happened to omit those keys. Confirmed live: a Cleric's own chosen 1st-level spell (Alarm) landed on the actor with `prepared: 0` ("Not Prepared") despite the class being a prepared caster. Fixed by writing `system.method = "spell"` and `system.prepared` (from `CONFIG.DND5E.spellPreparationStates.prepared.value`) directly. The same dead field was also used to mark a Magic Initiate level-1 spell as "innate" casting - replaced with `system.method = "innate"` directly; innate spells have no separate prepared state to set at all (`CONFIG.DND5E.spellcasting.innate` has no `prepares` flag), so only the method needed fixing there.

All three fixes verified live, end to end, in the same world before shipping: HP came out at 100% (12/12) with Tough applied, `spell1.value` matched `spell1.max` (2/2), and a class-list spell created with the new fields came back with `canPrepare: true` and `countsPrepared: true` on the actor.

## v1.22.2: Starting Equipment could be selected but nothing was actually added to the character

**Reported by a live user**: picking a Starting Equipment package added nothing to the character at all.

Reproduced live, directly in the same world, by driving the real builder app from the console against a disposable test character instead of guessing: with Fighter selected, `cache.classes` had 0 entries and `cache.equipment` had 2 - meaning the equipment (and class, and background) pickers were drawing from almost no real data to begin with, not that something broke while adding whatever was picked.

Found why, in `core/source-types.js`'s `packIdsForSourceType()`: when a content category (Species, Backgrounds, Classes, Equipment, etc.) is left on "Automatic" - true for every category except one at a time in practice - it used to fall back to an old, pre-"per content type" setting (`selectedItemPacks`) before auto-discovering packs itself. That setting isn't a GM's deliberate choice for the category being resolved: `sourcebook-settings.js` overwrites it on every single save of the Sourcebook Picker with the union of whatever *other* categories happen to be manually configured, purely so an old macro reading that exact setting name directly still sees something (see that file's own comment). Confirmed exactly this in the reported world: Spells had been customized to 3 specific spell compendiums, and Classes/Backgrounds/Equipment were left on Automatic as intended - but that fallback treated the spells-only union as if it were *also* the deliberate choice for Classes, Backgrounds, and Equipment, restricting all of them to 3 compendiums that contain essentially no classes, backgrounds, or gear at all. "Automatic" silently meant "whatever the Spells picker happens to be set to" for every other category, any time more than one category's settings were ever saved.

"Automatic" now always means real auto-discovery, full stop - matching both what the Sourcebook Picker UI shows the GM and what `selectedPacksByContentType`'s own registered default already is. The legacy setting is still written on every save (for any old macro that reads it directly) but is no longer read back into this resolution. Confirmed fixed, live, in the same world, end to end: with the corrected logic, Classes went from 0 to 24 real entries, Equipment from 2 to 1,687, Backgrounds from 0 to 159, and selecting a Fighter's Chain Mail/Greatsword/Flail/8×Javelin/Dungeoneer's Pack package and finishing a test character actually put all 9 resulting items (plus background gear and starting gold) on the actor.

## v1.22.1: v1.22.0's own fix didn't actually run on a real reload - fixed the race condition that caused it

**Reported by a live user**: updated to v1.22.0, reloaded, and asked to have every affected class checked - not just Toll the Dead. Checked live, in the same world, with the real installed v1.22.0 code running: Cleric's registered list was still 109 spells, no Toll the Dead. v1.22.0's own fix hadn't actually run.

Found it: `fixOfficialSpellListGaps()` is called from this module's `Hooks.once("ready")` handler, but it never waited for dnd5e to finish registering its own spell lists first - and confirmed, live, that dnd5e's spell-list registration can still be in progress at the exact moment "ready" fires, so the scan ran against an empty/partial registry and found nothing to add. Worse, the function marked itself "already ran" (a guard meant to make it safe to call more than once) before that scan even happened, so even the safety-net call built into this module's own dialog - meant to catch exactly this kind of timing gap - never got a real second chance; it saw "already ran" and skipped.

dnd5e itself exposes `dnd5e.registry.ready`, a Promise that resolves once its own registries (including spell lists) have fully finished loading. v1.22.1 awaits that before scanning, and only marks itself "already ran" after that wait, so the one scan that happens is always against complete data. Confirmed live, in the same world: awaiting it and re-running the identical scan correctly added Toll the Dead (and 7 other spells) to Cleric, and 130 spells total across all 8 classes with a registered 2024 list - Bard, Cleric, Druid, Paladin, Ranger, Sorcerer, Warlock, Wizard.

## v1.22.0: Found the real root cause and fixed it for real - not just "Toll the Dead", every missing 2024 spell

v1.20.7 through v1.21.0 all tried to fix how this module's own dialog *resolves* identifiers on dnd5e's registered class spell lists. Confirmed still broken after each one. Rather than guess at a fifth theory, logged directly into a live user's actual running world and diagnosed it with real data instead of assumptions.

What that found: this was never a resolution bug anywhere. dnd5e's own free, bundled spell compendium (`dnd5e.spells24`) only ships SRD-licensed content - 340 spells - and does not include "Toll the Dead" at all. The official Cleric/Warlock/Wizard spell lists that `dnd5e.registry.spellLists` serves are built exclusively from that pack. A retail-only 2024 Player's Handbook spell was never going to be part of a registered class list, no matter how correctly a filter resolves identifiers, because it was never in the source data to begin with - nothing to resolve. And it was never a single-spell problem: checked the same user's own D&D Beyond import (575 spells) against that free pack and found 252 of them missing from it entirely.

The fix: dnd5e itself provides a real, public extension point for exactly this - `SpellList#contribute()`, the same method dnd5e's own spell-list journal pages use to add their spells to a class's list. `core/spell-list-registry-fix.js` now calls it directly, once per session (for every connected client, not just the GM), to merge any spell missing from a class's official list into that list for real - genuinely, not just for this module's own dialog, so dnd5e's native Compendium Browser and anything else reading the registry sees it too.

Which spells belong to which class is read from data already on the spells themselves, not a hand-typed table: `flags.plutonium.spellClassNames`/`flags.plutonium.source`, the tag 5etools-derived importers (D&D Beyond's importer among them) already stamp onto every 2024 ("XPHB") spell with its official class list - confirmed directly against this project's own live data (Toll the Dead carries `source: "XPHB"`, `spellClassNames: ["Cleric", "Warlock", "Wizard"]`). On a world with spell data tagged this way, this reconciles every gap automatically, for every class, the first time that world loads this version - not just the one spell that got reported.

## v1.21.0: Fixed a bug in v1.20.9's own fix - confirmed installed, confirmed still not working, found why

**Reported by a live user**: confirmed v1.20.9 installed and reloaded, and Toll the Dead was still missing from the Cleric cantrip list. Since v1.20.7, v1.20.8, and v1.20.9 were three genuinely different mechanisms (pre-loading documents, turning the filter off entirely, and patching dnd5e's registry directly) and all three produced the identical symptom, the most likely explanation stopped being "another wrong theory about dnd5e" and became "the fix code itself has a bug." Confirmed the installed version was in fact 1.20.9, so it wasn't a stale install either - the new code was running and still not working.

Found it: v1.20.9's fix read each spell's real identifier back out of its compendium's index by first splitting each spell-list UUID into its pack and document id using `foundry.utils.parseUuid()` - a Foundry *core* API, not part of dnd5e's own open-source, checkable code. Its exact return shape was never actually verified against this app's assumptions, unlike everything pulled from dnd5e's own source. If that API doesn't return a field literally named `id` the way the code assumed, every single spell UUID in the loop would silently skip itself, and the "corrected" identifier set would end up identical to the original, broken one - exactly matching what was reported.

v1.21.0 removes that dependency entirely. Instead of parsing UUIDs apart, it uses only pieces already directly verified against this exact user's real world data in the console diagnostics earlier in this investigation: index every Item compendium, reconstruct each spell's UUID as the same plain string (`Compendium.<pack>.<id>`) that was already confirmed to correctly match dnd5e's own spell-list registration lookups, and check it with a plain Set.has() - no parsing, no unverified API assumptions. Everything else about the fix (reading the real identifier straight from the index, unioning with whatever dnd5e's own lookup already got right, installing it as the live property dnd5e itself reads) is unchanged from v1.20.9's approach, which was correct in principle - only the one unverified step is replaced.

## v1.20.9: The class spell lists are now actually accurate, instead of being turned off

**Reported by a live user**, pushing back on v1.20.8: turning the class filter off by default avoided hiding real spells, but it didn't make the class spell lists accurate - correct feedback. Went back to dnd5e's own source code (`module/data/item/spell.mjs` in the dnd5e system repository) to see exactly what the "spelllist" filter reads, rather than continuing to guess at symptoms.

Confirmed directly from that source: the filter always resolves to checking a spell's `system.identifier` field against `list.identifiers` - a property read live, every time, from the exact `SpellList` object `dnd5e.registry.spellLists.forType()` returns. There is no way to hand the Compendium Browser a different accepted-spell set through its own options; `list.identifiers` is the only input it ever reads, and dnd5e builds that property (`registry.mjs`) by resolving every spell UUID on a class's registered list through `fromUuidSync`, which needs the full compendium document already loaded in memory - confirmed unreliable in v1.20.7.

The actual fix: `list.uuids` (also from `registry.mjs`) is a *different* property - the authoritative set of UUIDs genuinely registered to a class, built directly from the spell-list journal page's own stored data, with no document resolution involved at all, so it's never wrong. Every one of those UUIDs only needs one field to determine its identifier - `system.identifier` (with the same name-based fallback dnd5e itself uses when that field is blank) - and that field is available the moment a compendium is *indexed*, with no document-loading or permission dependency. So v1.20.9 builds the accepted-identifier set itself, straight from each relevant pack's index, and installs it as that `SpellList` object's own `identifiers` (combined with whatever dnd5e's own version already got right, so nothing is lost) right before the Compendium Browser opens. Since dnd5e reads `list.identifiers` live wherever it's used - not just from this module's own calls - this fixes the class list everywhere, not only in this wizard.

With the class list itself corrected, the filter goes back to being pre-checked by default, same as v1.20.6 and earlier: normal play only shows this class's real spells again. It's still not locked, so the one case this genuinely can't fix - a spell nobody has ever added to a class's list at all - can still be found by unticking it manually.

## v1.20.8: The class spell-list filter no longer hides anything by default - it's opt-in now, not opt-out

**Reported by a live user**: even after v1.20.7's targeted fix (pre-loading every spell on a class's registered list before opening the browser, to work around a specific case where dnd5e's own identifier lookup was silently dropping an unloaded document), the same spell ("Toll the Dead" - genuinely registered to Cleric/Warlock/Wizard, correctly leveled, correctly tagged) was confirmed still missing from the Cleric cantrip list with the class filter applied, on a confirmed-updated, confirmed-reloaded install.

That means dnd5e's own spell-list filter has more than one way to silently miss a spell that's genuinely valid for a class, beyond the specific document-loading cause v1.20.7 targeted and fixed. Rather than keep chasing individual causes one report at a time inside a system we don't control, v1.20.8 changes the default itself: the class spell-list filter is no longer pre-checked when the Cantrips/Level 1 Spells/Magic Initiate/Pact of the Tome spell pickers open. It's still right there in the Compendium Browser's own sidebar as an optional filter anyone can tick if they want to narrow the list down to just a class's known-registered spells - but nothing is ever hidden from the list you see by default because of it. Every spell of the correct level from a real, non-automation pack is shown, full stop. (Level range and the ritual-only restriction for Pact of the Tome still can't be turned off - those come from the spell's own data, not from dnd5e's spell-list registry, and aren't affected by any of this.)

This trades a shorter, pre-narrowed-to-your-class list for a guarantee that a real spell on your class's list can never be invisible because of how dnd5e's own registry happened to resolve it. v1.20.7's cache-warming step stays in place too, since it still genuinely helps on top of this for anyone who does turn the optional filter on.

## v1.20.7: Found and fixed the actual reason a correctly-registered spell (e.g. "Toll the Dead") could still fail the class spell-list filter

**Reported by a live user**: v1.20.6 let the class spell-list filter be unticked, but that wasn't the real fix for every case - specifically "Toll the Dead", which is genuinely registered to the Cleric/Warlock/Wizard spell lists, correctly leveled, and correctly tagged on its own item sheet, was still being rejected by that filter even when it wasn't locked, because the filter is pre-checked by default and this spell failed it outright rather than simply being absent from an unregistered compendium.

Rather than guess again, built a short script for the user to run in their browser console against their live world and got back real data. It showed, for every copy of "Toll the Dead" across their installed packs, the exact raw `system.identifier` field dnd5e's filter checks (`"toll-the-dead"` - correct, matching what the spell's own name would format to) and, separately, whether dnd5e's own spell-list registry considered that identifier accepted for Cleric/Warlock/Wizard. One copy was directly confirmed registered to all three classes by its exact item UUID (`dnd5e.registry.spellLists.forSpell(uuid)` correctly returned `['Cleric', 'Warlock', 'Wizard']`) - yet the registry's own accepted-identifier set for every one of those three classes did not contain `"toll-the-dead"` at all.

That contradiction pointed at dnd5e's own registry code (`registry.mjs`): a class's accepted-identifier set is built by resolving every spell UUID on that class's registered spell-list page through `fromUuidSync` - which only succeeds for a compendium document already fully *loaded* into memory, not merely *indexed* (indexing happens automatically on world load; loading a specific item's full document does not, until something actually opens it). A spell can be genuinely registered to a class by UUID and still get silently dropped from that class's accepted-identifier set if nothing has triggered its document to fully load yet - exactly what the console data showed happening here, independent of this module or of the CPR/GPS automation packs investigated in v1.20.4.

Fixed by having the builder force every spell on a class's registered spell list to fully load (via the always-reliable async `fromUuid`, not the synchronous version dnd5e's own filter depends on) right before opening the Compendium Browser with that class's filter active. This warms the exact cache dnd5e's filter reads from, so spells like this one show up correctly-filtered on the first try instead of requiring the class filter to be manually unticked. The ability to untick that filter from v1.20.6 stays in place as a fallback, now specifically for the one case it's actually needed: a spell that was never added to a class's spell list at all, which still requires a GM to add.

## v1.20.6: Spells from a newly-added compendium can be missing from the class spell list filter - now you can turn that filter off instead of being stuck

**Reported by a live user**: after installing a new spell compendium, its spells didn't show up when browsing Cantrips/Level 1 Spells for a class, even though the spells genuinely belong on that class's 2024 spell list. Confirmed the pack itself *was* visible in the Browse Spell Compendium window and its spells could be found by searching - they just never appeared once the wizard's class/level filter was applied.

This isn't a bug in this module's own pack detection (that's what v1.20.4 and the "CPR"/"GPS" exclusion work was about) - it's a separate dnd5e system behavior. The Cantrips/Level 1 Spells/Magic Initiate steps filter the Compendium Browser by the class's *registered* spell list (`dnd5e.registry.spellLists`, the same data dnd5e's own level-up tools read from, managed under Configure Spell Lists). That registry is populated explicitly, generally by whatever compendium or GM action adds each spell to a class's list - it is not inferred from a spell's source book, name, or any other metadata. A spell from a brand-new compendium isn't on any class's registered list until something adds it there, so previously - since this module locked that filter and gave no way to turn it off - those spells were invisible with no indication why.

Fixed by no longer locking the class spell-list filter: it's still pre-checked by default (so normal play still only shows this class's actual spells, same as before), but it can now be unticked right there in the Compendium Browser's own sidebar, which reveals every spell of the right level from your configured sources regardless of spell-list registration - including spells from a pack that isn't registered with dnd5e's spell list system yet. The in-wizard hint text now mentions this when a class filter is active. (Level range and the ritual-only restriction for Pact of the Tome still can't be turned off - those define what the step is actually for.) For a permanent fix instead of unchecking the filter every time, a GM can add the new compendium's spells to the class's list directly from Foundry's own Configure Spell Lists tool.

## v1.20.5: Fixed the disjointed "name on one line, source below it, big gap, then a full-width Remove button" layout on every spell/Remove list

**Reported by a live user**, with a screenshot of the Cantrips/Level 1 Spells list: each selected spell was rendering as a spell name on its own line, the source label directly below it at the same left indent, a large empty gap, and then a Remove button stretched the full width of the panel on its own line below that - for a list of 3-4 spells this made the Cantrips/Level 1 Spells sections take up most of the window for very little actual content.

Root cause: each `<li>` in these lists holds three separate pieces - the spell name, its source label, and the Remove button - laid out with `display: flex; flex-wrap: wrap`. The v1.20.2 fix stopped the Remove button itself from stretching to fill the row, but it didn't address the other half of the bug: with three independent flex children in a wrapping row, the name and the source label could each wrap onto their *own* line separately from one another (not just separately from the button), since flex-wrap treats every child as independently wrappable. Name, source, and button ended up stacked three deep instead of sitting together as one row.

Fixed by grouping the name and source label into a single flex child (a new `.l12024b-item-label` wrapper) so they always wrap together as one unit, never apart from each other - only the Remove button can end up on its own line now, and only when the row is genuinely too narrow for it. While in there, also gave these rows an actual visual boundary (a subtle card background and border per entry, replacing the bare bullet-point list) so each selected spell/feat/invocation reads as one distinct row instead of ambiguous, unevenly-spaced text. This applies to every list that uses this same row style across the builder - Cantrips, Level 1 Spells, Magic Initiate cantrips/spell, Pact of the Tome cantrips/rituals, Origin Feats, Eldritch Invocations, Starting Equipment, and Languages.

## v1.20.4: Automation/effects-only packs (e.g. "CPR", "GPS") no longer show up as spell choices

**Reported by a live user**: the new "Browse Spell Compendium" window (dnd5e's own native Compendium Browser, used by the Cantrips/Level 1 Spells/Magic Initiate/Pact of the Tome pickers since v1.10.11) was listing items from automation/content packs - the kind of installed pack that labels its items as "spell" type so they behave correctly when dragged onto a sheet, but which only exist to run a macro/active-effect (a "rider"), not to be real playable spells. This module already excluded packs like that from its own older spell/feat/equipment lookups via a simple keyword match against each pack's name/id (the existing list already caught, among others, "cauldron"/"plentiful resources" and "gambit"/"premade"/"automation"/"rider"/"midi"/"dae" packs) - but the new native Compendium Browser doesn't use any of this module's own matching logic at all. It only ever consults dnd5e's own world setting for which packs it's allowed to show, so a pack excluded by this module's internal heuristics could still appear there.

Fixed by: (1) extending that shared keyword list to also catch "cpr" and "gps"-named packs specifically, and (2) adding a new check, run automatically whenever the builder opens, that scans every installed Item compendium against that same keyword list and - for a GM only, since this is a world-scope dnd5e setting a player can't write - writes those packs into dnd5e's own "Pack Source Configuration" (the same setting a GM could otherwise only change by hand from Settings > Configure Compendium Browser Sources), so they're hidden from the native Browse Spell Compendium window too, not just from this module's own older pickers. This only ever adds packs to that hidden list automatically; it never removes a pack a GM has deliberately re-enabled there. A console message and one-time notification mark exactly which pack(s) got hidden this way, so it's never a silent change to a world setting. If a non-GM player opens the builder first, it logs what it found but waits for a GM to open the world before it can actually write the setting.

If you're running a pack that gets caught by this and shouldn't be (the keyword match is a simple substring check, so it can over-match), a GM can always re-enable it from Foundry's own Settings > Configure Compendium Browser Sources dialog - this module never undoes that choice.

## v1.20.3: Skilled now actually asks which 3 skills/tools you get, and collapsed Spells sections stay collapsed

Two more live-user reports, both real bugs:

**The Skilled origin feat granted no proficiencies at all.** Skilled reads "You gain proficiency in any combination of three skills or tools of your choice" - that choice is normally handled by the feat's own native dnd5e advancement, which pops its own window when the feat is added to an actor. This builder, however, deliberately suppresses every native advancement popup when it imports an origin feat, precisely so a native window never interrupts the wizard - the same mechanism that lets Magic Initiate's spell choice be handled by this builder's own UI instead of a native one. That's correct for feats with no sub-choice (Alert, Healer, Lucky, etc.) and for Magic Initiate (which already has its own dedicated Spells-step UI), but Skilled had no equivalent of its own - so its one native choice got suppressed along with everything else and simply never happened, leaving the feat on the sheet with no proficiencies attached. This is the same root cause the v1.10.8 Fighting Style fix already diagnosed and fixed for a class feature; Skilled just hadn't been caught yet. Fixed the same way: Skilled now gets its own "Skilled Proficiencies" step (shown for a Human who picks it as their origin feat, or automatically for the Charlatan/Noble/Scribe backgrounds that grant it outright), where you pick any 3 of the 18 skills or 25 tools/kits/instruments, and the builder writes those proficiencies onto the character directly - the same way it already applies background, class, and Human skill proficiencies.

Crafter (3 artisan's tools) and Musician (3 musical instruments) have the same underlying gap - their own native choice-advancement gets suppressed the same way, with no builder-side replacement yet. They haven't been reported as broken, but by this same logic they are; flagging it here rather than leaving it quiet. Can be fixed the same way Skilled just was, on request.

**Collapsed Spells sections (Cantrips, Level 1 Spells, Pact of the Tome, etc.) reverted to fully expanded the moment you picked the next set.** Every `<details>` section on the Spells step was hard-coded `open` in the template, with nothing recording whether a player had manually collapsed one. Since choosing a spell triggers a full re-render of the step, that hard-coded `open` won, and the section snapped back open on every single pick - making the collapse/expand control on a long multi-section list (the whole point of the v1.10.11 rewrite) nearly useless once a class had several of these sections going at once. Each section's open/closed state is now tracked separately on the builder application instance and fed back into the template on every render, so collapsing one now actually stays collapsed through the rest of the step.

## v1.20.2: Fixed broken layout on the new Spells list and on compact radio/checkbox option grids

**Reported by a live user** (first real in-Foundry report this module has gotten since the v1.10.11 Spells rewrite and the v1.20.1 compatibility work) - two layout bugs, both CSS-only, nothing in the builder's logic or data was wrong:

- **"Remove" buttons on the new Spells step stretched to the full width of the panel**, each shoved onto its own line below the spell name instead of sitting neatly to the right of it. The `.l12024b-selected-list li` rows use a flex layout with `margin-left: auto` to push the Remove button to the right, but nothing constrained the button's own flex sizing - Foundry/dnd5e's own form CSS hands buttons inside a flex row `flex: 1` by default, so once a row wrapped (a long spell name plus its source-pack label), the Remove button grabbed the entire width of its own wrapped line. Fixed by explicitly pinning those buttons to `flex: 0 0 auto; width: auto`, so they now stay content-sized and right-aligned. This list is also used for Pact of the Tome cantrips/rituals, Magic Initiate cantrips/spell, and background origin feats/starting gear, so all of those were silently affected too, not just cantrips.
- **The Human skill-proficiency choices (and the "+1 to three abilities" background ability-score picker) rendered as a single unstyled column with odd dividing lines instead of a tidy grid of option chips.** The template uses `.l12024b-choice-grid`/`.l12024b-check` classes for these compact option pickers, but - this looks like something dropped during an earlier refactor - no CSS had ever actually been written for either class, so the browser fell back to bare, unstyled `<label>`/`<input>` markup with no grid, no padding, and no box around each option. Added the missing `.l12024b-choice-grid` (and `.compact` variant) grid layout and folded `.l12024b-check` into the same themed option-chip styling already used by `.l12024b-checkbox-grid label` elsewhere in the wizard (including across all five GUI color themes). Also added matching layout CSS for the Starting Equipment step's `.l12024b-equipment-groups` container, which had the same kind of gap even though it hadn't been reported yet.

No version-compatibility or logic changes in this release - this is a CSS-only follow-up to v1.20.1. If anything else in the wizard still looks unstyled or misaligned in your game, screenshots like the ones that caught these two are exactly what's useful for tracking it down, since nothing in this environment can click through a live Foundry window to catch layout bugs on its own.

## v1.20.1: Foundry v14 / dnd5e 6.0.6 compatibility declared and verified at the source level; fixed a real AppV2 gap in prompt suppression

**Declared compatibility:** Foundry's "unverified compatibility" warning on v14 was accurate - this module had never updated its `verified` core version past 13, even though nothing about the module actually required v13 specifically. `module.json` now declares `compatibility.verified: "14"` (minimum stays "13" - both are still fully supported, stable Foundry releases). The dnd5e system relationship now declares `minimum: "5.3.0"` and `verified: "6.0.6"`, tightened up from an untested `minimum: "5.0.0"` to match the actual floor this has been checked against.

**What "verified" means here:** Live Foundry access still isn't available while working on this, so nothing in this release was clicked through in a running v14 world. What follows is real source-level verification: the actual dnd5e 5.3.3 and 6.0.6 (current release at time of writing) source was pulled from the system's own GitHub repository and dnd5e's 6.0.0 breaking-change list was checked line by line against this module's code - none of the listed breaking changes (chat card data models, `senses`/`bloodied` config shape, `getTargetDescriptors`, `_onChangeSheetMode`, AC calculation fields, etc.) touch anything this module reads or writes. Foundry's own v14 release notes were also checked for Application V1 removal - the legacy `Application`/`FormApplication` classes this entire module is built on are still fully functional in v14, just not the recommended framework going forward.

**A real bug this surfaced:** dnd5e's AdvancementManager and CompendiumBrowser - confirmed by reading their actual source - have been built on ApplicationV2 since at least 5.3.3, not the legacy Application framework. Foundry's hook convention means ApplicationV2 windows fire `renderApplicationV2`, not the `renderApplication` hook this module's prompt-suppression system listened for. In other words, the suppression window that keeps dnd5e's native Advancement Manager from popping up and interrupting this builder's own import (and the actor-scoped fix from v1.10.9 that keeps it from closing some *other* actor's level-up window) had a real gap: it was never actually seeing those windows at all on any dnd5e version from 5.3 onward. Added a `renderApplicationV2` hook alongside the existing `renderApplication`/`renderDialog`/`renderDialogV2` ones, using the same actor-scoped suppression logic already in place - confirmed by reading the actual AdvancementManager source that it still exposes `.actor` and `.clone` the way this module's actor-detection already expects, so no other changes were needed there.

If you still see a compatibility warning after updating, or notice a native level-up/advancement prompt interrupting things (or failing to appear when it should), please report back with your exact Foundry and dnd5e version numbers.

## v1.20.0: Version number bump

No functional changes - this release renumbers the module from the 1.10.x line to 1.20.0. All functionality is identical to v1.10.11 below.

## v1.10.11: Spell selection now opens the dnd5e Compendium Browser instead of one long in-wizard list

The Spells step used to render every eligible cantrip/spell as its own checkbox row directly inside the wizard window - for a class with a large spell list (or once Magic Initiate / Pact of the Tome sections were also showing their own lists), that made the step extremely long and slow to scroll through.

Cantrips, Level 1 Spells, Magic Initiate cantrips/spell, and Pact of the Tome cantrips/ritual spells are now chosen through the dnd5e system's own Compendium Browser (the same searchable, scrollable browser the system's native class/background/species pickers already use in this module) via a "Browse Spell Compendium" button. The browser opens pre-locked to the correct spell level (cantrip vs. level 1, and ritual-only for Pact of the Tome rituals) and, where the system's spell list registry has an entry for that class, to that class's official 2024 spell list - the same registry dnd5e's own level-up tools use to know which spells belong to which class - so only valid options can be picked, and it enforces the exact number of picks required (e.g. exactly 2 cantrips) before it will let you confirm. Pact of the Tome cantrips/rituals intentionally draw from any class's list, matching the 2024 rules for that invocation. If a class has no registered 2024 spell list in the installed sources (most notably Artificer, which the official 2024 PHB didn't update), the browser falls back to showing every spell at the right level rather than refusing to open.

Previously-chosen spells still show in a compact list on the step itself with a one-click Remove button, so you don't have to reopen the browser just to drop one pick. This also removes the per-spell automation-detection/scan work the old inline list did on every render of the step, which should make the step noticeably snappier in addition to shorter.

Note: this fix could not be verified against a live Foundry session before release (browser access was unavailable while working on it). It's built directly against the dnd5e system's own Compendium Browser source (confirmed the "spells" tab, its level/spelllist/properties filter definitions, and the `CompendiumBrowser.select()` multi-select API this relies on, by reading the system's current source), but if the Browse button doesn't open, shows the wrong spells, or won't let you confirm the right count, please report back.

## v1.10.10: Fixed a ~30 second hang moving from "Background Ability Scores" into "Human Choices"

A user reported it taking about 30 seconds to progress after clicking Next on the Background Ability Scores step for a Human character. Human is the only species with an extra step (choosing an origin feat), and building that step's options scans every installed Item compendium for the 2024 PHB's known origin feats (Alert, Crafter, Healer, Lucky, Magic Initiate, Musician, Savage Attacker, Skilled, Tavern Brawler, Tough) - by design, since some sourcebook packs keep the origin feats outside the packs already selected for species/background/class.

The bug was in how thorough that scan was. For any compendium entry whose quick index data didn't already clearly say "this is an origin feat" - which is every single non-origin feat, including class features, general feats, epic boons, everything - it fell back to fully loading that item's complete document to double-check, one at a time, awaited in sequence. In a world with any real feat library installed, that is a full document load for potentially hundreds of irrelevant items just to find the ten real origin feats, and it's exactly what was taking ~30 seconds.

Fixed by only doing that full-document fallback load for entries whose name already matches a known origin feat name (including known name variants like "Magic Initiate (Cleric)"), rather than for every feat-typed item that doesn't already self-identify as origin from its lightweight index data. A genuine origin feat that only reveals itself as origin via a full document load is still always caught, since that check happens by name regardless of what the index shows - nothing this could previously find is missed by this change; it just stops needlessly opening every other feat in the world to rule it out. Verified with `node --check` and a dangling-reference pass, not a live Foundry session (browser access still unavailable) - please confirm the Human Choices step now advances quickly.

## v1.10.9: Critical fix - leveling up ANY other actor could silently do nothing while this module was active

**This was a serious bug and every v1.10.x install should update.** After finishing a character in the builder (or during a silent background-origin-feat import), the module opens a short window where it force-closes any popup that looks like a class advancement/level-up/equipment prompt - this is intentional, and it's how the builder keeps its own custom pickers in control instead of a native or third-party popup interrupting the wizard mid-import. The bug: that window and its keyword matching ("advancement", "level up", "item choice", etc.) were never scoped to the specific actor the builder was working on. For a couple of minutes after anyone finished the builder anywhere in the world, dnd5e's own native Advancement Manager would be force-closed the instant it opened for ANY actor - including one that had nothing to do with the builder at all.

A user reported this as leveling up their Ranger through Foundry's built-in level-up tool doing nothing whatsoever: no class features, no subclass prompt, no Fighting Style prompt, no ASI/Feat choice - because the entire Advancement Manager window was being closed before it could show anything, not because of anything specific to Ranger or Fighting Style. This could hit any class, any time the builder (or a silent origin-feat import) had run in roughly the last two minutes anywhere in the game.

Fixed by tracking which actor each suppression window belongs to and only closing a prompt when it can be tied to that same actor (checked via the window's bound actor/item/document, matching how dnd5e's own Advancement Manager and similar apps expose the actor they're editing). A prompt that can't be tied to any actor - an actor-less confirmation dialog, for instance - still falls back to the old behavior, since there's no way to be more precise there. This was verified with a standalone simulation of the suppression logic against mock advancement-manager-shaped objects (own actor still suppressed, a different actor's window no longer touched, actor sheets never touched, an unidentifiable dialog still caught) - not a live Foundry session, since browser access was unavailable again this round; please confirm leveling up other actors behaves normally again.

## v1.10.8: Fighter now gets prompted to choose a Fighting Style

Fighting Style was in Fighter's level-1 feature list alongside Second Wind and Weapon Mastery, so it went through the same generic "just import this named feature" path as those two. That path intentionally suppresses Foundry's native Advancement prompts (so the builder's own pickers are in control instead of a native popup interrupting the wizard) - which works fine for a feature with no sub-choice, but Fighting Style's own choice-of-style advancement never got a chance to run, so a Fighter simply never got asked which style to take.

Fighting Style now works the same way Divine Order and Primal Order already do: it's pulled out of the generic feature-name list and given its own dedicated step with a radio-button choice of all nine 2024 Fighting Styles (Archery, Blind Fighting, Defense, Dueling, Great Weapon Fighting, Interception, Protection, Thrown Weapon Fighting, Two-Weapon Fighting), each with its description. The builder still prefers your installed compendium's own "Archery"/"Defense"/etc. feature item by name when it can find one; a simple built-in fallback (including the flat numeric bonus for the four styles that grant one) is only used if that lookup fails. This step is required for Fighters and can't be skipped, matching how Divine Order and Primal Order are enforced for Cleric and Druid.

Note: this fix could not be verified against a live Foundry session before release (browser access was unavailable while working on it) - it's built by mirroring the existing, working Divine Order/Primal Order code path exactly, but if a Fighting Style doesn't show up as an option, doesn't get added to the sheet, or its bonus doesn't apply, please report back so it can be corrected.

## v1.10.7: Dropdown lists inside popup dialogs (Weapon Mastery, etc.) are readable again

The "readable native dropdown" CSS added in v1.6.8 only ever matched `form.l12024b select` - which works for the main wizard window, because its own root element really is `<form class="l12024b ...">`. Every themed popup dialog this module opens (Weapon Mastery picker, Confirm Species/Background/Class, ability score Change/Swap, etc.) instead puts that `l12024b` class on a plain `<div>` nested *inside* Foundry's own Dialog `<form>` - so none of those selectors ever matched a `<select>` in a dialog, and its open dropdown list fell back to the browser's own unstyled popup (often pale/white text on a light background, unreadable against a dark theme). Added the same rules for the bare `.l12024b` wrapper so both shapes are covered.

## v1.10.6: Languages step no longer shows monster communication entries, and Next/Back/Finish are debounced

- **The Languages step was listing things like "Giant Eagle" and "Winter Wolf" as if they were real languages.** D&D Beyond Importer adds its own "D&D Beyond Rare Languages" category to the dnd5e system's language list, and that category is almost entirely monster/creature communication abilities (135 entries in a world with ddb-importer active), not player languages. The builder's language list was pulling from every category it found under the system's language config, official or not. It now only reads dnd5e's own two official categories (Standard and Rare Languages) and ignores anything a module has added on top - so this is fixed regardless of which import/conversion module added the extra category, not just D&D Beyond Importer specifically.
- **Next, Back, and Finish are now disabled while a click is being processed.** Finish in particular runs a long chain of actor/item creation calls; a second click before the first one finishes (a slow connection, a habit double-click) could re-enter that same process concurrently and create duplicates, since several of its "only add this if it's not already there" checks aren't safe against two overlapping calls both checking before either one creates. The three buttons now grey out for the duration of one click and re-enable when it's done (or immediately, if it was rejected by validation).

## v1.10.5: Bardic Inspiration uses now scale with Charisma instead of always being 1

Bardic Inspiration's uses are supposed to equal the Bard's Charisma modifier
(minimum 1) - the compendium shipped it as a flat "1", which only happened
to be correct for a Bard with a +1 Cha modifier or lower. This is the same
underlying problem as Rage, Second Wind, Favored Enemy, and Lay on Hands in
v1.10.3/v1.10.4 (a number frozen at creation instead of a live formula), just
tied to an ability score instead of class level. It now uses a live formula
that reflects the character's actual Charisma modifier, including if that
modifier improves later via an Ability Score Improvement.

Also checked directly by request: Sneak Attack (Rogue) and Martial Arts
(Monk) do not have this problem. Both keep their die progression on the
class's own scale value, which this builder has never frozen or interfered
with. Sneak Attack has no automatic damage application in the base compendium
content at all (true for every Rogue in this system, not specific to a
character built by this module) - the current die count must be applied
manually. Martial Arts' damage override is automatic but ships turned off by
default, the same way Rage only takes effect once activated - a Monk has to
toggle it on when fighting unarmed instead of with a normal weapon.

## v1.10.4: max HP now updates on level-up, plus three more level-1 features that were stuck like Rage was

A user reported that a Barbarian's Rage uses weren't increasing on level-up
(fixed in v1.10.3), then asked to have every level-scaling class ability
audited before trusting it further, and separately noticed max HP wasn't
increasing on level-up either. Both turned out to be real, and the HP one is
the more serious of the two - it affected every single class, not just
Barbarian.

**Max HP now updates correctly on every level-up.** dnd5e only calculates an
actor's max HP from the class's own Hit Points advancement when max HP is
left blank in the character's data; if a number has already been written
there directly, dnd5e leaves it alone forever and never recalculates it,
even as the character gains levels. This builder was writing that number
directly at character creation (to skip Foundry's own hit-point prompt,
which doesn't fit the builder's single wizard flow) - which worked at level
1, but permanently disabled dnd5e's own HP calculation for that character
for the rest of its life. A level 9 test character with this bug still
showed only its level 1 max HP, despite having correctly recorded hit point
rolls for levels 2 through 9 that were simply never being added up. This
version records the character's level 1 hit points on the class item itself
(the same place Foundry's own leveling tool records every level after that)
instead of writing directly to the character, so dnd5e's calculation runs
normally and stays correct at every future level.

**Three more level-1 features had the same frozen-number problem Rage did.**
Auditing every level-1 class feature this builder imports against the same
compendium Rage came from turned up the identical gap in three more:
Second Wind (Fighter), Favored Enemy (Ranger), and Lay on Hands (Paladin).
All three now use a live formula tied to the character's level instead of a
number fixed at creation, the same fix applied to Rage in v1.10.3.

This only affects newly-built characters - see "Current limitations" below
for repairing characters built with an older version.

## v1.10.3: Barbarian Rage uses now scale with level instead of staying frozen at 2

Characters with the Barbarian class stopped getting more uses of Rage as
they leveled up through Foundry's native Advancement Manager - a level 3+
Barbarian would still show only 2 uses of Rage instead of 3 (or more at
higher levels).

The Rage feature item this builder imports ships from the compendium with
its "number of uses" left at 0, meant to be filled in dynamically from the
Barbarian class's own "Rages" scale value (2 at level 1, 3 at level 3, 4 at
level 6, 5 at level 12, 6 at level 17). A much older version of this builder
stripped that scale value along with all other class advancement, so it
hardcoded Rage's uses to the flat number "2" (correct only at level 1) to
compensate. That hardcoding was never removed after a more recent fix
stopped stripping level 2+ class advancement - so the actor has correctly
had the live scale value available since then, but Rage's uses were still
being frozen at the old flat number instead of using it.

This version writes the actual scale-value formula into Rage's uses instead
of a fixed number, so it now automatically tracks the correct amount at
every level exactly like the rest of the class's level-scaling features
already did. This only affects newly-built characters - see "Current
limitations" below for existing characters built with an older version.

## v1.10.2: Background is now a gallery like Species and Class, and every builder dialog is themed

- **Background is now chosen from an in-module gallery**, matching how Species
  and Class already work: a search box and a grid of background cards pulled
  from your configured Character Creation Sources, with a "Browse All
  Sources" button kept alongside it for the rare case where a background
  isn't in your configured sources. Previously Background was the only one
  of the three that only opened the separate dnd5e Compendium Browser window.
- **Every popup window the builder opens now uses the same theme as the main
  wizard**, instead of Foundry's plain default styling. This covers the
  "Confirm Species/Background/Class" prompts, "Confirm <step>" step-complete
  prompts, the Origin Feat confirmation, the reroll-approval prompt, the
  ability score Change/Swap dialogs, and the Weapon Mastery picker. These
  small dialogs previously had no connection at all to the GUI theme system
  added in v1.10.0, so they always rendered in Foundry's default look no
  matter which theme was selected.

## v1.10.1: fixes a v1.10.0 regression that broke every button in the wizard

v1.10.0 shipped with a leftover reference to a method (`_applyThemeToWindow`)
that had been removed earlier in that same update when window theming was
consolidated into a shared helper. That method is called every time the
wizard window renders - starting with the very first screen - and because it
no longer existed, it threw an error before any of the window's Next, Back,
Finish, or selection button handlers could be attached. The practical effect
was that the wizard opened but nothing in it responded to clicks, and because
none of the window's own sizing logic ran either, the window itself rendered
oversized. This version restores the correct call, so the wizard responds
normally again from the first screen onward and sizes itself correctly. No
other behavior changes from v1.10.0.

## v1.10.0: characters can now level up past 1, prepared casters get usable spells, and long steps collapse

Earlier versions stripped **all** advancement (not just level-1 choices) from
every imported class and species item. That was meant to stop the builder's
own level-1 choices from also triggering Foundry's native Advancement
Manager, but it also permanently deleted Ability Score Improvements,
Subclass selection, later ItemGrant/Trait/ItemChoice entries, and higher-level
species features (e.g. a Tiefling's extra legacy spell at level 3/5, an
Aasimar's level 3 transformation). A class or species item built by this
module could never advance past level 1 through Foundry's normal level-up
flow - the character sheet's own "Class Features" list at level 3+ stayed
whatever it was at level 1.

This version only strips advancement whose applicable levels are level 1
**and nothing else** - the level-1 choices this builder already grants
directly - and leaves every level 2+ entry completely intact, for both class
and species items. Characters built with this version level up normally
afterward through the actor sheet, including native subclass selection at
whatever level the class grants it.

Also fixed in this version:

- Cleric, Druid, Paladin, and Artificer are "prepared spellcaster" classes
  in the 2024 rules - their level-1 spell choices are now created with
  `prepared: true` so they show up ready to cast immediately, instead of
  needing the player to manually toggle every spell's prepared checkbox
  before the character has any usable leveled spells.
- Choosing the same spell as both a class spell and a Magic Initiate spell
  no longer overwrites that spell's preparation mode to "innate" - only a
  spell created fresh for Magic Initiate gets that treatment now, so a real
  class-prepared spell isn't quietly turned into a slot-free at-will spell.
- Every settings window (Character Actor Folder, Ability Score Generation
  Methods, Feature Overrides, Character Creation Sources, the main builder)
  now shares the same themed window styling consistently.
- The Spells step (and the Eldritch Invocations list in Class Choices) can
  get very long once Cantrips, Level 1 Spells, Magic Initiate, and Pact of
  the Tome sections are all showing at once. Each of those sections is now
  a collapsible block so a section can be folded away once you're done with
  it.

Known remaining gap: the number of level-1 spells a prepared caster is
prompted to choose is still a fixed number per class rather than scaling
with that class's spellcasting ability modifier (2024 rules: ability
modifier + a class-specific level term, minimum 1). See "Current
limitations" below.

## v1.8.0: compendium resolution rewrite

Earlier versions could occasionally attach the wrong compendium item for a
class/species feature that shares its name with another class/species (the
best-known case: importing Monk's Unarmored Defense onto a Barbarian). The
root cause was that class-feature, species-feature, Eldritch Invocation, and
Origin Feat lookups each did their own full scan of *every installed Item
compendium*, ignoring the GM's Sourcebook Picker settings entirely, and broke
ties with a text-similarity guess that depended on pack load order.

This version replaces that with a single, deterministic resolver
(`scripts/core/compendium-resolver.js`):

1. A GM-pinned override (new **Feature Overrides** settings menu) always wins.
2. Otherwise, only the packs the GM has configured for that content category
   (Species, Species Features, Backgrounds, Classes, Class Features /
   Invocations, Feats, Spells, Equipment) are searched at all.
3. Ties among in-scope candidates are broken by class/species metadata match,
   then official-sourcebook priority, then a fixed alphabetical pack-id
   tiebreak - never by scan order.

The codebase was also split from one 6,000+ line file into focused ES
modules under `scripts/data`, `scripts/core`, and `scripts/apps` so the
resolution logic, settings, and wizard UI can be reasoned about and changed
independently.

### New: Feature Overrides settings menu

If your table runs multiple sourcebook modules that legitimately both
provide a same-named feature, open **Feature Overrides** in module settings,
pick a class or species, and pin the exact compendium item to use for any of
its level-1 features. Leave a row on "Auto" to keep using the deterministic
resolver above.

A 2024-rules level 1 character creation wizard for Foundry VTT v13 and up (verified through v14) and the dnd5e system v5.3 and up (verified through v6.0.6).

## What it does

- Creates a new real dnd5e character actor, or updates an existing character actor assigned by the GM.
- Supports these ability methods:
  - Standard Array
  - Point Buy
  - 4d6 drop lowest
  - 2d6+6, reroll 1s and 2s
- Prompts in this order:
  - Actor: create new or use an existing owned actor
  - Name
  - Class
  - Ability Scores Generation
  - Species
  - Background
  - Origin Feats
  - Class skills
  - Level 1 spells, if applicable
  - Languages
  - Review
- Imports selected species/background/class/spell items from Foundry compendiums.
- Automatically detects installed dnd5e Item compendiums.
- Adds a GM sourcebook picker with checkboxes instead of requiring raw pack IDs.

## Install

Copy the `level-one-2024-builder` folder into:

`FoundryVTT/Data/modules/`

Then enable **D&D Character Builder** in your world.

(The folder name and module id stayed `level-one-2024-builder` on purpose - only the display name changed, so existing settings, actor flags, and `LevelOne2024BuilderAPI.*` macros from older installs keep working.)

## Sourcebook setup

By default, the module uses **Automatic sourcebook detection**. It searches active Item compendiums for installed dnd5e sources, including the 2024 Player's Handbook package if it is installed and enabled in the world.

To choose sources manually:

1. Open **Configure Settings**.
2. Go to **Module Settings**.
3. Under the **D&D Character Builder** module header, open one of the **... Sources** menus (one per content type - Species, Backgrounds, Classes, Spells, etc.).
4. Check the sourcebook/item compendiums the builder should use.
5. Save.

You can also open the same menu from inside the builder with the **Sources** button.

## Launching

- Actor Directory footer button: **D&D Character Builder**
- Character actor sheet header button: **D&D Builder**
- Character actor directory right-click menu: **D&D Character Builder**
- Console fallback: `LevelOne2024BuilderAPI.open()`
- Source picker fallback: `LevelOne2024BuilderAPI.sources()`
- Debug detected packs: `LevelOne2024BuilderAPI.detectedPacks()`

## Existing actor workflow

If the GM has already created a blank actor for a player, the player can launch the builder, choose **Use an existing actor** on the first step, and select that actor. Players only see character actors they own; GMs see all character actors.

## Current limitations

- The wizard itself only builds a character at level 1 - it does not walk you
  through levels 2+. As of v1.10.0, a character it builds levels up normally
  afterward through Foundry's native level-up flow (advancement for level 2+
  is no longer stripped).
- No multiclassing.
- Class skill and spell prompt counts (including how many level-1 spells a
  prepared caster is asked to choose) use a lightweight, fixed-per-class
  2024 map rather than computing the real formula (spellcasting ability
  modifier + a class-specific level term, minimum 1). A Cleric/Druid/
  Paladin/Artificer with an unusually high or low spellcasting modifier may
  be asked to choose one more or one fewer level-1 spell than the 2024
  rules actually grant them at level 1.
- A Barbarian, Fighter, Ranger, Paladin, or Bard character built with a
  version older than v1.10.5 has its Rage, Second Wind, Favored Enemy, Lay on
  Hands, or Bardic Inspiration uses frozen at whatever was correct on the day
  it was built, because those versions wrote a fixed number instead of a live
  formula. Leveling it up (or raising the relevant ability score) will not
  fix this on its own. To fix an existing character like this, open the
  affected feature item, go to its Uses configuration, and either enter the
  correct current number, or replace the Max field with the matching formula
  so it keeps itself correct from then on: `@scale.barbarian.rages` (Rage),
  `@scale.fighter.second-wind` (Second Wind), `@scale.ranger.favored-enemy`
  (Favored Enemy), `5 * @classes.paladin.levels` (Lay on Hands), or
  `max(1, @abilities.cha.mod)` (Bardic Inspiration).
- **Any character built with a version older than v1.10.4 also has its max
  HP frozen at whatever it was on the day it was built**, and will not gain
  any more max HP on future level-ups no matter what version of the module
  it levels up with, because the character's own data was already written
  in a way that disables dnd5e's HP calculation for that character
  permanently. To fix an existing character like this, open the browser
  console (F12) as GM and run, substituting the character's actual name:
  ```js
  const actor = game.actors.getName("Character Name");
  const cls = actor.items.find(i => i.type === "class");
  const adv = Object.values(cls.system.advancement).find(a => a.type === "HitPoints");
  const value = { ...adv.value, 1: "max" };
  await cls.update({ [`system.advancement.${adv._id}.value`]: value });
  await actor.update({ "system.attributes.hp.max": null });
  ```
  This backfills the missing level 1 entry and clears the frozen number so
  dnd5e recalculates max HP from every level the character has actually
  taken, and keeps it correct from then on. Characters built with v1.10.4 or
  later do not need this.


## 0.1.4

- Fixed rolled/array ability assignment so each generated score can only be used the number of times it appears.
- Rolled methods now auto-assign the generated results in order so select boxes do not default every ability to the first score.
- Added validation that blocks finishing the Abilities step if generated scores are duplicated illegally.


## v0.1.5

- Ability score assignment now swaps scores instead of blocking reassignment when all generated scores are already assigned.
- Rolled ability scores cannot be rerolled by repeatedly clicking the roll button. Players send a GM approval request; GMs get a chat-card approval button.


## v0.1.5 changes

- Ability-score reassignment now opens an explicit swap dialog when a selected score is already exhausted.
- Ability-score roll chat messages are whispered to GMs instead of posted publicly.

## v0.1.6 notes

- The Abilities step is now labeled **Ability Scores Generation**.
- Builder buttons are larger for easier use.
- GMs can configure ability score generation methods under:
  `Configure Settings → Module Settings → D&D Character Builder → Ability Score Generation Methods`.
- Built-in methods can be hidden/disabled.
- Custom methods can be added as JSON:

```json
[
  { "id": "heroic-array", "label": "Heroic Array", "type": "array", "scores": [16, 15, 14, 13, 12, 10] },
  { "id": "3d6-straight", "label": "3d6 Straight", "type": "roll", "formula": "3d6" },
  { "id": "heroic-point-buy", "label": "Heroic Point Buy", "type": "pointbuy", "points": 32, "min": 8, "max": 16, "costs": { "8": 0, "9": 1, "10": 2, "11": 3, "12": 4, "13": 5, "14": 7, "15": 9, "16": 12 } }
]
```

## v0.1.10 notes

- Restores and hardens explicit score reassignment.
- Replaces the score dropdowns with a Change button for each ability.
- The Change dialog presents exact assign/swap options, so users choose what moves where instead of relying on native dropdown behavior.

## 0.1.8

- Restored direct ability score assignment dropdowns.
- Selecting an exhausted score now opens an explicit swap dropdown so the player chooses which ability gives up that score.
- Kept the score-pool validation, GM-whispered rolls, reroll approval flow, larger buttons, and configurable generation methods.


## v0.1.10

- Generated ability scores now start unassigned.
- Removed swap prompt behavior.
- Ability dropdowns only allow unused scores, while keeping the current assigned score selectable.
- To move a score, clear it from the current ability and then assign it elsewhere.


## v0.1.10

- Fixed blank ability dropdown values being counted as 0, which caused false duplicate-score warnings when assigning generated scores.


## v0.1.13

- Locked in the existing Actor-first flow and ability score generation behavior from v0.1.11.
- The builder now creates a working actor immediately after the Name step when creating a new character, so the actual dnd5e character sheet exists during the rest of creation.
- Replaced blind dropdowns for Species, Background, and Class with choice cards. Each card can open the normal compendium Item sheet for review before choosing.
- Spells now have an Open button so players can review the normal spell item sheet from the compendium before selecting it.
- Selected species/background/class still import to the actor on Finish.

## v0.1.13

- Locked in the existing actor-first flow and current ability score generation behavior.
- Replaced the module's card lists for Species, Background, Class, and Spells with launch buttons for the built-in dnd5e Compendium Browser.
- Selection now respects the dnd5e Compendium Browser source configuration, so unwanted duplicate sources such as premade/content modules can be disabled from the dnd5e browser's own source settings.
- Species, Background, and Class are selected through locked dnd5e browser selection windows.
- Cantrips and level 1 spells are selected through the dnd5e spell browser and then validated by spell level.


## v1.0.0

- Locked in the existing actor-first flow.
- Locked in the current ability score generation and assignment behavior.
- Removed the module's background ASI selection entirely.
- Background Ability Score Increases are now left to the built-in dnd5e background advancement workflow when the selected background is applied/imported.


## Version 1.1.5


## Version 1.1.2 additions

- Added a GM setting menu for the folder used by newly-created character actors.
- Existing actors are not automatically moved when a folder is configured; the folder setting applies to actors created by this builder.


## 1.1.2



## 1.1.2

- Removed the player-facing source summary/source button from the builder window.
- Removed the player-facing Background Ability Score Increase notice from the Background step. Background ASIs remain handled entirely by the built-in dnd5e workflow.


## 1.1.5

- Adds level 1 Weapon Mastery selection for 2024 classes that receive weapon masteries.
- Uses the dnd5e Compendium Browser to choose weapon items, then writes those mastery choices to the actor weapon mastery trait.

## 1.2.2

- Weapon Mastery selection now shows a curated base-weapon list instead of every weapon item in the compendiums.
- Duplicate reprints, premades, magic weapons, and creature attacks are collapsed/filtered out of the mastery picker.
- Selected weapon mastery weapons are now added to the actor as weapon items as well as written to the actor's weapon mastery trait.


## 1.2.2

- Removed the module spell-selection step. Spell selection is now left entirely to the built-in dnd5e class advancement workflow so duplicate automation/rider spell items from third-party modules are not shown in this builder.


## v1.2.11

- Added a Languages step for choosing two additional languages.
- Filters/rejects standalone lineage/subspecies entries so players choose the main species entry instead.


## v1.2.11

- Ensures Common is added to created/updated actors as the baseline language while still asking players to choose only two additional languages.


## 1.2.11

- Species choices now confirm and advance automatically.
- Browser-based background/class picks now confirm and advance automatically.
- Level 1 spell rows use adjacent Description/Choose buttons.
- Once the required number of level 1 spells is selected, the builder confirms the selection and advances.
- Species and spell lists are laid out more compactly so players do not need to scroll to the footer after choosing.


## 1.2.11


## Version 1.2.12

- Removed the builder token art selection/upload functionality.
- Character art/token images should be handled directly on the completed actor sheet or by the GM.


## Version 1.5.4 notes
- Human extra origin feat options now scan official dnd5e/PHB/Free Rules feat compendiums even when those packs are not otherwise selected for the builder.
- Magic Initiate naming variants such as parenthetical and colon formats are treated as the same origin feats.


- Background origin feats are handled by this builder instead of the built-in background origin feat selector.
- Human characters are prompted for one additional origin feat.
- The class import more aggressively suppresses built-in level 1 spellbook population prompts when this builder is handling level 1 spell choices.


## 1.5.4

- Human species choices now include one skill proficiency from the full skill list and one Human origin feat.
- Origin feat discovery now uses the dnd5e origin-feat subtype (`system.type.value === "feat"` and `system.type.subtype === "origin"`) while still excluding CPR/Gambit/premade/automation packs.
- Human species skill/origin advancement prompts are stripped from the imported Human species item so the builder handles those choices directly.


## 1.5.4

- Replaced the generic equipment picker with class/background starting equipment choices.
- Added automatic level 1 class feature import from enabled official/sourcebook compendiums.
- Strips class equipment/feature choice advancement prompts so character creation stays in the builder instead of built-in or third-party popups.


## 1.5.4

- Stores selected species/background names so Human origin feat filtering can hide the background-granted origin feat reliably.
- Re-prompts to continue after Class Choices, Starting Equipment, Human Choices, and Languages become complete.
- Keeps the Starting Equipment step visible even when some equipment items cannot be matched in compendiums.
- Strips class advancements from the imported class item so built-in/third-party class prompts do not take over after the builder handles level-1 setup.


## 1.5.4
- Starting Equipment now presents full class packages instead of piecemeal gear subchoices.
- Level 1 hit points are set automatically from class hit die + Constitution modifier.
- Selected weapon masteries are also added as visible feat entries while still updating the actor mastery trait.


## 1.5.9

- Fixed Background Ability Scores dropdowns/checkboxes not populating because the template expected `options` while the data helper returned `allowed`.
- +2/+1 and +1/+1/+1 background ASI choices now show the selected background's three allowed abilities correctly.

## 1.5.7

- Class skill choices hide skills already granted by the selected 2024 background.
- Starting equipment package choices are displayed one package per line for readability.
- The spell step now handles both cantrips and level 1 spells, with Description/Choose controls for each spell item.
- Selected cantrips and selected level 1 spells are imported by the builder; built-in class spell prompts remain suppressed.


## v1.5.7

- Added a Background Ability Scores step for 2024 backgrounds.
- Players choose +2/+1 or +1/+1/+1 from the selected background abilities.
- Background ability-score advancement prompts are stripped from the imported background copy so the builder owns that step.


## 1.6.10
- Improved dropdown option readability across GUI themes.


## 1.6.10

- Added module-handled 2024 species option steps for Dragonborn ancestry, Elf lineage, Gnome lineage, Tiefling legacy, and Goliath giant ancestry.
- These steps appear only for the selected species and are used because species advancement prompts are suppressed.



## 1.6.13

- Added first-pass Artificer support to the module-owned level 1 flow.
- Artificer now has class skills, hit die, cantrip/level 1 spell prompts, starting equipment packages, and level 1 feature import.
- Artificer level 1 features now include Magical Tinkering and Spellcasting when those feat items exist in enabled/sourcebook compendiums.

## 1.6.11

- Removed parent language category groups such as D&D Beyond Rare Languages from the player language picker.


## 1.7.29

- Reworked Character Creation Sources into separate per-content-type compendium selections.
- GMs can now choose multiple packs independently for Species, Backgrounds, Classes, Class Features/Invocations, Feats, Spells, and Equipment/Tools.
- The builder loads the union of those selected packs, then filters each option list by its own configured source category.
- Kept the class normalization behavior: the actor class item still imports from `dnd5e.classes` when a matching canonical class exists, with fallback to the selected class source when it does not.


## 1.7.30

- Removed player-facing class normalization/source text from the class confirmation dialog while retaining canonical `dnd5e.classes` import behavior.
