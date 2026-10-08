/**
 * Header/footer glue: connection pill, counters, poll cadence, receiver and
 * data-source captions. Text only — no logic beyond string assembly.
 */

import { formatLatLon } from "../lib/format";
import type { DashboardState } from "../lib/store";
import type { Counts } from "../lib/selectors";
import type { Receiver } from "../lib/types";

function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}

/** Status pill: state word plus the last error as a tooltip. */
export function renderStatus(pill: HTMLElement, state: Pick<DashboardState, "connection" | "error">): void {
  pill.textContent = state.connection;
  pill.className = `pill pill-${state.connection}`;
  pill.title = state.error ?? "";
}

/** `12 aircraft · 9 with position · 1 emergency`. */
export function renderCounts(element: HTMLElement, counts: Counts): void {
  const parts = [
    `${counts.total} aircraft`,
    `${counts.positioned} with position`,
    `${counts.onGround} on ground`,
  ];
  if (counts.emergency > 0) parts.push(`${counts.emergency} emergency`);
  element.textContent = parts.join(" · ");
}

/** `polling every 1.0 s · updated 14:03:22`. */
export function renderPollInfo(
  element: HTMLElement,
  state: Pick<DashboardState, "intervalMs" | "lastUpdateMs">,
): void {
  const cadence = state.intervalMs > 0 ? `polling every ${seconds(state.intervalMs)}` : "polling";
  const updated =
    state.lastUpdateMs > 0 ? `updated ${clockTime(state.lastUpdateMs)}` : "waiting for first poll";
  element.textContent = `${cadence} · ${updated}`;
}

/** Decoder caption: `readsb 3.14 · 51.5074, -0.1278`. */
export function renderReceiverInfo(element: HTMLElement, receiver: Receiver | null): void {
  if (receiver === null) {
    element.textContent = "receiver: unknown";
    return;
  }
  const version = typeof receiver.version === "string" ? receiver.version : "unknown version";
  const position =
    typeof receiver.lat === "number" && typeof receiver.lon === "number"
      ? formatLatLon(receiver.lat, receiver.lon)
      : "no position";
  element.textContent = `${version} · ${position}`;
}

/** Data source caption (`/data/` or whatever `?data=` selected). */
export function renderSourceInfo(element: HTMLElement, dataUrl: string): void {
  element.textContent = `source: ${dataUrl}`;
}
