# Forensic Learning Record (Deep Inspection): harvard-edge/cs249r_book

> **Canonical Artifact**: `07_PROJECT_LEARNING/harvard-edge-cs249r_book-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/harvard-edge/cs249r_book](https://github.com/harvard-edge/cs249r_book))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:26:39.153Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `harvard-edge/cs249r_book`
- **Description**: Machine Learning Systems: Foundations, Scaling, Agentic AI, and Physical AI (Vols I–IV) • Harvard CS249r | https://mlsysbook.ai
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 28747 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `binder/__init__.py`
```
# MLSysBook toolchain: the binder CLI, its checks, and supporting tools.
# The book sources live in books/.
"""MLSysBook toolchain: the binder CLI, its checks, and supporting tools."""

```

### Core Architecture Module: `binder/cli/__init__.py`
```
"""
MLSysBook CLI Package

A modular command-line interface for building, previewing, and managing
the Machine Learning Systems textbook.
"""

__version__ = "2.0.0"
__author__ = "MLSysBook Team"

```

### Core Architecture Module: `binder/cli/checks/__init__.py`
```
"""
Binder-native check implementations.

Check logic that powers ``./binder/binder check <group> --scope …`` lives here
as ordinary Python modules. ``binder/cli/commands/validate.py`` imports from
this package and converts results to ``ValidationIssue`` records.

Temporary standalone shims may import from ``cli.checks`` during migration, but
Binder must not depend on scripts under ``binder/tools/`` for core checks.

See ``binder/cli/README.md`` → "Check implementation layout".
"""

```

### Core Architecture Module: `binder/cli/checks/bib_lint.py`
```
#!/usr/bin/env python3
"""BibTeX linter, validator, and formatter for the MLSysBook project.

Enforces the canonical schema and formatting rules documented in
the project prose style guide §5 Bibliography Hygiene.

Usage:
    python3 binder/tools/bib_lint.py <file.bib> [--check|--fix|--report]
    python3 binder/tools/bib_lint.py --all [--check|--fix|--report]
    ./binder/binder check bib

Modes:
    --check   Exit 1 if any violations found; no output rewrites.
              Default when called from pre-commit.
    --fix     Rewrite the file(s) to canonical form: fix field order,
              indentation, quoting, spacing, trailing commas.
    --report  Print a detailed violation report without rewriting.
              Default when called directly.

What it does:
    1. Parses .bib files with a proper state machine (brace counting +
       quote tracking). Handles nested braces in titles correctly.
    2. Validates each entry against §5 schema: required fields per
       entry type, author list rules, journal spell-out, publisher
       canonical forms, title trailing period / all-caps paste, title
       Title-Case heuristics, short `booktitle` without `(ACRONYM)`,
       @article + volume (non-preprint), pages `p.`/`pp.` prefix, etc.
    3. Auto-fixes safely-fixable violations: field reordering,
       indentation, quote style, trailing commas, en-dash in pages.
    4. Reports unfixable violations (missing required fields,
       abbreviated journal names, initial-only authors) as warnings
       so the Pass 16+ sweep can address them through source verification.

What it does NOT do:
    - Invent missing field values. If `publisher` is absent, it is
      reported, not filled.
    - Verify metadata against external sources. That's the job of the
      batch review sweep + (future) Crossref refresh tool.
    - Rewrite or paraphrase content. All field VALUES are preserved
      byte-exact across --fix runs; only FORMATTING changes.

Integration points:
    - Binder: imported by `./binder/binder check bib`, which owns the
      publication gate and emits structured JSON.
    - Compatibility CLI: `binder/tools/bib_lint.py` is a thin wrapper for
      ad-hoc reports, formatting, and baseline regeneration.
    - Apply pipeline: the batch review sweep calls `apply_fields()` on
      each .bib file after verified metadata is returned. This
      function is the SAFE way to insert new fields into an entry —
      no regex, no brace-counting bugs.

Canonical rule source:
    the project prose style guide §5 "Bibliography Hygiene" (see also
    `book-prose-merged.md` if present).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


# ─── Allow-list for pre-existing issues ──────────────────────────────────────

# Location of the baseline files that grandfather known pre-existing
# violations. The pre-commit hook checks new violations against this
# baseline -- violations in the baseline are allowed; anything else
# blocks the commit. The baseline is regenerated via --baseline /
# --style-baseline mode and committed to the repo so it's auditable.
BOOK_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = BOOK_DIR.parent
ALLOW_LIST_PATH = BOOK_DIR / "tools" / "bib_lint_baseline.json"
STYLE_ALLOW_LIST_PATH = BOOK_DIR / "tools" / "bib_lint_style_baseline.json"
STYLE_BASELINE_SEVERITIES = {"warning", "info"}


def baseline_file_key(path: str | Path, repo_root: Path | None = None) -> str:
    """Return the stable repo-relative path stored in bib lint baselines."""
    p = Path(path)
    root = (repo_root or REPO_ROOT).resolve()
    if p.is_absolute():
        try:
            return p.resolve().relative_to(root).as_posix()
        except ValueError:
            return p.as_posix()
    return p.as_posix()


def load_baseline() -> set[tuple[str, str, str]]:
    """Load the baseline allow-list as a set of (file, key, rule) tuples."""
    if not ALLOW_LIST_PATH.exists():
        return set()
    data = json.loads(ALLOW_LIST_PATH.read_text())
    return {(e["file"], e["key"], e["rule"]) for e in data.get("allowed", [])}


def load_style_baseline() -> set[tuple[str, str, str]]:
    """Load the warning/info allow-list as (file, key, rule) tuples."""
    if not STYLE_ALLOW_LIST_PATH.exists():
        return set()
    data = json.loads(STYLE_ALLOW_LIST_PATH.read_text())
    return {(e["file"], e["key"], e["rule"]) for e in data.get("allowed", [])}


def save_baseline(violations: list[tuple[str, "Violation"]]) -> None:
    """Write the baseline allow-list from a list of (file, violation) pairs."""
    entries = sorted(
        [
            {"file": fp, "key": v.entry_key, "rule": v.rule,
             "message": v.message}
            for fp, v in violations
            if v.severity == "error"
        ],
        key=lambda e: (e["file"], e["key"], e["rule"]),
    )
    ALLOW_LIST_PATH.write_text(
        json.dumps(
            {
                "description": (
                    "bib_lint allow-list: pre-existing violations grandfathered "
                    "at the time of the baseline. New violations NOT in this file "
                    "will block commits. Regenerate via: "
                    "python3 binder/tools/bib_lint.py --all --baseline"
                ),
                "generated": "2026-04-08",
                "allowed": entries,
            },
            indent=2,
        )
        + "\n"
    )


def save_style_baseline(violations: list[tuple[str, "Violation"]]) -> None:
    """Write the baseline allow-list for known warning/info metadata debt."""
    entries = sorted(
        [
            {
                "file": fp,
                "key": v.entry_key,
                "rule": v.rule,
                "severity": v.severity,
                "message": v.message,
            }
            for fp, v in violations
            if v.severity in STYLE_BASELINE_SEVERITIES
        ],
        key=lambda e: (e["file"], e["key"], e["rule"]),
    )
    STYLE_ALLOW_LIST_PATH.write_text(
        json.dumps(
            {
                "description": (
                    "bib_lint style allow-list: pre-existing warning/info "
                    "metadata debt grandfathered when the Binder bib style "
                    "ratchet was enabled. New warning/info issues NOT in this "
                    "file will block `./binder/binder check bib` with actionable "
                    "suggestions. Regenerate only after reviewing or accepting "
                    "current debt via: python3 binder/tools/bib_lint.py --all "
                    "--style-baseline"
                ),
                "generated": "2026-06-14",
                "allowed": entries,
            },
            indent=2,
        )
        + "\n"
    )


# ─── Canonical schema (from §5) ──────────────────────────────────────────────

REQUIRED_FIELDS: dict[str, list[str]] = {
    "inproceedings": ["author", "title", "booktitle", "publisher", "year"],
    "article": ["author", "title", "journal", "year"],
    "book": ["title", "publisher", "year"],  # author OR editor
    "incollection": ["author", "title", "booktitle", "publisher", "year"],
    "techreport": ["author", "title", "institution", "year"],
    "phdthesis": ["author", "title", "school", "year"],
    "mastersthesis": ["author", "title", "school", "year"],
    "misc": ["title"],
}

# Canonical field order per entry type (from §5 template)
CANONICAL_ORDER: dict[str, list[str]] = {
    "inproceedings": [
        "author", "editor", "title", "booktitle", "publisher",
        "year", "pages", "volume", "series", "address", "doi", "url",
    ],
    "article": [
        "author", "title", "journal", "volume", "number", "pages",
        "year", "month", "doi", "url",
    ],
    "book": [
        "author", "editor", "title", "publisher", "year", "edition",
        "address", "isbn", "doi", "url",
  
```

### Core Architecture Module: `binder/cli/checks/binder_canonical.py`
```
"""Binder-as-front-door invariant check for the pre-commit config.

This powers::

    ./binder/binder check cli --scope binder-canonical

The rule it enforces, in one sentence: **every pre-commit hook that targets
book content must dispatch through ``./binder/binder``, not call a raw script.**

Why this exists
---------------
Binder is the single front door for all book-content checks: one entry point,
one error format, one place to register a new scope. Over time it is tempting
to wire a quick ``entry: python3 some_script.py`` hook for a new check instead
of adding a Binder scope. That silently grows a second invocation path —
exactly the drift this check forbids. The day it caught its first real case:
``book-check-lego-units`` called ``lint_lego_units.py`` directly while Binder
already ran the same linter as ``code/lego-units`` (retired 2026-06-10).

What counts as a "book-content hook"
------------------------------------
A *local* hook (``repo: local``) with an explicit ``entry:`` whose ``files:``
pattern is scoped to ``books/``. Repo-wide guards (link checks,
mirror sync), CI hygiene, third-party hooks (mdformat, codespell — no local
``entry:``), and separate subprojects (vault-cli) are intentionally NOT book
content and are not inspected.

How to satisfy it
-----------------
Route the hook through Binder: add a ``Scope(...)`` to the relevant
``binder check <group>`` and set the hook ``entry`` to ``./binder/binder check
<group>``. If a book-content hook genuinely cannot be a Binder scope, add its
id to ``ALLOWLIST`` below with a one-line justification so the exception is
explicit and reviewed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import List

import yaml

# Marker that a hook's `files:` pattern is scoped to book chapter content.
BOOK_CONTENT_MARKER = "books"

# Prefix that marks an entry as dispatching through the Binder front door.
BINDER_ENTRY_RE = re.compile(r"^\.?/?binder\b")

# Book-content hooks that are deliberately allowed to bypass Binder.
# Format: hook-id -> justification. Empty by design: every book-content hook
# currently routes through Binder. Add an entry ONLY with a real reason.
ALLOWLIST: dict[str, str] = {}

CONFIG_REL = ".pre-commit-config.yaml"


@dataclass(frozen=True)
class Violation:
    """One pre-commit hook that violates the Binder front-door rule."""

    file: str
    line: int
    code: str
    message: str
    context: str = ""
    suggestion: str = ""


def _hook_line(raw_lines: List[str], hook_id: str) -> int:
    """Best-effort line number of `- id: <hook_id>` for a clickable location."""
    needle = re.compile(rf"^\s*-\s*id:\s*{re.escape(hook_id)}\s*$")
    for i, line in enumerate(raw_lines, 1):
        if needle.match(line):
            return i
    return 1


def _targets_book_content(files_pattern: str) -> bool:
    """Return True if a hook's ``files:`` pattern mentions the book content marker."""
    return BOOK_CONTENT_MARKER in (files_pattern or "")


def _dispatches_through_binder(entry: str) -> bool:
    """Return True if a hook's ``entry:`` starts with the ``binder`` launcher path."""
    return bool(BINDER_ENTRY_RE.match((entry or "").strip()))


def run_canonical(repo_root: Path) -> List[Violation]:
    """Return a Violation for every book-content hook that bypasses Binder."""
    config_path = repo_root / CONFIG_REL
    violations: List[Violation] = []
    if not config_path.is_file():
        return [
            Violation(
                file=CONFIG_REL,
                line=1,
                code="BINDER-CANON-000",
                message=f"{CONFIG_REL} not found at repo root.",
                suggestion=f"Expected the pre-commit config at {config_path}.",
            )
        ]

    raw_lines = config_path.read_text(encoding="utf-8").splitlines()
    data = yaml.safe_load("\n".join(raw_lines)) or {}

    for repo in data.get("repos", []):
        # Only local hooks have an `entry:` we can audit. Third-party repos
        # (mdformat, codespell, ruff, …) are legitimately not Binder.
        if repo.get("repo") != "local":
            continue
        for hook in repo.get("hooks", []):
            hook_id = hook.get("id", "<unknown>")
            entry = hook.get("entry", "")
            files_pattern = hook.get("files", "")

            if not _targets_book_content(files_pattern):
                continue
            if _dispatches_through_binder(entry):
                continue
            if hook_id in ALLOWLIST:
                continue

            violations.append(
                Violation(
                    file=CONFIG_REL,
                    line=_hook_line(raw_lines, hook_id),
                    code="BINDER-CANON-001",
                    message=(
                        f"Hook '{hook_id}' targets book content but its entry "
                        f"bypasses Binder: {entry!r}"
                    ),
                    context=f"files: {files_pattern}",
                    suggestion=(
                        f"Route '{hook_id}' through Binder: add a scope to the "
                        f"relevant `binder check <group>` and set entry to "
                        f"`./binder/binder check <group>`. If it genuinely cannot "
                        f"be a Binder scope, add '{hook_id}' to ALLOWLIST in "
                        f"binder/cli/checks/binder_canonical.py with a justification."
                    ),
                )
            )

    return violations

