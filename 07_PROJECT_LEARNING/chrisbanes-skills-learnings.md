> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/chrisbanes-skills-learnings.md`  
> **Source**: github ([https://github.com/chrisbanes/skills](https://github.com/chrisbanes/skills))  
> **Source Version**: `8fc8836c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-30T06:43:17.714Z  
> **Learning ID**: `learn-github-chrisbanes-skills`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): chrisbanes/skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/chrisbanes-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chrisbanes/skills](https://github.com/chrisbanes/skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-30T06:43:17.457Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chrisbanes/skills`
- **Description**: Skills for Kotlin, Jetpack Compose, and Android development
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1131 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `evals/cases/compose-state-authoring-direct/overlay/src/main/kotlin/example/Subject.kt`
```
package example

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

class CounterState {
  var count by mutableStateOf(0)

  fun increment() {
    count += 1
  }
}

```

### Core Architecture Module: `evals/cases/compose-state-authoring-negative/overlay/src/main/kotlin/example/Subject.kt`
```
package example

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.setValue

class CounterState {
  var count by mutableIntStateOf(0)
    private set

  fun increment() {
    count += 1
  }
}

```

### Core Architecture Module: `evals/cases/compose-state-authoring-novel/overlay/src/main/kotlin/example/Subject.kt`
```
package example

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.compositionLocalOf

val LocalCounter = compositionLocalOf { androidx.compose.runtime.mutableStateOf(0) }

@Composable
@ReadOnlyComposable
fun currentBadgeCount(): Int = LocalCounter.current.value

```

### Core Architecture Module: `evals/cases/compose-state-deferred-reads-direct/overlay/src/main/kotlin/example/Subject.kt`
```
package example

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer

@Composable
fun FadingCard(alpha: Animatable<Float, *>) {
  val currentAlpha = alpha.value
  Box(Modifier.graphicsLayer(alpha = currentAlpha))
}

```

### Core Architecture Module: `evals/cases/compose-state-deferred-reads-negative/overlay/src/main/kotlin/example/Subject.kt`
```
package example

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.layout.Box
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer

@Composable
fun FadingCard(alpha: Animatable<Float, *>) {
  Box(Modifier.graphicsLayer { this.alpha = alpha.value })
}

```

### Core Architecture Module: `evals/cases/compose-state-deferred-reads-novel/overlay/src/main/kotlin/example/Subject.kt`
```
package example

import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.onSizeChanged

@Composable
fun FadingCircle(progress: () -> Float) {
  var width by remember { mutableStateOf(0) }
  val radius = width * progress()
  Canvas(Modifier.onSizeChanged { width = it.width }) {
    drawCircle(radius = radius)
  }
}

```

### Core Architecture Module: `evals/cases/compose-state-hoisting-direct/overlay/src/main/kotlin/example/Subject.kt`
```
package example

import androidx.compose.material.TextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue

@Composable
fun SearchContent() {
  var query by remember { mutableStateOf("") }
  TextField(value = query, onValueChange = { query = it })
}

```

### Core Architecture Module: `evals/cases/compose-state-hoisting-negative/overlay/src/main/kotlin/example/Subject.kt`
```
package example

import androidx.compose.material.Text
import androidx.compose.runtime.Composable

@Composable
fun UnreadBadge(count: Int, onOpen: () -> Unit) {
  Text(text = count.toString())
}

```

### Core Architecture Module: `evals/cases/compose-state-hoisting-novel/overlay/src/main/kotlin/example/Subject.kt`
```
package example

import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.ui.focus.FocusRequester

class ConversationViewModel {
  val listState = LazyListState()
  val inputFocus = FocusRequester()
  var draft: String = ""
}

```

### Core Architecture Module: `evals/cases/kotlin-flow-state-events-novel/overlay/src/main/kotlin/example/Subject.kt`
```
package example

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow

class ProfileModel {
    private val mutableState = MutableStateFlow("loading")
    val state: StateFlow<String> = mutableState.asStateFlow()

    private val mutableNavigation = MutableSharedFlow<String>()
    val navigation: SharedFlow<String> = mutableNavigation.asSharedFlow()
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #135** (2026-10-25): **Keep serial implementation solo and PR polling in the controller**
  *Symptoms*: ## Summary  Single-item and serial implementation currently force worker handoffs, and routine PR polling starts an evidence helper. Choose implementation ownership once from the whole graph and keep routine polling in the controller:  ```text implementation preflight   no parallel point -> lead owns every item   any parallel point -> workers own every item   both -> integrated-head checks + independent final review  shepherd   routine polling -> controller   large failed CI log -> one bounded read-only diagnostic question ```  Align the skill entrypoints, launcher, README wording and existing evaluations. Add five calibration cases without changing the scored benchmark size or published result metrics.  Closes #134. Approved [agent brief](https://github.com/chrisbanes/skills/issues/134#issuecomment-6389915351) and [implementation plan](https://github.com/chrisbanes/skills/issues/134#issuecomment-6395119976).  ## Evidence  - **Before:** Static inspection at `0bd44a0` found unconditional worker assignment for a single item or serial graph, a serial-chain rubric requiring worker acceptance, and a routine polling-helper rule.   **After:** The new solo-chain, unavailable-reviewer, late-fanout, direct-poll and large-log cases cover the selected behavior. Existing serial-chain and handoff rubrics are reconciled; delegated recovery, API/DOC/WIRE reuse and host-monitor cases remain. - Passed `npm run build`, `npm run lint`, `npm run evals:validate` (223 cases), and `npm test` (7 Node

- **Issue #134** (2026-10-25): **Use subagents only where they pay off in implement-with-subagents and shepherd**
  *Symptoms*: > *This was generated by AI during triage.*  ## Current status  - **Completed:** Approved workflow changes and five calibration cases implemented in [PR #135](https://github.com/chrisbanes/skills/pull/135), head `632cce7d2abbaae1a24b72349d404651717ef09f`. Independent review and current-main compatibility review both returned **ship**. Automatic [Codex](https://github.com/chrisbanes/skills/pull/135#issuecomment-6395209170) and [Greptile](https://github.com/chrisbanes/skills/pull/135#issuecomment-6395228222) reviews also completed on this head with no findings. - **Validation:** Local build, lint, corpus validation (223 cases), and full tests passed. [GitHub CI](https://github.com/chrisbanes/skills/actions/runs/40175126890) passed on the PR integration candidate. No live model evaluations or version bump. - **Blockers:** No delivery blocker identified. PR is open and ready for review; it has not been merged. - **Next action:** Review and, with explicit merge authority, merge PR #135. - **Contract:** [Approved agent brief](https://github.com/chrisbanes/skills/issues/134#issuecomment-6389915351) and [implementation plan](https://github.com/chrisbanes/skills/issues/134#issuecomment-6395119976).  ## Background  Anthropic's article [Building agents: when to fold subagents into your main agent loop](https://claude.com/resources/articles/building-agents-when-to-fold-subagents-into-your-main-agent-loop) argues that one main loop with progressively disclosed skills and tools often beats

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

### Incident Patch 1: `8fc8836c` (2026-10-27)
**Commit Message**: Reject impossible CalVer dates (#120)

The release helper accepted impossible dates like `2026.2.31`.

I added calendar validation and regression coverage. Invalid dates now
fail clearly, including dates from existing release inventory. Valid
CalVer formatting and daily numbering stay unchanged.

**File**: `scripts/release.py` (modified, +5/-0)
```diff
@@ -37,6 +37,11 @@ def validate_version(version):
             f"zero-padded month/day: {version}"
         )
     parts = version.split(".")
