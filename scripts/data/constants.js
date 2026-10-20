// ============================================================
// Static data tables for the Level One 2024 Character Builder.
// No game.* calls here - pure data only, safe to import anywhere.
// ============================================================

export const MODULE_ID = "level-one-2024-builder";
export const DND5E_CORE_CLASS_PACK_ID = "dnd5e.classes";

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
export const ABILITY_LABELS = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma"
};
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const ACTIVE_BUILDERS = new Map();

export const TIEFLING_LEGACIES_2024 = {
  abyssal: {
    key: "abyssal",
    label: "Abyssal",
    resistance: "poison",
    resistanceLabel: "Poison",
    description: "Your fiendish legacy is Abyssal. At level 1, this grants resistance to poison damage."
  },
  chthonic: {
    key: "chthonic",
    label: "Chthonic",
    resistance: "necrotic",
    resistanceLabel: "Necrotic",
    description: "Your fiendish legacy is Chthonic. At level 1, this grants resistance to necrotic damage."
  },
  infernal: {
    key: "infernal",
    label: "Infernal",
    resistance: "fire",
    resistanceLabel: "Fire",
    description: "Your fiendish legacy is Infernal. At level 1, this grants resistance to fire damage."
  }
};


export const DRAGONBORN_ANCESTRIES_2024 = {
  black: { key: "black", label: "Black", damage: "acid", damageLabel: "Acid" },
  blue: { key: "blue", label: "Blue", damage: "lightning", damageLabel: "Lightning" },
  brass: { key: "brass", label: "Brass", damage: "fire", damageLabel: "Fire" },
  bronze: { key: "bronze", label: "Bronze", damage: "lightning", damageLabel: "Lightning" },
  copper: { key: "copper", label: "Copper", damage: "acid", damageLabel: "Acid" },
  gold: { key: "gold", label: "Gold", damage: "fire", damageLabel: "Fire" },
  green: { key: "green", label: "Green", damage: "poison", damageLabel: "Poison" },
  red: { key: "red", label: "Red", damage: "fire", damageLabel: "Fire" },
  silver: { key: "silver", label: "Silver", damage: "cold", damageLabel: "Cold" },
  white: { key: "white", label: "White", damage: "cold", damageLabel: "Cold" }
};

export const ELF_LINEAGES_2024 = {
  drow: { key: "drow", label: "Drow", description: "Choose the Drow lineage for your Elf species features." },
  high: { key: "high", label: "High Elf", description: "Choose the High Elf lineage for your Elf species features." },
  wood: { key: "wood", label: "Wood Elf", description: "Choose the Wood Elf lineage for your Elf species features." }
};

export const GNOME_LINEAGES_2024 = {
  forest: { key: "forest", label: "Forest Gnome", description: "Choose the Forest Gnome lineage for your Gnome species features." },
  rock: { key: "rock", label: "Rock Gnome", description: "Choose the Rock Gnome lineage for your Gnome species features." }
};

export const GOLIATH_ANCESTRIES_2024 = {
  cloud: { key: "cloud", label: "Cloud Giant", description: "Choose Cloud Giant ancestry for your Goliath species feature." },
  fire: { key: "fire", label: "Fire Giant", description: "Choose Fire Giant ancestry for your Goliath species feature." },
  frost: { key: "frost", label: "Frost Giant", description: "Choose Frost Giant ancestry for your Goliath species feature." },
  hill: { key: "hill", label: "Hill Giant", description: "Choose Hill Giant ancestry for your Goliath species feature." },
  stone: { key: "stone", label: "Stone Giant", description: "Choose Stone Giant ancestry for your Goliath species feature." },
  storm: { key: "storm", label: "Storm Giant", description: "Choose Storm Giant ancestry for your Goliath species feature." }
};

export const SPECIES_CHOICE_GROUPS_2024 = {
  dragonborn: {
    key: "dragonborn",
    stateKey: "dragonbornAncestry",
    title: "Dragonborn Ancestry",
    hint: "Dragonborn characters choose one draconic ancestry. This builder handles the choice because species advancement prompts are suppressed.",
    selectedLabel: "Selected Ancestry",
    options: Object.values(DRAGONBORN_ANCESTRIES_2024).map(o => ({ ...o, description: `${o.label} ancestry grants ${o.damageLabel} resistance and sets your Breath Weapon damage type.` }))
  },
  elf: {
    key: "elf",
    stateKey: "elfLineage",
    title: "Elf Lineage",
    hint: "Elf characters choose one lineage. This builder handles the choice because species advancement prompts are suppressed.",
    selectedLabel: "Selected Lineage",
    options: Object.values(ELF_LINEAGES_2024)
  },
  gnome: {
    key: "gnome",
    stateKey: "gnomeLineage",
    title: "Gnome Lineage",
    hint: "Gnome characters choose one lineage. This builder handles the choice because species advancement prompts are suppressed.",
    selectedLabel: "Selected Lineage",
    options: Object.values(GNOME_LINEAGES_2024)
  },
  tiefling: {
    key: "tiefling",
    stateKey: "tieflingLegacy",
    title: "Tiefling Legacy",
    hint: "Tiefling characters choose one fiendish legacy. This builder handles the choice because species advancement prompts are suppressed.",
    selectedLabel: "Selected Legacy",
    options: Object.values(TIEFLING_LEGACIES_2024).map(o => ({ ...o, description: `${o.label} legacy grants ${o.resistanceLabel} resistance at level 1.` }))
  },
  goliath: {
    key: "goliath",
    stateKey: "goliathAncestry",
    title: "Goliath Giant Ancestry",
    hint: "Goliath characters choose one giant ancestry. This builder handles the choice because species advancement prompts are suppressed.",
    selectedLabel: "Selected Ancestry",
    options: Object.values(GOLIATH_ANCESTRIES_2024)
  }
};

export const GUI_THEMES = {
  parchment: "Parchment",
  dark: "Dark Stone",
  crimson: "Crimson",
  arcane: "Arcane Blue",
  clean: "Clean Light",
  emerald: "Emerald Grove",
  royal: "Royal Purple",
  infernal: "Infernal Iron",
  frost: "Frost Silver",
  lantern: "Candlelit Tavern",
  highContrast: "High Contrast"
};


