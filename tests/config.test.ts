import { describe, expect, it } from "vitest";
import {
  buildDataUrl,
  DEFAULT_DATA_URL,
  normalizeDataUrl,
  parseDashboardParams,
} from "../src/lib/config";
import { MAX_INTERVAL_MS, MIN_INTERVAL_MS } from "../src/lib/polling";

describe("normalizeDataUrl", () => {
  it("defaults to the relative /data/ path", () => {
    expect(normalizeDataUrl("")).toBe(DEFAULT_DATA_URL);
    expect(normalizeDataUrl("   ")).toBe(DEFAULT_DATA_URL);
    expect(DEFAULT_DATA_URL).toBe("/data/");
  });

  it("ensures exactly one trailing slash", () => {
    expect(normalizeDataUrl("/data")).toBe("/data/");
    expect(normalizeDataUrl("/data///")).toBe("/data/");
    expect(normalizeDataUrl("  http://pi:8080/data  ")).toBe("http://pi:8080/data/");
    expect(normalizeDataUrl("data/")).toBe("data/");
  });
});

describe("buildDataUrl", () => {
  it("joins base and document name", () => {
    expect(buildDataUrl("/data/", "aircraft.json")).toBe("/data/aircraft.json");
    expect(buildDataUrl("/data", "receiver.json")).toBe("/data/receiver.json");
    expect(buildDataUrl("http://pi:8080/data/", "/aircraft.json")).toBe(
      "http://pi:8080/data/aircraft.json",
    );
  });
});

describe("parseDashboardParams", () => {
  it("returns defaults for an empty query string", () => {
    expect(parseDashboardParams("")).toEqual({
      dataUrl: "/data/",
      theme: null,
      intervalMs: null,
    });
    expect(parseDashboardParams("?utm_source=x")).toEqual({
      dataUrl: "/data/",
      theme: null,
      intervalMs: null,
    });
  });

  it("reads the data base URL", () => {
    expect(parseDashboardParams("?data=http://pi:8080/data").dataUrl).toBe(
      "http://pi:8080/data/",
    );
    expect(parseDashboardParams("?data=/tar1090/data/").dataUrl).toBe("/tar1090/data/");
    expect(parseDashboardParams("?data=").dataUrl).toBe("/data/");
  });

  it("reads a valid theme and rejects anything else", () => {
    expect(parseDashboardParams("?theme=light").theme).toBe("light");
    expect(parseDashboardParams("?theme=dark").theme).toBe("dark");
    expect(parseDashboardParams("?theme=neon").theme).toBeNull();
    expect(parseDashboardParams("").theme).toBeNull();
  });

  it("clamps the poll interval into the adaptive bounds", () => {
    expect(parseDashboardParams("?interval=2500").intervalMs).toBe(2500);
    expect(parseDashboardParams("?interval=100").intervalMs).toBe(MIN_INTERVAL_MS);
    expect(parseDashboardParams("?interval=999999").intervalMs).toBe(MAX_INTERVAL_MS);
    expect(parseDashboardParams("?interval=abc").intervalMs).toBeNull();
    expect(parseDashboardParams("").intervalMs).toBeNull();
  });
});
