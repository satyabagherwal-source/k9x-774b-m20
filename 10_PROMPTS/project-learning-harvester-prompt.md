# Project Learning Harvester Prompt (Master Reusable AI Prompt)

Use this exact prompt whenever an AI agent completes a project or task, to forensically extract all learnings, mistakes, audits, and rules into the `AI-Builder-Brain` and next project skills repository.

---

```markdown
### SYSTEM INSTRUCTION: Comprehensive Project Learning & Forensic Audit Harvester

You have successfully completed work on this project. Now, before declaring final completion, you must perform a mandatory, deep-dive retrospective and harvest ALL learnings, mistakes, human corrections, and engineering patterns into our central AI-Builder-Brain and skills repository.

Follow these strict rules:

#### 1. Forensic Mistake & Failure Extraction (No Sugarcoating)
Examine the complete trajectory of this project and document every mistake, bug, and failed attempt:
- What did you or previous agents assume that turned out to be wrong?
- What errors or bugs did the user have to point out multiple times?
- Why did earlier attempts fail to fix the issue? What was missing in the agent's reasoning?
- What invisible gotchas (e.g. OS-specific CRLF issues, edge-hosting redirect defaults, SSR-vs-client hydration conflicts, key-existence vs semantic parity) caused the bugs?

#### 2. Audits & Provenance Documentation
- List every audit performed (SEO crawl, GSC errors, i18n parity check, runtime console errors, build logs).
- Detail why each audit was necessary and what specific scripts or commands were used to catch the defects.
- Document the exact "before" vs "after" evidence.

#### 3. Core Domain & Business Invariants (Zero Regression Guard)
- Identify what was mission-critical in this project (e.g., mathematical accuracy, canvas transformations, visual layout aesthetics, AdSense ad viewability, Core Web Vitals).
- Formulate the exact rules required so that future agents NEVER accidentally break or alter these core invariants while attempting secondary tasks (like SEO, refactoring, or i18n).

#### 4. Token-Saving & Intelligent Autonomous Execution
- Document what workflows saved the most tokens (e.g., targeted slicing instead of full-file viewing, single-purpose node audit scripts, concurrent non-blocking tasks).
- Identify any wasteful token patterns (e.g., busy-polling loops, hallucinated file structures, repetitive tool failures) and define explicit prevention rules.

#### 5. Output Destinations
You MUST write the harvested knowledge into two locations:
1. `C:\AI-Builder-Brain`:
   - Add a detailed incident record in `07_PROJECT_LEARNING/[project-name]-learnings.md` following the 10-point learning protocol.
   - Promote generalized rules as new numbered rules in `05_KNOWLEDGE/engineering-patterns.md`.
   - Update or add skills in `03_SKILLS/`.
2. Current Workspace `skills-for-next-project/`:
   - Create modular, self-contained markdown manuals for:
     * Architecture & Monetization Playbook
     * Multi-Locale / Scaling Guide
     * Mistake Prevention & Root Cause Retrospective
     * Token Efficiency & High-Speed Workflows
     * Human-Feedback Reinforcement Protocol

Commit and push the updates to the GitHub AI-Builder-Brain repository.
```
