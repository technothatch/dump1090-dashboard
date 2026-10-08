/**
 * Rolling per-aircraft trail buffer.
 *
 * Positions are appended as snapshots arrive; eviction happens in two
 * dimensions so the map can draw trails without a setKey on the browser's
 * heap: a hard per-aircraft capacity **and** a maximum age (stale points from
 * an aircraft that left coverage are dropped).
 */

/** One recorded position. */
export interface TrailPoint {
  lat: number;
  lon: number;
  /** Receipt time, milliseconds since epoch. */
  t: number;
}

/** Buffer tuning. */
export interface TrailOptions {
  /** Maximum points kept per aircraft (default 60). */
  capacity?: number;
  /** Maximum point age in milliseconds (default 15 minutes). */
  maxAgeMs?: number;
}

/** Default per-aircraft point cap. */
export const DEFAULT_TRAIL_CAPACITY = 60;

/** Default trail retention: 15 minutes. */
export const DEFAULT_TRAIL_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Fixed-size, time-bounded trail storage keyed by ICAO hex.
 */
export class TrailBuffer {
  readonly capacity: number;
  readonly maxAgeMs: number;
  #points = new Map<string, TrailPoint[]>();

  constructor(options: TrailOptions = {}) {
    const capacity = options.capacity ?? DEFAULT_TRAIL_CAPACITY;
    this.capacity = Math.max(1, Math.floor(capacity));
    const maxAgeMs = options.maxAgeMs ?? DEFAULT_TRAIL_MAX_AGE_MS;
    this.maxAgeMs = Math.max(0, maxAgeMs);
  }

  /**
   * Record a position for `hex`. Consecutive identical positions are
   * deduplicated (the timestamp of the kept point is refreshed instead).
   */
  record(hex: string, lat: number, lon: number, t: number): void {
    const list = this.#points.get(hex) ?? [];
    const last = list[list.length - 1];
    if (last !== undefined && last.lat === lat && last.lon === lon) {
      last.t = t;
      return;
    }
    list.push({ lat, lon, t });
    while (list.length > this.capacity) list.shift();
    this.#points.set(hex, list);
    this.prune(t);
  }

  /** Copy of the trail for `hex` (empty when unknown). */
  get(hex: string): TrailPoint[] {
    const list = this.#points.get(hex);
    return list === undefined ? [] : list.slice();
  }

  /** Drop points older than `maxAgeMs` relative to `now`. Returns dropped count. */
  prune(now: number): number {
    let dropped = 0;
    for (const [hex, list] of this.#points) {
      let start = 0;
      while (start < list.length && now - (list[start]?.t ?? now) > this.maxAgeMs) start += 1;
      if (start > 0) {
        dropped += start;
        const kept = list.slice(start);
        if (kept.length === 0) this.#points.delete(hex);
        else this.#points.set(hex, kept);
      }
    }
    return dropped;
  }

  /** Forget one hex, or every trail when `hex` is omitted. */
  clear(hex?: string): void {
    if (hex === undefined) this.#points.clear();
    else this.#points.delete(hex);
  }

  /** Hexes that currently have at least one point. */
  hexes(): string[] {
    return [...this.#points.keys()];
  }

  /** Total number of stored points across all trails. */
  size(): number {
    let total = 0;
    for (const list of this.#points.values()) total += list.length;
    return total;
  }
}
