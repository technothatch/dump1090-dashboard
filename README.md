# dump1090-dashboard

[![CI](https://github.com/technothatch/dump1090-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/technothatch/dump1090-dashboard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/technothatch/dump1090-dashboard/blob/main/LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/technothatch/dump1090-dashboard)](https://github.com/technothatch/dump1090-dashboard/releases)
[![Issues](https://img.shields.io/github/issues/technothatch/dump1090-dashboard)](https://github.com/technothatch/dump1090-dashboard/issues)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/technothatch/dump1090-dashboard/pulls)
[![Code size](https://img.shields.io/github/languages/code-size/technothatch/dump1090-dashboard)](https://github.com/technothatch/dump1090-dashboard)
[![Last commit](https://img.shields.io/github/last-commit/technothatch/dump1090-dashboard)](https://github.com/technothatch/dump1090-dashboard/commits/main)
[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/vite-8-646CFF.svg)](https://vitejs.dev/)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933.svg)](https://nodejs.org/)
[![Coverage](https://img.shields.io/badge/coverage-99%25-brightgreen.svg)](https://github.com/technothatch/dump1090-dashboard)

A modern, dependency-light local web UI for [dump1090](https://github.com/flightaware/dump1090)
and [readsb](https://github.com/wiedehopf/readsb) — the decoders that turn an RTL-SDR dongle
into live ADS-B data. It polls the same JSON those decoders already publish
(`data/aircraft.json`, `data/receiver.json`) and renders a live aircraft table, a
receiver-centred SVG radar with trails, and a detail drawer on a single page.
Built with **Vite + TypeScript and no framework**: the production bundle is ~21 kB of
JavaScript with **zero runtime dependencies**, all decision-making lives in pure,
unit-tested modules under `src/lib/`, and the default `/data/` base URL means the built
`dist/` can be dropped next to tar1090 behind the same nginx without any configuration.

## Features

- **Live aircraft table** — sortable columns (flight, hex, altitude, ground speed, track,
  squawk, distance, RSSI, messages, seen), free-text filter with multi-token AND matching
  over hex/callsign/type/squawk/registration, full keyboard navigation
  (`↑`/`↓` to move, `Enter` to open, `/` to focus the filter, `Esc` to close),
  emergency rows (squawk 7500/7600/7700, `emergency != none`) highlighted.
- **SVG radar / position map** — receiver-centred polar projection with labelled range
  rings, auto-ranged 5 NM → 1000+ NM from the farthest target, per-aircraft trails from a
  rolling buffer (60 points / 15 minutes, deduped and evicted), click a marker to inspect.
- **Detail drawer** — every field that matters (registration, category, vertical rate,
  nav modes, MLAT/TIS-B, signal, ages) with distance/bearing computed locally from
  `receiver.json` when the decoder omits `dst`/`dir`.
- **Connection status pill** — `connecting → live → reconnecting → offline`, exponential
  reconnect backoff (1 s → 15 s), last error as the tooltip, automatic recovery.
- **Adaptive polling** — 5 s when the sky is empty down to 0.5 s with ~100 aircraft,
  driven purely by aircraft count (`?interval=` pins it).
- **Dark/light theme** — persisted in `localStorage`, honours `prefers-color-scheme`,
  `?theme=` overrides, applied before first paint (no flash).
- **Relative `/data/` by default** — works when served by the same nginx as tar1090;
  `?data=http://other-host:8080/data/` points it at a remote decoder.
- **Boring on purpose** — no framework, no CSS library, no map tiles, no CDN: everything
  runs offline against your own decoder.

## Install

From source (Node 20+):

```bash
git clone https://github.com/technothatch/dump1090-dashboard.git
cd dump1090-dashboard
npm ci
npm run build          # → dist/ (static files, no server required)
```

With Docker (builds the bundle, then serves it from nginx with a `/data/` proxy —
CI does not build this image):

```bash
docker build -t dump1090-dashboard .
docker run --rm -p 8081:80 --build-arg DECODER_UPSTREAM=http://host.docker.internal:8080 \
  --add-host host.docker.internal:host-gateway dump1090-dashboard
```

## Quickstart

1. Run a decoder with the JSON output enabled — both ship an HTTP server on port 8080:

```bash
# dump1090-fa (Debian/Ubuntu package)
sudo systemctl start dump1090-fa          # serves http://localhost:8080/data/aircraft.json

# readsb
readsb --write-json --net-http-port 8080  # or your usual systemd unit
```

2. Start the dev server (it proxies `/data/` to `http://localhost:8080`):

```bash
npm run dev
#  ➜  Local:   http://localhost:5173/
```

3. Open the page. The pill flips from `connecting` to a green `live`, the table fills with
   whatever is in the air, the radar draws range rings around your receiver (from
   `receiver.json`'s `lat`/`lon`), and trails accumulate as positions arrive:

```
dump1090-dashboard                       [LIVE]  12 aircraft · 9 with position · 1 emergency   [Theme]
Filter  [UAL________]                    polling every 1.4 s · updated 14:03:22
┌ Radar ──────────────── source: /data/ ┐ ┌ Aircraft ─────── readsb 4.0 · 51.5074, -0.1278 ─┐
│            25 NM                       │ │ Flight   Hex      Type   Alt        GS   Dist   │
│         ●―――――――○                      │ │ UAL123   AA1111   B738   35,000 ft  450  42.5   │
│        /    ▲   \                      │ │ BAW456   BB2222   A320   GROUND      5   3.1   │
│       ○  ── ● ── ○   ◎ receiver        │ │ …                                            │
└────────────────────────────────────────┘ └────────────────────────────────────────────────┘
```

Serving the built bundle without Node:

```bash
npm run preview                           # quick check: vite preview on :4173
# or just copy dist/ behind any web server — the app only needs same-origin /data/
```

## Configuration reference

### Query parameters (`location.search`)

| Parameter | Meaning | Default |
| --- | --- | --- |
| `data` | Base URL for `aircraft.json` / `receiver.json` (relative or absolute, trailing slash optional) | `/data/` — relative, same origin |
| `interval` | Fixed poll interval in ms, clamped to `[500, 5000]`; disables adaptation | adaptive (see below) |
| `theme` | `dark` or `light`, overrides the stored choice | stored choice, else `prefers-color-scheme`, else `dark` |

Examples: `/?data=http://pi:8080/data/`, `/?theme=light&interval=2000`.

### Environment / tooling

| Name | Where | Meaning | Default |
| --- | --- | --- | --- |
| `DUMP1090_URL` | `npm run dev` (Vite) | Dev-server proxy target for `/data/` | `http://localhost:8080` |
| `DECODER_UPSTREAM` | `docker build --build-arg` | Upstream the shipped `nginx.conf.example` proxies `/data/` to | `http://127.0.0.1:8080` |

### Adaptive poll interval

| Aircraft in snapshot | Interval |
| --- | --- |
| 0 | 5000 ms |
| 9 | 2750 ms |
| 25 | 1800 ms |
| ≥ 99 | 500 ms |

On failure the controller backs off `1 s → 2 s → 4 s → 8 s → 15 s` (capped), flips the
pill to `reconnecting` (then `offline` after 5 consecutive failures) and recovers to
`live` on the first good poll. A failing `receiver.json` never takes the feed down — the
last known receiver position is kept.

### Serving behind nginx (tar1090-style proxy)

The default `data` base is the **relative** `/data/`, so the common setup is: nginx
already serves the decoder's JSON (or proxies it), and the dashboard goes next to it:

```nginx
server {
    listen 80;
    server_name adsb.lan;
    root /var/www/dump1090-dashboard;          # the built dist/

    location / { try_files $uri $uri/ /index.html; }

    # Live decoder JSON — never cached.
    location /data/ {
        proxy_pass http://127.0.0.1:8080/data/;
        proxy_http_version 1.1;
        proxy_buffering off;
        add_header Cache-Control "no-store";
    }
}
```

Reading straight off disk instead (tar1090's `--write-json` layout) works too:

```nginx
    location /data/ {
        alias /run/readsb/;                    # or /run/dump1090-fa/
        default_type application/json;
        add_header Cache-Control "no-store";
    }
```

A full annotated example lives in [`nginx.conf.example`](nginx.conf.example) (it is what
the `Dockerfile` installs).

### Deployment matrix

| Mode | Command | Reads data from | Notes |
| --- | --- | --- | --- |
| Dev | `npm run dev` | Vite proxy → `DUMP1090_URL` | HMR, default `http://localhost:8080` |
| Local bundle | `npm run build` + any static server | same-origin `/data/` | copy `dist/`, add `?data=` if needed |
| Docker | `docker build && docker run -p 8081:80` | nginx proxy → `DECODER_UPSTREAM` | healthcheck included, CI does not build it |
| tar1090 host | drop `dist/` into an existing vhost | existing `/data/` location | zero parameters needed |

## How it works

```
 fetch (0.5–5 s)                pure core (src/lib/)                thin DOM (src/ui/)
┌──────────────────┐   ┌─────────────────────────────────────┐   ┌─────────────────────┐
│ polling.ts       │──▶│ parse.ts   tolerant aircraft.json   │   │ table.ts  rows/sort │
│  adaptive 0.5–5s │   │ store.ts   state + actions          │──▶│ map.ts    SVG scene │
│  backoff 1–15 s  │   │ selectors.ts filter/sort/counts     │   │ drawer.ts detail    │
│  status pill     │   │ projection.ts lat/lon → SVG         │   │ status.ts pill      │
│  injectable fetch│   │ trails.ts  rolling 60-pt buffer     │   └─────────────────────┘
└──────────────────┘   │ geo.ts     haversine/bearing        │             ▲
                       │ format.ts  total formatters         │             │ subscribe(render)
                       │ theme.ts   storage rules            │   main.ts ──┘
                       │ config.ts  ?data= ?theme= ?interval │
                       └─────────────────────────────────────┘
```

1. **`polling.ts`** fetches `aircraft.json` and `receiver.json` every cycle (receiver
   failures are tolerated), computes the next delay from the aircraft count, and owns the
   status/failure state machine. `fetch` and the timers are injectable, which is how the
   whole loop is tested deterministically under fake timers.
2. **`parse.ts`** treats decoder output as untrusted: unknown keys pass through, wrongly
   typed known keys are dropped, malformed entries are skipped, and a non-object document
   is an error the pill can show.
3. **`store.ts` + `selectors.ts`** are plain functions over state — filtering, sorting
   (missing values always last), counters, selection. No diffing, no reactivity magic.
4. **`projection.ts` / `trails.ts`** do the map maths: bearing + haversine → SVG x/y
   against a polar plot with auto range, and a fixed-capacity, time-bounded trail store.
5. **`src/ui/*` and `main.ts`** are DOM glue only: they render from selectors on every
   store change and translate DOM events into store actions.

## Development

```bash
git clone https://github.com/technothatch/dump1090-dashboard.git
cd dump1090-dashboard
npm ci

npm run lint            # oxlint, --deny-warnings (src + tests + configs)
npm run typecheck       # tsc --noEmit, strict + noUncheckedIndexedAccess
npm run test            # vitest run
npm run test:coverage   # vitest + v8 coverage (80% thresholds, CI runs this)
npm run build           # vite build → dist/
npm run preview         # serve the built bundle
```

The suite — 123 tests across 10 files — covers tolerant JSON parsing, every formatter,
haversine/bearing maths, the projection (centre, bearings, scaling, clamping, rings,
auto-range), trail eviction (capacity, age, dedupe, clear), store/selectors (filter AND
semantics, sort directions, missing-value placement, stability, counters), the polling
controller under fake timers (adaptive schedule, HTTP/network/parse failures, backoff
growth, offline threshold, recovery, stop/idempotence), theme persistence rules and
query-string configuration: **99 % line / 95 % branch coverage** over `src/lib/`.
CI runs lint, typecheck, tests with coverage and a Vite build on Node 20, 22 and 24, then
uploads `dist/` as an artifact.

## Related projects

- [dump1090-fa](https://github.com/flightaware/dump1090) — FlightAware's dump1090, source of `data/*.json`
- [readsb](https://github.com/wiedehopf/readsb) — high-performance fork, `--write-json` + query API on port 8042
- [tar1090](https://github.com/wiedehopf/tar1090) — the reference web UI for readsb/dump1090
- [graphs1090](https://github.com/wiedehopf/graphs1090) — long-term statistics for the same decoder

## License

MIT © technothatch. See [LICENSE](LICENSE).
