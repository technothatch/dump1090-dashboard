/**
 * Theme persistence.
 *
 * `localStorage` is reached through a two-method interface so the rules
 * (explicit URL parameter > stored choice > OS preference > dark default)
 * are testable in Node without a browser, and a browser with storage
 * disabled (private mode, blocked cookies) degrades to defaults instead of
 * throwing.
 */

import type { Theme } from "./types";

/** Storage key used for the persisted choice. */
export const THEME_STORAGE_KEY = "dump1090-dashboard:theme";

/** Minimal `localStorage` shape. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Type guard for `"dark"` / `"light"`. */
export function isTheme(value: unknown): value is Theme {
  return value === "dark" || value === "light";
}

/**
 * Read the stored theme. Returns `null` when unset, invalid, unavailable or
 * throwing — callers fall back to their own default.
 */
export function loadTheme(storage: StorageLike | null | undefined): Theme | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
}

/** Persist the theme. Storage failures are swallowed on purpose. */
export function saveTheme(storage: StorageLike | null | undefined, theme: Theme): void {
  if (!storage) return;
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* storage unavailable — the choice simply doesn't persist */
  }
}

/** `"dark"` ↔ `"light"`. */
export function toggleTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

/** Inputs to {@link resolveTheme}. */
export interface ResolveThemeInput {
  /** Explicit `?theme=` parameter — highest precedence. */
  explicit?: Theme | null;
  /** Persisted choice. */
  storage?: StorageLike | null;
  /** `prefers-color-scheme` result; defaults to `true` (dashboard is dark-first). */
  prefersDark?: boolean;
}

/**
 * Resolve the initial theme: explicit parameter wins, then the stored
 * choice, then the OS preference, then dark.
 */
export function resolveTheme(input: ResolveThemeInput = {}): Theme {
  if (isTheme(input.explicit)) return input.explicit;
  const stored = loadTheme(input.storage);
  if (stored !== null) return stored;
  return input.prefersDark === false ? "light" : "dark";
}
