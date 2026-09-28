# Canonical Universal Agent Boot Protocol

> **Reference**: `AI-Builder-Brain/00_START_HERE/AGENT_BOOT_PROTOCOL.md`  
> **Mandate**: Mandatory 15-step execution sequence for any AI agent booting inside any project operating under AI-Builder-Brain.

---

## The 15-Step Universal Boot Sequence

When an AI agent starts work or boots up in any workspace, it MUST execute these 15 steps:

```
[ 1. Discover AI-Builder-Brain ]
               ↓
[ 2. Verify Brain Bridge ]
               ↓
[ 3. Load Project Context ]
               ↓
[ 4. Load Project Rules ]
               ↓
[ 5. Resolve Applicable Skills ]
               ↓
[ 6. Resolve Applicable Knowledge ]
               ↓
[ 7. Resolve Applicable Workflows ]
               ↓
[ 8. Check Environment ]
               ↓
[ 9. Check Project State ]
               ↓
[ 10. Determine Current Task ]
               ↓
[ 11. Execute Smallest Safe Action ]
               ↓
[ 12. Live Verification ]
               ↓
[ 13. Capture Incident If Needed ]
               ↓
[ 14. Update Project State ]
               ↓
[ 15. Continue ]
```

---

### Step 1: Discover & Sync AI-Builder-Brain
- Locate Master Brain (`C:\AI-Builder-Brain`, `AI_BUILDER_BRAIN_PATH`, or sibling).
- Verify canonical folders (`00_START_HERE`, `01_CORE`, `04_WORKFLOWS`).
- Auto-pull latest 24/7 cloud-harvested learnings from GitHub remote (`git -C "C:\AI-Builder-Brain" pull --rebase origin main`). This guarantees that all intelligence harvested in the cloud while the laptop was closed or offline is instantly available locally.
- Enforce strict read-only boundary on Master Brain during child project development.


### Step 2: Verify Brain Bridge
- Inspect `.project-brain/brain-bridge.json`.
- Verify zero-copy connection status. Fall back to local `.project-brain/` cache if offline.

### Step 3: Load Project Context
- Read `PROJECT_CONTEXT.md` to understand mission, stack boundaries, and constraints.
- Do not invent requirements outside defined boundaries.

### Step 4: Load Project Rules
- Read `PROJECT_RULES.md` to establish non-destructive invariants and quality rules.

### Step 5: Resolve Applicable Skills
- Inspect `PROJECT_SKILLS.md`. Load only skills relevant to the active project class.
- Do not load unused framework playbooks into prompt context.

### Step 6: Resolve Applicable Knowledge
- Read `PROJECT_KNOWLEDGE.md`. Consult indexed engineering patterns (Rules 1-68+) from Master Brain `05_KNOWLEDGE/engineering-patterns.md`.

### Step 7: Resolve Applicable Workflows
- Read relevant workflows in `04_WORKFLOWS/` (e.g. bug correction, git lifecycle, dynamic verification, batch-auto-harvester).

### Step 8: Check Environment
- Inspect `PROJECT_ENVIRONMENT.md` or execute runtime pre-flight (`node -v`, `git status`).

### Step 9: Check Project State
- Read `PROJECT_STATE.json` to verify current project stage, completed milestones, and active issues.

### Step 10: Determine Current Task
- Identify user objective, expected output, existing state, and acceptance criteria.
- Separate facts from assumptions.

### Step 11: Execute Smallest Safe Action
- Apply minimal, atomic, surgical edits. Freeze domain mathematics and layout geometry.

### Step 12: Live Verification
- Execute actual build and runtime probes (`npm run build`, socket probe).
- Never declare completion based on generated code alone.

### Step 13: Capture Incident If Needed & Autonomous Evaluation
- If an unexpected error occurs, log forensic record in `.project-brain/incidents/INC-XXX.md`.
- Follow the bug correction lifecycle.
- Autonomously evaluate the fix against the 5-step learning pipeline (`10_PROMPTS/autonomous-5-step-learning-engine.md`). If the fix reveals a reusable pattern, silently promote/stage into Master Brain.

### Step 14: Update Project State
- Update `PROJECT_STATE.json` with new milestone progress or active issues.

### Step 15: Continue & Silent / Batch / Cloud Learning Sync
- Report verified evidence and proceed to next task cleanly.
- Silently ("chupchap") synchronize any unharvested reusable project learnings to `C:\AI-Builder-Brain` in the background.
- When requested to batch-harvest (e.g. via `repos.txt` or URL list), execute the autonomous full-clone loop (`04_WORKFLOWS/batch-auto-harvester.md`) or Zero-Clone 24/7 Cloud Harvester (`04_WORKFLOWS/zero-clone-cloud-harvester.md`), auto-push to GitHub, and maintain clean storage without requiring manual human steps.
- **Enforce Upgrade-Only Invariant**: Never re-harvest any repository, Hugging Face model, or local project if its commit revision matches `sources-registry.json` or `.project-brain/brain-bridge.json`. Skip immediately to preserve LLM tokens and execution time.

### Step 16: Autonomous Discovery Scout (Perpetual Self-Feeding Engine)
- If the harvest queue (`repos.txt`) is drained or all targets are up-to-date, invoke the Autonomous Discovery Scout (`04_WORKFLOWS/auto-discovery-engine.md`).
- Multi-agent scout partitions searches across 4 domains (`ai-agents`, `fullstack-ui`, `high-perf-systems`, `huggingface-ai-models`) using domain locks (`.harvest-locks/scout-domain-<domain>.lock`).
- Evaluates repository quality score (stars, active push vitality, license, forks) and auto-queues top projects into `repos.txt` for 24/7 harvesting.




