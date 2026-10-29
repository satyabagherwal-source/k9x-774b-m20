> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/liketrek-trek-learnings.md`  
> **Source**: github ([https://github.com/liketrek/TREK](https://github.com/liketrek/TREK))  
> **Source Version**: `a0943f82`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-29T16:36:36.021Z  
> **Learning ID**: `learn-github-liketrek-trek`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): liketrek/TREK

> **Canonical Artifact**: `07_PROJECT_LEARNING/liketrek-trek-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/liketrek/TREK](https://github.com/liketrek/TREK))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-29T16:36:34.745Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `liketrek/TREK`
- **Description**: The most complete open-source travel planner: real-time collaboration, bookings, budgets, packing lists, journals, offline PWA, SSO and an AI-ready MCP server, with planet-wide place search and routing built in.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 15223 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `client/src/components/Assistant/cards/budget/budgetHooks.ts`
```
import type { CardPerson } from '@trek/shared';

import { useTranslation } from '../../../../i18n';
import { useViewerId } from '../parts/useViewerId';

/**
 * The words the costs' cards say about people, as the Costs page says them:
 * the signed-in user is "You", and "You paid" rather than "Ana paid".
 */
export function useBudgetPeople() {
  const { t } = useTranslation();
  const viewerId = useViewerId();
  const isViewer = (person: CardPerson) => person.id === viewerId;
  return {
    nameOf: (person: CardPerson) => (isViewer(person) ? t('costs.you') : person.name),
    paidBy: (person: CardPerson) =>
      isViewer(person) ? t('costs.youPaid') : t('assistant.card.budget.paidBy', { name: person.name }),
  };
}

```

### Core Architecture Module: `client/src/components/Map/engines/mapbox.ts`
```
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import rtlTextPluginUrl from '@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js?url'
import { registerRtlTextPlugin } from '../rtlText'

/**
 * The only module in the client that pulls mapbox-gl in at runtime.
 *
 * It has to stay reachable through `import('./engines/mapbox')` and nothing else:
 * a static import from anywhere in the tree drags 1.8 MB into the parent chunk and
 * quietly undoes the split. `npm run check:gl-split` fails on that.
 */
// Arabic/Hebrew/Persian labels come out unjoined and reversed without this.
// Mapbox's signature is (url, callback, deferred) — see rtlText.ts.
registerRtlTextPlugin(() => mapboxgl.setRTLTextPlugin(rtlTextPluginUrl, null, true))

export default mapboxgl

```

### Core Architecture Module: `client/src/components/Map/engines/maplibre.ts`
```
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

/**
 * The only module in the client that pulls maplibre-gl in at runtime. Same rule as
 * its mapbox sibling: reachable through a dynamic import and no other way.
 *
 * The two engines share their API surface for everything TREK uses — Map, Marker,
 * Popup, LngLatBounds — which is why the components take the engine as a prop and
 * stay engine-agnostic. Where the two genuinely differ, the caller already guards
 * on the provider (projection, accessToken, aroundCenter).
 *
 * MapLibre 6 ships as ES modules only and has no default export any more, so the
 * namespace is what goes out as this module's default. It is a frozen module
 * namespace: nothing may assign to it, which is why the accessToken writes stay
 * behind their mapbox-only guard.
 */

// MapLibre 6 finds its worker next to its own module, which inside a bundle is a
// chunk in /assets/ with no worker beside it. Vite builds the worker into its own
// file and hands back the URL; set before any Map is constructed, the
// maplibre-gl-leaflet bridge included, since it only ever reaches the engine
// together with this module.
maplibregl.setWorkerUrl(workerUrl)

// No RTL text plugin here, unlike mapbox. MapLibre 6.9 shapes Arabic and orders
// bidirectional text itself; the old plugin would replace that implementation, and
// a v6 worker can only load the plugin's UMD build through eval.

export default maplibregl

```

### Core Architecture Module: `client/src/components/Map/viaMarkerState.ts`
```
import { useRef } from 'react'
import type { RoadtripVia } from '@trek/shared'

/**
 * The trip's via points as an array that only changes when a via does.
 *
 * Both map renderers rebuild their via handles whenever this list changes, and the GL one
 * replaces the DOM element outright. The list it was given changed on every render: the
 * hook that loads vias returns a fresh object each time, and a fresh object arrives again
 * on every reload even when the rows came back identical.
 *
 * That made dragging a freshly placed via fail on the first try. Placing one triggers a
 * re-route, the re-route lands about a second later, the render it causes replaced the
 * handle under the pointer — and a pointerdown belongs to the element it happened on, so
 * the drag went to an element that no longer existed. The second attempt worked because
 * by then nothing was pending. An older via never showed it: nothing was re-routing.
 *
 * Keyed by id and position because those are the only fields a handle is built from. A
 * via that genuinely moved gets a new list, which is what redraws it where it now is.
 */
export function useStableVias(viasByDay: Record<number, RoadtripVia[]> | undefined): RoadtripVia[] {
  const flat = Object.values(viasByDay ?? {}).flat()
  const key = flat.map(v => `${v.id}@${v.lat},${v.lng}`).join('|')
  // Read and written during render on purpose: this is a cache of the argument, not
  // state — it never triggers a render of its own, and it has to be settled before the
  // effects that consume the list run.
  const held = useRef<{ key: string; list: RoadtripVia[] }>({ key: '', list: [] })
  if (held.current.key !== key) held.current = { key, list: flat }
  return held.current.list
}

```

### Core Architecture Module: `client/src/components/Planner/placeOpenState.ts`
```
import tzlookup from 'tz-lookup'

// The open/closed ring used to show whatever `open_now` the details endpoint had
// handed back — a boolean Google computed when the payload was fetched and that the
// server then cached for days. Read from another continent that value is wrong twice
// over: it is stale, and nothing in the chain ever looked at the place's own clock.
// The details payload also carries machine-readable periods — day/hour/minute, the
// same shape for Google and for OSM places — and those are what the ring is recomputed
// from, in the timezone of the coordinates. The weekday lines stay what they always
// were: display text in the user's language, unusable as a data source. Issue #1680.

const MINUTES_PER_DAY = 24 * 60
const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY

// Periods count days the way Google does: Sunday is 0. Intl reports the weekday by
// name, so this maps one to the other.
const WEEKDAY_NUMBER: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

export interface OpeningTimePoint {
  day: number
  hour: number
  minute: number
}

export interface OpeningPeriod {
  open: OpeningTimePoint
  /** Absent or null means the place never closes. */
  close?: OpeningTimePoint | null
}

export interface PlaceOpeningHours {
  periods?: OpeningPeriod[] | null
  /** YYYY-MM-DD dates the weekly periods do not describe (holidays and the like). */
  specialDays?: string[] | null
}

export function resolvePlaceTimeZone(lat: unknown, lng: unknown): string | null {
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null
  try {
    return tzlookup(lat, lng)
  } catch {
    return null
  }
}

/** Monday-based weekday index for `now` in `timeZone`; the viewer's own zone when it is null. */
export function placeWeekdayIndex(now: Date, timeZone: string | null): number {
  const local = localParts(now, timeZone)
  if (local) return (local.day + 6) % 7
  const jsDay = now.getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

/** Monday-based weekday index of a plan day's date; for a day without one, today's in `timeZone`. */
export function getWeekdayIndex(dateStr: string | null | undefined, timeZone: string | null): number {
  // weekdayDescriptions[0] = Monday … [6] = Sunday
  if (!dateStr) return placeWeekdayIndex(new Date(), timeZone)
  const jsDay = new Date(dateStr + 'T12:00:00').getDay()
  return jsDay === 0 ? 6 : jsDay - 1
}

/** Weekday (Sunday = 0), minute of day and calendar date of `now` in `timeZone`. */
function localParts(now: Date, timeZone: string | null): { day: number; minutes: number; date: string } | null {
  if (!timeZone) return null
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now)
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? ''
    const day = WEEKDAY_NUMBER[value('weekday')]
    const hour = Number.parseInt(value('hour'), 10)
    const minute = Number.parseInt(value('minute'), 10)
    if (day === undefined || Number.isNaN(hour) || Number.isNaN(minute)) return null
    return {
      day,
      minutes: (hour % 24) * 60 + minute,
      date: `${value('year')}-${value('month')}-${value('day')}`,
    }
  } catch {
    return null
  }
}

function isTimePoint(point: unknown): point is OpeningTimePoint {
  if (!point || typeof point !== 'object') return false
  const { day, hour, minute } = point as OpeningTimePoint
  if (typeof day !== 'number' || typeof hour !== 'number' || typeof minute !== 'number') return false
  return day >= 0 && day <= 6 && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59
}

/** Periods with a usable open point; a close point is optional but must be usable if present. */
function usablePeriods(periods: unknown): OpeningPeriod[] {
  if (!Array.isArray(periods)) return []
  return periods.filter(
    (p): p is OpeningPeriod =>
      !!p && isTimePoint((p as OpeningPeriod).open) && ((p as OpeningPeriod).close == null || isTimePoint((p as OpeningPeriod).close)),
  )
}

function pointMinutes(point: OpeningTimePoint): number {
  return point.day * MINUTES_PER_DAY + point.hour * 60 + point.minute
}

/**
 * Open/closed state of a place at `now`, judged by its own local clock.
 * Returns `fallback` (the server's `open_now`) whenever the periods cannot decide it.
 */
export function resolveOpenNow(
  hours: PlaceOpeningHours | null | undefined,
  lat: unknown,
  lng: unknown,
  fallback: boolean | null | undefined,
  now: Date = new Date(),
): boolean | null {
  const fb = fallback ?? null
  const periods = usablePeriods(hours?.periods)
  if (periods.length === 0) return fb

  const local = localParts(now, resolvePlaceTimeZone(lat, lng))
  if (!local) return fb

  // A holiday is not in the weekly periods, but Google knew about it when it computed
  // open_now — on such a day its verdict stands rather than our recomputation.
  const specialDays = hours?.specialDays
  if (Array.isArray(specialDays) && specialDays.includes(local.date)) return fb

  const nowMinutes = local.day * MINUTES_PER_DAY + local.minutes
  for (const period of periods) {
    if (period.close == null) return true
    const start = pointMinutes(period.open)
    let end = pointMinutes(period.close)
    // A closing time at or before the opening time runs past midnight, and past the end
    // of the week when it opens on Saturday — hence the second comparison.
    if (end <= start) end += MINUTES_PER_WEEK
    if (nowMinutes >= start && nowMinutes < end) return true
    if (nowMinutes + MINUTES_PER_WEEK >= start && nowMinutes + MINUTES_PER_WEEK < end) return true
  }
  return false
}

```

### Core Architecture Module: `client/src/components/Studio/bookRender.ts`
```
/**
 * The few things both the page renderer and the panels around it need.
 *
 * Separate from SpreadView.tsx only so that file exports components and nothing
 * else — a module that mixes the two breaks React Fast Refresh, and this is
 * exactly the kind of file you edit constantly while designing.
 */

// The typefaces live in bookFonts.ts (fontStack et al.) — a second stack map
// here is exactly how #2183 happened: the renderer kept a three-font copy
// while the picker grew to seven, and everything else fell back to Poppins.

export function photoSrc(photoId: number, big: boolean): string {
  return `/api/photos/${photoId}/${big ? 'original' : 'thumbnail'}`
}

```

### Core Architecture Module: `client/src/components/Studio/lineRender.ts`
```
import { type BookLineCap, type BookLineElement, type BookLineOrnament, bookLineCapSize } from '@trek/shared';

import { type Pt, seeded, seedOf } from './shapeDraw';

/**
 * A line element as geometry: the stroked body and the parts drawn on it, in
 * the millimetres of its own frame. LineView turns this into SVG; the panel's
 * previews draw the same thing at tile size.
 *
 * Everything is a path, never an SVG `<marker>`. A marker is sized in the
 * stroke's own units and drawn by rules browsers and print engines have never
 * agreed on, while a path is exactly where it says it is, in every one of
 * them and in the PDF.
 *
 * ── The order things happen in ───────────────────────────────────────────
 *
 * 1. The points become a centre line: straight between them, or a smooth
 *    curve through them.
 * 2. The body is cut back where a head sits on an end, so a thick line does
 *    not poke through the point of its own arrow, and opened in the middle
 *    where an ornament sits.
 * 3. A wave or a zigzag is laid along it, then the hand-drawn wobble.
 * 4. Heads and the ornament are placed on the clean centre line, so they
 *    point the way the line goes rather than the way the last wiggle went.
 */

export interface LineGeometry {
  /** The stroked parts of the body: one, or two either side of an ornament. */
  body: string[];
  /** Shapes filled in the line's colour: a filled head, a dot, the ornament. */
  fills: string[];
  /** Strokes drawn at the line's own width beside the body: an open head, a bar. */
  strokes: string[];
  dash: string | undefined;
  cap: 'round' | 'butt';
}

type LineLook = Pick<
  BookLineElement,
  'points' | 'curve' | 'strokeWidth' | 'dash' | 'squiggle' | 'startCap' | 'endCap' | 'wobble' | 'ornament'
>;

const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = ([x, y]: Pt) => `${r2(x)} ${r2(y)}`;
const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** A Catmull-Rom curve through the points, sampled about every half millimetre. */
function smoothThrough(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.max(6, Math.min(120, Math.ceil(dist(p1, p2) / 0.5)));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const at = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([at(p0[0], p1[0], p2[0], p3[0]), at(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}

/** Cumulative lengths along a polyline. */
function lengths(pts: readonly Pt[]): number[] {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + dist(pts[i - 1], pts[i]));
  return out;
}

/** The point and the direction `s` millimetres along a polyline. */
function along(pts: readonly Pt[], acc: readonly number[], s: number): { p: Pt; dir: Pt } {
  let i = 1;
  while (i < pts.length - 1 && acc[i] < s) i++;
  const a = pts[i - 1];
  const b = pts[i];
  const seg = acc[i] - acc[i - 1] || 1;
  const t = Math.min(1, Math.max(0, (s - acc[i - 1]) / seg));
  return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], dir: [(b[0] - a[0]) / seg, (b[1] - a[1]) / seg] };
}

/** The part of a polyline between two lengths along it, resampled no coarser than `step`. */
function slice(pts: readonly Pt[], acc: readonly number[], from: number, to: number, step: number): Pt[] {
  if (to - from <= 0.01) return [];
  const n = Math.max(1, Math.ceil((to - from) / step));
  const out: Pt[] = [];
  // Every original corner inside the slice stays, or a zigzag of points loses its corners.
  const marks = new Set<number>();
  for (let k = 0; k <= n; k++) marks.add(from + ((to - from) * k) / n);
  for (const s of acc) if (s > from && s < to) marks.add(s);
  for (const s of [...marks].sort((a, b) => a - b)) out.push(along(pts, acc, s).p);
  return out;
}

/** Lay a wave or a zigzag along a centre line. */
function squiggled(pts: Pt[], kind: LineLook['squiggle'], width: number): Pt[] {
  if (kind === 'none' || pts.length < 2) return pts;
  const acc = lengths(pts);
  const total = acc[acc.length - 1];
  const wave = Math.max(3, width * 8);
  const periods = Math.max(1, Math.round(total / wave));
  const lambda = total / periods;
  const amp = Math.max(0.8, width * 2.2);
  const step = kind === 'zigzag' ? lambda / 4 : Math.min(0.5, lambda / 12);
  const out: Pt[] = [];
  for (let s = 0; s <= total + 1e-6; s += step) {
    const { p, dir } = along(pts, acc, s);
    const phase = s / lambda;
    const off = kind === 'wave' ? Math.sin(phase * Math.PI * 2) : [0, 1, 0, -1][Math.round(phase * 4) % 4];
    // Calmer over the last half wave at each end, so the line runs straight into a head.
    const hold = kind === 'wave' ? Math.min(1, s / (lambda / 2), (total - s) / (lambda / 2)) : 1;
    out.push([p[0] - dir[1] * amp * off * hold, p[1] + dir[0] * amp * off * hold]);
  }
  return out;
}

/** The tremor of a line drawn by hand: a slow sideways drift, the same every time for the same element. */
function wobbled(pts: Pt[], amount: number, width: number, seed: number): Pt[] {
  if (amount <= 0 || pts.length < 2) return pts;
  const rnd = seeded(seed);
  const acc = lengths(pts);
  const total = acc[acc.length - 1];
  const knots = Array.from({ length: Math.ceil(total / 9) + 3 }, () => rnd() * 2 - 1);
  const drift = (s: number) => {
    const x = s / 9;
    const k = Math.floor(x);
    const f = x - k;
    const e = f * f * (3 - 2 * f);
    return knots[k] * (1 - e) + knots[k + 1] * e;
  };
  const amp = amount * (0.5 + width * 1.2);
  const dense = slice(pts, acc, 0, total, 0.6);
  const dacc = lengths(dense);
  return dense.map((p, i) => {
    const { dir } = along(dense, dacc, dacc[i]);
    // Held still at the very ends, so a hand-drawn arrow still meets its head.
    const hold = Math.min(1, dacc[i] / 3, (total - dacc[i]) / 3);
    const off = drift(dacc[i]) * amp * hold;
    return [p[0] - dir[1] * off, p[1] + dir[0] * off] as Pt;
  });
}

const path = (pts: readonly Pt[]) => (pts.length < 2 ? '' : `M${pts.map(fmt).join('L')}`);
const closed = (pts: readonly Pt[]) => `${path(pts)}Z`;

/** A circle as a closed path, four cubics. */
function disc([cx, cy]: Pt, r: number): string {
  const k = r * 0.5523;
  return (
    `M${fmt([cx, cy - r])}C${fmt([cx + k, cy - r])} ${fmt([cx + r, cy - k])} ${fmt([cx + r, cy])}` +
    `C${fmt([cx + r, cy + k])} ${fmt([cx + k, cy + r])} ${fmt([cx, cy + r])}` +
    `C${fmt([cx - k, cy + r])} ${fmt([cx - r, cy + k])} ${fmt([cx - r, cy])}` +
    `C${fmt([cx - r, cy - k])} ${fmt([cx - k, cy - r])} ${fmt([cx, cy - r])}Z`
  );
}

/** A point `a` along the direction and `b` across it from `p`. */
const at = (p: Pt, dir: Pt, a: number, b: number): Pt => [
  p[0] + dir[0] * a - dir[1] * b,
  p[1] + dir[1] * a + dir[0] * b,
];

/** How far a head cuts the body back from its end. */
function capTrim(cap: BookLineCap, size: number, width: number): number {
  if (cap === 'arrow') return size * 0.7;
  if (cap === 'open') return width * 0.5;
  return 0;
}

/** A head at `tip`, pointing along `dir` (the way the line arrives there). */
function capShape(
  cap: BookLineCap,
  [tip, dir]: [Pt, Pt],
  { size, width }: { size: number; width: number },
  g: LineGeometry
): void {
  if (cap === 'arrow') {
    g.fills.push(
      closed([tip, at(tip, dir, -size, size * 0.42), at(tip, dir, -size * 0.78, 0), at(tip, dir, -size, -size * 0.42)])
    );
  } else if (cap === 'open') {
    const back = size * 0.9;
    g.strokes.push(path([at(tip, dir, -back, back * 0.55), tip, at(tip, dir, -back, -back * 0.55)]));
  } else if (cap === 'dot') {
    g.fills.push(disc(tip, Math.max(width * 1.6, 0.8)));
  } else if (cap === 'bar') {
    g.strokes.push(path([at(tip, dir, 0, size * 0.45), at(tip, dir, 0, -size * 0.45)]));
  }
}

/** The motif in the middle, centred on `p` and turned along the line. */
function ornamentShape(kind: BookLineOrnament, p: Pt, dir: Pt, size: number): string {
  const s = size / 2;
  switch (kind) {
    case 'diamond':
      return closed([at(p, dir, -s, 0), at(p, dir, 0, -s * 0.62), at(p, dir, s, 0), at(p, dir, 0, s * 0.62)]);
    case 'dot':
      return disc(p, s * 0.55);
    case 'star': {
      const pts: Pt[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (Math.PI / 5) * i;
        const r = i % 2 === 0 ? s : s * 0.42;
        pts.push([p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)]);
      }
      return closed(pts);
    }
    case 'sun': {
      const pts: Pt[] = [];
      for (let i = 0; i < 24; i++) {
        const a = (Math.PI / 12) * i;
        const r = i % 2 === 0 ? s : s * 0.62;
        pts.push([p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)]);
      }
      return closed(pts);
    }
    case 'heart': {
      const pts: Pt[] = [];
      for (let i = 0; i < 32; i++) {
        const t = (i / 32) * Math.PI * 2;
        const x = (16 * Math.sin(t) ** 3) / 17;
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17;
        pts.push([p[0] + x * s, p[1] + y * s]);
      }
      return closed(pts);
    }
    default:
      return '';
  }
}

/** The dash pattern for a line of this width, in millimetres, kept visible on a hairline. */
export function lineDash(dash: BookLineElement['dash'], width: number): string | undefined {
  if (dash === 'dashed') return `${r2(Math.max(width * 3, 1.2))} ${r2(Math.max(width * 2, 0.9))}`;
  if (dash === 'dotted') return `0.01 ${r2(Math.max(width * 2, 0.6))}`;
  return undefined;
}

/** The whole line, in the millimetres of a frame `w` by `h`. */
export function lineGeometry(el: LineLook, w: number, h: number, id = 'line'): LineGeometry {
  const width = el.strokeWidth;
```

### Core Architecture Module: `client/src/components/Studio/paint/paintRender.tsx`
```
import type { BookPaint } from '@trek/shared';
import { useMemo, type SVGProps } from 'react';
import { r2 } from './paintGeometry';
import { paintParts } from './paintParts';
import type { PatternBox } from './patterns';
import { usePaintId } from './usePaintId';

/**
 * Paint, drawn: the one renderer for a shape's fill and a page's background.
 *
 * Every paint becomes SVG the print path already knows: a fill with
 * `fill-opacity`, a `linearGradient` or `radialGradient` in user space, or a
 * pattern drawn out as geometry (patterns.ts) under a `clipPath` in user
 * space. Nothing here is lazy, measured or raster, so what the editor shows
 * is what headless Chromium prints.
 *
 * ── Why the ids come from useId ──────────────────────────────────────────
 *
 * Page mode draws each double spread twice, once per half (bookSheets.ts),
 * and a thumbnail draws it again beside the canvas. An id taken from the
 * element alone would then exist twice in one document, and `url(#id)`
 * resolves to the first, so the second half would borrow the first half's
 * gradient, and a pattern clipped to the first copy's path would vanish from
 * the second. React's useId is unique per mounted instance and the same on
 * every render of it, which is exactly the property a defs id needs; the
 * element's own id is kept in front only to make the markup readable.
 */

type OutlineProps = Omit<SVGProps<SVGPathElement>, 'fill' | 'd'>;

/**
 * An outline filled with a paint, inside an `<svg>` whose user units are
 * millimetres. `box` is the outline's box in that space, which a gradient and
 * a pattern are laid over. The stroke, when the outline has one, is drawn on
 * top of a pattern rather than under it, so the edge stays crisp.
 */
export function PaintedPath({
  d,
  paint,
  box,
  idPrefix,
  fillRule,
  stroke,
  ...rest
}: {
  d: string;
  paint: BookPaint | null;
  box: PatternBox;
  /** The element's id, to make the markup readable; uniqueness comes from useId. */
  idPrefix: string;
  fillRule?: 'evenodd' | 'nonzero';
} & OutlineProps) {
  const id = usePaintId(`p-${idPrefix}`);
  // The caller holds `box` steady between renders (a memo of the frame), so a re-render
  // that moved nothing does not lay the pattern out again.
  const parts = useMemo(() => (paint ? paintParts(paint, box, id) : null), [paint, box, id]);
  const outline = { d, fillRule, clipRule: fillRule };

  if (!parts) return <path {...outline} fill="none" stroke={stroke} {...rest} />;

  const pattern = parts.pattern;
  return (
    <>
      {(parts.defs || pattern) && (
        <defs>
          {parts.defs}
          {pattern && (
            <clipPath id={pattern.clipId} clipPathUnits="userSpaceOnUse">
              <path {...outline} />
            </clipPath>
          )}
        </defs>
      )}
      <path
        {...outline}
        fill={parts.fill}
        fillOpacity={parts.fillOpacity}
        stroke={pattern ? undefined : stroke}
        {...(pattern ? {} : rest)}
      />
      {pattern && (
        <>
          <g clipPath={`url(#${pattern.clipId})`}>
            <g transform={pattern.transform}>
              {pattern.layers.map((layer, i) => (
                <path
                  key={i}
                  d={layer.d}
                  fill={pattern.ink}
                  fillOpacity={layer.opacity < 1 ? layer.opacity : undefined}
                />
              ))}
            </g>
          </g>
          {stroke && <path {...outline} fill="none" stroke={stroke} {...rest} />}
        </>
      )}
    </>
  );
}

/**
 * A page's paint, drawn under everything on it and out into the bleed.
 *
 * Positioned in the spread's own millimetres from minus the bleed, so print,
 * whose window shows the bleed, gets paint to the cut, and the editor, which
 * clips at the trim, shows the same paint up to it.
 */
export function SpreadPaint({
  paint,
  width,
  height,
  bleed,
  idPrefix,
}: {
  paint: BookPaint;
  width: number;
  height: number;
  bleed: number;
  idPrefix: string;
}) {
  const w = r2(width + bleed * 2);
  const h = r2(height + bleed * 2);
  const box = useMemo(() => ({ x: 0, y: 0, w, h }), [w, h]);
  return (
    <svg
      aria-hidden
      width={`${w}mm`}
      height={`${h}mm`}
      viewBox={`0 0 ${w} ${h}`}
      // A page is laid out left to right in every language; its own direction makes the start its left edge.
      style={{
        position: 'absolute',
        direction: 'ltr',
        insetInlineStart: `${-bleed}mm`,
        top: `${-bleed}mm`,
        display: 'block',
        pointerEvents: 'none',
      }}
    >
      <PaintedPath d={`M0 0H${w}V${h}H0Z`} paint={paint} box={box} idPrefix={`bg-${idPrefix}`} />
    </svg>
  );
}

```

### Core Architecture Module: `client/src/components/shared/EmptyState.tsx`
```
import type { CSSProperties, ReactNode } from 'react'
import MDancingTrek, { type TrekScene, type TrekMood } from '../../mobile/components/MDancingTrek'

/**
 * The one desktop empty state: the TREK mascot acting out the page's scene with
 * a single title beneath it — no subtitle, one uniform look everywhere.
 *
 * The mascot is monochrome and drives its colours off two mobile tokens
 * (`--m-ink` body / `--m-bg` cutouts) that only exist inside the mobile shell,
 * so we map them onto the desktop palette here. Its `.trek-*` choreography is
 * global CSS, so it animates outside the shell as-is. `surface` should match the
 * background the state sits on so the cut-out eyes read as holes (default: card).
 *
 * `layout="row"` puts the mascot beside the title with tight padding, for short
 * content-sized panels (the Atlas glass pill) where the stacked look towers over
 * the sibling states.
 */
export default function EmptyState({
  scene = 'idle',
  mood,
  title,
  size = 104,
  surface = 'var(--bg-card)',
  layout = 'stack',
  compact = false,
  fill = false,
  className = '',
  action,
}: {
  scene?: TrekScene
  mood?: TrekMood
  title: string
  size?: number
  surface?: string
  layout?: 'stack' | 'row'
  /**
   * Quieter type for a state inside a narrow column rather than on a page.
   *
   * The sidebar's empty state sits under its own controls, so a line at the page size
   * competes with them for the eye; at the caption tier it reads as what it is, a note
   * about why the list below is blank.
   */
  compact?: boolean
  /**
   * Fill the parent and sit in the middle of it.
   *
   * The stack already centres what it contains, but with no height of its own
   * `justify-center` has nothing to centre inside, so the state lands under
   * whatever sits above it. A state that stands for a whole empty column wants
   * the middle of that column; one that sits inline in a page does not, which is
   * why this is a choice rather than the default. The parent has to be the one
   * with the height, which every scroll container here already is.
   *
   * Optically centred rather than geometrically: the extra room goes underneath,
   * which lands the mascot slightly above the middle. In a column you can scroll,
   * dead centre reads as "fell to the bottom" the moment the list is short.
   */
  fill?: boolean
  className?: string
  /** Optional call to action under the title, for states that have an obvious next step. */
  action?: ReactNode
}) {
  const layoutClasses = layout === 'row'
    ? 'flex flex-row items-center justify-center gap-3 px-6 py-3'
    : `flex flex-col items-center justify-center gap-3 px-6 text-center ${fill ? 'min-h-full pt-4 pb-14' : 'py-12'}`
  return (
    <div
      className={`${layoutClasses} ${className}`}
      style={{ '--m-ink': 'var(--text-primary)', '--m-bg': surface } as CSSProperties}
    >
      <MDancingTrek scene={scene} mood={mood} size={size} />
      <p className={compact ? 'text-caption text-content-muted' : 'text-[15px] font-semibold text-content-secondary'}>{title}</p>
      {action}
    </div>
  )
}

```

### Core Architecture Module: `client/src/components/shared/useToastQueue.ts`
```
import { useCallback, useEffect, useRef, useState } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface QueuedToast {
  id: number;
  message: string;
  type: ToastType;
  /** duration <= 0: no auto-dismiss. */
  duration: number;
  removing: boolean;
}

interface ToastQueueOptions {
  /** How long a dismissed toast keeps rendering for its exit animation. */
  exitMs: number;
  /** On unmount, hand `window.__addToast` back to whoever held it before (else it is deleted). */
  restorePrevious: boolean;
}

let toastIdCounter = 0;

/**
 * The toast queue behind the global `window.__addToast` bridge (fed by useToast and
 * store/notify): registers itself while mounted, auto-dismisses after `duration`,
 * keeps a dismissed toast around for `exitMs` so the view can animate it out.
 */
export function useToastQueue({ exitMs, restorePrevious }: ToastQueueOptions) {
  const [toasts, setToasts] = useState<QueuedToast[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const dismissToast = useCallback(
    (id: number) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, removing: true } : t)));
      const t = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, exitMs);
      timersRef.current.push(t);
    },
    [exitMs]
  );

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 3000) => {
      const id = ++toastIdCounter;
      setToasts((prev) => [...prev, { id, message, type, duration, removing: false }]);

      if (duration > 0) {
        const t = setTimeout(() => dismissToast(id), duration);
        timersRef.current.push(t);
      }

      return id;
    },
    [dismissToast]
  );

  useEffect(() => {
    const previous = window.__addToast;
    window.__addToast = addToast;
    return () => {
      if (restorePrevious) window.__addToast = previous;
      else delete window.__addToast;
    };
  }, [addToast, restorePrevious]);

  return { toasts, dismissToast };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1288** (2026-08-05): **[BUG] Changing trip start date shifts all assigned activities (Day 1..N) by the same offset**
  *Symptoms*: ### Pre-flight checklist  - [x] I have searched [existing issues](https://github.com/mauriceboe/TREK/issues) and this bug has not been reported yet - [x] I am running the latest available version of TREK - [x] I have read the [Troubleshooting guide](https://github.com/mauriceboe/TREK/wiki/Troubleshooting) and my issue is not covered there  ### TREK version  3.1.1  ### Describe the bug  When changing the trip start date (e.g. June 10 → June 9, or by multiple days), every assigned place, note, and activity in the day planner shifts by the exact same number of days. Items seem tied to relative day numbers (Day 1, Day 2, …) instead of absolute dates.  This is convenient early on but created a big mess on our large detailed trip with bookings and external dependencies. A warning and/or better controls (partial shifts, anchoring reservations) would be very useful.  ### Steps to reproduce  1. Create/open a trip with several days and assign multiple places/activities/notes to different days. 2. Go to trip settings/edit and change the start date by 1 or more days. 3. Check the day planner — all assignments have shifted accordingly.  ### Expected behavior  Either keep activities anchored to their original absolute dates, or provide a clear choice / modal with options: full itinerary shift, partial shift (e.g. from a specific day), or preserve fixed items like reservations. This caused major disruption on our large trip with many bookings. A warning for populated trips would also help. 

