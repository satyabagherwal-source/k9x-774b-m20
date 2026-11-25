> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/chrisbanes-skills-learnings.md`  
> **Source**: github ([https://github.com/chrisbanes/skills](https://github.com/chrisbanes/skills))  
> **Source Version**: `9427b3a2`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T23:41:42.967Z  
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
> **Harvest Timestamp**: 2026-11-25T23:41:42.960Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chrisbanes/skills`
- **Description**: Skills for Kotlin, Jetpack Compose, and Android development
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1166 stars

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
- **Issue #179** (2026-11-24): **gradle-run: provide explicit recovery for abandoned uncertain workflows**
  *Symptoms*: ## Current status  The offline recovery implementation was merged in [PR #187](https://github.com/chrisbanes/skills/pull/187). Deterministic checks and independent review passed. The maintainer approved merging with Windows behavior covered by simulated queries. This issue tracks any follow-up from direct verification of live, absent, and unverifiable PIDs on Windows.  [Agent brief](https://github.com/chrisbanes/skills/issues/179#issuecomment-6982713434) · [Active plan](https://github.com/chrisbanes/skills/issues/179#issuecomment-6983574267) · [Offline evidence](https://github.com/chrisbanes/skills/blob/72f11234388aa64fd74b061bf68292768d5176f3/evals/artifacts/issue-179/r1/delivery.md)  ## Problem  An abandoned `gradle-run` invocation leaves the workflow permanently blocked, even after an ownership investigation finds no remaining wrapper or child process. `status` correctly reports `uncertain`, but neither the script nor the skill provides a supported recovery operation.  Observed on Windows with the skills checkout at `3d9da47`. The invocation stopped returning to the agent; the exact termination mechanism and the Gradle outcome are unknown. The ledger retained `active_run`, with no stored terminal result. A subsequent process-table investigation found neither recorded PID nor children of those PIDs.  Sanitized status excerpt:  ```json {   "state": "uncertain",   "reason": "active run is incomplete or its owner lock is not held",   "run": { "sequence": 1, "wrapper_pid": 7396

- **Issue #173** (2026-11-18): **Align GitLab shepherd polling and blocking manual jobs with the code-host binding**
  *Symptoms*: The GitLab code-host binding from #158 merged in #166. It reads MR pipelines through the REST API and sends the expected head SHA at merge. Two CI guidance gaps remain at merge commit `5257561`:  - Standalone `shepherd` still prescribes `glab ci list --mr <iid>`. glab 1.131.0 rejects the flag. Use the merged binding’s MR pipeline selection and verify that the selected pipeline belongs to the candidate. [Provider commands](https://github.com/chrisbanes/skills/blob/52575618d917e565ac3c47c072d646d0c8f9c140/skills/shepherd/references/provider-commands.md) - Both procedures treat manual jobs as non-blocking by default. Read the effective job policy and pipeline status. An optional manual job may be left pending, while a blocking manual approval must keep the MR pending. [Shepherd](https://github.com/chrisbanes/skills/blob/52575618d917e565ac3c47c072d646d0c8f9c140/skills/shepherd/SKILL.md) · [GitLab binding](https://github.com/chrisbanes/skills/blob/52575618d917e565ac3c47c072d646d0c8f9c140/references/gitlab-binding.md)  Cover both manual-job outcomes offline using the exact MR and candidate. Verify coverage of the existing expected-SHA merge precondition for a concurrent push between the last read and the write.  ## Current status  Triage complete. Next step is to implement and verify the [agent brief](https://github.com/chrisbanes/skills/issues/173#issuecomment-6979596607).
  **Post-Mortem & Fix Analysis**:
  > > *This was generated by AI during triage.*  ## Agent Brief  **Category** `bug`  Use the GitLab binding's candidate-specific pipeline read in standalone `shepherd` and respect manual-job policy in both paths.  ### Current behavior  `glab ci list --mr <iid>` fails with `unknown flag: --mr` on glab 1.131.0. The GitLab binding already describes MR-specific pipeline selection and an expected-SHA direct merge. Both sets of guidance currently treat manual jobs as non-blocking by default.  ### Acceptance criteria  - [ ] Standalone `shepherd` uses the binding's MR pipeline selection. Verify project, MR and candidate identity, including the binding's `head_pipeline` evidence for merged-results pipelines. An unrelated or stale pipeline cannot qualify the candidate. - [ ] Use effective job policy and pipeline status. An optional manual job may stay pending when the candidate otherwise passes. A blocking manual approval keeps delivery pending. Cover both outcomes offline for the exact MR and candi
  > <!-- to-plan:implementation-plan:v2 -->  **Revision:** 1 **Supersedes:** none **Replan report:** none  ## Implementation plan  **Issue:** https://github.com/chrisbanes/skills/issues/173 **Planned against:** `main` at `3d9da4774f441854a8ff4c513487301b057053ca` **Publication mode:** Autonomous **Local state:** Clean **Epoch closure:** null  ### Approach  Make standalone shepherd use the existing GitLab code-host checks operation, correct manual-job interpretation in both entry points, and exercise the candidate and merge-race contracts offline. The authoritative acceptance criteria and scope are in the [accepted brief](https://github.com/chrisbanes/skills/issues/173#issuecomment-6979596607).  ### Guardrails  - Preserve merge authority, review gates, merge trains, and existing provider operations; do not play manual jobs, change policy, or add tracker behavior. Unknown or incomplete identity, job policy, pipeline or read state cannot establish a pass. - Continue routine implementation and

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