```

### Core Architecture Module: `binder/cli/checks/case_study_provenance.py`
```
#!/usr/bin/env python3
"""Every case study must name a source that resolves.

A 2026-09 audit of all 22 case studies in Volume IV against their primary
sources found one that survived as written. Three cited authorities that do not
exist, five described events no primary source records, and ten stated causes
their cited reports contradict.

The manuscript already carried the instruction. The comment

    <!-- INCIDENT: needs a documented, citable case. Do not invent one. -->

appears once per case-study slot, and four boxes were invented directly beneath
it. An instruction in a comment cannot hold. This check is the same requirement
expressed as something the build enforces.

Errors (block the commit)
  missing-bibliography  the volume bibliography is missing or empty
  no-citation           a case study cites nothing
  unresolved-key        it cites a key absent from the volume bibliography
  unverifiable-body     its prose names an archive, registry or docket as its
                        authority without citing anything

Warnings (reported, do not block)
  no-provenance         no Provenance line

Usage:
  ./binder/binder check sources --scope case-studies
  python3 binder/cli/checks/case_study_provenance.py [paths...] [--strict]
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

CALLOUT = "callout-case-study"
REPO = Path(__file__).resolve().parents[3]

# Prose that claims an authority. Harmless with a citation; a fabrication risk
# without one, which is exactly how the three invented archives entered.
AUTHORITY = re.compile(
    r"\b(investigation archive|incident archive|statutory\s+\w+\s+archive|"
    r"investigation archives|incident register|accident register|"
    r"failure analysis report|internal incident log|proprietary incident)",
    re.I,
)

NOT_A_CITEKEY = re.compile(r"^(fig|sec|tbl|eq|lst|thm|def|pri|nbk|exm|cs|ws|chk|psp|lhs)-", re.I)


@dataclass(frozen=True)
class Finding:
    """One provenance problem found in a case-study callout.

    Attributes:
        file: Repository-relative path of the scanned file (or bibliography).
        line: 1-based line of the callout opener, or 0 for file-level findings.
        code: Short finding code, such as ``no-citation``.
        message: Human-readable explanation.
        severity: ``"error"`` or ``"warning"``.
    """

    file: str
    line: int
    code: str
    message: str
    severity: str  # "error" blocks; "warning" is reported only


def volume_bibliographies(repo: Path) -> list[tuple[Path, Path]]:
    """Map each volume carrying case studies to its designated bibliography file.

    Volumes with dedicated, isolated bibliographies (such as 'vol3' and 'vol4')
    are always mapped to their specific ``references-{vol}.bib`` file. This
    guarantees that a missing dedicated bibliography triggers a missing-bibliography
    error rather than silently falling back to the shared bibliography. Other
    volumes map to their dedicated bibliography if it exists, falling back to
    the project-wide ``references.bib``.

    Args:
        repo: Path to the repository root directory.

    Returns:
        List of (volume_directory, bibliography_file) tuples.
    """
    books_dir = repo / "books" if (repo / "books").is_dir() else repo
    dedicated_volumes = {"vol4"}
    pairs = []
    for vol_dir in sorted(books_dir.glob("vol*")):
        if not vol_dir.is_dir():
            continue
        vol_name = vol_dir.name
        if vol_name in dedicated_volumes:
            bib = books_dir / f"references-{vol_name}.bib"
        else:
            cand = books_dir / f"references-{vol_name}.bib"
            bib = cand if cand.exists() else (books_dir / "references.bib")
        pairs.append((vol_dir, bib))
    return pairs or [(books_dir / "vol4", books_dir / "references-vol4.bib")]


def bib_keys(path: Path) -> set[str]:
    """Extract all BibTeX citation keys defined in a bibliography file.

    Args:
        path: Path to the .bib file.

    Returns:
        Set of citation key strings found in the file, or empty set if missing.
    """
    if not path.exists():
        return set()
    return set(re.findall(r"^@\w+\{([^,]+),", path.read_text(errors="replace"), re.M))


def blocks(lines: list[str]):
    """Yield (start_line, body) for each case-study callout.

    Args:
        lines: Lines of the QMD file content.

    Yields:
        Tuple of (start_line_number, callout_body_string).
    """
    for i, line in enumerate(lines):
        if CALLOUT not in line:
            continue
        depth, body = 0, []
        for j in range(i, len(lines)):
            s = lines[j].strip()
            if s.startswith(":::"):
                if re.match(r"^:::+\s*\{", s):
                    depth += 1
                elif re.match(r"^:::+$", s):
                    depth -= 1
                    if depth == 0:
                        body.append(lines[j])
                        break
            body.append(lines[j])
        yield i + 1, "\n".join(body)


def cites(text: str) -> list[str]:
    """Extract citation keys from callout text, excluding non-citation labels.

    Args:
        text: Raw callout text.

    Returns:
        List of citation keys referenced in the text.
    """
    return [
        c for c in re.findall(r"@([A-Za-z][A-Za-z0-9_:+.-]*[A-Za-z0-9])", text)
        if not NOT_A_CITEKEY.match(c)
    ]


def title_of(body: str) -> str:
    """Extract the title attribute from a callout definition line.

    Args:
        body: Callout body text.

    Returns:
        Title string, or '(untitled)' if no title attribute was found.
    """
    m = re.search(r'title="([^"]*)"', body)
    return m.group(1) if m else "(untitled)"


def _rel(path: Path, repo: Path) -> str:
    """Return path relative to repository root for display.

    Args:
        path: Target path.
        repo: Repository root path.

    Returns:
        Relative path string if inside repo, otherwise absolute path string.
    """
    try:
        return str(path.resolve().relative_to(repo))
    except ValueError:
        return str(path)


def collect(paths: list[Path] | None = None, repo: Path = REPO) -> tuple[int, list[Finding]]:
    """Scan case studies; return how many were checked and what was found.

    With ``paths``, only those files inside a case-study volume are scanned;
    otherwise every ``.qmd`` in each volume is.

    Args:
        paths: Optional subset of files to scan.
        repo: Repository root directory.

    Returns:
        Tuple of (checked_callouts_count, list_of_findings).
    """
    findings: list[Finding] = []
    checked = 0

    for root, bib in volume_bibliographies(repo):
        if not root.exists():
            continue
        keys = bib_keys(bib)
        if not keys:
            findings.append(Finding(_rel(bib, repo), 0, "missing-bibliography",
                                    "bibliography missing or empty", "error"))
            continue

        selected = [p for p in (paths or []) if root in p.resolve().parents]
        for f in selected or sorted(root.rglob("*.qmd")):
            if not f.exists():
                continue
            rel = _rel(f, repo)
            for line_no, body in blocks(f.read_text(errors="replace").split("\n")):
                checked += 1
                title = title_of(body)
                used = cites(body)

                if not used:
                    findings.append(Finding(
                        rel, line_no, "no-citation",
                        f"case study {title!r} names no source. Every case study must cite "
                        "a primary source: an investigation report, a regulatory filing, a "
                        "peer-reviewed paper, or a first-party postmortem.",
                        "error",
                    ))
                else:
                    for c in sorted(set(used)):
                        if c not in keys:
                  
```

### Core Architecture Module: `binder/cli/checks/cli_contract.py`
```
"""Public command contract checks for the Binder CLI.

This powers::

    ./binder/binder check cli --scope contract

The check is intentionally small and example-heavy. It runs read-only commands
that define the public Binder surface and fails if help text, migration hints,
or exit codes drift.

Examples of what it catches:

* ``./binder/binder build reset pdf --vol1`` accidentally working again.
  Canonical shape is ``./binder/binder reset pdf --vol1``.
* ``./binder/binder pdf reset --vol1`` accidentally working again.
  Top-level ``html`` / ``pdf`` / ``epub`` are removed; builds live under
  ``build`` and YAML resets live under ``reset``.
* ``./binder/binder reset`` mutating state instead of showing help.
  Bare reset is informational; reset needs an explicit target.
* ``./binder/binder check`` omitting a registered check group or scope from
  the live catalogue, which makes pre-commit failures harder to debug.

Every failure includes the command, expected condition, and a short output
excerpt so the router/docs can be fixed without reverse-engineering the test.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


ANSI_ESCAPE = re.compile(r"\x1b\[[0-?]*[ -/]*[@-~]")


@dataclass(frozen=True)
class ContractCase:
    """One Binder invocation and the exit code and output substrings it must produce."""

    name: str
    argv: tuple[str, ...]
    expected_exit: int
    must_include: tuple[str, ...] = ()
    must_not_include: tuple[str, ...] = ()
    timeout_seconds: int = 20


@dataclass(frozen=True)
class Violation:
    """One broken contract expectation, with an output excerpt as context."""

    file: str
    line: int
    code: str
    message: str
    context: str = ""
    suggestion: str = ""


CASES: tuple[ContractCase, ...] = (
    ContractCase(
        name="top-level help exposes canonical command families",
        argv=("help",),
        expected_exit=0,
        must_include=(
            "MLSysBook CLI",
            "build [fmt]",
            "check <group>",
            "release",
            "reset <fmt|all>",
            "[--vol1|--vol2]",
        ),
    ),
    ContractCase(
        name="build help does not advertise reset",
        argv=("build", "--help"),
        expected_exit=0,
        must_include=(
            "Usage: ./binder/binder build",
            "./binder/binder build pdf intro,training --vol1",
            "--no-cover",
            "--print-marks",
            # 2026-09-12: worktree-isolated parallel builds are part of the surface.
            "--parallel",
            "--each-chapter",
            "--keep-workspaces",
        ),
        must_not_include=("build reset",),
    ),
    ContractCase(
        name="debug help documents worktree debugging",
        argv=("debug", "--help"),
        expected_exit=0,
        must_include=(
            "Usage: ./binder/binder debug",
            "--chapter",
            "--parallel",
            "./binder/binder debug pdf --vol1 --parallel 4",
        ),
    ),
    ContractCase(
        name="parallel build rejects flags it cannot pass through",
        argv=("build", "pdf", "--vol1", "--layout", "--parallel"),
        expected_exit=1,
        must_include=("--layout is not supported with --parallel",),
    ),
    ContractCase(
        name="bare reset is help-only",
        argv=("reset",),
        expected_exit=0,
        must_include=(
            "binder reset <html|pdf|epub|all> [--vol1|--vol2]",
            "./binder/binder reset pdf --vol1",
        ),
    ),
    ContractCase(
        name="reset help documents explicit target shape",
        argv=("reset", "help"),
        expected_exit=0,
        must_include=(
            "reset pdf --vol1",
            "reset epub --vol2",
            "reset all",
        ),
    ),
    ContractCase(
        name="reset rejects unknown target",
        argv=("reset", "nope"),
        expected_exit=1,
        must_include=("invalid choice", "html", "pdf", "epub", "all"),
    ),
    ContractCase(
        name="build reset is a hard migration error",
        argv=("build", "reset", "pdf", "--vol1"),
        expected_exit=1,
        must_include=(
            "`binder build reset` was removed.",
            "./binder/binder reset <html|pdf|epub|all> [--vol1|--vol2]",
        ),
    ),
    ContractCase(
        name="top-level pdf command is removed",
        argv=("pdf", "reset", "--vol1"),
        expected_exit=1,
        must_include=(
            "Top-level 'pdf' commands were removed.",
            "Build with: ./binder/binder build pdf",
            "Reset YAML with: ./binder/binder reset pdf [--vol1|--vol2]",
        ),
    ),
    ContractCase(
        name="check catalogue includes CLI and math checks",
        argv=("check",),
        expected_exit=0,
        must_include=(
            "binder check <group>",
            "cli",
            "contract",
            "math",
            "multiplier-style",
        ),
    ),
    ContractCase(
        name="check cli help lists its scopes",
        argv=("check", "cli", "help"),
        expected_exit=0,
        # Assert on stable tokens only: the group header and the short scope
        # NAMES. Notes wrap and runner names get truncated with "…" once the
        # Rich table widens (e.g. when a group gains a scope), so asserting a
        # multi-word note or a full _run_* name is brittle. Scope names are
        # short and never wrap, so they are the durable contract.
        must_include=(
            "binder check cli",
            "contract",
            "binder-canonical",
        ),
    ),
    ContractCase(
        name="check math help shows multiplier prose scope",
        argv=("check", "math", "help"),
        expected_exit=0,
        must_include=(
            "binder check math",
            "prose-contract",
            "multiplier-style",
            "body-prose",
            "multiplier suffixes",
        ),
    ),
    ContractCase(
        name="format help remains routed through command namespace",
        argv=("format", "help"),
        expected_exit=0,
        must_include=("binder format", "python", "prettify"),
    ),
    ContractCase(
        name="bib help remains routed through command namespace",
        argv=("bib", "help"),
        expected_exit=0,
        must_include=("binder bib", "mechanical", "normalize", "sync"),
    ),
    ContractCase(
        name="bib mechanical accepts pre-commit option before filenames",
        argv=("bib", "mechanical", "--dry-run", "--pre-commit", "CITATION.bib"),
        expected_exit=0,
        must_include=("CITATION.bib", "Done:"),
    ),
    ContractCase(
        name="clean help documents artifact cleanup",
        argv=("clean", "help"),
        expected_exit=0,
        must_include=("binder clean", "artifacts"),
    ),
    ContractCase(
        name="release help documents the release gate",
        argv=("release", "--help"),
        expected_exit=0,
        must_include=(
            "binder release",
            "--dry-run",
            "--json",
            "--include-network",
            "--skip-build",
        ),
    ),
    ContractCase(
        name="release dry-run emits structured stage plan",
        argv=("release", "--dry-run", "--json"),
        expected_exit=0,
        must_include=(
            '"schema_version": "binder-release/v1"',
            '"status": "planned"',
            '"stages"',
            '"labels-vol1"',
            '"build-vol1-pdf"',
            '"pdf-vol2-verify"',
            '"final-check-all"',
        ),
    ),
)


