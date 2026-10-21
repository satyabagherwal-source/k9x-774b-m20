> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/chrisbanes-skills-learnings.md`  
> **Source**: github ([https://github.com/chrisbanes/skills](https://github.com/chrisbanes/skills))  
> **Source Version**: `f0a89e31`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-21T18:13:59.963Z  
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
> **Harvest Timestamp**: 2026-10-21T18:13:59.623Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chrisbanes/skills`
- **Description**: Skills for Kotlin, Jetpack Compose, and Android development
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1114 stars

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
- **Issue #133** (2026-10-21): **Improve Claude eval compliance and trigger gaps**
  *Symptoms*: Stacked on #132 (which is stacked on #131); retarget to `main` as each merges.  ## Summary  Two small changes aimed at gaps the Haiku 5.5 / Sonnet-judged run found:  - **Forbidden-action gate (Claude only):** the Claude subject prompt states that every Gradle command must include `--offline --no-scan` and, for edit cases, lists the only paths it may create or change (or says no file may change). Codex prompts are unchanged (a test asserts both sides). - **`kotlin-control-flow`:** guard conditions are stable from Kotlin 2.2; an explicit `languageVersion` is honored, otherwise the project's Kotlin version confirms support.  ## Measured (compose rerun, Haiku subject, Sonnet judge)  - Forbidden-action failures 19 -> 2 (none 7 -> 1, forced 2 -> 0, automatic 10 -> 1); the gate is still NOT MET by those two. - Automatic tokens per pass 139.3k -> 106.9k, tool calls per pass 9.4 -> 7.1. - Pass rates moved by 1 to 2 records per arm (noise at n=3). - Compose routing recall fell (83.3% -> 79.6% reported): the explicit flags in the prompt seem to let Haiku run `./gradlew` directly instead of loading `gradle-run`. A `gradle-run` description change meant to raise recall did not help and was reverted. Recall remains a known gap. - The `kotlin-control-flow` change is not yet measured; it lives in the kotlin-gradle suite.  ## Test plan  - `npm run lint`, `npm run evals:validate` (212 cases) and the eval unit tests pass. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"61a89cb71a7e203f567f29ed901520e4ec44c6c4","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-10-21T16:34:25.077943Z">2026-10-21T16:34:25.077943Z</relative-time> | `61a89cb` | New commits |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Code
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=84562812"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a><a href="https://app.greptile.com/banes/github/chrisbanes/skills/-/pull/133"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/ViewInGreptileDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/ViewInGreptile.svg?v=2"><img alt="View in Greptile" src="https://greptile-static-assets.s3.amazonaws.com/badges/ViewInGreptile.svg?v=2" align="right"></picture></a>Confidence Score:

- **Issue #132** (2026-10-21): **Close skill gaps found by the Claude Code evals**
  *Symptoms*: Stacked on #131; retarget to `main` after it merges.  ## Summary  Three minimal skill-text fixes for failures in the Haiku 5.5 / Sonnet-judged run (see the run record in #131):  - `gradle-run`: rerunning an unchanged task under a relabeled question is still a repeat (`gradle-fingerprint-diagnosis-novel`, 2 automatic failures). - `kotlin-api-design` value classes: when callers must stay untouched, change only the declaration; keep the public constructor and add no private constructor or factory (`kotlin-api-value-class-direct`, 1 forced and 1 automatic failure). - `deliver-spec`: name conversation-mode `to-plan` as the initial route for an approved local source, including when answering a resume question (`deliver-spec-novel`, 2 forced failures).  Versions are unchanged. The two single-record failures (`compose-state-authoring-novel`, `router-kotlin-gradle-validation`) are left alone as within noise.  ## Test plan  - `npm run lint`, `npm run evals:validate` (212 cases) and the eval unit tests (403) pass. `npm test` fails in this checkout only because the opencode plugin test cannot resolve `js-yaml` (no `node_modules`); it is unrelated to these edits. - A targeted live rerun of the affected skills (`gradle-run`, `kotlin-api-design`, `deliver-spec`, `shepherd`) will follow once approved, with results reported separately.

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

