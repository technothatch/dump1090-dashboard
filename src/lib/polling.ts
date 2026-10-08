/**
 * Polling controller: fetch `aircraft.json` + `receiver.json`, adapt the
 * interval to the traffic volume, and reconnect with exponential backoff
 * when the decoder (or its proxy) stops answering.
 *
 * Everything I/O-shaped is injectable (`fetch`, timers, clock) so the whole
 * state machine runs deterministically under Vitest's fake timers.
 */

import { parseAircraftResponse, parseReceiver } from "./parse";
import type { AircraftResponse, ConnectionStatus, Receiver } from "./types";

/** Shape of `fetch` the controller needs (a subset of the DOM/Node type). */
export type FetchLike = (url: string) => Promise<FetchLikeResponse>;

/** Shape of a `fetch` response the controller needs. */
export interface FetchLikeResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

/** Injectable environment (defaults to the globals). */
export interface PollingDeps {
  fetchFn: FetchLike;
  now: () => number;
  setTimeoutFn: (fn: () => void, ms: number) => number;
  clearTimeoutFn: (id: number) => void;
}

/** Data handed to the store after a successful poll. */
export interface PollUpdate {
  aircraft: AircraftResponse;
  receiver: Receiver | null;
  intervalMs: number;
  receivedAt: number;
}

/** Controller configuration. */
export interface PollingOptions {
  /** Absolute or relative URL of `aircraft.json`. */
  aircraftUrl: string;
  /** Absolute or relative URL of `receiver.json`. */
  receiverUrl: string;
  /** Called on every successful poll. */
  onUpdate: (update: PollUpdate) => void;
  /** Called after every cycle (success or failure) with the current status. */
  onStatus: (status: ConnectionStatus, error?: string | null) => void;
  /** Adaptive interval floor, ms (default 500). */
  minIntervalMs?: number;
  /** Adaptive interval ceiling, ms (default 5000). */
  maxIntervalMs?: number;
  /** First reconnect delay, ms (default 1000). */
  backoffBaseMs?: number;
  /** Reconnect delay ceiling, ms (default 15000). */
  backoffMaxMs?: number;
  /** Consecutive failures before the pill flips to `offline` (default 5). */
  offlineAfterFailures?: number;
  /** Pin the interval (disables adaptation); `interval` query parameter. */
  fixedIntervalMs?: number | null;
  /** Injectable environment — tests replace `fetchFn` and the timers. */
  deps?: Partial<PollingDeps>;
}

/** Handle returned by {@link createPoller}. */
export interface Poller {
  /** Begin polling (idempotent). */
  start(): void;
  /** Stop polling and cancel the pending timer (idempotent). */
  stop(): void;
  /** Run exactly one cycle now, without touching the schedule. */
  runOnce(): Promise<void>;
  status(): ConnectionStatus;
  interval(): number;
  failures(): number;
  isRunning(): boolean;
}

/** Fastest adaptive interval, ms. */
export const MIN_INTERVAL_MS = 500;

/** Slowest adaptive interval, ms. */
export const MAX_INTERVAL_MS = 5000;

/**
 * Poll interval for `count` aircraft: `MAX_INTERVAL_MS` with an empty sky,
 * `MIN_INTERVAL_MS` once the sky is busy (`count >= 99`), logarithmic in
 * between so the curve stays useful across 1 → 500 aircraft.
 */
export function adaptiveInterval(
  count: number,
  min: number = MIN_INTERVAL_MS,
  max: number = MAX_INTERVAL_MS,
): number {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  if (!Number.isFinite(count) || count <= 0) return hi;
  const t = Math.min(1, Math.log10(1 + count) / 2);
  return Math.round((hi - (hi - lo) * t) / 50) * 50;
}

/** Exponential reconnect delay: `base * 2^(failures-1)`, capped at `max`. */
export function backoffInterval(
  failures: number,
  base: number = 1000,
  max: number = 15000,
): number {
  const attempt = Math.max(1, Math.floor(failures));
  return Math.min(max, base * 2 ** (attempt - 1));
}

/** Create the controller. It does nothing until {@link Poller.start} is called. */
export function createPoller(options: PollingOptions): Poller {
  const {
    aircraftUrl,
    receiverUrl,
    onUpdate,
    onStatus,
    minIntervalMs = MIN_INTERVAL_MS,
    maxIntervalMs = MAX_INTERVAL_MS,
    backoffBaseMs = 1000,
    backoffMaxMs = 15000,
    offlineAfterFailures = 5,
    fixedIntervalMs = null,
    deps = {},
  } = options;

  const fetchFn: FetchLike =
    deps.fetchFn ?? ((url) => globalThis.fetch(url) as unknown as Promise<FetchLikeResponse>);
  const now = deps.now ?? (() => Date.now());
  const setTimeoutFn =
    deps.setTimeoutFn ?? ((fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number);
  const clearTimeoutFn = deps.clearTimeoutFn ?? ((id) => globalThis.clearTimeout(id));

  let timer: number | null = null;
  let running = false;
  let failures = 0;
  let status: ConnectionStatus = "connecting";
  let intervalMs = fixedIntervalMs ?? maxIntervalMs;
  /** Last good `receiver.json` — kept when a later fetch fails. */
  let receiver: Receiver | null = null;

  async function fetchJson(url: string): Promise<unknown> {
    const response = await fetchFn(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await response.json();
  }

  function schedule(): void {
    if (!running) return;
    if (timer !== null) clearTimeoutFn(timer);
    timer = setTimeoutFn(() => {
      timer = null;
      void cycle();
    }, intervalMs);
  }

  async function cycle(): Promise<void> {
    try {
      const [aircraftRaw, receiverRaw] = await Promise.all([
        fetchJson(aircraftUrl),
        fetchJson(receiverUrl).catch(() => null),
      ]);
      const aircraft = parseAircraftResponse(aircraftRaw);
      const parsedReceiver = receiverRaw === null ? null : parseReceiver(receiverRaw);
      if (parsedReceiver !== null) receiver = parsedReceiver;
      failures = 0;
      intervalMs =
        fixedIntervalMs ?? adaptiveInterval(aircraft.aircraft.length, minIntervalMs, maxIntervalMs);
      status = "live";
      const receivedAt = now();
      onStatus("live", null);
      onUpdate({ aircraft, receiver, intervalMs, receivedAt });
    } catch (error) {
      failures += 1;
      status = failures >= offlineAfterFailures ? "offline" : "reconnecting";
      intervalMs = fixedIntervalMs ?? backoffInterval(failures, backoffBaseMs, backoffMaxMs);
      onStatus(status, error instanceof Error ? error.message : String(error));
    }
    schedule();
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      void cycle();
    },
    stop(): void {
      running = false;
      if (timer !== null) {
        clearTimeoutFn(timer);
        timer = null;
      }
    },
    runOnce(): Promise<void> {
      return cycle();
    },
    status: () => status,
    interval: () => intervalMs,
    failures: () => failures,
    isRunning: () => running,
  };
}
