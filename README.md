# Level One 2024 Character Builder

Current version: v1.10.11

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

A Foundry VTT v13 / dnd5e 5.x module for 2024-only level 1 character creation.

## What it does

- Creates a new real dnd5e character actor, or updates an existing character actor assigned by the GM.
- Supports these ability methods:
  - Standard Array
  - Point Buy
  - 4d6 drop lowest
  - 2d6+6, reroll 1s and 2s
- Prompts in 2024 order:
  - Actor: create new or use an existing owned actor
  - Name
  - Ability Scores Generation
  - Species
  - Background
  - Origin Feats
  - Class
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

Then enable **Level One 2024 Character Builder** in your world.

## Sourcebook setup

By default, the module uses **Automatic sourcebook detection**. It searches active Item compendiums for installed dnd5e sources, including the 2024 Player's Handbook package if it is installed and enabled in the world.

To choose sources manually:

1. Open **Configure Settings**.
2. Go to **Module Settings**.
3. Open **Level One 2024 Character Builder → Character Creation Sources**.
4. Check the sourcebook/item compendiums the builder should use.
5. Save.

You can also open the same menu from inside the builder with the **Sources** button.

## Launching

- Actor Directory footer button: **2024 Character Builder**
- Character actor sheet header button: **2024 Builder**
- Character actor directory right-click menu: **2024 Character Builder**
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
- No equipment package automation yet.
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
  `Configure Settings → Module Settings → Level One 2024 Character Builder → Ability Score Generation Methods`.
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