def _repo_root() -> Path:
    """Return the repository root, three directories above this module's package."""
    return Path(__file__).resolve().parents[3]


def _clean_output(text: str) -> str:
    """Strip ANSI escape sequences and normalize line endings to ``\\n``."""
    return ANSI_ESCAPE.sub("", text).replac
```

### Core Architecture Module: `binder/cli/checks/code_exec.py`
```
"""
Execute Python blocks in QMD files to verify zero runtime errors.

This ensures every code cell in Quarto markdown runs cleanly under the
mlsysim environment without syntax errors, runtime exceptions, Pint unit
dimension mismatch, or failed check() invariant guards.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import List


@dataclass
class CodeExecIssue:
    file: Path
    line: int
    block_index: int
    message: str
    context: str = ""


def check_code_exec(path: Path, text: str | None = None) -> List[CodeExecIssue]:
    """Execute all python blocks in a QMD file sequentially."""
    if text is None:
        try:
            text = path.read_text(encoding="utf-8")
        except Exception as exc:
            return [CodeExecIssue(file=path, line=1, block_index=0, message=f"Failed to read file: {exc}")]

    if "```{python}" not in text:
        return []

    lines = text.splitlines(keepends=True)
    in_cell = False
    cell_start_line = 0
    cell_lines: list[str] = []
    cells: list[tuple[int, str]] = []

    for lineno, line in enumerate(lines, 1):
        if line.startswith("```{python}"):
            in_cell = True
            cell_start_line = lineno
            cell_lines = []
        elif in_cell and line.startswith("```"):
            in_cell = False
            cells.append((cell_start_line, "".join(cell_lines)))
            cell_lines = []
        elif in_cell:
            cell_lines.append(line)

    if not cells:
        return []

    issues: List[CodeExecIssue] = []
    scope: dict = {}
    repo_root = Path(__file__).resolve().parents[3]
    books_dir = repo_root / "books"
    mlsysim_dir = repo_root / "mlsysim"

    import sys
    for p in (str(mlsysim_dir), str(repo_root)):
        if p not in sys.path:
            sys.path.insert(0, p)

    import contextlib
    import io
    import warnings

    old_cwd = os.getcwd()
    os.environ.setdefault("MPLBACKEND", "Agg")

    try:
        os.chdir(books_dir)
        for idx, (lineno, block) in enumerate(cells):
            clean_lines = [line for line in block.splitlines() if not line.strip().startswith("#|")]
            code = "\n".join(clean_lines)
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                        exec(code, scope)
            except (Exception, SystemExit) as exc:
                first_code_line = next((l.strip() for l in clean_lines if l.strip()), "")
                issues.append(
                    CodeExecIssue(
                        file=path,
                        line=lineno,
                        block_index=idx,
                        message=f"Block {idx} failed: {type(exc).__name__}: {exc}",
                        context=first_code_line,
                    )
                )
                break  # Subsequent blocks in the file depend on earlier scope
    finally:
        os.chdir(old_cwd)

    return issues

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2138** (2026-09-20): **build(deps): bump soupsieve from 2.8.4 to 2.9**
  *Symptoms*: Bumps [soupsieve](https://github.com/facelessuser/soupsieve) from 2.8.4 to 2.9. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/facelessuser/soupsieve/releases">soupsieve's releases</a>.</em></p> <blockquote> <h2>2.9</h2> <ul> <li><strong>NEW</strong>: Drop Python 3.9 support.</li> <li><strong>NEW</strong>: Lazy compile selector patterns to improve initial import speed.</li> <li><strong>FIX</strong>: Correct <code>:nth-child</code>/<code>:nth-of-type</code> (and <code>-last-</code> variants) for <code>An+B</code> values whose sequence steps onto index 0 or onto the last child (e.g. <code>:nth-child(2n-2)</code>, <code>:nth-child(n-1)</code>, <code>:nth-child(n+5)</code>), which previously matched the wrong elements or nothing at all (<a href="https://github.com/gaoflow"><code>@​gaoflow</code></a>).</li> <li><strong>FIX</strong>: More efficient CSS ID matching (<a href="https://github.com/kaimandalic"><code>@​kaimandalic</code></a>).</li> <li><strong>FIX</strong>: Fix inefficient trimming of comments and white space (<a href="https://github.com/kaimandalic"><code>@​kaimandalic</code></a>).</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/facelessuser/soupsieve/commit/8763f914472fc83652babda708bed5c8ef287004"><code>8763f91</code></a> Format changelog message</li> <li><a href="https://github.com/facelessuser/soupsieve/commit/cf198fcddc9230f06ed39f974eba0ce076b85cda"><code>cf19

- **Issue #2133** (2026-09-14): **build(deps): bump brace-expansion in /staffml/app**
  *Symptoms*: Bumps  and [brace-expansion](https://github.com/juliangruber/brace-expansion). These dependencies needed to be updated together. Updates `brace-expansion` from 1.1.15 to 1.1.18 <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/juliangruber/brace-expansion/commit/758fcd6d188a95c2342818519c77b8c06794552b"><code>758fcd6</code></a> 1.1.18</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/27fbeed22b4fdf2c5f732f66bcf84d43f4a26c6e"><code>27fbeed</code></a> Merge commit from fork</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/5c57cc2519dfb067e188b7cb0733fffbd02946bf"><code>5c57cc2</code></a> 1.1.17</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/d757f1dde7808bcbcd7a4628ab913e5185ed3d57"><code>d757f1d</code></a> npm ignore <code>.claude</code></li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/cb4b9e47cc2ec777c14b2b4492fb431a56f6a031"><code>cb4b9e4</code></a> fix: backport GHSA-mh99-v99m-4gvg (<a href="https://redirect.github.com/juliangruber/brace-expansion/issues/129">#129</a>)</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/447763a91a613cfa67ac73096cbc1de9a2304f97"><code>447763a</code></a> 1.1.16</li> <li><a href="https://github.com/juliangruber/brace-expansion/commit/d74e63030c012e3b7ae81657b8d665619cd51b95"><code>d74e630</code></a> fix: v1 backport for CVE-2026-13149 (<a href="https://redirect.github.com/juliangruber/brace-expansion/issu
  **Post-Mortem & Fix Analysis**:
  > 🎉 **Thanks for contributing to StaffML!**  We appreciate you sharing your knowledge. A maintainer will review the math and logic shortly.  *P.S. If you haven't already, please drop a ⭐ on the repository!*

- **Issue #2127** (2026-09-14): **build(deps-dev): bump js-yaml from 4.3.1 to 4.3.2 in /staffml/app**
  *Symptoms*: Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.3.1 to 4.3.2. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/nodeca/js-yaml/blob/4.3.2/CHANGELOG.md">js-yaml's changelog</a>.</em></p> <blockquote> <h2>4.3.2 - 2026-08-26</h2> <h3>Changed</h3> <ul> <li>[backport] Hard-limit merge sequence size to 100.</li> </ul> <h3>Security</h3> <ul> <li>[backport] Count empty mappings in merge sequences toward <code>maxTotalMergeKeys</code> to limit CPU usage, <a href="https://redirect.github.com/nodeca/js-yaml/issues/797">#797</a>.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/nodeca/js-yaml/commit/79ca68d90f333fbe6d9e42827527e62636200191"><code>79ca68d</code></a> 4.3.2 released</li> <li><a href="https://github.com/nodeca/js-yaml/commit/d90b6612a5a84385bdcb556c44578eac76dc0f6b"><code>d90b661</code></a> Backport merge limits from v5.4.1</li> <li>See full diff in <a href="https://github.com/nodeca/js-yaml/compare/4.3.1...4.3.2">compare view</a></li> </ul> </details> <br /> 
  **Post-Mortem & Fix Analysis**:
  > 🎉 **Thanks for contributing to StaffML!**  We appreciate you sharing your knowledge. A maintainer will review the math and logic shortly.  *P.S. If you haven't already, please drop a ⭐ on the repository!*
  > @dependabot rebase

- **Issue #2115** (2026-09-12): **chore(deps-dev): bump js-yaml from 4.3.1 to 4.3.2 in /interviews/staffml**
  *Symptoms*: Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.3.1 to 4.3.2. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/nodeca/js-yaml/blob/4.3.2/CHANGELOG.md">js-yaml's changelog</a>.</em></p> <blockquote> <h2>4.3.2 - 2026-08-26</h2> <h3>Changed</h3> <ul> <li>[backport] Hard-limit merge sequence size to 100.</li> </ul> <h3>Security</h3> <ul> <li>[backport] Count empty mappings in merge sequences toward <code>maxTotalMergeKeys</code> to limit CPU usage, <a href="https://redirect.github.com/nodeca/js-yaml/issues/797">#797</a>.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/nodeca/js-yaml/commit/79ca68d90f333fbe6d9e42827527e62636200191"><code>79ca68d</code></a> 4.3.2 released</li> <li><a href="https://github.com/nodeca/js-yaml/commit/d90b6612a5a84385bdcb556c44578eac76dc0f6b"><code>d90b661</code></a> Backport merge limits from v5.4.1</li> <li>See full diff in <a href="https://github.com/nodeca/js-yaml/compare/4.3.1...4.3.2">compare view</a></li> </ul> </details> <br />   [![Dependabot compatibility score](https://dependabot-badges.githubapp.com/badges/compatibility_score?dependency-name=js-yaml&package-manager=npm_and_yarn&previous-version=4.3.1&new-version=4.3.2)](https://docs.github.com/en/github/managing-security-vulnerabilities/about-dependabot-security-updates#about-compatibility-scores)  Dependabot will resolve any conflicts with this PR as long as you don't alter it yours
  **Post-Mortem & Fix Analysis**:
  > 🎉 **Thanks for contributing to StaffML!**  We appreciate you sharing your knowledge. A maintainer will review the math and logic shortly.  *P.S. If you haven't already, please drop a ⭐ on the repository!*
  > Looks like js-yaml is no longer a dependency, so this is no longer needed.

- **Issue #2112** (2026-09-14): **chore(deps): bump js-yaml from 4.2.0 to 4.3.2**
  *Symptoms*: Bumps [js-yaml](https://github.com/nodeca/js-yaml) from 4.2.0 to 4.3.2. <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/nodeca/js-yaml/blob/4.3.2/CHANGELOG.md">js-yaml's changelog</a>.</em></p> <blockquote> <h2>4.3.2 - 2026-08-26</h2> <h3>Changed</h3> <ul> <li>[backport] Hard-limit merge sequence size to 100.</li> </ul> <h3>Security</h3> <ul> <li>[backport] Count empty mappings in merge sequences toward <code>maxTotalMergeKeys</code> to limit CPU usage, <a href="https://redirect.github.com/nodeca/js-yaml/issues/797">#797</a>.</li> </ul> <h2>4.3.1 - 2026-07-31</h2> <h3>Security</h3> <ul> <li>[backport] Remove quadratic complexity from <code>!!omap</code> duplicate key detection.</li> </ul> <h2>4.3.0 - 2026-06-27</h2> <h3>Added</h3> <ul> <li>[backport] Added <code>maxTotalMergeKeys</code> (10000) loader option to limit the total number of keys processed by YAML merge (<code>&lt;&lt;</code>) across one <code>load()</code> / <code>loadAll()</code> call.</li> </ul> <h3>Fixed</h3> <ul> <li>Restore umd builds back to es5.</li> </ul> <h3>Removed</h3> <ul> <li>[backport] <code>maxMergeSeqLength</code> replaced with <code>maxTotalMergeKeys</code> for limiting YAML merge processing.</li> </ul> </blockquote> </details> <details> <summary>Commits</summary> <ul> <li><a href="https://github.com/nodeca/js-yaml/commit/79ca68d90f333fbe6d9e42827527e62636200191"><code>79ca68d</code></a> 4.3.2 released</li> <li><a href="https://github.com/nodeca/js-yaml/comm

- **Issue #2108** (2026-09-12): **chore(deps): bump baseline-browser-mapping from 2.10.29 to 2.11.21 in /interviews/staffml**
  *Symptoms*: Bumps [baseline-browser-mapping](https://github.com/web-platform-dx/baseline-browser-mapping) from 2.10.29 to 2.11.21. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/web-platform-dx/baseline-browser-mapping/releases">baseline-browser-mapping's releases</a>.</em></p> <blockquote> <h2>v2.11.0</h2> <h2>What's Changed in 2.11.0</h2> <ul> <li>feat: Adds a new <code>getTimeline()</code> method for getting the series of minimum browser changes, either grouped by date or by browser.</li> <li>refactor: Substantial refactoring of the data compression process that replaces the full list of browsers from <code>@mdn/browser-compat-data</code> and <code>downstream-browsers.json</code> and features from <code>web-features</code> (in their very pared down form) with a change-list timeline that reflects which versions supported Baseline (newly available) on a given date.  Thanks to <a href="https://github.com/swwind"><code>@​swwind</code></a> for the idea!</li> <li>refactor: Some common functions have been moved to a <code>util.ts</code> module for use in other scripts.</li> <li>fix: Removes <code>process.exit()</code> calls when unsupported option combinations are passed to getCompatibleVersions() and <code>getAllVersions()</code> in favour of throwing an <code>Error</code>.  There is a small security risk with <code>process.exit()</code> calls that sites accepting unsanitised inputs could be the subject of attacks.  Unsupported config options now 
  **Post-Mortem & Fix Analysis**:
  > 🎉 **Thanks for contributing to StaffML!**  We appreciate you sharing your knowledge. A maintainer will review the math and logic shortly.  *P.S. If you haven't already, please drop a ⭐ on the repository!*
  > Looks like baseline-browser-mapping is no longer a dependency, so this is no longer needed.

- **Issue #2105** (2026-09-12): **chore(deps-dev): bump browserslist from 4.28.2 to 4.28.8 in /interviews/staffml**
  *Symptoms*: Bumps [browserslist](https://github.com/browserslist/browserslist) from 4.28.2 to 4.28.8. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/browserslist/browserslist/releases">browserslist's releases</a>.</em></p> <blockquote> <h2>4.28.8</h2> <ul> <li>Fixed <code>including kaios</code> in baseline queries (by <a href="https://github.com/Jaybhade"><code>@​Jaybhade</code></a>).</li> </ul> <h2>4.28.7</h2> <ul> <li>Improved parsing performance.</li> <li>Fixed unbounded memory growth (by <a href="https://github.com/alanturing881"><code>@​alanturing881</code></a>).</li> <li>Fixed prototype write issue (by <a href="https://github.com/alanturing881"><code>@​alanturing881</code></a>).</li> </ul> <h2>4.28.6</h2> <ul> <li>Fixed Electron version queries (by <a href="https://github.com/spokodev"><code>@​spokodev</code></a>).</li> </ul> <h2>4.28.5</h2> <ul> <li>Fixed <code>&gt;</code> and <code>&gt;=</code> queries (by <a href="https://github.com/spokodev"><code>@​spokodev</code></a>).</li> </ul> <h2>4.28.4</h2> <ul> <li>Fixed <code>SyntaxError</code> regression of 4.28.3.</li> </ul> <h2>4.28.3</h2> <ul> <li>Fixed baseline query case-insensitivity (by <a href="https://github.com/swwind"><code>@​swwind</code></a>).</li> </ul> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/browserslist/browserslist/blob/main/CHANGELOG.md">browserslist's changelog</a>.</em></p> <blockquote> <h2>4.28.8</h2
  **Post-Mortem & Fix Analysis**:
  > 🎉 **Thanks for contributing to StaffML!**  We appreciate you sharing your knowledge. A maintainer will review the math and logic shortly.  *P.S. If you haven't already, please drop a ⭐ on the repository!*
  > Looks like browserslist is no longer a dependency, so this is no longer needed.

- **Issue #2091** (2026-08-31): **Fix dead-code and numerical-instability bugs across autograd's tracked forward implementations**
  *Symptoms*: ## What  Combines 5 previously-separate PRs (#2048, #2051, #2081, #2040, #2060), all of which touch `tinytorch/src/06_autograd/06_autograd.py`'s `enable_autograd()` monkeypatch. Combining them avoids five separate PRs churning the same function.  ## The shared bug class  `enable_autograd()` replaces several `Tensor`/`Sigmoid`/loss-class methods with "tracked" versions that add gradient bookkeeping. Some of these tracked versions **reimplemented** the original operation's math from scratch instead of delegating to the module's own already-correct implementation. This meant:  - The original implementation (what a student actually reads and is graded on) became **dead code** the moment autograd loads, which is always, since `enable_autograd()` runs unconditionally on package import. - Any fix or improvement made to the original silently never shipped, since the live code path was the separate reimplementation. - One of these reimplementations (`tracked_sigmoid_forward`) had actually drifted: it used the naive `1/(1+exp(-x))` formula instead of the original's numerically-stable, sign-branching version, causing spurious overflow warnings (and eventually NaN) at large-magnitude inputs common right after gradients explode during training.  ## Changes (one per original commit)  1. **#2048** — `tracked_sigmoid_forward` used an unstable formula; fixed to delegate to the original numerically-stable `Sigmoid.forward`. 2. **#2051** (2 commits) — `__radd__`/`__rsub__`/`__rmul__`/`__rtruedi
  **Post-Mortem & Fix Analysis**:
  > Thanks @Shashank-Tripathi-07. Integrated into dev, and this one paid for itself.  It fixed a test that was already red on dev before your PR: test_deep_network_gradient_chain in tests/integration/test_training_flow.py. The tracked_* wrappers shadowing the modules' real forward passes is exactly what that test was catching, so delegating to the captured originals closed it. That suite went from 774 passed / 1 failed to 790 passed / 0 failed.  I also added the target-index validation to the CrossEntropyLoss APPROACH and HINTS, same reason as #2036. 

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

### Incident Patch 1: `201f2532` (2026-09-30)
**Commit Message**: fix(tito): record the exported notebook path in POSIX form on every OS

Windows CI recorded modules\02_activations\activations.ipynb in
.tito/exports.json, so the record differed by platform.

**File**: `tinytorch/tito/commands/module/workflow.py` (modified, +3/-1)
```diff
@@ -127,7 +127,9 @@ def record_module_export(project_root: Path, module_name: str) -> None:
     records = load_export_records(project_root)
     records[number] = {
         "module": module_name,
-        "notebook": str(notebook.relative_to(project_root)),
+        # POSIX form, so the record reads the same on every OS (Windows CI
+        # caught backslashes, 2026-09-30).
+        "notebook": notebook.relative_to(project_root).as_posix(),
         "sha256": fingerprint,
         "exported_at": datetime.now().isoformat(),
     }
```

---

### Incident Patch 2: `d14f14ea` (2026-09-23)
**Commit Message**: docs(book): sync evaluate.qmd listing with axis=-1 Trainer.evaluate fix

**File**: `tinytorch/book/_listings/08_training/evaluate.qmd` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ def trainer_evaluate(self, dataloader: Iterable[Tuple[Tensor, Tensor]]) -> Tuple
 
         # The loss defines the task: multiple outputs can also be regression.
         if isinstance(self.loss_fn, CrossEntropyLoss):
-            predictions = np.argmax(outputs.data, axis=1)
+            predictions = np.argmax(outputs.data, axis=-1)
             correct += np.sum(predictions == targets.data)
             total += predictions.size
         elif isinstance(self.loss_fn, BinaryCrossEntropyLoss):
```

---

### Incident Patch 3: `57ee704a` (2026-09-23)
**Commit Message**: fix(tinytorch): handle sequence reduction, scalar compile tracing, and CLI imports

- Trainer.evaluate: reduce along axis=-1 for proper sequence/vocab class prediction
- TracedNode: add scalar handling for __add__, __radd__, __mul__, and __rmul__
- benchmark CLI: hoist BaseCommand and TinyTorchCLIError imports before lazy _get_rng
- Add comprehensive unit tests covering 3D evaluate, scalar tracing, RNG import errors, and LogSoftmax

**File**: `tinytorch/src/08_training/08_training.py` (modified, +2/-2)
```diff
@@ -1110,7 +1110,7 @@ def trainer_evaluate(self, dataloader: Iterable[Tuple[Tensor, Tensor]]) -> Tuple
     >>> print(f"Eval loss: {eval_loss:.4f}, Accuracy: {accuracy:.2%}")
 
     HINTS:
-    - For multi-class: predictions = np.argmax(outputs.data, axis=1)
+    - For multi-class: predictions = np.argmax(outputs.data, axis=-1)
     - CrossEntropyLoss expects integer targets; BCE compares each binary label
     - accuracy = correct / total if total > 0 else 0.0
     """
