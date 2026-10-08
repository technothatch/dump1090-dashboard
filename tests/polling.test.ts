import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adaptiveInterval,
  backoffInterval,
  createPoller,
  MAX_INTERVAL_MS,
  MIN_INTERVAL_MS,
} from "../src/lib/polling";
import type { FetchLike, FetchLikeResponse, PollUpdate, PollingOptions } from "../src/lib/polling";
import type { ConnectionStatus } from "../src/lib/types";

const AIRCRAFT_URL = "/data/aircraft.json";
const RECEIVER_URL = "/data/receiver.json";

function ok(data: unknown): FetchLikeResponse {
  return { ok: true, status: 200, json: async () => data };
}

function httpError(status: number): FetchLikeResponse {
  return { ok: false, status, json: async () => ({ error: status }) };
}

function aircraftDoc(count: number): unknown {
  return {
    now: 1728000000,
    messages: 4242,
    aircraft: Array.from({ length: count }, (_, index) => ({
      hex: index.toString(16).padStart(6, "0"),
      flight: `TST${index}`,
      lat: 51.5,
      lon: -0.12,
    })),
  };
}

const RECEIVER_DOC: unknown = { version: "readsb 4.0", refresh: 1, lat: 51.5, lon: -0.12 };

/**
 * Advance fake timers and then drain every pending microtask, so the
 * fire-and-forget `cycle()` chains inside the poller have fully settled.
 */
async function settle(ms = 0): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
}

interface Harness {
  fetchFn: ReturnType<typeof vi.fn<FetchLike>>;
  updates: PollUpdate[];
  statuses: Array<{ status: ConnectionStatus; error: string | null }>;
  options: PollingOptions;
}

function harness(fetchImpl: FetchLike, overrides: Partial<PollingOptions> = {}): Harness {
  const fetchFn = vi.fn<FetchLike>(fetchImpl);
  const updates: PollUpdate[] = [];
  const statuses: Array<{ status: ConnectionStatus; error: string | null }> = [];
  const options: PollingOptions = {
    aircraftUrl: AIRCRAFT_URL,
    receiverUrl: RECEIVER_URL,
    onUpdate: (update) => updates.push(update),
    onStatus: (status, error) => statuses.push({ status, error: error ?? null }),
    deps: { fetchFn },
    ...overrides,
  };
  return { fetchFn, updates, statuses, options };
}

