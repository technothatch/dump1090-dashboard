/**
 * Store: a tiny observable state container plus the dashboard actions.
 *
 * No framework, no proxies, no magic — `getState()` / `setState(patch)` /
 * `subscribe(listener)`. Patches that change nothing are dropped so a poll
 * that returns identical data does not re-render the table.
 */

import type {
  AircraftResponse,
  ConnectionStatus,
  Receiver,
  SortDir,
  SortKey,
  Theme,
} from "./types";

/** Everything the single page renders from. */
export interface DashboardState {
  /** Latest `aircraft.json` snapshot (raw, unfiltered). */
  aircraft: AircraftResponse["aircraft"];
  /** Latest `receiver.json`, or `null` when unknown. */
  receiver: Receiver | null;
  /** Decoder clock for the snapshot, unix seconds. */
  now: number;
  /** Decoder lifetime message counter. */
  messages: number;
  /** Connection pill state. */
  connection: ConnectionStatus;
  /** Last transport/parse error, `null` when healthy. */
  error: string | null;
  /** Local wall-clock time of the last good poll, ms since epoch. */
  lastUpdateMs: number;
  /** Interval the controller will wait before the next poll, ms. */
  intervalMs: number;
  /** Free-text table filter. */
  filter: string;
  /** Active sort column. */
  sortKey: SortKey;
  /** Active sort direction. */
  sortDir: SortDir;
  /** Hex of the aircraft shown in the detail drawer. */
  selectedHex: string | null;
  /** Colour scheme. */
  theme: Theme;
}

/** Sensible first-sort direction per column. */
export const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  flight: "asc",
  hex: "asc",
  squawk: "asc",
  track: "asc",
  dst: "asc",
  seen: "asc",
  alt: "desc",
  gs: "desc",
  rssi: "desc",
  messages: "desc",
};

/** Fresh, empty state. */
export function createInitialState(overrides: Partial<DashboardState> = {}): DashboardState {
  return {
    aircraft: [],
    receiver: null,
    now: 0,
    messages: 0,
    connection: "connecting",
    error: null,
    lastUpdateMs: 0,
    intervalMs: 0,
    filter: "",
    sortKey: "flight",
    sortDir: "asc",
    selectedHex: null,
    theme: "dark",
    ...overrides,
  };
}

/** Minimal observable container. */
export interface Store<T extends object> {
  getState(): T;
  /** Shallow-merge a patch; listeners fire only when something changed. */
  setState(patch: Partial<T>): void;
  /** Subscribe to state changes; returns an unsubscribe function. */
  subscribe(listener: (state: T) => void): () => void;
}

function shallowEqual(a: object, b: object): boolean {
  const aKeys = Object.keys(a) as (keyof typeof a)[];
  const bKeys = Object.keys(b) as (keyof typeof b)[];
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => Object.is(a[key], b[key]));
}

/** Create a store around `initial`. */
export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<(state: T) => void>();

  return {
    getState: () => state,
    setState(patch: Partial<T>): void {
      const next = { ...state, ...patch } as T;
      if (shallowEqual(state, next)) return;
      state = next;
      for (const listener of listeners) listener(state);
    },
    subscribe(listener: (state: T) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Store of the whole dashboard. */
export type DashboardStore = Store<DashboardState>;

/** Fold a successful `aircraft.json` poll into the state. */
export function applySnapshot(
  store: DashboardStore,
  snapshot: AircraftResponse,
  options: { receivedAt: number; intervalMs: number; receiver: Receiver | null },
): void {
  store.setState({
    aircraft: snapshot.aircraft,
    now: snapshot.now,
    messages: snapshot.messages,
    lastUpdateMs: options.receivedAt,
    intervalMs: options.intervalMs,
    connection: "live",
    error: null,
    receiver: options.receiver,
  });
}

/** Record the controller's status (and any error) without touching data. */
export function setConnection(
  store: DashboardStore,
  connection: ConnectionStatus,
  error: string | null,
  intervalMs: number,
): void {
  store.setState({ connection, error, intervalMs });
}

/** Update the free-text filter. */
export function setFilter(store: DashboardStore, filter: string): void {
  store.setState({ filter });
}

/**
 * Toggle the sort column: clicking the active column flips the direction,
 * clicking a new column starts from {@link DEFAULT_SORT_DIR}.
 */
export function toggleSort(store: DashboardStore, key: SortKey): void {
  const { sortKey, sortDir } = store.getState();
  if (sortKey === key) {
    store.setState({ sortDir: sortDir === "asc" ? "desc" : "asc" });
  } else {
    store.setState({ sortKey: key, sortDir: DEFAULT_SORT_DIR[key] });
  }
}

/** Select an aircraft for the detail drawer (`null` closes it). */
export function selectAircraft(store: DashboardStore, hex: string | null): void {
  store.setState({ selectedHex: hex });
}

/** Switch colour scheme. */
export function setTheme(store: DashboardStore, theme: Theme): void {
  store.setState({ theme });
}
