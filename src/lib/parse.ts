/**
 * Tolerant parsers for decoder JSON.
 *
 * The payloads are untrusted broadcast output: a decoder upgrade (or a
 * proxy serving an error page) must never crash the dashboard. Unknown keys
 * are preserved, wrongly-typed keys are dropped, malformed aircraft entries
 * are skipped — but a completely non-object document is a hard error so the
 * polling controller can surface it through the status pill.
 */

import type { Aircraft, AircraftResponse, Receiver } from "./types";

/** Numeric keys coerced/validated on each aircraft. */
const NUMERIC_KEYS = [
  "alt_geom",
  "gs",
  "ias",
  "tas",
  "mach",
  "track",
  "track_rate",
  "roll",
  "mag_heading",
  "true_heading",
  "baro_rate",
  "geom_rate",
  "nav_qnh",
  "nav_altitude_mcp",
  "nav_altitude_fms",
  "nav_heading",
  "lat",
  "lon",
  "nic",
  "rc",
  "seen_pos",
  "version",
  "nic_baro",
  "nac_p",
  "nac_v",
  "sil",
  "gva",
  "sda",
  "messages",
  "seen",
  "rssi",
  "alert",
  "spi",
  "wd",
  "ws",
  "oat",
  "tat",
  "dst",
  "dir",
  "dbFlags",
  "rr_lat",
  "rr_lon",
] as const;

/** String keys coerced/validated on each aircraft. */
const STRING_KEYS = [
  "type",
  "flight",
  "squawk",
  "emergency",
  "category",
  "sil_type",
  "r",
  "t",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

/**
 * Normalise a single `aircraft.json` entry.
 *
 * Returns `null` when the entry is not an object or carries no usable `hex`
 * — those entries are dropped rather than rendered as broken rows.
 */
export function parseAircraft(raw: unknown): Aircraft | null {
  if (!isRecord(raw)) return null;
  const hex = typeof raw.hex === "string" ? raw.hex.trim().toLowerCase() : "";
  if (hex === "") return null;

  const out: Record<string, unknown> = { ...raw, hex };

  for (const key of NUMERIC_KEYS) {
    if (!isFiniteNumber(raw[key])) delete out[key];
  }
  for (const key of STRING_KEYS) {
    if (typeof raw[key] !== "string") delete out[key];
  }

  const altBaro = raw.alt_baro;
  if (isFiniteNumber(altBaro) || altBaro === "ground") out.alt_baro = altBaro;
  else delete out.alt_baro;

  if (!isStringArray(raw.mlat)) delete out.mlat;
  if (!isStringArray(raw.tisb)) delete out.tisb;
  if (!isStringArray(raw.nav_modes)) delete out.nav_modes;

  if (!isRecord(raw.lastPosition) || !isFiniteNumber(raw.lastPosition.lat) ||
      !isFiniteNumber(raw.lastPosition.lon)) {
    delete out.lastPosition;
  }

  return out as Aircraft;
}

/**
 * Parse an `aircraft.json` document.
 *
 * Tolerates a missing/non-array `aircraft` key (treated as an empty
 * snapshot) but throws when the document root is not an object.
 */
export function parseAircraftResponse(raw: unknown): AircraftResponse {
  if (!isRecord(raw)) {
    throw new TypeError("aircraft.json: expected an object at the document root");
  }
  const entries = Array.isArray(raw.aircraft) ? raw.aircraft : [];
  const aircraft: Aircraft[] = [];
  for (const entry of entries) {
    const parsed = parseAircraft(entry);
    if (parsed !== null) aircraft.push(parsed);
  }
  return {
    now: isFiniteNumber(raw.now) ? raw.now : 0,
    messages: isFiniteNumber(raw.messages) ? raw.messages : 0,
    aircraft,
  };
}

/**
 * Parse a `receiver.json` document. Returns `null` when the root is not an
 * object; individual fields of the wrong type are simply left out.
 */
export function parseReceiver(raw: unknown): Receiver | null {
  if (!isRecord(raw)) return null;
  const out: Receiver = {};
  if (typeof raw.version === "string") out.version = raw.version;
  if (isFiniteNumber(raw.refresh)) out.refresh = raw.refresh;
  if (isFiniteNumber(raw.lat)) out.lat = raw.lat;
  if (isFiniteNumber(raw.lon)) out.lon = raw.lon;
  return out;
}
