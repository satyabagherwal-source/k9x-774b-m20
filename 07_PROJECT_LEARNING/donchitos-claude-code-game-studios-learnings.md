# Forensic Learning Record (Deep Inspection): Donchitos/Claude-Code-Game-Studios

> **Canonical Artifact**: `07_PROJECT_LEARNING/donchitos-claude-code-game-studios-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:39:49.017Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Donchitos/Claude-Code-Game-Studios`
- **Description**: Turn Claude Code into a full game dev studio — 49 AI agents, 72 workflow skills, and a complete coordination system mirroring real studio hierarchy.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 25781 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #71** (2026-05-26): **[Bug] /start and all 73 skills not available after clone — .claude/skills/ not recognized by Claude Code**
  *Symptoms*: ## Description  After following the Getting Started steps exactly (clone → claude → /start), no skills appear as slash commands. Claude Code reads custom commands from .claude/commands/, not .claude/skills/. The entire skill library needs to either be moved to .claude/commands/, or the setup instructions need a step to generate/symlink them there. Confirmed on Claude Code 2.1.150 on macOS (Terminal and VS Code)  ## Steps to Reproduce  1. Open Claude Code in a project using this template 2. Run /start 3. ... 4. See error  ## Expected Behavior  /start and other skills are recognized   ## Actual Behavior  Skills are not recognized   ## Environment  - **OS**: macOS Tahoe - **Shell**: zsh - **Claude Code version**: 2.1.150 - **Node.js version**: v24.15.0 - **jq installed?**: Yes - **Python installed?**: Yes

- **Issue #39** (2026-05-02): **[Bug] session-start.sh preview shows oldest session extracts instead of most recent (head → tail)**
  *Symptoms*: Summary    The SessionStart hook's "Quick summary" preview of production/session-state/active.md shows the oldest entries instead of the most recent, because it uses "head -20". Since all skills   that write to active.md append new extracts to the end of the file (per their SKILL.md specs), the preview surfaces stale session state on every session start, even when the file is   fully up to date.    File / Line    .claude/hooks/session-start.sh:66    head -20 "$STATE_FILE" 2>/dev/null    Reproduction    1. Run /review-all-gdds (or any skill that appends to active.md) several times across multiple sessions.   2. Open a new Claude Code session in the same project.   3. The SessionStart hook's "Quick summary" block displays the very first session extracts ever written, not the most recent ones.    Expected vs actual    - Expected: Preview shows the most recent session extracts so Claude / the user can pick up where the last session left off.   - Actual: Preview shows the oldest extracts (from the top of the file), making fresh work invisible and creating the false impression that active.md is stale.    Why it matters    Multiple skills are designed around this preview (/review-all-gdds, /architecture-review, /design-system, /dev-story, /story-done, /map-systems, /create-architecture, /ux-design,   etc. — all append ## Session Extract — … blocks to the end of active.md). The append convention is explicit in their SKILL.md files. The hook's head read contradicts the convention   an

- **Issue #37** (2026-05-02): **[Bug] Parse-checks fail silently due to invalid ripgrep type 'gdscript'**
  *Symptoms*: ## Description  Was working on a GDD review on a GODOT 4.5.2 when got the critical Engine fact marked by the godot-gdscript-specialist that there is no gdscript type so its producing a hard error at every CI invocation. A clear description of what the bug is.  ## Steps to Reproduce  1. Open Claude Code in a project using this template 2. Run `/<skill>` or trigger `<agent>` 3. ... 4. See error  ## Expected Behavior  What you expected to happen.  ## Actual Behavior  Critical engine fact discovered (informs all 3 fixes) rg --type-list on this host (ripgrep 14.1.1) shows:  gap: *.g, *.gap, *.gd, *.gi, *.tst *.gd is registered to ripgrep's gap type (GAP/Gap programming language), NOT gdscript. There is no gdscript type. So --type gdscript produces a hard error at every CI invocation — predicate text is silently never executed. Confirms godot-gdscript-specialist B2 finding. All *.gd filtering must use --glob "*.gd" (or alternately a custom type def, but --glob is simpler and version-portable).  ## Environment  - **OS**: (Windows 11 - **Shell**: Claude Code deskptop App - **Claude Code version**: 2.1.113 - **Node.js version**: V24.14.1 - **jq installed?**:  No - **Python installed?**: Yes   ## Affected Component  - [ X] Agent ():godot-gdscript-specialist - [ ] Skill (which one?): - [ ] Hook (which one?): - [ ] Rule (which one?): - [ ] Template - [ ] Documentation - [ ] Other:  ## Additional Context  Srry if really vague, first time doing this so not sure exactly how to fill all Step

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

### Incident Patch 1: `7ad8ab31` (2026-05-03)
**Commit Message**: Fix architecture-decision skill: duplicate ## 0. heading + broken step numbering (#45)

* Fix architecture-decision skill: duplicate ## 0. heading + broken step numbering

Resolves #44. Renumbers the duplicate '## 0. Load Engine Context' to '## 1.',
shifts all subsequent H2 headings (1→2, 2→3, 3→4, 4→5), renames '## 7. Closing
Next Steps' to '## 6.', and updates all inline cross-references (sub-step labels
4.5/4.6/4.7 → 5.5/5.6/5.7, section refs '### 2a' → '### 3a', 'Step 3' → 'Step 4').

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

* Fix three stale Step 0 cross-references missed in #45

Lines 51, 61, and 69 still pointed to "Step 0" after Load Engine Context
was renumbered to ## 1. in the previous fix — updated all three to Step 1.

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `.claude/skills/architecture-decision/SKILL.md` (modified, +17/-17)
```diff
@@ -48,7 +48,7 @@ Enter **retrofit mode**:
      Options: "Proposed", "Accepted", "Deprecated", "Superseded by ADR-XXXX"
    - For **ADR Dependencies**: ask — "Does this decision depend on any other ADR?
      Does it enable or block any other ADR or epic?" Accept "None" for each field.
-   - For **Engine Compatibility**: read the engine reference docs (same as Step 0 below)
+   - For **Engine Compatibility**: read the engine reference docs (same as Step 1 below)
      and ask the user to confirm the domain. Then generate the table with verified data.
    - For **GDD Requirements Addressed**: ask — "Which GDD systems motivated this decision?
      What specific requirement in each GDD does this ADR address?"
@@ -58,19 +58,19 @@ Enter **retrofit mode**:
 7. Suggest: "Run `/architecture-review` to re-validate coverage now that this ADR
    has its Status and Dependencies fields."
 
-If NOT in retrofit mode, proceed to Step 0 below (normal ADR authoring).
+If NOT in retrofit mode, proceed to Step 1 below (normal ADR authoring).
 
 **No-argument guard**: If no argument was provided (title is empty), ask before
 running Phase 0:
 
 > "What technical decision are you documenting? Please provide a short title
 > (e.g., `event-system-architecture`, `physics-engine-choice`)."
 
-Use the user's response as the title, then proceed to Step 0.
+Use the user's response as the title, then proceed to Step 1.
 
 ---
 
-## 0. Load Engine Context (ALWAYS FIRST)
+## 1. Load Engine Context (ALWAYS FIRST)
 
 Before doing anything else, establish the engine environment:
 
@@ -114,17 +114,17 @@ Before doing anything else, establish the engine environment:
 
 ---
 
-## 1. Determine the next ADR number
+## 2. Determine the next ADR number
 
 Scan `docs/architecture/` for existing ADRs to find the next number.
 
 ---
 
-## 2. Gather context
+## 3. Gather context
 
 Read related code, existing ADRs, and relevant GDDs from `design/gdd/`.
 
-### 2a: Architecture Registry Check (BLOCKING gate)
+### 3a: Architecture Registry Check (BLOCKING gate)
 
 Read `docs/registry/architecture.yaml`. Extract entries relevant to this ADR's
 domain and decision (grep by system name, domain keyword, or state being touched).
@@ -160,12 +160,12 @@ the conflict immediately:
 > Options: (1) Align with the existing stance, (2) Supersede ADR-[NNNN] with
 > an explicit replacement, (3) Explain why this case is an exception."
 
-Do not proceed to Step 3 (collaborative design) until any conflict is resolved
+Do not proceed to Step 4 (collaborative design) until any conflict is resolved
 or explicitly accepted as an intentional exception.
 
 ---
 
-## 3. Guide the decision collaboratively
+## 4. Guide the decision collaboratively
 
 Before asking anything, derive the skill's best guesses from the context already
 gathered (GDDs read, engine reference loaded, existing ADRs scanned). Then present
@@ -205,7 +205,7 @@ Status: Proposed
 
 Do not generate the ADR until the user confirms assumptions or provides corrections.
 
-**After engine specialist and TD reviews return** (Step 4.5/4.6), if unresolved
+**After engine specialist and TD reviews return** (Step 5.5/5.6), if unresolved
 decisions remain, present each one as a separate `AskUserQuestion` with the proposed
 options as choices plus a free-text escape:
 
@@ -225,7 +225,7 @@ Record answers in the **ADR Dependencies** section. Write "None" for each field
 
 ---
 
-## 4. Generate the ADR
+## 5. Generate the ADR
 
 Following this format:
 
@@ -334,7 +334,7 @@ to implement it.]
 - [Links to related design documents]
 ```
 
-4.5. **Engine Specialist Validation** — Before saving, spawn the **primary engine specialist** via Task to validate the drafted ADR:
+5.5. **Engine Specialist Validation** — Before saving, spawn the **primary engine specialist** via Task to validate the drafted ADR:
    - Read `.claude/docs/technical-preferences.md` `Engine Specialists` section to get the primary specialist
    - If no engine is configured (`[TO BE CONFIGURED]`), skip this step
    - Spawn `subagent_type: [primary specialist]` with: the ADR's Engine Compatibility section, Decision section, Key Interfaces, and the engine reference docs path. Ask them to:
@@ -345,16 +345,16 @@ to implement it.]
    - If the specialist finds **minor notes** only: incorporate them into the ADR's Risks subsection
 
 **Review mode check** — apply before spawning TD-ADR:
-- `solo` → skip. Note: "TD-ADR skipped — Solo mode." Proceed to Step 4.7 (GDD sync check).
-- `lean` → skip (not a PHASE-GATE). Note: "TD-ADR skipped — Lean mode." Proceed to Step 4.7 (GDD sync check).
+- `solo` → skip. Note: "TD-ADR skipped — Solo mode." Proceed to Step 5.7 (GDD sync check).
+- `lean` → skip (not a PHASE-GATE). Note: "TD-ADR skipped — Lean mode." Proceed to Step 5.7 (GDD sync check).
 - `full` → spawn as normal.
 
