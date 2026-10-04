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

## Rule 19 — Interactive Requirement Discovery via Deep-Diving Multi-Select Modals ("Pehle Multi-Selector Se Deep Diving Pucho, Fir Banao")

When any user asks an AI connected to AI-Builder-Brain to build, redesign, or enhance a website, web app, or software project:

1. **Zero Guesswork / Anti-Assumption Invariant**:
   - The AI must NEVER guess, assume user intent, or immediately jump into writing code based on ambiguous or underspecified prompts.
   - Blind guessing inevitably leads to creating shallow clones, wrong branding, discarded work, or features the user never asked for.
2. **Mandatory Deep-Diving Interactive Multi-Select Modal (`ask_question`)**:
   - Before writing any implementation code or scaffolding new architecture, the AI MUST invoke the interactive modal (`ask_question` tool) with structured choices (`is_multi_select: true` or single-select) formatted as direct user responses.
   - The AI is empowered and required to ask as many multi-select questions as needed ("kitna bhi puchh sakta hai") to deep-dive into:
     - **Core Identity & Branding**: Original custom brand vs. existing project expansion vs. reference inspiration.
     - **Feature Selection & Scope**: Exact tools, generators, visual customizers, filters, or APIs needed.
     - **Aesthetic & Design Direction**: Obsidian dark, sleek luxury, minimal brutalist, typography choices, and color tokens.
     - **Data & Licensing Boundaries**: Commercial verification standards, local JSON vs. live database, export formats.
3. **Execution Condition**:
   - Implementation begins ONLY after the user responds to the structured choices, ensuring the AI is 100% aligned with the user's vision with zero confusion.

## Rule 20 — Git Commit Invariant: Strictly Manual on Child Projects, Auto-Commit ONLY on AI-Builder-Brain ("Child Projects Me Auto-Commit Ban, Sirf Brain Me Auto-Commit")

To ensure the user maintains complete ownership and risk-free control over their code:

1. **Child / Product Repositories (Strictly Manual Git Commits)**:
   - When building, updating, or debugging ANY child project or product repository (e.g. `c:\Old english font` or any other project directory):
   - The AI MUST NEVER run automatic `git commit` or `git push` commands.
   - All code edits MUST remain uncommitted in the local working tree (`git status` shows modified/untracked files).
   - **Rationale**: Keeping changes uncommitted allows the user to inspect the diff in the IDE ("Review Changes"), test functionality, and easily discard changes (`git checkout` / `git reset` / IDE discard) if there is any mistake or misalignment, without polluting git history.
   - The AI may commit changes in a child repository ONLY when the user explicitly instructs to commit (e.g. *"commit kar do"* / *"git commit karo"*).
2. **AI-Builder-Brain Exception (Auto-Commit & Auto-Push Permitted ONLY Here)**:
   - Autonomous `git add`, `git commit`, and `git push origin main` is permitted EXCLUSIVELY inside `C:\AI-Builder-Brain` (for autonomous learning harvesting, rule additions, and intelligence synchronization across the fleet).
   - Under no circumstances may an AI auto-commit in child repositories.

## Rule 21 — Multi-Page Architecture Invariant ("Jab Tak Na Bola Jaye, Hamesha Multi-Page Website Hi Banani Hai")

When building or architecting any website or web application:

1. **Strict Prohibition on Unrequested Single-Page Collapse**:
   - Unless the user explicitly requests a single-page landing page (e.g. *"single page banao"* or *"one-page portfolio"*), the AI MUST NEVER cram an entire project or platform into a single long-scroll page.
   - Collapsing complex tools, catalogs, documentation, generators, and categories into one page leads to massive DOM bloat, high bounce rates, poor SEO crawlability, and weak user experience.
2. **Mandatory Multi-Page Architecture (MPA)**:
   - Every website built by an AI connected to AI-Builder-Brain must be structured with dedicated, distinct static routes and pages:
     - **Homepage (`/`)**: High-impact portal overview, hero spotlight, category directory, and teasers pointing to dedicated tool pages.
     - **Dedicated Tool Pages**: Separate sub-apps with their own URLs (e.g. `/generator/`, `/translator/`, `/stencil-studio/`, `/font-pairing/`, `/frames/`).
     - **Individual Item / Specimen Pages**: Dynamic static routes for every entity (e.g. `/fonts/[slug]/`, `/items/[id]/`) featuring technical specifications, character maps, direct downloads, and copyable snippets.
     - **Taxonomy / Category Archives**: Dedicated archive pages (e.g. `/category/[category]/` or `/styles/[style]/`) targeting specific search intents.
     - **Knowledge / Educational Pages**: Deep-dive handbooks, guides, and documentation on dedicated URLs (e.g. `/handbook/`, `/docs/`).
     - **Licensing & Legal Pages**: Clear, dedicated trust pages (e.g. `/license/`, `/privacy/`, `/terms/`).
