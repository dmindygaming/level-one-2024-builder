import { MODULE_ID, CLASS_LEVEL1_FEATURES_2024, SPECIES_LEVEL1_FEATURES_2024 } from "../data/constants.js";
import { getGuiTheme, getThemeInlineStyle, applyThemeToWindow } from "../core/gui-theme.js";
import { scanConfiguredPacks } from "../core/compendium-resolver.js";
import { getOverride, setOverride, clearOverride, OVERRIDE_CONTEXT } from "../core/overrides.js";
import { slug, titleCase } from "../core/util.js";

/**
 * Lets a GM pin the exact compendium item used for a specific class or
 * species level-1 feature, overriding the automatic (but still
 * strictly-scoped-to-configured-packs) resolution. Useful when a table runs
 * several sourcebook modules that legitimately both provide a feature with
 * the same name (e.g. two different "Fighting Style" implementations).
 */
export class LevelOne2024OverrideSettings extends FormApplication {
  constructor(...args) {
    super(...args);
    this.selectedType = "class";
    this.selectedKey = Object.keys(CLASS_LEVEL1_FEATURES_2024)[0];
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "level-one-2024-overrides",
      title: "Level One 2024 Builder: Feature Overrides",
      template: `modules/${MODULE_ID}/templates/overrides.hbs`,
      width: 640,
      height: "auto",
      resizable: true,
      classes: ["level-one-2024-builder", "level-one-2024-overrides"]
    });
  }

  async _render(force, options) {
    await super._render(force, options);
    applyThemeToWindow(this);
  }

  _namesTable() {
    return this.selectedType === "class" ? CLASS_LEVEL1_FEATURES_2024 : SPECIES_LEVEL1_FEATURES_2024;
  }

  _sourceType() {
    return this.selectedType === "class" ? "classFeatures" : "speciesFeatures";
  }

  _contextKey() {
    return this.selectedType === "class"
      ? OVERRIDE_CONTEXT.classFeature(this.selectedKey)
      : OVERRIDE_CONTEXT.speciesFeature(this.selectedKey);
  }

  async getData() {
    const namesTable = this._namesTable();
    const keys = Object.keys(namesTable);
    if (!keys.includes(this.selectedKey)) this.selectedKey = keys[0];
    const names = namesTable[this.selectedKey] ?? [];
    const sourceType = this._sourceType();
    const contextKey = this._contextKey();

    const rows = [];
    for (const name of names) {
      const candidates = await scanConfiguredPacks(sourceType, {
        itemTypes: ["feat"],
        predicate: candidate => slug(candidate.name) === slug(name)
      });
      const current = getOverride(contextKey, name) ?? "__auto__";
      rows.push({
        name,
        fieldName: `override__${slug(name)}`,
        options: [
          { uuid: "__auto__", label: "Auto (best match in configured packs)", selected: current === "__auto__" },
          ...candidates.map(c => ({ uuid: c.uuid, label: `${c.name} — ${c.pack}`, selected: c.uuid === current }))
        ],
        noCandidates: candidates.length === 0
      });
    }

    const guiTheme = getGuiTheme();
    return {
      guiTheme,
      themeClass: `l12024b-theme-${guiTheme}`,
      themeInlineStyle: getThemeInlineStyle(guiTheme),
      types: [
        { key: "class", label: "Class", selected: this.selectedType === "class" },
        { key: "species", label: "Species", selected: this.selectedType === "species" }
      ],
      keys: keys.map(key => ({ key, label: titleCase(key), selected: key === this.selectedKey })),
      rows,
      sourceTypeLabel: this.selectedType === "class" ? "Class Features / Invocations" : "Species Features"
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("select[name='contextType']").on("change", ev => {
      this.selectedType = ev.currentTarget.value;
      this.selectedKey = Object.keys(this._namesTable())[0];
      this.render(false);
    });
    html.find("select[name='contextKeySelect']").on("change", ev => {
      this.selectedKey = ev.currentTarget.value;
      this.render(false);
    });
  }

  async _updateObject(_event, formData) {
    const namesTable = this._namesTable();
    const names = namesTable[this.selectedKey] ?? [];
    const contextKey = this._contextKey();
    for (const name of names) {
      const field = `override__${slug(name)}`;
      const value = formData[field];
      if (!value || value === "__auto__") await clearOverride(contextKey, name);
      else await setOverride(contextKey, name, value);
    }
    ui.notifications.info(`Saved feature overrides for ${titleCase(this.selectedKey)}.`);
  }
}
