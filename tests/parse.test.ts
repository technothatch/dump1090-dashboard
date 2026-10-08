import { describe, expect, it } from "vitest";
import { parseAircraft, parseAircraftResponse, parseReceiver } from "../src/lib/parse";

describe("parseAircraft", () => {
  it("normalises the hex and keeps valid fields", () => {
    const parsed = parseAircraft({
      hex: " 4CA1D8 ",
      flight: "RYR8AB ",
      gs: 420.5,
      track: 128.3,
      alt_baro: 34000,
      squawk: "1234",
      lat: 51.5,
      lon: -0.12,
      rssi: -3.2,
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.hex).toBe("4ca1d8");
    expect(parsed?.flight).toBe("RYR8AB ");
    expect(parsed?.gs).toBe(420.5);
    expect(parsed?.lat).toBe(51.5);
  });

  it("rejects entries without a usable hex", () => {
    expect(parseAircraft(null)).toBeNull();
    expect(parseAircraft("4ca1d8")).toBeNull();
    expect(parseAircraft(42)).toBeNull();
    expect(parseAircraft({})).toBeNull();
    expect(parseAircraft({ hex: "   " })).toBeNull();
  });

  it("drops wrongly typed known fields but keeps the rest", () => {
    const parsed = parseAircraft({
      hex: "abc123",
      gs: "fast",
      lat: null,
      messages: "lots",
      seen: 3,
      squawk: 1234,
      flight: 7,
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.gs).toBeUndefined();
    expect(parsed?.lat).toBeUndefined();
    expect(parsed?.messages).toBeUndefined();
    expect(parsed?.squawk).toBeUndefined();
    expect(parsed?.flight).toBeUndefined();
    expect(parsed?.seen).toBe(3);
  });

  it("accepts \"ground\" and non-finite numbers are dropped", () => {
    expect(parseAircraft({ hex: "abc", alt_baro: "ground" })?.alt_baro).toBe("ground");
    expect(parseAircraft({ hex: "abc", alt_baro: "FL350" })?.alt_baro).toBeUndefined();
    expect(parseAircraft({ hex: "abc", gs: Number.POSITIVE_INFINITY })?.gs).toBeUndefined();
  });

  it("keeps unknown extra fields and validates list fields", () => {
    const parsed = parseAircraft({
      hex: "abc",
      someFutureKey: { nested: true },
      mlat: ["mlat"],
      tisb: "nope",
      nav_modes: ["+NAV", "AP"],
      lastPosition: { lat: 1, lon: 2 },
    });
    expect(parsed?.someFutureKey).toEqual({ nested: true });
    expect(parsed?.mlat).toEqual(["mlat"]);
    expect(parsed?.tisb).toBeUndefined();
    expect(parsed?.nav_modes).toEqual(["+NAV", "AP"]);
    expect(parsed?.lastPosition).toEqual({ lat: 1, lon: 2 });
    expect(parseAircraft({ hex: "abc", lastPosition: { lat: "x" } })?.lastPosition).toBeUndefined();
  });
});

describe("parseAircraftResponse", () => {
  it("reads now/messages and parses every aircraft", () => {
    const parsed = parseAircraftResponse({
      now: 1728000000.5,
      messages: 123456,
      aircraft: [{ hex: "aa1111" }, { hex: "bb2222", gs: 300 }],
    });
    expect(parsed.now).toBe(1728000000.5);
    expect(parsed.messages).toBe(123456);
    expect(parsed.aircraft).toHaveLength(2);
    expect(parsed.aircraft[1]?.gs).toBe(300);
  });

  it("skips malformed entries instead of failing the poll", () => {
    const parsed = parseAircraftResponse({
      now: 1,
      messages: 2,
      aircraft: [{ hex: "aa1111" }, null, "junk", 42, { nope: true }],
    });
    expect(parsed.aircraft).toHaveLength(1);
    expect(parsed.aircraft[0]?.hex).toBe("aa1111");
  });

  it("treats a missing or non-array aircraft key as an empty snapshot", () => {
    expect(parseAircraftResponse({ now: 1, messages: 2 }).aircraft).toEqual([]);
    expect(parseAircraftResponse({}).now).toBe(0);
    expect(parseAircraftResponse({ aircraft: "nope" }).messages).toBe(0);
  });

  it("throws on a non-object document root", () => {
    expect(() => parseAircraftResponse(null)).toThrow(TypeError);
    expect(() => parseAircraftResponse([])).toThrow(TypeError);
    expect(() => parseAircraftResponse("<html>502</html>")).toThrow(TypeError);
  });
});

describe("parseReceiver", () => {
  it("reads version, refresh and position", () => {
    expect(parseReceiver({ version: "readsb 4.0", refresh: 1, lat: 51.5, lon: -0.12 })).toEqual({
      version: "readsb 4.0",
      refresh: 1,
      lat: 51.5,
      lon: -0.12,
    });
  });

  it("drops fields of the wrong type", () => {
    expect(parseReceiver({ version: 7, lat: "51.5", lon: -0.12 })).toEqual({ lon: -0.12 });
  });

  it("returns null for non-object roots", () => {
    expect(parseReceiver(null)).toBeNull();
    expect(parseReceiver("receiver")).toBeNull();
    expect(parseReceiver([1, 2])).toBeNull();
  });

  it("returns an empty receiver for an empty object", () => {
    expect(parseReceiver({})).toEqual({});
  });
});
