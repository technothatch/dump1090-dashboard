/**
 * Types for the dump1090 / readsb `aircraft.json` / `receiver.json` payloads.
 *
 * Field semantics follow the documents produced by dump1090-fa and readsb with
 * `--write-json` (and the servers behind tar1090):
 *
 * - `http://HOST/data/aircraft.json`
 * - `http://HOST/data/receiver.json`
 *
 * Every field except `hex` is optional, `alt_baro` is a number **or** the
 * string `"ground"`, and decoders add keys between releases — the index
 * signature keeps unknown keys (and extra fields) fully tolerated.
 */

/** An aircraft object from `aircraft.json`. Only `hex` is guaranteed. */
export interface Aircraft {
  /** ICAO 24-bit address, lowercase hex. Non-ICAO addresses start with `~`. */
  hex: string;
  /** Aircraft type designator (`A320`, `B738`, ...) when decoded from the DB. */
  type?: string;
  /** Callsign / flight identity, trimmed. */
  flight?: string;
  /** Barometric altitude in feet, or `"ground"` for surface positions. */
  alt_baro?: number | "ground";
  /** Geometric altitude in feet. */
  alt_geom?: number;
  /** Ground speed in knots. */
  gs?: number;
  /** Indicated airspeed in knots. */
  ias?: number;
  /** True airspeed in knots. */
  tas?: number;
  /** Mach number. */
  mach?: number;
  /** True track in degrees. */
  track?: number;
  /** Track rate in degrees per second. */
  track_rate?: number;
  /** Bank angle in degrees. */
  roll?: number;
  /** Magnetic heading in degrees. */
  mag_heading?: number;
  /** True heading in degrees. */
  true_heading?: number;
  /** Barometric vertical rate in feet per minute (negative = descent). */
  baro_rate?: number;
  /** Geometric vertical rate in feet per minute. */
  geom_rate?: number;
  /** Mode A squawk — four octal digits as a string (`"7700"`). */
  squawk?: string;
  /** Emergency state, `"none"` when clear. */
  emergency?: string;
  /** Emitter category (`A0`–`A7` air, `B0`–`B7` surface, `C0`–`C7` vehicle, `D0`–`D7` fixed ground). */
  category?: string;
  /** Altimeter setting in hPa. */
  nav_qnh?: number;
  /** MCP/selected altitude in feet. */
  nav_altitude_mcp?: number;
  /** FMS altitude in feet. */
  nav_altitude_fms?: number;
  /** Selected/heading bug in degrees. */
  nav_heading?: number;
  /** Active navigation modes (`+NAV`, `AP`, ...). */
  nav_modes?: string[];
  /** Latitude, decimal degrees. */
  lat?: number;
  /** Longitude, decimal degrees. */
  lon?: number;
  /** Navigation integrity category for the position. */
  nic?: number;
  /** Navigation containment radius in metres. */
  rc?: number;
  /** Age of the last position, seconds. */
  seen_pos?: number;
  /** ADS-B version (0/1/2). */
  version?: number;
  /** Barometric integrity category. */
  nic_baro?: number;
  /** Navigation accuracy for position (NACp). */
  nac_p?: number;
  /** Navigation accuracy for velocity (NACv). */
  nac_v?: number;
  /** Surveillance integrity level. */
  sil?: number;
  /** SIL type (`single` / `coupled`). */
  sil_type?: string;
  /** Geometry vertical accuracy. */
  gva?: number;
  /** Source, designator and assurance. */
  sda?: number;
  /** Markers indicating the position came from MLAT. */
  mlat?: string[];
  /** Markers indicating the position came from TIS-B. */
  tisb?: string[];
  /** Messages received from this aircraft. */
  messages?: number;
  /** Age of the last message, seconds. */
  seen?: number;
  /** Signal strength in dBFS (negative). */
  rssi?: number;
  /** Alerting active. */
  alert?: number;
  /** Special position identification. */
  spi?: number;
  /** Wind direction, degrees. */
  wd?: number;
  /** Wind speed, knots. */
  ws?: number;
  /** Outside air temperature, °C. */
  oat?: number;
  /** Total air temperature, °C. */
  tat?: number;
  /** Distance from the receiver, nautical miles. */
  dst?: number;
  /** Bearing from the receiver, degrees. */
  dir?: number;
  /** Registration, without the `N`/`D`/`G` prefix handling. */
  r?: string;
  /** ICAO type designator (short form). */
  t?: string;
  /** Database flags (readsb). */
  dbFlags?: number;
  /** Last cached position (older dumps / some builds). */
  lastPosition?: {
    lat: number;
    lon: number;
    seen_pos?: number;
    nic?: number;
    rc?: number;
  };
  /** Receiver-local latitude (receiver.json style fields leaking into aircraft). */
  rr_lat?: number;
  /** Receiver-local longitude. */
  rr_lon?: number;
  /** Unknown extra fields are preserved verbatim. */
  [key: string]: unknown;
}

/** Envelope of `aircraft.json`. */
export interface AircraftResponse {
  /** Wall-clock time of the snapshot, unix seconds. */
  now: number;
  /** Total messages the decoder has seen. */
  messages: number;
  /** Aircraft in this snapshot. */
  aircraft: Aircraft[];
}

/** `receiver.json` — the receiver's own position and refresh period. */
export interface Receiver {
  /** Decoder version string (`dump1090-fa 7.1`, `readsb ...`). */
  version?: string;
  /** JSON refresh period, seconds. */
  refresh?: number;
  /** Receiver latitude, decimal degrees. */
  lat?: number;
  /** Receiver longitude, decimal degrees. */
  lon?: number;
  /** Unknown extra fields are preserved verbatim. */
  [key: string]: unknown;
}

/** Connection state shown in the status pill. */
export type ConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

/** UI colour scheme. */
export type Theme = "dark" | "light";

/** Sortable table columns. */
export type SortKey =
  | "flight"
  | "hex"
  | "alt"
  | "gs"
  | "track"
  | "squawk"
  | "dst"
  | "rssi"
  | "messages"
  | "seen";

/** Sort direction. */
export type SortDir = "asc" | "desc";
