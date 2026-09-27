# Autonomous 5-Step Learning Engine (Master Unified Harvester)

> Canonical Reference: `AI-Builder-Brain/10_PROMPTS/autonomous-5-step-learning-engine.md`  
> Purpose: Unifies the 5 forensic learning prompts into an autonomous, zero-friction engine. Eliminates repetitive manual prompting so any project or repository can be completely harvested across all dimensions either via a single command or silently in the background.

---

## 1. Trigger Directives & Operating Modes

This engine operates in two non-blocking autonomous modes:

### Mode A: Single-Command Full-Spectrum Harvest (On-Demand)
* **Trigger Phrases (User Input)**:
  * *"learning harvest kar lo"*
  * *"learning harvest"*
  * *"is project ki totally har area se reusable learning nikal lo"*
  * *"is project se learning nikal lo"*
  * *"is repo ki totally har dimension se reusable learning extract karo"*
  * *"harvest all reusable learnings from this project"*
  * *"extract reusable engineering knowledge from this repository"*
* **Agent Mandate**:
  * **DO NOT** execute one step and pause asking the user for the next prompt.
  * **DO NOT** ask the user for confirmation between steps.
  * Autonomously execute **all 5 Steps sequentially in a single comprehensive working cycle**, sweeping through all 8 engineering dimensions.

### Mode B: Silent Background Auto-Harvest (Continuous & Bridge-Connected)
* **Activation**:
  * Any project actively developed by the user/agent.
  * Any project connected to `C:\AI-Builder-Brain` via `.project-brain/brain-bridge.json`.
  * Any project that touches, bridges, or interacts with the AI-Builder-Brain.
* **Agent Mandate**:
  * **SILENT & AUTONOMOUS (Chupchap)**: Extract reusable learnings automatically without waiting for the user to prompt.
  * Whenever a bug is fixed, a complex pattern is solved, an architectural decision is committed, or a project session closes:
    1. Silently execute the 5-step evaluation.
    2. Write project incidents to `.project-brain/incidents/`.
    3. Auto-promote or stage verified reusable patterns directly into `C:\AI-Builder-Brain`.

---

## 2. The 8 Multi-Dimensional Investigation Axes

When harvesting a project, the engine MUST investigate across these 8 distinct dimensions:

```
[ D1: Architecture & Structural Boundaries ]
  ├─ Framework choices, SSR vs SSG, service layers, component contracts
[ D2: Asynchronous State & Concurrency ]
  ├─ In-flight async fresh state, race conditions, mutation locks, event loops
[ D3: Error Boundaries, Recovery & Rollbacks ]
  ├─ Exception isolation, bounded rollback budgets, crash defense, safe fallbacks
[ D4: Resource Lifecycle & Cleanup ]
  ├─ Timers, connection pools, thread handles, file descriptors, event listeners
[ D5: Deserialization, Encoding & Boundaries ]
  ├─ Untrusted input parsing, JSON-in-SQL, unicode normalization, data contracts
[ D6: Cross-Platform & Runtime Gotchas ]
  ├─ Windows CRLF vs POSIX LF regex, client hydration clobbering SSR, edge redirects
[ D7: Build, CI/CD, Deployment & Tooling ]
  ├─ Bundle optimization, cache persistence, trailing slash parity, strict typing
[ D8: Forensic Bug Fixes & Real Incidents ]
  ├─ Git commit history (`git log`), closed PRs, resolved issues, user corrections
```

---

## 3. The Unified 5-Step Execution Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: Deep Multi-Dimensional Investigation (No Brain Edit)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: Empirical Source Evidence Compilation               │
│ (Commit hashes, line numbers, test assertions, runtime logs)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: Differential Brain Comparison                       │
│ (Compare with Rules 1-17+, Skills, Invariants; Classify)    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: Reusable Knowledge Distillation & Quality Filtering │
│ (Isolate cross-project gold; discard repo-specific quirks)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: Final Controlled Brain Integration & Evolution       │
│ (Update 07_PROJECT_LEARNING, 05_KNOWLEDGE, 03_SKILLS, 14_EV)│
└─────────────────────────────────────────────────────────────┘
```

---

### Step 1: Deep Multi-Dimensional Investigation
* **Objective**: Investigate what the repository actually does across the 8 dimensions.
* **Source Material**: Real code, tests, docs, commit logs (`git log -n 50`), issues, and build configurations.
* **Constraint**: Pure investigation. **NO** Brain modifications or promotions at this step.
* **Checks**:
  * What is the core business and domain invariant?
  * What architectural patterns were adopted?
  * What bugs or regressions were discovered and resolved?
  * What runtime gotchas were encountered?

### Step 2: Empirical Source Evidence Compilation
* **Objective**: Back every candidate finding with concrete, indisputable evidence directly from the repository.
* **Rule**: Generic knowledge, training assumptions, or speculative claims are strictly rejected.
* **Evidence Requirements**:
  * Exact file paths and line ranges (`src/core/session.py#L21-L40`).
  * Git commit hashes and commit messages (`0b6fcd8e: fix(sessions): close SQLiteSession...`).
  * Automated test names verifying the behavior (`test_await_mutation_cancellation...`).
  * Real runtime error logs or benchmark data if applicable.

