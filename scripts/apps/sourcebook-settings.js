import { MODULE_ID } from "../data/constants.js";
import { getGuiTheme, getThemeInlineStyle, applyThemeToWindow } from "../core/gui-theme.js";
import {
  SOURCE_TYPE_SETTINGS,
  SOURCE_TYPE_ORDER,
  parseSourceTypePackSetting,
  sourceTypeSelectionMode,
  discoverDnd5eItemPacks,
  sourcebookNote,
  isLikelyDnd5eCharacterSource,
  automaticPackIds
} from "../core/source-types.js";

export class LevelOne2024SourcebookSettings extends FormApplication {
  static get sourceTypeKey() { return null; }

  static get defaultOptions() {
    const key = this.sourceTypeKey;
    const config = key ? SOURCE_TYPE_SETTINGS[key] : null;
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: key ? `level-one-2024-sourcebooks-${key}` : "level-one-2024-sourcebooks",
      title: config ? `Level One 2024 ${config.label} Sources` : "Level One 2024 Builder Sources",
      template: `modules/${MODULE_ID}/templates/sourcebooks.hbs`,
      width: 760,
      height: "auto",
      resizable: true,
      classes: ["level-one-2024-builder", "level-one-2024-sourcebooks"]
    });
  }

  _sourceTypeKeys() {
    const key = this.constructor.sourceTypeKey;
    return key ? [key] : SOURCE_TYPE_ORDER;
  }

  getData() {
    const packs = discoverDnd5eItemPacks();
    const selections = parseSourceTypePackSetting(game.settings.get(MODULE_ID, "selectedPacksByContentType") || "");
    const legacyMode = game.settings.get(MODULE_ID, "selectedItemPacks") || "__auto__";
    const guiTheme = getGuiTheme();
    const automaticIds = automaticPackIds(packs);
    const keys = this._sourceTypeKeys();
    const singleSourceType = keys.length === 1;
    const sourceTypes = keys.map(key => {
      const value = selections[key];
      const autoMode = sourceTypeSelectionMode(value) === "auto";
      const selected = new Set(autoMode ? automaticIds : (Array.isArray(value) ? value : []));
      const config = SOURCE_TYPE_SETTINGS[key];
      return {
        key,
        label: config.label,
        autoMode,
        selectedCount: selected.size,
        packs: packs.map(pack => {
          const label = pack.metadata.label ?? pack.title ?? pack.collection;
          const note = sourcebookNote(pack);
          const packageName = pack.metadata.packageName ?? "";
          const system = pack.metadata.system ?? "";
          return {
            id: pack.collection,
            inputName: `${key}.${pack.collection}`,
            label,
            packageName,
            system,
            checked: selected.has(pack.collection),
            recommended: isLikelyDnd5eCharacterSource(pack),
            note,
            searchText: [label, pack.collection, packageName, system, note].filter(Boolean).join(" ").toLowerCase()
          };
        })
      };
    });
    return {
      guiTheme,
      themeClass: `l12024b-theme-${guiTheme}`,
      themeInlineStyle: getThemeInlineStyle(guiTheme),
      sourceTypes,
      singleSourceType,
      sourceTitle: singleSourceType ? sourceTypes[0]?.label : "Character Creation",
      automaticCount: automaticIds.length,
      legacyMode
    };
  }

  async _render(force, options) {
    await super._render(force, options);
    applyThemeToWindow(this);
  }

  activateListeners(html) {
    super.activateListeners(html);
    const setSectionAuto = (section, value) => {
      html.find(`input[name='auto-${section}']`).prop("checked", value);
    };
    html.find("[data-action='select-recommended']").on("click", ev => {
      ev.preventDefault();
      const section = ev.currentTarget.dataset.section;
      const ids = new Set(automaticPackIds(discoverDnd5eItemPacks()));
      html.find(`input[data-pack][data-section='${section}']`).each((_, el) => { el.checked = ids.has(el.value); });
      setSectionAuto(section, false);
    });
    html.find("[data-action='select-all']").on("click", ev => {
      ev.preventDefault();
      const section = ev.currentTarget.dataset.section;
      html.find(`input[data-pack][data-section='${section}']`).prop("checked", true);
      setSectionAuto(section, false);
    });
    html.find("[data-action='select-none']").on("click", ev => {
      ev.preventDefault();
      const section = ev.currentTarget.dataset.section;
      html.find(`input[data-pack][data-section='${section}']`).prop("checked", false);
      setSectionAuto(section, false);
    });
    html.find("[data-action='clear-search']").on("click", ev => {
      ev.preventDefault();
      const section = ev.currentTarget.dataset.section;
      const input = html.find(`input[data-source-search='${section}']`);
      input.val("").trigger("input");
      input.trigger("focus");
    });
    html.find("input[data-source-search]").on("input", ev => {
      const section = ev.currentTarget.dataset.sourceSearch;
      const query = String(ev.currentTarget.value ?? "").trim().toLowerCase();
      html.find(`.l12024b-pack-row[data-section='${section}']`).each((_, row) => {
        const text = String(row.dataset.search ?? "").toLowerCase();
        row.hidden = Boolean(query) && !text.includes(query);
      });
    });
  }

  async _updateObject(_event, formData) {
    const selections = parseSourceTypePackSetting(game.settings.get(MODULE_ID, "selectedPacksByContentType") || "");
    for (const key of this._sourceTypeKeys()) {
      const autoMode = Boolean(formData[`auto-${key}`]);
      if (autoMode) {
        selections[key] = "__auto__";
        continue;
      }

      const flatIds = Object.entries(formData)
        .filter(([field, value]) => field.startsWith(`packsel-${key}-`) && value)
        .map(([_field, value]) => String(value));
      selections[key] = [...new Set(flatIds)];
    }
    await game.settings.set(MODULE_ID, "selectedPacksByContentType", JSON.stringify(selections, null, 2));

    // Keep the legacy single-source setting in manual mode with the union of all
    // manual selections so older worlds/macros still see a useful value. The
    // builder itself reads selectedPacksByContentType first.
    const union = new Set();
    let allAuto = true;
    for (const value of Object.values(selections)) {
      if (value !== "__auto__") {
        allAuto = false;
        for (const id of value) union.add(id);
      }
    }
    await game.settings.set(MODULE_ID, "selectedItemPacks", allAuto ? "__auto__" : JSON.stringify([...union]));
    ui.notifications.info("Level One 2024 Builder source compendiums saved by content type.");
  }
}

export function createSourcebookSettingsClass(sourceTypeKey) {
  return class LevelOne2024SingleSourcebookSettings extends LevelOne2024SourcebookSettings {
    static get sourceTypeKey() { return sourceTypeKey; }
  };
}
