/**
 * SVG radar/position map glue: range rings, receiver marker, aircraft
 * trails (from the rolling buffer) and one marker per positioned aircraft.
 *
 * The whole scene is rebuilt per render — cheap enough for hundreds of
 * aircraft and free of diffing complexity.
 */

import { label } from "../lib/format";
import type { Projection } from "../lib/projection";
import { project, projectClamped, ringRadii, ringValues } from "../lib/projection";
import type { TrailBuffer } from "../lib/trails";
import type { Aircraft } from "../lib/types";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Everything the map needs for one frame; `null` clears the scene. */
export interface MapRenderOptions {
  projection: Projection;
  aircraft: Aircraft[];
  trails: TrailBuffer;
  selectedHex: string | null;
}

function svgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
}

function renderRings(root: SVGSVGElement, projection: Projection): void {
  const { cx, cy, radiusPx } = projection;
  const radii = ringRadii(projection, 4);
  const values = ringValues(projection, 4);

  root.append(
    svgElement("circle", {
      cx: String(cx),
      cy: String(cy),
      r: String(radiusPx),
      class: "map-ring map-ring-outer",
    }),
  );
  radii.slice(0, -1).forEach((radius, index) => {
    root.append(
      svgElement("circle", {
        cx: String(cx),
        cy: String(cy),
        r: String(radius),
        class: "map-ring",
      }),
    );
    const value = values[index] ?? 0;
    const labelEl = svgElement("text", {
      x: String(cx + 4),
      y: String(cy - radius - 4),
      class: "map-ring-label",
    });
    labelEl.textContent = `${Math.round(value)} NM`;
    root.append(labelEl);
  });

  root.append(
    svgElement("line", {
      x1: String(cx - radiusPx),
      y1: String(cy),
      x2: String(cx + radiusPx),
      y2: String(cy),
      class: "map-crosshair",
    }),
    svgElement("line", {
      x1: String(cx),
      y1: String(cy - radiusPx),
      x2: String(cx),
      y2: String(cy + radiusPx),
      class: "map-crosshair",
    }),
  );
}

function renderReceiver(root: SVGSVGElement, projection: Projection): void {
  const { cx, cy } = projection;
  root.append(
    svgElement("circle", { cx: String(cx), cy: String(cy), r: "5", class: "map-receiver" }),
    svgElement("circle", { cx: String(cx), cy: String(cy), r: "10", class: "map-receiver-halo" }),
  );
}

function renderTrails(root: SVGSVGElement, options: MapRenderOptions): void {
  const { projection, trails, selectedHex } = options;
  for (const hex of trails.hexes()) {
    const points = trails
      .get(hex)
      .map((point) => project(point, projection))
      .filter((point) => point.inside)
      .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`);
    if (points.length < 2) continue;
    root.append(
      svgElement("polyline", {
        points: points.join(" "),
        class: hex === selectedHex ? "map-trail selected" : "map-trail",
      }),
    );
  }
}

function renderAircraft(root: SVGSVGElement, options: MapRenderOptions): void {
  const { projection, aircraft, selectedHex } = options;
  for (const entry of aircraft) {
    const lat = entry.lat;
    const lon = entry.lon;
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    const projected = projectClamped({ lat, lon }, projection);
    const track = typeof entry.track === "number" ? entry.track : 0;
    const classes = ["map-ac"];
    if (entry.hex === selectedHex) classes.push("selected");
    if (typeof entry.squawk === "string" && ["7500", "7600", "7700"].includes(entry.squawk)) {
      classes.push("emergency");
    }

    const group = svgElement("g", {
      class: classes.join(" "),
      transform: `translate(${projected.x.toFixed(1)} ${projected.y.toFixed(1)})`,
      "data-hex": entry.hex,
    });
    const title = svgElement("title", {});
    title.textContent = `${label(entry)} · ${entry.hex.toUpperCase()}`;
    group.append(title);

    const body = svgElement("path", {
      d: "M0,-8 L5.5,7 L0,3.5 L-5.5,7 Z",
      transform: `rotate(${track.toFixed(1)})`,
      class: "map-ac-shape",
    });
    group.append(body);

    if (projected.inside) {
      const text = svgElement("text", { x: "9", y: "4", class: "map-ac-label" });
      text.textContent = label(entry);
      group.append(text);
    }
    root.append(group);
  }
}

/** Render (or clear, when `options` is `null`) the whole map scene. */
export function renderMap(root: SVGSVGElement, options: MapRenderOptions | null): void {
  root.replaceChildren();
  if (options === null) return;
  renderRings(root, options.projection);
  renderReceiver(root, options.projection);
  renderTrails(root, options);
  renderAircraft(root, options);
}
