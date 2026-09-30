# Forensic Learning Record (Deep Inspection): Donchitos/Claude-Code-Game-Studios

> **Canonical Artifact**: `07_PROJECT_LEARNING/donchitos-claude-code-game-studios-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Donchitos/Claude-Code-Game-Studios](https://github.com/Donchitos/Claude-Code-Game-Studios))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:29:25.298Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Donchitos/Claude-Code-Game-Studios`
- **Description**: Turn Claude Code into a full game dev studio — 49 AI agents, 72 workflow skills, and a complete coordination system mirroring real studio hierarchy.
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 25570 stars

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

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

* Fix three stale Step 0 cross-references missed in #45

Lines 51, 61, and 69 still pointed to "Step 0" after Load Engine Context
was renumbered to ## 1. in the previous fix — updated all three to Step 1.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---------

Co-authored-by: Claude Sonnet 4.6 <noreply@anthropic.com>

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
    - If no engine is configured (`[TO B
```

---

### Incident Patch 2: `a1697d67` (2026-05-02)
**Commit Message**: Fix: session-start preview shows most recent state instead of oldest (#43)

Replace head with tail so the quick summary surfaces the last 20 lines
of active.md — where all skills append their session extracts — rather
than the first 20 lines which grow stale as the file accumulates history.

Fixes #39

Co-authored-by: Claude Sonnet 4.6 <noreply@anthropic.com>

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

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

* Fix: propagate rg --glob *.gd tooling warning to all Godot agents

Closes the coverage gap identified in PR #42 review — the ripgrep
gdscript-type warning was only in godot-gdscript-specialist. Added
the same CRITICAL tooling section to godot-specialist,
godot-gdextension-specialist, godot-shader-specialist, and
godot-csharp-specialist so no Godot agent can silently misfire a search.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

---------

Co-authored-by: Claude Sonnet 4.6 <n

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

---

### Incident Patch 4: `9ccc5440` (2026-04-24)
**Commit Message**: Fix missing allowed-tools in /architecture-decision and /story-done (#36)

- Add Edit to architecture-decision allowed-tools (retrofit mode and
  registry append both call Edit on existing files — was throwing a
  permission error on every /architecture-decision retrofit run)
- Add Write to story-done allowed-tools (Phase 7 creates active.md on
  first run — was silently failing and losing completion notes)

Fixes #33. Bug found and fix branches prepared by @xiaolai via NLPM audit.

Co-authored-by: Claude Sonnet 4.6 <noreply@anthropic.com>

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

Co-authored-by: Claude Sonnet 4.6 <noreply@anthropic.com>

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

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

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
 | **
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

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

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
+> system match the mood targets? Do
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
         ar
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
 
-After writing the plan, don't stop there. Pick the single highest-priorit
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
+Do not generate the ADR until the user confirms as
```

---

### Incident Patch 8: `167fb6c5` (2026-03-28)
**Commit Message**: Fix skill bugs: session state init, agent field cleanup, /start path, /sprint-plan phases

- Remove invalid `agent: Explore` frontmatter from read-only skills (asset-audit, design-review, project-stage-detect, reverse-document)
- Fix design-system and map-systems to create session-state/active.md if it does not exist before updating
- Fix gate-check to remove reference to non-existent bmad-bmm-check skill
- Expand /start recommended paths into phased roadmap (Concept → Architecture → Production)
- Restructure /sprint-plan into numbered phases with clearer next-steps section

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

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

---

### Incident Patch 9: `6c041ac1` (2026-03-27)
**Commit Message**: Release v0.4.0: /consistency-check, skill fixes, genre-agnostic agents

New skill: /consistency-check — cross-GDD entity registry scanner
New registries: design/registry/entities.yaml, docs/registry/architecture.yaml
Skill fixes: no-arg guards, verdict keywords, AskUserQuestion gates on all team-* skills
Agent fixes: genre-agnostic language in game-designer, systems-designer, economy-designer, live-ops-designer
Docs: skill/template counts corrected, stale references cleaned up

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

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

---

### Incident Patch 10: `cdb1aa83` (2026-03-13)
**Commit Message**: Session memory extraction + tiered context loading improvements

- /review-all-gdds, /architecture-review, /story-done: auto-append Session
  Extract block to active.md after report write (verdict, flags, next action)
- /review-all-gdds, /architecture-review, /create-epics-stories, /content-audit:
  L0 summary scan phase before full document load (reduces token cost)
- GDD template: added Summary section + Cross-References table + Last Verified field
- ADR template: added Summary section + Last Verified field

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>

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