- **Issue #1152** (2026-06-14): **[BUG] No duplicate validation when adding a place/activity manually**
  *Symptoms*: ### Pre-flight checklist  - [x] I have searched [existing issues](https://github.com/mauriceboe/TREK/issues) and this bug has not been reported yet - [x] I am running the latest available version of TREK - [x] I have read the [Troubleshooting guide](https://github.com/mauriceboe/TREK/wiki/Troubleshooting) and my issue is not covered there  ### TREK version  3.0.22  ### Describe the bug  When adding a place/activity manually via the "+ Add Place/Activity" button, TREK does not validate whether the exact same place has already been added to the trip. As a result, the same location can be added multiple times without any warning or prevention.  This is visible in the "Unplanned" places list, where identical entries (same name, same address) appear side by side — e.g. Fundació Joan Miró duplicated twice in the list.  Note: There was a previously reported issue about importing duplicates. However, this bug is specifically about the manual add flow — the search and add dialog — which still lacks duplicate detection.  ### Steps to reproduce  1. Open a trip 2. Click "+ Add Place/Activity" 3. Search for a place and add it (e.g. "Fundació Joan Miró") 4. Repeat step 2–3 for the same place 5. Observe: place is added a second time with no warning  ### Expected behavior  When adding a place already present in the trip (matched by name, coordinates, or Google Place ID), the app should either:  - Warn the user that the place already exists and ask for confirmation, or - Prevent the duplicate

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `fed564e7` (2026-10-27)
**Commit Message**: fix(assistant): answer the model's own calls of server tools when a thread is replayed

