import { describe, expect, it } from "vitest";
import {
  filterAircraft,
  matchesQuery,
  selectCounts,
  selectPositioned,
  selectRows,
  selectSelected,
  sortAircraft,
} from "../src/lib/selectors";
import { createInitialState } from "../src/lib/store";
import type { Aircraft } from "../src/lib/types";

function plane(overrides: Partial<Aircraft> & { hex: string }): Aircraft {
  return { ...overrides };
}

const FLEET: Aircraft[] = [
  plane({ hex: "aa1111", flight: "UAL123", type: "B738", alt_baro: 35000, gs: 450, dst: 42.5, rssi: -12, seen: 2, messages: 100, squawk: "1200", lat: 52, lon: -1 }),
  plane({ hex: "bb2222", flight: "BAW456", type: "A320", alt_baro: "ground", gs: 5, dst: 3.1, rssi: -30, seen: 40, messages: 900, squawk: "7700", lat: 51.5, lon: -0.1 }),
  plane({ hex: "cc3333", flight: "EZY789", type: "A320", alt_baro: 12000, gs: 250, dst: 88.9, rssi: -18, seen: 9, messages: 55, squawk: "4321", lat: 51, lon: 0.5 }),
  plane({ hex: "dd4444", type: "B77W", alt_geom: 40000, dst: 120.2, messages: 12, seen: 300 }),
];

describe("filtering", () => {
  it("returns everything for an empty query", () => {
    expect(filterAircraft(FLEET, "")).toHaveLength(FLEET.length);
    expect(filterAircraft(FLEET, "   ")).toHaveLength(FLEET.length);
    const result = filterAircraft(FLEET, "");
    expect(result).not.toBe(FLEET);
    expect(result).toEqual(FLEET);
  });

  it("matches hex, callsign and type case-insensitively", () => {
    expect(filterAircraft(FLEET, "aa1111").map((a) => a.hex)).toEqual(["aa1111"]);
    expect(filterAircraft(FLEET, "ual").map((a) => a.hex)).toEqual(["aa1111"]);
    expect(filterAircraft(FLEET, "a320").map((a) => a.hex)).toEqual(["bb2222", "cc3333"]);
    expect(filterAircraft(FLEET, "B738").map((a) => a.hex)).toEqual(["aa1111"]);
  });

  it("matches registration and squawk too", () => {
    const withReg = plane({ hex: "ee5555", r: "G-EZBK", squawk: "7700" });
    expect(matchesQuery(withReg, "g-ezbk")).toBe(true);
    expect(matchesQuery(withReg, "7700")).toBe(true);
    expect(matchesQuery(withReg, "zzz")).toBe(false);
  });

  it("requires every whitespace-separated token to match (AND)", () => {
    expect(filterAircraft(FLEET, "a320 4321").map((a) => a.hex)).toEqual(["cc3333"]);
    expect(filterAircraft(FLEET, "a320 ual")).toEqual([]);
  });

  it("treats an empty query as a match for any aircraft", () => {
    expect(matchesQuery(FLEET[0] as Aircraft, "  ")).toBe(true);
  });
});

describe("sorting", () => {
  it("sorts numbers ascending and descending", () => {
    const asc = sortAircraft(FLEET, "dst", "asc").map((a) => a.hex);
    expect(asc).toEqual(["bb2222", "aa1111", "cc3333", "dd4444"]);

    const desc = sortAircraft(FLEET, "gs", "desc").map((a) => a.hex);
    expect(desc[0]).toBe("aa1111");
    expect(desc[1]).toBe("cc3333");
  });

  it("always sinks missing values to the bottom", () => {
    const asc = sortAircraft(FLEET, "gs", "asc").map((a) => a.hex);
    expect(asc[asc.length - 1]).toBe("dd4444");
    const desc = sortAircraft(FLEET, "gs", "desc").map((a) => a.hex);
    expect(desc[desc.length - 1]).toBe("dd4444");
  });

  it("sorts \"ground\" as zero feet", () => {
    const asc = sortAircraft(FLEET, "alt", "asc").map((a) => a.hex);
    expect(asc[0]).toBe("bb2222");
    const desc = sortAircraft(FLEET, "alt", "desc").map((a) => a.hex);
    expect(desc[0]).toBe("dd4444");
    expect(desc[desc.length - 1]).toBe("bb2222");
  });

  it("sorts by callsign label with hex fallback", () => {
    const byFlight = sortAircraft(FLEET, "flight", "asc").map((a) => a.flight ?? a.hex);
    expect(byFlight).toEqual(["BAW456", "dd4444", "EZY789", "UAL123"]);

    const reverse = sortAircraft(FLEET, "flight", "desc").map((a) => a.flight ?? a.hex);
    expect(reverse[0]).toBe("UAL123");
    expect(reverse[reverse.length - 1]).toBe("BAW456");
  });

  it("is stable for tied values", () => {
    const tied: Aircraft[] = [
      plane({ hex: "zz1", gs: 100 }),
      plane({ hex: "zz2", gs: 100 }),
      plane({ hex: "zz3", gs: 100 }),
    ];
    expect(sortAircraft(tied, "gs", "asc").map((a) => a.hex)).toEqual(["zz1", "zz2", "zz3"]);
    expect(sortAircraft(tied, "gs", "desc").map((a) => a.hex)).toEqual(["zz1", "zz2", "zz3"]);
  });

  it("does not mutate its input", () => {
    const before = FLEET.map((a) => a.hex);
    sortAircraft(FLEET, "hex", "desc");
    expect(FLEET.map((a) => a.hex)).toEqual(before);
  });

  it("sorts squawk, messages, rssi and seen", () => {
    expect(sortAircraft(FLEET, "squawk", "asc")[0]?.hex).toBe("aa1111");
    expect(sortAircraft(FLEET, "messages", "desc")[0]?.hex).toBe("bb2222");
    expect(sortAircraft(FLEET, "rssi", "desc")[0]?.hex).toBe("aa1111");
    expect(sortAircraft(FLEET, "seen", "asc")[0]?.hex).toBe("aa1111");
    expect(sortAircraft(FLEET, "track", "asc").map((a) => a.hex)).toEqual([
      "aa1111",
      "bb2222",
      "cc3333",
      "dd4444",
    ]);
  });
});

describe("selectors", () => {
  it("selectRows combines filter and sort", () => {
    const state = createInitialState({
      aircraft: FLEET,
      filter: "a320",
      sortKey: "dst",
      sortDir: "asc",
    });
    expect(selectRows(state).map((a) => a.hex)).toEqual(["bb2222", "cc3333"]);
  });

  it("selectCounts summarises positions, ground state and emergencies", () => {
    const counts = selectCounts(createInitialState({ aircraft: FLEET }));
    expect(counts).toEqual({
      total: 4,
      positioned: 3,
      airborne: 3,
      onGround: 1,
      emergency: 1,
    });
  });

  it("selectSelected resolves the drawer target", () => {
    const state = createInitialState({ aircraft: FLEET, selectedHex: "cc3333" });
    expect(selectSelected(state)?.flight).toBe("EZY789");
    expect(selectSelected(createInitialState({ aircraft: FLEET }))).toBeNull();
    expect(
      selectSelected(createInitialState({ aircraft: FLEET, selectedHex: "ffffff" })),
    ).toBeNull();
  });

  it("selectPositioned keeps only lat/lon aircraft", () => {
    const positioned = selectPositioned(createInitialState({ aircraft: FLEET }));
    expect(positioned.map((a) => a.hex)).toEqual(["aa1111", "bb2222", "cc3333"]);
  });
});
