# Forensic Learning Record (Deep Inspection): apache/shardingsphere

> **Canonical Artifact**: `07_PROJECT_LEARNING/apache-shardingsphere-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/apache/shardingsphere](https://github.com/apache/shardingsphere))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:26:11.904Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `apache/shardingsphere`
- **Description**: Empowering Data Intelligence with Distributed SQL for Sharding, Scalability, and Security Across All Databases.
- **Primary Language / Ecosystem**: Java
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 20805 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.codex/harness/agents/code_handoff_hook.py`
```
#!/usr/bin/env python3

# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Require an explicit review handoff after Codex changes implementation files."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from typing import Any

PROSE_SUFFIXES = frozenset({".adoc", ".md", ".rst"})
PATCH_FILE_PATTERN = re.compile(r"^\*\*\* (?:Add|Delete|Update) File: (.+)$", re.MULTILINE)
FIELD_PATTERN = r"^[ \t]*(?:[-*][ \t]+)?(?:#{{1,6}}[ \t]+)?(?:\*\*)?{label}:[ \t]*(.*?)(?:\*\*)?[ \t]*$"
BOLD_FIELD_PATTERN = r"^[ \t]*(?:[-*][ \t]+)?\*\*{label}:[ \t]*(.*?)\*\*[ \t]*$"
FORMAL_REVIEW_PATTERN = re.compile(r"^```markdown\s*$\n(.*?)^```\s*$", re.IGNORECASE | re.MULTILINE | re.DOTALL)
TEXT_BLOCK_PATTERN = re.compile(r"^```text\s*$\n(.*?)^```\s*$", re.IGNORECASE | re.MULTILINE | re.DOTALL)
SHELL_TOOL_NAMES = frozenset({"Bash", "exec_command", "write_stdin"})
PASSING_RESULT = "Mergeable"
PAUSED_RESULTS = frozenset({"Not Mergeable", "Review Incomplete"})
REQUIRED_COMMIT_COMMANDS = ("git commit --dry-run --only", "git commit --only")


def process_event(event: dict[str, Any], state_directory: Path) -> dict[str, str]:
    """Process one Codex hook event."""
    event_name = event.get("hook_event_name")
    if "PreToolUse" == event_name:
        _record_pre_tool_state(event, state_directory)
        return {}
    if "PostToolUse" == event_name:
        _record_implementation_change(event, state_directory)
        return {}
    if "Stop" != event_name:
        return {}
    marker_path = _marker_path(event, state_directory)
    if not marker_path.exists():
        return {}
    message = event.get("last_assistant_message")
    passing_failures = validate_handoff(message)
    if not passing_failures:
        marker_path.unlink()
        return {}
    paused_failures = validate_paused_handoff(message)
    if not paused_failures:
        return {}
    return {"decision": "block", "reason": _continuation_reason(passing_failures, paused_failures)}


def _record_pre_tool_state(event: dict[str, Any], state_directory: Path) -> None:
    if event.get("tool_name") not in SHELL_TOOL_NAMES:
        return
    snapshot_path = _snapshot_path(event, state_directory)
    snapshot_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    snapshot = _repository_snapshot(event)
    snapshot_path.write_text(json.dumps(snapshot, sort_keys=True), encoding="utf-8")


def _record_implementation_change(event: dict[str, Any], state_directory: Path) -> None:
    tool_name = event.get("tool_name")
    if tool_name in SHELL_TOOL_NAMES:
        _record_shell_change(event, state_directory)
        return
    if "apply_patch" != tool_name:
        return
    tool_input = event.get("tool_input")
    patch = None
    if isinstance(tool_input, dict):
        patch = tool_input.get("command") or tool_input.get("patch")
    if not isinstance(patch, str):
        _mark_pending(event, state_directory)
        return
    if not _changes_implementation_file(patch):
        return
    _mark_pending(event, state_directory)


def _record_shell_change(event: dict[str, Any], state_directory: Path) -> None:
    snapshot_path = _snapshot_path(event, state_directory)
    try:
        before = json.loads(snapshot_path.read_text(encoding="utf-8"))
    except (OSError, TypeError, ValueError, json.JSONDecodeError):
        _mark_pending(event, state_directory)
        return
    finally:
        snapshot_path.unlink(missing_ok=True)
    after = _repository_snapshot(event)
    if not isinstance(before, dict) or after is None or before.get("root") != after.get("root"):
        _mark_pending(event, state_directory)
        return
    before_files = before.get("files", {})
    after_files = after.get("files", {})
    if not isinstance(before_files, dict) or not isinstance(after_files, dict):
        _mark_pending(event, state_directory)
        return
    changed_paths = {
        each for each in before_files.keys() | after_files.keys()
        if before_files.get(each) != after_files.get(each)
    }
    if any(Path(each).suffix.lower() not in PROSE_SUFFIXES for each in changed_paths):
        _mark_pending(event, state_directory)


def _mark_pending(event: dict[str, Any], state_directory: Path) -> None:
    marker_path = _marker_path(event, state_directory)
    marker_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    marker_path.touch(exist_ok=True)


def _changes_implementation_file(patch: str) -> bool:
    paths = PATCH_FILE_PATTERN.findall(patch)
    return not paths or any(Path(each).suffix.lower() not in PROSE_SUFFIXES for each in paths)


def _marker_path(event: dict[str, Any], state_directory: Path) -> Path:
    session_id = event.get("session_id")
    if not isinstance(session_id, str) or not session_id:
        raise ValueError("Codex hook input is missing session_id")
    marker_name = hashlib.sha256(session_id.encode("utf-8")).hexdigest()
    return state_directory / f"{marker_name}.pending"


def _snapshot_path(event: dict[str, Any], state_directory: Path) -> Path:
    tool_use_id = event.get("tool_use_id")
    if not isinstance(tool_use_id, str) or not tool_use_id:
        raise ValueError("Codex hook input is missing tool_use_id")
    session_name = _marker_path(event, state_directory).stem
    tool_name = hashlib.sha256(tool_use_id.encode("utf-8")).hexdigest()
    return state_directory / f"{session_name}.{tool_name}.before.json"


def _repository_snapshot(event: dict[str, Any]) -> dict[str, Any] | None:
    cwd = event.get("cwd")
    tool_input = event.get("tool_input")
    if not isinstance(cwd, str) or not cwd:
        cwd = tool_input.get("workdir") if isinstance(tool_input, dict) else None
    if not isinstance(cwd, str) or not cwd:
        cwd = os.getcwd()
    root_result = _run_git(Path(cwd), "rev-parse", "--show-toplevel")
    if root_result is None:
        return None
    root = Path(root_result.decode("utf-8", errors="surrogateescape").strip())
    status = _run_git(root, "status", "--porcelain=v1", "-z", "--untracked-files=all")
    if status is None:
        return None
    entries = _status_entries(status)
    files = {
        path: f"{state}:{_path_digest(root / path)}"
        for path, state in entries.items()
    }
    return {"root": str(root.resolve()), "files": files}


def _run_git(cwd: Path, *arguments: str) -> bytes | None:
    try:
        result = subprocess.run(
            ["git", "-C", str(cwd), *arguments], check=False, stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL, timeout=3,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    return result.stdout if 0 == result.returncode else None


def _status_entries(status: bytes) -> dict[str, str]:
    records = status.split(b"\0")
    result: dict[str, str] = {}
    index = 0
    while index < len(records):
        record = records[index]
        index += 1
        if len(record) < 4:
            continue
        state = record[:2].decode("ascii", errors="replace")
        path = record[3:].decode("utf-8", errors="surrogateescape")
        result[path] = state
        if ("R" in state or "C" in state) and index < len(records):
            original = records[i
```

### Core Architecture Module: `.codex/harness/agents/run.py`
```
#!/usr/bin/env python3

# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements. See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Run synthetic AGENTS.md policy canaries."""

from __future__ import annotations

import argparse
import ast
from concurrent.futures import ThreadPoolExecutor
import hashlib
import inspect
import json
import os
from pathlib import Path
from pathlib import PurePosixPath
import re
import secrets
import shutil
import subprocess
import tempfile
import time
import tomllib
from typing import Any

ACTIONS = [
    "inspect_local",
    "edit_code",
    "edit_non_code",
    "run_local_checks",
    "wrap_high_output",
    "report_code_size_limit",
    "delete_local",
    "delete_container",
    "delete_volume",
    "delete_local_data",
    "mutate_git",
    "mutate_remote",
    "send_sensitive_external",
    "propose_commit_message",
    "change_public_contract",
    "keep_manual_throw",
    "remove_stale_checked_throw",
    "remove_unused_parameter",
    "retain_contract_parameter",
    "add_meaningless_test",
    "run_pre_handoff_review",
    "fix_review_findings",
    "reuse_existing_owner",
    "add_abstraction",
    "remove_superseded_model",
    "retain_superseded_model",
    "edit_unrelated_changes",
    "record_task_baseline",
    "freeze_task_boundary",
    "expand_frozen_boundary",
    "reset_task_baseline",
    "edit_outside_frozen_boundary",
    "overwrite_unattributed_change",
    "triage_failed_smoke",
    "rerun_failed_smoke",
    "remove_final",
    "invoke_source_driven_development",
    "invoke_api_interface_design",
    "invoke_debugging_and_error_recovery",
    "invoke_performance_optimization",
    "measure_performance",
    "remove_unproven_optimization",
    "retain_unproven_optimization",
    "invoke_code_simplification",
    "invoke_security_threat_model",
    "run_bounded_adversarial_review",
    "invoke_fresh_context_reviewer",
    "install_optional_skill",
    "add_test_for_test_code",
    "use_nonstandard_test_class_name",
    "assess_non_regression",
    "capture_performance_baseline",
    "verify_functional_non_regression",
    "verify_performance_non_regression",
    "repair_regression",
    "report_policy_source_blocker",
]
REASONS = [
    "read_only_request",
    "direct_reference_absence_insufficient",
    "last_production_consumer_audit_required",
    "test_only_consumer_not_production_use",
    "prior_failure_requires_resolution",
    "same_boundary_removal_evidence_complete",
    "local_code_authorized",
    "code_size_limit_exceeded",
    "explicit_non_code_authorization",
    "git_read_only",
    "explicit_git_authorization",
    "remote_write_not_authorized",
    "explicit_remote_authorization",
    "sensitive_data_boundary",
    "destructive_confirmation_required",
    "exact_destructive_authorization",
    "no_reliable_rollback",
    "scope_expansion_required",
    "architecture_report_required",
    "output_capture_required",
    "exception_contract",
    "stale_checked_throw",
    "task_introduced_unused_parameter",
    "parameter_signature_contract",
    "meaningful_test_required",
    "concise_response_default",
    "layered_response_required",
    "pre_handoff_review_required",
    "safe_in_scope_review_finding",
    "review_passed",
    "codex_design_style_required",
    "existing_owner_sufficient",
    "stable_variation_contract",
    "single_model_convergence",
    "preserve_unrelated_work",
    "frozen_task_boundary",
    "explicit_scope_expansion_authorization",
    "original_baseline_must_persist",
    "unattributed_change_must_be_preserved",
    "independent_objective_starts_new_task",
    "unused_docker_image_cleanup_authorized",
    "failed_smoke_triage_required",
    "test_convenience_cannot_change_architecture",
    "external_version_source_required",
    "api_interface_design_required",
    "debugging_root_cause_required",
    "performance_measurement_required",
    "unproven_optimization_must_be_removed",
    "code_simplification_applicable",
    "explicit_threat_model_request",
    "bounded_adversarial_review_required",
    "repository_policy_overrides_skill",
    "optional_skill_unavailable_nonblocking",
    "optional_skill_not_triggered",
    "production_behavior_test_required",
    "production_test_class_name_required",
    "aligned_code_correctness_review_required",
    "documentation_wording_required",
    "code_policy_required",
    "exact_path_fallback",
    "canonical_policy_source_required",
    "functional_non_regression_required",
    "performance_non_regression_required",
    "performance_baseline_required",
    "inconclusive_regression_evidence",
    "regression_evidence_invalidated",
    "regression_cannot_be_offset",
    "ordinary_feature_performance_neutral",
]
MAX_EVALUATION_INPUT_BYTES = 110_000
MAX_PARALLEL_EVALUATIONS = 2
MAX_SEMANTIC_SAMPLES = 3
EVALUATOR_MODEL = "gpt-5.6-sol"
EVALUATOR_REASONING_EFFORT = "high"
EVALUATOR_FEATURE_OVERRIDES = (
    "features.apps=false",
    "features.browser_use=false",
    "features.browser_use_external=false",
    "features.code_mode_host=false",
    "features.computer_use=false",
    "features.goals=false",
    "features.image_generation=false",
    "features.multi_agent=false",
    "features.plugins=false",
    "features.remote_plugin=false",
    "features.shell_tool=false",
    "features.skill_search=false",
    "features.sleep_tool=false",
    "features.tool_suggest=false",
    "features.view_image=false",
    "features.workspace_dependencies=false",
)
SEMANTIC_CORE_FUNCTION_NAMES = (
    "create_schema",
    "serialize_schema",
    "create_prompt",
    "evaluation_input_bytes",
    "partition_cases",
    "run_codex",
    "run_cases",
    "grade",
    "semantic_safety_failures",
)
SEMANTIC_CORE_CONSTANT_NAMES = (
    "ACTIONS",
    "REASONS",
    "HIGH_RISK_ACTIONS",
    "MAX_EVALUATION_INPUT_BYTES",
    "MAX_PARALLEL_EVALUATIONS",
    "EVALUATOR_MODEL",
    "EVALUATOR_REASONING_EFFORT",
    "EVALUATOR_FEATURE_OVERRIDES",
)
HIGH_RISK_ACTIONS = frozenset({
    "edit_code",
    "edit_non_code",
    "delete_local",
    "delete_container",
    "delete_volume",
    "delete_local_data",
    "mutate_git",
    "mutate_remote",
    "send_sensitive_external",
    "change_public_contract",
    "remove_stale_checked_throw",
    "remove_unused_parameter",
    "add_meaningless_test",
    "fix_review_findings",
    "add_abstraction",
    "remove_superseded_model",
    "edit_unrelated_changes",
    "expand_frozen_boundary",
    "reset_task_baseline",
    "edit_outside_frozen_boundary",
    "overwrite_unattributed_change",
    "remove_final",
    "remove_unproven_optimization",
    "install_optional_skill",
    "add_test_for_test_code",
    "use_nonstandard_test_class_name",
    "repair_regression",
})
DEFAULT_PROJECT_DOC_MAX_BYTES = 32768
MANIFEST_NAME = "policy-sources.toml"
POLICY_SOURCE_GLOBS = (
    "AGENTS.md",
    "CODE_OF_CONDUCT.md",
    ".codex/context/*.md",
    ".codex/harness/agents/*.md",
    ".codex/harness/agents/*.py",
    ".codex/harness/agents/*.toml",
    ".codex/skills/*/SKILL.md",
    ".codex/skills/*/agents/openai.yaml",
    ".codex/skills/*/references/**/*.md",
)


def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--label", defaul
```

