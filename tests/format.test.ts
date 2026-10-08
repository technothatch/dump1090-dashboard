import { describe, expect, it } from "vitest";
import {
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
  isEmergency,
  isEmergencySquawk,
  label,
} from "../src/lib/format";
import type { Aircraft } from "../src/lib/types";

function plane(overrides: Partial<Aircraft> = {}): Aircraft {
  return { hex: "abc123", ...overrides };
}

describe("altitude helpers", () => {
  it("treats \"ground\" as 0 feet and falls back to alt_geom", () => {
    expect(altitudeFt(plane({ alt_baro: "ground" }))).toBe(0);
    expect(altitudeFt(plane({ alt_baro: 12500 }))).toBe(12500);
    expect(altitudeFt(plane({ alt_geom: 34000 }))).toBe(34000);
    expect(altitudeFt(plane())).toBeNull();
    expect(altitudeFt(plane({ alt_baro: "ground", alt_geom: 900 }))).toBe(0);
  });

  it("formats altitudes, ground and missing values", () => {
    expect(formatAltitude(12500)).toBe("12,500 ft");
    expect(formatAltitude(-500)).toBe("-500 ft");
    expect(formatAltitude("ground")).toBe("GROUND");
    expect(formatAltitude(undefined)).toBe("—");
    expect(formatAltitude(Number.NaN)).toBe("—");
  });
});

describe("movement formatters", () => {
  it("formats ground speed", () => {
    expect(formatSpeed(412.4)).toBe("412 kt");
    expect(formatSpeed(undefined)).toBe("—");
  });

  it("normalises track into [0, 360)", () => {
    expect(formatTrack(274.4)).toBe("274°");
    expect(formatTrack(-10)).toBe("350°");
    expect(formatTrack(370)).toBe("10°");
    expect(formatTrack(undefined)).toBe("—");
  });

  it("signs vertical rates", () => {
    expect(formatRate(800)).toBe("+800 fpm");
    expect(formatRate(-1200)).toBe("-1200 fpm");
    expect(formatRate(0)).toBe("0 fpm");
    expect(formatRate(undefined)).toBe("—");
  });
});

describe("identification formatters", () => {
  it("formats squawks and recognises emergency codes", () => {
    expect(formatSquawk("7700")).toBe("7700");
    expect(formatSquawk(" 1200 ")).toBe("1200");
    expect(formatSquawk(undefined)).toBe("—");
    expect(formatSquawk("   ")).toBe("—");
    expect(isEmergencySquawk("7500")).toBe(true);
    expect(isEmergencySquawk("7600")).toBe(true);
    expect(isEmergencySquawk("7700")).toBe(true);
    expect(isEmergencySquawk("1200")).toBe(false);
    expect(isEmergencySquawk(undefined)).toBe(false);
  });

  it("flags emergencies from squawk or emergency field", () => {
    expect(isEmergency(plane({ squawk: "7700" }))).toBe(true);
    expect(isEmergency(plane({ emergency: "unlawful_communication" }))).toBe(true);
    expect(isEmergency(plane({ emergency: "none" }))).toBe(false);
    expect(isEmergency(plane())).toBe(false);
  });

  it("labels with the callsign, falling back to the hex", () => {
    expect(label(plane({ flight: "UAL123  " }))).toBe("UAL123");
    expect(label(plane())).toBe("ABC123");
    expect(label(plane({ flight: "   " }))).toBe("ABC123");
  });
});

describe("numeric formatters", () => {
  it("formats distance, signal, counts and coordinates", () => {
    expect(formatDistance(34.2)).toBe("34.2 NM");
    expect(formatDistance(undefined)).toBe("—");
    expect(formatRssi(-13.44)).toBe("-13.4 dB");
    expect(formatRssi(undefined)).toBe("—");
    expect(formatCount(1234567)).toBe("1,234,567");
    expect(formatCount(undefined)).toBe("—");
    expect(formatLatLon(51.5074, -0.1278)).toBe("51.5074, -0.1278");
    expect(formatLatLon(undefined, -0.1278)).toBe("—");
  });

  it("formats ages at second, minute and hour granularity", () => {
    expect(formatSeen(42)).toBe("42s");
    expect(formatSeen(185)).toBe("3m 05s");
    expect(formatSeen(4500)).toBe("1h 15m");
    expect(formatSeen(-1)).toBe("—");
    expect(formatSeen(undefined)).toBe("—");
  });
});

describe("formatCategory", () => {
  it("describes air, surface, vehicle and ground categories", () => {
    expect(formatCategory("A3")).toBe("A3 · air, large");
    expect(formatCategory("a1")).toBe("A1 · air, light");
    expect(formatCategory("B2")).toBe("B2 · surface");
    expect(formatCategory("C0")).toBe("C0 · vehicle");
    expect(formatCategory("D1")).toBe("D1 · ground");
  });

  it("passes unknown codes through and renders missing ones as a dash", () => {
    expect(formatCategory("Z9")).toBe("Z9");
    expect(formatCategory("")).toBe("—");
    expect(formatCategory(undefined)).toBe("—");
  });
});
