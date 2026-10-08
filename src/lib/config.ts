/**
 * URL / query-string configuration.
 *
 * The default data base is the **relative** `/data/` — that is what makes the
 * built dashboard work when it is served by the very same nginx that serves
 * tar1090 (or the bundled Docker image proxying `/data/`). Point it somewhere
 * else with `?data=http://other-host:8080/data/`.
 */

import { MAX_INTERVAL_MS, MIN_INTERVAL_MS } from "./polling";
import type { Theme } from "./types";

/** Default (relative) data base — same-origin `/data/`. */
export const DEFAULT_DATA_URL = "/data/";

/** Parsed query-string configuration. */
export interface DashboardParams {
  /** Base URL for `aircraft.json` / `receiver.json`, trailing slash included. */
  dataUrl: string;
  /** Explicit theme from `?theme=`. */
  theme: Theme | null;
  /** Pinned poll interval from `?interval=` (ms), or `null` for adaptive. */
  intervalMs: number | null;
}

/** Ensure a base URL ends with exactly one slash. */
export function normalizeDataUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed === "") return DEFAULT_DATA_URL;
  return `${trimmed.replace(/\/+$/, "")}/`;
}

/** Join a data base with a document name. */
export function buildDataUrl(base: string, file: string): string {
  return `${normalizeDataUrl(base)}${file.replace(/^\/+/, "")}`;
}

/** Parse `location.search` into dashboard configuration. */
export function parseDashboardParams(search: string): DashboardParams {
  const params = new URLSearchParams(search);

  const dataParam = params.get("data");
  const dataUrl =
    dataParam !== null && dataParam.trim() !== "" ? normalizeDataUrl(dataParam) : DEFAULT_DATA_URL;

  const themeParam = params.get("theme");
  const theme: Theme | null = themeParam === "dark" || themeParam === "light" ? themeParam : null;

  const intervalParam = params.get("interval");
  const parsedInterval = intervalParam === null ? Number.NaN : Number.parseInt(intervalParam, 10);
  const intervalMs = Number.isFinite(parsedInterval)
    ? Math.min(MAX_INTERVAL_MS, Math.max(MIN_INTERVAL_MS, parsedInterval))
    : null;

  return { dataUrl, theme, intervalMs };
}