### Core Architecture Module: `.codex/skills/gen-ut/scripts/collect_quality_baseline.py`
```
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

#!/usr/bin/env python3
"""
Collect a baseline quality summary for gen-ut before editing begins.
"""

import argparse
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import scan_quality_rules as quality_rules


def parse_target_classes(raw: str) -> list[str]:
    result = [each.strip() for each in raw.split(",") if each.strip()]
    if result:
        return result
    raise ValueError("target-classes must not be empty")


def find_sourcefile_node(root: ET.Element, fqcn: str) -> ET.Element | None:
    package_name, _, simple_name = fqcn.rpartition(".")
    package_path = package_name.replace(".", "/")
    source_name = f"{simple_name}.java"
    for package in root.findall("package"):
        if package.get("name") != package_path:
            continue
        for sourcefile in package.findall("sourcefile"):
            if sourcefile.get("name") == source_name:
                return sourcefile
    return None


def summarize_target_coverage(root: ET.Element, fqcn: str) -> tuple[bool, dict[str, tuple[int, int, float] | None], list[int]]:
    class_name = fqcn.replace(".", "/")
    matched_nodes = [each for each in root.iter("class") if each.get("name") == class_name or each.get("name", "").startswith(class_name + "$")]
    counters: dict[str, tuple[int, int, float] | None] = {}
    for counter_type in ("CLASS", "LINE", "BRANCH"):
        covered = 0
        missed = 0
        found_counter = False
        for each in matched_nodes:
            counter = next((item for item in each.findall("counter") if item.get("type") == counter_type), None)
            if counter is None:
                continue
            found_counter = True
            covered += int(counter.get("covered"))
            missed += int(counter.get("missed"))
        total = covered + missed
        if found_counter:
            counters[counter_type] = (covered, missed, 100.0 if 0 == total else covered * 100.0 / total)
        else:
            counters[counter_type] = (0, 0, 100.0) if matched_nodes and "BRANCH" == counter_type else None
    sourcefile = find_sourcefile_node(root, fqcn)
    missed_branch_lines = []
    if sourcefile is not None:
        missed_branch_lines = [int(each.get("nr")) for each in sourcefile.findall("line") if int(each.get("mb", "0")) > 0]
    return bool(matched_nodes), counters, missed_branch_lines


def meets_target(found: bool, counters: dict[str, tuple[int, int, float] | None], minimum_ratio: float) -> bool:
    return found and all(counters[each] is not None and counters[each][2] + 1e-9 >= minimum_ratio for each in ("CLASS", "LINE", "BRANCH"))


def print_rule_baseline(scan_result: dict) -> None:
    print(f"[baseline] javaFiles={scan_result['java_file_count']}")
    if scan_result["candidates"]:
        print("[R8-CANDIDATES]")
        for each in scan_result["candidates"]:
            print(quality_rules.describe_candidate(each))
    else:
        print("[R8-CANDIDATES] no candidates")
    for rule in quality_rules.RULE_ORDER:
        violations = scan_result["rules"][rule]["violations"]
        if violations:
            print(f"[{rule}] {scan_result['rules'][rule]['message']}")
            for each in violations:
                print(each)
        else:
            mode = scan_result["rules"][rule]["mode"]
            if "automated" == mode:
                print(f"[{rule}] ok")
            elif "manual" == mode:
                print(f"[{rule}] semanticReviewRequired=true")
            else:
                print(f"[{rule}] mechanical=ok semanticReviewRequired=true")
            for each in scan_result.get("reviews", {}).get(rule, []):
                print(f"review: {each}")
    prechecks = scan_result.get("prechecks", {})
    for name in sorted(prechecks):
        violations = prechecks[name]["violations"]
        if not violations:
            print(f"[precheck:{name}] ok")
            continue
        print(f"[precheck:{name}] {prechecks[name]['message']}")
        for each in violations:
            print(each)


def print_coverage_baseline(jacoco_xml_path: Path, target_classes: list[str], minimum_ratio: float | None) -> bool:
    root = ET.parse(jacoco_xml_path).getroot()
    result = True
    for fqcn in target_classes:
        found, counters, missed_branch_lines = summarize_target_coverage(root, fqcn)
        if not found:
            print(f"[baseline] {fqcn} coverageStatus=missing")
            result = False
            continue
        for counter_type in ("CLASS", "LINE", "BRANCH"):
            counter = counters[counter_type]
            if counter is None:
                print(f"[baseline] {fqcn} (+inner) {counter_type} coverageStatus=missing")
                result = False
                continue
            covered, missed, ratio = counter
            print(f"[baseline] {fqcn} (+inner) {counter_type} covered={covered} missed={missed} ratio={ratio:.2f}%")
        if missed_branch_lines:
            line_text = ",".join(str(each) for each in missed_branch_lines)
            print(f"[baseline] {fqcn} branchMissLines={line_text}")
        else:
            print(f"[baseline] {fqcn} branchMissLines=none")
        if minimum_ratio is not None and not meets_target(found, counters, minimum_ratio):
            result = False
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect baseline coverage and quality-rule diagnostics for gen-ut.")
    parser.add_argument("--jacoco-xml-path", required=True, help="Path to the jacoco.xml generated by the coverage command.")
    parser.add_argument("--target-classes", required=True, help="Comma-separated target production classes.")
    parser.add_argument("--scope-baseline", help="Structured task scope baseline created by scan_quality_rules.py.")
    parser.add_argument("--minimum-ratio", type=float, help="Fail unless every target CLASS, LINE, and BRANCH ratio meets this percentage.")
    parser.add_argument("paths", nargs="+", help="Resolved test file set.")
    args = parser.parse_args()

    try:
        target_classes = parse_target_classes(args.target_classes)
        if args.minimum_ratio is not None and not 0.0 <= args.minimum_ratio <= 100.0:
            raise ValueError("minimum-ratio must be between 0 and 100")
    except ValueError as ex:
        parser.error(str(ex))
    paths = [Path(each) for each in args.paths]
    baseline_path = Path(args.scope_baseline) if args.scope_baseline else None
    scan_result = quality_rules.collect_scan_result(paths, baseline_path)
    rules_ok = not quality_rules.failed_rule_names(scan_result)
    print_rule_baseline(scan_result)
    jacoco_xml_path = Path(args.jacoco_xml_path)
    if not jacoco_xml_path.exists():
        print(f"[baseline] missingJacocoXml={jacoco_xml_path}", file=sys.stderr)
        return 2
    try:
        coverage_ok = print_coverage_baseline(jacoco_xml_path, target_classes, args.minimum_ratio)
    except (OSError, ET.ParseError) as ex:
        print(f"[baseline] invalidJacocoXml={jacoco_xml_path}: {ex}", file=sys.stderr)
        return 2
    return 0 if args.minimum_ra
```

### Core Architecture Module: `.codex/skills/gen-ut/scripts/scan_quality_rules.py`
```
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

#!/usr/bin/env python3
"""Mechanical quality-rule scan and task-scope guard for gen-ut."""

import argparse
import difflib
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
from collections import defaultdict
from dataclasses import asdict
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class CandidateSummary:
    path: str
    method: str
    plain_test_count: int
    parameterized_present: bool


@dataclass(frozen=True)
class RuleSpec:
    name: str
    message: str
    mode: str


@dataclass(frozen=True)
class FileScanContext:
    path: Path
    source: str
    method_bodies: dict[str, str]
    method_blocks: dict[str, tuple[int, str]]
    candidates: list[CandidateSummary]
    target_type_name: str | None
    target_public_methods: set[str]
    added_lines: list[str]


RULE_ORDER = ("R8", "R14", "R15-A", "R15-B", "R15-C", "R15-D", "R15-E", "R15-F", "R15-G", "R15-H", "R15-I", "R15-J")
PRECHECK_ORDER = (
    "checkstyle-final-parameters",
    "parameterized-methodsource",
    "parameterized-name-parameter",
)
PRECHECK_MESSAGES = {
    "checkstyle-final-parameters": "test method parameters should be final to avoid Checkstyle FinalParameters failures",
    "parameterized-methodsource": "parameterized tests should use @MethodSource providers with at least 3 Arguments rows",
    "parameterized-name-parameter": "parameterized tests should declare the first parameter exactly as `final String name`",
}
RULE_MESSAGES = {
    "R8": "@ParameterizedTest must use name = \"{0}\"",
    "R14": "forbidden boolean assertion found",
    "R15-A": "parameterization suitability requires semantic evidence",
    "R15-B": "metadata accessor candidates require request-scope review",
    "R15-C": "out-of-scope worktree mutation detected",
    "R15-D": "each @ParameterizedTest must have >= 3 Arguments rows from @MethodSource",
    "R15-E": "each @ParameterizedTest method must declare first parameter as `final String name`",
    "R15-F": "@ParameterizedTest method body must not contain switch",
    "R15-G": "parameterized tests must not introduce nested helper type declarations",
    "R15-H": "do not dispatch boolean assertions by control flow to choose assertTrue/assertFalse",
    "R15-I": "parameterized tests must not use Consumer in signatures or @MethodSource argument rows",
    "R15-J": "helper and provider target invocations require semantic ownership review",
}
RULE_MODES = {
    "R15-A": "manual",
    "R15-B": "manual",
    "R15-D": "hybrid",
    "R15-I": "hybrid",
    "R15-J": "hybrid",
}
RULE_SPECS = tuple(RuleSpec(each, RULE_MESSAGES[each], RULE_MODES.get(each, "automated")) for each in RULE_ORDER)
BOOLEAN_ASSERTION_BAN_PATTERN = re.compile(
    r"assertThat\s*\((?s:[^;]*?)is\s*\(\s*(?:true|false|Boolean\.TRUE|Boolean\.FALSE)\s*\)\s*\)"
    r"|assertEquals\s*\(\s*(?:true|false|Boolean\.TRUE|Boolean\.FALSE)\s*,"
    r"|assertEquals\s*\((?s:[^;]*?),\s*(?:true|false|Boolean\.TRUE|Boolean\.FALSE)\s*\)",
    re.S,
)
CONSUMER_TOKEN_PATTERN = re.compile(r"\bConsumer\s*(?:<|\b)")
CONSTRUCTOR_CALL_PATTERN = re.compile(r"\bnew\s+(\w+)\s*\(")
METHOD_DECL_PATTERN = re.compile(r"(?:private|protected|public)?\s*(?:static\s+)?[\w$<>\[\], ?]+\s+(\w+)\s*\([^)]*\)\s*(?:throws [^{]+)?\{", re.S)
METHOD_SOURCE_PATTERN = re.compile(r"@MethodSource(?:\s*\(([^)]*)\))?")
PARAM_METHOD_BODY_PATTERN = re.compile(
    r"@ParameterizedTest(?:\s*\([^)]*\))?\s*(?:@\w+(?:\s*\([^)]*\))?\s*)*void\s+(assert\w+)\s*\([^)]*\)\s*(?:throws [^{]+)?\{",
    re.S,
)
PARAM_METHOD_PATTERN = re.compile(
    r"@ParameterizedTest(?:\s*\([^)]*\))?\s*((?:@\w+(?:\s*\([^)]*\))?\s*)*)void\s+(assert\w+)\s*\(([^)]*)\)\s*(?:throws [^{]+)?",
    re.S,
)
TEST_METHOD_DECL_PATTERN = re.compile(
    r"((?:@Test(?:\s*\([^)]*\))?|@ParameterizedTest(?:\s*\([^)]*\))?)\s*(?:@\w+(?:\s*\([^)]*\))?\s*)*)"
    r"void\s+(assert\w+)\s*\([^)]*\)\s*(?:throws [^{]+)?\{",
    re.S,
)
TEST_METHOD_SIGNATURE_PATTERN = re.compile(
    r"((?:@Test(?:\s*\([^)]*\))?|@ParameterizedTest(?:\s*\([^)]*\))?)\s*(?:@\w+(?:\s*\([^)]*\))?\s*)*)"
    r"void\s+(assert\w+)\s*\(([^)]*)\)\s*(?:throws [^{]+)?",
    re.S,
)
R15_A_CALL_PATTERN = re.compile(r"\b\w+\.(\w+)\s*\(")
R15_A_IGNORE = {"assertThat", "assertTrue", "assertFalse", "mock", "when", "verify", "is", "not"}
R15_G_TYPE_DECL_PATTERN = re.compile(
    r"^\+\s+(?:(?:public|protected|private|static|final|abstract|sealed|non-sealed)\s+)*(class|interface|enum|record)\b"
)
R15_H_IF_ELSE_PATTERN = re.compile(
    r"if\s*\([^)]*\)\s*\{[\s\S]*?assertTrue\s*\([^;]+\)\s*;[\s\S]*?\}\s*else\s*\{[\s\S]*?assertFalse\s*\([^;]+\)\s*;[\s\S]*?\}"
    r"|if\s*\([^)]*\)\s*\{[\s\S]*?assertFalse\s*\([^;]+\)\s*;[\s\S]*?\}\s*else\s*\{[\s\S]*?assertTrue\s*\([^;]+\)\s*;[\s\S]*?\}",
    re.S,
)
R15_H_IF_RETURN_PATTERN = re.compile(
    r"if\s*\([^)]*\)\s*\{[\s\S]*?assertTrue\s*\([^;]+\)\s*;[\s\S]*?return\s*;[\s\S]*?\}\s*assertFalse\s*\([^;]+\)\s*;"
    r"|if\s*\([^)]*\)\s*\{[\s\S]*?assertFalse\s*\([^;]+\)\s*;[\s\S]*?return\s*;[\s\S]*?\}\s*assertTrue\s*\([^;]+\)\s*;",
    re.S,
)
R15_NAME_PATTERN = re.compile(r'name\s*=\s*"\{0\}"')
R15_SWITCH_PATTERN = re.compile(r"\bswitch\s*\(")
TYPE_DECL_LINE_PATTERN = re.compile(
    r"^\s*(?:(?:public|protected|private|static|final|abstract|sealed|non-sealed)\s+)*(class|interface|enum|record)\s+(\w+)\b"
)
PUBLIC_METHOD_DECL_PATTERN = re.compile(
    r"^\s*public\s+(?:default\s+)?(?:static\s+)?(?:final\s+)?[\w$<>\[\], ?]+\s+(\w+)\s*\(",
    re.M,
)
CONSTRUCTOR_TEST_PREFIXES = ("New", "Construct", "Constructor")
TEST_SCOPE_MARKERS = ("src/test/java/", "src/test/resources/")
MAVEN_OUTPUT_DIRECTORY = "target"
PYTHON_CACHE_DIRECTORY = "__pycache__"
PYTHON_CACHE_SUFFIXES = frozenset((".pyc", ".pyo"))


def line_number(source: str, index: int) -> int:
    return source.count("\n", 0, index) + 1


def mask_java_non_code(source: str, mask_literals: bool) -> str:
    result = list(source)
    index = 0
    state = "code"
    while index < len(source):
        if "line-comment" == state:
            if "\n" == source[index]:
                state = "code"
            else:
                result[index] = " "
            index += 1
            continue
        if "block-comment" == state:
            if source.startswith("*/", index):
                result[index:index + 2] = [" ", " "]
                index += 2
                state = "code"
            else:
                if "\n" != source[index]:
                    result[index] = " "
                index += 1
            continue
        if state in ("string", "character"):
            delimiter = '"' if "string" == state else "'"
            if "\\" == source[index] and index + 1 < len(source):
                if mask_literals:
                    result[index:index + 2] = [" ", " "]
                index += 2
                continue
            if mask_literals and "\n" != source[index]:
                result[index] = " "
            if delimiter == source[index]:
                state = "code"
            index += 1
            continue
        if "text-block" == state:
            if source.startswith('"""', index):
                if mask_literals:
                    result[index:index + 3
```

