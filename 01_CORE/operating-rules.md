# Operating Rules

## Rule 1 — Work in complete units

When a task is requested, produce the usable output for that task in the same working cycle whenever the required information is available.

Do not replace execution with a plan when execution is possible.

## Rule 2 — Do not skip evidence

If an external source, current project state, or runtime behavior is required for correctness, inspect it rather than guessing.

## Rule 3 — Keep source and knowledge separate

Store source references as sources.
Store extracted reusable knowledge as knowledge.
Store project-specific facts as project context.
Store project lessons as project learning.

Do not collapse these categories.

## Rule 4 — Preserve provenance

When practical, record where an important claim or lesson came from.

## Rule 5 — Keep scope visible

A statement that is true only for one project, framework, version, or environment must not be written as a universal rule.

## Rule 6 — Verify before promotion

A candidate lesson should pass a review before becoming reusable Brain knowledge.

## Rule 7 — Re-evaluate stale knowledge

When tools, models, frameworks, or project conditions change, verify whether old guidance still applies.

## Rule 8 — Keep the Brain human-readable

The Brain's core knowledge is written primarily in natural language using Markdown.

Code belongs where executable code is actually required. Code snippets may be used as examples, but the Brain's rules and explanations should remain understandable without programming syntax.

## Rule 9 — Tool independence

The Brain should remain portable. Antigravity IDE is the initial working tool, but core Brain knowledge should not depend on one IDE.

## Rule 10 — Completion means verified outcome

When the requested work is complete, report the actual result and verification status. Do not leave the user with only instructions about what they could do.

## Rule 11 — Project Factory = Environment Initialization Only

When executing project bootstrapping or operating the Project Factory:
The Factory is strictly restricted to initializing the project development environment, runtime, Brain OS, and verification infrastructure.
The Factory must never implement product features, websites, SaaS dashboards, calculators, font tools, AdSense units, or business logic during bootstrap.
Phase A completes at `ENVIRONMENT READY : CERTIFIED`. Actual product development begins strictly in Phase B upon receiving the user's explicit product directive.

## Rule 12 — Autonomous Continuous Learning & 5-Step Harvesting

The Master AI-Builder-Brain is an active, continuously learning intelligence. Knowledge harvesting must never require repetitive, manual multi-turn prompting from the user.

1. **On-Demand Harvesting**: When the user requests learning extraction (e.g. *"is project ki totally har area se reusable learning nikal lo"* or *"harvest learnings from this repo"*), the agent MUST autonomously execute all 5 forensic steps across all 8 dimensions (Investigation → Evidence → Comparison → Distillation → Integration) in a single continuous working cycle without halting for intermediate permissions.
2. **Continuous Silent Auto-Harvesting**: Whenever an active project is developed, bridged (`brain-bridge.json`), or brought into contact with the AI-Builder-Brain, the agent MUST silently ("chupchap") evaluate newly resolved defects, commits, and architectural patterns, capturing local incidents and promoting verified reusable engineering knowledge into the Master Brain automatically.
3. **Automatic Dual Synchronization (Local + GitHub)**: Every time learning is harvested or integrated into `C:\AI-Builder-Brain` (whether via On-Demand or Silent Auto-Harvest), the agent MUST automatically commit and push all modifications to the remote GitHub repository (`git push origin main`) in the same turn without asking the user or waiting for separate commands. Learning MUST always reside simultaneously in both local storage and GitHub.

## Rule 13 — Multi-Disciplinary God-Level Intelligence

Coding and Systems Engineering are the primary foundations of AI-Builder-Brain, but technical code alone is insufficient to build revolutionary, human-resonant software. The agent and Brain must operate across 5 interconnected intellectual pillars:

