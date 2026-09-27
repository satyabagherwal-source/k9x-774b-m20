# Autonomous Learning Harvesting Rule

## Non-Interactive 5-Step Execution on User Trigger
When the user says:
- *"is project ki totally har area se reusable learning nikal lo"*
- *"is project se learning nikal lo"*
- *"is repo ki learning extract karo"*
- *"harvest all reusable learnings from this project"*
or similar trigger phrases:

The agent MUST execute the 5-step learning harvesting engine autonomously in one unbroken sequence across all 8 dimensions:
1. **Investigate**: Multi-dimensional audit of code, tests, docs, and git commit history without editing Brain.
2. **Evidence**: Extract concrete file lines, commit hashes, and test cases.
3. **Brain Comparison**: Differential against existing Brain rules (Rules 1-17+), skills, and core rules (Duplicate, Net-New, Refinement, Conflict, Project-Specific).
4. **Distillation**: Filter out project-specific noise and draft universal reusable rules.
5. **Final Integration**: Write to `07_PROJECT_LEARNING/`, append/refine in `05_KNOWLEDGE/engineering-patterns.md`, update `03_SKILLS/`, and log in `14_EVOLUTION/`.

DO NOT halt after Step 1 or ask the user for subsequent prompts.

## Continuous Silent Auto-Harvesting
For any project created, modified, or connected to `AI-Builder-Brain` via the bridge (`brain-bridge.json`):
- Silently ("chupchap khud hi") extract reusable engineering patterns as bugs are resolved or milestones achieved.
- Do not require manual harvesting requests from the user.
