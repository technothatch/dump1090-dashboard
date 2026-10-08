import { describe, expect, it } from "vitest";
import {
  chooseRangeNm,
  createProjection,
  DEFAULT_RANGE_NM,
  project,
  projectClamped,
  ringRadii,
  ringValues,
} from "../src/lib/projection";

const CENTER = { lat: 51.5, lon: -0.12 };

function projection(rangeNm = 100, size = 600) {
  return createProjection(CENTER, rangeNm, size);
}

describe("createProjection", () => {
  it("centres the plot and reserves a margin", () => {
    const proj = projection(100, 600);
    expect(proj.cx).toBe(300);
    expect(proj.cy).toBe(300);
    expect(proj.radiusPx).toBe(292);
    expect(proj.rangeNm).toBe(100);
    expect(proj.center).toEqual(CENTER);
  });
});

describe("project", () => {
  it("puts the receiver exactly at the centre", () => {
    const proj = projection();
    const point = project(CENTER, proj);
    expect(point.x).toBe(proj.cx);
    expect(point.y).toBe(proj.cy);
    expect(point.distanceNm).toBeCloseTo(0, 9);
    expect(point.inside).toBe(true);
  });

  it("draws a point due north above the centre", () => {
    const proj = projection();
    const point = project({ lat: CENTER.lat + 0.2, lon: CENTER.lon }, proj);
    expect(point.x).toBeCloseTo(proj.cx, 6);
    expect(point.y).toBeLessThan(proj.cy);
    expect(point.inside).toBe(true);
  });

  it("draws a point due east to the right of the centre", () => {
    const proj = projection();
    const point = project({ lat: CENTER.lat, lon: CENTER.lon + 0.3 }, proj);
    expect(point.y).toBeCloseTo(proj.cy, 0);
    expect(point.x).toBeGreaterThan(proj.cx);
  });

  it("scales radius linearly with distance", () => {
    const proj = projection(300);
    const near = project({ lat: CENTER.lat + 0.1, lon: CENTER.lon }, proj);
    const far = project({ lat: CENTER.lat + 0.2, lon: CENTER.lon }, proj);
    const nearR = proj.cy - near.y;
    const farR = proj.cy - far.y;
    expect(farR).toBeCloseTo(nearR * 2, 0);
  });

  it("marks points beyond the plotted range as outside", () => {
    const proj = projection(10);
    const outside = project({ lat: CENTER.lat + 1, lon: CENTER.lon }, proj);
    expect(outside.inside).toBe(false);
    expect(project({ lat: CENTER.lat + 0.05, lon: CENTER.lon }, proj).inside).toBe(true);
  });
});

describe("projectClamped", () => {
  it("leaves in-range points untouched", () => {
    const proj = projection();
    const point = { lat: CENTER.lat + 0.1, lon: CENTER.lon + 0.1 };
    const plain = project(point, proj);
    const clamped = projectClamped(point, proj);
    expect(clamped.x).toBe(plain.x);
    expect(clamped.y).toBe(plain.y);
    expect(clamped.clamped).toBe(false);
  });

  it("pulls out-of-range points onto the outer ring", () => {
    const proj = projection(10);
    const clamped = projectClamped({ lat: CENTER.lat + 5, lon: CENTER.lon }, proj);
    expect(clamped.clamped).toBe(true);
    const dx = clamped.x - proj.cx;
    const dy = clamped.y - proj.cy;
    expect(Math.hypot(dx, dy)).toBeCloseTo(proj.radiusPx, 6);
    expect(clamped.inside).toBe(false);
  });
});

describe("range rings", () => {
  it("emits evenly spaced radii up to the outer ring", () => {
    const radii = ringRadii(projection(), 4);
    expect(radii).toEqual([73, 146, 219, 292]);
    expect(ringRadii(projection(), 0)).toEqual([292]);
  });

  it("emits matching ground distances", () => {
    expect(ringValues(projection(100), 4)).toEqual([25, 50, 75, 100]);
  });
});

describe("chooseRangeNm", () => {
  it("falls back to the default range for empty or invalid skies", () => {
    expect(chooseRangeNm(0)).toBe(DEFAULT_RANGE_NM);
    expect(chooseRangeNm(-5)).toBe(DEFAULT_RANGE_NM);
    expect(chooseRangeNm(Number.NaN)).toBe(DEFAULT_RANGE_NM);
  });

  it("picks the next step up", () => {
    expect(chooseRangeNm(4)).toBe(5);
    expect(chooseRangeNm(5)).toBe(5);
    expect(chooseRangeNm(5.5)).toBe(10);
    expect(chooseRangeNm(120)).toBe(150);
    expect(chooseRangeNm(2000)).toBe(2000);
  });

  it("rounds beyond the step table to the next 1000 NM", () => {
    expect(chooseRangeNm(2500)).toBe(3000);
    expect(chooseRangeNm(4001)).toBe(5000);
  });
});
