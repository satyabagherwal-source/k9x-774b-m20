# Forensic Learning Record (Deep Inspection): tt-a1i/archify

> **Canonical Artifact**: `07_PROJECT_LEARNING/tt-a1i-archify-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tt-a1i/archify](https://github.com/tt-a1i/archify))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:29:29.234Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tt-a1i/archify`
- **Description**: Turn any idea, plan, or codebase into a beautiful interactive diagram. An agent skill for Claude Code, Codex, and more.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 78266 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `archify/renderers/architecture/grid.mjs`
```
/** Grid placement for architecture IR (#8). Not auto-layout — fixed cell math only. */

export const DEFAULT_GRID = {
  mode: 'grid',
  origin: [40, 80],
  cols: 4,
  gapX: 30,
  gapY: 40,
  cellW: 130,
  cellH: 64,
};

export function gridLayout(arch) {
  const raw = arch.layout;
  if (!raw || raw.mode !== 'grid') return null;
  return { ...DEFAULT_GRID, ...raw };
}

export function resolveComponentPos(component, grid) {
  if (Array.isArray(component.pos) && component.pos.length === 2) {
    return component.pos;
  }
  if (!grid) return [NaN, NaN];
  if (!Number.isInteger(component.row) || !Number.isInteger(component.col)) {
    return [NaN, NaN];
  }
  const [ox, oy] = grid.origin;
  const stepX = grid.cellW + grid.gapX;
  const stepY = grid.cellH + grid.gapY;
  return [ox + component.col * stepX, oy + component.row * stepY];
}

export function validateGridPlacement(arch, grid, problems) {
  if (!grid) return;
  if (arch.layout !== undefined && arch.layout.mode !== 'grid') {
    problems.push('layout.mode must be "grid" when layout is set (free placement omits layout entirely).');
    return;
  }
  const seen = new Map();
  for (const c of arch.components ?? []) {
    const hasPos = Array.isArray(c.pos) && c.pos.length === 2;
    const hasCell = Number.isInteger(c.row) && Number.isInteger(c.col);
    if (hasPos) continue; // pos wins; row/col are optional hints only
    if (!hasPos && !hasCell) {
      problems.push(`Component "${c.id}" needs pos [x,y] or grid row/col when layout.mode is "grid".`);
      continue;
    }
    if (c.row < 0 || c.col < 0) {
      problems.push(`Component "${c.id}" row/col must be non-negative integers.`);
      continue;
    }
    if (c.col >= grid.cols) {
      problems.push(`Component "${c.id}" col ${c.col} exceeds layout.cols ${grid.cols} (valid: 0..${grid.cols - 1}).`);
    }
    const key = `${c.row},${c.col}`;
    if (seen.has(key)) {
      problems.push(`Components "${seen.get(key)}" and "${c.id}" share grid cell row ${c.row} col ${c.col}.`);
    } else {
      seen.set(key, c.id);
    }
  }
}

```

### Core Architecture Module: `archify/renderers/architecture/labels.mjs`
```
import { normalizeRoutePoints, rectsOverlap, segmentRectClearanceWithin } from '../shared/geometry.mjs';
import { createSpatialGrid } from '../shared/spatial-grid.mjs';

// A bounded fallback for an unpinned label whose usual position collides.
// It never routes an edge, moves a node, expands the canvas, or rewrites input.
export function placeAutomaticLabels({
  labels, routes, components, titles, viewBox, placementBottom = viewBox[1], fallbackRing = true, keepFallbackNearRoute = false,
  gridSweep = false,
}) {
  const placed = [...labels];
  const obstacles = [...components, ...titles];
  const segments = routes.flatMap(({ relationIndex, points }) => {
    const normalized = normalizeRoutePoints(points);
    return normalized.slice(1).map((end, index) => ({ relationIndex, start: normalized[index], end }));
  });
  const inside = rect => (
    rect.x >= 0 && rect.y >= 0
    && rect.x + rect.width <= viewBox[0] && rect.y + rect.height <= viewBox[1]
  );
  // The mask test asked every segment about every candidate position. Segments
  // go into a uniform grid once, and a candidate only asks the cells it covers.
  const SEGMENT_CELL = 120;
  const segmentGrid = createSpatialGrid(SEGMENT_CELL);
  for (const segment of segments) {
    const [sx, sy] = segment.start;
    const [ex, ey] = segment.end;
    segmentGrid.insert({
      minX: Math.min(sx, ex), maxX: Math.max(sx, ex),
      minY: Math.min(sy, ey), maxY: Math.max(sy, ey),
    }, segment);
  }
  const segmentsNear = (rect, margin) => segmentGrid.query({
    minX: rect.x - margin, maxX: rect.x + rect.width + margin,
    minY: rect.y - margin, maxY: rect.y + rect.height + margin,
  });
  const masksRoute = rect => {
    for (const segment of segmentsNear(rect, 4)) {
      if (segment.relationIndex === rect.relationIndex) continue;
      if (segmentRectClearanceWithin(segment, rect, 4) + 0.0001 < 4) return true;
    }
    return false;
  };
  const overlapsLabel = (rect, index, gap = 0) => placed.some((other, otherIndex) => (
    otherIndex !== index && rectsOverlap(rect, other, gap)
  ));
  const clear = (rect, index) => (
    inside(rect) && rect.y + rect.height <= placementBottom
    && !obstacles.some(obstacle => rectsOverlap(rect, obstacle, 2))
    && !overlapsLabel(rect, index, 2) && !masksRoute(rect)
  );
  const rectAt = (label, lx, ly) => ({
    ...label, lx, ly, x: lx - label.width / 2, y: ly - 10,
  });
  // An opted-in grid layout runs parallel lines through shared gaps. Rank
  // every position along all of the label's own segments: beside the line
  // first, then centred on its own line (the plate interrupts only that
  // line), then stepping outward past neighbouring parallels.
  const gridCandidates = (label) => {
    const fractions = [0.5, 0.25, 0.75, 0.375, 0.625, 0.125, 0.875];
    const ranked = [];
    // A close parallel of another relationship on one side (a reciprocal
    // pair) makes a label on that side read as the neighbour's: prefer the
    // far side.
    const parallelOnLowSide = (a, b, axis) => {
      const across = 1 - axis;
      const [low, high] = [Math.min(a[axis], b[axis]), Math.max(a[axis], b[axis])];
      let nearest = null;
      for (const other of segments) {
        if (other.relationIndex === label.relationIndex) continue;
        if (Math.abs(other.start[across] - other.end[across]) > 0.0001) continue;
        const distance = other.start[across] - a[across];
        if (Math.abs(distance) < 0.0001 || Math.abs(distance) > 36) continue;
        const overlap = Math.min(high, Math.max(other.start[axis], other.end[axis]))
          - Math.max(low, Math.min(other.start[axis], other.end[axis]));
        if (overlap <= 0) continue;
        if (nearest === null || Math.abs(distance) < Math.abs(nearest)) nearest = distance;
      }
      return nearest !== null && nearest < 0;
    };
    for (const { start: a, end: b } of segments.filter(segment => segment.relationIndex === label.relationIndex)) {
      if (Math.abs(a[1] - b[1]) < 0.0001 && Math.abs(a[0] - b[0]) >= label.width + 16) {
        const [above, below] = parallelOnLowSide(a, b, 0) ? [1, 0] : [0, 1];
        for (const fraction of fractions) {
          const x = a[0] + (b[0] - a[0]) * fraction;
          if (Math.min(Math.abs(x - a[0]), Math.abs(x - b[0])) < label.width / 2 + 6) continue;
          ranked.push([above, x, a[1] - 10], [below, x, a[1] + 20], [2, x, a[1] + 3], [3, x, a[1] - 18], [3, x, a[1] + 28]);
        }
      } else if (Math.abs(a[0] - b[0]) < 0.0001 && Math.abs(a[1] - b[1]) >= label.height + 16) {
        const leftFirst = !parallelOnLowSide(a, b, 1);
        for (const fraction of fractions) {
          const y = a[1] + (b[1] - a[1]) * fraction;
          if (Math.min(Math.abs(y - a[1]), Math.abs(y - b[1])) < label.height / 2 + 6) continue;
          ranked.push([2, a[0], y + 3]);
          [6, 14, 22, 30, 38, 46, 54].forEach((offset, step) => {
            const tier = step === 0 ? 0 : step === 1 ? 1 : 2 + step;
            const left = [tier + (leftFirst ? 0 : 0.5), a[0] - label.width / 2 - offset, y + 3];
            const right = [tier + (leftFirst ? 0.5 : 0), a[0] + label.width / 2 + offset, y + 3];
            ranked.push(left, right);
          });
        }
      }
    }
    return ranked.map((entry, order) => [...entry, order])
      .sort((left, right) => left[0] - right[0] || left[3] - right[3])
      .map(([, lx, ly]) => [lx, ly]);
  };

  for (const [index, label] of placed.entries()) {
    const relation = label.relation;
    if (['labelAt', 'labelDx', 'labelDy', 'labelSegment'].some(key => relation[key] !== undefined)) continue;
    // Match actual defect thresholds before searching; a valid placement is
    // not a reason to restyle the diagram. New placements leave extra space.
    // The grid ranking already starts from the preferred position, so it
    // also re-ranks labels whose default spot is merely valid.
    if (!gridSweep && inside(label) && !components.some(component => rectsOverlap(label, component, -2))
        && !titles.some(title => rectsOverlap(label, title))
        && !overlapsLabel(label, index) && !masksRoute(label)) continue;
    if (gridSweep) {
      // Callers measure the plate one pixel higher than rectAt; test with a
      // pixel of slack so the chosen position also passes their clearance.
      const replacement = gridCandidates(label).map(([lx, ly]) => rectAt(label, lx, ly))
        .find(rect => clear({ ...rect, x: rect.x - 1, y: rect.y - 1, width: rect.width + 2, height: rect.height + 2 }, index));
      if (replacement) {
        placed[index] = replacement;
        continue;
      }
    }
    for (const segment of segments.filter(segment => segment.relationIndex === label.relationIndex)) {
      const [a, b] = [segment.start, segment.end];
      let candidates = [];
      if (Math.abs(a[1] - b[1]) < 0.0001 && Math.abs(a[0] - b[0]) >= label.width + 16) {
        candidates = [0.5, 0.25, 0.75, 0.125, 0.875].flatMap(fraction => {
          const x = a[0] + (b[0] - a[0]) * fraction;
          if (Math.min(Math.abs(x - a[0]), Math.abs(x - b[0])) < 8) return [];
          return [
            [x, a[1] - 10],
            [x, a[1] + 20],
            [x, a[1] - 18],
            [x, a[1] + 28],
          ];
        });
      } else if (Math.abs(a[0] - b[0]) < 0.0001 && Math.abs(a[1] - b[1]) >= label.height + 16) {
        candidates = [0.5, 0.25, 0.75, 0.125, 0.875].flatMap(fraction => {
          const y = a[1] + (b[1] - a[1]) * fraction;
          if (Math.min(Math.abs(y - a[1]), Math.abs(y - b[1])) < 8) return [];
          return [
            [a[0] - label.width / 2 - 6, y + 3],
            [a[0] + label.width / 2 + 6, y + 3],
            [a[0] - label.width / 2 - 14, y + 3],
            [a[0] + label.width / 2 + 14, y + 3],
          ];
        });
      }
      const replacement = candidates.map(([lx, ly]) => rectAt(label, lx, ly))
        .find(rect => clear(rect, index));
      if (replacement) {
        placed[index] = replacement;
        break;
      }
    }
    if (placed[index] !== label || !fallbackRing) continue;

    // Dense but valid topologies can leave every point directly beside the
    // relationship occupied by another route. Search a small deterministic
    // ring around the current anchor and the relationship's segment centres.
    // A collision-free island above a node is not a readable edge label.
    // Architecture opts into keeping the mask within two label heights of
    // its own route; shared callers retain their existing policy. If no nearby
    // slot fits, retain the collision so validation can request more space.
    const ownSegments = segments.filter(segment => segment.relationIndex === label.relationIndex);
    const baseAnchors = [
      [label.lx, label.ly],
      ...ownSegments.map(segment => [
        (segment.start[0] + segment.end[0]) / 2,
        (segment.start[1] + segment.end[1]) / 2,
      ]),
    ];
    const horizontalStep = label.width / 2 + 12;
    const ringOffsets = [
      [0, -28], [0, 38],
      [-horizontalStep, -28], [horizontalStep, -28],
      [-horizontalStep, 38], [horizontalStep, 38],
      [-(label.width + 20), -52], [label.width + 20, -52],
      [-(label.width + 20), 62], [label.width + 20, 62],
      [-(label.width + 20), -76], [label.width + 20, -76],
      [-(label.width + 20), 86], [label.width + 20, 86],
    ];
    const fallback = baseAnchors.flatMap(([baseX, baseY]) => (
      ringOffsets.map(([dx, dy]) => rectAt(label, baseX + dx, baseY + dy))
    )).find(rect => clear(rect, index) && (!keepFallbackNearRoute || ownSegments.some(segment => (
      segmentRectClearanceWithin(segment, rect, label.height * 2) <= label.height * 2
    ))));
    if (fallback) placed[index] = fallback;
  }
  return placed;
}

// The rect a single unpinned label would occupy given only its own route and
// the nodes: what the planner reserves before the remaining routes are laid.
// Only a placement beside the route itself is worth r
```

### Core Architecture Module: `archify/renderers/architecture/render-architecture.mjs`
```
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, renderDefinitions, renderSemanticSigil, textUnits } from '../shared/utils.mjs';
import { animateAttr, focusEdgeAttrs, focusNodeAttrs, focusNodeTitle, loadDiagramWithBrandMarks, writeDiagram, svgAccessibleText, svgRootAttrs } from '../shared/cli.mjs';
import { componentBox, boundaryBox, connectionPath } from '../shared/layout-report.mjs';
import { rendererFailure, throwDiagnosticProblems } from '../shared/diagnostics.mjs';
import { legendFootprint, relationshipLegendObstacles, resolveLegend, renderLegend as renderResolvedLegend } from '../shared/legend.mjs';
import { availableNodeTextWidth, fittedNodeFontSize, minimumNodeTextWidth } from '../shared/text-fit.mjs';
import { brandLabelFitWidth, brandMetadataFor, brandTopRailProblem, renderBrandMark } from '../shared/brand-marks.mjs';
import { minimumReadableSourceTextPx } from '../shared/desktop-readability.mjs';
import { translateMessage as i18nText } from '../shared/i18n.mjs';
import { gridLayout, resolveComponentPos, validateGridPlacement } from './grid.mjs';
import { createRouter } from './routing.mjs';
import { placeAutomaticLabels, reservedLabelRect } from './labels.mjs';
import { cleanRouteDetourProblems } from '../shared/route-quality.mjs';
import {
  asArray,
  isFinitePoint,
  rectsOverlap,
  cleanEndpointSideProblems,
  cleanFlowProblems,
  cleanCrossingProblems,
  cleanAmbiguousCorridorProblems,
  collectArrowheadCollisions,
  cleanBorderRunProblems,
  cleanRouteRhythmProblems,
  cleanLabelRouteClearanceProblems,
  cleanLabelCanvasContainmentProblems,
  suggestLabelObstacleFix,
  suggestComponentSeparation,
  polylinePath,
  routePointsValue,
  authoredStraightRouteAttrs,
  labelPoint,
  componentFill,
  componentText,
  arrowClassMap,
  edgeLabelAccent,
} from '../shared/geometry.mjs';

const componentTextFit = {
  sublabelPreferred: 9,
  sublabelMinimum: 6,
  tagPreferred: 7,
  tagMinimum: 6,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const layoutJsonMode = process.argv.includes('--layout-json');
const cliArgs = process.argv.filter((arg) => arg !== '--layout-json');
const { diagram: arch, template, outPath, sourceEvidence } = await loadDiagramWithBrandMarks({
  rendererDir: __dirname,
  diagramType: 'architecture',
  defaultExample: 'web-app.architecture.json',
  argv: cliArgs,
});

const grid = gridLayout(arch);

const layout = {
  defaultW: 120,
  defaultH: 60,
  margin: 40,
  // Boundary padding — the 30/50 rule that was a hand-arithmetic footgun
  // (CHANGELOG v2.2.1): 30px on top/left/right, plus 20px extra at the bottom.
  boundaryPad: 30,
  boundaryExtraBottom: 20,
  boundaryLabelBaseline: 18,
  boundaryLabelClearance: 4,
  boundaryLabelFontPreferred: 9,
  boundaryLabelFontMinimum: 6,
  boundaryLabelMaskHeight: 16,
  boundaryLabelRailGap: 2,
  boundaryLabelFrameInset: 4,
  legendH: 28,
};

const LEGEND_CATALOG = [
  'frontend',
  'backend',
  'database',
  'cloud',
  'security',
  'messagebus',
  'external',
].map((kind) => ({ kind, label: i18nText(arch.meta.locale, `legend.architecture.${kind}`) }));

// ---- Measure components from free coordinates --------------------------------
function measureComponent(c) {
  const [x, y] = resolveComponentPos(c, grid);
  const [w, h] = Array.isArray(c.size) ? c.size : [layout.defaultW, layout.defaultH];
  return { ...c, x, y, width: w, height: h, cx: x + w / 2, cy: y + h / 2 };
}

const components = new Map(asArray(arch.components).map((c) => [c.id, measureComponent(c)]));
const enforcesBoundaryTitleComposition = Boolean(arch.meta?.quality_profile);
const componentSteps = new Map();
for (const [index, conn] of asArray(arch.connections).entries()) {
  if (!componentSteps.has(conn.from)) componentSteps.set(conn.from, index);
  if (!componentSteps.has(conn.to)) componentSteps.set(conn.to, index + 1);
}
for (const [index, c] of asArray(arch.components).entries()) {
  if (!componentSteps.has(c.id)) componentSteps.set(c.id, index);
}

// ---- Boundaries computed from the `wraps` id list ---------------------------
function boundaryRect(boundary) {
  const members = asArray(boundary.wraps).map((id) => components.get(id)).filter(Boolean);
  if (!members.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const member of members) {
    minX = Math.min(minX, member.x);
    minY = Math.min(minY, member.y);
    maxX = Math.max(maxX, member.x + member.width);
    maxY = Math.max(maxY, member.y + member.height);
  }
  const pad = boundary.pad ?? layout.boundaryPad;
  const topPad = Math.max(
    pad,
    layout.boundaryLabelBaseline + layout.boundaryLabelClearance,
  );
  return {
    ...boundary,
    x: minX - pad,
    y: minY - topPad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + topPad + layout.boundaryExtraBottom,
    memberTop: minY,
  };
}

function rectContains(outer, inner) {
  const epsilon = 1e-9;
  return outer.x <= inner.x + epsilon
    && outer.y <= inner.y + epsilon
    && outer.x + outer.width + epsilon >= inner.x + inner.width
    && outer.y + outer.height + epsilon >= inner.y + inner.height;
}

function boundaryLabelWidth(label, fontSize) {
  return Math.max(30, textUnits(label) * fontSize * 0.6 + 10);
}

const architectureLegendEntries = resolveLegend(
  arch.meta?.legend,
  LEGEND_CATALOG,
  new Set([...components.values()].map((component) => component.type)),
);

// One source for connection label geometry: the rect the containment rule
// measures is the rect the SVG mask draws, the auto canvas covers, the legend
// avoids, and the layout report publishes.
const resolvedLabelPoints = new Map();
function connectionLabelBox(conn) {
  if (!conn.label) return null;
  return connectionLabelBoxAt(conn, resolvedLabelPoints.get(conn) || labelPoint(conn, pathFor(conn).points));
}

function connectionLabelBoxAt(conn, [lx, ly]) {
  const width = Math.max(30, textUnits(conn.label) * 4.8 + 10);
  return { x: lx - width / 2, y: ly - 10, width, height: 14, lx, ly };
}

function connectionLabelRects() {
  const rects = [];
  for (const [relationIndex, conn] of asArray(arch.connections).entries()) {
    if (!components.has(conn.from) || !components.has(conn.to)) continue;
    const box = connectionLabelBox(conn);
    if (!box) continue;
    rects.push({ relation: conn, relationIndex, label: conn.label, ...box });
  }
  return rects;
}

function autoViewBoxFor(candidateBoundaries, extraRects = []) {
  let maxX = 0;
  let maxY = 0;
  for (const rects of [components.values(), candidateBoundaries, extraRects]) {
    for (const rect of rects) {
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    }
  }
  let width = Math.ceil(maxX + layout.margin);
  let footprint = legendFootprint(architectureLegendEntries, {
    width: Math.max(1, width - layout.margin * 2),
  });
  if (footprint.minWidth > width - layout.margin * 2) {
    width = Math.ceil(footprint.minWidth + layout.margin * 2);
    footprint = legendFootprint(architectureLegendEntries, {
      width: width - layout.margin * 2,
    });
  }
  return [
    width,
    Math.ceil(maxY + layout.margin + layout.legendH + footprint.extraHeight),
  ];
}

function resolvedViewBoxWidth(candidateBoundaries) {
  if (Array.isArray(arch.meta?.viewBox) && Number.isFinite(arch.meta.viewBox[0])) {
    return arch.meta.viewBox[0];
  }
  return autoViewBoxFor(candidateBoundaries, connectionGeometry)[0];
}

function expandBoundaryForReadableTitle(boundary, minimumFontSize) {
  if (!enforcesBoundaryTitleComposition) return boundary;
  const requiredWidth = boundaryLabelWidth(boundary.label, minimumFontSize)
    + layout.boundaryLabelFrameInset * 2;
  const extra = Math.max(0, requiredWidth - boundary.width);
  if (!extra) return boundary;
  return {
    ...boundary,
    x: boundary.x - extra / 2,
    width: boundary.width + extra,
  };
}

function measureBoundaryTitle(boundary, minimumFontSize) {
  const availableWidth = Math.max(0, boundary.width - layout.boundaryLabelFrameInset * 2);
  const units = textUnits(boundary.label);
  const fitted = units > 0
    ? (availableWidth - 10) / (units * 0.6)
    : layout.boundaryLabelFontPreferred;
  const preferredFontSize = Math.max(layout.boundaryLabelFontPreferred, minimumFontSize);
  const fontSize = Math.max(
    minimumFontSize,
    Math.min(preferredFontSize, fitted),
  );
  const desiredWidth = boundaryLabelWidth(boundary.label, fontSize);
  const height = Math.max(layout.boundaryLabelMaskHeight, Math.ceil(fontSize + 7));
  return {
    x: boundary.x + layout.boundaryLabelFrameInset,
    y: boundary.memberTop
      - layout.boundaryLabelClearance
      - height,
    width: Math.min(availableWidth, desiredWidth),
    height,
    fontSize,
    minimumFontSize,
    baselineOffset: fontSize + 4,
    availableWidth,
    minimumWidth: boundaryLabelWidth(boundary.label, minimumFontSize),
  };
}

function horizontalOverlap(left, right) {
  return left.x < right.x + right.width && left.x + left.width > right.x;
}

function layoutBoundaryTitles(rawBoundaries, minimumFontSize) {
  const placedTitles = [];
  const measured = new Map();
  const ordered = rawBoundaries
    .map((boundary, index) => ({ boundary, index }))
    .sort((left, right) => {
      const areaDelta = left.boundary.width * left.boundary.height
        - right.boundary.width * right.boundary.height;
      return areaDelta || left.index - right.index;
    });

  for (const entry of ordered) {
    const { index } = entry;
    const boundary = expandBoundaryForReadableTitle(entry.boundary, minimumFontSize);
    const title = measureBoundaryTitle(boundary, minimumFontSize);
    let guard = 0;
    while (guard < rawBoundaries.length + components.size + 1) {
      guard += 1;
      const blockers = [
        ...placedTitles,
        ...components.values(),
      ].filter((candidate) => horizontalOverlap(title, candidate) && rectsOverlap(titl
```

### Core Architecture Module: `archify/renderers/architecture/routing.mjs`
```
// Internal architecture router shared by rendering and geometry inspection.
// Create a new router when measured boxes or connections change: port spreading
// is computed once and route results are cached for this scene.

import {
  segmentIntersectsRect,
  anchor,
  automaticPortSpread,
  automaticPortRhythmBridge,
  defaultFromSide,
  defaultToSide,
  chosenSide,
  properSegmentIntersection,
  routeHonorsEndpointSides,
  normalizeRoutePoints,
  rectsOverlap,
  roundedPath,
  collectBorderRuns,
  collectRouteRhythmIssues,
  frameBorderSegments,
} from '../shared/geometry.mjs';
import { shortestOrthogonalGridRoute } from '../shared/route-quality.mjs';

/**
 * Router bound to one set of measured component boxes.
 *
 * @param {Map<string, {x,y,width,height,cx,cy}>} components measured boxes by id
 * @param {Array<object>} connections the connection list to spread ports across
 * @param {object} [options]
 * @param {Array<{x,y,width,height,radius?}>} [options.frames] structural frames
 *   (boundaries) whose borders an automatic route may cross but never follow
 * @param {number} [options.interiorSegmentPx] showcase floor for interior segments
 * @param {number} [options.microSegmentPx] floor for any segment
 * @param {(conn: object, points: number[][], context: {routes: number[][][], labels: object[]}) => object|null} [options.labelRectFor]
 *   default label rect of a routed relationship given the routes and label
 *   rects resolved so far; later automatic routes keep clear of it so a dense
 *   fan-out does not leave the label nowhere to go
 */
export function createRouter(components, connections = [], {
  frames = [],
  interiorSegmentPx = 16,
  microSegmentPx = 8,
  labelRectFor = null,
  distinctAutomaticPorts = false,
  preferReadableRoutes = false,
} = {}) {
  const frameBorders = frames.flatMap((frame) => frameBorderSegments(frame));
  const LABEL_CLEARANCE = 4;
  // Labels of already-routed relationships, reserved while planning the rest.
  let reservedLabels = [];
  let honourReservedLabels = true;
  let allowGridSearch = true;

  function routeClearsReservedLabels(conn, points) {
    if (!honourReservedLabels) return true;
    for (const entry of reservedLabels) {
      if (entry.conn === conn) continue;
      for (let index = 0; index < points.length - 1; index += 1) {
        if (segmentIntersectsRect({ start: points[index], end: points[index + 1] }, entry.rect, LABEL_CLEARANCE)) {
          return false;
        }
      }
    }
    return true;
  }

  // The grid search adds its own 2px component clearance; pre-expand so a
  // reserved label keeps the same 4px clearance the placement pass demands.
  function reservedLabelObstacles(gridClearance) {
    if (!honourReservedLabels) return [];
    const grow = LABEL_CLEARANCE - gridClearance;
    return reservedLabels.map(({ rect }) => ({
      x: rect.x - grow,
      y: rect.y - grow,
      width: rect.width + grow * 2,
      height: rect.height + grow * 2,
    }));
  }

  // Automatic routes are held to the same composition floors the showcase
  // gate enforces afterwards. Accepting a route here that the gate rejects
  // only hands the author a hand-routing repair the planner could have made.
  function routeMeetsCompositionFloors(points) {
    if (collectRouteRhythmIssues({ routedRelations: [{ points }], interiorSegmentPx, microSegmentPx }).length) {
      return false;
    }
    return !frames.length || collectBorderRuns({ routedRelations: [{ points }], frames }).length === 0;
  }
  const planningMetrics = {
    routeCount: 0,
    explicitRouteCount: 0,
    automaticRouteCount: 0,
    gridSearchCount: 0,
    gridRoutedCount: 0,
    gridCandidateNodeCount: 0,
    gridUsableNodeCount: 0,
    gridEdgeCount: 0,
    gridVisitedNodeCount: 0,
    avoidedSegmentCount: 0,
    conflictFallbackCount: 0,
    maximumGridSearchCount: 64,
    gridBudgetExhaustedCount: 0,
    crossoverRoutedCount: 0,
    readabilityCandidateCount: 0,
    readabilityImprovedCount: 0,
    reciprocalCandidateCount: 0,
    reciprocalImprovedCount: 0,
    gridAttempts: [],
  };

  // ---- Connection routing ------------------------------------------------------
  function routeClearsComponents(conn, points, clearance = 2) {
    const endpointIds = new Set([conn.from, conn.to]);
    for (const component of components.values()) {
      if (endpointIds.has(component.id)) continue;
      for (let index = 0; index < points.length - 1; index += 1) {
        if (segmentIntersectsRect({ start: points[index], end: points[index + 1] }, component, clearance)) {
          return false;
        }
      }
    }
    return routeClearsReservedLabels(conn, points);
  }

  function routeClearsEndpointComponents(points, from, to) {
    const lastSegment = points.length - 2;
    for (let index = 0; index <= lastSegment; index += 1) {
      const segment = { start: points[index], end: points[index + 1] };
      if (index > 0 && segmentIntersectsRect(segment, from)) return false;
      if (index < lastSegment && segmentIntersectsRect(segment, to)) return false;
    }
    return true;
  }

  function relationshipsShareEndpoint(left, right) {
    return left.from === right.from
      || left.from === right.to
      || left.to === right.from
      || left.to === right.to;
  }

  function collinearOverlapLength(leftStart, leftEnd, rightStart, rightEnd) {
    const epsilon = 0.0001;
    if (Math.abs(leftStart[0] - leftEnd[0]) <= epsilon
        && Math.abs(rightStart[0] - rightEnd[0]) <= epsilon
        && Math.abs(leftStart[0] - rightStart[0]) <= epsilon) {
      return Math.max(0,
        Math.min(Math.max(leftStart[1], leftEnd[1]), Math.max(rightStart[1], rightEnd[1]))
          - Math.max(Math.min(leftStart[1], leftEnd[1]), Math.min(rightStart[1], rightEnd[1])));
    }
    if (Math.abs(leftStart[1] - leftEnd[1]) <= epsilon
        && Math.abs(rightStart[1] - rightEnd[1]) <= epsilon
        && Math.abs(leftStart[1] - rightStart[1]) <= epsilon) {
      return Math.max(0,
        Math.min(Math.max(leftStart[0], leftEnd[0]), Math.max(rightStart[0], rightEnd[0]))
          - Math.max(Math.min(leftStart[0], leftEnd[0]), Math.min(rightStart[0], rightEnd[0])));
    }
    return 0;
  }

  function orthogonalTouchOnResolvedInterior(start, end, resolvedStart, resolvedEnd) {
    const epsilon = 0.0001;
    const candidateHorizontal = Math.abs(start[1] - end[1]) <= epsilon;
    const candidateVertical = Math.abs(start[0] - end[0]) <= epsilon;
    const resolvedHorizontal = Math.abs(resolvedStart[1] - resolvedEnd[1]) <= epsilon;
    const resolvedVertical = Math.abs(resolvedStart[0] - resolvedEnd[0]) <= epsilon;
    if (candidateHorizontal && resolvedVertical) {
      const x = resolvedStart[0];
      const y = start[1];
      return x >= Math.min(start[0], end[0]) - epsilon
        && x <= Math.max(start[0], end[0]) + epsilon
        && y > Math.min(resolvedStart[1], resolvedEnd[1]) + epsilon
        && y < Math.max(resolvedStart[1], resolvedEnd[1]) - epsilon;
    }
    if (candidateVertical && resolvedHorizontal) {
      const x = start[0];
      const y = resolvedStart[1];
      return y >= Math.min(start[1], end[1]) - epsilon
        && y <= Math.max(start[1], end[1]) + epsilon
        && x > Math.min(resolvedStart[0], resolvedEnd[0]) + epsilon
        && x < Math.max(resolvedStart[0], resolvedEnd[0]) - epsilon;
    }
    return false;
  }

  function unrelatedResolvedRoutes(conn, resolvedRoutes) {
    return resolvedRoutes.filter((entry) => !relationshipsShareEndpoint(conn, entry.conn));
  }

  function routeConflictsWithResolved(conn, points, resolvedRoutes) {
    const unrelated = unrelatedResolvedRoutes(conn, resolvedRoutes);
    for (const entry of unrelated) {
      for (let left = 0; left < points.length - 1; left += 1) {
        for (let right = 0; right < entry.points.length - 1; right += 1) {
          if (properSegmentIntersection(
            points[left],
            points[left + 1],
            entry.points[right],
            entry.points[right + 1],
          )) return true;
          if (orthogonalTouchOnResolvedInterior(
            points[left],
            points[left + 1],
            entry.points[right],
            entry.points[right + 1],
          )) return true;
          if (collinearOverlapLength(
            points[left],
            points[left + 1],
            entry.points[right],
            entry.points[right + 1],
          ) >= 8) return true;
        }
      }
    }
    return false;
  }

  function routeOverlapsResolved(conn, points, resolvedRoutes) {
    // A common destination does not make two independently labelled routes a
    // bus. Keep their corridors distinct too; explicit routes bypass planning.
    for (const entry of resolvedRoutes) {
      if (relationshipsShareEndpoint(conn, entry.conn)
          && (!distinctAutomaticPorts || hasAuthoredRouteGeometry(entry.conn) || entry.conn.labelAt || conn.labelAt)) continue;
      for (let left = 0; left < points.length - 1; left += 1) {
        for (let right = 0; right < entry.points.length - 1; right += 1) {
          if (collinearOverlapLength(
            points[left],
            points[left + 1],
            entry.points[right],
            entry.points[right + 1],
          ) >= 8) return true;
        }
      }
    }
    return false;
  }

  const OUTWARD_SIDE_VECTOR = {
    left: [-1, 0],
    right: [1, 0],
    top: [0, -1],
    bottom: [0, 1],
  };

  function outwardStub(point, side, distance = 24) {
    const [dx, dy] = OUTWARD_SIDE_VECTOR[side] || [0, 0];
    return [point[0] + dx * distance, point[1] + dy * distance];
  }

  function collinearBacktrack(a, b, c) {
    const first = [b[0] - a[0], b[1] - a[1]];
    const second = [c[0] - b[0], c[1] - b[1]];
    const cross = first[0] * second[1] - first[1] * second[0];
    const dot = first[0] * second[0] + first[1] * second[1];
    return Math.abs(cross) <= 0.0001 && dot < -0.0001;
  }

  function sideAwareBridgeCandidates(start, end, fromSide, toSide) {
    
```

