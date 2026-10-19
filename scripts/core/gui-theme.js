import { MODULE_ID, GUI_THEMES } from "../data/constants.js";

export function getGuiTheme() {
  const theme = game.settings?.get?.(MODULE_ID, "guiTheme") ?? "parchment";
  return Object.hasOwn(GUI_THEMES, theme) ? theme : "parchment";
}

/**
 * Applies the currently-selected GUI theme directly to an Application's
 * window frame element (the `.app`/`.window-app` root), in addition to the
 * `themeClass`/`themeInlineStyle` values used inside each template.
 *
 * This exists because Foundry v13/dnd5e can override nested form
 * backgrounds, and CSS `:has()` selectors do not reliably reach through the
 * app shell in every case. Stamping an `l12024b-window-theme-<key>` class
 * (and a matching `data-l12024b-theme` attribute) directly on the window
 * gives builder.css a selector that always wins.
 *
 * Every window this module opens should call this from its own `_render`
 * override, right after `await super._render(force, options)`, so all of the
 * module's dialogs share exactly the same GUI style:
 *
 *   async _render(force, options) {
 *     await super._render(force, options);
 *     applyThemeToWindow(this);
 *   }
 *
 * @param {Application} app  The Application instance being rendered.
 */
export function applyThemeToWindow(app) {
  const windowElement = app?.element?.[0] ?? app?.element;
  if (!windowElement?.classList) return;

  const theme = getGuiTheme();
  const themeClasses = Object.keys(GUI_THEMES).map(key => `l12024b-window-theme-${key}`);
  windowElement.classList.remove(...themeClasses);
  windowElement.classList.add(`l12024b-window-theme-${theme}`);
  windowElement.dataset.l12024bTheme = theme;

  const content = windowElement.querySelector?.(".window-content");
  if (content) content.dataset.l12024bTheme = theme;
}

/**
 * Marker class stamped on every ad-hoc Dialog this module opens (weapon
 * mastery picker, ability score swap prompts, "Confirm Species/Background/
 * Class" prompts, etc.) so the global renderDialog hook below knows which
 * Dialog windows belong to this module and should be themed, without ever
 * touching dialogs opened by the core system or other modules.
 */
const DIALOG_MARKER_CLASS = "l12024b-themed-dialog";

/**
 * Wraps a Dialog's `content` HTML in the same themed root element every
 * other window in this module already uses (`<form class="l12024b
 * l12024b-theme-<theme>">` with the CSS-variable inline style). This is what
 * actually colors the dialog's text, background, buttons, and inputs -
 * builder.css's theme rules key off exactly this class pair, and the inline
 * style carries variable values for every theme, not just the handful that
 * also have hardcoded window-content fallback rules.
 *
 * @param {string} innerHtml  The dialog's normal content markup.
 */
export function themedDialogHtml(innerHtml) {
  const theme = getGuiTheme();
  return `<div class="l12024b l12024b-theme-${theme}" style="${getThemeInlineStyle(theme)}">${innerHtml ?? ""}</div>`;
}

/**
 * Builds the `options` object to pass to `Dialog.confirm({..., options})` or
 * as the second argument to `new Dialog(data, options)`, tagging the
 * resulting window with both the shared `level-one-2024-builder` class (so
 * builder.css's window-content fallback rules can match it) and the
 * module-private marker class the renderDialog hook below looks for.
 *
 * @param {Partial<ApplicationOptions>} [extra]  Any additional Application
 *   options the caller also needs (merged in; classes are combined).
 */
export function themedDialogOptions(extra = {}) {
  const classes = ["level-one-2024-builder", DIALOG_MARKER_CLASS, ...(extra.classes ?? [])];
  return { ...extra, classes };
}

/**
 * Registers the single global hook that themes every Dialog this module
 * opens. Call this once at module init. It never touches a Dialog it did
 * not itself tag via themedDialogOptions(), so it cannot affect dialogs
 * belonging to the core system, the dnd5e system, or other modules.
 */
export function registerDialogTheming() {
  Hooks.on("renderDialog", app => {
    if (!app?.options?.classes?.includes(DIALOG_MARKER_CLASS)) return;
    applyThemeToWindow(app);
  });
}

export function getThemeInlineStyle(theme = getGuiTheme()) {
  const themes = {
    parchment: { bg: '#f2e2bd', panel: '#fff4d2', border: '#8c6f42', strong: '#9b2f21', text: '#24180b', muted: '#5e4b31', accent: '#9b2f21', button: '#e1c991', selected: '#f0c7af' },
    dark: { bg: '#111217', panel: '#202227', border: '#565b66', strong: '#d69a36', text: '#f1eadf', muted: '#c9c1b3', accent: '#d69a36', button: '#2b2f38', selected: '#40351f' },
    crimson: { bg: '#210b10', panel: '#32151a', border: '#7a434a', strong: '#e1ae55', text: '#fff0e8', muted: '#dec6be', accent: '#e1ae55', button: '#4b2028', selected: '#51331e' },
    arcane: { bg: '#071326', panel: '#10223f', border: '#3c6797', strong: '#77d7ff', text: '#ecf8ff', muted: '#b9d6eb', accent: '#77d7ff', button: '#18365f', selected: '#15425f' },
    clean: { bg: '#f5f5f2', panel: '#ffffff', border: '#b7b7ad', strong: '#2f6fa8', text: '#1e1e1e', muted: '#555555', accent: '#2f6fa8', button: '#e9e9e3', selected: '#dbe9f5' },
    emerald: { bg: '#071b13', panel: '#102a1f', border: '#3d7c5c', strong: '#8ff0b6', text: '#eafff2', muted: '#b7d7c4', accent: '#8ff0b6', button: '#173929', selected: '#214f38' },
    royal: { bg: '#160b2c', panel: '#241541', border: '#6c55a3', strong: '#d8b4ff', text: '#f6efff', muted: '#cdbde2', accent: '#d8b4ff', button: '#322052', selected: '#4b2f77' },
    infernal: { bg: '#160806', panel: '#2b100b', border: '#8d3b24', strong: '#ff9a3d', text: '#fff1e5', muted: '#e0bca5', accent: '#ff9a3d', button: '#451b12', selected: '#663019' },
    frost: { bg: '#eaf3f7', panel: '#f9fdff', border: '#8eacbb', strong: '#315f7a', text: '#13242d', muted: '#49606b', accent: '#315f7a', button: '#dcecf3', selected: '#c9e3ee' },
    lantern: { bg: '#2a1a0d', panel: '#3a2412', border: '#9a6a35', strong: '#ffc56d', text: '#fff4db', muted: '#d7bea0', accent: '#ffc56d', button: '#4a2f18', selected: '#67421f' },
    highContrast: { bg: '#000000', panel: '#101010', border: '#ffffff', strong: '#ffff00', text: '#ffffff', muted: '#e5e5e5', accent: '#ffff00', button: '#1b1b1b', selected: '#333300' }
  };
  const t = themes[theme] ?? themes.parchment;
  return [
    `--l12024b-bg: ${t.bg}`,
    `--l12024b-panel-bg: ${t.panel}`,
    `--l12024b-border: ${t.border}`,
    `--l12024b-border-strong: ${t.strong}`,
    `--l12024b-text: ${t.text}`,
    `--l12024b-muted: ${t.muted}`,
    `--l12024b-accent: ${t.accent}`,
    `--l12024b-button-bg: ${t.button}`,
    `--l12024b-selected-bg: ${t.selected}`,
    `background: ${t.bg}`,
    `color: ${t.text}`
  ].join('; ');
}
