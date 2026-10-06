# Forensic Learning Record (Deep Inspection): img2threejs/img2threejs

> **Canonical Artifact**: `07_PROJECT_LEARNING/img2threejs-img2threejs-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/img2threejs/img2threejs](https://github.com/img2threejs/img2threejs))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:17:06.474Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `img2threejs/img2threejs`
- **Description**: Rebuild the object in a reference image as a code-only, procedural, quality-gated, animation-ready Three.js model. Token-efficient image-to-3D.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 17552 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `forge/_shared/workflow_state.py`
```
from __future__ import annotations

import json
import os
import shlex
import sys
import tempfile
from copy import deepcopy
from pathlib import Path
from typing import Any, Final

sys.path.insert(0, str(Path(__file__).resolve().parent))

from domains import DomainRegistryError, domain_profile  # noqa: E402


SCHEMA_VERSION: Final = 1
STEP_STATUSES: Final = {"pending", "done", "skipped"}
REFINE_ACTIONS: Final = {"refine-spec", "refine-code"}


SETUP_STEPS: Final = (
    ("image-analysis", "Read grimoire/intake/image_analysis.md and analyze {reference}"),
    (
        "reference-suitability",
        "Read grimoire/intake/validation_rubric.md and record a pass, conditional, or reject verdict for {reference}",
    ),
    ("reference-admission",
     "python3 forge/stage1_intake/check_reference_admission.py {reference}"
     " --out admission.json --probe-out probe.json"),
    ("local-spec-search", "Run the local evidence search before authoring the assessment"),
    ("pre-spec-assessment",
     "python3 forge/stage2_spec/new_pre_spec_assessment.py \"<name>\" --image {reference}"
     " --domain {profile} --out assessment.json"),
    ("detail-inventory", "python3 forge/stage1_intake/build_detail_inventory.py {reference} --mode grid-3x3 --out-dir detail-inventory --out di.json"),
    (
        "projection-route",
        "Record whether projection is required; if required run solve_camera_pose.py, delight_albedo.py, and bake_projected_texture.py, otherwise skip with a reason",
    ),
    ("spec-authoring",
     "python3 forge/stage2_spec/new_sculpt_spec.py \"<name>\" --image {reference} --assessment assessment.json"
     " --augmentation spec-augmentation.json --domain {profile} --out object-sculpt-spec.json"),
    (
        "material-evidence",
        "python3 forge/stage1_intake/material_region_analysis.py --manifest material-regions.json --out-dir material-evidence --out material-analysis.json"
        " (single-crop route: analyze_texture.py + extract_pbr_evidence.py per verified crop; otherwise skip with a reason)",
    ),
    ("material-spec-wiring", "python3 forge/stage2_spec/apply_material_analysis.py {spec} material-analysis.json --in-place"),
    ("strict-validation", "python3 forge/stage2_spec/validate_sculpt_spec.py {spec} --strict-quality"),
)

PASS_STEPS: Final = (
    ("build-current-pass", "python3 forge/stage3_build/generate_threejs_factory.py {spec} --out src/createObjectModel.ts --pass-id {pass_id}"),
    ("render-capture", "Render {pass_id} and capture the fixed review view plus meaningful orbit views"),
    ("review-contract-read", "Read grimoire/review/gates_reference.md and grimoire/review/self_correction.md completely"),
    ("tier1-diagnostics", "python3 forge/stage4_review/diagnose_render.py --reference {reference} --render <shot> --spec {spec} --pass-id {pass_id} --in-place"),
    ("multi-angle-review", "python3 forge/stage4_review/diagnose_render_multi_angle.py --reference <fixed-shot> --orbit <orbit-shot> --orbit <orbit-shot>"),
    ("pass-gate-check", "python3 forge/stage3_build/orchestrate_passes.py check {spec} --pass-id {pass_id}"),
    ("ai-review-recorded", "Create the comparison sheet, inspect it with agent vision, and append exactly one review action"),
    ("pipeline-sync", "python3 forge/stage3_build/orchestrate_passes.py sync {spec} --in-place"),
)

FINAL_STEPS: Final = (
    ("part-coverage", "python3 forge/stage4_review/check_part_coverage.py --spec {spec} --manifest parts.json"),
    ("action-ready", "Verify explodable/clickable hierarchy, pivots, sockets, and root.userData.sculptRuntime"),
    # D4/task 3.8: base-owned, appended unconditionally -- no plugin ever splices this in (there is
    # no `finalSteps` key in domains/__init__.py's _ALLOWED, deliberately: a plugin must never be
    # able to change what runs at the terminal phase behind the user's back). An explicit
    # `--target <kind>` is the only thing that ever populates this step: on a successful run,
    # `emit_target.record_target_selection` marks it `done` and records which plugin ran (or
    # `None` for the reference target) in the new `targetSelection` state field, which slice 4's
    # gate-participation rule reads. With no `--target`, emit_target.py's no-op path (D2) never
    # touches this file at all -- correcting an earlier claim in this comment that the no-op path
    # marks the row "done"; it does not, and this row is left `pending` on that path (a stated,
    # not-yet-resolved rough edge: forge/next.py will keep naming it as the next required step
    # even though there is nothing further to do when no target will ever be selected). Round-3 H6:
    # workspaces created before this change do not carry this row in their persisted checklist
    # (new_state() materialises FINAL_STEPS once, at init) -- not breakage, since nothing crashes and
    # SCHEMA_VERSION stays 1, but emit_target.py's own action-ready precondition still enforces
    # terminal-only there directly, independent of whether this row exists in a given state file.
    (
        "emission-target",
        "python3 forge/stage3_build/emit_target.py --spec {spec} --workspace . "
        "[--target <kind> [--plugin <id>]]",
    ),
    # task 4.2's proposed hook point (see run_gates.py's module docstring for the full rationale):
    # a distinct checklist step, not auto-chained inside emit_target.py, following the same
    # discipline every other FINAL_STEPS/PASS_STEPS row already has -- the agent invokes it, it is
    # not triggered by the step before it. Harmless with no plugin involved: the two-clause rule
    # naturally yields zero gates to run, and this exits 0 having done nothing.
    ("plugin-gates", "python3 forge/stage3_build/run_gates.py --workspace ."),
)

class WorkflowStateError(ValueError):
    pass


def _anchor_index(rows: list[Any], anchor: str, profile: str, key) -> int:
    for index, row in enumerate(rows):
        if key(row) == anchor:
            return index
    # An unknown anchor is a contribution the base cannot place. Failing loud beats appending at the
    # end, which would put a domain's setup step after the steps that depend on it.
    raise WorkflowStateError(f"profile {profile!r} anchors a step before unknown base step {anchor!r}")


def _splice(rows: list[dict[str, Any]], steps, anchor: str | None, profile: str, *, scope: str) -> list[dict[str, Any]]:
    if not steps:
        return rows
    at = _anchor_index(rows, anchor, profile, lambda r: r["id"])
    return rows[:at] + [_step(*item, scope=scope) for item in steps] + rows[at:]


def _splice_raw(rows: list[Any], steps, anchor: str | None, profile: str) -> list[Any]:
    if not steps:
        return rows
    at = _anchor_index(rows, anchor, profile, lambda r: r[0])
    return rows[:at] + list(steps) + rows[at:]


def _step(step_id: str, command: str, *, scope: str) -> dict[str, Any]:
    return {
        "id": step_id,
        "scope": scope,
        "status": "pending",
        "evidence": [],
        "reason": "",
        "command": command,
    }


def new_state(
    reference: str,
    *,
    profile: str = "generic",
    spec: str = "",
    max_per_pass: int = 3,
    max_total: int = 6,
) -> dict[str, Any]:
    try:
        domain = domain_profile(profile)
    except DomainRegistryError as exc:
        raise WorkflowStateError(str(exc)) from exc
    if max_per_pass < 1 or max_total < 1 or max_per_pass > max_total:
        raise WorkflowStateError("loop limits require 1 <= max-per-pass <= max-total")

    setup = [_step(sid, cmd.replace("{profile}", profile), scope="setup") for sid, cmd in SETUP_STEPS]
    pass_steps = list(PASS_STEPS)
    if domain is not None:
        setup = _splice(setup, domain.get("setupSteps"), domain.get("setupAnchorBefore"), profile, scope="setup")
        pass_steps = _splice_raw(pass_steps, domain.get("passSteps"), domain.get("passAnchorBefore"), profile)
    state = {
        "schemaVersion": SCHEMA_VERSION,
        "status": "active",
        "profile": profile,
        "currentStep": setup[0]["id"],
        "currentPass": "",
        "checklist": setup
        + [_step(*item, scope="pass") for item in pass_steps]
        + [_step(*item, scope="final") for item in FINAL_STEPS]
        + [_step(*item, scope="rig") for item in ((domain.get("rigSteps") or ()) if domain else ())],
        "loops": {
            "perPass": {},
            "total": 0,
            "maxPerPass": max_per_pass,
            "maxTotal": max_total,
        },
        "artifacts": {"reference": reference, "spec": spec},
        "passHistory": [],
        "reviewCursor": 0,
        "iterationAction": "initial",
        "stopReason": "",
    }
    recompute(state)
    return state


def validate_state(state: Any) -> dict[str, Any]:
    if not isinstance(state, dict):
        raise WorkflowStateError("state must be a JSON object")
    if state.get("schemaVersion") != SCHEMA_VERSION:
        raise WorkflowStateError(f"unsupported state schemaVersion: {state.get('schemaVersion')!r}")
    # A state file written before its domain moved out must fail by naming the missing provider,
    # never by silently downgrading the run to generic.
    try:
        domain_profile(state.get("profile"))
    except DomainRegistryError as exc:
        raise WorkflowStateError(str(exc)) from exc
    checklist = state.get("checklist")
    if not isinstance(checklist, list) or not checklist:
        raise WorkflowStateError("state checklist must be a non-empty list")
    seen: set[str] = set()
    for entry in checklist:
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
            raise WorkflowStateError("every checklist entry needs a string id")
        if entry["id"] in seen:
            raise WorkflowStateError(f"duplicate checklist step: {entry['id']}")
        seen.add(entry["id"])
        if entry.get("scope") not in {"setup", "pass", "final", "rig"}:
            raise WorkflowStateError(f"invalid checklist scope for {entry[
```

### Core Architecture Module: `forge/stage4_review/correction_loop.py`
```
#!/usr/bin/env python3
"""Bounded stop-policy state machine for the Eye-driven correction loop.

Plan 1.3 Phase 4, §3.6 — bounded correction-loop stop policy.

This is a PURE-LOGIC module: no images, no repo imports, stdlib only. It decides,
after each iteration of an expensive VLM-driven correction loop, whether to stop
and what action the caller should take next.

TERMINATION GUARANTEE
---------------------
A caller that loops::

    while not decide(history)["stop"]:
        history.append(one_more_iteration())

can NEVER run more than ``max_iter`` iterations. The HARD_CEILING condition
(priority 8) fires purely on ``len(history) >= max_iter`` and cannot be bypassed
by any other state — not even a monotonically-improving-but-never-reaching-target
loop. This is the single most important property of this module; do not weaken it.
"""

from __future__ import annotations

import argparse
import json
import math
import sys


def decide(history, target_fidelity=0.85, max_iter=6, min_delta=0.02):
    """Decide whether to stop the correction loop and what to do next.

    Args:
        history: list of per-iteration dicts in chronological order, each
             ``{"fidelity": float in [0,1], "defectTags": list[str], "reverted": bool}``,
            with optional Divine Eye ``hardGateFailures: list[str]`` and
            ``pendingReview: bool`` routing metadata.
            ``reverted`` means that iteration's correction lowered the score and
            was auto-reverted.
        target_fidelity: fidelity at/above which the model is considered good enough.
        max_iter: non-bypassable ceiling on iterations — guarantees termination.
        min_delta: minimum per-iteration fidelity gain below which progress has
            plateaued.

    Returns:
        dict ``{"stop": bool, "action": str, "reason": str}``.

    Stop conditions are evaluated in strict priority order; the first match wins.
    """
    _validate_config(target_fidelity, max_iter, min_delta)
    _validate_history(history)

    # 1. EMPTY — nothing has happened yet.
    if not history:
        return {
            "stop": False,
            "action": "continue-iterating",
            "reason": "no iterations yet",
        }

    last = history[-1]
    prev = history[-2] if len(history) >= 2 else None

    hard_gates, action, verdict, pending_review, fidelity = _routing_state(last)

    # 2. HARD GATE — a Divine Eye hard failure needs code correction.
    if hard_gates:
        return {
            "stop": True,
            "action": "refine-code",
            "reason": f"hard gate failure: {hard_gates[0]}",
        }

    # 3. PENDING REVIEW — preserve the Divine Eye evaluator's non-continue routing.
    if pending_review:
        route = action if action in ("refine-code", "refine-spec") else "request-input"
        return {
            "stop": True,
            "action": route,
            "reason": f"pending Divine Eye review: {action or verdict}",
        }

    # 4. SUCCESS — target met and no open defects.
    if fidelity >= target_fidelity and not last["defectTags"]:
        return {
            "stop": True,
            "action": "continue",
            "reason": "fidelity target met, no open defects",
        }

    # 5. REPEATED_DEFECT — a defect tag survived two consecutive iterations.
    if prev is not None:
        shared = set(last["defectTags"]) & set(prev["defectTags"])
        if shared:
            tag = sorted(shared)[0]
            return {
                "stop": True,
                "action": "refine-spec",
                "reason": f"same defect survived 2 consecutive fixes: {tag}",
            }

    # 6. OSCILLATION — two trailing reverted iterations.
    reverts = 0
    for entry in reversed(history):
        if not entry.get("reverted"):
            break
        reverts += 1
    oscillating = reverts >= 2
    if oscillating:
        return {
            "stop": True,
            "action": "refine-spec",
            "reason": "oscillating/thrashing",
        }

    # 7. PLATEAU — progress stalled below target.
    if (
        prev is not None
        and (fidelity - _routing_state(prev)[4]) < min_delta
        and fidelity < target_fidelity
    ):
        return {
            "stop": True,
            "action": "request-input",
            "reason": "progress plateaued below target (Δ<min_delta)",
        }

    # 8. HARD_CEILING — non-bypassable termination guarantee.
    if len(history) >= max_iter:
        return {
            "stop": True,
            "action": "request-input",
            "reason": "hit MAX_ITER ceiling",
        }

    # 9. Otherwise — keep going.
    return {
        "stop": False,
        "action": "continue-iterating",
        "reason": "still improving toward target",
    }


def budget_exceeded(spent_tokens, budget):
    """§3.6 budget circuit-breaker.

    Returns True when the token budget is spent. The caller uses this to
    HALT-and-ask-the-user; it never silently continues.
    """
    if not _is_finite_number(spent_tokens) or spent_tokens < 0:
        raise ValueError("spent_tokens must be a finite non-negative number")
    if isinstance(budget, bool) or not isinstance(budget, int) or budget < 0:
        raise ValueError("budget must be a non-negative integer")
    return spent_tokens >= budget


def _validate_history(history):
    if not isinstance(history, list):
        raise ValueError("history must be a JSON list")
    for index, entry in enumerate(history):
        if not isinstance(entry, dict):
            raise ValueError(f"history[{index}] must be an object")
        fidelity = entry.get("fidelity")
        if isinstance(fidelity, bool) or not isinstance(fidelity, int | float) or not math.isfinite(fidelity) or not 0.0 <= fidelity <= 1.0:
            raise ValueError(f"history[{index}].fidelity must be a finite number in [0, 1]")
        _validate_tags(entry.get("defectTags"), f"history[{index}].defectTags")
        _routing_state(entry, index)
        if not isinstance(entry.get("reverted"), bool):
            raise ValueError(f"history[{index}].reverted must be a boolean")
    return history


def _validate_tags(tags, field):
    if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
        raise ValueError(f"{field} must be a list of strings")


def _routing_state(entry, index=None):
    prefix = f"history[{index}]" if index is not None else "history entry"
    if "pendingReview" in entry and not isinstance(entry["pendingReview"], bool):
        raise ValueError(f"{prefix}.pendingReview must be a boolean")
    provenance = entry.get("divineEye")
    if provenance is not None and not isinstance(provenance, dict):
        raise ValueError(f"{prefix}.divineEye must be an object")
    source = provenance if provenance is not None else entry
    fidelity = source.get("fidelity") if provenance is not None else entry.get("fidelity")
    if isinstance(fidelity, bool) or not isinstance(fidelity, int | float) or not math.isfinite(fidelity) or not 0.0 <= fidelity <= 1.0:
        raise ValueError(f"{prefix}.divineEye.fidelity must be a finite number in [0, 1]")
    if provenance is not None and entry["fidelity"] != fidelity:
        raise ValueError(f"{prefix}.fidelity conflicts with divineEye provenance")
    hard_gates = source.get("hardGateFailures", [])
    _validate_tags(hard_gates, f"{prefix}.hardGateFailures")
    action = source.get("action") if provenance is not None else entry.get("divineEyeAction")
    verdict = source.get("verdict") if provenance is not None else entry.get("divineEyeVerdict")
    if action is not None and not isinstance(action, str):
        raise ValueError(f"{prefix}.divineEyeAction must be a string")
    if verdict is not None and not isinstance(verdict, str):
        raise ValueError(f"{prefix}.divineEyeVerdict must be a string")
    pending_review = bool(entry.get("pendingReview", False)) or action not in (None, "continue") or verdict not in (None, "pass") or bool(hard_gates)
    if provenance is not None:
        expected = {"hardGateFailures": hard_gates, "divineEyeAction": action, "divineEyeVerdict": verdict, "pendingReview": pending_review}
        for key, value in expected.items():
            if key in entry and entry[key] != value:
                raise ValueError(f"{prefix}.{key} conflicts with divineEye provenance")
    return hard_gates, action, verdict, pending_review, fidelity


def _validate_config(target_fidelity, max_iter, min_delta):
    if not _is_finite_number(target_fidelity) or not 0.0 <= target_fidelity <= 1.0:
        raise ValueError("target_fidelity must be a finite number in [0, 1]")
    if isinstance(max_iter, bool) or not isinstance(max_iter, int) or max_iter <= 0:
        raise ValueError("max_iter must be a positive integer")
    if not _is_finite_number(min_delta) or min_delta < 0.0:
        raise ValueError("min_delta must be finite and non-negative")


def _is_finite_number(value):
    return not isinstance(value, bool) and isinstance(value, int | float) and math.isfinite(value)


def main(argv):
    parser = argparse.ArgumentParser(
        description="Bounded correction-loop stop policy (§3.6)."
    )
    parser.add_argument("--history", required=True, help="path to JSON list of iterations")
    parser.add_argument("--target", type=float, default=0.85, help="target fidelity")
    parser.add_argument("--max-iter", type=int, default=6, help="hard iteration ceiling")
    parser.add_argument("--min-delta", type=float, default=0.02, help="plateau threshold")
    parser.add_argument("--json", action="store_true", help="emit decision as JSON")

    try:
        args = parser.parse_args(argv)
        with open(args.history, "r", encoding="utf-8") as fh:
            history = json.load(fh)

        decision = decide(
            history,
            target_fidelity=args.target,
            max_iter=args.max_iter,
            min_delta=args.min_delta,
        )

        if args.json:
            pr
```

### Core Architecture Module: `forge/stage4_review/diagnose_render.py`
```
#!/usr/bin/env python3
"""Tier-1 cheap, deterministic diagnostics — run BEFORE any expensive AI-vision
comparison-sheet review (Plan 1.3 Workstream B). Pure Python 3.10+ standard
library only, no PIL/numpy, matching the rest of forge/.

Output is a machine-checked pass/fail plus numbers — no visual judgment, no
AI-vision call. `orchestrate_passes.py` refuses to unlock the comparison-sheet
step until a passing tier1Result exists for the current render's hash
(Workstream D).

Known scope limitation: per_part_color_delta compares the render's OVERALL
dominant color clusters against each component's colorMaterialRecipe, not a
true per-component cropped region (that would need per-component render-crop
coordinates, which the pipeline does not yet track). This is a coarser signal
than the plan's ideal, but per Risk R7, Tier 1 only needs to be discriminative
enough to catch gross mismatches, not pixel-perfect — documented here rather
than silently overclaimed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "stage1_intake"))
from extract_pbr_evidence import build_foreground_mask, load_image  # noqa: E402
from extract_part_color_recipe import lab_distance, lab_kmeans_palette, srgb_to_lab  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "stage3_build"))
from orchestrate_passes import DEFAULT_PASS_ORDER, load_spec  # noqa: E402
from geometry_integrity import measure_geometry_integrity  # noqa: E402
from status_banner import emit_status, load_optional_spec  # noqa: E402


def color_is_gated(pass_id: str | None) -> bool:
    """Per-part color fidelity is a hard criterion only from `material-pass` onward.

    Blockout / structural / form-refinement passes render the model with clay
    (materials deliberately stripped) so the silhouette can be judged on shape
    alone — comparing their per-part color against a colored reference always
    fails and says nothing about those passes' goals. Before material-pass (or
    when the pass is unknown) the color delta is recorded as informational, never
    a failure. This mirrors the skill doctrine: "blockout: silhouette reads
    correctly WITHOUT materials".
    """
    if pass_id is None:
        return False
    try:
        return DEFAULT_PASS_ORDER.index(pass_id) >= DEFAULT_PASS_ORDER.index("material-pass")
    except ValueError:
        return False


SILHOUETTE_IOU_THRESHOLD = 0.85
ASPECT_RATIO_DELTA_THRESHOLD = 0.05
SCALE_DELTA_THRESHOLD = 0.08
SYMMETRY_ERROR_THRESHOLD = 0.10
COLOR_DELTA_E_THRESHOLD = 20.0  # generous vs. the JND (~2-3) to tolerate render/photo lighting gaps
MASK_GRID_SIZE = 224


def mask_is_inverted(warnings: list[str]) -> bool:
    """Return whether foreground extraction fell back to whole-frame coverage."""
    return any("tiny" in str(warning).lower() for warning in warnings)


def largest_component(mask: list[bool], size: int) -> tuple[list[bool], float]:
    """Keep the largest 4-connected blob; return it and the fraction of cells discarded.

    WHY. `bbox_of` is an EXTREMAL statistic: one stray foreground cell in a corner moves the
    bounding box to the frame edge, and every proportion derived from it with it. Measured on a
    real review plate, a subject filling 24% of the grid reported a bbox of the entire 224x224
    grid, so `aspectRatioDelta` and `scaleDelta` were describing the render's background gradient
    and did not move at all when the camera did.

    The discarded fraction is returned rather than swallowed: a subject with genuinely separated
    parts in projection -- a floating accessory, a detached prop -- would lose them here, and that
    has to be visible instead of quietly improving the numbers.
    """
    seen = [False] * len(mask)
    best: list[int] = []
    total = sum(1 for value in mask if value)
    for start in range(len(mask)):
        if not mask[start] or seen[start]:
            continue
        stack = [start]
        seen[start] = True
        blob = []
        while stack:
            index = stack.pop()
            blob.append(index)
            y, x = divmod(index, size)
            for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                if 0 <= nx < size and 0 <= ny < size:
                    neighbour = ny * size + nx
                    if mask[neighbour] and not seen[neighbour]:
                        seen[neighbour] = True
                        stack.append(neighbour)
        if len(blob) > len(best):
            best = blob
    filtered = [False] * len(mask)
    for index in best:
        filtered[index] = True
    discarded = (total - len(best)) / total if total else 0.0
    return filtered, discarded


def load_mask(png_path: Path, size: int = MASK_GRID_SIZE) -> tuple[list[bool], list[str]]:
    """Return the resized foreground mask and extraction warnings."""
    width, height, pixels, _warnings = load_image(png_path)
    mask, _diag, mask_warnings = build_foreground_mask(width, height, pixels)
    resized: list[bool] = []
    for y in range(size):
        sy = min(height - 1, int(y * height / size))
        for x in range(size):
            sx = min(width - 1, int(x * width / size))
            resized.append(mask[sy * width + sx])
    filtered, discarded = largest_component(resized, size)
    if discarded > 0.02:
        mask_warnings = list(mask_warnings) + [
            f"{discarded:.1%} of foreground cells lie outside the largest connected blob and were "
            "excluded from the bounding box; if the subject really has separated parts in this "
            "projection, they are not being measured"
        ]
    return filtered, mask_warnings


def silhouette_iou(reference_mask: list[bool], render_mask: list[bool]) -> float:
    intersection = 0
    union = 0
    for ref, render in zip(reference_mask, render_mask):
        if ref or render:
            union += 1
            if ref and render:
                intersection += 1
    return intersection / union if union else 0.0


def bbox_of(mask: list[bool], size: int = MASK_GRID_SIZE) -> tuple[int, int, int, int]:
    xs: list[int] = []
    ys: list[int] = []
    for index, value in enumerate(mask):
        if value:
            xs.append(index % size)
            ys.append(index // size)
    if not xs:
        return (0, 0, 0, 0)
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    return (x0, y0, x1 - x0 + 1, y1 - y0 + 1)


def proportion_delta(
    reference_bbox: tuple[int, int, int, int],
    render_bbox: tuple[int, int, int, int],
) -> dict[str, float]:
    _rx, _ry, rw, rh = reference_bbox
    _dx, _dy, dw, dh = render_bbox
    ref_ar = rw / rh if rh else 0.0
    render_ar = dw / dh if dh else 0.0
    aspect_ratio_delta = abs(ref_ar - render_ar) / ref_ar if ref_ar else (0.0 if render_ar == 0 else 1.0)
    ref_area = rw * rh
    render_area = dw * dh
    scale_delta = abs(ref_area - render_area) / ref_area if ref_area else (0.0 if render_area == 0 else 1.0)
    return {"aspect_ratio_delta": round(aspect_ratio_delta, 4), "scale_delta": round(scale_delta, 4)}


def bilateral_symmetry_error(mask: list[bool], size: int = MASK_GRID_SIZE) -> float:
    total = 0
    mismatches = 0
    for y in range(size):
        row_offset = y * size
        for x in range(size):
            mirrored_x = size - 1 - x
            total += 1
            if mask[row_offset + x] != mask[row_offset + mirrored_x]:
                mismatches += 1
    return mismatches / total if total else 0.0


def per_part_color_delta(recipes: list[dict[str, Any]], render_path: Path) -> dict[str, Any]:
    """Compares each component's colorMaterialRecipe against the render's overall
    dominant Lab-space color clusters (see module docstring for the per-component-
    region scope limitation). Returns per-recipe delta-E and a pass/fail summary."""
    if not recipes:
        return {"checked": 0, "maxDeltaE": 0.0, "perComponent": []}
    width, height, pixels, _warnings = load_image(render_path)
    mask, _diag, _warn = build_foreground_mask(width, height, pixels)
    foreground_lab = [srgb_to_lab((r, g, b)) for (r, g, b, _a), keep in zip(pixels, mask) if keep]
    clusters = lab_kmeans_palette(foreground_lab, k=min(5, max(1, len(recipes))))
    results = []
    for recipe in recipes:
        dominant = recipe.get("dominantAlbedo")
        if not isinstance(dominant, str):
            continue
        try:
            rgb_text = dominant[dominant.index("(") + 1 : dominant.index(")")]
            r, g, b = (int(float(part.strip())) for part in rgb_text.split(",")[:3])
        except (ValueError, IndexError):
            continue
        expected_lab = srgb_to_lab((r, g, b))
        best_delta = min((lab_distance(expected_lab, c["center"]) for c in clusters), default=999.0)
        results.append({"componentId": recipe.get("componentId"), "deltaE": round(best_delta, 2)})
    max_delta = max((entry["deltaE"] for entry in results), default=0.0)
    return {"checked": len(results), "maxDeltaE": round(max_delta, 2), "perComponent": results}


def render_hash(render_path: Path) -> str:
    return hashlib.sha256(render_path.read_bytes()).hexdigest()[:16]


def strip_material_maps(scene: object) -> object:
    if isinstance(scene, list):
        return [strip_material_maps(item) for item in scene]
    if not isinstance(scene, dict):
        return scene
    result = {key: strip_material_maps(value) for key, value in scene.items()}
    for key in ("map", "normalMap", "roughnessMap", "metalnessMap", "aoMap"):
        if key in result:
            result[key] = None
    return result


def run_tier1(
    reference_path: Path,
    render_path: Path,
    spec_path: Path | None = None,
    pass_id: str | None = None,
) -> dict[str, Any]:
    reference_mask, reference_mask_warnings = load_mask(reference_path)
    render_mask, render_mask_warnings = load_mask(rend
```

### Core Architecture Module: `forge/stage4_review/diagnose_render_multi_angle.py`
```
#!/usr/bin/env python3
"""Deterministic Phase-3 §3.2 multi-angle "degenerate-view" check.

