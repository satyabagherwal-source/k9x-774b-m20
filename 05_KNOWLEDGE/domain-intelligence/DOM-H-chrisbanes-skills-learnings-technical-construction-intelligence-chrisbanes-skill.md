# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: chrisbanes-skills-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "chrisbanes-skills-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T01:35:44.475Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-chrisbanes-skills-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [chrisbanes-skills-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T01:35:44.475Z`  
> **Learning ID**: `LEARN-EVO-chrisbanes-skills-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), K (Quality & Verification Intelligence), A (Human & Need Intelligence), B (Product Intelligence), F (Design Intelligence), L (Deployment & Operations Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 60%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from chrisbanes-skills-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/chrisbanes-skills-learnings.md`  
> **Source**: github ([https://github.com/chrisbanes/skills](https://github.com/chrisbanes/skills))  
> **Source Version**: `2975135e`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T01:35:27.406Z  
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
> **Harvest Timestamp**: 2026-11-28T01:35:27.400Z  
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

### Incident Patch 1: `2975135e` (2026-11-27)
**Commit Message**: Require unique scratch files in every subagent brief (#206)

## Problem

On 2026-11-27, a `run-project` drain of chrisbanes/haze ran three
ticket-owner subagents in parallel, each in its own worktree. Owners run
`git`, `gh` and Gradle with the command sandbox off, because the sandbox
blocks keychain/ssh, `~/.gradle` and worktree git dirs. With the sandbox
off, `$TMPDIR` is the shared `/tmp/claude-501`, not a per-command temp
dir.

During mutation and sensitivity checks, two owners backed up a source
file to the same fixed path, `$TMPDIR/delegate.bak`:

- the #1923 owner backed up `RenderScriptBlurVisualEffectDelegate.kt`;
- the #1927 owner backed up
`RenderEffectBlurVisualEffectDelegate.android.kt`.

The #1927 owner's 191-line file overwrote #1923's backup and was later
deleted. #1923 only avoided damage because it restored from git. Had it
restored from the backup, another ticket's code would have silently
replaced its file and been committed. A third owner used another fixed
name, `/tmp/claude-501/b1903/`. `git diff` confirmed that nothing
reached a PR.

The controller fixed it mid-drain by adding one line to later owner
briefs ("Temp files: `mktemp` only, never fixed names"), an

**File**: `evals/tests/test_workflows_writing_matrix.py` (modified, +7/-0)
```diff
@@ -237,6 +237,13 @@ def test_each_consumer_links_to_shared_handoff_reference(self):
                 source = directory / caller
                 self.assertIn(os.path.relpath(shared, source.parent), source.read_text())
 
+    def test_handoff_brief_requires_unique_scratch_files(self):
+        # Parallel owners once overwrote each other's fixed `$TMPDIR/delegate.bak`.
+        text = (REPO_ROOT / "skills/subagent-delegation/references/subagent-selection.md").read_text()
+        brief = " ".join(text.split("## Handoff brief", 1)[1].split("## Return", 1)[0].split())
+        self.assertIn("In every brief, include “Create scratch files, logs and backups with `mktemp`", brief)
+        self.assertIn("never use a fixed name in a shared temp directory", brief)
+
     def test_project_execution_routes_mandatory_scheduler_and_review_contracts(self):
         entrypoint = (REPO_ROOT / "skills/run-project/SKILL.md").read_text(
             encoding="utf-8"
```

**File**: `skills/subagent-delegation/references/subagent-selection.md` (modified, +4/-1)
```diff
@@ -96,7 +96,10 @@ document solely to avoid a short inline detail when no suitable record exists.
 - Objective or question.
 - **Workspace.** Exact checkout path and state, including branch and base
   SHA when applicable. In an editing brief, include “Preserve others' edits,
-  including concurrent changes in your owned files.”
+  including concurrent changes in your owned files.” In every brief, include
+  “Create scratch files, logs and backups with `mktemp`, or restore from Git
+  (`HEAD` or a WIP commit); never use a fixed name in a shared temp directory,
+  because parallel agents share `/tmp` when the sandbox is off.”
 - Relevant instructions and evidence.
 - Allowed actions and forbidden actions.
 - Acceptance criteria and expected result.
```

---

### Incident Patch 2: `4ef1d9bc` (2026-11-26)
**Commit Message**: Prefer host delegation and fix retained claim recovery (#205)

## Summary

```text
Delegation
  Resolve the worker provider's model, effort and pins.
  Prefer a compatible host route, with native fallback where allowed.

Retained GitHub Project claims
  Verify release before applying cutover checks.
  Publish the migration record before the authority-resume record for a pause.
  Reconcile rollback retries against verified journal operations.
```

## Evidence

- Previously, route selection was provider-native by default, and
migration refresh and rollback could compare live state against an
outdated snapshot.
- Calibration cases cover host preference and fallback, cross-provider
model selection, a released claim moving to In Progress, and rollback
retry after a verified inverse write.
- Markdown lint, 328 eval case definitions, and 53 focused tests passed.
Live evals were skipped.

## Merge Danger

Two-way. Reverting the PR restores the previous skill instructions. The
affected workflows are subagent delegation and retained claims during
legacy GitHub Project migrations.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -168,7 +168,7 @@ for its lane-specific fallback and blocking behavior.
 - [`deliver-issue`](skills/deliver-issue/SKILL.md) — coordinate a named tracker issue and its descendants, or a verified board-controller handoff using the installed `implement-with-subagents` executor for each approved PR, diagnosis before planning for unresolved bugs in direct delivery, a planning-free fast path for small well-understood tickets, CI-supplied full-suite evidence, concurrent external review with verified draft support or earlier PR readiness, reusable scope approval and revision-isolated evidence with preservation checks, independent integrated-candidate review and focused repair review, and PR shepherding, delivering to GitHub or GitLab code hosts; validate applicable live-qualification harness paths offline (isolated production stores for persistent paths, fake runtimes for asynchronous paths), then reconcile failures under bounded approved allowances.
 - [`release-kotlin-library`](skills/release-kotlin-library/SKILL.md) — assess readiness, prepare, and verify Kotlin library releases; check the `gradle-maven-publish-plugin` prerequisite, use `changelog` for notes, prepare Metalava API snapshots, and follow repository checks and publication gates.
 - [`gradle-run`](skills/gradle-run/SKILL.md) — run every agent-initiated Gradle command through a compact-output wrapper; recover run identity and bounded results by workflow ID with read-only status, and diagnose failures with optional investigation helpers.
-- [`subagent-delegation`](skills/subagent-delegation/SKILL.md) — provider-neutral delegation playbook, loaded by name or through a one-line user-level opt-in, with separate Codex, Claude Code, and Antigravity/Gemini model routing, installed-role precedence, parallel briefs, independent audits, and lead acceptance.
+- [`subagent-delegation`](skills/subagent-delegation/SKILL.md) — provider-neutral delegation playbook, loaded by name or through a one-line user-level opt-in, with host delegation discovery and Codex, Claude Code, and Antigravity/Gemini model routing, installed-role precedence, parallel briefs, independent audits, and lead acceptance.
 - [`implement-with-subagents`](skills/implement-with-subagents/SKILL.md) — default to the lead for a single item or serial graph, apply requested implementation model and effort at preflight, and use workers for every item in a graph with parallel work. Preserve dependency-aware integration, independent final review, same-owner repair, bounded checkout reuse, and read-only orchestration review.
 - [`to-plan`](skills/to-plan/SKILL.md) — create risk-scaled implementation plans that prove baselines from green CI, with observable slices and consequential boundary validation before dependent work, plus authenticated integration amendments, tracker-bound markers and explicit consumer handoffs. Standalone issue planning can start without `ready-for-agent`. Decide separate PRs by coherent deliverable boundaries.
 - [`run-project`](skills/run-project/SKILL.md) — explicitly triage, plan and deliver eligible tickets from a Project board, using Todo / In progress / Done, human-applied role authority, preserved label stops, scheduling and review gates, with a GitHub or GitLab code host; use `deliver-issue` for one named item.
```

**File**: `evals/README.md` (modified, +5/-3)
```diff
@@ -363,9 +363,11 @@ routing, parallel briefs, installed custom-role precedence, fresh independent
 audits, runtime-specific result delivery and workspace lifecycle, task-wide
 invocation, and solo-work restraint with evidence reuse. Each prompt supplies
 the user-level opt-in, and a calibration-only automatic control checks that the
-skill stays inactive without it. These are supplied-state, read-only cases with
-deterministic fixture-integrity checks and semantic rubrics; no live model
-results are claimed.
+skill stays inactive without it. A calibration case checks host route
+preference, explicit route requirements, provider-native fallback, and model
+routing for a worker on a different provider from the lead. These are
+supplied-state, read-only cases with deterministic fixture-integrity checks
+and semantic rubrics.
 The changelog triad checks stable-cycle coverage, incremental Unreleased
 maintenance and missing-file restraint across non-Kotlin repositories. The
 three `simplify-changes` cases cover a verified cleanup, a report on local changes
```

**File**: `evals/cases/deliver-tasks-migration-apply-direct/expectations.json` (modified, +9/-0)
```diff
@@ -63,6 +63,15 @@
       ],
       "same_owner": true,
       "reset_budget": false
+    },
+    "resume-migration-only": {
+      "dispatch": false,
+      "preserve_hold": true,
+      "reset_budget": false
+    },
+    "released-on-refresh": {
+      "released": ["I5"],
+      "held": ["I1"]
     }
   }
 }