export const BASE_WEAPON_MASTERIES_2024 = {
  club: { name: "Club", mastery: "slow" },
  dagger: { name: "Dagger", mastery: "nick" },
  greatclub: { name: "Greatclub", mastery: "push" },
  handaxe: { name: "Handaxe", mastery: "vex" },
  javelin: { name: "Javelin", mastery: "slow" },
  "light-hammer": { name: "Light Hammer", mastery: "nick" },
  mace: { name: "Mace", mastery: "sap" },
  quarterstaff: { name: "Quarterstaff", mastery: "topple" },
  sickle: { name: "Sickle", mastery: "nick" },
  spear: { name: "Spear", mastery: "sap" },
  "light-crossbow": { name: "Light Crossbow", mastery: "slow" },
  dart: { name: "Dart", mastery: "vex" },
  shortbow: { name: "Shortbow", mastery: "vex" },
  sling: { name: "Sling", mastery: "slow" },
  battleaxe: { name: "Battleaxe", mastery: "topple" },
  flail: { name: "Flail", mastery: "sap" },
  glaive: { name: "Glaive", mastery: "graze" },
  greataxe: { name: "Greataxe", mastery: "cleave" },
  greatsword: { name: "Greatsword", mastery: "graze" },
  halberd: { name: "Halberd", mastery: "cleave" },
  lance: { name: "Lance", mastery: "topple" },
  longsword: { name: "Longsword", mastery: "sap" },
  maul: { name: "Maul", mastery: "topple" },
  morningstar: { name: "Morningstar", mastery: "sap" },
  pike: { name: "Pike", mastery: "push" },
  rapier: { name: "Rapier", mastery: "vex" },
  scimitar: { name: "Scimitar", mastery: "nick" },
  shortsword: { name: "Shortsword", mastery: "vex" },
  trident: { name: "Trident", mastery: "topple" },
  "war-pick": { name: "War Pick", mastery: "sap" },
  warhammer: { name: "Warhammer", mastery: "push" },
  whip: { name: "Whip", mastery: "slow" },
  blowgun: { name: "Blowgun", mastery: "vex" },
  "hand-crossbow": { name: "Hand Crossbow", mastery: "vex" },
  "heavy-crossbow": { name: "Heavy Crossbow", mastery: "push" },
  longbow: { name: "Longbow", mastery: "slow" }
};


export const BUILTIN_ABILITY_METHODS = {
  standard: {
    id: "standard",
    label: "Standard Array",
    type: "array",
    scores: [...STANDARD_ARRAY]
  },
  pointbuy: {
    id: "pointbuy",
    label: "Point Buy",
    type: "pointbuy",
    points: 27,
    min: 8,
    max: 15,
    costs: foundry.utils.deepClone(POINT_BUY_COSTS)
  },
  manual: {
    id: "manual",
    label: "Manual Entry",
    type: "manual",
    min: 3,
    max: 20
  },
  "4d6dl1": {
    id: "4d6dl1",
    label: "4d6 Drop Lowest",
    type: "roll",
    formula: "4d6dl1"
  },
  "2d6p6r12": {
    id: "2d6p6r12",
    label: "2d6+6, Reroll 1s and 2s",
    type: "roll",
    special: "2d6p6r12"
  }
};


export const CLASS_PROMPTS_2024 = {
  artificer: { skills: { count: 2, options: ["arc", "his", "inv", "med", "nat", "prc", "slt"] }, masteries: null, spells: { cantrips: 2, level1: 2, prepared: true, spellAbility: "int" } },
  barbarian: { skills: { count: 2, options: ["ani", "ath", "itm", "nat", "prc", "sur"] }, masteries: { count: 2 }, spells: null },
  bard: { skills: { count: 3, options: "any" }, masteries: null, spells: { cantrips: 2, level1: 4, spellAbility: "cha" } },
  cleric: { skills: { count: 2, options: ["his", "ins", "med", "per", "rel"] }, masteries: null, spells: { cantrips: 3, level1: 4, prepared: true, spellAbility: "wis" } },
  druid: { skills: { count: 2, options: ["arc", "ani", "ins", "med", "nat", "prc", "rel", "sur"] }, masteries: null, spells: { cantrips: 2, level1: 4, prepared: true, spellAbility: "wis" } },
  fighter: { skills: { count: 2, options: ["acr", "ani", "ath", "his", "ins", "itm", "prc", "sur"] }, masteries: { count: 3 }, fightingStyle: { count: 1 }, spells: null },
  monk: { skills: { count: 2, options: ["acr", "ath", "his", "ins", "rel", "ste"] }, masteries: null, spells: null },
  paladin: { skills: { count: 2, options: ["ath", "ins", "itm", "med", "per", "rel"] }, masteries: { count: 2 }, spells: { cantrips: 0, level1: 2, prepared: true, spellAbility: "cha" } },
  ranger: { skills: { count: 3, options: ["ani", "ath", "ins", "inv", "nat", "prc", "ste", "sur"] }, masteries: { count: 2 }, spells: { cantrips: 0, level1: 2, spellAbility: "wis" } },
  rogue: { skills: { count: 4, options: ["acr", "ath", "dec", "ins", "itm", "inv", "prc", "per", "slt", "ste"] }, masteries: { count: 2 }, spells: null },
  sorcerer: { skills: { count: 2, options: ["arc", "dec", "ins", "itm", "per", "rel"] }, masteries: null, spells: { cantrips: 4, level1: 2, spellAbility: "cha" } },
  warlock: { skills: { count: 2, options: ["arc", "dec", "his", "itm", "inv", "nat", "rel"] }, masteries: null, invocations: { count: 1 }, spells: { cantrips: 2, level1: 2, spellAbility: "cha" } },
  wizard: { skills: { count: 2, options: ["arc", "his", "ins", "inv", "med", "rel"] }, masteries: null, spells: { cantrips: 3, level1: 6, spellAbility: "int" } }
};





