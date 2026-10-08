/**
 * Application bootstrap: parse `location.search`, resolve the theme, build
 * the store + polling controller, subscribe the renderers, wire the DOM
 * events. All decision-making lives in `src/lib/` — this file is glue.
 */

import "./style.css";
import { buildDataUrl, DEFAULT_DATA_URL, parseDashboardParams } from "./lib/config";
import { haversineNm } from "./lib/geo";
import { createPoller } from "./lib/polling";
import { chooseRangeNm, createProjection } from "./lib/projection";
import {
  selectCounts,
  selectPositioned,
  selectRows,
  selectSelected,
} from "./lib/selectors";
import {
  applySnapshot,
  createInitialState,
  createStore,
  selectAircraft,
  setConnection,
  setFilter,
  setTheme,
  toggleSort,
} from "./lib/store";
import { resolveTheme, saveTheme, toggleTheme } from "./lib/theme";
import type { StorageLike } from "./lib/theme";
import { TrailBuffer } from "./lib/trails";
import type { DashboardState } from "./lib/store";
import type { SortKey } from "./lib/types";
import { renderDrawer } from "./ui/drawer";
import { renderMap } from "./ui/map";
import {
  renderCounts,
  renderPollInfo,
  renderReceiverInfo,
  renderSourceInfo,
  renderStatus,
} from "./ui/status";
import { renderTableBody, updateSortHeaders } from "./ui/table";

/** SVG viewBox size of the radar plot (matches `index.html`). */
const MAP_SIZE = 600;

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`dump1090-dashboard: missing element ${selector}`);
  return element;
}

/** `localStorage` behind a throwing-safe interface (private mode throws). */
function browserStorage(): StorageLike | null {
  try {
    const storage = window.localStorage;
    return {
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => storage.setItem(key, value),
    };
  } catch {
    return null;
  }
}

const params = parseDashboardParams(window.location.search);
const dataUrl = params.dataUrl || DEFAULT_DATA_URL;
const storage = browserStorage();
const prefersDark =
  typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : true;

const store = createStore(
  createInitialState({
    theme: resolveTheme({ explicit: params.theme, storage, prefersDark }),
  }),
);
const trails = new TrailBuffer();

const statusPill = must<HTMLElement>("#status-pill");
const countsEl = must<HTMLElement>("#counts");
const pollInfoEl = must<HTMLElement>("#poll-info");
const filterEl = must<HTMLInputElement>("#filter");
const themeButton = must<HTMLButtonElement>("#theme-toggle");
const tableEl = must<HTMLTableElement>("#aircraft-table");
const bodyEl = must<HTMLTableSectionElement>("#aircraft-body");
const emptyNote = must<HTMLElement>("#empty-note");
const mapEl = must<SVGSVGElement>("#map");
const mapNote = must<HTMLElement>("#map-note");
const sourceInfo = must<HTMLElement>("#source-info");
const receiverInfo = must<HTMLElement>("#receiver-info");
const drawer = must<HTMLElement>("#drawer");
const drawerClose = must<HTMLButtonElement>("#drawer-close");

const poller = createPoller({
  aircraftUrl: buildDataUrl(dataUrl, "aircraft.json"),
  receiverUrl: buildDataUrl(dataUrl, "receiver.json"),
  fixedIntervalMs: params.intervalMs,
  onUpdate: ({ aircraft, receiver, intervalMs, receivedAt }) => {
    applySnapshot(store, aircraft, { receivedAt, intervalMs, receiver });
    const snapshot = store.getState();
    for (const entry of snapshot.aircraft) {
      const lat = entry.lat;
      const lon = entry.lon;
      if (typeof lat === "number" && typeof lon === "number") {
        trails.record(entry.hex, lat, lon, receivedAt);
      }
    }
    trails.prune(receivedAt);
  },
  onStatus: (connection, error) => {
    setConnection(store, connection, error ?? null, store.getState().intervalMs);
  },
});