### Core Architecture Module: `archify/renderers/dataflow/render-dataflow.mjs`
```
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, renderDefinitions, renderSemanticSigil, textUnits } from '../shared/utils.mjs';
import { animateAttr, focusEdgeAttrs, focusNodeAttrs, focusNodeTitle, loadDiagramWithBrandMarks, writeDiagram, svgAccessibleText, svgRootAttrs } from '../shared/cli.mjs';
import { throwDiagnosticProblems } from '../shared/diagnostics.mjs';
import { resolveLegend, renderLegend as renderResolvedLegend } from '../shared/legend.mjs';
import { availableNodeTextWidth, fittedNodeFontSize, minimumNodeTextWidth, nodeLabelLayout } from '../shared/text-fit.mjs';
import { brandLabelFitWidth, brandMarkFor, brandMetadataFor, brandTopRailProblem, renderBrandMark } from '../shared/brand-marks.mjs';
import { translateMessage as i18nText } from '../shared/i18n.mjs';
import {
  asArray,
  isFinitePoint,
  rectsOverlap,
  cleanEndpointSideProblems,
  cleanFlowProblems,
  cleanCrossingProblems,
  cleanAmbiguousCorridorProblems,
  cleanBorderRunProblems,
  cleanRouteRhythmProblems,
  cleanLabelRouteClearanceProblems,
  cleanLabelCanvasContainmentProblems,
  suggestLabelObstacleFix,
  suggestLabelPairFix,
  anchor,
  automaticPortSpread,
  legacyDefaultFromSide as defaultFromSide,
  legacyDefaultToSide as defaultToSide,
  chosenSide,
  polylinePath,
  routePointsValue,
  authoredStraightRouteAttrs,
  labelPoint,
  componentFill,
  componentText,
  arrowClassMap,
  edgeLabelAccent
} from '../shared/geometry.mjs';

const nodeTextFit = {
  sublabelPreferred: 7,
  sublabelMinimum: 6,
  tagPreferred: 7,
  tagMinimum: 6,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { diagram: dataflow, template, outPath, sourceEvidence } = await loadDiagramWithBrandMarks({
  rendererDir: __dirname,
  diagramType: 'dataflow',
  defaultExample: 'product-analytics.dataflow.json'
});

const viewBox = dataflow.meta?.viewBox || [940, 720];
const layout = {
  stageY: 46,
  stageH: 36,
  stageBottomPad: 74,
  leftX: 100,
  colGap: 215,
  stageW: 168,
  nodeW: 112,
  nodeH: 58,
  rowYs: [128, 242, 356, 470, 584],
  labelH: 16
};

function flowLabelSize(flow) {
  const longestLine = Math.max(textUnits(flow.label), textUnits(flow.classification || ''));
  return {
    width: Math.round(Math.max(34, longestLine * 4.9 + 12) * 10) / 10,
    height: flow.classification ? 27 : layout.labelH,
  };
}

function stageX(index) {
  return layout.leftX + index * layout.colGap;
}

function stageFrame(stage, index) {
  return {
    id: index,
    label: stage.label,
    kind: 'stage',
    x: stageX(index) - layout.stageW / 2,
    y: layout.stageY,
    width: layout.stageW,
    height: viewBox[1] - layout.stageY - layout.stageBottomPad,
    radius: 10,
  };
}

const compositionFrames = asArray(dataflow.stages).map(stageFrame);

function measureNode(node) {
  const width = node.width || layout.nodeW;
  const height = node.height || layout.nodeH;
  const cx = stageX(node.stage);
  const y = layout.rowYs[node.row] + (node.yOffset || 0);
  return {
    ...node,
    width,
    height,
    cx,
    cy: y + height / 2,
    x: cx - width / 2,
    y
  };
}

const nodes = new Map(asArray(dataflow.nodes).map((node) => [node.id, measureNode(node)]));
const nodeSteps = new Map();
for (const [index, flow] of asArray(dataflow.flows).entries()) {
  if (!nodeSteps.has(flow.from)) nodeSteps.set(flow.from, index);
  if (!nodeSteps.has(flow.to)) nodeSteps.set(flow.to, index + 1);
}
for (const [index, node] of asArray(dataflow.nodes).entries()) {
  if (!nodeSteps.has(node.id)) nodeSteps.set(node.id, index);
}

function validateDataflow() {
  const problems = [];
  if (nodes.size !== asArray(dataflow.nodes).length) problems.push('Node ids must be unique.');

  const stageCount = asArray(dataflow.stages).length;
  for (const node of nodes.values()) {
    if (typeof node.stage !== 'number' || node.stage < 0 || node.stage >= stageCount) {
      problems.push(`Node "${node.id}" uses invalid stage ${node.stage} — valid stages are 0..${stageCount - 1}.`);
    }
    if (typeof node.row !== 'number' || node.row < 0 || node.row >= layout.rowYs.length) {
      problems.push(`Node "${node.id}" uses invalid row ${node.row} — valid rows are 0..${layout.rowYs.length - 1}.`);
    }
    if (!isFinitePoint(node.x, node.y, node.cx, node.cy)) {
      problems.push(`Node "${node.id}" produced non-finite coordinates — check stage, row, width, height, and yOffset are numbers.`);
      continue;
    }
    if (node.x < 24 || node.x + node.width > viewBox[0] - 24) {
      problems.push(`Node "${node.id}" exceeds the horizontal bounds of the viewBox — reduce node.width or increase meta.viewBox[0].`);
    }
    if (node.y < layout.stageY + layout.stageH + 22 || node.y + node.height > viewBox[1] - layout.stageBottomPad) {
      problems.push(`Node "${node.id}" exceeds the readable diagram area — keep y between ${layout.stageY + layout.stageH + 22} and ${viewBox[1] - layout.stageBottomPad} (adjust row/yOffset or increase meta.viewBox[1]).`);
    }
    const estLabelW = textUnits(node.label) * 6.2;
    if (estLabelW > node.width + 6) {
      problems.push(`Label "${node.label}" (~${Math.round(estLabelW)}px) is wider than node "${node.id}" (${node.width}px) — shorten the label or increase node.width.`);
    }
    const brandRailProblem = brandTopRailProblem(node, node.width, 8);
    if (brandRailProblem) problems.push(brandRailProblem);
    // sublabel and tag render as single unwrapped <text> elements; shrink-to-fit
    // handles the ordinary case, this rejects what it cannot rescue.
    const availableTextW = availableNodeTextWidth(node.width);
    for (const [field, value, minimum] of [
      ['Sublabel', node.sublabel, nodeTextFit.sublabelMinimum],
      ['Tag', node.tag, nodeTextFit.tagMinimum],
    ]) {
      if (!value) continue;
      const minimumW = minimumNodeTextWidth(value, minimum);
      if (minimumW > availableTextW) {
        problems.push(`${field} "${value}" needs ~${Math.ceil(minimumW)}px at the ${minimum}px legible minimum, but node "${node.id}" provides ${availableTextW}px — shorten the ${field.toLowerCase()} or increase node.width.`);
      }
    }
  }

  const nodeList = asArray(dataflow.nodes);
  for (let i = 0; i < nodeList.length; i += 1) {
    for (let j = i + 1; j < nodeList.length; j += 1) {
      const a = nodes.get(nodeList[i].id);
      const b = nodes.get(nodeList[j].id);
      if (rectsOverlap(a, b, 10)) {
        problems.push(`Nodes "${a.id}" and "${b.id}" are less than 10px apart — move one to another stage/row or adjust yOffset.`);
      }
    }
  }

  for (const flow of asArray(dataflow.flows)) {
    if (!nodes.has(flow.from)) problems.push(`Flow "${flow.label || flow.from}" references unknown source "${flow.from}".`);
    if (!nodes.has(flow.to)) problems.push(`Flow "${flow.label || flow.to}" references unknown target "${flow.to}".`);
    if (!flow.label) problems.push(`Flow "${flow.from}" -> "${flow.to}" must include a short data label.`);
    if (nodes.has(flow.from) && nodes.has(flow.to)) {
      const routed = pathFor(flow);
      const [start, end] = [routed.points[0], routed.points[routed.points.length - 1]];
      const distance = Math.hypot(end[0] - start[0], end[1] - start[1]);
      if (distance < 34) problems.push(`Flow "${flow.label}" is too short (${Math.round(distance)}px; minimum 34px) — route it through a channel or spread its nodes.`);
      if (Array.isArray(flow.via)) {
        for (let segmentIndex = 0; segmentIndex < routed.points.length - 1; segmentIndex += 1) {
          const segmentStart = routed.points[segmentIndex];
          const segmentEnd = routed.points[segmentIndex + 1];
          const isDiagonal = Math.abs(segmentStart[0] - segmentEnd[0]) > 0.01
            && Math.abs(segmentStart[1] - segmentEnd[1]) > 0.01;
          if (!isDiagonal) continue;
          const viaIndex = Math.min(segmentIndex, flow.via.length - 1);
          problems.push(`Flow "${flow.label}" has a diagonal segment from (${segmentStart.join(', ')}) to (${segmentEnd.join(', ')}) — align via[${viaIndex}] with its adjacent point by sharing the same x or y coordinate.`);
        }
      }
    }
  }

  problems.push(...cleanEndpointSideProblems({
    relations: dataflow.flows,
    endpointIds: new Set(nodes.keys()),
    pathFor,
    diagramType: 'dataflow',
    relationCollection: 'flows',
    fromSideFor: (flow) => flowSides(flow).fromSide,
    toSideFor: (flow) => flowSides(flow).toSide,
    routeHint: 'keep automatic routing, or choose fromSide/toSide and via points whose first and final segments cross node borders perpendicularly',
  }));
  problems.push(...cleanFlowProblems({
    relations: dataflow.flows,
    obstacles: nodes.values(),
    pathFor,
    diagramType: 'dataflow',
    relationCollection: 'flows',
    obstacleKind: 'node',
    routeHint: 'adjust fromSide/toSide, set route/via or channelX/channelY, or move the node to another stage/row'
  }));
  problems.push(...cleanCrossingProblems({
    relations: dataflow.flows,
    endpointIds: new Set(nodes.keys()),
    pathFor,
    diagramType: 'dataflow',
    relationCollection: 'flows',
    profile: dataflow.meta?.quality_profile,
    routeHint: 'adjust route/via or channelX/channelY so the flows use separate stage corridors'
  }));
  problems.push(...cleanAmbiguousCorridorProblems({
    relations: dataflow.flows,
    endpointIds: new Set(nodes.keys()),
    pathFor,
    diagramType: 'dataflow',
    relationCollection: 'flows',
    profile: dataflow.meta?.quality_profile,
    routeHint: 'adjust route/via or channelX/channelY so unrelated flows do not visually merge'
  }));
  problems.push(...cleanBorderRunProblems({
    relations: dataflow.flows,
    endpointIds: new Set(nodes.keys()),
    frames: compositionFrames,
    pathFor,
    diagramType: 'dataflow',
    relationCollection: 'flows',
    profile: dataflow.meta?.quality_profile,
    routeHint: 'adjust route/via or channelX/channelY so the flow crosses the stage perpendicularly instead of f
```

### Core Architecture Module: `archify/renderers/lifecycle/grid-routing.mjs`
```
// Orthogonal router for schema_version 2 lifecycle diagrams.
//
// v2 states sit on a fixed grid: one row per lane and a shared column pitch,
// with empty gaps between rows and between columns. That structure lets
// every automatic transition use a small, predictable set of shapes instead
// of a general obstacle search:
//   - neighbours in one row connect with a horizontal line;
//   - other states in one row connect through the gap above (below for the
//     first row);
//   - states in different rows leave through the facing top/bottom side,
//     turn once in a row gap, and enter the target's facing side; when a
//     state blocks the straight descent, the route steps sideways through the
//     empty corridor between two columns.
// Ports on each side are spread in the order of where their routes head, and
// the horizontal runs in each gap get their own tracks, ordered to minimize
// crossings. Reciprocal pairs therefore render as two parallel lines.

const PORT_GUTTER = 16;
const PORT_SPACING = 30;
const SNAP_LIMIT = 16;
const TRACK_TOP_CLEARANCE = 18;
const TRACK_BOTTOM_CLEARANCE = 18;
const PREFERRED_TRACK_SPACING = 22;
const MAX_TRACK_SPACING = 24;
const CORRIDOR_SPACING = 10;
const EXHAUSTIVE_TRACK_LIMIT = 7;

const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

function permutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) => permutations([...items.slice(0, index), ...items.slice(index + 1)])
    .map((rest) => [item, ...rest]));
}

export function createLifecycleGridRouter(states, transitions, { rowOf, columnXs }) {
  const byRow = new Map();
  for (const state of states.values()) {
    const row = rowOf(state);
    if (!Number.isInteger(row)) continue;
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push(state);
  }
  const rows = [...byRow.keys()].sort((a, b) => a - b);
  const rowTop = new Map(rows.map((row) => [row, Math.min(...byRow.get(row).map((s) => s.y))]));
  const rowBottom = new Map(rows.map((row) => [row, Math.max(...byRow.get(row).map((s) => s.y + s.height))]));
  const nextRow = (row) => rows.find((candidate) => candidate > row);
  const previousRow = (row) => [...rows].reverse().find((candidate) => candidate < row);

  // Gap g sits below row g. The gap under the last row borders the legend,
  // so it only receives tracks when nothing else is possible.
  function gapBand(row) {
    const below = nextRow(row);
    const top = rowBottom.get(row) + TRACK_TOP_CLEARANCE;
    const bottom = below === undefined ? rowBottom.get(row) + 40 : rowTop.get(below) - TRACK_BOTTOM_CLEARANCE;
    return [top, Math.max(top, bottom)];
  }

  function blocksVertical(x, fromRow, toRow, exclude) {
    const [low, high] = fromRow < toRow ? [fromRow, toRow] : [toRow, fromRow];
    return [...states.values()].some((state) => {
      if (exclude.has(state.id)) return false;
      const row = rowOf(state);
      return row > low && row < high && x >= state.x - 6 && x <= state.x + state.width + 6;
    });
  }

  function blocksHorizontal(from, to) {
    const row = rowOf(from);
    const [left, right] = from.cx < to.cx ? [from, to] : [to, from];
    return byRow.get(row).some((state) => state !== left && state !== right
      && state.x < right.x && state.x + state.width > left.x + left.width
      && state.y < Math.max(left.y + left.height, right.y + right.height)
      && state.y + state.height > Math.min(left.y, right.y));
  }

  // The empty corridors between neighbouring columns.
  const corridorXs = columnXs.slice(1).map((x, index) => (x + columnXs[index]) / 2);
  const allStates = [...states.values()];
  const leftmostX = Math.min(...allStates.map((state) => state.cx));
  const rightmostX = Math.max(...allStates.map((state) => state.cx));
  const gridLeft = Math.min(...allStates.map((state) => state.x));
  const gridRight = Math.max(...allStates.map((state) => state.x + state.width));
  // The initial-state marker occupies a start state's left side.
  function loopBlocked(from, to, side) {
    if (side !== 'left') return false;
    const [low, high] = [Math.min(rowOf(from), rowOf(to)), Math.max(rowOf(from), rowOf(to))];
    return allStates.some((state) => state.type === 'start' && Math.abs(state.cx - from.cx) < 1
      && rowOf(state) >= low && rowOf(state) <= high);
  }

  // Plan: sides, the gap each horizontal run uses, and where each end heads.
  const plans = new Map();
  for (const transition of transitions) {
    const from = states.get(transition.from);
    const to = states.get(transition.to);
    if (!from || !to || from === to) continue;
    const fromRow = rowOf(from);
    const toRow = rowOf(to);
    if (!Number.isInteger(fromRow) || !Number.isInteger(toRow)) continue;
    const exclude = new Set([from.id, to.id]);
    if (fromRow === toRow) {
      if (!blocksHorizontal(from, to)) {
        const fromSide = to.cx > from.cx ? 'right' : 'left';
        plans.set(transition, { kind: 'horizontal', from, to, fromSide, toSide: opposite[fromSide] });
      } else {
        const gapRow = previousRow(fromRow);
        const useAbove = gapRow !== undefined;
        const side = useAbove ? 'top' : 'bottom';
        plans.set(transition, {
          kind: 'channel', from, to, fromSide: side, toSide: side,
          runs: [{ gap: useAbove ? gapRow : fromRow, legs: useAbove ? ['down', 'down'] : ['up', 'up'] }],
        });
      }
      continue;
    }
    const down = toRow > fromRow;
    const fromSide = down ? 'bottom' : 'top';
    const toSide = down ? 'top' : 'bottom';
    const gapNearTarget = down ? previousRow(toRow) : toRow;
    const gapNearSource = down ? fromRow : previousRow(fromRow);
    const legs = down ? ['up', 'down'] : ['down', 'up'];
    if (!blocksVertical(from.cx, fromRow, toRow, exclude) && Math.abs(from.cx - to.cx) < 1) {
      plans.set(transition, { kind: 'vertical', from, to, fromSide, toSide, runs: [{ gap: gapNearTarget, legs }] });
    } else if (!blocksVertical(from.cx, fromRow, toRow, exclude)) {
      plans.set(transition, { kind: 'channel', from, to, fromSide, toSide, runs: [{ gap: gapNearTarget, legs }] });
    } else if (!blocksVertical(to.cx, fromRow, toRow, exclude)) {
      plans.set(transition, { kind: 'channel', from, to, fromSide, toSide, runs: [{ gap: gapNearSource, legs }] });
    } else if (!transition.label && !transition.note
      && Math.abs(from.cx - to.cx) < 1 && (from.cx <= leftmostX || from.cx >= rightmostX)
      && !loopBlocked(from, to, from.cx <= leftmostX ? 'left' : 'right')) {
      // A blocked edge column loops around the outside of the grid, like a
      // bracket, instead of weaving through the rows' interior corridors.
      // The margin has no room for a label, so only unlabeled edges loop.
      const side = from.cx <= leftmostX ? 'left' : 'right';
      plans.set(transition, { kind: 'loop', from, to, fromSide: side, toSide: side, side });
    } else {
      const middle = (from.cx + to.cx) / 2;
      const corridor = corridorXs
        .filter((x) => !blocksVertical(x, fromRow, toRow, new Set()))
        .sort((a, b) => Math.abs(a - middle) - Math.abs(b - middle))[0];
      plans.set(transition, corridor === undefined
        ? { kind: 'channel', from, to, fromSide, toSide, runs: [{ gap: gapNearTarget, legs }] }
        : {
          kind: 'corridor', from, to, fromSide, toSide, corridor,
          runs: [{ gap: gapNearSource, legs }, { gap: gapNearTarget, legs }],
        });
    }
  }

  // Corridor offsets: routes sharing one corridor run side by side.
  const corridorUse = new Map();
  for (const plan of plans.values()) {
    if (plan.kind !== 'corridor') continue;
    const list = corridorUse.get(plan.corridor) || [];
    list.push(plan);
    corridorUse.set(plan.corridor, list);
  }
  for (const [x, list] of corridorUse) {
    list.sort((a, b) => a.from.cx - b.from.cx || a.to.cx - b.to.cx);
    list.forEach((plan, index) => { plan.corridorX = x + (index - (list.length - 1) / 2) * CORRIDOR_SPACING; });
  }
  // Outer loops nest: a longer span sits further out so loops never cross.
  for (const side of ['left', 'right']) {
    const loops = [...plans.values()].filter((plan) => plan.kind === 'loop' && plan.side === side)
      .sort((a, b) => Math.abs(rowOf(a.from) - rowOf(a.to)) - Math.abs(rowOf(b.from) - rowOf(b.to)));
    loops.forEach((plan, index) => {
      plan.loopX = side === 'left' ? gridLeft - 18 - index * CORRIDOR_SPACING : gridRight + 18 + index * CORRIDOR_SPACING;
    });
  }

  // Where each end heads after leaving its side, used to order the ports.
  function headingFor(plan, end) {
    const self = end === 'source' ? plan.from : plan.to;
    const other = end === 'source' ? plan.to : plan.from;
    if (plan.kind === 'horizontal' || plan.kind === 'loop') return other.cy;
    if (plan.kind === 'corridor') return plan.corridorX;
    return other === self ? self.cx : other.cx;
  }

  const sideEnds = new Map();
  for (const [transition, plan] of plans) {
    for (const end of ['source', 'target']) {
      const state = end === 'source' ? plan.from : plan.to;
      const side = end === 'source' ? plan.fromSide : plan.toSide;
      const key = `${state.id}:${side}`;
      if (!sideEnds.has(key)) sideEnds.set(key, { state, side, ends: [] });
      // Movers in the positive direction (right/down) take the first slot so
      // both ends of a reciprocal pair line up.
      const positive = plan.kind === 'horizontal'
        ? plan.to.cx > plan.from.cx
        : rowOf(plan.to) > rowOf(plan.from) || (rowOf(plan.to) === rowOf(plan.from) && plan.to.cx > plan.from.cx);
      sideEnds.get(key).ends.push({ transition, end, heading: headingFor(plan, end), positive });
    }
  }

  const ports = new Map();
  for (const { state, side, ends } of sideEnds.values()) {
    ends.sort((a, b) => a.heading - b.heading || Number(b.positive) - Number(a.positive));
    const horizontalSide = side === 'top' || side === 'bottom';
    const length 
```

### Core Architecture Module: `archify/renderers/lifecycle/render-lifecycle.mjs`
```
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, renderDefinitions, renderSemanticSigil, textUnits } from '../shared/utils.mjs';
import { animateAttr, focusEdgeAttrs, focusNodeAttrs, focusNodeTitle, loadDiagramWithBrandMarks, writeDiagram, svgAccessibleText, svgRootAttrs } from '../shared/cli.mjs';
import { recordDiagnostic, throwDiagnosticProblems } from '../shared/diagnostics.mjs';
import { createRouter } from '../architecture/routing.mjs';
import { createLifecycleGridRouter } from './grid-routing.mjs';
import { placeAutomaticLabels, reservedLabelRect } from '../architecture/labels.mjs';
import { legendFootprint, resolveLegend, renderLegend as renderResolvedLegend } from '../shared/legend.mjs';
import { availableNodeTextWidth, fittedNodeFontSize, minimumNodeTextWidth, nodeLabelLayout } from '../shared/text-fit.mjs';
import { brandLabelFitWidth, brandMarkFor, brandMetadataFor, brandTopRailProblem, renderBrandMark } from '../shared/brand-marks.mjs';
import { translateMessage as i18nText } from '../shared/i18n.mjs';
import { DESKTOP_READER_DIAGRAM_WIDTH, MIN_PROJECTED_NODE_TEXT_PX } from '../shared/desktop-readability.mjs';
import {
  asArray,
  isFinitePoint,
  rectsOverlap,
  cleanEndpointSideProblems,
  cleanFlowProblems,
  cleanCrossingProblems,
  cleanAmbiguousCorridorProblems,
  cleanBorderRunProblems,
  cleanRouteRhythmProblems,
  cleanLabelRouteClearanceProblems,
  cleanLabelCanvasContainmentProblems,
  suggestLabelObstacleFix,
  suggestLabelPairFix,
  anchor,
  automaticPortSpread,
  legacyDefaultFromSide as defaultFromSide,
  legacyDefaultToSide as defaultToSide,
  chosenSide,
  roundedPath,
  routePointsValue,
  authoredStraightRouteAttrs,
  labelPoint,
  arrowClassMap,
  edgeLabelAccent
} from '../shared/geometry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { diagram: lifecycle, template, outPath, sourceEvidence } = await loadDiagramWithBrandMarks({
  rendererDir: __dirname,
  diagramType: 'lifecycle',
  defaultExample: 'agent-run.lifecycle.json'
});

// v2 sets state text one step larger; its canvas width is then budgeted
// from the smallest fitted text so the desktop Reader keeps it legible.
const stateTextFit = lifecycle.schema_version === 2 ? {
  labelPreferred: 11,
  labelMinimum: 9,
  sublabelPreferred: 8,
  sublabelMinimum: 7,
  tagPreferred: 8,
  tagMinimum: 7,
  step: 8,
} : {
  labelPreferred: 10,
  labelMinimum: 8,
  sublabelPreferred: 7,
  sublabelMinimum: 6,
  tagPreferred: 7,
  tagMinimum: 6,
  step: 7,
};

// schema_version 2 replaces the three fixed bands (main/event/outcome, with
// non-main lanes sharing one band and lower columns offset by +2) with one
// row per populated lane on a shared 0..4 column grid. v1 keeps its exact
// state geometry; only presentation (colors, markers, legend, sigil side)
// is shared between versions.
const isV2 = lifecycle.schema_version === 2;
const authoredViewBox = lifecycle.meta?.viewBox;

const layout = {
  phaseY: 126,
  eventY: 278,
  outcomeY: 450,
  phaseW: 118,
  phaseH: 62,
  eventW: 126,
  eventH: 58,
  outcomeW: 118,
  outcomeH: 58,
  phaseXs: [94, 248, 402, 556, 710],
  eventXs: [402, 556, 710],
  outcomeXs: [402, 556, 710]
};

const layoutV2 = {
  stateW: 140,
  stateH: 64,
  marginX: 60,
  minGap: 64,
  floorGap: 44,
  firstRowTop: 56,
  rowPitch: 184,
};

function transitionLabelWidth(transition) {
  const longestLine = Math.max(textUnits(transition.label), textUnits(transition.note || ''));
  return Math.max(32, longestLine * 4.9 + 12);
}

function stateFontSizes(state, width) {
  return {
    label: fittedNodeFontSize(state.label, brandLabelFitWidth(state, width), stateTextFit.labelPreferred, stateTextFit.labelMinimum),
    sublabel: fittedNodeFontSize(state.sublabel, width, stateTextFit.sublabelPreferred, stateTextFit.sublabelMinimum),
    tag: fittedNodeFontSize(state.tag, width, stateTextFit.tagPreferred, stateTextFit.tagMinimum),
  };
}

// v2 column centers. A gap between two columns widens until the label of a
// same-row neighbour transition fits beside its line; the whole canvas then
// stays inside the desktop readability budget of its smallest state text.
const v2ColumnCenters = (() => {
  if (!isV2) return [];
  const authored = asArray(lifecycle.states);
  const widths = [0, 1, 2, 3, 4].map((col) => Math.max(
    layoutV2.stateW, ...authored.filter((state) => state.col === col).map((state) => state.width || 0),
  ));
  const cols = authored.map((state) => state.col).filter((col) => Number.isInteger(col) && col >= 0 && col <= 4);
  const lastCol = cols.length ? Math.max(...cols) : 0;
  const gaps = [0, 1, 2, 3].map(() => layoutV2.minGap);
  const byId = new Map(authored.map((state) => [state.id, state]));
  for (const transition of asArray(lifecycle.transitions)) {
    const [from, to] = [byId.get(transition.from), byId.get(transition.to)];
    if (!(transition.label || transition.note) || !from || !to || from.lane !== to.lane
      || !Number.isInteger(from.col) || !Number.isInteger(to.col) || Math.abs(from.col - to.col) !== 1) continue;
    const gap = Math.min(from.col, to.col);
    if (gap >= 0 && gap < 4) gaps[gap] = Math.max(gaps[gap], Math.ceil(transitionLabelWidth(transition) + 24));
  }
  const smallestText = Math.min(stateTextFit.step, ...authored.flatMap((state) => (
    Object.values(stateFontSizes(state, state.width || layoutV2.stateW))
  )));
  const budget = Math.floor(DESKTOP_READER_DIAGRAM_WIDTH * smallestText / MIN_PROJECTED_NODE_TEXT_PX);
  const fixed = layoutV2.marginX * 2 + widths.slice(0, lastCol + 1).reduce((sum, width) => sum + width, 0);
  const used = gaps.slice(0, lastCol);
  const excess = fixed + used.reduce((sum, gap) => sum + gap, 0) - budget;
  const slack = used.reduce((sum, gap) => sum + gap - layoutV2.floorGap, 0);
  if (excess > 0 && slack > 0) {
    const ratio = Math.min(1, excess / slack);
    for (let index = 0; index < used.length; index += 1) {
      gaps[index] = Math.floor(gaps[index] - (gaps[index] - layoutV2.floorGap) * ratio);
    }
  }
  const centers = [];
  let x = layoutV2.marginX;
  for (let col = 0; col <= 4; col += 1) {
    centers.push(x + widths[col] / 2);
    x += widths[col] + (gaps[col] ?? 0);
  }
  return centers;
})();

// Rows render in authored lane order with `main` first and `terminal` last;
// lanes without states get no row and no title.
function laneRowOrder() {
  const lanes = asArray(lifecycle.lanes);
  const populated = new Set(asArray(lifecycle.states).map((state) => state.lane));
  const ordered = [];
  if (populated.has('main')) ordered.push('main');
  for (const lane of lanes) {
    if (lane.id !== 'main' && lane.id !== 'terminal' && populated.has(lane.id)) ordered.push(lane.id);
  }
  if (populated.has('terminal')) ordered.push('terminal');
  return ordered;
}

const v2RowTop = new Map(isV2
  ? laneRowOrder().map((laneId, index) => [laneId, layoutV2.firstRowTop + index * layoutV2.rowPitch])
  : []);

const typeClass = {
  start: 'c-frontend',
  active: 'c-frontend',
  waiting: 'c-cloud',
  decision: 'c-database',
  success: 'c-backend',
  failure: 'c-security',
  neutral: 'c-external',
  external: 'c-external'
};

const textClass = {
  start: 't-frontend',
  active: 't-frontend',
  waiting: 't-cloud',
  decision: 't-database',
  success: 't-backend',
  failure: 't-security',
  neutral: 't-muted',
  external: 't-muted'
};

// Lane semantics are fixed: lane id "main" maps to the top phase band, lane id
// "terminal" maps to the bottom outcome band, and every other lane shares the
// middle event band (separated visually via yOffset). v1 only.
function bandFor(lane) {
  if (lane === 'main') return 'phase';
  if (lane === 'terminal') return 'outcome';
  return 'event';
}

function measureState(state) {
  let width;
  let height;
  let cx;
  let y;
  if (isV2) {
    width = state.width || layoutV2.stateW;
    height = state.height || layoutV2.stateH;
    cx = v2ColumnCenters[state.col] ?? NaN;
    y = (v2RowTop.get(state.lane) ?? NaN) + (state.yOffset || 0);
  } else {
    const isPhase = bandFor(state.lane) === 'phase';
    const isOutcome = bandFor(state.lane) === 'outcome';
    width = state.width || (isPhase ? layout.phaseW : isOutcome ? layout.outcomeW : layout.eventW);
    height = state.height || (isPhase ? layout.phaseH : isOutcome ? layout.outcomeH : layout.eventH);
    const xs = isPhase ? layout.phaseXs : isOutcome ? layout.outcomeXs : layout.eventXs;
    cx = xs[state.col] ?? xs[xs.length - 1];
    y = (
      isPhase ? layout.phaseY :
        isOutcome ? layout.outcomeY :
          layout.eventY
    ) + (state.yOffset || 0);
  }
  return {
    ...state,
    width,
    height,
    x: cx - width / 2,
    y,
    cx,
    cy: y + height / 2
  };
}

const states = new Map(asArray(lifecycle.states).map((state) => [state.id, measureState(state)]));
const plannedTransitions = asArray(lifecycle.transitions).filter(plannerRouted);
const v2Rows = laneRowOrder();
const v2RowOf = (state) => (v2Rows.includes(state.lane) ? v2Rows.indexOf(state.lane) : undefined);
let useGridRouter = isV2;
if (isV2) {
  // Route once to learn how many horizontal tracks each row gap carries,
  // then open every gap to fit them before the final routing pass.
  const probe = createLifecycleGridRouter(states, plannedTransitions, {
    rowOf: v2RowOf, columnXs: v2ColumnCenters,
  });
  // Compatible pins keep the grid layout. A conflicting pin sends the whole
  // scene to the side-aware planner so all edges still share port spreading
  // and obstacle reservations.
  useGridRouter = plannedTransitions.every(transition => {
    const sides = probe.connectionSides(transition);
    return ['fromSide', 'toSide'].every(key => !transition[key] || transition[key] === 'auto' || transition[key] === sides[key]);
  });
  let top = layoutV2.firstRowTop;
  v2Rows.forEach((laneId, index) => {
    const rowHeight = Math.max(layoutV2.stateH, ...[...states.values()]
      .filter((state) => state.lane === laneId)
      .m
```

