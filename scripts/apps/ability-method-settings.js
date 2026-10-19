import { MODULE_ID } from "../data/constants.js";
import { BUILTIN_ABILITY_METHODS } from "../data/constants.js";
import { getGuiTheme, getThemeInlineStyle, applyThemeToWindow } from "../core/gui-theme.js";
import { safeParseJson } from "../core/util.js";
import {
  getEnabledBuiltinAbilityMethodIds,
  getCustomAbilityMethods,
  getEnabledCustomAbilityMethodIds,
  sanitizeAbilityMethodId,
  normalizeCustomAbilityMethod
} from "../core/ability-methods.js";

export class LevelOne2024AbilityMethodSettings extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "level-one-2024-ability-methods",
      title: "Ability Score Generation Methods",
      template: `modules/${MODULE_ID}/templates/ability-methods.hbs`,
      width: 760,
      height: "auto",
      resizable: true,
      classes: ["level-one-2024-builder", "level-one-2024-ability-methods"]
    });
  }

  async _render(force, options) {
    await super._render(force, options);
    applyThemeToWindow(this);
  }

  getData() {
    const enabled = new Set(getEnabledBuiltinAbilityMethodIds());
    const customMethods = getCustomAbilityMethods();
    const enabledCustom = new Set(getEnabledCustomAbilityMethodIds(customMethods));
    const customRaw = game.settings.get(MODULE_ID, "customAbilityMethods") || "[]";
    const guiTheme = getGuiTheme();
    return {
      guiTheme,
      themeClass: `l12024b-theme-${guiTheme}`,
      themeInlineStyle: getThemeInlineStyle(guiTheme),
      builtins: Object.values(BUILTIN_ABILITY_METHODS).map(method => ({
        id: method.id,
        label: method.label,
        type: method.type,
        checked: enabled.has(method.id)
      })),
      customMethods: customMethods.map(method => ({
        id: method.id,
        label: method.label,
        type: method.type,
        checked: enabledCustom.has(method.id)
      })),
      customRaw,
      examples: JSON.stringify([
        { "id": "heroic-array", "label": "Heroic Array", "type": "array", "scores": [16, 15, 14, 13, 12, 10] },
        { "id": "3d6-straight", "label": "3d6 Straight", "type": "roll", "formula": "3d6" },
        { "id": "heroic-point-buy", "label": "Heroic Point Buy", "type": "pointbuy", "points": 32, "min": 8, "max": 16, "costs": { "8": 0, "9": 1, "10": 2, "11": 3, "12": 4, "13": 5, "14": 7, "15": 9, "16": 12 } }
      ], null, 2)
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    const updateSimpleSections = () => {
      const type = html.find("select[name='simpleType']").val() || "array";
      html.find("[data-simple-section]").each((_i, el) => {
        el.hidden = el.dataset.simpleSection !== type;
      });
    };

    const readCustomMethods = () => {
      const textarea = html.find("textarea[name='customAbilityMethods']");
      const raw = String(textarea.val() ?? "[]").trim() || "[]";
      const parsed = safeParseJson(raw, null);
      if (!Array.isArray(parsed)) {
        ui.notifications.error("The Custom Methods JSON is not valid yet. Fix it or clear it before adding another method.");
        return null;
      }
      return parsed;
    };

    const writeCustomMethods = methods => {
      html.find("textarea[name='customAbilityMethods']").val(JSON.stringify(methods, null, 2));
    };

    const parseNumberList = raw => String(raw ?? "")
      .split(/[ ,]+/)
      .map(part => part.trim())
      .filter(Boolean)
      .map(Number);

    const parseCosts = raw => {
      const costs = {};
      for (const part of String(raw ?? "").split(",")) {
        const [scoreRaw, costRaw] = part.split(":").map(s => s?.trim());
        if (!scoreRaw || costRaw === undefined) continue;
        const score = Number(scoreRaw);
        const cost = Number(costRaw);
        if (Number.isInteger(score) && Number.isFinite(cost)) costs[String(score)] = cost;
      }
      return costs;
    };

    html.find("select[name='simpleType']").on("change", updateSimpleSections);
    updateSimpleSections();

    const buildSimpleMethodFromForm = () => {
      const label = String(html.find("input[name='simpleLabel']").val() ?? "").trim();
      const type = String(html.find("select[name='simpleType']").val() ?? "array");
      if (!label) return null;

      let method = { id: sanitizeAbilityMethodId(label), label, type };

      if (type === "array") {
        method.scores = parseNumberList(html.find("input[name='simpleScores']").val());
      } else if (type === "roll") {
        method.formula = String(html.find("input[name='simpleFormula']").val() ?? "").trim();
      } else if (type === "pointbuy") {
        method.points = Number(html.find("input[name='simplePoints']").val() ?? 27);
        method.min = Number(html.find("input[name='simpleMin']").val() ?? 8);
        method.max = Number(html.find("input[name='simpleMax']").val() ?? 15);
        method.costs = parseCosts(html.find("input[name='simpleCosts']").val());
      }

      return normalizeCustomAbilityMethod(method);
    };

    const mergeSimpleMethodIntoTextarea = ({ requireLabel = true } = {}) => {
      const label = String(html.find("input[name='simpleLabel']").val() ?? "").trim();
      if (!label) {
        if (requireLabel) ui.notifications.warn("Enter a method name first.");
        return false;
      }

      const methods = readCustomMethods();
      if (!methods) return false;

      const normalized = buildSimpleMethodFromForm();
      if (!normalized) {
        ui.notifications.error("That custom method is not valid. Check the fields for the selected type.");
        return false;
      }

      const existingIndex = methods.findIndex(existing => sanitizeAbilityMethodId(existing.id || existing.label) === normalized.id);
      if (existingIndex >= 0) methods[existingIndex] = normalized;
      else methods.push(normalized);

      writeCustomMethods(methods);
      ui.notifications.info(`${normalized.label} added to Custom Methods. Click Save Methods to keep it.`);
      return true;
    };

    html.find("[data-action='addSimpleMethod']").on("click", ev => {
      ev.preventDefault();
      mergeSimpleMethodIntoTextarea({ requireLabel: true });
    });

    html.find("[data-action='clearSimpleMethod']").on("click", ev => {
      ev.preventDefault();
      html.find("input[name='simpleLabel']").val("");
      html.find("input[name='simpleScores']").val("");
      html.find("input[name='simpleFormula']").val("");
      html.find("input[name='simplePoints']").val("27");
      html.find("input[name='simpleMin']").val("8");
      html.find("input[name='simpleMax']").val("15");
      html.find("input[name='simpleCosts']").val("8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9");
    });

    html.find("[data-action='formatCustomMethods']").on("click", ev => {
      ev.preventDefault();
      const methods = readCustomMethods();
      if (!methods) return;
      writeCustomMethods(methods);
    });

    html.find("[data-action='pasteExampleMethods']").on("click", ev => {
      ev.preventDefault();
      const textarea = html.find("textarea[name='customAbilityMethods']");
      textarea.val(this.getData().examples);
    });
  }

  async _updateObject(_event, formData) {
    const enabled = [];
    for (const id of Object.keys(BUILTIN_ABILITY_METHODS)) {
      if (formData[`builtin.${id}`]) enabled.push(id);
    }
    if (!enabled.length) throw new Error("At least one built-in ability score method must remain enabled.");

    const previousCustomMethods = getCustomAbilityMethods();
    const previousCustomIds = new Set(previousCustomMethods.map(method => method.id));

    let customRaw = String(formData.customAbilityMethods ?? "[]").trim() || "[]";
    let parsed = safeParseJson(customRaw, null);
    if (!Array.isArray(parsed)) throw new Error("Custom ability methods must be a JSON array.");

    // DM-friendly path: if the simple builder fields are filled out and the DM clicks
    // Save Methods without first clicking Add Method, save that simple method too.
    const simpleLabel = String(formData.simpleLabel ?? "").trim();
    if (simpleLabel) {
      const simpleType = String(formData.simpleType ?? "array");
      const simpleMethod = { id: sanitizeAbilityMethodId(simpleLabel), label: simpleLabel, type: simpleType };

      if (simpleType === "array") {
        simpleMethod.scores = String(formData.simpleScores ?? "")
          .split(/[ ,]+/)
          .map(part => part.trim())
          .filter(Boolean)
          .map(Number);
      } else if (simpleType === "roll") {
        simpleMethod.formula = String(formData.simpleFormula ?? "").trim();
      } else if (simpleType === "pointbuy") {
        simpleMethod.points = Number(formData.simplePoints ?? 27);
        simpleMethod.min = Number(formData.simpleMin ?? 8);
        simpleMethod.max = Number(formData.simpleMax ?? 15);
        const costs = {};
        for (const part of String(formData.simpleCosts ?? "").split(",")) {
          const [scoreRaw, costRaw] = part.split(":").map(s => s?.trim());
          if (!scoreRaw || costRaw === undefined) continue;
          const score = Number(scoreRaw);
          const cost = Number(costRaw);
          if (Number.isInteger(score) && Number.isFinite(cost)) costs[String(score)] = cost;
        }
        simpleMethod.costs = costs;
      }

      const normalizedSimple = normalizeCustomAbilityMethod(simpleMethod, parsed.length);
      if (!normalizedSimple) {
        throw new Error("The simple custom method is not valid. Check its name, scores/formula, or point-buy fields.");
      }

      const existingIndex = parsed.findIndex(existing => sanitizeAbilityMethodId(existing.id || existing.label) === normalizedSimple.id);
      if (existingIndex >= 0) parsed[existingIndex] = normalizedSimple;
      else parsed.push(normalizedSimple);
    }

    const normalized = parsed.map(normalizeCustomAbilityMethod).filter(Boolean);
    if (normalized.length !== parsed.length) {
      ui.notifications.warn("Some custom ability methods were invalid and were not saved. Check type, label, scores/formula, and point-buy configuration.");
    }

    const enabledCustom = [];
    for (const method of normalized) {
      if (!previousCustomIds.has(method.id) || formData[`custom.${method.id}`]) enabledCustom.push(method.id);
    }

    await game.settings.set(MODULE_ID, "enabledBuiltinAbilityMethods", JSON.stringify(enabled));
    await game.settings.set(MODULE_ID, "customAbilityMethods", JSON.stringify(normalized, null, 2));
    await game.settings.set(MODULE_ID, "enabledCustomAbilityMethods", JSON.stringify(enabledCustom));
    ui.notifications.info("Ability score generation methods updated.");
  }
}