### Step 3: Differential Brain Comparison
* **Objective**: Compare the evidence-backed findings against existing AI-Builder-Brain knowledge.
* **Brain Files Consulted**:
  * `05_KNOWLEDGE/engineering-patterns.md` (Existing Rules 1–17+)
  * `01_CORE/principles.md` & `01_CORE/operating-rules.md`
  * `03_SKILLS/` (Existing specialized domain playbooks)
  * `07_PROJECT_LEARNING/` (Past project learning records)
* **Differential Classification Grid**:
  1. **Already Exists (Duplicate)**: Matches an existing Brain rule (e.g. basic defensive JSON parsing already in Rule 5). Exclude from new rule creation.
  2. **Net-New Reusable**: Universal engineering pattern that solves a critical problem and does not exist in the Brain.
  3. **Refinement/Improvement**: Strengthens or adds edge-case coverage to an existing Brain rule (e.g. extending Rule 2 for thread-local connection sweeping).
  4. **Conflict**: Directly contradicts an existing Brain rule (requires evidence review under Level 1–Level 6 precedence).
  5. **Repository-Specific**: Valid only for this project's unique tech stack, version, or business logic. Kept in project context, never promoted to Master Brain.

### Step 4: Reusable Knowledge Distillation & Quality Filtering
* **Objective**: Filter out noise and formulate crisp, universal engineering patterns.
* **Filter Criteria**:
  * Is this pattern applicable to *other* projects and frameworks?
  * Does it prevent serious defects (data loss, race conditions, memory leaks, security breaches, broken builds)?
  * Is it formulated in clear natural language without unnecessary framework-specific trivia?
* **Action**:
  * Discard duplicates, weak hypotheses, and repo-specific quirks.
  * Draft candidate rules following the canonical schema:
    * **RULE**: Clear imperative directive.
    * **WHY**: Concrete failure mode prevented.
    * **WHEN TO APPLY**: Exact triggering contexts and architectures.

### Step 5: Final Controlled Brain Integration & Evolution
* **Objective**: Safely integrate verified knowledge into the canonical AI-Builder-Brain locations.
* **Integration Destinations**:
  1. **Project Learning Record**:
     - Write detailed forensic report to `07_PROJECT_LEARNING/[project-name]-learnings.md` following the 10-point learning protocol.
  2. **Engineering Patterns (Universal Rules)**:
     - Append newly verified universal patterns as new numbered rules or refinements in `05_KNOWLEDGE/engineering-patterns.md`.
  3. **Specialized Skills**:
     - If the learning represents an extensive architectural playbook (e.g. Astro AdSense, Multilingual SEO, WebGL calibration), update or create the relevant skill in `03_SKILLS/`.
  4. **Evolution Record**:
     - Record the promotion summary, source repository, and rationale in `14_EVOLUTION/` and `15_METADATA/brain-status.md`.
  5. **Child Project Bridge (if connected)**:
     - Update `.project-brain/brain-bridge.json` status and sync local knowledge cache.
  6. **Autonomous Dual Local & GitHub Synchronization (MANDATORY)**:
     - The agent MUST automatically commit and push all newly integrated knowledge to GitHub:
       ```bash
       git -C "C:\AI-Builder-Brain" add .
       git -C "C:\AI-Builder-Brain" commit -m "feat(brain): Full-Spectrum Multi-Dimensional Harvest for [project]"
       git -C "C:\AI-Builder-Brain" push origin main
       ```
     - **NEVER** leave learning unpushed or wait for the user to ask. Every harvested learning must reside in both local storage and the remote GitHub repository automatically.

---

## 4. End-to-End Autonomous Execution Guarantee

When the user triggers this engine:
* The AI agent executes **all 5 steps in unbroken continuity**.
* At the conclusion, the agent delivers a comprehensive **Harvesting Report** presenting:
  1. Dimensions audited and sources inspected.
  2. Verified incidents and evidence citations.
  3. Brain comparison differential matrix.
  4. Newly promoted engineering patterns and skills.
  5. Files updated in `C:\AI-Builder-Brain`.
