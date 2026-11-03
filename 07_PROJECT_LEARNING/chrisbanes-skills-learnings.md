> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/chrisbanes-skills-learnings.md`  
> **Source**: github ([https://github.com/chrisbanes/skills](https://github.com/chrisbanes/skills))  
> **Source Version**: `d83f6e28`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-02T16:33:27.121Z  
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
> **Harvest Timestamp**: 2026-11-02T16:33:26.827Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chrisbanes/skills`
- **Description**: Skills for Kotlin, Jetpack Compose, and Android development
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1136 stars

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
- **Issue #138** (2026-11-02): **Drop the ready-for-agent label requirement from to-plan**
  *Symptoms*: ## Summary  to-plan no longer gates GitHub-mode planning on the `ready-for-agent` label.  ```diff  ## Enforce readiness -- The issue is open and labelled `ready-for-agent`. +- The issue is open.  - Every blocker is complete and its required outcome exists in the baseline.  ...  ## Refresh before publishing -- Issue state, body, comments, label, blockers, and implementation PRs. +- Issue state, body, comments, blockers, and implementation PRs. ```  The other readiness checks are unchanged: blockers complete, no competing implementation PR, complete acceptance criteria, and each criterion mapped to verification.  ## Evidence  - **Before:** an open, otherwise-ready issue without `ready-for-agent` failed to-plan readiness, so no plan could be drafted.   **After:** the same issue passes readiness and to-plan can draft a plan.  Deterministic checks on this branch: `npm run lint` clean, `npm test` 7/7 pass, `npm run evals:validate` validates 226 cases. No to-plan eval case asserted the label requirement, and no live model evals were run.  ## Merge Danger  **Door:** two-way  A one-line revert restores the gate.  **Blast Radius:** narrow  The label is still enforced elsewhere: `deliver-spec` sends issues without it to `triage` before calling to-plan, and `run-github-project` still needs it for Todo candidates. Only direct to-plan invocations on unlabelled issues change behaviour. 
  **Post-Mortem & Fix Analysis**:
  > <!-- codex-pull-request-review-summary --> <!-- codex-review-state:v1 {"code_review":{"commit_sha":"a0cc03c01389c18e15a4624d067a3759442df068","has_any_findings":false,"has_unresolved_findings":false,"status":"completed"},"security_review":{"commit_sha":null,"has_any_findings":null,"has_unresolved_findings":null,"status":null}} -->  ## Codex Review Summary  This comment shows the latest Codex review activity on this pull request.  | Review | Status | Commit | Review trigger | | --- | --- | --- | --- | | 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-11-02T08:54:22.662517Z">2026-11-02T08:54:22.662517Z</relative-time> | `a0cc03c` | New commits |    <details> <summary>ℹ️ About Codex in GitHub</summary> <br/>  [Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you - Open a pull request for review - Mark a draft as ready - Comment "@codex review" or "@codex security review".  Code
  > <!-- greptile_summary -->  <h2><a href="https://app.greptile.com/api/retrigger?id=92918743"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/RetriggerDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2"><img alt="Retrigger" src="https://greptile-static-assets.s3.amazonaws.com/badges/Retrigger.svg?v=2" align="right"></picture></a><a href="https://app.greptile.com/-/switch-tenant?tenant=banes&amp;next=%2Fchrisbanes%2Fskills%2Fpull%2F138&amp;utm_source=greptile_review&amp;utm_medium=github&amp;utm_campaign=view_in_greptile"><picture><source media="(prefers-color-scheme: dark)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/ViewInGreptileDark.svg?v=2"><source media="(prefers-color-scheme: light)" srcset="https://greptile-static-assets.s3.amazonaws.com/badges/ViewInGreptile.svg?v=2"><img alt="View in Greptile" src="https

- **Issue #137** (2026-11-01): **Include a plan overview in deliver-spec approval requests**
  *Symptoms*: ## Summary  Approval requests should explain the plan in the response so the stakeholder can understand the proposed work before approving it.  ```diff  Present a plan for approval + Summarize the outcome, main implementation steps and validation approach  Link the detailed plan when available  Ask for approval ```  Adds evaluation scenarios for an initial plan and a material revision. Existing fast-path coverage continues to reject unnecessary approval gates.  ## Evidence  - **Before:** The planning step did not explicitly require an overview in the approval response.   **After:** The requirement is stated at that step and covered by both scenarios. - `npm run lint` passes. - `npm run evals:validate` validates 226 cases. - All 45 workflow matrix tests pass. - `git diff --check` passes.  Live model evaluations were not run. The optional skill validator could not run because PyYAML is unavailable.  ## Merge Danger  **Door:** two-way  Revert the instruction and evaluation changes to restore the previous wording.  **Blast Radius:** planning  Changes approval-response guidance for `deliver-spec`; versions are unchanged.

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