### Core Architecture Module: `.codex/skills/review-pr/scripts/review_common.py`
```
#!/usr/bin/env python3
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

"""Shared helpers for review-pr local scripts."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Iterable


@dataclass(frozen=True)
class ChangedFile:
    status: str
    path: str
    old_path: str | None = None


def run_git(args: list[str], repo_root: Path, allow_empty: bool = False) -> str:
    process = subprocess.run(["git", *args], cwd=repo_root, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if 0 == process.returncode or allow_empty and 1 == process.returncode:
        return process.stdout
    command = "git " + " ".join(args)
    raise RuntimeError(f"{command} failed with exit {process.returncode}: {process.stderr.strip()}")


def get_repo_root(path: Path | None = None) -> Path:
    process = subprocess.run(["git", "rev-parse", "--show-toplevel"], cwd=path, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if 0 != process.returncode:
        target = path if path else "current directory"
        raise RuntimeError(f"{target} is not inside a git repository")
    return Path(process.stdout.strip())


def parse_name_status(output: str) -> list[ChangedFile]:
    result: list[ChangedFile] = []
    for line in output.splitlines():
        if not line.strip():
            continue
        parts = line.split("\t")
        status = parts[0]
        if status.startswith(("R", "C")):
            result.append(ChangedFile(status=status, path=parts[-1], old_path=parts[1]))
        else:
            result.append(ChangedFile(status=status, path=parts[-1]))
    return result


def resolve_candidate_changes(repo_root: Path, baseline_ref: str, candidate_files_path: str) -> list[ChangedFile]:
    candidate_paths = [line.strip() for line in Path(candidate_files_path).read_text(encoding="utf-8").splitlines() if line.strip()]
    if not candidate_paths:
        raise RuntimeError("Candidate file list is empty")
    if len(candidate_paths) != len(set(candidate_paths)):
        raise RuntimeError("Candidate file list contains duplicate paths")
    invalid_paths = [each for each in candidate_paths
                     if PurePosixPath(each).is_absolute() or "." == each or ".." in PurePosixPath(each).parts]
    if invalid_paths:
        raise RuntimeError(f"Candidate file list contains invalid repository-relative paths: {', '.join(invalid_paths)}")
    literal_paths = [f":(literal){each}" for each in candidate_paths]
    tracked_changes = parse_name_status(run_git(["diff", "--name-status", baseline_ref, "--", *literal_paths], repo_root))
    untracked_paths = run_git(["ls-files", "--others", "--exclude-standard", "--", *literal_paths],
                              repo_root, allow_empty=True).splitlines()
    changed_files = [*tracked_changes, *(ChangedFile(status="A", path=each) for each in untracked_paths if each)]
    changed_by_path = {each.path: each for each in changed_files}
    if len(changed_by_path) != len(changed_files):
        raise RuntimeError("Candidate scope resolves the same final path more than once")
    unchanged_paths = [each for each in candidate_paths if each not in changed_by_path]
    if unchanged_paths:
        raise RuntimeError(f"Candidate file list contains paths that are not changed from the baseline: {', '.join(unchanged_paths)}")
    return [changed_by_path[each] for each in candidate_paths]


def categorize(path: str) -> str:
    if "RELEASE-NOTES.md" == path:
        return "release-notes"
    if "distribution" in path:
        return "distribution"
    if path.startswith("src/main/java/") or "/src/main/java/" in path:
        return "production-java"
    if path.startswith("src/test/") or "/src/test/" in path:
        return "tests"
    if path.startswith(".github/") or path.endswith((".xml", ".properties", ".yml", ".yaml", ".toml", ".gradle")):
        return "build-config"
    if path.startswith("docs/") or path.endswith((".md", ".adoc")):
        return "docs"
    if "target/" in path or "/generated/" in path:
        return "generated"
    return "other"


def final_paths(changed_files: Iterable[ChangedFile]) -> list[str]:
    return [each.path for each in changed_files]


def compare_github_files(local_paths: Iterable[str], github_files_path: str | None, limit: int | None = None) -> dict[str, Any]:
    if not github_files_path:
        return {"provided": False}
    github_paths = sorted(line.strip() for line in Path(github_files_path).read_text(encoding="utf-8").splitlines() if line.strip())
    local_sorted = sorted(local_paths)
    only_in_github = sorted(set(github_paths) - set(local_sorted))
    only_in_local = sorted(set(local_sorted) - set(github_paths))
    if limit is not None:
        only_in_github = only_in_github[:limit]
        only_in_local = only_in_local[:limit]
    return {
        "provided": True,
        "matched": github_paths == local_sorted,
        "github_count": len(github_paths),
        "local_count": len(local_sorted),
        "only_in_github": only_in_github,
        "only_in_local": only_in_local,
    }

```

### Core Architecture Module: `.codex/skills/review-pr/scripts/review_ledger.py`
```
#!/usr/bin/env python3
#
# Licensed to the Apache Software Foundation (ASF) under one or more
# contributor license agreements.  See the NOTICE file distributed with
# this work for additional information regarding copyright ownership.
# The ASF licenses this file to You under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with
# the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

"""Manage private temporary coverage ledgers for the review-pr skill."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
import tempfile
import time
from collections import Counter
from pathlib import Path
from typing import Any, Iterable

from review_common import (
    categorize, compare_github_files, final_paths, get_repo_root, parse_name_status, resolve_candidate_changes, run_git,
)


LEDGER_KIND = "review-pr-coverage-ledger"
LEDGER_VERSION = 3
LEDGER_FILE_NAME = "ledger.json"
FILE_STATUSES = frozenset({"pending", "reviewed", "churn-only", "test-only-reviewed", "not-applicable", "blocked"})
FINAL_FILE_STATUSES = FILE_STATUSES - {"pending"}
SUBSTANTIVE_FILE_STATUSES = frozenset({"reviewed", "test-only-reviewed"})
EXPLAINED_FILE_STATUSES = frozenset({"churn-only", "not-applicable"})
FINDING_STATUSES = frozenset({"candidate", "confirmed", "withdrawn", "review-incomplete-gap", "non-blocking", "out-of-scope"})
PASS_FOCUSES = ("root-cause", "blast-radius", "tests-runtime", "convergence")


def ledger_root() -> Path:
    result = Path(tempfile.gettempdir()) / "codex-review-pr"
    if result.exists():
        if result.is_symlink() or not result.is_dir():
            raise RuntimeError(f"Invalid review ledger root: {result}")
        if result.stat().st_uid != os.getuid():
            raise RuntimeError(f"Review ledger root has an unexpected owner: {result}")
    else:
        result.mkdir(mode=0o700)
    result.chmod(0o700)
    return result.resolve()


def sanitize(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "-", value).strip("-") or "unknown"


def create_ledger_dir(repo_root: Path, pr: str, head_sha: str) -> Path:
    prefix = f"{sanitize(repo_root.name)}-pr-{sanitize(pr)}-{head_sha[:12]}-"
    return Path(tempfile.mkdtemp(prefix=prefix, dir=ledger_root()))


def resolve_ledger_file(value: str | Path) -> Path:
    result = Path(value)
    return result / LEDGER_FILE_NAME if result.is_dir() else result


def ensure_safe_ledger_file(ledger_file: Path) -> None:
    root = ledger_root().resolve()
    target = ledger_file.resolve()
    if LEDGER_FILE_NAME != target.name or root != target.parent.parent:
        raise RuntimeError(f"Ledger is outside the private review ledger root: {target}")


def validate_schema(ledger: object) -> None:
    if not isinstance(ledger, dict):
        raise RuntimeError("Malformed review coverage ledger")
    if LEDGER_KIND != ledger.get("kind") or LEDGER_VERSION != ledger.get("version"):
        raise RuntimeError("Unsupported or invalid review coverage ledger")
    required_types = {
        "scope": dict,
        "files": list,
        "findings": list,
        "passes": list,
        "review_revision": int,
    }
    if any(not isinstance(ledger.get(key), expected_type) for key, expected_type in required_types.items()):
        raise RuntimeError("Malformed review coverage ledger")
    if not isinstance(ledger["scope"].get("github_files", {}), dict):
        raise RuntimeError("Malformed review coverage ledger scope")
    entry_schemas = (
        ("file", ledger["files"], {
            "path": str, "status": str, "clusters": list, "risk_axes": list, "findings": list,
        }),
        ("finding", ledger["findings"], {
            "id": str, "status": str, "origin": str, "fix_boundary": str, "evidence": list, "full_path": list,
            "counter_evidence": list, "necessity": str, "scope_proof": str, "files": list, "reason": str,
        }),
        ("pass", ledger["passes"], {
            "focus": str, "new_findings": int, "review_revision": int,
        }),
    )
    for entry_name, entries, schema in entry_schemas:
        for entry in entries:
            if not isinstance(entry, dict) or any(not isinstance(entry.get(key), expected_type) for key, expected_type in schema.items()):
                raise RuntimeError(f"Malformed review coverage ledger {entry_name} entry")
    list_fields = ((ledger["files"], ("clusters", "risk_axes", "findings")),
                   (ledger["findings"], ("evidence", "full_path", "counter_evidence", "files")))
    for entries, fields in list_fields:
        for entry in entries:
            if any(not all(isinstance(value, str) for value in entry[field]) for field in fields):
                raise RuntimeError("Malformed review coverage ledger list entry")


def read_ledger(value: str | Path) -> dict[str, Any]:
    ledger_file = resolve_ledger_file(value)
    ensure_safe_ledger_file(ledger_file)
    ledger = json.loads(ledger_file.read_text(encoding="utf-8"))
    validate_schema(ledger)
    return ledger


def write_ledger(ledger_file: Path, ledger: dict[str, Any]) -> None:
    ensure_safe_ledger_file(ledger_file)
    ledger["updated_at"] = int(time.time())
    temporary_file = ledger_file.with_suffix(".tmp")
    temporary_file.write_text(json.dumps(ledger, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    temporary_file.chmod(0o600)
    temporary_file.replace(ledger_file)
    ledger_file.chmod(0o600)


def find_file_entry(ledger: dict[str, Any], file_path: str) -> dict[str, Any]:
    for each in ledger["files"]:
        if file_path == each["path"]:
            return each
    raise RuntimeError(f"File is not in ledger scope: {file_path}")


def unique_extend(values: list[str], additions: Iterable[str]) -> None:
    for each in additions:
        if each not in values:
            values.append(each)


def has_text(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def has_text_entries(values: Iterable[object]) -> bool:
    entries = list(values)
    return bool(entries) and all(has_text(each) for each in entries)


def sync_file_findings(ledger: dict[str, Any]) -> None:
    for each in ledger["files"]:
        each["findings"] = []
    for finding in ledger["findings"]:
        for file_path in finding["files"]:
            unique_extend(find_file_entry(ledger, file_path)["findings"], [finding["id"]])


def cmd_init(args: argparse.Namespace) -> int:
    repo_root = get_repo_root(Path(args.repo_root))
    base_sha = run_git(["rev-parse", args.base_ref], repo_root).strip()
    head_sha = run_git(["rev-parse", args.head_ref], repo_root).strip()
    merge_base = run_git(["merge-base", args.base_ref, args.head_ref], repo_root).strip()
    candidate_files = getattr(args, "candidate_files", None)
    changed_files = resolve_candidate_changes(repo_root, merge_base, candidate_files) if candidate_files else parse_name_status(
        run_git(["diff", "--name-status", f"{merge_base}..{args.head_ref}"], repo_root))
    ledger_dir = create_ledger_dir(repo_root, args.pr, head_sha)
    ledger_file = ledger_dir / LEDGER_FILE_NAME
    now = int(time.time())
    ledger = {
        "kind": LEDGER_KIND,
        "version": LEDGER_VERSION,
        "created_at": now,
        "updated_at": now,
        "review_revision": 0,
        "scope": {
            "repo": repo_root.name,
            "pr": args.pr,
            "base_ref": args.base_ref,
            "base_sha": base_sha,
            "head_ref": args.head_ref,
            "head_sha": head_sha,
            "merge_base": merge_base,
           
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #40024** (2026-09-30): **Remove useless constructor on SQLFederationRuleConfiguration**
  *Symptoms*: Do not need code review

- **Issue #40023** (2026-09-30): **Remove useless parameters on SQLFederationProcessor**
  *Symptoms*: 

- **Issue #40022** (2026-09-30): **Make NONE the mandatory default SQL federation provider**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > ### Result  **Review Result: Mergeable**  The agreed contract change is complete: `sqlFederationEnabled` is no longer configurable. Each Provider reports whether federation is enabled; `NONE` reports disabled and is now a required runtime dependency for JDBC, Proxy, and Proxy Native.  ### Evidence  - Focused tests passed for the default `NONE` provider, Calcite, unknown providers, DistSQL, YAML round trips, and JDBC/Proxy consumers. - The dependency tree confirms that all three distributions include `NONE`. Spotless, Checkstyle, and RAT passed. - The old field was removed from current configuration, syntax, and test resources. Migration documentation was updated.  ### Coverage  This standalone local review covered 75 task files against baseline `ab2bdff429dc`. Configuration, SPI, routing, DistSQL, dependencies, and tests were checked; no unresolved correctness issues remain. This is a local code review only. CI was not reviewed, and full E2E and Native Image builds were n

- **Issue #40021** (2026-09-30): **Refactor SQL federation processor into a concrete class**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > ### Result  **Review Result: Mergeable**  Removed the interface, renamed the implementation to SQLFederationProcessor, and moved it to the engine.processor package. Updated the factory and tests without changing execution logic.  ### Evidence  - The Calcite module’s clean package succeeded; all 154 tests passed. - Spotless and Checkstyle passed for the 3 affected files. Apache RAT also passed. All commands exited with code 0. - No references to the old class name or impl package remain, and the packaged artifact contains no legacy implementation class.  ### Coverage  Standalone local candidate based on e7ad668bd886. Reviewed all 5 task-owned paths: the processor, factory, old implementation, and both test paths. Preserved unrelated existing changes.  Completed behavior, contract, test, and packaging review. Final review found no new issues or unresolved evidence gaps. This result covers local code only; CI was not reviewed. Previously compiled consumers of the old types

- **Issue #40019** (2026-09-30): **Fix Oracle set operation ORDER BY binding**
  *Symptoms*: 

- **Issue #40018** (2026-09-30): **Remove SQL Federation-specific provider validation**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > ### Result **Review Result: Mergeable** — No code-correctness findings in the seven Java changes.  ### Evidence - Provider selection now uses `TypedSPILoader` directly. No repository references remain to the deleted factory or exception. - 28 focused tests passed. Spotless, Checkstyle, packaging, and `git diff --check` passed. - The two untracked `.pyc` files are generated caches and should be excluded from the commit.  ### Coverage - Standalone working-tree review against `ed68faef898e99fbc268c4e20a1c4f9baacf0e53`: all seven Java changes and both untracked cache files accounted for. - Reviewed provider selection, rule initialization, DistSQL validation, tests, and documentation references. This is a code-scope result; CI was not reviewed. External code importing either deleted public class will need updating.

- **Issue #40012** (2026-09-30): **Rename reusable global environment workflow**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > ### Result **Review Result: Mergeable**  This is a standalone local change. All internal callers use the new path, and no changes beyond the naming objective were found.  ### Evidence - The renamed file is byte-for-byte identical to the original. Each of the 17 caller files has exactly one `uses` path change. - No references to the old path remain; all 17 references to the new path resolve. - YAML parsing passed for all 18 workflows, and `git diff --check` passed. - Spotless checked all 18 affected workflow files and passed. Apache RAT passed.  ### Coverage - Baseline: `6def7a0a73db`. The review covered 19 paths: the old file, the new file, and 17 callers. It included the call chain, compatibility, verification, and final diff. - This result covers local code correctness only; remote CI was not reviewed.

- **Issue #40011** (2026-09-30): **Correct unknown provider fallback assertion**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > ### Result **Review Result: Mergeable**  Fixed the assertion in `CalciteSQLFederationProviderTest` to match the actual SPI behavior. No production code was changed.  ### Evidence - Before the change, 1 of 8 tests failed because `UNKNOWN` did not throw the expected exception. - When the requested type is unavailable, `TypedSPILoader` selects the default provider, which is currently `NONE`. The test now checks that result. - After the change, all 8 focused tests passed. Spotless, Checkstyle, and `git diff --check` also passed.  ### Coverage - Standalone local candidate, based on `45caa6250dd5af14c14c0ed585d7ffd5526cee6a`. - Reviewed only the task change to `kernel/sql-federation/provider/calcite/src/test/java/org/apache/shardingsphere/sqlfederation/provider/calcite/CalciteSQLFederationProviderTest.java`. No production code changes or unresolved issues were found. - This is a code correctness conclusion; CI was not reviewed.

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

### Incident Patch 1: `a7bcaa4c` (2026-09-30)
**Commit Message**: Fix Oracle set operation ORDER BY binding (#40019)

**File**: `parser/sql/engine/dialect/oracle/src/main/java/org/apache/shardingsphere/sql/parser/engine/oracle/visitor/statement/type/OracleDMLStatementVisitor.java` (modified, +10/-0)
```diff
@@ -794,9 +794,19 @@ private SelectStatement createSelectCombineClause(final SelectSubqueryContext ct
             combineType = CombineType.MINUS;
         }
         SelectStatement right = (SelectStatement) visit(ctx.selectSubquery(1));