@@ -1135,7 +1135,7 @@ def trainer_evaluate(self, dataloader: Iterable[Tuple[Tensor, Tensor]]) -> Tuple
 
         # The loss defines the task: multiple outputs can also be regression.
         if isinstance(self.loss_fn, CrossEntropyLoss):
-            predictions = np.argmax(outputs.data, axis=1)
+            predictions = np.argmax(outputs.data, axis=-1)
             correct += np.sum(predictions == targets.data)
             total += predictions.size
         elif isinstance(self.loss_fn, BinaryCrossEntropyLoss):
```

**File**: `tinytorch/tests/04_losses/test_losses_core.py` (modified, +33/-1)
```diff
@@ -22,7 +22,7 @@
 sys.path.insert(0, str(Path(__file__).parent.parent.parent))
 
 from tinytorch.core.tensor import Tensor
-from tinytorch.core.losses import MSELoss, CrossEntropyLoss, BinaryCrossEntropyLoss
+from tinytorch.core.losses import MSELoss, CrossEntropyLoss, BinaryCrossEntropyLoss, LogSoftmax, log_softmax
 
 
 class TestMSELoss:
@@ -190,3 +190,35 @@ def test_loss_means_count_every_output_and_accept_soft_binary_targets():
     assert np.isclose(MSELoss()(pred, target).data, (0.04 + 0.01 + 0.09 + 0.01) / 4)
     expected = -(np.log(0.8) + 0.5 * np.log(0.6 * 0.4) + np.log(0.7) + np.log(0.9)) / 4
     assert np.isclose(BinaryCrossEntropyLoss()(pred, target).data, expected)
+
+
+class TestLogSoftmax:
+    """Test numerically stable log-softmax computation."""
+
+    def test_log_softmax_numerical_stability_large_values(self):
+        """
+        WHAT: Verify log-softmax does not overflow with large inputs (log-sum-exp trick).
+        WHY: Exponentiating numbers > 709 overflows float64. Log-sum-exp prevents this.
+        """
+        x = Tensor([[1000.0, 1001.0, 1002.0]])
+        out = log_softmax(x, dim=-1)
+
+        assert not np.isnan(out.data).any(), "log_softmax produced NaN on large inputs"
+        assert not np.isinf(out.data).any(), "log_softmax produced Inf on large inputs"
+
+        # Exponentiating log_softmax must give a valid probability distribution summing to 1.0
+        probs = np.exp(out.data)
+        assert np.isclose(probs.sum(axis=-1)[0], 1.0, atol=1e-5)
+
+    def test_log_softmax_properties(self):
+        """Verify basic log_softmax mathematical properties across 2D batch."""
+        x = Tensor([[1.0, 2.0, 3.0], [0.1, 0.2, 0.9]])
+        out = log_softmax(x, dim=-1)
+
+        # log(P) <= 0 since P <= 1
+        assert (out.data <= 0.0).all()
+
+        # exp(log(P)) sum across classes == 1
+        probs = np.exp(out.data)
+        assert np.allclose(probs.sum(axis=-1), [1.0, 1.0], atol=1e-5)
+
```

**File**: `tinytorch/tests/08_training/test_training_coverage.py` (modified, +38/-0)
```diff
@@ -678,6 +678,44 @@ def parameters(self):
         _, accuracy = trainer.evaluate(data)
         assert accuracy == 0.0, f"Wrong classifier should have accuracy=0.0, got {accuracy}"
 
+    def test_evaluate_3d_sequence_predictions(self):
+        """
+        WHAT: Trainer.evaluate computes correct accuracy for 3D sequence predictions (Batch, Seq, Vocab).
+
+        WHY: For autoregressive models (like GPT) and token classification, logits have shape
+        (Batch, Seq_Len, Vocab_Size). Argmax must reduce the last dimension (axis=-1) to find
+        the predicted class token. Using axis=1 incorrectly reduces across sequence length,
+        causing a broadcast shape mismatch error.
+        """
+        class SequenceModel:
+            training = True
+
+            def forward(self, x):
+                # x shape: (2, 3)
+                # Output logits shape: (2, 3, 4)
+                logits = np.zeros((2, 3, 4))
+                targets = np.array([[1, 2, 0], [3, 1, 2]])
+                for b in range(2):
+                    for s in range(3):
+                        logits[b, s, targets[b, s]] = 10.0
+                return Tensor(logits)
+
+            def parameters(self):
+                return []
+
+        loss_fn = CrossEntropyLoss()
+        opt = SGD([], lr=0.01)
+        trainer = Trainer(SequenceModel(), opt, loss_fn)
+
+        targets = np.array([[1, 2, 0], [3, 1, 2]])
+        inputs = np.zeros((2, 3))
+        data = [(Tensor(inputs), Tensor(targets))]
+
+        eval_loss, accuracy = trainer.evaluate(data)
+
+        assert accuracy == 1.0, f"Expected accuracy 1.0 for perfect sequence predictions, got {accuracy}"
+        assert eval_loss < 0.01, f"Expected small loss for confident predictions, got {eval_loss}"
+
 
 # ─────────────────────────────────────────────
 # Scheduler integration