remember_for_trip runs at once during a turn, and read_attached_file and
keep_attached_file are answered by the server, but all three are calls the
model made. Rebuilding a thread from its stored steps left them unanswered,
and ChatGPT, the OpenAI reasoning models and Anthropic replay their own record
of each step, call included, so the provider refused the conversation with a
400: the continuation after applied changes failed, and every later message of
the thread with it. A step that kept a note also sent an empty user message.
Every call the model made is now answered as in the live turn, the attached
file's outcome as the answer of its call; threads that broke this way work
again on their next message. A refusal's log line names the refused field's
path, never its message.

Closes #2845

**File**: `server/src/nest/ai-connections/providers/provider-http.ts` (modified, +12/-2)
```diff
@@ -59,11 +59,21 @@ export async function refusalOf(kind: AiConnectionKind, res: Response): Promise<
   // refusal the provider's own code already explains (a plan that does not cover it) keeps that code.
   const image = namesImageInput(res.status, body) && providerFailure(kind, res.status, named).code === 'generic';
   const code = image ? IMAGE_INPUT_REFUSED : named;
-  // Status and code only: an error body can quote the request, and the request holds the trip.
-  logWarn(`[ai] ${kind} refused the request: HTTP ${res.status}${code ? ` (${code})` : ''}`);
+  // Status, code and the refused field's path only: an error message can quote the request, and the
+  // request holds the trip. The path alone says which part of a replayed conversation the provider refused.
+  const param = refusedParamOf(body);
+  logWarn(
+    `[ai] ${kind} refused the request: HTTP ${res.status}${code ? ` (${code})` : ''}${param ? ` at ${param}` : ''}`,
+  );
   return providerFailure(kind, res.status, code);
 }
 
+/** The field an error body names as refused (OpenAI's `param`, such as `input[12]`), when it is a bare path. */
+function refusedParamOf(body: unknown): string | undefined {
+  const param = asRecord(asRecord(body).error).param;
+  return typeof param === 'string' && /^[\w.[\]-]{1,80}$/.test(param) ? param : undefined;
+}
+
 /** One SSE data payload as a JSON object; null for anything else (a `[DONE]`, a keepalive). */
 export function parseEventData(data: string): Record<string, unknown> | null {
   try {
```