function renderMapPane(state: DashboardState): void {
  const receiver = state.receiver;
  const lat = receiver?.lat;
  const lon = receiver?.lon;
  if (receiver === null || typeof lat !== "number" || typeof lon !== "number") {
    mapNote.textContent =
      receiver === null
        ? "Waiting for receiver.json…"
        : "receiver.json has no lat/lon — radar plot disabled.";
    mapNote.hidden = false;
    renderMap(mapEl, null);
    return;
  }
  mapNote.hidden = true;

  const center = { lat, lon };
  const positioned = selectPositioned(state);
  let farthestNm = 0;
  for (const entry of positioned) {
    const entryLat = entry.lat;
    const entryLon = entry.lon;
    if (typeof entryLat !== "number" || typeof entryLon !== "number") continue;
    farthestNm = Math.max(farthestNm, haversineNm(lat, lon, entryLat, entryLon));
  }

  renderMap(mapEl, {
    projection: createProjection(center, chooseRangeNm(farthestNm), MAP_SIZE),
    aircraft: positioned,
    trails,
    selectedHex: state.selectedHex,
  });
}

function render(state: DashboardState): void {
  document.documentElement.dataset.theme = state.theme;

  const rows = selectRows(state);
  renderTableBody(bodyEl, rows, state.selectedHex);
  updateSortHeaders(tableEl, state.sortKey, state.sortDir);
  renderCounts(countsEl, selectCounts(state));
  renderStatus(statusPill, state);
  renderPollInfo(pollInfoEl, state);
  renderReceiverInfo(receiverInfo, state.receiver);
  renderSourceInfo(sourceInfo, dataUrl);

  if (state.aircraft.length === 0) emptyNote.textContent = "Waiting for aircraft.json…";
  else if (rows.length === 0) emptyNote.textContent = "No aircraft matches the filter.";
  emptyNote.hidden = rows.length > 0;

  renderMapPane(state);
  renderDrawer(drawer, selectSelected(state), state.receiver);
}

store.subscribe(render);

// --- events -----------------------------------------------------------------

filterEl.addEventListener("input", () => setFilter(store, filterEl.value));

tableEl.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const header = target?.closest<HTMLElement>("th[data-sort]");
  if (header !== null && header !== undefined && header.dataset.sort !== undefined) {
    toggleSort(store, header.dataset.sort as SortKey);
    return;
  }
  const row = target?.closest<HTMLElement>("tr[data-hex]");
  const hex = row?.dataset.hex;
  if (hex !== undefined) selectAircraft(store, hex);
});

bodyEl.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Enter") return;
  const rows = [...bodyEl.querySelectorAll<HTMLElement>("tr[data-hex]")];
  const active = document.activeElement;
  const currentRow =
    active instanceof HTMLElement ? active.closest<HTMLElement>("tr[data-hex]") : null;
  const index = currentRow === null ? -1 : rows.indexOf(currentRow);

  if (event.key === "Enter") {
    const hex = currentRow?.dataset.hex;
    if (hex !== undefined) selectAircraft(store, hex);
    return;
  }
  event.preventDefault();
  const next = event.key === "ArrowDown" ? index + 1 : index - 1;
  rows[Math.max(0, Math.min(rows.length - 1, next))]?.focus();
});

document.addEventListener("keydown", (event) => {
  const target = event.target;
  const typing =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
  if (event.key === "/" && !typing) {
    event.preventDefault();
    filterEl.focus();
    filterEl.select();
    return;
  }
  if (event.key === "Escape" && store.getState().selectedHex !== null) {
    selectAircraft(store, null);
  }
});

mapEl.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const marker = target?.closest<SVGGElement>("g[data-hex]");
  const hex = marker?.dataset.hex;
  if (hex !== undefined) selectAircraft(store, hex);
});

drawerClose.addEventListener("click", () => selectAircraft(store, null));

themeButton.addEventListener("click", () => {
  const next = toggleTheme(store.getState().theme);
  saveTheme(storage, next);
  setTheme(store, next);
});

window.addEventListener("pagehide", () => poller.stop());

// --- go ---------------------------------------------------------------------

render(store.getState());
poller.start();