/** Decoder-flavoured fetch: picks the document by URL. */
function decoderFetch(count: number): FetchLike {
  return async (url) =>
    url.endsWith("receiver.json") ? ok(RECEIVER_DOC) : ok(aircraftDoc(count));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("adaptiveInterval", () => {
  it("polls the slowest when the sky is empty", () => {
    expect(adaptiveInterval(0)).toBe(MAX_INTERVAL_MS);
    expect(adaptiveInterval(-3)).toBe(MAX_INTERVAL_MS);
    expect(adaptiveInterval(Number.NaN)).toBe(MAX_INTERVAL_MS);
  });

  it("polls the fastest once traffic is heavy", () => {
    expect(adaptiveInterval(99)).toBe(MIN_INTERVAL_MS);
    expect(adaptiveInterval(500)).toBe(MIN_INTERVAL_MS);
  });

  it("stays monotonic between the bounds", () => {
    const counts = [1, 5, 9, 25, 60, 99];
    const intervals = counts.map((count) => adaptiveInterval(count));
    for (let i = 1; i < intervals.length; i += 1) {
      expect(intervals[i]).toBeLessThanOrEqual(intervals[i - 1] as number);
    }
    expect(intervals.every((value) => value >= MIN_INTERVAL_MS && value <= MAX_INTERVAL_MS)).toBe(
      true,
    );
    expect(adaptiveInterval(9)).toBe(2750);
  });

  it("honours custom bounds", () => {
    expect(adaptiveInterval(0, 1000, 2000)).toBe(2000);
    expect(adaptiveInterval(500, 1000, 2000)).toBe(1000);
    expect(adaptiveInterval(9, 2000, 1000)).toBe(1500);
  });
});

describe("backoffInterval", () => {
  it("doubles per consecutive failure", () => {
    expect(backoffInterval(1)).toBe(1000);
    expect(backoffInterval(2)).toBe(2000);
    expect(backoffInterval(4)).toBe(8000);
    expect(backoffInterval(0)).toBe(1000);
  });

  it("caps at the ceiling", () => {
    expect(backoffInterval(10)).toBe(15000);
    expect(backoffInterval(3, 1000, 3000)).toBe(3000);
  });
});

describe("createPoller — success path", () => {
  it("fetches both documents, reports live and adapts the interval", async () => {
    const { fetchFn, updates, statuses, options } = harness(decoderFetch(10));
    const poller = createPoller(options);

    poller.start();
    await settle();

    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(poller.status()).toBe("live");
    expect(poller.failures()).toBe(0);
    expect(poller.isRunning()).toBe(true);
    expect(statuses).toEqual([{ status: "live", error: null }]);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.aircraft.aircraft).toHaveLength(10);
    expect(updates[0]?.receiver?.version).toBe("readsb 4.0");
    expect(poller.interval()).toBe(adaptiveInterval(10));

    poller.stop();
  });

  it("re-polls on the adaptive schedule", async () => {
    const { fetchFn, options } = harness(decoderFetch(0));
    const poller = createPoller(options);

    poller.start();
    await settle();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(poller.interval()).toBe(MAX_INTERVAL_MS);

    await settle(poller.interval());
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(vi.getTimerCount()).toBe(1);

    poller.stop();
    expect(vi.getTimerCount()).toBe(0);
    await settle(60_000);
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(poller.isRunning()).toBe(false);
  });

  it("keeps the last known receiver when a later receiver poll fails", async () => {
    let receiverFails = false;
    const fetchFn = vi.fn<FetchLike>(async (url) => {
      if (url.endsWith("receiver.json")) {
        if (receiverFails) throw new Error("receiver gone");
        return ok(RECEIVER_DOC);
      }
      return ok(aircraftDoc(1));
    });
    const updates: PollUpdate[] = [];
    const poller = createPoller({
      aircraftUrl: AIRCRAFT_URL,
      receiverUrl: RECEIVER_URL,
      onUpdate: (update) => updates.push(update),
      onStatus: () => {},
      deps: { fetchFn },
    });

    await poller.runOnce();
    expect(updates[0]?.receiver?.version).toBe("readsb 4.0");

    receiverFails = true;
    await poller.runOnce();
    expect(poller.status()).toBe("live");
    expect(poller.failures()).toBe(0);
    expect(updates[1]?.receiver?.version).toBe("readsb 4.0");
  });

  it("ignores a malformed receiver.json while staying live", async () => {
    const fetchFn = vi.fn<FetchLike>(async (url) =>
      url.endsWith("receiver.json") ? ok("not an object") : ok(aircraftDoc(2)),
    );
    const updates: PollUpdate[] = [];
    const statuses: string[] = [];
    const poller = createPoller({
      aircraftUrl: AIRCRAFT_URL,
      receiverUrl: RECEIVER_URL,
      onUpdate: (update) => updates.push(update),
      onStatus: (status) => statuses.push(status),
      deps: { fetchFn },
    });

    await poller.runOnce();
    expect(statuses).toEqual(["live"]);
    expect(updates[0]?.receiver).toBeNull();
    expect(updates[0]?.aircraft.aircraft).toHaveLength(2);
  });

  it("pins the interval when fixedIntervalMs is set", async () => {
    const { updates, options } = harness(decoderFetch(0), { fixedIntervalMs: 2000 });
    const poller = createPoller(options);

    await poller.runOnce();
    expect(poller.interval()).toBe(2000);
    expect(updates[0]?.intervalMs).toBe(2000);
  });
});