-4.6. **Technical Director Strategic Review** — After the engine specialist validation, spawn `technical-director` via Task using gate **TD-ADR** (`.claud
```

---

### Incident Patch 2: `a1697d67` (2026-05-02)
**Commit Message**: Fix: session-start preview shows most recent state instead of oldest (#43)

Replace head with tail so the quick summary surfaces the last 20 lines
of active.md — where all skills append their session extracts — rather
than the first 20 lines which grow stale as the file accumulates history.

Fixes #39

Co-authored-by: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `.claude/hooks/session-start.sh` (modified, +2/-2)
```diff
@@ -62,8 +62,8 @@ if [ -f "$STATE_FILE" ]; then
     echo "A previous session left state at: $STATE_FILE"
     echo "Read this file to recover context and continue where you left off."
     echo ""
-    echo "Quick summary:"
-    head -20 "$STATE_FILE" 2>/dev/null
+    echo "Quick summary (last 20 lines):"
+    tail -20 "$STATE_FILE" 2>/dev/null
     TOTAL_LINES=$(wc -l < "$STATE_FILE" 2>/dev/null)
     if [ "$TOTAL_LINES" -gt 20 ]; then
         echo "  ... ($TOTAL_LINES total lines — read the full file to continue)"
```

---

### Incident Patch 3: `9a4243b3` (2026-05-02)
**Commit Message**: Fix: rg --type gdscript is invalid — use --glob *.gd instead (#42)

* Fix: document that rg --type gdscript is invalid, use --glob *.gd instead

Closes #37. ripgrep has no gdscript type — *.gd files are registered under
the gap type (GAP programming language). Using --type gdscript produces a
hard error, silently preventing any search from executing.

Added explicit warnings in two places:
- .claude/agents/godot-gdscript-specialist.md: new Tooling section with
  the correct Grep tool param (glob: "*.gd") and shell equivalent
- docs/engine-reference/godot/current-best-practices.md: new Tooling
  section agents read at version-check time

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

* Fix: propagate rg --glob *.gd tooling warning to all Godot agents

Closes the coverage gap identified in PR #42 review — the ripgrep
gdscript-type warning was only in godot-gdscript-specialist. Added
the same CRITICAL tooling section to godot-specialist,
godot-gdextension-specialist, godot-shader-specialist, and
godot-csharp-specialist so no Godot agent can silently misfire a search.

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Sonnet 4.6 <[REDACTED_E

**File**: `.claude/agents/godot-csharp-specialist.md` (modified, +10/-0)
```diff
@@ -388,6 +388,16 @@ Do NOT rely on inline version claims in this file — they may be wrong. Always
 
 When in doubt, prefer the API documented in the reference files over your training data.
 
+## Tooling — ripgrep File Filtering
+
+**CRITICAL**: There is no `gdscript` type in ripgrep. `*.gd` files are registered
+under the `gap` type (GAP programming language). Using `--type gdscript` or passing
+`type: "gdscript"` to the Grep tool produces a hard error — the search never executes.
+
+**Always use `glob: "*.gd"`** when filtering GDScript files:
+- Grep tool: `glob: "*.gd"` ✓  |  `type: "gdscript"` ✗
+- Shell/CI: `rg --glob "*.gd"` ✓  |  `rg --type gdscript` ✗
+
 ## Coordination
 - Work with **godot-specialist** for overall Godot architecture and scene design
 - Work with **gameplay-programmer** for gameplay system implementation
```

**File**: `.claude/agents/godot-gdextension-specialist.md` (modified, +10/-0)
```diff
@@ -298,6 +298,16 @@ that may affect native bindings.
 
 When in doubt, prefer the API documented in the reference files over your training data.
 
+## Tooling — ripgrep File Filtering
+
+**CRITICAL**: There is no `gdscript` type in ripgrep. `*.gd` files are registered
+under the `gap` type (GAP programming language). Using `--type gdscript` or passing
+`type: "gdscript"` to the Grep tool produces a hard error — the search never executes.
+
+**Always use `glob: "*.gd"`** when filtering GDScript files:
+- Grep tool: `glob: "*.gd"` ✓  |  `type: "gdscript"` ✗
+- Shell/CI: `rg --glob "*.gd"` ✓  |  `rg --type gdscript` ✗
+
 ## Coordination
 - Work with **godot-specialist** for overall Godot architecture
 - Work with **godot-gdscript-specialist** for GDScript/native boundary decisions
```

**File**: `.claude/agents/godot-gdscript-specialist.md` (modified, +10/-0)
```diff
@@ -254,6 +254,16 @@ for the full list.
 
 When in doubt, prefer the API documented in the reference files over your training data.
 
+## Tooling — ripgrep File Filtering
+
+**CRITICAL**: There is no `gdscript` type in ripgrep. `*.gd` files are registered
+under the `gap` type (GAP programming language). Using `--type gdscript` or passing
+`type: "gdscript"` to the Grep tool produces a hard error — the search never executes.
+
+**Always use `glob: "*.gd"`** when filtering GDScript files:
+- Grep tool: `glob: "*.gd"` ✓  |  `type: "gdscript"` ✗
+- Shell/CI: `rg --glob "*.gd"` ✓  |  `rg --type gdscript` ✗
+
 ## Coordination
 - Work with **godot-specialist** for overall Godot architecture
 - Work with **gameplay-programmer** for gameplay system implementation
```

**File**: `.claude/agents/godot-shader-specialist.md` (modified, +10/-0)
```diff
@@ -246,6 +246,16 @@ stencil buffer (4.5), shader texture types changed from `Texture2D` to
 
 When in doubt, prefer the API documented in the reference files over your training data.
 
+## Tooling — ripgrep File Filtering
+
+**CRITICAL**: There is no `gdscript` type in ripgrep. `*.gd` files are registered
+under the `gap` type (GAP programming language). Using `--type gdscript` or passing
+`type: "gdscript"` to the Grep tool produces a hard error — the search never executes.
+
+**Always use `glob: "*.gd"`** when filtering GDScript files:
+- Grep tool: `glob: "*.gd"` ✓  |  `type: "gdscript"` ✗
+- Shell/CI: `rg --glob "*.gd"` ✓  |  `rg --type gdscript` ✗
+
 ## Coordination
 - Work with **godot-specialist** for overall Godot architecture
 - Work with **art-director** for visual direction and material standards
```

**File**: `.claude/agents/godot-specialist.md` (modified, +10/-0)
```diff
@@ -173,6 +173,16 @@ introduced after May 2025, use WebSearch to verify it exists in the current vers
 
 When in doubt, prefer the API documented in the reference files over your training data.
 
+## Tooling — ripgrep File Filtering
+
+**CRITICAL**: There is no `gdscript` type in ripgrep. `*.gd` files are registered
+under the `gap` type (GAP programming language). Using `--type gdscript` or passing
+`type: "gdscript"` to the Grep tool produces a hard error — the search never executes.
+
+**Always use `glob: "*.gd"`** when filtering GDScript files:
+- Grep tool: `glob: "*.gd"` ✓  |  `type: "gdscript"` ✗
+- Shell/CI: `rg --glob "*.gd"` ✓  |  `rg --type gdscript` ✗
+
 ## When Consulted
 Always involve this agent when:
 - Adding new autoloads or singletons
```

**File**: `docs/engine-reference/godot/current-best-practices.md` (modified, +6/-0)
```diff
@@ -93,6 +93,12 @@ This supplements (not replaces) the agent's built-in knowledge.
 - Live preview in Quick Open dialog when "Live Preview" enabled
 - New "Select Mode" (v key) prevents accidental transforms; old mode renamed "Transform Mode" (q key)
 
+## Tooling
+
+- **ripgrep has no `gdscript` type**: `*.gd` is registered under `gap` (GAP programming language).
+  `rg --type gdscript` is a hard error — the search never executes.
+  Always use `rg --glob "*.gd"` (shell) or `glob: "*.gd"` (Grep tool) to filter GDScript files.
+
 ## Platform (4.5+)
 
 - **visionOS export**: First new platform since open-sourcing (windowed app mode)
```

---

### Incident Patch 4: `9ccc5440` (2026-04-24)
**Commit Message**: Fix missing allowed-tools in /architecture-decision and /story-done (#36)

- Add Edit to architecture-decision allowed-tools (retrofit mode and
  registry append both call Edit on existing files — was throwing a
  permission error on every /architecture-decision retrofit run)
- Add Write to story-done allowed-tools (Phase 7 creates active.md on
  first run — was silently failing and losing completion notes)

Fixes #33. Bug found and fix branches prepared by @xiaolai via NLPM audit.

Co-authored-by: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `.claude/skills/architecture-decision/SKILL.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ name: architecture-decision
 description: "Creates an Architecture Decision Record (ADR) documenting a significant technical decision, its context, alternatives considered, and consequences. Every major technical choice should have an ADR."
 argument-hint: "[title] [--review full|lean|solo]"
 user-invocable: true
-allowed-tools: Read, Glob, Grep, Write, Task, AskUserQuestion
+allowed-tools: Read, Glob, Grep, Write, Edit, Task, AskUserQuestion
 ---
 
 When this skill is invoked:
```

**File**: `.claude/skills/story-done/SKILL.md` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ name: story-done
 description: "End-of-story completion review. Reads the story file, verifies each acceptance criterion against the implementation, checks for GDD/ADR deviations, prompts code review, updates story status to Complete, and surfaces the next ready story from the sprint."
 argument-hint: "[story-file-path] [--review full|lean|solo]"
 user-invocable: true
-allowed-tools: Read, Glob, Grep, Bash, Edit, AskUserQuestion, Task
+allowed-tools: Read, Glob, Grep, Bash, Write, Edit, AskUserQuestion, Task
 ---
 
 # Story Done
```

---

### Incident Patch 5: `666e0fcb` (2026-04-10)
**Commit Message**: Fix log-agent hooks reading wrong field — audit trail always logged "unknown" (#21)

Both SubagentStart/SubagentStop hooks were extracting `.agent_name` from the
hook payload, but Claude Code emits the agent name in `agent_type`. This caused
every audit log entry to fall through to the "unknown" fallback, making the
entire agent audit trail useless.

Fix: swap `.agent_name` -> `.agent_type` in both the jq path and the grep/sed
fallback for systems without jq. Log output format is unchanged so existing
audit logs remain valid.

Bug reported and fix authored by @bobloy in issue #20:
https://github.com/Donchitos/Claude-Code-Game-Studios/issues/20

Co-authored-by: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `.claude/hooks/log-agent-stop.sh` (modified, +9/-4)
```diff
@@ -2,16 +2,21 @@
 # Claude Code SubagentStop hook: Log agent completion for audit trail
 # Tracks when agents finish and their outcome
 #
-# Input schema (SubagentStop):
-# { "agent_id": "agent-abc123", "agent_name": "game-designer", ... }
+# Input schema (SubagentStop) — per Claude Code hooks reference:
+# { "session_id": "...", "agent_id": "agent-abc123", "agent_type": "Explore",
+#   "agent_transcript_path": "...", "last_assistant_message": "...", ... }
+#
+# The agent name is in `agent_type`, NOT `agent_name`. Reading `.agent_name`
+# returns null on every invocation, so the fallback "unknown" is always used
+# and the audit trail captures nothing useful.
 
 INPUT=$(cat)
 
 # Parse agent name -- use jq if available, fall back to grep
 if command -v jq >/dev/null 2>&1; then
-    AGENT_NAME=$(echo "$INPUT" | jq -r '.agent_name // "unknown"' 2>/dev/null)
+    AGENT_NAME=$(echo "$INPUT" | jq -r '.agent_type // "unknown"' 2>/dev/null)
 else
-    AGENT_NAME=$(echo "$INPUT" | grep -oE '"agent_name"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"agent_name"[[:space:]]*:[[:space:]]*"//;s/"$//')
+    AGENT_NAME=$(echo "$INPUT" | grep -oE '"agent_type"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"agent_type"[[:space:]]*:[[:space:]]*"//;s/"$//')
     [ -z "$AGENT_NAME" ] && AGENT_NAME="unknown"
 fi
 
```

**File**: `.claude/hooks/log-agent.sh` (modified, +8/-4)
```diff
@@ -2,16 +2,20 @@
 # Claude Code SubagentStart hook: Log agent invocations for audit trail
 # Tracks which agents are being used and when
 #
-# Input schema (SubagentStart):
-# { "agent_id": "agent-abc123", "agent_name": "game-designer", ... }
+# Input schema (SubagentStart) — per Claude Code hooks reference:
+# { "session_id": "...", "agent_id": "agent-abc123", "agent_type": "Explore", ... }
+#
+# The agent name is in `agent_type`, NOT `agent_name`. Reading `.agent_name`
+# returns null on every invocation, so the fallback "unknown" is always used
+# and the audit trail captures nothing useful.
 
 INPUT=$(cat)
 
 # Parse agent name -- use jq if available, fall back to grep
 if command -v jq >/dev/null 2>&1; then
-    AGENT_NAME=$(echo "$INPUT" | jq -r '.agent_name // "unknown"' 2>/dev/null)
+    AGENT_NAME=$(echo "$INPUT" | jq -r '.agent_type // "unknown"' 2>/dev/null)
 else
-    AGENT_NAME=$(echo "$INPUT" | grep -oE '"agent_name"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"agent_name"[[:space:]]*:[[:space:]]*"//;s/"$//')
+    AGENT_NAME=$(echo "$INPUT" | grep -oE '"agent_type"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"agent_type"[[:space:]]*:[[:space:]]*"//;s/"$//')
     [ -z "$AGENT_NAME" ] && AGENT_NAME="unknown"
 fi
 
```

---

### Incident Patch 6: `223949a0` (2026-04-07)
**Commit Message**: Prep v1 beta release: fix stale refs, counts, and add sponsorship links

- Fix agent count: 48 → 49 in README.md (2 locations)
- Fix skill count: 70 → 72 in README.md (5 locations)
- Remove non-existent agents (ml-engineer, deployment-engineer, database-admin) from CCGS Testing Framework docs
- Replace Ko-fi with Buy Me a Coffee (buymeacoffee.com/donchitos3)
- Add GitHub Sponsors (github.com/sponsors/Donchitos) badge and section
- Add Supporting This Project section to README with ToC entry

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `CCGS Skill Testing Framework/CLAUDE.md` (modified, +3/-4)
```diff
@@ -52,17 +52,16 @@ directors   → creative-director, technical-director, producer, art-director
 leads       → lead-programmer, narrative-director, audio-director, ux-designer,
               qa-lead, release-manager, localization-lead
 specialists → gameplay-programmer, engine-programmer, ui-programmer,
-              tools-programmer, network-programmer, ml-engineer, ai-programmer,
+              tools-programmer, network-programmer, ai-programmer,
               level-designer, sound-designer, technical-artist
 godot       → godot-specialist, godot-gdscript-specialist, godot-csharp-specialist,
               godot-shader-specialist, godot-gdextension-specialist
 unity       → unity-specialist, unity-ui-specialist, unity-shader-specialist,
               unity-dots-specialist, unity-addressables-specialist
 unreal      → unreal-specialist, ue-gas-specialist, ue-replication-specialist,
               ue-umg-specialist, ue-blueprint-specialist
-operations  → devops-engineer, deployment-engineer, database-admin,
-              security-engineer, performance-analyst, analytics-engineer,
-              community-manager
+operations  → devops-engineer, security-engineer, performance-analyst,
+              analytics-engineer, community-manager
 creative    → writer, world-builder, game-designer, economy-designer,
               systems-designer, prototyper
 ```
```

**File**: `CCGS Skill Testing Framework/README.md` (modified, +2/-2)
```diff
@@ -109,11 +109,11 @@ All testing is driven by two skills already in the framework:
 |------|--------|
 | `directors` | creative-director, technical-director, producer, art-director |
 | `leads` | lead-programmer, narrative-director, audio-director, ux-designer, qa-lead, release-manager, localization-lead |
-| `specialists` | gameplay-programmer, engine-programmer, ui-programmer, tools-programmer, network-programmer, ml-engineer, ai-programmer, level-designer, sound-designer, technical-artist |
+| `specialists` | gameplay-programmer, engine-programmer, ui-programmer, tools-programmer, network-programmer, ai-programmer, level-designer, sound-designer, technical-artist |
 | `godot` | godot-specialist, godot-gdscript-specialist, godot-csharp-specialist, godot-shader-specialist, godot-gdextension-specialist |
 | `unity` | unity-specialist, unity-ui-specialist, unity-shader-specialist, unity-dots-specialist, unity-addressables-specialist |
 | `unreal` | unreal-specialist, ue-gas-specialist, ue-replication-specialist, ue-umg-specialist, ue-blueprint-specialist |
-| `operations` | devops-engineer, deployment-engineer, database-admin, security-engineer, performance-analyst, analytics-engineer, community-manager |
+| `operations` | devops-engineer, security-engineer, performance-analyst, analytics-engineer, community-manager |
 | `creative` | writer, world-builder, game-designer, economy-designer, systems-designer, prototyper |
 
 ---
```

**File**: `README.md` (modified, +27/-8)
```diff
@@ -3,18 +3,19 @@
   <p align="center">
     Turn a single Claude Code session into a full game development studio.
     <br />
-    49 agents. 70 skills. One coordinated AI team.
+    49 agents. 72 skills. One coordinated AI team.
   </p>
 </p>
 
 <p align="center">
   <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
   <a href=".claude/agents"><img src="https://img.shields.io/badge/agents-49-blueviolet" alt="49 Agents"></a>
-  <a href=".claude/skills"><img src="https://img.shields.io/badge/skills-70-green" alt="70 Skills"></a>
+  <a href=".claude/skills"><img src="https://img.shields.io/badge/skills-72-green" alt="72 Skills"></a>
   <a href=".claude/hooks"><img src="https://img.shields.io/badge/hooks-12-orange" alt="12 Hooks"></a>
   <a href=".claude/rules"><img src="https://img.shields.io/badge/rules-11-red" alt="11 Rules"></a>
   <a href="https://docs.anthropic.com/en/docs/claude-code"><img src="https://img.shields.io/badge/built%20for-Claude%20Code-f5f5f5?logo=anthropic" alt="Built for Claude Code"></a>
-  <a href="https://ko-fi.com/donchitos"><img src="https://img.shields.io/badge/Ko--fi-Support%20this%20project-ff5e5b?logo=ko-fi&logoColor=white" alt="Ko-fi"></a>
+  <a href="https://www.buymeacoffee.com/donchitos3"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20this%20project-FFDD00?logo=buymeacoffee&logoColor=black" alt="Buy Me a Coffee"></a>
+  <a href="https://github.com/sponsors/Donchitos"><img src="https://img.shields.io/badge/GitHub%20Sponsors-Support%20this%20project-ea4aaa?logo=githubsponsors&logoColor=white" alt="GitHub Sponsors"></a>
 </p>
 
 ---
@@ -23,7 +24,7 @@
 
 Building a game solo with AI is powerful — but a single chat session has no structure. No one stops you from hardcoding magic numbers, skipping design docs, or writing spaghetti code. There's no QA pass, no design review, no one asking "does this actually fit the game's vision?"
 
-**Claude Code Game Studios** solves this by giving your AI session the structure of a real studio. Instead of one general-purpose assistant, you get 48 specialized agents organized into a studio hierarchy — directors who guard the vision, department leads who own their domains, and specialists who do the hands-on work. Each agent has defined responsibilities, escalation paths, and quality gates.
+**Claude Code Game Studios** solves this by giving your AI session the structure of a real studio. Instead of one general-purpose assistant, you get 49 specialized agents organized into a studio hierarchy — directors who guard the vision, department leads who own their domains, and specialists who do the hands-on work. Each agent has defined responsibilities, escalation paths, and quality gates.
 
 The result: you still make every decision, but now you have a team that asks the right questions, catches mistakes early, and keeps your project organized from first brainstorm to launch.
 
@@ -42,6 +43,7 @@ The result: you still make every decision, but now you have a team that asks the
 - [Customization](#customization)
 - [Platform Support](#platform-support)
 - [Community](#community)
+- [Supporting This Project](#supporting-this-project)
 - [License](#license)
 
 ---
@@ -51,7 +53,7 @@ The result: you still make every decision, but now you have a team that asks the
 | Category | Count | Description |
 |----------|-------|-------------|
 | **Agents** | 49 | Specialized subagents across design, programming, art, audio, narrative, QA, and production |
-| **Skills** | 70 | Slash commands for every workflow phase (`/start`, `/design-system`, `/create-epics`, `/create-stories`, `/dev-story`, `/story-done`, etc.) |
+| **Skills** | 72 | Slash commands for every workflow phase (`/start`, `/design-system`, `/create-epics`, `/create-stories`, `/dev-story`, `/story-done`, etc.) |
 | **Hooks** | 12 | Automated validation on commits, pushes, asset changes, session lifecycle, agent audit trail, and gap detection |
 | **Rules** | 11 | Path-scoped coding standards enforced when editing gameplay, engine, AI, UI, network code, and more |
 | **Templates** | 39 | Document templates for GDDs, UX specs, ADRs, sprint plans, HUD design, accessibility, and more |
@@ -92,7 +94,7 @@ The template includes agent sets for all three major engines. Use the set that m
 
 ## Slash Commands
 
-Type `/` in Claude Code to access all 70 skills:
+Type `/` in Claude Code to access all 72 skills:
 
 **Onboarding & Navigation**
 `/start` `/help` `/project-stage-detect` `/setup-engine` `/adopt`
@@ -173,8 +175,8 @@ versions, and which files are safe to overwrite vs. which need a manual merge.
 CLAUDE.md                           # Master configuration
 .claude/
   settings.json                     # Hooks, permissions, safety rules
-  agents/                           # 48 agent definitions (markdown + YAML frontmatter)
-  skills/                           # 70 slash commands (subdirectory per skill)
+  agents/                   
```

---

### Incident Patch 7: `a73ff759` (2026-04-06)
**Commit Message**: Add v0.5.0: CCGS Skill Testing Framework, skill-improve, 4 new skills, director gate path fixes

- Add CCGS Skill Testing Framework: self-contained QA layer with 72 skill specs,
  49 agent specs, catalog.yaml, quality-rubric.md, templates, README, CLAUDE.md
- Add /skill-improve: test-fix-retest loop covering static + category checks
- Add 4 missing skills: /art-bible, /asset-spec, /day-one-patch, /security-audit
- Add /skill-test category mode (Phase 2D) with quality rubric evaluation
- Extend /skill-test audit to cover agent specs alongside skill specs
- Update all skill-test and skill-improve path refs to CCGS Skill Testing Framework/
- Remove stale tests/skills/ directory (superseded by CCGS Skill Testing Framework)
- Add director gate intensity modes (full/lean/solo) to gate-check and related skills

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `.claude/docs/director-gates.md` (modified, +103/-10)
```diff
@@ -43,9 +43,9 @@ Examples:
 
 | Mode | What runs | Best for |
 |------|-----------|----------|
-| `full` | All gates active — current behaviour | New projects, teams, learning the workflow |
-| `lean` | PHASE-GATEs only (`/gate-check`) — all per-skill gates skipped | Experienced devs who trust their own design work |
-| `solo` | No director gates anywhere | Game jams, prototypes, seasoned solo devs at speed |
+| `full` | All gates active — every workflow step reviewed | Teams, learning users, or when you want thorough director feedback at every step |
+| `lean` | PHASE-GATEs only (`/gate-check`) — per-skill gates skipped | **Default** — solo devs and small teams; directors review at milestones only |
+| `solo` | No director gates anywhere | Game jams, prototypes, maximum speed |
 
 **Check pattern — apply before every gate spawn:**
 
@@ -66,7 +66,18 @@ Apply the resolved mode:
 
 ## Invocation Pattern (copy into any skill)
 
+**MANDATORY: Resolve review mode before every gate spawn.** Never spawn a gate without checking. The resolved mode is determined once per skill run:
+1. If skill was called with `--review [mode]`, use that
+2. Else read `production/review-mode.txt`
+3. Else default to `lean`
+
+Apply the resolved mode:
+- `solo` → **skip all gates**. Note in output: `[GATE-ID] skipped — Solo mode`
+- `lean` → **skip unless this is a PHASE-GATE** (CD-PHASE-GATE, TD-PHASE-GATE, PR-PHASE-GATE, AD-PHASE-GATE). Note: `[GATE-ID] skipped — Lean mode`
+- `full` → spawn as normal
+
 ```
+# Apply mode check, then:
 Spawn `[agent-name]` via Task:
 - Gate: [GATE-ID] (see .claude/docs/director-gates.md)
 - Context: [fields listed under that gate]
@@ -76,6 +87,7 @@ Spawn `[agent-name]` via Task:
 For parallel spawning (multiple directors at the same gate point):
 
 ```
+# Apply mode check for each gate first, then spawn all that survive:
 Spawn all [N] agents simultaneously via Task — issue all Task calls before
 waiting for any result. Collect all verdicts before proceeding.
 ```
@@ -524,6 +536,86 @@ is invoked
 
 ---
 
+## Tier 1 — Art Director Gates
+
+Agent: `art-director` | Model tier: Sonnet | Domain: Visual identity, art bible, visual production readiness
+
+---
+
+### AD-CONCEPT-VISUAL — Visual Identity Anchor
+
+**Trigger**: After game pillars are locked (brainstorm Phase 4), in parallel with CD-PILLARS
+
+**Context to pass**:
+- Game concept (elevator pitch, core fantasy, unique hook)
+- Full pillar set with names, definitions, and design tests
+- Target platform (if known)
+- Any reference games or visual touchstones mentioned by the user
+
+**Prompt**:
+> "Based on these game pillars and core concept, propose 2-3 distinct visual identity
+> directions. For each direction provide: (1) a one-line visual rule that could guide
+> all visual decisions (e.g., 'everything must move', 'beauty is in the decay'), (2)
+> mood and atmosphere targets, (3) shape language (sharp/rounded/organic/geometric
+> emphasis), (4) color philosophy (palette direction, what colors mean in this world).
+> Be specific — avoid generic descriptions. One direction should directly serve the
+> primary design pillar. Name each direction. Recommend which best serves the stated
+> pillars and explain why."
+
+**Verdicts**: CONCEPTS (multiple valid options — user selects) / STRONG (one direction clearly dominant) / CONCERNS (pillars don't provide enough direction to differentiate visual identity yet)
+
+---
+
+### AD-ART-BIBLE — Art Bible Sign-Off
+
+**Trigger**: After the art bible is drafted (`/art-bible`), before asset production begins
+
+**Context to pass**:
+- Art bible path (`design/art/art-bible.md`)
+- Game pillars and core fantasy
+- Platform and performance constraints (from `.claude/docs/technical-preferences.md` if configured)
+- Visual identity anchor chosen during brainstorm (from `design/gdd/game-concept.md`)
+
+**Prompt**:
+> "Review this art bible for completeness and internal consistency. Does the color
+> system match the mood targets? Does the shape language follow from the visual
+> identity statement? Are the asset standards achievable within the platform
+> constraints? Does the character design direction give artists enough to work from
+> without over-specifying? Are there contradictions between sections? Would an
+> outsourcing team be able to produce assets from this document without additional
+> briefing? Return APPROVE (art bible is production-ready), CONCERNS [specific
+> sections needing clarification], or REJECT [fundamental inconsistencies that must
+> be resolved before asset production begins]."
+
+**Verdicts**: APPROVE / CONCERNS / REJECT
+
+---
+
+### AD-PHASE-GATE — Visual Readiness at Phase Transition
+
+**Trigger**: Always at `/gate-check` — spawn in parallel with CD-PHASE-GATE, TD-PHASE-GATE, and PR-PHASE-GATE
+
+**Context to pass**:
+- Target phase name
+- List of all art/visual artifacts present (file paths)
+- Visual identity anchor from `design/gdd/game-concept.md` (if present)
+- Art bible p
```

**File**: `.claude/docs/workflow-catalog.yaml` (modified, +74/-4)
```diff
@@ -10,6 +10,9 @@
 # required: true → blocks progression to next phase (shown as REQUIRED)
 # required: false → optional enhancement (shown as OPTIONAL)
 # repeatable: true → runs multiple times (one per system, story, etc.)
+#
+# Phase gates (/gate-check): verdicts are ADVISORY — they guide the decision
+# but never hard-block advancement. The user always decides whether to proceed.
 
 phases:
 
@@ -47,6 +50,14 @@ phases:
         required: false
         description: "Validate the game concept (recommended before proceeding)"
 
+      - id: art-bible
+        name: "Art Bible"
+        command: /art-bible
+        required: true
+        artifact:
+          glob: "design/art/art-bible.md"
+        description: "Author the visual identity specification (9 sections). Uses the Visual Identity Anchor produced by /brainstorm. Run after game concept is formed, before systems design."
+
       - id: map-systems
         name: "Systems Map"
         command: /map-systems
@@ -84,9 +95,16 @@ phases:
           glob: "design/gdd/gdd-cross-review-*.md"
         description: "Holistic consistency check + design theory review across all GDDs simultaneously"
 
+      - id: consistency-check
+        name: "Consistency Check"
+        command: /consistency-check
+        required: false
+        repeatable: true
+        description: "Scan all GDDs for contradictions, undefined references, and mechanic conflicts. Run after /review-all-gdds, and again any time a GDD is added or revised mid-project."
+
   technical-setup:
     label: "Technical Setup"
-    description: "Architecture decisions, accessibility foundations, engine validation"
+    description: "Architecture decisions, visual identity specification, accessibility foundations, engine validation"
     next_phase: pre-production
     steps:
       - id: create-architecture
@@ -132,9 +150,18 @@ phases:
 
   pre-production:
     label: "Pre-Production"
-    description: "UX specs, prototype the core mechanic, define stories, validate fun"
+    description: "UX specs, asset specs, prototype the core mechanic, define stories, validate fun"
     next_phase: production
     steps:
+      - id: asset-spec
+        name: "Asset Specs"
+        command: /asset-spec
+        required: false
+        repeatable: true
+        artifact:
+          glob: "design/assets/asset-manifest.md"
+        description: "Generate per-asset visual specifications and AI generation prompts from approved GDDs and level docs. Run once per system/level/character."
+
       - id: ux-design
         name: "UX Specs (key screens)"
         command: /ux-design
@@ -180,6 +207,14 @@ phases:
           min_count: 2
         description: "Break each epic into implementable story files. Run per epic: /create-stories [epic-slug]"
 
+      - id: test-setup
+        name: "Test Framework Setup"
+        command: /test-setup
+        required: false
+        artifact:
+          note: "Check tests/ directory for engine-specific test framework scaffold"
+        description: "Scaffold the test framework and CI pipeline once before the first sprint. Leads to /test-helpers for fixture generation, /qa-plan per epic, and /smoke-check per sprint."
+
       - id: sprint-plan
         name: "First Sprint Plan"
         command: /sprint-plan
@@ -191,11 +226,12 @@ phases:
 
       - id: vertical-slice
         name: "Vertical Slice (playtested)"
+        command: /playtest-report
         required: true
         artifact:
           glob: "production/playtests/*.md"
           min_count: 1
-        description: "Playable end-to-end core loop, playtested with ≥3 sessions. HARD GATE."
+        description: "Document vertical slice playtest sessions using /playtest-report. Run at least once here (≥1 session required before Production; ≥3 required before Polish). Each session should cover one complete run-through of the core loop."
 
   production:
     label: "Production"
@@ -224,7 +260,14 @@ phases:
         repeatable: true
         artifact:
           note: "Check src/ for active code and production/epics/**/*.md for In Progress stories"
-        description: "Pick the next ready story and implement it with /dev-story [story-path]. Routes to the correct programmer agent. Then run /code-review and /story-done."
+        description: "Pick the next ready story and implement it with /dev-story [story-path]. Routes to the correct programmer agent."
+
+      - id: code-review
+        name: "Code Review"
+        command: /code-review
+        required: false
+        repeatable: true
+        description: "Architectural code review after each story implementation. Run after /dev-story, before /story-done."
 
       - id: story-done
         name: "Story Done Review"
@@ -233,6 +276,33 @@ phases:
         repeatable: true
         description: "Verify all acceptance criteria, check GDD/ADR deviations, close the story"
 
+      - id: qa-plan
+        name: "QA Plan"
+        command: /qa-plan
+        required: false
+  
```

**File**: `.claude/hooks/session-stop.sh` (modified, +3/-3)
```diff
@@ -11,17 +11,17 @@ mkdir -p "$SESSION_LOG_DIR" 2>/dev/null
 RECENT_COMMITS=$(git log --oneline --since="8 hours ago" 2>/dev/null)
 MODIFIED_FILES=$(git diff --name-only 2>/dev/null)
 
-# --- Clean up active session state on normal shutdown ---
+# --- Archive active session state on shutdown (do NOT delete) ---
+# active.md persists across clean exits so multi-session recovery works.
+# It is only valid to delete active.md manually or when explicitly superseded.
 STATE_FILE="production/session-state/active.md"
 if [ -f "$STATE_FILE" ]; then
-    # Archive to session log before removing
     {
         echo "## Archived Session State: $TIMESTAMP"
         cat "$STATE_FILE"
         echo "---"
         echo ""
     } >> "$SESSION_LOG_DIR/session-log.md" 2>/dev/null
-    rm "$STATE_FILE" 2>/dev/null
 fi
 
 if [ -n "$RECENT_COMMITS" ] || [ -n "$MODIFIED_FILES" ]; then
```

**File**: `.claude/skills/adopt/SKILL.md` (modified, +92/-24)
```diff
@@ -4,7 +4,6 @@ description: "Brownfield onboarding — audits existing project artifacts for te
 argument-hint: "[focus: full | gdds | adrs | stories | infra]"
 user-invocable: true
 allowed-tools: Read, Glob, Grep, Write, AskUserQuestion
-context: fork
 agent: technical-director
 ---
 
@@ -37,7 +36,10 @@ wrong internal format.
 
 ## Phase 1: Detect Project State
 
-Read silently before presenting anything.
+Emit one line before reading: `"Scanning project artifacts..."` — this confirms the
+skill is running during the silent read phase.
+
+Then read silently before presenting anything else.
 
 ### Existence check
 - `production/stage.txt` — if present, read it (authoritative phase)
@@ -48,6 +50,7 @@ Read silently before presenting anything.
 - Count story files: `production/epics/**/*.md` (excluding EPIC.md)
 - `.claude/docs/technical-preferences.md` — engine configured?
 - `docs/engine-reference/` — engine reference docs present?
+- Glob `docs/adoption-plan-*.md` — note the filename of the most recent prior plan if any exist
 
 ### Infer phase (if no stage.txt)
 Use the same heuristic as `/project-stage-detect`:
@@ -58,9 +61,15 @@ Use the same heuristic as `/project-stage-detect`:
 - game-concept.md exists → Concept
 - Nothing → Fresh (not a brownfield project — suggest `/start`)
 
-If the project appears fresh (no artifacts at all), stop:
-> "This looks like a fresh project with no existing artifacts. Run `/start`
-> instead — `/adopt` is for projects that already have work to migrate."
+If the project appears fresh (no artifacts at all), use `AskUserQuestion`:
+- "This looks like a fresh project — no existing artifacts found. `/adopt` is for
+  projects with work to migrate. What would you like to do?"
+  - "Run `/start` — begin guided first-time onboarding"
+  - "My artifacts are in a non-standard location — help me find them"
+  - "Cancel"
+
+Then stop — do not proceed with the audit regardless of which option the user picks
+(each option leads to a different skill or manual investigation).
 
 Report: "Detected phase: [phase]. Found: [N] GDDs, [M] ADRs, [P] stories."
 
@@ -247,7 +256,26 @@ Gap counts:
 Estimated remediation: [X blocking items × ~Y min each = roughly Z hours]
 ```
 
-Ask: "May I write the full migration plan to `docs/adoption-plan-[date].md`?"
+Before asking to write, show a **Gap Preview**:
+- List every BLOCKING gap as a one-line bullet describing the actual problem
+  (e.g. `systems-index.md: 3 rows have parenthetical status values`,
+  `adr-0002.md: missing ## Status section`). No counts — show the actual items.
+- Show HIGH / MEDIUM / LOW as counts only (e.g. `HIGH: 4, MEDIUM: 2, LOW: 1`).
+
+This gives the user enough context to judge scope before committing to writing the file.
+
+If a prior adoption plan was detected in Phase 1, add a note:
+> "A previous plan exists at `docs/adoption-plan-[prior-date].md`. The new plan will
+> reflect current project state — it does not diff against the prior run."
+
+Use `AskUserQuestion`:
+- "Ready to write the migration plan?"
+  - "Yes — write `docs/adoption-plan-[date].md`"
+  - "Show me the full plan preview first (don't write yet)"
+  - "Cancel — I'll handle migration manually"
+
+If the user picks "Show me the full plan preview", output the complete plan as a
+fenced markdown block. Then ask again with the same three options.
 
 ---
 
@@ -261,7 +289,7 @@ If approved, write `docs/adoption-plan-[date].md` with this structure:
 > **Generated**: [date]
 > **Project phase**: [phase]
 > **Engine**: [name + version, or "Not configured"]
-> **Template version**: v0.4.0+
+> **Template version**: v1.0+
 
 Work through these steps in order. Check off each item as you complete it.
 Re-run `/adopt` anytime to check remaining gaps.
@@ -334,29 +362,69 @@ are resolved. The new run will reflect the current state of the project.
 
 ---
 
-## Phase 7: Offer First Action
+## Phase 6b: Set Review Mode
 
-After writing the plan, don't stop there. Pick the single highest-priority gap
-and offer to handle it immediately:
+After writing the adoption plan (or if the user cancels writing), check whether
+`production/review-mode.txt` exists.
+
+**If it exists**: Read it and note the current mode — "Review mode is already set to `[current]`." — skip the prompt.
 
-If there are parenthetical status values in systems-index.md:
-> "The most urgent fix is the systems-index.md status values — this breaks
-> multiple skills right now. I can fix these in-place in under 2 minutes.
-> Shall I edit the file now?"
+**If it does not exist**: Use `AskUserQuestion`:
 
-If ADRs are missing Status fields:
-> "The most urgent fix is adding Status fields to your ADRs. Shall I start
-> with `docs/architecture/adr-0001.md` using `/architecture-decision retrofit`?"
+- **Prompt**: "One more setup step: how much design review would you like as you work through the workflow?"
+- **Options**:
+  - `Full` — Director specialists review at each key workflow step. Best for teams, learning the 
```

**File**: `.claude/skills/architecture-decision/SKILL.md` (modified, +138/-32)
```diff
@@ -3,15 +3,19 @@ name: architecture-decision
 description: "Creates an Architecture Decision Record (ADR) documenting a significant technical decision, its context, alternatives considered, and consequences. Every major technical choice should have an ADR."
 argument-hint: "[title] [--review full|lean|solo]"
 user-invocable: true
-allowed-tools: Read, Glob, Grep, Write, Task
+allowed-tools: Read, Glob, Grep, Write, Task, AskUserQuestion
 ---
 
 When this skill is invoked:
 
 ## 0. Parse Arguments — Detect Retrofit Mode
 
-Extract `--review [full|lean|solo]` if present and store as the review mode
-override for this run (see `.claude/docs/director-gates.md`).
+Resolve the review mode (once, store for all gate spawns this run):
+1. If `--review [full|lean|solo]` was passed → use that
+2. Else read `production/review-mode.txt` → use that value
+3. Else → default to `lean`
+
+See `.claude/docs/director-gates.md` for the full check pattern.
 
 **If the argument starts with `retrofit` followed by a file path**
 (e.g., `/architecture-decision retrofit docs/architecture/adr-0001-event-system.md`):
@@ -163,33 +167,61 @@ or explicitly accepted as an intentional exception.
 
 ## 3. Guide the decision collaboratively
 
-Ask clarifying questions if the title alone is not sufficient. For each major
-section, present 2-4 options with pros/cons before drafting. Do not generate
-the ADR until the key decision is confirmed by the user.
+Before asking anything, derive the skill's best guesses from the context already
+gathered (GDDs read, engine reference loaded, existing ADRs scanned). Then present
+a **confirm/adjust** prompt using `AskUserQuestion` — not open-ended questions.
+
+**Derive assumptions first:**
+- **Problem**: Infer from the title + GDD context what decision needs to be made
+- **Alternatives**: Propose 2-3 concrete options from engine reference + GDD requirements
+- **Dependencies**: Scan existing ADRs for upstream dependencies; assume None if unclear
+- **GDD linkage**: Extract which GDD systems the title directly relates to
+- **Status**: Always `Proposed` for new ADRs — never ask the user what the status is
+
+**Scope of assumptions tab**: Assumptions cover only: problem framing, alternative approaches, upstream dependencies, GDD linkage, and status. Schema design questions (e.g., "How should spawn timing work?", "Should data be inline or external?") are NOT assumptions — they are design decisions belonging to a separate step after the assumptions are confirmed. Do not include schema design questions in the assumptions AskUserQuestion widget.
+
+**After assumptions are confirmed**, if the ADR involves schema or data design choices, use a separate multi-tab `AskUserQuestion` to ask each design question independently before drafting.
+
+**Present assumptions with `AskUserQuestion`:**
+
+```
+Here's what I'm assuming before drafting:
+
+Problem: [one-sentence problem statement derived from context]
+Alternatives I'll consider:
+  A) [option derived from engine reference]
+  B) [option derived from GDD requirements]
+  C) [option from common patterns]
+GDD systems driving this: [list derived from context]
+Dependencies: [upstream ADRs if any, otherwise "None"]
+Status: Proposed
+
+[A] Proceed — draft with these assumptions
+[B] Change the alternatives list
+[C] Adjust the GDD linkage
+[D] Add a performance budget constraint
+[E] Something else needs changing first
+```
 
-Key questions to ask:
-- What problem are we solving? What breaks if we don't decide this now?
-- What constraints apply (engine version, platform, performance budget)?
-- What alternatives have you already considered?
-- Which post-cutoff engine features (if any) does this decision depend on?
-- **Which GDD systems motivated this decision?** For each, what specific
-  requirement (rule, formula, performance constraint, integration point) in
-  that GDD cannot be satisfied without this architectural decision?
+Do not generate the ADR until the user confirms assumptions or provides corrections.
 
-If the decision is foundational (no GDD drives it directly), ask:
-- Which GDD systems will this decision constrain or enable?
+**After engine specialist and TD reviews return** (Step 4.5/4.6), if unresolved
+decisions remain, present each one as a separate `AskUserQuestion` with the proposed
+options as choices plus a free-text escape:
 
-This GDD linkage becomes a mandatory "GDD Requirements Addressed" section
-in the ADR. Do not skip it.
+```
+Decision: [specific unresolved point]
+[A] [option from specialist review]
+[B] [alternative option]
+[C] Different approach — I'll describe it
+```
 
-**Does this ADR have ordering constraints?** Ask:
-- Does this decision depend on any other ADR that isn't yet Accepted? (If
-  so, this ADR cannot be safely implemented until that one is resolved.)
-- Does accepting this ADR unlock or unblock any other pending decisions?
-- Does this ADR block any specific epic or story from starting?
+**ADR Dependencies**
```

**File**: `.claude/skills/architecture-review/SKILL.md` (modified, +13/-7)
```diff
@@ -3,8 +3,7 @@ name: architecture-review
 description: "Validates completeness and consistency of the project architecture against all GDDs. Builds a traceability matrix mapping every GDD technical requirement to ADRs, identifies coverage gaps, detects cross-ADR conflicts, verifies engine compatibility consistency across all decisions, and produces a PASS/CONCERNS/FAIL verdict. The architecture equivalent of /design-review."
 argument-hint: "[focus: full | coverage | consistency | engine | single-gdd path/to/gdd.md]"
 user-invocable: true
-allowed-tools: Read, Glob, Grep, Write, Task
-context: fork
+allowed-tools: Read, Glob, Grep, Write, Task, AskUserQuestion
 agent: technical-director
 model: opus
 ---
@@ -452,10 +451,11 @@ FAIL: Critical gaps (Foundation/Core layer requirements uncovered),
 
 ## Phase 8: Write and Update Traceability Index
 
-Ask: "May I write this review to `docs/architecture/architecture-review-[date].md`?"
-
-Also ask: "May I update `docs/architecture/architecture-traceability.md` with the
-current matrix? This is the living index that future reviews update incrementally."
+Use `AskUserQuestion` for the write approval:
+- "Review complete. What would you like to write?"
+  - [A] Write all three files (review report + traceability index + TR registry)
+  - [B] Write review report only — `docs/architecture/architecture-review-[date].md`
+  - [C] Don't write anything yet — I need to review the findings first
 
 ### RTM Output (rtm mode only)
 
@@ -596,7 +596,7 @@ Engine: [name + version]
 
 ## Phase 9: Handoff
 
-After completing the review:
+After completing the review and writing approved files, present:
 
 1. **Immediate actions**: List the top 3 ADRs to create (highest-impact gaps first,
    Foundation layer before Feature layer)
@@ -605,6 +605,12 @@ After completing the review:
 3. **Rerun trigger**: "Re-run `/architecture-review` after each new ADR is written
    to verify coverage improves"
 
+Then close with `AskUserQuestion`:
+- "Architecture review complete. What would you like to do next?"
+  - [A] Write a missing ADR — open a fresh session and run `/architecture-decision [system]`
+  - [B] Run `/gate-check pre-production` — if all blocking gaps are resolved
+  - [C] Stop here for this session
+
 ---
 
 ## Error Recovery Protocol
```

**File**: `.claude/skills/art-bible/SKILL.md` (added, +214/-0)
```diff
@@ -0,0 +1,214 @@
+---
+name: art-bible
+description: "Guided, section-by-section Art Bible authoring. Creates the visual identity specification that gates all asset production. Run after /brainstorm is approved and before /map-systems or any GDD authoring begins."
+argument-hint: "[--review full|lean|solo]"
+user-invocable: true
+allowed-tools: Read, Glob, Grep, Write, Edit, Task, AskUserQuestion
+---
+
+## Phase 0: Parse Arguments and Context Check
+
+Resolve the review mode (once, store for all gate spawns this run):
+1. If `--review [full|lean|solo]` was passed → use that
+2. Else read `production/review-mode.txt` → use that value
+3. Else → default to `lean`
+
+See `.claude/docs/director-gates.md` for the full check pattern.
+
+Read `design/gdd/game-concept.md`. If it does not exist, fail with:
+> "No game concept found. Run `/brainstorm` first — the art bible is authored after the game concept is approved."
+
+Extract from game-concept.md:
+- Game title (working title)
+- Core fantasy and elevator pitch
+- Game pillars (all of them)
+- **Visual Identity Anchor** section if present (from brainstorm Phase 4 art-director output)
+- Target platform (if noted)
+
+Read `design/art/art-bible.md` if it exists — this is **resume mode**. Read which sections already have real content vs. placeholders. Only work on missing sections.
+
+Read `.claude/docs/technical-preferences.md` if it exists — extract performance budgets and engine for asset standard constraints.
+
+---
+
+## Phase 1: Framing
+
+Present the session context and ask two questions before authoring anything:
+
+Use `AskUserQuestion` with two tabs:
+- Tab **"Scope"** — "Which sections need to be authored today?"
+  Options: `Full bible — all 9 sections` / `Visual identity core (sections 1–4 only)` / `Asset standards only (section 8)` / `Resume — fill in missing sections`
+- Tab **"References"** — "Do you have reference games, films, or art that define the visual direction?"
+  (Free text — let the user type specific titles. Do NOT preset options here.)
+
+If the game-concept.md has a Visual Identity Anchor section, note it:
+> "Found a visual identity anchor from brainstorm: '[anchor name] — [one-line rule]'. I'll use this as the foundation for the art bible."
+
+---
+
+## Phase 2: Visual Identity Foundation (Sections 1–4)
+
+These four sections define the core visual language. **All other sections flow from them.** Author and write each to file before moving to the next.
+
+### Section 1: Visual Identity Statement
+
+**Goal**: A one-line visual rule plus 2–3 supporting principles that resolve visual ambiguity.
+
+If a visual anchor exists from game-concept.md: present it and ask:
+- "Build directly from this anchor?"
+- "Revise it before expanding?"
+- "Start fresh with new options?"
+
+**Agent delegation (MANDATORY)**: Spawn `art-director` via Task:
+- Provide: game concept (elevator pitch, core fantasy), full pillar set, platform target, any reference games/art from Phase 1 framing, the visual anchor if it exists
+- Ask: "Draft a Visual Identity Statement for this game. Provide: (1) a one-line visual rule that could resolve any visual decision ambiguity, (2) 2–3 supporting visual principles, each with a one-sentence design test ('when X is ambiguous, this principle says choose Y'). Anchor all principles directly in the stated pillars — each principle must serve a specific pillar."
+
+Present the art-director's draft to the user. Use `AskUserQuestion`:
+- Options: `[A] Lock this in` / `[B] Revise the one-liner` / `[C] Revise a supporting principle` / `[D] Describe my own direction`
+
+Write the approved section to file immediately.
+
+### Section 2: Mood & Atmosphere
+
+**Goal**: Emotional targets by game state — specific enough for a lighting artist to work from.
+
+For each major game state (e.g., exploration, combat, victory, defeat, menus — adapt to this game's states), define:
+- Primary emotion/mood target
+- Lighting character (time of day, color temperature, contrast level)
+- Atmospheric descriptors (3–5 adjectives)
+- Energy level (frenetic / measured / contemplative / etc.)
+
+**Agent delegation**: Spawn `art-director` via Task with the Visual Identity Statement and pillar set. Ask: "Define mood and atmosphere targets for each major game state in this game. Be specific — 'dark and foreboding' is not enough. Name the exact emotional target, the lighting character (warm/cool, high/low contrast, time of day direction), and at least one visual element that carries the mood. Each game state must feel visually distinct from the others."
+
+Write the approved section to file immediately.
+
+### Section 3: Shape Language
+
+**Goal**: The geometric vocabulary that makes this game's world visually coherent and distinguishable.
+
+Cover:
+- Character silhouette philosophy (how readable at thumbnail size? Distinguishing trait per archetype?)
+- Environment geometry (angular/curved/organic/geometric — which dominates and why?)
+- UI shape grammar (do
```

**File**: `.claude/skills/asset-audit/SKILL.md` (modified, +0/-1)
```diff
@@ -4,7 +4,6 @@ description: "Audits game assets for compliance with naming conventions, file si
 argument-hint: "[category|all]"
 user-invocable: true
 allowed-tools: Read, Glob, Grep
-context: fork
 # Read-only diagnostic skill — no specialist agent delegation needed
 ---
 
```

---

### Incident Patch 8: `167fb6c5` (2026-03-28)
**Commit Message**: Fix skill bugs: session state init, agent field cleanup, /start path, /sprint-plan phases

- Remove invalid `agent: Explore` frontmatter from read-only skills (asset-audit, design-review, project-stage-detect, reverse-document)
- Fix design-system and map-systems to create session-state/active.md if it does not exist before updating
- Fix gate-check to remove reference to non-existent bmad-bmm-check skill
- Expand /start recommended paths into phased roadmap (Concept → Architecture → Production)
- Restructure /sprint-plan into numbered phases with clearer next-steps section

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `.claude/skills/asset-audit/SKILL.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ argument-hint: "[category|all]"
 user-invocable: true
 allowed-tools: Read, Glob, Grep
 context: fork
-agent: Explore
+# Read-only diagnostic skill — no specialist agent delegation needed
 ---
 
 ## Phase 1: Read Standards
```

**File**: `.claude/skills/design-review/SKILL.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ argument-hint: "[path-to-design-doc]"
 user-invocable: true
 allowed-tools: Read, Glob, Grep
 context: fork
-agent: Explore
+# Read-only diagnostic skill — no specialist agent delegation needed
 ---
 
 ## Phase 1: Load Documents
```

**File**: `.claude/skills/design-system/SKILL.md` (modified, +2/-2)
```diff
@@ -268,7 +268,7 @@ Use the template structure from `.claude/docs/templates/game-design-document.md`
 
 Ask: "May I create the skeleton file at `design/gdd/[system-name].md`?"
 
-After writing, update `production/session-state/active.md` with:
+After writing, create `production/session-state/active.md` if it does not exist, then update it with:
 - Task: Designing [system-name] GDD
 - Current section: Starting (skeleton created)
 - File: design/gdd/[system-name].md
@@ -602,7 +602,7 @@ Use `AskUserQuestion`:
 
 If yes, invoke the design-review skill on the completed file.
 
-### 5c: Update Systems Index
+### 5d: Update Systems Index
 
 After the GDD is complete (and optionally reviewed):
 
```

**File**: `.claude/skills/gate-check/SKILL.md` (modified, +2/-2)
```diff
@@ -144,8 +144,8 @@ The project progresses through these stages:
 - [ ] Architecture document has no unresolved open questions in Foundation or Core layers
 - [ ] All ADRs have Engine Compatibility sections stamped with the engine version
 - [ ] All ADRs have ADR Dependencies sections (even if all fields are "None")
-- [ ] `/bmad-bmm-check-implementation-readiness` has been run or equivalent manual
-      validation confirms GDDs + architecture + epics are coherent
+- [ ] Manual validation confirms GDDs + architecture + epics are coherent
+      (run `/review-all-gdds` and `/architecture-review` if not done recently)
 - [ ] **Core fantasy is delivered** — at least one playtester independently described an experience that matches the Player Fantasy section of the core system GDDs (without being prompted).
 
 **Vertical Slice Validation** (FAIL if any item is NO):
```

**File**: `.claude/skills/map-systems/SKILL.md` (modified, +1/-1)
```diff
@@ -202,7 +202,7 @@ Wait for approval. Write the file only after "yes."
 
 ### Step 5c: Update Session State
 
-After writing, update `production/session-state/active.md` with:
+After writing, create `production/session-state/active.md` if it does not exist, then update it with:
 - Task: Systems decomposition
 - Status: Systems index created
 - File: design/gdd/systems-index.md
```

**File**: `.claude/skills/project-stage-detect/SKILL.md` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ user-invocable: true
 allowed-tools: Read, Glob, Grep, Bash, Write
 context: fork
 model: haiku
-agent: Explore
+# Read-only diagnostic skill — no specialist agent delegation needed
 ---
 
 # Project Stage Detection
```

**File**: `.claude/skills/reverse-document/SKILL.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ argument-hint: "<type> <path> (e.g., 'design src/gameplay/combat' or 'architectu
 user-invocable: true
 allowed-tools: Read, Glob, Grep, Write, Edit, Bash
 context: fork
-agent: Explore
+# Read-only diagnostic skill — no specialist agent delegation needed
 ---
 
 # Reverse Documentation
```

**File**: `.claude/skills/sprint-plan/SKILL.md` (modified, +25/-8)
```diff
@@ -8,7 +8,7 @@ context: |
   !ls production/sprints/ 2>/dev/null
 ---
 
-When this skill is invoked:
+## Phase 1: Gather Context
 
 1. **Read the current milestone** from `production/milestones/`.
 
@@ -20,9 +20,13 @@ When this skill is invoked:
 
 4. **Check the risk register** at `production/risk-register/`.
 
+---
+
+## Phase 2: Generate Output
+
 For `new`:
 
-5. **Generate a sprint plan** following this format and present it to the user. Ask: "May I write this sprint plan to `production/sprints/sprint-[N].md`?" If yes, write the file, creating the directory if needed. Verdict: **COMPLETE** — sprint plan created. If no: Verdict: **BLOCKED** — user declined write.
+**Generate a sprint plan** following this format and present it to the user. Ask: "May I write this sprint plan to `production/sprints/sprint-[N].md`?" If yes, write the file, creating the directory if needed. Verdict: **COMPLETE** — sprint plan created. If no: Verdict: **BLOCKED** — user declined write.
 
 ```markdown
 # Sprint [N] -- [Start Date] to [End Date]
@@ -70,7 +74,7 @@ For `new`:
 
 For `status`:
 
-5. **Generate a status report**:
+**Generate a status report**:
 
 ```markdown
 # Sprint [N] Status -- [Date]
@@ -101,7 +105,9 @@ For `status`:
 - [Any new risks identified this sprint]
 ```
 
-### Sprint Status File
+---
+
+## Phase 3: Write Sprint Status File
 
 After generating a new sprint plan, also write `production/sprint-status.yaml`.
 This is the machine-readable source of truth for story status — read by
@@ -142,16 +148,27 @@ Initialize each story from the sprint plan's task tables:
 For `update`: read the existing `sprint-status.yaml`, carry over statuses for
 stories that haven't changed, add new stories, remove dropped ones.
 
-### Scope Reminder
+---
+
+## Phase 4: Scope and Risk Check
 
 After presenting the sprint plan, add:
 
 > **Scope check:** If this sprint includes stories added beyond the original epic scope, run `/scope-check [epic]` to detect scope creep before implementation begins.
 
-When reviewing stories during selection (step 3 above), note any stories that appear outside the original epic goals. If any are uncertain, flag them inline: "Are these stories within the original epic scope? If unsure, `/scope-check` can verify."
-
-### Agent Consultation
+When reviewing stories during selection, note any stories that appear outside the original epic goals. If any are uncertain, flag them inline: "Are these stories within the original epic scope? If unsure, `/scope-check` can verify."
 
 For comprehensive sprint planning, consider consulting:
 - `producer` agent for capacity planning, risk assessment, and cross-department coordination
 - `game-designer` agent for feature prioritization and design readiness assessment
+
+---
+
+## Phase 5: Next Steps
+
+After the sprint plan is written, recommend:
+
+- `/sprint-status` — check progress mid-sprint
+- `/scope-check [epic]` — verify no scope creep before implementation begins
+- `/dev-story [story-file]` — begin implementing the first story
+- `/story-readiness [story-file]` — validate a story is ready before starting it
```

---

### Incident Patch 9: `6c041ac1` (2026-03-27)
**Commit Message**: Release v0.4.0: /consistency-check, skill fixes, genre-agnostic agents

New skill: /consistency-check — cross-GDD entity registry scanner
New registries: design/registry/entities.yaml, docs/registry/architecture.yaml
Skill fixes: no-arg guards, verdict keywords, AskUserQuestion gates on all team-* skills
Agent fixes: genre-agnostic language in game-designer, systems-designer, economy-designer, live-ops-designer
Docs: skill/template counts corrected, stale references cleaned up

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `.claude/agents/accessibility-specialist.md` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ Before writing any code:
 
 2. **Ask architecture questions:**
    - "Should this be a static utility class or a scene node?"
-   - "Where should [data] live? (CharacterStats? Equipment class? Config file?)"
+   - "Where should [data] live? ([SystemData]? [Container] class? Config file?)"
    - "The design doc doesn't specify [edge case]. What should happen when...?"
    - "This will require changes to [other system]. Should I coordinate with that first?"
 
```

**File**: `.claude/agents/ai-programmer.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ Before writing any code:
 
 2. **Ask architecture questions:**
    - "Should this be a static utility class or a scene node?"
-   - "Where should [data] live? (CharacterStats? Equipment class? Config file?)"
+   - "Where should [data] live? ([SystemData]? [Container] class? Config file?)"
    - "The design doc doesn't specify [edge case]. What should happen when...?"
    - "This will require changes to [other system]. Should I coordinate with that first?"
 
```

**File**: `.claude/agents/analytics-engineer.md` (modified, +2/-2)
```diff
@@ -25,7 +25,7 @@ Before writing any code:
 
 2. **Ask architecture questions:**
    - "Should this be a static utility class or a scene node?"
-   - "Where should [data] live? (CharacterStats? Equipment class? Config file?)"
+   - "Where should [data] live? ([SystemData]? [Container] class? Config file?)"
    - "The design doc doesn't specify [edge case]. What should happen when...?"
    - "This will require changes to [other system]. Should I coordinate with that first?"
 
@@ -84,7 +84,7 @@ Before writing any code:
 Examples:
 - `game.level.started`
 - `game.level.completed`
-- `game.combat.enemy_killed`
+- `game.[context].[action]`
 - `ui.menu.settings_opened`
 - `economy.currency.spent`
 - `progression.milestone.reached`
```

**File**: `.claude/agents/art-director.md` (modified, +4/-4)
```diff
@@ -28,7 +28,7 @@ Before proposing any design:
 
 2. **Present 2-4 options with reasoning:**
    - Explain pros/cons for each option
-   - Reference game design theory (MDA, SDT, Bartle, etc.)
+   - Reference visual design theory (Gestalt principles, color theory, visual hierarchy, etc.)
    - Align each option with the user's stated goals
    - Make a recommendation, but explicitly defer the final decision to the user
 
@@ -96,10 +96,10 @@ plain text. Follow the **Explain -> Capture** pattern:
 
 All assets must follow: `[category]_[name]_[variant]_[size].[ext]`
 Examples:
-- `env_tree_oak_large.png`
-- `char_knight_idle_01.png`
+- `env_[object]_[descriptor]_large.png`
+- `char_[character]_idle_01.png`
 - `ui_btn_primary_hover.png`
-- `vfx_fire_loop_small.png`
+- `vfx_[effect]_loop_small.png`
 
 ### What This Agent Must NOT Do
 
```

**File**: `.claude/agents/community-manager.md` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ Before writing any code:
 
 2. **Ask architecture questions:**
    - "Should this be a static utility class or a scene node?"
-   - "Where should [data] live? (CharacterStats? Equipment class? Config file?)"
+   - "Where should [data] live? ([SystemData]? [Container] class? Config file?)"
    - "The design doc doesn't specify [edge case]. What should happen when...?"
    - "This will require changes to [other system]. Should I coordinate with that first?"
 
```

**File**: `.claude/agents/devops-engineer.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ Before writing any code:
 
 2. **Ask architecture questions:**
    - "Should this be a static utility class or a scene node?"
-   - "Where should [data] live? (CharacterStats? Equipment class? Config file?)"
+   - "Where should [data] live? ([SystemData]? [Container] class? Config file?)"
    - "The design doc doesn't specify [edge case]. What should happen when...?"
    - "This will require changes to [other system]. Should I coordinate with that first?"
 
```

**File**: `.claude/agents/economy-designer.md` (modified, +43/-3)
```diff
@@ -28,7 +28,7 @@ Before proposing any design:
 
 2. **Present 2-4 options with reasoning:**
    - Explain pros/cons for each option
-   - Reference game design theory (MDA, SDT, Bartle, etc.)
+   - Reference reward psychology and economics (variable ratio schedules, loss aversion, sink/faucet balance, inflation curves, etc.)
    - Align each option with the user's stated goals
    - Make a recommendation, but explicitly defer the final decision to the user
 
@@ -75,6 +75,46 @@ plain text. Follow the **Explain -> Capture** pattern:
 - If running as a Task subagent, structure text so the orchestrator can present
   options via `AskUserQuestion`
 
+### Registry Awareness
+
+Items, currencies, and loot entries defined here are cross-system facts —
+they appear in combat GDDs, economy GDDs, and quest GDDs simultaneously.
+Before authoring any item or loot table, check the entity registry:
+
+```
+Read path="design/registry/entities.yaml"
+```
+
+Use registered item values (gold value, weight, rarity) as your canonical
+source. Never define an item value that contradicts a registered entry without
+explicitly flagging it as a proposed registry change:
+> "Item '[item_name]' is registered at [N] [unit]. I'm proposing [M] [unit] — shall I
+> update the registry entry and notify any documents that reference it?"
+
+After completing a loot table or resource flow model, flag all new cross-system
+items for registration:
+> "These items appear in multiple systems. May I add them to
+> `design/registry/entities.yaml`?"
+
+### Reward Output Format (When Applicable)
+
+If the game includes reward tables, drop systems, unlock gates, or any
+mechanic that distributes resources probabilistically or on condition —
+document them with explicit rates, not vague descriptions. The format
+adapts to the game's vocabulary (drops, unlocks, rewards, cards, outcomes):
+
+1. **Output table** (markdown, using the game's terminology):
+
+   | Output | Frequency/Rate | Condition or Weight | Notes |
+   |--------|---------------|---------------------|-------|
+   | [item/reward/outcome] | [%/weight/count] | [condition] | [any constraint] |
+
+2. **Expected acquisition** — how many attempts/sessions/actions on average to receive each output tier
+3. **Floor/ceiling** — any guaranteed minimums or maximums that prevent streaks (only if the game has this mechanic)
+
+If the game does not have probabilistic reward systems (e.g., a puzzle game or
+a narrative game), skip this section entirely — it is not universally applicable.
+
 ### Key Responsibilities
 
 1. **Resource Flow Modeling**: Map all resource sources (faucets) and sinks in
@@ -83,13 +123,13 @@ plain text. Follow the **Explain -> Capture** pattern:
 2. **Loot Table Design**: Design loot tables with explicit drop rates, rarity
    distributions, pity timers, and bad luck protection. Document expected
    acquisition timelines for every item tier.
-3. **Progression Curve Design**: Define XP curves, power curves, and unlock
+3. **Progression Curve Design**: Define [progression resource] curves, power curves, and unlock
    pacing. Model expected player power at each stage of the game.
 4. **Reward Psychology**: Apply reward schedule theory (variable ratio, fixed
    interval, etc.) to design satisfying reward patterns. Document the
    psychological principle behind each reward structure.
 5. **Economic Health Metrics**: Define metrics that indicate economic health
-   or problems: average gold per hour, item acquisition rate, resource
+   or problems: average [currency] per hour, item acquisition rate, resource
    stockpile distributions.
 
 ### What This Agent Must NOT Do
```

**File**: `.claude/agents/engine-programmer.md` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ Before writing any code:
 
 2. **Ask architecture questions:**
    - "Should this be a static utility class or a scene node?"
-   - "Where should [data] live? (CharacterStats? Equipment class? Config file?)"
+   - "Where should [data] live? ([SystemData]? [Container] class? Config file?)"
    - "The design doc doesn't specify [edge case]. What should happen when...?"
    - "This will require changes to [other system]. Should I coordinate with that first?"
 
```

---

### Incident Patch 10: `04ed5d5c` (2026-03-25)
**Commit Message**: Update docs, skill counts, and UX/setup-engine skills for v0.4.0

- Update skill count to 66 and hook count to 12 across README, skills-reference, and badges
- Add QA & Testing section to README and skills-reference (qa-plan, smoke-check, soak-test, etc.)
- Add Input & Platform section to technical-preferences.md (populated by /setup-engine)
- Document post-compact, notify, and validate-skill-change hooks in hooks-reference
- Expand /setup-engine, /ux-design, /ux-review, /design-system skills with input/platform context
- Restructure workflow-catalog: move UX steps into pre-production phase, improve descriptions
- Expand UPGRADING.md and WORKFLOW-GUIDE.md with v0.4.0 guidance
- Add skill-flow-diagrams examples and CODEOWNERS

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `.claude/docs/hooks-reference.md` (modified, +3/-0)
```diff
@@ -10,9 +10,12 @@ Hooks are configured in `.claude/settings.json` and fire automatically:
 | `session-start.sh` | SessionStart | Session begins | Loads sprint context, milestone, git activity; detects and previews active session state file for recovery |
 | `detect-gaps.sh` | SessionStart | Session begins | Detects fresh projects (suggests /start) and missing documentation when code/prototypes exist, suggests /reverse-document or /project-stage-detect |
 | `pre-compact.sh` | PreCompact | Context compression | Dumps session state (active.md, modified files, WIP design docs) into conversation before compaction so it survives summarization |
+| `post-compact.sh` | PostCompact | After compaction | Reminds Claude to restore session state from `active.md` checkpoint |
+| `notify.sh` | Notification | Notification event | Shows Windows toast notification via PowerShell |
 | `session-stop.sh` | Stop | Session ends | Summarizes accomplishments and updates session log |
 | `log-agent.sh` | SubagentStart | Agent spawned | Audit trail start — logs subagent invocation with timestamp |
 | `log-agent-stop.sh` | SubagentStop | Agent stops | Audit trail stop — completes subagent record |
+| `validate-skill-change.sh` | PostToolUse (Write/Edit) | Skill file changes | Advises running `/skill-test` after any `.claude/skills/` file is written or edited |
 
 Hook reference documentation: `.claude/docs/hooks-reference/`
 Hook input schema documentation: `.claude/docs/hooks-reference/hook-input-schemas.md`
```

**File**: `.claude/docs/quick-start.md` (modified, +3/-3)
```diff
@@ -253,8 +253,8 @@ CLAUDE.md                          -- Master config (read this first, ~60 lines)
 .claude/
   settings.json                    -- Claude Code hooks and project settings
   agents/                          -- 48 agent definitions (YAML frontmatter)
-  skills/                          -- 52 slash command definitions (YAML frontmatter)
-  hooks/                           -- 9 hook scripts (.sh) wired by settings.json
+  skills/                          -- 66 slash command definitions (YAML frontmatter)
+  hooks/                           -- 12 hook scripts (.sh) wired by settings.json
   rules/                           -- 11 path-specific rule files
   docs/
     quick-start.md                 -- This file
@@ -266,5 +266,5 @@ CLAUDE.md                          -- Master config (read this first, ~60 lines)
     workflow-catalog.yaml          -- 7-phase pipeline definition (read by /help)
     setup-requirements.md          -- System prerequisites (Git Bash, jq, Python)
     settings-local-template.md     -- Personal settings.local.json guide
-    templates/                     -- 36 document templates
+    templates/                     -- 35 document templates
 ```
```

**File**: `.claude/docs/skills-reference.md` (modified, +18/-1)
```diff
@@ -1,6 +1,6 @@
 # Available Skills (Slash Commands)
 
-52 slash commands organized by phase. Type `/` in Claude Code to access any of them.
+66 slash commands organized by phase. Type `/` in Claude Code to access any of them.
 
 ## Onboarding & Navigation
 
@@ -66,13 +66,28 @@
 | `/tech-debt` | Scan, track, prioritize, and report on technical debt |
 | `/gate-check` | Validate readiness to advance between development phases (PASS/CONCERNS/FAIL) |
 
+## QA & Testing
+
+| Command | Purpose |
+|---------|---------|
+| `/qa-plan` | Generate a QA test plan for a sprint or feature |
+| `/smoke-check` | Run critical path smoke test gate before QA hand-off |
+| `/soak-test` | Generate a soak test protocol for extended play sessions |
+| `/regression-suite` | Map test coverage to GDD critical paths, identify fixed bugs without regression tests |
+| `/test-setup` | Scaffold the test framework and CI/CD pipeline for the project's engine |
+| `/test-helpers` | Generate engine-specific test helper libraries for the test suite |
+| `/test-evidence-review` | Quality review of test files and manual evidence documents |
+| `/test-flakiness` | Detect non-deterministic (flaky) tests from CI run logs |
+| `/skill-test` | Validate skill files for structural compliance and behavioral correctness |
+
 ## Production
 
 | Command | Purpose |
 |---------|---------|
 | `/milestone-review` | Review milestone progress and generate status report |
 | `/retrospective` | Run a structured sprint or milestone retrospective |
 | `/bug-report` | Create a structured bug report |
+| `/bug-triage` | Read all open bugs, re-evaluate priority vs. severity, assign owner and label |
 | `/reverse-document` | Generate design or architecture docs from existing implementation |
 | `/playtest-report` | Generate a structured playtest report or analyze existing playtest notes |
 
@@ -107,3 +122,5 @@ Coordinate multiple agents on a single feature area:
 | `/team-polish` | performance-analyst + technical-artist + sound-designer + qa-tester |
 | `/team-audio` | audio-director + sound-designer + technical-artist + gameplay-programmer |
 | `/team-level` | level-designer + narrative-director + world-builder + art-director + systems-designer + qa-tester |
+| `/team-live-ops` | live-ops-designer + economy-designer + community-manager + analytics-engineer |
+| `/team-qa` | qa-lead + qa-tester + gameplay-programmer + producer |
```

**File**: `.claude/docs/technical-preferences.md` (modified, +12/-0)
```diff
@@ -10,6 +10,18 @@
 - **Rendering**: [TO BE CONFIGURED]
 - **Physics**: [TO BE CONFIGURED]
 
+## Input & Platform
+
+<!-- Written by /setup-engine. Read by /ux-design, /ux-review, /test-setup, /team-ui, and /dev-story -->
+<!-- to scope interaction specs, test helpers, and implementation to the correct input methods. -->
+
+- **Target Platforms**: [TO BE CONFIGURED — e.g., PC, Console, Mobile, Web]
+- **Input Methods**: [TO BE CONFIGURED — e.g., Keyboard/Mouse, Gamepad, Touch, Mixed]
+- **Primary Input**: [TO BE CONFIGURED — the dominant input for this game]
+- **Gamepad Support**: [TO BE CONFIGURED — Full / Partial / None]
+- **Touch Support**: [TO BE CONFIGURED — Full / Partial / None]
+- **Platform Notes**: [TO BE CONFIGURED — any platform-specific UX constraints]
+
 ## Naming Conventions
 
 - **Classes**: [TO BE CONFIGURED]
```

**File**: `.claude/docs/workflow-catalog.yaml` (modified, +9/-9)
```diff
@@ -86,7 +86,7 @@ phases:
 
   technical-setup:
     label: "Technical Setup"
-    description: "Architecture decisions, UX foundations, engine validation"
+    description: "Architecture decisions, accessibility foundations, engine validation"
     next_phase: pre-production
     steps:
       - id: create-architecture
@@ -128,8 +128,13 @@ phases:
         required: true
         artifact:
           glob: "design/accessibility-requirements.md"
-        description: "Commit accessibility tier (Basic/Standard/Comprehensive/Exemplary) and feature matrix"
+        description: "Commit accessibility tier (Basic/Standard/Comprehensive/Exemplary) and feature matrix. UX specs (Phase 4) reference this tier."
 
+  pre-production:
+    label: "Pre-Production"
+    description: "UX specs, prototype the core mechanic, define stories, validate fun"
+    next_phase: production
+    steps:
       - id: ux-design
         name: "UX Specs (key screens)"
         command: /ux-design
@@ -138,19 +143,14 @@ phases:
         artifact:
           glob: "design/ux/*.md"
           min_count: 1
-        description: "Author UX specs for main menu, core gameplay HUD, and pause screen"
+        description: "Author UX specs for main menu, core gameplay HUD, and interaction patterns. Reads input method and platform from technical-preferences.md."
 
       - id: ux-review
         name: "UX Review"
         command: /ux-review
         required: true
-        description: "Validate all key screen UX specs for accessibility and GDD alignment"
+        description: "Validate all key screen UX specs for GDD alignment and accessibility tier compliance. Run before creating epics."
 
-  pre-production:
-    label: "Pre-Production"
-    description: "Prototype the core mechanic, define stories, validate fun"
-    next_phase: production
-    steps:
       - id: prototype
         name: "Prototype"
         command: /prototype
```

**File**: `.claude/skills/design-system/SKILL.md` (modified, +10/-0)
```diff
@@ -457,6 +457,16 @@ For **Visual/Audio**: Coordinate with `art-director` and `audio-director` if det
 is needed. Often a brief note suffices at the GDD stage.
 
 For **UI Requirements**: Coordinate with `ux-designer` for complex UI systems.
+After writing this section, check whether it contains real content (not just
+`[To be designed]` or a note that this system has no UI). If it does have real
+UI requirements, output this flag immediately:
+
+> **📌 UX Flag — [System Name]**: This system has UI requirements. In Phase 4
+> (Pre-Production), run `/ux-design` to create a UX spec for each screen or
+> HUD element this system contributes to **before** writing epics. Stories that
+> reference UI should cite `design/ux/[screen].md`, not the GDD directly.
+>
+> Note this in the systems index for this system if you update it.
 
 For **Open Questions**: Capture anything that came up during design that wasn't
 fully resolved. Each question should have an owner and target resolution date.
```

**File**: `.claude/skills/setup-engine/SKILL.md` (modified, +37/-3)
```diff
@@ -35,9 +35,10 @@ If no engine is specified, run an interactive engine selection process:
 ### If the user wants to pick without a concept, ask:
 1. **What kind of game?** (2D, 3D, or both?)
 2. **What platforms?** (PC, mobile, console, web?)
-3. **Team size and experience?** (solo beginner, solo experienced, small team?)
-4. **Any strong language preferences?** (GDScript, C#, C++, visual scripting?)
-5. **Budget for engine licensing?** (free only, or commercial licenses OK?)
+3. **Primary input method?** (keyboard/mouse, gamepad, touch, or mixed?)
+4. **Team size and experience?** (solo beginner, solo experienced, small team?)
+5. **Any strong language preferences?** (GDScript, C#, C++, visual scripting?)
+6. **Budget for engine licensing?** (free only, or commercial licenses OK?)
 
 ### Produce a recommendation
 
@@ -135,6 +136,39 @@ engine-appropriate defaults. Read the existing template first, then fill in:
 - Booleans: `b` prefix (e.g., `bIsAlive`)
 - Files: Match class without prefix (e.g., `PlayerController.h`)
 
+### Input & Platform Section
+
+Populate `## Input & Platform` using the answers gathered in Section 2 (or extracted
+from the game concept). Derive the values using this mapping:
+
+| Platform target | Gamepad Support | Touch Support |
+|-----------------|-----------------|---------------|
+| PC only | Partial (recommended) | None |
+| Console | Full | None |
+| Mobile | None | Full |
+| PC + Console | Full | None |
+| PC + Mobile | Partial | Full |
+| Web | Partial | Partial |
+
+For **Primary Input**, use the dominant input for the game genre:
+- Action/RPG/platformer targeting console → Gamepad
+- Strategy/point-and-click/RTS → Keyboard/Mouse
+- Mobile game → Touch
+- Cross-platform → ask the user
+
+Present the derived values and ask the user to confirm or adjust before writing.
+
+Example filled section:
+```markdown
+## Input & Platform
+- **Target Platforms**: PC, Console
+- **Input Methods**: Keyboard/Mouse, Gamepad
+- **Primary Input**: Gamepad
+- **Gamepad Support**: Full
+- **Touch Support**: None
+- **Platform Notes**: All UI must support d-pad navigation. No hover-only interactions.
+```
+
 ### Remaining Sections
 - Performance Budgets: Leave as `[TO BE CONFIGURED]` with a suggestion:
   > "Typical targets: 60fps / 16.6ms frame budget. Want to set these now?"
```

**File**: `.claude/skills/ux-design/SKILL.md` (modified, +26/-3)
```diff
@@ -90,7 +90,28 @@ already made.
 Check for `design/accessibility-requirements.md`. If found, read it. The spec
 must satisfy the accessibility tier committed to there.
 
-### 2h: Present Context Summary
+### 2h: Input Method (from Project Config)
+
+Read `.claude/docs/technical-preferences.md` and extract the `## Input & Platform`
+section. Store these values for use throughout the skill — they drive the
+Interaction Map and inform accessibility requirements:
+
+- **Input Methods** — e.g., Keyboard/Mouse, Gamepad, Touch, Mixed
+- **Primary Input** — the dominant input for this game
+- **Gamepad Support** — Full / Partial / None
+- **Touch Support** — Full / Partial / None
+- **Target Platforms** — for safe zone and aspect ratio decisions
+
+If the section is unconfigured (`[TO BE CONFIGURED]`), ask once:
+> "Input methods aren't configured yet. What does this game target?"
+> Options: "Keyboard/Mouse only", "Gamepad only", "Both (PC + Console)", "Touch (mobile)", "All of the above"
+>
+> (Run `/setup-engine` to save this permanently so you won't be asked again.)
+
+Store the answer for the rest of this session. Do **not** ask again per section
+or per screen.
+
+### 2i: Present Context Summary
 
 Before any design work, present a brief summary to the user:
 
@@ -101,6 +122,7 @@ Before any design work, present a brief summary to the user:
 > - Related screens already specced: [list, or "none yet"]
 > - Known patterns available: [count, or "no pattern library yet"]
 > - Accessibility tier: [from requirements doc, or "not yet defined"]
+> - Input methods: [from technical-preferences.md, or "asked above"]
 
 Then ask: "Anything else I should read before we start, or shall we proceed?"
 
@@ -427,8 +449,9 @@ For each interactive component identified in the Layout Specification, define:
 - The immediate feedback (visual, audio, haptic)
 - The outcome (navigation target, state change, data write)
 
-Ask up front: "Which input methods does this game target? I'll tailor the
-interaction map to those." Reference game concept for platform targets.
+Use the input methods loaded from `technical-preferences.md` in Phase 2h — do
+not ask the user again. State them upfront: "Mapping interactions for:
+[Input Methods from tech-prefs]. Covering [Gamepad Support] gamepad support."
 
 Work through components one at a time rather than asking for all at once.
 For navigation actions (going to another screen), verify the target matches
```

---

### Incident Patch 11: `af2b8647` (2026-03-13)
**Commit Message**: Add /skill-test suite: linter, behavioral specs, and coverage catalog for 52 skills

- New skill: /skill-test (static | spec | audit modes)
  - static: 7-check structural linter per skill file
  - spec: Claude-evaluated behavioral assertions against test specs
  - audit: coverage report across all 52 skills with priority gaps
- New hook: validate-skill-change.sh — advisory reminder to lint after skill edits
- New template: skill-test-spec.md — standard structure for authoring test specs
- New: tests/skills/catalog.yaml — machine-readable coverage index (52 skills)
- New: tests/skills/_fixtures/ — shared fixtures (complete concept, incomplete GDD)
- New: 4 seed test specs for critical gate skills (gate-check, design-review,
  story-readiness, story-done) — 4 cases each
- Modified: settings.json — validate-skill-change.sh added to PostToolUse hook

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `.claude/docs/templates/skill-test-spec.md` (added, +96/-0)
```diff
@@ -0,0 +1,96 @@
+# Skill Test Spec: /[skill-name]
+
+## Skill Summary
+
+[One paragraph: what this skill does, when to use it, what it produces. Include
+the primary output artifact, the verdict format it uses, and which pipeline stage
+it belongs to.]
+
+---
+
+## Static Assertions (Structural)
+
+Verified automatically by `/skill-test static` — no fixture needed.
+
+- [ ] Has required frontmatter fields: `name`, `description`, `argument-hint`, `user-invocable`, `allowed-tools`
+- [ ] Has ≥2 phase headings (## Phase N or numbered ## sections)
+- [ ] Contains verdict keywords: [list the ones expected, e.g., PASS, FAIL, CONCERNS]
+- [ ] Contains "May I write" collaborative protocol language (if skill writes files)
+- [ ] Has a next-step handoff at the end
+
+---
+
+## Test Cases
+
+### Case 1: Happy Path — [short description]
+
+**Fixture:** [Describe the assumed project state. Which files exist? What do they
+contain? E.g., "game-concept.md exists with all 8 required sections complete.
+systems-index.md exists. All MVP GDDs are present and individually reviewed."]
+
+**Input:** `/[skill-name] [args]`
+
+**Expected behavior:**
+1. [Phase 1 action — what the skill should read or check]
+2. [Phase 2 action — what the skill should evaluate]
+3. [Phase N action — what the skill should output]
+
+**Assertions:**
+- [ ] Skill reads [specific file] before producing output
+- [ ] Output includes verdict keyword [PASS/FAIL/etc.]
+- [ ] Output lists [specific content] from the fixture
+- [ ] Skill asks for approval before writing any file
+
+---
+
+### Case 2: Failure Path — [short description, e.g., "Missing required artifact"]
+
+**Fixture:** [Describe the failure state. E.g., "game-concept.md is missing.
+No files exist in design/gdd/."]
+
+**Input:** `/[skill-name] [args]`
+
+**Expected behavior:**
+1. [Phase 1: skill detects missing file]
+2. [Phase 2: skill surfaces the gap rather than assuming OK]
+3. [Output: FAIL or BLOCKED verdict with specific blocker named]
+
+**Assertions:**
+- [ ] Skill does NOT output PASS when the fixture is incomplete
+- [ ] Skill names the specific missing artifact
+- [ ] Skill suggests a remediation action (e.g., "Run /[other-skill]")
+- [ ] Skill does not create files to fill in the gap without asking
+
+---
+
+### Case 3: Edge Case — [short description, e.g., "No argument provided"]
+
+**Fixture:** [State of project files for this case]
+
+**Input:** `/[skill-name]` (no argument)
+
+**Expected behavior:**
+1. [What the skill should do when invoked without arguments]
+
+**Assertions:**
+- [ ] [assertion]
+
+---
+
+## Protocol Compliance
+
+- [ ] Uses "May I write" before all file writes
+- [ ] Presents findings or report before asking for write approval
+- [ ] Ends with a recommended next step or follow-up skill
+- [ ] Never auto-creates files without explicit user approval
+- [ ] Does not skip phases or jump straight to a verdict without checking
+
+---
+
+## Coverage Notes
+
+[Document what is intentionally NOT tested in this spec and why. Examples:
+- "Case 3 (all-mode) is not covered because it runs too many checks to evaluate
+  in a single spec — test each sub-mode individually."
+- "The database integration path is not covered as it requires a live environment."
+- "Edge cases involving corrupted YAML files are deferred to a future spec."]
```

**File**: `.claude/hooks/validate-skill-change.sh` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+#!/bin/bash
+# Claude Code PostToolUse hook: Advises running skill-test after skill file changes
+# Fires when any file inside .claude/skills/ is written or edited.
+#
+# Exit behavior:
+#   exit 0 = advisory only (non-blocking)
+#
+# Input schema (PostToolUse for Write|Edit):
+# { "tool_name": "Write", "tool_input": { "file_path": "...", "content": "..." } }
+
+INPUT=$(cat)
+
+# Parse file path -- use jq if available, fall back to grep
+if command -v jq >/dev/null 2>&1; then
+    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
+else
+    FILE_PATH=$(echo "$INPUT" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/"file_path"[[:space:]]*:[[:space:]]*"//;s/"$//')
+fi
+
+# Normalize path separators (Windows backslash to forward slash)
+FILE_PATH=$(echo "$FILE_PATH" | sed 's|\\|/|g')
+
+# Only act on files inside .claude/skills/
+if ! echo "$FILE_PATH" | grep -qE '(^|/)\.claude/skills/'; then
+    exit 0
+fi
+
+# Extract skill name from path (.claude/skills/[skill-name]/SKILL.md)
+SKILL_NAME=$(echo "$FILE_PATH" | grep -oE '\.claude/skills/[^/]+' | sed 's|\.claude/skills/||')
+
+if [ -z "$SKILL_NAME" ]; then
+    exit 0
+fi
+
+echo "=== Skill Modified: $SKILL_NAME ===" >&2
+echo "Run /skill-test static $SKILL_NAME to validate structural compliance." >&2
+echo "====================================" >&2
+
+exit 0
```

**File**: `.claude/settings.json` (modified, +5/-0)
```diff
@@ -74,6 +74,11 @@
             "type": "command",
             "command": "bash .claude/hooks/validate-assets.sh",
             "timeout": 10
+          },
+          {
+            "type": "command",
+            "command": "bash .claude/hooks/validate-skill-change.sh",
+            "timeout": 5
           }
         ]
       }
```

**File**: `.claude/skills/skill-test/SKILL.md` (added, +290/-0)
```diff
@@ -0,0 +1,290 @@
+---
+name: skill-test
+description: "Validate skill files for structural compliance and behavioral correctness. Three modes: static (linter), spec (behavioral), audit (coverage report)."
+argument-hint: "static [skill-name | all] | spec [skill-name] | audit"
+user-invocable: true
+allowed-tools: Read, Glob, Grep, Write
+context: fork
+---
+
+# Skill Test
+
+Validates `.claude/skills/*/SKILL.md` files for structural compliance and
+behavioral correctness. No external dependencies — runs entirely within the
+existing skill/hook/template architecture.
+
+**Three modes:**
+
+| Mode | Command | Purpose | Token Cost |
+|------|---------|---------|------------|
+| `static` | `/skill-test static [name\|all]` | Structural linter — 7 compliance checks per skill | Low (~1k/skill) |
+| `spec` | `/skill-test spec [name]` | Behavioral verifier — evaluates assertions in test spec | Medium (~5k/skill) |
+| `audit` | `/skill-test audit` | Coverage report — which skills have specs, last test dates | Low (~2k total) |
+
+---
+
+## Phase 1: Parse Arguments
+
+Determine mode from the first argument:
+
+- `static [name]` → run 7 structural checks on one skill
+- `static all` → run 7 structural checks on all skills (Glob `.claude/skills/*/SKILL.md`)
+- `spec [name]` → read skill + test spec, evaluate assertions
+- `audit` (or no argument) → read catalog, list all skills, show coverage
+
+If argument is missing or unrecognized, output usage and stop.
+
+---
+
+## Phase 2A: Static Mode — Structural Linter
+
+For each skill being tested, read its `SKILL.md` fully and run all 7 checks:
+
+### Check 1 — Required Frontmatter Fields
+The file must contain all of these in the YAML frontmatter block:
+- `name:`
+- `description:`
+- `argument-hint:`
+- `user-invocable:`
+- `allowed-tools:`
+
+**FAIL** if any are absent.
+
+### Check 2 — Multiple Phases
+The skill must have ≥2 numbered phase headings. Look for patterns like:
+- `## Phase N` or `## Phase N:`
+- `## N.` (numbered top-level sections)
+- At least 2 distinct `##` headings if phases aren't explicitly numbered
+
+**FAIL** if fewer than 2 phase-like headings are found.
+
+### Check 3 — Verdict Keywords
+The skill must contain at least one of: `PASS`, `FAIL`, `CONCERNS`, `APPROVED`,
+`BLOCKED`, `COMPLETE`, `READY`, `COMPLIANT`, `NON-COMPLIANT`
+
+**FAIL** if none are present.
+
+### Check 4 — Collaborative Protocol Language
+The skill must contain ask-before-write language. Look for:
+- `"May I write"` (canonical form)
+- `"before writing"` or `"approval"` near file-write instructions
+- `"ask"` + `"write"` in close proximity (within same section)
+
+**WARN** if absent (some read-only skills legitimately skip this).
+**FAIL** if `allowed-tools` includes `Write` or `Edit` but no ask-before-write language is found.
+
+### Check 5 — Next-Step Handoff
+The skill must end with a recommended next action or follow-up path. Look for:
+- A final section mentioning another skill (e.g., `/story-done`, `/gate-check`)
+- "Recommended next" or "next step" phrasing
+- A "Follow-Up" or "After this" section
+
+**WARN** if absent.
+
+### Check 6 — Fork Context Complexity
+If frontmatter contains `context: fork`, the skill should have ≥5 phase headings
+(`##` level or numbered Phase N headers). Fork context is for complex multi-phase
+skills; simple skills should not use it.
+
+**WARN** if `context: fork` is set but fewer than 5 phases found.
+
+### Check 7 — Argument Hint Plausibility
+`argument-hint` must be non-empty. If the skill body mentions multiple modes
+(e.g., "Mode A | Mode B"), the hint should reflect them. Cross-reference the
+hint against the first phase's "Parse Arguments" section.
+
+**WARN** if hint is `""` or if documented modes don't match hint.
+
+---
+
+### Static Mode Output Format
+
+For a single skill:
+```
+=== Skill Static Check: /[name] ===
+
+Check 1 — Frontmatter Fields:    PASS
+Check 2 — Multiple Phases:       PASS (7 phases found)
+Check 3 — Verdict Keywords:      PASS (PASS, FAIL, CONCERNS)
+Check 4 — Collaborative Protocol: PASS ("May I write" found)
+Check 5 — Next-Step Handoff:     WARN (no follow-up section found)
+Check 6 — Fork Context Complexity: PASS (8 phases, context: fork set)
+Check 7 — Argument Hint:         PASS
+
+Verdict: WARNINGS (1 warning, 0 failures)
+Recommended: Add a "Follow-Up Actions" section at the end of the skill.
+```
+
+For `static all`, produce a summary table then list any non-compliant skills:
+```
+=== Skill Static Check: All 52 Skills ===
+
+Skill                  | Result       | Issues
+-----------------------|--------------|-------
+gate-check             | COMPLIANT    |
+design-review          | COMPLIANT    |
+story-readiness        | WARNINGS     | Check 5: no handoff
+...
+
+Summary: 48 COMPLIANT, 3 WARNINGS, 1 NON-COMPLIANT
+Aggregate Verdict: N WARNINGS / N FAILURES
+```
+
+---
+
+## Phase 2B: Spec Mode — Behavioral Verifier
+
+### Step 1 — Locate Files
+
+Find skill at `.claude/skills/[name]/SKILL.md`.
+F
```

**File**: `tests/skills/_fixtures/incomplete-gdd.md` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+# GDD: Light Manipulation System
+
+## Overview
+
+The light manipulation system allows players to interact with bioluminescent
+organisms and ancient light conduits to redirect beams of light. Light beams
+illuminate dark areas, power ancient mechanisms, and reveal hidden surfaces.
+
+## Player Fantasy
+
+The player should feel like a puzzle archaeologist — discovering the logic of
+an alien but internally consistent technology. The "aha" moment when a complex
+light path clicks into place should feel earned and satisfying.
+
+## Detailed Rules
+
+- Players can pick up portable light sources (max 3 carried at once)
+- Stationary conduits redirect beams at fixed angles (45°/90°/135°/180°)
+- Light beams are blocked by solid terrain and most objects
+- Living bioluminescent organisms pulse light on a 3-second cycle
+- Ancient mirrors rotate freely and redirect any light beam that touches them
+- A beam must reach a receptor to activate a mechanism
+
+## Formulas
+
+[SECTION MISSING — not yet authored]
+
+## Edge Cases
+
+[SECTION MISSING — not yet authored]
+
+## Dependencies
+
+- **Oxygen System**: Light sources consume no oxygen but picking them up takes
+  time (opportunity cost with oxygen drain)
+- **Cave Navigation**: Illuminated paths reveal branching routes not visible
+  in darkness
+- Player Inventory System (not yet designed)
+
+## Tuning Knobs
+
+[SECTION MISSING — not yet authored]
+
+## Acceptance Criteria
+
+[SECTION MISSING — not yet authored]
+
+---
+
+*Status: Draft — 4/8 required sections populated*
+*Last updated: 2026-03-13*
```

**File**: `tests/skills/_fixtures/minimal-game-concept.md` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+# Game Concept: Echoes of the Deep
+
+## Overview
+
+Echoes of the Deep is a single-player atmospheric puzzle-platformer set in
+a bioluminescent underwater cave network. Players control a deep-sea diver
+exploring ancient ruins while managing oxygen supplies and manipulating light
+sources to reveal hidden paths and solve environmental puzzles.
+
+## Player Fantasy
+
+The player should feel like a lone explorer uncovering a lost civilization,
+experiencing wonder at beautiful environments, and the satisfying "aha" moment
+when a clever puzzle clicks into place. The oxygen mechanic creates gentle
+pressure without punishing failure harshly.
+
+## Core Loop
+
+1. **Explore** — navigate branching cave sections using light and movement
+2. **Discover** — find oxygen caches, light sources, and ancient mechanisms
+3. **Solve** — manipulate light and environment to unlock new areas
+4. **Progress** — unlock deeper cave sections with escalating complexity
+
+## Game Pillars
+
+1. **Wonder** — every area should contain something visually or mechanically surprising
+2. **Accessibility** — the game should be completable without frustration; oxygen
+   manages pacing, not punishment
+3. **Environmental Storytelling** — the ruins tell a story without text exposition
+
+## Target Audience
+
+Casual-to-midcore players who enjoy relaxed exploration games (Subnautica,
+Journey, ABZÛ) and puzzle games that reward observation over reflexes.
+Target age: 16+. Target sessions: 30–90 minutes.
+
+## Unique Selling Points
+
+- Bioluminescent light manipulation as the core puzzle mechanic
+- No enemies — tension comes from environment and resource management
+- Procedurally decorated (handcrafted levels, procedural detail pass)
+
+## Technical Scope
+
+- **Engine**: Godot 4.6
+- **Platform**: PC (Steam), with console ports post-launch
+- **Team size**: Solo developer
+- **Target completion**: 12-month development cycle
+- **Scope**: 4–6 hours main story, 8–12 hours completionist
+
+## Art Direction
+
+Darkly atmospheric with vibrant bioluminescence providing the primary color
+palette. Deep blues, purples, and blacks punctuated by greens, teals, and
+ambers from living organisms and ancient technology.
+
+## Fun Hypothesis
+
+Players will feel rewarded by the combination of visual beauty and the
+satisfying moment of discovering how light manipulation solves each puzzle.
+The oxygen system will create just enough pressure to make exploration feel
+meaningful without making death feel punishing.
```

**File**: `tests/skills/catalog.yaml` (added, +438/-0)
```diff
@@ -0,0 +1,438 @@
+version: 1
+last_updated: ""
+skills:
+  # Critical — gate skills that control phase transitions
+  - name: gate-check
+    spec: tests/skills/gate-check.md
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: critical
+
+  - name: design-review
+    spec: tests/skills/design-review.md
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: critical
+
+  - name: story-readiness
+    spec: tests/skills/story-readiness.md
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: critical
+
+  - name: story-done
+    spec: tests/skills/story-done.md
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: critical
+
+  - name: review-all-gdds
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: critical
+
+  - name: architecture-review
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: critical
+
+  # High — pipeline-critical skills
+  - name: create-epics-stories
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: high
+
+  - name: create-control-manifest
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: high
+
+  - name: propagate-design-change
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: high
+
+  - name: architecture-decision
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: high
+
+  - name: map-systems
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: high
+
+  - name: design-system
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: high
+
+  # Medium — team and sprint management skills
+  - name: sprint-plan
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: medium
+
+  - name: sprint-status
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: medium
+
+  - name: team-ui
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: medium
+
+  - name: team-combat
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: medium
+
+  - name: team-narrative
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: medium
+
+  - name: team-audio
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: medium
+
+  - name: team-level
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: medium
+
+  - name: team-polish
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: medium
+
+  - name: team-release
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: medium
+
+  - name: team-live-ops
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: medium
+
+  # Low — analysis, reporting, utility skills
+  - name: skill-test
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: medium
+
+  - name: start
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: low
+
+  - name: help
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: low
+
+  - name: brainstorm
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: low
+
+  - name: project-stage-detect
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: low
+
+  - name: setup-engine
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: low
+
+  - name: quick-design
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last_spec_result: ""
+    priority: low
+
+  - name: ux-design
+    spec: ""
+    last_static: ""
+    last_static_result: ""
+    last_spec: ""
+    last
```

**File**: `tests/skills/design-review.md` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+# Skill Test Spec: /design-review
+
+## Skill Summary
+
+`/design-review` reads a game design document (GDD) and evaluates it against
+the project's 8-section design standard (Overview, Player Fantasy, Detailed
+Rules, Formulas, Edge Cases, Dependencies, Tuning Knobs, Acceptance Criteria).
+It checks for internal consistency, implementability, and cross-system
+conflicts. It produces a verdict of APPROVED, NEEDS REVISION, or MAJOR
+REVISION NEEDED. It is a read-only skill (no file writes) and runs as a
+`context: fork` subagent.
+
+---
+
+## Static Assertions (Structural)
+
+Verified automatically by `/skill-test static` — no fixture needed.
+
+- [ ] Has required frontmatter fields: `name`, `description`, `argument-hint`, `user-invocable`, `allowed-tools`
+- [ ] Has ≥2 phase headings or numbered steps
+- [ ] Contains verdict keywords: APPROVED, NEEDS REVISION, MAJOR REVISION NEEDED
+- [ ] Does NOT require "May I write" language (read-only skill — `allowed-tools` excludes Write/Edit)
+- [ ] Output format is documented (review template shown in skill body)
+
+---
+
+## Test Cases
+
+### Case 1: Happy Path — Complete GDD, all 8 sections present
+
+**Fixture:**
+- `design/gdd/light-manipulation.md` exists (use `_fixtures/minimal-game-concept.md`
+  as a stand-in — represents a complete document with all required content)
+- All 8 required sections are populated with substantive content
+- Formulas section contains at least one formula with defined variables
+- Acceptance Criteria section contains at least 3 testable criteria
+
+**Input:** `/design-review design/gdd/light-manipulation.md`
+
+**Expected behavior:**
+1. Skill reads the target document in full
+2. Skill reads CLAUDE.md for project context and standards
+3. Skill evaluates all 8 required sections (present/absent check)
+4. Skill checks internal consistency (formulas match described behavior)
+5. Skill checks implementability (rules are precise enough to code)
+6. Skill outputs structured review with section-by-section status
+7. Skill outputs APPROVED verdict
+
+**Assertions:**
+- [ ] Skill reads the target file before producing any output
+- [ ] Output includes a "Completeness" section showing X/8 sections present
+- [ ] Output includes an "Internal Consistency" section
+- [ ] Output includes an "Implementability" section
+- [ ] Output ends with a verdict line: APPROVED / NEEDS REVISION / MAJOR REVISION NEEDED
+- [ ] APPROVED verdict is given when all 8 sections are present and consistent
+
+---
+
+### Case 2: Failure Path — Incomplete GDD (4/8 sections)
+
+**Fixture:**
+- `design/gdd/light-manipulation.md` exists using content from
+  `tests/skills/_fixtures/incomplete-gdd.md` (4 of 8 sections populated;
+  Formulas, Edge Cases, Tuning Knobs, Acceptance Criteria are missing)
+
+**Input:** `/design-review design/gdd/light-manipulation.md`
+
+**Expected behavior:**
+1. Skill reads the document
+2. Skill identifies 4 missing sections
+3. Skill outputs "Completeness: 4/8 sections present"
+4. Skill lists specifically which 4 sections are missing
+5. Skill outputs MAJOR REVISION NEEDED verdict (not APPROVED or NEEDS REVISION)
+
+**Assertions:**
+- [ ] Output shows "4/8" in the completeness section (not a higher number)
+- [ ] Output explicitly names each missing section (Formulas, Edge Cases, Tuning Knobs, Acceptance Criteria)
+- [ ] Verdict is MAJOR REVISION NEEDED (not APPROVED or NEEDS REVISION) when ≥3 sections are missing
+- [ ] Output does not suggest the document is implementation-ready
+- [ ] Skill does not write any files (read-only enforcement)
+
+---
+
+### Case 3: Partial Path — 7/8 sections, minor inconsistency
+
+**Fixture:**
+- GDD has all sections except Formulas
+- The described behavior mentions numeric values but no formulas are defined
+- Acceptance Criteria exist but are vague ("feels good" rather than measurable)
+
+**Input:** `/design-review design/gdd/[document].md`
+
+**Expected behavior:**
+1. Skill identifies missing Formulas section
+2. Skill flags vague acceptance criteria as an implementability issue
+3. Skill outputs NEEDS REVISION verdict (not APPROVED, not MAJOR REVISION NEEDED)
+4. Skill provides specific remediation notes for each issue
+
+**Assertions:**
+- [ ] Verdict is NEEDS REVISION (not APPROVED, not MAJOR REVISION NEEDED) for 7/8 with issues
+- [ ] Output identifies the missing Formulas section specifically
+- [ ] Output flags the vague acceptance criteria as an implementability gap
+- [ ] Each flagged issue has a specific, actionable remediation note
+
+---
+
+### Case 4: Edge Case — File not found
+
+**Fixture:**
+- The path provided does not exist in the project
+
+**Input:** `/design-review design/gdd/nonexistent.md`
+
+**Expected behavior:**
+1. Skill attempts to read the file
+2. File not found
+3. Skill outputs an error message naming the missing file
+4. Skill suggests checking the path or listing files in `design/gdd/`
+5. Skill does NOT produce a verdict
+
+**Assertions:**
+- [ ] Sk
```

---

### Incident Patch 12: `cdb1aa83` (2026-03-13)
**Commit Message**: Session memory extraction + tiered context loading improvements

- /review-all-gdds, /architecture-review, /story-done: auto-append Session
  Extract block to active.md after report write (verdict, flags, next action)
- /review-all-gdds, /architecture-review, /create-epics-stories, /content-audit:
  L0 summary scan phase before full document load (reduces token cost)
- GDD template: added Summary section + Cross-References table + Last Verified field
- ADR template: added Summary section + Last Verified field

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `.claude/docs/templates/architecture-decision-record.md` (modified, +14/-1)
```diff
@@ -6,12 +6,25 @@
 
 ## Date
 
-[YYYY-MM-DD]
+[YYYY-MM-DD — when this ADR was written]
+
+## Last Verified
+
+[YYYY-MM-DD — when this ADR was last confirmed accurate against the current
+engine version and design. Update this date when you re-read and confirm it
+is still correct, even if nothing changed.]
 
 ## Decision Makers
 
 [Who was involved in this decision]
 
+## Summary
+
+[2 sentences: what problem this ADR solves, and what was decided. Written for
+tiered context loading — a skill scanning 20 ADRs uses this to decide whether
+to read the full decision. Be specific: name the system, the problem, and the
+chosen approach.]
+
 ## Engine Compatibility
 
 | Field | Value |
```

**File**: `.claude/docs/templates/game-design-document.md` (modified, +27/-0)
```diff
@@ -3,8 +3,17 @@
 > **Status**: Draft | In Review | Approved | Implemented
 > **Author**: [Agent or person]
 > **Last Updated**: [Date]
+> **Last Verified**: [Date — when this doc was last confirmed accurate against current design]
 > **Implements Pillar**: [Which game pillar this supports]
 
+## Summary
+
+[2–3 sentences: what this system is, what it does for the player, and why it
+exists in this game. Written for tiered context loading — a skill scanning
+20 GDDs uses this section to decide whether to read further. No jargon.]
+
+> **Quick reference** — Layer: `[Foundation | Core | Feature | Presentation]` · Priority: `[MVP | Vertical Slice | Alpha | Full Vision]` · Key deps: `[System names or "None"]`
+
 ## Overview
 
 [One paragraph that explains this mechanic to someone who knows nothing about
@@ -174,6 +183,24 @@ These are subjective targets stated precisely enough to get consistent verdicts.
 | Information | Display Location | Update Frequency | Condition |
 |-------------|-----------------|-----------------|-----------|
 
+## Cross-References
+
+[Declare every explicit dependency on another GDD's specific mechanic, value, or
+rule. This table is machine-checked by `/review-all-gdds` Phase 2c — it replaces
+implicit prose references with verifiable declarations. If you reference another
+system's behaviour anywhere in this document, it must appear here.]
+
+| This Document References | Target GDD | Specific Element Referenced | Nature |
+|--------------------------|-----------|----------------------------|--------|
+| [e.g., "combo multiplier feeds score"] | `design/gdd/score.md` | `combo_multiplier` output value | Data dependency |
+| [e.g., "death triggers respawn"] | `design/gdd/respawn.md` | Death state transition | State trigger |
+| [e.g., "stamina gates dodge"] | `design/gdd/stamina.md` | Stamina depletion rule | Rule dependency |
+
+> **Note on "Nature"**: use one of — `Data dependency` (we consume their output),
+> `State trigger` (their state change triggers our behaviour), `Rule dependency`
+> (our rule assumes their rule is also true), `Ownership handoff` (we hand off
+> ownership of a value to them).
+
 ## Acceptance Criteria
 
 [Testable criteria that confirm this mechanic is working as designed.]
```

**File**: `.claude/skills/architecture-review/SKILL.md` (modified, +39/-3)
```diff
@@ -26,14 +26,34 @@ and Pre-Production.
 
 ## Phase 1: Load Everything
 
-Read all inputs before analysis:
+### Phase 1a — L0: Summary Scan (fast, low tokens)
+
+Before reading any full document, use Grep to extract `## Summary` sections
+from all GDDs and ADRs:
+
+```
+Grep pattern="## Summary" glob="design/gdd/*.md" output_mode="content" -A 4
+Grep pattern="## Summary" glob="docs/architecture/adr-*.md" output_mode="content" -A 3
+```
+
+For `single-gdd [path]` mode: use the target GDD's summary to identify which
+ADRs reference the same system (Grep ADRs for the system name), then full-read
+only those ADRs. Skip full-reading unrelated GDDs entirely.
+
+For `engine` mode: only full-read ADRs — GDDs are not needed for engine checks.
+
+For `coverage` or `full` mode: proceed to full-read everything below.
+
+### Phase 1b — L1/L2: Full Document Load
+
+Read all inputs appropriate to the mode:
 
 ### Design Documents
-- All GDDs in `design/gdd/` — read every file completely
+- All in-scope GDDs in `design/gdd/` — read every file completely
 - `design/gdd/systems-index.md` — the authoritative list of systems
 
 ### Architecture Documents
-- All ADRs in `docs/architecture/` — read every file completely
+- All in-scope ADRs in `docs/architecture/` — read every file completely
 - `docs/architecture/architecture.md` if it exists
 
 ### Engine Reference
@@ -389,6 +409,22 @@ If yes:
 This ensures all future story files can reference stable TR-IDs that persist
 across every subsequent architecture review.
 
+### Session State Update
+
+After writing all approved files, silently append to
+`production/session-state/active.md`:
+
+    ## Session Extract — /architecture-review [date]
+    - Verdict: [PASS / CONCERNS / FAIL]
+    - Requirements: [N] total — [X] covered, [Y] partial, [Z] gaps
+    - New TR-IDs registered: [N, or "None"]
+    - GDD revision flags: [comma-separated GDD names, or "None"]
+    - Top ADR gaps: [top 3 gap titles from the report, or "None"]
+    - Report: docs/architecture/architecture-review-[date].md
+
+If `active.md` does not exist, create it with this block as the initial content.
+Confirm in conversation: "Session state updated."
+
 The traceability index format:
 
 ```markdown
```

**File**: `.claude/skills/content-audit/SKILL.md` (modified, +14/-4)
```diff
@@ -22,10 +22,20 @@ Parse the argument:
 1. **Read `design/gdd/systems-index.md`** for the full list of systems, their
    categories, and MVP/priority tier.
 
-2. **Read all GDD files** in `design/gdd/` (or the single system GDD if a
-   system name was given).
-
-3. **For each GDD, extract explicit content counts or lists.** Look for patterns
+2. **L0 pre-scan**: Before full-reading any GDDs, Grep all GDD files for
+   `## Summary` sections plus common content-count keywords:
+   ```
+   Grep pattern="(## Summary|N enemies|N levels|N items|N abilities|enemy types|item types)" glob="design/gdd/*.md" output_mode="files_with_matches"
+   ```
+   For a single-system audit: skip this step and go straight to full-read.
+   For a full audit: full-read only the GDDs that matched content-count keywords.
+   GDDs with no content-count language (pure mechanics GDDs) are noted as
+   "No auditable content counts" without a full read.
+
+3. **Full-read in-scope GDD files** (or the single system GDD if a system
+   name was given).
+
+4. **For each GDD, extract explicit content counts or lists.** Look for patterns
    like:
    - "N enemies" / "enemy types:" / list of named enemies
    - "N levels" / "N areas" / "N maps" / "N stages"
```

**File**: `.claude/skills/create-epics-stories/SKILL.md` (modified, +19/-2)
```diff
@@ -40,11 +40,28 @@ If no argument, use `AskUserQuestion`:
 
 ## 2. Load All Inputs
 
-Read everything before generating any output:
+### Step 2a — L0: Summary Scan
+
+Before full-reading any documents, Grep all GDDs for their `## Summary` sections:
+
+```
+Grep pattern="## Summary" glob="design/gdd/*.md" output_mode="content" -A 5
+```
+
+For `all` mode: display a manifest of all Approved/Designed GDDs with their
+summaries so the user can confirm scope before the full load begins.
+
+For `layer:` or `[system-name]` modes: filter to only the target GDDs based
+on the Summary quick-reference line (Layer + Priority). Skip full-reading
+GDDs outside the requested scope entirely.
+
+### Step 2b — L1/L2: Full Document Load
+
+Read everything for the in-scope systems before generating any output:
 
 ### Design Documents
 - `design/gdd/systems-index.md` — authoritative system list, layers, status
-- All GDDs in `design/gdd/` — read every file with "Approved" or "Designed" status
+- In-scope GDDs in `design/gdd/` — read every file with "Approved" or "Designed" status
 - For each GDD, extract:
   - System name and layer (from systems-index.md)
   - All acceptance criteria (these become story acceptance criteria)
```

**File**: `.claude/skills/review-all-gdds/SKILL.md` (modified, +43/-7)
```diff
@@ -38,17 +38,37 @@ completeness. This skill reviews the *relationships* between all GDDs.
 
 ## Phase 1: Load Everything
 
-Read all design documents before any analysis:
+### Phase 1a — L0: Summary Scan (fast, low tokens)
+
+Before reading any full document, use Grep to extract `## Summary` sections
+from all GDD files:
+
+```
+Grep pattern="## Summary" glob="design/gdd/*.md" output_mode="content" -A 5
+```
+
+Display a manifest to the user:
+```
+Found [N] GDDs. Summaries:
+  • combat.md — [summary text]
+  • inventory.md — [summary text]
+  ...
+```
+
+For `since-last-review` mode: run `git log --name-only` to identify GDDs
+modified since the last review report file was written. Show the user which
+GDDs are in scope based on summaries before doing any full reads. Only
+proceed to L1 for those GDDs plus any GDDs listed in their "Key deps".
+
+### Phase 1b — L1/L2: Full Document Load
+
+Full-read the in-scope documents:
 
 1. `design/gdd/game-concept.md` — game vision, core loop, MVP definition
 2. `design/gdd/game-pillars.md` if it exists — design pillars and anti-pillars
 3. `design/gdd/systems-index.md` — authoritative system list, layers, dependencies, status
-4. **Every system GDD in `design/gdd/`** — read completely (skip game-concept.md
-   and systems-index.md — those are read above)
-
-For `since-last-review` mode: run `git log --name-only` to identify GDDs
-modified since the last review report file was written. Only load those GDDs
-plus any GDDs they depend on.
+4. **Every in-scope system GDD in `design/gdd/`** — read completely (skip
+   game-concept.md and systems-index.md — those are read above)
 
 Report: "Loaded [N] system GDDs covering [M] systems. Pillars: [list]. Anti-pillars: [list]."
 
@@ -510,6 +530,22 @@ Ask: "Should I update the systems index to mark these GDDs as needing revision?"
   as an exact string and parentheticals break that match.)
   Ask approval before writing.
 
+### Session State Update
+
+After writing the report (and updating systems index if approved), silently
+append to `production/session-state/active.md`:
+
+    ## Session Extract — /review-all-gdds [date]
+    - Verdict: [PASS / CONCERNS / FAIL]
+    - GDDs reviewed: [N]
+    - Flagged for revision: [comma-separated list, or "None"]
+    - Blocking issues: [N — brief one-line descriptions, or "None"]
+    - Recommended next: [the Phase 7 handoff action, condensed to one line]
+    - Report: design/gdd/gdd-cross-review-[date].md
+
+If `active.md` does not exist, create it with this block as the initial content.
+Confirm in conversation: "Session state updated."
+
 ---
 
 ## Phase 7: Handoff
```

**File**: `.claude/skills/story-done/SKILL.md` (modified, +14/-0)
```diff
@@ -269,6 +269,20 @@ If yes, edit the story file:
    - Update the top-level `updated` field
    - This is a silent update — no extra approval needed (already approved in step above)
 
+### Session State Update
+
+After updating the story file, silently append to
+`production/session-state/active.md`:
+
+    ## Session Extract — /story-done [date]
+    - Verdict: [COMPLETE / COMPLETE WITH NOTES / BLOCKED]
+    - Story: [story file path] — [story title]
+    - Tech debt logged: [N items, or "None"]
+    - Next recommended: [next ready story title and path, or "None identified"]
+
+If `active.md` does not exist, create it with this block as the initial content.
+Confirm in conversation: "Session state updated."
+
 ---
 
 ## Phase 8: Surface the Next Story
```

---

### Incident Patch 13: `70fbf670` (2026-03-12)
**Commit Message**: Gap closure: feedback loops, traceability, and new /content-audit skill

- NEW /content-audit skill: GDD-specified content vs implemented content gap
  report with COMPLETE/IN PROGRESS/EARLY/NOT STARTED per system
- balance-check: Fix & Verify Cycle phase (fix → re-verify → propagate-design-change)
- perf-profile: Scope & Timeline Decision phase for M/L effort optimizations
- playtest-report: Action Routing phase categorizes findings → design/balance/bugs/polish
- review-all-gdds: Phase 4 Cross-System Scenario Walkthrough (multi-system sequences)
- story-done: Test-Criterion Traceability (each AC mapped to a test, BLOCKING if >50% untested)
- code-review: ADR Compliance Check (ARCHITECTURAL VIOLATION / ADR DRIFT / MINOR DEVIATION)
- setup-engine: upgrade subcommand (pre-upgrade API scan, migration plan, VERSION.md update)
- story-readiness: Asset References Check (verifies referenced asset paths exist)
- validate-assets.sh: invalid JSON now exits 1 (blocking); naming issues exit 0 (warning)
- workflow-catalog.yaml + sprint-plan: /scope-check wired into production phase

Co-Authored-By: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `.claude/docs/workflow-catalog.yaml` (modified, +10/-0)
```diff
@@ -221,6 +221,16 @@ phases:
         repeatable: true
         description: "Verify all acceptance criteria, check GDD/ADR deviations, close the story"
 
+      - id: scope-check
+        name: "Scope Check"
+        command: /scope-check
+        required: false
+        repeatable: true
+        artifact:
+          glob: "production/sprints/sprint-*.md"
+          note: "Run when stories are added mid-sprint, or before sprint retrospectives"
+        description: "Detect scope creep by comparing current sprint scope to original epic scope. Run (a) when stories are added mid-sprint, or (b) before sprint retrospectives."
+
       - id: sprint-status
         name: "Sprint Status"
         command: /sprint-status
```

**File**: `.claude/hooks/validate-assets.sh` (modified, +21/-7)
```diff
@@ -1,7 +1,10 @@
 #!/bin/bash
 # Claude Code PostToolUse hook: Validates asset files after Write/Edit
 # Checks naming conventions for files in assets/ directory
-# Exit 0 = success (non-blocking, PostToolUse cannot block)
+#
+# Exit behavior:
+#   exit 0 = success or advisory warnings only (non-blocking)
+#   exit 1 = blocking error (build-breaking issues: invalid JSON, missing required fields)
 #
 # Input schema (PostToolUse for Write/Edit):
 # { "tool_name": "Write", "tool_input": { "file_path": "assets/data/foo.json", "content": "..." } }
@@ -24,14 +27,18 @@ if ! echo "$FILE_PATH" | grep -qE '(^|/)assets/'; then
 fi
 
 FILENAME=$(basename "$FILE_PATH")
-WARNINGS=""
+WARNINGS=""   # Style/convention issues -- exit 0 with advisory message
+ERRORS=""     # Build-breaking issues -- exit 1 to block the operation
 
-# Check naming convention (lowercase with underscores only) -- uses grep -E instead of grep -P
+# ADVISORY: Check naming convention (lowercase with underscores only)
+# Naming issues are style violations -- warn but do not block
+# Uses grep -E (POSIX) not grep -P (Perl) for Windows Git Bash compatibility
 if echo "$FILENAME" | grep -qE '[A-Z[:space:]-]'; then
-    WARNINGS="$WARNINGS\nNAMING: $FILE_PATH must be lowercase with underscores (got: $FILENAME)"
+    WARNINGS="$WARNINGS\n  NAMING: $FILE_PATH must be lowercase with underscores (got: $FILENAME)"
 fi
 
-# Check JSON validity for data files
+# BLOCKING: Check JSON validity for data files
+# Invalid JSON will break runtime loading -- this is a build-breaking error
 if echo "$FILE_PATH" | grep -qE '(^|/)assets/data/.*\.json$'; then
     if [ -f "$FILE_PATH" ]; then
         # Find a working Python command
@@ -45,14 +52,21 @@ if echo "$FILE_PATH" | grep -qE '(^|/)assets/data/.*\.json$'; then
 
         if [ -n "$PYTHON_CMD" ]; then
             if ! "$PYTHON_CMD" -m json.tool "$FILE_PATH" > /dev/null 2>&1; then
-                WARNINGS="$WARNINGS\nFORMAT: $FILE_PATH is not valid JSON"
+                ERRORS="$ERRORS\n  FORMAT: $FILE_PATH is not valid JSON — fix syntax errors before continuing"
             fi
         fi
     fi
 fi
 
+# Report warnings (advisory -- non-blocking)
 if [ -n "$WARNINGS" ]; then
-    echo -e "=== Asset Validation ===$WARNINGS\n========================" >&2
+    echo -e "=== Asset Validation: Warnings ===$WARNINGS\n==================================\n(Warnings are advisory. Fix before final commit.)" >&2
+fi
+
+# Report errors and block if any build-breaking issues found
+if [ -n "$ERRORS" ]; then
+    echo -e "=== Asset Validation: ERRORS (Blocking) ===$ERRORS\n===========================================\nFix these errors before proceeding." >&2
+    exit 1
 fi
 
 exit 0
```

**File**: `.claude/skills/balance-check/SKILL.md` (modified, +19/-0)
```diff
@@ -72,3 +72,22 @@ When this skill is invoked:
 ### Values That Need Attention
 [Specific values with suggested adjustments and rationale]
 ```
+
+6. **Fix & Verify Cycle**
+
+   After presenting the report, ask:
+
+   > "Would you like to fix any of these balance issues now?"
+
+   If yes:
+   - Ask which issue to address first (refer to the Recommendations table by priority row)
+   - Guide the user to update the relevant data file in `assets/data/` or formula in `design/balance/`
+   - After each fix, offer to re-run the relevant balance checks for that system to verify the fix did not introduce new outliers or degenerate interactions
+   - If the fix changes a tuning knob that is defined in a GDD or referenced by an ADR, remind the user:
+     > "This value is defined in a design document. Run `/propagate-design-change [path]` on the affected GDD to find downstream impacts before committing."
+
+   If no:
+   - Summarize the open issues and suggest saving the report to `design/balance/balance-check-[system]-[date].md` for later.
+
+   End with:
+   > "Re-run `/balance-check` after fixes to verify."
```

**File**: `.claude/skills/code-review/SKILL.md` (modified, +43/-7)
```diff
@@ -14,43 +14,79 @@ When this skill is invoked:
 
 2. **Read the CLAUDE.md** for project coding standards.
 
-3. **Identify the system category** (engine, gameplay, AI, networking, UI, tools)
+3. **ADR Compliance Check**:
+
+   a. Search for ADR references in: the story file associated with this work (if
+      provided), any commit message context, and header comments in the files being
+      reviewed. Look for patterns like `ADR-NNN`, `ADR-[name]`, or
+      `docs/architecture/ADR-`.
+
+   b. If no ADR references are found, note:
+      > "No ADR references found — skipping ADR compliance check."
+      Then proceed to step 4.
+
+   c. For each referenced ADR: read `docs/architecture/ADR-NNN-*.md` and extract
+      the **Decision** and **Consequences** sections.
+
+   d. Check the implementation against each ADR:
+      - What pattern/approach was chosen in the Decision?
+      - Are there alternatives explicitly rejected in the ADR?
+      - Are there required guardrails or constraints in the Consequences?
+
+   e. Classify any deviation found:
+      - **ARCHITECTURAL VIOLATION** (BLOCKING): Implementation uses a pattern
+        explicitly rejected in the ADR (e.g., ADR rejected singletons for game
+        state, but the code uses a singleton).
+      - **ADR DRIFT** (WARNING): Implementation diverges meaningfully from the
+        chosen approach without using an explicitly forbidden pattern (e.g., ADR
+        chose event-based communication but code uses direct method calls).
+      - **MINOR DEVIATION** (INFO): Small difference from ADR guidance that does
+        not affect the overall architecture (e.g., slightly different naming from
+        the ADR's example code).
+
+   f. Include ADR compliance findings in the review output under
+      `### ADR Compliance` before the Standards Compliance section.
+
+4. **Identify the system category** (engine, gameplay, AI, networking, UI, tools)
    and apply category-specific standards.
 
-4. **Evaluate against coding standards**:
+5. **Evaluate against coding standards**:
    - [ ] Public methods and classes have doc comments
    - [ ] Cyclomatic complexity under 10 per method
    - [ ] No method exceeds 40 lines (excluding data declarations)
    - [ ] Dependencies are injected (no static singletons for game state)
    - [ ] Configuration values loaded from data files
    - [ ] Systems expose interfaces (not concrete class dependencies)
 
-5. **Check architectural compliance**:
+6. **Check architectural compliance**:
    - [ ] Correct dependency direction (engine <- gameplay, not reverse)
    - [ ] No circular dependencies between modules
    - [ ] Proper layer separation (UI does not own game state)
    - [ ] Events/signals used for cross-system communication
    - [ ] Consistent with established patterns in the codebase
 
-6. **Check SOLID compliance**:
+7. **Check SOLID compliance**:
    - [ ] Single Responsibility: Each class has one reason to change
    - [ ] Open/Closed: Extendable without modification
    - [ ] Liskov Substitution: Subtypes substitutable for base types
    - [ ] Interface Segregation: No fat interfaces
    - [ ] Dependency Inversion: Depends on abstractions, not concretions
 
-7. **Check for common game development issues**:
+8. **Check for common game development issues**:
    - [ ] Frame-rate independence (delta time usage)
    - [ ] No allocations in hot paths (update loops)
    - [ ] Proper null/empty state handling
    - [ ] Thread safety where required
    - [ ] Resource cleanup (no leaks)
 
-8. **Output the review** in this format:
+9. **Output the review** in this format:
 
 ```
 ## Code Review: [File/System Name]
 
+### ADR Compliance: [NO ADRS FOUND / COMPLIANT / DRIFT / VIOLATION]
+[List each ADR checked, result, and any deviations with severity]
+
 ### Standards Compliance: [X/6 passing]
 [List failures with line references]
 
@@ -67,7 +103,7 @@ When this skill is invoked:
 [What is done well -- always include this section]
 
 ### Required Changes
-[Must-fix items before approval]
+[Must-fix items before approval — ARCHITECTURAL VIOLATIONs always appear here]
 
 ### Suggestions
 [Nice-to-have improvements]
```

**File**: `.claude/skills/content-audit/SKILL.md` (added, +179/-0)
```diff
@@ -0,0 +1,179 @@
+---
+name: content-audit
+description: "Audit GDD-specified content counts against implemented content. Identifies what's planned vs built."
+argument-hint: "[system-name|--summary]"
+user-invocable: true
+allowed-tools: Read, Glob, Grep, Write
+context: fork
+agent: producer
+---
+
+When this skill is invoked:
+
+Parse the argument:
+- No argument → full audit across all systems
+- `[system-name]` → audit that single system only
+- `--summary` → summary table only, no file write
+
+---
+
+## Phase 1 — Context Gathering
+
+1. **Read `design/gdd/systems-index.md`** for the full list of systems, their
+   categories, and MVP/priority tier.
+
+2. **Read all GDD files** in `design/gdd/` (or the single system GDD if a
+   system name was given).
+
+3. **For each GDD, extract explicit content counts or lists.** Look for patterns
+   like:
+   - "N enemies" / "enemy types:" / list of named enemies
+   - "N levels" / "N areas" / "N maps" / "N stages"
+   - "N items" / "N weapons" / "N equipment pieces"
+   - "N abilities" / "N skills" / "N spells"
+   - "N dialogue scenes" / "N conversations" / "N cutscenes"
+   - "N quests" / "N missions" / "N objectives"
+   - Any explicit enumerated list (bullet list of named content pieces)
+
+4. **Build a content inventory table** from the extracted data:
+
+   | System | Content Type | Specified Count/List | Source GDD |
+   |--------|-------------|---------------------|------------|
+
+   Note: If a GDD describes content qualitatively but gives no count, record
+   "Unspecified" and flag it — unspecified counts are a design gap worth noting.
+
+---
+
+## Phase 2 — Implementation Scan
+
+For each content type found in Phase 1, scan the relevant directories to count
+what has been implemented. Use Glob and Grep to locate files.
+
+**Levels / Areas / Maps:**
+- Glob `assets/**/*.tscn`, `assets/**/*.unity`, `assets/**/*.umap`
+- Glob `src/**/*.tscn`, `src/**/*.unity`
+- Look for scene files in subdirectories named `levels/`, `areas/`, `maps/`,
+  `worlds/`, `stages/`
+- Count unique files that appear to be level/scene definitions (not UI scenes)
+
+**Enemies / Characters / NPCs:**
+- Glob `assets/data/**/enemies/**`, `assets/data/**/characters/**`
+- Glob `src/**/enemies/**`, `src/**/characters/**`
+- Look for `.json`, `.tres`, `.asset`, `.yaml` data files defining entity stats
+- Look for scene/prefab files in character subdirectories
+
+**Items / Equipment / Loot:**
+- Glob `assets/data/**/items/**`, `assets/data/**/equipment/**`,
+  `assets/data/**/loot/**`
+- Look for `.json`, `.tres`, `.asset` data files
+
+**Abilities / Skills / Spells:**
+- Glob `assets/data/**/abilities/**`, `assets/data/**/skills/**`,
+  `assets/data/**/spells/**`
+- Look for `.json`, `.tres`, `.asset` data files
+
+**Dialogue / Conversations / Cutscenes:**
+- Glob `assets/**/*.dialogue`, `assets/**/*.csv`, `assets/**/*.ink`
+- Grep for dialogue data files in `assets/data/`
+
+**Quests / Missions:**
+- Glob `assets/data/**/quests/**`, `assets/data/**/missions/**`
+- Look for `.json`, `.yaml` definition files
+
+**Engine-specific notes (acknowledge in the report):**
+- Counts are approximations — the skill cannot perfectly parse every engine
+  format or distinguish editor-only files from shipped content
+- Scene files may include both gameplay content and system/UI scenes; the scan
+  counts all matches and notes this caveat
+
+---
+
+## Phase 3 — Gap Report
+
+Produce the gap table:
+
+```
+| System | Content Type | Specified | Found | Gap | Status |
+|--------|-------------|-----------|-------|-----|--------|
+```
+
+**Status categories:**
+- `COMPLETE` — Found ≥ Specified (100%+)
+- `IN PROGRESS` — Found is 50–99% of Specified
+- `EARLY` — Found is 1–49% of Specified
+- `NOT STARTED` — Found is 0
+
+**Priority flags:**
+Flag a system as `HIGH PRIORITY` in the report if:
+- Status is `NOT STARTED` or `EARLY`, AND
+- The system is tagged MVP or Vertical Slice in the systems index, OR
+- The systems index shows the system is blocking downstream systems
+
+**Summary line:**
+- Total content items specified (sum of all Specified column values)
+- Total content items found (sum of all Found column values)
+- Overall gap percentage: `(Specified - Found) / Specified * 100`
+
+---
+
+## Phase 4 — Output
+
+### Full audit and single-system modes
+
+Write the report to `docs/content-audit-[YYYY-MM-DD].md`:
+
+```markdown
+# Content Audit — [Date]
+
+## Summary
+- **Total specified**: [N] content items across [M] systems
+- **Total found**: [N]
+- **Gap**: [N] items ([X%] unimplemented)
+- **Scope**: [Full audit | System: name]
+
+> Note: Counts are approximations based on file scanning.
+> The audit cannot distinguish shipped content from editor/test assets.
+> Manual verification is recommended for any HIGH PRIORITY gaps.
+
+## Gap Table
+
+| System | Content Type | Specified | Found | Gap | Status |
+|--------|-------------|-----------|-------|-----|--------|
+
+## HIGH PRIORITY Gaps
+
+[Li
```

**File**: `.claude/skills/perf-profile/SKILL.md` (modified, +21/-0)
```diff
@@ -84,6 +84,27 @@ When this skill is invoked:
 
 5. **Output the report** with a summary: top 3 hotspots, estimated headroom vs budget, and recommended next action.
 
+6. **Scope & Timeline Decision** — activate this phase only if any hotspot has Fix Effort rated M or L.
+
+   Present a summary of the significant-effort items:
+
+   > "The following optimizations require significant effort: [list titles and effort ratings from the Hotspots table]"
+
+   For each M/L item, ask the user to choose one of:
+
+   - **A) Implement the optimization** (estimated effort: [S/M/L] — proceed with fix now or schedule it)
+   - **B) Reduce feature scope to avoid the bottleneck** (run `/scope-check [feature]` to analyze the trade-offs)
+   - **C) Accept the performance hit and defer to Polish phase** (log it as a known issue)
+   - **D) Escalate to technical-director for an architectural decision** (the bottleneck warrants an ADR)
+
+   For choice B, remind the user:
+   > "Run `/scope-check [feature]` to see what simplifications are available without sacrificing player experience."
+
+   For choice D, note:
+   > "A bottleneck requiring architectural change should become a new Architecture Decision Record. Run `/architecture-decision` to capture the decision and its trade-offs."
+
+   If multiple items are deferred to Polish (choice C), record them in the report under a `### Deferred to Polish` section so they are not lost.
+
 ### Rules
 - Never optimize without measuring first — gut feelings about performance are unreliable
 - Recommendations must include estimated impact — "make it faster" is not actionable
```

**File**: `.claude/skills/playtest-report/SKILL.md` (modified, +32/-0)
```diff
@@ -75,3 +75,35 @@ When invoked with `new`, generate this template:
 When invoked with `analyze`, read the raw notes, cross-reference with existing
 design documents, and fill in the template above with structured findings.
 Flag any playtest observations that conflict with design intent.
+
+After generating or analyzing a report, run the **Action Routing** phase:
+
+**Action Routing**
+
+Categorize all findings from the report into the four buckets below (a single
+finding may appear in more than one bucket if appropriate):
+
+- **Design changes needed** — fun issues, player confusion, broken mechanics,
+  observations that conflict with the GDD's intended experience
+- **Balance adjustments** — numbers feel wrong, difficulty too spiked or too
+  flat, economy or progression feedback
+- **Bug reports** — clear implementation defects that are reproducible
+- **Polish items** — not blocking progress, but friction or feel issues noted
+  for later
+
+Present the categorized list, then provide the routing guidance for each
+non-empty bucket:
+
+- **Design changes:** "These findings suggest GDD revisions. Run
+  `/propagate-design-change [path]` on the affected design document to find
+  downstream impacts before making changes."
+- **Balance adjustments:** "Run `/balance-check [system]` to verify the full
+  balance picture before tuning individual values."
+- **Bugs:** "Use `/bug-report` to formally track these so they are not lost
+  between sessions."
+- **Polish items:** "No immediate action required. Consider adding these to the
+  polish backlog in `production/` when the team reaches that phase."
+
+Finally, ask:
+
+> "Which category would you like to act on first?"
```

**File**: `.claude/skills/review-all-gdds/SKILL.md` (modified, +105/-3)
```diff
@@ -339,7 +339,90 @@ exploration.md: "You are a reckless adventurer — diving in without a plan"
 
 ---
 
-## Phase 4: Output the Review Report
+## Phase 4: Cross-System Scenario Walkthrough
+
+Walk through the game from the player's perspective to find problems that only
+appear at the interaction boundary between multiple systems — things static
+analysis of individual GDDs cannot surface.
+
+### 4a: Identify Key Multi-System Moments
+
+Scan all GDDs and identify the 3–5 most important player-facing moments where
+multiple systems activate simultaneously. Look specifically for:
+
+- **Combat + Economy overlap**: killing enemies that drop resources, spending
+  resources during combat, death/respawn interacting with economy state
+- **Progression + Difficulty overlap**: level-up triggering mid-fight, ability
+  unlocks changing combat viability, difficulty scaling at progression milestones
+- **Narrative + Gameplay overlap**: dialogue choices locking/unlocking mechanics,
+  story beats interrupting resource loops, quest completion triggering system
+  state changes
+- **3+ system chains**: any player action that triggers System A, which feeds
+  into System B, which triggers System C (these are highest-risk interaction paths)
+
+List each identified scenario with a one-line description before proceeding.
+
+### 4b: Walk Through Each Scenario
+
+For each scenario, step through the sequence explicitly:
+
+1. **Trigger** — what player action or game event starts this?
+2. **Activation order** — which systems activate, in what sequence?
+3. **Data flow** — what does each system output, and is that output a valid
+   input for the next system in the chain?
+4. **Player experience** — what does the player see, hear, or feel at each step?
+5. **Failure modes** — are there any of the following?
+   - **Race conditions**: two systems trying to modify the same state simultaneously
+   - **Feedback loops**: System A amplifies System B which re-amplifies System A
+     with no cap or dampener
+   - **Broken state transitions**: a system assumes a state that a previous
+     system may have changed (e.g., "player is alive" assumption after a combat
+     step that could have caused death)
+   - **Contradictory messaging**: player receives conflicting feedback from two
+     systems reacting to the same event (e.g., "success" sound + "failure" UI)
+   - **Compounding difficulty spikes**: two systems both scaling up at the same
+     progression point, multiplying the intended difficulty increase
+   - **Reward conflicts**: two systems both reacting to the same trigger with
+     rewards that together exceed the intended value (double-dipping)
+   - **Undefined behavior**: the GDDs don't specify what happens in this combined
+     state (neither system's rules cover it)
+
+```
+Example walkthrough:
+Scenario: Player kills elite enemy at level-up threshold during active quest
+
+Trigger: Player lands killing blow on elite enemy
+→ combat.md: awards kill XP (100 pts)
+→ progression.md: XP total crosses level threshold → triggers level-up
+  Output: new level, stat increases, ability unlock popup
+→ quest.md: kill-count criterion met → triggers quest completion event
+  Output: quest reward XP (500 pts), completion fanfare
+→ progression.md (again): quest XP added → triggers SECOND level-up in same frame
+  ⚠️  Data flow issue: quest.md awards XP without checking if a level-up
+  is already in progress. progression.md has no guard against concurrent
+  level-up events. Undefined behavior: does the player level up once or twice?
+  Does the ability popup fire twice? Does the second level use the updated or
+  pre-update stat baseline?
+```
+
+### 4c: Flag Scenario Issues
+
+For each problem found during the walkthrough, categorize severity:
+
+- **BLOCKER**: undefined behavior, broken state transition, or contradictory
+  player messaging — the experience is broken or incoherent in this scenario
+- **WARNING**: compounding spikes, feedback loops without caps, reward conflicts —
+  the experience works but produces unintended outcomes
+- **INFO**: minor ordering ambiguity or messaging overlap — worth noting but
+  unlikely to cause player-visible problems
+
+Add all findings to the output report under **"Cross-System Scenario Issues"**.
+Each finding must cite: the scenario name, the specific systems involved, the
+step where the issue occurs, and the nature of the failure mode.
+
+---
+
+## Phase 5: Output the Review Report
 
 ```
 ## Cross-GDD Review Report
@@ -373,6 +456,25 @@ Systems Covered: [list]
 
 ---
 
+### Cross-System Scenario Issues
+
+Scenarios walked: [N]
+[List scenario names]
+
+#### Blockers
+🔴 [Scenario name] — [Systems involved]
+[Step where failure occurs, nature of the failure mode, what must be resolved]
+
+#### Warnings
+⚠️  [Scenario name] — [Systems involved]
+[What the unintended outcome is, recommendation]
+
+#### Info
+ℹ️  [Scenario name] — [Systems involved]
+[Minor ordering ambiguity or note]
+

```

---

### Incident Patch 14: `b1cad29b` (2026-03-10)
**Commit Message**: Release v0.4.0: UX pipeline, game-dev improvements

## New Skills (9)
- /quick-design: lightweight spec path for small changes (bypasses full GDD pipeline)
- /story-readiness: validates stories are implementation-ready before pickup
- /story-done: end-of-story completion review (criteria verification, deviation check, status update)
- /sprint-status: fast 30-line sprint snapshot, read-only
- /ux-design: guided section-by-section UX spec authoring (screen/flow/HUD/patterns)
- /ux-review: UX spec validation with APPROVED/NEEDS REVISION/MAJOR REVISION verdict
- /architecture-review, /create-architecture, /create-control-manifest,
  /create-epics-stories, /propagate-design-change, /review-all-gdds (pipeline completion)

## New Templates (7)
- player-journey.md: 6-phase emotional arc, critical moments, retention hooks
- difficulty-curve.md: difficulty axes, onboarding ramp, cross-system interactions
- ux-spec.md: per-screen UX spec with states, interaction map, data requirements, events
- hud-design.md: whole-game HUD with philosophy, info architecture, element specs
- accessibility-requirements.md: project-wide accessibility tier commitment and audit
- interaction-pattern-library.md: 2

**File**: `.claude/docs/templates/accessibility-requirements.md` (added, +331/-0)
```diff
@@ -0,0 +1,331 @@
+# Accessibility Requirements: [Game Title]
+
+> **Status**: Draft | Committed | Audited | Certified
+> **Author**: [ux-designer / producer]
+> **Last Updated**: [Date]
+> **Accessibility Tier Target**: [Basic / Standard / Comprehensive / Exemplary]
+> **Platform(s)**: [PC / Xbox / PlayStation 5 / Nintendo Switch / iOS / Android]
+> **External Standards Targeted**:
+> - WCAG 2.1 Level [A / AA / AAA]
+> - AbleGamers CVAA Guidelines
+> - Xbox Accessibility Guidelines (XAG) [Yes / No / Partial]
+> - PlayStation Accessibility (Sony Guidelines) [Yes / No / Partial]
+> - Apple / Google Accessibility Guidelines [Yes / No / N/A — mobile only]
+> **Accessibility Consultant**: [Name and organization, or "None engaged"]
+> **Linked Documents**: `design/gdd/systems-index.md`, `docs/ux/interaction-pattern-library.md`
+
+> **Why this document exists**: Per-screen accessibility annotations belong in
+> UX specs. This document captures the project-wide accessibility commitments,
+> the feature matrix across all systems, the test plan, and the audit history.
+> It is created once during Technical Setup by the UX designer and producer,
+> then updated as features are added and audits are completed. If a feature
+> conflicts with a commitment made here, this document wins — change the feature,
+> not the commitment, unless the producer approves a formal revision.
+>
+> **When to update**: After each `/gate-check` pass, after any accessibility
+> audit, and whenever a new game system is added to `systems-index.md`.
+
+---
+
+## Accessibility Tier Definition
+
+> **Why define tiers**: Accessibility is not binary. Defining four tiers gives
+> the team a shared vocabulary, forces an explicit commitment at the start of
+> production, and prevents scope creep in both directions ("we'll add it later"
+> and "we have to support everything"). The tiers below are this project's
+> definitions — the industry uses similar but not identical language. Commit to
+> a tier with specific feature targets, not just the tier name.
+
+### Tier Definitions
+
+| Tier | Core Commitment | Typical Effort |
+|------|----------------|----------------|
+| **Basic** | Critical player-facing text is readable at standard resolution. No feature requires color discrimination alone. Volume controls exist for music, SFX, and voice independently. The game is completable without photosensitivity risk. | Low — primarily design constraints |
+| **Standard** | All of Basic, plus: full input remapping on all platforms, subtitle support with speaker identification, adjustable text size, at least one colorblind mode, and no timed input that cannot be extended or toggled. | Medium — requires dedicated implementation work |
+| **Comprehensive** | All of Standard, plus: screen reader support for menus, mono audio option, difficulty assist modes, HUD element repositioning, reduced motion mode, and visual indicators for all gameplay-critical audio. | High — requires platform API integration and significant UI architecture |
+| **Exemplary** | All of Comprehensive, plus: full subtitle customization (font, size, color, background, position), high contrast mode, cognitive load assist tools, tactile/haptic alternatives for all audio-only cues, and external third-party accessibility audit. | Very High — requires dedicated accessibility budget and specialist consultation |
+
+### This Project's Commitment
+
+**Target Tier**: [Standard]
+
+**Rationale**: [Write 3-5 sentences justifying the tier choice. Do not simply
+state the tier — explain the reasoning. Consider: What is the game's genre and
+how does it map to common accessibility barriers (e.g., fast-twitch games have
+motor barriers; reading-heavy games have visual barriers)? Who is the target
+player and what does the research say about disability prevalence in that group?
+What are the platform requirements (Xbox requires XAG compliance for ID@Xbox)?
+What is the team's capacity? What would dropping one tier cost the player base,
+in concrete terms?
+
+Example: "This is a narrative RPG with turn-based combat targeted at players
+25-45. The turn-based structure eliminates the most severe motor barriers common
+in action games, but the reading-heavy design creates significant visual and
+cognitive barriers. Standard tier addresses all of these. Exemplary tier is not
+achievable without a dedicated accessibility engineer. Xbox ID@Xbox program
+requires XAG compliance for Game Pass consideration, which Standard meets.
+Dropping to Basic would exclude players who rely on colorblind modes or input
+remapping, estimated at 8-12% of the target audience based on AbleGamers data."]
+
+**Features explicitly in scope (beyond tier baseline)**:
+- [e.g., "Full subtitle customization — elevated from Comprehensive because our
+  game is dialogue-heavy and subtitles are a primary channel"]
+- [e.g., "One-hand mode for controller — we have hold inputs critical to combat"]
+
+**Features explicitly out of scope**:
+- [e.g., 
```

**File**: `.claude/docs/templates/architecture-decision-record.md` (modified, +39/-3)
```diff
@@ -12,6 +12,29 @@
 
 [Who was involved in this decision]
 
+## Engine Compatibility
+
+| Field | Value |
+|-------|-------|
+| **Engine** | [e.g. Godot 4.6 / Unity 6 / Unreal Engine 5.4] |
+| **Domain** | [Physics / Rendering / UI / Audio / Navigation / Animation / Networking / Core / Input / Scripting] |
+| **Knowledge Risk** | [LOW — in training data / MEDIUM — near cutoff, verify / HIGH — post-cutoff, must verify] |
+| **References Consulted** | [e.g. `docs/engine-reference/godot/modules/physics.md`, `breaking-changes.md`] |
+| **Post-Cutoff APIs Used** | [Specific APIs from post-cutoff engine versions this decision depends on, or "None"] |
+| **Verification Required** | [Concrete behaviours to test against the target engine version before shipping, or "None"] |
+
+> **Note**: If Knowledge Risk is MEDIUM or HIGH, this ADR must be re-validated if the
+> project upgrades engine versions. Flag it as "Superseded" and write a new ADR.
+
+## ADR Dependencies
+
+| Field | Value |
+|-------|-------|
+| **Depends On** | [ADR-NNNN (must be Accepted before this can be implemented), or "None"] |
+| **Enables** | [ADR-NNNN (this ADR unlocks that decision), or "None"] |
+| **Blocks** | [Epic/Story name — cannot start until this ADR is Accepted, or "None"] |
+| **Ordering Note** | [Any sequencing constraint that isn't captured above] |
+
 ## Context
 
 ### Problem Statement
@@ -120,8 +143,21 @@ creates. These become the contracts that implementers must respect.]
 - [ ] [Measurable criterion 2]
 - [ ] [Performance criterion]
 
+## GDD Requirements Addressed
+
+<!-- This section is MANDATORY. Every ADR must trace back to at least one GDD
+     requirement, or explicitly state it is a foundational decision with no GDD
+     dependency. Traceability is audited by /architecture-review. -->
+
+| GDD Document | System | Requirement | How This ADR Satisfies It |
+|-------------|--------|-------------|--------------------------|
+| [e.g. `design/gdd/combat.md`] | [e.g. Combat] | [e.g. "Hitbox detection must resolve within 1 frame"] | [e.g. "Jolt physics collision queries run synchronously in _physics_process"] |
+
+> If this is a foundational decision with no direct GDD dependency, write:
+> "Foundational — no GDD requirement. Enables: [list what GDD systems this
+> decision unlocks or constrains]"
+
 ## Related
 
-- [Link to related ADRs]
-- [Link to related design documents]
-- [Link to relevant code files]
+- [Link to related ADRs — note if supersedes, contradicts, or depends on]
+- [Link to relevant code files once implemented]
```

**File**: `.claude/docs/templates/architecture-traceability.md` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+# Architecture Traceability Index
+
+<!-- Living document — updated by /architecture-review after each review run.
+     Do not edit manually unless correcting an error. -->
+
+## Document Status
+
+- **Last Updated**: [YYYY-MM-DD]
+- **Engine**: [e.g. Godot 4.6]
+- **GDDs Indexed**: [N]
+- **ADRs Indexed**: [M]
+- **Last Review**: [link to docs/architecture/architecture-review-[date].md]
+
+## Coverage Summary
+
+| Status | Count | Percentage |
+|--------|-------|-----------|
+| ✅ Covered | [X] | [%] |
+| ⚠️ Partial | [Y] | [%] |
+| ❌ Gap | [Z] | [%] |
+| **Total** | **[N]** | |
+
+---
+
+## Traceability Matrix
+
+<!-- One row per technical requirement extracted from a GDD.
+     A "technical requirement" is any GDD statement that implies a specific
+     architectural decision: data structures, performance constraints, engine
+     capabilities needed, cross-system communication, state persistence. -->
+
+| Req ID | GDD | System | Requirement Summary | ADR(s) | Status | Notes |
+|--------|-----|--------|---------------------|--------|--------|-------|
+| TR-[gdd]-001 | [filename] | [system name] | [one-line summary] | [ADR-NNNN] | ✅ | |
+| TR-[gdd]-002 | [filename] | [system name] | [one-line summary] | — | ❌ GAP | Needs `/architecture-decision [title]` |
+
+---
+
+## Known Gaps
+
+Requirements with no ADR coverage, prioritised by layer (Foundation first):
+
+### Foundation Layer Gaps (BLOCKING — must resolve before coding)
+- [ ] TR-[id]: [requirement] — GDD: [file] — Suggested ADR: "[title]"
+
+### Core Layer Gaps (must resolve before relevant system is built)
+- [ ] TR-[id]: [requirement] — GDD: [file] — Suggested ADR: "[title]"
+
+### Feature Layer Gaps (should resolve before feature sprint)
+- [ ] TR-[id]: [requirement] — GDD: [file] — Suggested ADR: "[title]"
+
+### Presentation Layer Gaps (can defer to implementation)
+- [ ] TR-[id]: [requirement] — GDD: [file] — Suggested ADR: "[title]"
+
+---
+
+## Cross-ADR Conflicts
+
+<!-- Pairs of ADRs that make contradictory claims. Must be resolved. -->
+
+| Conflict ID | ADR A | ADR B | Type | Status |
+|-------------|-------|-------|------|--------|
+| CONFLICT-001 | ADR-NNNN | ADR-MMMM | Data ownership | 🔴 Unresolved |
+
+---
+
+## ADR → GDD Coverage (Reverse Index)
+
+<!-- For each ADR, which GDD requirements does it address? -->
+
+| ADR | Title | GDD Requirements Addressed | Engine Risk |
+|-----|-------|---------------------------|-------------|
+| ADR-0001 | [title] | TR-combat-001, TR-combat-002 | HIGH |
+
+---
+
+## Superseded Requirements
+
+<!-- Requirements that existed in a GDD when an ADR was written, but the GDD
+     has since changed. The ADR may need updating. -->
+
+| Req ID | GDD | Change | Affected ADR | Status |
+|--------|-----|--------|-------------|--------|
+| TR-[id] | [file] | [what changed] | ADR-NNNN | 🔴 ADR needs update |
+
+---
+
+## How to Use This Document
+
+**When writing a new ADR**: Add it to the "ADR → GDD Coverage" table and mark
+the requirements it satisfies as ✅ in the matrix.
+
+**When approving a GDD change**: Scan the matrix for requirements from that GDD
+and check whether the change invalidates any existing ADR. Add to "Superseded
+Requirements" if so.
+
+**When running `/architecture-review`**: The skill will update this document
+automatically with the current state.
+
+**Gate check**: The Pre-Production gate requires this document to exist and to
+have zero Foundation Layer Gaps.
```

**File**: `.claude/docs/templates/collaborative-protocols/implementation-agent-protocol.md` (modified, +11/-5)
```diff
@@ -40,10 +40,11 @@ Before writing any code:
    - For multi-file changes, list all affected files
    - Wait for "yes" before using Write/Edit tools
 
-6. **Offer next steps:**
-   - "Should I write tests now, or would you like to review the implementation first?"
-   - "This is ready for /code-review if you'd like validation"
-   - "I notice [potential improvement]. Should I refactor, or is this good for now?"
+6. **Complete the story with `/story-done`:**
+   - When implementation (and tests, if written) is complete, invoke `/story-done [story-file-path]`
+   - This verifies acceptance criteria, checks for GDD/ADR deviations, prompts code review, and updates the story status
+   - Do NOT mark a story complete manually — always go through `/story-done`
+   - If no story file exists for this work (ad-hoc task), offer `/code-review` directly instead
 
 #### Example Interaction Pattern
 
@@ -109,7 +110,11 @@ User: "A, write tests"
 
 You: [creates tests/combat/test_damage_calculator.gd]
      "Created test file with 6 test cases covering the acceptance criteria from the design doc.
-      All tests passing. Ready to commit?"
+      All tests passing.
+
+      Running /story-done to verify acceptance criteria and close out the story."
+
+[/story-done runs — verifies criteria, checks deviations, prompts code review, updates story status]
 ```
 
 #### Collaborative Mindset
@@ -120,6 +125,7 @@ You: [creates tests/combat/test_damage_calculator.gd]
 - Flag deviations from design docs explicitly — designer should know if implementation differs
 - Rules are your friend — when they flag issues, they're usually right
 - Tests prove it works — offer to write them proactively
+- Story completion is explicit — use `/story-done` to close every story, never assume done because code is written
 
 #### Structured Decision UI
 
```

**File**: `.claude/docs/templates/difficulty-curve.md` (added, +330/-0)
```diff
@@ -0,0 +1,330 @@
+# Difficulty Curve: [Game Title]
+
+> **Status**: Draft | In Review | Approved
+> **Author**: [game-designer / systems-designer]
+> **Last Updated**: [Date]
+> **Links To**: `design/gdd/game-concept.md`
+> **Relevant GDDs**: [e.g., `design/gdd/combat.md`, `design/gdd/progression.md`]
+
+---
+
+## Difficulty Philosophy
+
+[One paragraph establishing this game's relationship with difficulty. This is
+not a mechanical description — it is a design value statement that all tuning
+decisions must serve.
+
+The four common difficulty philosophies are:
+
+1. **Masochistic challenge as the core fantasy**: Difficulty is the product.
+   Overcoming it is the emotional reward. Reducing difficulty removes the
+   point. (Dark Souls, Celeste at max assist off)
+2. **Accessible entry, optional depth**: The base experience is completable by
+   most players; depth and challenge are opt-in for those who want them.
+   (Hades, Hollow Knight with accessibility modes)
+3. **Difficulty serves narrative pacing**: Challenge rises and falls to match
+   story beats. The player must feel capable during story resolution and
+   threatened during story crisis. (The Last of Us, God of War)
+4. **Relaxed engagement**: Challenge is present but never the focus. Failure
+   is gentle and infrequent. The experience prioritizes comfort and expression
+   over obstacle. (Stardew Valley, Animal Crossing)
+
+State the philosophy explicitly, then add one sentence on what the player is
+permitted to feel: are they allowed to feel frustrated? For how long before the
+design must intervene? What is the acceptable cost of failure?]
+
+---
+
+## Difficulty Axes
+
+> **Guidance**: Most games have multiple independent dimensions of challenge.
+> Identifying them explicitly prevents the mistake of tuning only one axis
+> (usually execution difficulty) while leaving others unexamined. A game can
+> feel "easy" on execution but overwhelming on decision complexity — players
+> experience this as confusing, not engaging.
+>
+> For each axis, answer: can the player control or reduce this axis through
+> choices, builds, or settings? If not, it is a forced challenge dimension —
+> be very intentional about how it is used.
+
+| Axis | Description | Primary Systems | Player Control? |
+|------|-------------|----------------|-----------------|
+| **Execution difficulty** | [The precision and timing demands of core actions. e.g., "Dodging enemy attacks requires correct timing within a 200ms window."] | [e.g., Combat, movement] | [Yes — practice reduces this / No — fixed mechanical threshold] |
+| **Knowledge difficulty** | [The cost of not knowing information. e.g., "Enemy weaknesses are not telegraphed; players who have not discovered them take significantly more damage."] | [e.g., Enemy design, UI, lore] | [Yes — through in-game discovery / No — requires external knowledge] |
+| **Resource pressure** | [How scarce are the resources needed to progress? e.g., "Health consumables are limited; efficient play is required to sustain long dungeon runs."] | [e.g., Economy, loot, crafting] | [Yes — through build optimization / Partially] |
+| **Time pressure** | [Does the player have time to think, or does the game demand rapid decisions? e.g., "Enemy spawn timers and attack windows require real-time response."] | [e.g., Combat pacing, timers] | [Yes — through difficulty settings / No — core to genre] |
+| **Decision complexity** | [How many meaningful choices must the player evaluate simultaneously? e.g., "Build decisions interact across 4 systems; suboptimal combinations create compounding disadvantage."] | [e.g., Progression, inventory, skills] | [Yes — through UI and tutorialization / No — inherent to strategy depth] |
+| **[Add axis]** | [Description] | [Systems] | [Player control] |
+
+---
+
+## Difficulty Curve Overview
+
+> **Guidance**: This table describes the intended challenge arc across the whole
+> game. Difficulty levels use a 1-10 scale where 1 = no meaningful challenge,
+> 10 = maximum challenge the game can produce. The scale is relative to THIS game's
+> design intent — a 6/10 in a soulslike is not the same as a 6/10 in a cozy sim.
+>
+> "Primary challenge type" refers to the difficulty axis (from the table above)
+> that is doing the most work in this phase. New systems introduced should list
+> only systems introduced for the FIRST TIME — the cognitive load of learning
+> a new system is itself a form of difficulty.
+>
+> "Target player state" is the emotional state the designer intends. If the actual
+> playtested state diverges from the intended state, this column is what needs
+> to be achieved.
+
+| Phase | Duration | Difficulty Level (1-10) | Primary Challenge Type | New Systems Introduced | Target Player State |
+|-------|----------|------------------------|----------------------|----------------------|---------------------|
+| [Prologue / Tutorial] | [e.g., 0-15 min] | [2/10] | [Knowledge] | [Core movement, basic interacti
```

**File**: `.claude/docs/templates/game-design-document.md` (modified, +76/-0)
```diff
@@ -91,6 +91,82 @@ value, the safe range, and what happens at the extremes.]
 | Event | Visual Feedback | Audio Feedback | Priority |
 |-------|----------------|---------------|----------|
 
+## Game Feel
+
+> **Why this section exists separately from Visual/Audio Requirements**: Visual/Audio
+> Requirements document WHAT feedback events occur (tables of events mapped to assets).
+> Game Feel documents HOW the mechanic feels to operate — the responsiveness, weight,
+> snap, and kinesthetic quality of the interaction. These are design targets for timing,
+> frame data, and physical sensation of control. Game feel must be specified at design
+> time because it drives animation budgets, input handling architecture, and hitbox
+> timing. Retrofitting feel targets after implementation is expensive and often requires
+> fundamental rework.
+
+### Feel Reference
+
+[Name a specific game, mechanic, or moment that captures the target feel. Be precise —
+cite the exact mechanic, not just the game. Explain what quality you are borrowing.
+Optionally include an anti-reference (what this should NOT feel like).]
+
+> Example: "Should feel like Dark Souls weapon swings — weighty, committed, and
+> telegraphed, but satisfying on contact. NOT floaty like early Halo melee."
+
+### Input Responsiveness
+
+[Maximum acceptable latency from player input to visible/audible response, per action.]
+
+| Action | Max Input-to-Response Latency (ms) | Frame Budget (at 60fps) | Notes |
+|--------|-----------------------------------|------------------------|-------|
+| [Primary action] | [e.g., 50ms] | [e.g., 3 frames] | |
+| [Secondary action] | | | |
+
+### Animation Feel Targets
+
+[Frame data targets for each animation in this mechanic. Startup = windup before the
+action has any effect. Active = frames when the action is "happening" (hitbox live,
+ability firing, etc.). Recovery = committed/vulnerable frames after the action resolves.]
+
+| Animation | Startup Frames | Active Frames | Recovery Frames | Feel Goal | Notes |
+|-----------|---------------|--------------|----------------|-----------|-------|
+| [e.g., Light attack] | | | | [e.g., Snappy, low commitment] | |
+| [e.g., Heavy attack] | | | | [e.g., Weighty, high commitment] | |
+
+### Impact Moments
+
+[Defines the punctuation of the mechanic — the moments of peak feedback intensity that
+make actions feel consequential. Every high-stakes event should have at least one entry.]
+
+| Impact Type | Duration (ms) | Effect Description | Configurable? |
+|-------------|--------------|-------------------|---------------|
+| Hit-stop (freeze frames) | [e.g., 80ms] | [Freeze both objects on contact] | Yes |
+| Screen shake | [e.g., 150ms] | [Directional, decaying] | Yes |
+| Camera impact | | | |
+| Controller rumble | | | |
+| Time-scale slowdown | | | |
+
+### Weight and Responsiveness Profile
+
+[A short prose description of the overall feel target. Answer the following:]
+
+- **Weight**: Does this feel heavy and deliberate, or light and reactive?
+- **Player control**: How much does the player feel in control at every moment?
+  (High control = can course-correct mid-action; Low control = committed, momentum-based)
+- **Snap quality**: Does this feel crisp and binary, or smooth and analog?
+- **Acceleration model**: Does movement/action start instantly (arcade feel) or
+  ramp up from zero (simulation feel)? Same question for deceleration.
+- **Failure texture**: When the player makes an error, does the mechanic feel fair
+  or punishing? What is the read on WHY they failed?
+
+### Feel Acceptance Criteria
+
+[Specific, testable criteria a playtester can verify without measurement instruments.
+These are subjective targets stated precisely enough to get consistent verdicts.]
+
+- [ ] [e.g., "Combat feels impactful — playtesters comment on weight unprompted"]
+- [ ] [e.g., "No reviewer uses the words 'floaty', 'slippery', or 'unresponsive'"]
+- [ ] [e.g., "Input latency is imperceptible at target 60fps framerate"]
+- [ ] [e.g., "Hit-stop reads as satisfying, not as lag or stutter"]
+
 ## UI Requirements
 
 [What information needs to be displayed to the player and when?]
```

**File**: `.claude/docs/templates/hud-design.md` (added, +505/-0)
```diff
@@ -0,0 +1,505 @@
+# HUD Design: [Game Name]
+
+> **Status**: Draft | In Review | Approved | Implemented
+> **Author**: [Name or agent — e.g., ui-designer]
+> **Last Updated**: [Date]
+> **Game**: [Game name — this is a single document per game, not per element]
+> **Platform Targets**: [All platforms this HUD must work on — e.g., PC, PS5, Xbox Series X, Steam Deck]
+> **Related GDDs**: [Every system that exposes information through the HUD — e.g., `design/gdd/combat.md`, `design/gdd/progression.md`, `design/gdd/quests.md`]
+> **Accessibility Tier**: Basic | Standard | Comprehensive | Exemplary
+> **Style Reference**: [Link to art bible HUD section if it exists — e.g., `design/gdd/art-bible.md § HUD Visual Language`]
+
+> **Note — Scope boundary**: This document specifies all elements that overlay the
+> game world during active gameplay — health bars, ammo counters, minimaps, quest
+> trackers, subtitles, damage numbers, and notification toasts. For menu screens,
+> pause menus, inventory, and dialogs that the player navigates explicitly, use
+> `ux-spec.md` instead. The test: if it appears while the player is directly
+> controlling their character, it belongs here.
+
+---
+
+## 1. HUD Philosophy
+
+> **Why this section exists**: The HUD design philosophy is not decoration — it is a
+> design constraint that every subsequent decision is measured against. Without a
+> philosophy, individual elements get added on request ("the quest tracker wants a
+> bigger icon") without any principled way to push back. With a philosophy, there is
+> a shared, explicit standard. More importantly, the philosophy prevents the HUD from
+> slowly growing to cover the game world while each individual addition seemed
+> reasonable in isolation. Write this before specifying any elements.
+
+**What is this game's relationship with on-screen information?**
+
+[One paragraph. This is a design statement, not a description of features. Consider
+the game's genre, pacing, and player fantasy. A stealth game's HUD philosophy might
+be: "The world is the interface. If the player has to look away from the environment
+to survive, the HUD has failed." A tactics game might say: "Complete situational
+awareness is the game. The HUD is not an overlay — it is the battlefield."
+
+Reference comparable games if helpful, but describe your specific stance:
+Example — diegetic-first action RPG: "We treat screen information as a concession,
+not a feature. Every HUD element must earn its pixel space by answering the question:
+would the player make demonstrably worse decisions without this information visible?
+If the answer is 'they'd adapt,' we put it in the environment instead."]
+
+**Visibility principle** — when in doubt, show or hide?
+
+[State the default resolution for ambiguous cases. Options:
+- Default to HIDE: information is available on demand (e.g., Dark Souls — no quest tracker, no minimap, stats are in a menu)
+- Default to SHOW: players prefer to be informed; cluttered is better than uncertain
+- Default to CONTEXTUAL: information appears when it becomes relevant and fades when it does not
+Most games benefit from contextual defaults. State your game's default clearly so every element decision is consistent.]
+
+**The Rule of Necessity for this game**:
+
+[Complete this sentence: "A HUD element earns its place when ______________."
+
+Example: "...the player would have to stop playing to find the same information
+elsewhere, or would make meaningfully worse decisions without it."
+
+Example: "...removing it in playtesting causes measurable frustration or confusion
+in more than 25% of testers within the first hour of play."
+
+This rule is the veto power over feature requests to add HUD elements. Document it
+so it can be cited in design reviews.]
+
+---
+
+## 2. Information Architecture
+
+> **Why this section exists**: Before specifying any HUD element's visual design,
+> position, or behavior, you must answer a more fundamental question: should this
+> information be on the HUD at all? This section is a forcing function — it requires
+> you to categorize EVERY piece of information the game world generates and make an
+> explicit, intentional decision about how each is presented. "We'll figure that out
+> later" is how games end up with 18 elements competing for the player's peripheral
+> vision. This table is the master inventory of game information, not just HUD information.
+
+| Information Type | Always Show | Contextual (show when relevant) | On Demand (menu/button) | Hidden (environmental / diegetic) | Reasoning |
+|-----------------|-------------|--------------------------------|------------------------|----------------------------------|-----------|
+| [Health / Vitality] | [X if action game — player needs constant awareness] | [X if exploration game — show only when injured] | [ ] | [ ] | [Example: always visible because health decisions (retreat, heal) must be instant in combat] |
+| [Primary resource (mana / stamina / a
```

**File**: `.claude/docs/templates/interaction-pattern-library.md` (added, +1072/-0)
```diff
@@ -0,0 +1,1072 @@
+# Interaction Pattern Library: [Game Title]
+
+> **Status**: Draft | Stable | Under Revision
+> **Author**: [ux-designer]
+> **Last Updated**: [Date]
+> **Version**: [1.0]
+> **Engine**: [Godot 4.6 / Unity 6 / Unreal Engine 5]
+> **UI Framework**: [Godot Control nodes / Unity UI Toolkit / Unreal UMG]
+> **Related Documents**:
+> - `docs/art-bible.md` — visual standards (colors, typography, iconography)
+> - `docs/accessibility-requirements.md` — accessibility commitments per feature
+> - `docs/ux/ux-spec-[screen].md` — individual screen specs that reference patterns
+
+> **Why this document exists**: Every UI screen spec should be able to say
+> "uses Button (Primary) pattern" rather than re-specifying hover states,
+> press animations, focus behavior, keyboard handling, and screen reader
+> announcements from scratch. This library is the single source of truth for
+> reusable interaction behaviors. When a screen spec references a pattern name,
+> the programmer looks it up here. When the behavior changes, it changes here
+> and applies everywhere.
+>
+> This is a living document. Patterns are added as new screens are designed —
+> do not design a new interaction without checking here first. If a new pattern
+> is needed, add it here (or propose it to the ux-designer) before writing the
+> first screen spec that uses it.
+>
+> **Status definitions**:
+> - **Draft**: Interaction specified but not yet implemented or validated
+> - **Stable**: Implemented, tested, and validated in at least one shipped screen
+> - **Deprecated**: Being phased out — existing uses will be migrated, do not use in new screens
+
+---
+
+## How to Use This Library
+
+**If you are designing a screen**: Browse the Pattern Catalog Index below before
+inventing new interactions. When a standard pattern fits, reference it by name
+in the screen spec (e.g., "The confirm button uses Button (Primary) pattern").
+When no existing pattern fits, propose a new one — document it here alongside
+or before the screen spec that introduces it.
+
+**If you are implementing a screen**: When a screen spec says "use [PatternName]
+pattern," find it in this document for the complete specification. The
+implementation notes section contains engine-specific guidance. The accessibility
+section contains the requirements that are non-negotiable.
+
+**If you are reviewing a screen spec**: Verify that all interactive elements
+reference a pattern from this library or include their own full interaction
+specification. "Standard button" or "the usual way" is not a valid reference.
+
+**If you are updating a pattern**: Changing a Stable pattern affects every screen
+that uses it. Before changing, audit all usages (search screen specs for the
+pattern name), determine the impact, get approval from the ux-designer, and
+update this document before or simultaneously with any implementation change.
+
+---
+
+## Pattern Catalog Index
+
+> Add a row here every time a new pattern is added to this document.
+> The "Used In" column is the usages audit trail — update it when new screens
+> adopt the pattern.
+
+| Pattern Name | Category | Description | Used In (Screens) | Status |
+|-------------|----------|-------------|------------------|--------|
+| Button (Primary) | Input | Main call-to-action. High visual weight. One per screen. | [Main Menu, Pause Menu, Settings] | Draft |
+| Button (Secondary) | Input | Alternative action or cancel. Lower visual weight than Primary. | [All modal dialogs, settings screens] | Draft |
+| Button (Destructive) | Input | Irreversible action. Requires confirmation before execution. | [Delete Save, Reset Settings] | Draft |
+| Toggle | Input | Binary on/off state selection. | [Accessibility settings, audio settings] | Draft |
+| Slider | Input | Continuous value selection. | [Volume controls, brightness, text size] | Draft |
+| Dropdown / Select | Input | Selection from a discrete list of options. | [Resolution, language, key binding] | Draft |
+| List Item | Layout / Input | Selectable row in a vertical scrollable list. | [Achievements, quest log, settings list] | Draft |
+| Grid Item | Layout / Input | Selectable cell in a two-dimensional grid. | [Inventory, ability select, item shop] | Draft |
+| Modal Dialog | Feedback / Layout | Blocking overlay requiring explicit player decision. | [Confirmation dialogs, error prompts] | Draft |
+| Confirmation Dialog | Feedback / Layout | Specific modal for destructive action confirmation. | [Delete Save, Leave Match, Reset] | Draft |
+| Toast / Notification | Feedback | Non-blocking temporary message in a screen corner. | [Achievement unlock, autosave notification] | Draft |
+| Tooltip | Feedback | Contextual information on hover or focus. | [Inventory items, ability descriptions, settings] | Draft |
+| Progress Bar | Feedback / Layout | Linear progress indicator. | [Loading screen, XP bar, quest progress] | Draft |
+| Input Field | Input | Text entry control. | [Player name, sea
```

---

### Incident Patch 15: `392e3bef` (2026-03-09)
**Commit Message**: Adopt new Claude Code features: agent memory, context fork, worktree isolation, SubagentStop hook

- Add `memory: project` to 14 specialist agents for cross-session learning
- Add `context: fork` + `agent:` to 6 analysis skills to preserve main context
- Add `isolation: worktree` to prototyper agent for safe throwaway experiments
- Add SubagentStop hook to complete agent audit trail (start + stop logging)

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `.claude/agents/art-director.md` (modified, +4/-3)
```diff
@@ -5,6 +5,7 @@ tools: Read, Glob, Grep, Write, Edit, WebSearch
 model: sonnet
 maxTurns: 20
 disallowedTools: Bash
+memory: project
 ---
 
 You are the Art Director for an indie game project. You define and maintain the
@@ -59,11 +60,11 @@ Before proposing any design:
 #### Structured Decision UI
 
 Use the `AskUserQuestion` tool to present decisions as a selectable UI instead of
-plain text. Follow the **Explain → Capture** pattern:
+plain text. Follow the **Explain -> Capture** pattern:
 
-1. **Explain first** — Write full analysis in conversation: pros/cons, theory,
+1. **Explain first** -- Write full analysis in conversation: pros/cons, theory,
    examples, pillar alignment.
-2. **Capture the decision** — Call `AskUserQuestion` with concise labels and
+2. **Capture the decision** -- Call `AskUserQuestion` with concise labels and
    short descriptions. User picks or types a custom answer.
 
 **Guidelines:**
```

**File**: `.claude/agents/audio-director.md` (modified, +4/-3)
```diff
@@ -5,6 +5,7 @@ tools: Read, Glob, Grep, Write, Edit, WebSearch
 model: sonnet
 maxTurns: 20
 disallowedTools: Bash
+memory: project
 ---
 
 You are the Audio Director for an indie game project. You define the sonic
@@ -59,11 +60,11 @@ Before proposing any design:
 #### Structured Decision UI
 
 Use the `AskUserQuestion` tool to present decisions as a selectable UI instead of
-plain text. Follow the **Explain → Capture** pattern:
+plain text. Follow the **Explain -> Capture** pattern:
 
-1. **Explain first** — Write full analysis in conversation: pros/cons, theory,
+1. **Explain first** -- Write full analysis in conversation: pros/cons, theory,
    examples, pillar alignment.
-2. **Capture the decision** — Call `AskUserQuestion` with concise labels and
+2. **Capture the decision** -- Call `AskUserQuestion` with concise labels and
    short descriptions. User picks or types a custom answer.
 
 **Guidelines:**
```

**File**: `.claude/agents/economy-designer.md` (modified, +4/-3)
```diff
@@ -5,6 +5,7 @@ tools: Read, Glob, Grep, Write, Edit
 model: sonnet
 maxTurns: 20
 disallowedTools: Bash
+memory: project
 ---
 
 You are an Economy Designer for an indie game project. You design and balance
@@ -59,11 +60,11 @@ Before proposing any design:
 #### Structured Decision UI
 
 Use the `AskUserQuestion` tool to present decisions as a selectable UI instead of
-plain text. Follow the **Explain → Capture** pattern:
+plain text. Follow the **Explain -> Capture** pattern:
 
-1. **Explain first** — Write full analysis in conversation: pros/cons, theory,
+1. **Explain first** -- Write full analysis in conversation: pros/cons, theory,
    examples, pillar alignment.
-2. **Capture the decision** — Call `AskUserQuestion` with concise labels and
+2. **Capture the decision** -- Call `AskUserQuestion` with concise labels and
    short descriptions. User picks or types a custom answer.
 
 **Guidelines:**
```

**File**: `.claude/agents/game-designer.md` (modified, +10/-9)
```diff
@@ -6,6 +6,7 @@ model: sonnet
 maxTurns: 20
 disallowedTools: Bash
 skills: [design-review, balance-check, brainstorm]
+memory: project
 ---
 
 You are the Game Designer for an indie game project. You design the rules,
@@ -61,11 +62,11 @@ Before proposing any design:
 #### Structured Decision UI
 
 Use the `AskUserQuestion` tool to present decisions as a selectable UI instead of
-plain text. Follow the **Explain → Capture** pattern:
+plain text. Follow the **Explain -> Capture** pattern:
 
-1. **Explain first** — Write full analysis in conversation: pros/cons, theory,
+1. **Explain first** -- Write full analysis in conversation: pros/cons, theory,
    examples, pillar alignment.
-2. **Capture the decision** — Call `AskUserQuestion` with concise labels and
+2. **Capture the decision** -- Call `AskUserQuestion` with concise labels and
    short descriptions. User picks or types a custom answer.
 
 **Guidelines:**
@@ -85,9 +86,9 @@ plain text. Follow the **Explain → Capture** pattern:
    macro-loop (progression + natural stopping point + reason to return).
 2. **Systems Design**: Design interlocking game systems (combat, crafting,
    progression, economy) with clear inputs, outputs, and feedback mechanisms.
-   Use **systems dynamics thinking** — map reinforcing loops (growth engines)
+   Use **systems dynamics thinking** -- map reinforcing loops (growth engines)
    and balancing loops (stability mechanisms) explicitly.
-3. **Balancing Framework**: Establish balancing methodologies — mathematical
+3. **Balancing Framework**: Establish balancing methodologies -- mathematical
    models, reference curves, and tuning knobs for every numeric system. Use
    formal balance techniques: **transitive balance** (A > B > C in cost and
    power), **intransitive balance** (rock-paper-scissors), **frustra balance**
@@ -124,17 +125,17 @@ Every system should satisfy at least one core psychological need:
 - **Autonomy**: meaningful choices where multiple paths are viable. Avoid
   false choices (one option clearly dominates) and choiceless sequences.
 - **Competence**: clear skill growth with readable feedback. The player must
-  know WHY they succeeded or failed. Apply **Csikszentmihalyi's Flow model** —
+  know WHY they succeeded or failed. Apply **Csikszentmihalyi's Flow model** --
   challenge must scale with skill to maintain the flow channel.
 - **Relatedness**: connection to characters, other players, or the game world.
   Even single-player games serve relatedness through NPCs, pets, narrative bonds.
 
 #### Flow State Design (Csikszentmihalyi 1990)
 Maintain the player in the **flow channel** between anxiety and boredom:
 - **Onboarding**: first 10 minutes teach through play, not tutorials. Use
-  **scaffolded challenge** — each new mechanic is introduced in isolation before
+  **scaffolded challenge** -- each new mechanic is introduced in isolation before
   being combined with others.
-- **Difficulty curve**: follows a **sawtooth pattern** — tension builds through
+- **Difficulty curve**: follows a **sawtooth pattern** -- tension builds through
   a sequence, releases at a milestone, then re-engages at a slightly higher
   baseline. Avoid flat difficulty (boredom) and vertical spikes (frustration).
 - **Feedback clarity**: every player action must have readable consequences
@@ -204,7 +205,7 @@ Every mechanic document in `design/gdd/` must contain these 8 required sections:
    programmer should be able to implement from this section alone.
 4. **Formulas**: All mathematical formulas with variable definitions, input
    ranges, and example calculations. Include graphs for non-linear curves.
-5. **Edge Cases**: What happens in unusual or extreme situations — minimum
+5. **Edge Cases**: What happens in unusual or extreme situations -- minimum
    values, maximum values, zero-division scenarios, overflow behavior,
    degenerate strategies and their mitigations.
 6. **Dependencies**: What other systems this interacts with, data flow
```

**File**: `.claude/agents/lead-programmer.md` (modified, +7/-6)
```diff
@@ -5,6 +5,7 @@ tools: Read, Glob, Grep, Write, Edit, Bash
 model: sonnet
 maxTurns: 20
 skills: [code-review, architecture-decision, tech-debt]
+memory: project
 ---
 
 You are the Lead Programmer for an indie game project. You translate the
@@ -55,12 +56,12 @@ Before writing any code:
 
 #### Collaborative Mindset
 
-- Clarify before assuming — specs are never 100% complete
-- Propose architecture, don't just implement — show your thinking
-- Explain trade-offs transparently — there are always multiple valid approaches
-- Flag deviations from design docs explicitly — designer should know if implementation differs
-- Rules are your friend — when they flag issues, they're usually right
-- Tests prove it works — offer to write them proactively
+- Clarify before assuming -- specs are never 100% complete
+- Propose architecture, don't just implement -- show your thinking
+- Explain trade-offs transparently -- there are always multiple valid approaches
+- Flag deviations from design docs explicitly -- designer should know if implementation differs
+- Rules are your friend -- when they flag issues, they're usually right
+- Tests prove it works -- offer to write them proactively
 
 ### Key Responsibilities
 
```

**File**: `.claude/agents/level-designer.md` (modified, +4/-3)
```diff
@@ -5,6 +5,7 @@ tools: Read, Glob, Grep, Write, Edit
 model: sonnet
 maxTurns: 20
 disallowedTools: Bash
+memory: project
 ---
 
 You are a Level Designer for an indie game project. You design spaces that
@@ -59,11 +60,11 @@ Before proposing any design:
 #### Structured Decision UI
 
 Use the `AskUserQuestion` tool to present decisions as a selectable UI instead of
-plain text. Follow the **Explain → Capture** pattern:
+plain text. Follow the **Explain -> Capture** pattern:
 
-1. **Explain first** — Write full analysis in conversation: pros/cons, theory,
+1. **Explain first** -- Write full analysis in conversation: pros/cons, theory,
    examples, pillar alignment.
-2. **Capture the decision** — Call `AskUserQuestion` with concise labels and
+2. **Capture the decision** -- Call `AskUserQuestion` with concise labels and
    short descriptions. User picks or types a custom answer.
 
 **Guidelines:**
```

**File**: `.claude/agents/localization-lead.md` (modified, +7/-6)
```diff
@@ -4,6 +4,7 @@ description: "Owns internationalization architecture, string management, locale
 tools: Read, Glob, Grep, Write, Edit, Bash
 model: sonnet
 maxTurns: 20
+memory: project
 ---
 
 You are the Localization Lead for an indie game project. You own the
@@ -54,12 +55,12 @@ Before writing any code:
 
 #### Collaborative Mindset
 
-- Clarify before assuming — specs are never 100% complete
-- Propose architecture, don't just implement — show your thinking
-- Explain trade-offs transparently — there are always multiple valid approaches
-- Flag deviations from design docs explicitly — designer should know if implementation differs
-- Rules are your friend — when they flag issues, they're usually right
-- Tests prove it works — offer to write them proactively
+- Clarify before assuming -- specs are never 100% complete
+- Propose architecture, don't just implement -- show your thinking
+- Explain trade-offs transparently -- there are always multiple valid approaches
+- Flag deviations from design docs explicitly -- designer should know if implementation differs
+- Rules are your friend -- when they flag issues, they're usually right
+- Tests prove it works -- offer to write them proactively
 
 ### Key Responsibilities
 
```

**File**: `.claude/agents/narrative-director.md` (modified, +4/-3)
```diff
@@ -5,6 +5,7 @@ tools: Read, Glob, Grep, Write, Edit, WebSearch
 model: sonnet
 maxTurns: 20
 disallowedTools: Bash
+memory: project
 ---
 
 You are the Narrative Director for an indie game project. You architect the
@@ -59,11 +60,11 @@ Before proposing any design:
 #### Structured Decision UI
 
 Use the `AskUserQuestion` tool to present decisions as a selectable UI instead of
-plain text. Follow the **Explain → Capture** pattern:
+plain text. Follow the **Explain -> Capture** pattern:
 
-1. **Explain first** — Write full analysis in conversation: pros/cons, theory,
+1. **Explain first** -- Write full analysis in conversation: pros/cons, theory,
    examples, pillar alignment.
-2. **Capture the decision** — Call `AskUserQuestion` with concise labels and
+2. **Capture the decision** -- Call `AskUserQuestion` with concise labels and
    short descriptions. User picks or types a custom answer.
 
 **Guidelines:**
```

#### Recent Merged Pull Requests:
- **PR #132** (closed): Trae/agent tbq prl (@realUC)
- **PR #129** (2026-09-24): fix: skills and agents fail to start outside auto mode (#128) (@Donchitos)
- **PR #125** (closed): Docs/rules count fix (@realUC)
- **PR #120** (closed): Trae/agent vr kb nk (@imgamer)
- **PR #119** (closed): docs: 전체 사용 워크플로에 페이즈별 스킬 상세 설명 추가 (@v0o0v)
- **PR #117** (closed): Full web engine implementation: PixiJS and ThreeJS agents and skills (@robertobalestri)
- **PR #116** (closed): Add game concept documentation and prototype updates (@felixfu007)
- **PR #106** (closed): Feature/docs onboarding hierarchy (@Rohega)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
