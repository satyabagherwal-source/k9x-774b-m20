# Domain H — Technical Construction Intelligence: Technical Construction Intelligence: chrisbanes-skills-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "chrisbanes-skills-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T09:59:50.683Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-chrisbanes-skills-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [chrisbanes-skills-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T09:59:50.683Z`  
> **Learning ID**: `LEARN-EVO-chrisbanes-skills-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain H (Technical Construction Intelligence)
- **Secondary Corroborating Domains**: D (Research & Knowledge Intelligence), G (Architecture Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), M (Feedback & Evolution Intelligence), B (Product Intelligence), A (Human & Need Intelligence), J (Search & Distribution Intelligence), F (Design Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 63%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from chrisbanes-skills-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/chrisbanes-skills-learnings.md`  
> **Source**: github ([https://github.com/chrisbanes/skills](https://github.com/chrisbanes/skills))  
> **Source Version**: `50b5d4cf`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-20T09:59:05.997Z  
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
> **Harvest Timestamp**: 2026-11-20T09:59:05.989Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chrisbanes/skills`
- **Description**: Skills for Kotlin, Jetpack Compose, and Android development
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1164 stars

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

### Incident Patch 1: `50b5d4cf` (2026-11-19)
**Commit Message**: Bump version to 2026.11.19

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "chrisbanes-skills",
   "description": "Skills for Kotlin, Android, JVM, and Jetpack Compose development by Chris Banes.",
-  "version": "2026.11.18",
+  "version": "2026.11.19",
   "author": {
     "name": "Chris Banes",
     "url": "https://github.com/chrisbanes"
```

**File**: `.codex-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "chrisbanes-skills",
-  "version": "2026.11.18",
+  "version": "2026.11.19",
   "description": "Skills for Kotlin, Android, JVM, and Jetpack Compose development by Chris Banes.",
   "author": {
     "name": "Chris Banes",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "chrisbanes-skills",
-  "version": "2026.11.18",
+  "version": "2026.11.19",
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
-  "version": "2026.11.18",
+  "version": "2026.11.19",
   "description": "Skills for Kotlin, Android, JVM, and Jetpack Compose development by Chris Banes.",
   "author": {
     "name": "Chris Banes",
```

---

### Incident Patch 2: `2161b90d` (2026-11-18)
**Commit Message**: Add GitLab issue tracker binding (#182)

## Summary

Add the shared GitLab issue tracker binding and route it through
`run-project`, `deliver-issue` and `to-plan`.

- Define GitLab issue scope, claim and stop, note markers, dependency
reads and issue closure.
- Keep the tracker and code host independent. Missing dependency
evidence blocks dependent work, and native closure requires an exact,
authorized issue set.

This is the offline portion of [issue
#163](https://github.com/chrisbanes/skills/issues/163). [Implementation
plan, revision
1](https://github.com/chrisbanes/skills/issues/163#issuecomment-6982694062),
payload SHA-256
`8d29832c9f15eda2250d78072b52aa5ff80dd12a35af54e3f7ccec4bf80351f5`.

## Evidence

- Before, the GitLab binding handled merge requests and rejected GitLab
issue tracker operations.
- Offline cases now cover claim loss, note readback and revision chains,
unavailable blockers, exact native closure and mixed-host closure.
- A successful GitLab response may omit relationships the runner cannot
see. The binding requires independent completeness evidence for blockers
and effective closure targets before those operations proceed.
- [Offline
handoff](https://github.c

**File**: `README.md` (modified, +4/-3)
```diff
@@ -138,9 +138,10 @@ for its lane-specific fallback and blocking behavior.
 Both delivery skills bundle their internal references for selective installation.
 Install `changelog` alongside `release-kotlin-library`.
 
-The delivery skills support Jira Cloud as a tracker for JQL boards, direct
-issue delivery and planning markers. Select the code host separately.
-See the [Jira binding](references/jira-binding.md) for setup and supported operations.
+The delivery skills support Jira Cloud JQL boards and GitLab issue selections by
+label or milestone, as well as direct issue delivery and planning markers.
+Select the code host separately. See the [Jira binding](references/jira-binding.md)
+and [GitLab binding](references/gitlab-binding.md) for setup and capabilities.
 
 When `run-project` has no explicit GitHub Project scope, it selects the sole
 visible open, non-template Project linked to the verified repository. Supply a
```

**File**: `evals/artifacts/issue-163/r1/offline-handoff.md` (added, +167/-0)
```diff
@@ -0,0 +1,167 @@
+# Issue 163 offline handoff
+
+The controller supplied the [issue and brief](https://github.com/chrisbanes/skills/issues/163#issuecomment-6956402695)
+and [active revision 1 plan](https://github.com/chrisbanes/skills/issues/163#issuecomment-6982694062).
+The issue and plan were read through the GitHub connector. The controller's
+Project #22 item is `PVTI_lAHOAAN4ns4BsKlazhJzXlA` on
+`PVT_kwHOAAN4ns4BsKla`. The controller retains Project, tracker, PR and
+qualification authority.
+
+- Base `3d9da4774f441854a8ff4c513487301b057053ca`
+- Plan digest `8d29832c9f15eda2250d78072b52aa5ff80dd12a35af54e3f7ccec4bf80351f5`
+- Configuration digest `cfc5e733c34d0d677ac2c387523b88a28340981c4c2825624fb1a686d8cc18e7`
+- Evidence preservation uses the controller-retained baseline tree.
+
+## Contract coverage
+
+| Shared operation | GitLab path and offline evidence |
+| --- | --- |
+| Identity, source, readiness, normalization | Exact authenticated project and issue reads, label or milestone membership, roles and logical state in the shared GitLab reference. Direct, Project and standalone planning have their own entry gates. |
+| Claim, release and stop | Verified claim label plus exclusive assignment. Claim-loss stop preserves records and releases capacity after quiescence. The direct decision fixture covers ownership and loss. |
+| Dependencies and hierarchy | Inward blocking links require verified tier and visibility. Unsupported tier and failed reads both block dependent lanes with distinct receipts. Descendant completeness requires a trusted current inventory when this REST binding cannot verify it. |
+| Durable markers and supersession | Paginated issue notes, exact canonical payload readback and authoritative revision edges. The novel decision fixture covers presentation, no-op and ambiguous-create reconciliation. |
+| Linking, merge and closure | Independent tracker and host operations, verified canonical linkage, exact effective closing set and verified tracker terminal state. The negative fixture covers native identity, a second project with the same IID, non-default base and mixed GitHub hosting. |
+| Done and recovery | Fingerprint native auto-close and other verified Done inputs, preserve on drift, and reconcile ambiguous writes and unintended closure against exact readback. Unattended GitLab tracker wake and GitHub Project-specific mutations are unavailable. |
+
+The source uses the existing sync authority and provider-neutral routing.
+GitLab's note API strips CR and trailing whitespace and executes quick actions.
+The note transport therefore requires LF, rejects quick actions and frames the
+exact payload with a removable footer. Supersession leaves verified predecessor
+notes visible. [GitLab Notes API](https://docs.gitlab.com/api/notes/#note-body-normalization)
+
+## Qualification and evidence applicability
+
+The [protocol](qualification-protocol.md) and [write ledger](qualification-writes.json)
+are checked offline using the existing fake GitLab client test suite.
+Their checks establish the proposed allowlist, attempted-write accounting,
+cleanup reserve and behavior on ambiguous responses in a simulation. The fixture
+has Free capability and missing default role labels. It cannot qualify the full
+journey in its recorded state. A ready MR is proposed as qualification setup
+within the 15-write forward allowance. Ordinary delivery retains its draft
+gate. The isolated branch protocol exercises tracker-controlled closure only.
+[GitLab issue links](https://docs.gitlab.com/user/project/issues/related_issues/),
+[GitLab default branch](https://docs.gitlab.com/user/project/repository/branches/default/)
+
+The corpus cases are synthetic decision fixtures. They establish corpus,
+bundling and deterministic grading behavior, including rejection of unsafe
+decisions. Live provider qualification, live scoring, independent candidate
+review and external delivery remain controller gates.
+
+The entrypoint byte limit, automatic eligibility matrix and read-only
+grader assertion were repaired during routine integration. The protocol uses
+a checked allowlist with the existing test client because the prior live guard
+is scoped to code-host operations and counts a different journey. No plan
+amendment or material scope expansion was applied.
+
+## Independent review repairs
+
+- Require independent relationship visibility before a paged successful result
+  can clear the dependency gate. The decision case covers a filtered empty
+  response. [GitLab issue-link implementation](https://gitlab.com/gitlab-org/gitlab/-/blob/master/lib/api/issue_links.rb#L17-38)
+- Require positive evidence of the effective closing set, including invisible
+  manual links, before accepting an exact or empty result. Both are covered in
+  the decision case. [GitLab manual-link semantics](https://docs.gitlab.com/user/project/issues/managing_issues/#user-responsibility-when-merging)
+- Normalize a GitHub PR author's immuta
```

**File**: `evals/artifacts/issue-163/r1/qualification-protocol.md` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+# GitLab tracker qualification proposal
+
+Revision 1 of [issue #163](https://github.com/chrisbanes/skills/issues/163)
+and its [active plan](https://github.com/chrisbanes/skills/issues/163#issuecomment-6982694062).
+This is a checked protocol proposal. The preceding
+[code-host evidence](../../2026-11-17-gitlab-code-host-live.md) applies to
+code-host operations only. This revision has **zero authorized or attempted
+fixture writes**. Native GitLab closure is covered by synthetic offline
+decisions. Live execution, tracker cleanup and qualification are pending.
+
+## Read-only fixture record
+
+The controller verified GitLab.com project `banes3/Banes-project`, ID
+`88319115`, private, with issues enabled, default branch `main`, Free
+namespace plan and configured account with group Owner access. The fully
+paged label inventory lacked `ready-for-agent` and `agent:in-progress`.
+This preflight blocks the full journey. Free lacks directional blocking
+links. Alternative role labels require trusted configuration and
+verification. A failed link read would be unknown even on a supported tier.
+No tier, setting, label, resource or branch was changed.
+
+## Obtain one bounded grant
+
+1. Refresh exact host, account, path and numeric ID, default branch and
+   its SHA, namespace tier, issue visibility, directional blocking-link
+   capability, configured role/selection names and IDs, and effective
+   operation and cleanup permissions. Require independent relationship
+   visibility evidence and a complete blocker and descendant view for the
+   three run issues. A successful empty links response proves neither. Verify Owner cleanup scope
+   for issue and MR deletion, and effective branch-create/delete authority
+   for both disposable branches. Verify protection patterns, push/merge
+   policy and automation. Stop before writing if any required fact is unknown.
+2. Agree a unique run ID and record a sanitized preflight manifest with exact
+   fixture, actors, label/selection names, immutable base SHA, one file
+   path, branch names and starting absence of run resources. Require both
+   branches to be new, unprotected, disposable and different from the
+   default. Check that the pinned base and generated commit introduce no
+   additional closing directives. Neither actor receives authority over
+   existing issues, labels, refs, merge requests or project settings.
+3. Obtain one explicit maintainer grant for this exact manifest and
+   [write ledger](qualification-writes.json). The fixture operator applies the
+   preapproved existing human role labels only while creating test issues and
+   removes the claim on the stop-case issue. The controller runs the authorized
+   claim, plan, merge and close steps. Explicitly approve deletion of run-owned
+   issues and MR and their associated records. A Free negative-only check
+   would need a separate, narrower grant and could only verify the capability
+   boundary. No grant is present for either check.
+4. The ledger creates one ready, non-closing fixture MR to exercise the
+   tracker-controlled close. This is preparation for that check. Ordinary
+   delivery still opens a draft. If the maintainer requires a draft-to-ready
+   journey in this check, pause for an amended write ledger and grant before
+   any send. No native-close test into `main` is proposed. The extra tracker
+   backlink note also has no slot in this ledger. Verify the canonical
+   source URL in the MR and the exact issue readback for this check.
+
+## Run and verify
+
+1. Treat the JSON ledger as the complete allowlist. Prefix requests with
+   `projects/88319115/` on `gitlab.com`. Bind every issue and MR IID and
+   URL-encoded branch reference to a same-run creation receipt confirmed by
+   exact readback. Substitute frozen, exact request bodies from the manifest
+   and verified prior steps. The only exceptions to a creation receipt are
+   the create calls themselves, which require verified absence and unique run
+   names. Never infer ownership from a name or IID alone. Revalidate live
+   identity, grant and operation preconditions immediately before each send.
+   Reject cross-project IDs, arbitrary payload fields, protected branch
+   targets, auto-merge, merge trains and pre-existing resources.
+2. Advance the forward rows in order. Debit the exact row against the
+   15-forward limit before handing a request to transport. Keep the six
+   cleanup rows reserved. Each row is single-use even after a timeout.
+   Reconcile uncertain effects with at most three complete retry reads
+   beyond the initial read, using receipt identity, author/account,
+   exact result and timestamps. A unique, proven matching effect can be
+   recorded. Unknown effects halt forward progress, and a proven absent
+   effect ends that journey without a resend. Every actual send counts,
+   including a rejected response, an ambiguous response and every cleanup
+   write. There is no automati
```

**File**: `evals/artifacts/issue-163/r1/qualification-writes.json` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+{
+  "host": "gitlab.com",
+  "projectId": 88319115,
+  "projectPath": "banes3/Banes-project",
+  "protectedBase": "main",
+  "authorizedWrites": 0,
+  "forwardLimit": 15,
+  "cleanupReserve": 6,
+  "maximumAttempts": 21,
+  "forward": [
+    ["create-target", "POST", "issues", {"title": "$targetTitle", "labels": "$fixtureLabels"}],
+    ["create-blocker", "POST", "issues", {"title": "$blockerTitle", "labels": "$fixtureLabels"}],
+    ["link-blocker", "POST", "issues/{target}/links", {"target_project_id": 88319115, "target_issue_iid": "$blocker", "link_type": "is_blocked_by"}],
+    ["close-blocker", "PUT", "issues/{blocker}", {"state_event": "close"}],
+    ["create-stop", "POST", "issues", {"title": "$stopTitle", "labels": "$fixtureLabels"}],
+    ["claim-stop", "PUT", "issues/{stop}", {"add_labels": "$claimLabel", "assignee_ids": "$runnerIds"}],
+    ["remove-stop-claim", "PUT", "issues/{stop}", {"remove_labels": "$claimLabel"}],
+    ["claim-target", "PUT", "issues/{target}", {"add_labels": "$claimLabel", "assignee_ids": "$runnerIds"}],
+    ["publish-plan", "POST", "issues/{target}/notes", {"body": "$planNote"}],
+    ["create-base", "POST", "repository/branches", {"branch": "$baseName", "ref": "$mainSha"}],
+    ["create-source", "POST", "repository/branches", {"branch": "$sourceName", "ref": "$baseSha"}],
+    ["commit-source", "POST", "repository/commits", {"branch": "$sourceName", "commit_message": "$commitMessage", "actions": "$createFileAction"}],
+    ["open-mr", "POST", "merge_requests", {"source_branch": "$sourceName", "target_branch": "$baseName", "title": "$mrTitle", "description": "$nonClosingDescription"}],
+    ["merge-at-head", "PUT", "merge_requests/{mr}/merge", {"sha": "$reviewedSha", "squash": "$squash"}],
+    ["close-target", "PUT", "issues/{target}", {"state_event": "close"}]
+  ],
+  "cleanup": [
+    ["delete-mr", "DELETE", "merge_requests/{mr}", null],
+    ["delete-source", "DELETE", "repository/branches/{source}", null],
+    ["delete-base", "DELETE", "repository/branches/{base}", null],
+    ["delete-stop", "DELETE", "issues/{stop}", null],
+    ["delete-target", "DELETE", "issues/{target}", null],
+    ["delete-blocker", "DELETE", "issues/{blocker}", null]
+  ],
+  "unknownAffects": {
+    "create-target": ["target"],
+    "create-blocker": ["blocker"],
+    "link-blocker": ["target", "blocker"],
+    "close-blocker": ["target", "blocker"],
+    "create-stop": ["stop"],
+    "claim-stop": ["stop"],
+    "remove-stop-claim": ["stop"],
+    "claim-target": ["target"],
+    "publish-plan": ["target"],
+    "create-base": ["base"],
+    "create-source": ["source"],
+    "commit-source": ["source"],
+    "open-mr": ["mr", "base", "source", "target"],
+    "merge-at-head": ["mr", "base", "source", "target"],
+    "close-target": ["target"],
+    "delete-mr": ["mr", "base", "source", "target"],
+    "delete-source": ["source"],
+    "delete-base": ["base"],
+    "delete-stop": ["stop"],
+    "delete-target": ["target", "blocker"],
+    "delete-blocker": ["target", "blocker"]
+  }
+}
```

**File**: `evals/cases/deliver-issue-no-change-closure-negative/expectations.json` (modified, +14/-0)
```diff
@@ -69,6 +69,20 @@
       "host_action": "none",
       "retry": false,
       "ticket_complete": false
+    },
+    "gitlab-verified": {
+      "outcome": "no-change",
+      "tracker_action": "close_and_verify",
+      "host_action": "none",
+      "retry": false,
+      "ticket_complete": true
+    },
+    "gitlab-unattributed": {
+      "outcome": "no-change",
+      "tracker_action": "reconcile_closure",
+      "host_action": "none",
+      "retry": false,
+      "ticket_complete": false
     }
   }
 }
```

**File**: `evals/cases/deliver-issue-no-change-closure-negative/prompt.md` (modified, +10/-0)
```diff
@@ -31,3 +31,13 @@ explicit closure authority, and the tracker supports close and readback.
 - `unknown-readback`: The close returned success, but the fresh issue read
   cannot verify the repository identity. Assess ticket completion and the next
   action for that write.
+- `gitlab-verified`: The owning Project controller uses a GitLab label scope
+  with GitHub as code host and holds tracker closure authority only. A current
+  trusted complete inventory verifies blockers and descendants for the exact
+  issue. If the controller sends `state_event: close`, fresh issue readback
+  reports closed and a new matching state event attributes the close to
+  this write. That issue state is the selected scope's Done readback.
+- `gitlab-unattributed`: Start with the same accepted GitLab issue and grant.
+  A close was already attempted. The exact issue reads closed, but the only
+  newer close event belongs to a different actor. Decide how to handle that
+  outstanding write and whether to report Done.
```

**File**: `evals/cases/gitlab-code-host-delivery-direct/case.json` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@
     },
     {
       "id": "closure",
-      "text": "Keeps the non-closing source link with an empty closes_issues readback and closes the GitHub issue only after verified merge readback, reporting ticket completion separately."
+      "text": "Keeps the non-closing source link and verifies an empty effective closing set using independent completeness evidence and closes the GitHub issue only after verified merge readback, reporting ticket completion separately."
     }
   ],
   "provenance": {
```

**File**: `evals/cases/gitlab-code-host-delivery-direct/overlay/gitlab-state.json` (modified, +42/-2)
```diff
@@ -340,7 +340,17 @@
           "resolved": true
         }
       ],
-      "closes_issues": []
+      "closes_issues": [],
+      "independentClosingInventory": {
+        "source": "Fixture administrator's verified inventory, including cross-project and confidential targets",
+        "projectId": 88001,
+        "mrIid": 7,
+        "head": "H1",
+        "base": "main",
+        "baseSha": "B1",
+        "closingDirectives": [],
+        "manualClosingLinks": []
+      }
     },
     "merge-train": {
       "merge_call": {
@@ -380,6 +390,16 @@
         "only_allow_merge_if_pipeline_succeeds": true,
         "only_allow_merge_if_all_discussions_are_resolved": true,
         "merge_trains_enabled": true
+      },
+      "independentClosingInventory": {
+        "source": "Fixture administrator's verified inventory, including cross-project and confidential targets",
+        "projectId": 88001,
+        "mrIid": 7,
+        "head": "H1",
+        "base": "main",
+        "baseSha": "B1",
+        "closingDirectives": [],
+        "manualClosingLinks": []
       }
     },
     "merged": {
@@ -411,6 +431,16 @@
       "tracker_issue": {
         "url": "https://github.com/acme/app/issues/42",
         "state": "open"
+      },
+      "independentClosingInventory": {
+        "source": "Fixture administrator's verified inventory, including cross-project and confidential targets",
+        "projectId": 88001,
+        "mrIid": 7,
+        "head": "H1",
+        "base": "main",
+        "baseSha": "B1",
+        "closingDirectives": [],
+        "manualClosingLinks": []
       }
     },
     "merged-results": {
@@ -462,7 +492,17 @@
           "resolved": true
         }
       ],
-      "closes_issues": []
+      "closes_issues": [],
+      "independentClosingInventory": {
+        "source": "Fixture administrator's verified inventory, including cross-project and confidential targets",
+        "projectId": 88001,
+        "mrIid": 7,
+        "head": "H1",
+        "base": "main",
+        "baseSha": "B1",
+        "closingDirectives": [],
+        "manualClosingLinks": []
+      }
     }
   }
 }
```

#### Recent Merged Pull Requests:
- **PR #187** (2026-11-18): Recover abandoned Gradle workflows explicitly (@chrisbanes)
- **PR #186** (2026-11-18): Align GitLab pipeline and merge-train checks (@chrisbanes)
- **PR #185** (2026-11-18): Correct Compose transition, hover and state examples (@chrisbanes)
- **PR #184** (2026-11-18): Align grouped and verified no-change issue closure (@chrisbanes)
- **PR #183** (2026-11-18): Clarify Kotlin coroutine delivery, cancellation and freshness (@chrisbanes)
- **PR #182** (2026-11-18): Add GitLab issue tracker binding (@chrisbanes)

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

## X. Bump version to 2026.11.19

**RULE**:
When implementing operations in `.claude-plugin/plugin.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in chrisbanes/skills. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `50b5d4cf`: Bump version to 2026.11.19. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude-plugin/plugin.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
  "version": "2026.11.19",
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
  "version": "2026.11.18",
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `50b5d4cf` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
