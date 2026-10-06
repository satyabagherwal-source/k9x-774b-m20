# Forensic Learning Record (Deep Inspection): NVIDIA/NemoClaw

> **Canonical Artifact**: `07_PROJECT_LEARNING/nvidia-nemoclaw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NVIDIA/NemoClaw](https://github.com/NVIDIA/NemoClaw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:55:14.125Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA/NemoClaw`
- **Description**: Run agents like Hermes, LangChain Deep Agents, and OpenClaw more securely inside NVIDIA OpenShell with managed inference
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 22662 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/nemoclaw-maintainer-cross-issue-sweep/scripts/render-report.py`
```
#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
"""Render the cross-issue sweep report from a list of classified candidates.

Reads a JSON spec on stdin describing the sweep, emits markdown matching
templates/report.md.

Spec shape:
  {
    "pr": 2851,
    "pr_title": "...",
    "classifications": [
      {
        "issue_number": 4521,
        "issue_title": "...",
        "class": "ADJACENT_FIX",
        "confidence": "high",
        "reverse_link_boosted": true,
        "evidence": {
          "pr_diff_line": "src/lib/validate.ts:42",
          "issue_symptom": "issue body line 12",
          "reasoning": "..."
        }
      },
      ...
    ],
    "primary_issue": 2681,
    "suppressed": {"unrelated": 7, "same_issue_diff": 2}
  }

Usage:
  scripts/render-report.py < spec.json > report.md
"""

from __future__ import annotations

import json
import sys
from typing import Any


CONFIDENCE_RANK = {"low": 0, "medium": 1, "high": 2}


def _format_entry(c: dict[str, Any]) -> str:
    """Render one classification line with evidence summary."""
    boost_marker = " [boosted from reverse-link]" if c.get("reverse_link_boosted") else ""
    evidence = c.get("evidence") or {}
    if not isinstance(evidence, dict):
        evidence = {}
    diff_line = evidence.get("pr_diff_line", "?")
    symptom = evidence.get("issue_symptom", "?")
    issue_number = c.get("issue_number", "?")
    confidence = c.get("confidence", "low")
    return (
        f"- **#{issue_number}** ({confidence}{boost_marker}) "
        f"— {diff_line} matches {symptom}\n"
        f"  → {evidence.get('reasoning', '')}"
    )


def _is_valid_classification(c: Any) -> bool:
    """Skip null entries and entries missing the keys downstream code reads."""
    return isinstance(c, dict) and "issue_number" in c and "class" in c


def main() -> int:
    try:
        spec = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON spec on stdin: {e}", file=sys.stderr)
        return 64

    if not isinstance(spec, dict):
        print("Invalid spec: root must be a JSON object", file=sys.stderr)
        return 64
    if "pr" not in spec:
        print("Invalid spec: missing required field 'pr'", file=sys.stderr)
        return 64

    pr = spec["pr"]
    pr_title = spec.get("pr_title", "")
    classifications = spec.get("classifications", [])
    if not isinstance(classifications, list):
        print("Invalid spec: 'classifications' must be a list", file=sys.stderr)
        return 64
    suppressed = spec.get("suppressed", {})
    if not isinstance(suppressed, dict):
        print("Invalid spec: 'suppressed' must be a JSON object", file=sys.stderr)
        return 64

    valid = [c for c in classifications if _is_valid_classification(c)]
    adjacent = sorted(
        [c for c in valid if c.get("class") == "ADJACENT_FIX"],
        key=lambda c: -CONFIDENCE_RANK.get(c.get("confidence", "low"), 0),
    )
    contradicting = sorted(
        [c for c in valid if c.get("class") == "CONTRADICTING"],
        key=lambda c: -CONFIDENCE_RANK.get(c.get("confidence", "low"), 0),
    )

    print(f"## Cross-issue scan — PR #{pr}" + (f" ({pr_title})" if pr_title else ""))
    print()

    if not adjacent and not contradicting:
        print("No adjacent fixes or contradictions found above the medium confidence floor.")
        print()
        unrelated = suppressed.get("unrelated", 0)
        same_issue = suppressed.get("same_issue_diff", 0)
        print(f"Suppressed: {unrelated} unrelated, {same_issue} same-issue duplicates.")
        return 0

    if adjacent:
        print("### Adjacent fixes (PR may also close)")
        print()
        for c in adjacent:
            print(_format_entry(c))
        print()

    if contradicting:
        print("### Contradicting (coordinate before merge)")
        print()
        for c in contradicting:
            print(_format_entry(c))
        print()

    print("### Suppressed")
    print()
    unrelated = suppressed.get("unrelated", 0)
    same_issue = suppressed.get("same_issue_diff", 0)
    print(f"- {unrelated} unrelated candidates")
    print(f"- {same_issue} same-issue duplicates of primary #{spec.get('primary_issue', '?')}")

    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `.agents/skills/nemoclaw-maintainer-day/scripts/state.ts`
```
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * State file manager for the NemoClaw maintainer skills.
 *
 * Subcommands:
 *   init                          Create state file and .git/info/exclude entry
 *   show                          Print current state
 *   exclude <number> <reason>     Add PR to permanent exclusion list (triage only processes PRs)
 *   unexclude <number>            Remove from exclusion list
 *   history <action> <item> <note> Add a history entry
 *   set-queue <json>              Update queue from triage output (pipe JSON to stdin)
 *   set-hotspots <json>           Update hotspots from hotspot output (pipe JSON to stdin)
 *
 * Usage: node --no-warnings .agents/skills/nemoclaw-maintainer-day/scripts/state.ts <subcommand> [args]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const STATE_DIR = resolve(".nemoclaw-maintainer");
const STATE_PATH = resolve(STATE_DIR, "state.json");
const GIT_EXCLUDE = resolve(".git", "info", "exclude");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HistoryEntry {
  at: string;
  item: string;
  action: string;
  note: string;
}

interface StateFile {
  version: number;
  repo: string;
  updatedAt: string | null;
  priorities: string[];
  gates: Record<string, boolean>;
  excluded: {
    prs: Record<string, { reason: string; excludedAt: string }>;
    issues: Record<string, { reason: string; excludedAt: string }>;
  };
  queue: {
    generatedAt: string | null;
    topAction: unknown;
    items: unknown[];
    nearMisses: unknown[];
  };
  hotspots: {
    generatedAt: string | null;
    files: unknown[];
  };
  activeWork: {
    kind: string | null;
    target: string | null;
    branch: string | null;
    goal: string | null;
    startedAt: string | null;
  };
  history: HistoryEntry[];
}

// ---------------------------------------------------------------------------
// State CRUD
// ---------------------------------------------------------------------------

function defaultState(): StateFile {
  return {
    version: 1,
    repo: "NVIDIA/NemoClaw",
    updatedAt: null,
    priorities: [
      "reduce_pr_backlog",
      "reduce_security_risk",
      "increase_test_coverage",
      "cool_hot_files",
    ],
    gates: {
      greenCi: true,
      noConflicts: true,
      noMajorCodeRabbit: true,
      testsForTouchedRiskyCode: true,
      autoApprove: true,
      autoPushSmallFixes: true,
      autoMerge: false,
    },
    excluded: { prs: {}, issues: {} },
    queue: { generatedAt: null, topAction: null, items: [], nearMisses: [] },
    hotspots: { generatedAt: null, files: [] },
    activeWork: { kind: null, target: null, branch: null, goal: null, startedAt: null },
    history: [],
  };
}

function loadState(): StateFile {
  if (!existsSync(STATE_PATH)) {
    return defaultState();
  }
  return JSON.parse(readFileSync(STATE_PATH, "utf-8")) as StateFile;
}

function saveState(state: StateFile): void {
  state.updatedAt = new Date().toISOString();
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n");
}

function ensureExclude(): void {
  if (!existsSync(GIT_EXCLUDE)) return;
  const content = readFileSync(GIT_EXCLUDE, "utf-8");
  const entry = ".nemoclaw-maintainer/";
  if (!content.includes(entry)) {
    appendFileSync(GIT_EXCLUDE, `\n${entry}\n`);
    console.error(`Added ${entry} to ${GIT_EXCLUDE}`);
  }
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

function cmdInit(): void {
  mkdirSync(STATE_DIR, { recursive: true });
  if (!existsSync(STATE_PATH)) {
    saveState(defaultState());
    console.log(`Created ${STATE_PATH}`);
  } else {
    console.log(`${STATE_PATH} already exists`);
  }
  ensureExclude();
}

function cmdShow(): void {
  const state = loadState();
  console.log(JSON.stringify(state, null, 2));
}

function cmdExclude(numberStr: string, reason: string): void {
  const state = loadState();
  state.excluded.prs[numberStr] = {
    reason,
    excludedAt: new Date().toISOString(),
  };
  saveState(state);
  console.log(`Excluded PR #${numberStr}: ${reason}`);
}

function cmdUnexclude(numberStr: string): void {
  const state = loadState();
  delete state.excluded.prs[numberStr];
  delete state.excluded.issues[numberStr];
  saveState(state);
  console.log(`Unexcluded #${numberStr}`);
}

function cmdHistory(action: string, item: string, note: string): void {
  const state = loadState();
  state.history.push({
    at: new Date().toISOString(),
    item,
    action,
    note,
  });
  if (state.history.length > 50) {
    state.history = state.history.slice(-50);
  }
  saveState(state);
  console.log(`Added history: ${action} ${item}`);
}