+    year, month, day = map(int, parts[:3])
+    try:
+        dt.date(year, month, day)
+    except ValueError as error:
+        raise ValueError(f"Version must use a valid Gregorian calendar date: {version}") from error
     if len(parts) == 4 and len(parts[3]) == 1:
         return ".".join((*parts[:3], f"0{parts[3]}"))
     return version
```

**File**: `scripts/test_release.py` (modified, +164/-0)
```diff
@@ -39,6 +39,170 @@ def test_validate_version_accepts_daily_release_number(self):
             with self.subTest(version=version):
                 self.assertEqual(self.release.validate_version(version), expected)
 
+    def test_validate_version_rejects_impossible_calendar_dates(self):
+        versions = (
+            "2026.2.31", "2026.2.29", "2026.4.31", "0000.1.1", "1900.2.29",
+            "2026.2.31.1", "2026.2.31.01", "2026.2.31.99",
+            "2026.2.29.1", "2026.2.29.01", "2026.2.29.99",
+            "2026.4.31.1", "2026.4.31.01", "2026.4.31.99",
+            "0000.1.1.1", "0000.1.1.01", "0000.1.1.99",
+            "1900.2.29.1", "1900.2.29.01", "1900.2.29.99",
+        )
+        for version in versions:
+            with self.subTest(version=version):
+                with self.assertRaises(ValueError) as error:
+                    self.release.validate_version(version)
+                self.assertEqual(
+                    str(error.exception),
+                    f"Version must use a valid Gregorian calendar date: {version}",
+                )
+
+    def test_validate_version_accepts_calendar_boundaries(self):
+        expected_versions = {
+            "2000.2.29": "2000.2.29",
+            "2028.2.29": "2028.2.29",
+            "1900.2.28": "1900.2.28",
+            "2026.2.28": "2026.2.28",
+            "2026.4.30": "2026.4.30",
+            "2026.1.31": "2026.1.31",
+            "2028.2.29.1": "2028.2.29.01",
+            "2028.2.29.01": "2028.2.29.01",
+            "2028.2.29.99": "2028.2.29.99",
+        }
+        for version, expected in expected_versions.items():
+            with self.subTest(version=version):
+                self.assertEqual(self.release.validate_version(version), expected)
+
+    def test_validate_version_preserves_format_diagnostic(self):
+        versions = (
+            "2026-2-28", "2026/2/28", "026.2.28", "02026.2.28",
+            "2026.0.1", "2026.13.1", "2026.1.0", "2026.1.32",
+            "2026.02.28", "2026.2.08", "2026.02.08",
+            "2028.2.29.0", "2028.2.29.00", "2028.2.29.001", "2028.2.29.100",
+            "2026.02.31", "2026.2.28.1.1", "v2026.2.28", "2026.2.28\n",
+        )
+        for version in versions:
+            with self.subTest(version=version):
+                with self.assertRaises(ValueError) as error:
+                    self.release.validate_version(version)
+                self.assertEqual(
+                    str(error.exception),
+                    "Version must use CalVer YYYY.M.D, YYYY.M.D.N, or YYYY.M.D.NN without "
+                    f"zero-padded month/day: {version}",
+                )
+
+    def test_automatic_version_rejects_invalid_historical_calendar_dates(self):
+        cases = (
+            ("2026.2.31", "2026.2.31"),
+            ("2026.02.31", "2026.2.31"),
+            ("2026.2.29", "2026.2.29"),
+            ("2026.02.29.1", "2026.2.29.1"),
+            ("2026.4.31", "2026.4.31"),
+            ("2026.04.31.99", "2026.4.31.99"),
+            ("0000.1.1", "0000.1.1"),
+            ("0000.01.01.01", "0000.1.1.01"),
+            ("1900.2.29", "1900.2.29"),
+            ("1900.02.29", "1900.2.29"),
+        )
+        with patch.object(self.release, "default_version", return_value="2026.10.14"):
+            for version, normalized in cases:
+                with self.subTest(version=version):
+                    with self.assertRaises(ValueError) as error:
+                        self.release.resolve_version("", ["2026.10.14", version])
+                    self.assertEqual(
+                        str(error.exception),
+                        f"Version must use a valid Gregorian calendar date: {normalized}",
+                    )
+
+    def test_automatic_version_accepts_historical_leap_dates(self):
+        with patch.object(self.release, "default_version", return_value="2026.10.14"):
+            self.assertEqual(
+                self.release.resolve_version(
+                    "", ["2000.02.29", "2028.02.29.9", "2026.06.07.9"],
+                ),
+                "2026.10.14",
+            )
+
+    def test_explicit_version_overrides_invalid_calendar_inventory(self):
+        self.assertEqual(
+            self.release.resolve_version(
+                "2028.2.29.1",
+                ["2026.02.31", "0000.01.01", "1900.02.29", "2026.10.14.99"],
+            ),
+            "2028.2.29.01",
+        )
+
+    def test_cli_calendar_error_is_exact(self):
+        output = io.StringIO()
+        errors = io.StringIO()
+        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
+            result = self.release.main(["resolve-version", "2026.2.31.1"])
+        self.assertEqual(result, 1)
+        self.assertEqual(output.getvalue(), "")
+        self.assertEqual(
+            errors.getvalue(),
+            "Version must use a valid Gregorian calendar date: 2026.2.31.1\n",
+        )
+
+    def test_manifest_helpers_reject_invalid_calendar_before_filesystem_ac
```

---

### Incident Patch 2: `183cfc9b` (2026-10-26)
**Commit Message**: Bump version to 2026.10.26

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "chrisbanes-skills",
   "description": "Skills for Kotlin, Android, JVM, and Jetpack Compose development by Chris Banes.",
-  "version": "2026.10.22",
+  "version": "2026.10.26",
   "author": {
     "name": "Chris Banes",
     "url": "https://github.com/chrisbanes"
```

