import { MODULE_ID, ACTIVE_BUILDERS } from "./data/constants.js";
import { registerSettings } from "./core/settings.js";
import { registerDialogTheming } from "./core/gui-theme.js";
import { getEnabledBuiltinAbilityMethodIds } from "./core/ability-methods.js";
import { discoverDnd5eItemPacks } from "./core/source-types.js";
import { openLevelOne2024Builder, LevelOne2024Builder } from "./apps/builder-app.js";
import { LevelOne2024SourcebookSettings } from "./apps/sourcebook-settings.js";
import { LevelOne2024AbilityMethodSettings } from "./apps/ability-method-settings.js";
import { LevelOne2024FolderSettings } from "./apps/folder-settings.js";
import { LevelOne2024OverrideSettings } from "./apps/override-settings.js";

Hooks.once("init", () => {
  registerSettings();
  registerDialogTheming();
});

Hooks.once("ready", async () => {
  if (game.system.id !== "dnd5e") {
    ui.notifications.warn("Level One 2024 Character Builder is intended for the dnd5e system.");
  }

  if (game.user.isGM && !game.settings.get(MODULE_ID, "manualAbilityMethodMigrationDone")) {
    const enabled = getEnabledBuiltinAbilityMethodIds();
    if (!enabled.includes("manual")) {
      enabled.push("manual");
      await game.settings.set(MODULE_ID, "enabledBuiltinAbilityMethods", JSON.stringify(enabled));
    }
    await game.settings.set(MODULE_ID, "manualAbilityMethodMigrationDone", true);
  }

  game.socket?.on(`module.${MODULE_ID}`, async data => {
    if (data?.type === "rerollApproved") {
      if (data.userId !== game.user.id) return;

      const builder = [...ACTIVE_BUILDERS.values()].find(app => {
        return app.build?.rerollRequestPending && app.build?.pendingRerollMethod === data.method;
      });

      if (!builder) {
        ui.notifications.warn("A reroll was approved, but no open Level One 2024 Builder was found.");
        return;
      }

      ui.notifications.info("The GM approved your ability score reroll.");
      builder._performRollScores(data.method, { approved: true });
      return;
    }
  });
});

Hooks.on("renderChatMessage", (message, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root || !game.user.isGM) return;

  root.querySelectorAll("[data-l12024-reroll-approve]").forEach(button => {
    button.addEventListener("click", async event => {
      event.preventDefault();
      const userId = button.dataset.userId;
      const method = button.dataset.method;
      if (!userId || !method) return;

      await game.socket?.emit(`module.${MODULE_ID}`, {
        type: "rerollApproved",
        userId,
        method
      });

      ui.notifications.info("Reroll approval sent.");
    });
  });
});

Hooks.on("getActorDirectoryEntryContext", (html, options) => {
  options.push({
    name: "2024 Character Builder",
    icon: '<i class="fas fa-user-plus"></i>',
    condition: li => {
      const actor = game.actors.get(li.data("documentId"));
      return actor?.type === "character" && actor.isOwner;
    },
    callback: li => {
      const actor = game.actors.get(li.data("documentId"));
      openLevelOne2024Builder(actor);
    }
  });
});

Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  if (sheet.actor?.type !== "character" || !sheet.actor.isOwner) return;
  buttons.unshift({
    label: "2024 Builder",
    class: "level-one-2024-builder",
    icon: "fas fa-user-plus",
    onclick: () => openLevelOne2024Builder(sheet.actor)
  });
});

globalThis.LevelOne2024Builder = LevelOne2024Builder;
globalThis.LevelOne2024BuilderAPI = {
  open: openLevelOne2024Builder,
  sources: () => new LevelOne2024SourcebookSettings().render(true),
  abilityMethods: () => new LevelOne2024AbilityMethodSettings().render(true),
  folder: () => new LevelOne2024FolderSettings().render(true),
  overrides: () => new LevelOne2024OverrideSettings().render(true),
  detectedPacks: () => discoverDnd5eItemPacks().map(p => ({ id: p.collection, label: p.metadata.label, packageName: p.metadata.packageName, system: p.metadata.system }))
};