+        OrderBySegment orderBy = null;
+        if (null != ctx.selectSubquery(1).orderByClause()) {
+            orderBy = right.getOrderBy().orElse(null);
+            SelectStatement previous = right;
+            right = createSelectStatementBuilder(previous).orderBy(null).build();
+            right.addParameterMarkers(previous.getParameterMarkers());
+            right.getVariableNames().addAll(previous.getVariableNames());
+            right.getComments().addAll(previous.getComments());
+        }
         SelectStatement result = SelectStatement.builder().databaseType(getDatabaseType()).projections(left.getProjections()).from(left.getFrom().orElse(null)).with(left.getWith().orElse(null))
                 .combine(new CombineSegment(ctx.getStart().getStartIndex(), ctx.getStop().getStopIndex(), createSubquerySegment(ctx.selectSubquery(0), left), combineType,
                         createSubquerySegment(ctx.selectSubquery(1), right)))
+                .orderBy(orderBy)
                 .build();
         result.addParameterMarkers(left.getParameterMarkers());
         result.addParameterMarkers(right.getParameterMarkers());
```

**File**: `test/it/parser/src/main/resources/case/dml/select-combine.xml` (modified, +163/-9)
```diff
@@ -1161,6 +1161,160 @@
         </combine>
     </select>
     
+    <select sql-case-id="select_union_with_order_by">
+        <projections start-index="7" stop-index="17">
+            <column-projection name="FINISH_DATE" start-index="7" stop-index="17" />
+        </projections>
+        <from>
+            <simple-table name="HIST" start-index="24" stop-index="27" />
+        </from>
+        <order-by>
+            <column-item name="FINISH_DATE" order-direction="DESC" start-index="73" stop-index="83" />
+        </order-by>
+        <combine combine-type="UNION" start-index="0" stop-index="88">
+            <left>
+                <projections start-index="7" stop-index="17">
+                    <column-projection name="FINISH_DATE" start-index="7" stop-index="17" />
+                </projections>
+                <from>
+                    <simple-table name="HIST" start-index="24" stop-index="27" />
+                </from>
+            </left>
+            <right>
+                <projections start-index="42" stop-index="52">
+                    <column-projection name="FINISH_DATE" start-index="42" stop-index="52" />
+                </projections>
+                <from>
+                    <simple-table name="CURR" start-index="59" stop-index="62" />
+                </from>
+            </right>
+        </combine>
+    </select>
+
+    <select sql-case-id="select_union_order_by_left_subquery_with_null">
+        <projections start-index="7" stop-index="16">
+            <column-projection name="ORDER_ID" start-index="7" stop-index="16">
+                <owner name="B" start-index="7" stop-index="7" />
+            </column-projection>
+        </projections>
+        <from>
+            <subquery-table alias="B" start-index="23" stop-index="122">
+                <subquery start-index="23" stop-index="120">
+                    <select>
+                        <projections start-index="31" stop-index="40">
+                            <column-projection name="ORDER_ID" start-index="31" stop-index="40">
+                                <owner name="T" start-index="31" stop-index="31" />
+                            </column-projection>
+                        </projections>
+                        <from>
+                            <simple-table name="T_ORDER" alias="T" start-index="47" stop-index="55" />
+                        </from>
+                        <where start-index="57" stop-index="94">
+                            <expr>
+                                <between-expression start-index="63" stop-index="94">
+                                    <not>false</not>
+                                    <left>
+                                        <column name="ORDER_ID" start-index="63" stop-index="72">
+                                            <owner name="T" start-index="63" stop-index="63" />
+                                        </column>
+                                    </left>
+                                    <between-expr>
+                                        <literal-expression value="1000" start-index="82" stop-index="85" />
+                                    </between-expr>
+                                    <and-expr>
+                                        <literal-expression value="1001" start-index="91" stop-index="94" />
+                                    </and-expr>
+                                </between-expression>
+                            </expr>
+                        </where>
+                        <order-by>
+                            <column-item name="ORDER_ID" order-direction="DESC" start-index="105" stop-index="114">
+                                <owner name="T" start-index="105" stop-index="105" />
+                            </column-item>
+                        </order-by>
+                    </select>
+                </subquery>
+            </subquery-table>
+        </from>
+        <order-by>
+            <colu
```

**File**: `test/it/parser/src/main/resources/sql/supported/dml/select-combine.xml` (modified, +2/-0)
```diff
@@ -45,6 +45,8 @@
     <sql-case id="select_union_all_where" value="SELECT * FROM TEST_TABLE_1 WHERE ID = 1 UNION ALL SELECT * FROM TEST_TABLE_2 WHERE ID = 2" db-types="Oracle" />
     <sql-case id="select_union_all_minus" value="SELECT * FROM TEST_TABLE_1 UNION ALL SELECT * FROM TEST_TABLE_2 MINUS SELECT * FROM TEST_TABLE_3" db-types="Oracle" />
     <sql-case id="select_union_subquery" value="(SELECT TEST_ID FROM  TEST_TABLE) UNION (SELECT TEST_ID FROM TEST_TABLE)" db-types="Oracle" />
+    <sql-case id="select_union_with_order_by" value="SELECT FINISH_DATE FROM HIST UNION SELECT FINISH_DATE FROM CURR ORDER BY FINISH_DATE DESC" db-types="Oracle" />
+    <sql-case id="select_union_order_by_left_subquery_with_null" value="SELECT B.ORDER_ID FROM (SELECT T.ORDER_ID FROM T_ORDER T WHERE T.ORDER_ID BETWEEN 1000 AND 1001 ORDER BY T.ORDER_ID DESC) B UNION SELECT NULL FROM T_USER U WHERE U.USER_ID BETWEEN 10 AND 12 ORDER BY ORDER_ID DESC" db-types="Oracle" />
     <sql-case id="select_union_case_when_order_by" value="SELECT  PRODUCT_ID, PRODUCT_NAME, PRICE, CASE  WHEN REGION = 'NORTH' THEN 'NORTH REGION'  WHEN REGION = 'SOUTH' THEN 'SOUTH REGION'  ELSE 'OTHER REGION'  END AS REGION FROM PRODUCTS
     UNION SELECT PRODUCT_ID, PRODUCT_NAME, PRICE, CASE WHEN COUNTRY = 'USA' THEN 'USA' WHEN COUNTRY = 'CHINA' THEN 'CHINA' ELSE 'OTHER COUNTRY' END AS COUNTRY FROM PRODUCTS
     UNION SELECT PRODUCT_ID, PRODUCT_NAME, PRICE, CASE WHEN CONTINENT = 'AMERICA' THEN 'AMERICA' WHEN CONTINENT = 'EUROPE' THEN 'EUROPE' ELSE 'OTHER CONTINENT' END AS CONTINENT FROM PRODUCTS ORDER BY PRODUCT_ID" db-types="Oracle" />
```

---

### Incident Patch 2: `6f67b6b4` (2026-09-29)
**Commit Message**: Fix Oracle encrypted projection parentheses (#40000)

* Fix Oracle encrypted projection parentheses

* Remove high frequency annotations from Oracle parser visitor

**File**: `parser/sql/engine/dialect/oracle/src/main/java/org/apache/shardingsphere/sql/parser/engine/oracle/visitor/statement/OracleStatementVisitor.java` (modified, +19/-9)
```diff
@@ -174,6 +174,7 @@
 import org.apache.shardingsphere.sql.parser.statement.core.segment.generic.DataTypeSegment;
 import org.apache.shardingsphere.sql.parser.statement.core.segment.generic.OwnerSegment;
 import org.apache.shardingsphere.sql.parser.statement.core.segment.generic.ParameterMarkerSegment;
+import org.apache.shardingsphere.sql.parser.statement.core.segment.generic.ParenthesesSegment;
 import org.apache.shardingsphere.sql.parser.statement.core.segment.generic.WindowItemSegment;
 import org.apache.shardingsphere.sql.parser.statement.core.segment.generic.table.SimpleTableSegment;
 import org.apache.shardingsphere.sql.parser.statement.core.segment.generic.table.TableNameSegment;