```

**File**: `tinytorch/tests/cli/test_cli_execution.py` (modified, +31/-0)
```diff
@@ -198,5 +198,36 @@ def test_missing_subcommand_shows_help(self):
         assert len(combined_output) > 0, "No output from command without subcommand"
 
 
+class TestBenchmarkRngErrorHandling:
+    """Test lazy dependency handling in benchmark commands."""
+
+    def test_get_rng_success(self):
+        """Test _get_rng succeeds when numpy is present."""
+        from tito.commands.benchmark import _get_rng
+        np_mod, rng = _get_rng()
+        assert np_mod is not None
+        assert rng is not None
+
+    def test_get_rng_missing_numpy_raises_tinytorch_cli_error(self, monkeypatch):
+        """Test _get_rng raises TinyTorchCLIError (and not NameError) when numpy is missing."""
+        import builtins
+        from tito.commands.benchmark import _get_rng
+        from tito.core.exceptions import TinyTorchCLIError
+
+        orig_import = builtins.__import__
+
+        def failing_import(name, *args, **kwargs):
+            if name == "numpy":
+                raise ImportError("No module named 'numpy'")
+            return orig_import(name, *args, **kwargs)
+
+        monkeypatch.setattr(builtins, "__import__", failing_import)
+
+        with pytest.raises(TinyTorchCLIError) as exc_info:
+            _get_rng()
+
+        assert "NumPy is required to run benchmarks" in str(exc_info.value)
+
+
 if __name__ == '__main__':
     pytest.main([__file__, '-v'])
```

**File**: `tinytorch/tests/extensions/test_compile.py` (modified, +17/-2)
```diff
@@ -3,8 +3,23 @@
 def test_graph_compilation_trace():
     def simple_net(x, w, b):
         return (x * w) + b
-        
+
     code = compile_graph(simple_net, "x", "w", "b")
-    
+
     assert "def fused_kernel(x, w, b):" in code
     assert "(x * w) + b" in code or "((x * w) + b)" in code
+
+
+def test_graph_compilation_with_scalars():
+    """Verify tracing handles scalar literals without crashing on missing .name attribute."""
+    def scaled_offset_net(x):
+        # Forward and reverse scalar operations
+        return (2.0 * x + 1.0) * 3
+
+    code = compile_graph(scaled_offset_net, "x")
+
+    assert "def fused_kernel(x):" in code
+    assert "2.0" in code
+    assert "1.0" in code
+    assert "3" in code
+
```

---

### Incident Patch 4: `e9e26e71` (2026-09-23)
**Commit Message**: Enhance Vol 4 core concepts: state estimation, MPC, AOT compilation, SOTIF, security, and regulations

**File**: `books/vol4/09_memory/09_memory.qmd` (modified, +2/-0)
```diff
@@ -79,6 +79,8 @@ Specifying the quantity and units remains incomplete without binding the value t
 
 Geometry and identity describe the physical state at a single moment, but memory must also capture the temporal anchor of that state. The record carries the evidence epoch $t_0$ of the physical interaction or optical exposure that last constrained the estimate. In distributed architectures, intermediate nodes often republish data, execute Kalman filter prediction steps, or run forward kinematic propagations to maintain high-rate control streams, and none of these adds physical evidence. The field must therefore pass unchanged through every republish, filter, and prediction stage, so that consumers measure the age of the information against the physical world rather than against the scheduling frequency of the local computer.
 
+Generating this anchored belief relies on **multi-sensor state estimation**\index{State estimation!contract boundary}\index{Sensor fusion!informational contract}—whether implemented through recursive Extended Kalman Filters (EKF), Unscented Kalman Filters (UKF) [@kalman1960new], or nonlinear factor-graph optimization (Smoothing and Mapping, SAM)—an established mathematical discipline whose operational role is to map asynchronous, heterogeneous sensor observations (such as high-rate IMU accelerations, wheel encoder ticks, and low-rate vision claims) into a minimal sufficient statistic of the plant's latent physical state. The physical AI architecture abstracts the internal numerical mechanics of this fusion pipeline behind the spatial belief contract. Downstream trajectory planning and safety enforcement do not recompute sensor innovation covariances or re-solve factor graphs; they require only that the state estimator provide an unbiased state vector $\hat{\mathbf{x}}$, a physically honest uncertainty bound $\mathbf{\Sigma}$, and the true evidence epoch $t_0$ of the measurements that constrained it. The foundational systems requirement is not the choice of filtering algorithm, but the obligation that the estimator model process noise expansion honestly across blind intervals (@sec-appendix-control-covariance derives continuous error covariance propagation) and revoke its validity status whenever physical observability rank collapses (@sec-memory-state-estimation-bounds).
+
 Knowing the evidence epoch $t_0$ establishes elapsed time $\Delta t = t - t_0$, but elapsed time alone cannot determine whether a belief is valid for a given action. Two estimates of identical age diverge at different rates depending on physical constraints. The rack end itself is bolted to the floor, so its remembered position stays within the machine's localization error however long the camera is blind, whereas a person hidden behind it can move at walking speed and spend the same clearance in a few tens of milliseconds.
 
 The minimum record fields necessary for a consumer to evaluate a stored state can be derived directly from the requirement to bound current error. Let $E(\Delta t)$ represent the upper bound of the discrepancy between the stored value and true physical state after an elapsed time $\Delta t = t - t_0$. If an estimator establishes a state at time $t_0$ with an initial uncertainty bound\index{Uncertainty bound} $E_0$, and external disturbances or unmodeled velocities cause the true state to diverge at a maximum rate $r$, the upper bound on error at current time $t$ obeys the linear expansion\index{Error expansion} $E(\Delta t) = E_0 + r\,\Delta t$. At the rack end, $E_0$ is the machine's localization error and $r$ is the walking speed of the person the rack may hide; @sec-memory-belief-through-occlusion evaluates that law. Omitting either term leaves the consumer unable to compute $E(\Delta t)$, so an initial bound and an expansion rate are both structurally required fields of the record.
```

**File**: `books/vol4/11_planning/11_planning.qmd` (modified, +2/-0)
```diff
@@ -234,6 +234,8 @@ Classical sampling-based planners answer the geometric half of this problem. A p
 
 Learned proposers bridge slow inference and fast actuator control by receding-horizon action chunking (@sec-brain-cognitive-pipeline), predicting a multi-step sequence, executing a prefix, and replanning on fresh observations. Three kinds of proposer fill this role, and each matters here through the latency and continuity of what it emits. ACT [@zhao2023learning] predicts $N$ future joint setpoints at once and blends overlapping chunks by the temporal ensembling of @sec-brain-cognitive-pipeline, which averages setpoints but leaves derivative continuity at the chunk seam to this chapter. Diffusion Policy [@chi2024diffusionpolicy] denoises a chunk of horizon $T_p$ (16 steps in the real Push-T setup), executes a subset $T_a$ (six there), and replans on the next observation; its iterative denoising adds workload-dependent latency and variance. A learned warm-start for a constrained trajectory optimizer can cut solver iterations when it lands near a feasible basin, but it can also choose the wrong side of an obstacle or miss the deadline. None of these outputs is a feasibility certificate, and only a candidate whose full path, seam, torque, and stop checks pass is admitted.
 
+This receding-horizon structure mirrors classical **Model Predictive Control (MPC)**\index{Model Predictive Control!receding horizon}\index{Trajectory optimization!collocation and MPC} and trajectory optimization, where an optimizer plans a trajectory over a finite horizon $T$, executes an initial prefix, and resolves the problem from the updated state on the next cycle. Classical MPC formulates trajectory synthesis as an explicit constrained numerical optimization problem, minimizing a cost function subject to analytical system dynamics ($\dot{\mathbf{x}} = f(\mathbf{x}, \mathbf{u})$) and hard inequality constraints on physical boundaries ($\mathbf{x} \in \mathcal{X}_{\text{safe}}$) and actuator torques ($\mathbf{u} \in \mathcal{U}_{\text{adm}}$). Where analytical models accurately capture the physical plant and state dimensions remain compact, MPC provides rigorous guarantees of constraint satisfaction and closed-loop stability. Yet classical trajectory optimization hits the "Classical Wall" of @sec-brain-classical-wall when applied to unstructured open-world manipulation: numerical solvers cannot ingest high-dimensional semantic tokens (such as raw camera pixels or natural-language instructions) directly, and non-smooth contact mechanics or deformable objects introduce combinatorial local minima that render online numerical optimization intractable within real-time control periods. Generative action chunking resolves the semantic ingestion problem by learning continuous multimodal trajectory distributions directly from visual demonstrations, but sacrifices analytical guarantees. The physical AI architecture therefore treats learned chunking policies as unprivileged semantic proposers across multi-second task horizons, relying on the kinodynamic feasibility checks and seam contracts developed in this chapter to guarantee physical admissibility before actuation. Executing these feasibility checks and seamlessly replacing the active trajectory introduces computational and transport delays that must be strictly bounded across replacement cycles.
+
 ```{python}
 #| label: calc-planning-replacement-ledger
 #| echo: false
```

**File**: `books/vol4/12_enforcement/12_enforcement.qmd` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ A tracking bound never checked at runtime is an assumption, not a contract. The
 Every spatial and dynamic safety boundary evaluated by an enforcer must be inset by the underlying tracking loop's verified worst-case tracking error, and the stopping envelope of @eq-enforce-stopping-envelope carries that inset, together with the travel during transport lag\index{Transport lag}, into every admission check. An enforcer that evaluates barrier certificates\index{Barrier certificates} against nominal geometric boundaries without insetting will permit trajectories that physically collide with obstacles whenever tracking error reaches its certified bound.
 :::
 
-The synthesis of tracking controllers, observers, and disturbance rejection belongs to the control literature [@slotine1991applied; @astrom2021feedback]. The tracker has no semantic awareness of obstacles, task goals, or hazards, and it will drive the base into a rack upright with the same fidelity it brings to free space, so before any proposal reaches it, the system must decide whether that proposal may become force at all.
+The synthesis of tracking controllers, observers, and disturbance rejection belongs to the control literature [@slotine1991applied; @astrom2021feedback]. In modern physical AI implementations, the "tracker" is rarely an elementary single-input single-output feedback loop; it is typically structured as a **cascaded control hierarchy**\index{Cascaded control!tracking architecture} (translating Cartesian path targets into joint velocity references, and velocity into field-oriented phase currents at $10\text{--}25\text{ kHz}$) or as a high-rate **tracking Model Predictive Controller (MPC)**\index{Model Predictive Control!tracking layer} running at $100\text{--}500\text{ Hz}$ on bare-metal firmware to solve a localized quadratic program for dynamic disturbance rejection. Yet regardless of its internal mathematical sophistication, an optimal tracker remains semantically blind: it possesses no internal model of obstacle clearances, task intent, or human proximity, and it will execute a collision path into a steel upright with the same dynamic fidelity it brings to unobstructed free space. Furthermore, when unmodeled physical disturbances occur—such as surface oil causing gross tire slip or sudden thermal current derating—even an optimal tracking controller can guarantee tracking only within its qualified error tube $\epsilon_{\text{track}}$. The enforcer therefore treats the tracker strictly as a contract boundary: it encapsulates the entire feedback control stack inside the certified bound $\epsilon_{\text{track}}$, evaluating candidate proposals against forward-invariant barrier certificates before any command reaches the tracking layer.
 
 ## The Authority to Refuse {#sec-enforcement-authority-refuse}
 
```

**File**: `books/vol4/13_placement/13_placement.qmd` (modified, +7/-2)
```diff
@@ -265,9 +265,12 @@ plt.tight_layout()
 plt.show()
 plt.close()
 ```
-
 :::
 
+Bridging high-capacity neural deliberation to edge silicon requires fundamentally different compilation principles than general-purpose cloud computing. Cloud inference engines optimize for average throughput (tokens per second) through dynamic batching, runtime graph tracing, and heap memory allocation (`malloc`). In an embodied physical AI system, these practices are hazardous. Dynamic memory allocation introduces heap fragmentation and allocator lock contention, while just-in-time compilation and paging faults inject multi-millisecond tail jitter ($P_{99.9}$) that directly steals stopping clearance (@sec-enforcement-stopping-envelopes). Edge compilers for physical AI therefore enforce **ahead-of-time (AOT) static graph compilation**\index{Ahead-of-time compilation!real-time inference}\index{Static memory allocation!real-time inference}: the execution graph's topology is permanently frozen, tensor dimensions are fixed, and every intermediate activation buffer is mapped to a static, pre-allocated physical memory offset before actuation begins, guaranteeing zero runtime dynamic allocations.
+
+Beyond eliminating tail jitter, compilation on edge SoCs is governed by thermodynamics and the memory wall. As established in @sec-brain-cognitive-pipeline, moving data across an off-chip dynamic RAM (DRAM) bus consumes roughly $10\text{--}20\times$ more energy per bit than performing arithmetic operations inside on-chip registers or static RAM (SRAM). On an untethered mobile robot operating within a $15\text{--}60\,\text{W}$ payload thermal budget, passing intermediate activation tensors back and forth across the DDR bus rapidly exhausts the thermal dissipation capacity of the chassis. **Operator fusion**\index{Operator fusion!thermodynamic efficiency} compiles multi-layer subgraphs (such as Convolution + Bias + Activation, or Attention Projection + LayerNorm) into unified fused kernels that execute entirely within on-chip register files and local SRAM caches, eliminating off-chip memory traffic. In parallel, **numerical precision reduction**\index{Quantization!bus bandwidth multiplier} (quantizing weights and activations from FP32/FP16 down to INT8 or FP4) acts as a direct multiplier on memory bus capacity. Halving the operand bitwidth doubles the effective transfer throughput of the memory crossbar, directly reducing memory bus occupancy and preserving bus bandwidth for concurrent real-time safety monitoring.
+
 ## Two Paths on One Die {#sec-placement-two-paths-one-die}
 
 ```{python}
