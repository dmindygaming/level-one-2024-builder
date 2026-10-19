import { MODULE_ID, GUI_THEMES } from "../data/constants.js";
import { SOURCE_TYPE_SETTINGS, SOURCE_TYPE_ORDER, defaultSourceTypeSelections } from "./source-types.js";
import { defaultBuiltinAbilityMethodIds } from "./ability-methods.js";
import { createSourcebookSettingsClass, LevelOne2024SourcebookSettings } from "../apps/sourcebook-settings.js";
import { LevelOne2024AbilityMethodSettings } from "../apps/ability-method-settings.js";
import { LevelOne2024FolderSettings } from "../apps/folder-settings.js";
import { LevelOne2024OverrideSettings } from "../apps/override-settings.js";

export function registerSettings() {
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("includes", (arr, val) => Array.isArray(arr) && arr.includes(val));
  Handlebars.registerHelper("checked", value => value ? "checked" : "");
  Handlebars.registerHelper("selected", value => value ? "selected" : "");

  // Backward-compatible hidden raw override from v0.1.x. Prefer the Sourcebook Picker menu below.
  game.settings.register(MODULE_ID, "allowedItemPacks", {
    name: "Allowed Character Creation Compendiums",
    hint: "Legacy comma-separated Item compendium IDs. The Sourcebook Picker is preferred.",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.register(MODULE_ID, "selectedItemPacks", {
    name: "Selected Character Creation Sources",
    hint: "JSON list of selected Item compendium IDs, or __auto__ to automatically use installed dnd5e sourcebook packs.",
    scope: "world",
    config: false,
    type: String,
    default: "__auto__"
  });

  game.settings.register(MODULE_ID, "selectedPacksByContentType", {
    name: "Selected Character Creation Sources by Content Type",
    hint: "JSON map of source category to selected Item compendium IDs. Each category can be __auto__ or a list of pack IDs.",
    scope: "world",
    config: false,
    type: String,
    default: JSON.stringify(defaultSourceTypeSelections())
  });

  game.settings.register(MODULE_ID, "guiTheme", {
    name: "Builder GUI Theme",
    hint: "Choose the visual theme used by the character builder window.",
    scope: "world",
    config: true,
    type: String,
    choices: GUI_THEMES,
    default: "parchment"
  });

  game.settings.register(MODULE_ID, "normalizeClassesToSystemPack", {
    name: "Normalize Classes to dnd5e.classes",
    hint: "Legacy setting retained for existing worlds. Classes now always import from dnd5e.classes when the matching canonical class exists; if no match exists, the selected class source is used.",
    scope: "world",
    config: false,
    type: Boolean,
    default: true
  });

  for (const key of SOURCE_TYPE_ORDER) {
    const config = SOURCE_TYPE_SETTINGS[key];
    const suffix = key.charAt(0).toUpperCase() + key.slice(1);
    game.settings.registerMenu(MODULE_ID, `sourcebookPicker${suffix}`, {
      name: `${config.label} Sources`,
      label: `Configure ${config.label}`,
      hint: `Choose one or more Item compendiums used for ${config.label.toLowerCase()}. Use Automatic detection or manually select the packs that contain this content.`,
      icon: "fas fa-book-open",
      type: createSourcebookSettingsClass(key),
      restricted: true
    });
  }

  game.settings.register(MODULE_ID, "featureOverrides", {
    name: "Pinned Feature Overrides",
    hint: "JSON map of context -> feature name -> exact Compendium item UUID. Use the Feature Overrides menu instead of editing directly.",
    scope: "world",
    config: false,
    type: String,
    default: "{}"
  });

  game.settings.registerMenu(MODULE_ID, "featureOverridePicker", {
    name: "Feature Overrides",
    label: "Configure Overrides",
    hint: "Pin the exact compendium item used for a specific class or species level-1 feature.",
    icon: "fas fa-thumbtack",
    type: LevelOne2024OverrideSettings,
    restricted: true
  });

  game.settings.register(MODULE_ID, "enabledBuiltinAbilityMethods", {
    name: "Enabled Built-in Ability Methods",
    hint: "JSON list of built-in ability generation method IDs enabled in the builder. Use the Ability Score Methods menu instead of editing directly.",
    scope: "world",
    config: false,
    type: String,
    default: JSON.stringify(defaultBuiltinAbilityMethodIds())
  });

  game.settings.register(MODULE_ID, "manualAbilityMethodMigrationDone", {
    name: "Manual Ability Method Migration Done",
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "customAbilityMethods", {
    name: "Custom Ability Score Methods",
    hint: "JSON list of custom ability score generation methods. Use the Ability Score Methods menu instead of editing directly.",
    scope: "world",
    config: false,
    type: String,
    default: JSON.stringify([], null, 2)
  });

  game.settings.register(MODULE_ID, "enabledCustomAbilityMethods", {
    name: "Enabled Custom Ability Methods",
    hint: "JSON list of custom ability generation method IDs enabled in the builder. Use the Ability Score Methods menu instead of editing directly.",
    scope: "world",
    config: false,
    type: String,
    default: "__all__"
  });

  game.settings.registerMenu(MODULE_ID, "abilityMethodPicker", {
    name: "Ability Score Generation Methods",
    label: "Configure Methods",
    hint: "Hide built-in methods or add custom array, roll formula, or point-buy methods.",
    icon: "fas fa-dice-d20",
    type: LevelOne2024AbilityMethodSettings,
    restricted: true
  });

  game.settings.register(MODULE_ID, "playersCanCreateActors", {
    name: "Players Can Create Actors",
    hint: "Allow trusted players to create a new character actor from the builder. If disabled, only GMs can use the create mode.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "characterFolderId", {
    name: "Character Actor Folder",
    hint: "Folder ID where newly-created character actors are stored. Use the Character Actor Folder menu to choose a folder.",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.registerMenu(MODULE_ID, "characterFolderPicker", {
    name: "Character Actor Folder",
    label: "Choose Folder",
    hint: "Choose the actor folder where newly-created character sheets should be stored.",
    icon: "fas fa-folder-open",
    type: LevelOne2024FolderSettings,
    restricted: true
  });
}