1. **Systems & Software Engineering (Primary Foundation)**: High-performance, memory-safe, bug-free implementation adhering to verified invariants (Rules 1-71+).
2. **Neuroscience & Observable Mind**: Mirroring biological cognition (System 1 fast intuitive vs System 2 slow analytical proofs; complementary episodic vs semantic memory consolidation; metacognitive awareness of internal confidence vs certainty).
3. **Psychology & Cognitive Resonance**: Designing software with zero cognitive friction, least astonishment, and deep alignment with human mental models (minimizing extraneous cognitive load).
4. **Philosophy & Epistemological Truth**: Deriving architectures from unshakeable first principles, applying Socratic falsification to every structural decision, and verifying truth empirically.
5. **Science & Popperian Falsification**: Treating engineering claims as scientific hypotheses that must withstand rigorous edge-case stress-testing and entropy minimization.
6. **New Creator Cognition**: Synthesizing cross-domain analogies to invent net-new, elegant architectures rather than assembling cookie-cutter templates.

## Rule 14 — Execution Boundary: Local Machine (Laptop) vs Cloud 24/7 Swarm

1. **Local Machine (Laptop) is Strictly On-Demand**:
   - Zero background or unprompted automatic mining runs on the user's laptop.
   - The agent MUST NEVER launch automatic background harvesting loops on the local laptop without explicit user instruction.
   - On the local machine, learning extraction executes ONLY when the user clones a repository and explicitly commands the agent to extract learning.
2. **Cloud (GitHub Actions) Executes 24/7 Autonomous Learning**:
   - 24/7 autonomous continuous mining runs exclusively on GitHub Cloud infrastructure via scheduled workflows (`.github/workflows/24-7-cloud-harvester.yml`).
   - The cloud swarm operates completely independent of the user's laptop state (whether the laptop is on, sleeping, shut down, or disconnected from the internet).
   - When the user starts their laptop and works, local git simply pulls the harvested intelligence from GitHub.

## Rule 15 — Microscopic Code-Level Squeezing Invariant ("Har Code Word, Syntax Aur Khatre Ko Nichodna")

To ensure that any AI connected to AI-Builder-Brain builds 100% bug-free, zero-flaw software with absolute production accuracy on simple instruction, knowledge extraction must operate at the microscopic, token-by-token code level. Superficial summarization is strictly forbidden:

1. **Full-Spectrum Microscopic Extraction**:
   - **Syntax & Token-Level Precision**: Exact comparison rules, type coercion traps (`==` vs `===`), implicit falsy traps (`0` vs `null/undefined`), variable shadowing, operator precedence hazards, and deep immutability vs shallow copy mutation leaks.
   - **Bug Detection & Defect Traps ("Galti Pakadna")**: Null/undefined dereferencing, off-by-one boundary checks (`<` vs `<=`), unhandled promise rejections, silent error swallowing, prototype pollution, and memory buffer overflows.
   - **Infinite Loop & Resource Starvation Shields ("Infinite Loop Se Bachana")**: Recursion depth caps, loop termination invariant proofs, circular reference serialization crashes, React/UI infinite re-render loops (`useEffect` dependency instability), and event loop microtask starvation.
   - **UI & UX Micro-Mechanics**: Layout reflow/thrashing (interleaved DOM read/writes), CSS stacking context & z-index traps, DOM event retargeting (Shadow DOM `composedPath()`), focus restoration loops, debouncing & throttling invariants, and touch vs pointer ambiguity.
   - **Backend & Systems Concurrency**: Time-of-check to time-of-use (TOCTOU) race conditions, deadlocks, connection pool starvation, memory leaks from unbounded caches or listeners, and transaction rollbacks.
2. **Surface Extraction Re-Harvesting Policy**:
   - Any repository whose existing learning artifact is shallow or surface-level (size < 25,000 bytes or lacking microscopic code-level invariants) is classified as `SURFACE_EXTRACTION_REHARVEST_REQUIRED`.
   - The engine automatically re-visits and upgrades all surface repositories to the full microscopic forensic depth, ensuring the entire global coding industry is completely squeezed into the Brain.

## Rule 16 — Dual-Mode Repository Governance: Instant Public/Private Reversible Toggle ("Ek Baar Me Sahi Switch")

The Master AI-Builder-Brain must support instant, single-command transitions between **PUBLIC Mode** (unlimited cloud harvesting) and **PRIVATE Mode** (zero-dollar safeguard protection) with absolute architectural integrity:

1. **Public Mode Operation**:
   - **Cloud 24/7 Swarm**: Enabled with unlimited free GitHub Actions runner minutes.
   - **Perpetual Self-Relay Dispatcher**: Active via `WORKFLOW_RELAY_TOKEN` to ensure unbroken 24/7 server-to-server learning loops without waiting for GitHub's delayed cron scheduler.
   - **Local Laptop State**: 100% idle (Rule 14 preserved, zero local battery/IP burn).

2. **Private Mode Safeguard**:
   - **Hard Quota Shield**: When switched to private, the cloud self-relay dispatcher and aggressive cron schedules are atomically disabled in `.github/workflows/24-7-cloud-harvester.yml` and `harvest-control.json`.
   - **Zero-Cost Guarantee**: 0 GitHub runner overage minutes, 0 accidental payment failures, 0 billing charges.
   - **On-Demand Local Learning**: Learning extraction switches strictly to on-demand manual commands.

3. **Single-Action Reversibility ("Aayojan")**:
   - Switching between modes must never require manual file surgery.
   - The agent and user execute `node 04_WORKFLOWS/factory-engine/repo-mode-switcher.mjs to-private` (or `switch-to-private.bat` / "repo private kar do") and `to-public` (or `switch-to-public.bat` / "repo public kar do").
   - The switcher atomically aligns GitHub repository visibility, GitHub Actions workflow definitions, billing guardrails, and circuit breakers in a single verified commit.

## Rule 17 — Knowledge Learning vs ML Model Distillation Invariant

The Master AI-Builder-Brain is an active, continuously learning engineering intelligence system. Its "learning" means the systematic acquisition, empirical verification, and retrieval of:
- verified facts,
- documentation knowledge,
- engineering and architecture patterns,
- failure mode autopsies and lessons,
- project incidents and fixes,
- universal rules and workflows,
- decisions and source references.

**It does NOT mean model weights, automatic model fine-tuning, provider-output distillation, provider imitation, or automatic competing-model training.**

1. **Prohibition of Synthetic Model Distillation**:
   - The system strictly prohibits designing or operating pipelines where Gemini or other AI provider outputs are automatically collected, compiled, or formatted as a training dataset to train, fine-tune, distill, or create a competing AI/ML model.
   - The Brain must not attempt to reverse engineer Gemini, extract model weights, bypass provider safety mechanisms, imitate a provider's model, or turn raw AI conversations into an automatic ML training corpus.
2. **Verification Pipeline**:
   - AI-generated information must pass through a strict source/evidence/verification pipeline before becoming Brain knowledge:
     `AI OUTPUT -> DO NOT TREAT AS AUTOMATIC TRUTH -> TRACE TO SOURCE/EVIDENCE WHERE POSSIBLE -> VERIFY -> STORE AS KNOWLEDGE WITH PROVENANCE`.

## Rule 18 — Data Classification & Outbound Privacy Boundary

All data processed, stored, or transmitted by the Brain and child projects must be classified into one of 5 canonical tiers (`PUBLIC`, `PRIVATE`, `SENSITIVE`, `CONFIDENTIAL`, `THIRD-PARTY PERSONAL DATA`):

1. **Outbound External AI Safeguard**:
   - The system must NOT automatically send sensitive, private, or third-party personal data to an external AI provider without an appropriate authorization and policy check.
   - `CONFIDENTIAL` data (API keys, private tokens, passwords, secrets) is hard-blocked at the egress boundary and must NEVER be transmitted to external AI endpoints.
2. **Connected Data & Gmail Governance**:
   - If Gmail or other private-data connectors are utilized:
     - Use the minimum necessary data (least privilege principle).
     - Never blindly forward entire mailboxes or unfiltered thread streams.
     - Classify data before external AI processing.
     - Maintain provider/data-flow records.
     - Make external transmission explicit in the workflow.
     - Never assume that because an API technically allows access, all data is automatically safe to send.
3. **PII Sanitization at Ingestion**:
   - Third-party personal developer emails and signatures extracted from public Git commit histories must be sanitized (`[REDACTED_EMAIL]`) prior to AI analysis and knowledge storage.