export const CLASS_BASE_PROFICIENCIES_2024 = {
  // These are applied directly because class advancement is intentionally
  // imported silently/stripped by the builder. Keep this table exhaustive for
  // every class the builder exposes so no class depends on dnd5e's suppressed
  // advancement workflow to receive its starting saves/armor/weapons/tools.
  artificer: { saves: ["con", "int"], armor: ["lgt", "med", "shl"], weapons: ["sim"], tools: ["Thieves' Tools", "Tinker's Tools"] },
  barbarian: { saves: ["str", "con"], armor: ["lgt", "med", "shl"], weapons: ["sim", "mar"], tools: [] },
  bard: { saves: ["dex", "cha"], armor: ["lgt"], weapons: ["sim"], tools: ["Musical Instrument", "Musical Instrument", "Musical Instrument"] },
  cleric: { saves: ["wis", "cha"], armor: ["lgt", "med", "shl"], weapons: ["sim"], tools: [] },
  druid: { saves: ["int", "wis"], armor: ["lgt", "shl"], weapons: ["sim"], tools: ["Herbalism Kit"] },
  fighter: { saves: ["str", "con"], armor: ["lgt", "med", "hvy", "shl"], weapons: ["sim", "mar"], tools: [] },
  // 2024 Monk: Simple weapons and martial weapons with the Light property.
  monk: { saves: ["str", "dex"], armor: [], weapons: ["sim", "handcrossbow", "scimitar", "shortsword"], tools: [] },
  paladin: { saves: ["wis", "cha"], armor: ["lgt", "med", "hvy", "shl"], weapons: ["sim", "mar"], tools: [] },
  ranger: { saves: ["str", "dex"], armor: ["lgt", "med", "shl"], weapons: ["sim", "mar"], tools: [] },
  // 2024 Rogue: Simple weapons and martial weapons with Finesse or Light.
  rogue: { saves: ["dex", "int"], armor: ["lgt"], weapons: ["sim", "handcrossbow", "rapier", "scimitar", "shortsword", "whip"], tools: ["Thieves' Tools"] },
  sorcerer: { saves: ["con", "cha"], armor: [], weapons: ["sim"], tools: [] },
  warlock: { saves: ["wis", "cha"], armor: ["lgt"], weapons: ["sim"], tools: [] },
  wizard: { saves: ["int", "wis"], armor: [], weapons: ["sim"], tools: [] }
};

export const CLASS_HIT_DIE_2024 = {
  artificer: 8,
  barbarian: 12,
  fighter: 10,
  paladin: 10,
  ranger: 10,
  bard: 8,
  cleric: 8,
  druid: 8,
  monk: 8,
  rogue: 8,
  warlock: 8,
  sorcerer: 6,
  wizard: 6
};

// Names only. The actual item data/descriptions are loaded from the user's installed dnd5e compendiums.
export const CLASS_LEVEL1_FEATURES_2024 = {
  artificer: ["Magical Tinkering", "Spellcasting"],
  barbarian: ["Rage", "Unarmored Defense", "Weapon Mastery"],
  bard: ["Bardic Inspiration", "Spellcasting"],
  cleric: ["Spellcasting", "Divine Order"],
  druid: ["Druidic", "Primal Order", "Spellcasting"],
  fighter: ["Second Wind", "Weapon Mastery"],
  monk: ["Martial Arts", "Unarmored Defense"],
  paladin: ["Lay on Hands", "Spellcasting", "Weapon Mastery"],
  ranger: ["Favored Enemy", "Spellcasting", "Weapon Mastery"],
  rogue: ["Expertise", "Sneak Attack", "Thieves' Cant", "Weapon Mastery"],
  sorcerer: ["Innate Sorcery", "Spellcasting"],
  warlock: ["Eldritch Invocations", "Pact Magic"],
  wizard: ["Spellcasting", "Arcane Recovery"]
};

// Names only. The actual feature documents are loaded from the user's installed compendiums when possible.
// Fallback visible feature items are created only when the module cannot find a sourcebook feature item.
export const SPECIES_LEVEL1_FEATURES_2024 = {
  aasimar: ["Celestial Resistance", "Darkvision", "Healing Hands", "Light Bearer"],
  dragonborn: ["Breath Weapon", "Damage Resistance", "Darkvision"],
  dwarf: ["Darkvision", "Dwarven Resilience", "Dwarven Toughness", "Stonecunning"],
  elf: ["Darkvision", "Fey Ancestry", "Keen Senses", "Trance"],
  gnome: ["Darkvision", "Gnomish Cunning"],
  goliath: ["Giant Ancestry", "Large Form", "Powerful Build"],
  halfling: ["Brave", "Halfling Nimbleness", "Luck", "Naturally Stealthy"],
  human: ["Resourceful", "Skillful", "Versatile"],
  orc: ["Adrenaline Rush", "Darkvision", "Relentless Endurance"],
  tiefling: ["Darkvision", "Fiendish Legacy", "Otherworldly Presence"]
};

export const SPECIES_FEATURE_FALLBACKS_2024 = {
  aasimar: {
    "celestial-resistance": "You have resistance to Necrotic and Radiant damage.",
    "darkvision": "You have Darkvision.",
    "healing-hands": "As a Magic action, you can touch a creature and restore a number of Hit Points to it. Check the species entry for the exact level-based amount.",
    "light-bearer": "You know the Light cantrip."
  },
  dragonborn: {
    "breath-weapon": "When you take the Attack action, you can replace one attack with an exhalation of magical energy. The damage type is determined by your Draconic Ancestry.",
    "damage-resistance": "You have resistance to the damage type determined by your Draconic Ancestry.",
    "darkvision": "You have Darkvision."
  },
  dwarf: {
    "darkvision": "You have Darkvision.",
    "dwarven-resilience": "You have resistance to Poison damage and advantage on saving throws you make to avoid or end the Poisoned condition.",
    "dwarven-toughness": "Your Hit Point maximum increases by 1, and it increases by 1 again whenever you gain a level.",
    "stonecunning": "As a Bonus Action, you gain Tremorsense for a short time while on a stone surface. Check the species entry for the exact range and uses."
  },
  elf: {
    "darkvision": "You have Darkvision.",
    "fey-ancestry": "You have advantage on saving throws you make to avoid or end the Charmed condition.",
    "keen-senses": "You have proficiency in the Insight, Perception, or Survival skill, depending on your lineage/source item.",
    "trance": "You don't need to sleep, and magic can't put you to sleep."
  },
  gnome: {
    "darkvision": "You have Darkvision.",
    "gnomish-cunning": "You have advantage on Intelligence, Wisdom, and Charisma saving throws."
  },
  goliath: {
    "giant-ancestry": "Your Giant Ancestry gives you a special level-1 benefit chosen in this builder.",
    "large-form": "You can temporarily become Large. Check the species entry for the exact duration and uses.",
    "powerful-build": "You have advantage on saving throws to end the Grappled condition and count as one size larger when determining carrying capacity."
  },
  halfling: {
    "brave": "You have advantage on saving throws you make to avoid or end the Frightened condition.",
    "halfling-nimbleness": "You can move through the space of a creature that is a size larger than you, but you can't stop there.",
    "luck": "When you roll a 1 on a d20 for a D20 Test, you can reroll the die and must use the new roll.",
    "naturally-stealthy": "You can take the Hide action even when you are obscured only by a creature that is at least one size larger than you."
  },
  human: {
    "resourceful": "You gain Heroic Inspiration whenever you finish a Long Rest.",
    "skillful": "You gain proficiency in one skill of your choice. This builder applies the selected Human skill proficiency.",
    "versatile": "You gain an Origin feat of your choice. This builder applies the selected Human Origin feat."
  },
  orc: {
    "adrenaline-rush": "You can take the Dash action as a Bonus Action and gain Temporary Hit Points when you do so. Check the species entry for uses.",
    "darkvision": "You have Darkvision.",
    "relentless-endurance": "When you are reduced to 0 Hit Points but not killed outright, you can drop to 1 Hit Point instead."
  },
  tiefling: {
    "darkvision": "You have Darkvision.",
    "fiendish-legacy": "Your fiendish legacy gives resistance and later spells. This builder applies the selected legacy resistance.",
    "otherworldly-presence": "You know the Thaumaturgy cantrip."
  }
};

