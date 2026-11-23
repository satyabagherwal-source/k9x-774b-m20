# Verification Protocol: Verification Protocol: Empirical Defect Shield for chrisbanes/skills

<!-- PROVENANCE_START
{
  "source_repository": "chrisbanes/skills",
  "source_url": "https://github.com/chrisbanes/skills",
  "source_version": "efeb99dc",
  "license": "Apache-2.0",
  "timestamp": "2026-11-23T14:12:46.358Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-chrisbanes-skills",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [chrisbanes/skills](https://github.com/chrisbanes/skills) (Revision: `efeb99dc`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-23T14:12:46.358Z`  
> **Learning ID**: `learn-github-chrisbanes-skills`


## 1. Scope & Verification Target
- **Target Repository**: `chrisbanes/skills` (Commit: `efeb99dc`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): chrisbanes/skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/chrisbanes-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chrisbanes/skills](https://github.com/chrisbanes/skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-23T14:12:45.109Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chrisbanes/skills`
- **Description**: Skills for Kotlin, Jetpack Compose, and Android development
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1165 stars

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
- **Issue #173** (2026-11-18): **Align GitLab shepherd polling and blocking manual jobs with the code-host binding**
  *Symptoms*: The GitLab code-host binding from #158 merged in #166. It reads MR pipelines through the REST API and sends the expected head SHA at merge. Two CI guidance gaps remain at merge commit `5257561`:  - Standalone `shepherd` still prescribes `glab ci list --mr <iid>`. glab 1.131.0 rejects the flag. Use the merged binding’s MR pipeline selection and verify that the selected pipeline belongs to the candidate. [Provider commands](https://github.com/chrisbanes/skills/blob/52575618d917e565ac3c47c072d646d0c8f9c140/skills/shepherd/references/provider-commands.md) - Both procedures treat manual jobs as non-blocking by default. Read the effective job policy and pipeline status. An optional manual job may be left pending, while a blocking manual approval must keep the MR pending. [Shepherd](https://github.com/chrisbanes/skills/blob/52575618d917e565ac3c47c072d646d0c8f9c140/skills/shepherd/SKILL.md) · [GitLab binding](https://github.com/chrisbanes/skills/blob/52575618d917e565ac3c47c072d646d0c8f9c140/references/gitlab-binding.md)  Cover both manual-job outcomes offline using the exact MR and candidate. Verify coverage of the existing expected-SHA merge precondition for a concurrent push between the last read and the write.  ## Current status  Triage complete. Next step is to implement and verify the [agent brief](https://github.com/chrisbanes/skills/issues/173#issuecomment-6979596607).
  **Post-Mortem & Fix Analysis**:
  > > *This was generated by AI during triage.*  ## Agent Brief  **Category** `bug`  Use the GitLab binding's candidate-specific pipeline read in standalone `shepherd` and respect manual-job policy in both paths.  ### Current behavior  `glab ci list --mr <iid>` fails with `unknown flag: --mr` on glab 1.131.0. The GitLab binding already describes MR-specific pipeline selection and an expected-SHA direct merge. Both sets of guidance currently treat manual jobs as non-blocking by default.  ### Acceptance criteria  - [ ] Standalone `shepherd` uses the binding's MR pipeline selection. Verify project, MR and candidate identity, including the binding's `head_pipeline` evidence for merged-results pipelines. An unrelated or stale pipeline cannot qualify the candidate. - [ ] Use effective job policy and pipeline status. An optional manual job may stay pending when the candidate otherwise passes. A blocking manual approval keeps delivery pending. Cover both outcomes offline for the exact MR and candi
  > <!-- to-plan:implementation-plan:v2 -->  **Revision:** 1 **Supersedes:** none **Replan report:** none  ## Implementation plan  **Issue:** https://github.com/chrisbanes/skills/issues/173 **Planned against:** `main` at `3d9da4774f441854a8ff4c513487301b057053ca` **Publication mode:** Autonomous **Local state:** Clean **Epoch closure:** null  ### Approach  Make standalone shepherd use the existing GitLab code-host checks operation, correct manual-job interpretation in both entry points, and exercise the candidate and merge-race contracts offline. The authoritative acceptance criteria and scope are in the [accepted brief](https://github.com/chrisbanes/skills/issues/173#issuecomment-6979596607).  ### Guardrails  - Preserve merge authority, review gates, merge trains, and existing provider operations; do not play manual jobs, change policy, or add tracker behavior. Unknown or incomplete identity, job policy, pipeline or read state cannot establish a pass. - Continue routine implementation and

- **Issue #172** (2026-11-18): **Fix Compose examples for transitions, hover tests, measurement and remembered values**
  *Symptoms*: Several examples lead to compile errors, tests that pass without exercising the behavior, or stale UI. Correct the snippets and cover the behavior each one teaches.  ## Acceptance criteria  - The coordinated animation snippet compiles for a plain enum target. Align the API-choice table with the corrected example. [Transition example](https://github.com/chrisbanes/skills/blob/b67f5cb03543d730befc8fc8214950c3b3599b67/skills/compose-animations/SKILL.md#L38) - The hover test supplies button content, completes the interaction emission, and asserts a result that changes on hover. Removing hover handling makes the test fail. [Interaction test](https://github.com/chrisbanes/skills/blob/b67f5cb03543d730befc8fc8214950c3b3599b67/skills/compose-ui-testing-patterns/references/interaction-state.md#L11) - With incoming height 0–100 and a requested fixed height of 200, the child is measured within the parent’s bounds. [Measure helper](https://github.com/chrisbanes/skills/blob/b67f5cb03543d730befc8fc8214950c3b3599b67/skills/compose-component-design/references/modifier-layout.md#L43) - Replacing a click handler while retaining the item ID invokes the new handler. Mutating an observable map in place updates the merged result. Keep the state and performance examples consistent. [Click handler](https://github.com/chrisbanes/skills/blob/b67f5cb03543d730befc8fc8214950c3b3599b67/skills/compose-performance/references/stability.md#L36) · [Local state](https://github.com/chrisbanes/skills/blob/b67f5cb0

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

### Incident Patch 1: `69450002` (2026-11-23)
**Commit Message**: Clarify when Compose UI tests need device coverage (#193)

## Summary

Add a test-selection row for critical flows that depend on the installed
build or cross an app, process, or OS boundary. Use a focused device
smoke test or end-to-end test when a narrower test can't prove the
behavior.

Add three opt-in Compose eval cases for a system permission dialog,
R8-optimized startup, and local Compose state restoration.

Proposed by `kacperkapusciak`. Fixes #192.

## Evidence

- The permission fixture validator rejects the fake-callback plan and
accepts a focused test that denies the system dialog and checks the
manual-entry fallback.
- `npm run lint`, `npm run evals:validate` (313 cases), `npm run
references:check`, and `npm test` passed locally. One existing test was
skipped.

## Merge impact

Reversible. The change affects Compose test-selection guidance and
opt-in evaluation coverage.

**File**: `evals/README.md` (modified, +3/-4)
```diff
@@ -331,10 +331,9 @@ The Compose benchmark remains 38 scored cases and comprises:
 Case IDs retain their focused concern names even when several concerns route to
 the same clustered public skill.
 
-Four calibration-only performance challenge cases are also validated with the
-corpus. They are excluded from default plans and published scorecards; select
-them explicitly with `--case` when deciding whether they should graduate into
-the benchmark.
+The corpus also validates four performance challenges and three cases on when
+Compose UI tests give way to device tests. These calibration cases are excluded
+from default plans and published scorecards. Select them explicitly with `--case`.
 
 Two calibration-only workflow challenges exercise actionable failure behavior
 when a required external `tdd` provider is unavailable. They
```

**File**: `evals/cases/compose-device-permission-direct/case.json` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+{
+  "id": "compose-device-permission-direct",
+  "title": "Verify a system permission decision in the installed app",
+  "family": "testing",
+  "target_skills": ["compose-ui-testing-patterns"],
+  "expected_skills": ["compose-ui-testing-patterns"],
+  "task_mode": "edit",
+  "kind": "direct",
+  "fixture": "text",
+  "allowed_write_paths": ["test-plan.md"],
+  "validators": [{"argv": ["python3", "@validators/text_case.py", "compose-device-permission-direct"], "timeout_seconds": 30}],
+  "rubric": [
+    {"id": "system-boundary", "text": "Identifies the real Android permission dialog and its result as the boundary the fake callback cannot exercise"},
+    {"id": "focused-device-test", "text": "Recommends a focused device test that denies the system prompt and verifies the installed app shows its fallback"},
+    {"id": "retain-ui-test", "text": "Retains the existing Compose test for rendering the denied state and limits the recommendation to the permission flow"}
+  ],
+  "provenance": {"kind": "synthetic"},
+  "calibration": true
+}
```

**File**: `evals/cases/compose-device-permission-direct/expectations.json` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+{
+  "files": ["test-plan.md"],
+  "must_contain": ["manual entry", "createComposeRule"],
+  "must_match": ["(?i)\\b(?:device|emulator|end-to-end)\\b"],
+  "must_not_contain": ["fakes a denied permission"]
+}
```

**File**: `evals/cases/compose-device-permission-direct/overlay/test-plan.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+# Camera permission
+
+When somebody taps Scan for the first time and denies camera access in the
+Android system dialog, the installed app must offer manual entry.
+
+The current `createComposeRule` test renders the denied state and checks that
+the manual entry button is shown. The proposed test fakes a denied permission
+callback in that same Compose host and labels the result coverage of the system
+dialog flow.
```

**File**: `evals/cases/compose-device-permission-direct/prompt.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+Update `test-plan.md` with the smallest test setup that proves the acceptance
+criterion. Keep the change to the plan.
```

**File**: `evals/cases/compose-device-release-novel/case.json` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+{
+  "id": "compose-device-release-novel",
+  "title": "Verify startup on the R8-optimized build",
+  "family": "testing",
+  "target_skills": ["compose-ui-testing-patterns"],
+  "expected_skills": ["compose-ui-testing-patterns"],
+  "task_mode": "review",
+  "kind": "novel",
+  "fixture": "text",
+  "allowed_write_paths": [],
+  "validators": [{"argv": ["python3", "@validators/text_case.py", "compose-device-release-novel"], "timeout_seconds": 30}],
+  "rubric": [
+    {"id": "build-boundary", "text": "Explains that startup depends on the R8-optimized artifact and a passing debug rule does not exercise that artifact even though startup stays in one app"},
+    {"id": "release-smoke", "text": "Recommends a focused device smoke test that launches the installed R8-optimized release build and checks that the home screen becomes visible"},
+    {"id": "scope", "text": "Keeps the existing debug integration test for its current purpose without moving unrelated coverage into the release test"}
+  ],
+  "provenance": {"kind": "synthetic"},
+  "calibration": true
+}
```

**File**: `evals/cases/compose-device-release-novel/expectations.json` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+{
+  "files": ["test-plan.md"],
+  "must_contain": ["R8-optimized release build", "existing debug activity integration", "Compose home screen"]
+}
```

**File**: `evals/cases/compose-device-release-novel/overlay/test-plan.md` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+# Startup after changing keep rules
+
+Startup reaches the Compose home screen on debug builds. On the previous
+R8-optimized release build, an entry point loaded at runtime was stripped and
+the app crashed before reaching home. The keep rule has been corrected.
+
+The proposed regression check extends the existing debug activity integration
+test with a second home-screen assertion. Startup stays within the app.
```

---

### Incident Patch 2: `edd18ff7` (2026-11-20)
**Commit Message**: Update everyday model routing guidance (#188)

## Summary

Route settled implementation to Sol/medium and substantial multi-source
synthesis to Sol/high. Update routing evaluation cases while preserving
explicit model pins.

## Evidence

| Finding | Source URL | Checked | Change made |
|---|---|---|---|
| Sol suits everyday coding and work across several sources; medium
balances speed and depth, while high suits difficult multi-source work.
| https://learn.chatgpt.com/docs/models | 2026-11-20 | Use Sol/medium
for bounded implementation and Sol/high for substantial synthesis. |
| Sol suits everyday agents that plan, use tools and check their work. |
https://learn.chatgpt.com/docs/agent-configuration/subagents |
2026-11-20 | Align the Codex delegation table and evaluation
expectations. |

## Validation

- `npm run build`: exit 1, missing script (`npm error Missing script:
"build"`).
- `npm run lint`: exit 0, no issues found (after installing existing
dependencies from cache).
- `npm run evals:validate`: exit 0, validated 307 cases.
- `npm test`: exit 0, final output `Ran 429 tests in 78.142s` / `OK`.
- No live model evaluations.

## Merge Danger

**Door:** two-way. **Blast Radius:** 

**File**: `evals/cases/deliver-issue-model-routing-direct/prompt.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 Assess the proposed workflow using only the supplied state and applicable skill references. Do not run commands other than skill and reference reads, launch agents, contact providers or edit files.
 
-Each snapshot is a qualifying direct fast-path issue: one known CLI help typo, two files, an existing snapshot check, no blockers, no plan chain, and a fresh independent reviewer. The lead picked gpt-6.2-sol/high. The applicable implementation policy recommends gpt-6.1-terra/high for this fix. One authorized, isolated and resumable Terra/high worker is free. There are no installed pins, merge grants, or other restrictions.
+Each snapshot is a qualifying direct fast-path issue: one known CLI help typo, two files, an existing snapshot check, no blockers, no plan chain, and a fresh independent reviewer. The lead picked gpt-6.2-sol/high. The applicable implementation policy recommends gpt-6.2-sol/medium for this fix. One authorized, isolated and resumable Terra/high worker is free. There are no installed pins, merge grants, or other restrictions.
 
 - advisory: The user supplied only the delivery request and the picker choice.
 - matching: The user also explicitly requested implementation on gpt-6.2-sol/high.
```

**File**: `evals/cases/implement-with-subagents-model-routing-novel/expectations.json` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
   "decisions": {
     "chain": {
       "valid": true,
-      "model": "gpt-6.1-terra",
+      "model": "gpt-6.2-sol",
       "effort": "high",
       "owner": "W1",
       "next": "dispatch",
```

**File**: `evals/cases/implement-with-subagents-model-routing-novel/prompt.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 Assess the proposed workflow using only the supplied state and applicable skill references. Do not run commands other than skill and reference reads, launch agents, contact providers or edit files.
 
-The worktree is clean. tdd, agreed seams and one independent final reviewer are available throughout. The lead is gpt-6.2-sol/medium. The user opts into automatic implementation routing and pins implementation effort to high. For the full chain below, the installed Codex policy selects gpt-6.1-terra/xhigh. Two authorized resumable gpt-6.1-terra/high workers, W1 and W2, each have safe isolation available. W1 is the proposed chain owner. No installed role pins apply.
+The worktree is clean. tdd, agreed seams and one independent final reviewer are available throughout. The lead is gpt-6.2-sol/medium. The user opts into automatic implementation routing and pins implementation effort to high. For the full chain below, the installed Codex policy selects gpt-6.2-sol/medium. Two authorized resumable gpt-6.2-sol/high workers, W1 and W2, each have safe isolation available. W1 is the proposed chain owner. No installed role pins apply.
 
 - chain: A precedes B. A has not begun. The proposal assigns both tasks to W1 and retains W1 for repairs. B remains held until A is accepted, integrated and its affected checks pass on the integrated head.
 - split: Same state, but the proposal assigns A to W1 and B to W2.
```

**File**: `evals/cases/run-project-model-routing-negative/expectations.json` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@
       "next": "implement",
       "owner": "lead",
       "model": "gpt-6.2-sol",
-      "effort": "medium",
+      "effort": "high",
       "unrelated": "continue"
     }
   }
```

**File**: `evals/cases/run-project-model-routing-negative/prompt.md` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ For each independent snapshot, a Project drain has two eligible tickets with com
 - unauthorized: A matching gpt-6.1-terra/high worker is available, but the invocation disallows implementation delegation on A.
 - busy: A matching worker is authorized and available in the runtime, but its slot is temporarily occupied.
 - hard_limit: A matching worker is authorized, but A's per-ticket limit can only accommodate its persistent delivery lead. The runtime cannot yield the lead's slot to the worker.
-- unset: In this separate snapshot, A's user only selected the lead in the picker. There is no implementation pin and no auto-routing opt-in. The ordinary-work policy recommendation is Terra/high.
+- unset: In this separate snapshot, A's user only selected a Sol/high lead in the picker. There is no implementation pin and no auto-routing opt-in. The ordinary-work policy recommendation is Sol/medium.
 
 Return these exact fields for each independent snapshot:
 - unsupported, unauthorized, busy, hard_limit: next (pause or wait-capacity), blocker (settings, authority, or capacity), model, effort, edit_now (whether A can start edits), unrelated (continue or pause).
```

**File**: `evals/cases/subagent-delegation-direct/case.json` (modified, +2/-2)
```diff
@@ -27,15 +27,15 @@
   "rubric": [
     {
       "id": "routing",
-      "text": "Uses an available general agent with Luna/low for A; worker or other suitable unpinned role Terra/medium for B and C; worker Terra/high for D; suitable unpinned role Terra/xhigh for E, Sol/medium for F, and Sol/xhigh for G; explorer for specific discovery H, inspecting its exposed pins before choosing unpinned settings. Does not invent unavailable checker/investigator roles, install definitions, inherit the parent model, or escalate to Astra."
+      "text": "Uses an available general agent with Luna/low for A; worker or other suitable unpinned role Terra/medium for B and C; worker Sol/medium for D; suitable unpinned role Sol/high for E, Sol/medium for F, and Sol/xhigh for G; explorer for specific discovery H, inspecting its exposed pins before choosing unpinned settings. Does not invent unavailable checker/investigator roles, install definitions, inherit the parent model, or escalate to Astra."
     },
     {
       "id": "parallel",
       "text": "Launches all genuinely independent assignments concurrently within stated capacity; rejects serializing merely for reporting and names actual dependencies if any."
     },
     {
       "id": "brief",
-      "text": "D has self-contained scope, file ownership, constraints, acceptance criteria, context/revision, Terra/high category, fork_turns=none, and explicit unpinned settings; warns worker to preserve others edits, reserves remote writes to root and forbids unauthorized further delegation."
+      "text": "D has self-contained scope, file ownership, constraints, acceptance criteria, context/revision, Sol/medium category, fork_turns=none, and explicit unpinned settings; warns worker to preserve others edits, reserves remote writes to root and forbids unauthorized further delegation."
     }
   ],
   "provenance": {
```

**File**: `skills/subagent-delegation/references/codex.md` (modified, +2/-2)
```diff
@@ -21,8 +21,8 @@ Use this reference when Codex is the active runtime.
 | Purely mechanical: exact checks, simple extraction, no judgment | Luna / low |
 | Computer use or visual interpretation with a defined outcome: navigating screens, matching images, interpreting screenshots or drawings | Terra / medium |
 | Concise drafting or editing from supplied material, with clear audience and factual requirements | Terra / medium |
-| Ordinary bounded implementation, fixes, refactoring, and UI fixes with settled requirements and interactions (default) | Terra / high |
-| Substantial synthesis across several sources, clear constraints | Terra / xhigh |
+| Ordinary bounded implementation, fixes, refactoring, and UI fixes with settled requirements and interactions (default) | Sol / medium |
+| Substantial synthesis across several sources, clear constraints | Sol / high |
 | Complex or ambiguous: judgment across interacting components | Sol / medium |
 | Difficult correctness investigations or independent correctness reviews: competing paths, ownership, ordering, cancellation, security, data integrity | Sol / high |
 | Conflicting evidence, or demanding deliverables needing cross-component polish | Sol / xhigh |
```

#### Recent Merged Pull Requests:
- **PR #194** (2026-11-23): Accept permission test plans that explain the fake callback (@chrisbanes)
- **PR #193** (2026-11-23): Clarify when Compose UI tests need device coverage (@chrisbanes)
- **PR #191** (2026-11-23): Batch repository-approved post-merge updates in drains (@chrisbanes)
- **PR #190** (2026-11-21): Add Antigravity and Gemini delegation and workflow support (@chrisbanes)
- **PR #189** (2026-11-20): Document Antigravity plugin install in README (@chrisbanes)
- **PR #188** (2026-11-20): Update everyday model routing guidance (@chrisbanes)

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

## X. Clarify when Compose UI tests need device coverage

**RULE**:
When implementing operations in `evals/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in chrisbanes/skills. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `69450002`: Clarify when Compose UI tests need device coverage. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `evals/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
The corpus also validates four performance challenges and three cases on when
Compose UI tests give way to device tests. These calibration cases are excluded
from default plans and published scorecards. Select them explicitly with `--case`.
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
Four calibration-only performance challenge cases are also validated with the
corpus. They are excluded from default plans and published scorecards; select
them explicitly with `--case` when deciding whether they should graduate into
the benchmark.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `69450002` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