A flat plane faking a 3D volume looks convincing from the single reference
camera angle, but its silhouette AREA collapses when the camera orbits: a
billboard seen edge-on nearly vanishes. This module exploits that. Given a set
of already-rendered PNGs of the SAME object from different camera angles, it
measures each frame's foreground silhouette area (as a fraction of the frame)
and flags "degenerate-view" when a non-reference angle's area collapses far
below the reference angle's area.

This check is deterministic and costs zero tokens: it is pure pixel arithmetic
over foreground masks, reusing the stage1 intake loader/segmenter.

Scope: this module only ANALYZES already-captured PNGs. Driving an actual
browser / renderer to PRODUCE the orbit PNGs is a separate concern handled
elsewhere in the pipeline.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "stage1_intake"))
from extract_pbr_evidence import load_image, build_foreground_mask, mask_bbox  # noqa: E402


def silhouette_area_fraction(png_path: Path) -> float:
    """Return the fraction of the frame occupied by the object's silhouette.

    Loads the image, segments the foreground from the background, and returns
    (foreground pixel count / total pixels). ``mask_bbox`` is imported and kept
    available for callers/tests that want the tight silhouette box, but the area
    fraction itself is computed from the full mask so a small-but-wide sliver
    is scored purely by how much of the frame it actually fills.
    """
    path = Path(png_path)
    width, height, pixels, _warnings = load_image(path)
    mask, _diag, mask_warnings = build_foreground_mask(width, height, pixels)
    total = len(mask)
    if total <= 0:
        return 0.0
    # HARDENING (lead, from the multiangle worker's finding): build_foreground_mask has
    # a <3.5%-coverage safety fallback that INVERTS a tiny mask to "all opaque pixels"
    # (coverage → ~1.0). For degenerate-view detection that is exactly backwards — a plane
    # orbited edge-on yields a near-zero silhouette that MUST read as collapsed, not full.
    # So when the fallback fired, report near-zero (the true, pre-inversion silhouette).
    if any("tiny" in str(w).lower() for w in mask_warnings):
        return 0.0
    foreground = sum(1 for value in mask if value)
    return foreground / total


def analyze_angles(
    reference_png: Path,
    orbit_pngs: list[Path],
    collapse_ratio: float = 0.15,
) -> dict[str, Any]:
    """Compare each orbit angle's silhouette area against the reference angle.

    For every orbit angle, ``ratio = orbit_area / reference_area``. When the
    reference area is 0 the ratio is treated as 0.0 (divide-by-zero guard). Any
    orbit angle whose ratio is below ``collapse_ratio`` is flagged degenerate:
    the object nearly vanished from that viewpoint, which is what a flat plane
    faking a volume does when orbited.
    """
    reference_area = silhouette_area_fraction(Path(reference_png))
    angles: list[dict[str, Any]] = []
    any_degenerate = False
    for orbit in orbit_pngs:
        orbit_area = silhouette_area_fraction(Path(orbit))
        ratio = 0.0 if reference_area <= 0.0 else orbit_area / reference_area
        degenerate = ratio < collapse_ratio
        if degenerate:
            any_degenerate = True
        angles.append(
            {
                "path": str(orbit),
                "areaFraction": orbit_area,
                "ratio": ratio,
                "degenerate": degenerate,
            }
        )
    return {
        "referenceAreaFraction": reference_area,
        "angles": angles,
        "degenerate": any_degenerate,
        "collapseRatio": collapse_ratio,
        "note": (
            "deterministic; zero token; a flat-plane-faking-a-volume collapses "
            "in silhouette area when orbited"
        ),
    }


def _format_summary(result: dict[str, Any]) -> str:
    lines = [
        f"reference area fraction: {result['referenceAreaFraction']:.4f}",
        f"collapse ratio threshold: {result['collapseRatio']}",
    ]
    for angle in result["angles"]:
        flag = "DEGENERATE" if angle["degenerate"] else "ok"
        lines.append(
            f"  [{flag}] {angle['path']} "
            f"area={angle['areaFraction']:.4f} ratio={angle['ratio']:.4f}"
        )
    verdict = "DEGENERATE-VIEW DETECTED" if result["degenerate"] else "no degenerate view"
    lines.append(f"verdict: {verdict}")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reference", type=Path, required=True, help="reference-angle PNG")
    parser.add_argument(
        "--orbit",
        type=Path,
        action="append",
        default=[],
        help="orbit-angle PNG (repeat for each angle)",
    )
    parser.add_argument("--collapse-ratio", type=float, default=0.15)
    parser.add_argument("--json", action="store_true", help="print JSON instead of a summary")
    args = parser.parse_args(argv)

    try:
        result = analyze_angles(args.reference, args.orbit, args.collapse_ratio)
        if args.json:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print(_format_summary(result))
        return 1 if result["degenerate"] else 0
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

```

### Core Architecture Module: `forge/stage4_review/joint_loops.py`
```
#!/usr/bin/env python3
"""Does the mesh carry enough edge loops at each joint to survive being bent?

A skinned joint with too few rings of geometry across it collapses when it flexes: the elbow pinches
into a crease, the knee loses its volume, the shoulder creases into a fold. No amount of weight
tuning fixes it, because there is simply nothing there to deform -- the vertices needed to describe a
bent surface do not exist.

The usual answer to this in a mesh-generation pipeline is retopology, and the honest industry position
is that automatic remeshing does NOT reliably produce deformation-grade topology; people still
retopologize by hand. But that constraint belongs to pipelines that receive a finished mesh. A
procedural generator writes its own topology, so it can place loops at joints BY CONSTRUCTION and
never need to repair them afterwards. This module is the gate that makes that a requirement rather
than a hope.

Method: for each joint, take the vertices within a radius of it, project them onto the bone axis, and
count how many distinct bands along that axis they occupy. Bands, not raw vertex count: ten thousand
vertices in two rings still cannot bend, and counting vertices would call that mesh dense and pass it.

The gate deliberately does not try to identify true quad edge loops. Recovering loop structure from a
triangle soup is fragile, and the property that actually matters for deformation -- enough
independently movable rings across the joint -- is exactly what band counting measures.

Pure Python 3.10+ stdlib.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

MIN_LOOPS_PER_JOINT = 3
DEFAULT_RADIUS_SCALE = 0.35
BAND_TOLERANCE = 0.5


def _triangles(indices: list[Any]) -> list[tuple[int, int, int]]:
    if indices and isinstance(indices[0], (list, tuple)):
        return [(int(t[0]), int(t[1]), int(t[2])) for t in indices]
    return [
        (int(indices[i]), int(indices[i + 1]), int(indices[i + 2]))
        for i in range(0, len(indices) - 2, 3)
    ]


def _sub(a, b):
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]


def _dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _norm(a):
    return math.sqrt(_dot(a, a))


def count_loops_at_joint(
    vertices: list[list[float]],
    joint: list[float],
    axis_start: list[float],
    axis_end: list[float],
    radius: float,
    band_tolerance: float = BAND_TOLERANCE,
) -> dict[str, Any]:
    """Count distinct vertex bands along the bone axis within `radius` of the joint.

    `band_tolerance` is a fraction of the mean gap between consecutive projections: two vertices
    closer together than that are the same ring. Using an absolute epsilon instead would make the
    count depend on the model's units, so the same character at two scales would score differently.
    """
    direction = _sub(axis_end, axis_start)
    length = _norm(direction)
    if length <= 1e-12:
        return {"loops": 0, "vertexCount": 0, "reason": "bone has zero length"}
    axis = [component / length for component in direction]

    # An AXIAL window, not a sphere around the joint. A sphere drops rings simply because the limb is
    # thick -- on a tube of radius 0.5 spanning a bone of length 2, the rings either side of the joint
    # sit 0.707 away and a 0.7 sphere excludes every one of them, scoring a perfectly bendable joint
    # as having a single loop. Thickness has nothing to do with whether a joint can bend; what matters
    # is how many bands sit ALONG the bone near the joint. The radial cap only keeps unrelated
    # geometry that happens to run parallel from being counted.
    radial_cap = radius * 2.0
    projections: list[float] = []
    for vertex in vertices:
        offset = _sub(vertex, joint)
        along = _dot(offset, axis)
        if abs(along) > radius:
            continue
        radial = math.sqrt(max(0.0, _dot(offset, offset) - along * along))
        if radial > radial_cap:
            continue
        projections.append(along)
    if len(projections) < 2:
        return {"loops": len(projections), "vertexCount": len(projections)}

    projections.sort()
    span = projections[-1] - projections[0]
    if span <= 1e-12:
        return {"loops": 1, "vertexCount": len(projections)}
    mean_gap = span / max(1, len(projections) - 1)
    threshold = mean_gap * band_tolerance

    loops = 1
    previous = projections[0]
    for value in projections[1:]:
        if value - previous > threshold:
            loops += 1
        previous = value
    return {"loops": loops, "vertexCount": len(projections), "axialSpan": round(span, 6)}


def analyze_joint_loops(
    meshes: list[dict[str, Any]],
    bones: list[dict[str, Any]],
    min_loops: int = MIN_LOOPS_PER_JOINT,
    radius_scale: float = DEFAULT_RADIUS_SCALE,
) -> dict[str, Any]:
    """Check every bone's joint against the pooled surface of all supplied meshes.

    Pooled rather than per mesh: a joint often sits where two components meet, and asking each mesh
    separately would let a joint pass because one half of it happens to be dense while the other has
    nothing there at all.
    """
    pooled: list[list[float]] = []
    for mesh in meshes:
        vertices = mesh.get("vertices")
        if isinstance(vertices, list):
            pooled.extend(vertices)
    if not pooled:
        raise ValueError("no vertices supplied")

    reports: list[dict[str, Any]] = []
    failures: list[str] = []
    for bone in bones:
        joint = bone.get("jointPos")
        tip = bone.get("tipPos")
        if not isinstance(joint, list) or not isinstance(tip, list):
            continue
        bone_length = _norm(_sub(tip, joint))
        radius = bone_length * radius_scale
        measured = count_loops_at_joint(pooled, joint, joint, tip, radius)
        record = {
            "bone": str(bone.get("id")),
            "radius": round(radius, 6),
            "minLoops": min_loops,
            **measured,
        }
        record["passes"] = measured["loops"] >= min_loops
        if not record["passes"]:
            failures.append(
                f"{record['bone']}: {measured['loops']} loop(s) within {record['radius']} of the "
                f"joint, needs {min_loops}; this joint will crease rather than bend"
            )
        reports.append(record)

    return {
        "joints": reports,
        "failures": failures,
        "jointCount": len(reports),
        "failingJointCount": len(failures),
        "passed": not failures,
        "note": (
            "loops are counted as distinct vertex bands along the bone axis, not as recovered quad "
            "loops; a dense joint with only two bands still cannot bend and is reported as such"
        ),
    }


def _format_summary(result: dict[str, Any]) -> str:
    lines = [f"joints checked: {result['jointCount']}"]
    for record in result["joints"]:
        flag = "ok" if record["passes"] else "TOO FEW LOOPS"
        lines.append(
            f"  [{flag}] {record['bone']} loops={record['loops']} "
            f"vertices={record['vertexCount']} radius={record['radius']}"
        )
    lines.append("verdict: PASS" if result["passed"] else "verdict: GATE FAILURE")
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Check edge-loop density at rig joints.")
    parser.add_argument("meshes", type=Path, help="JSON with a meshes array, or a single mesh")
    parser.add_argument("--bones", type=Path, required=True)
    parser.add_argument("--min-loops", type=int, default=MIN_LOOPS_PER_JOINT)
    parser.add_argument("--radius-scale", type=float, default=DEFAULT_RADIUS_SCALE)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    try:
        payload = json.loads(args.meshes.read_text())
        meshes = payload["meshes"] if isinstance(payload, dict) and isinstance(payload.get("meshes"), list) else [payload]
        result = analyze_joint_loops(
            meshes, json.loads(args.bones.read_text()), args.min_loops, args.radius_scale
        )
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2) if args.json else _format_summary(result))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

```

### Core Architecture Module: `forge/stage4_review/render_bridge.py`
```
#!/usr/bin/env python3
"""Deterministic manifest and evidence controller for browser Three.js renders.

This module does not render a model. It creates a camera batch, validates saved
screenshots, records provenance, and delegates deterministic image checks to the
existing review gates. A browser adapter (Chrome MCP or Playwright) must produce
the actual Three.js pixels.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

STAGE1 = Path(__file__).resolve().parents[1] / "stage1_intake"
sys.path.insert(0, str(STAGE1))
from probe_image import probe  # noqa: E402
from probe_glb import probe_glb  # noqa: E402

REVIEW_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(REVIEW_DIR))
from multi_pass import PASS_IDS, default_pass_records, record_pass, validate_pass_records  # noqa: E402


