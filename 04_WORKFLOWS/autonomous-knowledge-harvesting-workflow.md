# Autonomous Knowledge Harvesting Workflow

> Canonical Reference: `AI-Builder-Brain/04_WORKFLOWS/autonomous-knowledge-harvesting-workflow.md`  
> Purpose: Governs the automated, multi-dimensional extraction, forensic verification, differential Brain comparison, and integration of reusable engineering knowledge from any connected project or external repository into `C:\AI-Builder-Brain`.

---

## 1. Executive Directive

Knowledge harvesting in AI-Builder-Brain MUST NOT require tedious multi-turn manual prompt ping-pong.
The system provides two autonomous operating pathways:

1. **Explicit On-Demand Trigger**: Activated when the user issues commands like:
   - *"is project ki totally har area se reusable learning nikal lo"*
   - *"is project se learning nikal lo"*
   - *"extract all reusable engineering learnings"*
   The agent immediately executes all 5 forensic steps across all 8 dimensions in one unified session.

2. **Continuous Silent Background Auto-Harvest**: Activated whenever:
   - A project bridges to `C:\AI-Builder-Brain` (via `.project-brain/brain-bridge.json` or workspace contact).
   - An active project under development resolves a defect, refactors a critical boundary, or reaches a milestone.
   The agent autonomously audits the delta, extracts reusable patterns silently, and updates the Brain without requiring manual user commands.

---

## 2. The 8 Multi-Dimensional Inspection Axes

When analyzing a codebase, the agent sweeps across these 8 dimensions using targeted inspection tools:

| # | Investigation Dimension | What to Inspect | Verification Tools |
|---|---|---|---|
| **D1** | **Architecture & Structural Boundaries** | SSR/SSG boundaries, service layers, component contracts, state containers | `list_dir`, file slicing, architecture docs |
| **D2** | **Asynchronous State & Concurrency** | In-flight async fresh state, mutation locks, event loops, race conditions | `grep_search` (`async`, `await`, `lock`, `mutex`) |
| **D3** | **Error Boundaries & Rollback Safety** | Bounded rollback budgets, exception isolation, transaction draining | `grep_search` (`try`, `catch`, `except`, `rollback`, `budget`) |
| **D4** | **Resource Lifecycles & Leaks** | Timer cleanups, connection pools, thread handles, file descriptor sweeps | `grep_search` (`close()`, `dispose()`, `clearInterval`, `thread`) |
| **D5** | **Boundary Deserialization & Encoding** | Untrusted JSON, SQL LIKE escaping, Unicode normalization, data contracts | Code audit of parsing endpoints and storage adapters |
| **D6** | **Cross-Platform & Runtime Gotchas** | Windows CRLF vs POSIX LF regex, hydration clobbering SSR, edge redirects | `grep_search` (`\r?\n`, `trailingSlash`, `data-label`) |
| **D7** | **Build, CI/CD, Deployment & Tooling** | Bundlers, cache persistence, edge config, strict compilation flags | `package.json`, `tsconfig.json`, CI workflows |
| **D8** | **Forensic Bug Fixes & Real Incidents** | Git commit log of fixes, closed PRs, user corrections, regression tests | `git log -n 50 --grep="fix"`, test files |

---

## 3. The 5-Step Operational Pipeline

```
[ Step 1: Multi-Dimensional Investigation ]
                    ↓
[ Step 2: Empirical Source Evidence Compilation ]
                    ↓
[ Step 3: Differential Brain Comparison ]
                    ↓
[ Step 4: Reusable Knowledge Distillation ]
                    ↓
[ Step 5: Final Controlled Brain Integration ]
```

---

### Step 1: Multi-Dimensional Investigation (No Modifications)
* **Goal**: Thoroughly discover how the codebase handles the 8 dimensions.
* **Actions**:
  1. Inspect directory structure and dependency manifests (`package.json`, `pyproject.toml`, `Cargo.toml`).
  2. Scan Git history for recent production fixes:
     `git log -n 40 --pretty=format:"%h - %s (%ad)" --date=short`
  3. Filter commits addressing stability, leaks, race conditions, and architectural boundaries.
  4. Inspect active test suites to understand verified invariants.
* **Strict Rule**: DO NOT modify Brain files during this step. Pure empirical analysis.

---

