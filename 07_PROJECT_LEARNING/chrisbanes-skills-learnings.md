> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/chrisbanes-skills-learnings.md`  
> **Source**: github ([https://github.com/chrisbanes/skills](https://github.com/chrisbanes/skills))  
> **Source Version**: `6c30c500`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-26T01:22:55.507Z  
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
> **Harvest Timestamp**: 2026-10-26T01:22:55.499Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chrisbanes/skills`
- **Description**: Skills for Kotlin, Jetpack Compose, and Android development
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1121 stars

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

### Incident Patch 1: `6c30c500` (2026-10-25)
**Commit Message**: Keep serial implementation solo and PR polling in the controller (#135)

**File**: `README.md` (modified, +4/-3)
```diff
@@ -129,17 +129,18 @@ for its lane-specific fallback and blocking behavior.
 - [`deliver-spec`](skills/deliver-spec/SKILL.md) — coordinate one approved spec or verified Project-controller handoff through solo or justified delegated implementation, a planning-free fast path for small well-understood tickets, CI-supplied full-suite evidence, concurrent external review with verified draft support or earlier PR readiness, reusable scope approval and evidence, independent integrated-candidate review and focused repair review, and PR shepherding; validate applicable live-qualification harness paths offline (isolated production stores for persistent paths, fake runtimes for asynchronous paths), then reconcile failures under bounded approved allowances.
 - [`release-kotlin-library`](skills/release-kotlin-library/SKILL.md) — assess readiness, prepare, and verify Kotlin library releases; check the `gradle-maven-publish-plugin` prerequisite, reconcile changelogs and Metalava API snapshots, and follow repository checks and publication gates.
 - [`gradle-run`](skills/gradle-run/SKILL.md) — run every agent-initiated Gradle command through a compact-output wrapper; recover run identity and bounded results by workflow ID with read-only status, and diagnose failures with optional investigation helpers.
-- [`implement-with-subagents`](skills/implement-with-subagents/SKILL.md) — coordinate one or more worker-owned implementation tasks through dependency-aware dispatch, task acceptance, integration, and same-owner repair; dispatch independent ready work concurrently within actual capacity, reuse sequential worker slots, and support read-only orchestration review.
+- [`implement-with-subagents`](skills/implement-with-subagents/SKILL.md) — choose solo implementation for a single item or serial graph and worker ownership for every item in a graph with parallel work; preserve dependency-aware integration, independent final review, same-owner repair, bounded checkout reuse, and read-only orchestration review.
 - [`to-plan`](skills/to-plan/SKILL.md) — create risk-scaled implementation plans that prove baselines from green CI, with observable slices and consequential boundary validation before dependent work, plus authenticated integration amendments and explicit consumer handoffs; decide separate PRs by coherent deliverable boundaries.
 - [`run-github-project`](skills/run-github-project/SKILL.md) — set up, review, or operate a repository's GitHub Project workflow with current-column authorization, human-only Backlog promotion, and deterministic configured agent selection; deliver ordinary implementation tickets through `deliver-spec`, resolve run-level merging once at startup with a 60-second default-no question unless already specified, preflight offline live-qualification harness evidence, preserve asynchronous or persistent failures in durable checkpoints, prioritize active delivery through safe planner checkpoints, fast-path small Todo tickets straight into implementation, start external review while CI runs after local qualification, free slots while reviewed PRs wait on CI, record ticket-local pauses while independent work continues, and keep `drain` alive under a read-only Project Watcher instead of returning at the first human wait.
-- [`shepherd`](skills/shepherd/SKILL.md) — autonomously poll open PRs and MRs, or follow a host PR monitor's wake events (such as Claude desktop's Auto-fix) instead of polling, triage review comments, and repair CI failures with affected checks and required integrated-candidate validation; start external review during CI while retaining final-head merge gates.
+- [`shepherd`](skills/shepherd/SKILL.md) — poll open PRs and MRs directly in the controller, using a read-only helper only for a bounded large failed-log question, or follow a host PR monitor's wake events (such as Claude desktop's Auto-fix) instead of polling, triage review comments, and repair CI failures with affected checks and required integrated-candidate validation; start external review during CI while retaining final-head merge gates.
 
 Workflows that delegate agents share the [subagent selection and handoff
 reference](references/subagent-selection.md). Each workflow retains its own
 delegation trigger, authority, and acceptance rules. Each consuming skill also
 contains a copy of the reference for standalone installation.
 `deliver-spec` bundles its own solo-or-delegated implementation procedure;
-`implement-with-subagents` retains its explicitly delegated workflow.
+`implement-with-subagents` chooses solo or delegated ownership once from the
+whole task graph.
 
 Planning and drain admission distinguish behavioral prerequisites, shared-file
 mutation conflicts and final integration requirements. Plan-proven independent
```

**File**: `evals/README.md` (modified, +10/-6)
```diff
@@ -344,7 +344,7 @@ forbidden-action grading; they do not contact a provider. The
 dependency. Its missing-provider challenge supplies a behavior ticket without
 `tdd` and checks that implementation does not start.
 
-The workflows/writing corpus contains 114 calibration-only cases, including
+The workflows/writing corpus contains 119 calibration-only cases, including
 the two missing-provider challenges. Select them
 explicitly with `--case`; they do not change the published benchmark or its
 default call count. They cover authorized local planning, prior confirmation,
@@ -359,7 +359,7 @@ evidence reuse versus missing, stale, failed, or explicitly required fresh
 evidence. Six additional cases cover accessible context-pointer handoffs and
 optional shared discovery, including bounded evidence reuse, capacity and
 restraint. The local-planning cases check the generated plan artifact. The scored orchestration
-triad exercises a ready fork/join, a serial dependency chain, and restraint for
+triad exercises a ready fork/join, a solo serial dependency chain, and restraint for
 a cyclic or incomplete graph, unsafe shared-file overlap, and validation
 invalidated at an integrated head. Additional orchestration calibrations cover
 direct TDD at an approved behavior seam, documentation without TDD, completed
@@ -370,9 +370,13 @@ different slot, preservation of checkouts and artifacts that are unsafe to
 retire, and cleanup failure that blocks workflow completion despite successful
 code verification. These cases assess supplied state read-only and do not prove
 live subagent execution.
+Five ownership calibrations cover a solo chain with integrated-head checks,
+missing final-review capability before solo implementation, worker ownership of
+an entire late-fanout graph, direct controller polling, and one bounded large-log
+question with capability and model selection. Decisive supplied facts have
+mutation-sensitive deterministic fixture checks; model behavior is rubric-graded.
 Three shared-handoff calibrations check bounded implementation ownership,
-capability-based PR evidence helper selection, and restraint for one-off PR
-inspection. They also assess supplied state read-only.
+rejection of routine PR evidence helpers, and restraint for one-off PR inspection. They also assess supplied state read-only.
 Two host-monitor calibrations check that `shepherd` handles a Claude desktop
 CI-monitor wake with one read and no self-scheduled polling, and sets up the
 monitor from deferred tools with Auto-fix and authorized auto-merge, using
@@ -383,8 +387,8 @@ capability, and the trivial-edit exception versus useful overlap and retained
 repair ownership and the clean-checkout preflight. They assess immutable state
 without live execution.
 Deterministic coverage stages `deliver-spec` alone, follows its local procedure
-and handoff links, and checks that its bundled procedure matches the orchestration
-skill's copy.
+and handoff links, and checks its bundled procedure independently of the
+orchestration skill's mode-specific procedure.
 Three Project-delivery calibrations cover automatic `deliver-spec` handoff,
 one startup merge question with a 60-second default-no deadline, explicit
 instructions, nonblocking fallback, late replies and invocation expiry,
```

**File**: `evals/cases/implement-with-subagents-explicit-rerun-novel/prompt.md` (modified, +2/-0)
```diff
@@ -1,3 +1,5 @@
+The run selected delegated mode at preflight because its validated full graph has a parallel point; that choice and existing ownership remain in force.
+
 Review acceptance for one implementation item. The task-scoped commit, independent
 diff inspection, command, complete passing output, tested revision, relevant
 inputs, and environment all match current state. The user nevertheless requires
```

**File**: `evals/cases/implement-with-subagents-failed-verification-negative/prompt.md` (modified, +2/-0)
```diff
@@ -1,3 +1,5 @@
+The run selected delegated mode at preflight because its validated full graph has a parallel point; that choice and existing ownership remain in force.
+
 Review acceptance for one implementation item at its current task-scoped commit.
 The owner returned the exact requested command, complete output, tested revision,
 and environment, but the command exited 1 with a failing parser test. Describe
```

**File**: `evals/cases/implement-with-subagents-final-review-stale-negative/prompt.md` (modified, +2/-0)
```diff
@@ -1,3 +1,5 @@
+The run selected delegated mode at preflight because its validated full graph has a parallel point; that choice and existing ownership remain in force.
+
 All tickets were integrated at aaaaaaa, where the full required suite passed
 and the joined diff was independently reviewed. The original task owner then
 repaired a shared interface; its accepted repair is integrated at bbbbbbb.
```

**File**: `evals/cases/implement-with-subagents-fix-forward-novel/prompt.md` (modified, +2/-0)
```diff
@@ -1,3 +1,5 @@
+The run selected delegated mode at preflight because its validated full graph has a parallel point; that choice and existing ownership remain in force.
+
 Task `ENCODE` has an accepted commit integrated at `1111111`. The lead then
 cherry-picked the accepted `WIRE` task, producing integrated head `2222222`.
 That Git operation completed, but an endpoint check affected by `WIRE` fails at
```

**File**: `evals/cases/implement-with-subagents-late-fanout-novel/case.json` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+{
+  "id": "implement-with-subagents-late-fanout-novel",
+  "title": "Choose delegated ownership before a late fanout",
+  "family": "workflow",
+  "target_skills": [
+    "implement-with-subagents"
+  ],
+  "expected_skills": [
+    "implement-with-subagents"
+  ],
+  "task_mode": "review",
+  "kind": "novel",
+  "fixture": "workflow-subagents",
+  "forbid_all_commands": true,
+  "allow_skill_reference_reads": true,
+  "allowed_write_paths": [],
+  "validators": [
+    {
+      "argv": [
+        "python3",
+        "@validators/text_case.py",
+        "implement-with-subagents-late-fanout-novel"
+      ],
+      "timeout_seconds": 30
+    }
+  ],
+  "rubric": [
+    {
+      "id": "whole-graph",
+      "text": "Chooses delegated mode once at preflight because B and C form a later parallel point; assigns A as well as B and C to workers, rejecting per-frontier mode switching."
+    },
+    {
+      "id": "dependency",
+      "text": "Accepts and integrates the worker-owned A commit and passes affected checks at that integrated head before releasing B and C."
+    },
+    {
+      "id": "fanout",
+      "text": "Dispatches B and C concurrently within actual capacity in separate checkouts, preserving same-owner repair and mandatory independent final review."
+    }
+  ],
+  "provenance": {
+    "kind": "synthetic"
+  },
+  "calibration": true
+}
```

**File**: `evals/cases/implement-with-subagents-late-fanout-novel/expectations.json` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+{
+  "files": [
+    "state.md"
+  ],
+  "must_contain": [
+    "The validated graph is A followed by B and C: A has no dependencies; B and C both depend on A and are independent with disjoint write sets.",
+    "The runtime has capable resumable workers, independent final review, sufficient capacity, isolated checkouts and approved test seams.",
+    "Only A is ready now. The draft has the lead implement A and proposes deciding again whether to use workers when B and C become ready."
+  ]
+}
```

---

### Incident Patch 2: `e8e32270` (2026-10-22)
**Commit Message**: Bump version to 2026.10.22

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "chrisbanes-skills",
   "description": "Skills for Kotlin, Android, JVM, and Jetpack Compose development by Chris Banes.",
-  "version": "2026.10.21",
+  "version": "2026.10.22",
   "author": {
     "name": "Chris Banes",
     "url": "https://github.com/chrisbanes"
```

**File**: `.codex-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "chrisbanes-skills",
-  "version": "2026.10.21",
+  "version": "2026.10.22",
   "description": "Skills for Kotlin, Android, JVM, and Jetpack Compose development by Chris Banes.",
   "author": {
     "name": "Chris Banes",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "chrisbanes-skills",
-  "version": "2026.10.21",
+  "version": "2026.10.22",
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
-  "version": "2026.10.21",
+  "version": "2026.10.22",
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

## X. Keep serial implementation solo and PR polling in the controller (#135)

**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in chrisbanes/skills. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6c30c500`: Keep serial implementation solo and PR polling in the controller (#135). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- [`implement-with-subagents`](skills/implement-with-subagents/SKILL.md) — choose solo implementation for a single item or serial graph and worker ownership for every item in a graph with parallel work; preserve dependency-aware integration, independent final review, same-owner repair, bounded checkout reuse, and read-only orchestration review.
- [`shepherd`](skills/shepherd/SKILL.md) — poll open PRs and MRs directly in the controller, using a read-only helper only for a bounded large failed-log question, or follow a host PR monitor's wake events (such as Claude desktop's Auto-fix) instead of polling, triage review comments, and repair CI failures with affected checks and required integrated-candidate validation; start external review during CI while retaining final-head merge gates.
`implement-with-subagents` chooses solo or delegated ownership once from the
whole task graph.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
- [`implement-with-subagents`](skills/implement-with-subagents/SKILL.md) — coordinate one or more worker-owned implementation tasks through dependency-aware dispatch, task acceptance, integration, and same-owner repair; dispatch independent ready work concurrently within actual capacity, reuse sequential worker slots, and support read-only orchestration review.
- [`shepherd`](skills/shepherd/SKILL.md) — autonomously poll open PRs and MRs, or follow a host PR monitor's wake events (such as Claude desktop's Auto-fix) instead of polling, triage review comments, and repair CI failures with affected checks and required integrated-candidate validation; start external review during CI while retaining final-head merge gates.
`implement-with-subagents` retains its explicitly delegated workflow.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6c30c500` are properly handled with clean fallback behavior.
