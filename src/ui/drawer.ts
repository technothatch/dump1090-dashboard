/**
 * Detail drawer glue: turns the selected aircraft (plus the receiver
 * position) into a definition list. Distances prefer the decoder's own
 * `dst`/`dir` fields and fall back to local haversine maths.
 */

import {
  EMPTY,
  altitudeFt,
  formatAltitude,
  formatCategory,
  formatCount,
  formatDistance,
  formatLatLon,
  formatRate,
  formatRssi,
  formatSeen,
  formatSquawk,
  formatSpeed,
  formatTrack,
  isEmergencySquawk,
  label,
} from "../lib/format";
import { bearingDeg, haversineNm } from "../lib/geo";
import type { Aircraft, Receiver } from "../lib/types";

function num(value: number | undefined, suffix: string, digits = 0): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return EMPTY;
  return `${value.toFixed(digits)}${suffix}`;
}

function heading(value: number | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return EMPTY;
  const normalized = ((value % 360) + 360) % 360;
  return `${normalized.toFixed(0)}°`;
}

function distanceFor(aircraft: Aircraft, receiver: Receiver | null): string {
  if (typeof aircraft.dst === "number") return formatDistance(aircraft.dst);
  const lat = aircraft.lat;
  const lon = aircraft.lon;
  const rLat = receiver?.lat;
  const rLon = receiver?.lon;
  if (
    typeof lat === "number" &&
    typeof lon === "number" &&
    typeof rLat === "number" &&
    typeof rLon === "number"
  ) {
    return formatDistance(haversineNm(rLat, rLon, lat, lon));
  }
  return EMPTY;
}

function bearingFor(aircraft: Aircraft, receiver: Receiver | null): string {
  if (typeof aircraft.dir === "number") return `${aircraft.dir.toFixed(0)}°`;
  const lat = aircraft.lat;
  const lon = aircraft.lon;
  const rLat = receiver?.lat;
  const rLon = receiver?.lon;
  if (
    typeof lat === "number" &&
    typeof lon === "number" &&
    typeof rLat === "number" &&
    typeof rLon === "number"
  ) {
    return `${bearingDeg(rLat, rLon, lat, lon).toFixed(0)}°`;
  }
  return EMPTY;
}

function joinList(values: string[] | undefined): string {
  if (values === undefined || values.length === 0) return EMPTY;
  return values.join(", ");
}

/** Fill the drawer; `aircraft === null` hides it. */
export function renderDrawer(
  root: HTMLElement,
  aircraft: Aircraft | null,
  receiver: Receiver | null,
): void {
  if (aircraft === null) {
    root.hidden = true;
    return;
  }
  root.hidden = false;

  const title = root.querySelector<HTMLElement>("#drawer-title");
  const fields = root.querySelector<HTMLElement>("#drawer-fields");
  if (title === null || fields === null) return;

  title.textContent = `${label(aircraft)} · ${aircraft.hex.toUpperCase()}`;
  if (isEmergencySquawk(aircraft.squawk)) title.classList.add("alarm");
  else title.classList.remove("alarm");

  const aircraftType = typeof aircraft.type === "string" ? aircraft.type : "";
  const shortType = typeof aircraft.t === "string" ? aircraft.t : "";
  const rows: Array<[string, string]> = [
    ["ICAO hex", aircraft.hex.toUpperCase()],
    ["Registration", typeof aircraft.r === "string" ? aircraft.r : EMPTY],
    ["Type", aircraftType.trim() !== "" ? aircraftType : shortType.trim() !== "" ? shortType : EMPTY],
    ["Category", formatCategory(aircraft.category)],
    ["Squawk", formatSquawk(aircraft.squawk)],
    ["Altitude", formatAltitude(aircraft.alt_baro)],
    ["Geometric alt", typeof aircraft.alt_geom === "number" ? formatAltitude(aircraft.alt_geom) : EMPTY],
    ["Calc. altitude", formatAltitude(altitudeFt(aircraft) ?? undefined)],
    ["Ground speed", formatSpeed(aircraft.gs)],
    ["IAS / TAS", `${num(aircraft.ias, " kt")} / ${num(aircraft.tas, " kt")}`],
    ["Mach", num(aircraft.mach, "", 3)],
    ["Track", formatTrack(aircraft.track)],
    ["Heading (mag)", heading(aircraft.mag_heading)],
    ["Vertical rate", formatRate(aircraft.baro_rate)],
    ["Position", formatLatLon(aircraft.lat, aircraft.lon)],
    ["Distance", distanceFor(aircraft, receiver)],
    ["Bearing", bearingFor(aircraft, receiver)],
    ["Nav modes", joinList(aircraft.nav_modes)],
    ["Messages", formatCount(aircraft.messages)],
    ["Signal", formatRssi(aircraft.rssi)],
    ["Seen", formatSeen(aircraft.seen)],
    ["Last position", formatSeen(aircraft.seen_pos)],
    ["MLAT / TIS-B", `${joinList(aircraft.mlat)} / ${joinList(aircraft.tisb)}`],
  ];

  const fragment = document.createDocumentFragment();
  for (const [term, value] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value;
    fragment.append(dt, dd);
  }
  fields.replaceChildren(fragment);
}
