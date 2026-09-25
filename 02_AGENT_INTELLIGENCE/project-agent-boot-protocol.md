# Project Agent Boot Protocol

> **Canonical Reference**: `AI-Builder-Brain/02_AGENT_INTELLIGENCE/project-agent-boot-protocol.md`  
> **Mandate**: Mandatory 15-step execution sequence for any AI agent booting inside a child project created by AI-Builder-Brain.

---

## The 15-Step Universal Boot Sequence

```
[ Step 1: Discover AI-Builder-Brain ]
               ↓
[ Step 2: Verify Brain Bridge ]
               ↓
[ Step 3: Load Project Context ]
               ↓
[ Step 4: Load Project Rules ]
               ↓
[ Step 5: Resolve Applicable Skills ]
               ↓
[ Step 6: Resolve Applicable Knowledge ]
               ↓
[ Step 7: Resolve Applicable Workflows ]
               ↓
[ Step 8: Check Environment ]
               ↓
[ Step 9: Check Project State ]
               ↓
[ Step 10: Determine Current Task ]
               ↓
[ Step 11: Execute Smallest Safe Action ]
               ↓
[ Step 12: Live Verification ]
               ↓
[ Step 13: Capture Incident If Needed ]
               ↓
[ Step 14: Update Project State ]
               ↓
[ Step 15: Continue ]
```

---

### Step 1: Discover AI-Builder-Brain
- Locate Master Brain path (`C:\AI-Builder-Brain`, `AI_BUILDER_BRAIN_PATH`, or `..\AI-Builder-Brain`).
- Inspect `00_START_HERE` and `01_CORE`.
- Enforce strict read-only boundary on Master Brain. Master Brain is never mutated directly by child project agents.

### Step 2: Verify Brain Bridge
- Check `.project-brain/brain-bridge.json`.
- Verify `connected: true` and `zeroCopyEnforced: true`.
- If offline, fallback cleanly to local `.project-brain/` cache without crashing.

### Step 3: Load Project Context
- Read `PROJECT_CONTEXT.md` to establish project mission, target users, and architectural boundaries.
- Adhere strictly to the defined project class (e.g. `seo-adsense-micro-website`, `ai-saas`, etc.).

### Step 4: Load Project Rules
- Read `PROJECT_RULES.md`.
- Re-affirm the Non-Destructive Invariant: never delete working calculation math, responsive layouts, or ad containers.

### Step 5: Resolve Applicable Skills
- Inspect `PROJECT_SKILLS.md` and query only the skills listed for this project profile.
- Do NOT dump the entire Master Brain `03_SKILLS/` into context.

### Step 6: Resolve Applicable Knowledge
- Read `PROJECT_KNOWLEDGE.md` to load the active engineering patterns (e.g. Rules 1, 5, 9, 11, 13) and verified reusable lessons.

### Step 7: Resolve Applicable Workflows
- Read relevant workflows in Master Brain `04_WORKFLOWS/` (e.g., bug correction lifecycle, dynamic verification).

### Step 8: Check Environment
- Inspect `PROJECT_ENVIRONMENT.md` or run quick check on required runtimes (Node.js, Git, package managers).

### Step 9: Check Project State
- Read `PROJECT_STATE.json` to verify stage, completed milestones, capabilities, and active incidents.

### Step 10: Determine Current Task
- Clarify user directive. Separate observed facts from assumptions. Identify verification criteria before modifying code.

### Step 11: Execute Smallest Safe Action
- Make atomic, minimal edits. Handle cross-platform line-endings (`\r?\n`) safely.

### Step 12: Live Verification
- Run live build (`npm run build`) and runtime server probe.
- Never claim success without live terminal evidence.

### Step 13: Capture Incident If Needed
- If an unexpected error, build crash, or hydration mismatch occurs, document it immediately in `.project-brain/incidents/INC-XXX.md`.

### Step 14: Update Project State
- Update `PROJECT_STATE.json` with milestone progress and resolved status.

### Step 15: Continue
- Report verifiable evidence and ready status to user.