### Core Architecture Module: `archify/renderers/sequence/render-sequence.mjs`
```
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { esc, renderDefinitions, renderSemanticSigil, textUnits } from '../shared/utils.mjs';
import { animateAttr, focusEdgeAttrs, focusNodeAttrs, focusNodeTitle, loadDiagramWithBrandMarks, writeDiagram, svgAccessibleText, svgRootAttrs } from '../shared/cli.mjs';
import { throwDiagnosticProblems } from '../shared/diagnostics.mjs';
import { legendFootprint, measureLegend, resolveLegend, renderLegend as renderResolvedLegend } from '../shared/legend.mjs';
import { componentFill, arrowClassMap, rectsOverlap, cleanFlowProblems, cleanCrossingProblems, cleanAmbiguousCorridorProblems, cleanBorderRunProblems, cleanRouteRhythmProblems, cleanLabelRouteClearanceProblems, cleanLabelCanvasContainmentProblems, routePointsValue, asArray, isFinitePoint, edgeLabelAccent } from '../shared/geometry.mjs';
import { availableNodeTextWidth, fittedNodeFontSize, minimumNodeTextWidth } from '../shared/text-fit.mjs';
import { brandLabelFitWidth, brandMetadataFor, brandTopRailProblem, renderBrandMark } from '../shared/brand-marks.mjs';
import { translateMessage as i18nText } from '../shared/i18n.mjs';

const participantTextFit = {
  sublabelPreferred: 7,
  sublabelMinimum: 6,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { diagram: sequence, template, outPath, sourceEvidence } = await loadDiagramWithBrandMarks({
  rendererDir: __dirname,
  diagramType: 'sequence',
  defaultExample: 'cache-miss-request.sequence.json'
});

const LEGEND_CATALOG = [
  { kind: 'emphasis', className: 'a-emphasis', marker: 'arrowhead-emphasis', strokeWidth: 1.8 },
  { kind: 'return', className: 'a-default', marker: 'arrowhead', dash: '3,5' },
  { kind: 'security', className: 'a-security', marker: 'arrowhead-security' },
  { kind: 'dashed', className: 'a-dashed', marker: 'arrowhead-dashed' },
  { kind: 'default', className: 'a-default', marker: 'arrowhead' },
].map((entry) => ({
  ...entry,
  interactive: false,
  swatchWidth: 34,
  swatchGap: 9,
  label: i18nText(sequence.meta.locale, `legend.sequence.${entry.kind}`),
}));

function legendEntries() {
  const presentKinds = new Set(asArray(sequence.messages).map((message) => message.variant || 'default'));
  return resolveLegend(sequence.meta?.legend, LEGEND_CATALOG, presentKinds);
}

// The legend sits below the timeline content: the last message and its note,
// activation bars, and segment frames. Its block starts LEGEND_CONTENT_GAP
// below that content; from the block top to the canvas bottom a one-row legend
// needs LEGEND_BLOCK_HEIGHT (title glyphs, row, and the 54px baseline inset).
const LEGEND_CONTENT_GAP = 12;
const LEGEND_BLOCK_HEIGHT = 86;
const contentBottom = Math.max(
  0,
  ...asArray(sequence.messages).map((message) => message.y + (message.note ? 22 : 6)),
  ...asArray(sequence.activations).map((activation) => activation.to),
  ...asArray(sequence.segments).map((segment) => segment.to),
);
function legendRequiredHeight(width) {
  const entries = legendEntries();
  if (!entries.length) return 0;
  return Math.ceil(contentBottom + LEGEND_CONTENT_GAP + LEGEND_BLOCK_HEIGHT
    + legendFootprint(entries, { width: width - 80 }).extraHeight);
}
// A renderer-sized canvas grows to keep the legend clear of late messages;
// an authored viewBox is honored and validated below.
const viewBox = sequence.meta?.viewBox || [920, Math.max(760, legendRequiredHeight(920))];
// The timeline scales with viewBox height: a taller viewBox gains message room,
// a shorter one shrinks the readable band (validated below) instead of clipping.
// `column_fit: "spread"` widens the lanes with the viewBox instead of keeping
// the fixed 108px gap, so a wide canvas gains column distance and label room
// rather than dead space on the right. The default stays "fixed" so existing
// diagrams keep their coordinates.
const columnFit = sequence.meta?.column_fit === 'spread' ? 'spread' : 'fixed';
const participantCount = Math.max(1, asArray(sequence.participants).length);
const sideMargin = 62;
const participantW = columnFit === 'spread'
  ? Math.max(86, Math.min(190, Math.round((viewBox[0] - sideMargin * 2) / participantCount) - 24))
  : 86;
const colGap = columnFit === 'spread' && participantCount > 1
  ? Math.max(108, (viewBox[0] - 40 - sideMargin - participantW) / (participantCount - 1))
  : 108;

// Showcase is the fast-authoring default; standard retains legacy label geometry.
const readableMessages = sequence.meta?.quality_profile === 'showcase';
const messageFontSize = readableMessages ? 11 : 9;
const messageUnitWidth = readableMessages ? 6.6 : 5.2;
const layout = {
  topY: 72,
  participantW,
  // Keep a separate top rail for the 11px semantic sigil and 16px brand mark.
  // Literal labels retain their fitted font size and full authored wording.
  participantH: 60,
  participantLabelY: 36,
  participantSublabelY: 50,
  lifelineTop: 142,
  lifelineBottom: viewBox[1] - 65,
  legendY: viewBox[1] - 54,
  leftX: columnFit === 'spread' ? sideMargin + participantW / 2 : sideMargin,
  colGap,
  labelH: readableMessages ? 18 : 16
};

const participantBoxWidthNote = columnFit === 'spread'
  ? `participant boxes are ${participantW}px for this viewBox width and ${participantCount} participants`
  : `participant boxes are a fixed ${participantW}px unless meta.column_fit is "spread"`;

const arrowClass = {
  ...arrowClassMap,
  return: ['a-default', 'arrowhead']
};

function participantX(index) {
  return layout.leftX + index * layout.colGap;
}

const participants = new Map(asArray(sequence.participants).map((participant, index) => [
  participant.id,
  {
    ...participant,
    index,
    cx: participantX(index),
    x: participantX(index) - layout.participantW / 2,
    y: layout.topY,
    width: layout.participantW,
    height: layout.participantH,
    cy: layout.topY + layout.participantH / 2
  }
]));

function messageGeometry(message) {
  const from = participants.get(message.from);
  const to = participants.get(message.to);
  if (!from || !to || typeof message.y !== 'number') return null;
  const direction = to.cx > from.cx ? 1 : -1;
  const start = from.cx + direction * 7;
  const end = to.cx - direction * 7;
  return { start, end, center: (start + end) / 2 };
}

function messageLabelBox(message, relationIndex = null) {
  const geometry = messageGeometry(message);
  if (!geometry) return null;
  const width = Math.max(34, textUnits(message.label) * messageUnitWidth + 12);
  return {
    relation: message,
    relationIndex,
    label: message.label,
    x: geometry.center - width / 2,
    y: message.y - 20,
    width,
    height: layout.labelH,
  };
}

function messageRouteBox(message) {
  const geometry = messageGeometry(message);
  if (!geometry) return null;
  return {
    x: Math.min(geometry.start, geometry.end),
    y: message.y - 2,
    width: Math.abs(geometry.end - geometry.start),
    height: 4,
  };
}

function segmentLabelBox(segment) {
  const labelW = Math.max(42, textUnits(segment.label) * 5.2 + 14);
  const occupied = asArray(sequence.messages)
    .flatMap((message) => [messageLabelBox(message), messageRouteBox(message)])
    .filter(Boolean);
  const label = { x: 56, y: segment.from - 22, width: labelW, height: 18 };
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (!occupied.some((rect) => rectsOverlap(label, rect, 2))) break;
    label.y -= 22;
  }
  return label;
}

const compositionFrames = asArray(sequence.segments).map((segment, index) => ({
  id: index,
  label: segment.label,
  kind: 'segment',
  x: 48,
  y: segment.from,
  width: viewBox[0] - 96,
  height: segment.to - segment.from,
  radius: 10,
}));

function messagePath(message) {
  return {
    points: participants.has(message.from) && participants.has(message.to)
      ? [[participants.get(message.from).cx, message.y], [participants.get(message.to).cx, message.y]]
      : []
  };
}

function validateSequence() {
  const problems = [];
  if (participants.size !== asArray(sequence.participants).length) problems.push('Participant ids must be unique.');

  if (layout.lifelineBottom - layout.lifelineTop < 120) {
    problems.push(`viewBox height ${viewBox[1]} leaves under 120px of timeline — set meta.viewBox[1] to at least ${layout.lifelineTop + 120 + 65}.`);
  }

  for (const participant of participants.values()) {
    const estLabelW = textUnits(participant.label) * 6.8;
    if (estLabelW > layout.participantW + 6) {
      problems.push(`Label "${participant.label}" (~${Math.round(estLabelW)}px) is wider than the ${layout.participantW}px participant box — shorten it.`);
    }
    const brandRailProblem = brandTopRailProblem(participant, layout.participantW, 8, 'Participant');
    if (brandRailProblem) problems.push(brandRailProblem);
    // sublabel renders as a single unwrapped <text>; shrink-to-fit handles the
    // ordinary case, this rejects what it cannot rescue.
    if (participant.sublabel) {
      const availableTextW = availableNodeTextWidth(layout.participantW);
      const minimumW = minimumNodeTextWidth(participant.sublabel, participantTextFit.sublabelMinimum);
      if (minimumW > availableTextW) {
        problems.push(`Sublabel "${participant.sublabel}" needs ~${Math.ceil(minimumW)}px at the ${participantTextFit.sublabelMinimum}px legible minimum, but participant "${participant.id}" provides ${availableTextW}px — shorten the sublabel (${participantBoxWidthNote}).`);
      }
    }
  }

  for (const message of asArray(sequence.messages)) {
    if (!participants.has(message.from)) problems.push(`Message "${message.label}" references unknown source "${message.from}".`);
    if (!participants.has(message.to)) problems.push(`Message "${message.label}" references unknown target "${message.to}".`);
    if (typeof message.y !== 'number') problems.push(`Message "${message.label}" must provide a numeric y.`);
    if (message.y < layout.lifelineTop + 18 || message.y > layout.lifelineBottom - 18) {
      problems.push(`Message "${message.l
```

### Core Architecture Module: `archify/renderers/shared/atomic-output.mjs`
```
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { canonicalFuturePath } from './output-path.mjs';

function relation(status, code, details = {}) {
  return { status, reason: { code, ...details } };
}

function filesystemFailure(code, error, details = {}) {
  return relation('unknown', code, {
    ...details,
    ...(typeof error?.code === 'string' ? { systemCode: error.code } : {}),
    ...(typeof error?.message === 'string' ? { message: error.message } : {}),
  });
}

function entryType(metadata) {
  if (metadata.isFile()) return 'file';
  if (metadata.isSymbolicLink()) return 'symbolic-link';
  if (metadata.isDirectory()) return 'directory';
  if (metadata.isFIFO()) return 'fifo';
  if (metadata.isSocket()) return 'socket';
  if (metadata.isBlockDevice()) return 'block-device';
  if (metadata.isCharacterDevice()) return 'character-device';
  return 'other';
}

// Windows lstat can fall back to directory enumeration when a file handle
// cannot be opened, and that fallback reports a synthetic link count of one.
// Treat handle-backed fstat as authoritative and fail closed when it cannot be
// reconciled with the no-follow path snapshots on either side of the open.
function captureRegularFileHandle(filePath, initial, subject) {
  const pathKey = subject === 'target'
    ? 'commitPath'
    : subject === 'requested-entry'
      ? 'requestedPath'
      : 'candidatePath';
  if (initial.ino === 0n) {
    return relation('unknown', `${subject}-identity-unavailable`, { [pathKey]: filePath });
  }
  let descriptor;
  let handle;
  let current;
  let closeError;
  try {
    const noFollow = process.platform === 'win32' ? 0 : (fs.constants.O_NOFOLLOW || 0);
    const nonBlock = fs.constants.O_NONBLOCK || 0;
    descriptor = fs.openSync(filePath, fs.constants.O_RDONLY | noFollow | nonBlock);
    handle = fs.fstatSync(descriptor, { bigint: true });
    current = fs.lstatSync(filePath, { bigint: true });
  } catch (error) {
    return filesystemFailure(`${subject}-handle-inspection-failed`, error, {
      [pathKey]: filePath,
    });
  } finally {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch (error) {
        closeError = error;
      }
    }
  }
  if (closeError) {
    return filesystemFailure(`${subject}-handle-close-failed`, closeError, {
      [pathKey]: filePath,
    });
  }
  if (!handle.isFile() || !current.isFile()
    || handle.ino === 0n || current.ino === 0n
    || handle.dev !== initial.dev || handle.ino !== initial.ino
    || current.dev !== handle.dev || current.ino !== handle.ino) {
    return relation('unknown', `${subject}-changed-during-inspection`, {
      [pathKey]: filePath,
    });
  }
  if (handle.nlink === 0n) {
    return relation('unknown', `${subject}-link-count-unavailable`, {
      [pathKey]: filePath,
    });
  }
  if (handle.nlink !== 1n) {
    return relation('unsupported', `${subject}-hardlinked`, {
      [pathKey]: filePath,
      links: handle.nlink.toString(),
    });
  }
  return { status: 'captured', metadata: handle };
}

const regularFileBindings = new WeakMap();
const regularFileBindingGroups = new Map();
const digestChunkBytes = 64 * 1024;
const removalCleanupSignal = new Int32Array(new SharedArrayBuffer(4));
const removalCleanupAttempts = 10;
const publicationRecoveryRecordName = 'publication-recovery-v1.json';
const publicationRecoveryRecordVersion = 1;
const publicationRecoveryRecordMaxBytes = 16 * 1024;

export function removeEmptyDirectoryWithRetry(directory, { retry = true } = {}) {
  const attempts = retry ? removalCleanupAttempts : 1;
  let failure;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      fs.rmdirSync(directory);
      return;
    } catch (error) {
      failure = error;
      // SMB can acknowledge unlink before a following directory removal sees
      // the deleted entry disappear. Retrying rmdir is claimant-safe: a real
      // entry keeps the directory non-empty and is never removed recursively.
      if (error?.code !== 'ENOTEMPTY' || attempt === attempts - 1) break;
      Atomics.wait(
        removalCleanupSignal,
        0,
        0,
        Math.min(5 * (2 ** attempt), 250),
      );
    }
  }
  throw failure;
}

function validExpectedLinks(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function validateBindingExpectations(options) {
  const hasSha256 = options.expectedSha256 !== undefined;
  const hasBytes = options.expectedBytes !== undefined;
  const expectedIdentity = options.expectedIdentity;
  if (hasSha256 !== hasBytes
    || (hasSha256 && !/^[a-f\d]{64}$/i.test(options.expectedSha256))
    || (hasBytes && (!Number.isSafeInteger(options.expectedBytes) || options.expectedBytes < 0))
    || (options.expectedMode !== undefined
      && (!Number.isSafeInteger(options.expectedMode)
        || options.expectedMode < 0
        || options.expectedMode > 0o777))
    || (expectedIdentity !== undefined
      && (typeof expectedIdentity?.device !== 'bigint'
        || typeof expectedIdentity?.inode !== 'bigint'
        || expectedIdentity.inode === 0n))
    || typeof options.includeContent !== 'boolean'
    || !validExpectedLinks(options.expectedLinks)) {
    return relation('unknown', 'invalid-regular-file-binding-expectation');
  }
  return null;
}

function descriptorDigest(descriptor, expectedSize, subject, filePath, includeContent) {
  if (expectedSize < 0n || expectedSize > BigInt(Number.MAX_SAFE_INTEGER)) {
    return relation('unknown', `${subject}-size-unavailable`, { filePath });
  }
  const expectedBytes = Number(expectedSize);
  const digest = createHash('sha256');
  let capturedContent;
  let chunk;
  try {
    capturedContent = includeContent ? Buffer.allocUnsafe(expectedBytes) : null;
    chunk = capturedContent
      || Buffer.allocUnsafe(Math.min(digestChunkBytes, Math.max(1, expectedBytes)));
  } catch (error) {
    return filesystemFailure(`${subject}-content-inspection-failed`, error, { filePath });
  }
  let bytes = 0;
  try {
    while (bytes < expectedBytes) {
      const offset = includeContent ? bytes : 0;
      const read = fs.readSync(
        descriptor,
        chunk,
        offset,
        Math.min(digestChunkBytes, chunk.byteLength - offset, expectedBytes - bytes),
        bytes,
      );
      if (read === 0) break;
      digest.update(chunk.subarray(offset, offset + read));
      bytes += read;
    }
  } catch (error) {
    return filesystemFailure(`${subject}-content-inspection-failed`, error, { filePath });
  }
  return {
    status: 'inspected',
    sha256: digest.digest('hex'),
    bytes,
    ...(includeContent ? { buffer: capturedContent.subarray(0, bytes) } : {}),
  };
}

function sameHandleState(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.nlink === right.nlink
    && left.mode === right.mode
    && left.size === right.size
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function inspectRegularFileDescriptor({
  descriptor,
  filePath,
  identity,
  subject,
  expectedLinks,
  phase,
  includeContent = false,
}) {
  let beforeHandle;
  let beforePath;
  let afterHandle;
  let afterPath;
  let content;
  try {
    beforeHandle = fs.fstatSync(descriptor, { bigint: true });
    beforePath = fs.lstatSync(filePath, { bigint: true });
  } catch (error) {
    return filesystemFailure(`${subject}-handle-${phase}-failed`, error, { filePath });
  }
  if (!beforeHandle.isFile() || !beforePath.isFile()) {
    return relation('unsupported', `${subject}-not-regular-file`, {
      filePath,
      entryType: entryType(beforePath),
    });
  }
  if (beforeHandle.ino === 0n || beforePath.ino === 0n) {
    return relation('unknown', `${subject}-identity-unavailable`, { filePath });
  }
  if (beforeHandle.dev !== identity.device
    || beforeHandle.ino !== identity.inode
    || beforePath.dev !== beforeHandle.dev
    || beforePath.ino !== beforeHandle.ino) {
    return relation(phase === 'inspection' ? 'unknown' : 'different',
      `${subject}-${phase === 'inspection' ? 'changed-during-inspection' : 'identity-changed'}`,
      { filePath });
  }
  if (beforeHandle.nlink === 0n) {
    return relation('unknown', `${subject}-link-count-unavailable`, { filePath });
  }
  if (beforeHandle.nlink !== BigInt(expectedLinks)) {
    if (beforeHandle.nlink > BigInt(expectedLinks)) {
      return relation('unsupported', `${subject}-hardlinked`, {
        filePath,
        links: beforeHandle.nlink.toString(),
      });
    }
    return relation('different', `${subject}-link-count-changed`, {
      filePath,
      expectedLinks,
      currentLinks: beforeHandle.nlink.toString(),
    });
  }
  content = descriptorDigest(
    descriptor,
    beforeHandle.size,
    subject,
    filePath,
    includeContent,
  );
  if (content.status !== 'inspected') return content;
  try {
    afterHandle = fs.fstatSync(descriptor, { bigint: true });
    afterPath = fs.lstatSync(filePath, { bigint: true });
  } catch (error) {
    return filesystemFailure(`${subject}-handle-${phase}-failed`, error, { filePath });
  }
  if (!afterHandle.isFile() || !afterPath.isFile()
    || afterHandle.ino === 0n || afterPath.ino === 0n
    || afterHandle.dev !== identity.device || afterHandle.ino !== identity.inode
    || afterPath.dev !== afterHandle.dev || afterPath.ino !== afterHandle.ino) {
    return relation(phase === 'inspection' ? 'unknown' : 'different',
      `${subject}-${phase === 'inspection' ? 'changed-during-inspection' : 'identity-changed'}`,
      { filePath });
  }
  if (!sameHandleState(beforeHandle, afterHandle)) {
    return relation('unknown', `${subject}-changed-during-${phase}`, { filePath });
  }
  if (content.bytes !== Number(afterHandle.size)) {
    return relation('unknown', `${subject}-changed-during-${phase}`, { filePath });
  }
  return { status: 'inspected', metadata: afterHandle, content };
}

function closeCaptured
```

### Core Architecture Module: `archify/renderers/shared/brand-marks.mjs`
```
import { createHash } from 'node:crypto';
import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { BRAND_MARKS } from './generated-brand-marks.mjs';
import { throwDiagnosticError } from './diagnostics.mjs';
import { esc, textUnits } from './utils.mjs';

const COLLECTIONS = Object.freeze({
  architecture: 'components',
  workflow: 'nodes',
  sequence: 'participants',
  dataflow: 'nodes',
  lifecycle: 'states',
});
const MARK_BY_LOOKUP = new Map();
const MARK_BY_DOMAIN = new Map();
const RESOLVED_BY_NODE = new WeakMap();
const RESOLVED_MARK = Symbol('archify.brandMark');
const MAX_HTML_BYTES = 256 * 1024;
const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_CAPTURE_CONCURRENCY = 3;
const DEFAULT_CAPTURE_TIMEOUT_MS = 8000;
const USER_AGENT = 'Archify/2.15 brand-preview';

function lookupForms(value) {
  const raw = String(value ?? '').trim().toLocaleLowerCase('en-US');
  if (!raw) return [];
  const dashed = raw.replace(/[\s_]+/g, '-');
  const compact = raw.replace(/[\s_.-]+/g, '');
  return [...new Set([raw, dashed, compact])];
}

for (const mark of BRAND_MARKS) {
  for (const value of [mark.id, mark.title, ...mark.aliases]) {
    for (const form of lookupForms(value)) {
      if (!MARK_BY_LOOKUP.has(form)) MARK_BY_LOOKUP.set(form, mark);
    }
  }
  for (const domain of mark.domains) MARK_BY_DOMAIN.set(domain, mark);
}

function asUrl(value) {
  try {
    const url = new URL(String(value));
    return ['https:', 'http:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

function domainMark(hostname) {
  const host = hostname.toLocaleLowerCase('en-US').replace(/\.$/, '');
  const candidates = [...MARK_BY_DOMAIN.entries()]
    .filter(([domain]) => host === domain || host.endsWith(`.${domain}`))
    .sort(([left], [right]) => right.length - left.length);
  return candidates[0]?.[1] || null;
}

export function findBrandMark(value) {
  const url = asUrl(value);
  if (url) return domainMark(url.hostname);
  for (const form of lookupForms(value)) {
    const mark = MARK_BY_LOOKUP.get(form);
    if (mark) return mark;
  }
  return null;
}

export function listBrandMarks(query = '') {
  const needle = String(query).trim().toLocaleLowerCase('en-US');
  return BRAND_MARKS.filter((mark) => {
    if (!needle) return true;
    return [mark.id, mark.title, mark.category, ...mark.aliases, ...mark.domains]
      .some((value) => String(value).toLocaleLowerCase('en-US').includes(needle));
  }).map(({ path, ...mark }) => mark);
}

function ipv4Private(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 192 && b === 88 && c === 99)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113);
}

function ipv6Private(address) {
  const normalized = address.toLocaleLowerCase('en-US').split('%')[0];
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('ff') || /^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith('64:ff9b:') || normalized.startsWith('100:')
    || normalized.startsWith('2001:db8:') || normalized.startsWith('2002:')) return true;
  const mappedDotted = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mappedDotted) return ipv4Private(mappedDotted[1]);
  const mappedHex = normalized.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = Number.parseInt(mappedHex[1], 16);
    const low = Number.parseInt(mappedHex[2], 16);
    return ipv4Private(`${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`);
  }
  const compatibleHex = normalized.match(/^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (compatibleHex) {
    const high = Number.parseInt(compatibleHex[1], 16);
    const low = Number.parseInt(compatibleHex[2], 16);
    return ipv4Private(`${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`);
  }
  return false;
}

export function isPrivateBrandAddress(address) {
  const family = net.isIP(address);
  return family === 4 ? ipv4Private(address) : (family === 6 ? ipv6Private(address) : true);
}

function validateUrlShape(url, allowPrivate = process.env.ARCHIFY_BRAND_ALLOW_PRIVATE === '1') {
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('only HTTP(S) brand links are supported');
  if (url.username || url.password) throw new Error('brand links cannot contain credentials');
  const expectedPort = url.protocol === 'https:' ? '443' : '80';
  if (!allowPrivate && url.port && url.port !== expectedPort) {
    throw new Error('brand links must use a standard web port');
  }
  const host = url.hostname.toLocaleLowerCase('en-US').replace(/\.$/, '').replace(/^\[|\]$/g, '');
  if (!allowPrivate && (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local'))) {
    throw new Error('private brand links are not fetched');
  }
  return host;
}

function beforeDeadline(promise, deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(new Error('brand capture timed out'));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('brand capture timed out')), remaining);
    timer.unref?.();
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

async function resolveRequestTarget(url, deadline) {
  const allowPrivate = process.env.ARCHIFY_BRAND_ALLOW_PRIVATE === '1';
  const host = validateUrlShape(url, allowPrivate);
  const directFamily = net.isIP(host);
  const addresses = directFamily
    ? [{ address: host, family: directFamily }]
    : await beforeDeadline(lookup(host, { all: true, verbatim: true }), deadline);
  if (!addresses.length || (!allowPrivate && addresses.some(({ address }) => isPrivateBrandAddress(address)))) {
    throw new Error('private brand links are not fetched');
  }
  return addresses[0];
}

function timeoutSignal(milliseconds) {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(milliseconds);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  timer.unref?.();
  return controller.signal;
}

function captureTimeoutMilliseconds() {
  const configured = Number(process.env.ARCHIFY_BRAND_CAPTURE_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return DEFAULT_CAPTURE_TIMEOUT_MS;
  return Math.max(100, Math.min(30000, Math.round(configured)));
}

function requestPinned(url, accept, target, deadline) {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(url, {
      method: 'GET',
      signal: timeoutSignal(Math.max(1, Math.min(4500, deadline - Date.now()))),
      headers: { accept, 'accept-encoding': 'identity', 'user-agent': USER_AGENT },
      // Reuse the exact public address that passed validation. This closes the
      // DNS-rebinding gap between checking a hostname and opening its socket.
      lookup(_hostname, options, callback) {
        if (options?.all) callback(null, [target]);
        else callback(null, target.address, target.family);
      },
    }, (response) => {
      const status = response.statusCode || 0;
      resolve({
        status,
        ok: status >= 200 && status < 300,
        headers: {
          get(name) {
            const value = response.headers[String(name).toLocaleLowerCase('en-US')];
            return Array.isArray(value) ? value.join(', ') : (value ?? null);
          },
        },
        body: response,
      });
    });
    request.on('error', reject);
    request.end();
  });
}

async function checkedFetch(input, accept, deadline) {
  let current = new URL(input);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (Date.now() >= deadline) throw new Error('brand capture timed out');
    const target = await resolveRequestTarget(current, deadline);
    const response = await requestPinned(current, accept, target, deadline);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      response.body.resume();
      if (!location || redirects === 3) throw new Error('brand link redirected too many times');
      current = new URL(location, current);
      continue;
    }
    if (!response.ok) {
      response.body.resume();
      throw new Error(`brand link returned HTTP ${response.status}`);
    }
    // Raw HTTP responses are not decompressed. Check successful bodies before
    // HTML discovery or image validation so byte limits and digests stay valid.
    const contentEncoding = (response.headers.get('content-encoding') || '').trim().toLowerCase();
    if (contentEncoding && contentEncoding !== 'identity') {
      response.body.destroy();
      throw new Error(`unsupported brand content encoding ${contentEncoding}`);
    }
    return { response, finalUrl: current };
  }
  throw new Error('brand link redirected too many times');
}

