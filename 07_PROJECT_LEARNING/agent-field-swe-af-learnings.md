# Forensic Learning Record (Deep Inspection): Agent-Field/SWE-AF

> **Canonical Artifact**: `07_PROJECT_LEARNING/agent-field-swe-af-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Agent-Field/SWE-AF](https://github.com/Agent-Field/SWE-AF))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:41:31.783Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Agent-Field/SWE-AF`
- **Description**: Autonomous software engineering fleet of AI agents for production-grade PRs on AgentField: plan, code, test, and ship.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 1027 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/agent-comparison/evaluator/score.py`
```
#!/usr/bin/env python3
"""Deterministic scorer for the README benchmark rubric.

The benchmark table in the README scores five dimensions (Functional 30,
Structure 20, Hygiene 20, Git 15, Quality 15). Four of them are mechanical
properties of the generated project, so they should not require a human --
or trust in one. This script recomputes them from a project directory and
prints per-check evidence, so anyone can re-run the comparison on any
agent's output and get the same numbers.

What it will and will not do:

- Structure / Hygiene / Git (55 pts) are scored deterministically. Git
  checks need the project's real ``.git`` history; on the checked-in
  artifacts (history stripped when they were copied into examples/) they
  are reported as UNSCORABLE rather than silently zeroed.
- Functional (30 pts) is scored by actually running ``npm install`` and
  ``npm test``, opt-in via ``--run-tests`` because it executes the
  project's code.
- Quality (15 pts) is a judgment call. This script does not fake one: it
  reports observations (README, package metadata, custom error types) and
  assigns no points. A deterministic scorer that pretended to measure
  "quality" would just be an opinion with extra steps.

So a full run reports up to 85 recomputable points and clearly labels the
remaining 15 as judgment. Scores are only comparable when produced from
each agent's original output directory, including its ``.git``.

Usage:
    python score.py <project_dir> [--run-tests] [--json]

Exit code is 0 unless the directory is missing or not a project.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field, asdict
from pathlib import Path

SOURCE_DIRS = ("src", "lib", "bin")
TEST_DIRS = ("test", "tests", "__tests__")
JUNK_NAMES = (".DS_Store",)
JUNK_DIRS = ("node_modules", "coverage")
JUNK_GLOBS = ("*.log",)
# Files the todo-app prompt tends to leave behind: persisted runtime data.
JUNK_DATA = ("todos.json", "todo.json", "data.json")

TRIVIAL_SUBJECT = re.compile(r"^(wip|fix|update|tmp|temp|changes|stuff|misc)\.?$", re.I)


@dataclass
class Check:
    dimension: str
    name: str
    points: int
    # True = earned, False = not earned, None = unscorable in this context.
    passed: bool | None
    evidence: str


@dataclass
class Report:
    project: str
    checks: list[Check] = field(default_factory=list)
    observations: list[str] = field(default_factory=list)

    def add(self, dimension: str, name: str, points: int, passed: bool | None, evidence: str) -> None:
        self.checks.append(Check(dimension, name, points, passed, evidence))

    def earned(self) -> int:
        return sum(c.points for c in self.checks if c.passed is True)

    def scoreable(self) -> int:
        return sum(c.points for c in self.checks if c.passed is not None)


def _list_files(root: Path) -> list[Path]:
    out: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        # Prune everything JUNK_DIRS names, not a hand-picked subset: a
        # checked-in coverage/ must not be counted as project modules by
        # Structure while Hygiene docks it as junk — one directory, one verdict.
        dirnames[:] = [d for d in dirnames if d != ".git" and d not in JUNK_DIRS]
        for f in filenames:
            out.append(Path(dirpath, f).relative_to(root))
    return out


def _git(root: Path, *args: str) -> subprocess.CompletedProcess:
    # core.fsmonitor is cleared so scoring a repo can never execute a
    # repo-configured monitor daemon; a scorer must read the project, not
    # run it (running is what --run-tests opts into).
    cmd = ["git", "-c", "core.fsmonitor=", "-C", str(root), *args]
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except (FileNotFoundError, subprocess.TimeoutExpired) as e:
        # No git binary / a hung git is "couldn't look", not a property of
        # the project. Surface it as a failed CompletedProcess so every
        # caller's returncode check routes to UNSCORABLE with evidence.
        return subprocess.CompletedProcess(cmd, returncode=127, stdout="", stderr=str(e))


# ---------------------------------------------------------------- structure

def score_structure(root: Path, report: Report) -> None:
    files = _list_files(root)
    js_at_root = [f for f in files if f.parent == Path(".") and f.suffix in (".js", ".mjs", ".cjs", ".ts")]
    src_dirs = sorted({f.parts[0] for f in files if f.parts[0] in SOURCE_DIRS})
    test_dirs = sorted({f.parts[0] for f in files if f.parts[0] in TEST_DIRS})

    # Source lives in a dedicated directory, not flat at the project root.
    # A lone root cli.js entry point alongside a src/ dir is conventional and
    # does not count against it; three root modules and no src/ does.
    modular = bool(src_dirs) and len(js_at_root) <= 1
    report.add(
        "structure", "source in dedicated dir", 7, modular,
        f"source dirs: {src_dirs or 'none'}; root-level modules: {[str(f) for f in js_at_root] or 'none'}",
    )

    report.add(
        "structure", "tests in dedicated dir", 7, bool(test_dirs),
        f"test dirs: {test_dirs or 'none'}",
    )

    modules = [f for f in files if f.suffix in (".js", ".mjs", ".cjs", ".ts")
               and not any(part in TEST_DIRS for part in f.parts)]
    report.add(
        "structure", "more than one source module", 6, len(modules) >= 2,
        f"{len(modules)} source modules",
    )


# ------------------------------------------------------------------ hygiene

def _gitignore_covers(gitignore: Path, target: str) -> bool:
    """True when a non-comment line actually ignores `target`. A substring
    scan would award the points to a commented-out line."""
    for raw in gitignore.read_text(errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        # Normalize the common spellings: node_modules, /node_modules,
        # node_modules/, **/node_modules — all ignore the directory.
        normalized = line.strip("/")
        if normalized.startswith("**/"):
            normalized = normalized[3:]
        if normalized == target:
            return True
    return False


def score_hygiene(root: Path, report: Report) -> None:
    gitignore = root / ".gitignore"
    report.add("hygiene", ".gitignore exists", 5, gitignore.is_file(),
               "present" if gitignore.is_file() else "absent")

    covers = gitignore.is_file() and _gitignore_covers(gitignore, "node_modules")
    report.add(
        "hygiene", ".gitignore covers node_modules", 5,
        covers if gitignore.is_file() else False,
        "listed" if covers else "not listed (or no .gitignore)",
    )

    junk: list[str] = []
    for d in JUNK_DIRS:
        if (root / d).is_dir():
            junk.append(d + "/")
    files = _list_files(root)
    for f in files:
        if f.name in JUNK_NAMES or f.name in JUNK_DATA or any(f.match(g) for g in JUNK_GLOBS):
            junk.append(str(f))
    report.add(
        "hygiene", "no junk artifacts in tree", 5, not junk,
        f"junk found: {junk}" if junk else "clean",
    )

    if (root / ".git").exists():
        status = _git(root, "status", "--porcelain")
        if status.returncode != 0:
            # git missing/failed: empty stdout must not read as "clean".
            report.add("hygiene", "clean git status", 5, None,
                       f"UNSCORABLE: git status failed: {status.stderr.strip()[:200]}")
        else:
            dirty = status.stdout.strip()
            report.add(
                "hygiene", "clean git status", 5, not dirty,
                f"{len(dirty.splitlines())} dirty paths" if dirty else "clean",
            )
    else:
        report.add("hygiene", "clean git status", 5, None, "UNSCORABLE: no .git in this copy")


# ---------------------------------------------------------------------- git

def score_git(root: Path, report: Report) -> None:
    if not (root / ".git").exists():
        for name, pts in (("history has >= 3 commits", 5),
                          ("commit subjects are descriptive", 5),
                          ("no duplicated subjects", 5)):
            report.add("git", name, pts, None,
                       "UNSCORABLE: no .git in this copy — score from the agent's original output")
        return

    log = _git(root, "log", "--format=%s")
    if log.returncode != 0:
        for name, pts in (("history has >= 3 commits", 5),
                          ("commit subjects are descriptive", 5),
                          ("no duplicated subjects", 5)):
            report.add("git", name, pts, None, f"UNSCORABLE: git log failed: {log.stderr.strip()}")
        return

    subjects = [s for s in log.stdout.splitlines() if s.strip()]
    report.add("git", "history has >= 3 commits", 5, len(subjects) >= 3, f"{len(subjects)} commits")

    weak = [s for s in subjects if len(s) < 10 or TRIVIAL_SUBJECT.match(s.strip())]
    report.add(
        "git", "commit subjects are descriptive", 5, bool(subjects) and not weak,
        f"weak subjects: {weak}" if weak else "all subjects >= 10 chars and non-trivial",
    )

    dupes = sorted({s for s in subjects if subjects.count(s) > 1})
    report.add(
        "git", "no duplicated subjects", 5, bool(subjects) and not dupes,
        f"duplicated: {dupes}" if dupes else "all unique",
    )


# --------------------------------------------------------------- functional

def score_functional(root: Path, report: Report, run_tests: bool) -> None:
    if not run_tests:
        report.add("functional", "npm test passes", 30, None,
                   "NOT RUN: pass --run-tests to execute the project's own suite")
        return
    if not (root / "package.json").is_file():
        report.add("functional", "npm test passes", 30, False, "no package.json")
        return
    env = {**os.environ, "CI": "1"}
    try:
       
```

### Core Architecture Module: `examples/agent-comparison/swe-af-haiku/lib/utils.js`
```
/**
 * Validate a todo title.
 *
 * @param {string} title - The title to validate
 * @returns {{valid: boolean, error?: string}} - Validation result
 *   - If valid: {valid: true}
 *   - If invalid: {valid: false, error: "Todo title cannot be empty"}
 */
function validateTitle(title) {
  // Check if title is empty string or whitespace-only
  if (title.length === 0 || title.trim().length === 0) {
    return {
      valid: false,
      error: 'Todo title cannot be empty'
    };
  }
  return {
    valid: true
  };
}

/**
 * Format a todo object for display.
 *
 * @param {{id: number, title: string, completed: boolean}} todo - The todo to format
 * @returns {string} - Formatted string: "1 | Buy milk | [x]"
 */
function formatTodo(todo) {
  const status = todo.completed ? 'x' : ' ';
  return `${todo.id} | ${todo.title} | [${status}]`;
}

/**
 * Print usage information to stdout.
 *
 * @returns {void}
 */
function printHelp() {
  console.log('Usage: node cli.js <command> [arguments]');
  console.log('');
  console.log('Commands:');
  console.log('  add <title>       Create a new todo item');
  console.log('  list              Display all todo items');
  console.log('  complete <id>     Mark a todo as completed');
  console.log('  delete <id>       Delete a todo item');
  console.log('  --help            Show this message');
}

module.exports = {
  validateTitle,
  formatTodo,
  printHelp
};

```

### Core Architecture Module: `examples/diagrams/render_charts.js`
```
/**
 * render_charts.js — D3 + jsdom headless SVG renderer
 *
 * Usage: deno run --allow-read --allow-write render_charts.js <data.json> <output_dir>
 *
 * Reads pre-computed chart data from JSON and writes 14 SVG files.
 */

import * as d3 from "npm:d3@7";
import { JSDOM } from "npm:jsdom@25";

// ── Style constants (visx / Airbnb aesthetic) ────────────────────────
const W = 1200;
const H = 700;
const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const TITLE_SIZE = 18;
const LABEL_SIZE = 12;
const AXIS_COLOR = "#888";
const GRID_COLOR = "#f0f0f0";
const BG = "#fff";
const MARGIN = { top: 70, right: 50, bottom: 70, left: 100 };

// ── Helpers ──────────────────────────────────────────────────────────

function createSVG(w = W, h = H) {
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  const document = dom.window.document;
  const body = d3.select(document.body);

  const svg = body
    .append("svg")
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("viewBox", `0 0 ${w} ${h}`)
    .attr("width", w)
    .attr("height", h)
    .style("font-family", FONT);

  // white background
  svg.append("rect").attr("width", w).attr("height", h).attr("fill", BG);

  return {
    svg,
    serialize: () => body.html(),
  };
}

function addTitle(svg, text, w = W) {
  svg
    .append("text")
    .attr("x", w / 2)
    .attr("y", 35)
    .attr("text-anchor", "middle")
    .attr("font-size", TITLE_SIZE)
    .attr("font-weight", 700)
    .attr("fill", "#222")
    .text(text);
}

function addSubtitle(svg, text, w = W) {
  svg
    .append("text")
    .attr("x", w / 2)
    .attr("y", 55)
    .attr("text-anchor", "middle")
    .attr("font-size", 13)
    .attr("fill", "#666")
    .text(text);
}

function addXAxis(svg, scale, y, label, w = W) {
  const g = svg
    .append("g")
    .attr("transform", `translate(0,${y})`);

  const axis = d3.axisBottom(scale).ticks(8);
  g.call(axis);
  g.selectAll("line").attr("stroke", AXIS_COLOR);
  g.selectAll("path").attr("stroke", AXIS_COLOR);
  g.selectAll("text").attr("fill", AXIS_COLOR).attr("font-size", 11);

  if (label) {
    svg
      .append("text")
      .attr("x", (MARGIN.left + w - MARGIN.right) / 2)
      .attr("y", y + 45)
      .attr("text-anchor", "middle")
      .attr("font-size", LABEL_SIZE)
      .attr("fill", "#555")
      .text(label);
  }
}

function addYAxis(svg, scale, x, label) {
  const g = svg
    .append("g")
    .attr("transform", `translate(${x},0)`);

  const axis = d3.axisLeft(scale).ticks(6);
  g.call(axis);
  g.selectAll("line").attr("stroke", AXIS_COLOR);
  g.selectAll("path").attr("stroke", AXIS_COLOR);
  g.selectAll("text").attr("fill", AXIS_COLOR).attr("font-size", 11);

  if (label) {
    svg
      .append("text")
      .attr("transform", `rotate(-90)`)
      .attr("x", -(MARGIN.top + H - MARGIN.bottom) / 2)
      .attr("y", x - 45)
      .attr("text-anchor", "middle")
      .attr("font-size", LABEL_SIZE)
      .attr("fill", "#555")
      .text(label);
  }
}

function addGridY(svg, scale, x0, x1) {
  const ticks = scale.ticks(6);
  ticks.forEach((t) => {
    svg
      .append("line")
      .attr("x1", x0)
      .attr("x2", x1)
      .attr("y1", scale(t))
      .attr("y2", scale(t))
      .attr("stroke", GRID_COLOR)
      .attr("stroke-width", 1);
  });
}

function addGridX(svg, scale, y0, y1) {
  const ticks = scale.ticks(8);
  ticks.forEach((t) => {
    svg
      .append("line")
      .attr("x1", scale(t))
      .attr("x2", scale(t))
      .attr("y1", y0)
      .attr("y2", y1)
      .attr("stroke", GRID_COLOR)
      .attr("stroke-width", 1);
  });
}

function truncate(s, maxLen = 20) {
  return s.length > maxLen ? s.slice(0, maxLen - 1) + "…" : s;
}

// ── Chart 01: Cost Allocation Treemap ────────────────────────────────
function chart01(data, palette) {
  const { svg, serialize } = createSVG();
  addTitle(svg, "Where does the money go?");

  const root = d3
    .hierarchy({ children: data.cost_treemap })
    .sum((d) => d.cost_usd);

  d3.treemap()
    .size([W - 40, H - 90])
    .padding(3)
    .round(true)(root);

  const g = svg.append("g").attr("transform", "translate(20,70)");

  g.selectAll("rect")
    .data(root.leaves())
    .join("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("fill", (d) => palette[d.data.category] || "#888")
    .attr("rx", 4)
    .attr("opacity", 0.9);

  g.selectAll("text.name")
    .data(root.leaves())
    .join("text")
    .attr("class", "name")
    .attr("x", (d) => d.x0 + 6)
    .attr("y", (d) => d.y0 + 18)
    .attr("font-size", (d) => {
      const area = (d.x1 - d.x0) * (d.y1 - d.y0);
      return area > 15000 ? 13 : area > 5000 ? 11 : 9;
    })
    .attr("fill", "#fff")
    .attr("font-weight", 600)
    .text((d) => {
      const w = d.x1 - d.x0;
      return w > 60 ? d.data.category : "";
    });

  g.selectAll("text.val")
    .data(root.leaves())
    .join("text")
    .attr("class", "val")
    .attr("x", (d) => d.x0 + 6)
    .attr("y", (d) => d.y0 + 34)
    .attr("font-size", 11)
    .attr("fill", "rgba(255,255,255,0.85)")
    .text((d) => {
      const w = d.x1 - d.x0;
      return w > 60 ? `$${d.data.cost_usd.toFixed(2)}` : "";
    });

  return serialize();
}

// ── Chart 02: Time Allocation Treemap ────────────────────────────────
function chart02(data, palette) {
  const { svg, serialize } = createSVG();
  addTitle(svg, "Where does the time go?");

  const root = d3
    .hierarchy({ children: data.time_treemap })
    .sum((d) => d.duration_min);

  d3.treemap()
    .size([W - 40, H - 90])
    .padding(3)
    .round(true)(root);

  const g = svg.append("g").attr("transform", "translate(20,70)");

  g.selectAll("rect")
    .data(root.leaves())
    .join("rect")
    .attr("x", (d) => d.x0)
    .attr("y", (d) => d.y0)
    .attr("width", (d) => d.x1 - d.x0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("fill", (d) => palette[d.data.category] || "#888")
    .attr("rx", 4)
    .attr("opacity", 0.9);

  g.selectAll("text.name")
    .data(root.leaves())
    .join("text")
    .attr("class", "name")
    .attr("x", (d) => d.x0 + 6)
    .attr("y", (d) => d.y0 + 18)
    .attr("font-size", (d) => {
      const area = (d.x1 - d.x0) * (d.y1 - d.y0);
      return area > 15000 ? 13 : area > 5000 ? 11 : 9;
    })
    .attr("fill", "#fff")
    .attr("font-weight", 600)
    .text((d) => {
      const w = d.x1 - d.x0;
      return w > 60 ? d.data.category : "";
    });

  g.selectAll("text.val")
    .data(root.leaves())
    .join("text")
    .attr("class", "val")
    .attr("x", (d) => d.x0 + 6)
    .attr("y", (d) => d.y0 + 34)
    .attr("font-size", 11)
    .attr("fill", "rgba(255,255,255,0.85)")
    .text((d) => {
      const w = d.x1 - d.x0;
      return w > 60 ? `${d.data.duration_min.toFixed(1)}m` : "";
    });

  return serialize();
}

// ── Chart 03: Burn Rate (Area) ───────────────────────────────────────
function chart03(data) {
  const { svg, serialize } = createSVG();
  addTitle(svg, "How fast are we spending?");

  const pts = data.burn_rate;
  const xMax = d3.max(pts, (d) => d.elapsed_min);
  const yMax = d3.max(pts, (d) => d.cum_cost);

  const x = d3.scaleLinear().domain([0, xMax]).range([MARGIN.left, W - MARGIN.right]);
  const y = d3.scaleLinear().domain([0, yMax * 1.05]).range([H - MARGIN.bottom, MARGIN.top]);

  addGridY(svg, y, MARGIN.left, W - MARGIN.right);
  addGridX(svg, x, MARGIN.top, H - MARGIN.bottom);

  const area = d3
    .area()
    .x((d) => x(d.elapsed_min))
    .y0(H - MARGIN.bottom)
    .y1((d) => y(d.cum_cost));

  svg
    .append("path")
    .datum(pts)
    .attr("d", area)
    .attr("fill", "rgba(225,87,89,0.15)");

  const line = d3
    .line()
    .x((d) => x(d.elapsed_min))
    .y((d) => y(d.cum_cost));

  svg
    .append("path")
    .datum(pts)
    .attr("d", line)
    .attr("fill", "none")
    .attr("stroke", "#e15759")
    .attr("stroke-width", 2.5);

  addXAxis(svg, x, H - MARGIN.bottom, "Elapsed time (minutes)");
  addYAxis(svg, y, MARGIN.left, "Cumulative cost (USD)");

  return serialize();
}

// ── Chart 04: Parallelism (Step Area) ────────────────────────────────
function chart04(data) {
  const { svg, serialize } = createSVG();
  addTitle(svg, "How many agents run at once?");

  const pts = data.parallelism;
  const xMax = d3.max(pts, (d) => d.time_min);
  const yMax = d3.max(pts, (d) => d.concurrent);

  const x = d3.scaleLinear().domain([0, xMax]).range([MARGIN.left, W - MARGIN.right]);
  const y = d3.scaleLinear().domain([0, yMax + 1]).range([H - MARGIN.bottom, MARGIN.top]);

  addGridY(svg, y, MARGIN.left, W - MARGIN.right);

  const area = d3
    .area()
    .curve(d3.curveStepAfter)
    .x((d) => x(d.time_min))
    .y0(H - MARGIN.bottom)
    .y1((d) => y(d.concurrent));

  svg
    .append("path")
    .datum(pts)
    .attr("d", area)
    .attr("fill", "rgba(78,121,167,0.2)");

  const line = d3
    .line()
    .curve(d3.curveStepAfter)
    .x((d) => x(d.time_min))
    .y((d) => y(d.concurrent));

  svg
    .append("path")
    .datum(pts)
    .attr("d", line)
    .attr("fill", "none")
    .attr("stroke", "#4e79a7")
    .attr("stroke-width", 2);

  addXAxis(svg, x, H - MARGIN.bottom, "Elapsed time (minutes)");
  addYAxis(svg, y, MARGIN.left, "Concurrent agents");

  return serialize();
}

// ── Chart 05: Cost Efficiency Bubble ─────────────────────────────────
function chart05(data, palette) {
  const { svg, serialize } = createSVG();
  addTitle(svg, "Which phases cost the most per minute?");
  addSubtitle(svg, "bubble size = $/min");

  const pts = data.cost_efficiency;
  const xMax = d3.max(pts, (d) => d.total_min);
  const yMax = d3.max(pts, (d) => d.total_cost);
  const rMax = d3.max(pts, (d) => d.cost_per_min);

  const x = d3.scaleLinear().domain([0, xMax * 1.1]).range([MARGIN.left, W - MARGIN.right]);
  const y = d3.scaleLinear().domain([0, yMax * 1.1]).range([H - MARGIN.bottom, MARGIN.top]);
  const r = d3.sca
```

### Core Architecture Module: `go/internal/coding/loop.go`
```
// Package coding is the INNER loop of the three-nested-loop architecture: it
// runs a single issue through coder -> reviewer (or coder -> QA + reviewer ->
// synthesizer) up to max_coding_iterations, returning an IssueResult with the
// final outcome and full iteration history.
//
// It is a 1:1 behavioural port of swe_af/execution/coding_loop.py. Two paths:
//   - DEFAULT (most issues): coder -> reviewer (2 role calls). Reviewer is the
//     sole gatekeeper.
//   - FLAGGED (complex/risky): coder -> QA + reviewer (concurrent) -> synthesizer
//     (4 role calls). Selected when the sprint planner sets
//     guidance.needs_deeper_qa = true.
//
// All AI-agent invocations go through the injected CallFn seam (a closure over
// agent.Call + envelope.UnwrapCallResult supplied by the DAG executor), so the
// loop stays testable with a scripted call function and the exact keyword-arg
// key names Python passes to each role are preserved verbatim.
package coding

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/Agent-Field/SWE-AF/go/internal/config"
	"github.com/Agent-Field/SWE-AF/go/internal/fatal"
	"github.com/Agent-Field/SWE-AF/go/internal/schemas"
	"golang.org/x/sync/errgroup"
)

// CallFn dispatches to an AI agent (coder, reviewer, QA, synthesizer) by target
// (e.g. "swe-planner.run_coder") with the same keyword args Python passes. The
// DAG executor supplies a closure over agent.Call + envelope.UnwrapCallResult;
// tests supply a scripted function. A returned *fatal.FatalHarnessError is
// propagated (never swallowed into a fallback).
type CallFn func(ctx context.Context, target string, kwargs map[string]any) (map[string]any, error)

// MemoryFn is the shared-memory seam (in-process cross-issue learning). action
// is "get" or "set"; value is nil for "get". A nil MemoryFn disables learning
// (mirrors the Python `memory_fn is None` guard).
type MemoryFn func(action, key string, value any) any

// NoteFn is the fire-and-forget observability seam (app.Note-equivalent). A nil
// NoteFn is a no-op.
type NoteFn func(msg string, tags []string)

// RunCodingLoop runs the coding loop for a single issue and returns its
// IssueResult. It is the Go port of coding_loop.run_coding_loop.
//
// The returned error is non-nil ONLY for propagated failures that Python would
// re-raise rather than turn into a failed IssueResult: a fatal, non-retryable
// harness error (*fatal.FatalHarnessError) or context cancellation. Every other
// terminal condition (approve, block, stuck, exhaustion, coder failure) is
// encoded in the IssueResult with err == nil.
func RunCodingLoop(
	ctx context.Context,
	issue map[string]any,
	dagState *schemas.DAGState,
	callFn CallFn,
	nodeID string,
	cfg *config.ExecutionConfig,
	noteFn NoteFn,
	memoryFn MemoryFn,
) (schemas.IssueResult, error) {
	// note is a nil-safe wrapper so call sites need no guard (mirrors the
	// pervasive `if note_fn:` checks in Python).
	note := func(msg string, tags []string) {
		if noteFn != nil {
			noteFn(msg, tags)
		}
	}

	issueName := mapGetStr(issue, "name", "unknown")

	worktreePath := dagState.RepoPath // issue.get("worktree_path", dag_state.repo_path)
	if v, ok := issue["worktree_path"]; ok {
		worktreePath = anyToStr(v)
	}
	branchName := mapGetStr(issue, "branch_name", "")
	maxIterations := cfg.MaxCodingIterations
	timeout := cfg.AgentTimeoutSeconds
	permissionMode := cfg.PermissionMode

	// Multi-repo context (nil for single-repo builds).
	targetRepo := mapGetStr(issue, "target_repo", "")
	wsManifestDict := dagState.WorkspaceManifest // map[string]any | nil

	// Warn if a multi-repo issue is missing worktree_path (falling back to
	// primary repo).
	if isTruthy(wsManifestDict) && !isTruthy(issue["worktree_path"]) {
		note(
			fmt.Sprintf(
				"WARNING: issue '%s' has no worktree_path in multi-repo mode. "+
					"Falling back to primary repo: %s. target_repo='%s'",
				issueName, dagState.RepoPath, targetRepo,
			),
			[]string{"coding_loop", "warning", "multi_repo_fallback"},
		)
	}

	// Extract guidance — determines execution path.
	guidance, _ := issue["guidance"].(map[string]any) // issue.get("guidance") or {}
	needsDeeperQA := mapGetBool(guidance, "needs_deeper_qa", false)

	// Slim project context — paths only, agents read files if needed.
	projectContext := map[string]any{
		"prd_path":          dagState.PRDPath,
		"architecture_path": dagState.ArchitecturePath,
		"artifacts_dir":     dagState.ArtifactsDir,
		"issues_dir":        dagState.IssuesDir,
		"repo_path":         dagState.RepoPath,
	}

	pathLabel := "DEFAULT (reviewer only)"
	if needsDeeperQA {
		pathLabel = "FLAGGED (QA+reviewer+synth)"
	}
	note(
		fmt.Sprintf("Coding loop starting: %s [%s] (max %d iterations)", issueName, pathLabel, maxIterations),
		[]string{"coding_loop", "start", issueName},
	)

	feedback := ""
	iterationHistory := []map[string]any{}
	filesChanged := []string{}
	startIteration := 1
	isFirstSuccess := len(dagState.CompletedIssues) == 0

	// Resume from iteration checkpoint if available.
	if existingState := loadIterationState(dagState.ArtifactsDir, issueName, dagState.BuildID); existingState != nil {
		startIteration = toInt(existingState["iteration"]) + 1
		feedback = mapGetStr(existingState, "feedback", "")
		if fc := toStringSlice(existingState["files_changed"]); fc != nil {
			filesChanged = fc
		}
		if ih := toMapSlice(existingState["iteration_history"]); ih != nil {
			iterationHistory = ih
		}
		note(
			fmt.Sprintf("Resuming %s from iteration %d", issueName, startIteration),
			[]string{"coding_loop", "resume", issueName},
		)
	}

	// reviewResult persists past the loop for the exhaustion check (Python:
	// `review_result if 'review_result' in dir() else None`).
	var reviewResult map[string]any

	for iteration := startIteration; iteration <= maxIterations; iteration++ {
		// Honor cancellation between iterations.
		select {
		case <-ctx.Done():
			return schemas.IssueResult{}, ctx.Err()
		default:
		}

		iterationID := newIterationID()

		note(
			fmt.Sprintf("Coding loop iteration %d/%d: %s", iteration, maxIterations, issueName),
			[]string{"coding_loop", "iteration", issueName},
		)

		// --- Read shared memory context ---
		memoryContext := readMemoryContext(memoryFn, issue)

		// --- 1. CODER ---
		coderResult, cerr := callWithTimeout(ctx, timeout, fmt.Sprintf("coder:%s:iter%d", issueName, iteration),
			func(c context.Context) (map[string]any, error) {
				return callFn(c, nodeID+".run_coder", map[string]any{
					"issue":              issue,
					"worktree_path":      worktreePath,
					"feedback":           feedback,
					"iteration":          iteration,
					"iteration_id":       iterationID,
					"project_context":    projectContext,
					"memory_context":     memoryContext,
					"model":              cfg.CoderModel(),
					"permission_mode":    permissionMode,
					"ai_provider":        cfg.AIProvider(),
					"workspace_manifest": wsManifestDict,
					"target_repo":        targetRepo,
				})
			})
		if cerr != nil {
			var fhe *fatal.FatalHarnessError
			if errors.As(cerr, &fhe) || errors.Is(cerr, context.Canceled) {
				return schemas.IssueResult{}, cerr // propagate (FatalHarnessError / cancellation)
			}
			note(
				fmt.Sprintf("Coder agent failed: %s iter %d: %v", issueName, iteration, cerr),
				[]string{"coding_loop", "coder_error", issueName},
			)
			return schemas.IssueResult{
				IssueName:        issueName,
				Outcome:          schemas.IssueOutcomeFailedUnrecoverable,
				ErrorMessage:     fmt.Sprintf("Coder agent failed on iteration %d: %v", iteration, cerr),
				ErrorContext:     fmt.Sprintf("%v", cerr),
				FilesChanged:     filesChanged,
				BranchName:       branchName,
				Attempts:         iteration,
				IterationHistory: iterationHistory,
			}, nil
		}

		// Track files changed across iterations.
		for _, f := range toStringSlice(coderResult["files_changed"]) {
			if !contains(filesChanged, f) {
				filesChanged = append(filesChanged, f)
			}
		}

		saveArtifact(dagState.ArtifactsDir, iterationID, "coder", coderResult)

		// --- 2. PATH BRANCH ---
		var action, summary string
		var qaResult, synthesisResult map[string]any
		stuck := false

		if needsDeeperQA {
			// FLAGGED PATH: QA + reviewer parallel -> synthesizer.
			a, s, rr, qr, sr, perr := runFlaggedPath(ctx, callFn, nodeID, worktreePath, coderResult,
				issue, iteration, iterationID, iterationHistory, projectContext, memoryContext,
				cfg, timeout, issueName, note, wsManifestDict, targetRepo)
			if perr != nil {
				return schemas.IssueResult{}, perr // fatal — propagate
			}
			action, summary, reviewResult, qaResult, synthesisResult = a, s, rr, qr, sr
			saveArtifact(dagState.ArtifactsDir, iterationID, "qa", qaResult)
			saveArtifact(dagState.ArtifactsDir, iterationID, "review", reviewResult)
			saveArtifact(dagState.ArtifactsDir, iterationID, "synthesis", synthesisResult)

			stuck = mapGetBool(synthesisResult, "stuck", false)
		} else {
			// DEFAULT PATH: reviewer only.
			a, s, rr, perr := runDefaultPath(ctx, callFn, nodeID, worktreePath, coderResult,
				issue, iterationID, projectContext, memoryContext, cfg, timeout, issueName, note,
				wsManifestDict, targetRepo)
			if perr != nil {
				return schemas.IssueResult{}, perr // fatal — propagate
			}
			action, summary, reviewResult = a, s, rr
			qaResult = nil
			synthesisResult = nil
			saveArtifact(dagState.ArtifactsDir, iterationID, "review", reviewResult)

			stuck = false
		}

		// Record iteration for history.
		var qaPassed any
		if isTruthy(qaResult) {
			qaPassed = qaResult["passed"] // .get("passed", None)
		}
		iterationHistory = append(iterationHistory, map[string]any{
			"iteration":       iteration,
			"action":          action,
			"summary":         summary,
			"qa_passed":       qaPassed,
			"review_approved": isTruthy(reviewResult) && mapGetBool(reviewResult, "approved", false),
			"review_blocking": isTruthy(reviewResult) && mapGetBool(reviewResult, "blocking", false),
			"path":
```

### Core Architecture Module: `go/internal/dagutil/dagutil.go`
```
// Package dagutil holds the pure DAG-manipulation helpers used by the execution
// engine and the planning pipeline. It is a verbatim port of
// swe_af/execution/dag_utils.py plus the pure helpers from
// swe_af/reasoners/pipeline.py (_ensure_paths, _compute_levels,
// _validate_file_conflicts, _assign_sequence_numbers).
//
// Ordering semantics match Python exactly: Python dicts preserve insertion
// order, so this package uses order-tracking slices (never bare Go maps) to
// keep level partitioning, sequence numbering, and conflict reporting
// deterministic and byte-compatible with the Python implementation.
package dagutil

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/Agent-Field/SWE-AF/go/internal/schemas"
)

// ---------------------------------------------------------------------------
// Small value-extraction helpers (issue dicts are map[string]any after JSON
// unmarshalling, so fields arrive as any and must be coerced).
// ---------------------------------------------------------------------------

// issueName returns the "name" field of an issue dict as a string ("" if
// absent or not a string), mirroring Python's issue["name"] usage.
func issueName(issue map[string]any) string {
	return asString(issue["name"])
}

func asString(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// dependsOn returns the "depends_on" list of an issue dict as []string,
// mirroring Python's issue.get("depends_on", []).
func dependsOn(issue map[string]any) []string {
	return asStringSlice(issue["depends_on"])
}

func asStringSlice(v any) []string {
	switch t := v.(type) {
	case []string:
		return t
	case []any:
		out := make([]string, 0, len(t))
		for _, e := range t {
			out = append(out, asString(e))
		}
		return out
	case string:
		// LLM shape tolerance (ports ensure_str_list): a bare string where a
		// list is expected becomes a one-element list instead of vanishing.
		if strings.TrimSpace(t) == "" {
			return nil
		}
		return []string{t}
	default:
		return nil
	}
}

// issueListFields are the issue-dict fields that must be list[str]. Ports
// dag_utils._ISSUE_LIST_FIELDS.
var issueListFields = []string{
	"acceptance_criteria", "depends_on", "provides",
	"files_to_create", "files_to_modify",
}

// NormalizeIssueDict coerces LLM-emitted scalar shapes on a raw issue dict, in
// place. Ports dag_utils.normalize_issue_dict: raw issue dicts bypass schema
// validation (DAGState.AllIssues is []map[string]any), so a bare-string
// acceptance criterion survives until something re-validates the state — a
// checkpoint reload or the replanner's DAGState — and kills the build long
// after the cheap moment to catch it. Normalize at ingestion.
func NormalizeIssueDict(issue map[string]any) map[string]any {
	for _, field := range issueListFields {
		v, ok := issue[field]
		if !ok {
			continue
		}
		switch t := v.(type) {
		case string:
			if strings.TrimSpace(t) == "" {
				issue[field] = []string{}
			} else {
				issue[field] = []string{t}
			}
		case nil:
			issue[field] = []string{}
		}
	}
	return issue
}

// asInt coerces a value to an int, treating absent/None/non-numeric as 0.
// JSON numbers arrive as float64; ints/int64 are also accepted. This mirrors
// Python's `x or 0` truthiness where 0/None both become 0.
func asInt(v any) int {
	switch t := v.(type) {
	case int:
		return t
	case int64:
		return int(t)
	case float64:
		return int(t)
	case float32:
		return int(t)
	default:
		return 0
	}
}

// pyListRepr renders a list of strings the way Python's f-string renders a
// list — e.g. ['a', 'b'] — so cycle-error messages are byte-identical.
func pyListRepr(names []string) string {
	out := "["
	for i, n := range names {
		if i > 0 {
			out += ", "
		}
		out += "'" + n + "'"
	}
	out += "]"
	return out
}

// ---------------------------------------------------------------------------
// Level computation (Kahn's algorithm)
// ---------------------------------------------------------------------------

// RecomputeLevels performs a topological sort (Kahn's algorithm) treating
// completed issues as resolved. It is the verbatim port of
// dag_utils.recompute_levels.
//
// remainingIssues are the issue dicts that still need execution (each has
// "name" and "depends_on" keys). completedNames is the set of issue names
// already successfully completed; dependencies on those are treated as
// satisfied. Returns the list of levels (each a list of names that may run
// concurrently), or an error if the remaining issues contain a cycle.
func RecomputeLevels(remainingIssues []map[string]any, completedNames map[string]bool) ([][]string, error) {
	nameSet := make(map[string]bool, len(remainingIssues))
	order := make([]string, 0, len(remainingIssues))
	inDegree := make(map[string]int, len(remainingIssues))
	for _, issue := range remainingIssues {
		name := issueName(issue)
		nameSet[name] = true
		if _, seen := inDegree[name]; !seen {
			order = append(order, name)
		}
		inDegree[name] = 0
	}

	dependents := make(map[string][]string)
	for _, issue := range remainingIssues {
		name := issueName(issue)
		for _, dep := range dependsOn(issue) {
			// Only count deps that are in the remaining set (not completed).
			if nameSet[dep] && !completedNames[dep] {
				inDegree[name]++
				dependents[dep] = append(dependents[dep], name)
			}
		}
	}

	return kahn(order, inDegree, dependents, len(remainingIssues))
}

// ComputeLevels is the verbatim port of pipeline._compute_levels: a
// topological sort of issues into parallel execution levels, with no notion of
// completed issues (all in-set dependencies count). Raises an error on cycles.
func ComputeLevels(issues []map[string]any) ([][]string, error) {
	nameSet := make(map[string]bool, len(issues))
	order := make([]string, 0, len(issues))
	inDegree := make(map[string]int, len(issues))
	for _, issue := range issues {
		name := issueName(issue)
		nameSet[name] = true
		if _, seen := inDegree[name]; !seen {
			order = append(order, name)
		}
		inDegree[name] = 0
	}

	dependents := make(map[string][]string)
	for _, issue := range issues {
		name := issueName(issue)
		for _, dep := range dependsOn(issue) {
			if nameSet[dep] {
				inDegree[name]++
				dependents[dep] = append(dependents[dep], name)
			}
		}
	}

	return kahn(order, inDegree, dependents, len(issues))
}

// kahn runs the shared BFS level-partitioning loop. order is the insertion
// order of node names (so the initial zero-in-degree queue matches Python's
// dict-order iteration), inDegree is the mutable in-degree map, dependents maps
// a node to nodes that depend on it, and total is the expected processed count.
func kahn(order []string, inDegree map[string]int, dependents map[string][]string, total int) ([][]string, error) {
	queue := make([]string, 0, len(order))
	for _, name := range order {
		if inDegree[name] == 0 {
			queue = append(queue, name)
		}
	}

	levels := [][]string{}
	processed := 0
	for len(queue) > 0 {
		level := queue
		levels = append(levels, level)
		processed += len(level)
		next := []string{}
		for _, name := range level {
			for _, depName := range dependents[name] {
				inDegree[depName]--
				if inDegree[depName] == 0 {
					next = append(next, depName)
				}
			}
		}
		queue = next
	}

	if processed != total {
		cycleNodes := []string{}
		for _, name := range order {
			if inDegree[name] > 0 {
				cycleNodes = append(cycleNodes, name)
			}
		}
		return nil, fmt.Errorf("Dependency cycle detected among issues: %s", pyListRepr(cycleNodes))
	}

	return levels, nil
}

// ---------------------------------------------------------------------------
// Downstream discovery
// ---------------------------------------------------------------------------

// FindDownstream returns the set of issue names that directly or indirectly
// depend on issueName. It does NOT include issueName itself. Verbatim port of
// dag_utils.find_downstream.
func FindDownstream(issueName string, allIssues []map[string]any) map[string]bool {
	// Build adjacency: issue -> list of issues that depend on it.
	dependents := make(map[string][]string)
	for _, issue := range allIssues {
		name := asString(issue["name"])
		for _, dep := range dependsOn(issue) {
			dependents[dep] = append(dependents[dep], name)
		}
	}

	// BFS from issueName.
	visited := make(map[string]bool)
	queue := append([]string{}, dependents[issueName]...)
	for len(queue) > 0 {
		name := queue[0]
		queue = queue[1:]
		if visited[name] {
			continue
		}
		visited[name] = true
		queue = append(queue, dependents[name]...)
	}

	return visited
}

// ---------------------------------------------------------------------------
// File-conflict validation
// ---------------------------------------------------------------------------

// ValidateFileConflicts detects file conflicts between issues scheduled at the
// same parallel level. For each level it collects files_to_create and
// files_to_modify across all issues; a file touched by more than one issue at
// the same level is reported as a conflict. Verbatim port of
// pipeline._validate_file_conflicts.
//
// Returns a list of conflict dicts, e.g.
// {"level": 0, "file": "src/ops.rs", "issues": ["arithmetic-ops", "logical-ops"]}.
// An empty (non-nil) slice means no conflicts.
func ValidateFileConflicts(issues []map[string]any, levels [][]string) []map[string]any {
	issueByName := make(map[string]map[string]any, len(issues))
	for _, issue := range issues {
		issueByName[issueName(issue)] = issue
	}

	conflicts := []map[string]any{}
	for levelIdx, levelNames := range levels {
		fileToIssues := make(map[string][]string)
		fileOrder := []string{}
		add := func(f, name string) {
			if _, seen := fileToIssues[f]; !seen {
				fileOrder = append(fileOrder, f)
			}
			fileToIssues[f] = append(fileToIssues[f], name)
		}
		for _, name := range levelNames {
			issue, ok := issueByName[name]
			if !ok {
				continue
			}
			for _, f := range asStringSlice(issue["files_to_create"]) {
				add(f, name)

```

### Core Architecture Module: `go/internal/orch/cigate_loop.go`
```
package orch

import (
	"context"
	"fmt"
)

// RunCIGate ports app.py:_run_ci_gate (:224-352): watch CI on the freshly-pushed
// PR and fix-repush on failure, up to cfg.max_ci_fix_cycles fix cycles. It
// satisfies the CIGateRunner seam in common.go; the node-wiring wave sets
// deps.CIGate = orch.RunCIGate so build() (and resolve()) drive the gate through
// it.
//
// The loop is bounded by cfg.MaxCIFixCycles+1 watch cycles (range(max+1) in
// Python): each cycle watches once; on a "failed" verdict it invokes the fixer
// and, if the fixer pushed, loops back to watch again. Terminal statuses are
// returned verbatim: passed | no_checks | timed_out | error | failed_exhausted |
// fixer_gave_up | loop_exhausted.
//
// The startup-grace sleep is NOT here: Python sleeps it in resolve() before
// calling _run_ci_gate (app.py:1887), and the Go resolve.go ports that sleep
// at its call site. The gate anchors every watch to req.HeadSHA verbatim —
// including after a fixer push — because Python passes the original head_sha
// on every cycle and never re-anchors to the fixer's commit_sha.
func RunCIGate(ctx context.Context, req CIGateRequest) (map[string]any, error) {
	deps := req.Deps
	cfg := req.Cfg
	headSHA := req.HeadSHA

	attempts := []map[string]any{}
	var lastWatch map[string]any

	for cycle := 0; cycle <= cfg.MaxCIFixCycles; cycle++ {
		deps.Note(ctx, fmt.Sprintf("CI gate: watch cycle %d for PR #%d", cycle+1, req.PRNumber),
			"ci_gate", "watch")
		watch, err := deps.Call(ctx, "run_ci_watcher", map[string]any{
			"repo_path":    req.RepoPath,
			"pr_number":    req.PRNumber,
			"wait_seconds": cfg.CIWaitSeconds,
			"poll_seconds": cfg.CIPollSeconds,
			"head_sha":     headSHA,
		}, "run_ci_watcher")
		if err != nil {
			return nil, err
		}
		lastWatch = watch
		status := mapStr(watch, "status", "error")

		if status == "passed" || status == "no_checks" {
			deps.Note(ctx, fmt.Sprintf("CI gate: %s — PR ready for review", status),
				"ci_gate", "ready")
			final := "no_checks"
			if status == "passed" {
				final = "passed"
			}
			return map[string]any{
				"final_status": final,
				"fix_attempts": attempts,
				"watch":        watch,
			}, nil
		}

		if status == "timed_out" || status == "error" {
			deps.Note(ctx, fmt.Sprintf(
				"CI gate: %s — PR stays open with failing checks. %s",
				status, mapStr(watch, "summary", "")),
				"ci_gate", status)
			return map[string]any{
				"final_status": status,
				"fix_attempts": attempts,
				"watch":        watch,
			}, nil
		}

		// status == "failed"
		if cycle >= cfg.MaxCIFixCycles {
			deps.Note(ctx, fmt.Sprintf(
				"CI gate: exhausted %d fix cycle(s) — PR stays open with failing checks",
				cfg.MaxCIFixCycles),
				"ci_gate", "exhausted")
			return map[string]any{
				"final_status": "failed_exhausted",
				"fix_attempts": attempts,
				"watch":        watch,
			}, nil
		}

		failedChecks := maps0(watch["failed_checks"])
		deps.Note(ctx, fmt.Sprintf(
			"CI gate: fix attempt %d/%d — %d failing check(s)",
			cycle+1, cfg.MaxCIFixCycles, len(failedChecks)),
			"ci_gate", "fix")

		// Model resolution ports app.py:326 exactly:
		// resolved.get("ci_fixer_model", resolved.get("coder_model", "")).
		// dict.get returns the value when the key is present (even ""), so we
		// fall back to coder_model only when ci_fixer_model is ABSENT.
		model, ok := req.Resolved["ci_fixer_model"]
		if !ok {
			model = req.Resolved["coder_model"]
		}

		fix, err := deps.Call(ctx, "run_ci_fixer", map[string]any{
			"repo_path":          req.RepoPath,
			"pr_number":          req.PRNumber,
			"pr_url":             req.PRURL,
			"integration_branch": req.IntegrationBranch,
			"base_branch":        req.BaseBranch,
			"failed_checks":      failedChecks,
			"iteration":          cycle + 1,
			"max_iterations":     cfg.MaxCIFixCycles,
			"goal":               req.Goal,
			"completed_issues":   req.CompletedIssues,
			"previous_attempts":  attempts,
			"model":              model,
			"permission_mode":    cfg.PermissionMode,
			"ai_provider":        cfg.AIProvider(),
		}, "run_ci_fixer")
		if err != nil {
			return nil, err
		}
		attempts = append(attempts, fix)

		if !asBool(fix["pushed"]) {
			deps.Note(ctx, fmt.Sprintf(
				"CI gate: fixer did not push (%s) — PR stays open with failing checks",
				mapStr(fix, "summary", "no summary")),
				"ci_gate", "fixer_no_push")
			return map[string]any{
				"final_status": "fixer_gave_up",
				"fix_attempts": attempts,
				"watch":        watch,
			}, nil
		}

		// Pushed — loop back and watch again with the ORIGINAL head_sha anchor
		// (Python passes head_sha=head_sha on every cycle and never re-anchors
		// to the fixer's commit). GitHub may take a moment to register the new
		// run; the watcher's poll covers that.
	}

	// Loop fell through (shouldn't happen because the failed branch returns).
	watch := lastWatch
	if watch == nil {
		watch = map[string]any{}
	}
	return map[string]any{
		"final_status": "loop_exhausted",
		"fix_attempts": attempts,
		"watch":        watch,
	}, nil
}

// Compile-time assertion that RunCIGate satisfies the CIGateRunner seam.
var _ CIGateRunner = RunCIGate

```

### Core Architecture Module: `go/internal/prompts/planning/utils.go`
```
// Package planning ports the planning-role prompt builders from
// swe_af/prompts/{_utils,product_manager,architect,tech_lead,sprint_planner,
// environment_scout}.py. Prompt text is verbatim; f-string interpolation is
// replicated exactly (including conditional blocks and trailing whitespace).
package planning

import (
	"fmt"
	"sort"
	"strings"

	"github.com/Agent-Field/SWE-AF/go/internal/schemas"
)

// WorkspaceContextBlock ports _utils.workspace_context_block.
//
// Returns an empty string when the manifest is nil or contains only a single
// repository (no additional context needed for single-repo workflows). For
// multi-repo workspaces, returns a formatted block describing each repository's
// name, role, and absolute path on disk.
func WorkspaceContextBlock(manifest *schemas.WorkspaceManifest) string {
	if manifest == nil {
		return ""
	}

	repos := manifest.Repos
	if len(repos) <= 1 {
		return ""
	}

	lines := []string{
		"## Workspace Repositories",
		"",
		"This task spans multiple repositories. Each repository is listed below with its role and local path:",
		"",
	}

	for _, repo := range repos {
		lines = append(lines, fmt.Sprintf("- **%s** (role: %s): `%s`", repo.RepoName, repo.Role, repo.AbsolutePath))
	}

	lines = append(lines, "")

	return strings.Join(lines, "\n")
}

// FormatPriorUserResponses ports hitl.ask_user.format_prior_user_responses.
//
// It is defined here (rather than imported from the hitl package) so the
// planning prompt subpackage builds independently; product_manager and
// environment_scout both need it. Exported so sibling prompt subpackages can
// reuse it.
//
// NOTE: Python renders the per-response `values` dict in JSON insertion order.
// A Go map[string]any cannot preserve that order, so keys are emitted in sorted
// order here — deterministic, but for multi-key `values` it may differ from the
// Python ordering. Single-key values (the common case) render identically.
func FormatPriorUserResponses(prior []map[string]any) string {
	if len(prior) == 0 {
		return ""
	}
	lines := []string{"## Prior Clarification From User", ""}
	for idx, entry := range prior {
		question := mapStringDefault(entry, "question", "(no title)")
		status := mapStringDefault(entry, "status", "unknown")
		lines = append(lines, fmt.Sprintf("### Question %d: %s", idx+1, question))
		lines = append(lines, fmt.Sprintf("_Status: %s_", status))
		values := mapObject(entry, "values")
		if len(values) > 0 {
			lines = append(lines, "")
			lines = append(lines, "Values submitted by user:")
			keys := make([]string, 0, len(values))
			for key := range values {
				keys = append(keys, key)
			}
			sort.Strings(keys)
			for _, key := range keys {
				lines = append(lines, fmt.Sprintf("- **%s**: %v", key, values[key]))
			}
		}
		if feedback, ok := entry["feedback"]; ok && truthy(feedback) {
			lines = append(lines, "")
			lines = append(lines, fmt.Sprintf("User feedback: %v", feedback))
		}
		lines = append(lines, "")
	}
	lines = append(lines, "USE THESE PRIOR ANSWERS. DO NOT RE-ASK THE SAME QUESTIONS. Only "+
		"emit `ask_user_form` if you need DIFFERENT clarification not already "+
		"covered above.")
	return strings.Join(lines, "\n")
}

// KnownServiceSummaryForPrompt ports hitl.services.known_service_summary_for_prompt.
//
// Defined here so environment_scout builds independently; exported for reuse.
func KnownServiceSummaryForPrompt(specs []schemas.ServiceCredentialSpec) string {
	var lines []string
	for _, spec := range specs {
		signals := "(no static signal)"
		if len(spec.SignalFiles) > 0 {
			parts := make([]string, len(spec.SignalFiles))
			for i, s := range spec.SignalFiles {
				parts[i] = "`" + s + "`"
			}
			signals = strings.Join(parts, ", ")
		}
		lines = append(lines, fmt.Sprintf(
			"- **%s** — env `%s`; signals: %s; mint at %s; hint: %s",
			spec.ServiceName, spec.EnvVarName, signals, spec.MintURL, spec.PermissionsHint))
	}
	return strings.Join(lines, "\n")
}

// mapStringDefault returns m[key] as a string, or def if absent/not a string.
// Mirrors Python dict.get(key, default) followed by str-formatting.
func mapStringDefault(m map[string]any, key, def string) string {
	if v, ok := m[key]; ok && v != nil {
		return fmt.Sprintf("%v", v)
	}
	return def
}

// mapObject returns m[key] as a map[string]any, or nil if absent/not an object.
func mapObject(m map[string]any, key string) map[string]any {
	if v, ok := m[key]; ok {
		if obj, ok := v.(map[string]any); ok {
			return obj
		}
	}
	return nil
}

// mapString returns m[key] coerced to a string via Python-like `.get(key, "") or ""`.
func mapString(m map[string]any, key string) string {
	if v, ok := m[key]; ok && v != nil {
		return fmt.Sprintf("%v", v)
	}
	return ""
}

// mapStringSlice returns m[key] as a []string, handling []any and []string.
// Mirrors Python `.get(key, []) or []`.
func mapStringSlice(m map[string]any, key string) []string {
	v, ok := m[key]
	if !ok || v == nil {
		return nil
	}
	switch xs := v.(type) {
	case []string:
		return xs
	case []any:
		out := make([]string, 0, len(xs))
		for _, item := range xs {
			out = append(out, fmt.Sprintf("%v", item))
		}
		return out
	}
	return nil
}

// joinBullets renders `"\n".join(f"- {c}" for c in items)`; "" for an empty slice.
func joinBullets(items []string) string {
	if len(items) == 0 {
		return ""
	}
	parts := make([]string, len(items))
	for i, c := range items {
		parts[i] = "- " + c
	}
	return strings.Join(parts, "\n")
}

// truthy replicates Python truthiness for the value types found in prompt
// inputs (nil, string, bool, numbers, slices, maps).
func truthy(v any) bool {
	switch x := v.(type) {
	case nil:
		return false
	case string:
		return x != ""
	case bool:
		return x
	case int:
		return x != 0
	case int64:
		return x != 0
	case float64:
		return x != 0
	case []any:
		return len(x) > 0
	case []string:
		return len(x) > 0
	case map[string]any:
		return len(x) > 0
	default:
		return true
	}
}

```

### Core Architecture Module: `swe_af/execution/coding_loop.py`
```
"""Per-issue coding loop: coder → reviewer (or QA/reviewer/synthesizer).

This is the INNER loop in the three-nested-loop architecture:
  - INNER (this): coder → review → approve/fix/block
  - MIDDLE: issue advisor diagnoses failures → adapt ACs/approach/scope
  - OUTER: replanner restructures DAG after unrecoverable failures

Two execution paths:
  - DEFAULT (most issues): coder → reviewer (2 LLM calls)
  - FLAGGED (complex/risky): coder → QA + reviewer → synthesizer (4 LLM calls)

The sprint planner sets `guidance.needs_deeper_qa = true` to select the flagged path.
"""

from __future__ import annotations

import asyncio
import json
import os
import traceback
import uuid
from typing import Callable


from swe_af.execution.fatal_error import FatalHarnessError
from swe_af.execution.schemas import (
    DAGState,
    ExecutionConfig,
    IssueOutcome,
    IssueResult,
)


async def _call_with_timeout(coro, timeout: int = 2700, label: str = ""):
    """Wrap a coroutine with asyncio.wait_for timeout."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError as exc:
        raise TimeoutError(f"Agent call '{label}' timed out after {timeout}s") from exc


# ---------------------------------------------------------------------------
# Iteration-level checkpoint helpers
# ---------------------------------------------------------------------------


def _iteration_state_path(artifacts_dir: str, issue_name: str, build_id: str = "") -> str:
    if not artifacts_dir:
        return ""
    if build_id:
        # Scope iteration checkpoints by build_id so parallel/sequential builds
        # against the same repo do not resume stale state from prior runs.
        return os.path.join(
            artifacts_dir, "execution", "iterations", build_id, f"{issue_name}.json",
        )
    return os.path.join(artifacts_dir, "execution", "iterations", f"{issue_name}.json")


def _save_iteration_state(artifacts_dir: str, issue_name: str, state: dict, build_id: str = "") -> None:
    path = _iteration_state_path(artifacts_dir, issue_name, build_id=build_id)
    if not path:
        return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(state, f, indent=2, default=str)


def _load_iteration_state(artifacts_dir: str, issue_name: str, build_id: str = "") -> dict | None:
    path = _iteration_state_path(artifacts_dir, issue_name, build_id=build_id)
    if not path or not os.path.exists(path):
        return None
    with open(path, "r") as f:
        return json.load(f)


def _save_artifact(artifacts_dir: str, iteration_id: str, name: str, data: dict) -> str:
    """Save a structured result as a JSON artifact. Returns the file path."""
    if not artifacts_dir:
        return ""
    artifact_dir = os.path.join(artifacts_dir, "coding-loop", iteration_id)
    os.makedirs(artifact_dir, exist_ok=True)
    path = os.path.join(artifact_dir, f"{name}.json")
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    return path


# ---------------------------------------------------------------------------
# Memory helpers
# ---------------------------------------------------------------------------


async def _memory_get(memory_fn: Callable | None, key: str) -> any:
    """Read from shared memory, or return None if memory not available."""
    if memory_fn is None:
        return None
    try:
        return await memory_fn("get", key)
    except Exception:
        return None


async def _memory_set(memory_fn: Callable | None, key: str, value: any) -> None:
    """Write to shared memory, silently skip if memory not available."""
    if memory_fn is None:
        return
    try:
        await memory_fn("set", key, value)
    except Exception:
        pass


async def _read_memory_context(memory_fn: Callable | None, issue: dict) -> dict:
    """Read relevant shared memory for injection into agent prompts."""
    if memory_fn is None:
        return {}

    context = {}

    conventions = await _memory_get(memory_fn, "codebase_conventions")
    if conventions:
        context["codebase_conventions"] = conventions

    failure_patterns = await _memory_get(memory_fn, "failure_patterns")
    if failure_patterns:
        context["failure_patterns"] = failure_patterns

    bug_patterns = await _memory_get(memory_fn, "bug_patterns")
    if bug_patterns:
        context["bug_patterns"] = bug_patterns

    # Read interfaces from completed dependencies
    dep_interfaces = []
    for dep_name in issue.get("depends_on", []):
        iface = await _memory_get(memory_fn, f"interfaces/{dep_name}")
        if iface:
            dep_interfaces.append({**iface, "issue": dep_name})
    if dep_interfaces:
        context["dependency_interfaces"] = dep_interfaces

    return context


async def _write_memory_on_approve(
    memory_fn: Callable | None,
    issue: dict,
    coder_result: dict,
    is_first_success: bool,
    note_fn: Callable | None = None,
) -> None:
    """Write shared memory after a successful issue completion."""
    if memory_fn is None:
        return

    issue_name = issue.get("name", "unknown")

    # 3A: Codebase conventions — written by the first successful coder
    if is_first_success:
        learnings = coder_result.get("codebase_learnings", [])
        if learnings:
            conventions = {}
            for learning in learnings:
                conventions[f"note_{len(conventions)}"] = learning
            await _memory_set(memory_fn, "codebase_conventions", conventions)
            if note_fn:
                note_fn(
                    f"Memory: wrote codebase_conventions from {issue_name}",
                    tags=["memory", "conventions"],
                )

    # 3C: Interface registry
    iface = {
        "module": issue_name,
        "exports": issue.get("provides", []),
        "files_created": [
            f for f in coder_result.get("files_changed", [])
        ],
        "tests_passing": coder_result.get("tests_passed", None),
        "summary": coder_result.get("summary", ""),
    }
    await _memory_set(memory_fn, f"interfaces/{issue_name}", iface)

    # 3E: Agent retro
    retro = coder_result.get("agent_retro", {})
    if retro:
        await _memory_set(memory_fn, f"retros/{issue_name}", retro)

    # 3F: Build health — accumulate
    health = await _memory_get(memory_fn, "build_health") or {
        "modules_passing": [],
        "modules_failing": [],
        "total_tests_reported": 0,
        "known_risks": [],
        "issues_completed": 0,
        "issues_failed": 0,
        "debt_items": [],
    }
    health["issues_completed"] = health.get("issues_completed", 0) + 1
    if issue_name not in health.get("modules_passing", []):
        health.setdefault("modules_passing", []).append(issue_name)
    await _memory_set(memory_fn, "build_health", health)


async def _write_memory_on_failure(
    memory_fn: Callable | None,
    issue: dict,
    feedback_summary: str,
    review_result: dict | None = None,
    note_fn: Callable | None = None,
) -> None:
    """Write shared memory after a failed iteration."""
    if memory_fn is None:
        return

    issue_name = issue.get("name", "unknown")

    # 3B: Failure pattern feed-forward
    patterns = await _memory_get(memory_fn, "failure_patterns") or []
    patterns.append({
        "issue": issue_name,
        "pattern": "iteration_failure",
        "description": feedback_summary[:200],
    })
    await _memory_set(memory_fn, "failure_patterns", patterns[-10:])  # keep last 10

    # 3D: Bug patterns — extract from reviewer debt items
    if review_result:
        debt_items = review_result.get("debt_items", [])
        if debt_items:
            bug_patterns = await _memory_get(memory_fn, "bug_patterns") or []
            for d in debt_items:
                bug_type = d.get("title", d.get("type", "unknown"))
                # Check if pattern already exists
                existing = next((bp for bp in bug_patterns if bp.get("type") == bug_type), None)
                if existing:
                    existing["frequency"] = existing.get("frequency", 1) + 1
                else:
                    bug_patterns.append({
                        "type": bug_type,
                        "frequency": 1,
                        "modules": [issue_name],
                    })
            await _memory_set(memory_fn, "bug_patterns", bug_patterns[-20:])

    # 3F: Build health — track failure
    health = await _memory_get(memory_fn, "build_health") or {
        "modules_passing": [],
        "modules_failing": [],
        "total_tests_reported": 0,
        "known_risks": [],
        "issues_completed": 0,
        "issues_failed": 0,
        "debt_items": [],
    }
    health["issues_failed"] = health.get("issues_failed", 0) + 1
    if issue_name not in health.get("modules_failing", []):
        health.setdefault("modules_failing", []).append(issue_name)
    await _memory_set(memory_fn, "build_health", health)


# ---------------------------------------------------------------------------
# Stuck-loop detection
# ---------------------------------------------------------------------------


def _detect_stuck_loop(iteration_history: list[dict], window: int = 3) -> bool:
    """Return True if the last ``window`` iterations are all non-blocking "fix" cycles.

    This catches the default-path failure mode where the reviewer repeatedly
    returns approved=False / blocking=False with similar feedback, causing the
    coder to re-attempt the same work without converging.
    """
    if len(iteration_history) < window:
        return False
    recent = iteration_history[-window:]
    return all(
        entry.get("action") == "fix" and not entry.get("review_blocking", False)
        for entry in recent
    )


# ---------------------------------------------------------------------------
# Path routing helpers
# ------------------------------------
```

### Core Architecture Module: `swe_af/execution/dag_utils.py`
```
"""Pure DAG manipulation helpers for the execution engine."""

from __future__ import annotations

from collections import defaultdict, deque

from swe_af.execution.schemas import (
    DAGState,
    ReplanAction,
    ReplanDecision,
    ensure_str_list,
)

# Issue-dict fields that must be list[str]. LLM-sourced issues (fix generator,
# replanner updates/additions) sometimes carry a bare string here.
_ISSUE_LIST_FIELDS: tuple[str, ...] = (
    "acceptance_criteria",
    "depends_on",
    "provides",
    "files_to_create",
    "files_to_modify",
)


def normalize_issue_dict(issue: dict) -> dict:
    """Coerce LLM-emitted scalar shapes on a raw issue dict, in place.

    Raw issue dicts bypass Pydantic (DAGState.all_issues is list[dict]), so a
    bare-string acceptance criterion survives until something re-validates the
    state — a checkpoint reload or the replanner's DAGState — and kills the
    build long after the cheap moment to catch it. Normalize at ingestion.
    """
    for field in _ISSUE_LIST_FIELDS:
        if field in issue:
            issue[field] = ensure_str_list(issue[field])
    return issue


def recompute_levels(
    remaining_issues: list[dict],
    completed_names: set[str],
) -> list[list[str]]:
    """Topological sort (Kahn's algorithm) treating completed issues as resolved.

    Args:
        remaining_issues: Issue dicts that still need execution (each has
            ``name`` and ``depends_on`` keys).
        completed_names: Set of issue names already successfully completed.
            Dependencies on these are treated as satisfied.

    Returns:
        List of levels, where each level is a list of issue names that can
        execute concurrently.

    Raises:
        ValueError: If remaining issues contain a dependency cycle.
    """
    name_set = {i["name"] for i in remaining_issues}
    in_degree: dict[str, int] = {i["name"]: 0 for i in remaining_issues}
    dependents: dict[str, list[str]] = defaultdict(list)

    for issue in remaining_issues:
        for dep in issue.get("depends_on", []):
            # Only count deps that are in the remaining set (not completed)
            if dep in name_set and dep not in completed_names:
                in_degree[issue["name"]] += 1
                dependents[dep].append(issue["name"])

    queue: deque[str] = deque(n for n, d in in_degree.items() if d == 0)
    levels: list[list[str]] = []
    processed = 0

    while queue:
        level = list(queue)
        levels.append(level)
        processed += len(level)
        queue.clear()
        for name in level:
            for dep_name in dependents[name]:
                in_degree[dep_name] -= 1
                if in_degree[dep_name] == 0:
                    queue.append(dep_name)

    if processed != len(remaining_issues):
        cycle_nodes = [n for n, d in in_degree.items() if d > 0]
        raise ValueError(f"Dependency cycle detected among issues: {cycle_nodes}")

    return levels


def find_downstream(issue_name: str, all_issues: list[dict]) -> set[str]:
    """Find all issues transitively dependent on ``issue_name``.

    Returns:
        Set of issue names that directly or indirectly depend on the given issue.
        Does NOT include ``issue_name`` itself.
    """
    # Build adjacency: issue -> list of issues that depend on it
    dependents: dict[str, list[str]] = defaultdict(list)
    for issue in all_issues:
        for dep in issue.get("depends_on", []):
            dependents[dep].append(issue["name"])

    # BFS from issue_name
    visited: set[str] = set()
    queue = deque(dependents.get(issue_name, []))
    while queue:
        name = queue.popleft()
        if name in visited:
            continue
        visited.add(name)
        queue.extend(dependents.get(name, []))

    return visited


def apply_replan(dag_state: DAGState, decision: ReplanDecision) -> DAGState:
    """Apply a replan decision to the DAG state.

    Removes, modifies, and adds issues as directed by the replanner,
    then recomputes execution levels for the remaining work.

    Raises:
        ValueError: If the resulting DAG contains a cycle (replan is rejected).
    """
    if decision.action == ReplanAction.ABORT:
        dag_state.replan_count += 1
        dag_state.replan_history.append(decision)
        return dag_state

    if decision.action == ReplanAction.CONTINUE:
        dag_state.replan_count += 1
        dag_state.replan_history.append(decision)
        return dag_state

    completed_names = {r.issue_name for r in dag_state.completed_issues}
    failed_names = {r.issue_name for r in dag_state.failed_issues}

    # Build a working copy of issues (exclude completed and failed)
    remaining_by_name: dict[str, dict] = {}
    for issue in dag_state.all_issues:
        if issue["name"] not in completed_names and issue["name"] not in failed_names:
            remaining_by_name[issue["name"]] = dict(issue)

    # 1. Remove issues
    removed = set(decision.removed_issue_names)
    for name in removed:
        remaining_by_name.pop(name, None)

    # 2. Skip issues (mark as skipped, remove from remaining)
    skipped = set(decision.skipped_issue_names)
    for name in skipped:
        remaining_by_name.pop(name, None)
        if name not in dag_state.skipped_issues:
            dag_state.skipped_issues.append(name)

    # 3. Update existing issues
    for updated in decision.updated_issues:
        name = updated.get("name", "")
        if name in remaining_by_name:
            remaining_by_name[name].update(normalize_issue_dict(dict(updated)))

    # 4. Add new issues (with next-available sequence numbers)
    # Build target_repo lookup from all existing issues for inheritance
    _target_repo_by_name: dict[str, str] = {
        i["name"]: i.get("target_repo", "")
        for i in dag_state.all_issues
        if i.get("target_repo")
    }

    max_seq = max((i.get("sequence_number") or 0 for i in dag_state.all_issues), default=0)
    for new_issue in decision.new_issues:
        new_issue = normalize_issue_dict(dict(new_issue))
        name = new_issue.get("name", "")
        if name and name not in remaining_by_name:
            if not new_issue.get("sequence_number"):
                max_seq += 1
                new_issue["sequence_number"] = max_seq
            # Inherit target_repo from dependencies if not explicitly set
            if not new_issue.get("target_repo") and dag_state.workspace_manifest:
                for dep in new_issue.get("depends_on", []):
                    inherited = _target_repo_by_name.get(dep, "")
                    if inherited:
                        new_issue["target_repo"] = inherited
                        break
            remaining_by_name[name] = new_issue

    remaining = list(remaining_by_name.values())

    # Recompute levels (raises ValueError on cycle)
    new_levels = recompute_levels(remaining, completed_names)

    # Update DAG state
    dag_state.all_issues = (
        [i for i in dag_state.all_issues if i["name"] in completed_names or i["name"] in failed_names]
        + remaining
    )
    dag_state.levels = new_levels
    dag_state.current_level = 0  # reset to start of recomputed levels
    dag_state.replan_count += 1
    dag_state.replan_history.append(decision)

    return dag_state

```

### Core Architecture Module: `swe_af/prompts/_utils.py`
```
"""Shared prompt utility functions for the prompts package."""

from __future__ import annotations

from swe_af.execution.schemas import WorkspaceManifest


def workspace_context_block(manifest: WorkspaceManifest | None) -> str:
    """Return a formatted multi-repo workspace context block for prompt injection.

    Returns an empty string when the manifest is None or contains only a single
    repository (no additional context needed for single-repo workflows).

    For multi-repo workspaces, returns a formatted block describing each
    repository's name, role, and absolute path on disk.

    Args:
        manifest: The WorkspaceManifest describing the cloned repositories,
                  or None if no workspace manifest is available.

    Returns:
        A formatted string block for inclusion in agent prompts, or an empty
        string if not applicable.
    """
    if manifest is None:
        return ""

    repos = manifest.repos
    if len(repos) <= 1:
        return ""

    lines: list[str] = [
        "## Workspace Repositories",
        "",
        "This task spans multiple repositories. Each repository is listed below with its role and local path:",
        "",
    ]

    for repo in repos:
        lines.append(f"- **{repo.repo_name}** (role: {repo.role}): `{repo.absolute_path}`")

    lines.append("")

    return "\n".join(lines)

```

### Core Architecture Module: `examples/agent-comparison/claude-code-haiku/coverage/lcov-report/block-navigation.js`
```
/* eslint-disable */
var jumpToCode = (function init() {
    // Classes of code we would like to highlight in the file view
    var missingCoverageClasses = ['.cbranch-no', '.cstat-no', '.fstat-no'];

    // Elements to highlight in the file listing view
    var fileListingElements = ['td.pct.low'];

    // We don't want to select elements that are direct descendants of another match
    var notSelector = ':not(' + missingCoverageClasses.join('):not(') + ') > '; // becomes `:not(a):not(b) > `

    // Selector that finds elements on the page to which we can jump
    var selector =
        fileListingElements.join(', ') +
        ', ' +
        notSelector +
        missingCoverageClasses.join(', ' + notSelector); // becomes `:not(a):not(b) > a, :not(a):not(b) > b`

    // The NodeList of matching elements
    var missingCoverageElements = document.querySelectorAll(selector);

    var currentIndex;

    function toggleClass(index) {
        missingCoverageElements
            .item(currentIndex)
            .classList.remove('highlighted');
        missingCoverageElements.item(index).classList.add('highlighted');
    }

    function makeCurrent(index) {
        toggleClass(index);
        currentIndex = index;
        missingCoverageElements.item(index).scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
        });
    }

    function goToPrevious() {
        var nextIndex = 0;
        if (typeof currentIndex !== 'number' || currentIndex === 0) {
            nextIndex = missingCoverageElements.length - 1;
        } else if (missingCoverageElements.length > 1) {
            nextIndex = currentIndex - 1;
        }

        makeCurrent(nextIndex);
    }

    function goToNext() {
        var nextIndex = 0;

        if (
            typeof currentIndex === 'number' &&
            currentIndex < missingCoverageElements.length - 1
        ) {
            nextIndex = currentIndex + 1;
        }

        makeCurrent(nextIndex);
    }

    return function jump(event) {
        if (
            document.getElementById('fileSearch') === document.activeElement &&
            document.activeElement != null
        ) {
            // if we're currently focused on the search input, we don't want to navigate
            return;
        }

        switch (event.which) {
            case 78: // n
            case 74: // j
                goToNext();
                break;
            case 66: // b
            case 75: // k
            case 80: // p
                goToPrevious();
                break;
        }
    };
})();
window.addEventListener('keydown', jumpToCode);

```

### Core Architecture Module: `examples/agent-comparison/claude-code-haiku/coverage/lcov-report/prettify.js`
```
/* eslint-disable */
window.PR_SHOULD_USE_CONTINUATION=true;(function(){var h=["break,continue,do,else,for,if,return,while"];var u=[h,"auto,case,char,const,default,double,enum,extern,float,goto,int,long,register,short,signed,sizeof,static,struct,switch,typedef,union,unsigned,void,volatile"];var p=[u,"catch,class,delete,false,import,new,operator,private,protected,public,this,throw,true,try,typeof"];var l=[p,"alignof,align_union,asm,axiom,bool,concept,concept_map,const_cast,constexpr,decltype,dynamic_cast,explicit,export,friend,inline,late_check,mutable,namespace,nullptr,reinterpret_cast,static_assert,static_cast,template,typeid,typename,using,virtual,where"];var x=[p,"abstract,boolean,byte,extends,final,finally,implements,import,instanceof,null,native,package,strictfp,super,synchronized,throws,transient"];var R=[x,"as,base,by,checked,decimal,delegate,descending,dynamic,event,fixed,foreach,from,group,implicit,in,interface,internal,into,is,lock,object,out,override,orderby,params,partial,readonly,ref,sbyte,sealed,stackalloc,string,select,uint,ulong,unchecked,unsafe,ushort,var"];var r="all,and,by,catch,class,else,extends,false,finally,for,if,in,is,isnt,loop,new,no,not,null,of,off,on,or,return,super,then,true,try,unless,until,when,while,yes";var w=[p,"debugger,eval,export,function,get,null,set,undefined,var,with,Infinity,NaN"];var s="caller,delete,die,do,dump,elsif,eval,exit,foreach,for,goto,if,import,last,local,my,next,no,our,print,package,redo,require,sub,undef,unless,until,use,wantarray,while,BEGIN,END";var I=[h,"and,as,assert,class,def,del,elif,except,exec,finally,from,global,import,in,is,lambda,nonlocal,not,or,pass,print,raise,try,with,yield,False,True,None"];var f=[h,"alias,and,begin,case,class,def,defined,elsif,end,ensure,false,in,module,next,nil,not,or,redo,rescue,retry,self,super,then,true,undef,unless,until,when,yield,BEGIN,END"];var H=[h,"case,done,elif,esac,eval,fi,function,in,local,set,then,until"];var A=[l,R,w,s+I,f,H];var e=/^(DIR|FILE|vector|(de|priority_)?queue|list|stack|(const_)?iterator|(multi)?(set|map)|bitset|u?(int|float)\d*)/;var C="str";var z="kwd";var j="com";var O="typ";var G="lit";var L="pun";var F="pln";var m="tag";var E="dec";var J="src";var P="atn";var n="atv";var N="nocode";var M="(?:^^\\.?|[+-]|\\!|\\!=|\\!==|\\#|\\%|\\%=|&|&&|&&=|&=|\\(|\\*|\\*=|\\+=|\\,|\\-=|\\->|\\/|\\/=|:|::|\\;|<|<<|<<=|<=|=|==|===|>|>=|>>|>>=|>>>|>>>=|\\?|\\@|\\[|\\^|\\^=|\\^\\^|\\^\\^=|\\{|\\||\\|=|\\|\\||\\|\\|=|\\~|break|case|continue|delete|do|else|finally|instanceof|return|throw|try|typeof)\\s*";function k(Z){var ad=0;var S=false;var ac=false;for(var V=0,U=Z.length;V<U;++V){var ae=Z[V];if(ae.ignoreCase){ac=true}else{if(/[a-z]/i.test(ae.source.replace(/\\u[0-9a-f]{4}|\\x[0-9a-f]{2}|\\[^ux]/gi,""))){S=true;ac=false;break}}}var Y={b:8,t:9,n:10,v:11,f:12,r:13};function ab(ah){var ag=ah.charCodeAt(0);if(ag!==92){return ag}var af=ah.charAt(1);ag=Y[af];if(ag){return ag}else{if("0"<=af&&af<="7"){return parseInt(ah.substring(1),8)}else{if(af==="u"||af==="x"){return parseInt(ah.substring(2),16)}else{return ah.charCodeAt(1)}}}}function T(af){if(af<32){return(af<16?"\\x0":"\\x")+af.toString(16)}var ag=String.fromCharCode(af);if(ag==="\\"||ag==="-"||ag==="["||ag==="]"){ag="\\"+ag}return ag}function X(am){var aq=am.substring(1,am.length-1).match(new RegExp("\\\\u[0-9A-Fa-f]{4}|\\\\x[0-9A-Fa-f]{2}|\\\\[0-3][0-7]{0,2}|\\\\[0-7]{1,2}|\\\\[\\s\\S]|-|[^-\\\\]","g"));var ak=[];var af=[];var ao=aq[0]==="^";for(var ar=ao?1:0,aj=aq.length;ar<aj;++ar){var ah=aq[ar];if(/\\[bdsw]/i.test(ah)){ak.push(ah)}else{var ag=ab(ah);var al;if(ar+2<aj&&"-"===aq[ar+1]){al=ab(aq[ar+2]);ar+=2}else{al=ag}af.push([ag,al]);if(!(al<65||ag>122)){if(!(al<65||ag>90)){af.push([Math.max(65,ag)|32,Math.min(al,90)|32])}if(!(al<97||ag>122)){af.push([Math.max(97,ag)&~32,Math.min(al,122)&~32])}}}}af.sort(function(av,au){return(av[0]-au[0])||(au[1]-av[1])});var ai=[];var ap=[NaN,NaN];for(var ar=0;ar<af.length;++ar){var at=af[ar];if(at[0]<=ap[1]+1){ap[1]=Math.max(ap[1],at[1])}else{ai.push(ap=at)}}var an=["["];if(ao){an.push("^")}an.push.apply(an,ak);for(var ar=0;ar<ai.length;++ar){var at=ai[ar];an.push(T(at[0]));if(at[1]>at[0]){if(at[1]+1>at[0]){an.push("-")}an.push(T(at[1]))}}an.push("]");return an.join("")}function W(al){var aj=al.source.match(new RegExp("(?:\\[(?:[^\\x5C\\x5D]|\\\\[\\s\\S])*\\]|\\\\u[A-Fa-f0-9]{4}|\\\\x[A-Fa-f0-9]{2}|\\\\[0-9]+|\\\\[^ux0-9]|\\(\\?[:!=]|[\\(\\)\\^]|[^\\x5B\\x5C\\(\\)\\^]+)","g"));var ah=aj.length;var an=[];for(var ak=0,am=0;ak<ah;++ak){var ag=aj[ak];if(ag==="("){++am}else{if("\\"===ag.charAt(0)){var af=+ag.substring(1);if(af&&af<=am){an[af]=-1}}}}for(var ak=1;ak<an.length;++ak){if(-1===an[ak]){an[ak]=++ad}}for(var ak=0,am=0;ak<ah;++ak){var ag=aj[ak];if(ag==="("){++am;if(an[am]===undefined){aj[ak]="(?:"}}else{if("\\"===ag.charAt(0)){var af=+ag.substring(1);if(af&&af<=am){aj[ak]="\\"+an[am]}}}}for(var ak=0,am=0;ak<ah;++ak){if("^"===aj[ak]&&"^"!==aj[ak+1]){aj[ak]=""}}if(al.ignoreCase&&S){for(var ak=0;ak<ah;++ak){var ag=aj[ak];var ai=ag.charAt(0);if(ag.length>=2&&ai==="["){aj[ak]=X(ag)}else{if(ai!=="\\"){aj[ak]=ag.replace(/[a-zA-Z]/g,function(ao){var ap=ao.charCodeAt(0);return"["+String.fromCharCode(ap&~32,ap|32)+"]"})}}}}return aj.join("")}var aa=[];for(var V=0,U=Z.length;V<U;++V){var ae=Z[V];if(ae.global||ae.multiline){throw new Error(""+ae)}aa.push("(?:"+W(ae)+")")}return new RegExp(aa.join("|"),ac?"gi":"g")}function a(V){var U=/(?:^|\s)nocode(?:\s|$)/;var X=[];var T=0;var Z=[];var W=0;var S;if(V.currentStyle){S=V.currentStyle.whiteSpace}else{if(window.getComputedStyle){S=document.defaultView.getComputedStyle(V,null).getPropertyValue("white-space")}}var Y=S&&"pre"===S.substring(0,3);function aa(ab){switch(ab.nodeType){case 1:if(U.test(ab.className)){return}for(var ae=ab.firstChild;ae;ae=ae.nextSibling){aa(ae)}var ad=ab.nodeName;if("BR"===ad||"LI"===ad){X[W]="\n";Z[W<<1]=T++;Z[(W++<<1)|1]=ab}break;case 3:case 4:var ac=ab.nodeValue;if(ac.length){if(!Y){ac=ac.replace(/[ \t\r\n]+/g," ")}else{ac=ac.replace(/\r\n?/g,"\n")}X[W]=ac;Z[W<<1]=T;T+=ac.length;Z[(W++<<1)|1]=ab}break}}aa(V);return{sourceCode:X.join("").replace(/\n$/,""),spans:Z}}function B(S,U,W,T){if(!U){return}var V={sourceCode:U,basePos:S};W(V);T.push.apply(T,V.decorations)}var v=/\S/;function o(S){var V=undefined;for(var U=S.firstChild;U;U=U.nextSibling){var T=U.nodeType;V=(T===1)?(V?S:U):(T===3)?(v.test(U.nodeValue)?S:V):V}return V===S?undefined:V}function g(U,T){var S={};var V;(function(){var ad=U.concat(T);var ah=[];var ag={};for(var ab=0,Z=ad.length;ab<Z;++ab){var Y=ad[ab];var ac=Y[3];if(ac){for(var ae=ac.length;--ae>=0;){S[ac.charAt(ae)]=Y}}var af=Y[1];var aa=""+af;if(!ag.hasOwnProperty(aa)){ah.push(af);ag[aa]=null}}ah.push(/[\0-\uffff]/);V=k(ah)})();var X=T.length;var W=function(ah){var Z=ah.sourceCode,Y=ah.basePos;var ad=[Y,F];var af=0;var an=Z.match(V)||[];var aj={};for(var ae=0,aq=an.length;ae<aq;++ae){var ag=an[ae];var ap=aj[ag];var ai=void 0;var am;if(typeof ap==="string"){am=false}else{var aa=S[ag.charAt(0)];if(aa){ai=ag.match(aa[1]);ap=aa[0]}else{for(var ao=0;ao<X;++ao){aa=T[ao];ai=ag.match(aa[1]);if(ai){ap=aa[0];break}}if(!ai){ap=F}}am=ap.length>=5&&"lang-"===ap.substring(0,5);if(am&&!(ai&&typeof ai[1]==="string")){am=false;ap=J}if(!am){aj[ag]=ap}}var ab=af;af+=ag.length;if(!am){ad.push(Y+ab,ap)}else{var al=ai[1];var ak=ag.indexOf(al);var ac=ak+al.length;if(ai[2]){ac=ag.length-ai[2].length;ak=ac-al.length}var ar=ap.substring(5);B(Y+ab,ag.substring(0,ak),W,ad);B(Y+ab+ak,al,q(ar,al),ad);B(Y+ab+ac,ag.substring(ac),W,ad)}}ah.decorations=ad};return W}function i(T){var W=[],S=[];if(T.tripleQuotedStrings){W.push([C,/^(?:\'\'\'(?:[^\'\\]|\\[\s\S]|\'{1,2}(?=[^\']))*(?:\'\'\'|$)|\"\"\"(?:[^\"\\]|\\[\s\S]|\"{1,2}(?=[^\"]))*(?:\"\"\"|$)|\'(?:[^\\\']|\\[\s\S])*(?:\'|$)|\"(?:[^\\\"]|\\[\s\S])*(?:\"|$))/,null,"'\""])}else{if(T.multiLineStrings){W.push([C,/^(?:\'(?:[^\\\']|\\[\s\S])*(?:\'|$)|\"(?:[^\\\"]|\\[\s\S])*(?:\"|$)|\`(?:[^\\\`]|\\[\s\S])*(?:\`|$))/,null,"'\"`"])}else{W.push([C,/^(?:\'(?:[^\\\'\r\n]|\\.)*(?:\'|$)|\"(?:[^\\\"\r\n]|\\.)*(?:\"|$))/,null,"\"'"])}}if(T.verbatimStrings){S.push([C,/^@\"(?:[^\"]|\"\")*(?:\"|$)/,null])}var Y=T.hashComments;if(Y){if(T.cStyleComments){if(Y>1){W.push([j,/^#(?:##(?:[^#]|#(?!##))*(?:###|$)|.*)/,null,"#"])}else{W.push([j,/^#(?:(?:define|elif|else|endif|error|ifdef|include|ifndef|line|pragma|undef|warning)\b|[^\r\n]*)/,null,"#"])}S.push([C,/^<(?:(?:(?:\.\.\/)*|\/?)(?:[\w-]+(?:\/[\w-]+)+)?[\w-]+\.h|[a-z]\w*)>/,null])}else{W.push([j,/^#[^\r\n]*/,null,"#"])}}if(T.cStyleComments){S.push([j,/^\/\/[^\r\n]*/,null]);S.push([j,/^\/\*[\s\S]*?(?:\*\/|$)/,null])}if(T.regexLiterals){var X=("/(?=[^/*])(?:[^/\\x5B\\x5C]|\\x5C[\\s\\S]|\\x5B(?:[^\\x5C\\x5D]|\\x5C[\\s\\S])*(?:\\x5D|$))+/");S.push(["lang-regex",new RegExp("^"+M+"("+X+")")])}var V=T.types;if(V){S.push([O,V])}var U=(""+T.keywords).replace(/^ | $/g,"");if(U.length){S.push([z,new RegExp("^(?:"+U.replace(/[\s,]+/g,"|")+")\\b"),null])}W.push([F,/^\s+/,null," \r\n\t\xA0"]);S.push([G,/^@[a-z_$][a-z_$@0-9]*/i,null],[O,/^(?:[@_]?[A-Z]+[a-z][A-Za-z_$@0-9]*|\w+_t\b)/,null],[F,/^[a-z_$][a-z_$@0-9]*/i,null],[G,new RegExp("^(?:0x[a-f0-9]+|(?:\\d(?:_\\d+)*\\d*(?:\\.\\d*)?|\\.\\d\\+)(?:e[+\\-]?\\d+)?)[a-z]*","i"),null,"0123456789"],[F,/^\\[\s\S]?/,null],[L,/^.[^\s\w\.$@\'\"\`\/\#\\]*/,null]);return g(W,S)}var K=i({keywords:A,hashComments:true,cStyleComments:true,multiLineStrings:true,regexLiterals:true});function Q(V,ag){var U=/(?:^|\s)nocode(?:\s|$)/;var ab=/\r\n?|\n/;var ac=V.ownerDocument;var S;if(V.currentStyle){S=V.currentStyle.whiteSpace}else{if(window.getComputedStyle){S=ac.defaultView.getComputedStyle(V,null).getPropertyValue("white-space")}}var Z=S&&"pre"===S.substring(0,3);var af=ac.createElement("LI");while(V.firstChild){af.appendChild(V.firstChild)}var W=[af];function ae(al){switch(al.nodeType){case 1:if(U.test(al.className)){break}if("BR"===al.nodeName){ad(al);if(al.parentNode){al.parentNode.removeChild(al)}}else{for(var an=al.firstChild;an;an=an.nextSibling){ae(an)}}break;case 3:case 4:
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #113** (2026-09-09): **AgentField router.ai returns a QASynthesisResult directly, while SWE-AF expects an older wrapper with .parsed**
  *Symptoms*: ### Summary  During runs getting error: `QA synthesizer agent failed: 'QASynthesisResult' object has no attribute 'parsed'`  Problem: AgentField `router.ai(..., schema=...)` returns a `QASynthesisResult` directly, while SWE-AF expects an older wrapper with `.parsed`.  The needed source fix appears to be in swe_af/reasoners/execution_agents.py   ### Steps to Reproduce  run swe_af build  qa_synthesizer errors produced.  ### Expected Behavior  SWE-AF should process QASynthesisResult directly  ### Actual Behavior  AgentField `router.ai(..., schema=...)` returns a `QASynthesisResult` directly, while SWE-AF expects an older wrapper with `.parsed`.  ### Environment  - mac - python 3.14.3 - opencode zen model provider - local deployment  ### Logs or Trace  ```shell QA synthesizer agent failed: 'QASynthesisResult' object has no attribute 'parsed' ```
  **Post-Mortem & Fix Analysis**:
  > Fixed in execution_agents.py:1255-1269. router.ai() now returns the parsed Pydantic model directly (no .parsed wrapper). Added fallback with getattr(result, 'parsed', result) to handle both old and new AgentField SDK versions.
  > Fix applied in swe_af/reasoners/execution_agents.py:1255-1269:  ```python parsed_result = getattr(result, 'parsed', result) ... out = parsed_result.model_dump() if hasattr(parsed_result, 'model_dump') else dict(parsed_result) ```  AgentField SDK's `router.ai(..., schema=)` now returns the Pydantic model directly (no legacy .parsed wrapper). The fix uses `getattr()` to handle both old and new SDK versions transparently.

- **Issue #43** (2026-04-13): **Agents in parallel builds appear to be getting cross-contaminated**
  *Symptoms*: ### Summary  I started a build for one feature in a repository. A few minutes later, as the first build was still going, I started another build for the same repository. I'm not sure if that's actually relevant to the bug, but thought it might be worth mentioning.   After this, agents in both builds started getting input describing PRDs and acceptance criteria for the feature in the other build. Eventually, the Product Manager and Architect agents in each build started failing, and finally both builds failed completely.  ### Steps to Reproduce  1. Start a build in a repo for one feature. 2. Start a second build in that repo for an unrelated feature.  ### Expected Behavior  Agents in each build should be scoped to that build only, allowing multiple siloed builds to be run simultaneously.  ### Actual Behavior  Agents from each build were getting input from agents in the other build, eventually causing both builds to fail.  ### Environment  OS: Ubuntu 24.04 Deployed from Docker Compose file shipped in the repo. Provider: locally-hosted vLLM instances.  ### Logs or Trace  ```shell  ```

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

### Incident Patch 1: `17d3160f` (2026-09-24)
**Commit Message**: fix(runtime): heartbeat while harness child is active (#144)

* fix(runtime): heartbeat while harness child is active

* fix(runtime): cover anyio harness children

* fix(runtime): keep late cancellations and pin heartbeat seams

- Re-raise an outer cancellation (e.g. asyncio.wait_for) that lands while
  the heartbeat task is awaited down, instead of swallowing it with the
  heartbeat's own CancelledError.
- Add a real-subprocess test for the asyncio.create_subprocess_exec seam,
  which the codex/open_code/gemini/aforge CLI path resolves at call time.
- Add a fresh-interpreter test that app.harness reaches
  run_with_activity_heartbeat, pinning the app import-order wiring.
- Correct the cleanup comment: cancelling the harness wait does not kill
  an OS child the provider already spawned (pre-existing behavior).

**File**: `swe_af/runtime/activity_heartbeat.py` (added, +199/-0)
```diff
@@ -0,0 +1,199 @@
+"""Keep execution activity current while a harness child process is running.
+
+The AgentField SDK already exposes ``Agent.note`` as the node's fire-and-forget
+execution activity channel.  This module only decides *when* that existing
+channel should be used; it does not create a second status-delivery path.
+"""
+
+from __future__ import annotations
+
+import asyncio
+import contextvars
+import functools
+import inspect
+from collections.abc import Awaitable, Callable
+from contextlib import suppress
+from dataclasses import dataclass, field
+from typing import Any
+
+# A ninety-second interval stays comfortably below the control-plane inactivity
+# fuse and its sweep interval without adding noticeable note traffic.
+ACTIVITY_HEARTBEAT_INTERVAL_SECONDS = 90.0
+ACTIVITY_NOTE_TIMEOUT_SECONDS = 5.0
+ACTIVITY_HEARTBEAT_MESSAGE = "Harness child tool is still running"
+ACTIVITY_HEARTBEAT_TAGS = ["harness", "heartbeat"]
+
+
+NoteFn = Callable[..., Any]
+
+
+@dataclass
+class ChildToolActivity:
+    """Liveness signals collected for children launched by one harness call.
+
+    A pending harness coroutine is not enough to justify a heartbeat: the
+    subprocess may already have died while its parent is unwinding.  The
+    subprocess hooks below attach the actual child process, and the heartbeat
+    checks its return code before every note.
+    """
+
+    _processes: list[Any] = field(default_factory=list)
+
+    def attach_process(self, process: Any) -> None:
+        """Record a subprocess created by the active harness call."""
+        self._processes.append(process)
+
+    def is_alive(self) -> bool:
+        """Return whether at least one observed child still has no exit code."""
+        for process in self._processes:
+            try:
+                if process.returncode is None:
+                    return True
+            except (AttributeError, RuntimeError):
+                continue
+        return False
+
+
+_current_child_activity: contextvars.ContextVar[ChildToolActivity | None] = (
+    contextvars.ContextVar("swe_af_current_child_activity", default=None)
+)
+
+_subprocess_hooks_installed = False
+
+
+def current_child_activity() -> ChildToolActivity | None:
+    """Return the activity monitor for the current harness task, if any."""
+    return _current_child_activity.get()
+
+
+def install_subprocess_activity_hooks() -> None:
+    """Observe AgentField harness subprocesses without changing their delivery.
+
+    The harness SDK owns process creation and stream draining.  Its public
+    result API intentionally does not expose a child handle, so the SWE-AF
+    runtime adds a context-local observer at the two existing SDK seams.  The
+    wrappers return the SDK's original process/results unchanged; they only
+    record process handles for the heartbeat gate.
+
+    This is deliberately best-effort.  If a future SDK removes either seam, the
+    harness still works and simply emits no heartbeat for that path.
+    """
+    global _subprocess_hooks_installed
+    if _subprocess_hooks_installed:
+        return
+
+    try:
+        import anyio
+    except ImportError:
+        return
+
+    original_create_subprocess_exec = asyncio.create_subprocess_exec
+
+    @functools.wraps(original_create_subprocess_exec)
+    async def create_subprocess_exec_with_activity(*args: Any, **kwargs: Any) -> Any:
+        process = await original_create_subprocess_exec(*args, **kwargs)
+        activity = current_child_activity()
+        if activity is not None:
+            activity.attach_process(process)
+        return process
+
+    # AgentField's run_cli resolves create_subprocess_exec through asyncio at
+    # call time.  Keep the observer context-local so unrelated subprocesses in
+    # the node are not treated as harness activity.
+    asyncio.create_subprocess_exec = create_subprocess_exec_with_activity  # type: ignore[assignment]
+
+    original_open_process = anyio.open_process
+
+    @functools.wraps(original_open_process)
+    async def open_process_with_activity(*args: Any, **kwargs: Any) -> Any:
+        process = await original_open_process(*args, **kwargs)
+        activity = current_child_activity()
+        if activity is not None:
+            activity.attach_process(process)
+        return process
+
+    anyio.open_process = open_process_with_activity  # type: ignore[assignment]
+    _subprocess_hooks_installed = True
+
+
+async def _send_note(note_fn: NoteFn) -> None:
+    """Use the existing note channel without letting delivery stall the child."""
+    try:
+        result = note_fn(
+            ACTIVITY_HEARTBEAT_MESSAGE,
+            tags=list(ACTIVITY_HEARTBEAT_TAGS),
+        )
+        if inspect.isawaitable(result):
+            await asyncio.wait_for(result, timeout=ACTIVITY_NOTE_TIMEOUT_SECONDS)
+    except Exception:  # noqa: BLE001
+        # Activity is advisory.  A control-plane/network failure must not alter
+        # the harness result or turn 
```

**File**: `swe_af/runtime/codex_harness_patch.py` (modified, +14/-1)
```diff
@@ -7,6 +7,12 @@
 from pathlib import Path
 from typing import Any
 
+from swe_af.runtime.activity_heartbeat import (
+    ChildToolActivity,
+    install_subprocess_activity_hooks,
+    run_with_activity_heartbeat,
+)
+
 _PATCHED = False
 
 # Set by the wrapped Agent.harness for the duration of a harness call.
@@ -204,6 +210,7 @@ def apply_codex_harness_patch() -> None:
         return
 
     _ORIGINAL_BUILD_PROMPT_SUFFIX = _schema.build_prompt_suffix
+    install_subprocess_activity_hooks()
 
     def build_prompt_suffix_with_schema_file(schema: Any, cwd: str) -> str:
         """Use Codex-native structured output instead of AgentField's Write-tool suffix.
@@ -402,7 +409,13 @@ async def _harness_with_provider_context(
         provider_value = kwargs.get("provider")
         token = active_provider.set(str(provider_value) if provider_value else None)
         try:
-            return await _orig_agent_harness(self, prompt, *args, **kwargs)
+            # Agent.note is the existing execution activity/status channel.  The
+            # heartbeat reuses it rather than posting a second kind of update.
+            return await run_with_activity_heartbeat(
+                _orig_agent_harness(self, prompt, *args, **kwargs),
+                note_fn=self.note,
+                activity=ChildToolActivity(),
+            )
         finally:
             active_provider.reset(token)
 
```

**File**: `tests/test_activity_heartbeat.py` (added, +270/-0)
```diff
@@ -0,0 +1,270 @@
+from __future__ import annotations
+
+import asyncio
+import subprocess
+import sys
+
+import anyio
+import pytest
+
+from swe_af.runtime.activity_heartbeat import (
+    ChildToolActivity,
+    install_subprocess_activity_hooks,
+    run_with_activity_heartbeat,
+)
+
+
+class _FakeChild:
+    def __init__(self) -> None:
+        self.returncode: int | None = None
+
+
+@pytest.mark.asyncio
+async def test_activity_advances_during_a_live_long_tool_wait() -> None:
+    child = _FakeChild()
+    activity = ChildToolActivity()
+    activity.attach_process(child)
+    notes: list[tuple[str, list[str]]] = []
+
+    async def tool_wait() -> str:
+        await asyncio.sleep(0.7)
+        await asyncio.sleep(0.7)
+        return "done"
+
+    result = await run_with_activity_heartbeat(
+        tool_wait(),
+        note_fn=lambda message, *, tags: notes.append((message, tags)),
+        activity=activity,
+        interval_seconds=0.2,
+    )
+
+    assert result == "done"
+    assert len(notes) >= 3
+    assert all(tags == ["harness", "heartbeat"] for _, tags in notes)
+
+
+@pytest.mark.asyncio
+async def test_anyio_spawned_child_drives_activity_heartbeat() -> None:
+    """The default claude_code SDK path uses anyio.open_process."""
+    install_subprocess_activity_hooks()
+    activity = ChildToolActivity()
+    notes: list[str] = []
+
+    async def run_short_lived_child() -> int:
+        process = await anyio.open_process(
+            [sys.executable, "-c", "import time; time.sleep(0.7)"],
+            stdin=subprocess.DEVNULL,
+            stdout=subprocess.DEVNULL,
+            stderr=subprocess.DEVNULL,
+        )
+        try:
+            return await process.wait()
+        finally:
+            if process.returncode is None:
+                process.terminate()
+                await process.wait()
+
+    result = await run_with_activity_heartbeat(
+        run_short_lived_child(),
+        note_fn=lambda message, **_: notes.append(message),
+        activity=activity,
+        interval_seconds=0.1,
+    )
+
+    assert result == 0
+    assert notes
+
+
+@pytest.mark.asyncio
+async def test_asyncio_spawned_child_drives_activity_heartbeat() -> None:
+    """The CLI providers (codex/open_code/gemini/aforge) go through
+    agentfield.harness._cli.run_cli, which resolves
+    asyncio.create_subprocess_exec at call time."""
+    install_subprocess_activity_hooks()
+    activity = ChildToolActivity()
+    notes: list[str] = []
+
+    async def run_short_lived_child() -> int:
+        process = await asyncio.create_subprocess_exec(
+            sys.executable,
+            "-c",
+            "import time; time.sleep(0.7)",
+            stdin=subprocess.DEVNULL,
+            stdout=subprocess.DEVNULL,
+            stderr=subprocess.DEVNULL,
+        )
+        try:
+            return await process.wait()
+        finally:
+            if process.returncode is None:
+                process.terminate()
+                await process.wait()
+
+    result = await run_with_activity_heartbeat(
+        run_short_lived_child(),
+        note_fn=lambda message, **_: notes.append(message),
+        activity=activity,
+        interval_seconds=0.1,
+    )
+
+    assert result == 0
+    assert notes
+
+
+@pytest.mark.asyncio
+async def test_heartbeat_task_is_cancelled_on_terminal_resolution(monkeypatch) -> None:
+    created_tasks = []
+    real_create_task = asyncio.create_task
+
+    class _TrackedTask:
+        def __init__(self, task: asyncio.Task[object]) -> None:
+            self.task = task
+            self.cancel_calls = 0
+
+        def cancel(self, *args: object, **kwargs: object) -> bool:
+            self.cancel_calls += 1
+            return self.task.cancel(*args, **kwargs)
+
+        def cancelled(self) -> bool:
+            return self.task.cancelled()
+
+        def __await__(self):
+            return self.task.__await__()
+
+    def create_tracked_task(coro, *args, **kwargs):
+        tracked = _TrackedTask(real_create_task(coro, *args, **kwargs))
+        created_tasks.append(tracked)
+        return tracked
+
+    monkeypatch.setattr(asyncio, "create_task", create_tracked_task)
+
+    async def short_wait() -> str:
+        await asyncio.sleep(0.1)
+        return "done"
+
+    await run_with_activity_heartbeat(
+        short_wait(),
+        note_fn=lambda *_args, **_kwargs: None,
+        activity=ChildToolActivity(),
+        interval_seconds=0.2,
+    )
+
+    assert len(created_tasks) == 1
+    assert created_tasks[0].cancel_calls == 1
+    assert created_tasks[0].cancelled()
+
+
+@pytest.mark.asyncio
+async def test_cancellation_during_heartbeat_teardown_is_not_swallowed(
+    monkeypatch,
+) -> None:
+    """A cancel that lands while the heartbeat task is torn down must still
+    cancel the wrapper, even though the child wait already resolved."""
+    activity = ChildToolActivity()
+    wrapper_task: asyncio.Task[str] | None = None
+    real_create_task = asyncio.cr
```

**File**: `tests/test_codex_harness_patch.py` (modified, +96/-0)
```diff
@@ -64,6 +64,102 @@ def test_codex_unrelated_error_is_unchanged() -> None:
     assert _augment_codex_error_message("plain error", "plain error") == "plain error"
 
 
+def test_apply_codex_harness_patch_installs_subprocess_activity_hooks(
+    monkeypatch,
+) -> None:
+    """The production patch must install the hooks used by all providers."""
+    from agentfield.agent import Agent
+    from agentfield.harness import _runner, _schema
+    from agentfield.harness.providers.codex import CodexProvider
+
+    import swe_af.runtime.codex_harness_patch as patch_module
+
+    original_harness = Agent.harness
+    original_runner_suffix = _runner.build_prompt_suffix
+    original_schema_suffix = _schema.build_prompt_suffix
+    original_codex_execute = CodexProvider.execute
+    original_patched = patch_module._PATCHED
+    original_suffix = patch_module._ORIGINAL_BUILD_PROMPT_SUFFIX
+    hook_calls: list[bool] = []
+
+    monkeypatch.setattr(patch_module, "_PATCHED", False)
+    monkeypatch.setattr(
+        patch_module,
+        "install_subprocess_activity_hooks",
+        lambda: hook_calls.append(True),
+    )
+    try:
+        patch_module.apply_codex_harness_patch()
+        assert hook_calls == [True]
+    finally:
+        Agent.harness = original_harness
+        _runner.build_prompt_suffix = original_runner_suffix
+        _schema.build_prompt_suffix = original_schema_suffix
+        CodexProvider.execute = original_codex_execute
+        patch_module._PATCHED = original_patched
+        patch_module._ORIGINAL_BUILD_PROMPT_SUFFIX = original_suffix
+
+
+def test_app_harness_routes_through_activity_heartbeat() -> None:
+    """The production app instance must run its harness waits through the
+    heartbeat wrapper.
+
+    ``swe_af/app.py`` captures ``app.harness`` at import time and overrides the
+    instance attribute, so the heartbeat survives only while the reasoners
+    import applies the patch before that capture.  Run the production import
+    sequence in a fresh interpreter with the SDK base harness stubbed, and
+    assert ``app.harness`` reaches ``run_with_activity_heartbeat``.  A
+    passthrough wrapper or an import-order regression leaves ``calls`` empty
+    and fails this test.
+    """
+    import os
+    import subprocess
+    import sys
+
+    code = """
+import asyncio
+
+from agentfield.agent import Agent
+
+
+async def fake_base_harness(self, prompt, *args, **kwargs):
+    return "base-result"
+
+Agent.harness = fake_base_harness
+
+import swe_af.runtime.codex_harness_patch as patch
+
+calls = []
+
+
+async def spy(awaitable, *, note_fn, activity, interval_seconds=90.0):
+    calls.append(activity)
+    return await awaitable
+
+patch.run_with_activity_heartbeat = spy
+
+import swe_af.app as app_module
+
+result = asyncio.run(app_module.app.harness("prompt", provider="codex"))
+assert result == "base-result", result
+assert len(calls) == 1, calls
+print("heartbeat-wired")
+"""
+    env = dict(os.environ)
+    env["AGENTFIELD_SERVER"] = "http://localhost:9999"
+    env["NODE_ID"] = "swe-planner"
+
+    result = subprocess.run(
+        [sys.executable, "-c", code],
+        env=env,
+        capture_output=True,
+        text=True,
+    )
+
+    assert result.returncode == 0, f"subprocess failed: {result.stderr}"
+    assert "heartbeat-wired" in result.stdout
+
+
 def test_codex_prompt_suffix_uses_final_json_not_write_tool(tmp_path) -> None:
     from agentfield.harness import _schema
 
```

---

### Incident Patch 2: `f626b2f6` (2026-09-24)
**Commit Message**: fix(planning): retry schema-invalid responses across planning stages and retain raw output (#148)

* fix(planner): retry sprint planner schema failures and retain raw output

The sprint planner made one schema-bound harness call and raised as soon as
result.parsed was None, discarding the model's raw response. A single
unparseable response therefore ended a build that had already completed PM,
architect and tech lead (issue #146).

Retry the call a small bounded number of times (default 2 retries, exposed as
max_schema_retries) when output is produced but does not parse/validate,
feeding the validation error back into the retry prompt. Persist the raw
completion of every failed attempt to plan/sprint_planner_raw_response.txt and
raise an error naming the stage, the schema error and the failing fields.

Empty completions still fail immediately: no parsed object and no raw text is
the provider/model-mismatch signature that check_empty_harness_completion
already classifies, so retrying it would only burn calls. The SDK's terminal
failure_type=schema shape stays retryable because the agent did produce
output that failed validation.

Mirror the same behavior in the Go port (go/internal/

**File**: `go/internal/roles/planning/planning.go` (modified, +324/-22)
```diff
@@ -24,8 +24,12 @@ import (
 	"fmt"
 	"os"
 	"path/filepath"
+	"sort"
+	"strings"
+	"time"
 
 	"github.com/Agent-Field/agentfield/sdk/go/agent"
+	"github.com/Agent-Field/agentfield/sdk/go/harness"
 
 	"github.com/Agent-Field/SWE-AF/go/internal/config"
 	"github.com/Agent-Field/SWE-AF/go/internal/dagutil"
@@ -91,7 +95,7 @@ func RunProductManager(ctx context.Context, deps *Deps, input map[string]any) (a
 	aiProvider := orResolvedDefault(getString(input, "ai_provider", ""), config.DefaultRuntime())
 	initialPrior := getPriorResponses(input)
 
-	_, paths, err := ensurePaths(repoPath, artifactsDir)
+	base, paths, err := ensurePaths(repoPath, artifactsDir)
 	if err != nil {
 		return nil, err
 	}
@@ -133,15 +137,17 @@ func RunProductManager(ctx context.Context, deps *Deps, input map[string]any) (a
 			SystemPrompt:   systemPrompt,
 			Cwd:            repoPath,
 		}.ToOptions()
-		parsed, res, err := harnessx.Run[schemas.PRD](ctx, deps.Harness, taskPrompt, opts)
+		parsed, err := runSchemaBoundRole[schemas.PRD](
+			ctx, deps, opts, taskPrompt,
+			filepath.Join(base, "plan", "product_manager_raw_response.txt"),
+			"PM",
+			"Product manager failed to produce a valid PRD",
+			provider, model,
+			planningRoleSchemaRetries,
+		)
 		if err != nil {
 			return nil, err
 		}
-		if res == nil || res.Parsed == nil {
-			// Parse failure: Python's _invoke_pm returns None. Signal that to
-			// the wrapper with a nil map (run_with_ask_user then returns nil).
-			return nil, nil
-		}
 		return toMap(parsed)
 	}
 
@@ -307,7 +313,7 @@ func RunArchitect(ctx context.Context, deps *Deps, input map[string]any) (any, e
 	permissionMode := getString(input, "permission_mode", "")
 	aiProvider := orResolvedDefault(getString(input, "ai_provider", ""), config.DefaultRuntime())
 
-	_, paths, err := ensurePaths(repoPath, artifactsDir)
+	base, paths, err := ensurePaths(repoPath, artifactsDir)
 	if err != nil {
 		return nil, err
 	}
@@ -350,13 +356,17 @@ func RunArchitect(ctx context.Context, deps *Deps, input map[string]any) (any, e
 		SystemPrompt:   systemPrompt,
 		Cwd:            repoPath,
 	}.ToOptions()
-	parsed, res, err := harnessx.Run[schemas.Architecture](ctx, deps.Harness, taskPrompt, opts)
+	parsed, err := runSchemaBoundRole[schemas.Architecture](
+		ctx, deps, opts, taskPrompt,
+		filepath.Join(base, "plan", "architect_raw_response.txt"),
+		"Architect",
+		"Architect failed to produce a valid architecture",
+		provider, model,
+		planningRoleSchemaRetries,
+	)
 	if err != nil {
 		return nil, err
 	}
-	if res == nil || res.Parsed == nil {
-		return nil, errors.New("Architect failed to produce a valid architecture")
-	}
 
 	deps.App.Note(ctx, "Architect complete", "architect", "complete")
 	return toMap(parsed)
@@ -414,13 +424,17 @@ func RunTechLead(ctx context.Context, deps *Deps, input map[string]any) (any, er
 		SystemPrompt:   systemPrompt,
 		Cwd:            repoPath,
 	}.ToOptions()
-	parsed, res, err := harnessx.Run[schemas.ReviewResult](ctx, deps.Harness, taskPrompt, opts)
+	parsed, err := runSchemaBoundRole[schemas.ReviewResult](
+		ctx, deps, opts, taskPrompt,
+		filepath.Join(base, "plan", "tech_lead_raw_response.txt"),
+		"Tech lead",
+		"Tech lead failed to produce a valid review",
+		provider, model,
+		planningRoleSchemaRetries,
+	)
 	if err != nil {
 		return nil, err
 	}
-	if res == nil || res.Parsed == nil {
-		return nil, errors.New("Tech lead failed to produce a valid review")
-	}
 
 	review, err := toMap(parsed)
 	if err != nil {
@@ -450,11 +464,296 @@ type sprintPlanOutput struct {
 	Rationale string                 `json:"rationale"`
 }
 
+// planningRoleSchemaRetries is the number of extra *outer* schema-bound harness
+// calls the product manager, architect and tech lead get when their structured
+// output does not parse/validate. These count harness() calls, not model runs:
+// the SDK retries schema failures inside one call (DEFAULT_SCHEMA_RETRIES = 2),
+// so one outer attempt can be up to three subprocess runs. Kept small on
+// purpose: each attempt is a full stage run over the PRD and architecture.
+const planningRoleSchemaRetries = 1
+
+// sprintPlannerSchemaRetries is the outer-call bound for the sprint planner.
+// Its response is a large issue set that feeds every downstream issue, and one
+// extra outer attempt than the other stages is enough; each outer attempt is
+// itself up to three subprocess runs via the SDK's in-call schema retries, so
+// the subprocess ceiling is three times these constants. Mirrors Python's
+// PLANNING_ROLE_SCHEMA_RETRIES / SPRINT_PLANNER_SCHEMA_RETRIES
+// (swe_af/reasoners/pipeline.py, #146). These are internal constants rather
+// than handler inputs because nothing passes a different value.
+const sprintPlannerSchemaRetries = 2
+
+// maxRawResponseChars caps one failed attempt's raw text in the retry log. The
+// first and last halves are kept — output-limit truncation shows at the tail,
+// malformed-JSON evidence usually at the head — and the middle 
```

**File**: `go/internal/roles/planning/planning_test.go` (modified, +557/-15)
```diff
@@ -106,6 +106,40 @@ func sortedSet(m map[string]bool) []string {
 	return out
 }
 
+// badSchemaResult builds a harness result that produced raw text which failed
+// schema validation.
+func badSchemaResult(raw string) *harness.Result {
+	return &harness.Result{
+		IsError:      true,
+		Parsed:       nil,
+		Result:       raw,
+		FailureType:  harness.FailureSchema,
+		ErrorMessage: "Schema validation failed after retries.",
+	}
+}
+
+// assertRetryLog checks that an append-only stage retry log carries a run
+// header and contains the wanted snippets and its terminal outcome line.
+func assertRetryLog(t *testing.T, path string, want []string, outcome string) {
+	t.Helper()
+	blob, err := os.ReadFile(path)
+	if err != nil {
+		t.Fatalf("expected retry log at %s: %v", path, err)
+	}
+	log := string(blob)
+	if !strings.Contains(log, "===== run ") || !strings.Contains(log, " | started ") {
+		t.Fatalf("retry log missing run header:\n%s", log)
+	}
+	for _, snippet := range want {
+		if !strings.Contains(log, snippet) {
+			t.Fatalf("retry log missing %q:\n%s", snippet, log)
+		}
+	}
+	if !strings.Contains(log, outcome) {
+		t.Fatalf("retry log missing outcome %q:\n%s", outcome, log)
+	}
+}
+
 // --- run_product_manager ----------------------------------------------------
 
 // Contract: on success PM returns a PRD model_dump (the full PRD key set).
@@ -201,16 +235,29 @@ func TestProductManagerDirectCallRuntimeDefaults(t *testing.T) {
 	})
 }
 
-// Contract: parse failure raises (not a fallback).
+// Contract: parse failure raises after the bounded retries, naming the stage
+// and the failing field, with the raw response and terminal outcome retained.
 func TestProductManagerParseFailureRaises(t *testing.T) {
+	repo := t.TempDir()
+	raw := `{"validated_description": 7}`
 	h := &fakeHarness{fn: func(_ int, _ string, _ any, _ harness.Options) (*harness.Result, error) {
-		return &harness.Result{IsError: true, ErrorMessage: "schema validation failed", Parsed: nil}, nil
+		return badSchemaResult(raw), nil
 	}}
 	deps, _ := newDeps(h)
-	_, err := RunProductManager(context.Background(), deps, map[string]any{"repo_path": t.TempDir()})
-	if err == nil || !strings.Contains(err.Error(), "Product manager failed to produce a valid PRD") {
+	_, err := RunProductManager(context.Background(), deps, map[string]any{"repo_path": repo})
+	if err == nil || !strings.Contains(err.Error(), "Product manager failed to produce a valid PRD after 2 attempt(s)") {
 		t.Fatalf("expected PRD failure error, got %v", err)
 	}
+	if !strings.Contains(err.Error(), "validated_description") {
+		t.Fatalf("expected the failing field named in the error, got %v", err)
+	}
+	if h.calls != 2 {
+		t.Fatalf("expected 2 attempts (1 retry), got %d", h.calls)
+	}
+	assertRetryLog(t,
+		filepath.Join(repo, ".artifacts", "plan", "product_manager_raw_response.txt"),
+		[]string{raw, "attempt 1/2 failed"},
+		"outcome: FAILED after 2 attempt(s)")
 }
 
 // Contract: a fatal harness error propagates as *FatalHarnessError.
@@ -409,16 +456,29 @@ func TestArchitectIncludesFeedback(t *testing.T) {
 	}
 }
 
-// Contract: parse failure raises.
+// Contract: parse failure raises after the bounded retries, naming the stage
+// and the failing field, with the raw response and terminal outcome retained.
 func TestArchitectParseFailureRaises(t *testing.T) {
+	repo := t.TempDir()
+	raw := `{"summary": 7}`
 	h := &fakeHarness{fn: func(_ int, _ string, _ any, _ harness.Options) (*harness.Result, error) {
-		return &harness.Result{IsError: true, Parsed: nil}, nil
+		return badSchemaResult(raw), nil
 	}}
 	deps, _ := newDeps(h)
-	_, err := RunArchitect(context.Background(), deps, map[string]any{"repo_path": t.TempDir()})
-	if err == nil || !strings.Contains(err.Error(), "Architect failed to produce a valid architecture") {
+	_, err := RunArchitect(context.Background(), deps, map[string]any{"repo_path": repo})
+	if err == nil || !strings.Contains(err.Error(), "Architect failed to produce a valid architecture after 2 attempt(s)") {
 		t.Fatalf("expected architect failure error, got %v", err)
 	}
+	if !strings.Contains(err.Error(), "summary") {
+		t.Fatalf("expected the failing field named in the error, got %v", err)
+	}
+	if h.calls != 2 {
+		t.Fatalf("expected 2 attempts (1 retry), got %d", h.calls)
+	}
+	assertRetryLog(t,
+		filepath.Join(repo, ".artifacts", "plan", "architect_raw_response.txt"),
+		[]string{raw, "attempt 1/2 failed"},
+		"outcome: FAILED after 2 attempt(s)")
 }
 
 // --- run_tech_lead ----------------------------------------------------------
@@ -454,16 +514,320 @@ func TestTechLeadWritesReviewJSON(t *testing.T) {
 	}
 }
 
-// Contract: parse failure raises.
+// Contract: parse failure raises after the bounded retries, naming the stage
+// and the failing field, with the raw response and terminal outcome retained.
 func TestTechLeadParseFailureRaises(t *testing.T) {
+	repo := t.TempDir()
+	raw := `{"approved": 3, "feedback": "ok", "summary": "x"}`
 	h := &fak
```

**File**: `swe_af/reasoners/pipeline.py` (modified, +403/-70)
```diff
@@ -7,12 +7,14 @@
 
 from __future__ import annotations
 
+import asyncio
 import json
 import os
 from collections import defaultdict, deque
+from datetime import datetime, timezone
 from pathlib import Path
 
-from pydantic import BaseModel
+from pydantic import BaseModel, ValidationError
 
 from swe_af.execution.fatal_error import (
     check_empty_harness_completion,
@@ -154,6 +156,300 @@ def _assign_sequence_numbers(issues: list[dict], levels: list[list[str]]) -> lis
     return list(issue_by_name.values())
 
 
+# Per-stage bounds on the extra *outer* schema-bound harness calls a planning
+# role gets when its structured output does not parse or validate. These count
+# router.harness() calls, not model runs: the SDK already retries schema
+# failures inside one harness() call (DEFAULT_SCHEMA_RETRIES = 2), so a single
+# outer attempt can itself be up to three subprocess runs. The outer bounds
+# re-issue the whole call with the validation error fed back into the task
+# prompt (issue #146). Keep them small — each attempt is a full stage run over
+# the PRD and architecture, and the architect's architecture object is by far
+# the largest response in the pipeline. The bounds are internal constants, not
+# user-facing knobs: nothing has ever passed a different value.
+PLANNING_ROLE_SCHEMA_RETRIES = 1
+SPRINT_PLANNER_SCHEMA_RETRIES = 2
+
+# Cap on how much of one failed attempt's raw completion is written to the
+# retry log. The first and last halves are kept — output-limit truncation is
+# visible at the tail, malformed-JSON evidence usually at the head — and the
+# middle is elided, so the default three attempts cannot grow the log without
+# bound.
+_MAX_RAW_RESPONSE_CHARS = 200_000
+
+
+def _raw_completion_text(result) -> str:
+    """Best-effort raw completion text from a HarnessResult-like object."""
+    raw = getattr(result, "result", None)
+    if not raw:
+        raw = getattr(result, "text", None)
+    return raw or ""
+
+
+def _planning_run_id() -> str:
+    """Identifier of the build this planning call belongs to.
+
+    Used for the retry log's per-run header (so a log appended to across builds
+    stays self-describing) and to find the credentials the scout negotiated for
+    this run. Falls back to a stable placeholder when no context is attached
+    (tests, direct invocation).
+    """
+    ctx = getattr(router, "ctx", None)
+    run_id = (
+        getattr(ctx, "run_id", None)
+        or getattr(ctx, "root_workflow_id", None)
+        or ""
+    )
+    return str(run_id) if run_id else "unknown-run"
+
+
+def _redact_scoped_credentials(text: str) -> str:
+    """Replace any run-scoped credential value with a marker.
+
+    The harness subprocess inherits the scout's scoped credentials, so a
+    response that echoes one can otherwise land in the archived retry log. The
+    values are replaced longest-first so a shorter value cannot split a longer
+    one.
+    """
+    if not text:
+        return text
+    try:
+        from swe_af.hitl.credentials_store import get_scoped_credentials  # noqa: PLC0415
+    except Exception:  # pragma: no cover - diagnostics must never fail a stage
+        return text
+    try:
+        creds = get_scoped_credentials(_planning_run_id())
+    except Exception:  # pragma: no cover - diagnostics must never fail a stage
+        return text
+    for name, value in sorted(
+        creds.items(), key=lambda item: len(item[1]), reverse=True
+    ):
+        if value:
+            text = text.replace(value, f"[REDACTED:{name}]")
+    return text
+
+
+def _describe_schema_failure(result, schema) -> str:
+    """Describe a schema-bound harness call that produced no parsed result.
+
+    Re-validates the raw completion against *schema* when it is available so
+    the message names the parser error or the failing fields. Falls back to the
+    harness's own ``error_message`` (the SDK's terminal schema-failure path
+    carries its diagnosis there) and then to a generic description.
+    """
+    raw = _raw_completion_text(result)
+    detail = (getattr(result, "error_message", "") or "").strip()
+    if raw.strip():
+        try:
+            data = json.loads(raw)
+        except (ValueError, TypeError) as exc:
+            parse_error = f"raw response is not valid JSON ({exc})"
+        else:
+            try:
+                schema.model_validate(data)
+            except ValidationError as exc:
+                fields = "; ".join(
+                    f"{'.'.join(str(part) for part in err['loc']) or '<root>'}: "
+                    f"{err['msg']}"
+                    for err in exc.errors()[:10]
+                )
+                parse_error = f"raw response failed schema validation ({fields})"
+            except Exception as exc:  # defensive: surface any validator error
+                parse_error = f"raw response failed schema validation ({exc})"
+            else:
+                parse_error = "the harness returned no parsed result"
+      
```

**File**: `tests/test_planning_roles_schema_retry.py` (added, +440/-0)
```diff
@@ -0,0 +1,440 @@
+"""Regression tests for issue #146: a planning stage must survive an
+unparseable structured response.
+
+A schema-invalid response must not end the run on its own. These tests stub the
+harness with unparseable output and assert that each planning stage (product
+manager, architect, tech lead, sprint planner):
+
+- retries a bounded number of times, feeding the validation error back into the
+  retry prompt,
+- appends a self-describing run header per invocation, every failed attempt,
+  and a terminal outcome line on every exit (recovery, bound exhaustion, or a
+  fatal/empty result on a retry) to its own retry log next to the plan
+  artifacts, so a reader can tell recovery from death,
+- redacts run-scoped credential values before anything reaches that log,
+- names the stage, the schema error, the failing fields, and the log path once
+  the bound is exhausted, and
+- treats an unwritable retry log as a diagnostic problem, never as the failure.
+
+Ref: https://github.com/Agent-Field/SWE-AF/issues/146
+"""
+
+from __future__ import annotations
+
+import asyncio
+import json
+from dataclasses import dataclass
+from types import SimpleNamespace
+from unittest.mock import AsyncMock, MagicMock, patch
+
+import pytest
+
+from swe_af.execution.fatal_error import (
+    EmptyHarnessCompletionError,
+    FatalHarnessError,
+)
+from swe_af.reasoners.schemas import (
+    Architecture,
+    PRD,
+    PlannedIssue,
+    ReviewResult,
+)
+
+_PRD = {
+    "validated_description": "Build a fixture.",
+    "acceptance_criteria": ["AC-1"],
+    "must_have": ["feature-a"],
+    "nice_to_have": [],
+    "out_of_scope": [],
+    "assumptions": [],
+    "risks": [],
+}
+_ARCH = {
+    "summary": "One component.",
+    "components": [
+        {
+            "name": "component-a",
+            "responsibility": "Does A",
+            "touches_files": ["a.py"],
+            "depends_on": [],
+        }
+    ],
+    "interfaces": ["interface-1"],
+    "decisions": [{"decision": "Use Python", "rationale": "It is available."}],
+    "file_changes_overview": "Only a.py changes.",
+}
+
+
+@dataclass(frozen=True)
+class _StageCase:
+    """One planning stage's retry surface."""
+
+    key: str
+    artifact: str  # log file name under plan/
+    role: str  # role in empty-completion and retry notes
+    failure_label: str  # start of the raised error once the bound is exhausted
+    bad_raw: str  # schema-invalid completion with a nameable failing field
+    failing_field: str  # field the validation error must name
+    retries: int  # extra attempts beyond the first
+
+
+_PM = _StageCase(
+    key="product_manager",
+    artifact="product_manager_raw_response.txt",
+    role="PM",
+    failure_label="Product manager failed to produce a valid PRD",
+    bad_raw='{"validated_description": 7}',
+    failing_field="validated_description",
+    retries=1,
+)
+_ARCHITECT = _StageCase(
+    key="architect",
+    artifact="architect_raw_response.txt",
+    role="Architect",
+    failure_label="Architect failed to produce a valid architecture",
+    bad_raw='{"summary": 7}',
+    failing_field="summary",
+    retries=1,
+)
+_TECH_LEAD = _StageCase(
+    key="tech_lead",
+    artifact="tech_lead_raw_response.txt",
+    role="Tech lead",
+    failure_label="Tech lead failed to produce a valid review",
+    bad_raw='{"approved": 3, "feedback": "ok", "summary": "x"}',
+    failing_field="approved",
+    retries=1,
+)
+# Two extra attempts: the planner's issue set feeds every downstream issue.
+_SPRINT_PLANNER = _StageCase(
+    key="sprint_planner",
+    artifact="sprint_planner_raw_response.txt",
+    role="Sprint planner",
+    failure_label="Sprint planner failed to produce valid issues",
+    bad_raw='{"issues": "not-a-list", "rationale": 7}',
+    failing_field="issues",
+    retries=2,
+)
+_NEW_STAGES = [_PM, _ARCHITECT, _TECH_LEAD]
+_ALL_STAGES = [*_NEW_STAGES, _SPRINT_PLANNER]
+
+
+@pytest.fixture(autouse=True)
+def _disable_hax(monkeypatch):
+    """Keep the PM ask-user wrapper single-shot."""
+    monkeypatch.delenv("HAX_API_KEY", raising=False)
+
+
+def _log_path(repo_path, case: _StageCase):
+    return repo_path.joinpath(".artifacts", "plan", case.artifact)
+
+
+def _ok_result(case: _StageCase) -> SimpleNamespace:
+    if case.key == "product_manager":
+        parsed = PRD(
+            validated_description="Build a fixture.",
+            acceptance_criteria=["AC-1"],
+            must_have=["feature-a"],
+            nice_to_have=[],
+            out_of_scope=[],
+        )
+    elif case.key == "architect":
+        parsed = Architecture(**_ARCH)
+    elif case.key == "tech_lead":
+        parsed = ReviewResult(approved=True, feedback="Looks good.", summary="Approved.")
+    else:
+        parsed = SimpleNamespace(
+            issues=[
+                PlannedIssue(
+                    name="issue-a",
+                    title="Issue A",
+                    description="Do A.",
+                    ac
```

---

### Incident Patch 3: `10c31797` (2026-09-21)
**Commit Message**: fix(planning): a stalled architect revision no longer discards the whole plan (#151)

* fix(architect): revise the existing architecture instead of redesigning it

The architect revision reuses the first-pass prompt verbatim, so a revision
still told the model to "read the codebase deeply first" and to write the
architecture document from scratch — on top of a prompt that now also carries
the tech lead's findings. On a large plan that makes the revision strictly more
expensive than the first pass it is supposed to amend, which is how a revision
of an 85 KB architecture ends up running past the harness time budget.

When feedback is present the mission section now asks for a targeted revision:
read the existing document, address every finding, keep what the review did not
challenge, and re-read only the parts of the codebase the findings touch. The
first-pass prompt is byte-for-byte unchanged, which the Go golden test for the
no-feedback case still proves.

Refs #149

Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>

* fix(planning): report a harness timeout as a timeout, not an empty completion

A harness killed by AGENTFIELD_HARNESS_TIMEOUT_SECONDS or the idle window


**File**: `docs/ARCHITECTURE.md` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@ The planning chain is a five-agent pipeline that progressively refines a vague g
 
 2. **Architect** — reads the PRD and codebase, produces a system design: components, interfaces, architectural decisions with rationale, and a file-changes overview.
 
-3. **Tech Lead** — reviews the architecture against the PRD in a bounded loop (up to `max_review_iterations + 1` rounds). If not approved, the Architect revises. If the loop exhausts, the last revision is auto-approved — the system never blocks on infinite review cycles.
+3. **Tech Lead** — reviews the architecture against the PRD in a bounded loop (up to `max_review_iterations + 1` rounds). If not approved, the Architect revises, editing the existing architecture document rather than redesigning it from scratch. If the loop exhausts, the last revision is auto-approved — the system never blocks on infinite review cycles. If a revision itself fails (its harness times out, returns nothing, or produces an unparseable response), the pipeline keeps the last completed architecture, records the reason in the review summary, and carries on to the Sprint Planner — a revision that cannot finish costs the revision, not the whole plan. A fatal API error (billing, invalid credentials) still aborts the run.
 
 4. **Sprint Planner** — decomposes the approved architecture into `PlannedIssue` items. Each issue has a name, acceptance criteria mapped from the PRD, dependency edges (`depends_on`), file manifests (`files_to_create`, `files_to_modify`), and — critically — an `IssueGuidance` block:
 
```

**File**: `go/internal/fatal/fatal.go` (modified, +76/-0)
```diff
@@ -14,6 +14,7 @@ package fatal
 import (
 	"fmt"
 	"regexp"
+	"strings"
 
 	"github.com/Agent-Field/agentfield/sdk/go/harness"
 )
@@ -42,6 +43,19 @@ var fatalPatterns = compilePatterns(
 	`requires a newer version of codex`,
 )
 
+// timeoutPatterns mirrors _TIMEOUT_PATTERNS in fatal_error.py. They are only
+// used for empty harness results and match actual timeout events rather than
+// configuration errors that merely mention the word "timeout".
+var timeoutPatterns = compilePatterns(
+	`cli command timed out after`,
+	`cli command made no progress for`,
+	`timed out`,
+	`made no progress for`,
+	`timeout exceeded`,
+	`timeout after`,
+	`deadline exceeded`,
+)
+
 // compilePatterns compiles each pattern once with the case-insensitive flag.
 func compilePatterns(patterns ...string) []*regexp.Regexp {
 	compiled := make([]*regexp.Regexp, len(patterns))
@@ -63,6 +77,33 @@ type FatalHarnessError struct {
 	OriginalMessage string
 }
 
+// HarnessTimeoutError reports that a role exhausted its overall or idle
+// harness time budget before producing output.
+type HarnessTimeoutError struct {
+	Role            string
+	Provider        string
+	Model           string
+	OriginalMessage string
+}
+
+// Error returns the same message as Python's HarnessTimeoutError.
+func (e *HarnessTimeoutError) Error() string {
+	message := fmt.Sprintf(
+		"%s harness timed out (provider=%s, model=%s) — the stage exceeded its harness time budget and was killed before writing any output",
+		e.Role, e.Provider, e.Model,
+	)
+	if detail := e.OriginalMessage; detail != "" {
+		// Provider messages usually already end in a period; drop that one so
+		// the sentence that follows does not read as "..". An ellipsis is left
+		// alone.
+		if strings.HasSuffix(detail, ".") && !strings.HasSuffix(detail, "..") {
+			detail = detail[:len(detail)-1]
+		}
+		message += ": " + detail
+	}
+	return message + ". Raise AGENTFIELD_HARNESS_TIMEOUT_SECONDS / AGENTFIELD_HARNESS_IDLE_SECONDS, or reduce the stage's scope."
+}
+
 // Error returns the wrapped message, byte-identical to the Python exception's
 // str() form.
 func (e *FatalHarnessError) Error() string {
@@ -83,6 +124,20 @@ func IsFatalError(errorMessage string) bool {
 	return false
 }
 
+// IsTimeoutError reports whether msg matches a harness timeout or idle-kill
+// message. An empty string is never a timeout.
+func IsTimeoutError(msg string) bool {
+	if msg == "" {
+		return false
+	}
+	for _, p := range timeoutPatterns {
+		if p.MatchString(msg) {
+			return true
+		}
+	}
+	return false
+}
+
 // CheckFatalHarnessError inspects a harness result and returns a
 // *FatalHarnessError if it indicates a non-retryable API failure, or nil
 // otherwise.
@@ -101,3 +156,24 @@ func CheckFatalHarnessError(result *harness.Result) error {
 	}
 	return nil
 }
+
+// CheckHarnessTimeout returns a typed timeout error for an empty harness
+// result carrying either failure_type=timeout or recognized timeout wording.
+// Parsed output, raw text, and schema failures remain the caller's concern.
+func CheckHarnessTimeout(result *harness.Result, role, provider, model string) error {
+	if result == nil || result.Parsed != nil || strings.TrimSpace(result.Result) != "" {
+		return nil
+	}
+	if result.FailureType == harness.FailureSchema {
+		return nil
+	}
+	if result.FailureType != harness.FailureTimeout && !IsTimeoutError(result.ErrorMessage) {
+		return nil
+	}
+	return &HarnessTimeoutError{
+		Role:            role,
+		Provider:        provider,
+		Model:           model,
+		OriginalMessage: strings.TrimSpace(result.ErrorMessage),
+	}
+}
```

**File**: `go/internal/fatal/fatal_test.go` (modified, +126/-0)
```diff
@@ -2,6 +2,7 @@ package fatal
 
 import (
 	"errors"
+	"strings"
 	"testing"
 
 	"github.com/Agent-Field/agentfield/sdk/go/harness"
@@ -109,3 +110,128 @@ func TestCheckFatalHarnessError(t *testing.T) {
 		}
 	})
 }
+
+func TestIsTimeoutError(t *testing.T) {
+	// VC1/VC9: both overall timeout and idle-kill wording are recognized.
+	cases := []string{
+		"CLI command timed out after 5400s: opencode run ...",
+		"CLI command made no progress for 300.0s: opencode run ...",
+		"request timed out while waiting for CLI",
+		"request timeout exceeded while waiting for CLI",
+		"request timeout after 30 seconds",
+		"request deadline exceeded",
+	}
+	for _, msg := range cases {
+		if !IsTimeoutError(msg) {
+			t.Errorf("IsTimeoutError(%q) = false, want true", msg)
+		}
+	}
+	for _, msg := range []string{
+		"",
+		"temporary network failure",
+		"invalid timeout value",
+		"timeout must be a positive integer",
+	} {
+		if IsTimeoutError(msg) {
+			t.Errorf("IsTimeoutError(%q) = true, want false", msg)
+		}
+	}
+}
+
+func TestHarnessTimeoutErrorMessage(t *testing.T) {
+	// VC1/VC9: the Go message is byte-identical to the Python timeout message.
+	e := &HarnessTimeoutError{
+		Role:            "Architect",
+		Provider:        "opencode",
+		Model:           "openrouter/example-model",
+		OriginalMessage: "CLI command timed out after 5400s",
+	}
+	want := "Architect harness timed out (provider=opencode, model=openrouter/example-model) — " +
+		"the stage exceeded its harness time budget and was killed before writing any output: " +
+		"CLI command timed out after 5400s. Raise AGENTFIELD_HARNESS_TIMEOUT_SECONDS / " +
+		"AGENTFIELD_HARNESS_IDLE_SECONDS, or reduce the stage's scope."
+	if got := e.Error(); got != want {
+		t.Errorf("Error() = %q, want %q", got, want)
+	}
+
+	withoutDetail := (&HarnessTimeoutError{
+		Role: "Architect", Provider: "opencode", Model: "model-x",
+	}).Error()
+	if !strings.Contains(withoutDetail, "writing any output. Raise") ||
+		strings.Contains(withoutDetail, "writing any output:") {
+		t.Errorf("detail-free Error() has bad punctuation: %q", withoutDetail)
+	}
+}
+
+func TestCheckHarnessTimeout(t *testing.T) {
+	tests := []struct {
+		name    string
+		result  *harness.Result
+		wantErr bool
+	}{
+		{
+			name: "failure token",
+			result: &harness.Result{
+				IsError: true, FailureType: harness.FailureTimeout,
+				ErrorMessage: "worker was killed",
+			},
+			wantErr: true,
+		},
+		{
+			name: "message fallback",
+			result: &harness.Result{
+				IsError: true, ErrorMessage: "CLI command timed out after 5s",
+			},
+			wantErr: true,
+		},
+		{
+			name: "ambiguous text with timeout token",
+			result: &harness.Result{
+				IsError: true, FailureType: harness.FailureTimeout,
+				ErrorMessage: "invalid timeout value",
+			},
+			wantErr: true,
+		},
+		{
+			name: "ambiguous text without timeout token",
+			result: &harness.Result{
+				IsError: true, ErrorMessage: "invalid timeout value",
+			},
+		},
+		{
+			name: "raw text defers to schema path",
+			result: &harness.Result{
+				IsError: true, Result: "invalid JSON", FailureType: harness.FailureTimeout,
+			},
+		},
+		{
+			name: "schema token defers to schema path",
+			result: &harness.Result{
+				IsError: true, FailureType: harness.FailureSchema,
+				ErrorMessage: "CLI command timed out after 5s",
+			},
+		},
+		{
+			name: "parsed result is not empty",
+			result: &harness.Result{
+				Parsed: map[string]any{"ok": true}, FailureType: harness.FailureTimeout,
+			},
+		},
+		{name: "nil", result: nil},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			err := CheckHarnessTimeout(tt.result, "Architect", "opencode", "model-x")
+			var timeoutErr *HarnessTimeoutError
+			if got := errors.As(err, &timeoutErr); got != tt.wantErr {
+				t.Fatalf("errors.As(timeout) = %v, want %v (err=%v)", got, tt.wantErr, err)
+			}
+			if timeoutErr != nil {
+				if timeoutErr.Role != "Architect" || timeoutErr.Provider != "opencode" || timeoutErr.Model != "model-x" {
+					t.Errorf("unexpected timeout metadata: %+v", timeoutErr)
+				}
+			}
+		})
+	}
+}
```

**File**: `go/internal/orch/approval_gate.go` (modified, +88/-35)
```diff
@@ -175,11 +175,17 @@ func PlanApprovalGate(ctx context.Context, req ApprovalRequest) (ApprovalOutcome
 				revisionIter, runeTruncate(feedback, 200)),
 				"build", "approval", "request_changes")
 
-			revised, err := replanWithFeedback(ctx, req, planResult, feedback)
+			revised, revisionErr, err := replanWithFeedback(ctx, req, planResult, feedback)
 			if err != nil {
 				return ApprovalOutcome{}, err
 			}
 			planResult = revised
+			if revisionErr != "" {
+				revisionHistory[len(revisionHistory)-1]["revision_error"] = revisionErr
+				deps.Note(ctx,
+					"Architecture revision did not complete — re-submitting the last completed plan for review rather than building past the approval gate",
+					"build", "approval", "revision", "degraded")
+			}
 			continue
 		}
 
@@ -259,17 +265,30 @@ func pauseForApproval(
 }
 
 // replanWithFeedback re-runs Architect → Tech Lead loop → Sprint Planner with
-// the reviewer feedback and returns the revised plan_result (app.py:881-951).
-// PM is skipped (the PRD/scope is fixed).
-func replanWithFeedback(ctx context.Context, req ApprovalRequest, planResult map[string]any, feedback string) (map[string]any, error) {
+// the reviewer feedback and returns the revised plan_result plus any degraded
+// revision reason (app.py:881-951). PM is skipped (the PRD/scope is fixed).
+func replanWithFeedback(
+	ctx context.Context,
+	req ApprovalRequest,
+	planResult map[string]any,
+	feedback string,
+) (map[string]any, string, error) {
 	deps := req.Deps
 	cfg := req.Cfg
 	resolved := req.Resolved
 	prd := mapGet(planResult, "prd", map[string]any{})
 	manifest := req.ManifestMap
 	provider := cfg.AIProvider()
+	architecturePath := architectureArtifactPath(req.RepoPath, req.ArtifactsDir)
+	arch, _ := mapGet(planResult, "architecture", map[string]any{}).(map[string]any)
+	if arch == nil {
+		arch = map[string]any{}
+	}
+	review, _ := planResult["review"].(map[string]any)
+	revisionErr := ""
 
-	arch, err := deps.Call(ctx, "run_architect", map[string]any{
+	architectureSnapshot := snapshotArchitectureBeforeRevision(ctx, deps, architecturePath)
+	revisedArch, err := deps.Call(ctx, "run_architect", map[string]any{
 		"prd":                prd,
 		"repo_path":          req.RepoPath,
 		"artifacts_dir":      req.ArtifactsDir,
@@ -280,47 +299,81 @@ func replanWithFeedback(ctx context.Context, req ApprovalRequest, planResult map
 		"workspace_manifest": manifest,
 	}, "run_architect (human revision)")
 	if err != nil {
-		return nil, err
+		if isNonDegradableRevisionError(err) {
+			return nil, "", err
+		}
+		restoreArchitectureAfterFailedRevision(ctx, deps, architecturePath, architectureSnapshot)
+		revisionErr = truncateRevisionError(err.Error())
+		deps.Note(ctx,
+			"Architecture revision did not complete; keeping the last completed architecture: "+revisionErr,
+			"pipeline", "revision", "degraded")
+	} else {
+		arch = revisedArch
+		review = nil
 	}
 
-	var review map[string]any
-	for tlIter := 0; tlIter <= cfg.MaxReviewIterations; tlIter++ {
-		review, err = deps.Call(ctx, "run_tech_lead", map[string]any{
-			"prd":                prd,
-			"repo_path":          req.RepoPath,
-			"artifacts_dir":      req.ArtifactsDir,
-			"revision_number":    tlIter,
-			"model":              resolved["tech_lead_model"],
-			"permission_mode":    cfg.PermissionMode,
-			"ai_provider":        provider,
-			"workspace_manifest": manifest,
-		}, "run_tech_lead")
-		if err != nil {
-			return nil, err
-		}
-		if asBool(review["approved"]) {
-			break
-		}
-		if tlIter < cfg.MaxReviewIterations {
-			arch, err = deps.Call(ctx, "run_architect", map[string]any{
+	if revisionErr == "" {
+		for tlIter := 0; tlIter <= cfg.MaxReviewIterations; tlIter++ {
+			review, err = deps.Call(ctx, "run_tech_lead", map[string]any{
 				"prd":                prd,
 				"repo_path":          req.RepoPath,
 				"artifacts_dir":      req.ArtifactsDir,
-				"feedback":           mapStr(review, "feedback", ""),
-				"model":              resolved["architect_model"],
+				"revision_number":    tlIter,
+				"model":              resolved["tech_lead_model"],
 				"permission_mode":    cfg.PermissionMode,
 				"ai_provider":        provider,
 				"workspace_manifest": manifest,
-			}, "run_architect (tech lead revision)")
+			}, "run_tech_lead")
 			if err != nil {
-				return nil, err
+				return nil, "", err
+			}
+			if asBool(review["approved"]) {
+				break
+			}
+			if tlIter < cfg.MaxReviewIterations {
+				architectureSnapshot = snapshotArchitectureBeforeRevision(ctx, deps, architecturePath)
+				revisedArch, err = deps.Call(ctx, "run_architect", map[string]any{
+					"prd":                prd,
+					"repo_path":          req.RepoPath,
+					"artifacts_dir":      req.ArtifactsDir,
+					"feedback":           mapStr(review, "feedback", ""),
+					"model":              resolved["architect_model"],
+					"permission_mode":    cfg.PermissionMode,
+					"ai_provider":        provider,
+					"workspace_manifest": manifest,
+
```

**File**: `go/internal/orch/approval_gate_test.go` (modified, +208/-0)
```diff
@@ -3,8 +3,12 @@ package orch
 import (
 	"context"
 	"encoding/json"
+	"errors"
+	"io"
 	"net/http"
 	"net/http/httptest"
+	"os"
+	"path/filepath"
 	"reflect"
 	"strings"
 	"sync/atomic"
@@ -14,6 +18,7 @@ import (
 	"github.com/Agent-Field/agentfield/sdk/go/agent"
 
 	"github.com/Agent-Field/SWE-AF/go/internal/config"
+	"github.com/Agent-Field/SWE-AF/go/internal/fatal"
 	"github.com/Agent-Field/SWE-AF/go/internal/hitl"
 )
 
@@ -222,6 +227,209 @@ func TestApprovalChangesThenApproved(t *testing.T) {
 	}
 }
 
+func TestReplanWithFeedbackRevisionFailureDegrades(t *testing.T) {
+	for _, failureAt := range []string{"human", "tech_lead"} {
+		t.Run(failureAt, func(t *testing.T) {
+			repoPath := t.TempDir()
+			architecturePath := architectureArtifactPath(repoPath, ".artifacts")
+			if err := os.MkdirAll(filepath.Dir(architecturePath), 0o755); err != nil {
+				t.Fatal(err)
+			}
+			originalBytes := []byte("# Initial completed architecture\n")
+			revisedBytes := []byte("# Human revision\n")
+			if err := os.WriteFile(architecturePath, originalBytes, 0o644); err != nil {
+				t.Fatal(err)
+			}
+
+			plan := samplePlan()
+			plan["review"] = approvedReview()
+			originalArch := plan["architecture"]
+			humanArch := map[string]any{"summary": "human revision"}
+			architectCalls := 0
+			sprintCalls := 0
+			app := &mockApp{handler: func(_ context.Context, target string, input map[string]any) (map[string]any, error) {
+				switch {
+				case strings.HasSuffix(target, ".run_architect"):
+					architectCalls++
+					shouldFail := failureAt == "human" && architectCalls == 1 ||
+						failureAt == "tech_lead" && architectCalls == 2
+					if shouldFail {
+						if err := os.WriteFile(architecturePath, []byte("partial"), 0o644); err != nil {
+							t.Fatal(err)
+						}
+						return nil, errors.New("architect subprocess crashed")
+					}
+					if err := os.WriteFile(architecturePath, revisedBytes, 0o644); err != nil {
+						t.Fatal(err)
+					}
+					return humanArch, nil
+				case strings.HasSuffix(target, ".run_tech_lead"):
+					return rejectedReview(), nil
+				case strings.HasSuffix(target, ".run_sprint_planner"):
+					sprintCalls++
+					return sprintResult(issue("i2", nil, nil)), nil
+				default:
+					return map[string]any{}, nil
+				}
+			}}
+			deps := &Deps{App: app, NodeID: "swe-planner"}
+			reqValue := req(deps, testCfg(t, 2), plan, filepath.Join(repoPath, ".artifacts"))
+			reqValue.RepoPath = repoPath
+
+			revised, revisionErr, err := replanWithFeedback(
+				context.Background(), reqValue, plan, "please fix it",
+			)
+			if err != nil {
+				t.Fatalf("replanWithFeedback: %v", err)
+			}
+			if revisionErr != "architect subprocess crashed" {
+				t.Fatalf("revision error = %q", revisionErr)
+			}
+			if sprintCalls != 1 {
+				t.Fatalf("sprint planner calls = %d, want 1", sprintCalls)
+			}
+
+			wantArch := originalArch
+			wantBytes := originalBytes
+			if failureAt == "tech_lead" {
+				wantArch = humanArch
+				wantBytes = revisedBytes
+			}
+			if !reflect.DeepEqual(revised["architecture"], wantArch) {
+				t.Errorf("architecture = %#v, want %#v", revised["architecture"], wantArch)
+			}
+			gotBytes, err := os.ReadFile(architecturePath)
+			if err != nil {
+				t.Fatal(err)
+			}
+			if !reflect.DeepEqual(gotBytes, wantBytes) {
+				t.Errorf("architecture bytes = %q, want %q", gotBytes, wantBytes)
+			}
+			review, _ := revised["review"].(map[string]any)
+			if !asBool(review["approved"]) || !strings.Contains(
+				mapStr(review, "summary", ""),
+				"[auto-approved: architecture revision did not complete: architect subprocess crashed]",
+			) {
+				t.Errorf("degraded review = %#v", review)
+			}
+		})
+	}
+}
+
+func TestReplanWithFeedbackFatalAndCancellationErrorsAbort(t *testing.T) {
+	tests := []struct {
+		name string
+		err  error
+	}{
+		{"fatal", &fatal.FatalHarnessError{OriginalMessage: "credit balance is too low"}},
+		{"cancelled", context.Canceled},
+		{"deadline", context.DeadlineExceeded},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			sprintCalls := 0
+			app := &mockApp{handler: func(_ context.Context, target string, _ map[string]any) (map[string]any, error) {
+				if strings.HasSuffix(target, ".run_architect") {
+					return nil, tt.err
+				}
+				if strings.HasSuffix(target, ".run_sprint_planner") {
+					sprintCalls++
+				}
+				return map[string]any{}, nil
+			}}
+			deps := &Deps{App: app, NodeID: "swe-planner"}
+			reqValue := req(deps, testCfg(t, 2), samplePlan(), t.TempDir())
+
+			_, _, err := replanWithFeedback(
+				context.Background(), reqValue, samplePlan(), "please fix it",
+			)
+			if tt.name == "fatal" {
+				var fatalErr *fatal.FatalHarnessError
+				if !errors.As(err, &fatalErr) {
+					t.Fatalf("error = %v, want fatal harness error", err)
+				}
+			} else if !errors.Is(err, tt.err) {
+				t.Fatalf("error = %v, want %v", err, tt.err)
+			}
+			if sprintCalls != 0 {
+				t.Fatalf("sprint planner called %d times after %s", sp
```

**File**: `go/internal/orch/plan.go` (modified, +129/-5)
```diff
@@ -1,8 +1,10 @@
 package orch
 
 import (
+	"bytes"
 	"context"
 	"encoding/json"
+	"errors"
 	"fmt"
 	"os"
 	"path/filepath"
@@ -12,6 +14,7 @@ import (
 
 	"github.com/Agent-Field/SWE-AF/go/internal/config"
 	"github.com/Agent-Field/SWE-AF/go/internal/dagutil"
+	"github.com/Agent-Field/SWE-AF/go/internal/fatal"
 	"github.com/Agent-Field/SWE-AF/go/internal/schemas"
 )
 
@@ -27,6 +30,92 @@ func RegisterPlan(m map[string]Handler) {
 	m["plan"] = PlanHandler
 }
 
+type architectureArtifactSnapshot struct {
+	existed  bool
+	contents []byte
+}
+
+func architectureArtifactPath(repoPath, artifactsDir string) string {
+	absRepo, err := filepath.Abs(repoPath)
+	if err != nil {
+		absRepo = repoPath
+	}
+	return filepath.Join(absRepo, artifactsDir, "plan", "architecture.md")
+}
+
+func snapshotArchitectureArtifact(path string) (*architectureArtifactSnapshot, error) {
+	contents, err := os.ReadFile(path)
+	if err == nil {
+		return &architectureArtifactSnapshot{existed: true, contents: contents}, nil
+	}
+	if errors.Is(err, os.ErrNotExist) {
+		return &architectureArtifactSnapshot{}, nil
+	}
+	return nil, err
+}
+
+func restoreArchitectureArtifact(path string, snapshot *architectureArtifactSnapshot) (bool, error) {
+	if snapshot == nil {
+		return false, nil
+	}
+	if snapshot.existed {
+		current, err := os.ReadFile(path)
+		if err != nil && !errors.Is(err, os.ErrNotExist) {
+			return false, err
+		}
+		if err == nil && bytes.Equal(current, snapshot.contents) {
+			return false, nil
+		}
+		if err := os.WriteFile(path, snapshot.contents, 0o644); err != nil {
+			return false, err
+		}
+		return true, nil
+	}
+
+	if err := os.Remove(path); err != nil {
+		if errors.Is(err, os.ErrNotExist) {
+			return false, nil
+		}
+		return false, err
+	}
+	return true, nil
+}
+
+func snapshotArchitectureBeforeRevision(
+	ctx context.Context, deps *Deps, path string,
+) *architectureArtifactSnapshot {
+	snapshot, err := snapshotArchitectureArtifact(path)
+	if err != nil {
+		deps.Note(ctx, "Could not snapshot plan/architecture.md before revision: "+err.Error(),
+			"pipeline", "revision", "degraded")
+		return nil
+	}
+	return snapshot
+}
+
+func restoreArchitectureAfterFailedRevision(
+	ctx context.Context, deps *Deps, path string, snapshot *architectureArtifactSnapshot,
+) {
+	restored, err := restoreArchitectureArtifact(path, snapshot)
+	if err != nil {
+		deps.Note(ctx, "Could not restore plan/architecture.md after failed revision: "+err.Error(),
+			"pipeline", "revision", "degraded")
+		return
+	}
+	if restored {
+		deps.Note(ctx, "Restored plan/architecture.md to the last completed revision",
+			"pipeline", "revision", "degraded")
+	}
+}
+
+func isNonDegradableRevisionError(err error) bool {
+	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
+		return true
+	}
+	var fatalErr *fatal.FatalHarnessError
+	return errors.As(err, &fatalErr)
+}
+
 // planInput mirrors the Python plan() signature (param names + defaults).
 // The nil-defaulting model/provider params (Python None) are represented as
 // empty strings; an empty value means "resolve from the environment", matching
@@ -74,6 +163,7 @@ func Plan(ctx context.Context, deps *Deps, input map[string]any) (any, error) {
 	techLeadModel := firstNonEmpty(in.TechLeadModel, defaultModel)
 	sprintPlannerModel := firstNonEmpty(in.SprintPlannerModel, defaultModel)
 	issueWriterModel := firstNonEmpty(in.IssueWriterModel, defaultModel)
+	architecturePath := architectureArtifactPath(in.RepoPath, in.ArtifactsDir)
 
 	deps.Note(ctx, "Pipeline starting", "pipeline", "start")
 
@@ -129,6 +219,8 @@ func Plan(ctx context.Context, deps *Deps, input map[string]any) (any, error) {
 
 	// 3. Tech Lead review loop (bounded: max_review_iterations + 1 passes).
 	var review map[string]any
+	revisionErr := ""
+	revisionFailed := false
 	for i := 0; i <= in.MaxReviewIterations; i++ {
 		deps.Note(ctx, fmt.Sprintf("Phase 3: Tech Lead review (iteration %d)", i),
 			"pipeline", "tech_lead")
@@ -151,7 +243,8 @@ func Plan(ctx context.Context, deps *Deps, input map[string]any) (any, error) {
 		if i < in.MaxReviewIterations {
 			deps.Note(ctx, fmt.Sprintf("Architecture revision %d", i+1),
 				"pipeline", "revision")
-			arch, err = deps.Call(ctx, "run_architect", map[string]any{
+			architectureSnapshot := snapshotArchitectureBeforeRevision(ctx, deps, architecturePath)
+			revised, rerr := deps.Call(ctx, "run_architect", map[string]any{
 				"prd":                prd,
 				"repo_path":          in.RepoPath,
 				"artifacts_dir":      in.ArtifactsDir,
@@ -161,17 +254,41 @@ func Plan(ctx context.Context, deps *Deps, input map[string]any) (any, error) {
 				"ai_provider":        aiProvider,
 				"workspace_manifest": in.WorkspaceManifest,
 			}, "run_architect (revision)")
-			if err != nil {
-				return nil, err
+			if rerr != nil {
+				if isNonDegradableRevisionError(rerr) {
+					return nil, rerr
+				}
+				restoreArchitectureAfterFailedRevision(ctx, deps, architecture
```

**File**: `go/internal/orch/plan_test.go` (modified, +297/-1)
```diff
@@ -5,9 +5,12 @@ import (
 	"errors"
 	"os"
 	"path/filepath"
+	"reflect"
 	"strings"
 	"sync"
 	"testing"
+
+	"github.com/Agent-Field/SWE-AF/go/internal/fatal"
 )
 
 // ---------------------------------------------------------------------------
@@ -24,9 +27,15 @@ type planCall struct {
 	input map[string]any
 }
 
+type planNote struct {
+	message string
+	tags    []string
+}
+
 type planMock struct {
 	mu        sync.Mutex
 	calls     []planCall
+	notes     []planNote
 	responses map[string]func(input map[string]any) (map[string]any, error)
 }
 
@@ -45,7 +54,11 @@ func (p *planMock) Call(_ context.Context, target string, input map[string]any)
 	return fn(input)
 }
 
-func (p *planMock) Note(context.Context, string, ...string) {}
+func (p *planMock) Note(_ context.Context, message string, tags ...string) {
+	p.mu.Lock()
+	defer p.mu.Unlock()
+	p.notes = append(p.notes, planNote{message: message, tags: append([]string(nil), tags...)})
+}
 
 func (p *planMock) callsFor(name string) []planCall {
 	p.mu.Lock()
@@ -59,6 +72,19 @@ func (p *planMock) callsFor(name string) []planCall {
 	return out
 }
 
+func (p *planMock) hasNoteTag(tag string) bool {
+	p.mu.Lock()
+	defer p.mu.Unlock()
+	for _, note := range p.notes {
+		for _, got := range note.tags {
+			if got == tag {
+				return true
+			}
+		}
+	}
+	return false
+}
+
 func constResp(m map[string]any) func(map[string]any) (map[string]any, error) {
 	return func(map[string]any) (map[string]any, error) { return m, nil }
 }
@@ -262,6 +288,276 @@ func TestPlanReviewApprovesEarlyStopsLoop(t *testing.T) {
 	}
 }
 
+func TestPlanArchitectRevisionFailureDegrades(t *testing.T) {
+	// VC4/VC5/VC9: every non-fatal revision error keeps the last completed
+	// architecture, labels the review, and lets downstream planning finish.
+	tests := []struct {
+		name string
+		err  error
+	}{
+		{"timeout", errors.New("CLI command timed out after 5400s")},
+		{"schema", errors.New("architect returned an invalid schema")},
+		{"runtime", errors.New("architect subprocess crashed")},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			deps, m := planApp(sprintResult(issue("my-issue", nil, []any{"thing.py"})))
+			originalArch := validArch()
+			architectCalls := 0
+			m.responses["run_architect"] = func(map[string]any) (map[string]any, error) {
+				architectCalls++
+				if architectCalls == 1 {
+					return originalArch, nil
+				}
+				return nil, tt.err
+			}
+			m.responses["run_tech_lead"] = constResp(rejectedReview())
+
+			res, err := runPlan(t, deps, t.TempDir(), map[string]any{"max_review_iterations": 1})
+			if err != nil {
+				t.Fatalf("Plan degraded revision: %v", err)
+			}
+			if !reflect.DeepEqual(res["architecture"], originalArch) {
+				t.Errorf("architecture was clobbered: got %#v, want %#v", res["architecture"], originalArch)
+			}
+			review, _ := res["review"].(map[string]any)
+			if !asBool(review["approved"]) {
+				t.Errorf("degraded review approved = %v, want true", review["approved"])
+			}
+			wantSuffix := "[auto-approved: architecture revision did not complete: " + tt.err.Error() + "]"
+			if !strings.Contains(mapStr(review, "summary", ""), wantSuffix) {
+				t.Errorf("review summary = %q, want suffix %q", review["summary"], wantSuffix)
+			}
+			if len(m.callsFor("run_sprint_planner")) != 1 || len(m.callsFor("run_issue_writer")) != 1 {
+				t.Errorf("downstream planning did not finish: sprint=%d writer=%d",
+					len(m.callsFor("run_sprint_planner")), len(m.callsFor("run_issue_writer")))
+			}
+			if !m.hasNoteTag("degraded") {
+				t.Error("degraded run note was not emitted")
+			}
+		})
+	}
+}
+
+func TestPlanArchitectRevisionFatalErrorAborts(t *testing.T) {
+	// VC6/VC9: fatal billing/auth failures still abort a revision immediately.
+	deps, m := planApp(sprintResult(issue("my-issue", nil, []any{"thing.py"})))
+	architectCalls := 0
+	m.responses["run_architect"] = func(map[string]any) (map[string]any, error) {
+		architectCalls++
+		if architectCalls == 1 {
+			return validArch(), nil
+		}
+		return nil, &fatal.FatalHarnessError{OriginalMessage: "credit balance is too low"}
+	}
+	m.responses["run_tech_lead"] = constResp(rejectedReview())
+
+	_, err := runPlan(t, deps, t.TempDir(), map[string]any{"max_review_iterations": 1})
+	var fatalErr *fatal.FatalHarnessError
+	if !errors.As(err, &fatalErr) {
+		t.Fatalf("Plan error = %v, want *fatal.FatalHarnessError", err)
+	}
+	if got := len(m.callsFor("run_sprint_planner")); got != 0 {
+		t.Errorf("sprint planner called %d times after fatal revision, want 0", got)
+	}
+}
+
+func TestPlanArchitectRevisionCancellationAborts(t *testing.T) {
+	for _, cancellationErr := range []error{context.Canceled, context.DeadlineExceeded} {
+		t.Run(cancellationErr.Error(), func(t *testing.T) {
+			deps, m := planApp(sprintResult(issue("my-issue", nil, []any{"thing.py"})))
+			architectCalls := 0
+			m.responses["run_architect"] = func(map[string]any) (map[string]any, error) {
+				architectCalls++
+	
```

**File**: `go/internal/prompts/planning/architect.go` (modified, +34/-12)
```diff
@@ -99,6 +99,39 @@ Address these concerns directly.
 `, o.Feedback)
 	}
 
+	mission := fmt.Sprintf(`## Your Mission
+
+Design the technical architecture. Read the codebase deeply first — your design
+should feel like a natural extension of what already exists.
+
+Write your architecture document to: %s
+
+The bar: this document is the single source of truth. Every interface you define
+will be copied verbatim into code. Every type signature becomes a real type. Every
+component boundary becomes a real module. Two engineers working independently from
+this document should produce code that integrates on the first try.
+`, o.ArchitecturePath)
+	if o.Feedback != "" {
+		mission = fmt.Sprintf(`## Your Mission
+
+The architecture document already exists at: %s. Read it first,
+then revise it to address every finding in the review above.
+Keep everything the review did not challenge. Do not redesign the architecture
+from scratch.
+
+Re-read only the parts of the codebase the findings actually touch. The first
+pass already studied it.
+
+Write the revised architecture document back to: %s
+
+The bar remains the same: this document is the single source of truth. Every
+interface you define will be copied verbatim into code. Every type signature
+becomes a real type. Every component boundary becomes a real module. Two engineers
+working independently from this document should produce code that integrates on
+the first try.
+`, o.ArchitecturePath, o.ArchitecturePath)
+	}
+
 	task = fmt.Sprintf(`## Product Requirements
 %s
 
@@ -116,18 +149,7 @@ Address these concerns directly.
 
 The full PRD is at: %s
 %s
-## Your Mission
-
-Design the technical architecture. Read the codebase deeply first — your design
-should feel like a natural extension of what already exists.
-
-Write your architecture document to: %s
-
-The bar: this document is the single source of truth. Every interface you define
-will be copied verbatim into code. Every type signature becomes a real type. Every
-component boundary becomes a real module. Two engineers working independently from
-this document should produce code that integrates on the first try.
-`, o.PRD.ValidatedDescription, acFormatted, mustHave, outOfScope, o.RepoPath, o.PRDPath, feedbackBlock, o.ArchitecturePath)
+%s`, o.PRD.ValidatedDescription, acFormatted, mustHave, outOfScope, o.RepoPath, o.PRDPath, feedbackBlock, mission)
 	return ArchitectSystemPrompt, task
 }
 
```

---

### Incident Patch 4: `b6d3f0dc` (2026-09-21)
**Commit Message**: fix(swe-fast): clone the repo before git_init so PR creation stops being skipped (#150)

* fix(swe-fast): clone repo_url before git_init so PR creation is reachable

swe-fast.build accepted a repo_url — the README's fast-mode example passes
one — but never cloned it: it derived the workspace path, ran os.makedirs on
it and handed that empty directory to run_git_init. The coding agents then
worked against an empty workspace, `git remote get-url origin` failed, and the
final `if remote_url and cfg.enable_github_pr` gate was False on every run, so
PR creation was silently skipped with nothing in the run to explain it.

Port the full-pipeline node's clone/reset block (swe_af/app.py) into the fast
variant: clone when the target has no .git (creating only the parent, since
pre-creating the leaf breaks git clone on Windows — #107), otherwise prune
stale worktrees, fetch, force-checkout the default branch and hard-reset to
origin/<default>, re-cloning if that reset cannot work. A failing clone now
raises with git's stderr instead of quietly continuing.

Two guards on top of the ported block, because the fast node's derived path is
keyed on the repo name alone and is stable across runs:

  

**File**: `go/internal/fast/build.go` (modified, +169/-1)
```diff
@@ -12,11 +12,13 @@
 package fast
 
 import (
+	"bytes"
 	"context"
 	"encoding/json"
 	"errors"
 	"fmt"
 	"os"
+	"os/exec"
 	"path/filepath"
 	"regexp"
 	"strings"
@@ -147,6 +149,167 @@ func runtimeToProvider(runtime string) string {
 	}
 }
 
+type gitResult struct {
+	stdout   string
+	stderr   string
+	exitCode int
+}
+
+func runGit(ctx context.Context, dir string, args ...string) gitResult {
+	cmd := exec.CommandContext(ctx, "git", args...)
+	if dir != "" {
+		cmd.Dir = dir
+	}
+	var stdout, stderr bytes.Buffer
+	cmd.Stdout = &stdout
+	cmd.Stderr = &stderr
+	err := cmd.Run()
+	exitCode := 0
+	if err != nil {
+		if exitErr, ok := err.(*exec.ExitError); ok {
+			exitCode = exitErr.ExitCode()
+		} else {
+			exitCode = -1
+			if stderr.Len() == 0 {
+				stderr.WriteString(err.Error())
+			}
+		}
+	}
+	return gitResult{stdout: stdout.String(), stderr: stderr.String(), exitCode: exitCode}
+}
+
+var credentialURLRe = regexp.MustCompile(`([A-Za-z][A-Za-z0-9+.-]*://)([^/@\s]+)@`)
+
+func redactCredentials(text, repoURL string) string {
+	safeURL := credentialURLRe.ReplaceAllString(repoURL, `${1}***@`)
+	if repoURL != "" {
+		text = strings.ReplaceAll(text, repoURL, safeURL)
+	}
+
+	// Git normally repeats the full URL in diagnostics. Also redact a password
+	// if a transport happens to report that component separately.
+	if match := credentialURLRe.FindStringSubmatch(repoURL); len(match) == 3 {
+		if _, password, ok := strings.Cut(match[2], ":"); ok && password != "" {
+			text = strings.ReplaceAll(text, password, "***")
+		}
+	}
+	return credentialURLRe.ReplaceAllString(text, `${1}***@`)
+}
+
+func normalizedRemote(remote string) string {
+	return strings.TrimSuffix(strings.TrimRight(remote, "/"), ".git")
+}
+
+func cloneRepo(ctx context.Context, deps *Deps, repoURL, repoPath string, reclone bool) error {
+	if err := os.MkdirAll(filepath.Dir(repoPath), 0o755); err != nil {
+		return err
+	}
+	clone := runGit(ctx, "", "clone", repoURL, repoPath)
+	if clone.exitCode == 0 {
+		return nil
+	}
+
+	errMsg := redactCredentials(strings.TrimSpace(clone.stderr), repoURL)
+	if reclone {
+		return fmt.Errorf("git re-clone failed: %s", errMsg)
+	}
+	deps.note(ctx, fmt.Sprintf("Clone failed (exit %d): %s", clone.exitCode, errMsg),
+		"fast_build", "clone", "error")
+	return fmt.Errorf("git clone failed (exit %d): %s", clone.exitCode, errMsg)
+}
+
+// prepareRepo clones a remote repository before git_init, resets an existing
+// clone to a clean remote baseline, or creates a local-only workspace.
+func prepareRepo(
+	ctx context.Context,
+	deps *Deps,
+	repoURL, repoPath, defaultBranch string,
+	pathWasDerived bool,
+) error {
+	gitDir := filepath.Join(repoPath, ".git")
+	switch {
+	case repoURL != "" && !pathExists(gitDir):
+		// Leftovers the node itself made — a workspace from a build that died
+		// before git init, or from before this node cloned at all — would make
+		// `git clone` refuse a non-empty destination. Derived paths are ours to
+		// clear; a path the caller chose is not (the clone then fails loudly).
+		if pathWasDerived && isNonEmptyDir(repoPath) {
+			deps.note(ctx, fmt.Sprintf(
+				"Clearing stale workspace at %s (no git repo) before cloning", repoPath),
+				"fast_build", "clone", "reclone")
+			_ = os.RemoveAll(repoPath)
+		}
+		deps.note(ctx, fmt.Sprintf("Cloning %s → %s", redactCredentials(repoURL, repoURL), repoPath),
+			"fast_build", "clone")
+		return cloneRepo(ctx, deps, repoURL, repoPath, false)
+	case repoURL != "" && pathExists(gitDir):
+		// A caller-supplied checkout may deliberately be a fork, have local-only
+		// branches, or contain untracked work. Repository preparation must not
+		// mutate it; the build pipeline receives it exactly as supplied.
+		if !pathWasDerived {
+			return nil
+		}
+
+		origin := runGit(ctx, repoPath, "remote", "get-url", "origin")
+		sameRemote := origin.exitCode == 0 &&
+			normalizedRemote(strings.TrimSpace(origin.stdout)) == normalizedRemote(repoURL)
+		if !sameRemote {
+			// Derived paths are keyed on the repo name alone, so two repos with
+			// the same name (different orgs) land here. Never build on the other
+			// repo's clone — it would edit and open a PR against the wrong one.
+			deps.note(ctx, fmt.Sprintf(
+				"Workspace at %s is a clone of a different remote — re-cloning", repoPath),
+				"fast_build", "clone", "reclone")
+			_ = os.RemoveAll(repoPath)
+			return cloneRepo(ctx, deps, repoURL, repoPath, true)
+		}
+
+		deps.note(ctx, fmt.Sprintf("Repo already exists at %s — resetting to origin/%s",
+			repoPath, defaultBranch), "fast_build", "clone", "reset")
+
+		worktreesDir := filepath.Join(repoPath, ".worktrees")
+		if isDir(worktreesDir) {
+			_ = os.RemoveAll(worktreesDir)
+		}
+		runGit(ctx, repoPath, "worktree", "prune")
+
+		if fetch := runGit(ctx, repoPath, "fetch", "origin"); fetch.exitCode != 0 {
+			deps.note(ctx, fmt.Sprintf("git fetch failed: %s",
+				redactCredentials(strings.TrimSpace(fetch.stderr), repoURL)),
+				"fast_bui
```

**File**: `go/internal/fast/build_clone_test.go` (added, +366/-0)
```diff
@@ -0,0 +1,366 @@
+package fast
+
+import (
+	"context"
+	"fmt"
+	"os"
+	"os/exec"
+	"path/filepath"
+	"strings"
+	"testing"
+)
+
+func gitOutput(t *testing.T, dir string, args ...string) string {
+	t.Helper()
+	cmd := exec.Command("git", args...)
+	if dir != "" {
+		cmd.Dir = dir
+	}
+	out, err := cmd.CombinedOutput()
+	if err != nil {
+		t.Fatalf("git %s failed: %v\n%s", strings.Join(args, " "), err, out)
+	}
+	return strings.TrimSpace(string(out))
+}
+
+func gitCommit(t *testing.T, dir, message string) {
+	t.Helper()
+	cmd := exec.Command("git", "commit", "-m", message)
+	cmd.Dir = dir
+	cmd.Env = append(os.Environ(),
+		"GIT_AUTHOR_NAME=Fast Build Test",
+		"GIT_AUTHOR_EMAIL=fast-build@example.com",
+		"GIT_COMMITTER_NAME=Fast Build Test",
+		"GIT_COMMITTER_EMAIL=fast-build@example.com",
+	)
+	if out, err := cmd.CombinedOutput(); err != nil {
+		t.Fatalf("git commit failed: %v\n%s", err, out)
+	}
+}
+
+func makeLocalRemote(t *testing.T) string {
+	t.Helper()
+	root := t.TempDir()
+	remote := filepath.Join(root, "remote.git")
+	seed := filepath.Join(root, "seed")
+	gitOutput(t, "", "init", "--bare", "--initial-branch=main", remote)
+	gitOutput(t, "", "init", "--initial-branch=main", seed)
+	if err := os.WriteFile(filepath.Join(seed, "tracked.txt"), []byte("from remote\n"), 0o644); err != nil {
+		t.Fatal(err)
+	}
+	gitOutput(t, seed, "add", "tracked.txt")
+	gitCommit(t, seed, "seed")
+	gitOutput(t, seed, "remote", "add", "origin", remote)
+	gitOutput(t, seed, "push", "-u", "origin", "main")
+	return remote
+}
+
+func cloneBuildDeps(t *testing.T, expectedFile string) (*Deps, *callScripter) {
+	t.Helper()
+	return buildDeps(func(_ context.Context, target string, kwargs map[string]any) (map[string]any, error) {
+		switch {
+		case strings.HasSuffix(target, ".run_git_init"):
+			repoPath := kwargs["repo_path"].(string)
+			if _, err := os.Stat(filepath.Join(repoPath, ".git")); err != nil {
+				return nil, fmt.Errorf("git_init ran before clone: %w", err)
+			}
+			if expectedFile != "" {
+				if _, err := os.Stat(filepath.Join(repoPath, expectedFile)); err != nil {
+					return nil, fmt.Errorf("git_init did not see tracked file: %w", err)
+				}
+			}
+			remote := gitOutput(t, repoPath, "remote", "get-url", "origin")
+			return map[string]any{
+				"success": true, "integration_branch": "feature/test", "original_branch": "main",
+				"initial_commit_sha": gitOutput(t, repoPath, "rev-parse", "HEAD"),
+				"mode":               "branch", "remote_url": remote, "remote_default_branch": "main",
+			}, nil
+		case strings.HasSuffix(target, ".fast_plan_tasks"):
+			return planResultFixture, nil
+		case strings.HasSuffix(target, ".fast_execute_tasks"):
+			return execResultFixture, nil
+		case strings.HasSuffix(target, ".fast_verify"):
+			return verifyFixture(true), nil
+		case strings.HasSuffix(target, ".run_repo_finalize"):
+			return finalizeFixture, nil
+		case strings.HasSuffix(target, ".run_github_pr"):
+			return map[string]any{"pr_url": "https://example.test/pr/52"}, nil
+		default:
+			return nil, fmt.Errorf("unexpected call target %q", target)
+		}
+	})
+}
+
+func localOnlyBuildDeps() (*Deps, *callScripter) {
+	return buildDeps(func(_ context.Context, target string, _ map[string]any) (map[string]any, error) {
+		switch {
+		case strings.HasSuffix(target, ".run_git_init"):
+			return gitInitFixture, nil
+		case strings.HasSuffix(target, ".fast_plan_tasks"):
+			return planResultFixture, nil
+		case strings.HasSuffix(target, ".fast_execute_tasks"):
+			return execResultFixture, nil
+		case strings.HasSuffix(target, ".fast_verify"):
+			return verifyFixture(true), nil
+		case strings.HasSuffix(target, ".run_repo_finalize"):
+			return finalizeFixture, nil
+		default:
+			return nil, fmt.Errorf("unexpected call target %q", target)
+		}
+	})
+}
+
+// VC1 and VC2: Build clones before git_init, exposes origin/tracked files, and reaches PR creation.
+func TestBuildClone_VC1_VC2_CloneBeforeGitInitAndCreatePR(t *testing.T) {
+	remote := makeLocalRemote(t)
+	workspaceRoot := t.TempDir()
+	t.Setenv("SWE_WORKSPACE_ROOT", workspaceRoot)
+	deps, calls := cloneBuildDeps(t, "tracked.txt")
+
+	out, err := Build(context.Background(), deps, map[string]any{
+		"goal": "test clone", "repo_url": remote,
+	})
+	if err != nil {
+		t.Fatalf("Build error: %v", err)
+	}
+
+	repoPath := filepath.Join(workspaceRoot, "remote")
+	if got := gitOutput(t, repoPath, "remote", "get-url", "origin"); got != remote {
+		t.Fatalf("origin = %q, want %q", got, remote)
+	}
+	if got, err := os.ReadFile(filepath.Join(repoPath, "tracked.txt")); err != nil || string(got) != "from remote\n" {
+		t.Fatalf("tracked file = %q, %v", got, err)
+	}
+	if targets := calls.targets(); len(targets) == 0 || targets[0] != "swe-fast.run_git_init" {
+		t.Fatalf("first call = %v, want run_git_init after clone", targets)
+	}
+	if got := asMap(t, out)["pr_url"]; got != "https://example.test/pr/52" {
+		t.Fatalf("pr_url = %v", got)
+	}
+}
+
+// VC3: a repeat Build remove
```

**File**: `swe_af/fast/app.py` (modified, +166/-1)
```diff
@@ -11,6 +11,8 @@
 import asyncio
 import os
 import re
+import shutil
+import subprocess
 
 from dotenv import load_dotenv
 
@@ -62,6 +64,162 @@ def _runtime_to_provider(runtime: str) -> str:
     return "opencode"
 
 
+_CREDENTIAL_URL_RE = re.compile(r"([A-Za-z][A-Za-z0-9+.-]*://)[^/@\s]+@")
+
+
+def _redact_credentials(text: str, repo_url: str) -> str:
+    """Remove URL userinfo from text without changing the URL passed to git."""
+    safe_url = _CREDENTIAL_URL_RE.sub(r"\1***@", repo_url)
+    redacted = text.replace(repo_url, safe_url) if repo_url else text
+
+    # Git normally repeats the full URL in diagnostics. Also redact a password
+    # if a transport happens to report that component separately.
+    userinfo = _CREDENTIAL_URL_RE.search(repo_url)
+    if userinfo:
+        raw_userinfo = repo_url[len(userinfo.group(1)) : repo_url.find("@")]
+        if ":" in raw_userinfo:
+            password = raw_userinfo.split(":", 1)[1]
+            if password:
+                redacted = redacted.replace(password, "***")
+    return _CREDENTIAL_URL_RE.sub(r"\1***@", redacted)
+
+
+def _normalized_remote(url: str) -> str:
+    """Normalize only the suffixes the repository-preparation contract allows."""
+    return url.rstrip("/").removesuffix(".git")
+
+
+def _clone_repo(repo_url: str, repo_path: str, *, reclone: bool = False) -> None:
+    os.makedirs(os.path.dirname(repo_path) or ".", exist_ok=True)
+    clone_result = subprocess.run(
+        ["git", "clone", repo_url, repo_path],
+        capture_output=True,
+        text=True,
+    )
+    if clone_result.returncode == 0:
+        return
+
+    err = _redact_credentials(clone_result.stderr.strip(), repo_url)
+    if reclone:
+        raise RuntimeError(f"git re-clone failed: {err}")
+    app.note(
+        f"Clone failed (exit {clone_result.returncode}): {err}",
+        tags=["fast_build", "clone", "error"],
+    )
+    raise RuntimeError(f"git clone failed (exit {clone_result.returncode}): {err}")
+
+
+def _prepare_repo(
+    repo_url: str,
+    repo_path: str,
+    default_branch: str,
+    path_was_derived: bool,
+) -> None:
+    """Clone or reset a remote repository, or create a local-only workspace."""
+    git_dir = os.path.join(repo_path, ".git")
+    if repo_url and not os.path.exists(git_dir):
+        # Leftovers the node itself made — a workspace from a build that died
+        # before git init, or from before this node cloned at all — would make
+        # `git clone` refuse a non-empty destination. Derived paths are ours to
+        # clear; a path the caller chose is not (the clone then fails loudly).
+        if path_was_derived and os.path.isdir(repo_path) and os.listdir(repo_path):
+            app.note(
+                f"Clearing stale workspace at {repo_path} (no git repo) before cloning",
+                tags=["fast_build", "clone", "reclone"],
+            )
+            shutil.rmtree(repo_path, ignore_errors=True)
+        app.note(
+            f"Cloning {_redact_credentials(repo_url, repo_url)} → {repo_path}",
+            tags=["fast_build", "clone"],
+        )
+        # Create only the parent; git clone creates the leaf itself.
+        # Pre-creating the leaf makes git refuse it as "already exists and is
+        # not an empty directory" on Windows (issue #107).
+        _clone_repo(repo_url, repo_path)
+    elif repo_url and os.path.exists(git_dir):
+        # A caller-supplied checkout may deliberately be a fork, have local-only
+        # branches, or contain untracked work. Repository preparation must not
+        # mutate it; the build pipeline receives it exactly as supplied.
+        if not path_was_derived:
+            return
+
+        origin = subprocess.run(
+            ["git", "remote", "get-url", "origin"],
+            cwd=repo_path,
+            capture_output=True,
+            text=True,
+        )
+        same_remote = origin.returncode == 0 and _normalized_remote(
+            origin.stdout.strip()
+        ) == _normalized_remote(repo_url)
+        if not same_remote:
+            # Derived paths are keyed on the repo name alone, so two repos with
+            # the same name (different orgs) land here. Never build on the other
+            # repo's clone — it would edit and open a PR against the wrong one.
+            app.note(
+                f"Workspace at {repo_path} is a clone of a different remote — "
+                f"re-cloning",
+                tags=["fast_build", "clone", "reclone"],
+            )
+            shutil.rmtree(repo_path, ignore_errors=True)
+            _clone_repo(repo_url, repo_path, reclone=True)
+            return
+
+        app.note(
+            f"Repo already exists at {repo_path} — resetting to "
+            f"origin/{default_branch}",
+            tags=["fast_build", "clone", "reset"],
+        )
+
+        # Remove stale worktrees on disk before touching branches.
+        worktrees_dir = os.path.join(repo_path, ".worktrees")
+        if os.path.isdir
```

**File**: `tests/fast/test_app.py` (modified, +24/-18)
```diff
@@ -418,24 +418,25 @@ def test_missing_repo_path_and_repo_url_raises_value_error(self) -> None:
             asyncio.run(fast_app.build(goal="Do something"))
 
     @pytest.mark.asyncio
-    async def test_repo_url_without_repo_path_auto_derives_repo_path(self, tmp_path) -> None:
-        """repo_url without repo_path auto-derives repo_path from URL."""
+    async def test_repo_url_without_repo_path_auto_derives_repo_path(
+        self, tmp_path, monkeypatch
+    ) -> None:
+        """repo_url without repo_path auto-derives repo_path from URL and clones into it."""
         import swe_af.fast.app as fast_app  # noqa: PLC0415
 
+        # A local repo stands in for the remote: the clone is real, and offline.
+        remote = tmp_path / "my-project.git"
+        subprocess.run(
+            ["git", "init", "--bare", str(remote)],
+            capture_output=True, text=True, check=True,
+        )
+        workspace_root = tmp_path / "workspaces"
+        monkeypatch.setenv("SWE_WORKSPACE_ROOT", str(workspace_root))
+
         # Track which repo_path gets used when calling
         called_with_repo_path: list[str] = []
         git_init_result = _make_git_init_result()
 
-        # Track makedirs calls to see derived path
-        derived_paths: list[str] = []
-        original_makedirs = os.makedirs
-
-        def capture_makedirs(path, exist_ok=False, **kwargs):
-            derived_paths.append(str(path))
-            # Don't create /workspaces/ paths
-            if not str(path).startswith("/workspaces/"):
-                original_makedirs(path, exist_ok=exist_ok, **kwargs)
-
         plan_result = _make_plan_result()
         execution_result = _make_execution_result()
         verification_result = _make_verification_result(passed=True)
@@ -464,18 +465,23 @@ def mock_unwrap(raw, name):
             patch.object(fast_app.app, "call", side_effect=mock_call),
             patch.object(fast_app.app, "note", return_value=None),
             patch("swe_af.fast.app._unwrap", side_effect=mock_unwrap),
-            patch("swe_af.fast.app.os.makedirs", side_effect=capture_makedirs),
         ):
             result = await fast_app.build(
                 goal="Do something",
-                repo_url="https://github.com/user/my-project.git",
+                repo_url=str(remote),
             )
 
-        # repo_path should have been derived from the URL
-        all_paths = derived_paths + called_with_repo_path
-        assert any("my-project" in p for p in all_paths), (
-            f"Expected 'my-project' in derived paths {all_paths}"
+        # repo_path should have been derived from the URL, and the repo cloned there
+        clone = workspace_root / "my-project"
+        assert called_with_repo_path == [str(clone)], (
+            f"Expected run_git_init on {clone}, got {called_with_repo_path}"
+        )
+        assert (clone / ".git").is_dir()
+        origin = subprocess.run(
+            ["git", "remote", "get-url", "origin"],
+            cwd=clone, capture_output=True, text=True,
         )
+        assert origin.stdout.strip() == str(remote)
 
     def test_repo_name_from_url_helper(self) -> None:
         """_repo_name_from_url extracts name correctly from various URL formats."""
```

**File**: `tests/fast/test_repo_clone.py` (added, +488/-0)
```diff
@@ -0,0 +1,488 @@
+"""Repository preparation contracts for the real fast build orchestrator."""
+
+from __future__ import annotations
+
+import os
+import subprocess
+from pathlib import Path
+from unittest.mock import patch
+
+import pytest
+
+os.environ.setdefault("AGENTFIELD_SERVER", "http://localhost:9999")
+
+
+def _git(*args: str, cwd: Path | None = None, check: bool = True) -> str:
+    result = subprocess.run(
+        ["git", *args],
+        cwd=cwd,
+        capture_output=True,
+        text=True,
+    )
+    if check and result.returncode != 0:
+        raise AssertionError(
+            f"git {' '.join(args)} failed ({result.returncode}): {result.stderr}"
+        )
+    return result.stdout.strip()
+
+
+def _commit(cwd: Path, message: str) -> None:
+    env = {
+        **os.environ,
+        "GIT_AUTHOR_NAME": "Fast Build Test",
+        "GIT_AUTHOR_EMAIL": "fast-build@example.com",
+        "GIT_COMMITTER_NAME": "Fast Build Test",
+        "GIT_COMMITTER_EMAIL": "fast-build@example.com",
+    }
+    result = subprocess.run(
+        ["git", "commit", "-m", message],
+        cwd=cwd,
+        env=env,
+        capture_output=True,
+        text=True,
+    )
+    if result.returncode != 0:
+        raise AssertionError(f"git commit failed: {result.stderr}")
+
+
+def _make_local_remote(
+    root: Path,
+    tracked_name: str = "tracked.txt",
+    content: str = "from remote\n",
+) -> Path:
+    root.mkdir(parents=True, exist_ok=True)
+    remote = root / "remote.git"
+    seed = root / "seed"
+    _git("init", "--bare", "--initial-branch=main", str(remote))
+    _git("init", "--initial-branch=main", str(seed))
+    (seed / tracked_name).write_text(content, encoding="utf-8")
+    _git("add", tracked_name, cwd=seed)
+    _commit(seed, "seed")
+    _git("remote", "add", "origin", str(remote), cwd=seed)
+    _git("push", "-u", "origin", "main", cwd=seed)
+    return remote
+
+
+@pytest.fixture
+def local_remote(tmp_path: Path) -> Path:
+    return _make_local_remote(tmp_path)
+
+
+class BuildStub:
+    def __init__(self, expected_file: str = "tracked.txt") -> None:
+        self.calls: list[str] = []
+        self.git_init_observations: list[dict[str, object]] = []
+        self.expected_file = expected_file
+
+    async def __call__(self, target: str, **kwargs: object) -> dict[str, object]:
+        name = target.rsplit(".", 1)[-1]
+        self.calls.append(name)
+        if name == "run_git_init":
+            repo_path = Path(str(kwargs["repo_path"]))
+            remote = _git("remote", "get-url", "origin", cwd=repo_path, check=False)
+            initial_commit_sha = (
+                _git("rev-parse", "HEAD", cwd=repo_path)
+                if (repo_path / ".git").exists()
+                else ""
+            )
+            self.git_init_observations.append(
+                {
+                    "git_exists": (repo_path / ".git").exists(),
+                    "tracked_exists": (repo_path / self.expected_file).exists(),
+                    "remote_url": remote,
+                }
+            )
+            return {
+                "result": {
+                    "success": True,
+                    "integration_branch": "feature/test",
+                    "original_branch": "main",
+                    "initial_commit_sha": initial_commit_sha,
+                    "mode": "branch",
+                    "remote_url": remote,
+                    "remote_default_branch": "main",
+                }
+            }
+        if name == "fast_plan_tasks":
+            return {"result": {"tasks": [], "rationale": "test"}}
+        if name == "fast_execute_tasks":
+            return {
+                "result": {
+                    "task_results": [],
+                    "completed_count": 0,
+                    "failed_count": 0,
+                    "timed_out": False,
+                }
+            }
+        if name == "fast_verify":
+            return {"result": {"passed": True, "summary": "verified"}}
+        if name == "run_repo_finalize":
+            return {"result": {"success": True}}
+        if name == "run_github_pr":
+            return {"result": {"pr_url": "https://example.test/pr/52"}}
+        raise AssertionError(f"unexpected app.call target: {target}")
+
+
+async def _build(
+    fast_app: object,
+    stub: BuildStub,
+    **kwargs: object,
+) -> dict[str, object]:
+    with (
+        patch.object(fast_app.app, "call", stub),  # type: ignore[attr-defined]
+        patch.object(fast_app.app, "note", lambda *args, **kw: None),  # type: ignore[attr-defined]
+    ):
+        build_fn = getattr(fast_app.build, "_original_func", fast_app.build)  # type: ignore[attr-defined]
+        return await build_fn(goal="test repository preparation", **kwargs)
+
+
+@pytest.mark.asyncio
+async def test_vc1_clone_is_ready_before_git_init(
+    monkeypatch: pytest.MonkeyPatch,
+    tmp_path: Path,
+    local_remote: Path,
+) -> None:
+    """VC1: repo_url-only builds clone tra
```

---

### Incident Patch 5: `b011321c` (2026-09-09)
**Commit Message**: fix(go): gate resolver permission-mode to claude, truthful push reporting, test-before-push prompt (#118)

* fix(go): gate the resolver's writable permission mode to the claude runtime

run_pr_resolver was handed cfg.PermissionMode verbatim, which defaults to
"". Under the claude harness an empty permission mode omits
--permission-mode, so `claude --print` falls back to its interactive
"prompting" default; with nobody to answer the prompt every write is
denied and the resolver finishes having produced no commits.

Default to "auto" (→ bypassPermissions) so the resolver can write to the
throwaway clone it owns — but only when the resolved provider is claude.
The other two harnesses must not get "auto":

- codex already yields `--sandbox workspace-write` for an empty mode, so
  the workspace is writable; "auto" would escalate to
  --dangerously-bypass-approvals-and-sandbox and drop the sandbox around
  the whole machine for no benefit.
- opencode never reads PermissionMode, so a value there is inert and only
  implies a guarantee we do not make.

An explicitly configured permission mode is still passed through unchanged
for every provider.

Co-Authored-By: Claude Fable 5 <[REDACTED_E

**File**: `go/internal/orch/resolve.go` (modified, +192/-1)
```diff
@@ -11,6 +11,7 @@ import (
 	"time"
 
 	"github.com/Agent-Field/SWE-AF/go/internal/config"
+	"github.com/Agent-Field/SWE-AF/go/internal/roles/ci"
 	"github.com/Agent-Field/SWE-AF/go/internal/workspace"
 )
 
@@ -135,6 +136,12 @@ func ResolveHandler(ctx context.Context, deps *Deps, input map[string]any) (any,
 		resolverModel = "sonnet"
 	}
 
+	// Remember where the remote head branch pointed before the agent ran, so a
+	// post-run comparison can tell whether anything was actually pushed. Read
+	// from the remote (not a local ref) — the agent pushes straight from its own
+	// process, which leaves this workspace's remote-tracking refs stale.
+	remoteBefore := remoteBranchSHA(ctx, repoPath, in.HeadBranch)
+
 	resolveResult, err := deps.Call(ctx, "run_pr_resolver", map[string]any{
 		"repo_path":          repoPath,
 		"pr_number":          in.PRNumber,
@@ -148,7 +155,7 @@ func ResolveHandler(ctx context.Context, deps *Deps, input map[string]any) (any,
 		"goal":               in.Goal,
 		"additional_context": in.AdditionalContext,
 		"model":              resolverModel,
-		"permission_mode":    cfg.PermissionMode,
+		"permission_mode":    resolverPermissionMode(cfg.PermissionMode, cfg.AIProvider()),
 		"ai_provider":        cfg.AIProvider(),
 	}, "run_pr_resolver")
 	if err != nil {
@@ -171,6 +178,68 @@ func ResolveHandler(ctx context.Context, deps *Deps, input map[string]any) (any,
 		}
 	}
 
+	// ---- 5b. Reconcile an unusable agent report against the remote ---------
+	// When the harness returned no parseable result, run_pr_resolver hands back
+	// a deterministic all-false fallback. That report says nothing about what
+	// happened on disk: the agent may well have committed and pushed before the
+	// final structured answer failed to parse. Ask the remote instead of the
+	// report, and record precisely what the remote can and cannot prove.
+	if resolverReportInvalid(resolveResult) {
+		// report_invalid marks the agent's own report as untrustworthy. It is
+		// set whenever the sentinel is seen, independently of what the remote
+		// shows, so consumers never mistake a reconstructed result for a
+		// first-hand one.
+		resolveResult["report_invalid"] = true
+
+		remoteAfter := remoteBranchSHA(ctx, repoPath, in.HeadBranch)
+		localHead := localHeadSHA(ctx, repoPath)
+		verdict := classifyRemoteAdvance(remoteBefore, remoteAfter, localHead)
+
+		switch {
+		case verdict.Attributed:
+			// The remote tip is exactly this workspace's HEAD, so the advance
+			// is our agent's work. pushed is now provable — fixed is NOT: a
+			// landed commit is not evidence that CI passes or that the review
+			// comments were addressed. Leaving fixed false keeps the overall
+			// success verdict below (fixed && pushed) false, which is the
+			// truthful answer for a run whose agent never reported back.
+			resolveResult["pushed"] = true
+			pushed = true
+
+			// rev-list / diff need the post-push objects locally; the workspace
+			// only has what it cloned plus whatever the agent committed.
+			if fetchRemoteBranch(ctx, repoPath, in.HeadBranch) {
+				resolveResult["commit_shas"] = remoteCommitSHAs(ctx, repoPath, remoteBefore, remoteAfter)
+				resolveResult["files_changed"] = remoteFilesChanged(ctx, repoPath, remoteBefore, remoteAfter)
+			} else {
+				// verification_partial: the push is confirmed but the commit
+				// and file lists could not be reconstructed, so their emptiness
+				// means "unknown", not "nothing changed".
+				resolveResult["commit_shas"] = []string{}
+				resolveResult["files_changed"] = []string{}
+				resolveResult["verification_partial"] = true
+			}
+			resolveResult["summary"] = "agent report invalid; verified this workspace's work was pushed to " + in.HeadBranch
+			resolveResult["error_message"] = "agent report invalid; push verified against the remote, fix NOT verified"
+			deps.Note(ctx, "Resolve: agent report invalid, but this workspace's HEAD is now the remote tip — push verified, fix unverified",
+				"resolve", "report", "warning")
+
+		case verdict.Advanced:
+			// The branch moved but the new tip is not our HEAD: someone (or
+			// something) else pushed while we ran. Record the observation and
+			// attribute nothing — claiming this push would be a lie, and the
+			// commits are not ours to describe.
+			resolveResult["remote_advanced"] = true
+			deps.Note(ctx, fmt.Sprintf(
+				"Resolve: agent report invalid and %s moved on the remote, but the new tip is not this workspace's HEAD — not attributing the push",
+				in.HeadBranch), "resolve", "report", "warning")
+
+		default:
+			deps.Note(ctx, "Resolve: agent report invalid and the remote branch did not move — no work landed",
+				"resolve", "report", "warning")
+		}
+	}
+
 	// Capture the new HEAD SHA after push so the CI watcher can anchor verdicts
 	// to this specific commit (avoids the previous HEAD's stale check states).
 	headSHA := ""
@@ -226,6 +295,9 @@ func ResolveHandler(ctx context.Context, deps *Deps, input m
```

**File**: `go/internal/orch/resolve_test.go` (modified, +309/-0)
```diff
@@ -5,6 +5,9 @@ import (
 	"strings"
 	"testing"
 	"time"
+
+	"github.com/Agent-Field/SWE-AF/go/internal/config"
+	"github.com/Agent-Field/SWE-AF/go/internal/roles/ci"
 )
 
 // --- seam helpers ---------------------------------------------------------
@@ -637,3 +640,309 @@ func TestResolveFailureSuccessFalse(t *testing.T) {
 		t.Fatal("summary must be present even on failure")
 	}
 }
+
+// ---------------------------------------------------------------------------
+// resolverPermissionMode — the writability default is gated to claude.
+//
+// Validation contract:
+//   - When no permission mode is configured and the runtime resolves to the
+//     claude provider, the resolver runs with "auto" (bypassPermissions) so it
+//     can actually write to its throwaway clone.
+//   - Under codex the default stays empty: the codex harness already grants
+//     workspace-write, and "auto" would escalate to a full sandbox bypass.
+//   - Under opencode the default stays empty: the provider ignores the value.
+//   - An explicitly configured mode is never overridden, for any provider.
+// ---------------------------------------------------------------------------
+
+func TestResolverPermissionModeGatedToClaude(t *testing.T) {
+	cases := []struct {
+		runtime string
+		want    string
+	}{
+		{"claude_code", "auto"},
+		{"codex", ""},
+		{"open_code", ""},
+	}
+	for _, tc := range cases {
+		cfg, err := config.LoadBuildConfig(map[string]any{"runtime": tc.runtime})
+		if err != nil {
+			t.Fatalf("runtime %q: LoadBuildConfig: %v", tc.runtime, err)
+		}
+		if cfg.PermissionMode != "" {
+			t.Fatalf("runtime %q: expected an unset default permission mode, got %q",
+				tc.runtime, cfg.PermissionMode)
+		}
+		got := resolverPermissionMode(cfg.PermissionMode, cfg.AIProvider())
+		if got != tc.want {
+			t.Errorf("runtime %q (provider %q): permission mode = %q, want %q",
+				tc.runtime, cfg.AIProvider(), got, tc.want)
+		}
+	}
+}
+
+func TestResolverPermissionModeRespectsExplicitConfig(t *testing.T) {
+	for _, provider := range []string{"claude", "codex", "opencode", ""} {
+		if got := resolverPermissionMode("plan", provider); got != "plan" {
+			t.Errorf("provider %q: explicit mode = %q, want plan", provider, got)
+		}
+	}
+}
+
+// The gate must hold end-to-end: the kwarg the resolver reasoner actually
+// receives is the gated value, not cfg.PermissionMode verbatim.
+func TestResolveSendsGatedPermissionMode(t *testing.T) {
+	for _, tc := range []struct {
+		runtime string
+		want    string
+	}{
+		{"claude_code", "auto"},
+		{"codex", ""},
+		{"open_code", ""},
+	} {
+		func() {
+			defer withExecCtx("run-pm", "exec-pm")()
+			_, _, restore := installGitGH(
+				func(_ string, _ []string) cmdResult { return cmdResult{ExitCode: 0} },
+				func(_ string, _ []string) cmdResult { return cmdResult{ExitCode: 0} },
+			)
+			defer restore()
+			_, restoreSleep := installSleep()
+			defer restoreSleep()
+
+			seen := map[string]any{}
+			app := &mockApp{handler: func(_ context.Context, target string, in map[string]any) (map[string]any, error) {
+				if strings.Contains(target, "run_pr_resolver") {
+					seen = in
+					return map[string]any{"fixed": false, "pushed": false}, nil
+				}
+				return map[string]any{}, nil
+			}}
+			deps := &Deps{App: app, NodeID: "swe-planner"}
+
+			if _, err := ResolveHandler(context.Background(), deps, map[string]any{
+				"pr_url":      "https://github.com/o/r/pull/3",
+				"pr_number":   3,
+				"repo_url":    "https://github.com/o/r.git",
+				"head_branch": "feature/pm",
+				"config":      map[string]any{"runtime": tc.runtime},
+			}); err != nil {
+				t.Fatalf("runtime %q: resolve errored: %v", tc.runtime, err)
+			}
+			if got := mapStr(seen, "permission_mode", ""); got != tc.want {
+				t.Errorf("runtime %q: permission_mode kwarg = %q, want %q", tc.runtime, got, tc.want)
+			}
+		}()
+	}
+}
+
+// ---------------------------------------------------------------------------
+// classifyRemoteAdvance — what the remote is allowed to prove.
+//
+// Validation contract:
+//   - Remote unchanged → nothing is claimed.
+//   - An unknown before/after SHA → nothing is claimed (silence over guessing).
+//   - Remote moved and the new tip equals our HEAD → the advance is ours.
+//   - Remote moved and the new tip is some other commit → the advance happened
+//     but is not attributable to this run.
+// ---------------------------------------------------------------------------
+
+func TestClassifyRemoteAdvance(t *testing.T) {
+	cases := []struct {
+		name                 string
+		before, after, local string
+		wantAdvanced         bool
+		wantAttributed       bool
+	}{
+		{"unchanged", "a1", "a1", "a1", false, false},
+		{"before unknown", "", "b2", "b2", false, false},
+		{"after unknown", "a1", "", "a1", false, false},
+		{"ours", "a1", "b2", "b2", true, true},
+		{"third party", "a1", "b2", "a1", true, false},
+		{"local head unknown", "a1", "b2", "", true, false},
+	}
+	for _, tc := range case
```

**File**: `go/internal/prompts/advisor/pr_resolver.go` (modified, +10/-0)
```diff
@@ -138,6 +138,12 @@ func PRResolverTaskPrompt(opts PRResolverTaskOptions) string {
 	taskLines = append(taskLines,
 		strconv.Itoa(step)+". Re-run failing tests locally to confirm they pass.")
 	step++
+	taskLines = append(taskLines,
+		strconv.Itoa(step)+". Before committing, run the test suite for every package or "+
+			"module you touched, plus gofmt and any repository-standard linters. Do NOT "+
+			"push if any affected test or required check fails; report every test command "+
+			"and its outcome in the result.")
+	step++
 	taskLines = append(taskLines,
 		strconv.Itoa(step)+". Commit + `git push origin "+opts.HeadBranch+"` — do NOT create "+
 			"a new PR.")
@@ -170,6 +176,10 @@ push. The PR already exists — do NOT create a new one.
 4. The fix is committed and pushed to the PR's head branch (not a new
    branch).
 5. You have re-run the relevant tests locally and they pass.
+6. You have run the test suite for every package or module you touched, plus
+   gofmt and any repository-standard linters, BEFORE committing — and every
+   one of them passed. You MUST NOT push if any affected test or required
+   check fails. Report every test command and its outcome in your result.
 
 ## ABSOLUTELY FORBIDDEN — these are workarounds, not fixes
 
```

**File**: `go/internal/prompts/advisor/testdata/pr_resolver_rendered.txt` (modified, +3/-2)
```diff
@@ -41,5 +41,6 @@ Keep API stable.
 3. Fix every failing CI check by changing PRODUCTION code (no silenced tests).
 4. Address every actionable review comment, recording each one in `addressed_comments` (true/false + brief note).
 5. Re-run failing tests locally to confirm they pass.
-6. Commit + `git push origin feature` — do NOT create a new PR.
-7. Return a `PRResolveResult` JSON object.
\ No newline at end of file
+6. Before committing, run the test suite for every package or module you touched, plus gofmt and any repository-standard linters. Do NOT push if any affected test or required check fails; report every test command and its outcome in the result.
+7. Commit + `git push origin feature` — do NOT create a new PR.
+8. Return a `PRResolveResult` JSON object.
\ No newline at end of file
```

**File**: `go/internal/prompts/advisor/testdata/pr_resolver_rendered_merged.txt` (modified, +3/-2)
```diff
@@ -18,5 +18,6 @@ The orchestrator already merged `origin/main` into the head branch with no confl
 2. Fix every failing CI check by changing PRODUCTION code (no silenced tests).
 3. Address every actionable review comment, recording each one in `addressed_comments` (true/false + brief note).
 4. Re-run failing tests locally to confirm they pass.
-5. Commit + `git push origin feature` — do NOT create a new PR.
-6. Return a `PRResolveResult` JSON object.
\ No newline at end of file
+5. Before committing, run the test suite for every package or module you touched, plus gofmt and any repository-standard linters. Do NOT push if any affected test or required check fails; report every test command and its outcome in the result.
+6. Commit + `git push origin feature` — do NOT create a new PR.
+7. Return a `PRResolveResult` JSON object.
\ No newline at end of file
```

**File**: `go/internal/prompts/advisor/testdata/pr_resolver_system.txt` (modified, +4/-0)
```diff
@@ -20,6 +20,10 @@ push. The PR already exists — do NOT create a new one.
 4. The fix is committed and pushed to the PR's head branch (not a new
    branch).
 5. You have re-run the relevant tests locally and they pass.
+6. You have run the test suite for every package or module you touched, plus
+   gofmt and any repository-standard linters, BEFORE committing — and every
+   one of them passed. You MUST NOT push if any affected test or required
+   check fails. Report every test command and its outcome in your result.
 
 ## ABSOLUTELY FORBIDDEN — these are workarounds, not fixes
 
```

**File**: `go/internal/roles/ci/ci.go` (modified, +11/-2)
```diff
@@ -275,6 +275,15 @@ func (p *prResolverInput) UnmarshalJSON(b []byte) error {
 	return jsonUnmarshal(b, (*alias)(p))
 }
 
+// InvalidResolverReport is the Summary/ErrorMessage carried by the deterministic
+// PRResolveResult fallback RunPRResolver returns when the harness produced no
+// parseable result. It is a load-bearing sentinel, not just a log line: the
+// orchestrator (internal/orch.ResolveHandler) matches on it to decide that the
+// agent's own report cannot be trusted and that the remote branch has to be
+// inspected instead. Both sides reference this const so the two copies cannot
+// drift apart silently.
+const InvalidResolverReport = "PR resolver agent failed to produce a valid result."
+
 // RunPRResolver ports run_pr_resolver (execution_agents.py:1680). It resolves an
 // open PR — completing an in-progress merge, fixing CI, and addressing review
 // comments — and returns a PRResolveResult-shaped result. The orchestrator
@@ -343,8 +352,8 @@ func RunPRResolver(ctx context.Context, deps *Deps, input map[string]any) (any,
 		FilesChanged:        []string{},
 		CommitSHAs:          []string{},
 		AddressedComments:   []schemas.AddressedComment{},
-		Summary:             "PR resolver agent failed to produce a valid result.",
+		Summary:             InvalidResolverReport,
 		RejectedWorkarounds: []string{},
-		ErrorMessage:        "PR resolver agent failed to produce a valid result.",
+		ErrorMessage:        InvalidResolverReport,
 	}, nil
 }
```

---

### Incident Patch 6: `2f43e7d8` (2026-09-09)
**Commit Message**: fix(qa-synthesizer): read the schema router.ai() actually returns (#141)

* fix: QA synthesizer discards the AI's decision on every call

run_qa_synthesizer is the only reasoner that calls router.ai(); the other
eighteen agents in this module use router.harness(), whose HarnessResult
does carry a .parsed attribute. router.ai(..., schema=X) returns the
validated X instance directly, so result.parsed raised AttributeError,
the broad except swallowed it, and the function silently fell through to
the tests_passed/review_approved heuristic every time.

Read the schema instance directly and gate on its type, so a malformed
tool-loop response still reaches the heuristic fallback deliberately
rather than via a swallowed AttributeError.

Fixes #113

* fix(qa-synthesizer): keep the fallback path loud, and pin it

Gating on isinstance meant a non-QASynthesisResult response (ai() returns
a ToolCallResponse when the model content is not parseable JSON) reached
the heuristic fallback while logging nothing. Issue #113 was diagnosed
from that very note, so emit one deliberately instead of relying on a
swallowed AttributeError to produce it.

Adds a second test covering the path, and switches the r

**File**: `swe_af/reasoners/execution_agents.py` (modified, +10/-4)
```diff
@@ -1259,15 +1259,21 @@ async def run_qa_synthesizer(
             schema=QASynthesisResult,
             model=model,
         )
-        if result.parsed is not None:
+        # Unlike the harness-backed agents above, router.ai() returns the
+        # validated schema instance itself — there is no .parsed wrapper.
+        if isinstance(result, QASynthesisResult):
             router.note(
-                f"QA synthesizer complete: action={result.parsed.action.value}, "
-                f"stuck={result.parsed.stuck}",
+                f"QA synthesizer complete: action={result.action.value}, "
+                f"stuck={result.stuck}",
                 tags=["qa_synthesizer", "complete"],
             )
-            out = result.parsed.model_dump()
+            out = result.model_dump()
             out["iteration_id"] = iteration_id
             return out
+        router.note(
+            f"QA synthesizer returned {type(result).__name__}, not QASynthesisResult",
+            tags=["qa_synthesizer", "error"],
+        )
     except FatalHarnessError:
         raise  # Non-retryable — propagate immediately
     except Exception as e:
```

**File**: `tests/test_qa_synthesizer_direct_schema.py` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+"""Regression tests for the QA synthesizer dropping the AI's decision (#113).
+
+``run_qa_synthesizer`` is the only reasoner that calls ``router.ai()`` — every
+other agent in ``execution_agents`` goes through ``router.harness()``, which
+returns a ``HarnessResult`` wrapper carrying a ``.parsed`` attribute.
+``router.ai(..., schema=X)`` instead returns the validated ``X`` instance
+directly, so reading ``.parsed`` off it raised ``AttributeError``.  The
+surrounding broad ``except Exception`` swallowed that, logged "QA synthesizer
+agent failed" and fell through to the crude tests_passed/review_approved
+heuristic — discarding the synthesizer's decision on *every* call.
+"""
+
+from __future__ import annotations
+
+from unittest.mock import AsyncMock, MagicMock
+
+from swe_af.execution.schemas import QASynthesisAction, QASynthesisResult
+from swe_af.reasoners import execution_agents
+
+# Inputs the heuristic fallback resolves to APPROVE, so any other action in the
+# result can only have come from the synthesizer itself.
+FALLBACK_APPROVES = {
+    "qa_result": {"passed": True},
+    "review_result": {"approved": True, "blocking": False},
+}
+
+
+def _error_notes(router: MagicMock) -> list:
+    return [
+        c for c in router.note.call_args_list if "error" in c.kwargs.get("tags", [])
+    ]
+
+
+async def test_ai_decision_wins_over_heuristic_fallback(monkeypatch) -> None:
+    """A BLOCK from the synthesizer survives inputs the fallback would approve."""
+    decision = QASynthesisResult(
+        action=QASynthesisAction.BLOCK,
+        summary="Tests pass but the fix regresses the public API.",
+        stuck=True,
+    )
+    router = MagicMock(ai=AsyncMock(return_value=decision))
+    monkeypatch.setattr(execution_agents, "router", router)
+
+    out = await execution_agents.run_qa_synthesizer(
+        iteration_history=[], iteration_id="iter-7", **FALLBACK_APPROVES
+    )
+
+    assert router.ai.await_args.kwargs["schema"] is QASynthesisResult
+    assert out["action"] == QASynthesisAction.BLOCK
+    assert out["summary"] == decision.summary
+    assert out["stuck"] is True
+    assert out["iteration_id"] == "iter-7"
+    assert _error_notes(router) == []
+
+
+async def test_non_schema_response_falls_back_and_says_so(monkeypatch) -> None:
+    """An unparseable response reaches the heuristic, but not silently.
+
+    ``ai()`` hands back a ``ToolCallResponse`` when the model's content is not
+    parseable JSON.  Issue #113 was diagnosed from the note this path emits, so
+    the fallback must stay loud.
+    """
+    router = MagicMock(ai=AsyncMock(return_value=object()))
+    monkeypatch.setattr(execution_agents, "router", router)
+
+    out = await execution_agents.run_qa_synthesizer(
+        iteration_history=[], iteration_id="iter-8", **FALLBACK_APPROVES
+    )
+
+    assert out["action"] == QASynthesisAction.APPROVE
+    assert _error_notes(router), "operators lose their only signal for this path"
```

---

### Incident Patch 7: `0c64fe7c` (2026-08-23)
**Commit Message**: fix: Docker deploys run the promised OpenRouter default (HARNESS_MODEL scoped to open_code) (#142)

* fix(docker): bake the promised OpenRouter default model, not kimi-k2.6

The images set ENV HARNESS_MODEL=openrouter/moonshotai/kimi-k2.6 as an
OpenCode small_model fallback, but the model-resolution env cascade reads
HARNESS_MODEL — so every OpenRouter-only Docker/Railway deployment silently
ran kimi instead of the documented auto default
openrouter/deepseek/deepseek-v4-flash-0731. Point the baked value at the
auto default.

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

* fix(models): consult HARNESS_MODEL only on the open_code runtime

HARNESS_MODEL is an OpenCode-ecosystem variable: it feeds OpenCode's
small_model via config interpolation, and the Docker image bakes a default
value precisely so that interpolation always resolves. Having it in the
model cascade for every runtime pushed that baked openrouter/… id into the
claude_code and codex CLIs on Docker deployments, breaking both unless the
deployer also set SWE_DEFAULT_MODEL (the README documented the codex
failure instead of fixing it).

Scope the cascade's HARNESS_MODEL step to open_code in both the Python and
Go nodes

**File**: `.env.example` (modified, +7/-5)
```diff
@@ -47,8 +47,9 @@
 # SWE_DEFAULT_RUNTIME=open_code
 # SWE_DEFAULT_MODEL=minimax-global-openai/MiniMax-M3
 # HARNESS_MODEL feeds OpenCode's small_model (SWE_DEFAULT_MODEL does not);
-# without it, small-model calls hit the baked OpenRouter default and need
-# OPENROUTER_API_KEY.
+# without it, small-model calls hit the baked OpenRouter default
+# (openrouter/deepseek/deepseek-v4-flash-0731) and need OPENROUTER_API_KEY.
+# HARNESS_MODEL only steers the open_code runtime.
 # HARNESS_MODEL=minimax-global-openai/MiniMax-M3
 # China endpoint: SWE_DEFAULT_MODEL=minimax-cn-openai/MiniMax-M3
 # Anthropic-compatible endpoint:
@@ -81,9 +82,10 @@
 #   The coding loop passes the qa_synthesizer role model (default "haiku"), which
 #   WithModel overrides per call, so AI_MODEL is only the fallback default.
 #   WARNING: AI_MODEL is ALSO the second step of the role-model cascade
-#   (SWE_DEFAULT_MODEL → AI_MODEL → HARNESS_MODEL), so setting it here
-#   repoints every agent role too. To pick a model for the roles, set
-#   SWE_DEFAULT_MODEL instead and leave this one unset.
+#   (SWE_DEFAULT_MODEL → AI_MODEL → HARNESS_MODEL; HARNESS_MODEL counts only
+#   on the open_code runtime), so setting it here repoints every agent role
+#   too. To pick a model for the roles, set SWE_DEFAULT_MODEL instead and
+#   leave this one unset.
 # AI_MODEL=anthropic/claude-haiku-4.5
 
 # --- Optional: Web search (open runtime) ---
```

**File**: `Dockerfile` (modified, +7/-1)
```diff
@@ -64,7 +64,13 @@ ENV PATH="/root/.opencode/bin:${PATH}"
 # Default HARNESS_MODEL inside the image so a fresh container with no
 # env override has *some* value to interpolate. Railway / docker-compose
 # overrides win because their env injects after the image's ENV.
-ENV HARNESS_MODEL=openrouter/moonshotai/kimi-k2.6
+#
+# The value MUST match _OPENROUTER_AUTO_DEFAULT_MODEL (swe_af/execution/
+# schemas.py) — it is what an OpenRouter-only deploy actually runs, since the
+# model-resolution cascade reads HARNESS_MODEL for the open_code runtime (and
+# ONLY for open_code: claude_code / codex deployments resolve their own
+# runtime defaults and never see this variable).
+ENV HARNESS_MODEL=openrouter/deepseek/deepseek-v4-flash-0731
 RUN mkdir -p /root/.config/opencode
 COPY opencode.json /root/.config/opencode/opencode.json
 
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -403,7 +403,7 @@ For the Anthropic-compatible Claude path, set `ANTHROPIC_AUTH_TOKEN`, set `ANTHR
 
 For Codex with ChatGPT subscription auth, install the Codex CLI on the host, run `codex login`, leave `OPENAI_API_KEY` unset for this process, and set `SWE_CODEX_AUTH_MODE=chatgpt` or `auto`. For OpenAI API-platform billing, set `SWE_CODEX_AUTH_MODE=api_key` and `OPENAI_API_KEY`.
 
-> **Codex deployments using the Docker image must set `SWE_DEFAULT_MODEL=gpt-5.3-codex` on the environment** (or pass `models: {"default": "gpt-5.3-codex"}` in every build's `config`). The image bakes `HARNESS_MODEL=openrouter/moonshotai/kimi-k2.6` as an OpenCode fallback, and SWE-AF's model-resolution env cascade reads `HARNESS_MODEL` — so without `SWE_DEFAULT_MODEL` set, the Codex CLI receives an OpenRouter model id it can't handle and the Product Manager reasoner fails in ~13s. Setting `SWE_DEFAULT_MODEL` makes the cascade pin every role to the Codex model.
+> The Docker image bakes `HARNESS_MODEL=openrouter/deepseek/deepseek-v4-flash-0731` so OpenCode's `small_model` config interpolation always has a value. `HARNESS_MODEL` only affects the `open_code` runtime — `claude_code` and `codex` deployments resolve their own runtime defaults (codex picks its model by auth mode) and can override per role via `SWE_DEFAULT_MODEL` / `models` as usual.
 
 > Codex CLI's `workspace-write` sandbox uses bubblewrap (`bwrap`) and needs Linux user namespaces enabled on the host. Most production Linux hosts and managed container runtimes (Railway, etc.) allow this by default, but local Docker on WSL2 or hardened environments may refuse with `bwrap: No permissions to create a new namespace`. If the verifier reports that error, the coder ran but couldn't write files — enable user namespaces on the host before relying on the codex runtime there.
 
```

**File**: `go/Dockerfile` (modified, +7/-1)
```diff
@@ -128,7 +128,13 @@ ENV PATH="/root/.opencode/bin:${PATH}"
 # so it must honor the same env var the rest of the stack uses. Default the
 # value inside the image so a fresh container has *some* value to interpolate;
 # Railway / docker-compose overrides win because their env injects afterward.
-ENV HARNESS_MODEL=openrouter/moonshotai/kimi-k2.6
+#
+# The value MUST match openRouterAutoDefaultModel (internal/config) — it is
+# what an OpenRouter-only deploy actually runs, since the model-resolution
+# cascade reads HARNESS_MODEL for the open_code runtime (and ONLY for
+# open_code: claude_code / codex deployments resolve their own runtime
+# defaults and never see this variable).
+ENV HARNESS_MODEL=openrouter/deepseek/deepseek-v4-flash-0731
 RUN mkdir -p /root/.config/opencode
 COPY opencode.json /root/.config/opencode/opencode.json
 
```

**File**: `go/internal/config/config_test.go` (modified, +59/-0)
```diff
@@ -200,6 +200,65 @@ func TestResolveRuntimeModels_EnvCascade(t *testing.T) {
 	}
 }
 
+func TestResolveRuntimeModels_HarnessModelScopedToOpenCode(t *testing.T) {
+	clearProviderEnv(t)
+	// The Docker image bakes HARNESS_MODEL for OpenCode's small_model
+	// interpolation; it must steer open_code only. claude_code and codex keep
+	// their runtime defaults instead of receiving an openrouter/… id their
+	// CLIs cannot consume.
+	t.Setenv("HARNESS_MODEL", "openrouter/deepseek/deepseek-v4-flash-0731")
+
+	got := mustResolve(t, "open_code", nil)
+	if got["pm_model"] != "openrouter/deepseek/deepseek-v4-flash-0731" {
+		t.Errorf("open_code honors HARNESS_MODEL = %q", got["pm_model"])
+	}
+
+	got = mustResolve(t, "claude_code", nil)
+	if got["pm_model"] != "sonnet" {
+		t.Errorf("claude_code ignores HARNESS_MODEL = %q", got["pm_model"])
+	}
+	if got["qa_synthesizer_model"] != "haiku" {
+		t.Errorf("claude_code qa_synthesizer base = %q", got["qa_synthesizer_model"])
+	}
+
+	t.Setenv("SWE_CODEX_AUTH_MODE", "api_key")
+	got = mustResolve(t, "codex", nil)
+	if got["pm_model"] != "gpt-5.3-codex" {
+		t.Errorf("codex ignores HARNESS_MODEL = %q", got["pm_model"])
+	}
+
+	// Deployer-intent vars are NOT runtime-scoped: AI_MODEL still wins on
+	// claude_code.
+	t.Setenv("AI_MODEL", "claude-opus-5")
+	got = mustResolve(t, "claude_code", nil)
+	if got["pm_model"] != "claude-opus-5" {
+		t.Errorf("claude_code honors AI_MODEL = %q", got["pm_model"])
+	}
+}
+
+func TestFastResolveModels_HarnessModelScopedToOpenCode(t *testing.T) {
+	clearProviderEnv(t)
+	t.Setenv("HARNESS_MODEL", "openrouter/qwen/qwen-3-coder")
+
+	openCfg := &FastBuildConfig{Runtime: "open_code"}
+	got, err := FastResolveModels(openCfg)
+	if err != nil {
+		t.Fatalf("FastResolveModels(open_code): %v", err)
+	}
+	if got["pm_model"] != "openrouter/qwen/qwen-3-coder" {
+		t.Errorf("fast open_code honors HARNESS_MODEL = %q", got["pm_model"])
+	}
+
+	claudeCfg := &FastBuildConfig{Runtime: "claude_code"}
+	got, err = FastResolveModels(claudeCfg)
+	if err != nil {
+		t.Fatalf("FastResolveModels(claude_code): %v", err)
+	}
+	if got["pm_model"] != "haiku" {
+		t.Errorf("fast claude_code ignores HARNESS_MODEL = %q", got["pm_model"])
+	}
+}
+
 func TestResolveRuntimeModels_EnvCascadeOrder(t *testing.T) {
 	clearProviderEnv(t)
 	// AI_MODEL used when SWE_DEFAULT_MODEL unset.
```

**File**: `go/internal/config/fastconfig.go` (modified, +3/-2)
```diff
@@ -126,7 +126,8 @@ func LoadFastBuildConfig(raw map[string]any) (*FastBuildConfig, error) {
 
 // FastResolveModels ports fast_resolve_models — resolves the four role model
 // strings. Resolution order (last wins): runtime default → env cascade
-// (SWE_DEFAULT_MODEL → AI_MODEL → HARNESS_MODEL, same as the main path) →
+// (SWE_DEFAULT_MODEL → AI_MODEL → HARNESS_MODEL, the latter only on
+// open_code — same as the main path) →
 // models["default"] → models["<role>"]. An unknown key yields the verbatim
 // "Unknown role key" error.
 func FastResolveModels(config *FastBuildConfig) (map[string]string, error) {
@@ -140,7 +141,7 @@ func FastResolveModels(config *FastBuildConfig) (map[string]string, error) {
 	// Deployer env cascade: lets the same variable that selects a model for
 	// the main node select it for fast builds too. Caller-supplied models
 	// (below) still win.
-	if envModel := defaultModelFromEnv(); envModel != "" {
+	if envModel := defaultModelFromEnv(config.Runtime); envModel != "" {
 		for _, role := range fastRoles {
 			resolved[role] = envModel
 		}
```

**File**: `go/internal/config/resolve.go` (modified, +12/-3)
```diff
@@ -236,8 +236,17 @@ var defaultModelEnvVars = []string{"SWE_DEFAULT_MODEL", "AI_MODEL", "HARNESS_MOD
 
 // defaultModelFromEnv ports _default_model_from_env: first non-empty (stripped)
 // of SWE_DEFAULT_MODEL → AI_MODEL → HARNESS_MODEL, else "" (meaning None).
-func defaultModelFromEnv() string {
+//
+// HARNESS_MODEL is an OpenCode-ecosystem variable — it also feeds OpenCode's
+// small_model via config interpolation, and the Docker image bakes a default
+// value precisely so that interpolation always has one — so it is consulted
+// only for the open_code runtime. Letting it steer claude_code / codex pushed
+// the image's baked openrouter/… id into CLIs that cannot consume it.
+func defaultModelFromEnv(runtime string) string {
 	for _, v := range defaultModelEnvVars {
+		if v == "HARNESS_MODEL" && runtime != "open_code" {
+			continue
+		}
 		if value := envStripped(v); value != "" {
 			return value
 		}
@@ -269,7 +278,7 @@ func DefaultPlanningModel() string {
 	if highModel := tierModelsFromEnv()["high"]; highModel != "" {
 		return highModel
 	}
-	if envModel := defaultModelFromEnv(); envModel != "" {
+	if envModel := defaultModelFromEnv(DefaultRuntime()); envModel != "" {
 		return envModel
 	}
 	if openRouterOnlyEnv() {
@@ -376,7 +385,7 @@ func ResolveRuntimeModels(runtime string, models map[string]string, fieldNames [
 		resolved[field] = base[field]
 	}
 
-	if envDefault := defaultModelFromEnv(); envDefault != "" {
+	if envDefault := defaultModelFromEnv(runtime); envDefault != "" {
 		for _, field := range fieldNames {
 			resolved[field] = envDefault
 		}
```

**File**: `swe_af/execution/schemas.py` (modified, +18/-5)
```diff
@@ -706,8 +706,8 @@ def _default_runtime() -> Literal["claude_code", "open_code", "codex"]:
 )
 
 
-def _default_model_from_env() -> str | None:
-    """Pick a single model id from deployer env vars.
+def _default_model_from_env(runtime: str) -> str | None:
+    """Pick a single model id from deployer env vars, for ``runtime``.
 
     Cascades through the well-known env-var names this stack uses for model
     selection so the same Railway / docker-compose variable that points
@@ -716,11 +716,21 @@ def _default_model_from_env() -> str | None:
 
         SWE_DEFAULT_MODEL  →  AI_MODEL  →  HARNESS_MODEL
 
+    ``HARNESS_MODEL`` is an OpenCode-ecosystem variable — it also feeds
+    OpenCode's ``small_model`` via config interpolation, and the Docker image
+    bakes a default value precisely so that interpolation always has one — so
+    it only participates in the cascade for the ``open_code`` runtime. Letting
+    it steer ``claude_code`` / ``codex`` pushed the image's baked
+    ``openrouter/…`` id into CLIs that cannot consume it, breaking every
+    non-OpenCode Docker deployment that didn't also set ``SWE_DEFAULT_MODEL``.
+
     Caller-supplied ``models={"default": …}`` and per-role overrides still
     beat the env value (see ``resolve_runtime_models`` precedence). All
     unset / empty → ``None``, which means "use the runtime base defaults".
     """
     for var in _DEFAULT_MODEL_ENV_VARS:
+        if var == "HARNESS_MODEL" and runtime != "open_code":
+            continue
         value = os.getenv(var, "").strip()
         if value:
             return value
@@ -780,7 +790,8 @@ def _default_planning_model(runtime: str | None = None) -> str:
     Precedence is inherited from ``resolve_runtime_models`` (highest first):
 
         1. ``SWE_MODEL_HIGH`` (planning reasoners are high-tier)
-        2. deployer env (``SWE_DEFAULT_MODEL`` → ``AI_MODEL`` → ``HARNESS_MODEL``)
+        2. deployer env (``SWE_DEFAULT_MODEL`` → ``AI_MODEL`` →
+           ``HARNESS_MODEL``, the latter only on ``open_code``)
         3. the runtime's own auto/base default:
              - ``codex``       → a codex-native model (never ``openrouter/…``)
              - ``open_code``   → the OpenRouter auto default (OpenRouter-only
@@ -869,7 +880,9 @@ def resolve_runtime_models(
     Resolution order (lowest → highest precedence):
         1. runtime base defaults (``_RUNTIME_BASE_MODELS[runtime]``)
         2. env-var cascade: ``SWE_DEFAULT_MODEL`` → ``AI_MODEL`` →
-           ``HARNESS_MODEL`` (first non-empty wins, applies to all roles)
+           ``HARNESS_MODEL`` (first non-empty wins, applies to all roles;
+           ``HARNESS_MODEL`` is consulted only on the ``open_code`` runtime —
+           see ``_default_model_from_env``)
         3. tier env vars: ``SWE_MODEL_LOW`` / ``SWE_MODEL_MED`` /
            ``SWE_MODEL_HIGH``, each applying to the roles in its tier
            (see ``ROLE_TO_TIER``)
@@ -898,7 +911,7 @@ def resolve_runtime_models(
         base = {field: _OPENROUTER_AUTO_DEFAULT_MODEL for field in base}
     resolved: dict[str, str] = {field: base[field] for field in field_names}
 
-    env_default = _default_model_from_env()
+    env_default = _default_model_from_env(runtime)
     if env_default:
         for field in field_names:
             resolved[field] = env_default
```

---

### Incident Patch 8: `9dfeb768` (2026-08-21)
**Commit Message**: fix: with SWE_PRO_ENGINE on, expose only the pro surface (#139)

When the pro engine is enabled (the af-install / desktop default), the node
still advertised the classic opencode-driven orchestrators (plan/build/execute/
resolve/resume_build) and implement_issue alongside the pro executor. Those
entry points drive the opencode role harness, which fails wherever opencode
isn't installed — the desktop bundle ships aforge, not opencode — so the Product
Manager reasoner dies in ~500ms and swe-planner.plan/build are broken entries
sitting next to swe-pro's working code_task.

Make the flag a replacement, not an addition: with pro.Available(), register
only the pro executor and withhold the classic entry points. Role reasoners stay
registered (internal, undiscoverable) so pro_execute can still call them. The
swe-pro sidecar (code_task/code_resume) is the coding surface. SWE_PRO_ENGINE=0
restores the full classic planning surface unchanged.

Updated the surface/entrypoint tests for the pro-on case.

Co-authored-by: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `go/internal/node/discovery_surface_test.go` (modified, +4/-1)
```diff
@@ -152,7 +152,10 @@ func TestProExecuteIsInternal(t *testing.T) {
 	if m.Description == "" {
 		t.Error("pro_execute lost its description")
 	}
-	assertSurface(t, "swe-planner[pro][entrypoint]", entrypointNames(n), wantEntrypoints)
+	// With the engine on the classic entry points are withheld, so the node
+	// advertises no entry points of its own — the swe-pro sidecar carries the
+	// coding entry (code_task/code_resume).
+	assertSurface(t, "swe-planner[pro][entrypoint]", entrypointNames(n), nil)
 }
 
 // TestExecuteDescribesItsPlanResultInput: execute's plan_result is the one input
```

**File**: `go/internal/node/pro_surface_test.go` (modified, +6/-5)
```diff
@@ -20,9 +20,11 @@ func fakeEngineBin(t *testing.T) {
 }
 
 // TestRegisterPlannerProSurfaceGated: with SWE_PRO_ENGINE set and the engine
-// binary present, the planner surface is the default 31 names plus exactly the
-// pro handlers — and nothing on the fast node changes (the pro surface is
-// planner-only).
+// binary present, the pro engine REPLACES the classic surface — the internal
+// role reasoners and the pro handlers register, but the opencode-driven
+// orchestrators and implement_issue are withheld (they'd fail wherever opencode
+// is absent; the swe-pro sidecar is the working coding entry). Nothing on the
+// fast node changes (the pro surface is planner-only).
 func TestRegisterPlannerProSurfaceGated(t *testing.T) {
 	t.Setenv(pro.EnvEnabled, "1")
 	fakeEngineBin(t)
@@ -33,8 +35,7 @@ func TestRegisterPlannerProSurfaceGated(t *testing.T) {
 	}
 	n.RegisterPlanner()
 
-	want := append(append([]string(nil), pythonRoleSurface...), pythonOrchestrators...)
-	want = append(want, pythonIssueReasoners...)
+	want := append([]string(nil), pythonRoleSurface...)
 	for name := range pro.Handlers() {
 		want = append(want, name)
 	}
```

**File**: `go/internal/node/register.go` (modified, +17/-4)
```diff
@@ -63,15 +63,28 @@ const (
 	tagInternal   = "internal"
 )
 
-// RegisterPlanner registers the full swe-planner surface: 25 role reasoners +
-// 5 orchestrators + the issue-level entry point (31 total). Ports swe_af/app.py.
+// RegisterPlanner registers the swe-planner surface. With the pro engine off it
+// is the full classic surface: 25 role reasoners + 5 orchestrators + the
+// issue-level entry point (31 total), porting swe_af/app.py. With the pro engine
+// on (pro.Available()), the classic entry points are withheld and only the pro
+// executor is added — see the body for why.
 func (n *Node) RegisterPlanner() {
 	n.registerRoles()
-	n.registerOrchestrators()
-	n.registerIssueReasoner()
+	// Pro engine on (the af-install / desktop default): the bundled swe-pro
+	// sidecar is the coding surface and needs no opencode, so register only the
+	// pro executor and withhold the classic opencode-driven entry points. The
+	// orchestrators (plan/build/execute/resolve/resume_build) and implement_issue
+	// drive the opencode role harness and fail wherever opencode is absent — the
+	// desktop bundle ships aforge, not opencode — so advertising them just
+	// surfaces broken entries next to swe-pro's working code_task. The role
+	// reasoners stay registered (internal, undiscoverable) so pro_execute can
+	// still call them. SWE_PRO_ENGINE=0 restores the full classic surface.
 	if pro.Available() {
 		n.registerProReasoners()
+		return
 	}
+	n.registerOrchestrators()
+	n.registerIssueReasoner()
 }
 
 // RegisterFast registers the swe-fast surface: the same 25 role reasoners + the
```

---

### Incident Patch 9: `e8f657d0` (2026-08-20)
**Commit Message**: Engine binaries for darwin-amd64 + linux-arm64; Windows-ready engine resolution (#138)

* fix(pro): make engine-binary resolution Windows-ready and document the platform set

Go never reports execute bits for regular files on Windows (os.Stat yields
0666/0444), so runnable() rejected every candidate there, and siblingNames
never looked for a .exe. The decision is now a pure, platform-parameterised
helper: on windows the candidates are swe-pro-<goos>-<goarch>.exe,
swe-pro.exe, then the bare names, and an existing regular file counts as
runnable; other OSes keep the execute-bit rule. No Windows engine ships yet
(swe-pro-go still has unix-only syscalls), so the docs say so and describe
the classic-loop fallback; they also list the vendored platform set.

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

* feat(pro): vendor darwin-amd64 and linux-arm64 engine builds

Built from the same swe-pro-go source as the existing darwin-arm64 and
linux-amd64 binaries (main @ 9c4e69a, cmd/codeaf, CGO_ENABLED=0,
-buildvcs=false, go1.25.4), so an Intel Mac or an arm64 Linux host — the
platform the end-to-end containers run on — gets the engine instead of
silently falling back to the classic loop.


**File**: `go/README.md` (modified, +1/-1)
```diff
@@ -165,7 +165,7 @@ set; the load-bearing ones:
 | `AGENT_CALLBACK_URL`                                      | Public URL the control plane calls the node back on. **Required for any containerized/remote deploy that isn't this compose file** (compose sets it per service) — without it the CP gets `504 agent_unreachable` |
 | `NODE_ID`                                                 | Node ID (`swe-planner` / `swe-fast`)           |
 | `PORT`                                                    | Listen port (`8005` / `8006`)                        |
-| `SWE_PRO_ENGINE`                                          | Route per-issue coding through the bundled high-performance coding engine (beta). **Set to `1` for you by `af install` / Desktop; unset (off) everywhere else** — clone, fork, compose, bare binary. `1`/`true`/`yes`/`on` enables, `0`/`false` disables |
+| `SWE_PRO_ENGINE`                                          | Route per-issue coding through the bundled high-performance coding engine (beta), vendored for darwin-arm64, darwin-amd64, linux-amd64, and linux-arm64. Windows is not yet supported by the engine; the node logs a warning and falls back to the classic loop there. **Set to `1` for you by `af install` / Desktop; unset (off) everywhere else** — clone, fork, compose, bare binary. `1`/`true`/`yes`/`on` enables, `0`/`false` disables |
 | `SWE_PRO_VARIANT`                                         | Engine reasoning-effort variant (e.g. `low` for fastest turnaround, `high` for depth). Unset keeps the engine's own default |
 | `SWE_PRO_MAX_COST`                                        | Per-run cost ceiling in USD forwarded to the engine on every dispatch. Unset: no SWE-AF-side ceiling |
 | `SWE_PRO_PUBLIC_URL`                                      | Callback base URL for the engine, mirroring `AGENT_CALLBACK_URL` on the nodes. **In Docker this must be set to a container-reachable URL**, otherwise the control plane can't call the engine back |
```

**File**: `go/docs/pro-engine.md` (modified, +8/-6)
```diff
@@ -2,9 +2,11 @@
 
 The Go node runs a high-performance coding engine, shipped as prebuilt
 binaries — one per supported platform, vendored at `go/bin` as
-`swe-pro-darwin-arm64` and `swe-pro-linux-amd64`, because one checkout is
-installed on macOS and Linux alike and the node picks the matching build at
-startup.
+`swe-pro-darwin-arm64`, `swe-pro-darwin-amd64`, `swe-pro-linux-amd64`, and
+`swe-pro-linux-arm64`, because one checkout is installed on macOS and Linux
+alike and the node picks the matching build at startup. The engine does not yet
+support Windows; there the node logs a warning and falls back to the classic
+coding loop.
 
 It is **on by default for nodes installed with `af install` or AgentField
 Desktop**: `agentfield-package.yaml` declares `SWE_PRO_ENGINE` with
@@ -59,8 +61,8 @@ to switch back. Two things differ from the classic loop, both additive:
 The engine never pushes or opens PRs — branch, push and PR creation stay with
 the standard pipeline, so the deliverables are unchanged.
 
-If the flag is set but no *runnable* engine binary is found — missing, or
-present without its execute bit — the node logs a warning naming the path and
+If the flag is set but no *runnable* engine binary is found — missing, or on
+Unix present without its execute bit — the node logs a warning naming the path and
 comes up on the classic coding loop: `pro_execute` is not registered and
 nothing is routed to an engine node that never joined. The binary is searched
 for at `SWE_PRO_BIN` when set (authoritative — no fallback), else
@@ -75,7 +77,7 @@ what keeps a macOS install from exec'ing the Linux build.
 | Variable | Default | Purpose |
 |---|---|---|
 | `SWE_PRO_ENGINE` | `1` via the manifest on `af install` / Desktop; unset (off) for a clone, fork, compose stack or bare binary | Truthy (`1`/`true`/`yes`/`on`) enables; `0`/`false` opts out |
-| `SWE_PRO_BIN` | `/usr/local/bin/swe-pro`, else a `swe-pro-<GOOS>-<GOARCH>` / `swe-pro` sibling | Engine binary path (authoritative when set) |
+| `SWE_PRO_BIN` | `/usr/local/bin/swe-pro`, else a `swe-pro-<GOOS>-<GOARCH>` / `swe-pro` sibling (`.exe` names first on Windows) | Engine binary path (authoritative when set); must have an execute bit on Unix |
 | `SWE_PRO_NODE_ID` | `swe-pro` | Engine's control-plane node id |
 | `SWE_PRO_PORT` | `8801` | Engine's listen port |
 | `SWE_PRO_PUBLIC_URL` | `http://localhost:8801` (engine default) | Callback base URL — **must** be set to a container-reachable address in Docker, otherwise the control plane cannot reach the engine |
```

**File**: `go/internal/pro/pro.go` (modified, +22/-7)
```diff
@@ -101,16 +101,23 @@ func Enabled() bool {
 func BinPath() string { return envOr(EnvBin, DefaultBin) }
 
 // runnable reports whether path is an existing regular file we could actually
-// spawn. Mere existence is not enough: a copy that lost its execute bit (some
-// installers create destination files with a fresh 0644 mode) would otherwise
-// look available and then fail at exec time, which is exactly the state the
-// availability gate exists to avoid.
+// spawn. On Unix, mere existence is not enough: a copy that lost its execute
+// bit (some installers create destination files with a fresh 0644 mode) would
+// otherwise look available and then fail at exec time. Windows does not expose
+// execute bits through os.Stat, so a regular file is sufficient there.
 func runnable(path string) bool {
 	info, err := os.Stat(path)
-	if err != nil || info.IsDir() {
+	if err != nil {
+		return false
+	}
+	return runnableMode(runtime.GOOS, info.Mode())
+}
+
+func runnableMode(goos string, mode os.FileMode) bool {
+	if !mode.IsRegular() {
 		return false
 	}
-	return info.Mode().Perm()&0o111 != 0
+	return goos == "windows" || mode.Perm()&0o111 != 0
 }
 
 // osExecutable is os.Executable, indirected so tests can point the sibling
@@ -126,7 +133,15 @@ var osExecutable = os.Executable
 // plain name stays as a fallback for layouts that place one hand-built engine
 // beside the node (an unpacked image, a local engine build).
 func siblingNames() []string {
-	return []string{"swe-pro-" + runtime.GOOS + "-" + runtime.GOARCH, "swe-pro"}
+	return siblingNamesFor(runtime.GOOS, runtime.GOARCH)
+}
+
+func siblingNamesFor(goos, goarch string) []string {
+	platformName := "swe-pro-" + goos + "-" + goarch
+	if goos == "windows" {
+		return []string{platformName + ".exe", "swe-pro.exe", platformName, "swe-pro"}
+	}
+	return []string{platformName, "swe-pro"}
 }
 
 // ResolveBin returns the first runnable engine binary on disk. An explicit
```

**File**: `go/internal/pro/pro_test.go` (modified, +67/-14)
```diff
@@ -80,6 +80,49 @@ func TestDefaults(t *testing.T) {
 	}
 }
 
+func TestSiblingNamesFor(t *testing.T) {
+	tests := []struct {
+		goos, goarch string
+		want         []string
+	}{
+		{"linux", "amd64", []string{"swe-pro-linux-amd64", "swe-pro"}},
+		{"darwin", "arm64", []string{"swe-pro-darwin-arm64", "swe-pro"}},
+		{"windows", "amd64", []string{"swe-pro-windows-amd64.exe", "swe-pro.exe", "swe-pro-windows-amd64", "swe-pro"}},
+	}
+	for _, tt := range tests {
+		t.Run(tt.goos+"/"+tt.goarch, func(t *testing.T) {
+			got := siblingNamesFor(tt.goos, tt.goarch)
+			if strings.Join(got, "\x00") != strings.Join(tt.want, "\x00") {
+				t.Errorf("siblingNamesFor(%q, %q) = %q, want %q", tt.goos, tt.goarch, got, tt.want)
+			}
+		})
+	}
+}
+
+func TestRunnableMode(t *testing.T) {
+	tests := []struct {
+		name string
+		goos string
+		mode os.FileMode
+		want bool
+	}{
+		{"linux regular 0644", "linux", 0o644, false},
+		{"linux regular 0755", "linux", 0o755, true},
+		{"darwin regular 0644", "darwin", 0o644, false},
+		{"darwin regular 0755", "darwin", 0o755, true},
+		{"windows regular 0666", "windows", 0o666, true},
+		{"linux directory", "linux", os.ModeDir | 0o755, false},
+		{"windows directory", "windows", os.ModeDir | 0o777, false},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			if got := runnableMode(tt.goos, tt.mode); got != tt.want {
+				t.Errorf("runnableMode(%q, %v) = %v, want %v", tt.goos, tt.mode, got, tt.want)
+			}
+		})
+	}
+}
+
 // TestResolveBin covers the three-step search: explicit SWE_PRO_BIN is
 // authoritative (found or not — no fall-through), and Available() is the
 // flag AND binary-presence conjunction.
@@ -110,12 +153,18 @@ func TestResolveBin(t *testing.T) {
 		t.Fatal(err)
 	}
 	t.Setenv(EnvBin, nonExec)
-	if _, ok := ResolveBin(); ok {
-		t.Error("ResolveBin() reported a non-executable file as usable")
-	}
 	t.Setenv(EnvEnabled, "1")
-	if Available() {
-		t.Error("Available() = true for a non-executable binary — must degrade to the classic loop")
+	if runtime.GOOS == "windows" {
+		if _, ok := ResolveBin(); !ok || !Available() {
+			t.Error("regular Windows binary reported unusable because os.Stat exposes no execute bits")
+		}
+	} else {
+		if _, ok := ResolveBin(); ok {
+			t.Error("ResolveBin() reported a non-executable file as usable")
+		}
+		if Available() {
+			t.Error("Available() = true for a non-executable binary — must degrade to the classic loop")
+		}
 	}
 
 	// A directory at the binary path is likewise not runnable (os.Stat alone
@@ -152,24 +201,28 @@ func TestResolveBinSiblings(t *testing.T) {
 	if runnable(DefaultBin) {
 		t.Skipf("%s exists on this host and short-circuits the sibling search", DefaultBin)
 	}
-	suffixed := "swe-pro-" + runtime.GOOS + "-" + runtime.GOARCH
+	names := siblingNames()
+	suffixed, plain := names[0], names[1]
 
-	cases := []struct {
+	type testCase struct {
 		name string
 		// present maps sibling file name to its mode; 0o644 is the
 		// present-but-unusable case the availability gate must reject.
 		present map[string]os.FileMode
 		want    string // sibling name, or "" for "no usable engine"
 		wantOK  bool
-	}{
-		{"suffixed preferred over plain", map[string]os.FileMode{suffixed: 0o755, "swe-pro": 0o755}, suffixed, true},
+	}
+	cases := []testCase{
+		{"suffixed preferred over plain", map[string]os.FileMode{suffixed: 0o755, plain: 0o755}, suffixed, true},
 		{"suffixed alone", map[string]os.FileMode{suffixed: 0o755}, suffixed, true},
-		{"plain alone is the fallback", map[string]os.FileMode{"swe-pro": 0o755}, "swe-pro", true},
+		{"plain alone is the fallback", map[string]os.FileMode{plain: 0o755}, plain, true},
 		{"neither present", nil, "", false},
-		{"plain usable, suffixed not", map[string]os.FileMode{suffixed: 0o644, "swe-pro": 0o755}, "swe-pro", true},
-		// Both unusable: the warning must name the suffixed candidate, the one
-		// this platform was meant to run.
-		{"both unusable names the best candidate", map[string]os.FileMode{suffixed: 0o644, "swe-pro": 0o644}, suffixed, false},
+	}
+	if runtime.GOOS != "windows" {
+		cases = append(cases,
+			testCase{"plain usable, suffixed not", map[string]os.FileMode{suffixed: 0o644, plain: 0o755}, plain, true},
+			testCase{"both unusable names the best candidate", map[string]os.FileMode{suffixed: 0o644, plain: 0o644}, suffixed, false},
+		)
 	}
 	for _, tc := range cases {
 		t.Run(tc.name, func(t *testing.T) {
```

---

### Incident Patch 10: `e974fee7` (2026-08-10)
**Commit Message**: fix(planning): make auto model defaults runtime-aware; surface empty harness completions distinctly (#108)

* fix(planning): make auto planning-model default runtime-aware

The planning pipeline resolved its default model from env keys alone via
_default_planning_model(), ignoring the caller's resolved runtime. A caller
that pinned ai_provider="codex" in an OpenRouter-only environment therefore
had the codex CLI spawned with an "openrouter/..." model its OpenAI backend
cannot resolve — completing in ~1s with a null message.

Thread the resolved runtime into _default_planning_model() and delegate to
the already-runtime-aware resolve_runtime_models() cascade for the high-tier
pm role. The auto default is now gated on runtime:
  - codex       -> a codex-native model (never openrouter/...-prefixed)
  - open_code   -> the OpenRouter auto default (OpenRouter-only env) or the
                   open_code base default otherwise
  - claude_code -> the "sonnet" historical default

Explicit args and deployer env (SWE_DEFAULT_MODEL / AI_MODEL / HARNESS_MODEL,
SWE_MODEL_HIGH) still win verbatim — only the auto default became
runtime-aware. Omitting the runtime arg preserves the prior env-only b

**File**: `swe_af/app.py` (modified, +6/-1)
```diff
@@ -1459,8 +1459,13 @@ async def plan(
     ``_default_runtime``). Any explicitly passed value always wins.
     """
     # Resolve provider/model defaults from the environment (see docstring).
+    # The model default is resolved *for the chosen runtime* so it can never
+    # hand a provider-prefixed id (e.g. an ``openrouter/…`` model) to a runtime
+    # whose CLI can't consume it — the cross-runtime leak that caused silent
+    # ~1s empty completions when a caller pinned ``codex`` under OpenRouter-only
+    # env. Explicit ``ai_provider`` still wins; only the auto default is gated.
     ai_provider = ai_provider or _default_runtime()
-    default_model = _default_planning_model()
+    default_model = _default_planning_model(ai_provider)
     pm_model = pm_model or default_model
     architect_model = architect_model or default_model
     tech_lead_model = tech_lead_model or default_model
```

**File**: `swe_af/execution/fatal_error.py` (modified, +126/-0)
```diff
@@ -56,6 +56,36 @@ def __init__(self, message: str) -> None:
         self.original_message = message
 
 
+class EmptyHarnessCompletionError(RuntimeError):
+    """Raised when a harness call completes but produces no output at all.
+
+    Distinct from a *schema-invalid* completion (output present but unparseable
+    into the target schema). An empty completion — the harness returned with no
+    parsed object and no raw text, typically in ~1s — almost always means the
+    provider/model pairing is wrong: e.g. a model id prefixed for a *different*
+    runtime (an ``openrouter/…`` model handed to the codex CLI's OpenAI
+    backend, which doesn't know it) or missing/invalid auth for the selected
+    provider. Collapsing this into the generic "failed to produce a valid
+    <artifact>" message makes it indistinguishable from a genuine schema-quality
+    failure, so this error names the provider and model explicitly to point at
+    the real root cause.
+    """
+
+    def __init__(self, *, role: str, provider: str, model: str, detail: str = "") -> None:
+        message = (
+            f"{role} harness returned an empty completion "
+            f"(provider={provider}, model={model}) — check provider "
+            f"auth/model compatibility"
+        )
+        if detail:
+            message = f"{message}: {detail}"
+        super().__init__(message)
+        self.role = role
+        self.provider = provider
+        self.model = model
+        self.original_message = detail
+
+
 def is_fatal_error(error_message: str) -> bool:
     """Return True if *error_message* matches a known fatal API error pattern."""
     if not error_message:
@@ -86,3 +116,99 @@ def check_fatal_harness_error(result) -> None:
     msg = getattr(result, "error_message", "") or ""
     if is_fatal_error(msg):
         raise FatalHarnessError(msg)
+
+
+# The SDK classifies terminal harness failures on ``HarnessResult.failure_type``
+# (``FailureType`` in ``agentfield.harness._result``: none/crash/timeout/
+# api_error/no_output/schema). ``schema`` means the harness *did* produce output
+# that simply failed validation — the opposite of an empty completion.
+#
+# That enum is not re-exported from any public ``agentfield`` module, so rather
+# than importing a private symbol we compare on its token. ``FailureType``
+# subclasses ``str``, so the wire value is stable and this works whether the
+# attribute arrives as an enum member or as a plain string. SDKs predating
+# ``failure_type`` yield ``""`` and keep the previous behavior.
+_SCHEMA_FAILURE_TOKEN = "schema"
+
+
+def _failure_type_token(result) -> str:
+    """Normalized ``failure_type`` token, or ``""`` when absent/unreadable."""
+    raw = getattr(result, "failure_type", None)
+    if raw is None:
+        return ""
+    token = getattr(raw, "value", None)
+    if not isinstance(token, str):
+        token = getattr(raw, "name", None)
+    if not isinstance(token, str):
+        token = str(raw)
+    token = token.strip().lower()
+    # Tolerate a repr-ish "failuretype.schema" spelling from str(enum_member).
+    return token.rsplit(".", 1)[-1]
+
+
+def _is_schema_failure(result) -> bool:
+    """Whether the SDK already classified this as a schema-validation failure."""
+    return _failure_type_token(result) == _SCHEMA_FAILURE_TOKEN
+
+
+def _harness_output_text(result) -> str:
+    """Best-effort raw completion text from a HarnessResult-like object.
+
+    Reads ``result`` (the raw completion string) first, falling back to the
+    ``text`` convenience property. Returns ``""`` when neither is populated.
+    """
+    raw = getattr(result, "result", None)
+    if not raw:
+        raw = getattr(result, "text", None)
+    return raw or ""
+
+
+def check_empty_harness_completion(
+    result, *, role: str, provider: str, model: str
+) -> None:
+    """Raise ``EmptyHarnessCompletionError`` when a harness produced no output.
+
+    Call *after* ``check_fatal_harness_error`` and *before* the caller's
+    ``parsed is None`` schema-quality check. This fires only for the "empty
+    completion" shape — neither a parsed object nor any raw text — which is the
+    signature of a provider/model mismatch (a model id meant for a different
+    runtime, or bad auth) rather than a schema-quality problem.
+
+    It is a no-op — deferring to the caller's generic schema-invalid error,
+    which should also name provider+model — when either:
+
+    - raw text *is* present but couldn't be parsed; or
+    - the SDK already classified the failure as ``failure_type=schema``. That
+      path returns ``result=None`` with no text even though the agent *did*
+      produce output (e.g. it wrote a malformed ``prd.json`` through the Write
+      tool and emitted no closing prose), so the empty-completion shape alone
+      cannot distinguish it from a real provider/model mismatch.
+
+    Parameters
+    ----------
+    result:
+        A ``HarnessResult`` (or any object exposing ``parsed`` / ``resu
```

**File**: `swe_af/execution/schemas.py` (modified, +51/-20)
```diff
@@ -18,7 +18,11 @@
     model_validator,
 )
 from swe_af.hitl.ask_user import AskUserForm
-from swe_af.runtime.providers import RUNTIME_VALUES, runtime_to_harness_provider
+from swe_af.runtime.providers import (
+    RUNTIME_VALUES,
+    normalize_runtime_provider,
+    runtime_to_harness_provider,
+)
 
 # Global default for all agent max_turns. Change this one value to adjust everywhere.
 DEFAULT_AGENT_MAX_TURNS: int = 150
@@ -739,32 +743,59 @@ def _tier_models_from_env() -> dict[str, str]:
     return tiers
 
 
-def _default_planning_model() -> str:
+def _default_planning_model(runtime: str | None = None) -> str:
     """Model for the planning reasoners (the ``plan`` pipeline) when the caller
-    passes no model.
+    passes no model, resolved for the *given runtime*.
 
     The planning reasoners take an explicit ``model`` argument rather than a
-    runtime ``models={}`` config, so the ``resolve_runtime_models`` cascade
-    doesn't apply to them. This mirrors that cascade for the planning path so an
-    OpenRouter-only deployment is zero-config. The planning reasoners are
-    high-tier roles (see ``ROLE_TO_TIER``), so ``SWE_MODEL_HIGH`` beats the
-    generic default-model env — the same relative precedence tier env vars have
-    in ``resolve_runtime_models``. Precedence, first match wins:
+    runtime ``models={}`` config, so the SDK never runs the
+    ``resolve_runtime_models`` cascade for them. This delegates to that same
+    cascade for the high-tier ``pm`` role so the planning path picks a model
+    that is valid for ``runtime`` — critically, the auto default is
+    runtime-gated and never leaks a provider-prefixed id (e.g. an
+    ``openrouter/…`` model) into a runtime whose CLI cannot consume it. That
+    cross-runtime leak was the root cause of silent ~1s empty completions when a
+    caller pinned ``codex`` in an OpenRouter-only environment.
+
+    ``runtime`` is normalized (aliases like ``claude`` / ``opencode`` accepted).
+    When omitted, the runtime is resolved from the environment via
+    ``_default_runtime`` — and the auto default then follows *that* runtime.
+    Omitting the argument therefore does **not** reproduce the old env-only
+    cascade in every configuration. The old cascade returned ``sonnet`` whenever
+    ``SWE_DEFAULT_RUNTIME`` was set to anything at all (setting it opts out of
+    ``_openrouter_only_env``), so these deployments change behavior:
+
+        SWE_DEFAULT_RUNTIME=open_code, no model env  → was ``sonnet``,
+            now the ``open_code`` base default
+        SWE_DEFAULT_RUNTIME=codex, no model env      → was ``sonnet``,
+            now the codex base default for the active auth mode
+
+    That is the intended fix, not a regression: a deployer who pinned a runtime
+    was silently getting a *Claude* planning model for it. Everything else is
+    unchanged — no ``SWE_DEFAULT_RUNTIME`` (auto-selection, both the
+    OpenRouter-only and the Claude branch), ``SWE_DEFAULT_RUNTIME=claude_code``,
+    and an invalid ``SWE_DEFAULT_RUNTIME`` all resolve exactly as before, as does
+    any configuration that sets a model env var (layers 1–2 below).
+
+    Precedence is inherited from ``resolve_runtime_models`` (highest first):
 
         1. ``SWE_MODEL_HIGH`` (planning reasoners are high-tier)
         2. deployer env (``SWE_DEFAULT_MODEL`` → ``AI_MODEL`` → ``HARNESS_MODEL``)
-        3. the OpenRouter default when only an OpenRouter key is present
-        4. the Claude ``sonnet`` alias (historical default)
+        3. the runtime's own auto/base default:
+             - ``codex``       → a codex-native model (never ``openrouter/…``)
+             - ``open_code``   → the OpenRouter auto default (OpenRouter-only
+                                 env) or the ``open_code`` base default
+             - ``claude_code`` → the Claude ``sonnet`` alias (historical default)
+
+    Env / explicit values (layers 1–2) still win verbatim — the deployer owns
+    them — so only the auto default (layer 3) is made runtime-aware.
     """
-    high_model = _tier_models_from_env().get("high")
-    if high_model:
-        return high_model
-    env_model = _default_model_from_env()
-    if env_model:
-        return env_model
-    if _openrouter_only_env():
-        return _OPENROUTER_AUTO_DEFAULT_MODEL
-    return "sonnet"
+    resolved_runtime = normalize_runtime_provider(runtime) if runtime else _default_runtime()
+    return resolve_runtime_models(
+        runtime=resolved_runtime,
+        models=None,
+        field_names=["pm_model"],
+    )["pm_model"]
 
 
 def _legacy_hint_for_model_key(key: str) -> str:
```

**File**: `swe_af/reasoners/pipeline.py` (modified, +38/-5)
```diff
@@ -14,7 +14,10 @@
 
 from pydantic import BaseModel
 
-from swe_af.execution.fatal_error import check_fatal_harness_error
+from swe_af.execution.fatal_error import (
+    check_empty_harness_completion,
+    check_fatal_harness_error,
+)
 from swe_af.execution.schemas import DEFAULT_AGENT_MAX_TURNS
 from swe_af.reasoners.schemas import (
     Architecture,
@@ -217,6 +220,12 @@ async def _invoke_pm(prior_user_responses: list[dict] | None) -> PRD | None:
             cwd=repo_path,
         )
         check_fatal_harness_error(result)
+        # An empty completion here (no parsed output, no text) is a
+        # provider/model mismatch, not a schema-quality problem — surface it
+        # distinctly with provider+model instead of the generic PRD message.
+        check_empty_harness_completion(
+            result, role="PM", provider=provider, model=model
+        )
         return result.parsed
 
     initial_prior = list(prior_user_responses or [])
@@ -231,7 +240,13 @@ async def _invoke_pm(prior_user_responses: list[dict] | None) -> PRD | None:
     )
 
     if parsed is None:
-        raise RuntimeError("Product manager failed to produce a valid PRD")
+        # Reached only when the harness produced non-empty but unparseable
+        # output (empty completions are raised distinctly above). Name the
+        # provider+model so the failure is diagnosable.
+        raise RuntimeError(
+            f"Product manager failed to produce a valid PRD "
+            f"(provider={provider}, model={model})"
+        )
 
     router.note("PM complete", tags=["pm", "complete"])
     return parsed.model_dump()
@@ -407,8 +422,14 @@ async def run_architect(
         cwd=repo_path,
     )
     check_fatal_harness_error(result)
+    check_empty_harness_completion(
+        result, role="Architect", provider=provider, model=model
+    )
     if result.parsed is None:
-        raise RuntimeError("Architect failed to produce a valid architecture")
+        raise RuntimeError(
+            f"Architect failed to produce a valid architecture "
+            f"(provider={provider}, model={model})"
+        )
 
     router.note("Architect complete", tags=["architect", "complete"])
     return result.parsed.model_dump()
@@ -462,8 +483,14 @@ async def run_tech_lead(
         cwd=repo_path,
     )
     check_fatal_harness_error(result)
+    check_empty_harness_completion(
+        result, role="Tech lead", provider=provider, model=model
+    )
     if result.parsed is None:
-        raise RuntimeError("Tech lead failed to produce a valid review")
+        raise RuntimeError(
+            f"Tech lead failed to produce a valid review "
+            f"(provider={provider}, model={model})"
+        )
 
     review = result.parsed.model_dump()
     review_json_path = os.path.join(base, "plan", "review.json")
@@ -539,8 +566,14 @@ class SprintPlanOutput(BaseModel):
         cwd=repo_path,
     )
     check_fatal_harness_error(result)
+    check_empty_harness_completion(
+        result, role="Sprint planner", provider=provider, model=model
+    )
     if result.parsed is None:
-        raise RuntimeError("Sprint planner failed to produce valid issues")
+        raise RuntimeError(
+            f"Sprint planner failed to produce valid issues "
+            f"(provider={provider}, model={model})"
+        )
 
     router.note("Sprint Planner complete", tags=["sprint_planner", "complete"])
     return {
```

**File**: `tests/test_runtime_aware_model_default.py` (added, +372/-0)
```diff
@@ -0,0 +1,372 @@
+"""Runtime-aware planning-model defaults + distinct empty-completion errors.
+
+Validation contract (see PR "fix(planning): make auto model defaults
+runtime-aware; surface empty harness completions distinctly"):
+
+- OpenRouter-only env + runtime ``codex`` → the auto default is NOT an
+  ``openrouter/``-prefixed id (it is a codex-native model). A caller pinning
+  ``codex`` in an OpenRouter-only environment must never hand the codex CLI a
+  model its OpenAI backend can't resolve (the silent ~1s empty-completion bug).
+- OpenRouter-only env + runtime ``open_code`` → the OpenRouter auto default is
+  preserved (unchanged behavior).
+- runtime ``claude_code`` → the ``sonnet`` historical default is preserved.
+- ``SWE_DEFAULT_MODEL`` (deployer env) wins in every runtime cell.
+- An empty harness completion raises a distinct error that names the provider
+  and the model, separate from the generic schema-invalid message.
+- A *schema* failure does NOT raise that error, even though it shares the
+  empty-completion shape (no parsed object, no text): the SDK marks it
+  ``failure_type=schema``, meaning output existed but failed validation, so
+  blaming provider auth would point at the wrong root cause.
+- A parsed object that is valid but falsy counts as a completion.
+"""
+
+from __future__ import annotations
+
+import asyncio
+from types import SimpleNamespace
+
+import pytest
+
+from swe_af.execution.fatal_error import (
+    EmptyHarnessCompletionError,
+    check_empty_harness_completion,
+)
+from swe_af.execution.schemas import (
+    _CODEX_CHATGPT_MODEL,
+    _OPENROUTER_AUTO_DEFAULT_MODEL,
+    _RUNTIME_BASE_MODELS,
+    _default_planning_model,
+)
+
+# open_code's base default for an *explicit* open_code runtime (i.e. not the
+# OpenRouter-only auto-selection path). Read straight off the runtime table
+# instead of being duplicated as a literal here: a hardcoded copy silently goes
+# stale every time the default model is rolled (it already did once), and the
+# behavior under test is "an explicit open_code runtime resolves open_code's own
+# base default" — not "…resolves <some specific model id>".
+_OPEN_CODE_BASE = _RUNTIME_BASE_MODELS["open_code"]["pm_model"]
+
+# The SDK's own SCHEMA failure classification, so the test exercises the real
+# object the harness hands back rather than a look-alike. The enum lives in a
+# private module (it is not re-exported from ``agentfield.harness``), so fall
+# back to the wire value if that ever moves — the production code compares on
+# the token for exactly the same reason.
+try:  # pragma: no cover - import shape depends on the installed SDK
+    from agentfield.harness._result import FailureType as _SdkFailureType
+
+    _SDK_SCHEMA_FAILURE = _SdkFailureType.SCHEMA
+except ImportError:  # pragma: no cover
+    _SDK_SCHEMA_FAILURE = "schema"
+
+# Every env var that steers runtime/model selection — cleared before each test
+# so results never depend on the developer's ambient shell.
+_STEERING_ENV_KEYS = (
+    "ANTHROPIC_API_KEY",
+    "OPENROUTER_API_KEY",
+    "OPENAI_API_KEY",
+    "SWE_DEFAULT_RUNTIME",
+    "SWE_DEFAULT_MODEL",
+    "AI_MODEL",
+    "HARNESS_MODEL",
+    "SWE_MODEL_LOW",
+    "SWE_MODEL_MED",
+    "SWE_MODEL_HIGH",
+    "SWE_CODEX_AUTH_MODE",
+)
+
+
+@pytest.fixture(autouse=True)
+def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
+    for key in _STEERING_ENV_KEYS:
+        monkeypatch.delenv(key, raising=False)
+
+
+def _run(coro):
+    return asyncio.run(coro)
+
+
+# ---------------------------------------------------------------------------
+# Matrix: (env) x (runtime) -> resolved planning-model default
+# ---------------------------------------------------------------------------
+
+# Env presets applied via monkeypatch.setenv. "swe_default_model" also sets an
+# OpenRouter key to prove the explicit env value wins over the auto default.
+_ENV_PRESETS: dict[str, dict[str, str]] = {
+    "openrouter_only": {"OPENROUTER_API_KEY": "sk-or-test"},
+    "anthropic": {"ANTHROPIC_API_KEY": "sk-ant-test"},
+    "swe_default_model": {
+        "OPENROUTER_API_KEY": "sk-or-test",
+        "SWE_DEFAULT_MODEL": "explicit/model-x",
+    },
+}
+
+# (env_preset, runtime) -> expected resolved default.
+# Under "swe_default_model" the deployer env wins verbatim for every runtime.
+# Under "openrouter_only"/"anthropic" the runtime's own auto/base default is
+# used — critically never an openrouter/ id for codex.
+# Note the two open_code rows may resolve to the same id: since the open_code
+# base default and the OpenRouter auto default were unified, the auto-selection
+# path and an explicit open_code runtime land on the same model. They stay
+# separate rows because they exercise different branches of the cascade.
+_MATRIX: list[tuple[str, str, str]] = [
+    ("openrouter_only", "open_code", _OPENROUTER_AUTO_DEFAULT_MODEL),
+    ("openrouter_only", "codex", _CODEX_CHATGPT_MODEL),
+    ("openrouter_only", "claude_code", "sonne
```

---

### Incident Patch 11: `678ab812` (2026-08-10)
**Commit Message**: fix(examples): log skipped malformed JSONL lines (#117)

analyze_v2.py and analyze_pipeline.py already narrowed parsing to
json.JSONDecodeError, but the except branch silently discarded bad
lines. Print a warning to stderr so corrupted log data is visible.

Signed-off-by: Andrew White <[REDACTED_EMAIL]>
Signed-off-by: Andrew White <[REDACTED_EMAIL]>

**File**: `examples/diagrams/analyze_pipeline.py` (modified, +5/-1)
```diff
@@ -42,7 +42,11 @@ def parse_log(filepath):
                 try:
                     events.append(json.loads(line))
                 except json.JSONDecodeError:
-                    pass
+                    print(
+                        f"Warning: skipping malformed JSONL line in {filepath}: "
+                        f"{line[:200]!r}",
+                        file=sys.stderr,
+                    )
     return events
 
 
```

**File**: `examples/diagrams/analyze_v2.py` (modified, +5/-1)
```diff
@@ -46,7 +46,11 @@ def parse_log(filepath):
                 try:
                     events.append(json.loads(line))
                 except json.JSONDecodeError:
-                    pass
+                    print(
+                        f"Warning: skipping malformed JSONL line in {filepath}: "
+                        f"{line[:200]!r}",
+                        file=sys.stderr,
+                    )
     return events
 
 
```

---

### Incident Patch 12: `26c44e90` (2026-08-10)
**Commit Message**: fix: chain asyncio.TimeoutError cause in _call_with_timeout (#114)

Both coding_loop.py and dag_executor.py define _call_with_timeout and
catch asyncio.TimeoutError, but they raised a plain TimeoutError without
chaining the original exception. Preserve the cause so callers can trace
the timeout back to its source.

Adds a parametrized unit test that asserts TimeoutError.__cause__ is the
original asyncio.TimeoutError for both implementations.

**File**: `swe_af/execution/coding_loop.py` (modified, +2/-2)
```diff
@@ -35,8 +35,8 @@ async def _call_with_timeout(coro, timeout: int = 2700, label: str = ""):
     """Wrap a coroutine with asyncio.wait_for timeout."""
     try:
         return await asyncio.wait_for(coro, timeout=timeout)
-    except asyncio.TimeoutError:
-        raise TimeoutError(f"Agent call '{label}' timed out after {timeout}s")
+    except asyncio.TimeoutError as exc:
+        raise TimeoutError(f"Agent call '{label}' timed out after {timeout}s") from exc
 
 
 # ---------------------------------------------------------------------------
```

**File**: `swe_af/execution/dag_executor.py` (modified, +2/-2)
```diff
@@ -42,10 +42,10 @@ async def _call_with_timeout(coro, timeout: int = 2700, label: str = ""):
     """
     try:
         return await asyncio.wait_for(coro, timeout=timeout)
-    except asyncio.TimeoutError:
+    except asyncio.TimeoutError as exc:
         raise TimeoutError(
             f"Agent call '{label}' timed out after {timeout}s"
-        )
+        ) from exc
 
 
 # ---------------------------------------------------------------------------
```

**File**: `tests/test_call_with_timeout.py` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+"""Unit tests for the timeout wrappers used by the execution engine."""
+
+from __future__ import annotations
+
+import asyncio
+
+import pytest
+
+from swe_af.execution.coding_loop import _call_with_timeout as coding_loop_timeout
+from swe_af.execution.dag_executor import _call_with_timeout as dag_executor_timeout
+
+
+@pytest.mark.parametrize("fn", [coding_loop_timeout, dag_executor_timeout])
+async def test_call_with_timeout_chains_original_exception(fn):
+    """TimeoutError must carry the original asyncio.TimeoutError as its cause."""
+
+    async def slow():
+        raise asyncio.TimeoutError("simulated")
+
+    with pytest.raises(TimeoutError) as exc_info:
+        await fn(slow(), timeout=1, label="test")
+
+    assert isinstance(exc_info.value.__cause__, asyncio.TimeoutError)
```

---

### Incident Patch 13: `ef508a8f` (2026-08-06)
**Commit Message**: Default every model to DeepSeek V4 Flash 0731 (classic loop + pro engine) (#132)

* Set DeepSeek V4 Flash 0731 as default model

* chore: re-vendor pro engine with v4-flash-0731 default pools

Rebuilt from swe-pro-go@c7f46db (clean tree — the previous vendored build
was vcs.modified=true). Both compiled-in pools now lead with
openrouter/deepseek/deepseek-v4-flash-0731; verified via strings and
go version -m on both platform binaries.

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

* style: gofmt synthmodel_test.go

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `.env.example` (modified, +8/-8)
```diff
@@ -10,7 +10,7 @@
 # needed to get started; GH_TOKEN below is optional.
 # With ONLY an OpenRouter key set (no ANTHROPIC_API_KEY, no SWE_DEFAULT_RUNTIME),
 # SWE-AF auto-selects the open_code runtime and defaults every role to
-# openrouter/deepseek/deepseek-v4-flash. Override with SWE_DEFAULT_MODEL.
+# openrouter/deepseek/deepseek-v4-flash-0731. Override with SWE_DEFAULT_MODEL.
 # OPENROUTER_API_KEY=sk-or-v1-...
 
 # Option B: Anthropic API key — used by claude-agent-sdk for all coding agents
@@ -127,19 +127,19 @@
 # a config through. Unset = auto: open_code when an OpenRouter key is the
 # only provider credential, else claude_code. An invalid value is logged as
 # a warning and ignored. Leave this UNSET on an OpenRouter-only deployment —
-# auto-select already picks open_code and the deepseek-v4-flash default.
+# auto-select already picks open_code and the deepseek-v4-flash-0731 default.
 # SWE_DEFAULT_RUNTIME=claude_code  # or: open_code, codex
 
 # Default model when callers don't pass `models` in the request config.
 # Applies to all 16 agent roles for whichever runtime is active. Caller
 # config (`models.default` or per-role keys) overrides this. Set this on
 # the deployment to pin a model without code changes — e.g. swap from
-# deepseek-v4-flash to a newer release. Empty / unset → use the runtime's
-# baked-in defaults (openrouter/deepseek/deepseek-v4-flash on open_code).
+# deepseek-v4-flash-0731 to a newer release. Empty / unset → use the runtime's
+# baked-in defaults (openrouter/deepseek/deepseek-v4-flash-0731 on open_code).
 # This is the variable to use for role model selection; AI_MODEL below is
 # part of the same cascade but is also the direct-LLM fallback, so prefer
 # this one.
-# SWE_DEFAULT_MODEL=openrouter/deepseek/deepseek-v4-flash
+# SWE_DEFAULT_MODEL=openrouter/deepseek/deepseek-v4-flash-0731
 
 # Per-tier models. Each of the 17 agent roles belongs to one of three tiers:
 #   high = planning-heavy reasoning (pm, architect, tech_lead, replan)
@@ -156,7 +156,7 @@
 # and codex (model_reasoning_effort).
 # SWE_MODEL_HIGH=openrouter/z-ai/glm-5.2
 # SWE_MODEL_MED=openrouter/deepseek/deepseek-v4-pro
-# SWE_MODEL_LOW=openrouter/deepseek/deepseek-v4-flash
+# SWE_MODEL_LOW=openrouter/deepseek/deepseek-v4-flash-0731
 
 # Runtime/model selection is configured via API request config (V2):
 # {
@@ -185,7 +185,7 @@
 # {"runtime": "codex", "models": {"default": "gpt-5.3-codex"}}
 
 # Available open runtime model IDs (format: provider/model-name):
-#   openrouter/deepseek/deepseek-v4-flash  # the open_code default
+#   openrouter/deepseek/deepseek-v4-flash-0731  # the open_code default
 #   deepseek/deepseek-chat      # DeepSeek via OpenRouter
 #   minimax/minimax-m2.5        # MiniMax M2.5 via OpenRouter
 #   qwen/qwen-2.5-72b-instruct  # Qwen via OpenRouter
@@ -225,7 +225,7 @@
 # Engine model pools and reasoning effort. Unset keeps the engine's own
 # defaults (all OpenRouter ids, so an OpenRouter key is all it needs).
 # SWE_PRO_MODELS_HIGH=openrouter/deepseek/deepseek-v4-pro
-# SWE_PRO_MODELS_LOW=openrouter/deepseek/deepseek-v4-flash
+# SWE_PRO_MODELS_LOW=openrouter/deepseek/deepseek-v4-flash-0731
 # SWE_PRO_VARIANT=low
 # Per-run USD ceiling. Unset = no per-run cap; set this on shared or
 # unattended deployments so a wide issue DAG cannot run away.
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -246,7 +246,7 @@ New to AgentField? Install the control plane first with `curl -fsSL https://agen
 
 One click deploys SWE-AF + AgentField control plane + PostgreSQL. Exactly **one** environment variable is required in Railway — an LLM provider key:
 
-- `OPENROUTER_API_KEY` — **recommended, simplest**. One key, 200+ open and proprietary models. With only this set (no `ANTHROPIC_API_KEY`, no `SWE_DEFAULT_RUNTIME`), SWE-AF auto-selects the `open_code` runtime and defaults every role to `openrouter/deepseek/deepseek-v4-flash` — no further configuration needed.
+- `OPENROUTER_API_KEY` — **recommended, simplest**. One key, 200+ open and proprietary models. With only this set (no `ANTHROPIC_API_KEY`, no `SWE_DEFAULT_RUNTIME`), SWE-AF auto-selects the `open_code` runtime and defaults every role to `openrouter/deepseek/deepseek-v4-flash-0731` — no further configuration needed.
 - *Alternative:* `ANTHROPIC_API_KEY`, or `CLAUDE_CODE_OAUTH_TOKEN` from `claude setup-token` in [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (uses Pro/Max subscription credits), to run the `claude_code` runtime instead.
 
 Optional:
```

**File**: `agentfield-package.yaml` (modified, +2/-2)
```diff
@@ -31,7 +31,7 @@ user_environment:
   require_one_of:
     # SWE-AF runs on either Claude (Anthropic) or open models via OpenRouter.
     # Provide one. With only an OpenRouter key it auto-selects the open_code
-    # runtime and defaults to openrouter/deepseek/deepseek-v4-flash.
+    # runtime and defaults to openrouter/deepseek/deepseek-v4-flash-0731.
     - id: llm_provider
       description: an LLM provider key
       options:
@@ -55,7 +55,7 @@ user_environment:
     - name: SWE_DEFAULT_RUNTIME
       description: Coding runtime for every role (claude_code | open_code | codex)
     - name: SWE_DEFAULT_MODEL
-      description: Override the model id for every role (e.g. openrouter/deepseek/deepseek-v4-flash)
+      description: Override the model id for every role (e.g. openrouter/deepseek/deepseek-v4-flash-0731)
     - name: AGENTFIELD_SERVER
       description: Control-plane URL
       default: http://localhost:8080
```

**File**: `docs/ARCHITECTURE.md` (modified, +1/-1)
```diff
@@ -441,7 +441,7 @@ Runtime defaults:
 | Runtime | Base default | Special default |
 |---|---|---|
 | `claude_code` | `sonnet` | `qa_synthesizer=haiku` |
-| `open_code` | `openrouter/deepseek/deepseek-v4-flash` | none |
+| `open_code` | `openrouter/deepseek/deepseek-v4-flash-0731` | none |
 | `codex` | `gpt-5.3-codex` | none |
 
 The `open_code` default applies both when the runtime is auto-selected (only
```

**File**: `docs/deployment.md` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ it commented out unless you mean to use it.
 
 | Variable | Purpose |
 |---|---|
-| `OPENROUTER_API_KEY` | **Recommended** — OpenRouter key (200+ models). The only secret needed to get started: on its own it auto-selects the `open_code` runtime and defaults every role to `openrouter/deepseek/deepseek-v4-flash` |
+| `OPENROUTER_API_KEY` | **Recommended** — OpenRouter key (200+ models). The only secret needed to get started: on its own it auto-selects the `open_code` runtime and defaults every role to `openrouter/deepseek/deepseek-v4-flash-0731` |
 | `ANTHROPIC_API_KEY` | Anthropic API key for Claude models (`claude_code` runtime) |
 | `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code subscription token (uses Pro/Max credits) |
 | `OPENAI_API_KEY` | OpenAI API key |
```

**File**: `go/agentfield-package.yaml` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ user_environment:
     - name: SWE_DEFAULT_RUNTIME
       description: Coding runtime for every role (claude_code | open_code | codex)
     - name: SWE_DEFAULT_MODEL
-      description: Override the model id for every role (e.g. openrouter/deepseek/deepseek-v4-flash)
+      description: Override the model id for every role (e.g. openrouter/deepseek/deepseek-v4-flash-0731)
     - name: SWE_PRO_ENGINE
       description: >-
         High-performance coding engine (beta). On by default for nodes
```

**File**: `go/docs/pro-engine.md` (modified, +1/-1)
```diff
@@ -91,7 +91,7 @@ The engine inherits `OPENROUTER_API_KEY` and the control-plane coordinates
 `SWE_DEFAULT_RUNTIME` unset, so with an OpenRouter key as the only provider
 credential the node auto-selects the `open_code` runtime and defaults every
 role — including the advisory and verification roles that run outside the
-engine — to `openrouter/deepseek/deepseek-v4-flash`. Setting
+engine — to `openrouter/deepseek/deepseek-v4-flash-0731`. Setting
 `SWE_DEFAULT_RUNTIME` explicitly is supported but unnecessary here.
 
 ## Control-plane inactivity sweep
```

**File**: `go/internal/config/config_test.go` (modified, +9/-9)
```diff
@@ -121,7 +121,7 @@ func TestResolveRuntimeModels_OpenCodeDefaults(t *testing.T) {
 	clearProviderEnv(t) // no provider env -> the shared open_code base applies
 	got := mustResolve(t, "open_code", nil)
 	for _, field := range AllModelFields {
-		if got[field] != "openrouter/deepseek/deepseek-v4-flash" {
+		if got[field] != "openrouter/deepseek/deepseek-v4-flash-0731" {
 			t.Errorf("field %s = %q, want deepseek base", field, got[field])
 		}
 	}
@@ -132,7 +132,7 @@ func TestResolveRuntimeModels_OpenRouterAutoDefaults(t *testing.T) {
 	t.Setenv("OPENROUTER_API_KEY", "sk-or")
 	got := mustResolve(t, "open_code", nil)
 	for _, field := range AllModelFields {
-		if got[field] != "openrouter/deepseek/deepseek-v4-flash" {
+		if got[field] != "openrouter/deepseek/deepseek-v4-flash-0731" {
 			t.Errorf("field %s = %q, want deepseek auto", field, got[field])
 		}
 	}
@@ -148,7 +148,7 @@ func TestResolveRuntimeModels_ExplicitOpenCodeSameDefault(t *testing.T) {
 	t.Setenv("SWE_DEFAULT_RUNTIME", "open_code")
 	got := mustResolve(t, "open_code", nil)
 	for _, field := range AllModelFields {
-		if got[field] != "openrouter/deepseek/deepseek-v4-flash" {
+		if got[field] != "openrouter/deepseek/deepseek-v4-flash-0731" {
 			t.Errorf("field %s = %q, want deepseek (explicit)", field, got[field])
 		}
 	}
@@ -223,7 +223,7 @@ func TestResolveRuntimeModels_EmptyEnvTreatedAsUnset(t *testing.T) {
 	t.Setenv("HARNESS_MODEL", "   ")
 	got := mustResolve(t, "open_code", nil)
 	for _, field := range AllModelFields {
-		if got[field] != "openrouter/deepseek/deepseek-v4-flash" {
+		if got[field] != "openrouter/deepseek/deepseek-v4-flash-0731" {
 			t.Errorf("empty env -> base: field %s = %q", field, got[field])
 		}
 	}
@@ -361,7 +361,7 @@ func TestBuildConfig_OpenCodeProvider(t *testing.T) {
 	if err != nil {
 		t.Fatal(err)
 	}
-	if resolved["coder_model"] != "openrouter/deepseek/deepseek-v4-flash" {
+	if resolved["coder_model"] != "openrouter/deepseek/deepseek-v4-flash-0731" {
 		t.Errorf("coder_model = %q", resolved["coder_model"])
 	}
 }
@@ -377,7 +377,7 @@ func TestBuildConfig_AutoOpenRouterEndToEnd(t *testing.T) {
 	if err != nil {
 		t.Fatal(err)
 	}
-	if resolved["coder_model"] != "openrouter/deepseek/deepseek-v4-flash" {
+	if resolved["coder_model"] != "openrouter/deepseek/deepseek-v4-flash-0731" {
 		t.Errorf("coder_model = %q", resolved["coder_model"])
 	}
 }
@@ -576,7 +576,7 @@ func TestBuildConfig_ToExecutionConfigDictRoundtrip(t *testing.T) {
 	if execCfg.CoderModel() != "deepseek/deepseek-chat" {
 		t.Errorf("exec coder_model = %q", execCfg.CoderModel())
 	}
-	if execCfg.QAModel() != "openrouter/deepseek/deepseek-v4-flash" {
+	if execCfg.QAModel() != "openrouter/deepseek/deepseek-v4-flash-0731" {
 		t.Errorf("exec qa_model = %q", execCfg.QAModel())
 	}
 	if execCfg.MaxRetriesPerIssue != 2 {
@@ -648,7 +648,7 @@ func TestExecutionConfig_CIFixerRole(t *testing.T) {
 	if mustLoadExec(t, map[string]any{"runtime": "claude_code"}).CIFixerModel() != "sonnet" {
 		t.Error("ci_fixer default claude")
 	}
-	if mustLoadExec(t, map[string]any{"runtime": "open_code"}).CIFixerModel() != "openrouter/deepseek/deepseek-v4-flash" {
+	if mustLoadExec(t, map[string]any{"runtime": "open_code"}).CIFixerModel() != "openrouter/deepseek/deepseek-v4-flash-0731" {
 		t.Error("ci_fixer default opencode")
 	}
 	cfg := mustLoadExec(t, map[string]any{"runtime": "claude_code", "models": map[string]any{"ci_fixer": "opus"}})
@@ -767,7 +767,7 @@ func TestFastResolveModels(t *testing.T) {
 		cfg, _ := LoadFastBuildConfig(map[string]any{"runtime": "open_code"})
 		got, _ := FastResolveModels(cfg)
 		for _, role := range fastRoles {
-			if got[role] != "openrouter/deepseek/deepseek-v4-flash" {
+			if got[role] != "openrouter/deepseek/deepseek-v4-flash-0731" {
 				t.Errorf("%s = %q, want the shared open_code default", role, got[role])
 			}
 		}
```

---

### Incident Patch 14: `7a8dba03` (2026-08-01)
**Commit Message**: fix(go): direct role calls default to the configured runtime, not claude/sonnet (#120)

Direct reasoner calls hard-coded ai_provider=claude and model=sonnet,
so on an OpenRouter-only deployment (the common cloud setup) every
direct role call tried the claude harness and failed instantly - even
though config.DefaultRuntime() already auto-selects open_code there and
the orchestrators already resolve properly. Resolve absent runtime and
model inputs at call time through the existing config cascade
(SWE_DEFAULT_RUNTIME, tier env vars, OpenRouter auto-default); explicit
input values are untouched. Adds config.DefaultRoleModel backed by
ResolveRuntimeModels/RoleToTier so coding and gitops roles pick their
tier-correct model.

Verified live on a Railway control plane where run_product_manager
failed in 500ms with the old defaults and succeeded via opencode with
provider overrides.

Co-authored-by: Claude Fable 5 <[REDACTED_EMAIL]>

**File**: `go/internal/config/resolve.go` (modified, +15/-0)
```diff
@@ -274,6 +274,21 @@ func DefaultPlanningModel() string {
 	return "sonnet"
 }
 
+// DefaultRoleModel resolves the configured call-time default for one role.
+// It uses the same runtime base, environment cascade, and tier precedence as
+// ResolveRuntimeModels, without introducing a separate direct-call policy.
+func DefaultRoleModel(role string) (string, error) {
+	field, ok := RoleToModelField[role]
+	if !ok {
+		return "", fmt.Errorf("unknown role %s", pyRepr(role))
+	}
+	resolved, err := ResolveRuntimeModels(DefaultRuntime(), nil, []string{field})
+	if err != nil {
+		return "", err
+	}
+	return resolved[field], nil
+}
+
 // ---------------------------------------------------------------------------
 // Flat-model validation + resolution
 // ---------------------------------------------------------------------------
```

**File**: `go/internal/roles/coding/coding.go` (modified, +39/-18)
```diff
@@ -9,9 +9,8 @@
 // so the wiring task (T6.2) can register it under the exact Python reasoner name
 // via Handlers(). The handlers mirror the Python functions 1:1:
 //
-//   - inputs are bound from the untyped map with the SAME parameter names and
-//     defaults as the Python function signatures (model="sonnet"/"haiku",
-//     ai_provider="claude", iteration=1, qa_ran=false, …);
+//   - inputs are bound from the untyped map with the same parameter names as
+//     Python; absent runtime/model values resolve from config at call time;
 //   - run_coder/run_qa/run_code_reviewer call the structured-output harness via
 //     harnessx.Run; run_qa_synthesizer uses the direct-LLM path (Deps.AI), the
 //     Go equivalent of Python's router.ai (NOT the coding harness);
@@ -112,12 +111,13 @@ type coderInput struct {
 	TargetRepo        string         `json:"target_repo"`
 }
 
-// UnmarshalJSON seeds the Python parameter defaults (iteration=1, model="sonnet",
-// ai_provider="claude") so keys absent from the input map keep those defaults.
 func (c *coderInput) UnmarshalJSON(b []byte) error {
-	*c = coderInput{Iteration: 1, Model: "sonnet", AIProvider: "claude"}
+	*c = coderInput{Iteration: 1}
 	type alias coderInput
-	return jsonUnmarshal(b, (*alias)(c))
+	if err := jsonUnmarshal(b, (*alias)(c)); err != nil {
+		return err
+	}
+	return resolveRoleDefaults(&c.AIProvider, &c.Model, "coder")
 }
 
 // RunCoder ports run_coder (execution_agents.py:963). Implements an issue and
@@ -216,12 +216,14 @@ type qaInput struct {
 	TargetRepo        string         `json:"target_repo"`
 }
 
-// UnmarshalJSON seeds the Python parameter defaults (model="sonnet",
-// ai_provider="claude").
+// UnmarshalJSON applies configured runtime/model defaults at call time.
 func (q *qaInput) UnmarshalJSON(b []byte) error {
-	*q = qaInput{Model: "sonnet", AIProvider: "claude"}
+	*q = qaInput{}
 	type alias qaInput
-	return jsonUnmarshal(b, (*alias)(q))
+	if err := jsonUnmarshal(b, (*alias)(q)); err != nil {
+		return err
+	}
+	return resolveRoleDefaults(&q.AIProvider, &q.Model, "qa")
 }
 
 // RunQA ports run_qa (execution_agents.py:1060). Reviews/augments tests and runs
@@ -304,11 +306,14 @@ type codeReviewerInput struct {
 }
 
 // UnmarshalJSON seeds the Python parameter defaults (qa_ran=false is the Go zero
-// value; model="sonnet", ai_provider="claude").
+// value; runtime/model defaults are resolved at call time).
 func (c *codeReviewerInput) UnmarshalJSON(b []byte) error {
-	*c = codeReviewerInput{Model: "sonnet", AIProvider: "claude"}
+	*c = codeReviewerInput{}
 	type alias codeReviewerInput
-	return jsonUnmarshal(b, (*alias)(c))
+	if err := jsonUnmarshal(b, (*alias)(c)); err != nil {
+		return err
+	}
+	return resolveRoleDefaults(&c.AIProvider, &c.Model, "code_reviewer")
 }
 
 // RunCodeReviewer ports run_code_reviewer (execution_agents.py:1134). Reviews
@@ -393,12 +398,28 @@ type qaSynthInput struct {
 	TargetRepo        string           `json:"target_repo"`
 }
 
-// UnmarshalJSON seeds the Python parameter defaults (model="haiku",
-// ai_provider="claude").
+// UnmarshalJSON applies configured runtime/model defaults at call time.
 func (q *qaSynthInput) UnmarshalJSON(b []byte) error {
-	*q = qaSynthInput{Model: "haiku", AIProvider: "claude"}
+	*q = qaSynthInput{}
 	type alias qaSynthInput
-	return jsonUnmarshal(b, (*alias)(q))
+	if err := jsonUnmarshal(b, (*alias)(q)); err != nil {
+		return err
+	}
+	return resolveRoleDefaults(&q.AIProvider, &q.Model, "qa_synthesizer")
+}
+
+func resolveRoleDefaults(aiProvider, model *string, role string) error {
+	if *aiProvider == "" {
+		*aiProvider = config.DefaultRuntime()
+	}
+	if *model == "" {
+		resolved, err := config.DefaultRoleModel(role)
+		if err != nil {
+			return err
+		}
+		*model = resolved
+	}
+	return nil
 }
 
 // RunQASynthesizer ports run_qa_synthesizer (execution_agents.py:1216). Merges
```

**File**: `go/internal/roles/coding/coding_test.go` (modified, +42/-2)
```diff
@@ -167,6 +167,43 @@ func TestRunCoderSuccessKeySetAndIterationID(t *testing.T) {
 	}
 }
 
+func TestRunCoderDirectCallRuntimeDefaults(t *testing.T) {
+	for _, key := range []string{"ANTHROPIC_API_KEY", "OPENROUTER_API_KEY", "SWE_DEFAULT_RUNTIME", "SWE_MODEL_MED", "SWE_DEFAULT_MODEL", "AI_MODEL", "HARNESS_MODEL"} {
+		t.Setenv(key, "")
+	}
+	t.Setenv("OPENROUTER_API_KEY", "test-key")
+
+	mh := &mockHarness{fn: func(dest any) (*harness.Result, error) {
+		return &harness.Result{Parsed: dest}, nil
+	}}
+	if _, err := RunCoder(context.Background(), newDeps(mh, nil, &noteRecorder{}), map[string]any{
+		"issue": map[string]any{"name": "direct"}, "worktree_path": "/wt",
+	}); err != nil {
+		t.Fatalf("RunCoder: %v", err)
+	}
+	if mh.gotOpts.Provider != "opencode" || mh.gotOpts.Model != "openrouter/deepseek/deepseek-v4-flash" {
+		t.Fatalf("defaults = provider %q, model %q", mh.gotOpts.Provider, mh.gotOpts.Model)
+	}
+}
+
+func TestRunCoderExplicitRuntimeValuesUntouched(t *testing.T) {
+	t.Setenv("OPENROUTER_API_KEY", "test-key")
+	t.Setenv("ANTHROPIC_API_KEY", "")
+	t.Setenv("SWE_DEFAULT_RUNTIME", "")
+	mh := &mockHarness{fn: func(dest any) (*harness.Result, error) {
+		return &harness.Result{Parsed: dest}, nil
+	}}
+	if _, err := RunCoder(context.Background(), newDeps(mh, nil, &noteRecorder{}), map[string]any{
+		"issue": map[string]any{"name": "explicit"}, "worktree_path": "/wt",
+		"ai_provider": "claude", "model": "sonnet",
+	}); err != nil {
+		t.Fatalf("RunCoder: %v", err)
+	}
+	if mh.gotOpts.Provider != "claude-code" || mh.gotOpts.Model != "sonnet" {
+		t.Fatalf("explicit = provider %q, model %q", mh.gotOpts.Provider, mh.gotOpts.Model)
+	}
+}
+
 // Contract: coder applies the web-search guardrail to its system prompt (via
 // tools.MaybeApplyCoderGuardrail) and runs with cwd = worktree.
 func TestRunCoderAppliesGuardrailAndCwd(t *testing.T) {
@@ -576,13 +613,16 @@ func TestHandlersRegistrationNames(t *testing.T) {
 	}
 }
 
-// Contract: input binding applies the Python default model per role.
+// Contract: input binding applies the configured call-time defaults per role.
 func TestInputDefaults(t *testing.T) {
+	for _, key := range []string{"ANTHROPIC_API_KEY", "OPENROUTER_API_KEY", "SWE_DEFAULT_RUNTIME", "SWE_MODEL_LOW", "SWE_MODEL_MED", "SWE_DEFAULT_MODEL", "AI_MODEL", "HARNESS_MODEL"} {
+		t.Setenv(key, "")
+	}
 	ci, err := bindInput[coderInput](map[string]any{})
 	if err != nil {
 		t.Fatal(err)
 	}
-	if ci.Model != "sonnet" || ci.AIProvider != "claude" || ci.Iteration != 1 {
+	if ci.Model != "sonnet" || ci.AIProvider != "claude_code" || ci.Iteration != 1 {
 		t.Fatalf("coder defaults wrong: %+v", ci)
 	}
 	si, err := bindInput[qaSynthInput](map[string]any{})
```

**File**: `go/internal/roles/gitops/finalize.go` (modified, +10/-2)
```diff
@@ -40,7 +40,11 @@ func RunRepoFinalize(ctx context.Context, deps *Deps, input map[string]any) (any
 	if err != nil {
 		return nil, err
 	}
-	opts := roleOptions(provider, orDefault(in.Model, "sonnet"), gitprompts.RepoFinalizeSystemPrompt, in.RepoPath,
+	model, err := resolveModel(in.Model, "git")
+	if err != nil {
+		return nil, err
+	}
+	opts := roleOptions(provider, model, gitprompts.RepoFinalizeSystemPrompt, in.RepoPath,
 		[]string{"Bash", "Read", "Write", "Glob", "Grep"}, in.PermissionMode)
 
 	val, ok, err := runRole[schemas.RepoFinalizeResult](ctx, deps, taskPrompt, opts, "repo_finalize", "Repo finalize agent failed")
@@ -104,7 +108,11 @@ func RunGitHubPR(ctx context.Context, deps *Deps, input map[string]any) (any, er
 	if err != nil {
 		return nil, err
 	}
-	opts := roleOptions(provider, orDefault(in.Model, "sonnet"), gitprompts.GitHubPRSystemPrompt, in.RepoPath,
+	model, err := resolveModel(in.Model, "git")
+	if err != nil {
+		return nil, err
+	}
+	opts := roleOptions(provider, model, gitprompts.GitHubPRSystemPrompt, in.RepoPath,
 		[]string{"Bash", "Write"}, in.PermissionMode)
 
 	val, ok, err := runRole[schemas.GitHubPRResult](ctx, deps, taskPrompt, opts, "github_pr", "GitHub PR agent failed")
```

**File**: `go/internal/roles/gitops/gitops.go` (modified, +13/-11)
```diff
@@ -14,11 +14,9 @@
 // propagates *fatal.FatalHarnessError, and on a harness parse failure returns
 // the role's deterministic fallback (never an error).
 //
-// Model resolution is input-driven exactly as in Python: the reasoner reads the
-// model from its input (default "sonnet"). The caller (dag_executor) resolves
-// the per-role model — git_model for run_git_init, merger_model for run_merger,
-// integration_tester_model for run_integration_tester — and passes it in; the
-// reasoner does not re-resolve it here.
+// Explicit runtime/model inputs remain input-driven. Direct calls that omit
+// either value resolve the configured defaults at call time; orchestrators
+// already pass resolved values and therefore retain their existing behavior.
 package gitops
 
 import (
@@ -84,25 +82,29 @@ func Handlers() map[string]Handler {
 // Shared helpers (Python-parity string/number formatting + role plumbing)
 // ---------------------------------------------------------------------------
 
-// orDefault returns def when s is empty, else s. Reproduces a Python keyword
-// default: run_git_init(model="sonnet", ...) uses "sonnet" when the caller
-// omits model. Bind maps an absent key to "" (the Go zero), so "" == "use
-// default". Callers in practice always pass a resolved non-empty model.
+// orDefault returns def when s is empty, else s.
 func orDefault(s, def string) string {
 	if s == "" {
 		return def
 	}
 	return s
 }
 
-// resolveProvider maps the input ai_provider (default "claude") to the harness
+// resolveProvider maps the input ai_provider to the harness
 // adapter string, mirroring Python's
 // provider = runtime_to_harness_adapter(ai_provider). The adapter — not the
 // provider — is what the harness Options.Provider field expects (design §4.7).
 // An unsupported value returns the normalize error, matching Python raising
 // before the harness call.
 func resolveProvider(aiProvider string) (string, error) {
-	return runtimex.RuntimeToHarnessAdapter(orDefault(aiProvider, "claude"))
+	return runtimex.RuntimeToHarnessAdapter(orDefault(aiProvider, config.DefaultRuntime()))
+}
+
+func resolveModel(model, role string) (string, error) {
+	if model != "" {
+		return model, nil
+	}
+	return config.DefaultRoleModel(role)
 }
 
 // roleOptions builds the harness.Options for a role from its resolved
```

**File**: `go/internal/roles/gitops/merge.go` (modified, +10/-2)
```diff
@@ -57,7 +57,11 @@ func RunMerger(ctx context.Context, deps *Deps, input map[string]any) (any, erro
 	if err != nil {
 		return nil, err
 	}
-	opts := roleOptions(provider, orDefault(in.Model, "sonnet"), gitprompts.MergerSystemPrompt, in.RepoPath,
+	model, err := resolveModel(in.Model, "merger")
+	if err != nil {
+		return nil, err
+	}
+	opts := roleOptions(provider, model, gitprompts.MergerSystemPrompt, in.RepoPath,
 		[]string{"Bash", "Read", "Write", "Glob", "Grep"}, in.PermissionMode)
 
 	val, ok, err := runRole[schemas.MergeResult](ctx, deps, taskPrompt, opts, "merger", "Merger agent failed")
@@ -128,7 +132,11 @@ func RunIntegrationTester(ctx context.Context, deps *Deps, input map[string]any)
 	if err != nil {
 		return nil, err
 	}
-	opts := roleOptions(provider, orDefault(in.Model, "sonnet"), gitprompts.IntegrationTesterSystemPrompt, in.RepoPath,
+	model, err := resolveModel(in.Model, "integration_tester")
+	if err != nil {
+		return nil, err
+	}
+	opts := roleOptions(provider, model, gitprompts.IntegrationTesterSystemPrompt, in.RepoPath,
 		[]string{"Bash", "Read", "Write", "Glob", "Grep"}, in.PermissionMode)
 
 	val, ok, err := runRole[schemas.IntegrationTestResult](ctx, deps, taskPrompt, opts, "integration_tester", "Integration tester agent failed")
```

**File**: `go/internal/roles/gitops/workspace.go` (modified, +15/-3)
```diff
@@ -61,7 +61,11 @@ func RunGitInit(ctx context.Context, deps *Deps, input map[string]any) (any, err
 	if err != nil {
 		return nil, err
 	}
-	opts := roleOptions(provider, orDefault(in.Model, "sonnet"), systemPrompt, in.RepoPath,
+	model, err := resolveModel(in.Model, "git")
+	if err != nil {
+		return nil, err
+	}
+	opts := roleOptions(provider, model, systemPrompt, in.RepoPath,
 		[]string{"Bash", "Write"}, in.PermissionMode)
 
 	val, ok, err := runRole[schemas.GitInitResult](ctx, deps, taskPrompt, opts, "git_init", "Git init agent failed")
@@ -139,7 +143,11 @@ func RunWorkspaceSetup(ctx context.Context, deps *Deps, input map[string]any) (a
 	if err != nil {
 		return nil, err
 	}
-	opts := roleOptions(provider, orDefault(in.Model, "sonnet"), gitprompts.SetupSystemPrompt, in.RepoPath,
+	model, err := resolveModel(in.Model, "git")
+	if err != nil {
+		return nil, err
+	}
+	opts := roleOptions(provider, model, gitprompts.SetupSystemPrompt, in.RepoPath,
 		[]string{"Bash", "Write"}, in.PermissionMode)
 
 	val, ok, err := runRole[workspaceSetupResult](ctx, deps, taskPrompt, opts, "workspace_setup", "Workspace setup agent failed")
@@ -200,7 +208,11 @@ func RunWorkspaceCleanup(ctx context.Context, deps *Deps, input map[string]any)
 	if err != nil {
 		return nil, err
 	}
-	opts := roleOptions(provider, orDefault(in.Model, "sonnet"), gitprompts.CleanupSystemPrompt, in.RepoPath,
+	model, err := resolveModel(in.Model, "git")
+	if err != nil {
+		return nil, err
+	}
+	opts := roleOptions(provider, model, gitprompts.CleanupSystemPrompt, in.RepoPath,
 		[]string{"Bash", "Write"}, in.PermissionMode)
 
 	val, ok, err := runRole[workspaceCleanupResult](ctx, deps, taskPrompt, opts, "workspace_cleanup", "Workspace cleanup agent failed")
```

**File**: `go/internal/roles/planning/planning.go` (modified, +17/-10)
```diff
@@ -85,10 +85,10 @@ func RunProductManager(ctx context.Context, deps *Deps, input map[string]any) (a
 	repoPath := getString(input, "repo_path", "")
 	artifactsDir := getString(input, "artifacts_dir", ".artifacts")
 	additionalContext := getString(input, "additional_context", "")
-	model := getString(input, "model", "sonnet")
+	model := orResolvedDefault(getString(input, "model", ""), config.DefaultPlanningModel())
 	maxTurns := getInt(input, "max_turns", config.DefaultAgentMaxTurns)
 	permissionMode := getString(input, "permission_mode", "")
-	aiProvider := getString(input, "ai_provider", "claude")
+	aiProvider := orResolvedDefault(getString(input, "ai_provider", ""), config.DefaultRuntime())
 	initialPrior := getPriorResponses(input)
 
 	_, paths, err := ensurePaths(repoPath, artifactsDir)
@@ -183,10 +183,10 @@ func RunEnvironmentScout(ctx context.Context, deps *Deps, input map[string]any)
 	prd := getMap(input, "prd")
 	repoPath := getString(input, "repo_path", "")
 	artifactsDir := getString(input, "artifacts_dir", ".artifacts")
-	model := getString(input, "model", "sonnet")
+	model := orResolvedDefault(getString(input, "model", ""), config.DefaultPlanningModel())
 	maxTurns := getInt(input, "max_turns", config.DefaultAgentMaxTurns)
 	permissionMode := getString(input, "permission_mode", "")
-	aiProvider := getString(input, "ai_provider", "claude")
+	aiProvider := orResolvedDefault(getString(input, "ai_provider", ""), config.DefaultRuntime())
 	initialPrior := getPriorResponses(input)
 
 	// Ensure the artifact dirs exist; the scout writes no artifacts of its own.
@@ -302,10 +302,10 @@ func RunArchitect(ctx context.Context, deps *Deps, input map[string]any) (any, e
 	repoPath := getString(input, "repo_path", "")
 	artifactsDir := getString(input, "artifacts_dir", ".artifacts")
 	feedback := getString(input, "feedback", "")
-	model := getString(input, "model", "sonnet")
+	model := orResolvedDefault(getString(input, "model", ""), config.DefaultPlanningModel())
 	maxTurns := getInt(input, "max_turns", config.DefaultAgentMaxTurns)
 	permissionMode := getString(input, "permission_mode", "")
-	aiProvider := getString(input, "ai_provider", "claude")
+	aiProvider := orResolvedDefault(getString(input, "ai_provider", ""), config.DefaultRuntime())
 
 	_, paths, err := ensurePaths(repoPath, artifactsDir)
 	if err != nil {
@@ -374,10 +374,10 @@ func RunTechLead(ctx context.Context, deps *Deps, input map[string]any) (any, er
 	repoPath := getString(input, "repo_path", "")
 	artifactsDir := getString(input, "artifacts_dir", ".artifacts")
 	revisionNumber := getInt(input, "revision_number", 0)
-	model := getString(input, "model", "sonnet")
+	model := orResolvedDefault(getString(input, "model", ""), config.DefaultPlanningModel())
 	maxTurns := getInt(input, "max_turns", config.DefaultAgentMaxTurns)
 	permissionMode := getString(input, "permission_mode", "")
-	aiProvider := getString(input, "ai_provider", "claude")
+	aiProvider := orResolvedDefault(getString(input, "ai_provider", ""), config.DefaultRuntime())
 
 	base, paths, err := ensurePaths(repoPath, artifactsDir)
 	if err != nil {
@@ -460,10 +460,10 @@ func RunSprintPlanner(ctx context.Context, deps *Deps, input map[string]any) (an
 
 	repoPath := getString(input, "repo_path", "")
 	artifactsDir := getString(input, "artifacts_dir", ".artifacts")
-	model := getString(input, "model", "sonnet")
+	model := orResolvedDefault(getString(input, "model", ""), config.DefaultPlanningModel())
 	maxTurns := getInt(input, "max_turns", config.DefaultAgentMaxTurns)
 	permissionMode := getString(input, "permission_mode", "")
-	aiProvider := getString(input, "ai_provider", "claude")
+	aiProvider := orResolvedDefault(getString(input, "ai_provider", ""), config.DefaultRuntime())
 
 	_, paths, err := ensurePaths(repoPath, artifactsDir)
 	if err != nil {
@@ -639,6 +639,13 @@ func getString(input map[string]any, key, def string) string {
 	return def
 }
 
+func orResolvedDefault(value, def string) string {
+	if value == "" {
+		return def
+	}
+	return value
+}
+
 // getInt returns input[key] as an int when present, else def. Tolerates the
 // float64 that JSON numbers decode to.
 func getInt(input map[string]any, key string, def int) int {
```

---

### Incident Patch 15: `0235d112` (2026-07-23)
**Commit Message**: fix(go): bump AgentField Go SDK past the codex --output-schema fix (#111)

* fix(go): bump AgentField Go SDK past the codex --output-schema fix

The pinned SDK (054a7d18, v0.1.113) predates agentfield#818, which makes
the codex harness provider survive OpenAI's strict schema validator:
gate inexpressible schemas off --output-schema and retry once without it
when the API rejects the schema with a 400. Without it, every codex role
invocation on a schema the validator refuses dies in seconds and
surfaces as a generic parse-failure fallback (e.g. "Product manager
failed to produce a valid PRD").

Bump the pseudo-version to agentfield main 20955b26 and keep the
Dockerfile / CI AGENTFIELD_SDK_REF mirrors in sync, per the go.mod
comment ("Bump both together").

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>

* fix(go): case-normalize the QA-synthesizer action before the enum check

The synthesizer system prompt names the actions in uppercase
(FIX/APPROVE/BLOCK) while parseSynthesis compares against the lowercase
enum constants, and the reflected request schema carries no enum to
force the model's casing. Models therefore routinely answer
"APPROVE" and every real synthesis was discarded

**File**: `.github/workflows/ci.yml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ jobs:
     runs-on: ubuntu-latest
     env:
       # Reproduce go/Dockerfile's sparse SDK clone; keep in sync with its AGENTFIELD_SDK_REF.
-      AGENTFIELD_SDK_REF: 054a7d18b4bfbd6b48f8582a337894c3c5975d36
+      AGENTFIELD_SDK_REF: 20955b2637b4708758c328a4f64fe460c7d4b772
       AGENTFIELD_REPO: https://github.com/Agent-Field/agentfield.git
       GOWORK: off
     steps:
```

**File**: `go/Dockerfile` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ FROM golang:1.23-bookworm AS builder
 
 # Pinned AgentField SDK ref. Default = agentfield origin/main HEAD at port time
 # (v0.1.107-rc.1). Changing this string invalidates the clone layer below.
-ARG AGENTFIELD_SDK_REF=054a7d18b4bfbd6b48f8582a337894c3c5975d36
+ARG AGENTFIELD_SDK_REF=20955b2637b4708758c328a4f64fe460c7d4b772
 ARG AGENTFIELD_REPO=https://github.com/Agent-Field/agentfield.git
 
 WORKDIR /src
```

**File**: `go/go.mod` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ module github.com/Agent-Field/SWE-AF/go
 go 1.21
 
 require (
-	github.com/Agent-Field/agentfield/sdk/go v0.0.0-20260721154150-054a7d18b4bf
+	github.com/Agent-Field/agentfield/sdk/go v0.0.0-20260723130821-20955b2637b4
 	github.com/invopop/jsonschema v0.13.0
 	golang.org/x/sync v0.11.0
 )
```

**File**: `go/go.sum` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
-github.com/Agent-Field/agentfield/sdk/go v0.0.0-20260721154150-054a7d18b4bf h1:wTYUlaz81NirvBpFC7tdXeCpHCWcmaKQZFAqamNZTJw=
-github.com/Agent-Field/agentfield/sdk/go v0.0.0-20260721154150-054a7d18b4bf/go.mod h1:08VZk14uw4GJH6a34psHkuLu+DcRr197Zi0IGmLlfrM=
+github.com/Agent-Field/agentfield/sdk/go v0.0.0-20260723130821-20955b2637b4 h1:OwOEyxRfYD0n2LAmaJIJdfejWpIYgRAf9oq/YA4qfVk=
+github.com/Agent-Field/agentfield/sdk/go v0.0.0-20260723130821-20955b2637b4/go.mod h1:08VZk14uw4GJH6a34psHkuLu+DcRr197Zi0IGmLlfrM=
 github.com/bahlo/generic-list-go v0.2.0 h1:5sz/EEAK+ls5wF+NeqDpk5+iNdMDXrh3z3nPnH1Wvgk=
 github.com/bahlo/generic-list-go v0.2.0/go.mod h1:2KvAjgMlE5NNynlg/5iLrrCCZ2+5xWbdbCW3pNTGyYg=
 github.com/buger/jsonparser v1.1.1 h1:2PnMjfWD7wBILjqQbt530v576A/cAbQvEW9gGIpYMUs=
```

**File**: `go/internal/roles/coding/coding.go` (modified, +4/-0)
```diff
@@ -514,6 +514,10 @@ func parseSynthesis(resp *ai.Response) (*schemas.QASynthesisResult, bool) {
 	if err := resp.JSON(&out); err != nil {
 		return nil, false
 	}
+	// The system prompt names the actions in uppercase (FIX/APPROVE/BLOCK) and
+	// the reflected request schema carries no enum, so models routinely answer
+	// in uppercase. Normalize before the enum check.
+	out.Action = schemas.QASynthesisAction(strings.ToLower(strings.TrimSpace(string(out.Action))))
 	switch out.Action {
 	case schemas.QASynthesisActionFix, schemas.QASynthesisActionApprove, schemas.QASynthesisActionBlock:
 		return &out, true
```

**File**: `go/internal/roles/coding/coding_test.go` (modified, +30/-0)
```diff
@@ -593,3 +593,33 @@ func TestInputDefaults(t *testing.T) {
 		t.Fatalf("qa_synthesizer default model must be haiku, got %q", si.Model)
 	}
 }
+
+// Contract: models routinely answer the action in uppercase (the system prompt
+// names FIX/APPROVE/BLOCK and the reflected request schema carries no enum), so
+// parseSynthesis must case-normalize instead of dropping the synthesis and
+// triggering the deterministic fallback.
+func TestRunQASynthesizerNormalizesUppercaseAction(t *testing.T) {
+	nr := &noteRecorder{}
+	mai := &mockAI{resp: aiJSONResponse(`{"action":"APPROVE","summary":"env failures are pre-existing","stuck":false}`)}
+	mh := &mockHarness{fn: func(_ any) (*harness.Result, error) {
+		t.Fatal("run_qa_synthesizer must not call the harness")
+		return nil, nil
+	}}
+
+	out, err := RunQASynthesizer(context.Background(), newDeps(mh, mai, nr), map[string]any{
+		"qa_result":         map[string]any{"passed": false},
+		"review_result":     map[string]any{"approved": true},
+		"iteration_history": []any{},
+		"iteration_id":      "s2",
+	})
+	if err != nil {
+		t.Fatalf("unexpected error: %v", err)
+	}
+	m := asMap(t, out)
+	if m["action"] != "approve" {
+		t.Fatalf("expected normalized action \"approve\", got %v", m["action"])
+	}
+	if m["summary"] != "env failures are pre-existing" {
+		t.Fatalf("model synthesis was discarded for the fallback: %v", m)
+	}
+}
```

#### Recent Merged Pull Requests:
- **PR #151** (2026-09-21): fix(planning): a stalled architect revision no longer discards the whole plan (@AbirAbbas)
- **PR #150** (2026-09-21): fix(swe-fast): clone the repo before git_init so PR creation stops being skipped (@AbirAbbas)
- **PR #148** (2026-09-24): fix(planning): retry schema-invalid responses across planning stages and retain raw output (@ddbaron)
- **PR #144** (2026-09-24): fix(runtime): heartbeat while harness child is active (@ddbaron)
- **PR #142** (2026-08-23): fix: Docker deploys run the promised OpenRouter default (HARNESS_MODEL scoped to open_code) (@AbirAbbas)
- **PR #141** (2026-09-09): fix(qa-synthesizer): read the schema router.ai() actually returns (@hdimer)
- **PR #140** (2026-08-22): docs: update Railway deploy link to agentfield-engineering-team template (@AbirAbbas)
- **PR #139** (2026-08-21): fix: with SWE_PRO_ENGINE on, expose only the pro surface (hide opencode-driven planner) (@AbirAbbas)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
