/**
 * Table glue: builds rows from selector output and keeps the sort headers in
 * sync. No business logic here — ordering/filtering already happened in
 * `lib/selectors.ts`.
 */

import {
  formatAltitude,
  formatCount,
  formatDistance,
  formatRssi,
  formatSeen,
  formatSquawk,
  formatSpeed,
  formatTrack,
  isEmergency,
  isEmergencySquawk,
  label,
} from "../lib/format";
import type { Aircraft, SortDir, SortKey } from "../lib/types";

function cell(text: string, className?: string): HTMLTableCellElement {
  const td = document.createElement("td");
  td.textContent = text;
  if (className !== undefined) td.className = className;
  return td;
}

function typeLabel(aircraft: Aircraft): string {
  if (typeof aircraft.type === "string" && aircraft.type.trim() !== "") return aircraft.type;
  if (typeof aircraft.t === "string" && aircraft.t.trim() !== "") return aircraft.t;
  return "—";
}

/** Replace the `<tbody>` contents with `rows`. */
export function renderTableBody(
  tbody: HTMLTableSectionElement,
  rows: Aircraft[],
  selectedHex: string | null,
): void {
  const fragment = document.createDocumentFragment();
  for (const aircraft of rows) {
    const tr = document.createElement("tr");
    tr.dataset.hex = aircraft.hex;
    tr.tabIndex = 0;
    if (aircraft.hex === selectedHex) tr.classList.add("selected");
    if (isEmergency(aircraft)) tr.classList.add("emergency");

    tr.append(
      cell(label(aircraft), "col-flight"),
      cell(aircraft.hex.toUpperCase(), "col-hex"),
      cell(typeLabel(aircraft), "col-type"),
      cell(formatAltitude(aircraft.alt_baro), "numeric"),
      cell(formatSpeed(aircraft.gs), "numeric"),
      cell(formatTrack(aircraft.track), "numeric"),
      cell(
        formatSquawk(aircraft.squawk),
        isEmergencySquawk(aircraft.squawk) ? "numeric squawk-alarm" : "numeric",
      ),
      cell(formatDistance(aircraft.dst), "numeric"),
      cell(formatRssi(aircraft.rssi), "numeric"),
      cell(formatCount(aircraft.messages), "numeric"),
      cell(formatSeen(aircraft.seen), "numeric"),
    );
    fragment.append(tr);
  }
  tbody.replaceChildren(fragment);
}

/** Reflect the active sort column/direction in the `<th>` elements. */
export function updateSortHeaders(
  table: HTMLTableElement,
  key: SortKey,
  dir: SortDir,
): void {
  for (const th of table.querySelectorAll<HTMLTableCellElement>("th[data-sort]")) {
    const sortKey = th.dataset.sort;
    const active = sortKey === key;
    th.classList.toggle("sorted", active);
    th.dataset.dir = active ? dir : "";
    th.setAttribute("aria-sort", active ? (dir === "asc" ? "ascending" : "descending") : "none");
  }
}