export const CLASS_STARTING_EQUIPMENT_2024 = {
  barbarian: [
    { id: "barbarian-armor", label: "Armor", count: 1, options: [["hide armor"], ["75 gp"]] },
    { id: "barbarian-primary", label: "Primary Weapon", count: 1, options: [["greataxe"], ["greatsword"], ["maul"]] },
    { id: "barbarian-weapons", label: "Additional Weapons", count: 1, options: [["handaxe", "handaxe"], ["javelin", "javelin", "javelin", "javelin"]] },
    { id: "barbarian-pack", label: "Pack", count: 1, options: [["explorer's pack"], ["dungeoneer's pack"]] }
  ],
  bard: [
    { id: "bard-armor", label: "Armor", count: 1, options: [["leather armor"], ["75 gp"]] },
    { id: "bard-weapon", label: "Weapon", count: 1, options: [["dagger"], ["shortsword"], ["rapier"]] },
    { id: "bard-instrument", label: "Instrument", count: 1, options: [["lute"], ["musical instrument"]] },
    { id: "bard-pack", label: "Pack", count: 1, options: [["entertainer's pack"], ["diplomat's pack"]] }
  ],
  cleric: [
    { id: "cleric-armor", label: "Armor", count: 1, options: [["chain shirt"], ["leather armor"], ["110 gp"]] },
    { id: "cleric-weapon", label: "Weapon", count: 1, options: [["mace"], ["spear"], ["quarterstaff"]] },
    { id: "cleric-holy", label: "Holy Symbol", count: 1, options: [["holy symbol"], ["amulet"], ["emblem"]] },
    { id: "cleric-pack", label: "Pack", count: 1, options: [["priest's pack"], ["explorer's pack"]] }
  ],
  druid: [
    { id: "druid-armor", label: "Armor", count: 1, options: [["leather armor"], ["50 gp"]] },
    { id: "druid-shield", label: "Shield", count: 1, options: [["shield"], ["quarterstaff"]] },
    { id: "druid-focus", label: "Druidic Focus", count: 1, options: [["druidic focus"], ["sprig of mistletoe"], ["wooden staff"]] },
    { id: "druid-pack", label: "Pack", count: 1, options: [["explorer's pack"]] }
  ],
  fighter: [
    { id: "fighter-armor", label: "Armor", count: 1, options: [["chain mail"], ["leather armor", "longbow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow"]] },
    { id: "fighter-primary", label: "Primary Weapons", count: 1, options: [["longsword", "shield"], ["greatsword"], ["battleaxe", "shield"], ["rapier", "shield"]] },
    { id: "fighter-secondary", label: "Secondary Weapon", count: 1, options: [["light crossbow", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt"], ["handaxe", "handaxe"]] },
    { id: "fighter-pack", label: "Pack", count: 1, options: [["dungeoneer's pack"], ["explorer's pack"]] }
  ],
  monk: [
    { id: "monk-weapon", label: "Weapon", count: 1, options: [["spear"], ["quarterstaff"], ["shortsword"]] },
    { id: "monk-tool", label: "Tool or Instrument", count: 1, options: [["artisan's tools"], ["musical instrument"]] },
    { id: "monk-pack", label: "Pack", count: 1, options: [["explorer's pack"], ["dungeoneer's pack"]] }
  ],
  paladin: [
    { id: "paladin-armor", label: "Armor", count: 1, options: [["chain mail"], ["150 gp"]] },
    { id: "paladin-primary", label: "Primary Weapons", count: 1, options: [["longsword", "shield"], ["greatsword"], ["warhammer", "shield"]] },
    { id: "paladin-secondary", label: "Secondary Weapon", count: 1, options: [["javelin", "javelin", "javelin", "javelin", "javelin"], ["spear"]] },
    { id: "paladin-holy", label: "Holy Symbol", count: 1, options: [["holy symbol"], ["emblem"]] },
    { id: "paladin-pack", label: "Pack", count: 1, options: [["priest's pack"], ["explorer's pack"]] }
  ],
  ranger: [
    { id: "ranger-armor", label: "Armor", count: 1, options: [["leather armor"], ["scale mail"], ["150 gp"]] },
    { id: "ranger-weapons", label: "Weapons", count: 1, options: [["shortsword", "shortsword"], ["scimitar", "scimitar"], ["longsword", "shield"]] },
    { id: "ranger-ranged", label: "Ranged Weapon", count: 1, options: [["longbow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow"], ["light crossbow", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt"]] },
    { id: "ranger-pack", label: "Pack", count: 1, options: [["explorer's pack"], ["dungeoneer's pack"]] }
  ],
  rogue: [
    { id: "rogue-armor", label: "Armor", count: 1, options: [["leather armor"], ["100 gp"]] },
    { id: "rogue-weapon", label: "Weapon", count: 1, options: [["rapier"], ["shortsword"]] },
    { id: "rogue-ranged", label: "Ranged Weapon", count: 1, options: [["shortbow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow"], ["shortsword"]] },
    { id: "rogue-tools", label: "Tools", count: 1, options: [["thieves' tools"]] },
    { id: "rogue-pack", label: "Pack", count: 1, options: [["burglar's pack"], ["dungeoneer's pack"], ["explorer's pack"]] }
  ],
  sorcerer: [
    { id: "sorcerer-weapon", label: "Weapon", count: 1, options: [["dagger", "dagger"], ["quarterstaff"]] },
    { id: "sorcerer-focus", label: "Arcane Focus", count: 1, options: [["arcane focus"], ["component pouch"]] },
    { id: "sorcerer-pack", label: "Pack", count: 1, options: [["dungeoneer's pack"], ["explorer's pack"]] }
  ],
  warlock: [
    { id: "warlock-armor", label: "Armor", count: 1, options: [["leather armor"], ["100 gp"]] },
    { id: "warlock-weapon", label: "Weapon", count: 1, options: [["simple weapon"], ["dagger", "dagger"]] },
    { id: "warlock-focus", label: "Arcane Focus", count: 1, options: [["arcane focus"], ["component pouch"]] },
    { id: "warlock-pack", label: "Pack", count: 1, options: [["scholar's pack"], ["dungeoneer's pack"]] }
  ],
  wizard: [
    { id: "wizard-weapon", label: "Weapon", count: 1, options: [["quarterstaff"], ["dagger"]] },
    { id: "wizard-focus", label: "Arcane Focus", count: 1, options: [["arcane focus"], ["component pouch"]] },
    { id: "wizard-book", label: "Spellbook", count: 1, options: [["spellbook"]] },
    { id: "wizard-pack", label: "Pack", count: 1, options: [["scholar's pack"], ["explorer's pack"]] }
  ]
};

export const BACKGROUND_STARTING_EQUIPMENT_2024 = {
  acolyte: [["holy symbol", "prayer book", "robe"]],
  artisan: [["artisan's tools", "traveler's clothes", "pouch"]],
  charlatan: [["fine clothes", "disguise kit", "pouch"]],
  criminal: [["crowbar", "dark common clothes", "pouch"]],
  entertainer: [["musical instrument", "costume", "mirror", "perfume", "traveler's clothes"]],
  farmer: [["sickle", "healer's kit", "common clothes"]],
  guard: [["spear", "light crossbow", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt"]],
  guide: [["shortbow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "cartographer's tools"]],
  hermit: [["quarterstaff", "herbalism kit", "common clothes"]],
  merchant: [["artisan's tools", "traveler's clothes", "pouch"]],
  noble: [["fine clothes", "signet ring", "perfume"]],
  sage: [["quarterstaff", "calligrapher's supplies", "book", "pouch"]],
  sailor: [["dagger", "navigator's tools", "rope", "traveler's clothes"]],
  scribe: [["calligrapher's supplies", "fine clothes", "lamp"]],
  soldier: [["spear", "shortbow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "gaming set"]],
  wayfarer: [["dagger", "thieves' tools", "bedroll", "common clothes"]]
};



// Class starting equipment is presented as full packages, not piecemeal choices.
// The item names are resolved against the user's enabled sourcebook compendiums.
export const CLASS_STARTING_EQUIPMENT_PACKAGES_2024 = {
  artificer: [
    { id: "a", label: "Studded Leather Armor, Thieves' Tools, Light Crossbow, 20× Bolts, Dungeoneer's Pack, 8 gp", items: ["studded leather armor", "thieves' tools", "light crossbow", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "dungeoneer's pack", "8 gp"] },
    { id: "b", label: "Scale Mail, Thieves' Tools, 2× Dagger, Explorer's Pack, 8 gp", items: ["scale mail", "thieves' tools", "dagger", "dagger", "explorer's pack", "8 gp"] },
    { id: "c", label: "110 gp", items: ["110 gp"] }
  ],
  barbarian: [
    { id: "a", label: "Greataxe, 4× Handaxe, Explorer's Pack, 15 gp", items: ["greataxe", "handaxe", "handaxe", "handaxe", "handaxe", "explorer's pack", "15 gp"] },
    { id: "b", label: "Greatsword, 4× Javelin, Dungeoneer's Pack, 15 gp", items: ["greatsword", "javelin", "javelin", "javelin", "javelin", "dungeoneer's pack", "15 gp"] },
    { id: "c", label: "75 gp", items: ["75 gp"] }
  ],
  bard: [
    { id: "a", label: "Leather Armor, Dagger, Lute, Entertainer's Pack, 19 gp", items: ["leather armor", "dagger", "lute", "entertainer's pack", "19 gp"] },
    { id: "b", label: "Leather Armor, Shortsword, Musical Instrument, Diplomat's Pack, 11 gp", items: ["leather armor", "shortsword", "lute", "diplomat's pack", "11 gp"] },
    { id: "c", label: "90 gp", items: ["90 gp"] }
  ],
  cleric: [
    { id: "a", label: "Chain Shirt, Mace, Holy Symbol, Priest's Pack, 7 gp", items: ["chain shirt", "mace", "amulet", "priest's pack", "7 gp"] },
    { id: "b", label: "Leather Armor, Quarterstaff, Holy Symbol, Explorer's Pack, 8 gp", items: ["leather armor", "quarterstaff", "amulet", "explorer's pack", "8 gp"] },
    { id: "c", label: "110 gp", items: ["110 gp"] }
  ],
  druid: [
    { id: "a", label: "Leather Armor, Shield, Sickle, Druidic Focus, Explorer's Pack, 9 gp", items: ["leather armor", "shield", "sickle", "sprig of mistletoe", "explorer's pack", "9 gp"] },
    { id: "b", label: "Leather Armor, Quarterstaff, Druidic Focus, Explorer's Pack, 9 gp", items: ["leather armor", "quarterstaff", "sprig of mistletoe", "explorer's pack", "9 gp"] },
    { id: "c", label: "50 gp", items: ["50 gp"] }
  ],
  fighter: [
    { id: "a", label: "Chain Mail, Greatsword, Flail, 8× Javelin, Dungeoneer's Pack, 4 gp", items: ["chain mail", "greatsword", "flail", "javelin", "javelin", "javelin", "javelin", "javelin", "javelin", "javelin", "javelin", "dungeoneer's pack", "4 gp"] },
    { id: "b", label: "Studded Leather Armor, Scimitar, Shortsword, Longbow, 20× Arrows, Quiver, Dungeoneer's Pack, 11 gp", items: ["studded leather armor", "scimitar", "shortsword", "longbow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "quiver", "dungeoneer's pack", "11 gp"] },
    { id: "c", label: "155 gp", items: ["155 gp"] }
  ],
  monk: [
    { id: "a", label: "Spear, Dagger, Artisan's Tools, Explorer's Pack, 11 gp", items: ["spear", "dagger", "artisan's tools", "explorer's pack", "11 gp"] },
    { id: "b", label: "Quarterstaff, Musical Instrument, Dungeoneer's Pack, 11 gp", items: ["quarterstaff", "lute", "dungeoneer's pack", "11 gp"] },
    { id: "c", label: "50 gp", items: ["50 gp"] }
  ],
  paladin: [
    { id: "a", label: "Chain Mail, Longsword, Shield, 5× Javelin, Holy Symbol, Priest's Pack, 9 gp", items: ["chain mail", "longsword", "shield", "javelin", "javelin", "javelin", "javelin", "javelin", "amulet", "priest's pack", "9 gp"] },
    { id: "b", label: "Chain Mail, Greatsword, Spear, Holy Symbol, Explorer's Pack, 9 gp", items: ["chain mail", "greatsword", "spear", "amulet", "explorer's pack", "9 gp"] },
    { id: "c", label: "150 gp", items: ["150 gp"] }
  ],
  ranger: [
    { id: "a", label: "Leather Armor, Shortsword, Scimitar, Longbow, 20× Arrows, Quiver, Explorer's Pack, 7 gp", items: ["leather armor", "shortsword", "scimitar", "longbow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "quiver", "explorer's pack", "7 gp"] },
    { id: "b", label: "Scale Mail, Longsword, Shield, Light Crossbow, 20× Bolts, Dungeoneer's Pack, 7 gp", items: ["scale mail", "longsword", "shield", "light crossbow", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "crossbow bolt", "dungeoneer's pack", "7 gp"] },
    { id: "c", label: "150 gp", items: ["150 gp"] }
  ],
  rogue: [
    { id: "a", label: "Leather Armor, Rapier, Shortbow, 20× Arrows, Quiver, Thieves' Tools, Burglar's Pack, 8 gp", items: ["leather armor", "rapier", "shortbow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "arrow", "quiver", "thieves' tools", "burglar's pack", "8 gp"] },
    { id: "b", label: "Leather Armor, Shortsword, Shortsword, Thieves' Tools, Dungeoneer's Pack, 8 gp", items: ["leather armor", "shortsword", "shortsword", "thieves' tools", "dungeoneer's pack", "8 gp"] },
    { id: "c", label: "100 gp", items: ["100 gp"] }
  ],
  sorcerer: [
    { id: "a", label: "2× Dagger, Arcane Focus, Dungeoneer's Pack, 28 gp", items: ["dagger", "dagger", "wand", "dungeoneer's pack", "28 gp"] },
    { id: "b", label: "Quarterstaff, Component Pouch, Explorer's Pack, 28 gp", items: ["quarterstaff", "component pouch", "explorer's pack", "28 gp"] },
    { id: "c", label: "50 gp", items: ["50 gp"] }
  ],
  warlock: [
    { id: "a", label: "Leather Armor, Sickle, 2× Dagger, Arcane Focus, Scholar's Pack, 15 gp", items: ["leather armor", "sickle", "dagger", "dagger", "wand", "scholar's pack", "15 gp"] },
    { id: "b", label: "Leather Armor, Quarterstaff, Dagger, Component Pouch, Dungeoneer's Pack, 15 gp", items: ["leather armor", "quarterstaff", "dagger", "component pouch", "dungeoneer's pack", "15 gp"] },
    { id: "c", label: "100 gp", items: ["100 gp"] }
  ],
  wizard: [
    { id: "a", label: "Quarterstaff, Arcane Focus, Spellbook, Scholar's Pack, 5 gp", items: ["quarterstaff", "wand", "spellbook", "scholar's pack", "5 gp"] },
    { id: "b", label: "Dagger, Component Pouch, Spellbook, Explorer's Pack, 5 gp", items: ["dagger", "component pouch", "spellbook", "explorer's pack", "5 gp"] },
    { id: "c", label: "55 gp", items: ["55 gp"] }
  ]
};

// Conservative level 1 spell-name fallback for 2024 classes that learn level 1 spells
// through this builder. This is used only when the installed compendium item data does
// not expose class-list membership in a machine-readable field. It stores spell names
// only, not spell rules text.
export const CLASS_LEVEL1_SPELLS_2024 = {
  artificer: new Set([
    "absorb-elements", "alarm", "catapult", "cure-wounds", "detect-magic",
    "disguise-self", "expeditious-retreat", "faerie-fire", "false-life",
    "feather-fall", "grease", "identify", "jump", "longstrider",
    "purify-food-and-drink", "sanctuary", "snare", "tashas-caustic-brew"
  ]),
  bard: new Set([
    "animal-friendship", "bane", "charm-person", "color-spray", "command",
    "comprehend-languages", "cure-wounds", "detect-magic", "disguise-self",
    "dissonant-whispers", "faerie-fire", "feather-fall", "healing-word",
    "heroism", "identify", "illusory-script", "longstrider", "silent-image",
    "sleep", "speak-with-animals", "tashas-hideous-laughter", "thunderwave",
    "unseen-servant"
  ]),
  cleric: new Set([
    "bane", "bless", "command", "create-or-destroy-water", "cure-wounds",
    "detect-evil-and-good", "detect-magic", "detect-poison-and-disease",
    "guiding-bolt", "healing-word", "inflict-wounds", "protection-from-evil-and-good",
    "purify-food-and-drink", "shield-of-faith"
  ]),
  druid: new Set([
    "animal-friendship", "charm-person", "create-or-destroy-water", "cure-wounds",
    "detect-magic", "detect-poison-and-disease", "entangle", "faerie-fire",
    "fog-cloud", "goodberry", "healing-word", "ice-knife", "jump", "longstrider",
    "protection-from-evil-and-good", "purify-food-and-drink", "speak-with-animals",
    "thunderwave"
  ]),
  paladin: new Set([
    "bless", "command", "cure-wounds", "detect-evil-and-good", "detect-magic",
    "detect-poison-and-disease", "divine-favor", "divine-smite", "heroism",
    "protection-from-evil-and-good", "purify-food-and-drink", "searing-smite",
    "shield-of-faith", "thunderous-smite", "wrathful-smite"
  ]),
  ranger: new Set([
    "alarm", "animal-friendship", "cure-wounds", "detect-magic", "detect-poison-and-disease",
    "ensnaring-strike", "entangle", "fog-cloud", "goodberry", "hail-of-thorns",
    "hunters-mark", "jump", "longstrider", "speak-with-animals"
  ]),
  sorcerer: new Set([
    "burning-hands", "charm-person", "chromatic-orb", "color-spray",
    "comprehend-languages", "detect-magic", "disguise-self", "expeditious-retreat",
    "false-life", "feather-fall", "fog-cloud", "grease", "ice-knife", "jump", "mage-armor",
    "magic-missile", "ray-of-sickness", "shield", "silent-image", "sleep",
    "thunderwave", "witch-bolt"
  ]),
  warlock: new Set([
    "armor-of-agathys", "arms-of-hadar", "bane", "charm-person", "comprehend-languages",
    "detect-magic", "expeditious-retreat", "hellish-rebuke", "hex", "illusory-script",
    "protection-from-evil-and-good", "speak-with-animals", "tashas-hideous-laughter",
    "unseen-servant", "witch-bolt"
  ]),
  wizard: new Set([
    "alarm", "burning-hands", "charm-person", "chromatic-orb", "color-spray",
    "comprehend-languages", "detect-magic", "disguise-self", "expeditious-retreat",
    "false-life", "feather-fall", "find-familiar", "fog-cloud", "grease", "ice-knife",
    "identify", "illusory-script", "jump", "longstrider", "mage-armor", "magic-missile",
    "protection-from-evil-and-good", "ray-of-sickness", "shield", "silent-image", "sleep",
    "tashas-hideous-laughter", "tensers-floating-disk", "thunderwave", "unseen-servant",
    "witch-bolt"
  ])
};


export const CLASS_CANTRIPS_2024 = {
  artificer: new Set([
    "acid-splash", "booming-blade", "create-bonfire", "dancing-lights",
    "fire-bolt", "frostbite", "guidance", "light", "lightning-lure",
    "mage-hand", "magic-stone", "mending", "message", "poison-spray",
    "prestidigitation", "ray-of-frost", "resistance", "shocking-grasp",
    "spare-the-dying", "sword-burst", "thorn-whip", "thunderclap", "true-strike"
  ]),
  bard: new Set([
    "dancing-lights", "friends", "light", "mage-hand", "mending", "message",
    "minor-illusion", "prestidigitation", "starry-wisp", "true-strike", "vicious-mockery"
  ]),
  cleric: new Set([
    "guidance", "light", "mending", "resistance", "sacred-flame",
    "spare-the-dying", "thaumaturgy", "toll-the-dead", "word-of-radiance"
  ]),
  druid: new Set([
    "druidcraft", "elementalism", "guidance", "mending", "message", "poison-spray",
    "produce-flame", "resistance", "shillelagh", "spare-the-dying", "starry-wisp", "thorn-whip"
  ]),
  sorcerer: new Set([
    "acid-splash", "blade-ward", "chill-touch", "dancing-lights", "elementalism",
    "fire-bolt", "friends", "light", "mage-hand", "mending", "message",
    "minor-illusion", "poison-spray", "prestidigitation", "ray-of-frost",
    "shocking-grasp", "sorcerous-burst", "true-strike"
  ]),
  warlock: new Set([
    "blade-ward", "chill-touch", "eldritch-blast", "friends", "mage-hand",
    "minor-illusion", "poison-spray", "prestidigitation", "true-strike"
  ]),
  wizard: new Set([
    "acid-splash", "blade-ward", "chill-touch", "dancing-lights", "elementalism",
    "fire-bolt", "friends", "light", "mage-hand", "mending", "message",
    "minor-illusion", "poison-spray", "prestidigitation", "ray-of-frost",
    "shocking-grasp", "true-strike"
  ])
};

export const BACKGROUND_SKILLS_2024 = {
  acolyte: ["ins", "rel"],
  artisan: ["inv", "per"],
  charlatan: ["dec", "slt"],
  criminal: ["slt", "ste"],
  entertainer: ["acr", "prf"],
  farmer: ["ani", "nat"],
  guard: ["ath", "prc"],
  guide: ["ste", "sur"],
  hermit: ["med", "rel"],
  merchant: ["ani", "per"],
  noble: ["his", "per"],
  sage: ["arc", "his"],
  sailor: ["acr", "prc"],
  scribe: ["inv", "prc"],
  soldier: ["ath", "itm"],
  wayfarer: ["ins", "ste"]
};

export const BACKGROUND_ABILITIES_2024 = {
  acolyte: ["int", "wis", "cha"],
  artisan: ["str", "dex", "int"],
  charlatan: ["dex", "con", "cha"],
  criminal: ["dex", "con", "int"],
  entertainer: ["str", "dex", "cha"],
  farmer: ["str", "con", "wis"],
  guard: ["str", "int", "wis"],
  guide: ["dex", "con", "wis"],
  hermit: ["con", "wis", "cha"],
  merchant: ["con", "int", "cha"],
  noble: ["str", "int", "cha"],
  sage: ["con", "int", "wis"],
  sailor: ["str", "dex", "wis"],
  scribe: ["dex", "int", "wis"],
  soldier: ["str", "dex", "con"],
  wayfarer: ["dex", "wis", "cha"]
};

export const ORIGIN_FEAT_NAMES_2024 = [
  "Alert",
  "Crafter",
  "Healer",
  "Lucky",
  // Foundry/dnd5e sourcebooks may model Magic Initiate as either one
  // configurable feat or as three explicit variants. Accept all forms and
  // let the item's own advancement data handle the spell-list choice.
  "Magic Initiate",
  "Magic Initiate (Cleric)",
  "Magic Initiate (Druid)",
  "Magic Initiate (Wizard)",
  "Musician",
  "Savage Attacker",
  "Skilled",
  "Tavern Brawler",
  "Tough"
];

export const ORIGIN_FEAT_ALIASES_2024 = new Map([
  ["magic-initiate-cleric", "magic-initiate-cleric"],
  ["magic-initiate-druid", "magic-initiate-druid"],
  ["magic-initiate-wizard", "magic-initiate-wizard"],
  ["magic-initiate-cleric-2024", "magic-initiate-cleric"],
  ["magic-initiate-druid-2024", "magic-initiate-druid"],
  ["magic-initiate-wizard-2024", "magic-initiate-wizard"],
  ["magic-initiate-cleric-spellcasting", "magic-initiate-cleric"],
  ["magic-initiate-druid-spellcasting", "magic-initiate-druid"],
  ["magic-initiate-wizard-spellcasting", "magic-initiate-wizard"]
]);

export const BACKGROUND_ORIGIN_FEATS_2024 = {
  acolyte: "Magic Initiate (Cleric)",
  artisan: "Crafter",
  charlatan: "Skilled",
  criminal: "Alert",
  entertainer: "Musician",
  farmer: "Tough",
  guard: "Alert",
  guide: "Magic Initiate (Druid)",
  hermit: "Healer",
  merchant: "Lucky",
  noble: "Skilled",
  sage: "Magic Initiate (Wizard)",
  sailor: "Tavern Brawler",
  scribe: "Skilled",
  soldier: "Savage Attacker",
  wayfarer: "Lucky"
};

export const MAGIC_INITIATE_SOURCES_2024 = {
  cleric: { key: "cleric", label: "Cleric", featSlugs: ["magic-initiate-cleric"] },
  druid: { key: "druid", label: "Druid", featSlugs: ["magic-initiate-druid"] },
  wizard: { key: "wizard", label: "Wizard", featSlugs: ["magic-initiate-wizard", "magic-initiate"] }
};


export const BACKGROUND_TOOLS_2024 = {
  acolyte: ["Calligrapher's Supplies"],
  artisan: [],
  charlatan: ["Forgery Kit"],
  criminal: ["Thieves' Tools"],
  entertainer: [],
  farmer: ["Carpenter's Tools"],
  guard: [],
  guide: ["Cartographer's Tools"],
  hermit: ["Herbalism Kit"],
  merchant: ["Navigator's Tools"],
  noble: [],
  sage: ["Calligrapher's Supplies"],
  sailor: ["Navigator's Tools"],
  scribe: ["Calligrapher's Supplies"],
  soldier: [],
  wayfarer: ["Thieves' Tools"]
};

export const TOOL_KEY_ALIASES_2024 = {
  "alchemist's supplies": ["alchemist", "alch"],
  "brewer's supplies": ["brewer", "brew"],
  "calligrapher's supplies": ["calligrapher", "callig", "call"],
  "carpenter's tools": ["carpenter", "carp"],
  "cartographer's tools": ["cartographer", "cart", "cartography"],
  "cobbler's tools": ["cobbler", "cobb"],
  "cook's utensils": ["cook", "cooks"],
  "glassblower's tools": ["glassblower", "glass"],
  "jeweler's tools": ["jeweler", "jewel", "jewellers", "jewelers"],
  "leatherworker's tools": ["leatherworker", "leather", "leatherwork"],
  "mason's tools": ["mason", "masn"],
  "painter's supplies": ["painter", "paint"],
  "potter's tools": ["potter", "pott"],
  "smith's tools": ["smith", "smiths", "smth"],
  "tinker's tools": ["tinker", "tink", "tinkers"],
  "weaver's tools": ["weaver", "weav"],
  "woodcarver's tools": ["woodcarver", "woodcarving", "wood"],
  "disguise kit": ["disguise", "disg"],
  "forgery kit": ["forgery", "forg"],
  "herbalism kit": ["herbalism", "herb"],
  "poisoner's kit": ["poisoner", "poison", "pois"],
  "navigator's tools": ["navigator", "navigation", "navg", "nav"],
  "thieves' tools": ["thief", "thieves", "thievestools"],
  "gaming set": ["game", "gaming"],
  "musical instrument": ["music", "musical", "instrument"]
};

// v1.20.3: the tool pool offered by the Skilled origin feat ("proficiency in
// any combination of three skills or tools of your choice"). Keys match
// TOOL_KEY_ALIASES_2024 above exactly so _candidateToolKeys() can resolve each
// choice onto the actor's actual system.tools.* proficiency fields.
export const SKILLED_TOOL_OPTIONS_2024 = [
  { key: "alchemist's supplies", label: "Alchemist's Supplies" },
  { key: "brewer's supplies", label: "Brewer's Supplies" },
  { key: "calligrapher's supplies", label: "Calligrapher's Supplies" },
  { key: "carpenter's tools", label: "Carpenter's Tools" },
  { key: "cartographer's tools", label: "Cartographer's Tools" },
  { key: "cobbler's tools", label: "Cobbler's Tools" },
  { key: "cook's utensils", label: "Cook's Utensils" },
  { key: "glassblower's tools", label: "Glassblower's Tools" },
  { key: "jeweler's tools", label: "Jeweler's Tools" },
  { key: "leatherworker's tools", label: "Leatherworker's Tools" },
  { key: "mason's tools", label: "Mason's Tools" },
  { key: "painter's supplies", label: "Painter's Supplies" },
  { key: "potter's tools", label: "Potter's Tools" },
  { key: "smith's tools", label: "Smith's Tools" },
  { key: "tinker's tools", label: "Tinker's Tools" },
  { key: "weaver's tools", label: "Weaver's Tools" },
  { key: "woodcarver's tools", label: "Woodcarver's Tools" },
  { key: "disguise kit", label: "Disguise Kit" },
  { key: "forgery kit", label: "Forgery Kit" },
  { key: "herbalism kit", label: "Herbalism Kit" },
  { key: "poisoner's kit", label: "Poisoner's Kit" },
  { key: "navigator's tools", label: "Navigator's Tools" },
  { key: "thieves' tools", label: "Thieves' Tools" },
  { key: "gaming set", label: "Gaming Set" },
  { key: "musical instrument", label: "Musical Instrument" }
];

export const SKILL_LABELS = {
  acr: "Acrobatics", ani: "Animal Handling", arc: "Arcana", ath: "Athletics", dec: "Deception",
  his: "History", ins: "Insight", itm: "Intimidation", inv: "Investigation", med: "Medicine",
  nat: "Nature", prc: "Perception", per: "Persuasion", prf: "Performance", rel: "Religion", slt: "Sleight of Hand",
  ste: "Stealth", sur: "Survival"
};


export const DEFAULT_LANGUAGE_CHOICE_COUNT = 2;
export const DEFAULT_BASE_LANGUAGE = "common";

export const FALLBACK_LANGUAGE_LABELS = {
  dwarvish: "Dwarvish",
  elvish: "Elvish",
  giant: "Giant",
  gnomish: "Gnomish",
  goblin: "Goblin",
  halfling: "Halfling",
  orc: "Orc",
  abyssal: "Abyssal",
  celestial: "Celestial",
  draconic: "Draconic",
  deep: "Deep Speech",
  infernal: "Infernal",
  primordial: "Primordial",
  sylvan: "Sylvan",
  undercommon: "Undercommon"
};