### Step 2: Empirical Source Evidence Compilation
* **Goal**: Assemble indisputable proof for every observed engineering lesson.
* **Mandatory Evidence Triad**:
  1. **Source Code Location**: Absolute or repository-relative path with exact line numbers (e.g. `src/memory/sqlite_session.py#L178-L208`).
  2. **Commit / PR Provenance**: Git commit hash, PR number, or author changelog documenting why the change was made (e.g. `commit 0b6fcd8e: fix(sessions): close SQLiteSession connections...`).
  3. **Verification Proof**: Unit/integration test verifying the invariant (e.g. `test_concurrent_thread_barrier_burst`), or real runtime error stack trace.
* **Rejection Criteria**: Speculative hypotheses, generic web tutorials, and unverified assumptions are strictly excluded.

---

### Step 3: Differential Brain Comparison
* **Goal**: Compare evidence-backed findings against current `C:\AI-Builder-Brain` contents to avoid redundant noise and prevent regressions.
* **Comparison Procedure**:
  1. Load existing numbered rules from `05_KNOWLEDGE/engineering-patterns.md` (Rules 1 through 17+).
  2. Consult `01_CORE/operating-rules.md`, `01_CORE/principles.md`, and relevant skills in `03_SKILLS/`.
  3. Classify every finding into the **Differential Matrix**:

| Classification | Definition | Action Taken |
|---|---|---|
| **Duplicate (Already Exists)** | Pattern is already covered by an existing Brain rule | Log match; skip redundant rule creation |
| **Net-New Reusable** | Universal pattern solving an unaddressed failure mode across projects | Fast-track to Rule candidate |
| **Refinement / Improvement** | Deepens, extends, or adds edge-case coverage to an existing Brain rule | Formulate targeted rule enhancement |
| **Conflict** | Finding contradicts an existing Brain rule | Resolve via Precedence Hierarchy (Real runtime > Assumptions) |
| **Repository-Specific** | Logic applies solely to this project's stack/domain (not universally reusable) | Archive in project-learning record only |

---

### Step 4: Reusable Knowledge Distillation & Quality Filtering
* **Goal**: Strip project-specific syntax and formulate timeless, cross-framework engineering rules.
* **Formulation Template**:
  ```markdown
  ## [Rule Number]. [Descriptive Title]
  
  **RULE**:
  [Concise, imperative statement of what must or must not be done.]
  
  **WHY**:
  [Specific catastrophic failure or silent defect prevented.]
  
  **WHEN TO APPLY**:
  [Applicable architectural boundaries, environments, and conditions.]
  ```

---

### Step 5: Final Controlled Brain Integration & Evolution
* **Goal**: Write verified learnings into canonical Brain destinations and record version progress.
* **Execution Destinations**:
  1. **`07_PROJECT_LEARNING/[project-name]-learnings.md`**:
     - Create/update comprehensive forensic record following the 10-point protocol.
  2. **`05_KNOWLEDGE/engineering-patterns.md`**:
     - Append newly verified universal rules as sequential numbered rules (`Rule 18`, etc.).
     - Update existing rules with verified refinements.
  3. **`03_SKILLS/[relevant-skill].md`**:
     - If the pattern introduces a domain-specific playbook (e.g., SEO, Astro, Tailwind, SQLite Concurrency), update or create the skill document.
  4. **`14_EVOLUTION/` and `15_METADATA/brain-status.md`**:
     - Log the knowledge evolution event with provenance notes and timestamp.
  5. **Child Project Synchronization (if bridged)**:
     - Update `.project-brain/brain-bridge.json` status to reflect fresh ingestion.

---

## 4. Silent Background Auto-Harvest Integration

To ensure the Brain learns silently and continuously without constant user prompting:

1. **Bridge Connection Trigger**:
   - When a project boots or bridges via `AGENT_BOOT_PROTOCOL.md` (Step 2 & Step 15):
   - The agent reads `.project-brain/brain-bridge.json`.
   - If unharvested commits or resolved incidents exist in `.project-brain/incidents/`, the agent silently runs the 5-step evaluation and merges verified patterns into `C:\AI-Builder-Brain`.

2. **Active Development Trigger**:
   - During live coding, whenever the agent resolves a bug that required multiple attempts or uncovered an OS/framework gotcha:
   - The agent silently captures the incident in `.project-brain/incidents/INC-XXX.md`.
   - If the lesson has universal reusability, it stages or auto-integrates it into Master Brain knowledge during the same turn.