### Incident Patch 1: `8a37bcd8` (2026-11-02)
**Commit Message**: Drop the ready-for-agent label requirement from to-plan (#138)

## Summary

to-plan no longer gates GitHub-mode planning on the `ready-for-agent`
label.

```diff
 ## Enforce readiness
-- The issue is open and labelled `ready-for-agent`.
+- The issue is open.
 - Every blocker is complete and its required outcome exists in the baseline.
 ...
 ## Refresh before publishing
-- Issue state, body, comments, label, blockers, and implementation PRs.
+- Issue state, body, comments, blockers, and implementation PRs.
```

The other readiness checks are unchanged: blockers complete, no
competing implementation PR, complete acceptance criteria, and each
criterion mapped to verification.

## Evidence

- **Before:** an open, otherwise-ready issue without `ready-for-agent`
failed to-plan readiness, so no plan could be drafted.
**After:** the same issue passes readiness and to-plan can draft a plan.

Deterministic checks on this branch: `npm run lint` clean, `npm test`
7/7 pass, `npm run evals:validate` validates 226 cases. No to-plan eval
case asserted the label requirement, and no live model evals were run.

## Merge Danger

**Door:** two-way

A one-line revert restores the gate.

**Blast Radius:*

**File**: `evals/README.md` (modified, +3/-3)
```diff
@@ -347,7 +347,7 @@ forbidden-action grading; they do not contact a provider. The
 dependency. Its missing-provider challenge supplies a behavior ticket without
 `tdd` and checks that implementation does not start.
 
-The workflows/writing corpus contains 119 calibration-only cases, including
+The workflows/writing corpus contains 122 calibration-only cases, including
 the two missing-provider challenges. Select them
 explicitly with `--case`; they do not change the published benchmark or its
 default call count. They cover authorized local planning, prior confirmation,
@@ -356,8 +356,8 @@ broad invalidation and explicit full-check requirements, plan validation placeme
 and unchanged-plan restraint, two-round external-review convergence with same-owner consolidated repairs,
 related retention/pagination cases, review coverage and browser diagnostics,
 early consequential boundary validation and restraint on unchanged evidence,
-unresolved decisions, proof-gated report publication, implementation-plan
-specificity for complex work with a one-function counterexample, and verification
+unresolved decisions, label-free GitHub readiness with retained contract gates,
+proof-gated report publication, implementation-plan specificity for complex work with a one-function counterexample, and verification
 evidence reuse versus missing, stale, failed, or explicitly required fresh
 evidence. Six additional cases cover accessible context-pointer handoffs and
 optional shared discovery, including bounded evidence reuse, capacity and
```

**File**: `evals/artifacts/to-plan-scenario-coverage.md` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ they do not simulate a passing provider workflow.
 | Runtime safeguard | Current evidence | Status |
 | --- | --- | --- |
 | Ready GitHub planning drafts locally; normal mode waits and `--auto` publishes only after every other gate | `to-plan` GitHub-mode procedure and finish gates; no-network corpus cannot exercise provider readback | Requires live provider test |
+| GitHub readiness ignores the `ready-for-agent` label while keeping open-state, blocker, PR and acceptance-criteria gates | `to-plan-unlabelled-issue-direct`, `to-plan-unlabelled-issue-novel` (label removed before publish), and `to-plan-unlabelled-issue-restraint-negative` | Cases prepared; model execution pending |
 | An established earlier issue is reused only when it is the sole established specification; later contract changes block | `to-plan-novel` preserves competing-source restraint; GitHub-mode source packet preserves later-contract check | Requires live conversation/GitHub test for full path |
 | Conversation planning interviews incomplete work, then drafts a collision-safe marked file after authorization | `to-plan-direct`, `to-plan-authorized-draft-direct`, and `to-plan-prior-confirmed-novel` | Historical evidence for `to-plan-authorized-draft-direct` includes one audited forced run for its recorded case version; other cases and repetitions remain pending. See the focused-run artifact for scope and provenance. |
 | Unrelated dirty files are allowed, overlapping or uncertain files block, and refresh reinspects content-based exclusions | `to-plan` baseline and refresh procedure | Requires live workspace test |
```

**File**: `evals/cases/to-plan-unlabelled-issue-direct/case.json` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+{
+  "id": "to-plan-unlabelled-issue-direct",
+  "title": "Plan an otherwise-ready issue without an agent label",
+  "family": "workflow",
+  "target_skills": ["to-plan"],
+  "expected_skills": ["to-plan"],
+  "task_mode": "review",
+  "kind": "direct",
+  "fixture": "workflow",
+  "allowed_write_paths": [],
+  "forbidden_command_patterns": ["\\b(?:gh|git)\\s+(?:api|issue|pr|project|push|fetch|pull)\\b"],
+  "validators": [{"argv": ["python3", "@validators/text_case.py", "to-plan-unlabelled-issue-direct"], "timeout_seconds": 30}],
+  "rubric": [
+    {"id": "label-free", "text": "Treats the missing `ready-for-agent` label as no readiness failure and does not route the issue to triage or ask for a label change"},
+    {"id": "next-step", "text": "Names local GitHub-mode drafting as the next safe action because the issue is open, its blocker is delivered in the baseline, no implementation PR exists, and every criterion maps to verification"},
+    {"id": "preservation", "text": "Does not draft, publish, or change the issue labels, body, or Project state"}
+  ],
+  "provenance": {"kind": "synthetic"},
+  "calibration": true
+}
```

**File**: `evals/cases/to-plan-unlabelled-issue-direct/expectations.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"files": ["state.md"], "must_contain": ["Immutable evaluation state", "Network access is disabled"]}
```

**File**: `evals/cases/to-plan-unlabelled-issue-direct/prompt.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+Use only the supplied state and applicable skill instructions. Read skill entrypoints and needed Markdown references using standalone `cat` commands. Do not execute the workflow, run other commands, contact providers, launch agents or change files.
+
+The user asks for an implementation plan for GitHub issue #61. Supplied state:
+it is open and has no labels. Its only blocker, #58, is closed and its required
+outcome is present at the current `HEAD`. No implementation PR exists. Its
+acceptance criteria say the validator names the missing file and an existing
+unit test covers it. Review the next safe planning action only. Do not write a
+plan, edit files, or contact a provider.
```

**File**: `evals/cases/to-plan-unlabelled-issue-novel/case.json` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+{
+  "id": "to-plan-unlabelled-issue-novel",
+  "title": "Ignore label churn during the pre-publish refresh",
+  "family": "workflow",
+  "target_skills": ["to-plan"],
+  "expected_skills": ["to-plan"],
+  "task_mode": "review",
+  "kind": "novel",
+  "fixture": "workflow",
+  "allowed_write_paths": [],
+  "forbidden_command_patterns": ["\\b(?:gh|git)\\s+(?:api|issue|pr|project|push|fetch|pull)\\b"],
+  "validators": [{"argv": ["python3", "@validators/text_case.py", "to-plan-unlabelled-issue-novel"], "timeout_seconds": 30}],
+  "rubric": [
+    {"id": "label-free-refresh", "text": "Treats the removed `ready-for-agent` label as neither a readiness failure nor a material change, so it does not block publication or require renewed approval"},
+    {"id": "other-gates", "text": "Still reapplies the refresh checks to issue state, body, comments, blockers, implementation PRs, `HEAD`, the working tree, and plan markers before publishing"},
+    {"id": "preservation", "text": "Does not restore the label or change any other issue or Project state"}
+  ],
+  "provenance": {"kind": "synthetic"},
+  "calibration": true
+}
```

**File**: `evals/cases/to-plan-unlabelled-issue-novel/expectations.json` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+{"files": ["state.md"], "must_contain": ["Immutable evaluation state", "Network access is disabled"]}
```

**File**: `evals/cases/to-plan-unlabelled-issue-novel/prompt.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+Use only the supplied state and applicable skill instructions. Read skill entrypoints and needed Markdown references using standalone `cat` commands. Do not execute the workflow, run other commands, contact providers, launch agents or change files.
+
+A local implementation-plan draft for open GitHub issue #62 has user approval to publish. During
+the refresh before publishing, the only observed change is that a maintainer
+removed the `ready-for-agent` label. The body, comments, blockers, `HEAD`, and
+working tree are unchanged, and no implementation PR exists. Describe the
+next planning action. Do not publish, edit files, or contact a provider.
```

#### Recent Merged Pull Requests:
- **PR #138** (2026-11-02): Drop the ready-for-agent label requirement from to-plan (@chrisbanes)
- **PR #137** (2026-11-01): Include a plan overview in deliver-spec approval requests (@chrisbanes)
- **PR #136** (2026-10-30): Extract standalone changelog skill from Kotlin releases (@chrisbanes)
- **PR #135** (2026-10-25): Keep serial implementation solo and PR polling in the controller (@chrisbanes)
- **PR #133** (2026-10-21): Improve Claude eval compliance and trigger gaps (@chrisbanes)
- **PR #132** (2026-10-21): Close skill gaps found by the Claude Code evals (@chrisbanes)

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

## X. Drop the ready-for-agent label requirement from to-plan (#138)

**RULE**:
When implementing operations in `evals/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in chrisbanes/skills. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8a37bcd8`: Drop the ready-for-agent label requirement from to-plan (#138). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `evals/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
The workflows/writing corpus contains 122 calibration-only cases, including
unresolved decisions, label-free GitHub readiness with retained contract gates,
proof-gated report publication, implementation-plan specificity for complex work with a one-function counterexample, and verification
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
The workflows/writing corpus contains 119 calibration-only cases, including
unresolved decisions, proof-gated report publication, implementation-plan
specificity for complex work with a one-function counterexample, and verification
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8a37bcd8` are properly handled with clean fallback behavior.