3. **SEO & Navigation Invariants**:
   - Every page must feature:
     - Unique, intent-specific `<title>` tags and `<meta name="description">`.
     - Consistent header navigation and footer linking across all pages.
     - Semantic breadcrumbs (`Home / Category / Item`) for structured schema crawling.
     - Zero-CLS pre-allocated layout slots.

## Rule 22 — Zero-Friction Autonomous Execution & Review Policy ("Suggestion User Se, Execution Auto")

A strict, non-negotiable operational boundary must be maintained between **Intent/Design Discovery** and **Tool Execution Governance**:

1. **Interactive Multi-Choice Suggestions for Intent & Scope Alignment**:
   - The user MUST be consulted via interactive multi-selector modals (`ask_question`) for:
     - Project requirements, features, branding, architecture decisions, and visual design choices.
     - Ambiguous product directions, color palettes, and scope trade-offs.
   - The AI must deep-dive with structured choices formatted as direct user responses so there is zero confusion about what to build (Rule 19).

2. **Autonomous Tool & Command Execution (Always Proceed)**:
   - Developer execution actions MUST NEVER prompt the user for execution permissions or interrupt the workflow with approval dialogs ("Allow this time?").
   - Across every project, the agent operates strictly under the standard policy:
     - **Auto Execution**: `Always Proceed`
     - **Review Policy**: `Always Proceed`
     - **Agent Auto-Fix Lints**: `On`
   - The AI MUST autonomously execute:
     - Terminal commands, package builds (`npm run build`, `npm run dev`, `vite build`, `astro build`).
     - Node inspection scripts, verification runners, static link checkers, and headless browser tests.
     - File reads, writes, and surgical replacements.
   - The agent MUST NEVER offload routine developer execution onto the user by requiring manual "Allow this time" clicks or asking permission to run ordinary commands.

3. **Preservation of the Git Commit Boundary (Rule 20 Intact)**:
   - While tool and command execution is fully autonomous (Always Proceed), code changes in child product workspaces remain uncommitted in the local working tree so the user can inspect diffs and discard mistakes at their discretion.
   - Auto-commit and git push remains restricted exclusively to `C:\AI-Builder-Brain`.

## Rule 23 — Adaptive Depth Invariant: Surface vs. Deep Execution Governance ("Jab Jiski Jarurat Ho: Surface vs. Deep Auto-Detection")

To eliminate superficial passes and ensure the AI Builder Brain's collective intelligence is deployed with the exact necessary depth:

1. **The Dynamic Depth Dilemma**:
   - Operating at the "Surface Level" (e.g., merely checking HTTP 200, verifying syntax, or testing a raw algorithm in isolation) while ignoring visual layout, responsive ergonomics, and theme controls is an **EXECUTION FAILURE**.
   - Conversely, over-engineering an isolated one-line config fix with a multi-page redesign is wasteful.
   - The AI MUST automatically classify every task into **Surface** or **Deep** and execute with the appropriate depth.

2. **Classification Matrix: Surface vs. Deep Execution**:
   - **SURFACE MODE (Lightweight & Rapid)**:
     - *Triggers*: Querying file paths, reading documentation, isolated single-line regex/math corrections, lint fixes that don't affect layout, or ad-hoc diagnostic lookups.
     - *Execution*: Fast direct edits, surgical verification, no architectural scaffolding required.
   - **DEEP MODE (MANDATORY for all User-Facing Surfaces)**:
     - *Triggers*: Any task involving UI/UX, page layout, components, visual styling, responsive design, audits, feature additions, or pre-publication reviews.
     - *Mandatory Invariants in Deep Mode*:
       1. **Dual-Theme Completeness (Dark & Light Mode)**:
          - A user-visible Theme Toggle (Sun/Moon icon button) MUST be present in the header navigation and mobile drawer.
          - Pre-hydration anti-flash script in `<head>` to prevent blinding flashes of the wrong theme on reload.
          - Both modes must have handcrafted, high-contrast aesthetics (e.g., Obsidian Dark vs. Antique Parchment Light for gothic/calligraphic tools; high readability and brand harmony in both).
          - Theme state must persist across sessions via `localStorage`.
       2. **Full Responsive Ergonomics (Zero Desktop-Only Assumptions)**:
          - Every viewport below desktop (`< 1024px` or `< 1280px`) MUST feature a dedicated mobile hamburger toggle and animated navigation drawer/modal.
          - Multi-page navigation must never disappear on mobile or leave mobile users trapped without links.
          - Headroom protection: Logos and decorative headings with large ascenders must have explicit line-height and `shrink-0` to prevent top clipping or banner bleed.
       3. **Multi-Viewport Visual & Runtime Verification**:
          - Verification MUST test at least two distinct viewport widths: Desktop (`1280px+`) and Mobile (`375px` or `390px`).
          - Never claim "everything is verified" based solely on API/terminal output; actual DOM layout, bounding client rects, and visual rendering must be verified.
       4. **Auto-Escalation**:
          - If the user asks for a feature or audit, the AI must NEVER wait for the user to prompt: *"where is mobile menu?"* or *"where is light mode?"*. The AI must proactively escalate to Deep Mode and build complete, production-grade interfaces.



