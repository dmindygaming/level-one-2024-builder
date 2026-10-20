// ============================================================
// The Level One 2024 Character Builder wizard application, plus the small
// glue functions used to open it from the actor directory / sheet header.
// ============================================================

import {
  MODULE_ID, DND5E_CORE_CLASS_PACK_ID, ABILITIES, ABILITY_LABELS, STANDARD_ARRAY,
  POINT_BUY_COSTS, ACTIVE_BUILDERS, TIEFLING_LEGACIES_2024, DRAGONBORN_ANCESTRIES_2024,
  SPECIES_CHOICE_GROUPS_2024, BASE_WEAPON_MASTERIES_2024, CLASS_PROMPTS_2024,
  CLASS_BASE_PROFICIENCIES_2024, CLASS_HIT_DIE_2024, CLASS_LEVEL1_FEATURES_2024,
  SPECIES_LEVEL1_FEATURES_2024, SPECIES_FEATURE_FALLBACKS_2024, BACKGROUND_STARTING_EQUIPMENT_2024,
  CLASS_STARTING_EQUIPMENT_PACKAGES_2024, CLASS_LEVEL1_SPELLS_2024, CLASS_CANTRIPS_2024,
  BACKGROUND_SKILLS_2024, BACKGROUND_ABILITIES_2024, ORIGIN_FEAT_NAMES_2024, ORIGIN_FEAT_ALIASES_2024,
  BACKGROUND_ORIGIN_FEATS_2024, MAGIC_INITIATE_SOURCES_2024, BACKGROUND_TOOLS_2024, TOOL_KEY_ALIASES_2024,
  SKILLED_TOOL_OPTIONS_2024,
  SKILL_LABELS, DEFAULT_LANGUAGE_CHOICE_COUNT, DEFAULT_BASE_LANGUAGE
} from "../data/constants.js";
import { getGuiTheme, getThemeInlineStyle, applyThemeToWindow, themedDialogHtml, themedDialogOptions } from "../core/gui-theme.js";
import { suppressExternalBuilderPrompts, shouldSuppressExternalBuilderPrompt } from "../core/prompt-suppression.js";
import { getAbilityMethods, getAbilityMethod } from "../core/ability-methods.js";
import { scoreCounts, numericAssignedScores, arraysHaveSameScoreMultiset, gmWhisperIds } from "../core/util.js";
import { languageChoices } from "../core/languages.js";
import { isStandaloneLineageOption, mainSpeciesKey, detectSpeciesChoiceGroupKey, speciesSourceScore } from "../core/species-detection.js";
import {
  SOURCE_TYPE_SETTINGS, SOURCE_TYPE_ORDER, packIdsForSourceType, parseSourceTypePackSetting,
  sourceTypeSelectionMode, automaticPackIds
} from "../core/source-types.js";
import { resolveFeaturesByName, scanConfiguredPacks } from "../core/compendium-resolver.js";
import { getOverride, OVERRIDE_CONTEXT } from "../core/overrides.js";
import { configuredCharacterFolderId } from "./folder-settings.js";
import { LevelOne2024SourcebookSettings } from "./sourcebook-settings.js";

export class LevelOne2024Builder extends Application {
  constructor(options = {}) {
    super(options);
    this.targetActor = options.actor ?? null;
    this.step = 0;
    this.cache = { items: [], species: [], backgrounds: [], classes: [], spells: [], weapons: [], equipment: [], feats: [], invocations: [] };
    this.originFeatOptionsLoaded = false;
    this.originFeatOptionsLoading = null;
    // v1.20.3: tracks which <details class="l12024b-collapsible"> sections the
    // player has manually closed (Cantrips, Level 1 Spells, Pact of the Tome,
    // etc). This lives on the application instance, not this.build, because
    // it's pure UI state - it must survive this.render() (every spell pick
    // re-renders the whole form) without being written into the character
    // data or persisted between builder sessions. Without this, every section
    // was hard-coded "open" in the template, so collapsing one to reduce
    // clutter while working through a long list only lasted until the next
    // click, when the whole step re-rendered back to fully expanded.
    this.collapsedSections = new Set();
    const initialMethod = getAbilityMethods()[0];
    const initialScores = initialMethod.type === "array" ? [...initialMethod.scores] : [...STANDARD_ARRAY];
    this.build = {
      id: foundry.utils.randomID(),
      name: this.targetActor?.name ?? "",
      actorMode: this.targetActor ? "existing" : "new",
      selectedActorId: this.targetActor?.id ?? "",
      abilityMethod: initialMethod.id,
      rolledScores: [],
      rerollRequestPending: false,
      pendingRerollMethod: "",
      availableScores: initialMethod.type === "pointbuy" ? [] : [...initialScores],
      baseAbilities: ["pointbuy", "manual"].includes(initialMethod.type)
        ? Object.fromEntries(ABILITIES.map(ability => [ability, initialMethod.min ?? (initialMethod.type === "manual" ? 10 : 8)]))
        : Object.fromEntries(ABILITIES.map(ability => [ability, ""])),
      speciesUuid: "",
      speciesName: "",
      speciesChoiceGroupKey: "",
      tieflingLegacy: "",
      dragonbornAncestry: "",
      elfLineage: "",
      gnomeLineage: "",
      goliathAncestry: "",
      backgroundUuid: "",
      backgroundName: "",
      backgroundSkillKeys: [],
      backgroundToolNames: [],
      backgroundAbilityKeys: [],
      backgroundAsi: { mode: "2-1", plus2: "", plus1: "", plus1s: [] },
      classUuid: "",
      className: "",
      skillChoices: [],
      weaponMasteryUuids: [],
      cantripUuids: [],
      spellUuids: [],
      magicInitiateCantripUuids: [],
      magicInitiateSpellUuid: "",
      tomeCantripUuids: [],
      tomeRitualSpellUuids: [],
      invocationUuids: [],
      divineOrder: "",
      primalOrder: "",
      fightingStyle: "",
      equipmentUuids: [],
      equipmentChoiceSelections: {},
      originFeatUuids: [],
      humanSkillChoice: "",
      // v1.20.3: the Skilled origin feat ("proficiency in any combination of
      // three skills or tools of your choice") - see _skilledFeatData() and
      // the "Skilled Proficiencies" step. Each entry is "skill:<key>" or
      // "tool:<name>" so the combined skill/tool picker can tell them apart.
      skilledChoiceKeys: [],
      languageChoices: [],
      searches: {
        species: "",
        languages: "",
        cantrips: "",
        level1Spells: "",
        magicInitiateCantrips: "",
        magicInitiateSpell: "",
        tomeCantrips: "",
        tomeRitualSpells: ""
      }
    };

    ACTIVE_BUILDERS.set(this.build.id, this);
  }

  async close(options = {}) {
    ACTIVE_BUILDERS.delete(this.build.id);
    return super.close(options);
  }

