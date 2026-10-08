import { describe, expect, it } from "vitest";
import {
  isTheme,
  loadTheme,
  resolveTheme,
  saveTheme,
  THEME_STORAGE_KEY,
  toggleTheme,
} from "../src/lib/theme";
import type { StorageLike } from "../src/lib/theme";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error("storage blocked");
  },
  setItem: () => {
    throw new Error("storage blocked");
  },
};

describe("isTheme", () => {
  it("accepts only dark and light", () => {
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("light")).toBe(true);
    expect(isTheme("blue")).toBe(false);
    expect(isTheme(null)).toBe(false);
    expect(isTheme(undefined)).toBe(false);
  });
});

describe("loadTheme / saveTheme", () => {
  it("round-trips through storage", () => {
    const storage = memoryStorage();
    saveTheme(storage, "light");
    expect(storage.data.get(THEME_STORAGE_KEY)).toBe("light");
    expect(loadTheme(storage)).toBe("light");
  });

  it("returns null for unset, invalid or unavailable storage", () => {
    expect(loadTheme(memoryStorage())).toBeNull();
    expect(loadTheme(memoryStorage({ [THEME_STORAGE_KEY]: "neon" }))).toBeNull();
    expect(loadTheme(null)).toBeNull();
    expect(loadTheme(undefined)).toBeNull();
    expect(loadTheme(throwingStorage)).toBeNull();
  });

  it("swallows storage write failures", () => {
    expect(() => saveTheme(throwingStorage, "dark")).not.toThrow();
    expect(() => saveTheme(null, "dark")).not.toThrow();
    expect(loadTheme(throwingStorage)).toBeNull();
  });
});

describe("toggleTheme", () => {
  it("flips between the two schemes", () => {
    expect(toggleTheme("dark")).toBe("light");
    expect(toggleTheme("light")).toBe("dark");
  });
});

describe("resolveTheme", () => {
  it("defaults to dark", () => {
    expect(resolveTheme()).toBe("dark");
    expect(resolveTheme({})).toBe("dark");
  });

  it("honours an explicit parameter above everything else", () => {
    const storage = memoryStorage({ [THEME_STORAGE_KEY]: "dark" });
    expect(resolveTheme({ explicit: "light", storage, prefersDark: true })).toBe("light");
    expect(resolveTheme({ explicit: "dark", storage, prefersDark: false })).toBe("dark");
  });

  it("falls back to the stored preference before the OS one", () => {
    const storage = memoryStorage({ [THEME_STORAGE_KEY]: "light" });
    expect(resolveTheme({ storage, prefersDark: true })).toBe("light");
    expect(resolveTheme({ storage: memoryStorage(), prefersDark: false })).toBe("light");
    expect(resolveTheme({ storage: memoryStorage(), prefersDark: true })).toBe("dark");
  });

  it("ignores an invalid explicit parameter", () => {
    expect(resolveTheme({ explicit: "neon" as never })).toBe("dark");
    expect(resolveTheme({ explicit: "neon" as never, prefersDark: false })).toBe("light");
  });
});
