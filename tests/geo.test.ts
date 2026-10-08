import { describe, expect, it } from "vitest";
import { bearingDeg, haversineNm, normalizeLonDelta } from "../src/lib/geo";

describe("haversineNm", () => {
  it("returns exactly 0 for identical points", () => {
    expect(haversineNm(51.5, -0.12, 51.5, -0.12)).toBe(0);
  });

  it("measures one degree of latitude at about 60 NM", () => {
    expect(haversineNm(0, 0, 1, 0)).toBeCloseTo(60.04, 1);
  });

  it("is symmetric", () => {
    const forward = haversineNm(40.6413, -73.7781, 51.4775, -0.4614);
    const backward = haversineNm(51.4775, -0.4614, 40.6413, -73.7781);
    expect(backward).toBeCloseTo(forward, 9);
  });

  it("puts JFK and LHR about 3006 NM apart", () => {
    const nm = haversineNm(40.6413, -73.7781, 51.4775, -0.4614);
    expect(nm).toBeGreaterThan(2990);
    expect(nm).toBeLessThan(3020);
  });

  it("takes the short way across the antimeridian", () => {
    expect(haversineNm(0, 179.5, 0, -179.5)).toBeCloseTo(60.04, 1);
  });

  it("handles a full quarter circumference", () => {
    expect(haversineNm(0, 0, 90, 0)).toBeCloseTo(5403.6, 0);
  });
});

describe("bearingDeg", () => {
  it("reports due north as 0", () => {
    expect(bearingDeg(0, 0, 1, 0)).toBeCloseTo(0, 6);
  });

  it("reports due east as 90", () => {
    expect(bearingDeg(0, 0, 0, 1)).toBeCloseTo(90, 6);
  });

  it("reports due south as 180", () => {
    expect(bearingDeg(0, 0, -1, 0)).toBeCloseTo(180, 6);
  });

  it("reports due west as 270", () => {
    expect(bearingDeg(0, 0, 0, -1)).toBeCloseTo(270, 6);
  });

  it("stays inside [0, 360)", () => {
    const bearing = bearingDeg(-10, 170, 20, -170);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(360);
  });
});

describe("normalizeLonDelta", () => {
  it("passes small deltas through unchanged", () => {
    expect(normalizeLonDelta(12.5)).toBe(12.5);
    expect(normalizeLonDelta(-40)).toBe(-40);
  });

  it("wraps deltas beyond 180 the short way", () => {
    expect(normalizeLonDelta(350)).toBe(-10);
    expect(normalizeLonDelta(-350)).toBe(10);
  });

  it("maps exactly 180 to -180", () => {
    expect(normalizeLonDelta(180)).toBe(-180);
  });
});
