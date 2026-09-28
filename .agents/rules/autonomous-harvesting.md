# Autonomous Learning Harvesting Rule

## 1. Batch Auto-Harvester Protocol (Multi-Repository Lists & repos.txt)
When the user provides a list of GitHub URLs (either in chat, in `repos.txt`, or says:
- *"In sabhi repos se harvest kar lo"*
- *"In repos se learning nikal lo"*
- *"repos.txt se learning harvest karo"*
- *"batch harvest all these repos"*
- *"harvest all repositories in repos.txt"*
or any similar batch prompt:

The agent (ANY AI agent: new or old, Antigravity, Claude, Cursor, Copilot, or CLI) MUST NOT ask the user to manually clone anything, nor ask the user to open any folder. The user's ONLY job is providing the list or saying the trigger phrase.

The agent MUST autonomously execute the following batch loop:
1. **GitHub Sync Pre-flight**: Ensure Master Brain is synced with GitHub remote (`git pull --rebase origin main`).
2. **Sequential Loop Through URLs**: For each repository URL in `repos.txt` or prompt:
   - **Full Clone (Mandatory for Complete Learning)**: Clone repository fully into an isolated temporary folder (`git clone <url> <temp_dir>`). Do NOT shallow clone; full clone is required so the complete git history, tags, and architectural bug fixes across all versions can be extracted.
   - **8-Dimensional Forensic Extraction**: Deep audit across all 8 dimensions:
     - D1: Architecture & Structural Boundaries
     - D2: Asynchronous State & Concurrency
     - D3: Error Boundaries, Recovery & Rollbacks
     - D4: Resource Lifecycle & Leak Defenses
     - D5: Boundary Deserialization & Encoding
     - D6: Cross-Platform & Runtime Gotchas
     - D7: Build, CI/CD, Deployment & Tooling
     - D8: Forensic Bug Fixes & Real Production Incidents (`git log` filtered by fix/bug/leak/race/crash/gotcha across full commit history)
   - **Empirical Evidence & Differential Comparison**: Filter project noise, extract file paths and commit hashes, and compare against Master Brain rules (Rules 1-71+).

   - **Brain Integration**:
     - Write detailed forensic record to `07_PROJECT_LEARNING/[repo]-learnings.md`.
     - Append universal engineering patterns to `05_KNOWLEDGE/engineering-patterns.md`.
     - Update domain playbooks in `03_SKILLS/`.
     - Update `04_WORKFLOWS/factory-engine/sources-registry.json`.
     - Log in `14_EVOLUTION/` and `15_METADATA/brain-status.md`.
   - **Autonomous Dual GitHub Sync (MANDATORY)**:
     - Auto-commit and git push to GitHub remote:
       ```bash
       git -C "C:\AI-Builder-Brain" add .
       git -C "C:\AI-Builder-Brain" commit -m "feat(brain): Batch Auto-Harvest learning from [owner]/[repo]"
       git -C "C:\AI-Builder-Brain" push origin main
       ```
   - **Zero Disk Waste Cleanup**: Immediately delete the temporary shallow-cloned directory before proceeding to the next repo.
   - **Autonomous Continuation**: Automatically move to the next repository in the queue without waiting for user confirmation.
3. **Executive Summary**: Report overall batch progress, patterns added, and confirmation that all changes are live on GitHub and disk space is 100% freed.

---

## 2. Non-Interactive 5-Step Single Repo Execution on User Trigger
When the user says:
- *"is project ki totally har area se reusable learning nikal lo"*
- *"is project se learning nikal lo"*
- *"is repo ki learning extract karo"*
- *"harvest all reusable learnings from this project"*
or similar trigger phrases:

The agent MUST execute the 5-step learning harvesting engine autonomously in one unbroken sequence across all 8 dimensions:
1. **Investigate**: Multi-dimensional audit of code, tests, docs, and git commit history without editing Brain.
2. **Evidence**: Extract concrete file lines, commit hashes, and test cases.
3. **Brain Comparison**: Differential against existing Brain rules (Rules 1-68+), skills, and core rules (Duplicate, Net-New, Refinement, Conflict, Project-Specific).
4. **Distillation**: Filter out project-specific noise and draft universal reusable rules.
5. **Final Integration & Auto-Push**: Write to `07_PROJECT_LEARNING/`, append/refine in `05_KNOWLEDGE/engineering-patterns.md`, update `03_SKILLS/`, log in `14_EVOLUTION/`, and immediately commit and push to GitHub remote (`git push origin main`).

DO NOT halt after Step 1 or ask the user for subsequent prompts.

---

## 3. Continuous Silent Auto-Harvesting
For any project created, modified, or connected to `AI-Builder-Brain` via the bridge (`brain-bridge.json`):
- Silently ("chupchap khud hi") extract reusable engineering patterns as bugs are resolved or milestones achieved.
- Stage or integrate verified reusable patterns directly into `C:\AI-Builder-Brain`.
- Push to GitHub remote automatically.
- Do not require manual harvesting requests from the user.