function cmdSetQueue(): void {
  const input = readFileSync(0, "utf-8");
  let triageOutput: Record<string, unknown>;
  try {
    triageOutput = JSON.parse(input);
  } catch (err) {
    console.error(
      `Failed to parse triage JSON from stdin: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
  const state = loadState();

  state.queue = {
    generatedAt: triageOutput.generatedAt ?? new Date().toISOString(),
    topAction: triageOutput.queue?.[0] ?? null,
    items: triageOutput.queue ?? [],
    nearMisses: triageOutput.nearMisses ?? [],
  };
  saveState(state);
  console.log(
    `Queue updated: ${state.queue.items.length} items, ${state.queue.nearMisses.length} near misses`,
  );
}

function cmdSetHotspots(): void {
  const input = readFileSync(0, "utf-8");
  let hotspotOutput: Record<string, unknown>;
  try {
    hotspotOutput = JSON.parse(input);
  } catch (err) {
    console.error(
      `Failed to parse hotspot JSON from stdin: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
  const state = loadState();

  state.hotspots = {
    generatedAt: hotspotOutput.generatedAt ?? new Date().toISOString(),
    files: hotspotOutput.hotspots ?? [],
  };
  saveState(state);
  console.log(`Hotspots updated: ${state.hotspots.files.length} entries`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const [subcommand, ...args] = process.argv.slice(2);

  switch (subcommand) {
    case "init":
      cmdInit();
      break;
    case "show":
      cmdShow();
      break;
    case "exclude":
      if (args.length < 2) {
        console.error("Usage: state.ts exclude <number> <reason>");
        process.exit(1);
      }
      cmdExclude(args[0], args.slice(1).join(" "));
      break;
    case "unexclude":
      if (args.length < 1) {
        console.error("Usage: state.ts unexclude <number>");
        process.exit(1);
      }
      cmdUnexclude(args[0]);
      break;
    case "history":
      if (args.length < 3) {
        console.error("Usage: state.ts history <action> <item> <note>");
        process.exit(1);
      }
      cmdHistory(args[0], args[1], args.slice(2).join(" "));
      break;
    case "set-queue":
      cmdSetQueue();
      break;
    case "set-hotspots":
      cmdSetHotspots();
      break;
    default:
      console.error(
        "Usage: state.ts <init|show|exclude|unexclude|history|set-queue|set-hotspots> [args]",
      );
      process.exit(1);
  }
}

main();

```

### Core Architecture Module: `.agents/skills/nemoclaw-maintainer-pr-comparator/scripts/render-verdict.py`
```
#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
"""Render a deterministic verdict scorecard for the PR comparator.

Reads a JSON spec on stdin describing the comparison, emits a markdown
report following templates/verdict.md.

Spec shape:
  {
    "issue": 2681,
    "criteria": ["criterion 1", "criterion 2", ...],
    "prs": [
      {
        "number": 2851,
        "title": "...",
        "tier_0": {"state_open": true, "ci_green_sha": true, ...},
        "tier_1": {"test_exercises_bug_path": "pass", "comment_as_spec": "yellow", ...},
        "tier_2": {"description_diff_drift": "pass", ...},
        "matrix": {"criterion 1": "covered", "criterion 2": "missing", ...},
        "evidence": {"tier_1.test_exercises_bug_path": "test/foo.test.ts:42 asserts on X"}
      },
      ...
    ],
    "tier_0_failures": {"2693": ["substantive:ci_failures=1"], ...},
    "supersession_edges": [{"superseder": 2851, "superseded": 2693}],
    "tiebreaker_fired": "smaller_diff",
    "winner": 2851,
    "closest_to_ready": null,
    "mode": "happy"  // optional assertion. Derived from Tier 0 gates
  }

Usage:
  scripts/render-verdict.py < spec.json > verdict.md
  cat spec.json | scripts/render-verdict.py
"""

from __future__ import annotations

import json
import sys
from typing import Any

# Tier 1 weight per check (each pass = 2 points, yellow = 1, fail = 0).
TIER_1_WEIGHT = 2.0
# Tier 2 weight per check (each pass = 1 point, yellow = 0.5, fail = 0).
TIER_2_WEIGHT = 1.0

TIER_0_GATES = (
    ("state_open", "State open"),
    ("ci_green_sha", "CI on PR SHA"),
    ("mergeable", "Mergeable"),
    ("contributor_compliance", "Contributor compliance"),
    ("branch_protection", "Branch protection"),
    ("coderabbit_threads_resolved", "Automated-review threads resolved"),
)
TIER_0_KEYS = tuple(key for key, _label in TIER_0_GATES)
INVALID_SPEC_EXIT = 64


class SpecValidationError(ValueError):
    """Raised when a verdict spec cannot produce a safe recommendation."""


def validate_spec(spec: Any) -> tuple[str, int | None]:
    """Validate untrusted renderer input and derive the verdict mode."""
    if not isinstance(spec, dict):
        raise SpecValidationError("top-level value must be an object")

    prs = spec.get("prs")
    if not isinstance(prs, list) or not prs:
        raise SpecValidationError("prs must be a non-empty array")

    pr_numbers: set[int] = set()
    eligible_numbers: set[int] = set()
    salvageable_numbers: set[int] = set()
    for index, pr in enumerate(prs):
        if not isinstance(pr, dict):
            raise SpecValidationError(f"prs[{index}] must be an object")
        number = pr.get("number")
        if type(number) is not int:
            raise SpecValidationError(f"prs[{index}].number must be an integer")
        if number in pr_numbers:
            raise SpecValidationError(f"duplicate PR number: {number}")
        pr_numbers.add(number)

        gates = pr.get("tier_0")
        if not isinstance(gates, dict):
            raise SpecValidationError(f"PR #{number} tier_0 must be an object")
        missing = [key for key in TIER_0_KEYS if key not in gates]
        extra = sorted(set(gates) - set(TIER_0_KEYS))
        if missing:
            raise SpecValidationError(
                f"PR #{number} tier_0 is missing required gates: {', '.join(missing)}"
            )
        if extra:
            raise SpecValidationError(f"PR #{number} tier_0 has unknown gates: {', '.join(extra)}")
        non_boolean = [key for key in TIER_0_KEYS if type(gates[key]) is not bool]
        if non_boolean:
            raise SpecValidationError(
                f"PR #{number} tier_0 gates must be boolean: {', '.join(non_boolean)}"
            )

        if all(gates[key] for key in TIER_0_KEYS):
            eligible_numbers.add(number)
        if gates["state_open"] and gates["contributor_compliance"]:
            salvageable_numbers.add(number)

    mode = "happy" if eligible_numbers else "degraded"
    winner = spec.get("winner")
    if winner is not None:
        if type(winner) is not int or winner not in pr_numbers:
            raise SpecValidationError("winner must reference a candidate PR number")
        if winner not in eligible_numbers:
            raise SpecValidationError(f"winner PR #{winner} did not pass every Tier 0 gate")

    closest_to_ready = spec.get("closest_to_ready")
    if closest_to_ready is not None:
        if type(closest_to_ready) is not int or closest_to_ready not in pr_numbers:
            raise SpecValidationError("closest_to_ready must reference a candidate PR number")
        if mode != "degraded":
            raise SpecValidationError("closest_to_ready is only valid in degraded mode")
        if closest_to_ready not in salvageable_numbers:
            raise SpecValidationError(
                f"closest_to_ready PR #{closest_to_ready} must be open and contributor-compliant"
            )

    supplied_mode = spec.get("mode")
    if supplied_mode is not None and supplied_mode != mode:
        raise SpecValidationError(
            f"supplied mode {supplied_mode!r} contradicts derived mode {mode!r}"
        )

    return mode, closest_to_ready


def status_emoji(status: str) -> str:
    """Map a check status to a short label. Matches templates/verdict.md."""
    return {
        "pass": "pass",
        "yellow": "yellow",
        "fail": "fail",
        True: "pass",
        False: "fail",
    }.get(status, str(status))


def score_for(status: str, weight: float) -> float:
    """Convert a check status to its weighted score contribution."""
    if status == "pass":
        return weight
    if status == "yellow":
        return weight * 0.5
    return 0.0


def render_scorecard(prs: list[dict[str, Any]]) -> str:
    """Render the per-PR scorecard table."""
    if not prs:
        return ""

    headers = ["Check"] + [f"PR #{pr['number']}" for pr in prs]

    rows: list[list[str]] = []

    # Tier 0
    rows.append(["**Tier 0 — gates**"] + [""] * len(prs))
    for key, label in TIER_0_GATES:
        row = [label]
        for pr in prs:
            row.append(status_emoji(pr["tier_0"][key]))
        rows.append(row)

    # Tier 1
    rows.append(["**Tier 1 — correctness**"] + [""] * len(prs))
    tier_1_keys = [
        "test_exercises_bug_path",
        "comment_as_spec",
        "negative_test_coverage",
        "coverage_shape",
        "refactor_vs_behavior",
        "mocking_purity",
    ]
    for key in tier_1_keys:
        label = key.replace("_", " ").capitalize()
        row = [label]
        for pr in prs:
            row.append(status_emoji(pr.get("tier_1", {}).get(key, "fail")))
        rows.append(row)

    # Tier 2
    rows.append(["**Tier 2 — quality**"] + [""] * len(prs))
    tier_2_keys = [
        "description_diff_drift",
        "migration_completion",
        "public_surface_preservation",
        "workaround_vs_root_cause",
    ]
    for key in tier_2_keys:
        label = key.replace("_", " ").capitalize()
        row = [label]
        for pr in prs:
            row.append(status_emoji(pr.get("tier_2", {}).get(key, "fail")))
        rows.append(row)

    # Weighted score row
    score_row = ["**Weighted score**"]
    for pr in prs:
        total = 0.0
        for status in pr.get("tier_1", {}).values():
            total += score_for(status, TIER_1_WEIGHT)
        for status in pr.get("tier_2", {}).values():
            total += score_for(status, TIER_2_WEIGHT)
        max_total = len(tier_1_keys) * TIER_1_WEIGHT + len(tier_2_keys) * TIER_2_WEIGHT
        score_row.append(f"{total:.1f} / {max_total:.1f}")
    rows.append(score_row)

    out = ["| " + " | ".join(headers) + " |"]
    out.append("|" + "|".join(["---"] * len(headers)) + "|")
    for row in rows:
        out.append("| " + " | ".join(row) + " |")
    return "\n".join(out)


def render_matrix(prs: list[dict[str, Any]], criteria: list[str]) -> str:
    """Render the behavior-coverage matrix."""
    if not criteria or not prs:
        return ""

    headers = ["Criterion"] + [f"PR #{pr['number']}" for pr in prs]
    out = ["| " + " | ".join(headers) + " |"]
    out.append("|" + "|".join(["---"] * len(headers)) + "|")
    for criterion in criteria:
        row = [criterion]
        for pr in prs:
            row.append(pr.get("matrix", {}).get(criterion, "missing"))
        out.append("| " + " | ".join(row) + " |")
    return "\n".join(out)


def render_evidence(prs: list[dict[str, Any]]) -> str:
    """Render the reasoning-evidence section."""
    lines = []
    for pr in prs:
        evidence = pr.get("evidence", {})
        if not evidence:
            continue
        lines.append(f"- PR #{pr['number']}:")
        for check, note in sorted(evidence.items()):
            lines.append(f"  - {check}: {note}")
    return "\n".join(lines)


def main() -> int:
    try:
        spec = json.load(sys.stdin)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON spec on stdin: {e}", file=sys.stderr)
        return INVALID_SPEC_EXIT

    try:
        mode, closest_to_ready = validate_spec(spec)
    except SpecValidationError as e:
        print(f"Invalid verdict spec: {e}", file=sys.stderr)
        return INVALID_SPEC_EXIT

    issue = spec["issue"]
    criteria = spec.get("criteria", [])
    prs = spec.get("prs", [])
    winner = spec.get("winner")
    tiebreaker = spec.get("tiebreaker_fired")
    supersession = spec.get("supersession_edges", [])

    print(f"## PR Comparison Verdict — Issue #{issue}\n")

    print("### Acceptance Criteria")
    for c in criteria:
        print(f"- [ ] {c}")
    print()

    print("### Per-PR Scorecard\n")
    print(render_scorecard(prs))
    print()

    if criteria:
        print("\n### Behavior Coverage Matrix\n")
        print(render_matrix(prs, criteria))
        print()

    if mode == "happy":
        if winner is None:
            print("\n### Verdict: No 
```

### Core Architecture Module: `.dsh/tools/render_nemoclaw_pr_body/index.ts`
```
/**
 * Render the trusted NemoClaw pull request template from typed evidence without writing to GitHub.
 */
export default async function render_nemoclaw_pr_body(input: {
  workdir: string;
  baseRef?: string;
  outcome: string;
  reason: string;
  changes: string[];
  relatedIssues?: {
    number: Integer;
    keyword: "Fixes" | "Closes" | "Resolves" | "Refs" | "Relates to" | "Part of";
  }[];
  tests: {
    result: "added-or-updated" | "existing" | "not-applicable";
    evidence?: string;
    justification?: string;
  };
  sensitivePath?: { changed: boolean; reviewEvidence?: string };
  ciWaiver?: { check: string; approval: string; followUpIssue: Integer };
  hooks: { passed: boolean; evidence?: string };
  broadGate?: { passed: boolean; evidence: string };
  docs?: { buildPassed?: boolean; styleReviewed?: boolean; newPagesValidated?: boolean };
  dgxStation?: {
    testedCommit: string;
    scenario: string;
    result: string;
    evidenceUrl: string;
    exceptionReason?: string;
  };
  dco: { commitsVerified: boolean; name: string; email: string };
  noSecrets: boolean;
}): Promise<{ body: string; blockers: string[] }> {
  const rejectControlCharacters = (value) => {
    if (typeof value === "string" && /[\u0000-\u001f\u007f]/.test(value))
      throw new Error("PR body inputs must not contain control characters");
    if (Array.isArray(value)) value.forEach(rejectControlCharacters);
    else if (value && typeof value === "object")
      Object.values(value).forEach(rejectControlCharacters);
  };
  rejectControlCharacters(input);
  const baseRef = input.baseRef ?? "origin/main";
  const quote = (value) => "'" + String(value).replaceAll("'", "'\"'\"'") + "'";
  if (
    typeof baseRef !== "string" ||
    !baseRef.trim() ||
    baseRef.length > 255 ||
    baseRef.startsWith("-") ||
    !/^[A-Za-z0-9_./@^~+-]+$/.test(baseRef)
  )
    throw new Error("baseRef must be a valid Git revision");
  const line = (value, label) => {
    if (typeof value !== "string" || !value.trim() || value.length > 4000 || /[\r\n]/.test(value))
      throw new Error(label + " must be one non-empty line of at most 4000 characters");
    return value.trim();
  };
  if (typeof input.workdir !== "string" || !input.workdir.trim())
    throw new Error("workdir is required");
  const outcome = line(input.outcome, "outcome");
  const reason = line(input.reason, "reason");
  if (!Array.isArray(input.changes) || input.changes.length === 0 || input.changes.length > 100)
    throw new Error("changes must contain 1 to 100 entries");
  const changes = input.changes.map((value, index) => line(value, "change " + index));
  const template = await tools.bash({
    command: "git show " + quote(baseRef + ":.github/PULL_REQUEST_TEMPLATE.md"),
    workdir: input.workdir,
    description: "Read trusted pull request template",
    timeoutMs: 30000,
  });
  if (template.kind !== "foreground" || template.exitCode !== 0)
    throw new Error("Could not read trusted pull request template");
  const trustedTemplate = template.stdout.text;
  for (const heading of [
    "## Outcome",
    "## Reason",
    "## Changes",
    "## Verification",
    "## Review notes",
  ])
    if (!trustedTemplate.includes(heading))
      throw new Error("Trusted pull request template is missing " + heading);
  const tests = input.tests;
  if (!tests || !["added-or-updated", "existing", "not-applicable"].includes(tests.result))
    throw new Error("tests.result is invalid");
  const blockers = [];
  if (tests.result !== "not-applicable" && !tests.evidence)
    blockers.push("Test evidence is required.");
  if (tests.result !== "added-or-updated" && !tests.justification)
    blockers.push("Test justification is required.");
  if (!input.hooks || input.hooks.passed !== true)
    blockers.push("Hook or validate:pr evidence is required.");
  if (input.noSecrets !== true) blockers.push("No-secrets confirmation is required.");
  if (!input.dco || input.dco.commitsVerified !== true)
    blockers.push("Every commit must appear as Verified.");
  const dcoName = typeof input.dco?.name === "string" ? input.dco.name.trim() : "";
  const dcoEmail = typeof input.dco?.email === "string" ? input.dco.email.trim() : "";
  if (!dcoName) blockers.push("DCO name is required.");
  if (!dcoEmail) blockers.push("DCO email is required.");
  const sensitive = input.sensitivePath ?? { changed: false };
  if (sensitive.changed && !sensitive.reviewEvidence)
    blockers.push("Sensitive-path review evidence or a waiver is required.");
  const keywords = ["Fixes", "Closes", "Resolves", "Refs", "Relates to", "Part of"];
  const relatedIssues = input.relatedIssues ?? [];
  if (!Array.isArray(relatedIssues) || relatedIssues.length > 20)
    throw new Error("relatedIssues must contain at most 20 issues");
  for (const issue of relatedIssues)
    if (
      !Number.isSafeInteger(issue.number) ||
      issue.number < 1 ||
      !keywords.includes(issue.keyword)
    )
      throw new Error("relatedIssues contains an invalid relationship");
  const verification = [];
  const addEvidence = (label, detail) => {
    verification.push("- " + label + ": " + line(detail, label));
  };
  addEvidence(
    "Contributor validation",
    input.hooks?.evidence ?? (input.hooks?.passed ? "Normal hooks passed" : "Missing"),
  );
  if (tests.result === "not-applicable")
    addEvidence(
      "Tests",
      "Not applicable — " + (tests.justification?.trim() || "Missing justification"),
    );
  else addEvidence("Tests", tests.evidence?.trim() || "Missing evidence");
  if (input.broadGate?.passed === true) addEvidence("Broad gate", input.broadGate.evidence);
  if (input.docs?.buildPassed === true) addEvidence("Documentation build", "npm run docs passed");
  if (input.docs?.styleReviewed === true) addEvidence("Documentation style", "Review completed");
  if (input.docs?.newPagesValidated === true)
    addEvidence("New documentation pages", "SPDX headers and frontmatter validated");
  addEvidence("Secrets review", "The diff contains no secrets, API keys, or credentials");
  const reviewNotes = [];
  if (sensitive.changed && sensitive.reviewEvidence)
    reviewNotes.push(
      "- Sensitive-path review: " + line(sensitive.reviewEvidence, "Sensitive-path review"),
    );
  if (input.ciWaiver) {
    if (!Number.isSafeInteger(input.ciWaiver.followUpIssue) || input.ciWaiver.followUpIssue < 1)
      throw new Error("ciWaiver.followUpIssue must be positive");
    reviewNotes.push(
      "- CI exception: " +
        line(input.ciWaiver.check, "CI check") +
        "; approval: " +
        line(input.ciWaiver.approval, "CI approval") +
        "; follow-up: #" +
        input.ciWaiver.followUpIssue,
    );
  }
  if (input.dgxStation) {
    reviewNotes.push(
      "- DGX Station tested commit: " + line(input.dgxStation.testedCommit, "DGX tested commit"),
      "- DGX Station profile or scenario: " + line(input.dgxStation.scenario, "DGX scenario"),
      "- DGX Station result: " + line(input.dgxStation.result, "DGX result"),
      "- DGX Station supporting evidence: " + line(input.dgxStation.evidenceUrl, "DGX evidence"),
    );
    if (input.dgxStation.exceptionReason)
      reviewNotes.push(
        "- DGX Station exception: " + line(input.dgxStation.exceptionReason, "DGX exception"),
      );
  }
  const replaceSection = (body, heading, content, nextHeadingPattern) => {
    const pattern = new RegExp(
      "(^|\\n)(" + heading + ")\\n[\\s\\S]*?(?=\\n" + nextHeadingPattern + "|$)",
      "u",
    );
    if (!pattern.test(body)) throw new Error("Trusted template is missing " + heading);
    return body.replace(
      pattern,
      (_, prefix, title) => prefix + title + "\n\n" + content.trim() + "\n",
    );
  };
  let body = trustedTemplate.replace(/<!--(?! markdownlint-disable MD041)[\s\S]*?-->/gu, "").trim();
  body = replaceSection(body, "## Outcome", outcome, "## Reason");
  let reasonContent = reason;
  if (relatedIssues.length)
    reasonContent +=
      "\n\n### Related issues\n\n" +
      relatedIssues.map((issue) => issue.keyword + " #" + issue.number).join("\n");
  body = replaceSection(body, "## Reason", reasonContent, "## Changes");
  body = replaceSection(
    body,
    "## Changes",
    changes.map((value) => "- " + value).join("\n"),
    "## Verification",
  );
  body = replaceSection(body, "## Verification", verification.join("\n"), "## Review notes|---");
  if (reviewNotes.length)
    body = replaceSection(body, "## Review notes", reviewNotes.join("\n"), "---");
  else body = body.replace(/\n## Review notes\n[\s\S]*?(?=\n---)/u, "");
  body = body.replace(
    /Signed-off-by: [^\n]*/u,
    "Signed-off-by: " +
      (dcoName || "Missing DCO name") +
      " <" +
      (dcoEmail || "missing-dco-email") +
      ">",
  );
  body = body.trim() + "\n";
  if (body.length > 60000) throw new Error("Rendered PR body exceeds 60000 characters");
  return { body, blockers };
}

```

### Core Architecture Module: `.dsh/tools/summarize_nemoclaw_merge_queue/index.ts`
```
/**
 * Summarize open NemoClaw pull requests and exclude candidates that lack required-check, review, or merge data. Return closed readiness rows for the NemoClaw merge queue.
 */
export default async function summarize_nemoclaw_merge_queue(input: {
  workdir: string;
  repo?: string;
  limit?: Integer;
  base?: string;
  includeStacked?: boolean;
  enrichLimit?: Integer;
}): Promise<{
  checkedAt: string;
  repo: string;
  filters: { limit: Integer; base: string | null; includeStacked: boolean; enrichLimit: Integer };
  counts: {
    approvedGreen: Integer;
    enriched: Integer;
    unenriched: Integer;
    strictReady: Integer;
    directNearMisses: Integer;
    stackedReady: Integer;
    stackedNearMisses: Integer;
    reviewQueue: Integer;
  };
  strictReady: {
    number: Integer;
    title: string;
    author: string | null;
    base: string;
    head: string;
    mergeable: string;
    reviewDecision: string;
    updatedAt: string;
    url: string;
    headSha: string;
    mergeableState: string;
    checksExitCode: Integer;
    failedChecks: string[];
    pendingChecks: string[];
    unresolvedThreadCount: Integer;
    threadsTruncated: boolean;
    advisor: string | null;
    advisorCurrent: boolean;
    advisorFindings: string | null;
    enrichmentError: string | null;
  }[];
  directNearMisses: {
    number: Integer;
    title: string;
    author: string | null;
    base: string;
    head: string;
    mergeable: string;
    reviewDecision: string;
    updatedAt: string;
    url: string;
    headSha: string;
    mergeableState: string;
    checksExitCode: Integer;
    failedChecks: string[];
    pendingChecks: string[];
    unresolvedThreadCount: Integer;
    threadsTruncated: boolean;
    advisor: string | null;
    advisorCurrent: boolean;
    advisorFindings: string | null;
    enrichmentError: string | null;
  }[];
  stackedReady: {
    number: Integer;
    title: string;
    author: string | null;
    base: string;
    head: string;
    mergeable: string;
    reviewDecision: string;
    updatedAt: string;
    url: string;
    headSha: string;
    mergeableState: string;
    checksExitCode: Integer;
    failedChecks: string[];
    pendingChecks: string[];
    unresolvedThreadCount: Integer;
    threadsTruncated: boolean;
    advisor: string | null;
    advisorCurrent: boolean;
    advisorFindings: string | null;
    enrichmentError: string | null;
  }[];
  stackedNearMisses: {
    number: Integer;
    title: string;
    author: string | null;
    base: string;
    head: string;
    mergeable: string;
    reviewDecision: string;
    updatedAt: string;
    url: string;
    headSha: string;
    mergeableState: string;
    checksExitCode: Integer;
    failedChecks: string[];
    pendingChecks: string[];
    unresolvedThreadCount: Integer;
    threadsTruncated: boolean;
    advisor: string | null;
    advisorCurrent: boolean;
    advisorFindings: string | null;
    enrichmentError: string | null;
  }[];
  unenriched: {
    number: Integer;
    title: string;
    author: string | null;
    base: string;
    head: string;
    mergeable: string;
    reviewDecision: string;
    updatedAt: string;
    url: string;
    readiness: "not-inspected";
  }[];
  reviewQueue: {
    number: Integer;
    title: string;
    author: string | null;
    base: string;
    head: string;
    mergeable: string;
    reviewDecision: string;
    updatedAt: string;
    url: string;
  }[];
}> {
  const repo = input.repo ?? "NVIDIA/NemoClaw";
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("repo must be owner/name");
  const limit = Math.max(1, Math.min(100, input.limit ?? 50)),
    base = input.base,
    includeStacked = input.includeStacked ?? true,
    enrichLimit = Math.max(0, Math.min(50, input.enrichLimit ?? 25));
  if (base !== undefined && (base.length < 1 || base.length > 255))
    throw new Error("base must contain 1 to 255 characters");
  const run = async (args, _label, allowed = [0]) => {
    const result = await tools.run_github_cli({
      workdir: input.workdir,
      args,
      acceptedExitCodes: allowed,
      timeoutMs: 60000,
    });
    return result.stdout;
  };
  const list = async (search) =>
    JSON.parse(
      await run(
        [
          "pr",
          "list",
          "--repo",
          repo,
          "--state",
          "open",
          "--limit",
          String(limit),
          "--search",
          search,
          "--json",
          "number,title,author,url,mergeable,reviewDecision,updatedAt,headRefName,baseRefName",
        ],
        "List merge queue pull requests",
      ),
    ).map((p) => ({
      number: p.number,
      title: p.title ?? "",
      author: p.author?.login ?? null,
      base: p.baseRefName ?? "",
      head: p.headRefName ?? "",
      mergeable: p.mergeable ?? "UNKNOWN",
      reviewDecision: p.reviewDecision || "REVIEW_REQUIRED",
      updatedAt: p.updatedAt ?? "",
      url: p.url ?? "",
    }));
  const search = (x) => x.filter(Boolean).join(" "),
    [a, g] = await Promise.all([
      list(
        search(["review:approved", "status:success", "draft:false", base ? "base:" + base : ""]),
      ),
      list(search(["status:success", "draft:false", base ? "base:" + base : ""])),
    ]);
  const match = (p) => (base ? p.base === base : includeStacked || p.base === "main"),
    approvedGreen = a.filter(match),
    green = g.filter(match),
    approved = new Set(approvedGreen.map((p) => p.number)),
    reviewQueue = green.filter((p) => !approved.has(p.number)),
    enriched = [];
  for (const c of approvedGreen.slice(0, enrichLimit)) {
    try {
      const [detail, checks, threads, comments] = await Promise.all([
        run(["api", "repos/" + repo + "/pulls/" + c.number], "Read pull request merge state"),
        run(
          ["pr", "checks", String(c.number), "--repo", repo, "--json", "name,state,bucket"],
          "Read pull request checks",
          [0, 8],
        ),
        run(
          [
            "api",
            "graphql",
            "-f",
            "owner=" + repo.split("/")[0],
            "-f",
            "repo=" + repo.split("/")[1],
            "-F",
            "number=" + c.number,
            "-f",
            "query=query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){headRefOid reviewThreads(first:100){nodes{isResolved}pageInfo{hasNextPage}}}}}",
          ],
          "Read pull request review threads",
        ),
        tools.read_github_pages({
          workdir: input.workdir,
          repository: repo,
          path: "issues/" + c.number + "/comments?sort=created&direction=asc",
          pageSize: 100,
          pageLimit: 20,
        }),
      ]);
      if (comments.truncated)
        throw new Error("Pull request advisor comments exceeded the bounded pagination limit");
      const d = JSON.parse(detail),
        cs = JSON.parse(checks || "[]"),
        pr = JSON.parse(threads).data?.repository?.pullRequest,
        body = String(
          [...comments.items]
            .reverse()
            .find((x) => String(x.body ?? "").includes("nemoclaw-pr-review-advisor"))?.body ?? "",
        ),
        head = pr?.headRefOid ?? d.head?.sha ?? "",
        advisorHead = body.match(/head_sha: ([0-9a-f]{40,64})/)?.[1] ?? null,
        failed = cs.filter((x) => x.bucket === "fail").map((x) => x.name ?? "unnamed check"),
        pending = cs.filter((x) => x.bucket === "pending").map((x) => x.name ?? "unnamed check");
      enriched.push({
        ...c,
        headSha: head,
        mergeable:
          d.mergeable === true ? "MERGEABLE" : d.mergeable === false ? "CONFLICTING" : "UNKNOWN",
        mergeableState: d.mergeable_state ?? "unknown",
        checksExitCode: failed.length ? 1 : pending.length ? 8 : 0,
        failedChecks: failed.slice(0, 100),
        pendingChecks: pending.slice(0, 100),
        unresolvedThreadCount: (pr?.reviewThreads?.nodes ?? []).filter((x) => !x.isResolved).length,
        threadsTruncated: Boolean(pr?.reviewThreads?.pageInfo?.hasNextPage),
        advisor: body.match(/recommendation: ([^;\n]+)/)?.[1]?.trim() ?? null,
        advisorCurrent: Boolean(advisorHead && advisorHead === head),
        advisorFindings: body.match(/\*\*Findings:\*\*[^\n]*/)?.[0] ?? null,
        enrichmentError: null,
      });
    } catch (e) {
      const projected = await tools.project_diagnostic_text({
        lines: [String(e?.message ?? e)],
        clipMode: "head",
        maxLines: 1,
        maxCharacters: 1000,
        maxLineCharacters: 1000,
      });
      enriched.push({
        ...c,
        headSha: "",
        mergeableState: "unknown",
        checksExitCode: 1,
        failedChecks: [],
        pendingChecks: [],
        unresolvedThreadCount: 0,
        threadsTruncated: false,
        advisor: null,
        advisorCurrent: false,
        advisorFindings: null,
        enrichmentError: projected.text,
      });
    }
  }
  const ids = new Set(enriched.map((p) => p.number)),
    unenriched = approvedGreen
      .filter((p) => !ids.has(p.number))
      .map((p) => ({ ...p, readiness: "not-inspected" })),
    ready = (p) =>
      !p.enrichmentError &&
      p.mergeable === "MERGEABLE" &&
      p.checksExitCode === 0 &&
      p.failedChecks.length === 0 &&
      p.pendingChecks.length === 0 &&
      p.unresolvedThreadCount === 0 &&
      !p.threadsTruncated &&
      p.advisorCurrent &&
      p.advisor === "merge_as_is",
    strictReady = enriched.filter((p) => p.base === "main" && ready(p)),
    directNearMisses = enriched.filter((p) => p.base === "main" && !ready(p)),
    stackedReady = enriched.filter((p) => p.base !== "main" && ready(p)),
    stackedNearMisses = enriched.filter((p) => p.base !== "main" && !ready(p));
  return {
    checkedAt: new Date().toISOString(),
    repo,
    filters: { limit, base: base ?? null, includeStacked, enrichLimit },
    counts: {
      approvedGreen: approvedGreen.length,
      enri
```

### Core Architecture Module: `agents/hermes/migrate-dashboard-state.py`
```
#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
"""Retire Hermes' legacy dashboard homes without losing agent-owned state.

The dashboard now uses the native Hermes home. Older images wrote durable
state below ``dashboard-home`` or ``profiles/dashboard-home``. Merge those
trees into the native home only when every path is a real directory or a
single-link regular file and every destination collision is byte-identical.
Generated shadow configuration is deliberately removed rather than allowed to
replace the native configuration.
"""

from __future__ import annotations

import argparse
import copy
import errno
import hashlib
import json
import os
import secrets
import signal
import sqlite3
import stat
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from managed_policy import (  # noqa: E402
    MANAGED_POLICY_PATH,
    ManagedPolicyError,
    load_managed_policy,
)


MANAGED_SHADOW_FILES = frozenset(
    {
        ".config-hash",
        ".env-hash",
        ".runtime-config-state.json",
        "gateway_state.json",
    }
)
VERIFIABLE_SHADOW_FILES = frozenset({"config.yaml", ".env"})
LEGACY_STATE_DATABASE = "state.db"
LEGACY_STATE_DATABASE_SIDECARS = frozenset({"state.db-shm", "state.db-wal"})
STATE_DATABASE_MIGRATION_RECORD = ".nemoclaw-dashboard-state-migration.json"
STATE_DATABASE_RECORD_VERSION = 1
STATE_DATABASE_TEST_INTERRUPT_ENV = (
    "NEMOCLAW_TEST_INTERRUPT_AFTER_DASHBOARD_STATE_PUBLICATION"
)
STALE_RUNTIME_FILES = frozenset({"gateway.lock", "gateway.pid"})
STALE_RUNTIME_DIRECTORIES = frozenset({"logs"})
MAX_VERIFICATION_BYTES = 4 * 1024 * 1024
LEGACY_PATHS = ("dashboard-home", "profiles/dashboard-home")
DEFAULT_MAX_ENTRIES = 100_000
DEFAULT_MAX_DEPTH = 64
DEFAULT_MAX_BYTES = 10 * 1024 * 1024 * 1024


class MigrationError(Exception):
    """A legacy tree cannot be migrated without guessing or following links."""


@dataclass(frozen=True)
class EntryIdentity:
    device: int
    inode: int
    mode: int
    links: int
    size: int


@dataclass
class MigrationBudget:
    max_entries: int
    max_depth: int
    max_bytes: int
    entries: int = 0
    total_bytes: int = 0

    def consume(self, entry: EntryIdentity, display: str, depth: int) -> None:
        if depth > self.max_depth:
            raise MigrationError(
                f"legacy dashboard state exceeds maximum depth {self.max_depth} at {display}"
            )
        self.entries += 1
        if self.entries > self.max_entries:
            raise MigrationError(
                f"legacy dashboard state exceeds maximum entry count {self.max_entries}"
            )
        if stat.S_ISREG(entry.mode):
            self.total_bytes += entry.size
            if self.total_bytes > self.max_bytes:
                raise MigrationError(
                    f"legacy dashboard state exceeds maximum byte count {self.max_bytes}"
                )


@dataclass(frozen=True)
class ShadowMigrationPolicy:
    routing_keys: tuple[str, ...]
    managed_config_paths: tuple[tuple[str, ...], ...]
    env_keys: frozenset[str]


def _load_shadow_migration_policy(path: str) -> ShadowMigrationPolicy:
    try:
        document = load_managed_policy(Path(path))
    except ManagedPolicyError as exc:
        raise MigrationError(f"managed Hermes policy is invalid: {exc}") from exc
    shadow = document["shadow_migration"]
    managed_paths = tuple(tuple(value.split(".")) for value in document["managed_paths"])
    if any(not path or any(not segment for segment in path) for path in managed_paths):
        raise MigrationError("managed Hermes policy contains an invalid managed path")
    return ShadowMigrationPolicy(
        routing_keys=tuple(shadow["routing_keys"]),
        managed_config_paths=managed_paths,
        env_keys=frozenset(shadow["env_keys"]),
    )


def _identity(parent_fd: int, name: str, display: str) -> EntryIdentity:
    try:
        current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
    except OSError as exc:
        raise MigrationError(f"{display} could not be inspected: {exc.strerror}") from exc
    if stat.S_ISLNK(current.st_mode):
        raise MigrationError(f"{display} is a symbolic link")
    if not stat.S_ISDIR(current.st_mode) and not stat.S_ISREG(current.st_mode):
        raise MigrationError(f"{display} is not a regular file or directory")
    if stat.S_ISREG(current.st_mode) and current.st_nlink != 1:
        raise MigrationError(f"{display} has hard-link count {current.st_nlink}")
    return EntryIdentity(
        current.st_dev,
        current.st_ino,
        current.st_mode,
        current.st_nlink,
        current.st_size,
    )


def _validate_legacy_state_database_sidecar(
    name: str, entry: EntryIdentity, display: str
) -> None:
    if not stat.S_ISREG(entry.mode):
        raise MigrationError(f"legacy state database sidecar {display} is not a regular file")
    if name == "state.db-wal" and entry.size > 0:
        raise MigrationError(
            f"legacy state database has a non-empty {display}; "
            "checkpoint the database before retrying migration"
        )


def _open_dir(parent_fd: int, name: str, display: str) -> int:
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    flags |= getattr(os, "O_CLOEXEC", 0)
    try:
        return os.open(name, flags, dir_fd=parent_fd)
    except OSError as exc:
        raise MigrationError(f"{display} is not a safe directory: {exc.strerror}") from exc


def _open_file(parent_fd: int, name: str, display: str) -> int:
    flags = os.O_RDONLY | os.O_NOFOLLOW
    flags |= getattr(os, "O_CLOEXEC", 0)
    try:
        fd = os.open(name, flags, dir_fd=parent_fd)
    except OSError as exc:
        raise MigrationError(f"{display} is not a safe regular file: {exc.strerror}") from exc
    try:
        opened = os.fstat(fd)
        if not stat.S_ISREG(opened.st_mode) or opened.st_nlink != 1:
            raise MigrationError(f"{display} is not a single-link regular file")
    except BaseException:
        os.close(fd)
        raise
    return fd


def _same_file(
    source_fd: int,
    source_name: str,
    source_display: str,
    target_fd: int,
    target_name: str,
    target_display: str,
) -> bool:
    left = _open_file(source_fd, source_name, source_display)
    try:
        right = _open_file(target_fd, target_name, target_display)
        try:
            if os.fstat(left).st_size != os.fstat(right).st_size:
                return False
            while True:
                left_chunk = os.read(left, 64 * 1024)
                right_chunk = os.read(right, 64 * 1024)
                if left_chunk != right_chunk:
                    return False
                if not left_chunk:
                    return True
        finally:
            os.close(right)
    finally:
        os.close(left)


def _entries(fd: int) -> list[str]:
    try:
        return sorted(os.listdir(fd))
    except OSError as exc:
        raise MigrationError(f"legacy dashboard state could not be listed: {exc.strerror}") from exc


def _read_text(parent_fd: int, name: str, display: str) -> str | None:
    fd = _open_file(parent_fd, name, display)
    try:
        size = os.fstat(fd).st_size
        if size > MAX_VERIFICATION_BYTES:
            return None
        chunks: list[bytes] = []
        remaining = size + 1
        while remaining > 0:
            chunk = os.read(fd, min(64 * 1024, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        if remaining == 0:
            return None
        return b"".join(chunks).decode("utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    finally:
        os.close(fd)


def _path_value(document: dict, path: tuple[str, ...]) -> tuple[bool, object]:
    current: object = document
    for segment in path:
        if not isinstance(current, dict) or segment not in current:
            return False, None
        current = current[segment]
    return True, current


def _remove_path(document: dict, path: tuple[str, ...]) -> None:
    parents: list[tuple[dict, str]] = []
    current = document
    for segment in path[:-1]:
        child = current.get(segment)
        if not isinstance(child, dict):
            return
        parents.append((current, segment))
        current = child
    current.pop(path[-1], None)
    for parent, segment in reversed(parents):
        child = parent.get(segment)
        if isinstance(child, dict) and not child:
            parent.pop(segment, None)


def _is_subset_equal(candidate: object, reference: object) -> bool:
    if isinstance(candidate, dict):
        return isinstance(reference, dict) and all(
            key in reference and _is_subset_equal(value, reference[key])
            for key, value in candidate.items()
        )
    return candidate == reference


def _load_unique_yaml(text: str) -> object:
    import yaml

    class UniqueKeyLoader(yaml.SafeLoader):
        pass

    def construct_unique_mapping(
        loader: UniqueKeyLoader, node: yaml.nodes.MappingNode, deep: bool = False
    ) -> dict:
        mapping: dict = {}
        for key_node, value_node in node.value:
            key = loader.construct_object(key_node, deep=deep)
            try:
                duplicate = key in mapping
            except TypeError as exc:
                raise yaml.constructor.ConstructorError(
                    "while constructing a mapping",
                    node.start_mark,
                    "found an unhashable mapping key",
                    key_node.start_mark,
                ) from exc
            if duplicate:
                raise yaml.constructor.ConstructorError(
                    "while constructing a mapping",
                    node.start_mark,
                
```

### Core Architecture Module: `nemoclaw/src/blueprint/state.ts`
```
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { isObjectRecord } from "../shared/object-record.js";

const STATE_DIR = join(homedir(), ".nemoclaw", "state");

export interface NemoClawState {
  lastRunId: string | null;
  lastAction: string | null;
  blueprintVersion: string | null;
  sandboxName: string | null;
  migrationSnapshot: string | null;
  hostBackupPath: string | null;
  createdAt: string | null;
  updatedAt: string;
  lastRebuildAt: string | null;
  lastRebuildBackupPath: string | null;
}

function readNullableString(value: unknown): string | null | undefined {
  return value === undefined || value === null || typeof value === "string" ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function readStatePatch(value: unknown): Partial<NemoClawState> {
  if (!isObjectRecord(value)) {
    return {};
  }

  const patch: Partial<NemoClawState> = {};

  if (readNullableString(value.lastRunId) !== undefined)
    patch.lastRunId = readNullableString(value.lastRunId);
  if (readNullableString(value.lastAction) !== undefined)
    patch.lastAction = readNullableString(value.lastAction);
  if (readNullableString(value.blueprintVersion) !== undefined)
    patch.blueprintVersion = readNullableString(value.blueprintVersion);
  if (readNullableString(value.sandboxName) !== undefined)
    patch.sandboxName = readNullableString(value.sandboxName);
  if (readNullableString(value.migrationSnapshot) !== undefined)
    patch.migrationSnapshot = readNullableString(value.migrationSnapshot);
  if (readNullableString(value.hostBackupPath) !== undefined)
    patch.hostBackupPath = readNullableString(value.hostBackupPath);
  if (readNullableString(value.createdAt) !== undefined)
    patch.createdAt = readNullableString(value.createdAt);
  if (readString(value.updatedAt) !== undefined) patch.updatedAt = readString(value.updatedAt);
  if (readNullableString(value.lastRebuildAt) !== undefined)
    patch.lastRebuildAt = readNullableString(value.lastRebuildAt);
  if (readNullableString(value.lastRebuildBackupPath) !== undefined)
    patch.lastRebuildBackupPath = readNullableString(value.lastRebuildBackupPath);

  return patch;
}

let stateDirCreated = false;

function ensureStateDir(): void {
  if (stateDirCreated) return;
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  stateDirCreated = true;
}

function statePath(): string {
  return join(STATE_DIR, "nemoclaw.json");
}

function blankState(): NemoClawState {
  return {
    lastRunId: null,
    lastAction: null,
    blueprintVersion: null,
    sandboxName: null,
    migrationSnapshot: null,
    hostBackupPath: null,
    createdAt: null,
    updatedAt: new Date().toISOString(),
    lastRebuildAt: null,
    lastRebuildBackupPath: null,
  };
}

export function loadState(): NemoClawState {
  ensureStateDir();
  const path = statePath();
  if (!existsSync(path)) {
    return blankState();
  }

  try {
    // Merge validated persisted values over current defaults so older state
    // files remain compatible as the plugin state schema evolves.
    const persisted: unknown = JSON.parse(readFileSync(path, "utf-8"));
    return { ...blankState(), ...readStatePatch(persisted) };
  } catch {
    return blankState();
  }
}

function writeStateFile(state: NemoClawState): void {
  const finalPath = statePath();
  const tmpPath = `${finalPath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(state, null, 2), { mode: 0o600 });
  renameSync(tmpPath, finalPath);
}

export function saveState(state: NemoClawState): void {
  ensureStateDir();
  state.updatedAt = new Date().toISOString();
  state.createdAt ??= state.updatedAt;
  writeStateFile(state);
}

export function clearState(): void {
  ensureStateDir();
  writeStateFile(blankState());
}

```

### Core Architecture Module: `scripts/checks/docker-engine-27-receipt-transfer-e2e.ts`
```
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  dockerDaemonReceiptMount,
  transferDockerReceiptToDaemon,
} from "../../src/lib/onboard/managed-startup/docker-receipt-transfer.ts";

const DIND_IMAGE =
  "docker.io/library/docker:27.5.1-dind@sha256:aa3df78ecf320f5fafdce71c659f1629e96e9de0968305fe1de670e0ca9176ce";
const RECEIPT_IMAGE =
  "docker.io/library/alpine:3.20@sha256:d9e853e87e55526f6b2917df91a2115c36dd7c696a35be12163d44e6e2a4b6bc";
const RECEIPT_VOLUME_DIRECTORY = "/run/nemoclaw/managed-startup-receipt-transfer";
const DAEMON_OWNER_LABEL = "io.nvidia.nemoclaw.e2e.docker27-receipt";
export const DOCKER_ENGINE_27_OPERATION_TIMEOUT_MS = 30_000;
export const DOCKER_ENGINE_27_PULL_TIMEOUT_MS = 120_000;
export const DOCKER_ENGINE_27_CLEANUP_TIMEOUT_MS = 15_000;
export const DOCKER_ENGINE_27_READINESS_ATTEMPTS = 45;
export const DOCKER_ENGINE_27_READINESS_COMMAND_TIMEOUT_MS = 5_000;
export const DOCKER_ENGINE_27_READINESS_INTERVAL_MS = 1_000;
export const DOCKER_ENGINE_27_MAX_OPERATION_COUNT = 28;
export const DOCKER_ENGINE_27_PULL_COUNT = 2;
export const DOCKER_ENGINE_27_CLEANUP_OPERATION_COUNT = 3;
export const DOCKER_ENGINE_27_PROCESS_ALLOWANCE_MS = 60_000;
export const DOCKER_ENGINE_27_MINIMUM_PROBE_TIMEOUT_MS =
  DOCKER_ENGINE_27_READINESS_ATTEMPTS *
    (DOCKER_ENGINE_27_READINESS_COMMAND_TIMEOUT_MS + DOCKER_ENGINE_27_READINESS_INTERVAL_MS) +
  DOCKER_ENGINE_27_MAX_OPERATION_COUNT * DOCKER_ENGINE_27_OPERATION_TIMEOUT_MS +
  DOCKER_ENGINE_27_PULL_COUNT * DOCKER_ENGINE_27_PULL_TIMEOUT_MS +
  DOCKER_ENGINE_27_CLEANUP_OPERATION_COUNT * DOCKER_ENGINE_27_CLEANUP_TIMEOUT_MS +
  DOCKER_ENGINE_27_PROCESS_ALLOWANCE_MS;
export const DOCKER_ENGINE_27_MINIMUM_CLEANUP_PROCESS_TIMEOUT_MS =
  DOCKER_ENGINE_27_CLEANUP_OPERATION_COUNT * DOCKER_ENGINE_27_CLEANUP_TIMEOUT_MS +
  DOCKER_ENGINE_27_PROCESS_ALLOWANCE_MS / 2;

export type DockerEngine27Platform = "linux/amd64" | "linux/arm64";

export function dockerEngine27ReceiptDaemonName(
  runId: number | string,
  runAttempt: number | string,
  platform: DockerEngine27Platform,
): string {
  const run = String(runId);
  const attempt = String(runAttempt);
  requireCondition(/^[1-9][0-9]{0,15}$/u.test(run), "Docker Engine 27 run ID is invalid");
  requireCondition(/^[1-9][0-9]{0,5}$/u.test(attempt), "Docker Engine 27 run attempt is invalid");
  requireCondition(
    platform === "linux/amd64" || platform === "linux/arm64",
    "Docker Engine 27 platform is invalid",
  );
  return `nemoclaw-receipt-engine27-${run}-${attempt}-${platform.replace("/", "-")}`;
}

export function dockerEngine27ReceiptIdentityArguments(
  runId: number | string,
  runAttempt: number | string,
  platform: DockerEngine27Platform,
): string[] {
  dockerEngine27ReceiptDaemonName(runId, runAttempt, platform);
  return ["--run-id", String(runId), "--run-attempt", String(runAttempt), "--platform", platform];
}

export type CommandResult = {
  readonly error?: Error;
  readonly status: number | null;
  readonly stderr: string;
  readonly stdout: string;
};

type DockerCommandProfile = "cleanup" | "operation" | "pull" | "readiness";

function runDocker(
  args: readonly string[],
  profile: DockerCommandProfile = "operation",
): CommandResult {
  const result = spawnSync("docker", [...args], {
    encoding: "utf8",
    killSignal: "SIGKILL",
    maxBuffer: profile === "operation" || profile === "pull" ? 8 * 1024 * 1024 : 1024 * 1024,
    timeout:
      profile === "pull"
        ? DOCKER_ENGINE_27_PULL_TIMEOUT_MS
        : profile === "readiness"
          ? DOCKER_ENGINE_27_READINESS_COMMAND_TIMEOUT_MS
          : profile === "cleanup"
            ? DOCKER_ENGINE_27_CLEANUP_TIMEOUT_MS
            : DOCKER_ENGINE_27_OPERATION_TIMEOUT_MS,
  });
  return {
    ...(result.error ? { error: result.error } : {}),
    status: result.status,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  };
}

function commandDetail(result: CommandResult): string {
  return `${result.stderr} ${result.stdout} ${result.error?.message ?? ""}`.trim().slice(-1_600);
}

function requireSuccess(result: CommandResult, operation: string): string {
  if (result.status !== 0) {
    throw new Error(`${operation} failed: ${commandDetail(result)}`);
  }
  return result.stdout.trim();
}

function requireCondition(condition: unknown, detail: string): asserts condition {
  if (!condition) throw new Error(detail);
}

async function waitForDocker27(daemonName: string): Promise<void> {
  for (let attempt = 0; attempt < DOCKER_ENGINE_27_READINESS_ATTEMPTS; attempt += 1) {
    if (runDocker(["exec", daemonName, "docker", "info"], "readiness").status === 0) return;
    await new Promise<void>((resolve) =>
      setTimeout(resolve, DOCKER_ENGINE_27_READINESS_INTERVAL_MS),
    );
  }
  throw new Error("Docker Engine 27 daemon did not become ready");
}

function seedName(args: readonly string[]): string {
  const nameIndex = args.indexOf("--name");
  requireCondition(nameIndex >= 0 && args[nameIndex + 1], "receipt seed command omitted --name");
  return args[nameIndex + 1];
}

function assertSeedIsolation(
  innerDocker: (args: readonly string[]) => CommandResult,
  name: string,
): void {
  const inspected = JSON.parse(
    requireSuccess(innerDocker(["inspect", name]), "inspect receipt seed"),
  );
  requireCondition(
    Array.isArray(inspected) && inspected.length === 1,
    "receipt seed inspect changed shape",
  );
  validateDockerEngine27SeedIsolation(inspected[0]);
}

export function validateDockerEngine27SeedIsolation(value: unknown): void {
  requireCondition(typeof value === "object" && value !== null, "receipt seed inspect is invalid");
  const seed = value as {
    Config?: { User?: unknown };
    HostConfig?: {
      CapDrop?: unknown;
      Mounts?: unknown;
      NetworkMode?: unknown;
      Privileged?: unknown;
      ReadonlyRootfs?: unknown;
      SecurityOpt?: unknown;
    };
  };
  requireCondition(seed.Config?.User === "0", "receipt seed did not use numeric root");
  requireCondition(seed.HostConfig?.NetworkMode === "none", "receipt seed retained networking");
  requireCondition(seed.HostConfig?.Privileged === false, "receipt seed was privileged");
  requireCondition(seed.HostConfig?.ReadonlyRootfs === true, "receipt seed root was writable");
  requireCondition(
    Array.isArray(seed.HostConfig?.SecurityOpt) &&
      seed.HostConfig.SecurityOpt.includes("no-new-privileges"),
    "receipt seed omitted no-new-privileges",
  );
  requireCondition(
    Array.isArray(seed.HostConfig?.CapDrop) && seed.HostConfig.CapDrop.includes("ALL"),
    "receipt seed retained capabilities",
  );
  requireCondition(
    Array.isArray(seed.HostConfig?.Mounts) &&
      seed.HostConfig.Mounts.some(
        (mount) =>
          typeof mount === "object" &&
          mount !== null &&
          Reflect.get(mount, "Type") === "volume" &&
          Reflect.get(mount, "Target") === RECEIPT_VOLUME_DIRECTORY,
      ),
    "receipt seed omitted the daemon volume",
  );
}

export function requireDockerResourceAbsent(result: CommandResult, resource: string): void {
  const detail = commandDetail(result);
  requireCondition(
    result.status !== 0 && /\bno such (?:container|object|volume)\b/iu.test(detail),
    `${resource} absence was not proven after receipt-transfer cleanup: ${detail}`,
  );
}

export function cleanupDockerEngine27ReceiptDaemon(daemonName: string): void {
  const inspected = runDocker(
    [
      "container",
      "inspect",
      "--format",
      `{{ index .Config.Labels "${DAEMON_OWNER_LABEL}" }}`,
      daemonName,
    ],
    "cleanup",
  );
  if (inspected.status !== 0) {
    requireCondition(
      /No such (?:container|object)/iu.test(commandDetail(inspected)),
      `could not inspect Docker Engine 27 daemon during cleanup: ${commandDetail(inspected)}`,
    );
    return;
  }
  requireCondition(
    inspected.stdout.trim() === daemonName,
    "refusing to remove a Docker Engine 27 daemon with mismatched ownership",
  );
  requireSuccess(runDocker(["rm", "-f", daemonName], "cleanup"), "remove Docker Engine 27 daemon");
  requireDockerResourceAbsent(
    runDocker(["container", "inspect", daemonName], "cleanup"),
    "Docker Engine 27 daemon",
  );
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function finalizeDockerEngine27ReceiptProbe(
  primaryError: unknown | null,
  cleanupDaemon: () => void,
  cleanupFixture: () => void,
): void {
  const cleanupErrors: unknown[] = [];
  try {
    cleanupDaemon();
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    cleanupFixture();
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (primaryError !== null) {
    if (cleanupErrors.length === 0) throw primaryError;
    throw new AggregateError(
      [primaryError, ...cleanupErrors],
      `Docker Engine 27 receipt probe failed: ${errorDetail(primaryError)}; cleanup also failed: ${cleanupErrors.map(errorDetail).join("; ")}`,
    );
  }
  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      cleanupErrors,
      `Docker Engine 27 receipt probe cleanup failed: ${cleanupErrors.map(errorDetail).join("; ")}`,
    );
  }
}

async function verifyDockerEngine27ReceiptTransfer(daemonName: string): Promise<void> {
  const suffix = randomUUID().replaceAll("-", "");
  const legacySeed = `nemoclaw-receipt-legacy-seed-${suffix}`;
  const legacyVolume = `nemoclaw-receipt-legacy-volume-${suffix}`;
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-receipt-engine27-"));
  const fixtureReceipt = path.join(fixtureRoot, "receipt");
  const daemonReceipt = `/nemoclaw-receipt-${suffix}`;
  let primaryErro
```

### Core Architecture Module: `scripts/lib/openclaw_pairing_state.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Descriptor-pinned adapter for OpenClaw's canonical pairing-state database."""

import json
import os
import sqlite3
import stat
import urllib.parse


ADAPTER_VERSION = 1
OPENCLAW_STATE_SCHEMA_VERSION = 15
MAX_SQLITE_BYTES = 1024 * 1024 * 1024


class OpenClawPairingStateRetryableError(OSError):
    """The canonical snapshot changed or is not ready for a bounded read."""


def _directory_flags():
    return os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | getattr(os, "O_CLOEXEC", 0)


def _path_flags():
    return (
        getattr(os, "O_PATH", os.O_RDONLY)
        | os.O_DIRECTORY
        | os.O_NOFOLLOW
        | getattr(os, "O_CLOEXEC", 0)
    )


def _file_flags():
    return (
        os.O_RDONLY
        | os.O_NOFOLLOW
        | getattr(os, "O_CLOEXEC", 0)
        | getattr(os, "O_NONBLOCK", 0)
    )


def _metadata(metadata, require_nonempty):
    if (
        not stat.S_ISREG(metadata.st_mode)
        or metadata.st_nlink != 1
        or metadata.st_gid != os.getegid()
        or metadata.st_mode & 0o007
        or (require_nonempty and metadata.st_size < 1)
        or metadata.st_size > MAX_SQLITE_BYTES
    ):
        raise OSError("unsafe canonical pairing-state SQLite entry")
    return (
        metadata.st_dev,
        metadata.st_ino,
        metadata.st_uid,
        metadata.st_gid,
        metadata.st_size,
        metadata.st_mtime_ns,
        metadata.st_mode & 0o7777,
    )


def _directory_metadata(fd):
    metadata = os.fstat(fd)
    if (
        not stat.S_ISDIR(metadata.st_mode)
        or metadata.st_gid != os.getegid()
        or metadata.st_mode & 0o002
    ):
        raise OSError("unsafe canonical pairing-state directory")
    return metadata.st_dev, metadata.st_ino


def _state_root_is_current(state_dir, state_fd):
    try:
        current = os.stat(state_dir, follow_symlinks=False)
        pinned = os.fstat(state_fd)
    except OSError:
        return False
    return stat.S_ISDIR(current.st_mode) and (current.st_dev, current.st_ino) == (
        pinned.st_dev,
        pinned.st_ino,
    )


def _directory_is_current(state_dir, state_fd, sqlite_state_fd):
    if not _state_root_is_current(state_dir, state_fd):
        return False
    try:
        current = os.stat("state", dir_fd=state_fd, follow_symlinks=False)
        pinned = os.fstat(sqlite_state_fd)
    except OSError:
        return False
    return stat.S_ISDIR(current.st_mode) and (current.st_dev, current.st_ino) == (
        pinned.st_dev,
        pinned.st_ino,
    )


def _open_state_root(state_dir):
    if not os.path.isabs(state_dir):
        raise OSError("canonical pairing-state path is not absolute")
    for required_flag in ("O_DIRECTORY", "O_NOFOLLOW"):
        if not hasattr(os, required_flag):
            raise OSError("canonical pairing-state descriptor flags are unavailable")
    root_fd = os.open(os.sep, _path_flags())
    try:
        for component in (part for part in state_dir.split(os.sep) if part):
            if component in (".", ".."):
                raise OSError("unsafe canonical pairing-state path")
            next_fd = os.open(component, _path_flags(), dir_fd=root_fd)
            os.close(root_fd)
            root_fd = next_fd
        _directory_metadata(root_fd)
        if not _state_root_is_current(state_dir, root_fd):
            raise OpenClawPairingStateRetryableError("canonical pairing-state root changed")
        return root_fd
    except Exception:
        os.close(root_fd)
        raise


def _open_state_directory(state_dir, state_fd):
    sqlite_state_fd = os.open("state", _directory_flags(), dir_fd=state_fd)
    try:
        _directory_metadata(sqlite_state_fd)
        if not _directory_is_current(state_dir, state_fd, sqlite_state_fd):
            raise OpenClawPairingStateRetryableError(
                "canonical pairing-state directory changed"
            )
        return sqlite_state_fd
    except Exception:
        os.close(sqlite_state_fd)
        raise


def _entry_is_current(
    state_dir,
    state_fd,
    sqlite_state_fd,
    name,
    fd,
    expected,
):
    if not _directory_is_current(state_dir, state_fd, sqlite_state_fd):
        return False
    try:
        current = os.stat(name, dir_fd=sqlite_state_fd, follow_symlinks=False)
    except OSError:
        return False
    current_metadata = (
        current.st_dev,
        current.st_ino,
        current.st_uid,
        current.st_gid,
        current.st_size,
        current.st_mtime_ns,
        current.st_mode & 0o7777,
    )
    descriptor_metadata = _metadata(os.fstat(fd), name != "openclaw.sqlite-wal")
    if name.endswith("-shm"):
        # SQLite may update read marks in an existing SHM. Identity and safety
        # attributes remain immutable; size and timestamps are coordination data.
        stable_fields = (0, 1, 2, 3, 6)
        return all(
            current_metadata[index] == expected[index]
            and descriptor_metadata[index] == expected[index]
            for index in stable_fields
        )
    return current_metadata == expected and descriptor_metadata == expected


def sqlite_snapshot_is_current(
    state_dir,
    state_fd,
    sqlite_state_fd,
    database_fd,
    database_metadata,
):
    return _entry_is_current(
        state_dir,
        state_fd,
        sqlite_state_fd,
        "openclaw.sqlite",
        database_fd,
        database_metadata,
    )


def sqlite_database_metadata(database_fd):
    """Return the validated identity/safety metadata for a pinned database."""

    return _metadata(os.fstat(database_fd), True)


def _open_wal_descriptors(state_dir, state_fd, sqlite_state_fd):
    shared_memory_fd = -1
    try:
        wal_fd = os.open("openclaw.sqlite-wal", _file_flags(), dir_fd=sqlite_state_fd)
    except FileNotFoundError:
        return None
    try:
        wal_metadata = _metadata(os.fstat(wal_fd), False)
        if not _entry_is_current(
            state_dir,
            state_fd,
            sqlite_state_fd,
            "openclaw.sqlite-wal",
            wal_fd,
            wal_metadata,
        ):
            raise OpenClawPairingStateRetryableError("canonical pairing-state WAL changed")
        try:
            shared_memory_fd = os.open(
                "openclaw.sqlite-shm", _file_flags(), dir_fd=sqlite_state_fd
            )
        except FileNotFoundError as error:
            raise OpenClawPairingStateRetryableError(
                "canonical pairing-state WAL is missing its shared-memory sidecar"
            ) from error
        shared_memory_metadata = _metadata(os.fstat(shared_memory_fd), True)
        if not _entry_is_current(
            state_dir,
            state_fd,
            sqlite_state_fd,
            "openclaw.sqlite-shm",
            shared_memory_fd,
            shared_memory_metadata,
        ):
            raise OpenClawPairingStateRetryableError(
                "canonical pairing-state shared-memory sidecar changed"
            )
        return wal_fd, wal_metadata, shared_memory_fd, shared_memory_metadata
    except Exception:
        if shared_memory_fd >= 0:
            os.close(shared_memory_fd)
        os.close(wal_fd)
        raise


def _regular_open_file_identity_counts():
    descriptor_root = next(
        (
            candidate
            for candidate in ("/proc/self/fd", "/dev/fd")
            if os.path.isdir(candidate)
        ),
        None,
    )
    if descriptor_root is None:
        raise OSError("open descriptor census is unavailable")
    counts = {}
    for name in os.listdir(descriptor_root):
        if not name.isdecimal():
            continue
        try:
            metadata = os.fstat(int(name))
        except OSError:
            continue
        if stat.S_ISREG(metadata.st_mode):
            identity = metadata.st_dev, metadata.st_ino
            counts[identity] = counts.get(identity, 0) + 1
    return counts, descriptor_root


def _require_sqlite_vfs_descriptor(counts, baseline, fd, expected_delta):
    metadata = os.fstat(fd)
    identity = metadata.st_dev, metadata.st_ino
    if counts.get(identity, 0) != baseline.get(identity, 0) + expected_delta:
        raise OpenClawPairingStateRetryableError(
            "SQLite reopened an unvalidated pairing-state file identity"
        )


def _optional(record, key, value):
    if value is not None:
        record[key] = value


def _json_column(value):
    if value is None:
        return None
    if not isinstance(value, str):
        raise ValueError("invalid canonical pairing-state JSON column")
    return json.loads(value)


def _pending_record(row):
    record = {
        "requestId": row["request_id"],
        "deviceId": row["device_id"],
        "publicKey": row["public_key"],
        "ts": row["ts"],
    }
    for key, column in (
        ("displayName", "display_name"),
        ("platform", "platform"),
        ("deviceFamily", "device_family"),
        ("clientId", "client_id"),
        ("clientMode", "client_mode"),
        ("browserOrigin", "browser_origin"),
        ("role", "role"),
        ("remoteIp", "remote_ip"),
        ("refreshedAtMs", "refreshed_at_ms"),
    ):
        _optional(record, key, row[column])
    _optional(record, "roles", _json_column(row["roles_json"]))
    _optional(record, "scopes", _json_column(row["scopes_json"]))
    _optional(record, "silent", None if row["silent"] is None else row["silent"] != 0)
    _optional(
        record,
        "isRepair",
        None if row["is_repair"] is None else row["is_repair"] != 0,
    )
    return record


def _paired_record(row):
    record = {
        "deviceId": row["device_id"],
        "publicKey": row["public_key"],
        "createdAtMs": row["created_at_ms"],
        "approvedAtMs": row["approved_at_ms"],
    }
    for key, column in (
        ("displayName", "display_name"),
        ("operatorLabel", "operator_label"),
        ("
```

### Core Architecture Module: `src/commands/internal/dns/fix-coredns.ts`
```
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Args } from "@oclif/core";
import { NemoClawCommand } from "../../../lib/cli/nemoclaw-oclif-command";

import { runFixCoreDns } from "../../../lib/actions/dns";

export default class InternalDnsFixCoreDnsCommand extends NemoClawCommand {
  static hidden = true;
  static strict = true;
  static summary = "Internal: patch CoreDNS for local gateway DNS";
  static description = "Patch CoreDNS to use a non-loopback upstream resolver.";
  static usage = ["internal dns fix-coredns [gateway-name]"];
  static examples = ["<%= config.bin %> internal dns fix-coredns nemoclaw"];
  static args = {
    gatewayName: Args.string({ description: "OpenShell gateway name", required: false }),
  };
  static flags = {};

  public async run(): Promise<void> {
    const { args } = await this.parse(InternalDnsFixCoreDnsCommand);
    const result = runFixCoreDns({ gatewayName: args.gatewayName });
    this.applyExitResult(result);
  }
}

```

### Core Architecture Module: `src/lib/actions/lifecycle/observe-hermes.ts`
```
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type {
  OpenShellHermesAgentHealthEvidence,
  OpenShellHermesAgentObservation,
  OpenShellHermesAgentObserver,
} from "../../adapters/openshell/hermes-agent-observer";
import {
  NEMOCLAW_LIFECYCLE_API_VERSION,
  type HermesLifecycleObservation,
  type HermesLifecycleObserveRequest,
  type HermesLifecycleReadiness,
  type HermesLifecycleSandboxPhase,
  type LifecycleCapabilityFailureReason,
  type LifecycleRequestField,
  type LifecycleResult,
  type LifecycleVerificationField,
} from "../../domain/lifecycle/contract";
import { HERMES_LIFECYCLE_DEFINITION } from "../../domain/lifecycle/hermes-definition";
import { planHermesLifecycle } from "../../domain/lifecycle/hermes-plan";

type UnknownRecord = Record<string, unknown>;

const OBSERVE_REQUEST_KEYS = new Set(["plan", "timeoutMs"]);
const CAPABILITY_FAILURE_REASONS = new Set<LifecycleCapabilityFailureReason>([
  "authentication",
  "command",
  "schema",
  "timeout",
  "transport",
]);
const READY_PHASES = new Set<HermesLifecycleSandboxPhase>(["Ready", "Running"]);
const TERMINAL_PHASES = new Set<HermesLifecycleSandboxPhase>([
  "CrashLoopBackOff",
  "Error",
  "Evicted",
  "Failed",
  "ImagePullBackOff",
  "Unknown",
]);
const KNOWN_PHASES = new Set<HermesLifecycleSandboxPhase>([
  ...READY_PHASES,
  ...TERMINAL_PHASES,
  "Creating",
  "Deleting",
  "NotReady",
  "Pending",
  "Provisioning",
  "Terminating",
  null,
]);
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

function isRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function invalid(field: LifecycleRequestField): LifecycleResult<never> {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: "invalid-request",
      field,
      message: `Invalid lifecycle request field: ${field}.`,
    }),
  });
}

function capabilityFailure(reason: LifecycleCapabilityFailureReason): LifecycleResult<never> {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: "capability-failure",
      reason,
      message: `OpenShell agent observation failed: ${reason}.`,
    }),
  });
}

function verificationFailure(field: LifecycleVerificationField): LifecycleResult<never> {
  return Object.freeze({
    ok: false,
    error: Object.freeze({
      code: "verification-failed",
      field,
      message: `Hermes lifecycle verification failed: ${field}.`,
    }),
  });
}

function isDigest(value: unknown): value is `sha256:${string}` {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function isCapabilityFailureReason(value: unknown): value is LifecycleCapabilityFailureReason {
  return (
    typeof value === "string" &&
    CAPABILITY_FAILURE_REASONS.has(value as LifecycleCapabilityFailureReason)
  );
}

function isSandboxPhase(value: unknown): value is HermesLifecycleSandboxPhase {
  return KNOWN_PHASES.has(value as HermesLifecycleSandboxPhase);
}

function normalizeObservation(value: unknown): OpenShellHermesAgentObservation | null {
  if (!isRecord(value)) return null;
  const state = value.state;
  if (state === "missing") return Object.freeze({ state });
  if (state !== "present") return null;

  const observedTarget = value.target;
  const observedSandbox = value.sandbox;
  const observedAgent = value.agent;
  if (!isRecord(observedTarget) || !isRecord(observedSandbox) || !isRecord(observedAgent)) {
    return null;
  }
  const gatewayIdentity = observedTarget.gatewayIdentity;
  const workspace = observedTarget.workspace;
  const openshellVersion = observedTarget.openshellVersion;
  const sandboxName = observedSandbox.name;
  const resourceIdentity = observedSandbox.resourceIdentity;
  const imageDigest = observedSandbox.imageDigest;
  const phase = observedSandbox.phase;
  const agentName = observedAgent.name;
  const agentVersion = observedAgent.version;
  const configurationFingerprint = observedAgent.configurationFingerprint;
  const health = observedAgent.health;
  if (
    !isDigest(gatewayIdentity) ||
    typeof workspace !== "string" ||
    typeof openshellVersion !== "string" ||
    typeof sandboxName !== "string" ||
    !isDigest(resourceIdentity) ||
    !isDigest(imageDigest) ||
    !isSandboxPhase(phase) ||
    typeof agentName !== "string" ||
    typeof agentVersion !== "string" ||
    !isDigest(configurationFingerprint) ||
    !isRecord(health)
  ) {
    return null;
  }
  const healthState = health.state;
  let healthEvidence: OpenShellHermesAgentHealthEvidence | null = null;
  if (healthState === "unreachable") {
    healthEvidence = Object.freeze({ state: healthState });
  } else if (healthState === "reachable") {
    const statusCode = health.statusCode;
    if (
      typeof statusCode === "number" &&
      Number.isInteger(statusCode) &&
      statusCode >= 100 &&
      statusCode <= 599
    ) {
      healthEvidence = Object.freeze({ state: healthState, statusCode });
    }
  }
  if (healthEvidence === null) return null;

  return Object.freeze({
    state,
    target: Object.freeze({ gatewayIdentity, workspace, openshellVersion }),
    sandbox: Object.freeze({ name: sandboxName, resourceIdentity, imageDigest, phase }),
    agent: Object.freeze({
      name: agentName,
      version: agentVersion,
      configurationFingerprint,
      health: healthEvidence,
    }),
  });
}

function sandboxReadinessForPhase(phase: HermesLifecycleSandboxPhase): HermesLifecycleReadiness {
  if (READY_PHASES.has(phase)) return "ready";
  if (TERMINAL_PHASES.has(phase)) return "terminal";
  return "not_ready";
}

function verifyObservation(
  expected: ReturnType<typeof planHermesLifecycle> & { ok: true },
  observed: OpenShellHermesAgentObservation,
): LifecycleResult<HermesLifecycleObservation> {
  const plan = expected.value;
  if (observed.state === "missing") {
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        apiVersion: NEMOCLAW_LIFECYCLE_API_VERSION,
        state: "missing",
        target: plan.target,
        sandbox: Object.freeze({
          name: plan.sandbox.name,
          resourceIdentity: plan.sandbox.resourceIdentity,
        }),
        readiness: "not_ready",
      }),
    });
  }
  const comparisons: readonly [LifecycleVerificationField, string, string][] = [
    ["target.gatewayIdentity", observed.target.gatewayIdentity, plan.target.gatewayIdentity],
    ["target.workspace", observed.target.workspace, plan.target.workspace],
    ["target.openshellVersion", observed.target.openshellVersion, plan.target.openshellVersion],
    ["sandbox.name", observed.sandbox.name, plan.sandbox.name],
    ["sandbox.resourceIdentity", observed.sandbox.resourceIdentity, plan.sandbox.resourceIdentity],
    ["sandbox.imageDigest", observed.sandbox.imageDigest, plan.sandbox.imageDigest],
    ["agent.name", observed.agent.name, plan.agent.name],
    ["agent.version", observed.agent.version, plan.agent.version],
    [
      "agent.configurationFingerprint",
      observed.agent.configurationFingerprint,
      plan.sandbox.configurationFingerprint,
    ],
  ];
  for (const [field, actual, wanted] of comparisons) {
    if (actual !== wanted) return verificationFailure(field);
  }

  const sandboxReadiness = sandboxReadinessForPhase(observed.sandbox.phase);
  const agentReadiness =
    observed.agent.health.state === "reachable" && observed.agent.health.statusCode === 200
      ? "ready"
      : "not_ready";
  const readiness =
    sandboxReadiness === "terminal"
      ? "terminal"
      : sandboxReadiness === "ready" && agentReadiness === "ready"
        ? "ready"
        : "not_ready";
  const value = Object.freeze({
    apiVersion: NEMOCLAW_LIFECYCLE_API_VERSION,
    state: "present" as const,
    agent: Object.freeze({
      name: HERMES_LIFECYCLE_DEFINITION.agent,
      version: HERMES_LIFECYCLE_DEFINITION.agentVersion,
      readiness: agentReadiness,
    }),
    target: plan.target,
    sandbox: Object.freeze({
      ...plan.sandbox,
      phase: observed.sandbox.phase,
      readiness: sandboxReadiness,
    }),
    readiness,
  });
  return Object.freeze({ ok: true, value });
}

/** Observe one recorded Hermes resource without retries or lifecycle effects. */
export async function observeHermesLifecycle(
  request: HermesLifecycleObserveRequest,
  capability: OpenShellHermesAgentObserver,
): Promise<LifecycleResult<HermesLifecycleObservation>> {
  let planned: Extract<ReturnType<typeof planHermesLifecycle>, { ok: true }>;
  let timeoutMs: number | undefined;
  try {
    if (!isRecord(request) || !Object.keys(request).every((key) => OBSERVE_REQUEST_KEYS.has(key))) {
      return invalid("request");
    }
    const candidate = planHermesLifecycle(request.plan);
    if (!candidate.ok) return candidate;
    timeoutMs = request.timeoutMs;
    if (
      timeoutMs !== undefined &&
      (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000)
    ) {
      return invalid("timeoutMs");
    }
    planned = candidate;
  } catch {
    return invalid("request");
  }
  if ((typeof capability !== "object" || capability === null) && typeof capability !== "function") {
    return invalid("capability");
  }

  try {
    const observeHermesAgent = capability.observeHermesAgent;
    if (typeof observeHermesAgent !== "function") return invalid("capability");
    const response: unknown = await observeHermesAgent.call(
      capability,
      Object.freeze({
        target: planned.value.target,
        sandboxName: planned.value.sandbox.name,
        resourceIdentity: planned.value.sandbox.resourceIdentity,
        ...(timeoutMs === undefined ? {} : { timeoutMs }),
      }),
    );
    if (!isRecord(response)) {
      return capabilityFailure("schema");
    }
    const respon
```

### Core Architecture Module: `src/lib/actions/sandbox/doctor-lifecycle-registration.ts`
```
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  collectLifecycleRegistrationIssues,
  type LifecycleRegistrationIssue,
} from "../../domain/lifecycle-registration";
import { inspectPortableRuntimeReceiptReadiness } from "../../onboard/experimental/portable-runtime-receipt-readiness";
import type { SandboxEntry } from "../../state/registry";
import type { DoctorCheck } from "./doctor-report";

function uniqueOrdered<T extends string>(values: readonly T[]): T[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function formatFieldList(
  issues: readonly LifecycleRegistrationIssue[],
  reason: LifecycleRegistrationIssue["reason"],
): string {
  return uniqueOrdered(
    issues.filter((issue) => issue.reason === reason).map((issue) => issue.field),
  )
    .sort()
    .join(", ");
}

export function buildPortableRuntimeCheck(sandboxName: string): DoctorCheck | null {
  const portable = inspectPortableRuntimeReceiptReadiness(sandboxName);
  if (!portable) return null;
  const recordedSocket =
    !portable.ok && portable.socketPath ? ` Recorded socket: ${portable.socketPath}.` : "";
  const recoveryHint =
    !portable.ok && !portable.socketPath
      ? portable.recovery === "current-user-authority"
        ? "run NemoClaw as the user who created the portable state, or rerun portable onboarding as the current user"
        : "rerun portable onboarding with `nemoclaw onboard --experimental-profile portable`, then retry"
      : "repair the recorded current-user Podman endpoint, then retry";
  return portable.ok
    ? {
        group: "Host",
        label: "Portable Podman API",
        status: "ok",
        detail: `server ${portable.serverVersion}; ${portable.timing.mode}; activation ${String(portable.timing.activationMs)} ms; API ${String(portable.timing.apiMs)} ms; total ${String(portable.timing.totalMs)} ms`,
      }
    : {
        group: "Host",
        label: "Portable Podman API",
        status: "fail",
        detail: `${portable.stage}: ${portable.detail}${recordedSocket}`,
        hint: recoveryHint,
      };
}

export function buildLifecycleRegistrationCheck(
  sandboxName: string,
  entry: SandboxEntry,
  cliName: string,
  options: { dashboardPortRequired?: boolean } = {},
): DoctorCheck {
  const issues = collectLifecycleRegistrationIssues(entry, {
    dashboardPortRequired: options.dashboardPortRequired !== false,
  });
  if (issues.length === 0) {
    return {
      group: "Sandbox",
      label: "Lifecycle registration",
      status: "ok",
      detail: "registry entry has lifecycle metadata for rebuild, upgrade, recovery, and reboot",
    };
  }

  const affectedOperations = uniqueOrdered(issues.flatMap((issue) => issue.operations)).sort();
  const missingFields = formatFieldList(issues, "missing");
  const invalidFields = formatFieldList(issues, "invalid");
  const fieldParts = [
    missingFields ? `missing ${missingFields}` : null,
    invalidFields ? `invalid ${invalidFields}` : null,
  ].filter((part): part is string => part !== null);

  return {
    group: "Sandbox",
    label: "Lifecycle registration",
    status: "warn",
    detail: `registry entry incomplete for lifecycle operations (${fieldParts.join("; ")}; affected: ${affectedOperations.join(", ")})`,
    hint: `re-register or re-onboard '${sandboxName}' before running lifecycle commands such as \`${cliName} ${sandboxName} rebuild\``,
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #12440** (2026-09-29): **Filesystem policy check no longer covers per-harness runtime directories**
  *Symptoms*: ### Investigation Summary  - `docs/sandbox-network.md:41` says plan and apply check that explicit filesystem policies allow `/app` for OpenClaw, `/opt/hermes` for Hermes, and `/opt/fabric-source` for Pi. - `runtime_read_requirements` (`crates/nemoclaw-sdk/src/openshell/agent.rs:9`), used by `crates/nemoclaw-sdk/src/config/network.rs:358`, checks only `/opt/fabric` and `/opt/nemoclaw`. - `explicit_filesystem_policy_must_allow_the_selected_runtime` in `crates/nemoclaw-sdk/tests/network_config.rs` asserts only those two paths. - The per-harness check disappeared in `ee9c19908` (`refactor(fabric): delegate native discovery and configuration to Fabric`) when harness identifiers became opaque. - Inferred, not reproduced live: a Hermes policy without `/opt/hermes` passes plan and fails at sandbox startup.  ### Description  Documented validation no longer runs, so an explicit policy that blocks a harness's runtime directory can pass planning.  Expected: the image build records each adapter's required read paths in the catalog label, and the existing check in `fabric_capabilities::assess_fabric`, which compares descriptor `requirements.files` with filesystem grants, enforces them. Until then, the page states only the checks that run.  ### Reproduction Steps  Run from a NemoClaw checkout at `515fad88f`.  1. Show the documented check:     ```sh    sed -n '41p' docs/sandbox-network.md    ```  2. Show the checked paths:     ```sh    sed -n '7,14p' crates/nemoclaw-sdk/src/openshell/agent.r
  **Post-Mortem & Fix Analysis**:
  > Resolved on `v1` by [#12450 / 28954317a7](https://github.com/NVIDIA/NemoClaw/commit/28954317a7), with installed-image qualification added in [623db4ef0f](https://github.com/NVIDIA/NemoClaw/commit/623db4ef0fec82bb640f9801e049a3d26b9a945b).  The image now records adapter-specific directories in `/opt/nemoclaw/runtime-files.json` and exposes them as `runtime_files` in its catalog label: `/app` for OpenClaw, `/opt/hermes` for Hermes, and `/opt/fabric-source` for Pi. Fabric's descriptors remain unchanged.  During planning, the SDK checks those declarations against explicit filesystem grants and reports the missing directory. It does not add grants automatically. Image tests also verify that each declared directory exists and is readable and searchable by the runtime user.  Closing as completed. Planner regression tests, all ten ARM64 installed-image suites, and [image CI](https://github.com/NVIDIA/NemoClaw/actions/runs/36542293986) passed. Older images without `runtime_files` retain their p

- **Issue #12010** (2026-09-19): **[macOS][Onboard] Docker receipt transfer rejects seed user 0:0 on Engine 27**
  *Symptoms*: ## Investigation Summary  - A macOS onboarding attempt reaches sandbox phase `Ready`, and the patched container remains running, before receipt transfer fails. - Current `main` at `b6934c6300c4e1e175757e9281ae3a641d9a5b1f` creates the receipt seed with `--user 0:0`, then runs `docker cp -a`. - Docker Engine 27 and earlier can treat `0:0` as one user name during archive copy and fail with `getent unable to find entry "0:0" in passwd`. - PR #10534 introduced this path in v0.0.117 to fix the host bind-mount failure from #10348. - The reported Docker server version and full debug bundle remain unknown. Engine 27 boundary verification is required.  ## Description  On macOS, onboarding can create a Ready sandbox and running patched container, then fail while NemoClaw transfers the protected managed-startup receipt into a Docker-managed volume.  The failure is:  `Could not transfer managed-startup receipt to Docker: Error response from daemon: getent unable to find entry "0:0" in passwd`  NemoClaw then reports that the Docker GPU patch did not complete. It preserves the sandbox and recovery record because automatic cleanup is not safe.  This is related to, but not a duplicate of, #10348 or #10768. Those issues cover the old host-path bind mount. PR #10534 replaced that path with a Docker-managed volume and seed container. The replacement creates the seed with `--user 0:0` before `docker cp -a`, which exposes an archive-copy compatibility defect on Docker Engine 27 and earlier.  ## R
  **Post-Mortem & Fix Analysis**:
  > RETRACTED: Do not recommend `v0.0.113` as a customer rollback.  The earlier comment validated the image build but did not validate the historical installer and Homebrew lifecycle path. Exact follow-up found an internal pin mismatch in `v0.0.113`: `scripts/install-openshell.sh` installs the OpenShell `v0.0.106` formula (`f0f86519...`), while `docker-driver-gateway-service.ts` still authorizes the `v0.0.101` formula (`87fadc7b...`). Onboarding therefore rejects the formula with the reported pinned-checksum/temporary-trust error.  No rollback tag is endorsed by this comment. A replacement recommendation requires the exact pinned installer, Homebrew trust operation, stock image build, and onboarding path to pass on macOS with Colima.

- **Issue #11557** (2026-09-11): **Reuse exact-owned Hermes forwards during onboarding and resume (PR #11427)**
  *Symptoms*: Parent epic: #11573  ## Delivered outcome  Repeated Hermes onboarding and resume retain verified dashboard and API forwards on their registered ports. Missing forwards are restored; sibling reservations, foreign listeners, changed identity, and unsafe ownership fail closed.  ## Pull request  - Merged PR: #11427 - Merge commit: [`b40cc623d`](https://github.com/NVIDIA/NemoClaw/commit/b40cc623d0db0d1fa44959ccb54b9f08e4f5bfd5)  ## Relationship to the Portable candidate  Candidate commit [`30ef9ec7a`](https://github.com/NVIDIA/NemoClaw/commit/30ef9ec7a198270b9524ddaa8c4d0aef9b0da918) independently addressed the occupied-forward failure found in the seat cycle. It is not an ancestor of current `main`; #11427 delivered the reviewed, broader implementation and is the source of truth.  Status: delivered to `main` by #11427. 
  **Post-Mortem & Fix Analysis**:
  > Delivered to main by #11427. The independent candidate commit is retained in the issue for investigation history but is superseded for upstream delivery.

- **Issue #11198** (2026-09-08): **[Flaky test] sandbox readiness first-observation timeout asserts an exact 6000 ms against the real clock**
  *Symptoms*: ## Description  `src/lib/onboard/sandbox-readiness-tracing.test.ts` asserts an exact millisecond value for the first adaptive observation timeout, but reads the real clock to compute it. On a loaded CI runner the value comes back one millisecond low and the shard fails.  The test is otherwise fully deterministic — the observer is replayed and `sleep` is mocked — so this is the only real-time dependency in it.  ## Evidence  Observed on `cli-test-shards (6)` (PR #10261, run `34180924830`):  ``` AssertionError: expected 5999 to be 6000 // Object.is equality ```  The same test file passed 5/5 consecutive local runs on the same commit, and the PR's diff at the time touched a single unrelated import in `src/lib/actions/inference-get.ts`. A rerun of the shard passed with no code change.  The assertion is `src/lib/onboard/sandbox-readiness-tracing.test.ts:93`:  ```ts expect(observationTimeouts[0]).toBe(6_000); ```  ## Root cause  `createSandboxReadyWaiter` is constructed in that test without a `now` dependency, so the readiness budget falls back to the real clock:  - `src/lib/onboard/readiness-wait.ts:46-47` — `const sourceNow = options.now ?? Date.now; const startedAt = sourceNow();` - `src/lib/onboard/readiness-wait.ts:79` — `deadlineMs: startedAt + budgetMs` - `src/lib/onboard/sandbox-readiness-tracing.ts:154-156` — each observation timeout is `Math.max(1, Math.floor(deadlineMs - now()))`  So the first observation only receives the full `6000` when strictly less than 1 ms of wall-

- **Issue #11108** (2026-09-07): **Hermes lifecycle supervision must not gate relaunch on Hermes-owned mutable configuration**
  *Symptoms*: ## Problem  NemoClaw lifecycle supervision treats the complete Hermes `config.yaml` and `.env` snapshot as relaunch authorization. Hermes owns mutable configuration and persists normal runtime decisions there. A valid Hermes mutation can therefore become a config-hash or MCP-integrity refusal. The supervisor can then stop relaunch and require a sandbox rebuild even when Hermes is behaving normally.  This couples process supervision to agent configuration ownership. The OpenShell-managed topology cannot establish configuration provenance because the supervisor, gateway, and agent share one UID. The direct-root topology has a root-owned hash, but applying it to the complete mutable Hermes config prevents Hermes-owned changes from surviving lifecycle operations.  ## Maintainer Decision  **Decision: Accept.**  - **Reason:** NemoClaw must have no opinion about valid config changes that Hermes invokes inside its sandbox. - **Placement:** Keep process identity, health, crash-loop, path-safety, and secret-boundary controls in the supervisor. Move managed MCP reconciliation to the host command that owns that managed operation. Remove complete-config and managed-MCP equality as relaunch authorization conditions. - **Accountable maintainer:** `@ericksoa`. - **Validation plan:** Focused guard and supervisor tests must cover Hermes config adoption, host-side managed MCP mismatch reporting, secret refusal, path/race refusal, and process crash-loop quarantine.  ## Desired Behavior  - A vali

- **Issue #10962** (2026-09-09): **[N1x WSL2][Onboard] Express install falls back to Ollama qwen3.5:9b on non-retail N1x hardware — Win32_ComputerSystem.Model check too narrow**
  *Symptoms*: ## Description  Follow-up to #10102 (closed). The fix in PR #10742 added N1x WSL llama.cpp profile selection, but the product identity check `(Get-CimInstance Win32_ComputerSystem).Model` only matches `"RTX Spark N1X"`. Non-retail N1x hardware (OEM engineering samples, pre-production units) returns OEM-internal model codes that don't match, causing fallback to Ollama with `qwen3.5:9b`.  Additionally, even when falling back to Ollama, the default model is `qwen3.5:9b` (9B) instead of `qwen3.6:35b`. A 64 GB-VRAM N1x can easily run the 35B model. The Ollama fallback path should select the larger model when VRAM >= 48 GB.  Two issues: 1. `express_wsl_can_use_n1x_managed_llama_cpp()` in `install.sh` matches `*"RTX Spark N1X"*` against `Win32_ComputerSystem.Model` — OEM units return codes like `"SKU 1"` or `"83N7"` instead. 2. The Ollama fallback path does not consider available VRAM when selecting the default model size.  Platform scope: Reproduced on N1x WSL2 (WoA) only; other platforms not tested. Regression: No — N1x WSL llama.cpp path is new in v0.0.119 (PR #10742); the Ollama model size issue predates it. OpenShell issue: No  ## Environment  ```text Device:        RTX Spark N1X (Windows on Arm, 64 GB VRAM) OS:            Windows / WSL2 Ubuntu 24.04 Architecture:  aarch64 NemoClaw:      v0.0.119 ```  ## Steps to Reproduce  1. On an N1x WSL2 machine with non-retail hardware (e.g. Dell engineering sample or Lenovo 83N7), run:    ```bash    curl -fsSL https://www.nvidia.com/nemoc
  **Post-Mortem & Fix Analysis**:
  > @ericksoa @wscurran  Since llama.cpp is still a feature under development — we haven't delivered it into NemoClaw yet, and it hasn't gone through full testing. I'd recommend against making it the Express install option for N1x. Using Ollama's 35B model as the Express option would be safer. cc: @JoyceChenNV 
  > Implemented in draft PR #11078. Current source head: `a390e86ab6ab0e0bad0273ef28505e0ff407f39b`.  Current evidence:  - The llama.cpp image failure was caused by Ubuntu Noble removing the old pinned curl/libcurl `8.5.0-2ubuntu10.12` and OpenSSL `3.0.13-0ubuntu3.12` packages. The image now pins the available `8.5.0-2ubuntu10.13` and `3.0.13-0ubuntu3.15` updates consistently across the Dockerfile, declarative image manifest, and exporter. - [Image run 34306482551, attempt 2](https://github.com/NVIDIA/NemoClaw/actions/runs/34306482551) passed at the current head: [amd64](https://github.com/NVIDIA/NemoClaw/actions/runs/34306482551/job/102332750923) in 5m10s and [arm64](https://github.com/NVIDIA/NemoClaw/actions/runs/34306482551/job/102332750882) in 1m52s, including CUDA compilation, `llama-server --version`, image identity, non-root entrypoint, required paths, and forbidden shell/UI paths. - [Self-hosted run 34306492330, attempt 2](https://github.com/NVIDIA/NemoClaw/actions/runs/34306492330
  > Review cleanup is published in PR #11078 at `583ed682be0c8264462065fe492fa098583210b0`. The branch is mergeable, all four previously unresolved CodeRabbit findings are repaired, and exact-head automated checks are running.  @hulynn @JoyceChenNV — the remaining ship gate is a physical ARM64 Windows WSL N1x run against this exact commit. Please attach redacted evidence for these checks:  - the normalized GPU identity is `NVIDIA RTX Spark N1X` or `NVIDIA RTX Spark N1X (6144-core Blackwell RTX GPU)`; - Docker uses the local `default` context, Docker Desktop GPU passthrough succeeds, and Docker/GPU memory meets the 48,000 MiB floor; - with no requested or recorded provider and no `NEMOCLAW_MODEL`, Windows Express selects `llama-cpp.qwen3-6-35b-a3b.n1x-wsl.v1`; - managed install reaches authenticated host and `inference.local` or agent inference with Qwen 3.6 35B-A3B; - the runtime publishes no host port; and - public destroy plus provider/runtime cleanup completes without residual resources

- **Issue #10940** (2026-09-09): **[DGX Station][Install] Express install never reaches local vLLM readiness for Nemotron 3 Ultra**
  *Symptoms*: ## Description  DGX Station express setup downloads the Nemotron 3 Ultra local model, starts the managed vLLM container, and then waits until the vLLM readiness window expires without the API becoming ready. The same failure reproduced in a clean targeted sanity rerun for NemoClaw v0.0.119.  Platform scope: Reproduced on DGX Station only; other platforms not tested for this local-vLLM Station express path. Regression: Unknown — earlier versions not re-tested in the same clean environment. OpenShell issue: No  ## Environment  ```text Device:        DGX Station OS:            Linux Architecture:  x86_64 Node.js:       Not captured npm:           Not captured Docker:        Available; preflight passed and Docker daemon was reachable OpenShell CLI: Not captured NemoClaw:      v0.0.119 OpenClaw:      N/A (express setup did not complete successfully) ```  ## Steps to Reproduce  1. On a clean DGX Station test host, install NemoClaw v0.0.119. 2. Run the DGX Station express setup flow for the OpenClaw agent using the Nemotron 3 Ultra local vLLM path. 3. Wait for the managed vLLM startup/readiness phase to finish.  ## Expected Result  The managed vLLM service should become API-ready within the documented setup window, and express setup should complete with a registered, usable local inference route.  ## Actual Result  The model download completes and the managed vLLM container is started, but the vLLM API never becomes ready. The installer repeatedly reports that it is still waiting fo
  **Post-Mortem & Fix Analysis**:
  > I reproduced the source-level launch path for v0.0.119/current main and cannot safely select a fix from the captured wait-loop output alone. The Station recipe pins vLLM v0.22.0 and passes `--kernel-config {"enable_flashinfer_autotune":false}`; that upstream release honors the setting and should log `Skipping FlashInfer autotune because it is disabled.` The related hardware report #10108 instead stops at `Autotuning process starts`, so the distinction is material. The reported `x86_64` architecture also conflicts with the shipped single-Station GB300 recipe, which is qualified for arm64.  The failed install stops but does not remove `nemoclaw-vllm`. Could you attach the redacted output of these read-only commands from that same failed host?  ```bash uname -m nvidia-smi --query-gpu=name --format=csv,noheader docker inspect nemoclaw-vllm --format "image={{.Image}} cmd={{json .Config.Cmd}}" docker logs --tail 200 nemoclaw-vllm ```  Please redact any unexpected credentials or private paths
  > Closing as not reproduced on v0.0.121 on the tested DGX Station GB300.  Retested on September 9, 2026, using the Express installer explicitly pinned to `v0.0.121`, commit `673f815e04c1a4ad0548fac63b5f25cf22d47e47`.  The run downloaded the approximately 352 GB Nemotron 3 Ultra model again and launched a new managed vLLM container. The Docker image was already cached: ```text vllm/vllm-openai@sha256:0fec7ec5f3e6bc168e54899935fb0557da908a4832a1dbc88e2debcf2f889416 ```  Observed startup milestones, all UTC: ```text 09:45:00  Container started. 09:57:24  Skipping FlashInfer autotune because it is disabled. 09:58:33  Graph capturing finished in 69 secs. 09:58:40  Application startup complete. ```  API startup completed approximately 13 minutes 40 seconds after container start, within the one-hour readiness window.  The installer then configured the inference route, created the OpenClaw sandbox, and completed onboarding. OpenClaw returned a response to `hello` through the configured Ultra rou

- **Issue #10903** (2026-09-04): **Upgrade recovery forces local Hermes base rebuild when legacy managed sandbox lacks resolution metadata**
  *Symptoms*: ## Description  A supported installer upgrade from the stock `lkg` Hermes path at v0.0.109 to v0.0.118 attempted to recover an existing managed sandbox. The release already publishes and pins an exact validated Hermes base image, but recovery forced a local `agents/hermes/Dockerfile.base` build because the existing sandbox image did not yield a reusable base-image resolution hint.  That local build introduced avoidable source-network dependencies. In the observed run, APT completed and the native security builder then exhausted all six `curl` attempts while fetching the checksum-pinned libssh2 source from `https://libssh2.org/download/libssh2-1.11.1.tar.xz`:  ```text Rebuilding Hermes Agent base image... ... curl: (35) Recv failure: Connection reset by peer (repeated for all retry attempts) ... Rebuild preflight failed: agent base image could not be built. Sandbox is untouched — no data was lost. Failed to recover 'clawgilly': Failed to build Hermes Agent base image (exit 1) ```  The transport reset may be host/network-specific. The NemoClaw defect is that a qualified managed release upgrade entered a network-dependent local compilation path even though the release's immutable published Hermes base was available.  The original sandbox remained intact because failure occurred during rebuild preflight. The v0.0.118 CLI installation completed, but automatic sandbox recovery did not.  ### Expected behavior  For a sandbox that the upgrade preflight positively qualifies as NemoClaw

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

### Incident Patch 1: `e3e5a066` (2026-10-06)
**Commit Message**: fix(onboard): check portable registry before image build (#11874)

Check the managed Portable registry before building the sandbox image, so an unreachable registry fails promptly instead of after a complete build. Use the IPv4 endpoint consistently and preserve older localhost image references through registry mapping and cleanup.

Fixes #11724.

Signed-off-by: latenighthackathon <[REDACTED_EMAIL]>
Signed-off-by: Julie Yaunches <[REDACTED_EMAIL]>
Signed-off-by: Aaron Erickson <[REDACTED_EMAIL]>
Co-authored-by: latenighthackathon <[REDACTED_EMAIL]>
Co-authored-by: Julie Yaunches <[REDACTED_EMAIL]>
Co-authored-by: Aaron Erickson <[REDACTED_EMAIL]>

**File**: `.github/workflows/portable-profile-e2e.yaml` (modified, +1/-0)
```diff
@@ -70,6 +70,7 @@ on:
       - "src/lib/onboard/runtime-provider/podman*.ts"
       - "src/lib/actions/sandbox/destroy*.ts"
       - "src/lib/domain/sandbox/destroy.ts"
+      - "src/lib/domain/sandbox/image-tag.ts"
       - "src/lib/actions/sandbox/probe/hermes-portable-inference-recovery.ts"
       - "src/lib/onboard/experimental/hermes-portable-ollama-*.ts"
       - "src/lib/onboard/runtime-provider/host-local-inference*.ts"
```

**File**: `src/lib/actions/maintenance.test.ts` (modified, +11/-11)
```diff
@@ -1466,17 +1466,19 @@ describe("garbageCollectImages", () => {
     expect(mocks.assertNoHermesPortableHostAuthority).toHaveBeenCalledWith(stateDir, "gc");
   });
 
-  it("surfaces a local-repo orphan while preserving a registered local image (#6301)", async () => {
-    // Local repo holds an orphan (gc-test-orphan-111) plus a still-registered
-    // image (live-222); the gateway repo holds only an in-use image.
+  it.each([
+    "nemoclaw-sandbox-local",
+    "localhost:5000/nemoclaw-sandbox-local",
+    "127.0.0.1:5000/nemoclaw-sandbox-local",
+  ])("surfaces an orphan in %s while preserving a registered image (#6301)", async (imageRepo) => {
     mocks.dockerListImagesFormat.mockImplementation((repo: string) =>
-      repo === "nemoclaw-sandbox-local"
-        ? "nemoclaw-sandbox-local:gc-test-orphan-111\t3GB\nnemoclaw-sandbox-local:live-222\t2GB"
+      repo === imageRepo
+        ? `${imageRepo}:gc-test-orphan-111\t3GB\n${imageRepo}:live-222\t2GB`
         : "openshell/sandbox-from:in-use\t1GB",
     );
     mocks.listSandboxes.mockReturnValue({
       sandboxes: [
-        { imageTag: "nemoclaw-sandbox-local:live-222" },
+        { imageTag: `${imageRepo}:live-222` },
         { imageTag: "openshell/sandbox-from:in-use" },
       ],
       defaultSandbox: null,
@@ -1488,12 +1490,10 @@ describe("garbageCollectImages", () => {
     const out = logSpy.mock.calls.flat().join("\n");
     logSpy.mockRestore();
 
-    // The local orphan is reported, the still-registered local image is not,
-    // and both repos are scanned.
-    expect(out).toContain("nemoclaw-sandbox-local:gc-test-orphan-111");
-    expect(out).not.toContain("nemoclaw-sandbox-local:live-222");
+    expect(out).toContain(`${imageRepo}:gc-test-orphan-111`);
+    expect(out).not.toContain(`${imageRepo}:live-222`);
     const scannedRepos = mocks.dockerListImagesFormat.mock.calls.map((call) => call[0]);
     expect(scannedRepos).toContain("openshell/sandbox-from");
-    expect(scannedRepos).toContain("nemoclaw-sandbox-local");
+    expect(scannedRepos).toContain(imageRepo);
   });
 });
```

**File**: `src/lib/domain/sandbox/image-tag.ts` (modified, +7/-1)
```diff
@@ -8,7 +8,11 @@ export const SANDBOX_FROM_IMAGE_REPO = "openshell/sandbox-from";
  * (Linux, or macOS on Apple Silicon — see isLinuxDockerDriverGatewayEnabled).
  */
 export const LOCAL_SANDBOX_IMAGE_REPO = "nemoclaw-sandbox-local";
-export const PORTABLE_LOCAL_SANDBOX_IMAGE_REPO = "localhost:5000/nemoclaw-sandbox-local";
+// Registry clients and image references must use the same IPv4 loopback authority.
+export const PORTABLE_REGISTRY_HOST = "127.0.0.1";
+export const PORTABLE_REGISTRY_PORT = 5000;
+export const PORTABLE_LOCAL_REGISTRY = `${PORTABLE_REGISTRY_HOST}:${PORTABLE_REGISTRY_PORT}`;
+export const PORTABLE_LOCAL_SANDBOX_IMAGE_REPO = `${PORTABLE_LOCAL_REGISTRY}/${LOCAL_SANDBOX_IMAGE_REPO}`;
 
 /**
  * Every Docker repository that can hold a sandbox image. Any orphan sweep
@@ -21,6 +25,8 @@ export const SANDBOX_IMAGE_REPOS = [
   SANDBOX_FROM_IMAGE_REPO,
   LOCAL_SANDBOX_IMAGE_REPO,
   PORTABLE_LOCAL_SANDBOX_IMAGE_REPO,
+  // Keep images from earlier Portable versions visible to orphan cleanup.
+  `localhost:5000/${LOCAL_SANDBOX_IMAGE_REPO}`,
 ] as const;
 
 const BUILT_SANDBOX_IMAGE_RE = /Built image (openshell\/sandbox-from:\d+)/;
```

**File**: `src/lib/onboard/docker-driver-platform.ts` (modified, +2/-0)
```diff
@@ -23,7 +23,9 @@ export {
   PORTABLE_EXPERIMENTAL_PROFILE,
   PORTABLE_HOST_GATEWAY_IP,
   PORTABLE_LOCAL_REGISTRY,
+  PORTABLE_REGISTRY_HOST,
   PORTABLE_REGISTRY_IP,
+  PORTABLE_REGISTRY_PORT,
   resolveExperimentalOnboardProfile,
 } from "./experimental/portable-profile";
 
```

**File**: `src/lib/onboard/experimental/portable-host-preparation.test.ts` (modified, +1/-1)
```diff
@@ -391,7 +391,7 @@ describe("preparePortableExperimentalHost", () => {
       home,
       ".config/containers/registries.conf.d/99-nemoclaw-portable.conf",
     );
-    expect(fs.readFileSync(registryConfig, "utf-8")).toContain('location = "localhost:5000"');
+    expect(fs.readFileSync(registryConfig, "utf-8")).toContain('prefix = "localhost:5000"');
     expect(fs.statSync(registryConfig).mode & 0o777).toBe(0o600);
     const containersConf = path.join(home, ".config/nemoclaw/portable/containers.conf");
     expect(fs.readFileSync(containersConf, "utf-8")).toContain(
```

**File**: `src/lib/onboard/experimental/portable-host-preparation.ts` (modified, +9/-1)
```diff
@@ -26,7 +26,9 @@ import {
   PORTABLE_DOCKER_NETWORK_SUBNET,
   PORTABLE_HOST_GATEWAY_IP,
   PORTABLE_LOCAL_REGISTRY,
+  PORTABLE_REGISTRY_HOST,
   PORTABLE_REGISTRY_IP,
+  PORTABLE_REGISTRY_PORT,
   resolveDockerDriverNetworkName,
 } from "../docker-driver-platform";
 import {
@@ -68,9 +70,15 @@ const REGISTRY_IMAGE =
   "docker.io/library/registry:2@sha256:a3d8aaa63ed8681a604f1dea0aa03f100d5895b6a58ace528858a7b332415373";
 const HOST_COMMAND_TIMEOUT_MS = 30_000;
 const REGISTRY_COMMAND_TIMEOUT_MS = 300_000;
+// Stored image references can retain localhost; resolve them through the same IPv4 listener.
 const REGISTRY_FRAGMENT = `[[registry]]
 location = "${PORTABLE_LOCAL_REGISTRY}"
 insecure = true
+
+[[registry]]
+prefix = "localhost:5000"
+location = "${PORTABLE_LOCAL_REGISTRY}"
+insecure = true
 `;
 const PORTABLE_CONTAINERS_CONF = `[network]
 default_rootless_network_cmd = "pasta"
@@ -755,7 +763,7 @@ function ensureRegistryContainer(
         "--ip",
         PORTABLE_REGISTRY_IP,
         "-p",
-        "127.0.0.1:5000:5000",
+        `${PORTABLE_REGISTRY_HOST}:${PORTABLE_REGISTRY_PORT}:5000`,
         "--restart=always",
         REGISTRY_IMAGE,
       ],
```

**File**: `src/lib/onboard/experimental/portable-profile.ts` (modified, +6/-1)
```diff
@@ -3,6 +3,12 @@
 
 import { DEFAULT_DOCKER_DRIVER_NETWORK_NAME } from "./docker-network-authority";
 
+export {
+  PORTABLE_LOCAL_REGISTRY,
+  PORTABLE_REGISTRY_HOST,
+  PORTABLE_REGISTRY_PORT,
+} from "../../domain/sandbox/image-tag";
+
 export const EXPERIMENTAL_PROFILE_ENV = "NEMOCLAW_EXPERIMENTAL_PROFILE";
 export const PORTABLE_EXPERIMENTAL_PROFILE = "portable";
 export const PORTABLE_ARCHITECTURE = Object.freeze({
@@ -19,7 +25,6 @@ export const PORTABLE_HOST_GATEWAY_IP = "169.254.2.2";
 export const PORTABLE_REGISTRY_IP = "10.87.0.3";
 export const PORTABLE_DOCKER_NETWORK_NAME = DEFAULT_DOCKER_DRIVER_NETWORK_NAME;
 export const PORTABLE_DOCKER_NETWORK_SUBNET = "10.87.0.0/24";
-export const PORTABLE_LOCAL_REGISTRY = "localhost:5000";
 
 export type ExperimentalOnboardProfile = typeof PORTABLE_EXPERIMENTAL_PROFILE;
 
```

**File**: `src/lib/onboard/sandbox-create-launch.test.ts` (modified, +5/-1)
```diff
@@ -32,6 +32,7 @@ function createTrustedBuildContext(): string {
 }
 
 afterEach(() => {
+  vi.restoreAllMocks();
   for (const buildCtx of temporaryBuildContexts.splice(0)) {
     fs.rmSync(buildCtx, { recursive: true, force: true });
   }
@@ -789,6 +790,8 @@ describe("prepareSandboxCreateLaunchWithPrebuild", () => {
   });
 
   it("preserves the rootless gateway path for a generated portable Hermes image", async () => {
+    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
+    const buildImage = vi.fn().mockResolvedValue(1);
     const buildCtx = createTrustedBuildContext();
     const dockerfile = path.join(buildCtx, "Dockerfile");
     const result = await prepareSandboxCreateLaunchWithPrebuild({
@@ -812,7 +815,7 @@ describe("prepareSandboxCreateLaunchWithPrebuild", () => {
           NEMOCLAW_EXPERIMENTAL_PROFILE: "portable",
           NEMOCLAW_SANDBOX_PREBUILD: "1",
         },
-        buildImage: async () => 1,
+        buildImage,
         log: vi.fn(),
         origin: "generated",
       },
@@ -823,5 +826,6 @@ describe("prepareSandboxCreateLaunchWithPrebuild", () => {
       imageRef: null,
       imageId: null,
     });
+    expect(buildImage).toHaveBeenCalledOnce();
   });
 });
```

---

### Incident Patch 2: `a5365ad6` (2026-10-05)
**Commit Message**: fix(policy): classify DCode's observability preset by provenance (#12635)

Label DCode's automatically added observability preset as agent-sourced in policy list. Preserve the original contributor's implementation from #11869, with import formatting applied on top.

Fixes #11868.

Signed-off-by: Udaya Tejas <[REDACTED_EMAIL]>
Signed-off-by: Aaron Erickson <[REDACTED_EMAIL]>
Co-authored-by: Udaya Tejas <[REDACTED_EMAIL]>

**File**: `src/lib/policy/preset-provenance.test.ts` (modified, +8/-0)
```diff
@@ -19,6 +19,14 @@ describe("live preset provenance", () => {
       source: "agent",
       agent: "hermes",
     });
+    expect(
+      classifyPresetProvenance("observability-otlp-local", {
+        agentName: "langchain-deepagents-code",
+      }),
+    ).toEqual({
+      source: "agent",
+      agent: "dcode",
+    });
   });
 
   it("labels every other live preset as operator-added", () => {
```

**File**: `src/lib/policy/preset-provenance.ts` (modified, +8/-1)
```diff
@@ -2,10 +2,14 @@
 // SPDX-License-Identifier: Apache-2.0
 
 import { HERMES_TOOL_GATEWAY_PRESET_NAMES } from "../onboard/hermes-managed-tools";
+import {
+  DCODE_AGENT_NAME,
+  DCODE_ONLY_POLICY_PRESETS,
+} from "../onboard/observability-policy-presets";
 import { OPENCLAW_ONLY_POLICY_PRESETS } from "../onboard/openclaw-otel-policy-presets";
 
 export type PresetProvenance =
-  | { source: "agent"; agent: "openclaw" | "hermes" }
+  | { source: "agent"; agent: "openclaw" | "hermes" | "dcode" }
   | { source: "user" };
 
 export interface PresetProvenanceContext {
@@ -33,6 +37,9 @@ export function classifyPresetProvenance(
   if (agentName === "hermes" && HERMES_TOOL_GATEWAY_PRESET_NAMES.has(name)) {
     return { source: "agent", agent: "hermes" };
   }
+  if (agentName === DCODE_AGENT_NAME && DCODE_ONLY_POLICY_PRESETS.has(name)) {
+    return { source: "agent", agent: "dcode" };
+  }
   return { source: "user" };
 }
 
```

---

### Incident Patch 3: `04e99d3c` (2026-10-05)
**Commit Message**: fix(inference): load 64 GB Spark weights lazily (#12633)

## Outcome

The 64 GB Spark recipe now completes local model startup using lazy
safetensors loading. A physical 64 GB Spark passed automatic onboarding,
local chat, and read, write, and exec tool calls, including after a
restart.

## Reason

The original fastsafetensors recipe stalled during startup on this host,
with repeated `NV_ERR_NO_MEMORY` kernel errors. Available host memory
fell to about 19 MB, and the operator stopped the container before it
became ready. Docker reported `OOMKilled: false`.

The loader change resolved this failure in the tested configuration. The
precise source of the previous allocation pressure remains unproven.

### Related issues

Refs #12502

## Changes

- Use `--load-format safetensors --safetensors-load-strategy lazy` in
the existing 64 GB Spark recipe.
- Assert those arguments for automatic, picker, and resume installation
paths.
- Retain the model and image pins, 32K context, concurrency, memory
utilization, Marlin configuration, and CUDA graphs. The larger Spark
recipe is unchanged.

## Verification

- Regression test: the three new assertions failed before the recipe
change.
- `npx vitest

**File**: `managed-inference/recipes/vllm.qwen3-6-35b-a3b-nvfp4.spark-single-64gb.v1.yaml` (modified, +3/-1)
```diff
@@ -75,7 +75,9 @@ spec:
       - name: --reasoning-parser
         value: qwen3
       - name: --load-format
-        value: fastsafetensors
+        value: safetensors
+      - name: --safetensors-load-strategy
+        value: lazy
 
   readiness:
     timeoutSeconds: 1800
```

**File**: `src/lib/inference/vllm-fixed-catalog-install.test.ts` (modified, +3/-0)
```diff
@@ -354,6 +354,9 @@ describe("fixed catalog vLLM installs", () => {
       expect(command).toContain("--max-num-seqs 1");
       expect(command).toContain("--max-num-batched-tokens 4096");
       expect(command).toContain("--gpu-memory-utilization 0.5");
+      expect(command).toContain("--load-format safetensors");
+      expect(command).toContain("--safetensors-load-strategy lazy");
+      expect(command).not.toContain("--load-format fastsafetensors");
     },
   );
 
```

---

### Incident Patch 4: `15a1b8f8` (2026-10-05)
**Commit Message**: fix(acp): preserve remote exit and cleanup failures (#11774)

## Outcome

`nemoclaw-acp` distinguishes a remote `hermes-acp` exit status of 255
from an SSH transport failure. Failed removal of temporary SSH
configuration is reported with the retained directory, while preserving
an existing operation failure or remote nonzero exit status.

## Reason

OpenSSH uses 255 for transport failures as well as forwarding that
remote exit status. The shared temporary-configuration helper also
suppressed filesystem cleanup errors.

### Related issues

Part of #10947.

## Changes

- Retain the session-specific exit frame on SSH stderr, leaving the ACP
stdin/stdout stream unchanged. The bounded parser distinguishes a
completed remote command from transport loss.
- Preserve operation and cleanup outcomes together. Cleanup failure
turns an otherwise successful command into failure without replacing an
existing nonzero ACP exit.
- Apply cleanup reporting to the current native-home backup/restore and
readiness callers. Preserve completed state and original failure
details.
- Integrate main and remove changes to retired SSH command execution,
plugin discovery, file probes, and snapshot tests.
- Refres

**File**: `.github/actions/stage-native-podman-e2e-toolchains/action.yaml` (modified, +9/-9)
```diff
@@ -21,7 +21,7 @@ runs:
       shell: bash
       env:
         GH_TOKEN: ${{ inputs.github-token }}
-        SOURCE_RUN_ID: "36952890255"
+        SOURCE_RUN_ID: "37084523734"
       run: |
         set -euo pipefail
         verify_artifact() {
@@ -39,22 +39,22 @@ runs:
                  END { exit found ? 0 : 1 }'
         }
         verify_artifact \
-          11204862350 \
+          11259877441 \
           native-podman-e2e-toolchain-amd64 \
-          sha256:61f7ce077100d1591ae0260efa7e98dd3a247d97c9cd5c4f6979436587a9f9c4
+          sha256:83ceb1b45972364bd7c972df0b996c0b56d71dc5fa478c1f282e89cd2531a9e6
         verify_artifact \
-          11204862356 \
+          11259567745 \
           native-podman-e2e-toolchain-arm64 \
-          sha256:9a674eb624375eae90f09249e2ac6d2b27bdea5f430e3dc2953a13f00667102b
+          sha256:aec9e43f8200e656219a515d5af045505b014697bf567f3cdce5453a641a7898
 
     - name: Download immutable native Podman amd64 toolchain
       if: ${{ inputs.enabled == 'true' }}
       uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
       with:
         github-token: ${{ inputs.github-token }}
         repository: NVIDIA/NemoClaw
-        run-id: "36952890255"
-        artifact-ids: "11204862350"
+        run-id: "37084523734"
+        artifact-ids: "11259877441"
         path: ${{ runner.temp }}/native-podman-e2e-toolchain-amd64
 
     - name: Download immutable native Podman arm64 toolchain
@@ -63,8 +63,8 @@ runs:
       with:
         github-token: ${{ inputs.github-token }}
         repository: NVIDIA/NemoClaw
-        run-id: "36952890255"
-        artifact-ids: "11204862356"
+        run-id: "37084523734"
+        artifact-ids: "11259567745"
         path: ${{ runner.temp }}/native-podman-e2e-toolchain-arm64
 
     - name: Publish native Podman amd64 toolchain for this run
```

**File**: `.github/workflows/e2e.yaml` (modified, +1/-1)
```diff
@@ -699,7 +699,7 @@ jobs:
       # Publish immutable source-run toolchains before candidate checkout or
       # candidate-controlled workspace preparation can execute on this runner.
       - name: Stage immutable native Podman E2E toolchains
-        uses: NVIDIA/NemoClaw/.github/actions/stage-native-podman-e2e-toolchains@3c01bc3da31b816b1c62a3b41992010a6e01894d
+        uses: NVIDIA/NemoClaw/.github/actions/stage-native-podman-e2e-toolchains@1f25758964efba2fdb3ff4970d3691506f5e68ab
         with:
           enabled: ${{ (contains(format(',{0},', inputs.gateway_runtimes || inputs.gateway_runtime || 'docker'), ',podman,') || contains(fromJSON(steps.matrix.outputs.selected_jobs), 'portable-hermes-finalization')) && 'true' || 'false' }}
           github-token: ${{ github.token }}
```

**File**: `src/lib/acp/command.test.ts` (modified, +38/-0)
```diff
@@ -308,6 +308,44 @@ describe("Hermes ACP command", () => {
     ]);
   });
 
+  it("reports retained temporary SSH credential cleanup guidance (#10947)", async () => {
+    const message =
+      'NemoClaw could not remove the temporary SSH configuration at "/tmp/nemoclaw-acp-retained". Remove that directory before running nemoclaw-acp again.';
+    const transport: HermesAcpSshTransport = {
+      run: vi.fn(async (request) => {
+        request.onSessionStarted?.();
+        return {
+          kind: "failed" as const,
+          error: { kind: "cleanup" as const, message },
+          exitCode: 1,
+        };
+      }),
+    };
+    const fixture = commandHarness({ transport });
+
+    expect(await fixture.run(["--sandbox", "alpha"])).toBe(1);
+    expect(fixture.diagnostics.text()).toBe(`${message}\n`);
+  });
+
+  it("keeps a remote nonzero exit while reporting credential cleanup failure (#10947)", async () => {
+    const message =
+      'NemoClaw could not remove the temporary SSH configuration at "/tmp/nemoclaw-acp-retained". Remove that directory before running nemoclaw-acp again.';
+    const transport: HermesAcpSshTransport = {
+      run: vi.fn(async (request) => {
+        request.onSessionStarted?.();
+        return {
+          kind: "completed" as const,
+          cleanupError: { kind: "cleanup" as const, message },
+          exitCode: 42,
+        };
+      }),
+    };
+    const fixture = commandHarness({ transport });
+
+    expect(await fixture.run(["--sandbox", "alpha"])).toBe(42);
+    expect(fixture.diagnostics.text()).toBe(`${message}\n`);
+  });
+
   it("fails closed when the registered target changes while waiting for the lifecycle fence", async () => {
     const first = registryEntry("alpha");
     const changed = registryEntry("alpha", 8080, { lifecycleGeneration: "generation-2" });
```

**File**: `src/lib/acp/command.ts` (modified, +4/-1)
```diff
@@ -443,5 +443,8 @@ export async function runHermesAcpCommand(
   if (outcome.kind === "failed" && outcome.error.kind !== "client_disconnect") {
     await writeLine(io.diagnostics, outcome.error.message);
   }
-  return outcome.exitCode;
+  if (outcome.cleanupError) {
+    await writeLine(io.diagnostics, outcome.cleanupError.message);
+  }
+  return outcome.exitCode === 0 && outcome.cleanupError ? 1 : outcome.exitCode;
 }
```

**File**: `src/lib/adapters/openshell/hermes-acp-ssh-cli.test.ts` (modified, +154/-9)
```diff
@@ -7,6 +7,7 @@ import { PassThrough, Readable, Writable } from "node:stream";
 import { afterEach, describe, expect, it, vi } from "vitest";
 
 import { HERMES_LIFECYCLE_DEFINITION } from "../../domain/lifecycle/hermes-definition";
+import { TempSshConfigCleanupError } from "../../sandbox/temp-ssh-config";
 import {
   buildHermesAcpProbeSshArgs,
   buildHermesAcpSessionSshArgs,
@@ -29,6 +30,11 @@ function sshConfig(gatewayName = "nemoclaw"): string {
   ].join("\n");
 }
 const PROBE_OUTPUT = `${HERMES_LIFECYCLE_DEFINITION.agentVersion}\n0.9.0\n`;
+const SESSION_STATUS_NONCE = "0123456789abcdef0123456789abcdef";
+
+function sessionStatusFrame(status: number): string {
+  return `\x1enemoclaw-acp-status-v1:${SESSION_STATUS_NONCE}:${String(status)}\x1e`;
+}
 
 type FakeChild = Omit<
   ChildProcessWithoutNullStreams,
@@ -84,6 +90,11 @@ function probeChild(output = PROBE_OUTPUT, status = 0): FakeChild {
   });
 }
 
+function finishSession(child: FakeChild, status: number): void {
+  child.stderr.write(sessionStatusFrame(status));
+  child.finish(0);
+}
+
 function collectingWritable(options: { delay?: boolean; fail?: boolean } = {}): {
   stream: Writable;
   text: () => string;
@@ -130,6 +141,7 @@ function harness(
     access: vi.fn(),
     captureOpenShell,
     createTempConfig,
+    createSessionStatusNonce: () => SESSION_STATUS_NONCE,
     openshellVersion: vi.fn(() => "0.0.116"),
     platform: "linux",
     resolveOpenshell: () => "/usr/bin/openshell",
@@ -169,23 +181,35 @@ describe("CLI Hermes ACP SSH transport", () => {
     vi.unstubAllEnvs();
   });
 
-  it("constructs only fixed probe and hermes-acp commands", () => {
+  it("constructs only fixed probe and status-framed hermes-acp commands (#10947)", () => {
     const probe = buildHermesAcpProbeSshArgs("/tmp/acp/ssh_config", "openshell-alpha.default");
-    const session = buildHermesAcpSessionSshArgs("/tmp/acp/ssh_config", "openshell-alpha.default");
+    const session = buildHermesAcpSessionSshArgs(
+      "/tmp/acp/ssh_config",
+      "openshell-alpha.default",
+      SESSION_STATUS_NONCE,
+    );
 
     expect(probe.slice(0, -1)).toEqual(session.slice(0, -1));
     expect(probe.at(-1)).toContain('m.version("hermes-agent")');
     expect(probe.at(-1)).toContain('m.version("agent-client-protocol")');
-    expect(session.at(-1)).toBe("/usr/local/bin/hermes-acp");
-    expect(session.slice(0, -1)).not.toContain("sh");
-    expect(session.slice(0, -1)).not.toContain("/bin/sh");
+    expect(session.at(-1)).toContain("/bin/sh -c");
+    expect(session.at(-1)).toContain("/usr/local/bin/hermes-acp");
+    expect(session.at(-1)).toContain("nemoclaw-acp-status-v1");
+    expect(session.at(-1)).toContain(SESSION_STATUS_NONCE);
+    expect(() =>
+      buildHermesAcpSessionSshArgs(
+        "/tmp/acp/ssh_config",
+        "openshell-alpha.default",
+        "$(untrusted)",
+      ),
+    ).toThrow("Hermes ACP session status nonce is invalid");
   });
 
   it("forwards duplex bytes with backpressure and keeps stderr out of ACP output", async () => {
     const session = fakeChild((child, input) => {
       child.stderr.write("request payload and credential-shaped diagnostic");
       child.stdout.write(`reply:${input}`);
-      child.finish(0);
+      finishSession(child, 0);
     });
     const fixture = harness([probeChild(), session]);
     const io = streams(Readable.from(["first", "-second"]));
@@ -206,7 +230,7 @@ describe("CLI Hermes ACP SSH transport", () => {
     vi.stubEnv("NVIDIA_INFERENCE_API_KEY", "provider-secret");
     vi.stubEnv("OPENSHELL_TOKEN", "openshell-secret");
     vi.stubEnv("SSH_AUTH_SOCK", "/tmp/private-agent.sock");
-    const session = fakeChild((child) => child.finish(0));
+    const session = fakeChild((child) => finishSession(child, 0));
     const fixture = harness([probeChild(), session]);
     const io = streams();
 
@@ -261,7 +285,7 @@ describe("CLI Hermes ACP SSH transport", () => {
   it("preserves a remote nonzero status while reducing remote diagnostics", async () => {
     const session = fakeChild((child) => {
       child.stderr.write("Authorization: Bearer secret\nACP request body");
-      child.finish(42);
+      finishSession(child, 42);
     });
     const fixture = harness([probeChild(), session]);
     const io = streams();
@@ -280,6 +304,27 @@ describe("CLI Hermes ACP SSH transport", () => {
     expect(fixture.cleanup).toHaveBeenCalledOnce();
   });
 
+  it("preserves remote exit 255 without classifying it as an SSH failure (#10947)", async () => {
+    const session = fakeChild((child) => {
+      const frame = sessionStatusFrame(255);
+      child.stderr.write(frame.slice(0, 19));
+      child.stderr.write(frame.slice(19));
+      child.finish(0);
+    });
+    const fixture = harness([probeChild(), session]);
+    const io = streams();
+
+    const result = await fixture.transport.run({
+      gatewayName: "nemoclaw",
+      sandboxName: "alpha",
+      streams: io.value,
+    });
+
+    expect(resul
```

**File**: `src/lib/adapters/openshell/hermes-acp-ssh-cli.ts` (modified, +113/-16)
```diff
@@ -7,15 +7,20 @@ import {
   type ChildProcessWithoutNullStreams,
   type SpawnOptionsWithoutStdio,
 } from "node:child_process";
+import { randomBytes } from "node:crypto";
 import { once } from "node:events";
 import { accessSync, constants } from "node:fs";
 import path from "node:path";
 import { pipeline } from "node:stream/promises";
 
-import { spawnExitCode } from "../../core/process-exit";
 import { HERMES_LIFECYCLE_DEFINITION } from "../../domain/lifecycle/hermes-definition";
 import { assertNoOpenShellGatewayEndpointOverride } from "../../openshell-gateway-endpoint-guard";
-import { createTempSshConfig, type TempSshConfig } from "../../sandbox/temp-ssh-config";
+import {
+  createTempSshConfig,
+  runWithTempSshConfigCleanupAsync,
+  TempSshConfigCleanupError,
+  type TempSshConfig,
+} from "../../sandbox/temp-ssh-config";
 import { isValidName } from "../../sandbox-name-contract";
 import { isSshTransportFailure } from "../../state/ssh-transport";
 import { resolveOpenshellBinaryOrNull } from "./resolve-shared";
@@ -35,6 +40,9 @@ const ACP_SETUP_TIMEOUT_MS = 30_000;
 const SSH_CONFIG_MAX_BYTES = 1024 * 1024;
 const PROBE_MAX_BYTES = 4 * 1024;
 const SSH_KILL_GRACE_MS = 1_000;
+const SESSION_STATUS_NONCE_BYTES = 16;
+const SESSION_STATUS_TAG = "nemoclaw-acp-status-v1";
+const SESSION_STATUS_SEPARATOR = "\x1e";
 const SUPPORTED_HOST_PLATFORMS = new Set<NodeJS.Platform>(["darwin", "linux"]);
 
 const HERMES_ACP_COMPATIBILITY_PROBE = [
@@ -91,6 +99,7 @@ export type CliHermesAcpSshTransportDeps = Readonly<{
   access?: (file: string) => void;
   captureOpenShell?: CaptureOpenShell;
   createTempConfig?: (contents: string, prefix: string) => TempSshConfig;
+  createSessionStatusNonce?: () => string;
   openshellVersion?: OpenShellVersionProbe;
   platform?: NodeJS.Platform;
   resolveOpenshell?: () => string | null;
@@ -198,8 +207,51 @@ export function buildHermesAcpProbeSshArgs(configFile: string, host: string): st
   return sshArgs(configFile, host, HERMES_ACP_COMPATIBILITY_PROBE);
 }
 
-export function buildHermesAcpSessionSshArgs(configFile: string, host: string): string[] {
-  return sshArgs(configFile, host, HERMES_ACP_EXECUTABLE);
+function assertSessionStatusNonce(nonce: string): void {
+  if (!/^[0-9a-f]{32}$/u.test(nonce)) {
+    throw new Error("Hermes ACP session status nonce is invalid");
+  }
+}
+
+function sessionStatusFrame(nonce: string, status: number): string {
+  return `${SESSION_STATUS_SEPARATOR}${SESSION_STATUS_TAG}:${nonce}:${String(status)}${SESSION_STATUS_SEPARATOR}`;
+}
+
+function sessionCommand(nonce: string): string {
+  assertSessionStatusNonce(nonce);
+  const script = [
+    HERMES_ACP_EXECUTABLE,
+    "status=$?",
+    `printf '\\036${SESSION_STATUS_TAG}:%s:%s\\036' "$1" "$status" >&2`,
+    "exit 0",
+  ].join("; ");
+  return `/bin/sh -c ${shellEscape(script)} nemoclaw-acp ${nonce}`;
+}
+
+export function buildHermesAcpSessionSshArgs(
+  configFile: string,
+  host: string,
+  statusNonce: string,
+): string[] {
+  return sshArgs(configFile, host, sessionCommand(statusNonce));
+}
+
+function parseSessionStatusFrame(
+  tail: Buffer,
+  nonce: string,
+): Readonly<{ exitCode: number; frameBytes: number }> | null {
+  const prefix = `${SESSION_STATUS_SEPARATOR}${SESSION_STATUS_TAG}:${nonce}:`;
+  const text = tail.toString("utf8");
+  const frameStart = text.lastIndexOf(prefix);
+  if (frameStart < 0 || !text.endsWith(SESSION_STATUS_SEPARATOR)) return null;
+  const statusText = text.slice(frameStart + prefix.length, -SESSION_STATUS_SEPARATOR.length);
+  if (!/^(?:0|[1-9][0-9]{0,2})$/u.test(statusText)) return null;
+  const exitCode = Number(statusText);
+  if (exitCode > 255) return null;
+  return {
+    exitCode,
+    frameBytes: Buffer.byteLength(text.slice(frameStart), "utf8"),
+  };
 }
 
 function signalChildTree(child: ChildProcessWithoutNullStreams, signal: NodeJS.Signals): void {
@@ -321,12 +373,15 @@ async function runSession(
   child: ChildProcessWithoutNullStreams,
   request: HermesAcpSshRequest,
   signalSource: ProcessSignalSource,
+  statusNonce: string,
 ): Promise<HermesAcpSshOutcome> {
   let stopKind: HermesAcpSshFailureKind | null = null;
   let requestedSignal: NodeJS.Signals | null = null;
   let killTimer: NodeJS.Timeout | undefined;
   let timeout: NodeJS.Timeout | undefined;
-  let hadDiagnostics = false;
+  let stderrBytes = 0;
+  let stderrTail = Buffer.alloc(0);
+  const maxStatusFrameBytes = Buffer.byteLength(sessionStatusFrame(statusNonce, 255), "utf8");
 
   const terminate = (kind: HermesAcpSshFailureKind, signal: NodeJS.Signals = "SIGTERM") => {
     if (child.exitCode !== null || child.signalCode !== null || stopKind) return;
@@ -354,8 +409,13 @@ async function runSession(
   if (request.signal?.aborted) onAbort();
   request.streams.input.once("aborted", onInputAborted);
   request.streams.output.once("close", onOutputClose);
-  child.stderr.on("data", () => {
-    hadDiagnostics = true;
+  child.stderr.on("data", (chunk: Buffer 
```

**File**: `src/lib/adapters/openshell/hermes-acp-ssh.ts` (modified, +19/-10)
```diff
@@ -7,23 +7,32 @@ export const HERMES_ACP_EXECUTABLE = "/usr/local/bin/hermes-acp";
 
 export type HermesAcpSshFailureKind =
   | "cancelled"
+  | "cleanup"
   | "client_disconnect"
   | "incompatible"
   | "invocation"
   | "timeout"
   | "transport"
   | "unavailable";
 
-export type HermesAcpSshOutcome =
-  | Readonly<{ kind: "completed"; exitCode: number; signal?: NodeJS.Signals | null }>
-  | Readonly<{
-      kind: "failed";
-      error: Readonly<{
-        kind: HermesAcpSshFailureKind;
-        message: string;
-      }>;
-      exitCode: number;
-    }>;
+export type HermesAcpSshCleanupError = Readonly<{
+  kind: "cleanup";
+  message: string;
+}>;
+
+export type HermesAcpSshOutcome = Readonly<
+  (
+    | { kind: "completed"; exitCode: number; signal?: NodeJS.Signals | null }
+    | {
+        kind: "failed";
+        error: Readonly<{
+          kind: HermesAcpSshFailureKind;
+          message: string;
+        }>;
+        exitCode: number;
+      }
+  ) & { cleanupError?: HermesAcpSshCleanupError }
+>;
 
 export type HermesAcpSshRequest = Readonly<{
   gatewayName: string;
```

**File**: `src/lib/sandbox/temp-ssh-config.test.ts` (modified, +81/-1)
```diff
@@ -6,7 +6,13 @@ import os from "node:os";
 import path from "node:path";
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 
-import { createTempSshConfig } from "./temp-ssh-config.js";
+import {
+  createTempSshConfig,
+  runWithTempSshConfigCleanup,
+  runWithTempSshConfigCleanupAsync,
+  TempSshConfigCleanupError,
+  TempSshConfigOperationCleanupError,
+} from "./temp-ssh-config.js";
 
 describe("createTempSshConfig", () => {
   let tmpRoot: string;
@@ -47,4 +53,78 @@ describe("createTempSshConfig", () => {
 
     expect(fs.readdirSync(tmpRoot)).toEqual([]);
   });
+
+  it("surfaces a failed temporary SSH configuration cleanup (#10947)", () => {
+    const temp = createTempSshConfig("Host openshell-alpha\n", "nemoclaw-ssh-cleanup-");
+    const remove = vi.spyOn(fs, "rmSync").mockImplementationOnce(() => {
+      throw new Error("remove failed");
+    });
+
+    expect(() => temp.cleanup()).toThrow(/failed to remove temporary OpenShell SSH configuration/u);
+    expect(fs.existsSync(temp.file)).toBe(true);
+
+    remove.mockRestore();
+    temp.cleanup();
+  });
+
+  it("reports a retained directory when creation and cleanup both fail (#10947)", () => {
+    vi.spyOn(fs, "writeFileSync").mockImplementationOnce(() => {
+      throw new Error("write failed");
+    });
+    const remove = vi.spyOn(fs, "rmSync").mockImplementationOnce(() => {
+      throw new Error("remove failed");
+    });
+
+    let failure: unknown;
+    try {
+      createTempSshConfig("Host openshell-alpha\n", "nemoclaw-ssh-create-cleanup-");
+    } catch (error) {
+      failure = error;
+    }
+
+    expect(failure).toBeInstanceOf(TempSshConfigCleanupError);
+    expect(failure).toMatchObject({ dir: expect.stringContaining("nemoclaw-ssh-create-cleanup-") });
+    expect((failure as Error).message).toMatch(
+      /failed to remove temporary OpenShell SSH configuration/u,
+    );
+
+    remove.mockRestore();
+  });
+
+  it.each([
+    {
+      variant: "synchronous",
+      run: (temp: ReturnType<typeof createTempSshConfig>, operation: () => never) =>
+        runWithTempSshConfigCleanup(temp, operation),
+    },
+    {
+      variant: "asynchronous",
+      run: (temp: ReturnType<typeof createTempSshConfig>, operation: () => never) =>
+        runWithTempSshConfigCleanupAsync(temp, async () => operation()),
+    },
+  ])("preserves $variant operation and cleanup failures in order (#10947)", async ({ run }) => {
+    const temp = createTempSshConfig("Host openshell-alpha\n", "nemoclaw-ssh-combined-");
+    const operationError = new Error("operation failed");
+    const remove = vi.spyOn(fs, "rmSync").mockImplementationOnce(() => {
+      throw new Error("remove failed");
+    });
+
+    let failure: unknown;
+    try {
+      await run(temp, () => {
+        throw operationError;
+      });
+    } catch (error) {
+      failure = error;
+    }
+
+    expect(failure).toBeInstanceOf(TempSshConfigOperationCleanupError);
+    expect((failure as AggregateError).errors).toEqual([
+      operationError,
+      expect.objectContaining({ name: "TempSshConfigCleanupError", dir: temp.dir }),
+    ]);
+
+    remove.mockRestore();
+    temp.cleanup();
+  });
 });
```

---

### Incident Patch 5: `76438ed4` (2026-10-05)
**Commit Message**: fix(ci): validate preinstalled Tavily plugin (#12624)

## Outcome

Managed OpenClaw image publication now accepts the intentionally
preinstalled Tavily plugin while still requiring the exact package
version, a single installation, and a disabled-by-default configuration
entry.

## Reason

PR #12225 added Tavily to the managed OpenClaw image and inert
configuration, but the publication validator still required Tavily to be
absent. Both architecture validations therefore failed with `uninstalled
OpenClaw plugin tavily is present in managed configuration`, blocking
base-image publication and downstream full E2E setup.

### Related issues

Relates to #11294

## Changes

- Add `@openclaw/tavily-plugin@2026.9.2` to the existing managed-image
package validation map.
- Remove the obsolete assertion that rejected any Tavily configuration
entry.
- Protect the workflow contract against restoring the stale absence
assertion or dropping Tavily's exact package validation.

## Verification

- `npx vitest run --project integration
test/inference/managed/managed-image-publication-workflow.test.ts` — 36
tests passed.
- Pre-commit hooks — passed, including YAML validation, repository
checks, source-s

**File**: `.github/workflows/managed-images.yaml` (modified, +1/-3)
```diff
@@ -2355,6 +2355,7 @@ jobs:
           const packages = {
             "diagnostics-otel": ["@openclaw/diagnostics-otel", "2026.9.2"],
             brave: ["@openclaw/brave-plugin", "2026.9.2"],
+            tavily: ["@openclaw/tavily-plugin", "2026.9.2"],
             discord: ["@openclaw/discord", "2026.9.2"],
             "openclaw-weixin": ["@tencent-weixin/openclaw-weixin", "2.4.9"],
             slack: ["@openclaw/slack", "2026.9.2"],
@@ -2399,9 +2400,6 @@ jobs:
           if (config.plugins?.entries?.telegram?.enabled !== false) {
             throw new Error("bundled OpenClaw plugin telegram is not explicitly disabled");
           }
-          if (config.plugins?.entries?.tavily !== undefined) {
-            throw new Error("uninstalled OpenClaw plugin tavily is present in managed configuration");
-          }
           for (const id of [
             "telegram",
             "discord",
```

**File**: `test/inference/managed/managed-image-publication-workflow.test.ts` (modified, +2/-0)
```diff
@@ -214,6 +214,8 @@ describe("complete managed-image publication workflow", () => {
       step(managedPublisher(managedWorkflow), "Validate exact managed image before promotion")
         .run ?? "";
     expect(validationRun).not.toContain('path.join(projectsRoot, entry.name, "package.json")');
+    expect(validationRun).toContain('tavily: ["@openclaw/tavily-plugin", "2026.9.2"]');
+    expect(validationRun).not.toContain("uninstalled OpenClaw plugin tavily");
     const channelGuardEnd = validationRun.indexOf("managed OpenClaw channel");
     const channelGuardStart = validationRun.lastIndexOf("for (const id of [", channelGuardEnd);
     expect(channelGuardStart).toBeGreaterThan(-1);
```

---

### Incident Patch 6: `daeb439d` (2026-10-05)
**Commit Message**: fix(onboard): wait for created sandbox container (#12606)

## Outcome

Managed cloud onboarding now tolerates the bounded handoff where
OpenShell has returned a verified sandbox identity but Docker has not
exposed that sandbox's exact container yet. The root-configuration step
observes the exact owned container for up to five seconds, while
ambiguity, identity changes, stopped containers, and inspection
mismatches still fail immediately.

## Reason

Cloud onboard failed twice in workflow run 37023246080 because managed
startup attempted root configuration before the sandbox container
appeared. Later runs passed without a lifecycle code change, which
isolates this as a transient container-appearance race rather than a
persistent provider regression.

## Changes

- Retry only `DirectSandboxContainerNotFoundError` after OpenShell
returns a verified create identity.
- Bound the read-only observation window to 21 observations over five
seconds and include the exhausted observation evidence in the terminal
error.
- Add deterministic tests for delayed appearance, bounded absence, and
fail-fast ambiguous ownership.

## Verification

- `npx vitest run --project cli
src/lib/onboard/managed-s

**File**: `src/lib/onboard/managed-startup/provider-root-apply.test.ts` (modified, +156/-0)
```diff
@@ -9,6 +9,10 @@ import {
 } from "../../../../scripts/checks/generate-managed-startup-profile-fixture.mts";
 import { createPodmanRuntimeProviderBundle } from "../runtime-provider/podman";
 import type { RuntimeProviderBundle } from "../runtime-provider/contract";
+import {
+  DirectSandboxContainerNotFoundError,
+  DirectSandboxFallbackUnavailableError,
+} from "../runtime-provider/privileged-sandbox-control-errors";
 import {
   PODMAN_MANAGED_LABEL,
   PODMAN_SANDBOX_CONTAINER_PREFIX,
@@ -31,7 +35,159 @@ const IMAGE_ID = `sha256:${"b".repeat(64)}`;
 const SANDBOX_ID = "sandbox-podman-managed";
 const SANDBOX_NAME = "managed-podman";
 
+function createDockerRootApplyFixture(
+  resolveTarget: (input: { readonly timeoutMs?: number }) => { resourceHandle: string },
+) {
+  const labels = {
+    "openshell.ai/managed-by": "openshell",
+    "openshell.ai/sandbox-name": SANDBOX_NAME,
+    "openshell.ai/sandbox-id": SANDBOX_ID,
+    "openshell.ai/sandbox-workspace": "default",
+  };
+  const execute = vi.fn((input: { readonly command: readonly string[] }) => ({
+    status: 0,
+    stdout: input.command.includes("--shared-state-transaction-status") ? "pending\n" : "",
+    stderr: "",
+  }));
+  const runtimeProvider = {
+    identity: { id: "docker" },
+    lifecycle: {
+      supported: true,
+      privilegedSandboxControl: { resolveTarget, execute },
+    },
+    containerEngine: {
+      supported: true,
+      identities: [{ operation: "sandbox-lifecycle" }],
+      capture: () => ({
+        status: 0,
+        stdout: JSON.stringify([
+          {
+            Id: CONTAINER_ID,
+            Image: IMAGE_ID,
+            Config: { Labels: labels },
+            State: { Dead: false, Paused: false, Restarting: false, Running: true },
+          },
+        ]),
+        stderr: "",
+      }),
+    },
+  } as unknown as RuntimeProviderBundle;
+  const request = createManagedStartupRootApplyRequest({
+    agent: "openclaw",
+    corporateCaB64: Buffer.from(MANAGED_STARTUP_E2E_CORPORATE_CA_PEM, "utf8").toString("base64"),
+    encodedProfile: encodeManagedStartupProfile(
+      managedStartupE2eProfile("openclaw", false, true, true),
+    ),
+  });
+  return { request, runtimeProvider };
+}
+
 describe("provider-owned managed startup root application", () => {
+  it("waits for the exact OpenShell container to appear after create returns", () => {
+    const resolveTarget = vi
+      .fn<() => { resourceHandle: string }>()
+      .mockImplementationOnce(() => {
+        throw new DirectSandboxContainerNotFoundError("container absent");
+      })
+      .mockImplementationOnce(() => {
+        throw new DirectSandboxContainerNotFoundError("container absent");
+      })
+      .mockReturnValue({ resourceHandle: CONTAINER_ID });
+    const { request, runtimeProvider } = createDockerRootApplyFixture(resolveTarget);
+    const sleep = vi.fn();
+
+    const transaction = applyProviderManagedStartupRootRequest(
+      {
+        runtimeProvider,
+        sandboxName: SANDBOX_NAME,
+        sandboxId: SANDBOX_ID,
+        bootstrapIdentity: "c".repeat(64),
+        request,
+        environment: {},
+      },
+      { sleep },
+    );
+
+    expect(transaction?.containerId).toBe(CONTAINER_ID);
+    expect(resolveTarget).toHaveBeenCalledTimes(3);
+    expect(sleep.mock.calls).toEqual([[250], [250]]);
+  });
+
+  it("fails with bounded evidence when the exact OpenShell container stays absent", () => {
+    const resolveTarget = vi.fn(() => {
+      throw new DirectSandboxContainerNotFoundError("container absent");
+    });
+    const { request, runtimeProvider } = createDockerRootApplyFixture(resolveTarget);
+    const sleep = vi.fn();
+
+    expect(() =>
+      applyProviderManagedStartupRootRequest(
+        {
+          runtimeProvider,
+          sandboxName: SANDBOX_NAME,
+          sandboxId: SANDBOX_ID,
+          bootstrapIdentity: "c".repeat(64),
+          request,
+          environment: {},
+        },
+        { sleep },
+      ),
+    ).toThrow(/remained absent after 21 observations over \d+ms \(budget 5000ms\)/u);
+    expect(resolveTarget).toHaveBeenCalledTimes(21);
+    expect(sleep).toHaveBeenCalledTimes(20);
+  });
+
+  it("bounds slow container discovery by the remaining handoff deadline", () => {
+    let nowMs = 10_000;
+    const resolveTarget = vi.fn((input: { readonly timeoutMs?: number }) => {
+      nowMs += input.timeoutMs === 5_000 ? 3_000 : 2_000;
+      throw new DirectSandboxContainerNotFoundError("container absent");
+    });
+    const { request, runtimeProvider } = createDockerRootApplyFixture(resolveTarget);
+    const sleep = vi.fn();
+
+    expect(() =>
+      applyProviderManagedStartupRootRequest(
+        {
+          runtimeProvider,
+          sandboxName: SANDBOX_NAME,
+          sandboxId: SANDBOX_ID,
+          bootstrapIdentity: "c".repeat(64),
+          request,
+          environment: {},
+        },
+        { now: () => nowMs, sleep },
+      ),
+    ).toThrow(/remain
```

**File**: `src/lib/onboard/managed-startup/provider-root-apply.ts` (modified, +96/-26)
```diff
@@ -13,6 +13,8 @@ import type {
   RuntimeProviderPrivilegedSandboxControl,
 } from "../runtime-provider/contract";
 import type { SandboxEntry } from "../../state/registry/types";
+import { DirectSandboxContainerNotFoundError } from "../runtime-provider/privileged-sandbox-control-errors";
+import { waitUntil } from "../readiness-wait";
 import { MANAGED_STARTUP_RUNTIME_EXECUTABLE } from "./image-runtime";
 import {
   type ManagedStartupRootApplyRequest,
@@ -23,6 +25,14 @@ import {
 const FULL_CONTAINER_ID_RE = /^[a-f0-9]{64}$/u;
 const IMMUTABLE_IMAGE_ID_RE = /^(?:sha256:)?[a-f0-9]{64}$/u;
 const ROOT_APPLY_TIMEOUT_MS = 300_000;
+// The managed-startup handoff owns this read-only wait because OpenShell can
+// publish its verified sandbox identity just before the engine exposes the
+// matching container row. Retry only the exact missing-container signal. An
+// ambiguous, stopped, or changed identity still fails immediately, and the
+// terminal error records the actual observation count and elapsed time.
+const CREATED_CONTAINER_DISCOVERY_ATTEMPTS = 21;
+const CREATED_CONTAINER_DISCOVERY_BUDGET_MS = 5_000;
+const CREATED_CONTAINER_DISCOVERY_INTERVAL_MS = 250;
 const MANAGED_STARTUP_HOLD_RELEASE_ATTEMPTS = 3;
 const FIXED_ROOT_ENV = [
   "HOME=/root",
@@ -48,6 +58,11 @@ type ProviderManagedStartupRuntime = Readonly<{
   transaction: ProviderManagedStartupTransaction;
 }>;
 
+export interface ProviderManagedStartupRootApplyTiming {
+  readonly now?: () => number;
+  readonly sleep?: (milliseconds: number) => void;
+}
+
 function requireRuntimeProvider(bundle: RuntimeProviderBundle): {
   readonly control: RuntimeProviderPrivilegedSandboxControl;
   readonly capture: (args: readonly string[], timeoutMs?: number) => RuntimeProviderCommandCapture;
@@ -81,24 +96,73 @@ function commandDetail(result: {
     .slice(-1200);
 }
 
-function inspectExactCreatedRuntime(input: {
-  readonly bundle: RuntimeProviderBundle;
-  readonly sandboxName: string;
-  readonly sandboxId: string;
-  readonly expectedContainerId?: string;
-}): ProviderManagedStartupRuntime {
+function resolveCreatedContainerTarget(
+  runtime: ReturnType<typeof requireRuntimeProvider>,
+  input: {
+    readonly sandbox: SandboxEntry;
+    readonly sandboxName: string;
+  },
+  timing: ProviderManagedStartupRootApplyTiming,
+) {
+  const now = timing.now ?? Date.now;
+  const startedAt = now();
+  const deadlineMs = startedAt + CREATED_CONTAINER_DISCOVERY_BUDGET_MS;
+  let missing: DirectSandboxContainerNotFoundError | undefined;
+  let observations = 0;
+  let target: ReturnType<RuntimeProviderPrivilegedSandboxControl["resolveTarget"]> | undefined;
+  waitUntil(
+    () => {
+      observations += 1;
+      try {
+        target = runtime.control.resolveTarget({
+          registeredSandboxNames: [input.sandboxName],
+          sandbox: input.sandbox,
+          sandboxName: input.sandboxName,
+          timeoutMs: Math.max(1, Math.floor(deadlineMs - now())),
+        });
+        return true;
+      } catch (error) {
+        if (!(error instanceof DirectSandboxContainerNotFoundError)) throw error;
+        missing = error;
+        return false;
+      }
+    },
+    {
+      deadlineMs,
+      initialIntervalMs: CREATED_CONTAINER_DISCOVERY_INTERVAL_MS,
+      maxAttempts: CREATED_CONTAINER_DISCOVERY_ATTEMPTS,
+      maxIntervalMs: CREATED_CONTAINER_DISCOVERY_INTERVAL_MS,
+      now,
+      ...(timing.sleep ? { sleep: timing.sleep } : {}),
+    },
+  );
+  if (target) return target;
+  const elapsedMs = Math.max(0, Math.ceil(now() - startedAt));
+  throw new DirectSandboxContainerNotFoundError(
+    `${missing?.message ?? "The direct OpenShell sandbox container was not found."} ` +
+      `The exact container remained absent after ${observations} observations over ${elapsedMs}ms ` +
+      `(budget ${CREATED_CONTAINER_DISCOVERY_BUDGET_MS}ms).`,
+    { cause: missing },
+  );
+}
+
+function inspectExactCreatedRuntime(
+  input: {
+    readonly bundle: RuntimeProviderBundle;
+    readonly sandboxName: string;
+    readonly sandboxId: string;
+    readonly expectedContainerId?: string;
+  },
+  timing: ProviderManagedStartupRootApplyTiming = {},
+): ProviderManagedStartupRuntime {
   const runtime = requireRuntimeProvider(input.bundle);
   const sandbox: SandboxEntry = {
     name: input.sandboxName,
     openshellDriver: input.bundle.identity.id,
   };
   const target = input.expectedContainerId
     ? { resourceHandle: input.expectedContainerId }
-    : runtime.control.resolveTarget({
-        registeredSandboxNames: [input.sandboxName],
-        sandbox,
-        sandboxName: input.sandboxName,
-      });
+    : resolveCreatedContainerTarget(runtime, { sandbox, sandboxName: input.sandboxName }, timing);
   const inspected = runtime.capture(
     ["inspect", "--type", "container", target.resourceHandle],
     30_000,
@@ -267,24 +331,30 @@ function sharedStateStatusCommand(
   ];
 }
 
-export function applyProviderManagedStartupRootRequest(input: {
```

**File**: `src/lib/onboard/runtime-provider/contract.ts` (modified, +1/-1)
```diff
@@ -454,7 +454,7 @@ export interface RuntimeProviderPrivilegedSandboxControl {
     input: Pick<
       RuntimeProviderPrivilegedSandboxCommandInput,
       "registeredSandboxNames" | "sandbox" | "sandboxName"
-    >,
+    > & { readonly timeoutMs?: number },
   ): RuntimeProviderPrivilegedSandboxTarget;
   execute(
     input: RuntimeProviderPrivilegedSandboxCommandInput,
```

**File**: `src/lib/onboard/runtime-provider/docker-privileged-sandbox-control.test.ts` (modified, +15/-0)
```diff
@@ -28,6 +28,21 @@ function exactInspect(running = true, sandboxName = "alpha"): string {
 }
 
 describe("Docker privileged exact target", () => {
+  it("bounds direct target discovery by the caller's remaining deadline", () => {
+    mocks.dockerCapture.mockReturnValue(`${CONTAINER_ID}\topenshell-default--alpha-sandbox-id`);
+    const control = createDockerPrivilegedSandboxControl();
+
+    expect(
+      control.resolveTarget({
+        sandbox: { name: "alpha", openshellDriver: "docker" },
+        sandboxName: "alpha",
+        registeredSandboxNames: ["alpha"],
+        timeoutMs: 1_250,
+      }),
+    ).toEqual({ providerId: "docker", resourceHandle: CONTAINER_ID });
+    expect(mocks.dockerCapture).toHaveBeenCalledWith(expect.any(Array), { timeout: 1_250 });
+  });
+
   it("executes in the pinned running replacement without mutable-name discovery (#11905)", () => {
     mocks.dockerCapture.mockReturnValue(exactInspect());
     const control = createDockerPrivilegedSandboxControl();
```

**File**: `src/lib/onboard/runtime-provider/docker-privileged-sandbox-control.ts` (modified, +8/-3)
```diff
@@ -40,6 +40,7 @@ type SandboxEntry = import("../../state/registry").SandboxEntry;
 function findDirectSandboxContainer(
   sandboxName: string,
   registeredSandboxNames: readonly string[],
+  timeoutMs = DIRECT_SANDBOX_DISCOVERY_TIMEOUT_MS,
 ): string | null {
   let output: string;
   try {
@@ -55,7 +56,7 @@ function findDirectSandboxContainer(
         "--format",
         "{{.ID}}\t{{.Names}}",
       ],
-      { timeout: DIRECT_SANDBOX_DISCOVERY_TIMEOUT_MS },
+      { timeout: Math.max(1, Math.min(DIRECT_SANDBOX_DISCOVERY_TIMEOUT_MS, timeoutMs)) },
     );
   } catch (error) {
     const detail = error instanceof Error ? error.message : String(error);
@@ -148,14 +149,18 @@ function resolveDockerTarget(
   input: Pick<
     RuntimeProviderPrivilegedSandboxCommandInput,
     "registeredSandboxNames" | "sandbox" | "sandboxName"
-  >,
+  > & { readonly timeoutMs?: number },
 ): RuntimeProviderPrivilegedSandboxTarget {
   const portable = portableTarget(input.sandboxName, input.sandbox);
   if (portable) {
     portable.assertRuntimeAuthority();
     return Object.freeze({ providerId: "docker", resourceHandle: portable.containerId });
   }
-  const containerId = findDirectSandboxContainer(input.sandboxName, input.registeredSandboxNames);
+  const containerId = findDirectSandboxContainer(
+    input.sandboxName,
+    input.registeredSandboxNames,
+    input.timeoutMs,
+  );
   if (!containerId) {
     throw new DirectSandboxContainerNotFoundError(
       `No running direct OpenShell sandbox container found for '${input.sandboxName}' ` +
```

**File**: `src/lib/onboard/runtime-provider/podman-privileged-sandbox-control.ts` (modified, +3/-3)
```diff
@@ -31,12 +31,12 @@ function resolveTarget(
   input: Pick<
     RuntimeProviderPrivilegedSandboxCommandInput,
     "registeredSandboxNames" | "sandbox" | "sandboxName"
-  >,
+  > & { readonly timeoutMs?: number },
 ): RuntimeProviderPrivilegedSandboxTarget {
   if (input.sandbox.name !== input.sandboxName) {
     throw new Error("Podman privileged control requires the registered sandbox identity.");
   }
-  const container = observePodmanManagedContainer(engine, input.sandboxName);
+  const container = observePodmanManagedContainer(engine, input.sandboxName, input.timeoutMs);
   if (!container) {
     throw new DirectSandboxContainerNotFoundError(
       `No Podman runtime resource found for sandbox '${input.sandboxName}'.`,
@@ -141,7 +141,7 @@ export function createPodmanPrivilegedSandboxControl(
       input: Pick<
         RuntimeProviderPrivilegedSandboxCommandInput,
         "registeredSandboxNames" | "sandbox" | "sandboxName"
-      >,
+      > & { readonly timeoutMs?: number },
     ) => resolveTarget(engine, input),
     execute: (input: RuntimeProviderPrivilegedSandboxCommandInput) => execute(engine, input),
     ...(cleanupEngine
```

**File**: `src/lib/onboard/runtime-provider/podman.test.ts` (modified, +2/-0)
```diff
@@ -461,8 +461,10 @@ describe("managed Podman runtime provider", () => {
         registeredSandboxNames: [runtime.sandboxName],
         sandbox: runtime.entry,
         sandboxName: runtime.sandboxName,
+        timeoutMs: 1_250,
       }),
     ).toThrow(DirectSandboxContainerNotFoundError);
+    expect(runtime.lifecycle.capture).toHaveBeenLastCalledWith(expect.any(Array), 1_250);
   });
 
   it("routes stopped state cleanup through the Podman workload-cleanup engine", () => {
```

---

### Incident Patch 7: `944973e8` (2026-10-05)
**Commit Message**: fix(config): export NVIDIA sources and clarify migration prerequisites (#12451)

## Outcome

`nemoclaw config export` verifies native NVIDIA provider bindings that
previously failed live verification. When a successful export omits
retained corporate CA state, the CLI reports that omission on stderr.
Exported policy omits the gateway's computed `provider_credentialed`
marker so the tested raw YAML passes the pinned v1 parser.

## Reason

Users need portable configuration and clear destination prerequisites.
The YAML carries credential references, while destination credentials,
CA trust, and proxy availability require separate preparation.

### Related issues

Closes #12146.
Closes #11421.
Refs #12011 and #12130.

## Changes

- Resolve the native NVIDIA built-in profile through its observed
binding, including the current workspace. Missing or foreign bindings
still fail verification. Adapter and live-source tests cover accepted
and refused bindings.
- Carry the verified CA-omission fact to the CLI, outside the exported
document. Emit the notice only after successful publication, including
file output with `--json`. Tests cover stdout separation, absent CA,
retry stability, and publi

**File**: `docs/reference/commands.mdx` (modified, +15/-1)
```diff
@@ -283,7 +283,21 @@ Exports never contain credential values. They include credential environment-var
 With `--json` and file output, the version 1 result includes `sourceSandbox`, `outputPath`, `documentDigest`, and `specDigest`.
 
 Export validates retained corporate certificate authority (CA) state but omits the CA bundle and digest from YAML.
-Configure destination CA trust separately during onboarding; export does not change the source sandbox's trust.
+When retained CA state is present, a successful export reports that omission on standard error.
+Export does not change the source sandbox's trust.
+
+Before deploying the YAML, prepare the destination:
+
+- Supply values for `credential.env` references through the destination command's environment.
+  Keep credential values out of YAML.
+  Unset exported credentials after the destination command finishes.
+- If `network.proxy` is present, ensure its host and port are reachable from the destination sandbox.
+  Export does not install the proxy.
+- Review destination CA trust requirements before deployment.
+
+The exporter refuses sources that require host proxy credential replay.
+Experimental runtime identity is not supported by this export command.
+For its separate OpenClaw workflow, refer to [Configure Experimental Runtime Identity](/user-guide/openclaw/reference/configure-runtime-identity).
 
 The v0 command projects verified source state into the pre-release v1alpha1 YAML shape.
 Managed OpenClaw and Hermes exports omit `image` so v1 applies its managed image default.
```

**File**: `src/commands/config/export.test.ts` (modified, +132/-37)
```diff
@@ -41,6 +41,12 @@ import ConfigExportCommand from "./export";
 
 const documentDigest = "sha256:" + "a".repeat(64);
 const specDigest = "sha256:" + "b".repeat(64);
+const caOmissionNotice =
+  "The source's corporate CA configuration is not included in the exported YAML. Review destination trust requirements before deployment.";
+const caStates = [
+  { state: "without retained CA", corporateCaOmitted: undefined, notices: [] },
+  { state: "with retained CA", corporateCaOmitted: true, notices: [[caOmissionNotice]] },
+] as const;
 
 describe("config export command", () => {
   beforeEach(() => {
@@ -65,24 +71,58 @@ describe("config export command", () => {
     process.exitCode = 0;
   });
 
-  it("composes live observation through canonical YAML stdout (#10938)", async () => {
-    const write = vi.spyOn(process.stdout, "write").mockImplementation(((
+  it.each(caStates)(
+    "writes YAML stdout $state and keeps the CA notice on stderr (#12146)",
+    async ({ corporateCaOmitted, notices }) => {
+      const notice = vi.spyOn(console, "error").mockImplementation(() => {});
+      mocks.observeStableExportSource.mockResolvedValue({
+        ok: true,
+        source: { sandboxName: "alpha" },
+        attempts: 1,
+        ...(corporateCaOmitted ? { corporateCaOmitted } : {}),
+      });
+      const write = vi.spyOn(process.stdout, "write").mockImplementation(((
+        _: string,
+        callback?: (error?: Error | null) => void,
+      ) => {
+        callback?.();
+        return true;
+      }) as typeof process.stdout.write);
+      await expect(
+        ConfigExportCommand.run(["alpha", "--output", "-", "--name", "team-alpha"], process.cwd()),
+      ).resolves.toBeUndefined();
+      expect(mocks.observeStableExportSource).toHaveBeenCalledWith("alpha", mocks.snapshotReader);
+      expect(mocks.buildExportConfig).toHaveBeenCalledWith(
+        { sandboxName: "alpha" },
+        expect.objectContaining({ documentName: "team-alpha", documentUid: expect.any(String) }),
+      );
+      expect(write).toHaveBeenCalledWith("kind: NemoClawConfig\n", expect.any(Function));
+      expect(write).toHaveBeenCalledTimes(1);
+      expect(notice.mock.calls).toEqual(notices);
+      expect(mocks.publishExportFile).not.toHaveBeenCalled();
+    },
+  );
+
+  it("does not report CA omission when YAML stdout fails (#12146)", async () => {
+    const notice = vi.spyOn(console, "error").mockImplementation(() => {});
+    mocks.observeStableExportSource.mockResolvedValue({
+      ok: true,
+      source: { sandboxName: "alpha" },
+      attempts: 1,
+      corporateCaOmitted: true,
+    });
+    vi.spyOn(process.stdout, "write").mockImplementation(((
       _: string,
       callback?: (error?: Error | null) => void,
     ) => {
-      callback?.();
+      callback?.(new Error("write-failure-canary"));
       return true;
     }) as typeof process.stdout.write);
+
     await expect(
-      ConfigExportCommand.run(["alpha", "--output", "-", "--name", "team-alpha"], process.cwd()),
-    ).resolves.toBeUndefined();
-    expect(mocks.observeStableExportSource).toHaveBeenCalledWith("alpha", mocks.snapshotReader);
-    expect(mocks.buildExportConfig).toHaveBeenCalledWith(
-      { sandboxName: "alpha" },
-      expect.objectContaining({ documentName: "team-alpha", documentUid: expect.any(String) }),
-    );
-    expect(write).toHaveBeenCalledWith("kind: NemoClawConfig\n", expect.any(Function));
-    expect(mocks.publishExportFile).not.toHaveBeenCalled();
+      ConfigExportCommand.run(["alpha", "--output", "-"], process.cwd()),
+    ).rejects.toThrow("The export could not be written to stdout.");
+    expect(notice).not.toHaveBeenCalled();
   });
 
   it("rejects JSON on YAML stdout before reading source state (#10938)", async () => {
@@ -114,6 +154,7 @@ describe("config export command", () => {
   });
 
   it("displays a returned observation failure without building the document", async () => {
+    const notice = vi.spyOn(console, "error").mockImplementation(() => {});
     mocks.observeStableExportSource.mockResolvedValue({
       ok: false,
       findings: [
@@ -130,6 +171,7 @@ describe("config export command", () => {
       ConfigExportCommand.run(["alpha", "--output", "-"], process.cwd()),
     ).rejects.toThrow("Config export failed (not-found).\nThe sandbox was not found.");
     expect(mocks.buildExportConfig).not.toHaveBeenCalled();
+    expect(notice).not.toHaveBeenCalled();
   });
 
   it("reports observation failures in JSON without publishing a document", async () => {
@@ -174,31 +216,76 @@ describe("config export command", () => {
     expect(mocks.observeStableExportSource).not.toHaveBeenCalled();
   });
 
-  it("composes live observation through file publication and JSON result (#10938)", async () => {
-    vi.spyOn(process, "platform", "get").mockReturnValue("linux");
-    const log = vi.spyOn(console, "log").mockImplementation(() => {});
-    const result = await ConfigExportCommand.run(
-      ["alph
```

**File**: `src/commands/config/export.ts` (modified, +4/-0)
```diff
@@ -105,6 +105,10 @@ export default class ConfigExportCommand extends NemoClawCommand {
       },
     );
     if (!outcome.ok) this.error(formatConfigExportFailure(outcome.failure));
+    if (outcome.corporateCaOmitted)
+      console.error(
+        "The source's corporate CA configuration is not included in the exported YAML. Review destination trust requirements before deployment.",
+      );
     const { completion } = outcome;
     return completion.kind === "file" ? completion.result : undefined;
   }
```

**File**: `src/lib/actions/config/export.ts` (modified, +8/-2)
```diff
@@ -67,7 +67,11 @@ export type ConfigExportFailure =
   | ({ readonly kind: "output"; readonly target: "file" } & YamlExportFailure);
 
 export type ConfigExportOutcome =
-  | { readonly ok: true; readonly completion: ConfigExportCompletion }
+  | {
+      readonly ok: true;
+      readonly completion: ConfigExportCompletion;
+      readonly corporateCaOmitted?: true;
+    }
   | { readonly ok: false; readonly failure: ConfigExportFailure };
 
 export async function runConfigExport(
@@ -90,11 +94,12 @@ export async function runConfigExport(
     documentUid: dependencies.createDocumentUid(),
   });
   const rendered = renderCanonicalNemoClawConfig(config);
+  const omittedCa = observation.corporateCaOmitted ? { corporateCaOmitted: true as const } : {};
 
   if (request.target.kind === "stdout") {
     try {
       await dependencies.writeStdout(rendered.yaml);
-      return { ok: true, completion: { kind: "stdout" } };
+      return { ok: true, completion: { kind: "stdout" }, ...omittedCa };
     } catch {
       return {
         ok: false,
@@ -110,6 +115,7 @@ export async function runConfigExport(
   }
   return {
     ok: true,
+    ...omittedCa,
     completion: {
       kind: "file",
       result: {
```

**File**: `src/lib/actions/config/observe-export-source.ts` (modified, +10/-2)
```diff
@@ -26,7 +26,12 @@ import {
 } from "../../policy/sandbox-policy-validation";
 
 export type ExportObservationResult =
-  | { readonly ok: true; readonly source: VerifiedExportSource; readonly attempts: 1 | 2 }
+  | {
+      readonly ok: true;
+      readonly source: VerifiedExportSource;
+      readonly attempts: 1 | 2;
+      readonly corporateCaOmitted?: true;
+    }
   | {
       readonly ok: false;
       readonly findings: NonEmptyExportFindings;
@@ -154,7 +159,10 @@ export async function observeStableExportSource(
         attempts,
       };
     }
-    if (outcome.kind === "verified") return { ok: true, source: outcome.source, attempts };
+    if (outcome.kind === "verified") {
+      const { kind: _kind, ...verified } = outcome;
+      return { ok: true, ...verified, attempts };
+    }
     return { ok: false, findings: outcome.findings, attempts };
   }
   throw new Error("unreachable");
```

**File**: `src/lib/adapters/config/live-export-source.test.ts` (modified, +46/-39)
```diff
@@ -74,9 +74,9 @@ function mockBraveLiveSource() {
   return search;
 }
 
-function mockNativeNvidiaSource() {
+function mockNativeNvidiaSource(profileWorkspace = "default") {
   mockSupportedLiveSource();
-  raw.getProvider.mockResolvedValue({ provider: nativeNvidiaProvider() });
+  raw.getProvider.mockResolvedValue({ provider: { ...nativeNvidiaProvider(), profileWorkspace } });
   raw.getProviderProfile.mockResolvedValue({
     profile: {
       id: "nvidia",
@@ -457,41 +457,48 @@ describe("live export snapshot reader", () => {
     });
   });
 
-  it("exports canonical YAML for the native NVIDIA hosted provider (#11154)", async () => {
-    mockNativeNvidiaSource();
-    const writeStdout = vi.fn(async (_yaml: string) => {});
-    const publish = vi.fn();
-    const result = await runConfigExport(
-      {
-        sandboxName: "alpha",
-        documentName: parseNemoClawConfigDocumentName("alpha"),
-        target: { kind: "stdout" },
-      },
-      {
-        observe: (name) => observeStableExportSource(name, createLiveExportSnapshotReader()),
-        createDocumentUid: () =>
-          parseNemoClawConfigDocumentUid("123e4567-e89b-42d3-a456-426614174001"),
-        writeStdout,
-        publish,
-      },
-    );
-    expect(result).toEqual({ ok: true, completion: { kind: "stdout" } });
-    const yaml = writeStdout.mock.calls[0]![0];
-    const document = asExportedConfig(YAML.parse(yaml));
-    expect(document.spec.inferenceProviders).toEqual([
-      {
-        name: "hosted-nvidia-prod",
-        provider: "openai",
-        api: "openai-completions",
-        endpoint,
-        credential: { env: "NVIDIA_INFERENCE_API_KEY" },
-      },
-    ]);
-    expect(document.spec.sandboxes[0].harness.kind).toBe("openclaw");
-    expect(yaml).not.toContain(readFailureCanary);
-    expect(raw.getProviderProfile).toHaveBeenCalledTimes(2);
-    expect(publish).not.toHaveBeenCalled();
-  });
+  it.each(["", "default"])(
+    "exports canonical YAML for native NVIDIA binding %j (#11154)",
+    async (profileWorkspace) => {
+      mockNativeNvidiaSource(profileWorkspace);
+      const writeStdout = vi.fn(async (_yaml: string) => {});
+      const publish = vi.fn();
+      const result = await runConfigExport(
+        {
+          sandboxName: "alpha",
+          documentName: parseNemoClawConfigDocumentName("alpha"),
+          target: { kind: "stdout" },
+        },
+        {
+          observe: (name) => observeStableExportSource(name, createLiveExportSnapshotReader()),
+          createDocumentUid: () =>
+            parseNemoClawConfigDocumentUid("123e4567-e89b-42d3-a456-426614174001"),
+          writeStdout,
+          publish,
+        },
+      );
+      expect(result).toEqual({ ok: true, completion: { kind: "stdout" } });
+      const yaml = writeStdout.mock.calls[0]![0];
+      const document = asExportedConfig(YAML.parse(yaml));
+      expect(document.spec.inferenceProviders).toEqual([
+        {
+          name: "hosted-nvidia-prod",
+          provider: "openai",
+          api: "openai-completions",
+          endpoint,
+          credential: { env: "NVIDIA_INFERENCE_API_KEY" },
+        },
+      ]);
+      expect(document.spec.sandboxes[0].harness.kind).toBe("openclaw");
+      expect(yaml).not.toContain(readFailureCanary);
+      expect(raw.getProviderProfile).toHaveBeenCalledTimes(2);
+      expect(raw.getProviderProfile).toHaveBeenCalledWith(
+        { id: "nvidia", workspace: profileWorkspace },
+        { signal: expect.any(AbortSignal) },
+      );
+      expect(publish).not.toHaveBeenCalled();
+    },
+  );
 
   it.each([
     { label: "endpoint override", providerChange: { config: { NVIDIA_BASE_URL: endpoint } } },
@@ -500,11 +507,11 @@ describe("live export snapshot reader", () => {
       providerChange: { credentials: { OTHER_API_KEY: readFailureCanary } },
     },
     { label: "missing credentials", providerChange: { credentials: {} } },
-    { label: "unverified profile scope", providerChange: { profileWorkspace: "default" } },
+    { label: "foreign profile binding", providerChange: { profileWorkspace: "foreign" } },
   ])("rejects native NVIDIA $label without publishing YAML", async ({ providerChange }) => {
     mockNativeNvidiaSource();
     raw.getProvider.mockResolvedValue({
-      provider: { ...nativeNvidiaProvider(), ...providerChange },
+      provider: { ...nativeNvidiaProvider(), profileWorkspace: "default", ...providerChange },
     });
     const writeStdout = vi.fn();
     const publish = vi.fn();
```

**File**: `src/lib/adapters/openshell/README.md` (modified, +3/-2)
```diff
@@ -45,11 +45,12 @@ Schema failures use fixed messages without rejected values.
 
 Provider reads return credential names and requested non-secret config values.
 For native NVIDIA hosted inference with no overrides, export also reads `raw.getProviderProfile`
-through the same gateway and workspace. It requires the built-in `nvidia` profile, static scope,
+through the same gateway at the provider's empty or current-workspace binding. Either binding must
+resolve to the built-in `nvidia` profile. Export requires static scope,
 revision zero, inference capability, and its single `integrate.api.nvidia.com:443` endpoint.
 The pinned OpenShell native resolver uses `/v1` on that host. Export records the built-in profile
 as the endpoint evidence. Custom profiles, profile scope changes, and provider config overrides
-cannot use this derivation.
+cannot use this derivation. Missing or foreign-workspace bindings cannot use it either.
 
 Consumers can request `profileContract: "brave"` or `"openai"` to qualify a managed profile.
 The reader resolves `raw.getProviderProfile` at the provider's `profileWorkspace` through the
```

**File**: `src/lib/adapters/openshell/providers.test.ts` (modified, +27/-19)
```diff
@@ -80,7 +80,7 @@ function nativeNvidiaFixture() {
     provider: {
       ...provider().provider,
       type: "nvidia",
-      profileWorkspace: "",
+      profileWorkspace: "default",
       config: {},
     },
   });
@@ -365,29 +365,36 @@ describe("OpenShell provider evidence", () => {
     ).rejects.toMatchObject({ kind: "schema" });
   });
 
-  it("verifies the native NVIDIA endpoint through the named gateway profile", async () => {
-    const { connect, raw } = nativeNvidiaFixture();
-    const input = request();
-    const result = await createProviders(connect).get(input);
-    expect(result).toMatchObject({
-      type: "nvidia",
-      configKeys: [],
-      config: {},
-      builtinInferenceEndpoint: "https://integrate.api.nvidia.com/v1",
-    });
-    expect(raw.getProviderProfile).toHaveBeenCalledWith(
-      { id: "nvidia", workspace: "default" },
-      { signal: input.signal },
-    );
-    expect(connect).toHaveBeenCalledExactlyOnceWith(target);
-    expect(JSON.stringify(result)).not.toContain(canary);
-  });
+  it.each(["", "default"])(
+    "verifies the native NVIDIA endpoint at binding %j",
+    async (profileWorkspace) => {
+      const { connect, raw } = nativeNvidiaFixture();
+      raw.getProvider.mockResolvedValue({
+        provider: { ...provider().provider, type: "nvidia", profileWorkspace, config: {} },
+      });
+      const input = request();
+      const result = await createProviders(connect).get(input);
+      expect(result).toMatchObject({
+        type: "nvidia",
+        configKeys: [],
+        config: {},
+        builtinInferenceEndpoint: "https://integrate.api.nvidia.com/v1",
+      });
+      expect(raw.getProviderProfile).toHaveBeenCalledWith(
+        { id: "nvidia", workspace: profileWorkspace },
+        { signal: input.signal },
+      );
+      expect(connect).toHaveBeenCalledExactlyOnceWith(target);
+      expect(JSON.stringify(result)).not.toContain(canary);
+    },
+  );
 
   it.each([
     { label: "wrong identity", change: { id: "openai" } },
     { label: "custom source", change: { source: "user" } },
     { label: "interceptor source", change: { source: "interceptor/custom" } },
     { label: "workspace scope", change: { scope: "workspace" } },
+    { label: "platform scope", change: { scope: "platform" } },
     { label: "custom revision", change: { resourceVersion: 1n } },
     { label: "missing revision", change: { resourceVersion: undefined } },
     { label: "disabled inference", change: { inferenceCapable: false } },
@@ -416,10 +423,11 @@ describe("OpenShell provider evidence", () => {
   });
 
   it.each([
-    { profileWorkspace: "default", config: {} },
+    { profileWorkspace: "foreign", config: {} },
     { profileWorkspace: undefined, config: {} },
     { profileWorkspace: "", config: { NVIDIA_BASE_URL: "https://different.example/v1" } },
     { profileWorkspace: "", config: { UNUSED: canary } },
+    { profileWorkspace: "default", config: { UNUSED: canary } },
   ])("does not infer a builtin endpoint for NVIDIA overrides %#", async (change) => {
     const { connect, raw } = nativeNvidiaFixture();
     raw.getProvider.mockResolvedValue({
```

---

### Incident Patch 8: `a471c97e` (2026-10-05)
**Commit Message**: fix(skills): preserve registered OpenClaw selection (Fixes #12586) (#12607)

## Outcome

OpenClaw sandboxes keep using OpenClaw for skill install, list, and
remove after another sandbox is onboarded with Hermes or Deep Agents.
For example, `nemoclaw e2e skill list` now selects OpenClaw from its
registry row even when the latest onboarding session names Hermes.

## Reason

OpenClaw is stored as `agent: null`. The resolver treated that value as
missing and used the global onboarding session, so an unrelated sandbox
could make OpenClaw skill commands report an unresolved agent.

[Accepted
scope](https://github.com/NVIDIA/NemoClaw/issues/12586#issuecomment-5984345288)
limits this repair to registry precedence and its tests.

### Related issues

Fixes #12586

## Changes

- Use the existing registry row to select the agent. Normalize its null
value to OpenClaw; consult the onboarding session only when the row is
absent.
- Keep invalid registered values unresolved and preserve the selected
trusted agent definition.
- Exercise install, list, and remove with the real resolver and trusted
manifests after both Hermes and Deep Agents sessions. Command transport
is mocked; native commands and t

**File**: `src/lib/actions/sandbox/skill-install.test.ts` (modified, +37/-0)
```diff
@@ -30,6 +30,8 @@ vi.mock("./gateway-state", () => ({ ensureLiveSandboxOrExit }));
 vi.mock("./gateway-target", () => ({ getSandboxTargetGatewayName }));
 
 import { installSandboxSkill, listSandboxSkills, removeSandboxSkill } from "./skill-install";
+import * as registry from "../../state/registry";
+import * as onboardSession from "../../state/onboard-session";
 import type { AgentSkillIntegration } from "../../agent/skill-integration";
 
 const roots: string[] = [];
@@ -137,6 +139,41 @@ describe("stateless sandbox skill orchestration", () => {
     expect(captureOpenshell).not.toHaveBeenCalled();
   });
 
+  it.each(["hermes", "langchain-deepagents-code"])(
+    "keeps OpenClaw skill operations on their registered sandbox after %s onboarding (#12586)",
+    async (sessionAgent) => {
+      const runtime =
+        await vi.importActual<typeof import("../../agent/runtime")>("../../agent/runtime");
+      getSessionAgent.mockImplementation(runtime.getSessionAgent);
+      resolveSessionAgentDefinition.mockImplementation(runtime.resolveSessionAgentDefinition);
+      vi.spyOn(registry, "getSandbox").mockReturnValue({ name: "alpha", agent: null } as never);
+      vi.spyOn(onboardSession, "loadSession").mockReturnValue({ agent: sessionAgent } as never);
+
+      await listSandboxSkills("alpha");
+      expect(sdkCommandExecutor.runStreaming.mock.calls[0]?.[0].command.slice(-5)).toEqual([
+        "/usr/local/bin/openclaw",
+        "skills",
+        "list",
+        "--agent",
+        "main",
+      ]);
+      expect(process.exitCode).toBe(0);
+      sdkCommandExecutor.runStreaming.mockClear();
+
+      await installSandboxSkill("alpha", { command: "install", path: localSkill() });
+      const install = sdkCommandExecutor.runStreaming.mock.calls[1]?.[0].command as string[];
+      expect(install.slice(-7, -4)).toEqual(["/usr/local/bin/openclaw", "skills", "install"]);
+      expect(install.slice(-3)).toEqual(["--agent", "main", "--force"]);
+      expect(process.exitCode).toBe(0);
+      sdkCommandExecutor.runStreaming.mockClear();
+
+      await removeSandboxSkill("alpha", { name: "demo-skill" });
+      const remove = sdkCommandExecutor.runStreaming.mock.calls[0]?.[0].command as string[];
+      expect(remove.at(-1)).toContain("/sandbox/.openclaw/workspace/skills");
+      expect(process.exitCode).toBe(0);
+    },
+  );
+
   it("forwards the native list exit status", async () => {
     selectAgent("hermes", "/usr/local/bin/hermes", HERMES);
     sdkCommandExecutor.runStreaming.mockResolvedValue({
```

**File**: `src/lib/agent/runtime.test.ts` (modified, +62/-4)
```diff
@@ -2,6 +2,7 @@
 // SPDX-License-Identifier: Apache-2.0
 
 import { afterEach, describe, expect, it, vi } from "vitest";
+import * as onboardSession from "../state/onboard-session";
 import * as registry from "../state/registry";
 import { loadAgent } from "./defs";
 // Import source directly so tests cannot pass against a stale build.
@@ -76,10 +77,67 @@ describe("resolveRegisteredSandboxAgent", () => {
 });
 
 describe("resolveSessionAgentDefinition", () => {
-  it("preserves an explicitly selected agent definition", () => {
-    expect(resolveSessionAgentDefinition("alpha", hermesAgent)).toEqual({
-      agent: hermesAgent,
-      requestedName: "hermes",
+  it.each(["hermes", "langchain-deepagents-code"])(
+    "keeps a registered null agent on OpenClaw after %s onboarding (#12586)",
+    (sessionAgent) => {
+      vi.spyOn(registry, "getSandbox").mockReturnValue({ agent: null } as never);
+      const session = vi.spyOn(onboardSession, "loadSession").mockReturnValue({
+        agent: sessionAgent,
+      } as never);
+
+      expect(resolveSessionAgentDefinition("alpha", null)).toEqual({
+        agent: loadAgent("openclaw"),
+        requestedName: "openclaw",
+        resolved: true,
+      });
+      expect(session).not.toHaveBeenCalled();
+    },
+  );
+
+  it.each(["openclaw", "hermes", "langchain-deepagents-code", "missing-agent"])(
+    "uses session agent %s when no registry row exists",
+    (name) => {
+      vi.spyOn(registry, "getSandbox").mockReturnValue(null);
+      vi.spyOn(onboardSession, "loadSession").mockReturnValue({ agent: name } as never);
+
+      expect(resolveSessionAgentDefinition("alpha", null)).toEqual({
+        agent: name === "openclaw" ? loadAgent("openclaw") : null,
+        requestedName: name,
+        resolved: name === "openclaw",
+      });
+    },
+  );
+
+  it.each(["", false, 0, {}, [], "../openclaw"])(
+    "rejects malformed registered agent %j without using the session",
+    (agent) => {
+      vi.spyOn(registry, "getSandbox").mockReturnValue({ agent } as never);
+      vi.spyOn(onboardSession, "loadSession").mockReturnValue({ agent: "openclaw" } as never);
+
+      expect(resolveSessionAgentDefinition("alpha", null)).toEqual({
+        agent: null,
+        requestedName: agent,
+        resolved: false,
+      });
+    },
+  );
+
+  it.each(["hermes", "langchain-deepagents-code"])("preserves a selected %s definition", (name) => {
+    const selectedAgent = loadAgent(name);
+    expect(resolveSessionAgentDefinition("alpha", selectedAgent)).toEqual({
+      agent: selectedAgent,
+      requestedName: name,
+      resolved: true,
+    });
+  });
+
+  it("defaults to OpenClaw when no registry row or session exists", () => {
+    vi.spyOn(registry, "getSandbox").mockReturnValue(null);
+    vi.spyOn(onboardSession, "loadSession").mockReturnValue(null);
+
+    expect(resolveSessionAgentDefinition("alpha", null)).toEqual({
+      agent: loadAgent("openclaw"),
+      requestedName: "openclaw",
       resolved: true,
     });
   });
```

**File**: `src/lib/agent/runtime.ts` (modified, +3/-1)
```diff
@@ -68,7 +68,9 @@ export function resolveSessionAgentDefinition(
   let requestedName = "openclaw";
   try {
     const registered = sandboxName ? registry.getSandbox(sandboxName) : null;
-    requestedName = registered?.agent || onboardSession.loadSession()?.agent || "openclaw";
+    requestedName = registered
+      ? (registered.agent ?? "openclaw")
+      : onboardSession.loadSession()?.agent || "openclaw";
     if (requestedName !== "openclaw") {
       return { agent: null, requestedName, resolved: false };
     }
```

---

### Incident Patch 9: `766cc036` (2026-10-04)
**Commit Message**: fix(onboard): fail llama.cpp attach when the sandbox cannot reach :8081 (#11709)

## Outcome

Fixes #11626.

A llama.cpp server published only to host loopback can pass host
validation while sandbox inference cannot reach it. Onboarding now
reuses the existing host-service TCP probe before accepting an
operator-attached route. A confirmed connection failure stops both fresh
and resumed onboarding with binding and firewall guidance. Managed
llama.cpp keeps its existing lifecycle readiness checks; unavailable
probes retain their existing behavior.

The setup page documents the sandbox-facing binding for Docker and
native host processes. The existing regression case covers fresh/resumed
rejection and successful attachment.

## E2E prerequisite

Refresh the expired native Podman artifact references and the immutable
staging-action pin so the existing Docker/Podman suite can start. Both
architecture archives were digest-verified, their seven file checksums
passed, and their manifests match the existing Podman 6.1 component
pins. Only matching fixture identifiers and provenance metadata change;
E2E scenarios, assertions, selectors, and toolchain versions remain
unchanged.

## Validation


**File**: `.github/actions/stage-native-podman-e2e-toolchains/action.yaml` (modified, +9/-9)
```diff
@@ -21,7 +21,7 @@ runs:
       shell: bash
       env:
         GH_TOKEN: ${{ inputs.github-token }}
-        SOURCE_RUN_ID: "36534476155"
+        SOURCE_RUN_ID: "36952890255"
       run: |
         set -euo pipefail
         verify_artifact() {
@@ -39,22 +39,22 @@ runs:
                  END { exit found ? 0 : 1 }'
         }
         verify_artifact \
-          11018865557 \
+          11204862350 \
           native-podman-e2e-toolchain-amd64 \
-          sha256:673dbb608ba6595e76ba8479d0e0680b41340546101c7938f28160470846fa8b
+          sha256:61f7ce077100d1591ae0260efa7e98dd3a247d97c9cd5c4f6979436587a9f9c4
         verify_artifact \
-          11019020387 \
+          11204862356 \
           native-podman-e2e-toolchain-arm64 \
-          sha256:c6a23c1132b8c3011252035dc2dae73e2ed47ff97151ba41380e3b07acfe6cdc
+          sha256:9a674eb624375eae90f09249e2ac6d2b27bdea5f430e3dc2953a13f00667102b
 
     - name: Download immutable native Podman amd64 toolchain
       if: ${{ inputs.enabled == 'true' }}
       uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8.0.1
       with:
         github-token: ${{ inputs.github-token }}
         repository: NVIDIA/NemoClaw
-        run-id: "36534476155"
-        artifact-ids: "11018865557"
+        run-id: "36952890255"
+        artifact-ids: "11204862350"
         path: ${{ runner.temp }}/native-podman-e2e-toolchain-amd64
 
     - name: Download immutable native Podman arm64 toolchain
@@ -63,8 +63,8 @@ runs:
       with:
         github-token: ${{ inputs.github-token }}
         repository: NVIDIA/NemoClaw
-        run-id: "36534476155"
-        artifact-ids: "11019020387"
+        run-id: "36952890255"
+        artifact-ids: "11204862356"
         path: ${{ runner.temp }}/native-podman-e2e-toolchain-arm64
 
     - name: Publish native Podman amd64 toolchain for this run
```

**File**: `.github/workflows/e2e.yaml` (modified, +1/-1)
```diff
@@ -699,7 +699,7 @@ jobs:
       # Publish immutable source-run toolchains before candidate checkout or
       # candidate-controlled workspace preparation can execute on this runner.
       - name: Stage immutable native Podman E2E toolchains
-        uses: NVIDIA/NemoClaw/.github/actions/stage-native-podman-e2e-toolchains@6b0acb521f2644fb48f8a735fde875ff798d9047
+        uses: NVIDIA/NemoClaw/.github/actions/stage-native-podman-e2e-toolchains@3c01bc3da31b816b1c62a3b41992010a6e01894d
         with:
           enabled: ${{ (contains(format(',{0},', inputs.gateway_runtimes || inputs.gateway_runtime || 'docker'), ',podman,') || contains(fromJSON(steps.matrix.outputs.selected_jobs), 'portable-hermes-finalization')) && 'true' || 'false' }}
           github-token: ${{ github.token }}
```

**File**: `docs/inference/set-up-llama-cpp.mdx` (modified, +7/-0)
```diff
@@ -31,11 +31,18 @@ Use this path when you operate `llama-server` and want NemoClaw to register its
 The server must satisfy all of these requirements:
 
 - Listen over HTTP on `127.0.0.1:8081` and expose its OpenAI-compatible API under `/v1`.
+- Make that authenticated API reachable from the sandbox network at `host.openshell.internal:8081`.
 - Require the same native bearer key supplied through `NEMOCLAW_LLAMACPP_LOCAL_TOKEN`.
 - Expose bounded native llama.cpp evidence through `/v1/models`, `/health`, `/props`, and either `/metrics` or the native metrics-not-supported response.
 - Report a stable, non-path served model alias.
 - Return native llama.cpp model metadata without conflicting model entries.
 
+On native Docker, publishing only `-p 127.0.0.1:8081:8081` can leave the sandbox route unreachable.
+Keep the loopback publication and also publish `-p <Docker-gateway-IP>:8081:8081` for the OpenShell network.
+For a host process, configure its listener or forwarding so both addresses work.
+Retain native API-key authentication and restrict non-loopback access to the sandbox network.
+Onboarding stops when the existing network probe confirms that the attached server cannot be reached.
+
 Configure the server with its own supported mechanism before you run NemoClaw.
 Start the server with an explicit served model alias.
 A server that starts without an alias reports its model file path as the model ID.
```

**File**: `src/lib/onboard/machine/handlers/provider-inference-managed-llama-resume.test.ts` (modified, +63/-0)
```diff
@@ -87,6 +87,7 @@ describe("handleProviderInferenceState managed llama.cpp resume", () => {
 
       expect(recoverManagedLlamaCpp).toHaveBeenCalledOnce();
       expect(recoverManagedLlamaCpp).toHaveBeenCalledWith("llama-cpp-local", "spark-agent");
+      expect(calls.probeLlamaCppSandboxReachability).not.toHaveBeenCalled();
       expect(recoverManagedLlamaCpp.mock.invocationCallOrder[0]).toBeLessThan(
         calls.recoverProvider.mock.invocationCallOrder[0]!,
       );
@@ -105,6 +106,9 @@ describe("handleProviderInferenceState managed llama.cpp resume", () => {
 
   it("persists a fresh managed llama.cpp recipe through provider and inference completion", async () => {
     const { deps, calls } = createDeps({
+      probeLlamaCppSandboxReachability: vi.fn(async () => {
+        throw new Error("Managed runtime readiness must remain with its lifecycle owner.");
+      }),
       setupNim: vi.fn(async () => ({
         ...baseSelection,
         provider: "llama-cpp-local",
@@ -138,6 +142,65 @@ describe("handleProviderInferenceState managed llama.cpp resume", () => {
     });
   });
 
+  it.each([
+    { resume: false, reachable: false, result: "exit 1" },
+    { resume: true, reachable: false, result: "exit 1" },
+    { resume: false, reachable: true, result: "complete" },
+  ])(
+    "requires a reachable operator llama.cpp route (resume=$resume, reachable=$reachable)",
+    async ({ resume, reachable, result }) => {
+      const route = {
+        provider: "llama-cpp-local",
+        model: "team/model-alias",
+        endpointUrl: "http://127.0.0.1:8081/v1",
+        credentialEnv: "NEMOCLAW_LLAMACPP_LOCAL_TOKEN",
+        preferredInferenceApi: "openai-completions",
+      };
+      const session = createSession({
+        ...route,
+        sandboxName: "operator-agent",
+        sandboxPromptProgress: {
+          sandboxName: true,
+          webSearch: false,
+          messaging: false,
+          resourceProfile: false,
+        },
+      });
+      session.steps.provider_selection.status = resume ? "complete" : "pending";
+      const probeLlamaCppSandboxReachability = vi.fn(async () => ({
+        ok: reachable,
+        reason: reachable ? ("ok" as const) : ("tcp_failed" as const),
+        networkName: "openshell",
+        gatewayIp: "172.18.0.1",
+      }));
+      const setupNim = vi.fn(async () => ({ ...baseSelection, ...route }));
+      const { deps, calls } = createDeps({
+        setupNim,
+        isInferenceRouteReady: vi.fn(() => true),
+        probeLlamaCppSandboxReachability,
+      });
+
+      const outcome = await handleProviderInferenceState({
+        ...baseOptions(deps, session),
+        resume,
+        sandboxName: "operator-agent",
+      }).then(
+        () => "complete",
+        (error: Error) => error.message,
+      );
+      expect(outcome).toBe(result);
+      expect(calls.setupInference).toHaveBeenCalledTimes(reachable ? 1 : 0);
+      expect(calls.complete.mock.calls.some(([step]) => step === "inference")).toBe(reachable);
+      expect(
+        calls.error.mock.calls.some(([message]) =>
+          message.includes("host.openshell.internal:8081"),
+        ),
+      ).toBe(!reachable);
+      expect(probeLlamaCppSandboxReachability).toHaveBeenCalledOnce();
+      expect(setupNim).toHaveBeenCalledTimes(resume ? 0 : 1);
+    },
+  );
+
   it("persists installer vLLM profile provenance returned by provider setup (#11896)", async () => {
     const session = createSession({
       servingProfileProvenance: vllmProfile,
```

**File**: `src/lib/onboard/machine/handlers/provider-inference.test-support.ts` (modified, +6/-0)
```diff
@@ -119,6 +119,11 @@ export function createDeps(
       }),
     ),
     recoverManagedLlamaCpp: vi.fn(async () => false),
+    probeLlamaCppSandboxReachability: vi.fn(async () => ({
+      ok: true as const,
+      reason: "ok" as const,
+      networkName: "openshell",
+    })),
     surfaceReady: vi.fn(() => true),
     recordSkip: vi.fn(async () => createSession()),
     repairEvent: vi.fn(async () => createSession()),
@@ -177,6 +182,7 @@ export function createDeps(
       toSessionUpdates: (updates: Record<string, unknown>) => updates as SessionUpdates,
       skippedStepMessage: calls.skipped,
       ensureManagedLlamaCppResumeReady: calls.recoverManagedLlamaCpp,
+      probeLlamaCppSandboxReachability: calls.probeLlamaCppSandboxReachability,
       ensureResumeProviderReady: calls.recoverProvider,
       isResumeProviderSurfaceReady: calls.surfaceReady,
       recordStateSkipped: calls.recordSkip,
```

**File**: `src/lib/onboard/machine/handlers/provider-inference.ts` (modified, +40/-3)
```diff
@@ -17,6 +17,11 @@ import type { InferenceEndpointSource } from "../../../inference/selection";
 import type { ServingProfileProvenance } from "../../../inference/serving/types";
 import type { WebSearchConfig } from "../../../inference/web-search";
 import type { HermesAuthMethod, Session, SessionUpdates } from "../../../state/onboard-session";
+import { LLAMA_CPP_PORT } from "../../../inference/llama-cpp/contract";
+import {
+  probeHostServiceSandboxReachability,
+  type HostServiceReachabilityResult,
+} from "../../host-service-reachability";
 import { checkpointSandboxIdentityMatches } from "../../checkpoint-replay";
 import type { OnboardInferenceCapabilityCache } from "../../inference-capability-cache";
 import type { RepairLocalInferenceSystemdOverrideOptions } from "../../local-inference-topology";
@@ -240,6 +245,7 @@ export interface ProviderInferenceStateOptions<Gpu, Agent, Host> {
       sandboxName: string | null | undefined,
       revalidateSandboxIdentity?: (operation: string) => void,
     ): Promise<boolean>;
+    probeLlamaCppSandboxReachability?(): Promise<HostServiceReachabilityResult>;
     isResumeProviderSurfaceReady(
       gatewayName: string,
       provider: string | null | undefined,
@@ -749,9 +755,31 @@ async function ensureLegacyManagedLlamaCppResumeReady(
     provider: string | null | undefined,
     sandboxName: string | null | undefined,
   ) => Promise<boolean>,
+): Promise<boolean> {
+  if (selection?.setupOptions.hostLocalInference) return true;
+  return ensure(provider, sandboxName);
+}
+
+async function ensureAttachedLlamaCppReachable(
+  provider: string,
+  managed: boolean,
+  deps: Pick<
+    ProviderInferenceStateOptions<unknown, unknown, unknown>["deps"],
+    "error" | "exitProcess" | "probeLlamaCppSandboxReachability"
+  >,
 ): Promise<void> {
-  if (selection?.setupOptions.hostLocalInference) return;
-  await ensure(provider, sandboxName);
+  if (provider !== "llama-cpp-local" || managed) return;
+  const result = await (deps.probeLlamaCppSandboxReachability?.() ??
+    probeHostServiceSandboxReachability({ port: LLAMA_CPP_PORT }));
+  if (result.ok || result.reason !== "tcp_failed") return;
+  deps.error(
+    `  Sandbox containers cannot reach Local llama.cpp at host.openshell.internal:${LLAMA_CPP_PORT}.`,
+  );
+  deps.error(
+    `  Keep host-loopback access and bind or publish port ${LLAMA_CPP_PORT} on ${result.gatewayIp ?? "the Docker gateway address"} for the sandbox network.`,
+  );
+  deps.error("  Retain API-key authentication, check the host firewall, then retry onboarding.");
+  deps.exitProcess(1);
 }
 
 function endpointSourceForCurrentUrl(
@@ -1396,6 +1424,7 @@ export async function handleProviderInferenceState<Gpu, Agent, Host>({
     // route. Do not let a coincidentally ready gateway route skip setup.
     forceInferenceSetup ||=
       completeRecoveredReviewSelectionAfterInference || reviewRecoveredInteractively;
+    let managedLlamaCppRecovered = false;
     if (resumeProviderSelection) {
       assertOnboardReasoningEffortRoute(reasoningEffortRequest, provider, preferredInferenceApi);
       assertProviderInferenceRouteCompatible(deps, gatewayName, sandboxName, {
@@ -1410,7 +1439,7 @@ export async function handleProviderInferenceState<Gpu, Agent, Host>({
       // gateway-owned llama.cpp lifecycle before the selection shortcut can
       // skip setup. The dependency is a no-op for operator-attached llama.cpp
       // routes because those routes have no matching managed owner state.
-      await ensureLegacyManagedLlamaCppResumeReady(
+      managedLlamaCppRecovered = await ensureLegacyManagedLlamaCppResumeReady(
         earlyManagedHostLocalLifecycleSelection,
         provider,
         sandboxName,
@@ -1702,6 +1731,14 @@ export async function handleProviderInferenceState<Gpu, Agent, Host>({
     });
     sandboxName = hostLocalResume.sandboxName;
     const resumeHostLocalInferenceSetupOptions = hostLocalResume.setupOptions;
+    // Fresh selection and resume share this check; managed runtimes retain their own proof.
+    await ensureAttachedLlamaCppReachable(
+      selectedProvider,
+      managedLlamaCppRecovered ||
+        Boolean(resumeHostLocalInferenceSetupOptions.hostLocalInference) ||
+        servingProfileProvenance?.recipe?.backend === "install-llama-cpp",
+      deps,
+    );
     const resumedHostLocalPolicyRouteEvidence = resolvedHostLocalPolicyRouteEvidence(
       resumeHostLocalInferenceSetupOptions,
       selectedProvider,
```

**File**: `test/e2e/support/shared-e2e-workflow-boundary.test.ts` (modified, +2/-2)
```diff
@@ -144,9 +144,9 @@ const stagingReferenceVariants = [
 ];
 
 const actionMutations: Array<[string, (source: string) => string]> = [
-  ["artifact-id", (source) => source.replace('artifact-ids: "11018865557"', 'artifact-ids: "1"')],
+  ["artifact-id", (source) => source.replace('artifact-ids: "11204862350"', 'artifact-ids: "1"')],
   ["digest", (source) => source.replace(/sha256:[a-f0-9]{64}/, "sha256:" + "0".repeat(64))],
-  ["source-run", (source) => source.replace('run-id: "36534476155"', 'run-id: "1"')],
+  ["source-run", (source) => source.replace('run-id: "36952890255"', 'run-id: "1"')],
   [
     "verification-order",
     (source) => {
```

**File**: `tools/e2e/workflow-boundary-policy.mts` (modified, +2/-2)
```diff
@@ -23,8 +23,8 @@ export const E2E_ACTION_PROVENANCE = {
   },
   stageNativePodmanToolchains: {
     reference:
-      "NVIDIA/NemoClaw/.github/actions/stage-native-podman-e2e-toolchains@6b0acb521f2644fb48f8a735fde875ff798d9047",
-    contentSha256: "83416ddcd1db9e9517c93e896a6204d281eac9725ec7e0892cd3318d6b7a824f",
+      "NVIDIA/NemoClaw/.github/actions/stage-native-podman-e2e-toolchains@3c01bc3da31b816b1c62a3b41992010a6e01894d",
+    contentSha256: "1009a4b37b8e31ee2d20158150f92e20796a089bd8592a5c33995965173f0374",
   },
   restoreCliArtifact: {
     reference:
```

---

### Incident Patch 10: `f4d1ca89` (2026-10-04)
**Commit Message**: fix(e2e): reuse later trusted image publications (#12590)

<!-- markdownlint-disable MD041 -->
## Outcome

Trusted manual PR E2E can reuse a later successful image publication
when the PR base is an older first-parent ancestor of the trusted
workflow commit. The resolver still rejects unrelated history and
incomplete publication evidence.

## Reason

PR #12244's trusted E2E resolved its candidate catalog, then exhausted
the 300-second API budget because it excluded successful main
publications after the PR base. The selected workload never started.

### Related issues

Refs #12244

## Changes

- Build the manual non-head publication range from the trusted workflow
commit after proving that the PR base is on its first-parent history.
- Keep exact checked-out commit binding for main push and manual main
runs.
- Split first-parent regression coverage into a focused test file and
document the updated selection contract.

## Verification

- `npx --no-install vitest run --project e2e-support
test/e2e/support/base-image-publication.test.ts
test/e2e/support/base-image-publication-history.test.ts` — 77 tests
passed.
- `npm run test:changed` — growth guardrails passed and 136 changed
tests p

**File**: `test/e2e/README.md` (modified, +5/-2)
```diff
@@ -154,7 +154,8 @@ This boundary keeps candidate source separate from the trusted workflow implemen
 The `base-image-publication` job selects managed-image authority before any stock-onboarding consumer starts.
 
 For a manual same-repository PR run, the trusted planner compares immutable base and candidate commit trees against the reviewed image-input paths.
-When those paths are unchanged, the job selects the nearest fully successful cohort publication from the PR base's first-parent history.
+When those paths are unchanged, the planner finds the PR base's latest reviewed image input on the trusted workflow commit's first-parent history.
+It selects the nearest fully successful cohort publication at or after that commit.
 It downloads the complete cohort and Deep Agents Code base contracts by immutable artifact ID.
 It binds each artifact to the selected workflow run, attempt, revision, artifact ID, and digest.
 The cohort validator requires OpenClaw, Hermes, and LangChain Deep Agents Code on `linux/amd64` and `linux/arm64`.
@@ -1842,7 +1843,9 @@ The full-main `Release qualification` aggregate does not use this receipt.
 The `base-image-publication` job first resolves any authenticated PR managed-image catalog.
 When a PR catalog is selected, explicit targets with no `jobs` selector and no `managed-image-` target use it without waiting for main's base images.
 Other selections with a PR catalog retain the Deep Agents Code base prerequisite, including full runs and protected managed-image build targets.
-Runs without a PR catalog require a trusted main base and managed-image publication; PR runs select the nearest fully successful publication on the PR base first-parent history.
+Runs without a PR catalog require a trusted main base and managed-image publication.
+PR runs select the nearest fully successful publication on the trusted workflow commit's first-parent history.
+The publication must cover the PR base's latest reviewed image input.
 For that publication, the job binds the run ID, attempt, revision, cohort artifact ID, and artifact digest before it emits `managed_image_revision`.
 It validates the complete three-agent, two-architecture cohort artifact and the immutable Deep Agents Code base artifact from that workflow attempt.
 `generate-matrix` and every stock-onboarding job depend on this publication job, so incomplete publication creates no onboarding fanout.
```

**File**: `test/e2e/support/base-image-publication-history.test.ts` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
+// SPDX-License-Identifier: Apache-2.0
+
+import { describe, expect, it } from "vitest";
+
+import {
+  resolveFirstParentHistory,
+  selectPublicationRun,
+} from "../../../tools/e2e/base-image-publication.mts";
+
+const EXPECTED_SHA = "a".repeat(40);
+const DESCENDANT_SHA = "b".repeat(40);
+const RELEVANT_SHA = "c".repeat(40);
+const STALE_SHA = "d".repeat(40);
+const WORKFLOW_ID = 251475843;
+const RUN_URL_ROOT = "https://github.com/NVIDIA/NemoClaw/actions/runs";
+
+function required<T>(value: T | undefined): T {
+  return (
+    value ??
+    (() => {
+      throw new Error("unexpected Git history request");
+    })()
+  );
+}
+
+function historyResponse(args: string[], checkedOutSha: string, firstParentShas: string): string {
+  const responses = new Map([
+    ["rev-parse:--verify", checkedOutSha],
+    ["rev-parse:--is-shallow-repository", "false"],
+    ["log:--first-parent", RELEVANT_SHA],
+    ["rev-list:--first-parent", firstParentShas],
+  ]);
+  return required(responses.get(`${args[0]}:${args[1]}`));
+}
+
+function publicationRun(id: number, headSha: string): Record<string, unknown> {
+  return {
+    id,
+    run_attempt: 1,
+    workflow_id: WORKFLOW_ID,
+    name: "Images / Publish Base and Managed Images",
+    event: "push",
+    status: "completed",
+    conclusion: "success",
+    head_sha: headSha,
+    head_branch: "main",
+    path: ".github/workflows/base-image.yaml",
+    repository: { full_name: "NVIDIA/NemoClaw" },
+    head_repository: { full_name: "NVIDIA/NemoClaw" },
+    html_url: `${RUN_URL_ROOT}/${id}`,
+  };
+}
+
+function runsPayload(runs: unknown[]): Record<string, unknown> {
+  return { total_count: runs.length, workflow_runs: runs };
+}
+
+describe("base-image publication first-parent history", () => {
+  it("binds the applicable commit to the checked-out first-parent chain (#7372)", () => {
+    const calls: string[][] = [];
+    const resolved = resolveFirstParentHistory(EXPECTED_SHA, ["Dockerfile.base"], (args) => {
+      calls.push(args);
+      return historyResponse(
+        args,
+        EXPECTED_SHA,
+        `${EXPECTED_SHA}\n${DESCENDANT_SHA}\n${RELEVANT_SHA}\n${STALE_SHA}`,
+      );
+    });
+
+    expect(resolved.relevantSha).toBe(RELEVANT_SHA);
+    expect([...resolved.distanceBySha]).toEqual([
+      [EXPECTED_SHA, 0],
+      [DESCENDANT_SHA, 1],
+      [RELEVANT_SHA, 2],
+    ]);
+    expect(calls[2]).toEqual([
+      "log",
+      "--first-parent",
+      "-n",
+      "1",
+      "--format=%H",
+      EXPECTED_SHA,
+      "--",
+      "Dockerfile.base",
+    ]);
+  });
+
+  it("accepts a later trusted publication for an older PR base", () => {
+    const calls: string[][] = [];
+    const resolved = resolveFirstParentHistory(
+      EXPECTED_SHA,
+      ["Dockerfile.base"],
+      (args) => {
+        calls.push(args);
+        return historyResponse(
+          args,
+          DESCENDANT_SHA,
+          `${DESCENDANT_SHA}\n${EXPECTED_SHA}\n${RELEVANT_SHA}\n${STALE_SHA}`,
+        );
+      },
+      { allowCheckedOutDescendant: true },
+    );
+
+    expect([...resolved.distanceBySha]).toEqual([
+      [DESCENDANT_SHA, 0],
+      [EXPECTED_SHA, 1],
+      [RELEVANT_SHA, 2],
+    ]);
+    expect(calls[3]).toEqual(["rev-list", "--first-parent", DESCENDANT_SHA]);
+  });
+
+  it("passes later trusted history directly into publication selection", () => {
+    const resolved = resolveFirstParentHistory(
+      EXPECTED_SHA,
+      ["Dockerfile.base"],
+      (args) =>
+        historyResponse(
+          args,
+          DESCENDANT_SHA,
+          `${DESCENDANT_SHA}\n${EXPECTED_SHA}\n${RELEVANT_SHA}\n${STALE_SHA}`,
+        ),
+      { allowCheckedOutDescendant: true },
+    );
+    const descendantRun = publicationRun(101, DESCENDANT_SHA);
+    const staleRun = publicationRun(100, STALE_SHA);
+
+    expect(
+      selectPublicationRun(runsPayload([staleRun, descendantRun]), resolved, WORKFLOW_ID, {
+        completedSuccessOnly: true,
+      }),
+    ).toMatchObject({ state: "selected", run: { id: 101, headSha: DESCENDANT_SHA } });
+    expect(
+      selectPublicationRun(runsPayload([staleRun]), resolved, WORKFLOW_ID, {
+        completedSuccessOnly: true,
+      }),
+    ).toEqual({ state: "missing" });
+  });
+
+  it("rejects an older PR base outside the checked-out first-parent history", () => {
+    expect(() =>
+      resolveFirstParentHistory(
+        EXPECTED_SHA,
+        ["Dockerfile.base"],
+        (args) => historyResponse(args, DESCENDANT_SHA, `${DESCENDANT_SHA}\n${RELEVANT_SHA}`),
+        { allowCheckedOutDescendant: true },
+      ),
+    ).toThrow(/expected SHA is not on the checked-out first-parent history/u);
+  });
+});
```

**File**: `test/e2e/support/base-image-publication.test.ts` (modified, +0/-29)
```diff
@@ -264,35 +264,6 @@ describe("base-image publication evidence", () => {
     ).toBe(true);
   });
 
-  it("binds the applicable commit to the checked-out first-parent chain (#7372)", () => {
-    const calls: string[][] = [];
-    const resolved = resolveFirstParentHistory(EXPECTED_SHA, ["Dockerfile.base"], (args) => {
-      calls.push(args);
-      return historyGitResponse(
-        args,
-        RELEVANT_SHA,
-        `${EXPECTED_SHA}\n${DESCENDANT_SHA}\n${RELEVANT_SHA}\n${STALE_SHA}`,
-      );
-    });
-
-    expect(resolved.relevantSha).toBe(RELEVANT_SHA);
-    expect([...resolved.distanceBySha]).toEqual([
-      [EXPECTED_SHA, 0],
-      [DESCENDANT_SHA, 1],
-      [RELEVANT_SHA, 2],
-    ]);
-    expect(calls[2]).toEqual([
-      "log",
-      "--first-parent",
-      "-n",
-      "1",
-      "--format=%H",
-      EXPECTED_SHA,
-      "--",
-      "Dockerfile.base",
-    ]);
-  });
-
   it("selects the merge commit instead of its side-branch source commit (#7372)", () => {
     const directory = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-publication-history-"));
     const git = (...args: string[]) =>
```

**File**: `tools/e2e/base-image-publication.mts` (modified, +12/-6)
```diff
@@ -381,13 +381,14 @@ export function resolveFirstParentHistory(
   expectedSha: string,
   paths: readonly string[],
   runGit: (args: string[]) => string = defaultGit,
-  options: { readonly requireCheckedOutCommit?: boolean } = {},
+  options: { readonly allowCheckedOutDescendant?: boolean } = {},
 ): FirstParentHistory {
   sha(expectedSha, "expected SHA");
   if (paths.length === 0) throw new Error("at least one base-image path is required");
 
   const checkedOutSha = runGit(["rev-parse", "--verify", "HEAD^{commit}"]);
-  if (options.requireCheckedOutCommit !== false && checkedOutSha !== expectedSha) {
+  sha(checkedOutSha, "checked-out commit");
+  if (options.allowCheckedOutDescendant !== true && checkedOutSha !== expectedSha) {
     throw new Error(
       `checked-out commit ${checkedOutSha || "missing"} does not match ${expectedSha}`,
     );
@@ -412,18 +413,23 @@ export function resolveFirstParentHistory(
   ]);
   sha(relevantSha, "latest applicable base-image commit");
 
-  const firstParentShas = runGit(["rev-list", "--first-parent", expectedSha])
+  const historyHeadSha = options.allowCheckedOutDescendant === true ? checkedOutSha : expectedSha;
+  const firstParentShas = runGit(["rev-list", "--first-parent", historyHeadSha])
     .split(/\r?\n/u)
     .filter(Boolean);
-  if (firstParentShas.length === 0 || firstParentShas[0] !== expectedSha) {
-    throw new Error("first-parent history must begin at the expected SHA");
+  if (firstParentShas.length === 0 || firstParentShas[0] !== historyHeadSha) {
+    throw new Error("first-parent history must begin at the selected history commit");
   }
   if (new Set(firstParentShas).size !== firstParentShas.length) {
     throw new Error("first-parent history must not contain duplicate commits");
   }
   for (const [index, value] of firstParentShas.entries())
     sha(value, `first-parent commit ${index}`);
 
+  if (!firstParentShas.includes(expectedSha)) {
+    throw new Error("expected SHA is not on the checked-out first-parent history");
+  }
+
   const relevantDistance = firstParentShas.indexOf(relevantSha);
   if (relevantDistance < 0) {
     throw new Error("latest applicable base-image commit is not on the first-parent history");
@@ -1096,7 +1102,7 @@ export async function main(argv = process.argv.slice(2), env = process.env): Pro
       : readFileSync(resolve(workspace, WORKFLOW_PATH), "utf8");
   const paths = parseBaseImagePushPaths(workflowSource);
   const history = resolveFirstParentHistory(expectedSha, paths, defaultGit, {
-    requireCheckedOutCommit: allowNonHeadHistory !== "1",
+    allowCheckedOutDescendant: allowNonHeadHistory === "1",
   });
   const run = await waitForBaseImagePublication({
     history,
```

---

### Incident Patch 11: `59468d70` (2026-10-02)
**Commit Message**: fix(tunnel): validate cloudflared PID identity (#12491)

## Outcome

`nemoclaw tunnel start` no longer treats an unrelated live process as an
existing cloudflared tunnel when a stale PID file points at that
process. It starts a fresh tunnel and returns the fresh public URL
without signaling the unrelated process. If the live PID cannot be
identified or signaled through an identity-bound operating-system API,
NemoClaw preserves the process and PID record, reports a concrete manual
recovery action, and exits nonzero instead of claiming success.

## Reason

Operating systems can reuse process IDs. Start, status, stop, and URL
readiness previously disagreed about whether the recorded PID still
belonged to cloudflared, so start could reuse an old URL and cleanup
could signal a process whose identity was unavailable.

### Related issues

Fixes #12405

## Changes

- Use the shared cloudflared identity-aware state for start, stop, URL
readiness, service status, and doctor diagnostics instead of liveness
alone.
- Distinguish unrelated, unreadable, and shell-wrapped live PIDs.
Unrelated PIDs are replaced without being signaled; unreadable and
wrapped PIDs are preserved and block duplicate tu

**File**: `docs/manage-sandboxes/run-sandboxes.mdx` (modified, +4/-0)
```diff
@@ -163,12 +163,14 @@ Use [`$$nemoclaw <name> destroy`](../../reference/commands#$$nemoclaw-name-destr
 When the host has `cloudflared`, `$$nemoclaw tunnel start` starts a Cloudflare tunnel.
 The tunnel can expose the dashboard with a public URL.
 Set `CLOUDFLARE_TUNNEL_TOKEN` before running the command when you want to use a Cloudflare named tunnel instead of a generated quick-tunnel URL.
+If a live recorded PID cannot be inspected, NemoClaw refuses to create a second tunnel. Restore process-inspection access, then retry; [`$$nemoclaw tunnel status`](../../reference/commands#$$nemoclaw-tunnel-status) reports this recovery state.
 
 ```bash
 $$nemoclaw tunnel start
 ```
 
 `$$nemoclaw tunnel stop` stops the tunnel and asks NemoClaw to stop the in-sandbox gateway for the selected or default sandbox.
+If NemoClaw reports incomplete tunnel cleanup, independently verify and stop the recorded cloudflared process with the host process manager, keep the PID record until that process exits, then retry the command.
 The older `$$nemoclaw start` now prints migration guidance and exits successfully without starting
 a sandbox or tunnel. Use `$$nemoclaw <name> start` or `$$nemoclaw tunnel start` explicitly.
 </AgentOnly>
@@ -179,12 +181,14 @@ a sandbox or tunnel. Use `$$nemoclaw <name> start` or `$$nemoclaw tunnel start`
 When the host has `cloudflared`, `$$nemoclaw tunnel start` starts a Cloudflare tunnel.
 The tunnel can expose the forwarded Hermes endpoint with a public URL.
 Set `CLOUDFLARE_TUNNEL_TOKEN` before running the command when you want to use a Cloudflare named tunnel instead of a generated quick-tunnel URL.
+If a live recorded PID cannot be inspected, NemoClaw refuses to create a second tunnel. Restore process-inspection access, then retry; [`$$nemoclaw tunnel status`](../../reference/commands#$$nemoclaw-tunnel-status) reports this recovery state.
 
 ```bash
 $$nemoclaw tunnel start
 ```
 
 `$$nemoclaw tunnel stop` stops the tunnel but leaves the supervisor-owned in-sandbox gateway and agent-owned host forwards running for the selected or default sandbox.
+If NemoClaw reports incomplete tunnel cleanup, independently verify and stop the recorded cloudflared process with the host process manager, keep the PID record until that process exits, then retry the command.
 </AgentOnly>
 
 ## Related Topics
```

**File**: `docs/manage-sandboxes/set-up-google-chat.mdx` (modified, +1/-0)
```diff
@@ -65,6 +65,7 @@ nemoclaw my-assistant channels remove googlechat
 Replace `my-assistant` with your sandbox name.
 The command attempts endpoint teardown even when interrupted enrollment left no Google Chat registry record.
 If the command reports that it could not stop the tunnel, correct the host service and run the command again before retrying enrollment.
+On any host where NemoClaw cannot inspect the recorded cloudflared process or signal it through an identity-bound operating-system API, independently verify and stop that process with the host process manager, keep the PID record until that process exits, then rerun the removal command.
 A removal that completes without cleanup warnings stops the dedicated tunnel and webhook proxy, removes any partial bridge provider and policy preset, and removes Google Chat from the durable messaging plan.
 
 If `GOOGLECHAT_AUDIENCE` already contains the public webhook URL, NemoClaw uses it and does not start or change cloudflared.
```

**File**: `docs/reference/commands.mdx` (modified, +3/-1)
```diff
@@ -3363,11 +3363,13 @@ $$nemoclaw tunnel stop
 
 The command asks NemoClaw to stop an in-sandbox gateway only when NemoClaw directly owns that process. Supervisor-owned agent runtime processes remain managed inside their sandbox. The command leaves agent-owned host forwards and the managed OpenShell gateway port available.
 
+If the recorded cloudflared PID is live but its process identity cannot be inspected or identity-bound signaling is unavailable, NemoClaw leaves the PID and process untouched and reports incomplete cleanup. Automatic identity-bound signaling uses Linux pidfd support or a macOS audit token. On any host where automatic signaling is unavailable, independently verify and stop the recorded cloudflared process with the host process manager, keep the PID record until that process exits, then retry `$$nemoclaw tunnel stop`.
+
 `$$nemoclaw stop` remains as a deprecated legacy full stop. In addition to stopping tunnel services, it attempts to stop the selected agent's host forwards when the sandbox uses a manifest-resolved non-OpenClaw agent. It also attempts to safely release an unshared OpenShell gateway port whose ownership NemoClaw can verify. Shared gateways remain running, and ambiguous ownership fails closed without releasing the port. Use `$$nemoclaw tunnel stop` when the shared gateway should remain available.
 
 ### `$$nemoclaw tunnel status`
 
-Show the current cloudflared public-URL tunnel status for the selected or default sandbox dashboard. The output reports whether cloudflared is running, stopped, or stale, and includes the same recovery hint used by `$$nemoclaw status`. Selection honors `NEMOCLAW_SANDBOX_NAME`, then `NEMOCLAW_SANDBOX`, then `SANDBOX_NAME`, then the registry default.
+Show the current cloudflared public-URL tunnel status for the selected or default sandbox dashboard. The output reports whether cloudflared is running, stopped, stale, or has a live PID whose process identity cannot be inspected. When identity is unavailable, `$$nemoclaw tunnel start` refuses to create a second tunnel; restore process-inspection access and retry. Other stopped and stale states include the same recovery hint used by `$$nemoclaw status`. Selection honors `NEMOCLAW_SANDBOX_NAME`, then `NEMOCLAW_SANDBOX`, then `SANDBOX_NAME`, then the registry default.
 
 ```bash
 $$nemoclaw tunnel status
```

**File**: `src/lib/actions/sandbox/doctor-system-checks.test.ts` (modified, +17/-0)
```diff
@@ -156,4 +156,21 @@ describe("doctor system checks", () => {
       hint: "start Ollama or change the sandbox inference provider",
     });
   });
+
+  it("reports unreadable cloudflared identity with safe recovery guidance", () => {
+    const { cloudflaredDoctorCheck } = requireDist(modulePath);
+
+    expect(
+      cloudflaredDoctorCheck("my-sandbox", () => ({
+        kind: "unverified-pid-process",
+        pid: 4242,
+      })),
+    ).toEqual({
+      group: "Local services",
+      label: "cloudflared",
+      status: "warn",
+      detail: "PID 4242, identity unavailable",
+      hint: "process identity is unavailable; restore process inspection access, then retry",
+    });
+  });
 });
```

**File**: `src/lib/actions/sandbox/doctor-system-checks.ts` (modified, +17/-2)
```diff
@@ -157,15 +157,30 @@ function staleCloudflaredPidCheck(pid: number): DoctorCheck {
   };
 }
 
-export function cloudflaredDoctorCheck(sandboxName: string): DoctorCheck {
-  const state = readCloudflaredState(path.join("/tmp", `nemoclaw-services-${sandboxName}`));
+function unverifiedCloudflaredPidCheck(pid: number): DoctorCheck {
+  return {
+    group: "Local services",
+    label: "cloudflared",
+    status: "warn",
+    detail: `PID ${pid}, identity unavailable`,
+    hint: "process identity is unavailable; restore process inspection access, then retry",
+  };
+}
+
+export function cloudflaredDoctorCheck(
+  sandboxName: string,
+  readState: typeof readCloudflaredState = readCloudflaredState,
+): DoctorCheck {
+  const state = readState(path.join("/tmp", `nemoclaw-services-${sandboxName}`));
   switch (state.kind) {
     case "stopped":
       return stoppedCloudflaredCheck();
     case "stale-pid-file":
       return staleCloudflaredPidFileCheck();
     case "stale-pid-process":
       return staleCloudflaredPidCheck(state.pid);
+    case "unverified-pid-process":
+      return unverifiedCloudflaredPidCheck(state.pid);
     case "running":
       return {
         group: "Local services",
```

**File**: `src/lib/messaging/channels/googlechat/hooks/tunnel-runtime.test.ts` (modified, +61/-3)
```diff
@@ -8,7 +8,7 @@ describe("Google Chat tunnel runtime", () => {
   it("targets a dedicated route-restricted proxy instead of the dashboard", async () => {
     const pidDir = "/tmp/nemoclaw-services-test-googlechat";
     const startAll = vi.fn(async () => undefined);
-    const stopCloudflared = vi.fn();
+    const stopCloudflared = vi.fn(() => true);
     const stopGooglechatWebhookProxy = vi.fn();
     const startGooglechatWebhookProxy = vi.fn(async () => 24680);
     const services = {
@@ -57,7 +57,7 @@ describe("Google Chat tunnel runtime", () => {
         readCloudflaredState: () => ({ kind: "running", pid: 123 }),
         resolveServicePidDir: () => "/tmp/nemoclaw-services-test",
         startAll: async () => undefined,
-        stopCloudflared: () => undefined,
+        stopCloudflared: () => true,
       }),
       loadWebhookProxy: () => ({
         readGooglechatWebhookProxyState: () => ({
@@ -85,7 +85,7 @@ describe("Google Chat tunnel runtime", () => {
         startAll: async () => {
           throw new Error("cloudflared failed");
         },
-        stopCloudflared: () => undefined,
+        stopCloudflared: () => true,
       }),
       loadWebhookProxy: () => ({
         readGooglechatWebhookProxyState: () => ({
@@ -104,4 +104,62 @@ describe("Google Chat tunnel runtime", () => {
       "/tmp/nemoclaw-services-test-googlechat",
     );
   });
+
+  it("preserves the route proxy when cloudflared cleanup is unverified", () => {
+    const stopGooglechatWebhookProxy = vi.fn();
+    const options = createDefaultGooglechatTunnelGateOptions({
+      loadServices: () => ({
+        getTunnelUrl: () => "https://restricted.trycloudflare.com",
+        readCloudflaredState: () => ({ kind: "unverified-pid-process", pid: 4242 }),
+        resolveServicePidDir: () => "/tmp/nemoclaw-services-test",
+        startAll: async () => undefined,
+        stopCloudflared: () => false,
+      }),
+      loadWebhookProxy: () => ({
+        readGooglechatWebhookProxyState: () => ({
+          running: true,
+          port: 24680,
+          upstreamPort: 18789,
+        }),
+        startGooglechatWebhookProxy: async () => 24680,
+        stopGooglechatWebhookProxy,
+      }),
+      sandboxName: "test",
+    });
+
+    expect(() => options.stopTunnel?.()).toThrow(
+      "Google Chat tunnel cleanup is incomplete because cloudflared could not be confirmed stopped",
+    );
+    expect(stopGooglechatWebhookProxy).not.toHaveBeenCalled();
+  });
+
+  it("does not start a route proxy when prior cloudflared cleanup is unverified", async () => {
+    const startAll = vi.fn(async () => undefined);
+    const startGooglechatWebhookProxy = vi.fn(async () => 24680);
+    const options = createDefaultGooglechatTunnelGateOptions({
+      loadServices: () => ({
+        getTunnelUrl: () => "",
+        readCloudflaredState: () => ({ kind: "unverified-pid-process", pid: 4242 }),
+        resolveServicePidDir: () => "/tmp/nemoclaw-services-test",
+        startAll,
+        stopCloudflared: () => false,
+      }),
+      loadWebhookProxy: () => ({
+        readGooglechatWebhookProxyState: () => ({
+          running: false,
+          port: null,
+          upstreamPort: null,
+        }),
+        startGooglechatWebhookProxy,
+        stopGooglechatWebhookProxy: vi.fn(),
+      }),
+      sandboxName: "test",
+    });
+
+    await expect(options.startTunnel?.()).rejects.toThrow(
+      "Google Chat tunnel cleanup is incomplete because cloudflared could not be confirmed stopped",
+    );
+    expect(startGooglechatWebhookProxy).not.toHaveBeenCalled();
+    expect(startAll).not.toHaveBeenCalled();
+  });
 });
```

**File**: `src/lib/messaging/channels/googlechat/hooks/tunnel-runtime.ts` (modified, +7/-2)
```diff
@@ -2,6 +2,7 @@
 // SPDX-License-Identifier: Apache-2.0
 
 import { DASHBOARD_PORT } from "../../../../core/ports";
+import { GOOGLECHAT_TUNNEL_CLEANUP_ERROR } from "../tunnel/lifecycle";
 import { googlechatWebhookTunnelPidDir } from "../tunnel/pid-dir";
 import type { GooglechatTunnelAudienceGateHookOptions } from "./tunnel-audience-gate";
 
@@ -83,7 +84,9 @@ export function createDefaultGooglechatTunnelGateOptions(
       const { startAll, stopCloudflared } = loadServices();
       const { startGooglechatWebhookProxy, stopGooglechatWebhookProxy } = loadWebhookProxy();
       const pidDir = resolveGooglechatPidDir();
-      stopCloudflared({ pidDir });
+      if (!stopCloudflared({ pidDir })) {
+        throw new Error(GOOGLECHAT_TUNNEL_CLEANUP_ERROR);
+      }
       const proxyPort = await startGooglechatWebhookProxy(pidDir, dashboardPort);
       try {
         await startAll({
@@ -101,7 +104,9 @@ export function createDefaultGooglechatTunnelGateOptions(
       const { stopCloudflared } = loadServices();
       const { stopGooglechatWebhookProxy } = loadWebhookProxy();
       const pidDir = resolveGooglechatPidDir();
-      stopCloudflared({ pidDir });
+      if (!stopCloudflared({ pidDir })) {
+        throw new Error(GOOGLECHAT_TUNNEL_CLEANUP_ERROR);
+      }
       stopGooglechatWebhookProxy(pidDir);
     },
     getTunnelUrl: () => {
```

**File**: `src/lib/messaging/channels/googlechat/tunnel/lifecycle.test.ts` (modified, +20/-3)
```diff
@@ -8,7 +8,7 @@ import { googlechatWebhookTunnelPidDir, stopGooglechatWebhookTunnel } from "./li
 
 describe("Google Chat webhook tunnel lifecycle", () => {
   it("stops the sandbox-scoped cloudflared process and route proxy", () => {
-    const stopCloudflared = vi.fn();
+    const stopCloudflared = vi.fn(() => true);
     const stopGooglechatWebhookProxy = vi.fn();
     const pidDir = stopGooglechatWebhookTunnel("alpha", {
       services: {
@@ -41,7 +41,7 @@ describe("Google Chat webhook tunnel lifecycle", () => {
         readCloudflaredState,
         resolveServicePidDir,
         startAll: async () => undefined,
-        stopCloudflared: () => undefined,
+        stopCloudflared: () => true,
       }),
       loadWebhookProxy: () => ({
         readGooglechatWebhookProxyState,
@@ -55,12 +55,29 @@ describe("Google Chat webhook tunnel lifecycle", () => {
     const teardownPidDir = stopGooglechatWebhookTunnel("alpha", {
       services: {
         resolveServicePidDir,
-        stopCloudflared: () => undefined,
+        stopCloudflared: () => true,
       },
       webhookProxy: { stopGooglechatWebhookProxy: () => undefined },
     });
 
     expect(readCloudflaredState).toHaveBeenCalledWith(teardownPidDir);
     expect(readGooglechatWebhookProxyState).toHaveBeenCalledWith(teardownPidDir);
   });
+
+  it("preserves the route proxy when cloudflared cleanup is unverified", () => {
+    const stopGooglechatWebhookProxy = vi.fn();
+
+    expect(() =>
+      stopGooglechatWebhookTunnel("alpha", {
+        services: {
+          resolveServicePidDir: () => "/tmp/nemoclaw-services-alpha",
+          stopCloudflared: () => false,
+        },
+        webhookProxy: { stopGooglechatWebhookProxy },
+      }),
+    ).toThrow(
+      "Google Chat tunnel cleanup is incomplete because cloudflared could not be confirmed stopped",
+    );
+    expect(stopGooglechatWebhookProxy).not.toHaveBeenCalled();
+  });
 });
```

---

### Incident Patch 12: `a4ab72ee` (2026-10-02)
**Commit Message**: fix(state): persist complete native agent home (#12340)

## Outcome

Native agents now retain their complete OpenShell-backed home and
workspace instead of a NemoClaw-selected inventory of directories and
files. Routine stop, start, and reconnect continue to rely on OpenShell
storage; unavoidable rebuilds transfer the whole native agent root
without copying OpenShell-owned host credentials.

## Reason

Selective snapshots and per-agent allowlists could discard valid but
unrecognized configuration, history, hooks, plugins, packages, cron
data, and child-agent state. The basic onboarder should preserve native
agent storage without imposing a second state model.

Fixes #11767

## Changes

- Capture the complete native agent root for both live and stopped
rebuild sources as a digest-bound `native-home.tar` archive.
- Quiesce same-UID sandbox processes during live capture so the archive
and digest describe one consistent filesystem boundary.
- Require valid version-2 native-state metadata before destructive
rebuild phases and restore through a target-filesystem staging path.
- Preserve symlinks while rejecting traversal, write-through, and
hard-link attacks before extraction, including 

**File**: `README.md` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
 [![Discord](https://img.shields.io/badge/Discord-Join-7289da)](https://discord.gg/XFpfPv9Uvx)
 
 NVIDIA NemoClaw is an open source reference stack for running supported AI agents more safely inside [NVIDIA OpenShell](https://github.com/NVIDIA/OpenShell) sandboxes.
-It provides guided onboarding, managed inference, network policy, managed integrations, snapshots, and lifecycle operations through the NemoClaw CLI and its agent-specific aliases.
+It provides guided onboarding, managed inference, network policy, managed integrations, OpenShell-backed state persistence, and lifecycle operations through the NemoClaw CLI and its agent-specific aliases.
 
 **Supported agents:**
 
```

**File**: `agents/hermes/manifest.yaml` (modified, +2/-75)
```diff
@@ -67,83 +67,10 @@ skills:
   writable_root: /sandbox/.hermes/skills
   list_command: [skills, list]
 
-# ── State directories ──────────────────────────────────────────
-state_dirs:
-  - memories
-  # Hermes lazy dependency installs persist across rebuilds.
-  - path: lazy-packages
-    clear_when_absent: false
-  - sessions
-  - skills
-  - path: plugins
-    clear_when_absent: false
-  - cron
-  # User-authored cron scripts are part of the job definition contract. Keep
-  # them in the same rebuild backup so active jobs never outlive their inputs.
-  - scripts
-  # Hermes creates this machine-local integration directory. Keep it outside
-  # portable snapshot state.
-  - path: hooks
-    backup: false
-  - logs
-  - skins
-  - plans
-  - workspace
-  - profiles
-  - cache
-  - pairing
-  # Retired pre-#7200 dashboard state is accepted only as a non-backup
-  # migration source. Startup moves safe contents into the native Hermes home
-  # and removes the legacy directory; new snapshots never perpetuate it.
-  - path: dashboard-home
-    backup: false
-  # Hermes' WhatsApp bridge stores QR-paired session credentials under
-  # ~/.hermes/platforms/whatsapp/session. Preserve the parent so rebuilds
-  # keep the in-sandbox pairing state without re-scanning.
-  - platforms
-  # Hermes' iLink WeChat adapter persists per-account context tokens under
-  # ~/.hermes/weixin/accounts/<id>.context-tokens.json so the long-poll
-  # cursor survives a rebuild. The bot token itself comes from .env via
-  # the L7 proxy and is not stored on disk inside the sandbox.
-  - weixin
-
-# ── Top-level durable state files ───────────────────────────────
-# NemoClaw stores Hermes gateway-created top-level state under runtime/ and
-# exposes compatibility symlinks such as .hermes/state.db -> runtime/state.db.
-# The SQLite database is captured with SQLite's online backup API; WAL/SHM
-# files are intentionally omitted because the backup produces a consistent DB.
-# .hermes_history is user runtime history: prompt_toolkit appends to it on
-# every TUI keypress. It can be removed from this contract if upstream Hermes
-# supports redirecting or disabling FileHistory.
-state_files:
-  - path: SOUL.md
-  - path: .hermes_history
-  - path: runtime/state.db
-    strategy: sqlite_backup
-  # Hermes 0.19 records default-profile cron execution history in a separate
-  # SQLite ledger. NemoClaw relocates only this mutable database below runtime
-  # so cron job definitions remain separate. Named profiles live
-  # below profiles/<name>/ and remain part of the raw profiles state-dir
-  # capture until dynamic profile-local SQLite discovery is supported.
-  - path: runtime/cron-executions.db
-    strategy: sqlite_backup
-  # Hermes 0.19 uses this default-profile ledger to replay Discord messages
-  # after reconnects. Named-profile copies have the same raw-capture limitation
-  # described above.
-  - path: gateway/discord_message_recovery.db
-    strategy: sqlite_backup
-  # Hermes' backward-compatible default board lives in this SQLite database.
-  # Capture it with the online backup API like runtime/state.db; the zero-byte
-  # kanban.db.*.lock files are intentionally omitted. This does not cover named
-  # boards, attachments, worker logs, or scratch workspaces under kanban/, nor
-  # external dir/worktree workspace targets. Those need a separate durability
-  # design before the sibling kanban/ tree can safely enter the state contract.
-  - path: kanban.db
-    strategy: sqlite_backup
 user_managed_files:
   # Relative to /sandbox, not config.dir. Hermes stores user-edited API-key
-  # values in /sandbox/.hermes/.env, and rebuild should warn before dropping
-  # values outside the allowlisted home-channel preservation inventory.
+  # values in /sandbox/.hermes/.env. Rebuild captures the complete native
+  # home/workspace and aborts when the credential scan rejects the archive.
   - .hermes/.env
 
 # ── Authentication ──────────────────────────────────────────────
```

**File**: `agents/hermes/start.sh` (modified, +6/-0)
```diff
@@ -3240,6 +3240,12 @@ wait_for_hermes_gateway_recovery_request() {
 
 relaunch_hermes_gateway_current_user() {
   mark_hermes_gateway_stopped
+  # The native home can change while the gateway is stopped (notably when a
+  # rebuild restores the complete pre-delete home). Re-establish the same
+  # validated mutable-config posture used at initial startup before every
+  # supervised replacement reads it. This also mints fresh machine-local API
+  # authority after the archive sanitizer deliberately removes the old token.
+  prepare_hermes_nonroot_runtime || return $?
   launch_hermes_gateway_current_user || return $?
   wait_for_hermes_gateway_internal "$GATEWAY_PID" || return $?
   ensure_hermes_supervised_auxiliaries || return $?
```

**File**: `agents/langchain-deepagents-code/manifest.yaml` (modified, +0/-74)
```diff
@@ -45,84 +45,10 @@ skills:
   remove_command: [skills, delete, "{name}", --agent, agent, --force, --json]
   verified_content_digest: sha256
 
-# ── State directories ──────────────────────────────────────────
-# dcode runs with HOME=/sandbox, so its state dirs resolve under
-# /sandbox/.deepagents. The built-in skill-creator writes user skills to
-# agent/skills (per its init_skill.py), so that agent-owned root is preserved.
-state_dirs:
-  - .state
-  - agent/skills
-
-# ── Top-level durable state files ───────────────────────────────
-# config.toml mixes DCode preferences with NemoClaw-managed model routing.
-# Ownership is split into three explicit buckets. Users own only the allowlisted
-# UI and thread preferences, native interpreter settings, and the startup
-# approval mode below. NemoClaw owns the fresh models/update tables and generated
-# provider headers. Unknown, privileged, and security-sensitive backup keys are
-# not restorable and are dropped.
-# .env is intentionally omitted because it may contain service credentials.
 # .deepagents/.mcp.json is the agent-owned MCP source. NemoClaw writes only
 # direct-HTTP endpoint config and OpenShell placeholders, preserves unrelated
 # native entries, and carries managed entries through the bounded rebuild
 # handoff instead of a host-side registry projection.
-state_files:
-  - path: config.toml
-    restore:
-      merge: key-allowlist
-      require_fresh_tables:
-        - models
-        - update
-      # Checked positionally: the first N leading '#' lines (N = entries below)
-      # must match. Further leading comments are safety-checked and preserved.
-      require_fresh_headers:
-        - "# Generated by NemoClaw. This file contains no provider secrets."
-        - match: prefix
-          value: "# NemoClaw provider route: "
-      user_keys:
-        - key: ui.show_scrollbar
-          type: boolean
-        - key: ui.show_url_open_toast
-          type: boolean
-        - key: threads.relative_time
-          type: boolean
-        - key: threads.sort_order
-          type: enum
-          values:
-            - updated_at
-            - created_at
-        - key: interpreter.enable_interpreter
-          type: boolean
-        - key: interpreter.timeout_seconds
-          type: number
-          min: 0
-          max: 60
-        - key: interpreter.memory_limit_mb
-          type: integer
-          min: 1
-          max: 512
-        - key: interpreter.max_ptc_calls
-          type: integer
-          min: 0
-          max: 256
-        - key: interpreter.max_result_chars
-          type: integer
-          min: 0
-          max: 65536
-        - key: interpreter.ptc
-          type: enum
-          values:
-            - safe
-            - all
-            - false
-        - key: interpreter.ptc_acknowledge_unsafe
-          type: boolean
-        - key: startup.mode
-          type: enum
-          values:
-            - manual
-            - auto
-            - yolo
-  - hooks.json
 user_managed_files:
   - .deepagents/.env
   - .deepagents/.mcp.json
```

**File**: `agents/nemocua/manifest.yaml` (modified, +0/-1)
```diff
@@ -20,7 +20,6 @@ config:
   dir: /app/config
   config_file: config.toml
   format: toml
-state_dirs: []
 device_pairing: false
 inference:
   provider_type: openai_compatible
```

**File**: `agents/openclaw/manifest.yaml` (modified, +1/-50)
```diff
@@ -42,7 +42,7 @@ forward_ports:
 config:
   dir: /sandbox/.openclaw
   config_file: openclaw.json
-  format: json5
+  format: json
 
 # Static integration metadata only. OpenClaw remains the authority on which
 # skills are visible or active.
@@ -51,55 +51,6 @@ skills:
   list_command: [skills, list, --agent, main]
   add_command: [skills, install, "{source}", --agent, main, --force]
 
-# ── State directories ──────────────────────────────────────────
-state_dirs:
-  - agents
-  # OpenClaw owns native plugin lifecycle. Restore a captured extensions tree,
-  # but do not erase target-only native installs when an older snapshot had no
-  # extensions directory.
-  - path: extensions
-    clear_when_absent: false
-  # Legacy layouts can still contain this pre-extensions directory. Keep it
-  # outside portable state.
-  - path: plugins
-    backup: false
-  # OpenClaw may create profile-scoped runtime state. Keep it outside portable
-  # state until profile-specific backup semantics are defined.
-  - path: profiles
-    backup: false
-  - workspace
-  # Multi-agent OpenClaw deployments create workspace-<agent> siblings.
-  - prefix: workspace-
-  - skills
-  - hooks
-  # Machine-local gateway auth state is wiped on destroy but never captured.
-  # Sanitization removes the identity key and paired-device tokens, so a
-  # restored copy cannot authenticate (#6852).
-  - path: identity
-    backup: false
-  - path: devices
-    backup: false
-  # Canonical SQLite pairing and gateway authentication state is machine-local.
-  # Wipe it on destroy, but never include it in portable backups.
-  - path: state
-    backup: false
-  - canvas
-  - cron
-  - memory
-  - telegram
-  - wechat
-  - whatsapp
-  - credentials
-
-# ── Top-level durable state files ───────────────────────────────
-# openclaw.json holds the core OpenClaw settings the state dirs above do not
-# cover: model/provider config, MCP servers, custom agents, and channel
-# account blocks. Without this entry `nemoclaw backup-all` snapshotted the
-# data directories but dropped these settings, so they were lost on rebuild
-# (issue #5027). The credential-sanitized backup restores the complete native
-# file because OpenClaw owns its configuration after first launch.
-state_files:
-  - path: openclaw.json
 user_managed_files:
   - .env
   - .mcp.json
```

**File**: `agents/pi/manifest.yaml` (modified, +0/-10)
```diff
@@ -29,16 +29,6 @@ config:
   dir: /sandbox/.pi/agent
   config_file: models.json
   format: json
-state_dirs:
-  - path: sessions
-  - path: prompts
-  - path: themes
-  - path: tools
-    backup: false
-  - path: bin
-    backup: false
-state_files:
-  - path: settings.json
 device_pairing: false
 inference:
   provider_type: openai_compatible
```

**File**: `ci/cli-test-timing-hints.json` (modified, +0/-5)
```diff
@@ -55,13 +55,10 @@
     "test/agents/deepagents/langchain-deepagents-code-image.test.ts": 17504,
     "test/agents/deepagents/langchain-deepagents-code-nemotron-profile-plugin.test.ts": 7530,
     "test/agents/deepagents/nemo-deepagents-alias.test.ts": 17997,
-    "test/agents/hermes/hermes-kanban-snapshot.test.ts": 10528,
     "test/agents/hermes/hermes-provider-foundation.test.ts": 5353,
     "test/agents/hermes/hermes-runtime-api-key.test.ts": 9872,
-    "test/agents/hermes/hermes-state-ledger-snapshot.test.ts": 5742,
     "test/agents/hermes/hermes-tool-gateway-broker.test.ts": 8095,
     "test/agents/hermes/nemohermes-alias.test.ts": 14670,
-    "test/agents/openclaw/openclaw-config-snapshot.test.ts": 5147,
     "test/agents/openclaw/openclaw-device-self-approval-patch.test.ts": 36649,
     "test/agents/openclaw/openclaw-device-stored-auth-patch.test.ts": 8297,
     "test/agents/openclaw/openclaw-gemini-inference-compat-runtime.test.ts": 36915,
@@ -193,8 +190,6 @@
     "test/skills/check-gates-compliance.test.ts": 22684,
     "test/skills/dependency-upgrade-skill-security.test.ts": 5353,
     "test/skills/dependency-upgrade-skill.test.ts": 19850,
-    "test/state/snapshot-restore-existing-dest.test.ts": 17653,
-    "test/state/snapshot-stale-directory-restore.test.ts": 7384,
     "test/state/snapshot.test.ts": 23861
   }
 }
```

---

### Incident Patch 13: `e9499d21` (2026-10-02)
**Commit Message**: fix(openshell): classify typed GPU diagnostics (#12560)

<!-- markdownlint-disable MD041 -->
## Outcome

Docker GPU failure reporting now uses one typed OpenShell observation
set for phase classification and saved evidence whenever that adapter is
available. Failed collection or artifact persistence remains best
effort, so it is attempted once and cannot suppress the original failure
or cleanup guidance.

## Reason

PR #12508 moved Docker GPU evidence collection behind a typed adapter,
but its failure snapshot still kept the legacy raw capture as a
competing phase authority. The follow-up also retried a failed typed
collection and allowed a retained-artifact write failure to interrupt
the original error report.

### Related issues

Refs #11832

Follow-up to #12508

## Changes

- Use successful typed `sandbox get` and `sandbox list` observations as
the sole snapshot authority when the typed adapter is available, with
`sandbox list` precedence and raw capture only when the adapter is
absent.
- Carry the attempted typed collection with the snapshot, including an
empty failed attempt, so the diagnostics writer never repeats the
external call.
- Keep each retained-artifact write inside 

**File**: `src/lib/onboard/docker-gpu-patch-diagnostics-classification.test.ts` (modified, +62/-0)
```diff
@@ -3,6 +3,7 @@
 
 import { describe, expect, it, vi } from "vitest";
 
+import type { OpenShellGpuDiagnostics } from "../adapters/openshell/gpu-diagnostics";
 import { getSandboxFailurePhase } from "../state/gateway";
 import {
   buildDockerGpuMode,
@@ -124,6 +125,67 @@ describe("Docker GPU patch diagnostics", () => {
     expect(snapshot.patchedContainerState?.Error).toContain("could not select device driver");
   });
 
+  it("uses typed OpenShell observations as the sole phase authority when raw capture conflicts", () => {
+    const collect = vi.fn<OpenShellGpuDiagnostics["collect"]>(() => [
+      {
+        name: "openshell-sandbox-get.txt",
+        content: "Name: alpha\nPhase: Provisioning\n",
+        outcome: { kind: "completed", exitCode: 0 },
+      },
+      {
+        name: "openshell-sandbox-list.txt",
+        content: "alpha   Error   2s ago\n",
+        outcome: { kind: "completed", exitCode: 0 },
+      },
+    ]);
+    const runCaptureOpenshell = sandboxCapture(
+      "Name: alpha\nPhase: Ready\n",
+      "alpha   Ready   2s ago\n",
+    );
+
+    const snapshot = captureDockerGpuPatchSandboxSnapshot(
+      "alpha",
+      {},
+      { openShellGpuDiagnostics: { collect }, runCaptureOpenshell },
+    );
+
+    expect(snapshot.sandboxPhase).toBe("Error");
+    expect(snapshot.sandboxListLine).toBe("alpha   Error   2s ago");
+    expect(collect).toHaveBeenCalledOnce();
+    expect(runCaptureOpenshell).not.toHaveBeenCalled();
+  });
+
+  it("rejects phase-shaped content from failed typed artifacts without raw fallback", () => {
+    const collect = vi.fn<OpenShellGpuDiagnostics["collect"]>(() => [
+      {
+        name: "openshell-sandbox-get.txt",
+        content: "Name: alpha\nPhase: Error\n",
+        outcome: { kind: "failed", error: { kind: "capture", message: "exit 1" } },
+      },
+      {
+        name: "openshell-sandbox-list.txt",
+        content: "alpha   Error   2s ago\n",
+        outcome: { kind: "failed", error: { kind: "timeout", message: "timed out" } },
+      },
+    ]);
+    const runCaptureOpenshell = sandboxCapture(
+      "Name: alpha\nPhase: Ready\n",
+      "alpha   Ready   2s ago\n",
+    );
+
+    const snapshot = captureDockerGpuPatchSandboxSnapshot(
+      "alpha",
+      {},
+      { openShellGpuDiagnostics: { collect }, runCaptureOpenshell },
+    );
+
+    expect(snapshot.sandboxPhase).toBeNull();
+    expect(snapshot.sandboxListLine).toBeNull();
+    expect(snapshot.openShellDiagnosticArtifacts).toHaveLength(2);
+    expect(collect).toHaveBeenCalledOnce();
+    expect(runCaptureOpenshell).not.toHaveBeenCalled();
+  });
+
   it("classifies a dead patched container as patched_container_failed with the failed mode", () => {
     const result = classify(
       failureSnapshot(
```

**File**: `src/lib/onboard/docker-gpu-patch-diagnostics.ts` (modified, +10/-1)
```diff
@@ -347,7 +347,16 @@ export function collectDockerGpuPatchDiagnostics(
     if (containerLogs.trim()) writeDiagnosticText("docker-logs.txt", containerLogs);
   }
 
-  if (deps.openShellGpuDiagnostics) {
+  const openShellDiagnosticArtifacts = snapshot?.openShellDiagnosticArtifacts;
+  if (openShellDiagnosticArtifacts) {
+    for (const artifact of openShellDiagnosticArtifacts) {
+      try {
+        if (artifact.content.trim()) writeDiagnosticText(artifact.name, artifact.content);
+      } catch {
+        // Best-effort diagnostics must not hide the original failure.
+      }
+    }
+  } else if (deps.openShellGpuDiagnostics) {
     try {
       const artifacts = deps.openShellGpuDiagnostics.collect({
         target: { kind: "selected" },
```

**File**: `src/lib/onboard/docker-gpu-patch-failure-print.test.ts` (modified, +99/-0)
```diff
@@ -98,6 +98,9 @@ describe("Docker GPU patch failure reporting (#7996)", () => {
         timeoutMs: 30_000,
         redact: expect.any(Function),
       });
+      expect(errorSpy.mock.calls.map((args) => args.map(String).join(" ")).join("\n")).toContain(
+        "OpenShell sandbox entered Error phase",
+      );
       const failuresDir = path.join(nemoclawStateRoot(tmpDir, GATEWAY_PORT), "onboard-failures");
       const [failureDir] = fs.readdirSync(failuresDir);
       expect(failureDir).toBeTruthy();
@@ -113,6 +116,102 @@ describe("Docker GPU patch failure reporting (#7996)", () => {
     }
   });
 
+  it("does not retry a typed diagnostic collection that throws", () => {
+    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-docker-gpu-collect-failure-"));
+    const collect = vi.fn<OpenShellGpuDiagnostics["collect"]>(() => {
+      throw new Error("typed diagnostics unavailable");
+    });
+    const runCaptureOpenshell = vi.fn(() => "alpha   Ready   1m ago\n");
+    const output: string[] = [];
+    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
+      output.push(args.map(String).join(" "));
+    });
+    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((_code?: number) => {
+      throw new Error("__test_exit__");
+    }) as never);
+
+    try {
+      expect(() =>
+        printDockerGpuPatchFailureAndExit("alpha", new Error("supervisor did not reconnect"), {
+          openShellGpuDiagnostics: { collect },
+          runCaptureOpenshell,
+          dockerCapture: vi.fn(() => ""),
+          dockerLogs: vi.fn(() => ""),
+          homedir: () => tmpDir,
+          now: () => new Date("2026-05-12T00:00:00Z"),
+          context: {
+            sandboxName: "alpha",
+            newContainerId: "new-container-id",
+            rolledBack: true,
+            replacementPresence: "unknown",
+          },
+        }),
+      ).toThrow(/__test_exit__/);
+
+      expect(collect).toHaveBeenCalledOnce();
+      expect(runCaptureOpenshell).not.toHaveBeenCalled();
+      expect(output.join("\n")).toContain("supervisor did not reconnect");
+      expect(output.join("\n")).toContain("Replacement container cleanup could not be confirmed");
+    } finally {
+      exitSpy.mockRestore();
+      errorSpy.mockRestore();
+      fs.rmSync(tmpDir, { recursive: true, force: true });
+    }
+  });
+
+  it("keeps original failure reporting when a retained artifact cannot be written", () => {
+    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-docker-gpu-write-failure-"));
+    const collect = vi.fn<OpenShellGpuDiagnostics["collect"]>(() => [
+      {
+        name: "openshell-sandbox-get.txt",
+        content: "Phase: Error\n",
+        outcome: { kind: "completed", exitCode: 0 },
+      },
+    ]);
+    const writeFileSync = fs.writeFileSync.bind(fs);
+    const writeSpy = vi.spyOn(fs, "writeFileSync").mockImplementation(((file, data, options) => {
+      return String(file).endsWith("openshell-sandbox-get.txt")
+        ? (() => {
+            throw new Error("artifact write denied");
+          })()
+        : writeFileSync(file, data, options);
+    }) as typeof fs.writeFileSync);
+    const output: string[] = [];
+    const errorSpy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
+      output.push(args.map(String).join(" "));
+    });
+    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((_code?: number) => {
+      throw new Error("__test_exit__");
+    }) as never);
+
+    try {
+      expect(() =>
+        printDockerGpuPatchFailureAndExit("alpha", new Error("supervisor did not reconnect"), {
+          openShellGpuDiagnostics: { collect },
+          dockerCapture: vi.fn(() => ""),
+          dockerLogs: vi.fn(() => ""),
+          homedir: () => tmpDir,
+          now: () => new Date("2026-05-12T00:00:00Z"),
+          context: {
+            sandboxName: "alpha",
+            newContainerId: "new-container-id",
+            rolledBack: true,
+            replacementPresence: "unknown",
+          },
+        }),
+      ).toThrow(/__test_exit__/);
+
+      expect(collect).toHaveBeenCalledOnce();
+      expect(output.join("\n")).toContain("supervisor did not reconnect");
+      expect(output.join("\n")).toContain("Replacement container cleanup could not be confirmed");
+    } finally {
+      exitSpy.mockRestore();
+      errorSpy.mockRestore();
+      writeSpy.mockRestore();
+      fs.rmSync(tmpDir, { recursive: true, force: true });
+    }
+  });
+
   it("prefers the pre-rollback verdict when fresh inspection cannot find the replacement", () => {
     // Fresh inspection returns nothing after rollback, and the sandbox only
     // shows a generic Error phase.
```

**File**: `src/lib/onboard/docker-gpu-patch-types.ts` (modified, +12/-1)
```diff
@@ -2,7 +2,10 @@
 // SPDX-License-Identifier: Apache-2.0
 
 import type { OpenShellSandboxBufferedCommandExecutor } from "../adapters/openshell/sandbox-command";
-import type { OpenShellGpuDiagnostics } from "../adapters/openshell/gpu-diagnostics";
+import type {
+  OpenShellGpuDiagnosticArtifact,
+  OpenShellGpuDiagnostics,
+} from "../adapters/openshell/gpu-diagnostics";
 import type { SandboxGpuProofResult } from "../state/registry";
 
 export interface SandboxCreateRuntimePatch {
@@ -216,6 +219,14 @@ export type DockerGpuPatchSandboxSnapshot = {
   sandboxPhase: string | null;
   sandboxListLine: string | null;
   patchedContainerState: DockerContainerState | null;
+  /**
+   * The typed OpenShell observations used to derive the phase. Keeping the
+   * observations with the snapshot lets the diagnostics writer persist the
+   * same evidence without invoking the external collector a second time.
+   * Presence records an attempted collection; an empty array records a failed
+   * or empty attempt that must not be retried by the writer.
+   */
+  openShellDiagnosticArtifacts?: readonly OpenShellGpuDiagnosticArtifact[];
 };
 
 export type DockerGpuPatchFailureKind =
```

**File**: `src/lib/onboard/docker-gpu-patch.ts` (modified, +55/-3)
```diff
@@ -385,6 +385,16 @@ function parseSandboxPhaseFromListOutput(output: string, sandboxName: string): s
   return parseLiveSandboxEntries(output).find((entry) => entry.name === sandboxName)?.phase ?? null;
 }
 
+function completedOpenShellArtifactContent(
+  artifacts: NonNullable<DockerGpuPatchSandboxSnapshot["openShellDiagnosticArtifacts"]>,
+  name: "openshell-sandbox-get.txt" | "openshell-sandbox-list.txt",
+): string | null {
+  const artifact = artifacts.find((candidate) => candidate.name === name);
+  return artifact?.outcome.kind === "completed" && artifact.outcome.exitCode === 0
+    ? artifact.content
+    : null;
+}
+
 function isFailurePhase(phase: string | null | undefined): boolean {
   return typeof phase === "string" && SANDBOX_FAILURE_PHASE_TOKENS.has(phase);
 }
@@ -428,11 +438,48 @@ export function captureDockerGpuPatchSandboxSnapshot(
   options: {
     patchedContainerId?: string | null;
   } = {},
-  deps: Pick<DockerGpuPatchDeps, "runCaptureOpenshell" | "dockerCapture"> = {},
+  deps: Pick<
+    DockerGpuPatchDeps,
+    "runCaptureOpenshell" | "dockerCapture" | "openShellGpuDiagnostics"
+  > = {},
 ): DockerGpuPatchSandboxSnapshot {
   let sandboxPhase: string | null = null;
   let sandboxListLine: string | null = null;
-  if (deps.runCaptureOpenshell) {
+  let openShellDiagnosticArtifacts: DockerGpuPatchSandboxSnapshot["openShellDiagnosticArtifacts"];
+  if (deps.openShellGpuDiagnostics) {
+    // An empty array records that the typed collector was attempted. The
+    // diagnostics writer must not repeat an external call that already failed.
+    openShellDiagnosticArtifacts = [];
+    try {
+      const redactor = createDockerGpuDiagnosticRedactor();
+      openShellDiagnosticArtifacts = deps.openShellGpuDiagnostics.collect({
+        target: { kind: "selected" },
+        sandboxName,
+        timeoutMs: DOCKER_GPU_PATCH_TIMEOUT_MS,
+        redact: redactor.redactText,
+      });
+      const typedGetOutput = completedOpenShellArtifactContent(
+        openShellDiagnosticArtifacts,
+        "openshell-sandbox-get.txt",
+      );
+      if (typedGetOutput) {
+        sandboxPhase = parseSandboxPhaseFromGetOutput(typedGetOutput);
+      }
+      const typedListOutput = completedOpenShellArtifactContent(
+        openShellDiagnosticArtifacts,
+        "openshell-sandbox-list.txt",
+      );
+      if (typedListOutput) {
+        sandboxListLine = findSandboxListLine(typedListOutput, sandboxName);
+        if (sandboxListLine) {
+          const listPhase = parseSandboxPhaseFromListOutput(typedListOutput, sandboxName);
+          if (listPhase) sandboxPhase = listPhase;
+        }
+      }
+    } catch {
+      /* best effort */
+    }
+  } else if (deps.runCaptureOpenshell) {
     try {
       const getOutput = deps.runCaptureOpenshell(["sandbox", "get", sandboxName], {
         ignoreError: true,
@@ -476,7 +523,12 @@ export function captureDockerGpuPatchSandboxSnapshot(
     }
   }
 
-  return { sandboxPhase, sandboxListLine, patchedContainerState };
+  return {
+    sandboxPhase,
+    sandboxListLine,
+    patchedContainerState,
+    ...(openShellDiagnosticArtifacts ? { openShellDiagnosticArtifacts } : {}),
+  };
 }
 
 // Exit code 127 alone is ambiguous because `env` propagates a child process's
```

**File**: `src/lib/onboard/docker-gpu-pre-rollback-diagnostics.test.ts` (modified, +12/-1)
```diff
@@ -98,7 +98,18 @@ describe("Docker GPU pre-rollback diagnostics (#6110)", () => {
     const dockerLogs = vi.fn((target: string, _options?: { tail?: number; timeout?: number }) =>
       target === "new-container-id" ? `failed clone log ${secretCanary}\n` : "",
     );
-    const collectOpenShellGpuDiagnostics = vi.fn<OpenShellGpuDiagnostics["collect"]>(() => []);
+    const collectOpenShellGpuDiagnostics = vi.fn<OpenShellGpuDiagnostics["collect"]>(() => [
+      {
+        name: "openshell-sandbox-get.txt",
+        content: `Phase: Error\ndetail=${secretCanary} ${discoveredSecretCanary}\n`,
+        outcome: { kind: "completed", exitCode: 0 },
+      },
+      {
+        name: "openshell-sandbox-list.txt",
+        content: `alpha  Error  ${secretCanary} ${discoveredSecretCanary}\n`,
+        outcome: { kind: "completed", exitCode: 0 },
+      },
+    ]);
 
     try {
       const captured = captureDockerGpuPreRollbackDiagnostics("alpha", patchResult(), {
```

---

### Incident Patch 14: `bd340a37` (2026-10-02)
**Commit Message**: fix(e2e): use declared external gateway state in Brev lifecycle (#12535)

## Outcome

Brev Launchable lifecycle commands use the gateway state directory
declared by the preinstalled image. The OpenShell SDK accepts that
externally supervised gateway without a NemoClaw-managed ownership
marker, while retaining private-directory and local mTLS checks.

## Reason

The [main Brev E2E run 36890457594, attempt
2](https://github.com/NVIDIA/NemoClaw/actions/runs/36890457594/attempts/2)
built and booted the image, passed inference and credential checks, then
failed at `nemoclaw e2e-staging stop/start`: the SDK selected the
missing default state path under `/home/ubuntu/.local/state/nemoclaw`
instead of `/var/lib/brev/openshell-gateway`. Passing the correct path
also requires recognizing the external supervisor's ownership contract.

## Changes

- Propagate the validated declaration's state directory into every Brev
E2E shell probe.
- Require the external declaration's HTTPS loopback endpoint and
selected port to agree; reject a conflicting override. Allow an absent
managed marker only for validated external supervision, retaining
directory ownership, private mode, parent-path and TLS checks

**File**: `src/lib/adapters/openshell/sandbox-command-sdk.test.ts` (modified, +108/-0)
```diff
@@ -46,6 +46,32 @@ function unmarkedDefaultTlsBundle(): { homeDir: string; stateDir: string } {
   return { homeDir, stateDir };
 }
 
+function externalTlsBundle(port = 9443): { declaration: string; stateDir: string } {
+  const stateDir = fs.mkdtempSync(path.join(os.homedir(), ".nemoclaw-sdk-external-test-"));
+  roots.push(stateDir);
+  fs.mkdirSync(path.join(stateDir, "tls", "client"), { mode: 0o700, recursive: true });
+  fs.writeFileSync(path.join(stateDir, "tls", "ca.crt"), "ca");
+  fs.writeFileSync(path.join(stateDir, "tls", "client", "tls.crt"), "cert");
+  fs.writeFileSync(path.join(stateDir, "tls", "client", "tls.key"), "key");
+  const declaration = path.join(stateDir, "gateway-management.json");
+  fs.writeFileSync(
+    declaration,
+    JSON.stringify({
+      version: 1,
+      mode: "externally-supervised",
+      endpoint: `https://127.0.0.1:${String(port)}`,
+      stateDir,
+      supervisor: {
+        kind: "systemd-system",
+        serviceName: "openshell-gateway.service",
+        execPath: "/usr/local/bin/openshell-gateway",
+      },
+      requiredCapabilities: ["gateway.health", "sandbox.exec"],
+    }),
+  );
+  return { declaration, stateDir };
+}
+
 afterEach(() => {
   for (const root of roots.splice(0)) fs.rmSync(root, { force: true, recursive: true });
 });
@@ -108,6 +134,88 @@ describe("OpenShell SDK sandbox command executor", () => {
     ).rejects.toThrow(/managed gateway state root marker/u);
   });
 
+  it.each([false, true])(
+    "connects to an unmarked externally supervised gateway with explicit state override=%s (#12389)",
+    async (explicitOverride) => {
+      const { declaration, stateDir } = externalTlsBundle();
+      const connect = vi.fn().mockResolvedValue({ sandbox: {} });
+
+      await connectManagedOpenShellSdk(
+        { kind: "named", gatewayName: "nemoclaw-9443" },
+        {
+          env: {
+            NEMOCLAW_GATEWAY_MANAGEMENT: declaration,
+            ...(explicitOverride ? { NEMOCLAW_OPENSHELL_GATEWAY_STATE_DIR: stateDir } : {}),
+          },
+          homeDir: "/unused",
+          loadSdk: async () => ({ OpenShellClient: { connect } }),
+        },
+      );
+
+      expect(connect).toHaveBeenCalledWith({
+        gateway: "https://127.0.0.1:9443",
+        caCert: Buffer.from("ca"),
+        clientCert: Buffer.from("cert"),
+        clientKey: Buffer.from("key"),
+      });
+    },
+  );
+
+  it("rejects a public externally supervised gateway state root (#12389)", async () => {
+    const { declaration, stateDir } = externalTlsBundle();
+    fs.chmodSync(stateDir, 0o755);
+    const connect = vi.fn();
+
+    await expect(
+      connectManagedOpenShellSdk(
+        { kind: "named", gatewayName: "nemoclaw-9443" },
+        {
+          env: { NEMOCLAW_GATEWAY_MANAGEMENT: declaration },
+          loadSdk: async () => ({ OpenShellClient: { connect } }),
+        },
+      ),
+    ).rejects.toThrow(/mode 0700/u);
+    expect(connect).not.toHaveBeenCalled();
+  });
+
+  it("rejects an external declaration for a different gateway port (#12389)", async () => {
+    const { declaration, stateDir } = externalTlsBundle(9444);
+    const connect = vi.fn();
+
+    await expect(
+      connectManagedOpenShellSdk(
+        { kind: "named", gatewayName: "nemoclaw-9443" },
+        {
+          env: {
+            NEMOCLAW_GATEWAY_MANAGEMENT: declaration,
+            NEMOCLAW_OPENSHELL_GATEWAY_STATE_DIR: stateDir,
+          },
+          loadSdk: async () => ({ OpenShellClient: { connect } }),
+        },
+      ),
+    ).rejects.toThrow(/gateway declaration.*selected gateway/u);
+    expect(connect).not.toHaveBeenCalled();
+  });
+
+  it("rejects a state override that differs from the external declaration (#12389)", async () => {
+    const { declaration } = externalTlsBundle();
+    const connect = vi.fn();
+
+    await expect(
+      connectManagedOpenShellSdk(
+        { kind: "named", gatewayName: "nemoclaw-9443" },
+        {
+          env: {
+            NEMOCLAW_GATEWAY_MANAGEMENT: declaration,
+            NEMOCLAW_OPENSHELL_GATEWAY_STATE_DIR: "/home/ubuntu/other-gateway",
+          },
+          loadSdk: async () => ({ OpenShellClient: { connect } }),
+        },
+      ),
+    ).rejects.toThrow(/gateway declaration.*state directory override/u);
+    expect(connect).not.toHaveBeenCalled();
+  });
+
   it("streams native output and preserves the exit status", async () => {
     const stdout: Buffer[] = [];
     const stderr: Buffer[] = [];
```

**File**: `src/lib/adapters/openshell/sdk.ts` (modified, +53/-15)
```diff
@@ -6,9 +6,14 @@ import path from "node:path";
 import { openRegularFileNoFollow } from "../fs/regular-file";
 import {
   DEFAULT_GATEWAY_PORT,
+  externallySupervisedGatewayStateRootOwnershipFailure,
   managedGatewayStateRootOwnershipFailure,
   resolveGatewayStateDirForPort,
 } from "../../onboard/gateway/state-dir";
+import {
+  invalidGatewayManagementDeclarationError,
+  loadGatewayManagementDeclaration,
+} from "../../onboard/gateway-management";
 import type { OpenShellGatewayTarget } from "./sandbox-observer";
 import { importOpenShellSdk } from "./sdk-import.mjs";
 
@@ -78,7 +83,7 @@ async function loadOpenShellSdk(): Promise<OpenShellSdkModule> {
   return (await importOpenShellSdk()) as OpenShellSdkModule;
 }
 
-/** Connect the SDK directly to one managed gateway, independent of compute provider. */
+/** Connect the SDK to one validated local gateway, independent of compute provider. */
 export async function connectManagedOpenShellSdk(
   target: OpenShellGatewayTarget,
   deps: Pick<OpenShellSdkConnectionDeps, "env" | "homeDir" | "loadSdk" | "signal"> = {},
@@ -87,26 +92,59 @@ export async function connectManagedOpenShellSdk(
   const port = gatewayPort(target);
   const environment = deps.env ?? process.env;
   const configuredStateDir = environment.NEMOCLAW_OPENSHELL_GATEWAY_STATE_DIR?.trim();
+  const management = environment.NEMOCLAW_GATEWAY_MANAGEMENT?.trim()
+    ? loadGatewayManagementDeclaration({ env: environment })
+    : null;
+  if (management && !management.ok) {
+    throw invalidGatewayManagementDeclarationError(management.reason);
+  }
+  const external =
+    management?.ok && management.declaration?.mode === "externally-supervised"
+      ? management.declaration
+      : null;
+  if (external) {
+    if (!external.endpoint || !external.stateDir) {
+      throw new Error("The external gateway declaration is incomplete.");
+    }
+    const endpoint = new URL(external.endpoint);
+    const endpointPort = Number(endpoint.port || (endpoint.protocol === "https:" ? "443" : "80"));
+    if (
+      endpoint.protocol !== "https:" ||
+      endpoint.hostname !== "127.0.0.1" ||
+      endpointPort !== port
+    ) {
+      throw new Error("The external gateway declaration does not match the selected gateway.");
+    }
+  }
+  const home = deps.homeDir ?? environment.HOME ?? os.homedir();
   const stateDir = resolveGatewayStateDirForPort({
-    configured: configuredStateDir,
-    home: deps.homeDir ?? environment.HOME ?? os.homedir(),
+    configured: external?.stateDir ?? configuredStateDir,
+    home,
     port,
   });
+  if (
+    external &&
+    configuredStateDir &&
+    resolveGatewayStateDirForPort({ configured: configuredStateDir, home, port }) !== stateDir
+  ) {
+    throw new Error(
+      "The external gateway declaration conflicts with the state directory override.",
+    );
+  }
   const gatewayName = target.kind === "named" ? target.gatewayName : "";
-  const ownershipFailure = managedGatewayStateRootOwnershipFailure(
-    {
-      gatewayName,
-      gatewayPort: port,
-      stateDir,
-    },
-    // The canonical default root predates the explicit marker. Its fixed path,
-    // owner-only directory checks, and local mTLS identity remain the legacy
-    // authority boundary. Explicit overrides must always carry the marker.
-    { allowLegacyManagedState: !configuredStateDir },
-  );
+  const stateTarget = { gatewayName, gatewayPort: port, stateDir };
+  const ownershipFailure = external
+    ? externallySupervisedGatewayStateRootOwnershipFailure(stateTarget)
+    : managedGatewayStateRootOwnershipFailure(
+        stateTarget,
+        // The canonical default root predates the explicit marker. Its fixed path,
+        // owner-only directory checks, and local mTLS identity remain the legacy
+        // authority boundary. Managed overrides must always carry the marker.
+        { allowLegacyManagedState: !configuredStateDir },
+      );
   if (ownershipFailure) {
     const message = `Unsafe OpenShell gateway state directory: ${ownershipFailure}.`;
-    if (configuredStateDir) throw new Error(message);
+    if (configuredStateDir || external) throw new Error(message);
     throw new OpenShellSdkPreflightUnavailableError(message);
   }
   const tlsDirectory = path.join(stateDir, "tls");
```

**File**: `src/lib/onboard/gateway-state-root-ownership.test.ts` (modified, +30/-0)
```diff
@@ -17,6 +17,36 @@ function target(stateDir: string, gatewayPort = 9123) {
 }
 
 describe("managed gateway state root ownership", () => {
+  it("identifies a missing gateway ancestor without weakening the ownership check (#12389)", () => {
+    const root = fs.mkdtempSync(path.join(process.cwd(), "nemoclaw-missing-gateway-parent-"));
+    const stateDir = path.join(root, "missing", "gateway");
+    try {
+      expect(managedGatewayStateRootOwnershipFailure(target(stateDir))).toContain(
+        `ancestor '${path.join(root, "missing")}' cannot be inspected (ENOENT)`,
+      );
+      expect(fs.existsSync(path.join(root, "missing"))).toBe(false);
+    } finally {
+      fs.rmSync(root, { force: true, recursive: true });
+    }
+  });
+
+  it("does not copy unexpected filesystem error text into gateway diagnostics (#12389)", () => {
+    const error = Object.assign(new Error("credential-shaped private detail"), { code: "EIO" });
+    const inspect = vi.spyOn(fs, "lstatSync").mockImplementationOnce(() => {
+      throw error;
+    });
+    try {
+      const failure = managedGatewayStateRootOwnershipFailure(
+        target(path.join(process.cwd(), "gateway")),
+      );
+      expect(failure).toContain("cannot be inspected");
+      expect(failure).not.toContain("credential-shaped private detail");
+      expect(failure).not.toContain("EIO");
+    } finally {
+      inspect.mockRestore();
+    }
+  });
+
   it("rejects an existing nonempty directory that NemoClaw does not own", () => {
     const root = fs.mkdtempSync(path.join(process.cwd(), "nemoclaw-unowned-gateway-root-"));
     const stateDir = path.join(root, "gateway");
```

**File**: `src/lib/onboard/gateway/state-dir.ts` (modified, +16/-2)
```diff
@@ -96,8 +96,15 @@ function stateRootParentOwnershipFailure(stateDir: string): string | null {
     let inspected: fs.Stats;
     try {
       inspected = fs.lstatSync(ancestor);
-    } catch {
-      return `the gateway state directory's ancestor '${ancestor}' cannot be inspected`;
+    } catch (error) {
+      const code = (error as NodeJS.ErrnoException).code;
+      const knownCode =
+        code === "ENOENT" ||
+        code === "EACCES" ||
+        code === "EPERM" ||
+        code === "ENOTDIR" ||
+        code === "ELOOP";
+      return `the gateway state directory's ancestor '${ancestor}' cannot be inspected${knownCode ? ` (${code})` : ""}`;
     }
     if (
       !inspected.isDirectory() ||
@@ -251,6 +258,13 @@ export function managedGatewayStateRootOwnershipFailure(
     : "the managed gateway state root marker and legacy managed configuration are both missing";
 }
 
+/** After validating external supervision, accept its private root without a managed marker. */
+export function externallySupervisedGatewayStateRootOwnershipFailure(
+  target: ManagedGatewayStateRootTarget,
+): string | null {
+  return managedGatewayStateRootOwnershipFailure(target, { allowLegacyManagedState: true });
+}
+
 /** Whether onboarding reserved this managed root but wrote no gateway state into it. */
 export function isManagedGatewayStateRootReservation(
   target: ManagedGatewayStateRootTarget,
```

**File**: `test/e2e/fixtures/full-e2e-gateway.ts` (modified, +6/-1)
```diff
@@ -31,7 +31,11 @@ export function fullE2eGateway(preinstalled: boolean, env: NodeJS.ProcessEnv = p
     env: { ...env, NEMOCLAW_GATEWAY_MANAGEMENT: declarationPath },
   });
   if (!loaded.ok) throw new Error(`Launchable gateway declaration: ${loaded.reason}`);
-  if (loaded.declaration?.mode !== "externally-supervised" || !loaded.declaration.endpoint) {
+  if (
+    loaded.declaration?.mode !== "externally-supervised" ||
+    !loaded.declaration.endpoint ||
+    !loaded.declaration.stateDir
+  ) {
     throw new Error("The preinstalled Launchable requires an externally supervised gateway");
   }
   const endpoint = new URL(loaded.declaration.endpoint);
@@ -47,6 +51,7 @@ export function fullE2eGateway(preinstalled: boolean, env: NodeJS.ProcessEnv = p
       OPENSHELL_GATEWAY: resolveGatewayName(port),
       NEMOCLAW_GATEWAY_MANAGEMENT: declarationPath,
       NEMOCLAW_GATEWAY_PORT: String(port),
+      NEMOCLAW_OPENSHELL_GATEWAY_STATE_DIR: loaded.declaration.stateDir,
     },
   };
 }
```

**File**: `test/e2e/support/full-e2e-gateway.test.ts` (modified, +14/-1)
```diff
@@ -161,7 +161,10 @@ describe("full E2E gateway ownership", () => {
         OPENSHELL_GATEWAY: preinstalled ? "nemoclaw-18080" : "nemoclaw",
         NEMOCLAW_GATEWAY_PORT: preinstalled ? "18080" : "8080",
         ...(preinstalled
-          ? { NEMOCLAW_GATEWAY_MANAGEMENT: process.env.NEMOCLAW_GATEWAY_MANAGEMENT }
+          ? {
+              NEMOCLAW_GATEWAY_MANAGEMENT: process.env.NEMOCLAW_GATEWAY_MANAGEMENT,
+              NEMOCLAW_OPENSHELL_GATEWAY_STATE_DIR: "/var/lib/brev/openshell-gateway",
+            }
           : {}),
       });
       expect(cleanup.trackGateway).toHaveBeenCalledTimes(preinstalled ? 0 : 1);
@@ -197,11 +200,21 @@ describe("full E2E gateway ownership", () => {
         env: {
           ...env,
           NEMOCLAW_GATEWAY_PORT: "18080",
+          NEMOCLAW_OPENSHELL_GATEWAY_STATE_DIR: "/var/lib/brev/openshell-gateway",
           OPENSHELL_GATEWAY: "nemoclaw-18080",
         },
       });
     },
   );
+  it("uses the declared state root even when the shell has a different override (#12389)", () => {
+    const configured = fullE2eGateway(true, {
+      ...declaration(),
+      NEMOCLAW_OPENSHELL_GATEWAY_STATE_DIR: "/home/ubuntu/.local/state/nemoclaw",
+    });
+    expect(configured.env.NEMOCLAW_OPENSHELL_GATEWAY_STATE_DIR).toBe(
+      "/var/lib/brev/openshell-gateway",
+    );
+  });
   it.each(["https://127.0.0.1", "http://127.0.0.1", "https://127.0.0.1:1023"])(
     "preserves the CLI port restriction for the declared endpoint %s (#9851)",
     (endpoint) => {
```

**File**: `test/package-contract/openshell-sdk-loading.test.ts` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ function packageFixture(): string {
       "dist/lib/adapters/openshell",
       "dist/lib/adapters/fs",
       "dist/lib/onboard/gateway/state-dir.js",
+      "dist/lib/onboard/gateway-management.js",
       "dist/lib/onboard/gateway-binding",
       "dist/lib/core",
       "dist/lib/inference/llama-cpp/contract.js",
```

---

### Incident Patch 15: `0c46af86` (2026-10-02)
**Commit Message**: test(wsl): align subprocess fixtures with runtime contracts (#12574)

Align the remaining WSL subprocess fixtures with the runtime contracts they simulate. Recognize both supported GNU timeout paths, make the recovery test detect an unmatched command instead of accepting a default no-op, and honor the Podman collector caller's command timeout in the real-child fixture.

No production behavior or validation assertions change. Local targeted suites passed 27 tests, fault-injection reproductions demonstrated both repairs, and all seven growth checks passed. All 57 current checks, all nine Advisor reports, and CodeRabbit review passed on 326fa28b71668ee89599f93b6daaa3b9ee0ba3bd.

Refs #12285, #12281, and #12573. Actual WSL validation follows in the main-only platform workflow.

Signed-off-by: Aaron Erickson <[REDACTED_EMAIL]>

**File**: `test/e2e/support/podman-owner-diagnostic.test.ts` (modified, +46/-37)
```diff
@@ -2,6 +2,7 @@
 // SPDX-License-Identifier: Apache-2.0
 
 import { expect, it, vi } from "vitest";
+import { testTimeout } from "../../helpers/timeouts";
 import {
   observeWithOwnerDiagnostic,
   withPodmanOwnerDiagnostic,
@@ -303,41 +304,49 @@ it("accepts a complete boolean fact report", async () => {
   );
 });
 
-it("loads the real collector from an unrelated child working directory", async () => {
-  const fs = await import("node:fs");
-  const os = await import("node:os");
-  const path = await import("node:path");
-  const { spawnSync } = await import("node:child_process");
-  const { captureBoundedPodmanOwnerDiagnostic } =
-    await import("../fixtures/podman-owner-diagnostic");
-  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "owner-diagnostic-cwd-"));
-  let child: ReturnType<typeof spawnSync> | undefined;
-  try {
-    const command = async (executable: string, args: string[]) => {
-      child = spawnSync(executable, args, {
-        cwd: directory,
-        env: { PATH: process.env.PATH, HOME: directory, NEMOCLAW_GATEWAY_RUNTIME: "docker" },
-        encoding: "utf8",
-        timeout: 10_000,
-        killSignal: "SIGKILL",
-      });
-      return {
-        exitCode: child.status,
-        timedOut: false,
-        stdout: String(child.stdout),
-        stderr: String(child.stderr),
+it(
+  "loads the real collector from an unrelated child working directory",
+  async () => {
+    const fs = await import("node:fs");
+    const os = await import("node:os");
+    const path = await import("node:path");
+    const { spawnSync } = await import("node:child_process");
+    const { captureBoundedPodmanOwnerDiagnostic } =
+      await import("../fixtures/podman-owner-diagnostic");
+    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "owner-diagnostic-cwd-"));
+    let child: ReturnType<typeof spawnSync> | undefined;
+    try {
+      const command = async (
+        executable: string,
+        args: string[],
+        options: { timeoutMs: number },
+      ) => {
+        child = spawnSync(executable, args, {
+          cwd: directory,
+          env: { PATH: process.env.PATH, HOME: directory, NEMOCLAW_GATEWAY_RUNTIME: "docker" },
+          encoding: "utf8",
+          timeout: options.timeoutMs,
+          killSignal: "SIGKILL",
+        });
+        return {
+          exitCode: child.status,
+          timedOut: false,
+          stdout: String(child.stdout),
+          stderr: String(child.stderr),
+        };
       };
-    };
-    expect(await captureBoundedPodmanOwnerDiagnostic({ command } as never, {}, "before")).toEqual(
-      unavailable,
-    );
-    // An unavailable report alone could hide a loader failure. Require successful
-    // child execution and the collector's exact serialized return as well.
-    expect(child?.error).toBeUndefined();
-    expect(child?.status).toBe(0);
-    expect(child?.stderr).toBe("");
-    expect(JSON.parse(String(child?.stdout))).toEqual(unavailable);
-  } finally {
-    fs.rmSync(directory, { recursive: true, force: true });
-  }
-});
+      expect(await captureBoundedPodmanOwnerDiagnostic({ command } as never, {}, "before")).toEqual(
+        unavailable,
+      );
+      // An unavailable report alone could hide a loader failure. Require successful
+      // child execution and the collector's exact serialized return as well.
+      expect(child?.error).toBeUndefined();
+      expect(child?.status).toBe(0);
+      expect(child?.stderr).toBe("");
+      expect(JSON.parse(String(child?.stdout))).toEqual(unavailable);
+    } finally {
+      fs.rmSync(directory, { recursive: true, force: true });
+    }
+  },
+  testTimeout(65_000),
+);
```

**File**: `test/helpers/onboard-child-runtime.test.ts` (modified, +81/-77)
```diff
@@ -139,82 +139,86 @@ describe("onboard child Ollama execution proof runner", () => {
     }
   });
 
-  it("rejects the obsolete sudo-first fallback and accepts timeout-first recovery (#12281)", () => {
-    const fixtureHome = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-proof-runner-order-"));
-    vi.stubEnv("HOME", fixtureHome);
-    try {
-      const runner = loadExecutionProofRuntime().createSuccessfulOllamaServiceExecutionProofRunner(
-        undefined,
-        true,
-      );
-      const executablePath = path.join(fixtureHome, "ollama-service-exec-fixture");
-      const systemdResult = runner(
-        [
-          "/usr/bin/sudo",
-          "-n",
-          "/usr/bin/env",
-          "LC_ALL=C",
-          "/usr/bin/systemd-run",
-          "--wait",
-          "--pipe",
-          "--collect",
-          "--service-type=exec",
-          "--uid=ollama",
-          "--property=KillMode=control-group",
-          "--property=RuntimeMaxSec=15s",
-          "--property=TimeoutStopSec=250ms",
-          "--property=SendSIGKILL=yes",
-          executablePath,
-          "--version",
-        ],
-        { timeout: 17_000 },
-      );
-      const directResult = runner(
-        [
-          "/usr/bin/timeout",
-          "--signal=TERM",
-          "--kill-after=0.25s",
-          "15s",
-          "/usr/bin/sudo",
-          "-n",
-          "-u",
-          "ollama",
-          "--",
-          "/usr/bin/env",
-          "LC_ALL=C",
-          "/bin/sh",
-          "-c",
-          '"$1" --version\nstatus=$?\ncase "$status" in\n  124|137) exit 1 ;;\n  *) exit "$status" ;;\nesac',
-          "nemoclaw-direct-service-user-proof",
-          executablePath,
-        ],
-        { timeout: 17_000 },
-      );
-      const obsoleteResult = runner(
-        [
-          "/usr/bin/sudo",
-          "-n",
-          "-u",
-          "ollama",
-          "--",
-          "/usr/bin/env",
-          "LC_ALL=C",
-          "/usr/bin/timeout",
-          "--signal=TERM",
-          "--kill-after=0.25s",
-          "15s",
-          executablePath,
-          "--version",
-        ],
-        { timeout: 17_000 },
-      );
+  it.each(["/usr/bin/timeout", "/usr/bin/gnutimeout"])(
+    "rejects the obsolete sudo-first fallback and accepts %s recovery (#12281)",
+    (timeoutExecutable) => {
+      const fixtureHome = fs.mkdtempSync(path.join(os.tmpdir(), "nemoclaw-proof-runner-order-"));
+      vi.stubEnv("HOME", fixtureHome);
+      try {
+        const runner =
+          loadExecutionProofRuntime().createSuccessfulOllamaServiceExecutionProofRunner(
+            () => ({ stdout: "", stderr: "unmatched proof", exitCode: 1, timedOut: false }),
+            true,
+          );
+        const executablePath = path.join(fixtureHome, "ollama-service-exec-fixture");
+        const systemdResult = runner(
+          [
+            "/usr/bin/sudo",
+            "-n",
+            "/usr/bin/env",
+            "LC_ALL=C",
+            "/usr/bin/systemd-run",
+            "--wait",
+            "--pipe",
+            "--collect",
+            "--service-type=exec",
+            "--uid=ollama",
+            "--property=KillMode=control-group",
+            "--property=RuntimeMaxSec=15s",
+            "--property=TimeoutStopSec=250ms",
+            "--property=SendSIGKILL=yes",
+            executablePath,
+            "--version",
+          ],
+          { timeout: 17_000 },
+        );
+        const directResult = runner(
+          [
+            timeoutExecutable,
+            "--signal=TERM",
+            "--kill-after=0.25s",
+            "15s",
+            "/usr/bin/sudo",
+            "-n",
+            "-u",
+            "ollama",
+            "--",
+            "/usr/bin/env",
+            "LC_ALL=C",
+            "/bin/sh",
+            "-c",
+            '"$1" --version\nstatus=$?\ncase "$status" in\n  124|137) exit 1 ;;\n  *) exit "$status" ;;\nesac',
+            "nemoclaw-direct-service-user-proof",
+            executablePath,
+          ],
+          { timeout: 17_000 },
+        );
+        const obsoleteResult = runner(
+          [
+            "/usr/bin/sudo",
+            "-n",
+            "-u",
+            "ollama",
+            "--",
+            "/usr/bin/env",
+            "LC_ALL=C",
+            "/usr/bin/timeout",
+            "--signal=TERM",
+            "--kill-after=0.25s",
+            "15s",
+            executablePath,
+            "--version",
+          ],
+          { timeout: 17_000 },
+        );
 
-      assert.equal(systemdResult.timedOut, true);
-      assert.equal(directResult.exitCode, 0);
-      assert.equal(obsoleteResult.exitCode, 1);
-    } finally {
-      vi.unstubAllEnvs();
-      fs.rmSync(fixtureHome, { force: true, recursive: true });
-    }
-  });
+        assert.equal(systemdResult.timedOut, true);
+        assert.equal(directResult.exitCode, 0);
+        assert.equal(obsoleteResult.exitCode, 1);
+      } finally {
+        vi.unstubAllEnvs();
+        fs.
```

**File**: `test/helpers/onboard-child-runtime.ts` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ function createSuccessfulOllamaServiceExecutionProofRunner(fallback, systemdProo
     }
     const directSudoOffset = argv[5] === "-n" ? 6 : 5;
     if (
-      argv[0] === "/usr/bin/timeout" &&
+      (argv[0] === "/usr/bin/timeout" || argv[0] === "/usr/bin/gnutimeout") &&
       argv[1] === "--signal=TERM" &&
       argv[2] === "--kill-after=0.25s" &&
       argv[3] === "15s" &&
```

#### Recent Merged Pull Requests:
- **PR #12653** (closed): Chad/upstream merge 20261004 (@tantodefi)
- **PR #12637** (2026-10-05): docs: correct, deduplicate, and remove unpublished-format notes (@cv)
- **PR #12635** (2026-10-05): fix(policy): classify DCode's observability preset by provenance (@ericksoa)
- **PR #12633** (2026-10-05): fix(inference): load 64 GB Spark weights lazily (@jyaunches)
- **PR #12630** (2026-10-05): docs: state onboarding's open design questions instead of a backlog (@cv)
- **PR #12629** (2026-10-05): docs: move development guides into docs/contributing and drop process documents (@cv)
- **PR #12627** (2026-10-05): docs: remove the validation records (@cv)
- **PR #12624** (2026-10-05): fix(ci): validate preinstalled Tavily plugin (@rsliter)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
