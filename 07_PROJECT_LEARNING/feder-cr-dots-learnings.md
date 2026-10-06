# Forensic Learning Record (Deep Inspection): feder-cr/dots

> **Canonical Artifact**: `07_PROJECT_LEARNING/feder-cr-dots-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/feder-cr/dots](https://github.com/feder-cr/dots))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:26:59.507Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `feder-cr/dots`
- **Description**: Open-source dots for the web: an AI agent with its own browser, one that does not get blocked.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2621 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/dots/__init__.py`
```
"""dots: invisible-playwright-mcp's interface, under the name people search for."""

```

### Core Architecture Module: `src/dots/__main__.py`
```
from .cli import main

main()

```

### Core Architecture Module: `src/dots/cli.py`
```
"""`dots` is `invisible-playwright-mcp ui`, and nothing else.

It goes through the package's command GROUP rather than calling the `ui`
command directly, because the group is where the `.env` beside the command is
read and where an old session directory is carried over. Calling `ui` on its
own would skip both, and a key kept in `.env` would simply not be found.
"""
from __future__ import annotations

import sys

#: The one subcommand this program is. Every option after it is the
#: interface's own, so `dots --help` lists exactly what `ui --help` does.
SUBCOMMAND = "ui"


def main(argv: list[str] | None = None) -> None:
    from invisible_playwright_mcp.cli import main as group

    args = list(sys.argv[1:] if argv is None else argv)
    group(args=[SUBCOMMAND, *args], prog_name="dots")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1** (2026-09-29): **README: the title as the first element**
  *Symptoms*: The title sat inside a centered div, so its own top margin added to the panel padding and left an empty band above it. As the first element it starts where every README starts: 32 px from the top of the box instead of 56, measured on a render from the markdown API.

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

### Incident Patch 1: `454d159b` (2026-09-29)
**Commit Message**: CI: English, claims and the suite on two systems, one gate context

**File**: `.github/workflows/tests.yml` (added, +119/-0)
```diff
@@ -0,0 +1,119 @@
+name: tests
+
+on:
+  push:
+    branches: [main]
+  pull_request:
+    branches: [main]
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+concurrency:
+  group: ${{ github.workflow }}-${{ github.ref }}
+  cancel-in-progress: true
+
+# `gate` is the ONLY context the branch protection requires: it depends on every
+# job, so its name never drifts when the matrix changes. Unlike its siblings it
+# accepts nothing but success, because no job here is ever skipped on purpose:
+# a skip would mean a job that did not run, which reads exactly like one that
+# passed.
+defaults:
+  run:
+    shell: bash
+
+jobs:
+  english:
+    name: the repository is English
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-python@v5
+        with:
+          python-version: "3.12"
+      - name: install the pinned package, which carries the gate
+        run: |
+          python -m pip install --upgrade pip
+          pip install -e .
+      - name: check the prose
+        run: |
+          python -m invisible_core.english --selftest
+          python -m invisible_core.english
+
+  claims:
+    name: the README promises nothing it cannot support
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-python@v5
+        with:
+          python-version: "3.12"
+      - name: install the pinned package, which carries the gate
+        run: |
+          python -m pip install --upgrade pip
+          pip install -e .
+      - name: check the claims
+        run: |
+          python -m invisible_core.claims --selftest
+          python -m invisible_core.claims
+
+  unit:
+    name: pytest (${{ matrix.os }}, py${{ matrix.python }})
+    runs-on: ${{ matrix.os }}
+    strategy:
+      fail-fast: false
+      matrix:
+        os: [ubuntu-latest, windows-latest]
+        # Every version `requires-python = ">=3.11"` promises and the pinned
+        # package declares, on ubuntu; Windows on 3.12.
+        python: ["3.11", "3.12", "3.13"]
+        exclude:
+          - { os: windows-latest, python: "3.11" }
+          - { os: windows-latest, python: "3.13" }
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-python@v5
+        with:
+          python-version: ${{ matrix.python }}
+          cache: pip
+      - name: install the package and its dev extras
+        run: |
+          python -m pip install --upgrade pip
+          pip install -e ".[dev]"
+      - name: run pytest
+        run: |
+          set -o pipefail   # or tee would swallow pytest's exit code
+          pytest tests/ -v --tb=short -rs | tee tests-report.txt
+      # pytest's exit code cannot tell "everything passed" from "the selection
+      # dropped everything". The suite is four tests, so all four must run.
+      - name: refuse a run in which the suite deselected itself
+        run: |
+          python - <<'PY'
+          import pathlib, re, sys
+          text = pathlib.Path("tests-report.txt").read_text(encoding="utf-8", errors="ignore")
+          m = re.search(r"(\d+) passed", text)
+          passed = int(m.group(1)) if m else 0
+          if passed < 4:
+              print(f"only {passed} test(s) ran (expected 4)", file=sys.stderr)
+              sys.exit(1)
+          print(f"{passed} tests ran")
+          PY
+
+  gate:
+    needs: [unit, english, claims]
+    if: always()
+    runs-on: ubuntu-latest
+    steps:
+      - name: refuse unless every job succeeded
+        run: |
+          echo "unit:    ${{ needs.unit.result }}"
+          echo "english: ${{ needs.english.result }}"
+          echo "claims:  ${{ needs.claims.result }}"
+          for result in "${{ needs.unit.result }}" "${{ needs.english.result }}" "${{ needs.claims.result }}"; do
+            if [ "$result" != "success" ]; then
+              echo "a job did not succeed: $result"
+              exit 1
+            fi
+          done
+          echo "ok"
```

#### Recent Merged Pull Requests:
- **PR #1** (2026-09-29): README: the title as the first element (@feder-cr)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
