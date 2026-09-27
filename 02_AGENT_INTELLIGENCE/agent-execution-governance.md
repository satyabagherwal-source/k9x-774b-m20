# Agent Execution Governance & Operational Laws

> Canonical reference: `AI-Builder-Brain/02_AGENT_INTELLIGENCE/agent-execution-governance.md`  
> Purpose: Universal execution directive governing AI agent behavior across all projects, preventing attention skipping, token waste, cognitive pitfalls, and unverified completion claims.

---

## 1. The Precedence & Conflict Resolution Hierarchy (Supreme Law)

When instructions, skills, documentation, or model assumptions conflict, resolve them using this strict, non-negotiable hierarchy:

1. **LEVEL 1 (SUPREME): Human User's Explicit Real-Time Constraints**
   - E.g. "Do not alter working design/math", "Zero regressions", "Do not touch AdSense containers".
   - *Nothing overrides a direct human negative constraint.*

2. **LEVEL 2: Real Empirical Project State & Compiled Artifacts**
   - What is actually running in `dist/`, real browser DOM, actual network status codes, and terminal test outputs.
   - *Real runtime evidence strictly overrides documentation claims or source comments.*

3. **LEVEL 3: Core Domain & Business Invariants**
   - Mathematical precision, floating-point geometry, canvas transforms, AdSense viewability slots, Core Web Vitals (LCP < 1.2s, CLS = 0).

4. **LEVEL 4: Central AI-Builder-Brain Engineering Patterns**
   - Numbered rules in `05_KNOWLEDGE/engineering-patterns.md` (Rules 1 through 14+).

5. **LEVEL 5: Task-Specific Skills & Playbooks**
   - Guidelines in `03_SKILLS/`.

6. **LEVEL 6 (LOWEST): Default Model Training Assumptions & Generic Code Idioms**
   - Never let generic web framework patterns overwrite project-specific architecture.

---

## 2. The 5 Cognitive Pitfalls & Invariant Cures

| # | Cognitive Pitfall | Agent Failure Mode | The Invariant Cure |
|---|---|---|---|
| **1** | **Key Exists = Feature Done** | Agent sees key in translation dictionary or tests pass key count; assumes localization works. | Check rendered value divergence from default locale. Inspect the built `dist/` HTML. |
| **2** | **Regex Line-Ending Blindness** | Agent writes `$` or `.` regex expecting POSIX `\n`, silently dropping lines on Windows `\r\n`. | Always normalize with `split(/\r?\n/)` and `.trim()` before matching. |
| **3** | **Client Hydration Clobbering SSR** | Agent writes vanilla JS `el.textContent = '...'` using hardcoded English template strings. | Pass localized strings via `data-label` / `data-template` attributes in SSR HTML. |
| **4** | **Premature Verification Claims** | Agent writes code and immediately says "It is fixed" without building or crawling. | Always run `npm run build` and inspect `dist/` artifacts before declaring success. |
| **5** | **Collateral Damage on Domain Math** | When asked to fix SEO/routing, agent rewrites canvas transforms or breaks layout. | Strict Non-Destructive Invariant: Do not touch coordinates, scales, or canvas event listeners during infrastructure fixes. |

---

## 3. Token-Saving & Efficiency Standards

1. **Never Dump Large Files**: Viewing files >300 lines wastes context. Use regex line searches (`grep_search`) and small slice-window viewing (30–60 lines).
2. **The 15-Line Scratch Script Pattern**: When analyzing 10+ files (e.g. translation dictionaries or sitemaps), write a temporary Node.js script in `.project-brain/scratch/`, execute it to get a concise summary table, and clean it up.
3. **No Busy-Polling Loops**: When launching a background command that is expected to finish, stop calling tools and let the reactive messaging system wake you up.
4. **Persistent Caching**: When running external API queries or translations, always maintain a persistent disk cache (`cache.json`) so already-processed items cost zero tokens and zero latency.

---

## 4. Human Feedback Reinforcement Protocol

When the human user says:
- *"Same mistake is happening again"*
- *"You didn't fix it properly"*
- *"Website me koi change nahi hona chahiye"*

The agent MUST immediately:
1. Acknowledge that the previous hypothesis was incomplete or flawed.
2. Discard all confirmation bias. Stop defending previous code edits.
3. Go directly to the compiled runtime artifact (`dist/` or browser DOM) to see what the user actually sees.
4. Apply the required fix surgically and prove it with empirical output before reporting completion.

---

## 5. Autonomous 5-Step Learning Harvester Directive

### Non-Interactive Single-Command Execution (On-Demand Mode)
When the user gives an extraction trigger such as:
- *"is project ki totally har area se reusable learning nikal lo"*
- *"is project se learning nikal lo"*
- *"is repo ki learning extract karo"*
- *"harvest all reusable learnings from this project"*

The agent MUST NOT fragment the workflow into manual conversational steps or ask "Should I proceed to Step 2?". The agent MUST autonomously execute all 5 steps in one unified cycle:
1. **Investigate**: Audits code, docs, tests, and git history across all 8 dimensions without modifying Brain files.
2. **Evidence**: Gathers concrete file paths, line ranges, commit hashes, and test cases.
3. **Brain Comparison**: Computes the differential against existing Brain rules (1-17+), skills, and protocols (Duplicates, Net-New, Refinements, Conflicts, Project-Specific).
4. **Distillation**: Filters out repo-specific quirks and distills universal, reusable engineering patterns.
5. **Final Integration**: Updates `07_PROJECT_LEARNING/`, appends/refines rules in `05_KNOWLEDGE/engineering-patterns.md`, updates `03_SKILLS/`, and logs version evolution in `14_EVOLUTION/`.

### Silent Auto-Harvesting (Continuous Development & Bridged Projects)
Whenever the user is building a project or whenever a project bridges with AI-Builder-Brain:
- The agent MUST continuously and silently ("chupchap") extract reusable learnings.
- As bugs are resolved, OS gotchas uncovered, or architectural boundaries established, the agent automatically evaluates reusability and synchronizes validated engineering knowledge directly into `C:\AI-Builder-Brain`.
- The user does not need to ask or remind the agent.
