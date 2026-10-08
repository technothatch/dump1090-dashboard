/**
 * Display formatting — pure functions, no DOM, no locale surprises.
 *
 * Every formatter is total: `undefined` renders as the em-dash placeholder
 * instead of `NaN`/`undefined` leaking into the table.
 */

import type { Aircraft } from "./types";

/** Emergency squawks (SPEC): hijack, radio failure, general emergency. */
export const EMERGENCY_SQUAWKS: readonly string[] = ["7500", "7600", "7700"];

const EMERGENCY_SQUAWK_SET = new Set<string>(EMERGENCY_SQUAWKS);

/** Placeholder for missing values. */
export const EMPTY = "—";

function round(value: number): number {
  return Math.round(value);
}

/** `alt_baro` in feet: `"ground"` → 0 (SPEC convention), missing → `null`. */
export function altitudeFt(aircraft: Aircraft): number | null {
  const { alt_baro, alt_geom } = aircraft;
  if (typeof alt_baro === "number") return alt_baro;
  if (alt_baro === "ground") return 0;
  if (typeof alt_geom === "number") return alt_geom;
  return null;
}

/** `12,500 ft` / `GROUND` / `—`. */
export function formatAltitude(alt: number | "ground" | undefined): string {
  if (alt === "ground") return "GROUND";
  if (typeof alt !== "number" || !Number.isFinite(alt)) return EMPTY;
  return `${round(alt).toLocaleString("en-US")} ft`;
}

/** `412 kt` / `—`. */
export function formatSpeed(gs: number | undefined): string {
  if (typeof gs !== "number" || !Number.isFinite(gs)) return EMPTY;
  return `${round(gs)} kt`;
}

/** `274°` / `—` — track normalised into `[0, 360)`. */
export function formatTrack(track: number | undefined): string {
  if (typeof track !== "number" || !Number.isFinite(track)) return EMPTY;
  const normalized = ((track % 360) + 360) % 360;
  return `${round(normalized)}°`;
}

/** `+800 fpm` / `-1200 fpm` / `0 fpm` / `—`. */
export function formatRate(rate: number | undefined): string {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return EMPTY;
  const value = round(rate);
  const sign = value > 0 ? "+" : "";
  return `${sign}${value} fpm`;
}

/** Squawk as-is, or `—`. */
export function formatSquawk(squawk: string | undefined): string {
  if (typeof squawk !== "string" || squawk.trim() === "") return EMPTY;
  return squawk.trim();
}

/** True for 7500 / 7600 / 7700. */
export function isEmergencySquawk(squawk: string | undefined): boolean {
  return typeof squawk === "string" && EMERGENCY_SQUAWK_SET.has(squawk.trim());
}

/** True when the aircraft reports an emergency squawk or a non-`none` state. */
export function isEmergency(aircraft: Aircraft): boolean {
  if (isEmergencySquawk(aircraft.squawk)) return true;
  const state = aircraft.emergency;
  return typeof state === "string" && state !== "" && state !== "none";
}

/** `34.2 NM` / `—`. */
export function formatDistance(dst: number | undefined): string {
  if (typeof dst !== "number" || !Number.isFinite(dst)) return EMPTY;
  return `${dst.toFixed(1)} NM`;
}

/** `-13.4 dB` / `—`. */
export function formatRssi(rssi: number | undefined): string {
  if (typeof rssi !== "number" || !Number.isFinite(rssi)) return EMPTY;
  return `${rssi.toFixed(1)} dB`;
}

/** `42s` / `3m 05s` / `1h 12m` / `—`. */
export function formatSeen(seen: number | undefined): string {
  if (typeof seen !== "number" || !Number.isFinite(seen) || seen < 0) return EMPTY;
  const total = Math.floor(seen);
  if (total < 60) return `${total}s`;
  if (total < 3600) {
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

/** Callsign when present, otherwise the uppercase hex. */
export function label(aircraft: Aircraft): string {
  const flight = typeof aircraft.flight === "string" ? aircraft.flight.trim() : "";
  return flight === "" ? aircraft.hex.toUpperCase() : flight;
}

/** Integer with thousands separators. */
export function formatCount(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return EMPTY;
  return Math.round(value).toLocaleString("en-US");
}

/** `51.5074, -0.1278` / `—`. */
export function formatLatLon(lat: number | undefined, lon: number | undefined): string {
  if (typeof lat !== "number" || typeof lon !== "number" || !Number.isFinite(lat) ||
      !Number.isFinite(lon)) {
    return EMPTY;
  }
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

const AIR_CATEGORIES: Record<string, string> = {
  A0: "air, unknown",
  A1: "air, light",
  A2: "air, medium",
  A3: "air, large",
  A4: "air, vortex",
  A5: "air, glider",
  A6: "air, UAV",
  A7: "air, balloon",
};

/**
 * Human description of an emitter category (`A0`–`A7`, `B0`–`B7`, `C0`–`C7`,
 * `D0`–`D7`). Unknown codes are returned verbatim, missing ones render `—`.
 */
export function formatCategory(category: string | undefined): string {
  if (typeof category !== "string") return EMPTY;
  const code = category.trim().toUpperCase();
  if (code === "") return EMPTY;
  const air = AIR_CATEGORIES[code];
  if (air !== undefined) return `${code} · ${air}`;
  if (code.startsWith("B")) return `${code} · surface`;
  if (code.startsWith("C")) return `${code} · vehicle`;
  if (code.startsWith("D")) return `${code} · ground`;
  return code;
}
