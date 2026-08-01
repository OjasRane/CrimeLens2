export type ThemeMode = "archive" | "terminal";

export const themeStorageKey = "crimelens-theme";
export const themeChangeEvent = "crimelens-theme-change";

export function getDocumentTheme(): ThemeMode {
  if (typeof document === "undefined") {
    return "archive";
  }

  return document.documentElement.dataset.theme === "terminal"
    ? "terminal"
    : "archive";
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = mode;
  document.documentElement.classList.toggle("dark", mode === "terminal");
  window.localStorage.setItem(themeStorageKey, mode);
  window.dispatchEvent(new CustomEvent(themeChangeEvent, { detail: mode }));
}