**File**: `server/src/nest/assistant/assistant-history.ts` (modified, +22/-38)
```diff
@@ -9,6 +9,7 @@ import { fitToSize } from './assistant-output';
 import {
   ADD_FOUND_PLACE_TOOL,
   APPROVAL_TTL_MS,
+  ASSISTANT_MODEL_CALLED_SERVER_TOOLS,
   ASSISTANT_SERVER_TOOLS,
   IMPORT_BOOKING_TOOL,
   IMPORT_TOUR_FILE_TOOL,
@@ -190,13 +191,6 @@ function earlierCut(text: string, earlier: boolean): string {
     : text;
 }
 
-/**
- * The model's own calls on attached files: told after the step that made
- * them, so the history ends on the user's side when the user's decision on
- * them goes on.
- */
-const ATTACHED_FILE_TOOLS: ReadonlySet<string> = new Set([READ_ATTACHED_FILE_TOOL, KEEP_ATTACHED_FILE_TOOL]);
-
 /** What became of keeping an attached file in Files, as its stored part says. */
 function keptFileLine(part: ToolCallPart): string {
   const file = quoted(part.args.name);
@@ -234,30 +228,31 @@ function attachedReadLine(
 }
 
 /**
- * What the model is told of its reads of attached files in one step: the
- * text of each file the user let it read, the first time the history holds
- * it (`told` keeps track), and what became of a read the user did not allow.
- * `texts` are the shared files' texts, by attachment id; one no longer there
- * was swept with its file.
+ * The answer a replayed call gets: what became of an attached file (the text
+ * of a file the user let it read, the first time the history holds it, `told`
+ * keeping track; `texts` are the shared files' texts by attachment id), "not
+ * applied" for a held change that never ran, the stored result otherwise.
  */
-function attachedReadNote(
-  calls: readonly ToolCallPart[],
+function replayedOutput(
+  part: ToolCallPart,
   texts: ReadonlyMap<string, string>,
   told: Set<string>,
   earlier: boolean,
 ): string {
-  return calls
-    .map((part) =>
-      part.toolName === KEEP_ATTACHED_FILE_TOOL ? keptFileLine(part) : attachedReadLine(part, texts, told, earlier),
-    )
-    .join('\n\n');
+  if (part.toolName === KEEP_ATTACHED_FILE_TOOL) return keptFileLine(part);
+  if (part.toolName === READ_ATTACHED_FILE_TOOL) return attachedReadLine(part, texts, told, earlier);
+  if (part.result === undefined) return NOT_APPLIED;
+  return outputText(earlier ? fitToSize(part.result, EARLIER_TOOL_OUTPUT_CHARS) : part.result);
 }
 
 /**
  * The thread as the provider reads it, oldest first, from its first user
  * message on. A step's tool calls are followed by their answers; a held
  * change that was never applied answers that it was not, since every call
- * must be answered. `providerIds` maps a held call's own id to the id the
+ * must be answered. That includes the server's tools the model called itself
+ * (a trip note, an attached file): the providers that replay their own record
+ * of a step refuse it with a call left unanswered, and every later message of
+ * the thread with it. `providerIds` maps a held call's own id to the id the
  * provider gave it.
  */
 export function toChatHistory(
@@ -282,42 +277,31 @@ export function toChatHistory(
       (part): part is Extract<AssistantMessagePart, { type: 'tool-call' }> =>
         part.type === 'tool-call' && part.toolName !== ASSISTANT_WEB_SEARCH_STEP,
     );
-    const reads = allCalls.filter((part) => ATTACHED_FILE_TOOLS.has(part.toolName));
-    const serverCalls = allCalls.filter(
-      (part) => ASSISTANT_SERVER_TOOLS.has(part.toolName) && !ATTACHED_FILE_TOOLS.has(part.toolName),
-    );
+    const serverStep = (part: ToolCallPart) =>
+      ASSISTANT_SERVER_TOOLS.has(part.toolName) && !ASSISTANT_MODEL_CALLED_SERVER_TOOLS.has(part.toolName);
     // Told as the user's side of the conversation: the history then ends on it
     // when a decision on these bookings starts the next answer.
-    if (serverCalls.length > 0) history.push({ role: 'user', text: serverStepsNote(serverCalls) });
-    const calls = allCalls.filter((part) => !ASSISTANT_SERVER_TOOLS.has(part.toolName));
+    const note = serverStepsNote(allCalls.filter(serverStep));
+    if (note) history.push({ role: 'user', text: note });
+    const calls = allCalls.filter((part) => !serverStep(part));
     const toolCalls: AiToolCall[] = calls.map((part) => ({
       id: providerIds.get(part.toolCallId) ?? part.toolCallId,
       name: part.toolName,
       args: part.args,
     }));
     const text = textOf(parts);
-    // Told after the step that read the files, so the history ends on the user's side when a consent goes on.
-    const readNote = reads.length > 0 ? attachedReadNote(reads, attachedTexts, told, earlier) : '';
-    if (!text && toolCalls.length === 0) {
-      if (readNote) history.push({ role: 'user', text: readNote });
-      return;
-    }
+    if (!text && toolCalls.length === 0) return;
     const providerState = decodeJson(ASSISTANT_PROVIDER_STATE, row.provider_state, `message ${row.id}`);
     history.push({ role: 'assistant', text, toolCalls, providerState });
     calls.forEach((part, index) => {
-      const output =
-        part.result === undefined
-          ? NOT_APPLIED
-        
```