async function readLimited(response, maximum) {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximum) {
    response.body?.destroy?.();
    throw new Error('brand asset is too large');
  }
  if (response.body && typeof response.body[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    let total = 0;
    for await (const value of response.body) {
      total += v
```

### Core Architecture Module: `archify/renderers/shared/cli.mjs`
```
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { applyTemplate, renderCards, esc } from './utils.mjs';
import { validateSchema } from './validator.mjs';
import { verifyRepositoryEvidence } from './repository-evidence.mjs';
import { installRendererDiagnosticBoundary, throwDiagnosticError, throwDiagnosticProblems, recordDiagnostic } from './diagnostics.mjs';
import { validateEngineeringProfile } from './engineering-profiles.mjs';
import {
  resolveOutputPath,
  validateAuthoredOutputPath,
} from './output-path.mjs';
import {
  captureAtomicOutput,
  captureRegularFileBinding,
  publishRegularFileBinding,
  releaseRegularFileBinding,
  removeOwnedRegularFile,
  verifyAtomicOutput,
} from './atomic-output.mjs';
import { resolveLocale, translateMessage, registerLocale, SUPPORTED_LOCALES } from './i18n.mjs';
import { prepareDiagramBrandMarks } from './brand-marks.mjs';

const outputPathGuards = new Map();
let renderCandidateSequence = 0;

// meta.locale is renderer-owned Viewer UI, not authored content.
// en and zh-CN ship as built-in catalogs.
// Any other tag needs meta.translations (validated against the English
// message-key set, layered over English per-key so partial/invalid entries
// never break rendering) or it falls back to the English Viewer chrome —
// the same "omit locale, disclose the fallback" contract as before, just
// resolved from data instead of a hard-coded enum. See i18n.mjs.
function applyLocaleTranslations(diagramType, diagram) {
  const locale = diagram.meta?.locale;
  if (!locale) return;
  const translations = diagram.meta?.translations;
  if (translations && Object.keys(translations).length) {
    const report = registerLocale(locale, translations);
    if (report.missingKeys.length || report.unknownKeys.length || report.placeholderMismatches.length) {
      recordDiagnostic({
        code: 'i18n/translation-coverage',
        severity: 'warning',
        message: `meta.translations for locale ${JSON.stringify(locale)} covers ${report.coveredKeys}/${report.totalKeys} renderer-owned messages (${Math.round(report.coverage * 100)}%); uncovered keys fall back to English.`,
        subject: { diagramType, path: '/meta/translations' },
        evidence: {
          missingKeys: report.missingKeys.slice(0, 10),
          missingKeysTotal: report.missingKeys.length,
          unknownKeys: report.unknownKeys.slice(0, 10),
          unknownKeysTotal: report.unknownKeys.length,
          placeholderMismatches: report.placeholderMismatches.slice(0, 10),
          placeholderMismatchesTotal: report.placeholderMismatches.length,
        },
        supportedFixes: ['Add the missing keys to meta.translations.', 'Match each translation\'s {placeholders} to the English source string.'],
      });
      // Coverage is a fact about this render, not just a diagnostic-mode
      // artifact: print it to stderr unconditionally so `render`/`deliver`/
      // `validate` disclose the fallback even without ARCHIFY_DIAGNOSTIC_FORMAT.
      console.warn(`archify: meta.translations for locale ${JSON.stringify(locale)} covers ${report.coveredKeys}/${report.totalKeys} renderer-owned messages (${Math.round(report.coverage * 100)}%); uncovered keys fall back to English.`);
    }
  } else if (!SUPPORTED_LOCALES.includes(locale)) {
    recordDiagnostic({
      code: 'i18n/locale-fallback',
      severity: 'warning',
      message: `meta.locale ${JSON.stringify(locale)} has no built-in catalog and no meta.translations; the Viewer chrome and <html lang> fall back to English.`,
      subject: { diagramType, path: '/meta/locale' },
      supportedFixes: ['Supply meta.translations for this locale.', `Use a built-in locale: ${SUPPORTED_LOCALES.join(', ')}.`],
    });
    console.warn(`archify: meta.locale ${JSON.stringify(locale)} has no built-in catalog and no meta.translations; the Viewer chrome and <html lang> fall back to English.`);
  }
}

// Common CLI head: node render-<type>.mjs [input.json] [output.html]
// Keep this synchronous because callers also use it to establish the guarded
// output path before testing a last-moment filesystem alias change.
export function loadDiagram({ rendererDir, diagramType, defaultExample, argv = process.argv }) {
  // Compilers also import this module for SVG helpers. Only CLI execution
  // should install a process-level handler, before reading or validating input.
  installRendererDiagnosticBoundary();
  const skillRoot = path.resolve(rendererDir, '../..');
  const inputPath = path.resolve(argv[2] || path.join(skillRoot, 'examples', defaultExample));
  let input;
  try {
    input = fs.readFileSync(inputPath, 'utf8');
  } catch (error) {
    if (!isFilesystemError(error)) throw error;
    const message = `Input could not be read: ${error.message}`;
    throwDiagnosticError(message, [{
      code: 'input/read', message,
      subject: { input: inputPath },
      evidence: { systemCode: error.code, reason: error.message },
      supportedFixes: ['provide one readable JSON input file'],
    }]);
  }
  let diagram;
  try {
    diagram = JSON.parse(input);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    const message = `Input JSON could not be parsed: ${error.message}`;
    throwDiagnosticError(message, [{
      code: 'input/json-parse', message,
      subject: { input: inputPath },
      evidence: { reason: error.message },
      supportedFixes: ['repair the JSON syntax and run validation again'],
    }]);
  }
  const authoredOutput = diagram?.meta?.output;
  if (authoredOutput !== undefined) validateAuthoredOutputPath(authoredOutput);
  validateSchema(diagramType, diagram);
  applyLocaleTranslations(diagramType, diagram);
  validateCrossCollectionContracts(diagramType, diagram);
  validateEngineeringProfile(diagramType, diagram);
  const sourceEvidence = verifyRepositoryEvidence(diagramType, diagram, process.env.ARCHIFY_REPO_ROOT);
  const template = fs.readFileSync(path.join(skillRoot, 'assets/template.html'), 'utf8');
  const outputRequest = {
    requestedOutput: argv[3],
    authoredOutput: diagram.meta?.output,
    defaultOutput: `${diagramType}.html`,
    inputPaths: [inputPath],
    cwd: process.cwd(),
  };
  let outPath;
  try {
    ({ outputPath: outPath } = resolveOutputPath(outputRequest));
  } catch (error) {
    throwOutputError(error, path.resolve(outputRequest.requestedOutput || outputRequest.authoredOutput || outputRequest.defaultOutput));
  }
  outputPathGuards.set(outPath, outputRequest);
  return { diagram, template, outPath, sourceEvidence };
}

// Brand URL capture is the only asynchronous authoring step. Typed renderers
// opt into it through this wrapper without changing loadDiagram's long-lived
// synchronous safety contract.
export async function loadDiagramWithBrandMarks(options) {
  const loaded = loadDiagram(options);
  await prepareDiagramBrandMarks(options.diagramType, loaded.diagram);
  return loaded;
}

const START_TYPES = new Set(['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle']);

function isFilesystemError(error) {
  return typeof error?.code === 'string'
    && typeof error?.syscall === 'string'
    && typeof error?.errno === 'number';
}

function throwOutputError(error, output) {
  if (error?.archifyDiagnostics || !isFilesystemError(error)) throw error;
  const message = `Output could not be written: ${error.message}`;
  throwDiagnosticError(message, [{
    code: 'output/write', message,
    subject: { output },
    evidence: { systemCode: error.code, reason: error.message },
    supportedFixes: ['choose a writable HTML file path and ensure its parent directories can be created'],
  }]);
}

function throwAtomicOutputFailure(result, output) {
  const reason = result.reason || { code: 'unclassified' };
  const changed = result.status === 'different';
  const candidate = reason.code.startsWith('candidate-');
  const nonRegular = ['target-not-regular-file', 'candidate-not-regular-file'].includes(reason.code);
  const hardlinked = ['target-hardlinked', 'candidate-hardlinked'].includes(reason.code);
  const message = changed
    ? 'Output target changed while the rendered artifact was being prepared.'
    : nonRegular
      ? candidate
        ? 'Temporary output candidate is no longer a regular file.'
        : 'Output already exists and is not a regular file.'
      : hardlinked
        ? candidate
          ? 'Temporary output candidate has multiple hard-link names.'
          : 'Output already exists through multiple hard-link names.'
        : 'Output target stability could not be determined safely before commit.';
  throwDiagnosticError(message, [{
    code: changed
      ? 'output/target-changed'
      : nonRegular
        ? 'output/target-not-regular-file'
        : hardlinked
          ? 'output/target-hardlinked'
          : 'output/target-indeterminate',
    message,
    subject: { output },
    evidence: { relation: reason },
    supportedFixes: [hardlinked
      ? 'choose a non-hardlinked output path; atomic replacement cannot update every hard-link name'
      : 'retry after other processes stop replacing or redirecting the output path'],
  }]);
}

function stageRenderedHtml(outputPath, html, mode) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    renderCandidateSequence += 1;
    const candidatePath = path.join(
      path.dirname(outputPath),
      `.archify-render-${process.pid}-${Date.now().toString(36)}-${renderCandidateSequence}.tmp`,
    );
    let descriptor;
    let identity;
    try {
      const noFollow = process.platform === 'win32' ? 0 : (fs.constants.O_NOFOLLOW || 0);
      descriptor = fs.openSync(
        candidatePath,
        fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | noFollow,
        mode ?? 0o666,
      );
      let metadata;
      try {
        metadata = fs.fstatSync(descriptor, { bigint: true });
      } catch (error) {
        // A transient first inspection failure must not str
```

### Core Architecture Module: `archify/renderers/shared/desktop-readability.mjs`
```
export const DESKTOP_READABILITY_VIEWPORT = Object.freeze({ width: 1440, height: 900 });
export const DESKTOP_READER_MIN_WIDTH = 960;
export const DESKTOP_READER_HORIZONTAL_CHROME = 30;
export const DESKTOP_READER_DIAGRAM_WIDTH = DESKTOP_READER_MIN_WIDTH - DESKTOP_READER_HORIZONTAL_CHROME;
export const MIN_PROJECTED_NODE_TEXT_PX = 6;
export const DECLARED_WIDE_READER_CONTRACT = 'declared-wide-v1';
export const DECLARED_WIDE_READER_RATIO = 1.55;
export const DECLARED_WIDE_READER_MAX_WIDTH = 1920;
export const DECLARED_WIDE_REFERENCE_BODY_HORIZONTAL_PX = 64;
export const DECLARED_WIDE_REFERENCE_DIAGRAM_HORIZONTAL_PX = 30;

export function projectedNodeTextPx(sourceFontPx, viewBoxWidth, diagramWidth = DESKTOP_READER_DIAGRAM_WIDTH) {
  if (![sourceFontPx, viewBoxWidth, diagramWidth].every(Number.isFinite) || viewBoxWidth <= 0 || diagramWidth <= 0) {
    return Number.NaN;
  }
  return sourceFontPx * Math.min(1, diagramWidth / viewBoxWidth);
}

export function minimumReadableSourceTextPx(
  viewBoxWidth,
  diagramWidth = DESKTOP_READER_DIAGRAM_WIDTH,
  minimumProjectedPx = MIN_PROJECTED_NODE_TEXT_PX,
) {
  if (![viewBoxWidth, diagramWidth, minimumProjectedPx].every(Number.isFinite)
    || viewBoxWidth <= 0
    || diagramWidth <= 0
    || minimumProjectedPx <= 0) {
    return Number.NaN;
  }
  return minimumProjectedPx / Math.min(1, diagramWidth / viewBoxWidth);
}

// This is deliberately separate from the legacy 930px projection. Architecture
// boundary convergence depends on that legacy default, while only a recognized
// v2 wide Reader may use this declared-width proof.
export function declaredWideReadabilityBudget({
  viewBoxWidth,
  viewBoxHeight,
  minimumSourceTextPx,
  requestedMinimumTextPx,
  viewportWidth = DESKTOP_READABILITY_VIEWPORT.width,
  bodyHorizontalPx = DECLARED_WIDE_REFERENCE_BODY_HORIZONTAL_PX,
  diagramHorizontalPx = DECLARED_WIDE_REFERENCE_DIAGRAM_HORIZONTAL_PX,
  minimumReaderWidth = DESKTOP_READER_MIN_WIDTH,
  maximumReaderWidth = DECLARED_WIDE_READER_MAX_WIDTH,
} = {}) {
  const values = [
    viewBoxWidth, viewBoxHeight, minimumSourceTextPx, requestedMinimumTextPx,
    viewportWidth, bodyHorizontalPx, diagramHorizontalPx, minimumReaderWidth, maximumReaderWidth,
  ];
  if (!values.every(Number.isFinite) || viewBoxWidth <= 0 || viewBoxHeight <= 0
    || minimumSourceTextPx <= 0 || requestedMinimumTextPx <= 0 || viewportWidth <= 0
    || bodyHorizontalPx < 0 || diagramHorizontalPx < 0 || minimumReaderWidth <= 0
    || maximumReaderWidth < minimumReaderWidth || viewBoxWidth / viewBoxHeight < DECLARED_WIDE_READER_RATIO) {
    return null;
  }
  const requestedTargetPx = Math.max(MIN_PROJECTED_NODE_TEXT_PX, requestedMinimumTextPx);
  const requestedScale = Math.min(1, requestedTargetPx / minimumSourceTextPx);
  const desiredReaderWidth = Math.max(minimumReaderWidth, viewBoxWidth * requestedScale + diagramHorizontalPx);
  const viewportCap = Math.max(0, viewportWidth - bodyHorizontalPx);
  const cap = Math.min(maximumReaderWidth, viewportCap);
  const actualReaderWidth = Math.min(desiredReaderWidth, cap);
  const guaranteedSvgWidth = Math.max(0, actualReaderWidth - diagramHorizontalPx);
  const projectedMinimumTextPx = projectedNodeTextPx(minimumSourceTextPx, viewBoxWidth, guaranteedSvgWidth);
  const limit = actualReaderWidth < desiredReaderWidth
    ? (viewportCap <= maximumReaderWidth ? 'viewport-cap' : 'reader-cap')
    : 'source-size';
  return {
    requestedTargetPx,
    requestedScale,
    desiredReaderWidth,
    viewportCap,
    maximumReaderWidth,
    actualReaderWidth,
    guaranteedSvgWidth,
    projectedMinimumTextPx,
    hardFloorPx: MIN_PROJECTED_NODE_TEXT_PX,
    hardFloorMet: projectedMinimumTextPx >= MIN_PROJECTED_NODE_TEXT_PX,
    requestedTargetMet: projectedMinimumTextPx >= requestedMinimumTextPx,
    limit,
  };
}

// Vertical chrome that always stacks with the SVG at the 1440x900 desktop
// viewport, measured from the delivered Viewer with the shortest one-line
// header and no cards: body padding 12, header 39, diagram padding/border 75.
// Cards are excluded so the prediction stays a lower bound.
export const DESKTOP_FIXED_VERTICAL_CHROME_PX = Object.freeze({ body: 12, header: 39, diagram: 75 });

// A canvas the Reader can neither narrow (viewBox ratio below the wide
// threshold) nor scroll readably (no intrinsic-height fit) renders at the full
// reader width, so its page height is a function of the viewBox alone. Returns
// null when the Reader has a way to fit the page; otherwise the certain
// overflow at 1440x900 before any cards are counted.
export function predictedFixedWidthOverflow({
  viewBoxWidth,
  viewBoxHeight,
  readerFit,
  diagramType,
  viewport = DESKTOP_READABILITY_VIEWPORT,
  bodyHorizontalPx = DECLARED_WIDE_REFERENCE_BODY_HORIZONTAL_PX,
  diagramHorizontalPx = DECLARED_WIDE_REFERENCE_DIAGRAM_HORIZONTAL_PX,
  chrome = DESKTOP_FIXED_VERTICAL_CHROME_PX,
} = {}) {
  if (![viewBoxWidth, viewBoxHeight].every(Number.isFinite) || viewBoxWidth <= 0 || viewBoxHeight <= 0) return null;
  const ratio = viewBoxWidth / viewBoxHeight;
  if (readerFit === 'intrinsic-height'
      || (readerFit === 'authored-height' && diagramType === 'architecture')
      || ratio >= DECLARED_WIDE_READER_RATIO) return null;
  const svgWidthPx = viewport.width - bodyHorizontalPx - diagramHorizontalPx;
  const svgHeightPx = Math.round(svgWidthPx * viewBoxHeight / viewBoxWidth);
  const fixedChromePx = chrome.body + chrome.header + chrome.diagram;
  const pageHeightPx = svgHeightPx + fixedChromePx;
  if (pageHeightPx <= viewport.height) return null;
  return {
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    ratio: Math.round(ratio * 100) / 100,
    wideRatio: DECLARED_WIDE_READER_RATIO,
    svgWidthPx,
    svgHeightPx,
    fixedChromePx,
    pageHeightPx,
    overflowPx: pageHeightPx - viewport.height,
  };
}

export function describeFixedWidthOverflow(issue) {
  const maximumViewBoxHeight = Math.floor(issue.viewBoxWidth / issue.wideRatio);
  const wideViewBoxWidth = Math.ceil(issue.viewBoxHeight * issue.wideRatio);
  return `Preserve every node, relationship, and label. This ${issue.viewBoxWidth}x${issue.viewBoxHeight} canvas (ratio ${issue.ratio}) declares no intrinsic-height fit and is below the ${issue.wideRatio} wide ratio, so the desktop Reader can neither narrow it nor accept vertical scroll: it renders ${issue.svgHeightPx}px tall at the full ${issue.svgWidthPx}px width and the page reaches ${issue.pageHeightPx}px before cards against ${issue.viewportHeight}px, a certain visual-check failure. Either compact vertical spacing so meta.viewBox height is at most ${maximumViewBoxHeight} at this width, or spread content sideways so the width is at least ${wideViewBoxWidth} at this height; for architecture, omitting meta.viewBox lets the renderer size the canvas and declare the fit.`;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #555** (2026-09-30): **[Bug]: Lifecycle automatic transition labels obscure band titles while showcase checks pass**
  *Symptoms*: ## Reproduction and impact  Lifecycle transition label `订单创建` obscures the band heading `01 / 下单与履约`. Its opaque white mask hides part of the heading in the generated HTML, including at a 1440×900 light-theme viewport. This is a renderer-generated collision: the transition has no authored label position or route override.  Observed on `dev@1c1e47ad2172c442514e36349c463d01a39af102`, packaged 2.17.0-dev.1, macOS, Node 26.8.1, Google Chrome. The diagram was authored using GPT-6 Sol medium and a local copy of the official ZIP. No private repository or customer data is involved.  Save the complete synthetic fixture below as `candidate.json`, then run from the Skill directory:  ```sh ARCHIFY_CHROME="/path/to/chrome" node bin/archify.mjs finalize lifecycle candidate.json diagram.html --quality showcase --json ```  Open `diagram.html?theme=light` and inspect the first band heading above `已创建`.  <details> <summary>Complete reproduction fixture</summary>  ```json {   "schema_version": 1,   "diagram_type": "lifecycle",   "meta": {"title": "线上书店订单生命周期", "locale": "zh-CN", "output": "diagram.html", "animation": "none", "quality_profile": "showcase"},   "lanes": [     {"id": "main", "label": "下单与履约"},     {"id": "refund", "label": "退款申请"},     {"id": "retry", "label": "可恢复失败"},     {"id": "terminal", "label": "终态"}   ],   "states": [     {"id": "created", "type": "start", "label": "已创建", "sublabel": "订单生成", "lane": "main", "col": 0, "step": "01"},     {"id": "pending_payment", "type": "wai
  **Post-Mortem & Fix Analysis**:
  > I would like to work on this issue. I will reproduce the lifecycle band-title collision on the current dev branch, add a browser regression for light and dark themes, and implement shared title geometry for automatic label avoidance while preserving explicit authored positions.
  > Verified on `dev` `9102a91`: the original lifecycle JSON passes `finalize --quality showcase` (status pass), and a 1440x900 render of the artifact shows all three band titles unobstructed by automatic transition labels. Fixed by #556. @tt-a1i closeable.
  > Resolved by #556, which is included in main and the published v3.0.1 release. We reran the original input and the current-main band-title regression coverage: validation and the automatic/explicit title-avoidance cases passed. This maintenance pass did not independently perform browser visual acceptance; the real-browser test was skipped, and the earlier browser verification remains separately recorded in this thread. Closing as completed based on the shipped fix and available evidence. Please report a current-version artifact if a title collision remains. Thanks for the report and verification.

- **Issue #430** (2026-09-16): **[Bug]: Explicit compiler quality profile disagrees with SVG metadata when environment differs**
  *Symptoms*: Reproduced on live `main` at `d673e8300df60a5c8166abe78787fdc78f6b8000` with Node `v22.23.2` and `v26.8.1` on macOS (Git clone).  Calling `compileWorkflow({ workflow, qualityProfile: 'standard' })` while `ARCHIFY_QUALITY_PROFILE=showcase` succeeds, but the SVG declares `data-quality-profile="showcase"`.  The compiler resolves its explicit `qualityProfile` argument before the document metadata, while `svgRootAttrs()` independently reads the process environment and gives it precedence. This allows the generated artifact to claim a different profile from the compiler's explicit request.  Expected: when a compiler profile has already been resolved, the SVG must reflect that same resolved profile. The CLI can continue resolving its environment override at its own boundary. This report does not require all compiler configuration to become environment-independent.  Run from the repository root:  ```sh node --input-type=module <<'JS' import assert from 'node:assert/strict'; import { compileWorkflow } from './archify/renderers/workflow/workflow-compiler.mjs';  const workflow = {   schema_version: 2,   diagram_type: 'workflow',   meta: { title: 'Explicit profile', legend: { mode: 'hidden' } },   lanes: [{ id: 'main', label: 'Main' }],   nodes: [     { id: 'a', lane: 'main', col: 0, type: 'backend', label: 'A' },     { id: 'b', lane: 'main', col: 2, type: 'backend', label: 'B' },   ],   edges: [{ id: 'ab', from: 'a', to: 'b' }], }; for (const environmentProfile of ['standard', 'showcase

- **Issue #429** (2026-09-28): **[Bug]: compileWorkflow accepts documents rejected by renderer semantic validation**
  *Symptoms*: Reproduced on live `main` at `d673e8300df60a5c8166abe78787fdc78f6b8000` with Node `v22.23.2` and `v26.8.1` on macOS (Git clone).  `compileWorkflow()` returns `ok: true` for duplicate `edges[].id` and for a guided view whose focus refers to a missing node. The workflow renderer rejects the exact same documents before compilation, with `relationship/duplicate-id` and `guided-view/invalid` respectively.  The compiler currently calls `validateSchema()` but does not apply the shared cross-collection validators used by `loadDiagram()`. This is a concrete validation-parity issue, independent of a broader supported library API. The compiler already has production callers such as workflow migration, in addition to its tests.  Expected: the compiler should report failure diagnostics for these invalid documents, consistently with the renderer. Preserve existing valid input and structured failure receipts.  Run from the repository root; the reproduction only creates and removes its own temporary directory:  ```sh node --input-type=module <<'JS' import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { compileWorkflow } from './archify/renderers/workflow/workflow-compiler.mjs';  const baseline = {   schema_version: 2,   diagram_type: 'workflow',   meta: { title: 'Validation parity', legend: { mode: 'hidden' } },   lanes: [{ id: 'main', label: 'Main' }],   nodes: ['a', 
  **Post-Mortem & Fix Analysis**:
  > #462 now applies the same relationship-ID and guided-view checks in the compiler and renderer. That is the right scope here, especially since migration already calls the compiler.  I've reviewed the change and rerun the compiler/migration tests: 97 passed. The earlier Motion browser failure did not recur when I reran CI on the same commit; [attempt 2](https://github.com/tt-a1i/archify/actions/runs/35204071727/attempts/2) is green. The fix is still awaiting integration, so this issue remains open.
  > Verified on `dev` `9102a91`: the duplicate edge id reproduction now makes `compileWorkflow` return `ok:false` with `relationship/duplicate-id`. Fixed by #462. @tt-a1i closeable.

- **Issue #427** (2026-10-02): **[Bug]: Browser regressions are skipped or omitted from CI and release gates**
  *Symptoms*: ## Problem  The repository-evidence browser regression is skipped by normal CI, and the tag release workflow does not run the same dedicated Viewer browser suite as PR CI. The test files exist, so adding more tests alone does not close this gap.  Verified against current `main` at `d673e8300df60a5c8166abe78787fdc78f6b8000` (Git clone; macOS, Node 22.23.2). This reports a workflow coverage defect, not an observed bad release.  ## Evidence and reproduction  From the repository root, with no browser override:  ```sh env -u ARCHIFY_CHROME node --test \   --test-name-pattern='browser renders local-only sources' \   archify/test/repository-evidence.test.mjs ```  Actual result:  ```text browser renders local-only sources as searchable text and web sources as links # SKIP Set ARCHIFY_CHROME to run evidence browser checks. # tests 1 # pass 0 # fail 0 # skipped 1 ```  The skip is explicitly conditional on `ARCHIFY_CHROME`, so a preinstalled Chrome does not enable it.  - [repository-evidence.test.mjs](https://github.com/tt-a1i/archify/blob/d673e8300df60a5c8166abe78787fdc78f6b8000/archify/test/repository-evidence.test.mjs#L294-L296) contains the conditional browser case. - [ci.yml](https://github.com/tt-a1i/archify/blob/d673e8300df60a5c8166abe78787fdc78f6b8000/.github/workflows/ci.yml#L23-L86) runs ordinary `npm test` without the variable, then lists browser files individually in the Chrome job. That list omits `repository-evidence.test.mjs`. - [release.yml](https://github.com/tt-a1i/arc
  **Post-Mortem & Fix Analysis**:
  > Delivered on `dev` by #440 — browser regressions are shared with CI and release gates, with coverage across ten test files. @tt-a1i closeable.
  > Reviewed against dev at 7a3e1f3a34708c08de8b9c5c93507f7a9b148308.  CI and release share the mandatory browser-test runner, including repository-evidence coverage. Missing Chrome makes that runner fail instead of silently skipping the gate.  Implementation: #440; [current source](https://github.com/tt-a1i/archify/blob/7a3e1f3a34708c08de8b9c5c93507f7a9b148308/scripts/run-browser-tests.mjs#L11).  Closing as completed on dev, not as a main/stable release announcement. This cleanup checked the implementation and existing coverage; it did not rerun a full browser/platform suite.

- **Issue #423** (2026-09-16): **[Bug]: valid Object.prototype names break Viewer selection and routes**
  *Symptoms*: ## Archify version or commit  On `main` (`d673e8300df60a5c8166abe78787fdc78f6b8000`), node IDs such as `constructor`, `toString`, and `hasOwnProperty` pass schema validation but do not retain their meaning in the Viewer.  ## Installation method  Git clone.  ## Diagram type  Generated viewer; reproduced across Architecture, Workflow, Sequence, Data flow and Lifecycle. The minimal example below uses Architecture.  ## Minimal redacted JSON reproduction  For example, save this as `identifiers.architecture.json`:  ```json {   "schema_version": 1,   "diagram_type": "architecture",   "meta": {     "title": "Factory request path",     "viewBox": [1000, 560],     "quality_profile": "standard",     "animation": "none",     "views": [       {"id": "request-path", "label": "Request path", "focus": ["start", "constructor", "sink"]},       {"id": "independent", "label": "Independent service", "focus": ["toString"]}     ]   },   "components": [     {"id": "start", "type": "external", "label": "Client", "pos": [80, 160], "size": [140, 60]},     {"id": "constructor", "type": "backend", "label": "Factory", "pos": [420, 160], "size": [140, 60]},     {"id": "sink", "type": "database", "label": "Store", "pos": [760, 160], "size": [140, 60]},     {"id": "toString", "type": "backend", "label": "Independent", "pos": [420, 360], "size": [140, 60]}   ],   "connections": [     {"id": "build", "from": "start", "to": "constructor", "label": "build"},     {"id": "save", "from": "constructor", "to": "sink"

- **Issue #420** (2026-09-16): **[Bug]: 固定 revision 的来源校验读取了 Git replacement 对象**
  *Symptoms*: ## 问题  固定完整 commit SHA 的 repository evidence 校验会读取 Git replacement refs 指向的内容，随后仍以原始 SHA 报告验证成功。原始提交中不存在的行因此可以通过验证；反过来，替换对象缩短文件也可能使合法引用失败。  这与 authoring contract 中“读取指定提交中的 blob，不受工作区修改影响”的固定版本语义不一致。无需更改图定义或原始 Git 对象，只需本地 `git replace` 即可触发。  ## 版本与环境  - 当前 main：`d673e8300df60a5c8166abe78787fdc78f6b8000`。 - macOS，使用源码 CLI；复现只创建临时本地 Git 仓库，不请求远程仓库。 - 检索 `git replace`、`replacement refs` 未发现相同 issue/PR。#389 扩展证据支持的图类型，#416 处理比较回执中的来源变化，均不是此问题。  ## 最小复现  从 Archify 仓库根目录执行，需 Node >=18 和 Git。所有测试文件都在临时目录，并在结束时清理。  ```sh node --input-type=module <<'JS' import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; const root = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-replace-repro-')); const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))); Object.assign(env, { GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', ARCHIFY_UPDATE_CHECK_DISABLED: '1' }); function git(...args) {   const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8', env });   if (result.status !== 0) throw new Error(result.stderr);   return result.stdout.trim(); } try {   git('init');   git('config', 'user.name', 'Archify Tests');   git('config', 'user.email', 'archify@example.test');   git('remote', 'add', 'origin', 'https://github.com/example/evidence-repo');   fs.writeFileSync(path.join(root, 'source.js'), 'original\n');   git('add', 'source.js');   git('commit', '-m', 'or
  **Post-Mortem & Fix Analysis**:
  > Resolved by #421, merged through the normal protected-branch path as `0857afc82a3fd489bb38fabc37e708c0635105d3`. The issue is now closed as completed.  Independent verification on the exact PR head: the eight new regressions fail 7/8 on the old main and pass on the candidate; the combined evidence suites pass 29 tests with one explicit browser skip. All nine required hosted checks passed, the ZIP changes match source, and the review found no remaining blockers. Full review evidence: https://github.com/tt-a1i/archify/pull/421#pullrequestreview-5218905169  This records the fix merged into main. No new release was published in this work. 

- **Issue #400** (2026-09-15): **[Bug]: compare architecture validates mutable input paths instead of the exact snapshots used for hashes and delta**
  *Symptoms*: ### Archify version or commit  6db72a9aea3d0f67a6a034e41f8a5491476a11c1  ### Installation method  Git clone  ### Diagram type  Architecture  ### Exact command  ```shell cat > snapshot.json <<'JSON' {   "schema_version": 1,   "diagram_type": "architecture",   "meta": {     "title": "Snapshot consistency reproduction"   },   "components": [     {       "id": "api",       "type": "backend",       "label": "API",       "pos": [40, 40],       "size": [120, 60]     }   ],   "boundaries": [],   "connections": [],   "cards": [] } JSON  cp snapshot.json head.json  rm -f base.json mkfifo base.json  (   cat snapshot.json > base.json   printf '{}\n' > base.json ) &  node archify/bin/archify.mjs compare architecture \   base.json head.json delta.html --json ```  ### Minimal redacted JSON reproduction  ```json {   "schema_version": 1,   "diagram_type": "architecture",   "meta": {     "title": "Snapshot consistency reproduction"   },   "components": [     {       "id": "api",       "type": "backend",       "label": "API",       "pos": [40, 40],       "size": [120, 60]     }   ],   "boundaries": [],   "connections": [],   "cards": [] } ```  ### Validation receipt or exact error  ```json The issue reproduces consistently using the FIFO-based reproduction above.  Exact `--json` output:   {   "schemaVersion": 1,   "ok": false,   "command": "compare",   "type": "architecture",   "stage": "input",   "error": "Base snapshot failed validation: architecture schema validation failed:\n  / must have r

- **Issue #384** (2026-09-12): **[Bug]: Canonical archify.zip is not reproducible on Windows: Windows-style output paths fail and bin/archify.mjs loses its 0755 mode**
  *Symptoms*: ### Archify version or commit  2.17.0-dev.1 at main commit 1891105  ### Installation method  Git clone  ### Diagram type  Installation or packaging  ### Exact command  ```shell # Windows 10, Git for Windows (Git Bash / mintty), Node v22.21.1, clean checkout of main @ 1891105, repository root. # Note: inside mintty Git for Windows aliases `node` to `winpty node.exe`; use `command node` whenever output is redirected.  # 1. Windows-style absolute output path -> fails before writing anything mkdir -p /c/Users/<user>/AppData/Local/Temp/archify-repro bash scripts/build-zip.sh "C:/Users/<user>/AppData/Local/Temp/archify-repro/out.zip" echo "exit=$?"  # 2. Same directory as a POSIX path -> builds, but the bytes are not canonical bash scripts/build-zip.sh /c/Users/<user>/AppData/Local/Temp/archify-repro/out.zip sha256sum archify.zip /c/Users/<user>/AppData/Local/Temp/archify-repro/out.zip /c/Windows/System32/tar.exe -tvf archify.zip | grep -a "bin/archify.mjs" /c/Windows/System32/tar.exe -tvf /c/Users/<user>/AppData/Local/Temp/archify-repro/out.zip | grep -a "bin/archify.mjs"  # 3. The repository's own reproducibility test hits defect 1 cd archify command node --test --test-name-pattern="byte-for-byte" test/release-package-gates.test.mjs ```  ### Minimal redacted JSON reproduction  ```json // No typed JSON is involved. The input is the checkout itself (any tracked tree at 1891105). // The failure is in the packaging scripts under scripts/, not in a diagram. ```  ### Validation receipt
  **Post-Mortem & Fix Analysis**:
  > Both parts landed in #385 

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

### Incident Patch 1: `3c4e4a50` (2026-10-05)
**Commit Message**: Merge pull request #714 from tt-a1i/docs/community-release-guide-main

docs: backport community submissions and release checklist

**File**: `.github/PULL_REQUEST_TEMPLATE.md` (modified, +5/-0)
```diff
@@ -27,3 +27,8 @@ Report automated or browser evidence separately from perceptual review.
 ## Generated artifacts
 
 Omit this section if generated outputs are unaffected. Otherwise list regenerated files or linked build evidence, and explain freshness of affected outputs left unchanged.
+
+
+## Release follow-up
+
+Omit for changes without release scope. For a release, link the completed or explicitly deferred stages and evidence in the [central release checklist](https://github.com/tt-a1i/archify/blob/main/CONTRIBUTING.md#release-checklist), including the DSH decision. Do not equate PR completion with publication or deployment.
```

**File**: `.github/workflows/release.yml` (modified, +2/-1)
```diff
@@ -137,7 +137,8 @@ jobs:
       - name: Record stable notifier publication follow-up
         if: steps.release-kind.outputs.prerelease == 'false'
         run: |
+          echo '[Complete the central release checklist](https://github.com/tt-a1i/archify/blob/main/CONTRIBUTING.md#release-checklist), including final-head evidence and public acceptance.' >> "$GITHUB_STEP_SUMMARY"
           echo 'After the repository Pages source is set to GitHub Actions, publish docs/skill-updates/archify/stable.json in a follow-up commit; the gated deploy job will verify this Release, its archify.zip digest, and the tagged Skill tree before exposure.' >> "$GITHUB_STEP_SUMMARY"
       - name: Record DSH synchronization follow-up
         run: |
-          echo 'Review CONTRIBUTING.md#release-checklist-dsh-synchronization: record the pinned DSH bundle update and verification, or an explicit deferral. Archify release publication does not publish the independently versioned DSH plugin; keep npm/tag/README/community status accurate until that separate release is verified.' >> "$GITHUB_STEP_SUMMARY"
+          echo '[Central release checklist](https://github.com/tt-a1i/archify/blob/main/CONTRIBUTING.md#release-checklist), including [DSH synchronization](https://github.com/tt-a1i/archify/blob/main/CONTRIBUTING.md#release-checklist-dsh-synchronization): record the pinned DSH bundle update and verification, or an explicit deferral. Archify release publication does not publish the independently versioned DSH plugin; keep npm/tag/README/community status accurate until that separate release is verified.' >> "$GITHUB_STEP_SUMMARY"
```

**File**: `CONTRIBUTING.md` (modified, +12/-0)
```diff
@@ -5,6 +5,7 @@ Archify is Agent-first: people describe systems, and the Skill, typed JSON, rend
 ## Choose the right path
 
 - Renderer, validator, package, or Viewer defect: use the [bug report form](.github/ISSUE_TEMPLATE/bug-report.yml).
+- Standalone community package: follow the [submission guide](community/README.md#submitting-a-package) and submit one metadata file to `dev`.
 - Reproducible real-world diagram: use the [showcase form](.github/ISSUE_TEMPLATE/showcase.yml).
 - New schema fields, defaults, acceptance rules, installation/export contracts, or broad product behavior: agree on value, compatibility, and non-goals before substantial implementation. Link the issue or recorded maintainer decision; reuse an existing agreed scope.
 - Narrow fixes and small documentation or test corrections can proceed with a concrete reproduction or rationale; a separate planning issue is unnecessary.
@@ -118,6 +119,17 @@ List regenerated files and explain freshness when an affected output is left unc
 
 Treat published versions as immutable. Ordinary feature PRs do not change versions, tags, or distribution identities unless release work is explicitly in scope.
 
+## Release checklist
+
+Use this single checklist in the release PR or its linked release record. Link evidence at each stage; mark an item complete only when its stated outcome is verified, or record an explicit deferral with an owner, reason, and follow-up. PR completion, release publication, Pages deployment, and updates to live installations are separate outcomes. Existing gates in [CI](.github/workflows/ci.yml) and the [release workflow](.github/workflows/release.yml) already cover release identity, ZIP freshness, installation parser/real Skills CLI tests, three-platform package smoke, browser checks, and the published manifest's actual Release ZIP. Reuse those gates and their receipts rather than creating another release pipeline.
+
+1. [ ] **Scope and revision.** Record the intended version/channel, release scope, final source SHA, comparison base, release notes, known issues, and required integration follow-ups. Follow the `dev` trial-use → `main` promotion process below. Pin evidence to its tested SHA; refresh the record when the candidate changes.
+2. [ ] **Identity and build.** Verify package/Skill identity and generated outputs using the candidate revision's existing checks. Use the canonical Node/zlib toolchain above for `scripts/build-zip.sh`; confirm the committed `archify.zip` matches the clean tracked-source build. Do not change versions or regenerate unrelated artifacts in ordinary feature PRs. Preserve the previous stable manifest until the new stable Release exists.
+3. [ ] **Final-head validation.** Account for the latest target base and verify required CI at the final candidate: identity and ZIP gates, schema/renderer tests, installation parser and real Skills CLI discovery, package smoke on Linux/macOS/Windows, browser/WebM checks, and affected website checks. Record run URLs, SHA, real-use evidence, and any skipped or unavailable checks; an earlier green head or zero checks is not final acceptance. Use commands from that revision's manifests/workflows: this `main` revision installs dependencies and runs `npm test`, `npm run test:browser`, and `npm run test:webm` from `archify/` (see [Local setup](#local-setup-and-verification)). `dev` revisions with the root test layout install both root and renderer dependencies and run those commands at the repository root. Website commands run in `website/`. Do not transplant a command or its working directory across revisions without checking.
+4. [ ] **Authorized publication.** Confirm authorization for the exact release version/channel and source SHA before pushing a release tag. Stable `v<version>` tags must be annotated and resolve to the verified commit; the workflow checks tag/package identity and the release channel. Verify the resulting GitHub Release and its `archify.zip` asset, digest, and expected stable/prerelease status. Do not overwrite existing versions, tags, or assets to repair a release. Installing or updating a user's live installation requires its own authorization.
+5. [ ] **Manifest, website, and integrations.** After the stable Release exists, publish `docs/skill-updates/archify/stable.json` in a follow-up commit through the normal branch process. Retain the `published-update-manifest` result that compares the actual Release ZIP, tagged archive, digest, and tagged Skill tree; wait for the gated `main` Pages deployment. Development/prerelease tags do not advance the stable notifier. Complete the [DSH synchronization checklist](#release-checklist-dsh-synchronization) or record an explicit deferral. Evaluate other integrations by their actual distribution mechanism: [Hermes](integrations/hermes-agent/README.md#install-shows-up-in-available-skills) installs the main Skill identifier; do not invent a separate Hermes release simply because Archify changed. Record any documen
```

**File**: `README.md` (modified, +2/-0)
```diff
@@ -418,6 +418,8 @@ Connect with other users and developers, share ideas, request features, report b
 
 ## Contributing
 
+Building a standalone package on Archify? [Submit it to the community catalog](community/README.md#submitting-a-package); the guide includes a collapsible example and complete Chinese steps.
+
 Issues, pull requests, and real-world diagrams are welcome. Start with the [contribution guide](CONTRIBUTING.md), use the reproducible bug form for failures, or submit a validated diagram through the [community showcase form](https://github.com/tt-a1i/archify/issues/new?template=showcase.yml).&nbsp;·&nbsp;[LINUX&nbsp;DO](https://linux.do)
 
 ## Support Archify
```

**File**: `README_EN.md` (modified, +2/-0)
```diff
@@ -418,6 +418,8 @@ Connect with other users and developers, share ideas, request features, report b
 
 ## Contributing
 
+Building a standalone package on Archify? [Submit it to the community catalog](community/README.md#submitting-a-package); the guide includes a collapsible example and complete Chinese steps.
+
 Issues, pull requests, and real-world diagrams are welcome. Start with the [contribution guide](CONTRIBUTING.md), use the reproducible bug form for failures, or submit a validated diagram through the [community showcase form](https://github.com/tt-a1i/archify/issues/new?template=showcase.yml).&nbsp;·&nbsp;[LINUX&nbsp;DO](https://linux.do)
 
 ## Support Archify
```

**File**: `README_ZH.md` (modified, +2/-0)
```diff
@@ -422,6 +422,8 @@ node bin/archify.mjs deliver workflow examples/agent-tool-call.workflow.json /tm
 
 ## 参与贡献
 
+基于 Archify 做了独立包？[提交到社区目录](community/README.md#中文摘要)。详细步骤和 JSON 示例默认折叠，按需展开即可。
+
 欢迎提交 Issue、Pull Request 和真实场景图。请先阅读[贡献指南](CONTRIBUTING.md)；遇到问题时使用可复现 Bug 表单，也可以通过[社区 Showcase 表单](https://github.com/tt-a1i/archify/issues/new?template=showcase.yml)提交已验证成品。
 
 较大的功能或行为调整请先通过 Issue 对齐价值、兼容边界和非目标，再基于最新 `main` 开发。一个 PR 尽量只解决一个问题；核心代码和回归测试先行，生成物最后统一重建。Archify 坚持 Agent-first，优先完善稳定的机器可读诊断和现有权威合同，避免新增容易与 CLI 漂移的重复说明。&nbsp;·&nbsp;[LINUX&nbsp;DO](https://linux.do)
```

**File**: `community/README.md` (modified, +84/-2)
```diff
@@ -21,15 +21,71 @@ Archify has **no in-process plugin API, and none is planned for this registry**.
 ## Submitting a package
 
 1. Publish your package in your own repository (or npm). Archify does not host package content.
-2. Fork this repository and add **one metadata file**: `community/packages/<name>.json`, following [`package.schema.json`](package.schema.json). `<name>` is lowercase kebab-case and must equal the `name` field.
-3. Validate locally before opening the PR:
+2. Fork this repository, branch from the latest `dev`, and add **one metadata file**: `community/packages/<name>.json`, following [`package.schema.json`](package.schema.json). `<name>` is lowercase kebab-case and must equal the `name` field.
+3. From the repository root, validate locally before opening the PR (Node.js 18+, no npm dependencies needed):
 
    ```bash
    node scripts/check-community-packages.mjs
    ```
 
 4. Open a PR **targeting `dev`** (per [CONTRIBUTING.md](../CONTRIBUTING.md)) that adds only your metadata file. Include evidence links in the `evidence` field — validation receipts, screenshots, rendered example artifacts.
 
+A merge into `dev` does not publish the website. The public catalog updates after promotion to `main` and a successful Pages deployment; there is no promised review or publication time.
+
+[Schema](package.schema.json) · [Existing entries](packages/) · [完整中文步骤](#中文摘要)
+
+<details>
+<summary>Submission example, field requirements, and updates</summary>
+
+Start in a local clone of your fork. Add `upstream` only if it is not already configured; otherwise verify that it points to this repository.
+
+```bash
+git remote add upstream https://github.com/tt-a1i/archify.git
+git fetch upstream dev
+git switch -c community/my-archify-recipes upstream/dev
+```
+
+Save the following as `community/packages/my-archify-recipes.json`. Replace the name, author, descriptions, and **all example.com URLs** with your public package and evidence. The version `3.0.1` and IR `[1]` illustrate the format, not a compatibility claim for your package; use versions you have actually verified.
+
+```json
+{
+  "name": "my-archify-recipes",
+  "type": "recipe",
+  "summary": {
+    "en": "Example recipe library for explaining web application request flows.",
+    "zh": "用于说明 Web 应用请求流程的场景配方库示例。"
+  },
+  "author": {
+    "name": "YOUR_NAME",
+    "url": "https://example.com/author"
+  },
+  "repository": "https://example.com/my-archify-recipes",
+  "archify": "3.0.1",
+  "schemaVersions": [1],
+  "tags": ["recipes", "web"],
+  "evidence": [
+    {
+      "label": "Example artifact and validation receipt",
+      "url": "https://example.com/my-archify-recipes/evidence"
+    }
+  ]
+}
+```
+
+Run `node scripts/check-community-packages.mjs` from the repository root, commit only your metadata file, push the branch to your fork, and open a PR against **`tt-a1i/archify:dev`** using the repository PR template. Report the check result and link evidence for the claimed behavior and compatibility. Do not include credentials, private source, personal information, or customer data in evidence.
+
+- Required fields: `name`, `type`, `summary`, `author`, `repository`, `archify`, and `schemaVersions`. Unknown fields are rejected.
+- `name`: 3–64 lowercase letters, digits, or hyphens, starting and ending with a letter or digit; the file name must match. `summary.en`: 10–160 characters; `summary.zh`: 6–120 characters. `author.name` is required.
+- `archify`: an exact version, caret/tilde range, or bounded range such as `3.0.1`, `^3.0.1`, `~3.0.1`, or `>=3.0.0 <4.0.0`. `latest`, wildcards, and prerelease suffixes are not accepted by this metadata contract.
+- `schemaVersions`: the nonempty, unique list of positive-integer Archify JSON IR `schema_version` values your package supports, not your package version.
+- Optional fields are `author.url`, `homepage`, `tags` (up to 6 unique items), and `evidence` (up to 8 `{label, url}` items). Although the schema does not require `evidence`, the submission instructions above ask for evidence links. Follow the schema for remaining length and character limits.
+
+The check validates metadata and URL syntax; it does not fetch links, verify that claimed versions exist, prove compatibility, or execute your package. Supply evidence for those claims. Passing the check is not review approval or endorsement.
+
+**Updating a listing:** publish the package update in your own repository or registry, edit the existing metadata file with any changed compatibility, summary, and evidence, then validate and submit a PR to `dev` again. Keep published and pending versions distinct. Authors maintain their own packages; removal follows [Takedown](#takedown).
+
+</details>
+
 Review follows the tiers in [REVIEWING.md](../REVIEWING.md). Approval criteria:
 
 - Metadata passes `scripts/check-community-packages.mjs`. Links must be parseable HTTPS URLs with a host, no credentials, whitespace, control characters, or backslashes (th
```

**File**: `website/src/pages/community.astro` (modified, +11/-9)
```diff
@@ -29,6 +29,7 @@ const activeTypes = typeOrder.filter((type) => typeCounts[type] > 0);
           <div class="lead-label" data-en="Community registry / standalone packages" data-zh="社区注册表 / 独立包">Community registry / standalone packages</div>
           <h1 data-translation-html data-en="Built on Archify.<br><em>Shared by everyone.</em>" data-zh="基于 Archify 构建，<br><em>由社区共享。</em>">Built on Archify.<br><em>Shared by everyone.</em></h1>
           <p class="hero-copy" data-en="Community packages are standalone works that wrap the Archify CLI — skill packs, recipe libraries, brand kits, locales, and wrappers. Nothing here is a plugin: no third-party code ever runs inside the renderer." data-zh="社区包是围绕 Archify CLI 构建的独立产物——技能包、场景配方、品牌套件、语言包与命令行封装。这里没有插件：任何第三方代码都不会进入渲染器内部运行。">Community packages are standalone works that wrap the Archify CLI — skill packs, recipe libraries, brand kits, locales, and wrappers. Nothing here is a plugin: no third-party code ever runs inside the renderer.</p>
+          <a class="card-link submission-link" href="https://github.com/tt-a1i/archify/tree/main/community#submitting-a-package" target="_blank" rel="noopener noreferrer" data-en="Submit your package ↗" data-zh="提交你的包 ↗">Submit your package ↗</a>
         </div>
         <div class="proof-board" aria-label="Registry summary">
           <div class="proof-row"><span class="proof-value">{packages.length}</span><span class="proof-label" data-translation-html data-en="packages listed<br>from the registry" data-zh="个已收录包<br>来自注册表">packages listed<br>from the registry</span></div>
@@ -107,21 +108,22 @@ const activeTypes = typeOrder.filter((type) => typeCounts[type] > 0);
             <div class="pipeline-step"><span class="pipeline-num">01</span><span class="pipeline-label" data-en="Publish your package in your own repo" data-zh="在你自己的仓库发布你的包">Publish your package in your own repo</span><span class="pipeline-state you">YOU</span></div>
             <div class="pipeline-step"><span class="pipeline-num">02</span><span class="pipeline-label" data-en="Add one metadata file under community/packages/" data-zh="在 community/packages/ 下添加一个元数据文件">Add one metadata file under community/packages/</span><span class="pipeline-state you">YOU</span></div>
             <div class="pipeline-step"><span class="pipeline-num">03</span><span class="pipeline-label" data-en="Validate with check-community-packages.mjs" data-zh="运行 check-community-packages.mjs 校验">Validate with check-community-packages.mjs</span><span class="pipeline-state">PASS</span></div>
-            <div class="pipeline-step"><span class="pipeline-num">04</span><span class="pipeline-label" data-en="Open a PR targeting dev — merge means listed" data-zh="向 dev 分支提 PR——合并即收录">Open a PR targeting dev — merge means listed</span><span class="pipeline-state">PASS</span></div>
+            <div class="pipeline-step"><span class="pipeline-num">04</span><span class="pipeline-label" data-en="Open a PR targeting dev — publication follows main deployment" data-zh="向 dev 提 PR——进入 main 并部署后上线">Open a PR targeting dev — publication follows main deployment</span><span class="pipeline-state">PASS</span></div>
           </div>
         </div>
         <div class="method-code">
           <div class="method-code-bar"><span>submit locally</span><span>zero dependencies</span></div>
-          <pre><span class="accent">$ node scripts/check-community-packages.mjs</span>
-
-community registry: {packages.length} package(s) OK
-  {packages.map((entry) => entry.name).join(', ')}
-
-<span class="accent">$ git checkout -b community/my-pack origin/dev</span>
+          <pre># from your fork, track upstream dev
+<span class="accent">$ git fetch upstream dev</span>
+<span class="accent">$ git switch -c community/my-pack upstream/dev</span>
 
 # add community/packages/my-pack.json
-# open PR → review → listed here</pre>
-          <a class="card-link method-link" href="https://github.com/tt-a1i/archify/tree/main/community" target="_blank" rel="noopener noreferrer" data-en="Read the submission guide ↗" data-zh="阅读提交指南 ↗">Read the submission guide ↗</a>
+# validate from the repository root
+<span class="accent">$ node scripts/check-community-packages.mjs</span>
+
+# open PR to dev → review
+# promote to main → deploy → public catalog</pre>
+          <a class="card-link method-link" href="https://github.com/tt-a1i/archify/tree/main/community#submitting-a-package" target="_blank" rel="noopener noreferrer" data-en="Read the submission guide ↗" data-zh="阅读提交指南 ↗">Read the submission guide ↗</a>
         </div>
       </div>
     </section>
```

---

### Incident Patch 2: `6286792a` (2026-10-04)
**Commit Message**: docs(dsh): point installation guides at published 1.0.0

**File**: `README.md` (modified, +2/-2)
```diff
@@ -201,7 +201,7 @@ To try without installing:
 npx skills use tt-a1i/archify@archify --agent codex
 ```
 
-[DSH community opt-in](integrations/deepseek-harness/README.md): `dsh plugin --profile web add @tt-a1i/archify-dsh@0.1.0`
+[DSH community opt-in](integrations/deepseek-harness/README.md): `dsh plugin --profile web add @tt-a1i/archify-dsh@1.0.0`
 
 The [agent switcher](https://tt-a1i.github.io/archify/start.html?agent=cursor&type=architecture) covers `cursor`, `codex`, `claude-code`, and `opencode`.
 
@@ -384,7 +384,7 @@ The complete generation and viewer contract lives in [`archify/SKILL.md`](archif
 | **Claude.ai** | Upload `archify.zip` under Settings → Capabilities → Skills | Depends on Node.js access in the sandbox |
 | **Project Knowledge** | Upload `archify.zip` to the project | Prompt-driven architecture fallback |
 | **Hermes Agent** | Opt-in: `hermes skills install skills-sh/tt-a1i/archify/archify -y` | Community Skill-only integration; Node `>=18`; not a Nous official product. No telemetry. It is not a switcher target. [Details](integrations/hermes-agent/README.md). |
-| **DeepSeek Harness** | Opt-in: `dsh plugin --profile web add @tt-a1i/archify-dsh@0.1.0`. Invoke: `Use the archify skill to map this repository's runtime architecture.` Remove: `dsh plugin --profile web remove @tt-a1i/archify-dsh`. | Community integration for developer-preview `@deepseek-ai/dsh@0.1.0-rc.6`; Node `^22.19.0 \|\| >=24.0.0`; not an official DeepSeek product. No telemetry. Shell files need exact workspace paths, not Web Produced Files. [Details](integrations/deepseek-harness/README.md). |
+| **DeepSeek Harness** | Opt-in: `dsh plugin --profile web add @tt-a1i/archify-dsh@1.0.0`. Invoke: `Use the archify skill to map this repository's runtime architecture.` Remove: `dsh plugin --profile web remove @tt-a1i/archify-dsh`. | Community integration for developer-preview `@deepseek-ai/dsh@0.1.2-rc.1`; Node `^22.19.0 \|\| >=24.0.0`; not an official DeepSeek product. No telemetry. Shell files need exact workspace paths, not Web Produced Files. [Details](integrations/deepseek-harness/README.md). |
 
 ## Reference and scope
 
```

**File**: `README_EN.md` (modified, +2/-2)
```diff
@@ -201,7 +201,7 @@ To try without installing:
 npx skills use tt-a1i/archify@archify --agent codex
 ```
 
-[DSH community opt-in](integrations/deepseek-harness/README.md): `dsh plugin --profile web add @tt-a1i/archify-dsh@0.1.0`
+[DSH community opt-in](integrations/deepseek-harness/README.md): `dsh plugin --profile web add @tt-a1i/archify-dsh@1.0.0`
 
 The [agent switcher](https://tt-a1i.github.io/archify/start.html?agent=cursor&type=architecture) covers `cursor`, `codex`, `claude-code`, and `opencode`.
 
@@ -384,7 +384,7 @@ The complete generation and viewer contract lives in [`archify/SKILL.md`](archif
 | **Claude.ai** | Upload `archify.zip` under Settings → Capabilities → Skills | Depends on Node.js access in the sandbox |
 | **Project Knowledge** | Upload `archify.zip` to the project | Prompt-driven architecture fallback |
 | **Hermes Agent** | Opt-in: `hermes skills install skills-sh/tt-a1i/archify/archify -y` | Community Skill-only integration; Node `>=18`; not a Nous official product. No telemetry. It is not a switcher target. [Details](integrations/hermes-agent/README.md). |
-| **DeepSeek Harness** | Opt-in: `dsh plugin --profile web add @tt-a1i/archify-dsh@0.1.0`. Invoke: `Use the archify skill to map this repository's runtime architecture.` Remove: `dsh plugin --profile web remove @tt-a1i/archify-dsh`. | Community integration for developer-preview `@deepseek-ai/dsh@0.1.0-rc.6`; Node `^22.19.0 \|\| >=24.0.0`; not an official DeepSeek product. No telemetry. Shell files need exact workspace paths, not Web Produced Files. [Details](integrations/deepseek-harness/README.md). |
+| **DeepSeek Harness** | Opt-in: `dsh plugin --profile web add @tt-a1i/archify-dsh@1.0.0`. Invoke: `Use the archify skill to map this repository's runtime architecture.` Remove: `dsh plugin --profile web remove @tt-a1i/archify-dsh`. | Community integration for developer-preview `@deepseek-ai/dsh@0.1.2-rc.1`; Node `^22.19.0 \|\| >=24.0.0`; not an official DeepSeek product. No telemetry. Shell files need exact workspace paths, not Web Produced Files. [Details](integrations/deepseek-harness/README.md). |
 
 ## Reference and scope
 
```

**File**: `README_JA.md` (modified, +2/-2)
```diff
@@ -191,7 +191,7 @@ npx -y skills add tt-a1i/archify --skill archify --agent cursor --global --copy
 npx skills use tt-a1i/archify@archify --agent codex
 ```
 
-[DSH コミュニティ版（任意）](integrations/deepseek-harness/README.md): `dsh plugin --profile web add @tt-a1i/archify-dsh@0.1.0`
+[DSH コミュニティ版（任意）](integrations/deepseek-harness/README.md): `dsh plugin --profile web add @tt-a1i/archify-dsh@1.0.0`
 
 [エージェント切り替え](https://tt-a1i.github.io/archify/start.html?agent=cursor&type=architecture)は `cursor`、`codex`、`claude-code`、`opencode` に対応しています。
 
@@ -366,7 +366,7 @@ node bin/archify.mjs deliver workflow examples/agent-tool-call.workflow.json /tm
 | **Claude.ai** | Settings → Capabilities → Skills から `archify.zip` をアップロード | サンドボックスでの Node.js 利用可否に依存 |
 | **Project Knowledge** | プロジェクトに `archify.zip` をアップロード | プロンプト駆動のアーキテクチャフォールバック |
 | **Hermes Agent** | 明示的に有効化: `hermes skills install skills-sh/tt-a1i/archify/archify -y` | コミュニティ版の Skill のみの統合。Node `>=18`。Nous 公式製品ではありません。テレメトリはありません。切り替え対象には含まれません。[詳細](integrations/hermes-agent/README.md)。 |
-| **DeepSeek Harness** | 明示的に有効化: `dsh plugin --profile web add @tt-a1i/archify-dsh@0.1.0`。呼び出し: `Use the archify skill to map this repository's runtime architecture.` 削除: `dsh plugin --profile web remove @tt-a1i/archify-dsh` | 開発者プレビュー版 `@deepseek-ai/dsh@0.1.0-rc.6` 向けのコミュニティ統合。Node `^22.19.0 \|\| >=24.0.0`。DeepSeek 公式製品ではなく、テレメトリもありません。シェルファイルには Web Produced Files ではなく、正確なワークスペースパスが必要です。[詳細](integrations/deepseek-harness/README.md)。 |
+| **DeepSeek Harness** | 明示的に有効化: `dsh plugin --profile web add @tt-a1i/archify-dsh@1.0.0`。呼び出し: `Use the archify skill to map this repository's runtime architecture.` 削除: `dsh plugin --profile web remove @tt-a1i/archify-dsh` | 開発者プレビュー版 `@deepseek-ai/dsh@0.1.2-rc.1` 向けのコミュニティ統合。Node `^22.19.0 \|\| >=24.0.0`。DeepSeek 公式製品ではなく、テレメトリもありません。シェルファイルには Web Produced Files ではなく、正確なワークスペースパスが必要です。[詳細](integrations/deepseek-harness/README.md)。 |
 
 ## リファレンスとスコープ
 
```

**File**: `README_ZH.md` (modified, +2/-2)
```diff
@@ -201,7 +201,7 @@ npx -y skills add tt-a1i/archify --skill archify --agent cursor --global --copy
 npx skills use tt-a1i/archify@archify --agent codex
 ```
 
-DeepSeek Harness（社区集成、显式启用）：运行 `dsh plugin --profile web add @tt-a1i/archify-dsh@0.1.0`；参见[兼容范围、限制与安全说明](integrations/deepseek-harness/README.md)。[Agent 切换器](https://tt-a1i.github.io/archify/start.html?agent=cursor&type=architecture)只为 `cursor`、`codex`、`claude-code` 和 `opencode` 生成命令。
+DeepSeek Harness（社区集成、显式启用）：运行 `dsh plugin --profile web add @tt-a1i/archify-dsh@1.0.0`；参见[兼容范围、限制与安全说明](integrations/deepseek-harness/README.md)。[Agent 切换器](https://tt-a1i.github.io/archify/start.html?agent=cursor&type=architecture)只为 `cursor`、`codex`、`claude-code` 和 `opencode` 生成命令。
 
 安装后的 Skill 包含一个低频、失败静默的发布检查，它最多只显示可选更新提醒，绝不会自行下载或安装更新。一次成功检查后，下次网络请求通常约在 24 小时（±20%）后发出；检查失败后，活跃使用可能在首次 6 小时、后续 24 小时退避到期时重试。请求只访问 `https://tt-a1i.github.io/archify/skill-updates/archify/stable.json`。服务端会自然获得 IP、请求时间和常规 HTTP 元数据；检查器不会发送本地版本、Agent、项目数据、用户输入、账户/设备标识，也不会保存或回传 ETag。是否更新以及何时更新始终由你决定。如需完全关闭检查（包括网络请求和提醒状态写入），请在 Agent 环境中设置 `ARCHIFY_UPDATE_CHECK_DISABLED=1`。
 
@@ -385,7 +385,7 @@ node bin/archify.mjs deliver workflow examples/agent-tool-call.workflow.json /tm
 | **Claude.ai** | Settings → Capabilities → Skills 中上传 `archify.zip` | 取决于沙箱是否提供 Node.js |
 | **Project Knowledge** | 把 `archify.zip` 上传到项目 | Prompt 驱动的 Architecture Fallback |
 | **Hermes Agent** | 显式启用：`hermes skills install skills-sh/tt-a1i/archify/archify -y` | 社区 Skill-only；Node `>=18`；不是 Nous 官方产品。没有遥测。非切换器目标。[详情](integrations/hermes-agent/README.md)。 |
-| **DeepSeek Harness** | 显式启用：`dsh plugin --profile web add @tt-a1i/archify-dsh@0.1.0`；调用：`Use the archify skill to map this repository's runtime architecture.`；卸载：`dsh plugin --profile web remove @tt-a1i/archify-dsh`。 | 面向开发者预览版 `@deepseek-ai/dsh@0.1.0-rc.6` 的社区集成；Node `^22.19.0 \|\| >=24.0.0`；不是 DeepSeek 官方产品。没有遥测；shell 文件不会自动进入 Web Produced Files，请返回精确工作区路径。[详情](integrations/deepseek-harness/README.md)。 |
+| **DeepSeek Harness** | 显式启用：`dsh plugin --profile web add @tt-a1i/archify-dsh@1.0.0`；调用：`Use the archify skill to map this repository's runtime architecture.`；卸载：`dsh plugin --profile web remove @tt-a1i/archify-dsh`。 | 面向开发者预览版 `@deepseek-ai/dsh@0.1.2-rc.1` 的社区集成；Node `^22.19.0 \|\| >=24.0.0`；不是 DeepSeek 官方产品。没有遥测；shell 文件不会自动进入 Web Produced Files，请返回精确工作区路径。[详情](integrations/deepseek-harness/README.md)。 |
 
 ## 参考与边界
 
```

**File**: `community/packages/archify-dsh.json` (modified, +19/-10)
```diff
@@ -2,18 +2,19 @@
   "name": "archify-dsh",
   "type": "wrapper",
   "summary": {
-    "en": "Published DSH bundle 0.1.0 contains Archify 2.14.0 (DSH 0.1.0-rc.6, experimental). Pending 1.0.0 contains Archify 3.0.1 and is not published.",
-    "zh": "已发布的 DSH 技能包 @tt-a1i/archify-dsh 0.1.0 内含 Archify 2.14.0，实验支持 DSH 0.1.0-rc.6；内含 Archify 3.0.1 的 1.0.0 包尚未发布。"
+    "en": "DSH 1.0.0 bundles Archify 3.0.1. Supports exact developer-preview DSH 0.1.2-rc.1; independent community Skill-only integration.",
+    "zh": "已发布 DSH 技能包 1.0.0，内含 Archify 3.0.1；支持明确测试的开发者预览版 DSH 0.1.2-rc.1，属于独立社区集成。"
   },
   "author": {
     "name": "tt-a1i",
     "url": "https://github.com/tt-a1i"
   },
-  "repository": "https://github.com/tt-a1i/archify/tree/archify-dsh-v0.1.0/integrations/deepseek-harness",
-  "homepage": "https://www.npmjs.com/package/@tt-a1i/archify-dsh/v/0.1.0",
-  "archify": "2.14.0",
+  "repository": "https://github.com/tt-a1i/archify/tree/archify-dsh-v1.0.0/integrations/deepseek-harness",
+  "homepage": "https://www.npmjs.com/package/@tt-a1i/archify-dsh/v/1.0.0",
+  "archify": "3.0.1",
   "schemaVersions": [
-    1
+    1,
+    2
   ],
   "tags": [
     "deepseek-harness",
@@ -23,12 +24,20 @@
   ],
   "evidence": [
     {
-      "label": "Published 0.1.0 integration guide",
-      "url": "https://github.com/tt-a1i/archify/blob/archify-dsh-v0.1.0/integrations/deepseek-harness/README.md"
+      "label": "Published 1.0.0 package guide",
+      "url": "https://github.com/tt-a1i/archify/blob/archify-dsh-v1.0.0/integrations/deepseek-harness/PACKAGE_README.md"
     },
     {
-      "label": "Bundled Archify 2.14.0 source",
-      "url": "https://github.com/tt-a1i/archify/blob/archify-dsh-v0.1.0/archify/package.json"
+      "label": "Bundled Archify 3.0.1 source",
+      "url": "https://github.com/tt-a1i/archify/blob/7158026e852f3aa6578c741e673b46d7878c92c1/archify/package.json"
+    },
+    {
+      "label": "Published 1.0.0 release and tarball checksum",
+      "url": "https://github.com/tt-a1i/archify/releases/tag/archify-dsh-v1.0.0"
+    },
+    {
+      "label": "Three-platform installation and upgrade acceptance",
+      "url": "https://github.com/tt-a1i/archify/actions/runs/37217119585"
     }
   ]
 }
```

**File**: `integrations/deepseek-harness/README.md` (modified, +6/-6)
```diff
@@ -2,13 +2,13 @@
 
 Community DeepSeek Harness integration for [Archify](https://github.com/tt-a1i/archify). This is **not** an official DeepSeek product and does not imply DeepSeek endorsement.
 
-The currently published npm package is **v0.1.0**, with experimental compatibility for developer-preview **`@deepseek-ai/dsh@0.1.0-rc.6`** on Node.js **`^22.19.0 || >=24.0.0`**. It bundles Archify Skill **2.14.0**. It is not a stable cross-version guarantee.
+The currently published npm package is **v1.0.0**. It bundles Archify Skill **3.0.1** and supports the exact developer-preview **`@deepseek-ai/dsh@0.1.2-rc.1`** on Node.js **`^22.19.0 || >=24.0.0`**. The 1.0 adapter contract covers this exact DSH host version; it does not make the host stable or guarantee compatibility with other DSH versions.
 
-The pending **v1.0.0** release candidate is prepared for the explicitly supported developer-preview **`@deepseek-ai/dsh@0.1.2-rc.1`**. It is not published or available as an npm install yet. The 1.0 adapter contract covers this exact DSH host version; it does not make the host stable or guarantee compatibility with other DSH versions. It is a Skill-only bundle: it inserts one filesystem Skill provider named `archify-plugin` and exposes **Archify 3.0.1**, pinned to stable `main` commit `7158026e852f3aa6578c741e673b46d7878c92c1`. This snapshot includes the Skill installation fix from [#704](https://github.com/tt-a1i/archify/pull/704), which landed after the `v3.0.1` tag; it is not a byte-for-byte copy of that tag. The packaged `package.json` and `skill-release.json` both declare 3.0.1. Compared with the published plugin 0.1.0, it includes the Archify 3.x authoring and delivery flow, authored brand marks, Workflow schema v2, Viewer localization, and update awareness.
+Version 1.0.0 was published on 2026-10-04: [npm package](https://www.npmjs.com/package/@tt-a1i/archify-dsh/v/1.0.0) · [release and verified tarball](https://github.com/tt-a1i/archify/releases/tag/archify-dsh-v1.0.0). It is a Skill-only bundle: it inserts one filesystem Skill provider named `archify-plugin` and exposes **Archify 3.0.1**, pinned to stable `main` commit `7158026e852f3aa6578c741e673b46d7878c92c1`. This snapshot includes the Skill installation fix from [#704](https://github.com/tt-a1i/archify/pull/704), which landed after the `v3.0.1` tag; it is not a byte-for-byte copy of that tag. The packaged `package.json` and `skill-release.json` both declare 3.0.1. Compared with the previous plugin 0.1.0, it includes the Archify 3.x authoring and delivery flow, authored brand marks, Workflow schema v2, Viewer localization, and update awareness.
 
 `release.json` records the immutable Skill source commit, Skill version, and DSH version used by acceptance. Packaging uses the canonical clean-Skill stager against that commit, preserving license notices and excluding development files. Adapter version 0.1.0 and its `archify-dsh-v0.1.0` tag remain unchanged; reproduce that old release by checking out its tag first.
 
-The adapter registers no native render/validate/deliver tools, custom Web client, Produced Files chips, telemetry, credentials handling, background services, or install hooks. The pending v1.0.0 Skill includes an optional, notification-only stable Archify update checker; it never upgrades the plugin. Authored remote brand assets may also use the Skill's bounded network path. The adapter itself makes no network requests.
+The adapter registers no native render/validate/deliver tools, custom Web client, Produced Files chips, telemetry, credentials handling, background services, or install hooks. The bundled Skill includes an optional, notification-only stable Archify update checker; it never upgrades the plugin. Authored remote brand assets may also use the Skill's bounded network path. The adapter itself makes no network requests.
 
 ## Patch execution boundary
 
@@ -21,12 +21,12 @@ The current expression is intentionally limited to Node's built-in `path` and `m
 Use the prebuilt npm package with an exact version. Do not install from Git source.
 
 ```bash
-dsh plugin --profile web add @tt-a1i/archify-dsh@0.1.0
+dsh plugin --profile web add @tt-a1i/archify-dsh@1.0.0
 ```
 
 ## Upgrade
 
-The 1.0.0 release gate covers both a clean installation and upgrading the published plugin 0.1.0 to the candidate in the same isolated profile on `@deepseek-ai/dsh@0.1.2-rc.1`. The older host `0.1.0-rc.6` is not a supported 1.0 target: update the host separately before upgrading the plugin. The Node requirement remains `^22.19.0 || >=24.0.0`; the three-platform release gate runs on Node 22. See the [adapter changelog](CHANGELOG.md) for the bundled Archify change.
+The 1.0.0 release gate covers both a clean installation and upgrading the previous plugin 0.1.0 to 1.0.0 in the same isolated profile on `@deepseek-ai/dsh@0.1.2-rc.1`. The older host `0.1.0-rc.6` is not a supported 1.0 target: update the host separately before upgrading the plugin. The Node requirement 
```

**File**: `integrations/deepseek-harness/test/docs-contract.test.mjs` (modified, +18/-16)
```diff
@@ -14,11 +14,11 @@ function read(relativePath) {
 const manifest = JSON.parse(read('integrations/deepseek-harness/package.json'));
 const release = JSON.parse(read('integrations/deepseek-harness/release.json'));
 const published = Object.freeze({
-  adapterVersion: '0.1.0',
-  skillVersion: '2.14.0',
-  dshVersion: '0.1.0-rc.6',
+  adapterVersion: '1.0.0',
+  skillVersion: '3.0.1',
+  dshVersion: '0.1.2-rc.1',
 });
-const candidate = Object.freeze({
+const bundled = Object.freeze({
   adapterVersion: manifest.version,
   skillVersion: release.skillVersion,
   dshVersion: release.dshVersion,
@@ -29,16 +29,19 @@ test('README.md and README_EN.md stay byte-identical after the DSH docs', () =>
   assert.equal(read('README.md'), read('README_EN.md'));
 });
 
-test('DSH documentation identifies the published release and pinned candidate snapshot', () => {
+test('DSH documentation identifies the published release and its pinned snapshot', () => {
   const integration = read('integrations/deepseek-harness/README.md');
   assert.ok(integration.includes(`currently published npm package is **v${published.adapterVersion}**`));
   assert.ok(integration.includes(`@deepseek-ai/dsh@${published.dshVersion}`));
   assert.ok(integration.includes(`Archify Skill **${published.skillVersion}**`));
-  assert.ok(integration.includes(`pending **v${candidate.adapterVersion}** release`));
-  assert.ok(integration.includes(`Archify ${candidate.skillVersion}`));
-  assert.ok(integration.includes(candidate.sourceCommit));
-  assert.ok(integration.includes(`@deepseek-ai/dsh@${candidate.dshVersion}`));
-  assert.match(integration, /not published or available as an npm install yet/);
+  assert.equal(bundled.adapterVersion, published.adapterVersion);
+  assert.equal(bundled.skillVersion, published.skillVersion);
+  assert.equal(bundled.dshVersion, published.dshVersion);
+  assert.ok(integration.includes(`Archify ${bundled.skillVersion}`));
+  assert.ok(integration.includes(bundled.sourceCommit));
+  assert.ok(integration.includes(`@deepseek-ai/dsh@${bundled.dshVersion}`));
+  assert.doesNotMatch(integration, /not published or available as an npm install yet|pending \*\*v1\.0\.0/);
+  assert.ok(integration.includes(`releases/tag/archify-dsh-v${published.adapterVersion}`));
   assert.match(integration, /pinned to stable `main` commit/);
   assert.match(integration, /landed after the `v3\.0\.1` tag/);
   assert.match(integration, /not a byte-for-byte copy of that tag/);
@@ -65,11 +68,10 @@ test('English, Chinese, and Japanese docs cover install, invoke, uninstall, comm
   const chinese = [chineseRoot, integration].join('\n');
   const japanese = [japaneseRoot, integration].join('\n');
   const publishedInstall = `dsh plugin --profile web add @tt-a1i/archify-dsh@${published.adapterVersion}`;
-  const candidateInstall = `dsh plugin --profile web add @tt-a1i/archify-dsh@${candidate.adapterVersion}`;
 
   for (const source of [english, chinese, japanese, englishRoot, chineseRoot, japaneseRoot]) {
     assert.ok(source.includes(publishedInstall));
-    assert.ok(!source.includes(candidateInstall));
+    assert.ok(!source.includes('dsh plugin --profile web add @tt-a1i/archify-dsh@0.1.0'));
     assert.ok(source.includes(`@deepseek-ai/dsh@${published.dshVersion}`));
     assert.ok(source.replaceAll('\\|', '|').includes(manifest.engines.node));
     assert.match(source, /dsh plugin --profile web remove @tt-a1i\/archify-dsh/);
@@ -118,10 +120,10 @@ test('Skills CLI, Cursor, Codex, Claude Code, OpenCode, and Raven remain the def
 
 test('npm README describes the packaged version independently of publication status', () => {
   const packaged = read('integrations/deepseek-harness/PACKAGE_README.md');
-  assert.ok(packaged.includes(`@tt-a1i/archify-dsh@${candidate.adapterVersion}`));
-  assert.ok(packaged.includes(`Archify ${candidate.skillVersion}`));
-  assert.ok(packaged.includes(`@deepseek-ai/dsh@${candidate.dshVersion}`));
-  assert.ok(packaged.includes(candidate.sourceCommit));
+  assert.ok(packaged.includes(`@tt-a1i/archify-dsh@${bundled.adapterVersion}`));
+  assert.ok(packaged.includes(`Archify ${bundled.skillVersion}`));
+  assert.ok(packaged.includes(`@deepseek-ai/dsh@${bundled.dshVersion}`));
+  assert.ok(packaged.includes(bundled.sourceCommit));
   assert.ok(packaged.includes(manifest.engines.node));
   assert.doesNotMatch(packaged, /currently published npm package|not published or available as an npm install yet/);
   assert.match(packaged, /After this version is available in the npm registry/);
```

---

### Incident Patch 3: `a962390c` (2026-10-04)
**Commit Message**: fix(dsh): package version-specific usage documentation

**File**: `integrations/deepseek-harness/CHANGELOG.md` (modified, +4/-2)
```diff
@@ -1,13 +1,15 @@
 # DSH adapter changelog
 
-## 1.0.0 — pending publication
+For current publication status, see the [repository integration README](https://github.com/tt-a1i/archify/tree/main/integrations/deepseek-harness).
+
+## 1.0.0
 
 - First stable adapter contract for the exact tested host `@deepseek-ai/dsh@0.1.2-rc.1`; the host remains a developer preview. Other host versions are not covered by this release claim.
 - Bundles Archify 3.0.1 from stable commit `7158026e852f3aa6578c741e673b46d7878c92c1`, including the installation fix after the Archify v3.0.1 tag. Archify and adapter versions are independent.
 - Preserves the Skill-only activation contract: one `archify-plugin` provider, no native tools, dependencies, install hooks, telemetry, or automatic updates.
 - The release gate covers clean installation and published plugin 0.1.0 → 1.0.0 upgrade, discovery/loading, workspace rendering, and uninstall on Linux, macOS, and Windows. Full example-rewriting smoke runs outside the pnpm store.
 - Archify 3.x changes the Viewer and authoring/delivery flow; existing schema-v1 input remains supported. See [Archify 3.0 upgrade notes](https://github.com/tt-a1i/archify/blob/v3.0.1/CHANGELOG.md#upgrading-from-2x). Existing HTML keeps its embedded Viewer.
-- The prepared 0.2.0 adapter was never published; 1.0.0 supersedes that candidate. Public installation remains 0.1.0 until this release is published and verified.
+- The prepared 0.2.0 adapter was never published; 1.0.0 supersedes that candidate.
 
 ## 0.1.0 — 2026-08-14
 
```

**File**: `integrations/deepseek-harness/PACKAGE_README.md` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+# `@tt-a1i/archify-dsh` 1.0.0
+
+Community DeepSeek Harness integration for [Archify](https://github.com/tt-a1i/archify). This is **not** an official DeepSeek product and does not imply DeepSeek endorsement.
+
+This package bundles **Archify 3.0.1** from stable commit `7158026e852f3aa6578c741e673b46d7878c92c1`, including the installation fix after the `v3.0.1` tag. Both bundled version manifests declare 3.0.1. Adapter and Archify versions are independent.
+
+The 1.0 adapter contract covers the exact tested developer-preview host **`@deepseek-ai/dsh@0.1.2-rc.1`** and Node.js **`^22.19.0 || >=24.0.0`**. It does not make the host stable or guarantee compatibility with other DSH versions. The release gate exercises clean installation and plugin 0.1.0 → 1.0.0 upgrade on Linux, macOS, and Windows using Node 22.
+
+## Install or upgrade
+
+After this version is available in the npm registry, install the exact version in each profile that uses Archify:
+
+```bash
+dsh plugin --profile web add @tt-a1i/archify-dsh@1.0.0
+```
+
+The same command upgrades an existing plugin. Update the DSH host separately to the supported version first; the older `0.1.0-rc.6` host is not a supported 1.0 target. Updating DSH itself or the Archify repository does not update an installed plugin. Do not install from Git source: the repository root is not a DSH package.
+
+For an npm download problem, an integrity-verified tarball can be installed with `dsh plugin --profile web add /absolute/path/to/package.tgz`. See the [changelog](CHANGELOG.md) for the bundled Archify changes and the [repository integration README](https://github.com/tt-a1i/archify/tree/main/integrations/deepseek-harness) for publication status.
+
+## Invoke
+
+Ask DSH to load Archify by name:
+
+```text
+Use the archify skill to map this repository's runtime architecture.
+Show 8–12 core components, one primary path, external dependencies, and trust boundaries.
+Put supporting detail in cards instead of adding more edges.
+After delivery, return the exact workspace paths of the specification JSON and the HTML artifact.
+```
+
+Archify uses DSH's ordinary Skill, shell, and filesystem paths. Generated files do not automatically appear in the Web Produced Files strip; ask for their **exact workspace paths** and open them from the workspace.
+
+## Uninstall
+
+```bash
+dsh plugin --profile web remove @tt-a1i/archify-dsh
+```
+
+The standard plugin command removes the adapter dependency and bundle layer. The base profile remains usable.
+
+## Activation and scope
+
+The bundle mounts one filesystem Skill provider named `archify-plugin`. Its `cordis.patch.yml` contains a `!!js` expression evaluated by the DSH host outside the agent sandbox. The expression uses Node's built-in `path` and `module` helpers to locate this installed package's `skills` directory; it does not fetch data, read credentials, spawn processes, or register another permission path. Review patch changes as host-process code.
+
+The adapter adds no native tools, custom Web client, telemetry, credentials handling, network client, background service, dependencies, or install hooks. The bundled Skill has an optional notification-only stable Archify update checker and bounded network access for authored remote brand assets. It never upgrades this plugin automatically.
+
+`release.json` records the immutable Skill source and exact acceptance host. Reproduce this version from its adapter tag `archify-dsh-v1.0.0` once published, using the committed pack script; use the recorded source rather than a moving branch.
```

**File**: `integrations/deepseek-harness/README.md` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ The bundle's `cordis.patch.yml` contains a `!!js` expression that DSH evaluates
 
 Every Archify release records a sync or deferral decision in the [DSH synchronization checklist](../../CONTRIBUTING.md#release-checklist-dsh-synchronization). Plugin and Archify versions are independent.
 
-On a release branch, bump `package.json`, update `release.json` with the full source commit and matching Skill/DSH versions, and prepare the package README. The pack command reads adapter files and release metadata from the current adapter Git HEAD blob: commit those changes before packing; working-tree edits are not package inputs. Run:
+On a release branch, bump `package.json`, update `release.json` with the full source commit and matching Skill/DSH versions, and prepare `PACKAGE_README.md`, which is staged as the npm package’s `README.md`. This repository README tracks publication status separately. The pack command reads adapter files and release metadata from the current adapter Git HEAD blob: commit those changes before packing; working-tree edits are not package inputs. Run:
 
 ```bash
 node --test integrations/deepseek-harness/test/*.test.mjs
```

**File**: `integrations/deepseek-harness/scripts/release-source.mjs` (modified, +4/-2)
```diff
@@ -7,7 +7,7 @@ import { spawnCliSync } from './resolve-cli.mjs';
 export const integrationRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
 export const repoRoot = path.resolve(integrationRoot, '..', '..');
 const adapterPrefix = 'integrations/deepseek-harness/';
-const requiredAdapterFiles = ['package.json', 'release.json', 'cordis.patch.yml', 'README.md', 'CHANGELOG.md', 'lib/index.js'];
+const requiredAdapterFiles = ['package.json', 'release.json', 'cordis.patch.yml', 'PACKAGE_README.md', 'CHANGELOG.md', 'lib/index.js'];
 
 function readGit(args) {
   const result = spawnCliSync('git', args, { cwd: repoRoot, encoding: null, maxBuffer: 128 * 1024 * 1024 });
@@ -52,7 +52,9 @@ export const release = JSON.parse(adapterFiles.get('release.json').content.toStr
 
 export function stageAdapter(destination) {
   for (const [relative, entry] of adapterFiles) {
-    const target = path.join(destination, ...relative.split('/'));
+    // The repository README tracks publication status; npm needs version-specific usage.
+    const packageRelative = relative === 'PACKAGE_README.md' ? 'README.md' : relative;
+    const target = path.join(destination, ...packageRelative.split('/'));
     fs.mkdirSync(path.dirname(target), { recursive: true });
     fs.writeFileSync(target, entry.content, { mode: entry.mode === '100755' ? 0o755 : 0o644 });
   }
```

**File**: `integrations/deepseek-harness/test/adapter-staging.test.mjs` (modified, +4/-2)
```diff
@@ -155,6 +155,7 @@ test('pack stages adapter inputs from the fixture HEAD despite dirty and untrack
     fs.writeFileSync(releasePath, `${JSON.stringify(release, null, 2)}\n`);
     fs.appendFileSync(adapterPath(checkout, 'cordis.patch.yml'), `\n# ${dirtyMarker}\n`);
     fs.appendFileSync(adapterPath(checkout, 'README.md'), `\n${dirtyMarker}\n`);
+    fs.appendFileSync(adapterPath(checkout, 'PACKAGE_README.md'), `\n${dirtyMarker}\n`);
     fs.writeFileSync(adapterPath(checkout, 'lib/index.js'), `// ${dirtyMarker}\n`);
     fs.writeFileSync(adapterPath(checkout, 'lib/untracked-dirty.mjs'), dirtyMarker);
 
@@ -165,14 +166,15 @@ test('pack stages adapter inputs from the fixture HEAD despite dirty and untrack
     assert.equal(fs.existsSync(out), true);
 
     const packageRoot = unpack(out, root);
-    for (const relative of ['package.json', 'release.json', 'cordis.patch.yml', 'README.md', 'lib/index.js']) {
+    for (const relative of ['package.json', 'release.json', 'cordis.patch.yml', 'README.md', 'CHANGELOG.md', 'lib/index.js']) {
       assert.deepEqual(
         fs.readFileSync(path.join(packageRoot, ...relative.split('/'))),
-        headBlob(checkout, head, relative),
+        headBlob(checkout, head, relative === 'README.md' ? 'PACKAGE_README.md' : relative),
         `packed adapter input differs from fixture HEAD: ${relative}`,
       );
     }
     assert.equal(fs.existsSync(path.join(packageRoot, 'lib', 'untracked-dirty.mjs')), false);
+    assert.equal(fs.existsSync(path.join(packageRoot, 'PACKAGE_README.md')), false);
     const packedText = fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8')
       + fs.readFileSync(path.join(packageRoot, 'release.json'), 'utf8')
       + fs.readFileSync(path.join(packageRoot, 'cordis.patch.yml'), 'utf8')
```

**File**: `integrations/deepseek-harness/test/docs-contract.test.mjs` (modified, +12/-0)
```diff
@@ -115,3 +115,15 @@ test('Skills CLI, Cursor, Codex, Claude Code, OpenCode, and Raven remain the def
   const quickStartIndex = english.indexOf('## Quick start');
   assert.ok(dshEnglishIndex > quickStartIndex, 'DSH docs must not precede the default quick start');
 });
+
+test('npm README describes the packaged version independently of publication status', () => {
+  const packaged = read('integrations/deepseek-harness/PACKAGE_README.md');
+  assert.ok(packaged.includes(`@tt-a1i/archify-dsh@${candidate.adapterVersion}`));
+  assert.ok(packaged.includes(`Archify ${candidate.skillVersion}`));
+  assert.ok(packaged.includes(`@deepseek-ai/dsh@${candidate.dshVersion}`));
+  assert.ok(packaged.includes(candidate.sourceCommit));
+  assert.ok(packaged.includes(manifest.engines.node));
+  assert.doesNotMatch(packaged, /currently published npm package|not published or available as an npm install yet/);
+  assert.match(packaged, /After this version is available in the npm registry/);
+  assert.match(packaged, /outside the agent sandbox/);
+});
```

---

### Incident Patch 4: `b1fa8d73` (2026-10-04)
**Commit Message**: fix(dsh): keep package smoke writes outside pnpm store

**File**: `integrations/deepseek-harness/README.md` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ node integrations/deepseek-harness/scripts/distribution-acceptance.mjs
 node integrations/deepseek-harness/scripts/pack.mjs --out /tmp/archify-dsh.tgz --json
 ```
 
-Distribution acceptance requires Node 22 for the canonical ZIP regression check and pnpm 10. It installs the real pinned DSH runtime and tarball in temporary profiles, checks discovery and loading, runs the installed Skill smoke test, and checks uninstall. Release CI runs this on Linux, macOS, and Windows. Publish only the tested tarball as a new version; tag the corresponding adapter commit as `archify-dsh-v<version>`. After v0.2.0 is published and publicly verified, switch the public install examples to `@0.2.0`. Rebuilding a released adapter uses its tag and recorded Skill commit, not a moving branch.
+Distribution acceptance requires Node 22 for the canonical ZIP regression check and pnpm 10. It installs the real pinned DSH runtime and tarball in temporary profiles, checks discovery and loading, runs `doctor` and `demo` through the installed CLI, and checks uninstall. The full source-version package smoke runs on a temporary copy of the installed Skill because it rewrites bundled examples; the copy preserves pnpm store hard links in the actual installation. Release CI runs this on Linux, macOS, and Windows. Publish only the tested tarball as a new version; tag the corresponding adapter commit as `archify-dsh-v<version>`. After v0.2.0 is published and publicly verified, switch the public install examples to `@0.2.0`. Rebuilding a released adapter uses its tag and recorded Skill commit, not a moving branch.
 
 ## Invoke
 
```

**File**: `integrations/deepseek-harness/scripts/distribution-acceptance.mjs` (modified, +26/-3)
```diff
@@ -383,14 +383,37 @@ pass('resource-base', { resourcePath: resourceReal });
 const skillRoot = fs.existsSync(path.join(resourceReal, 'SKILL.md'))
   ? resourceReal
   : path.join(resourceReal, 'archify');
+// Exercise the installed CLI without writing into the package manager's store.
+const installedCli = path.join(skillRoot, 'bin', 'archify.mjs');
+for (const args of [['doctor'], ['demo', path.join(workspace, 'installed-smoke')]]) {
+  const installedSmoke = run(process.execPath, [installedCli, ...args], {
+    cwd: workspace,
+    timeout: 120_000,
+  });
+  requireStatus('installed-skill-smoke', installedSmoke, { command: `installed archify ${args[0]}` });
+}
+pass('installed-skill-smoke', { skillRoot, commands: ['doctor', 'demo'] });
+
 const sourceSnapshot = path.join(scratch, 'release-source');
 releaseSnapshot(sourceSnapshot);
-const smoke = run(process.execPath, [path.join(sourceSnapshot, 'scripts', 'package-smoke.mjs'), skillRoot], {
+// The source's full package smoke rewrites bundled example HTML. pnpm may
+// hard-link those files to its content store, and Archify correctly refuses
+// to replace a multiply linked output. Copy the installed bytes into an owned
+// scratch tree for this mutating suite; keep the actual installation intact.
+const smokeRoot = path.join(scratch, 'smoke-skill');
+fs.cpSync(skillRoot, smokeRoot, { recursive: true, errorOnExist: true, force: false });
+const smoke = run(process.execPath, [path.join(sourceSnapshot, 'scripts', 'package-smoke.mjs'), smokeRoot], {
   cwd: sourceSnapshot,
   timeout: 120_000,
 });
-requireStatus('package-smoke', smoke, { command: `${DSH_RELEASE_REF} package-smoke.mjs <installed-skill-root>` });
-pass('package-smoke', { skillRoot, source: DSH_RELEASE_REF, output: smoke.stdout.trim() });
+requireStatus('package-smoke', smoke, { command: `${DSH_RELEASE_REF} package-smoke.mjs <installed-skill-copy>` });
+pass('package-smoke', {
+  skillRoot,
+  smokeRoot,
+  source: DSH_RELEASE_REF,
+  mutatingExamples: 'isolated-copy-of-installed-skill',
+  output: smoke.stdout.trim(),
+});
 
 const remove = dsh(['plugin', '--profile', PROFILE, 'remove', PACKAGE_NAME], { timeout: PLUGIN_MUTATION_TIMEOUT });
 requireStatus('uninstall', remove, { command: `dsh plugin --profile ${PROFILE} remove ${PACKAGE_NAME}` });
```

---

### Incident Patch 5: `0054ff65` (2026-10-04)
**Commit Message**: docs(release): require an explicit DSH sync decision

**File**: `.github/workflows/release.yml` (modified, +3/-0)
```diff
@@ -138,3 +138,6 @@ jobs:
         if: steps.release-kind.outputs.prerelease == 'false'
         run: |
           echo 'After the repository Pages source is set to GitHub Actions, publish docs/skill-updates/archify/stable.json in a follow-up commit; the gated deploy job will verify this Release, its archify.zip digest, and the tagged Skill tree before exposure.' >> "$GITHUB_STEP_SUMMARY"
+      - name: Record DSH synchronization follow-up
+        run: |
+          echo 'Review CONTRIBUTING.md#release-checklist-dsh-synchronization: record the pinned DSH bundle update and verification, or an explicit deferral. Archify release publication does not publish the independently versioned DSH plugin; keep npm/tag/README/community status accurate until that separate release is verified.' >> "$GITHUB_STEP_SUMMARY"
```

**File**: `CONTRIBUTING.md` (modified, +10/-0)
```diff
@@ -118,6 +118,16 @@ List regenerated files and explain freshness when an affected output is left unc
 
 Treat published versions as immutable. Ordinary feature PRs do not change versions, tags, or distribution identities unless release work is explicitly in scope.
 
+### Release checklist: DSH synchronization
+
+For every Archify release, record the DSH decision in the release PR or its linked follow-up. The Skill source is pinned: releasing Archify or updating `main` does not update the DSH package or existing installations. Use the [DSH release maintenance procedure](integrations/deepseek-harness/README.md#release-maintenance) for commands and host requirements.
+
+- [ ] Assess whether the release needs a DSH update. Record the selected Archify source/version and plugin version, or an explicit deferral with its reason and follow-up. The plugin has its own version sequence; it need not match Archify's version.
+- [ ] If syncing, update `integrations/deepseek-harness/release.json` to a full immutable `sourceCommit` and matching `skillVersion`; retain or deliberately update the exact tested DSH host version. Check both `archify/package.json` and `archify/skill-release.json` at that source. Identify any fixes included after the Archify version tag.
+- [ ] Commit the adapter inputs before packing. Inspect the actual `.tgz`, including `release.json`, the bundled Skill version/content, license notices, and dependency exclusions; run the package contracts and real distribution acceptance (isolated install, discovery/load, installed Skill smoke, and uninstall). Before plugin publication, complete the DSH workflow's three-platform adapter release gate on the candidate commit and retain its receipts.
+- [ ] Record publication separately from PR completion: verify the tested npm tarball/version and `archify-dsh-v<plugin-version>` tag, then align the integration README, public README install commands, and `community/packages/archify-dsh.json` with what users can actually obtain. Keep published and pending versions distinct while unpublished; never describe a prepared bundle as publicly available.
+- [ ] Treat plugin publication and updates to users' live installations as separate authorized actions. Do not replace an existing version/tag or silently publish as part of the Archify release.
+
 ## Final integration and follow-up
 
 `dev` is the integration and trial-use branch; `main` is the stable branch. Integrate reviewed changes into `dev` first. Promote a tested batch from `dev` to `main` through a separate PR after maintainers have used it on real diagram tasks and confirmed stability. Record the tested revision, usage evidence, and unresolved issues in that PR; passing CI alone does not establish trial-use acceptance. Keep Pages deployment on `main` and formal releases on version tags.
```

**File**: `integrations/deepseek-harness/README.md` (modified, +2/-0)
```diff
@@ -36,6 +36,8 @@ The bundle's `cordis.patch.yml` contains a `!!js` expression that DSH evaluates
 
 ## Release maintenance
 
+Every Archify release records a sync or deferral decision in the [DSH synchronization checklist](../../CONTRIBUTING.md#release-checklist-dsh-synchronization). Plugin and Archify versions are independent.
+
 On a release branch, bump `package.json`, update `release.json` with the full source commit and matching Skill/DSH versions, and prepare the package README. The pack command reads adapter files and release metadata from the current adapter Git HEAD blob: commit those changes before packing; working-tree edits are not package inputs. Run:
 
 ```bash
```

---

### Incident Patch 6: `25a07501` (2026-10-04)
**Commit Message**: fix(dsh): bundle stable Archify 3.0.1 source

**File**: `community/packages/archify-dsh.json` (modified, +2/-2)
```diff
@@ -2,8 +2,8 @@
   "name": "archify-dsh",
   "type": "wrapper",
   "summary": {
-    "en": "Published DSH skill bundle @tt-a1i/archify-dsh 0.1.0 includes Archify 2.14.0. Experimental DSH 0.1.0-rc.6 support; the 0.2.0 bundle remains unpublished.",
-    "zh": "已发布的 DSH 技能包 @tt-a1i/archify-dsh 0.1.0 内含 Archify 2.14.0，实验支持 DSH 0.1.0-rc.6；0.2.0 包尚未发布。"
+    "en": "Published DSH bundle 0.1.0 contains Archify 2.14.0 (DSH 0.1.0-rc.6, experimental). Pending 0.2.0 contains Archify 3.0.1 and is not published.",
+    "zh": "已发布的 DSH 技能包 @tt-a1i/archify-dsh 0.1.0 内含 Archify 2.14.0，实验支持 DSH 0.1.0-rc.6；内含 Archify 3.0.1 的 0.2.0 包尚未发布。"
   },
   "author": {
     "name": "tt-a1i",
```

**File**: `integrations/deepseek-harness/README.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ Community DeepSeek Harness integration for [Archify](https://github.com/tt-a1i/a
 
 The currently published npm package is **v0.1.0**, with experimental compatibility for developer-preview **`@deepseek-ai/dsh@0.1.0-rc.6`** on Node.js **`^22.19.0 || >=24.0.0`**. It bundles Archify Skill **2.14.0**. It is not a stable cross-version guarantee.
 
-The pending **v0.2.0** release is prepared for experimental compatibility with developer-preview **`@deepseek-ai/dsh@0.1.2-rc.1`**. It is not published or available as an npm install yet. It is a Skill-only bundle: it inserts one filesystem Skill provider named `archify-plugin` and exposes an **Archify 2.17.0-dev.1 development snapshot**, pinned to commit `920543baa1c6137803c5b45a69d8977152773d35`. This is not an Archify 2.17 stable release. Compared with the published plugin 0.1.0, it includes authored brand marks, Workflow schema v2, Viewer localization, update awareness, and the subsequent packaging and CLI receipt fixes.
+The pending **v0.2.0** release is prepared for experimental compatibility with developer-preview **`@deepseek-ai/dsh@0.1.2-rc.1`**. It is not published or available as an npm install yet. It is a Skill-only bundle: it inserts one filesystem Skill provider named `archify-plugin` and exposes **Archify 3.0.1**, pinned to stable `main` commit `7158026e852f3aa6578c741e673b46d7878c92c1`. This snapshot includes the Skill installation fix from [#704](https://github.com/tt-a1i/archify/pull/704), which landed after the `v3.0.1` tag; it is not a byte-for-byte copy of that tag. The packaged `package.json` and `skill-release.json` both declare 3.0.1. Compared with the published plugin 0.1.0, it includes the Archify 3.x authoring and delivery flow, authored brand marks, Workflow schema v2, Viewer localization, and update awareness.
 
 `release.json` records the immutable Skill source commit, Skill version, and DSH version used by acceptance. Packaging uses the canonical clean-Skill stager against that commit, preserving license notices and excluding development files. Adapter version 0.1.0 and its `archify-dsh-v0.1.0` tag remain unchanged; reproduce that old release by checking out its tag first.
 
```

**File**: `integrations/deepseek-harness/release.json` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 {
-  "sourceCommit": "920543baa1c6137803c5b45a69d8977152773d35",
-  "skillVersion": "2.17.0-dev.1",
+  "sourceCommit": "7158026e852f3aa6578c741e673b46d7878c92c1",
+  "skillVersion": "3.0.1",
   "dshVersion": "0.1.2-rc.1"
 }
```

**File**: `integrations/deepseek-harness/test/docs-contract.test.mjs` (modified, +3/-1)
```diff
@@ -39,7 +39,9 @@ test('DSH documentation identifies the published release and pinned candidate sn
   assert.ok(integration.includes(candidate.sourceCommit));
   assert.ok(integration.includes(`@deepseek-ai/dsh@${candidate.dshVersion}`));
   assert.match(integration, /not published or available as an npm install yet/);
-  assert.match(integration, /not an Archify 2\.17 stable release/);
+  assert.match(integration, /pinned to stable `main` commit/);
+  assert.match(integration, /landed after the `v3\.0\.1` tag/);
+  assert.match(integration, /not a byte-for-byte copy of that tag/);
   assert.match(integration, /notification-only/);
   assert.match(integration, /does not update an already installed plugin/);
   assert.match(integration, /repository root is not a DSH package/);
```

**File**: `integrations/deepseek-harness/test/tarball-contract.test.mjs` (modified, +16/-0)
```diff
@@ -114,6 +114,22 @@ test('packed Skill payload remains byte-identical to the declared immutable sour
     }
     const skillPackage = JSON.parse(fs.readFileSync(path.join(skillRoot, 'package.json'), 'utf8'));
     assert.equal(skillPackage.version, release.skillVersion);
+    const sourceManifest = spawnSync('git', ['show', `${DSH_RELEASE_REF}:archify/package.json`], {
+      cwd: repoRoot,
+      encoding: 'utf8',
+    });
+    assert.equal(sourceManifest.status, 0, sourceManifest.stderr);
+    const cleanManifest = JSON.parse(sourceManifest.stdout);
+    delete cleanManifest.scripts;
+    delete cleanManifest.devDependencies;
+    assert.deepEqual(skillPackage, cleanManifest, 'only development metadata is stripped from the source manifest');
+    for (const field of ['scripts', 'dependencies', 'devDependencies', 'optionalDependencies',
+      'peerDependencies', 'bundledDependencies', 'bundleDependencies']) {
+      assert.equal(Object.hasOwn(skillPackage, field), false, `packaged Skill must not declare ${field}`);
+    }
+    const skillRelease = JSON.parse(fs.readFileSync(path.join(skillRoot, 'skill-release.json'), 'utf8'));
+    assert.equal(skillRelease.version, release.skillVersion);
+    assert.equal(skillRelease.channel, 'stable');
     assert.match(fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8'), /## Update awareness/);
   } finally {
     fs.rmSync(scratch, { recursive: true, force: true });
```

---

### Incident Patch 7: `7158026e` (2026-10-04)
**Commit Message**: Merge pull request #704 from tt-a1i/fix/702-skill-installation-main

fix(skill): restore Archify installation on main (#702)

**File**: `.agents/skills/archify-review/SKILL.md` (modified, +2/-0)
```diff
@@ -1,6 +1,8 @@
 ---
 name: archify-review
 description: Review Archify issues, PRs, or code through value, cost, and impact to support evidence-based maintenance decisions. Use for issue triage, change reviews, and code quality assessments.
+metadata:
+  internal: true
 ---
 
 # Archify Review
```

**File**: `archify/SKILL.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ---
 name: archify
-description: Create polished, validated architecture, workflow, sequence, data-flow, and lifecycle/state diagrams as explorable standalone HTML with inline SVG, dark/light themes, optional trace motion, and PNG/JPEG/WebP/SVG/WebM export. Accept plain-language requirements or pasted Mermaid flowchart, sequenceDiagram, and stateDiagram input; inspect repository evidence when the diagram must reflect real code. Use when the user asks to visualize system architecture, infrastructure, cloud/security/network topology, technical workflows, API call sequences, request lifecycles, data pipelines, ETL/ELT, data lineage, state machines, or to convert/beautify Mermaid. Also use for everyday subjects with steps, parts, relationships, or states: a leave or travel plan, an application or approval process, a back-and-forth such as renting, where money or documents go, or where an application or order stands. Not for numeric charts or dashboards.
+description: "Create polished, validated architecture, workflow, sequence, data-flow, and lifecycle/state diagrams as explorable standalone HTML with inline SVG, dark/light themes, optional trace motion, and PNG/JPEG/WebP/SVG/WebM export. Accept plain-language requirements or pasted Mermaid flowchart, sequenceDiagram, and stateDiagram input; inspect repository evidence when the diagram must reflect real code. Use when the user asks to visualize system architecture, infrastructure, cloud/security/network topology, technical workflows, API call sequences, request lifecycles, data pipelines, ETL/ELT, data lineage, state machines, or to convert/beautify Mermaid. Also use for everyday subjects with steps, parts, relationships, or states: a leave or travel plan, an application or approval process, a back-and-forth such as renting, where money or documents go, or where an application or order stands. Not for numeric charts or dashboards."
 license: MIT
 metadata:
   version: "3.0"
```

**File**: `archify/package-lock.json` (modified, +110/-1)
```diff
@@ -15,12 +15,27 @@
         "ajv": "^8.17.1",
         "parse5": "7.3.0",
         "saxes": "6.0.0",
-        "simple-icons": "16.28.0"
+        "simple-icons": "16.28.0",
+        "skills": "1.7.0",
+        "yaml": "2.9.1"
       },
       "engines": {
         "node": ">=18"
       }
     },
+    "node_modules/@isaacs/fs-minipass": {
+      "version": "4.0.1",
+      "resolved": "https://registry.npmjs.org/@isaacs/fs-minipass/-/fs-minipass-4.0.1.tgz",
+      "integrity": "sha512-wgm9Ehl2jpeqP3zw/7mo3kRHFp5MEDhqAdwy1fTGkHAwnkGOVsgpvQhL8B5n1qlb01jV3n/bI0ZfZp5lWA1k4w==",
+      "dev": true,
+      "license": "ISC",
+      "dependencies": {
+        "minipass": "^7.0.4"
+      },
+      "engines": {
+        "node": ">=18.0.0"
+      }
+    },
     "node_modules/ajv": {
       "version": "8.20.0",
       "resolved": "https://registry.npmjs.org/ajv/-/ajv-8.20.0.tgz",
@@ -38,6 +53,16 @@
         "url": "https://github.com/sponsors/epoberezkin"
       }
     },
+    "node_modules/chownr": {
+      "version": "3.0.0",
+      "resolved": "https://registry.npmjs.org/chownr/-/chownr-3.0.0.tgz",
+      "integrity": "sha512-+IxzY9BZOQd/XuYPRmrvEVjF/nqj5kgT4kEq7VofrDoM1MxoRjEWkrCC3EtLi59TVawxTAn+orJwFQcrqEN1+g==",
+      "dev": true,
+      "license": "BlueOak-1.0.0",
+      "engines": {
+        "node": ">=18"
+      }
+    },
     "node_modules/entities": {
       "version": "6.0.1",
       "resolved": "https://registry.npmjs.org/entities/-/entities-6.0.1.tgz",
@@ -82,6 +107,29 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/minipass": {
+      "version": "7.1.3",
+      "resolved": "https://registry.npmjs.org/minipass/-/minipass-7.1.3.tgz",
+      "integrity": "sha512-tEBHqDnIoM/1rXME1zgka9g6Q2lcoCkxHLuc7ODJ5BxbP5d4c2Z5cGgtXAku59200Cx7diuHTOYfSBD8n6mm8A==",
+      "dev": true,
+      "license": "BlueOak-1.0.0",
+      "engines": {
+        "node": ">=16 || 14 >=14.17"
+      }
+    },
+    "node_modules/minizlib": {
+      "version": "3.1.0",
+      "resolved": "https://registry.npmjs.org/minizlib/-/minizlib-3.1.0.tgz",
+      "integrity": "sha512-KZxYo1BUkWD2TVFLr0MQoM8vUUigWD3LlD83a/75BqC+4qE0Hb1Vo5v1FgcfaNXvfXzr+5EhQ6ing/CaBijTlw==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "minipass": "^7.1.2"
+      },
+      "engines": {
+        "node": ">= 18"
+      }
+    },
     "node_modules/parse5": {
       "version": "7.3.0",
       "resolved": "https://registry.npmjs.org/parse5/-/parse5-7.3.0.tgz",
@@ -138,12 +186,73 @@
         "node": ">=0.12.18"
       }
     },
+    "node_modules/skills": {
+      "version": "1.7.0",
+      "resolved": "https://registry.npmjs.org/skills/-/skills-1.7.0.tgz",
+      "integrity": "sha512-OfePnDft+Xt9/tCoHdCUe5fkM8i+Q3QOSQO53hm7mKtsXyvc+CKOAAliVWZ484HS3cWx+6r+ob0AArixs3jYXw==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "tar": "^7.5.20",
+        "yaml": "^2.8.3"
+      },
+      "bin": {
+        "add-skill": "bin/cli.mjs",
+        "skills": "bin/cli.mjs"
+      },
+      "engines": {
+        "node": ">=22.20.0"
+      }
+    },
+    "node_modules/tar": {
+      "version": "7.5.22",
+      "resolved": "https://registry.npmjs.org/tar/-/tar-7.5.22.tgz",
+      "integrity": "sha512-MFO/QzvtAOmJbkhOaCTvbGcFN9L9b+JunIsDwaKljSOdcLMea3NJ1k9Usz/rjdfSXTq4dfzfeS7W4p4YOAAHeA==",
+      "dev": true,
+      "license": "BlueOak-1.0.0",
+      "dependencies": {
+        "@isaacs/fs-minipass": "^4.0.0",
+        "chownr": "^3.0.0",
+        "minipass": "^7.1.2",
+        "minizlib": "^3.1.0",
+        "yallist": "^5.0.0"
+      },
+      "engines": {
+        "node": ">=18"
+      }
+    },
     "node_modules/xmlchars": {
       "version": "2.2.0",
       "resolved": "https://registry.npmjs.org/xmlchars/-/xmlchars-2.2.0.tgz",
       "integrity": "sha512-JZnDKK8B0RCDw84FNdDAIpZK+JuJw+s7Lz8nksI7SIuU3UXJJslUthsi+uWBUYOwPFwW7W7PRLRfUKpxjtjFCw==",
       "dev": true,
       "license": "MIT"
+    },
+    "node_modules/yallist": {
+      "version": "5.0.0",
+      "resolved": "https://registry.npmjs.org/yallist/-/yallist-5.0.0.tgz",
+      "integrity": "sha512-YgvUTfwqyc7UXVMrB+SImsVYSmTS8X/tSrtdNZMImM+n7+QTriRXyXim0mBrTXNeqzVF0KWGgHPeiyViFFrNDw==",
+      "dev": true,
+      "license": "BlueOak-1.0.0",
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/yaml": {
+      "version": "2.9.1",
+      "resolved": "https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz",
+      "integrity": "sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw==",
+      "dev": true,
+      "license": "ISC",
+      "bin": {
+        "yaml": "bin.mjs"
+      },
+      "engines": {
+        "node": ">= 14.6"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/eemeli"
+      }
     }
   }
 }
```

**File**: `archify/package.json` (modified, +3/-1)
```diff
@@ -32,7 +32,9 @@
     "ajv": "^8.17.1",
     "parse5": "7.3.0",
     "saxes": "6.0.0",
-    "simple-icons": "16.28.0"
+    "simple-icons": "16.28.0",
+    "skills": "1.7.0",
+    "yaml": "2.9.1"
   },
   "overrides": {
     "fast-uri": "^3.1.7"
```

**File**: `archify/test/skill-installation.test.mjs` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+import { test } from 'node:test';
+import assert from 'node:assert/strict';
+import { spawnSync } from 'node:child_process';
+import fs from 'node:fs';
+import os from 'node:os';
+import path from 'node:path';
+import { createRequire } from 'node:module';
+import { fileURLToPath } from 'node:url';
+import { parse } from 'yaml';
+import { stageCleanSkill } from '../../scripts/stage-clean-skill.mjs';
+
+const require = createRequire(import.meta.url);
+const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
+const skillsPackage = require.resolve('skills/package.json');
+const skillsCli = path.join(path.dirname(skillsPackage), 'bin', 'cli.mjs');
+const [major, minor] = process.versions.node.split('.').map(Number);
+// Archify supports Node 18+, while this external installer's own minimum is 22.20.
+// CI's Node 22 and 24 lanes exercise the real CLI; metadata tests run on all lanes.
+const installerSkip = major > 22 || (major === 22 && minor >= 20)
+  ? false : 'skills 1.7.0 requires Node >=22.20.0';
+
+function metadata(content) {
+  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
+  assert.ok(match, 'Skill must start with delimited YAML frontmatter');
+  const data = parse(match[1]);
+  assert.equal(data.name, 'archify');
+  assert.equal(typeof data.description, 'string');
+  assert.ok(data.description.trim());
+  return data;
+}
+
+function extractArchive(destination) {
+  fs.mkdirSync(destination, { recursive: true });
+  const archive = path.join(repoRoot, 'archify.zip');
+  const result = process.platform === 'win32'
+    ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
+      'Expand-Archive -LiteralPath $env:ARCHIFY_TEST_ARCHIVE -DestinationPath $env:ARCHIFY_TEST_EXTRACT'], {
+      encoding: 'utf8',
+      env: { ...process.env, ARCHIFY_TEST_ARCHIVE: archive, ARCHIFY_TEST_EXTRACT: destination },
+    })
+    : spawnSync('unzip', ['-q', archive, '-d', destination], { encoding: 'utf8' });
+  assert.equal(result.status, 0, result.error?.message || result.stderr);
+}
+
+test('distributed ZIP carries the same valid Skill frontmatter as source', (t) => {
+  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-frontmatter-'));
+  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
+  extractArchive(tmp);
+  const source = fs.readFileSync(path.join(repoRoot, 'archify', 'SKILL.md'), 'utf8');
+  const packaged = fs.readFileSync(path.join(tmp, 'archify', 'SKILL.md'), 'utf8');
+  assert.equal(packaged, source, 'rebuild archify.zip when Skill instructions change');
+  assert.deepEqual(metadata(packaged), metadata(source));
+  assert.deepEqual(metadata(packaged.replace(/\r?\n/g, '\r\n')), metadata(source));
+});
+
+test('real Skills CLI keeps source and ZIP installs scoped to the requested Skill', {
+  skip: installerSkip,
+}, async (t) => {
+  assert.equal(JSON.parse(fs.readFileSync(skillsPackage, 'utf8')).version, '1.7.0');
+  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-skills-install-'));
+  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
+  const source = path.join(tmp, 'source');
+  const archive = path.join(tmp, 'archive');
+  // Use the repository's tracked-file stager: no node_modules, local Skills,
+  // symlinks, or other developer files enter the installation source.
+  stageCleanSkill({ repoRoot, destination: path.join(source, 'archify') });
+  const review = '.agents/skills/archify-review/SKILL.md';
+  fs.mkdirSync(path.dirname(path.join(source, review)), { recursive: true });
+  fs.copyFileSync(path.join(repoRoot, review), path.join(source, review));
+  extractArchive(archive);
+  let sequence = 0;
+  function invoke(sourcePath, flags) {
+    const cwd = path.join(tmp, `target-${sequence++}`);
+    fs.mkdirSync(cwd);
+    const result = spawnSync(process.execPath, [skillsCli, 'add', sourcePath, ...flags], {
+      cwd, encoding: 'utf8', timeout: 30_000,
+      env: {
+        ...process.env, INSTALL_INTERNAL_SKILLS: '0',
+        DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1', NODE_DISABLE_COMPILE_CACHE: '1',
+        XDG_STATE_HOME: path.join(tmp, 'state'), NO_COLOR: '1',
+      },
+    });
+    const output = `${result.stdout || ''}\n${result.stderr || ''}`
+      .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
+    assert.ifError(result.error);
+    return { ...result, cwd, output };
+  }
+  function installedNames(cwd) {
+    const directory = path.join(cwd, '.agents', 'skills');
+    return fs.existsSync(directory) ? fs.readdirSync(directory).sort() : [];
+  }
+  function install(sourcePath, selection = []) {
+    return invoke(sourcePath, [...selection, '--agent', 'codex', '--copy', '--yes']);
+  }
+  for (const [label, sourcePath] of [['source', source], ['ZIP', archive]]) {
+    await t.test(`${label}: default and full-depth discovery expose only archify`, () => {
+      for (const flags of [['--list'], ['--list', '--full-depth']]) {
+        const result 
```

**File**: `archify/test/skill-metadata.test.mjs` (modified, +21/-3)
```diff
@@ -3,19 +3,23 @@ import path from 'node:path';
 import { fileURLToPath } from 'node:url';
 import test from 'node:test';
 import assert from 'node:assert/strict';
+import { parse } from 'yaml';
 
 const here = path.dirname(fileURLToPath(import.meta.url));
 const skillRoot = path.join(here, '..');
 const skill = readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
 const defaults = readFileSync(path.join(skillRoot, 'references', 'authoring-defaults.md'), 'utf8');
 const updateAwareness = readFileSync(path.join(skillRoot, 'references', 'update-awareness.md'), 'utf8');
 const authoringContract = readFileSync(path.join(skillRoot, 'references', 'authoring-contract.md'), 'utf8');
-const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);
+const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
 
 test('skill description is portable across 1024-character runtimes and remains searchable', () => {
   assert.ok(frontmatter, 'SKILL.md must start with YAML frontmatter');
-  const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
-  assert.ok(description, 'frontmatter must include a one-line description');
+  const metadata = parse(frontmatter[1]);
+  assert.equal(metadata.name, 'archify');
+  const description = metadata.description;
+  assert.equal(typeof description, 'string', 'frontmatter description must be a YAML string');
+  assert.ok(description.trim(), 'frontmatter must include a nonempty description');
   assert.ok(description.length <= 1024, `description is ${description.length} characters; maximum is 1024`);
   assert.ok(Buffer.byteLength(description, 'utf8') <= 1024, 'description must also fit a 1024-byte runtime limit');
 
@@ -84,3 +88,17 @@ test('skill keeps the title hierarchy compact by default', () => {
   assert.match(authoringContract, /never use it to restate the title, nodes, edges,\s+or cards/);
   assert.match(authoringContract, /omitted or blank subtitle must not leave an empty visual row/);
 });
+
+// The review Skill remains available to repository maintainers, but must not
+// enter an unfiltered consumer install from the repository root.
+test('contributor review skill is internal and retains its repository references', () => {
+  const reviewRoot = path.resolve(skillRoot, '..', '.agents', 'skills', 'archify-review');
+  const review = readFileSync(path.join(reviewRoot, 'SKILL.md'), 'utf8');
+  const metadata = parse(review.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)[1]);
+  assert.equal(metadata.name, 'archify-review');
+  assert.equal(metadata.metadata?.internal, true);
+  for (const document of ['../../../REVIEWING.md', '../../../CONTRIBUTING.md']) {
+    assert.ok(review.includes(document));
+    assert.ok(existsSync(path.resolve(reviewRoot, document)));
+  }
+});
```

**File**: `scripts/run-windows-path-tests.mjs` (modified, +2/-0)
```diff
@@ -533,6 +533,8 @@ async function runControlledWindowsPathE2E() {
 
 const fullSuites = [
   'test/release-package-gates.test.mjs',
+  'test/skill-metadata.test.mjs',
+  'test/skill-installation.test.mjs',
   'test/copy-site-assets.test.mjs',
   'test/path-boundary-contract.test.mjs',
   'test/path-semantics.test.mjs',
```

---

### Incident Patch 8: `6e4b7dec` (2026-10-04)
**Commit Message**: test(skill): run installation regressions on Windows lanes

**File**: `scripts/run-windows-path-tests.mjs` (modified, +2/-0)
```diff
@@ -533,6 +533,8 @@ async function runControlledWindowsPathE2E() {
 
 const fullSuites = [
   'test/release-package-gates.test.mjs',
+  'test/skill-metadata.test.mjs',
+  'test/skill-installation.test.mjs',
   'test/copy-site-assets.test.mjs',
   'test/path-boundary-contract.test.mjs',
   'test/path-semantics.test.mjs',
```

---

### Incident Patch 9: `67c47c11` (2026-10-04)
**Commit Message**: fix(skill): restore Archify installation and hide contributor review skill

**File**: `.agents/skills/archify-review/SKILL.md` (modified, +2/-0)
```diff
@@ -1,6 +1,8 @@
 ---
 name: archify-review
 description: Review Archify issues, PRs, or code through value, cost, and impact to support evidence-based maintenance decisions. Use for issue triage, change reviews, and code quality assessments.
+metadata:
+  internal: true
 ---
 
 # Archify Review
```

**File**: `archify/SKILL.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ---
 name: archify
-description: Create polished, validated architecture, workflow, sequence, data-flow, and lifecycle/state diagrams as explorable standalone HTML with inline SVG, dark/light themes, optional trace motion, and PNG/JPEG/WebP/SVG/WebM export. Accept plain-language requirements or pasted Mermaid flowchart, sequenceDiagram, and stateDiagram input; inspect repository evidence when the diagram must reflect real code. Use when the user asks to visualize system architecture, infrastructure, cloud/security/network topology, technical workflows, API call sequences, request lifecycles, data pipelines, ETL/ELT, data lineage, state machines, or to convert/beautify Mermaid. Also use for everyday subjects with steps, parts, relationships, or states: a leave or travel plan, an application or approval process, a back-and-forth such as renting, where money or documents go, or where an application or order stands. Not for numeric charts or dashboards.
+description: "Create polished, validated architecture, workflow, sequence, data-flow, and lifecycle/state diagrams as explorable standalone HTML with inline SVG, dark/light themes, optional trace motion, and PNG/JPEG/WebP/SVG/WebM export. Accept plain-language requirements or pasted Mermaid flowchart, sequenceDiagram, and stateDiagram input; inspect repository evidence when the diagram must reflect real code. Use when the user asks to visualize system architecture, infrastructure, cloud/security/network topology, technical workflows, API call sequences, request lifecycles, data pipelines, ETL/ELT, data lineage, state machines, or to convert/beautify Mermaid. Also use for everyday subjects with steps, parts, relationships, or states: a leave or travel plan, an application or approval process, a back-and-forth such as renting, where money or documents go, or where an application or order stands. Not for numeric charts or dashboards."
 license: MIT
 metadata:
   version: "3.0"
```

**File**: `archify/package-lock.json` (modified, +110/-1)
```diff
@@ -15,12 +15,27 @@
         "ajv": "^8.17.1",
         "parse5": "7.3.0",
         "saxes": "6.0.0",
-        "simple-icons": "16.28.0"
+        "simple-icons": "16.28.0",
+        "skills": "1.7.0",
+        "yaml": "2.9.1"
       },
       "engines": {
         "node": ">=18"
       }
     },
+    "node_modules/@isaacs/fs-minipass": {
+      "version": "4.0.1",
+      "resolved": "https://registry.npmjs.org/@isaacs/fs-minipass/-/fs-minipass-4.0.1.tgz",
+      "integrity": "sha512-wgm9Ehl2jpeqP3zw/7mo3kRHFp5MEDhqAdwy1fTGkHAwnkGOVsgpvQhL8B5n1qlb01jV3n/bI0ZfZp5lWA1k4w==",
+      "dev": true,
+      "license": "ISC",
+      "dependencies": {
+        "minipass": "^7.0.4"
+      },
+      "engines": {
+        "node": ">=18.0.0"
+      }
+    },
     "node_modules/ajv": {
       "version": "8.20.0",
       "resolved": "https://registry.npmjs.org/ajv/-/ajv-8.20.0.tgz",
@@ -38,6 +53,16 @@
         "url": "https://github.com/sponsors/epoberezkin"
       }
     },
+    "node_modules/chownr": {
+      "version": "3.0.0",
+      "resolved": "https://registry.npmjs.org/chownr/-/chownr-3.0.0.tgz",
+      "integrity": "sha512-+IxzY9BZOQd/XuYPRmrvEVjF/nqj5kgT4kEq7VofrDoM1MxoRjEWkrCC3EtLi59TVawxTAn+orJwFQcrqEN1+g==",
+      "dev": true,
+      "license": "BlueOak-1.0.0",
+      "engines": {
+        "node": ">=18"
+      }
+    },
     "node_modules/entities": {
       "version": "6.0.1",
       "resolved": "https://registry.npmjs.org/entities/-/entities-6.0.1.tgz",
@@ -82,6 +107,29 @@
       "dev": true,
       "license": "MIT"
     },
+    "node_modules/minipass": {
+      "version": "7.1.3",
+      "resolved": "https://registry.npmjs.org/minipass/-/minipass-7.1.3.tgz",
+      "integrity": "sha512-tEBHqDnIoM/1rXME1zgka9g6Q2lcoCkxHLuc7ODJ5BxbP5d4c2Z5cGgtXAku59200Cx7diuHTOYfSBD8n6mm8A==",
+      "dev": true,
+      "license": "BlueOak-1.0.0",
+      "engines": {
+        "node": ">=16 || 14 >=14.17"
+      }
+    },
+    "node_modules/minizlib": {
+      "version": "3.1.0",
+      "resolved": "https://registry.npmjs.org/minizlib/-/minizlib-3.1.0.tgz",
+      "integrity": "sha512-KZxYo1BUkWD2TVFLr0MQoM8vUUigWD3LlD83a/75BqC+4qE0Hb1Vo5v1FgcfaNXvfXzr+5EhQ6ing/CaBijTlw==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "minipass": "^7.1.2"
+      },
+      "engines": {
+        "node": ">= 18"
+      }
+    },
     "node_modules/parse5": {
       "version": "7.3.0",
       "resolved": "https://registry.npmjs.org/parse5/-/parse5-7.3.0.tgz",
@@ -138,12 +186,73 @@
         "node": ">=0.12.18"
       }
     },
+    "node_modules/skills": {
+      "version": "1.7.0",
+      "resolved": "https://registry.npmjs.org/skills/-/skills-1.7.0.tgz",
+      "integrity": "sha512-OfePnDft+Xt9/tCoHdCUe5fkM8i+Q3QOSQO53hm7mKtsXyvc+CKOAAliVWZ484HS3cWx+6r+ob0AArixs3jYXw==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "tar": "^7.5.20",
+        "yaml": "^2.8.3"
+      },
+      "bin": {
+        "add-skill": "bin/cli.mjs",
+        "skills": "bin/cli.mjs"
+      },
+      "engines": {
+        "node": ">=22.20.0"
+      }
+    },
+    "node_modules/tar": {
+      "version": "7.5.22",
+      "resolved": "https://registry.npmjs.org/tar/-/tar-7.5.22.tgz",
+      "integrity": "sha512-MFO/QzvtAOmJbkhOaCTvbGcFN9L9b+JunIsDwaKljSOdcLMea3NJ1k9Usz/rjdfSXTq4dfzfeS7W4p4YOAAHeA==",
+      "dev": true,
+      "license": "BlueOak-1.0.0",
+      "dependencies": {
+        "@isaacs/fs-minipass": "^4.0.0",
+        "chownr": "^3.0.0",
+        "minipass": "^7.1.2",
+        "minizlib": "^3.1.0",
+        "yallist": "^5.0.0"
+      },
+      "engines": {
+        "node": ">=18"
+      }
+    },
     "node_modules/xmlchars": {
       "version": "2.2.0",
       "resolved": "https://registry.npmjs.org/xmlchars/-/xmlchars-2.2.0.tgz",
       "integrity": "sha512-JZnDKK8B0RCDw84FNdDAIpZK+JuJw+s7Lz8nksI7SIuU3UXJJslUthsi+uWBUYOwPFwW7W7PRLRfUKpxjtjFCw==",
       "dev": true,
       "license": "MIT"
+    },
+    "node_modules/yallist": {
+      "version": "5.0.0",
+      "resolved": "https://registry.npmjs.org/yallist/-/yallist-5.0.0.tgz",
+      "integrity": "sha512-YgvUTfwqyc7UXVMrB+SImsVYSmTS8X/tSrtdNZMImM+n7+QTriRXyXim0mBrTXNeqzVF0KWGgHPeiyViFFrNDw==",
+      "dev": true,
+      "license": "BlueOak-1.0.0",
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/yaml": {
+      "version": "2.9.1",
+      "resolved": "https://registry.npmjs.org/yaml/-/yaml-2.9.1.tgz",
+      "integrity": "sha512-3NxN8+78OdzbT7C/WjGsyfPAtJaN3FNDsWxv7Y7mcDsT/oOmgW8BpyQQFFBnvZE3j9Y2Sdz1ULFLezL7Eb2yFw==",
+      "dev": true,
+      "license": "ISC",
+      "bin": {
+        "yaml": "bin.mjs"
+      },
+      "engines": {
+        "node": ">= 14.6"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/eemeli"
+      }
     }
   }
 }
```

**File**: `archify/package.json` (modified, +3/-1)
```diff
@@ -32,7 +32,9 @@
     "ajv": "^8.17.1",
     "parse5": "7.3.0",
     "saxes": "6.0.0",
-    "simple-icons": "16.28.0"
+    "simple-icons": "16.28.0",
+    "skills": "1.7.0",
+    "yaml": "2.9.1"
   },
   "overrides": {
     "fast-uri": "^3.1.7"
```

**File**: `archify/test/skill-installation.test.mjs` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+import { test } from 'node:test';
+import assert from 'node:assert/strict';
+import { spawnSync } from 'node:child_process';
+import fs from 'node:fs';
+import os from 'node:os';
+import path from 'node:path';
+import { createRequire } from 'node:module';
+import { fileURLToPath } from 'node:url';
+import { parse } from 'yaml';
+import { stageCleanSkill } from '../../scripts/stage-clean-skill.mjs';
+
+const require = createRequire(import.meta.url);
+const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
+const skillsPackage = require.resolve('skills/package.json');
+const skillsCli = path.join(path.dirname(skillsPackage), 'bin', 'cli.mjs');
+const [major, minor] = process.versions.node.split('.').map(Number);
+// Archify supports Node 18+, while this external installer's own minimum is 22.20.
+// CI's Node 22 and 24 lanes exercise the real CLI; metadata tests run on all lanes.
+const installerSkip = major > 22 || (major === 22 && minor >= 20)
+  ? false : 'skills 1.7.0 requires Node >=22.20.0';
+
+function metadata(content) {
+  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
+  assert.ok(match, 'Skill must start with delimited YAML frontmatter');
+  const data = parse(match[1]);
+  assert.equal(data.name, 'archify');
+  assert.equal(typeof data.description, 'string');
+  assert.ok(data.description.trim());
+  return data;
+}
+
+function extractArchive(destination) {
+  fs.mkdirSync(destination, { recursive: true });
+  const archive = path.join(repoRoot, 'archify.zip');
+  const result = process.platform === 'win32'
+    ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
+      'Expand-Archive -LiteralPath $env:ARCHIFY_TEST_ARCHIVE -DestinationPath $env:ARCHIFY_TEST_EXTRACT'], {
+      encoding: 'utf8',
+      env: { ...process.env, ARCHIFY_TEST_ARCHIVE: archive, ARCHIFY_TEST_EXTRACT: destination },
+    })
+    : spawnSync('unzip', ['-q', archive, '-d', destination], { encoding: 'utf8' });
+  assert.equal(result.status, 0, result.error?.message || result.stderr);
+}
+
+test('distributed ZIP carries the same valid Skill frontmatter as source', (t) => {
+  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-frontmatter-'));
+  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
+  extractArchive(tmp);
+  const source = fs.readFileSync(path.join(repoRoot, 'archify', 'SKILL.md'), 'utf8');
+  const packaged = fs.readFileSync(path.join(tmp, 'archify', 'SKILL.md'), 'utf8');
+  assert.equal(packaged, source, 'rebuild archify.zip when Skill instructions change');
+  assert.deepEqual(metadata(packaged), metadata(source));
+  assert.deepEqual(metadata(packaged.replace(/\r?\n/g, '\r\n')), metadata(source));
+});
+
+test('real Skills CLI keeps source and ZIP installs scoped to the requested Skill', {
+  skip: installerSkip,
+}, async (t) => {
+  assert.equal(JSON.parse(fs.readFileSync(skillsPackage, 'utf8')).version, '1.7.0');
+  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'archify-skills-install-'));
+  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
+  const source = path.join(tmp, 'source');
+  const archive = path.join(tmp, 'archive');
+  // Use the repository's tracked-file stager: no node_modules, local Skills,
+  // symlinks, or other developer files enter the installation source.
+  stageCleanSkill({ repoRoot, destination: path.join(source, 'archify') });
+  const review = '.agents/skills/archify-review/SKILL.md';
+  fs.mkdirSync(path.dirname(path.join(source, review)), { recursive: true });
+  fs.copyFileSync(path.join(repoRoot, review), path.join(source, review));
+  extractArchive(archive);
+  let sequence = 0;
+  function invoke(sourcePath, flags) {
+    const cwd = path.join(tmp, `target-${sequence++}`);
+    fs.mkdirSync(cwd);
+    const result = spawnSync(process.execPath, [skillsCli, 'add', sourcePath, ...flags], {
+      cwd, encoding: 'utf8', timeout: 30_000,
+      env: {
+        ...process.env, INSTALL_INTERNAL_SKILLS: '0',
+        DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1', NODE_DISABLE_COMPILE_CACHE: '1',
+        XDG_STATE_HOME: path.join(tmp, 'state'), NO_COLOR: '1',
+      },
+    });
+    const output = `${result.stdout || ''}\n${result.stderr || ''}`
+      .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
+    assert.ifError(result.error);
+    return { ...result, cwd, output };
+  }
+  function installedNames(cwd) {
+    const directory = path.join(cwd, '.agents', 'skills');
+    return fs.existsSync(directory) ? fs.readdirSync(directory).sort() : [];
+  }
+  function install(sourcePath, selection = []) {
+    return invoke(sourcePath, [...selection, '--agent', 'codex', '--copy', '--yes']);
+  }
+  for (const [label, sourcePath] of [['source', source], ['ZIP', archive]]) {
+    await t.test(`${label}: default and full-depth discovery expose only archify`, () => {
+      for (const flags of [['--list'], ['--list', '--full-depth']]) {
+        const result 
```

**File**: `archify/test/skill-metadata.test.mjs` (modified, +21/-3)
```diff
@@ -3,19 +3,23 @@ import path from 'node:path';
 import { fileURLToPath } from 'node:url';
 import test from 'node:test';
 import assert from 'node:assert/strict';
+import { parse } from 'yaml';
 
 const here = path.dirname(fileURLToPath(import.meta.url));
 const skillRoot = path.join(here, '..');
 const skill = readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
 const defaults = readFileSync(path.join(skillRoot, 'references', 'authoring-defaults.md'), 'utf8');
 const updateAwareness = readFileSync(path.join(skillRoot, 'references', 'update-awareness.md'), 'utf8');
 const authoringContract = readFileSync(path.join(skillRoot, 'references', 'authoring-contract.md'), 'utf8');
-const frontmatter = skill.match(/^---\n([\s\S]*?)\n---/);
+const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
 
 test('skill description is portable across 1024-character runtimes and remains searchable', () => {
   assert.ok(frontmatter, 'SKILL.md must start with YAML frontmatter');
-  const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
-  assert.ok(description, 'frontmatter must include a one-line description');
+  const metadata = parse(frontmatter[1]);
+  assert.equal(metadata.name, 'archify');
+  const description = metadata.description;
+  assert.equal(typeof description, 'string', 'frontmatter description must be a YAML string');
+  assert.ok(description.trim(), 'frontmatter must include a nonempty description');
   assert.ok(description.length <= 1024, `description is ${description.length} characters; maximum is 1024`);
   assert.ok(Buffer.byteLength(description, 'utf8') <= 1024, 'description must also fit a 1024-byte runtime limit');
 
@@ -84,3 +88,17 @@ test('skill keeps the title hierarchy compact by default', () => {
   assert.match(authoringContract, /never use it to restate the title, nodes, edges,\s+or cards/);
   assert.match(authoringContract, /omitted or blank subtitle must not leave an empty visual row/);
 });
+
+// The review Skill remains available to repository maintainers, but must not
+// enter an unfiltered consumer install from the repository root.
+test('contributor review skill is internal and retains its repository references', () => {
+  const reviewRoot = path.resolve(skillRoot, '..', '.agents', 'skills', 'archify-review');
+  const review = readFileSync(path.join(reviewRoot, 'SKILL.md'), 'utf8');
+  const metadata = parse(review.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)[1]);
+  assert.equal(metadata.name, 'archify-review');
+  assert.equal(metadata.metadata?.internal, true);
+  for (const document of ['../../../REVIEWING.md', '../../../CONTRIBUTING.md']) {
+    assert.ok(review.includes(document));
+    assert.ok(existsSync(path.resolve(reviewRoot, document)));
+  }
+});
```

---

### Incident Patch 10: `3fd12876` (2026-10-04)
**Commit Message**: fix(website): close review gaps in the everyday proofs

The job-search lifecycle can now end in rejection after the final round,
the leave plan labels its rules as examples to check against one's own
policy (both re-finalized; previews refreshed), and each Proof Lab preview
link takes its accessible name from the card question. The hero iframe keeps
its frozen theme=dark src, which the migration baseline asserts verbatim.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>

**File**: `docs/cases/life/job-search.lifecycle.html` (modified, +5/-0)
```diff
@@ -5057,6 +5057,10 @@ <h1>Where Each Job Application Stands</h1>
           <path data-graph-role="automatic-crossover-underlay" d="M 550 120 L 550 424" fill="none" stroke="var(--mask)" stroke-width="5.1" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>
           <path data-edge-from="screen" data-edge-to="rejected" data-edge-key="8" data-composition-points="550,120;550,424" data-composition-crossover="halo" d="M 550 120 L 550 424" class="a-security" stroke-width="1.1" marker-end="url(#arrowhead-security)"/>
         </g>
+        <g data-graph-role="automatic-crossover" style="--step:9">
+          <path data-graph-role="automatic-crossover-underlay" d="M 754 304 L 754 354 Q 754 364 744 364 L 575 364 Q 565 364 565 374 L 565 424" fill="none" stroke="var(--mask)" stroke-width="5.1" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/>
+          <path data-edge-from="deciding" data-edge-to="rejected" data-edge-key="9" data-composition-points="754,304;754,364;565,364;565,424" data-composition-crossover="halo" d="M 754 304 L 754 354 Q 754 364 744 364 L 575 364 Q 565 364 565 374 L 565 424" class="a-security" stroke-width="1.1" marker-end="url(#arrowhead-security)"/>
+        </g>
 
         <!-- States -->
         <g id="node-saved" data-node-id="saved" data-node-label="Saved" tabindex="0" role="button" aria-label="Focus Saved, role bookmarked, Application path" aria-pressed="false" data-node-kind="start" data-node-sublabel="role bookmarked" data-node-context="Application path">
@@ -5200,6 +5204,7 @@ <h1>Where Each Job Application Stands</h1>
         </g>
 
 
+
         <!-- Legend -->
         <g data-legend="" data-legend-bridge="">
           <text x="40" y="528" class="t-primary" font-size="12" font-weight="650">Legend</text>
```

**File**: `docs/cases/life/job-search.lifecycle.json` (modified, +172/-25)
```diff
@@ -8,35 +8,182 @@
     "output": "job-search.lifecycle.html"
   },
   "lanes": [
-    { "id": "main", "label": "Application path" },
-    { "id": "waiting", "label": "Waiting on them" },
-    { "id": "terminal", "label": "Outcomes" }
+    {
+      "id": "main",
+      "label": "Application path"
+    },
+    {
+      "id": "waiting",
+      "label": "Waiting on them"
+    },
+    {
+      "id": "terminal",
+      "label": "Outcomes"
+    }
   ],
   "states": [
-    { "id": "saved", "type": "start", "label": "Saved", "sublabel": "role bookmarked", "lane": "main", "col": 0, "step": "01", "icon": "flag" },
-    { "id": "applied", "type": "active", "label": "Applied", "sublabel": "résumé sent", "lane": "main", "col": 1, "step": "02", "icon": "briefcase" },
-    { "id": "screen", "type": "decision", "label": "Screen Call", "sublabel": "30 min recruiter", "lane": "main", "col": 2, "step": "03", "icon": "person" },
-    { "id": "interviews", "type": "active", "label": "Interviews", "sublabel": "3 rounds", "lane": "main", "col": 3, "step": "04", "icon": "calendar" },
-    { "id": "offer", "type": "success", "label": "Offer", "sublabel": "negotiate terms", "lane": "main", "col": 4, "step": "05" },
-    { "id": "silent", "type": "waiting", "label": "No Reply", "sublabel": "2 weeks quiet", "lane": "waiting", "col": 1, "icon": "clock" },
-    { "id": "deciding", "type": "waiting", "label": "Deciding", "sublabel": "after final round", "lane": "waiting", "col": 3, "icon": "clock" },
-    { "id": "rejected", "type": "failure", "label": "Rejected", "sublabel": "keep the notes", "lane": "terminal", "col": 2 },
-    { "id": "accepted", "type": "success", "label": "Accepted", "sublabel": "start date set", "lane": "terminal", "col": 4 }
+    {
+      "id": "saved",
+      "type": "start",
+      "label": "Saved",
+      "sublabel": "role bookmarked",
+      "lane": "main",
+      "col": 0,
+      "step": "01",
+      "icon": "flag"
+    },
+    {
+      "id": "applied",
+      "type": "active",
+      "label": "Applied",
+      "sublabel": "r\u00e9sum\u00e9 sent",
+      "lane": "main",
+      "col": 1,
+      "step": "02",
+      "icon": "briefcase"
+    },
+    {
+      "id": "screen",
+      "type": "decision",
+      "label": "Screen Call",
+      "sublabel": "30 min recruiter",
+      "lane": "main",
+      "col": 2,
+      "step": "03",
+      "icon": "person"
+    },
+    {
+      "id": "interviews",
+      "type": "active",
+      "label": "Interviews",
+      "sublabel": "3 rounds",
+      "lane": "main",
+      "col": 3,
+      "step": "04",
+      "icon": "calendar"
+    },
+    {
+      "id": "offer",
+      "type": "success",
+      "label": "Offer",
+      "sublabel": "negotiate terms",
+      "lane": "main",
+      "col": 4,
+      "step": "05"
+    },
+    {
+      "id": "silent",
+      "type": "waiting",
+      "label": "No Reply",
+      "sublabel": "2 weeks quiet",
+      "lane": "waiting",
+      "col": 1,
+      "icon": "clock"
+    },
+    {
+      "id": "deciding",
+      "type": "waiting",
+      "label": "Deciding",
+      "sublabel": "after final round",
+      "lane": "waiting",
+      "col": 3,
+      "icon": "clock"
+    },
+    {
+      "id": "rejected",
+      "type": "failure",
+      "label": "Rejected",
+      "sublabel": "keep the notes",
+      "lane": "terminal",
+      "col": 2
+    },
+    {
+      "id": "accepted",
+      "type": "success",
+      "label": "Accepted",
+      "sublabel": "start date set",
+      "lane": "terminal",
+      "col": 4
+    }
   ],
   "transitions": [
-    { "from": "saved", "to": "applied", "label": "apply" },
-    { "from": "applied", "to": "screen", "label": "callback" },
-    { "from": "screen", "to": "interviews", "label": "pass" },
-    { "from": "interviews", "to": "deciding", "variant": "dashed" },
-    { "from": "deciding", "to": "offer", "label": "yes", "variant": "emphasis" },
-    { "from": "offer", "to": "accepted", "label": "sign" },
-    { "from": "applied", "to": "silent", "variant": "dashed" },
-    { "from": "silent", "to": "applied", "label": "follow up", "variant": "emphasis" },
-    { "from": "screen", "to": "rejected", "variant": "security" }
+    {
+      "from": "saved",
+      "to": "applied",
+      "label": "apply"
+    },
+    {
+      "from": "applied",
+      "to": "screen",
+      "label": "callback"
+    },
+    {
+      "from": "screen",
+      "to": "interviews",
+      "label": "pass"
+    },
+    {
+      "from": "interviews",
+      "to": "deciding",
+      "variant": "dashed"
+    },
+    {
+      "from": "deciding",
+      "to": "offer",
+      "label": "yes",
+      "variant": "emphasis"
+    },
+    {
+      "from": "offer",
+      "to": "accepted",
+      "label": "sign"
+    },
+    {
+      "from": "applied",
+      "to": "silent",
+      "variant": "dashed"
+    },
+    {
+      "from": "silent",
+      "to": "applied",
+      "label": "follow up",
+      "variant": "emphasis"
+    },
+    {
+      "from": "screen
```

**File**: `docs/cases/life/leave-plan.workflow.html` (modified, +2/-1)
```diff
@@ -5357,7 +5357,7 @@ <h3>额度账本</h3>
         <ul>
           <li>年初：年假 10 天 + 调休 2 天</li>
           <li>四次拼假共用 12 天，年底结余 0</li>
-          <li>示例数据，换成你自己的额度即可</li>
+          <li>示例额度，换成你自己的即可</li>
         </ul>
       </div>
 
@@ -5369,6 +5369,7 @@ <h3>两条规则</h3>
         <ul>
           <li>调休 6 月底作废，所以排在最前面</li>
           <li>国庆前后是热门时段，提前两周提交审批</li>
+          <li>规则是示例，以你公司的休假制度为准</li>
         </ul>
       </div>
 
```

**File**: `docs/cases/life/leave-plan.workflow.json` (modified, +3/-2)
```diff
@@ -171,15 +171,16 @@
       "items": [
         "年初：年假 10 天 + 调休 2 天",
         "四次拼假共用 12 天，年底结余 0",
-        "示例数据，换成你自己的额度即可"
+        "示例额度，换成你自己的即可"
       ]
     },
     {
       "dot": "rose",
       "title": "两条规则",
       "items": [
         "调休 6 月底作废，所以排在最前面",
-        "国庆前后是热门时段，提前两周提交审批"
+        "国庆前后是热门时段，提前两周提交审批",
+        "规则是示例，以你公司的休假制度为准"
       ]
     },
     {
```

**File**: `website/src/pages/gallery.astro` (modified, +8/-8)
```diff
@@ -63,27 +63,27 @@ import pageScript from '../scripts/gallery.js?raw';
           </div>
           <div class="life-grid">
             <article class="life-card">
-              <a class="life-plate" href="cases/life/leave-plan.workflow.html?present=1" target="_blank" rel="noopener"><img src="assets/life/leave-plan.workflow.webp" alt="" loading="lazy" decoding="async" width="2160" height="1350"></a>
+              <a class="life-plate" href="cases/life/leave-plan.workflow.html?present=1" target="_blank" rel="noopener" aria-labelledby="life-q-leave-plan"><img src="assets/life/leave-plan.workflow.webp" alt="" loading="lazy" decoding="async" width="2160" height="1350"></a>
               <div class="life-meta"><span class="life-lang">中文</span><span class="life-kind" data-en="Workflow" data-zh="工作流">Workflow</span></div>
-              <h3 class="life-q" data-en="How should I spread my leave across the year?" data-zh="一年的假怎么排最划算？">How should I spread my leave across the year?</h3>
+              <h3 class="life-q" id="life-q-leave-plan" data-en="How should I spread my leave across the year?" data-zh="一年的假怎么排最划算？">How should I spread my leave across the year?</h3>
               <div class="life-links"><a class="card-link primary" href="cases/life/leave-plan.workflow.html?present=1" target="_blank" rel="noopener" data-en="Open artifact" data-zh="打开成品">Open artifact</a><a class="card-link" href="cases/life/leave-plan.workflow.json" target="_blank" rel="noopener">JSON</a></div>
             </article>
             <article class="life-card">
-              <a class="life-plate" href="cases/life/job-search.lifecycle.html?present=1" target="_blank" rel="noopener"><img src="assets/life/job-search.lifecycle.webp" alt="" loading="lazy" decoding="async" width="2160" height="1350"></a>
+              <a class="life-plate" href="cases/life/job-search.lifecycle.html?present=1" target="_blank" rel="noopener" aria-labelledby="life-q-job-search"><img src="assets/life/job-search.lifecycle.webp" alt="" loading="lazy" decoding="async" width="2160" height="1350"></a>
               <div class="life-meta"><span class="life-lang">EN</span><span class="life-kind" data-en="Lifecycle" data-zh="生命周期">Lifecycle</span></div>
-              <h3 class="life-q" data-en="Where does each job application stand?" data-zh="每份求职申请走到哪一步了？">Where does each job application stand?</h3>
+              <h3 class="life-q" id="life-q-job-search" data-en="Where does each job application stand?" data-zh="每份求职申请走到哪一步了？">Where does each job application stand?</h3>
               <div class="life-links"><a class="card-link primary" href="cases/life/job-search.lifecycle.html?present=1" target="_blank" rel="noopener" data-en="Open artifact" data-zh="打开成品">Open artifact</a><a class="card-link" href="cases/life/job-search.lifecycle.json" target="_blank" rel="noopener">JSON</a></div>
             </article>
             <article class="life-card">
-              <a class="life-plate" href="cases/life/monthly-money.dataflow.html?present=1" target="_blank" rel="noopener"><img src="assets/life/monthly-money.dataflow.webp" alt="" loading="lazy" decoding="async" width="2160" height="1350"></a>
+              <a class="life-plate" href="cases/life/monthly-money.dataflow.html?present=1" target="_blank" rel="noopener" aria-labelledby="life-q-monthly-money"><img src="assets/life/monthly-money.dataflow.webp" alt="" loading="lazy" decoding="async" width="2160" height="1350"></a>
               <div class="life-meta"><span class="life-lang">EN</span><span class="life-kind" data-en="Data flow" data-zh="数据流">Data flow</span></div>
-              <h3 class="life-q" data-en="Where does my paycheck go each month?" data-zh="工资每个月都去哪了？">Where does my paycheck go each month?</h3>
+              <h3 class="life-q" id="life-q-monthly-money" data-en="Where does my paycheck go each month?" data-zh="工资每个月都去哪了？">Where does my paycheck go each month?</h3>
               <div class="life-links"><a class="card-link primary" href="cases/life/monthly-money.dataflow.html?present=1" target="_blank" rel="noopener" data-en="Open artifact" data-zh="打开成品">Open artifact</a><a class="card-link" href="cases/life/monthly-money.dataflow.json" target="_blank" rel="noopener">JSON</a></div>
             </article>
             <article class="life-card">
-              <a class="life-plate" href="cases/life/renting.sequence.html?present=1" target="_blank" rel="noopener"><img src="assets/life/renting.sequence.webp" alt="" loading="lazy" decoding="async" width="2160" height="1350"></a>
+              <a class="life-plate" href="cases/life/renting.sequence.html?present=1" target="_blank" rel="noopener" aria-labelledby="life-q-renting"><img src="assets/life/renting.sequence.webp" alt="" loading="lazy" decoding="async" width="2160" height="1350"></a>
               <div class="life-meta"><span class="life-lang">中文</span><span class="life-kind" data-en="Sequence" data-zh="时序图">Sequence</span></div>
-           
```

---

### Incident Patch 11: `e7e79818` (2026-10-04)
**Commit Message**: fix(website): keep navigation geometry identical on every page

Only the homepage reserved a stable scrollbar gutter, so the centred nav
padding differed by the scrollbar width and the real-Chrome navigation
receipt failed. The gutter now lives in the shared stylesheet. The
Unreleased CHANGELOG entry is withdrawn from this stable-base branch, where
release identity requires a prerelease version for unreleased notes.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>

**File**: `CHANGELOG.md` (modified, +0/-3)
```diff
@@ -4,9 +4,6 @@ All notable changes are documented here. Format loosely follows [Keep a Changelo
 
 ## [Unreleased]
 
-### Changed
-- **Everyday subjects in the Skill trigger.** The Skill description now also covers everyday plans and processes with steps, parts, relationships, or states (leave or travel plans, application and approval processes, back-and-forth exchanges, where money or documents go, where an application stands) and states that numeric charts and dashboards are out of scope. The Type router names an everyday use per mode, and authoring points to everyday icons and legend labels while asking for missing personal facts instead of inventing them. Renderers, schemas, and validation are unchanged.
-
 ## [3.0.1] — 2026-09-28
 
 ### Changed
```

**File**: `website/src/styles/site.css` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@
       --content:1320px;
     }
     *,*::before,*::after { margin:0; padding:0; box-sizing:border-box; }
-    html { scroll-behavior:smooth; background:var(--bg); scrollbar-width:thin; scrollbar-color:rgba(var(--fg-rgb),.2) transparent; }
+    html { scroll-behavior:smooth; scrollbar-gutter:stable; background:var(--bg); scrollbar-width:thin; scrollbar-color:rgba(var(--fg-rgb),.2) transparent; }
     body { font-family:var(--font-body); -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; background:var(--bg); color:var(--text); min-height:100vh; overflow-x:clip; }
     body::after { content:''; position:fixed; inset:0; z-index:1000; pointer-events:none; opacity:.035; mix-blend-mode:overlay;
       background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='140' height='140' filter='url(%23n)'/></svg>"); }
```

---

### Incident Patch 12: `1544510e` (2026-10-04)
**Commit Message**: Merge pull request #696 from tt-a1i/codex/socket-fixture-main

test(migration): generate cleanup-failure hook at test time

**File**: `archify/test/fixtures/fail-migration-cleanup.mjs` (removed, +0/-17)
```diff
@@ -1,17 +0,0 @@
-import fs from 'node:fs';
-import path from 'node:path';
-
-const originalRmdirSync = fs.rmdirSync.bind(fs);
-let injectedFailure = false;
-
-fs.rmdirSync = function failMigrationCleanupOnce(target, options) {
-  const isMigrationStagingDirectory = path.basename(String(target)).startsWith('.archify-migration-');
-  if (!injectedFailure && isMigrationStagingDirectory) {
-    injectedFailure = true;
-    originalRmdirSync(target, options);
-    const error = new Error('simulated migration cleanup failure');
-    error.code = 'EPERM';
-    throw error;
-  }
-  return originalRmdirSync(target, options);
-};
```

**File**: `archify/test/workflow-migration.test.mjs` (modified, +17/-1)
```diff
@@ -519,7 +519,23 @@ test('workflow migration staging never aliases a destination named like its veri
 test('workflow migration cleanup failure warns without reversing a successful commit', () => {
   const source = copyFixture('cleanup-warning-source.workflow.json');
   const destination = path.join(tmp, 'cleanup-warning-destination.workflow.json');
-  const importModule = path.join(__dirname, 'fixtures', 'fail-migration-cleanup.mjs');
+  const importModule = path.join(tmp, 'fail-migration-cleanup.mjs');
+  fs.writeFileSync(importModule, `
+import fs from 'node:fs';
+import path from 'node:path';
+const rmdirSync = fs.rmdirSync.bind(fs);
+let failed = false;
+fs.rmdirSync = (directory, ...args) => {
+  if (!failed && path.basename(String(directory)).startsWith('.archify-migration-')) {
+    failed = true;
+    rmdirSync(directory, ...args);
+    const error = new Error('simulated migration cleanup failure');
+    error.code = 'EPERM';
+    throw error;
+  }
+  return rmdirSync(directory, ...args);
+};
+`);
 
   const result = runMigration(source, destination, { importModule });
 
```

---

### Incident Patch 13: `4000f961` (2026-10-04)
**Commit Message**: fix(website): give the star count a larger filled gold star

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>

**File**: `website/src/styles/site.css` (modified, +4/-2)
```diff
@@ -17,6 +17,7 @@
       --title-top:#0b0c0e; --title-end:rgba(18,20,23,.72); --grad-a:#f08a4b; --grad-c:#d6264f; --glint:#e2500e;
       --emerald:#059669; --signal:#0d9488; --rose:#e11d48; --violet:#7c3aed;
       --hue-cyan:#0891b2; --hue-emerald:#059669; --hue-violet:#7c3aed; --hue-amber:#d97706; --hue-rose:#e11d48; --hue-orange:#ea580c; --hue-slate:#64748b; --hue-blue:#2563eb;
+      --star:#f5a524;
       --lockup:url("assets/archify-lockup-light.svg");
       color-scheme:light;
     }
@@ -31,6 +32,7 @@
       --title-top:#ffffff; --title-end:rgba(238,241,243,.7); --grad-a:#ffb38a; --grad-c:#ff3d6e; --glint:#ffffff;
       --emerald:#34d399; --signal:#5eead4; --rose:#fb7185; --violet:#a78bfa;
       --hue-cyan:#22d3ee; --hue-emerald:#34d399; --hue-violet:#a78bfa; --hue-amber:#fbbf24; --hue-rose:#fb7185; --hue-orange:#fb923c; --hue-slate:#94a3b8; --hue-blue:#60a5fa;
+      --star:#fbbf24;
       --lockup:url("assets/archify-lockup-dark.svg");
       color-scheme:dark;
     }
@@ -91,8 +93,8 @@
     .site-nav .nav-link:hover { color:var(--text); background:rgba(var(--fg-rgb),.05); }
     .site-nav .nav-link[aria-current="page"] { color:var(--text); background:rgba(var(--fg-rgb),.09); box-shadow:inset 0 0 0 1px rgba(var(--fg-rgb),.1); }
     .site-nav .nav-link[aria-current="page"]::before { content:''; width:5px; height:5px; border-radius:50%; background:var(--accent); box-shadow:0 0 8px rgba(var(--accent-rgb),.8); }
-    .site-nav .nav-stars { display:inline-flex; align-items:center; gap:.3rem; height:20px; padding:0 .5rem 0 .4rem; border-radius:999px; border:1px solid var(--line); background:rgba(var(--fg-rgb),.04); color:var(--text-2); font-family:var(--font-body); font-size:.6875rem; font-weight:600; font-variant-numeric:tabular-nums; letter-spacing:0; line-height:1; }
-    .site-nav .nav-stars::before, .stars-count::before { content:''; width:11px; height:11px; flex:none; background:currentColor; -webkit-mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 1.6l1.9 3.86 4.26.62-3.08 3 .73 4.24L8 11.32l-3.81 2 .73-4.24-3.08-3 4.26-.62z' fill='none' stroke='black' stroke-width='1.5' stroke-linejoin='round'/></svg>") center / contain no-repeat; mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 1.6l1.9 3.86 4.26.62-3.08 3 .73 4.24L8 11.32l-3.81 2 .73-4.24-3.08-3 4.26-.62z' fill='none' stroke='black' stroke-width='1.5' stroke-linejoin='round'/></svg>") center / contain no-repeat; }
+    .site-nav .nav-stars { display:inline-flex; align-items:center; gap:.28rem; height:22px; padding:0 .55rem 0 .42rem; border-radius:999px; border:1px solid var(--line); background:rgba(var(--fg-rgb),.04); color:var(--text); font-family:var(--font-body); font-size:.75rem; font-weight:600; font-variant-numeric:tabular-nums; letter-spacing:0; line-height:1; }
+    .site-nav .nav-stars::before, .stars-count::before { content:''; width:13px; height:13px; flex:none; background:var(--star); -webkit-mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 1.6l1.9 3.86 4.26.62-3.08 3 .73 4.24L8 11.32l-3.81 2 .73-4.24-3.08-3 4.26-.62z' fill='black' stroke='black' stroke-width='1' stroke-linejoin='round'/></svg>") center / contain no-repeat; mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 1.6l1.9 3.86 4.26.62-3.08 3 .73 4.24L8 11.32l-3.81 2 .73-4.24-3.08-3 4.26-.62z' fill='black' stroke='black' stroke-width='1' stroke-linejoin='round'/></svg>") center / contain no-repeat; }
     .site-nav .nav-link:hover .nav-stars { color:var(--text); }
     .site-nav .nav-stars[hidden] { display:none; }
     .site-nav .btn-theme { width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; flex:none; padding:0; border:1px solid var(--line-hi); border-radius:10px; background:transparent; color:var(--text-2); cursor:pointer; transition:color .18s var(--ease-out),border-color .18s var(--ease-out); }
```

---

### Incident Patch 14: `fbd88d08` (2026-10-04)
**Commit Message**: fix(website): draw the star count as one quiet chip

The yellow text glyph sat small and off-baseline next to a monospace count
and was the only saturated mark in the bar. The chip now pairs an outline
star icon in the label colour with tabular body numerals; the hero meta
drops its redundant star since the copy already says "stars".

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>

**File**: `website/src/styles/index.css` (modified, +2/-2)
```diff
@@ -97,8 +97,8 @@
     .hero-works b { font-weight:500; color:var(--text-2); }
     .hero-stars { display:inline-flex; align-items:center; gap:.45rem; padding-left:1.5rem; border-left:1px solid var(--line-hi); color:var(--text-3); text-decoration:none; transition:color .18s var(--ease-out); }
     .hero-stars:hover { color:var(--text); }
-    .stars-count { font-family:var(--font-mono); font-weight:500; color:var(--text); }
-    .stars-count::before { content:'★ '; color:#fbbf24; }
+    .stars-count { font-weight:600; font-variant-numeric:tabular-nums; color:var(--text); }
+    .hero-stars .stars-count::before { display:none; }
 
     /* ══════════════════════════════════════
        STAGE — pinned live artifact window; scroll drives the camera beats.
```

**File**: `website/src/styles/site.css` (modified, +3/-2)
```diff
@@ -91,8 +91,9 @@
     .site-nav .nav-link:hover { color:var(--text); background:rgba(var(--fg-rgb),.05); }
     .site-nav .nav-link[aria-current="page"] { color:var(--text); background:rgba(var(--fg-rgb),.09); box-shadow:inset 0 0 0 1px rgba(var(--fg-rgb),.1); }
     .site-nav .nav-link[aria-current="page"]::before { content:''; width:5px; height:5px; border-radius:50%; background:var(--accent); box-shadow:0 0 8px rgba(var(--accent-rgb),.8); }
-    .site-nav .nav-stars { display:inline-flex; align-items:center; gap:.25rem; padding:.18rem .42rem; border-radius:999px; background:rgba(var(--fg-rgb),.07); color:var(--text); font-family:var(--font-mono); font-size:.625rem; font-weight:500; letter-spacing:0; }
-    .site-nav .nav-stars::before { content:'★'; color:#fbbf24; font-size:.6875rem; }
+    .site-nav .nav-stars { display:inline-flex; align-items:center; gap:.3rem; height:20px; padding:0 .5rem 0 .4rem; border-radius:999px; border:1px solid var(--line); background:rgba(var(--fg-rgb),.04); color:var(--text-2); font-family:var(--font-body); font-size:.6875rem; font-weight:600; font-variant-numeric:tabular-nums; letter-spacing:0; line-height:1; }
+    .site-nav .nav-stars::before, .stars-count::before { content:''; width:11px; height:11px; flex:none; background:currentColor; -webkit-mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 1.6l1.9 3.86 4.26.62-3.08 3 .73 4.24L8 11.32l-3.81 2 .73-4.24-3.08-3 4.26-.62z' fill='none' stroke='black' stroke-width='1.5' stroke-linejoin='round'/></svg>") center / contain no-repeat; mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><path d='M8 1.6l1.9 3.86 4.26.62-3.08 3 .73 4.24L8 11.32l-3.81 2 .73-4.24-3.08-3 4.26-.62z' fill='none' stroke='black' stroke-width='1.5' stroke-linejoin='round'/></svg>") center / contain no-repeat; }
+    .site-nav .nav-link:hover .nav-stars { color:var(--text); }
     .site-nav .nav-stars[hidden] { display:none; }
     .site-nav .btn-theme { width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; flex:none; padding:0; border:1px solid var(--line-hi); border-radius:10px; background:transparent; color:var(--text-2); cursor:pointer; transition:color .18s var(--ease-out),border-color .18s var(--ease-out); }
     .site-nav .btn-theme:hover { color:var(--text); border-color:var(--line-strong); }
```

---

### Incident Patch 15: `11d4d698` (2026-10-04)
**Commit Message**: feat(website): read the build and submission receipts as a CI run

The pipeline becomes a connected stepper with lit check nodes and status
pills, the terminal gets a window bar and a gradient edge instead of a
muddy glow, and both columns centre on each other. Shared by Proof Lab and
Community.

Generated with [Devin](https://devin.ai)

Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>

**File**: `website/src/styles/community.css` (modified, +24/-2)
```diff
@@ -193,5 +193,27 @@
     .ledger-cell[aria-pressed="true"] .ledger-label, .ledger-cell[aria-pressed="true"] .ledger-count { color:#0a0b0d; }
     .ledger-count { font-family:var(--font-title); font-style:normal; font-weight:500; font-size:1.125rem; }
     .section-intro h2 { font-size:clamp(2rem,4vw,3.25rem); }
-    .method-code { border-radius:16px; box-shadow:0 40px 100px -50px rgba(255,106,43,.4); }
-    .pipeline { border-radius:16px; }
+
+    /* ══ Build / submission receipt — a CI run read top to bottom beside its terminal ══ */
+    .method { position:relative; padding:7rem 0; border-top:1px solid var(--line); overflow:hidden; }
+    .method::before { content:''; position:absolute; inset:0 0 auto; height:1px; background:linear-gradient(90deg, transparent, rgba(52,211,153,.5), transparent); }
+    .method-grid { grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr); gap:4rem; align-items:center; }
+    .method h2 { max-width:none; text-wrap:balance; font-size:clamp(2rem,3.6vw,3.25rem); line-height:1.04; letter-spacing:-.04em; }
+    .pipeline { position:relative; margin-top:2.5rem; gap:.5rem; background:none; border:0; border-radius:0; overflow:visible; }
+    .pipeline::before { content:''; position:absolute; left:19px; top:20px; bottom:20px; width:2px; border-radius:2px; background:linear-gradient(rgba(52,211,153,.7), rgba(52,211,153,.12)); }
+    .pipeline-step { grid-template-columns:40px 1fr auto; gap:1.1rem; min-height:48px; padding:0; background:none; }
+    .pipeline-num { position:relative; z-index:1; width:40px; height:40px; display:grid; place-items:center; border-radius:50%; border:1px solid rgba(52,211,153,.45); background:#0a0d11; color:var(--emerald); font-size:.6875rem; box-shadow:0 0 18px -6px rgba(52,211,153,.8); }
+    .pipeline-label { font-size:.9375rem; color:var(--text); }
+    .pipeline-state { padding:.3rem .6rem; border-radius:999px; background:rgba(52,211,153,.1); border:1px solid rgba(52,211,153,.25); font-size:.625rem; }
+    .pipeline-state.you { color:var(--text-2); background:rgba(238,241,243,.05); border-color:var(--line-hi); }
+    .pipeline-step:has(.you) .pipeline-num { color:var(--text-2); border-color:var(--line-hi); box-shadow:none; }
+    .method-code { position:relative; display:flex; flex-direction:column; border-radius:18px; border:1px solid var(--line-hi); background:#07090c; box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 30px 80px -30px rgba(0,0,0,.8); }
+    .method-code::after { content:''; position:absolute; inset:-1px; border-radius:inherit; pointer-events:none; padding:1px; background:linear-gradient(140deg, rgba(52,211,153,.45), transparent 35%, transparent 70%, rgba(255,106,43,.35)); -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude; }
+    .method-code-bar { align-items:center; padding:.85rem 1.1rem .85rem 4.5rem; border-bottom-color:var(--line); color:var(--text-3);
+      background:radial-gradient(circle at 1.35rem 50%, #ff5f57 5px, transparent 5.5px), radial-gradient(circle at 2.35rem 50%, #febc2e 5px, transparent 5.5px), radial-gradient(circle at 3.35rem 50%, #28c840 5px, transparent 5.5px), rgba(238,241,243,.025); }
+    .method-code pre { flex:1; padding:1.75rem 1.9rem 2rem; color:rgba(238,241,243,.72); font:500 .8125rem/2 var(--font-mono); }
+    .method-code .accent { color:var(--accent); }
+    @media (max-width:960px) { .method { padding:5rem 0; } .method-grid { grid-template-columns:1fr; gap:2.75rem; } }
+    @media (max-width:640px) { .method-code pre { padding:1.25rem; font-size:.75rem; } }
+    .method-link { align-self:flex-start; margin:0 1.9rem 1.9rem; border-color:var(--line-hi); color:var(--text); }
+    .method-link:hover { border-color:var(--accent); color:var(--accent); }
```

**File**: `website/src/styles/gallery.css` (modified, +22/-2)
```diff
@@ -200,7 +200,27 @@
     .card-link.primary:hover { color:#fff; }
     .section-intro h2 { font-size:clamp(2rem,4vw,3.25rem); }
     .community-callout { border-radius:20px; background:radial-gradient(ellipse 60% 120% at 0% 50%, rgba(52,211,153,.12), transparent 70%), #0b0e12; }
-    .method-code { border-radius:16px; box-shadow:0 40px 100px -50px rgba(255,106,43,.4); }
-    .pipeline { border-radius:16px; }
     @media (prefers-reduced-motion: reduce) { .showcase-card:hover, .showcase-card:hover .preview-shell iframe { transform:none; } .live-flag::before { animation:none; } }
     @media (max-width: 640px) { .preview-shell, .showcase-card.is-featured .preview-shell { height:320px; } }
+
+    /* ══ Build / submission receipt — a CI run read top to bottom beside its terminal ══ */
+    .method { position:relative; padding:7rem 0; border-top:1px solid var(--line); overflow:hidden; }
+    .method::before { content:''; position:absolute; inset:0 0 auto; height:1px; background:linear-gradient(90deg, transparent, rgba(52,211,153,.5), transparent); }
+    .method-grid { grid-template-columns:minmax(0,.85fr) minmax(0,1.15fr); gap:4rem; align-items:center; }
+    .method h2 { max-width:none; text-wrap:balance; font-size:clamp(2rem,3.6vw,3.25rem); line-height:1.04; letter-spacing:-.04em; }
+    .pipeline { position:relative; margin-top:2.5rem; gap:.5rem; background:none; border:0; border-radius:0; overflow:visible; }
+    .pipeline::before { content:''; position:absolute; left:19px; top:20px; bottom:20px; width:2px; border-radius:2px; background:linear-gradient(rgba(52,211,153,.7), rgba(52,211,153,.12)); }
+    .pipeline-step { grid-template-columns:40px 1fr auto; gap:1.1rem; min-height:48px; padding:0; background:none; }
+    .pipeline-num { position:relative; z-index:1; width:40px; height:40px; display:grid; place-items:center; border-radius:50%; border:1px solid rgba(52,211,153,.45); background:#0a0d11; color:var(--emerald); font-size:.6875rem; box-shadow:0 0 18px -6px rgba(52,211,153,.8); }
+    .pipeline-label { font-size:.9375rem; color:var(--text); }
+    .pipeline-state { padding:.3rem .6rem; border-radius:999px; background:rgba(52,211,153,.1); border:1px solid rgba(52,211,153,.25); font-size:.625rem; }
+    .pipeline-state.you { color:var(--text-2); background:rgba(238,241,243,.05); border-color:var(--line-hi); }
+    .pipeline-step:has(.you) .pipeline-num { color:var(--text-2); border-color:var(--line-hi); box-shadow:none; }
+    .method-code { position:relative; display:flex; flex-direction:column; border-radius:18px; border:1px solid var(--line-hi); background:#07090c; box-shadow:inset 0 1px 0 rgba(255,255,255,.05), 0 30px 80px -30px rgba(0,0,0,.8); }
+    .method-code::after { content:''; position:absolute; inset:-1px; border-radius:inherit; pointer-events:none; padding:1px; background:linear-gradient(140deg, rgba(52,211,153,.45), transparent 35%, transparent 70%, rgba(255,106,43,.35)); -webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite:xor; mask-composite:exclude; }
+    .method-code-bar { align-items:center; padding:.85rem 1.1rem .85rem 4.5rem; border-bottom-color:var(--line); color:var(--text-3);
+      background:radial-gradient(circle at 1.35rem 50%, #ff5f57 5px, transparent 5.5px), radial-gradient(circle at 2.35rem 50%, #febc2e 5px, transparent 5.5px), radial-gradient(circle at 3.35rem 50%, #28c840 5px, transparent 5.5px), rgba(238,241,243,.025); }
+    .method-code pre { flex:1; padding:1.75rem 1.9rem 2rem; color:rgba(238,241,243,.72); font:500 .8125rem/2 var(--font-mono); }
+    .method-code .accent { color:var(--accent); }
+    @media (max-width:960px) { .method { padding:5rem 0; } .method-grid { grid-template-columns:1fr; gap:2.75rem; } }
+    @media (max-width:640px) { .method-code pre { padding:1.25rem; font-size:.75rem; } }
```

#### Recent Merged Pull Requests:
- **PR #719** (2026-10-05): fix: guard owned temporary cleanup and await Chrome exit (@tt-a1i)
- **PR #718** (2026-10-05): docs(dsh): backport migration review and evidence checklist to main (@tt-a1i)
- **PR #717** (2026-10-05): docs(dsh): add host migration review and release evidence matrix (@tt-a1i)
- **PR #714** (2026-10-05): docs: backport community submissions and release checklist (@tt-a1i)
- **PR #713** (2026-10-05): docs: clarify community submissions and release completion (@tt-a1i)
- **PR #712** (2026-10-05): docs(dsh): promote verified 1.0.0 publication metadata (@tt-a1i)
- **PR #711** (2026-10-05): docs(dsh): publish 1.0.0 installation and compatibility guidance (@tt-a1i)
- **PR #710** (2026-10-04): release(dsh): prepare adapter 1.0.0 and published upgrade gate (@tt-a1i)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