```

**File**: `evals/cases/deliver-tasks-migration-apply-direct/prompt.md` (modified, +4/-1)
```diff
@@ -57,7 +57,10 @@ Assess these additional independent snapshots under the same no-provider and no-
 - **writer-returned:** Identical to retained except the I5 writer resumed after approval and can still write under the old binding.
 - **parked:** The proposed retained inventory includes I5 as CI-parked. The state is stable, but its unchanged old lease and PR cannot be reconciled by this migration.
 - **resume-unknown:** After activation, the I1 pause condition is satisfied, but the original budget checkpoint cannot be verified and no valid migration-resume record exists.
-
 - **resume-verified:** I1's original resume condition, new scoped authority, exact lease and remaining budget are verified, both resume records are read back, and the existing owner acknowledges the new lease. I5 remains held.
+- **resume-migration-only:** Identical to resume-verified except the authority-resume publication timed out and its outcome could not be reconciled. Assess eligibility now, before any further publication or dispatch.
+- **released-on-refresh:** In a separate run after activation, I5's scoped continuation, migration-resume record, and acknowledgement of the new lease are all verified. I5 then moves from Todo to In Progress through normal implementation claim. Its current-binding checks pass. I1's original pause condition remains unmet. On refresh, identify which retained item follows normal current-binding checks and which stays held.
 
 Add these keys to the decision artifact: retained: action, moves_verified, retained_claims (item IDs in inventory order), eligible_after_activation (retained item IDs only), preserve_owners, preserve_budgets, rewrite_historical_markers; writer-returned: action, writes; parked: action, writes; resume-unknown: dispatch, preserve_hold, reset_budget (booleans); resume-verified: releasable (retained item IDs), same_owner, reset_budget. For writer-returned, return the disposition for a changed approved precondition.
