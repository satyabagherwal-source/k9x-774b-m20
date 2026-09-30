# Forensic Learning Record (Deep Inspection): NVIDIA/NemoClaw

> **Canonical Artifact**: `07_PROJECT_LEARNING/nvidia-nemoclaw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NVIDIA/NemoClaw](https://github.com/NVIDIA/NemoClaw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:38:32.504Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA/NemoClaw`
- **Description**: Run agents like Hermes, LangChain Deep Agents, and OpenClaw more securely inside NVIDIA OpenShell with managed inference
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 22609 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/nemoclaw-contributor-update-dependencies/scripts/collect-hermes-release-supplement.py`
```
#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Reconcile published Hermes CalVer releases with a complete local Git clone."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


CALVER_RE = re.compile(r"^v(?P<parts>[0-9]+(?:\.[0-9]+){2,})$")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
MAX_RELEASE_JSON_BYTES = 32 * 1024 * 1024
MAX_RELEASES = 10_000
MAX_TAG_REFS_JSON_BYTES = 32 * 1024 * 1024
MAX_TAG_REFS = 10_000
COMMAND_TIMEOUT_SECONDS = 120


class SupplementError(RuntimeError):
    """Raised when the Hermes release sequence cannot be proven."""


def parse_calver(tag: str) -> tuple[int, ...]:
    """Parse a three-or-more-component Hermes CalVer tag."""

    match = CALVER_RE.fullmatch(tag)
    if match is None:
        raise SupplementError(f"invalid Hermes CalVer tag: {tag!r}")
    raw_parts = match.group("parts").split(".")
    if any(len(part) > 1 and part.startswith("0") for part in raw_parts):
        raise SupplementError(
            f"Hermes CalVer tag has a leading-zero component: {tag!r}"
        )
    return tuple(int(part) for part in raw_parts)


def flatten_pages(
    value: Any, *, description: str, max_records: int
) -> list[dict[str, Any]]:
    """Accept one GitHub API page or ``gh api --slurp`` page arrays."""

    if not isinstance(value, list):
        raise SupplementError(f"{description} JSON must be an array")
    flattened: list[Any] = []
    for item in value:
        if isinstance(item, list):
            flattened.extend(item)
        else:
            flattened.append(item)
    if len(flattened) > max_records:
        raise SupplementError(f"{description} list exceeds {max_records} records")
    if any(not isinstance(item, dict) for item in flattened):
        raise SupplementError(f"{description} list contains a non-object record")
    return flattened


def load_stable_releases(path: Path) -> dict[str, dict[str, Any]]:
    """Load unique, published stable Hermes CalVer releases."""

    try:
        raw = path.read_bytes()
    except OSError as error:
        raise SupplementError(f"could not read releases JSON: {error}") from error
    if len(raw) > MAX_RELEASE_JSON_BYTES:
        raise SupplementError(f"releases JSON exceeds {MAX_RELEASE_JSON_BYTES} bytes")
    try:
        parsed = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise SupplementError(f"could not parse releases JSON: {error}") from error

    releases: dict[str, dict[str, Any]] = {}
    for record in flatten_pages(
        parsed, description="GitHub release", max_records=MAX_RELEASES
    ):
        tag = record.get("tag_name")
        if not isinstance(tag, str) or CALVER_RE.fullmatch(tag) is None:
            continue
        if record.get("draft") is not False or record.get("prerelease") is not False:
            continue
        if tag in releases:
            raise SupplementError(f"duplicate stable release record for {tag!r}")
        url = record.get("html_url")
        published_at = record.get("published_at")
        release_id = record.get("id")
        if (
            not isinstance(url, str)
            or not url.startswith(
                "https://github.com/NousResearch/hermes-agent/releases/tag/"
            )
            or not isinstance(published_at, str)
            or not published_at
            or not isinstance(release_id, int)
        ):
            raise SupplementError(
                f"incomplete authoritative release record for {tag!r}"
            )
        releases[tag] = {
            "releaseId": release_id,
            "publishedAt": published_at,
            "url": url,
        }
    return releases


def load_remote_tag_refs(path: Path) -> dict[str, dict[str, str]]:
    """Load unique Hermes CalVer roots from a frozen GitHub tag-ref inventory."""

    try:
        raw = path.read_bytes()
    except OSError as error:
        raise SupplementError(
            f"could not read remote tag refs JSON: {error}"
        ) from error
    if len(raw) > MAX_TAG_REFS_JSON_BYTES:
        raise SupplementError(
            f"remote tag refs JSON exceeds {MAX_TAG_REFS_JSON_BYTES} bytes"
        )
    try:
        parsed = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise SupplementError(
            f"could not parse remote tag refs JSON: {error}"
        ) from error

    tag_refs: dict[str, dict[str, str]] = {}
    for record in flatten_pages(
        parsed, description="GitHub tag-ref", max_records=MAX_TAG_REFS
    ):
        full_ref = record.get("ref")
        if not isinstance(full_ref, str) or not full_ref.startswith("refs/tags/"):
            raise SupplementError(
                "GitHub tag-ref inventory contains an invalid tag ref"
            )
        tag = full_ref.removeprefix("refs/tags/")
        if CALVER_RE.fullmatch(tag) is None:
            continue
        if tag in tag_refs:
            raise SupplementError(f"duplicate GitHub tag-ref record for {tag!r}")

        target = record.get("object")
        if not isinstance(target, dict):
            raise SupplementError(
                f"incomplete authoritative GitHub tag-ref record for {tag!r}"
            )
        root_type = target.get("type")
        root_sha = target.get("sha")
        if root_type not in ("commit", "tag") or not isinstance(root_sha, str):
            raise SupplementError(
                f"incomplete authoritative GitHub tag-ref record for {tag!r}"
            )
        if SHA_RE.fullmatch(root_sha) is None:
            raise SupplementError(
                f"authoritative GitHub tag ref for {tag!r} has an invalid object SHA"
            )
        tag_refs[tag] = {
            "ref": full_ref,
            "rootObjectSha": root_sha,
            "rootObjectType": root_type,
        }
    return tag_refs


def resolve_git_executable(requested: str | None, repo: Path) -> str:
    """Resolve Git before consuming repository-controlled tag data."""

    candidate = requested or shutil.which("git")
    if candidate is None:
        raise SupplementError("could not resolve a trusted Git executable")
    path = Path(candidate).expanduser()
    if not path.is_absolute():
        raise SupplementError("the Git executable must be an absolute path")
    try:
        resolved = path.resolve(strict=True)
        repo_root = repo.resolve(strict=True)
    except OSError as error:
        raise SupplementError(
            f"could not resolve Git or repository path: {error}"
        ) from error
    if not resolved.is_file() or not os.access(resolved, os.X_OK):
        raise SupplementError("the resolved Git path is not executable")
    if resolved == repo_root or resolved.is_relative_to(repo_root):
        raise SupplementError(
            "the trusted Git executable must be outside the upstream clone"
        )
    return str(resolved)


def run_git(git_executable: str, repo: Path, *args: str, check: bool = True) -> str:
    """Run bounded Git without ambient configuration or lazy fetching."""

    environment = {
        "GIT_ATTR_NOSYSTEM": "1",
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_NO_LAZY_FETCH": "1",
        "GIT_NO_REPLACE_OBJECTS": "1",
        "GIT_PAGER": "cat",
        "GIT_TERMINAL_PROMPT": "0",
        "LC_ALL": "C",
        "PATH": os.defpath,
    }
    try:
        result = subprocess.run(
            [
                git_executable,
                "--no-pager",
                "-c",
                "log.showSignature=false",
                "-c",
                "core.commitGraph=false",
                "-c",
                "core.fsmonitor=false",
                "-C",
                str(repo),
                *args,
            ],
            check=False,

```

### Core Architecture Module: `.agents/skills/nemoclaw-contributor-update-dependencies/scripts/collect-release-ledger.py`
```
#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

"""Collect deterministic adjacent-release Git evidence for a dependency upgrade."""

from __future__ import annotations

import argparse
import json
import os
import re
import selectors
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import cmp_to_key
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urlparse


SEMVER_RE = re.compile(
    r"^v?(?P<major>0|[1-9][0-9]*)\."
    r"(?P<minor>0|[1-9][0-9]*)\."
    r"(?P<patch>0|[1-9][0-9]*)"
    r"(?:-(?P<prerelease>[0-9A-Za-z.-]+))?"
    r"(?:\+(?P<build>[0-9A-Za-z.-]+))?$"
)
SHA_RE = re.compile(r"[0-9a-f]{40}")
RFC3339_RE = re.compile(
    r"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}"
    r"(?:\.[0-9]+)?(?:Z|[+-][0-9]{2}:[0-9]{2})"
)
GITHUB_API_TIMEOUT_SECONDS = 30
GIT_COMMAND_TIMEOUT_SECONDS = 120
MAX_TAG_PEEL_DEPTH = 32
MAX_COMMAND_STDOUT_BYTES = 16 * 1024 * 1024
MAX_COMMAND_STDERR_BYTES = 1024 * 1024
MAX_COMMAND_STDIN_BYTES = 1024 * 1024
MAX_GIT_RECORDS = 100_000
MAX_REACHABLE_OBJECT_RECORDS = 1_000_000
MAX_GITHUB_PAGES = 1_000
MAX_GITHUB_RECORDS = 100_000
MAX_RELEASE_ENDPOINTS = 10_000
MAX_SEMVER_TAGS = MAX_RELEASE_ENDPOINTS
MAX_TOTAL_COMMIT_RECORDS = 200_000
MAX_TOTAL_CHANGED_PATH_RECORDS = 200_000
MAX_LEDGER_OUTPUT_BYTES = 32 * 1024 * 1024


class LedgerError(RuntimeError):
    """Raised when the requested release range cannot be proven."""


@dataclass(frozen=True)
class GitCommandResult:
    """Captured output from one bounded, hermetic Git command."""

    returncode: int
    stdout: str
    stderr: str


@dataclass(frozen=True)
class TrustedExecutables:
    """Absolute executable identities resolved before upstream evidence is read."""

    gh: str | None
    git: str


TRUSTED_EXECUTABLES: TrustedExecutables | None = None


@dataclass(frozen=True)
class Version:
    """A SemVer identity with ordering suitable for release-ledger endpoints."""

    major: int
    minor: int
    patch: int
    prerelease: str | None = None
    build: str | None = None

    @classmethod
    def parse(cls, value: str) -> Version | None:
        """Parse a complete SemVer tag, accepting an optional leading ``v``."""

        match = SEMVER_RE.fullmatch(value)
        if not match:
            return None
        prerelease = match.group("prerelease")
        build = match.group("build")
        if prerelease is not None:
            identifiers = prerelease.split(".")
            if any(
                not identifier
                or (
                    identifier.isdigit()
                    and len(identifier) > 1
                    and identifier.startswith("0")
                )
                for identifier in identifiers
            ):
                return None
        if build is not None and any(not identifier for identifier in build.split(".")):
            return None
        return cls(
            int(match.group("major")),
            int(match.group("minor")),
            int(match.group("patch")),
            prerelease,
            build,
        )

    def compare_precedence(self, other: Version) -> int:
        """Return the SemVer precedence comparison, excluding build metadata."""

        core = (self.major, self.minor, self.patch)
        other_core = (other.major, other.minor, other.patch)
        if core != other_core:
            return -1 if core < other_core else 1
        if self.prerelease is None:
            return 0 if other.prerelease is None else 1
        if other.prerelease is None:
            return -1
        if self.prerelease == other.prerelease:
            return 0
        if self._prerelease_is_less(self.prerelease, other.prerelease):
            return -1
        return 1

    @staticmethod
    def _prerelease_is_less(left: str, right: str) -> bool:
        """Return whether one dot-delimited prerelease has lower precedence."""

        left_parts = left.split(".")
        right_parts = right.split(".")
        for left_part, right_part in zip(left_parts, right_parts):
            if left_part == right_part:
                continue
            left_numeric = left_part.isdigit()
            right_numeric = right_part.isdigit()
            if left_numeric and right_numeric:
                return int(left_part) < int(right_part)
            if left_numeric != right_numeric:
                return left_numeric
            return left_part < right_part
        return len(left_parts) < len(right_parts)

    def render(self) -> str:
        """Render the normalized version without a tag's optional leading ``v``."""

        base = f"{self.major}.{self.minor}.{self.patch}"
        if self.prerelease:
            base = f"{base}-{self.prerelease}"
        return f"{base}+{self.build}" if self.build else base


@dataclass(frozen=True)
class LocalSemverTag:
    """One batched local semantic-version tag identity."""

    commit_sha: str
    created_at: str
    kind: str
    root_object_sha: str
    tag: str
    version: Version


def compare_tagged_versions(
    left: tuple[Version, str], right: tuple[Version, str]
) -> int:
    """Order tagged versions by SemVer precedence and then tag identity."""

    precedence = left[0].compare_precedence(right[0])
    if precedence != 0:
        return precedence
    return (left[1] > right[1]) - (left[1] < right[1])


def resolve_trusted_executable(
    requested: str | None, name: str, upstream_repo: Path
) -> str:
    """Resolve one executable before reading input and reject upstream-owned tools."""

    candidate = requested or shutil.which(name)
    if not candidate:
        raise LedgerError(
            f"could not execute {name}: no trusted executable was resolved"
        )
    candidate_path = Path(candidate).expanduser()
    if not candidate_path.is_absolute():
        raise LedgerError(f"trusted {name} executable must be an absolute path")
    try:
        resolved = candidate_path.resolve(strict=True)
        repository_root = upstream_repo.expanduser().resolve(strict=True)
    except OSError as error:
        raise LedgerError(
            f"could not resolve trusted {name} executable: {error}"
        ) from error
    if not resolved.is_file() or not os.access(resolved, os.X_OK):
        raise LedgerError(
            f"trusted {name} executable is not an executable regular file"
        )
    if resolved == repository_root or resolved.is_relative_to(repository_root):
        raise LedgerError(
            f"trusted {name} executable must not come from the upstream worktree"
        )
    return str(resolved)


def configure_trusted_executables(args: argparse.Namespace) -> None:
    """Freeze Git and optional GitHub CLI identities before collection starts."""

    global TRUSTED_EXECUTABLES
    upstream_repo = Path(args.repo)
    git_executable = resolve_trusted_executable(
        args.git_executable, "git", upstream_repo
    )
    TRUSTED_EXECUTABLES = TrustedExecutables(gh=None, git=git_executable)
    if args.github_target_ref:
        require_valid_target_ref(args.github_target_ref)
    gh_executable = (
        resolve_trusted_executable(args.gh_executable, "gh", upstream_repo)
        if args.github_repository
        else None
    )
    TRUSTED_EXECUTABLES = TrustedExecutables(gh=gh_executable, git=git_executable)


def trusted_executables() -> TrustedExecutables:
    """Return the frozen executable identities or fail before invoking a subprocess."""

    if TRUSTED_EXECUTABLES is None:
        raise LedgerError("trusted executable identities were not configured")
    return TRUSTED_EXECUTABLES


def terminate_process_group(process: subprocess.Popen[bytes]) -> None:
    """Terminate a bounded command and any descendants that retain its output pipes."""

    try:
        os.kill
```

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

### Core Architecture Module: `.agents/skills/nemoclaw-maintainer-day/scripts/check-gates.ts`
```
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Deterministic merge-gate checker for a single NemoClaw PR.
 *
 * Checks all required gates and outputs structured JSON.
 * Claude uses the output to decide: approve, route to salvage, or report blockers.
 *
 * Usage: node --no-warnings .agents/skills/nemoclaw-maintainer-day/scripts/check-gates.ts <pr-number> [--repo OWNER/REPO]
 */

import { isDeepStrictEqual } from "node:util";
import {
  ghJson,
  isRiskyFile,
  isTestFile,
  parseStringArg,
  REQUIRED_CHECK_NAMES,
  run,
  type StatusCheck,
} from "./shared.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GateResult {
  pass: boolean;
  details: string;
}

interface PrIdentity {
  login?: string | null;
}

interface PrReview {
  author?: PrIdentity | null;
  state?: string | null;
  submittedAt?: string | null;
}

interface PrCommit {
  authors: PrIdentity[];
  authorCount: number;
}

interface ContributorApprovalHistory {
  commits: PrCommit[];
  reviews: PrReview[];
}

interface ContributorApprovalAdvisory {
  status: "clear" | "warning";
  details: string;
  actors: string[];
  uncertainActors: string[];
}

interface CodeRabbitThread {
  path: string;
  severity: "critical" | "major" | "minor" | "unknown";
  snippet: string;
  resolved: boolean;
}

