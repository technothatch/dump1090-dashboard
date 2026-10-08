/**
 * Selectors: pure derivations over {@link DashboardState}.
 *
 * Everything here is a plain function of its inputs — the table's filter and
 * sort, the counters, the selected row — which is what makes the whole
 * filtering/sorting contract unit-testable without a browser.
 */

import { altitudeFt, isEmergency, label } from "./format";
import type { DashboardState } from "./store";
import type { Aircraft, SortDir, SortKey } from "./types";

/** Fields considered by the free-text filter (lowercase haystack). */
function haystack(aircraft: Aircraft): string {
  return [
    aircraft.hex,
    aircraft.flight ?? "",
    aircraft.type ?? "",
    aircraft.t ?? "",
    aircraft.squawk ?? "",
    aircraft.r ?? "",
    aircraft.category ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

/** True when every whitespace-separated token of `query` appears in the aircraft. */
export function matchesQuery(aircraft: Aircraft, query: string): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter((t) => t !== "");
  if (tokens.length === 0) return true;
  const hay = haystack(aircraft);
  return tokens.every((token) => hay.includes(token));
}

/** Filter by free text; empty query returns the input untouched. */
export function filterAircraft(aircraft: Aircraft[], query: string): Aircraft[] {
  if (query.trim() === "") return aircraft.slice();
  return aircraft.filter((entry) => matchesQuery(entry, query));
}

function sortValue(aircraft: Aircraft, key: SortKey): number | string | null {
  switch (key) {
    case "flight":
      return label(aircraft).toLowerCase();
    case "hex":
      return aircraft.hex;
    case "squawk":
      return typeof aircraft.squawk === "string" ? aircraft.squawk : null;
    case "alt":
      return altitudeFt(aircraft);
    case "gs":
      return typeof aircraft.gs === "number" ? aircraft.gs : null;
    case "track":
      return typeof aircraft.track === "number" ? aircraft.track : null;
    case "dst":
      return typeof aircraft.dst === "number" ? aircraft.dst : null;
    case "rssi":
      return typeof aircraft.rssi === "number" ? aircraft.rssi : null;
    case "messages":
      return typeof aircraft.messages === "number" ? aircraft.messages : null;
    case "seen":
      return typeof aircraft.seen === "number" ? aircraft.seen : null;
    default:
      return null;
  }
}

function compareValues(
  a: number | string | null,
  b: number | string | null,
  dir: SortDir,
): number {
  // Missing values always sink to the bottom, whatever the direction.
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  let cmp: number;
  if (typeof a === "number" && typeof b === "number") cmp = a - b;
  else cmp = String(a).localeCompare(String(b));
  return dir === "asc" ? cmp : -cmp;
}

/**
 * Sort a copy of `aircraft` by `key`. Stable for equal values; missing values
 * always sort last regardless of direction.
 */
export function sortAircraft(aircraft: Aircraft[], key: SortKey, dir: SortDir): Aircraft[] {
  return aircraft
    .map((entry, index) => ({ entry, index, value: sortValue(entry, key) }))
    .toSorted((a, b) => {
      const cmp = compareValues(a.value, b.value, dir);
      return cmp !== 0 ? cmp : a.index - b.index;
    })
    .map((wrapped) => wrapped.entry);
}

/** Filtered + sorted rows for the table. */
export function selectRows(state: DashboardState): Aircraft[] {
  return sortAircraft(filterAircraft(state.aircraft, state.filter), state.sortKey, state.sortDir);
}

/** Counters for the header strip. */
export interface Counts {
  total: number;
  positioned: number;
  airborne: number;
  onGround: number;
  emergency: number;
}

/** Snapshot counters (aircraft with a position, on ground, in emergency...). */
export function selectCounts(state: DashboardState): Counts {
  const counts: Counts = {
    total: state.aircraft.length,
    positioned: 0,
    airborne: 0,
    onGround: 0,
    emergency: 0,
  };
  for (const aircraft of state.aircraft) {
    if (typeof aircraft.lat === "number" && typeof aircraft.lon === "number") {
      counts.positioned += 1;
    }
    if (aircraft.alt_baro === "ground") counts.onGround += 1;
    else if (typeof aircraft.alt_baro === "number" || typeof aircraft.alt_geom === "number") {
      counts.airborne += 1;
    }
    if (isEmergency(aircraft)) counts.emergency += 1;
  }
  return counts;
}

/** The selected aircraft, or `null` when the drawer is closed/unknown hex. */
export function selectSelected(state: DashboardState): Aircraft | null {
  if (state.selectedHex === null) return null;
  return state.aircraft.find((entry) => entry.hex === state.selectedHex) ?? null;
}

/** Positioned aircraft (those with lat **and** lon) — the map's inputs. */
export function selectPositioned(state: DashboardState): Aircraft[] {
  return state.aircraft.filter(
    (entry) => typeof entry.lat === "number" && typeof entry.lon === "number",
  );
}
