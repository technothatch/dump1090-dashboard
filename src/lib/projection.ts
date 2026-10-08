/**
 * Receiver-centred projection for the SVG radar/position map.
 *
 * The receiver sits at the centre of the plot; each aircraft is drawn at its
 * bearing and range (both derived from the same haversine/ bearing maths as
 * `lib/geo.ts`), which makes range rings trivially honest — no Mercator
 * distortion, no dependency on a map tile service.
 */

import { bearingDeg, haversineNm } from "./geo";

/** A WGS-84 point. */
export interface GeoPoint {
  lat: number;
  lon: number;
}

/** Everything needed to turn lat/lon into SVG coordinates. */
export interface Projection {
  /** Receiver position — drawn at `(cx, cy)`. */
  center: GeoPoint;
  /** SVG centre X. */
  cx: number;
  /** SVG centre Y. */
  cy: number;
  /** Radius of the outermost range ring, pixels. */
  radiusPx: number;
  /** Ground distance represented by `radiusPx`, nautical miles. */
  rangeNm: number;
}

/** Result of projecting a point. */
export interface Projected {
  /** SVG X coordinate (unclamped — can fall outside the circle). */
  x: number;
  /** SVG Y coordinate (unclamped). */
  y: number;
  /** Great-circle distance from the receiver. */
  distanceNm: number;
  /** True when the point is within the plotted range. */
  inside: boolean;
}

/** Fallback plot radius when nothing is in the air (NM). */
export const DEFAULT_RANGE_NM = 50;

/** Range candidates for auto-ranging, nautical miles. */
export const RANGE_STEPS: readonly number[] = [
  5, 10, 15, 25, 50, 75, 100, 150, 200, 300, 500, 1000, 1500, 2000,
];

/** Pixels kept between the outer ring and the SVG edge. */
const VIEW_MARGIN = 8;

/**
 * Build a projection for an SVG square of `size` pixels.
 */
export function createProjection(center: GeoPoint, rangeNm: number, size: number): Projection {
  return {
    center,
    cx: size / 2,
    cy: size / 2,
    radiusPx: size / 2 - VIEW_MARGIN,
    rangeNm,
  };
}

/**
 * Project a WGS-84 point into SVG coordinates.
 *
 * The point is placed along its bearing from the receiver at a radius
 * proportional to its distance: `r = (distanceNm / rangeNm) * radiusPx`.
 */
export function project(point: GeoPoint, projection: Projection): Projected {
  const distanceNm = haversineNm(
    projection.center.lat,
    projection.center.lon,
    point.lat,
    point.lon,
  );
  const bearing = bearingDeg(
    projection.center.lat,
    projection.center.lon,
    point.lat,
    point.lon,
  );
  const r = (distanceNm / projection.rangeNm) * projection.radiusPx;
  const rad = (bearing * Math.PI) / 180;
  return {
    x: projection.cx + r * Math.sin(rad),
    y: projection.cy - r * Math.cos(rad),
    distanceNm,
    inside: distanceNm <= projection.rangeNm,
  };
}

/**
 * Like {@link project} but with the radius clamped to the outer ring, so
 * out-of-range aircraft stay visible as edge markers.
 */
export function projectClamped(point: GeoPoint, projection: Projection): Projected & { clamped: boolean } {
  const projected = project(point, projection);
  if (projected.inside) return { ...projected, clamped: false };
  const dx = projected.x - projection.cx;
  const dy = projected.y - projection.cy;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { ...projected, clamped: false };
  const scale = projection.radiusPx / length;
  return {
    ...projected,
    x: projection.cx + dx * scale,
    y: projection.cy + dy * scale,
    clamped: true,
  };
}

/**
 * Radii of `count` evenly spaced rings, innermost first, in pixels.
 */
export function ringRadii(projection: Projection, count: number): number[] {
  const rings = Math.max(1, Math.floor(count));
  const radii: number[] = [];
  for (let i = 1; i <= rings; i += 1) {
    radii.push((projection.radiusPx * i) / rings);
  }
  return radii;
}

/**
 * Ground distance represented by each ring from {@link ringRadii}, in NM.
 */
export function ringValues(projection: Projection, count: number): number[] {
  const rings = Math.max(1, Math.floor(count));
  const values: number[] = [];
  for (let i = 1; i <= rings; i += 1) {
    values.push((projection.rangeNm * i) / rings);
  }
  return values;
}

/**
 * Smallest "nice" range that contains `maxDistanceNm`.
 *
 * Zero/invalid input falls back to {@link DEFAULT_RANGE_NM}; distances beyond
 * the step table round up to the next 1000 NM.
 */
export function chooseRangeNm(maxDistanceNm: number): number {
  if (!Number.isFinite(maxDistanceNm) || maxDistanceNm <= 0) return DEFAULT_RANGE_NM;
  for (const step of RANGE_STEPS) {
    if (step >= maxDistanceNm) return step;
  }
  return Math.ceil(maxDistanceNm / 1000) * 1000;
}
