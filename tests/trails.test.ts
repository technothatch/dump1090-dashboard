import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRAIL_CAPACITY,
  TrailBuffer,
} from "../src/lib/trails";

describe("TrailBuffer basics", () => {
  it("stores points per hex in insertion order", () => {
    const buffer = new TrailBuffer();
    buffer.record("abc123", 51.1, -0.1, 1000);
    buffer.record("abc123", 51.2, -0.2, 2000);
    buffer.record("def456", 52.1, 1.1, 2500);

    const trail = buffer.get("abc123");
    expect(trail).toHaveLength(2);
    expect(trail[0]?.lat).toBe(51.1);
    expect(trail[1]?.lon).toBe(-0.2);
    expect(buffer.get("def456")).toHaveLength(1);
    expect(buffer.get("unknown")).toEqual([]);
  });

  it("defaults to a 60 point capacity", () => {
    expect(new TrailBuffer().capacity).toBe(DEFAULT_TRAIL_CAPACITY);
    expect(new TrailBuffer({ capacity: 0 }).capacity).toBe(1);
    expect(new TrailBuffer({ capacity: 2.7 }).capacity).toBe(2);
    expect(new TrailBuffer({ maxAgeMs: -5 }).maxAgeMs).toBe(0);
  });

  it("returns a copy, not the internal array", () => {
    const buffer = new TrailBuffer();
    buffer.record("abc123", 51.1, -0.1, 1000);
    const trail = buffer.get("abc123");
    trail.push({ lat: 0, lon: 0, t: 0 });
    expect(buffer.get("abc123")).toHaveLength(1);
  });
});

describe("TrailBuffer eviction", () => {
  it("evicts the oldest points beyond the capacity", () => {
    const buffer = new TrailBuffer({ capacity: 3 });
    for (let i = 0; i < 10; i += 1) {
      buffer.record("abc123", 51 + i * 0.01, -0.1, 1000 + i);
    }
    const trail = buffer.get("abc123");
    expect(trail).toHaveLength(3);
    expect(trail[0]?.lat).toBeCloseTo(51.07, 5);
    expect(trail[2]?.lat).toBeCloseTo(51.09, 5);
    expect(buffer.size()).toBe(3);
  });

  it("deduplicates consecutive identical positions and refreshes their age", () => {
    const buffer = new TrailBuffer({ maxAgeMs: 1000 });
    buffer.record("abc123", 51.1, -0.1, 0);
    buffer.record("abc123", 51.1, -0.1, 800);
    const trail = buffer.get("abc123");
    expect(trail).toHaveLength(1);
    expect(trail[0]?.t).toBe(800);
  });

  it("drops points older than maxAgeMs and forgets empty trails", () => {
    const buffer = new TrailBuffer({ maxAgeMs: 1000 });
    buffer.record("abc123", 51.1, -0.1, 0);
    buffer.record("abc123", 51.2, -0.2, 500);
    expect(buffer.hexes()).toEqual(["abc123"]);

    buffer.record("abc123", 51.3, -0.3, 5000);
    expect(buffer.get("abc123")).toHaveLength(1);
    expect(buffer.get("abc123")[0]?.lat).toBeCloseTo(51.3, 5);

    buffer.prune(10_000);
    expect(buffer.hexes()).toEqual([]);
    expect(buffer.size()).toBe(0);
    expect(buffer.prune(10_000)).toBe(0);
  });
});

describe("TrailBuffer maintenance", () => {
  it("clears one hex or all of them", () => {
    const buffer = new TrailBuffer();
    buffer.record("abc123", 51.1, -0.1, 1000);
    buffer.record("def456", 52.1, 1.1, 1000);

    buffer.clear("abc123");
    expect(buffer.hexes()).toEqual(["def456"]);

    buffer.clear();
    expect(buffer.hexes()).toEqual([]);
  });

  it("keeps the newest ordering after interleaved records", () => {
    const buffer = new TrailBuffer({ capacity: 5 });
    buffer.record("a", 1, 1, 10);
    buffer.record("b", 2, 2, 20);
    buffer.record("a", 1.5, 1.5, 30);

    expect(buffer.size()).toBe(3);
    expect(buffer.hexes().toSorted()).toEqual(["a", "b"]);
    expect(buffer.get("a").map((p) => p.t)).toEqual([10, 30]);
  });
});
