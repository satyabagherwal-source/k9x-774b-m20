# Project Agent Boot Protocol

> Canonical reference: `AI-Builder-Brain/02_AGENT_INTELLIGENCE/project-agent-boot-protocol.md`  
> Purpose: Mandatory 11-step execution sequence for any AI agent booting inside a child project created by AI-Builder-Brain.

---

## The 11-Step Project Agent Boot Sequence

When an AI agent boots or receives a new task in any child project, it MUST execute these 11 steps in exact sequence:

```
[ Step 1: Discover Master Brain ]
               │
               ▼
[ Step 2: Establish Zero-Copy Brain Bridge ]
               │
               ▼
[ Step 3: Establish Project State & History ]
               │
               ▼
[ Step 4: Load Task-Specific Knowledge & Skills ]
               │
               ▼
[ Step 5: Separate Facts from Assumptions ]
               │
               ▼
[ Step 6: Environmental & Dependency Health Check ]
               │
               ▼
[ Step 7: Plan Smallest Surgical Action & Freeze Invariants ]
               │
               ▼
[ Step 8: Execute Minimal Non-Destructive Changes ]
               │
               ▼
[ Step 9: Multi-Layer Live Verification (Build + Server Probe) ]
               │
               ▼
[ Step 10: Capture Incident & Project Learning ]
               │
               ▼
[ Step 11: Report Status & Ready Certification ]
```

---

### Step 1: Discover Master Brain
- Search candidate locations for canonical AI-Builder-Brain:
  1. `process.env.AI_BUILDER_BRAIN_PATH`
  2. `.project-brain/brain-bridge.json` -> `masterBrainPath`
  3. `C:\AI-Builder-Brain`
  4. `..\AI-Builder-Brain` (workspace sibling)
- Verify `00_START_HERE` and `01_CORE` exist at the resolved path.
- Enforce strict read-only access. Master Brain files MUST NOT be directly modified.

### Step 2: Establish Zero-Copy Brain Bridge
- Check whether `.project-brain/brain-bridge.json` is present and valid.
- If Master Brain is unlocated, set bridge status to `OFFLINE_FALLBACK` using local `.project-brain/` cache.
- Never duplicate Master Brain folders into the project repository.

### Step 3: Establish Project State & History
- Read `PROJECT_STATE.json` to verify current project status (`BOOTSTRAPPED`, `READY`, `DEVELOPMENT`).
- Read `PROJECT_CONTEXT.md` for project mission, architecture, and technology boundaries.
- Inspect `PROJECT_RULES.md` for project-specific constraints.
- Run `git status` to verify branch, uncommitted changes, and working tree cleanliness.

### Step 4: Load Task-Specific Knowledge & Skills Selectively
- Query Master Brain selectively; do NOT dump hundreds of files into context.
- For architectural/state decisions: inspect [05_KNOWLEDGE/engineering-patterns.md](file:///c:/AI-Builder-Brain/05_KNOWLEDGE/engineering-patterns.md).
- For UI & styling: inspect [03_SKILLS/tailwind-v4-css-first-design.md](file:///c:/AI-Builder-Brain/03_SKILLS/tailwind-v4-css-first-design.md).
- For Astro / routing / SEO: inspect [03_SKILLS/astro-architecture-and-seo.md](file:///c:/AI-Builder-Brain/03_SKILLS/astro-architecture-and-seo.md).
- For deployment / headers: inspect [03_SKILLS/vercel-deployment-playbook.md](file:///c:/AI-Builder-Brain/03_SKILLS/vercel-deployment-playbook.md).

### Step 5: Separate Facts from Assumptions
Categorize all task-related statements into:
- **Observed Fact**: Proven by live terminal output or file content.
- **Source-Backed Claim**: Documented in official registry docs.
- **Inference**: Logical deduction requiring validation.
- **Hypothesis**: Proposed explanation to be tested.
- **Unknown**: Needs direct verification before action.

### Step 6: Environmental & Dependency Health Check
- Check Node.js (`node -v`, >= 18.0.0).
- Check npm (`npm -v`, >= 9.0.0).
- Check Git (`git --version`) and GitHub CLI (`gh auth status` if applicable).
- Run pre-flight build check: verify `dist/` or `npm run build` exits 0 before making changes.

### Step 7: Plan Smallest Surgical Action & Freeze Invariants
- State precisely which files will be modified or added.
- **Explicitly freeze** domain invariants: layout geometry, responsive tokens, canvas math, Core Web Vitals (LCP, CLS), and ad slots.
- Define expected verifiable outcome before editing.

### Step 8: Execute Minimal Non-Destructive Changes
- Apply atomic edits. Never rewrite entire files when a 5-line patch suffices.
- Ensure cross-platform line-ending safety: handle CRLF and LF using `split(/\r?\n/)`.
- Adhere to CSS-first `@theme` tokens in `src/styles/global.css`.

### Step 9: Multi-Layer Live Verification
- **Compilation**: Run `npm run build` — must exit 0.
- **Runtime Probe**: Verify dev-server boots and responds with HTTP 200.
- **Artifact Inspection**: Inspect compiled HTML in `dist/` for meta tags, canonical links, and rendered content.
- **Zero-Hallucination Gate**: Never claim completion based on generated code alone.

### Step 10: Capture Incident & Project Learning
- If an unexpected error, build failure, or tricky issue occurred, log it in `.project-brain/incidents/INC-XXX.md`.
- Follow the 10-point learning protocol from Master Brain [07_PROJECT_LEARNING/project-learning-protocol.md](file:///c:/AI-Builder-Brain/07_PROJECT_LEARNING/project-learning-protocol.md).
- If reusable across projects, prepare candidate in `.project-brain/promotion-queue/`.

### Step 11: Report Status & Ready Certification
- Output final status: `PROJECT STATUS: READY` or `PROJECT STATUS: BLOCKED`.
- State clearly:
  - What was executed.
  - What commands were run and their exit codes.
  - What artifacts were verified in `dist/`.
  - Remaining pending tasks or next steps.