interface GateOutput {
  pr: number;
  url: string;
  title: string;
  allPass: boolean;
  gates: {
    ci: GateResult & {
      failingChecks?: string[];
      pendingChecks?: string[];
      missingChecks?: string[];
    };
    conflicts: GateResult & {
      mergeable?: string;
      mergeStateStatus?: string;
      baseSha?: string;
      currentBaseSha?: string;
    };
    coderabbit: GateResult & { unresolvedThreads?: CodeRabbitThread[] };
    riskyCodeTested: GateResult & { riskyFiles?: string[]; hasTests?: boolean };
    contributorCompliance: GateResult & {
      dcoDeclarationPresent?: boolean;
      dcoDeclarationBypassed?: boolean;
      unverifiedCommits?: Array<{ sha: string; reason: string }>;
    };
  };
  advisories: {
    contributorApprovalOverlap: ContributorApprovalAdvisory;
  };
}

const CODERABBIT_LOGINS = new Set(["coderabbitai[bot]", "coderabbitai"]);
const OPINIONATED_REVIEW_STATES = new Set(["APPROVED", "CHANGES_REQUESTED", "DISMISSED"]);

function isAutomatedLogin(login: string): boolean {
  return login.endsWith("[bot]") || CODERABBIT_LOGINS.has(login);
}

function parseCompletePaginatedConnection<T>(raw: string): T[] | null {
  if (!raw) return null;

  const nodes: T[] = [];
  let expectedTotal: number | null = null;
  try {
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const page = JSON.parse(trimmed) as unknown;
      if (typeof page !== "object" || page === null || Array.isArray(page)) return null;
      const { nodes: pageNodes, totalCount } = page as Record<string, unknown>;
      if (
        !Array.isArray(pageNodes) ||
        typeof totalCount !== "number" ||
        !Number.isInteger(totalCount) ||
        totalCount < 0 ||
        (expectedTotal !== null && totalCount !== expectedTotal)
      ) {
        return null;
      }
      expectedTotal = totalCount;
      nodes.push(...(pageNodes as T[]));
    }
  } catch {
    return null;
  }
  return expectedTotal !== null && nodes.length === expectedTotal ? nodes : null;
}

function fetchContributorApprovalHistory(
  repo: string,
  number: number,
): ContributorApprovalHistory | null {
  const [owner, name, extra] = repo.split("/");
  if (!owner || !name || extra) return null;

  const variables = ["-F", `owner=${owner}`, "-F", `name=${name}`, "-F", `number=${number}`];
  const commitsRaw = run("gh", [
    "api",
    "graphql",
    "--paginate",
    ...variables,
    "-f",
    `query=query ContributorCommits($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          commits(first: 100, after: $endCursor) {
            nodes { commit { authors(first: 100) { totalCount nodes { user { login } } } } }
            totalCount
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }`,
    "--jq",
    "{nodes: [.data.repository.pullRequest.commits.nodes[] | {authors: [.commit.authors.nodes[] | {login: (.user.login // null)}], authorCount: .commit.authors.totalCount}], totalCount: .data.repository.pullRequest.commits.totalCount}",
  ]);
  const reviewsRaw = run("gh", [
    "api",
    "graphql",
    "--paginate",
    ...variables,
    "-f",
    `query=query ContributorReviews($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviews(first: 100, after: $endCursor) {
            nodes { author { login } state submittedAt }
            totalCount
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    }`,
    "--jq",
    "{nodes: .data.repository.pullRequest.reviews.nodes, totalCount: .data.repository.pullRequest.reviews.totalCount}",
  ]);

  const commits = parseCompletePaginatedConnection<PrCommit>(commitsRaw);
  const reviews = parseCompletePaginatedConnection<PrReview>(reviewsRaw);
  const completeCommitAuthors = commits?.every(
    (commit) =>
      Array.isArray(commit.authors) &&
      Number.isInteger(commit.authorCount) &&
      commit.authorCount === commit.authors.length,
  );
  return commits && reviews && completeCommitAuthors ? { commits, reviews } : null;
}