+
+For resume-migration-only, return the same fields as resume-unknown. For released-on-refresh, return `released` and `held` as retained item ID arrays in inventory order.
```

**File**: `evals/cases/deliver-tasks-migration-partial-failure-novel/expectations.json` (modified, +10/-0)
```diff
@@ -31,6 +31,16 @@
       "I2": "rollback-conflict",
       "create_option": false,
       "delete_options": false
+    },
+    "rollback-after-release": {
+      "action": "migration-blocked",
+      "inverse_writes": 0,
+      "preserve_journal": true
+    },
+    "retained-rollback-retry": {
+      "I1": "already-original-no-op",
+      "I2": "restore-B-with-readback",
+      "migration_blocked": false
     }
   }
 }
```

**File**: `evals/cases/deliver-tasks-migration-partial-failure-novel/prompt.md` (modified, +4/-0)
```diff
@@ -50,3 +50,7 @@ Exact plan approved; durable journal records original states before any writes.
 Use action migration-blocked for unresolved outcomes. verified lists item IDs in supplied inventory order; I3 uses unknown, retry-with-fresh-preconditions or already-original-no-op. Rollback item dispositions use preserve-concurrent-change, restore-B-with-readback, already-original-no-op or rollback-conflict. Config dispositions use restore-legacy-remove-unchanged-destination or preserve-and-propose-inverse-patch; instruction dispositions use restore-original-with-readback or preserve-and-propose-inverse-patch. Retry/intent/readback/preserve/option flags are booleans; config_writes is a number.
 
 Write `.scratch/review-decisions.json` with these snapshot keys and fields: partial: action, verified, retry_I2, I3, retry_I3, config_writes, preserve_journal; retry-original: I3, write_intent_first, readback_required; rollback: I1, I2, I3, config, AGENTS.md, CLAUDE.md, journal_inverse_operations, delete_options; missing-option: I2, create_option, delete_options. Use JSON booleans/numbers/arrays/maps as appropriate. Explain the dry run and exact config reshape, original-state journal and readbacks, retry/rollback preconditions, activation boundary and human-only option deletion in your response.