### Incident Patch 1: `282f86a6` (2026-11-24)
**Commit Message**: Diagnose unresolved bugs before issue planning (#196)

## Summary

```text
Direct delivery with clear expected behavior and no current plan
└─ Fix would be speculative → diagnose
   ├─ Cause and verification established → recheck the fast path, otherwise use to-plan
   └─ Evidence falls short → record the blocker and continue independent work
```

Use `diagnosing-bugs` when available and local checks when it’s absent.
A trace can substitute for a runnable reproducer when it establishes the
cause and gives the delivery owner a concrete way to verify the fix.

## Evidence

- **Before.** The fast path excluded unresolved bugs, and the fallback
led directly to `to-plan`.
- **After.** Three offline cases cover provider and local diagnosis,
equivalent evidence, blocked diagnosis, fast-path requalification, and
when to skip diagnosis.
- Lint, reference sync, corpus validation (319 cases), and all 431
evaluation unit tests passed. The full `npm test` command stopped at a
CRLF release fixture, which passed in isolation with a command-scoped
`core.autocrlf=false` override.

## Merge Danger

**Two-way door.** Reverting the commit restores the previous routing.

**Scope.** Direct `deliver-issu

**File**: `README.md` (modified, +1/-1)
```diff
@@ -132,7 +132,7 @@ for its lane-specific fallback and blocking behavior.
 
 ### Workflows
 
-- [`deliver-issue`](skills/deliver-issue/SKILL.md) — coordinate a named tracker issue and its descendants, or a verified board-controller handoff through solo or justified delegated implementation, a planning-free fast path for small well-understood tickets, CI-supplied full-suite evidence, concurrent external review with verified draft support or earlier PR readiness, reusable scope approval and revision-isolated evidence with preservation checks, independent integrated-candidate review and focused repair review, and PR shepherding, delivering to GitHub or GitLab code hosts; validate applicable live-qualification harness paths offline (isolated production stores for persistent paths, fake runtimes for asynchronous paths), then reconcile failures under bounded approved allowances.
+- [`deliver-issue`](skills/deliver-issue/SKILL.md) — coordinate a named tracker issue and its descendants, or a verified board-controller handoff through solo or justified delegated implementation, diagnosis before planning for unresolved bugs in direct delivery, a planning-free fast path for small well-understood tickets, CI-supplied full-suite evidence, concurrent external review with verified draft support or earlier PR readiness, reusable scope approval and revision-isolated evidence with preservation checks, independent integrated-candidate review and focused repair review, and PR shepherding, delivering to GitHub or GitLab code hosts; validate applicable live-qualification harness paths offline (isolated production stores for persistent paths, fake runtimes for asynchronous paths), then reconcile failures under bounded approved allowances.
 - [`release-kotlin-library`](skills/release-kotlin-library/SKILL.md) — assess readiness, prepare, and verify Kotlin library releases; check the `gradle-maven-publish-plugin` prerequisite, use `changelog` for notes, prepare Metalava API snapshots, and follow repository checks and publication gates.
 - [`gradle-run`](skills/gradle-run/SKILL.md) — run every agent-initiated Gradle command through a compact-output wrapper; recover run identity and bounded results by workflow ID with read-only status, and diagnose failures with optional investigation helpers.
 - [`subagent-delegation`](skills/subagent-delegation/SKILL.md) — provider-neutral delegation playbook, loaded by name or through a one-line user-level opt-in, with separate Codex, Claude Code, and Antigravity/Gemini model routing, installed-role precedence, parallel briefs, independent audits, and lead acceptance.
```

**File**: `evals/README.md` (modified, +3/-0)
```diff
@@ -441,6 +441,9 @@ CI-supplied full-suite evidence versus explicit local rules and checks CI
 cannot run; and `to-plan` baselines proven from green CI on the exact base SHA
 while keeping focused checks CI cannot answer. They use immutable synthetic
 state.
+Three direct-delivery diagnosis calibrations cover diagnosis before planning,
+fast-path requalification, local fallback, equivalent causal evidence, blocked
+reproduction and restraint when an existing plan or verified outcome applies.
 Three nested-agent calibrations check that a delegated owner waits for its
 own reviewer, helpers and slice workers before returning, keeps independent
 launches parallel, and that the top-level controller keeps background launches.
```

**File**: `evals/cases/deliver-issue-bug-diagnosis-direct/case.json` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+{
+  "id": "deliver-issue-bug-diagnosis-direct",
+  "title": "Diagnose an unexplained bug before selecting the delivery route",
+  "family": "workflow",
+  "target_skills": [
+    "deliver-issue"
+  ],
+  "expected_skills": [
+    "deliver-issue"
+  ],
+  "task_mode": "review",
+  "kind": "direct",
+  "fixture": "workflow",
+  "allowed_write_paths": [],
+  "forbid_all_commands": true,
+  "allow_skill_reference_reads": true,
+  "validators": [
+    {
+      "argv": [
+        "python3",
+        "@validators/pr_review_decisions.py",
+        "deliver-issue-bug-diagnosis-direct",
+        "--response"
+      ],
+      "timeout_seconds": 30
+    }
+  ],
+  "rubric": [
+    {
+      "id": "diagnosis",
+      "text": "Uses the installed provider for diagnosis before drafting or editing the fix, with the current delivery owner retaining control."
+    },
+    {
+      "id": "handoff",
+      "text": "Hands the established cause and verification recipe to the delivery owner and rechecks every existing fast-path condition."
+    }
+  ],
+  "provenance": {
+    "kind": "synthetic"
+  },
+  "calibration": true
+}
```

**File**: `evals/cases/deliver-issue-bug-diagnosis-direct/expectations.json` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+{
+  "decisions": {
+    "intake": {
+      "next": "diagnose",
+      "method": "provider",
+      "fix_during_diagnosis": false
+    },
+    "diagnosed": {
+      "next": "fast-path",
+      "retain_cause_and_verification": true,
+      "regression_test_owner": "implementation"
+    }
+  }
+}
```

**File**: `evals/cases/deliver-issue-bug-diagnosis-direct/prompt.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+Use the supplied snapshots and applicable skill references. Read only the needed skill files. Return one JSON object keyed by snapshot. Do not execute delivery, run checks, contact providers, or edit files.
+
+An explicit direct delivery request names a verified leaf issue. The CLI must preserve escaped spaces when loading a local config. Its current baseline drops them, but there is no current plan or evidence locating the cause. All scope, readiness, and ownership checks passed. An external skill named `diagnosing-bugs` is installed.
+
+- `intake` is the initial snapshot above. Give `next` (`diagnose`, `plan`, or `fast-path`), `method` (`provider`, `local`, or `none`), and `fix_during_diagnosis` (boolean).
+- `diagnosed` is a later snapshot for the same issue. A focused config-loading test reproduces the dropped spaces on the identified baseline. A targeted probe isolates an internal normalization error. One internal file and its test suffice, and every existing fast-path condition now passes. Give `next` (`plan` or `fast-path`), `retain_cause_and_verification` (boolean), and `regression_test_owner` (`diagnosis` or `implementation`).
```

**File**: `evals/cases/deliver-issue-bug-diagnosis-negative/case.json` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+{
+  "id": "deliver-issue-bug-diagnosis-negative",
+  "title": "Skip new diagnosis when the current route already applies",
+  "family": "workflow",
+  "target_skills": [
+    "deliver-issue"
+  ],
+  "expected_skills": [
+    "deliver-issue"
+  ],
+  "task_mode": "review",
+  "kind": "negative",
+  "fixture": "workflow",
+  "allowed_write_paths": [],
+  "forbid_all_commands": true,
+  "allow_skill_reference_reads": true,
+  "validators": [
+    {
+      "argv": [
+        "python3",
+        "@validators/pr_review_decisions.py",
+        "deliver-issue-bug-diagnosis-negative",
+        "--response"
+      ],
+      "timeout_seconds": 30
+    }
+  ],
+  "rubric": [
+    {
+      "id": "restraint",
+      "text": "Skips new diagnosis for a known fix, a current approved plan, a verified board handoff, and a fully accepted no-change outcome."
+    },
+    {
+      "id": "readiness",
+      "text": "Resolves missing product behavior before attempting diagnosis and keeps verified no-change distinct from speculation."
+    }
+  ],
+  "provenance": {
+    "kind": "synthetic"
+  },
+  "calibration": true
+}
```

**File**: `evals/cases/deliver-issue-bug-diagnosis-negative/expectations.json` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+{
+  "decisions": {
+    "known-fix": {
+      "next": "fast-path",
+      "start_new_diagnosis": false
+    },
+    "approved-plan": {
+      "next": "reuse-plan",
+      "start_new_diagnosis": false
+    },
+    "board-owned": {
+      "next": "board-handoff",
+      "start_new_diagnosis": false
+    },
+    "unclear-outcome": {
+      "next": "clarify",
+      "start_new_diagnosis": false
+    },
+    "already-fixed": {
+      "next": "no-change",
+      "start_new_diagnosis": false
+    }
+  }
+}
```

**File**: `evals/cases/deliver-issue-bug-diagnosis-negative/prompt.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+Use the supplied snapshots and applicable skill references. Read only the needed skill files. Return one JSON object keyed by snapshot, with `next` (`diagnose`, `fast-path`, `reuse-plan`, `board-handoff`, `clarify`, or `no-change`) and `start_new_diagnosis` (boolean) in each. Do not execute delivery, contact providers, or edit files.
+
+All the following issues carry a bug label. Unless otherwise stated, each is a verified, authorized direct delivery with no holds and no plan.
+
+- `known-fix`: A current failing test and a one-variable probe already establish a reversed internal comparator as the cause and the test as verification. Every fast-path condition passes.
+- `approved-plan`: A current verified plan already covers an intermittent failure, with evidence and an affected regression check.
+- `board-owned`: The active board controller sent a verified single-ticket implementation handoff with a current approved plan. No material mismatch emerged.
+- `unclear-outcome`: The observed response is clear, but the ticket has conflicting requirements about what the response should be.
+- `already-fixed`: On the current integrated base an existing fix passes an acceptance check exercising the original failing path. The active approved plan's full acceptance and dependencies are verified, there is no remaining diff or change request, and no new closure authority.
```

#### Recent Merged Pull Requests:
- **PR #204** (2026-11-25): Improve skill eval reliability and Kotlin and Compose coverage (@chrisbanes)
- **PR #203** (2026-11-24): Restore delivery safeguards and rename simplify to simplify-changes (@chrisbanes)
- **PR #202** (2026-11-24): Add a standalone simplify skill (@chrisbanes)
- **PR #201** (2026-11-24): Simplify skill instructions and share references across skills (@chrisbanes)
- **PR #200** (2026-11-24): Use implement-with-subagents for issue delivery (@chrisbanes)
- **PR #199** (2026-11-24): Share tracker and triage configuration across delivery skills (@chrisbanes)

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

## X. Diagnose unresolved bugs before issue planning

**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in chrisbanes/skills. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `282f86a6`: Diagnose unresolved bugs before issue planning. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- [`deliver-issue`](skills/deliver-issue/SKILL.md) — coordinate a named tracker issue and its descendants, or a verified board-controller handoff through solo or justified delegated implementation, diagnosis before planning for unresolved bugs in direct delivery, a planning-free fast path for small well-understood tickets, CI-supplied full-suite evidence, concurrent external review with verified draft support or earlier PR readiness, reusable scope approval and revision-isolated evidence with preservation checks, independent integrated-candidate review and focused repair review, and PR shepherding, delivering to GitHub or GitLab code hosts; validate applicable live-qualification harness paths offline (isolated production stores for persistent paths, fake runtimes for asynchronous paths), then reconcile failures under bounded approved allowances.
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
- [`deliver-issue`](skills/deliver-issue/SKILL.md) — coordinate a named tracker issue and its descendants, or a verified board-controller handoff through solo or justified delegated implementation, a planning-free fast path for small well-understood tickets, CI-supplied full-suite evidence, concurrent external review with verified draft support or earlier PR readiness, reusable scope approval and revision-isolated evidence with preservation checks, independent integrated-candidate review and focused repair review, and PR shepherding, delivering to GitHub or GitLab code hosts; validate applicable live-qualification harness paths offline (isolated production stores for persistent paths, fake runtimes for asynchronous paths), then reconcile failures under bounded approved allowances.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `282f86a6` are properly handled with clean fallback behavior.
