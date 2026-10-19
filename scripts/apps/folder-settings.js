import { MODULE_ID } from "../data/constants.js";
import { getGuiTheme, getThemeInlineStyle, applyThemeToWindow } from "../core/gui-theme.js";

export class LevelOne2024FolderSettings extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "level-one-2024-folder-settings",
      title: "Level One 2024 Builder: Character Actor Folder",
      template: `modules/${MODULE_ID}/templates/folder-settings.hbs`,
      classes: ["level-one-2024-builder", "level-one-2024-folder-settings"],
      width: 520,
      height: "auto",
      closeOnSubmit: true
    });
  }

  async _render(force, options) {
    await super._render(force, options);
    applyThemeToWindow(this);
  }

  getData() {
    const selected = game.settings.get(MODULE_ID, "characterFolderId") ?? "";
    const folders = game.folders
      .filter(folder => folder.type === "Actor")
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(folder => ({ id: folder.id, name: folder.name, selected: folder.id === selected }));
    const selectedFolder = selected ? game.folders.get(selected) : null;
    const guiTheme = getGuiTheme();
    return {
      selected,
      selectedFolderName: selectedFolder?.name ?? "None",
      folders,
      guiTheme,
      themeClass: `l12024b-theme-${guiTheme}`,
      themeInlineStyle: getThemeInlineStyle(guiTheme)
    };
  }

  async _updateObject(_event, formData) {
    await game.settings.set(MODULE_ID, "characterFolderId", formData.characterFolderId ?? "");
  }
}

export function configuredCharacterFolderId() {
  const folderId = game.settings.get(MODULE_ID, "characterFolderId") ?? "";
  if (!folderId) return "";
  const folder = game.folders.get(folderId);
  return folder?.type === "Actor" ? folder.id : "";
}