CAPTURE_PLAN: tuple[dict[str, Any], ...] = (
    {"id": "hero", "role": "reference-match", "azimuthDegrees": 0, "elevationDegrees": 0},
    {"id": "orbit-plus35", "role": "orbit", "azimuthDegrees": 35, "elevationDegrees": 0},
    {"id": "orbit-minus35", "role": "orbit", "azimuthDegrees": -35, "elevationDegrees": 0},
    {"id": "profile", "role": "orbit", "azimuthDegrees": 78, "elevationDegrees": 0},
    {"id": "rear", "role": "orbit", "azimuthDegrees": 180, "elevationDegrees": 0},
    {"id": "head-hero", "role": "head-closeup", "azimuthDegrees": 0, "elevationDegrees": 0},
    {"id": "head-threequarter", "role": "head-closeup", "azimuthDegrees": 35, "elevationDegrees": 0},
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_manifest(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError("manifest root must be an object")
    return value


def write_manifest(path: Path, manifest: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    temporary.replace(path)


def manifest_path(manifest_path_value: Path, value: str) -> Path:
    candidate = Path(value).expanduser()
    return candidate if candidate.is_absolute() else (manifest_path_value.parent / candidate).resolve()


def portable_path(manifest_path_value: Path, value: Path) -> str:
    resolved = value.expanduser().resolve()
    try:
        return resolved.relative_to(manifest_path_value.parent.resolve()).as_posix()
    except ValueError:
        return str(resolved)


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def init_manifest(
    reference: Path | None,
    runtime_url: str,
    output: Path,
    viewport: tuple[int, int],
    device_pixel_ratio: float,
    output_dir: str,
    reference_glb: Path | None = None,
    reference_browser_url: str | None = None,
    render_profile: Path | None = None,
) -> dict[str, Any]:
    if (reference is None) == (reference_glb is None):
        raise ValueError("provide exactly one of reference image or reference GLB")

    if reference_glb is not None:
        reference_glb = reference_glb.expanduser().resolve()
        reference_probe: dict[str, Any] = probe_glb(reference_glb)
        if reference_probe.get("referenceReadiness") != "pass":
            raise ValueError(f"reference GLB is not usable: {reference_glb}")
        reference_record: dict[str, Any] = {
            "kind": "glb",
            "path": portable_path(output, reference_glb),
            "sha256": reference_probe["sha256"],
            "probe": reference_probe,
            "comparisonBasis": "browser-rendered-glb",
            "renderRequired": True,
        }
        if reference_browser_url:
            reference_record["browserUrl"] = reference_browser_url
    else:
        assert reference is not None
        reference = reference.expanduser().resolve()
        if not reference.is_file():
            raise ValueError(f"reference does not exist: {reference}")
        reference_probe = probe(reference)
        if not reference_probe.get("type") or not reference_probe.get("width"):
            raise ValueError(f"reference is not a readable image: {reference}")
        reference_record = {
            "kind": "image",
            "path": portable_path(output, reference),
            "sha256": sha256(reference),
            "image": reference_probe,
            "comparisonBasis": "source-image",
            "renderRequired": False,
        }

    captures = []
    for item in CAPTURE_PLAN:
        captures.append(
            {
                **item,
                "target": [0, 0, 0],
                "near": 0.01,
                "far": 100,
                "path": f"{output_dir.rstrip('/')}/{item['id']}.png",
                "status": "pending",
                "passes": default_pass_records(f"{output_dir.rstrip('/')}/{item['id']}"),
            }
        )
    if reference_record["kind"] == "glb":
        for item in captures:
            item["reference"] = {
                "path": f"reference/{item['id']}.png",
                "status": "pending",
                "passes": default_pass_records(f"reference/{item['id']}"),
            }
    manifest: dict[str, Any] = {
        "schemaVersion": 1,
        "createdAt": now_utc(),
        "runtime": {
            "url": runtime_url,
            "route": runtime_url.split("#", 1)[-1] if "#" in runtime_url else runtime_url,
            "viewport": list(viewport),
            "devicePixelRatio": device_pixel_ratio,
            "renderer": "WebGLRenderer",
            "threeVersion": "project-pinned",
            "readySignal": "window.__IMG2THREEJS_READY__",
            "captureContract": "window.__IMG2THREEJS_CAPTURE__",
        },
        "reference": reference_record,
        "captures": captures,
        "evidence": {
            "browser": None,
            "diagnostics": [],
            "comparisonSheet": None,
        },
    }
    if render_profile is not None:
        profile_path = render_profile.expanduser().resolve()
        if not profile_path.is_file():
            raise ValueError(f"render profile does not exist: {profile_path}")
        from validate_render_profile import validate_file  # noqa: PLC0415

        profile_validation = validate_file(profile_path)
        if not profile_validation["passed"]:
            raise ValueError(f"render profile is invalid: {profile_validation['errors']}")
        manifest["fidelityTrack"] = "glb-mediated-v2"
        manifest["renderProfile"] = {
            "path": portable_path(output, profile_path),
            "sha256": sha256(profile_path),
            "schemaVersion": "render-profile.v2",
            "sharedBy": ["glb-reference", "procedural"],
        }
    return manifest


def find_capture(manifest: dict[str, Any], capture_id: str) -> dict[str, Any]:
    for capture in manifest.get("captures", []):
        if isinstance(capture, dict) and capture.get("id") == capture_id:
            return capture
    raise ValueError(f"capture id not found: {capture_id}")


def record_capture(
    manifest_path_value: Path,
    manifest: dict[str, Any],
    capture_id: str,
    screenshot: Path,
    ready_signal: Any = True,
    console_errors: list[str] | None = None,
    browser_snapshot: dict[str, Any] | None = None,
) -> dict[str, Any]:
    screenshot = screenshot.expanduser().resolve()
    if not screenshot.is_file():
        raise ValueError(f"screenshot does not exist: {screenshot}")
    image = probe(screenshot)
    if not image.get("type") or not image.get("width") or not image.get("height"):
        raise ValueError(f"screenshot is not readable: {screenshot}")
    errors = list(console_errors or [])
    capture = find_capture(manifest, capture_id)
    capture["path"] = portable_path(manifest_path_value, screenshot)
    capture["status"] = "recorded"
    capture["recordedAt"] = now_utc()
    capture["readySignal"] = ready_signal
    capture["screenshotSha256"] = sha256(screenshot)
    capture["image"] = image
    capture["consoleErrors"] = errors
    if browser_snapshot is not None:
        capture["browserSnapshot"] = browser_snapshot
    return capture


def record_reference_capture(
    manifest_path_value: Path,
    manifest: dict[str, Any],
    capture_id: str,
    screenshot: Path,
    ready_signal: Any = True,
    console_errors: list[str] | None = None,
) -> dict[str, Any]:
    """Record a browser screenshot of the GLB reference baseline.

    The GLB itself is never treated as pixel evidence. The reference must first
    be loaded by the same Three.js route (or an explicit reference mode of it).
    """
    reference = manifest.get("reference")
    if not isinstance(reference, dict) or reference.get("kind") != "glb":
        raise ValueError("reference captures are only valid for a GLB reference manifest")
    screenshot = screenshot.expanduser().resolve()
    if not screenshot.is_file():
        raise ValueError(f"screenshot does not exist: {screenshot}")
    image = probe(screenshot)
    if not image.get("type") or not image.get("width") or not image.get("height"):
        raise ValueError(f"screenshot is not readable: {screenshot}")
    capture = find_capture(manifest, capture_id)
    record = capture.setdefault("reference", {})
    record.update(
        {
            "path": portable_path(manifest_path_value, screenshot),
            "status": "recorded",
            "recordedAt": now_utc(),
            "readySignal": ready_signal,
            "screenshotSha256": sha256(screenshot),
            "image": image,
            "consoleErrors": list(console_errors or []),
        }
    )
    return record


def record_
```

### Core Architecture Module: `forge/stage4_review/validate_render_profile.py`
```
#!/usr/bin/env python3
"""Validate the shared GLB/procedural browser render profile.

The validator is intentionally dependency-free and stricter than the descriptive
JSON Schema: the same profile must be usable by both routes, and the six diagnostic
passes plus the one-feedback-group ordering are mandatory for v2.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


PASS_IDS = (
    "beauty",
    "alpha-silhouette",
    "semantic-id",
    "depth",
    "normal",
    "roughness-material-id",
)
FEEDBACK_GROUPS = ("camera", "silhouette", "face", "clothing", "accessory", "materials", "lighting")
TONE_MAPPINGS = {"NoToneMapping", "ACESFilmicToneMapping", "AgXToneMapping", "NeutralToneMapping"}


def _is_vec(value: Any, length: int) -> bool:
    return isinstance(value, list) and len(value) == length and all(isinstance(item, (int, float)) for item in value)


def validate_profile(profile: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    if profile.get("schemaVersion") != "render-profile.v2":
        errors.append("schemaVersion must be render-profile.v2")
    if profile.get("kind") != "threejs-render-profile":
        errors.append("kind must be threejs-render-profile")
    if profile.get("authority") != "browser-threejs":
        errors.append("authority must be browser-threejs")

    renderer = profile.get("renderer")
    if not isinstance(renderer, dict):
        errors.append("renderer must be an object")
    else:
        required = {
            "backend",
            "colorManagementEnabled",
            "workingColorSpace",
            "outputColorSpace",
            "toneMapping",
            "toneMappingExposure",
            "viewport",
            "devicePixelRatio",
            "antialias",
        }
        for key in sorted(required - renderer.keys()):
            errors.append(f"renderer.{key} is required")
        if renderer.get("backend") != "WebGLRenderer":
            errors.append("renderer.backend must be WebGLRenderer")
        if renderer.get("colorManagementEnabled") is not True:
            errors.append("renderer.colorManagementEnabled must be true")
        if renderer.get("workingColorSpace") != "Linear-sRGB":
            errors.append("renderer.workingColorSpace must be Linear-sRGB")
        if renderer.get("outputColorSpace") != "SRGBColorSpace":
            errors.append("renderer.outputColorSpace must be SRGBColorSpace")
        if renderer.get("toneMapping") not in TONE_MAPPINGS:
            errors.append("renderer.toneMapping is not a supported Three.js profile value")
        if not isinstance(renderer.get("toneMappingExposure"), (int, float)) or renderer.get("toneMappingExposure", 0) <= 0:
            errors.append("renderer.toneMappingExposure must be > 0")
        viewport = renderer.get("viewport")
        if not _is_vec(viewport, 2) or any(int(value) != value or value <= 0 for value in viewport):
            errors.append("renderer.viewport must be [positive integer width, positive integer height]")
        if not isinstance(renderer.get("devicePixelRatio"), (int, float)) or renderer.get("devicePixelRatio", 0) <= 0:
            errors.append("renderer.devicePixelRatio must be > 0")
        if not isinstance(renderer.get("antialias"), bool):
            errors.append("renderer.antialias must be boolean")

    environment = profile.get("environment")
    if not isinstance(environment, dict):
        errors.append("environment must be an object")
    else:
        if environment.get("kind") not in {"none", "pmrem-hdr", "pmrem-equirectangular", "pmrem-cubemap"}:
            errors.append("environment.kind must identify a PMREM or none")
        if not isinstance(environment.get("source"), str):
            errors.append("environment.source is required")
        if not isinstance(environment.get("intensity"), (int, float)) or environment.get("intensity", -1) < 0:
            errors.append("environment.intensity must be >= 0")
        if environment.get("kind", "").startswith("pmrem") and environment.get("prefilter") != "PMREMGenerator":
            warnings.append("PMREM environment should record prefilter=PMREMGenerator")

    camera = profile.get("camera")
    if not isinstance(camera, dict):
        errors.append("camera must be an object")
    else:
        if camera.get("projection") not in {"perspective", "orthographic"}:
            errors.append("camera.projection must be perspective or orthographic")
        for key in ("position", "target"):
            if not _is_vec(camera.get(key), 3):
                errors.append(f"camera.{key} must be a numeric vec3")
        if not isinstance(camera.get("near"), (int, float)) or camera.get("near", 0) <= 0:
            errors.append("camera.near must be > 0")
        if not isinstance(camera.get("far"), (int, float)) or camera.get("far", 0) <= camera.get("near", 0):
            errors.append("camera.far must be greater than camera.near")

    background = profile.get("background")
    if not isinstance(background, dict) or background.get("kind") not in {"solid", "transparent", "scene"}:
        errors.append("background.kind must be solid, transparent, or scene")

    passes = profile.get("passes")
    pass_ids = [item.get("id") for item in passes] if isinstance(passes, list) and all(isinstance(item, dict) for item in passes) else []
    if set(pass_ids) != set(PASS_IDS) or len(pass_ids) != len(PASS_IDS):
        errors.append(f"passes must contain exactly: {', '.join(PASS_IDS)}")
    else:
        for item in passes:
            if item.get("required") is not True:
                errors.append(f"pass {item.get('id')} must be required")
            if item.get("id") == "beauty" and item.get("colorSpace") != "SRGBColorSpace":
                errors.append("beauty pass must use SRGBColorSpace")
            if item.get("id") != "beauty" and item.get("colorSpace") != "NoColorSpace":
                errors.append(f"diagnostic pass {item.get('id')} must use NoColorSpace")

    regions = profile.get("regions")
    region_ids = [item.get("id") for item in regions] if isinstance(regions, list) and all(isinstance(item, dict) for item in regions) else []
    if not region_ids:
        errors.append("regions must contain at least one subject-specific semantic region")
    if any(not isinstance(region_id, str) or not region_id.strip() for region_id in region_ids):
        errors.append("every region.id must be a non-empty string")
    if len(set(region_ids)) != len(region_ids):
        errors.append("region IDs must be unique")

    extensions = profile.get("extensions")
    required_regions = extensions.get("requiredSemanticRegions") if isinstance(extensions, dict) else None
    if (
        not isinstance(required_regions, list)
        or not required_regions
        or any(not isinstance(region_id, str) or not region_id.strip() for region_id in required_regions)
    ):
        errors.append("extensions.requiredSemanticRegions must be a non-empty array of non-empty strings")
        required_regions = []
    elif len(set(required_regions)) != len(required_regions):
        errors.append("extensions.requiredSemanticRegions must contain unique IDs")
    missing_regions = [region for region in required_regions if region not in region_ids]
    if missing_regions:
        errors.append(f"regions missing declared required IDs: {', '.join(missing_regions)}")

    feedback = profile.get("feedbackGroups")
    feedback_ids = [item.get("id") for item in feedback] if isinstance(feedback, list) and all(isinstance(item, dict) for item in feedback) else []
    if feedback_ids != list(FEEDBACK_GROUPS):
        errors.append("feedbackGroups must be ordered camera, silhouette, face, clothing, accessory, materials, lighting")
    else:
        for index, item in enumerate(feedback, start=1):
            if item.get("order") != index:
                errors.append(f"feedback group {item.get('id')} must have order {index}")

    return {"passed": not errors, "errors": errors, "warnings": warnings, "passIds": pass_ids, "regionIds": region_ids, "feedbackGroups": feedback_ids}


def validate_file(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return {"passed": False, "errors": [f"cannot read JSON: {exc}"], "warnings": []}
    if not isinstance(value, dict):
        return {"passed": False, "errors": ["profile root must be an object"], "warnings": []}
    result = validate_profile(value)
    result["path"] = str(path.resolve())
    return result


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("profile", type=Path)
    args = parser.parse_args(argv)
    result = validate_file(args.profile.expanduser().resolve())
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["passed"] else 1


if __name__ == "__main__":
    raise SystemExit(main(__import__("sys").argv[1:]))

```

### Core Architecture Module: `forge/state.py`
```
#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "_shared"))

from domains import DomainRegistryError, registered_domains  # noqa: E402
from workflow_state import (  # noqa: E402
    WorkflowStateError,
    load_state,
    mark_steps,
    new_state,
    save_state,
    status_payload,
)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Minimal local checklist state for img2threejs")
    commands = parser.add_subparsers(dest="command", required=True)

    init = commands.add_parser("init")
    init.add_argument("--state", type=Path, default=Path(".img2threejs/state.json"))
    init.add_argument("--reference", required=True)
    # Choices come from the registry, so installing a domain makes its profile available here without
    # editing the base CLI. new_state() re-checks and names the available set on a bad value.
    # Guarded: registered_domains() at argparse-construction time is exactly the shape targets.py
    # documents avoiding -- a broken registry (e.g. a duplicate domain id during a half-applied
    # extraction) must degrade THIS parser to generic-only choices, not kill `status`/`mark` for
    # every profile on the machine. new_state() then reports the real registry error.
    try:
        profile_choices = ("generic", *sorted(registered_domains()))
    except DomainRegistryError:
        profile_choices = ("generic",)
    init.add_argument("--profile", choices=profile_choices, default="generic")
    init.add_argument("--spec", default="")
    init.add_argument("--max-per-pass", type=int, default=3)
    init.add_argument("--max-total", type=int, default=6)

    status = commands.add_parser("status")
    status.add_argument("--state", type=Path, default=Path(".img2threejs/state.json"))
    status.add_argument("--json", action="store_true")

    mark = commands.add_parser("mark")
    mark.add_argument("step", nargs="+")
    mark.add_argument("--state", type=Path, default=Path(".img2threejs/state.json"))
    mark.add_argument("--status", choices=("done", "skipped", "pending"), default="done")
    mark.add_argument("--evidence", action="append", default=[])
    mark.add_argument("--reason", default="")

    return parser


def print_status(state: dict, *, as_json: bool = False) -> None:
    payload = status_payload(state)
    if as_json:
        print(json.dumps(payload, ensure_ascii=False))
        return
    loop = payload["loop"]
    print(
        f"STATE status={payload['status']} step={payload['currentStep']} "
        f"pass={payload['currentPass'] or 'none'} "
        f"loop={loop['passCount']}/{loop['maxPerPass']} total={loop['totalCount']}/{loop['maxTotal']}"
    )
    if payload["stopReason"]:
        print(f"STOP: {payload['stopReason']}")
    elif payload["nextCommand"]:
        print(f"next command: {payload['nextCommand']}")
    print("pending mandatory steps:")
    for step_id in payload["pending"]:
        print(f"- {step_id}")


def main(argv: list[str]) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "init":
            if args.state.expanduser().exists():
                raise WorkflowStateError(f"refusing to overwrite existing state: {args.state}")
            state = new_state(
                args.reference,
                profile=args.profile,
                spec=args.spec,
                max_per_pass=args.max_per_pass,
                max_total=args.max_total,
            )
            save_state(args.state, state)
            print_status(state)
            return 0
        state = load_state(args.state)
        if args.command == "status":
            print_status(state, as_json=args.json)
        elif args.command == "mark":
            mark_steps(state, args.step, status=args.status, evidence=args.evidence, reason=args.reason)
            save_state(args.state, state)
            print_status(state)
        return 3 if state.get("status") == "stopped" else 0
    except (OSError, WorkflowStateError) as error:
        print(f"state error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

```

### Core Architecture Module: `bin/img2threejs.mjs`
```
#!/usr/bin/env node
// img2threejs CLI — installs the img2threejs skill into supported agent hosts.
//
// Subcommands:
//   install [--host hermes|claude|codex|opencode|all] [--ref <tag-or-sha>] [--dry-run]
//     Fetches the skill at the given ref (default: latest published skill CLI version) and links
//     it into the requested host's skills directory via `npx img2 add img2threejs/img2threejs`.
//   update   — same as install, but rejects downgrades
//   doctor   — reports which hosts are detected and whether they already link to img2threejs
//   version  — prints this CLI version + the skill version that will be installed
//
// Safety:
//   - No shell. All subprocess calls go through `execFileSync` with argv arrays.
//   - Every ref must be a vX.Y.Z tag or 40-char SHA — branches are rejected.
//   - Resolution is delegated to `img2 add` — single source of truth for plugin/skill install.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const SKILL_REPO = 'img2threejs/img2threejs'
// Default to the skill's current stable tag. Bumped in lockstep with the skill's semver —
// the rule that no other CLI knows which skill version matches which CLI version.
const DEFAULT_REF = 'v2.0.0'

const HOSTS = {
  hermes: {
    label: 'Hermes Agent',
    detect: () => fs.existsSync(path.join(os.homedir(), '.hermes')),
    skills: () => path.join(os.homedir(), '.hermes', 'skills'),
  },
  claude: {
    label: 'Claude Code',
    detect: () => fs.existsSync(path.join(os.homedir(), '.claude')),
    skills: () => path.join(os.homedir(), '.claude', 'skills'),
  },
  codex: {
    label: 'OpenAI Codex',
    detect: () => fs.existsSync(path.join(os.homedir(), '.codex')),
    skills: () => path.join(os.homedir(), '.codex', 'skills'),
  },
  opencode: {
    label: 'OpenCode',
    detect: () => fs.existsSync(
      path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'opencode'),
    ),
    skills: () => path.join(
      process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
      'opencode',
      'skills',
    ),
  },
}

const EXIT = { OK: 0, FAIL: 1, REFUSED: 2, NEEDS_INPUT: 3 }

// Ref validation: must be a tag like `v1.2.3`, `v2.0.0-beta.1` or a full 40-char SHA.
// Anything mutable (branch name, HEAD, short SHA) is rejected — a moved branch is a different
// skill on a different day, and a short SHA can become two things after a push.
const REF_RE = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$|^[0-9a-f]{40}$/

function die(code, msg, detail) {
  const e = new Error(msg)
  e.code = code
  if (detail) e.detail = detail
  throw e
}

function readArgs(argv) {
  const out = { cmd: argv[2], host: 'all', ref: DEFAULT_REF, dryRun: false }
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--host') out.host = argv[++i]
    else if (a === '--ref') out.ref = argv[++i]
    else if (a === '--dry-run') out.dryRun = true
    else die(EXIT.NEEDS_INPUT, `unknown argument: ${a}`)
  }
  return out
}

function printHelp() {
  process.stdout.write(`img2threejs — install the img2threejs skill into agent hosts

Usage:
  img2threejs install [--host <host>] [--ref <tag|sha>] [--dry-run]
  img2threejs update   [--host <host>] [--ref <tag|sha>] [--dry-run]
  img2threejs doctor
  img2threejs version

Hosts:
  hermes, claude, codex, opencode, all (default: auto-detect all installed)

Ref:
  Semantic tag (vX.Y.Z) or 40-char commit SHA. Branches and short SHAs are refused.

Examples:
  img2threejs install
  img2threejs install --host hermes --ref v2.0.0
  img2threejs install --ref 6e60b5e22419464b4853e01ddb6c0e6f6659a733
  img2threejs install --dry-run
`)
}

function detectHosts(hostArg) {
  if (hostArg === 'all') {
    return Object.entries(HOSTS).filter(([, h]) => h.detect()).map(([name]) => name)
  }
  if (!HOSTS[hostArg]) die(EXIT.NEEDS_INPUT, `unknown host: ${hostArg}`, Object.keys(HOSTS).join(', '))
  const host = HOSTS[hostArg]
  if (!host.detect()) die(EXIT.REFUSED, `host ${hostArg} not detected on this machine (${host.label} not installed)`)
  return [hostArg]
}

function validateRef(ref) {
  if (!REF_RE.test(ref)) {
    die(EXIT.REFUSED, `ref must be a vX.Y.Z tag or 40-char SHA — got: ${ref}`,
        'branches and short SHAs are refused because a moving ref would be a different skill')
  }
}

function runImg2Add(ref, dryRun) {
  // Delegate everything to the existing plugin harness. Single source of truth for
  // plugin/skill installation — no parallel fetch/link path to drift out of sync.
  const args = [
    'img2', 'add',
    SKILL_REPO,
    '--ref', ref,
    ...(dryRun ? ['--dry-run'] : []),
  ]
  try {
    const out = execFileSync('npx', ['--yes', ...args], {
      stdio: ['inherit', 'pipe', 'pipe'],
      encoding: 'utf8',
      env: { ...process.env, NPM_CONFIG_FUND: 'false', NPM_CONFIG_AUDIT: 'false' },
      timeout: 120_000,
    })
    return { ok: true, out }
  } catch (err) {
    return { ok: false, err, stderr: err.stderr?.toString() ?? '', stdout: err.stdout?.toString() ?? '' }
  }
}

function linkPointsAtImg2threejs(linkPath) {
  try {
    const target = fs.realpathSync(linkPath)
    return target.endsWith(`/img2threejs`)
  } catch {
    return false
  }
}

async function cmdInstall(args) {
  validateRef(args.ref)
  const hosts = detectHosts(args.host)
  if (hosts.length === 0) die(EXIT.REFUSED, 'no supported agent host detected on this machine')

  process.stdout.write(`→ will install skill ${SKILL_REPO} @ ${args.ref} into: ${hosts.join(', ')}\n`)
  if (args.dryRun) process.stdout.write('  (dry-run: npx img2 will be invoked with --dry-run)\n')

  const result = runImg2Add(args.ref, args.dryRun)
  if (!result.ok) {
    process.stderr.write(`img2 add failed:\n${result.stderr || result.err?.message}\n`)
    process.exit(EXIT.FAIL)
  }
  process.stdout.write(result.out)

  // Idempotency check: confirm a skills/img2threejs entry exists for each requested host.
  let linked = 0
  for (const h of hosts) {
    const dir = HOSTS[h].skills()
    const link = path.join(dir, 'img2threejs')
    if (fs.existsSync(link) && linkPointsAtImg2threejs(link)) {
      process.stdout.write(`✓ ${h}: ${link}\n`)
      linked++
    } else if (!args.dryRun) {
      process.stdout.write(`! ${h}: expected link at ${link} not present — open an issue at https://github.com/${SKILL_REPO}/issues\n`)
    }
  }
  if (!args.dryRun && linked === 0) {
    die(EXIT.FAIL, 'install reported success but no host link was found')
  }
}

async function cmdDoctor() {
  process.stdout.write('img2threejs — host detection report\n\n')
  for (const [name, h] of Object.entries(HOSTS)) {
    const detected = h.detect()
    const dir = h.skills()
    let linkState = '(no link)'
    if (detected) {
      const link = path.join(dir, 'img2threejs')
      if (fs.existsSync(link)) {
        linkState = linkPointsAtImg2threejs(link)
          ? `installed → ${fs.realpathSync(link)}`
          : `link exists but does not point at ${SKILL_REPO} — run \`img2threejs install\``
      }
    }
    const detectedLabel = detected ? '✓ detected' : '✗ not detected'
    process.stdout.write(`  ${name.padEnd(10)}  ${detectedLabel.padEnd(15)}  ${dir}  ${linkState}\n`)
  }
  let img2 = '(not probed)'
  try {
    const v = execFileSync('npx', ['--yes', 'img2', '--version'], { encoding: 'utf8', timeout: 30_000 }).trim()
    img2 = `✓ npx img2 — ${v.split('\n')[0]}`
  } catch {
    img2 = '✗ npx img2 not reachable (will be installed on first \`install\` run)'
  }
  process.stdout.write(`\n  ${img2}\n`)
}

async function cmdVersion() {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  process.stdout.write(`img2threejs CLI: ${pkg.version}\n`)
  process.stdout.write(`default skill ref: ${DEFAULT_REF}\n`)
}

const commands = {
  install: cmdInstall,
  update: (args) => { process.stdout.write('(update = install with downgrade rejection; same args)\n'); return cmdInstall(args) },
  doctor: cmdDoctor,
  version: cmdVersion,
  '--version': cmdVersion,
}

async function main() {
  // Top-level flags: handle before command dispatch so `img2threejs --help` works
  // without first naming a subcommand.
  for (const a of process.argv.slice(2)) {
    if (a === '-h' || a === '--help' || a === 'help') { printHelp(); process.exit(EXIT.OK) }
    if (a === '--version') {
      const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
      process.stdout.write(`img2threejs CLI: ${pkg.version}\ndefault skill ref: ${DEFAULT_REF}\n`)
      process.exit(EXIT.OK)
    }
  }
  if (!commands[process.argv[2]]) {
    if (process.argv[2]) process.stderr.write(`unknown command: ${process.argv[2]}\n\n`)
    printHelp()
    process.exit(process.argv[2] ? EXIT.NEEDS_INPUT : EXIT.OK)
  }
  try {
    const args = readArgs(process.argv)
    await commands[args.cmd](args)
  } catch (err) {
    if (err.code != null) {
      process.stderr.write(`error (${err.code}): ${err.message}\n`)
      if (err.detail) process.stderr.write(`detail: ${err.detail}\n`)
      process.exit(err.code)
    }
    throw err
  }
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err.stack || err.message}\n`)
  process.exit(EXIT.FAIL)
})

```

### Core Architecture Module: `forge/_shared/artifact_cache.py`
```
"""Lightweight hash-based artifact cache (Plan 1.3 Workstream E).

Cache key = crop file content hash + the extracting script's OWN source-file
hash, both computed automatically at every run — no manually-maintained
version string exists to forget bumping (closes Risk R3: a cache keyed on a
human-maintained version constant will eventually serve stale results after
someone edits the algorithm without remembering to bump it).

This is NOT full module/spec-hash reuse (no dependency graph, no partial-
object hashing) — just "don't redo expensive-ish work on unchanged inputs."
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def cache_key(crop_path: Path, script_path: Path) -> str:
    return f"{file_sha256(crop_path)}:{file_sha256(script_path)[:12]}"


def manifest_path_for(directory: Path, name: str) -> Path:
    return directory / ".cache" / name


def load_manifest(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def save_manifest(path: Path, manifest: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def get_cached(manifest_path: Path, key: str) -> dict[str, Any] | None:
    return load_manifest(manifest_path).get(key)


def put_cached(manifest_path: Path, key: str, value: dict[str, Any]) -> None:
    manifest = load_manifest(manifest_path)
    manifest[key] = value
    save_manifest(manifest_path, manifest)

```

### Core Architecture Module: `forge/_shared/chirality.py`
```
#!/usr/bin/env python3
"""Left and right, in one place, with the two ways of getting it wrong.

WHY THIS MODULE EXISTS. Two chirality defects shipped in the same figure and neither was caught by
any gate, because both produce geometry that is internally tidy and only wrong with respect to a
convention nothing had written down as code.

    THE HAND     `place()` built the mirrored limb as `[side*along, height, side*across]`, negating
                 x AND z. Two negations is not a reflection -- it is a 180-degree ROTATION about Y,
                 and a rotation PRESERVES handedness. The left hand was the right hand turned
                 around. Measured on the thumb tip: z +0.288 on one side and -0.288 on the other,
                 where a mirror leaves z alone.

    THE FOOT     The pair WAS a correct reflection, so any pair test passes. But the toes were
                 ordered little-to-big across a knuckle strip whose index 0 lands on the medial
                 edge, so the big toe went lateral -- on both feet. Measured in the render's toe
                 band: mass 350 medial / 443 lateral, against a reference of 529 / 488. A foot with
                 its big toe outside IS the other foot, so the pair read as swapped.

They need DIFFERENT tests, and that is the point of this module:

    check_pair()            catches the hand. Compares a left component against its right partner.
    medial_lateral_bias()   catches the foot. Compares one limb's own asymmetry against a reference,
                            because a pair that is wrong the SAME way on both sides is still a
                            perfectly good mirror of itself.

THE CONVENTION, stated once so nothing can quietly diverge from it. `new_sculpt_spec.py` carries it
as a comment -- "'left' is the CHARACTER's left, which the component tree spells `-l`. On a
front-facing reference that is the viewer's right." -- and a comment cannot be imported. With
`forward: +Z`, Y up and a right-handed frame, the camera in front looks along -Z and its right is
+X, so the character's own left is +X.

Pure Python 3.10+ standard library.
"""
from __future__ import annotations

import math
import re
from typing import Any, Iterable, Sequence

Point = Sequence[float]

# Index of the left-right axis in an (x, y, z) triple. The ONLY axis a sagittal mirror negates.
LATERAL_AXIS = 0
# Sign of the character's own left, given coordinateFrame up=+Y forward=+Z and a right-handed
# system. Derived, not chosen: the camera that sees the front looks along -Z, its right is +X, and
# a figure facing the camera has its own left on the viewer's right.
CHARACTER_LEFT_SIGN = 1

# Suffixes that mark a component as one half of a lateral pair.
LEFT_SUFFIX = "-l"
RIGHT_SUFFIX = "-r"
_PAIR_RE = re.compile(r"^(?P<stem>.+)-(?P<side>[lr])$")

# How far apart two mirrored coordinates may sit before the pair is called broken, in world units.
# Not a tuning knob: mirrored values are produced by negating the same authored number, so they
# agree to floating-point noise or they disagree structurally. Anything between those is itself a
# defect worth seeing.
MIRROR_TOLERANCE = 1e-6


def mirror_point(point: Point) -> tuple[float, float, float]:
    """The sagittal mirror of a position: negate the lateral axis, leave the rest alone."""
    values = [float(v) for v in point]
    if len(values) != 3:
        raise ValueError(f"a point needs three components, got {len(values)}")
    values[LATERAL_AXIS] = -values[LATERAL_AXIS]
    return (values[0], values[1], values[2])


def mirror_vector(vector: Point) -> tuple[float, float, float]:
    """The sagittal mirror of a DIRECTION. Same rule as a point.

    Kept as its own name because the reflex is to think a direction transforms differently, and
    reaching for a rotation here is exactly the recorded bug.
    """
    return mirror_point(vector)


def side_of(component_id: str) -> str | None:
    """'l', 'r', or None for a component that is not one half of a pair."""
    match = _PAIR_RE.match(str(component_id))
    return match.group("side") if match else None


def pair_stem(component_id: str) -> str | None:
    match = _PAIR_RE.match(str(component_id))
    return match.group("stem") if match else None


def find_pairs(component_ids: Iterable[str]) -> list[tuple[str, str]]:
    """Every `(right_id, left_id)` both halves of which are present. Right first, because the
    convention is stated as 'the left is the mirror of the right'."""
    by_stem: dict[str, dict[str, str]] = {}
    for component_id in component_ids:
        stem = pair_stem(component_id)
        side = side_of(component_id)
        if stem and side:
            by_stem.setdefault(stem, {})[side] = str(component_id)
    return [
        (sides["r"], sides["l"])
        for _stem, sides in sorted(by_stem.items())
        if "l" in sides and "r" in sides
    ]


def classify_relation(right: Point, left: Point) -> str:
    """How the two halves of a pair are actually related. One of:

        'reflection'   the left is the sagittal mirror of the right. Correct.
        'rotation'     the left is the right ROTATED about the vertical axis, not mirrored. This is
                       the recorded hand defect and the reason this function names it rather than
                       just saying 'mismatch': the two are trivially confused, they agree exactly on
                       a symmetric part, and they differ only in handedness.
        'translation'  the left is the right moved, not transformed at all.
        'unrelated'    none of the above.
    """
    r = [float(v) for v in right]
    l = [float(v) for v in left]
    if len(r) != 3 or len(l) != 3:
        raise ValueError("both points need three components")

    def close(a: Sequence[float], b: Sequence[float]) -> bool:
        return all(abs(x - y) <= MIRROR_TOLERANCE for x, y in zip(a, b))

    if close(mirror_point(r), l):
        return "reflection"
    # 180 degrees about Y negates x and z, leaves y. Indistinguishable from a reflection whenever
    # the part sits on the midline in z, which is why a symmetric torso never exposed this.
    if close((-r[0], r[1], -r[2]), l):
        return "rotation"
    if close((r[0], r[1], r[2]), l):
        return "translation"
    return "unrelated"


def check_pair(
    stem: str,
    right: Point,
    left: Point,
) -> tuple[bool, str]:
    """`(ok, message)` for one lateral pair. `ok` is True only for a true reflection."""
    relation = classify_relation(right, left)
    if relation == "reflection":
        return (True, "")
    expected = mirror_point(right)
    if relation == "rotation":
        return (False, (
            f"{stem}: the left half is the right half ROTATED about the vertical axis, not "
            f"mirrored. A rotation preserves handedness, so both halves are the same hand. "
            f"right {tuple(round(float(v), 6) for v in right)} should mirror to "
            f"{tuple(round(v, 6) for v in expected)}, but the left is "
            f"{tuple(round(float(v), 6) for v in left)}. Negate the lateral axis only."
        ))
    if relation == "translation":
        return (False, (
            f"{stem}: both halves sit on the same side -- the left is the right translated, not "
            f"mirrored at all. Expected {tuple(round(v, 6) for v in expected)}."
        ))
    return (False, (
        f"{stem}: the halves are not a sagittal mirror. right "
        f"{tuple(round(float(v), 6) for v in right)} mirrors to "
        f"{tuple(round(v, 6) for v in expected)}, but the left is "
        f"{tuple(round(float(v), 6) for v in left)}."
    ))


def medial_lateral_bias(
    samples: Sequence[tuple[float, float]],
    midline: float = 0.0,
) -> dict[str, Any]:
    """Which half of a limb carries more of it: the half toward the body, or the half away.

    `samples` is `(lateral_coordinate, weight)`. The limb's own midline is taken from its extent,
    and `midline` is the BODY's centreline, which decides which of its halves is medial.

    THIS IS THE TEST A PAIR CHECK CANNOT REPLACE. Two limbs can be perfect mirrors of each other and
    both be the wrong hand. The foot defect was exactly that: `check_pair` passes, and only
    comparing one foot's own internal asymmetry against a reference shows the big toe on the wrong
    edge.
    """
    if not samples:
        return {"medial": 0.0, "lateral": 0.0, "bias": 0.0, "heavier": "none", "sampleCount": 0}
    coords = [float(c) for c, _ in samples]
    low, high = min(coords), max(coords)
    limb_centre = (low + high) / 2.0
    # Medial means nearer the body centreline. Which direction that is depends on which side of the
    # body this limb is on, so it is derived from the limb's own position rather than assumed.
    toward_body = -1.0 if limb_centre > midline else 1.0

    medial = lateral = 0.0
    for coordinate, weight in samples:
        offset = (float(coordinate) - limb_centre) * toward_body
        if offset > 0:
            medial += float(weight)
        elif offset < 0:
            lateral += float(weight)
    total = medial + lateral
    bias = (medial - lateral) / total if total else 0.0
    return {
        "medial": round(medial, 6),
        "lateral": round(lateral, 6),
        "bias": round(bias, 6),
        "heavier": "medial" if bias > 0 else ("lateral" if bias < 0 else "even"),
        "sampleCount": len(samples),
        "limbCentre": round(limb_centre, 6),
    }


# Below this the reference is treated as too symmetric to judge handedness from.
#
# CALIBRATED, and the first guess was not. 0.05 was picked by eye and it would have made the gate
# blind to the exact defect it was written for: the reference feet measure +0.0403 and +0.0579, so a
# 0.05 floor calls one of them unjudgeable. Measured endpoints, toe band, front view:
#
#   reference, left foot    +0.0403   medial-heavy, as a real foot is
#   reference, right foot   +0.0579   same sign, which is what makes the weak signa
```

### Core Architecture Module: `forge/_shared/color_metrics.py`
```
#!/usr/bin/env python3
"""Perceptual colour math for the harness — pure stdlib (sRGB→CIELAB + CIEDE2000).

Canonical sRGB→CIELAB and the full CIEDE2000 (ΔE00) difference, used by the Divine Eye
hue-zone signal and any per-region colour check. CIEDE2000 corrects CIELAB's non-uniformity
(the ~275° blue region especially — exactly where the M9 violet→blue failure lives) via the
R_T hue-rotation term, so it is the right metric for "is this the same hue zone?".

Verified against Sharma et al.'s published CIEDE2000 test pairs (see test_color_metrics.py).
"""
from __future__ import annotations

import math

# D65 reference white (2° observer)
_XN, _YN, _ZN = 95.047, 100.0, 108.883


def _lin(c: float) -> float:
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def srgb_to_lab(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    r, g, b = _lin(rgb[0]), _lin(rgb[1]), _lin(rgb[2])
    # linear sRGB → XYZ (D65)
    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) * 100.0
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722) * 100.0
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) * 100.0

    def f(t: float) -> float:
        return t ** (1.0 / 3.0) if t > 0.008856 else (7.787 * t + 16.0 / 116.0)

    fx, fy, fz = f(x / _XN), f(y / _YN), f(z / _ZN)
    return (116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz))


def ciede2000(lab1: tuple[float, float, float], lab2: tuple[float, float, float]) -> float:
    """Full CIEDE2000 colour difference (kL=kC=kH=1). Returns ΔE00."""
    l1, a1, b1 = lab1
    l2, a2, b2 = lab2
    c1 = math.hypot(a1, b1)
    c2 = math.hypot(a2, b2)
    c_bar = (c1 + c2) / 2.0
    g = 0.5 * (1.0 - math.sqrt(c_bar ** 7 / (c_bar ** 7 + 25.0 ** 7))) if c_bar > 0 else 0.0
    a1p = (1.0 + g) * a1
    a2p = (1.0 + g) * a2
    c1p = math.hypot(a1p, b1)
    c2p = math.hypot(a2p, b2)

    def hp(ap: float, bp: float) -> float:
        if ap == 0.0 and bp == 0.0:
            return 0.0
        deg = math.degrees(math.atan2(bp, ap))
        return deg + 360.0 if deg < 0 else deg

    h1p = hp(a1p, b1)
    h2p = hp(a2p, b2)

    dLp = l2 - l1
    dCp = c2p - c1p
    if c1p * c2p == 0.0:
        dhp = 0.0
    elif abs(h2p - h1p) <= 180.0:
        dhp = h2p - h1p
    elif h2p - h1p > 180.0:
        dhp = h2p - h1p - 360.0
    else:
        dhp = h2p - h1p + 360.0
    dHp = 2.0 * math.sqrt(c1p * c2p) * math.sin(math.radians(dhp) / 2.0)

    Lp_bar = (l1 + l2) / 2.0
    Cp_bar = (c1p + c2p) / 2.0
    if c1p * c2p == 0.0:
        hp_bar = h1p + h2p
    elif abs(h1p - h2p) <= 180.0:
        hp_bar = (h1p + h2p) / 2.0
    elif h1p + h2p < 360.0:
        hp_bar = (h1p + h2p + 360.0) / 2.0
    else:
        hp_bar = (h1p + h2p - 360.0) / 2.0

    t = (
        1.0
        - 0.17 * math.cos(math.radians(hp_bar - 30.0))
        + 0.24 * math.cos(math.radians(2.0 * hp_bar))
        + 0.32 * math.cos(math.radians(3.0 * hp_bar + 6.0))
        - 0.20 * math.cos(math.radians(4.0 * hp_bar - 63.0))
    )
    d_theta = 30.0 * math.exp(-(((hp_bar - 275.0) / 25.0) ** 2))
    rc = 2.0 * math.sqrt(Cp_bar ** 7 / (Cp_bar ** 7 + 25.0 ** 7)) if Cp_bar > 0 else 0.0
    sl = 1.0 + (0.015 * (Lp_bar - 50.0) ** 2) / math.sqrt(20.0 + (Lp_bar - 50.0) ** 2)
    sc = 1.0 + 0.045 * Cp_bar
    sh = 1.0 + 0.015 * Cp_bar * t
    rt = -math.sin(math.radians(2.0 * d_theta)) * rc

    return math.sqrt(
        (dLp / sl) ** 2
        + (dCp / sc) ** 2
        + (dHp / sh) ** 2
        + rt * (dCp / sc) * (dHp / sh)
    )


def delta_e_rgb(rgb1: tuple[int, int, int], rgb2: tuple[int, int, int]) -> float:
    """Convenience: CIEDE2000 between two sRGB colours."""
    return ciede2000(srgb_to_lab(rgb1), srgb_to_lab(rgb2))

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #147** (2026-09-27): **docs(readme): dedupe pipeline blurb, fix broken rig/hair scripts table**
  *Symptoms*: The "How it works" section repeated the same paragraph and ARCHITECTURE.md link back to back. The Scripts table also split into two blocks because of a stray blank line before the rig/hair rows, so GitHub rendered those rows as raw pipe-delimited text instead of a table.  <!-- Thanks for contributing to img2threejs. Keep the pull request focused and remove instructional comments that do not apply before submitting. -->  ## Summary  <!-- What behavior or documentation changes? Why is it needed? Link related issues with "Refs #123" where applicable. Do not use closing keywords: maintainers close issues manually after final verification. -->  ## Changes  <!-- List the key changes. -->  -  ## Validation  <!-- Record the checks you ran and their results. Include render/comparison-sheet evidence for changes that affect reconstruction quality. -->  - [ ] `python3 forge/tests/test_pipeline.py` - [ ] Relevant targeted validation or test: - [ ] Render or comparison-sheet review, if applicable:  ## Contributor checklist  - [ ] This PR keeps the code-only procedural reconstruction contract; it does not silently download meshes or art packs. - [ ] Existing object specs remain valid, or this PR documents the intentional compatibility change. - [ ] I added or updated tests for new gates, schema fields, or templates where applicable. - [ ] I updated documentation and roadmap status where applicable. 

- **Issue #146** (2026-10-05): **feat: img2threejs CLI package (npx img2threejs install)**
  *Symptoms*: Adds the `img2threejs` npm package — the install command for the img2threejs skill.  ```bash npx img2threejs install        # install into all detected agent hosts npx img2threejs doctor         # show detected hosts + current state npx img2threejs --version ```  This PR carries part 1 (source, tests, .gitignore). The companion PR workflow files (`.github/workflows/cli-validate.yml` + `cli-publish.yml`) follow once an account with `workflow` scope is available to push them, because gh's PAT refuses workflow content otherwise.  ### What's in this PR  - `package.json`: name=img2threejs, bin=bin/img2threejs.mjs, engines>=18,   publishConfig=public. Top-level `version` field is the CLI's own semver,   independent of the skill's `SKILL.md` version. - `bin/img2threejs.mjs`: install/update/doctor/version subcommands. All   subprocess calls go through `execFileSync` with argv arrays — no shell.   Ref validation refuses `main` branches and short SHAs; only `vX.Y.Z`   tags and 40-char SHAs pass. Resolution is delegated to   `npx img2 add img2threejs/img2threejs --ref ...` so skill install has   a single source of truth with the plugin install path. - `bin/img2threejs.mjs-test.mjs`: 14 self-test assertions; no network, no   fs writes outside TMPDIR. `npm test` exits non-zero on any failure. - `.gitignore`: adds `node_modules/`, `package-lock.json`,   `npm-debug.log*`, `.npmrc`.  ### What's in the follow-up PR (needs workflow scope)  - `.github/workflows/cli-validate.yml`: PR-time valida

- **Issue #132** (2026-09-06): **docs(skill): document the img2 harness in SKILL.md**
  *Symptoms*: SKILL.md's Domain plugins section described plugin behavior but never said where plugins come from or how to manage them — the img2 harness (img2threejs/img2) made it into README's quick-start but SKILL.md was missed.  Adds a compact "The img2 harness" subsection scoped to agent decision points:  - the rule: when `state.py init` names a profile unavailable, name the `img2 add` command and stop — never vendor domain logic - `img2 add --ref <tag>`, `img2 doctor` (the authority on what each host resolves), `img2 capabilities` - setup and the full CLI reference deferred to README quick-start and the harness repo's docs  Reviewed: 4-angle cleanup pass trimmed setup/diagnostic commands and duplicated version constraints; correctness review caught and fixed a mischaracterization (the harness is a Node CLI with zero npm/pip dependencies — "stdlib-only" belongs to the forge).  Docs-only; no version bump.

- **Issue #130** (2026-09-05): **Lab/cs2 plugin**
  *Symptoms*: <!-- Thanks for contributing to img2threejs. Keep the pull request focused and remove instructional comments that do not apply before submitting. -->  ## Summary  <!-- What behavior or documentation changes? Why is it needed? Link related issues with "Refs #123" where applicable. Do not use closing keywords: maintainers close issues manually after final verification. -->  ## Changes  <!-- List the key changes. -->  -  ## Validation  <!-- Record the checks you ran and their results. Include render/comparison-sheet evidence for changes that affect reconstruction quality. -->  - [ ] `python3 forge/tests/test_pipeline.py` - [ ] Relevant targeted validation or test: - [ ] Render or comparison-sheet review, if applicable:  ## Contributor checklist  - [ ] This PR keeps the code-only procedural reconstruction contract; it does not silently download meshes or art packs. - [ ] Existing object specs remain valid, or this PR documents the intentional compatibility change. - [ ] I added or updated tests for new gates, schema fields, or templates where applicable. - [ ] I updated documentation and roadmap status where applicable. 

- **Issue #117** (2026-09-03): **1.5.2: animation pipeline**
  *Symptoms*: <!-- Thanks for contributing to img2threejs. Keep the pull request focused and remove instructional comments that do not apply before submitting. -->  ## Summary  <!-- What behavior or documentation changes? Why is it needed? Link related issues with "Refs #123" where applicable. Do not use closing keywords: maintainers close issues manually after final verification. -->  ## Changes  <!-- List the key changes. -->  -  ## Validation  <!-- Record the checks you ran and their results. Include render/comparison-sheet evidence for changes that affect reconstruction quality. -->  - [ ] `python3 forge/tests/test_pipeline.py` - [ ] Relevant targeted validation or test: - [ ] Render or comparison-sheet review, if applicable:  ## Contributor checklist  - [ ] This PR keeps the code-only procedural reconstruction contract; it does not silently download meshes or art packs. - [ ] Existing object specs remain valid, or this PR documents the intentional compatibility change. - [ ] I added or updated tests for new gates, schema fields, or templates where applicable. - [ ] I updated documentation and roadmap status where applicable. 

- **Issue #115** (2026-08-30): **feat: add Han Huan-Shou Dao reconstruction**
  *Symptoms*: ## Summary  - add the shared dao-family adapter and the complete code-only Han Huan-Shou Dao reconstruction - preserve the authoritative `fill_spec.py -> object-sculpt-spec.json -> TypeScript factory` generation chain - include the eight-pass review evidence, structural/action contracts, and weapon reconstruction playbook - finish the public-showcase polish with a smooth rounded-square ring fitting, refined hamon, corrected material response, and responsive capture audit  Companion showcase PR: https://github.com/img2threejs/img2threejs-showcase/pull/59  ## Release gates  - strict-quality validation: PASS - standardized 1680x360 silhouette IoU: 0.8864 - aspect-ratio delta / scale delta: 0.0 / 0.0 - max per-component color delta-E: 10.82 (limit 20) - standard capture: 16 artifacts, assembly and interaction audits passing - desktop and 390x844 showcase framing: full model fits and composited canvas is nonblank  ## Verification  - `python3 reconstructions/han-huan-shou-dao/fill_spec.py` - `python3 forge/stage2_spec/validate_sculpt_spec.py --strict-quality reconstructions/han-huan-shou-dao/object-sculpt-spec.json` - `python3 -m unittest forge.tests.test_dao_adapter` - generated factory and preview bundle rebuilt from authority sources 
  **Post-Mortem & Fix Analysis**:
  > Closing for now while I reconsider and reorganize the main-repository submission. The work remains available on my fork branch.

- **Issue #114** (2026-08-29): **chore: swap Buy Me a Coffee for Ko-fi**
  *Symptoms*: ## Why  Buy Me a Coffee is unusable for this project's maintainer. BMC holds supporter money and pays it out only through Stripe or a connected PayPal, and neither route is open from Vietnam — Stripe does not support Vietnamese accounts, and BMC does not offer plain PayPal linking. Anything sent through the BMC button was money that could be paid in but never withdrawn.  Ko-fi does not hold funds at all: a tip goes straight into the creator's PayPal account, and Ko-fi's own docs point creators in Stripe-less countries at PayPal as the supported path.  ## What changed  - Sponsor badge → Ko-fi (`shields.io`, Ko-fi brand colour) - Support button → the official Ko-fi GitHub button  No other links touched. The donate page (VietQR / MoMo / PayPal) is unaffected and still linked from the same place.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #113** (2026-08-27): **feat: gate model space and non-humanoid animation**
  *Symptoms*: ## Summary  Adds a fail-closed model-space gate so a correct forward label or marker cannot hide geometry that actually faces sideways, and documents a rigid articulated animation path for insects, quadrupeds, and mechanical creatures.  Refs #112  ## Changes  - Separate the skill authoring +Z convention from a consumer target coordinate frame. - Validate one conversion owner, identity semantic root, target-forward marker, and measured front/rear features with a standard-library gate. - Add rigid nested-pivot, gait-phase, in-place clip, binding, and phase-sampling guidance for non-humanoid subjects. - Route moving builds through the new gate without changing the existing humanoid skin payload.  ## Validation  - [x] Full Python suite: 1088 tests passed, 38 skipped. - [x] Focused model-space tests: 5 passed. - [x] Existing chirality and rig-payload tests: 37 passed. - [x] Render or comparison-sheet review: not applicable; this PR adds structural validation and documentation without changing generated geometry.  ## Contributor checklist  - [x] This PR keeps the code-only procedural reconstruction contract; it does not silently download meshes or art packs. - [x] Existing object specs remain valid. - [x] Tests were added for the new gate. - [x] Skill and gate documentation were updated.

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

### Incident Patch 1: `7ac69963` (2026-09-03)
**Commit Message**: docs(readme): quick-start covers the plugin harness; roadmap catches up

Quick start gains the 'add domain plugins' step (harness install, img2 add/doctor, fail-loud missing-profile behavior, remove); the roadmap records The Plugin Update as in-review and drops 'plugin ecosystem and API' from v2.0, where it no longer belongs.

**File**: `README.md` (modified, +24/-3)
```diff
@@ -124,15 +124,32 @@ A staged sculpting pipeline turns the reference image into a spec, then generate
    ~/.codex/skills/img2threejs  -> <your checkout>
    ```
 
-2. **Invoke** — in Claude Code, attach or point to an object image and run:
+2. **Add domain plugins (optional)** — domain knowledge (CS2 skins today) lives in installed
+   plugins, not in this checkout. Install the [img2 harness](https://github.com/img2threejs/img2)
+   once, then add plugins to it:
+
+   ```bash
+   npx github:img2threejs/img2 install   # ~/.img2, the plugin registry, and an `img2` launcher
+   img2 add img2threejs/plugin-cs2       # clone @ newest tag, pin SHA, link host skills
+   img2 doctor                           # fail-loud static audit of every installed plugin
+   ```
+
+   An installed domain plugin contributes its own checklist steps, evidence collection, spec
+   augmentation (quality floors merge raise-only), and a blocking review gate — and registers its
+   profile with `forge/state.py init --profile <id>`. With no plugins installed, `generic`,
+   `character`, and `animated-character` are available; a profile whose plugin is missing fails
+   loud naming what is installed, never silently downgrades. `img2 remove <id>` reverses cleanly.
+   Writing your own plugin: the harness repo's `docs/WRITING_A_PLUGIN.md`.
+
+3. **Invoke** — in Claude Code, attach or point to an object image and run:
 
    ```
    /img2threejs Rebuild this object as a Three.js model, keep the proportions, angles, and colours.
    ```
 
    That is enough: the skill classifies the subject, runs the detail inventory, and gates every pass on its own.
 
-3. **Follow the pipeline** — the skill validates the image, writes an assessment and spec, generates the factory pass by pass, and shows you a side-by-side comparison at each step until the render matches.
+4. **Follow the pipeline** — the skill validates the image, writes an assessment and spec, generates the factory pass by pass, and shows you a side-by-side comparison at each step until the render matches.
 
    For a multi-session reconstruction, create a local state index first:
 
@@ -307,14 +324,18 @@ For the script-by-script reference and the full list of output artifacts, see [d
 - **v1.4 — The Weapon Update** — CS2 image-matched reconstruction: provenance-aware intake, projection-first finishes, family-specific weapon adapters, and structural review gates.
 - **v1.4.1** — CS2 hardening: explicit component coverage, a dedicated Glock-18 assembly contract, map-stripped blockout evidence, and stricter geometry-integrity checks.
 - **creature generator** — 4 body plans (quadruped / avian / winged-dragon / serpentine), `animalAnatomy` spec, spine-loft geometry, ΔE00 colour gates.
+- **The Plugin Update (in review, PR #106)** — the domain registry, pull-based spec augmentation
+  with raise-only quality floors, the emission-target socket with provenance, per-plugin blocking
+  gates, and the img2 harness (`img2 install/add/doctor`). CS2 extracted into `plugin-cs2`; the
+  base names no domain. The "plugin ecosystem and API" originally slotted for v2.0, pulled forward.
 - **v1.5 — The Character Update** — a skeleton derived from the component tree and bound to `SkinnedMesh` geometry, geodesic skinning, hair as a five-stage subsystem with a hard scalp-exposure gate, chirality gates, interior-difference review, the `tapered-sweep` primitive, the material pipeline with a blocking acceptance gate, and resumable workflow state. Not included: the `hairProfile` compiler, IK, pose-sweep gating, clothing.
 
 **Next — one theme per release:**
 - **v1.6 — The Environment Update**: buildings, rooms, streets, vegetation, terrain-aware and multi-object reconstruction.
 - **v1.7 — The Game Pipeline Update**: Unity and Unreal exporters, a Blender bridge, LOD and collision-mesh generation.
 - **v1.8 — The Animation Update**: auto rigging, auto skin weights, Mixamo compatibility, facial rig.
 - **v1.9 — The AI Studio Update**: web UI, batch processing, visual prompt builder, cloud rendering.
-- **v2.0 — The Procedural World Update**: multi-view reconstruction, procedural city generation, semantic world understanding, plugin ecosystem and API.
+- **v2.0 — The Procedural World Update**: multi-view reconstruction, procedural city generation, semantic world understanding.
 
 The arc: assets (v1.4–v1.5) → worlds (v1.6–v1.7) → production (v1.8–v1.9) → an AI game-asset platform that generates playable worlds from reference images (v2.0).
 
```

---

### Incident Patch 2: `1b79af58` (2026-09-03)
**Commit Message**: fix: commit the registry-port test adaptations; review follow-ups

The rig-suite and registry-expectation adaptations were working-tree-only at the merge commit (HEAD would ImportError on RIG_STEPS) -- caught in review. Plus: rig tests pin IMG2_HOME to a temp home so a developer's installed domains cannot fail them; README drops the extracted cs2_review row and names the registry; the two Unreleased Added headings are disambiguated.

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 broke meshes because no step in the workflow forbade it and no gate could tell a rigged mesh from a
 damaged one. This closes the loop between the gates and the pipeline that is supposed to enforce them.
 
-### Added
+### Added (rigging and animation workflow, merged from main)
 
 - **`animated-character` workflow profile** (now `forge/_shared/domains/animated_character.py` --
   ported from the hardcoded `RIG_STEPS` into the domain registry when this branch merged v1.5.2;
```

**File**: `README.md` (modified, +1/-2)
```diff
@@ -91,7 +91,7 @@ It runs under Claude Code, Codex, or OpenCode. It is agent-agnostic: wherever th
 - **Maximum likeness for a specific person or character.** An opt-in projection-first path fits a parametric template to image landmarks, de-lights the photo, camera-matches the render, and projects the reference onto the mesh. A single image cannot guarantee 100 percent likeness, so the pipeline reports per-region confidence and asks for more views when it matters. Details: `grimoire/character/likeness_maximization.md`.
 - **Multi-view silhouette carving.** An opt-in `geometryDescriptor.visualHull` intersects at least two deterministic orthographic binary silhouettes into a bounded, welded voxel mesh. It records unseen areas as low-confidence rather than inventing hidden detail. Schema and runtime check: `grimoire/scripts.md`.
 - **CS2 weapon review gates.** Knife and Glock-18 routes use family-specific component contracts. The review records exactness tier, family identity, painted-region and projection coverage, per-region confidence, approximation notes, and versioned review-scene metadata; component-coverage and map-stripped blockout gates prevent a convincing texture from standing in for real structure. Ships with the CS2 domain plugin; see its `docs/cs2/review-gates.md`.
-- **Resumable local workflow.** `forge/state.py` records an ordered, evidence-backed intake/pass checklist for generic, character, and CS2 profiles. `forge/next.py --state` resumes from that checklist while the existing spec, render, and review gates remain authoritative.
+- **Resumable local workflow.** `forge/state.py` records an ordered, evidence-backed intake/pass checklist for the generic profile and every registered domain (in-repo `character`/`animated-character`, plus installed domain plugins such as CS2). `forge/next.py --state` resumes from that checklist while the existing spec, render, and review gates remain authoritative.
 - **Material reference pipeline.** Every visible material region can be cropped, analyzed, resolved against the versioned Three.js material registry, fitted into `ObjectSculptSpec`, rendered from controlled camera views, and accepted only after a per-region comparison gate. See [`docs/materials/README.md`](docs/materials/README.md).
 - **Python-assisted browser rendering.** Python may orchestrate camera batches, hashes, manifests, and deterministic diagnostics, but the target browser Three.js route remains the rendering authority. See [`grimoire/build/python_threejs_render_bridge.md`](grimoire/build/python_threejs_render_bridge.md).
 
@@ -243,7 +243,6 @@ The net effect: you still get a faithful 3D model from an image, but the expensi
 | `stage4_review/material_gate.py` | Block material-pass until registry, crop, render, compatibility, and comparison evidence passes. |
 | `stage4_review/make_comparison_sheet.py` | Package one reference-vs-render sheet for review. |
 | `stage4_review/append_review.py` | Record a per-pass review: scores, decision, evidence. |
-| `stage4_review/cs2_review.py` | Evaluate the blocking CS2 knife review contract and versioned scene thresholds. |
 | `_shared/feature_acceptance_policy.py` | Internal helper enforcing per-feature score thresholds. |
 | `stage1_intake/build_detail_inventory.py` | Slice the reference into zones and scaffold a detail inventory. |
 | `stage1_intake/extract_landmarks.py` | Overlay a landmark grid and scaffold an anatomy block for characters. |
```

**File**: `forge/tests/test_domain_registry.py` (modified, +2/-2)
```diff
@@ -41,9 +41,9 @@ def test_both_registry_sources_register_hermetically(self) -> None:
         # happens to have under ~/.img2 -- the old form of this test asserted the INSTALLED cs2
         # plugin and was green or red depending on the machine, which is what turned CI red.
         with self._temp_img2_home({}):
-            self.assertEqual(sorted(registered_domains()), ["character"])
+            self.assertEqual(sorted(registered_domains()), ["animated-character", "character"])
         with self._temp_img2_home({"fixture-plugin": {"id": "fixture-dom"}}):
-            self.assertEqual(sorted(registered_domains()), ["character", "fixture-dom"])
+            self.assertEqual(sorted(registered_domains()), ["animated-character", "character", "fixture-dom"])
 
     def test_an_unregistered_profile_fails_loud_and_names_what_is_available(self) -> None:
         with self.assertRaises(DomainRegistryError) as ctx:
```

**File**: `forge/tests/test_rig_workflow_steps.py` (modified, +29/-5)
```diff
@@ -17,15 +17,39 @@
 
 from __future__ import annotations
 
+import os
 import sys
+import tempfile
 import unittest
 from pathlib import Path
 
 ROOT = Path(__file__).resolve().parents[1]
 sys.path.insert(0, str(ROOT / "_shared"))
 
+# Profiles resolve through the domain registry, which reads installed plugins from IMG2_HOME.
+# Pinned to an empty temp home so a developer's real ~/.img2 (malformed or colliding domain.json)
+# can never fail these tests -- the test_search_specs.py pattern.
+_TMP_HOME: tempfile.TemporaryDirectory | None = None
+_OLD_HOME: str | None = None
+
+
+def setUpModule() -> None:
+    global _TMP_HOME, _OLD_HOME
+    _TMP_HOME = tempfile.TemporaryDirectory()
+    _OLD_HOME = os.environ.get("IMG2_HOME")
+    os.environ["IMG2_HOME"] = _TMP_HOME.name
+
+
+def tearDownModule() -> None:
+    if _OLD_HOME is None:
+        os.environ.pop("IMG2_HOME", None)
+    else:
+        os.environ["IMG2_HOME"] = _OLD_HOME
+    if _TMP_HOME is not None:
+        _TMP_HOME.cleanup()
+
+from domains.animated_character import DOMAIN as ANIMATED_CHARACTER  # noqa: E402
 from workflow_state import (  # noqa: E402
-    RIG_STEPS,
     WorkflowStateError,
     new_state,
     next_entry,
@@ -46,7 +70,7 @@ def test_the_profile_is_accepted(self) -> None:
         self.assertEqual(self.state["profile"], "animated-character")
 
     def test_every_rig_step_reaches_the_checklist(self) -> None:
-        self.assertEqual(rig_ids(self.state), [step_id for step_id, _command in RIG_STEPS])
+        self.assertEqual(rig_ids(self.state), [step_id for step_id, _command in ANIMATED_CHARACTER["rigSteps"]])
 
     def test_it_keeps_the_character_steps_too(self) -> None:
         """An animated character is still a character; the anatomy contract must not be lost."""
@@ -137,7 +161,7 @@ def drain(self, profile: str) -> tuple[list[str], dict]:
 
     def test_every_rig_step_is_actually_dispatched(self) -> None:
         dispatched, _state = self.drain("animated-character")
-        self.assertEqual(dispatched, [step_id for step_id, _command in RIG_STEPS])
+        self.assertEqual(dispatched, [step_id for step_id, _command in ANIMATED_CHARACTER["rigSteps"]])
 
     def test_the_build_is_not_complete_while_a_rig_step_is_pending(self) -> None:
         """The exact bug: `complete` was reached with all nine rig steps still pending."""
@@ -170,13 +194,13 @@ def test_rig_steps_are_visible_in_status(self) -> None:
         """Invisible in status output is unreachable in practice: nobody knows to run them."""
         state = new_state("subject.glb", profile="animated-character", spec="spec.json")
         pending = status_payload(state)["pending"]
-        for step_id, _command in RIG_STEPS:
+        for step_id, _command in ANIMATED_CHARACTER["rigSteps"]:
             self.assertIn(step_id, pending)
 
 
 class StepsNameTheirTooling(unittest.TestCase):
     def setUp(self) -> None:
-        self.commands = dict(RIG_STEPS)
+        self.commands = dict(ANIMATED_CHARACTER["rigSteps"])
 
     def test_each_gate_step_names_the_script_that_runs_it(self) -> None:
         for step_id, script in (
```

---

### Incident Patch 3: `fa0575ae` (2026-09-03)
**Commit Message**: fix: drop the base's fifth copy of the knife-only family gate

cs2_manifest.py removed four copies of the knife restriction when the plugin generalized to every CS2 family, but this one lived in the base's strict validator, so any non-knife CS2 item still failed with 'requires the registered knife adapter'. Found (and patched in-tree) by the live MP9 run in test-e2e-02; landed here with the test that pins it.

**File**: `forge/stage2_spec/validate_sculpt_spec.py` (modified, +6/-2)
```diff
@@ -861,8 +861,12 @@ def validate_cs2_contract(spec: dict[str, Any], errors: list[str], warnings: lis
         errors.append("cs2Intake.route must be a supported CS2 route")
     if tier not in CS2_EXACTNESS_TIERS:
         errors.append("cs2Intake.exactnessTier must be a supported exactness tier")
-    if intake.get("itemFamily") != "knife":
-        errors.append("cs2Intake requires the registered knife adapter")
+    # No family gate here. The base names no domain (SKILL.md, "Domain plugins"), and the CS2
+    # plugin serves any CS2 item: only the component *tree* is family-specific, and its absence is
+    # recorded as geometrySource=agent-inferred rather than making the spec invalid. This was the
+    # fifth place the knife-only restriction was enforced -- cs2_manifest.py removed the other four
+    # and says so in a comment -- but this copy lived in the base, so every non-knife CS2 item was
+    # still blocked at strict validation.
     if route == "reference-projection":
         camera = spec.get("referenceCamera")
         source = intake.get("deLitAlbedo") or intake.get("sourceImage")
```

**File**: `forge/tests/test_pipeline_routing.py` (modified, +19/-0)
```diff
@@ -146,6 +146,25 @@ def test_legacy_cs2_intake_derives_valid_routing_without_persisting_it(self) ->
         self.assertEqual(errors, [])
         self.assertNotIn("pipelineRouting", spec)
 
+    def test_cs2_contract_accepts_any_item_family(self) -> None:
+        # The knife-only family gate lived on in the base validator after cs2_manifest.py removed
+        # its four plugin-side copies -- every non-knife CS2 item failed strict validation with
+        # "requires the registered knife adapter". Found by a live MP9 run (test-e2e-02).
+        from forge.stage2_spec.validate_sculpt_spec import validate_cs2_contract
+
+        errors: list[str] = []
+        warnings: list[str] = []
+        spec = {
+            "cs2Intake": {
+                "itemFamily": "smg",
+                "route": "procedural-finish",
+                "exactnessTier": "metadata-assisted",
+            }
+        }
+        validate_cs2_contract(spec, errors, warnings)
+        self.assertNotIn("cs2Intake requires the registered knife adapter", errors)
+        self.assertEqual([e for e in errors if "knife" in e], [])
+
 
 if __name__ == "__main__":
     unittest.main()
```

---

### Incident Patch 4: `5ca9f819` (2026-09-02)
**Commit Message**: fix: surface the runner's stderr when no envelope was printed

An installed harness too old for a forwarded --gate-timeout rejects it on stderr and prints no envelope; the caller saw only "no parseable img2.gate-run envelope" while the actual cause never surfaced. Found in e2e re-verification (F8).

**File**: `forge/stage3_build/run_gates.py` (modified, +10/-1)
```diff
@@ -232,7 +232,16 @@ def run_plugin_gates(
         )
     except EmitTargetError as exc:
         raise GateExecutionError(f"plugin {plugin_id!r} gates: {exc}") from exc
-    doc = parse_gate_run_envelope(proc.stdout)
+    try:
+        doc = parse_gate_run_envelope(proc.stdout)
+    except GateExecutionError as exc:
+        # A runner that never printed an envelope said why on stderr (e.g. an installed harness too
+        # old for a forwarded --gate-timeout: "unrecognized arguments"). Flattening that into "no
+        # parseable envelope" hides the actual cause from the user.
+        stderr_text = proc.stderr.decode("utf-8", errors="replace").strip()
+        if stderr_text:
+            raise GateExecutionError(f"{exc}; gate runner stderr: {stderr_text[:500]}") from exc
+        raise
     _check_exit_agreement(doc, proc.returncode)
     return doc
 
```

**File**: `forge/tests/test_run_gates.py` (modified, +26/-0)
```diff
@@ -237,6 +237,32 @@ def test_a_registry_error_stops_the_run_instead_of_skipping_gates(self):
         self.assertIn("gated", str(ctx.exception))
 
 
+class RunnerStderrSurfacesOnEnvelopeFailure(RunGatesTestBase):
+    """A runner that never printed an envelope said why on stderr — e.g. an installed harness too
+    old for a forwarded --gate-timeout rejects it with argparse's "unrecognized arguments" and no
+    stdout at all. That cause must reach the error, not be flattened into "no parseable envelope"."""
+
+    def test_the_runners_stderr_is_named_when_no_envelope_was_printed(self):
+        _write_gated_plugin(
+            self.home, "gated",
+            gate_body=PASS_GATE.format(gate_id="gated-gate", plugin_id="gated"),
+        )
+        # Replace the copied runner with a stub that mimics a pre-0.2.2 harness: argparse rejects
+        # the forwarded flag on stderr and exits 2 without printing an envelope.
+        (self.home / "harness" / "img2_core" / "gate_runner.py").write_text(
+            "import sys\n"
+            "sys.stderr.write(\"gate_runner.py: error: unrecognized arguments: --gate-timeout 60\\n\")\n"
+            "sys.exit(2)\n",
+            encoding="utf-8",
+        )
+        with self.assertRaises(run_gates.GateExecutionError) as ctx:
+            run_gates.run_plugin_gates(
+                "gated", self.home / "plugins" / "gated",
+                workspace=self.workspace, home=self.home, gate_timeout=60,
+            )
+        self.assertIn("unrecognized arguments: --gate-timeout", str(ctx.exception))
+
+
 class BlockingStopNamesGateAndPlugin(RunGatesTestBase):
     def test_a_blocking_failure_stops_the_run_naming_gate_and_plugin(self):
         state = _action_ready_state(self.workspace, self.spec_path)
```

---

### Incident Patch 5: `aa702694` (2026-09-02)
**Commit Message**: fix: detect a second BIN chunk after an empty one

The duplicate check tested payload truthiness; a zero-length first BIN chunk is falsy, so a second BIN chunk slid through the check the docstring promises to refuse.

**File**: `forge/_shared/glb_container.py` (modified, +5/-1)
```diff
@@ -51,6 +51,7 @@ def parse_glb(path: Path) -> tuple[dict[str, Any], bytes, dict[str, Any]]:
     cursor = 12
     json_payload: bytes | None = None
     bin_payload = b""
+    bin_seen = False
     chunks: list[dict[str, Any]] = []
     while cursor < len(data):
         if cursor + 8 > len(data):
@@ -68,8 +69,11 @@ def parse_glb(path: Path) -> tuple[dict[str, Any], bytes, dict[str, Any]]:
                 raise ValueError("GLB contains more than one JSON chunk")
             json_payload = payload.rstrip(b" \t\r\n\x00")
         elif chunk_type == BIN_CHUNK:
-            if bin_payload:
+            # A seen-flag, not truthiness: a zero-length first BIN chunk is falsy, and truthiness
+            # let a second BIN chunk slide through the duplicate check.
+            if bin_seen:
                 raise ValueError("GLB contains more than one BIN chunk")
+            bin_seen = True
             bin_payload = payload
 
     if json_payload is None:
```

**File**: `forge/tests/test_glb_reference.py` (modified, +22/-0)
```diff
@@ -151,5 +151,27 @@ def test_v2_manifest_declares_shared_profile_and_six_passes(self) -> None:
             )
 
 
+class GlbContainerRefusesDuplicateBinChunks(unittest.TestCase):
+    """`parse_glb` promises to refuse more than one BIN chunk; the duplicate check must be a
+    seen-flag, not payload truthiness -- a zero-length first BIN chunk is falsy and let a second
+    one through."""
+
+    def test_a_second_bin_chunk_after_an_empty_one_is_refused(self) -> None:
+        from forge._shared.glb_container import parse_glb
+
+        payload = json.dumps({"asset": {"version": "2.0"}}).encode("utf-8")
+        payload += b" " * ((4 - len(payload) % 4) % 4)
+        chunks = struct.pack("<II", len(payload), 0x4E4F534A) + payload
+        chunks += struct.pack("<II", 0, 0x004E4942)
+        chunks += struct.pack("<II", 4, 0x004E4942) + b"\x00\x00\x00\x00"
+        blob = struct.pack("<4sII", b"glTF", 2, 12 + len(chunks)) + chunks
+        with tempfile.TemporaryDirectory() as tmp:
+            path = Path(tmp) / "double-bin.glb"
+            path.write_bytes(blob)
+            with self.assertRaises(ValueError) as ctx:
+                parse_glb(path)
+        self.assertIn("more than one BIN chunk", str(ctx.exception))
+
+
 if __name__ == "__main__":
     unittest.main()
```

---

### Incident Patch 6: `d6f30a0d` (2026-09-02)
**Commit Message**: fix: fail loud on gate participation; widen the run bound

A DomainRegistryError during the participation check was swallowed as uninvolved, silently skipping a blocking gate whose domain steps had run -- fail-open in the enforcement layer. And the flat 300s wrapper bound could not cover the runner's PER-GATE timeout: two 200s gates were legitimate yet killed mid-flight, and a forwarded --gate-timeout above 300 could never be honoured; the bound now scales by the declared gate count.

**File**: `forge/stage3_build/run_gates.py` (modified, +17/-5)
```diff
@@ -215,9 +215,18 @@ def run_plugin_gates(
     # drift-guard test asserts the two match exactly.
     if gate_timeout is not None:
         argv += ["--gate-timeout", str(gate_timeout)]
+    # The runner applies its timeout PER GATE, so the outer bound must cover every declared gate --
+    # a flat bound killed a legitimately-configured multi-gate run mid-flight, and could never
+    # honour a forwarded --gate-timeout larger than itself. The margin is runner overhead.
+    per_gate = gate_timeout if gate_timeout is not None else GATE_TIMEOUT_SECONDS
+    try:
+        gate_count = len(json.loads((plugin_dir / "gates.json").read_text(encoding="utf-8")))
+    except (OSError, json.JSONDecodeError, TypeError):
+        gate_count = 1
+    outer_timeout = per_gate * max(gate_count, 1) + 30
     try:
         proc = run_bounded(
-            argv, cwd=workspace, timeout=GATE_TIMEOUT_SECONDS, declared_env=[],
+            argv, cwd=workspace, timeout=outer_timeout, declared_env=[],
             target_kind=f"gates:{plugin_id}",
         )
     except EmitTargetError as exc:
@@ -245,10 +254,13 @@ def run_gates_for_workspace(
     for plugin_id, plugin_dir in _installed_plugins_with_gates(home):
         try:
             involved = plugin_contributed_a_step(state, plugin_id, home)
-        except DomainRegistryError:
-            # The profile lookup failing here is not this plugin's fault and not this function's
-            # question to answer -- treat as uninvolved rather than crash the whole gate run.
-            involved = False
+        except DomainRegistryError as exc:
+            # Fail loud, not open: gates are the enforcement layer, so "cannot determine
+            # participation" must stop the run -- treating it as uninvolved silently skipped a
+            # blocking gate whose domain steps had actually run in this workspace.
+            raise GateExecutionError(
+                f"cannot determine gate participation for plugin {plugin_id!r}: {exc}"
+            ) from exc
         if not involved:
             continue
         doc = run_plugin_gates(plugin_id, plugin_dir, workspace=workspace, home=home, gate_timeout=gate_timeout)
```

**File**: `forge/tests/test_run_gates.py` (modified, +25/-0)
```diff
@@ -212,6 +212,31 @@ def test_no_installed_plugins_at_all_is_a_harmless_empty_run(self):
         self.assertEqual(results, {})
 
 
+class ParticipationLookupFailureFailsLoudNotOpen(RunGatesTestBase):
+    """A DomainRegistryError during the participation check used to be swallowed as "uninvolved",
+    which silently skipped a blocking gate whose domain steps had actually run -- fail-open in the
+    enforcement layer. It must stop the run naming the plugin instead."""
+
+    def test_a_registry_error_stops_the_run_instead_of_skipping_gates(self):
+        from unittest import mock
+
+        from domains import DomainRegistryError
+
+        _write_gated_plugin(
+            self.home, "gated",
+            gate_body=PASS_GATE.format(gate_id="gated-gate", plugin_id="gated"),
+        )
+        _action_ready_state(self.workspace, self.spec_path)
+        with mock.patch.object(
+            run_gates, "plugin_contributed_a_step",
+            side_effect=DomainRegistryError("domain id 'x' is declared twice"),
+        ):
+            with self.assertRaises(run_gates.GateExecutionError) as ctx:
+                run_gates.run_gates_for_workspace(self.workspace, home=self.home)
+        self.assertIn("participation", str(ctx.exception))
+        self.assertIn("gated", str(ctx.exception))
+
+
 class BlockingStopNamesGateAndPlugin(RunGatesTestBase):
     def test_a_blocking_failure_stops_the_run_naming_gate_and_plugin(self):
         state = _action_ready_state(self.workspace, self.spec_path)
```

---

### Incident Patch 7: `6fa7d5aa` (2026-09-02)
**Commit Message**: fix: pass --force to the reference target emitter

mkstemp pre-creates the out file, and the emitter refuses an existing --out without --force, so every real --target threejs-ts run failed with "already exists". No test caught it: each one either passed --force itself or aimed at a path that did not exist yet. The new socket end-to-end test runs the whole path with nothing pre-supplied and fails without this flag.

**File**: `forge/stage3_build/emit_target.py` (modified, +3/-1)
```diff
@@ -478,7 +478,9 @@ def _run_reference_target(target: Target, *, spec_path: Path, workspace: Path) -
     emitter = str(_FORGE_ROOT / "stage3_build" / "generate_threejs_factory.py")
 
     def invoke(out_path: Path) -> subprocess.CompletedProcess:
-        argv = [sys.executable, emitter, str(spec_path), "--out", str(out_path), "--pass-id", pass_id]
+        # --force is required: mkstemp below pre-creates out_path, and the emitter refuses an
+        # existing --out without it -- omitting the flag makes every reference-target run fail.
+        argv = [sys.executable, emitter, str(spec_path), "--out", str(out_path), "--force", "--pass-id", pass_id]
         return run_bounded(argv, cwd=workspace, timeout=timeout, declared_env=[], target_kind=target.kind)
 
     artifact_path.parent.mkdir(parents=True, exist_ok=True)
```

**File**: `forge/tests/test_target_reference_conformance.py` (modified, +57/-0)
```diff
@@ -15,6 +15,7 @@
 from __future__ import annotations
 
 import json
+import os
 import subprocess
 import sys
 import tempfile
@@ -198,5 +199,61 @@ def test_malformed_json_on_stderr_is_classified_as_error_never_a_pass(self) -> N
         self.assertEqual(emit_target._classify_reference_failure(2, wrong_shape).classification, "error")
 
 
+class ReferenceTargetSocketEndToEnd(unittest.TestCase):
+    """The full socket path for `--target threejs-ts`: resolve -> action-ready -> temp-write ->
+    emitter subprocess -> verify -> determinism -> rename -> provenance, with nothing pre-supplied.
+
+    Regression for the pre-created out-path defect: `_run_reference_target` mkstemps the output
+    file before the emitter runs, so its invocation must carry --force or every real
+    reference-target run failed with "already exists" -- which no other test caught, because each
+    one either passed --force itself or pointed the emitter at a path that did not exist yet."""
+
+    def test_the_socket_produces_the_oracle_artifact_end_to_end(self) -> None:
+        from forge.tests.test_emit_target import _action_ready_state_path
+        from feature_acceptance_policy import feature_targets_for_pass
+
+        spec = json.loads(FROZEN_SPEC.read_text(encoding="utf-8"))
+        # The minimum honest completion record for the frozen pass: review_completes_pass demands
+        # visual evidence, a passing vision score, a passing review per critical feature, and the
+        # spec's own required layer scores.
+        acceptance = spec["selfCorrectLoop"]["visualAcceptance"]
+        spec["reviewHistory"] = [{
+            "passId": FROZEN_PASS_ID, "action": "continue",
+            "visualEvidence": {"renderScreenshot": "render.png", "comparisonImage": "compare.png"},
+            "aiVisionScore": 0.9,
+            "layerScores": {layer: 0.9 for layer in acceptance["requiredLayerScores"]},
+            "featureReviews": [
+                {"id": target["id"], "score": 0.95}
+                for target in feature_targets_for_pass(spec, FROZEN_PASS_ID)
+                if isinstance(target.get("id"), str)
+            ],
+        }]
+        old_home = os.environ.get("IMG2_HOME")
+        with tempfile.TemporaryDirectory() as tmp:
+            workspace = Path(tmp) / "ws"
+            workspace.mkdir()
+            spec_path = workspace / "spec.json"
+            spec_path.write_text(json.dumps(spec), encoding="utf-8")
+            _action_ready_state_path(workspace)
+            os.environ["IMG2_HOME"] = str(Path(tmp) / "img2home-empty")
+            try:
+                rc = emit_target.main([
+                    "--spec", str(spec_path), "--target", "threejs-ts", "--workspace", str(workspace),
+                ])
+            finally:
+                if old_home is None:
+                    os.environ.pop("IMG2_HOME", None)
+                else:
+                    os.environ["IMG2_HOME"] = old_home
+            self.assertEqual(rc, 0)
+            artifact = workspace / ".img2" / "artifacts" / "threejs-ts" / "model.ts"
+            self.assertEqual(artifact.read_text(encoding="utf-8"), ORACLE_TS.read_text(encoding="utf-8"))
+            provenance = json.loads(
+                artifact.with_suffix(artifact.suffix + ".provenance.json").read_text(encoding="utf-8")
+            )
+            self.assertEqual(provenance["target"], "threejs-ts")
+            self.assertTrue(provenance["determinismVerified"])
+
+
 if __name__ == "__main__":
     unittest.main()
```

---

### Incident Patch 8: `cb9c4b8b` (2026-09-02)
**Commit Message**: fix: refuse non-dict assessmentPatch values for guarded keys

objectClass and detailInventory carry guarded values; a non-dict replacement fell through to plain assignment and clobbered the dict the domain marker and the raise-only detail floor live in -- strict validation then saw no positive targetMinDetails and disabled the detail gate with clamped reporting nothing.

**File**: `forge/_shared/spec_augmentation.py` (modified, +6/-0)
```diff
@@ -89,6 +89,12 @@ def merge_spec_augmentation(spec: dict[str, Any], artifact: Any, *, domain_id: s
         raise SpecAugmentationError("assessmentPatch must be an object")
     pre = spec.setdefault("preSpecAssessment", {})
     for key, value in patch.items():
+        if key in ("objectClass", "detailInventory") and not isinstance(value, dict):
+            # These two carry guarded values (the domain marker, the raise-only detail floor). A
+            # non-dict replacement would fall through to the plain-assignment branch below and
+            # clobber the dict both guards live in -- refusing it keeps every path to a floor
+            # clamped, not just the well-formed one.
+            raise SpecAugmentationError(f"assessmentPatch.{key} must be an object, got {value!r}")
         if key == "objectClass" and isinstance(value, dict):
             if "domain" in value:
                 raise SpecAugmentationError("assessmentPatch may not set objectClass.domain; the base sets it from domain resolution")
```

**File**: `forge/tests/test_domain_spec_contract.py` (modified, +17/-0)
```diff
@@ -90,6 +90,23 @@ def test_assessment_patch_other_detail_inventory_keys_still_merge(self) -> None:
         )
         self.assertEqual(spec["preSpecAssessment"]["detailInventory"]["targetMinDetails"], 40)
 
+    def test_a_non_dict_detail_inventory_patch_is_refused_not_applied(self) -> None:
+        # A non-dict value used to fall through to the plain-assignment branch and clobber the
+        # whole dict the floor lives in -- strict validation then saw no positive targetMinDetails
+        # and disabled the detail gate entirely, with `clamped` reporting nothing.
+        spec = {"preSpecAssessment": {"detailInventory": {"targetMinDetails": 40}}}
+        with self.assertRaises(SpecAugmentationError):
+            merge_spec_augmentation(spec, artifact(assessmentPatch={"detailInventory": 0}))
+        self.assertEqual(spec["preSpecAssessment"]["detailInventory"]["targetMinDetails"], 40)
+
+    def test_a_non_dict_object_class_patch_is_refused_not_applied(self) -> None:
+        spec = {"preSpecAssessment": {"objectClass": {"domain": "base"}}}
+        with self.assertRaises(SpecAugmentationError):
+            merge_spec_augmentation(
+                spec, artifact(assessmentPatch={"objectClass": "weapon"}), domain_id="testdomain"
+            )
+        self.assertEqual(spec["preSpecAssessment"]["objectClass"], {"domain": "base"})
+
     def test_a_kept_tier_is_recorded_like_a_kept_number(self) -> None:
         spec = {"qualityContract": {"qualityBar": "ultra-complex"}}
         record = merge_spec_augmentation(spec, artifact(qualityFloors={"qualityBar": "simple"}))
```

---

### Incident Patch 9: `a2ceb410` (2026-08-31)
**Commit Message**: fix: name the file at fault when a domain declaration row is malformed

The (id, command) unpack ran before validation, so a malformed domain.json surfaced as a bare ValueError instead of a DomainRegistryError naming the declaration.

**File**: `forge/_shared/domains/__init__.py` (modified, +10/-3)
```diff
@@ -136,9 +136,16 @@ def _installed_plugin_domains() -> list[tuple[Path, Any]]:
         plugin_dir = str(declaration.parent)
         for key in ("setupSteps", "passSteps"):
             if key in entry:
-                entry[key] = tuple(
-                    (step_id, command.replace("{plugin_dir}", plugin_dir)) for step_id, command in entry[key]
-                )
+                try:
+                    entry[key] = tuple(
+                        (step_id, command.replace("{plugin_dir}", plugin_dir)) for step_id, command in entry[key]
+                    )
+                except (TypeError, ValueError, AttributeError) as exc:
+                    # Unpacking used to run before validation, so a malformed row surfaced as a bare
+                    # ValueError/AttributeError instead of an error naming the file at fault.
+                    raise DomainRegistryError(
+                        f"{declaration}: {key!r} rows must be [id, command] pairs of strings"
+                    ) from exc
         out.append((declaration, entry))
     return out
 
```

---

### Incident Patch 10: `041c790f` (2026-08-31)
**Commit Message**: fix: fail loud when a domain run's augmentation artifact is missing

A resolved --domain whose spec-augmentation.json was absent silently wrote the generic skeleton and exited 0 -- a run could finish with no domain contribution and nobody would know, while the wiki draws this case as FAIL LOUD. Without --domain the skip stays correct and is pinned by its own test.

**File**: `forge/stage2_spec/new_sculpt_spec.py` (modified, +22/-8)
```diff
@@ -1946,14 +1946,28 @@ def main(argv: list[str]) -> int:
         if isinstance(assessment, dict) and isinstance(assessment.get("preSpecAssessment"), dict):
             anatomy = assessment["preSpecAssessment"].get("anatomy")
         apply_character_template(spec, anatomy, include_accessories=args.accessories)
-    if args.augmentation is not None and args.augmentation.expanduser().is_file():
-        try:
-            artifact = json.loads(args.augmentation.expanduser().read_text(encoding="utf-8"))
-            merge_spec_augmentation(spec, artifact, domain_id=args.domain)
-        except (OSError, json.JSONDecodeError) as exc:
-            parser.error(f"cannot read spec augmentation {args.augmentation}: {exc}")
-        except SpecAugmentationError as exc:
-            parser.error(str(exc))
+    if args.augmentation is not None:
+        source = args.augmentation.expanduser()
+        if not source.is_file():
+            # A domain run whose augmentation artifact is missing means the domain's emit step
+            # failed or was skipped. Writing the generic skeleton and exiting 0 here is the silent
+            # downgrade 02-how-it-works.md draws as FAIL LOUD (PR #106 review, finding 4). Without
+            # --domain the flag is speculative plumbing from a generic checklist, and skipping stays
+            # correct.
+            if args.domain:
+                parser.error(
+                    f"--domain {args.domain} is resolved but the augmentation artifact "
+                    f"{args.augmentation} does not exist; run the domain's emit step instead of "
+                    f"continuing on the generic skeleton"
+                )
+        else:
+            try:
+                artifact = json.loads(source.read_text(encoding="utf-8"))
+                merge_spec_augmentation(spec, artifact, domain_id=args.domain)
+            except (OSError, json.JSONDecodeError) as exc:
+                parser.error(f"cannot read spec augmentation {args.augmentation}: {exc}")
+            except SpecAugmentationError as exc:
+                parser.error(str(exc))
     payload = json.dumps(spec, indent=2, ensure_ascii=False) + "\n"
 
     if args.out:
```

**File**: `forge/tests/test_pipeline.py` (modified, +27/-0)
```diff
@@ -889,6 +889,33 @@ def test_character_template_survives_an_augmentation_file(self):
         self.assertIn("fixtureSection", spec, "the augmentation merge was skipped")
         self.assertEqual(spec["specAugmentation"]["provider"], "fixture")
 
+    def test_a_domain_run_with_a_missing_augmentation_fails_loud(self):
+        """02-how-it-works draws the missing-provider case as FAIL LOUD; the code must match.
+
+        Before this test, a resolved --domain whose spec-augmentation.json was absent (emit step
+        failed, or an actor:agent step skipped) silently wrote the generic skeleton and exited 0 --
+        a whole run could finish with no domain contribution and nobody would know.
+        """
+        r = run(
+            "stage2_spec/new_sculpt_spec.py", "Knife",
+            "--domain", "fixturedom",
+            "--augmentation", self.dir / "does-not-exist.json",
+            "--out", self.spec,
+        )
+        self.assertNotEqual(r.returncode, 0)
+        self.assertIn("does-not-exist.json", r.stderr)
+        self.assertIn("fixturedom", r.stderr)
+        self.assertFalse(self.spec.exists(), "no generic skeleton may be written for a failed domain run")
+
+    def test_a_generic_run_still_skips_a_missing_augmentation(self):
+        r = run(
+            "stage2_spec/new_sculpt_spec.py", "Crate",
+            "--augmentation", self.dir / "does-not-exist.json",
+            "--out", self.spec,
+        )
+        self.assertEqual(r.returncode, 0, r.stderr)
+        self.assertTrue(self.spec.exists())
+
     def test_cs2_track_skipped_for_objects(self):
         run("stage2_spec/new_sculpt_spec.py", "Crate", "--out", self.spec)
         spec = json.loads(self.spec.read_text())
```

**File**: `forge/tests/test_suite_integrity.py` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@
 # registry layout instead of assumed from a name match) added 2 tests -- a plugin whose package
 # name differs from its domain id, and an in-repo domain's profile correctly attributing no
 # installed plugin as its owner.
-COLLECTED_FLOOR = 1185
+COLLECTED_FLOOR = 1192
 
 
 REPO_ROOT = TESTS_DIR.parents[1]
```

---

### Incident Patch 11: `78fd1c24` (2026-08-31)
**Commit Message**: fix: clamp every path to a floor, not just the qualityFloors partition

assessmentPatch could lower detailInventory.targetMinDetails -- the exact number strict validation reads -- while clamped reported nothing, and a patched value arriving first meant qualityFloors' own clamp never ran. The clamp now guards the value in whichever partition carries it. _stricter_tier records a kept tier like a kept number and refuses a malformed base tier instead of letting a looser proposal replace it. Found in review of PR #106 by executing the merge, reproduced here as tests first.

**File**: `forge/_shared/spec_augmentation.py` (modified, +22/-3)
```diff
@@ -33,12 +33,20 @@ class SpecAugmentationError(ValueError):
     pass
 
 
-def _stricter_tier(current: Any, proposed: Any) -> Any:
+def _stricter_tier(current: Any, proposed: Any, clamped: list[str]) -> Any:
     if proposed not in TIER_ORDER:
         raise SpecAugmentationError(f"unknown quality tier {proposed!r}; expected one of {', '.join(TIER_ORDER)}")
+    if current is None:
+        return proposed
     if current not in TIER_ORDER:
+        # A malformed base tier is a base defect to surface, not a blank the plugin gets to fill:
+        # silently accepting the proposal here let a looser tier replace a typo'd stricter one.
+        raise SpecAugmentationError(f"the spec's existing quality tier {current!r} is not one of {', '.join(TIER_ORDER)}")
+    if TIER_ORDER.index(proposed) > TIER_ORDER.index(current):
         return proposed
-    return proposed if TIER_ORDER.index(proposed) > TIER_ORDER.index(current) else current
+    if proposed != current:
+        clamped.append(f"qualityBar: kept {current} over proposed {proposed}")
+    return current
 
 
 def _raise_only_number(path: str, current: Any, proposed: Any, clamped: list[str]) -> Any:
@@ -85,6 +93,17 @@ def merge_spec_augmentation(spec: dict[str, Any], artifact: Any, *, domain_id: s
             if "domain" in value:
                 raise SpecAugmentationError("assessmentPatch may not set objectClass.domain; the base sets it from domain resolution")
             pre.setdefault("objectClass", {}).update(value)
+        elif key == "detailInventory" and isinstance(value, dict):
+            # The one floor-controlled value reachable through this partition. The clamp guards the
+            # VALUE, whichever partition carries it -- without this, a patch lowered the floor the
+            # strict validator reads while `clamped` reported nothing, and qualityFloors' own clamp
+            # never ran because the patched value arrived first.
+            inv = pre.setdefault(key, {})
+            for sub, proposed in value.items():
+                if sub == "targetMinDetails":
+                    inv[sub] = _raise_only_number("targetMinDetails", inv.get(sub), proposed, clamped)
+                else:
+                    inv[sub] = proposed
         elif isinstance(value, dict):
             pre.setdefault(key, {}).update(value)
         else:
@@ -98,7 +117,7 @@ def merge_spec_augmentation(spec: dict[str, Any], artifact: Any, *, domain_id: s
     contract = spec.setdefault("qualityContract", {})
     for key, value in floors.items():
         if key == "qualityBar":
-            contract["qualityBar"] = _stricter_tier(contract.get("qualityBar"), value)
+            contract["qualityBar"] = _stricter_tier(contract.get("qualityBar"), value, clamped)
         elif key == "targetMinDetails":
             inv = pre.setdefault("detailInventory", {})
             inv["targetMinDetails"] = _raise_only_number("targetMinDetails", inv.get("targetMinDetails"), value, clamped)
```

**File**: `forge/tests/test_domain_spec_contract.py` (modified, +49/-0)
```diff
@@ -54,6 +54,55 @@ def test_raising_is_allowed(self) -> None:
         self.assertEqual(spec["qualityContract"]["minimumSpecDepth"]["macroComponents"], 5)
 
 
+class RaiseOnlyCoversEveryPathToAFloor(unittest.TestCase):
+    """The clamp must guard the VALUE, not just the qualityFloors partition.
+
+    assessmentPatch merges into preSpecAssessment, and `detailInventory.targetMinDetails` -- the
+    exact number strict validation reads -- lives there. Before this test existed, a patch could
+    drop the floor 40 -> 2 with `clamped: []` reporting nothing, and plugin-cs2's own emit tool sent
+    the value through BOTH partitions with the unclamped one winning (found in review of PR #106 by
+    running the code, not by reading it).
+    """
+
+    def test_assessment_patch_cannot_lower_the_detail_floor(self) -> None:
+        spec = {"preSpecAssessment": {"detailInventory": {"targetMinDetails": 40}}}
+        record = merge_spec_augmentation(
+            spec, artifact(assessmentPatch={"detailInventory": {"targetMinDetails": 2}})
+        )
+        self.assertEqual(spec["preSpecAssessment"]["detailInventory"]["targetMinDetails"], 40)
+        self.assertTrue(record["clamped"], "the kept-over-proposed decision must leave a record")
+
+    def test_assessment_patch_may_still_raise_the_detail_floor(self) -> None:
+        spec = {"preSpecAssessment": {"detailInventory": {"targetMinDetails": 12}}}
+        record = merge_spec_augmentation(
+            spec, artifact(assessmentPatch={"detailInventory": {"targetMinDetails": 60}})
+        )
+        self.assertEqual(spec["preSpecAssessment"]["detailInventory"]["targetMinDetails"], 60)
+        self.assertEqual(record["clamped"], [])
+
+    def test_assessment_patch_other_detail_inventory_keys_still_merge(self) -> None:
+        spec = {"preSpecAssessment": {"detailInventory": {"targetMinDetails": 40}}}
+        merge_spec_augmentation(
+            spec, artifact(assessmentPatch={"detailInventory": {"expectedFinishes": ["anodized"]}})
+        )
+        self.assertEqual(
+            spec["preSpecAssessment"]["detailInventory"]["expectedFinishes"], ["anodized"]
+        )
+        self.assertEqual(spec["preSpecAssessment"]["detailInventory"]["targetMinDetails"], 40)
+
+    def test_a_kept_tier_is_recorded_like_a_kept_number(self) -> None:
+        spec = {"qualityContract": {"qualityBar": "ultra-complex"}}
+        record = merge_spec_augmentation(spec, artifact(qualityFloors={"qualityBar": "simple"}))
+        self.assertEqual(spec["qualityContract"]["qualityBar"], "ultra-complex")
+        self.assertTrue(record["clamped"], "a tier kept over a looser proposal must leave a record")
+
+    def test_a_malformed_base_tier_is_refused_not_silently_replaced(self) -> None:
+        spec = {"qualityContract": {"qualityBar": "Ultra-Complex"}}
+        with self.assertRaises(SpecAugmentationError) as ctx:
+            merge_spec_augmentation(spec, artifact(qualityFloors={"qualityBar": "simple"}))
+        self.assertIn("Ultra-Complex", str(ctx.exception))
+
+
 class WhatAnArtifactMayNotDo(unittest.TestCase):
     def test_it_may_not_set_a_base_owned_section(self) -> None:
         with self.assertRaises(SpecAugmentationError) as ctx:
```

---

### Incident Patch 12: `9f7b5fb8` (2026-08-31)
**Commit Message**: fix: apply the character template and the augmentation independently

The two blocks were joined by an elif, so a character run handed an augmentation file silently skipped apply_character_template: the emitted spec lost rig entirely and still exited 0 (PR review finding 4). The template now authors the track's content first and the guarded merge layers plugin sections on top; the regression test pins both contributions from both sides.

**File**: `forge/stage2_spec/new_sculpt_spec.py` (modified, +11/-5)
```diff
@@ -1935,6 +1935,17 @@ def main(argv: list[str]) -> int:
     # here. With none installed the spec keeps the skeleton this pipeline authored and the agent
     # infers the shape from the reference, which is what a run without a domain plugin has always
     # done for any other object.
+    # The template and the augmentation are independent contributions, applied in that order: the
+    # template authors the track's own spec content (componentTree, rig, buildPasses), and the
+    # guarded merge then layers plugin sections on the completed spec. These two used to be joined
+    # by an `elif`, which meant any run handed an augmentation file silently skipped the character
+    # template -- the emitted spec lost `rig` entirely and still exited 0 (PR #106 review, finding
+    # 4: "apply_character_template never runs. Exit 0, plausible-looking spec.").
+    if routing is not None and routing["track"] == "character-v1.5":
+        anatomy = None
+        if isinstance(assessment, dict) and isinstance(assessment.get("preSpecAssessment"), dict):
+            anatomy = assessment["preSpecAssessment"].get("anatomy")
+        apply_character_template(spec, anatomy, include_accessories=args.accessories)
     if args.augmentation is not None and args.augmentation.expanduser().is_file():
         try:
             artifact = json.loads(args.augmentation.expanduser().read_text(encoding="utf-8"))
@@ -1943,11 +1954,6 @@ def main(argv: list[str]) -> int:
             parser.error(f"cannot read spec augmentation {args.augmentation}: {exc}")
         except SpecAugmentationError as exc:
             parser.error(str(exc))
-    elif routing is not None and routing["track"] == "character-v1.5":
-        anatomy = None
-        if isinstance(assessment, dict) and isinstance(assessment.get("preSpecAssessment"), dict):
-            anatomy = assessment["preSpecAssessment"].get("anatomy")
-        apply_character_template(spec, anatomy, include_accessories=args.accessories)
     payload = json.dumps(spec, indent=2, ensure_ascii=False) + "\n"
 
     if args.out:
```

**File**: `forge/tests/test_pipeline.py` (modified, +25/-0)
```diff
@@ -864,6 +864,31 @@ def test_character_factory_generates(self):
         self.assertIn("createPersonModel", ts)
         self.assertIn('meshes["head"]', ts)
 
+    def test_character_template_survives_an_augmentation_file(self):
+        """Both contributions apply; neither silences the other.
+
+        These two blocks used to be joined by an `elif`: a character run handed an augmentation
+        file skipped `apply_character_template` entirely, so the emitted spec lost `rig` and still
+        exited 0 -- the silent data loss PR #106's review demonstrated by diffing the same
+        assessment run with and without an augmentation. This pins the fix from both sides.
+        """
+        aug = self.dir / "spec-augmentation.json"
+        aug.write_text(
+            json.dumps(
+                {
+                    "kind": "spec-augmentation-v1",
+                    "provenance": {"provider": "fixture", "version": "0.0.1"},
+                    "specSections": {"fixtureSection": {"marker": True}},
+                }
+            ),
+            encoding="utf-8",
+        )
+        run("stage2_spec/new_sculpt_spec.py", "Person", "--character", "--augmentation", aug, "--out", self.spec)
+        spec = json.loads(self.spec.read_text())
+        self.assertIn("rig", spec, "the character template was skipped: `rig` is missing")
+        self.assertIn("fixtureSection", spec, "the augmentation merge was skipped")
+        self.assertEqual(spec["specAugmentation"]["provider"], "fixture")
+
     def test_cs2_track_skipped_for_objects(self):
         run("stage2_spec/new_sculpt_spec.py", "Crate", "--out", self.spec)
         spec = json.loads(self.spec.read_text())
```

**File**: `forge/tests/test_suite_integrity.py` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@
 # registry layout instead of assumed from a name match) added 2 tests -- a plugin whose package
 # name differs from its domain id, and an in-repo domain's profile correctly attributing no
 # installed plugin as its owner.
-COLLECTED_FLOOR = 1184
+COLLECTED_FLOOR = 1185
 
 
 REPO_ROOT = TESTS_DIR.parents[1]
```

---

### Incident Patch 13: `dee8da08` (2026-08-31)
**Commit Message**: fix: make the registry tests hermetic instead of machine-dependent

The two registry tests and the cs2 splice-order test passed only on machines with the cs2 plugin installed under ~/.img2 -- the CI-red machine-global dependency named in review. Both registry sources now prove themselves against a disposable IMG2_HOME, the collision test collides with the in-repo domain, and the splice-order test drives a fixture plugin domain through the real registry.

**File**: `forge/tests/test_domain_registry.py` (modified, +47/-9)
```diff
@@ -6,7 +6,11 @@
 
 from __future__ import annotations
 
+import contextlib
+import json
+import os
 import sys
+import tempfile
 import textwrap
 import unittest
 from pathlib import Path
@@ -31,9 +35,15 @@ def test_the_base_pipeline_names_no_domain(self) -> None:
     def test_generic_resolves_to_no_domain(self) -> None:
         self.assertIsNone(domain_profile("generic"))
 
-    def test_both_in_repo_domains_are_registered(self) -> None:
-        # Two consumers, one of them destined to leave the repo. A seam with one consumer is a rename.
-        self.assertEqual(sorted(registered_domains()), ["character", "cs2"])
+    def test_both_registry_sources_register_hermetically(self) -> None:
+        # A seam with one consumer is a rename, so both sources are exercised: the in-repo module,
+        # and an installed plugin's domain.json. Neither half may depend on what this machine
+        # happens to have under ~/.img2 -- the old form of this test asserted the INSTALLED cs2
+        # plugin and was green or red depending on the machine, which is what turned CI red.
+        with self._temp_img2_home({}):
+            self.assertEqual(sorted(registered_domains()), ["character"])
+        with self._temp_img2_home({"fixture-plugin": {"id": "fixture-dom"}}):
+            self.assertEqual(sorted(registered_domains()), ["character", "fixture-dom"])
 
     def test_an_unregistered_profile_fails_loud_and_names_what_is_available(self) -> None:
         with self.assertRaises(DomainRegistryError) as ctx:
@@ -77,14 +87,42 @@ def test_steps_without_an_anchor_are_refused(self) -> None:
         self.assertIn("passAnchorBefore", str(ctx.exception))
 
     def test_two_providers_claiming_one_id_is_ambiguous(self) -> None:
-        with self.assertRaises(DomainRegistryError) as ctx:
-            self._with_temp_domain(
-                "dupe",
-                'DOMAIN = {"id": "cs2"}',
-                registered_domains,
-            )
+        # Collides with the in-repo `character` module rather than an installed plugin, so the
+        # refusal is provable on a machine with nothing installed. IMG2_HOME is pinned empty for
+        # the same reason: a real installation must not be able to add a second collision path.
+        with self._temp_img2_home({}):
+            with self.assertRaises(DomainRegistryError) as ctx:
+                self._with_temp_domain(
+                    "dupe",
+                    'DOMAIN = {"id": "character"}',
+                    registered_domains,
+                )
         self.assertIn("declared twice", str(ctx.exception))
 
+    @contextlib.contextmanager
+    def _temp_img2_home(self, plugins: dict[str, dict]):
+        """A disposable $IMG2_HOME holding exactly `plugins` ({registry_id: domain_entry})."""
+        with tempfile.TemporaryDirectory() as tmp:
+            home = Path(tmp)
+            rows = []
+            for registry_id, domain_entry in plugins.items():
+                rows.append({"id": registry_id})
+                plugin_dir = home / "plugins" / registry_id
+                plugin_dir.mkdir(parents=True)
+                (plugin_dir / "domain.json").write_text(json.dumps(domain_entry), encoding="utf-8")
+            (home / "plugins.json").write_text(
+                json.dumps({"version": 1, "plugins": rows}), encoding="utf-8"
+            )
+            prior = os.environ.get("IMG2_HOME")
+            os.environ["IMG2_HOME"] = str(home)
+            try:
+                yield home
+            finally:
+                if prior is None:
+                    os.environ.pop("IMG2_HOME", None)
+                else:
+                    os.environ["IMG2_HOME"] = prior
+
     def _with_temp_domain(self, stem: str, body: str, action):
         """Drop a domain module into the package for one assertion, then remove it."""
         path = Path(domains.__file__).resolve().parent / f"zz_{stem}.py"
```

**File**: `forge/tests/test_workflow_state.py` (modified, +49/-7)
```diff
@@ -1,6 +1,8 @@
 from __future__ import annotations
 
 import json
+import os
+import shutil
 import subprocess
 import sys
 import tempfile
@@ -55,14 +57,54 @@ def test_material_reference_wiring_is_in_the_setup_checklist(self):
         self.assertLess(ids.index("material-evidence"), ids.index("material-spec-wiring"))
         self.assertLess(ids.index("material-spec-wiring"), ids.index("strict-validation"))
 
-    def test_cs2_state_includes_classification_and_manifest_before_pre_spec(self):
-        state = new_state("knife.png", profile="cs2")
+    def test_plugin_domain_steps_splice_before_their_anchors(self):
+        """A plugin-contributed domain drives the checklist through the registry, hermetically.
+
+        This test used to build a `cs2` state and passed only on machines where the cs2 plugin
+        happened to be installed under ~/.img2 -- the machine-global dependency that turned CI
+        red. It now installs a fixture plugin (mirroring cs2's `domain.json` shape: setup steps
+        anchored before `local-spec-search`, one pass step anchored before `ai-review-recorded`)
+        into a disposable $IMG2_HOME and asserts the same splice-order semantics.
+        """
+        domain_entry = {
+            "id": "fixture-dom",
+            "setupSteps": [
+                ["fx-contract-read", "Read {plugin_dir}/grimoire/contract.md completely"],
+                ["fx-classification", "Obtain an authoritative fixture classification record"],
+                ["fx-manifest", "python3 {plugin_dir}/tools/manifest.py {reference} --out fx.json"],
+            ],
+            "setupAnchorBefore": "local-spec-search",
+            "passSteps": [
+                ["fx-review", "python3 {plugin_dir}/tools/review.py --spec {spec} --out fx-review.json"]
+            ],
+            "passAnchorBefore": "ai-review-recorded",
+        }
+        home = Path(tempfile.mkdtemp(prefix="img2-home-"))
+        self.addCleanup(shutil.rmtree, home, True)
+        plugin_dir = home / "plugins" / "fixture-plugin"
+        plugin_dir.mkdir(parents=True)
+        (plugin_dir / "domain.json").write_text(json.dumps(domain_entry), encoding="utf-8")
+        (home / "plugins.json").write_text(
+            json.dumps({"version": 1, "plugins": [{"id": "fixture-plugin"}]}), encoding="utf-8"
+        )
+        prior = os.environ.get("IMG2_HOME")
+        os.environ["IMG2_HOME"] = str(home)
+        try:
+            state = new_state("fixture.png", profile="fixture-dom")
+        finally:
+            if prior is None:
+                os.environ.pop("IMG2_HOME", None)
+            else:
+                os.environ["IMG2_HOME"] = prior
         ids = [entry["id"] for entry in state["checklist"]]
-        self.assertLess(ids.index("cs2-contract-read"), ids.index("cs2-authoritative-classification"))
-        self.assertLess(ids.index("cs2-authoritative-classification"), ids.index("pre-spec-assessment"))
-        self.assertLess(ids.index("cs2-manifest"), ids.index("pre-spec-assessment"))
-        self.assertLess(ids.index("pass-gate-check"), ids.index("cs2-review"))
-        self.assertLess(ids.index("cs2-review"), ids.index("ai-review-recorded"))
+        self.assertLess(ids.index("fx-contract-read"), ids.index("fx-classification"))
+        self.assertLess(ids.index("fx-classification"), ids.index("fx-manifest"))
+        self.assertLess(ids.index("fx-manifest"), ids.index("local-spec-search"))
+        self.assertLess(ids.index("local-spec-search"), ids.index("pre-spec-assessment"))
+        self.assertLess(ids.index("pass-gate-check"), ids.index("fx-review"))
+        self.assertLess(ids.index("fx-review"), ids.index("ai-review-recorded"))
+        by_id = {entry["id"]: entry for entry in state["checklist"]}
+        self.assertIn(str(plugin_dir), by_id["fx-manifest"]["command"])
 
     def test_character_state_requires_contract_landmarks_and_route_decision(self):
         state = new_state("character.png", profile="character")
```

---

### Incident Patch 14: `1df8b892` (2026-08-25)
**Commit Message**: fix: remove unused file

**File**: `.gitignore` (modified, +25/-0)
```diff
@@ -69,3 +69,28 @@ docs/prompts/
 # session ids, which must never reach the public skill.
 docs/WS_*_HANDOVER_*.md
 docs/PR_DISTILLED.md
+
+# A run invoked from the repo root, rather than from work/ or .screenshot/, drops its artifacts here
+# instead of inside a directory the rules above already cover -- so the same class of file escapes
+# every one of them. These are the names the pipeline writes at the working root: reference crops,
+# per-pass renders and comparison sheets, the de-lighting pair, the intake/assessment/spec JSONs, the
+# detail-inventory and material-evidence sheets, and the generated factory. All outputs, never inputs.
+# Root-anchored so a legitimately committed file deeper in the tree is unaffected.
+/reference_*.png
+/render_*.png
+/comparison_*.png
+/delight_*.png
+/delight_report*.json
+/admission.json
+/assessment.json
+/probe.json
+/di.json
+/object-sculpt-spec.json
+/reference-camera.json
+/detail-inventory/
+/material-evidence/
+/src/
+
+# Written by the harness when it points a checkout at a temp core: one line holding an absolute path
+# under /var/folders, dead the moment that temp dir is reaped. Machine-local by construction.
+/_img2_local.py
```

**File**: `_img2_local.py` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-CORE = "/var/folders/1g/p8cr1jz96xd483mz315j6d580000gn/T/tmp.DWITAft9Zt/fh/.img2/harness"
```

**File**: `admission.json` (removed, +0/-14)
```diff
@@ -1,14 +0,0 @@
-{
-  "admitted": true,
-  "reasons": [],
-  "provenance": {
-    "viewpoint": "reference",
-    "sourcePath": "/Users/tamlh/workspaces/self/AI/img2threejs-org/img2threejs-lab/reference_ak47_wild_lotus_left.png",
-    "width": 2560,
-    "height": 1440,
-    "foregroundCoverage": 0.1553,
-    "largestComponentFraction": 1.0,
-    "pHash": 16810785446231851233,
-    "duplicateOfHash": null
-  }
-}
```

**File**: `assessment.json` (removed, +0/-217)
```diff
@@ -1,217 +0,0 @@
-{
-  "targetName": "AK-47 Wild Lotus",
-  "sourceImage": "reference_ak47_wild_lotus_left.png",
-  "preSpecAssessment": {
-    "objectClass": {
-      "primaryType": "firearm",
-      "primaryDomain": "object",
-      "formLanguage": ["geometric", "mechanical"],
-      "structureKind": ["rigid-assembly", "multi-component"],
-      "motionPotential": ["removable-magazine", "bolt-action"],
-      "materialFamilies": ["painted-metal", "blued-steel", "gold-accent"],
-      "notes": "CS2 AK-47 assault rifle with Wild Lotus skin. Bilateral symmetry on base weapon; asymmetric painted floral pattern on both sides. Both left and right reference views provided."
-    },
-    "complexity": {
-      "tier": "complex",
-      "scores": {
-        "silhouetteComplexity": 7,
-        "componentCount": 8,
-        "hierarchyDepth": 3,
-        "repetitionDensity": 2,
-        "materialLayerCount": 5,
-        "localDetailDensity": 8,
-        "occlusionRisk": 3,
-        "actionReadinessNeed": 6
-      },
-      "estimatedCounts": {
-        "macroComponents": 6,
-        "mesoComponents": 12,
-        "microFeatureGroups": 5,
-        "materialLayers": 5,
-        "repetitionSystems": 2
-      },
-      "reasoning": [
-        "AK-47 has well-defined macro components (stock, receiver, handguard, barrel, magazine, grip) with 12+ meso sub-assemblies (sights, gas tube, bolt handle, trigger, bands).",
-        "Wild Lotus skin adds high local detail density — multi-color floral pattern with identity-defining flowers, vines, berries across all surfaces.",
-        "Gold/bronze accent stripes are critical identity features requiring local material overrides.",
-        "Complexity is moderate-high due to component count but mitigated by rigid, non-organic forms (stamped metal, straight barrel).",
-        "The painted skin surface is the primary fidelity challenge — projection-first route is mandatory."
-      ]
-    },
-    "specDepthDecision": {
-      "requiredDepth": "complex",
-      "minimumComponentLevels": ["macro", "meso", "micro"],
-      "needsRepetitionSystems": true,
-      "needsMaterialLocalOverrides": true,
-      "needsMultipleReviewViews": true,
-      "needsActionReadyHierarchy": true,
-      "rationale": "AK-47 has a clear multi-level hierarchy with 6 macro, 12+ meso components. The Wild Lotus skin requires material local overrides on every surface. Both side views require multi-view review."
-    },
-    "unknownsToResolveBeforeImplementation": [
-      "Top receiver surface detail (dust cover ridges, rear sight leaf) — occluded in side views",
-      "Muzzle crown detail — front sight visible but muzzle end unclear",
-      "Magazine base plate underside — partially visible",
-      "Exact floral pattern continuity between left and right sides"
-    ],
-    "detailInventory": {
-      "scanMethod": "component-zones",
-      "targetMinDetails": 12,
-      "note": "Enumerate every identity-defining small detail. Each detail must map to component.localFeatures or material.localOverrides.",
-      "details": []
-    },
-    "anatomy": {
-      "applies": false,
-      "styleHeads": 0.0,
-      "proportions": {"headUnit": 0.0, "torso": 0.0, "legs": 0.0, "shoulderWidth": 0.0, "hipWidth": 0.0},
-      "pose": {"type": "unassessed", "jointAngles": {}},
-      "faceLandmarks": {"eyeLine": 0.0, "eyeSpacing": 0.0, "noseBase": 0.0, "mouthLine": 0.0, "hairline": 0.0},
-      "features": [],
-      "confidence": 0.0,
-      "note": "Not applicable — object, not character."
-    },
-    "sourceImage": "reference_ak47_wild_lotus_left.png"
-  },
-  "qualityContract": {
-    "qualityBar": "complex",
-    "definitionOfDone": [
-      "The rendered model matches the AK-47 reference silhouette, proportions, component hierarchy, material response, and the Wild Lotus floral pattern across both sides.",
-      "Gold/bronze accent stripes and critical floral features (large red lotus, pink flowers, green vines) are identifiable.",
-      "The model is explodable and clickable with proper part hierarchy."
-    ],
-    "minimumSpecDepth": {
-      "macroComponents": 6,
-      "mesoComponents": 12,
-      "microFeatureGroups": 5,
-      "materialLayers": 5,
-      "repetitionSystems": 2,
-      "reviewViewpoints": 3
-    },
-    "featureGroups": [
-      {
-        "id": "overall-silhouette",
-        "name": "AK-47 silhouette and proportions",
-        "required": true,
-        "qualityCriteria": [
-          "Correct 8:1 length-to-height ratio",
-          "Curved banana magazine profile",
-          "Triangular stock with grip junction",
-          "Straight barrel with gas tube above"
-        ],
-        "evidenceRefs": ["reference_ak47_wild_lotus_left.png", "reference_ak47_wild_lotus_right.png"],
-        "failureModes": [
-          "Model reads as generic rifle instead of AK-47",
-          "Magazine curvature wrong",
-          "Stock proportions off"
-        ]
-      },
-      {
-        "id": "primary-s
```

**File**: `delight_report.json` (removed, +0/-26)
```diff
@@ -1,26 +0,0 @@
-{
-  "delightReference": {
-    "version": "1.0",
-    "sourceImage": "/Users/tamlh/workspaces/self/AI/img2threejs-org/img2threejs-lab/reference_ak47_wild_lotus_left.png",
-    "outputImage": "/Users/tamlh/workspaces/self/AI/img2threejs-org/img2threejs-lab/delight_albedo.png",
-    "method": "per-pixel normalization against a box-blurred luminance proxy; an approximation of de-lighting, not physically based inverse rendering or true light/albedo separation",
-    "strength": 0.6,
-    "confidence": 0.64,
-    "stats": {
-      "targetLuma": 0.0,
-      "blurRadius": 48,
-      "lumaRangeBefore": 0.2656,
-      "meanCorrectionScale": 0.4,
-      "maxCorrectionScale": 0.4,
-      "minCorrectionScale": 0.4
-    },
-    "limitations": [
-      "this is an approximation, not true inverse rendering; it cannot recover ground-truth albedo",
-      "sharp specular highlights and hard shadow edges narrower than the blur radius will remain baked in",
-      "deep occlusion shadows (creases, undercuts) are only partially lifted",
-      "must be reviewed visually next to the source image before use as a projection albedo",
-      "single-image de-lighting cannot separate true albedo from baked light/AO/specular; confidence is capped"
-    ],
-    "note": "If shadows or highlights are still visible in the output, try a larger --strength or a smaller --blur-radius so the correction responds to tighter lighting gradients, then re-review; this script does not know when the correction is visually sufficient."
-  }
-}
```

**File**: `delight_report_right.json` (removed, +0/-26)
```diff
@@ -1,26 +0,0 @@
-{
-  "delightReference": {
-    "version": "1.0",
-    "sourceImage": "/Users/tamlh/workspaces/self/AI/img2threejs-org/img2threejs-lab/reference_ak47_wild_lotus_right.png",
-    "outputImage": "/Users/tamlh/workspaces/self/AI/img2threejs-org/img2threejs-lab/delight_albedo_right.png",
-    "method": "per-pixel normalization against a box-blurred luminance proxy; an approximation of de-lighting, not physically based inverse rendering or true light/albedo separation",
-    "strength": 0.6,
-    "confidence": 0.64,
-    "stats": {
-      "targetLuma": 0.0,
-      "blurRadius": 48,
-      "lumaRangeBefore": 0.2691,
-      "meanCorrectionScale": 0.4,
-      "maxCorrectionScale": 0.4,
-      "minCorrectionScale": 0.4
-    },
-    "limitations": [
-      "this is an approximation, not true inverse rendering; it cannot recover ground-truth albedo",
-      "sharp specular highlights and hard shadow edges narrower than the blur radius will remain baked in",
-      "deep occlusion shadows (creases, undercuts) are only partially lifted",
-      "must be reviewed visually next to the source image before use as a projection albedo",
-      "single-image de-lighting cannot separate true albedo from baked light/AO/specular; confidence is capped"
-    ],
-    "note": "If shadows or highlights are still visible in the output, try a larger --strength or a smaller --blur-radius so the correction responds to tighter lighting gradients, then re-review; this script does not know when the correction is visually sufficient."
-  }
-}
```

**File**: `di.json` (removed, +0/-165)
```diff
@@ -1,165 +0,0 @@
-{
-  "sourceImage": "/Users/tamlh/workspaces/self/AI/img2threejs-org/img2threejs-lab/reference_ak47_wild_lotus_left.png",
-  "zonesDir": "/Users/tamlh/workspaces/self/AI/img2threejs-org/img2threejs-lab/detail-inventory",
-  "detailInventory": {
-    "scanMethod": "grid-3x3",
-    "targetMinDetails": 12,
-    "details": [
-      {
-        "id": "stock-rear",
-        "kind": "floral-pattern",
-        "description": "Large pink/magenta lily flower with dark green leaves on the stock butt area. Flower has 6+ petals with visible stamen. Dark brown vine tendrils extend from flower.",
-        "region": {"x": 0.0, "y": 0.0, "width": 0.2, "height": 0.6, "units": "normalized"},
-        "scale": "large",
-        "affects": "stock",
-        "mapsTo": {"type": "component.localFeatures", "ref": "stock.floralLily"},
-        "evidenceRef": "/Users/tamlh/workspaces/self/AI/img2threejs-org/img2threejs-lab/detail-inventory/zone-r0c0.png",
-        "confidence": 0.95
-      },
-      {
-        "id": "stock-gold-band",
-        "kind": "accent-stripe",
-        "description": "Curved gold/bronze band running diagonally across stock. Metallic finish, warm bronze color (#C8944A). Connects receiver area to stock butt.",
-        "region": {"x": 0.1, "y": 0.3, "width": 0.15, "height": 0.3, "units": "normalized"},
-        "scale": "medium",
-        "affects": "stock",
-        "mapsTo": {"type": "material.localOverrides", "ref": "stock.goldBand"},
-        "evidenceRef": "/Users/tamlh/workspaces/self/AI/img2threejs-org/img2threejs-lab/detail-inventory/zone-r0c0.png",
-        "confidence": 0.95
-      },
-      {
-        "id": "receiver-large-lotus",
-        "kind": "floral-pattern",
-        "description": "Dominant large red/crimson lotus flower centered on receiver/stock junction area. Multi-layered petals with visible center detail. This is the primary identity feature of the Wild Lotus skin.",
-        "region": {"x": 0.25, "y": 0.2, "width": 0.2, "height": 0.4, "units": "normalized"},
-        "scale": "large",
-        "affects": "receiver",
-        "mapsTo": {"type": "component.localFeatures", "ref": "receiver.largeLotus"},
-        "evidenceRef": "/Users/tamlh/workspaces/self/AI/img2threejs-org/img2threejs-lab/detail-inventory/zone-r0c1.png",
-        "confidence": 0.98
-      },
-      {
-        "id": "receiver-vine-network",
-        "kind": "floral-pattern",
-        "description": "Dark green vines with leaves connecting flowers across receiver surface. Vines have small thorns/texture. Leaf shapes are elongated with visible veining.",
-        "region": {"x": 0.2, "y": 0.15, "width": 0.4, "height": 0.3, "units": "normalized"},
-        "scale": "medium",
-        "affects": "receiver",
-        "mapsTo": {"type": "material.localOverrides", "ref": "receiver.vinePattern"},
-        "evidenceRef": "/Users/tamlh/workspaces/self/AI/img2threejs-org/img2threejs-lab/detail-inventory/zone-r0c1.png",
-        "confidence": 0.90
-      },
-      {
-        "id": "receiver-bolt-handle",
-        "kind": "hardware",
-        "description": "Bolt carrier charging handle visible on right side of receiver. Dark blued metal, cylindrical knob. Positioned in bolt track slot.",
-        "region": {"x": 0.35, "y": 0.1, "width": 0.08, "height": 0.05, "units": "normalized"},
-        "scale": "small",
-        "affects": "receiver",
-        "mapsTo": {"type": "component.localFeatures", "ref": "receiver.boltHandle"},
-        "evidenceRef": "/Users/tamlh/workspaces/self/AI/img2threejs-org/img2threejs-lab/detail-inventory/zone-r0c2.png",
-        "confidence": 0.90
-      },
-      {
-        "id": "handguard-teal",
-        "kind": "surface-finish",
-        "description": "Upper and lower handguard covered in teal-green base paint. Floral pattern with smaller pink flower visible. Gas tube above in matching teal.",
-        "region": {"x": 0.4, "y": 0.1, "width": 0.25, "height": 0.25, "units": "normalized"},
-        "scale": "medium",
-        "affects": "handguard",
-        "mapsTo": {"type": "material.localOverrides", "ref": "handguard.tealFloral"},
-        "evidenceRef": "/Users/tamlh/workspaces/self/AI/img2threejs-org/img2threejs-lab/detail-inventory/zone-r0c2.png",
-        "confidence": 0.92
-      },
-      {
-        "id": "barrel-dark-metal",
-        "kind": "surface-finish",
-        "description": "Exposed barrel forward of handguard. Dark blued/parkerized steel. Matte dark grey-black finish contrasting with teal painted surfaces.",
-        "region": {"x": 0.65, "y": 0.1, "width": 0.2, "height": 0.08, "units": "normalized"},
-        "scale": "small",
-        "affects": "barrel",
-        "mapsTo": {"type": "material.localOverrides", "ref": "barrel.darkMetal"},
-        "evidenceRef": "/Users/tamlh/workspaces/self/AI/img2threejs-org/img2threejs-lab/detail-inventory/zone-r0c2.png",
-        "confidence": 0.95
-      },
-      {
-        "id": "front-sight",
-        "kind": "hardware",
-      
```

**File**: `object-sculpt-spec.json` (removed, +0/-2580)
```diff
@@ -1,2580 +0,0 @@
-{
-  "targetName": "AK-47 Wild Lotus",
-  "targetId": "ak-47-wild-lotus",
-  "schemaVersion": "2.1",
-  "sourceImage": "reference_ak47_wild_lotus_left.png",
-  "referenceCamera": {
-    "solved": true,
-    "fovDegrees": 35.0,
-    "aspect": 1.7778,
-    "orientation": {
-      "yaw": 0.0,
-      "pitch": 0.0,
-      "roll": 0.0
-    },
-    "positionHint": [
-      0.0,
-      0.0,
-      2.5
-    ],
-    "note": "Heuristic default; refine by overlay review."
-  },
-  "suitability": "pass",
-  "scores": {
-    "object_isolation": 3,
-    "silhouette_readability": 3,
-    "depth_inference": 2,
-    "primitive_decomposition": 3,
-    "material_procedurality": 2,
-    "occlusion_risk": 1,
-    "interaction_fit": 2
-  },
-  "silhouette": {
-    "boundingShape": "elongated rectangle, ~8:1 length-to-height",
-    "aspectRatios": [
-      "8:1 length-to-height",
-      "3:1 receiver-to-magazine height"
-    ],
-    "symmetry": "bilateral base weapon, asymmetric pattern",
-    "dominantCurves": [
-      "banana magazine arc",
-      "stock triangular profile",
-      "straight barrel line"
-    ],
-    "negativeSpaces": [
-      "gap between magazine and grip",
-      "trigger guard loop",
-      "gas tube barrel gap"
-    ],
-    "landmarks": [
-      "muzzle tip",
-      "front sight post",
-      "rear sight",
-      "receiver-magazine junction",
-      "stock butt",
-      "trigger guard apex"
-    ]
-  },
-  "preSpecAssessment": {
-    "objectClass": {
-      "primaryType": "firearm",
-      "primaryDomain": "object",
-      "formLanguage": [
-        "geometric",
-        "mechanical"
-      ],
-      "structureKind": [
-        "rigid-assembly",
-        "multi-component"
-      ],
-      "motionPotential": [
-        "removable-magazine",
-        "bolt-action"
-      ],
-      "materialFamilies": [
-        "painted-metal",
-        "blued-steel",
-        "gold-accent"
-      ],
-      "notes": "CS2 AK-47 with Wild Lotus skin. Both left+right views provided."
-    },
-    "complexity": {
-      "tier": "complex",
-      "scores": {
-        "silhouetteComplexity": 2,
-        "componentCount": 2,
-        "hierarchyDepth": 2,
-        "repetitionDensity": 1,
-        "materialLayerCount": 2,
-        "localDetailDensity": 3,
-        "occlusionRisk": 1,
-        "actionReadinessNeed": 2
-      },
-      "estimatedCounts": {
-        "macroComponents": 6,
-        "mesoComponents": 12,
-        "microFeatureGroups": 5,
-        "materialLayers": 5
-      }
-    },
-    "specDepthDecision": {
-      "requiredDepth": "complex",
-      "minimumComponentLevels": [
-        "macro",
-        "meso",
-        "micro"
-      ],
-      "needsRepetitionSystems": true,
-      "needsMaterialLocalOverrides": true,
-      "needsMultipleReviewViews": true,
-      "needsActionReadyHierarchy": true
-    }
-  },
-  "qualityContract": {
-    "qualityBar": "complex",
-    "definitionOfDone": [
-      "AK-47 silhouette and proportions match reference",
-      "Wild Lotus floral pattern visible via projected texture",
-      "Gold accent stripes, dark metal barrel, and sight hardware present",
-      "Model explodable and clickable"
-    ],
-    "minimumSpecDepth": {
-      "macroComponents": 6,
-      "mesoComponents": 5,
-      "microFeatureGroups": 5,
-      "materialLayers": 3,
-      "repetitionSystems": 0,
-      "reviewViewpoints": 2
-    },
-    "featureGroups": [
-      {
-        "id": "silhouette",
-        "name": "AK-47 silhouette and proportions",
-        "required": true,
-        "qualityCriteria": [
-          "Correct 8:1 ratio, curved magazine, triangular stock"
-        ],
-        "evidenceRefs": [
-          "full-object"
-        ],
-        "failureModes": [
-          "generic rifle silhouette",
-          "wrong proportions"
-        ]
-      },
-      {
-        "id": "structure",
-        "name": "Component hierarchy",
-        "required": true,
-        "qualityCriteria": [
-          "6 macro, 12+ meso components separated"
-        ],
-        "evidenceRefs": [
-          "full-object"
-        ],
-        "failureModes": [
-          "merged parts",
-          "shallow hierarchy"
-        ]
-      },
-      {
-        "id": "pattern",
-        "name": "Wild Lotus pattern",
-        "required": true,
-        "qualityCriteria": [
-          "Teal base, red lotus, pink flowers, green vines, gold bands"
-        ],
-        "evidenceRefs": [
-          "full-object"
-        ],
-        "failureModes": [
-          "wrong base color",
-          "missing lotus",
-          "procedural instead of projection"
-        ]
-      }
-    ]
-  },
-  "featureReviewTargets": [
-    {
-      "id": "silhouette",
-      "name": "Overall silhouette and proportion system",
-      "tier": "critical",
-      "passIds": [
-        "blockout"
-      ],
-      "minimumScore": 0.8,
-      "mustPass": true,
-      "componentRefs": [
-        "root"
-      ],
-      "evidenceRefs": [
-        "full
```

---

### Incident Patch 15: `766dda4e` (2026-08-24)
**Commit Message**: perf: cache the suite-integrity discovery and raise the floor

Each assertion spawned its own discovery subprocess, and that subprocess imports
every test module, so the two of them cost ~45s of the suite's wall clock for an
identical answer. Measured: 170.7s with two, 141.9s with one. Verified the guard
still fails on both assertions, together and individually, with the cache in
place.

Floor raised 1124 -> 1134 for the tests added by the domain registry work.

**File**: `forge/tests/test_suite_integrity.py` (modified, +5/-1)
```diff
@@ -17,13 +17,14 @@
 import subprocess
 import sys
 import unittest
+from functools import lru_cache
 from pathlib import Path
 
 TESTS_DIR = Path(__file__).resolve().parent
 
 # Raise this deliberately when tests are added; never lower it to make a red suite green. A drop
 # means tests stopped being collected, which is the failure this file exists to catch.
-COLLECTED_FLOOR = 1124
+COLLECTED_FLOOR = 1134
 
 
 REPO_ROOT = TESTS_DIR.parents[1]
@@ -51,7 +52,10 @@ def leaves(s):
 """
 
 
+@lru_cache(maxsize=1)
 def _discover() -> dict:
+    # Cached: the subprocess imports every test module, so calling it once per assertion cost ~22s
+    # of the suite's wall clock for an identical answer.
     proc = subprocess.run(
         [sys.executable, "-c", _PROBE],
         cwd=REPO_ROOT,
```

#### Recent Merged Pull Requests:
- **PR #147** (closed): docs(readme): dedupe pipeline blurb, fix broken rig/hair scripts table (@bhj95224-sudo)
- **PR #146** (2026-10-05): feat: img2threejs CLI package (npx img2threejs install) (@kokorolx)
- **PR #132** (2026-09-06): docs(skill): document the img2 harness in SKILL.md (@kokorolx)
- **PR #130** (2026-09-05): Lab/cs2 plugin (@kokorolx)
- **PR #117** (2026-09-03): 1.5.2: animation pipeline (@hoainho)
- **PR #115** (closed): feat: add Han Huan-Shou Dao reconstruction (@abyssalyanbin)
- **PR #114** (2026-08-29): chore: swap Buy Me a Coffee for Ko-fi (@hoainho)
- **PR #113** (closed): feat: gate model space and non-humanoid animation (@kimurakoki)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