function checkContributorApprovalOverlap(
  pr: { author?: PrIdentity | null },
  history: ContributorApprovalHistory | null,
): ContributorApprovalAdvisory {
  if (!history) {
    return {
      status: "warning",
      details:
        "Could not retrieve complete paginated commit and review history, so contributor/approver overlap could not be determined. This warning is advisory and does not change allPass.",
      actors: [],
      uncertainActors: [],
    };
  }

  const normalizedLogin = (identity: PrIdentity | null | undefined): string | null => {
    const login = identity?.login?.trim().toLowerCase();
    return login || null;
  };
  const contributors = new Set<string>();
  const addContributor = (identity: PrIdentity | null | undefined): void => {
    const login = normalizedLogin(identity);
    if (login && !isAutomatedLogin(login)) contributors.add(login);
  };

  // Opening the PR is a contribution even when the opener authored no current commit.
  addContributor(pr.author);
  for (const commit of history.commits) {
    for (const author of commit.authors) addContributor(author);
  }

  const invalidTimestampLogins = new Set<string>();
  const reviews = history.reviews
    .map((review) => ({
      login: normalizedLogin(review.author),
      state: review.state?.toUpperCase() ?? "",
      submittedAt: Date.parse(review.submittedAt ?? ""),
    }))
    .filter(
      (review) =>
        review.login &&
        !isAutomatedLogin(review.login) &&
        OPINIONATED_REVIEW_STATES.has(review.state),
    );
  for (const review of reviews) {
    if (!Number.isFinite(review.submittedAt) && review.login) {
      invalidTimestampLogins.add(review.login);
    }
  }
  const orderedReviews = reviews
    .filter((review) => Number.isFinite(review.submittedAt))
    .sort((left, right) => left.submittedAt - right.submittedAt);
  const ambiguousLatestOpinionLogins = new Set<string>();
  const latestOpinionByLogin = new Map<string, { state: string; submittedAt: number }>();
  for (const review of orderedReviews) {
    if (!review.login) continue;
    const latest = latestOpinionByLogin.get(review.login);
    if (!latest || review.submittedAt > latest.submittedAt) {
      latestOpinionByLogin.se
```

### Core Architecture Module: `.agents/skills/nemoclaw-maintainer-day/scripts/handoff-summary.ts`
```
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Generate exact-range QA context for a release brief.
 *
 * Usage:
 *   node --no-warnings handoff-summary.ts \
 *     --plan PATH --output PATH
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { isRiskyFile } from "./shared.ts";

export interface HandoffInput {
  previousTag: string;
  previousTagCommit: string;
  targetVersion: string;
  candidateCommit: string;
  candidateSelection: "current-main" | "historical";
  historicalCandidateException: string;
}

export interface HandoffOutput extends HandoffInput {
  commitCount: number;
  riskyFileCount: number;
  riskyAreas: string[];
  suggestedTestFocus: string[];
}

type CommandRunner = (command: string, args: string[]) => string;

const SEMVER = /^v\d+\.\d+\.\d+$/;
const SHA = /^[0-9a-f]{40}$/;
const INCOMPLETE = "TODO_RELEASE_BRIEF";

const AREA_LABELS: Record<string, RegExp[]> = {
  "Installer / bootstrap": [
    /^install\.sh$/,
    /^setup\.sh$/,
    /^brev-setup\.sh$/,
    /^scripts\/.*\.sh$/,
  ],
  "Onboarding / host glue": [/^bin\/lib\/onboard\.js$/, /^bin\/.*\.js$/, /^src\/lib\/onboard\//],
  "Sandbox / policy / SSRF": [
    /^nemoclaw\/src\/blueprint\//,
    /^nemoclaw-blueprint\//,
    /policy/i,
    /ssrf/i,
  ],
  "Workflow / enforcement": [/^\.github\/workflows\//, /\.prek\./],
  "Credentials / inference": [/credential/i, /inference/i],
};

function run(command: string, args: string[]): string {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    }).trim();
  } catch (error) {
    const value = error as { stderr?: Buffer | string };
    const detail = value.stderr ? String(value.stderr).trim() : "";
    throw new Error(
      [`Command failed: ${command} ${args.join(" ")}`, detail].filter(Boolean).join("\n"),
    );
  }
}

function validateInput(input: HandoffInput): void {
  if (!SEMVER.test(input.previousTag)) throw new Error("previous tag must be vX.Y.Z");
  if (!SEMVER.test(input.targetVersion)) throw new Error("target version must be vX.Y.Z");
  if (!SHA.test(input.previousTagCommit)) {
    throw new Error("previous tag commit must be a lowercase 40-character Git SHA");
  }
  if (!SHA.test(input.candidateCommit)) {
    throw new Error("candidate commit must be a lowercase 40-character Git SHA");
  }
  if (input.candidateSelection === "current-main") {
    if (input.historicalCandidateException !== "None") {
      throw new Error("current-main input must not contain a historical candidate exception");
    }
  } else if (
    input.candidateSelection !== "historical" ||
    !/\S/u.test(input.historicalCandidateException) ||
    /[\u0000-\u001f\u007f]/u.test(input.historicalCandidateException)
  ) {
    throw new Error("historical input must contain a single-line exception reason");
  }
}

function suggestedFocus(areasHit: Set<string>, commitCount: number): string[] {
  const focus: string[] = [];
  if (areasHit.has("Installer / bootstrap")) focus.push("Fresh install and upgrade paths");
  if (areasHit.has("Onboarding / host glue")) {
    focus.push("Onboarding wizard and sandbox creation");
  }
  if (areasHit.has("Sandbox / policy / SSRF")) {
    focus.push("Policy enforcement, network egress, and SSRF protections");
  }
  if (areasHit.has("Workflow / enforcement")) {
    focus.push("CI checks, pre-commit hooks, and DCO declarations");
  }
  if (areasHit.has("Credentials / inference")) {
    focus.push("Credential storage and inference provider routing");
  }
  if (focus.length === 0 && commitCount > 0) {
    focus.push("General smoke test; no risky areas were detected");
  }
  return focus;
}

export function buildHandoffSummary(
  input: HandoffInput,
  command: CommandRunner = run,
): HandoffOutput {
  validateInput(input);

  const resolvedCandidate = command("git", ["rev-parse", `${input.candidateCommit}^{commit}`]);
  if (resolvedCandidate !== input.candidateCommit) {
    throw new Error(`candidate does not resolve to ${input.candidateCommit}`);
  }
  const mergeBase = command("git", ["merge-base", input.previousTagCommit, input.candidateCommit]);
  if (mergeBase !== input.previousTagCommit) {
    throw new Error("previous tag commit is not an ancestor of the candidate");
  }

  const range = `${input.previousTagCommit}..${input.candidateCommit}`;
  const commitCountText = command("git", ["rev-list", "--count", range]);
  if (!/^\d+$/u.test(commitCountText)) throw new Error("git returned an invalid commit count");
  const commitCount = Number(commitCountText);
  if (!Number.isSafeInteger(commitCount)) throw new Error("release range is too large");

  const changed = command("git", ["diff", "--name-only", range]);
  const changedFiles = changed
    ? changed
        .split("\n")
        .map((file) => file.trim())
        .filter(Boolean)
    : [];
  const riskyFilesTouched = changedFiles.filter(isRiskyFile);
  const areasHit = new Set<string>();
  for (const file of riskyFilesTouched) {
    for (const [area, patterns] of Object.entries(AREA_LABELS)) {
      if (patterns.some((pattern) => pattern.test(file))) areasHit.add(area);
    }
  }

  return {
    ...input,
    commitCount,
    riskyFileCount: riskyFilesTouched.length,
    riskyAreas: [...areasHit],
    suggestedTestFocus: suggestedFocus(areasHit, commitCount),
  };
}

function text(value: string): string {
  return value.replace(/([\\`*_[\]<>#])/g, "\\$1");
}

function code(value: string): string {
  return `\`${value.replace(/`/g, "\\`")}\``;
}

function list(values: string[], empty: string): string[] {
  return values.length ? values.map((value) => `- ${text(value)}`) : [`- ${empty}`];
}

export function renderHandoffMarkdown(summary: HandoffOutput): string {
  const lines = [
    `# NemoClaw ${summary.targetVersion} release brief`,
    "",
    "## Release range",
    "",
    `- Previous release: ${code(summary.previousTag)} at ${code(summary.previousTagCommit)}`,
    `- Candidate: ${code(summary.candidateCommit)}`,
    `- Candidate selection: ${summary.candidateSelection}`,
    ...(summary.candidateSelection === "historical"
      ? [`- Historical candidate exception: ${text(summary.historicalCandidateException)}`]
      : []),
    `- Commits: ${summary.commitCount}`,
    `- Risky files detected: ${summary.riskyFileCount}`,
    "",
    "## QA context",
    "",
    "### Risky areas",
    "",
    ...list(summary.riskyAreas, "None detected."),
    "",
    "### Suggested test focus",
    "",
    ...list(summary.suggestedTestFocus, "No test focus was inferred."),
    "",
    "## Canonical release entry",
    "",
    `- Path: ${INCOMPLETE}`,
    "- Entry:",
    "",
    INCOMPLETE,
    "",
    "## Documentation coverage",
    "",
    `- Latest included cumulative docs PR: ${INCOMPLETE}`,
    `- Final PR commit and merge commit: ${INCOMPLETE}`,
    `- Final automated refresh coverage commit: ${INCOMPLETE}`,
    `- Later commits and merged PRs: ${INCOMPLETE}`,
    `- Changed paths: ${INCOMPLETE}`,
    `- Review and checks: ${INCOMPLETE}`,
    `- Open managed docs PRs: ${INCOMPLETE}`,
    `- Maintainer decision: ${INCOMPLETE}`,
    "",
    "## Base and managed image evidence",
    "",
    `- Base-image candidate: ${code(summary.candidateCommit)}`,
    `- Evidence: ${INCOMPLETE}`,
    "",
    "## General E2E decision",
    "",
    `- ${INCOMPLETE}: displayed run, requested runs, and maintainer choice.`,
    "",
    `Exceptions: ${INCOMPLETE}`,
    "",
  ];
  return `${lines.join("\n")}\n`;
}

function parseArguments(argv: string[]): { output: string; plan: string } {
  let output = "";
  let plan = "";
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--plan") {
      plan = argv[++inde
```

### Core Architecture Module: `.agents/skills/nemoclaw-maintainer-day/scripts/hotspots.ts`
```
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Deterministic hotspot detection for NemoClaw.
 *
 * Combines 30-day git churn on main with open PR file overlap to rank
 * the files causing the most merge pain. Outputs structured JSON.
 *
 * Usage: node --no-warnings .agents/skills/nemoclaw-maintainer-day/scripts/hotspots.ts [--days N] [--repo OWNER/REPO]
 */

import { isRiskyFile, run, parseStringArg, parseIntArg } from "./shared.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Hotspot {
  path: string;
  mainTouchCount: number;
  openPrCount: number;
  combinedScore: number;
  isRisky: boolean;
}

interface HotspotOutput {
  generatedAt: string;
  repo: string;
  days: number;
  hotspots: Hotspot[];
}

// ---------------------------------------------------------------------------
// Data collection
// ---------------------------------------------------------------------------

function gitChurn(days: number): Map<string, number> {
  const out = run("git", [
    "log",
    `--since=${days} days ago`,
    "--name-only",
    "--format=",
    "origin/main",
  ]);

  const counts = new Map<string, number>();
  if (!out) return counts;

  for (const line of out.split("\n")) {
    const path = line.trim();
    if (path) {
      counts.set(path, (counts.get(path) ?? 0) + 1);
    }
  }
  return counts;
}

function openPrFileOverlap(repo: string): Map<string, number> {
  const prListOut = run("gh", [
    "pr",
    "list",
    "--repo",
    repo,
    "--state",
    "open",
    "--limit",
    "200",
    "--json",
    "number",
  ]);

  const counts = new Map<string, number>();
  if (!prListOut) return counts;

  let prs: Array<{ number: number }>;
  try {
    prs = JSON.parse(prListOut);
  } catch {
    return counts;
  }

  const sample = prs.slice(0, 50);
  for (const pr of sample) {
    const filesOut = run("gh", [
      "pr",
      "view",
      String(pr.number),
      "--repo",
      repo,
      "--json",
      "files",
    ]);
    if (!filesOut) continue;

    let data: { files?: Array<{ path: string }> };
    try {
      data = JSON.parse(filesOut);
    } catch {
      continue;
    }

    const seen = new Set<string>();
    for (const f of data.files ?? []) {
      if (!seen.has(f.path)) {
        seen.add(f.path);
        counts.set(f.path, (counts.get(f.path) ?? 0) + 1);
      }
    }
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const args = process.argv.slice(2);
  const days = parseIntArg(args, "--days", 30);
  const repo = parseStringArg(args, "--repo", "NVIDIA/NemoClaw");

  process.stderr.write("Collecting git churn...\n");
  const churn = gitChurn(days);

  process.stderr.write("Collecting open PR file overlap...\n");
  const prOverlap = openPrFileOverlap(repo);

  const allPaths = new Set([...churn.keys(), ...prOverlap.keys()]);
  const hotspots: Hotspot[] = [];

  for (const path of allPaths) {
    const mainTouchCount = churn.get(path) ?? 0;
    const openPrCount = prOverlap.get(path) ?? 0;

    if (mainTouchCount < 2 && openPrCount < 2) continue;

    const risky = isRiskyFile(path);
    // Score: main churn weight 1x, PR overlap 3x (conflict proxy), risky 2x bonus
    const combinedScore =
      mainTouchCount + openPrCount * 3 + (risky ? (mainTouchCount + openPrCount) * 2 : 0);

    hotspots.push({ path, mainTouchCount, openPrCount, combinedScore, isRisky: risky });
  }

  hotspots.sort((a, b) => b.combinedScore - a.combinedScore);

  const output: HotspotOutput = {
    generatedAt: new Date().toISOString(),
    repo,
    days,
    hotspots: hotspots.slice(0, 25),
  };

  console.log(JSON.stringify(output, null, 2));
}

main();

```

### Core Architecture Module: `.agents/skills/nemoclaw-maintainer-day/scripts/shared.ts`
```
// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Shared utilities for NemoClaw maintainer scripts.
 *
 * Centralizes risky-area detection, test-file detection, and shell helpers
 * so that triage, check-gates, and hotspots stay in sync.
 */

import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Risky area patterns — paths that need tests before approval
// ---------------------------------------------------------------------------

export const RISKY_PATTERNS: RegExp[] = [
  /^install\.sh$/,
  /^setup\.sh$/,
  /^brev-setup\.sh$/,
  /^scripts\/.*\.sh$/,
  /^bin\/lib\/onboard\.js$/,
  /^bin\/.*\.js$/,
  /^src\/lib\/onboard\//,
  /^nemoclaw\/src\/blueprint\//,
  /^nemoclaw-blueprint\//,
  /^\.github\/workflows\//,
  /^\.agents\/skills\/nemoclaw-maintainer-day\/scripts\/check-gates\.ts$/,
  /\.prek\./,
  /policy/i,
  /ssrf/i,
  /credential/i,
  /inference/i,
];

const DOCUMENTATION_PATTERNS: RegExp[] = [/^docs\//, /^fern\//];

export const TEST_PATTERNS: RegExp[] = [/\.test\.[jt]sx?$/, /\.spec\.[jt]sx?$/, /^test\//];

export function isRiskyFile(path: string): boolean {
  return (
    !DOCUMENTATION_PATTERNS.some((pattern) => pattern.test(path)) &&
    RISKY_PATTERNS.some((pattern) => pattern.test(path))
  );
}

export function isTestFile(path: string): boolean {
  return TEST_PATTERNS.some((re) => re.test(path));
}

// ---------------------------------------------------------------------------
// Shell helpers
// ---------------------------------------------------------------------------

/**
 * Run a command and return its stdout. On failure, logs the error to stderr
 * and returns an empty string so callers can handle the absence of data.
 */
export function run(cmd: string, args: string[], timeoutMs = 120_000): string {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf-8",
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
    }).trim();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[shared] ${cmd} ${args[0] ?? ""} failed: ${message}\n`);
    return "";
  }
}

/**
 * Run `gh` with the given args and parse the JSON output.
 * Returns null when the command fails or output is not valid JSON.
 */
export function ghJson(args: string[]): unknown {
  const out = run("gh", args);
  if (!out) return null;
  try {
    return JSON.parse(out);
  } catch {
    process.stderr.write(`[shared] gh JSON parse failed for: gh ${args.join(" ")}\n`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Required CI checks
// ---------------------------------------------------------------------------

// First-time fork contributors may need a maintainer to click "Approve and run" before
// pull_request checks execute. If any required context is missing from
// statusCheckRollup, CI cannot be considered green.
export const REQUIRED_CHECK_NAMES: string[] = [
  "checks", // pr.yaml — lint, typecheck, test
  "check-hash",
  "changes",
  "commit-lint", // commit-lint.yaml
  "dco-check", // dco-check.yaml
];

// ---------------------------------------------------------------------------
// Status check types
// ---------------------------------------------------------------------------

/** Union of CheckRun and StatusContext fields from GitHub's statusCheckRollup. */
export interface StatusCheck {
  __typename?: string;
  name?: string; // CheckRun field
  context?: string; // StatusContext field
  workflowName?: string; // CheckRun workflow identity
  startedAt?: string; // CheckRun/StatusContext RFC3339 timestamp
  completedAt?: string; // CheckRun RFC3339 timestamp
  detailsUrl?: string; // CheckRun workflow-run identity when Actions produced it
  status?: string; // CheckRun: COMPLETED, IN_PROGRESS, QUEUED, etc.
  conclusion?: string; // CheckRun: SUCCESS, FAILURE, NEUTRAL, SKIPPED, etc.
  state?: string; // StatusContext: SUCCESS, FAILURE, PENDING, ERROR
}

// ---------------------------------------------------------------------------
// Triage scoring weights
//
// Each weight reflects relative priority in the maintainer queue.
// Documented in nemoclaw-maintainer-day/PR-REVIEW-PRIORITIES.md.
// ---------------------------------------------------------------------------

/** PR passed all checks and is already approved — only needs final gate */
export const SCORE_MERGE_NOW = 40;
/** PR has green CI, no conflicts, not draft — ready for maintainer review */
export const SCORE_REVIEW_READY = 35;
/** PR is close to ready with a clear small fix path */
export const SCORE_NEAR_MISS = 30;
/** PR touches security-sensitive code and is actionable */
export const SCORE_SECURITY_ACTIONABLE = 20;
/** PR carries the "security" GitHub label */
export const SCORE_LABEL_SECURITY = 15;
/** PR has Urgent Project Priority */
export const SCORE_PROJECT_PRIORITY_URGENT = 15;
/** PR has High Project Priority */
export const SCORE_PROJECT_PRIORITY_HIGH = 10;
/** PR has been stale > 7 days — mild priority bump to prevent rot */
export const SCORE_STALE_AGE = 5;

/** Draft PRs or PRs with non-trivial merge conflicts are effectively blocked */
export const PENALTY_DRAFT_OR_CONFLICT = -100;
/** Unresolved major/critical CodeRabbit finding blocks approval */
export const PENALTY_CODERABBIT_MAJOR = -80;
/** Broad CI red with no obvious local fix — not worth salvaging yet */
export const PENALTY_BROAD_CI_RED = -60;
/** Blocked on external admin action (permissions, secrets, etc.) */
export const PENALTY_MERGE_BLOCKED = -20;

// ---------------------------------------------------------------------------
// CLI argument parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a string CLI flag from argv. Returns `defaultValue` when the flag is
 * absent or when the next token is missing / looks like another flag.
 */
export function parseStringArg(args: string[], flag: string, defaultValue: string): string {
  const idx = args.indexOf(flag);
  if (idx < 0) return defaultValue;
  const value = args[idx + 1];
  if (!value || value.startsWith("--")) {
    process.stderr.write(`[shared] ${flag} requires a value, using default: ${defaultValue}\n`);
    return defaultValue;
  }
  return value;
}

/**
 * Parse an integer CLI flag from argv. Returns `defaultValue` when the flag is
 * absent, the next token is missing, or the value is not a valid integer.
 */
export function parseIntArg(args: string[], flag: string, defaultValue: number): number {
  const idx = args.indexOf(flag);
  if (idx < 0) return defaultValue;
  const value = parseInt(args[idx + 1], 10);
  if (isNaN(value)) {
    process.stderr.write(`[shared] ${flag} requires a number, using default: ${defaultValue}\n`);
    return defaultValue;
  }
  return value;
}

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

### Incident Patch 1: `f8dbc3fe` (2026-09-29)
**Commit Message**: test(e2e): expect Balanced Homebrew preset (Fixes #12488) (#12489)

## Outcome

The OpenClaw Balanced common-egress test now expects the Homebrew preset
that Balanced onboarding applies. The test can continue through its
weather denial and explicit weather-add checks when that preset is
present.

## Reason

Balanced uses `brew-balanced`, but two live test snapshots still
expected `brew`. Recent runs stopped at those snapshots before checking
the rest of the scenario.

### Related issues

Fixes #12488

## Changes

- Update the initial and post-weather-add Balanced preset snapshots to
expect `brew-balanced`.
- Keep the Open, Personal, weather, and provenance assertions unchanged.
- Check the search-disabled OpenClaw Balanced preset selection in a fast
onboarding test, and map that test to the live E2E parity rule.

## Verification

- `npm run test:changed`: passed.
- `npx vitest run --project integration
test/onboarding/onboard-policy-suggestions.test.ts`: 62 tests passed.
- `npx tsx scripts/checks/e2e-mock-parity.mts --base origin/main --head
HEAD`: passed.
- `npm run test:e2e-phases:check`: passed.
- E2E assertion ratchet, import, and skip checks: passed.
- CLI TypeScript check wit

**File**: `test/e2e/live/common-egress-agent.test.ts` (modified, +2/-2)
```diff
@@ -642,7 +642,7 @@ describe.sequential("common-egress agent live targets", () => {
       expect(
         await listActivePolicyPresets(host, OPENCLAW_BALANCED_SANDBOX, "c1-balanced-initial"),
       ).toEqual([
-        { name: "brew", provenance: "user-added" },
+        { name: "brew-balanced", provenance: "user-added" },
         { name: "huggingface", provenance: "user-added" },
         { name: "npm", provenance: "user-added" },
         { name: "openclaw-pricing", provenance: "from openclaw agent" },
@@ -660,7 +660,7 @@ describe.sequential("common-egress agent live targets", () => {
       expect(
         await listActivePolicyPresets(host, OPENCLAW_BALANCED_SANDBOX, "c1-after-weather-add"),
       ).toEqual([
-        { name: "brew", provenance: "user-added" },
+        { name: "brew-balanced", provenance: "user-added" },
         { name: "huggingface", provenance: "user-added" },
         { name: "npm", provenance: "user-added" },
         { name: "openclaw-pricing", provenance: "from openclaw agent" },
```

**File**: `test/e2e/mock-parity.json` (modified, +1/-0)
```diff
@@ -535,6 +535,7 @@
       ],
       "fast": [
         "src/lib/policy/policy-live-state.test.ts",
+        "test/onboarding/onboard-policy-suggestions.test.ts",
         "test/e2e/support/workflow-plan.test.ts",
         "test/e2e/support/common-egress-agent-helpers.test.ts",
         "test/e2e/support/e2e-cleanup-resources.test.ts",
```

**File**: `test/onboarding/onboard-policy-suggestions.test.ts` (modified, +17/-0)
```diff
@@ -314,6 +314,23 @@ describe("onboard policy preset suggestions", () => {
     expect(suggestions).not.toContain("weather");
   });
 
+  it("selects the Balanced common-egress presets without search for OpenClaw", () => {
+    const suggestions = computeSetupPresetSuggestions("balanced", {
+      enabledChannels: [],
+      knownPresetNames: [...known, "openclaw-pricing"],
+      agent: "openclaw",
+      webSearchConfig: null,
+      webSearchSupported: false,
+    });
+    expect([...suggestions].sort()).toEqual([
+      "brew-balanced",
+      "huggingface",
+      "npm",
+      "openclaw-pricing",
+      "pypi",
+    ]);
+  });
+
   it("adds openclaw-pricing to tier suggestions when agent is openclaw", () => {
     const knownWithPricing = [...known, "openclaw-pricing"];
     const openclawSuggestions = computeSetupPresetSuggestions("balanced", {
```

---

### Incident Patch 2: `15f9f81a` (2026-09-29)
**Commit Message**: fix(skills): preserve authorized PR follow-up (#12485)

## Outcome

Authorized PR work now continues without a second approval when a
workflow or live E2E file changes, a mechanical base conflict needs
resolution, or review identifies one established in-scope repair. Manual
live E2E dispatch still requires target-specific authority.

## Reason

The current guidance can treat file location and broad risk labels as
new approval requirements after the task has already established scope.
That causes avoidable pauses and can preserve out-of-scope behavior
instead of removing it.

## Changes

- Base approval decisions on accepted outcomes, not workflow or E2E
paths.
- Separate sensitive-workflow analysis from authorization.
- Direct review repairs to remove excluded behavior and apply the
smallest supported in-scope repair.
- Allow merge-based target synchronization and mechanical conflict
resolution without separate approval.
- Replace the live E2E validation note that implied every changed test
required a new approval.
- Add three regression evals for workflow changes, live E2E changes
without dispatch, and removal of excluded retry behavior.

This change adds no publication fallback, 

**File**: `.agents/skills/_shared/pr-follow-up.md` (modified, +7/-3)
```diff
@@ -47,22 +47,26 @@ Keep monitoring bounded. Return states, identifiers, and short excerpts; read fu
 
 | Result | Action |
 |---|---|
-| Candidate-owned valid finding or failed check that is in scope and not ambiguous, risky, broad, or design-changing | Group by cause and repair the complete group. |
+| Candidate-owned valid finding or failed check whose required outcome is established by the accepted scope | Group by cause and repair the complete group. |
 | Inherited finding or failed check | Leave the candidate unchanged. Preserve the base evidence and report the disposition. |
 | Duplicate, style suggestion, or false positive | Leave unchanged and preserve the evidence for its disposition. |
-| New scope or ambiguous, risky, broad, or design-changing feedback | Ask the user. Do not add the new surface as a repair. |
+| A finding requires new product scope or leaves materially different outcomes inside the accepted scope | Ask the user. Do not select or add the new behavior as a repair. |
 | Required review or check is still pending | Report it. Do not classify the collection as complete. |
 | Advisor specialist failed or its review artifact is missing | Record the candidate SHA, specialist, workflow run and job identifiers, and expected artifact. Keep the candidate unchanged and ask a NemoClaw maintainer to decide whether to rerun the full Advisor workflow for that commit or defer the PR. Do not rerun before that decision. |
 | No actionable finding after collection completes | Report the remaining checks. |
 
 Apply [Root-Cause and Sensitive-Workflow State Checks](root-cause-and-state-checks.md) to valid code or CI findings, and record the operation and failure class.
 
+A changed workflow or E2E file can change validation requirements. Its path does not create a user
+approval requirement or revoke authority already granted for the PR lifecycle.
+
 ## Integrate the base branch
 
 Fetching the canonical base into a local comparison ref does not change the candidate. Continue to
 fetch it when trusted validation requires current base evidence.
 
-Merge or rebase the base branch into the candidate only for one of these reasons:
+Use a merge or GitHub's Update branch operation. Do not rebase or rewrite published commits.
+Integrate the base branch only for one of these reasons:
 
 - resolve a current merge conflict;
 - consume a required dependency that has merged;
```

**File**: `.agents/skills/_shared/root-cause-and-state-checks.md` (modified, +7/-5)
```diff
@@ -21,10 +21,11 @@ A change that repairs one path and leaves a sibling path unchanged keeps the sam
 
 ## Sensitive-Workflow State Matrix
 
-Build a sensitive-workflow state matrix as working analysis for a flow that handles credentials,
-remote execution, billable resources, destructive cleanup, security policy, or public writes. Use
-only the rows and columns required to cover the changed contract. Classify these outcomes when they
-apply:
+Build a sensitive-workflow state matrix as working analysis when changed runtime behavior handles
+credentials, remote execution, billable resources, destructive cleanup, security policy, or public
+writes. The matrix does not grant or revoke authority. Do not build it only because a workflow or
+E2E file changed, or because an authorized PR lifecycle writes its branch or PR. Use only the rows
+and columns required to cover the changed contract. Classify these outcomes when they apply:
 
 | Phase | Success | Command Failure | Transport Ambiguity | Verification Failure |
 |---|---|---|---|---|
@@ -36,7 +37,8 @@ apply:
 For each credential, name its location, access, lifetime, and removal. For each failure cell, record
 the result and required action separately. Classify the result as an infrastructure failure or
 inconclusive verification when applicable. Classify the action as rollback, retry, or stop. Ask the
-user before choosing a behavior that changes security, data safety, cost, or a supported contract.
+user only when the accepted scope does not select among materially different behaviors for security,
+data safety, cost, or a supported contract.
 
 The [Security Rubric](security-rubric.md) owns the authentication and authorization category and its
 evidence expectations. For a public or external write, record the positive and negative evidence that
```

**File**: `.agents/skills/nemoclaw-contributor-create-pr/SKILL.md` (modified, +3/-0)
```diff
@@ -41,6 +41,9 @@ response alone or weaken the reference's concurrency and recovery rules.
 
 Open code-changing or sensitive-path PRs as drafts. Record available review context without claiming
 unobserved approval. Do not select labels or request maintainer reviews in this workflow.
+A workflow or live E2E file change does not require separate approval. Manual live E2E dispatch
+still requires authority for the selected target. Missing dispatch authority does not block draft
+publication unless the accepted scope requires that live evidence before publication.
 When the diff adds, expands, or repairs live E2E evidence, require the implementation handoff to apply
 [Define the Live Contract](../../references/e2e-authoring.md#define-the-live-contract). When it
 prunes or relocates live assertions, require the handoff to apply
```

**File**: `.agents/skills/nemoclaw-contributor-create-pr/evals/evals.json` (modified, +36/-0)
```diff
@@ -490,11 +490,47 @@
     "ground_truth": "The shared contract decides that a current conflict permits base integration. The invoking contributor lifecycle owns conflict resolution, validation, commit, and publication, then restarts evaluation for the new candidate.",
     "expected_behavior": [
       "Uses the shared contract only to confirm that the current conflict permits base integration.",
+      "Uses a merge or GitHub's Update branch operation and does not request separate approval for mechanical, in-scope conflict resolution.",
       "Keeps mechanical conflict resolution, validation, commit creation, and guarded publication in `nemoclaw-contributor-create-pr` and its implementation handoff.",
       "Does not assign repair or publication authority to the shared follow-up contract.",
       "Treats the integrated result as a new candidate and restarts complete automated evaluation after one exact conditional ref update."
     ]
   },
+  {
+    "id": "positive-workflow-change-does-not-require-approval",
+    "question": "My authorized PR changes a GitHub Actions workflow. Publish the draft after its deterministic checks pass.",
+    "expected_skill": "nemoclaw-contributor-create-pr",
+    "ground_truth": "A workflow file is a sensitive publication path, but changing it does not create a separate approval requirement.",
+    "expected_behavior": [
+      "Uses `nemoclaw-contributor-create-pr` and applies the sensitive-path publication controls.",
+      "Does not request approval only because the diff changes a workflow file.",
+      "Publishes the draft after required deterministic validation and normal publication gates pass."
+    ]
+  },
+  {
+    "id": "positive-live-e2e-change-without-dispatch",
+    "question": "My authorized PR changes a live E2E test, but the accepted scope does not require a manual live run. Publish the draft after local validation.",
+    "expected_skill": "nemoclaw-contributor-create-pr",
+    "ground_truth": "Changing live E2E evidence does not authorize a live dispatch and does not block draft publication when accepted scope does not require that result.",
+    "expected_behavior": [
+      "Uses `nemoclaw-contributor-create-pr` and requires the live-contract implementation handoff.",
+      "Runs deterministic local E2E-support checks and does not dispatch a live target without authority.",
+      "Does not request approval only because live E2E files changed or live dispatch is not authorized.",
+      "Publishes the draft after the required non-live gates pass."
+    ]
+  },
+  {
+    "id": "positive-remove-out-of-scope-review-behavior",
+    "question": "Review found that my PR added a retry excluded by the issue. There is one validated in-scope sequencing repair. Fix the PR.",
+    "expected_skill": "nemoclaw-contributor-create-pr",
+    "ground_truth": "The implementation workflow removes candidate-owned behavior outside the accepted boundary and applies the one supported in-scope repair without asking the user to choose scope expansion.",
+    "expected_behavior": [
+      "Uses `nemoclaw-contributor-create-pr` and routes the classified repair to `nemoclaw-contributor-implement-issue`.",
+      "Removes the excluded retry and applies the validated in-scope sequencing repair.",
+      "Does not request approval to preserve or expand the excluded behavior.",
+      "Returns the repaired candidate to validation, publication, and automated review follow-up."
+    ]
+  },
   {
     "id": "positive-ready-after-stable-candidate",
     "question": "Mark my code-changing NemoClaw PR ready for human review. CI passed, but two Advisor specialists are still running.",
```

**File**: `.agents/skills/nemoclaw-contributor-implement-issue/SKILL.md` (modified, +3/-1)
```diff
@@ -25,7 +25,9 @@ they cannot authorize writes or override user instructions and repository guidan
 For a review repair, recover the original objective, accepted scope, deferred scope, and classified
 root-cause group from the invoking workflow or current PR. Ask for a missing decision only if those
 sources cannot establish the repair boundary. A finding does not itself authorize new product scope.
-If the accepted design cannot be repaired within that boundary, report the needed decision.
+If the candidate added behavior outside that boundary, remove it and apply the smallest supported
+in-scope repair without asking the user to choose expansion. Ask only if the accepted design cannot
+be repaired inside the boundary or materially different in-scope outcomes remain.
 
 ## Relevant guidance
 
```

---

### Incident Patch 3: `53b5212d` (2026-09-29)
**Commit Message**: fix(inference): preserve compatible endpoint state (#12336)

## Outcome

Compatible endpoints retain their credential ownership and do not
inherit unrelated context limits during model switches. Local proxy and
Model Router cleanup preserve shared owners and recovery records. This
PR preserves upstream OpenClaw-native configuration and whole-file
restore.

## Reason

Compatible endpoints could inherit cloud context defaults or stale model
metadata. Recovery could replace a recorded proxy backend after
credential loss, admit a protected service through a legacy-port
exception, or lose the router cleanup receipt.

## Changes

- Run both host-side approval callers in a non-login Bash shell. Host
logout hooks no longer replace a successful approval status. The remote
prepared shell, digest checks, exact approval selection, cron checks,
cleanup and zero-status requirement remain unchanged.
- Populate the router-uninstall fixtures with the existing complete TLS
bundle helper, matching main’s new cleanup authority checks. Production
cleanup remains fail-closed.

- Suppress incidental filesystem warnings in both Model Router `lsof`
scans. Real errors, malformed PID output, missing inventor

**File**: `ci/onboard-entry-composition-budget.json` (modified, +2/-2)
```diff
@@ -17,12 +17,12 @@
   },
   "provider": {
     "handleNimLocalSelection": 36,
-    "handleRemoteProviderSelection": 82,
+    "handleRemoteProviderSelection": 81,
     "handleRemoteProviderSelection.providerExistsInGateway": 1,
     "handleRemoteProviderSelection.readGatewayProviderMetadata": 1,
     "handleVllmSelection.queryVllmModels": 1,
     "preflightAuthoritativeRebuildTarget": 1,
-    "runOnboard": 8,
+    "runOnboard": 7,
     "runOnboard.providerInference.deps.needsBedrockRuntimeAdapter": 1,
     "selectAndValidateOllamaModel": 19
   }
```

**File**: `docs/get-started/quickstart.mdx` (modified, +5/-1)
```diff
@@ -331,7 +331,11 @@ Use these details when your first-run path needs more control.
     | Model Router | You want NemoClaw to start the host-side model router. | `NVIDIA_INFERENCE_API_KEY` |
 
     For an OpenAI-compatible HTTP endpoint on `localhost`, `127.0.0.1`, or `[::1]`, press Enter to select no authentication when the endpoint uses the port selected by `NEMOCLAW_VLLM_PORT` (`8000` by default) or port `11434`.
-    Port `11435` supports this mode only when `NEMOCLAW_OLLAMA_PROXY_PORT` uses a different free port.
+    Port `11435` is reserved for the proxy and is unavailable for new no-authentication endpoints.
+    Recovery can retain an existing no-authentication route on `11435` only when the proxy has moved and no other protected service owns that port.
+    The shared protected proxy stays pinned to its existing backend; reuse that endpoint.
+    Moving or removing a sandbox does not release the host-global binding.
+    To select a different no-authentication backend, back up the sandboxes and remove the final NemoClaw gateway with the uninstaller before reinstalling.
 
     After you enter a sandbox name, the wizard asks for final confirmation before it registers the provider, prompts for integrations, and creates the sandbox.
 
```

**File**: `docs/inference/custom-endpoint-security.mdx` (modified, +6/-1)
```diff
@@ -19,7 +19,12 @@ The sandbox does not receive the raw API key.
 
 Use `COMPATIBLE_API_KEY` for an OpenAI-compatible endpoint that requires authentication.
 For an HTTP endpoint on `localhost`, `127.0.0.1`, or `[::1]`, you can select no authentication on the port selected by `NEMOCLAW_VLLM_PORT` (`8000` by default) or port `11434`.
-Port `11435` supports no authentication only when `NEMOCLAW_OLLAMA_PROXY_PORT` uses a different free port.
+Port `11435` is reserved for the proxy and is unavailable for new no-authentication endpoints.
+Recovery can retain an existing no-authentication route on `11435` only when the proxy has moved and no other protected service owns that port.
+NemoClaw rejects no-authentication endpoints on configured or recorded gateway, dashboard, agent API, Model Router, and credential-adapter ports.
+The shared protected proxy stays pinned to its existing backend; reuse that endpoint.
+Moving or removing a sandbox does not release the host-global binding.
+To select a different no-authentication backend, back up the sandboxes and remove the final NemoClaw gateway with the uninstaller before reinstalling.
 For non-interactive onboarding of that OpenAI-compatible endpoint, set `NEMOCLAW_COMPATIBLE_AUTH_MODE=none`.
 Use `COMPATIBLE_ANTHROPIC_API_KEY` for a custom Anthropic-compatible endpoint.
 Anthropic-compatible onboarding requires a non-empty value even when the upstream server does not authenticate requests.
```

**File**: `docs/inference/set-up-openai-compatible-endpoint.mdx` (modified, +9/-6)
```diff
@@ -38,7 +38,7 @@ Onboarding does not display this degraded result.
 Before you continue, inspect the configured backend port:
 
 ```bash
-backend_port=${NEMOCLAW_VLLM_PORT:-8000}
+backend_port=8000 # Replace with the port in the endpoint URL entered during onboarding.
 lsof -nP -iTCP:"$backend_port" -sTCP:LISTEN
 ```
 
@@ -63,19 +63,22 @@ To qualify for automatic rewriting, an HTTP endpoint URL must use the loopback h
 Automatic rewriting is limited to the port selected by `NEMOCLAW_VLLM_PORT` (`8000` by default) and ports `11434` and `11435`.
 NemoClaw validates the entered URL from the host and registers the OpenShell gateway route through `host.openshell.internal:<port>` for sandbox traffic.
 Sandbox inference requests continue to use the base `inference.local` policy, so the managed compatible-endpoint route does not require adding the `local-inference` preset.
-NemoClaw leaves URLs without an explicit port, URLs on `:80` or another privileged port, and URLs on unsupported ports unchanged.
-Those URLs require a separately compatible runtime topology and network policy.
+For authenticated endpoints, NemoClaw leaves URLs without an explicit port, URLs on `:80` or another privileged port, and URLs on unsupported ports unchanged.
+Those authenticated URLs require a separately compatible runtime topology and network policy.
 This rewrite depends on an OpenShell topology that resolves `host.openshell.internal` inside the sandbox; if that bridge is unavailable, onboarding can still validate the host URL, but `$$nemoclaw <name> status` is the authoritative runtime check.
 For no-authentication endpoints on the port selected by `NEMOCLAW_VLLM_PORT` (`8000` by default) or port `11434`, keep the server bound to loopback.
 NemoClaw's token-protected proxy makes the loopback service reachable from the sandbox without exposing the backend on other host interfaces.
-Port `11435` is the default proxy listener, so an endpoint using that port requires `COMPATIBLE_API_KEY` unless you configure `NEMOCLAW_OLLAMA_PROXY_PORT` to use a different free port before onboarding.
+Port `11435` is reserved for the proxy and is unavailable for new no-authentication endpoints.
+Recovery can retain an existing no-authentication route on `11435` only when the proxy has moved and no other protected service owns that port.
+The shared proxy stays pinned to its existing backend; reuse that endpoint.
+Moving or removing a sandbox does not release the host-global binding.
+To select a different no-authentication backend, back up the sandboxes and remove the final NemoClaw gateway with the uninstaller before reinstalling.
 
 If you manually enter a sandbox-internal alias such as `http://host.openshell.internal:8000/v1`, host-side endpoint probing is skipped during onboarding.
 Use a host-routable endpoint such as `localhost` when you need onboarding to verify the API, tool-calling, and streaming paths before gateway registration.
 Otherwise, verify the runtime route after onboarding with `$$nemoclaw <name> status` and a short agent request.
 
 For an HTTP URL using the host `localhost`, `127.0.0.1`, or `[::1]` and the port selected by `NEMOCLAW_VLLM_PORT` (`8000` by default) or port `11434`, the API key prompt says that pressing Enter selects no authentication.
-Port `11435` also supports this mode when `NEMOCLAW_OLLAMA_PROXY_PORT` uses a different free port before onboarding.
 Other URLs still require `COMPATIBLE_API_KEY`.
 
 Refer to [Choose a Compatible Inference API](choose-compatible-inference-api) for the probe order and runtime API selection.
@@ -137,7 +140,7 @@ NEMOCLAW_PROVIDER=custom \
 | `NEMOCLAW_PROVIDER` | Set to `custom`. |
 | `NEMOCLAW_ENDPOINT_URL` | Base URL of the server, without userinfo, query, or fragment components. |
 | `NEMOCLAW_MODEL` | Model ID reported by the server. |
-| `NEMOCLAW_COMPATIBLE_AUTH_MODE` | Set to `none` to explicitly select no authentication for an HTTP endpoint using `localhost`, `127.0.0.1`, or `[::1]` and the port s
```

**File**: `docs/reference/commands.mdx` (modified, +1/-1)
```diff
@@ -4210,7 +4210,7 @@ The following variables let you tune onboarding without editing the Dockerfile o
 | `NEMOCLAW_MODEL` | model ID | Selects an explicit model for a non-interactive onboarding run. For NVIDIA Endpoints, NemoClaw ignores a retired configured model and uses the agent default. Otherwise, NemoClaw preserves the explicit model across a detected provider switch, even when it matches the recorded provider's default. When this variable is unset during such a switch, NemoClaw ignores the `NEMOCLAW_PROVIDER_MODEL` compatibility fallback and uses normal provider model selection. |
 | `NEMOCLAW_TOOL_DISCLOSURE` | `progressive` or `direct` | Selects progressive tool discovery or direct exposure. Defaults to `progressive`; `--tool-disclosure` takes precedence when both are set. |
 | `NEMOCLAW_ENDPOINT_URL` | URL | Custom endpoint URL. Used together with `NEMOCLAW_PROVIDER=custom` for OpenAI-compatible endpoints or `NEMOCLAW_PROVIDER=anthropicCompatible` for Anthropic-compatible endpoints. Onboarding rejects a URL that contains userinfo, query, or fragment components. It also rejects a URL that contains control characters, percent-encoded control characters, spaces within the URL, shell metacharacters, or other characters outside the URL-safe ASCII set, and a value that is not an absolute HTTP or HTTPS URL. NemoClaw trims ASCII spaces at the start and end of the URL before validation. |
-| `NEMOCLAW_COMPATIBLE_AUTH_MODE` | `none` or unset | Explicitly selects no authentication during non-interactive onboarding for an OpenAI-compatible HTTP endpoint on `localhost`, `127.0.0.1`, or `[::1]` and the port selected by `NEMOCLAW_VLLM_PORT` (`8000` by default) or port `11434`. Port `11435` requires `NEMOCLAW_OLLAMA_PROXY_PORT` to use a different free port. |
+| `NEMOCLAW_COMPATIBLE_AUTH_MODE` | `none` or unset | Explicitly selects no authentication during non-interactive onboarding for an OpenAI-compatible HTTP endpoint on `localhost`, `127.0.0.1`, or `[::1]` and the port selected by `NEMOCLAW_VLLM_PORT` (`8000` by default) or port `11434`. Protected service ports remain unavailable. New endpoints cannot use port `11435`; recovery can retain a recorded legacy route on that port only after the auth proxy moves to a different free port and no other protected service owns `11435`. |
 | `NEMOCLAW_TRUSTED_PRIVATE_HOSTS` | comma-separated exact hostnames or IP literals | Allows operator-owned RFC1918, CGNAT, or IPv6 unique local destinations through supported inference, managed MCP, and custom-policy registration paths. Link-local metadata and other reserved ranges remain blocked; DNS resolution and address pinning remain active; wildcards are not supported. |
 | `NEMOCLAW_TRUSTED_PRIVATE_INFERENCE_HOSTS` | comma-separated hostnames or IP literals | Inference-only compatibility alias. Inference onboarding combines entries from this variable and `NEMOCLAW_TRUSTED_PRIVATE_HOSTS`. |
 | `NEMOCLAW_PREFERRED_API` | `completions` (currently the only honored value) | Forces the validation probe to use the `/v1/chat/completions` API path instead of the newer `/v1/responses` API. |
```

---

### Incident Patch 4: `cb7315d4` (2026-09-29)
**Commit Message**: fix(install): wait for stopped sandbox backup readiness (Fixes #11936) (#12250)

## Outcome

Strict pre-upgrade backup now uses one 330-second elapsed deadline for
the complete stopped-sandbox recovery. Container start and SSH readiness
share the first 180 seconds, one real backup has a reserved 120 seconds,
and stopped-state cleanup has a reserved 30 seconds. A sandbox that
becomes reachable after the former 90-second boundary can still be
backed up without allowing an unreachable sandbox to hold the mutation
lock through repeated full backups.

## Reason

The prior change retried the full backup operation 91 times. Each
attempt could spend up to 120 seconds in SSH work, so the 180-second
retry schedule did not bound total elapsed time and could delay strict
upgrade recovery for hours.

### Related issues

Fixes #11936

## Changes

- Probe only SSH readiness until the readiness deadline, then run one
full backup.
- Pass the shared absolute deadline through container start, backup
subprocesses, snapshot publication, and stopped-state cleanup.
- Fail closed on every expired-deadline step instead of issuing a
one-millisecond timeout.
- Bound each pre-start provider probe by the remai

**File**: `docs/manage-sandboxes/backup-restore.mdx` (modified, +5/-5)
```diff
@@ -172,9 +172,9 @@ Run `$$nemoclaw <name> gateway restart` to make the gateway open the restored da
 </AgentOnly>
 
 <Note>
-`--to` is not available for a snapshot of a sandbox that uses a NemoClaw-managed image.
-NemoClaw reports that the restore is not available and stops before it creates, deletes, or changes the destination sandbox.
-Restore that snapshot into its source sandbox without `--to`.
+  `--to` is not available for a snapshot of a sandbox that uses a NemoClaw-managed image. NemoClaw
+  reports that the restore is not available and stops before it creates, deletes, or changes the
+  destination sandbox. Restore that snapshot into its source sandbox without `--to`.
 </Note>
 
 To clone a snapshot into a different sandbox name, pass `--to <name>`. If the destination sandbox already exists, NemoClaw refuses to overwrite it unless you pass `--force`:
@@ -321,8 +321,8 @@ $$nemoclaw backup-all
 
 `backup-all` walks the sandboxes registered on the host, creates a snapshot for each eligible running or temporarily started sandbox, and stores the snapshot bundles under `~/.nemoclaw/rebuild-backups/<name>/`. If a registered standard sandbox is stopped, `backup-all` asks OpenShell to start that exact sandbox for the duration of the backup and asks OpenShell to return it to `Stopped` afterward. If either lifecycle transition fails, the backup run fails with the affected sandbox named. Correct the reported OpenShell lifecycle problem, run `$$nemoclaw <name> start` when appropriate, and rerun `$$nemoclaw backup-all`; do not start or stop the provider container directly.
 
-For each eligible sandbox, `backup-all` holds one lifecycle transaction through the complete backup.
-Within that transaction, it asks OpenShell to start a stopped sandbox when required, copies sandbox state, and asks OpenShell to return that sandbox to `Stopped`.
+For a stopped sandbox, `backup-all` first asks OpenShell to start it in a separate bounded operation.
+After OpenShell accepts the start, one lifecycle transaction covers readiness, state capture, and returning the sandbox to `Stopped`.
 A backup failure marks that sandbox as failed, and `backup-all` continues with the next sandbox.
 
 When a backup fails, NemoClaw identifies the affected state item and reports `permission denied`, `tar read error`, or `absent after extraction` when available. Use `$$nemoclaw <name> snapshot list` and `$$nemoclaw <name> snapshot restore` to inspect or restore one sandbox's bundles later.
```

**File**: `docs/reference/commands.mdx` (modified, +2/-2)
```diff
@@ -3233,8 +3233,8 @@ The retry is complete when the command exits zero and reports that the sandbox w
 
 Back up registered sandboxes that are running or have an eligible stopped Docker-driver container to `~/.nemoclaw/rebuild-backups/`. A registered docker-driver sandbox whose container is stopped is started for the duration of the backup and returned to its stopped state afterward. If the container cannot be returned to the stopped state, the command fails and reports that the container was left running. Sandboxes that are not running and cannot be started this way are skipped with remediation guidance.
 
-For each eligible sandbox, `backup-all` holds one lifecycle transaction through the complete backup.
-Within that transaction, it starts a stopped container when required, copies sandbox state, and returns any container it started to the stopped state.
+For a stopped sandbox, `backup-all` first asks OpenShell to start it in a separate bounded operation.
+After OpenShell accepts the start, one lifecycle transaction covers readiness, state capture, and returning the sandbox to `Stopped`.
 A backup failure marks that sandbox as failed, and `backup-all` continues with the next sandbox.
 
 ```bash
```

**File**: `nemoclaw/src/security/snapshot-sanitizer-failure.test.ts` (modified, +18/-0)
```diff
@@ -340,6 +340,24 @@ describe("migration snapshot sanitizer fallbacks", () => {
     },
   );
 
+  it("preserves helper timeouts as deadline failures", () => {
+    const rootPath = makeRoot();
+    writePythonWrapper(["sleep 5"]);
+    const root = inspectDescriptorSnapshotRoot(rootPath)!;
+
+    expect(() => scanDescriptorSnapshot(root, new Set(), undefined, 10)).toThrow(
+      "snapshot sanitization deadline expired",
+    );
+    expect(() =>
+      applyDescriptorSnapshotActions(
+        root,
+        { root: root.identity, directories: {}, files: [] },
+        [{ kind: "remove", path: "config.json", metadata: root.identity }],
+        10,
+      ),
+    ).toThrow("snapshot sanitization deadline expired");
+  });
+
   it("rejects unsafe roots and non-canonical helper payloads", () => {
     const root = makeRoot();
     const filePath = path.join(root, "not-a-directory");
```

**File**: `nemoclaw/src/shared/snapshot-sanitizer-boundary.cts` (modified, +10/-2)
```diff
@@ -727,6 +727,7 @@ export function scanDescriptorSnapshot(
   root: DescriptorSnapshotRoot,
   sensitiveNames: ReadonlySet<string>,
   targetName?: string,
+  timeoutMs = HELPER_TIMEOUT_MS,
 ): DescriptorSnapshotScan | null {
   const mode = targetName === undefined ? "scan-tree" : "scan-file";
   const pythonPath = snapshotSanitizerPythonPath();
@@ -747,9 +748,12 @@ export function scanDescriptorSnapshot(
       encoding: "utf-8",
       env: {},
       maxBuffer: HELPER_MAX_BUFFER_BYTES,
-      timeout: HELPER_TIMEOUT_MS,
+      timeout: timeoutMs,
     },
   );
+  if ((result.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT") {
+    throw new Error("snapshot sanitization deadline expired", { cause: result.error });
+  }
   if (result.status !== 0 || result.error) return null;
   return parseScanResult(result.stdout);
 }
@@ -759,6 +763,7 @@ export function applyDescriptorSnapshotActions(
   root: DescriptorSnapshotRoot,
   scan: DescriptorSnapshotScan,
   actions: readonly SnapshotSanitizationAction[],
+  timeoutMs = HELPER_TIMEOUT_MS,
 ): boolean {
   if (actions.length === 0) return true;
   const pythonPath = snapshotSanitizerPythonPath();
@@ -771,9 +776,12 @@ export function applyDescriptorSnapshotActions(
       env: {},
       input: JSON.stringify({ root: scan.root, directories: scan.directories, actions }),
       maxBuffer: HELPER_MAX_BUFFER_BYTES,
-      timeout: HELPER_TIMEOUT_MS,
+      timeout: timeoutMs,
     },
   );
+  if ((result.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT") {
+    throw new Error("snapshot sanitization deadline expired", { cause: result.error });
+  }
   return result.status === 0 && !result.error;
 }
 
```

**File**: `src/lib/actions/maintenance.test.ts` (modified, +153/-47)
```diff
@@ -16,7 +16,9 @@ const mocks = vi.hoisted(() => ({
   startStoppedSandboxContainerForBackup: vi.fn(),
   backupStartedSandboxState: vi.fn(),
   returnSandboxContainerToStopped: vi.fn(),
+  startedSandboxBackupTransactionDeadline: vi.fn(() => 330_000),
   retainStrictPreUpgradeRecoveryState: vi.fn(),
+  discardIncompleteBackup: vi.fn(),
   isSandboxContainerDefinitivelyAbsent: vi.fn(),
   withSandboxMutationLock: vi.fn(),
   enforceRemovedImmutabilityMigrationBoundary: vi.fn(),
@@ -70,7 +72,11 @@ vi.mock("../state/portable-uninstall-retirement", () => ({
   withPortableHostFence: mocks.withPortableHostFence,
 }));
 vi.mock("./sandbox/snapshot/backup-authority", () => ({
-  backupSandboxStateWithManagedAuthority: (name: string) => mocks.backupSandboxState(name),
+  backupSandboxStateWithManagedAuthority: (name: string, options: Record<string, unknown>) =>
+    Object.keys(options).length > 0
+      ? mocks.backupSandboxState(name, options)
+      : mocks.backupSandboxState(name),
+  discardIncompleteBackup: mocks.discardIncompleteBackup,
 }));
 vi.mock("../openshell-sandbox-list", () => ({
   captureSandboxListWithGatewayPreflightOrExit: mocks.captureSandboxListWithGatewayPreflightOrExit,
@@ -98,6 +104,9 @@ vi.mock("./sandbox/stopped-sandbox-backup", () => ({
   backupStartedSandboxState: mocks.backupStartedSandboxState,
   returnSandboxContainerToStopped: mocks.returnSandboxContainerToStopped,
   isSandboxContainerDefinitivelyAbsent: mocks.isSandboxContainerDefinitivelyAbsent,
+  startedSandboxBackupTransactionDeadline: mocks.startedSandboxBackupTransactionDeadline,
+  startedSandboxBackupWorkDeadline: (transactionDeadlineMs: number) =>
+    transactionDeadlineMs - 30_000,
 }));
 vi.mock("./sandbox/snapshot/strict-pre-upgrade-recovery", () => ({
   retainStrictPreUpgradeRecoveryState: mocks.retainStrictPreUpgradeRecoveryState,
@@ -106,9 +115,6 @@ vi.mock("../domain/lifecycle/options", () => ({
   normalizeGarbageCollectImagesOptions: (o: unknown) => o || {},
 }));
 
-// ../domain/maintenance/images is left unmocked so the gc tests run the real
-// orphan-detection helpers and can assert on gc's actual output.
-
 import {
   backupAll,
   backupAllUnderPortableHostFence,
@@ -177,7 +183,10 @@ describe("backupAll", () => {
   });
 
   it("returns before gateway preflight when no sandboxes are registered", async () => {
-    mocks.listSandboxes.mockReturnValue({ sandboxes: [], defaultSandbox: null });
+    mocks.listSandboxes.mockReturnValue({
+      sandboxes: [],
+      defaultSandbox: null,
+    });
     const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
 
     await backupAll();
@@ -529,7 +538,10 @@ describe("backupAll", () => {
     });
     mocks.startStoppedSandboxContainerForBackup.mockImplementation((name: string) =>
       name === "sb-stopped"
-        ? { containerName: "openshell-sb-stopped-abc", runtimeProviderId: "docker" }
+        ? {
+            containerName: "openshell-sb-stopped-abc",
+            runtimeProviderId: "docker",
+          }
         : null,
     );
     mocks.backupStartedSandboxState.mockResolvedValue({
@@ -547,21 +559,30 @@ describe("backupAll", () => {
     }) as never);
 
     await backupAll();
-
     expect(exitSpy).not.toHaveBeenCalled();
-    expect(mocks.backupStartedSandboxState).toHaveBeenCalledWith("sb-stopped");
-    expect(mocks.backupSandboxState).toHaveBeenCalledWith("sb-good");
-    expect(mocks.returnSandboxContainerToStopped).toHaveBeenCalledWith({
-      containerName: "openshell-sb-stopped-abc",
-      runtimeProviderId: "docker",
+    expect(mocks.startStoppedSandboxContainerForBackup).toHaveBeenCalledWith("sb-stopped", {
+      deadlineMs: 330_000,
     });
+    expect(mocks.backupStartedSandboxState).toHaveBeenCalledWith("sb-stopped", {
+      deadlineMs: 330_000,
+      deferSanitizationDeadlineCleanup: true,
+      deferCompletionPublication: true,
+    });
+    expect(mocks.returnSandboxContainerToStopped).toHaveBeenCalledWith(
+      {
+    
```

---

### Incident Patch 5: `c0fb0fec` (2026-09-29)
**Commit Message**: fix(onboard): reduce dashboard forward authority checks (#12484)

<!-- markdownlint-disable MD041 -->
## Outcome

Dashboard forward observation now performs one gateway authority check
for each valid read-only multi-port batch instead of repeating
synchronous ownership checks for every unbound port. The final fence
rejects the complete batch if gateway authority is stale or changes
during observation.

## Reason

On macOS with a Homebrew-managed gateway, the 11-port dashboard scan
performed 27 synchronous formula identity operations and consumed about
32.6 seconds, exceeding the 15-second observation budget.

### Related issues

Refs #11963

## Changes

- Keep strict adapter-level authority fencing unchanged for mutation,
startup, retirement, and recovery consumers.
- Validate the adapter response count and exact forward identities
before running one final gateway authority fence for the read-only
dashboard observation batch.
- Protect the behavior with regressions for one fence per multi-port
batch, fresh fencing across independent batches, stale or changed
authority denial, and malformed identity rejection before the external
authority check.

## Verification

- `NODE_OPTIONS=--m

**File**: `src/lib/onboard/dashboard-port.test.ts` (modified, +69/-2)
```diff
@@ -109,12 +109,17 @@ async function unusedLoopbackPort(): Promise<number> {
 }
 
 describe("typed OpenShell dashboard-port observation", () => {
-  it("binds an exact identity factory to one read-only adapter request", async () => {
+  it("checks gateway authority once for each multi-port batch (#11963)", async () => {
     const observeForwards = vi.fn<OpenShellForwardAdapter["observeForwards"]>(
-      async ({ forwards }) => forwards.map((forward) => ({ state: "absent" as const, forward })),
+      async ({ assertCurrent, forwards }) => {
+        expect(assertCurrent).toBeUndefined();
+        return forwards.map((forward) => ({ state: "absent" as const, forward }));
+      },
     );
+    const assertCurrent = vi.fn(async () => undefined);
     const observer = createOpenShellForwardPortObserver({
       adapter: { observeForwards },
+      assertCurrent,
       forwardForPort: (port) => ({
         gatewayEndpoint: "https://127.0.0.1:9090",
         gatewayName: "nemoclaw-9090",
@@ -150,6 +155,65 @@ describe("typed OpenShell dashboard-port observation", () => {
       },
     ]);
     expect(observeForwards).toHaveBeenCalledOnce();
+    expect(assertCurrent).toHaveBeenCalledOnce();
+
+    await observer([18789, 18790]);
+    expect(assertCurrent).toHaveBeenCalledTimes(2);
+  });
+
+  it("rejects a batch when gateway authority is stale before collection (#11963)", async () => {
+    const observeForwards = vi.fn<OpenShellForwardAdapter["observeForwards"]>(
+      async ({ forwards }) => forwards.map((forward) => ({ state: "absent" as const, forward })),
+    );
+    const assertCurrent = vi.fn(async () => {
+      throw new Error("gateway authority changed");
+    });
+    const observer = createOpenShellForwardPortObserver({
+      adapter: { observeForwards },
+      assertCurrent,
+      forwardForPort: (port) => ({
+        gatewayEndpoint: "https://127.0.0.1:9090",
+        gatewayName: "nemoclaw-9090",
+        workspace: "default",
+        sandboxName: "cursor",
+        localHost: "127.0.0.1",
+        port,
+      }),
+    });
+
+    await expect(observer([18789, 18790])).rejects.toThrow(/gateway authority changed/);
+    expect(observeForwards).toHaveBeenCalledOnce();
+    expect(assertCurrent).toHaveBeenCalledOnce();
+  });
+
+  it("rejects a batch when gateway authority changes during collection (#11963)", async () => {
+    let observationComplete = false;
+    const observeForwards = vi.fn<OpenShellForwardAdapter["observeForwards"]>(
+      async ({ forwards }) => {
+        observationComplete = true;
+        return forwards.map((forward) => ({ state: "absent" as const, forward }));
+      },
+    );
+    const assertCurrent = vi.fn(async () => {
+      expect(observationComplete).toBe(true);
+      throw new Error("gateway authority changed");
+    });
+    const observer = createOpenShellForwardPortObserver({
+      adapter: { observeForwards },
+      assertCurrent,
+      forwardForPort: (port) => ({
+        gatewayEndpoint: "https://127.0.0.1:9090",
+        gatewayName: "nemoclaw-9090",
+        workspace: "default",
+        sandboxName: "cursor",
+        localHost: "127.0.0.1",
+        port,
+      }),
+    });
+
+    await expect(observer([18789, 18790])).rejects.toThrow(/gateway authority changed/);
+    expect(observeForwards).toHaveBeenCalledOnce();
+    expect(assertCurrent).toHaveBeenCalledOnce();
   });
 
   it.each(["owned", "stale"] as const)("reuses an exact %s forward", (state) => {
@@ -185,10 +249,12 @@ describe("typed OpenShell dashboard-port observation", () => {
   });
 
   it("rejects an adapter response that does not match its requested identities", async () => {
+    const assertCurrent = vi.fn(async () => undefined);
     const observer = createOpenShellForwardPortObserver({
       adapter: {
         observeForwards: async () => [forwardObservation("other", 18789, "absent")],
       },
+      assertCurrent,
       forwardForPort: (port) => ({
         gatewayEndpoint: "http
```

**File**: `src/lib/onboard/dashboard-port.ts` (modified, +4/-4)
```diff
@@ -67,10 +67,7 @@ export function createOpenShellForwardPortObserver(input: {
 }): OpenShellForwardPortObserver {
   return async (ports) => {
     const forwards = ports.map((port) => input.forwardForPort(port));
-    const observations = await input.adapter.observeForwards({
-      forwards,
-      ...(input.assertCurrent ? { assertCurrent: input.assertCurrent } : {}),
-    });
+    const observations = await input.adapter.observeForwards({ forwards });
     if (
       observations.length !== forwards.length ||
       observations.some((observation, index) => {
@@ -80,6 +77,9 @@ export function createOpenShellForwardPortObserver(input: {
     ) {
       throw new Error("OpenShell returned incomplete forward ownership evidence.");
     }
+    // This batch is read-only. Mutations use their own strict fences, while
+    // one final check rejects all valid evidence if gateway authority changed.
+    await input.assertCurrent?.();
     return observations;
   };
 }
```

---

### Incident Patch 6: `93182afe` (2026-09-29)
**Commit Message**: fix(onboard): drop the inert credential-free config from managed create (#11616)

<!-- markdownlint-disable MD041 -->
## Outcome
On WSL, creating a sandbox from a managed image no longer runs a Docker
Desktop credential-helper check or prints `Docker Desktop credential
helper is unavailable in this WSL session; using an isolated
credential-free config for the managed sandbox image pull.` Before, the
check read the reduced sandbox-create environment, so it fired even when
the caller selected a non-default `DOCKER_CONTEXT`, and it set a
temporary `DOCKER_CONFIG` on `openshell sandbox create` that had no
effect. Generated image builds and local-inference probe images keep the
existing credential-free behavior.

## Reason
The check read the environment that NemoClaw hands to `openshell sandbox
create`. That environment drops the caller's `DOCKER_CONTEXT` and
`DOCKER_CONFIG`, so the check saw the default context and the ambient
`~/.docker/config.json`.

The temporary configuration also had no consumer. In the pinned
OpenShell 0.0.116, `openshell sandbox create` is a client of the
OpenShell gateway. The gateway's Docker driver pulls the sandbox image
through its own Docker socket with an

**File**: `ci/source-architecture-budget.json` (modified, +1/-1)
```diff
@@ -55,7 +55,7 @@
       "src/lib/inference/onboard-probes.ts": 21,
       "src/lib/inference/vllm.ts": 20,
       "src/lib/onboard.ts": 192,
-      "src/lib/onboard/sandbox-gpu-create-run-attempt.ts": 19,
+      "src/lib/onboard/sandbox-gpu-create-run-attempt.ts": 18,
       "src/lib/onboard/machine/handlers/sandbox.ts": 21,
       "src/lib/policy/index.ts": 22,
       "src/lib/sandbox/config.ts": 18,
```

**File**: `docs/reference/troubleshooting.mdx` (modified, +14/-3)
```diff
@@ -212,20 +212,31 @@ The `docker_desktop_credential_store_headless` advisory means that the Docker cl
 
 Onboarding preflight prints this warning before the first image pull and then continues, on both fresh and resumed onboarding. NemoClaw reads the config from `$DOCKER_CONFIG/config.json` when `DOCKER_CONFIG` is set, and from `~/.docker/config.json` otherwise. On WSL, NemoClaw probes the credential helper with a read-only `list` call instead of relying on session markers, because WSLg can set `DISPLAY` in every WSL shell.
 
-On WSL, NemoClaw automatically uses a temporary credential-free Docker configuration for public managed image pulls, generated image builds, GPU probes, and local-inference probe images when all of these conditions apply:
+NemoClaw reads `DOCKER_HOST`, `DOCKER_CONTEXT`, and `DOCKER_CONFIG` from the environment of the `$$nemoclaw` command.
+On WSL, NemoClaw automatically uses a temporary credential-free Docker configuration for generated image builds and local-inference probe images when all of these conditions apply:
 
 - `DOCKER_HOST` is unset and the effective Docker context is `default`.
-- The client configuration selects the Docker Desktop credential helper.
+- The client configuration named above selects the Docker Desktop credential helper.
 - The read-only helper probe fails.
 - The operation does not require registry credentials.
 
 NemoClaw does not modify your Docker client configuration.
 It removes the temporary directory after the Docker operation.
 If cleanup fails, the warning prints the exact credential-free directory; wait for Docker to finish using it, then remove that directory.
 
-An explicit Docker host, a non-default context, a responsive helper, a custom Dockerfile, and an operation that might require private-registry credentials continue to use the configured Docker client state.
+These cases continue to use the configured Docker client state:
+
+- A nonblank `DOCKER_HOST`.
+- A non-default context selected with `DOCKER_CONTEXT` or persisted by `docker context use`.
+- A responsive helper.
+- A custom Dockerfile.
+- An operation that might require private-registry credentials.
+
 Restore the Docker Desktop session or helper access for those operations.
 
+The OpenShell gateway pulls a sandbox image, including a managed sandbox image, through the Docker socket configured for the gateway.
+It does not read your Docker client configuration, so the credential helper does not affect that pull.
+
 For a public-image-only retry outside the automatic WSL path, resume onboarding with a temporary isolated configuration:
 
 ```bash
```

**File**: `src/lib/adapters/openshell/sandbox-lifecycle-cli.test.ts` (modified, +2/-6)
```diff
@@ -117,19 +117,15 @@ describe("OpenShell sandbox lifecycle CLI", () => {
     expect(environment).not.toHaveProperty("SSH_AUTH_SOCK");
   });
 
-  it("preserves only the explicitly prepared credential-free Docker config", async () => {
+  it("omits DOCKER_CONFIG from the create process environment when the request environment sets it", async () => {
     const streamCreate = vi.fn().mockResolvedValue({ status: 0, output: "created" });
 
     await createCliOpenShellSandboxLifecycle({ capture: vi.fn(), streamCreate }).createSandbox({
       ...createRequest,
       environment: { ...createRequest.environment, DOCKER_CONFIG: "/host/docker-config" },
-      dockerClientConfigDirectory: "/tmp/nemoclaw-credential-free-docker",
     });
 
-    expect(streamCreate.mock.calls[0]![2]).toMatchObject({
-      DOCKER_CONFIG: "/tmp/nemoclaw-credential-free-docker",
-    });
-    expect(streamCreate.mock.calls[0]![2].DOCKER_CONFIG).not.toBe("/host/docker-config");
+    expect(streamCreate.mock.calls[0]![2]).not.toHaveProperty("DOCKER_CONFIG");
   });
 
   it("rejects malformed create input and ambient endpoint overrides before spawn", async () => {
```

**File**: `src/lib/adapters/openshell/sandbox-lifecycle-cli.ts` (modified, +1/-11)
```diff
@@ -215,18 +215,12 @@ function validCreateText(value: string | undefined): value is string {
 /** Own the child environment allowlist for OpenShell create processes. */
 export function buildOpenShellSandboxCreateEnvironment(
   source: NodeJS.ProcessEnv,
-  options: {
-    readonly policyAttached: boolean;
-    readonly dockerClientConfigDirectory?: string;
-  },
+  options: { readonly policyAttached: boolean },
 ): Record<string, string> {
   const environment = buildSubprocessEnvFrom(source);
   delete environment.KUBECONFIG;
   delete environment.SSH_AUTH_SOCK;
   if (!options.policyAttached) delete environment.OPENSHELL_SANDBOX_POLICY;
-  if (options.dockerClientConfigDirectory) {
-    environment.DOCKER_CONFIG = options.dockerClientConfigDirectory;
-  }
   return environment;
 }
 
@@ -250,7 +244,6 @@ function validCreateRequest(request: CreateOpenShellSandboxRequest): boolean {
     request.gpu?.device,
     request.resources?.cpu,
     request.resources?.memory,
-    request.dockerClientConfigDirectory,
     request.workingDirectory,
     ...Object.keys(request.labels ?? {}),
     ...Object.values(request.labels ?? {}),
@@ -465,9 +458,6 @@ export function createCliOpenShellSandboxLifecycle(input: {
         const stream = input.streamCreate ?? streamSandboxCreate;
         const filteredEnvironment = buildOpenShellSandboxCreateEnvironment(request.environment, {
           policyAttached: Boolean(request.policyPath),
-          ...(request.dockerClientConfigDirectory
-            ? { dockerClientConfigDirectory: request.dockerClientConfigDirectory }
-            : {}),
         });
         const environment = request.runtimeSelection
           ? buildOpenShellRuntimeSelectionEnv(filteredEnvironment, request.runtimeSelection)
```

**File**: `src/lib/adapters/openshell/sandbox-lifecycle.ts` (modified, +0/-2)
```diff
@@ -21,8 +21,6 @@ export type CreateOpenShellSandboxRequest = Readonly<{
   labels?: Readonly<Record<string, string>>;
   startupCommand: readonly string[];
   environment: NodeJS.ProcessEnv;
-  /** Credential-free Docker client config prepared for this create process only. */
-  dockerClientConfigDirectory?: string;
   workingDirectory?: string;
   runtimeSelection?: OpenShellRuntimeSelection;
 }>;
```

---

### Incident Patch 7: `327ce0a1` (2026-09-29)
**Commit Message**: fix(e2e): retain launch diagnostics and bound inference availability retries (#12389)

## Outcome

Readiness-publication failures now retain fixed stage and reason labels
instead of discarding their cause. Brev E2E retains safe inference
diagnostics and retries narrowly classified transient provider failures
within fixed limits. The launch harness avoids login-shell logout hooks
that can break cleanup and prevent an otherwise eligible retry.

## Reason

The [original Brev
failure](https://github.com/NVIDIA/NemoClaw/actions/runs/36341308665/job/108682308249)
occurred during readiness publication after image construction,
onboarding, and inference passed. The retained generic error could not
establish its root cause. Readiness has passed in subsequent diagnostic
runs; this PR does not claim to have proven or fixed that original
cause.

Subsequent runs exposed HTTP 503 responses, an overly restrictive
provider-error classifier, and a cleanup failure that prevented retries.
The [sixth
run](https://github.com/NVIDIA/NemoClaw/actions/runs/36471884669/job/109097637491)
retained `local: can only be used in a function` followed by `mode:
unbound variable` in both cleanup calls. Ubuntu Bash 

**File**: `src/lib/actions/sandbox/connect-flow.test.ts` (modified, +15/-0)
```diff
@@ -626,6 +626,21 @@ describe("connectSandbox flow", () => {
     );
   });
 
+  it("probe-only reports the readiness publication stage and safe reason", async () => {
+    const harness = createConnectHarness({
+      readinessPublicationResult: {
+        kind: "evidence-failed",
+        diagnostic: { stage: "publication-store", reason: "publication-time-unsafe" },
+      },
+    });
+    await expect(harness.connectSandbox("alpha", { probeOnly: true })).rejects.toThrow(
+      "process.exit(1)",
+    );
+    expect(harness.errorSpy).toHaveBeenCalledWith(
+      "  Readiness evidence: stage=publication-store reason=publication-time-unsafe",
+    );
+  });
+
   it("probe-only completes macOS recovery and exits zero when evidence is unavailable (#9278)", async () => {
     const harness = createConnectHarness({
       readinessDecision: {
```

**File**: `src/lib/actions/sandbox/connect.ts` (modified, +5/-0)
```diff
@@ -3081,6 +3081,11 @@ async function prepareConnectSandboxWithinLifecycleFence(
       console.error(
         "  Probe failed: complete probe and recovery succeeded, but final launch-readiness evidence could not be verified or published.",
       );
+      if (publication.diagnostic) {
+        console.error(
+          `  Readiness evidence: stage=${publication.diagnostic.stage} reason=${publication.diagnostic.reason}`,
+        );
+      }
       process.exit(1);
     }
     return null;
```

**File**: `src/lib/actions/sandbox/launch-readiness-observation-timing.test.ts` (modified, +67/-2)
```diff
@@ -157,6 +157,62 @@ describe("launch readiness observation timing", () => {
     }
   });
 
+  it("reports the failed publication operation without exposing exception details", async () => {
+    const publication = publicationFromDecision(
+      SANDBOX,
+      await inspectLaunchReadiness(
+        SANDBOX,
+        publicationDeps(vi.fn(), (_name, _gateway, _port, _epoch, identity) => lease(identity)),
+      ),
+    );
+    const secret = "private-value-that-must-not-appear";
+    const error = Object.assign(new Error(secret.repeat(1000)), { code: "EACCES", path: secret });
+    const storeDeps = publicationDeps(vi.fn(), (_name, _gateway, _port, _epoch, identity) =>
+      lease(identity),
+    );
+    storeDeps.publishLease = () => {
+      throw error;
+    };
+    expect(await publishLaunchReadiness(publication, storeDeps)).toEqual({
+      kind: "evidence-failed",
+      diagnostic: { stage: "publication-store", reason: "permission-denied" },
+    });
+    const lockDeps = publicationDeps(vi.fn(), (_name, _gateway, _port, _epoch, identity) =>
+      lease(identity),
+    );
+    lockDeps.withSandboxLock = () => {
+      throw error;
+    };
+    expect(await publishLaunchReadiness(publication, lockDeps)).toEqual({
+      kind: "evidence-failed",
+      diagnostic: { stage: "publication-lock", reason: "permission-denied" },
+    });
+  });
+
+  it("never validates or publishes evidence without a fenced epoch (#8942)", async () => {
+    const currentDeps = publicationDeps(vi.fn(), (_name, _gateway, _port, _epoch, identity) =>
+      lease(identity),
+    );
+    const publishLease = vi.fn();
+    currentDeps.publishLease = publishLease;
+
+    await expect(
+      publishLaunchReadiness(
+        {
+          sandboxName: SANDBOX,
+          gatewayName: GATEWAY,
+          gatewayPort: PORT,
+          epochId: null,
+        },
+        currentDeps,
+      ),
+    ).resolves.toEqual({
+      kind: "evidence-failed",
+      diagnostic: { stage: "publication-input", reason: "missing-authority" },
+    });
+    expect(publishLease).not.toHaveBeenCalled();
+  });
+
   it("checks retained authority around final capture and lease publication", async () => {
     const assertPublicationCurrent = vi.fn();
     const publishLease = vi.fn((_name, _gateway, _port, _epoch, identity, _options, commit) => {
@@ -197,7 +253,13 @@ describe("launch readiness observation timing", () => {
 
       await expect(
         publishLaunchReadiness(publicationFromDecision(SANDBOX, decision), currentDeps),
-      ).resolves.toEqual({ kind: "evidence-failed" });
+      ).resolves.toEqual({
+        kind: "evidence-failed",
+        diagnostic: {
+          stage: failureCall <= 2 ? "publication-validation" : "publication-store",
+          reason: "unclassified",
+        },
+      });
 
       expect(publishLease).toHaveBeenCalledTimes(expectedPublicationAttempts);
       expect(committed).toBe(false);
@@ -232,7 +294,10 @@ describe("launch readiness observation timing", () => {
 
     await expect(
       publishLaunchReadiness(publicationFromDecision(SANDBOX, decision), currentDeps),
-    ).resolves.toEqual({ kind: "evidence-failed" });
+    ).resolves.toEqual({
+      kind: "evidence-failed",
+      diagnostic: { stage: "publication-store", reason: "unclassified" },
+    });
 
     expect(readLaunchReadinessLease(SANDBOX, GATEWAY, PORT, storeOptions)).toEqual({
       kind: "missing",
```

**File**: `src/lib/actions/sandbox/launch-readiness.test.ts` (modified, +8/-20)
```diff
@@ -405,7 +405,10 @@ describe("launch readiness validation", () => {
 
     await expect(
       publishLaunchReadiness(publicationFromDecision(SANDBOX, first), currentDeps),
-    ).resolves.toEqual({ kind: "evidence-failed" });
+    ).resolves.toEqual({
+      kind: "evidence-failed",
+      diagnostic: { stage: "publication-validation", reason: "pairing-observation-failed" },
+    });
     expect(currentDeps.commandExecutor!.runBuffered).not.toHaveBeenCalled();
     expect(publishedIdentity).toBeNull();
   });
@@ -1423,6 +1426,7 @@ describe("launch readiness validation", () => {
     };
     expect(await publishLaunchReadiness(publication, observationUnavailable)).toEqual({
       kind: "evidence-failed",
+      diagnostic: { stage: "publication-validation", reason: "runtime-observation-failed" },
     });
 
     const pairingObservationUnavailable = deps();
@@ -1431,6 +1435,7 @@ describe("launch readiness validation", () => {
     };
     expect(await publishLaunchReadiness(publication, pairingObservationUnavailable)).toEqual({
       kind: "evidence-failed",
+      diagnostic: { stage: "publication-validation", reason: "pairing-observation-failed" },
     });
 
     const hashUnavailable = deps();
@@ -1457,6 +1462,7 @@ describe("launch readiness validation", () => {
     });
     expect(await publishLaunchReadiness(publication, inferenceObservationUnavailable)).toEqual({
       kind: "evidence-failed",
+      diagnostic: { stage: "publication-validation", reason: "runtime-observation-failed" },
     });
 
     const unavailable = deps();
@@ -1465,28 +1471,10 @@ describe("launch readiness validation", () => {
     };
     expect(await publishLaunchReadiness(publication, unavailable)).toEqual({
       kind: "evidence-failed",
+      diagnostic: { stage: "publication-store", reason: "unclassified" },
     });
   });
 
-  it("never validates or publishes evidence without a fenced epoch (#8942)", async () => {
-    const currentDeps = deps();
-    const publishLease = vi.fn();
-    currentDeps.publishLease = publishLease;
-
-    await expect(
-      publishLaunchReadiness(
-        {
-          sandboxName: SANDBOX,
-          gatewayName: GATEWAY_NAME,
-          gatewayPort: GATEWAY_PORT,
-          epochId: null,
-        },
-        currentDeps,
-      ),
-    ).resolves.toEqual({ kind: "evidence-failed" });
-    expect(publishLease).not.toHaveBeenCalled();
-  });
-
   it("rejects in-progress lifecycle and policy mutations", () => {
     const agent = loadAgent("openclaw");
     expect(() =>
```

**File**: `src/lib/actions/sandbox/launch-readiness.ts` (modified, +52/-9)
```diff
@@ -33,6 +33,7 @@ import { assertNoOpenShellGatewayEndpointOverride } from "../../openshell-gatewa
 import { parseAndValidateSandboxPolicy } from "../../policy/sandbox-policy-validation";
 import {
   checkLaunchReadinessMutationAuthority,
+  classifyLaunchReadinessStoreFailure,
   fenceLaunchReadinessLease,
   type LaunchReadinessFence,
   LaunchReadinessFenceError,
@@ -163,7 +164,21 @@ export type LaunchReadinessPublicationResult =
       failedCheck?: LaunchReadinessFailedCheck;
     }
   | { kind: "policy-observation-failed"; error: OpenShellSandboxError }
-  | { kind: "evidence-failed" };
+  | {
+      kind: "evidence-failed";
+      diagnostic?: {
+        stage:
+          | "publication-input"
+          | "publication-validation"
+          | "publication-store"
+          | "publication-lock";
+        reason:
+          | ReturnType<typeof classifyLaunchReadinessStoreFailure>
+          | "missing-authority"
+          | "pairing-observation-failed"
+          | "runtime-observation-failed";
+      };
+    };
 
 export type LaunchReadinessMutationGateResult<T> =
   | { kind: "entered"; value: T }
@@ -1417,7 +1432,11 @@ export async function publishLaunchReadiness(
   deps: LaunchReadinessDeps = {},
 ): Promise<LaunchReadinessPublicationResult> {
   const { sandboxName, gatewayName, gatewayPort, epochId } = publication;
-  if (!gatewayName || !gatewayPort || !epochId) return { kind: "evidence-failed" };
+  if (!gatewayName || !gatewayPort || !epochId)
+    return {
+      kind: "evidence-failed",
+      diagnostic: { stage: "publication-input", reason: "missing-authority" },
+    };
   const withSandboxLock = deps.withSandboxLock ?? withSandboxMutationLock;
   const withGatewayLock = deps.withGatewayLock ?? withGatewayRouteMutationLock;
   try {
@@ -1453,12 +1472,23 @@ export async function publishLaunchReadiness(
           const validation = publicationValidationCategory(error);
           return validation
             ? ({ kind: "validation-failed", ...validation } as const)
-            : ({ kind: "evidence-failed" } as const);
+            : ({
+                kind: "evidence-failed",
+                diagnostic: {
+                  stage: "publication-validation",
+                  reason:
+                    error instanceof OpenClawPairingQualificationError
+                      ? "pairing-observation-failed"
+                      : error instanceof LaunchReadinessEvidenceError
+                        ? "runtime-observation-failed"
+                        : classifyLaunchReadinessStoreFailure(error),
+                },
+              } as const);
         } finally {
           recordPerformanceStage("publication-validation", validationStartedAt);
         }
         const publicationStartedAt = performance.now();
-        let publicationFailed = false;
+        let publicationFailure: ReturnType<typeof classifyLaunchReadinessStoreFailure> | undefined;
         try {
           deps.assertPublicationCurrent?.();
           (deps.publishLease ?? publishLaunchReadinessLease)(
@@ -1470,17 +1500,30 @@ export async function publishLaunchReadiness(
             deps.storeOptions,
             deps.assertPublicationCurrent,
           );
-        } catch {
-          publicationFailed = true;
+        } catch (error) {
+          publicationFailure = classifyLaunchReadinessStoreFailure(error);
         } finally {
           recordPerformanceStage("publication-store", publicationStartedAt);
         }
-        if (publicationFailed) return { kind: "evidence-failed" } as const;
+        if (publicationFailure)
+          return {
+            kind: "evidence-failed",
+            diagnostic: {
+              stage: "publication-store",
+              reason: publicationFailure,
+            },
+          } as const;
         return { kind: "published" } as const;
       });
     });
-  } catch {
-    return { kind: "evidence-failed" };
+  } catch (error) {
+    return {
+      kind: "evidence-failed",
+    
```

---

### Incident Patch 8: `815ad8e3` (2026-09-29)
**Commit Message**: fix(ci): rebalance stable CLI coverage shards (#12479)

## Outcome

Rebalance the existing stable CLI test shards so the current main test
roster satisfies the unchanged 5.5% load limit. The busiest shard's
estimated load falls from 1,257,861 ms (5.67% above average) to
1,219,489 ms (2.45% above average).

## Reason

PR #12389's original shell-argument assertion failures are fixed, but
its CI now hits an inherited failure in
`test/repository/cli-coverage-sequencer.test.ts`. Running the same test
on current main `946fb1611be605f14af3bc7a78d964c0b331463f` reproduces
the exact failure: `1257861` exceeds `1255812.65625`. This dependency
isolates the main repair from the Brev readiness work.

The fixed hash assignment no longer balances the expanded roster within
the existing bound. The current-roster test detected it; its bound and
the independent serialized integration-lane bound remain intact.

### Related issues

Refs #6237. Unblocks #12389 after maintainer merge.

## Changes

- Recalibrate the CLI lane salt from `959` to `15873`, using the
existing timing hints and current 2,500-file roster. Integration and
E2E-support assignments stay unchanged.
- Update the pinned CLI ownership f

**File**: `src/lib/onboard/runtime-provider/podman.test.ts` (modified, +7/-1)
```diff
@@ -1,7 +1,7 @@
 // SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 // SPDX-License-Identifier: Apache-2.0
 
-import { describe, expect, it, vi } from "vitest";
+import { beforeAll, describe, expect, it, vi } from "vitest";
 import { createPodmanHostLocalInferenceTestHarness } from "../../../../test/helpers/podman-host-local-inference-test-harness";
 import type { OpenShellSandboxObserver } from "../../adapters/openshell/sandbox-observer";
 import { fingerprintOpenShellSandboxId } from "../../adapters/openshell/sandbox-identity";
@@ -306,6 +306,12 @@ function readyObserver(sandboxName: string): OpenShellSandboxObserver {
 }
 
 describe("managed Podman runtime provider", () => {
+  beforeAll(() => {
+    // startSandbox lazily loads connect. Load its source graph during suite setup
+    // so cold compilation does not consume the first lifecycle test's budget.
+    require("../../actions/sandbox/connect");
+  });
+
   it.each(AGENTS)(
     "runs basic CPU start and stop for %s through an injected bundle",
     async (agent) => {
```

**File**: `test/helpers/cli-coverage-sequencer.ts` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ const cliCoverageProjects = new Set(["cli", "integration", "e2e-support"]);
 // ordinary roster changes preserve ownership between profile refreshes.
 // Integration coverage is serialized, so it needs an independent salt instead
 // of relying on combined weight from the parallel CLI and E2E-support lanes.
-const stableShardSalt = "959";
+const stableShardSalt = "15873";
 const integrationShardSalt = "18608";
 const e2eSupportShardSalt = "25980";
 // Only measured outliers are stored; new and ordinary files share the
```

**File**: `test/repository/cli-coverage-sequencer.test.ts` (modified, +1/-1)
```diff
@@ -119,7 +119,7 @@ describe("stable CLI coverage sharding", () => {
     );
 
     expect(Object.fromEntries(owners)).toEqual({
-      "cli:src/lib/example.test.ts": 1,
+      "cli:src/lib/example.test.ts": 3,
       "e2e-support:test/e2e/support/example.test.ts": 1,
       "integration:test/agents/hermes/hermes-restart-config-seal-write-lock.test.ts": 2,
       "integration:test/credentials/local-credential-helper-fields.test.ts": 5,
```

---

### Incident Patch 9: `946fb161` (2026-09-29)
**Commit Message**: fix(vllm): retire the last sandbox's managed vLLM container and probe its recorded port (#11528)

## Outcome
Destroying the last registered `vllm-local` consumer now retires an
eligible NemoClaw-managed single-host vLLM container. `--keep-vllm`
preserves it explicitly. Status, doctor, and connect route-repair probes
accept the sandbox's validated recorded vLLM port without requiring the
onboarding environment.

## Reason
A retained managed vLLM container can keep GPU memory allocated after
its final sandbox is gone. Bearerless health probes can also report the
wrong port. Cleanup must preserve operator-owned/shared runtimes and
retry authority whenever ownership, deletion, or Docker inventory is
uncertain.

### Related issues
Fixes #11374

## Changes
- Retire only the exact inspected, eligible managed container after
confirmed sandbox deletion and a host-wide scan for remaining consumers.
Reuse the existing sandbox lifecycle lock and portable host fence;
retain existing MCP ownership.
- Record pending retirement before removing the registry row. Use the
existing atomic configuration writer so a linked pending-record path
cannot overwrite another host file. Keep registry/recovery st

**File**: `.github/workflows/e2e-standard-profile.yaml` (modified, +27/-0)
```diff
@@ -508,6 +508,25 @@ jobs:
             -u NVIDIA_API_KEY -u NVIDIA_INFERENCE_API_KEY -u BRAVE_API_KEY -u GITHUB_TOKEN \
             -u COMPATIBLE_API_KEY bash scripts/install-openshell.sh
 
+      - name: Prepare GPU launch-readiness runtime directory
+        id: gpu_runtime_directory
+        if: ${{ inputs.catalogue_id == 'gpu-e2e' && inputs.runtime_provider == 'docker' }}
+        shell: /bin/bash --noprofile --norc -e -o pipefail {0}
+        run: |
+          set -euo pipefail
+          uid="$(/usr/bin/id -u)"
+          unit="user@${uid}.service"
+          prior_state="$(/usr/bin/systemctl show "$unit" --property=ActiveState --value)"
+          if [[ "$prior_state" != "active" ]]; then
+            [[ "$prior_state" == "inactive" ]]
+            printf 'started=true\n' >> "$GITHUB_OUTPUT"
+            /usr/bin/sudo -n /usr/bin/systemctl start "$unit"
+          fi
+          /usr/bin/systemctl is-active --quiet "$unit"
+          runtime_directory="/run/user/$uid"
+          [[ -d "$runtime_directory" && ! -L "$runtime_directory" ]]
+          [[ "$(/usr/bin/stat -c '%u:%a' "$runtime_directory")" == "${uid}:700" ]]
+
       - name: Run catalogue E2E target
         env:
           INSTALL_MODE: ${{ inputs.install_mode }}
@@ -635,6 +654,14 @@ jobs:
         with:
           enabled: "true"
 
+      - name: Restore GPU launch-readiness runtime directory
+        if: ${{ always() && inputs.catalogue_id == 'gpu-e2e' && inputs.runtime_provider == 'docker' && steps.gpu_runtime_directory.outputs.started == 'true' }}
+        shell: /bin/bash --noprofile --norc -e -o pipefail {0}
+        run: |
+          set -euo pipefail
+          uid="$(/usr/bin/id -u)"
+          /usr/bin/sudo -n /usr/bin/systemctl stop "user@${uid}.service"
+
       - name: Clean up Docker auth
         if: always()
         shell: bash
```

**File**: `.github/workflows/e2e.yaml` (modified, +29/-36)
```diff
@@ -4878,50 +4878,43 @@ jobs:
       - id: runtime-bases
         name: Resolve digest-pinned amd64 runtime base images
         env:
+          CHECKOUT_SHA: ${{ inputs.checkout_sha || github.sha }}
           DCODE_BASE_REF: ${{ needs.base-image-publication.outputs.dcode_base_ref }}
+          HERMES_BASE_REF: ghcr.io/nvidia/nemoclaw/hermes-sandbox-base@${{ steps.runtime-hermes-base.outputs.digest }}
         shell: bash
         run: |
           set -euo pipefail
           work_dir="$(mktemp -d "${RUNNER_TEMP}/nemoclaw-runtime-bases.XXXXXX")"
           trap 'rm -rf -- "$work_dir"' EXIT
 
-          resolve_base() {
-            local output_name="$1"
-            local alias="$2"
-            local repository="$3"
-            local alias_raw="$work_dir/${output_name}-alias.raw"
-            local exact_raw="$work_dir/${output_name}-exact.raw"
-            docker buildx imagetools inspect "$alias" --raw > "$alias_raw"
-            local digest
-            digest="$(
-              jq -er '
-                if (
-                  .mediaType == "application/vnd.oci.image.index.v1+json" or
-                  .mediaType == "application/vnd.docker.distribution.manifest.list.v2+json"
-                ) then
-                  [.manifests[] | select(.platform.os == "linux" and .platform.architecture == "amd64")]
-                  | if length == 1 then .[0].digest else error("not one exact amd64 descriptor") end
-                else
-                  error("base alias is not a platform index")
-                end
-              ' "$alias_raw"
-            )"
-            [[ "$digest" =~ ^sha256:[a-f0-9]{64}$ ]] || {
-              echo "::error::${output_name} base alias returned an invalid digest" >&2
-              exit 1
-            }
-            local reference="${repository}@${digest}"
-            docker buildx imagetools inspect "$reference" --raw > "$exact_raw"
-            [[ "sha256:$(sha256sum "$exact_raw" | awk '{print $1}')" == "$digest" ]] || {
-              echo "::error::${output_name} exact base bytes do not match the selected digest" >&2
-              exit 1
-            }
-            printf '%s=%s\n' "$output_name" "$reference" >> "$GITHUB_OUTPUT"
+          # The mutable base alias can move after the startup job prepared this cache.
+          # Reuse that job's exact OpenClaw base and preserve the other identity checks.
+          prepared_inputs="$NEMOCLAW_PROTECTED_MANAGED_IMAGE_BUILD_CACHE/prepared-inputs"
+          [[ -f "$prepared_inputs" && ! -L "$prepared_inputs" ]] || {
+            echo "::error::protected build cache has no safe prepared-input identity" >&2
+            exit 1
           }
-
-          resolve_base openclaw \
-            ghcr.io/nvidia/nemoclaw/sandbox-base:latest \
-            ghcr.io/nvidia/nemoclaw/sandbox-base
+          read -r cached_revision cached_platform cached_openclaw cached_hermes cached_dcode extra < "$prepared_inputs"
+          [[ -z "$extra" &&
+             "$cached_revision" == "$CHECKOUT_SHA" &&
+             "$cached_platform" == "linux/amd64" &&
+             "$cached_hermes" == "$HERMES_BASE_REF" &&
+             "$cached_dcode" == "$DCODE_BASE_REF" &&
+             "$(cat "$prepared_inputs")" == "$cached_revision $cached_platform $cached_openclaw $cached_hermes $cached_dcode" ]] || {
+            echo "::error::protected build-cache identity does not match this run" >&2
+            exit 1
+          }
+          [[ "$cached_openclaw" =~ ^ghcr[.]io/nvidia/nemoclaw/sandbox-base@sha256:[a-f0-9]{64}$ ]] || {
+            echo "::error::prepared OpenClaw base is not an exact approved image reference" >&2
+            exit 1
+          }
+          openclaw_digest="${cached_openclaw##*@}"
+          docker buildx imagetools inspect "$cached_openclaw" --raw > "$work_dir/openclaw-exact.raw"
+          [[ "sha256:$(sha256sum "$work_dir/openclaw-exact.raw" | awk '{print $1}')" == "$openclaw_digest" ]] || {
+            echo "::error::OpenClaw exact base
```

**File**: `ci/e2e-assertion-budget.json` (modified, +7/-7)
```diff
@@ -15,25 +15,25 @@
     "testFileCount": 77,
     "liveFileCount": 186,
     "direct": {
-      "expectCalls": 1278,
-      "matcherAssertions": 1257,
+      "expectCalls": 1275,
+      "matcherAssertions": 1254,
       "nodeAssertions": 104,
       "namedAssertionHelpers": 436,
       "failCalls": 0,
       "throwGuards": 60,
-      "objectFieldAssertions": 163,
+      "objectFieldAssertions": 166,
       "assertionPoints": 2020,
       "generatedProbeBlocks": 91,
       "generatedProbeConditions": 221
     },
     "unique": {
-      "expectCalls": 1703,
-      "matcherAssertions": 1677,
+      "expectCalls": 1700,
+      "matcherAssertions": 1674,
       "nodeAssertions": 127,
       "namedAssertionHelpers": 681,
       "failCalls": 1,
       "throwGuards": 540,
-      "objectFieldAssertions": 240,
+      "objectFieldAssertions": 243,
       "assertionPoints": 3266,
       "generatedProbeBlocks": 213,
       "generatedProbeConditions": 726
@@ -63,7 +63,7 @@
       "test/e2e/live/external-gateway-health.test.ts": [4,5,4,11,0],
       "test/e2e/live/full-e2e.test.ts": [27,31,28,61,7],
       "test/e2e/live/gpu-double-onboard.test.ts": [21,24,21,24,0],
-      "test/e2e/live/gpu-e2e.test.ts": [39,44,72,90,3],
+      "test/e2e/live/gpu-e2e.test.ts": [36,44,69,90,3],
       "test/e2e/live/hermes-discord.test.ts": [10,25,17,64,14],
       "test/e2e/live/hermes-e2e.test.ts": [82,93,112,127,3],
       "test/e2e/live/hermes-gpu-startup.test.ts": [19,27,59,84,12],
```

**File**: `ci/source-architecture-budget.json` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@
       "src/lib/runner.ts": 80,
       "src/lib/sandbox-name-contract.ts": 20,
       "src/lib/security/redact.ts": 50,
-      "src/lib/state/mcp-lifecycle-lock.ts": 20,
+      "src/lib/state/mcp-lifecycle-lock.ts": 19,
       "src/lib/state/onboard-session.ts": 35,
       "src/lib/state/registry.ts": 87,
       "src/lib/state/state-root.ts": 21,
```

**File**: `docs/inference/set-up-vllm.mdx` (modified, +13/-2)
```diff
@@ -21,6 +21,11 @@ The vLLM `/v1/responses` endpoint does not run the configured tool-call parser,
 <Warning>
 Local vLLM does not require authentication by default.
 Existing-server and single-host managed-vLLM paths use `NEMOCLAW_VLLM_PORT`, which defaults to `8000`, on host loopback for validation and on the OpenShell Docker bridge for sandbox traffic.
+After onboarding, `status` and `doctor` probe an authenticated managed single-host vLLM container on its published loopback port.
+For a bearerless server, they use the port in the sandbox's recorded `http://host.openshell.internal:<port>/v1` route.
+When that route is valid, no later port environment override is required.
+For vLLM, `connect` runs these host probes only when it repairs the route.
+A missing or invalid recorded route makes a bearerless probe fall back to `NEMOCLAW_VLLM_PORT`, which defaults to `8000`.
 Use a host firewall with default-deny inbound rules.
 Allow the configured TCP port only from the OpenShell Docker subnet to its gateway address, keep loopback access, and deny the port on every other interface.
 Do not expose the port to your LAN or the internet.
@@ -152,7 +157,13 @@ $$nemoclaw onboard --profile <profile-id> --vllm-gpu-device <index-or-uuid>
 #### Handle a Running vLLM Server
 
 The single-host managed vLLM runtime is host-global.
-Destroying a sandbox does not stop it, and the container remains available for other sandboxes.
+`$$nemoclaw <name> destroy` keeps the container while any registered sandbox in any gateway state root reports provider `vllm-local`.
+Local NIM uses the same provider identifier and counts as a possible consumer.
+After the last such sandbox is destroyed, an eligible `destroy` removes the verified NemoClaw-managed container and frees its GPU memory.
+When ownership or Docker state cannot be verified, NemoClaw retains recovery state and reports the reason instead of claiming completed retirement.
+Resolve the cause, then rerun the same `destroy` command.
+Pass `--keep-vllm` or set `NEMOCLAW_KEEP_VLLM=1` to preserve the container for a later sandbox.
+Refer to [CLI Commands](../../reference/commands) for the cleanup conditions.
 Later standard onboarding normally reuses a server that is already listening on the configured vLLM port instead of replacing it automatically.
 When a managed GPU selection accompanies explicit managed-install intent, NemoClaw preserves that intent and reports the running-server conflict.
 
@@ -189,7 +200,7 @@ Choose one action:
   ```
 
 Accept the result when onboarding completes and `$$nemoclaw list` reports the new sandbox with provider `vllm-local` and the expected model.
-NemoClaw does not stop or recreate a running vLLM server automatically because another sandbox can use it.
+Onboarding does not stop or recreate a running vLLM server automatically because another sandbox can use it.
 
 NemoClaw requires a resumed session to reuse the recorded GPU selector.
 A legacy in-progress session cannot add one, and a resumed session cannot change one.
```

---

### Incident Patch 10: `a4702f8b` (2026-09-29)
**Commit Message**: fix(onboard): initialize custom OpenClaw route (#12421)

<!-- markdownlint-disable MD041 -->
## Outcome

Fresh OpenClaw sandboxes created from a custom Dockerfile now apply the
selected OpenShell inference route through OpenClaw's native
configuration interface before onboarding completes. When the selected
model differs from the baked model, stale `contextWindow` and
`maxTokens` values are removed instead of being inherited.

## Reason

Custom images retain the base image's generated `openclaw.json`. The
OpenShell route could therefore select one model while OpenClaw kept
another model's identity and limits, which changed compaction and
output-cap behavior.

### Related issues

Fixes #12033

## Changes

- Add a one-time native route initializer for unfinished custom-image
OpenClaw onboarding. Final onboarding consumes it because native
OpenClaw configuration is authoritative; changing only the OpenShell
route cannot update OpenClaw's model metadata. Focused setup and
state-machine tests protect fresh, resumed, completed, rebuild, and
restart-failure behavior.
- Reuse the existing atomic native config batch and require a confirmed
native gateway restart before marking the OpenClaw 

**File**: `src/lib/actions/inference-set-context-window.test.ts` (modified, +2/-2)
```diff
@@ -39,13 +39,13 @@ describe("runInferenceSet context window", () => {
     expect(logged).toMatch(/Context window for 'qwen2\.5:7b': 16384 tokens/);
   });
 
-  it("keeps the existing window and warns when it cannot be determined", async () => {
+  it("drops another model's window and warns when the selected window is unknown (#12033)", async () => {
     const config = ollamaConfig();
     const deps = createDeps({ config, session: baseSession(), contextWindow: null });
 
     await runInferenceSet({ provider: "ollama-local", model: "qwen2.5:7b", noVerify: true }, deps);
 
-    expect(inferenceModels(config)[0].contextWindow).toBe(131072);
+    expect(inferenceModels(config)[0].contextWindow).toBeUndefined();
     const logged = deps.calls.log.mock.calls.map((a) => String(a[0])).join("\n");
     expect(logged).toMatch(/could not determine the context window/i);
     expect(logged).toMatch(/rebuild/);
```

**File**: `src/lib/actions/inference-set-openclaw-run.test.ts` (modified, +0/-1)
```diff
@@ -54,7 +54,6 @@ describe("runInferenceSet OpenClaw routing", () => {
         : {
             id: "nvidia/new-model",
             name: "inference/nvidia/new-model",
-            contextWindow: 65536,
             params: { temperature: 0.3 },
           };
       expect(providerUpdate?.value).toEqual({
```

**File**: `src/lib/actions/inference-set-patch-openclaw.test.ts` (modified, +74/-5)
```diff
@@ -13,7 +13,7 @@ function providerModels(config: ConfigObject, providerKey: string): ConfigObject
 }
 
 describe("patchOpenClawInferenceConfig", () => {
-  it("writes provider-qualified model refs while preserving model metadata", () => {
+  it("writes provider-qualified model refs without inheriting another model's limits (#12033)", () => {
     const config: ConfigObject = {
       agents: { defaults: { model: { primary: "inference/moonshotai/kimi-k2.6" } } },
       models: {
@@ -59,8 +59,6 @@ describe("patchOpenClawInferenceConfig", () => {
             {
               id: "nvidia/nemotron-3-super-120b-a12b",
               name: "inference/nvidia/nemotron-3-super-120b-a12b",
-              contextWindow: 131072,
-              maxTokens: 8192,
               reasoning: true,
             },
             {
@@ -189,6 +187,39 @@ describe("patchOpenClawInferenceConfig", () => {
     expect(result.changed).toBe(false);
   });
 
+  it("preserves limits for the selected model regardless of its array position (#12033)", () => {
+    const config: ConfigObject = {
+      agents: { defaults: { model: { primary: "inference/nvidia/old-model" } } },
+      models: {
+        mode: "merge",
+        providers: {
+          inference: {
+            baseUrl: "https://inference.local/v1",
+            apiKey: "unused",
+            api: "openai-completions",
+            models: [
+              { id: "nvidia/old-model", name: "inference/nvidia/old-model" },
+              {
+                id: "nvidia/model-a",
+                name: "inference/nvidia/model-a",
+                contextWindow: 65536,
+                maxTokens: 4096,
+              },
+            ],
+          },
+        },
+      },
+    };
+
+    patchOpenClawInferenceConfig(config, "nvidia-prod", "nvidia/model-a");
+
+    expect(providerModels(config, "inference")[1]).toMatchObject({
+      id: "nvidia/model-a",
+      contextWindow: 65536,
+      maxTokens: 4096,
+    });
+  });
+
   it("records a provider switch in a request marker without replacing other headers", () => {
     const config: ConfigObject = {
       agents: { defaults: { model: { primary: "inference/nvidia/old-model" } } },
@@ -279,7 +310,45 @@ describe("patchOpenClawInferenceConfig", () => {
     ]);
   });
 
-  it("preserves a valid Anthropic target reply budget over the active provider value", () => {
+  it("does not inherit a custom image's baked reply budget during initial routing (#12033)", () => {
+    const config: ConfigObject = {
+      agents: { defaults: { model: { primary: "inference/baked-model" } } },
+      models: {
+        providers: {
+          inference: {
+            models: [
+              {
+                id: "baked-model",
+                name: "inference/baked-model",
+                maxTokens: 128,
+              },
+            ],
+          },
+        },
+      },
+    };
+
+    patchOpenClawInferenceConfig(
+      config,
+      "anthropic-prod",
+      "claude-sonnet-4-6",
+      null,
+      undefined,
+      "anthropic-prod",
+      { effort: null, explicit: false },
+      false,
+    );
+
+    expect(providerModels(config, "anthropic")).toEqual([
+      {
+        id: "claude-sonnet-4-6",
+        name: "anthropic/claude-sonnet-4-6",
+        maxTokens: 4096,
+      },
+    ]);
+  });
+
+  it("does not inherit another Anthropic model's reply budget", () => {
     const config: ConfigObject = {
       agents: { defaults: { model: { primary: "inference/model-a" } } },
       models: {
@@ -300,7 +369,7 @@ describe("patchOpenClawInferenceConfig", () => {
       {
         id: "claude-sonnet-4-6",
         name: "anthropic/claude-sonnet-4-6",
-        maxTokens: 2048,
+        maxTokens: 8192,
       },
       { id: "old-model", name: "anthropic/old-model", maxTokens: 2048 },
     ]);
```

**File**: `src/lib/actions/inference-set.ts` (modified, +16/-5)
```diff
@@ -630,6 +630,13 @@ function buildProviderConfig(
   );
   const selectedModel = cloneConfigObject(existingModels[selectedIndex] ?? existingModels[0]);
   delete selectedModel.compat;
+  if (selectedIndex < 0) {
+    // A different model's limits are not evidence for the selected model. Let
+    // OpenClaw use its own defaults unless this route has an authoritative
+    // value below.
+    delete selectedModel.contextWindow;
+    delete selectedModel.maxTokens;
+  }
   selectedModel.id = model;
   selectedModel.name = route.primaryModelRef;
   // Recompute for the new model rather than inheriting the prior model's window.
@@ -668,10 +675,13 @@ export function patchOpenClawInferenceConfig(
   contextWindow?: number,
   upstreamProviderMarker?: string,
   reasoningEffort: ReasoningEffortRequest = { effort: null, explicit: false },
+  inheritPrimaryReplyBudget = true,
 ): { changed: boolean; route: SandboxInferenceConfig } {
   const before = JSON.stringify(config);
   const route = getSandboxInferenceConfig(model, provider, preferredInferenceApi);
-  const inheritedMaxTokens = readOpenClawPrimaryReplyBudget(config);
+  const inheritedMaxTokens = inheritPrimaryReplyBudget
+    ? readOpenClawPrimaryReplyBudget(config)
+    : undefined;
 
   updateAgentPrimary(config, route.primaryModelRef);
 
@@ -693,12 +703,12 @@ export function patchOpenClawInferenceConfig(
   return { changed: before !== JSON.stringify(config), route };
 }
 
-function writeOpenClawInferenceConfigNatively(
+export function writeOpenClawInferenceConfigNatively(
   sandboxName: string,
   config: ConfigObject,
   route: SandboxInferenceConfig,
   writeValues: InferenceSetDeps["setOpenClawConfigValues"],
-  gatewayName: string,
+  gatewayName?: string,
 ): void {
   const agents = config.agents;
   const models = config.models;
@@ -1528,8 +1538,9 @@ async function runInferenceSetWithoutHostLock(
         deps.log(`  Context window for '${model}': ${contextWindow} tokens`);
       } else {
         deps.log(
-          `  Warning: could not determine the context window for '${model}'; keeping the ` +
-            `existing value. Run '${CLI_NAME} ${sandboxName} rebuild' to re-probe it.`,
+          `  Warning: could not determine the context window for '${model}'; preserving a ` +
+            `matching model value when present, otherwise letting OpenClaw use its default. ` +
+            `Run '${CLI_NAME} ${sandboxName} rebuild' to re-probe it.`,
         );
       }
       patched = patchOpenClawInferenceConfig(
```

**File**: `src/lib/onboard.ts` (modified, +2/-2)
```diff
@@ -3181,10 +3181,10 @@ async function runOnboard(opts: OnboardOptions = {}): Promise<void> {
         preserveRebuildLivePolicy: opts.rebuildPolicySourcePath !== undefined,
         agentSetupDeps: {
           handleAgentSetup: agentOnboard.handleAgentSetup,
-          agentSetupContext: (): import("./agent/onboard").OnboardContext => ({
+          agentSetupContext: () => ({
             step,
             sandboxCommandExecutor: sandboxExec,
-            gatewayName: GATEWAY_NAME,
+            gatewayName: GATEWAY_NAME!,
             startRecordedStep,
             recordStepComplete,
             recordStepFailed,
```

#### Recent Merged Pull Requests:
- **PR #12513** (closed): fix(deps): remediate Undici advisories (@rsliter)
- **PR #12506** (closed): fix(deps): patch Undici across managed OpenClaw runtimes (@ericksoa)
- **PR #12498** (2026-09-30): refactor(provider): isolate OpenShell transport (@rsliter)
- **PR #12489** (2026-09-29): test(e2e): expect Balanced Homebrew preset (Fixes #12488) (@deepujain)
- **PR #12485** (2026-09-29): fix(skills): preserve authorized PR follow-up (@rsliter)
- **PR #12484** (2026-09-29): fix(onboard): reduce dashboard forward authority checks (@rsliter)
- **PR #12479** (2026-09-29): fix(ci): rebalance stable CLI coverage shards (@jyaunches)
- **PR #12468** (2026-09-29): test(config): verify OpenClaw OTLP export in v1 (@kaofelix)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