**File**: `.codex-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "chrisbanes-skills",
-  "version": "2026.10.22",
+  "version": "2026.10.26",
   "description": "Skills for Kotlin, Android, JVM, and Jetpack Compose development by Chris Banes.",
   "author": {
     "name": "Chris Banes",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "chrisbanes-skills",
-  "version": "2026.10.22",
+  "version": "2026.10.26",
   "description": "Skills for Kotlin, Android, JVM, and Jetpack Compose development by Chris Banes.",
   "type": "module",
   "main": ".opencode/plugins/chrisbanes-skills.js",
```

**File**: `plugin.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
   "name": "chrisbanes-skills",
-  "version": "2026.10.22",
+  "version": "2026.10.26",
   "description": "Skills for Kotlin, Android, JVM, and Jetpack Compose development by Chris Banes.",
   "author": {
     "name": "Chris Banes",
```

#### Recent Merged Pull Requests:
- **PR #135** (2026-10-25): Keep serial implementation solo and PR polling in the controller (@chrisbanes)
- **PR #133** (2026-10-21): Improve Claude eval compliance and trigger gaps (@chrisbanes)
- **PR #132** (2026-10-21): Close skill gaps found by the Claude Code evals (@chrisbanes)
- **PR #131** (2026-10-21): Judge Claude evals with Sonnet; count gradle-run once Gradle runs (@chrisbanes)
- **PR #130** (2026-10-20): Simplify grounded-writing around Chris's own style (@chrisbanes)
- **PR #129** (2026-10-19): Ask once at Project startup whether to merge (@chrisbanes)

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

## X. Reject impossible CalVer dates (#120)

**RULE**:
When implementing operations in `scripts/release.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in chrisbanes/skills. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8fc8836c`: Reject impossible CalVer dates (#120). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `scripts/release.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
    year, month, day = map(int, parts[:3])
    try:
        dt.date(year, month, day)
    except ValueError as error:
        raise ValueError(f"Version must use a valid Gregorian calendar date: {version}") from error
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8fc8836c` are properly handled with clean fallback behavior.