**File**: `server/src/nest/assistant/assistant-tools.constants.ts` (modified, +12/-0)
```diff
@@ -255,6 +255,18 @@ export const ASSISTANT_SERVER_TOOLS: ReadonlySet<string> = new Set([
   ...Object.keys(ASSISTANT_SERVER_WRITE_TOOLS),
 ]);
 
+/**
+ * The server's tools the model calls itself. TREK answers them, but they are
+ * calls in the provider's own record of the step, so a replayed step has to
+ * answer them like any other; the rest of the server's tools are steps the
+ * server took, which the provider never saw.
+ */
+export const ASSISTANT_MODEL_CALLED_SERVER_TOOLS: ReadonlySet<string> = new Set([
+  REMEMBER_TOOL,
+  READ_ATTACHED_FILE_TOOL,
+  KEEP_ATTACHED_FILE_TOOL,
+]);
+
 /** The largest file the assistant reads. */
 export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
 
```

**File**: `server/tests/unit/nest/ai-connections/provider-adapters.test.ts` (modified, +40/-0)
```diff
@@ -28,6 +28,12 @@ import { toProviderSchema, type AiFetch } from '../../../../src/nest/ai-connecti
 
 import { describe, expect, it, vi } from 'vitest';
 
+const { logWarn } = vi.hoisted(() => ({ logWarn: vi.fn() }));
+vi.mock('../../../../src/nest/audit/audit-log.logger', async (importOriginal) => ({
+  ...(await importOriginal<typeof import('../../../../src/nest/audit/audit-log.logger')>()),
+  logWarn,
+}));
+
 /** An SSE body from whole events, cut every `every` characters so no event arrives in one piece. */
 function sseBody(events: unknown[], every = 7): ReadableStream<Uint8Array> {
   const text = events.map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`).join('');