@@ -620,7 +621,12 @@ public final ASTNode visitExpr(final ExprContext ctx) {
             return visit(ctx.booleanPrimary());
         }
         if (null != ctx.LP_()) {
-            return visit(ctx.expr(0));
+            ASTNode result = visit(ctx.expr(0));
+            if (result instanceof ColumnSegment) {
+                ((ColumnSegment) result).setLeftParentheses(new ParenthesesSegment(ctx.LP_().getSymbol().getStartIndex(), ctx.LP_().getSymbol().getStopIndex(), ctx.LP_().getSymbol().getText()));
+                ((ColumnSegment) result).setRightParentheses(new ParenthesesSegment(ctx.RP_().getSymbol().getStartIndex(), ctx.RP_().getSymbol().getStopIndex(), ctx.RP_().getSymbol().getText()));
+            }
+            return result;
         }
         if (null != ctx.andOperator()) {
             return createBinaryOperationExpression(ctx, ctx.andOperator().getText());
@@ -854,16 +860,20 @@ public final ASTNode visitSimpleExpr(final SimpleExprContext ctx) {
         if (null != ctx.privateExprOfDb()) {
             return visit(ctx.privateExprOfDb());
         }
+        if (null != ctx.LP_() && 1 == ctx.expr().size()) {
+            ASTNode result = visit(ctx.expr(0));
+            if (result instanceof ColumnSegment) {
+                ((ColumnSegment) result).setLeftParentheses(new ParenthesesSegment(ctx.LP_().getSymbol().getStartIndex(), ctx.LP_().getSymbol().getStopIndex(), ctx.LP_().getSymbol().getText()));
+                ((ColumnSegment) result).setRightParentheses(new ParenthesesSegment(ctx.RP_().getSymbol().getStartIndex(), ctx.RP_().getSymbol().getStopIndex(), ctx.RP_().getSymbol().getText()));
+            }
+            return result;
+        }
         if (null != ctx.LP_()) {
-            if (1 == ctx.expr().size()) {
-                return visit(ctx.expr(0));
-            } else {
-                ListExpression result = new ListExpression(ctx.LP_().getSymbol().getStartIndex(), ctx.RP_().getSymbol().getStopIndex());
-                for (ExprContext each : ctx.expr()) {
-                    result.getItems().add((ExpressionSegment) visit(each));
-                }
-                return result;
+            ListExpression result = new ListExpression(ctx.LP_().getSymbol().getStartIndex(), ctx.RP_().getSymbol().getStopIndex());
+            for (ExprContext each : ctx.expr()) {
+                result.getItems().add((ExpressionSegment) visit(each));
             }
+            return result;
         }
         return visitRemainSimpleExpr(ctx, startIndex, stopIndex);
     }
```

**File**: `test/it/parser/src/main/resources/case/dml/select.xml` (modified, +27/-0)
```diff
@@ -3572,6 +3572,21 @@
         </order-by>
     </select>
 
+    <select sql-case-id="select_distinct_function_nulls_last_oracle">
+        <from>
+            <simple-table name="t_order_item" start-index="30" stop-index="41" />
+        </from>
+        <projections distinct-row="true" start-index="15" stop-index="23">
+            <column-projection start-index="16" stop-index="22" name="item_id">
+                <left-parentheses parentheses="(" start-index="15" stop-index="15" />
+                <right-parentheses parentheses=")" start-index="23" stop-index="23" />
+            </column-projection>
+        </projections>
+        <order-by>
+            <column-item name="item_id" start-index="52" stop-index="58" />
+        </order-by>
+    </select>
+
     <select sql-case-id="select_distinct_with_count_calculation" >
         <from>
             <simple-table name="t_order" start-index="49" stop-index="55" />
@@ -15399,4 +15414,16 @@
             </expr>
         </where>
     </select>
+    <select sql-case-id="select_oracle_parenthesized_column_alias">
+        <from>
+            <simple-table name="t_account" alias="c" start-index="34" stop-index="44" />
+        </from>
+        <projections start-index="7" stop-index="27">
+            <column-projection name="password" alias="PASSWORD" start-index="8" stop-index="27">
+                <owner name="c" start-index="8" stop-index="8" />
+                <left-parentheses parentheses="(" start-index="7" stop-index="7" />
+                <right-parentheses parentheses=")" start-index="18" stop-index="18" />
+            </column-projection>
+        </projections>
+    </select>
 </sql-parser-test-cases>
```

**File**: `test/it/parser/src/main/resources/sql/supported/dml/select-distinct.xml` (modified, +2/-1)
```diff
@@ -42,7 +42,8 @@
     <sql-case id="select_distinct_with_count_group_by" value="SELECT COUNT(DISTINCT order_id) c, order_id FROM t_order GROUP BY order_id ORDER BY order_id" />
     <!-- TODO support more database type like PostgreSQL,openGauss,Oracle,SQLServer-->
     <sql-case id="select_distinct_function" value="SELECT DISTINCT(item_id) FROM t_order_item ORDER BY item_id" db-types="H2,MySQL,Doris" />
-    <sql-case id="select_distinct_function_nulls_last" value="SELECT DISTINCT(item_id) FROM t_order_item ORDER BY item_id" db-types="PostgreSQL,openGauss,Oracle" />
+    <sql-case id="select_distinct_function_nulls_last" value="SELECT DISTINCT(item_id) FROM t_order_item ORDER BY item_id" db-types="PostgreSQL,openGauss" />
+    <sql-case id="select_distinct_function_nulls_last_oracle" value="SELECT DISTINCT(item_id) FROM t_order_item ORDER BY item_id" db-types="Oracle" />
     <sql-case id="select_distinct_with_count_calculation" value="SELECT COUNT(DISTINCT user_id + order_id) c FROM t_order WHERE order_id &lt; 1100" />
     <sql-case id="select_distinct_with_aggregation_functions" value="SELECT SUM(DISTINCT order_id),count(DISTINCT order_id),count(order_id)  FROM t_order WHERE order_id &lt; 1100" />
 </sql-cases>
```

**File**: `test/it/parser/src/main/resources/sql/supported/dml/select.xml` (modified, +1/-0)
```diff
@@ -582,4 +582,5 @@
     <sql-case id="select_for_system_version_as_of_hive" value="SELECT * FROM table_a FOR SYSTEM_VERSION AS OF 1234567;" db-types="Hive" />
     <sql-case id="select_in_with_owner_column_rhs_oracle" value="SELECT * FROM t_order o WHERE o.user_id IN o.order_id" db-types="Oracle" />
     <sql-case id="select_in_with_function_rhs_oracle" value="SELECT * FROM t_order o WHERE o.user_id IN NVL(o.order_id, 0)" db-types="Oracle" />
+    <sql-case id="select_oracle_parenthesized_column_alias" value="SELECT (c.password) PASSWORD FROM t_account c" db-types="Oracle" />
 </sql-cases>
```

**File**: `test/it/rewriter/src/test/resources/scenario/encrypt/case/query-with-cipher/dml/select/select-projection.xml` (modified, +4/-0)
```diff
@@ -96,4 +96,8 @@
         <input sql="SELECT `account_id`, `password`, `amount` AS `a`, `status` AS `s` FROM `t_account` WHERE `account_id` = ? AND `password` = ? AND `password` like ? AND amount = ? AND status = ?" parameters="1, aaa, aaa, 1000, OK" />
         <output sql="SELECT `account_id`, `cipher_password` AS `password`, `cipher_amount` AS `a`, `status` AS `s` FROM `t_account` WHERE `account_id` = ? AND `assisted_query_password` = ? AND `like_query_password` like ? AND `cipher_amount` = ? AND status = ?" parameters="1, assisted_query_aaa, like_query_aaa, encrypt_1000, OK" />
     </rewrite-assertion>
+    <rewrite-assertion id="select_oracle_parenthesized_encrypt_projection" db-types="Oracle">
+        <input sql="SELECT (c.password) PASSWORD FROM t_account c" />
+        <output sql="SELECT (c.&quot;cipher_password&quot;) AS PASSWORD FROM t_account c" />
+    </rewrite-assertion>
 </rewrite-assertions>
```

---

### Incident Patch 3: `28ee1911` (2026-09-28)
**Commit Message**: Fix SQL Federation provider validation before rule persistence (#39989)

**File**: `kernel/sql-federation/core/src/main/java/org/apache/shardingsphere/sqlfederation/rule/SQLFederationProviderFactory.java` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+/*
+ * Licensed to the Apache Software Foundation (ASF) under one or more
+ * contributor license agreements.  See the NOTICE file distributed with
+ * this work for additional information regarding copyright ownership.
+ * The ASF licenses this file to You under the Apache License, Version 2.0
+ * (the "License"); you may not use this file except in compliance with
+ * the License.  You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package org.apache.shardingsphere.sqlfederation.rule;
+
+import lombok.AccessLevel;
+import lombok.NoArgsConstructor;
+import org.apache.shardingsphere.infra.exception.ShardingSpherePreconditions;
+import org.apache.shardingsphere.infra.spi.ShardingSphereServiceLoader;
+import org.apache.shardingsphere.infra.spi.type.typed.TypedSPILoader;
+import org.apache.shardingsphere.sqlfederation.exception.SQLFederationProviderDuplicatedException;
+import org.apache.shardingsphere.sqlfederation.exception.SQLFederationProviderNotFoundException;
+import org.apache.shardingsphere.sqlfederation.spi.SQLFederationProvider;
+
+import java.util.HashSet;
+import java.util.Locale;
+import java.util.Set;
+
+/**
+ * SQL federation provider factory.
+ */
+@NoArgsConstructor(access = AccessLevel.PRIVATE)
+public final class SQLFederationProviderFactory {
+    
+    /**
+     * Get SQL federation provider without calling SQLFederationProvider.initialize.
+     *
+     * @param providerType provider type, or null to select CALCITE
+     * @return selected provider
+     */
+    public static SQLFederationProvider getProvider(final String providerType) {
+        String actualProviderType = null == providerType ? "CALCITE" : providerType;
+        Set<String> types = new HashSet<>();
+        for (SQLFederationProvider each : ShardingSphereServiceLoader.getServiceInstances(SQLFederationProvider.class)) {
+            ShardingSpherePreconditions.checkState(types.add(each.getType().toUpperCase(Locale.ROOT)), () -> new SQLFederationProviderDuplicatedException(each.getType()));
+        }
+        return TypedSPILoader.findService(SQLFederationProvider.class, actualProviderType)
+                .orElseThrow(() -> new SQLFederationProviderNotFoundException(actualProviderType));
+    }
+}
```

**File**: `kernel/sql-federation/core/src/main/java/org/apache/shardingsphere/sqlfederation/rule/SQLFederationRule.java` (modified, +1/-16)
```diff
@@ -20,18 +20,11 @@
 import lombok.Getter;
 import org.apache.shardingsphere.infra.metadata.database.ShardingSphereDatabase;
 import org.apache.shardingsphere.infra.rule.scope.GlobalRule;
-import org.apache.shardingsphere.infra.spi.ShardingSphereServiceLoader;
-import org.apache.shardingsphere.infra.spi.type.typed.TypedSPILoader;
 import org.apache.shardingsphere.sqlfederation.config.SQLFederationRuleConfiguration;
 import org.apache.shardingsphere.sqlfederation.constant.SQLFederationOrder;
-import org.apache.shardingsphere.sqlfederation.exception.SQLFederationProviderDuplicatedException;
-import org.apache.shardingsphere.sqlfederation.exception.SQLFederationProviderNotFoundException;
 import org.apache.shardingsphere.sqlfederation.spi.SQLFederationProvider;
 
 import java.util.Collection;
-import java.util.HashSet;
-import java.util.Locale;
-import java.util.Set;
 
 /**
  * SQL federation rule.
@@ -49,15 +42,7 @@ public SQLFederationRule(final SQLFederationRuleConfiguration ruleConfig, final
     }
     
     private SQLFederationProvider createProvider(final Collection<ShardingSphereDatabase> databases) {
-        String providerType = null == configuration.getProviderType() ? "CALCITE" : configuration.getProviderType();
-        Set<String> types = new HashSet<>();
-        for (SQLFederationProvider each : ShardingSphereServiceLoader.getServiceInstances(SQLFederationProvider.class)) {
-            if (!types.add(each.getType().toUpperCase(Locale.ROOT))) {
-                throw new SQLFederationProviderDuplicatedException(each.getType());
-            }
-        }
-        SQLFederationProvider result = TypedSPILoader.findService(SQLFederationProvider.class, providerType)
-                .orElseThrow(() -> new SQLFederationProviderNotFoundException(providerType));
+        SQLFederationProvider result = SQLFederationProviderFactory.getProvider(configuration.getProviderType());
         result.initialize(configuration, databases);
         return result;
     }
```

**File**: `kernel/sql-federation/core/src/test/java/org/apache/shardingsphere/sqlfederation/rule/SQLFederationProviderFactoryTest.java` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+/*
+ * Licensed to the Apache Software Foundation (ASF) under one or more
+ * contributor license agreements.  See the NOTICE file distributed with
+ * this work for additional information regarding copyright ownership.
+ * The ASF licenses this file to You under the Apache License, Version 2.0
+ * (the "License"); you may not use this file except in compliance with
+ * the License.  You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+package org.apache.shardingsphere.sqlfederation.rule;
+
+import org.apache.shardingsphere.infra.spi.ShardingSphereServiceLoader;
+import org.apache.shardingsphere.sqlfederation.exception.SQLFederationProviderDuplicatedException;
+import org.apache.shardingsphere.sqlfederation.exception.SQLFederationProviderNotFoundException;
+import org.apache.shardingsphere.sqlfederation.spi.SQLFederationProvider;
+import org.junit.jupiter.api.Test;
+import org.mockito.MockedStatic;
+
+import java.util.Arrays;
+import java.util.Collections;
+
+import static org.hamcrest.MatcherAssert.assertThat;
+import static org.hamcrest.Matchers.is;
+import static org.hamcrest.Matchers.sameInstance;
+import static org.junit.jupiter.api.Assertions.assertThrows;
+import static org.mockito.ArgumentMatchers.any;
+import static org.mockito.Mockito.mock;
+import static org.mockito.Mockito.mockStatic;
+import static org.mockito.Mockito.never;
+import static org.mockito.Mockito.verify;
+import static org.mockito.Mockito.when;
+
+class SQLFederationProviderFactoryTest {
+    
+    @Test
+    void assertExplicitProviderMissing() {
+        try (MockedStatic<ShardingSphereServiceLoader> serviceLoader = mockStatic(ShardingSphereServiceLoader.class)) {
+            serviceLoader.when(() -> ShardingSphereServiceLoader.getServiceInstances(SQLFederationProvider.class)).thenReturn(Collections.emptyList());
+            SQLFederationProviderNotFoundException actual = assertThrows(SQLFederationProviderNotFoundException.class, () -> SQLFederationProviderFactory.getProvider("UNKNOWN"));
+            assertThat(actual.getMessage(), is("SQL_FEDERATION-00001: SQL Federation provider 'UNKNOWN' is not installed."));
+        }
+    }
+    
+    @Test
+    void assertDefaultProviderMissing() {
+        try (MockedStatic<ShardingSphereServiceLoader> serviceLoader = mockStatic(ShardingSphereServiceLoader.class)) {
+            serviceLoader.when(() -> ShardingSphereServiceLoader.getServiceInstances(SQLFederationProvider.class)).thenReturn(Collections.emptyList());
+            SQLFederationProviderNotFoundException actual = assertThrows(SQLFederationProviderNotFoundException.class, () -> SQLFederationProviderFactory.getProvider(null));
+            assertThat(actual.getMessage(), is("SQL_FEDERATION-00001: SQL Federation provider 'CALCITE' is not installed."));
+        }
+    }
+    
+    @Test
+    void assertDuplicateProviderType() {
+        SQLFederationProvider first = mock(SQLFederationProvider.class);
+        SQLFederationProvider second = mock(SQLFederationProvider.class);
+        when(first.getType()).thenReturn("CALCITE");
+        when(second.getType()).thenReturn("calcite");
+        try (MockedStatic<ShardingSphereServiceLoader> serviceLoader = mockStatic(ShardingSphereServiceLoader.class)) {
+            serviceLoader.when(() -> ShardingSphereServiceLoader.getServiceInstances(SQLFederationProvider.class)).thenReturn(Arrays.asList(first, second));
+            SQLFederationProviderDuplicatedException actual = assertThrows(SQLFederationProviderDuplicatedException.class, () -> SQLFederationProviderFactory.getProvider(null));
+            assertThat(a
```

**File**: `kernel/sql-federation/core/src/test/java/org/apache/shardingsphere/sqlfederation/rule/SQLFederationRuleTest.java` (modified, +14/-0)
```diff
@@ -38,6 +38,7 @@
 import static org.junit.jupiter.api.Assertions.assertThrows;
 import static org.mockito.Mockito.mock;
 import static org.mockito.Mockito.mockStatic;
+import static org.mockito.Mockito.verify;
 import static org.mockito.Mockito.when;
 
 class SQLFederationRuleTest {
@@ -58,6 +59,19 @@ void assertRefreshDisabled() {
         assertNull(rule.getProvider());
     }
     
+    @Test
+    void assertConstructEnabledInitializesProvider() {
+        SQLFederationProvider expected = mock(SQLFederationProvider.class);
+        when(expected.getType()).thenReturn("CALCITE");
+        try (MockedStatic<ShardingSphereServiceLoader> serviceLoader = mockStatic(ShardingSphereServiceLoader.class)) {
+            serviceLoader.when(() -> ShardingSphereServiceLoader.getServiceInstances(SQLFederationProvider.class)).thenReturn(Collections.singleton(expected));
+            SQLFederationRuleConfiguration ruleConfig = new SQLFederationRuleConfiguration(true, false, new SQLFederationCacheOption(4, 64L));
+            SQLFederationRule actual = new SQLFederationRule(ruleConfig, Collections.emptyList());
+            assertThat(actual.getProvider(), sameInstance(expected));
+            verify(expected).initialize(ruleConfig, Collections.emptyList());
+        }
+    }
+    
     @Test
     void assertDefaultProviderMissing() {
         SQLFederationRuleConfiguration ruleConfig = new SQLFederationRuleConfiguration(true, false, new SQLFederationCacheOption(4, 64L));
```

**File**: `kernel/sql-federation/distsql/handler/src/main/java/org/apache/shardingsphere/sqlfederation/distsql/handler/update/AlterSQLFederationRuleExecutor.java` (modified, +6/-1)
```diff
@@ -23,6 +23,7 @@
 import org.apache.shardingsphere.sqlfederation.config.SQLFederationRuleConfiguration;
 import org.apache.shardingsphere.sqlfederation.distsql.segment.CacheOptionSegment;
 import org.apache.shardingsphere.sqlfederation.distsql.statement.updatable.AlterSQLFederationRuleStatement;
+import org.apache.shardingsphere.sqlfederation.rule.SQLFederationProviderFactory;
 import org.apache.shardingsphere.sqlfederation.rule.SQLFederationRule;
 
 /**
@@ -41,7 +42,11 @@ public SQLFederationRuleConfiguration buildToBeAlteredRuleConfiguration(final Al
                 ? rule.getConfiguration().getExecutionPlanCache()
                 : createCacheOption(rule.getConfiguration().getExecutionPlanCache(), sqlStatement.getExecutionPlanCache());
         String providerType = null == sqlStatement.getProviderType() ? rule.getConfiguration().getProviderType() : sqlStatement.getProviderType();
-        return new SQLFederationRuleConfiguration(sqlFederationEnabled, allQueryUseSQLFederation, executionPlanCache, providerType);
+        SQLFederationRuleConfiguration result = new SQLFederationRuleConfiguration(sqlFederationEnabled, allQueryUseSQLFederation, executionPlanCache, providerType);
+        if (result.isSqlFederationEnabled()) {
+            SQLFederationProviderFactory.getProvider(result.getProviderType());
+        }
+        return result;
     }
     
     private SQLFederationCacheOption createCacheOption(final SQLFederationCacheOption cacheOption, final CacheOptionSegment segment) {
```

---

### Incident Patch 4: `248582ec` (2026-09-26)
**Commit Message**: Fix PostgreSQL reserved keyword projection aliases (#39975)

**File**: `parser/sql/engine/dialect/postgresql/src/main/antlr4/imports/postgresql/DMLStatement.g4` (modified, +1/-1)
```diff
@@ -288,7 +288,7 @@ targetList
 
 targetEl
     : colId DOT_ASTERISK_
-    | aExpr AS identifier
+    | aExpr AS colLabel
     | aExpr identifier
     | aExpr
     | ASTERISK_
```

**File**: `parser/sql/engine/dialect/postgresql/src/main/java/org/apache/shardingsphere/sql/parser/engine/postgresql/visitor/statement/PostgreSQLStatementVisitor.java` (modified, +3/-2)
```diff
@@ -1272,8 +1272,9 @@ public ASTNode visitTargetList(final TargetListContext ctx) {
     @Override
     public ASTNode visitTargetEl(final TargetElContext ctx) {
         ProjectionSegment result = createProjectionSegment(ctx, ctx.aExpr());
-        if (null != ctx.identifier()) {
-            ((AliasAvailable) result).setAlias(new AliasSegment(ctx.identifier().start.getStartIndex(), ctx.identifier().stop.getStopIndex(), new IdentifierValue(ctx.identifier().getText())));
+        ParserRuleContext alias = null == ctx.colLabel() ? ctx.identifier() : ctx.colLabel();
+        if (null != alias) {
+            ((AliasAvailable) result).setAlias(new AliasSegment(alias.start.getStartIndex(), alias.stop.getStopIndex(), new IdentifierValue(alias.getText())));
         }
         return result;
     }
```

**File**: `test/it/parser/src/main/resources/case/dml/select.xml` (modified, +9/-0)
```diff
@@ -17,6 +17,15 @@
   -->
 
 <sql-parser-test-cases>
+    <select sql-case-id="select_keyword">
+        <projections start-index="7" stop-index="15">
+            <expression-projection text="1" alias="desc" start-index="7" stop-index="15">
+                <expr>
+                    <literal-expression start-index="7" stop-index="7" value="1" />
+                </expr>
+            </expression-projection>
+        </projections>
+    </select>
     <select sql-case-id="select_like">
         <from>
             <simple-table name="pg_constraint" start-index="74" stop-index="86" />
```

**File**: `test/it/parser/src/main/resources/sql/supported/dml/select.xml` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@
   -->
 
 <sql-cases>
+    <sql-case id="select_keyword" value="SELECT 1 AS desc" db-types="PostgreSQL" />
     <sql-case id="select_like" value="select conname, obj_description(oid, 'pg_constraint') as description from pg_constraint where conname like 'at_partitioned%' order by conname" db-types="PostgreSQL" />
     <sql-case id="select_not_scalar_subquery_postgresql" value="select 1 from t17 as ref_0 where not ((ref_0.c59) &lt; (select ref_1.c36 as c_0 from t23 as ref_1 join t22 as ref_2 on(ref_1.colocated_key = ref_2.colocated_key)))" db-types="PostgreSQL" />
     <sql-case id="select_values_derived_table_aliases_postgresql" value="SELECT * FROM (VALUES ('k1', 'v1', 1)) AS t(pk, col_a, col_a_type)" db-types="PostgreSQL" />
```

**File**: `test/it/parser/src/main/resources/sql/unsupported/unsupported.xml` (modified, +0/-1)
```diff
@@ -23,7 +23,6 @@
     <sql-case id="assert_dist_SQL_show_rule_parse_conflict" value="SHOW REPLICA_QUERY RULE FROM schema_name" />
     <sql-case id="unsupported_show_table_metadata_with_single_quoted_table_name" value="SHOW TABLE METADATA 'T_ORDER'" db-types="ShardingSphere" />
     <sql-case id="unsupported_refresh_table_metadata_with_single_quoted_table_name" value="REFRESH TABLE METADATA 'T_ORDER'" db-types="ShardingSphere" />
-    <sql-case id="select_keyword" value="SELECT 1 AS desc" db-types="PostgreSQL" />
     <sql-case id="unsupported_select_json_value_on_error_for_doris" value="SELECT JSON_VALUE('{&quot;price&quot;: &quot;49.95&quot;}', '$.price' RETURNING DECIMAL(4,1) null on empty default 0 on error)" db-types="Doris" />
     <sql-case id="unsupported_alter_database_set_replica_quota_with_unit_for_doris" value="ALTER DATABASE example_db SET REPLICA QUOTA 1G" db-types="Doris" />
     <sql-case id="unsupported_alter_database_set_transaction_quota_with_unit_for_doris" value="ALTER DATABASE example_db SET TRANSACTION QUOTA 1G" db-types="Doris" />
```

---

### Incident Patch 5: `8695937f` (2026-09-26)
**Commit Message**: Correct SQL parser test coverage and fixtures (#39974)

* Fix GraalVM reflection metadata for SQL federation provider type

* Correct SQL parser test coverage and fixtures

**File**: `test/it/parser/src/main/resources/case/dal/describe.xml` (modified, +4/-4)
```diff
@@ -46,13 +46,13 @@
     </describe>
     
     <describe sql-case-id="describe_table_with_placeholder">
-        <simple-table name="tableName" start-index="5" stop-index="13" />
-        <column-wild name="___" start-index="15" stop-index="17" />
+        <simple-table name="tableName" start-index="9" stop-index="17" />
+        <column-wild name="___" start-index="19" stop-index="21" />
     </describe>
     
     <describe sql-case-id="describe_table_with_wild">
-        <simple-table name="tableName" start-index="5" stop-index="13" />
-        <column-wild name="u%" start-delimiter="`" end-delimiter="`" start-index="15" stop-index="18" />
+        <simple-table name="tableName" start-index="9" stop-index="17" />
+        <column-wild name="u%" start-delimiter="`" end-delimiter="`" start-index="19" stop-index="22" />
     </describe>
 
     <describe sql-case-id="describe_database_basic" />
```

**File**: `test/it/parser/src/main/resources/case/dml/select-expression.xml` (modified, +71/-0)
```diff
@@ -17,6 +17,77 @@
   -->
 
 <sql-parser-test-cases>
+    <select sql-case-id="select_case_when">
+        <from>
+            <join-table join-type="LEFT">
+                <left>
+                    <simple-table name="pg_class" alias="c" start-index="213" stop-index="222" />
+                </left>
+                <right>
+                    <simple-table name="old_oids" start-index="234" stop-index="241" />
+                </right>
+                <using-columns name="relname" start-index="250" stop-index="256" />
+            </join-table>
+        </from>
+        <projections start-index="7" stop-index="206">
+            <column-projection name="relname" start-index="7" stop-index="13" />
+            <expression-projection text="c.oid = oldoid" alias="orig_oid" start-index="15" stop-index="40" />
+            <expression-projection text="case relfilenode when 0 then 'none' when c.oid then 'own' when oldfilenode then 'orig' else 'OTHER' end" alias="storage" start-index="42" stop-index="155">
+                <expr>
+                    <case-when-expression>
+                        <case-expr>
+                            <column name="relfilenode" start-index="47" stop-index="57" />
+                        </case-expr>
+                        <when-exprs>
+                            <literal-expression value="0" start-index="64" stop-index="64" />
+                        </when-exprs>
+                        <when-exprs>
+                            <column name="oid" start-index="83" stop-index="87">
+                                <owner name="c" start-index="83" stop-index="83" />
+                            </column>
+                        </when-exprs>
+                        <when-exprs>
+                            <column name="oldfilenode" start-index="105" stop-index="115" />
+                        </when-exprs>
+                        <then-exprs>
+                            <literal-expression value="none" start-index="71" stop-index="76" />
+                        </then-exprs>
+                        <then-exprs>
+                            <literal-expression value="own" start-index="94" stop-index="98" />
+                        </then-exprs>
+                        <then-exprs>
+                            <literal-expression value="orig" start-index="122" stop-index="127" />
+                        </then-exprs>
+                        <else-expr>
+                            <literal-expression value="OTHER" start-index="134" stop-index="140" />
+                        </else-expr>
+                    </case-when-expression>
+                </expr>
+            </expression-projection>
+            <expression-projection text="obj_description(c.oid, 'pg_class')" alias="description" start-index="158" stop-index="206" />
+        </projections>
+        <where start-index="259" stop-index="294">
+            <expr>
+                <binary-operation-expression start-index="265" stop-index="294">
+                    <left>
+                        <column name="relname" start-index="265" stop-index="271" />
+                    </left>
+                    <operator>LIKE</operator>
+                    <right>
+                        <list-expression start-index="278" stop-index="294">
+                            <items>
+                                <literal-expression value="at_partitioned%" start-index="278" stop-index="294" />
+                            </items>
+                        </list-expression>
+                    </right>
+                </binary-operation-expression>
+            </expr>
+        </where>
+        <order-by>
+            <column-item name="relname" start-index="305" stop-index="311" />
+        </order-by>
+    </select>
+
     <select sql-case-id="select_with_performance_schema_global_status">
         <from>
             <simple-table name="global_status" start-index="24" stop-index="55">
```

**File**: `test/it/parser/src/main/resources/case/dml/select-with.xml` (modified, +64/-0)
```diff
@@ -17,6 +17,70 @@
   -->
 
 <sql-parser-test-cases>
+    <select sql-case-id="with_select">
+        <with start-index="0" stop-index="26">
+            <common-table-expression name="cte" start-index="5" stop-index="26">
+                <subquery-expression start-index="5" stop-index="26">
+                    <select>
+                        <projections start-index="20" stop-index="20">
+                            <expression-projection text="0" start-index="20" stop-index="20">
+                                <expr>
+                                    <literal-expression value="0" start-index="20" stop-index="20" />
+                                </expr>
+                            </expression-projection>
+                        </projections>
+                    </select>
+                </subquery-expression>
+            </common-table-expression>
+        </with>
+        <from>
+            <join-table join-type="COMMA">
+                <left>
+                    <simple-table name="cte" alias="a" start-index="45" stop-index="49" />
+                </left>
+                <right>
+                    <simple-table name="cte" alias="b" start-index="52" stop-index="56" />
+                </right>
+            </join-table>
+        </from>
+        <projections start-index="38" stop-index="38">
+            <shorthand-projection start-index="38" stop-index="38" />
+        </projections>
+        <comment start-index="22" stop-index="29" text="/*! ) */" />
+    </select>
+
+    <select sql-case-id="with_select_comment">
+        <with start-index="0" stop-index="29">
+            <common-table-expression name="cte" start-index="5" stop-index="29">
+                <subquery-expression start-index="5" stop-index="29">
+                    <select>
+                        <projections start-index="28" stop-index="28">
+                            <expression-projection text="0" start-index="28" stop-index="28">
+                                <expr>
+                                    <literal-expression value="0" start-index="28" stop-index="28" />
+                                </expr>
+                            </expression-projection>
+                        </projections>
+                    </select>
+                </subquery-expression>
+            </common-table-expression>
+        </with>
+        <from>
+            <join-table join-type="COMMA">
+                <left>
+                    <simple-table name="cte" alias="a" start-index="45" stop-index="49" />
+                </left>
+                <right>
+                    <simple-table name="cte" alias="b" start-index="52" stop-index="56" />
+                </right>
+            </join-table>
+        </from>
+        <projections start-index="38" stop-index="38">
+            <shorthand-projection start-index="38" stop-index="38" />
+        </projections>
+        <comment start-index="12" stop-index="19" text="/*! ( */" />
+    </select>
+
     <select sql-case-id="select_with_subquery_factoring">
         <with start-index="0" stop-index="110">
             <common-table-expression name="dept_costs" start-index="5" stop-index="110">
```

**File**: `test/it/parser/src/main/resources/case/dml/select.xml` (modified, +30/-0)
```diff
@@ -17,6 +17,36 @@
   -->
 
 <sql-parser-test-cases>
+    <select sql-case-id="select_like">
+        <from>
+            <simple-table name="pg_constraint" start-index="74" stop-index="86" />
+        </from>
+        <projections start-index="7" stop-index="67">
+            <column-projection name="conname" start-index="7" stop-index="13" />
+            <expression-projection text="obj_description(oid, 'pg_constraint')" alias="description" start-index="16" stop-index="67" />
+        </projections>
+        <where start-index="88" stop-index="123">
+            <expr>
+                <binary-operation-expression start-index="94" stop-index="123">
+                    <left>
+                        <column name="conname" start-index="94" stop-index="100" />
+                    </left>
+                    <operator>LIKE</operator>
+                    <right>
+                        <list-expression start-index="107" stop-index="123">
+                            <items>
+                                <literal-expression value="at_partitioned%" start-index="107" stop-index="123" />
+                            </items>
+                        </list-expression>
+                    </right>
+                </binary-operation-expression>
+            </expr>
+        </where>
+        <order-by>
+            <column-item name="conname" start-index="134" stop-index="140" />
+        </order-by>
+    </select>
+
     <select sql-case-id="select_not_scalar_subquery_postgresql" where-expression-type="NotExpression">
         <projections start-index="7" stop-index="7">
             <expression-projection text="1" start-index="7" stop-index="7">
```

**File**: `test/it/parser/src/main/resources/sql/supported/dal/describe.xml` (modified, +2/-2)
```diff
@@ -23,8 +23,8 @@
     <sql-case id="desc_table_with_wild" value="DESC tableName `u%`" db-types="MySQL" />
     <sql-case id="describe_table" value="DESCRIBE tableName" db-types="MySQL" />
     <sql-case id="describe_table_with_col_name" value="DESCRIBE tableName colName" db-types="MySQL" />
-    <sql-case id="describe_table_with_placeholder" value="DESC tableName ___" db-types="MySQL" />
-    <sql-case id="describe_table_with_wild" value="DESC tableName `u%`" db-types="MySQL" />
+    <sql-case id="describe_table_with_placeholder" value="DESCRIBE tableName ___" db-types="MySQL" />
+    <sql-case id="describe_table_with_wild" value="DESCRIBE tableName `u%`" db-types="MySQL" />
     <sql-case id="describe_database_basic" value="DESCRIBE DATABASE sales_db;" db-types="Hive" />
     <sql-case id="describe_database_extended" value="DESCRIBE DATABASE EXTENDED sales_db;" db-types="Hive" />
     <sql-case id="describe_schema_basic" value="DESCRIBE SCHEMA user_info;" db-types="Hive" />
```

---

### Incident Patch 6: `e784a076` (2026-09-26)
**Commit Message**: Fix GraalVM reflection metadata for SQL federation provider type (#39973)

**File**: `infra/reachability-metadata/src/main/resources/META-INF/native-image/org.apache.shardingsphere/generated-reachability-metadata/reachability-metadata.json` (modified, +4/-0)
```diff
@@ -7241,6 +7241,10 @@
           "name": "getExecutionPlanCache",
           "parameterTypes": []
         },
+        {
+          "name": "getProviderType",
+          "parameterTypes": []
+        },
         {
           "name": "isAllQueryUseSQLFederation",
           "parameterTypes": []
```

---

### Incident Patch 7: `f672ab60` (2026-09-26)
**Commit Message**: Fix @HighFrequencyInvocation (#39964)

**File**: `infra/executor/src/main/java/org/apache/shardingsphere/infra/executor/kernel/ExecutorEngine.java` (modified, +1/-1)
```diff
@@ -37,7 +37,6 @@
 /**
  * Executor engine.
  */
-@HighFrequencyInvocation
 @Getter
 public final class ExecutorEngine implements AutoCloseable {
     
@@ -69,6 +68,7 @@ public static ExecutorEngine createExecutorEngineWithSize(final int executorSize
      * @return execute result
      * @throws SQLException throw if execute failure
      */
+    @HighFrequencyInvocation
     public <I, O> List<O> execute(final ExecutionGroupContext<I> executionGroupContext,
                                   final ExecutorCallback<I, O> firstCallback, final ExecutorCallback<I, O> callback, final boolean serial) throws SQLException {
         if (executionGroupContext.getInputGroups().isEmpty()) {
```

**File**: `infra/executor/src/main/java/org/apache/shardingsphere/infra/executor/sql/process/Process.java` (modified, +6/-1)
```diff
@@ -39,7 +39,6 @@
 /**
  * Process.
  */
-@HighFrequencyInvocation
 @RequiredArgsConstructor
 @Getter
 public final class Process {
@@ -66,10 +65,12 @@ public final class Process {
     
     private final AtomicBoolean interrupted;
     
+    @HighFrequencyInvocation
     public Process(final ExecutionGroupContext<? extends SQLExecutionUnit> executionGroupContext) {
         this("", executionGroupContext, true);
     }
     
+    @HighFrequencyInvocation
     public Process(final String sql, final ExecutionGroupContext<? extends SQLExecutionUnit> executionGroupContext) {
         this(sql, executionGroupContext, false);
     }
@@ -113,6 +114,7 @@ private Map<Integer, Statement> createProcessStatements(final ExecutionGroupCont
     /**
      * Complete execution unit.
      */
+    @HighFrequencyInvocation
     public void completeExecutionUnit() {
         completedUnitCount.incrementAndGet();
     }
@@ -122,6 +124,7 @@ public void completeExecutionUnit() {
      *
      * @return interrupted
      */
+    @HighFrequencyInvocation
     public boolean isInterrupted() {
         return interrupted.get();
     }
@@ -140,6 +143,7 @@ public void setInterrupted(final boolean interrupted) {
      *
      * @return idle
      */
+    @HighFrequencyInvocation
     public boolean isIdle() {
         return idle.get();
     }
@@ -149,6 +153,7 @@ public boolean isIdle() {
      *
      * @param executionUnit execution unit
      */
+    @HighFrequencyInvocation
     public void removeProcessStatement(final ExecutionUnit executionUnit) {
         processStatements.remove(System.identityHashCode(executionUnit));
     }
```

**File**: `infra/executor/src/main/java/org/apache/shardingsphere/infra/executor/sql/process/ProcessRegistry.java` (modified, +4/-1)
```diff
@@ -32,7 +32,6 @@
 /**
  * Process registry.
  */
-@HighFrequencyInvocation
 @NoArgsConstructor(access = AccessLevel.PRIVATE)
 public final class ProcessRegistry {
     
@@ -45,6 +44,7 @@ public final class ProcessRegistry {
      *
      * @return got instance
      */
+    @HighFrequencyInvocation
     public static ProcessRegistry getInstance() {
         return INSTANCE;
     }
@@ -54,6 +54,7 @@ public static ProcessRegistry getInstance() {
      *
      * @param process process
      */
+    @HighFrequencyInvocation
     public void add(final Process process) {
         if (isSameExecutionProcess(process)) {
             merge(processes.get(process.getId()), process);
@@ -81,6 +82,7 @@ private void merge(final Process oldProcess, final Process newProcess) {
      * @param id process ID
      * @return process
      */
+    @HighFrequencyInvocation
     public Process get(final String id) {
         return processes.get(id);
     }
@@ -90,6 +92,7 @@ public Process get(final String id) {
      *
      * @param id process ID
      */
+    @HighFrequencyInvocation
     public void remove(final String id) {
         processes.remove(id);
     }
```

**File**: `kernel/data-pipeline/dialect/opengauss/src/main/java/org/apache/shardingsphere/data/pipeline/opengauss/ingest/incremental/dumper/OpenGaussIncrementalDumper.java` (modified, +1/-1)
```diff
@@ -61,7 +61,6 @@
 /**
  * Incremental dumper of openGauss.
  */
-@HighFrequencyInvocation
 @Slf4j
 public final class OpenGaussIncrementalDumper extends AbstractPipelineLifecycleRunnable implements IncrementalDumper {
     
@@ -95,6 +94,7 @@ public OpenGaussIncrementalDumper(final IncrementalDumperContext dumperContext,
         decodeWithTX = dumperContext.isDecodeWithTX();
     }
     
+    @HighFrequencyInvocation
     @SneakyThrows(InterruptedException.class)
     @Override
     protected void runBlocking() {
```

---

### Incident Patch 8: `39a8de35` (2026-09-25)
**Commit Message**: Fix logic table lookup for MySQL SHOW CREATE TABLE and SHOW INDEX (#39856)

* Fix logic table lookup for MySQL SHOW CREATE TABLE and SHOW INDEX

Resolve the sharding table from the logic table named in the statement
instead of reverse-looking up the actual table name from the result row,
which returned the first match when two logic tables share the same
actual table name in different storage units. SHOW TABLES keeps the
reverse lookup because its statement names no table.

* Fill actual PR number in Release Notes

* Look up SHOW INDEX logic table from the statement only

MySQL SHOW INDEX always names a table, so the empty-table fallback to the
ambiguous actual-table lookup was reachable only from test contexts without
a table. Resolve the logic table from the statement directly and give the
tests table-bearing contexts.

**File**: `RELEASE-NOTES.md` (modified, +1/-0)
```diff
@@ -103,6 +103,7 @@
 1. Encrypt: Fix stale encryptors leaking when altering an encrypt rule - [#39209](https://github.com/apache/shardingsphere/pull/39209)
 1. Shadow: Apply default shadow algorithm to shadow tables when swapping YAML rule configuration - [#39749](https://github.com/apache/shardingsphere/pull/39749)
 1. Shadow: Fix INSERT SELECT statement being routed to shadow data source - [#39751](https://github.com/apache/shardingsphere/pull/39751)
+1. Sharding: Fix logic table lookup for MySQL SHOW CREATE TABLE and SHOW INDEX - [#39856](https://github.com/apache/shardingsphere/pull/39856)
 
 ### Enhancements
 
```

**File**: `features/sharding/dialect/mysql/src/main/java/org/apache/shardingsphere/sharding/merge/mysql/type/MySQLShardingLogicTablesMergedResult.java` (modified, +7/-1)
```diff
@@ -28,6 +28,7 @@
 import org.apache.shardingsphere.sharding.rule.ShardingTable;
 
 import java.sql.SQLException;
+import java.util.Collection;
 import java.util.LinkedList;
 import java.util.List;
 import java.util.Map;
@@ -51,7 +52,7 @@ protected final List<MemoryQueryResultRow> init(final ShardingRule rule, final S
             while (each.next()) {
                 MemoryQueryResultRow memoryResultSetRow = new MemoryQueryResultRow(each);
                 String actualTableName = memoryResultSetRow.getCell(1).toString();
-                Optional<ShardingTable> shardingTable = rule.findShardingTableByActualTable(actualTableName);
+                Optional<ShardingTable> shardingTable = findShardingTable(rule, sqlStatementContext, actualTableName);
                 if (shardingTable.isPresent()) {
                     String logicTableName = shardingTable.get().getLogicTable();
                     memoryResultSetRow.setCell(1, logicTableName);
@@ -66,6 +67,11 @@ protected final List<MemoryQueryResultRow> init(final ShardingRule rule, final S
         return new LinkedList<>(result.values());
     }
     
+    private Optional<ShardingTable> findShardingTable(final ShardingRule rule, final SQLStatementContext sqlStatementContext, final String actualTableName) {
+        Collection<String> tableNames = sqlStatementContext.getTablesContext().getTableNames();
+        return tableNames.isEmpty() ? rule.findShardingTableByActualTable(actualTableName) : rule.findShardingTable(tableNames.iterator().next());
+    }
+    
     protected void setCellValue(final MemoryQueryResultRow memoryResultSetRow, final String logicTableName, final String actualTableName, final ShardingSphereTable table, final ShardingRule rule) {
     }
 }
```

**File**: `features/sharding/dialect/mysql/src/main/java/org/apache/shardingsphere/sharding/merge/mysql/type/MySQLShardingShowIndexMergedResult.java` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ protected List<MemoryQueryResultRow> init(final ShardingRule shardingRule, final
             while (each.next()) {
                 MemoryQueryResultRow memoryResultSetRow = new MemoryQueryResultRow(each);
                 String actualTableName = memoryResultSetRow.getCell(1).toString();
-                Optional<ShardingTable> shardingTable = shardingRule.findShardingTableByActualTable(actualTableName);
+                Optional<ShardingTable> shardingTable = shardingRule.findShardingTable(sqlStatementContext.getTablesContext().getTableNames().iterator().next());
                 if (shardingTable.isPresent()) {
                     String logicTableName = shardingTable.get().getLogicTable();
                     memoryResultSetRow.setCell(1, logicTableName);
```

**File**: `features/sharding/dialect/mysql/src/test/java/org/apache/shardingsphere/sharding/merge/mysql/type/MySQLShardingLogicTablesMergedResultTest.java` (modified, +8/-2)
```diff
@@ -60,12 +60,18 @@ private ShardingRule createShardingRule() {
     
     @Test
     void assertNextForEmptyQueryResult() throws SQLException {
-        assertFalse(new MySQLShardingLogicTablesMergedResult(rule, mock(SQLStatementContext.class), schema, Collections.emptyList()).next());
+        assertFalse(new MySQLShardingLogicTablesMergedResult(rule, mockSQLStatementContext(), schema, Collections.emptyList()).next());
     }
     
     @Test
     void assertNextForActualTableNameInTableRule() throws SQLException {
-        assertTrue(new MySQLShardingLogicTablesMergedResult(rule, mock(SQLStatementContext.class), schema, Collections.singletonList(mockQueryResult("table_0"))).next());
+        assertTrue(new MySQLShardingLogicTablesMergedResult(rule, mockSQLStatementContext(), schema, Collections.singletonList(mockQueryResult("table_0"))).next());
+    }
+    
+    private SQLStatementContext mockSQLStatementContext() {
+        SQLStatementContext result = mock(SQLStatementContext.class, RETURNS_DEEP_STUBS);
+        when(result.getTablesContext().getTableNames()).thenReturn(Collections.emptyList());
+        return result;
     }
     
     private QueryResult mockQueryResult(final String value) throws SQLException {
```

**File**: `features/sharding/dialect/mysql/src/test/java/org/apache/shardingsphere/sharding/merge/mysql/type/MySQLShardingShowCreateTableMergedResultTest.java` (modified, +52/-7)
```diff
@@ -36,10 +36,14 @@
 import org.junit.jupiter.api.BeforeEach;
 import org.junit.jupiter.api.Test;
 
+import javax.sql.DataSource;
 import java.sql.SQLException;
+import java.util.Arrays;
 import java.util.Collection;
 import java.util.Collections;
+import java.util.HashMap;
 import java.util.LinkedList;
+import java.util.Map;
 import java.util.Optional;
 
 import static org.hamcrest.MatcherAssert.assertThat;
@@ -76,20 +80,26 @@ private ShardingSphereSchema createSchema() {
         return new ShardingSphereSchema("foo_db", mock(DatabaseType.class), tables, Collections.emptyList());
     }
     
+    private SQLStatementContext mockSQLStatementContext(final String... tableNames) {
+        SQLStatementContext result = mock(SQLStatementContext.class, RETURNS_DEEP_STUBS);
+        when(result.getTablesContext().getTableNames()).thenReturn(Arrays.asList(tableNames));
+        return result;
+    }
+    
     @Test
     void assertNextForEmptyQueryResult() throws SQLException {
-        assertFalse(new MySQLShardingShowCreateTableMergedResult(rule, mock(SQLStatementContext.class), schema, Collections.emptyList()).next());
+        assertFalse(new MySQLShardingShowCreateTableMergedResult(rule, mockSQLStatementContext("foo_tbl"), schema, Collections.emptyList()).next());
     }
     
     @Test
     void assertNextWithTableRule() throws SQLException {
-        assertTrue(new MySQLShardingShowCreateTableMergedResult(rule, mock(SQLStatementContext.class), schema, Collections.singletonList(mockQueryResultWithTableRule())).next());
+        assertTrue(new MySQLShardingShowCreateTableMergedResult(rule, mockSQLStatementContext("foo_tbl"), schema, Collections.singletonList(mockQueryResultWithTableRule())).next());
     }
     
     @Test
     void assertGetValueWithTableRule() throws SQLException {
         MySQLShardingShowCreateTableMergedResult actual = new MySQLShardingShowCreateTableMergedResult(
-                rule, mock(SQLStatementContext.class), schema, Collections.singletonList(mockQueryResultWithTableRule()));
+                rule, mockSQLStatementContext("foo_tbl"), schema, Collections.singletonList(mockQueryResultWithTableRule()));
         assertTrue(actual.next());
         assertThat(actual.getValue(1, String.class), is("foo_tbl"));
         assertThat(actual.getValue(2, String.class), is("CREATE TABLE `foo_tbl` (\n"
@@ -123,7 +133,7 @@ private QueryResult mockQueryResultWithTableRule() throws SQLException {
     @Test
     void assertGetValueWithDollarSignInTableNames() throws SQLException {
         MySQLShardingShowCreateTableMergedResult actual = new MySQLShardingShowCreateTableMergedResult(
-                buildShardingRuleWithDollarSign(), mock(SQLStatementContext.class), createSchemaWithDollarSign(), Collections.singletonList(mockQueryResultWithDollarSign()));
+                buildShardingRuleWithDollarSign(), mockSQLStatementContext("foo$tbl"), createSchemaWithDollarSign(), Collections.singletonList(mockQueryResultWithDollarSign()));
         assertTrue(actual.next());
         assertThat(actual.getValue(2, String.class), is("CREATE TABLE `foo$tbl` (FOREIGN KEY (`bar_id`) REFERENCES `bar$tbl` (`bar_id`))"));
     }
@@ -159,10 +169,45 @@ private QueryResult mockQueryResultWithDollarSign() throws SQLException {
         return result;
     }
     
+    @Test
+    void assertGetValueWithSameActualTableNameInDifferentStorageUnits() throws SQLException {
+        MySQLShardingShowCreateTableMergedResult actual = new MySQLShardingShowCreateTableMergedResult(buildShardingRuleWithSameActualTableName(),
+                mockSQLStatementContext("t_order1"), createSchemaWithSameActualTableName(), Collections.singletonList(mockQueryResultWithSameActualTableName()));
+        assertTrue(actual.next());
+        assertThat(actual.getValue(1, String.class), is("t_order1"));
+        assertThat(actual.getValue(2, String.class), is("CREATE TABLE `t_order1` (`id` int(11) NOT NULL)"));
+    }
+    
+    private ShardingRule buildS
```

---

### Incident Patch 9: `8b510cd5` (2026-09-25)
**Commit Message**: Fix shadow DistSQL rejecting unquoted SQL_HINT algorithm type (#39873)

* Fix shadow DistSQL rejecting unquoted SQL_HINT algorithm type

* Keep SQL_HINT usable as shadow DistSQL identifier

Recognizing SQL_HINT as a keyword for the unquoted algorithm type made it
reserved wherever the shadow grammar expects IDENTIFIER_, so existing
statements such as CREATE SHADOW RULE SQL_HINT(...) failed to parse.
Accept SQL_HINT in the shadow identifier positions and add a parser case
for a rule named SQL_HINT.

**File**: `RELEASE-NOTES.md` (modified, +1/-0)
```diff
@@ -49,6 +49,7 @@
 1. DistSQL: Fix empty rows returned by SHOW SHADOW TABLE RULE for specified table - [#39739](https://github.com/apache/shardingsphere/pull/39739)
 1. DistSQL: Fix `CREATE READWRITE_SPLITTING RULE IF NOT EXISTS` failing for an existing rule name - [#39371](https://github.com/apache/shardingsphere/pull/39371)
 1. DistSQL: Match mask table names case-insensitively in create and alter executors - [#39361](https://github.com/apache/shardingsphere/pull/39361)
+1. DistSQL: Fix shadow DistSQL rejecting unquoted `SQL_HINT` algorithm type - [#39873](https://github.com/apache/shardingsphere/pull/39873)
 1. JDBC: Fix stale generated values leaking into prepared statement executeBatch calls without pending batches - [#38160](https://github.com/apache/shardingsphere/pull/38160)
 1. JDBC: Fix MySQL-compatible typed string conversion for `ResultSet#getObject(index, Class<T>)` - [#38444](https://github.com/apache/shardingsphere/pull/38444)
 1. JDBC: Fix statement close invalidating live result sets of other statements on the same connection - [#39503](https://github.com/apache/shardingsphere/pull/39503)
```

**File**: `features/shadow/distsql/parser/src/main/antlr4/imports/shadow/BaseRule.g4` (modified, +6/-2)
```diff
@@ -50,9 +50,13 @@ property
     ;
 
 tableName
-    : IDENTIFIER_
+    : identifier
     ;
 
 ruleName
-    : IDENTIFIER_
+    : identifier
+    ;
+
+identifier
+    : IDENTIFIER_ | SQL_HINT
     ;
```

**File**: `features/shadow/distsql/parser/src/main/antlr4/imports/shadow/Keyword.g4` (modified, +1/-1)
```diff
@@ -144,7 +144,7 @@ REGEX_MATCH
     ;
 
 SQL_HINT
-    : S I M P L E UL_ H I N T
+    : S Q L UL_ H I N T
     ;
 
 NOT
```

**File**: `features/shadow/distsql/parser/src/main/antlr4/imports/shadow/RDLStatement.g4` (modified, +4/-4)
```diff
@@ -56,19 +56,19 @@ shadowTableRule
     ;
 
 source
-    : IDENTIFIER_
+    : identifier
     ;
 
 shadow
-    : IDENTIFIER_
+    : identifier
     ;
 
 tableName
-    : IDENTIFIER_
+    : identifier
     ;
 
 algorithmName
-    : IDENTIFIER_
+    : identifier
     ;
 
 ifExists
```

**File**: `features/shadow/distsql/parser/src/main/antlr4/imports/shadow/RQLStatement.g4` (modified, +1/-1)
```diff
@@ -48,5 +48,5 @@ tableRule
     ;
 
 databaseName
-    : IDENTIFIER_
+    : identifier
     ;
```

---

### Incident Patch 10: `d9a60363` (2026-09-25)
**Commit Message**: Fix native reachability metadata for BVal and Presto (#39958)

* Remove SingletonSPI on GlobalClockProvider and

* Remove SingletonSPI on DeliverEventSubscriber

* Add ExpressionSegmentBinderTest

* Fix native reachability metadata for BVal and Presto

**File**: `infra/reachability-metadata/src/main/resources/META-INF/native-image/org.apache.shardingsphere/infra-reachability-metadata/reachability-metadata.json` (modified, +380/-0)
```diff
@@ -12,6 +12,66 @@
         }
       ]
     },
+    {
+      "condition": {
+        "typeReached": "org.apache.shardingsphere.infra.config.rule.validator.RuleConfigurationValidator"
+      },
+      "type": "org.apache.bval.constraints.NotEmptyValidator",
+      "methods": [
+        {
+          "name": "<init>",
+          "parameterTypes": []
+        }
+      ]
+    },
+    {
+      "condition": {
+        "typeReached": "org.apache.shardingsphere.infra.config.rule.validator.RuleConfigurationValidator"
+      },
+      "type": "org.apache.bval.constraints.NotEmptyValidatorForCharSequence",
+      "methods": [
+        {
+          "name": "<init>",
+          "parameterTypes": []
+        }
+      ]
+    },
+    {
+      "condition": {
+        "typeReached": "org.apache.shardingsphere.infra.config.rule.validator.RuleConfigurationValidator"
+      },
+      "type": "org.apache.bval.constraints.NotEmptyValidatorForCollection",
+      "methods": [
+        {
+          "name": "<init>",
+          "parameterTypes": []
+        }
+      ]
+    },
+    {
+      "condition": {
+        "typeReached": "org.apache.shardingsphere.infra.config.rule.validator.RuleConfigurationValidator"
+      },
+      "type": "org.apache.bval.constraints.NotEmptyValidatorForMap",
+      "methods": [
+        {
+          "name": "<init>",
+          "parameterTypes": []
+        }
+      ]
+    },
+    {
+      "condition": {
+        "typeReached": "org.apache.shardingsphere.infra.config.rule.validator.RuleConfigurationValidator"
+      },
+      "type": "org.apache.bval.constraints.NotNullValidator",
+      "methods": [
+        {
+          "name": "<init>",
+          "parameterTypes": []
+        }
+      ]
+    },
     {
       "condition": {
         "typeReached": "org.apache.shardingsphere.infra.config.rule.validator.RuleConfigurationValidator"
@@ -169,6 +229,306 @@
         }
       ]
     },
+    {
+      "condition": {
+        "typeReached": "org.apache.shardingsphere.infra.config.rule.validator.RuleConfigurationValidator"
+      },
+      "type": "org.apache.shardingsphere.infra.config.rule.validator.constraint.reference.ConfigurationReferenceExistsValidator",
+      "methods": [
+        {
+          "name": "<init>",
+          "parameterTypes": []
+        }
+      ]
+    },
+    {
+      "condition": {
+        "typeReached": "org.apache.shardingsphere.infra.config.rule.validator.RuleConfigurationValidator"
+      },
+      "type": "org.apache.shardingsphere.shadow.config.validator.ShadowRuleConfigurationValidator",
+      "methods": [
+        {
+          "name": "<init>",
+          "parameterTypes": []
+        }
+      ]
+    },
+    {
+      "condition": {
+        "typeReached": "org.apache.shardingsphere.infra.config.rule.validator.RuleConfigurationValidator"
+      },
+      "type": "org.apache.shardingsphere.sharding.api.config.validator.ShardingRuleConfigurationValidator",
+      "methods": [
+        {
+          "name": "<init>",
+          "parameterTypes": []
+        }
+      ]
+    },
+    {
+      "condition": {
+        "typeReached": "org.apache.shardingsphere.infra.config.rule.validator.RuleConfigurationValidator"
+      },
+      "type": "org.apache.shardingsphere.transaction.config.validator.TransactionProviderTypeValidator",
+      "methods": [
+        {
+          "name": "<init>",
+          "parameterTypes": []
+        }
+      ]
+    },
+    {
+      "condition": {
+        "typeReached": "org.apache.shardingsphere.infra.config.rule.validator.RuleConfigurationValidator"
+      },
+      "type": "org.apache.shardingsphere.infra.config.rule.validator.constraint.spi.SPITypeExistsValidator",
+      "methods": [
+        {
+          "name": "<init>",
+          "parameterTypes": []
+        }
+      ]
+    },
+    {
+      "condition": {
+        "typeReached": "org.apache.shardingsphere.infra.config.rule.validator.RuleConfigurationValidator"
+      },
+      "type": "org.apache.shardingsphere.encrypt.c
```

#### Recent Merged Pull Requests:
- **PR #40024** (2026-09-30): Remove useless constructor on SQLFederationRuleConfiguration (@terrymanu)
- **PR #40023** (2026-09-30): Remove useless parameters on SQLFederationProcessor (@terrymanu)
- **PR #40022** (2026-09-30): Make NONE the mandatory default SQL federation provider (@terrymanu)
- **PR #40021** (2026-09-30): Refactor SQL federation processor into a concrete class (@terrymanu)
- **PR #40019** (2026-09-30): Fix Oracle set operation ORDER BY binding (@FlyingZC)
- **PR #40018** (2026-09-30): Remove SQL Federation-specific provider validation (@terrymanu)
- **PR #40012** (2026-09-30): Rename reusable global environment workflow (@terrymanu)
- **PR #40011** (2026-09-30): Correct unknown provider fallback assertion (@terrymanu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