  async _render(force, options) {
    await super._render(force, options);
    applyThemeToWindow(this);
    this._restoreSearchFocus();
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "level-one-2024-builder",
      title: "Level One 2024 Character Builder",
      template: `modules/${MODULE_ID}/templates/builder.hbs`,
      width: 820,
      height: "auto",
      resizable: true,
      classes: ["level-one-2024-builder"]
    });
  }

  async getData() {
    if (!this.cache.items.length) await this._loadOptions();
    const steps = this._steps();
    const currentStep = steps[this.step] ?? "Review";
    const isReview = currentStep === "Review";
    const classPrompt = this._selectedClassPrompt();
    const finalAbilities = this._finalAbilities();
    const selectedSpecies = await this._safeFromUuid(this.build.speciesUuid);
    const selectedBackground = await this._safeFromUuid(this.build.backgroundUuid);
    const selectedClass = await this._safeFromUuid(this.build.classUuid);
    const spellPrompt = classPrompt?.spells ?? null;

    // v1.7.26 deferred too many derived lists and left later steps rendering
    // with empty option data until the user selected items a second time. Keep
    // only the expensive optional Human origin-feat pack scan lazy; all normal
    // step data must be available immediately after a species/background/class
    // is selected.
    const selectedWeaponMasteries = await this._selectedWeaponMasteryDetails();
    const selectedCantrips = await this._selectedSpellDetails(this.build.cantripUuids);
    const selectedLevel1Spells = await this._selectedSpellDetails(this.build.spellUuids);
    const startingEquipmentData = await this._startingEquipmentData();
    const invocationData = await this._invocationData();
    const divineOrderData = this._divineOrderData();
    const primalOrderData = this._primalOrderData();
    const fightingStyleData = await this._fightingStyleData();
    const pactOfTheTomeData = await this._pactOfTheTomeData();
    const magicInitiateData = await this._magicInitiateData();
    const selectedEquipment = await this._selectedEquipmentDetails(this._selectedStartingEquipmentUuids(startingEquipmentData));
    const needsHumanChoices = currentStep === "Human Choices" || isReview;
    const originFeatData = needsHumanChoices ? await this._originFeatData() : this._emptyOriginFeatData();
    const humanSkillData = this._humanSkillData();
    const skilledFeatData = this._skilledFeatData();
    const abilityMethods = getAbilityMethods();
    const selectedAbilityMethod = getAbilityMethod(this.build.abilityMethod);
    const pointBuyRules = this._pointBuyRules();
    const selectedLanguages = this._selectedLanguageDetails();
    const backgroundAbilityData = this._backgroundAbilityData();
    const guiTheme = getGuiTheme();
    return {
      moduleId: MODULE_ID,
      guiTheme,
      themeClass: `l12024b-theme-${guiTheme}`,
      themeInlineStyle: getThemeInlineStyle(guiTheme),
      step: this.step,
      steps,
      currentStep,
      isFirst: this.step === 0,
      isLast: this.step === steps.length - 1,
      build: this.build,
      abilityMethods,
      selectedAbilityMethod,
      pointBuyRules,
      abilities: ABILITIES.map(k => ({ key: k, label: ABILITY_LABELS[k], base: this.build.baseAbilities[k], final: finalAbilities[k], scoreOptions: this._scoreOptionsForAbility(k) })),
      standardArray: STANDARD_ARRAY,
      pointBuyTotal: this._pointBuyTotal(),
      pointBuyRemaining: pointBuyRules.points - this._pointBuyTotal(),
      skillLabels: SKILL_LABELS,
      allSkills: Object.entries(SKILL_LABELS).map(([key, label]) => ({ key, label })),
      species: this._choiceItems(this.cache.species),
      mainSpeciesOptions: this._mainSpeciesOptions(),
      backgrounds: this._choiceItems(this.cache.backgrounds),
      mainBackgroundOptions: this._mainBackgroundOptions(),
      classes: this._choiceItems(this.cache.classes),
      mainClassOptions: await this._mainClassOptions(),
      selectedSpeciesName: selectedSpecies?.name ?? "None",
      selectedBackgroundName: selectedBackground?.name ?? "None",
      selectedClassName: selectedClass?.name ?? this.build.className ?? "None",
      classPrompt,
      weaponMasteryPrompt: classPrompt?.masteries ?? null,
      selectedWeaponMasteries,
      spellPrompt,
      selectedCantrips,
      selectedLevel1Spells,
      startingEquipmentData,
      selectedEquipment,
      invocationData,
      divineOrderData,
      primalOrderData,
      fightingStyleData,
      pactOfTheTomeData,
      magicInitiateData,
      originFeatData,
      humanSkillData,
      skilledFeatData,
      tieflingLegacyData: this._tieflingLegacyData(),
      speciesChoiceData: this._speciesChoiceData(),
      languagePromptCount: DEFAULT_LANGUAGE_CHOICE_COUNT,
      languageOptions: this._languageOptions(),
      selectedLanguages,
      backgroundAbilityData,
      classSkillOptions: this._classSkillOptions(classPrompt),
      finalAbilities,
      targetActorName: this.targetActor?.name ?? null,
      ownedActors: this._availableTargetActors(),
      canCreate: game.user.isGM || game.settings.get(MODULE_ID, "playersCanCreateActors"),
      configuredFolderName: this._configuredFolderName(),
      sourcePackSummary: this._sourcePackSummary(),
      searchTerms: this.build.searches ?? {},
      sectionsOpen: this._collapsibleSectionFlags()
    };
  }

  /**
   * v1.20.3: whether each <details class="l12024b-collapsible"> section
   * (Eldritch Invocations, Cantrips, Level 1 Spells, Magic Initiate, Pact of
   * the Tome) should render open or collapsed. Backed by this.collapsedSections
   * (see the constructor) rather than this.build, since this is UI state that
   * must survive this.render() without becoming part of the character data.
   */
  _collapsibleSectionFlags() {
    const keys = ["eldritchInvocations", "cantrips", "level1Spells", "magicInitiate", "pactOfTheTome"];
    const flags = {};
    for (const key of keys) flags[key] = !this.collapsedSections.has(key);
    return flags;
  }

  activateListeners(html) {
    super.activateListeners(html);
    applyThemeToWindow(this);
    html.find("[data-action='next']").on("click", () => this._next());
    html.find("[data-action='back']").on("click", () => this._back());
    html.find("[data-action='finish']").on("click", () => this._finish());
    html.find("[data-action='sources']").on("click", () => {
      if (!game.user.isGM) return ui.notifications.warn("Only a GM can change character creation sources.");
      new LevelOne2024SourcebookSettings().render(true);
    });
    html.find("[data-action='openItem']").on("click", ev => this._openItemUuid(ev.currentTarget.dataset.uuid));
    html.find("[data-action='selectItem']").on("click", ev => this._selectItem(ev.currentTarget.dataset.kind, ev.currentTarget.dataset.uuid));
    html.find("[data-action='selectItemOnly']").on("click", ev => this._selectItemOnly(ev.currentTarget.dataset.kind, ev.currentTarget.dataset.uuid));
    html.find("[data-action='confirmSelectItem']").on("click", ev => this._confirmSelectItem(ev.currentTarget.dataset.kind, ev.currentTarget.dataset.uuid));
    html.find("[data-action='browserPick']").on("click", ev => this._pickFromDnd5eBrowser(ev.currentTarget.dataset.kind));
    html.find("[data-action='browserPickMasteries']").on("click", ev => this._pickWeaponMasteriesFromDnd5eBrowser());
    html.find("[data-step]").on("click", ev => { this.step = Number(ev.currentTarget.dataset.step); this.render(); });
    // v1.20.3: remember collapsed/expanded state per section across the
    // this.render() calls that follow every spell/item pick (see
    // this.collapsedSections and _collapsibleSectionFlags above). This only
    // records state - it must not call this.render() itself, or every
    // collapse/expand click would redundantly re-render the whole step.
    html.find("details.l12024b-collapsible[data-section]").on("toggle", ev => {
      const section = ev.currentTarget.dataset.section;
      if (!section) return;
      if (ev.currentTarget.open) this.collapsedSections.delete(section);
      else this.collapsedSections.add(section);
    });
    html.find("input[name='name']").on("change", ev => { this.build.name = ev.currentTarget.value; });
    html.find("input[name='actorMode']").on("change", ev => this._setActorMode(ev.currentTarget.value));
    html.find("select[name='selectedActorId']").on("change", ev => this._setSelectedActor(ev.currentTarget.value));
    html.find("input[name='abilityMethod']").on("change", ev => this._setAbilityMethod(ev.currentTarget.value));
    html.find("[data-action='rollScores']").on("click", ev => this._rollScores(ev.currentTarget.dataset.method));
    html.find("select[data-ability]").on("change", ev => this._assignAbility(ev));
    html.find("[data-action='changeAbilityScore']").on("click", ev => this._openAbilityScoreDialog(ev.currentTarget.dataset.ability));
    html.find("input[data-manual-ability]").on("change", ev => this._changeManualAbility(ev));
    html.find("input[data-pointbuy]").on("change", ev => this._changePointBuy(ev));
    html.find("select[name='speciesUuid']").on("change", ev => this._selectItemOnly("species", ev.currentTarget.value));
    html.find("select[name='backgroundUuid']").on("change", ev => this._selectItemOnly("background", ev.currentTarget.value));
    html.find("select[name='classUuid']").on("change", ev => { this.build.classUuid = ev.currentTarget.value; this.build.className = ""; this.build.skillChoices = []; this.build.weaponMasteryUuids = []; this.build.cantripUuids = []; this.build.spellUuids = []; this.build.tomeCantripUuids = []; this.build.tomeRitualSpellUuids = []; this.build.invocationUuids = []; this.build.divineOrder = ""; this.build.primalOrder = ""; this.build.equipmentUuids = []; this.build.equipmentChoiceSelections = {}; this.render(); });
    html.find("input[data-skill]").on("change", ev => this._toggleSkill(ev));
    html.find("[data-action='browseCantrips']").on("click", () => this._browseCantrips());
    html.find("[data-action='removeCantrip']").on("click", ev => this._removeCantrip(ev.currentTarget.dataset.uuid));
    html.find("[data-action='browseLevelOneSpells']").on("click", () => this._browseLevelOneSpells());
    html.find("[data-action='removeSpell']").on("click", ev => this._removeSpell(ev.currentTarget.dataset.uuid));
    html.find("[data-action='browseTomeCantrips']").on("click", () => this._browseTomeCantrips());
    html.find("[data-action='removeTomeCantrip']").on("click", ev => this._removeTomeCantrip(ev.currentTarget.dataset.uuid));
    html.find("[data-action='browseTomeRitualSpells']").on("click", () => this._browseTomeRitualSpells());
    html.find("[data-action='removeTomeRitualSpell']").on("click", ev => this._removeTomeRitualSpell(ev.currentTarget.dataset.uuid));
    html.find("[data-action='browseMagicInitiateCantrips']").on("click", () => this._browseMagicInitiateCantrips());
    html.find("[data-action='removeMagicInitiateCantrip']").on("click", ev => this._removeMagicInitiateCantrip(ev.currentTarget.dataset.uuid));
    html.find("[data-action='browseMagicInitiateSpell']").on("click", () => this._browseMagicInitiateSpell());
    html.find("[data-action='removeMagicInitiateSpell']").on("click", () => this._removeMagicInitiateSpell());
    html.find("[data-action='chooseInvocation']").on("click", ev => this._chooseInvocation(ev.currentTarget.dataset.uuid));
    html.find("[data-action='removeInvocation']").on("click", ev => this._removeInvocation(ev.currentTarget.dataset.uuid));
    html.find("input[name='divineOrder']").on("change", ev => this._setDivineOrder(ev.currentTarget.value));
    html.find("input[name='primalOrder']").on("change", ev => this._setPrimalOrder(ev.currentTarget.value));
    html.find("input[name='fightingStyle']").on("change", ev => this._setFightingStyle(ev.currentTarget.value));
    html.find("input[data-equipment-choice]").on("change", ev => this._selectEquipmentChoice(ev));
    html.find("[data-action='chooseOriginFeat']").on("click", ev => this._chooseOriginFeat(ev.currentTarget.dataset.uuid));
    html.find("[data-action='removeOriginFeat']").on("click", ev => this._removeOriginFeat(ev.currentTarget.dataset.uuid));
    html.find("input[name='humanSkillChoice']").on("change", ev => this._setHumanSkillChoice(ev.currentTarget.value));
    html.find("input[data-skilled-choice]").on("change", ev => this._toggleSkilledChoice(ev));
    html.find("input[name='tieflingLegacy']").on("change", ev => this._setTieflingLegacy(ev.currentTarget.value));
    html.find("input[name='speciesChoice']").on("change", ev => this._setSpeciesChoice(ev.currentTarget.value));
    html.find("input[data-language]").on("change", ev => this._toggleLanguage(ev));
    html.find("input[data-search]").on("input", ev => this._setSearchTerm(ev.currentTarget));
    html.find("input[name='backgroundAsiMode']").on("change", ev => this._setBackgroundAsiMode(ev.currentTarget.value));
    html.find("select[name='backgroundAsiPlus2']").on("change", ev => this._setBackgroundAsiField("plus2", ev.currentTarget.value));
    html.find("select[name='backgroundAsiPlus1']").on("change", ev => this._setBackgroundAsiField("plus1", ev.currentTarget.value));
    html.find("input[data-background-asi-plus1]").on("change", ev => this._toggleBackgroundAsiPlus1(ev.currentTarget.dataset.backgroundAsiPlus1, ev.currentTarget.checked));
  }

  _setSearchTerm(input) {
    const kind = input?.dataset?.search;
    if (!kind) return;

    this.build.searches ??= {};
    this.build.searches[kind] = input.value ?? "";
    this._pendingSearchFocus = {
      kind,
      start: input.selectionStart ?? input.value.length,
      end: input.selectionEnd ?? input.value.length
    };

    this.render(false);
  }

  _restoreSearchFocus() {
    const pending = this._pendingSearchFocus;
    if (!pending?.kind) return;

    const element = this.element?.[0] ?? this.element;
    const input = element?.querySelector?.(`input[data-search="${pending.kind}"]`);
    if (!input) return;

    window.setTimeout(() => {
      try {
        input.focus({ preventScroll: true });
        const length = String(input.value ?? "").length;
        const start = Math.min(pending.start ?? length, length);
        const end = Math.min(pending.end ?? start, length);
        input.setSelectionRange?.(start, end);
      } catch (err) {
        input.focus?.();
      }
    }, 0);
  }

  _matchesSearch(item, term, extra = []) {
    const needle = String(term ?? "").trim().toLowerCase();
    if (!needle) return true;

    // Search should be exact and player-intuitive: match against the visible
    // option name/label only. Do not search UUIDs or source labels, because
    // those contain package IDs and metadata that make unrelated results appear
    // for short searches such as "az".
    const haystack = [
      item?.name,
      item?.label,
      item?.key
    ].filter(Boolean).join(" ").toLowerCase();

    return needle.split(/\s+/).every(part => haystack.includes(part));
  }

  _configuredFolderName() {
    const folderId = configuredCharacterFolderId();
    return folderId ? (game.folders.get(folderId)?.name ?? "None") : "None";
  }


  _steps() {
    const steps = ["Actor", "Name", "Ability Scores Generation", "Species"];
    // Some 2024 species have a required level-1 choice. Since this builder
    // strips species advancements to suppress built-in prompts, it has to own
    // those choices and only show the step for species that need it.
    if (this._speciesChoiceGroup()) steps.push("Species Options");
    steps.push("Background", "Background Ability Scores");
    // The Human Choices step is only part of the flow after the player has
    // actually selected Human. Non-human characters should never see that step
    // in the navigation or as a pass-through page.
    if (this._isHumanSpecies()) steps.push("Human Choices");
    // v1.20.3: the Skilled origin feat ("proficiency in any combination of
    // three skills or tools of your choice") needs its own step for the same
    // reason Fighting Style/Divine Order/Primal Order do - this builder
    // suppresses dnd5e's native Advancement Manager for every origin feat it
    // imports (so a native popup never interrupts the wizard), which also
    // means a feat with its own required choice never gets a chance to ask
    // for it unless the builder asks instead. Checked after both Background
    // (which auto-grants Skilled for Charlatan/Noble/Scribe) and Human
    // Choices (where a Human player can choose Skilled as their one origin
    // feat), so by the time this step can show up the choice is already known
    // either way.
    if (this._isSkilledFeatActive()) steps.push("Skilled Proficiencies");
    steps.push("Class", "Class Choices", "Starting Equipment", "Spells", "Languages", "Review");
    return steps;
  }

  /**
   * v1.20.3: true once the character is getting the Skilled origin feat,
   * whether that's auto-granted by their background (Charlatan, Noble,
   * Scribe) or chosen as their Human origin feat. Deliberately synchronous -
   * _steps() calls this on every render, and both background and origin-feat
   * option data are already loaded into this.cache by the time either of
   * those selections can have been made.
   */
  _isSkilledFeatActive() {
    const mappedBackgroundFeat = this._backgroundOriginFeatName();
    if (mappedBackgroundFeat && this._originFeatSlugFromName(mappedBackgroundFeat) === "skilled") return true;
    for (const uuid of this.build.originFeatUuids ?? []) {
      const cached = (this.cache.feats ?? []).find(f => f.uuid === uuid) ?? (this.cache.items ?? []).find(i => i.uuid === uuid);
      if (cached?.name && this._originFeatSlugFromName(cached.name) === "skilled") return true;
    }
    return false;
  }

  _availableTargetActors() {
    return game.actors
      .filter(actor => actor.type === "character" && (game.user.isGM || actor.isOwner))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(actor => ({
        id: actor.id,
        name: actor.name,
        selected: actor.id === this.build.selectedActorId
      }));
  }

  _choiceItems(items) {
    return items.map(item => ({
      uuid: item.uuid,
      name: item.name,
      type: item.type,
      sourceLabel: this._itemSourceLabel(item),
      system: item.system
    }));
  }


  _mainSpeciesOptions() {
    const byKey = new Map();
    for (const item of this.cache.species ?? []) {
      if (isStandaloneLineageOption(item)) continue;
      const key = mainSpeciesKey(item);
      if (!key) continue;
      const current = byKey.get(key);
      if (!current || speciesSourceScore(item) > speciesSourceScore(current)) byKey.set(key, item);
    }
    const search = this.build.searches?.species ?? "";
    return [...byKey.values()]
      .filter(item => this._matchesSearch(item, search, [this._itemSourceLabel(item)]))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(item => ({
        uuid: item.uuid,
        name: item.name,
        img: item.img || "icons/svg/mystery-man.svg",
        type: item.type,
        sourceLabel: this._itemSourceLabel(item),
        selected: item.uuid === this.build.speciesUuid
      }));
  }

  _mainBackgroundOptions() {
    const search = this.build.searches?.backgrounds ?? "";
    return [...(this.cache.backgrounds ?? [])]
      .filter(item => this._matchesSearch(item, search, [this._itemSourceLabel(item)]))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(item => ({
        uuid: item.uuid,
        name: item.name,
        img: item.img || "icons/svg/mystery-man.svg",
        sourceLabel: this._itemSourceLabel(item),
        selected: item.uuid === this.build.backgroundUuid
      }));
  }

  async _mainClassOptions() {
    const candidates = [...(this.cache.classes ?? [])];

    // The normal option cache deliberately omits dnd5e.classes because class
    // selection is normalized to that canonical pack later. The visual gallery
    // still needs those documents, so load the small official class index here.
    // This also guarantees a clean gallery when the GM's configured source
    // packs contain only third-party class features rather than class items.
    const corePack = game.packs.get(DND5E_CORE_CLASS_PACK_ID);
    if (corePack) {
      const index = await corePack.getIndex({ fields: ["type", "img", "system.identifier", "system.source"] });
      for (const entry of index) {
        if (entry.type !== "class") continue;
        candidates.push({
          uuid: `Compendium.${corePack.collection}.${entry._id}`,
          name: entry.name,
          img: entry.img,
          type: entry.type,
          pack: corePack.collection,
          system: entry.system ?? {}
        });
      }
    }

    const byKey = new Map();
    const score = item => {
      const source = `${item.pack ?? ""} ${this._itemSourceLabel(item)}`.toLowerCase();
      if (source.includes("classes24") || source.includes("phb 2024") || source.includes("player's handbook")) return 100;
      if (source.includes("dnd5e")) return 80;
      return 20;
    };

    for (const item of candidates) {
      const key = this._slug(item.system?.identifier || item.name).replace(/-?2024$/, "");
      if (!CLASS_PROMPTS_2024[key]) continue;
      const current = byKey.get(key);
      if (!current || score(item) > score(current)) byKey.set(key, item);
    }

    const search = this.build.searches?.classes ?? "";
    return [...byKey.values()]
      .filter(item => this._matchesSearch(item, search))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(item => ({
        uuid: item.uuid,
        name: item.name,
        img: item.img || "icons/svg/mystery-man.svg",
        sourceLabel: this._itemSourceLabel(item),
        selected: item.uuid === this.build.classUuid || this._slug(item.name).replace(/-?2024$/, "") === this._selectedClassKey()
      }));
  }

  _itemSourceLabel(item) {
    const pack = item.pack ? game.packs.get(item.pack) : null;
    return pack?.metadata?.label ?? item.system?.source?.book ?? item.system?.source?.custom ?? item.pack ?? "World Item";
  }

  async _coreClassUuidForName(name) {
    const pack = game.packs.get(DND5E_CORE_CLASS_PACK_ID);
    if (!pack || !name) return null;

    const wantedSlug = this._slug(name).replace(/-?2024$/, "");
    const index = await pack.getIndex({ fields: ["type", "system.identifier", "system.slug"] });
    const classEntries = [...index].filter(entry => entry.type === "class");

    let match = classEntries.find(entry => this._slug(entry.name).replace(/-?2024$/, "") === wantedSlug);
    if (!match) {
      match = classEntries.find(entry => {
        const id = this._slug(entry.system?.identifier ?? entry.system?.slug ?? "").replace(/-?2024$/, "");
        return id === wantedSlug;
      });
    }
    if (!match) {
      match = classEntries.find(entry => this._slug(entry.name).includes(wantedSlug) || wantedSlug.includes(this._slug(entry.name)));
    }
    return match ? `Compendium.${pack.collection}.${match._id}` : null;
  }

  async _normalizeClassSelection(uuid, selected = null) {
    const doc = selected ?? await this._safeFromUuid(uuid);
    if (!doc || doc.type !== "class") return { uuid, doc, replaced: false, original: doc };

    // Class actor items must come from the dnd5e system class compendium when
    // possible. Other modules validate class items against that canonical pack,
    // and custom/DDB class copies can fail those checks. Do this lazily only
    // after a class is selected/confirmed so the builder does not have to index
    // dnd5e.classes every time the window opens.
    if (doc.pack === DND5E_CORE_CLASS_PACK_ID) return { uuid, doc, replaced: false, original: doc };

    const coreUuid = await this._coreClassUuidForName(doc.name);
    if (!coreUuid) return { uuid, doc, replaced: false, original: doc };

    const coreDoc = await this._safeFromUuid(coreUuid);
    if (!coreDoc || coreDoc.type !== "class") return { uuid, doc, replaced: false, original: doc };

    return { uuid: coreUuid, doc: coreDoc, replaced: coreUuid !== uuid, original: doc };
  }

  async _openItemUuid(uuid) {
    const doc = await this._safeFromUuid(uuid);
    if (!doc) return ui.notifications.warn("Could not open that compendium item.");
    doc.sheet?.render(true);
  }



  async _selectItemOnly(kind, uuid, options = {}) {
    const selected = await this._safeFromUuid(uuid);
    if (kind === "species") { this.build.speciesUuid = uuid; this.build.speciesName = selected?.name ?? ""; this.build.speciesChoiceGroupKey = detectSpeciesChoiceGroupKey(selected); this.build.originFeatUuids = []; this.build.humanSkillChoice = ""; this.build.tieflingLegacy = ""; this.build.dragonbornAncestry = ""; this.build.elfLineage = ""; this.build.gnomeLineage = ""; this.build.goliathAncestry = ""; }
    if (kind === "background") { this._setSelectedBackground(uuid, selected); }
    if (kind === "class") {
      this.build.classUuid = uuid;
      this.build.className = selected?.name ?? "";
      this.build.skillChoices = [];
      this.build.weaponMasteryUuids = [];
      this.build.cantripUuids = [];
      this.build.spellUuids = [];
      this.build.tomeCantripUuids = [];
      this.build.tomeRitualSpellUuids = [];
      this.build.equipmentUuids = [];
    }
    if (options.render !== false) this.render();
  }

  async _confirmSelectItem(kind, uuid) {
    const doc = await this._safeFromUuid(uuid);
    const label = kind === "species" ? "Species" : kind === "background" ? "Background" : kind === "class" ? "Class" : "Choice";
    if (!doc) return ui.notifications.warn(`Could not load that ${label.toLowerCase()}.`);

    return Dialog.confirm({
      title: `Confirm ${label}`,
      content: themedDialogHtml(`<p>Choose <strong>${foundry.utils.escapeHTML(doc.name)}</strong> as your ${label.toLowerCase()}?</p>`),
      yes: async () => {
        await this._selectItemOnly(kind, uuid, { render: false });
        const error = await this._validateStep(this.step);
        if (error) return ui.notifications.warn(error);
        this.step = Math.min(this.step + 1, this._steps().length - 1);
        this.render();
      },
      no: () => {},
      defaultYes: true,
      options: themedDialogOptions()
    });
  }

  async _selectItem(kind, uuid) {
    const selected = await this._safeFromUuid(uuid);
    if (kind === "species") { this.build.speciesUuid = uuid; this.build.speciesName = selected?.name ?? ""; this.build.speciesChoiceGroupKey = detectSpeciesChoiceGroupKey(selected); this.build.originFeatUuids = []; this.build.humanSkillChoice = ""; this.build.tieflingLegacy = ""; this.build.dragonbornAncestry = ""; this.build.elfLineage = ""; this.build.gnomeLineage = ""; this.build.goliathAncestry = ""; }
    if (kind === "background") { this._setSelectedBackground(uuid, selected); }
    if (kind === "class") {
      const normalized = await this._normalizeClassSelection(uuid, selected);
      this.build.classUuid = normalized.uuid;
      this.build.className = normalized.doc?.name ?? selected?.name ?? "";
      this.build.skillChoices = [];
      this.build.weaponMasteryUuids = [];
      this.build.cantripUuids = [];
      this.build.spellUuids = [];
      this.build.tomeCantripUuids = [];
      this.build.tomeRitualSpellUuids = [];
      this.build.invocationUuids = [];
      this.build.divineOrder = "";
      this.build.primalOrder = "";
      this.build.fightingStyle = "";
    }
    await this._openItemUuid(uuid);
    this.render();
  }


  _dnd5eCompendiumBrowserClass() {
    return game.dnd5e?.applications?.CompendiumBrowser
      ?? globalThis.dnd5e?.applications?.CompendiumBrowser
      ?? null;
  }

  _browserConfigForKind(kind) {
    const configs = {
      species: {
        label: "Species",
        tab: "races",
        types: ["race", "species"],
        target: "speciesUuid",
        hint: "Choose your 2024 species. This uses the dnd5e system Compendium Browser and its configured sources."
      },
      background: {
        label: "Background",
        tab: "backgrounds",
        types: ["background"],
        target: "backgroundUuid",
        hint: "Choose your 2024 background. The builder will ask for that background's ability score increases next."
      },
      class: {
        label: "Class",
        tab: "classes",
        types: ["class"],
        target: "classUuid",
        hint: "Choose your level 1 class."
      }
    };
    return configs[kind] ?? null;
  }

  async _pickFromDnd5eBrowser(kind) {
    const Browser = this._dnd5eCompendiumBrowserClass();
    if (!Browser?.selectOne) {
      return ui.notifications.error("The dnd5e Compendium Browser API was not found. Make sure the dnd5e system is updated and active.");
    }

    const config = this._browserConfigForKind(kind);
    if (!config) return ui.notifications.warn("Unknown browser selection type.");

    const types = new Set(config.types);
    let selectedUuid = null;
    try {
      selectedUuid = await Browser.selectOne({
        tab: config.tab,
        hint: config.hint,
        filters: {
          locked: {
            documentClass: "Item",
            types,
            exclusive: true
          },
          initial: {
            documentClass: "Item",
            types
          }
        }
      }, { force: true });
    } catch (err) {
      console.error(`${MODULE_ID} | dnd5e Compendium Browser selection failed`, err);
      return ui.notifications.error(`Could not open the dnd5e Compendium Browser: ${err.message}`);
    }

    if (!selectedUuid) return;
    let doc = await this._safeFromUuid(selectedUuid);
    if (!doc) return ui.notifications.warn(`The selected ${config.label.toLowerCase()} could not be loaded.`);
    if (kind === "species" && isStandaloneLineageOption(doc)) {
      return ui.notifications.warn("Choose the main species entry instead. Lineage/subspecies entries are selected from the species item and do not work as standalone species choices.");
    }

    let normalized = { uuid: selectedUuid, doc, replaced: false, original: doc };
    if (kind === "class") {
      normalized = await this._normalizeClassSelection(selectedUuid, doc);
      selectedUuid = normalized.uuid;
      doc = normalized.doc ?? doc;
    }

    const sourceNote = kind === "class"
      ? ""
      : `<p class="hint">Source: ${foundry.utils.escapeHTML(this._itemSourceLabel(doc))}</p>`;

    return Dialog.confirm({
      title: `Confirm ${config.label}`,
      content: themedDialogHtml(`<p>Choose <strong>${foundry.utils.escapeHTML(doc.name)}</strong> as your ${config.label.toLowerCase()}?</p>${sourceNote}`),
      yes: async () => {
        await this._selectItemOnly(kind, selectedUuid, { render: false });
        ui.notifications.info(`Selected ${config.label}: ${doc.name}`);
        const error = await this._validateStep(this.step);
        if (error) return ui.notifications.warn(error);
        this.step = Math.min(this.step + 1, this._steps().length - 1);
        this.render();
      },
      no: () => {},
      defaultYes: true,
      options: themedDialogOptions()
    });
  }

  // The spell-related steps used to render every eligible spell as an inline
  // checkbox row directly in the wizard, which made the "Spells" step grow to
  // dozens or hundreds of rows for classes with large spell lists. The dnd5e
  // system already ships a proper Compendium Browser with its own search,
  // scrolling, and (for 2024-rules spells) an authoritative "spelllist" filter
  // backed by the system's spell list registry - the same data source the
  // system's own level-up tools use to know which spells belong to which
  // class. Opening that browser, pre-locked to the right spell level and class
  // list, gives players the correct options in a proper searchable window
  // instead of a long embedded list.
  _classSpellListFilterValue(classKey) {
    const key = String(classKey ?? "").trim().toLowerCase();
    if (!key) return null;
    try {
      const registry = globalThis.dnd5e?.registry ?? game.dnd5e?.registry;
      const list = registry?.spellLists?.forType?.("class", key);
      if (list?.identifiers?.size) return { [`class:${key}`]: 1 };
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not resolve the "${key}" spell list from the dnd5e registry`, err);
    }
    return null;
  }

  /**
   * Open the dnd5e Compendium Browser's Spells tab, locked to a spell level
   * range and (when resolvable) a specific class spell list, and let the
   * player pick an exact number of spells.
   */
  async _openSpellCompendiumBrowser({ hint, levelMin = null, levelMax = null, classKey = null, ritualOnly = false, min = 1, max = 1 } = {}) {
    const Browser = this._dnd5eCompendiumBrowserClass();
    if (!Browser?.select) {
      ui.notifications.error("The dnd5e Compendium Browser API was not found. Make sure the dnd5e system is updated and active.");
      return null;
    }

    const additional = {};
    if (Number.isFinite(levelMin) || Number.isFinite(levelMax)) {
      additional.level = {};
      if (Number.isFinite(levelMin)) additional.level.min = levelMin;
      if (Number.isFinite(levelMax)) additional.level.max = levelMax;
    }
    const spellListFilter = classKey ? this._classSpellListFilterValue(classKey) : null;
    if (spellListFilter) additional.spelllist = spellListFilter;
    if (ritualOnly) additional.properties = { ritual: 1 };

    const types = new Set(["spell"]);
    let selected = null;
    try {
      selected = await Browser.select({
        tab: "spells",
        hint,
        filters: {
          locked: { documentClass: "Item", types, exclusive: true, additional },
          initial: { documentClass: "Item", types }
        },
        selection: { min, max }
      }, { force: true });
    } catch (err) {
      console.error(`${MODULE_ID} | dnd5e Compendium Browser spell selection failed`, err);
      ui.notifications.error(`Could not open the dnd5e Compendium Browser: ${err.message}`);
      return null;
    }

    if (!selected?.size) return null;
    return [...selected];
  }

  async _browseCantrips() {
    const required = this._selectedClassPrompt()?.spells?.cantrips ?? 0;
    if (!required) return;
    const picked = await this._openSpellCompendiumBrowser({
      hint: `Choose exactly ${required} cantrip${required === 1 ? "" : "s"} from this class's 2024 cantrip list.`,
      levelMin: 0, levelMax: 0,
      classKey: this._selectedClassKey(),
      min: required, max: required
    });
    if (!picked) return;
    this.build.cantripUuids = picked;
    if (await this._maybePromptStepComplete("Spells")) return;
    this.render();
  }

  async _browseLevelOneSpells() {
    const required = this._selectedClassPrompt()?.spells?.level1 ?? 0;
    if (!required) return;
    const picked = await this._openSpellCompendiumBrowser({
      hint: `Choose exactly ${required} level 1 spell${required === 1 ? "" : "s"} from this class's 2024 level 1 spell list.`,
      levelMin: 1, levelMax: 1,
      classKey: this._selectedClassKey(),
      min: required, max: required
    });
    if (!picked) return;
    this.build.spellUuids = picked;
    if (await this._maybePromptStepComplete("Spells")) return;
    this.render();
  }

  async _ensureSelectedBackgroundState() {
    if (!this.build.backgroundUuid) return;

    // The plain <select> path previously only stored the UUID, which meant the
    // builder could reach Finish without the captured background skills that
    // _setSelectedBackground normally stores. Refreshing from the actual item
    // here makes the finish path independent of which UI path selected it.
    const selected = await this._safeFromUuid(this.build.backgroundUuid);
    if (!selected && (this.build.backgroundSkillKeys ?? []).length) return;

    const previousAsi = foundry.utils.deepClone(this.build.backgroundAsi ?? { mode: "2-1", plus2: "", plus1: "", plus1s: [] });
    const previousOriginFeats = foundry.utils.deepClone(this.build.originFeatUuids ?? []);
    this._setSelectedBackground(this.build.backgroundUuid, selected ?? { name: this.build.backgroundName ?? "" });

    // Do not reset already-completed player choices while repairing the cached
    // background metadata immediately before Finish.
    this.build.backgroundAsi = previousAsi;
    this.build.originFeatUuids = previousOriginFeats;
  }

  _knownBackgroundKeyFromName(name) {
    const clean = String(name ?? "")
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\s*\[[^\]]*\]\s*/g, " ")
      .replace(/\b(2024|phb|player'?s handbook|free rules|background)\b/gi, " ")
      .trim();
    const slug = this._slug(clean).replace(/-?2024$/, "");
    if (BACKGROUND_ABILITIES_2024[slug] || BACKGROUND_SKILLS_2024[slug] || BACKGROUND_ORIGIN_FEATS_2024[slug]) return slug;

    const lower = clean.toLowerCase();
    for (const key of Object.keys(BACKGROUND_ABILITIES_2024)) {
      const label = key.replace(/-/g, " ");
      const pattern = new RegExp(`(^|\\b)${label.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(\\b|$)`, "i");
      if (pattern.test(lower)) return key;
    }
    return slug;
  }

  _setSelectedBackground(uuid, selected) {
    this.build.backgroundUuid = uuid;
    this.build.backgroundName = selected?.name ?? "";

    // Capture background grants at selection time. The dnd5e Compendium Browser
    // can hand us a document from outside this module's cached background list,
    // so do not rely on a later cache lookup to recover the 2024 skills.
    const knownKey = this._knownBackgroundKeyFromName(this.build.backgroundName);
    const skillKeys = new Set(BACKGROUND_SKILLS_2024[knownKey] ?? []);
    for (const skill of this._backgroundSkillKeysFromName(this.build.backgroundName)) skillKeys.add(skill);
    for (const skill of this._backgroundSkillKeysFromDoc(selected)) skillKeys.add(skill);
    this.build.backgroundSkillKeys = [...skillKeys].filter(skill => SKILL_LABELS[skill]);

    const toolNames = new Set(BACKGROUND_TOOLS_2024[knownKey] ?? []);
    for (const tool of this._backgroundToolNamesFromDoc(selected)) toolNames.add(tool);
    this.build.backgroundToolNames = [...toolNames].filter(Boolean);

    this.build.backgroundAbilityKeys = this._backgroundAbilityKeysFromDoc(selected);
    this.build.originFeatUuids = [];
    this.build.backgroundAsi = { mode: "2-1", plus2: "", plus1: "", plus1s: [] };
  }

  _backgroundAbilityKeysFromDoc(bg) {
    const key = this._knownBackgroundKeyFromName(bg?.name ?? this.build.backgroundName ?? "");
    const mapped = BACKGROUND_ABILITIES_2024[key];
    if (Array.isArray(mapped) && mapped.length) return [...mapped];

    const haystack = JSON.stringify(bg?.system ?? {}).toLowerCase();
    const found = [];
    for (const ability of ABILITIES) {
      const label = ABILITY_LABELS[ability].toLowerCase();
      const patterns = [`"${ability}"`, ` ${ability} `, label];
      if (patterns.some(pattern => haystack.includes(pattern)) && !found.includes(ability)) found.push(ability);
    }
    return found.length >= 3 ? found.slice(0, 3) : [];
  }

  _selectedClassKey() {
    const cls = this.cache.classes.find(c => c.uuid === this.build.classUuid);
    const name = cls?.name || this.build.className || "";
    if (!name) return "";
    const slug = this._slug(name).replace(/-?2024$/, "");
    for (const key of Object.keys(CLASS_PROMPTS_2024)) {
      if (slug === key || String(name).toLowerCase().includes(key)) return key;
    }
    return slug;
  }

  async _selectedSpellDetails(uuids = []) {
    const details = [];
    for (const uuid of uuids ?? []) {
      const doc = await this._safeFromUuid(uuid);
      if (!doc) continue;
      details.push({ uuid, name: doc.name, sourceLabel: this._itemSourceLabel(doc) });
    }
    return details;
  }

  _isLikelyAutomationSpell(spell) {
    const pack = spell.pack ? game.packs.get(spell.pack) : null;
    const metadata = pack?.metadata ?? {};
    const haystack = [spell.name, spell.pack, metadata.label, metadata.packageName, metadata.id]
      .filter(Boolean).join(" ").toLowerCase();
    return haystack.includes("cauldron")
      || haystack.includes("plentiful resources")
      || haystack.includes("gambit")
      || haystack.includes("premade")
      || haystack.includes("midi")
      || haystack.includes("dae")
      || haystack.includes("automation")
      || haystack.includes("rider");
  }

  _spellSourceScore(spell) {
    const source = this._itemSourceLabel(spell).toLowerCase();
    const pack = String(spell.pack ?? "").toLowerCase();
    const haystack = `${source} ${pack}`;
    if (haystack.includes("phb 2024") || haystack.includes("phb'24") || haystack.includes("players handbook") || haystack.includes("player's handbook") || haystack.includes("dnd-players-handbook")) return 100;
    if (haystack.includes("srd 5.2") || haystack.includes("free rules")) return 90;
    if (haystack.includes("dnd5e")) return 75;
    if (this._isLikelyAutomationSpell(spell)) return -100;
    return 25;
  }

  _spellMatchesSelectedClass(spell, classKey) {
    if (!classKey) return true;

    const directFields = [
      spell.labels?.classes,
      spell.labels?.class,
      spell.system?.classes,
      spell.system?.class,
      spell.system?.spellClass,
      spell.system?.spellClasses,
      spell.system?.spellList,
      spell.system?.spellLists,
      spell.system?.lists,
      spell.system?.source?.classes,
      spell.system?.source?.class
    ];

    const flattened = directFields.flatMap(value => {
      if (!value) return [];
      if (value instanceof Set) return [...value];
      if (Array.isArray(value)) return value;
      if (typeof value === "object") return Object.entries(value).flatMap(([k, v]) => {
        if (v === false || v === null || v === undefined) return [];
        if (v === true) return [k];
        return [k, v];
      });
      return [value];
    }).map(v => this._slug(v)).filter(Boolean);

    // Only trust explicit class-list fields. Do not search the whole spell JSON,
    // because some automation/rider metadata contains unrelated class names and
    // causes spells like Cure Wounds to appear for Wizards.
    if (flattened.some(v => v === classKey || v.endsWith(`-${classKey}`) || v.startsWith(`${classKey}-`))) return true;

    const fallbackList = CLASS_LEVEL1_SPELLS_2024[classKey];
    if (fallbackList?.has(this._slug(spell.name))) return true;

    return false;
  }

  async _spellOptionsForLevel(level, selectedUuids = []) {
    const prompt = this._selectedClassPrompt()?.spells;
    const required = level === 0 ? (prompt?.cantrips ?? 0) : (prompt?.level1 ?? 0);
    if (!required) return [];
    if (!this.cache.items.length) await this._loadOptions();

    const classKey = this._selectedClassKey();
    const selected = new Set(selectedUuids ?? []);
    const spellsAtLevel = this.cache.spells.filter(spell => Number(spell.system?.level ?? -1) === level);
    const fallbackList = level === 0 ? CLASS_CANTRIPS_2024[classKey] : CLASS_LEVEL1_SPELLS_2024[classKey];
    const classMatches = fallbackList
      ? spellsAtLevel.filter(spell => fallbackList.has(this._slug(spell.name)))
      : spellsAtLevel.filter(spell => this._spellMatchesSelectedClass(spell, classKey));

    const byName = new Map();
    for (const spell of classMatches) {
      if (this._isLikelyAutomationSpell(spell)) continue;
      const key = spell.name.trim().toLowerCase();
      const current = byName.get(key);
      if (!current || this._spellSourceScore(spell) > this._spellSourceScore(current)) byName.set(key, spell);
    }

    const search = level === 0 ? (this.build.searches?.cantrips ?? "") : (this.build.searches?.level1Spells ?? "");
    return [...byName.values()]
      .filter(spell => this._matchesSearch(spell, search, [this._itemSourceLabel(spell)]))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(spell => ({
        uuid: spell.uuid,
        name: spell.name,
        sourceLabel: this._itemSourceLabel(spell),
        checked: selected.has(spell.uuid)
      }));
  }

  async _removeCantrip(uuid) {
    this.build.cantripUuids = (this.build.cantripUuids ?? []).filter(v => v !== uuid);
    this.render();
  }

  _removeSpell(uuid) {
    this.build.spellUuids = (this.build.spellUuids ?? []).filter(v => v !== uuid);
    this.render();
  }

  async _hasPactOfTheTome() {
    for (const uuid of this.build.invocationUuids ?? []) {
      const doc = await this._safeFromUuid(uuid);
      if (this._slug(doc?.name) === "pact-of-the-tome") return true;
    }
    return false;
  }

  _isRitualSpell(spell) {
    if (!spell || spell.type !== "spell") return false;
    const props = spell.system?.properties;
    if (props instanceof Set && props.has("ritual")) return true;
    if (Array.isArray(props) && props.includes("ritual")) return true;
    if (props && typeof props === "object" && (props.ritual === true || props.ritual?.value === true || props.ritual?.selected === true)) return true;
    if (spell.system?.ritual === true || spell.system?.preparation?.ritual === true) return true;
    const text = [spell.system?.properties, spell.system?.activities, spell.system?.description?.value].filter(Boolean).map(v => typeof v === "string" ? v : JSON.stringify(v)).join(" ").toLowerCase();
    return /\britual\b/.test(text);
  }

  _dedupeSpellOptions(spells, selectedUuids = [], search = "") {
    const selected = new Set(selectedUuids ?? []);
    const byName = new Map();
    for (const spell of spells) {
      if (!spell || this._isLikelyAutomationSpell(spell)) continue;
      const key = spell.name.trim().toLowerCase();
      const current = byName.get(key);
      if (!current || this._spellSourceScore(spell) > this._spellSourceScore(current)) byName.set(key, spell);
    }
    return [...byName.values()]
      .filter(spell => this._matchesSearch(spell, search, []))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(spell => ({
        uuid: spell.uuid,
        name: spell.name,
        sourceLabel: this._itemSourceLabel(spell),
        checked: selected.has(spell.uuid)
      }));
  }

  async _pactOfTheTomeData() {
    const active = await this._hasPactOfTheTome();
    if (!active) return { active: false, requiredCantrips: 0, requiredRituals: 0, cantripOptions: [], ritualOptions: [], selectedCantrips: [], selectedRituals: [] };

    const baseCantripSlugs = new Set();
    for (const uuid of this.build.cantripUuids ?? []) {
      const doc = await this._safeFromUuid(uuid);
      if (doc) baseCantripSlugs.add(this._slug(doc.name));
    }
    const baseLevel1Slugs = new Set();
    for (const uuid of this.build.spellUuids ?? []) {
      const doc = await this._safeFromUuid(uuid);
      if (doc) baseLevel1Slugs.add(this._slug(doc.name));
    }

    const cantripSpells = this.cache.spells.filter(spell => Number(spell.system?.level ?? -1) === 0 && !baseCantripSlugs.has(this._slug(spell.name)));
    const ritualSpells = this.cache.spells.filter(spell => Number(spell.system?.level ?? -1) === 1 && this._isRitualSpell(spell) && !baseLevel1Slugs.has(this._slug(spell.name)));

    return {
      active: true,
      requiredCantrips: 3,
      requiredRituals: 2,
      cantripOptions: this._dedupeSpellOptions(cantripSpells, this.build.tomeCantripUuids, this.build.searches?.tomeCantrips ?? ""),
      ritualOptions: this._dedupeSpellOptions(ritualSpells, this.build.tomeRitualSpellUuids, this.build.searches?.tomeRitualSpells ?? ""),
      selectedCantrips: await this._selectedSpellDetails(this.build.tomeCantripUuids ?? []),
      selectedRituals: await this._selectedSpellDetails(this.build.tomeRitualSpellUuids ?? [])
    };
  }

  async _browseTomeCantrips() {
    if (!(await this._hasPactOfTheTome())) return ui.notifications.warn("Pact of the Tome has not been selected.");
    const picked = await this._openSpellCompendiumBrowser({
      hint: "Pact of the Tome: choose exactly 3 cantrips from any class's spell list.",
      levelMin: 0, levelMax: 0,
      min: 3, max: 3
    });
    if (!picked) return;
    this.build.tomeCantripUuids = picked;
    if (await this._maybePromptStepComplete("Spells")) return;
    this.render();
  }

  _removeTomeCantrip(uuid) {
    this.build.tomeCantripUuids = (this.build.tomeCantripUuids ?? []).filter(v => v !== uuid);
    this.render();
  }

  async _browseTomeRitualSpells() {
    if (!(await this._hasPactOfTheTome())) return ui.notifications.warn("Pact of the Tome has not been selected.");
    const picked = await this._openSpellCompendiumBrowser({
      hint: "Pact of the Tome: choose exactly 2 level 1 ritual spells from any class's spell list.",
      levelMin: 1, levelMax: 1,
      ritualOnly: true,
      min: 2, max: 2
    });
    if (!picked) return;
    this.build.tomeRitualSpellUuids = picked;
    if (await this._maybePromptStepComplete("Spells")) return;
    this.render();
  }

  _removeTomeRitualSpell(uuid) {
    this.build.tomeRitualSpellUuids = (this.build.tomeRitualSpellUuids ?? []).filter(v => v !== uuid);
    this.render();
  }

  async _activeMagicInitiateSourceKey() {
    const names = new Set();
    const mappedBackgroundFeat = this._backgroundOriginFeatName();
    if (mappedBackgroundFeat) names.add(mappedBackgroundFeat);

    const cachedBackground = this.cache.backgrounds.find(b => b.uuid === this.build.backgroundUuid);
    const selectedBackground = await this._safeFromUuid(this.build.backgroundUuid);
    for (const bg of [cachedBackground, selectedBackground]) {
      for (const name of this._backgroundOriginFeatNamesFromDoc(bg)) names.add(name);
    }

    for (const uuid of this.build.originFeatUuids ?? []) {
      const doc = await this._safeFromUuid(uuid);
      if (doc?.name) names.add(doc.name);
    }

    const slugs = [...names].map(name => this._originFeatSlugFromName(name));
    if (slugs.includes("magic-initiate-cleric")) return "cleric";
    if (slugs.includes("magic-initiate-druid")) return "druid";
    if (slugs.includes("magic-initiate-wizard")) return "wizard";
    if (slugs.includes("magic-initiate")) return "wizard";
    return "";
  }

  async _magicInitiateData() {
    const sourceKey = await this._activeMagicInitiateSourceKey();
    const source = MAGIC_INITIATE_SOURCES_2024[sourceKey];
    if (!source) return { active: false, sourceKey: "", sourceLabel: "", requiredCantrips: 0, requiredSpells: 0, cantripOptions: [], spellOptions: [], selectedCantrips: [], selectedSpell: [] };

    const cantripList = CLASS_CANTRIPS_2024[sourceKey];
    const spellList = CLASS_LEVEL1_SPELLS_2024[sourceKey];
    const cantripSpells = this.cache.spells.filter(spell => Number(spell.system?.level ?? -1) === 0 && (!cantripList || cantripList.has(this._slug(spell.name))));
    const levelOneSpells = this.cache.spells.filter(spell => Number(spell.system?.level ?? -1) === 1 && (!spellList || spellList.has(this._slug(spell.name))));

    return {
      active: true,
      sourceKey,
      sourceLabel: source.label,
      requiredCantrips: 2,
      requiredSpells: 1,
      cantripOptions: this._dedupeSpellOptions(cantripSpells, this.build.magicInitiateCantripUuids, this.build.searches?.magicInitiateCantrips ?? ""),
      spellOptions: this._dedupeSpellOptions(levelOneSpells, this.build.magicInitiateSpellUuid ? [this.build.magicInitiateSpellUuid] : [], this.build.searches?.magicInitiateSpell ?? ""),
      selectedCantrips: await this._selectedSpellDetails(this.build.magicInitiateCantripUuids ?? []),
      selectedSpell: this.build.magicInitiateSpellUuid ? await this._selectedSpellDetails([this.build.magicInitiateSpellUuid]) : []
    };
  }

  async _browseMagicInitiateCantrips() {
    const data = await this._magicInitiateData();
    if (!data.active) return ui.notifications.warn("Magic Initiate has not been selected or granted by the background.");
    const picked = await this._openSpellCompendiumBrowser({
      hint: `Magic Initiate (${data.sourceLabel}): choose exactly ${data.requiredCantrips} cantrips from the ${data.sourceLabel} spell list.`,
      levelMin: 0, levelMax: 0,
      classKey: data.sourceKey,
      min: data.requiredCantrips, max: data.requiredCantrips
    });
    if (!picked) return;
    this.build.magicInitiateCantripUuids = picked;
    if (await this._maybePromptStepComplete("Spells")) return;
    this.render();
  }

  _removeMagicInitiateCantrip(uuid) {
    this.build.magicInitiateCantripUuids = (this.build.magicInitiateCantripUuids ?? []).filter(v => v !== uuid);
    this.render();
  }

  async _browseMagicInitiateSpell() {
    const data = await this._magicInitiateData();
    if (!data.active) return ui.notifications.warn("Magic Initiate has not been selected or granted by the background.");
    const picked = await this._openSpellCompendiumBrowser({
      hint: `Magic Initiate (${data.sourceLabel}): choose exactly ${data.requiredSpells} level 1 spell from the ${data.sourceLabel} spell list.`,
      levelMin: 1, levelMax: 1,
      classKey: data.sourceKey,
      min: data.requiredSpells, max: data.requiredSpells
    });
    if (!picked) return;
    this.build.magicInitiateSpellUuid = picked[0] ?? "";
    if (await this._maybePromptStepComplete("Spells")) return;
    this.render();
  }

  _removeMagicInitiateSpell() {
    this.build.magicInitiateSpellUuid = "";
    this.render();
  }


  _isExcludedInvocationPack(packOrId) {
    const pack = typeof packOrId === "string" ? game.packs.get(packOrId) : packOrId;
    const metadata = pack?.metadata ?? {};
    const h = [pack?.collection ?? packOrId, metadata.id, metadata.label, metadata.packageName, metadata.system]
      .filter(Boolean).join(" ").toLowerCase();
    return h.includes("cauldron")
      || h.includes("plentiful resources")
      || h.includes("gambit")
      || h.includes("premade")
      || h.includes("midi")
      || h.includes("dae")
      || h.includes("automation")
      || h.includes("rider")
      || h.includes("plutonium");
  }

  _isInvocationCandidate(item) {
    if (!item || !["feat", "feature"].includes(item.type)) return false;
    const nameSlug = this._slug(item.name);
    if (!nameSlug || nameSlug === "eldritch-invocations" || nameSlug === "eldritch-invocation" || nameSlug === "eldritch-adept") return false;

    const subtype = item.system?.type?.subtype;
    const subtypeValue = typeof subtype === "object" ? (subtype?.value ?? subtype?.id ?? subtype?.key) : subtype;
    const typeValue = item.system?.type?.value;
    const category = item.system?.category;
    const identifier = item.system?.identifier;
    const requirements = item.system?.requirements;
    const source = item.system?.source?.custom ?? item.system?.source?.book ?? item.system?.source;
    const h = [subtypeValue, typeValue, category, identifier, requirements, source, item.name, item.system?.description?.value]
      .filter(Boolean).join(" ").toLowerCase();

    const invocationLike = h.includes("eldritch invocation")
      || h.includes("eldritch-invocation")
      || h.includes("invocation")
      || String(subtypeValue ?? "").toLowerCase().includes("invocation");
    if (!invocationLike) return false;

    // Exclude options with an explicit Warlock level requirement above 1. Keep
    // pact-style level-1 invocations when no higher requirement is detected.
    const levelMatches = [...h.matchAll(/(?:warlock\s*)?(?:level|lvl|lv\.?|warlock)\s*(\d+)/g)]
      .map(match => Number(match[1]))
      .filter(Number.isFinite);
    if (levelMatches.some(level => level > 1)) return false;
    if (/prerequisite[^.]{0,80}(?:2nd|3rd|4th|5th|6th|7th|8th|9th|10th|11th|12th|13th|14th|15th|16th|17th|18th|19th|20th)/i.test(h)) return false;

    return true;
  }

  _invocationSourceScore(item) {
    const h = [this._itemSourceLabel(item), item?.pack, item?.name].filter(Boolean).join(" ").toLowerCase();
    if (this._isExcludedInvocationPack(item?.pack)) return -100;
    if (h.includes("phb 2024") || h.includes("phb'24") || h.includes("players handbook") || h.includes("player's handbook") || h.includes("dnd-players-handbook")) return 100;
    if (h.includes("free rules") || h.includes("srd 5.2")) return 90;
    if (h.includes("dnd5e")) return 70;
    return 25;
  }

  async _loadInvocationOptions() {
    if (this.cache.invocations?.length) return this.cache.invocations;
    const byName = new Map();

    const consider = async item => {
      if (!item || this._isExcludedInvocationPack(item.pack)) return;
      if (!this._isInvocationCandidate(item)) return;
      const key = this._slug(item.name);
      const current = byName.get(key);
      if (!current || this._invocationSourceScore(item) > this._invocationSourceScore(current)) byName.set(key, item);
    };

    for (const item of this.cache.items ?? []) await consider(item);

    // Only search packs the GM has configured for "Class Features /
    // Invocations" (falling back to automatic detection if that category
    // turns out to be misconfigured and finds nothing at all).
    const scanned = await scanConfiguredPacks("classFeatures", {
      itemTypes: null,
      fallbackSourceTypes: ["feats"],
      indexFields: ["type", "system.source", "system.identifier", "system.type", "system.category", "system.requirements", "system.description.value"],
      predicate: candidate => {
        if (this._isExcludedInvocationPack(candidate.pack)) return false;
        const indexText = [candidate.name, candidate.type, candidate.system?.identifier, candidate.system?.type?.subtype, candidate.system?.category, candidate.system?.requirements, candidate.system?.description?.value]
          .filter(Boolean).join(" ").toLowerCase();
        return candidate.type === "feat" || candidate.type === "feature" || indexText.includes("invocation");
      },
      fetchFullDocIf: candidate => {
        const indexText = [candidate.name, candidate.system?.type?.subtype, candidate.system?.category].filter(Boolean).join(" ").toLowerCase();
        return indexText.includes("invocation") || String(candidate.name ?? "").toLowerCase().includes("pact of");
      }
    });
    for (const item of scanned) await consider(item);

    this.cache.invocations = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
    return this.cache.invocations;
  }

  async _invocationData() {
    const prompt = this._selectedClassPrompt()?.invocations ?? null;
    if (!prompt) return { required: 0, options: [], selected: [] };
    const selectedSet = new Set(this.build.invocationUuids ?? []);
    const invocations = await this._loadInvocationOptions();
    const selected = [];
    for (const uuid of this.build.invocationUuids ?? []) {
      const doc = await this._safeFromUuid(uuid);
      if (doc) selected.push({ uuid, name: doc.name, sourceLabel: this._itemSourceLabel(doc) });
    }
    return {
      required: prompt.count ?? 0,
      options: invocations.map(item => ({ uuid: item.uuid, name: item.name, sourceLabel: this._itemSourceLabel(item), checked: selectedSet.has(item.uuid) })),
      selected
    };
  }

  async _chooseInvocation(uuid) {
    if (!uuid) return;
    const data = await this._invocationData();
    if (!data.required) return ui.notifications.warn("This class does not choose Eldritch Invocations at level 1.");
    if (this.build.invocationUuids.includes(uuid)) return;
    if (this.build.invocationUuids.length >= data.required) {
      return ui.notifications.warn(`You already chose ${data.required} Eldritch Invocation${data.required === 1 ? "" : "s"}. Remove one before choosing another.`);
    }
    this.build.invocationUuids.push(uuid);
    if (await this._maybePromptStepComplete("Class Choices")) return;
    this.render();
  }

  _removeInvocation(uuid) {
    this.build.invocationUuids = (this.build.invocationUuids ?? []).filter(v => v !== uuid);
    this.render();
  }

  async _addSelectedInvocations(actor) {
    for (const uuid of this.build.invocationUuids ?? []) {
      const doc = await fromUuid(uuid);
      if (!doc) continue;
      const slug = this._slug(doc.name);
      const alreadyPresent = actor.items.some(item => ["feat", "feature"].includes(item.type) && this._slug(item.name) === slug);
      if (alreadyPresent) continue;
      await this._createItemsWithoutAdvancementPrompts(actor, [doc.toObject()]);
    }
  }


  _equipmentSourceScore(item) {
    const source = this._itemSourceLabel(item).toLowerCase();
    const pack = String(item.pack ?? item.packName ?? "").toLowerCase();
    const h = `${source} ${pack} ${item.name}`.toLowerCase();
    if (h.includes("cauldron") || h.includes("gambit") || h.includes("premade") || h.includes("automation") || h.includes("rider") || h.includes("midi") || h.includes("dae")) return -100;
    if (h.includes("phb 2024") || h.includes("players handbook") || h.includes("player's handbook") || h.includes("dnd-players-handbook")) return 100;
    if (h.includes("free rules") || h.includes("srd 5.2")) return 90;
    if (pack.startsWith("dnd5e.")) return 75;
    return 25;
  }

  _isLikelyAutomationEquipment(item) {
    const pack = item.pack ? game.packs.get(item.pack) : null;
    const metadata = pack?.metadata ?? {};
    const h = [item.name, item.pack, metadata.label, metadata.packageName, metadata.id]
      .filter(Boolean).join(" ").toLowerCase();
    return h.includes("cauldron") || h.includes("plentiful resources") || h.includes("gambit") || h.includes("premade") || h.includes("automation") || h.includes("rider") || h.includes("midi") || h.includes("dae");
  }

  _equipmentIndexBySlug() {
    const byName = new Map();
    for (const item of this.cache.equipment ?? []) {
      if (!item || !["weapon", "equipment", "consumable", "tool", "loot", "container", "backpack"].includes(item.type)) continue;
      if (this._isLikelyAutomationEquipment(item)) continue;
      const slug = this._slug(item.name);
      if (!slug) continue;
      const rarity = String(item.system?.rarity ?? item.system?.rarity?.value ?? "").toLowerCase();
      if (rarity && !["", "common", "mundane", "none"].includes(rarity)) continue;
      const current = byName.get(slug);
      if (!current || this._equipmentSourceScore(item) > this._equipmentSourceScore(current)) byName.set(slug, item);
    }
    return byName;
  }

  _equipmentDisplayName(name) {
    const names = Array.isArray(name) ? name : [name];
    const counts = new Map();
    for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
    return [...counts.entries()].map(([n, c]) => c > 1 ? `${c}× ${this._titleCase(n)}` : this._titleCase(n)).join(", ");
  }

  _titleCase(value) {
    return String(value ?? "").replace(/\b\w/g, c => c.toUpperCase());
  }

  async _startingEquipmentData() {
    const classKey = this._selectedClassKey();
    const backgroundKey = this._selectedBackgroundKey();
    const itemIndex = this._equipmentIndexBySlug();
    const packages = CLASS_STARTING_EQUIPMENT_PACKAGES_2024[classKey] ?? [];
    const classGroups = packages.length ? [{
      id: `${classKey || "class"}-package`,
      label: "Starting Equipment Package",
      required: true,
      selected: this.build.equipmentChoiceSelections?.[`${classKey || "class"}-package`] ?? "",
      options: packages.map((pkg, idx) => {
        const optionId = `${classKey || "class"}-package:${pkg.id ?? idx}`;
        const names = pkg.items ?? [];
        const uuids = this._resolveEquipmentNamesToUuids(names, itemIndex);
        return {
          id: optionId,
          label: pkg.label ?? this._equipmentDisplayName(names),
          uuids,
          gp: names.reduce((total, name) => total + (Number(String(name).match(/^(\d+)\s*gp$/i)?.[1]) || 0), 0),
          missing: names.filter(n => !this._resolveEquipmentName(n, itemIndex)?.uuid && !/^\d+\s*gp$/i.test(String(n))).map(n => this._titleCase(n)),
          checked: (this.build.equipmentChoiceSelections?.[`${classKey || "class"}-package`] ?? "") === optionId
        };
      })
    }] : [];

    const bgNames = (BACKGROUND_STARTING_EQUIPMENT_2024[backgroundKey] ?? [[]])[0] ?? [];
    const backgroundItems = this._resolveEquipmentNamesToDetails(bgNames, itemIndex);

    return { classKey, backgroundKey, classGroups, backgroundItems };
  }

  _resolveEquipmentName(name, itemIndex) {
    const raw = String(name ?? "").trim();
    if (!raw) return null;
    if (/^\d+\s*gp$/i.test(raw)) return { uuid: "", name: raw, type: "currency", sourceLabel: "Starting Wealth" };
    const aliases = new Map([
      ["simple weapon", "spear"],
      ["musical instrument", "lute"],
      ["artisan's tools", "artisan's tools"],
      ["gaming set", "dice set"],
      ["arcane focus", "wand"],
      ["druidic focus", "sprig of mistletoe"],
      ["holy symbol", "amulet"],
      ["arrow", "arrows"],
      ["crossbow bolt", "crossbow bolts"],
      ["bolt", "crossbow bolts"],
      ["bolts", "crossbow bolts"],
      ["dungeoneer's pack", "dungeoneer's pack"],
      ["dungeoneers pack", "dungeoneer's pack"],
      ["explorer's pack", "explorer's pack"],
      ["explorers pack", "explorer's pack"]
    ]);
    const candidates = [raw, aliases.get(raw.toLowerCase())].filter(Boolean);
    for (const candidate of candidates) {
      const item = itemIndex.get(this._slug(candidate));
      if (item) return item;
    }
    return null;
  }

  _resolveEquipmentNamesToUuids(names, itemIndex) {
    const out = [];
    for (const name of names ?? []) {
      const item = this._resolveEquipmentName(name, itemIndex);
      if (item?.uuid) out.push(item.uuid);
    }
    return out;
  }

  _resolveEquipmentNamesToDetails(names, itemIndex) {
    const details = [];
    const counts = new Map();
    for (const name of names ?? []) {
      const item = this._resolveEquipmentName(name, itemIndex);
      const key = item?.uuid || `missing:${this._slug(name)}`;
      counts.set(key, { item, name, count: (counts.get(key)?.count ?? 0) + 1 });
    }
    for (const entry of counts.values()) {
      const item = entry.item;
      details.push({
        uuid: item?.uuid ?? "",
        name: item?.name ?? this._titleCase(entry.name),
        count: entry.count,
        type: item?.type ?? "missing",
        sourceLabel: item ? this._itemSourceLabel(item) : "Not found in enabled sources",
        missing: !item?.uuid
      });
    }
    return details;
  }

  _selectedStartingEquipmentUuids(equipmentData = null) {
    const data = equipmentData ?? { classGroups: [], backgroundItems: [] };
    const uuids = [];
    for (const item of data.backgroundItems ?? []) if (item.uuid) uuids.push(item.uuid);
    for (const group of data.classGroups ?? []) {
      const selectedId = this.build.equipmentChoiceSelections?.[group.id];
      const option = group.options?.find(o => o.id === selectedId);
      if (option?.uuids?.length) uuids.push(...option.uuids);
    }
    return uuids;
  }

  async _selectedEquipmentDetails(uuids = []) {
    const details = [];
    const counts = new Map();
    for (const uuid of uuids ?? []) {
      const doc = await this._safeFromUuid(uuid);
      if (!doc) continue;
      const key = `${doc.type}:${this._slug(doc.name)}`;
      counts.set(key, { doc, uuid, count: (counts.get(key)?.count ?? 0) + 1 });
    }
    for (const entry of counts.values()) details.push({ uuid: entry.uuid, name: entry.doc.name, type: entry.doc.type, count: entry.count, sourceLabel: this._itemSourceLabel(entry.doc) });
    return details;
  }

  _markStartingEquipmentEquipped(itemData) {
    if (!itemData?.system) return itemData;
    if (["weapon", "equipment"].includes(itemData.type)) {
      if (Object.hasOwn(itemData.system, "equipped")) itemData.system.equipped = true;
      else itemData.system.equipped = true;
      if (Object.hasOwn(itemData.system, "attuned") && itemData.system.attuned === undefined) itemData.system.attuned = false;
    }
    return itemData;
  }

  async _selectEquipmentChoice(ev) {
    const groupId = ev.currentTarget.dataset.group;
    const optionId = ev.currentTarget.value;
    if (!this.build.equipmentChoiceSelections) this.build.equipmentChoiceSelections = {};
    this.build.equipmentChoiceSelections[groupId] = optionId;
    if (await this._maybePromptStepComplete("Starting Equipment")) return;
    this.render();
  }

  async _addSelectedEquipment(actor) {
    const data = await this._startingEquipmentData();
    const uuids = this._selectedStartingEquipmentUuids(data);
    const selectedGp = (data.classGroups ?? []).reduce((total, group) => {
      const selectedId = this.build.equipmentChoiceSelections?.[group.id];
      return total + Number(group.options?.find(option => option.id === selectedId)?.gp ?? 0);
    }, 0);
    const quantities = new Map();
    for (const uuid of uuids) quantities.set(uuid, (quantities.get(uuid) ?? 0) + 1);

    for (const [uuid, requestedQuantity] of quantities) {
      const doc = await fromUuid(uuid);
      if (!doc) continue;
      const slug = this._slug(doc.name);
      const alreadyPresent = actor.items.find(item => this._slug(item.name) === slug && item.type === doc.type);
      if (alreadyPresent) {
        const current = Number(alreadyPresent.system?.quantity ?? 1);
        if (requestedQuantity > current) await alreadyPresent.update({ "system.quantity": requestedQuantity });
        continue;
      }
      const itemData = doc.toObject();
      itemData.system ??= {};
      const sourceQuantity = Number(itemData.system.quantity ?? 1);
      itemData.system.quantity = Math.max(Number.isFinite(sourceQuantity) ? sourceQuantity : 1, requestedQuantity);
      this._markStartingEquipmentEquipped(itemData);
      await this._createItemsWithoutAdvancementPrompts(actor, [itemData]);
    }
    if (selectedGp > 0) {
      const currentGp = Number(actor.system?.currency?.gp ?? 0);
      if (currentGp < selectedGp) await actor.update({ "system.currency.gp": selectedGp });
    }
  }

  async _addLevelOneSpeciesFeatures(actor) {
    const speciesKey = this._selectedSpeciesKey();
    const names = SPECIES_LEVEL1_FEATURES_2024[speciesKey] ?? [];
    if (!names.length) return;

    const found = await this._findSpeciesFeatureItemsByNames(names, speciesKey);
    const foundBySlug = new Map(found.map(feature => [this._slug(feature.name), feature]));

    for (const name of names) {
      const slug = this._slug(name);
      const alreadyPresent = actor.items.some(item => item.type === "feat" && this._slug(item.name) === slug);
      if (alreadyPresent) continue;

      const feature = foundBySlug.get(slug);
      if (feature) {
        const doc = await this._safeFromUuid(feature.uuid);
        if (doc) {
          const data = this._fixLevelOneSpeciesFeatureData(doc.toObject(), speciesKey);
          await this._createItemsWithoutAdvancementPrompts(actor, [data]);
          continue;
        }
      }

      await this._createItemsWithoutAdvancementPrompts(actor, [this._fallbackSpeciesFeatureData(speciesKey, name)]);
    }
  }

  _fixLevelOneSpeciesFeatureData(itemData, speciesKey) {
    if (!itemData || typeof itemData !== "object") return itemData;
    const data = foundry.utils.deepClone(itemData);
    const slug = this._slug(data.name);

    if (speciesKey === "dragonborn" && slug === "breath-weapon") {
      const ancestry = DRAGONBORN_ANCESTRIES_2024[this.build.dragonbornAncestry];
      if (ancestry?.damageLabel) {
        data.name = `Breath Weapon (${ancestry.damageLabel})`;
        data.system ??= {};
        data.system.description ??= {};
        const existing = String(data.system.description.value ?? "");
        const note = `<p><strong>Draconic Ancestry:</strong> ${ancestry.label}. This breath weapon uses ${ancestry.damageLabel} damage.</p>`;
        if (!existing.toLowerCase().includes("draconic ancestry")) data.system.description.value = `${note}${existing}`;
      }
    }

    if (speciesKey === "dragonborn" && (slug === "damage-resistance" || slug === "draconic-resistance")) {
      const ancestry = DRAGONBORN_ANCESTRIES_2024[this.build.dragonbornAncestry];
      if (ancestry?.damageLabel) {
        data.name = `Damage Resistance (${ancestry.damageLabel})`;
        data.system ??= {};
        data.system.description ??= {};
        const existing = String(data.system.description.value ?? "");
        const note = `<p>You have resistance to ${ancestry.damageLabel} damage from your ${ancestry.label} ancestry.</p>`;
        if (!existing.toLowerCase().includes("resistance to")) data.system.description.value = `${note}${existing}`;
      }
    }

    return data;
  }

  _fallbackSpeciesFeatureData(speciesKey, name) {
    const slug = this._slug(name);
    const speciesLabel = this.build.speciesName || speciesKey || "Species";
    let description = SPECIES_FEATURE_FALLBACKS_2024[speciesKey]?.[slug] ?? `${speciesLabel} feature: ${name}.`;

    if (speciesKey === "dragonborn" && slug === "breath-weapon") {
      const ancestry = DRAGONBORN_ANCESTRIES_2024[this.build.dragonbornAncestry];
      if (ancestry?.damageLabel) {
        name = `Breath Weapon (${ancestry.damageLabel})`;
        description = `When you take the Attack action, you can replace one attack with a breath weapon from your ${ancestry.label} ancestry. It deals ${ancestry.damageLabel} damage. Check the Dragonborn species entry for the exact area, save, and scaling.`;
      }
    }

    if (speciesKey === "dragonborn" && slug === "damage-resistance") {
      const ancestry = DRAGONBORN_ANCESTRIES_2024[this.build.dragonbornAncestry];
      if (ancestry?.damageLabel) {
        name = `Damage Resistance (${ancestry.damageLabel})`;
        description = `You have resistance to ${ancestry.damageLabel} damage from your ${ancestry.label} ancestry.`;
      }
    }

    return {
      name,
      type: "feat",
      img: this._speciesChoiceIcon(this._speciesChoiceGroup()?.stateKey ?? ""),
      system: {
        description: { value: `<p>${foundry.utils.escapeHTML(description)}</p>` },
        type: { value: "race", subtype: "" },
        source: { custom: "Level One 2024 Character Builder" }
      }
    };
  }

  _divineOrderData() {
    const isCleric = this._selectedClassKey() === "cleric";
    const selected = this.build.divineOrder ?? "";
    const options = [
      { key: "protector", label: "Protector", description: "Gain training with Martial weapons and Heavy armor." },
      { key: "thaumaturge", label: "Thaumaturge", description: "Gain the Thaumaturge Divine Order feature from the selected sourcebook." }
    ].map(option => ({ ...option, checked: option.key === selected }));
    return { required: isCleric, selected, selectedLabel: options.find(o => o.key === selected)?.label ?? "None", options };
  }

  async _setDivineOrder(value) {
    if (!this._divineOrderData().required) return;
    if (!["protector", "thaumaturge"].includes(value)) return;
    this.build.divineOrder = value;
    if (await this._maybePromptStepComplete("Divine Order")) return;
    this.render();
  }

  async _addSelectedDivineOrder(actor) {
    if (this._selectedClassKey() !== "cleric") return;
    const choice = this.build.divineOrder;
    if (!["protector", "thaumaturge"].includes(choice)) return;

    const name = choice === "protector" ? "Protector" : "Thaumaturge";
    const slug = this._slug(name);
    if (actor.items.some(item => item.type === "feat" && this._slug(item.name) === slug)) return;

    const found = await this._findFeatureItemsByNames([name], "cleric");
    const entry = found.find(f => this._slug(f.name) === slug);
    let data = null;
    if (entry?.uuid) {
      const doc = await this._safeFromUuid(entry.uuid);
      if (doc) data = this._attachClassAdvancementOriginFlag(this._fixLevelOneClassFeatureData(doc.toObject(), "cleric"), actor);
    }
    if (!data) data = this._attachClassAdvancementOriginFlag(this._fallbackDivineOrderData(choice), actor);

    const created = await this._createItemsWithoutAdvancementPrompts(actor, [data]);
    await this._forceClassFeatureClassification(created, "cleric", actor);

    if (choice === "protector") await this._applyProtectorProficiencies(actor);
  }

  _fallbackDivineOrderData(choice) {
    const isProtector = choice === "protector";
    const name = isProtector ? "Protector" : "Thaumaturge";
    const description = isProtector
      ? "You gain training with Martial weapons and Heavy armor from the Cleric Divine Order feature."
      : "You gain the Thaumaturge Divine Order feature. If your installed dnd5e sourcebook includes an advancement prompt for this option, use that source item when available; otherwise add the extra cleric cantrip manually after creation.";
    return {
      name,
      type: "feat",
      img: isProtector ? "icons/equipment/chest/breastplate-cuirass-steel-grey.webp" : "icons/magic/holy/prayer-hands-glowing-yellow.webp",
      system: {
        description: { value: `<p>${foundry.utils.escapeHTML(description)}</p>` },
        type: { value: "class", subtype: "cleric" },
        requirements: this._classFeatureRequirements("cleric"),
        source: { custom: "Level One 2024 Character Builder" }
      }
    };
  }

  async _applyProtectorProficiencies(actor) {
    const updates = {};
    const weaponValues = new Set(actor.system?.traits?.weaponProf?.value ?? []);
    weaponValues.add("mar");
    updates["system.traits.weaponProf.value"] = [...weaponValues];

    const armorValues = new Set(actor.system?.traits?.armorProf?.value ?? []);
    armorValues.add("hvy");
    updates["system.traits.armorProf.value"] = [...armorValues];
    await actor.update(updates);
  }

  _primalOrderData() {
    const isDruid = this._selectedClassKey() === "druid";
    const selected = this.build.primalOrder ?? "";
    const options = [
      { key: "magician", label: "Magician", description: "Gain the Magician Primal Order feature from the selected sourcebook." },
      { key: "warden", label: "Warden", description: "Gain training with Martial weapons and Medium armor." }
    ].map(option => ({ ...option, checked: option.key === selected }));
    return { required: isDruid, selected, selectedLabel: options.find(o => o.key === selected)?.label ?? "None", options };
  }

  async _setPrimalOrder(value) {
    if (!this._primalOrderData().required) return;
    if (!["magician", "warden"].includes(value)) return;
    this.build.primalOrder = value;
    if (await this._maybePromptStepComplete("Primal Order")) return;
    this.render();
  }

  async _addSelectedPrimalOrder(actor) {
    if (this._selectedClassKey() !== "druid") return;
    const choice = this.build.primalOrder;
    if (!["magician", "warden"].includes(choice)) return;

    const name = choice === "magician" ? "Magician" : "Warden";
    const slug = this._slug(name);
    if (actor.items.some(item => item.type === "feat" && this._slug(item.name) === slug)) {
      if (choice === "warden") await this._applyWardenProficiencies(actor);
      return;
    }

    const found = await this._findFeatureItemsByNames([name], "druid");
    const entry = found.find(f => this._slug(f.name) === slug);
    let data = null;
    if (entry?.uuid) {
      const doc = await this._safeFromUuid(entry.uuid);
      if (doc) data = this._attachClassAdvancementOriginFlag(this._fixLevelOneClassFeatureData(doc.toObject(), "druid"), actor);
    }
    if (!data) data = this._attachClassAdvancementOriginFlag(this._fallbackPrimalOrderData(choice), actor);

    const created = await this._createItemsWithoutAdvancementPrompts(actor, [data]);
    await this._forceClassFeatureClassification(created, "druid", actor);

    if (choice === "warden") await this._applyWardenProficiencies(actor);
  }

  _fallbackPrimalOrderData(choice) {
    const isWarden = choice === "warden";
    const name = isWarden ? "Warden" : "Magician";
    const description = isWarden
      ? "You gain training with Martial weapons and Medium armor from the Druid Primal Order feature."
      : "You gain the Magician Primal Order feature. If your installed dnd5e sourcebook includes an advancement prompt for this option, use that source item when available; otherwise add the extra druid cantrip manually after creation.";
    return {
      name,
      type: "feat",
      img: isWarden ? "icons/equipment/chest/breastplate-cuirass-steel-grey.webp" : "icons/magic/nature/leaf-glow-maple-orange.webp",
      system: {
        description: { value: `<p>${foundry.utils.escapeHTML(description)}</p>` },
        type: { value: "class", subtype: "druid" },
        requirements: this._classFeatureRequirements("druid"),
        source: { custom: "Level One 2024 Character Builder" }
      }
    };
  }

  async _applyWardenProficiencies(actor) {
    const updates = {};
    const weaponValues = new Set(actor.system?.traits?.weaponProf?.value ?? []);
    weaponValues.add("mar");
    updates["system.traits.weaponProf.value"] = [...weaponValues];

    const armorValues = new Set(actor.system?.traits?.armorProf?.value ?? []);
    armorValues.add("med");
    updates["system.traits.armorProf.value"] = [...armorValues];
    await actor.update(updates);
  }

  /**
   * The 2024 PHB Fighting Style options a Fighter chooses from at level 1
   * (Paladin and Ranger also get a Fighting Style, but not until level 2, so
   * this level-1-only builder never needs to offer it for them). These are
   * resolved by name against the GM's configured sourcebook packs first (see
   * _addSelectedFightingStyle below) exactly like Divine Order/Primal Order -
   * when the real compendium item is found, its own authored mechanics are
   * used as-is. The description/changes below are only a fallback for a
   * world missing that content.
   */
  static FIGHTING_STYLE_OPTIONS_2024 = [
    { key: "archery", label: "Archery", description: "+2 bonus to attack rolls you make with ranged weapons.", changes: [{ key: "system.bonuses.rwak.attack", mode: 2, value: "2" }] },
    { key: "blind-fighting", label: "Blind Fighting", description: "You gain Blindsight with a range of 10 feet." },
    { key: "defense", label: "Defense", description: "+1 bonus to Armor Class while wearing armor.", changes: [{ key: "system.attributes.ac.bonus", mode: 2, value: "1" }] },
    { key: "dueling", label: "Dueling", description: "+2 bonus to damage rolls while wielding a melee weapon in one hand and no other weapons.", changes: [{ key: "system.bonuses.mwak.damage", mode: 2, value: "2" }] },
    { key: "great-weapon-fighting", label: "Great Weapon Fighting", description: "Reroll a 1 or 2 on a damage die for a two-handed or versatile melee weapon attack; the new roll must be used." },
    { key: "interception", label: "Interception", description: "Reaction to reduce damage to a nearby ally you can see, if wielding a shield or a simple/martial weapon." },
    { key: "protection", label: "Protection", description: "Reaction to impose disadvantage on an attack against a nearby ally, if wielding a shield." },
    { key: "thrown-weapon-fighting", label: "Thrown Weapon Fighting", description: "Draw a thrown weapon as part of the attack, and +2 bonus to damage rolls with thrown weapons.", changes: [{ key: "system.bonuses.rwak.damage", mode: 2, value: "2" }] },
    { key: "two-weapon-fighting", label: "Two-Weapon Fighting", description: "Add your ability modifier to the damage of the second attack when two-weapon fighting." }
  ];

  async _fightingStyleData() {
    const isFighter = this._selectedClassKey() === "fighter";
    const selected = this.build.fightingStyle ?? "";
    const options = LevelOne2024Builder.FIGHTING_STYLE_OPTIONS_2024.map(option => ({ ...option, checked: option.key === selected }));
    return { required: isFighter, selected, selectedLabel: options.find(o => o.key === selected)?.label ?? "None", options };
  }

  async _setFightingStyle(value) {
    const data = await this._fightingStyleData();
    if (!data.required) return;
    if (!data.options.some(o => o.key === value)) return;
    this.build.fightingStyle = value;
    if (await this._maybePromptStepComplete("Class Choices")) return;
    this.render();
  }

  async _addSelectedFightingStyle(actor) {
    if (this._selectedClassKey() !== "fighter") return;
    const choice = LevelOne2024Builder.FIGHTING_STYLE_OPTIONS_2024.find(o => o.key === this.build.fightingStyle);
    if (!choice) return;

    const slug = this._slug(choice.label);
    if (actor.items.some(item => item.type === "feat" && this._slug(item.name) === slug)) return;

    const found = await this._findFeatureItemsByNames([choice.label], "fighter");
    const entry = found.find(f => this._slug(f.name) === slug);
    let data = null;
    if (entry?.uuid) {
      const doc = await this._safeFromUuid(entry.uuid);
      if (doc) data = this._attachClassAdvancementOriginFlag(this._fixLevelOneClassFeatureData(doc.toObject(), "fighter"), actor);
    }
    if (!data) data = this._attachClassAdvancementOriginFlag(this._fallbackFightingStyleData(choice), actor);

    const created = await this._createItemsWithoutAdvancementPrompts(actor, [data]);
    await this._forceClassFeatureClassification(created, "fighter", actor);
  }

  _fallbackFightingStyleData(choice) {
    return {
      name: choice.label,
      type: "feat",
      img: "icons/skills/melee/strike-slashes-red.webp",
      system: {
        description: { value: `<p>${foundry.utils.escapeHTML(choice.description)}</p>` },
        type: { value: "class", subtype: "fighter" },
        requirements: this._classFeatureRequirements("fighter"),
        source: { custom: "Level One 2024 Character Builder" }
      },
      effects: choice.changes ? [{
        name: `Fighting Style: ${choice.label}`,
        type: "base",
        disabled: false,
        transfer: true,
        changes: choice.changes.map(change => ({ ...change, priority: 20 }))
      }] : []
    };
  }

  async _addLevelOneClassFeatures(actor) {
    const classKey = this._selectedClassKey();
    const names = CLASS_LEVEL1_FEATURES_2024[classKey] ?? [];
    if (!names.length) return;
    const features = await this._findFeatureItemsByNames(names, classKey);
    for (const feature of features) {
      const slug = this._slug(feature.name);
      const alreadyPresent = actor.items.some(item => item.type === "feat" && this._slug(item.name) === slug);
      if (alreadyPresent) continue;
      const doc = await this._safeFromUuid(feature.uuid);
      if (!doc) continue;
      const data = this._attachClassAdvancementOriginFlag(this._fixLevelOneClassFeatureData(doc.toObject(), classKey), actor);
      const created = await this._createItemsWithoutAdvancementPrompts(actor, [data]);
      await this._forceClassFeatureClassification(created, classKey, actor);
    }
  }

  _classFeatureRequirements(classKey = null) {
    const key = classKey || this._selectedClassKey() || "class";
    const className = this.build.className || this.cache.classes.find(c => c.uuid === this.build.classUuid)?.name || key || "Class";
    // Keep the normal human-readable requirements value, but do not rely on it
    // for sheet grouping. dnd5e 3+ groups by advancement origin, not just this
    // field, when the sheet is in its default feature grouping mode.
    return `${className} 1`;
  }

  _actorOriginItem(actor, type, uuid, fallbackName = "") {
    if (!actor) return null;
    const expectedSlug = this._slug(fallbackName || "");
    const originalId = String(uuid ?? "").split(".").pop();
    return actor.items.find(item => {
      if (item.type !== type) return false;
      if (expectedSlug && this._slug(item.name) === expectedSlug) return true;
      const sourceId = String(item.flags?.core?.sourceId ?? item.flags?.dnd5e?.sourceId ?? "");
      return originalId && sourceId.endsWith(originalId);
    }) ?? actor.items.find(item => item.type === type && expectedSlug && this._slug(item.name).includes(expectedSlug));
  }

  _selectedClassOriginItem(actor) {
    return this._actorOriginItem(actor, "class", this.build.classUuid, this.build.className)
      ?? actor?.items?.find?.(item => item.type === "class")
      ?? null;
  }

  _selectedClassOriginId(actor) {
    return this._selectedClassOriginItem(actor)?.id ?? null;
  }

  _attachClassAdvancementOriginFlag(itemData, actor) {
    const originId = this._selectedClassOriginId(actor);
    if (!originId || !itemData) return itemData;
    itemData.flags = foundry.utils.mergeObject(itemData.flags ?? {}, { dnd5e: { advancementOrigin: originId } }, { inplace: false });
    return itemData;
  }

  async _forceClassFeatureClassification(items, classKey = null, actor = null) {
    const subtype = classKey || this._selectedClassKey() || "class";
    const requirements = this._classFeatureRequirements(subtype);
    const originId = this._selectedClassOriginId(actor ?? items?.[0]?.actor ?? items?.[0]?.parent);
    for (const item of items ?? []) {
      if (!item || item.type !== "feat") continue;
      try {
        const updates = {
          "system.type.value": "class",
          "system.type.subtype": subtype,
          "system.requirements": requirements
        };
        if (originId) updates["flags.dnd5e.advancementOrigin"] = originId;
        await item.update(updates);
        if (originId && item.getFlag?.("dnd5e", "advancementOrigin") !== originId) {
          await item.setFlag("dnd5e", "advancementOrigin", originId);
        }
      } catch (err) {
        console.warn(`${MODULE_ID} | Could not force class feature classification for ${item.name}`, err);
      }
    }
  }

  async _repairBuilderClassFeatureClassifications(actor) {
    const classKey = this._selectedClassKey();
    if (!classKey) return;
    const names = new Set((CLASS_LEVEL1_FEATURES_2024[classKey] ?? []).map(name => this._slug(name)));
    if (classKey === "cleric" && this.build.divineOrder) names.add(this._slug(this.build.divineOrder === "protector" ? "Protector" : "Thaumaturge"));
    if (classKey === "druid" && this.build.primalOrder) names.add(this._slug(this.build.primalOrder === "magician" ? "Magician" : "Warden"));
    if (classKey === "fighter" && this.build.fightingStyle) {
      const style = LevelOne2024Builder.FIGHTING_STYLE_OPTIONS_2024.find(o => o.key === this.build.fightingStyle);
      if (style) names.add(this._slug(style.label));
    }
    for (const detail of await this._selectedWeaponMasteryDetails()) names.add(this._slug(`Weapon Mastery: ${detail.name}`));
    const items = actor.items.filter(item => item.type === "feat" && names.has(this._slug(item.name)));
    await this._forceClassFeatureClassification(items, classKey, actor);
  }


  _fixLevelOneClassFeatureData(itemData, classKey) {
    if (!itemData || typeof itemData !== "object") return itemData;
    const data = foundry.utils.deepClone(itemData);
    const slug = this._slug(data.name);

    data.system ??= {};
    data.system.type ??= {};
    data.type = "feat";
    data.system.type.value = "class";
    data.system.type.subtype = classKey || data.system.type.subtype || "class";
    data.system.requirements = this._classFeatureRequirements(classKey);

    // A handful of level-1 class features ship from the compendium with
    // uses.max left at a placeholder value that never scales - either a flat
    // 0 (the dnd5e system expects something else to fill in the live formula,
    // which normally happens the first time Foundry's native Advancement
    // Manager grants the feature) or a flat number that only happens to be
    // right for one specific ability score. This builder suppresses that
    // manager entirely (its own wizard owns level 1 instead), so nothing else
    // was ever going to fill these in. Rage was the first of these found
    // (reported directly by a user - see the v1.10.3 changelog); auditing
    // every other level-1 feature this builder imports against the same
    // compendium turned up three more: two with the identical
    // frozen-at-0-forever problem (Second Wind, Favored Enemy), one whose
    // pool isn't backed by a class ScaleValue at all and needs a direct level
    // formula instead (Lay on Hands), and one that scales with an ability
    // modifier rather than class level but was still shipped as a flat
    // number regardless of that modifier (Bardic Inspiration). uses.max is a
    // deterministic FormulaField (see dnd5e's UsesField), evaluated fresh
    // against current roll data on every access - once set to a live formula
    // here, it never needs to be (and must not be) recomputed by this
    // builder again after creation, including as the character levels up (or
    // simply improves an ability score) normally afterward.
    const LEVEL_ONE_FEATURE_USES_FORMULAS = {
      "barbarian:rage": "@scale.barbarian.rages",
      "fighter:second-wind": "@scale.fighter.second-wind",
      "ranger:favored-enemy": "@scale.ranger.favored-enemy",
      // Paladin's Lay on Hands healing pool has no dedicated ScaleValue on the
      // class item (unlike the three above) - the 2024 rule is a flat 5 hit
      // points per paladin level, so it's computed directly from the actor's
      // class level instead of a scale lookup.
      "paladin:lay-on-hands": "5 * @classes.paladin.levels",
      // Bardic Inspiration's uses are a Charisma modifier (minimum 1), not a
      // class-level scale value at all - the compendium ships it as a flat
      // "1", which only happens to be correct for a Bard with +1 Cha or less.
      "bard:bardic-inspiration": "max(1, @abilities.cha.mod)"
    };
    const usesFormula = LEVEL_ONE_FEATURE_USES_FORMULAS[`${classKey}:${slug}`];
    if (usesFormula) {
      data.system ??= {};
      data.system.uses ??= {};
      data.system.uses.max = usesFormula;
      if (typeof data.system.uses.spent !== "number") data.system.uses.spent = 0;
      delete data.system.uses.value;
    }

    return data;
  }

  /**
   * Resolves class-level-1 feature names against ONLY the packs the GM has
   * configured for "Class Features / Invocations", honoring any manual
   * override pinned in the Feature Overrides settings menu first. This is
   * the fix for the historical "wrong sourcebook item" bug (e.g. importing
   * Monk's Unarmored Defense for a Barbarian): candidates are never pulled
   * from compendiums the GM hasn't approved for this category, and ties
   * between same-named features across approved packs are broken
   * deterministically instead of depending on pack scan order.
   */
  async _findFeatureItemsByNames(names, classKey = null) {
    return resolveFeaturesByName({
      names,
      sourceType: "classFeatures",
      contextKey: classKey ? OVERRIDE_CONTEXT.classFeature(classKey) : null,
      matchKey: classKey,
      otherKeys: Object.keys(CLASS_LEVEL1_FEATURES_2024),
      fallbackSourceTypes: ["feats"]
    });
  }

  /**
   * Same as above, but for a species's level-1 feature names, scoped to the
   * "Species Features" content category.
   */
  async _findSpeciesFeatureItemsByNames(names, speciesKey = null) {
    return resolveFeaturesByName({
      names,
      sourceType: "speciesFeatures",
      contextKey: speciesKey ? OVERRIDE_CONTEXT.speciesFeature(speciesKey) : null,
      matchKey: speciesKey,
      otherKeys: Object.keys(SPECIES_LEVEL1_FEATURES_2024),
      fallbackSourceTypes: ["species", "classFeatures", "feats"]
    });
  }

  _languageOptions() {
    const selected = new Set(this.build.languageChoices ?? []);
    const search = this.build.searches?.languages ?? "";
    return languageChoices()
      .filter(language => this._matchesSearch(language, search))
      .map(language => ({
        ...language,
        checked: selected.has(language.key),
        disabled: !selected.has(language.key) && selected.size >= DEFAULT_LANGUAGE_CHOICE_COUNT
      }));
  }

  _selectedLanguageDetails() {
    const byKey = new Map(languageChoices().map(language => [language.key, language.label]));
    return (this.build.languageChoices ?? []).map(key => ({ key, label: byKey.get(key) ?? key }));
  }

  async _toggleLanguage(ev) {
    const checked = ev.currentTarget.checked;
    const value = ev.currentTarget.value;
    if (checked && (this.build.languageChoices ?? []).length >= DEFAULT_LANGUAGE_CHOICE_COUNT && !this.build.languageChoices.includes(value)) {
      ui.notifications.warn(`Choose exactly ${DEFAULT_LANGUAGE_CHOICE_COUNT} languages.`);
      ev.currentTarget.checked = false;
      return;
    }
    this._toggleArrayValue(this.build.languageChoices, value, checked);
    if (await this._maybePromptStepComplete("Languages")) return;
    this.render();
  }


  async _pickWeaponMasteriesFromDnd5eBrowser() {
    const prompt = this._selectedClassPrompt()?.masteries;
    const required = prompt?.count ?? 0;
    if (!required) return ui.notifications.warn("This class does not receive weapon mastery choices at level 1 in this builder.");

    if (!this.cache.items.length) await this._loadOptions();
    const options = this._baseWeaponMasteryOptions();
    if (!options.length) {
      return ui.notifications.error("No base weapon items with mastery properties were found in the enabled character creation sources.");
    }

    const current = [...(this.build.weaponMasteryUuids ?? [])];
    while (current.length < required) current.push("");

    const rows = Array.from({ length: required }, (_unused, index) => {
      const selectOptions = options.map(option => {
        const selected = current[index] === option.uuid ? "selected" : "";
        const label = `${option.name} — ${option.masteryLabel}`;
        return `<option value="${option.uuid}" ${selected}>${foundry.utils.escapeHTML(label)}</option>`;
      }).join("");
      return `
        <div class="form-group">
          <label>Weapon ${index + 1}</label>
          <select name="weapon${index}">
            <option value="">Choose a base weapon...</option>
            ${selectOptions}
          </select>
        </div>`;
    }).join("");

    const content = themedDialogHtml(`
      <p>Choose exactly ${required} base weapon type${required === 1 ? "" : "s"} for Weapon Mastery. These are filtered to base weapons only, not magic weapons, premades, or creature attacks.</p>
      ${rows}`);

    const selected = await new Promise(resolve => {
      new Dialog({
        title: "Choose Weapon Masteries",
        content,
        buttons: {
          choose: {
            icon: '<i class="fas fa-check"></i>',
            label: "Choose",
            callback: html => {
              const values = Array.from({ length: required }, (_unused, index) => html.find(`select[name="weapon${index}"]`).val()).filter(Boolean);
              resolve(values);
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => resolve(null)
          }
        },
        default: "choose",
        close: () => resolve(null)
      }, themedDialogOptions()).render(true);
    });

    if (!selected) return;
    const unique = Array.from(new Set(selected));
    if (unique.length !== required) {
      return ui.notifications.warn(`Choose ${required} different base weapon${required === 1 ? "" : "s"} for Weapon Mastery.`);
    }

    this.build.weaponMasteryUuids = unique;
    const details = await this._selectedWeaponMasteryDetails();
    ui.notifications.info(`Selected weapon masteries: ${details.map(d => d.name).join(", ")}`);
    this.render();
  }

  _baseWeaponMasteryOptions() {
    const byKey = new Map();
    for (const weapon of this.cache.weapons ?? []) {
      const key = this._weaponMasteryKey(weapon);
      const base = BASE_WEAPON_MASTERIES_2024[key];
      if (!base) continue;
      const mastery = this._weaponMasteryProperty(weapon) || base.mastery;
      if (!mastery) continue;

      const option = {
        uuid: weapon.uuid,
        key,
        name: base.name,
        mastery,
        masteryLabel: this._weaponMasteryLabel(mastery),
        pack: weapon.pack,
        originalName: weapon.name
      };

      const existing = byKey.get(key);
      if (!existing || this._weaponOptionScore(option) > this._weaponOptionScore(existing)) byKey.set(key, option);
    }

    return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  _weaponOptionScore(option) {
    const nameScore = this._slug(option.originalName) === option.key ? 50 : 0;
    const pack = String(option.pack ?? "").toLowerCase();
    const packScore = pack.includes("phb") || pack.includes("players-handbook") ? 25 : pack.startsWith("dnd5e.") ? 10 : 0;
    return nameScore + packScore;
  }

  async _selectedWeaponMasteryDetails() {
    const details = [];
    for (const uuid of this.build.weaponMasteryUuids ?? []) {
      const doc = await this._safeFromUuid(uuid);
      if (!doc) continue;
      const key = this._weaponMasteryKey(doc);
      const mastery = this._weaponMasteryProperty(doc);
      details.push({
        uuid,
        name: doc.name,
        key,
        mastery,
        masteryLabel: this._weaponMasteryLabel(mastery)
      });
    }
    return details;
  }

  _weaponMasteryProperty(item) {
    const mastery = item?.system?.mastery;
    if (typeof mastery === "string") return mastery;
    if (mastery?.value) return mastery.value;
    if (mastery?.property) return mastery.property;
    return "";
  }

  _weaponMasteryLabel(mastery) {
    if (!mastery) return "Mastery";
    const entry = CONFIG?.DND5E?.weaponMasteries?.[mastery];
    const label = entry?.label ?? entry;
    return game.i18n?.localize(label) ?? String(label ?? mastery);
  }

  _weaponMasteryKey(item) {
    const type = item?.system?.type ?? {};
    const candidates = [
      type.baseItem,
      type.base,
      item?.system?.baseItem,
      item?.system?.identifier,
      item?.identifier,
      type.value
    ].filter(Boolean).map(String);

    for (const candidate of candidates) {
      const slug = this._slug(candidate);
      if (slug && !["simple", "martial", "simplem", "martialm", "natural"].includes(slug)) return slug;
    }
    return this._slug(item?.name ?? "");
  }

  async _weaponMasteryUpdates(actor) {
    const keys = [];
    for (const uuid of this.build.weaponMasteryUuids ?? []) {
      const doc = await this._safeFromUuid(uuid);
      const key = doc ? this._weaponMasteryKey(doc) : "";
      if (key) keys.push(key);
    }
    if (!keys.length) return {};

    const currentMastery = actor.system?.traits?.weaponProf?.mastery ?? {};
    const current = Array.isArray(currentMastery.value) ? currentMastery.value : [];
    const merged = Array.from(new Set([...current, ...keys]));
    return { "system.traits.weaponProf.mastery.value": merged };
  }


  async _addWeaponMasteryFeatureItems(actor) {
    const details = await this._selectedWeaponMasteryDetails();
    if (!details.length) return;
    const itemData = [];
    for (const detail of details) {
      const name = `Weapon Mastery: ${detail.name}`;
      const exists = actor.items.some(item => item.type === "feat" && item.name === name);
      if (exists) continue;
      itemData.push({
        name,
        type: "feat",
        img: "icons/skills/melee/strike-weapon-polearm-ice-blue.webp",
        system: {
          description: { value: `<p>You have mastery with ${foundry.utils.escapeHTML(detail.name)}. Mastery property: <strong>${foundry.utils.escapeHTML(detail.masteryLabel || detail.mastery || "Mastery")}</strong>.</p>` },
          type: { value: "class", subtype: this._selectedClassKey() || "class" },
          source: { custom: "Level One 2024 Character Builder" }
        }
      });
    }
    if (itemData.length) {
      const created = await this._createItemsWithoutAdvancementPrompts(actor, itemData.map(data => this._attachClassAdvancementOriginFlag(data, actor)));
      await this._forceClassFeatureClassification(created, this._selectedClassKey(), actor);
    }
  }

  async _setLevelOneHitPoints(actor) {
    const classKey = this._selectedClassKey();
    const die = CLASS_HIT_DIE_2024[classKey];
    if (!die) return;
    const con = Number(actor.system?.abilities?.con?.value ?? this.build.baseAbilities?.con ?? 10);
    const conMod = Math.floor((con - 10) / 2);
    const startingHp = Math.max(1, die + conMod);

    // IMPORTANT: never write system.attributes.hp.max directly here. dnd5e's
    // character data model only derives hp.max from the class's HitPoints
    // advancement when hp.max is null in the *source* data
    // (CharacterData#prepareBaseData / AttributesFields.prepareHitPoints) - a
    // stored number here would permanently disable that derivation for this
    // actor, so hp.max would never increase again on any future level-up
    // through Foundry's native Advancement Manager, for any class, for the
    // rest of the character's life. This was a real bug in earlier versions:
    // it silently froze max HP at whatever it was on the day the character
    // was built. _setInitialHitPointsAdvancementValue() already recorded
    // "max" for level 1 on the class item's own HitPoints advancement before
    // it was created on the actor, so dnd5e now derives hp.max itself,
    // correctly, forever - all that's left to do is set the starting current
    // HP to match.
    await actor.update({
      "system.attributes.hp.value": startingHp,
      "system.attributes.hp.temp": 0,
      "system.attributes.hp.tempmax": 0
    });
  }

  _setActorMode(mode) {
    this.build.actorMode = mode === "existing" ? "existing" : "new";
    if (this.build.actorMode === "new") {
      this.build.selectedActorId = "";
      this.targetActor = null;
    }
    this.render();
  }

  _setSelectedActor(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor || actor.type !== "character" || (!game.user.isGM && !actor.isOwner)) {
      this.build.selectedActorId = "";
      this.targetActor = null;
      return this.render();
    }

    this.build.actorMode = "existing";
    this.build.selectedActorId = actor.id;
    this.targetActor = actor;
    if (!this.build.name?.trim()) this.build.name = actor.name;
    this.render();
  }

  _sourcePackSummary() {
    const selections = parseSourceTypePackSetting(game.settings.get(MODULE_ID, "selectedPacksByContentType") || "");
    const ids = new Set();
    const byType = {};
    for (const key of SOURCE_TYPE_ORDER) {
      const packIds = packIdsForSourceType(key, selections);
      byType[key] = { label: SOURCE_TYPE_SETTINGS[key].label, count: packIds.length, ids: packIds, mode: sourceTypeSelectionMode(selections[key]) === "auto" ? "Automatic" : "Manual" };
      for (const id of packIds) ids.add(id);
    }
    return {
      mode: "Per content type",
      count: ids.size,
      ids: [...ids],
      byType
    };
  }

  async _loadOptions() {
    const sourceSelections = parseSourceTypePackSetting(game.settings.get(MODULE_ID, "selectedPacksByContentType") || "");
    const packIdsByType = Object.fromEntries(SOURCE_TYPE_ORDER.map(key => [key, packIdsForSourceType(key, sourceSelections)]));
    const packTypeMembership = new Map();
    for (const [key, ids] of Object.entries(packIdsByType)) {
      for (const id of ids) {
        if (!packTypeMembership.has(id)) packTypeMembership.set(id, new Set());
        packTypeMembership.get(id).add(key);
      }
    }
    const packIds = [...packTypeMembership.keys()];

    // Do not add dnd5e.classes to the option cache here. The selected class is
    // normalized to that canonical pack lazily during selection/finish, which
    // keeps the builder window responsive while still creating validated class
    // items on the actor.

    const items = [];
    if (!packIds.length) console.warn(`${MODULE_ID} | No dnd5e Item compendiums were detected. Open Character Creation Sources in module settings.`);
    for (const packId of packIds) {
      const pack = game.packs.get(packId);
      if (!pack || pack.metadata.type !== "Item") continue;
      const index = await pack.getIndex({ fields: ["type", "system.level", "system.source", "system.identifier", "system.type", "system.mastery", "system.baseItem", "system.rarity", "system.description.value", "system.properties", "system.activities", "system.preparation", "system.ritual"] });
      const sourceTypes = [...(packTypeMembership.get(packId) ?? [])];
      for (const entry of index) {
        items.push({
          name: entry.name,
          img: entry.img,
          type: entry.type,
          uuid: `Compendium.${pack.collection}.${entry._id}`,
          system: entry.system ?? {},
          pack: pack.collection,
          sourceTypes
        });
      }
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    const inSourceType = (item, key) => Array.isArray(item.sourceTypes) && item.sourceTypes.includes(key);
    this.cache.items = items;
    this.cache.species = items.filter(i => inSourceType(i, "species") && ["race", "species"].includes(i.type) && !isStandaloneLineageOption(i));
    this.cache.backgrounds = items.filter(i => inSourceType(i, "backgrounds") && i.type === "background");
    this.cache.classes = items.filter(i => inSourceType(i, "classes") && i.type === "class");
    this.cache.spells = items.filter(i => inSourceType(i, "spells") && i.type === "spell");
    this.cache.weapons = items.filter(i => inSourceType(i, "equipment") && i.type === "weapon");
    this.cache.equipment = items.filter(i => inSourceType(i, "equipment") && ["weapon", "equipment", "consumable", "tool", "loot", "container", "backpack"].includes(i.type));
    this.cache.feats = items.filter(i => (inSourceType(i, "feats") || inSourceType(i, "classFeatures")) && i.type === "feat");
    this.originFeatOptionsLoaded = false;
    this.originFeatOptionsLoading = null;
  }

  _emptyOriginFeatData() {
    return {
      requiredExtra: this._isHumanSpecies() ? 1 : 0,
      isHuman: this._isHumanSpecies(),
      options: [],
      selected: [],
      excludedBackgroundFeatName: this._backgroundOriginFeatName(),
      excludedBackgroundFeatSlugs: [...this._selectedBackgroundOriginFeatSlugs()]
    };
  }

  async _ensureOfficialOriginFeatOptionsLoaded() {
    if (this.originFeatOptionsLoaded) return;
    if (this.originFeatOptionsLoading) return this.originFeatOptionsLoading;
    this.originFeatOptionsLoading = this._loadOfficialOriginFeatOptions()
      .then(() => { this.originFeatOptionsLoaded = true; })
      .finally(() => { this.originFeatOptionsLoading = null; });
    return this.originFeatOptionsLoading;
  }

  async _loadOfficialOriginFeatOptions() {
    const seen = new Set((this.cache.feats ?? []).map(f => f.uuid));

    // Human's extra origin feat should come from the installed sourcebooks, not
    // just the packs currently selected for species/background/class. Some 2024
    // PHB/Free Rules feat packs are separate from the character-origin packs, so
    // scan every Item compendium that looks dnd5e-ish and exclude known automation
    // or premade packs. This avoids the partial four-feat list caused by only
    // seeing SRD/background-linked feat entries.
    const packs = game.packs
      .filter(pack => pack.metadata?.type === "Item")
      .filter(pack => {
        // Be deliberately broad here. Some official/premium feat compendiums do
        // not advertise themselves with an obvious dnd5e/package id in metadata,
        // and the previous filter missed those packs. Exclude known automation /
        // premade rider packs, then inspect every remaining Item pack for real
        // dnd5e origin feat documents.
        const metadata = pack.metadata ?? {};
        const haystack = [pack.collection, metadata.id, metadata.label, metadata.packageName, metadata.system]
          .filter(Boolean).join(" ").toLowerCase();
        return !(haystack.includes("cauldron")
          || haystack.includes("plentiful resources")
          || haystack.includes("gambit")
          || haystack.includes("premade")
          || haystack.includes("midi")
          || haystack.includes("dae")
          || haystack.includes("automation")
          || haystack.includes("rider"));
      });

    for (const pack of packs) {
      try {
        const index = await pack.getIndex({
          fields: ["type", "system.source", "system.identifier", "system.type", "system.category", "system.requirements", "system.advancement", "system.description.value"]
        });

        const wantedOriginNames = this._originFeatNameSet();

        for (const entry of index) {
          const indexNameSlug = this._originFeatSlugFromName(entry.name);

          // Do not trust compendium indexes to expose type/system fields for
          // premium packs. Some official PHB feat packs only reveal enough data
          // after getDocument(). Load any entry that either looks like a feat in
          // the index OR has a known 2024 origin feat name.
          const shouldInspect = entry.type === "feat" || wantedOriginNames.has(indexNameSlug);
          if (!shouldInspect) continue;

          let item = {
            name: entry.name,
            type: entry.type ?? "feat",
            uuid: `Compendium.${pack.collection}.${entry._id}`,
            system: entry.system ?? {},
            pack: pack.collection
          };
          if (seen.has(item.uuid)) continue;

          // Always load the full document for known origin feat names. This is
          // important for PHB 2024, where index metadata can be incomplete.
          //
          // Deliberately narrow: only escalate to a full getDocument() call
          // when the entry's NAME (via the alias/suffix-normalizing
          // _originFeatSlugFromName, which already folds every known 2024
          // origin feat name variant - "Magic Initiate (Cleric) 2024" and
          // the rest - back to the same canonical slug) matches the known
          // origin feat list. This used to also fire for ANY feat-typed
          // entry that didn't already look like an origin feat from index
          // data alone - which in practice meant a full document load for
          // every single non-origin feat in every installed Item compendium
          // in the world (class features, general feats, epic boons, all of
          // it), fully sequential. In a world with more than a handful of
          // feat compendiums that is dozens to hundreds of awaited
          // getDocument() calls just to build the Human origin-feat list,
          // and was the actual cause of a ~30 second hang moving from
          // "Background Ability Scores" into "Human Choices" (reported by a
          // user). A real origin feat whose index data doesn't self-report
          // as origin is still always caught below by name; nothing that
          // was findable before is missed by this change.
          if (wantedOriginNames.has(indexNameSlug)) {
            const doc = await pack.getDocument(entry._id);
            if (!doc) continue;
            item = {
              name: doc.name,
              type: doc.type,
              uuid: doc.uuid,
              system: doc.system ?? {},
              pack: pack.collection
            };
          }

          if (!this._isOriginFeatCandidate(item)) continue;

          this.cache.feats.push(item);
          seen.add(item.uuid);
        }
      } catch (err) {
        console.warn(`${MODULE_ID} | Could not scan ${pack.collection} for origin feats`, err);
      }
    }
  }

  _allowedPackIds(sourceType = null) {
    if (sourceType) return packIdsForSourceType(sourceType);

    const selections = parseSourceTypePackSetting(game.settings.get(MODULE_ID, "selectedPacksByContentType") || "");
    const ids = new Set();
    for (const key of SOURCE_TYPE_ORDER) for (const id of packIdsForSourceType(key, selections)) ids.add(id);
    if (ids.size) return [...ids];

    const legacyRaw = game.settings.get(MODULE_ID, "allowedItemPacks")?.trim();
    if (legacyRaw) return parseSelectedPackSetting(legacyRaw);

    const selectedRaw = game.settings.get(MODULE_ID, "selectedItemPacks") ?? "__auto__";
    if (selectedRaw === "__auto__") return automaticPackIds();

    const selected = parseSelectedPackSetting(selectedRaw);
    return selected.length ? selected : automaticPackIds();
  }

  _setAbilityMethod(methodId) {
    const method = getAbilityMethod(methodId);
    this.build.abilityMethod = method.id;
    this.build.rolledScores = [];
    this.build.rerollRequestPending = false;
    this.build.pendingRerollMethod = "";

    if (method.type === "array") {
      this.build.availableScores = [...method.scores];
      // Do not auto-assign array scores. Players choose where each score goes.
      this.build.baseAbilities = Object.fromEntries(ABILITIES.map(ability => [ability, ""]));
    }

    if (method.type === "pointbuy") {
      this.build.availableScores = [];
      this.build.baseAbilities = Object.fromEntries(ABILITIES.map(ability => [ability, method.min ?? 8]));
    }

    if (method.type === "roll") {
      this.build.availableScores = [];
      this.build.baseAbilities = Object.fromEntries(ABILITIES.map(ability => [ability, 8]));
    }

    if (method.type === "manual") {
      this.build.availableScores = [];
      this.build.baseAbilities = Object.fromEntries(ABILITIES.map(ability => [ability, method.min ?? 10]));
    }

    this.render();
  }

  async _rollScores(method) {
    if (this.build.rolledScores.length && getAbilityMethod(this.build.abilityMethod)?.type === "roll") {
      if (game.user.isGM) {
        return Dialog.confirm({
          title: "Reroll Ability Scores?",
          content: themedDialogHtml("<p>This character already has rolled ability scores. Rerolling will replace the current score pool.</p>"),
          yes: () => this._performRollScores(method, { approved: true }),
          no: () => {},
          defaultYes: false,
          options: themedDialogOptions()
        });
      }

      return this._requestRerollApproval(method);
    }

    return this._performRollScores(method, { approved: true });
  }

  async _requestRerollApproval(method) {
    if (this.build.rerollRequestPending) {
      return ui.notifications.warn("A reroll request is already pending with the GM.");
    }

    const gmUsers = game.users.filter(u => u.isGM && u.active);
    if (!gmUsers.length) {
      return ui.notifications.warn("No active GM is available to approve a reroll.");
    }

    this.build.rerollRequestPending = true;
    this.build.pendingRerollMethod = method;

    const methodLabel = getAbilityMethod(method)?.label ?? method;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: game.user.name }),
      whisper: gmUsers.map(u => u.id),
      content: `
        <div class="level-one-2024-reroll-request">
          <p><strong>${game.user.name}</strong> requests permission to reroll ability scores using <strong>${methodLabel}</strong>.</p>
          <button type="button" data-l12024-reroll-approve data-user-id="${game.user.id}" data-method="${method}">Approve Reroll</button>
        </div>
      `
    });

    ui.notifications.info("Reroll request sent to the GM.");
    this.render();
  }

  async _performRollScores(methodId, { approved = false } = {}) {
    if (!approved) return;

    const method = getAbilityMethod(methodId);
    if (!method || method.type !== "roll") return ui.notifications.warn("That ability score method is not a roll method.");

    this.build.rerollRequestPending = false;
    this.build.pendingRerollMethod = "";

    const scores = [];
    const rollDetails = [];

    if (method.special === "2d6p6r12") {
      for (let i = 0; i < 6; i++) {
        const d1 = await this._rollD6Reroll12();
        const d2 = await this._rollD6Reroll12();
        const total = d1 + d2 + 6;
        scores.push(total);
        rollDetails.push(`${i + 1}. ${d1} + ${d2} + 6 = <strong>${total}</strong>`);
      }
    } else {
      for (let i = 0; i < 6; i++) {
        const roll = await new Roll(method.formula).evaluate({ async: true });
        scores.push(roll.total);
        rollDetails.push(`${i + 1}. ${roll.result} = <strong>${roll.total}</strong>`);
      }
    }

    const sortedScores = [...scores].sort((a, b) => b - a);
    const whisperRecipients = Array.from(new Set([...gmWhisperIds(), game.user.id].filter(Boolean)));
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ alias: game.user.name }),
      whisper: whisperRecipients,
      flavor: `Ability Score Rolls: ${method.label}`,
      content: `
        <div class="level-one-2024-roll-summary">
          <p><strong>${foundry.utils.escapeHTML(game.user.name)}</strong> rolled ability scores using <strong>${foundry.utils.escapeHTML(method.label)}</strong>.</p>
          <ol>${rollDetails.map(detail => `<li>${detail.replace(/^\d+\.\s*/, "")}</li>`).join("")}</ol>
          <p><strong>Available scores:</strong> ${sortedScores.join(", ")}</p>
        </div>
      `
    });

    scores.sort((a, b) => b - a);
    this.build.rolledScores = scores;
    this.build.availableScores = [...scores];
    this.build.abilityMethod = method.id;
    // Do not auto-assign rolled scores. Players choose where each score goes.
    this.build.baseAbilities = Object.fromEntries(ABILITIES.map(ability => [ability, ""]));
    this.render();
  }

  async _rollD6Reroll12() {
    let result = 0;
    while (result < 3) {
      const roll = await new Roll("1d6").evaluate({ async: true });
      result = roll.total;
    }
    return result;
  }

  _scoreOptionsForAbility(ability) {
    const available = this.build.availableScores.map(Number).filter(Number.isFinite);
    const currentRaw = this.build.baseAbilities[ability];
    const current = Number(currentRaw);
    const hasCurrent = currentRaw !== "" && currentRaw !== null && currentRaw !== undefined && Number.isFinite(current);
    const assignedScores = numericAssignedScores(Object.values(this.build.baseAbilities));
    const allowedCounts = scoreCounts(available);
    const usedCounts = scoreCounts(assignedScores);
    const uniqueScores = [...new Set(available)].sort((a, b) => b - a);

    const options = [{
      value: "",
      selected: !hasCurrent,
      disabled: false,
      label: "Choose...",
      remaining: ""
    }];

    for (const score of uniqueScores) {
      const selected = hasCurrent && current === score;
      const allowed = allowedCounts[score] ?? 0;
      const used = usedCounts[score] ?? 0;
      const remaining = Math.max(0, allowed - used + (selected ? 1 : 0));
      options.push({
        value: score,
        selected,
        disabled: !selected && remaining <= 0,
        label: String(score),
        remaining
      });
    }

    return options;
  }

  async _assignAbility(ev) {
    const ability = ev.currentTarget.dataset.ability;
    if (!ABILITIES.includes(ability)) return this.render();

    const raw = ev.currentTarget.value;
    const nextAbilities = foundry.utils.deepClone(this.build.baseAbilities);
    nextAbilities[ability] = raw === "" ? "" : Number(raw);

    const allowedCounts = scoreCounts(numericAssignedScores(this.build.availableScores));
    const usedCounts = scoreCounts(numericAssignedScores(Object.values(nextAbilities)));

    for (const [score, used] of Object.entries(usedCounts)) {
      if (used > (allowedCounts[score] ?? 0)) {
        ui.notifications.warn("That score is already assigned. Clear it from another ability first.");
        return this.render();
      }
    }

    this.build.baseAbilities = nextAbilities;
    this.render();
  }

  async _openAbilityScoreDialog(ability) {
    if (!ABILITIES.includes(ability)) return;

    const previous = Number(this.build.baseAbilities[ability]);
    const allowedCounts = scoreCounts(this.build.availableScores);
    const usedCounts = scoreCounts(Object.values(this.build.baseAbilities));
    const uniqueScores = Object.keys(allowedCounts).map(Number).sort((a, b) => b - a);
    const choices = [];

    for (const score of uniqueScores) {
      if (score === previous) continue;

      const allowed = allowedCounts[score] ?? 0;
      const used = usedCounts[score] ?? 0;
      const remaining = allowed - used;

      if (remaining > 0) {
        choices.push({
          score,
          swapAbility: "",
          label: `Assign ${score} to ${ABILITY_LABELS[ability]} (${remaining} unused)`
        });
        continue;
      }

      const swapCandidates = ABILITIES.filter(a => a !== ability && Number(this.build.baseAbilities[a]) === score);
      for (const swapAbility of swapCandidates) {
        choices.push({
          score,
          swapAbility,
          label: `Swap ${ABILITY_LABELS[ability]} with ${ABILITY_LABELS[swapAbility]}: ${ABILITY_LABELS[ability]} gets ${score}, ${ABILITY_LABELS[swapAbility]} gets ${previous}`
        });
      }
    }

    if (!choices.length) {
      ui.notifications.warn("There are no other scores available to assign or swap.");
      return;
    }

    const optionHtml = choices.map((choice, index) => {
      const label = foundry.utils.escapeHTML(choice.label);
      return `<option value="${index}">${label}</option>`;
    }).join("");

    const selectedIndex = await new Promise(resolve => {
      let resolved = false;
      const finish = value => {
        if (resolved) return;
        resolved = true;
        resolve(value);
      };

      new Dialog({
        title: `Change ${ABILITY_LABELS[ability]} Score`,
        content: themedDialogHtml(`
          <p><strong>${ABILITY_LABELS[ability]}</strong> currently has <strong>${previous}</strong>.</p>
          <p>Choose exactly how to assign or swap a score from the available pool.</p>
          <select name="scoreChoice" style="width: 100%;">${optionHtml}</select>
        `),
        buttons: {
          apply: {
            label: "Apply",
            icon: '<i class="fas fa-check"></i>',
            callback: html => finish(Number(html.find("select[name='scoreChoice']").val()))
          },
          cancel: {
            label: "Cancel",
            callback: () => finish(null)
          }
        },
        default: "apply",
        close: () => finish(null)
      }, themedDialogOptions()).render(true);
    });

    if (selectedIndex === null || Number.isNaN(selectedIndex)) return this.render();
    const choice = choices[selectedIndex];
    if (!choice) return this.render();

    const nextAbilities = foundry.utils.deepClone(this.build.baseAbilities);
    nextAbilities[ability] = choice.score;
    if (choice.swapAbility) nextAbilities[choice.swapAbility] = previous;

    const nextCounts = scoreCounts(Object.values(nextAbilities));
    for (const [score, used] of Object.entries(nextCounts)) {
      if (used > (allowedCounts[score] ?? 0)) {
        ui.notifications.warn("That assignment would use a score more times than it appears in the score pool.");
        return this.render();
      }
    }

    this.build.baseAbilities = nextAbilities;
    this.render();
  }

  async _chooseSwapAbility({ ability, value, previous, candidates }) {
    const options = candidates.map(a => {
      const label = ABILITY_LABELS[a] ?? a;
      return `<option value="${a}">${label} currently has ${value}; move ${previous} there</option>`;
    }).join("");

    return new Promise(resolve => {
      let resolved = false;
      const finish = value => {
        if (resolved) return;
        resolved = true;
        resolve(value);
      };

      new Dialog({
        title: "Choose Ability Score Swap",
        content: themedDialogHtml(`
          <p><strong>${ABILITY_LABELS[ability] ?? ability}</strong> cannot take another ${value} unless another ability gives up that ${value}.</p>
          <p>Choose which ability should receive the previous ${previous} score.</p>
          <select name="swapAbility" style="width: 100%;">${options}</select>
        `),
        buttons: {
          swap: {
            label: "Swap",
            icon: '<i class="fas fa-exchange-alt"></i>',
            callback: html => {
              const selected = html.find("select[name='swapAbility']").val();
              finish(selected || null);
            }
          },
          cancel: {
            label: "Cancel",
            callback: () => finish(null)
          }
        },
        default: "swap",
        close: () => finish(null)
      }, themedDialogOptions()).render(true);
    });
  }

  _changePointBuy(ev) {
    const ability = ev.currentTarget.dataset.pointbuy;
    const rules = this._pointBuyRules();
    const value = Math.min(rules.max, Math.max(rules.min, Number(ev.currentTarget.value)));
    this.build.baseAbilities[ability] = value;
    this.render();
  }

  _pointBuyRules() {
    const method = getAbilityMethod(this.build.abilityMethod);
    if (method?.type === "pointbuy") {
      return {
        points: Number(method.points ?? 27),
        min: Number(method.min ?? 8),
        max: Number(method.max ?? 15),
        costs: method.costs ?? POINT_BUY_COSTS
      };
    }
    return { points: 27, min: 8, max: 15, costs: POINT_BUY_COSTS };
  }

  _pointBuyTotal() {
    const rules = this._pointBuyRules();
    return Object.values(this.build.baseAbilities).reduce((t, v) => t + (rules.costs[Number(v)] ?? rules.costs[String(v)] ?? 999), 0);
  }


  _selectedClassPrompt() {
    const cls = this.cache.classes.find(c => c.uuid === this.build.classUuid);
    const name = cls?.name || this.build.className || "";
    if (!name) return null;
    const slug = this._slug(name).replace(/-?2024$/, "");
    if (CLASS_PROMPTS_2024[slug]) return CLASS_PROMPTS_2024[slug];
    const lower = String(name ?? "").toLowerCase();
    for (const [key, prompt] of Object.entries(CLASS_PROMPTS_2024)) {
      if (lower.includes(key)) return prompt;
    }
    return null;
  }

  _backgroundSkillKeysFromName(name) {
    const clean = String(name ?? "")
      .replace(/\s*\([^)]*\)\s*/g, " ")
      .replace(/\s*\[[^\]]*\]\s*/g, " ")
      .replace(/\b(2024|phb|player'?s handbook|free rules)\b/gi, " ")
      .trim();
    const slug = this._slug(clean).replace(/-?2024$/, "");
    const direct = BACKGROUND_SKILLS_2024[slug] ?? [];
    if (direct.length) return new Set(direct);

    // Be forgiving of labels like "Soldier Background", "Background: Soldier",
    // or compendium-specific suffixes. Only match exact known background words.
    const lower = clean.toLowerCase();
    for (const [key, skills] of Object.entries(BACKGROUND_SKILLS_2024)) {
      const label = key.replace(/-/g, " ");
      const pattern = new RegExp(`(^|\\b)${label.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(\\b|$)`, "i");
      if (pattern.test(lower)) return new Set(skills);
    }
    return new Set();
  }

  _backgroundSkillKeysFromDoc(bg) {
    const keys = this._backgroundSkillKeysFromName(bg?.name ?? "");

    // dnd5e v5 stores many item fields as DataModel / Collection objects. Those
    // do not always stringify or enumerate reliably from document.system, so work
    // from a plain source object whenever the document can provide one.
    const plain = (() => {
      try { return bg?.toObject ? bg.toObject(false) : bg; }
      catch (_err) { return bg; }
    })();
    const system = plain?.system ?? bg?.system ?? {};

    const addSkillKey = value => {
      const raw = String(value ?? "").trim();
      if (!raw) return;
      const slug = this._slug(raw);
      if (SKILL_LABELS[slug]) keys.add(slug);
      for (const [k, label] of Object.entries(SKILL_LABELS)) {
        const labelSlug = this._slug(label);
        if (slug === labelSlug || raw.toLowerCase() === label.toLowerCase()) keys.add(k);
      }
    };

    const addSkillsFromText = value => {
      const raw = String(value ?? "");
      if (!raw.trim()) return;
      const text = raw
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&#64;/g, "@")
        .replace(/\s+/g, " ");

      // Official 2024 background descriptions often show skill grants as
      // @Reference[skill=Intimidation], @Reference[skill=prc], or equivalent
      // enriched-link syntax rather than as system.skills data.
      for (const match of text.matchAll(/[@&]Reference\s*\[\s*skill\s*=\s*([^\]\s]+(?:\s+[^\]]+?)?)\s*\]/gi)) addSkillKey(match[1]);
      for (const match of text.matchAll(/skill\s*=\s*["']?([a-z]{3}|[A-Za-z]+(?:\s+[A-Za-z]+)*)["']?/gi)) addSkillKey(match[1]);

      // If the description has a Skill Proficiencies line, read only that slice
      // so ability-score or feat text elsewhere cannot accidentally add skills.
      const profMatch = text.match(/skill\s+proficienc(?:y|ies)\s*[:：]\s*(.*?)(?:\b(tool|language|equipment|feat|ability\s+score|ability\s+scores)\s+proficienc|\bfeat\s*[:：]|\bability\s+score|$)/i);
      if (profMatch?.[1]) {
        const slice = profMatch[1];
        for (const [k, label] of Object.entries(SKILL_LABELS)) {
          const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          if (new RegExp(`(^|\\b)${escaped}(\\b|$)`, "i").test(slice)) keys.add(k);
        }
      }
    };

    const scan = value => {
      if (!value) return;
      if (typeof value === "string") {
        addSkillKey(value);
        addSkillsFromText(value);
        return;
      }
      if (Array.isArray(value)) return value.forEach(scan);
      if (value instanceof Set) return [...value].forEach(scan);
      if (value instanceof Map) return [...value.entries()].forEach(scan);
      if (typeof value === "object") {
        for (const [k, v] of Object.entries(value)) {
          if (v === true || v === 1 || v === "1") addSkillKey(k);
          if (typeof v === "string" || Array.isArray(v) || (v && typeof v === "object")) scan(v);
        }
      }
    };

    const possible = [
      system?.skills?.value,
      system?.skills?.choices,
      system?.traits?.skills?.value,
      system?.proficiencies?.skills,
      system?.advancement,
      system?.description?.value,
      system?.description?.chat,
      system?.description?.unidentified,
      plain?.description,
      plain
    ];

    for (const value of possible) scan(value);
    return keys;
  }

  _backgroundSkillKeys() {
    const keys = new Set(Array.isArray(this.build.backgroundSkillKeys) ? this.build.backgroundSkillKeys : []);

    const knownKey = this._selectedBackgroundKey();
    for (const skill of BACKGROUND_SKILLS_2024[knownKey] ?? []) keys.add(skill);
    for (const skill of this._backgroundSkillKeysFromName(this.build.backgroundName)) keys.add(skill);

    const bg = this.cache.backgrounds.find(b => b.uuid === this.build.backgroundUuid);
    for (const skill of this._backgroundSkillKeysFromDoc(bg)) keys.add(skill);

    return keys;
  }

  _backgroundToolNamesFromDoc(bg) {
    const names = new Set();
    const plain = (() => {
      try { return bg?.toObject ? bg.toObject(false) : bg; }
      catch (_err) { return bg; }
    })();
    const system = plain?.system ?? bg?.system ?? {};

    const addToolName = value => {
      const raw = String(value ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (!raw) return;
      const cleaned = raw.replace(/\|[^\]]+$/g, "").replace(/^@?item\[/i, "").replace(/\]$/g, "").trim();
      if (!cleaned) return;
      const lower = cleaned.toLowerCase();
      if (lower.includes(" gp") || lower.includes("ability score") || lower.includes("skill")) return;
      if (lower.includes("tool") || lower.includes("supplies") || lower.includes("kit") || lower.includes("instrument") || lower.includes("utensil") || lower.includes("gaming set")) names.add(cleaned);
    };

    const addToolsFromText = value => {
      const raw = String(value ?? "");
      if (!raw.trim()) return;
      const text = raw
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&#64;/g, "@")
        .replace(/\s+/g, " ");

      const toolLine = text.match(/tool\s+proficienc(?:y|ies)\s*[:：]\s*(.*?)(?:\bskill\s+proficienc|\blanguage|\bequipment\s*[:：]|\bfeat\s*[:：]|\bability\s+score|$)/i);
      const slices = toolLine?.[1] ? [toolLine[1]] : [];
      slices.push(...[...text.matchAll(/@item\[([^\]|]+)(?:\|[^\]]+)?\]/gi)].map(match => match[1]));
      for (const slice of slices) {
        for (const match of String(slice).matchAll(/@item\[([^\]|]+)(?:\|[^\]]+)?\]/gi)) addToolName(match[1]);
        for (const known of Object.keys(TOOL_KEY_ALIASES_2024)) {
          const escaped = known.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          if (new RegExp(`(^|\\b)${escaped}(\\b|$)`, "i").test(slice)) addToolName(known.replace(/\b\w/g, c => c.toUpperCase()));
        }
      }
    };

    const scan = value => {
      if (!value) return;
      if (typeof value === "string") return addToolsFromText(value);
      if (Array.isArray(value)) return value.forEach(scan);
      if (value instanceof Set) return [...value].forEach(scan);
      if (value instanceof Map) return [...value.values()].forEach(scan);
      if (typeof value === "object") for (const v of Object.values(value)) scan(v);
    };

    scan(system?.tools);
    scan(system?.traits?.tools);
    scan(system?.proficiencies?.tools);
    scan(system?.advancement);
    scan(system?.description?.value);
    scan(system?.description?.chat);
    scan(plain?.description);
    scan(plain);
    return names;
  }

  _backgroundToolNames() {
    const names = new Set(Array.isArray(this.build.backgroundToolNames) ? this.build.backgroundToolNames : []);
    const key = this._selectedBackgroundKey();
    for (const tool of BACKGROUND_TOOLS_2024[key] ?? []) names.add(tool);
    const bg = this.cache.backgrounds.find(b => b.uuid === this.build.backgroundUuid);
    for (const tool of this._backgroundToolNamesFromDoc(bg)) names.add(tool);
    return names;
  }


  _classSkillOptions(prompt) {
    if (!prompt?.skills) return [];
    const options = prompt.skills.options === "any" ? Object.keys(SKILL_LABELS) : prompt.skills.options;
    const alreadyGranted = this._backgroundSkillKeys();
    return options
      .filter(k => !alreadyGranted.has(k))
      .map(k => ({ key: k, label: SKILL_LABELS[k] ?? k }));
  }


  async _toggleSkill(ev) {
    this._toggleArrayValue(this.build.skillChoices, ev.currentTarget.value, ev.currentTarget.checked);
    if (await this._maybePromptStepComplete("Class Choices")) return;
    this.render();
  }

  async _setHumanSkillChoice(value) {
    this.build.humanSkillChoice = value;
    if (await this._maybePromptStepComplete("Human Choices")) return;
    this.render();
  }

  async _maybePromptStepComplete(expectedStepName = null) {
    const stepName = this._steps()[this.step] ?? "";
    if (expectedStepName && stepName !== expectedStepName) return false;
    const error = await this._validateStep(this.step);
    if (error) return false;
    return Dialog.confirm({
      title: `Confirm ${stepName}`,
      content: themedDialogHtml(`<p>All required choices for <strong>${foundry.utils.escapeHTML(stepName)}</strong> are complete.</p><p>Continue to the next step?</p>`),
      yes: () => {
        this.step = Math.min(this.step + 1, this._steps().length - 1);
        this.render();
      },
      no: () => this.render(),
      defaultYes: true,
      options: themedDialogOptions()
    });
  }


  _backgroundAbilityKeys() {
    // Prefer the keys captured from the actual background document when it was
    // selected. This avoids falling back to all six abilities when the selected
    // background came from the dnd5e browser instead of this module's cache.
    const captured = Array.isArray(this.build.backgroundAbilityKeys) ? this.build.backgroundAbilityKeys.filter(k => ABILITIES.includes(k)) : [];
    if (captured.length >= 3) return captured.slice(0, 3);

    const key = this._selectedBackgroundKey();
    const mapped = BACKGROUND_ABILITIES_2024[key];
    if (Array.isArray(mapped) && mapped.length) return [...mapped];

    const background = this.cache.backgrounds.find(b => b.uuid === this.build.backgroundUuid);
    const fromDoc = this._backgroundAbilityKeysFromDoc(background);
    if (fromDoc.length >= 3) return fromDoc.slice(0, 3);

    // Custom/homebrew backgrounds with no recognizable 2024 ability list still
    // need a path forward, but official 2024 backgrounds should be caught above.
    return [...ABILITIES];
  }

  _backgroundAbilityData() {
    const allowedKeys = this._backgroundAbilityKeys();
    const asi = this.build.backgroundAsi ?? { mode: "2-1", plus2: "", plus1: "", plus1s: [] };
    const selectedPlus1s = new Set(asi.plus1s ?? []);
    if (asi.plus2 && asi.plus1 && asi.plus2 === asi.plus1) asi.plus1 = "";

    const options = allowedKeys.map(key => ({
      key,
      label: ABILITY_LABELS[key] ?? key,
      plus2Selected: asi.plus2 === key,
      plus1Selected: asi.plus1 === key,
      plus1Checked: selectedPlus1s.has(key),
      checked: selectedPlus1s.has(key)
    }));
    const optionsPlus1 = options.filter(option => option.key !== asi.plus2);

    return {
      backgroundName: this.build.backgroundName || this.cache.backgrounds.find(b => b.uuid === this.build.backgroundUuid)?.name || "Selected Background",
      mode: asi.mode ?? "2-1",
      plus2: asi.plus2 ?? "",
      plus1: asi.plus1 ?? "",
      plus1s: [...selectedPlus1s],
      allowed: options,
      options,
      optionsPlus2: options,
      optionsPlus1
    };
  }

  _setBackgroundAsiMode(mode) {
    if (!this.build.backgroundAsi) this.build.backgroundAsi = { mode: "2-1", plus2: "", plus1: "", plus1s: [] };
    this.build.backgroundAsi.mode = mode === "1-1-1" ? "1-1-1" : "2-1";
    this.render();
  }

  _setBackgroundAsiField(field, value) {
    if (!this.build.backgroundAsi) this.build.backgroundAsi = { mode: "2-1", plus2: "", plus1: "", plus1s: [] };
    if (!["plus2", "plus1"].includes(field)) return;
    this.build.backgroundAsi[field] = value;
    if (field === "plus2" && value && this.build.backgroundAsi.plus1 === value) this.build.backgroundAsi.plus1 = "";
    if (field === "plus1" && value && this.build.backgroundAsi.plus2 === value) {
      ui.notifications.warn("The +1 ability must be different from the +2 ability.");
      this.build.backgroundAsi.plus1 = "";
    }
    this.render();
  }

  _toggleBackgroundAsiPlus1(ability, checked) {
    if (!this.build.backgroundAsi) this.build.backgroundAsi = { mode: "1-1-1", plus2: "", plus1: "", plus1s: [] };
    if (!Array.isArray(this.build.backgroundAsi.plus1s)) this.build.backgroundAsi.plus1s = [];
    this._toggleArrayValue(this.build.backgroundAsi.plus1s, ability, checked);
    this.render();
  }

  _stripBackgroundAbilityAdvancements(itemData) {
    const advancements = itemData?.system?.advancement;
    if (advancements == null) return itemData;
    if (!itemData.system) itemData.system = {};

    const isAbilityAdvancement = advancement => {
      const haystack = JSON.stringify(advancement ?? {}).toLowerCase();
      const type = String(advancement?.type ?? "").toLowerCase();
      return type.includes("ability")
        || haystack.includes("ability score")
        || haystack.includes("ability scores")
        || haystack.includes("+2") && haystack.includes("+1")
        || haystack.includes("str") && haystack.includes("dex") && haystack.includes("con");
    };

    if (Array.isArray(advancements)) {
      const filtered = advancements.filter(a => !isAbilityAdvancement(a));
      itemData.system.advancement = filtered;
      if (filtered.length !== advancements.length) {
        console.info(`${MODULE_ID} | Removed ${advancements.length - filtered.length} background ability advancement(s) from ${itemData.name} import because background ASIs are handled by the builder.`);
      }
      return itemData;
    }

    if (typeof advancements === "object") {
      const filtered = {};
      let removed = 0;
      for (const [key, advancement] of Object.entries(advancements)) {
        if (isAbilityAdvancement(advancement)) removed += 1;
        else filtered[key] = advancement;
      }
      itemData.system.advancement = filtered;
      if (removed) console.info(`${MODULE_ID} | Removed ${removed} background ability advancement(s) from ${itemData.name} import because background ASIs are handled by the builder.`);
    }

    return itemData;
  }

  _toggleArrayValue(array, value, checked) {
    const index = array.indexOf(value);
    if (checked && index === -1) array.push(value);
    if (!checked && index !== -1) array.splice(index, 1);
  }

  _finalAbilities() {
    const scores = Object.fromEntries(ABILITIES.map(ability => {
      const value = Number(this.build.baseAbilities[ability]);
      return [ability, Number.isFinite(value) ? value : ""];
    }));

    const asi = this.build.backgroundAsi ?? {};
    const allowed = new Set(this._backgroundAbilityKeys());
    const add = (ability, amount) => {
      if (!ability || !allowed.has(ability)) return;
      const current = Number(scores[ability]);
      if (!Number.isFinite(current)) return;
      scores[ability] = current + amount;
    };

    if (asi.mode === "1-1-1") {
      for (const ability of asi.plus1s ?? []) add(ability, 1);
    } else {
      add(asi.plus2, 2);
      add(asi.plus1, 1);
    }

    return scores;
  }

  async _safeFromUuid(uuid) {
    if (!uuid) return null;
    try { return await fromUuid(uuid); } catch (_err) { return null; }
  }

  _slug(name) {
    return String(name ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  /**
   * Next/Back/Finish are all wired to fire-and-forget click handlers, and
   * Next (on the Name step, via _ensureWorkingActor) and Finish both run a
   * long chain of awaited actor/item creation calls. A second click before
   * the first call resolves - a mis-click, a slow connection, someone double
   * clicking out of habit - re-enters the same async flow concurrently, and
   * several of the create-if-missing checks inside it (e.g. in
   * _createOrUpdateActor) are a check-then-create pair, not atomic, so two
   * overlapping calls can each see "not present yet" and each create their
   * own copy. Greying out the nav buttons for the duration of one call closes
   * that window without needing to make every step of actor creation
   * individually idempotent under concurrency.
   */
  _setNavBusy(busy) {
    this._navBusy = busy;
    this.element?.find?.("[data-action='next'], [data-action='back'], [data-action='finish']")
      ?.prop("disabled", busy);
  }

  async _next() {
    if (this._navBusy) return;
    this._setNavBusy(true);
    try {
      const error = await this._validateStep(this.step);
      if (error) return ui.notifications.warn(error);
      if ((this._steps()[this.step] ?? "") === "Name") {
        try { await this._ensureWorkingActor(); }
        catch (err) { console.error(err); return ui.notifications.error(`Could not create/update the working actor: ${err.message}`); }
      }
      this.step = Math.min(this.step + 1, this._steps().length - 1);
      this.render();
    } finally {
      this._setNavBusy(false);
    }
  }

  _back() {
    if (this._navBusy) return;
    this.step = Math.max(this.step - 1, 0);
    this.render();
  }

  async _ensureWorkingActor() {
    const name = this.build.name?.trim() || "New Character";

    if (this.build.actorMode === "existing") {
      const actor = game.actors.get(this.build.selectedActorId);
      if (!actor) throw new Error("The selected actor no longer exists.");
      if (actor.name !== name) await actor.update({ name });
      this.targetActor = actor;
      return actor;
    }

    if (!game.user.isGM && !game.settings.get(MODULE_ID, "playersCanCreateActors")) {
      throw new Error("Players cannot create actors in this world. Ask the GM to create and assign a blank actor.");
    }

    const createData = { name, type: "character" };
    const folderId = configuredCharacterFolderId();
    if (folderId) createData.folder = folderId;
    const actor = await Actor.create(createData);
    this.createdActorId = actor.id;
    await this._clearIncorrectStartingConditions(actor);
    this.build.actorMode = "existing";
    this.build.selectedActorId = actor.id;
    this.targetActor = actor;
    ui.notifications.info(`Created working character actor: ${actor.name}`);
    return actor;
  }

  async _validateStep(step) {
    const stepName = this._steps()[step] ?? "";

    if (stepName === "Actor") {
      if (this.build.actorMode === "existing") {
        const actor = game.actors.get(this.build.selectedActorId);
        if (!actor || actor.type !== "character" || (!game.user.isGM && !actor.isOwner)) return "Choose an existing character actor you own, or choose to create a new actor.";
      } else if (!game.user.isGM && !game.settings.get(MODULE_ID, "playersCanCreateActors")) {
        return "This world does not allow players to create actors from the builder. Choose an existing actor created by the GM.";
      }
    }

    if (stepName === "Name" && !this.build.name?.trim()) return "Enter a character name.";

    if (stepName === "Ability Scores Generation") {
      const method = getAbilityMethod(this.build.abilityMethod);
      if (method?.type === "pointbuy") {
        const rules = this._pointBuyRules();
        if (this._pointBuyTotal() > rules.points) return `Point buy exceeds ${rules.points} points.`;
        const vals = numericAssignedScores(Object.values(this.build.baseAbilities));
        if (vals.some(v => !Number.isInteger(v) || v < rules.min || v > rules.max)) return `Point buy scores must be between ${rules.min} and ${rules.max}.`;
      } else if (method?.type === "manual") {
        const min = Number(method.min ?? 3);
        const max = Number(method.max ?? 20);
        const vals = numericAssignedScores(Object.values(this.build.baseAbilities));
        if (vals.length !== ABILITIES.length || vals.some(v => !Number.isInteger(v) || v < min || v > max)) return `Manual ability scores must be whole numbers between ${min} and ${max}.`;
      } else {
        const rawVals = Object.values(this.build.baseAbilities);
        if (method?.type === "roll" && !this.build.rolledScores.length) return "Roll ability scores before continuing.";
        if (rawVals.some(v => v === "" || v === null || v === undefined)) return "Assign one generated score to each ability before continuing.";
        const vals = rawVals.map(Number);
        if (vals.some(v => !Number.isInteger(v) || v < 3 || v > 18)) return "Base ability scores must be valid numbers before background ASIs.";
        if (!arraysHaveSameScoreMultiset(vals, this.build.availableScores)) {
          return "Assign each generated score exactly once. Duplicate values are only usable as many times as they were rolled or listed.";
        }
      }
    }

    if (stepName === "Species" && !this.build.speciesUuid) return "Choose a species.";
    if (stepName === "Species Options") {
      const data = this._speciesChoiceData();
      if (data.required && !data.selected) return `Choose ${data.title}.`;
    }
    if (stepName === "Background" && !this.build.backgroundUuid) return "Choose a background.";

    if (stepName === "Background Ability Scores") {
      const data = this._backgroundAbilityData();
      const allowed = new Set(data.allowed.map(a => a.key));
      const asi = this.build.backgroundAsi ?? {};
      if (asi.mode === "1-1-1") {
        const chosen = (asi.plus1s ?? []).filter(a => allowed.has(a));
        if (new Set(chosen).size !== 3) return "Choose three different ability scores to increase by +1.";
      } else {
        if (!allowed.has(asi.plus2) || !allowed.has(asi.plus1)) return "Choose one ability for +2 and a different ability for +1.";
        if (asi.plus2 === asi.plus1) return "The +2 and +1 ability score choices must be different.";
      }
    }

    if (stepName === "Human Choices") {
      const originData = await this._originFeatData();
      if (!this.build.humanSkillChoice) return "Choose one Human skill proficiency.";
      if (originData.requiredExtra && (this.build.originFeatUuids ?? []).length !== originData.requiredExtra) {
        return `Choose exactly ${originData.requiredExtra} Human origin feat${originData.requiredExtra === 1 ? "" : "s"}.`;
      }
    }

    if (stepName === "Skilled Proficiencies") {
      const data = this._skilledFeatData();
      if ((this.build.skilledChoiceKeys ?? []).length !== data.required) {
        return `Choose exactly ${data.required} skills or tools for the Skilled feat.`;
      }
    }

    if (stepName === "Class" && !this.build.classUuid) return "Choose a class.";

    if (stepName === "Class Choices") {
      const prompt = this._selectedClassPrompt();
      const required = prompt?.skills?.count ?? 0;
      if (required && this.build.skillChoices.length !== required) return `Choose exactly ${required} class skills.`;
      const requiredMasteries = prompt?.masteries?.count ?? 0;
      if (requiredMasteries && this.build.weaponMasteryUuids.length !== requiredMasteries) return `Choose exactly ${requiredMasteries} weapon masteries.`;
      const requiredInvocations = prompt?.invocations?.count ?? 0;
      if (requiredInvocations && (this.build.invocationUuids ?? []).length !== requiredInvocations) return `Choose exactly ${requiredInvocations} Eldritch Invocation${requiredInvocations === 1 ? "" : "s"}.`;
      if (this._divineOrderData().required && !this.build.divineOrder) return "Choose a Cleric Divine Order.";
      if (this._primalOrderData().required && !this.build.primalOrder) return "Choose a Druid Primal Order.";
      if ((await this._fightingStyleData()).required && !this.build.fightingStyle) return "Choose a Fighting Style.";
    }

    if (stepName === "Starting Equipment") {
      const equipmentData = await this._startingEquipmentData();
      for (const group of equipmentData.classGroups ?? []) {
        if (group.required && !this.build.equipmentChoiceSelections?.[group.id]) return `Choose ${group.label}.`;
      }
    }

    if (stepName === "Spells") {
      const spellPrompt = this._selectedClassPrompt()?.spells ?? {};
      const requiredCantrips = spellPrompt.cantrips ?? 0;
      const requiredSpells = spellPrompt.level1 ?? 0;
      if (requiredCantrips && this.build.cantripUuids.length !== requiredCantrips) return `Choose exactly ${requiredCantrips} cantrip${requiredCantrips === 1 ? "" : "s"}.`;
      if (requiredSpells && this.build.spellUuids.length !== requiredSpells) return `Choose exactly ${requiredSpells} level 1 spells.`;
      if (await this._hasPactOfTheTome()) {
        if ((this.build.tomeCantripUuids ?? []).length !== 3) return "Pact of the Tome requires exactly 3 additional cantrips.";
        if ((this.build.tomeRitualSpellUuids ?? []).length !== 2) return "Pact of the Tome requires exactly 2 level 1 ritual spells.";
      }
      const magicInitiate = await this._magicInitiateData();
      if (magicInitiate.active) {
        if ((this.build.magicInitiateCantripUuids ?? []).length !== 2) return `Magic Initiate (${magicInitiate.sourceLabel}) requires exactly 2 cantrips.`;
        if (!this.build.magicInitiateSpellUuid) return `Magic Initiate (${magicInitiate.sourceLabel}) requires exactly 1 level 1 spell.`;
      }
    }

    if (stepName === "Languages" && (this.build.languageChoices ?? []).length !== DEFAULT_LANGUAGE_CHOICE_COUNT) {
      return `Choose exactly ${DEFAULT_LANGUAGE_CHOICE_COUNT} languages.`;
    }

    return null;
  }

  async _finish() {
    if (this._navBusy) return;
    this._setNavBusy(true);
    try {
      for (let i = 0; i < this._steps().length - 1; i++) {
        const error = await this._validateStep(i);
        if (error) { this.step = i; this.render(); return ui.notifications.warn(error); }
      }
      if (this.build.actorMode !== "existing" && !game.user.isGM && !game.settings.get(MODULE_ID, "playersCanCreateActors")) {
        return ui.notifications.error("This world is not configured to let players create actors from the builder.");
      }
      try {
        suppressExternalBuilderPrompts(120000, "Finishing Level One 2024 Builder character", this.build.selectedActorId ?? this.targetActor?.id ?? null);
        const actor = await this._createOrUpdateActor();
        suppressExternalBuilderPrompts(120000, "Cleanup after Level One 2024 Builder finish", actor.id);
        ui.notifications.info(`Finished level 1 character setup: ${actor.name}`);
        await this.close();
        // Open the finished character sheet only after the builder is closed so
        // new players stay inside the guided flow during character creation.
        setTimeout(() => actor.sheet?.render(true), 150);
      } catch (err) {
        console.error(err);
        ui.notifications.error(`Character creation failed: ${err.message}`);
      }
    } finally {
      this._setNavBusy(false);
    }
  }

  async _createOrUpdateActor() {
    await this._ensureSelectedBackgroundState();
    const finalAbilities = this._finalAbilities();
    const existingActor = this.build.actorMode === "existing" ? game.actors.get(this.build.selectedActorId) : null;
    const actor = existingActor ?? await this._ensureWorkingActor();
    const actorUpdates = {
      name: this.build.name.trim(),
      "system.abilities.str.value": finalAbilities.str,
      "system.abilities.dex.value": finalAbilities.dex,
      "system.abilities.con.value": finalAbilities.con,
      "system.abilities.int.value": finalAbilities.int,
      "system.abilities.wis.value": finalAbilities.wis,
      "system.abilities.cha.value": finalAbilities.cha,
      ...this._skillUpdates(actor),
      ...this._toolUpdates(actor),
      ...this._languageUpdates(actor),
      ...this._classBaseProficiencyUpdates(actor),
      ...this._speciesChoiceResistanceUpdates(actor),
      ...(await this._weaponMasteryUpdates(actor))
    };
    if (actor.id === this.createdActorId) actorUpdates["system.details.xp.value"] = 0;
    await actor.update(actorUpdates);

    const preFinishItemIds = new Set(actor.items.map(item => item.id));

    // Import the selected species/background/class as sanitized items. Class
    // advancements are stripped because this builder owns level-1 class setup
    // and should not hand control to built-in or third-party popups.
    const coreItemUuids = [
      this.build.speciesUuid,
      this.build.backgroundUuid,
      this.build.classUuid
    ].filter(Boolean);

    for (const uuid of coreItemUuids) {
      const doc = await fromUuid(uuid);
      if (!doc) continue;
      const sourceId = String(doc.uuid ?? uuid);
      const nameSlug = this._slug(doc.name);
      const alreadyPresent = actor.items.some(item => item.type === doc.type && (
        this._slug(item.name) === nameSlug
        || [item.flags?.core?.sourceId, item.flags?.dnd5e?.sourceId].some(id => String(id ?? "") === sourceId)
      ));
      if (alreadyPresent) continue;
      await this._createItemsWithoutAdvancementPrompts(actor, [this._itemDataForImport(doc)]);
    }

    await this._addBackgroundOriginFeat(actor);
    await this._addSelectedOriginFeats(actor);
    await this._addSpeciesChoiceFeatureItem(actor);
    await this._addLevelOneSpeciesFeatures(actor);
    await this._addLevelOneClassFeatures(actor);
    await this._addSelectedDivineOrder(actor);
    await this._addSelectedPrimalOrder(actor);
    await this._addSelectedFightingStyle(actor);
    await this._addSelectedInvocations(actor);
    await this._addSelectedEquipment(actor);
    await this._addWeaponMasteryFeatureItems(actor);
    await this._repairBuilderClassFeatureClassifications(actor);
    await this._addSelectedCantrips(actor);
    await this._addSelectedLevelOneSpells(actor);
    await this._addPactOfTheTomeSpells(actor);
    await this._addMagicInitiateSpells(actor);
    await this._cleanupUnselectedLevelOneClassSpells(actor, preFinishItemIds);
    // Re-run the builder-owned spell adders after cleanup as a safety net.
    // They are duplicate-safe by name/level and now preserve flags[MODULE_ID],
    // so this restores Tome/Magic Initiate level-1 spells if an older sheet or
    // hook removed them during cleanup.
    await this._addPactOfTheTomeSpells(actor);
    await this._addMagicInitiateSpells(actor);
    await this._setLevelOneHitPoints(actor);
    await this._clearIncorrectStartingConditions(actor);

    // Re-apply proficiencies after item imports. Some dnd5e advancement and
    // third-party hooks can touch skill data when species/background/class
    // items are created, so make the builder-owned choices the final value.
    await this._applyBuilderSkillProficiencies(actor);
    await this._applyBuilderToolProficiencies(actor);
    await this._applyBuilderClassBaseProficiencies(actor);

    // Weapon mastery selections update the actor's mastery trait only.
    // Starting equipment is added from the builder's selected class/background
    // choices. The class item is imported without advancement prompts to avoid
    // duplicate built-in or third-party equipment windows.

    return actor;
  }



  async _createItemsWithoutAdvancementPrompts(actor, itemDataArray = []) {
    const cleaned = itemDataArray
      .filter(Boolean)
      .map(data => this._stripThirdPartyBuilderFlags(foundry.utils.deepClone(data)));
    if (!cleaned.length) return [];

    // dnd5e uses the options object when creating embedded class/species items to
    // decide whether to launch advancement workflows. Different dnd5e versions and
    // third-party modules have used different option keys, so pass a broad set of
    // harmless suppression flags. Unknown option keys are ignored by Foundry.
    const options = {
      renderSheet: false,
      prompt: false,
      prompts: false,
      configure: false,
      advancement: false,
      advancements: false,
      noAdvancement: true,
      skipAdvancement: true,
      addFeatures: false,
      addAdvancements: false,
      renderAdvancement: false,
      dnd5e: { advancement: false, advancements: false, prompt: false, configure: false },
      plutonium: { advancement: false, prompt: false, configure: false },
      charactermancer: false
    };

    return actor.createEmbeddedDocuments("Item", cleaned, options);
  }

  _stripThirdPartyBuilderFlags(itemData) {
    if (!itemData || typeof itemData !== "object") return itemData;

    // Prevent imported items from carrying third-party module builder metadata
    // into the actor. This does not remove normal item mechanics; it only drops
    // flags most likely to spawn separate character builder/advancement dialogs.
    const flags = itemData.flags;
    if (flags && typeof flags === "object") {
      for (const key of Object.keys(flags)) {
        const lower = key.toLowerCase();
        // Keep this module's own ownership flags.  The module id contains
        // "builder", and earlier versions accidentally deleted
        // flags[MODULE_ID] here.  That made Pact of the Tome and Magic
        // Initiate level-1 spells look like normal class spells, so the final
        // unselected-class-spell cleanup could remove them.
        if (key !== MODULE_ID && (lower.includes("plutonium") || lower.includes("charactermancer") || lower.includes("builder") || lower.includes("advancement"))) {
          delete flags[key];
        }
      }
    }
    return itemData;
  }


  _selectedSpeciesKey() {
    const species = this.cache.species.find(s => s.uuid === this.build.speciesUuid);
    const name = species?.name ?? this.build.speciesName ?? "";
    return this._slug(name).replace(/-?2024$/, "");
  }

  _speciesChoiceGroup() {
    // Prefer the group key captured at the moment the species was chosen. This
    // avoids relying on later cache lookups or exact compendium item names.
    const captured = this.build.speciesChoiceGroupKey;
    if (captured && SPECIES_CHOICE_GROUPS_2024[captured]) return SPECIES_CHOICE_GROUPS_2024[captured];

    const speciesDoc = this.cache.species.find(s => s.uuid === this.build.speciesUuid);
    const detected = detectSpeciesChoiceGroupKey(speciesDoc || this.build.speciesName || this._selectedSpeciesKey());
    if (detected && SPECIES_CHOICE_GROUPS_2024[detected]) {
      this.build.speciesChoiceGroupKey = detected;
      return SPECIES_CHOICE_GROUPS_2024[detected];
    }

    const key = this._selectedSpeciesKey();
    if (SPECIES_CHOICE_GROUPS_2024[key]) return SPECIES_CHOICE_GROUPS_2024[key];
    return null;
  }

  _speciesChoiceData() {
    const group = this._speciesChoiceGroup();
    if (!group) return { required: false, title: "Species Options", options: [], selected: "", selectedLabel: "None" };
    const selected = this.build[group.stateKey] ?? "";
    const selectedOption = group.options.find(o => o.key === selected);
    return {
      required: true,
      ...group,
      selected,
      selectedLabelValue: group.selectedLabel,
      selectedLabel: selectedOption?.label ?? "None",
      options: group.options.map(option => ({ ...option, checked: option.key === selected }))
    };
  }

  async _setSpeciesChoice(value) {
    const group = this._speciesChoiceGroup();
    if (!group) return;
    if (!group.options.some(option => option.key === value)) return;
    this.build[group.stateKey] = value;
    if (group.stateKey === "tieflingLegacy") this.build.tieflingLegacy = value;
    if (await this._maybePromptStepComplete("Species Options")) return;
    this.render();
  }

  _isTieflingSpecies() {
    const speciesName = this.build.speciesName || this.cache.species.find(s => s.uuid === this.build.speciesUuid)?.name || "";
    const key = this._selectedSpeciesKey();
    return this.build.speciesChoiceGroupKey === "tiefling" || key === "tiefling" || String(speciesName).toLowerCase().includes("tiefling");
  }

  _tieflingLegacyData() {
    const selected = this.build.tieflingLegacy ?? "";
    return {
      isTiefling: this._isTieflingSpecies(),
      selected,
      selectedLabel: TIEFLING_LEGACIES_2024[selected]?.label ?? "None",
      options: Object.values(TIEFLING_LEGACIES_2024).map(legacy => ({
        ...legacy,
        checked: legacy.key === selected
      }))
    };
  }

  async _setTieflingLegacy(value) {
    if (!this._isTieflingSpecies()) return;
    if (!TIEFLING_LEGACIES_2024[value]) return;
    this.build.tieflingLegacy = value;
    if (await this._maybePromptStepComplete("Tiefling Legacy")) return;
    this.render();
  }

  _isHumanSpecies() {
    const speciesName = this.build.speciesName || this.cache.species.find(s => s.uuid === this.build.speciesUuid)?.name || "";
    return this._selectedSpeciesKey() === "human" || String(speciesName).toLowerCase().includes("human");
  }

  _selectedBackgroundKey() {
    const background = this.cache.backgrounds.find(b => b.uuid === this.build.backgroundUuid);
    const name = background?.name ?? this.build.backgroundName ?? "";
    return this._knownBackgroundKeyFromName(name);
  }

  _humanSkillData() {
    const selected = this.build.humanSkillChoice ?? "";
    const options = Object.entries(SKILL_LABELS)
      .map(([key, label]) => ({ key, label, checked: key === selected }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return {
      isHuman: this._isHumanSpecies(),
      selected,
      selectedLabel: SKILL_LABELS[selected] ?? "None",
      options
    };
  }

  /**
   * v1.20.3: option data for the "Skilled Proficiencies" step. Skilled grants
   * proficiency in any combination of three skills or tools, so the picker
   * offers both pools together; each key is prefixed "skill:"/"tool:" so a
   * choice survives the round trip through this.build.skilledChoiceKeys and
   * resolves unambiguously back to either SKILL_LABELS or
   * SKILLED_TOOL_OPTIONS_2024 (a skill key and a tool key never collide, but
   * the prefix also makes each option's value self-describing in the DOM).
   */
  _skilledFeatData() {
    const required = 3;
    const selectedKeys = new Set(Array.isArray(this.build.skilledChoiceKeys) ? this.build.skilledChoiceKeys : []);
    const atMax = selectedKeys.size >= required;
    const skillOptions = Object.entries(SKILL_LABELS)
      .map(([key, label]) => ({ key: `skill:${key}`, label, checked: selectedKeys.has(`skill:${key}`) }))
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(option => ({ ...option, disabled: !option.checked && atMax }));
    const toolOptions = SKILLED_TOOL_OPTIONS_2024
      .map(tool => ({ key: `tool:${tool.key}`, label: tool.label, checked: selectedKeys.has(`tool:${tool.key}`) }))
      .map(option => ({ ...option, disabled: !option.checked && atMax }));
    return {
      active: this._isSkilledFeatActive(),
      required,
      selectedCount: selectedKeys.size,
      skillOptions,
      toolOptions,
      selectedLabels: [...selectedKeys].map(key => this._skilledChoiceLabel(key))
    };
  }

  _skilledChoiceLabel(key) {
    if (key.startsWith("skill:")) return SKILL_LABELS[key.slice(6)] ?? key.slice(6);
    if (key.startsWith("tool:")) {
      const toolKey = key.slice(5);
      return SKILLED_TOOL_OPTIONS_2024.find(t => t.key === toolKey)?.label ?? toolKey;
    }
    return key;
  }

  async _toggleSkilledChoice(ev) {
    const checked = ev.currentTarget.checked;
    const value = ev.currentTarget.value;
    const required = 3;
    if (!Array.isArray(this.build.skilledChoiceKeys)) this.build.skilledChoiceKeys = [];
    if (checked && this.build.skilledChoiceKeys.length >= required && !this.build.skilledChoiceKeys.includes(value)) {
      ui.notifications.warn(`Choose exactly ${required} skills or tools for Skilled.`);
      ev.currentTarget.checked = false;
      return;
    }
    this._toggleArrayValue(this.build.skilledChoiceKeys, value, checked);
    if (await this._maybePromptStepComplete("Skilled Proficiencies")) return;
    this.render();
  }

  _originFeatSlugFromName(name) {
    const raw = String(name ?? "")
      .replace(/^origin\s*feat[:\s-]*/i, "")
      .replace(/[()]/g, " ")
      .replace(/:/g, " ");
    const slug = this._slug(raw).replace(/-?2024$/, "");
    return ORIGIN_FEAT_ALIASES_2024.get(slug) ?? slug;
  }

  _originFeatNameSet() {
    return new Set(ORIGIN_FEAT_NAMES_2024.map(n => this._originFeatSlugFromName(n)));
  }

  _isOriginFeatCandidate(feat) {
    if (feat?.type !== "feat") return false;

    const typeValue = feat?.system?.type?.value;
    const subtype = feat?.system?.type?.subtype;
    const subtypeValue = typeof subtype === "object" ? (subtype?.value ?? subtype?.id ?? subtype?.key) : subtype;

    // Primary dnd5e 2024 data shape. Keep this as the authoritative pass when
    // present, including minor object/string variants of subtype.
    if (typeValue === "feat" && String(subtypeValue ?? "").toLowerCase() === "origin") return true;

    // Some official indexes do not expose system.type.subtype until the full
    // document is loaded. After the document is loaded, keep a narrow official
    // fallback by known 2024 origin feat names/identifiers and origin category
    // text. This is still gated to feat items and excluded packs are removed
    // before this runs.
    const originNames = this._originFeatNameSet();
    const nameSlug = this._originFeatSlugFromName(feat?.name);
    const identifierSlug = this._originFeatSlugFromName(feat?.system?.identifier);
    if (originNames.has(nameSlug) || originNames.has(identifierSlug)) return true;

    const typeBits = [
      feat?.system?.category,
      typeValue,
      subtypeValue,
      feat?.system?.type?.label,
      feat?.system?.requirements
    ].filter(Boolean).join(" ").toLowerCase();

    return (typeBits.includes("origin") || typeBits.includes("origin feat"));
  }

  _featSourceScore(feat) {
    const h = this._itemSourceLabel(feat).toLowerCase() + " " + String(feat?.pack ?? "").toLowerCase();
    if (h.includes("phb 2024") || h.includes("phb'24") || h.includes("players handbook") || h.includes("player's handbook") || h.includes("dnd-players-handbook")) return 100;
    if (h.includes("srd 5.2") || h.includes("free rules")) return 90;
    if (h.includes("dnd5e")) return 70;
    if (h.includes("cauldron") || h.includes("gambit") || h.includes("premade") || h.includes("automation") || h.includes("rider")) return -100;
    return 25;
  }

  _selectedBackgroundOriginFeatSlugs() {
    const slugs = new Set();

    const mappedName = this._backgroundOriginFeatName();
    if (mappedName) slugs.add(this._originFeatSlugFromName(mappedName));

    const background = this.cache.backgrounds.find(b => b.uuid === this.build.backgroundUuid);
    const selectedBackgroundName = background?.name ?? this.build.backgroundName ?? "";
    const haystack = [
      selectedBackgroundName,
      JSON.stringify(background?.system?.advancement ?? background?.system ?? {})
    ].join(" ").toLowerCase();

    for (const name of ORIGIN_FEAT_NAMES_2024) {
      const slug = this._originFeatSlugFromName(name);
      const plain = String(name).toLowerCase();
      const noParen = plain.replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
      const dashed = slug.replace(/-/g, " ");
      if (haystack.includes(plain) || haystack.includes(noParen) || haystack.includes(dashed)) slugs.add(slug);
    }

    return slugs;
  }

  _originFeatOptions() {
    const backgroundFeatSlugs = this._selectedBackgroundOriginFeatSlugs();
    const byName = new Map();
    for (const feat of this.cache.feats ?? []) {
      if (!this._isOriginFeatCandidate(feat)) continue;
      const key = this._originFeatSlugFromName(feat.name);
      if (backgroundFeatSlugs.has(key)) continue;
      const current = byName.get(key);
      if (!current || this._featSourceScore(feat) > this._featSourceScore(current)) byName.set(key, feat);
    }
    const selected = new Set(this.build.originFeatUuids ?? []);
    return [...byName.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(feat => ({ uuid: feat.uuid, name: feat.name, sourceLabel: this._itemSourceLabel(feat), checked: selected.has(feat.uuid) }));
  }

  _backgroundOriginFeatNamesFromDoc(bg) {
    const names = new Set();
    const plain = (() => {
      try { return bg?.toObject ? bg.toObject(false) : bg; }
      catch (_err) { return bg; }
    })();
    const system = plain?.system ?? bg?.system ?? {};
    const text = [system?.description?.value, system?.description?.chat, system?.advancement, plain?.description, plain]
      .filter(Boolean)
      .map(value => typeof value === "string" ? value : JSON.stringify(value))
      .join(" ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&#64;/g, "@")
      .replace(/\s+/g, " ");

    for (const match of text.matchAll(/@feat\[([^\]|]+)(?:\|[^\]]+)?\]/gi)) names.add(match[1].trim());
    const featLine = text.match(/\bfeat\s*[:：]\s*(.*?)(?:\bskill\s+proficienc|\btool\s+proficienc|\bequipment\s*[:：]|\bability\s+score|$)/i);
    if (featLine?.[1]) {
      for (const name of ORIGIN_FEAT_NAMES_2024) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        if (new RegExp(`(^|\\b)${escaped}(\\b|$)`, "i").test(featLine[1])) names.add(name);
      }
    }
    return [...names];
  }

  _backgroundOriginFeatName() {
    const key = this._selectedBackgroundKey();
    const mapped = BACKGROUND_ORIGIN_FEATS_2024[key] ?? "";
    if (mapped) return mapped;
    const background = this.cache.backgrounds.find(b => b.uuid === this.build.backgroundUuid);
    return this._backgroundOriginFeatNamesFromDoc(background)[0] ?? "";
  }

  _originFeatCandidatesForName(name) {
    const target = this._originFeatSlugFromName(name);
    if (!target) return [];
    const candidates = [];
    for (const feat of this.cache.feats ?? []) {
      if (!this._isOriginFeatCandidate(feat)) continue;
      const slug = this._originFeatSlugFromName(feat.name);
      const identifier = this._originFeatSlugFromName(feat.system?.identifier);
      if (slug === target || identifier === target) candidates.push(feat);
      else if (target.startsWith("magic-initiate-") && slug === "magic-initiate") candidates.push(feat);
    }
    return candidates.sort((a, b) => this._featSourceScore(b) - this._featSourceScore(a));
  }

  _findOriginFeatByName(name) {
    const target = this._originFeatSlugFromName(name);
    if (!target) return null;
    const options = this._originFeatOptions();
    return options.find(o => this._originFeatSlugFromName(o.name) === target)
      ?? this._originFeatCandidatesForName(name)[0]
      ?? null;
  }

  async _originFeatData() {
    if (!this.cache.items.length) await this._loadOptions();
    const requiredExtra = this._isHumanSpecies() ? 1 : 0;
    if (requiredExtra) await this._ensureOfficialOriginFeatOptionsLoaded();
    const selected = [];
    for (const uuid of this.build.originFeatUuids ?? []) {
      const doc = await this._safeFromUuid(uuid);
      if (doc) selected.push({ uuid, name: doc.name, sourceLabel: this._itemSourceLabel(doc) });
    }
    const backgroundFeatSlugs = this._selectedBackgroundOriginFeatSlugs();
    const backgroundFeatName = this._backgroundOriginFeatName();
    const options = this._originFeatOptions().map(option => ({
      ...option,
      disabled: false
    }));
    return {
      requiredExtra,
      isHuman: this._isHumanSpecies(),
      options,
      selected,
      excludedBackgroundFeatName: backgroundFeatName,
      excludedBackgroundFeatSlugs: [...backgroundFeatSlugs]
    };
  }

  async _chooseOriginFeat(uuid) {
    if (!uuid) return;
    const data = await this._originFeatData();
    if (!data.requiredExtra) return ui.notifications.warn("Only human characters choose an origin feat in this builder.");
    const doc = await this._safeFromUuid(uuid);
    const chosenSlug = this._originFeatSlugFromName(doc?.name);
    if (data.excludedBackgroundFeatSlugs?.includes(chosenSlug)) {
      return ui.notifications.warn("That origin feat is already granted by the selected background. Choose a different Human origin feat.");
    }
    if (this.build.originFeatUuids.includes(uuid)) return;
    if (data.requiredExtra && this.build.originFeatUuids.length >= data.requiredExtra) {
      return ui.notifications.warn(`You already chose ${data.requiredExtra} origin feat${data.requiredExtra === 1 ? "" : "s"}. Remove one before choosing another.`);
    }
    this.build.originFeatUuids.push(uuid);
    if (data.requiredExtra && this.build.originFeatUuids.length === data.requiredExtra) {
      const selected = [];
      for (const id of this.build.originFeatUuids) {
        const doc = await this._safeFromUuid(id);
        if (doc) selected.push(doc.name);
      }
      return Dialog.confirm({
        title: "Confirm Origin Feat",
        content: themedDialogHtml(`<p>You selected: <strong>${foundry.utils.escapeHTML(selected.join(", "))}</strong>.</p><p>Continue to the next step?</p>`),
        yes: async () => {
          const error = await this._validateStep(this.step);
          if (error) return ui.notifications.warn(error);
          this.step = Math.min(this.step + 1, this._steps().length - 1);
          this.render();
        },
        no: () => this.render(),
        defaultYes: true,
        options: themedDialogOptions()
      });
    }
    this.render();
  }

  _removeOriginFeat(uuid) {
    this.build.originFeatUuids = (this.build.originFeatUuids ?? []).filter(v => v !== uuid);
    this.render();
  }

  _stripHumanChoiceAdvancements(itemData) {
    const advancements = itemData?.system?.advancement;
    if (!Array.isArray(advancements)) return itemData;
    const filtered = advancements.filter(advancement => !this._isHumanChoiceAdvancement(advancement));
    if (filtered.length !== advancements.length) {
      itemData.system.advancement = filtered;
      console.info(`${MODULE_ID} | Removed ${advancements.length - filtered.length} Human skill/origin feat advancement(s) from ${itemData.name} import because Human choices are handled by the builder.`);
    }
    return itemData;
  }

  _isHumanChoiceAdvancement(advancement) {
    const haystack = JSON.stringify(advancement ?? {}).toLowerCase();
    if (haystack.includes("origin") && haystack.includes("feat")) return true;
    if (haystack.includes("skill") && (haystack.includes("proficien") || haystack.includes("trait") || haystack.includes("choice"))) return true;
    // Some imported Human species items include a broad tool proficiency chooser
    // in the same advancement bucket as the 2024 Human choices. Human should
    // only choose one skill and one origin feat here, so suppress that built-in
    // tool chooser as well.
    if (haystack.includes("tool") && (haystack.includes("proficien") || haystack.includes("trait") || haystack.includes("choice"))) return true;
    return ORIGIN_FEAT_NAMES_2024.some(name => haystack.includes(name.toLowerCase()));
  }

  async _addBackgroundOriginFeat(actor) {
    if (!this.cache.items.length) await this._loadOptions();
    const names = new Set();
    const mapped = this._backgroundOriginFeatName();
    if (mapped) names.add(mapped);

    // The selected background may have come from the dnd5e browser and may not be
    // the same object stored in this module cache.  Reload it here so the Feat:
    // line such as "@feat[Tough|XPHB]" is parsed from the real document.
    const cachedBackground = this.cache.backgrounds.find(b => b.uuid === this.build.backgroundUuid);
    const selectedBackground = await this._safeFromUuid(this.build.backgroundUuid);
    for (const bg of [cachedBackground, selectedBackground]) {
      for (const name of this._backgroundOriginFeatNamesFromDoc(bg)) names.add(name);
    }

    for (const name of names) {
      const entry = this._originFeatCandidatesForName(name)[0] ?? await this._findOriginFeatInPacksByName(name);
      if (!entry?.uuid) {
        console.warn(`${MODULE_ID} | Could not find background origin feat in loaded sourcebooks: ${name}`);
        continue;
      }
      const doc = await this._safeFromUuid(entry.uuid);
      if (!doc) continue;
      const wantedSlug = this._originFeatSlugFromName(name);
      const docSlug = this._originFeatSlugFromName(doc.name);
      const alreadyPresent = actor.items.some(item => {
        const itemSlug = this._originFeatSlugFromName(item.name);
        return item.type === "feat" && (itemSlug === docSlug || itemSlug === wantedSlug || (wantedSlug.startsWith("magic-initiate-") && itemSlug === "magic-initiate"));
      });
      if (alreadyPresent) continue;
      const created = await this._createOriginFeatSilently(actor, doc, name);
      if (!created?.length) console.warn(`${MODULE_ID} | Background origin feat did not create on actor: ${name}`);
    }
  }

  async _createOriginFeatSilently(actor, doc, grantedAsName = "") {
    const data = this._stripThirdPartyBuilderFlags(doc.toObject());
    data.type = "feat";
    data.system ??= {};
    data.system.type ??= {};
    data.system.type.value = "feat";
    data.system.type.subtype = "origin";
    data.system.source ??= {};
    if (grantedAsName) data.system.source.custom = data.system.source.custom || `Background Origin Feat: ${grantedAsName}`;

    // Plutonium watches compendium-origin flags and can show its own drag/drop
    // import dialog even when dnd5e advancement prompts are suppressed. Remove
    // those source breadcrumbs from the actor copy only; the feat mechanics and
    // its native advancement data remain intact.
    if (data.flags?.core) delete data.flags.core.sourceId;
    if (data.flags?.dnd5e) delete data.flags.dnd5e.sourceId;

    const background = this._actorOriginItem(actor, "background", this.build.backgroundUuid, this.build.backgroundName);
    if (background?.id && grantedAsName) data.flags = foundry.utils.mergeObject(data.flags ?? {}, { dnd5e: { advancementOrigin: background.id } }, { inplace: false });

    suppressExternalBuilderPrompts(120000, "Importing background origin feat silently", actor.id);
    return actor.createEmbeddedDocuments("Item", [data], {
      renderSheet: false,
      prompt: false,
      prompts: false,
      configure: false,
      advancement: true,
      advancements: true,
      noAdvancement: false,
      skipAdvancement: false,
      dnd5e: { advancement: true, advancements: true, prompt: false, configure: false },
      plutonium: { prompt: false, configure: false, importer: false },
      charactermancer: false
    });
  }

  async _findOriginFeatInPacksByName(name) {
    const target = this._originFeatSlugFromName(name);
    if (!target) return null;

    // Only search packs the GM has configured for "Feats" - do not fall back
    // to scanning every installed Item compendium. A GM-pinned override (see
    // the Feature Overrides settings menu) always wins first.
    const overrideUuid = getOverride(OVERRIDE_CONTEXT.originFeat(), name);
    if (overrideUuid) return { name, uuid: overrideUuid, pack: overrideUuid.startsWith("Compendium.") ? overrideUuid.split(".").slice(1, -1).join(".") : "" };

    const candidates = await scanConfiguredPacks("feats", {
      itemTypes: null,
      fallbackSourceTypes: ["classFeatures"],
      indexFields: ["type", "system.source", "system.identifier", "system.type", "system.category", "system.requirements", "system.description.value"],
      predicate: candidate => {
        const nameSlug = this._originFeatSlugFromName(candidate.name);
        const identifierSlug = this._originFeatSlugFromName(candidate.system?.identifier);
        const genericMagic = target.startsWith("magic-initiate-") && nameSlug === "magic-initiate";
        return nameSlug === target || identifierSlug === target || genericMagic;
      }
    });
    let best = null;
    for (const candidate of candidates) {
      if (!best || this._featSourceScore(candidate) > this._featSourceScore(best)) best = candidate;
    }
    if (best && !this.cache.feats.some(f => f.uuid === best.uuid)) this.cache.feats.push(best);
    return best;
  }

  async _addSelectedOriginFeats(actor) {
    const data = await this._originFeatData();
    const uuids = data.requiredExtra ? [...(this.build.originFeatUuids ?? [])].filter(Boolean) : [];
    for (const uuid of uuids) {
      const doc = await fromUuid(uuid);
      if (!doc) continue;
      const slug = this._originFeatSlugFromName(doc.name);
      const alreadyPresent = actor.items.some(item => item.type === "feat" && this._originFeatSlugFromName(item.name) === slug);
      if (alreadyPresent) continue;
      await this._createOriginFeatSilently(actor, doc);
    }
  }


  _itemDataForImport(doc) {
    const data = doc.toObject();
    if (doc.type === "class") {
      data.system ??= {};
      data.system.levels = 1;
      this._setInitialHitPointsAdvancementValue(data);
      return this._stripClassBuilderChoiceAdvancements(data);
    }
    if (["race", "species"].includes(doc.type)) return this._stripSpeciesChoiceAdvancements(data);
    if (doc.type === "background") return this._stripBackgroundAbilityAdvancements(data);
    return data;
  }

  /**
   * Records the level 1 choice ("max") on the class item's own HitPoints
   * advancement before it is created on the actor.
   *
   * dnd5e only auto-computes an actor's hp.max from class advancement when
   * hp.max is null in the source data (CharacterData#prepareBaseData calls
   * AttributesFields.prepareHitPoints only in that case, summing each class's
   * HitPointsAdvancement#getAdjustedTotal()) - and that advancement only has
   * something to sum once a value has been recorded for each level taken.
   * Normally Foundry's native Advancement Manager records that value itself
   * when a class is added (prompting the player to roll or take the average
   * at levels 2+, and always "max" at level 1). This builder suppresses that
   * manager entirely so its own wizard can own level 1 instead, which means
   * nothing else was ever recording the level 1 entry - leaving the class's
   * HitPoints advancement permanently empty and hp.max permanently un-derivable
   * from it, for the rest of the character's life.
   *
   * 2024 (and 2014) rules fix level 1 hit points at the hit die's maximum
   * value plus the Constitution modifier - there's no roll/average choice at
   * level 1 - so "max" is always the correct value to record here, and this
   * builder never supports multiclassing, so this class is always the
   * original class for the purposes of that rule.
   */
  _setInitialHitPointsAdvancementValue(classData) {
    const advancements = classData?.system?.advancement;
    // Item#toObject() on a compendium document returns advancement as a plain
    // object keyed by advancement ID, not an array (the array form is only
    // exposed later, by the data model's own convenience getter on an
    // embedded item) - so both shapes need to be handled here, the same way
    // _stripLevelOneOnlyAdvancements already does below.
    const hp = Array.isArray(advancements)
      ? advancements.find(a => String(a?.type ?? "").toLowerCase().includes("hitpoints"))
      : Object.values(advancements ?? {}).find(a => String(a?.type ?? "").toLowerCase().includes("hitpoints"));
    if (!hp) return;
    hp.value = { ...(hp.value ?? {}), 1: "max" };
  }

  /**
   * True if an advancement entry's applicable levels are level 1 AND NOTHING
   * ELSE. Shared by the class and species stripping helpers below: both own
   * every level-1 choice for the item they're importing (granting the
   * feature/trait/spell directly instead of going through the native
   * Advancement Manager), so only advancement that is exclusively level-1 is
   * safe to drop. Anything that also (or only) applies at level 2+ MUST be
   * preserved untouched, or the character can never advance correctly later
   * - this covers class Ability Score Improvements and Subclass selection,
   * later ItemGrant/Trait/ItemChoice entries (e.g. a level 3 "choose your
   * subclass" step), and species features that unlock at a higher level
   * (e.g. a Tiefling's extra 1/day legacy spell at level 3 and 5, or an
   * Aasimar's level 3 transformation). ScaleValue and HitPoints advancements
   * always span the item's entire level range - dnd5e features reference
   * ScaleValue formulas such as @scale.barbarian.rage-damage at every level,
   * and HitPoints must stay available for every future hit-die roll - so
   * both types are always preserved regardless of what their raw "level"
   * field says.
   */
  _isLevelOneOnlyAdvancement(advancement) {
    const type = String(advancement?.type ?? advancement?._type ?? "").toLowerCase();

    if (type.includes("scalevalue") || type === "scale") return false;
    if (type.includes("hitpoints")) return false;

    // ItemChoice (e.g. Fighting Style choices offered at multiple levels)
    // stores its per-level configuration under configuration.choices,
    // keyed by level. Only strip it if every configured level is <= 1.
    if (type.includes("itemchoice")) {
      const levels = Object.keys(advancement?.configuration?.choices ?? {})
        .map(Number)
        .filter(Number.isFinite);
      return levels.length ? levels.every(level => level <= 1) : true;
    }

    // Everything else (ItemGrant, Trait, Subclass, AbilityScoreImprovement,
    // etc.) is single-level: its raw "level" field is the one level it
    // applies at.
    const level = Number(advancement?.level);
    return !Number.isFinite(level) || level <= 1;
  }

  _stripLevelOneOnlyAdvancements(itemData, { logLabel } = {}) {
    const advancements = itemData?.system?.advancement;
    const originalCount = advancements == null ? 0 : Array.isArray(advancements) ? advancements.length : Object.keys(advancements ?? {}).length;
    if (!itemData.system) itemData.system = {};

    if (Array.isArray(advancements)) {
      itemData.system.advancement = advancements.filter(advancement => !this._isLevelOneOnlyAdvancement(advancement));
    } else if (advancements && typeof advancements === "object") {
      itemData.system.advancement = Object.fromEntries(Object.entries(advancements).filter(([, advancement]) => !this._isLevelOneOnlyAdvancement(advancement)));
    } else {
      itemData.system.advancement = [];
    }

    const preservedCount = Array.isArray(itemData.system.advancement)
      ? itemData.system.advancement.length
      : Object.keys(itemData.system.advancement ?? {}).length;
    console.info(`${MODULE_ID} | Removed ${originalCount - preservedCount} level-1-only ${logLabel ?? "item"} advancement(s) from ${itemData.name} (already granted directly by the builder); preserved ${preservedCount} advancement(s) so the character can advance past level 1 normally.`);
    return itemData;
  }

  _stripSpeciesChoiceAdvancements(itemData) {
    return this._stripLevelOneOnlyAdvancements(itemData, { logLabel: "species" });
  }

  _stripClassBuilderChoiceAdvancements(itemData) {
    return this._stripLevelOneOnlyAdvancements(itemData, { logLabel: "class" });
  }

  _isLevelOneClassFeatureGrantAdvancement(advancement) {
    const haystack = JSON.stringify(advancement ?? {}).toLowerCase();
    const type = String(advancement?.type ?? "").toLowerCase();
    if (!(type.includes("itemgrant") || type.includes("itemchoice"))) return false;
    if (haystack.includes("spell")) return false;
    if (haystack.includes("equipment") || haystack.includes("gear") || haystack.includes("weapon") || haystack.includes("armor")) return false;
    const level = Number(advancement?.level ?? advancement?.configuration?.level ?? advancement?.value?.level ?? 1);
    return !Number.isFinite(level) || level <= 1 || haystack.includes('"level":1') || haystack.includes('"level": 1');
  }

  _stripLevelOneSpellbookAdvancements(itemData) {
    const advancements = itemData?.system?.advancement;
    if (!Array.isArray(advancements)) return itemData;

    const filtered = advancements.filter(advancement => !this._isLevelOneSpellbookAdvancement(advancement));
    if (filtered.length !== advancements.length) {
      itemData.system.advancement = filtered;
      console.info(`${MODULE_ID} | Removed ${advancements.length - filtered.length} class spellbook advancement(s) from ${itemData.name} import so level 1 spell choices stay controlled by the builder.`);
    }
    return itemData;
  }

  _isLevelOneSpellbookAdvancement(advancement) {
    const haystack = JSON.stringify(advancement ?? {}).toLowerCase();
    if (!haystack.includes("spell")) return false;

    // The builder owns cantrip selection, so suppress cantrip advancement prompts too.

    const type = String(advancement?.type ?? "").toLowerCase();
    const itemChoiceLike = ["itemchoice", "itemgrant", "spell", "spellgrant", "spellchoice"].includes(type);
    const spellbookLike = haystack.includes("spellbook") || haystack.includes("spell book") || haystack.includes("populate") || haystack.includes("prepared spell") || haystack.includes("spell list") || haystack.includes("class spells");
    const levelOneLike = haystack.includes("level 1") || haystack.includes("level1") || haystack.includes("1st-level") || haystack.includes("1st level") || haystack.includes('"level":1') || haystack.includes("1st") || haystack.includes('"levels":[1]');

    // If this builder is handling level 1 spell choices for the selected class,
    // remove any non-cantrip spell item choice/grant from the class import. This
    // prevents dnd5e's bulk spellbook/populate prompt, especially for Paladin.
    const builderHandlesLevelOneSpells = Boolean(this._selectedClassPrompt()?.spells?.level1);
    if (builderHandlesLevelOneSpells && itemChoiceLike) return true;

    return spellbookLike || (itemChoiceLike && levelOneLike);
  }



  _isClassEquipmentAdvancement(advancement) {
    const haystack = JSON.stringify(advancement ?? {}).toLowerCase();
    const type = String(advancement?.type ?? "").toLowerCase();
    if (haystack.includes("equipment") || haystack.includes("gear") || haystack.includes("starting equipment")) return true;
    if ((type.includes("itemchoice") || type.includes("itemgrant")) && (haystack.includes("weapon") || haystack.includes("armor") || haystack.includes("pack") || haystack.includes("tool"))) return true;
    return false;
  }

  _isClassSkillOrMasteryChoiceAdvancement(advancement) {
    const haystack = JSON.stringify(advancement ?? {}).toLowerCase();
    const type = String(advancement?.type ?? "").toLowerCase();
    const choiceLike = type.includes("choice") || haystack.includes("choose") || haystack.includes("choice") || haystack.includes("select");
    if (!choiceLike) return false;
    if (haystack.includes("skill") || haystack.includes("proficien") || haystack.includes("mastery") || haystack.includes("weapon")) return true;
    return false;
  }

  async _addSelectedCantrips(actor) {
    for (const uuid of this.build.cantripUuids ?? []) {
      const doc = await fromUuid(uuid);
      if (!doc) continue;
      const slug = this._slug(doc.name);
      const alreadyPresent = actor.items.some(item => item.type === "spell" && Number(item.system?.level ?? -1) === 0 && this._slug(item.name) === slug);
      if (alreadyPresent) continue;
      await this._createItemsWithoutAdvancementPrompts(actor, [doc.toObject()]);
    }
  }

  async _addSelectedLevelOneSpells(actor) {
    // Classes that prepare from a broader spell list (Artificer, Cleric,
    // Druid, Paladin per CLASS_PROMPTS_2024's spells.prepared flag) need the
    // spells chosen here marked as actually prepared. Otherwise dnd5e's
    // sheet leaves the "prepared" checkbox off (compendium spells default to
    // unprepared) and a prepared caster cannot cast any of their level-1
    // spells until the player manually toggles each one - the class ends up
    // with zero usable leveled spells right out of the builder. Known-caster
    // classes (Bard, Ranger, Sorcerer, Warlock, Wizard's spellbook) don't set
    // that flag, so they are untouched and keep whatever the compendium item
    // already has.
    const preparesFromList = Boolean(this._selectedClassPrompt()?.spells?.prepared);

    for (const uuid of this.build.spellUuids ?? []) {
      const doc = await fromUuid(uuid);
      if (!doc) continue;
      const slug = this._slug(doc.name);
      const alreadyPresent = actor.items.some(item => item.type === "spell" && Number(item.system?.level ?? -1) === 1 && this._slug(item.name) === slug);
      if (alreadyPresent) continue;
      const data = doc.toObject();
      if (preparesFromList) {
        data.system ??= {};
        data.system.preparation = { ...(data.system.preparation ?? {}), mode: "prepared", prepared: true };
      }
      await this._createItemsWithoutAdvancementPrompts(actor, [data]);
    }
  }

  async _addPactOfTheTomeSpells(actor) {
    const uuids = [
      ...(this.build.tomeCantripUuids ?? []),
      ...(this.build.tomeRitualSpellUuids ?? [])
    ];
    for (const uuid of uuids) {
      const doc = await fromUuid(uuid);
      if (!doc) continue;
      const level = Number(doc.system?.level ?? -1);
      const slug = this._slug(doc.name);
      const alreadyPresent = actor.items.some(item => item.type === "spell" && Number(item.system?.level ?? -1) === level && this._slug(item.name) === slug);
      if (alreadyPresent) continue;
      const data = doc.toObject();
      data.flags = foundry.utils.mergeObject(data.flags ?? {}, {
        [MODULE_ID]: { source: "pact-of-the-tome" }
      }, { inplace: false });
      await this._createItemsWithoutAdvancementPrompts(actor, [data]);
    }
  }

  _magicInitiateSpellUpdates(dataState, level = -1) {
    const updates = {
      flags: {
        [MODULE_ID]: { source: "magic-initiate", magicInitiateSource: dataState.sourceKey }
      },
      system: {
        source: { custom: `Magic Initiate (${dataState.sourceLabel})` }
      }
    };

    // The 2024 Magic Initiate level-1 spell should remain visible on the actor
    // even when it overlaps with the class spell list.  Mark it as always
    // prepared so dnd5e does not treat it as an unselected class preparation.
    if (Number(level) === 1) {
      // Do not let the actor sheet classify the Magic Initiate spell as a
      // Warlock Pact Magic spell just because the character has Pact Magic.
      // Innate keeps it separate from the class spell picks while still
      // leaving the spell on the actor for manual slot/free-use handling.
      updates.system.preparation = { mode: "innate", prepared: true };
    }
    return updates;
  }

  async _addMagicInitiateSpells(actor) {
    const dataState = await this._magicInitiateData();
    if (!dataState.active) return;
    const uuids = [
      ...(this.build.magicInitiateCantripUuids ?? []),
      this.build.magicInitiateSpellUuid
    ].filter(Boolean);
    for (const uuid of uuids) {
      const doc = await fromUuid(uuid);
      if (!doc) continue;
      const level = Number(doc.system?.level ?? -1);
      const slug = this._slug(doc.name);
      const updates = this._magicInitiateSpellUpdates(dataState, level);
      const existing = actor.items.find(item => item.type === "spell" && Number(item.system?.level ?? -1) === level && this._slug(item.name) === slug);

      // If dnd5e advancement or a class spell choice already created the same
      // spell, do not skip it. Tag the existing copy as Magic Initiate-owned so
      // the later class-spell cleanup pass will not remove the selected level-1
      // Magic Initiate spell. This was why cantrips could appear while the
      // selected level-1 Magic Initiate spell disappeared after finish.
      //
      // Do NOT apply the innate-preparation override in this branch: when the
      // "existing" item is actually one of the player's own class spell
      // picks (e.g. they chose the same 1st-level spell both as a class
      // spell and as their Magic Initiate spell), forcing it to "innate"
      // would silently turn a real prepared/known class spell into a
      // slot-free at-will ability. Only a brand-new Magic Initiate item
      // (the branch below) should get that treatment.
      if (existing) {
        const tagOnlyUpdates = foundry.utils.deepClone(updates);
        delete tagOnlyUpdates.system?.preparation;
        await existing.update(foundry.utils.mergeObject(tagOnlyUpdates, {
          "system.source.custom": existing.system?.source?.custom || `Magic Initiate (${dataState.sourceLabel})`
        }, { inplace: false }));
        continue;
      }

      const data = foundry.utils.mergeObject(doc.toObject(), updates, { inplace: false });
      data.system ??= {};
      data.system.source ??= {};
      data.system.source.custom = data.system.source.custom || `Magic Initiate (${dataState.sourceLabel})`;
      await this._createItemsWithoutAdvancementPrompts(actor, [data]);
    }
  }

  async _cleanupUnselectedLevelOneClassSpells(actor, preFinishItemIds) {
    const prompt = this._selectedClassPrompt()?.spells;
    if (!prompt?.level1) return;

    const classKey = this._selectedClassKey();
    const allowedList = CLASS_LEVEL1_SPELLS_2024[classKey] ?? null;
    if (!allowedList) return;

    const selectedNames = new Set();
    for (const uuid of this.build.spellUuids ?? []) {
      const doc = await this._safeFromUuid(uuid);
      if (doc) selectedNames.add(this._slug(doc.name));
    }

    const deleteIds = actor.items
      .filter(item => !preFinishItemIds.has(item.id))
      .filter(item => item.type === "spell")
      .filter(item => Number(item.system?.level ?? -1) === 1)
      .filter(item => !item.flags?.[MODULE_ID]?.source)
      .filter(item => allowedList.has(this._slug(item.name)))
      .filter(item => !selectedNames.has(this._slug(item.name)))
      .map(item => item.id);

    if (deleteIds.length) {
      await actor.deleteEmbeddedDocuments("Item", deleteIds);
      console.info(`${MODULE_ID} | Removed ${deleteIds.length} unselected level 1 class spell(s) added by dnd5e advancement.`);
    }
  }

  async _clearIncorrectStartingConditions(actor) {
    const bad = new Set(["prone", "unconscious"]);
    const effects = actor.effects?.filter(effect => {
      const statuses = effect.statuses instanceof Set ? Array.from(effect.statuses) : Array.isArray(effect.statuses) ? effect.statuses : [];
      const statusId = effect.getFlag?.("core", "statusId") ?? effect.flags?.core?.statusId ?? "";
      const name = this._slug(effect.name ?? effect.label ?? "");
      return statuses.some(s => bad.has(String(s).toLowerCase())) || bad.has(String(statusId).toLowerCase()) || bad.has(name);
    }) ?? [];

    if (effects.length) await actor.deleteEmbeddedDocuments("ActiveEffect", effects.map(effect => effect.id));

    // Some worlds/modules store prototype token statuses separately. Clear just these two
    // starting-condition statuses without touching other prototype token configuration.
    try {
      const statuses = actor.prototypeToken?.statuses;
      if (statuses && typeof statuses[Symbol.iterator] === "function") {
        const nextStatuses = Array.from(statuses).filter(s => !bad.has(String(s).toLowerCase()));
        await actor.update({ "prototypeToken.statuses": nextStatuses });
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not clear prototype token statuses`, err);
    }
  }

  _speciesChoiceResistanceUpdates(actor) {
    const current = actor?.system?.traits?.dr?.value;
    const merged = new Set(Array.isArray(current) ? current : []);
    const group = this._speciesChoiceGroup();
    if (!group) return {};

    if (group.stateKey === "tieflingLegacy") {
      const legacy = TIEFLING_LEGACIES_2024[this.build.tieflingLegacy];
      if (legacy?.resistance) merged.add(legacy.resistance);
    }

    if (group.stateKey === "dragonbornAncestry") {
      const ancestry = DRAGONBORN_ANCESTRIES_2024[this.build.dragonbornAncestry];
      if (ancestry?.damage) merged.add(ancestry.damage);
    }

    return { "system.traits.dr.value": [...merged] };
  }

  async _addSpeciesChoiceFeatureItem(actor) {
    const data = this._speciesChoiceData();
    if (!data.required || !data.selected) return;
    const selected = data.options.find(o => o.key === data.selected);
    if (!selected) return;
    const speciesName = this.build.speciesName || this.cache.species.find(s => s.uuid === this.build.speciesUuid)?.name || "Species";
    const name = `${data.title}: ${selected.label}`;
    const exists = actor.items.some(item => item.type === "feat" && item.name === name);
    if (exists) return;

    let description = selected.description || `${speciesName} choice: ${selected.label}.`;
    if (data.stateKey === "dragonbornAncestry" && selected.damageLabel) {
      description = `${selected.label} ancestry sets your Breath Weapon damage type and grants ${selected.damageLabel} resistance.`;
    }
    if (data.stateKey === "tieflingLegacy" && selected.resistanceLabel) {
      description = `${selected.label} legacy grants ${selected.resistanceLabel} resistance at level 1.`;
    }

    await this._createItemsWithoutAdvancementPrompts(actor, [{
      name,
      type: "feat",
      img: this._speciesChoiceIcon(data.stateKey),
      system: {
        description: { value: `<p>${foundry.utils.escapeHTML(description)}</p>` },
        type: { value: "race", subtype: "" },
        source: { custom: "Level One 2024 Character Builder" }
      }
    }]);
  }

  _speciesChoiceIcon(stateKey) {
    if (stateKey === "dragonbornAncestry") return "icons/creatures/reptiles/dragon-horned-blue.webp";
    if (stateKey === "tieflingLegacy") return "icons/magic/fire/flame-burning-horned-mask.webp";
    if (stateKey === "gnomeLineage") return "icons/environment/settlement/house-rural.webp";
    if (stateKey === "elfLineage") return "icons/magic/nature/leaf-glow-green.webp";
    if (stateKey === "goliathAncestry") return "icons/magic/earth/projectile-stone-landslide.webp";
    return "icons/svg/upgrade.svg";
  }

  _languageUpdates(actor) {
    const chosen = (this.build.languageChoices ?? []).filter(Boolean);
    const current = actor?.system?.traits?.languages?.value;
    const merged = new Set(Array.isArray(current) ? current : []);

    // 2024 characters should have Common as their baseline language. Some
    // dnd5e actor templates/worlds do not add it automatically, so ensure it
    // is present while still only asking the player to choose the two extra
    // languages in the builder UI.
    merged.add(DEFAULT_BASE_LANGUAGE);

    for (const language of chosen) merged.add(language);
    return { "system.traits.languages.value": [...merged] };
  }

  _classBaseProficiencyUpdates(actor = null) {
    const classKey = this._selectedClassKey();
    const profs = CLASS_BASE_PROFICIENCIES_2024[classKey];
    if (!profs) return {};

    const updates = {};

    for (const save of profs.saves ?? []) {
      if (!ABILITIES.includes(save)) continue;
      const current = Number(actor?.system?.abilities?.[save]?.proficient ?? 0);
      updates[`system.abilities.${save}.proficient`] = Math.max(Number.isFinite(current) ? current : 0, 1);
    }

    const armorValues = new Set(Array.isArray(actor?.system?.traits?.armorProf?.value) ? actor.system.traits.armorProf.value : []);
    for (const armor of profs.armor ?? []) if (armor) armorValues.add(armor);
    if ((profs.armor ?? []).length) updates["system.traits.armorProf.value"] = [...armorValues];

    const weaponValues = new Set(Array.isArray(actor?.system?.traits?.weaponProf?.value) ? actor.system.traits.weaponProf.value : []);
    for (const weapon of profs.weapons ?? []) if (weapon) weaponValues.add(weapon);
    if ((profs.weapons ?? []).length) updates["system.traits.weaponProf.value"] = [...weaponValues];

    const existingToolKeys = new Set(Object.keys(actor?.system?.tools ?? {}));
    const traitPath = actor?.system?.traits?.toolProf?.value;
    const traitValues = new Set(Array.isArray(traitPath) ? traitPath : []);
    for (const toolName of profs.tools ?? []) {
      const keys = this._candidateToolKeys(toolName, actor);
      let wroteTool = false;
      for (const key of keys) {
        if (!key) continue;
        if (existingToolKeys.has(key) || Object.values(TOOL_KEY_ALIASES_2024).some(list => list.includes(key))) {
          const currentValue = Number(actor?.system?.tools?.[key]?.value ?? 0);
          updates[`system.tools.${key}.value`] = Math.max(Number.isFinite(currentValue) ? currentValue : 0, 1);
          wroteTool = true;
        }
      }
      if (!wroteTool) traitValues.add(this._slug(toolName));
    }
    if ((profs.tools ?? []).length) updates["system.traits.toolProf.value"] = [...traitValues];

    return updates;
  }

  async _applyBuilderClassBaseProficiencies(actor) {
    const updates = this._classBaseProficiencyUpdates(actor);
    if (!Object.keys(updates).length) return;
    await actor.update(updates);
  }

  _normalizedToolName(name) {
    return String(name ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\|[^\]]+$/g, "")
      .replace(/^@?item\[/i, "")
      .replace(/\]$/g, "")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  _candidateToolKeys(name, actor = null) {
    const normalized = this._normalizedToolName(name);
    const keys = new Set(TOOL_KEY_ALIASES_2024[normalized] ?? []);
    keys.add(this._slug(normalized).replace(/-/g, ""));
    keys.add(this._slug(normalized));

    const configSources = [
      CONFIG?.DND5E?.tools,
      CONFIG?.DND5E?.toolProficiencies,
      CONFIG?.DND5E?.toolIds
    ].filter(Boolean);
    for (const source of configSources) {
      for (const [key, label] of Object.entries(source)) {
        const labelText = typeof label === "string" ? label : (label?.label ?? label?.name ?? "");
        if (!labelText) continue;
        if (this._normalizedToolName(labelText) === normalized) keys.add(key);
      }
    }

    for (const [key, data] of Object.entries(actor?.system?.tools ?? {})) {
      const labels = [key, data?.label, data?.name, data?.tool, data?.ability].filter(Boolean);
      if (labels.some(label => this._normalizedToolName(label) === normalized || TOOL_KEY_ALIASES_2024[normalized]?.includes(String(label).toLowerCase()))) keys.add(key);
    }

    return [...keys].filter(Boolean);
  }

  _toolUpdates(actor = null) {
    const updates = {};
    const tools = new Set([...this._backgroundToolNames(), ...this._skilledChosenToolNames()]);
    const existingToolKeys = new Set(Object.keys(actor?.system?.tools ?? {}));
    const traitPath = actor?.system?.traits?.toolProf?.value;
    const traitValues = Array.isArray(traitPath) ? new Set(traitPath) : null;

    for (const toolName of tools) {
      const keys = this._candidateToolKeys(toolName, actor);
      let wroteTool = false;
      for (const key of keys) {
        if (!key) continue;
        // Prefer existing actor tool slots, but also write well-known dnd5e keys
        // because many actor templates do not materialize every tool until used.
        if (existingToolKeys.has(key) || Object.values(TOOL_KEY_ALIASES_2024).some(list => list.includes(key))) {
          const currentValue = Number(actor?.system?.tools?.[key]?.value ?? 0);
          updates[`system.tools.${key}.value`] = Math.max(Number.isFinite(currentValue) ? currentValue : 0, 1);
          wroteTool = true;
        }
      }
      if (!wroteTool && traitValues) {
        traitValues.add(this._slug(toolName));
      }
    }

    if (traitValues) updates["system.traits.toolProf.value"] = [...traitValues];
    return updates;
  }

  async _applyBuilderToolProficiencies(actor) {
    const updates = this._toolUpdates(actor);
    if (!Object.keys(updates).length) return;
    await actor.update(updates);
  }

  _allBuilderSkillKeys() {
    const skills = new Set();
    for (const skill of this._backgroundSkillKeys()) if (SKILL_LABELS[skill]) skills.add(skill);
    for (const skill of this.build.skillChoices ?? []) if (SKILL_LABELS[skill]) skills.add(skill);
    if (this._isHumanSpecies() && SKILL_LABELS[this.build.humanSkillChoice]) skills.add(this.build.humanSkillChoice);
    for (const skill of this._skilledChosenSkillKeys()) skills.add(skill);
    return skills;
  }

  /**
   * v1.20.3: the skill half of the Skilled origin feat's three picks
   * (this.build.skilledChoiceKeys holds "skill:<key>"/"tool:<name>" entries
   * together - see _skilledFeatData()). Folded into _allBuilderSkillKeys() so
   * these proficiencies are applied by the same builder-owned
   * _applyBuilderSkillProficiencies() pass as background/class/Human skills,
   * rather than needing a separate actor.update() call of their own.
   */
  _skilledChosenSkillKeys() {
    const keys = new Set();
    for (const entry of this.build.skilledChoiceKeys ?? []) {
      if (typeof entry === "string" && entry.startsWith("skill:")) {
        const key = entry.slice(6);
        if (SKILL_LABELS[key]) keys.add(key);
      }
    }
    return keys;
  }

  /**
   * v1.20.3: the tool half of the Skilled origin feat's three picks. Folded
   * into _toolUpdates()'s tool-name source below, the same way background
   * tool proficiencies already are, so both go through the same
   * _candidateToolKeys()-based resolution onto the actor's system.tools.*
   * fields (or the toolProf trait fallback for a tool the actor template
   * hasn't materialized yet).
   */
  _skilledChosenToolNames() {
    const names = new Set();
    for (const entry of this.build.skilledChoiceKeys ?? []) {
      if (typeof entry === "string" && entry.startsWith("tool:")) {
        const toolKey = entry.slice(5);
        const label = SKILLED_TOOL_OPTIONS_2024.find(t => t.key === toolKey)?.label;
        names.add(label ?? toolKey);
      }
    }
    return names;
  }

  _skillUpdates(actor = null) {
    const updates = {};

    // Background, class, and Human proficiencies are builder-owned. Apply them
    // using the native dnd5e skill value field and preserve/raise existing
    // proficiency rather than overwriting expertise or half proficiency.
    const addSkill = skill => {
      if (!SKILL_LABELS[skill]) return;
      const currentValue = Number(actor?.system?.skills?.[skill]?.value ?? 0);
      const value = Math.max(Number.isFinite(currentValue) ? currentValue : 0, 1);
      // dnd5e v5.x's native skill proficiency field is .value. Avoid writing
      // non-schema compatibility aliases here; v13's stricter data model can
      // drop or reject them before the real update is committed.
      updates[`system.skills.${skill}.value`] = value;
    };

    for (const skill of this._allBuilderSkillKeys()) addSkill(skill);
    return updates;
  }

  async _applyBuilderSkillProficiencies(actor) {
    const updates = this._skillUpdates(actor);
    if (!Object.keys(updates).length) return;
    await actor.update(updates);

    // dnd5e 5.x represents each skill as a nested DataModel. If another hook
    // normalizes the first dotted update, retry by submitting the complete
    // skills object through the actor's schema instead of repeating the same
    // dotted update. Preserve every existing skill field and proficiency above
    // 1 (such as Expertise).
    const requested = [...this._allBuilderSkillKeys()];
    if (requested.every(skill => Number(actor.system?.skills?.[skill]?.value ?? 0) >= 1)) return;

    const skillData = {};
    for (const [key, skill] of Object.entries(actor.system?.skills ?? {})) {
      let data;
      try { data = skill?.toObject ? skill.toObject(false) : foundry.utils.deepClone(skill); }
      catch (_err) { data = { value: Number(skill?.value ?? 0) }; }
      skillData[key] = data ?? {};
    }
    for (const skill of requested) {
      const current = Number(skillData[skill]?.value ?? actor.system?.skills?.[skill]?.value ?? 0);
      skillData[skill] = { ...(skillData[skill] ?? {}), value: Math.max(Number.isFinite(current) ? current : 0, 1) };
    }
    await actor.update({ "system.skills": skillData }, { diff: false });

    const failed = requested.filter(skill => Number(actor.system?.skills?.[skill]?.value ?? 0) < 1);
    if (failed.length) throw new Error(`dnd5e rejected skill proficiency updates for: ${failed.join(", ")}`);
  }
}


export function openLevelOne2024Builder(actor = null) {
  try {
    const app = new LevelOne2024Builder(actor ? { actor } : {});
    return app.render(true);
  } catch (err) {
    console.error(`${MODULE_ID} | Could not open builder`, err);
    ui.notifications?.error?.(`Could not open the 2024 Character Builder: ${err.message}`);
    return null;
  }
}

function addBuilderButtonToActorDirectory(app, html) {
  if (!game.user.isGM && !game.settings.get(MODULE_ID, "playersCanCreateActors")) return;

  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  if (root.querySelector(".level-one-2024-builder-launch")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("level-one-2024-builder-launch");
  button.innerHTML = `<i class="fas fa-user-plus"></i> 2024 Character Builder`;
  button.addEventListener("click", event => {
    event.preventDefault();
    openLevelOne2024Builder();
  });

  const launcher = document.createElement("div");
  launcher.classList.add("level-one-2024-builder-directory-launcher");
  launcher.appendChild(button);

  const directoryList = root.querySelector(".directory-list");
  const header = root.querySelector(".directory-header");

  if (directoryList?.parentElement) {
    directoryList.parentElement.insertBefore(launcher, directoryList);
  } else if (header?.parentElement && header.nextSibling) {
    header.parentElement.insertBefore(launcher, header.nextSibling);
  } else if (header?.parentElement) {
    header.parentElement.appendChild(launcher);
  } else {
    root.prepend(launcher);
  }
}

Hooks.on("renderActorDirectory", addBuilderButtonToActorDirectory);
Hooks.on("renderSidebarTab", (app, html) => {
  if (app.constructor?.name === "ActorDirectory" || app.tabName === "actors" || app.options?.id === "actors") {
    addBuilderButtonToActorDirectory(app, html);
  }
});

function suppressRenderedExternalBuilderPrompt(app, html) {
  if (!shouldSuppressExternalBuilderPrompt(app)) return;
  const title = String(app?.title ?? app?.options?.title ?? "").toLowerCase();
  console.info(`${MODULE_ID} | Suppressing external character-builder prompt: ${app.constructor?.name ?? app.id ?? "unknown"}`);

  // Plutonium's drag-drop prompt is a yes/no dialog. Closing it can leave the
  // import in an indeterminate state, so pick the normal dnd5e drag-drop path
  // automatically when this builder is already doing a controlled import.
  if (title.includes("plutonium")) {
    const roots = [];
    if (html?.jquery) roots.push(html[0]);
    else if (Array.isArray(html) && html[0]) roots.push(html[0]);
    else if (html instanceof HTMLElement) roots.push(html);
    if (app?.element?.jquery) roots.push(app.element[0]);
    else if (app?.element instanceof HTMLElement) roots.push(app.element);

    for (const root of roots.filter(Boolean)) {
      const buttons = [...root.querySelectorAll("button, a, [data-action]")];
      const normalButton = buttons.find(button => {
        const text = String(button.textContent ?? "").toLowerCase();
        return text.includes("no, use normal") || text.includes("normal drag-drop") || (text.includes("no") && text.includes("normal"));
      });
      if (normalButton) {
        setTimeout(() => normalButton.click(), 0);
        return;
      }
    }
  }

  setTimeout(() => app.close?.({ force: true }), 0);
}

// "renderApplication" only fires for apps still built on the legacy AppV1
// framework. dnd5e has moved its AdvancementManager, CompendiumBrowser, and
// most other windows this suppression logic targets onto ApplicationV2 (true
// as far back as the 5.x releases this module still supports, and unchanged
// in 6.0.x), where the generic render hook is "renderApplicationV2" instead.
// Without this hook, suppression silently never saw those windows at all.
Hooks.on("renderApplication", suppressRenderedExternalBuilderPrompt);
Hooks.on("renderApplicationV2", suppressRenderedExternalBuilderPrompt);
Hooks.on("renderDialog", suppressRenderedExternalBuilderPrompt);
Hooks.on("renderDialogV2", suppressRenderedExternalBuilderPrompt);