describe("createPoller — failure path", () => {
  it("switches to reconnecting with a backoff on HTTP errors", async () => {
    const { fetchFn, statuses, options } = harness(async () => httpError(500));
    const poller = createPoller(options);

    await poller.runOnce();
    expect(poller.status()).toBe("reconnecting");
    expect(poller.failures()).toBe(1);
    expect(poller.interval()).toBe(backoffInterval(1));
    expect(statuses.at(-1)?.status).toBe("reconnecting");
    expect(statuses.at(-1)?.error).toContain("HTTP 500");
    expect(fetchFn).toHaveBeenCalled();
  });

  it("handles network rejections", async () => {
    const { statuses, options } = harness(async () => {
      throw new TypeError("fetch failed");
    });
    const poller = createPoller(options);

    await poller.runOnce();
    expect(poller.status()).toBe("reconnecting");
    expect(statuses.at(-1)?.error).toBe("fetch failed");
  });

  it("treats a non-object aircraft.json as a failure", async () => {
    const { statuses, options } = harness(async (url) =>
      url.endsWith("receiver.json") ? ok(RECEIVER_DOC) : ok([]),
    );
    const poller = createPoller(options);

    await poller.runOnce();
    expect(poller.status()).toBe("reconnecting");
    expect(statuses.at(-1)?.error).toContain("expected an object");
  });

  it("grows the delay and flips to offline after repeated failures", async () => {
    const { statuses, options } = harness(async () => {
      throw new Error("down");
    });
    const poller = createPoller(options);

    await poller.runOnce();
    expect(poller.interval()).toBe(1000);
    await poller.runOnce();
    expect(poller.interval()).toBe(2000);
    await poller.runOnce();
    expect(poller.interval()).toBe(4000);
    expect(poller.status()).toBe("reconnecting");

    await poller.runOnce();
    expect(poller.interval()).toBe(8000);
    await poller.runOnce();
    expect(poller.status()).toBe("offline");
    expect(poller.failures()).toBe(5);
    expect(poller.interval()).toBe(15_000);
    expect(statuses.map((entry) => entry.status)).toEqual([
      "reconnecting",
      "reconnecting",
      "reconnecting",
      "reconnecting",
      "offline",
    ]);
  });

  it("recovers to live and resets the failure counter", async () => {
    let fail = true;
    const fetchFn = vi.fn<FetchLike>(async (url) => {
      if (fail) throw new Error("blip");
      return url.endsWith("receiver.json") ? ok(RECEIVER_DOC) : ok(aircraftDoc(4));
    });
    const statuses: ConnectionStatus[] = [];
    const poller = createPoller({
      aircraftUrl: AIRCRAFT_URL,
      receiverUrl: RECEIVER_URL,
      onUpdate: () => {},
      onStatus: (status) => statuses.push(status),
      deps: { fetchFn },
    });

    await poller.runOnce();
    expect(poller.status()).toBe("reconnecting");

    fail = false;
    await poller.runOnce();
    expect(poller.status()).toBe("live");
    expect(poller.failures()).toBe(0);
    expect(poller.interval()).toBe(adaptiveInterval(4));
    expect(statuses).toEqual(["reconnecting", "live"]);
  });

  it("backs off on the real schedule between failing polls", async () => {
    const { fetchFn, options } = harness(async () => {
      throw new Error("down");
    });
    const poller = createPoller(options);

    poller.start();
    await settle();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(poller.interval()).toBe(1000);

    await settle(999);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    await settle(1);
    expect(fetchFn).toHaveBeenCalledTimes(4);
    expect(poller.interval()).toBe(2000);

    poller.stop();
  });

  it("start() is idempotent and runOnce() never schedules", async () => {
    const { fetchFn, options } = harness(decoderFetch(1));
    const poller = createPoller(options);

    poller.start();
    poller.start();
    await settle();
    expect(fetchFn).toHaveBeenCalledTimes(2);

    poller.stop();
    fetchFn.mockClear();
    await poller.runOnce();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    await settle(60_000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