@@ -414,6 +417,8 @@ Assigning tasks to separate processor cores does not create independent failure
 - *Shared power rails:* A single Power Distribution Network (PDN) delivers current to both domains, where switching surges from the neural accelerator drop the internal voltage rail, risking logic state corruption or brownout resets.
 - *Shared reset domains:* A kernel panic on the application processor that triggers a hardware watchdog\index{Watchdog timer!hardware} reset can pull down the shared peripheral bus or system interconnect, disabling the drive outputs and leaving the base without a permitted command.
 
+Shared hardware contention across these domains is not merely a passive scheduling inefficiency; it establishes an active **cyber-physical attack vector**\index{Cyber-physical security!shared-die attack surface}\index{Hardware security!side channels and DoS}. In a heterogeneous SoC where third-party neural workloads or network-exposed software containers share silicon with the permission path, a compromised application process can execute deliberate denial-of-service (DoS) attacks against physical safety. By generating pathological unaligned memory traffic or triggering cache-line thrashing (exploiting cache side-channel mechanisms or Rowhammer-style disturbances), an attacker on the unprivileged proposal path can deliberately saturate memory controller queues, dela
```

**File**: `books/vol4/15_verification/15_verification.qmd` (modified, +4/-0)
```diff
@@ -373,6 +373,8 @@ A boundary stays honest only if every parameter carries its unit, its provenance
 
 Testing the envelope means attacking its boundary surface. Interior points, where the base crawls unloaded across a dry floor on fresh camera frames, show only that the machine works under ideal conditions. The test framework places points on, just inside, and just outside each consequential boundary. Points just inside check that the policy keeps closed-loop stability\index{Closed-loop stability} under the largest permitted stress; points on the boundary check that margins survive nominal sensor noise; points just outside check that the enforcer takes authority from the policy predictably and halts the base within the survival envelope before the clear distance is gone.
 