### Incident Patch 1: `f0a89e31` (2026-10-21)
**Commit Message**: Improve Claude eval compliance and trigger gaps (#133)

Stacked on #132 (which is stacked on #131); retarget to `main` as each
merges.

## Summary

Two small changes aimed at gaps the Haiku 5.5 / Sonnet-judged run found:

- **Forbidden-action gate (Claude only):** the Claude subject prompt
states that every Gradle command must include `--offline --no-scan` and,
for edit cases, lists the only paths it may create or change (or says no
file may change). Codex prompts are unchanged (a test asserts both
sides).
- **`kotlin-control-flow`:** guard conditions are stable from Kotlin
2.2; an explicit `languageVersion` is honored, otherwise the project's
Kotlin version confirms support.

## Measured (compose rerun, Haiku subject, Sonnet judge)

- Forbidden-action failures 19 -> 2 (none 7 -> 1, forced 2 -> 0,
automatic 10 -> 1); the gate is still NOT MET by those two.
- Automatic tokens per pass 139.3k -> 106.9k, tool calls per pass 9.4 ->
7.1.
- Pass rates moved by 1 to 2 records per arm (noise at n=3).
- Compose routing recall fell (83.3% -> 79.6% reported): the explicit
flags in the prompt seem to let Haiku run `./gradlew` directly instead
of loading `gradle-run`. A `gradle-run` description

**File**: `evals/harness/claude.py` (modified, +18/-0)
```diff
@@ -829,6 +829,24 @@ def forced_target_observed(self, record, targets):
                     return True
         return False
 
+    def boundary_instruction(self, case: EvalCase) -> str:
+        # Claude subjects add tests and drop --offline unless told; Codex prompts stay unchanged.
+        text = (
+            " Every Gradle command you run must include `--offline --no-scan`;"
+            " omitting `--offline` is a violation."
+        )
+        if case.task_mode == "edit":
+            allowed = (
+                "only " + ", ".join(f"`{path}`" for path in case.allowed_write_paths)
+                if case.allowed_write_paths
+                else "no file"
+            )
+            text += (
+                f" Create or change {allowed}; add no test, build or other file,"
+                " and do not edit anything outside the workspace."
+            )
+        return text
+
     def forced_instruction(self, case: EvalCase) -> str:
         skills = ", ".join(f"`{skill}`" for skill in case.target_skills)
         dependencies = ", ".join(f"`{skill}`" for skill in case.constant_skills)
```

**File**: `evals/harness/runner.py` (modified, +3/-0)
```diff
@@ -311,6 +311,9 @@ def _subject_prompt(case: EvalCase, arm: str, runtime: Runtime) -> str:
     else:
         prompt += " This case has no evaluator-owned fixture dependencies."
     prompt += getattr(runtime, "answer_instruction", "")
+    boundary = getattr(runtime, "boundary_instruction", None)
+    if boundary is not None:
+        prompt += boundary(case)
     if arm == "forced":
         prompt += runtime.forced_instruction(case)
     return prompt + "\n"
```

**File**: `evals/tests/test_claude_runner.py` (modified, +13/-0)
```diff
@@ -20,6 +20,7 @@
     captured_skill_file_evidence,
     prepare_workspace,
     reported_skill_names,
+    _subject_prompt,
     run_subject,
 )
 from evals.harness.score import forced_integrity_status, is_behavioral_evidence
@@ -134,6 +135,18 @@ def test_edit_forced_command_uses_skill_tool_instruction(self):
         self.assertNotIn("`cat`", prompt)
         self.assertIn("In the final `skills_used`, include each of these exact public", prompt)
 
+    def test_claude_prompt_states_the_write_boundary_and_offline_rule_codex_does_not(self):
+        with tempfile.TemporaryDirectory() as tmp:
+            edit = sample_case(Path(tmp))
+            review = replace(edit, task_mode="review", allowed_write_paths=())
+            claude = _subject_prompt(edit, "none", ClaudeRuntime())
+            self.assertIn("must include `--offline --no-scan`", claude)
+            self.assertIn("only `src/main/kotlin/example/Subject.kt`", claude)
+            self.assertNotIn("Create or change", _subject_prompt(review, "none", ClaudeRuntime()))
+            no_write = replace(edit, allowed_write_paths=())
+            self.assertIn("Create or change no file", _subject_prompt(no_write, "none", ClaudeRuntime()))
+            self.assertNotIn("must include", _subject_prompt(edit, "none", test_codex_runner.CodexRuntime()))
+
     def test_fixture_skill_dependencies_are_never_switched_off(self):
         self.write_subject_schema()
         case = replace(sample_case(self.root), constant_skills=("implement",))
```

**File**: `skills/kotlin-control-flow/SKILL.md` (modified, +4/-1)
```diff
@@ -28,7 +28,10 @@ branch, and let the compiler prove closed-domain coverage.
 3. Use a guard only on a subject `when`, after a primary condition, when the
    extra predicate belongs to that branch and an unguarded branch still handles
    the primary condition. Put the guarded branch first. Split comma-separated
-   conditions instead of guarding one of them.
+   conditions instead of guarding one of them. Guards are stable from Kotlin
+   2.2. Honor an explicit `languageVersion` setting; otherwise the project's
+   Kotlin version in its build file or version catalog is enough to confirm
+   support, so do not decline a guard for lack of further proof.
 4. For a closed enum, Boolean, sealed type, or nullable closed type, name every
    case and omit `else`. Match objects by value and class/data-class subtypes
    with `is`. If the input is an open server/platform value or needs real
```

---

### Incident Patch 2: `0e99d1c5` (2026-10-21)
**Commit Message**: Close skill gaps found by the Claude Code evals (#132)

Stacked on #131; retarget to `main` after it merges.

## Summary

Three minimal skill-text fixes for failures in the Haiku 5.5 /
Sonnet-judged run (see the run record in #131):

- `gradle-run`: rerunning an unchanged task under a relabeled question
is still a repeat (`gradle-fingerprint-diagnosis-novel`, 2 automatic
failures).
- `kotlin-api-design` value classes: when callers must stay untouched,
change only the declaration; keep the public constructor and add no
private constructor or factory (`kotlin-api-value-class-direct`, 1
forced and 1 automatic failure).
- `deliver-spec`: name conversation-mode `to-plan` as the initial route
for an approved local source, including when answering a resume question
(`deliver-spec-novel`, 2 forced failures).

Versions are unchanged. The two single-record failures
(`compose-state-authoring-novel`, `router-kotlin-gradle-validation`) are
left alone as within noise.

## Test plan

- `npm run lint`, `npm run evals:validate` (212 cases) and the eval unit
tests (403) pass. `npm test` fails in this checkout only because the
opencode plugin test cannot resolve `js-yaml` (no `node_modules`); it is
u

**File**: `skills/deliver-spec/SKILL.md` (modified, +4/-1)
```diff
@@ -37,7 +37,10 @@ Project run already owns that issue, return it to that controller.
    publication gates. A source qualifying for the [fast path](references/fast-path.md)
    applies it instead. For a GitHub issue missing `ready-for-agent`, first use
    `triage` and wait for its approved outcome; do not change labels yourself.
-   Local sources skip triage but need explicit stakeholder approval.
+   Local sources skip triage but need explicit stakeholder approval. For an
+   approved local source with no plan that does not qualify for the fast path,
+   name conversation-mode `to-plan` as the initial route, including when
+   answering a resume question.
    Approval covers the accepted contract and only the live qualification
    allowances it explicitly records; do not infer extra attempts or authority.
 3. Verify scope and boundaries once. A verified handoff authorizes continuing
```

**File**: `skills/gradle-run/SKILL.md` (modified, +2/-1)
```diff
@@ -94,7 +94,8 @@ follow-up inspection invalidate lifecycle evidence even when Gradle succeeds.
    context before revising the diagnosis. Verify each source change with the
    same wrapper and narrowest applicable task. In the final diagnosis, name the
    focused inspection as the next action; do not claim a source fix before it.
-   A new question does not permit a blind repeat.
+   A new question does not permit a blind repeat: rerunning an unchanged task
+   under a relabeled question is still a repeat.
 7. Treat the full log as raw sensitive material even though summaries and
    ledgers redact common credentials. Never expose it in model-visible context.
    On interruption, use the wrapper's recorded signal and bounded partial
```

**File**: `skills/kotlin-api-design/references/value-classes.md` (modified, +3/-1)
```diff
@@ -14,7 +14,9 @@ data class for multiple fields or different equality.
 3. Check equality, serialization, Java interop, and hot-path boxing.
 4. Choose the type below, then compile and test. For a Compose performance
    change, re-check compiler or recomposition evidence. On contract drift, keep
-   the existing type.
+   the existing type. When callers must stay untouched, change only the type
+   declaration: keep the public constructor and property, and add no private
+   constructor or factory.
 
 ## Decision flow
 
```

#### Recent Merged Pull Requests:
- **PR #133** (2026-10-21): Improve Claude eval compliance and trigger gaps (@chrisbanes)
- **PR #132** (2026-10-21): Close skill gaps found by the Claude Code evals (@chrisbanes)
- **PR #131** (2026-10-21): Judge Claude evals with Sonnet; count gradle-run once Gradle runs (@chrisbanes)
- **PR #130** (2026-10-20): Simplify grounded-writing around Chris's own style (@chrisbanes)
- **PR #129** (2026-10-19): Ask once at Project startup whether to merge (@chrisbanes)
- **PR #128** (2026-10-19): Keep nested agents waiting on their results; define one payload digest (@chrisbanes)

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

## X. Improve Claude eval compliance and trigger gaps (#133)

**RULE**:
When implementing operations in `evals/harness/claude.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in chrisbanes/skills. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f0a89e31`: Improve Claude eval compliance and trigger gaps (#133). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `evals/harness/claude.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
    def boundary_instruction(self, case: EvalCase) -> str:
        # Claude subjects add tests and drop --offline unless told; Codex prompts stay unchanged.
        text = (
            " Every Gradle command you run must include `--offline --no-scan`;"
            " omitting `--offline` is a violation."
        )
        if case.task_mode == "edit":
            allowed = (
                "only " + ", ".join(f"`{path}`" for path in case.allowed_write_paths)
                if case.allowed_write_paths
                else "no file"
            )
            text += (
                f" Create or change {allowed}; add no test, build or other file,"
                " and do not edit anything outside the workspace."
            )
        return text

```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f0a89e31` are properly handled with clean fallback behavior.