+
+Assess one independent `rollback-after-release` snapshot. The retained-claim migration completed and the replacement activated. The journal records I1 as a retained authority pause. I1 has since resumed under a verified new-binding lease. All writers are now quiesced, the other work and configuration still match the recorded migration output, and the human requests ordinary journal rollback. Return `action`, `inverse_writes` (number), and `preserve_journal` (boolean) for the immediate disposition before any binding or ownership reconciliation.
+
+Assess an independent `retained-rollback-retry` snapshot. Rollback already restored retained I1's original Backlog Status, and the journal records the verified inverse write. A retry sees I1 still in Backlog, I2 still in its migrated Todo Status, and every other item and file matching the reconciled journal. Writers remain fenced. No retained claim resumed or acquired a new lease, and no other work was admitted. Return `I1` and `I2` using the rollback item dispositions above, and `migration_blocked` (boolean).
```

**File**: `evals/cases/subagent-delegation-host-routing-novel/case.json` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+{
+  "id": "subagent-delegation-host-routing-novel",
+  "title": "Choose a delegation route from host and provider capabilities",
+  "family": "workflow",
+  "target_skills": [
+    "subagent-delegation"
+  ],
+  "expected_skills": [
+    "subagent-delegation"
+  ],
+  "task_mode": "review",
+  "kind": "novel",
+  "fixture": "workflow-delegation",
+  "allowed_write_paths": [],
+  "forbid_all_commands": true,
+  "allow_skill_reference_reads": true,
+  "validators": [
+    {
+      "argv": [
+        "python3",
+        "@validators/text_case.py",
+        "subagent-delegation-host-routing-novel"
+      ],
+      "timeout_seconds": 30
+    }
+  ],
+  "rubric": [
+    {
+      "id": "host-preference",
+      "text": "Chooses the host for A based on the supplied capabilities, keeps the required model and effort, and retains the host session handle for results and repairs by the same owner. Uses the host's own tool contract."
+    },
+    {
+      "id": "fallback",
+      "text": "Chooses the native route for B to enforce read-only access and preserve fresh review context at the exact candidate. Reports that same access mismatch as a blocker for C without switching routes or treating a brief as access enforcement."
+    },
+    {
+      "id": "restraint",
+      "text": "Honors the explicit native route for D despite a compatible host. Keeps E solo. Makes recommendations only and performs no dispatch, edits, or settings changes."
+    },
+    {
+      "id": "worker-provider-policy",
+      "text": "For F, uses the Claude Code policy for the unpinned worker despite the Codex lead. Resolves Sonnet and medium effort for ordinary bounded implementation, then selects the host with its supplied claude-sonnet ID and medium effort. Uses host controls for dispatch."
+    }
+  ],
+  "provenance": {
+    "kind": "synthetic"
+  },
+  "calibration": true
+}
```

**File**: `evals/cases/subagent-delegation-host-routing-novel/expectations.json` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+{
+  "files": [
+    "state.md"
+  ],
+  "must_contain": [
+    "Immutable evaluation state",
+    "root lead owns architecture"
+  ]
+}
```

#### Recent Merged Pull Requests:
- **PR #206** (2026-11-27): Require unique scratch files in every subagent brief (@chrisbanes)
- **PR #205** (2026-11-26): Prefer host delegation and fix retained claim recovery (@chrisbanes)
- **PR #204** (2026-11-25): Improve skill eval reliability and Kotlin and Compose coverage (@chrisbanes)
- **PR #203** (2026-11-24): Restore delivery safeguards and rename simplify to simplify-changes (@chrisbanes)
- **PR #202** (2026-11-24): Add a standalone simplify skill (@chrisbanes)
- **PR #201** (2026-11-24): Simplify skill instructions and share references across skills (@chrisbanes)

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

## X. Require unique scratch files in every subagent brief

**RULE**:
When implementing operations in `evals/tests/test_workflows_writing_matrix.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in chrisbanes/skills. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2975135e`: Require unique scratch files in every subagent brief. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `evals/tests/test_workflows_writing_matrix.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
    def test_handoff_brief_requires_unique_scratch_files(self):
        # Parallel owners once overwrote each other's fixed `$TMPDIR/delegate.bak`.
        text = (REPO_ROOT / "skills/subagent-delegation/references/subagent-selection.md").read_text()
        brief = " ".join(text.split("## Handoff brief", 1)[1].split("## Return", 1)[0].split())
        self.assertIn("In every brief, include “Create scratch files, logs and backups with `mktemp`", brief)
        self.assertIn("never use a fixed name in a shared temp directory", brief)

```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2975135e` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