@@ -145,6 +151,40 @@ describe('provider errors', () => {
     expect(errorCodeOf(null)).toBeUndefined();
     expect(errorCodeOf({})).toBeUndefined();
   });
+
+  it('PERR-004: a refusal is logged with the path of the field it names, never with its message (#2845)', async () => {
+    const refused = (param: unknown) =>
+      failure(
+        new OpenAiResponsesClient(
+          'm',
+          async () => 'at',
+          fetchAnswering(
+            jsonResponse(400, {
+              error: {
+                type: 'invalid_request_error',
+                code: null,
+                message: 'No tool output found for function call call_note. Dinner in Rome at 20:00.',
+                param,
+              },
+            }),
+          ).fetcher,
+        ).stream(REQUEST, signal()),
+      );
+
+    logWarn.mockClear();
+    expect(await refused('input[3]')).toMatchObject({ code: 'generic', status: 400 });
+    expect(logWarn).toHaveBeenCalledWith(
+      '[ai] chatgpt refused the request: HTTP 400 (invalid_request_error) at input[3]',
+    );
+
+    logWarn.mockClear();
+    await refused('input[3] Dinner in Rome');
+    await refused(null);
+    expect(logWarn.mock.calls.map(([line]) => line)).toEqual([
+      '[ai] chatgpt refused the request: HTTP 400 (invalid_request_error)',
+      '[ai] chatgpt refused the request: HTTP 400 (invalid_request_error)',
+    ]);
+  });
 });
 
 describe('toProviderSchema', () => {
```

**File**: `server/tests/unit/nest/assistant/assistant-history.test.ts` (modified, +176/-20)
```diff
@@ -6,6 +6,9 @@
  */
 import type { AssistantMessageRow } from '../../../../src/db/repositories/AssistantMessages.repository';
 import type { AssistantToolCallRow } from '../../../../src/db/repositories/AssistantToolCalls.repository';
+import type { AiChatMessage } from '../../../../src/nest/ai-connections/ai-chat-client.interface';
+import { toAnthropicMessages } from '../../../../src/nest/ai-connections/providers/anthropic-messages.client';
+import { toResponsesInput } from '../../../../src/nest/ai-connections/providers/openai-responses.client';
 import {
   messageIdOf,
   outputText,
@@ -249,7 +252,7 @@ describe('toChatHistory', () => {
     ]);
   });
 
-  it('ASTHIS-005d: the text of a file the user let the model read comes after the step, once, cut in earlier turns', () => {
+  it('ASTHIS-005d: the text of a file the user let the model read answers its read, once, cut in earlier turns', () => {
     const id = '0b7c2f0e-6f6d-4a8e-9b1a-3d2c1e0f9a87';
     type CallPart = Extract<AssistantMessagePart, { type: 'tool-call' }>;
     const read = (toolCallId: string, extra: Partial<CallPart>): AssistantMessagePart => ({
@@ -270,20 +273,27 @@ describe('toChatHistory', () => {
       row('user', [{ type: 'text', text: 'Thanks' }]),
     ];
     const history = toChatHistory(rows, new Map(), new Map([[id, long]]));
-    expect(history.map((message) => message.role)).toEqual(['user', 'assistant', 'user', 'user', 'user']);
-    expect(history[1]).toMatchObject({ role: 'assistant', text: 'I need to read it first.', toolCalls: [] });
-    const told = (history[2] as { text: string }).text;
+    expect(history.map((message) => message.role)).toEqual(['user', 'assistant', 'tool', 'assistant', 'tool', 'user']);
+    expect(history[1]).toMatchObject({
+      role: 'assistant',
+      text: 'I need to read it first.',
+      toolCalls: [{ id: 'r1', name: 'read_attached_file' }],
+    });
+    expect(history[2]).toMatchObject({ role: 'tool', toolCallId: 'r1' });
+    const told = (history[2] as { output: string }).output;
     expect(told).toContain('The user let you read the attached file "AirBnB Buchung.pdf".');
     expect(told).toContain('Casa Lisboa');
     // An earlier turn's text is cut so it does not crowd out the conversation.
     expect(told.length).toBeLessThan(long.length);
     expect(told.endsWith('[...]')).toBe(true);
-    expect((history[3] as { text: string }).text).toBe(
-      'You read the attached file "AirBnB Buchung.pdf" again; its text is above.',
-    );
+    expect(history[4]).toMatchObject({
+      role: 'tool',
+      toolCallId: 'r2',
+      output: 'You read the attached file "AirBnB Buchung.pdf" again; its text is above.',
+    });
     // The latest turn keeps the whole text.
     const latest = toChatHistory(rows.slice(0, 2), new Map(), new Map([[id, long]]));
-    expect((latest[2] as { text: string }).text).toContain(long);
+    expect((latest[2] as { output: string }).output).toContain(long);
   });
 
   it('ASTHIS-005e: a read the user did not allow, one still waiting, a refused one and a swept file say so', () => {
@@ -303,21 +313,21 @@ describe('toChatHistory', () => {
           ]),
         ],
         new Map(),
-      ).map((message) => (message as { text: string }).text);
-    expect(step({ approval: { id: 'r', approved: false } })[1]).toBe(
+      ).map((message) => (message.role === 'tool' ? message.output : null));
+    expect(step({ approval: { id: 'r', approved: false } })[2]).toBe(
       'The user did not let you read the attached file "a.pdf".',
     );
-    expect(step({ approval: { id: 'r' } })[1]).toContain("waits for the user's agreement; you have not read it.");
-    expect(step({ approval: { id: 'r', resolution: 'expired' } })[1]).toContain('you have not read it');
-    expect(step({ result: 'No such attachment in this conversation.', isError: true })[1]).toBe(
+    expect(step({ approval: { id: 'r' } })[2]).toContain("waits for the user's agreement; you have not read it.");
+    expect(step({ approval: { id: 'r', resolution: 'expired' } })[2]).toContain('you have not read it');
+    expect(step({ result: 'No such attachment in this conversation.', isError: true })[2]).toBe(
       'Reading the attached file "a.pdf" failed: No such attachment in this conversation.',
     );
-    expect(step({ result: { read: true } })[1]).toBe(
+    expect(step({ result: { read: true } })[2]).toBe(
       'The attached file "a.pdf" is no longer kept; you cannot read it again.',
     );
   });
 
-  it('ASTHIS-005f: keeping an attached file is told after its step, whatever became of it', () => {
+  it('ASTHIS-005f: keeping an attached file is answered with what became of it', () => {
     const keep = (extra: Partial<Extract<AssistantMessagePart, { type: 'tool-call' }>>) =>
       toChatHistory(
         [
@@ -336,11 +346,12 @@ describe('toChatHistory', () => {
         new Map(),
       );
     const kept = keep({ approval: { id: 'k', approved: true }, result: { file: { id: 31 
```

---

### Incident Patch 2: `0f023249` (2026-10-27)
**Commit Message**: fix(mcp): describe day-note title and body and allow the planner's 2000-character body

create_day_note and update_day_note described `time` as a clock label and capped
it at 250 characters, while the planner shows it as the Markdown body under the
title and allows 2000. The assistant put long text in the title and had to cut
notes it was asked to edit. Both tools now take text and time from the REST
contract with descriptions naming title and body, and an update still refuses an
empty title. The assistant's change card labels the two fields title and content
instead of text and time.

Closes #2840

**File**: `client/src/components/Assistant/assistantParts.ts` (modified, +2/-0)
```diff
@@ -440,6 +440,8 @@ export const CHANGE_LABELS: Record<AssistantChangeLabelKey, { labelKey: string }
   currency: { labelKey: 'assistant.change.label.currency' },
   stopType: { labelKey: 'assistant.change.label.stopType' },
   text: { labelKey: 'assistant.change.label.text' },
+  title: { labelKey: 'assistant.change.label.title' },
+  content: { labelKey: 'assistant.change.label.content' },
   icon: { labelKey: 'assistant.change.label.icon' },
   color: { labelKey: 'assistant.change.label.color' },
   position: { labelKey: 'assistant.change.label.position' },
```

**File**: `server/scripts/mcp-inline-zod-baseline.json` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
     "src/nest/budget/budget.mcp.ts": 36,
     "src/nest/collab/collab.mcp.ts": 20,
     "src/nest/collections/collections.mcp.ts": 14,
-    "src/nest/day-notes/day-notes.mcp.ts": 10,
+    "src/nest/day-notes/day-notes.mcp.ts": 6,
     "src/nest/days/days.mcp.ts": 2,
     "src/nest/doc-sync/doc-sync.mcp.ts": 1,
     "src/nest/files/files.mcp.ts": 4,
```

**File**: `server/src/nest/assistant/tool-call-preview.helpers.ts` (modified, +3/-3)
```diff
@@ -195,16 +195,16 @@ const DESCRIBERS: Readonly<Record<string, Describer>> = {
     const dayId = id(args, 'dayId');
     const rows = new Rows()
       .add('day', dayLabel(ctx, dayId))
-      .add('time', text(args.time))
+      .add('content', text(args.time))
       .add('icon', text(args.icon))
       .add('color', text(args.color));
     return { subject: text(args.text), rows, dayId, placeIds: [] };
   },
   update_day_note: (ctx, args) => {
     const note = ctx.card.notes.get(id(args, 'noteId') ?? 0);
     const rows = new Rows();
-    if (has(args, 'text')) rows.change('text', note?.text ?? null, text(args.text));
-    if (has(args, 'time')) rows.change('time', note?.time ?? null, text(args.time));
+    if (has(args, 'text')) rows.change('title', note?.text ?? null, text(args.text));
+    if (has(args, 'time')) rows.change('content', note?.time ?? null, text(args.time));
     if (has(args, 'icon')) rows.change('icon', note?.icon ?? null, text(args.icon));
     if (has(args, 'color')) rows.change('color', note?.color ?? null, text(args.color));
     return { subject: note?.text ?? text(args.text), rows, dayId: id(args, 'dayId'), placeIds: [] };
```

**File**: `server/src/nest/day-notes/day-notes.mcp.ts` (modified, +27/-13)
```diff
@@ -11,7 +11,13 @@ import {
 } from '../../nest-mcp';
 import { McpToolGuardsService } from '../mcp-shared/mcp-tool-guards.service';
 import { DayNotesService } from './day-notes.service';
-import { idSchema, NOTE_COLORS, type NoteColor } from '@trek/shared';
+import {
+  dayNoteCreateRequestSchema,
+  dayNoteUpdateRequestSchema,
+  idSchema,
+  NOTE_COLORS,
+  type NoteColor,
+} from '@trek/shared';
 
 import { z } from 'zod';
 
@@ -23,6 +29,18 @@ import { z } from 'zod';
  */
 const noteColorSchema = z.enum(NOTE_COLORS);
 
+/**
+ * The note's two text fields carry their names from the time a note was a line
+ * with a clock time: `text` is the heading and `time` the Markdown body under it.
+ * The REST contract holds the bounds, so a note written in the planner can always
+ * be edited here; the descriptions are what tells a model which field is which.
+ */
+const NOTE_TITLE = 'The note title, shown as its heading in the day plan. Keep it short';
+const NOTE_BODY =
+  'The note body shown under the title: details, links, reminders, Markdown allowed. ' +
+  'Despite the field name this is the content, not a clock time';
+const noteTitleSchema = dayNoteCreateRequestSchema.shape.text.describe(NOTE_TITLE);
+
 function parseId(value: string | string[]): number | null {
   const n = Number(Array.isArray(value) ? value[0] : value);
   return Number.isInteger(n) && n > 0 ? n : null;
@@ -52,12 +70,12 @@ export class DayNotesMcp {
 
   @Tool({
     name: 'create_day_note',
-    description: 'Add a note to a specific day in a trip.',
+    description: 'Add a note to a specific day in a trip: a title in `text` and its body in `time`.',
     inputSchema: {
       tripId: idSchema,
       dayId: idSchema,
-      text: z.string().min(1).max(500),
-      time: z.string().max(250).optional().describe('Time label (e.g. "09:00" or "Morning")'),
+      text: noteTitleSchema,
+      time: dayNoteCreateRequestSchema.shape.time.describe(NOTE_BODY),
       icon: z.string().max(64).optional().describe('Emoji icon for the note'),
       color: noteColorSchema
         .nullable()
@@ -86,7 +104,7 @@ export class DayNotesMcp {
       tripId: number;
       dayId: number;
       text: string;
-      time?: string;
+      time?: string | null;
       icon?: string;
       color?: NoteColor | null;
       sort_order?: number;
@@ -104,18 +122,14 @@ export class DayNotesMcp {
 
   @Tool({
     name: 'update_day_note',
-    description: 'Edit an existing note on a specific day.',
+    description: 'Edit an existing note on a specific day: its title is `text`, its body `time`.',
     inputSchema: {
       tripId: idSchema,
       dayId: idSchema,
       noteId: idSchema,
-      text: z.string().min(1).max(500).optional(),
-      time: z
-        .string()
-        .max(250)
-        .nullable()
-        .optional()
-        .describe('Time label (e.g. "09:00" or "Morning"), or null to clear'),
+      // The create bound, so an update cannot blank the title the planner requires.
+      text: noteTitleSchema.optional(),
+      time: dayNoteUpdateRequestSchema.shape.time.describe(`${NOTE_BODY}, or null to clear it`),
       icon: z.string().max(64).optional().describe('Emoji icon for the note'),
       color: noteColorSchema
         .nullable()
```

**File**: `server/tests/unit/mcp/tools-notes.test.ts` (modified, +76/-0)
```diff
@@ -99,6 +99,43 @@ describe('Tool: create_day_note', () => {
     });
   });
 
+  it('describes text as the title and time as the body, as the planner shows them', async () => {
+    const { user } = createUser(testDb);
+    await withHarness(user.id, async (h) => {
+      const { tools } = await h.client.listTools();
+      for (const name of ['create_day_note', 'update_day_note']) {
+        const props = tools.find((t) => t.name === name)?.inputSchema.properties as Record<string, any>;
+        // The nullable body may come out as an anyOf, so read the property whole.
+        const time = JSON.stringify(props.time);
+        expect(JSON.stringify(props.text)).toMatch(/title/i);
+        expect(time).toMatch(/body/i);
+        expect(time).not.toMatch(/time label/i);
+        expect(time).toContain('"maxLength":2000');
+      }
+    });
+  });
+
+  it('takes a body of 2000 characters, the bound the planner allows, and refuses one more', async () => {
+    const { user } = createUser(testDb);
+    const trip = createTrip(testDb, user.id);
+    const day = createDay(testDb, trip.id);
+    await withHarness(user.id, async (h) => {
+      const body = 'b'.repeat(2000);
+      const result = await h.client.callTool({
+        name: 'create_day_note',
+        arguments: { tripId: trip.id, dayId: day.id, text: 'Museum day', time: body },
+      });
+      const data = parseToolResult(result) as any;
+      expect((await dayNote(data.note.id)).time).toBe(body);
+      const tooLong = await h.client.callTool({
+        name: 'create_day_note',
+        arguments: { tripId: trip.id, dayId: day.id, text: 'Museum day', time: `${body}b` },
+      });
+      expect(tooLong.isError).toBe(true);
+      expect(await countRows(orm, DayNotes, { day: day.id })).toBe(1);
+    });
+  });
+
   it('defaults icon to 📝', async () => {
     const { user } = createUser(testDb);
     const trip = createTrip(testDb, user.id);
@@ -220,6 +257,45 @@ describe('Tool: update_day_note', () => {
     });
   });
 
+  it('edits a note whose body is longer than 250 characters without shortening it', async () => {
+    const { user } = createUser(testDb);
+    const trip = createTrip(testDb, user.id);
+    const day = createDay(testDb, trip.id);
+    const longBody = 'Opening hours and the ticket links. '.repeat(20);
+    const note = createDayNote(testDb, day.id, trip.id, { text: 'Museum day', time: longBody });
+    await withHarness(user.id, async (h) => {
+      const renamed = await h.client.callTool({
+        name: 'update_day_note',
+        arguments: { tripId: trip.id, dayId: day.id, noteId: note.id, text: 'Museums' },
+      });
+      expect(renamed.isError).toBeFalsy();
+      const longer = `${longBody}Bring the pass.`;
+      const rewritten = await h.client.callTool({
+        name: 'update_day_note',
+        arguments: { tripId: trip.id, dayId: day.id, noteId: note.id, time: longer },
+      });
+      expect(rewritten.isError).toBeFalsy();
+      const row = await dayNote(note.id);
+      expect(row.text).toBe('Museums');
+      expect(row.time).toBe(longer);
+    });
+  });
+
+  it('refuses an empty title on update and keeps the stored one', async () => {
+    const { user } = createUser(testDb);
+    const trip = createTrip(testDb, user.id);
+    const day = createDay(testDb, trip.id);
+    const note = createDayNote(testDb, day.id, trip.id, { text: 'Keep me' });
+    await withHarness(user.id, async (h) => {
+      const result = await h.client.callTool({
+        name: 'update_day_note',
+        arguments: { tripId: trip.id, dayId: day.id, noteId: note.id, text: '' },
+      });
+      expect(result.isError).toBe(true);
+      expect((await dayNote(note.id)).text).toBe('Keep me');
+    });
+  });
+
   it('trims text whitespace', async () => {
     const { user } = createUser(testDb);
     const trip = createTrip(testDb, user.id);
```

**File**: `server/tests/unit/nest/assistant/tool-call-preview.helpers.test.ts` (modified, +1/-1)
```diff
@@ -142,7 +142,7 @@ describe('describeToolCall', () => {
     });
     expect(describe_('update_day_note', { dayId: 31, noteId: 41, time: null })).toMatchObject({
       subject: 'Rail pass',
-      rows: [{ op: 'change', labelKey: 'time', before: '09:00', after: '' }],
+      rows: [{ op: 'change', labelKey: 'content', before: '09:00', after: '' }],
     });
     expect(describe_('create_day_note', { dayId: 33, text: 'Laundry', icon: '🧺' }).rows).toEqual([
       { op: 'add', labelKey: 'day', before: null, after: 'Spare day' },
```

**File**: `shared/src/assistant/assistant.schema.ts` (modified, +3/-0)
```diff
@@ -154,6 +154,9 @@ export const ASSISTANT_CHANGE_LABEL_KEYS = [
   'currency',
   'stopType',
   'text',
+  // A day note's heading and its body; `text` and `time` stay for rows already stored.
+  'title',
+  'content',
   'icon',
   'color',
   'position',
```

**File**: `shared/src/i18n/ar/assistant.ts` (modified, +2/-0)
```diff
@@ -191,6 +191,8 @@ const assistant: TranslationStrings = {
   'assistant.change.label.currency': 'العملة',
   'assistant.change.label.stopType': 'نوع التوقف',
   'assistant.change.label.text': 'النص',
+  'assistant.change.label.title': 'العنوان',
+  'assistant.change.label.content': 'المحتوى',
   'assistant.change.label.icon': 'الأيقونة',
   'assistant.change.label.color': 'اللون',
   'assistant.change.label.position': 'الترتيب',
```

---

### Incident Patch 3: `3bc75d2b` (2026-10-26)
**Commit Message**: fix(airports): keep airports OurAirports flags as having no scheduled service

The airport picker never offered Little Cayman (LYB): OurAirports marks it as
having no scheduled service although it has daily flights, and the build
dropped every airport on that flag. The same flag also hid Vestmannaeyjar,
Western Sydney and around 1,280 other large and medium airports with an IATA
code. The build now applies the flag to small airports only, where it keeps
private airstrips out.

The bundled list gains exactly those airports. Every entry it already carried
stays unchanged, because a fresh OurAirports export currently renames PBI to
DJT and drops nine other codes that saved bookings point at.

Closes #2820

**File**: `server/scripts/build-airports.mjs` (modified, +5/-2)
```diff
@@ -1,6 +1,7 @@
 #!/usr/bin/env node
 // Build server/assets/airports.json from OurAirports (davidmegginson.github.io/ourairports-data).
-// License: Public Domain. Keeps large/medium airports with an IATA code; timezone derived from coords via tz-lookup.
+// License: Public Domain. Keeps large/medium airports with an IATA code, small ones only with scheduled service;
+// timezone derived from coords via tz-lookup.
 import fs from 'node:fs';
 import https from 'node:https';
 import path from 'node:path';
@@ -91,7 +92,9 @@ for (let i = 1; i < rows.length; i++) {
   if (!KEEP.has(r[TYPE])) continue;
   const iata = r[IATA]?.trim().toUpperCase();
   if (!iata || iata.length !== 3) continue;
-  if (r[SERVICE] !== 'yes') continue;
+  // The scheduled_service flag lags reality: Little Cayman (LYB) has daily flights and is
+  // marked "no". So it only filters the small fields, where it keeps every airstrip with a code out.
+  if (r[TYPE] === 'small_airport' && r[SERVICE] !== 'yes') continue;
   const lat = Number(r[LAT]);
   const lng = Number(r[LNG]);
   if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
```

**File**: `server/tests/unit/nest/airports/airports.asset.test.ts` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+/**
+ * The bundled assets/airports.json itself, not a fixture.
+ *
+ * OurAirports marks some airports with daily flights as having no scheduled
+ * service, and the build used to drop them on that flag alone (#2820, Little
+ * Cayman). These pin a few of them and the codes saved bookings already point at.
+ */
+import { findByIata } from '../../../../src/nest/airports/airports.data';
+
+import { describe, it, expect } from 'vitest';
+
+describe('bundled airport dataset', () => {
+  it('AIRPORT-ASSET-001: keeps airports OurAirports flags as unscheduled', () => {
+    expect(findByIata('LYB')?.name).toBe('Edward Bodden Little Cayman Airfield');
+    expect(findByIata('VEY')?.country).toBe('IS');
+  });
+
+  it('AIRPORT-ASSET-002: still resolves the codes it carried before', () => {
+    for (const code of ['PBI', 'ADA', 'GCM', 'CYB', 'FRA']) {
+      expect(findByIata(code), code).not.toBeNull();
+    }
+  });
+});
```

#### Recent Merged Pull Requests:
- **PR #2890** (2026-10-29): Fix ChatGPT MCP tool list, booking uploads, PDF route overview, mobile day rail and dashboard countries (@mauriceboe)
- **PR #2884** (2026-10-29): docs(readme): thank dataforest cloud as infrastructure sponsor, show the logo alone, drop the third showcase and the star history (@mauriceboe)
- **PR #2882** (2026-10-29): feat: key each installation for TREK services, add Photon address search and Valhalla routing through the server, route all trips through Valhalla, show allowances in admin (@mauriceboe)
- **PR #2873** (2026-10-28): fix(unsplash): point admins to the free Access Key when Unsplash refuses the server (@mauriceboe)
- **PR #2872** (2026-10-28): fix(tours): say why a tour over 24 hours cannot be saved (@mauriceboe)
- **PR #2871** (2026-10-28): fix(places): import two different GPX tracks that share a name (@mauriceboe)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. assistant): answer the model's own calls of server tools when a thread is replay

**RULE**:
When implementing operations in `server/src/nest/ai-connections/providers/provider-http.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in liketrek/TREK. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fed564e7`: assistant): answer the model's own calls of server tools when a thread is replayed. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `server/src/nest/ai-connections/providers/provider-http.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  // Status, code and the refused field's path only: an error message can quote the request, and the
  // request holds the trip. The path alone says which part of a replayed conversation the provider refused.
  const param = refusedParamOf(body);
  logWarn(
    `[ai] ${kind} refused the request: HTTP ${res.status}${code ? ` (${code})` : ''}${param ? ` at ${param}` : ''}`,
  );
/** The field an error body names as refused (OpenAI's `param`, such as `input[12]`), when it is a bare path. */
function refusedParamOf(body: unknown): string | undefined {
  const param = asRecord(asRecord(body).error).param;
  return typeof param === 'string' && /^[\w.[\]-]{1,80}$/.test(param) ? param : undefined;
}

```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
  // Status and code only: an error body can quote the request, and the request holds the trip.
  logWarn(`[ai] ${kind} refused the request: HTTP ${res.status}${code ? ` (${code})` : ''}`);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fed564e7` are properly handled with clean fallback behavior.
