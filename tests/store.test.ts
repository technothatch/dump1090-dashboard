import { describe, expect, it, vi } from "vitest";
import {
  applySnapshot,
  createInitialState,
  createStore,
  DEFAULT_SORT_DIR,
  selectAircraft,
  setConnection,
  setFilter,
  setTheme,
  toggleSort,
} from "../src/lib/store";
import type { AircraftResponse, Receiver } from "../src/lib/types";

function snapshot(count = 2): AircraftResponse {
  return {
    now: 1728000000,
    messages: 4242,
    aircraft: Array.from({ length: count }, (_, index) => ({
      hex: `abc${index}`,
      flight: `TST${index}  `,
    })),
  };
}

const RECEIVER: Receiver = { version: "readsb 4.0", lat: 51.5, lon: -0.12, refresh: 1 };

describe("createInitialState", () => {
  it("starts empty, unsorted and connecting", () => {
    const state = createInitialState();
    expect(state.aircraft).toEqual([]);
    expect(state.receiver).toBeNull();
    expect(state.connection).toBe("connecting");
    expect(state.filter).toBe("");
    expect(state.sortKey).toBe("flight");
    expect(state.sortDir).toBe("asc");
    expect(state.selectedHex).toBeNull();
    expect(state.theme).toBe("dark");
    expect(state.error).toBeNull();
  });

  it("applies overrides", () => {
    const state = createInitialState({ theme: "light", filter: "ual", sortKey: "alt" });
    expect(state.theme).toBe("light");
    expect(state.filter).toBe("ual");
    expect(state.sortKey).toBe("alt");
  });
});

describe("createStore", () => {
  it("merges patches into the state", () => {
    const store = createStore(createInitialState());
    store.setState({ filter: "ual", sortKey: "gs" });
    expect(store.getState().filter).toBe("ual");
    expect(store.getState().sortKey).toBe("gs");
    expect(store.getState().connection).toBe("connecting");
  });

  it("notifies subscribers and supports unsubscribe", () => {
    const store = createStore(createInitialState());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.setState({ filter: "a" });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.setState({ filter: "b" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("drops patches that change nothing", () => {
    const store = createStore(createInitialState({ filter: "same" }));
    const listener = vi.fn();
    store.subscribe(listener);

    store.setState({ filter: "same" });
    expect(listener).not.toHaveBeenCalled();

    store.setState({ filter: "different" });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe("dashboard actions", () => {
  it("applySnapshot records data, cadence and a healthy status", () => {
    const store = createStore(createInitialState({ connection: "reconnecting", error: "boom" }));
    applySnapshot(store, snapshot(3), { receivedAt: 999, intervalMs: 2500, receiver: RECEIVER });

    const state = store.getState();
    expect(state.aircraft).toHaveLength(3);
    expect(state.now).toBe(1728000000);
    expect(state.messages).toBe(4242);
    expect(state.lastUpdateMs).toBe(999);
    expect(state.intervalMs).toBe(2500);
    expect(state.connection).toBe("live");
    expect(state.error).toBeNull();
    expect(state.receiver?.version).toBe("readsb 4.0");
  });

  it("applySnapshot can clear a previously known receiver", () => {
    const store = createStore(createInitialState({ receiver: RECEIVER }));
    applySnapshot(store, snapshot(0), { receivedAt: 1, intervalMs: 5000, receiver: null });
    expect(store.getState().receiver).toBeNull();
  });

  it("setConnection stores status, error and cadence", () => {
    const store = createStore(createInitialState());
    setConnection(store, "reconnecting", "HTTP 502", 1000);
    expect(store.getState()).toMatchObject({
      connection: "reconnecting",
      error: "HTTP 502",
      intervalMs: 1000,
    });
  });

  it("setFilter and setTheme update their fields", () => {
    const store = createStore(createInitialState());
    setFilter(store, "a320");
    setTheme(store, "light");
    expect(store.getState().filter).toBe("a320");
    expect(store.getState().theme).toBe("light");
  });

  it("selectAircraft opens and closes the drawer", () => {
    const store = createStore(createInitialState());
    selectAircraft(store, "abc123");
    expect(store.getState().selectedHex).toBe("abc123");
    selectAircraft(store, null);
    expect(store.getState().selectedHex).toBeNull();
  });
});

describe("toggleSort", () => {
  it("uses the column's default direction when switching columns", () => {
    const store = createStore(createInitialState());
    toggleSort(store, "alt");
    expect(store.getState().sortKey).toBe("alt");
    expect(store.getState().sortDir).toBe(DEFAULT_SORT_DIR.alt);
    expect(store.getState().sortDir).toBe("desc");

    toggleSort(store, "flight");
    expect(store.getState().sortDir).toBe("asc");
  });

  it("flips the direction when clicking the active column", () => {
    const store = createStore(createInitialState({ sortKey: "flight", sortDir: "asc" }));
    toggleSort(store, "flight");
    expect(store.getState().sortDir).toBe("desc");
    toggleSort(store, "flight");
    expect(store.getState().sortDir).toBe("asc");
  });

  it("keeps the direction when switching to a column with the same default", () => {
    const store = createStore(createInitialState({ sortKey: "alt", sortDir: "desc" }));
    toggleSort(store, "gs");
    expect(store.getState().sortKey).toBe("gs");
    expect(store.getState().sortDir).toBe("desc");
  });
});