+Probing this boundary surface formalizes the critical distinction between classical **Functional Safety** (governed by ISO 26262 and IEC 61508) and the **Safety of the Intended Functionality (SOTIF)**\index{Safety of the Intended Functionality!ISO 21448}\index{SOTIF!ISO 21448}\index{Functional safety!versus SOTIF} (governed by ISO 21448). Classical functional safety frameworks assume that operational hazards arise from *system faults*: broken wiring harnesses, electrical shorts, bit flips in memory, or software syntax bugs. If every hardware and software component operates strictly according to its engineering specification, classical functional safety considers the system non-hazardous. In physical AI systems, this premise fails. A vision transformer or learned depth estimator can execute with zero memory faults, zero numerical exceptions, and bit-exact instruction execution, yet fail to detect an obstacle due to unmodeled sunlight glare, retroreflective surfaces, or novel semantic objects outside its training distribution. This hazard arises from **functional insufficiency**—a fundamental performance limitation of learned perception in open environments, occurring in the total absence of an electrical or software fault. Verification of the operating envelope under SOTIF requires systematically identifying these unknown-unsafe conditions through adversarial boundary search, mapping the envelope within which perception is statistically valid, and demonstrating that the deterministic enforcer catches functional insufficiencies before physical clearance is breached. Yet while SOTIF verifies that the system responds safely to sensory ambiguity in the world, the enforcer's ultimate ability to arrest physical momentum still rests on the deterministic integrity of the underlying hardware under electrical and mechanical stress.
+
 ::: {#psp-verification-hardware-falsification .callout-perspective title="The hardware falsification principle"}
 If a safety property cannot be deterministically falsified by injecting a physical or electrical fault\index{Fault injection!hardware} on target hardware, the property is an unverified assumption rather than an engineering invariant.
 :::
@@ -411,6 +413,8 @@ The physical source extends to operator error and foreseeable misuse (@sec-inter
 
 Working forward from the physical machine adds one representative mechanical class, the actuator jam, to the record-derived list in @tbl-15-fault-classification. Completeness still requires a separate hazard-analysis argument for the specified plant and operating envelope.
 
+Working forward from physical transducers also requires testing against **transduction-layer cyber-physical attacks**\index{Cyber-physical security!transduction attacks}\index{Sensor spoofing!physical injection}\index{Cybersecurity engineering!ISO/SAE 21434}. In connected autonomous systems, physical AI introduces attack surfaces that bypass traditional network firewall abstractions by exploiting the physics of sensory transduction. Resonant acoustic injection (targeting the micro-mechanical proof masses of MEMS gyroscopes with ultrasonic frequencies) can induce false angular rates in inertial navigation without cor
```

---

### Incident Patch 5: `7a35b8d3` (2026-09-23)
**Commit Message**: fix(badge): drop event=push filter from TinyTorch CI badge

The publish workflow's version-bump commit is pushed by github-actions[bot]
using GITHUB_TOKEN, which by design does not trigger other workflows.
This left the badge red after every release because shields.io saw no
push-event run on the new HEAD.  Removing the event filter lets the badge
pick up workflow_dispatch and workflow_call runs as well.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@
 
 <!-- Build Status: Companion Ecosystem & Tools -->
 <p align="center">
-  <a href="https://github.com/harvard-edge/cs249r_book/actions/workflows/tinytorch-validate-dev.yml"><img src="https://img.shields.io/github/actions/workflow/status/harvard-edge/cs249r_book/tinytorch-validate-dev.yml?branch=dev&event=push&label=TinyTorch&logo=python&cacheSeconds=300" alt="TinyTorch"></a>
+  <a href="https://github.com/harvard-edge/cs249r_book/actions/workflows/tinytorch-validate-dev.yml"><img src="https://img.shields.io/github/actions/workflow/status/harvard-edge/cs249r_book/tinytorch-validate-dev.yml?branch=dev&label=TinyTorch&logo=python&cacheSeconds=300" alt="TinyTorch"></a>
   <a href="https://github.com/harvard-edge/cs249r_book/actions/workflows/mlsysim-validate-dev.yml"><img src="https://img.shields.io/github/actions/workflow/status/harvard-edge/cs249r_book/mlsysim-validate-dev.yml?branch=dev&event=push&label=MLSys%C2%B7im&logo=python&cacheSeconds=300" alt="MLSys·im"></a>
   <a href="https://github.com/harvard-edge/cs249r_book/actions/workflows/labs-validate-dev.yml"><img src="https://img.shields.io/github/actions/workflow/status/harvard-edge/cs249r_book/labs-validate-dev.yml?branch=dev&event=push&label=Labs&logo=jupyter&cacheSeconds=300" alt="Labs"></a>
   <a href="https://github.com/harvard-edge/cs249r_book/actions/workflows/kits-validate-dev.yml"><img src="https://img.shields.io/github/actions/workflow/status/harvard-edge/cs249r_book/kits-validate-dev.yml?branch=dev&event=push&label=Kits&logo=arduino&cacheSeconds=300" alt="Kits"></a>
```

---

### Incident Patch 6: `87a953e0` (2026-09-22)
**Commit Message**: fix(validator): handle SystemExit in code_exec check and enforce byte unit in Ch 09

**File**: `binder/cli/checks/code_exec.py` (modified, +1/-1)
```diff
@@ -82,7 +82,7 @@ def check_code_exec(path: Path, text: str | None = None) -> List[CodeExecIssue]:
                     warnings.simplefilter("ignore")
                     with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                         exec(code, scope)
-            except Exception as exc:
+            except (Exception, SystemExit) as exc:
                 first_code_line = next((l.strip() for l in clean_lines if l.strip()), "")
                 issues.append(
                     CodeExecIssue(
```

**File**: `books/vol3/09_checkpointing/09_checkpointing.qmd` (modified, +1/-1)
```diff
@@ -689,7 +689,7 @@ class TurnBoundarySignalBounds:
     delta_t_worst = ((t_max - 1) / r_decode_val) * second
     delta_t_bounded = (k_tokens * (1000.0 / r_decode_val)) * millisecond
 
-    m_token = calc_kv_cache_bytes_per_token(n_layers=l_layers, n_kv_heads=n_kv, head_dim=d_head, bytes_per_elem=1)
+    m_token = calc_kv_cache_bytes_per_token(n_layers=l_layers, n_kv_heads=n_kv, head_dim=d_head, bytes_per_elem=1 * byte)
     m_kv_bytes = (n_ctx * m_token).to(byte)
     m_kv_gib = m_kv_bytes.to(GiB)
     m_kv_gb = m_kv_bytes.to(GB)
```

---

### Incident Patch 7: `83baf60e` (2026-09-22)
**Commit Message**: Fix cover label overlap with circuit bus

**File**: `tinytorch/book/assets/images/cover.svg` (modified, +1/-1)
```diff
@@ -98,7 +98,7 @@
 <rect x="800" y="2370" width="450" height="124" rx="8" fill="#B7352D"/>
 <text x="1025.0" y="2450.0" text-anchor="middle" xml:space="preserve"><tspan font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="42" font-weight="bold" fill="#FFFFFF">20  </tspan><tspan font-family="'TeX Gyre Termes', 'Palatino Linotype', 'Book Antiqua', Palatino, serif" font-size="56" font-weight="bold" fill="#FFFFFF">TinyGPT</tspan></text>
 <text x="800" y="2538" font-family="'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="25" fill="#6B7280" text-anchor="start" font-weight="normal" font-style="normal" letter-spacing="0">Full TinyGPT Architecture · MLPerf Benchmark Olympics</text>
-<text x="1530" y="2312.0" font-family="'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="22" fill="#111827" text-anchor="middle" font-weight="bold" font-style="normal" letter-spacing="2">COMMUNITY LABS &amp; EXTENSIONS</text>
+<text x="1480" y="2538" font-family="'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="22" fill="#111827" text-anchor="middle" font-weight="bold" font-style="normal" letter-spacing="2">COMMUNITY LABS &amp; EXTENSIONS</text>
 <path d="M 1250 2432.0 L 1350 2432.0" fill="none" stroke="#B7352D" stroke-width="3.5" stroke-dasharray="8,5" marker-end="url(#arr)"/>
 <text x="1380" y="2440.0" font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="26" fill="#B7352D" text-anchor="start" font-weight="bold" font-style="normal" letter-spacing="0">LoRA / PEFT</text>
 <path d="M 1250 2432.0 L 1290 2432.0 Q 1310 2432.0 1310 2402.0 L 1310 2382.0 Q 1310 2362.0 1330 2362.0 L 1350 2362.0" fill="none" stroke="#B7352D" stroke-width="3.5" stroke-dasharray="8,5" marker-end="url(#arr)"/>
```

**File**: `tinytorch/book/tools/build_cover.py` (modified, +1/-1)
```diff
@@ -207,7 +207,7 @@ def build():
     node_out_y = ly + n/2
     
     # Label for the branches
-    p.append(_t(node_out_x + 280, node_out_y - 120, "COMMUNITY LABS &amp; EXTENSIONS", SANS, 22, TITLE_C, weight="bold", anchor="middle", ls=2))
+    p.append(_t(node_out_x + 230, ly + n + 44, "COMMUNITY LABS &amp; EXTENSIONS", SANS, 22, TITLE_C, weight="bold", anchor="middle", ls=2))
     
     # 1. Straight right
     p.append(f'<path d="M {node_out_x} {node_out_y} L {node_out_x + 100} {node_out_y}" fill="none" stroke="{ACCENT}" stroke-width="3.5" stroke-dasharray="8,5" marker-end="url(#arr)"/>')
```

---

### Incident Patch 8: `f5122110` (2026-09-22)
**Commit Message**: Revert cover to 20 modules and add expansion ports to Capstone

**File**: `tinytorch/book/assets/images/cover.svg` (modified, +9/-9)
```diff
@@ -32,9 +32,9 @@
 <svg x="891" y="680" width="195" height="195" viewBox="0 0 128 128"><g><path fill="url(#FLAME_BG)" d="M35.56,40.73c-0.57,6.08-0.97,16.84,2.62,21.42c0,0-1.69-11.82,13.46-26.65 c6.1-5.97,7.51-14.09,5.38-20.18c-1.21-3.45-3.42-6.3-5.34-8.29C50.56,5.86,51.42,3.93,53.05,4c9.86,0.44,25.84,3.18,32.63,20.22 c2.98,7.48,3.2,15.21,1.78,23.07c-0.9,5.02-4.1,16.18,3.2,17.55c5.21,0.98,7.73-3.16,8.86-6.14c0.47-1.24,2.1-1.55,2.98-0.56 c8.8,10.01,9.55,21.8,7.73,31.95c-3.52,19.62-23.39,33.9-43.13,33.9c-24.66,0-44.29-14.11-49.38-39.65 c-2.05-10.31-1.01-30.71,14.89-45.11C33.79,38.15,35.72,39.11,35.56,40.73z"/><path fill="url(#FLAME_CORE)" d="M76.11,77.42c-9.09-11.7-5.02-25.05-2.79-30.37c0.3-0.7-0.5-1.36-1.13-0.93 c-3.91,2.66-11.92,8.92-15.65,17.73c-5.05,11.91-4.69,17.74-1.7,24.86c1.8,4.29-0.29,5.2-1.34,5.36 c-1.02,0.16-1.96-0.52-2.71-1.23c-2.15-2.05-3.7-4.72-4.44-7.6c-0.16-0.62-0.97-0.79-1.34-0.28c-2.8,3.87-4.25,10.08-4.32,14.47 C40.47,113,51.68,124,65.24,124c17.09,0,29.54-18.9,19.72-34.7C82.11,84.7,79.43,81.69,76.11,77.42z"/></g></svg>
 <text x="1081" y="880" font-family="'TeX Gyre Termes', 'Palatino Linotype', 'Book Antiqua', Palatino, serif" font-size="280" fill="#111827" text-anchor="start" font-weight="bold" font-style="normal" letter-spacing="0">Torch</text>
 <text x="300" y="1045" xml:space="preserve"><tspan font-family="'TeX Gyre Termes', 'Palatino Linotype', 'Book Antiqua', Palatino, serif" font-size="82" font-style="italic" fill="#374151">Don't just </tspan><tspan font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="70" font-weight="bold" fill="#111827">import torch</tspan><tspan font-family="'TeX Gyre Termes', 'Palatino Linotype', 'Book Antiqua', Palatino, serif" font-size="82" font-style="italic" fill="#374151">. Build it.</tspan></text>
-<text x="300" y="1135" font-family="'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="38" fill="#6B7280" text-anchor="start" font-weight="normal" font-style="normal" letter-spacing="1">From Tensors to Hardware-Accelerated Transformers and Systems Extensions</text>
+<text x="300" y="1135" font-family="'TeX Gyre Heros', 'Helvetica Neue', Helvetica, Arial, sans-serif" font-size="42" fill="#6B7280" text-anchor="start" font-weight="normal" font-style="normal" letter-spacing="1">From Tensors to Hardware-Accelerated Transformers—and Beyond.</text>
 <text x="300" y="1330" font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="28" fill="#6B7280" text-anchor="start" font-weight="normal" font-style="normal" letter-spacing="6">THE FULL RUNTIME STACK</text>
-<text x="2250" y="1330" font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="28" fill="#B7352D" text-anchor="end" font-weight="normal" font-style="normal" letter-spacing="6">21 MODULES / 5 TIERS</text>
+<text x="2250" y="1330" font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="28" fill="#B7352D" text-anchor="end" font-weight="normal" font-style="normal" letter-spacing="6">20 MODULES / 4 TIERS</text>
 <line x1="300" y1="1360" x2="2250" y2="1360" stroke="#C2CBD4" stroke-width="2"/>
 <line x1="862.0" y1="1502.0" x2="2017.0" y2="1502.0" stroke="#B7352D" stroke-width="4"/>
 <path d="M 2017.0 1502.0 L 2077.0 1502.0 Q 2107.0 1502.0 2107.0 1532.0 L 2107.0 1657.0 Q 2107.0 1687.0 2077.0 1687.0 L 802.0 1687.0 Q 772.0 1687.0 772.0 1717.0 L 772.0 1782.0 Q 772.0 1812.0 802.0 1812.0 L 862.0 1812.0" fill="none" stroke="#B7352D" stroke-width="3.5" stroke-dasharray="8,5"/>
@@ -98,13 +98,13 @@
 <rect x="800" y="2370" width="450" height="124" rx="8" fill="#B7352D"/>
 <text x="1025.0" y="2450.0" text-anchor="middle" xml:space="preserve"><tspan font-family="'JetBrains Mono', 'TeX Gyre Cursor', 'SF Mono', Menlo, monospace" font-size="42" font-weight="bold" fill="#FFFFFF">20  </tspan><tspan font-family="'TeX Gyre Termes', 'Palatino Linotype', 'Book Antiqua', Palatino, serif" font-size="56" font
```

**File**: `tinytorch/book/tools/build_cover.py` (modified, +20/-19)
```diff
@@ -118,11 +118,11 @@ def build():
         f'<tspan font-family="{SERIF}" font-size="82" font-style="italic" fill="{SUB_C}">. Build it.</tspan>'
         f'</text>'
     )
-    p.append(_t(L, 1135, "From Tensors to Hardware-Accelerated Transformers and Systems Extensions", SANS, 38, TEXT_C, ls=1))
+    p.append(_t(L, 1135, "From Tensors to Hardware-Accelerated Transformers—and Beyond.", SANS, 42, TEXT_C, ls=1))
 
     # --- header divider bar -------------------------------------------------
     p.append(_t(L, 1330, "THE FULL RUNTIME STACK", MONO, 28, TEXT_C, ls=6))
-    p.append(_t(R, 1330, "21 MODULES / 5 TIERS", MONO, 28, ACCENT, anchor="end", ls=6))
+    p.append(_t(R, 1330, "20 MODULES / 4 TIERS", MONO, 28, ACCENT, anchor="end", ls=6))
     p.append(f'<line x1="{L}" y1="1360" x2="{R}" y2="1360" stroke="{DOTS}" stroke-width="2"/>')
 
     # --- hero: 20-module continuous circuit snaking flow --------------------
@@ -202,23 +202,24 @@ def build():
     )
     p.append(_t(cap_x, ly + n + 44, "Full TinyGPT Architecture · MLPerf Benchmark Olympics", SANS, 25, TEXT_C))
 
-    # Tier V: Extensions
-    ext_label_x = cap_x + cap_w + 120
-    p.append(_t(ext_label_x, ly + 58, "V", SERIF, 72, ACCENT, weight="bold"))
-    p.append(_t(ext_label_x, ly + 106, "EXTENSIONS", SANS, 32, TITLE_C, weight="bold", ls=4))
-    p.append(_t(ext_label_x, ly + 144, "MODULE 21", MONO, 24, TEXT_C, ls=2))
-
-    ext_x, ext_w = ext_label_x + 300, 420
-    p.append(f'<rect x="{ext_x}" y="{ly}" width="{ext_w}" height="{n}" rx="8" fill="{BOX_BG}" stroke="{BOX_BORDER}" stroke-width="2.5"/>')
-    p.append(
-        f'<text x="{ext_x + ext_w/2}" y="{ly + n/2 + 18}" text-anchor="middle" xml:space="preserve">'
-        f'<tspan font-family="{MONO}" font-size="42" font-weight="bold" fill="{BOX_TEXT}">21  </tspan>'
-        f'<tspan font-family="{SERIF}" font-size="56" font-weight="bold" fill="{BOX_TEXT}">Contrib</tspan>'
-        f'</text>'
-    )
-    p.append(_t(ext_x, ly + n + 44, "Native Hardware &amp; Systems Ecosystem Labs", SANS, 25, TEXT_C))
-
-    p.append(f'<line x1="{cap_x + cap_w}" y1="{ly + n/2}" x2="{ext_x - 12}" y2="{ly + n/2}" stroke="{ACCENT}" stroke-width="3.5" stroke-dasharray="8,5" marker-end="url(#arr)"/>')
+    # Community Expansion Ports (Branching out from Capstone)
+    node_out_x = cap_x + cap_w
+    node_out_y = ly + n/2
+    
+    # Label for the branches
+    p.append(_t(node_out_x + 280, node_out_y - 120, "COMMUNITY LABS &amp; EXTENSIONS", SANS, 22, TITLE_C, weight="bold", anchor="middle", ls=2))
+    
+    # 1. Straight right
+    p.append(f'<path d="M {node_out_x} {node_out_y} L {node_out_x + 100} {node_out_y}" fill="none" stroke="{ACCENT}" stroke-width="3.5" stroke-dasharray="8,5" marker-end="url(#arr)"/>')
+    p.append(_t(node_out_x + 130, node_out_y + 8, "LoRA / PEFT", MONO, 26, ACCENT, weight="bold"))
+
+    # 2. Up and right
+    p.append(f'<path d="M {node_out_x} {node_out_y} L {node_out_x + 40} {node_out_y} Q {node_out_x + 60} {node_out_y} {node_out_x + 60} {node_out_y - 30} L {node_out_x + 60} {node_out_y - 50} Q {node_out_x + 60} {node_out_y - 70} {node_out_x + 80} {node_out_y - 70} L {node_out_x + 100} {node_out_y - 70}" fill="none" stroke="{ACCENT}" stroke-width="3.5" stroke-dasharray="8,5" marker-end="url(#arr)"/>')
+    p.append(_t(node_out_x + 130, node_out_y - 70 + 8, "Torch.Compile", MONO, 26, ACCENT, weight="bold"))
+
+    # 3. Down and right
+    p.append(f'<path d="M {node_out_x} {node_out_y} L {node_out_x + 40} {node_out_y} Q {node_out_x + 60} {node_out_y} {node_out_x + 60} {node_out_y + 30} L {node_out_x + 60} {node_out_y + 50} Q {node_out_x + 60} {node_out_y + 70} {node_out_x + 80} {node_out_y + 70} L {node_out_x + 100} {node_out_y + 70}" fill="none" stroke="{ACCENT}" stroke-width="3.5" stroke-dasharray="8,5" marker-end="url(#arr)"/>')
+    p.append(_t(node_out_x + 130, node_out_y + 70 + 8, "Distributed", MONO, 26, ACCENT, weight="bold"))
 
     # --- author ----------------------------------------------
```

---

### Incident Patch 9: `5c3cbf5d` (2026-09-22)
**Commit Message**: Fix margin alignment, chapter title alignment, and standardize Further Reading citation formats

**File**: `tinytorch/book/01_tensors.qmd` (modified, +3/-3)
```diff
@@ -447,6 +447,6 @@ Module 01 gives later code two contracts. A `Tensor` holds float32 data with a d
 
 ## Further Reading
 
-- Harris et al. (2020), [Array programming with NumPy](https://doi.org/10.1038/s41586-020-2649-2), *Nature*. The design behind the strides, views, and broadcasting this chapter rests on.
-- Lawson et al. (1979), [Basic Linear Algebra Subprograms for Fortran usage](https://doi.org/10.1145/355841.355847), *ACM TOMS*. The Level 1/2/3 split that explains why matrix multiplication is the operation the whole stack is tuned around.
-- Baydin et al. (2018), [Automatic differentiation in machine learning: a survey](https://www.jmlr.org/papers/v18/17-468.html), *JMLR*. Background for @sec-autograd, including why reverse mode makes memory the binding constraint.
+- **Harris et al.** (2020). "[Array programming with NumPy](https://doi.org/10.1038/s41586-020-2649-2)." *Nature*. The design behind the strides, views, and broadcasting this chapter rests on.
+- **Lawson et al.** (1979). "[Basic Linear Algebra Subprograms for Fortran usage](https://doi.org/10.1145/355841.355847)." *ACM TOMS*. The Level 1/2/3 split that explains why matrix multiplication is the operation the whole stack is tuned around.
+- **Baydin et al.** (2018). "[Automatic differentiation in machine learning: a survey](https://www.jmlr.org/papers/v18/17-468.html)." *JMLR*. Background for @sec-autograd, including why reverse mode makes memory the binding constraint.
```

**File**: `tinytorch/book/02_activations.qmd` (modified, +2/-2)
```diff
@@ -414,5 +414,5 @@ The numerical mechanisms are small but consequential. ReLU keeps positives and z
 
 ## Further Reading
 
-- Glorot, Bordes, and Bengio (2011), [Deep sparse rectifier neural networks](https://proceedings.mlr.press/v15/glorot11a.html), *AISTATS*. The case for ReLU in deep networks, including the exact zeros this chapter's ReLU produces.
-- Hendrycks and Gimpel (2016), [Gaussian error linear units (GELUs)](https://arxiv.org/abs/1606.08415), *arXiv*. The source of GELU and of the tanh approximation the module implements.
+- **Glorot, Bordes, and Bengio** (2011). "[Deep sparse rectifier neural networks](https://proceedings.mlr.press/v15/glorot11a.html)." *AISTATS*. The case for ReLU in deep networks, including the exact zeros this chapter's ReLU produces.
+- **Hendrycks and Gimpel** (2016). "[Gaussian error linear units (GELUs)](https://arxiv.org/abs/1606.08415)." *arXiv*. The source of GELU and of the tanh approximation the module implements.
```

**File**: `tinytorch/book/03_layers.qmd` (modified, +3/-3)
```diff
@@ -378,6 +378,6 @@ This milestone executes Frank Rosenblatt's 1958 single-layer perceptron on linea
 
 ## Further Reading
 
-- Glorot and Bengio (2010), [Understanding the difficulty of training deep feedforward neural networks](https://proceedings.mlr.press/v9/glorot10a.html), *AISTATS*. The variance argument behind fan-in scaling and the Xavier rule.
-- He et al. (2015), [Delving deep into rectifiers](https://arxiv.org/abs/1502.01852), *ICCV*. The same argument redone for ReLU, which gives the factor of two in Kaiming initialization.
-- Srivastava et al. (2014), [Dropout: a simple way to prevent neural networks from overfitting](https://jmlr.org/papers/v15/srivastava14a.html), *JMLR*. The dropout layer and the rescaling that keeps its expected output unchanged.
+- **Glorot and Bengio** (2010). "[Understanding the difficulty of training deep feedforward neural networks](https://proceedings.mlr.press/v9/glorot10a.html)." *AISTATS*. The variance argument behind fan-in scaling and the Xavier rule.
+- **He et al.** (2015). "[Delving deep into rectifiers](https://arxiv.org/abs/1502.01852)." *ICCV*. The same argument redone for ReLU, which gives the factor of two in Kaiming initialization.
+- **Srivastava et al.** (2014). "[Dropout: a simple way to prevent neural networks from overfitting](https://jmlr.org/papers/v15/srivastava14a.html)." *JMLR*. The dropout layer and the rescaling that keeps its expected output unchanged.
```

**File**: `tinytorch/book/04_losses.qmd` (modified, +2/-2)
```diff
@@ -343,5 +343,5 @@ The numerical invariant is the max shift: for representable finite differences,
 
 ## Further Reading
 
-- Lin et al. (2017), [Focal loss for dense object detection](https://arxiv.org/abs/1708.02002), *ICCV*. A reshaped cross-entropy that shows how the choice of loss changes which examples drive the gradient.
-- Müller, Kornblith, and Hinton (2019), [When does label smoothing help?](https://arxiv.org/abs/1906.02629), *NeurIPS*. What happens to cross-entropy's targets and to the learned representation when the one-hot label is softened.
+- **Lin et al.** (2017). "[Focal loss for dense object detection](https://arxiv.org/abs/1708.02002)." *ICCV*. A reshaped cross-entropy that shows how the choice of loss changes which examples drive the gradient.
+- **Müller, Kornblith, and Hinton** (2019). "[When does label smoothing help?](https://arxiv.org/abs/1906.02629)." *NeurIPS*. What happens to cross-entropy's targets and to the learned representation when the one-hot label is softened.
```

**File**: `tinytorch/book/05_dataloader.qmd` (modified, +3/-3)
```diff
@@ -355,6 +355,6 @@ You built the three pieces that turn a pile of samples into a stream of batches:
 
 ## Further Reading
 
-- Goyal et al. (2017), [Accurate, large minibatch SGD: training ImageNet in 1 hour](https://arxiv.org/abs/1706.02677), *arXiv*. How batch size and learning rate move together, which @sec-optimizers returns to.
-- Krizhevsky, Sutskever, and Hinton (2012), [ImageNet classification with deep convolutional neural networks](https://proceedings.neurips.cc/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html), *NeurIPS*. A training pipeline in which data loading and augmentation ran alongside the model, the arrangement this chapter's separation of `Dataset` and `DataLoader` prepares for.
-- Murray et al. (2021), [tf.data: A Machine Learning Data Processing Framework](https://arxiv.org/abs/2101.12127), *VLDB*. A deeply systems-oriented look at how modern frameworks build asynchronous, pipelined data loaders to prevent GPU starvation.
+- **Goyal et al.** (2017). "[Accurate, large minibatch SGD: training ImageNet in 1 hour](https://arxiv.org/abs/1706.02677)." *arXiv*. How batch size and learning rate move together, which @sec-optimizers returns to.
+- **Krizhevsky, Sutskever, and Hinton** (2012). "[ImageNet classification with deep convolutional neural networks](https://proceedings.neurips.cc/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html)." *NeurIPS*. A training pipeline in which data loading and augmentation ran alongside the model, the arrangement this chapter's separation of `Dataset` and `DataLoader` prepares for.
+- **Murray et al.** (2021). "[tf.data: A Machine Learning Data Processing Framework](https://arxiv.org/abs/2101.12127)." *VLDB*. A deeply systems-oriented look at how modern frameworks build asynchronous, pipelined data loaders to prevent GPU starvation.
```

---

### Incident Patch 10: `90da6c3b` (2026-09-22)
**Commit Message**: fix(vol4): correct temperature units and target-evidence horizon arguments

**File**: `books/vol4/02_body/02_body.qmd` (modified, +14/-14)
```diff
@@ -723,8 +723,8 @@ class CopperResistanceRise:
 
     # ┌── 4. OUTPUT (Formatting) ──────────────────────────────────────────
     alpha_cu_math = fmt_math(rf"\alpha_{{\text{{Cu}}}} \approx {fmt(alpha_cu.magnitude, precision=5, commas=False)}\text{{ K}}^{{-1}}")
-    t_0_str = fmt_temperature(t_0, precision=0)
-    t_ceiling_str = fmt_temperature(t_ceiling, precision=0)
+    t_0_str = fmt_temperature(t_0, unit=ureg.degC, precision=0)
+    t_ceiling_str = fmt_temperature(t_ceiling, unit=ureg.degC, precision=0)
     rise_pct_str = fmt_percent(rise, precision=1, style="prose")
 ```
 
@@ -830,23 +830,23 @@ class ThermalBurst:
     r_wind_str = fmt_resistance(r_wind, unit=ureg.ohm, precision=1)
     c_th_str = fmt_heat_capacity(c_th, unit=joule / K, precision=0)
     theta_ja_str = fmt_thermal_resistance(theta_ja, precision=1)
-    t_amb_str = fmt_temperature(t_amb, precision=0)
-    t_limit_str = fmt_temperature(t_limit, precision=0)
-    t_ceiling_str = fmt_temperature(t_ceiling, precision=0)
+    t_amb_str = fmt_temperature(t_amb, unit=ureg.degC, precision=0)
+    t_limit_str = fmt_temperature(t_limit, unit=ureg.degC, precision=0)
+    t_ceiling_str = fmt_temperature(t_ceiling, unit=ureg.degC, precision=0)
     tau_str = fmt_latency(tau, unit=second, precision=0)
     i_cont_str = fmt_current(i_cont, unit=ureg.ampere, precision=0)
     i_peak_str = fmt_current(i_peak, unit=ureg.ampere, precision=0)
     p_peak_str = fmt_power(p_peak, unit=ureg.watt, precision=0)
     p_avg_max_str = fmt_power(p_avg_max, unit=ureg.watt, precision=0)
-    t_equil_str = fmt_temperature(t_equil, precision=0)
-    t_inf_str = fmt_temperature(t_inf, precision=0)
+    t_equil_str = fmt_temperature(t_equil, unit=ureg.degC, precision=0)
+    t_inf_str = fmt_temperature(t_inf, unit=ureg.degC, precision=0)
     t_cold_str = fmt_latency(t_cold, unit=second, precision=1)
     t_hot_str = fmt_latency(t_hot, unit=second, precision=1)
     hot_cut_pct_str = fmt_percent(hot_cut, precision=1, style="prose")
     duty_pct_str = fmt_percent(duty, precision=1, style="prose")
     t_on_str = fmt_latency(t_on, unit=second, precision=0)
     t_off_str = fmt_latency(t_off_sched, unit=second, precision=1)
-    t_peak_str = fmt_temperature(t_peak, precision=1)
+    t_peak_str = fmt_temperature(t_peak, unit=ureg.degC, precision=1)
 ```
 
 ::: {#nbk-body-thermal-burst-limits .callout-notebook title="Transient thermal accumulation under cold vs. hot starts"}
@@ -956,18 +956,18 @@ class StallDerating:
     eta_str = fmt(eta, precision=2)
     k_t_str = fmt_torque_constant(k_t, precision=2)
     r_0_str = fmt_resistance(r_0, unit=ureg.ohm, precision=2)
-    t_0_str = fmt_temperature(t_0, precision=0)
+    t_0_str = fmt_temperature(t_0, unit=ureg.degC, precision=0)
     theta_ja_str = fmt_thermal_resistance(theta_ja, precision=2)
-    t_amb_str = fmt_temperature(t_amb, precision=0)
-    t_limit_str = fmt_temperature(t_limit, precision=0)
+    t_amb_str = fmt_temperature(t_amb, unit=ureg.degC, precision=0)
+    t_limit_str = fmt_temperature(t_limit, unit=ureg.degC, precision=0)
     tau_motor_str = fmt_torque(tau_motor, precision=0)
     i_stall_str = fmt_current(i_stall, unit=ureg.ampere, precision=0)
     p_cold_str = fmt_power(p_cold, unit=ureg.watt, precision=0)
     const_str = fmt(const.magnitude, precision=2)
     slope_str = fmt(slope, precision=4)
-    dt_ss_str = fmt_temperature(dt_ss, precision=1)
-    t_wind_str = fmt_temperature(t_wind, precision=1)
-    dt_max_str = fmt_temperature((t_limit - t_amb).to(K), precision=0)
+    dt_ss_str = fmt_temperature(dt_ss, unit=ureg.kelvin, precision=1)
+    t_wind_str = fmt_temperature(t_wind, unit=ureg.degC, precision=1)
+    dt_max_str = fmt_temperature((t_limit - t_amb).to(K), unit=ureg.kelvin, precision=0)
     p_max_str = fmt_power(p_max, unit=ureg.watt, precision=2)
     r_hot_str = fmt_resistance(r_hot, unit=ureg.ohm, precision=3)
     i_max_str = fmt_current(i_max, unit=ureg.ampere, precision=2)
```

**File**: `books/vol4/10_intent/10_intent.qmd` (modified, +6/-4)
```diff
@@ -169,14 +169,16 @@ delta_t_overshoot_max = 2.0 * kelvin  # category: illustrative (2 K rise headroo
 delta_t_stall_bess = 10.0 * second  # category: illustrative (10 s unmitigated heating)
 
 # ┌── 2. EXECUTE: evidence horizons, mug intent lapse, latch contact, thermal ──
-tau_ev_untracked = calc_target_evidence_horizon(AISLE.grasp_initial_error, AISLE.grasp_tolerance, AISLE.v_conveyor)
-tau_ev_tracked = calc_target_evidence_horizon(AISLE.grasp_initial_error, AISLE.grasp_tolerance, a=AISLE.a_conveyor_slip)
-tau_ev_slow_drift = calc_target_evidence_horizon(AISLE.grasp_initial_error, AISLE.grasp_tolerance, v_drift_slow)
-grasp_error_budget = AISLE.grasp_tolerance - AISLE.grasp_initial_error
+# Mug on the conveyor: untracked and tracked target-evidence horizons. Both
+# horizons charge the 3 mm initial error against the 15 mm tolerance.
+grasp_error_budget = (AISLE.grasp_tolerance - AISLE.grasp_initial_error).to(millimeter)
+tau_ev_untracked = calc_target_evidence_horizon(AISLE.grasp_tolerance, AISLE.grasp_initial_error, AISLE.v_conveyor).to(millisecond)
+tau_ev_tracked = ((2 * grasp_error_budget / AISLE.a_conveyor_slip) ** 0.5).to(millisecond)
 t_intent_period = (1.0 / RM.intent_rate).to(millisecond)
 err_at_intent_period = (AISLE.grasp_initial_error + AISLE.v_conveyor * t_intent_period).to(millimeter)
 err_excess_at_period = (err_at_intent_period - AISLE.grasp_tolerance).to(millimeter)
 t_tail_overrun = (t_intent_tail - tau_ev_untracked).to(millisecond)
+tau_ev_slow_drift = calc_target_evidence_horizon(AISLE.grasp_tolerance, AISLE.grasp_initial_error, v_drift_slow).to(millisecond)
 
 # Dynamic reachability: the TCP speed ceiling bounds the reach inside the tracked
 # horizon, and a proposal farther away fails the transit lower bound.
```

#### Recent Merged Pull Requests:
- **PR #2140** (2026-09-22): Finalize milestone intros and educational philosophy (@profvjreddi)
- **PR #2139** (2026-09-21): build(deps): bump anyio from 4.14.1 to 4.14.2 in /mlperf-edu (@dependabot[bot])
- **PR #2138** (2026-09-20): build(deps): bump soupsieve from 2.8.4 to 2.9 (@dependabot[bot])
- **PR #2137** (2026-09-20): build(deps): bump sharp and wrangler in /staffml/app/worker (@dependabot[bot])
- **PR #2136** (2026-09-15): Fix invalid escape sequences in book tooling scripts (@MBK-fr)
- **PR #2135** (2026-09-15): fix(mlsysim): redesign §5 Paged Attention demo in KV-Cache tutorial (@kjlintong)
- **PR #2133** (2026-09-14): build(deps): bump brace-expansion in /staffml/app (@dependabot[bot])
- **PR #2132** (closed): build(deps): bump baseline-browser-mapping from 2.10.29 to 2.11.23 in /staffml/app (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
